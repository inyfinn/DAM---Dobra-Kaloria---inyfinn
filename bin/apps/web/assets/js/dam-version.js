/**
 * Wersja programu DAM (single source w UI).
 * Etykieta sidebar na dole stopki — lewa kolumna, jeden string.
 */
(function (global) {
  "use strict";

  global.DAM_APP_VERSION = "5.0.197";

  function formatVersion(v) {
    return String(v || "3.1.0").replace(/^v/i, "");
  }

  function hideFloatingPill() {
    var pill = document.getElementById("damAppVersionPill");
    if (!pill) return;
    pill.hidden = true;
    pill.style.setProperty("display", "none", "important");
  }

  function removeLegacyMenuVersion() {
    document.querySelectorAll(".geex-sidebar__menu__item.dam-nav-version").forEach(function (node) {
      node.parentNode && node.parentNode.removeChild(node);
    });
  }

  function ensureSidebarVersionEl() {
    removeLegacyMenuVersion();

    var existing = document.getElementById("damSidebarVersion");
    if (existing) {
      var footer = existing.closest(".geex-sidebar__footer");
      if (footer) return existing;
      existing.parentNode && existing.parentNode.removeChild(existing);
    }

    var footerEl =
      document.querySelector(".geex-sidebar .geex-sidebar__footer") ||
      document.querySelector(".geex-sidebar__footer");
    if (!footerEl) return null;

    var span = document.createElement("span");
    span.id = "damSidebarVersion";
    span.className = "dam-sidebar-version";
    span.title = "Wersja programu DAM";
    footerEl.appendChild(span);
    return span;
  }

  function syncFooterVersion(ver) {
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
