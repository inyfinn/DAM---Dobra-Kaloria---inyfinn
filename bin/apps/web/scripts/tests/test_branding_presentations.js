/**
 * Karty prezentacji w Brandingu (07.10.2026): w firmowym drzewie 02 - FIRMOWE MATERIALY\PREZENTACJE jeden FOLDER
 * prezentacji = jedna karta (tytul = nazwa folderu, plik glowny = najnowsza prezentacja, reszta folderu = warianty "+N").
 * Przypadki wziete z prawdziwej struktury M:\- POLSKA\02 - FIRMOWE MATERIALY\PREZENTACJE (odczyt 07.10.2026):
 * dwa pptx + _robocze, folder z podfolderami badania/copy, luzny pptx, folder bez prezentacji, DATESY, folder programu.
 * Bez przegladarki: prawdziwy dam-branding.js w vm. Tabela drzewa jest wspolna z testem Pythona (branding_scope.py).
 */
const fs = require("fs");
const path = require("path");
const { load } = require("./branding_vm_helper.js");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}
function eq(got, want, what) {
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(what + ": oczekiwano " + JSON.stringify(want) + ", jest " + JSON.stringify(got));
}

const { dbg } = load();
for (const fn of ["isPresentationTreePath", "presentationCard", "pickPrimaryPresentation", "groupMarketingAssets", "baseFilteredAssets", "groupCardHtml"]) {
  if (typeof dbg[fn] !== "function") fail("brak funkcji " + fn + " w dam-branding.js");
}

// 1. lustro reguly drzewa = ta sama tabela co w Pythonie
const treeCases = JSON.parse(fs.readFileSync(path.join(__dirname, "presentation_tree_cases.json"), "utf8")).cases;
let bad = 0;
for (const c of treeCases) {
  if (dbg.isPresentationTreePath(c.path) !== c.in_tree) {
    bad++;
    console.error("ROZNICA:", JSON.stringify(c.path), "oczekiwano", c.in_tree, "-", c.note);
  }
}
if (bad) fail(bad + " przypadkow drzewa rozni sie od tabeli");

