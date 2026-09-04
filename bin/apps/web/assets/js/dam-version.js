/**

 * Wersja programu DAM (single source w UI).

 * Etykieta sidebar pod Wyloguj — nie floating pill na siatce.

 */

(function (global) {

  "use strict";



  global.DAM_APP_VERSION = "5.0.163";



  function formatVersion(v) {

    return String(v || "3.1.0").replace(/^v/i, "");

  }



  function hideFloatingPill() {

    var pill = document.getElementById("damAppVersionPill");

    if (!pill) return;

    pill.hidden = true;

    pill.style.setProperty("display", "none", "important");

  }



  function ensureSidebarVersionEl() {

    var existing = document.getElementById("damSidebarVersion");

    if (existing) return existing;



    var logout = document.getElementById("damShellLogout");

    var logoutLi = logout && logout.closest ? logout.closest("li.dam-nav-logout, .geex-sidebar__menu__item") : null;

    var menu = document.querySelector("#damSidebar .geex-sidebar__menu, .geex-sidebar .geex-sidebar__menu");

    if (!menu && !logoutLi) return null;



    var li = document.createElement("li");

    li.className = "geex-sidebar__menu__item dam-nav-version";

    li.setAttribute("aria-hidden", "true");



    var span = document.createElement("span");

    span.id = "damSidebarVersion";

    span.className = "dam-sidebar-version";

    span.title = "Wersja programu DAM";

    li.appendChild(span);



    if (logoutLi && logoutLi.parentNode) {

      logoutLi.parentNode.insertBefore(li, logoutLi.nextSibling);

    } else if (menu) {

      menu.appendChild(li);

    }

    return span;

  }



  function syncFooterVersion(ver) {

    /* Wersja tylko pod Wyloguj (#damSidebarVersion) — nie w stopce copyright. */

    document.querySelectorAll(".geex-sidebar__footer__author .dam-app-version").forEach(function (node) {

      node.textContent = "";

      node.hidden = true;

      node.style.setProperty("display", "none", "important");

    });

    var meta = document.querySelector(".dam-sidebar-collapsed-meta__ver");

    if (meta) meta.textContent = "v" + ver;

  }



  function setSidebarLabel(text) {

    hideFloatingPill();

    var raw = String(text || global.DAM_APP_VERSION || "");

    var ver = formatVersion(raw.replace(/^DAM\s+v/i, ""));

    var label = /^DAM\s+v/i.test(raw) ? raw : "DAM v" + ver;

    var el = ensureSidebarVersionEl();

    if (el) el.textContent = label;

    syncFooterVersion(ver);

  }



  function mount() {

    setSidebarLabel(global.DAM_APP_VERSION);

  }



  global.DamVersion = {

    mount: mount,

    setSidebarLabel: setSidebarLabel,

    format: formatVersion,

    hideFloatingPill: hideFloatingPill,

  };



  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", mount);

  } else {

    mount();

  }

})(typeof window !== "undefined" ? window : globalThis);

