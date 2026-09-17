/* DAM - Ustawienia: zablokowane adresy IP (tylko admin).
 *
 * Most w trybie publicznym (panel na Synology) blokuje IP po 3 nieudanych logowaniach
 * w 999 minut. Blokada jest stala; zdejmuje ja administrator tutaj. Bez innerHTML.
 */
(function () {
  "use strict";

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

  function when(ts) {
    try { return new Date(Number(ts) * 1000).toLocaleString("pl-PL"); } catch (_e) { return ""; }
  }

  function render(section, data) {
    var body = section.querySelector("#damIpBlocksBody");
    while (body.firstChild) body.removeChild(body.firstChild);
    var rule = el(
      "p",
      "dam-widget__meta",
      "Reguła: " + data.max_failures + " nieudane logowania z jednego adresu w ciągu " + data.window_minutes +
        " minut blokują ten adres na stałe. Biała lista: " + ((data.allowlist || []).join(", ") || "brak") + "."
    );
    body.appendChild(rule);
    var blocks = data.blocks || [];
    if (!blocks.length) {
      body.appendChild(el("p", "dam-widget__meta", "Żaden adres nie jest zablokowany."));
      return;
    }
    var list = el("ul", "");
    list.style.cssText = "list-style:none;margin:12px 0 0;padding:0;display:grid;gap:8px;";
    blocks.forEach(function (b) {
      var li = el("li", "");
      li.style.cssText =
        "display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:10px 12px;border-radius:10px;" +
        "border:1px solid rgba(120,130,150,.35);";
      var ip = el("strong", "", b.ip);
      ip.style.cssText = "font-family:ui-monospace,Consolas,monospace;";
      var meta = el("span", "dam-widget__meta", when(b.blocked_at) + (b.last_email ? " · ostatnia próba: " + b.last_email : ""));
      meta.style.cssText = "flex:1 1 220px;margin:0;";
      var btn = el("button", "btn btn-sm btn-outline-primary", "Odblokuj");
      btn.type = "button";
      btn.setAttribute("aria-label", "Odblokuj adres " + b.ip);
      btn.addEventListener("click", function () {
        btn.disabled = true;
        fetch(bridge() + "/auth/ip-unblock", { method: "POST", headers: headers(), body: JSON.stringify({ ip: b.ip }) })
          .then(function (r) { return r.json(); })
          .then(function () { load(section); })
          .catch(function () { btn.disabled = false; });
      });
      li.appendChild(ip);
      li.appendChild(meta);
      li.appendChild(btn);
      list.appendChild(li);
    });
    body.appendChild(list);
  }

  function load(section) {
    fetch(bridge() + "/auth/ip-blocks", { headers: headers(), cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok) return; /* nie admin: sekcja zostaje ukryta */
        section.hidden = false;
        render(section, data);
      })
      .catch(function () { /* most offline */ });
  }

  function init() {
    var section = document.getElementById("damIpBlocks");
    if (section) load(section);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
