/**
 * DAM - edytor / podsumowanie katalogu FMCG (Integracje + Kalkulator).
 * Zależność: dam-fmcg-cost.js (opcjonalnie) + bridge /finance/fmcg-*.
 */
(function (global) {
  "use strict";

  var STAGE_LABELS = {
    procurement: "Zamówienie i zakup",
    prepress: "Przygotowanie",
    production: "Produkcja",
    warehouse: "Magazyn",
    logistics: "Dostawa",
  };

  function summarize(catalog) {
    catalog = catalog || {};
    var items = catalog.items || [];
    var filled = 0;
    var byStage = {};
    Object.keys(STAGE_LABELS).forEach(function (s) {
      byStage[s] = { total: 0, filled: 0, amount: 0 };
    });
    items.forEach(function (it) {
      if (!it) return;
      var st = String(it.stage || "");
      if (!byStage[st]) byStage[st] = { total: 0, filled: 0, amount: 0 };
      byStage[st].total += 1;
      if (it.amount != null && it.amount !== "") {
        filled += 1;
        byStage[st].filled += 1;
        byStage[st].amount += Number(it.amount) || 0;
      }
    });
    return {
      item_count: items.length,
      filled_count: filled,
      missing_count: items.length - filled,
      by_stage: byStage,
      currency: catalog.currency || "PLN",
      imported_at: catalog.imported_at || null,
      version: catalog.version,
    };
  }

  function renderStageAccordion(catalog, mountEl) {
    if (!mountEl) return;
    var s = summarize(catalog);
    var html = Object.keys(STAGE_LABELS)
      .map(function (key) {
        var row = s.by_stage[key] || { total: 0, filled: 0, amount: 0 };
        var items = (catalog.items || []).filter(function (it) {
          return it && it.stage === key;
        });
        var rows = items
          .map(function (it) {
            var amt =
              it.amount == null || it.amount === ""
                ? '<span class="dam-fmcg-missing">brak danych</span>'
                : String(it.amount) + " " + (it.currency || "PLN");
            return (
              "<li><strong>" +
              String(it.label_pl || it.id) +
              "</strong> · " +
              amt +
              ' <span class="dam-fmcg-chip">' +
              String(it.source || "placeholder") +
              "</span></li>"
            );
          })
          .join("");
        return (
          '<details class="dam-fmcg-stage">' +
          "<summary>" +
          STAGE_LABELS[key] +
          " (" +
          row.filled +
          "/" +
          row.total +
          ")</summary>" +
          "<ul>" +
          (rows || "<li>—</li>") +
          "</ul></details>"
        );
      })
      .join("");
    mountEl.innerHTML =
      '<p class="dam-fmcg-summary">' +
      s.filled_count +
      " z " +
      s.item_count +
      " pozycji ma kwotę</p>" +
      html;
  }

  global.DamFmcgCatalog = {
    STAGE_LABELS: STAGE_LABELS,
    summarize: summarize,
    renderStageAccordion: renderStageAccordion,
  };
})(typeof window !== "undefined" ? window : globalThis);
