/* DAM - Ustawienia: konflikty i historia skojarzen produktow (tylko admin, ADR-011).
 *
 * Postgres na Synology jest baza glowna. Gdy dwie zmiany tego samego skojarzenia
 * sie zderza, program zostawia nowsza, a przegrana wersja trafia tutaj. Admin moze
 * zostawic wybor programu albo przywrocic odrzucona / poprzednia wersje.
 * Historia 30 dni. Bez innerHTML.
 */
(function () {
  "use strict";

  var PAGE = 50;
  var STATUS = {
    auto: "Automatyczne",
    pending: "Do sprawdzenia",
    confirmed: "Potwierdzone",
    rejected: "Odrzucone",
    skipped: "Pominięte"
  };
  var NOTE = {
    offline_change_older: "Zmiana zrobiona offline była starsza niż zmiana w bazie.",
    older_than_server: "Ta zmiana była starsza niż wersja w bazie.",
    auto_vs_manual: "Automat nie nadpisuje ręcznej decyzji."
  };
  var RESOLUTION = {
    accepted: "Zostawiono wybór programu",
    restored_lost: "Przywrócono odrzuconą wersję",
    restored_kept: "Przywrócono wersję programu"
  };
  var view = { kind: "conflict", items: [], total: 0, open: 0 };

  function bridge() {
    try {
      if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
        return String(window.DamRuntime.bridgeUrl()).replace(/\/$/, "");
      }
    } catch (_e) { /* fallback */ }
    return "http://127.0.0.1:8766";
  }

  function headers() {
    var h = { "Content-Type": "application/json", Accept: "application/json" };
    var t = "";
    try { t = localStorage.getItem("dam_token") || ""; } catch (_e) { t = ""; }
    if (t) h.Authorization = "Bearer " + t;
    return h;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function button(label, variant, onClick) {
    var b = el("button", "dam-sw-btn dam-sw-btn--" + variant, label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function when(iso) {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString("pl-PL"); } catch (_e) { return iso; }
  }

  function who(v) {
    var by = String((v && v.updated_by) || "");
    return by.indexOf("restore:") === 0 ? "przywrócone przez " + by.slice(8) : by;
  }

  function version(label, v, mod) {
    var box = el("div", "dam-assoc-hist__ver dam-assoc-hist__ver--" + mod);
    box.appendChild(el("span", "dam-assoc-hist__ver-label", label));
    if (!v) {
      box.appendChild(el("span", "dam-assoc-hist__status", "Brak"));
      return box;
    }
    box.appendChild(el("span", "dam-assoc-hist__status", STATUS[v.status] || v.status || ""));
    var bits = [];
    if (v.source) bits.push("źródło: " + v.source);
    if (who(v)) bits.push(who(v));
    if (v.updated_at) bits.push(when(v.updated_at));
    box.appendChild(el("span", "dam-assoc-hist__meta", bits.join(", ")));
    return box;
  }

  function post(path, payload, btn, section) {
    btn.disabled = true;
    fetch(bridge() + path, { method: "POST", headers: headers(), body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) {
          btn.disabled = false;
          window.alert("Nie udało się zapisać zmiany. Sprawdź połączenie z bazą na Synology.");
          return;
        }
        load(section, false);
      })
      .catch(function () {
        btn.disabled = false;
        window.alert("Brak połączenia z mostkiem DAM.");
      });
  }

  function renderItem(section, item) {
    var li = el("li", "dam-assoc-hist__item");
    var head = el("div", "dam-assoc-hist__head");
    var name = item.asset_name || item.asset_id;
    var asset = el("span", "dam-assoc-hist__asset", name + " → " + item.product_id);
    if (item.asset_path) asset.title = item.asset_path;
    head.appendChild(asset);
    head.appendChild(el("span", "dam-assoc-hist__meta", item.asset_id + ", " + when(item.created_at)));
    li.appendChild(head);
    if (item.kind === "conflict" && NOTE[item.note]) {
      li.appendChild(el("p", "dam-assoc-hist__meta", NOTE[item.note]));
    }

    var conflict = item.kind === "conflict";
    var versions = el("div", "dam-assoc-hist__versions");
    versions.appendChild(version(conflict ? "Obecnie w bazie" : "Po zmianie", item.kept, "kept"));
    versions.appendChild(version(conflict ? "Odrzucona wersja" : "Przed zmianą", item.lost, "lost"));
    li.appendChild(versions);

    if (item.resolved_at) {
      li.appendChild(el(
        "p",
        "dam-assoc-hist__done",
        (RESOLUTION[item.resolution] || item.resolution) + ": " + item.resolved_by + ", " + when(item.resolved_at)
      ));
    }
    var actions = el("div", "dam-assoc-hist__actions");
    if (conflict && !item.resolved_at) {
      var keep = button("Zostaw wybór programu", "ghost", function () {
        post("/assoc/history/resolve", { id: item.id }, keep, section);
      });
      actions.appendChild(keep);
    }
    if (item.lost && item.lost.status && (!conflict || !item.resolved_at)) {
      var label = conflict ? "Przywróć odrzuconą wersję" : "Przywróć stan sprzed zmiany";
      var restore = button(label, "primary", function () {
        if (!window.confirm(label + "?\n\n" + (item.asset_name || item.asset_id) + " → " + item.product_id)) return;
        post("/assoc/history/restore", { id: item.id, version: "lost" }, restore, section);
      });
      actions.appendChild(restore);
    }
    if (actions.firstChild) li.appendChild(actions);
    return li;
  }

  function render(section, data) {
    var body = section.querySelector("#damAssocHistoryBody");
    while (body.firstChild) body.removeChild(body.firstChild);

    var tabs = el("div", "dam-assoc-hist__tabs");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "Widok");
    [["conflict", "Otwarte konflikty (" + view.open + ")"], ["change", "Historia zmian"]].forEach(function (t) {
      var active = view.kind === t[0];
      var b = button(t[1], active ? "soft" : "ghost", function () {
        if (view.kind === t[0]) return;
        view.kind = t[0];
        load(section, false);
      });
      b.setAttribute("aria-pressed", active ? "true" : "false");
      tabs.appendChild(b);
    });
    body.appendChild(tabs);

    if (!data) {
      body.appendChild(el("p", "dam-widget__meta",
        "Brak połączenia z bazą na Synology. Konflikty i historię można przeglądać tylko online."));
      return;
    }
    if (!view.items.length) {
      body.appendChild(el("p", "dam-widget__meta", view.kind === "conflict"
        ? "Brak konfliktów. Wszystkie zmiany skojarzeń zapisały się bez sporu."
        : "Brak zmian w ostatnich " + (data.retention_days || 30) + " dniach."));
      return;
    }
    var list = el("ul", "dam-assoc-hist__list");
    view.items.forEach(function (item) { list.appendChild(renderItem(section, item)); });
    body.appendChild(list);

    if (view.items.length < view.total) {
      var more = button("Pokaż więcej (" + (view.total - view.items.length) + ")", "ghost", function () {
        more.disabled = true;
        load(section, true);
      });
      more.style.marginTop = "12px";
      body.appendChild(more);
    }
  }

  function load(section, append) {
    var offset = append ? view.items.length : 0;
    var q = "?kind=" + view.kind + "&open=" + (view.kind === "conflict" ? "1" : "0") +
      "&limit=" + PAGE + "&offset=" + offset;
    fetch(bridge() + "/assoc/history" + q, { headers: headers(), cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : r.status === 401 || r.status === 403 ? "denied" : null; })
      .then(function (data) {
        if (data === "denied") return; /* nie admin: sekcja zostaje ukryta */
        section.hidden = false;
        if (!data || !data.ok) {
          view.items = [];
          render(section, null);
          return;
        }
        view.items = append ? view.items.concat(data.items || []) : (data.items || []);
        view.total = data.total || 0;
        view.open = data.open_conflicts || 0;
        render(section, data);
      })
      .catch(function () { /* most offline: sekcja zostaje jak byla */ });
  }

  function init() {
    var section = document.getElementById("damAssocHistory");
    if (section) load(section, false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
