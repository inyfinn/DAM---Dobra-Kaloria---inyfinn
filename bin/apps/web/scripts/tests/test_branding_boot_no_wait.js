/**
 * Start panelu Branding bez czekania na daty i skan WWW (zgloszenie wlasciciela 07.10.2026: "Daty plikow 172/676", ponad 20 s).
 * Przyczyna: scheduleBrandingMtimeHydrate (forceDisk, bez maxIds) pytal most o KAZDY material (676 zapytan x 120 id), choc
 * siatka ma daty od razu, a boot() czekal jeszcze na skan WWW (4-6 s na dysku sieciowym) i na druga fale dat.
 * Bez przegladarki: prawdziwy dam-branding.js w vm, fetch podstawiony.
 */
const { load } = require("./branding_vm_helper.js");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const { dbg, ctx, source } = load();
const N = 81014, MISSING = 40;

function makeIndex(missing, withMtime) {
  const assets = [];
  for (let i = 0; i < N; i++) {
    assets.push({ id: "br-" + i, name: "a" + i + ".png", path: "M:/- POLSKA/x/a" + i + ".png", mtime_ms: i < missing ? 0 : withMtime });
  }
  return { assets };
}

// fetch: liczy zapytania, odpowiada /branding/mtimes (data z "dysku" = 1700000000000 + n)
function installFetch(counter) {
  ctx.fetch = function (url) {
    counter.n++;
    const ids = decodeURIComponent(String(url).split("ids=")[1] || "").split(",").filter(Boolean);
    counter.ids += ids.length;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ assets: ids.map((id) => ({ id, mtime_ms: 1700000000000 + Number(id.slice(3)), mtime: "x" })) }),
    });
  };
}

(async () => {
  // 1) wszystkie daty sa w indeksie: ZERO zapytan, takze przy force/forceDisk (dawne wywolania)
  let idx = makeIndex(0, 1690000000000);
  const need = dbg.collectBrandingMtimeNeed(idx, 0, { force: true, forceDisk: true });
  if (need.ids.length !== 0) fail("kompletny indeks: oczekiwano 0 id do dopytania, jest " + need.ids.length);

  // 2) brakuje 40 dat: dopytujemy tylko te, jedna paczka; widoczne najpierw
  idx = makeIndex(MISSING, 1690000000000);
  const prio = ["br-30", "br-31"];
  const need2 = dbg.collectBrandingMtimeNeed(idx, 0, { force: true, forceDisk: true, priorityIds: prio });
  if (need2.ids.length !== MISSING) fail("oczekiwano " + MISSING + " id, jest " + need2.ids.length);
  if (need2.ids[0] !== "br-30" || need2.ids[1] !== "br-31") fail("id z widocznej strony maja isc pierwsze: " + need2.ids.slice(0, 3));

  // 3) enrich: zapytania i licznik zmian
  const c = { n: 0, ids: 0 };
  installFetch(c);
  let stats = { changed: 0 };
  idx = makeIndex(MISSING, 1690000000000);
  await dbg.enrichBrandingMtimes(idx, { force: true, forceDisk: true, stats });
  if (c.n !== 1 || c.ids !== MISSING) fail(`brakujace daty: oczekiwano 1 zapytania na ${MISSING} id, jest ${c.n} / ${c.ids}`);
  if (stats.changed !== MISSING) fail("licznik zmian: " + stats.changed);
  c.n = 0; c.ids = 0;
  idx = makeIndex(0, 1690000000000);
  stats = { changed: 0 };
  await dbg.enrichBrandingMtimes(idx, { force: true, forceDisk: true, stats });
  if (c.n !== 0) fail("kompletny indeks: oczekiwano 0 zapytan (dawniej 676), jest " + c.n);

  // 4) tlo: przerysowanie dokladnie raz, gdy daty sie zmienily; wcale, gdy nic nowego; nie przy kazdej paczce
  let renders = 0;
  dbg.stubRender(() => { renders++; });
  const flush = () => new Promise((r) => setTimeout(r, 30));

  c.n = 0; c.ids = 0;
  dbg.setIndex(makeIndex(0, 1690000000000));
  dbg.scheduleBrandingMtimeHydrate();
  await flush();
  if (renders !== 0 || c.n !== 0) fail(`nic do dopytania: bez zapytan i bez przerysowania (zapytania ${c.n}, przerysowania ${renders})`);

  dbg.setIndex(makeIndex(MISSING, 1690000000000));
  dbg.scheduleBrandingMtimeHydrate();
  await flush();
  if (renders !== 1) fail("po dociagnieciu dat oczekiwano jednego przerysowania, jest " + renders);

  renders = 0;
  c.n = 0; c.ids = 0;
  const big = makeIndex(500, 1690000000000); // 500 brakujacych = 5 paczek po 120
  dbg.setIndex(big);
  dbg.scheduleBrandingMtimeHydrate();
  await flush();
  if (c.n !== 5) fail("500 brakujacych dat = 5 paczek, jest " + c.n);
  if (renders !== 1) fail("wiele paczek ma dac JEDNO przerysowanie, jest " + renders);

  // 5) boot(): bez await na skan WWW i daty, bez wiersza "Daty plikow"
  const boot = source.slice(source.indexOf("async function boot()"), source.indexOf("function patchAssetField"));
  if (/await\s+mergeLiveWwwScanAssets/.test(boot)) fail("boot() czeka na skan WWW");
  if (/await\s+ensureBrandingMtimesReady/.test(boot)) fail("boot() czeka na daty");
  if (!/mergeLiveWwwScanAssets\(\)\.then/.test(boot) || !/scheduleBrandingMtimeHydrate\(\)/.test(boot)) fail("boot() powinien uruchamiac skan WWW i daty w tle");
  if (/Daty plików|Skan strony WWW/.test(source)) fail("pozostal wiersz statusu 'Daty plików' / 'Skan strony WWW'");
  if (/forceDisk/.test(source.replace(/\/\*[\s\S]*?\*\//g, ""))) fail("forceDisk nadal uzywany w kodzie");

  console.log("OK branding: start bez czekania na daty i skan WWW; dopytujemy tylko brakujace daty; przerysowanie raz");
})().catch((x) => fail(String((x && x.stack) || x)));
