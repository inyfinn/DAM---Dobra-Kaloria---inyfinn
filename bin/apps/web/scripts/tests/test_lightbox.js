/**
 * Pelnoekranowy lightbox podgladu materialu (2.4.1, gesty dotyku 2.4.2): dwuklik na duzym obrazie
 * w #damMediaPreview otwiera dam-lightbox.js na calym oknie.
 * Run: node apps/web/scripts/tests/test_lightbox.js
 *
 * Sprawdza:
 *  - geometrie (dopasowanie contain, centrowanie/clamp przesuwania, zoom wokol kursora),
 *  - zrodlo obrazu: oryginal z /media (GIF = GIF, nie miniatura AVIF z cache),
 *  - wpiecie dwukliku w modal bez ruszania wheel/pointer z DamModalShared.bindZoom,
 *  - klucze i18n PL + EN (bez em dash, z polskimi znakami), fallback = pl.json,
 *  - tagi <link>/<script> na stronach, ktore laduja dam-media-preview.js,
 *  - CSS: tylko tokeny (bez surowego hex), przycisk zamkniecia >= 44 px, reduced motion.
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var WEB = path.join(__dirname, "..", "..");
var LB_JS = path.join(WEB, "assets", "js", "dam-lightbox.js");
var LB_CSS = path.join(WEB, "assets", "css", "dam-lightbox.css");
var MP_JS = path.join(WEB, "assets", "js", "dam-media-preview.js");

var fails = 0;
function ok(cond, label) {
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}
function near(got, want, label) {
  if (Math.abs(got - want) > 1e-6) {
    console.error("FAIL " + label + ": oczekiwano " + want + ", jest " + got);
    fails++;
  }
}

/* ---------- 1. geometria (dam-lightbox.js w vm, bez DOM) ---------- */
var sandbox = { console: console, Math: Math };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(LB_JS, "utf8"), sandbox, { filename: "dam-lightbox.js" });
var LB = sandbox.DamLightbox;
ok(LB && typeof LB.open === "function" && typeof LB.close === "function", "DamLightbox.open/close wystawione");
ok(LB && LB.isOpen() === false, "na starcie zamkniety");
var G = LB._geom;

near(G.fitScale(4000, 2000, 1000, 800), 0.25, "fit: szeroki obraz ograniczony szerokoscia");
near(G.fitScale(1000, 3000, 1200, 900), 0.3, "fit: wysoki obraz ograniczony wysokoscia");
near(G.fitScale(200, 100, 1000, 800), 5, "fit: maly obraz powiekszany jak object-fit contain");
near(G.fitScale(0, 100, 1000, 800), 1, "fit: brak wymiarow -> 1");

var c = G.clampPan(999, -999, 0.25, 4000, 2000, 1000, 800);
near(c.x, 0, "clamp: obraz na szerokosc okna -> x=0");
near(c.y, (800 - 500) / 2, "clamp: nizszy niz okno -> wysrodkowany w pionie");
var c2 = G.clampPan(100, -5000, 1, 4000, 2000, 1000, 800);
near(c2.x, 0, "clamp: lewa krawedz nie odjezdza w prawo");
near(c2.y, 800 - 2000, "clamp: dolna krawedz nie odjezdza w gore");

var z = G.zoomAt({ scale: 1, x: 0, y: 0 }, 2, 100, 50);
near(z.x, -100, "zoomAt: punkt pod kursorem stoi (x)");
near(z.y, -50, "zoomAt: punkt pod kursorem stoi (y)");
near(G.clampScale(100, 0.3), 8, "clampScale: max 800%");
near(G.clampScale(0.0001, 0.3), 0.3 * 0.25, "clampScale: min = 25% dopasowania");

