/**
 * P1 post-bramka: viz modal open → suggestions CTA bez toastu "Brak kontekstu materiałów".
 *
 * Mierzy dokładnie draft v3:
 * - Po sync seed _damMaterialsCtx (mock first) openVizMaterialsEdit315 NIE woła ctx-toastu.
 * - Integracja: symuluje dam-viz.js open (bindVizAssocCtas); seed tylko gdy P1 jest w źródle dam-viz.js.
 *
 * Pre-fix (brak seed w dam-viz.js): integration FAIL — dowód że test łapie problem.
 * Post-fix P1: integration PASS.
 *
 * Run: node scripts/qa/sim-assoc-viz-sync-ctx.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");
const ASSOC_JS = path.join(ROOT, "apps/web/assets/js/dam-assoc-edit.js");
const VIZ_JS = path.join(ROOT, "apps/web/assets/js/dam-viz.js");
const CTX_TOAST = "Brak kontekstu materiałów";

/** Mock `first` jak buildModalItems(group) w dam-viz.js */
function mockFirst() {
  return {
    product_id: "prod-seed-6300654",
    product_name: "Proteina test harness",
    index_base: "6300654",
    revision_path: "X:/Products/6300654/rev",
  };
}

/** Minimalny _damMaterialsCtx — draft v3 rev.3 */
function buildMinimalMaterialsCtx(first) {
  first = first || mockFirst();
  const productId = String(first.product_id || "").trim();
  return {
    productContext: {
      id: productId,
      name: first.product_name || "",
      index: first.index_base || "",
      revision_path: first.revision_path || "",
    },
    groupContext: {
      product_id: productId,
    },
    materialsList: [],
    selectedIds: [],
    materialCandidates: [],
    shownPrimaries: [],
    onRefresh: function () {},
  };
}

function makeEl(tag, doc) {
  const el = {
    tagName: String(tag || "DIV").toUpperCase(),
    id: "",
    className: "",
    style: {},
    attributes: Object.create(null),
    children: [],
    parentNode: null,
    textContent: "",
    _rawHtml: "",
    _listeners: Object.create(null),
    ownerDocument: doc,
    classList: {
      _owner: null,
      add(c) {
        const o = this._owner;
        o.className = ((" " + (o.className || "") + " ").replace(" " + c + " ", " ") + " " + c).trim();
      },
      remove(c) {
        const o = this._owner;
        o.className = (" " + (o.className || "") + " ").split(" " + c + " ").join(" ").trim();
      },
      toggle() {},
      contains(c) {
        return (" " + (this._owner.className || "") + " ").indexOf(" " + c + " ") !== -1;
      },
    },
    setAttribute(k, v) {
      this.attributes[k] = String(v);
      if (k === "id") this.id = String(v);
      if (k === "class") this.className = String(v);
    },
    getAttribute(k) {
      if (k === "id") return this.id || null;
      if (k === "class") return this.className || null;
      return this.attributes[k] != null ? this.attributes[k] : null;
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    },
    addEventListener(type, fn) {
      (this._listeners[type] || (this._listeners[type] = [])).push(fn);
    },
    removeEventListener() {},
    querySelector(sel) {
      return queryOne(this, sel);
    },
    querySelectorAll(sel) {
      return queryAll(this, sel);
    },
    closest(sel) {
      let n = this;
      while (n) {
        if (matches(n, sel)) return n;
        n = n.parentNode;
      }
      return null;
    },
    contains(other) {
      let n = other;
      while (n) {
        if (n === this) return true;
        n = n.parentNode;
      }
      return false;
    },
    focus() {},
    blur() {},
    click() {},
    dispatchEvent(ev) {
      const type = ev && ev.type;
      const list = this._listeners[type] || [];
      list.forEach(function (fn) {
        fn(ev);
      });
      return true;
    },
  };
  el.classList._owner = el;
  Object.defineProperty(el, "innerHTML", {
    get() {
      return this._rawHtml || "";
    },
    set(v) {
      this._rawHtml = String(v || "");
      this.children = [];
    },
  });
  return el;
}

