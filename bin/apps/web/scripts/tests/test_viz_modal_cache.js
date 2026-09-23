/**
 * Okno produktu w Wizualizacjach (dam-viz.js): obraz hero i miniatury wariantow
 * cache-first, tak jak dam-media-preview.js. Bez ROOT most zwraca 404 na /media -
 * wtedy ma zostac obraz z pamieci podrecznej, nie "Brak miniatury".
 * Run: node apps/web/scripts/tests/test_viz_modal_cache.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var WEB = path.join(__dirname, "..", "..");
var SRC = fs.readFileSync(path.join(WEB, "assets", "js", "dam-viz.js"), "utf8").replace(/\r\n/g, "\n");

var fails = 0;
function ok(cond, label) {
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}

function grab(name) {
  var re = new RegExp("\\n  function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}\\n");
  var m = SRC.match(re);
  ok(!!m, "dam-viz.js ma funkcje " + name);
  return m ? m[0] : "";
}
function grabAssign(name) {
  var re = new RegExp("\\n  global\\." + name + " = function[\\s\\S]*?\\n  \\};\\n");
  var m = SRC.match(re);
  ok(!!m, "dam-viz.js ma global." + name);
  return m ? m[0] : "";
}

var BR = "http://127.0.0.1:8766";
function makeCtx(truthOverrides) {
  var calls = { upgrade: [], mark: [], fallback: 0 };
  var truth = {
    thumbCacheUrl: function (p, profile) {
      return BR + "/thumb-cache?path=" + encodeURIComponent(p) + "&profile=" + profile;
    },
    upgradeWhenReady: function (img, url) {
      calls.upgrade.push(url);
    },
    markPreviewSource: function (img, p) {
      calls.mark.push(p);
    },
  };
  Object.keys(truthOverrides || {}).forEach(function (k) {
    truth[k] = truthOverrides[k];
  });
  var ctx = {
    console: console,
    PLACEHOLDER_SVG: "data:image/svg+xml,PH",
    mediaPreviewUrl: function (p) {
      return p ? BR + "/media?path=" + encodeURIComponent(p) : "";
    },
    DamPreviewTruth: truth,
    __damAssocThumbFallback: function () {
      calls.fallback++;
    },
  };
  ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    grab("heroMediaUrl") +
      grab("heroCacheUrl") +
      grab("heroSourceChain") +
      grab("paintVizHero") +
      grab("variantThumbSrc") +
      grabAssign("__damVizVariantThumbError"),
    ctx
  );
  return { ctx: ctx, calls: calls };
}

function fakeImg(parent) {
  var attrs = {};
  var img = {
    parentNode: parent || { id: "stage" },
    onerror: null,
    setAttribute: function (k, v) {
      attrs[k] = String(v);
    },
    getAttribute: function (k) {
      return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null;
    },
    removeAttribute: function (k) {
      delete attrs[k];
    },
  };
  Object.defineProperty(img, "src", {
    get: function () {
      return attrs.src || "";
    },
    set: function (v) {
      attrs.src = String(v);
    },
  });
  return img;
}

var V = { path: "M:/- POLSKA/01 - PRODUKTY/x/4 - WIZKI/DK-FRONT-L.png", thumb_url: "" };

/* 1. hero: cache-first, oryginal jako podmiana, znacznik pamieci podrecznej */
var t1 = makeCtx();
var hero = fakeImg();
t1.ctx.paintVizHero(hero, V);
ok(/\/thumb-cache\?/.test(hero.src) && /profile=modal/.test(hero.src), "hero startuje z pamieci podrecznej (profil modal): " + hero.src);
ok(t1.calls.upgrade.length === 1 && /\/media\?/.test(t1.calls.upgrade[0]), "oryginal /media podmieniany przez upgradeWhenReady (tylko gdy sie wczyta)");
ok(t1.calls.mark.length === 1 && t1.calls.mark[0] === V.path, "markPreviewSource = ten sam znacznik 'Podglad z pamieci podrecznej' co modal materialu");
ok(hero.getAttribute("data-path") === V.path, "hero ma data-path");

