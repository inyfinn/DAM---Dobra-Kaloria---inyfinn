/**
 * P1 preflight: openMediaPicker(kind:material) with empty materialCandidates.
 * Proves shell opens sync without catalog scan / file-index / branding-index fetch.
 *
 * Run: node scripts/qa/sim-assoc-material-empty-seed.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");
const ASSOC_JS = path.join(ROOT, "apps/web/assets/js/dam-assoc-edit.js");
const BUDGET_MS = 16;

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

function loadAssoc() {
  const src = fs.readFileSync(ASSOC_JS, "utf8");
  const document = createFakeDom();
  const fetchUrls = [];
  let fetchDuringOpen = 0;
  let handlerReturned = false;

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
    DamToast: { show() {} },
    DamPaths: { bridgeUrl() { return "http://127.0.0.1:8766"; } },
    fetch(url) {
      fetchUrls.push(String(url));
      if (!handlerReturned) fetchDuringOpen++;
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
  if (!window.DamAssocEdit || typeof window.DamAssocEdit.openPicker !== "function") {
    throw new Error("DamAssocEdit.openPicker missing");
  }

  return {
    window,
    document,
    fetchUrls,
    metrics: {
      get fetchDuringOpen() {
        return fetchDuringOpen;
      },
      markReturned() {
        handlerReturned = true;
      },
    },
  };
}

function measureSync(fn) {
  const t0 = process.hrtime.bigint();
  fn();
  const t1 = process.hrtime.bigint();
  return Number(t1 - t0) / 1e6;
}

function main() {
  const ctx = loadAssoc();
  const { window, document, metrics } = ctx;
  const col = document.createElement("div");
  col.className = "dam-media-preview__assoc-col dam-media-preview__assoc-col--materials";
  document.body.appendChild(col);

  const seedCtx = {
    asset: null,
    materialsList: [],
    shownPrimaries: [],
    materialCandidates: [],
    productContext: {
      id: "prod-seed-6300654",
      name: "Proteina test",
      index: "6300654",
      revision_path: "X:/Products/6300654",
    },
    groupContext: {
      product_id: "prod-seed-6300654",
      linked_product_ids: ["prod-seed-6300654"],
    },
    onRefresh() {},
  };

  const fails = [];
  const openBody = fs.readFileSync(ASSOC_JS, "utf8");

  const directMs = measureSync(function () {
    window.DamAssocEdit.openPicker(col, {
      kind: "material",
      head: "Skojarzone materiały brandingowe",
      selectedIds: [],
      pinnedIds: [],
      materialCandidates: [],
      bootstrapQuery: "6300654",
      productContext: seedCtx.productContext,
      onConfirm() {},
    });
  });
  metrics.markReturned();

  flushAsync(window).then(function () {
    const pop = document.getElementById("damAssocEditPopover");
    const overlay = document.getElementById("damAssocEditOverlay");
    if (!pop) fails.push("direct_shell_popover_missing");
    if (!overlay) fails.push("direct_shell_overlay_missing");
    if (metrics.fetchDuringOpen > 0) fails.push("direct_fetch_in_click_stack_" + metrics.fetchDuringOpen);
    if (!(directMs < BUDGET_MS)) fails.push("direct_sync_over_budget_" + Math.round(directMs));

    try {
      window.DamAssocEdit.closePicker();
    } catch (e) {
      fails.push("direct_closePicker_throws");
    }

    const modal = document.createElement("div");
    modal.id = "damVizModal";
    const pane = document.createElement("div");
    pane.className = "dam-media-preview__assoc-col dam-media-preview__assoc-col--materials";
    pane._damMaterialsCtx = seedCtx;
    modal._damMaterialsCtx = seedCtx;
    modal.appendChild(pane);
    document.body.appendChild(modal);
    const btn = document.createElement("button");
    btn.setAttribute("data-viz-assoc-cta", "suggestions");
    modal.appendChild(btn);

    const vizMs = measureSync(function () {
      window.DamAssocEdit.openVizAssocSuggestionsPicker(modal, btn);
    });

    return flushAsync(window).then(function () {
      const pop2 = document.getElementById("damAssocEditPopover");
      if (!pop2) fails.push("viz_path_popover_missing");
      if (!(vizMs < BUDGET_MS)) fails.push("viz_path_sync_over_budget_" + Math.round(vizMs));

      const goldenEnsureFileIndex =
        /schedulePaintPicker/.test(openBody) && !/openMediaPickerImmediate/.test(openBody);
      if (!goldenEnsureFileIndex) fails.push("golden_ensureFileIndex_path_missing");

      const materialBootstrapOnOpen =
        /opts\.kind === "material"[\s\S]{0,400}loadBrandingMaterialCandidates\(opts\)/.test(openBody);
      if (!materialBootstrapOnOpen) fails.push("material_bootstrap_fetch_on_open");

      const results = {
        test: "sim-assoc-material-empty-seed",
        purpose: "P1 preflight — empty materialCandidates tolerates open without freeze",
        directOpenSyncMs: Math.round(directMs * 1000) / 1000,
        vizSuggestionsSyncMs: Math.round(vizMs * 1000) / 1000,
        budgetMs: BUDGET_MS,
        fetchDuringOpen: metrics.fetchDuringOpen,
        goldenEnsureFileIndexInSource: goldenEnsureFileIndex,
        materialBootstrapOnOpen: materialBootstrapOnOpen,
      };

      console.log("=== sim-assoc-material-empty-seed ===");
      console.log(JSON.stringify(results, null, 2));

      if (fails.length) {
        console.error("FAIL " + fails.join(", "));
        process.exit(1);
      }
      console.log("PASS sim-assoc-material-empty-seed (DOM-shim; USER RUNTIME UNVERIFIED)");
    });
  });
}

main();
