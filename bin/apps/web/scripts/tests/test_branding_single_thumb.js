/**
 * Karta grupy rysuje JEDNA miniature: glowny plik (ten sam co tytul karty). Dawna warstwa tylna (drugi plik grupy
 * pod przodem, przesuniety) przeswitywala przez przezroczyste PNG (zgloszenie wlasciciela 07.10.2026).
 * Bez przegladarki: prawdziwy dam-branding.js w vm.
 */
const fs = require("fs");
const path = require("path");
const { load } = require("./branding_vm_helper.js");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const { dbg, source } = load();
if (typeof dbg.thumbStackHtml !== "function") fail("brak thumbStackHtml");

// podglad warstw: thumbHtml podstawiony atrapa, zeby liczyc, ILE plikow jest rysowanych
const drawn = [];
dbg.stubThumbHtml(function (a) {
  drawn.push(a && a.id);
  return '<img class="dam-viz-thumb__img" data-path="' + (a && a.path) + '">';
});

const mk = (id, name) => ({ id, name, path: "M:/- POLSKA/02 - FIRMOWE MATERIAŁY/X/" + name, media_type: "image", asset_role: "brand_asset" });
const group = [mk("br-1", "apple.png"), mk("br-2", "apple-2.png"), mk("br-3", "apple-3.png")];
const html = dbg.thumbStackHtml(group, group[0]);

const layers = html.match(/dam-branding-thumb-stack__layer--[a-z]+/g) || [];
if (layers.length !== 1 || layers[0] !== "dam-branding-thumb-stack__layer--front") fail("oczekiwano jednej warstwy --front, jest: " + JSON.stringify(layers));
if (html.indexOf("layer--back") !== -1) fail("warstwa tylna nadal w HTML");
if (drawn.length !== 1 || drawn[0] !== "br-1") fail("rysowany ma byc tylko glowny plik, rysowane: " + JSON.stringify(drawn));
if ((html.match(/<img/g) || []).length !== 1) fail("oczekiwano jednego <img>");

// grupa, w ktorej glowny jest nie-obrazem: nadal jedna warstwa (pickThumbAsset), bez dokladania drugiej
drawn.length = 0;
const mixed = [{ id: "br-9", name: "plan.pdf", path: "M:/x/plan.pdf", media_type: "document" }, mk("br-8", "plan-podglad.png")];
const html2 = dbg.thumbStackHtml(mixed, mixed[0]);
if ((html2.match(/thumb-stack__layer--/g) || []).length !== 1 || drawn.length !== 1) fail("grupa mieszana: jedna warstwa, jeden plik");

// CSS: reguly warstwy tylnej nie ma, przod zostaje
const css = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "css", "dam-branding.css"), "utf8");
if (/thumb-stack__layer--back/.test(css)) fail("dam-branding.css nadal ma regule --back");
if (!/thumb-stack__layer--front/.test(css)) fail("dam-branding.css: brak reguly --front");
if (/thumb-stack__layer--back/.test(source)) fail("dam-branding.js: --back");

// klik i podglad dalej celuja w warstwe przednia
const front = (source.match(/thumb-stack__layer--front \[data-path\]/g) || []).length;
if (front < 2) fail("selektory klik/podglad (--front [data-path]) zmienione, znaleziono " + front);

// licznik "+N" zostaje w karcie grupy
const g = source.slice(source.indexOf("function groupCardHtml"), source.indexOf("function gridEntryHtml"));
if (g.indexOf("brandingCardVariantBadgeHtml(displayCount)") === -1) fail("licznik +N zniknal z karty grupy");
if (g.indexOf("thumbStackHtml(assets, primary)") === -1) fail("karta grupy nie uzywa thumbStackHtml");

console.log("OK branding: karta grupy rysuje jedna miniature (glowny plik), licznik +N i klik bez zmian");