/* 2. bez ROOT: /media 404 -> upgradeWhenReady nie podmienia (probe.onerror), hero zostaje z cache */
ok(/\/thumb-cache\?/.test(hero.src), "404 oryginalu nie rusza hero (zostaje cache, nie placeholder)");

/* 3. brak wpisu w cache: onerror -> oryginal -> placeholder (dopiero na koncu) */
var t3 = makeCtx();
var h3 = fakeImg();
t3.ctx.paintVizHero(h3, V);
h3.onerror();
ok(/\/media\?/.test(h3.src), "blad cache -> proba oryginalu /media");
h3.onerror();
ok(h3.src === "data:image/svg+xml,PH", "blad cache i oryginalu -> placeholder");
ok(h3.onerror === null, "po placeholderze onerror odpiety (bez petli)");

/* 4. thumb_url jako trzecie zrodlo */
var t4 = makeCtx();
var h4 = fakeImg();
t4.ctx.paintVizHero(h4, { path: V.path, thumb_url: "data/override.png" });
h4.onerror();
h4.onerror();
ok(h4.src === "data/override.png", "cache i /media padly -> thumb_url przed placeholderem");

/* 5. bez DamPreviewTruth.thumbCacheUrl: stare zachowanie (/media od razu) */
var t5 = makeCtx({ thumbCacheUrl: null });
var h5 = fakeImg();
t5.ctx.paintVizHero(h5, V);
ok(/\/media\?/.test(h5.src), "bez modulu cache hero laduje /media jak dawniej");
ok(t5.calls.upgrade.length === 0, "gdy start = oryginal, bez zbednego upgradeWhenReady");

/* 6. miniatury wariantow: cache-first + jedna proba /media przy bledzie */
var t6 = makeCtx();
ok(/\/thumb-cache\?/.test(t6.ctx.variantThumbSrc(V)) && /profile=grid/.test(t6.ctx.variantThumbSrc(V)), "miniatura wariantu z pamieci podrecznej (profil grid)");
var vimg = fakeImg();
vimg.src = t6.ctx.variantThumbSrc(V);
vimg.setAttribute("data-live", t6.ctx.mediaPreviewUrl(V.path));
t6.ctx.__damVizVariantThumbError(vimg);
ok(/\/media\?/.test(vimg.src) && t6.calls.fallback === 0, "blad miniatury z cache -> raz oryginal /media");
t6.ctx.__damVizVariantThumbError(vimg);
ok(t6.calls.fallback === 1, "drugi blad -> wspolny fallback (__damAssocThumbFallback)");

/* 7. wpiecie w oknie produktu (zrodlo) */
ok(/var initialHeroSrc = heroSourceChain\(first\)\[0\]/.test(SRC), "hero startowy = pierwsze zrodlo lancucha (cache)");
ok(/paintVizHero\(document\.getElementById\("damVizModalHero"\), first\)/.test(SRC), "po wstawieniu okna hero dostaje lancuch zrodel");
ok(/if \(hero\) paintVizHero\(hero, v\);/.test(SRC), "selectVariant uzywa paintVizHero");
ok(SRC.indexOf('onerror="this.src=\\\'') < 0, "hero bez inline onerror na placeholder (to dawalo 'Brak miniatury')");
ok(/__damVizVariantThumbError&&__damVizVariantThumbError\(this\)/.test(SRC), "miniatury wariantow z obsluga bledu cache");
/* lightbox z okna produktu: placeholder = to, co pokazuje hero */
var lbSrc = SRC.slice(SRC.indexOf("function vizLightboxSources"), SRC.indexOf("function openVizLightbox"));
ok(/placeholderSrc: shown && shown !== original \? shown : ""/.test(lbSrc), "lightbox: placeholder = obraz hero (cache), oryginal jako podmiana");

if (fails) {
  console.error("\n" + fails + " FAIL");
  process.exit(1);
}
console.log("OK test_viz_modal_cache.js");
