/**
 * Pomocnik testow node: wczytuje PRAWDZIWY dam-branding.js w vm z atrapami DOM (bez przegladarki) i udostepnia
 * wybrane funkcje IIFE przez window.__dbg (wstrzykniete tuz przed koncem pliku, tylko w pamieci testu).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const JS_PATH = process.env.DAM_BRANDING_JS || path.join(__dirname, "..", "..", "assets", "js", "dam-branding.js");

function makeEl() {
  return new Proxy(function () {}, {
    get(_t, p) {
      if (p === "style") return {};
      if (p === "classList") return { add() {}, remove() {}, contains() { return false; }, toggle() {} };
      if (p === "children" || p === "childNodes") return [];
      if (p === "dataset") return {};
      if (p === "value" || p === "textContent" || p === "innerHTML" || p === "id" || p === "className") return "";
      if (p === "querySelector" || p === "closest") return () => null;
      if (p === "querySelectorAll") return () => [];
      if (p === Symbol.toPrimitive) return () => "";
      return () => makeEl();
    },
    set() { return true; },
    apply() { return makeEl(); },
  });
}

const EXPORTS = [
  "thumbStackHtml", "groupCardHtml", "collectBrandingMtimeNeed", "enrichBrandingMtimes", "ensureBrandingMtimesReady",
  "scheduleBrandingMtimeHydrate", "mergeBrandingMtime", "isBrandingScopeExcluded", "isBrandingGridEligible",
  "baseFilteredAssets", "groupMarketingAssets", "pickPrimaryMarketing", "marketingGroupLabel",
  "isPresentationTreePath", "presentationCard", "pickPrimaryPresentation", "presentationDirs", "marketingGroupKey",
  "groupBrandingAssets", "passesGraphicsOnlyFilter", "sortGroupedEntriesForDisplay", "thumbHtml",
  "presentationVariantsBlockHtml", "brandingCardTypeMeta",
];

function load(opts) {
  opts = opts || {};
  let src = fs.readFileSync(JS_PATH, "utf8");
  const i = src.lastIndexOf("})();");
  const inject =
    "\nwindow.__dbg = {" +
    EXPORTS.map((n) => `${n}: typeof ${n} === "function" ? ${n} : null`).join(", ") +
    ", setIndex: function (v) { index = v; if (typeof clearBrandingComputeCache === \"function\") clearBrandingComputeCache(); }, getIndex: function () { return index; }" +
    ", setGridAssets: function (v) { currentGridAssets = v; }" +
    ", stubRender: function (f) { scheduleBrandingRender = f; }" +
    ", stubThumbHtml: function (f) { thumbHtml = f; }" +
    ", source: function () { return " + JSON.stringify("") + "; } };\n";
  src = src.slice(0, i) + inject + src.slice(i);
  const els = { damBrandingGraphicsOnly: { checked: true }, damBrandingIncludeArchive: { checked: false } };
  const win = {
    addEventListener() {}, removeEventListener() {}, DamI18n: null,
    location: { pathname: "/explorer.html", search: "", hash: "" },
    localStorage: { getItem() { return null; }, setItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }), innerWidth: 1600,
    requestAnimationFrame: (f) => setTimeout(f, 0),
  };
  const doc = {
    getElementById: (id) => els[id] || null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, readyState: "complete", createElement: () => makeEl(), body: makeEl(),
    documentElement: makeEl(), hidden: false,
  };
  const ctx = Object.assign({
    window: win, document: doc, console, setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: win.localStorage, sessionStorage: win.localStorage,
    performance: { mark() {}, measure() {}, getEntriesByName: () => [], now: () => Date.now() },
    URLSearchParams, location: win.location, navigator: { userAgent: "node" },
    fetch: () => Promise.reject(new Error("no fetch")), CustomEvent: function () {},
    MutationObserver: function () { this.observe = () => {}; },
    IntersectionObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    requestAnimationFrame: win.requestAnimationFrame, requestIdleCallback: (f) => setTimeout(f, 0),
    cancelAnimationFrame() {}, Intl, Date, JSON, Math, Object, Array, String, Number, RegExp, Error, Promise,
    Set, Map, Symbol, Proxy, parseInt, parseFloat, isFinite, isNaN, encodeURIComponent, decodeURIComponent,
  }, opts.globals || {});
  ctx.window.window = ctx.window;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: JS_PATH });
  return { dbg: ctx.window.__dbg, ctx, source: fs.readFileSync(JS_PATH, "utf8") };
}

module.exports = { load, JS_PATH };
