/**
 * DAM - Visualizations gallery v4
 * Grupy po product_id, badge Multijezyczny, modal podgladu, Synology share.
 * Wymaga: dam-brand-filter.js zaladowanego PRZED tym plikiem.
 */
(function () {
  "use strict";

  var all = [];
  var filtered = [];
  var langLabels = {};
  var brandFilter = { DK: true, GC: true };
  var synologyEnabled = true;
  var showAll = false;
  var indexData = null;
  var SHOW_ALL_KEY = "dam_viz_show_all";
  var LATEST_KEY_LEGACY = "dam_viz_latest_only";
  var CARD_ZOOM_KEY = "dam_viz_card_zoom";
  var CARD_ZOOM_MIN = 65;
  var CARD_ZOOM_MAX = 350;
  var CARD_IMG_BASE_SCALE = 1.2;
  var CARD_BASE_MIN_PX = 220;

  function readCardZoomPct() {
    if (window.DamCardZoom && typeof window.DamCardZoom.readPct === "function") {
      return window.DamCardZoom.readPct();
    }
    var n = parseInt(localStorage.getItem(CARD_ZOOM_KEY) || "100", 10);
    if (isNaN(n)) n = 100;
    return Math.min(CARD_ZOOM_MAX, Math.max(CARD_ZOOM_MIN, n));
  }

  function basePreviewZoom() {
    return readCardZoomPct() / 100;
  }

  function badgeTierOpt() {
    var B = window.DamBadges;
    return {
      includeTagTiers:
        B && typeof B.getIncludeTagTiers === "function" ? B.getIncludeTagTiers() : ["primary"],
    };
  }

  function packagingTagsFrom(v) {
    if (!v) return [];
    var tg = v.tag_groups || {};
    /* Opakowanie jednostkowe (tuba/baton/…) = tag_groups.opakowanie.
       pakowanie = zbiorcze z katalogu (2F/6x) - tylko fallback. */
    if (tg.opakowanie && tg.opakowanie.length) return tg.opakowanie.slice();
    if (tg.pakowanie && tg.pakowanie.length) return tg.pakowanie.slice();
    var meta = v.product_id ? productMeta(v.product_id) : null;
    var mtg = (meta && meta.tag_groups) || {};
    if (mtg.opakowanie && mtg.opakowanie.length) return mtg.opakowanie.slice();
    if (mtg.pakowanie && mtg.pakowanie.length) return mtg.pakowanie.slice();
    return [];
  }

  var PLACEHOLDER_SVG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">' +
        '<rect fill="#f4f4f6" width="320" height="200"/>' +
        '<text x="160" y="108" text-anchor="middle" fill="#AB54DB" font-family="sans-serif" font-size="14">Brak miniatury</text>' +
      "</svg>"
    );

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function labelForLang(code) {
    if (!code) return "";
    if (window.DamLabels && typeof window.DamLabels.langLabel === "function") {
      var via = window.DamLabels.langLabel(code);
      if (via) return via;
    }
    var c = String(code).toLowerCase();
    if (c === "en" || c === "uk" || c === "gb") c = "en";
    if (c === "ukr") c = "ua";
    return langLabels[c] || langLabels[code] || String(c).toUpperCase();
  }

  /* Przy parowaniu z folderem innego jezyka (Dodaj miniature) - zgadnij kod
     jezyka z nazwy folderu/pliku, np. "...GB_DE_630369.00/DE/plik.jpg" -> de. */
  function guessLangFromPath(path) {
    var codes = Object.keys(langLabels || {});
    if (!codes.length) return "";
    var tokens = String(path || "")
      .toUpperCase()
      .split(/[\\/_\-. ]+/)
      .filter(Boolean);
    for (var i = tokens.length - 1; i >= 0; i--) {
      for (var j = 0; j < codes.length; j++) {
        if (tokens[i] === codes[j].toUpperCase()) return codes[j];
      }
    }
    return "";
  }

  function carrierHuman(carrier, item) {
    // UI: pelna nazwa (DOYPACK). Skrot DOY tylko na dysku przy rename.
    if (!window.DamLabels || typeof window.DamLabels.carrierLabel !== "function") {
      return String(carrier || "").split(/\s*-\s*/)[0] || "";
    }
    var folderHint =
      (item && (item.revision_folder || item.folder || item.revisionFolder || item.path)) || "";
    var raw = String(carrier || (item && item.carrier) || folderHint || "").trim();
    if (
      item &&
      item.carrier_label &&
      !/\d{2}[./-]\d{2}[./-]\d{2,4}/.test(item.carrier_label) &&
      item.carrier_label.indexOf(" - ") === -1
    ) {
      raw = String(item.carrier_label) + " " + raw;
    }
    if (!raw || /^(OTHER|UNKNOWN|WARIANT)$/i.test(raw)) return "";
    var code = window.DamLabels.parseCarrierCode
      ? window.DamLabels.parseCarrierCode(raw)
      : raw;
    if (code === "UNKNOWN" && window.DamLabels.matchCarrierInText) {
      code = window.DamLabels.matchCarrierInText(raw) || code;
    }
    return (
      window.DamLabels.carrierLabel(code, raw || folderHint, {
        isMix: item && (item.is_mix || item.mix),
        productName: item && (item.product_name || item.productName),
        tags: item && item.tags,
      }) || ""
    );
  }

  function showToast(msg) {
    var el = document.getElementById("damVizToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damVizToast";
      el.className = "dam-explorer-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("is-visible"); }, 3200);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(text);
    }
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Group items by product_id                                           */
  /* ------------------------------------------------------------------ */

  function groupByProduct(items) {
    var map = {};
    var order = [];
    items.forEach(function (v) {
      var pid = v.product_id || v.index_base || v.index || v.product_name || "_";
      if (!map[pid]) {
        map[pid] = { pid: pid, items: [] };
        order.push(pid);
      }
      map[pid].items.push(v);
    });
    return order.map(function (pid) {
      var g = map[pid];
      /* Show-all dolacza rewizje bez wizki - nie pozwol im byc hero karty produktu. */
      g.items = orderGroupItemsForCard(g.items);
      return g;
    });
  }

  /** Czy wiersz ma realna wizualizacje (thumb/path), nie sam folder. */
  function itemHasViz(v) {
    if (!v) return false;
    if (v.has_viz === false) return false;
    return !!(v.thumb_url || v.path);
  }

  /**
   * Hero karty w widoku Wszystko: preferuj rewizje Z wizka.
   * Kolejnosc: is_latest+thumb > thumb > has_viz > pierwszy (tylko gdy caly produkt bez wizki).
   */
  function pickCardHero(items) {
    if (!items || !items.length) return null;
    var withViz = items.filter(itemHasViz);
    if (!withViz.length) return items[0];
    var latest = withViz.filter(function (v) {
      return !!v.is_latest;
    });
    var pool = latest.length ? latest : withViz;
    var i;
    for (i = 0; i < pool.length; i++) {
      if (pool[i].thumb_url) return pool[i];
    }
    return pool[0];
  }

  /** Ustaw hero na items[0], reszte: najpierw z wizka, potem bez. */
  function orderGroupItemsForCard(items) {
    if (!items || items.length < 2) return items || [];
    var hero = pickCardHero(items);
    if (!hero) return items.slice();
    var rest = items.filter(function (v) {
      return v !== hero;
    });
    rest.sort(function (a, b) {
      var av = itemHasViz(a) ? 1 : 0;
      var bv = itemHasViz(b) ? 1 : 0;
      if (av !== bv) return bv - av;
      var al = a.is_latest ? 1 : 0;
      var bl = b.is_latest ? 1 : 0;
      if (al !== bl) return bl - al;
      var at = a.thumb_url ? 1 : 0;
      var bt = b.thumb_url ? 1 : 0;
      return bt - at;
    });
    return [hero].concat(rest);
  }

  /* ------------------------------------------------------------------ */
  /* Populuj filtr jezykow                                                */
  /* ------------------------------------------------------------------ */

  /** OFF (domyslnie) = tylko aktualne; ON = wszystkie (stare, nieaktualne, demo). */
  function readShowAll() {
    var stored = localStorage.getItem(SHOW_ALL_KEY);
    if (stored !== null && stored !== undefined && stored !== "") {
      return stored === "1" || stored === "true";
    }
    /* migracja ze starego "Tylko najnowsze" (odwrocona logika) */
    var legacy = localStorage.getItem(LATEST_KEY_LEGACY);
    if (legacy !== null && legacy !== undefined && legacy !== "") {
      return legacy === "0" || legacy === "false";
    }
    return false;
  }

  function isRealIndex(base) {
    var s = String(base || "").trim();
    if (!s) return false;
    var low = s.toLowerCase();
    if (low === "noid" || low === "pending" || low === "unknown") return false;
    if (/x/i.test(s)) return false;
    return /^\d{5,9}(?:\.\d{2})?$/.test(s);
  }

  /** Indeks z pola, folderu lub sciezki - nigdy "noid" w UI. */
  function resolveIndexBase(row) {
    if (!row) return "";
    var candidates = [
      row.index_base,
      row.index && String(row.index).split(".")[0],
      row.revision_folder,
      row.folder,
      row.path,
      row.file,
      row.rel,
    ];
    var extract =
      window.DamLabels && typeof window.DamLabels.extractIndexFromString === "function"
        ? window.DamLabels.extractIndexFromString
        : null;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (!c) continue;
      if (isRealIndex(c)) return String(c).split(".")[0];
      if (extract) {
        var got = extract(String(c));
        if (got) return String(got).split(".")[0];
      }
      var plain = String(c).match(/(\d{6,8})/g);
      if (plain && plain.length) {
        var pick = plain[plain.length - 1];
        if (isRealIndex(pick)) return pick;
      }
    }
    return "";
  }

  function displayIndex(row) {
    var base = resolveIndexBase(row);
    return base || "";
  }

  function thumbStem(pid, indexBase, lang) {
    var p = String(pid || "p").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96).toLowerCase();
    var raw = isRealIndex(indexBase) ? String(indexBase) : "pending";
    var base = raw.replace(/[^0-9A-Za-z]+/g, "") || "pending";
    var lg = String(lang || "xx").toLowerCase().replace(/[^a-z0-9]+/g, "") || "xx";
    return "data/thumbs/" + p + "__" + base + "_" + lg + ".jpg";
  }

  /**
   * Sciezka pliku wizki zgodna z miniatura (jak pick_thumb_file w build-file-index):
   * FRONT-S > S-SKLEP > FRONT-L/XL > inne. NIE bierz pierwszego alfabetycznie
   * (to czesto FRONT-L.jpg) - Folder Windows musi wskazywac ten sam rozmiar co hero.
   */
  function firstWizkiPath(rev) {
    var wizki = rev && rev.wizki ? rev.wizki : [];
    var imgs = [];
    for (var i = 0; i < wizki.length; i++) {
      var f = wizki[i];
      var ext = String((f && f.ext) || "").toLowerCase();
      if (["jpg", "jpeg", "png", "webp", "gif"].indexOf(ext) !== -1) imgs.push(f);
    }
    if (!imgs.length) {
      return (wizki[0] && (wizki[0].path || wizki[0].rel)) || (rev && rev.path) || "";
    }
    var carrierU = String((rev && (rev.carrier || rev.carrier_code)) || "")
      .toUpperCase()
      .replace(/\s+/g, "");
    var preferFrontL = carrierU.indexOf("KAR6X") !== -1 || carrierU.indexOf("KARTON6X") !== -1;
    function tier(name) {
      var n = String(name || "")
        .toUpperCase()
        .replace(/\u0141/g, "L")
        .replace(/\u0142/g, "L");
      var isEnface = n.indexOf("ENFACE") !== -1 && n.indexOf("TYL") === -1;
      var isFrontToken = n.indexOf("FRONT") !== -1;
      var isFront = isFrontToken || isEnface;
      var isSklep = n.indexOf("SKLEP") !== -1;
      var isXl = /[-_]XL\b/.test(n) || n.indexOf("XL.") !== -1;
      var isFrontL = /FRONT[-_]?L\b/.test(n) || (isFrontToken && /[-_]L\./.test(n) && !isXl);
      var isFrontS =
        isFront &&
        !isSklep &&
        !isXl &&
        (n.indexOf("FRONT-S") !== -1 ||
          n.indexOf("ENFACE-S") !== -1 ||
          /(?:FRONT|ENFACE)[-_]?S\b/.test(n) ||
          /[-_]S\./.test(n));
      /* HARD: KAR6X prefers FRONT-L over ENFACE */
      if (preferFrontL && isFrontL && !isEnface) return 0;
      if (preferFrontL && isEnface) return 4;
      if (isFrontS) return preferFrontL ? 1 : 0;
      if (isFront && isSklep && !isXl) return 2;
      if (isFront && (isXl || isFrontL)) return 3;
      if (isFront) return 4;
      if (n.indexOf("PREV") !== -1 || n.indexOf("WIZKA") !== -1 || n.indexOf("WIZ_") !== -1) return 5;
      if (n.indexOf("TYL") !== -1 || n.indexOf("BACK") !== -1) return 7;
      return 6;
    }
    var best = 99;
    imgs.forEach(function (f) {
      var t = tier(f.name);
      if (t < best) best = t;
    });
    var pool = imgs.filter(function (f) {
      return tier(f.name) === best;
    });
    pool.sort(function (a, b) {
      var ae = String(a.ext || "").toLowerCase();
      var be = String(b.ext || "").toLowerCase();
      var at = ae === "png" || ae === "webp" ? 1 : 0;
      var bt = be === "png" || be === "webp" ? 1 : 0;
      return bt - at;
    });
    var pick = pool[0] || imgs[0];
    return pick.path || pick.rel || "";
  }

  function normalizeVizRow(v) {
    if (!v) return v;
    var base = resolveIndexBase(v);
    if (base) {
      v.index_base = base;
      if (!v.index || String(v.index).toLowerCase().indexOf("noid") !== -1) {
        v.index = base + ".00";
      }
      if (v.thumb_url && String(v.thumb_url).indexOf("__noid_") !== -1) {
        v.thumb_url = thumbStem(v.product_id, base, v.lang || "pl");
      }
    } else if (v.index_base && !isRealIndex(v.index_base)) {
      v.index_base = "";
    }
    return v;
  }

  function enrichVizRowFromProducts(data, row) {
    /* Re-pick wizki path with carrier-aware rule (KAR6X -> FRONT-L). */
    var v = Object.assign({}, row);
    var pid = v.product_id;
    var ib = resolveIndexBase(v);
    var prod = (data.products || []).find(function (p) {
      return p.id === pid;
    });
    if (prod) {
      var rev =
        (prod.revisions || []).find(function (r) {
          return String(r.index_base || "") === String(ib || "") || String(r.index || "") === String(v.index || "");
        }) ||
        (prod.revisions || []).find(function (r) {
          return r.is_latest;
        });
      if (rev) {
        if (!v.carrier) v.carrier = rev.carrier;
        v.revision_path = rev.path || v.revision_path;
        v.revision_folder = rev.folder || v.revision_folder;
        if (rev.wizki && rev.wizki.length) {
          var picked = firstWizkiPath(rev);
          if (picked) {
            v.path = picked;
            var pickedBase = String(picked).replace(/\\/g, "/").split("/").pop() || "";
            if (pickedBase) {
              v.file = pickedBase;
              v.rel = pickedBase;
            }
            /* Stary data/thumbs/*.jpg moze byc z ENFACE - karta musi trafic w FRONT. */
            v.thumb_url = mediaPreviewUrl(picked) || v.thumb_url;
          }
        }
        if (Array.isArray(rev.langs) && rev.langs.length) {
          v.langs = rev.langs
            .map(function (lg) {
              return window.DamLabels && DamLabels.normalizeLangCode
                ? DamLabels.normalizeLangCode(lg)
                : String(lg || "").toLowerCase() === "gb" || String(lg || "").toLowerCase() === "uk"
                  ? "en"
                  : String(lg || "").toLowerCase();
            })
            .filter(Boolean);
        }
      }
    }
    if (v.lang === "gb" || v.lang === "uk") v.lang = "en";
    /* KAR6X: path juz FRONT-L w indeksie, ale thumb_url/file zostaly na ENFACE po patchu. */
    syncKar6xFrontThumb(v);
    return normalizeVizRow(v);
  }

  function isKar6xCarrier(v) {
    var c = String((v && (v.carrier || v.carrier_code)) || "")
      .toUpperCase()
      .replace(/\s+/g, "");
    return c.indexOf("KAR6X") !== -1 || c.indexOf("KARTON6X") !== -1;
  }

  function syncKar6xFrontThumb(v) {
    if (!v || !isKar6xCarrier(v)) return v;
    var path = String(v.path || "");
    if (!path) return v;
    var pathU = path.toUpperCase();
    if (pathU.indexOf("FRONT") === -1 || pathU.indexOf("ENFACE") !== -1) return v;
    var file = String(v.file || "");
    var rel = String(v.rel || "");
    var thumb = String(v.thumb_url || "");
    var stale =
      /ENFACE/i.test(file) ||
      /ENFACE/i.test(rel) ||
      /ENFACE/i.test(thumb) ||
      (file && path.replace(/\\/g, "/").split("/").pop().toLowerCase() !== file.toLowerCase());
    if (!stale) return v;
    var base = path.replace(/\\/g, "/").split("/").pop() || "";
    if (base) {
      v.file = base;
      if (rel && /ENFACE/i.test(rel)) v.rel = base;
    }
    v.thumb_url = mediaPreviewUrl(path) || v.thumb_url;
    return v;
  }

  function cardThumbSrc(v) {
    if (!v) return "";
    syncKar6xFrontThumb(v);
    if (v.thumb_url && String(v.thumb_url).indexOf("/media?") >= 0) return v.thumb_url;
    if (isKar6xCarrier(v) && v.path && /FRONT/i.test(v.path) && !/ENFACE/i.test(v.path)) {
      var live = mediaPreviewUrl(v.path);
      if (live) return live;
    }
    return v.thumb_url || mediaPreviewUrl(v.path) || "";
  }

  function expandVizFromProducts(data, onlyLatest) {
    if (onlyLatest) {
      return (data.viz_latest || []).map(function (v) {
        return enrichVizRowFromProducts(data, v);
      });
    }
    if (data.viz_all && data.viz_all.length) {
      return data.viz_all.map(function (v) {
        return enrichVizRowFromProducts(data, v);
      });
    }

    var labels = data.lang_labels || langLabels || {};
    var out = [];
    (data.products || []).forEach(function (p) {
      var brand = p.brand || "DK";
      var pid = p.id || "p";
      var name = p.display_name || p.name || pid;
      (p.revisions || []).forEach(function (r) {
        var wizki = r.wizki || [];
        var hasViz = wizki.length > 0 || r.wizki_count > 0;
        /* Faza 5/P2: "Pokaz wszystko" (showAll=true, onlyLatest=false) odslania
           TEZ rewizje bez wizki - plik/folder istnieje, ale brak wizualizacji.
           Domyslnie (onlyLatest=true) - jak dawniej, calkowicie pominiete. */
        if (!hasViz && onlyLatest) return;
        /* Langs z indeksu. DK ma PL z buildera (baseline). Zakaz GC=en bez dowodu. */
        var langs = (r.langs && r.langs.length) ? r.langs.slice() : [];
        langs = langs
          .map(function (lg) {
            if (window.DamLabels && typeof window.DamLabels.normalizeLangCode === "function") {
              return window.DamLabels.normalizeLangCode(lg);
            }
            var c = String(lg || "").toLowerCase();
            if (c === "gb" || c === "uk") return "en";
            return c;
          })
          .filter(Boolean);
        /* dedupe */
        langs = langs.filter(function (lg, i) { return langs.indexOf(lg) === i; });
        if (!langs.length && String(brand || "").toUpperCase() === "DK") {
          langs = ["pl"];
        }
        var langUnknown = !langs.length;
        if (langUnknown) langs = ["?"];
        var indexBase = resolveIndexBase({
          index_base: r.index_base,
          index: r.index,
          revision_folder: r.folder,
          folder: r.folder,
          path: r.path || firstWizkiPath(r),
          file: (r.wizki && r.wizki[0] && r.wizki[0].name) || "",
        });
        langs.forEach(function (lang) {
          out.push({
            product_id: pid,
            product_name: name,
            category: p.category,
            brand: brand,
            carrier: r.carrier,
            carrier_guessed: !!r.carrier_guessed,
            subcategory_slug: p.subcategory_slug,
            subcategory_label: p.subcategory_label,
            linked_products: p.linked_products,
            alias_langs: p.alias_langs,
            index: r.index || (indexBase ? indexBase + ".00" : ""),
            index_base: indexBase,
            revision_folder: r.folder,
            revision_path: r.path,
            langs: langUnknown ? [] : langs,
            lang: lang,
            lang_label:
              lang === "?"
                ? "?"
                : labels[lang] ||
                  (lang === "en" ? "Angielski" : String(lang).toUpperCase()),
            lang_unknown: langUnknown || lang === "?",
            langs_manual: !!r.langs_manual,
            path: hasViz ? (firstWizkiPath(r) || r.path || "") : (r.path || ""),
            thumb_url: hasViz ? thumbStem(pid, indexBase, lang === "?" ? "unknown" : lang) : "",
            has_viz: hasViz,
            is_latest: !!r.is_latest,
            tags: p.tags || []
          });
        });
      });
    });
    return out.length ? out : (data.viz_latest || []).slice();
  }

  function rebuildAllFromIndex() {
    if (!indexData) return;
    /* showAll OFF => tylko najnowsze/aktualne; ON => wszystkie rewizje */
    all = expandVizFromProducts(indexData, !showAll);
    if (Array.isArray(vizFlags.manual)) {
      vizFlags.manual.forEach(function (m) {
        if (m && m.path) all.push(m);
      });
    }
    populateLangFilter(all);
  }

  function populateLangFilter(items) {
    var sel = document.getElementById("vizLangFilter");
    if (!sel) return;
    var codes = {};
    items.forEach(function (v) {
      if (v.lang) codes[v.lang] = labelForLang(v.lang);
    });
    var sorted = Object.keys(codes).sort(function (a, b) {
      return codes[a].localeCompare(codes[b], "pl");
    });
    var html = '<option value="">Wszystkie języki</option>';
    sorted.forEach(function (code) {
      html += '<option value="' + esc(code) + '">' + esc(codes[code]) + "</option>";
    });
    sel.innerHTML = html;
  }

  /* ------------------------------------------------------------------ */
  /* Render modal podgladu                                                */
  /* ------------------------------------------------------------------ */

  /** Unikalne warianty w modalu: klucz = indeks + jezyk (nie powielaj tego samego). */
  /**
   * Faza 5 / P9: pasek wariantow w modalu pokazuje WSZYSTKIE powiazane warianty,
   * w tym z aliasowanego produktu DK/GC (product-aliases.json - patrz build-file-index.py
   * apply_product_aliases). "linked_products" jest juz na kazdym viz_latest wierszu.
   */
  function withAliasItems(items) {
    var first = items && items[0];
    var linked = (first && first.linked_products) || [];
    if (!linked.length) return items;
    var linkedIds = {};
    linked.forEach(function (l) {
      if (l && l.product_id) linkedIds[l.product_id] = true;
    });
    var extra = all.filter(function (v) {
      return v.product_id && linkedIds[v.product_id] && v.product_id !== first.product_id;
    });
    return extra.length ? items.concat(extra) : items;
  }

  function uniqueModalVariants(items) {
    var seen = {};
    var out = [];
    (items || []).forEach(function (v) {
      var key = [
        v.index_base || v.index || "",
        v.lang || "",
        v.path || v.thumb_url || "",
        v.file || v.name || "",
      ].join("|");
      if (seen[key]) return;
      seen[key] = true;
      out.push(v);
    });
    return out;
  }

  function shortVizFileLabel(name, idx) {
    var n = String(name || "");
    var m = n.match(/\((\d+)\)\s*\.[a-z0-9]+$/i);
    if (m) return "(" + m[1] + ")";
    var base = n.replace(/\.[a-z0-9]+$/i, "");
    if (base.length > 18) base = base.slice(0, 16) + "\u2026";
    return base || String((idx || 0) + 1);
  }

  /** Wizki z file-index dla danej rewizji (jpg/png/webp/gif). */
  function findRevisionWizki(productId, revisionPath, revisionFolder) {
    if (!indexData || !Array.isArray(indexData.products)) return [];
    var prod = null;
    for (var i = 0; i < indexData.products.length; i++) {
      if (indexData.products[i] && indexData.products[i].id === productId) {
        prod = indexData.products[i];
        break;
      }
    }
    if (!prod) return [];
    var revs = prod.revisions || [];
    function norm(p) {
      return String(p || "")
        .replace(/\\/g, "/")
        .toLowerCase();
    }
    var want = norm(revisionPath);
    var rev = null;
    for (var j = 0; j < revs.length; j++) {
      var r = revs[j];
      if (!r) continue;
      if (want && norm(r.path) === want) {
        rev = r;
        break;
      }
      if (revisionFolder && r.folder === revisionFolder) {
        rev = r;
        break;
      }
    }
    if (!rev) return [];
    var imgs = [];
    (rev.wizki || []).forEach(function (f) {
      var ext = String((f && f.ext) || "").toLowerCase();
      if (["jpg", "jpeg", "png", "webp", "gif"].indexOf(ext) !== -1) imgs.push(f);
    });
    return imgs;
  }

  /**
   * HARD: pasek wariantow pokazuje KAZDY plik z 4 - WIZKI (takze testowe nazwy
   * bez FRONT/ENFACE / Bez indeksu) - nie tylko 1 firstWizkiPath na jezyk.
   */
  /** Meta studia (jak branding media-preview): bg / persp / size z DamLabels. */
  function enrichVizStudioMeta(v) {
    if (!v) return v;
    var name = v.file || v.name || "";
    var DL = window.DamLabels;
    if (!v.bg && DL && typeof DL.vizBackground === "function") v.bg = DL.vizBackground(name);
    if (!v.bg) {
      var ext0 = String(name.split(".").pop() || "").toLowerCase();
      v.bg = ext0 === "png" || ext0 === "webp" ? "bez-tla" : "z-tlem";
    }
    if (!v.persp) {
      v.persp =
        v.perspective ||
        (DL && typeof DL.vizPerspective === "function" ? DL.vizPerspective(name) : "") ||
        "";
    }
    if (!v.size && DL && typeof DL.vizSize === "function") v.size = DL.vizSize(name) || "";
    return v;
  }

  function expandModalWizkiVariants(items) {
    var out = [];
    (items || []).forEach(function (base) {
      if (!base) return;
      var wizki = findRevisionWizki(base.product_id, base.revision_path, base.revision_folder);
      if (!wizki.length) {
        out.push(enrichVizStudioMeta(base));
        return;
      }
      wizki.forEach(function (f, fi) {
        var copy = Object.assign({}, base);
        copy.path = f.path || f.rel || base.path;
        copy.file = f.name || "";
        copy.name = f.name || "";
        copy.viz_file_label = shortVizFileLabel(f.name, fi);
        /* Kazdy plik = wlasny podglad (bridge /media), zeby strip nie pokazywal 1x tego samego thumb. */
        copy.thumb_url = mediaPreviewUrl(copy.path) || base.thumb_url || "";
        out.push(enrichVizStudioMeta(copy));
      });
    });
    return out;
  }

  /** Klucz WARIANTU PRODUKTU = jezyk + indeks (jakosc XL/L/S to osobna os). */
  function productVariantKey(v) {
    if (!v) return "";
    var idx = displayIndex(v) || String(v.index_base || v.index || "").split(".")[0] || "";
    var lang = v.lang || "";
    if (idx || lang) return lang + "|" + idx;
    return "path|" + String(v.revision_folder || v.path || "");
  }

  /** Po jednym przedstawicielu na indeks (+jezyk) - nie kazdy plik WIZKI. */
  function productVariantRepresentatives(items) {
    var map = {};
    var order = [];
    (items || []).forEach(function (v, i) {
      enrichVizStudioMeta(v);
      var key = productVariantKey(v);
      if (!key) return;
      var score = 0;
      if (v.persp === "FRONT" || v.persp === "ENFACE") score += 40;
      else if (v.persp === "BACK") score += 10;
      if (v.size === "L") score += 24;
      else if (v.size === "XL") score += 18;
      else if (v.size === "S" || v.size === "S-SKLEP") score += 8;
      if (v.bg === "z-tlem") score += 6;
      if (v.thumb_url || v.path) score += 10;
      if (!map[key]) {
        map[key] = { i: i, v: v, score: score };
        order.push(key);
        return;
      }
      if (score > map[key].score) map[key] = { i: i, v: v, score: score };
    });
    return order.map(function (k) {
      return map[k];
    });
  }

  function buildProductVariantStripHtml(items, activeIdx, ctx) {
    var reps = productVariantRepresentatives(items);
    /* HARD 2026-07-21: pokazuj strip nawet przy 1 wariancie (user). */
    if (!reps.length) return "";
    var active = items[activeIdx] || items[0];
    var activeKey = productVariantKey(active);
    /* Parity branding WARIANTY MATERIAŁU: label + thumbnail grid (indeks/jezyk). */
    return (
      '<div class="dam-media-preview__assoc dam-media-preview__assoc--variants-only dam-viz-modal__product-variants">' +
      '<div class="dam-media-preview__assoc-col dam-media-preview__assoc-col--variants">' +
      '<div class="dam-media-preview__assoc-label-row">' +
      '<span class="dam-media-preview__assoc-label">Warianty produktu</span>' +
      "</div>" +
      '<div class="dam-viz-modal__variant-strip dam-media-preview__variant-grid" role="listbox" aria-label="Warianty produktu">' +
      reps
        .map(function (rep) {
          var v = rep.v;
          var label = variantChipLabel(v, ctx);
          var thumb = v.thumb_url || (v.path ? mediaPreviewUrl(v.path) : "") || "";
          var on = productVariantKey(v) === activeKey;
          return (
            '<button type="button" class="dam-viz-modal__variant dam-media-preview__variant' +
            (on ? " is-active" : "") +
            '" data-vidx="' +
            rep.i +
            '" data-variant-key="' +
            esc(productVariantKey(v)) +
            '" data-path="' +
            esc(v.path || "") +
            '" data-thumb="' +
            esc(thumb) +
            '" aria-label="' +
            esc(variantChipTip(v)) +
            '" aria-selected="' +
            (on ? "true" : "false") +
            '">' +
            (thumb
              ? '<img class="dam-viz-modal__variant-thumb" src="' +
                esc(thumb) +
                '" alt="' +
                esc(label) +
                '" onerror="window.__damAssocThumbFallback&&__damAssocThumbFallback(this)">'
              : '<div class="dam-viz-modal__variant-placeholder dam-media-preview__variant-placeholder--noviz" title="Brak wizualizacji"><i class="uil uil-image-slash" aria-hidden="true"></i><span>Brak wizualizacji</span></div>') +
            '<span class="dam-viz-modal__variant-label">' +
            esc(label) +
            "</span></button>"
          );
        })
        .join("") +
      "</div></div></div>"
    );
  }

  function plWariantow(n) {
    if (n === 1) return "wariant";
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "warianty";
    return "wariantow";
  }

  var VARIANT_SELECT_CSS_ID = "damVizVariantSelectCss";
  /** Injected (not dam-brand.css - avoid clashing with concurrent agents on shared CSS). */
  function ensureVariantSelectCss() {
    if (document.getElementById(VARIANT_SELECT_CSS_ID)) return;
    var style = document.createElement("style");
    style.id = VARIANT_SELECT_CSS_ID;
    style.textContent =
      ".dam-viz-modal__variant{position:relative;}" +
      ".dam-viz-modal__variant.is-multi-selected{" +
      "border-color:#16a34a!important;background:#f0fdf4!important;" +
      "box-shadow:0 0 0 2px color-mix(in srgb,#16a34a 25%,transparent)!important;}" +
      ".dam-viz-modal__variant.is-multi-selected::after{" +
      'content:"\\2713";position:absolute;top:-6px;left:-6px;width:16px;height:16px;' +
      "border-radius:999px;background:#16a34a;color:#fff;font-size:10px;font-weight:700;" +
      "line-height:16px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.25);}" +
      ".dam-viz-modal__variant-selection-bar{" +
      "display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px;padding:6px 10px;" +
      "border-radius:8px;background:#f0fdf4;border:1px solid #bbf7d0;" +
      "font-size:12px;color:#166534;transition:opacity .12s ease;}" +
      ".dam-viz-modal__variant-selection-bar[hidden]{display:none;}" +
      ".dam-viz-modal__variant-selection-bar strong{font-weight:700;}" +
      ".dam-viz-modal__variant-selection-bar .geex-btn{margin-left:auto;}" +
      ".dam-viz-modal__variant-selection-bar .geex-btn + .geex-btn{margin-left:0;}";
    document.head.appendChild(style);
  }

  /** SHIFT (range) / CTRL·CMD (toggle) multi-select on the product variant strip.
   * Klik = wybierz jeden (jak dotychczas). Shift+klik = zakres od ostatniej kotwicy.
   * Ctrl/Cmd+klik = dodaj/usun pojedynczy element. "Edycja" wielu = pasek akcji
   * (kopiuj indeksy / otworz w Eksploratorze) - w DAM nie ma masowej edycji
   * wariantow produktu (tylko materialow), wiec SHIFT tutaj = multi-select + akcje,
   * nie assoc-edit popover. */
  function bindProductVariantStrip(modal, items, getActiveIdx, selectFn) {
    var strip = modal && modal.querySelector(".dam-viz-modal__variant-strip");
    if (!strip) return { sync: function () {} };
    ensureVariantSelectCss();
    var host = strip.parentNode;
    var bar = host && host.querySelector(".dam-viz-modal__variant-selection-bar");
    if (host && !bar) {
      bar = document.createElement("div");
      bar.className = "dam-viz-modal__variant-selection-bar";
      bar.hidden = true;
      host.insertBefore(bar, strip.nextSibling);
    }
    var selected = {};
    var anchorKey = null;

    function orderedButtons() {
      return Array.prototype.slice.call(strip.querySelectorAll("[data-vidx]"));
    }
    function selectedButtons() {
      return orderedButtons().filter(function (b) {
        return !!selected[b.getAttribute("data-vidx")];
      });
    }
    function paintActive() {
      var active = items[getActiveIdx()] || items[0];
      var activeKey = productVariantKey(active);
      orderedButtons().forEach(function (btn) {
        var on = (btn.getAttribute("data-variant-key") || "") === activeKey;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
    function paintSelection() {
      var picked = selectedButtons();
      var multi = picked.length > 1;
      orderedButtons().forEach(function (btn) {
        btn.classList.toggle("is-multi-selected", multi && !!selected[btn.getAttribute("data-vidx")]);
      });
      if (!bar) return;
      if (!multi) {
        bar.hidden = true;
        bar.innerHTML = "";
        return;
      }
      bar.hidden = false;
      var keys = picked.map(function (b) {
        return b.getAttribute("data-variant-key") || "";
      });
      bar.innerHTML =
        "<strong>Wybrano: " + picked.length + " " + plWariantow(picked.length) + "</strong>" +
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon" data-viz-sel-copy>' +
        '<i class="uil uil-copy" aria-hidden="true"></i> Kopiuj indeksy</button>' +
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon" data-viz-sel-explorer>' +
        '<i class="uil uil-sitemap" aria-hidden="true"></i> Otworz w Eksploratorze</button>' +
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon" data-viz-sel-clear>' +
        '<i class="uil uil-times" aria-hidden="true"></i> Wyczysc</button>';
      var copyBtn = bar.querySelector("[data-viz-sel-copy]");
      if (copyBtn) {
        copyBtn.addEventListener("click", function () {
          var text = keys.join(", ");
          var p = copyToClipboard(text);
          if (p && typeof p.then === "function") {
            p.then(
              function () { showToast("Skopiowano indeksy: " + text); },
              function () { showToast("Nie udalo sie skopiowac"); }
            );
          } else {
            showToast("Skopiowano indeksy: " + text);
          }
        });
      }
      var explorerBtn = bar.querySelector("[data-viz-sel-explorer]");
      if (explorerBtn) {
        explorerBtn.addEventListener("click", function () {
          var pid = (items[0] && items[0].product_id) || "";
          if (!pid) return;
          window.open("explorer.html?product=" + encodeURIComponent(pid), "_blank");
        });
      }
      var clearBtn = bar.querySelector("[data-viz-sel-clear]");
      if (clearBtn) {
        clearBtn.addEventListener("click", function () {
          selected = {};
          anchorKey = null;
          paintSelection();
        });
      }
    }
    orderedButtons().forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var i = parseInt(btn.getAttribute("data-vidx"), 10);
        if (isNaN(i)) return;
        var key = btn.getAttribute("data-vidx");
        var btns = orderedButtons();
        var clickedPos = btns.indexOf(btn);
        if (e.shiftKey) {
          var anchorPos = clickedPos;
          if (anchorKey != null) {
            btns.some(function (b, idx) {
              if (b.getAttribute("data-vidx") === anchorKey) {
                anchorPos = idx;
                return true;
              }
              return false;
            });
          }
          var from = Math.min(anchorPos, clickedPos);
          var to = Math.max(anchorPos, clickedPos);
          selected = {};
          for (var p = from; p <= to; p++) selected[btns[p].getAttribute("data-vidx")] = true;
          if (anchorKey == null) anchorKey = key;
        } else if (e.ctrlKey || e.metaKey) {
          if (selected[key]) delete selected[key];
          else selected[key] = true;
          anchorKey = key;
        } else {
          selected = {};
          selected[key] = true;
          anchorKey = key;
        }
        selectFn(i);
        paintActive();
        paintSelection();
      });
    });
    paintActive();
    paintSelection();
    return {
      sync: function () {
        paintActive();
        paintSelection();
      },
    };
  }

  /**
   * Studio: Tło · Perspektywa · Jakość w 3 ramkach (CSS Grid).
   * Język NIE tu - jest na chipie WARIANTU produktu (PL · indeks).
   * Opcje filtrowane do biezacego wariantu (indeks+jezyk).
   */
  function bindVizModalStudioControls(modal, items, getActiveIdx, selectFn) {
    var host = modal && modal.querySelector("#damVizModalStudio");
    var qHost = modal && modal.querySelector("#damVizModalQuality");
    if (!host || !items || !items.length) return { sync: function () {} };
    items.forEach(enrichVizStudioMeta);
    if (qHost) {
      qHost.innerHTML = "";
      qHost.hidden = true;
    }
    var PERSP_ORDER = ["ENFACE", "FRONT", "BACK", "TYL-ENFACE", "BOK", "SIDE", "TOP", "3_4", "INNE", "OTHER"];
    var SIZE_ORDER = ["XL", "L", "S", "S-SKLEP"];
    var chipCls = "dam-media-preview__studio-chip";
    var showAllFiles = false;

    function cur() {
      return items[getActiveIdx()] || items[0];
    }

    function inActiveProductVariant(it) {
      return productVariantKey(it) === productVariantKey(cur());
    }

    function uniqueKeys(pred) {
      var seen = {};
      var out = [];
      items.forEach(function (it) {
        if (!inActiveProductVariant(it)) return;
        var k = pred(it);
        if (!k || seen[k]) return;
        seen[k] = true;
        out.push(k);
      });
      return out;
    }

    function orderedPersps(list) {
      return PERSP_ORDER.filter(function (p) {
        return list.indexOf(p) >= 0;
      }).concat(
        list.filter(function (p) {
          return PERSP_ORDER.indexOf(p) < 0;
        })
      );
    }

    function orderedSizes(list) {
      return SIZE_ORDER.filter(function (s) {
        return list.indexOf(s) >= 0;
      }).concat(
        list.filter(function (s) {
          return SIZE_ORDER.indexOf(s) < 0;
        })
      );
    }

    function pickBest(state) {
      var best = -1;
      var bestScore = -1;
      var variantKey = productVariantKey(cur());
      items.forEach(function (it, i) {
        if (productVariantKey(it) !== variantKey) return;
        if (state.bg && it.bg && it.bg !== state.bg) return;
        if (state.persp && it.persp && it.persp !== state.persp) return;
        if (state.size && it.size && it.size !== state.size) return;
        var sc = 0;
        if (state.bg && it.bg === state.bg) sc += 8;
        if (state.persp && it.persp === state.persp) sc += 4;
        if (state.size && it.size === state.size) sc += 2;
        if (sc > bestScore) {
          bestScore = sc;
          best = i;
        }
      });
      if (best < 0) {
        items.forEach(function (it, i) {
          if (productVariantKey(it) !== variantKey) return;
          if (best < 0) best = i;
        });
      }
      return best >= 0 ? best : getActiveIdx();
    }

    function frameHtml(label, aria, inner) {
      if (!inner) return "";
      return (
        '<div class="dam-media-preview__studio-frame" role="group" aria-label="' +
        esc(aria) +
        '">' +
        '<span class="dam-media-preview__studio-frame-label">' +
        esc(label) +
        "</span>" +
        '<div class="dam-media-preview__studio-frame-chips">' +
        inner +
        "</div></div>"
      );
    }

    function paint() {
      var c = cur();
      var state = {
        bg: c.bg || "z-tlem",
        persp: c.persp || "",
        size: c.size || "",
      };
      var bgs = uniqueKeys(function (it) {
        return it.bg;
      });
      var persps = orderedPersps(
        uniqueKeys(function (it) {
          if (state.bg && it.bg && it.bg !== state.bg) return "";
          return it.persp;
        })
      );
      var sizes = orderedSizes(
        uniqueKeys(function (it) {
          if (state.bg && it.bg && it.bg !== state.bg) return "";
          if (state.persp && it.persp && it.persp !== state.persp) return "";
          return it.size;
        })
      );

      var bgInner = "";
      bgs.forEach(function (bg) {
        var label = bg === "bez-tla" ? "Bez tła" : "Z tłem";
        var sub = bg === "bez-tla" ? "PNG" : "JPG";
        bgInner +=
          '<button type="button" class="' +
          chipCls +
          (bg === state.bg ? " is-active" : "") +
          '" data-studio-bg="' +
          esc(bg) +
          '"><span>' +
          esc(label) +
          '</span><small>&bull;&nbsp;' +
          esc(sub) +
          "</small></button>";
      });
      var perspInner = "";
      persps.forEach(function (p) {
        perspInner +=
          '<button type="button" class="' +
          chipCls +
          (p === state.persp ? " is-active" : "") +
          '" data-studio-persp="' +
          esc(p) +
          '">' +
          esc(p) +
          "</button>";
      });
      var sizeInner = "";
      sizes.forEach(function (sz) {
        sizeInner +=
          '<button type="button" class="dam-media-preview__quality-pill' +
          (sz === state.size ? " is-active" : "") +
          '" data-studio-size="' +
          esc(sz) +
          '" aria-pressed="' +
          (sz === state.size ? "true" : "false") +
          '">' +
          esc(sz) +
          "</button>";
      });

      var frames =
        frameHtml("Tło", "Tło", bgInner) +
        frameHtml("Perspektywa", "Perspektywa", perspInner) +
        frameHtml("Jakość", "Jakość", sizeInner);

      var allPanel = "";
      if (showAllFiles && items.length > 1) {
        /* Group by Perspektywa + Tło only — quality is a horizontal variant, not a group key.
           bgSections20260721a: sections by Tło (Bez tła / Z tłem) come first, groups inside
           carry only the Perspektywa label — no interleaving, no repeated "· Z TŁEM" per tile. */
        var groups = {};
        var gOrder = [];
        items.forEach(function (it, i) {
          if (!inActiveProductVariant(it)) return;
          var gk = (it.persp || "?") + "|" + (it.bg || "?");
          if (!groups[gk]) {
            groups[gk] = [];
            gOrder.push(gk);
          }
          groups[gk].push({ it: it, i: i });
        });
        gOrder.sort(function (a, b) {
          var ap = a.split("|")[0];
          var bp = b.split("|")[0];
          var ai = PERSP_ORDER.indexOf(ap);
          var bi = PERSP_ORDER.indexOf(bp);
          if (ai < 0) ai = 999;
          if (bi < 0) bi = 999;
          return ai - bi;
        });
        var activeIdx = getActiveIdx();
        function renderGroup(gk) {
          var bits = gk.split("|");
          var perspLab = bits[0] && bits[0] !== "?" ? bits[0] : "INNE";
          var bgKey = bits[1] === "bez-tla" ? "bez-tla" : "z-tlem";
          /* allrows20260721a: one tile per quality (JPG+PNG / twin paths share XL/L/S). */
          var bySize = {};
          var sizeOrderKeys = [];
          groups[gk].forEach(function (row) {
            var sk = row.it.size || "Plik";
            if (!bySize[sk]) {
              bySize[sk] = row;
              sizeOrderKeys.push(sk);
              return;
            }
            var prev = bySize[sk];
            if (row.i === activeIdx) {
              bySize[sk] = row;
              return;
            }
            if (prev.i === activeIdx) return;
            var pScore =
              (prev.it.thumb_url || prev.it.path ? 2 : 0) +
              (String(prev.it.path || "").toLowerCase().indexOf(".png") >= 0 ? 1 : 0);
            var nScore =
              (row.it.thumb_url || row.it.path ? 2 : 0) +
              (String(row.it.path || "").toLowerCase().indexOf(".png") >= 0 ? 1 : 0);
            if (nScore > pScore || (nScore === pScore && row.i < prev.i)) bySize[sk] = row;
          });
          sizeOrderKeys.sort(function (sa, sb) {
            var ia = SIZE_ORDER.indexOf(sa);
            var ib = SIZE_ORDER.indexOf(sb);
            if (ia < 0) ia = 999;
            if (ib < 0) ib = 999;
            return ia - ib;
          });
          var cards = sizeOrderKeys
            .map(function (sk) {
              var row = bySize[sk];
              var it = row.it;
              var on = row.i === activeIdx;
              var thumb = it.thumb_url || (it.path ? mediaPreviewUrl(it.path) : "") || "";
              var lab = it.size || "Plik";
              return (
                '<button type="button" class="dam-media-preview__all-file' +
                (on ? " is-active" : "") +
                '" data-all-vidx="' +
                row.i +
                '">' +
                (thumb
                  ? '<img src="' +
                    esc(thumb) +
                    '" alt="" loading="lazy" onerror="window.__damAssocThumbFallback&&__damAssocThumbFallback(this)">'
                  : '<span class="dam-media-preview__all-file-ph"></span>') +
                '<span class="dam-media-preview__all-file-label">' +
                esc(lab) +
                "</span></button>"
              );
            })
            .join("");
          return (
            '<div class="dam-media-preview__all-group" data-bg="' +
            bgKey +
            '"><div class="dam-media-preview__all-group-label">' +
            esc(perspLab) +
            '</div><div class="dam-media-preview__all-group-grid">' +
            cards +
            "</div></div>"
          );
        }
        function renderSection(order, label, key) {
          if (!order.length) return "";
          return (
            '<section class="dam-media-preview__all-section dam-media-preview__all-section--' +
            key +
            '"><h5 class="dam-media-preview__all-section-label">' +
            esc(label) +
            '</h5><div class="dam-media-preview__all-section-grid">' +
            order.map(renderGroup).join("") +
            "</div></section>"
          );
        }
        var bezOrder = gOrder.filter(function (gk) {
          return gk.split("|")[1] === "bez-tla";
        });
        var zTlemOrder = gOrder.filter(function (gk) {
          return gk.split("|")[1] !== "bez-tla";
        });
        allPanel =
          '<div class="dam-media-preview__all-files is-enter">' +
          renderSection(bezOrder, "Bez tła", "bez-tla") +
          renderSection(zTlemOrder, "Z tłem", "z-tlem") +
          "</div>";
      }

      var showAllBtn =
        items.length > 1
          ? '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-media-preview__show-all-btn" data-studio-show-all aria-expanded="' +
            (showAllFiles ? "true" : "false") +
            '"><i class="uil ' +
            (showAllFiles ? "uil-angle-up" : "uil-angle-down") +
            '" aria-hidden="true"></i><span>' +
            (showAllFiles ? "Zwiń" : "Pokaż wszystkie") +
            "</span></button>"
          : "";

      host.className =
        "dam-media-preview__studio dam-viz-modal__studio dam-media-preview__studio--tri dam-media-preview__studio--rail";
      host.innerHTML =
        '<div class="dam-media-preview__studio-frames">' +
        frames +
        "</div>" +
        showAllBtn;
      host.hidden = !frames && !showAllBtn;
      /* all-files full-width under body grid (not cramped in 30% rail) */
      var allHost = modal.querySelector("#damVizModalAllFiles");
      if (allHost) {
        allHost.innerHTML = allPanel || "";
        allHost.hidden = !allPanel;
      }
      /* Clear stuck reveal styles on rails (GSAP autoAlpha residue). */
      [".dam-viz-modal__studio-rail", ".dam-viz-modal__meta-rail"].forEach(function (sel) {
        var rail = modal.querySelector(sel);
        if (!rail || !rail.style) return;
        rail.style.removeProperty("opacity");
        rail.style.removeProperty("visibility");
      });

      function go(nextState) {
        var idx = pickBest(nextState);
        selectFn(idx);
        paint();
      }

      host.querySelectorAll("[data-studio-bg]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          go({
            bg: btn.getAttribute("data-studio-bg") || state.bg,
            persp: state.persp,
            size: state.size,
          });
        });
      });
      host.querySelectorAll("[data-studio-persp]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          go({
            bg: state.bg,
            persp: btn.getAttribute("data-studio-persp") || state.persp,
            size: state.size,
          });
        });
      });
      host.querySelectorAll("[data-studio-size]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          go({
            bg: state.bg,
            persp: state.persp,
            size: btn.getAttribute("data-studio-size") || state.size,
          });
        });
      });
      var allBtn = host.querySelector("[data-studio-show-all]");
      if (allBtn) {
        allBtn.addEventListener("click", function () {
          showAllFiles = !showAllFiles;
          paint();
        });
      }
      var allBindRoot = allHost && !allHost.hidden ? allHost : host;
      allBindRoot.querySelectorAll("[data-all-vidx]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var i = parseInt(btn.getAttribute("data-all-vidx"), 10);
          if (!isNaN(i)) selectFn(i);
          paint();
        });
      });
      /* brandComposer20260721a: Shift-minus on XL/L/S/S-SKLEP all-file tiles. */
      if (window.DamAssocEdit && typeof window.DamAssocEdit.wireStudioAllFiles === "function") {
        window.DamAssocEdit.wireStudioAllFiles(allBindRoot);
      }
    }

    paint();
    return { sync: paint };
  }

  function buildModalItems(group) {
    return expandModalWizkiVariants(uniqueModalVariants(withAliasItems((group && group.items) || []))).map(
      applyOverrideToItem
    );
  }

  /**
   * Podpis chipa wariantu w modalu: ZAWSZE skrot jezyka + indeks (nie pelna
   * nazwa jak "Wielka Brytania" - 2026-07-18). Pelna nazwa + sciezka -> tooltip,
   * patrz variantChipTip(). Przy wielu plikach WIZKI: jezyk + (1)/(2) z nazwy.
   */
  function variantChipLabel(v, ctx) {
    var short = (window.DamLabels && typeof window.DamLabels.langShort === "function"
      ? window.DamLabels.langShort(v.lang)
      : String(v.lang || "").toUpperCase()) || "";
    var idx = displayIndex(v);
    var fileBit = v.viz_file_label || "";
    if (short && idx) return short + " · " + idx;
    if (short && fileBit) return short + " · " + fileBit;
    if (fileBit && idx) return fileBit + " · " + idx;
    return short || idx || fileBit || "Aktualna";
  }

  /** Pelny tekst (aria-label / fallback) chipa wariantu: jezyk + sciezka. */
  function variantChipTip(v) {
    var langFull = v.lang_label || labelForLang(v.lang) || "";
    var parts = [];
    if (langFull) parts.push(langFull);
    if (v.revision_folder) parts.push(v.revision_folder);
    if (v.path) parts.push(v.path);
    return parts.join(" · ");
  }

  /* ------------------------------------------------------------------ */
  /* Popover wariantu: KRAJ + Sciezka + Kopiuj.                          */
  /* 2026-07-20: ZERO auto tipow (hover / DamTooltips). Tip TYLKO gdy    */
  /* user kliknie JUZ aktywna miniature drugi raz (re-click = tip).      */
  /* ------------------------------------------------------------------ */
  var variantInfoPopoverEl = null;
  var variantInfoPinned = false;
  var docClickAwayBound = false;
  var variantInfoHideTimer = null;
  var VARIANT_INFO_HIDE_MS = 1200;

  function cancelVariantInfoHide() {
    if (variantInfoHideTimer) {
      clearTimeout(variantInfoHideTimer);
      variantInfoHideTimer = null;
    }
  }

  /* Pkt 10 brief 2026-07-20: popover znika 1.2 s po zjechaniu kursora
     (z triggera LUB z popovera); najechanie na popover anuluje timer. */
  function scheduleVariantInfoHide() {
    cancelVariantInfoHide();
    variantInfoHideTimer = setTimeout(function () {
      variantInfoHideTimer = null;
      if (!variantInfoPinned) closeVariantInfoPopover();
    }, VARIANT_INFO_HIDE_MS);
  }

  function closeVariantInfoPopover() {
    cancelVariantInfoHide();
    if (variantInfoPopoverEl) {
      variantInfoPopoverEl.remove();
      variantInfoPopoverEl = null;
    }
    variantInfoPinned = false;
  }

  function variantInfoHtml(v) {
    var short =
      (window.DamLabels && typeof window.DamLabels.langShort === "function"
        ? window.DamLabels.langShort(v.lang)
        : String(v.lang || "").toUpperCase()) || "?";
    var full = v.lang_label || labelForLang(v.lang) || "";
    var path = v.path || v.revision_path || "";
    var html =
      '<div class="dam-variant-info__head">' +
      '<span class="dam-variant-info__country">' +
      esc(short) +
      "</span>" +
      (full ? '<span class="dam-variant-info__country-full">' + esc(full) + "</span>" : "") +
      "</div>";
    if (path) {
      html +=
        '<div class="dam-variant-info__path-label">Sciezka:</div>' +
        '<div class="dam-variant-info__path">' +
        esc(path) +
        "</div>" +
        '<button type="button" class="dam-variant-info__copy" data-copy-path="' +
        esc(path) +
        '"><i class="uil uil-copy" aria-hidden="true"></i><span>Kopiuj sciezke</span></button>';
    } else {
      html += '<div class="dam-variant-info__path-label">Brak sciezki dla tego wariantu</div>';
    }
    return html;
  }

  function positionPopoverNear(anchorEl, popEl) {
    var rect = anchorEl.getBoundingClientRect();
    var pw = Math.min(popEl.offsetWidth || 300, window.innerWidth - 24);
    var left = rect.left + rect.width / 2 - pw / 2;
    var maxLeft = window.innerWidth - pw - 12;
    if (left > maxLeft) left = maxLeft;
    if (left < 12) left = 12;
    var ph = popEl.offsetHeight || 90;
    var top = rect.bottom + 8;
    if (top + ph + 12 > window.innerHeight) top = rect.top - ph - 8;
    if (top < 8) top = 8;
    popEl.style.left = Math.round(left) + "px";
    popEl.style.top = Math.round(top) + "px";
  }

  function openVariantInfoPopover(anchorEl, v, pinned) {
    if (!v) return;
    closeVariantInfoPopover();
    var pop = document.createElement("div");
    pop.id = "damVariantInfoPopover";
    pop.className = "dam-variant-info-popover";
    pop.innerHTML = variantInfoHtml(v);
    document.body.appendChild(pop);
    variantInfoPopoverEl = pop;
    variantInfoPinned = !!pinned;
    positionPopoverNear(anchorEl, pop);
    var copyBtn = pop.querySelector("[data-copy-path]");
    if (copyBtn) {
      copyBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        copyToClipboard(copyBtn.getAttribute("data-copy-path") || "").then(
          function () {
            showToast("Skopiowano sciezke do schowka");
          },
          function () {
            showToast("Nie udalo sie skopiowac");
          }
        );
      });
    }
    pop.addEventListener("mouseenter", cancelVariantInfoHide);
    pop.addEventListener("mouseleave", function () {
      if (!variantInfoPinned) scheduleVariantInfoHide();
    });
    if (!docClickAwayBound) {
      docClickAwayBound = true;
      document.addEventListener(
        "click",
        function (e) {
          if (!variantInfoPopoverEl) return;
          if (variantInfoPopoverEl.contains(e.target)) return;
          if (e.target.closest && e.target.closest(".dam-viz-modal__variant")) return;
          closeVariantInfoPopover();
        },
        true
      );
    }
  }

  function mediaPreviewUrl(indexPath) {
    if (!indexPath) return "";
    var local =
      window.DamPaths && typeof window.DamPaths.toLocal === "function"
        ? window.DamPaths.toLocal(indexPath)
        : indexPath;
    var bridge =
      (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function" && window.DamPaths.bridgeUrl()) ||
      "http://127.0.0.1:8766";
    return bridge + "/media?path=" + encodeURIComponent(local);
  }

  /**
   * Modal hero = pelna rozdzielczosc z dysku przez most /media (bez rekompresji).
   * data/thumbs/*.jpg (max 480px, JPEG q85) tylko na kartach siatki - NIE w modalu.
   * thumb_url uzywamy gdy juz jest /media?... (override) albo gdy brak path.
   */
  function heroMediaUrl(v) {
    if (!v) return "";
    var full = mediaPreviewUrl(v.path);
    if (full) return full;
    var t = v.thumb_url ? String(v.thumb_url) : "";
    if (t && t.indexOf("/media?") >= 0) return t;
    return t;
  }

  var THUMB_OVERRIDES_KEY = "dam_thumb_overrides";
  var ADMIN_KEY = "dam_admin_mode";
  var VIZ_FLAGS_KEY = "dam_viz_flags";
  var vizFlags = { demo: {}, hidden: {}, manual: [] };

  function isAdminRole() {
    var role =
      (window.DamApi && typeof window.DamApi.role === "function" && window.DamApi.role()) ||
      localStorage.getItem("dam_role") ||
      "";
    return String(role).toLowerCase() === "admin";
  }

  function isAdminMode() {
    return isAdminRole() && localStorage.getItem(ADMIN_KEY) === "1";
  }

  function bridgeBase() {
    return (
      (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function" && window.DamPaths.bridgeUrl()) ||
      "http://127.0.0.1:8766"
    );
  }

  function loadVizFlags() {
    try {
      var local = JSON.parse(localStorage.getItem(VIZ_FLAGS_KEY) || "{}") || {};
      vizFlags = {
        demo: local.demo || {},
        hidden: local.hidden || {},
        manual: Array.isArray(local.manual) ? local.manual : [],
      };
    } catch (e) {
      vizFlags = { demo: {}, hidden: {}, manual: [] };
    }
  }

  function persistVizFlags() {
    localStorage.setItem(VIZ_FLAGS_KEY, JSON.stringify(vizFlags));
  }

  function flagKey(v) {
    return [v.product_id || "", v.index_base || v.index || "", v.lang || ""].join("|");
  }

  function isDemo(v) {
    return !!(vizFlags.demo && vizFlags.demo[flagKey(v)]);
  }

  function hideKey(v) {
    /* Ukrycie dotyczy calego kafelka produktu, nie pojedynczego jezyka */
    return (v && v.product_id) || flagKey(v);
  }

  function isHidden(v) {
    if (!vizFlags.hidden || !v) return false;
    var pid = v.product_id || "";
    if (pid && vizFlags.hidden[pid]) return true;
    if (vizFlags.hidden[flagKey(v)]) return true;
    if (pid) {
      return Object.keys(vizFlags.hidden).some(function (k) {
        return k.indexOf(pid + "|") === 0;
      });
    }
    return false;
  }

  function setHidden(v, on) {
    if (!v) return;
    var pid = hideKey(v);
    if (v.product_id && vizFlags.hidden) {
      Object.keys(vizFlags.hidden).forEach(function (k) {
        if (k.indexOf(v.product_id + "|") === 0) delete vizFlags.hidden[k];
      });
    }
    setFlag("hidden", pid, on);
  }

  function postVizFlag(payload) {
    return fetch(bridgeBase() + "/viz-flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return { ok: false };
      });
  }

  function setFlag(kind, key, on) {
    if (!vizFlags[kind] || Array.isArray(vizFlags[kind])) return;
    if (on) vizFlags[kind][key] = true;
    else delete vizFlags[kind][key];
    persistVizFlags();
    postVizFlag({ action: kind, key: key, value: !!on, flags: vizFlags });
  }

  function loadThumbOverrides() {
    try {
      return JSON.parse(localStorage.getItem(THUMB_OVERRIDES_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function saveThumbOverride(productId, payload) {
    if (!productId) return;
    var allOv = loadThumbOverrides();
    allOv[productId] = payload;
    localStorage.setItem(THUMB_OVERRIDES_KEY, JSON.stringify(allOv));
    /* Persist w apps/web/data (repo) przez most - NIE na Marketing */
    fetch(bridgeBase() + "/thumb-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: productId,
        path: payload.path || "",
        file: payload.file || "",
        thumb_url: payload.thumb_url || "",
      }),
    }).catch(function () {
      /* localStorage zostaje */
    });
  }

  function hasThumbOverride(productId) {
    if (!productId) return false;
    var allOv = loadThumbOverrides();
    return !!(allOv && allOv[productId] && (allOv[productId].path || allOv[productId].thumb_url));
  }

  function clearThumbOverride(productId) {
    if (!productId) return;
    var allOv = loadThumbOverrides();
    delete allOv[productId];
    localStorage.setItem(THUMB_OVERRIDES_KEY, JSON.stringify(allOv));
    fetch(bridgeBase() + "/thumb-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, clear: true }),
    }).catch(function () {
      /* localStorage wyczyszczony lokalnie */
    });
  }

  function countManualForProduct(productId) {
    return (vizFlags.manual || []).filter(function (m) {
      return m && m.product_id === productId;
    }).length;
  }

  function removeLastManual(productId) {
    var arr = vizFlags.manual || [];
    for (var i = arr.length - 1; i >= 0; i--) {
      if (arr[i] && arr[i].product_id === productId) {
        var removed = arr.splice(i, 1)[0];
        persistVizFlags();
        postVizFlag({ action: "manual_remove", entry: removed, flags: vizFlags });
        all = all.filter(function (x) {
          return !(x.manual && x.product_id === productId && x.path === removed.path);
        });
        return removed;
      }
    }
    return null;
  }

  function folderDirFromPath(filePath) {
    var p = String(filePath || "").replace(/\\/g, "/");
    var i = p.lastIndexOf("/");
    return i > 0 ? p.slice(0, i) : p;
  }

  /* Generyczny picker folderu/pliku - startuje w startDir, ale admin moze
     nawigowac gore/w dol (potrzebne przy parowaniu z folderem INNEGO jezyka,
     2026-07-18). Native dialog (desktop) i tak pozwala na dowolna nawigacje;
     to dotyczy glownie fallback-grid w przegladarce. */
  function openFolderPicker(startDir, onPicked) {
    var api = window.pywebview && window.pywebview.api;
    if (api && typeof api.pick_thumb === "function") {
      Promise.resolve(api.pick_thumb(startDir))
        .then(function (res) {
          if (res && res.ok && res.path) onPicked(res);
          else if (res && res.cancelled) showToast("Anulowano wybor pliku");
          else openThumbGridPicker(startDir, onPicked);
        })
        .catch(function () {
          openThumbGridPicker(startDir, onPicked);
        });
      return;
    }
    openThumbGridPicker(startDir, onPicked);
  }

  function openThumbPicker(v, onPicked) {
    openFolderPicker(folderDirFromPath(v.path || ""), onPicked);
  }

  var THUMB_PICKER_VIEW_KEY = "dam_thumb_picker_view";

  function thumbPickerIndexOf(nameOrPath) {
    if (window.DamMarketingId && typeof window.DamMarketingId.parseIndexFromPath === "function") {
      return window.DamMarketingId.parseIndexFromPath(nameOrPath);
    }
    var m = /(\d{6,7})(?:\.\d{2})?/.exec(String(nameOrPath || ""));
    return m ? m[1] : "";
  }

  function thumbPickerDateOf(f) {
    var raw = (f && (f.mtime || f.modified || f.date)) || "";
    if (!raw) return "";
    var d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw).slice(0, 10);
    return (
      String(d.getDate()).padStart(2, "0") +
      "." +
      String(d.getMonth() + 1).padStart(2, "0") +
      "." +
      d.getFullYear()
    );
  }

  function thumbPickerTagsHtml(f) {
    var tags = "";
    var idx = thumbPickerIndexOf(f.path || f.name);
    if (idx) {
      tags += '<span class="dam-viz-badge dam-viz-badge--index" title="Indeks produktu">' + esc(idx) + "</span>";
    }
    var ext = /\.([a-z0-9]{1,6})$/i.exec(String(f.name || ""));
    if (ext) {
      tags += '<span class="dam-viz-badge" title="Format pliku">' + esc(ext[1].toUpperCase()) + "</span>";
    }
    var date = thumbPickerDateOf(f);
    if (date) {
      tags += '<span class="dam-viz-badge" title="Data modyfikacji">' + esc(date) + "</span>";
    }
    return tags ? '<span class="dam-thumb-picker__item-tags">' + tags + "</span>" : "";
  }

  /* thumbPick combo: folders = list strips, files = tiles; crumbs tab inside frame. */
  function ensureThumbPickerTilesCss() {
    var TOKEN = "thumbCombo20260721b";
    var style = document.getElementById("dam-thumb-picker-tiles");
    if (!style) {
      style = document.createElement("style");
      style.id = "dam-thumb-picker-tiles";
      document.head.appendChild(style);
    }
    if (style.getAttribute("data-token") === TOKEN && style.textContent) return;
    style.setAttribute("data-token", TOKEN);
    style.textContent =
      /* Crumbs: row-gap -3px vs old 4px; current tab fully inside muted frame */
      "#damThumbPicker .dam-thumb-picker__crumbs{" +
      "flex:1 1 240px;min-width:0;display:flex;align-items:center;flex-wrap:wrap;" +
      "gap:1px 2px;row-gap:1px;column-gap:2px;" +
      "overflow:hidden;white-space:normal!important;" +
      "padding:6px 12px 8px;min-height:36px;max-height:none;box-sizing:border-box;" +
      "border:none;border-radius:12px;line-height:1.2;" +
      "background:var(--dam-surface-muted,#f5f6fa);scrollbar-width:none;}" +
      "#damThumbPicker .dam-thumb-picker__crumbs::-webkit-scrollbar{display:none;height:0;}" +
      "#damThumbPicker .dam-thumb-picker__crumb{" +
      "border:none;background:transparent;padding:2px 8px;border-radius:7px;" +
      "color:#6b6980;font-size:12px;cursor:pointer;white-space:nowrap;" +
      "min-height:24px;height:auto;line-height:1.2;box-sizing:border-box;" +
      "max-width:100%;margin:0;}" +
      "#damThumbPicker .dam-thumb-picker__crumb:hover{" +
      "background:#fff;color:var(--dam-primary,#ab54db);}" +
      "#damThumbPicker .dam-thumb-picker__crumb.is-current{" +
      "background:#fff;color:#464255;font-weight:600;cursor:default;" +
      "box-shadow:none;}" +
      "#damThumbPicker .dam-thumb-picker__crumb-sep{" +
      "color:#c3c1cc;font-size:11px;padding:0 1px;line-height:1.2;align-self:center;}" +
      "#damThumbPicker .dam-thumb-picker__nav-btn{" +
      "width:36px;height:36px;min-width:36px;min-height:36px;}" +
      /* Shared tile grid (thumbs = all tiles; tiles alias kept) */
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs]," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles]," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo]{" +
      "display:grid;background:var(--dam-surface-muted,#f5f6fa);" +
      "gap:12px;padding:16px;" +
      "grid-template-columns:repeat(auto-fill,minmax(128px,1fr));align-content:start;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item:not(.dam-thumb-picker__item--folder)," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item.dam-admin-control," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item.dam-admin-control," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item:not(.dam-thumb-picker__item--folder).dam-admin-control{" +
      "display:flex;flex-direction:column;align-items:stretch;gap:8px;" +
      "padding:10px!important;min-width:0;min-height:44px!important;" +
      "border:1px solid transparent!important;border-radius:14px!important;background:#fff!important;" +
      "box-shadow:none!important;text-align:left;overflow:hidden;box-sizing:border-box;" +
      "font-size:12px!important;color:#464255!important;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item:hover," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item:hover," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item:hover," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item.is-hover," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item.is-hover," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item.is-hover{" +
      "border-color:transparent!important;" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 6%,#fff)!important;" +
      "outline:2px solid color-mix(in srgb,var(--dam-primary,#ab54db) 28%,transparent);" +
      "outline-offset:1px;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item.is-focus," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item.is-focus," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item.is-focus," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item.is-focus{" +
      "border-color:transparent!important;" +
      "outline:3px solid rgba(171,84,219,.55)!important;outline-offset:2px;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item img," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item img," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item:not(.dam-thumb-picker__item--folder) img{" +
      "display:block;width:100%;max-width:100%;height:auto!important;aspect-ratio:1;" +
      "object-fit:contain;border-radius:10px;background:#fff;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item-tags," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item-tags{display:none;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item--folder > i," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item--folder > i," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item > i.uil-image," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item > i.uil-image," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item:not(.dam-thumb-picker__item--folder) > i.uil-image{" +
      "display:flex;align-items:center;justify-content:center;" +
      "width:100%;aspect-ratio:1;border-radius:10px;" +
      "background:var(--dam-surface-muted,#f5f6fa);font-size:36px;" +
      "color:color-mix(in srgb,var(--dam-primary,#ab54db) 55%,#8b8d97);}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__name," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__name," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item:not(.dam-thumb-picker__item--folder) .dam-thumb-picker__name{" +
      "font-size:11.5px;font-weight:600;color:#464255;line-height:1.35;" +
      "overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;" +
      "word-break:break-word;}" +
      /* LIST: all rows as strips */
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list]{" +
      "display:flex;flex-direction:column;gap:8px;" +
      "background:var(--dam-surface-muted,#f5f6fa);padding:12px 16px 16px;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item.dam-admin-control{" +
      "display:flex!important;flex-direction:row!important;align-items:center;gap:12px;" +
      "width:100%;padding:10px 14px!important;min-height:44px!important;" +
      "background:#fff!important;border:1px solid transparent!important;border-radius:12px!important;" +
      "box-shadow:none!important;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item img{" +
      "width:40px;height:40px;aspect-ratio:1;object-fit:contain;border-radius:8px;flex:0 0 auto;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item > i," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item--folder > i{" +
      "display:flex;align-items:center;justify-content:center;" +
      "width:36px;height:36px;flex:0 0 auto;aspect-ratio:auto;border-radius:8px;" +
      "background:var(--dam-surface-muted,#f5f6fa);font-size:20px;" +
      "color:color-mix(in srgb,var(--dam-primary,#ab54db) 55%,#8b8d97);}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__meta{flex:1 1 auto;min-width:0;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__name{" +
      "display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" +
      "font-size:13px;font-weight:600;-webkit-line-clamp:unset;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item:hover{" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 6%,#fff)!important;}" +
      /* COMBO: folders = full-width strips; files = tiles (default) */
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item--folder," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item--folder.dam-admin-control{" +
      "grid-column:1/-1;display:flex!important;flex-direction:row!important;align-items:center;" +
      "gap:12px;width:100%;padding:10px 14px!important;min-height:44px!important;" +
      "background:#fff!important;border:1px solid transparent!important;border-radius:12px!important;" +
      "overflow:hidden;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item--folder > i{" +
      "display:flex;align-items:center;justify-content:center;" +
      "width:36px;height:36px;flex:0 0 auto;aspect-ratio:auto!important;border-radius:8px;" +
      "background:var(--dam-surface-muted,#f5f6fa);font-size:20px;" +
      "color:color-mix(in srgb,var(--dam-primary,#ab54db) 55%,#8b8d97);}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item--folder .dam-thumb-picker__meta{" +
      "flex:1 1 auto;min-width:0;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item--folder .dam-thumb-picker__name{" +
      "display:block!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" +
      "font-size:13px;font-weight:600;line-height:1.3;" +
      "-webkit-line-clamp:unset!important;-webkit-box-orient:unset!important;}";
  }

  /* Pkt 8: #damThumbPicker mini-eksplorator. Widoki: combo (domyslny) /
     lista / miniatury. Combo = foldery lista + pliki kafelki. */
  function openThumbGridPicker(dir, onPicked) {
    ensureThumbPickerTilesCss();
    var existing = document.getElementById("damThumbPicker");
    if (existing) existing.remove();
    var view = localStorage.getItem(THUMB_PICKER_VIEW_KEY) || "combo";
    /* tiles == thumbs (legacy); migrate stale prefs to combo */
    if (view === "tiles") view = "thumbs";
    if (["combo", "list", "thumbs"].indexOf(view) < 0) view = "combo";
    var history = [];
    var histPos = -1;
    var currentPath = "";
    var currentParent = "";

    var overlay = document.createElement("div");
    overlay.id = "damThumbPicker";
    overlay.className = "dam-thumb-picker-overlay";
    overlay.style.zIndex = "12300"; /* nad nakladkami edycji ~12100 */
    overlay.innerHTML =
      '<div class="dam-thumb-picker-box" role="dialog" aria-modal="true" aria-label="Wybierz plik">' +
      '<div class="dam-thumb-picker__head"><strong>Wybierz plik</strong>' +
      '<button type="button" class="dam-viz-modal-close" id="damThumbPickerClose" aria-label="Zamknij"><i class="uil uil-times"></i></button></div>' +
      '<div class="dam-thumb-picker__toolbar">' +
      '<button type="button" class="dam-thumb-picker__nav-btn" id="damThumbPickerBack" data-dam-tip="Wstecz" aria-label="Wstecz" disabled><i class="uil uil-angle-left"></i></button>' +
      '<button type="button" class="dam-thumb-picker__nav-btn" id="damThumbPickerFwd" data-dam-tip="Dalej" aria-label="Dalej" disabled><i class="uil uil-angle-right"></i></button>' +
      '<button type="button" class="dam-thumb-picker__nav-btn" id="damThumbPickerUp" data-dam-tip="Folder wyżej" aria-label="Folder wyżej" disabled><i class="uil uil-arrow-up"></i></button>' +
      '<button type="button" class="dam-thumb-picker__nav-btn" id="damThumbPickerRefresh" data-dam-tip="Odśwież" aria-label="Odśwież"><i class="uil uil-refresh"></i></button>' +
      '<div class="dam-thumb-picker__crumbs" id="damThumbPickerCrumbs" aria-label="Ścieżka"></div>' +
      '<div class="dam-thumb-picker__views" role="group" aria-label="Widok">' +
      '<button type="button" class="dam-thumb-picker__view-btn" data-picker-view="combo" data-dam-tip="Combo: foldery lista, pliki kafelki" aria-label="Combo"><i class="uil uil-apps"></i></button>' +
      '<button type="button" class="dam-thumb-picker__view-btn" data-picker-view="list" data-dam-tip="Lista" aria-label="Lista"><i class="uil uil-list-ul"></i></button>' +
      '<button type="button" class="dam-thumb-picker__view-btn" data-picker-view="thumbs" data-dam-tip="Miniatury" aria-label="Miniatury"><i class="uil uil-table"></i></button>' +
      "</div>" +
      "</div>" +
      '<div class="dam-thumb-picker__grid" id="damThumbPickerGrid" data-view="' +
      esc(view) +
      '"><p class="dam-thumb-picker__status">Ładowanie…</p></div></div>';
    document.body.appendChild(overlay);
    try {
      localStorage.setItem(THUMB_PICKER_VIEW_KEY, view);
    } catch (eLs) {}

    var backBtn = document.getElementById("damThumbPickerBack");
    var fwdBtn = document.getElementById("damThumbPickerFwd");
    var upBtn = document.getElementById("damThumbPickerUp");
    var refreshBtn = document.getElementById("damThumbPickerRefresh");
    var crumbsEl = document.getElementById("damThumbPickerCrumbs");

    document.getElementById("damThumbPickerClose").onclick = function () {
      overlay.remove();
    };
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });

    function syncNavButtons() {
      if (backBtn) backBtn.disabled = histPos <= 0;
      if (fwdBtn) fwdBtn.disabled = histPos >= history.length - 1;
      if (upBtn) upBtn.disabled = !currentParent;
    }

    function paintCrumbs(path) {
      if (!crumbsEl) return;
      var norm = String(path || "").replace(/\\/g, "/");
      var parts = norm.split("/").filter(Boolean);
      var html = "";
      var acc = "";
      parts.forEach(function (seg, i) {
        acc += (i === 0 ? "" : "/") + seg;
        var isLast = i === parts.length - 1;
        if (i > 0) html += '<span class="dam-thumb-picker__crumb-sep" aria-hidden="true">/</span>';
        html +=
          '<button type="button" class="dam-thumb-picker__crumb' +
          (isLast ? " is-current" : "") +
          '" data-crumb-path="' +
          esc(acc + (i === 0 && /^[a-z]:$/i.test(seg) ? "/" : "")) +
          '"' +
          (isLast ? " disabled" : "") +
          ' title="' +
          esc(acc) +
          '">' +
          esc(seg) +
          "</button>";
      });
      crumbsEl.innerHTML = html || '<span class="dam-thumb-picker__crumb is-current">-</span>';
      crumbsEl.querySelectorAll("[data-crumb-path]:not([disabled])").forEach(function (btn) {
        btn.addEventListener("click", function () {
          navigateTo(btn.getAttribute("data-crumb-path"));
        });
      });
      crumbsEl.scrollLeft = crumbsEl.scrollWidth;
    }

    function folderItemHtml(f) {
      /* No dam-admin-control here: that class forces Geex pill radius 50px + purple
         stroke (!important) and crushes padding - tiles must stay square cards. */
      return (
        '<button type="button" class="dam-thumb-picker__item dam-thumb-picker__item--folder" data-open-folder="' +
        esc(f.path) +
        '" title="' +
        esc(f.path) +
        '"><i class="uil uil-folder" aria-hidden="true"></i>' +
        '<span class="dam-thumb-picker__meta"><span class="dam-thumb-picker__name">' +
        esc(f.name) +
        "</span></span>" +
        "</button>"
      );
    }

    function fileItemHtml(f) {
      var prev = mediaPreviewUrl(f.path);
      return (
        '<button type="button" class="dam-thumb-picker__item" data-path="' +
        esc(f.path) +
        '" data-file="' +
        esc(f.name) +
        '" title="' +
        esc(f.path) +
        '">' +
        (prev
          ? '<img src="' + esc(prev) + '" alt="" loading="lazy">'
          : '<i class="uil uil-image" aria-hidden="true"></i>') +
        '<span class="dam-thumb-picker__meta"><span class="dam-thumb-picker__name">' +
        esc(f.name) +
        "</span></span>" +
        thumbPickerTagsHtml(f) +
        "</button>"
      );
    }

    function loadDir(target) {
      var grid = document.getElementById("damThumbPickerGrid");
      if (grid) grid.innerHTML = '<p class="dam-thumb-picker__status">Ładowanie…</p>';
      fetch(bridgeBase() + "/folder-images?path=" + encodeURIComponent(target))
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          grid = document.getElementById("damThumbPickerGrid");
          if (!grid) return;
          if (!data || !data.ok) {
            grid.innerHTML =
              '<p class="dam-thumb-picker__status">Nie udało się otworzyć: ' +
              esc((data && data.error) || "?") +
              "</p>";
            return;
          }
          currentPath = data.path || target || "";
          currentParent = data.parent || "";
          paintCrumbs(currentPath);
          syncNavButtons();
          var folders = data.folders || [];
          var files = data.files || [];
          if (!folders.length && !files.length) {
            grid.innerHTML =
              '<p class="dam-thumb-picker__status">Folder jest pusty (brak podfolderów i obrazów).</p>';
            return;
          }
          grid.innerHTML = folders.map(folderItemHtml).join("") + files.map(fileItemHtml).join("");
          grid.querySelectorAll(".dam-thumb-picker__item").forEach(function (btn) {
            btn.addEventListener("focus", function () {
              btn.classList.add("is-focus");
            });
            btn.addEventListener("blur", function () {
              btn.classList.remove("is-focus");
            });
            btn.addEventListener("mouseenter", function () {
              btn.classList.add("is-hover");
            });
            btn.addEventListener("mouseleave", function () {
              btn.classList.remove("is-hover");
            });
          });
          grid.querySelectorAll("[data-open-folder]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              navigateTo(btn.getAttribute("data-open-folder"));
            });
          });
          grid.querySelectorAll("[data-path]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              onPicked({
                ok: true,
                path: btn.getAttribute("data-path"),
                file: btn.getAttribute("data-file"),
              });
              overlay.remove();
            });
          });
        })
        .catch(function () {
          grid = document.getElementById("damThumbPickerGrid");
          if (grid) {
            grid.innerHTML =
              '<p class="dam-thumb-picker__status">Nie udało się wczytać listy (most lokalny offline?).</p>';
          }
        });
    }

    function navigateTo(target) {
      if (!target) return;
      history = history.slice(0, histPos + 1);
      history.push(target);
      histPos = history.length - 1;
      syncNavButtons();
      loadDir(target);
    }

    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (histPos <= 0) return;
        histPos -= 1;
        syncNavButtons();
        loadDir(history[histPos]);
      });
    }
    if (fwdBtn) {
      fwdBtn.addEventListener("click", function () {
        if (histPos >= history.length - 1) return;
        histPos += 1;
        syncNavButtons();
        loadDir(history[histPos]);
      });
    }
    if (upBtn) {
      upBtn.addEventListener("click", function () {
        if (currentParent) navigateTo(currentParent);
      });
    }
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        if (currentPath) loadDir(currentPath);
      });
    }
    overlay.querySelectorAll("[data-picker-view]").forEach(function (btn) {
      var v = btn.getAttribute("data-picker-view");
      btn.classList.toggle("is-active", v === view);
      btn.addEventListener("click", function () {
        view = v;
        localStorage.setItem(THUMB_PICKER_VIEW_KEY, view);
        overlay.querySelectorAll("[data-picker-view]").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        var grid = document.getElementById("damThumbPickerGrid");
        if (grid) grid.setAttribute("data-view", view);
      });
    });
    if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
      window.DamTooltips.bind(overlay);
    }
    navigateTo(dir);
  }

  function applyOverrideToItem(v) {
    if (!v) return v;
    var ov = loadThumbOverrides()[v.product_id];
    if (!ov) return v;
    var copy = Object.assign({}, v);
    if (ov.path) copy.path = ov.path;
    if (ov.thumb_url) copy.thumb_url = ov.thumb_url;
    if (ov.file) copy.file = ov.file;
    return copy;
  }

  function openProductModal(group) {
    var existing = document.getElementById("damVizModal");
    if (existing) existing.remove();

    /* buildModalItems: expand KAZDY plik z 4 - WIZKI (SZKIC (1)/(2)/(3) itd.). */
    var items = orderGroupItemsForCard(buildModalItems(group));
    var first = pickCardHero(items) || items[0];
    if (!first) return;
    /* Aktywny chip = hero z wizka (nie pierwsza rewizja bez pliku). */
    var activeIdx = Math.max(0, items.indexOf(first));
    var productName = first.product_name || first.product_id || "Produkt";
    var brand = first.brand || "DK";
    var syEnabled = localStorage.getItem("dam_synology_enabled") !== "false";
    var admin = isAdminMode();

    var langs = {};
    var indexes = {};
    items.forEach(function (v) {
      if (v.lang) langs[v.lang] = true;
      if (v.index_base || v.index) indexes[v.index_base || String(v.index).split(".")[0]] = true;
    });
    var ctx = {
      multiLang: Object.keys(langs).length > 1,
      multiIndex: Object.keys(indexes).length > 1,
    };

    /* bodyGrid20260721: WARIANTY full-width; studio frames in right rail (~30%). */
    var variantStripHtml = buildProductVariantStripHtml(items, activeIdx, ctx);
    var studioRailHtml =
      '<div class="dam-viz-modal__studio-rail">' +
      '<div id="damVizModalStudio" class="dam-media-preview__studio dam-viz-modal__studio dam-media-preview__studio--tri dam-media-preview__studio--rail" aria-label="Parametry wizualizacji"></div>' +
      '<div id="damVizModalQuality" class="dam-media-preview__quality dam-viz-modal__quality" hidden></div>' +
      "</div>";

    var modalBadges =
      window.DamBadges && typeof window.DamBadges.render === "function"
        ? window.DamBadges.render({
            brand: brand,
            category: first.category,
            subcategory: first.subcategory_slug,
            subcategoryLabel: first.subcategory_label,
            carrier: first.carrier,
            carrierLabel: carrierHuman(first.carrier || "", first),
            carrierGuessed: !!first.carrier_guessed,
            carrierPrevious: first.carrier_previous || "",
            langs: (first.langs && first.langs.length) ? first.langs : (first.lang && first.lang !== "?" ? [first.lang] : []),
            lang: first.lang,
            langLabel: first.lang_label || labelForLang(first.lang),
            langUnknown: !!(first.lang_unknown || first.lang === "?" || first.lang === "unknown"),
            index: displayIndex(first),
            showNoIndex: !displayIndex(first),
            multiLang: ctx.multiLang,
            multiIndex: ctx.multiIndex,
            demo: isDemo(first),
            mix: !!(first.is_mix || (window.DamLabels && DamLabels.isMixProduct(productName, first.tags))),
            hidden: isHidden(first) && admin,
            productName: productName,
            productId: first.product_id,
            flagKey: hideKey(first),
            tags: first.tags,
            revisionFolder: first.revision_folder,
            revisionFullPath: first.revision_path,
            showCarrierPlaceholder: true,
            maxPerKind: 4,
            overflow: true,
            packagingTags: packagingTagsFrom(first),
            includeTagTiers: badgeTierOpt().includeTagTiers,
          })
        : '<span class="dam-viz-badge dam-viz-badge--brand">' + esc(brand) + "</span>";

    var shareBtnTitle = syEnabled
      ? "Udostepnij przez Synology Drive"
      : "Wlacz Synology Drive w Ustawieniach";

    /* Faza 5 / P2: jezyki bez realnej wizki - wyszarzone + "Zglos zapotrzebowanie". */
    var fullLangSet = (first.alias_langs && first.alias_langs.length ? first.alias_langs : first.langs || []).slice();
    var presentLangs = {};
    items.forEach(function (v) {
      if (v.lang) presentLangs[v.lang] = true;
    });
    var missingLangs = fullLangSet.filter(function (lg) {
      return lg && !presentLangs[lg];
    });
    var missingLangHtml = "";
    if (missingLangs.length) {
      missingLangHtml =
        '<div class="dam-viz-modal__missing-langs">' +
        '<span class="dam-viz-modal__missing-langs-label dam-viz-modal__missing-langs-label--muted">Brak wizualizacji:</span>' +
        missingLangs
          .map(function (lg) {
            var short = (window.DamLabels && typeof window.DamLabels.langShort === "function" && DamLabels.langShort(lg)) || String(lg).toUpperCase();
            var full = labelForLang(lg);
            return (
              '<span class="dam-viz-badge dam-viz-badge--lang-missing dam-viz-badge--lang-muted" title="' +
              esc(full) +
              '">' +
              esc(short) +
              '<button type="button" class="dam-viz-missing-lang-request" data-request-lang="' +
              esc(lg) +
              '" data-request-lang-full="' +
              esc(full) +
              '" aria-label="Zglos zapotrzebowanie na ' +
              esc(full) +
              '" data-dam-tip="Zglos zapotrzebowanie na wizualizacje: ' +
              esc(full) +
              '"><i class="uil uil-bell-plus"></i></button></span>'
            );
          })
          .join("") +
        "</div>";
    }

    /* Pkt 7 brief 2026-07-20: "Dodaj miniature" TYLKO gdy produkt ma brakujaca
       wizualizacje (missing langs / wariant bez podgladu) albo istnieje juz
       reczne sparowanie (zeby dalo sie je cofnac). */
    var manualPairedN = countManualForProduct(first.product_id || "");
    var lacksViz =
      missingLangs.length > 0 ||
      items.some(function (v) {
        return !v.thumb_url && !v.path;
      });
    var showAddManual = manualPairedN > 0 || lacksViz;

    var adminActions = "";
    if (admin) {
      /* Miniatura = zmiana podgladu karty/hero (Explorer-style picker, thumb-overrides).
         Dodaj miniature = parowanie brakujacej wizualizacji z folderem innego
         jezyka/wariantu (damVizModalAddManual) - osobna akcja, nie zamiennik. */
      adminActions =
        '<div class="dam-viz-modal__actions-admin-group">' +
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-admin-control" id="damVizModalSetThumb" data-dam-tip="Wybierz plik miniatury z folderu produktu (styl Eksploratora)">' +
        '<i class="uil uil-image" aria-hidden="true"></i><span>Miniatura</span></button>' +
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-admin-control" id="damVizModalDemo" data-dam-tip="Oznacz jako Demo (zolta obwodka)">' +
        '<i class="uil uil-star" aria-hidden="true"></i><span>Demo</span></button>' +
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-admin-control" id="damVizModalHide" data-dam-tip="Ukryj kafelek dla zwyklego uzytkownika">' +
        '<i class="uil uil-eye-slash" aria-hidden="true"></i><span>Ukryj</span></button>' +
        (showAddManual
          ? '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-admin-control" id="damVizModalAddManual" data-dam-tip="Brak wizualizacji? Wskaz folder z wizualizacjami innego jezyka/wariantu i sparuj z tym produktem">' +
            '<i class="uil uil-plus" aria-hidden="true"></i><span>Dodaj miniature</span></button>'
          : "") +
        "</div>";
    }

    /* Pkt 4/7: ID marketingowe wizualizacji w formacie V-<INDEKS>-<PERSP>-<SKALA>-<MM-RR> */
    function vizModalMarketingId(v) {
      if (!window.DamMarketingId || typeof window.DamMarketingId.formatViz !== "function") return "";
      return window.DamMarketingId.formatViz({
        index:
          displayIndex(v) ||
          v.index_base ||
          (window.DamMarketingId.parseIndexFromPath ? window.DamMarketingId.parseIndexFromPath(v.path) : ""),
        persp: v.perspective || v.persp || "",
        size: v.size || "",
        date: v.mtime || "",
      });
    }
    var vizMarketingId = vizModalMarketingId(first);

    var assocColHtml =
      '<div class="dam-media-preview__assoc-col dam-media-preview__assoc-col--materials dam-viz-modal__assoc">' +
      '<div class="dam-media-preview__assoc-label-row">' +
      '<span class="dam-media-preview__assoc-label" id="damVizModalAssocLabel">Skojarzone materiały</span>' +
      "</div>" +
      '<div class="dam-media-preview__assoc-grid" id="damVizModalAssoc" role="list"></div></div>';
    var actionsHtml =
      '<div class="dam-viz-modal__actions">' +
      '<div class="dam-viz-modal__actions-main">' +
      '<button type="button" class="geex-btn geex-btn--primary geex-btn--sm dam-btn-icon dam-viz-modal__cta" id="damVizModalGoProduct" data-pid="' +
      esc(first.product_id || "") +
      '" data-dam-tip="Otwiera produkt w Eksplorerze">' +
      '<i class="uil uil-sitemap" aria-hidden="true"></i><span>Przejdź</span></button>' +
      '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-viz-modal__cta dam-win-btn" id="damVizModalWinExplorer" data-path="' +
      esc(first.path || "") +
      '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwiera Eksplorator Windows z zaznaczonym plikiem">' +
      (window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>') +
      "<span>Folder</span></button>" +
      /* --- FILE OPEN CTA (left of copy): in-app gallery when siblings exist --- */
      '<button type="button" class="dam-viz-icon-btn" id="damVizModalOpenFile" data-path="' +
      esc(first.path || "") +
      '" aria-label="Otwórz plik" title="Otwórz plik" data-dam-tip="Otwiera podgląd w aplikacji (←/→ między plikami) albo domyślną aplikację Windows">' +
      '<i class="uil uil-external-link-alt" aria-hidden="true"></i></button>' +
      '<button type="button" class="dam-viz-icon-btn" id="damVizModalCopyPath" data-path="' +
      esc(first.path || "") +
      '" aria-label="Kopiuj ścieżkę" title="Kopiuj ścieżkę" data-dam-tip="Kopiuje lokalną ścieżkę pliku">' +
      '<i class="uil uil-copy" aria-hidden="true"></i></button>' +
      '<button type="button" class="dam-viz-icon-btn' +
      (syEnabled ? "" : " is-disabled") +
      '" id="damVizModalShare" data-path="' +
      esc(first.path || "") +
      '" aria-label="Udostępnij" title="' +
      esc(shareBtnTitle) +
      '" data-dam-tip="' +
      esc(shareBtnTitle) +
      '"' +
      (syEnabled ? "" : " disabled") +
      ">" +
      '<i class="uil uil-share-alt" aria-hidden="true"></i></button>' +
      "</div>" +
      (adminActions
        ? '<div class="dam-viz-modal__actions-admin" data-dam-tip="Kontrolki administratora">' +
          adminActions +
          "</div>"
        : "") +
      "</div>";
    var bodyMetaHtml =
      '<div class="dam-viz-modal__meta-rail">' +
      '<div class="dam-viz-modal__meta-block dam-viz-modal__meta-block--badges">' +
      '<div class="dam-viz-card__badges" id="damVizModalBadges">' +
      modalBadges +
      "</div></div>" +
      '<div class="dam-viz-modal__meta-block dam-viz-modal__meta-block--title">' +
      '<h4 class="dam-viz-modal__title">' +
      esc(productName) +
      (window.DamLabels && typeof window.DamLabels.productNamePlMarkup === "function"
        ? window.DamLabels.productNamePlMarkup(productName, first.brand || brand, esc)
        : "") +
      "</h4>" +
      (vizMarketingId
        ? '<div class="dam-viz-modal__idrow"><span class="dam-viz-badge dam-viz-badge--index dam-branding-id-chip dam-viz-modal__asset-id" id="damVizModalAssetId" data-marketing-id="' +
          esc(vizMarketingId) +
          '" data-tag-value="' +
          esc(vizMarketingId) +
          '" role="button" tabindex="0" data-dam-tip="ID marketingowe: ' +
          esc(vizMarketingId) +
          ' (klik = kopiuj)" title="ID marketingowe: ' +
          esc(vizMarketingId) +
          '">' +
          esc(vizMarketingId) +
          "</span></div>"
        : "") +
      "</div>" +
      '<div class="dam-viz-modal__meta-block dam-viz-modal__meta-block--filemeta">' +
      '<div class="dam-viz-modal__filemeta" id="damVizModalFileMeta">' +
      (function () {
        var fname = "";
        if (window.DamPaths && typeof window.DamPaths.basename === "function") {
          fname = window.DamPaths.basename(first.path || "") || "";
        } else {
          var n = String(first.path || "").replace(/\\/g, "/");
          var i = n.lastIndexOf("/");
          fname = i >= 0 ? n.slice(i + 1) : n;
        }
        if (!fname && first.name) fname = String(first.name);
        var typeLine =
          (carrierHuman(first.carrier || "", first) || "BRAK TYPU") +
          (displayIndex(first) ? " · Indeks " + displayIndex(first) : "");
        var tipCarrier =
          "Nosnik / indeks biezacego wariantu. Podwojny klik lub Shift+klik: zaproponuj zmiane typu." +
          (admin ? " Admin: zmiana zostanie zapisana natychmiast." : "");
        return (
          '<div class="dam-viz-modal__meta-line">' +
          '<span class="dam-viz-modal__meta-k">Nazwa pliku</span>' +
          (fname
            ? '<p class="dam-viz-modal__filename" id="damVizModalFilename" title="' +
              esc(fname) +
              '">' +
              esc(fname) +
              "</p>"
            : '<p class="dam-viz-modal__filename" id="damVizModalFilename" hidden></p>') +
          "</div>" +
          '<div class="dam-viz-modal__meta-line">' +
          '<span class="dam-viz-modal__meta-k">Typ pliku</span>' +
          '<p class="dam-viz-modal__carrier dam-viz-modal__carrier--editable" id="damVizModalMeta" data-dam-tip="' +
          esc(tipCarrier) +
          '">' +
          esc(typeLine) +
          "</p></div>"
        );
      })() +
      "</div></div></div>" +
      studioRailHtml +
      '<div class="dam-viz-modal__variants dam-viz-modal__variants--studio" role="group" aria-label="Warianty">' +
      variantStripHtml +
      "</div>" +
      '<div id="damVizModalAllFiles" class="dam-viz-modal__all-files-host" hidden></div>' +
      missingLangHtml;
    var initialHeroSrc = heroMediaUrl(first);
    var vizNavPrev =
      items.length > 1
        ? '<button type="button" class="dam-viz-modal__zoom-btn" id="damVizModalPrev" aria-label="Poprzedni" title="Poprzedni" data-dam-tip="Poprzedni plik (←)"><i class="uil uil-angle-left"></i></button>'
        : "";
    var vizNavNext =
      items.length > 1
        ? '<button type="button" class="dam-viz-modal__zoom-btn" id="damVizModalNext" aria-label="Następny" title="Następny" data-dam-tip="Następny plik (→)"><i class="uil uil-angle-right"></i></button>'
        : "";
    var thumbHtml =
      '<div class="dam-viz-modal__thumb">' +
      '<div class="dam-viz-modal__zoom" role="group" aria-label="Przybliżenie">' +
      vizNavPrev +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damVizZoomOut" aria-label="Pomniejsz" title="Pomniejsz" data-dam-tip="Pomniejsz (CTRL/ALT+scroll)"><i class="uil uil-search-minus"></i></button>' +
      '<span class="dam-viz-modal__zoom-label" id="damVizZoomLabel">100%</span>' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damVizZoomIn" aria-label="Powiększ" title="Powiększ" data-dam-tip="Powiększ (CTRL/ALT+scroll)"><i class="uil uil-search-plus"></i></button>' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damVizZoomReset" aria-label="Reset" title="100%" data-dam-tip="Reset zoom i pozycji"><i class="uil uil-search"></i></button>' +
      vizNavNext +
      "</div>" +
      (initialHeroSrc
        ? '<img id="damVizModalHero" src="' +
          esc(initialHeroSrc) +
          '" alt="' +
          esc(productName) +
          '" onerror="this.src=\'' +
          PLACEHOLDER_SVG.replace(/'/g, "%27") +
          '\'">'
        : '<div class="dam-viz-modal__nothumb"><i class="uil uil-image"></i></div>') +
      "</div>";
    /* PI viz.assoc_no_visualization_loop: 2-col — lewa hero+meta, prawa skojarzenia.
       Actions = sibling under __main (not inside scrollable __body) so bar stays above
       expanded studio / Pokaż wszystkie grid. */
    var html =
      '<div class="dam-viz-modal-overlay" id="damVizModal" role="dialog" aria-modal="true" aria-label="Podglad wizualizacji">' +
      '<div class="dam-viz-modal-box dam-viz-modal-box--assoc-split">' +
      '<button type="button" class="dam-viz-modal-close" id="damVizModalClose" aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
      '<div class="dam-viz-modal__main">' +
      thumbHtml +
      '<div class="dam-viz-modal__body">' +
      bodyMetaHtml +
      "</div>" +
      actionsHtml +
      "</div>" +
      '<aside class="dam-viz-modal__assoc-pane" aria-label="Skojarzone materiały">' +
      assocColHtml +
      "</aside>" +
      "</div></div>";

    if (!document.getElementById("dam-viz-modal-css")) {
      var vizCss = document.createElement("link");
      vizCss.id = "dam-viz-modal-css";
      vizCss.rel = "stylesheet";
      vizCss.href = "assets/css/dam-viz-modal.css?v=thumbPick20260721a";
      document.head.appendChild(vizCss);
    } else {
      var existingVizCss = document.getElementById("dam-viz-modal-css");
      if (existingVizCss && existingVizCss.tagName === "LINK") {
        existingVizCss.href = "assets/css/dam-viz-modal.css?v=thumbPick20260721a";
      }
    }
    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("damVizModal");
    var thumbStage = modal.querySelector(".dam-viz-modal__thumb");

    /* Pkt 5/7: chip ID marketingowego kopiuje widoczne V-... (klik i prawy klik) */
    var idChipEl = document.getElementById("damVizModalAssetId");
    if (idChipEl) {
      var copyVizId = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var val = idChipEl.getAttribute("data-marketing-id") || idChipEl.textContent || "";
        if (!val) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(val).then(
            function () {
              showToast("Skopiowano: " + val);
            },
            function () {
              showToast("Nie udalo sie skopiowac");
            }
          );
        }
      };
      idChipEl.addEventListener("click", copyVizId);
      idChipEl.addEventListener("contextmenu", copyVizId);
      idChipEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") copyVizId(e);
      });
    }

    /* Pkt 6/7: zaladuj skojarzone materialy brandingowe (async) */
    if (window.DamMediaPreview && typeof window.DamMediaPreview.renderLinkedAssetsInto === "function") {
      window.DamMediaPreview.renderLinkedAssetsInto(
        document.getElementById("damVizModalAssoc"),
        document.getElementById("damVizModalAssocLabel"),
        {
          id: first.product_id || "",
          name: productName,
          index: displayIndex(first) || first.index_base || "",
          revision_path: first.revision_path || "",
        }
      );
    } else {
      var assocMount = document.getElementById("damVizModalAssoc");
      if (assocMount) {
        assocMount.innerHTML =
          '<p class="dam-media-preview__assoc-empty">Brak modułu podglądu materiałów</p>';
      }
    }
    var shared = window.DamModalShared;
    var zoomCtrl = null;
    var teardownChrome =
      shared && typeof shared.bindChromeFit === "function" ? shared.bindChromeFit(modal) : function () {};
    function removeModal() {
      teardownChrome();
      modal.remove();
    }

    modal.querySelectorAll("[data-request-lang]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.DamVizRequest && typeof window.DamVizRequest.open === "function") {
          window.DamVizRequest.open({
            productId: first.product_id,
            productName: productName,
            lang: btn.getAttribute("data-request-lang"),
            langFull: btn.getAttribute("data-request-lang-full"),
            path: first.path,
            brand: brand,
            category: first.category,
            carrierLabel: carrierHuman(first.carrier || "", first),
            index: displayIndex(first),
          });
        }
      });
    });

    var studioCtrl = null;
    var variantStripCtrl = null;

    function selectVariant(idx) {
      activeIdx = idx;
      var v = items[idx];
      if (!v) return;
      if (zoomCtrl) zoomCtrl.resetView();
      var hero = document.getElementById("damVizModalHero");
      if (hero) {
        var preview = heroMediaUrl(v) || "";
        if (preview) {
          hero.onerror = function () {
            var fallback = mediaPreviewUrl(v.path);
            if (fallback && hero.src.indexOf("/media?") < 0) hero.src = fallback;
            else if (v.thumb_url && hero.src.indexOf("data/thumbs/") < 0) hero.src = v.thumb_url;
            else hero.src = PLACEHOLDER_SVG;
          };
          hero.src = preview;
        }
      }
      if (zoomCtrl) zoomCtrl.paintZoom();
      var meta = document.getElementById("damVizModalMeta");
      if (meta) {
        var idxShow = displayIndex(v);
        var langBit = "";
        if (v.lang_unknown || v.lang === "?" || v.lang === "unknown") {
          langBit = " · ?";
        } else if (v.lang) {
          langBit = " · " + (v.lang_label || labelForLang(v.lang));
        }
        meta.textContent =
          (carrierHuman(v.carrier || "", v) || "Nosnik") +
          (idxShow ? " · Indeks " + idxShow : "") +
          langBit;
      }
      /* Update muted filename line on variant switch */
      var fnameEl = document.getElementById("damVizModalFilename");
      var fname = "";
      if (window.DamPaths && typeof window.DamPaths.basename === "function") {
        fname = window.DamPaths.basename(v.path || "") || "";
      } else {
        var nPath = String(v.path || "").replace(/\\/g, "/");
        var slash = nPath.lastIndexOf("/");
        fname = slash >= 0 ? nPath.slice(slash + 1) : nPath;
      }
      if (!fname && v.name) fname = String(v.name);
      if (fnameEl) {
        fnameEl.textContent = fname || "";
        fnameEl.hidden = !fname;
        if (fname) fnameEl.setAttribute("title", fname);
      } else if (fname && meta && meta.parentNode) {
        var created = document.createElement("p");
        created.className = "dam-viz-modal__filename";
        created.id = "damVizModalFilename";
        created.textContent = fname;
        created.setAttribute("title", fname);
        meta.parentNode.insertBefore(created, meta);
      }
      var idChipUpd = document.getElementById("damVizModalAssetId");
      if (idChipUpd) {
        var freshId = vizModalMarketingId(v);
        if (freshId) {
          idChipUpd.textContent = freshId;
          idChipUpd.setAttribute("data-marketing-id", freshId);
          idChipUpd.setAttribute("data-tag-value", freshId);
          idChipUpd.setAttribute("data-dam-tip", "ID marketingowe: " + freshId + " (klik = kopiuj)");
          idChipUpd.setAttribute("title", "ID marketingowe: " + freshId);
        }
      }
      ["damVizModalWinExplorer", "damVizModalOpenFile", "damVizModalCopyPath", "damVizModalShare"].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.setAttribute("data-path", v.path || "");
      });
      if (variantStripCtrl && typeof variantStripCtrl.sync === "function") {
        variantStripCtrl.sync();
      }
      if (studioCtrl && typeof studioCtrl.sync === "function") {
        studioCtrl.sync();
      }
      if (typeof refreshModalBadgesAndAdmin === "function") {
        refreshModalBadgesAndAdmin();
      }
      if (shared && shared.scheduleFitChrome) shared.scheduleFitChrome(modal);
    }

    variantStripCtrl = bindProductVariantStrip(
      modal,
      items,
      function () {
        return activeIdx;
      },
      selectVariant
    );
    studioCtrl = bindVizModalStudioControls(
      modal,
      items,
      function () {
        return activeIdx;
      },
      selectVariant
    );

    var vizZoomBar = thumbStage && thumbStage.querySelector(".dam-viz-modal__zoom");
    if (shared && typeof shared.bindZoom === "function") {
      zoomCtrl = shared.bindZoom({
        thumbStage: thumbStage,
        labelEl: document.getElementById("damVizZoomLabel"),
        zoomBar: vizZoomBar,
        zoomInBtn: document.getElementById("damVizZoomIn"),
        zoomOutBtn: document.getElementById("damVizZoomOut"),
        zoomResetBtn: document.getElementById("damVizZoomReset"),
        getHero: function () {
          return document.getElementById("damVizModalHero");
        },
      });
    }
    /* Parity with Explorer #damMediaPreview: zoom pill docks / hides off the thumb. */
    if (shared && typeof shared.initZoomDock === "function") {
      shared.initZoomDock(thumbStage, vizZoomBar);
    }
    if (shared && shared.scheduleFitChrome) shared.scheduleFitChrome(modal);

    function refreshCardThumb(pid, thumbUrl) {
      var card = document.querySelector(
        '.dam-viz-card[data-group-pid="' +
          String(pid).replace(/\\/g, "\\\\").replace(/"/g, '\\"') +
          '"] .dam-viz-thumb__img'
      );
      if (card && thumbUrl) card.src = thumbUrl.split("?")[0] + "?v=" + Date.now();
    }

    function setBtnLabel(btn, iconClass, label, tip, on) {
      if (!btn) return;
      btn.classList.toggle("is-on", !!on);
      var icon = btn.querySelector("i");
      var span = btn.querySelector("span");
      if (icon && iconClass) icon.className = iconClass;
      if (span) span.textContent = label;
      if (tip) btn.setAttribute("data-dam-tip", tip);
    }

    function refreshModalBadgesAndAdmin() {
      var v = items[activeIdx] || first;
      var badgesEl = document.getElementById("damVizModalBadges");
      if (badgesEl && window.DamBadges && typeof window.DamBadges.render === "function") {
        badgesEl.innerHTML = window.DamBadges.render({
          brand: brand,
          category: v.category,
          subcategory: v.subcategory_slug,
          subcategoryLabel: v.subcategory_label,
          carrier: v.carrier,
          carrierLabel: carrierHuman(v.carrier || "", v),
          carrierGuessed: !!v.carrier_guessed,
          carrierPrevious: v.carrier_previous || "",
          langs: (v.langs && v.langs.length) ? v.langs : (v.lang && v.lang !== "?" ? [v.lang] : []),
          lang: v.lang,
          langLabel: v.lang_label || labelForLang(v.lang),
          langUnknown: !!(v.lang_unknown || v.lang === "?" || v.lang === "unknown"),
          index: displayIndex(v),
          showNoIndex: !displayIndex(v),
          multiLang: ctx.multiLang,
          multiIndex: ctx.multiIndex,
          demo: isDemo(v),
          mix: !!(v.is_mix || (window.DamLabels && DamLabels.isMixProduct(productName, v.tags))),
          hidden: isHidden(v) && admin,
          productName: productName,
          productId: v.product_id,
          flagKey: hideKey(v),
          tags: v.tags,
          revisionFolder: v.revision_folder,
          revisionFullPath: v.revision_path,
          showCarrierPlaceholder: true,
          maxPerKind: 4,
          overflow: true,
          packagingTags: packagingTagsFrom(v),
          includeTagTiers: badgeTierOpt().includeTagTiers,
        });
      }
      syncAdminControls(v);
      if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
        window.DamTooltips.bind(modal);
      }
    }

    function syncAdminControls(v) {
      if (!admin || !v) return;
      var pid = v.product_id || "";
      var thumbOn = hasThumbOverride(pid);
      var demoOn = isDemo(v);
      var hideOn = isHidden(v);
      var manualN = countManualForProduct(pid);

      setBtnLabel(
        document.getElementById("damVizModalSetThumb"),
        thumbOn ? "uil uil-redo" : "uil uil-image",
        thumbOn ? "Reset" : "Miniatura",
        thumbOn
          ? "Cofnij wybor miniatury (przywroc domyslna)"
          : "Wybierz plik miniatury z folderu produktu (styl Eksploratora)",
        thumbOn
      );
      setBtnLabel(
        document.getElementById("damVizModalDemo"),
        "uil uil-star",
        demoOn ? "Demo off" : "Demo",
        demoOn
          ? "Usun oznaczenie Demo (zolta obwodka)"
          : "Oznacz jako Demo (zolta obwodka)",
        demoOn
      );
      setBtnLabel(
        document.getElementById("damVizModalHide"),
        hideOn ? "uil uil-eye" : "uil uil-eye-slash",
        hideOn ? "Pokaz" : "Ukryj",
        hideOn
          ? "Pokaz kafelek znowu (odklikaj ukrycie). Tag (UKRYTE) tez to robi."
          : "Ukryj kafelek dla zwyklego uzytkownika. Admin zobaczy go przy Pokaz wszystko.",
        hideOn
      );
      setBtnLabel(
        document.getElementById("damVizModalAddManual"),
        manualN > 0 ? "uil uil-minus" : "uil uil-plus",
        manualN > 0 ? "Usun sparowanie" : "Dodaj miniature",
        manualN > 0
          ? "Usun ostatnie sparowanie (cofnie). Shift+klik: sparuj kolejny folder."
          : "Brak wizualizacji? Wskaz folder z wizualizacjami innego jezyka/wariantu i sparuj z tym produktem",
        manualN > 0
      );
    }

    var setThumbBtn = document.getElementById("damVizModalSetThumb");
    if (setThumbBtn) {
      setThumbBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var v = items[activeIdx] || first;
        if (!v || !v.product_id) {
          showToast("Brak produktu");
          return;
        }
        if (hasThumbOverride(v.product_id)) {
          clearThumbOverride(v.product_id);
          items = buildModalItems(group);
          first = items[0] || first;
          var hero = document.getElementById("damVizModalHero");
          var fresh = items[activeIdx] || first;
          if (hero) hero.src = heroMediaUrl(fresh) || PLACEHOLDER_SVG;
          refreshCardThumb(group.pid, (items[0] && items[0].thumb_url) || "");
          showToast("Przywrocono domyslna miniature");
          refreshModalBadgesAndAdmin();
          applyFilters();
          return;
        }
        openThumbPicker(v, function (picked) {
          var thumbUrl = mediaPreviewUrl(picked.path) || "";
          saveThumbOverride(v.product_id, {
            path: picked.path || "",
            file: picked.file || "",
            thumb_url: thumbUrl,
            updated_at: new Date().toISOString(),
          });
          refreshCardThumb(group.pid, thumbUrl);
          var heroEl = document.getElementById("damVizModalHero");
          if (heroEl && thumbUrl) heroEl.src = thumbUrl;
          showToast("Ustawiono miniature dla " + (v.product_name || v.product_id));
          refreshModalBadgesAndAdmin();
          applyFilters();
        });
      });
    }

    var demoBtn = document.getElementById("damVizModalDemo");
    if (demoBtn) {
      demoBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var v = items[activeIdx] || first;
        var key = flagKey(v);
        var on = !isDemo(v);
        setFlag("demo", key, on);
        showToast(on ? "Oznaczono jako Demo" : "Usunieto Demo");
        refreshModalBadgesAndAdmin();
        applyFilters();
      });
    }

    var hideBtn = document.getElementById("damVizModalHide");
    if (hideBtn) {
      hideBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var v = items[activeIdx] || first;
        var on = !isHidden(v);
        setHidden(v, on);
        showToast(on ? "Ukryto - odklikaj tag (UKRYTE) lub Pokaz" : "Pokazano kafelek");
        /* Nie zamykaj modala - da sie cofnac od razu */
        refreshModalBadgesAndAdmin();
        applyFilters();
      });
    }

    var addManualBtn = document.getElementById("damVizModalAddManual");
    if (addManualBtn) {
      addManualBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var v = items[activeIdx] || first;
        var manualN = countManualForProduct(v.product_id);
        if (manualN > 0 && !e.shiftKey) {
          var removed = removeLastManual(v.product_id);
          showToast(removed ? "Usunieto sparowanie" : "Brak sparowanego kafelka");
          refreshModalBadgesAndAdmin();
          applyFilters();
          return;
        }
        /* Start w folderze PRODUKTU (nie tylko biezacej rewizji), zeby admin
           mogl wejsc w sasiedni folder jezyka, ktorego wizualizacja jest
           taka sama jak biezaca (np. GB == DE). */
        var meta = productMeta(v.product_id) || {};
        var startDir = meta.path || folderDirFromPath(v.path || "");
        openFolderPicker(startDir, function (picked) {
          var guessedLang = guessLangFromPath(picked.path) || guessLangFromPath(picked.file);
          var langCode = guessedLang;
          if (!langCode) {
            langCode = (
              window.prompt(
                "Nie rozpoznano kodu jezyka z folderu.\nWpisz kod jezyka tej wizualizacji (np. de, fr, en):",
                ""
              ) || ""
            )
              .trim()
              .toLowerCase();
          }
          if (!langCode) {
            showToast("Sparowanie odwolane - brak kodu jezyka");
            return;
          }
          var langLbl = labelForLang(langCode);
          var sure = window.confirm(
            "Sparowac wizualizacje z folderu:\n" +
              picked.path +
              "\n\njako jezyk " +
              langCode.toUpperCase() +
              (langLbl ? " (" + langLbl + ")" : "") +
              ' dla produktu "' +
              (v.product_name || v.product_id) +
              '"?\n\nBedzie uzywana jako wizualizacja tego produktu w tym jezyku.'
          );
          if (!sure) {
            showToast("Sparowanie odwolane");
            return;
          }
          var entry = {
            product_id: v.product_id,
            product_name: v.product_name,
            brand: v.brand,
            category: v.category,
            carrier: v.carrier,
            carrier_label: v.carrier_label,
            index: v.index,
            index_base: v.index_base || "manual",
            lang: langCode,
            lang_label: langLbl || langCode.toUpperCase(),
            langs: [langCode],
            path: picked.path,
            file: picked.file,
            thumb_url: mediaPreviewUrl(picked.path),
            tags: v.tags || [],
            manual: true,
            paired_from: picked.path,
            mtime: new Date().toISOString(),
          };
          vizFlags.manual = vizFlags.manual || [];
          vizFlags.manual.push(entry);
          persistVizFlags();
          postVizFlag({ action: "manual", entry: entry, flags: vizFlags });
          logChange({
            action: "pair_viz",
            product_id: v.product_id,
            product_name: v.product_name,
            detail: "Sparowano " + langCode.toUpperCase() + " -> " + picked.path,
            before: null,
            after: entry,
          });
          all.push(entry);
          showToast("Sparowano wizualizacje (" + langCode.toUpperCase() + ")");
          refreshModalBadgesAndAdmin();
          applyFilters();
        });
      });
    }

    syncAdminControls(first);

    if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
      window.DamBadges.bindClicks(document.getElementById("damVizModalBadges"), "viz");
    }
    if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
      window.DamTooltips.bind(modal);
    }

    var metaEl = document.getElementById("damVizModalMeta");
    if (metaEl && window.DamTagEdit) {
      var metaLast = 0;
      metaEl.addEventListener("click", function (e) {
        var now = Date.now();
        var open =
          e.shiftKey || (metaLast && now - metaLast <= 500);
        metaLast = now;
        if (!open) return;
        e.preventDefault();
        e.stopPropagation();
        window.DamTagEdit.openCarrierPicker(metaEl, {
          revisionPath: first.revision_path || "",
          currentCode: first.carrier || "",
          productId: first.product_id || "",
          productName: productName || "",
        });
      });
    }

    var goProductBtn = document.getElementById("damVizModalGoProduct");
    if (goProductBtn) {
      goProductBtn.addEventListener("click", function () {
        window.location.href =
          "explorer.html?product=" + encodeURIComponent(this.getAttribute("data-pid") || "");
      });
    }

    var winExpBtn = document.getElementById("damVizModalWinExplorer");
    if (winExpBtn) {
      winExpBtn.addEventListener("click", function () {
        /* Zrodlo prawdy = aktywny wariant (S gdy hero = S), nie stare data-path */
        var v = items[activeIdx] || first;
        var path = (v && v.path) || this.getAttribute("data-path") || "";
        if (path) this.setAttribute("data-path", path);
        if (!path) {
          showToast("Brak sciezki produktu");
          return;
        }
        /* Folder = reveal + select pliku (NIE openFolderInExplorer, ktore bierze tylko katalog) */
        if (window.DamPaths && typeof window.DamPaths.revealInExplorer === "function") {
          window.DamPaths.revealInExplorer(path);
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
          window.DamPaths.openFolderInExplorer(path);
        }
      });
    }

    /* --- OPEN FILE: in-app gallery with siblings (←/→); OS open only when alone --- */
    var openFileBtn = document.getElementById("damVizModalOpenFile");
    if (openFileBtn) {
      openFileBtn.addEventListener("click", function () {
        var v = items[activeIdx] || first;
        var path = (v && v.path) || this.getAttribute("data-path") || "";
        if (path) this.setAttribute("data-path", path);
        if (!path) {
          showToast("Brak ścieżki pliku");
          return;
        }
        var siblings = items
          .filter(function (it) {
            return it && it.path;
          })
          .map(function (it, i) {
            return {
              id: it.id || "viz-modal-" + i + "-" + String(it.path || "").slice(-48),
              name: it.name || it.file || "",
              path: it.path || "",
              perspective: it.perspective || it.persp || "",
              persp: it.persp || it.perspective || "",
              size: it.size || "",
              bg: it.bg || "",
              lang: it.lang || "",
              media_type: it.media_type || "image",
              product_index: it.index_base || it.index || "",
              product_id: it.product_id || "",
              product_name: it.product_name || "",
              brand: it.brand || "",
              thumb_url: it.thumb_url || "",
              mtime: it.mtime || "",
              carrier: it.carrier || "",
            };
          });
        var idx = siblings.findIndex(function (s) {
          return s.path === path;
        });
        if (idx < 0) idx = 0;
        if (
          siblings.length > 1 &&
          window.DamMediaPreview &&
          typeof window.DamMediaPreview.openAsset === "function"
        ) {
          window.DamMediaPreview.openAsset(siblings[idx], {
            siblings: siblings,
            index: idx,
            groupContext: {
              variants: siblings.slice(),
              linked_products: first.product_id
                ? [
                    {
                      id: first.product_id,
                      name: first.product_name || productName || "",
                    },
                  ]
                : [],
            },
            productContext: first.product_id
              ? {
                  id: first.product_id,
                  name: first.product_name || productName || "",
                  index: first.index_base || first.index || "",
                }
              : null,
          });
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.openFileAndCopyPath === "function") {
          window.DamPaths.openFileAndCopyPath(path);
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.copyPortablePath === "function") {
          window.DamPaths.copyPortablePath(path);
        }
      });
    }

    var vizPrevBtn = document.getElementById("damVizModalPrev");
    var vizNextBtn = document.getElementById("damVizModalNext");
    if (vizPrevBtn) {
      vizPrevBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (activeIdx > 0) selectVariant(activeIdx - 1);
      });
    }
    if (vizNextBtn) {
      vizNextBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (activeIdx < items.length - 1) selectVariant(activeIdx + 1);
      });
    }

    var copyBtn = document.getElementById("damVizModalCopyPath");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var path = this.getAttribute("data-path");
        if (window.DamPaths && typeof window.DamPaths.copyPortablePath === "function") {
          window.DamPaths.copyPortablePath(path);
          return;
        }
        if (window.DamPaths) {
          window.DamPaths.copyPath(path);
          return;
        }
        copyToClipboard(path).then(function () {
          showToast("Skopiowano sciezke do schowka");
        });
      });
    }

    var shareBtn = document.getElementById("damVizModalShare");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        if (!syEnabled) return;
        var path = this.getAttribute("data-path") || first.path || "";
        removeModal();
        if (window.DamPaths && typeof window.DamPaths.shareViaSynology === "function") {
          window.DamPaths.shareViaSynology(path);
        } else {
          showToast("DamPaths niedostepne - odswiez strone");
        }
      });
    }

    document.getElementById("damVizModalClose").addEventListener("click", function () {
      closeVariantInfoPopover();
      removeModal();
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        closeVariantInfoPopover();
        removeModal();
      }
    });
    document.addEventListener("keydown", function onEsc(e) {
      if (!document.getElementById("damVizModal")) {
        document.removeEventListener("keydown", onEsc);
        return;
      }
      /* When DamMediaPreview is stacked on top, let it own arrows / Escape. */
      if (document.getElementById("damMediaPreview")) return;
      if (e.key === "Escape") {
        closeVariantInfoPopover();
        removeModal();
        document.removeEventListener("keydown", onEsc);
      } else if (e.key === "ArrowLeft" && items.length > 1) {
        e.preventDefault();
        if (activeIdx > 0) selectVariant(activeIdx - 1);
      } else if (e.key === "ArrowRight" && items.length > 1) {
        e.preventDefault();
        if (activeIdx < items.length - 1) selectVariant(activeIdx + 1);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Synology Share: okno klienta przez local_bridge (/synology-share)    */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Render card galerii                                                  */
  /* ------------------------------------------------------------------ */

  function onThumbError(img) {
    img.onerror = null;
    img.src = PLACEHOLDER_SVG;
    img.classList.add("dam-viz-thumb__img--placeholder");
  }
  window.damVizThumbError = onThumbError;

  function renderGroup(group) {
    var items = group.items.map(applyOverrideToItem);
    var first = items[0];
    var thumb = cardThumbSrc(first);
    var brand = first.brand || "DK";
    var uniq = uniqueModalVariants(items);
    var langs = {};
    var indexes = {};
    uniq.forEach(function (v) {
      if (v.lang) langs[v.lang] = true;
      if (v.index_base || v.index) indexes[v.index_base || String(v.index).split(".")[0]] = true;
    });
    var isMultiLang = Object.keys(langs).length > 1;
    var isMultiIndex = Object.keys(indexes).length > 1;
    var carrierLbl = carrierHuman(first.carrier || "", first);
    var productName = first.product_name || group.pid || "Produkt";
    if (window.DamLabels && typeof window.DamLabels.cleanProductDisplayName === "function") {
      productName = window.DamLabels.cleanProductDisplayName(productName) || productName;
    }
    var productNamePlHtml =
      window.DamLabels && typeof window.DamLabels.productNamePlMarkup === "function"
        ? window.DamLabels.productNamePlMarkup(productName, brand, esc)
        : "";
    var indexLbl = displayIndex(first);
    var demo = isDemo(first);
    var hidden = isHidden(first);
    // Preferuj miniaturke z poprawnym indeksem (po naprawie noid -> 6300xxx)
    if (indexLbl && thumb && thumb.indexOf("__noid_") !== -1) {
      thumb = thumbStem(first.product_id || group.pid, indexLbl, first.lang || "pl");
    }

    var badgesHtml =
      window.DamBadges && typeof window.DamBadges.render === "function"
        ? window.DamBadges.render({
            brand: brand,
            category: first.category,
            subcategory: first.subcategory_slug,
            subcategoryLabel: first.subcategory_label,
            carrier: first.carrier,
            carrierLabel: carrierLbl,
            carrierGuessed: !!first.carrier_guessed,
            carrierPrevious: first.carrier_previous || "",
            langs: Object.keys(langs).length
              ? Object.keys(langs)
              : (first.langs && first.langs.length)
                ? first.langs
                : (first.lang && first.lang !== "?" ? [first.lang] : []),
            lang: first.lang,
            langLabel: first.lang_label || labelForLang(first.lang),
            langUnknown: !!(first.lang_unknown || first.lang === "?" || first.lang === "unknown"),
            index: indexLbl,
            showNoIndex: !indexLbl,
            multiLang: isMultiLang,
            multiIndex: isMultiIndex,
            demo: demo,
            mix: !!(first.is_mix || (window.DamLabels && DamLabels.isMixProduct(productName, first.tags))),
            hidden: hidden && isAdminMode(),
            productName: productName,
            productId: first.product_id,
            flagKey: hideKey(first),
            tags: first.tags,
            revisionFolder: first.revision_folder,
            revisionFullPath: first.revision_path,
            showCarrierPlaceholder: true,
            compact: true,
            maxPerKind: 2,
            /* 2026-07-18: Marka+Kategoria+Podkategoria+Typ+Warianty+Multijezyczny+Indeks
               to typowo 7 tagow - maxTotal musi je wszystkie objac (bylo 6, ucinalo
               Multijezyczny w "+N" po dodaniu Kategorii/Podkategorii do karty). */
            maxTotal: 9,
            packagingTags: packagingTagsFrom(first),
            includeTagTiers: badgeTierOpt().includeTagTiers,
          })
        : '<span class="dam-viz-badge dam-viz-badge--brand">' + esc(brand) + "</span>";

    /* Faza 5/P2: "Pokaz wszystko" - folder istnieje, brak realnej wizki -> wyraznie
       wyszarzony placeholder. Tylko gdy ZADEN wariant grupy nie ma wizki
       (nie regresuj karty produktu przez starsza rewizje bez WIZKI). */
    var noViz = !items.some(itemHasViz);

    return (
      '<article class="dam-viz-card dam-viz-card--clickable' +
        (demo ? " dam-viz-card--demo" : "") +
        (noViz ? " dam-viz-card--no-viz" : "") +
        (hidden && isAdminMode() ? " dam-viz-card--hidden" : "") +
        '" data-group-pid="' +
        esc(group.pid) +
        '">' +
        '<div class="dam-viz-thumb">' +
          (noViz
            ? '<div class="dam-viz-thumb__noviz"><i class="uil uil-image-slash"></i><span>Brak wizualizacji</span></div>'
            : thumb
            ? '<img class="dam-viz-thumb__img" src="' + esc(thumb) + '" alt="" loading="lazy" onerror="window.damVizThumbError(this)">'
            : '<img class="dam-viz-thumb__img dam-viz-thumb__img--placeholder" src="' + PLACEHOLDER_SVG.replace(/"/g, "&quot;") + '" alt="">') +
        '</div>' +
        '<div class="dam-viz-card__body">' +
          '<div class="dam-viz-card__badges">' +
            badgesHtml +
          '</div>' +
          '<h5 class="dam-viz-card__title">' +
            esc(productName) +
            productNamePlHtml +
            "</h5>" +
          '<p class="dam-viz-card__meta' +
            (carrierLbl ? "" : " dam-viz-card__meta--empty") +
            '">' +
            esc(carrierLbl || "BRAK TYPU") +
            "</p>" +
          '<div class="dam-viz-card__actions">' +
            (noViz
              ? '<button type="button" class="geex-btn geex-btn--primary dam-btn-icon dam-viz-request-btn" data-group-pid="' + esc(group.pid) + '" title="Zglos zapotrzebowanie" data-dam-tip="Zglos zapotrzebowanie na wizualizacje dla tego wariantu">' +
                '<i class="uil uil-bell-plus" aria-hidden="true"></i><span>Zglos</span></button>'
              : '<a class="geex-btn geex-btn--primary dam-btn-icon" href="explorer.html?product=' + encodeURIComponent(first.product_id || "") + '" title="Przejdź" data-dam-tip="Otwiera produkt w Eksplorerze">' +
                '<i class="uil uil-sitemap" aria-hidden="true"></i><span>Przejdź</span></a>') +
            '<button type="button" class="geex-btn dam-btn-icon dam-btn-icon-only dam-viz-win-explorer-btn dam-win-btn" data-path="' + esc(first.path || "") + '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwiera folder w Eksploratorze plików Windows">' +
              (window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
                ? window.DamIcons.winExplorerSvg()
                : '<i class="uil uil-folder" aria-hidden="true"></i>') +
            "</button>" +
            (noViz
              ? ""
              : '<button type="button" class="geex-btn dam-btn-icon dam-btn-icon-only dam-viz-share-btn" data-group-pid="' + esc(group.pid) + '" aria-label="Udostepnij" title="Udostepnij" data-dam-tip="Udostepnij plik przez Synology Drive">' +
                '<i class="uil uil-share-alt" aria-hidden="true"></i></button>') +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function fmtCountSpaced(n) {
    return String(Math.max(0, n | 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function plCountWord(n, one, few, many) {
    n = Math.abs(n | 0);
    if (n === 1) return one;
    var d = n % 10;
    var h = n % 100;
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
    return many;
  }

  /**
   * Sticky count pill (jak Branding): elementy = karty produktów, pliki = warianty z wizką.
   * shown / total gdy filtr ucina; inaczej sama liczba + odmiana.
   */
  function updateVizGridCount(groups, filteredRows) {
    var el = document.getElementById("vizGridCount");
    if (!el) return;
    var cardsShown = (groups || []).length;
    var filesShown = (filteredRows || []).filter(function (v) {
      return v && v.has_viz !== false && (v.thumb_url || v.path);
    }).length;
    if (!filesShown && !cardsShown) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    var allGroups = groupByProduct(all);
    var totalCards = allGroups.length;
    var totalFiles = all.filter(function (v) {
      return v && v.has_viz !== false && (v.thumb_url || v.path);
    }).length;
    var elsPart =
      cardsShown < totalCards
        ? fmtCountSpaced(cardsShown) +
          " / " +
          fmtCountSpaced(totalCards) +
          " " +
          plCountWord(totalCards, "element", "elementy", "elementów")
        : fmtCountSpaced(cardsShown) +
          " " +
          plCountWord(cardsShown, "element", "elementy", "elementów");
    var filesPart =
      filesShown < totalFiles
        ? fmtCountSpaced(filesShown) +
          " / " +
          fmtCountSpaced(totalFiles) +
          " " +
          plCountWord(totalFiles, "plik", "pliki", "plików")
        : fmtCountSpaced(filesShown) +
          " " +
          plCountWord(filesShown, "plik", "pliki", "plików");
    el.textContent = elsPart + " • " + filesPart;
    el.hidden = false;
  }

  /** Changelog siedzi wewnątrz toolbaru — osobny page-entrance GSAP zostawiał opacity:0. */
  function clearChromeRevealInline(el) {
    if (!el) return;
    el.setAttribute("data-dam-bar-revealed", "1");
    el.style.opacity = "";
    el.style.visibility = "";
    el.style.transform = "";
    el.style.clipPath = "";
  }

  function mountChangeLogInScope() {
    var bar = document.getElementById("damChangeLogBar");
    var scope =
      document.querySelector("#vizSearchScope > .dam-search-scope") ||
      document.querySelector("#vizSearchScope .dam-search-scope");
    if (bar && scope && bar.parentElement !== scope) {
      scope.appendChild(bar);
    }
    clearChromeRevealInline(bar);
    if (window.DamTagEdit && typeof window.DamTagEdit.refreshChangeLogBar === "function") {
      window.DamTagEdit.refreshChangeLogBar();
    } else if (bar) {
      /* Ten sam gate co DamTagEdit: rola admin + dam_admin_mode (header ADMIN ON). */
      bar.hidden = !(isAdminRole() && localStorage.getItem(ADMIN_KEY) === "1");
    }
  }

  function ensureVizChromeVisible() {
    clearChromeRevealInline(document.getElementById("damChangeLogBar"));
    clearChromeRevealInline(document.querySelector(".dam-explorer-toolbar.dam-viz-toolbar"));
    clearChromeRevealInline(document.querySelector(".dam-global-search-block > .dam-viz-grid-toolbar"));
    clearChromeRevealInline(document.getElementById("vizSearchTags"));
  }

  function render() {
    var grid = document.getElementById("vizGrid");
    var status = document.getElementById("vizStatus");
    if (!grid) return;

    var groups = groupByProduct(filtered);

    if (status) {
      status.textContent =
        groups.length + " produktow (" + filtered.length + " wariantow)" +
        (all.length !== filtered.length ? " / z " + all.length + " wszystkich" : "");
    }
    updateVizGridCount(groups, filtered);

    if (!groups.length) {
      grid.innerHTML = '<p style="color:#888;padding:12px">Brak wynikow dla filtra.</p>';
      return;
    }

    grid.innerHTML = groups.map(renderGroup).join("");
    if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
      window.DamBadges.bindClicks(grid, "viz");
    }

    // Klik miniatury / karty
    grid.querySelectorAll(".dam-viz-card--clickable").forEach(function (card) {
      var pid = card.getAttribute("data-group-pid");
      var group = groups.find(function (g) { return g.pid === pid; });
      if (!group) return;
      card.querySelector(".dam-viz-thumb").addEventListener("click", function (e) {
        e.preventDefault();
        openProductModal(group);
      });
    });

    // Przycisk Eksplorator Windows (folder)
    grid.querySelectorAll(".dam-viz-win-explorer-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var path = this.getAttribute("data-path") || "";
        if (!path) {
          showToast("Brak sciezki produktu");
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
          window.DamPaths.openFolderInExplorer(path);
          return;
        }
        if (window.DamPaths) window.DamPaths.revealInExplorer(path);
      });
    });

    // Przycisk Zglos zapotrzebowanie (kafelek bez wizki, "Pokaz wszystko")
    grid.querySelectorAll(".dam-viz-request-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var pid = this.getAttribute("data-group-pid");
        var group = groups.find(function (g) { return g.pid === pid; });
        var v = group && group.items[0];
        if (!v || !window.DamVizRequest) return;
        window.DamVizRequest.open({
          productId: v.product_id,
          productName: v.product_name,
          lang: v.lang,
          langFull: v.lang_label || labelForLang(v.lang),
          brand: v.brand,
          category: v.category,
          carrierLabel: carrierHuman(v.carrier || "", v),
          index: displayIndex(v),
          path: v.path,
        });
      });
    });

    // Przycisk Udostepnij
    grid.querySelectorAll(".dam-viz-share-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var pid = this.getAttribute("data-group-pid");
        var group = groups.find(function (g) { return g.pid === pid; });
        if (!group) return;
        var syEnabled = (localStorage.getItem("dam_synology_enabled") !== "false");
        if (!syEnabled) {
          showToast("Wlacz Synology Drive w Ustawieniach");
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.shareViaSynology === "function") {
          window.DamPaths.shareViaSynology(group.items[0].path || "");
        } else {
          showToast("DamPaths niedostepne - odswiez strone");
        }
      });
    });

    if (window.DamGridReveal) {
      window.DamGridReveal.reveal(grid, window.DamGridReveal.selectors.vizCard);
    }
  }

  /* Podkategorie (np. "Kulki Surowe" / balls raw) - osobny rzad pilli, bo
     "typ" w tag_groups to kategoria (kulki/batony), a nie ta subtelniejsza
     podkategoria z folderu produktu. Zrodlo: _DAM_FILE_INDEX.products. */
  var SUBCAT_ROW_LIMIT = 8;
  var subcatExpanded = false;
  var subcatPillCache = [];

  function mountSubcatRow(tagsEl) {
    if (!tagsEl) return;
    var inner = tagsEl.querySelector(".dam-tag-groups__inner");
    if (!inner) return;
    inner.querySelectorAll('[data-group="podkategoria"]').forEach(function (node) {
      node.remove();
    });
    var list = subcatPillCache || [];
    if (!list.length) return;
    if (!window.DamTagBar || typeof DamTagBar.buildGroupRow !== "function") return;
    var rowHtml = DamTagBar.buildGroupRow({
      groupKey: "podkategoria",
      label: "Podkategoria",
      className: "dam-tag-group--podkategoria",
      chips: list.map(function (it) {
        return { key: it.slug, label: it.label };
      }),
      expandedGroups: { podkategoria: subcatExpanded },
      rowLimit: SUBCAT_ROW_LIMIT,
      pillHtml: function (chip) {
        return (
          '<button type="button" class="dam-tag-pill" data-subcat="' +
          esc(chip.key) +
          '" title="' +
          esc(chip.label) +
          '">' +
          esc(chip.label) +
          "</button>"
        );
      },
    });
    if (!rowHtml) return;
    inner.insertAdjacentHTML("beforeend", rowHtml);
    inner.querySelectorAll("[data-subcat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var search = document.getElementById("vizSearch");
        if (!search) return;
        search.value = this.getAttribute("data-subcat") || "";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        search.focus();
      });
    });
    inner.querySelectorAll('[data-expand-group="podkategoria"]').forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        subcatExpanded = !subcatExpanded;
        mountSubcatRow(tagsEl);
      });
    });
  }

  function renderSubcatPills(products) {
    if (products) {
      var seen = {};
      var list = [];
      (products || []).forEach(function (p) {
        var slug = (p.subcategory_slug || "").trim();
        if (!slug || seen[slug]) return;
        seen[slug] = true;
        var subLbl = p.subcategory_label || slug;
        if (window.DamLabels && typeof window.DamLabels.formatTagLabel === "function") {
          subLbl = window.DamLabels.formatTagLabel(subLbl, "subcategory");
        }
        list.push({ slug: slug, label: subLbl });
      });
      list.sort(function (a, b) {
        return a.label.localeCompare(b.label, "pl");
      });
      subcatPillCache = list;
      subcatExpanded = false;
    }
    mountSubcatRow(document.getElementById("vizSearchTags"));
  }

  function productMeta(pid) {
    var fi = window._DAM_FILE_INDEX;
    if (!fi || !fi.products) return null;
    for (var i = 0; i < fi.products.length; i++) {
      if (fi.products[i].id === pid) return fi.products[i];
    }
    return null;
  }

  /* "balls_raw" / "balls-raw" -> "balls raw" - zeby query i blob mialy ta sama
     tokenizacje niezaleznie od separatora uzytego w slug/nazwie folderu. */
  function normalizeSearchText(s) {
    return String(s || "")
      .toLowerCase()
      /* ASCII hyphen + em/en dash z nazw folderow X: (U+2014/U+2013) */
      .replace(/[_\-\u2013\u2014]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* Boot echo: DamApi.me() w dam-shell.js ponownie dispatchuje dam:admin-mode
     po pierwszym paint - bez latcha render()+DamGridReveal.reveal() gra 2×. */
  var lastAdminVisibilityKey = null;

  function adminVisibilityKey() {
    return (isAdminMode() ? "1" : "0") + "|" + (showAll ? "1" : "0");
  }

  function applyFilters() {
    var lang = (document.getElementById("vizLangFilter") || {}).value || "";
    var q = ((document.getElementById("vizSearch") || {}).value || "").trim().toLowerCase();
    var qNorm = normalizeSearchText(q);
    var parts = qNorm ? qNorm.split(/\s+/).filter(Boolean) : [];

    filtered = all.filter(function (v) {
      var brand = v.brand || "DK";
      if (!brandFilter[brand]) return false;
      /* Ukryte: zwykle uzytkownicy nigdy. Admin tylko przy "Pokaz wszystko". */
      if (isHidden(v)) {
        if (!isAdminMode()) return false;
        if (!showAll) return false;
      }
      /* Bez "Pokaz wszystkie": ukryj Demo (prototypy) */
      if (!showAll && isDemo(v)) return false;
      if (lang && (v.lang || "") !== lang) return false;
      if (!parts.length) return true;
      var meta = productMeta(v.product_id) || {};
      var tg = meta.tag_groups || {};
      var langsArr = Array.isArray(v.langs)
        ? v.langs
        : v.lang
          ? [v.lang]
          : [];
      var multiBits = "";
      if (langsArr.length > 1 || v.multiLang) {
        var syn =
          (window.DamLabels &&
            window.DamLabels.UI_STRINGS &&
            window.DamLabels.UI_STRINGS.multi_lang_synonyms) ||
          [];
        multiBits =
          " Multijęzyczny Multijezyczny Multi " +
          (Array.isArray(syn) ? syn.join(" ") : "") +
          " " +
          langsArr.join(" ");
      }
      var blob = normalizeSearchText(
        [
          v.product_name || "",
          v.index || "",
          v.index_base || "",
          v.carrier || "",
          v.file || "",
          v.lang_label || "",
          v.lang || "",
          langsArr.join(" "),
          multiBits,
          v.brand || "",
          v.subcategory_slug || "",
          v.subcategory_label || "",
          meta.name || "",
          meta.display_name || "",
          meta.path || "",
          meta.subcategory_slug || "",
          meta.subcategory_label || "",
          (meta.tags || []).join(" "),
          (meta.authors || []).join(" "),
          (tg.smak || []).join(" "),
          (tg.typ || []).join(" "),
          (tg.opakowanie || []).join(" "),
          (tg.autor || tg.osoba || []).join(" "),
          meta.search_blob || "",
        ].join(" ")
      );
      var digits = q.replace(/\D/g, "");
      if (digits.length >= 4 && (v.index_base || "").indexOf(digits) !== -1) return true;
      return parts.every(function (part) {
        return blob.indexOf(part) !== -1;
      });
    });
    render();
    lastAdminVisibilityKey = adminVisibilityKey();
  }

  /* Suwak skali kafelkow:
     65-100% = pomniejsza wizualizacje w thumb (img-scale),
     100-350% = wizualizacja wypelnia krawedzie L/P, potem rosnie kafelek.
     Bazowo grafika ma 120% (CARD_IMG_BASE_SCALE). */
  function applyCardZoom(pct) {
    /* HARD: copy branding density — DamCardZoom applies vars to vizGrid + assoc pane. */
    if (window.DamCardZoom && typeof window.DamCardZoom.apply === "function") {
      return window.DamCardZoom.apply(pct);
    }
    var n = Math.round(Number(pct) || 100);
    if (n < CARD_ZOOM_MIN) n = CARD_ZOOM_MIN;
    if (n > CARD_ZOOM_MAX) n = CARD_ZOOM_MAX;
    var imgScale = (n <= 100 ? n / 100 : 1) * CARD_IMG_BASE_SCALE;
    var cardScale = n <= 100 ? 1 : n / 100;
    var root = document.getElementById("vizGrid") || document.documentElement;
    root.style.setProperty("--dam-viz-img-scale", String(imgScale));
    root.style.setProperty("--dam-viz-card-scale", String(cardScale));
    root.style.setProperty("--dam-viz-card-min", Math.round(CARD_BASE_MIN_PX * cardScale) + "px");
    var label = document.getElementById("vizCardZoomLabel");
    if (label) label.textContent = n + "%";
    var input = document.getElementById("vizCardZoom");
    if (input && String(input.value) !== String(n)) input.value = String(n);
    try {
      localStorage.setItem(CARD_ZOOM_KEY, String(n));
    } catch (e) {}
    return n;
  }

  function bindCardZoomControl() {
    var input = document.getElementById("vizCardZoom");
    if (!input || input._damZoomBound) return;
    input._damZoomBound = true;
    var saved = parseInt(localStorage.getItem(CARD_ZOOM_KEY) || "100", 10);
    if (isNaN(saved)) saved = 100;
    applyCardZoom(saved);
    input.addEventListener("input", function () {
      applyCardZoom(this.value);
    });
    input.addEventListener("change", function () {
      applyCardZoom(this.value);
    });
  }

  function init() {
    var grid = document.getElementById("vizGrid");
    if (!grid) return;

    if (window.DamGridReveal && typeof window.DamGridReveal.skeleton === "function") {
      window.DamGridReveal.skeleton(grid, { variant: "cards", count: 10, layout: "viz-grid" });
    }

    // Synology enabled?
    synologyEnabled = (localStorage.getItem("dam_synology_enabled") !== "false");

    bindCardZoomControl();

    var changeLogBar = document.getElementById("damChangeLogBar");
    if (!isAdminRole()) {
      if (changeLogBar) changeLogBar.hidden = true;
      localStorage.setItem(ADMIN_KEY, "0");
    } else if (!window._damVizAdminBound) {
      window._damVizAdminBound = true;
      window.addEventListener("dam:admin-mode", function () {
        mountChangeLogInScope();
        /* Skip boot echo from DamApi.me (same admin/showAll) — avoids 2× reveal. */
        if (!indexData) return;
        if (adminVisibilityKey() === lastAdminVisibilityKey) return;
        applyFilters();
      });
      window.addEventListener("storage", function (e) {
        if (e.key === ADMIN_KEY) {
          mountChangeLogInScope();
          if (!indexData) return;
          if (adminVisibilityKey() === lastAdminVisibilityKey) return;
          applyFilters();
        }
      });
    }

    /* Fala D: discrepancy dysk vs ostatnie zatwierdzenie -> carrier_guessed + tip */
    fetch("./data/carrier-assignment-log.json", { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (log) {
        var entries = (log && log.entries) || [];
        if (!entries.length || !all.length) return;
        var byParent = {};
        entries.forEach(function (e) {
          var rp = String(e.revision_path || "").replace(/\//g, "\\");
          var parent = rp.replace(/\\[^\\]+$/, "").toLowerCase();
          if (!parent) return;
          byParent[parent] = e;
        });
        var dirty = false;
        all.forEach(function (v) {
          var rp = String(v.revision_path || "").replace(/\//g, "\\");
          var parent = rp.replace(/\\[^\\]+$/, "").toLowerCase();
          var last = byParent[parent];
          if (!last) return;
          var assigned = String(last.carrier_code || "").toUpperCase();
          var disk = String(v.carrier || "").toUpperCase();
          if (assigned && disk && assigned !== disk && assigned !== "NONE") {
            v.carrier_guessed = true;
            v.carrier_previous = assigned;
            dirty = true;
          }
        });
        if (dirty) applyFilters();
      })
      .catch(function () {});

    window.damVizApplyBrandTag = function (brand) {
      var b = String(brand || "").toUpperCase();
      if (b !== "DK" && b !== "GC") return;
      brandFilter = { DK: b === "DK", GC: b === "GC" };
      if (window.DamBrandFilter && typeof window.DamBrandFilter.commitBrands === "function") {
        window.DamBrandFilter.commitBrands(brandFilter);
      }
      applyFilters();
    };

    function findVizByFlagKey(key, productId) {
      var k = String(key || "");
      if (k) {
        for (var i = 0; i < all.length; i++) {
          if (flagKey(all[i]) === k) return all[i];
        }
      }
      var pid = String(productId || "");
      if (pid) {
        for (var j = 0; j < all.length; j++) {
          if (all[j].product_id === pid) return all[j];
        }
      }
      return null;
    }

    function refreshOpenModalAfterFlag() {
      var badgesEl = document.getElementById("damVizModalBadges");
      var modalEl = document.getElementById("damVizModal");
      if (!modalEl || !badgesEl) {
        applyFilters();
        return;
      }
      var hideBtn = document.getElementById("damVizModalHide");
      var demoBtn = document.getElementById("damVizModalDemo");
      if (hideBtn) {
        var goBtn = document.getElementById("damVizModalGoProduct");
        var pidAttr = goBtn ? goBtn.getAttribute("data-pid") || "" : "";
        var v = findVizByFlagKey("", pidAttr);
        if (v && window.DamBadges) {
          var adminOn = isAdminMode();
          badgesEl.innerHTML = window.DamBadges.render({
            brand: v.brand || "DK",
            category: v.category,
            subcategory: v.subcategory_slug,
            subcategoryLabel: v.subcategory_label,
            carrier: v.carrier,
            carrierLabel: carrierHuman(v.carrier || "", v),
            carrierGuessed: !!v.carrier_guessed,
            carrierPrevious: v.carrier_previous || "",
            langs: (v.langs && v.langs.length) ? v.langs : (v.lang && v.lang !== "?" ? [v.lang] : []),
            lang: v.lang,
            langLabel: v.lang_label || labelForLang(v.lang),
            langUnknown: !!(v.lang_unknown || v.lang === "?" || v.lang === "unknown"),
            index: displayIndex(v),
            showNoIndex: !displayIndex(v),
            demo: isDemo(v),
            mix: !!(v.is_mix || (window.DamLabels && DamLabels.isMixProduct(v.product_name, v.tags))),
            hidden: isHidden(v) && adminOn,
            productName: v.product_name || v.product_id,
            productId: v.product_id,
            flagKey: hideKey(v),
            tags: v.tags,
            revisionFolder: v.revision_folder,
            revisionFullPath: v.revision_path,
            showCarrierPlaceholder: true,
            maxPerKind: 4,
            overflow: true,
            packagingTags: packagingTagsFrom(v),
            includeTagTiers: badgeTierOpt().includeTagTiers,
          });
          var setOn = function (btn, on, label, tip, icon) {
            if (!btn) return;
            btn.classList.toggle("is-on", !!on);
            var span = btn.querySelector("span");
            var iEl = btn.querySelector("i");
            if (span) span.textContent = label;
            if (tip) btn.setAttribute("data-dam-tip", tip);
            if (iEl && icon) iEl.className = icon;
          };
          setOn(
            hideBtn,
            isHidden(v),
            isHidden(v) ? "Pokaz" : "Ukryj",
            isHidden(v)
              ? "Pokaz kafelek znowu (odklikaj ukrycie). Tag (UKRYTE) tez to robi."
              : "Ukryj kafelek dla zwyklego uzytkownika. Admin zobaczy go przy Pokaz wszystko.",
            isHidden(v) ? "uil uil-eye" : "uil uil-eye-slash"
          );
          setOn(
            demoBtn,
            isDemo(v),
            isDemo(v) ? "Demo off" : "Demo",
            isDemo(v)
              ? "Usun oznaczenie Demo (zolta obwodka)"
              : "Oznacz jako Demo (zolta obwodka)",
            "uil uil-star"
          );
        }
      }
      if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
        window.DamTooltips.bind(modalEl);
      }
      applyFilters();
    }

    window.damVizToggleHidden = function (opts) {
      opts = opts || {};
      var v = findVizByFlagKey(opts.flagKey, opts.productId);
      if (!v && opts.productId) {
        v = { product_id: opts.productId };
      }
      var key = (v && hideKey(v)) || opts.productId || opts.flagKey || "";
      if (!key) {
        showToast("Brak klucza ukrycia");
        return;
      }
      var currently = v ? isHidden(v) : !!(vizFlags.hidden && vizFlags.hidden[key]);
      if (v && v.product_id) setHidden(v, !currently);
      else setFlag("hidden", key, !currently);
      showToast(!currently ? "Ukryto kafelek" : "Pokazano kafelek");
      refreshOpenModalAfterFlag();
    };

    /* Pkt 8: dostep dla innych modulow (dam-explorer "Dodaj miniature") + QA */
    window.damVizOpenThumbPicker = openThumbGridPicker;

    window.damVizToggleDemo = function (opts) {
      opts = opts || {};
      var v = findVizByFlagKey(opts.flagKey, opts.productId);
      var key = opts.flagKey || (v ? flagKey(v) : "");
      if (!key) {
        showToast("Brak klucza Demo");
        return;
      }
      var on = !(vizFlags.demo && vizFlags.demo[key]);
      setFlag("demo", key, on);
      showToast(on ? "Oznaczono jako Demo" : "Usunieto Demo");
      refreshOpenModalAfterFlag();
    };

    loadVizFlags();
    fetch("data/viz-flags.json?_=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (fileFlags) {
        if (!fileFlags || typeof fileFlags !== "object") return;
        vizFlags = {
          demo: Object.assign({}, fileFlags.demo || {}, vizFlags.demo || {}),
          hidden: Object.assign({}, fileFlags.hidden || {}, vizFlags.hidden || {}),
          manual: [].concat(fileFlags.manual || [], vizFlags.manual || []),
        };
        persistVizFlags();
        if (indexData) {
          rebuildAllFromIndex();
          applyFilters();
        }
      })
      .catch(function () {});

    /* Scal overrides z pliku repo do localStorage */
    fetch("data/thumb-overrides.json?_=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (fileOv) {
        if (!fileOv || typeof fileOv !== "object") return;
        var local = loadThumbOverrides();
        localStorage.setItem(
          THUMB_OVERRIDES_KEY,
          JSON.stringify(Object.assign({}, fileOv, local))
        );
      })
      .catch(function () {});

    // Brand filter: te same chipy DK/GC co w Eksplorerze (DamBrandFilter.renderChips)
    brandFilter = window.DamBrandFilter ? window.DamBrandFilter.loadBrands() : { DK: true, GC: true };

    if (window.DamBrandFilter) {
      window.DamBrandFilter.addListener(function (brands) {
        brandFilter = brands;
        applyFilters();
      });
      var brandMount = document.getElementById("vizBrandMount");
      if (brandMount && typeof window.DamBrandFilter.renderChips === "function") {
        window.DamBrandFilter.renderChips(brandMount, function (brands) {
          brandFilter = brands;
          applyFilters();
        });
      } else {
        /* Legacy fallback: stary trigger dropdown (jesli mount brak) */
        var brandTrigger = document.getElementById("vizBrandFilterTrigger");
        if (brandTrigger) window.DamBrandFilter.init(brandTrigger);
      }
    }

    var params = new URLSearchParams(location.search);
    var wantProduct = params.get("product");
    var wantLang = params.get("lang");
    var wantBrand = params.get("brand");
    if (wantBrand && window.DamBrandFilter) {
      brandFilter = { DK: wantBrand === "DK", GC: wantBrand === "GC" };
      if (typeof window.DamBrandFilter.commitBrands === "function") {
        window.DamBrandFilter.commitBrands(brandFilter);
      }
    }

    function boot(data) {
      indexData = data;
      langLabels = data.lang_labels || {};
      window._DAM_FILE_INDEX = data;
      renderSubcatPills(data.products);
      showAll = readShowAll();
      var showAllEl = document.getElementById("vizShowAll") || document.getElementById("vizLatestOnly");
      if (showAllEl) {
        showAllEl.checked = showAll;
        var sw = showAllEl.closest(".dam-switch");
        if (sw) sw.classList.toggle("is-off", !showAll);
      }
      rebuildAllFromIndex();
      if (wantProduct) {
        all = all.filter(function (v) { return v.product_id === wantProduct; });
      }
      if (wantLang) {
        var sel = document.getElementById("vizLangFilter");
        if (sel) sel.value = wantLang;
      }
      applyFilters();
      if (window.DamShell && typeof window.DamShell.setTrailLeaf === "function") {
        window.DamShell.setTrailLeaf("Wizualizacje");
      }
    }

    var lastIndexMtime = 0;

    function loadIndex() {
      if (window.DamLoader && typeof window.DamLoader.start === "function") {
        window.DamLoader.start("Skojarzenia…");
      }
      var p;
      if (window.DamSearch && typeof window.DamSearch.reload === "function") {
        p = window.DamSearch.reload().then(function () {
          return window._DAM_FILE_INDEX;
        });
      } else {
        p = fetch("data/file-index.json?_=" + Date.now()).then(function (r) {
          if (!r.ok) throw new Error("file-index.json");
          return r.json();
        });
      }
      return p.finally(function () {
        if (window.DamLoader && typeof window.DamLoader.done === "function") {
          window.DamLoader.done();
        }
      });
    }

    loadIndex().then(boot).catch(function (err) {
      grid.innerHTML = '<p style="color:#FF5653">Blad indeksu: ' + esc(err.message) + "</p>";
    });

    /* Near-instant: poll mtime indeksu (watcher / POST /index/rebuild) */
    function pollIndexFresh() {
      var bridge = (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function")
        ? window.DamRuntime.bridgeUrl()
        : ((window.DamRuntime && window.DamRuntime.bridge) || "http://127.0.0.1:8766");
      fetch(bridge + "/index/status", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (st) {
          if (!st || !st.mtime) return;
          if (lastIndexMtime && st.mtime > lastIndexMtime) {
            loadIndex().then(boot).catch(function () {});
          }
          lastIndexMtime = st.mtime;
        })
        .catch(function () {});
    }
    setInterval(pollIndexFresh, 4000);
    setTimeout(pollIndexFresh, 800);

    var langSel = document.getElementById("vizLangFilter");
    var search = document.getElementById("vizSearch");
    var showAllToggle = document.getElementById("vizShowAll") || document.getElementById("vizLatestOnly");
    function syncShowAllSwitchUi() {
      if (!showAllToggle) return;
      var wrap = showAllToggle.closest(".dam-switch");
      if (wrap) wrap.classList.toggle("is-off", !showAllToggle.checked);
    }
    if (showAllToggle) {
      showAll = readShowAll();
      showAllToggle.checked = showAll;
      syncShowAllSwitchUi();
      showAllToggle.addEventListener("change", function () {
        showAll = !!showAllToggle.checked;
        localStorage.setItem(SHOW_ALL_KEY, showAll ? "1" : "0");
        localStorage.removeItem(LATEST_KEY_LEGACY);
        syncShowAllSwitchUi();
        rebuildAllFromIndex();
        if (wantProduct) {
          all = all.filter(function (v) { return v.product_id === wantProduct; });
        }
        applyFilters();
      });
    }
    if (langSel) langSel.addEventListener("change", applyFilters);
    if (search) {
      var t = null;
      function onSearch() {
        clearTimeout(t);
        t = setTimeout(applyFilters, 120);
      }
      search.addEventListener("input", onSearch);
      search.addEventListener("keyup", onSearch);
      search.addEventListener("search", onSearch);
    }

    /* Wizualizacje: UI zawsze Wszystko; Produkty/Warianty wygaszone (bez zmiany localStorage) */
    var vizScopeEl = document.getElementById("vizSearchScope");
    var changeLogBarEl = document.getElementById("damChangeLogBar");
    if (vizScopeEl && window.DamSearch && typeof window.DamSearch.bindScopeChips === "function") {
      window.DamSearch.bindScopeChips(vizScopeEl, null, {
        locked: true,
        trailingEl: changeLogBarEl || null,
        afterPaint: function () {
          mountChangeLogInScope();
        },
      });
    } else {
      mountChangeLogInScope();
    }
    ensureVizChromeVisible();
    /* Page-entrance GSAP (DamGridReveal) potrafi zostawić belki na opacity:0 —
       zwłaszcza gdy #damChangeLogBar jest zagnieżdżony w .dam-viz-toolbar. */
    setTimeout(ensureVizChromeVisible, 700);
    setTimeout(ensureVizChromeVisible, 1600);

    if (window.DamTagBar) {
      window.DamTagBar.bind({
        tagsEl: "vizSearchTags",
        inputEl: "vizSearch",
        onTag: function () {
          applyFilters();
        },
        afterRender: function (tagsEl) {
          mountSubcatRow(tagsEl);
        },
      });
    }

    var revealLow = document.getElementById("damRevealLowTags");
    if (revealLow && window.DamBadges && typeof window.DamBadges.setRevealLowTags === "function") {
      try {
        revealLow.checked = localStorage.getItem("dam_reveal_low_tags") === "1";
      } catch (eRev) { /* ignore */ }
      revealLow.addEventListener("change", function () {
        window.DamBadges.setRevealLowTags(revealLow.checked);
        applyFilters();
      });
    }
    document.addEventListener("dam-tag-tiers-changed", function () {
      applyFilters();
    });

    window.DamViz = {
      applyFilters: applyFilters,
      getAll: function () { return all; },
      getFiltered: function () { return filtered; },
      /* HARD: AJAX refresh after admin tag/lang apply - no full page reload */
      refreshAfterTagChange: function (res) {
        try {
          if (res && res.langs && res.new_path) {
            all.forEach(function (v) {
              if (
                v.path === res.old_path ||
                v.revision_path === res.old_path ||
                (res.new_path && v.path === res.new_path)
              ) {
                v.langs = res.langs.slice();
                v.lang = res.langs[0] || v.lang;
                if (res.new_path) {
                  v.path = res.new_path;
                  v.revision_path = res.new_path;
                }
              }
            });
          }
          if (res && res.new_path && res.old_path && res.new_carrier_code) {
            all.forEach(function (v) {
              if (v.path === res.old_path || v.revision_path === res.old_path) {
                v.carrier = res.new_carrier_code || v.carrier;
                v.path = res.new_path;
              }
            });
          }
        } catch (ignore) {}
        applyFilters();
        return true;
      },
      /* studioRow20260721a: expose for CDP/QA open without relying on thumb click path */
      openByProductId: function (pid) {
        var groups = groupByProduct(filtered);
        var group = groups.find(function (g) { return g.pid === pid; });
        if (group) openProductModal(group);
        return !!group;
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