function matches(el, sel) {
  if (!el || !sel) return false;
  if (sel.charAt(0) === "#") return el.id === sel.slice(1);
  if (sel.charAt(0) === ".") {
    const cls = sel.slice(1);
    return (" " + (el.className || "") + " ").indexOf(" " + cls + " ") !== -1;
  }
  if (sel.charAt(0) === "[") {
    const m = sel.match(/^\[([^=\]]+)(?:=["']?([^"'\]]*)["']?)?\]$/);
    if (!m) return false;
    const v = el.getAttribute(m[1]);
    if (m[2] == null) return v != null;
    return v === m[2];
  }
  return el.tagName === sel.toUpperCase();
}

function walk(node, out) {
  out.push(node);
  (node.children || []).forEach(function (c) {
    walk(c, out);
  });
}

function queryAll(root, sel) {
  const all = [];
  walk(root, all);
  return all.filter(function (n) {
    return n !== root && matches(n, sel);
  });
}

function queryOne(root, sel) {
  const parts = String(sel).split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const all = queryAll(root, parts[0]);
    return all[0] || null;
  }
  let scope = [root];
  for (let i = 0; i < parts.length; i++) {
    const next = [];
    scope.forEach(function (s) {
      queryAll(s, parts[i]).forEach(function (n) {
        next.push(n);
      });
    });
    scope = next;
  }
  return scope[0] || null;
}

function createFakeDom() {
  const doc = {
    readyState: "complete",
    documentElement: null,
    head: null,
    body: null,
    createElement(tag) {
      return makeEl(tag, doc);
    },
    getElementById(id) {
      const all = [];
      walk(doc.documentElement, all);
      for (let i = 0; i < all.length; i++) {
        if (all[i].id === id) return all[i];
      }
      return null;
    },
    querySelector(sel) {
      return queryOne(doc.documentElement, sel);
    },
    querySelectorAll(sel) {
      return queryAll(doc.documentElement, sel);
    },
    addEventListener() {},
    removeEventListener() {},
  };
  doc.documentElement = makeEl("html", doc);
  doc.head = makeEl("head", doc);
  doc.body = makeEl("body", doc);
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);
  const style = makeEl("style", doc);
  style.id = "damAssocEditInjectedCss";
  style.textContent = "/* harness */";
  doc.head.appendChild(style);
  return doc;
}

function flushDeferredTimers(window) {
  const q = window.__deferredTimerQueue || [];
  window.__deferredTimerQueue = [];
  q.forEach(function (fn) {
    try {
      fn();
    } catch (e) {
      /* harness */
    }
  });
}

function flushPromises() {
  return Promise.resolve();
}

function flushAsync(window) {
  flushDeferredTimers(window);
  return flushPromises().then(function () {
    flushDeferredTimers(window);
    return flushPromises();
  });
}

function loadAssocHarness() {
  const src = fs.readFileSync(ASSOC_JS, "utf8");
  const document = createFakeDom();
  const toasts = [];

  const window = {
    document,
    __deferredTimerQueue: [],
    localStorage: {
      _d: { dam_admin_mode: "1", dam_role: "admin", dam_token: "harness" },
      getItem(k) {
        return this._d[k] != null ? this._d[k] : null;
      },
      setItem(k, v) {
        this._d[k] = String(v);
      },
    },
    DamApi: {
      role() {
        return "admin";
      },
      authHeaders() {
        return { Authorization: "Bearer harness", Accept: "application/json" };
      },
      ensureSession() {
        return Promise.resolve({ ok: true, token: "harness" });
      },
    },
    DamToast: {
      show(msg) {
        toasts.push(String(msg || ""));
      },
    },
    DamPaths: { bridgeUrl() { return "http://127.0.0.1:8766"; } },
    fetch() {
      return Promise.resolve({
        ok: true,
        json() {
          return Promise.resolve({ entries: [] });
        },
      });
    },
    setTimeout: (fn, ms) => {
      if (!ms) {
        window.__deferredTimerQueue.push(fn);
        return 1;
      }
      return setTimeout(fn, ms);
    },
    clearTimeout,
    queueMicrotask:
      typeof queueMicrotask === "function" ? queueMicrotask : (fn) => Promise.resolve().then(fn),
    location: { origin: "http://127.0.0.1:8765", pathname: "/visualizations.html" },
    navigator: { clipboard: null },
    console,
    _DAM_FILE_INDEX: { products: [] },
  };
  window.window = window;
  window.global = window;
  document.defaultView = window;

  vm.runInNewContext(src, window, { filename: "dam-assoc-edit.js" });
  if (!window.DamAssocEdit) throw new Error("DamAssocEdit missing");

  return { window, document, toasts };
}

