/* DAM - wymuszona zmiana slabego hasla przy logowaniu (audyt 2026-09-17).
 *
 * Most odmawia sesji, gdy haslo jest poprawne, ale slabe (np. dawne haslo kont seed).
 * To okno pozwala wlascicielowi konta ustawic nowe haslo: dowodem jest stare.
 * API: DamPasswordChange.open(email, oldPassword, onDone(newPassword)). Bez innerHTML.
 */
(function () {
  "use strict";

  function el(tag, styles, text) {
    var node = document.createElement(tag);
    if (styles) node.style.cssText = styles;
    if (text) node.textContent = text;
    return node;
  }

  var FIELD =
    "display:block;width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;" +
    "border:1px solid rgba(120,130,150,.5);background:transparent;color:inherit;font:inherit;font-size:15px;";
  var LABEL = "display:block;margin:0 0 6px;font-size:13px;font-weight:600;";

  function field(id, labelText, describedBy) {
    var wrap = el("div", "margin:0 0 14px;");
    var label = el("label", LABEL, labelText);
    label.setAttribute("for", id);
    var input = el("input", FIELD);
    input.id = id;
    input.type = "password";
    input.autocomplete = "new-password";
    input.minLength = 10;
    input.required = true;
    if (describedBy) input.setAttribute("aria-describedby", describedBy);
    wrap.appendChild(label);
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function open(email, oldPassword, onDone, opts) {
    opts = opts || {};
    var prev = document.getElementById("damPasswordChangeOverlay");
    if (prev) prev.remove();

    var overlay = el(
      "div",
      "position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;" +
        "padding:16px;background:rgba(12,16,24,.72);backdrop-filter:blur(6px);"
    );
    overlay.id = "damPasswordChangeOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "damPasswordChangeTitle");

    var card = el(
      "form",
      "width:100%;max-width:440px;box-sizing:border-box;padding:28px;border-radius:16px;" +
        "background:var(--dam-surface,#fff);color:var(--dam-text,#1a2233);" +
        "box-shadow:0 24px 64px rgba(0,0,0,.35);font:inherit;"
    );
    var title = el("h2", "margin:0 0 8px;font-size:20px;font-weight:700;line-height:1.3;", "Ustaw nowe hasło");
    title.id = "damPasswordChangeTitle";
    var lead = el(
      "p",
      "margin:0 0 20px;font-size:14px;line-height:1.55;opacity:.8;",
      "Dotychczasowe hasło konta " + email + " jest za słabe. Ustaw własne, a zalogujemy Cię od razu."
    );
    var f1 = field("damNewPassword", "Nowe hasło", "damPasswordChangeHint");
    var f2 = field("damNewPassword2", "Powtórz nowe hasło", "damPasswordChangeMsg");
    var hint = el(
      "p",
      "margin:-6px 0 14px;font-size:12px;line-height:1.45;opacity:.7;",
      "Co najmniej 10 znaków. Najlepiej kilka przypadkowych słów."
    );
    hint.id = "damPasswordChangeHint";
    var msg = el("p", "min-height:20px;margin:0 0 14px;font-size:13px;line-height:1.45;color:#c0392b;");
    msg.id = "damPasswordChangeMsg";
    msg.setAttribute("role", "alert");

    var row = el("div", "display:flex;gap:10px;");
    var cancel = el(
      "button",
      "flex:0 0 auto;padding:12px 16px;border-radius:10px;cursor:pointer;background:transparent;color:inherit;" +
        "border:1px solid rgba(120,130,150,.5);font:600 15px/1.2 inherit;",
      "Anuluj"
    );
    cancel.type = "button";
    var save = el(
      "button",
      "flex:1 1 auto;padding:12px 16px;border:0;border-radius:10px;cursor:pointer;" +
        "background:var(--dam-primary,#0a7b3e);color:#fff;font:600 15px/1.2 inherit;",
      "Zapisz i zaloguj"
    );
    save.type = "submit";

    function close() {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
    }
    function onKey(ev) {
      if (ev.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    cancel.addEventListener("click", close);

    card.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var a = f1.input.value || "";
      var b = f2.input.value || "";
      if (a.length < 10) {
        msg.textContent = "Nowe hasło musi mieć co najmniej 10 znaków.";
        f1.input.focus();
        return;
      }
      if (a !== b) {
        msg.textContent = "Hasła nie są takie same.";
        f2.input.focus();
        return;
      }
      if (!window.DamApi || typeof window.DamApi.changePassword !== "function") {
        msg.textContent = "Brak połączenia z aplikacją. Uruchom DAM ponownie.";
        return;
      }
      save.disabled = true;
      save.textContent = "Zapisuję...";
      msg.textContent = "";
      window.DamApi.changePassword(email, oldPassword, a)
        .then(function () {
          close();
          if (typeof onDone === "function") onDone(a);
        })
        .catch(function (err) {
          save.disabled = false;
          save.textContent = "Zapisz i zaloguj";
          msg.textContent = (err && err.message) || "Nie udało się zmienić hasła.";
        });
    });

    row.appendChild(cancel);
    row.appendChild(save);
    card.appendChild(title);
    if (typeof opts.onSkip === "function") {
      var beta = el(
        "p",
        "margin:0 0 14px;padding:10px 12px;border-radius:10px;font-size:13px;line-height:1.5;" +
          "background:rgba(10,123,62,.1);border:1px solid rgba(10,123,62,.35);",
        "Aplikacja jest w trybie testowym (BETA). Zmiana hasła nie jest teraz wymagana, możesz ten krok pominąć."
      );
      card.appendChild(beta);
      var skip = el(
        "button",
        "display:block;width:100%;margin:0 0 14px;padding:12px 16px;border-radius:10px;cursor:pointer;" +
          "background:var(--dam-primary,#0a7b3e);color:#fff;border:0;font:600 15px/1.2 inherit;",
        "POMIŃ ten krok"
      );
      skip.type = "button";
      skip.addEventListener("click", function () {
        skip.disabled = true;
        skip.textContent = "Loguję...";
        msg.textContent = "";
        Promise.resolve(opts.onSkip())
          .then(close)
          .catch(function (err) {
            skip.disabled = false;
            skip.textContent = "POMIŃ ten krok";
            msg.textContent = (err && err.message) || "Nie udało się zalogować.";
          });
      });
      card.appendChild(skip);
    }
    card.appendChild(lead);
    card.appendChild(f1.wrap);
    card.appendChild(hint);
    card.appendChild(f2.wrap);
    card.appendChild(msg);
    card.appendChild(row);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    f1.input.focus();
  }

  window.DamPasswordChange = { open: open };
})();
