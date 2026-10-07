/**
 * Swieza instalacja nie ma siatki materialow marki (instalator jej nie wozi): panel pokazuje
 * "Pobieram materialy marki z bazy..." i ponawia sam (zdarzenie pollera /branding/status albo co 5 s do 10 min),
 * dopiero potem "Nie udalo sie przygotowac materialow marki" z ponowieniem na klik. Bez przegladarki: blok
 * GRID_WAIT wyciagniety z dam-branding.js i wykonany w vm z atrapami.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const src = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-branding.js"), "utf8");
const b = src.indexOf("/* GRID_WAIT_BEGIN");
const e = src.indexOf("/* GRID_WAIT_END */");
if (b < 0 || e < b) fail("brak bloku GRID_WAIT w dam-branding.js");
const block = src.slice(b, e);

// teksty i zakazy
if (src.indexOf("Brak branding-grid-index") !== -1) fail("komunikat z nazwa skryptu zostal");
if (src.indexOf("Uruchom build-branding-grid-index") !== -1) fail("polecenie dla programisty zostalo w UI");
if (block.indexOf("Pobieram materiały marki z bazy…") === -1) fail("brak tekstu 'Pobieram materiały marki z bazy…'");
if (block.indexOf("Nie udało się przygotować materiałów marki - sprawdź połączenie.") === -1) fail("brak komunikatu o niepowodzeniu");
if (/—|–/.test(block)) fail("pauza dluga/krotka w tekstach");
if (src.indexOf("loadIndexPatient()") === -1 || src.indexOf("e.damGridWait") === -1) fail("boot nie uzywa loadIndexPatient / showGridFailure");

function makeContext(opts) {
  const log = { status: [], polls: 0, pollerStopped: 0, loadCalls: [], reloaded: 0, html: {} };
  let pollerOnChange = null;
  const ctx = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    Promise,
    log,
    esc: (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"),
    location: { reload() { log.reloaded++; } },
    document: {
      getElementById(id) {
        if (id !== "damBrandingGrid" && id !== "damBrandingSectionGrid") return null;
        const el = {
          set innerHTML(v) { log.html[id] = v; },
          get innerHTML() { return log.html[id]; },
          querySelector() { return { addEventListener(_ev, fn) { log.retryClick = fn; } }; },
        };
        return el;
      },
    },
    setBootStatus(msg) { log.status.push(msg); },
    window: {
      DamIndexPoller: {
        pickGeneration: () => "",
        create(cfg) {
          log.polls++;
          log.pollerCfg = cfg;
          pollerOnChange = cfg.onChange;
          return { stop() { log.pollerStopped++; } };
        },
      },
    },
    loadIndex: async function (o) {
      log.loadCalls.push(o);
      if (log.loadCalls.length <= opts.failures) throw new Error("http_404");
      return { assets: [1] };
    },
  };
  ctx.fireStatusChange = () => pollerOnChange && pollerOnChange("g2", {});
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  return ctx;
}

(async () => {
  // 1) siatka pojawia sie po kilku probach: tekst, ponowienie, jeden poller, zatrzymany na koncu
  let ctx = makeContext({ failures: 3 });
  vm.runInContext("GRID_WAIT_STEP_MS = 20;", ctx);
  let idx = await vm.runInContext("loadIndexPatient()", ctx);
  if (!idx || ctx.log.loadCalls.length !== 4) fail("oczekiwano 4 prob, jest " + ctx.log.loadCalls.length);
  if (ctx.log.status.filter((s) => s === "Pobieram materiały marki z bazy…").length < 3) fail("brak tekstu oczekiwania");
  if (ctx.log.polls !== 1 || ctx.log.pollerStopped !== 1) fail("poller: tworzony raz i zatrzymany po sukcesie");
  if (ctx.log.pollerCfg.statusPath !== "/branding/status") fail("poller musi sluchac /branding/status");
  if (ctx.log.loadCalls[0] && ctx.log.loadCalls[0].quiet) fail("pierwsza proba nie moze byc quiet");
  if (!ctx.log.loadCalls[1].quiet) fail("kolejne proby maja byc quiet (bez migotania statusu)");

  // 2) zdarzenie pollera budzi ponowienie przed uplywem kroku 5 s
  ctx = makeContext({ failures: 1 });
  vm.runInContext("GRID_WAIT_STEP_MS = 5000;", ctx);
  const t0 = Date.now();
  const p = vm.runInContext("loadIndexPatient()", ctx);
  setTimeout(() => ctx.fireStatusChange(), 60);
  idx = await p;
  if (Date.now() - t0 > 2000) fail("zdarzenie pollera nie obudzilo ponowienia (czekano " + (Date.now() - t0) + " ms)");
  if (ctx.log.loadCalls.length !== 2) fail("po zdarzeniu oczekiwano drugiej proby");

  // 3) po 10 min (tu: 50 ms) blad z flaga damGridWait; showGridFailure daje komunikat i klik = przeladowanie
  ctx = makeContext({ failures: 1000 });
  vm.runInContext("GRID_WAIT_STEP_MS = 10; GRID_WAIT_MAX_MS = 50;", ctx);
  let err = null;
  try {
    await vm.runInContext("loadIndexPatient()", ctx);
  } catch (x) {
    err = x;
  }
  if (!err || err.damGridWait !== true) fail("po limicie czasu oczekiwano bledu z damGridWait");
  if (ctx.log.pollerStopped !== 1) fail("poller musi byc zatrzymany takze po bledzie");
  vm.runInContext("showGridFailure()", ctx);
  const html = ctx.log.html.damBrandingSectionGrid || "";
  if (html.indexOf("Nie udało się przygotować materiałów marki - sprawdź połączenie.") === -1) fail("brak komunikatu o niepowodzeniu w siatce");
  if (html.indexOf("Spróbuj ponownie") === -1) fail("brak przycisku ponowienia");
  ctx.log.retryClick();
  if (ctx.log.reloaded !== 1) fail("klik 'Spróbuj ponownie' ma przeladowac panel");

  console.log("OK branding: oczekiwanie na siatke z bazy, ponowienie po zdarzeniu pollera albo co 5 s, komunikat po 10 min");
})().catch((x) => fail(String((x && x.stack) || x)));