/** Czy dam-viz.js ma sync seed ctx po bindVizAssocCtas (P1 wdrozone) */
function vizSourceHasSyncCtxSeed() {
  const src = fs.readFileSync(VIZ_JS, "utf8");
  const m = src.match(/bindVizAssocCtas\s*\(\s*modal\s*,[\s\S]{0,1500}/);
  if (!m) return false;
  const block = m[0];
  return (
    /seedMaterialsCtx\s*\(/.test(block) ||
    /DamAssocEdit\.seedMaterialsCtx/.test(block) ||
    /modal\._damMaterialsCtx\s*=/.test(block) ||
    /pane\._damMaterialsCtx\s*=/.test(block)
  );
}

function applySyncSeedLikeProduction(modal, pane, first, DamAssocEdit) {
  if (typeof DamAssocEdit.seedMaterialsCtx === "function") {
    DamAssocEdit.seedMaterialsCtx(modal, first);
    return "seedMaterialsCtx";
  }
  const ctx = buildMinimalMaterialsCtx(first);
  modal._damMaterialsCtx = ctx;
  if (pane) pane._damMaterialsCtx = ctx;
  return "inline_minimal_ctx";
}

function createVizModalShell(document) {
  const modal = document.createElement("div");
  modal.id = "damVizModal";
  modal.className = "dam-viz-modal-overlay";

  const pane = document.createElement("div");
  pane.className =
    "dam-media-preview__assoc-col dam-media-preview__assoc-col--materials dam-viz-modal__assoc";

  const labelRow = document.createElement("div");
  labelRow.className = "dam-media-preview__assoc-label-row dam-viz-modal__assoc-label-row";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dam-int-cta dam-explorer-add-product-btn dam-viz-assoc-cta";
  btn.setAttribute("data-viz-assoc-cta", "suggestions");
  btn.textContent = "Dodaj/Edytuj sugestie";

  const grid = document.createElement("div");
  grid.className = "dam-media-preview__assoc-grid";
  grid.id = "damVizModalAssoc";

  labelRow.appendChild(btn);
  pane.appendChild(labelRow);
  pane.appendChild(grid);
  modal.appendChild(pane);
  document.body.appendChild(modal);
  return { modal, pane, btn };
}

function collectToastEvidence(document, toasts) {
  const domToast =
    document.getElementById("damAssocEditToast") ||
    document.getElementById("damTagEditToast") ||
    document.getElementById("damExplorerToast");
  const domText = domToast ? String(domToast.textContent || "").trim() : "";
  const all = toasts.slice();
  if (domText) all.push(domText);
  const ctxToast = all.some(function (t) {
    return t.indexOf(CTX_TOAST) >= 0;
  });
  return { all, ctxToast, domText };
}

function runContractSeededOpen(harness) {
  const { window, document, toasts } = harness;
  const first = mockFirst();
  const { modal, pane, btn } = createVizModalShell(document);
  const ctx = buildMinimalMaterialsCtx(first);
  modal._damMaterialsCtx = ctx;
  pane._damMaterialsCtx = ctx;

  window.DamAssocEdit.openVizMaterialsEdit315(btn, modal);
  return flushAsync(window).then(function () {
    const toastEv = collectToastEvidence(document, toasts);
    const popover = document.getElementById("damAssocEditPopover");
    const ok = !toastEv.ctxToast && !!popover;

    try {
      window.DamAssocEdit.closePicker();
    } catch (e) {
      /* ignore */
    }

    return {
      name: "contract_seeded_openVizMaterialsEdit315",
      ok,
      ctxToast: toastEv.ctxToast,
      popoverOpened: !!popover,
      toasts: toastEv.all,
    };
  });
}

function runIntegrationPreAsyncClick(harness, p1InSource) {
  const { window, document, toasts } = harness;
  const first = mockFirst();
  const { modal, pane, btn } = createVizModalShell(document);

  window.DamAssocEdit.bindVizAssocCtas(modal, {});

  let seedMethod = "none";
  if (p1InSource) {
    seedMethod = applySyncSeedLikeProduction(modal, pane, first, window.DamAssocEdit);
  }

  window.DamAssocEdit.openVizMaterialsEdit315(btn, modal);
  return flushAsync(window).then(function () {
    const toastEv = collectToastEvidence(document, toasts);
    const popover = document.getElementById("damAssocEditPopover");
    const ok = !toastEv.ctxToast && !!popover;

    try {
      window.DamAssocEdit.closePicker();
    } catch (e) {
      /* ignore */
    }

    return {
      name: "integration_modal_open_then_suggestions_click",
      ok,
      p1InSource,
      seedMethod,
      ctxToast: toastEv.ctxToast,
      popoverOpened: !!popover,
      toasts: toastEv.all,
      expectsPass: p1InSource,
    };
  });
}

function main() {
  const p1InSource = vizSourceHasSyncCtxSeed();
  const fails = [];

  const harness1 = loadAssocHarness();
  runContractSeededOpen(harness1).then(function (contract) {
    if (!contract.ok) {
      fails.push(
        contract.name +
          (contract.ctxToast ? ": ctx_toast_shown" : "") +
          (!contract.popoverOpened ? ": popover_missing" : "")
      );
    }

    const harness2 = loadAssocHarness();
    return runIntegrationPreAsyncClick(harness2, p1InSource).then(function (integration) {
      if (integration.expectsPass && !integration.ok) {
        fails.push(
          integration.name +
            ": P1_in_source_but_still_ctx_toast_or_no_popover" +
            (integration.ctxToast ? " toast" : "") +
            (!integration.popoverOpened ? " no_popover" : "")
        );
      }
      if (!integration.expectsPass && integration.ok) {
        fails.push(
          integration.name +
            ": false_green_pre_fix_should_fail_without_seed_in_dam-viz.js"
        );
      }

      const report = {
        test: "sim-assoc-viz-sync-ctx",
        purpose:
          "P1 — po sync seed _damMaterialsCtx openVizMaterialsEdit315 bez toastu ctx; integration FAIL pre-fix",
        p1SyncSeedInDamVizSource: p1InSource,
        contract_seeded: {
          pass: contract.ok,
          ctxToast: contract.ctxToast,
          popoverOpened: contract.popoverOpened,
        },
        integration: {
          pass: integration.ok,
          seedMethod: integration.seedMethod,
          ctxToast: integration.ctxToast,
          popoverOpened: integration.popoverOpened,
          toasts: integration.toasts,
          expectedOnCurrentCode: p1InSource ? "PASS" : "FAIL",
        },
      };

      console.log("=== sim-assoc-viz-sync-ctx ===");
      console.log(JSON.stringify(report, null, 2));

      if (contract.ctxToast) {
        console.error("contract: toast fired despite seeded ctx:", contract.toasts);
      }
      if (integration.ctxToast) {
        console.error("integration: ctx toast (expected pre-fix):", integration.toasts);
      }

      if (fails.length) {
        console.error("FAIL " + fails.join("; "));
        process.exit(1);
      }

      if (!p1InSource) {
        console.log(
          "EXPECTED_PRE_FIX_FAIL integration_modal_open_then_suggestions_click — " +
            "dam-viz.js brak sync seed; toast ctx = problem P1. Po wdrożeniu P1 harness powinien PASS."
        );
        process.exit(1);
      }

      console.log("PASS sim-assoc-viz-sync-ctx (P1 sync seed detected in dam-viz.js; USER RUNTIME UNVERIFIED)");
    });
  });
}

main();
