/**
 * DAM - edycja skojarzen produktów / wariantow w podglądzie mediow (Shift+klik, admin).
 */
(function (global) {
  "use strict";

  var PLACEHOLDER_SVG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">' +
        '<rect fill="#f1f3f6" width="320" height="240"/>' +
        '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="14">Brak</text>' +
        "</svg>"
    );

  function bridgeUrl() {
    return (
      (global.DamPaths && typeof global.DamPaths.bridgeUrl === "function" && global.DamPaths.bridgeUrl()) ||
      "http://127.0.0.1:8766"
    );
  }

  /** HARD: wyklucz duplikaty z ARCHIWUM Opakowania (user 2026-07-29). */
  var EXCLUDED_MARKETING_DUP_RE =
    /--\s*ARCHIWUM\s*--[\\/]01[\s._-]*Opakowania/i;

  /** Unified assoc picker modes (2026-07-29). */
  var PICKER_MODE_VIZ_PRODUCTS = "viz-products";
  var PICKER_MODE_BRANDING_GROUPS = "branding-groups";
  var PICKER_MODE_VIZ_SUGGESTIONS = "viz-suggestions";

  /** CTA data-dam-assoc-picker-id → mode (1 variant-branding, 2 product, 3 material, 4 variants-viz, 5 suggestions). */
  var PICKER_ID_TO_MODE = {
    "1": PICKER_MODE_BRANDING_GROUPS,
    "2": PICKER_MODE_VIZ_PRODUCTS,
    "3": PICKER_MODE_BRANDING_GROUPS,
    "4": PICKER_MODE_VIZ_PRODUCTS,
    "5": PICKER_MODE_VIZ_SUGGESTIONS,
  };

  function resolvePickerMode(kind, ctx, pickerId) {
    ctx = ctx || {};
    pickerId = String(pickerId || ctx.pickerId || "").trim();
    if (pickerId && PICKER_ID_TO_MODE[pickerId]) return PICKER_ID_TO_MODE[pickerId];
    if (ctx.pickerMode) return ctx.pickerMode;
    if (kind === "material") {
      if (ctx.productContext && ctx.productContext.id) return PICKER_MODE_VIZ_SUGGESTIONS;
      return PICKER_MODE_BRANDING_GROUPS;
    }
    if (kind === "variant" && ctx.brandingSearch) return PICKER_MODE_BRANDING_GROUPS;
    if (kind === "variant" && ctx.productSearchForVariants) return PICKER_MODE_VIZ_PRODUCTS;
    if (kind === "product") return PICKER_MODE_VIZ_PRODUCTS;
    return PICKER_MODE_VIZ_PRODUCTS;
  }

  function pickerUsesBrandingGroups(opts) {
    return (
      opts &&
      (opts.pickerMode === PICKER_MODE_BRANDING_GROUPS ||
        opts.pickerMode === PICKER_MODE_VIZ_SUGGESTIONS ||
        opts.kind === "material" ||
        (opts.kind === "variant" && opts.brandingSearch))
    );
  }

  function isExcludedMarketingDupPath(path) {
    return EXCLUDED_MARKETING_DUP_RE.test(String(path || ""));
  }

  /** Stabilne src miniatur listy — przetrwa re-render (expand/search). */
  var _pickerThumbSrcCache = Object.create(null);

  function rememberPickerListThumb(id, src) {
    id = String(id || "").trim();
    src = String(src || "").trim();
    if (!id || !src || src === PLACEHOLDER_SVG || src.indexOf("data:image/svg") === 0) return;
    _pickerThumbSrcCache[id] = src;
  }

  function cachedPickerListThumb(id) {
    return _pickerThumbSrcCache[String(id || "").trim()] || "";
  }

  function authHeaders() {
    if (global.DamApi && typeof global.DamApi.authHeaders === "function") {
      return global.DamApi.authHeaders();
    }
    return {
      Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  function ensureBridgeSession() {
    if (global.DamApi && typeof global.DamApi.ensureSession === "function") {
      return Promise.resolve(global.DamApi.ensureSession()).then(function (res) {
        if (res && res.ok === false) throw new Error(res.error || "login_required");
        return res;
      });
    }
    return Promise.resolve({ ok: true });
  }

  var _assocOverrides = null;
  var _assocOverridesPromise = null;

  function loadAssocOverrides() {
    if (_assocOverrides) return Promise.resolve(_assocOverrides);
    if (_assocOverridesPromise) return _assocOverridesPromise;
    _assocOverridesPromise = fetch(
      "data/branding-associations-overrides.json?v=" +
        encodeURIComponent(String(global.DAM_APP_VERSION || "1"))
    )
      .then(function (r) {
        return r.ok ? r.json() : { assets: {}, folder_groups: {} };
      })
      .then(function (d) {
        _assocOverrides = d && typeof d === "object" ? d : { assets: {}, folder_groups: {} };
        _assocOverrides.assets = _assocOverrides.assets || {};
        _assocOverrides.folder_groups = _assocOverrides.folder_groups || {};
        return _assocOverrides;
      })
      .catch(function () {
        _assocOverrides = { assets: {}, folder_groups: {} };
        return _assocOverrides;
      });
    return _assocOverridesPromise;
  }

  /** Zapisane linked_product_ids wygrywaja nad spray folder_linked z indeksu. */
  function effectiveLinkedProductIds(asset) {
    if (!asset) return [];
    if (asset.linked_product_ids && asset.linked_product_ids.length) {
      return asset.linked_product_ids.slice();
    }
    return (asset.folder_linked_product_ids || []).slice();
  }

  function applyAssetAssocOverrides(asset) {
    if (!asset || !asset.id) return asset;
    var ov = _assocOverrides;
    if (!ov || !ov.assets) return asset;
    var entry = ov.assets[asset.id];
    if (!entry) return asset;
    if (entry.linked_product_ids && entry.linked_product_ids.length) {
      asset.linked_product_ids = entry.linked_product_ids.slice();
      asset.folder_linked_product_ids = [];
    }
    if (entry.linked_variant_ids) {
      asset.linked_variant_ids = entry.linked_variant_ids.slice();
    }
    if (entry.folder_group_id) {
      asset.folder_group_id = entry.folder_group_id;
    }
    return asset;
  }

  function isPhantomProductIndex(idx) {
    var base = String(idx || "")
      .split(".")[0]
      .replace(/\D/g, "");
    if (!base) return true;
    if (base === "00" || base === "000000" || base === "0000000" || base === "000103") return true;
    return base.length < 6;
  }

  function revisionVariantIdsForProduct(productId) {
    var p = productsByIdFromCache()[productId];
    if (!p) return [];
    var out = [];
    var seen = {};
    function add(idx) {
      idx = String(idx || "").trim();
      if (!idx || isPhantomProductIndex(idx)) return;
      if (!seen[idx]) {
        seen[idx] = true;
        out.push(idx);
      }
    }
    (p.revisions || []).forEach(function (rev) {
      add(rev.index);
    });
    (p.indexes || []).forEach(add);
    return out;
  }

  function mergeVariantIdsForProducts(prevVids, productIds) {
    var vids = (prevVids || []).slice();
    var seen = {};
    vids.forEach(function (v) {
      seen[String(v)] = true;
    });
    (productIds || []).forEach(function (pid) {
      revisionVariantIdsForProduct(pid).forEach(function (vid) {
        if (!seen[vid]) {
          seen[vid] = true;
          vids.push(vid);
        }
      });
    });
    return vids;
  }

  function role() {
    return String(
      (global.DamApi && typeof global.DamApi.role === "function" && global.DamApi.role()) ||
        localStorage.getItem("dam_role") ||
        "user"
    ).toLowerCase();
  }

  function isPrivileged() {
    var r = role();
    return r === "admin" || r === "power_user";
  }

  function adminModeOn() {
    return localStorage.getItem("dam_admin_mode") === "1" || localStorage.getItem("dam_viz_admin_mode") === "1";
  }

  function canEditAssoc() {
    return isPrivileged() && adminModeOn();
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    if (global.DamToast && typeof global.DamToast.show === "function") {
      global.DamToast.show(msg);
      return;
    }
    var el = document.getElementById("damTagEditToast") || document.getElementById("damExplorerToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damAssocEditToast";
      el.className = "dam-explorer-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 3600);
  }

  function ensureFileIndex() {
    if (global._DAM_FILE_INDEX && global._DAM_FILE_INDEX.products) {
      return Promise.resolve(global._DAM_FILE_INDEX);
    }
    if (global.DamSearch && typeof global.DamSearch.load === "function") {
      return global.DamSearch.load().then(function (bundle) {
        var fi = (bundle && bundle.fileIndex) || global._DAM_FILE_INDEX || { products: [] };
        if (fi) global._DAM_FILE_INDEX = fi;
        return fi;
      });
    }
    /* 3.1.5: fetch + worker race — szybsze pierwsze otwarcie pickera produktów. */
    var fetchP = fetch("data/file-index.json?v=" + Date.now())
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        global._DAM_FILE_INDEX = d;
        return d;
      });
    if (global.DamSearch && typeof global.DamSearch.load === "function") {
      var searchP = global.DamSearch.load()
        .then(function (bundle) {
          var fi = (bundle && bundle.fileIndex) || global._DAM_FILE_INDEX || null;
          if (fi) global._DAM_FILE_INDEX = fi;
          return fi;
        })
        .catch(function () {
          return null;
        });
      return Promise.race([
        fetchP,
        searchP.then(function (fi) {
          return fi || fetchP;
        }),
      ]).catch(function () {
        return global._DAM_FILE_INDEX || { products: [] };
      });
    }
    return fetchP.catch(function () {
      return global._DAM_FILE_INDEX || { products: [] };
    });
  }

  /**
   * Picker cold-open: fetch ONLY file-index (browse CAP). Do NOT DamSearch.load both
   * indexes on CTA (double JSON.parse = freeze). Search-index warms idle after apply.
   */
  function ensureFileIndexForPicker() {
    if (global._DAM_FILE_INDEX && global._DAM_FILE_INDEX.products && global._DAM_FILE_INDEX.products.length) {
      return Promise.resolve(global._DAM_FILE_INDEX);
    }
    return fetch("data/file-index.json?v=" + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error("file-index");
        return r.json();
      })
      .then(function (d) {
        global._DAM_FILE_INDEX = d;
        return d;
      })
      .catch(function () {
        return global._DAM_FILE_INDEX || { products: [] };
      });
  }

  function productIndexOf(p) {
    if (!p) return "";
    var idx = "";
    if (p.indexes && p.indexes.length) idx = String(p.indexes[0]);
    else if (p.revisions && p.revisions[0] && p.revisions[0].index) idx = String(p.revisions[0].index);
    if (idx && idx.indexOf(".") > 0) idx = idx.split(".")[0];
    return idx;
  }

  /**
   * Pelny blob wyszukiwania produktu: nazwa + id + WSZYSTKIE indeksy (pelne i
   * bazowe) + tagi + gotowy search_blob z indeksu. Dzieki temu dziala szukanie
   * po dokladnym indeksie wariantu (np. 6300539.01), nie tylko po indexes[0].
   */
  function debounce(fn, ms) {
    var timer;
    return function () {
      var self = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(self, args);
      }, ms);
    };
  }

  function shortAssocLabel(raw, maxLen) {
    raw = String(raw || "").trim();
    if (!raw) return "";
    maxLen = maxLen || 80;
    var slash = raw.replace(/\\/g, "/");
    if (slash.indexOf("/") >= 0) {
      var base = slash.split("/").pop() || slash;
      if (base.length <= maxLen) return base;
      return base.slice(0, maxLen - 1) + "…";
    }
    if (raw.length <= maxLen) return raw;
    return raw.slice(0, maxLen - 1) + "…";
  }

  function looksLikeFullPath(s) {
    s = String(s || "");
    if (!s) return false;
    if (/^[a-z]:[\\/]/i.test(s)) return true;
    if (/[\\/]/.test(s) && s.replace(/\\/g, "/").split("/").length > 2) return true;
    return /marketing[\\/]/i.test(s);
  }

  function shortPickerMetaPath(path) {
    return String(path || "")
      .replace(/^.*[\\/]Marketing[\\/]/i, "")
      .replace(/\//g, "\\");
  }

  function pickerRowMetaText(it) {
    if (!it) return "";
    var isProd = !!it.isProductRow;
    var isRev = !!it.isRevisionRow;
    var isMat =
      it.kind === "material" ||
      (!isProd && !isRev && isBrandingMaterialId(it.id));
    var parts = [];
    if (isMat) {
      var msub = it.sub || it.marketing_id || it.index || "";
      if (!msub && it.id && !looksLikeFullPath(it.id)) msub = it.id;
      if (msub) parts.push(msub);
    } else if (isProd) {
      if (it.sub && !looksLikeFullPath(it.sub)) parts.push(it.sub);
      if (it.revCount) {
        parts.push(
          String(it.revCount) + (it.revCount === 1 ? " wariant" : " warianty")
        );
      }
    } else if (isRev) {
      var idx = it.sub || "";
      if (idx && /[/\\]/.test(idx) && it.path) {
        idx = String(it.path).split(/[/\\]/).filter(Boolean).pop() || idx;
      }
      if (idx) parts.push(idx);
    } else {
      if (it.sub && !looksLikeFullPath(it.sub)) parts.push(it.sub);
      if (it.id && it.id !== it.label && !looksLikeFullPath(it.id)) parts.push(it.id);
    }
    return parts.join(" · ");
  }

  function pickerFileBasename(path) {
    var n = String(path || "").replace(/\\/g, "/");
    var i = n.lastIndexOf("/");
    return i >= 0 ? n.slice(i + 1) : n;
  }

  function pickerFileExt(path) {
    var base = pickerFileBasename(path);
    var m = base.match(/\.([^.]+)$/i);
    return m ? m[1].toUpperCase() : "";
  }

  function pickerMarketingId(it) {
    if (!it) return "";
    var sub = String(it.sub || "").trim();
    if (sub && /^M-/i.test(sub)) return sub;
    if (isBrandingMaterialId(it.id)) {
      return global.DamMarketingId && typeof global.DamMarketingId.format === "function"
        ? global.DamMarketingId.format({ id: it.id })
        : it.id;
    }
    return sub || (it.id && !looksLikeFullPath(it.id) ? it.id : "");
  }

  function pickerCompactMetaLine(it, isMat) {
    if (isMat) {
      var parts = [];
      var mid = pickerMarketingId(it);
      if (mid) parts.push(mid);
      var fname = pickerFileBasename(it.path || "");
      if (fname) parts.push(fname);
      var ext = pickerFileExt(it.path || "");
      if (ext) parts.push(ext);
      return parts.join(" · ");
    }
    return pickerRowMetaText(it);
  }

  /** Tagi w wierszu pickera są wewnątrz <button> — DamBadges zwraca <button>, co psuje DOM. */
  function pickerSanitizeInlineTags(html) {
    if (!html) return "";
    return String(html)
      .replace(/<button\b/gi, '<span role="presentation"')
      .replace(/<\/button>/gi, "</span>")
      .replace(/\stype="button"/gi, "");
  }

  /** Wiersz listy pickera — kompakt jak eksplorator (#damSearchResults). */
  function pickerSearchHitBodyHtml(it, badge, tagsInline, isMat) {
    var title = it.label || it.name || it.id || "";
    var meta = pickerCompactMetaLine(it, isMat);
    var safeTags = pickerSanitizeInlineTags(tagsInline);
    var tagsRow = safeTags
      ? '<span class="dam-search-hit__tags-inline">' + safeTags + "</span>"
      : "";
    return (
      '<span class="dam-search-hit__body">' +
      '<span class="dam-search-hit__head">' +
      '<span class="dam-search-hit__badge">' +
      esc(badge) +
      "</span>" +
      tagsRow +
      "</span>" +
      '<span class="dam-search-name">' +
      esc(title) +
      "</span>" +
      (meta ? '<span class="dam-search-meta">' + esc(meta) + "</span>" : "") +
      "</span>"
    );
  }

  function isLegacyBrId(id) {
    return /^br-\d+$/i.test(String(id || "").trim());
  }

  function isBrandingMaterialId(id) {
    return /^M-(IMG|SLI|VID|DOC|AUD|VEC)/i.test(String(id || ""));
  }

  function assetDirKey(path) {
    var p = String(path || "").replace(/\\/g, "/");
    var i = p.lastIndexOf("/");
    return i > 0 ? p.slice(0, i).toLowerCase() : p.toLowerCase();
  }

  function nameFromBrandingEntry(entry) {
    if (!entry) return "";
    var title = entry.title || entry.label || entry.name || "";
    if (title && !isLegacyBrId(title)) return String(title).trim();
    var blob = String(entry.search_blob || "");
    var parts = blob.split(/\s+x:/i);
    if (parts[0]) return parts[0].trim();
    var path = String(entry.path || "");
    if (path) {
      var base = path.replace(/\\/g, "/").split("/").pop() || "";
      if (base) return base.replace(/\.[a-z0-9]{2,8}$/i, "");
    }
    return "";
  }

  function marketingIdForBranding(entry) {
    if (!entry) return "";
    var mid = entry.marketing_id || entry.index || "";
    if (mid && !isLegacyBrId(mid)) return String(mid);
    if (global.DamMarketingId && typeof global.DamMarketingId.format === "function") {
      var fmt = global.DamMarketingId.format({
        id: entry.id,
        path: entry.path || "",
        name: entry.name || nameFromBrandingEntry(entry),
      });
      if (fmt && !isLegacyBrId(fmt)) return fmt;
    }
    return "";
  }

  function brandingDigitsOnly(s) {
    return String(s || "").replace(/\D/g, "");
  }

  /** Parity bridge _branding_picker_query_matches — M-IMG249510 / 249510 / br-049510. */
  function brandingPickerQueryMatches(entry, q) {
    q = String(q || "").trim().toLowerCase();
    if (!q || !entry) return false;
    var eid = String(entry.id || "").toLowerCase();
    var blob = String(
      (entry.search_blob || "") +
        " " +
        (entry.label || entry.name || "") +
        " " +
        (entry.marketing_id || entry.index || "") +
        " " +
        (entry.path || "")
    ).toLowerCase();
    if (q.length >= 2 && (blob.indexOf(q) >= 0 || eid.indexOf(q) >= 0)) return true;
    var qd = brandingDigitsOnly(q);
    if (qd.length < 4) return false;
    if (brandingDigitsOnly(blob).indexOf(qd) >= 0) return true;
    if (brandingDigitsOnly(eid).indexOf(qd) >= 0) return true;
    var m = /^br-(\d+)$/.exec(eid);
    if (m) {
      var digits = m[1];
      var cores = [digits];
      for (var tn = 1; tn <= 12; tn++) cores.push(String(tn) + digits.slice(1));
      for (var ci = 0; ci < cores.length; ci++) {
        if (qd.indexOf(cores[ci]) >= 0 || cores[ci].indexOf(qd) >= 0) return true;
      }
    }
    var mk = q.replace(/^m[-_]?/, "").match(/^([a-z]{2,8})[_-]?(\d{5,6})/);
    if (mk) {
      var wantCore = mk[2];
      if (blob.indexOf(wantCore) >= 0 || brandingDigitsOnly(blob).indexOf(wantCore) >= 0) return true;
    }
    return false;
  }

  function brandingThumbUrl(entry) {
    return pickerListThumbUrl(entry);
  }

  function brandingEntryToPickerRow(entry) {
    if (!entry || !entry.id) return null;
    var label = nameFromBrandingEntry(entry);
    if (!label || isLegacyBrId(label)) {
      label = shortAssocLabel(
        entry.path ? String(entry.path).replace(/\\/g, "/").split("/").pop() : entry.id
      );
    }
    var mid = marketingIdForBranding(entry);
    return {
      id: entry.id,
      name: label,
      label: label,
      thumb: brandingThumbUrl(entry),
      thumb_url: brandingThumbUrl(entry),
      preview_src: pickerPreviewSrc(entry),
      path: entry.path || "",
      marketing_id: mid,
      index: mid,
      search_blob: entry.search_blob || "",
    };
  }

  function brandingPathById(entries) {
    var map = {};
    (entries || []).forEach(function (entry) {
      if (entry && entry.id) map[entry.id] = entry.path || "";
    });
    return map;
  }

  function filterBrandingVariantIdsForPrimary(primary, ids, pathById) {
    pathById = pathById || {};
    primary = primary || {};
    if (!primary.path) return (ids || []).slice();
    var primaryDir = assetDirKey(primary.path);
    return (ids || []).filter(function (id) {
      id = String(id || "").trim();
      if (!id) return false;
      if (id === primary.id) return true;
      var p = pathById[id] || "";
      if (!p) return false;
      return assetDirKey(p) === primaryDir;
    });
  }

  function revisionPickerKey(productId, revPath) {
    return "rev:" + productId + ":" + String(revPath || "").replace(/\\/g, "/");
  }

  function parseRevisionPickerKey(key) {
    var m = /^rev:([^:]+):(.+)$/.exec(String(key || ""));
    if (!m) return null;
    return { productId: m[1], revisionPath: m[2] };
  }

  /** Etykieta wiersza rewizji: BANOFFEE KAKAO · PL · 6300728 */
  function revisionPickerLabel(prodName, rev, revIdx) {
    var name = String(prodName || rev.folder || rev.label || rev.name || "Wariant").trim();
    var langs = (rev && rev.langs) || [];
    var langBit =
      langs.length > 0
        ? langs
            .map(function (lg) {
              return String(lg).toUpperCase();
            })
            .join(", ")
        : "";
    var idx = String(revIdx || rev.index || rev.index_base || "")
      .split(".")[0]
      .trim();
    var parts = [name];
    if (langBit) parts.push(langBit);
    if (idx) parts.push(idx);
    return parts.join(" · ");
  }

  /** Po wyborze jednej rewizji — dodaj wszystkie rewizje produktu (PL+EN z file-index). */
  function expandPicksToAllProductRevisions(picks) {
    picks = picks || [];
    if (!picks.length) return picks;
    var fi = global._DAM_FILE_INDEX;
    var products = (fi && fi.products) || [];
    var byId = {};
    products.forEach(function (p) {
      if (p && p.id) byId[p.id] = p;
    });
    var out = [];
    var seenRev = {};
    var seenProd = {};
    picks.forEach(function (pick) {
      var productId = "";
      var revPath = "";
      if (pick && typeof pick === "object" && pick.revisionPath) {
        productId = String(pick.productId || "").trim();
        revPath = String(pick.revisionPath || "").trim();
      } else if (typeof pick === "string") {
        var parsed = parseRevisionPickerKey(pick);
        if (parsed) {
          productId = parsed.productId;
          revPath = parsed.revisionPath;
        } else {
          productId = pick;
        }
      }
      if (!productId) return;
      var prod = byId[productId];
      if (!prod || !prod.revisions || !prod.revisions.length) {
        if (revPath) {
          var k1 = productId + "|" + revPath;
          if (!seenRev[k1]) {
            seenRev[k1] = true;
            out.push({ productId: productId, revisionPath: revPath });
          }
        }
        return;
      }
      if (seenProd[productId]) return;
      seenProd[productId] = true;
      (prod.revisions || []).forEach(function (rev) {
        if (!rev || !rev.path) return;
        var k2 = productId + "|" + rev.path;
        if (seenRev[k2]) return;
        seenRev[k2] = true;
        out.push({ productId: productId, revisionPath: rev.path });
      });
    });
    return out.length ? out : picks;
  }

  function pickerUsesBrandingApi(opts) {
    return opts && (opts.kind === "material" || (opts.kind === "variant" && opts.brandingSearch));
  }

  /* Viz „Dodaj warianty” = async DamSearch (jak #damFileSearch), NIE full products.forEach.
     GOLDEN path (kind=product) = warm file-index + lokalny filter z twardym break na CAP. */
  function pickerUsesAsyncProductSearch(opts) {
    return !!(opts && opts.productSearchForVariants);
  }

  /* Skip warm TYLKO gdy lista nie pochodzi z file-index:
     - material / brandingSearch → API branding-search-picker
     GOLDEN kind=product + viz-warianty (productSearchForVariants) = warm file-index + lokalny browse.
     NIGDY nie skip warm dla productSearchForVariants (4.0.63 — jak branding „Dodaj produkty”). */
  function pickerSkipsWarmFileIndex(opts) {
    return !!(
      opts &&
      (opts.kind === "material" ||
        (opts.kind === "variant" && opts.brandingSearch))
    );
  }

  /**
   * Zbierz wiersze produktów do pickera z TWARDyn break (for, nie forEach).
   * forEach + `return` przy CAP NIE przerywa pętli → freeze UI na całym file-index.
   * PICKER_SCAN_BUDGET: twardy limit iteracji gdy filtr odrzuca dużo wierszy (nie czekaj na CAP items).
   */
  function resolvePickerProductFull(p, productsById) {
    if (!p || !p.id) return p;
    if (p.revisions && p.revisions.length) return p;
    if (productsById && productsById[p.id]) return productsById[p.id];
    if (
      global._DAM_FILE_INDEX &&
      global._DAM_FILE_INDEX.productsById &&
      global._DAM_FILE_INDEX.productsById[p.id]
    ) {
      return global._DAM_FILE_INDEX.productsById[p.id];
    }
    /* NEVER DamSearch.productById here — it is O(n) find over 50k (picker freeze). */
    return p;
  }

  function collectProductPickerRows(src, optsCollect) {
    optsCollect = optsCollect || {};
    var pinnedSet = optsCollect.pinnedSet || {};
    var excl = optsCollect.excl || { ids: {}, indexes: {} };
    var q = optsCollect.q || "";
    var filterType = optsCollect.filterType || "all";
    var cap = optsCollect.cap || PICKER_LIST_CAP;
    var scanBudget = optsCollect.scanBudget || PICKER_SCAN_BUDGET;
    var asProductRow = !!optsCollect.asProductRow;
    var productsById = optsCollect.productsById || null;
    var items = [];
    var seenIds = {};
    var seenIdx = {};
    var list = src || [];
    for (var i = 0; i < list.length; i++) {
      if (items.length >= cap) break;
      if (i >= scanBudget) break;
      var p = list[i];
      if (!p || !p.id || pinnedSet[p.id]) continue;
      if (seenIds[p.id]) continue;
      /* Prefer full product (revisions[]) when DamSearch hit is thin — lazy, no map-build on open. */
      var full = resolvePickerProductFull(p, productsById);
      if (productMatchesExclude(full, excl)) continue;
      if (isExcludedMarketingDupPath(full.path || p.path)) continue;
      if (filterType !== "all" && isVisualizationLike(full)) continue;
      var idxKey = normIndexKey(productIndexOf(full) || productIndexOf(p));
      if (idxKey && seenIdx[idxKey]) continue;
      if (q && productSearchBlob(full).indexOf(q) === -1 && productSearchBlob(p).indexOf(q) === -1) {
        continue;
      }
      seenIds[p.id] = true;
      if (idxKey) seenIdx[idxKey] = true;
      var rev0 = (full.revisions && full.revisions[0]) || {};
      var revCount = (full.revisions && full.revisions.length) || 0;
      var row = {
        id: p.id,
        label: full.display_name || full.name || p.display_name || p.name || p.id,
        thumb: productThumb(full),
        sub: productIndexOf(full) || productIndexOf(p) || p.id,
        path: full.path || p.path || (full.revisions && full.revisions[0] && full.revisions[0].path) || "",
        brand: full.brand || p.brand || "",
        category: full.category || p.category || "",
        subcategory: full.subcategory_label || p.subcategory_label || "",
        langs: rev0.langs || [],
        revCount: revCount,
      };
      if (asProductRow) row.isProductRow = true;
      items.push(row);
      if (asProductRow && optsCollect.expandedProductId === p.id) {
        if (revCount) {
          for (var ri = 0; ri < full.revisions.length; ri++) {
            if (items.length >= cap) break;
            var rev = full.revisions[ri];
            if (!rev || !rev.path) continue;
            if (isExcludedMarketingDupPath(rev.path)) continue;
            var revKey = revisionPickerKey(p.id, rev.path);
            if (seenIds[revKey]) continue;
            seenIds[revKey] = true;
            var revIdx = String(rev.index || rev.index_base || productIndexOf(full) || "");
            if (revIdx.indexOf(".") > 0) revIdx = revIdx.split(".")[0];
            var prodName = full.display_name || full.name || p.display_name || p.name || p.id;
            items.push({
              id: revKey,
              label: revisionPickerLabel(prodName, rev, revIdx),
              thumb: productThumb(full),
              sub: revIdx,
              path: rev.path,
              brand: full.brand || "",
              category: full.category || "",
              subcategory: full.subcategory_label || "",
              langs: rev.langs || rev0.langs || [],
              isRevisionRow: true,
              productName: prodName,
            });
          }
        } else {
          items.push({
            id: "rev-empty:" + p.id,
            label: "Brak folderów rewizji w indeksie",
            thumb: PLACEHOLDER_SVG,
            sub: "",
            path: "",
            isRevisionRow: true,
            isEmptyRevHint: true,
          });
        }
      }
    }
    return items;
  }

  /** Indeks 630xxxx / 000xxx z kontekstu viz — dziala tez gdy brak skojarzonych materialow. */
  function pickerBootstrapQueryFromCtx(ctx, asset) {
    ctx = ctx || {};
    asset = asset || ctx.asset || {};
    var pc = ctx.productContext || {};
    var gc = ctx.groupContext || {};
    var idx = String(pc.index || pc.index_base || gc.index || asset.index || "")
      .split(".")[0]
      .trim();
    if (!idx) {
      var blob = String(
        pc.name || pc.display_name || asset.name || asset.title || asset.label || ""
      );
      var m = blob.match(/\b(630\d{4}|000\d{3})\b/);
      if (m) idx = m[1];
    }
    if (idx && idx.length >= 4) return idx;
    return String(
      asset.marketing_id ||
        pc.index ||
        pc.display_name ||
        pc.name ||
        asset.index ||
        asset.name ||
        ""
    ).trim();
  }

  function materialMatchesPickerTags(row, activeTags) {
    if (!activeTags || !activeTags.length) return true;
    var blob = String(
      (row && (row.search_blob || row.label || row.name || "")) +
        " " +
        (row.path || "") +
        " " +
        (row.marketing_id || row.index || "")
    ).toLowerCase();
    return activeTags.every(function (tag) {
      return blob.indexOf(String(tag).toLowerCase()) >= 0;
    });
  }

  function loadPickerTagGroups(cb) {
    cb = typeof cb === "function" ? cb : function () {};
    if (global.DamSearch && typeof global.DamSearch.loadSearchOnly === "function") {
      global.DamSearch.loadSearchOnly().then(function (si) {
        cb((si && si.tag_groups) || {});
      }).catch(function () {
        cb((global._DAM_SEARCH_INDEX && global._DAM_SEARCH_INDEX.tag_groups) || {});
      });
      return;
    }
    cb((global._DAM_SEARCH_INDEX && global._DAM_SEARCH_INDEX.tag_groups) || {});
  }

  function assocSearchMinChars(kind) {
    if (kind === "product") return 0;
    return 2;
  }

  function productSearchBlob(p) {
    if (!p) return "";
    var parts = [
      p.search_blob || "",
      p.display_name || "",
      p.name || "",
      p.id || "",
      (p.indexes || []).join(" "),
      (p.index_bases || []).join(" "),
      (p.tags || []).join(" "),
    ];
    return parts.join(" ").toLowerCase();
  }

  function normPath(s) {
    return String(s == null ? "" : s)
      .replace(/\\/g, "/")
      .replace(/\/+$/, "")
      .toLowerCase();
  }

  /** Dopasuj produkty do wskazanego folderu na dysku (po sciezce + rewizje + indeks w nazwie). */
  function folderRevisionIndex(folder) {
    var base = String(folder || "").replace(/\\/g, "/").split("/").pop() || "";
    var m = /(\d{7}\.\d{2}|\d{7})/.exec(base);
    return m ? m[1] : "";
  }

  function matchProductsByFolder(products, folder) {
    var f = normPath(folder);
    if (!f) return [];
    var folderIndex = folderRevisionIndex(folder);
    var exact = [];
    var byRevision = [];
    var byIndex = [];
    var under = [];
    var parent = [];
    var seen = {};

    function pushUnique(arr, id) {
      if (!id || seen[id]) return;
      seen[id] = true;
      arr.push(id);
    }

    (products || []).forEach(function (p) {
      if (!p || !p.id) return;
      var pp = normPath(p.path);
      if (pp === f) pushUnique(exact, p.id);
      else if (pp && pp.indexOf(f + "/") === 0) pushUnique(under, p.id);
      else if (pp && f.indexOf(pp + "/") === 0) pushUnique(parent, p.id);
      (p.revisions || []).forEach(function (rev) {
        if (normPath(rev.path) === f) pushUnique(byRevision, p.id);
      });
      if (folderIndex) {
        var baseIdx = folderIndex.split(".")[0];
        var indexHit = (p.indexes || []).some(function (ix) {
          var s = String(ix);
          return s === folderIndex || s === baseIdx || s.indexOf(baseIdx) === 0;
        });
        if (!indexHit) {
          indexHit = (p.index_bases || []).some(function (ix) {
            return String(ix) === baseIdx;
          });
        }
        if (indexHit) pushUnique(byIndex, p.id);
      }
    });

    return exact.concat(byRevision, byIndex, under, parent);
  }

  function productsByIdFromCache() {
    var fi = global._DAM_FILE_INDEX;
    if (!fi || !fi.products || !fi.products.length) return {};
    if (fi.productsById) return fi.productsById;
    var byId = {};
    var list = fi.products;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p && p.id) byId[p.id] = p;
    }
    fi.productsById = byId;
    return byId;
  }

  /** List thumbs: static/data OK; /media blocked here (lazy hydrate via data-path). */
  function listSafeThumb(url) {
    var u = String(url || "");
    if (!u || u === PLACEHOLDER_SVG) return PLACEHOLDER_SVG;
    if (u.indexOf("/thumb-cache?") >= 0) return u;
    if (u.indexOf("data/thumbs/") >= 0 || (u.indexOf("data/") === 0 && u.indexOf("/media?") === -1)) {
      return u;
    }
    if (u.indexOf("/media?") !== -1 || u.indexOf("preview=1") !== -1) return PLACEHOLDER_SVG;
    return u;
  }

  function normalizeBridgeMediaUrl(src) {
    var s = String(src || "").trim();
    if (!s) return "";
    var m = s.match(/^https?:\/\/127\.0\.0\.1:\d+(\/.*)$/i);
    if (m) return m[1];
    return s;
  }

  /** Preview img src must hit bridge :8766 — relative /media? on :8765 is 404. */
  function resolvePreviewMediaSrc(src) {
    var s = normalizeBridgeMediaUrl(src);
    if (!s) return "";
    if (s.indexOf("/media?") === 0 || s.indexOf("/thumb-cache?") === 0) {
      return bridgeUrl() + s;
    }
    return s;
  }

  function pickerListThumbUrl(entry) {
    if (!entry) return PLACEHOLDER_SVG;
    var t = entry.thumb || entry.thumb_url || "";
    if (t && t.indexOf("/media?") === -1 && t.indexOf("preview=1") === -1) return t;
    var path = String(entry.path || "").trim();
    var ext = fileExtPicker(path);
    if (
      path &&
      global.DamPreviewTruth &&
      typeof global.DamPreviewTruth.thumbCacheUrl === "function" &&
      /^(png|jpe?g|webp|gif|tif|tiff|bmp|psd|psb)$/i.test(ext)
    ) {
      return global.DamPreviewTruth.thumbCacheUrl(path, "grid");
    }
    if (path && /^(png|jpe?g|webp|gif|bmp|tif|tiff)$/i.test(ext)) {
      return pickerPreviewFromPath(path);
    }
    return PLACEHOLDER_SVG;
  }

  function pickerThumbOnError(img) {
    if (!img) return;
    var wrap = img.closest(".dam-assoc-edit-popover__thumb-wrap");
    if (!wrap) {
      if (global.__damBrandingThumbFallback) global.__damBrandingThumbFallback(img);
      return;
    }
    if (img.getAttribute("data-thumb-stable") === "1" || img.dataset.pickerThumbFallback === "2") {
      img.classList.add("is-broken");
      wrap.classList.add("is-broken");
      img.setAttribute("data-thumb-stable", "1");
      return;
    }
    var path = img.getAttribute("data-path") || "";
    var pidEarly = img.getAttribute("data-product-id") || "";
    if (!path && pidEarly) {
      var prodThumbErr = productThumbFromVizLatest(pidEarly);
      if (!prodThumbErr) {
        var prodErr = productsByIdFromCache()[pidEarly];
        if (prodErr) prodThumbErr = productThumb(prodErr);
      }
      if (prodThumbErr && prodThumbErr !== PLACEHOLDER_SVG) {
        var resolvedErr = listSafeThumb(prodThumbErr);
        if (resolvedErr === PLACEHOLDER_SVG) resolvedErr = resolvePreviewMediaSrc(prodThumbErr);
        if (resolvedErr && resolvedErr !== PLACEHOLDER_SVG) {
          img.src = resolvedErr;
          img.setAttribute("data-thumb-stable", "1");
          img.classList.remove("is-broken");
          if (wrap) wrap.classList.remove("is-broken");
          return;
        }
      }
      img.dataset.pickerThumbFallback = "2";
      img.classList.add("is-broken");
      wrap.classList.add("is-broken");
      img.setAttribute("data-thumb-stable", "1");
      return;
    }
    if (!path) {
      img.dataset.pickerThumbFallback = "2";
      img.classList.add("is-broken");
      wrap.classList.add("is-broken");
      img.setAttribute("data-thumb-stable", "1");
      return;
    }
    img.dataset.pickerThumbFallback = "1";
    if (
      path &&
      global.DamPreviewTruth &&
      typeof global.DamPreviewTruth.thumbCacheUrl === "function"
    ) {
      var cacheTry = global.DamPreviewTruth.thumbCacheUrl(path, "grid");
      if (cacheTry) {
        img.src = cacheTry;
        img.setAttribute("data-thumb-stable", "1");
        img.classList.remove("is-broken");
        if (wrap) wrap.classList.remove("is-broken");
        return;
      }
    }
    var preview = resolvePreviewMediaSrc(pickerPreviewFromPath(path));
    if (preview) {
      img.src = preview;
      img.setAttribute("data-thumb-stable", "1");
      var rowBtn = img.closest(".dam-assoc-edit-popover__opt[data-id]");
      if (rowBtn) rememberPickerListThumb(rowBtn.getAttribute("data-id"), preview);
      return;
    }
    var pid = img.getAttribute("data-product-id") || "";
    if (pid && typeof productThumbFromVizLatest === "function") {
      var vizThumb = productThumbFromVizLatest(pid);
      if (vizThumb) {
        img.src = listSafeThumb(vizThumb);
        img.setAttribute("data-thumb-stable", "1");
        var rowBtn2 = img.closest(".dam-assoc-edit-popover__opt[data-id]");
        if (rowBtn2) rememberPickerListThumb(rowBtn2.getAttribute("data-id"), img.src);
        return;
      }
    }
    img.dataset.pickerThumbFallback = "2";
    img.classList.add("is-broken");
    wrap.classList.add("is-broken");
    img.setAttribute("data-thumb-stable", "1");
  }

  global.__damPickerThumbOnError = pickerThumbOnError;

  var _pickerThumbIo = null;
  var _pickerThumbLoads = 0;
  var PICKER_THUMB_MAX_CONCURRENT = 8;

  function pickerThumbLazySrc(entry) {
    var direct = listSafeThumb(pickerListThumbUrl(entry));
    if (direct !== PLACEHOLDER_SVG) return direct;
    return PLACEHOLDER_SVG;
  }

  function resolvePickerThumbProbeUrl(path) {
    var url = pickerListThumbUrl({ path: path });
    if (!url || url === PLACEHOLDER_SVG) {
      url = pickerPreviewFromPath(path);
    }
    return url && url !== PLACEHOLDER_SVG ? resolvePreviewMediaSrc(url) : "";
  }

  function resolvePickerRowDisplayThumb(url) {
    if (!url || url === PLACEHOLDER_SVG) return "";
    var safe = listSafeThumb(url);
    if (safe !== PLACEHOLDER_SVG) return safe;
    if (String(url).indexOf("/media?") >= 0 || String(url).indexOf("preview=1") >= 0) {
      return resolvePreviewMediaSrc(url) || "";
    }
    return "";
  }

  /** List row thumb: cache/static only on paint — hydrate loads bridge URL once. */
  function pickerListRowThumbSrc(it) {
    if (!it) return PLACEHOLDER_SVG;
    if (it.id) {
      var cached = cachedPickerListThumb(it.id);
      if (cached) return cached;
    }
    var t = it.thumb || it.thumb_url || "";
    if (t && t.indexOf("data/thumbs/") >= 0) return t;
    var safe = listSafeThumb(t);
    if (safe !== PLACEHOLDER_SVG) return safe;
    var pid = "";
    if (it.isProductRow && it.id) pid = String(it.id);
    else if (it.isVizGridGroup && it.id) pid = String(it.id).replace(/^vizprod:/, "");
    else if (it.id && !it.isRevisionRow && !isBrandingMaterialId(it.id)) pid = String(it.id);
    if (pid) {
      var fromViz = productThumbFromVizLatest(pid);
      if (fromViz) return listSafeThumb(fromViz);
      var prod = productsByIdFromCache()[pid];
      if (prod) {
        var pt = productThumb(prod);
        if (pt && pt !== PLACEHOLDER_SVG) return pt;
      }
    }
    if (it.path) {
      var fromPath = pickerListThumbUrl(it);
      if (fromPath && fromPath !== PLACEHOLDER_SVG) return fromPath;
    }
    return PLACEHOLDER_SVG;
  }

  function hydratePickerThumbs(scope, hydrateOpts) {
    hydrateOpts = hydrateOpts || {};
    if (!scope || !scope.querySelectorAll) return;
    var imgs = scope.querySelectorAll(
      ".dam-assoc-edit-popover__thumb[data-path]:not([data-thumb-stable])," +
        ".dam-assoc-edit-popover__thumb[data-product-id]:not([data-thumb-stable])"
    );
    if (!imgs.length) return;
    function loadOne(img) {
      if (!img || img.getAttribute("data-thumb-stable")) return;
      var curSrc = String(img.getAttribute("src") || "");
      if (
        curSrc &&
        curSrc !== PLACEHOLDER_SVG &&
        curSrc.indexOf("data:image/svg") < 0
      ) {
        img.setAttribute("data-thumb-stable", "1");
        return;
      }
      var path = img.getAttribute("data-path") || "";
      var pid = img.getAttribute("data-product-id") || "";
      if (!path && pid) {
        var prodThumb = productThumbFromVizLatest(pid);
        if (!prodThumb) {
          var prod = productsByIdFromCache()[pid];
          if (prod) prodThumb = productThumb(prod);
        }
        if (prodThumb && prodThumb !== PLACEHOLDER_SVG) {
          var displayThumb = resolvePickerRowDisplayThumb(prodThumb);
          if (displayThumb) {
            img.src = displayThumb;
            img.setAttribute("data-thumb-stable", "1");
            img.classList.remove("is-broken");
            var wrapP = img.closest(".dam-assoc-edit-popover__thumb-wrap");
            if (wrapP) wrapP.classList.remove("is-broken");
            var rowBtnP = img.closest(".dam-assoc-edit-popover__opt[data-id]");
            if (rowBtnP) rememberPickerListThumb(rowBtnP.getAttribute("data-id"), img.src);
            return;
          }
        }
      }
      if (!path) return;
      if (img.getAttribute("data-thumb-probing") === "1") return;
      if (_pickerThumbLoads >= PICKER_THUMB_MAX_CONCURRENT) {
        setTimeout(function () {
          loadOne(img);
        }, 120);
        return;
      }
      img.setAttribute("data-thumb-probing", "1");
      var url = resolvePickerThumbProbeUrl(path);
      if (!url) return;
      _pickerThumbLoads++;
      var probe = new Image();
      probe.onload = function () {
        _pickerThumbLoads = Math.max(0, _pickerThumbLoads - 1);
        if (img.isConnected) {
          img.src = url;
          img.setAttribute("data-thumb-stable", "1");
          img.removeAttribute("data-thumb-probing");
          img.classList.remove("is-broken");
          var wrapOk = img.closest(".dam-assoc-edit-popover__thumb-wrap");
          if (wrapOk) wrapOk.classList.remove("is-broken");
          var rowBtn = img.closest(".dam-assoc-edit-popover__opt[data-id]");
          if (rowBtn) rememberPickerListThumb(rowBtn.getAttribute("data-id"), url);
        }
      };
      probe.onerror = function () {
        _pickerThumbLoads = Math.max(0, _pickerThumbLoads - 1);
        img.removeAttribute("data-thumb-probing");
        pickerThumbOnError(img);
      };
      probe.src = url;
    }
    if (hydrateOpts.eager || typeof IntersectionObserver === "undefined") {
      imgs.forEach(loadOne);
      return;
    }
    if (!_pickerThumbIo) {
      _pickerThumbIo = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (ent) {
            if (!ent.isIntersecting) return;
            loadOne(ent.target);
            _pickerThumbIo.unobserve(ent.target);
          });
        },
        { root: null, rootMargin: "80px", threshold: 0.01 }
      );
    }
    imgs.forEach(function (img) {
      _pickerThumbIo.observe(img);
    });
  }

  function pathDirnamePicker(path) {
    var p = String(path || "").replace(/\\/g, "/");
    var i = p.lastIndexOf("/");
    return i >= 0 ? p.slice(0, i) : "";
  }

  var PICKER_GENERIC_FOLDER_RE =
    /^(close|final|gif|gifs|export|surowe|raw|temp|old|nowe|nowy|assets?|jpg|png|psd|webp|mp4|mov|wideo|video|final_bez|bez\s*plansz)$/i;

  function pickerFileStem(name) {
    return String(name || "").replace(/\.[a-z0-9]+$/i, "");
  }

  function pickerMarketingGroupKey(row) {
    if (!row) return "_";
    if (row.folder_group_id) return "fg:" + String(row.folder_group_id).toLowerCase();
    var dir = pathDirnamePicker(row.path);
    var folderName = dir.split("/").pop() || "";
    if (PICKER_GENERIC_FOLDER_RE.test(folderName)) {
      return "file:" + pickerFileStem(row.name || row.label || row.id || "").toLowerCase();
    }
    return "dir:" + dir.toLowerCase();
  }

  function pickerFolderGroupLabel(items) {
    if (!items || !items.length) return "Materiał";
    var p = items[0];
    if (global.DamBranding && typeof global.DamBranding.marketingGroupLabelForAssets === "function") {
      var lbl = global.DamBranding.marketingGroupLabelForAssets(items);
      if (lbl) return lbl;
    }
    var path = String(p.path || "").replace(/\\/g, "/");
    var parts = path.split("/").filter(Boolean);
    for (var i = parts.length - 2; i >= 0; i--) {
      var seg = parts[i];
      if (!seg || /^(\d+|[a-z]{1,2})$/i.test(seg)) continue;
      if (PICKER_GENERIC_FOLDER_RE.test(seg)) continue;
      return seg.replace(/_/g, " ");
    }
    return shortAssocLabel(p.label || p.name || p.id || "Materiał");
  }

  function groupPickerRowsByFolder(items) {
    var byKey = {};
    var order = [];
    (items || []).forEach(function (it) {
      if (!it) return;
      var key = pickerMarketingGroupKey(it);
      if (!byKey[key]) {
        byKey[key] = [];
        order.push(key);
      }
      byKey[key].push(it);
    });
    return order.map(function (key) {
      var bucket = (byKey[key] || []).slice().sort(function (a, b) {
        return String(a.label || a.name || "").localeCompare(String(b.label || b.name || ""), "pl");
      });
      return { key: key, label: pickerFolderGroupLabel(bucket), items: bucket };
    });
  }

  function groupBrandingAssetsForPicker(list) {
    if (global.DamBranding && typeof global.DamBranding.groupMarketingAssets === "function") {
      return global.DamBranding.groupMarketingAssets(list);
    }
    var groups = groupPickerRowsByFolder(list);
    return groups.map(function (g) {
      if (!g.items || g.items.length < 2) {
        return { type: "single", assets: g.items || [] };
      }
      return {
        type: "group",
        assets: g.items,
        primary: g.items[0],
        label: g.label,
      };
    });
  }

  function groupBrandingPickerRows(items) {
    var grouped = groupBrandingAssetsForPicker(items || []);
    var out = [];
    grouped.forEach(function (g) {
      var bucket = (g.assets || []).slice();
      if (!bucket.length) return;
      if (g.type !== "group" || bucket.length < 2) {
        out.push(bucket[0]);
        return;
      }
      var primary = g.primary || bucket[0];
      var label =
        g.label ||
        (global.DamBranding && typeof global.DamBranding.marketingGroupLabelForAssets === "function"
          ? global.DamBranding.marketingGroupLabelForAssets(bucket)
          : "") ||
        shortAssocLabel(primary.label || primary.name || primary.id);
      var childIds = bucket.map(function (b) {
        return b && b.id;
      }).filter(Boolean);
      var groupKey = pickerMarketingGroupKey(primary);
      var parentRow = Object.assign({}, primary, {
        id: primary.id,
        kind: "material",
        label: shortAssocLabel(label),
        isGroupParent: true,
        groupKey: groupKey,
        childIds: childIds,
        childCount: bucket.length,
        children: bucket.slice(1).map(function (c) {
          return Object.assign({}, c, {
            kind: "material",
            label: shortAssocLabel(c.label || c.name || c.id),
            isGroupChild: true,
            groupKey: groupKey,
          });
        }),
      });
      out.push(parentRow);
    });
    return out;
  }

  function flattenBrandingGroupSelection(ids, lookupFn, groupedCache) {
    var out = [];
    var seen = {};
    var idSet = {};
    (ids || []).forEach(function (id) {
      id = String(id || "").trim();
      if (id) idSet[id] = true;
    });
    (groupedCache || []).forEach(function (parent) {
      if (!parent || !parent.isGroupParent || !parent.childIds || !parent.childIds.length) return;
      var allChildren =
        parent.childIds.every(function (cid) {
          return !!idSet[cid];
        }) || !!idSet[parent.id];
      if (!allChildren) return;
      parent.childIds.forEach(function (cid) {
        cid = String(cid || "").trim();
        if (!cid || seen[cid]) return;
        seen[cid] = true;
        out.push(cid);
      });
    });
    (ids || []).forEach(function (id) {
      id = String(id || "").trim();
      if (!id || seen[id]) return;
      if (id.indexOf("vizprod:") === 0 || id.indexOf("vizgrid:") === 0) return;
      var it = lookupFn ? lookupFn(id) : null;
      if (it && it.isGroupParent) return;
      seen[id] = true;
      out.push(id);
    });
    return out;
  }

  function buildBrandingPickerDisplayRows(groupedItems, expandedGroupKey) {
    var display = [];
    (groupedItems || []).forEach(function (it) {
      if (!it) return;
      display.push(it);
      if (it.isGroupParent && expandedGroupKey === it.groupKey && it.children && it.children.length) {
        it.children.forEach(function (child) {
          display.push(child);
        });
      }
    });
    return display;
  }

  function collectVizGridGroupedRows(optsCollect) {
    optsCollect = optsCollect || {};
    var q = String(optsCollect.q || "").toLowerCase().trim();
    var cap = optsCollect.cap || PICKER_LIST_CAP;
    var fi = global._DAM_FILE_INDEX;
    var list = (fi && fi.viz_latest) || [];
    var productsById = optsCollect.productsById || productsByIdFromCache();
    var byProduct = {};
    var order = [];
    for (var i = 0; i < list.length; i++) {
      if (Object.keys(byProduct).length >= cap) break;
      var v = list[i];
      if (!v || !v.product_id) continue;
      if (isExcludedMarketingDupPath(v.path || v.revision_path || "")) continue;
      var blob = String(
        (v.product_name || "") +
          " " +
          (v.index || "") +
          " " +
          (v.index_base || "") +
          " " +
          (v.carrier || "") +
          " " +
          (v.file || "")
      ).toLowerCase();
      if (q && blob.indexOf(q) === -1) continue;
      var pid = String(v.product_id);
      if (!byProduct[pid]) {
        byProduct[pid] = [];
        order.push(pid);
      }
      byProduct[pid].push(v);
    }
    var items = [];
    for (var oi = 0; oi < order.length; oi++) {
      if (items.length >= cap) break;
      var productId = order[oi];
      var variants = byProduct[productId] || [];
      if (!variants.length) continue;
      var prod = (productsById && productsById[productId]) || {
        id: productId,
        display_name: variants[0].product_name || productId,
      };
      var groupKey = "viz:" + productId;
      var childIds = variants.map(function (vv, idx) {
        return "vizgrid:" + productId + ":" + idx;
      });
      items.push({
        id: "vizprod:" + productId,
        isGroupParent: true,
        isVizGridGroup: true,
        groupKey: groupKey,
        childIds: childIds,
        childCount: variants.length,
        label: prod.display_name || prod.name || productId,
        thumb: variants[0].thumb_url || productThumb(prod),
        sub: productIndexOf(prod) || variants[0].index_base || "",
        brand: prod.brand || variants[0].brand || "",
        category: prod.category || "",
        subcategory: prod.subcategory_label || "",
        tag_groups: prod.tag_groups || {},
        children: variants.map(function (vv, idx) {
          return {
            id: childIds[idx],
            isGroupChild: true,
            isVizGridRow: true,
            groupKey: groupKey,
            label: (vv.carrier || vv.file || vv.index || "Wariant").replace(/\.[^.]+$/, ""),
            thumb: vv.thumb_url || "",
            sub: vv.index || vv.index_base || "",
            path: vv.path || "",
            brand: vv.brand || prod.brand || "",
            langs: vv.lang ? [vv.lang] : vv.langs || [],
          };
        }),
      });
    }
    return items;
  }

  function renderPickerFolderGroups(items, renderRow) {
    var groups = groupPickerRowsByFolder(items);
    if (groups.length <= 1 && groups[0] && groups[0].items.length <= 1) {
      return items
        .map(function (it) {
          return renderRow(it, false, false);
        })
        .join("");
    }
    return groups
      .map(function (g) {
        var rows = g.items
          .map(function (it) {
            return renderRow(it, false, false);
          })
          .join("");
        return (
          '<div class="dam-assoc-edit-popover__folder-block" role="group" aria-label="' +
          esc(g.label) +
          '">' +
          '<p class="dam-assoc-edit-popover__folder-label">' +
          esc(g.label) +
          ' <span class="dam-assoc-edit-popover__folder-count">(' +
          g.items.length +
          ")</span></p>" +
          '<ul class="dam-search-hits dam-search-hits--panel">' +
          rows +
          "</ul></div>"
        );
      })
      .join("");
  }

  var PICKER_SOURCE_EXTS = { psd: 1, psb: 1, ai: 1, indd: 1, eps: 1, pdf: 1 };

  function fileExtPicker(path) {
    var n = String(path || "").replace(/\\/g, "/");
    var dot = n.lastIndexOf(".");
    if (dot < 0) return "";
    return n.slice(dot + 1).toLowerCase();
  }

  /** PSD/PSB/AI/PDF = źródła — NIE w browse/search pickera B warianty (HARD 2026-07-26). */
  function isBrandingPickerSourceFile(entry) {
    if (!entry) return true;
    var ext = fileExtPicker(entry.path || entry.name || "");
    if (PICKER_SOURCE_EXTS[ext]) return true;
    var mt = String(entry.media_type || "").toLowerCase();
    return mt === "source" || mt === "vector" || mt === "document";
  }

  function isBrandingPickerDeliverable(entry) {
    return entry && entry.id && !isBrandingPickerSourceFile(entry);
  }

  function pickerPreviewFromPath(path) {
    path = String(path || "").trim();
    if (!path) return "";
    if (global.DamMediaPreview && typeof global.DamMediaPreview.previewUrl === "function") {
      return global.DamMediaPreview.previewUrl(path, { path: path, name: path });
    }
    return bridgeUrl() + "/media?path=" + encodeURIComponent(path) + "&preview=1";
  }

  /** Hover / PODGLAD: jeden on-demand /media (list img = listSafeThumb). */
  function pickerPreviewSrc(entry) {
    if (!entry) return "";
    var path = entry.path || "";
    if (!path) return "";
    return pickerPreviewFromPath(path);
  }

  /**
   * Branding material/wariant rows — for+break CAP (forEach+return does NOT stop).
   */
  function collectBrandingPickerRows(src, optsCollect) {
    optsCollect = optsCollect || {};
    var pinnedSet = optsCollect.pinnedSet || {};
    var q = optsCollect.q || "";
    var cap = optsCollect.cap || PICKER_LIST_CAP;
    var scanBudget = optsCollect.scanBudget || PICKER_SCAN_BUDGET;
    var activeTags = optsCollect.activeTags || [];
    var items = [];
    var seenIds = {};
    var list = src || [];
    for (var i = 0; i < list.length; i++) {
      if (items.length >= cap) break;
      if (i >= scanBudget) break;
      var material = list[i];
      if (!material || !material.id || pinnedSet[material.id] || seenIds[material.id]) continue;
      if (isExcludedMarketingDupPath(material.path)) continue;
      if (!isBrandingPickerDeliverable(material)) continue;
      var row = brandingEntryToPickerRow(material) || material;
      if (!row || !row.id) continue;
      if (!materialMatchesPickerTags(row, activeTags)) continue;
      var blob = (
        (row.label || row.name || "") +
        " " +
        (row.id || "") +
        " " +
        (row.marketing_id || row.index || "") +
        " " +
        (row.search_blob || "")
      ).toLowerCase();
      if (q && blob.indexOf(q) === -1) {
        if (!brandingPickerQueryMatches(row, q)) continue;
      }
      seenIds[row.id] = true;
      items.push({
        id: row.id,
        kind: "material",
        label: shortAssocLabel(row.label || row.name),
        thumb: pickerListThumbUrl(row),
        preview_src: row.preview_src || pickerPreviewSrc(row),
        sub: row.marketing_id || row.index || marketingIdForBranding(row) || "",
        path: row.path || material.path || "",
        folder_group_id: material.folder_group_id || row.folder_group_id || "",
        name: row.name || material.name || "",
        tags: material.tags || row.tags || [],
        asset_role: material.asset_role || row.asset_role || "",
        media_type: material.media_type || row.media_type || "",
      });
    }
    return items;
  }

  function linkedMetaByIdFromRecords(list) {
    var byId = {};
    (list || []).forEach(function (lp) {
      if (lp && lp.id) byId[lp.id] = lp;
    });
    return byId;
  }

  function linkedMetaByIdFromCtx(ctx) {
    var byId = {};
    var gc = (ctx && ctx.groupContext) || {};
    (gc.linked_products || []).forEach(function (p) {
      if (p && p.id) byId[p.id] = p;
    });
    var asset = (ctx && ctx.asset) || {};
    (asset.linked_products || []).forEach(function (p) {
      if (p && p.id && !byId[p.id]) byId[p.id] = p;
    });
    return byId;
  }

  function productIndexKeyForId(id, productsById, metaById) {
    var lp = (metaById && metaById[id]) || null;
    if (lp && lp.product_index) return normIndexKey(lp.product_index);
    var p = (productsById && productsById[id]) || lp;
    if (p) return normIndexKey(productIndexOf(p));
    return "";
  }

  /**
   * Globalna deduplikacja skojarzonych produktów: po id + po indeksie bazowym
   * (np. proteina-karmel-z-mct-ig i proteina-karmel-mct-funkcjonalny oba 6300654).
   * preferLast: nowszy id wygrywa przy konflikcie indeksu (pick folder COMBO).
   */
  function dedupeProductIds(ids, productsById, metaById, opts) {
    opts = opts || {};
    productsById = productsById || productsByIdFromCache();
    metaById = metaById || {};
    var out = [];
    var seenId = {};
    var idxToId = {};
    (ids || []).forEach(function (raw) {
      var id = String(raw || "").trim();
      if (!id) return;
      var idxKey = productIndexKeyForId(id, productsById, metaById);
      if (idxKey && idxToId[idxKey] && idxToId[idxKey] !== id) {
        if (opts.preferLast) {
          var prev = idxToId[idxKey];
          delete seenId[prev];
          out = out.filter(function (x) {
            return x !== prev;
          });
        } else {
          return;
        }
      }
      if (seenId[id]) return;
      seenId[id] = true;
      if (idxKey) idxToId[idxKey] = id;
      out.push(id);
    });
    return out;
  }

  function dedupeLinkedProductRecords(list, productsById, metaById) {
    metaById = metaById || linkedMetaByIdFromRecords(list);
    var ids = dedupeProductIds(
      (list || [])
        .map(function (lp) {
          return lp && lp.id;
        })
        .filter(Boolean),
      productsById,
      metaById
    );
    return ids.map(function (id) {
      return metaById[id] || { id: id };
    });
  }

  function selectedProductIndexKeys(selected, lookupFn) {
    var keys = {};
    Object.keys(selected || {}).forEach(function (sid) {
      if (!selected[sid]) return;
      var it = lookupFn(sid);
      var k = normIndexKey((it && it.sub) || "");
      if (k) keys[k] = sid;
    });
    return keys;
  }

  function patchLinkedProductsWithFolderPick(ctx, ids, pick) {
    if (!ctx) return;
    var productsById = productsByIdFromCache();
    var metaById = linkedMetaByIdFromCtx(ctx);
    ids = dedupeProductIds(ids, productsById, metaById, { preferLast: true });
    var gc = ctx.groupContext || {};
    var byId = {};
    (gc.linked_products || []).forEach(function (lp) {
      if (lp && lp.id) byId[lp.id] = lp;
    });
    (ctx.asset && ctx.asset.linked_products ? ctx.asset.linked_products : []).forEach(function (lp) {
      if (lp && lp.id && !byId[lp.id]) byId[lp.id] = lp;
    });
    ids.forEach(function (id) {
      if (!byId[id]) byId[id] = { id: id, display_name: id };
      if (pick && pick.index && pick.ids && pick.ids.indexOf(id) >= 0) {
        byId[id].product_index = pick.index;
        byId[id].revision_path = pick.path || byId[id].revision_path || "";
      }
    });
    gc.linked_products = ids.map(function (id) {
      return byId[id] || { id: id };
    });
    gc.linked_product_ids = ids.slice();
    if (ctx.asset) {
      ctx.asset.linked_product_ids = ids.slice();
      ctx.asset.linked_products = gc.linked_products.slice();
      ctx.asset.folder_linked_product_ids = ids.slice();
    }
  }

  /** Seed ctx po optimistic remove/add (parity patchLinkedProductsWithFolderPick). */
  function patchCtxProductIds(ctx, productIds) {
    if (!ctx) return;
    var metaById = linkedMetaByIdFromCtx(ctx);
    productIds = dedupeProductIds(productIds, productsByIdFromCache(), metaById);
    var gc = ctx.groupContext || (ctx.groupContext = {});
    var byId = {};
    (gc.linked_products || []).forEach(function (lp) {
      if (lp && lp.id) byId[lp.id] = lp;
    });
    (ctx.asset && ctx.asset.linked_products ? ctx.asset.linked_products : []).forEach(function (lp) {
      if (lp && lp.id && !byId[lp.id]) byId[lp.id] = lp;
    });
    gc.linked_products = productIds.map(function (id) {
      return byId[id] || { id: id };
    });
    gc.linked_product_ids = productIds.slice();
    if (ctx.asset) {
      ctx.asset.linked_product_ids = productIds.slice();
      ctx.asset.linked_products = gc.linked_products.slice();
      ctx.asset.folder_linked_product_ids = productIds.slice();
    }
  }

  function patchCtxVariantIds(ctx, variantIds) {
    if (!ctx) return;
    var gc = ctx.groupContext || (ctx.groupContext = {});
    var byId = {};
    (gc.variants || []).forEach(function (v) {
      if (v && v.id) byId[v.id] = v;
    });
    (ctx.asset && ctx.asset.variants ? ctx.asset.variants : []).forEach(function (v) {
      if (v && v.id && !byId[v.id]) byId[v.id] = v;
    });
    gc.variants = (variantIds || []).map(function (id) {
      return byId[id] || { id: id };
    });
    gc.linked_variant_ids = (variantIds || []).slice();
    if (ctx.asset) {
      ctx.asset.variants = gc.variants.slice();
      ctx.asset.linked_variant_ids = (variantIds || []).slice();
    }
  }

  /** Natychmiastowy UI po Zatwierdz (zapis bridge w tle). */
  function flushOptimisticAssocUi(ctx, productIds, variantIds) {
    patchCtxProductIds(ctx, productIds);
    patchCtxVariantIds(ctx, variantIds);
    if (typeof ctx.onSaved === "function") ctx.onSaved(productIds, variantIds);
    if (typeof ctx.onRefresh === "function") ctx.onRefresh();
    bustAssocThumbsInScope();
  }

  /** Odśwież miniatury w modalach po zapisie / zamknieciu pickera. */
  function bustMaterialAssocCaches(opts) {
    opts = opts || {};
    if (global.DamBranding && typeof global.DamBranding.clearComputeCache === "function") {
      global.DamBranding.clearComputeCache();
    }
  }

  function bustAssocThumbsInScope(opts) {
    opts = opts || {};
    /* Nie bustuj src globalnie — psuje dzialajace miniatury po zamknieciu pickera. */
    bustMaterialAssocCaches(opts);
  }

  /** Natychmiastowy UI sugestii materialow (viz) — enrich przed onRefresh. */
  function flushOptimisticMaterialUi(ctx, materialIds) {
    materialIds = (materialIds || []).map(String).filter(Boolean);
    ctx.selectedIds = materialIds.slice();
    if (!materialIds.length) {
      if (typeof ctx.onRefresh === "function") ctx.onRefresh({ materialIds: [], enriched: [] });
      bustAssocThumbsInScope();
      return Promise.resolve();
    }
    return enrichBrandingAssetsByIds(materialIds).then(function (rows) {
      ctx.materialsList = (rows || []).slice();
      ctx.shownPrimaries = (rows || []).slice();
      if (typeof ctx.onRefresh === "function") {
        ctx.onRefresh({ materialIds: materialIds, enriched: rows || [] });
      }
      bustAssocThumbsInScope();
      return rows;
    });
  }

  function patchAssetProductIds(asset, productIds) {
    if (!asset) return;
    var byId = {};
    (asset.linked_products || []).forEach(function (p) {
      if (p && p.id) byId[p.id] = p;
    });
    asset.linked_products = (productIds || []).map(function (id) {
      return byId[id] || { id: id };
    });
    asset.linked_product_ids = (productIds || []).slice();
    asset.folder_linked_product_ids = (productIds || []).slice();
  }

  /**
   * Seed UI + toast natychmiast; zapis bridge w kolejce (retry, bez rollbacku przy timeout).
   * Cofnij = undoCfg.onUndo (przywraca stan + osobny zapis).
   */
  function seedEnrichAssocSave(ctx, productIds, variantIds, undoCfg) {
    undoCfg = undoCfg || {};
    if (global.DamDanger && typeof global.DamDanger.toastUndo === "function") {
      global.DamDanger.toastUndo(undoCfg);
    } else if (undoCfg.message) {
      toast(undoCfg.message);
    }
    return enqueueAssocSave(ctx, productIds, variantIds, {
      silentToast: true,
      suppressErrorToast: true,
      optimistic: true,
    });
  }

  var ASSOC_CSS_ID = "damAssocEditInjectedCss";
  var ASSOC_CSS_TOKEN = "assocPickerActionsSlot67Align20260729l";
  var PICKER_LIST_CAP = 80;
  /* Max raw iterations in collect (defense vs filter that skips most rows before CAP). */
  var PICKER_SCAN_BUDGET = 400;
  var PICKER_TAG_GROUP_ORDER = ["marka", "autor", "skojarzenia", "przeznaczenie", "produkt", "kanal"];
  var PICKER_TAG_GROUP_LABELS = {
    marka: "Marka",
    autor: "Autor",
    skojarzenia: "Skojarzenia",
    przeznaczenie: "Przeznaczenie",
    produkt: "Produkt",
    kanal: "Kanał",
  };
  /** Keyboard Shift latch — mouseleave/mousemove must not clear while key is down. */
  var shiftKeyDown = false;

  /** Wstrzykuje style: Bento grid + pkt 36 podgląd LEWA | lista PRAWA (nie ruszamy plikow agentow). */
  function ensureInjectedCss() {
    var style = document.getElementById(ASSOC_CSS_ID);
    if (style && style.getAttribute("data-token") === ASSOC_CSS_TOKEN && style.textContent) {
      return;
    }
    if (style) style.remove();
    var css =
      /* Shell / bento grid popover — HARD: 70vw × 90vh (wszędzie: branding + viz) */
      ".dam-assoc-edit-overlay{overflow:hidden;}" +
      ".dam-assoc-edit-overlay #damAssocEditPopover.dam-thumb-picker-box," +
      ".dam-assoc-edit-overlay .dam-thumb-picker-box.dam-assoc-edit-popover{" +
      "display:grid!important;grid-template-columns:minmax(0,1fr);" +
      "grid-template-rows:auto auto minmax(0,1fr) auto;" +
      "grid-template-areas:'head' 'pinned' 'body' 'actions';" +
      "width:70vw!important;min-width:min(70vw,calc(100vw - 16px))!important;" +
      "max-width:min(70vw,calc(100vw - 16px))!important;" +
      "height:90vh!important;min-height:90vh!important;max-height:90vh!important;" +
      "overflow-x:hidden!important;overflow-y:hidden!important;}" +
      ".dam-assoc-edit-popover > .dam-thumb-picker__head{grid-area:head;min-height:53px;box-sizing:border-box;padding:10px 14px;" +
      "border-bottom:1px solid #ececf2;display:flex;align-items:center;justify-content:space-between;gap:8px;}" +
      ".dam-assoc-edit-overlay{z-index:12300!important;}" +
      ".dam-assoc-edit-overlay .dam-thumb-picker__head .dam-viz-modal-close{" +
      "position:static!important;top:auto!important;right:auto!important;" +
      "flex:0 0 auto;margin-left:8px;pointer-events:auto!important;z-index:2;cursor:pointer;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__pinned-wrap{grid-area:pinned;min-width:0;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__section-sep{display:none;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__body{grid-area:body;min-height:0;min-width:0;overflow:hidden;}" +
      ".dam-assoc-edit-popover__list-col{min-width:0;display:flex;flex-direction:column;min-height:0;overflow:hidden;}" +
      ".dam-assoc-edit-popover__list-col > .dam-tag-edit-popover__search-wrap{flex:0 0 auto;margin:0 0 8px;border-bottom:none;padding:0 12px;}" +
      ".dam-assoc-edit-popover .dam-search-wrap--picker{padding:0;border:none;box-shadow:none;background:transparent;}" +
      ".dam-assoc-edit-popover .dam-search-wrap--picker .dam-search-input{min-height:40px;padding:8px 12px 8px 38px!important;font-size:13px!important;}" +
      ".dam-assoc-edit-popover__list-col > .dam-assoc-edit-popover__list{flex:1 1 auto;min-height:0;}" +
      ".dam-assoc-edit-popover > .dam-thumb-picker__footer{grid-area:actions;}" +
      /* Body: preview LEFT | list RIGHT (scroll w liscie) */
      ".dam-assoc-edit-popover__body{display:grid;grid-template-columns:minmax(180px,22%) minmax(0,1fr);gap:14px;" +
      "padding:14px 16px;min-height:0;overflow:hidden;}" +
      ".dam-assoc-edit-popover__preview{min-width:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;" +
      "gap:6px;align-content:start;}" +
      ".dam-assoc-edit-popover__preview-label{margin:0;font-size:10px;font-weight:700;letter-spacing:.08em;" +
      "text-transform:uppercase;color:#8b8d97;}" +
      ".dam-assoc-edit-popover__preview-frame{position:relative;min-height:168px;aspect-ratio:1;" +
      "display:flex;align-items:center;justify-content:center;" +
      "background:linear-gradient(180deg,#faf9fc 0%,#f3f1f7 100%);border:1px solid #ececf1;" +
      "border-radius:14px;overflow:hidden;padding:12px;}" +
      ".dam-assoc-edit-popover__preview-frame img{max-width:100%;max-height:100%;width:auto;height:auto;" +
      "object-fit:contain;border-radius:8px;}" +
      ".dam-assoc-edit-popover__preview-frame img.is-placeholder{opacity:0;position:absolute;width:1px;height:1px;}" +
      ".dam-assoc-edit-popover__preview-empty{display:none;flex-direction:column;align-items:center;justify-content:center;" +
      "gap:6px;color:#a8a8b3;font-size:11px;font-weight:500;}" +
      ".dam-assoc-edit-popover__preview-empty i{font-size:28px;color:#c4bdd2;}" +
      ".dam-assoc-edit-popover__preview.is-empty .dam-assoc-edit-popover__preview-empty{display:flex;}" +
      /* Assoc empty copy — NOT .dam-tag-edit-popover__empty (tutorial MO + showSad = freeze). */
      ".dam-assoc-edit-popover__empty-msg{margin:12px 8px;padding:0;color:#8b8d97;font-size:13px;line-height:1.4;text-align:center;}" +
      ".dam-assoc-edit-popover__preview-caption{font-size:12px;font-weight:600;color:#464255;line-height:1.3;" +
      "text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}" +
      ".dam-assoc-edit-popover__preview-meta{font-size:10px;font-weight:600;color:#8b8d97;text-align:center;" +
      "letter-spacing:.02em;font-variant-numeric:tabular-nums;}" +
      /* List: CSS Grid rows — kompakt, czytelne */
      ".dam-assoc-edit-popover__body .dam-assoc-edit-popover__list," +
      ".dam-assoc-edit-popover__body .dam-tag-edit-popover__list{" +
      "min-width:0;max-height:none;height:100%;overflow-x:hidden!important;overflow-y:auto;" +
      "padding:6px 0;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin;}" +
      ".dam-assoc-edit-popover__opt-row{display:grid!important;" +
      "grid-template-columns:67px minmax(0,1fr) 28px;grid-template-areas:'actions main expand';" +
      "align-items:center;column-gap:8px;border-radius:0;min-width:0;min-height:84px;width:100%;" +
      "box-sizing:border-box;margin:0;border:none;background:transparent;flex:0 0 auto;list-style:none;}" +
      ".dam-assoc-edit-popover__opt-row .dam-assoc-edit-popover__row-actions{grid-area:actions;" +
      "width:67px;min-width:67px;max-width:67px;justify-content:flex-start;display:flex;align-items:center;" +
      "gap:3px;flex-shrink:0;box-sizing:border-box;}" +
      ".dam-assoc-edit-popover__row-btn-spacer{flex:0 0 32px;width:32px;height:32px;display:block;}" +
      ".dam-assoc-edit-popover__opt-row>.dam-assoc-edit-popover__expand{grid-area:expand;justify-self:end;}" +
      ".dam-assoc-edit-popover__opt-row .dam-assoc-edit-popover__opt{grid-area:main;min-width:0;width:100%;}" +
      ".dam-assoc-edit-popover__opt{display:grid!important;" +
      "grid-template-columns:minmax(18px,72px) 60px minmax(0,1fr);grid-template-areas:'check thumb body';" +
      "align-items:center;column-gap:12px;row-gap:0;width:100%;min-height:84px;" +
      "padding:8px 12px!important;border-radius:0;box-sizing:border-box;border:none;background:transparent;" +
      "overflow:hidden;contain:layout style;}" +
      ".dam-assoc-edit-popover__opt .dam-search-hit__thumb-wrap{grid-area:thumb;flex:none;width:60px;height:60px;" +
      "margin:0;border-radius:6px;overflow:hidden;background:#f4f4f6;border:1px solid #ececf1;" +
      "display:flex;align-items:center;justify-content:center;}" +
      ".dam-assoc-edit-popover__opt .dam-search-hit__body{grid-area:body;min-width:0;display:grid!important;" +
      "grid-template-rows:auto auto auto;grid-template-columns:minmax(0,1fr);gap:3px;overflow:hidden;}" +
      ".dam-assoc-edit-popover__opt .dam-search-hit__head{display:flex!important;align-items:center;gap:6px;" +
      "min-width:0;overflow:hidden;flex-wrap:nowrap;justify-content:flex-start;}" +
      ".dam-assoc-edit-popover__opt .dam-search-hit__tags-inline," +
      ".dam-assoc-edit-popover__opt .dam-viz-card__badges{display:inline-flex!important;flex:0 1 auto;" +
      "flex-wrap:nowrap;gap:5px;align-items:center;min-width:0;width:auto!important;" +
      "min-height:0!important;max-height:none!important;justify-content:flex-start!important;margin:0!important;}" +
      ".dam-assoc-edit-popover__opt .dam-search-hit__tags-inline .dam-viz-badge{" +
      "font-size:calc(var(--dam-tag-fs-pill,10.5px) * 0.95);padding:2px 7px;line-height:1.35;" +
      "white-space:nowrap;flex:0 0 auto;max-width:none;overflow:visible;}" +
      ".dam-assoc-edit-popover__opt .dam-search-hit__badge{flex:0 0 auto;}" +
      ".dam-assoc-edit-popover__opt .dam-search-name{font-size:13px;font-weight:600;line-height:1.4;color:#464255;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;padding-bottom:1px;}" +
      ".dam-assoc-edit-popover__opt .dam-search-meta{font-size:11px;color:#8b8d97;line-height:1.4;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;margin:0;padding-bottom:1px;}" +
      ".dam-assoc-edit-popover__pinned .dam-search-hits,.dam-assoc-edit-popover__list .dam-search-hits{" +
      "list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;flex:1 1 auto;" +
      "min-height:0;width:100%;overflow:visible;}" +
      ".dam-assoc-edit-popover__thumb-wrap.is-broken::after{content:\"\";position:absolute;inset:0;" +
      "background:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23b8b8c3' d='M4 5h16v14H4zm2 2v10h12V7zm2 2h8v6H8z'/%3E%3C/svg%3E\") center/20px no-repeat;}" +
      ".dam-assoc-edit-popover__thumb-wrap{position:relative;}" +
      ".dam-assoc-edit-popover__list .dam-search-hit--material .dam-search-hit__badge{color:#6c5ce7;background:#f3eefc;}" +
      ".dam-assoc-edit-popover__list .dam-search-hit--nested{margin-left:24px;width:calc(100% - 24px);}" +
      ".dam-assoc-edit-popover__list .dam-search-hit--nested .dam-search-hit__row{padding-left:28px!important;position:relative;}" +
      ".dam-assoc-edit-popover__list .dam-search-hit--nested .dam-search-hit__row::before{content:\"\";position:absolute;" +
      "left:14px;top:10px;bottom:10px;width:2px;border-radius:2px;background:#d7c9f0;}" +
      ".dam-assoc-edit-popover__opt .dam-search-hit__check{grid-area:check;flex:none;align-self:center;margin:0;" +
      "width:20px;height:20px;border-radius:5px;}" +
      ".dam-assoc-edit-popover__opt.is-selected .dam-search-hit__check.is-on," +
      ".dam-assoc-edit-popover__opt.is-selected .dam-search-hit__check{border-color:#ab54db;background:#ab54db;color:#fff;}" +
      ".dam-assoc-edit-popover__opt-row.is-expanded>.dam-assoc-edit-popover__expand{color:#7a3aa8;}" +
      ".dam-assoc-edit-popover__thumb-wrap{flex:0 0 60px;width:60px;height:60px;border-radius:6px;" +
      "overflow:hidden;background:linear-gradient(180deg,#faf9fc 0%,#f3f1f7 100%);" +
      "border:1px solid #ececf1;display:flex;align-items:center;justify-content:center;}" +
      ".dam-assoc-edit-popover__check{flex:0 0 22px;}" +
      ".dam-assoc-edit-popover__thumb{width:auto!important;height:auto!important;max-width:60px;max-height:60px;" +
      "object-fit:contain;border-radius:0;background:transparent;border:none;transition:none;}" +
      ".dam-assoc-edit-popover__folder-block{margin:0 0 14px;padding:0;border:none;overflow:visible;}" +
      ".dam-assoc-edit-popover__folder-label{margin:0;padding:10px 12px 6px;font-size:12px;font-weight:600;" +
      "letter-spacing:.02em;text-transform:uppercase;color:var(--dam-muted,#6b7280);" +
      "background:color-mix(in srgb,var(--dam-surface-2,#f6f7f9) 92%,#fff);}" +
      ".dam-assoc-edit-popover__folder-count{font-weight:500;opacity:.85;}" +
      ".dam-assoc-edit-popover__meta{min-width:0;overflow:hidden;}" +
      ".dam-assoc-edit-popover__label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" +
      "font-size:13px;font-weight:400;color:#464255;line-height:1.35;}" +
      /* Tagi jak na kartach viz (DK / BATONY / Mixy / PL) — nie tiny cut-off */
      ".dam-assoc-edit-popover__tags{display:flex;flex-wrap:wrap;gap:4px;max-height:none;overflow:visible;margin-top:4px;}" +
      ".dam-assoc-edit-popover__tags .dam-viz-badge{" +
      "font-size:calc((var(--dam-tag-fs-pill,10.5px) + 1px) * var(--dam-badge-scale,1.05))!important;font-weight:500;" +
      "padding:calc(5px * var(--dam-badge-scale,1.05)) calc(11px * var(--dam-badge-scale,1.05))!important;border-radius:999px;letter-spacing:.01em;line-height:1.25;" +
      "white-space:nowrap;max-width:100%;cursor:default;}" +
      ".dam-assoc-edit-popover__tags .dam-viz-badge--index{cursor:copy;user-select:text;}" +
      ".dam-assoc-edit-popover__row-actions{display:flex;align-items:center;gap:3px;flex-shrink:0;padding-right:4px;}" +
      ".dam-assoc-edit-popover__row-btn{width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;" +
      "border:1px solid #c8c8d0;border-radius:8px;background:#fff;color:#464255;cursor:pointer;font-size:16px;" +
      "transition:background .12s ease,color .12s ease,border-color .12s ease;}" +
      ".dam-assoc-edit-popover__row-btn:hover{background:#f8f4fd;color:var(--dam-primary,#ab54db);border-color:#e2d3f2;}" +
      ".dam-assoc-edit-popover__opt-row--revision{margin:8px 0 8px 28px;padding:8px 10px 8px 12px;" +
      "border-left:3px solid #e2d3f2;background:color-mix(in srgb,#f8f4fd 72%,#fff);border-radius:0 10px 10px 0;" +
      "opacity:1;min-height:58px;}" +
      ".dam-assoc-edit-popover__opt-row--revision .dam-assoc-edit-popover__label{" +
      "white-space:normal;overflow:visible;text-overflow:clip;line-height:1.25;max-height:2.5em;" +
      "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" +
      ".dam-assoc-edit-popover__opt--product{margin-top:0;margin-bottom:0;}" +
      ".dam-assoc-edit-popover__opt--product .dam-assoc-edit-popover__label{font-weight:600;}" +
      ".dam-assoc-edit-popover__opt--product,.dam-assoc-edit-popover__opt--group-parent{cursor:pointer;}" +
      ".dam-assoc-edit-popover__opt--product.is-expanded,.dam-assoc-edit-popover__opt--group-parent.is-expanded{background:#f8f4fd!important;" +
      "box-shadow:inset 0 0 0 1px #e2d3f2;}" +
      ".dam-assoc-edit-popover__opt-row.is-expanded>.dam-assoc-edit-popover__opt--product," +
      ".dam-assoc-edit-popover__opt-row.is-expanded>.dam-assoc-edit-popover__opt--group-parent{background:#f8f4fd!important;" +
      "box-shadow:inset 0 0 0 1px #e2d3f2;}" +
      ".dam-assoc-edit-popover__expand{flex:0 0 22px;display:inline-flex;align-items:center;" +
      "justify-content:center;color:#8b8d97;font-size:18px;line-height:1;cursor:pointer;border-radius:6px;" +
      "transition:color .12s ease,background .12s ease;}" +
      ".dam-assoc-edit-popover__opt-row>.dam-assoc-edit-popover__expand:hover{color:#7a3aa8;background:#f8f4fd;}" +
      ".dam-assoc-edit-popover__opt--product.is-expanded .dam-assoc-edit-popover__expand{color:#7a3aa8;}" +
      ".dam-assoc-edit-popover__opt--revision .dam-assoc-edit-popover__label{font-weight:500;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.35;}" +
      ".dam-assoc-edit-popover__opt--revision{padding:9px 11px!important;min-height:58px;}" +
      ".dam-assoc-edit-popover__opt-row--revision.is-hint .dam-assoc-edit-popover__opt{opacity:.7;cursor:default;}" +
      ".dam-assoc-edit-popover__expand-hint{display:block;font-size:11px;font-weight:500;color:#8b8d97;margin-top:2px;}" +
      ".dam-assoc-edit-popover__tag-filters-wrap{grid-area:tagfilters;padding:0 14px;border-bottom:1px solid #ececf2;}" +
      ".dam-assoc-edit-popover__tag-filters{display:flex;gap:10px;align-items:stretch;padding:20px 0;min-height:0;}" +
      ".dam-assoc-edit-popover__tag-filters-nav{flex:0 0 132px;display:flex;flex-direction:column;gap:6px;}" +
      ".dam-assoc-edit-popover__tag-filters-nav select{width:100%;font-size:12px;padding:6px 8px;border-radius:8px;border:1px solid #e7e7ec;background:#fff;}" +
      ".dam-assoc-edit-popover__tag-filters-viewport{flex:1 1 auto;overflow:hidden;position:relative;min-width:0;}" +
      ".dam-assoc-edit-popover__tag-filters-track{display:flex;flex-direction:column;transition:transform .15s ease;will-change:transform;}" +
      ".dam-assoc-edit-popover__tag-filters-page{flex:0 0 auto;display:flex;flex-direction:column;gap:8px;min-height:88px;}" +
      ".dam-assoc-edit-popover__tag-group-row{display:flex;align-items:flex-start;gap:8px;min-height:36px;}" +
      ".dam-assoc-edit-popover__tag-group-label{flex:0 0 92px;font-size:11px;font-weight:600;color:#8b8d97;padding-top:6px;}" +
      ".dam-assoc-edit-popover__tag-group-pills{display:flex;flex-wrap:wrap;gap:4px;min-width:0;}" +
      ".dam-assoc-edit-popover__tag-group-pills .dam-viz-badge{font-size:11px!important;padding:4px 9px!important;cursor:pointer;}" +
      ".dam-assoc-edit-popover__tag-group-pills .dam-viz-badge.is-active{outline:2px solid var(--dam-primary,#ab54db);outline-offset:1px;}" +
      ".dam-assoc-edit-popover__pinned .dam-search-hit__row.is-selected{background:transparent!important;" +
      "box-shadow:inset 3px 0 0 #ab54db!important;}" +
      ".dam-assoc-edit-popover__pinned .dam-search-hit__row.is-preview-active{background:transparent!important;" +
      "box-shadow:none!important;}" +
      ".dam-assoc-edit-popover__pinned .dam-search-hit__row.is-preview-active.is-selected{" +
      "box-shadow:inset 3px 0 0 #ab54db!important;}" +
      ".dam-assoc-edit-popover__opt.is-pinned:not(.is-selected) .dam-assoc-edit-popover__check{color:#e2506b;}" +
      ".dam-assoc-edit-popover__opt.is-pinned:not(.is-selected) .dam-assoc-edit-popover__check{width:22px;font-size:17px;}" +
      ".dam-assoc-edit-popover__opt.is-pinned.is-selected .dam-search-hit__check," +
      ".dam-assoc-edit-popover__pinned .dam-search-hit__check.is-on{display:inline-flex;align-items:center;gap:4px;" +
      "width:auto;min-width:72px;max-width:100%;justify-content:flex-end;font-size:15px;color:#ab54db;}" +
      ".dam-assoc-edit-popover__opt.is-pinned.is-selected .dam-search-hit__check .uil-check," +
      ".dam-assoc-edit-popover__pinned .dam-search-hit__check.is-on .uil-check{flex:0 0 auto;}" +
      ".dam-assoc-edit-popover__opt.is-pinned .dam-assoc-edit-popover__check .uil-times{" +
      "font-size:17px!important;line-height:1;display:inline-block;width:auto;height:auto;" +
      "background:none!important;box-shadow:none!important;color:#e2506b!important;}" +
      ".dam-assoc-edit-popover__check-label{font-size:11px;font-weight:600;color:#ab54db;letter-spacing:.02em;white-space:nowrap;line-height:1.2;}" +
      ".dam-assoc-edit-popover__opt.is-preview-active:not(.is-pinned){background:#f8f4fd!important;" +
      "box-shadow:inset 0 0 0 1px #e2d3f2;}" +
      ".dam-assoc-edit-popover__opt:hover{background:#f8f4fd;}" +
      ".dam-assoc-edit-popover__pinned{max-height:min(34dvh,280px);overflow-x:hidden;overflow-y:auto;}" +
      ".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt-row{min-height:84px;}" +
      ".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt{align-items:center!important;" +
      "min-height:84px;padding:8px 12px!important;}" +
      /* Shift-gated bubble minus (brandComposer20260721a / minusGlobal): ×0.8 (26→21) Geex chip;
         assoc-item + all-file quality tiles (studio show-all). NOT flat fat disc. */
      ".dam-media-preview__assoc-grid.is-shift-hover," +
      ".dam-media-preview__variant-grid.is-shift-hover," +
      ".dam-media-preview__all-files.is-shift-hover," +
      ".dam-media-preview__assoc-grid.is-shift-hover .dam-media-preview__assoc-item," +
      ".dam-media-preview__variant-grid.is-shift-hover .dam-media-preview__assoc-item," +
      ".dam-media-preview__variant-grid.is-shift-hover .dam-viz-modal__variant{position:relative;}" +
      ".dam-media-preview__assoc-item," +
      ".dam-media-preview__all-file," +
      ".dam-viz-modal__variant{position:relative;}" +
      ".dam-media-preview__assoc-item .dam-assoc-quick-minus," +
      ".dam-media-preview__all-file .dam-assoc-quick-minus," +
      ".dam-viz-modal__variant .dam-assoc-quick-minus{" +
      "position:absolute;top:3px;right:3px;z-index:4;width:21px;height:21px;border-radius:999px;" +
      "border:1px solid rgba(255,255,255,.96);" +
      "background:linear-gradient(180deg,color-mix(in srgb,#ef4444 88%,#fff) 0%,#dc2626 100%);" +
      "color:#fff;display:inline-flex;align-items:center;justify-content:center;" +
      "cursor:pointer;padding:0;box-sizing:border-box;" +
      "box-shadow:0 1px 2px rgba(40,36,56,.10),0 2px 6px rgba(220,38,38,.16);" +
      "opacity:0!important;visibility:hidden!important;pointer-events:none!important;" +
      "transition:opacity .12s ease,visibility .12s ease,background .12s ease,transform .12s ease,box-shadow .12s ease;}" +
      ".dam-media-preview__assoc-grid.is-shift-hover .dam-assoc-quick-minus," +
      ".dam-media-preview__variant-grid.is-shift-hover .dam-assoc-quick-minus," +
      ".dam-media-preview__all-files.is-shift-hover .dam-assoc-quick-minus," +
      ".dam-assoc-quick-minus.is-shift-visible{" +
      "opacity:1!important;visibility:visible!important;pointer-events:auto!important;}" +
      ".dam-media-preview__assoc-grid.is-shift-hover .dam-assoc-quick-minus:hover," +
      ".dam-media-preview__variant-grid.is-shift-hover .dam-assoc-quick-minus:hover," +
      ".dam-media-preview__all-files.is-shift-hover .dam-assoc-quick-minus:hover," +
      ".dam-assoc-quick-minus.is-shift-visible:hover," +
      ".dam-assoc-quick-minus.is-hover-force{" +
      "opacity:1!important;visibility:visible!important;pointer-events:auto!important;" +
      "background:linear-gradient(180deg,#ef4444 0%,#dc2626 100%);transform:scale(1.05);" +
      "box-shadow:0 1px 2px rgba(40,36,56,.12),0 3px 8px rgba(220,38,38,.22);}" +
      ".dam-assoc-quick-minus.is-holding," +
      ".dam-assoc-quick-minus.dam-danger-holding{" +
      "background:linear-gradient(180deg,#dc2626 0%,#b91c1c 100%);transform:scale(.98);" +
      "box-shadow:inset 0 0 0 1px rgba(255,255,255,.85),0 2px 6px rgba(220,38,38,.2);}" +
      ".dam-assoc-quick-minus i{" +
      "font-size:0!important;line-height:0;pointer-events:none;display:block;" +
      "width:9px;height:2.5px;background:#fff;border-radius:2px;" +
      "box-shadow:0 0 0 0.5px rgba(255,255,255,.35);}" +
      ".dam-assoc-quick-minus i::before{content:none!important;display:none!important;}" +
      ".dam-media-preview__assoc-plus-tile{" +
      "display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;" +
      "min-height:96px;border:1.5px dashed color-mix(in srgb,var(--dam-primary,#ab54db) 45%,#d7d7e0);" +
      "border-radius:12px;background:color-mix(in srgb,var(--dam-primary,#ab54db) 6%,#fff);color:#7a3aa8;" +
      "cursor:pointer;font-size:12px;font-weight:600;padding:10px;}" +
      ".dam-media-preview__assoc-grid.is-shift-hover .dam-media-preview__assoc-plus-tile{display:flex;}" +
      ".dam-media-preview__assoc-plus-tile i{font-size:22px;}" +
      ".dam-media-preview__assoc-plus-tile:hover{background:color-mix(in srgb,var(--dam-primary,#ab54db) 12%,#fff);" +
      "border-color:var(--dam-primary,#ab54db);}" +
      /* Footer DAM */
      ".dam-assoc-edit-overlay .dam-thumb-picker__footer{" +
      "display:grid;grid-template-columns:minmax(96px,auto) minmax(148px,auto) 1fr minmax(120px,auto);" +
      "align-items:center;gap:8px;min-height:65px;box-sizing:border-box;" +
      "padding:12px 14px;background:#f7f6fa;border-top:1px solid #ececf2;}" +
      ".dam-assoc-edit-overlay .dam-thumb-picker__footer .dam-dialog-actions__spacer{display:none;}" +
      ".dam-assoc-edit-overlay .dam-thumb-picker__footer > [data-cancel]{grid-column:1;}" +
      ".dam-assoc-edit-overlay .dam-thumb-picker__footer > [data-goto-combo]{grid-column:2;}" +
      ".dam-assoc-edit-overlay .dam-thumb-picker__footer > [data-confirm]{grid-column:4;justify-self:end;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm," +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__cancel{" +
      "min-height:40px;padding:0 16px;border-radius:10px!important;font-size:12.5px;font-weight:600;" +
      "gap:6px;border-width:1px!important;box-shadow:none;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm{" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 14%,#fff);" +
      "border-color:color-mix(in srgb,var(--dam-primary,#ab54db) 55%,#fff);" +
      "color:#7a3aa8;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm:hover{" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 22%,#fff);}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm[data-confirm]{" +
      "background:var(--dam-primary,#ab54db);border-color:var(--dam-primary,#ab54db);color:#fff;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm[data-confirm]:hover{" +
      "filter:brightness(1.05);}" +
      ".dam-assoc-edit-overlay .dam-assoc-edit-popover__disk{" +
      "background:#fff;border-color:#e2e2ea;color:#464255;}" +
      ".dam-assoc-edit-overlay .dam-assoc-edit-popover__disk:hover{" +
      "background:#f8f4fd;border-color:#e2d3f2;color:#7a3aa8;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__cancel{" +
      "background:#fff;border-color:#e2e2ea;color:#6b6b76;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__cancel:hover{" +
      "background:#f4f4f6;color:#464255;}" +
      /* Breakpoints */
      "@media (max-width:767.98px){" +
      ".dam-assoc-edit-overlay #damAssocEditPopover.dam-thumb-picker-box," +
      ".dam-assoc-edit-overlay .dam-thumb-picker-box.dam-assoc-edit-popover{" +
      "width:min(96vw,calc(100vw - 12px))!important;max-width:min(96vw,calc(100vw - 12px))!important;" +
      "height:90vh!important;min-height:90vh!important;max-height:90vh!important;}" +
      ".dam-assoc-edit-popover__body{grid-template-columns:1fr;grid-template-rows:auto minmax(120px,1fr);}" +
      ".dam-assoc-edit-popover__preview-frame{min-height:140px;max-height:160px;aspect-ratio:auto;}" +
      ".dam-assoc-edit-overlay .dam-thumb-picker__footer{justify-content:stretch;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm," +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__cancel{flex:1 1 auto;}" +
      "}" +
      "@media (min-width:768px){" +
      ".dam-assoc-edit-overlay #damAssocEditPopover.dam-thumb-picker-box," +
      ".dam-assoc-edit-overlay .dam-thumb-picker-box.dam-assoc-edit-popover{" +
      "width:70vw!important;max-width:min(70vw,calc(100vw - 24px))!important;" +
      "height:90vh!important;min-height:90vh!important;max-height:90vh!important;}" +
      ".dam-assoc-edit-popover__body{grid-template-columns:minmax(180px,24%) minmax(0,1fr);}" +
      "}" +
      /* CTA assoc: parity Eksplorator (inject — nie link dam-assoc-edit.css) */
      "#damVizModal .dam-media-preview__assoc-label-row," +
      "#damMediaPreview .dam-media-preview__assoc-label-row{" +
      "display:flex!important;align-items:center!important;justify-content:space-between!important;" +
      "gap:8px!important;flex-wrap:wrap!important;}" +
      "#damVizModal .dam-viz-assoc-cta.dam-int-cta," +
      "#damMediaPreview .dam-viz-assoc-cta.dam-int-cta{" +
      "display:inline-flex!important;align-items:center!important;justify-content:center!important;" +
      "gap:6px!important;margin-left:auto!important;flex-shrink:0!important;" +
      "min-height:34px!important;height:34px!important;padding:8px 12px!important;" +
      "font-size:13.2px!important;font-weight:500!important;line-height:1.2;" +
      "border-radius:8px!important;border:1px solid #e7e7e7!important;" +
      "background:#fff!important;color:#464255!important;box-shadow:none!important;" +
      "white-space:nowrap!important;cursor:pointer;}" +
      "#damVizModal .dam-viz-assoc-cta.dam-int-cta:hover," +
      "#damMediaPreview .dam-viz-assoc-cta.dam-int-cta:hover{" +
      "border-color:var(--dam-primary,#ab54db)!important;background:#fbf7fe!important;" +
      "color:var(--dam-primary,#ab54db)!important;}" +
      "#damVizModal .dam-viz-assoc-cta.dam-int-cta i," +
      "#damMediaPreview .dam-viz-assoc-cta.dam-int-cta i{font-size:16px;line-height:1;}";
    var style = document.getElementById(ASSOC_CSS_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = ASSOC_CSS_ID;
      document.head.appendChild(style);
    }
    style.textContent = css;
    style.setAttribute("data-token", ASSOC_CSS_TOKEN);
  }

  function normIndexKey(idx) {
    var s = String(idx == null ? "" : idx).trim().toLowerCase();
    if (!s) return "";
    if (s.indexOf(".") > 0) s = s.split(".")[0];
    return s.replace(/[^a-z0-9]+/g, "");
  }

  /** Czy rekord wyglada na wizualizacje (nie proponowac jako skojarzony produkt). */
  function isVisualizationLike(p) {
    if (!p) return false;
    var kind = String(p.kind || p.type || p.asset_type || p.record_type || "").toLowerCase();
    if (kind === "viz" || kind === "visualization" || kind === "wizualizacja") return true;
    var blob = [
      p.path || "",
      p.category || "",
      p.id || "",
      p.display_name || "",
      ((p.revisions && p.revisions[0]) || {}).path || "",
      ((p.revisions && p.revisions[0]) || {}).viz_path || "",
    ].join(" ");
    return /WIZKI|wizualizac|\bviz-2\b|\bviz-\d|\b\/viz\b/i.test(blob);
  }

  /** Zbior id/indeksow źródłowych - zakaz self-assoc / petli. */
  function buildAssocExclude(opts) {
    var ids = {};
    var indexes = {};
    function addId(id) {
      if (id) ids[String(id)] = true;
    }
    function addIdx(idx) {
      var k = normIndexKey(idx);
      if (k) indexes[k] = true;
    }
    (opts.excludeIds || []).forEach(addId);
    (opts.excludeIndexes || []).forEach(addIdx);
    var src = opts.sourceProduct || opts.product || null;
    if (src) {
      addId(src.id);
      addIdx(productIndexOf(src));
      (src.indexes || []).forEach(addIdx);
      (src.index_bases || []).forEach(addIdx);
    }
    var gc = opts.groupContext || {};
    addId(gc.product_id || gc.source_product_id || gc.sourceProductId);
    addIdx(gc.product_index || gc.index || gc.source_index);
    var a = opts.asset;
    if (a) {
      addId(a.product_id || a.source_product_id);
      addIdx(a.product_index || a.index);
      if (String(a.type || a.kind || "").toLowerCase() === "product") addId(a.id);
    }
    return { ids: ids, indexes: indexes };
  }

  function productMatchesExclude(p, excl) {
    if (!p || !excl) return false;
    if (p.id && excl.ids[String(p.id)]) return true;
    var base = normIndexKey(productIndexOf(p));
    if (base && excl.indexes[base]) return true;
    var list = [].concat(p.indexes || [], p.index_bases || []);
    for (var i = 0; i < list.length; i++) {
      var k = normIndexKey(list[i]);
      if (k && excl.indexes[k]) return true;
    }
    return false;
  }

  var _productThumbCache = {};

  function rememberProductThumb(id, url) {
    id = String(id || "").trim();
    url = String(url || "").trim();
    if (id && url && url.indexOf("data:image/svg+xml") !== 0) {
      _productThumbCache[id] = url;
    }
  }

  function stripThumbQuery(url) {
    url = String(url || "").trim();
    var q = url.indexOf("?");
    return q > 0 ? url.slice(0, q) : url;
  }

  /** Najnowsza rewizja produktu (is_latest lub revisions[0]) — nie indexes[0]. */
  function latestProductIndexBase(p) {
    if (!p) return "";
    var revs = p.revisions || [];
    var i;
    for (i = 0; i < revs.length; i++) {
      if (revs[i] && revs[i].is_latest) {
        if (revs[i].index_base) return String(revs[i].index_base);
        if (revs[i].index) {
          var ix = String(revs[i].index);
          return ix.indexOf(".") > 0 ? ix.split(".")[0] : ix;
        }
      }
    }
    if (revs[0]) {
      if (revs[0].index_base) return String(revs[0].index_base);
      if (revs[0].index) {
        var r0 = String(revs[0].index);
        return r0.indexOf(".") > 0 ? r0.split(".")[0] : r0;
      }
    }
    return productIndexOf(p);
  }

  function productThumbFromVizLatest(pid) {
    var fi = global._DAM_FILE_INDEX;
    var latest = (fi && fi.viz_latest) || [];
    var i;
    for (i = 0; i < latest.length; i++) {
      var row = latest[i];
      if (row && row.product_id === pid && row.thumb_url) {
        return stripThumbQuery(row.thumb_url);
      }
    }
    return "";
  }

  function productThumb(p) {
    if (!p) return PLACEHOLDER_SVG;
    var pid = String(p.id || "").trim();
    if (pid && _productThumbCache[pid]) return _productThumbCache[pid];
    var fromViz = pid ? productThumbFromVizLatest(pid) : "";
    if (fromViz) {
      rememberProductThumb(pid, fromViz);
      return fromViz;
    }
    var existing = p.thumb_url != null ? String(p.thumb_url).trim() : "";
    if (existing && existing.indexOf("data:image/svg+xml") !== 0) {
      existing = stripThumbQuery(existing);
      if (/^(data:|blob:|https?:|\/|data\/)/i.test(existing) || existing.indexOf("thumbs/") >= 0) {
        rememberProductThumb(pid, existing);
        return existing;
      }
    }
    var slug = String(p.id || "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96)
      .toLowerCase();
    if (!slug) return PLACEHOLDER_SVG;
    var idx = latestProductIndexBase(p);
    if (!idx && p.index_bases && p.index_bases.length) {
      idx = String(p.index_bases[p.index_bases.length - 1]);
    }
    if (!idx) return PLACEHOLDER_SVG;
    var base = String(idx).replace(/[^0-9A-Za-z]+/g, "") || idx;
    var built = "data/thumbs/" + slug + "__" + base + "_pl.jpg";
    rememberProductThumb(pid, built);
    return built;
  }

  function linkedProductIndexFallback(lp) {
    if (!lp) return "";
    var idx = "";
    if (lp.product_index) idx = String(lp.product_index);
    else if (lp.index_bases && lp.index_bases.length) idx = String(lp.index_bases[0]);
    else if (lp.indexes && lp.indexes.length) idx = String(lp.indexes[0]);
    if (idx && idx.indexOf(".") > 0) idx = idx.split(".")[0];
    if (idx && idx.replace(/\D/g, "").length >= 6) return idx;
    var blob = [lp.search_blob, lp.display_name, lp.name, lp.id].join(" ");
    var m = blob.match(/\b(630\d{4})(?:\.\d{2})?\b/);
    if (m) return m[1];
    return "";
  }

  function mapEnrichedLinkedProducts(list, byId) {
    byId = byId || {};
    return (list || []).map(function (lp) {
      if (!lp || !lp.id) return lp;
      var p = byId[lp.id] || lp;
      var idx =
        latestProductIndexBase(byId[lp.id] || p) ||
        lp.product_index ||
        productIndexOf(p) ||
        linkedProductIndexFallback(lp) ||
        linkedProductIndexFallback(p);
      return {
        id: lp.id,
        display_name: lp.display_name || p.display_name || p.name || lp.id,
        thumb_url: lp.thumb_url || productThumb(p),
        product_index: idx,
        path: p.path || lp.path || "",
        search_blob: p.search_blob || lp.search_blob || "",
        category: p.category || lp.category || "",
        subcategory_label: p.subcategory_label || p.subcategory || "",
        tags: p.tags || lp.tags || [],
        indexes: p.indexes || lp.indexes || [],
        index_bases: p.index_bases || lp.index_bases || [],
        brand: p.brand || "",
      };
    });
  }

  function enrichLinkedProducts(list) {
    /* Paint seed first (media-preview); enrich async — load file-index when cache cold. */
    var byId = productsByIdFromCache();
    if (Object.keys(byId).length) {
      return Promise.resolve(dedupeLinkedProductRecords(mapEnrichedLinkedProducts(list, byId), byId));
    }
    return ensureFileIndex()
      .then(function () {
        var loaded = productsByIdFromCache();
        return dedupeLinkedProductRecords(mapEnrichedLinkedProducts(list, loaded), loaded);
      })
      .catch(function () {
        return dedupeLinkedProductRecords(mapEnrichedLinkedProducts(list, {}), {});
      });
  }

  /* Pkt 9 brief 2026-07-20: powiekszony podgląd miniatury ~400x400 nad popoverem */
  function hideThumbZoom() {
    var el = document.getElementById("damAssocThumbZoom");
    if (el) el.remove();
  }

  function showThumbZoom(anchor, src) {
    hideThumbZoom();
    if (!src || !anchor) return;
    var el = document.createElement("div");
    el.id = "damAssocThumbZoom";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;z-index:12400;width:400px;height:400px;background:#fff;" +
      "border:1px solid rgba(70,66,85,0.14);border-radius:14px;" +
      "box-shadow:0 18px 48px rgba(28,24,44,0.28);padding:8px;pointer-events:none;" +
      "display:flex;align-items:center;justify-content:center;overflow:hidden;";
    var img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.style.cssText = "max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;";
    img.onerror = function () {
      hideThumbZoom();
    };
    el.appendChild(img);
    document.body.appendChild(el);
    var r = anchor.getBoundingClientRect();
    var margin = 12;
    var left = r.right + margin;
    if (left + 400 > window.innerWidth - 8) left = r.left - 400 - margin;
    if (left < 8) left = 8;
    var top = r.top + r.height / 2 - 200;
    top = Math.max(8, Math.min(top, window.innerHeight - 408));
    el.style.left = left + "px";
    el.style.top = top + "px";
  }

  function bindThumbZoom(scope) {
    if (!scope) return;
    scope.querySelectorAll(".dam-assoc-edit-popover__thumb-wrap").forEach(function (wrap) {
      var img = wrap.querySelector("img");
      if (!img) return;
      wrap.addEventListener("mouseenter", function () {
        showThumbZoom(wrap, img.currentSrc || img.src);
      });
      wrap.addEventListener("mouseleave", hideThumbZoom);
    });
  }

  function isPlaceholderThumb(src) {
    var s = String(src || "");
    return !s || s.indexOf("data:image/svg+xml") === 0;
  }

  /* Pkt 36: staly panel podglądu po LEWEJ od listy wynikow */
  function setSearchPreview(pop, data) {
    if (!pop) return;
    var panel = pop.querySelector("#damAssocEditPreview");
    if (!panel) return;
    var img = panel.querySelector(".dam-assoc-edit-popover__preview-frame img");
    var empty = panel.querySelector(".dam-assoc-edit-popover__preview-empty");
    var cap = panel.querySelector(".dam-assoc-edit-popover__preview-caption");
    var meta = panel.querySelector(".dam-assoc-edit-popover__preview-meta");
    var src = resolvePreviewMediaSrc((data && data.thumb) || "");
    var label = (data && data.label) || "Najedź wynik, aby podejrzeć";
    var sub = (data && data.sub) || "";
    var emptyThumb = isPlaceholderThumb(src);
    if (img) {
      img.alt = label;
      img.classList.toggle("is-placeholder", emptyThumb);
      if (emptyThumb) {
        img.removeAttribute("src");
        img.removeAttribute("data-preview-current");
      } else {
        var prevPreview = img.getAttribute("data-preview-current") || "";
        if (prevPreview !== src) {
          img.onerror = function () {
            var pathBtn =
              (data && data.btn && data.btn.getAttribute("data-path")) || "";
            if (pathBtn && !img.dataset.previewFallback) {
              img.dataset.previewFallback = "1";
              img.setAttribute("data-path", pathBtn);
              var retry = resolvePreviewMediaSrc(pickerPreviewFromPath(pathBtn));
              if (retry) {
                img.setAttribute("data-preview-current", retry);
                img.src = retry;
                return;
              }
            }
            img.onerror = null;
            img.classList.add("is-placeholder");
            img.removeAttribute("src");
            img.removeAttribute("data-preview-current");
            panel.classList.add("is-empty");
            if (empty) empty.style.display = "";
          };
          img.onload = function () {
            img.classList.remove("is-placeholder");
            panel.classList.remove("is-empty");
          };
          img.setAttribute("data-preview-current", src);
          img.src = src;
        }
      }
    }
    if (cap) cap.textContent = label;
    if (meta) meta.textContent = sub || "";
    panel.classList.toggle("is-empty", emptyThumb || !data);
    if (empty) {
      var emptyTxt = empty.querySelector("span");
      if (emptyTxt) {
        emptyTxt.textContent = data && data.label ? "Brak miniatury" : "Najedź wynik";
      }
    }
    pop.querySelectorAll(".dam-assoc-edit-popover__opt.is-preview-active").forEach(function (el) {
      el.classList.remove("is-preview-active");
    });
    if (data && data.btn) data.btn.classList.add("is-preview-active");
  }

  function bindSearchPreview(pop, scope) {
    if (!pop || !scope) return;
    scope.querySelectorAll(".dam-assoc-edit-popover__opt[data-id]").forEach(function (btn) {
      function activate() {
        var thumb = btn.querySelector(".dam-assoc-edit-popover__thumb");
        var labelEl = btn.querySelector(".dam-search-name, .dam-assoc-edit-popover__label");
        var idxBadge = btn.querySelector(".dam-viz-badge--index");
        /* Hover = one on-demand /media via data-preview-src OK (not N× on paint). */
        var src =
          resolvePreviewMediaSrc(btn.getAttribute("data-preview-src")) ||
          (btn.getAttribute("data-path")
            ? resolvePreviewMediaSrc(pickerPreviewFromPath(btn.getAttribute("data-path")))
            : "") ||
          (thumb ? thumb.getAttribute("src") || thumb.currentSrc || thumb.src : "") ||
          "";
        setSearchPreview(pop, {
          thumb: src,
          label: labelEl ? labelEl.textContent : btn.getAttribute("data-id") || "",
          sub: idxBadge ? idxBadge.textContent : "",
          btn: btn,
        });
      }
      btn.addEventListener("mouseenter", activate);
      btn.addEventListener("focus", activate);
      btn.addEventListener("focusin", activate);
    });
  }

  function stripCategoryPrefix(s) {
    return String(s || "").replace(/^\d+\s*-\s*/, "").trim();
  }

  function closePicker() {
    var overlay = document.getElementById("damAssocEditOverlay");
    if (overlay) overlay.remove();
    hideThumbZoom();
    _pickerThumbSrcCache = Object.create(null);
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onDocKey, true);
  }

  function onDocClick(e) {
    var overlay = document.getElementById("damAssocEditOverlay");
    if (!overlay) return;
    var pop = document.getElementById("damAssocEditPopover");
    if (pop && !pop.contains(e.target) && e.target === overlay) closePicker();
  }

  function onDocKey(e) {
    if (document.getElementById("damThumbPicker")) return;
    if (e.key === "Escape") closePicker();
  }

  function openActionMenu(anchorEl, product) {
    closeActionMenu();
    if (!product || !product.id) return;
    var rect = anchorEl.getBoundingClientRect();
    var menu = document.createElement("div");
    menu.id = "damAssocActionMenu";
    menu.className = "dam-assoc-action-menu is-entering";
    menu.setAttribute("role", "menu");
    var pid = product.id;
    var path = product.path || "";
    var winIcon =
      global.DamIcons && typeof global.DamIcons.winExplorerSvg === "function"
        ? global.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';
    menu.innerHTML =
      '<div class="dam-assoc-action-menu__inner">' +
      '<a class="dam-assoc-action-menu__item" role="menuitem" href="explorer.html?product=' +
      encodeURIComponent(pid) +
      '"><i class="uil uil-sitemap" aria-hidden="true"></i><span>Przejdź</span></a>' +
      '<button type="button" class="dam-assoc-action-menu__item" role="menuitem" data-action="explorer"' +
      (path ? ' data-path="' + esc(path) + '"' : " disabled") +
      ">" +
      winIcon +
      "<span>Eksplorator</span></button>" +
      '<a class="dam-assoc-action-menu__item" role="menuitem" href="visualizations.html?product=' +
      encodeURIComponent(pid) +
      '"><i class="uil uil-image" aria-hidden="true"></i><span>Wizualizacja</span></a>' +
      '<button type="button" class="dam-assoc-action-menu__item" role="menuitem" data-action="copy-link" data-pid="' +
      esc(pid) +
      '"><i class="uil uil-link" aria-hidden="true"></i><span>Kopiuj link</span></button>' +
      "</div>";
    document.body.appendChild(menu);
    var top = window.scrollY + rect.bottom + 6;
    var left = window.scrollX + rect.left;
    menu.style.top = top + "px";
    menu.style.left = left + "px";
    requestAnimationFrame(function () {
      menu.classList.remove("is-entering");
      menu.classList.add("is-visible");
    });
    menu.querySelector('[data-action="explorer"]') &&
      menu.querySelector('[data-action="explorer"]').addEventListener("click", function () {
        var p = this.getAttribute("data-path") || "";
        if (p && global.DamPaths && typeof global.DamPaths.revealInExplorer === "function") {
          global.DamPaths.revealInExplorer(p);
        }
        closeActionMenu();
      });
    menu.querySelector('[data-action="copy-link"]') &&
      menu.querySelector('[data-action="copy-link"]').addEventListener("click", function () {
        var link = location.origin + location.pathname.replace(/[^/]+$/, "") + "explorer.html?product=" + encodeURIComponent(pid);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(function () {
            toast("Skopiowano link do produktu");
          });
        }
        closeActionMenu();
      });
    setTimeout(function () {
      document.addEventListener("click", closeActionMenuOnOutside, true);
      document.addEventListener("keydown", closeActionMenuOnKey, true);
    }, 0);
  }

  function closeActionMenuOnOutside(e) {
    var menu = document.getElementById("damAssocActionMenu");
    if (menu && !menu.contains(e.target)) closeActionMenu();
  }

  function closeActionMenuOnKey(e) {
    if (e.key === "Escape") closeActionMenu();
  }

  function closeActionMenu() {
    var menu = document.getElementById("damAssocActionMenu");
    if (menu) {
      menu.classList.remove("is-visible");
      menu.classList.add("is-leaving");
      setTimeout(function () {
        if (menu.parentNode) menu.parentNode.removeChild(menu);
      }, 180);
    }
    document.removeEventListener("click", closeActionMenuOnOutside, true);
    document.removeEventListener("keydown", closeActionMenuOnKey, true);
  }

  function openMediaPicker(anchorEl, opts) {
    opts = opts || {};
    closePicker();
    /* Defer CSS inject off the CTA click turn (style recalc on branding grid can jam). */
    setTimeout(function () {
      ensureInjectedCss();
    }, 0);
    function paintPicker(fi) {
      var products = (fi && fi.products) || [];
      /* HARD: never pull 50k file-index into branding API pickers (closure + later scans = freeze). */
      if (
        !pickerSkipsWarmFileIndex(opts) &&
        (!products.length || products.length < 2) &&
        global._DAM_FILE_INDEX &&
        global._DAM_FILE_INDEX.products &&
        global._DAM_FILE_INDEX.products.length
      ) {
        products = global._DAM_FILE_INDEX.products;
      }
      /* Lazy lookup — memoized productsById. Skip on branding API paths (no Object.keys 50k). */
      var productsById = null;
      if (!pickerSkipsWarmFileIndex(opts)) {
        if (
          global._DAM_FILE_INDEX &&
          global._DAM_FILE_INDEX.products &&
          global._DAM_FILE_INDEX.products.length
        ) {
          productsById = productsByIdFromCache();
        }
      }
      var materialEntries = [];
      var productSearchHits = [];
      var groupedItemsCache = [];
      var pickerActiveTags = [];
      var pickerTagPage = 0;
      var listRenderToken = 0;
      var selected = {};
      var pinnedIds;
      var expandedProductId = null;
      var expandedBrandingGroupKey = null;
      opts.pickerMode = resolvePickerMode(opts.kind, opts, opts.pickerId);
      if (opts.productSearchForVariants) {
        /* Viz: pinned = warianty stripu; wyszukiwarka = produkty → rozwijane rewizje. */
        pinnedIds = (opts.pinnedIds || []).slice();
        selected = {};
      } else {
        (opts.selectedIds || []).forEach(function (id) {
          selected[id] = true;
        });
        pinnedIds = (opts.pinnedIds || opts.selectedIds || []).slice();
      }
      if (opts.kind === "product") {
        var metaPinned = linkedMetaByIdFromRecords(
          (opts.groupContext && opts.groupContext.linked_products) || []
        );
        pinnedIds = dedupeProductIds(pinnedIds, products, metaPinned);
        selected = {};
        pinnedIds.forEach(function (id) {
          selected[id] = true;
        });
      }
      var pinnedSet = {};
      pinnedIds.forEach(function (id) {
        pinnedSet[id] = true;
      });

      var overlay = document.createElement("div");
      overlay.id = "damAssocEditOverlay";
      overlay.className = "dam-assoc-edit-overlay";
      overlay.setAttribute("role", "presentation");

      var pop = document.createElement("div");
      pop.id = "damAssocEditPopover";
      pop.className = "dam-thumb-picker-box dam-assoc-edit-popover";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-modal", "true");

      var head =
        opts.kind === "variant"
          ? opts.head || "Warianty materiału"
          : opts.kind === "material"
            ? opts.head || "Skojarzone materiały"
            : opts.head || "Skojarzone produkty";
      var searchPlaceholder =
        opts.kind === "material"
          ? "Szukaj materiału brandingowego…"
          : "Szukaj tytuł, indeks, wariant…";
      var html =
        '<div class="dam-thumb-picker__head">' +
        "<strong>" +
        esc(head) +
        '</strong><button type="button" class="dam-viz-modal-close" data-close aria-label="Zamknij">' +
        '<i class="uil uil-times"></i></button></div>' +
        '<div class="dam-assoc-edit-popover__pinned-wrap">' +
        '<div class="dam-assoc-edit-popover__pinned-label">Aktualne</div>' +
        '<div class="dam-assoc-edit-popover__pinned"></div>' +
        "</div>" +
        '<div class="dam-assoc-edit-popover__section-sep" aria-hidden="true"></div>' +
        '<div class="dam-assoc-edit-popover__body">' +
        '<aside class="dam-assoc-edit-popover__preview is-empty" id="damAssocEditPreview" aria-live="polite">' +
        '<p class="dam-assoc-edit-popover__preview-label">Podgląd</p>' +
        '<div class="dam-assoc-edit-popover__preview-frame">' +
        '<img alt="" class="is-placeholder" />' +
        '<div class="dam-assoc-edit-popover__preview-empty" aria-hidden="true">' +
        '<i class="uil uil-image"></i><span>Najedź wynik</span></div>' +
        "</div>" +
        '<div class="dam-assoc-edit-popover__preview-caption">Najedź wynik, aby podejrzeć</div>' +
        '<div class="dam-assoc-edit-popover__preview-meta"></div>' +
        "</aside>" +
        '<div class="dam-assoc-edit-popover__list-col">' +
        '<div class="dam-tag-edit-popover__search-wrap dam-search-wrap dam-search-wrap--picker">' +
        '<div class="dam-search-input-wrap">' +
        '<i class="uil uil-search" aria-hidden="true"></i>' +
        '<input type="text" id="damAssocEditSearch" class="form-control dam-search-input dam-tag-edit-popover__search" placeholder="' +
        esc(searchPlaceholder) +
        '" autocomplete="off" aria-label="Szukaj w pickerze" />' +
        "</div></div>" +
        '<div class="dam-tag-edit-popover__list dam-assoc-edit-popover__list" role="listbox">';

      function lookupItem(id) {
        var cached = groupedItemsCache.find(function (x) {
          return x && x.id === id;
        });
        if (cached) return cached;
        groupedItemsCache.some(function (parent) {
          if (!parent || !parent.children) return false;
          var hit = parent.children.find(function (c) {
            return c && c.id === id;
          });
          if (hit) {
            cached = hit;
            return true;
          }
          return false;
        });
        if (cached) return cached;
        if (opts.kind === "material") {
          var material =
            materialEntries.find(function (x) {
              return x && x.id === id;
            }) ||
            (opts.materialCandidates || []).find(function (x) {
              return x && x.id === id;
            });
          if (material) {
            var rowM = brandingEntryToPickerRow(material) || material;
            return {
              id: rowM.id,
              kind: "material",
              label: shortAssocLabel(rowM.label || rowM.name || rowM.title),
              thumb: rowM.thumb || brandingThumbUrl(rowM),
              preview_src: rowM.preview_src || pickerPreviewSrc(rowM),
              sub: rowM.marketing_id || rowM.index || marketingIdForBranding(rowM) || "",
              path: rowM.path || "",
              tags: material.tags || rowM.tags || [],
              asset_role: material.asset_role || rowM.asset_role || "",
              media_type: material.media_type || rowM.media_type || "",
              folder_group_id: material.folder_group_id || rowM.folder_group_id || "",
            };
          }
        } else if (opts.kind === "variant") {
          if (opts.brandingSearch) {
            var matV =
              materialEntries.find(function (x) {
                return x && x.id === id;
              }) ||
              (opts.materialCandidates || []).find(function (x) {
                return x && x.id === id;
              });
            if (matV) {
              var rowV = brandingEntryToPickerRow(matV) || matV;
              return {
                id: rowV.id,
                kind: "material",
                label: shortAssocLabel(rowV.label || rowV.name),
                thumb: rowV.thumb || brandingThumbUrl(rowV),
                preview_src: rowV.preview_src || pickerPreviewSrc(rowV),
                sub: rowV.marketing_id || rowV.index || marketingIdForBranding(rowV) || "",
                path: rowV.path || "",
                tags: matV.tags || rowV.tags || [],
                asset_role: matV.asset_role || rowV.asset_role || "",
                media_type: matV.media_type || rowV.media_type || "",
                folder_group_id: matV.folder_group_id || rowV.folder_group_id || "",
              };
            }
          }
          var v = (opts.variantCandidates || []).find(function (x) {
            return x && x.id === id;
          });
          if (v) {
            var matCand =
              materialEntries.find(function (x) {
                return x && x.id === id;
              }) || v;
            var rowCand = brandingEntryToPickerRow(matCand) || matCand;
            return {
              id: rowCand.id || v.id,
              kind: isBrandingMaterialId(rowCand.id || v.id) ? "material" : "variant",
              label: shortAssocLabel(rowCand.label || rowCand.name || v.name || v.label),
              thumb:
                rowCand.thumb ||
                v.thumb ||
                v.thumb_url ||
                brandingThumbUrl(rowCand) ||
                (v.path && global.DamMediaPreview ? global.DamMediaPreview.previewUrl(v.path, v) : ""),
              preview_src:
                rowCand.preview_src ||
                pickerPreviewSrc(rowCand) ||
                (v.path ? pickerPreviewFromPath(v.path) : ""),
              sub:
                rowCand.marketing_id ||
                rowCand.index ||
                v.marketing_id ||
                marketingIdForBranding(rowCand) ||
                normIndexKey(v.index || v.id) ||
                "",
              langs: v.lang ? [v.lang] : v.langs || [],
              path: rowCand.path || v.path || "",
            };
          }
          if (opts.productSearchForVariants) {
            var parsedRev = parseRevisionPickerKey(id);
            if (parsedRev) {
              var fullRevP =
                resolvePickerProductFull(
                  (productsById && productsById[parsedRev.productId]) ||
                    productSearchHits.find(function (x) {
                      return x && x.id === parsedRev.productId;
                    }) ||
                    products.find(function (x) {
                      return x && x.id === parsedRev.productId;
                    }) ||
                    { id: parsedRev.productId },
                  productsById
                );
              if (fullRevP) {
                var revMatch = null;
                var revs = fullRevP.revisions || [];
                for (var rli = 0; rli < revs.length; rli++) {
                  var rp = String((revs[rli] && revs[rli].path) || "").replace(/\\/g, "/");
                  if (rp === parsedRev.revisionPath) {
                    revMatch = revs[rli];
                    break;
                  }
                }
                if (revMatch) {
                  var revIdxL = String(
                    revMatch.index || revMatch.index_base || productIndexOf(fullRevP) || ""
                  );
                  if (revIdxL.indexOf(".") > 0) revIdxL = revIdxL.split(".")[0];
                  return {
                    id: id,
                    label: revisionPickerLabel(
                      fullRevP.display_name || fullRevP.name || fullRevP.id,
                      revMatch,
                      revIdxL
                    ),
                    thumb: productThumb(fullRevP),
                    sub: revIdxL,
                    brand: fullRevP.brand || "",
                    category: fullRevP.category || "",
                    subcategory: fullRevP.subcategory_label || "",
                    langs: revMatch.langs || [],
                    path: revMatch.path || "",
                    isRevisionRow: true,
                  };
                }
              }
            }
            var pv = resolvePickerProductFull(
              (productsById && productsById[id]) ||
                productSearchHits.find(function (x) {
                  return x && x.id === id;
                }) ||
                products.find(function (x) {
                  return x && x.id === id;
                }) ||
                null,
              productsById
            );
            if (pv) {
              var rev0p = (pv.revisions && pv.revisions[0]) || {};
              return {
                id: pv.id,
                label: pv.display_name || pv.name || pv.id,
                thumb: productThumb(pv),
                sub: productIndexOf(pv) || "",
                brand: pv.brand || "",
                category: pv.category || "",
                subcategory: pv.subcategory_label || "",
                langs: rev0p.langs || [],
                path: pv.path || "",
                isProductRow: true,
                revCount: (pv.revisions && pv.revisions.length) || 0,
              };
            }
          }
        } else {
          var p =
            (productsById && productsById[id]) ||
            products.find(function (x) {
              return x && x.id === id;
            });
          if (p) {
            var revL = (p.revisions && p.revisions[0]) || {};
            return {
              id: p.id,
              label: p.display_name || p.name || p.id,
              thumb: productThumb(p),
              sub: productIndexOf(p) || "",
              path: p.path || "",
              brand: p.brand || "",
              category: p.category || "",
              subcategory: p.subcategory_label || "",
              langs: revL.langs || [],
            };
          }
        }
        return {
          id: id,
          label: isLegacyBrId(id) ? "Materiał" : id,
          thumb: PLACEHOLDER_SVG,
          sub: isLegacyBrId(id) && global.DamMarketingId ? global.DamMarketingId.format({ id: id }) : "",
          path: "",
        };
      }

      function checkIconHtml(on, pinned) {
        if (on && pinned) {
          return (
            '<i class="uil uil-check"></i>' +
            '<span class="dam-assoc-edit-popover__check-label">wybrane</span>'
          );
        }
        if (on) return '<i class="uil uil-check"></i>';
        if (pinned) return '<i class="uil uil-times" title="Kliknij, aby usunac skojarzenie"></i>';
        return "";
      }

      function pickerRowProductId(it) {
        if (!it) return "";
        var id = String(it.id || "");
        if (it.isRevisionRow) {
          var parsed = parseRevisionPickerKey(id);
          return parsed ? parsed.productId : "";
        }
        if (id.indexOf("vizprod:") === 0) return id.slice(8);
        if (id.indexOf("vizgrid:") === 0) {
          var parts = id.split(":");
          return parts.length >= 2 ? parts[1] : "";
        }
        if (it.isProductRow || it.isVizGridGroup) return id;
        if (
          opts.kind === "product" &&
          id &&
          id.indexOf("vizprod:") !== 0 &&
          id.indexOf("vizgrid:") !== 0 &&
          !it.isRevisionRow &&
          !isBrandingMaterialId(id)
        ) {
          return id;
        }
        return "";
      }

      function pickerRowFolderPath(it) {
        if (!it) return "";
        var direct = String(it.path || "").trim();
        if (direct) return direct;
        var pid = pickerRowProductId(it);
        if (!pid) {
          if (String(it.id || "").indexOf("vizprod:") === 0) {
            pid = String(it.id).slice(8);
          }
        }
        if (!pid) return "";
        var byId = productsById || productsByIdFromCache();
        var prod = byId && byId[pid];
        if (!prod) return "";
        if (prod.path) return String(prod.path).trim();
        var rev0 = (prod.revisions && prod.revisions[0]) || {};
        return String(rev0.path || "").trim();
      }

      function rowActionsHtml(it) {
        var actions = "";
        var folderPath = pickerRowFolderPath(it);
        if (folderPath) {
          actions +=
            '<button type="button" class="dam-assoc-edit-popover__row-btn" data-row-folder data-path="' +
            esc(folderPath) +
            '" title="Otworz folder" aria-label="Otworz folder"><i class="uil uil-folder"></i></button>';
        }
        var showLink = opts.kind === "product" || it.isProductRow || it.isVizGridGroup;
        var pid = pickerRowProductId(it);
        if (showLink && pid) {
          actions +=
            '<button type="button" class="dam-assoc-edit-popover__row-btn" data-row-copy data-pid="' +
            esc(pid) +
            '" title="Kopiuj link do produktu" aria-label="Kopiuj link"><i class="uil uil-link"></i></button>';
        } else if (opts.kind === "product" && folderPath) {
          actions += '<span class="dam-assoc-edit-popover__row-btn-spacer" aria-hidden="true"></span>';
        }
        return '<span class="dam-assoc-edit-popover__row-actions">' + actions + "</span>";
      }

      var PICKER_INLINE_TAG_MAX = 10;

      /* Pkt 9: wiersz tagow - marka, kategoria, podkategoria, jezyk, indeks (jak karty viz) */
      function optionTagsHtml(it, maxTags, skipIndex) {
        var limit = maxTags == null ? PICKER_INLINE_TAG_MAX : maxTags;
        var tags = [];
        function tag(v, cls, tip, copyVal) {
          if (!v || tags.length >= limit) return;
          var copyAttrs = "";
          if (copyVal) {
            copyAttrs =
              ' data-marketing-id="' +
              esc(copyVal) +
              '" data-tag-value="' +
              esc(copyVal) +
              '" role="button" tabindex="0"';
          }
          tags.push(
            '<span class="dam-viz-badge' +
              (cls ? " " + cls : "") +
              '"' +
              (tip ? ' title="' + esc(tip) + '"' : "") +
              copyAttrs +
              ">" +
              esc(v) +
              "</span>"
          );
        }
        if (it.tag_groups && typeof it.tag_groups === "object") {
          var tg = it.tag_groups;
          (tg.smak || []).slice(0, 2).forEach(function (v) {
            tag(v, "dam-viz-badge--subcat", "Smak");
          });
          (tg.typ || []).slice(0, 2).forEach(function (v) {
            tag(v, "dam-viz-badge--cat", "Typ");
          });
          (tg.opakowanie || []).slice(0, 2).forEach(function (v) {
            tag(v, "dam-viz-badge--mix", "Opakowanie");
          });
        }
        tag(it.brand, "dam-viz-badge--brand", "Marka");
        tag(stripCategoryPrefix(it.category), "dam-viz-badge--cat", "Kategoria");
        tag(it.subcategory, "dam-viz-badge--subcat", "Podkategoria");
        (it.langs || []).forEach(function (lg) {
          tag(String(lg).toUpperCase(), "dam-viz-badge--lang", "Język");
        });
        if (!skipIndex) {
          tag(it.sub, "dam-viz-badge--index", "Indeks (klik / prawy = kopiuj)", it.sub);
        }
        if (it.isRevisionRow) {
          tag("wariant", "dam-viz-badge--lang", "Folder rewizji produktu");
        }
        if (!tags.length) return "";
        return tags.join("");
      }

      function optionMaterialTagsHtml(it) {
        if (global.DamBadges && typeof global.DamBadges.renderBranding === "function") {
          var asset = {
            id: it.id,
            tags: it.tags || [],
            appearance_tags: it.tags || [],
            asset_role: it.asset_role || "",
            media_type: it.media_type || "",
            brand: it.brand || "",
            campaign_id: it.campaign_id || "",
            path: it.path || "",
            name: it.name || it.label || "",
          };
          return global.DamBadges.renderBranding(asset, {
            includeTagTiers: ["primary", "low", "minimal"],
            maxPerKind: 3,
            maxTotal: PICKER_INLINE_TAG_MAX,
            overflow: false,
          });
        }
        var tags = [];
        function tag(v, cls) {
          if (!v || tags.length >= PICKER_INLINE_TAG_MAX) return;
          var norm = String(v).toLowerCase();
          if (norm === "www" || norm === "strony www") v = "Online";
          tags.push(
            '<span class="dam-viz-badge' +
              (cls ? " " + cls : "") +
              '">' +
              esc(v) +
              "</span>"
          );
        }
        (it.tags || []).forEach(function (t) {
          tag(String(t), "dam-viz-badge--subcat");
        });
        if (it.asset_role) {
          var roleLbl = String(it.asset_role).replace(/_/g, " ");
          if (roleLbl === "web banner") roleLbl = "Baner WWW";
          tag(roleLbl, "dam-viz-badge--cat");
        }
        if (it.media_type) tag(String(it.media_type), "dam-viz-badge--carrier");
        if (it.folder_group_id) {
          var folderBits = String(it.folder_group_id).split(/[\\/]/).filter(Boolean);
          folderBits.slice(-2).forEach(function (bit) {
            tag(bit, "dam-viz-badge--mix");
          });
        }
        return tags.join("");
      }

      function optionButtonHtml(it, pinned, nestedInGroup) {
        var on = !!selected[it.id];
        var isProd = !!it.isProductRow;
        var isRev = !!it.isRevisionRow;
        var isGroupParent = !!it.isGroupParent;
        var isGroupChild = !!it.isGroupChild;
        var isHint = !!it.isEmptyRevHint;
        var expanded = isProd
          ? expandedProductId === it.id
          : isGroupParent
            ? expandedBrandingGroupKey === it.groupKey
            : false;
        var isMat =
          opts.kind === "material" ||
          (opts.kind === "variant" && opts.brandingSearch) ||
          it.kind === "material" ||
          isGroupParent ||
          isGroupChild ||
          (!isProd && !isRev && isBrandingMaterialId(it.id));
        var badge =
          isRev || it.kind === "variant"
            ? "Wariant"
            : isProd || it.isVizGridGroup
              ? "Produkt"
              : isMat
                ? "Materiał"
                : "Produkt";
        var hitKind = isRev ? "variant" : isProd || it.isVizGridGroup ? "product" : isMat ? "material" : "product";
        var trailing = "";
        if (isProd || isGroupParent) {
          trailing =
            '<span class="dam-assoc-edit-popover__expand" data-expand-only="1" aria-hidden="true">' +
            '<i class="uil uil-angle-' +
            (expanded ? "down" : "right") +
            '"></i></span>';
        }
        var rawThumb = it.preview_src || pickerPreviewSrc(it) || (it.path ? pickerPreviewFromPath(it.path) : "") || it.thumb || PLACEHOLDER_SVG;
        var listThumbSrc = pickerListRowThumbSrc(it);
        var listThumbStable =
          listThumbSrc &&
          listThumbSrc !== PLACEHOLDER_SVG &&
          listThumbSrc.indexOf("data:image/svg") < 0;
        var pathAttr = it.path ? ' data-path="' + esc(it.path) + '"' : "";
        var productIdAttr =
          it.id && !it.isRevisionRow && (isProd || it.isVizGridGroup || opts.kind === "product")
            ? ' data-product-id="' +
              esc(it.isVizGridGroup ? String(it.id).replace(/^vizprod:/, "") : it.id) +
              '"'
            : "";
        var thumbOnErr =
          "window.__damPickerThumbOnError&&__damPickerThumbOnError(this)";
        var tagsInline = isMat ? optionMaterialTagsHtml(it) : optionTagsHtml(it, null, true);
        var bodyHtml = pickerSearchHitBodyHtml(it, badge, tagsInline, isMat);
        var checkHtml =
          '<span class="dam-search-hit__check' +
          (on ? " is-on" : "") +
          '" aria-hidden="true">' +
          checkIconHtml(on, pinned) +
          "</span>";
        return (
          '<li class="dam-assoc-edit-popover__opt-row dam-search-hit dam-search-hit--' +
          esc(hitKind) +
          (isRev || isGroupChild || nestedInGroup ? " dam-search-hit--nested" : "") +
          (isHint ? " is-hint" : "") +
          (expanded ? " is-expanded" : "") +
          '">' +
          (isHint ? '<span class="dam-assoc-edit-popover__row-actions"></span>' : rowActionsHtml(it)) +
          '<button type="button" class="dam-assoc-edit-popover__opt dam-search-hit__row' +
          (on ? " is-selected" : "") +
          (pinned ? " is-pinned" : "") +
          (isRev ? " dam-assoc-edit-popover__opt--revision" : "") +
          (isProd ? " dam-assoc-edit-popover__opt--product" : "") +
          (isGroupParent ? " dam-assoc-edit-popover__opt--group-parent" : "") +
          (expanded ? " is-expanded" : "") +
          '" data-id="' +
          esc(it.id) +
          '" data-preview-src="' +
          esc(resolvePreviewMediaSrc(rawThumb)) +
          '"' +
          pathAttr +
          productIdAttr +
          (isGroupParent ? ' data-group-key="' + esc(it.groupKey || "") + '"' : "") +
          (isProd || isGroupParent
            ? ' aria-expanded="' + (expanded ? "true" : "false") + '" title="Kliknij, aby rozwinąć warianty"'
            : "") +
          (isHint ? " disabled" : "") +
          ">" +
          checkHtml +
          '<span class="dam-assoc-edit-popover__thumb-wrap dam-search-hit__thumb-wrap">' +
          '<img class="dam-assoc-edit-popover__thumb dam-search-hit__thumb"' +
          pathAttr +
          productIdAttr +
          ' src="' +
          esc(listThumbSrc) +
          '"' +
          (listThumbStable ? ' data-thumb-stable="1"' : "") +
          ' alt="" decoding="async" onerror="' +
          thumbOnErr +
          '">' +
          "</span>" +
          bodyHtml +
          "</button>" +
          trailing +
          "</li>"
        );
      }

      function persistPinnedRemoval(removedId) {
        var remaining = pinnedIds.slice();
        if (opts.kind === "material") {
          var productId = String(
            (opts.productContext && opts.productContext.id) ||
              (opts.groupContext && opts.groupContext.product_id) ||
              ""
          ).trim();
          if (!productId) return;
          var prevMat = (opts.selectedIds || opts.pinnedIds || []).slice();
          opts.selectedIds = remaining.slice();
          saveProductMaterialSuggestions(productId, remaining, prevMat).then(function (res) {
            if (res && res.ok !== false) {
              if (opts.assocCtx) opts.assocCtx.selectedIds = remaining.slice();
              if (opts.assocCtx && typeof opts.assocCtx.onRefresh === "function") {
                opts.assocCtx.onRefresh({ materialIds: remaining, skipReload: true });
              }
            }
          });
          return;
        }
        if (opts.kind === "product") {
          var actxP = opts.assocCtx;
          if (!actxP || !actxP.asset) return;
          var prevPids = collectLinkedIdsFromCtx(actxP, "product");
          var prevVidsP = collectLinkedIdsFromCtx(actxP, "variant");
          var nextPids = dedupeProductIds(
            remaining,
            productsByIdFromCache(),
            linkedMetaByIdFromCtx(actxP)
          );
          patchCtxProductIds(actxP, nextPids);
          flushOptimisticAssocUi(actxP, nextPids, prevVidsP);
          saveAssociations(actxP, nextPids, prevVidsP, { silentToast: true });
          return;
        }
        if (opts.productSearchForVariants) {
          var actxV = opts.assocCtx || {};
          var parsed = parseRevisionPickerKey(removedId);
          if (parsed && typeof actxV.onRemoveProductVariant === "function") {
            actxV.onRemoveProductVariant("path|" + parsed.revisionPath, parsed.revisionPath);
            return;
          }
          var pool = opts.variantCandidates || (actxV.groupContext && actxV.groupContext.variants) || [];
          var hit = pool.find(function (v) {
            return v && String(v.id || v.path || "") === String(removedId);
          });
          if (hit && typeof actxV.onRemoveProductVariant === "function") {
            var vkey =
              (hit.lang ? hit.lang + "|" : "") +
              String(hit.index_base || hit.index || "").split(".")[0];
            actxV.onRemoveProductVariant(vkey || "path|" + (hit.path || removedId), hit.path || removedId);
          }
          return;
        }
        if (opts.kind === "variant") {
          var actxVar = opts.assocCtx;
          if (!actxVar || !actxVar.asset) return;
          var prevP = collectLinkedIdsFromCtx(actxVar, "product");
          var nextV = remaining.slice();
          patchCtxVariantIds(actxVar, nextV);
          flushOptimisticAssocUi(actxVar, prevP, nextV);
          saveAssociations(actxVar, prevP, nextV, { silentToast: true });
        }
      }

      function bindOptionButtons(scope) {
        if (!scope) return;
        bindThumbZoom(scope);
        bindSearchPreview(pop, scope);
        hydratePickerThumbs(
          scope,
          opts.productSearchForVariants || opts.kind === "product" ? { eager: true } : {}
        );
        scope.querySelectorAll(".dam-assoc-edit-popover__opt[data-id]").forEach(function (btn) {
          var id = btn.getAttribute("data-id");
          function toggle() {
            if (String(id).indexOf("rev-empty:") === 0) return;
            var isPinnedRow = btn.classList.contains("is-pinned") || !!pinnedSet[id];
            if (isPinnedRow) {
              delete selected[id];
              pinnedIds = pinnedIds.filter(function (pid) {
                return pid !== id;
              });
              delete pinnedSet[id];
              renderPinned();
              var sPin = pop.querySelector("#damAssocEditSearch");
              scheduleListPaint(sPin ? sPin.value : "");
              persistPinnedRemoval(id);
              return;
            }
            if (opts.productSearchForVariants && String(id).indexOf("rev:") !== 0) {
              expandedProductId = expandedProductId === id ? null : id;
              var sExpand = pop.querySelector("#damAssocEditSearch");
              scheduleListPaint(sExpand ? sExpand.value : "");
              return;
            }
            if (pickerUsesBrandingGroups(opts)) {
              var groupIt = lookupItem(id);
              if (groupIt && groupIt.isGroupParent) {
                expandedBrandingGroupKey =
                  expandedBrandingGroupKey === groupIt.groupKey ? null : groupIt.groupKey;
                var sGrp = pop.querySelector("#damAssocEditSearch");
                scheduleListPaint(sGrp ? sGrp.value : "");
                return;
              }
              if (groupIt && groupIt.isGroupChild) {
                if (selected[id]) delete selected[id];
                else selected[id] = true;
                pinnedIds = Object.keys(selected).filter(function (sid) {
                  return selected[sid];
                });
                renderPinned();
                var sChild = pop.querySelector("#damAssocEditSearch");
                scheduleListPaint(sChild ? sChild.value : "");
                return;
              }
            }
            if (selected[id]) delete selected[id];
            else {
              if (opts.kind === "product") {
                var itNew = lookupItem(id);
                var newKey = normIndexKey((itNew && itNew.sub) || "");
                if (newKey) {
                  var idxKeys = selectedProductIndexKeys(selected, lookupItem);
                  if (idxKeys[newKey] && idxKeys[newKey] !== id) {
                    toast("Ten indeks jest już na liście (" + (itNew.sub || newKey) + ").");
                    return;
                  }
                }
              }
              selected[id] = true;
            }
            /* Viz warianty: selekcja tylko rev:* — odśwież pinned + listę (nie pomijaj pinned). */
            if (opts.productSearchForVariants) {
              pinnedIds = Object.keys(selected).filter(function (sid) {
                return selected[sid] && String(sid).indexOf("rev:") === 0;
              });
              renderPinned();
              var sRev = pop.querySelector("#damAssocEditSearch");
              scheduleListPaint(sRev ? sRev.value : "");
              return;
            }
            pinnedIds = Object.keys(selected).filter(function (sid) {
              return selected[sid];
            });
            if (opts.kind === "product") {
              pinnedIds = dedupeProductIds(
                pinnedIds,
                products,
                linkedMetaByIdFromRecords(
                  pinnedIds.map(function (pid) {
                    return lookupItem(pid);
                  })
                )
              );
              selected = {};
              pinnedIds.forEach(function (pid) {
                selected[pid] = true;
              });
            }
            renderPinned();
            var s = pop.querySelector("#damAssocEditSearch");
            scheduleListPaint(s ? s.value : "");
          }
          /* Pinned X = natychmiastowe odpięcie; wyniki wyszukiwania = zwykły klik (dodaj).
             DamDanger hold tylko gdy celowo usuwamy — NIE na dodawanie z listy (blokuje toggle). */
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggle();
          });
        });
        scope.querySelectorAll("[data-row-folder]").forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var p = btn.getAttribute("data-path") || "";
            if (p && global.DamPaths && typeof global.DamPaths.revealInExplorer === "function") {
              global.DamPaths.revealInExplorer(p);
              toast("Otwieram folder w Eksploratorze");
            } else if (p && global.DamPaths && typeof global.DamPaths.openFolderInExplorer === "function") {
              global.DamPaths.openFolderInExplorer(p);
            }
          });
        });
        scope.querySelectorAll("[data-row-copy]").forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var pid = btn.getAttribute("data-pid") || "";
            var link =
              location.origin +
              location.pathname.replace(/[^/]+$/, "") +
              "explorer.html?product=" +
              encodeURIComponent(pid);
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(link).then(function () {
                toast("Skopiowano link do produktu");
              });
            }
          });
        });
        scope.querySelectorAll(".dam-assoc-edit-popover__opt-row>.dam-assoc-edit-popover__expand").forEach(function (el) {
          el.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var row = el.closest(".dam-assoc-edit-popover__opt-row");
            var btn = row && row.querySelector(".dam-assoc-edit-popover__opt[data-id]");
            if (btn) btn.click();
          });
        });
      }

      function activatePreviewFromBtn(btn, allowMedia) {
        if (!btn) return;
        var thumb = btn.querySelector(".dam-assoc-edit-popover__thumb");
        var labelEl = btn.querySelector(".dam-search-name, .dam-assoc-edit-popover__label");
        var idxBadge = btn.querySelector(".dam-viz-badge--index");
        /* HARD: auto-activate after renderOptions NEVER uses /media (NFS stall = app freeze).
           Hover/focus may pass allowMedia=true for one on-demand preview. */
        var src =
          (allowMedia ? normalizeBridgeMediaUrl(btn.getAttribute("data-preview-src")) : "") ||
          (allowMedia && btn.getAttribute("data-path")
            ? normalizeBridgeMediaUrl(pickerPreviewFromPath(btn.getAttribute("data-path")))
            : "") ||
          (thumb ? thumb.getAttribute("src") || thumb.currentSrc || thumb.src : "") ||
          "";
        var safeSrc = allowMedia ? src : listSafeThumb(src);
        setSearchPreview(pop, {
          thumb: safeSrc,
          label: labelEl ? labelEl.textContent : btn.getAttribute("data-id") || "",
          sub: idxBadge ? idxBadge.textContent : "",
          btn: btn,
        });
      }

      function renderPinned() {
        var pinnedEl = pop.querySelector(".dam-assoc-edit-popover__pinned");
        if (!pinnedEl) return;
        var prevThumbs = {};
        pinnedEl.querySelectorAll(".dam-assoc-edit-popover__opt[data-id]").forEach(function (btn) {
          var pid = btn.getAttribute("data-id");
          var img = btn.querySelector(".dam-assoc-edit-popover__thumb");
          if (pid && img && img.src) prevThumbs[pid] = img.src;
        });
        if (!pinnedIds.length) {
          pinnedEl.innerHTML = '<p class="dam-assoc-edit-popover__empty-msg">Brak aktualnych skojarzen.</p>';
          setSearchPreview(pop, null);
          return;
        }
        pinnedEl.innerHTML =
          '<ul class="dam-search-hits dam-search-hits--panel dam-assoc-edit-popover__hits">' +
          pinnedIds
            .map(function (id) {
              return optionButtonHtml(lookupItem(id), true);
            })
            .join("") +
          "</ul>";
        pinnedEl.querySelectorAll(".dam-assoc-edit-popover__opt[data-id]").forEach(function (btn) {
          var pid = btn.getAttribute("data-id");
          if (!pid || !prevThumbs[pid]) return;
          var img = btn.querySelector(".dam-assoc-edit-popover__thumb");
          if (img) img.src = prevThumbs[pid];
        });
        bindOptionButtons(pinnedEl);
        hydratePickerThumbs(pinnedEl, { eager: true });
        /* Podglad: pierwsza przypieta miniatura (hover = /media on-demand). */
        activatePreviewFromBtn(pinnedEl.querySelector(".dam-assoc-edit-popover__opt[data-id]"), true);
      }

      function showListMessage(msg) {
        var listEl = pop.querySelector(".dam-assoc-edit-popover__list");
        if (!listEl) return;
        listEl.innerHTML = '<p class="dam-assoc-edit-popover__empty-msg">' + esc(msg) + "</p>";
      }

      function renderPickerTagFilters() {
        if (!pickerUsesBrandingApi(opts)) return;
        var host = pop.querySelector("#damAssocEditTagFilters");
        if (!host) return;
        loadPickerTagGroups(function (tagGroups) {
          if (!pickerStillOpen() || !host.isConnected) return;
          var pages = [];
          var page = [];
          PICKER_TAG_GROUP_ORDER.forEach(function (gk) {
            var chips = (tagGroups && tagGroups[gk]) || [];
            if (!chips.length && gk === "produkt" && tagGroups && tagGroups.smak) {
              chips = tagGroups.smak.slice();
            }
            chips = chips.slice(0, 24).map(function (label) {
              return { key: String(label), label: String(label) };
            });
            if (!chips.length) return;
            page.push({ key: gk, label: PICKER_TAG_GROUP_LABELS[gk] || gk, chips: chips });
            if (page.length === 2) {
              pages.push(page);
              page = [];
            }
          });
          if (page.length) pages.push(page);
          if (!pages.length) {
            host.innerHTML = "";
            return;
          }
          if (pickerTagPage >= pages.length) pickerTagPage = 0;
          var nav =
            '<div class="dam-assoc-edit-popover__tag-filters-nav">' +
            '<select id="damAssocEditTagNav" aria-label="Kategoria tagów">' +
            pages
              .map(function (_p, idx) {
                var labels = _p.map(function (g) {
                  return g.label;
                }).join(" · ");
                return (
                  '<option value="' +
                  idx +
                  '"' +
                  (idx === pickerTagPage ? " selected" : "") +
                  ">" +
                  esc(labels) +
                  "</option>"
                );
              })
              .join("") +
            "</select></div>";
          var track =
            '<div class="dam-assoc-edit-popover__tag-filters-viewport"><div class="dam-assoc-edit-popover__tag-filters-track" style="transform:translateY(-' +
            pickerTagPage * 96 +
            'px)">';
          pages.forEach(function (pg) {
            track += '<div class="dam-assoc-edit-popover__tag-filters-page">';
            pg.forEach(function (group) {
              track +=
                '<div class="dam-assoc-edit-popover__tag-group-row" data-group="' +
                esc(group.key) +
                '"><span class="dam-assoc-edit-popover__tag-group-label">' +
                esc(group.label) +
                ':</span><span class="dam-assoc-edit-popover__tag-group-pills">';
              group.chips.forEach(function (chip) {
                var active = pickerActiveTags.indexOf(chip.key) >= 0;
                track +=
                  '<button type="button" class="dam-viz-badge dam-viz-badge--subcat' +
                  (active ? " is-active" : "") +
                  '" data-picker-tag="' +
                  esc(chip.key) +
                  '">' +
                  esc(chip.label) +
                  "</button>";
              });
              track += "</span></div>";
            });
            track += "</div>";
          });
          track += "</div></div>";
          host.innerHTML = nav + track;
          var navSel = host.querySelector("#damAssocEditTagNav");
          if (navSel) {
            navSel.addEventListener("change", function () {
              pickerTagPage = parseInt(navSel.value, 10) || 0;
              renderPickerTagFilters();
              scheduleListPaint(pop.querySelector("#damAssocEditSearch")
                ? pop.querySelector("#damAssocEditSearch").value
                : "");
            });
          }
          host.querySelectorAll("[data-picker-tag]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
              e.preventDefault();
              e.stopPropagation();
              var tag = btn.getAttribute("data-picker-tag") || "";
              if (!tag) return;
              var ix = pickerActiveTags.indexOf(tag);
              if (ix >= 0) pickerActiveTags.splice(ix, 1);
              else pickerActiveTags.push(tag);
              renderPickerTagFilters();
              scheduleListPaint(
                pop.querySelector("#damAssocEditSearch")
                  ? pop.querySelector("#damAssocEditSearch").value
                  : ""
              );
            });
          });
          var viewport = host.querySelector(".dam-assoc-edit-popover__tag-filters-viewport");
          if (viewport) {
            viewport.addEventListener(
              "wheel",
              function (e) {
                if (pages.length <= 1) return;
                e.preventDefault();
                if (e.deltaY > 0 && pickerTagPage < pages.length - 1) pickerTagPage++;
                else if (e.deltaY < 0 && pickerTagPage > 0) pickerTagPage--;
                renderPickerTagFilters();
              },
              { passive: false }
            );
          }
        });
      }

      function scheduleListPaint(filter) {
        var token = ++listRenderToken;
        var run = function () {
          if (token !== listRenderToken || !pickerStillOpen()) return;
          renderOptions(filter);
        };
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
        else setTimeout(run, 0);
      }

      function renderOptions(filter) {
        var previewAllowMedia = !!(
          opts.productSearchForVariants ||
          opts.kind === "product" ||
          opts.kind === "material"
        );
        var q = String(filter || "")
          .toLowerCase()
          .trim();
        var listEl = pop.querySelector(".dam-assoc-edit-popover__list");
        if (!listEl) return;
        var minQ = 0;
        /* Branding browse: lista od razu (materialEntries); search q≥2 = API. */
        if (opts.kind === "variant" && !opts.productSearchForVariants && !opts.brandingSearch) {
          minQ = 2;
        }
        if (minQ && q.length < minQ) {
          listEl.innerHTML =
            '<p class="dam-assoc-edit-popover__empty-msg">Wpisz co najmniej ' +
            minQ +
            " znaki, aby przeszukać indeks…</p>";
          var pinnedKeep0 = pop.querySelector(
            ".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]"
          );
          if (pinnedKeep0) activatePreviewFromBtn(pinnedKeep0, previewAllowMedia);
          else setSearchPreview(pop, null);
          return;
        }
        var excl = buildAssocExclude(opts);
        var seenIds = {};
        var seenIdx = {};
        var items = [];
        if (opts.kind === "variant" && opts.productSearchForVariants) {
          /* Golden: browse q<2 = for+break CAP; q≥2 = DamSearch hits; cold = local CAP+q.
             "Szukam…" only while DamSearch module is ready AND fetch in flight — never stuck. */
          if (
            global.DamSearch &&
            typeof global.DamSearch.adoptWarmCaches === "function"
          ) {
            global.DamSearch.adoptWarmCaches();
          }
          var variantQ = q.length >= 2 && productSearchHits.length ? "" : q;
          if (q.length >= 2 && productSearchHits.length) {
            items = collectProductPickerRows(productSearchHits, {
              pinnedSet: pinnedSet,
              excl: excl,
              q: "",
              filterType: "all",
              cap: PICKER_LIST_CAP,
              asProductRow: true,
              expandedProductId: expandedProductId,
              productsById: productsById,
            });
          } else {
            items = collectProductPickerRows(products, {
              pinnedSet: pinnedSet,
              excl: excl,
              q: variantQ,
              filterType: "all",
              cap: PICKER_LIST_CAP,
              asProductRow: true,
              expandedProductId: expandedProductId,
              productsById: productsById,
            });
          }
        } else if (opts.kind === "variant" && opts.brandingSearch) {
          if (!materialEntries.length && materialFetchInFlight) {
            showListMessage("Ładowanie materiałów…");
            return;
          }
          if (q.length >= 2 && !materialEntries.length && materialFetchInFlight) {
            showListMessage("Szukam materiałów…");
            return;
          }
          var brandingVariantFlat = collectBrandingPickerRows(
            materialEntries.length ? materialEntries : [],
            {
              pinnedSet: pinnedSet,
              q: q,
              filterType: "all",
              cap: PICKER_LIST_CAP,
              activeTags: pickerActiveTags,
            }
          );
          items = groupBrandingPickerRows(brandingVariantFlat);
        } else if (opts.kind === "variant") {
          var vCands = opts.variantCandidates || [];
          for (var vi = 0; vi < vCands.length; vi++) {
            if (items.length >= PICKER_LIST_CAP) break;
            if (vi >= PICKER_SCAN_BUDGET) break;
            var v = vCands[vi];
            if (!v || !v.id || pinnedSet[v.id]) continue;
            if (seenIds[v.id]) continue;
            if (excl.ids[String(v.id)]) continue;
            var vIdx = normIndexKey(v.index || v.id);
            if (vIdx && excl.indexes[vIdx]) continue;
            if (vIdx && seenIdx[vIdx]) continue;
            var vBlob = ((v.name || v.label || "") + " " + (v.id || "") + " " + (v.index || "")).toLowerCase();
            if (q && vBlob.indexOf(q) === -1) continue;
            seenIds[v.id] = true;
            if (vIdx) seenIdx[vIdx] = true;
            items.push({
              id: v.id,
              label: shortAssocLabel(v.name || v.label || v.id),
              thumb:
                v.thumb ||
                v.thumb_url ||
                (v.path && global.DamMediaPreview ? global.DamMediaPreview.previewUrl(v.path, v) : ""),
              sub: v.index || v.marketing_id || normIndexKey(v.id) || "",
              langs: v.lang ? [v.lang] : v.langs || [],
              path: v.path || "",
            });
          }
        } else if (opts.kind === "material") {
          if (!materialEntries.length && materialFetchInFlight) {
            showListMessage("Ładowanie materiałów…");
            return;
          }
          if (q.length >= 2 && !materialEntries.length && materialFetchInFlight) {
            showListMessage("Szukam materiałów…");
            return;
          }
          var brandingFlat = collectBrandingPickerRows(
            materialEntries.length ? materialEntries : opts.materialCandidates || [],
            {
              pinnedSet: pinnedSet,
              q: q,
              cap: PICKER_LIST_CAP,
              activeTags: pickerActiveTags,
            }
          );
          if (opts.pickerMode === PICKER_MODE_VIZ_SUGGESTIONS) {
            var vizGroups = collectVizGridGroupedRows({
              q: q,
              cap: Math.max(12, Math.floor(PICKER_LIST_CAP / 3)),
              productsById: productsById,
            });
            items = groupBrandingPickerRows(brandingFlat).concat(vizGroups);
          } else {
            items = groupBrandingPickerRows(brandingFlat);
          }
        } else if (opts.kind === "product") {
          /* GOLDEN: browse q<2 = CAP; q≥2 = DamSearch hits; cold = local CAP+q (no JSON.parse). */
          if (
            global.DamSearch &&
            typeof global.DamSearch.adoptWarmCaches === "function"
          ) {
            global.DamSearch.adoptWarmCaches();
          }
          var productQ = q.length >= 2 && productSearchHits.length ? "" : q;
          if (q.length >= 2 && productSearchHits.length) {
            items = collectProductPickerRows(productSearchHits, {
              pinnedSet: pinnedSet,
              excl: excl,
              q: "",
              filterType: opts.filterType || "product",
              cap: PICKER_LIST_CAP,
              asProductRow: false,
            });
          } else {
            items = collectProductPickerRows(products, {
              pinnedSet: pinnedSet,
              excl: excl,
              q: productQ,
              filterType: opts.filterType || "product",
              cap: PICKER_LIST_CAP,
              asProductRow: false,
            });
          }
        }
        items = items.slice(0, PICKER_LIST_CAP);
        groupedItemsCache = items.slice();
        if (!items.length) {
          if (
            opts.kind === "variant" &&
            opts.productSearchForVariants &&
            !q &&
            (!products || !products.length)
          ) {
            showListMessage("Ładowanie produktów…");
            return;
          }
          listEl.innerHTML = q
            ? '<p class="dam-assoc-edit-popover__empty-msg">Brak wyników dla tego wyszukiwania.</p>'
            : '<p class="dam-assoc-edit-popover__empty-msg">Wpisz frazę, aby zawęzić listę…</p>';
          var pinnedKeep = pop.querySelector(
            ".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]"
          );
          if (pinnedKeep) activatePreviewFromBtn(pinnedKeep);
          else setSearchPreview(pop, null);
          return;
        }
        var prevListThumbs = {};
        listEl.querySelectorAll(".dam-assoc-edit-popover__opt[data-id]").forEach(function (btn) {
          var pid = btn.getAttribute("data-id");
          var img = btn.querySelector(".dam-assoc-edit-popover__thumb");
          if (pid && img && img.src && img.src.indexOf("data:image/svg") < 0) {
            prevListThumbs[pid] = img.src;
          }
        });
        var displayItems = pickerUsesBrandingGroups(opts)
          ? buildBrandingPickerDisplayRows(items, expandedBrandingGroupKey)
          : items;
        var rowsHtml =
          pickerUsesBrandingGroups(opts)
            ? displayItems
                .map(function (it) {
                  return optionButtonHtml(it, false);
                })
                .join("")
            : opts.kind === "material" || (opts.kind === "variant" && opts.brandingSearch)
            ? renderPickerFolderGroups(items, optionButtonHtml)
            : items
                .map(function (it) {
                  return optionButtonHtml(it, false);
                })
                .join("");
        listEl.innerHTML =
          pickerUsesBrandingGroups(opts)
            ? '<ul class="dam-search-hits dam-search-hits--panel dam-assoc-edit-popover__hits">' +
              rowsHtml +
              "</ul>"
            : opts.kind === "material" || (opts.kind === "variant" && opts.brandingSearch)
            ? rowsHtml.indexOf("dam-assoc-edit-popover__folder-block") >= 0
              ? '<div class="dam-assoc-edit-popover__hits">' + rowsHtml + "</div>"
              : '<ul class="dam-search-hits dam-search-hits--panel dam-assoc-edit-popover__hits">' +
                rowsHtml +
                "</ul>"
            : '<ul class="dam-search-hits dam-search-hits--panel dam-assoc-edit-popover__hits">' +
              rowsHtml +
              "</ul>";
        listEl.querySelectorAll(".dam-assoc-edit-popover__opt[data-id]").forEach(function (btn) {
          var pid = btn.getAttribute("data-id");
          if (!pid) return;
          var img = btn.querySelector(".dam-assoc-edit-popover__thumb");
          if (!img) return;
          var keep =
            prevListThumbs[pid] || cachedPickerListThumb(pid) || "";
          if (keep) {
            img.src = keep;
            img.setAttribute("data-thumb-stable", "1");
          }
        });
        bindOptionButtons(listEl);
        var previewAllowMedia = !!(
          opts.productSearchForVariants ||
          opts.kind === "product" ||
          opts.kind === "material"
        );
        if (
          items.length &&
          global.DamPreviewTruth &&
          typeof global.DamPreviewTruth.warmThumbs === "function"
        ) {
          global.DamPreviewTruth.warmThumbs(
            items
              .map(function (it) {
                return it && it.path;
              })
              .filter(Boolean)
              .slice(0, 24),
            "grid"
          );
        }
        /* Preferuj podgląd z AKTUALNYCH (pinned), nie z pierwszego wyniku wyszukiwania. */
        var pinnedBtn = pop.querySelector(
          ".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]"
        );
        if (pinnedBtn) {
          activatePreviewFromBtn(pinnedBtn, previewAllowMedia);
        } else {
          var firstBtn = listEl.querySelector(".dam-assoc-edit-popover__opt[data-id]");
          if (firstBtn) activatePreviewFromBtn(firstBtn, previewAllowMedia);
        }
      }

      var footerComboTip =
        opts.kind === "material" || opts.brandingSearch
          ? "Eksplorator COMBO — wybierz plik materiału brandingowego"
          : opts.kind === "variant"
            ? "Eksplorator COMBO — wybierz folder wariantu / produktu"
            : "Eksplorator COMBO — wybierz folder produktu (pliki wyszarzone)";
      html +=
        "</div></div></div>" +
        '<div class="dam-thumb-picker__footer dam-tag-edit-popover__actions dam-dialog-actions dam-modal-footer">' +
        '<button type="button" class="dam-tag-edit-popover__cancel" data-cancel><i class="uil uil-arrow-left"></i><span>Wstecz</span></button>' +
        '<button type="button" class="dam-tag-edit-popover__confirm dam-assoc-edit-popover__combo" data-goto-combo data-eksplorer data-dam-tip="' +
        esc(footerComboTip) +
        '">' +
        '<i class="uil uil-folder-plus" aria-hidden="true"></i><span>Dodaj z dysku</span></button>' +
        '<span class="dam-dialog-actions__spacer" aria-hidden="true"></span>' +
        '<button type="button" class="dam-tag-edit-popover__confirm" data-confirm><i class="uil uil-check"></i><span>Zatwierdź</span></button>' +
        "</div>";
      pop.innerHTML = html;
      pop._damAssocRefresh = function () {
        renderPinned();
        var s = pop.querySelector("#damAssocEditSearch");
        renderOptionsDebounced(s ? s.value : "");
      };
      overlay.appendChild(pop);
      document.body.appendChild(overlay);
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onDocKey, true);

      var search = pop.querySelector("#damAssocEditSearch");
      var renderOptionsDebounced = debounce(function (filter) {
        var run = function () {
          renderOptions(filter);
        };
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
        else setTimeout(run, 0);
      }, 180);
      var materialFetchTimer = null;
      var materialFetchInFlight = false;
      var materialFetchGen = 0;
      var brandingBootstrapGen = 0;
      var productFetchTimer = null;

      /* API jak lekki odpowiednik #damBrandingSearch — material + brandingSearch warianty. */
      function scheduleMaterialSearchFetch(q) {
        if (!pickerUsesBrandingApi(opts)) return;
        clearTimeout(materialFetchTimer);
        var query = String(q || "").trim();
        if (query.length < 2) {
          materialFetchInFlight = false;
          return;
        }
        brandingBootstrapGen++;
        materialFetchInFlight = true;
        showListMessage("Szukam materiałów…");
        var gen = ++materialFetchGen;
        materialFetchTimer = setTimeout(function () {
          if (!pickerStillOpen()) {
            materialFetchInFlight = false;
            return;
          }
          runBrandingMaterialFetch(query, gen);
        }, 180);
      }

      /* DamSearch = ten sam silnik co #damFileSearch (indeks). Nie full products.forEach. */
      function scheduleProductSearchFetch(q) {
        if (!(opts.productSearchForVariants || opts.kind === "product")) return;
        clearTimeout(productFetchTimer);
        var query = String(q || "").trim();
        if (query.length < 2) {
          productSearchHits = [];
          return;
        }
        productFetchTimer = setTimeout(function () {
          if (!pickerStillOpen()) return;
          var searchFn = global.DamSearch && global.DamSearch.search;
          if (
            global.DamSearch &&
            typeof global.DamSearch.adoptWarmCaches === "function"
          ) {
            global.DamSearch.adoptWarmCaches();
          }
          var moduleReady =
            global.DamSearch &&
            typeof global.DamSearch.isReady === "function" &&
            global.DamSearch.isReady();
          /* Cold DamSearch.loadIndexes = JSON.parse 7MB+ = whole-app FREEZE.
             Call DamSearch.search ONLY when module already holds parsed indexes.
             light:true = capped scans (no 50k forEach on garbage q). */
          if (!searchFn || !moduleReady) {
            productSearchHits = [];
            productFetchTimer = null;
            if (
              global.DamSearch &&
              typeof global.DamSearch.load === "function" &&
              typeof global.DamSearch.isReady === "function" &&
              !global.DamSearch.isReady()
            ) {
              global.DamSearch.load()
                .then(function () {
                  if (!pickerStillOpen()) return;
                  scheduleProductSearchFetch(query);
                })
                .catch(function () {
                  renderOptionsDebounced(query);
                });
            } else {
              renderOptionsDebounced(query);
            }
            return;
          }
          searchFn(query, {
            includeArchive: false,
            limit: PICKER_LIST_CAP,
            light: true,
          })
            .then(function (res) {
              productFetchTimer = null;
              if (!pickerStillOpen()) return;
              if (!productsById && global._DAM_FILE_INDEX) {
                productsById = productsByIdFromCache();
              }
              /* DamSearch.search returns product OBJECTS in res.products (not bare ids). */
              var raw = ((res && res.products) || []).slice(0, PICKER_LIST_CAP);
              productSearchHits = raw
                .map(function (p) {
                  if (!p) return null;
                  if (typeof p === "object" && p.id) {
                    return resolvePickerProductFull(p, productsById);
                  }
                  var id = String(p);
                  return (productsById && productsById[id]) || null;
                })
                .filter(Boolean);
              renderOptionsDebounced(query);
            })
            .catch(function () {
              productFetchTimer = null;
              if (!pickerStillOpen()) return;
              productSearchHits = [];
              showListMessage("Błąd wyszukiwania produktów.");
            });
        }, 220);
      }

      if (search) {
        /* HARD 4.0.66: scheduleListPaint(raw) natychmiast (rAF).
           q≥2 product/viz → DamSearch async → renderOptionsDebounced po settle.
           Browse q<2 = for+break CAP via scheduleListPaint; NIE podwójny sync paint. */
        search.addEventListener("input", function () {
          var raw = search.value;
          var qq = String(raw || "").trim();
          var isProductPicker = opts.productSearchForVariants || opts.kind === "product";
          if (isProductPicker && qq.length < 2) {
            productSearchHits = [];
            scheduleListPaint(raw);
          } else if (isProductPicker && qq.length >= 2) {
            renderOptionsDebounced(raw);
            scheduleProductSearchFetch(raw);
          } else if (pickerUsesBrandingApi(opts) && qq.length >= 2) {
            /* NIE scheduleListPaint — rAF wyściga z async fetch i zostawia „Szukam…”. */
            scheduleMaterialSearchFetch(raw);
          } else {
            scheduleListPaint(raw);
          }
        });
      }

      function pickerStillOpen() {
        return !!(pop && pop.isConnected);
      }

      function runBrandingMaterialFetch(query, gen) {
        var fetchQuery = String(query || "").trim();
        if (fetchQuery.length < 2) {
          materialFetchInFlight = false;
          return;
        }
        loadBrandingMaterialCandidates(
          Object.assign({}, opts, { bootstrapQuery: fetchQuery })
        )
          .then(function (entries) {
            materialFetchTimer = null;
            materialFetchInFlight = false;
            if (!pickerStillOpen()) return;
            if (gen !== materialFetchGen) return;
            if (String(search ? search.value : "").trim() !== fetchQuery) return;
            materialEntries = (entries || []).slice(0, PICKER_LIST_CAP);
            renderPinned();
            renderOptions(fetchQuery);
          })
          .catch(function () {
            materialFetchTimer = null;
            materialFetchInFlight = false;
            if (!pickerStillOpen() || gen !== materialFetchGen) return;
            renderPinned();
            renderOptions(search ? search.value : fetchQuery);
          });
      }

      materialEntries = (opts.materialCandidates || []).slice(0, PICKER_LIST_CAP);
      /* Init: shell + pinned first. Branding API seed only when bootstrapQuery >= 2
         (never block open on /branding-search-picker + N× /media thumbs). */
      function applyBrandingSeed(entries) {
        if (!pickerStillOpen()) return;
        if (entries && entries.length) {
          materialEntries = entries.slice(0, PICKER_LIST_CAP);
        }
        renderPinned();
        scheduleListPaint(search ? search.value : "");
      }
      function bootstrapBrandingPickerList() {
        if (!pickerUsesBrandingApi(opts)) return;
        var hadSeed = materialEntries.length > 0;
        if (!hadSeed) {
          materialFetchInFlight = true;
          showListMessage("Ładowanie materiałów…");
        }
        loadBrandingPickerBrowse(opts)
          .then(function (entries) {
            materialFetchInFlight = false;
            if (!pickerStillOpen()) return;
            if (entries && entries.length) {
              applyBrandingSeed(entries);
            } else if (!hadSeed) {
              scheduleListPaint(search ? search.value : "");
            }
          })
          .catch(function () {
            materialFetchInFlight = false;
            if (!pickerStillOpen()) return;
            if (!hadSeed && (opts.materialCandidates || []).length) {
              applyBrandingSeed(opts.materialCandidates);
            } else if (!hadSeed) {
              scheduleListPaint(search ? search.value : "");
            }
          });
      }

      function finishPickerInit() {
        if (!pickerStillOpen()) return;
        renderPinned();
        if (pickerUsesBrandingApi(opts)) {
          if (!materialEntries.length && (opts.materialCandidates || []).length) {
            materialEntries = (opts.materialCandidates || []).slice(0, PICKER_LIST_CAP);
            scheduleListPaint(search ? search.value : "");
          }
          bootstrapBrandingPickerList();
          var bootQ = String(opts.bootstrapQuery || "").trim();
          if (bootQ.length >= 2) {
            loadBrandingMaterialCandidates(opts).then(function (entries) {
              if (!entries || !entries.length) return;
              applyBrandingSeed(entries);
            });
          }
        } else if (opts.kind === "variant" && opts.productSearchForVariants) {
          renderOptionsDebounced("");
        } else if (opts.kind === "variant") {
          if ((opts.variantCandidates || []).length <= 40) renderOptionsDebounced("");
        } else if (opts.kind === "product" && products.length) {
          renderOptions(search ? search.value : "");
        } else {
          renderOptionsDebounced("");
        }
        activatePreviewFromBtn(
          pop.querySelector(".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]"),
          !!(opts.productSearchForVariants || opts.kind === "product" || opts.kind === "material")
        );
      }
      finishPickerInit();

      pop._damAssocRebindChrome = function () {
        var closeBtn = pop.querySelector("[data-close]");
        if (closeBtn) {
          if (closeBtn._damPickerCloseBound) {
            closeBtn._damPickerCloseBound = null;
            closeBtn.dataset.damModalCloseBound = "";
          }
          closeBtn._damPickerCloseBound = true;
          closeBtn.addEventListener("click", function (e) {
            if (e) {
              e.preventDefault();
              e.stopPropagation();
            }
            closePicker();
          });
          if (
            global.DamModalShared &&
            typeof global.DamModalShared.bindModalClose === "function"
          ) {
            global.DamModalShared.bindModalClose(closeBtn, closePicker);
          }
        }
        var cancelEl = pop.querySelector("[data-cancel]");
        if (cancelEl) cancelEl.onclick = closePicker;
        var confirmEl = pop.querySelector("[data-confirm]");
        if (confirmEl) {
          confirmEl.onclick = function () {
            /* Parity product/variant/material: pinned must survive confirm even if toggle race. */
            pinnedIds.forEach(function (pid) {
              if (selected[pid] !== false) selected[pid] = true;
            });
            var ids = Object.keys(selected).filter(function (k) {
              return selected[k];
            });
            if (opts.kind === "product") {
              ids = dedupeProductIds(ids, products, linkedMetaByIdFromRecords(
                ids.map(function (pid) {
                  return lookupItem(pid);
                })
              ));
            }
            if (pickerUsesBrandingGroups(opts)) {
              ids = flattenBrandingGroupSelection(ids, lookupItem, groupedItemsCache);
              ids = ids.filter(function (mid) {
                return (
                  String(mid).indexOf("vizprod:") !== 0 &&
                  String(mid).indexOf("vizgrid:") !== 0
                );
              });
            }
            /* Do NOT filterBrandingVariantIdsForPrimary on confirm — strips cross-folder picks
               (np. br-049510 cynamonka on M-GOG805627) while still showing "Zapisano". */
            if (typeof opts.onConfirmVariants === "function") {
              var picks = ids.map(parseRevisionPickerKey).filter(Boolean);
              picks = expandPicksToAllProductRevisions(picks.length ? picks : ids);
              if (opts.productSearchForVariants && !picks.length) {
                toast("Rozwiń produkt i zaznacz wariant (folder rewizji).");
                return;
              }
              closePicker();
              opts.onConfirmVariants(picks.length ? picks : ids);
              return;
            }
            closePicker();
            if (typeof opts.onConfirm === "function") opts.onConfirm(ids, selected);
          };
        }
        var comboEl = pop.querySelector("[data-goto-combo]");
        if (comboEl) {
          comboEl.onclick = function () {
            openComboExplorerFromAssoc(opts, selected, function () {
              if (typeof pop._damAssocRefresh === "function") pop._damAssocRefresh();
            });
          };
        }
      };
      pop._damAssocApplyFileIndex = function (nextFi) {
        if (!pickerStillOpen()) return;
        var next = (nextFi && nextFi.products) || [];
        if (!next.length) return;
        products = next;
        productsById = productsByIdFromCache();
        renderPinned();
        scheduleListPaint(search ? search.value : "");
      };
      pop._damAssocRebindChrome();
    }
    /* Shell first — never BLOCK open on ensureFileIndex/JSON.parse.
       Warm: paint immediately. Cold golden product/viz: empty shell + background load → refresh. */
    function schedulePaintPicker(fi) {
      /* Double-yield: let CTA click + modal handlers finish before picker DOM work. */
      setTimeout(function () {
        setTimeout(function () {
          ensureInjectedCss();
          paintPicker(fi || { products: [] });
        }, 0);
      }, 0);
    }
    if (pickerSkipsWarmFileIndex(opts)) {
      schedulePaintPicker({ products: [] });
      return;
    }
    if (
      global._DAM_FILE_INDEX &&
      global._DAM_FILE_INDEX.products &&
      global._DAM_FILE_INDEX.products.length
    ) {
      if (global.DamSearch && typeof global.DamSearch.adoptWarmCaches === "function") {
        global.DamSearch.adoptWarmCaches();
      }
      schedulePaintPicker(global._DAM_FILE_INDEX);
      return;
    }
    /* Cold GOLDEN: open empty shell NOW; load file-index in background; re-fill list. */
    schedulePaintPicker({ products: [] });
    ensureFileIndexForPicker().then(function (fi) {
      if (global.DamSearch && typeof global.DamSearch.adoptWarmCaches === "function") {
        global.DamSearch.adoptWarmCaches();
      }
      var popLive = document.getElementById("damAssocEditPopover");
      if (popLive && typeof popLive._damAssocApplyFileIndex === "function") {
        popLive._damAssocApplyFileIndex(fi || global._DAM_FILE_INDEX);
      }
      /* Idle: warm search-index only (file already in RAM → DamSearch.load skips re-parse file). */
      setTimeout(function () {
        if (
          global.DamSearch &&
          typeof global.DamSearch.load === "function" &&
          typeof global.DamSearch.isReady === "function" &&
          !global.DamSearch.isReady()
        ) {
          global.DamSearch.load().catch(function () {});
        }
      }, 0);
    });
  }

  function assocPickerStartDir(opts) {
    var start = (opts && opts.asset && opts.asset.path) || "X:/Marketing";
    var dir = String(start).replace(/\\/g, "/");
    var i = dir.lastIndexOf("/");
    if (i > 0 && /\.[a-z0-9]{2,8}$/i.test(dir)) dir = dir.slice(0, i);
    return dir;
  }

  function pickedPath(picked) {
    if (!picked) return "";
    return picked.filePath || picked.folder || picked.path || "";
  }

  function resolveVizVariantByIndex(id) {
    var idx = String(id || "").trim();
    if (!/^\d{6}(\.\d+)?$/.test(idx)) return null;
    var base = idx.split(".")[0];
    var fi = global._DAM_FILE_INDEX;
    var latest = (fi && fi.viz_latest) || [];
    for (var i = 0; i < latest.length; i++) {
      var row = latest[i];
      if (!row) continue;
      if (String(row.index || "") === idx || String(row.index_base || "") === base) {
        return {
          id: row.path || "vizidx:" + idx,
          name: (row.product_name || base) + " " + (row.index || idx),
          label: row.product_name || base,
          thumb_url: row.thumb_url || "",
          path: row.path || "",
          index: row.index || idx,
          marketing_id: base,
        };
      }
    }
    return null;
  }

  function brandingAssetFromIndex(id) {
    id = String(id || "").trim();
    if (!id) return null;
    var idx = window.__damBrandingIndex;
    if (!idx || !idx.assets) return null;
    var hit = null;
    (idx.assets || []).some(function (a) {
      if (a && a.id === id) {
        hit = a;
        return true;
      }
      return false;
    });
    return hit;
  }

  function enrichBrandingAssetsByIds(ids) {
    ids = (ids || [])
      .map(function (id) {
        return String(id || "").trim();
      })
      .filter(Boolean);
    if (!ids.length) return Promise.resolve([]);
    var indexIds = ids.filter(function (id) {
      return /^\d{6}(\.\d+)?$/.test(id);
    });
    var brIds = ids.filter(function (id) {
      return !/^\d{6}(\.\d+)?$/.test(id);
    });
    if (!brIds.length) {
      return Promise.resolve(
        ids.map(function (id) {
          return resolveVizVariantByIndex(id) || { id: id, name: id };
        })
      );
    }
    var include = ids.slice(0, 40).join(",");
    var url =
      bridgeUrl() +
      "/branding-search-picker?q=&limit=80&include=" +
      encodeURIComponent(include);
    return fetch(url, { headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var raw = ((data && (data.entries || data.items)) || []).slice();
        var byId = {};
        raw.forEach(function (entry) {
          if (!entry || !entry.id) return;
          var row = brandingEntryToPickerRow(entry) || entry;
          byId[entry.id] = {
            id: row.id,
            name: row.label || row.name || entry.id,
            label: row.label || row.name || entry.id,
            path: row.path || entry.path || "",
            thumb_url: row.thumb || brandingThumbUrl(row),
            marketing_id: row.marketing_id || row.index || marketingIdForBranding(row) || "",
            index: row.index || row.marketing_id || "",
          };
        });
        return ids.map(function (id) {
          if (/^\d{6}(\.\d+)?$/.test(id)) {
            return resolveVizVariantByIndex(id) || { id: id, name: id };
          }
          var fromIdx = brandingAssetFromIndex(id);
          if (fromIdx) {
            return {
              id: fromIdx.id,
              name: fromIdx.name || fromIdx.label || fromIdx.id,
              label: fromIdx.label || fromIdx.name || fromIdx.id,
              path: fromIdx.path || "",
              thumb_url: fromIdx.thumb_url || brandingThumbUrl(fromIdx),
              marketing_id: marketingIdForBranding(fromIdx) || fromIdx.id,
              index: fromIdx.index || fromIdx.product_index || "",
            };
          }
          return byId[id] || { id: id, name: id };
        });
      })
      .catch(function () {
        return ids.map(function (id) {
          if (/^\d{6}(\.\d+)?$/.test(id)) {
            return resolveVizVariantByIndex(id) || { id: id, name: id };
          }
          var fromIdx = brandingAssetFromIndex(id);
          if (fromIdx) {
            return {
              id: fromIdx.id,
              name: fromIdx.name || fromIdx.label || fromIdx.id,
              label: fromIdx.label || fromIdx.name || fromIdx.id,
              path: fromIdx.path || "",
              thumb_url: fromIdx.thumb_url || brandingThumbUrl(fromIdx),
              marketing_id: marketingIdForBranding(fromIdx) || fromIdx.id,
              index: fromIdx.index || fromIdx.product_index || "",
            };
          }
          return { id: id, name: id };
        });
      });
  }

  function fetchPickerJson(url, timeoutMs) {
    timeoutMs = timeoutMs || 12000;
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl
      ? setTimeout(function () {
          try {
            ctrl.abort();
          } catch (eAbort) {
            /* ignore */
          }
        }, timeoutMs)
      : null;
    return fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (r) {
        if (timer) clearTimeout(timer);
        return r.json();
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      });
  }

  function loadBrandingMaterialCandidates(opts) {
    opts = opts || {};
    var q = String(opts.bootstrapQuery || "").trim();
    var browse = !!opts.browse;
    var include = (opts.selectedIds || opts.pinnedIds || []).slice(0, 40).join(",");
    /* Cap to PICKER_LIST_CAP — never pull 120 rows that all hit /media?preview. */
    var url =
      bridgeUrl() +
      "/branding-search-picker?q=" +
      encodeURIComponent(q) +
      "&limit=" +
      PICKER_LIST_CAP +
      (browse ? "&browse=1" : "") +
      (include ? "&include=" + encodeURIComponent(include) : "");
    return fetchPickerJson(url, 12000)
      .then(function (data) {
        var raw = ((data && (data.entries || data.items || data.results)) || []).slice(
          0,
          PICKER_LIST_CAP
        );
        var out = [];
        for (var i = 0; i < raw.length; i++) {
          var entry = raw[i];
          if (!entry) continue;
          if (isExcludedMarketingDupPath(entry.path)) continue;
          if (!isBrandingPickerDeliverable(entry)) continue;
          /* Keep /media URL for hover preview only — list uses listSafeThumb. */
          if (entry.thumb_url && String(entry.thumb_url).indexOf("/media?") === 0) {
            entry = Object.assign({}, entry, { thumb_url: bridgeUrl() + entry.thumb_url });
          }
          if (entry.search_blob && String(entry.search_blob).length > 240) {
            entry = Object.assign({}, entry, {
              search_blob: String(entry.search_blob).slice(0, 240),
            });
          }
          var row = brandingEntryToPickerRow(entry);
          if (!row || !row.id) continue;
          row.linked_product_ids = entry.linked_product_ids || [];
          row.linked_variant_ids = entry.linked_variant_ids || [];
          row.folder_group_id = entry.folder_group_id || "";
          out.push(row);
          if (out.length >= PICKER_LIST_CAP) break;
        }
        return out;
      })
      .catch(function () {
        return (opts.materialCandidates || []).slice(0, PICKER_LIST_CAP);
      });
  }

  /** Browse branding grid on picker open (q= empty) — local index or API browse=1. */
  function loadBrandingPickerBrowse(opts) {
    opts = opts || {};
    if (global.DamBranding && typeof global.DamBranding.buildPickerBrowseRows === "function") {
      var localAssets = global.DamBranding.buildPickerBrowseRows({ cap: PICKER_LIST_CAP });
      if (localAssets && localAssets.length) {
        var localOut = [];
        for (var li = 0; li < localAssets.length; li++) {
          var rowL = brandingEntryToPickerRow(localAssets[li]);
          if (!rowL || !rowL.id) continue;
          if (isExcludedMarketingDupPath(rowL.path)) continue;
          localOut.push(rowL);
          if (localOut.length >= PICKER_LIST_CAP) break;
        }
        if (localOut.length) return Promise.resolve(localOut);
      }
    }
    return loadBrandingMaterialCandidates(
      Object.assign({}, opts, { bootstrapQuery: "", browse: true })
    );
  }

  /**
   * Kanoniczny COMBO z pickera skojarzeń.
   * kind=product → mode folder, pliki wyszarzone (wariant = folder rewizji).
   * kind=material → mode file, pliki klikalne (materiał brandingowy).
   * Kontekst zna opts.kind przekazany z openEditPicker / openMediaPicker.
   */
  function refreshAssocPickerFromCombo() {
    var pop = document.getElementById("damAssocEditPopover");
    if (pop && typeof pop._damAssocRefresh === "function") pop._damAssocRefresh();
  }

  function handleComboPicked(opts, selected, onDone, picked) {
    if (!picked) return;
    if (opts && opts.kind === "material") {
      var materialId = String(picked.id || picked.path || "").trim();
      if (!materialId) return;
      selected[materialId] = true;
      if (typeof onDone === "function") onDone(Object.keys(selected), picked);
      refreshAssocPickerFromCombo();
      return;
    }
    var folder = pickedPath(picked);
    if (!folder) return;
    ensureFileIndex().then(function (fi) {
      var ids = matchProductsByFolder((fi && fi.products) || [], folder);
      if (!ids.length) {
        toast("Nie znaleziono produktu dla tego folderu. Wybierz produkt z listy.");
        return;
      }
      var folderIndex = folderRevisionIndex(folder);
      var before = Object.keys(selected);
      var metaById = linkedMetaByIdFromCtx({ groupContext: opts.groupContext, asset: opts.asset });
      metaById = Object.assign(metaById, linkedMetaByIdFromRecords(before.map(function (pid) {
        return { id: pid };
      })));
      var merged = dedupeProductIds(before.concat(ids), productsByIdFromCache(), metaById, {
        preferLast: true,
      });
      var newIds = merged.filter(function (pid) {
        return before.indexOf(pid) === -1;
      });
      merged.forEach(function (pid) {
        selected[pid] = true;
      });
      Object.keys(selected).forEach(function (pid) {
        if (merged.indexOf(pid) === -1) delete selected[pid];
      });
      var pickMeta = {
        index: folderIndex,
        path: folder,
        ids: ids.slice(),
        newIds: newIds.slice(),
      };
      if (opts.assocCtx) opts.assocCtx.lastFolderPick = pickMeta;
      opts.lastFolderPick = pickMeta;
      if (newIds.length) {
        toast(
          newIds.length === 1
            ? "Dodano produkt z folderu" + (folderIndex ? " · " + folderIndex : "")
            : "Dodano produkty: " + newIds.length
        );
      } else if (folderIndex) {
        toast("Zaktualizowano indeks rewizji: " + folderIndex);
      } else {
        toast("Ten produkt jest już na liście skojarzeń");
      }
      if (typeof onDone === "function") onDone(Object.keys(selected), picked);
      refreshAssocPickerFromCombo();
    });
  }

  function openComboExplorerFromAssoc(opts, selected, onDone) {
    if (!global.DamFolderPicker || typeof global.DamFolderPicker.open !== "function") {
      toast("Brak modułu Eksploratora COMBO. Odśwież aplikację.");
      return;
    }
    var materialMode = opts && opts.kind === "material";
    var stacked = !!document.getElementById("damAssocEditPopover");
    global.DamFolderPicker.open({
      startDir: assocPickerStartDir(opts),
      mode: materialMode ? "file" : "folder",
      allowFolderPick: !materialMode,
      resolveBrandingAssetId: materialMode,
      showWindowsButton: true,
      stackOnAssoc: stacked,
      title: materialMode ? "Wybierz materiał w Eksploratorze COMBO" : "Eksplorator COMBO",
      onCancel: stacked
        ? function () {
            closePicker();
          }
        : null,
      onPicked: function (picked) {
        handleComboPicked(opts, selected, onDone, picked);
      },
    });
  }

  function openVariantBrowsePicker(opts, selected, onDone) {
    if (!global.DamFolderPicker || typeof global.DamFolderPicker.open !== "function") {
      toast("Brak modułu Eksploratora COMBO. Odśwież aplikację.");
      return;
    }
    var stacked = !!document.getElementById("damAssocEditPopover");
    global.DamFolderPicker.open({
      startDir: assocPickerStartDir(opts),
      mode: "file",
      allowFolderPick: true,
      resolveBrandingAssetId: !!(opts && opts.asset && opts.asset.id),
      showWindowsButton: true,
      stackOnAssoc: stacked,
      title: "Wskaż plik wariantu",
      onCancel: stacked
        ? function () {
            closePicker();
          }
        : null,
      onPicked: function (picked) {
        if (!picked) return;
        var id = String(picked.id || pickedPath(picked)).trim();
        if (id) selected[id] = true;
        if (typeof onDone === "function") onDone(Object.keys(selected), picked);
        refreshAssocPickerFromCombo();
      },
    });
  }

  /** @deprecated Alias — używaj openComboExplorerFromAssoc (ujednolicony COMBO + Windows). */
  function openDiskFolderPicker(opts, selected, onDone) {
    openComboExplorerFromAssoc(opts, selected, onDone);
  }

  var ASSOC_SAVE_TIMEOUT_MS = 15000;
  var ASSOC_SAVE_MAX_ATTEMPTS = 10;
  var ASSOC_SAVE_PENDING_KEY = "dam_assoc_save_pending_v1";
  var _assocSaveInflightKey = null;
  var _assocSavePending = Object.create(null);

  function assocSaveAssetKey(ctx) {
    return ctx && ctx.asset && ctx.asset.id ? String(ctx.asset.id) : "";
  }

  function assocSavePayload(ctx, productIds, variantIds) {
    return {
      asset_id: ctx.asset.id,
      folder_group_id: (ctx.groupContext && ctx.groupContext.folder_group_id) || "",
      linked_product_ids: (productIds || []).slice(),
      linked_variant_ids: (variantIds || []).slice(),
    };
  }

  function applyAssocSaveSuccess(ctx, productIds, variantIds, opts) {
    opts = opts || {};
    if (!opts.silentToast) toast("Zapisano skojarzenia");
    if (_assocOverrides && _assocOverrides.assets && ctx.asset && ctx.asset.id) {
      _assocOverrides.assets[ctx.asset.id] = {
        linked_product_ids: (productIds || []).slice(),
        linked_variant_ids: (variantIds || []).slice(),
        folder_group_id: (ctx.groupContext && ctx.groupContext.folder_group_id) || "",
      };
    }
    if (global.DamBranding && typeof global.DamBranding.clearComputeCache === "function") {
      global.DamBranding.clearComputeCache();
    }
    if (typeof ctx.onSaved === "function") ctx.onSaved(productIds, variantIds);
    bustAssocThumbsInScope();
  }

  function persistAssocSaveOffline(job) {
    if (!job || !job.payload) return;
    try {
      var list = JSON.parse(sessionStorage.getItem(ASSOC_SAVE_PENDING_KEY) || "[]");
      if (!Array.isArray(list)) list = [];
      list.push({
        payload: job.payload,
        attempt: job.attempt || 0,
        ts: Date.now(),
      });
      sessionStorage.setItem(ASSOC_SAVE_PENDING_KEY, JSON.stringify(list.slice(-40)));
    } catch (e) {
      /* quota / private mode */
    }
  }

  function flushPersistedAssocSaves() {
    var list = [];
    try {
      list = JSON.parse(sessionStorage.getItem(ASSOC_SAVE_PENDING_KEY) || "[]");
      if (!Array.isArray(list) || !list.length) return;
      sessionStorage.removeItem(ASSOC_SAVE_PENDING_KEY);
    } catch (e) {
      return;
    }
    list.forEach(function (entry) {
      if (!entry || !entry.payload) return;
      ensureBridgeSession()
        .then(function () {
          return saveAssociationsHttp(entry.payload, { timeoutMs: ASSOC_SAVE_TIMEOUT_MS });
        })
        .catch(function () {
          persistAssocSaveOffline({ payload: entry.payload, attempt: (entry.attempt || 0) + 1 });
        });
    });
  }

  function saveAssociationsHttp(payload, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs || ASSOC_SAVE_TIMEOUT_MS;
    return ensureBridgeSession().then(function () {
      var ctrl = new AbortController();
      var timer = setTimeout(function () {
        ctrl.abort();
      }, timeoutMs);
      return fetch(bridgeUrl() + "/branding/asset-associations", {
        method: "POST",
        headers: authHeaders(),
        signal: ctrl.signal,
        body: JSON.stringify(payload),
      }).finally(function () {
        clearTimeout(timer);
      });
    });
  }

  function saveAssociationsDirect(ctx, productIds, variantIds, opts) {
    opts = opts || {};
    if (!ctx || !ctx.asset || !ctx.asset.id) {
      if (!opts.suppressErrorToast) toast("Brak kontekstu materiału do zapisu skojarzeń.");
      return Promise.resolve({ ok: false, error: "missing_asset_ctx" });
    }
    if (productIds && productIds.length) {
      productIds = dedupeProductIds(
        productIds,
        productsByIdFromCache(),
        linkedMetaByIdFromCtx(ctx)
      );
    }
    var payload = assocSavePayload(ctx, productIds, variantIds);
    return saveAssociationsHttp(payload, opts)
      .then(function (r) {
        return r.json().then(function (res) {
          if (!r.ok || !res || !res.ok) {
            var code = (res && res.error) || ("http_" + r.status);
            if (code === "not_found") {
              throw new Error("bridge_endpoint_missing (zrestartuj local_bridge.py)");
            }
            throw new Error(code);
          }
          return res;
        });
      })
      .then(function (res) {
        applyAssocSaveSuccess(ctx, productIds, variantIds, opts);
        return res;
      })
      .catch(function (err) {
        var message = (err && err.message) || String(err);
        if (message === "AbortError" || /aborted/i.test(message)) {
          message = "timeout";
        }
        if (!opts.suppressErrorToast) {
          toast(
            message === "login_required"
              ? "Zaloguj się, aby zapisać skojarzenia."
              : "Błąd zapisu: " + message
          );
        }
        return { ok: false, error: message };
      });
  }

  function drainAssocSaveQueue() {
    if (_assocSaveInflightKey) return;
    var keys = Object.keys(_assocSavePending);
    if (!keys.length) return;
    var key = keys[0];
    var job = _assocSavePending[key];
    delete _assocSavePending[key];
    _assocSaveInflightKey = key;

    saveAssociationsDirect(job.ctx, job.productIds, job.variantIds, {
      silentToast: true,
      suppressErrorToast: true,
      timeoutMs: ASSOC_SAVE_TIMEOUT_MS,
    }).then(function (res) {
      _assocSaveInflightKey = null;
      if (res && res.ok !== false) {
        drainAssocSaveQueue();
        return;
      }
      job.attempt = (job.attempt || 0) + 1;
      if (job.attempt < ASSOC_SAVE_MAX_ATTEMPTS) {
        var delay = Math.min(20000, 700 * Math.pow(1.75, job.attempt));
        setTimeout(function () {
          _assocSavePending[key] = job;
          drainAssocSaveQueue();
        }, delay);
        return;
      }
      persistAssocSaveOffline({
        payload: assocSavePayload(job.ctx, job.productIds, job.variantIds),
        attempt: job.attempt,
      });
      if (!job._bgToastShown) {
        job._bgToastShown = true;
        toast("Synchronizacja skojarzeń w tle — możesz kontynuować pracę");
      }
      drainAssocSaveQueue();
    });
  }

  function enqueueAssocSave(ctx, productIds, variantIds, opts) {
    opts = opts || {};
    var key = assocSaveAssetKey(ctx);
    if (!key) {
      return saveAssociationsDirect(ctx, productIds, variantIds, opts);
    }
    if (productIds && productIds.length) {
      productIds = dedupeProductIds(
        productIds,
        productsByIdFromCache(),
        linkedMetaByIdFromCtx(ctx)
      );
    }
    _assocSavePending[key] = {
      ctx: ctx,
      productIds: (productIds || []).slice(),
      variantIds: (variantIds || []).slice(),
      opts: opts,
      attempt: 0,
    };
    drainAssocSaveQueue();
    return Promise.resolve({ ok: true, queued: true });
  }

  function saveAssociations(ctx, productIds, variantIds, opts) {
    opts = opts || {};
    if (opts.direct) {
      return saveAssociationsDirect(ctx, productIds, variantIds, opts);
    }
    return enqueueAssocSave(ctx, productIds, variantIds, opts);
  }

  function saveProductMaterialSuggestions(productId, nextIds, previousIds) {
    productId = String(productId || "").trim();
    if (!productId) {
      toast("Brak produktu do zapisania sugestii.");
      return Promise.resolve({ ok: false, error: "missing_product_id" });
    }
    var next = (nextIds || []).map(String);
    var previous = (previousIds || []).map(String);
    var added = next.filter(function (id) {
      return previous.indexOf(id) === -1;
    });
    var removed = previous.filter(function (id) {
      return next.indexOf(id) === -1;
    });
    var touched = added.concat(removed);
    if (!touched.length) return Promise.resolve({ ok: true, unchanged: true });

    return ensureBridgeSession()
      .then(function () {
        var chain = Promise.resolve();
        touched.forEach(function (assetId) {
          chain = chain.then(function () {
            return fetch(bridgeUrl() + "/branding/asset-associations", {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({
                asset_id: assetId,
                product_link_id: productId,
                product_link_action: added.indexOf(assetId) !== -1 ? "add" : "remove",
              }),
            }).then(function (r) {
              return r.json().then(function (res) {
                if (!r.ok || !res || !res.ok) {
                  throw new Error((res && res.error) || "save_failed");
                }
              });
            });
          });
        });
        return chain;
      })
      .then(function () {
        toast("Zapisano skojarzone materiały.");
        bustMaterialAssocCaches();
        if (
          global.DamViz &&
          typeof global.DamViz.persistLinkedMaterials === "function"
        ) {
          global.DamViz.persistLinkedMaterials(productId, next);
        }
        return { ok: true };
      })
      .catch(function (err) {
        var message = (err && err.message) || String(err);
        toast(
          message === "login_required"
            ? "Zaloguj się, aby zapisać skojarzenia."
            : "Błąd zapisu: " + message
        );
        return { ok: false, error: message };
      });
  }

  function ensureAssocGrid(colEl, kind) {
    if (!colEl) return null;
    var grid = colEl.querySelector(".dam-media-preview__assoc-grid, .dam-media-preview__variant-grid");
    if (grid) return grid;
    var empty = colEl.querySelector(".dam-media-preview__assoc-empty");
    grid = document.createElement("div");
    grid.className =
      kind === "variant" ? "dam-media-preview__variant-grid" : "dam-media-preview__assoc-grid";
    if (kind === "variant") {
      grid.setAttribute("role", "listbox");
      grid.setAttribute("aria-label", "Warianty w folderze");
    } else {
      grid.setAttribute("role", "list");
    }
    if (empty) {
      grid.appendChild(empty);
    }
    colEl.appendChild(grid);
    return grid;
  }

  /**
   * Pelne ID skojarzen do edycji.
   * Preferuj groupContext (juz przefiltrowany w UI brandingu) — NIE doklejaj
   * z powrotem folder_linked_product_ids (spray SLIDERY KATEGORIE).
   */
  function collectLinkedIdsFromCtx(ctx, kind) {
    var ids = [];
    var seen = {};
    function add(id) {
      id = String(id || "").trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      ids.push(id);
    }
    var gc = (ctx && ctx.groupContext) || {};
    var asset = (ctx && ctx.asset) || {};
    if (kind === "variant") {
      /* Viz: gc.variants = pool kandydatów, NIE lista pinów (inaczej renderPinned × tysiące = freeze). */
      if (ctx.variantPinnedIds && ctx.variantPinnedIds.length) {
        ctx.variantPinnedIds.forEach(function (id) {
          add(id);
        });
        return ids;
      }
      (gc.linked_variant_ids || asset.linked_variant_ids || []).forEach(add);
      if (ids.length) return ids;
      var pool = gc.variants || asset.folder_variants || asset.variants || [];
      var poolIsCandidates =
        !!(ctx.variantCandidates && ctx.variantCandidates.length) ||
        !!(gc.variantCandidates && gc.variantCandidates.length);
      if (poolIsCandidates && pool.length > 40) {
        return ids;
      }
      pool.forEach(function (v) {
        if (v && v.id) add(v.id);
      });
      return ids;
    }
    if (kind === "material") {
      (ctx.selectedIds || []).forEach(add);
      (ctx.materialsList || ctx.shownPrimaries || []).forEach(function (m) {
        if (m && m.id) add(m.id);
      });
      return ids;
    }
    var gcHas =
      (gc.linked_products && gc.linked_products.length) ||
      (gc.linked_product_ids && gc.linked_product_ids.length);
    if (gcHas) {
      (gc.linked_products || []).forEach(function (p) {
        if (p && p.id) add(p.id);
      });
      (gc.linked_product_ids || []).forEach(add);
      return ids;
    }
    effectiveLinkedProductIds(asset).forEach(add);
    if (!ids.length) {
      (asset.linked_products || []).forEach(function (p) {
        if (p && p.id) add(p.id);
      });
    }
    if (kind === "product") {
      return dedupeProductIds(ids, productsByIdFromCache(), linkedMetaByIdFromCtx(ctx));
    }
    return ids;
  }

  function openEditPicker(colEl, kind, ctx) {
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    ctx = ctx || {};
    if (!ctx.pickerMode) {
      ctx.pickerMode = resolvePickerMode(kind, ctx, ctx.pickerId);
    }
    var selectedIds = collectLinkedIdsFromCtx(ctx, kind);
    var excludeIds = [];
    var excludeIndexes = [];
    var gc = ctx.groupContext = ctx.groupContext || {};
    var asset = ctx.asset || {};
    if (kind === "product") {
      var explicit = (asset.linked_product_ids || []).slice();
      if (explicit.length) {
        var dedupedExplicit = dedupeProductIds(
          explicit,
          productsByIdFromCache(),
          linkedMetaByIdFromCtx(ctx)
        );
        if (dedupedExplicit.length !== explicit.length) {
          gc.linked_product_ids = dedupedExplicit.slice();
          patchLinkedProductsWithFolderPick(ctx, dedupedExplicit, null);
          var prevVidsDedupe = collectLinkedIdsFromCtx(ctx, "variant");
          saveAssociations(ctx, dedupedExplicit, prevVidsDedupe, { silentToast: true }).then(function () {
            if (typeof ctx.onRefresh === "function") ctx.onRefresh();
          });
          toast("Usunięto duplikaty indeksu ze skojarzeń");
          selectedIds = dedupedExplicit.slice();
        }
      }
    }
    if (gc.product_id) excludeIds.push(gc.product_id);
    if (gc.source_product_id) excludeIds.push(gc.source_product_id);
    if (gc.product_index) excludeIndexes.push(gc.product_index);
    if (gc.index) excludeIndexes.push(gc.index);
    if (ctx.asset && ctx.asset.product_id) excludeIds.push(ctx.asset.product_id);
    if (ctx.productContext && ctx.productContext.id) excludeIds.push(ctx.productContext.id);
    if (ctx.asset && ctx.asset.product_index) excludeIndexes.push(ctx.asset.product_index);
    /* Kontekst wizualizacji / produktu: filtr typu produktu (bez innych wizualizacji) */
    var filterType = kind === "product" ? "product" : "all";
    if (ctx.sourceType === "viz" || ctx.mode === "viz" || (ctx.asset && /viz|wizual/i.test(String(ctx.asset.type || ctx.asset.kind || "")))) {
      filterType = "product";
    }
    /* Upewnij sie, ze groupContext ma pelna liste do zapisu/undo (nie tylko uciety linked_products). */
    if (kind === "product") {
      gc.linked_product_ids = selectedIds.slice();
      var byId = {};
      (gc.linked_products || []).forEach(function (p) {
        if (p && p.id) byId[p.id] = p;
      });
      (ctx.asset && ctx.asset.linked_products ? ctx.asset.linked_products : []).forEach(function (p) {
        if (p && p.id && !byId[p.id]) byId[p.id] = p;
      });
      gc.linked_products = selectedIds.map(function (id) {
        return byId[id] || { id: id };
      });
    }
    var variantPool = (
      ctx.variantCandidates ||
      gc.variantCandidates ||
      gc.variants ||
      asset.folder_variants ||
      asset.variants ||
      []
    ).slice(0, 160);
    /* Golden path parity: material = ten sam openEditPicker co product, inny kind + model danych. */
    if (kind === "material") {
      var productId = String(
        (ctx.productContext && ctx.productContext.id) ||
          gc.product_id ||
          (gc.linked_product_ids && gc.linked_product_ids[0]) ||
          ""
      ).trim();
      if (!productId && ctx.asset && ctx.asset.linked_product_ids && ctx.asset.linked_product_ids.length) {
        productId = String(ctx.asset.linked_product_ids[0]).trim();
      }
      if (!productId) {
        toast("Brak produktu wizualizacji do sugestii materiałów.");
        return;
      }
      var materialCandidates = (
        ctx.materialsList ||
        ctx.shownPrimaries ||
        ctx.materialCandidates ||
        []
      ).slice();
      /* Pusty materialsList NIE blokuje open — bootstrap z indeksu produktu (630xxxx). */
      var bootstrapQuery = pickerBootstrapQueryFromCtx(ctx);
      if (!String(bootstrapQuery || "").trim() && ctx.productContext) {
        bootstrapQuery = String(
          ctx.productContext.index ||
            ctx.productContext.display_name ||
            ctx.productContext.name ||
            ""
        ).trim();
      }
      var prevMatIds = selectedIds.slice();
      var matPickerOpts = {
        kind: "material",
        pickerMode: PICKER_MODE_VIZ_SUGGESTIONS,
        pickerId: "5",
        head: "Skojarzone materiały brandingowe",
        selectedIds: selectedIds,
        pinnedIds: selectedIds.slice(),
        materialCandidates: materialCandidates,
        bootstrapQuery: bootstrapQuery,
        productContext: Object.assign({}, ctx.productContext || {}, { id: productId }),
        groupContext: Object.assign({}, gc, { product_id: productId }),
        assocCtx: ctx,
        onConfirm: function (ids) {
          var nextIds = (ids || []).slice();
          ctx.selectedIds = nextIds.slice();
          flushOptimisticMaterialUi(ctx, nextIds).then(function () {
            saveProductMaterialSuggestions(productId, nextIds, prevMatIds).then(function (res) {
              if (!res || res.ok === false) {
                ctx.selectedIds = prevMatIds.slice();
                flushOptimisticMaterialUi(ctx, prevMatIds);
                return;
              }
              if (typeof ctx.onRefresh === "function") {
                ctx.onRefresh({
                  materialIds: nextIds,
                  enriched: ctx.materialsList || [],
                  skipReload: true,
                });
              }
            });
          });
        },
      };
      openMediaPicker(colEl, matPickerOpts);
      return;
    }
    if (kind === "variant") {
      var prevVarIds = selectedIds.slice();
      var isVizProductPick = typeof ctx.onConfirmVariants === "function";
      var isBrandingMat = !isVizProductPick;
      var varPickerOpts = {
        kind: "variant",
        pickerMode: isVizProductPick ? PICKER_MODE_VIZ_PRODUCTS : PICKER_MODE_BRANDING_GROUPS,
        pickerId: isVizProductPick ? "4" : "1",
        head: isVizProductPick
          ? "Warianty produktu — wybierz rewizję (folder)"
          : "Warianty materiału",
        productSearchForVariants: isVizProductPick,
        brandingSearch: isBrandingMat,
        /* Seed query: tylko marketing_id/index (NIE asset.name — szeroki match + thumb storm). */
        bootstrapQuery: isBrandingMat
          ? String((asset && (asset.marketing_id || asset.index)) || (gc && gc.index) || "").trim()
          : "",
        filterType: isVizProductPick ? "product" : filterType,
        selectedIds: isVizProductPick ? [] : selectedIds.slice(0, 40),
        pinnedIds: selectedIds.slice(0, 40),
        variantCandidates: variantPool,
        asset: ctx.asset,
        groupContext: gc,
        assocCtx: ctx,
        excludeIds: excludeIds,
        excludeIndexes: excludeIndexes,
        onConfirmVariants: ctx.onConfirmVariants,
        onConfirm: function (ids) {
          if (typeof ctx.onConfirmVariants === "function") {
            ctx.onConfirmVariants(ids);
            return;
          }
          var prevPids = collectLinkedIdsFromCtx(ctx, "product");
          var vids = ids || [];
          flushOptimisticAssocUi(ctx, prevPids, vids);
          saveAssociations(ctx, prevPids, vids, { silentToast: false }).then(function (res) {
            if (!res || res.ok === false) {
              flushOptimisticAssocUi(ctx, prevPids, prevVarIds);
            }
          });
        },
        onVariantPicked: function (picked) {
          if (typeof ctx.onRefresh === "function") {
            ctx.onRefresh({ addedVariantPath: pickedPath(picked) || picked });
          }
        },
      };
      openMediaPicker(colEl, varPickerOpts);
      return;
    }
    openMediaPicker(colEl, {
      kind: kind,
      pickerMode: resolvePickerMode(kind, ctx, ctx.pickerId),
      pickerId: ctx.pickerId || (kind === "product" ? "2" : ""),
      selectedIds: selectedIds,
      pinnedIds: selectedIds.slice(),
      variantCandidates: kind === "variant" ? variantPool : gc.variants || [],
      asset: ctx.asset,
      groupContext: gc,
      assocCtx: ctx,
      excludeIds: excludeIds,
      excludeIndexes: excludeIndexes,
      filterType: filterType,
      onConfirm: function (ids) {
        if (kind === "variant" && typeof ctx.onConfirmVariants === "function") {
          ctx.onConfirmVariants(ids);
          return;
        }
        var prevPids = collectLinkedIdsFromCtx(ctx, "product");
        var prevVids = collectLinkedIdsFromCtx(ctx, "variant");
        var pids = kind === "product" ? ids : prevPids;
        var vids = kind === "variant" ? ids : prevVids;

        if (kind === "product") {
          pids = dedupeProductIds(pids, productsByIdFromCache(), linkedMetaByIdFromCtx(ctx));
          var addedProducts = pids.filter(function (pid) {
            return prevPids.indexOf(pid) === -1;
          });
          if (addedProducts.length) {
            vids = mergeVariantIdsForProducts(vids, addedProducts);
          }
        }

        if (kind === "product" && ctx.lastFolderPick) {
          patchLinkedProductsWithFolderPick(ctx, pids, ctx.lastFolderPick);
        }

        flushOptimisticAssocUi(ctx, pids, vids);

        /* Pkt 32: cooldown / soft-delete. Jesli zapis USUWA skojarzenia,
           daj okno "Cofnij" (~7 s) przywracajace poprzedni stan. */
        var prevForKind = kind === "product" ? prevPids : prevVids;
        var nextForKind = ids || [];
        var removed = prevForKind.filter(function (x) {
          return nextForKind.indexOf(x) === -1;
        });

        saveAssociations(ctx, pids, vids, {
          silentToast: removed.length > 0,
          optimistic: removed.length > 0,
        }).then(function (res) {
          ctx.lastFolderPick = null;
          if ((!res || res.ok === false) && !removed.length) {
            flushOptimisticAssocUi(ctx, prevPids, prevVids);
            return;
          }
          if (removed.length && global.DamDanger && typeof global.DamDanger.toastUndo === "function") {
            global.DamDanger.toastUndo({
              message:
                removed.length === 1
                  ? "Usunięto 1 skojarzenie"
                  : "Usunięto skojarzenia: " + removed.length,
              actionLabel: "Cofnij",
              duration: 1000,
              onUndo: function () {
                flushOptimisticAssocUi(ctx, prevPids, prevVids);
                saveAssociations(ctx, prevPids, prevVids, { silentToast: true }).then(function () {
                  if (typeof ctx.onRefresh === "function") ctx.onRefresh();
                });
              },
            });
          }
        });
      },
    });
  }

  function enterEditMode(colEl, kind, ctx) {
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    var grid = ensureAssocGrid(colEl, kind);
    if (!grid) {
      toast("Brak sekcji do edycji.");
      return;
    }
    if (grid.classList.contains("is-editing")) return;
    grid.classList.add("is-editing");
    colEl.classList.add("is-editing");

    var gcEdit = ctx.groupContext = ctx.groupContext || {};
    var selectedProducts = {};
    var selectedVariants = {};
    (gcEdit.linked_products || []).forEach(function (p) {
      if (p && p.id) selectedProducts[p.id] = true;
    });
    (gcEdit.variants || []).forEach(function (v) {
      if (v && v.id) selectedVariants[v.id] = true;
    });

    var toolbar = document.createElement("div");
    toolbar.className = "dam-assoc-edit-toolbar";
    toolbar.innerHTML =
      '<button type="button" class="dam-assoc-edit-toolbar__btn" data-add><i class="uil uil-plus"></i> Dodaj</button>' +
      (kind === "product"
        ? '<button type="button" class="dam-assoc-edit-toolbar__btn" data-combo-explorer><i class="uil uil-folder-plus"></i> Dodaj z dysku</button>'
        : '<button type="button" class="dam-assoc-edit-toolbar__btn" data-browse><i class="uil uil-folder-open"></i> Wskaż</button>') +
      '<button type="button" class="dam-assoc-edit-toolbar__btn dam-assoc-edit-toolbar__btn--primary" data-save><i class="uil uil-check"></i> Zapisz</button>' +
      '<button type="button" class="dam-assoc-edit-toolbar__btn" data-cancel><i class="uil uil-times"></i> Anuluj</button>';
    var labelRow = colEl.querySelector(".dam-media-preview__assoc-label-row");
    if (labelRow && labelRow.parentNode) {
      labelRow.insertAdjacentElement("afterend", toolbar);
    } else {
      colEl.insertBefore(toolbar, grid);
    }
    requestAnimationFrame(function () {
      toolbar.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    function exitEdit() {
      grid.classList.remove("is-editing");
      colEl.classList.remove("is-editing");
      if (toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
      if (typeof ctx.onRefresh === "function") ctx.onRefresh();
    }

    toolbar.querySelector("[data-cancel]").addEventListener("click", exitEdit);
    toolbar.querySelector("[data-save]").addEventListener("click", function () {
      var pids =
        kind === "product"
          ? Object.keys(selectedProducts)
          : (ctx.groupContext.linked_products || [])
              .map(function (p) {
                return p && p.id;
              })
              .filter(Boolean);
      var vids =
        kind === "variant"
          ? Object.keys(selectedVariants)
          : (ctx.groupContext.variants || [])
              .map(function (v) {
                return v && v.id;
              })
              .filter(Boolean);
      saveAssociations(ctx, pids, vids).then(function () {
        exitEdit();
      });
    });
    toolbar.querySelector("[data-add]").addEventListener("click", function () {
      openMediaPicker(toolbar.querySelector("[data-add]"), {
        kind: kind,
        selectedIds: kind === "product" ? Object.keys(selectedProducts) : Object.keys(selectedVariants),
        variantCandidates: ctx.groupContext.variants || [],
        asset: ctx.asset,
        groupContext: ctx.groupContext,
        excludeIds: [ctx.groupContext && ctx.groupContext.product_id, ctx.asset && ctx.asset.product_id].filter(Boolean),
        excludeIndexes: [ctx.groupContext && ctx.groupContext.product_index, ctx.asset && ctx.asset.product_index].filter(Boolean),
        filterType: kind === "product" ? "product" : "all",
        asset: ctx.asset,
        onConfirm: function (ids) {
          ids.forEach(function (id) {
            if (kind === "product") selectedProducts[id] = true;
            else selectedVariants[id] = true;
          });
        },
      });
    });
    if (toolbar.querySelector("[data-combo-explorer]")) {
      toolbar.querySelector("[data-combo-explorer]").addEventListener("click", function () {
        openComboExplorerFromAssoc(
          { asset: ctx.asset, kind: "product" },
          selectedProducts,
          function () {}
        );
      });
    }
    if (toolbar.querySelector("[data-browse]")) {
      toolbar.querySelector("[data-browse]").addEventListener("click", function () {
        openVariantBrowsePicker({ asset: ctx.asset, groupContext: ctx.groupContext }, selectedVariants, function (ids) {
          ids.forEach(function (id) {
            selectedVariants[id] = true;
          });
        });
      });
    }
  }

  function quickRemoveProductAssoc(ctx, productId) {
    if (!canEditAssoc() || !productId) return Promise.resolve();
    var prevPids = collectLinkedIdsFromCtx(ctx, "product");
    var nextPids = prevPids.filter(function (id) {
      return id !== productId;
    });
    if (nextPids.length === prevPids.length) return Promise.resolve();
    var prevVids = (ctx.groupContext.variants || [])
      .map(function (v) {
        return v && v.id;
      })
      .filter(Boolean);
    function restoreSeed() {
      patchCtxProductIds(ctx, prevPids);
      if (typeof ctx.onRefresh === "function") ctx.onRefresh();
    }
    patchCtxProductIds(ctx, nextPids);
    if (typeof ctx.onRefresh === "function") ctx.onRefresh();
    return seedEnrichAssocSave(ctx, nextPids, prevVids, {
      message: "Usunięto 1 skojarzenie",
      actionLabel: "Cofnij",
      duration: 1000,
      onUndo: function () {
        restoreSeed();
        saveAssociations(ctx, prevPids, prevVids, { silentToast: true });
      },
    });
  }

  /** Shift+minus na kafelku WARIANTY MATERIAŁU — usuwa wariant z grupy. */
  function quickRemoveVariantAssoc(ctx, variantId) {
    if (!canEditAssoc() || !variantId) return Promise.resolve();
    var prevVids = collectLinkedIdsFromCtx(ctx, "variant");
    var nextVids = prevVids.filter(function (id) {
      return id !== variantId;
    });
    if (nextVids.length === prevVids.length) return Promise.resolve();
    var prevPids = collectLinkedIdsFromCtx(ctx, "product");
    function restoreSeed() {
      patchCtxVariantIds(ctx, prevVids);
      if (typeof ctx.onRefresh === "function") ctx.onRefresh();
    }
    patchCtxVariantIds(ctx, nextVids);
    if (typeof ctx.onRefresh === "function") ctx.onRefresh();
    return seedEnrichAssocSave(ctx, prevPids, nextVids, {
      message: "Usunięto 1 wariant",
      actionLabel: "Cofnij",
      duration: 1000,
      onUndo: function () {
        restoreSeed();
        saveAssociations(ctx, prevPids, prevVids, { silentToast: true });
      },
    });
  }

  var ALLFILE_SOFT_HIDE_KEY = "dam_allfile_soft_hide_v1";

  function readAllFileSoftHide() {
    try {
      var raw = sessionStorage.getItem(ALLFILE_SOFT_HIDE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeAllFileSoftHide(arr) {
    try {
      sessionStorage.setItem(ALLFILE_SOFT_HIDE_KEY, JSON.stringify(arr || []));
    } catch (e) {
      /* ignore quota */
    }
  }

  function allFileTileKey(tile) {
    if (!tile) return "";
    var path = String(tile.getAttribute("data-all-path") || "").trim().toLowerCase().replace(/\\/g, "/");
    if (path) return "path:" + path;
    var assetId = String(tile.getAttribute("data-asset-id") || "").trim();
    if (assetId) return "asset:" + assetId;
    var vidx = tile.getAttribute("data-all-vidx");
    if (vidx != null && String(vidx) !== "") return "vidx:" + String(vidx);
    var sib = tile.getAttribute("data-all-sib");
    if (sib != null && String(sib) !== "" && String(sib) !== "-1") return "sib:" + String(sib);
    var lab =
      tile.querySelector(".dam-media-preview__all-file-label") ||
      tile.querySelector(".dam-media-preview__assoc-name");
    var labT = lab ? String(lab.textContent || "").trim() : "";
    return labT ? "lab:" + labT : "";
  }

  /**
   * Soft-hide all-file quality tile from "Pokaż wszystkie" picker only.
   * NEVER deletes disk files. Session-scoped; undo restores tile.
   */
  function softHideAllFileTile(tile) {
    var key = allFileTileKey(tile);
    if (!key || !tile) return;
    var list = readAllFileSoftHide();
    if (list.indexOf(key) < 0) {
      list.push(key);
      writeAllFileSoftHide(list);
    }
    tile.style.display = "none";
    tile.setAttribute("data-soft-hidden", "1");
    var labelEl = tile.querySelector(".dam-media-preview__all-file-label");
    var label = labelEl ? String(labelEl.textContent || "").trim() : "plik";
    if (global.DamDanger && typeof global.DamDanger.toastUndo === "function") {
      global.DamDanger.toastUndo({
        message: "Ukryto " + label + " z listy (nie usunięto z dysku)",
        actionLabel: "Cofnij",
        duration: 1000,
        onUndo: function () {
          var next = readAllFileSoftHide().filter(function (k) {
            return k !== key;
          });
          writeAllFileSoftHide(next);
          tile.style.display = "";
          tile.removeAttribute("data-soft-hidden");
        },
      });
    } else {
      toast("Ukryto " + label + " z listy (nie usunięto z dysku)");
    }
  }

  function applyAllFileSoftHide(host) {
    if (!host) return;
    var hide = readAllFileSoftHide();
    if (!hide.length) return;
    host.querySelectorAll(".dam-media-preview__all-file").forEach(function (tile) {
      var key = allFileTileKey(tile);
      if (key && hide.indexOf(key) >= 0) {
        tile.style.display = "none";
        tile.setAttribute("data-soft-hidden", "1");
      }
    });
  }

  function formatHoldSecsLabel(ms) {
    var s = (ms > 0 ? ms : 1500) / 1000;
    if (Math.abs(s - Math.round(s)) < 0.001) return String(Math.round(s));
    return String(Math.round(s * 10) / 10).replace(".", ",");
  }

  /**
   * Shared hold-to-remove minus control (DamDanger cursor ring + shift gate).
   * Parent may be BUTTON (.all-file) → use span[role=button] (no nested <button>).
   */
  function wireQuickMinusControl(item, shiftHost, onClick, tip) {
    if (!item || item.querySelector(".dam-assoc-quick-minus")) return null;
    var nestSafe = String(item.tagName || "").toUpperCase() === "BUTTON";
    var btn = document.createElement(nestSafe ? "span" : "button");
    if (!nestSafe) btn.type = "button";
    btn.className = "dam-assoc-quick-minus";
    btn.setAttribute("role", "button");
    btn.tabIndex = 0;
    var holdMs =
      (global.DamDanger && global.DamDanger.DEFAULT_HOLD_MS) ||
      (global.DamDanger && global.DamDanger.MAX_HOLD_MS) ||
      1500;
    var tipText =
      tip || "Shift + przytrzymaj " + formatHoldSecsLabel(holdMs) + " s, aby usunąć";
    btn.setAttribute("aria-label", tipText);
    btn.title = tipText;
    btn.setAttribute("data-dam-tip", tipText);
    btn.innerHTML = '<i class="uil uil-minus" aria-hidden="true"></i>';

    function shiftArmed() {
      return !!(
        shiftKeyDown ||
        (shiftHost && shiftHost.classList.contains("is-shift-hover"))
      );
    }

    item.appendChild(btn);

    if (global.DamDanger && typeof global.DamDanger.bind === "function") {
      btn.addEventListener(
        "pointerdown",
        function (e) {
          if (e.button !== undefined && e.button !== 0) return;
          if (!e.shiftKey && !shiftArmed()) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        },
        true
      );
      global.DamDanger.bind(btn, {
        label: "Usuń skojarzenie",
        hint: tipText,
        holdMs: holdMs,
        disableSafeDeleteAction: true,
        onConfirm: function () {
          if (!shiftArmed()) return;
          onClick();
        },
      });
    }

    if (!global.DamDanger || !global.DamDanger.isSafeDeleteEnabled()) {
      btn.addEventListener("click", function (e) {
        if (!shiftArmed()) return;
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
    }

    return btn;
  }

  function bindShiftHoverHost(host, opts) {
    if (!host || host._damShiftUxBound) return;
    host._damShiftUxBound = true;
    opts = opts || {};
    function setShift(on) {
      var active = !!(on || shiftKeyDown);
      host.classList.toggle("is-shift-hover", active);
      host.querySelectorAll(".dam-assoc-quick-minus").forEach(function (btn) {
        btn.classList.toggle("is-shift-visible", active);
      });
      if (active && typeof opts.onShiftOn === "function") opts.onShiftOn();
    }
    host.addEventListener("mousemove", function (e) {
      setShift(!!e.shiftKey || shiftKeyDown);
    });
    host.addEventListener("mouseenter", function (e) {
      setShift(!!e.shiftKey || shiftKeyDown);
    });
    host.addEventListener("mouseleave", function () {
      if (!shiftKeyDown) setShift(false);
    });
  }

  function resolveModalScope(el) {
    return (
      (el &&
        el.closest &&
        el.closest("#damVizModal, #damMediaPreview, .dam-viz-modal-overlay, .dam-media-preview-overlay")) ||
      document.getElementById("damVizModal") ||
      document.getElementById("damMediaPreview") ||
      el
    );
  }

  /** Assoc pane scope: branding-split (products + materials) before inner --materials col. */
  function resolveAssocPaneScope(el) {
    if (!el) return el;
    if (el.closest) {
      var brandingSplit = el.closest(".dam-media-preview__assoc-col--branding-split");
      if (brandingSplit) return brandingSplit;
      var vizPane = el.closest(".dam-viz-modal__assoc-pane");
      if (vizPane) return vizPane;
      var assocCol = el.closest(".dam-media-preview__assoc-col");
      if (assocCol) return assocCol;
    }
    return el;
  }

  /**
   * Wire Shift-minus onto studio "Pokaż wszystkie" quality tiles (.all-file).
   * Action = soft-hide from picker (session), never disk delete.
   */
  function wireStudioAllFiles(host) {
    if (!host || !canEditAssoc()) return;
    ensureInjectedCss();
    if (typeof window.__damInjectUiHardFixes === "function") {
      window.__damInjectUiHardFixes();
    }
    applyAllFileSoftHide(host);
    var panels = host.matches && host.matches(".dam-media-preview__all-files")
      ? [host]
      : Array.prototype.slice.call(host.querySelectorAll(".dam-media-preview__all-files"));
    if (!panels.length && host.querySelectorAll(".dam-media-preview__all-file").length) {
      panels = [host];
    }
    panels.forEach(function (panel) {
      panel.querySelectorAll(".dam-media-preview__all-file").forEach(function (tile) {
        if (tile.getAttribute("data-soft-hidden") === "1") return;
        wireQuickMinusControl(
          tile,
          panel,
          function () {
            softHideAllFileTile(tile);
          },
          "Shift + przytrzymaj " + formatHoldSecsLabel(1500) + " s, aby ukryć z listy (nie usuwa z dysku)"
        );
      });
      bindShiftHoverHost(panel);
      if (shiftKeyDown) {
        panel.classList.add("is-shift-hover");
        panel.querySelectorAll(".dam-assoc-quick-minus").forEach(function (btn) {
          btn.classList.add("is-shift-visible");
        });
      }
    });
    ensureGlobalShiftKeyLatch(resolveModalScope(host));
  }

  function applyShiftToScope(scope, down) {
    if (!scope) return;
    scope
      .querySelectorAll(
        ".dam-media-preview__assoc-grid, .dam-media-preview__variant-grid, .dam-media-preview__all-files"
      )
      .forEach(function (grid) {
        grid.classList.toggle("is-shift-hover", !!down);
        grid.querySelectorAll(".dam-assoc-quick-minus").forEach(function (btn) {
          btn.classList.toggle("is-shift-visible", !!down);
        });
        if (down && grid.classList.contains("dam-media-preview__assoc-grid")) {
          var plus = grid.querySelector(".dam-media-preview__assoc-plus-tile");
          if (!plus) {
            grid.dispatchEvent(new MouseEvent("mousemove", { shiftKey: true, bubbles: true }));
          }
        }
      });
  }

  function ensureGlobalShiftKeyLatch(scopeEl) {
    if (!scopeEl || scopeEl._damShiftKeyBound) return;
    scopeEl._damShiftKeyBound = true;
    function scopeOpen() {
      if (!scopeEl.isConnected) return false;
      var style = window.getComputedStyle(scopeEl);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (scopeEl.hasAttribute("hidden")) return false;
      if (scopeEl.getAttribute("aria-hidden") === "true") return false;
      return true;
    }
    function onKey(e) {
      if (e.key !== "Shift") return;
      shiftKeyDown = e.type === "keydown";
      if (!scopeOpen()) return;
      applyShiftToScope(scopeEl, shiftKeyDown);
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener(
      "blur",
      function () {
        shiftKeyDown = false;
        applyShiftToScope(scopeEl, false);
      },
      true
    );
  }

  /**
   * Shift+hover UX — JEDNA ścieżka globalna:
   * branding (#damMediaPreviewAssoc) + viz (#damVizModalAssoc) + studio all-files
   * + WARIANTY / explorer media-preview assoc tiles.
   * - item z data-product-id → minus usuwa produkt
   * - item z data-linked-asset-idx (material) → minus odcina biezacy produkt od assetu
   * - item--variant / data-variant-id → minus usuwa wariant materiałuu
   * - .all-file → soft-hide z pickera (nie kasuje dysku)
   * - plus na koncu → Edytuj wszystko (openEditPicker)
   */
  function ensureShiftHoverAssocUx(assocEl, ctx) {
    if (!assocEl || !ctx || !canEditAssoc()) return;
    ensureInjectedCss();
    if (typeof window.__damInjectUiHardFixes === "function") {
      window.__damInjectUiHardFixes();
    }
    var scope = resolveModalScope(assocEl) || assocEl;

    /* Collect grids from assoc pane AND modal (Elementy / Surowe mount late).
       Use array identity — object-keying HTMLElements collapses to one slot. */
    var gridList = [];
    function collectGrids(root) {
      if (!root || !root.querySelectorAll) return;
      root
        .querySelectorAll(".dam-media-preview__assoc-grid, .dam-media-preview__variant-grid")
        .forEach(function (grid) {
          if (gridList.indexOf(grid) >= 0) return;
          gridList.push(grid);
        });
    }
    collectGrids(assocEl);
    collectGrids(scope);
    /* Viz: product-variant strip lives outside assoc-pane — collect from modal root. */
    var vizModal =
      (scope && scope.id === "damVizModal" && scope) ||
      (scope && scope.closest && scope.closest("#damVizModal")) ||
      (assocEl && assocEl.closest && assocEl.closest("#damVizModal")) ||
      null;
    if (vizModal) collectGrids(vizModal);

    gridList.forEach(function (grid) {
        var isVariantGrid = grid.classList.contains("dam-media-preview__variant-grid");
        var inElementy = !!(
          grid.closest &&
          grid.closest(".dam-media-preview__elementy-panel, .dam-media-preview__elementy")
        );
        function ensurePlusTile() {
          /* 3.1.5: plus → klik ukrytego Edytuj wszystko / +Dodaj, fallback openEditPicker. */
          if (
            isVariantGrid &&
            !grid.classList.contains("dam-media-preview__variant-grid--material")
          ) {
            return null;
          }
          if (inElementy) return null;
          var col = grid.closest(".dam-media-preview__assoc-col") || assocEl;
          var visibleCta = col && col.querySelector("[data-viz-assoc-cta]:not([hidden])");
          if (visibleCta) return null;
          var plus = grid.querySelector(".dam-media-preview__assoc-plus-tile");
          if (plus) return plus;
          plus = document.createElement("button");
          plus.type = "button";
          plus.className = "dam-media-preview__assoc-plus-tile";
          plus.setAttribute("aria-label", "Edytuj wszystko — dodaj skojarzenie");
          plus.innerHTML = '<i class="uil uil-plus" aria-hidden="true"></i><span>Dodaj</span>';
          plus.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var col = grid.closest(".dam-media-preview__assoc-col") || assocEl;
            var editBtn = col.querySelector("[data-assoc-edit-all], [data-viz-assoc-cta]");
            if (editBtn) {
              editBtn.click();
              return;
            }
            openEditPicker(col, isVariantGrid ? "variant" : "product", ctx);
          });
          grid.appendChild(plus);
          return plus;
        }

        grid.querySelectorAll(".dam-media-preview__assoc-item[data-product-id]").forEach(function (item) {
          wireQuickMinusControl(item, grid, function () {
            quickRemoveProductAssoc(ctx, item.getAttribute("data-product-id") || "");
          });
        });

        grid.querySelectorAll(".dam-media-preview__assoc-item--asset").forEach(function (item) {
          wireQuickMinusControl(item, grid, function () {
            var idxBtn = item.querySelector(
              "[data-linked-asset-idx], [data-element-asset-idx], [data-element-link-idx]"
            );
            var idx = 0;
            if (idxBtn) {
              idx =
                parseInt(
                  idxBtn.getAttribute("data-linked-asset-idx") ||
                    idxBtn.getAttribute("data-element-asset-idx") ||
                    idxBtn.getAttribute("data-element-link-idx"),
                  10
                ) || 0;
            }
            var materials = (
              grid._damAssocList ||
              ctx.materialsList ||
              ctx.shownPrimaries ||
              []
            ).slice();
            var assetId = item.getAttribute("data-asset-id") || "";
            var asset =
              materials[idx] ||
              materials.find(function (a) {
                return a && String(a.id) === String(assetId);
              }) ||
              ctx.asset;
            var pid =
              (ctx.productContext && ctx.productContext.id) ||
              (ctx.groupContext && ctx.groupContext.product_id) ||
              (window.__damLastAssocProductCtx && window.__damLastAssocProductCtx.id) ||
              "";
            if (!asset || !pid) {
              softHideAllFileTile(item);
              return;
            }
            quickUnlinkProductFromMaterial(ctx, asset, pid);
          });
        });

        grid.querySelectorAll(".dam-media-preview__assoc-item--variant[data-variant-id]").forEach(function (item) {
          wireQuickMinusControl(item, grid, function () {
            quickRemoveVariantAssoc(ctx, item.getAttribute("data-variant-id") || "");
          });
        });

        /* Viz modal: WARIANTY PRODUKTU (button.dam-viz-modal__variant, not assoc-item). */
        grid.querySelectorAll(".dam-viz-modal__variant[data-variant-key]").forEach(function (item) {
          wireQuickMinusControl(item, grid, function () {
            var vkey = item.getAttribute("data-variant-key") || "";
            var vpath = item.getAttribute("data-path") || "";
            if (typeof ctx.onRemoveProductVariant === "function") {
              ctx.onRemoveProductVariant(vkey, vpath);
              return;
            }
            var modalRoot = resolveModalScope(scope);
            var vctx =
              (modalRoot && modalRoot._damVizVariantsCtx) ||
              (modalRoot && modalRoot._damAssocCtx) ||
              null;
            if (vctx && typeof vctx.onRemoveProductVariant === "function") {
              vctx.onRemoveProductVariant(vkey, vpath);
            }
          });
        });

        bindShiftHoverHost(grid, {
          onShiftOn: function () {
            ensurePlusTile();
          },
        });
      });

    /* Studio all-files live under modal (sibling of assoc pane) — wire globally. */
    wireStudioAllFiles(scope);
    ensureGlobalShiftKeyLatch(scope);
  }

  /** Odetnij produkt od materialu brandingowego (viz Shift+minus). */
  function quickUnlinkProductFromMaterial(ctx, asset, productId) {
    if (!canEditAssoc() || !asset || !asset.id || !productId) return Promise.resolve();
    var prev = [];
    var seen = {};
    function add(id) {
      id = String(id || "").trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      prev.push(id);
    }
    (asset.linked_products || []).forEach(function (p) {
      if (p && p.id) add(p.id);
    });
    (asset.linked_product_ids || []).forEach(add);
    (asset.folder_linked_product_ids || []).forEach(add);
    var next = prev.filter(function (id) {
      return id !== productId;
    });
    if (next.length === prev.length) return Promise.resolve();
    var matCtx = {
      asset: asset,
      groupContext: {
        folder_group_id: asset.folder_group_id || "",
        linked_products: next.map(function (id) {
          return { id: id };
        }),
        linked_product_ids: next.slice(),
        variants: [],
      },
      onSaved: function () {
        if (typeof ctx.onRefresh === "function") ctx.onRefresh();
      },
      onRefresh: ctx.onRefresh,
    };
    function restoreSeed() {
      patchAssetProductIds(asset, prev);
      if (typeof ctx.onRefresh === "function") ctx.onRefresh();
    }
    patchAssetProductIds(asset, next);
    if (typeof ctx.onRefresh === "function") ctx.onRefresh();
    return seedEnrichAssocSave(matCtx, next, [], {
      message: "Usunięto 1 skojarzenie",
      actionLabel: "Cofnij",
      duration: 1000,
      onUndo: function () {
        restoreSeed();
        saveAssociations(matCtx, prev, [], { silentToast: true });
      },
    });
  }

  function vizMaterialsPickerPack(ctx) {
    ctx = ctx || {};
    var productId = String(
      (ctx.productContext && ctx.productContext.id) ||
        (ctx.groupContext && ctx.groupContext.product_id) ||
        ""
    ).trim();
    var selectedIds = [];
    var seen = {};
    function add(id) {
      id = String(id || "").trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      selectedIds.push(id);
    }
    (ctx.materialsList || ctx.shownPrimaries || []).forEach(function (m) {
      if (m && m.id) add(m.id);
    });
    return {
      productId: productId,
      selectedIds: selectedIds,
      materialCandidates: (ctx.materialsList || ctx.shownPrimaries || []).slice(),
    };
  }

  function resolveMaterialsCtx(root, col) {
    return (
      (col && col._damMaterialsCtx) ||
      (root && root._damMaterialsCtx) ||
      null
    );
  }

  function openVizMaterialsEdit315(anchorBtn, modalRoot, openOpts) {
    openOpts = openOpts || {};
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    modalRoot =
      modalRoot ||
      (anchorBtn &&
        (anchorBtn.closest("#damVizModal") || anchorBtn.closest("#damMediaPreview"))) ||
      document.getElementById("damVizModal") ||
      document.getElementById("damMediaPreview");
    var col =
      (anchorBtn && anchorBtn.closest(".dam-media-preview__assoc-col")) ||
      (modalRoot &&
        (modalRoot.querySelector(".dam-media-preview__assoc-col--materials") ||
          modalRoot.querySelector(".dam-viz-modal__assoc"))) ||
      null;
    var ctx = resolveMaterialsCtx(modalRoot, col);
    if (!ctx && modalRoot && modalRoot._damMaterialsCtx) {
      ctx = modalRoot._damMaterialsCtx;
    }
    /* Pusty stan „Brak skojarzonych materiałów” NIE blokuje CTA — dogeneruj seed z produktu. */
    if (!ctx && modalRoot) {
      var goBtn = modalRoot.querySelector("#damVizModalGoProduct");
      var pid = (goBtn && goBtn.getAttribute("data-pid")) || "";
      var titleEl = modalRoot.querySelector(".dam-viz-modal__title");
      var idxChip = modalRoot.querySelector("#damVizModalAssetId, .dam-viz-badge--index");
      var idxBlob = (idxChip && (idxChip.getAttribute("data-marketing-id") || idxChip.textContent)) || "";
      var idxMatch = String(idxBlob).match(/\b(630\d{4}|000\d{3})\b/);
      if (pid || idxMatch) {
        ctx = seedMaterialsCtx(modalRoot, {
          productContext: {
            id: pid,
            name: (titleEl && titleEl.textContent) || "",
            index: idxMatch ? idxMatch[1] : "",
          },
        });
      }
    }
    if (!ctx || !(ctx.productContext && ctx.productContext.id)) {
      var linkedProd =
        modalRoot &&
        modalRoot.querySelector(
          "#damMediaPreviewLinkedProductsHost [data-product-id], .dam-media-preview__assoc-pane-section--products [data-product-id]"
        );
      var linkedPid = linkedProd && linkedProd.getAttribute("data-product-id");
      if (linkedPid) {
        ctx = seedMaterialsCtx(modalRoot, {
          productContext: { id: linkedPid },
          groupContext: { linked_product_ids: [linkedPid] },
        });
      }
    }
    if (!col && modalRoot) {
      col =
        modalRoot.querySelector(".dam-media-preview__assoc-col--materials") ||
        modalRoot.querySelector(".dam-viz-modal__assoc-pane") ||
        modalRoot;
    }
    if (!col || !ctx) {
      toast("Brak kontekstu materiałów.");
      return;
    }
    ctx.pickerMode = openOpts.pickerMode || PICKER_MODE_VIZ_SUGGESTIONS;
    ctx.pickerId = openOpts.pickerId || "5";
    openEditPicker(col, "material", ctx);
  }

  function openVizAssocSuggestionsPicker(modal, btn) {
    openVizMaterialsEdit315(btn, modal);
  }

  function resolvePickerCtx(root, col, kind) {
    if (kind === "material") return resolveMaterialsCtx(root, col);
    if (col && col._damAssocCtx) return col._damAssocCtx;
    if (kind === "variant" && root && root._damVizVariantsCtx) return root._damVizVariantsCtx;
    return root && root._damAssocCtx;
  }

  function openVizAssocVariantsPicker(modal, opts) {
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    modal = modal || document.getElementById("damVizModal");
    opts = opts || (modal && modal._damVizAssocCtasOpts) || {};
    var vctx = opts.variantsCtx || (modal && modal._damVizVariantsCtx);
    if (!vctx) {
      toast("Brak kontekstu wariantów.");
      return;
    }
    var col =
      (modal &&
        (modal.querySelector(".dam-viz-modal__product-variants .dam-media-preview__assoc-col--variants") ||
          modal.querySelector(".dam-media-preview__assoc-col--variants"))) ||
      null;
    if (!col) {
      toast("Brak sekcji wariantów.");
      return;
    }
    openEditPicker(col, "variant", vctx);
  }

  function onAssocCtaClick(e) {
    var btn = e.target.closest("[data-viz-assoc-cta], [data-assoc-edit-all]");
    if (!btn) return;
    var root = e.currentTarget;
    if (!root.contains(btn)) return;
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    var pickerId = btn.getAttribute("data-dam-assoc-picker-id") || "";
    var kind = btn.getAttribute("data-viz-assoc-cta") || btn.getAttribute("data-assoc-edit-all") || "product";
    if (kind === "suggestions") kind = "material";
    if (kind === "variants") kind = "variant";
    var pickerMode = resolvePickerMode(kind, { pickerId: pickerId }, pickerId);
    /* product: golden path — bez zmian (openEditPicker → ensureFileIndex async). */
    if (kind === "material") {
      var mediaMatRoot =
        root && (root.id === "damMediaPreview" ? root : root.closest("#damMediaPreview"));
      if (mediaMatRoot) {
        var colMat = btn.closest(
          ".dam-media-preview__assoc-col--materials, .dam-media-preview__assoc-section"
        );
        var mctx = resolveMaterialsCtx(mediaMatRoot, colMat);
        var hasVizProduct =
          mctx &&
          String(
            (mctx.productContext && mctx.productContext.id) ||
              (mctx.groupContext && mctx.groupContext.product_id) ||
              (mctx.groupContext &&
                mctx.groupContext.linked_product_ids &&
                mctx.groupContext.linked_product_ids[0]) ||
              ""
          ).trim();
        if (
          !hasVizProduct &&
          mctx &&
          (mctx.asset ||
            (mctx.groupContext &&
              mctx.groupContext.linked_product_ids &&
              mctx.groupContext.linked_product_ids.length))
        ) {
          openEditPicker(
            colMat || btn.closest(".dam-media-preview__assoc-col"),
            "variant",
            Object.assign({}, mctx, {
              brandingSearch: true,
              pickerMode: PICKER_MODE_BRANDING_GROUPS,
              pickerId: pickerId || "1",
            })
          );
          return;
        }
      }
      openVizMaterialsEdit315(btn, root, { pickerMode: pickerMode, pickerId: pickerId || "5" });
      return;
    }
    var mediaPreviewRoot =
      root && (root.id === "damMediaPreview" ? root : root.closest("#damMediaPreview"));
    if (kind === "variant" && mediaPreviewRoot) {
      var colBr = btn.closest(
        ".dam-media-preview__assoc-col--related, .dam-media-preview__assoc-col--materials"
      );
      var actxBr = resolvePickerCtx(mediaPreviewRoot, colBr, "variant");
      if (colBr && actxBr) {
        openEditPicker(
          colBr,
          "variant",
          Object.assign({}, actxBr, {
            brandingSearch: true,
            pickerMode: PICKER_MODE_BRANDING_GROUPS,
            pickerId: pickerId || "1",
          })
        );
        return;
      }
    }
    if (kind === "variant" && root && root.id === "damVizModal") {
      openVizAssocVariantsPicker(root, root._damVizAssocCtasOpts || {});
      return;
    }
    var col = btn.closest(".dam-media-preview__assoc-col");
    var ctx = resolvePickerCtx(root, col, kind);
    if (!col || !ctx) {
      toast("Brak kontekstu skojarzeń.");
      return;
    }
    openEditPicker(
      col,
      kind,
      Object.assign({}, ctx, {
        pickerMode: pickerMode,
        pickerId: pickerId || (kind === "product" ? "2" : kind === "material" ? "3" : ""),
      })
    );
  }

  function wireAssocEditButtons(scope, ctx, root) {
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll("[data-assoc-edit-all]").forEach(function (btn) {
      btn.hidden = !canEditAssoc();
    });
  }

  function mergeVizAssocCtasOpts(prev, next) {
    prev = prev || {};
    next = next || {};
    var merged = Object.assign({}, prev);
    Object.keys(next).forEach(function (key) {
      if (next[key] !== null && next[key] !== undefined) merged[key] = next[key];
    });
    return merged;
  }

  function bindVizAssocCtas(root, opts) {
    if (!root) return;
    root._damVizAssocCtasOpts = mergeVizAssocCtasOpts(root._damVizAssocCtasOpts, opts);
    wireAssocEditButtons(root, root._damAssocCtx, root);
    if (root._damVizAssocCtasBound) return;
    root._damVizAssocCtasBound = true;
    root.addEventListener("click", onAssocCtaClick);
  }

  function bindAssocCtas(root, ctx) {
    if (!root) return;
    root._damAssocCtx = ctx;
    wireAssocEditButtons(root, ctx, root);
    if (root._damAssocCtasBound) return;
    root._damAssocCtasBound = true;
    root.addEventListener("click", onAssocCtaClick);
  }

  /**
   * Publiczny bind Shift UX na panele materialow (viz + branding linked).
   * Wywolywac PO wstawieniu kart do DOM (async load).
   */
  function bindMaterialsPane(assocEl, ctx) {
    if (!assocEl || !ctx) return;
    ensureInjectedCss();
    var scopeEl = resolveAssocPaneScope(assocEl);
    var vizRoot = scopeEl.closest("#damVizModal") || assocEl.closest("#damVizModal");
    var prev =
      scopeEl._damMaterialsCtx ||
      assocEl._damMaterialsCtx ||
      (vizRoot && vizRoot._damMaterialsCtx) ||
      {};
    var merged = Object.assign({}, prev, ctx);
    var selMap = {};
    function addSel(id) {
      id = String(id || "").trim();
      if (id) selMap[id] = true;
    }
    (prev.selectedIds || []).forEach(addSel);
    (ctx.selectedIds || []).forEach(addSel);
    (merged.materialsList || merged.shownPrimaries || []).forEach(function (m) {
      if (m && m.id) addSel(m.id);
    });
    merged.selectedIds = Object.keys(selMap);
    if (!merged.onRefresh && prev.onRefresh) merged.onRefresh = prev.onRefresh;
    scopeEl._damMaterialsCtx = merged;
    scopeEl._damAssocCtx = merged;
    if (scopeEl !== assocEl) {
      assocEl._damMaterialsCtx = merged;
      assocEl._damAssocCtx = merged;
    }
    if (vizRoot) {
      vizRoot._damMaterialsCtx = merged;
      vizRoot._damAssocCtx = merged;
      bindVizAssocCtas(vizRoot, { materialsCtx: merged });
    }
    var mediaRoot =
      scopeEl.closest("#damMediaPreview") ||
      assocEl.closest("#damMediaPreview") ||
      document.getElementById("damMediaPreview");
    if (mediaRoot) {
      mediaRoot._damMaterialsCtx = merged;
      mediaRoot._damAssocCtx = merged;
      bindAssocCtas(mediaRoot, merged);
    }
    wireAssocEditButtons(scopeEl, merged, vizRoot || mediaRoot || scopeEl);
    ensureShiftHoverAssocUx(scopeEl, merged);
    if (vizRoot && vizRoot._damVizVariantsCtx) {
      var variantsHost =
        vizRoot.querySelector(".dam-viz-modal__product-variants") ||
        vizRoot.querySelector(".dam-media-preview__variant-grid--product");
      if (variantsHost) {
        ensureShiftHoverAssocUx(variantsHost, vizRoot._damVizVariantsCtx);
      }
    }
  }

  /**
   * P1: sync seed _damMaterialsCtx zaraz po open modala viz (przed async enrich).
   * bindMaterialsPane nadpisuje ctx po renderLinkedAssetsInto.
   */
  function seedMaterialsCtx(modal, opts) {
    if (!modal) return null;
    opts = opts || {};
    /* Akceptuj też surowy viz item (first) jako 2. argument — harness + call-site shorthand. */
    if (opts.product_id && !opts.productContext && !opts.first) {
      opts = { first: opts };
    }
    var pc = opts.productContext || {};
    var productId = String(pc.id || "").trim();
    if (!productId && opts.first) {
      var first = opts.first;
      productId = String(first.product_id || "").trim();
      pc = {
        id: productId,
        name: opts.productName || first.product_name || "",
        index: opts.index || first.index_base || "",
        revision_path: first.revision_path || "",
      };
    }
    if (!productId) return null;
    var persistedMatIds = [];
    if (global.DamViz && typeof global.DamViz.getLinkedMaterialIds === "function") {
      persistedMatIds = global.DamViz.getLinkedMaterialIds(productId);
    }
    var ctx = {
      asset: null,
      materialsList: [],
      shownPrimaries: [],
      selectedIds: persistedMatIds.slice(),
      materialCandidates: [],
      productContext: pc,
      groupContext: Object.assign(
        {
          product_id: productId,
          linked_product_ids: productId ? [productId] : [],
        },
        opts.groupContext || {}
      ),
      onRefresh: typeof opts.onRefresh === "function" ? opts.onRefresh : function () {},
    };
    modal._damMaterialsCtx = ctx;
    modal._damAssocCtx = ctx;
    var pane =
      modal.querySelector(".dam-media-preview__assoc-col--materials") ||
      modal.querySelector(".dam-viz-modal__assoc") ||
      modal.querySelector(".dam-viz-modal__assoc-pane");
    if (pane) {
      var paneScope = resolveAssocPaneScope(pane);
      paneScope._damMaterialsCtx = ctx;
      paneScope._damAssocCtx = ctx;
      if (paneScope !== pane) {
        pane._damMaterialsCtx = ctx;
        pane._damAssocCtx = ctx;
      }
    }
    return ctx;
  }

  function seedVariantPinnedIds(ctx) {
    if (!ctx || (ctx.variantPinnedIds && ctx.variantPinnedIds.length)) return;
    var gc = ctx.groupContext || {};
    var asset = ctx.asset || {};
    var pool = gc.variants || asset.folder_variants || asset.variants || [];
    if (!pool.length) return;
    ctx.variantPinnedIds = pool
      .map(function (v) {
        return v && v.id ? String(v.id) : "";
      })
      .filter(Boolean);
    if (!ctx.variantCandidates || !ctx.variantCandidates.length) {
      ctx.variantCandidates = pool.slice();
    }
  }

  function bindAssocSection(assocEl, ctx) {
    if (!assocEl || !ctx) return;
    ensureInjectedCss();
    seedVariantPinnedIds(ctx);
    assocEl._damAssocCtx = ctx;
    ensureShiftHoverAssocUx(assocEl, ctx);
    bindAssocCtas(assocEl, ctx);

    assocEl.querySelectorAll(".dam-media-preview__assoc-col").forEach(function (col) {
      col.addEventListener("click", function (e) {
        if (!e.shiftKey || !canEditAssoc()) return;
        if (e.target.closest("[data-assoc-edit-all]")) return;
        if (e.target.closest("[data-viz-assoc-cta]")) return;
        if (e.target.closest(".dam-assoc-quick-minus")) return;
        if (e.target.closest(".dam-media-preview__assoc-plus-tile")) return;
        var kind =
          col.classList.contains("dam-media-preview__assoc-col--products") ||
          col.classList.contains("dam-media-preview__assoc-col--product")
            ? "product"
            : "variant";
        e.preventDefault();
        e.stopPropagation();
        openEditPicker(col, kind, ctx);
      });
    });

    assocEl.querySelectorAll("[data-assoc-name]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          if (!canEditAssoc()) {
            toast("Włącz tryb admina, aby edytować skojarzenia.");
            return;
          }
          var col = btn.closest(".dam-media-preview__assoc-col");
          if (col) openEditPicker(col, "product", ctx);
          return;
        }
        var pid = btn.getAttribute("data-product-id") || "";
        ensureFileIndex().then(function (fi) {
          var p = (fi.products || []).find(function (x) {
            return x.id === pid;
          });
          openActionMenu(btn, p || { id: pid, display_name: btn.textContent.trim() });
        });
      });
    });

    assocEl.querySelectorAll("[data-assoc-thumb-go]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          if (!canEditAssoc()) {
            toast("Włącz tryb admina, aby edytować skojarzenia.");
            return;
          }
          var col = btn.closest(".dam-media-preview__assoc-col");
          if (col) openEditPicker(col, "product", ctx);
          return;
        }
        var pid = btn.getAttribute("data-product-id") || "";
        if (pid && navigateAssocProduct(pid)) return;
        if (pid) location.href = "explorer.html?product=" + encodeURIComponent(pid);
      });
    });

    assocEl.querySelectorAll(".dam-media-preview__assoc-item").forEach(function (item) {
      item.addEventListener("click", function (e) {
        if (!e.shiftKey || !canEditAssoc()) return;
        if (e.target.closest("[data-assoc-edit-all]")) return;
        if (e.target.closest("[data-viz-assoc-cta]")) return;
        if (e.target.closest(".dam-assoc-quick-minus")) return;
        e.preventDefault();
        e.stopPropagation();
        var col = item.closest(".dam-media-preview__assoc-col");
        if (col) {
          var kind = item.classList.contains("dam-media-preview__assoc-item--variant")
            ? "variant"
            : "product";
          openEditPicker(col, kind, ctx);
        }
      });
    });
  }

  function navigateAssocProduct(pid) {
    pid = String(pid || "").trim();
    if (!pid) return false;
    if (global.DamViz && typeof global.DamViz.openByProductId === "function") {
      return !!global.DamViz.openByProductId(pid);
    }
    return false;
  }

  loadAssocOverrides();

  global.DamAssocEdit = {
    canEdit: canEditAssoc,
    bind: bindAssocSection,
    loadAssocOverrides: loadAssocOverrides,
    applyAssetAssocOverrides: applyAssetAssocOverrides,
    effectiveLinkedProductIds: effectiveLinkedProductIds,
    /** Shift+/−/plus na panelu materialow (#damVizModalAssoc + branding linked). */
    bindMaterialsPane: bindMaterialsPane,
    /** P1: sync ctx przed async enrich (viz modal open). */
    seedMaterialsCtx: seedMaterialsCtx,
    /** Delegowany listener na CTA sugestie|warianty w #damVizModal. */
    bindVizAssocCtas: bindVizAssocCtas,
    bindAssocCtas: bindAssocCtas,
    openVizAssocSuggestionsPicker: openVizAssocSuggestionsPicker,
    openVizAssocVariantsPicker: openVizAssocVariantsPicker,
    openVizMaterialsEdit315: openVizMaterialsEdit315,
    ensureShiftHoverAssocUx: ensureShiftHoverAssocUx,
    resolveAssocPaneScope: resolveAssocPaneScope,
    /** Shift-minus on studio .all-file tiles (soft-hide picker; no disk delete). */
    wireStudioAllFiles: wireStudioAllFiles,
    enrichLinkedProducts: enrichLinkedProducts,
    enrichBrandingAssetsByIds: enrichBrandingAssetsByIds,
    expandPicksToAllProductRevisions: expandPicksToAllProductRevisions,
    revisionPickerLabel: revisionPickerLabel,
    dedupeProductIds: dedupeProductIds,
    dedupeLinkedProductRecords: dedupeLinkedProductRecords,
    productThumb: productThumb,
    latestProductIndexBase: latestProductIndexBase,
    navigateAssocProduct: navigateAssocProduct,
    openActionMenu: openActionMenu,
    closeActionMenu: closeActionMenu,
    closePicker: closePicker,
    /** Otwiera picker skojarzen (produkty/warianty); uzywane tez w QA/CDP gdy synthetic click nie odpala handlerow. */
    openPicker: openMediaPicker,
    /** Shift+edit na karcie materialu brandingowego (viz assoc / Elementy). */
    openEditPicker: openEditPicker,
    save: saveAssociations,
  };

  /* Defer CSS inject — sync inject during script eval blocks DamAssocEdit boot CDP. */
  setTimeout(function () {
    try {
      ensureInjectedCss();
    } catch (eCss) { /* ignore */ }
    try {
      flushPersistedAssocSaves();
    } catch (eFlush) { /* ignore */ }
  }, 0);
})(window);