// 2. dane: prawdziwa struktura, daty plikow z odczytu M: (07.10.2026)
const P = "M:/- POLSKA/02 - FIRMOWE MATERIAŁY/PREZENTACJE/";
const t = (s) => Date.parse(s + ":00+02:00");
let n = 0;
const rows = [];
function add(rel, mtime, mt, extra) {
  const name = rel.split("/").pop();
  const ext = (name.match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
  const media = mt || (/^(pptx|ppt|key|odp|docx|xlsx|pdf)$/.test(ext) ? "document" : "image");
  const a = Object.assign({ id: "br-" + String(++n).padStart(4, "0"), name, path: rel.indexOf("M:") === 0 ? rel : P + rel, media_type: media, source: "marketing", mtime_ms: t(mtime) }, extra || {});
  rows.push(a);
  return a;
}

// 06.10.2026 - strategia: dwie prezentacje (starsza i nowsza) + Thumbs.db nie skanowany + _robocze
const sOld = add("06.10.2026 - strategia/DK_co_dalej_update.pptx", "2026-10-05 23:04");
const sNew = add("06.10.2026 - strategia/DK_co_dalej_update - nowy styl.pptx", "2026-10-07 08:15");
add("06.10.2026 - strategia/_robocze/qa/v9/s22.png", "2026-10-07 09:00");
add("06.10.2026 - strategia/_robocze/zrodlo.pptx", "2026-10-07 09:10");

// KULKI z kreatyna: 3 prezentacje, docx, xlsx, png w korzeniu, Elementy, Wizualizacje
const kMain = add("24.09.2026 - KULKI z kreatyną/KULKI z kreatyną - nowy styl.pptx", "2026-09-29 15:59");
const kOld = add("24.09.2026 - KULKI z kreatyną/KULKI z kreatyną - stary styl.pptx", "2026-09-29 13:18");
const kOrig = add("24.09.2026 - KULKI z kreatyną/DK_KULKI z kreatyną.pptx", "2026-09-29 10:05");
add("24.09.2026 - KULKI z kreatyną/Copy do kreatyn.docx", "2026-09-24 11:11");
add("24.09.2026 - KULKI z kreatyną/OMNIBUS_KULKI KREATYNA.xlsx", "2026-10-08 10:00"); // nowszy niz prezentacja: nie moze zostac plikiem glownym
add("24.09.2026 - KULKI z kreatyną/Karta wprowadzenia_kulki ARBUZ.xlsx", "2026-09-22 14:53");
add("24.09.2026 - KULKI z kreatyną/KULKI-KREATYNA1.png", "2026-09-10 10:30");
add("24.09.2026 - KULKI z kreatyną/Elementy/ARBUZ (1).png", "2026-09-24 12:00");
add("24.09.2026 - KULKI z kreatyną/Elementy/ARBUZ (2).png", "2026-09-24 12:00");
add("24.09.2026 - KULKI z kreatyną/Elementy/kulka.tif", "2026-09-24 12:00");
add("24.09.2026 - KULKI z kreatyną/Wizualizacje/KREATYNA - Znak wodny (2).png", "2026-09-24 17:50");
const kreatynaIds = rows.filter((a) => a.path.indexOf("24.09.2026 - KULKI z kreatyną/") !== -1).map((a) => a.id);

// ... TEST: osobny folder z jedna prezentacja (najnowsza w calym zbiorze)
const tNew = add("24.09.2026 - KULKI z kreatyną TEST/Kulki z kreatyną - nowy styl.pptx", "2026-10-07 11:48");
add("24.09.2026 - KULKI z kreatyną TEST/Elementy/ARBUZ (1).png", "2026-09-24 12:00");

// DATESY: plaski folder z jedna prezentacja
const dat = add("DATESY/DOBRA KALORIA - DATESY.pptx", "2026-09-23 08:49");

// luzne pliki prezentacji w korzeniu PREZENTACJE
const looseA = add("onlien.pptx", "2026-09-28 15:04");
const looseB = add("DK - szablon prezentacji.pptx", "2026-09-29 16:22");

// folder programu: wypada w calosci (takze plik bezposrednio w nim)
add("— SZABLON AI - skrypt/DK - szablon prezentacji.pptx", "2026-09-29 16:00");
add("— SZABLON AI - skrypt/WORK/poprzednie/v1/a.png", "2026-10-06 10:00");

// smieci: blokada otwartej prezentacji PowerPointa nie moze zostac prezentacja ani wariantem
add("DATESY/~$DOBRA KALORIA - DATESY.pptx", "2026-10-07 12:00");
add("DATESY/Thumbs.db", "2026-10-07 12:00");

// folder z podfolderami badania / copy / statystyki
const projMain = add("Projekt X/Projekt X.pptx", "2026-10-01 10:00");
add("Projekt X/badania/wyniki.xlsx", "2026-10-02 10:00");
add("Projekt X/copy/tekst.docx", "2026-10-02 11:00");
add("Projekt X/statystyki/dane.xlsx", "2026-10-03 11:00");
add("Projekt X/statystyki/wykres.png", "2026-10-03 11:00");

// folder BEZ prezentacji (tylko grafiki i dokument): nadal jedna karta folderu
const nb1 = add("Folder bez prezentacji/a.png", "2026-08-01 10:00");
add("Folder bez prezentacji/b.png", "2026-08-02 10:00");
const nbDoc = add("Folder bez prezentacji/notatka.xlsx", "2026-08-03 10:00");

// folder z PDF zamiast prezentacji: plik glowny = pdf
const pdfMain = add("Folder z pdf/raport.pdf", "2026-08-05 10:00");
add("Folder z pdf/grafika.png", "2026-08-06 10:00");

// kontener: prezentacje dopiero w podfolderach (najplytszy podfolder z prezentacja = folder prezentacji)
const lidl = add("2021/Lidl/Lidl - strategia.pptx", "2021-05-01 10:00");
add("2021/Lidl/img/slajd.png", "2021-05-01 10:00");
const kasz = add("2021/Kaszanka/Kaszanka.pptx", "2021-06-01 10:00");
const orphan = add("2021/luzna notatka.docx", "2021-07-01 10:00");

// poza drzewem PREZENTACJE: zachowanie bez zmian (legacy: grupowanie po folderze)
const out1 = add("M:/- POLSKA/08 - KAMAPANIE/2026/slider/a.png", "2026-09-01 10:00");
const out2 = add("M:/- POLSKA/08 - KAMAPANIE/2026/slider/b.png", "2026-09-02 10:00");
const arc1 = add("M:/-- ARCHIWUM --/99_Inne/SOLAR/Prezentacje/Prezentacje/prezentacja piatek/a.png", "2019-04-01 10:00", null, { is_archive: true });
const arc2 = add("M:/-- ARCHIWUM --/99_Inne/SOLAR/Prezentacje/Prezentacje/prezentacja piatek/b.png", "2019-04-02 10:00", null, { is_archive: true });
const outDoc = add("M:/- POLSKA/08 - KAMAPANIE/2026/raport.docx", "2026-09-03 10:00"); // "Tylko grafiki" ma go odciac

dbg.setIndex({ assets: rows, built_at: "t1" });

// 3. "Tylko grafiki" (w pomocniku zaznaczone, jak u wlasciciela): w drzewie PREZENTACJE nie odcina plikow folderu,
//    poza nim dziala jak dotad
const base = dbg.baseFilteredAssets({});
const baseIds = new Set(base.map((a) => a.id));
for (const a of [sNew, kMain, projMain, dat, looseA]) if (!baseIds.has(a.id)) fail("prezentacja odcieta przez Tylko grafiki: " + a.name);
for (const a of rows.filter((x) => /xlsx|docx|tif$/.test(x.name) && x.path.indexOf("PREZENTACJE/") !== -1 && x.path.indexOf("SZABLON") === -1 && x.path.indexOf("_robocze") === -1)) {
  if (!baseIds.has(a.id)) fail("dokument folderu prezentacji odciety przez Tylko grafiki: " + a.name);
}
if (baseIds.has(outDoc.id)) fail("Tylko grafiki ma dalej odcinac dokumenty POZA drzewem PREZENTACJE");
for (const a of rows) {
  if ((a.path.indexOf("_robocze") !== -1 || a.path.indexOf("SZABLON") !== -1 || /\/(~\$|Thumbs\.db)/.test(a.path)) && baseIds.has(a.id)) fail("katalog techniczny lub smiec w siatce: " + a.path);
}

// 4. karty
const cards = dbg.groupMarketingAssets(base);
const byTitle = {};
const ids = (e) => e.assets.map((x) => x.id).sort();
const title = (e) => (e.type === "group" ? e.label : e.assets[0].name);
cards.forEach((e) => {
  if (e.presentation) byTitle[e.label] = e;
});
const presCards = cards.filter((e) => e.presentation);
const wanted = ["06.10.2026 - strategia", "24.09.2026 - KULKI z kreatyną", "24.09.2026 - KULKI z kreatyną TEST", "DATESY", "onlien", "DK - szablon prezentacji", "Projekt X", "Folder bez prezentacji", "Folder z pdf", "2021/Lidl", "2021/Kaszanka", "2021"];
const titles = presCards.map((e) => e.label).sort();
// tytul = nazwa folderu (dla zagniezdzonych: nazwa najplytszego folderu z prezentacja, nie cala sciezka)
const wantTitles = ["06.10.2026 - strategia", "24.09.2026 - KULKI z kreatyną", "24.09.2026 - KULKI z kreatyną TEST", "DATESY", "onlien", "DK - szablon prezentacji", "Projekt X", "Folder bez prezentacji", "Folder z pdf", "Lidl", "Kaszanka", "2021"].sort();
eq(titles, wantTitles, "tytuly kart prezentacji");

// strategia: dwie prezentacje, _robocze pominiete; plik glowny = nowsza po dacie pliku; druga = wariant
const strategia = byTitle["06.10.2026 - strategia"];
eq(ids(strategia), [sOld.id, sNew.id].sort(), "strategia: pliki karty (bez _robocze)");
eq(strategia.primary.id, sNew.id, "strategia: plik glowny = nowsza prezentacja");

// KULKI: plik glowny = najnowsza PREZENTACJA (nie nowszy xlsx), reszta (docx, xlsx, png, tif, 2 inne pptx) = warianty
const kul = byTitle["24.09.2026 - KULKI z kreatyną"];
eq(ids(kul), kreatynaIds.slice().sort(), "KULKI: karta ma wszystkie pliki folderu i podfolderow");
eq(kul.primary.id, kMain.id, "KULKI: plik glowny = najnowsza prezentacja mimo nowszego xlsx");
eq(kul.assets.length - 1, kreatynaIds.length - 1, "KULKI: liczba wariantow");
// pozostale prezentacje sa wariantami, nie osobnymi kartami
if (presCards.some((e) => e !== kul && e.assets.some((x) => x.id === kOld.id || x.id === kOrig.id))) fail("starsze prezentacje KULKI nie powinny tworzyc osobnych kart");

// TEST: osobny folder = osobna karta
eq(byTitle["24.09.2026 - KULKI z kreatyną TEST"].primary.id, tNew.id, "TEST: plik glowny");
eq(byTitle["24.09.2026 - KULKI z kreatyną TEST"].assets.length, 2, "TEST: pliki karty");

// DATESY: jedna prezentacja = karta z jednym plikiem
eq(byTitle["DATESY"].assets.length, 1, "DATESY: jeden plik");
eq(byTitle["DATESY"].primary.id, dat.id, "DATESY: plik glowny");

// luzne pliki: kazdy osobna karta, tytul = nazwa pliku bez rozszerzenia
eq(ids(byTitle["onlien"]), [looseA.id], "luzny pptx: osobna karta");
eq(ids(byTitle["DK - szablon prezentacji"]), [looseB.id], "luzny szablon: osobna karta");

// folder z podfolderami badania/copy/statystyki: jedna karta, 4 warianty
const proj = byTitle["Projekt X"];
eq(proj.primary.id, projMain.id, "Projekt X: plik glowny");
eq(proj.assets.length, 5, "Projekt X: prezentacja + 4 pliki z podfolderow");

// folder bez prezentacji: nadal jedna karta folderu, plik glowny zwykla regula (grafika, nie xlsx)
const nb = byTitle["Folder bez prezentacji"];
eq(nb.assets.length, 3, "folder bez prezentacji: jedna karta");
eq(nb.primary.name, "b.png", "folder bez prezentacji: plik glowny = najnowsza grafika (nie notatka.xlsx mimo nowszej daty)");
// folder z PDF zamiast prezentacji: plik glowny = pdf
eq(byTitle["Folder z pdf"].primary.id, pdfMain.id, "folder z pdf: plik glowny = pdf");

// kontener: karta na najplytszy podfolder z prezentacja; obrazek z podfolderu idzie do tej karty; luzny plik kontenera osobno
eq(ids(byTitle["Lidl"]).length, 2, "Lidl: pptx + obraz z podfolderu img");
eq(byTitle["Lidl"].primary.id, lidl.id, "Lidl: plik glowny");
eq(byTitle["Kaszanka"].primary.id, kasz.id, "Kaszanka: plik glowny");
eq(ids(byTitle["2021"]), [orphan.id], "kontener: plik nienalezacy do zadnego podfolderu prezentacji");

// folder programu: nigdzie
if (cards.some((e) => e.assets.some((x) => x.path.indexOf("SZABLON") !== -1))) fail("folder programu ma wypasc z kart w calosci");

// poza drzewem: zwykle grupy po folderze, bez znacznika prezentacji
const outCard = cards.find((e) => e.assets.some((x) => x.id === out1.id));
eq(ids(outCard), [out1.id, out2.id].sort(), "poza drzewem: grupa po folderze jak dotad");
if (outCard.presentation) fail("poza drzewem nie moze byc karty prezentacji");
// (archiwum domyslnie ukryte w Brandingu - grupujemy wprost, to sprawdza tylko klucz)
const arcCard = dbg.groupMarketingAssets([arc1, arc2])[0];
eq(ids(arcCard), [arc1.id, arc2.id].sort(), "archiwum SOLAR\\Prezentacje: grupa po folderze jak dotad");
if (arcCard.presentation) fail("archiwum \"Prezentacje\" to inne drzewo niz firmowe PREZENTACJE");

// kazdy plik = dokladnie jedna karta; klucze spojne z marketingGroupKey (facety "Elementy" licza to samo)
const seen = {};
cards.forEach((e) => e.assets.forEach((x) => { if (seen[x.id]) fail("plik w dwoch kartach: " + x.name); seen[x.id] = 1; }));
cards.forEach((e) => {
  const keys = new Set(e.assets.map((x) => dbg.marketingGroupKey(x)));
  if (keys.size !== 1) fail("rozne klucze w jednej karcie: " + title(e) + " " + JSON.stringify([...keys]));
});

// 5. kolejnosc: domyslnie najnowsze, a data karty prezentacji = data pliku glownego (nowszy xlsx nie podbija karty)
const ordered = dbg.sortGroupedEntriesForDisplay(cards).filter((e) => e.presentation).map((e) => e.label);
const pos = (l) => ordered.indexOf(l);
if (!(pos("24.09.2026 - KULKI z kreatyną TEST") < pos("06.10.2026 - strategia") && pos("06.10.2026 - strategia") < pos("24.09.2026 - KULKI z kreatyną") && pos("24.09.2026 - KULKI z kreatyną") < pos("DATESY"))) {
  fail("kolejnosc kart wg daty pliku glownego: " + JSON.stringify(ordered));
}

// 6. HTML karty prezentacji
const html = dbg.groupCardHtml(kul, { groupMode: "project" });
if (html.indexOf("dam-branding-card--presentation") === -1) fail("brak klasy karty prezentacji");
if (html.indexOf('data-id="' + kMain.id + '"') === -1) fail("klik karty ma otwierac plik glowny");
if (html.indexOf('dam-branding-preview-btn" data-id="' + kMain.id + '"') === -1) fail("Podglad ma otwierac plik glowny");
if (html.indexOf("data-group-ids=") === -1) fail("brak data-group-ids");
if (html.indexOf(">24.09.2026 - KULKI z kreatyną<") === -1) fail("tytul karty = nazwa folderu");
const badge = html.match(/dam-viz-card__variant-badge[^>]*>\+(\d+)</);
if (!badge || +badge[1] !== kul.assets.length - 1) fail("licznik +N = liczba wariantow (" + (kul.assets.length - 1) + "), jest " + (badge && badge[1]));
if ((html.match(/<img/g) || []).length !== 0) fail("prezentacja bez miniatury ma dostac glif typu pliku, nie obraz zastepczy z folderu");
if (html.indexOf("uil-presentation-play") === -1 || html.indexOf(">PPTX<") === -1) fail("brak glifu typu pliku PPTX");
if ((html.match(/thumb-stack__layer--/g) || []).length !== 1) fail("jedna miniatura na karcie");
if (html.indexOf("Pokaż warianty") === -1) fail("brak przycisku Pokaz warianty");
const wrapFrom = html.indexOf("dam-viz-card__indexes-wrap");
const wrap = html.slice(wrapFrom, html.indexOf("dam-viz-card__actions", wrapFrom));
const variantRows = wrap.match(/dam-viz-card__variant-item/g) || [];
if (variantRows.length !== kul.assets.length - 1) fail("lista wariantow: " + variantRows.length + " wierszy, oczekiwano " + (kul.assets.length - 1));
for (const ext of ["PPTX", "XLSX", "DOCX", "PNG", "TIF"]) if (wrap.indexOf(">" + ext + "<") === -1) fail("lista wariantow bez typu " + ext);
if (wrap.indexOf("nowy styl.pptx") !== -1) fail("plik glowny nie jest wariantem samego siebie");
if (wrap.indexOf("stary styl.pptx") === -1) fail("starsza prezentacja ma byc wariantem");
if (html.indexOf("Pokaż indeksy") !== -1) fail("karta prezentacji pokazuje warianty, nie indeksy");

// luzny plik / folder z jedna prezentacja: bez "+N" i bez listy
const htmlOne = dbg.groupCardHtml(byTitle["DATESY"], { groupMode: "project" });
if (htmlOne.indexOf("dam-viz-card__variant-badge") !== -1 || htmlOne.indexOf("show-indexes") !== -1) fail("karta z jednym plikiem: bez +N i bez listy");
if (htmlOne.indexOf("dam-branding-card--presentation") === -1 || htmlOne.indexOf(">Prezentacja<") === -1) fail("karta DATESY: klasa i podpis typu");

// karta poza drzewem: klasa prezentacji nie wycieka
const htmlOut = dbg.groupCardHtml(outCard, { groupMode: "project" });
if (htmlOut.indexOf("dam-branding-card--presentation") !== -1) fail("zwykla karta nie ma klasy prezentacji");

// 7. plik glowny: remis dat -> kolejnosc nazw; mieszanka z plikiem spoza drzewa -> zwykla regula (null)
const tie1 = Object.assign({}, kOld, { id: "x1", name: "b.pptx", mtime_ms: 5 });
const tie2 = Object.assign({}, kOld, { id: "x2", name: "a.pptx", mtime_ms: 5 });
eq(dbg.pickPrimaryPresentation([tie1, tie2]).name, "a.pptx", "remis dat: kolejnosc nazw");
if (dbg.pickPrimaryPresentation([kMain, out1]) !== null) fail("mieszanka z plikiem spoza drzewa = zwykla regula");
eq(dbg.pickPrimaryPresentation([nb1, nbDoc]).id, nb1.id, "bez prezentacji i pdf: najnowsza grafika, nie dokument");
if (dbg.pickPrimaryPresentation([nbDoc]) !== null) fail("sam dokument bez prezentacji i grafiki = zwykla regula (null)");
eq(dbg.pickPrimaryMarketing([kOld, kMain, kOrig]).id, kMain.id, "pickPrimaryMarketing przejmuje regule prezentacji");

// 8. zmiana indeksu przelicza foldery prezentacji (bez prezentacji w podfolderze karta spada do folderu najwyzszego)
dbg.setIndex({ assets: rows.filter((a) => a.id !== lidl.id), built_at: "t2" });
const imgFile = rows.find((a) => a.path.indexOf("2021/Lidl/img/slajd.png") !== -1);
eq(dbg.presentationCard(imgFile).key, "pres:2021", "bez pptx w Lidl: obraz idzie do karty kontenera");
dbg.setIndex({ assets: rows, built_at: "t3" });
eq(dbg.presentationCard(imgFile).key, "pres:2021/lidl", "z pptx w Lidl: karta podfolderu");

console.log("OK branding: karty prezentacji (" + presCards.length + " kart, tabela drzewa " + treeCases.length + " przypadkow, Tylko grafiki, kolejnosc, HTML karty)");
