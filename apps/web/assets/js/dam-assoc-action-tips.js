/**
 * DAM - tipy dla #damAssocActionMenu (.dam-assoc-action-menu__item)
 * Binder osobny od dam-assoc-edit.js (wspolbieznosc agentow).
 * Dopina data-dam-tip i odswieza DamTooltips.bind.
 */
(function () {
  "use strict";

  var ATTR = "data-dam-tip";
  var MARK = "data-dam-assoc-tip-bound";

  function itemLabel(el) {
    var span = el.querySelector("span");
    var raw = ((span && span.textContent) || el.textContent || "").replace(/\s+/g, " ").trim();
    return raw.toLowerCase();
  }

  function tipForItem(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.getAttribute(ATTR)) return el.getAttribute(ATTR);

    var action = (el.getAttribute("data-action") || "").toLowerCase();
    var href = (el.getAttribute("href") || "").toLowerCase();
    var label = itemLabel(el);

    if (action === "explorer" || label === "eksplorator") {
      if (el.disabled || el.getAttribute("disabled") !== null || !el.getAttribute("data-path")) {
        return "Brak sciezki folderu na dysku";
      }
      return "Otworz folder w Windows Explorerze";
    }
    if (action === "copy-link" || label.indexOf("kopiuj link") !== -1) {
      return "Skopiuj link do produktu";
    }
    if (href.indexOf("explorer.html") !== -1 || label === "przejdz" || label === "przejdź") {
      return "Przejdz do produktu w Eksploratorze";
    }
    if (href.indexOf("visualizations.html") !== -1 || label.indexOf("wizualizacj") !== -1) {
      return "Otworz produkt w Wizualizacjach";
    }

    if (label) {
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    return "";
  }

  function rebindTips(root) {
    if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
      window.DamTooltips.bind(root || document);
    }
  }

  function tipMenu(menu) {
    if (!menu || menu.nodeType !== 1) return;
    var items = menu.querySelectorAll(".dam-assoc-action-menu__item");
    var changed = false;
    items.forEach(function (el) {
      if (el.getAttribute(MARK) === "1" && el.getAttribute(ATTR)) return;
      var tip = tipForItem(el);
      if (!tip) return;
      if (el.getAttribute(ATTR) !== tip) {
        el.setAttribute(ATTR, tip);
        changed = true;
      }
      el.setAttribute(MARK, "1");
    });
    if (changed || items.length) rebindTips(menu);
  }

  function tipAllInDocument() {
    var menu = document.getElementById("damAssocActionMenu");
    if (menu) tipMenu(menu);
    document.querySelectorAll(".dam-assoc-action-menu").forEach(tipMenu);
  }

  function onMutations(mutations) {
    var needScan = false;
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type !== "childList") continue;
      for (var j = 0; j < m.addedNodes.length; j++) {
        var node = m.addedNodes[j];
        if (node.nodeType !== 1) continue;
        if (node.id === "damAssocActionMenu" || (node.classList && node.classList.contains("dam-assoc-action-menu"))) {
          tipMenu(node);
          continue;
        }
        if (node.querySelector && (node.id === "damAssocActionMenu" || node.querySelector("#damAssocActionMenu, .dam-assoc-action-menu"))) {
          needScan = true;
        }
        if (node.classList && node.classList.contains("dam-assoc-action-menu__item")) {
          needScan = true;
        }
      }
    }
    if (needScan) tipAllInDocument();
  }

  function init() {
    tipAllInDocument();
    if (!window.MutationObserver || !document.body) return;
    var obs = new MutationObserver(onMutations);
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.DamAssocActionTips = {
    tipMenu: tipMenu,
    refresh: tipAllInDocument
  };
})();
