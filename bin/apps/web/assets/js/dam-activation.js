/* DAM - kod aktywacyjny (pierwsze uruchomienie po instalacji).
 *
 * Instalator nie wozi juz jawnego hasla do bazy (audyt 2026-09-17). Wozi szyfrogram,
 * ktory odblokowuje kod przekazany przez administratora poza aplikacja. Most zapisuje
 * potem konfiguracje pod Windows DPAPI i pyta o kod tylko raz na konto Windows.
 *
 * Skrypt sam sprawdza GET /db/activation i sam buduje okno. Bez innerHTML.
 */
(function () {
  "use strict";

  function bridge() {
    try {
      if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
        return String(window.DamRuntime.bridgeUrl()).replace(/\/$/, "");
      }
    } catch (_e) { /* fallback nizej */ }
    return "http://127.0.0.1:8766";
  }

  function el(tag, styles, text) {
    var node = document.createElement(tag);
    if (styles) node.style.cssText = styles;
    if (text) node.textContent = text;
    return node;
  }

  function formatCode(raw) {
    var clean = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 25);
    var parts = clean.match(/.{1,5}/g) || [];
    return parts.join("-");
  }

  function show(reason) {
    if (document.getElementById("damActivationOverlay")) return;
    var passwordChanged = reason === "auth_failed";
    var overlay = el(
      "div",
      "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;" +
        "padding:16px;background:rgba(12,16,24,.72);backdrop-filter:blur(6px);"
    );
    overlay.id = "damActivationOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "damActivationTitle");

    var card = el(
      "form",
      "width:100%;max-width:440px;box-sizing:border-box;padding:28px;border-radius:16px;" +
        "background:var(--dam-surface,#fff);color:var(--dam-text,#1a2233);" +
        "box-shadow:0 24px 64px rgba(0,0,0,.35);font:inherit;"
    );
    var title = el(
      "h2",
      "margin:0 0 8px;font-size:20px;font-weight:700;line-height:1.3;",
      passwordChanged ? "Hasło do bazy się zmieniło" : "Kod aktywacyjny"
    );
    title.id = "damActivationTitle";
    var lead = el(
      "p",
      "margin:0 0 20px;font-size:14px;line-height:1.55;opacity:.8;",
      passwordChanged
        ? "Baza Synology odrzuciła zapisane hasło, więc DAM pracuje na kopii lokalnej. Wpisz kod aktywacyjny " +
            "z tej wersji instalatora - później aktualizacje odświeżą hasło same."
        : "To pierwsze uruchomienie DAM na tym koncie Windows. Wpisz kod, który dostałeś od administratora. " +
            "Kod jest potrzebny tylko raz."
    );
    var label = el("label", "display:block;margin:0 0 6px;font-size:13px;font-weight:600;", "Kod");
    label.setAttribute("for", "damActivationCode");
    var input = el(
      "input",
      "display:block;width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;" +
        "border:1px solid rgba(120,130,150,.5);background:transparent;color:inherit;" +
        "font:600 16px/1.2 ui-monospace,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;"
    );
    input.id = "damActivationCode";
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX";
    input.setAttribute("aria-describedby", "damActivationMsg");
    var msg = el("p", "min-height:20px;margin:10px 0 14px;font-size:13px;line-height:1.45;color:#c0392b;");
    msg.id = "damActivationMsg";
    msg.setAttribute("role", "alert");
    var btn = el(
      "button",
      "display:block;width:100%;padding:12px 16px;border:0;border-radius:10px;cursor:pointer;" +
        "background:var(--dam-primary,#0a7b3e);color:#fff;font:600 15px/1.2 inherit;",
      "Aktywuj"
    );
    btn.type = "submit";

    input.addEventListener("input", function () {
      var pos = input.value.length === input.selectionStart;
      input.value = formatCode(input.value);
      if (pos) input.setSelectionRange(input.value.length, input.value.length);
      msg.textContent = "";
    });

    card.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var code = formatCode(input.value);
      if (code.replace(/-/g, "").length < 16) {
        msg.textContent = "Kod jest za krótki. Sprawdź, czy wpisałeś wszystkie znaki.";
        input.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = "Sprawdzam...";
      fetch(bridge() + "/db/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ code: code })
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok) {
            btn.textContent = "Aktywowano";
            window.setTimeout(function () { window.location.reload(); }, 400);
            return;
          }
          btn.disabled = false;
          btn.textContent = "Aktywuj";
          msg.textContent =
            (res && res.hint) || "Nie udało się aktywować. Sprawdź kod albo poproś administratora o nowy.";
          input.focus();
          input.select();
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = "Aktywuj";
          msg.textContent = "Brak połączenia z mostem DAM. Uruchom aplikację ponownie.";
        });
    });

    card.appendChild(title);
    card.appendChild(lead);
    card.appendChild(label);
    card.appendChild(input);
    card.appendChild(msg);
    card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    input.focus();
  }

  // Odrzucone haslo wychodzi dopiero po pierwszej probie polaczenia (watek zdrowia
  // co ~5 s), wiec sprawdzamy jeszcze raz chwile po starcie strony.
  function check(again) {
    fetch(bridge() + "/db/activation", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.activation_required === true) show(res.reason || "");
        else if (again) window.setTimeout(function () { check(false); }, 8000);
      })
      .catch(function () { /* most jeszcze wstaje: signin i tak pokaze swoj stan */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { check(true); });
  } else {
    check(true);
  }
})();
