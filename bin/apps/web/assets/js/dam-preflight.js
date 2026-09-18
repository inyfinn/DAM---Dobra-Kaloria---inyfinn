/**
 * DAM preflight - pasek "Program nie jest gotowy" nad treścią strony.
 *
 * Po załadowaniu pyta most GET /preflight (limit 3 s). Gdy któryś punkt jest
 * blokujący (folder Marketing brak / niezapisany, brak indeksu, watcher padł),
 * pokazuje zwijany pasek z listą problemów i akcjami. Gdy wszystko ok - nic.
 * Most offline = nic (czerwony pasek pokazuje dam-root-status.js).
 *
 * Dane wyłącznie przez textContent (bez innerHTML).
 * API: window.DamPreflight = { check, render, clear }.
 */
(function () {
  "use strict";

  var TIMEOUT_MS = 3000;
  var FIRST_CHECK_DELAY_MS = 1500;
  var RECHECK_MS = 20000;
  var COLLAPSE_KEY = "dam_preflight_collapsed";
  var BAR_ID = "damPreflightBar";
  var _timer = null;
  var _busy = false;

  function bridgeBase() {
    if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
      return window.DamRuntime.bridgeUrl();
    }
    if (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function") {
      return window.DamPaths.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function readCollapsed() {
    try { return sessionStorage.getItem(COLLAPSE_KEY) === "1"; } catch (_e) { return false; }
  }

  function writeCollapsed(v) {
    try { sessionStorage.setItem(COLLAPSE_KEY, v ? "1" : "0"); } catch (_e) { /* ignore */ }
  }

  function fetchReport() {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
    return fetch(bridgeBase() + "/preflight", {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (data) {
        clearTimeout(timer);
        return data;
      });
  }

  function injectCss() {
    if (document.getElementById("damPreflightCss")) return;
    var st = document.createElement("style");
    st.id = "damPreflightCss";
    st.textContent = [
      ".dam-preflight{margin:0 0 16px;border:1px solid rgba(225,29,72,.35);border-left:4px solid #e11d48;",
      "border-radius:12px;background:var(--dam-surface,#fff);color:var(--dam-text,#1e293b);",
      "box-shadow:0 6px 24px rgba(15,23,42,.06);font-size:14px;line-height:1.45}",
      /* Lepki pasek wyszukiwania (Eksplorer / Wizualizacje) maluje szron --dam-sticky-top nad soba. */
      ".dam-preflight:has(+ .dam-explorer-shell),.dam-preflight:has(+ .geex-content__wrapper .dam-global-search-block)",
      "{margin-bottom:calc(var(--dam-sticky-top,25px) + 12px)}",
      ".dam-preflight__head{display:flex;align-items:center;gap:10px;padding:12px 14px;flex-wrap:wrap}",
      ".dam-preflight__icon{width:28px;height:28px;flex:0 0 28px;border-radius:50%;display:flex;",
      "align-items:center;justify-content:center;background:rgba(225,29,72,.12);color:#e11d48;font-weight:700}",
      ".dam-preflight__title{flex:1 1 220px;margin:0;font-size:15px;font-weight:600}",
      ".dam-preflight__btn{font:inherit;font-weight:600;border-radius:8px;padding:6px 12px;cursor:pointer;",
      "border:1px solid var(--dam-border,#e2e8f0);background:var(--dam-surface,#fff);color:var(--dam-text,#1e293b)}",
      ".dam-preflight__btn:hover{border-color:var(--dam-primary,#6c5dd3)}",
      ".dam-preflight__btn--primary{background:var(--dam-primary,#6c5dd3);border-color:var(--dam-primary,#6c5dd3);color:#fff}",
      ".dam-preflight__btn:focus-visible{outline:2px solid var(--dam-primary,#6c5dd3);outline-offset:2px}",
      ".dam-preflight__list{list-style:none;margin:0;padding:0 14px 12px 52px;display:flex;flex-direction:column;gap:10px}",
      ".dam-preflight.is-collapsed .dam-preflight__list{display:none}",
      ".dam-preflight__item{display:flex;flex-direction:column;gap:4px}",
      ".dam-preflight__label{font-weight:600}",
      ".dam-preflight__item--warn .dam-preflight__label::before{content:'Uwaga: ';color:#b45309}",
      ".dam-preflight__hint{color:var(--dam-text-muted,#64748b);word-break:break-word}",
      ".dam-preflight__actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}"
    ].join("");
    document.head.appendChild(st);
  }

  function button(label, primary, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "dam-preflight__btn" + (primary ? " dam-preflight__btn--primary" : "");
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function scheduleRecheck(ms) {
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(check, ms);
  }

  function useDetected(path) {
    if (window.DamPaths && typeof window.DamPaths.setBasePath === "function") {
      window.DamPaths.setBasePath(path);
    }
    scheduleRecheck(1200);
  }

  function openPicker() {
    if (window.DamPaths && typeof window.DamPaths.openSetupModal === "function") {
      window.DamPaths.openSetupModal();
    }
    scheduleRecheck(RECHECK_MS);
  }

  function itemActions(item) {
    var box = document.createElement("div");
    box.className = "dam-preflight__actions";
    if (item.action === "pick_marketing") {
      var found = Array.isArray(item.detected) ? item.detected : [];
      if (found.length === 1) {
        box.appendChild(button("Użyj: " + found[0], true, function () { useDetected(found[0]); }));
        box.appendChild(button("Wybierz inny folder", false, openPicker));
      } else {
        box.appendChild(button("Wybierz folder Marketing", true, openPicker));
      }
    } else if (item.action === "activate") {
      box.appendChild(button("Wpisz kod aktywacyjny", false, function () {
        window.location.href = "signin.html";
      }));
    }
    return box.childNodes.length ? box : null;
  }

  function problemsLabel(n) {
    if (n === 1) return "1 problem";
    var last = n % 10;
    var lastTwo = n % 100;
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return n + " problemy";
    return n + " problemów";
  }

  function clear() {
    var bar = document.getElementById(BAR_ID);
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
  }

  function mountPoint() {
    var content = document.querySelector(".geex-content");
    if (!content) return { parent: document.body, before: document.body.firstChild };
    var header = content.querySelector(":scope > .geex-content__header");
    return { parent: content, before: header ? header.nextSibling : content.firstChild };
  }

  function render(report) {
    var items = (report && Array.isArray(report.items)) ? report.items : [];
    var blocking = items.filter(function (i) { return i && i.blocking; });
    if (!blocking.length) {
      clear();
      return false;
    }
    var warnings = items.filter(function (i) { return i && !i.blocking && i.level === "warn"; });
    var shown = blocking.concat(warnings);
    injectCss();
    clear();
    var collapsed = readCollapsed();

    var bar = document.createElement("section");
    bar.id = BAR_ID;
    bar.className = "dam-preflight" + (collapsed ? " is-collapsed" : "");
    bar.setAttribute("role", "alert");

    var head = document.createElement("div");
    head.className = "dam-preflight__head";
    var icon = document.createElement("span");
    icon.className = "dam-preflight__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "!";
    var title = document.createElement("h3");
    title.className = "dam-preflight__title";
    title.textContent = "Pliki mogą się nie wyświetlać: " + problemsLabel(blocking.length);

    var list = document.createElement("ul");
    list.className = "dam-preflight__list";
    list.id = BAR_ID + "List";
    shown.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "dam-preflight__item" + (item.blocking ? "" : " dam-preflight__item--warn");
      var label = document.createElement("span");
      label.className = "dam-preflight__label";
      label.textContent = String(item.label || item.id || "");
      li.appendChild(label);
      if (item.hint) {
        var hint = document.createElement("span");
        hint.className = "dam-preflight__hint";
        hint.textContent = String(item.hint);
        li.appendChild(hint);
      }
      var acts = itemActions(item);
      if (acts) li.appendChild(acts);
      list.appendChild(li);
    });

    var retry = button("Spróbuj ponownie", false, function () {
      retry.disabled = true;
      retry.textContent = "Sprawdzam…";
      check();
    });
    var toggle = button(collapsed ? "Pokaż szczegóły" : "Zwiń", false, function () {
      var now = !bar.classList.contains("is-collapsed");
      bar.classList.toggle("is-collapsed", now);
      toggle.textContent = now ? "Pokaż szczegóły" : "Zwiń";
      toggle.setAttribute("aria-expanded", now ? "false" : "true");
      writeCollapsed(now);
    });
    toggle.setAttribute("aria-controls", list.id);
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");

    head.appendChild(icon);
    head.appendChild(title);
    head.appendChild(retry);
    head.appendChild(toggle);
    bar.appendChild(head);
    bar.appendChild(list);

    var at = mountPoint();
    at.parent.insertBefore(bar, at.before || null);
    return true;
  }

  /** Swiezo zapisana sciezka w localStorage trafia do mostu chwile po starcie (dam-paths.js). */
  function pendingLocalBase(report) {
    var items = (report && report.items) || [];
    var m = items.filter(function (i) { return i && i.id === "marketing"; })[0];
    if (!m || m.ok || m.path) return false;
    try {
      return !!(window.DamPaths && typeof window.DamPaths.getBasePath === "function" && window.DamPaths.getBasePath());
    } catch (_e) {
      return false;
    }
  }

  var _deferredOnce = false;

  function check() {
    if (_busy) return Promise.resolve(null);
    _busy = true;
    return fetchReport().then(function (report) {
      _busy = false;
      if (!report) {
        clear();
        return null;
      }
      if (!_deferredOnce && pendingLocalBase(report)) {
        _deferredOnce = true;
        scheduleRecheck(4000);
        return report;
      }
      var shown = render(report);
      if (shown) scheduleRecheck(RECHECK_MS);
      return report;
    });
  }

  window.DamPreflight = { check: check, render: render, clear: clear };

  function start() {
    setTimeout(check, FIRST_CHECK_DELAY_MS);
    window.addEventListener("dam:index-refreshed", function () { scheduleRecheck(500); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
