/**
 * 29.09.2026 - "grafiki nie laduja sie calkowicie, nie wiem, czy to laduje":
 *  - dam-preview-truth: najwyzej 3 podglady oryginalu naraz (preferOriginal w kolejce),
 *    ukrywanie ikony zepsutego obrazka w czasie ponowien, etykiety stanu, previewStatus z pamiecia,
 *  - dam-viz: blad miniatury pyta /preview/status zamiast od razu ciagnac caly oryginal.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const JS = path.join(__dirname, "..", "..", "assets", "js");
const truthSrc = fs.readFileSync(path.join(JS, "dam-preview-truth.js"), "utf8");
const vizSrc = fs.readFileSync(path.join(JS, "dam-viz.js"), "utf8");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

/* --- sandbox dla dam-preview-truth.js --- */
const images = [];
function FakeImage() {
  images.push(this);
  this.decoding = "";
  this.onload = null;
  this.onerror = null;
  this._src = "";
}
Object.defineProperty(FakeImage.prototype, "src", {
  get() { return this._src; },
  set(v) { this._src = v; },
});
let fetchCalls = 0;
const timers = [];
const doc = {
  getElementById: () => null,
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  head: { appendChild() {} },
  documentElement: { appendChild() {} },
  querySelectorAll: () => [],
  addEventListener() {},
  readyState: "complete",
};
const win = {
  document: doc,
  Image: FakeImage,
  IntersectionObserver: null,
  setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
  setInterval: () => 1,
  clearTimeout() {},
  location: { protocol: "http:", hostname: "127.0.0.1", port: "8765" },
  localStorage: { getItem: () => null, setItem() {} },
  addEventListener() {},
  fetch: () => {
    fetchCalls++;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "pending" }) });
  },
  DamPaths: { toLocal: (p) => "M:/" + String(p).replace(/^\/+/, ""), bridgeUrl: () => "http://127.0.0.1:8766" },
};
win.window = win;
win.globalThis = win;
const ctx = vm.createContext(Object.assign({ console, Promise, Date, Math, JSON, encodeURIComponent, String, Number, Object, Array }, win));
vm.runInContext(truthSrc, ctx, { filename: "dam-preview-truth.js" });
const PT = ctx.DamPreviewTruth || win.DamPreviewTruth;
if (!PT) fail("DamPreviewTruth not exported");

["startThumbWait", "previewStatus", "stateLabel", "statePlaceholderSvg", "preferOriginal"].forEach((k) => {
  if (typeof PT[k] !== "function") fail("missing DamPreviewTruth." + k);
});

/* etykiety stanu po polsku */
if (PT.stateLabel("pending") !== "Podgląd w przygotowaniu") fail("pending label");
if (PT.stateLabel("failed") !== "Nie udało się utworzyć podglądu") fail("failed label");
if (PT.stateLabel("unsupported") !== "Format bez podglądu") fail("unsupported label");
if (decodeURIComponent(PT.statePlaceholderSvg("failed")).indexOf("Nie udało się utworzyć podglądu") === -1) {
  fail("placeholder svg must carry the state text");
}

/* CSS: w czasie czekania obrazek (z ikona zepsutego obrazka) jest ukryty */
if (truthSrc.indexOf(".dam-thumb-wait img{opacity:0") === -1) fail("wait state must hide the broken img icon");

/* preferOriginal: najwyzej 3 naraz, reszta w kolejce, kolejna po zakonczeniu */
function fakeImg(p) {
  const attrs = { "data-dam-original": p };
  return {
    isConnected: true,
    src: "thumb",
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    setAttribute: (k, v) => { attrs[k] = String(v); },
  };
}
for (let i = 0; i < 10; i++) PT.preferOriginal(fakeImg("/- POLSKA/p" + i + ".png"), "/- POLSKA/p" + i + ".png");
const started = images.filter((im) => im._src);
if (started.length !== 3) fail("expected 3 originals in flight, got " + started.length);
started[0].onload();
if (images.filter((im) => im._src).length !== 4) fail("next original must start after one finishes");

/* previewStatus: jedno zapytanie na sciezke w oknie 30 s */
const before = fetchCalls;
PT.previewStatus("/- POLSKA/a.png", "grid");
PT.previewStatus("/- POLSKA/a.png", "grid");
if (fetchCalls - before !== 1) fail("previewStatus must be cached per path, calls=" + (fetchCalls - before));

/* --- dam-viz: blad miniatury pyta o stan, nie ciagnie od razu oryginalu --- */
const i0 = vizSrc.indexOf("function onThumbError(img)");
const body = vizSrc.slice(i0, vizSrc.indexOf("window.damVizThumbError", i0));
const iStatus = body.indexOf("PT.previewStatus(path");
const iLegacyMedia = body.indexOf("var live = mediaPreviewUrl(path)");
if (iStatus === -1) fail("onThumbError must consult /preview/status first");
if (iLegacyMedia !== -1 && iLegacyMedia < iStatus) fail("heavy /media fallback must not come before status check");
if (body.indexOf("PT.startThumbWait") === -1) fail("onThumbError must show the loading state immediately");
if (vizSrc.indexOf("function vizThumbFinal") === -1) fail("missing final honest placeholder");

console.log("OK preview loading states: queue<=3, status cache, honest labels, viz asks status first");
