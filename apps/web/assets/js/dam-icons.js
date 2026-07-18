/**
 * Shared DAM icon glyphs (Windows Explorer folder + Asana mark).
 * Windows SVG rebuilt from user-provided outline reference.
 */
(function (global) {
  "use strict";

  function winExplorerSvg(extraClass) {
    var cls = "dam-icon-svg dam-icon-win-explorer" + (extraClass ? " " + extraClass : "");
    return (
      '<svg class="' +
      cls +
      '" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
      '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ' +
      'd="M3.25 8.25V17.5c0 .97.78 1.75 1.75 1.75h14c.97 0 1.75-.78 1.75-1.75V9.5c0-.97-.78-1.75-1.75-1.75h-7.1L10.2 6.4A1.1 1.1 0 0 0 9.4 6.1H5c-.97 0-1.75.78-1.75 2.15z"/>' +
      '<rect x="8.15" y="12.1" width="7.7" height="5.2" rx="0.85" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
      '<path fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" d="M9.7 15.85h4.6"/>' +
      "</svg>"
    );
  }

  /** Official-style Asana mark: three circles in a triangle. */
  function asanaSvg(extraClass) {
    var cls = "dam-icon-svg dam-icon-asana" + (extraClass ? " " + extraClass : "");
    return (
      '<svg class="' +
      cls +
      '" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="6.2" r="3.1" fill="currentColor"/>' +
      '<circle cx="6.6" cy="16.3" r="3.1" fill="currentColor"/>' +
      '<circle cx="17.4" cy="16.3" r="3.1" fill="currentColor"/>' +
      "</svg>"
    );
  }

  function winButtonHtml(path, opts) {
    opts = opts || {};
    var tip = opts.tip || "Folder Windows";
    var label = opts.ariaLabel || "Folder Windows";
    var extra = opts.className || "geex-btn dam-btn-icon dam-btn-icon-only dam-win-btn";
    return (
      '<button type="button" class="' +
      extra +
      '" data-path="' +
      String(path || "").replace(/"/g, "&quot;") +
      '" aria-label="' +
      label +
      '" title="' +
      tip +
      '" data-dam-tip="' +
      tip +
      '">' +
      winExplorerSvg() +
      "</button>"
    );
  }

  function bindWinButtons(root) {
    if (!root) return;
    root.querySelectorAll(".dam-win-btn, .dam-project-win-btn, .dam-slot-win").forEach(function (btn) {
      if (btn._damWinBound) return;
      btn._damWinBound = true;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var path = this.getAttribute("data-path") || "";
        if (!path) return;
        if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
          window.DamPaths.openFolderInExplorer(path);
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.revealInExplorer === "function") {
          window.DamPaths.revealInExplorer(path);
        }
      });
    });
  }

  /** Toggle Przejdz + Folder Windows on OK checklist rows (cards + detail). */
  function bindChecklistRows(root) {
    if (!root) return;
    root.querySelectorAll(".dam-check-row--interactive, .dam-slot-row--interactive").forEach(function (row) {
      if (row._damCheckBound) return;
      row._damCheckBound = true;
      row.addEventListener("click", function (e) {
        if (e.target.closest(".dam-check-row__actions, .dam-slot-row__actions")) return;
        var act =
          row.querySelector(".dam-check-row__actions") ||
          row.querySelector(".dam-slot-row__actions");
        if (!act) return;
        var willOpen = act.hasAttribute("hidden");
        root.querySelectorAll(".dam-check-row__actions, .dam-slot-row__actions").forEach(function (a) {
          a.setAttribute("hidden", "");
        });
        root
          .querySelectorAll(".dam-check-row--open, .dam-slot-row--open")
          .forEach(function (r) {
            r.classList.remove("dam-check-row--open", "dam-slot-row--open");
          });
        if (willOpen) {
          act.removeAttribute("hidden");
          row.classList.add(
            row.classList.contains("dam-slot-row") ? "dam-slot-row--open" : "dam-check-row--open"
          );
        }
      });
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          row.click();
        }
      });
    });
    bindWinButtons(root);
  }

  global.DamIcons = {
    winExplorerSvg: winExplorerSvg,
    asanaSvg: asanaSvg,
    winButtonHtml: winButtonHtml,
    bindWinButtons: bindWinButtons,
    bindChecklistRows: bindChecklistRows,
  };
})(typeof window !== "undefined" ? window : this);
