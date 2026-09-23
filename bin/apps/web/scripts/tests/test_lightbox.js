/**
 * Pelnoekranowy lightbox podgladu materialu (2.4.1): dwuklik na duzym obrazie
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
ok(/thumbStage\.addEventListener\("dblclick"/.test(mp), "modal: dwuklik na #damMediaPreviewThumb");
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
  var iLb = h.indexOf('src="./assets/js/dam-lightbox.js?v=2.4.1"');
  var iMp = h.indexOf("dam-media-preview.js?v=");
  ok(iLb > 0, f + ": laduje dam-lightbox.js?v=2.4.1");
  ok(h.indexOf('href="./assets/css/dam-lightbox.css?v=2.4.1"') > 0, f + ": laduje dam-lightbox.css?v=2.4.1");
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

if (fails) {
  console.error("\n" + fails + " FAIL");
  process.exit(1);
}
console.log("OK test_lightbox.js");
