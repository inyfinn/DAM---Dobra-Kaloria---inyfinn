/**
 * DAM ETA - FMCG landed-cost estimates (averages until real data).
 * API: window.DamFmcg.computeMonthLanded(ctx) / formatPLN / getSwot
 */
(function (global) {
  "use strict";

  var averagesCache = null;

  function formatPLN(val) {
    var n = Number(val) || 0;
    return Math.round(n).toLocaleString("pl-PL") + " PLN";
  }

  function loadAverages() {
    if (averagesCache) return Promise.resolve(averagesCache);
    return fetch("data/fmcg-cost-averages.json?v=20260718dash1")
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        averagesCache = data || { estimate: true, per_open_variant: {}, swot: {} };
        return averagesCache;
      })
      .catch(function () {
        averagesCache = { estimate: true, per_open_variant: {}, swot: {} };
        return averagesCache;
      });
  }

  function countOpenVariants(ctx) {
    var viz = (ctx && ctx.vizLatest) || [];
    var openProjects = ((ctx && ctx.projectCosts && ctx.projectCosts.projects) || []).filter(
      function (p) {
        return (p.open_tasks || 0) > 0;
      }
    );
    var openCount = openProjects.length;
    if (!openCount) openCount = Math.min(6, Math.max(1, Math.round(viz.length / 40)));
    var carriers = {};
    viz.forEach(function (v) {
      var c = (v.carrier || v.carrier_label || "OTHER").toString().toUpperCase();
      carriers[c] = (carriers[c] || 0) + 1;
    });
    var carrierKinds = Object.keys(carriers).length || 1;
    return {
      openProjects: openCount,
      variantUnits: Math.max(openCount, Math.min(24, carrierKinds)),
      carrierKinds: carrierKinds
    };
  }

  function laborOpenSum(projectCosts) {
    if (!projectCosts) return 0;
    if (typeof projectCosts.sum_open_projects === "number") {
      return projectCosts.sum_open_projects;
    }
    return (projectCosts.projects || []).reduce(function (acc, p) {
      return acc + ((p.open_tasks || 0) > 0 ? p.total || 0 : 0);
    }, 0);
  }

  function designHourlyFromRates(costRates) {
    if (!costRates) return 53.57;
    var person = (costRates.people && costRates.people["Krzysztof Wieczorek"]) ||
      costRates.default_person ||
      {};
    var net = Number(person.net) || 6000;
    var mult = Number(person.employer_mult) || 1.5;
    var hours = Number(costRates.avg_monthly_hours) || 168;
    return (net * mult) / hours;
  }

  /**
   * @param {object} ctx
   * @param {object} [ctx.projectCosts]
   * @param {object} [ctx.costRates]
   * @param {object} [ctx.fmcg]
   * @param {array}  [ctx.vizLatest]
   */
  function computeMonthLanded(ctx) {
    ctx = ctx || {};
    var avg = ctx.fmcg || averagesCache || {};
    var per = avg.per_open_variant || {};
    var counts = countOpenVariants(ctx);
    var units = counts.variantUnits;
    var labor = laborOpenSum(ctx.projectCosts);
    var hourly = designHourlyFromRates(ctx.costRates);
    var designHours = Number(avg.design_hours_per_open_variant) || 4;
    var designExtra = units * designHours * hourly;

    function line(key) {
      var row = per[key] || {};
      var amount = Number(row.amount) || 0;
      return {
        key: key,
        label: row.label || key,
        unit: amount,
        total: amount * units,
        note: row.note || ""
      };
    }

    var lines = [
      {
        key: "labor_asana",
        label: "Praca (Asana / cost-rates)",
        unit: labor,
        total: labor,
        note: "Suma otwartych projektow z project-costs.json"
      },
      {
        key: "design_extra",
        label: "Czas designera (uśrednienie FMCG)",
        unit: designHours * hourly,
        total: designExtra,
        note: designHours + " h / wariant x stawka godz."
      },
      line("raw_material_per_1000"),
      line("production_labor"),
      line("warehouse_packing"),
      line("proofing"),
      line("print_flexo_offset")
    ];

    var subtotal = lines.reduce(function (a, l) {
      return a + (l.total || 0);
    }, 0);
    var riskPct = Number(avg.risk_uplift_pct) || 0;
    var risk = subtotal * (riskPct / 100);
    var landed = subtotal + risk;

    var printLine = lines.find(function (l) {
      return l.key === "print_flexo_offset";
    });
    var printTotal = (printLine && printLine.total) || 0;
    var laborTotal = labor + designExtra;

    return {
      estimate: true,
      currency: avg.currency || "PLN",
      openProjects: counts.openProjects,
      variantUnits: units,
      lines: lines,
      subtotal: subtotal,
      risk_pct: riskPct,
      risk: risk,
      landed_month: landed,
      labor_total: laborTotal,
      print_total: printTotal,
      chip: "Szacunek branżowy - podmienimy na dane realne",
      source_note: avg.source_note || ""
    };
  }

  function getSwot(fmcg) {
    var s = (fmcg || averagesCache || {}).swot || {};
    return {
      strengths: s.strengths || [],
      weaknesses: s.weaknesses || [],
      opportunities: s.opportunities || [],
      threats: s.threats || []
    };
  }

  function getSalesMock(fmcg) {
    return (fmcg || averagesCache || {}).sales_mock || {
      estimate: true,
      monthly_revenue_pln: 0,
      monthly_units: 0,
      trend_pct: 0,
      top_skus: [],
      note: "Brak danych"
    };
  }

  global.DamFmcg = {
    loadAverages: loadAverages,
    computeMonthLanded: computeMonthLanded,
    getSwot: getSwot,
    getSalesMock: getSalesMock,
    formatPLN: formatPLN
  };
})(typeof window !== "undefined" ? window : globalThis);
