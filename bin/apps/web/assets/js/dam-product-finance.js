/**
 * DAM — wspólne seed finance dla karty produktu, kalkulatora i faktur (TESTOWE).
 */
(function (global) {
  "use strict";

  var costsCache = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function t(key, fb) {
    if (global.DamI18n && typeof global.DamI18n.t === "function") {
      var v = global.DamI18n.t(key);
      if (v && v !== key) return v;
    }
    return fb;
  }

  function bridgeUrl() {
    if (global.DamRuntime && typeof global.DamRuntime.bridgeUrl === "function") {
      return global.DamRuntime.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function authHeaders() {
    if (global.DamApi && typeof global.DamApi.authHeaders === "function") {
      return global.DamApi.authHeaders();
    }
    return {
      Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
      Accept: "application/json",
    };
  }

  function isAdminMode() {
    if (global.DamShell && typeof global.DamShell.isAdminMode === "function") {
      return global.DamShell.isAdminMode();
    }
    var role = (localStorage.getItem("dam_role") || "").toLowerCase();
    return role === "admin" || role === "power_user";
  }

  function formatPLN(val) {
    var n = Number(val) || 0;
    return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " PLN";
  }

  function testBadgeHtml() {
    return (
      '<span class="dam-viz-badge dam-badge-tag dam-badge-tag--tier-low dam-seed-test-badge" title="' +
      esc(t("project.test_badge_tip", "Dane demonstracyjne (seed). Nie traktuj jako ERP.")) +
      '">' +
      esc(t("project.test_badge", "(TESTOWE)")) +
      "</span>"
    );
  }

  function isTestEntity(obj) {
    if (!obj) return false;
    if (obj.isTest === true || obj.source === "seed") return true;
    return false;
  }

  function invalidateCostsCache() {
    costsCache = null;
    try {
      delete global._DAM_PROJECT_COSTS;
    } catch (eInv) {
      global._DAM_PROJECT_COSTS = null;
    }
  }

  async function loadProjectCosts() {
    if (costsCache) return costsCache;
    if (global._DAM_PROJECT_COSTS && global._DAM_PROJECT_COSTS.projects) {
      costsCache = global._DAM_PROJECT_COSTS;
      return costsCache;
    }
    var bridge = bridgeUrl();
    try {
      var r = await fetch(bridge + "/finance/project-costs", {
        cache: "no-store",
        headers: authHeaders(),
      });
      if (r.ok) {
        var payload = await r.json();
        if (payload && payload.projects) {
          costsCache = payload;
          global._DAM_PROJECT_COSTS = payload;
          return costsCache;
        }
      }
    } catch (eBridge) {
      /* fallback local */
    }
    var r2 = await fetch(
      "data/project-costs.json?v=" + encodeURIComponent(String(global.DAM_APP_VERSION || "1")),
      { cache: "no-store" }
    );
    if (!r2.ok) throw new Error("project-costs");
    costsCache = await r2.json();
    global._DAM_PROJECT_COSTS = costsCache;
    return costsCache;
  }

  function findProjectByProductId(productId, data) {
    if (!data || !data.projects || !productId) return null;
    var id = String(productId);
    return (
      data.projects.find(function (p) {
        return p.linked_product_id === id || p.id === id;
      }) || null
    );
  }

  function recalcDirectTotals(project) {
    if (!project) return project;
    var direct = project.direct || [];
    var sum = direct.reduce(function (acc, row) {
      return acc + (Number(row && row.amount) || 0);
    }, 0);
    project.direct_total = Math.round(sum * 100) / 100;
    var labor = Number(project.labor_total) || 0;
    project.total = Math.round((labor + sum) * 100) / 100;
    project.total_with_invoices = project.total;
    return project;
  }

  async function saveProjectDirect(projectId, direct, addAdhoc) {
    if (!isAdminMode()) {
      return { ok: false, error: "admin_required" };
    }
    var body = { project_id: projectId, direct: direct || [] };
    if (addAdhoc && addAdhoc.label) {
      body.add_adhoc = addAdhoc;
    }
    var r = await fetch(bridgeUrl() + "/finance/project-costs", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify(body),
    });
    var j = await r.json().catch(function () {
      return { ok: false, error: "invalid_json" };
    });
    if (r.ok && j && j.ok && j.project) {
      invalidateCostsCache();
      if (costsCache && costsCache.projects) {
        var pid = String(projectId);
        costsCache.projects = costsCache.projects.map(function (p) {
          if (p.id === pid || p.linked_product_id === pid) return j.project;
          return p;
        });
        global._DAM_PROJECT_COSTS = costsCache;
      }
    }
    return j;
  }

  function financeLinks(productId, projectCostId) {
    var q = encodeURIComponent(projectCostId || productId || "");
    return {
      invoices: "invoices.html?project=" + q,
      calculator: "costs.html?project=" + q,
    };
  }

  function directRowMeta(row) {
    var parts = [];
    if (row.department) parts.push(row.department);
    if (row.qty != null && row.unit) {
      parts.push(String(row.qty).replace(".", ",") + " " + row.unit);
    }
    if (row.rate != null) parts.push(formatPLN(row.rate) + "/" + (row.unit || "j."));
    return parts.join(" · ");
  }

  /** Kolejność etapów cyklu życia produktu (katalog). */
  var LIFECYCLE_STAGE_IDS = [
    "projektowanie",
    "druk",
    "konfekcja",
    "emitowanie",
    "w_sklepach",
    "wycofywane",
  ];

  var LIFECYCLE_STAGE_LABELS = {
    projektowanie: "Projektowanie",
    druk: "Druk",
    konfekcja: "Konfekcja (u nas)",
    emitowanie: "Emitowanie do sklepów",
    w_sklepach: "W sklepach",
    wycofywane: "Wycofywane / zastępowane",
  };

  function lifecycleStageIndex(stageId) {
    var id = String(stageId || "").toLowerCase();
    var i = LIFECYCLE_STAGE_IDS.indexOf(id);
    return i >= 0 ? i : -1;
  }

  function isShopLiveStage(stageId) {
    return String(stageId || "").toLowerCase() === "w_sklepach";
  }

  function lifecycleStageLabel(stageId, stagesFromJson) {
    var id = String(stageId || "").toLowerCase();
    if (stagesFromJson && stagesFromJson.length) {
      var hit = stagesFromJson.find(function (s) {
        return String(s.id).toLowerCase() === id;
      });
      if (hit && hit.label_pl) return hit.label_pl;
    }
    return LIFECYCLE_STAGE_LABELS[id] || id || "—";
  }

  /**
   * Układ sztuk w kartonie — preferuj kwadratowe warstwy (12×2, 6×4, 8×3…).
   * override: { cols, rows, layers, caption_pl } z product-catalog.
   */
  function computeCasePackLayout(units, override) {
    var n = Math.max(0, Math.floor(Number(units) || 0));
    if (override && override.cols > 0 && override.rows > 0) {
      return {
        cols: override.cols,
        rows: override.rows,
        layers: override.layers || 1,
        caption_pl:
          override.caption_pl ||
          "Układ w kartonie: " + override.cols + " × " + override.rows + " szt.",
        source: override.source || "catalog_override",
      };
    }
    if (n <= 0) {
      return { cols: 0, rows: 0, layers: 0, caption_pl: "", source: "empty" };
    }
    var best = null;
    var bestScore = Infinity;
    for (var cols = 1; cols <= n; cols++) {
      if (n % cols !== 0) continue;
      var rows = n / cols;
      var score = Math.abs(cols - rows) + (cols > 24 ? 50 : 0) + (rows === 1 && cols > 6 ? 20 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = { cols: cols, rows: rows, layers: 1 };
      }
    }
    if (!best) best = { cols: n, rows: 1, layers: 1 };
    return {
      cols: best.cols,
      rows: best.rows,
      layers: best.layers,
      caption_pl: "Układ w kartonie: " + best.cols + " × " + best.rows + " szt.",
      source: "computed",
    };
  }

  function casePackGridHtml(layout) {
    if (!layout || !layout.cols || !layout.rows) return "";
    var cols = layout.cols;
    var rows = layout.rows;
    var total = cols * rows;
    var cells = [];
    for (var i = 0; i < total; i++) {
      cells.push('<span class="dam-catalog-pack-cell" aria-hidden="true"></span>');
    }
    return (
      '<div class="dam-catalog-pack-viz" role="img" aria-label="' +
      esc(layout.caption_pl || "") +
      '">' +
      '<div class="dam-catalog-pack-grid dam-catalog-pack-grid--' +
      cols +
      "x" +
      rows +
      '" style="--dam-pack-cols:' +
      cols +
      ";--dam-pack-rows:" +
      rows +
      '">' +
      cells.join("") +
      "</div>" +
      '<p class="dam-catalog-pack-caption">' +
      esc(layout.caption_pl || "") +
      "</p></div>"
    );
  }

  function lifecycleStepperHtml(currentStageId, stagesFromJson) {
    var curIdx = lifecycleStageIndex(currentStageId);
    var stages =
      stagesFromJson && stagesFromJson.length
        ? stagesFromJson.slice().sort(function (a, b) {
            return (a.order || 0) - (b.order || 0);
          })
        : LIFECYCLE_STAGE_IDS.map(function (id, idx) {
            return { id: id, label_pl: LIFECYCLE_STAGE_LABELS[id], order: idx + 1 };
          });
    var chips = stages
      .map(function (st, idx) {
        var cls = "dam-catalog-lifecycle__step";
        if (idx < curIdx) cls += " is-done";
        else if (idx === curIdx) cls += " is-current";
        return (
          '<li class="' +
          cls +
          '"><span class="dam-catalog-lifecycle__dot" aria-hidden="true"></span><span class="dam-catalog-lifecycle__label">' +
          esc(st.label_pl || lifecycleStageLabel(st.id, stagesFromJson)) +
          "</span></li>"
        );
      })
      .join("");
    return (
      '<nav class="dam-catalog-lifecycle" aria-label="' +
      esc(t("project.lifecycle_nav", "Etap produktu")) +
      '"><ol class="dam-catalog-lifecycle__list">' +
      chips +
      "</ol></nav>"
    );
  }

  /** TESTOWE — porównanie sprzedaży (nie ERP). */
  var COMPARE_SALES_SEED = {
    "figa-z-makiem-owocowe": { sales_pln: 128400, label: "Figa Z Makiem" },
    "cynamonka-nerkowcowy": { sales_pln: 96200, label: "Mini batoniki a'la cynamonka" },
    "dk-mini-batoniki-a-la-cynamonka-102-g-c-28-2026": { sales_pln: 96200, label: "Cynamonka 102 g" },
  };

  function compareSalesSeed(projectOrProductId) {
    var id = String(projectOrProductId || "");
    return COMPARE_SALES_SEED[id] || null;
  }

  global.DamProductFinance = {
    loadProjectCosts: loadProjectCosts,
    findProjectByProductId: findProjectByProductId,
    financeLinks: financeLinks,
    formatPLN: formatPLN,
    testBadgeHtml: testBadgeHtml,
    isTestEntity: isTestEntity,
    directRowMeta: directRowMeta,
    esc: esc,
    isAdminMode: isAdminMode,
    recalcDirectTotals: recalcDirectTotals,
    saveProjectDirect: saveProjectDirect,
    compareSalesSeed: compareSalesSeed,
    invalidateCostsCache: invalidateCostsCache,
    LIFECYCLE_STAGE_IDS: LIFECYCLE_STAGE_IDS,
    lifecycleStageIndex: lifecycleStageIndex,
    lifecycleStageLabel: lifecycleStageLabel,
    isShopLiveStage: isShopLiveStage,
    computeCasePackLayout: computeCasePackLayout,
    casePackGridHtml: casePackGridHtml,
    lifecycleStepperHtml: lifecycleStepperHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);

