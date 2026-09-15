/**
 * DAM - Global CTA / chip / filter anatomy (Integracje language).
 * Injects #damGlobalCtaUnify so Faktury / Projekty do not need dam-integrations.css.
 */
(function (global) {
  "use strict";

  var STYLE_ID = "damGlobalCtaUnify";

  function cssText() {
    return (
      "/* dam-ui-cta: shared .dam-int-cta / chip / filter (12px / 34px compact) */" +
      ".dam-int-cta," +
      "button.dam-int-cta," +
      "a.dam-int-cta," +
      "label.dam-int-cta{" +
      "display:inline-flex;align-items:center;justify-content:center;gap:6px;" +
      "min-height:34px;height:auto;padding:8px 12px;margin:0;box-sizing:border-box;" +
      "font-family:inherit;font-size:12px!important;font-weight:500;line-height:1.2;" +
      "border-radius:8px;border:1px solid #e7e7e7;background:#fff;color:#464255;" +
      "text-decoration:none;cursor:pointer;box-shadow:none;" +
      "-webkit-appearance:none;appearance:none;" +
      "transition:background .15s ease,border-color .15s ease,color .15s ease}" +
      ".dam-int-cta:hover," +
      "button.dam-int-cta:hover," +
      "a.dam-int-cta:hover," +
      "label.dam-int-cta:hover{" +
      "border-color:var(--dam-primary,#005A29);background:color-mix(in srgb, var(--dam-primary, #005A29) 8%, var(--dam-surface));" +
      "color:var(--dam-primary,#005A29)}" +
      ".dam-int-cta:focus-visible," +
      "button.dam-int-cta:focus-visible," +
      "a.dam-int-cta:focus-visible," +
      "label.dam-int-cta:focus-visible{" +
      "outline:2px solid color-mix(in srgb,var(--dam-primary,#005A29) 55%,transparent);" +
      "outline-offset:2px}" +
      ".dam-int-cta:disabled," +
      ".dam-int-cta[aria-disabled='true']{opacity:.5;cursor:not-allowed}" +
      ".dam-int-cta--icon{" +
      "min-width:34px;width:34px;padding:0;flex:0 0 34px}" +
      ".dam-int-chip{" +
      "display:inline-flex;align-items:center;justify-content:center;" +
      "flex:0 0 auto;width:auto;max-width:none;align-self:flex-start;" +
      "padding:3px 9px;border-radius:999px;font-size:10px;font-weight:700;" +
      "letter-spacing:.01em;line-height:1.3;white-space:nowrap;" +
      "border:1px solid transparent;box-sizing:border-box}" +
      ".dam-int-chip.dam-int-st--ok{" +
      "color:#0a7a4f;" +
      "background:color-mix(in srgb,var(--dam-ok,#00b074) 16%,#fff);" +
      "border-color:color-mix(in srgb,var(--dam-ok,#00b074) 28%,transparent)}" +
      ".dam-int-chip.dam-int-st--ready{" +
      "color:var(--dam-primary,#005A29);" +
      "background:color-mix(in srgb,var(--dam-primary,#005A29) 12%,#fff);" +
      "border-color:color-mix(in srgb,var(--dam-primary,#005A29) 24%,transparent)}" +
      ".dam-int-chip.dam-int-st--wait{" +
      "color:#6a6570;" +
      "background:color-mix(in srgb,var(--dam-text-muted,#8b8d97) 14%,#fff);" +
      "border-color:color-mix(in srgb,var(--dam-text-muted,#8b8d97) 28%,transparent)}" +
      ".dam-int-chip.dam-int-st--warn{" +
      "color:#9a6a14;" +
      "background:color-mix(in srgb,#fdb23a 18%,#fff);" +
      "border-color:color-mix(in srgb,#fdb23a 32%,transparent)}" +
      ".dam-int-chip.dam-int-st--danger," +
      ".dam-int-chip.dam-int-st--err{" +
      "color:var(--dam-danger,#ff5b5b);" +
      "background:color-mix(in srgb,var(--dam-danger,#ff5b5b) 12%,#fff);" +
      "border-color:color-mix(in srgb,var(--dam-danger,#ff5b5b) 28%,transparent)}" +
      /* Filter pills = branding-tab language, compact 34px */ +
      ".dam-int-filter{" +
      "display:inline-flex;align-items:center;justify-content:center;" +
      "min-height:34px;padding:6px 14px;margin:0;box-sizing:border-box;" +
      "border:1px solid var(--dam-border,#ececf2);border-radius:999px;" +
      "background:var(--dam-surface-muted,#f5f6fa);" +
      "color:var(--dam-text-muted,#8f8b9f);" +
      "font-family:inherit;font-size:12px;font-weight:500;line-height:1.2;" +
      "cursor:pointer;" +
      "transition:background .15s ease,color .15s ease,border-color .15s ease}" +
      ".dam-int-filter:hover{" +
      "border-color:color-mix(in srgb,var(--dam-primary,#005A29) 35%,var(--dam-border,#ececf2));" +
      "color:var(--dam-text,#464255)}" +
      /* Outline selected (not solid purple fill) - Faktury / shared chips */ +
      ".dam-int-filter.active," +
      ".dam-int-filter.is-active{" +
      "background:color-mix(in srgb,var(--dam-primary,#005A29) 8%,#fff);" +
      "border-color:var(--dam-primary,#005A29);" +
      "color:color-mix(in srgb,var(--dam-primary,#005A29) 82%,#464255);" +
      "font-weight:600}" +
      ".dam-int-filter:focus-visible{" +
      "outline:2px solid var(--dam-primary,#005A29);outline-offset:2px}" +
      /* Page mounts */ +
      ".dam-inv-toolbar .dam-int-cta," +
      ".dam-inv-toolbar label.dam-int-cta," +
      ".dam-projects-grid-toolbar__actions .dam-int-cta," +
      ".dam-projects-grid-toolbar__actions label.dam-int-cta," +
      ".dam-projects-grid-toolbar__actions button.dam-int-cta{" +
      "width:fit-content;min-height:34px;font-size:12px!important;white-space:nowrap}" +
      /* Card text CTAs = same compact token as toolbar (12px / 34px); beat .dam-btn-icon pads */ +
      ".dam-project-card__actions .dam-int-cta," +
      ".dam-project-card__actions a.dam-int-cta," +
      ".dam-project-card__actions button.dam-int-cta," +
      ".dam-project-card__actions .dam-int-cta.dam-btn-icon:not(.dam-btn-icon-only)," +
      ".dam-project-card__actions a.dam-int-cta.dam-btn-icon:not(.dam-btn-icon-only){" +
      "min-width:0;flex:1 1 auto;width:auto;height:auto;" +
      "min-height:34px!important;max-height:none;" +
      "padding:8px 12px!important;box-sizing:border-box;" +
      "font-size:12px!important;font-weight:500;line-height:1.2;" +
      "border-radius:8px;white-space:nowrap;overflow:visible}" +
      ".dam-project-card__actions .dam-int-cta:not(.dam-int-cta--icon){" +
      "width:auto!important}" +
      ".dam-project-card__actions .dam-int-cta--icon," +
      ".dam-project-card__actions .dam-btn-icon-only{" +
      "flex:0 0 34px;width:34px;min-width:34px;min-height:34px!important;" +
      "padding:0!important}" +
      ".dam-project-card__actions .dam-int-cta > i," +
      ".dam-project-card__actions .dam-int-cta > .dam-icon-svg{" +
      "font-size:14px;width:14px;height:14px;flex:0 0 14px}" +
      ".dam-project-card__top .dam-int-chip{align-self:center}" +
      /* Projects toolbar Info Pakowania = viz dam-switch--compact row align */ +
      ".dam-projects-grid-toolbar__actions .dam-switch.dam-switch--compact{" +
      "margin:0;align-self:center}"
    );
  }

  function ensureStyles() {
    if (typeof document === "undefined") return;
    var existing = document.getElementById(STYLE_ID);
    if (existing) {
      existing.textContent = cssText();
      return;
    }
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = cssText();
    (document.head || document.documentElement).appendChild(el);
  }

  ensureStyles();

  global.DamUiCta = {
    ensureStyles: ensureStyles,
    styleId: STYLE_ID,
  };
})(window);
