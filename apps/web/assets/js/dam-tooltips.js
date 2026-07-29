/**
 * DAM - Global Tooltips Helper
 * Pokazuje tooltip dla elementow z data-dam-tip, title lub aria-label.
 * Szanuje localStorage.dam_tooltips=off.
 * Ustawienie: localStorage.dam_tooltips ("on" | "off"), domyślnie on.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "dam_tooltips";
  var DELAY_MS = 280;
  var tipEl = null;
  var showTimer = null;

  /* Tooltips tagow facetow (filtry wyszukiwania): 1.5 s hoveru, fade-in,
     opis tagu + instrukcja CTRL+klik z opcja "Nie przypominaj wiecej". */
  var FACET_DELAY_MS = 1500;
  var FACET_HINT_KEY = "damTagCtrlHintDismissed";
  var facetTipEl = null;
  var facetTimer = null;
  var facetHideTimer = null;

  function isEnabled() {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  }

  function tipText(el) {
    if (!el || !el.getAttribute) return "";
    return (
      el.getAttribute("data-dam-tip") ||
      el.getAttribute("title") ||
      el.getAttribute("aria-label") ||
      ""
    ).trim();
  }

  function getOrCreateTip() {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "dam-tooltip";
      tipEl.id = "damGlobalTooltip";
      tipEl.setAttribute("role", "tooltip");
      tipEl.setAttribute("aria-hidden", "true");
      tipEl.style.display = "none";
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }

  function lifecycleTipChipClass(letter) {
    var l = String(letter || "—").trim();
    if (l === "F") return "dam-lifecycle-chip dam-lifecycle-chip--f";
    if (l === "X") return "dam-lifecycle-chip dam-lifecycle-chip--x";
    if (l === "D") return "dam-lifecycle-chip dam-lifecycle-chip--d";
    return "dam-lifecycle-chip dam-lifecycle-chip--clear";
  }

  function escapeTipText(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showTip(el, text) {
    var tip = getOrCreateTip();
    var lifeLetter = el && el.getAttribute ? el.getAttribute("data-life-letter") : "";
    var isRestore =
      el &&
      (el.hasAttribute("data-life-restore") ||
        (el.classList && el.classList.contains("dam-life-hist__act--restore")));
    if (isRestore) {
      var lit = String(lifeLetter || "—").trim() || "—";
      if (lit === "∅") lit = "—";
      tip.innerHTML =
        '<span class="dam-life-hist__restore-tip">Przywraca status tej pozycji ' +
        '<span class="' +
        lifecycleTipChipClass(lit) +
        '" aria-hidden="true">' +
        escapeTipText(lit) +
        "</span></span>";
    } else {
      tip.textContent = text;
    }
    tip.style.visibility = "hidden";
    tip.style.display = "block";
    tip.setAttribute("aria-hidden", "false");
    /* fixed - wspolrzedne viewport (dziala nad modalem) */
    tip.style.position = "fixed";
    tip.style.zIndex = "20050";

    var rect = el.getBoundingClientRect();
    var tipW = Math.min(tip.offsetWidth || 280, window.innerWidth - 24);
    var tipH = tip.offsetHeight || 40;

    var left = rect.left + rect.width / 2 - tipW / 2;
    var maxLeft = window.innerWidth - tipW - 12;
    if (left > maxLeft) left = maxLeft;
    if (left < 12) left = 12;

    /* Stopka modala: tip nad przyciskiem (nie pod viewport) */
    var preferAbove = rect.top > window.innerHeight * 0.55;
    var top = preferAbove ? rect.top - tipH - 8 : rect.bottom + 8;
    if (!preferAbove && top + tipH + 12 > window.innerHeight) {
      top = rect.top - tipH - 8;
    }
    if (top < 8) top = 8;

    tip.style.top = Math.round(top) + "px";
    tip.style.left = Math.round(left) + "px";
    tip.style.visibility = "visible";
  }

  function hideTip() {
    clearTimeout(showTimer);
    if (tipEl) {
      tipEl.style.display = "none";
      tipEl.setAttribute("aria-hidden", "true");
    }
  }

  /* ---------- Facet tag tooltips (tylko tagi filtrow wyszukiwania) ---------- */

  function isFacetTag(el) {
    if (!el || el.nodeType !== 1 || !el.classList) return false;
    if (!el.classList.contains("dam-badge-tag")) return false;
    if (!el.hasAttribute("data-tag-key")) return false;
    return !!(el.closest && el.closest(".dam-branding-tag-filters"));
  }

  function facetHintDismissed() {
    return localStorage.getItem(FACET_HINT_KEY) === "1";
  }

  function facetTagDesc(el) {
    var label = "";
    var node = el.firstChild;
    while (node) {
      if (node.nodeType === 3) label += node.textContent;
      node = node.nextSibling;
    }
    label = label.trim() || (el.textContent || "").replace(/\(.*\)$/, "").trim();
    var row = el.closest(".dam-tag-group-row");
    var groupLabel = "";
    if (row) {
      var lbl = row.querySelector(".dam-tag-group-label");
      if (lbl) groupLabel = (lbl.textContent || "").trim().replace(/:$/, "");
    }
    var desc = "Tag „" + label + "”";
    if (groupLabel) desc += " z grupy „" + groupLabel + "”";
    desc += ". Zawęża wyniki do materiałów oznaczonych tym tagiem.";
    return desc;
  }

  function ensureFacetTip() {
    if (facetTipEl) return facetTipEl;
    if (!document.getElementById("damFacetTipCss")) {
      var st = document.createElement("style");
      st.id = "damFacetTipCss";
      st.textContent =
        "#damFacetTip{position:fixed;z-index:20060;max-width:280px;background:#23202e;color:#fff;" +
        "border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.5;" +
        "box-shadow:0 10px 30px rgb(23 22 30 / .3);opacity:0;transition:opacity .25s ease;" +
        "pointer-events:none;}" +
        "#damFacetTip.is-on{opacity:1;pointer-events:auto;}" +
        "#damFacetTip .dam-facet-tip__hint{margin-top:8px;padding-top:8px;" +
        "border-top:1px solid rgb(255 255 255 / .16);color:rgb(255 255 255 / .85);}" +
        "#damFacetTip .dam-facet-tip__dismiss{display:inline-block;margin-top:6px;padding:0;" +
        "border:0;background:none;color:#c8a2e8;font-size:11.5px;font-weight:600;cursor:pointer;" +
        "text-decoration:underline;}" +
        "#damFacetTip .dam-facet-tip__dismiss:hover{color:#e0c7f5;}";
      document.head.appendChild(st);
    }
    facetTipEl = document.createElement("div");
    facetTipEl.id = "damFacetTip";
    facetTipEl.setAttribute("role", "tooltip");
    document.body.appendChild(facetTipEl);
    facetTipEl.addEventListener("mouseenter", function () {
      clearTimeout(facetHideTimer);
    });
    facetTipEl.addEventListener("mouseleave", function () {
      hideFacetTip();
    });
    facetTipEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".dam-facet-tip__dismiss");
      if (!btn) return;
      localStorage.setItem(FACET_HINT_KEY, "1");
      var hint = facetTipEl.querySelector(".dam-facet-tip__hint");
      if (hint) hint.remove();
    });
    return facetTipEl;
  }

  function showFacetTip(el) {
    var tip = ensureFacetTip();
    var html = '<div class="dam-facet-tip__desc"></div>';
    tip.innerHTML = html;
    tip.querySelector(".dam-facet-tip__desc").textContent = facetTagDesc(el);
    if (!facetHintDismissed()) {
      var hint = document.createElement("div");
      hint.className = "dam-facet-tip__hint";
      hint.innerHTML =
        "Klik: tylko ten tag. CTRL+klik: dodaj do wyboru.<br>" +
        '<button type="button" class="dam-facet-tip__dismiss">Nie przypominaj więcej</button>';
      tip.appendChild(hint);
    }
    tip.classList.remove("is-on");
    tip.style.visibility = "hidden";
    tip.style.display = "block";
    var rect = el.getBoundingClientRect();
    var tipW = Math.min(tip.offsetWidth || 260, window.innerWidth - 24);
    var tipH = tip.offsetHeight || 60;
    var left = rect.left + rect.width / 2 - tipW / 2;
    if (left > window.innerWidth - tipW - 12) left = window.innerWidth - tipW - 12;
    if (left < 12) left = 12;
    var top = rect.bottom + 8;
    if (top + tipH + 12 > window.innerHeight) top = rect.top - tipH - 8;
    if (top < 8) top = 8;
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(top) + "px";
    tip.style.visibility = "visible";
    /* wymus reflow, zeby transition opacity odpalil fade-in */
    void tip.offsetWidth;
    tip.classList.add("is-on");
  }

  function hideFacetTip() {
    clearTimeout(facetTimer);
    clearTimeout(facetHideTimer);
    if (facetTipEl) {
      facetTipEl.classList.remove("is-on");
      facetTipEl.style.display = "none";
    }
  }

  function bindFacetTag(el) {
    if (el._damFacetTipBound) return;
    el._damFacetTipBound = true;
    el.addEventListener("mouseenter", function () {
      if (!isEnabled()) return;
      clearTimeout(facetTimer);
      clearTimeout(facetHideTimer);
      facetTimer = setTimeout(function () {
        showFacetTip(el);
      }, FACET_DELAY_MS);
    });
    el.addEventListener("mouseleave", function () {
      clearTimeout(facetTimer);
      /* zwloka, zeby dalo sie najechac na tooltip (przycisk dismiss) */
      facetHideTimer = setTimeout(hideFacetTip, 250);
    });
    el.addEventListener("click", hideFacetTip);
  }

  /* ---------- Standardowe tooltipy ---------- */

  function bindElement(el) {
    if (!el || el._damTipBound) return;
    if (isFacetTag(el)) {
      bindFacetTag(el);
      return;
    }
    var text = tipText(el);
    if (!text) return;
    el._damTipBound = true;

    /* Ukryj natywny title, zeby nie dublowac z naszym jasnym tipem */
    if (el.getAttribute("title") && !el.getAttribute("data-dam-tip")) {
      el.setAttribute("data-dam-tip", el.getAttribute("title"));
    }
    if (el.getAttribute("title")) {
      el.setAttribute("data-dam-native-title", el.getAttribute("title"));
      el.removeAttribute("title");
    }

    el.addEventListener("mouseenter", function () {
      if (!isEnabled()) return;
      if (el.closest && el.closest("[data-dam-tip-suppress]")) return;
      var t = tipText(el);
      if (!t) return;
      clearTimeout(showTimer);
      showTimer = setTimeout(function () {
        if (el.closest && el.closest("[data-dam-tip-suppress]")) return;
        showTip(el, t);
      }, DELAY_MS);
    });

    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("focus", function () {
      if (!isEnabled()) return;
      if (el.closest && el.closest("[data-dam-tip-suppress]")) return;
      var t = tipText(el);
      if (!t) return;
      showTip(el, t);
    });
    el.addEventListener("blur", hideTip);
    el.addEventListener("click", hideTip);
  }

  function shouldAutoTip(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled || el.getAttribute("aria-hidden") === "true") return false;
    /* Opt-out: warianty viz (wlasny popover na re-click) i jawny data-dam-no-tip. */
    if (el.hasAttribute("data-dam-no-tip")) return false;
    if (el.closest && el.closest("[data-dam-tip-suppress], [data-dam-no-tip]")) return false;
    if (el.classList && el.classList.contains("dam-viz-modal__variant")) return false;
    if (el.closest && el.closest(".dam-viz-modal__variant")) return false;
    /* Nie tipuj kontenerow (modal/dialog/nav/menu) - tylko interaktywne elementy.
       Inaczej aria-label na <nav> pokazuje stray tip np. "Konto" w menu profilu. */
    var role = el.getAttribute("role") || "";
    if (
      role === "dialog" ||
      role === "listbox" ||
      role === "group" ||
      role === "menu" ||
      role === "navigation" ||
      el.getAttribute("aria-modal") === "true"
    ) {
      return el.hasAttribute("data-dam-tip");
    }
    var tagSkip = el.tagName;
    if (tagSkip === "NAV" || tagSkip === "ASIDE" || tagSkip === "MAIN" || tagSkip === "SECTION") {
      return el.hasAttribute("data-dam-tip");
    }
    if (el.id === "damVizModal" || (el.classList && el.classList.contains("dam-viz-modal-overlay"))) {
      return false;
    }
    var tag = el.tagName;
    if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return true;
    if (role === "button") return true;
    if (el.classList && (
      el.classList.contains("dam-badge-tag") ||
      el.classList.contains("dam-viz-badge") ||
      el.classList.contains("dam-viz-icon-btn") ||
      el.classList.contains("dam-tag-pill") ||
      el.classList.contains("geex-btn") ||
      el.classList.contains("dam-admin-control")
    )) return true;
    return el.hasAttribute("data-dam-tip") || !!el.getAttribute("title") || !!el.getAttribute("aria-label");
  }

  function bindAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("[data-dam-tip], [title], [aria-label], button, a.geex-btn, .dam-badge-tag, .dam-viz-icon-btn, .dam-tag-pill").forEach(function (el) {
      if (shouldAutoTip(el)) bindElement(el);
    });
  }

  function init() {
    bindAll(document);

    if (window.MutationObserver) {
      var obs = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            if (shouldAutoTip(node)) bindElement(node);
            if (node.querySelectorAll) bindAll(node);
          });
        });
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.DamTooltips = {
    enable: function () { localStorage.setItem(STORAGE_KEY, "on"); },
    disable: function () { localStorage.setItem(STORAGE_KEY, "off"); },
    isEnabled: isEnabled,
    hide: hideTip,
    bind: bindAll
  };
})();