/* ---------- 2. zrodlo obrazu: lightboxSourcesFor z dam-media-preview.js ---------- */
var mp = fs.readFileSync(MP_JS, "utf8");
var fnMatch = mp.match(/function lightboxSourcesFor\(a, img\) \{[\s\S]*?\n  \}/);
ok(!!fnMatch, "dam-media-preview.js ma lightboxSourcesFor");
if (fnMatch) {
  var ctx = {
    PLACEHOLDER_SVG: "data:image/svg+xml,PH",
    previewUrl: function (p, a) {
      var u = "http://127.0.0.1:8766/media?path=" + encodeURIComponent(p);
      if (/\.(psd|ai|tif)$/i.test(p)) u += "&preview=1";
      return u;
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fnMatch[0], ctx);
  var fakeImg = function (src) {
    return {
      currentSrc: src,
      getAttribute: function (k) {
        return k === "src" ? src : k === "alt" ? "alt.gif" : k === "data-path" ? "X/a.gif" : null;
      },
    };
  };
  var gif = ctx.lightboxSourcesFor(
    { path: "S:/GIFY/baner.gif", name: "baner.gif" },
    fakeImg("http://127.0.0.1:8766/thumb-cache/modal/abc.avif")
  );
  ok(/\/media\?path=/.test(gif.src) && /baner\.gif$/.test(decodeURIComponent(gif.src)), "GIF: src = oryginal /media (" + gif.src + ")");
  ok(!/preview=1/.test(gif.src), "GIF: bez &preview=1 (zostaje animowany)");
  ok(/\.avif$/.test(gif.placeholderSrc), "GIF: miniatura AVIF tylko jako placeholder do czasu wczytania");
  ok(gif.alt === "baner.gif", "alt = nazwa pliku");
  var psd = ctx.lightboxSourcesFor({ path: "S:/x/key.psd", name: "key.psd" }, fakeImg("data:image/svg+xml,PH"));
  ok(/preview=1/.test(psd.src), "PSD: oryginal przez &preview=1 (raster z mostu)");
  ok(psd.placeholderSrc === "", "placeholder SVG nie jest uzywany jako podglad");
  var noPath = ctx.lightboxSourcesFor({ name: "x.png" }, {
    currentSrc: "blob:abc",
    getAttribute: function () {
      return "";
    },
  });
  ok(noPath.src === "blob:abc", "bez sciezki: to, co hero pokazuje");
}

/* ---------- 3. wpiecie w modal ---------- */
ok(/bindOpenGesture\(thumbStage, openHeroLightbox/.test(mp), "modal: dwuklik / podwojne tkniecie na #damMediaPreviewThumb");
ok(/closest\("button, a, \.dam-viz-modal__nav/.test(mp), "modal: dwuklik na strzalkach/przyciskach ignorowany");
ok(/heroEl\.tagName !== "IMG"/.test(mp), "modal: wideo nie otwiera lightboxa (ma wlasne kontrolki)");
ok(/window\.DamLightbox\.close\(\)/.test(mp), "closeModal zamyka tez lightbox");
ok(/data-i18n-tip="preview\.thumb_tip"/.test(mp), "tooltip modalu przez klucz i18n");
ok(/data-i18n="preview\.thumb_hint"/.test(mp), "podpowiedz modalu przez klucz i18n");
ok(mp.indexOf('data-dam-tip="Scroll: powiększ/zmniejsz. Przybliżone: przeciągnij obraz.">') < 0, "stary twardy tooltip usuniety");
var shared = fs.readFileSync(path.join(WEB, "assets", "js", "dam-modal-shared.js"), "utf8");
ok(!/dblclick/.test(shared), "bindZoom (dam-modal-shared.js) nie ma wlasnego dblclick - brak kolizji");

/* ---------- 4. i18n ---------- */
var pl = JSON.parse(fs.readFileSync(path.join(WEB, "i18n", "pl.json"), "utf8"));
var en = JSON.parse(fs.readFileSync(path.join(WEB, "i18n", "en.json"), "utf8"));
var keys = [
  "preview.thumb_tip",
  "preview.thumb_hint",
  "lightbox.label",
  "lightbox.close",
  "lightbox.prev",
  "lightbox.next",
  "lightbox.hint",
  "lightbox.loading",
];
keys.forEach(function (k) {
  ok(typeof pl[k] === "string" && pl[k].length > 0, "pl.json ma " + k);
  ok(typeof en[k] === "string" && en[k].length > 0, "en.json ma " + k);
  ok(!/\u2014/.test(pl[k] || "") && !/\u2014/.test(en[k] || ""), k + ": bez em dash");
  ok(!/\uFFFD/.test(pl[k] || ""), k + ": bez U+FFFD");
});
ok(/Dwuklik: pełny ekran/.test(pl["preview.thumb_tip"]), "PL tooltip wspomina 'Dwuklik: pełny ekran'");
ok(/Double-click: full screen/.test(en["preview.thumb_tip"]), "EN tooltip wspomina 'Double-click: full screen'");
/* fallback w JS = pl.json (DamI18n w sandboxie nie istnieje -> t() zwraca fallback) */
["lightbox.label", "lightbox.close", "lightbox.prev", "lightbox.next", "lightbox.hint", "lightbox.loading"].forEach(function (k) {
  ok(LB.t(k) === pl[k], "fallback JS == pl.json dla " + k);
});
sandbox.DamI18n = {
  t: function (k) {
    return en[k] || k;
  },
};
ok(LB.t("lightbox.close") === en["lightbox.close"], "z DamI18n (EN) - tekst z en.json");

/* ---------- 5. strony ---------- */
["branding.html", "dashboard.html", "explorer.html", "visualizations.html"].forEach(function (f) {
  var h = fs.readFileSync(path.join(WEB, f), "utf8");
  var iLb = h.indexOf('src="./assets/js/dam-lightbox.js?v=2.4.2"');
  var iMp = h.indexOf("dam-media-preview.js?v=");
  ok(iLb > 0, f + ": laduje dam-lightbox.js?v=2.4.2");
  ok(h.indexOf('href="./assets/css/dam-lightbox.css?v=2.4.2"') > 0, f + ": laduje dam-lightbox.css?v=2.4.2");
  ok(iLb > 0 && iMp > iLb, f + ": dam-lightbox.js przed dam-media-preview.js");
});

/* ---------- 6. CSS ---------- */
var css = fs.readFileSync(LB_CSS, "utf8");
var cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
ok(!/#[0-9a-fA-F]{3,8}\b/.test(cssNoComments), "CSS: bez surowego hex (tylko tokeny)");
ok(/var\(--dam-dark\)/.test(css), "CSS: tlo z tokenu --dam-dark");
var btn = cssNoComments.match(/\.dam-fs-lightbox__btn \{[\s\S]*?\}/);
ok(btn && /min-width: 44px/.test(btn[0]) && /min-height: 44px/.test(btn[0]), "CSS: przyciski min 44x44");
ok(/prefers-reduced-motion: reduce/.test(css), "CSS: prefers-reduced-motion");
ok(!/\.dam-lightbox[\s{_.-]/.test(cssNoComments.replace(/\.dam-lightbox\.css/g, "")), "CSS: nie dotyka klas starego .dam-lightbox (Eksplorator)");

/* ---------- 7. lightbox: a11y w zrodle ---------- */
var lb = fs.readFileSync(LB_JS, "utf8");
ok(/"aria-modal": "true"/.test(lb) && /role: "dialog"/.test(lb), "lightbox: role=dialog + aria-modal");
ok(/k === "Escape"/.test(lb), "lightbox: Esc zamyka");
ok(/k === "Tab"/.test(lb), "lightbox: pulapka fokusu (Tab)");
ok(/, true\);/.test(lb), "lightbox: klawisze w fazie capture (modal pod spodem nie dostaje Esc)");
ok(/setAttribute\("inert"/.test(lb), "lightbox: tlo inert");
ok(/overflow = "hidden"/.test(lb), "lightbox: blokada scrolla strony");
ok(!/\u2014/.test(lb) && !/\u2014/.test(css), "bez em dash w nowych plikach");

/* ---------- 8. gesty (czyste funkcje) ---------- */
var GS = LB._gest;
ok(GS && typeof GS.isDoubleTap === "function", "DamLightbox._gest wystawione");
ok(GS.isTap({ t: 0, x: 10, y: 10 }, { t: 120, x: 14, y: 12 }), "tap: krotko i blisko");
ok(!GS.isTap({ t: 0, x: 10, y: 10 }, { t: 600, x: 10, y: 10 }), "tap: przytrzymanie to nie tap");
ok(!GS.isTap({ t: 0, x: 10, y: 10 }, { t: 100, x: 40, y: 10 }), "tap: ruch 30 px to nie tap");
ok(GS.isDoubleTap({ t: 1000, x: 100, y: 100 }, { t: 1250, x: 110, y: 105 }), "double-tap: 250 ms, 11 px");
ok(!GS.isDoubleTap({ t: 1000, x: 100, y: 100 }, { t: 1300, x: 100, y: 100 }), "double-tap: 300 ms to juz za wolno");
ok(!GS.isDoubleTap({ t: 1000, x: 100, y: 100 }, { t: 1100, x: 180, y: 100 }), "double-tap: 80 px od siebie - nie");
ok(!GS.isDoubleTap(null, { t: 1, x: 0, y: 0 }), "double-tap: bez poprzedniego - nie");
ok(GS.classifySwipe(-120, 10, 300) === 1, "swipe w lewo = nastepny (+1)");
ok(GS.classifySwipe(120, -10, 300) === -1, "swipe w prawo = poprzedni (-1)");
ok(GS.classifySwipe(-40, 0, 200) === 0, "swipe za krotki (< 60 px) = nic");
ok(GS.classifySwipe(-100, 90, 300) === 0, "swipe ukosny/pionowy = nic");
ok(GS.classifySwipe(-200, 0, 1500) === 0, "swipe za wolny (> 800 ms) = nic");

/* ---------- 9. bindOpenGesture na sztucznym elemencie (czas sterowany) ---------- */
var fakeNow = 10000;
sandbox.Date = { now: function () { return fakeNow; } };
function fakeEl() {
  var h = {};
  return {
    addEventListener: function (t, fn) { (h[t] = h[t] || []).push(fn); },
    removeEventListener: function (t, fn) { h[t] = (h[t] || []).filter(function (x) { return x !== fn; }); },
    fire: function (t, ev) {
      ev.type = t;
      ev.defaultPrevented = false;
      ev.cancelable = true;
      ev.preventDefault = function () { ev.defaultPrevented = true; };
      ev.stopPropagation = function () {};
      ev.target = ev.target || { closest: function () { return null; } };
      (h[t] || []).forEach(function (fn) { fn(ev); });
      return ev;
    },
    count: function (t) { return (h[t] || []).length; },
  };
}
function tap(el, id, x, y, dur, type) {
  el.fire("pointerdown", { pointerId: id, pointerType: type || "touch", clientX: x, clientY: y });
  fakeNow += dur || 80;
  return el.fire("pointerup", { pointerId: id, pointerType: type || "touch", clientX: x, clientY: y });
}
var opened = 0;
var el1 = fakeEl();
var unbind = LB.bindOpenGesture(el1, function () { opened++; });
tap(el1, 1, 100, 100);
fakeNow += 150;
var up2 = tap(el1, 2, 104, 102);
ok(opened === 1, "gest: dwa tkniecia < 300 ms otwieraja lightbox (opened=" + opened + ")");
ok(up2.defaultPrevented, "gest: drugie tkniecie preventDefault (bez przegladarkowego zoomu)");
fakeNow += 2000;
tap(el1, 3, 100, 100);
fakeNow += 400;
tap(el1, 4, 100, 100);
ok(opened === 1, "gest: tkniecia co 480 ms nie otwieraja");
fakeNow += 2000;
tap(el1, 5, 100, 100);
fakeNow += 100;
tap(el1, 6, 200, 100);
ok(opened === 1, "gest: tkniecia 100 px od siebie nie otwieraja");
fakeNow += 2000;
tap(el1, 7, 100, 100, 80, "mouse");
fakeNow += 100;
tap(el1, 8, 100, 100, 80, "mouse");
ok(opened === 1, "gest: mysz nie uzywa detekcji tkniec (ma dblclick)");
el1.fire("dblclick", { clientX: 100, clientY: 100 });
ok(opened === 2, "gest: dblclick mysza otwiera");
fakeNow += 2000;
/* pinch w modalu (dwa palce) nie moze byc uznany za podwojne tkniecie */
el1.fire("pointerdown", { pointerId: 11, pointerType: "touch", clientX: 100, clientY: 100 });
el1.fire("pointerdown", { pointerId: 12, pointerType: "touch", clientX: 200, clientY: 200 });
fakeNow += 60;
el1.fire("pointerup", { pointerId: 11, pointerType: "touch", clientX: 100, clientY: 100 });
el1.fire("pointerup", { pointerId: 12, pointerType: "touch", clientX: 200, clientY: 200 });
fakeNow += 100;
tap(el1, 13, 100, 100);
ok(opened === 2, "gest: dwa palce (pinch) + tkniecie nie otwieraja");
var el2 = fakeEl();
var opened2 = 0;
LB.bindOpenGesture(el2, function () { opened2++; }, { filter: function () { return false; } });
tap(el2, 1, 50, 50);
fakeNow += 100;
tap(el2, 2, 50, 50);
el2.fire("dblclick", { clientX: 50, clientY: 50 });
ok(opened2 === 0, "gest: filter=false (strzalka, brak obrazu) blokuje otwarcie");
unbind();
ok(el1.count("pointerup") === 0 && el1.count("dblclick") === 0, "gest: unbind odpina sluchacze");
ok(!/pointerdown[\s\S]{0,80}preventDefault/.test(lb.slice(lb.indexOf("function bindOpenGesture"))), "gest: bindOpenGesture nie blokuje pointerdown (zoom modalu dziala)");

/* ---------- 10. swipe w lightboxie (zrodlo) ---------- */
ok(/swipe: !!st\.nav && !isPannable\(\)/.test(lb), "lightbox: swipe tylko przy dopasowaniu (bez przyblizenia) i z nawigacja");
ok(/classifySwipe\(pe\.x - endDrag\.sx/.test(lb), "lightbox: koniec przeciagniecia klasyfikowany jako swipe");
ok(/isDoubleTap\(st\.lastTapPt, tap\)/.test(lb), "lightbox: podwojne tkniecie przez isDoubleTap");

/* ---------- 11. okno produktu (dam-viz.js) ---------- */
var vz = fs.readFileSync(path.join(WEB, "assets", "js", "dam-viz.js"), "utf8");
ok(/bindOpenGesture\(thumbStage, openVizLightbox/.test(vz), "dam-viz: gest otwarcia na miniaturze okna produktu");
ok(/window\.DamLightbox\.open\(/.test(vz), "dam-viz: DamLightbox.open");
ok(/mediaPreviewUrl\(heroPath\)/.test(vz.slice(vz.indexOf("function vizLightboxSources"))), "dam-viz: oryginal przez mediaPreviewUrl (GIF = /media)");
ok(/selectVariant\(ni\)/.test(vz), "dam-viz: nawigacja w lightboxie = selectVariant");
ok(/data-i18n-tip="preview\.thumb_tip"/.test(vz) && /data-i18n="preview\.thumb_hint"/.test(vz), "dam-viz: tooltip i podpowiedz przez i18n");
ok(vz.indexOf('data-dam-tip="Scroll: powiększ/zmniejsz. Przybliżone: przeciągnij obraz.">') < 0, "dam-viz: stary twardy tooltip usuniety");
ok(vz.indexOf("<span>Powiększ · przesuń</span>") < 0, "dam-viz: stara twarda podpowiedz usunieta");
ok(/DamLightbox\.close\(\)/.test(vz), "dam-viz: zamkniecie okna zamyka lightbox");
ok(/bindOpenGesture\(thumbStage, openHeroLightbox/.test(mp), "dam-media-preview: ten sam pomocnik gestu");
var vh = fs.readFileSync(path.join(WEB, "visualizations.html"), "utf8");
ok(vh.indexOf("dam-viz.js?v=2.4.2") > 0, "visualizations.html: dam-viz.js?v=2.4.2");
ok(vh.indexOf("dam-lightbox.js?v=2.4.2") > 0 && vh.indexOf("dam-lightbox.js") < vh.indexOf("dam-viz.js?v="), "visualizations.html: dam-lightbox.js przed dam-viz.js");
ok(/#damVizModalHero[\s\S]{0,40}touch-action: manipulation/.test(css), "CSS: hero okna produktu bez przegladarkowego zoomu na double-tap");

if (fails) {
  console.error("\n" + fails + " FAIL");
  process.exit(1);
}
console.log("OK test_lightbox.js");
