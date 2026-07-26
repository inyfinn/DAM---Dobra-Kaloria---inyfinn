/**
 * DAM - edycja skojarzen produktow / wariantow w podgladzie mediow (Shift+klik, admin).
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

  function isLegacyBrId(id) {
    return /^br-\d+$/i.test(String(id || "").trim());
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

  function brandingThumbUrl(entry) {
    if (!entry) return PLACEHOLDER_SVG;
    if (entry.thumb || entry.thumb_url) return entry.thumb || entry.thumb_url;
    var path = entry.path || "";
    if (path && global.DamMediaPreview && typeof global.DamMediaPreview.previewUrl === "function") {
      return global.DamMediaPreview.previewUrl(path, entry) || PLACEHOLDER_SVG;
    }
    return PLACEHOLDER_SVG;
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
     - productSearchForVariants → DamSearch (cold ensureFileIndex na viz = freeze przy open)
     GOLDEN kind=product NIGDY tu nie wchodzi. */
  function pickerSkipsWarmFileIndex(opts) {
    return !!(
      opts &&
      (opts.kind === "material" ||
        (opts.kind === "variant" && opts.brandingSearch) ||
        opts.productSearchForVariants)
    );
  }

  /**
   * Zbierz wiersze produktów do pickera z TWARDyn break (for, nie forEach).
   * forEach + `return` przy CAP NIE przerywa pętli → freeze UI na całym file-index.
   */
  function collectProductPickerRows(src, optsCollect) {
    optsCollect = optsCollect || {};
    var pinnedSet = optsCollect.pinnedSet || {};
    var excl = optsCollect.excl || { ids: {}, indexes: {} };
    var q = optsCollect.q || "";
    var filterType = optsCollect.filterType || "all";
    var cap = optsCollect.cap || PICKER_LIST_CAP;
    var asProductRow = !!optsCollect.asProductRow;
    var items = [];
    var seenIds = {};
    var seenIdx = {};
    var list = src || [];
    for (var i = 0; i < list.length; i++) {
      if (items.length >= cap) break;
      var p = list[i];
      if (!p || !p.id || pinnedSet[p.id]) continue;
      if (seenIds[p.id]) continue;
      if (productMatchesExclude(p, excl)) continue;
      if (filterType !== "all" && isVisualizationLike(p)) continue;
      var idxKey = normIndexKey(productIndexOf(p));
      if (idxKey && seenIdx[idxKey]) continue;
      if (q && productSearchBlob(p).indexOf(q) === -1) continue;
      seenIds[p.id] = true;
      if (idxKey) seenIdx[idxKey] = true;
      var rev0 = (p.revisions && p.revisions[0]) || {};
      var row = {
        id: p.id,
        label: p.display_name || p.name || p.id,
        thumb: productThumb(p),
        sub: productIndexOf(p) || p.id,
        path: p.path || "",
        brand: p.brand || "",
        category: p.category || "",
        subcategory: p.subcategory_label || "",
        langs: rev0.langs || [],
      };
      if (asProductRow) row.isProductRow = true;
      items.push(row);
      if (
        asProductRow &&
        optsCollect.expandedProductId === p.id &&
        p.revisions &&
        p.revisions.length
      ) {
        for (var ri = 0; ri < p.revisions.length; ri++) {
          if (items.length >= cap) break;
          var rev = p.revisions[ri];
          if (!rev || !rev.path) continue;
          var revKey = revisionPickerKey(p.id, rev.path);
          if (seenIds[revKey]) continue;
          seenIds[revKey] = true;
          var revIdx = String(rev.index || rev.index_base || productIndexOf(p) || "");
          if (revIdx.indexOf(".") > 0) revIdx = revIdx.split(".")[0];
          items.push({
            id: revKey,
            label:
              (rev.label || rev.name || "Wariant " + (ri + 1)) +
              (rev.langs && rev.langs.length ? " · " + rev.langs.join(", ").toUpperCase() : ""),
            thumb: productThumb(p),
            sub: revIdx,
            path: rev.path,
            brand: p.brand || "",
            category: p.category || "",
            subcategory: p.subcategory_label || "",
            langs: rev.langs || rev0.langs || [],
            isRevisionRow: true,
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
    var byId = {};
    ((global._DAM_FILE_INDEX && global._DAM_FILE_INDEX.products) || []).forEach(function (p) {
      if (p && p.id) byId[p.id] = p;
    });
    return byId;
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
   * Globalna deduplikacja skojarzonych produktow: po id + po indeksie bazowym
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
    if (ctx.asset && ctx.asset.variants) {
      ctx.asset.variants = gc.variants.slice();
    }
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
   * Seed UI + toast natychmiast; zapis bridge w tle (enrich). Rollback przy bledzie lub Cofnij.
   */
  function seedEnrichAssocSave(ctx, productIds, variantIds, undoCfg) {
    undoCfg = undoCfg || {};
    var undoHandle = null;
    if (global.DamDanger && typeof global.DamDanger.toastUndo === "function") {
      undoHandle = global.DamDanger.toastUndo(undoCfg);
    } else if (undoCfg.message) {
      toast(undoCfg.message);
    }
    return saveAssociations(ctx, productIds, variantIds, { silentToast: true }).then(function (res) {
      if (res && res.ok !== false) return res;
      if (typeof undoCfg.onUndo === "function") undoCfg.onUndo();
      if (undoHandle && typeof undoHandle.close === "function") undoHandle.close();
      return res;
    });
  }

  var ASSOC_CSS_ID = "damAssocEditInjectedCss";
  var ASSOC_CSS_TOKEN = "assocSearchNoFreeze20260726i";
  var PICKER_LIST_CAP = 80;
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

  /** Wstrzykuje style: Bento grid + pkt 36 podglad LEWA | lista PRAWA (nie ruszamy plikow agentow). */
  function ensureInjectedCss() {
    var style = document.getElementById(ASSOC_CSS_ID);
    if (style && style.getAttribute("data-token") === ASSOC_CSS_TOKEN && style.textContent) return;
    var css =
      /* Shell / bento grid popover — HARD: 70vw × 90vh (wszędzie: branding + viz) */
      ".dam-assoc-edit-overlay{overflow:hidden;}" +
      ".dam-assoc-edit-overlay #damAssocEditPopover.dam-thumb-picker-box," +
      ".dam-assoc-edit-overlay .dam-thumb-picker-box.dam-assoc-edit-popover{" +
      "display:grid!important;grid-template-columns:minmax(0,1fr);" +
      "grid-template-rows:auto auto auto minmax(0,1fr) auto;" +
      "grid-template-areas:'head' 'pinned' 'search' 'body' 'actions';" +
      "width:70vw!important;min-width:min(70vw,calc(100vw - 16px))!important;" +
      "max-width:min(70vw,calc(100vw - 16px))!important;" +
      "height:90vh!important;min-height:90vh!important;max-height:90vh!important;" +
      "overflow-x:hidden!important;overflow-y:hidden!important;}" +
      ".dam-assoc-edit-popover > .dam-thumb-picker__head{grid-area:head;min-height:53px;box-sizing:border-box;padding:10px 14px;" +
      "border-bottom:1px solid #ececf2;}" +
      ".dam-assoc-edit-overlay .dam-thumb-picker__head .dam-viz-modal-close{" +
      "position:static!important;top:auto!important;right:auto!important;" +
      "flex:0 0 auto;margin-left:8px;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__pinned-wrap{grid-area:pinned;min-width:0;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__section-sep{display:none;}" +
      ".dam-assoc-edit-popover > .dam-tag-edit-popover__search-wrap{grid-area:search;margin:0!important;" +
      "padding:10px 14px;border-bottom:1px solid #ececf2;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__body{grid-area:body;min-height:0;min-width:0;overflow:hidden;}" +
      ".dam-assoc-edit-popover > .dam-thumb-picker__footer{grid-area:actions;}" +
      /* Body: preview LEFT | list RIGHT (scroll w liscie) */
      ".dam-assoc-edit-popover__body{display:grid;grid-template-columns:minmax(180px,22%) minmax(0,1fr);gap:12px;" +
      "padding:12px 14px;min-height:0;overflow:hidden;}" +
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
      ".dam-assoc-edit-popover__preview-caption{font-size:12px;font-weight:600;color:#464255;line-height:1.3;" +
      "text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}" +
      ".dam-assoc-edit-popover__preview-meta{font-size:10px;font-weight:600;color:#8b8d97;text-align:center;" +
      "letter-spacing:.02em;font-variant-numeric:tabular-nums;}" +
      /* List: equal-height rows, no horizontal scroll */
      ".dam-assoc-edit-popover__body .dam-assoc-edit-popover__list," +
      ".dam-assoc-edit-popover__body .dam-tag-edit-popover__list{" +
      "min-width:0;max-height:none;height:100%;overflow-x:hidden!important;overflow-y:auto;" +
      "padding:0;display:flex;flex-direction:column;gap:4px;scrollbar-width:thin;}" +
      ".dam-assoc-edit-popover__opt-row{display:flex!important;flex-direction:row;align-items:stretch;" +
      "gap:4px;border-radius:10px;min-width:0;min-height:64px;width:100%;box-sizing:border-box;}" +
      ".dam-assoc-edit-popover__opt-row .dam-assoc-edit-popover__opt{flex:1 1 auto;min-width:0;}" +
      ".dam-assoc-edit-popover__opt{display:flex!important;flex-direction:row;align-items:center;gap:10px;" +
      "width:100%;min-height:64px;padding:8px 10px!important;border-radius:10px;box-sizing:border-box;}" +
      ".dam-assoc-edit-popover__thumb-wrap{flex:0 0 52px;width:52px;height:52px;border-radius:8px;" +
      "overflow:hidden;background:linear-gradient(180deg,#faf9fc 0%,#f3f1f7 100%);" +
      "border:1px solid #ececf1;display:flex;align-items:center;justify-content:center;}" +
      ".dam-assoc-edit-popover__check{flex:0 0 22px;}" +
      ".dam-assoc-edit-popover__thumb{width:100%!important;height:100%!important;max-width:100%;max-height:100%;" +
      "object-fit:contain;border-radius:0;background:transparent;border:none;}" +
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
      ".dam-assoc-edit-popover__row-btn{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;" +
      "border:1px solid #e7e7ec;border-radius:7px;background:#fff;color:#6b6b76;cursor:pointer;font-size:14px;" +
      "transition:background .12s ease,color .12s ease,border-color .12s ease;}" +
      ".dam-assoc-edit-popover__row-btn:hover{background:#f8f4fd;color:var(--dam-primary,#ab54db);border-color:#e2d3f2;}" +
      ".dam-assoc-edit-popover__opt-row--revision{margin-left:18px;opacity:.96;}" +
      ".dam-assoc-edit-popover__opt--product .dam-assoc-edit-popover__label{font-weight:500;}" +
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
      ".dam-assoc-edit-popover__opt.is-pinned:not(.is-selected) .dam-assoc-edit-popover__check{color:#e2506b;}" +
      ".dam-assoc-edit-popover__opt.is-pinned .dam-assoc-edit-popover__check{width:22px;font-size:17px;}" +
      ".dam-assoc-edit-popover__opt.is-preview-active{background:#f8f4fd!important;" +
      "box-shadow:inset 0 0 0 1px #e2d3f2;}" +
      ".dam-assoc-edit-popover__pinned{max-height:min(22dvh,160px);overflow-x:hidden;overflow-y:auto;}" +
      /* Shift-gated bubble minus (brandComposer20260721a / minusGlobal): ×0.8 (26→21) Geex chip;
         assoc-item + all-file quality tiles (studio show-all). NOT flat fat disc. */
      ".dam-media-preview__assoc-grid.is-shift-hover," +
      ".dam-media-preview__variant-grid.is-shift-hover," +
      ".dam-media-preview__all-files.is-shift-hover," +
      ".dam-media-preview__assoc-grid.is-shift-hover .dam-media-preview__assoc-item," +
      ".dam-media-preview__variant-grid.is-shift-hover .dam-media-preview__assoc-item{position:relative;}" +
      ".dam-media-preview__assoc-item," +
      ".dam-media-preview__all-file{position:relative;}" +
      ".dam-media-preview__assoc-item .dam-assoc-quick-minus," +
      ".dam-media-preview__all-file .dam-assoc-quick-minus{" +
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
      "font-size:12px!important;font-weight:500!important;line-height:1.2;" +
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

  /** Zbior id/indeksow zrodlowych - zakaz self-assoc / petli. */
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

  function productThumb(p) {
    if (!p) return PLACEHOLDER_SVG;
    var existing = p.thumb_url != null ? String(p.thumb_url).trim() : "";
    if (existing && existing.indexOf("data:image/svg+xml") !== 0) {
      if (/^(data:|blob:|https?:|\/|data\/)/i.test(existing) || existing.indexOf("thumbs/") >= 0) {
        return existing;
      }
    }
    var slug = String(p.id || "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96)
      .toLowerCase();
    if (!slug) return PLACEHOLDER_SVG;
    var idx = productIndexOf(p);
    if (!idx) {
      var rev = (p.revisions && p.revisions[0]) || {};
      if (rev.index) idx = String(rev.index).split(".")[0];
    }
    if (!idx) {
      /* Fallback: wizka z file-index.viz_latest (jak karty siatki). */
      var fi = global._DAM_FILE_INDEX;
      var latest = (fi && fi.viz_latest) || [];
      for (var i = 0; i < latest.length; i++) {
        var row = latest[i];
        if (row && row.product_id === p.id && row.thumb_url) return String(row.thumb_url);
      }
      return PLACEHOLDER_SVG;
    }
    var base = String(idx).replace(/[^0-9A-Za-z]+/g, "") || idx;
    return "data/thumbs/" + slug + "__" + base + "_pl.jpg";
  }

  function enrichLinkedProducts(list) {
    return ensureFileIndex().then(function (fi) {
      var byId = {};
      (fi && fi.products ? fi.products : []).forEach(function (p) {
        if (p && p.id) byId[p.id] = p;
      });
      var mapped = (list || []).map(function (lp) {
        var p = byId[lp.id] || lp;
        return {
          id: lp.id,
          display_name: lp.display_name || p.display_name || p.name || lp.id,
          thumb_url: lp.thumb_url || productThumb(p),
          product_index: lp.product_index || productIndexOf(p),
          path: p.path || lp.path || "",
          search_blob: p.search_blob || lp.search_blob || "",
          category: p.category || lp.category || "",
          subcategory_label: p.subcategory_label || p.subcategory || "",
          tags: p.tags || lp.tags || [],
          indexes: p.indexes || [],
          index_bases: p.index_bases || [],
          brand: p.brand || "",
        };
      });
      return dedupeLinkedProductRecords(mapped, byId);
    });
  }

  /* Pkt 9 brief 2026-07-20: powiekszony podglad miniatury ~400x400 nad popoverem */
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

  /* Pkt 36: staly panel podgladu po LEWEJ od listy wynikow */
  function setSearchPreview(pop, data) {
    if (!pop) return;
    var panel = pop.querySelector("#damAssocEditPreview");
    if (!panel) return;
    var img = panel.querySelector(".dam-assoc-edit-popover__preview-frame img");
    var empty = panel.querySelector(".dam-assoc-edit-popover__preview-empty");
    var cap = panel.querySelector(".dam-assoc-edit-popover__preview-caption");
    var meta = panel.querySelector(".dam-assoc-edit-popover__preview-meta");
    var src = (data && data.thumb) || "";
    if (src && src.indexOf("http://127.0.0.1") === 0) {
      /* normalize absolute → relative for same-origin thumbs */
      try {
        src = src.replace(/^https?:\/\/127\.0\.0\.1:\d+\//, "");
      } catch (e) {}
    }
    var label = (data && data.label) || "Najedź wynik, aby podejrzeć";
    var sub = (data && data.sub) || "";
    var emptyThumb = isPlaceholderThumb(src);
    if (img) {
      img.alt = label;
      img.classList.toggle("is-placeholder", emptyThumb);
      if (emptyThumb) {
        img.removeAttribute("src");
      } else {
        img.onerror = function () {
          img.onerror = null;
          img.classList.add("is-placeholder");
          img.removeAttribute("src");
          panel.classList.add("is-empty");
          if (empty) empty.style.display = "";
        };
        img.onload = function () {
          img.classList.remove("is-placeholder");
          panel.classList.remove("is-empty");
        };
        img.src = src;
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
        var labelEl = btn.querySelector(".dam-assoc-edit-popover__label");
        var idxBadge = btn.querySelector(".dam-viz-badge--index");
        var src = "";
        if (thumb) {
          src = thumb.getAttribute("src") || thumb.currentSrc || thumb.src || "";
        }
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
    ensureInjectedCss();
    function paintPicker(fi) {
      var products = (fi && fi.products) || [];
      var materialEntries = [];
      var productSearchHits = [];
      var pickerActiveTags = [];
      var pickerTagPage = 0;
      var listRenderToken = 0;
      var selected = {};
      var pinnedIds;
      var expandedProductId = null;
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
        '<div class="dam-tag-edit-popover__search-wrap">' +
        '<i class="uil uil-search" aria-hidden="true"></i>' +
        '<input type="text" id="damAssocEditSearch" class="dam-tag-edit-popover__search" placeholder="' +
        esc(searchPlaceholder) +
        '" autocomplete="off" />' +
        "</div>" +
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
        '<div class="dam-tag-edit-popover__list dam-assoc-edit-popover__list" role="listbox">';

      function lookupItem(id) {
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
              label: shortAssocLabel(rowM.label || rowM.name || rowM.title),
              thumb: rowM.thumb || brandingThumbUrl(rowM),
              sub: rowM.marketing_id || rowM.index || marketingIdForBranding(rowM) || "",
              path: rowM.path || "",
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
                label: shortAssocLabel(rowV.label || rowV.name),
                thumb: rowV.thumb || brandingThumbUrl(rowV),
                sub: rowV.marketing_id || rowV.index || marketingIdForBranding(rowV) || "",
                path: rowV.path || "",
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
              label: shortAssocLabel(rowCand.label || rowCand.name || v.name || v.label),
              thumb:
                rowCand.thumb ||
                v.thumb ||
                v.thumb_url ||
                brandingThumbUrl(rowCand) ||
                (v.path && global.DamMediaPreview ? global.DamMediaPreview.previewUrl(v.path, v) : ""),
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
            var pv =
              productSearchHits.find(function (x) {
                return x && x.id === id;
              }) ||
              products.find(function (x) {
                return x && x.id === id;
              });
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
              };
            }
          }
        } else {
          var p = products.find(function (x) {
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
        if (on) return '<i class="uil uil-check"></i>';
        if (pinned) return '<i class="uil uil-times" title="Kliknij, aby usunac skojarzenie"></i>';
        return "";
      }

      function rowActionsHtml(it) {
        var actions = "";
        if (it.path) {
          actions +=
            '<button type="button" class="dam-assoc-edit-popover__row-btn" data-row-folder data-path="' +
            esc(it.path) +
            '" title="Otworz folder" aria-label="Otworz folder"><i class="uil uil-folder"></i></button>';
        }
        if (opts.kind === "product") {
          actions +=
            '<button type="button" class="dam-assoc-edit-popover__row-btn" data-row-copy data-pid="' +
            esc(it.id) +
            '" title="Kopiuj link do produktu" aria-label="Kopiuj link"><i class="uil uil-link"></i></button>';
        }
        return actions ? '<span class="dam-assoc-edit-popover__row-actions">' + actions + "</span>" : "";
      }

      /* Pkt 9: wiersz tagow - marka, kategoria, podkategoria, jezyk, indeks (jak karty viz) */
      function optionTagsHtml(it) {
        var tags = [];
        function tag(v, cls, tip, copyVal) {
          if (!v) return;
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
        tag(it.brand, "dam-viz-badge--brand", "Marka");
        tag(stripCategoryPrefix(it.category), "dam-viz-badge--cat", "Kategoria");
        tag(it.subcategory, "dam-viz-badge--subcat", "Podkategoria");
        (it.langs || []).forEach(function (lg) {
          tag(String(lg).toUpperCase(), "dam-viz-badge--lang", "Język");
        });
        tag(it.sub, "dam-viz-badge--index", "Indeks (klik / prawy = kopiuj)", it.sub);
        if (!tags.length) return "";
        return '<span class="dam-assoc-edit-popover__tags">' + tags.join("") + "</span>";
      }

      function optionButtonHtml(it, pinned) {
        var on = !!selected[it.id];
        return (
          '<div class="dam-assoc-edit-popover__opt-row' +
          (it.isRevisionRow ? " dam-assoc-edit-popover__opt-row--revision" : "") +
          '">' +
          '<button type="button" class="dam-assoc-edit-popover__opt' +
          (on ? " is-selected" : "") +
          (pinned ? " is-pinned" : "") +
          (it.isRevisionRow ? " dam-assoc-edit-popover__opt--revision" : "") +
          (it.isProductRow ? " dam-assoc-edit-popover__opt--product" : "") +
          '" data-id="' +
          esc(it.id) +
          '">' +
          '<span class="dam-assoc-edit-popover__thumb-wrap">' +
          '<img class="dam-assoc-edit-popover__thumb" src="' +
          esc(it.thumb || PLACEHOLDER_SVG) +
          '" alt="" loading="lazy" onerror="this.src=\'' +
          PLACEHOLDER_SVG.replace(/'/g, "%27") +
          "'\">" +
          "</span>" +
          '<span class="dam-assoc-edit-popover__meta">' +
          '<span class="dam-assoc-edit-popover__label">' +
          esc(it.label) +
          "</span>" +
          optionTagsHtml(it) +
          "</span>" +
          '<span class="dam-assoc-edit-popover__check" aria-hidden="true">' +
          checkIconHtml(on, pinned) +
          "</span></button>" +
          rowActionsHtml(it) +
          "</div>"
        );
      }

      function bindOptionButtons(scope) {
        if (!scope) return;
        bindThumbZoom(scope);
        bindSearchPreview(pop, scope);
        scope.querySelectorAll(".dam-assoc-edit-popover__opt[data-id]").forEach(function (btn) {
          var id = btn.getAttribute("data-id");
          function toggle() {
            if (opts.productSearchForVariants && String(id).indexOf("rev:") !== 0) {
              expandedProductId = expandedProductId === id ? null : id;
              var sExpand = pop.querySelector("#damAssocEditSearch");
              renderOptions(sExpand ? sExpand.value : "");
              return;
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
            if (opts.productSearchForVariants) {
              var sRev = pop.querySelector("#damAssocEditSearch");
              renderOptions(sRev ? sRev.value : "");
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
            renderOptions(s ? s.value : "");
          }
          /* Pkt 27-29: odznaczenie AKTUALNEGO skojarzenia = akcja destrukcyjna ->
             hold-to-delete (ring). Dodawanie / ponowne zaznaczenie = zwykly klik. */
          var isRemove = btn.classList.contains("is-pinned") && !!selected[id];
          if (isRemove && global.DamDanger && typeof global.DamDanger.bind === "function") {
            global.DamDanger.bind(btn, {
              label: "Usun skojarzenie",
              hint: "Przytrzymaj 3 sekundy, aby usunac skojarzenie",
              holdMs: 3000,
              onConfirm: toggle,
            });
          } else {
            btn.addEventListener("click", function (e) {
              e.preventDefault();
              e.stopPropagation();
              toggle();
            });
          }
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
      }

      function activatePreviewFromBtn(btn) {
        if (!btn) return;
        var thumb = btn.querySelector(".dam-assoc-edit-popover__thumb");
        var labelEl = btn.querySelector(".dam-assoc-edit-popover__label");
        var idxBadge = btn.querySelector(".dam-viz-badge--index");
        var src = thumb ? thumb.getAttribute("src") || thumb.currentSrc || thumb.src : "";
        setSearchPreview(pop, {
          thumb: src,
          label: labelEl ? labelEl.textContent : btn.getAttribute("data-id") || "",
          sub: idxBadge ? idxBadge.textContent : "",
          btn: btn,
        });
      }

      function renderPinned() {
        var pinnedEl = pop.querySelector(".dam-assoc-edit-popover__pinned");
        if (!pinnedEl) return;
        if (!pinnedIds.length) {
          pinnedEl.innerHTML = '<p class="dam-tag-edit-popover__empty">Brak aktualnych skojarzen.</p>';
          setSearchPreview(pop, null);
          return;
        }
        pinnedEl.innerHTML = pinnedIds
          .map(function (id) {
            return optionButtonHtml(lookupItem(id), true);
          })
          .join("");
        bindOptionButtons(pinnedEl);
        /* Podglad: pierwsza przypieta miniatura (nie "Brak miniatury" przy otwarciu). */
        activatePreviewFromBtn(pinnedEl.querySelector(".dam-assoc-edit-popover__opt[data-id]"));
      }

      function showListMessage(msg) {
        var listEl = pop.querySelector(".dam-assoc-edit-popover__list");
        if (!listEl) return;
        listEl.innerHTML = '<p class="dam-tag-edit-popover__empty">' + esc(msg) + "</p>";
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
        var q = String(filter || "")
          .toLowerCase()
          .trim();
        var listEl = pop.querySelector(".dam-assoc-edit-popover__list");
        if (!listEl) return;
        var minQ = 0;
        /* Viz-warianty / wariant-pool: min 2 znaki. GOLDEN product: minQ=0 (browse pierwsze CAP). */
        if (opts.productSearchForVariants) {
          minQ = 2;
        } else if (opts.kind === "variant" && !opts.productSearchForVariants && !opts.brandingSearch) {
          minQ = 2;
        } else if (opts.kind === "material" && !materialEntries.length) {
          minQ = 2;
        } else if (opts.kind === "variant" && opts.brandingSearch && !materialEntries.length) {
          minQ = 2;
        }
        if (minQ && q.length < minQ) {
          listEl.innerHTML =
            '<p class="dam-tag-edit-popover__empty">Wpisz co najmniej ' +
            minQ +
            " znaki, aby przeszukać indeks…</p>";
          var pinnedKeep0 = pop.querySelector(
            ".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]"
          );
          if (pinnedKeep0) activatePreviewFromBtn(pinnedKeep0);
          else setSearchPreview(pop, null);
          return;
        }
        var excl = buildAssocExclude(opts);
        var seenIds = {};
        var seenIdx = {};
        var items = [];
        if (opts.kind === "variant" && opts.productSearchForVariants) {
          /* TYLKO DamSearch hits — NIGDY fallback na pełne products[] (to zacinało UI). */
          items = collectProductPickerRows(productSearchHits, {
            pinnedSet: pinnedSet,
            excl: excl,
            q: "",
            filterType: opts.filterType || "product",
            cap: PICKER_LIST_CAP,
            asProductRow: true,
            expandedProductId: expandedProductId,
          });
        } else if (opts.kind === "variant" && opts.brandingSearch) {
          (materialEntries.length ? materialEntries : []).forEach(function (material) {
            if (items.length >= PICKER_LIST_CAP) return;
            if (!material || !material.id || pinnedSet[material.id] || seenIds[material.id]) {
              return;
            }
            var row = brandingEntryToPickerRow(material) || material;
            if (!materialMatchesPickerTags(row, pickerActiveTags)) return;
              var blob = (
                (row.label || row.name || "") +
                " " +
                (row.id || "") +
                " " +
                (row.marketing_id || row.index || "") +
                " " +
                (row.search_blob || "")
              ).toLowerCase();
              if (q && blob.indexOf(q) === -1) return;
              seenIds[row.id] = true;
              items.push({
                id: row.id,
                label: shortAssocLabel(row.label || row.name),
                thumb: row.thumb || brandingThumbUrl(row),
                sub: row.marketing_id || row.index || marketingIdForBranding(row) || "",
                path: row.path || "",
              });
          });
        } else if (opts.kind === "variant") {
          (opts.variantCandidates || []).forEach(function (v) {
            if (!v || !v.id || pinnedSet[v.id]) return;
            if (seenIds[v.id]) return;
            if (excl.ids[String(v.id)]) return;
            var vIdx = normIndexKey(v.index || v.id);
            if (vIdx && excl.indexes[vIdx]) return;
            if (vIdx && seenIdx[vIdx]) return;
            var blob = ((v.name || v.label || "") + " " + (v.id || "") + " " + (v.index || "")).toLowerCase();
            if (q && blob.indexOf(q) === -1) return;
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
          });
        } else if (opts.kind === "material") {
          (materialEntries.length ? materialEntries : opts.materialCandidates || []).forEach(
            function (material) {
            if (items.length >= PICKER_LIST_CAP) return;
            if (!material || !material.id || pinnedSet[material.id] || seenIds[material.id]) {
              return;
            }
            var row = brandingEntryToPickerRow(material) || material;
            if (!materialMatchesPickerTags(row, pickerActiveTags)) return;
            var blob = (
              (row.label || row.name || "") +
              " " +
              (row.id || "") +
              " " +
              (row.marketing_id || row.index || "") +
              " " +
              (row.search_blob || "")
            ).toLowerCase();
            if (q && blob.indexOf(q) === -1) return;
            seenIds[row.id] = true;
            items.push({
              id: row.id,
              label: shortAssocLabel(row.label || row.name),
              thumb: row.thumb || brandingThumbUrl(row),
              sub: row.marketing_id || row.index || marketingIdForBranding(row) || "",
              path: row.path || "",
            });
          });
        } else if (opts.kind === "product") {
          /* GOLDEN: browse (q<2) = lokalny for+break; filtr (q>=2) = tylko DamSearch hits
             (jak #damFileSearch) — pełny scan products[] przy rzadkim q zacinał UI. */
          if (q.length >= 2) {
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
              q: "",
              filterType: opts.filterType || "product",
              cap: PICKER_LIST_CAP,
              asProductRow: false,
            });
          }
        }
        items = items.slice(0, PICKER_LIST_CAP);
        if (!items.length) {
          listEl.innerHTML = q
            ? '<p class="dam-tag-edit-popover__empty">Brak wyników dla tego wyszukiwania.</p>'
            : '<p class="dam-tag-edit-popover__empty">Wpisz frazę, aby zawęzić listę…</p>';
          var pinnedKeep = pop.querySelector(
            ".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]"
          );
          if (pinnedKeep) activatePreviewFromBtn(pinnedKeep);
          else setSearchPreview(pop, null);
          return;
        }
        listEl.innerHTML = items.map(function (it) {
          return optionButtonHtml(it, false);
        }).join("");
        bindOptionButtons(listEl);
        /* Preferuj podglad z AKTUALNYCH (pinned), nie z pierwszego wyniku wyszukiwania. */
        var pinnedBtn = pop.querySelector(
          ".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]"
        );
        if (pinnedBtn) {
          activatePreviewFromBtn(pinnedBtn);
        } else {
          var firstBtn = listEl.querySelector(".dam-assoc-edit-popover__opt[data-id]");
          if (firstBtn) activatePreviewFromBtn(firstBtn);
        }
      }

      var footerComboTip =
        opts.kind === "material" || opts.brandingSearch
          ? "Eksplorator COMBO — wybierz plik materiału brandingowego"
          : opts.kind === "variant"
            ? "Eksplorator COMBO — wybierz folder wariantu / produktu"
            : "Eksplorator COMBO — wybierz folder produktu (pliki wyszarzone)";
      html +=
        "</div></div>" +
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
      var productFetchTimer = null;

      /* API jak lekki odpowiednik #damBrandingSearch — material + brandingSearch warianty. */
      function scheduleMaterialSearchFetch(q) {
        if (!pickerUsesBrandingApi(opts)) return;
        clearTimeout(materialFetchTimer);
        var query = String(q || "").trim();
        if (query.length < 2) return;
        showListMessage("Szukam materiałów…");
        materialFetchTimer = setTimeout(function () {
          if (!pickerStillOpen()) return;
          loadBrandingMaterialCandidates(
            Object.assign({}, opts, { bootstrapQuery: query })
          ).then(function (entries) {
            if (!pickerStillOpen()) return;
            if (entries && entries.length) {
              materialEntries = entries.slice(0, PICKER_LIST_CAP);
            }
            renderPinned();
            renderOptionsDebounced(search ? search.value : query);
          });
        }, 220);
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
        showListMessage("Szukam produktów…");
        productFetchTimer = setTimeout(function () {
          if (!pickerStillOpen()) return;
          var searchFn = global.DamSearch && global.DamSearch.search;
          if (!searchFn) {
            showListMessage("Brak wyszukiwarki produktów — odśwież stronę.");
            return;
          }
          searchFn(query, { includeArchive: false })
            .then(function (res) {
              if (!pickerStillOpen()) return;
              var ids = ((res && res.products) || []).slice(0, PICKER_LIST_CAP);
              productSearchHits = ids
                .map(function (id) {
                  return global.DamSearch.productById(id);
                })
                .filter(Boolean);
              renderOptionsDebounced(query);
            })
            .catch(function () {
              if (!pickerStillOpen()) return;
              productSearchHits = [];
              showListMessage("Błąd wyszukiwania produktów.");
            });
        }, 220);
      }

      if (search) {
        /* Bez autofocus — WebView2 freeze (code-doctrine §12).
           q>=2 na product / viz-warianty → TYLKO DamSearch (globalny silnik). */
        search.addEventListener("input", function () {
          var raw = search.value;
          var qq = String(raw || "").trim();
          if ((opts.productSearchForVariants || opts.kind === "product") && qq.length >= 2) {
            scheduleProductSearchFetch(raw);
            return;
          }
          if (opts.productSearchForVariants && qq.length < 2) {
            productSearchHits = [];
            showListMessage("Wpisz co najmniej 2 znaki (indeks / nazwa produktu)…");
            return;
          }
          if (pickerUsesBrandingApi(opts) && qq.length >= 2) {
            scheduleMaterialSearchFetch(raw);
            return;
          }
          renderOptionsDebounced(raw);
          scheduleMaterialSearchFetch(raw);
        });
      }

      function pickerStillOpen() {
        return document.getElementById("damAssocEditPopover") === pop;
      }

      materialEntries = (opts.materialCandidates || []).slice();
      renderPinned();
      /* Init jak 5fb3493 — golden product → renderOptionsDebounced(""); brandingSearch → fetch seed. */
      if (opts.kind === "material") {
        if (opts.bootstrapQuery) {
          loadBrandingMaterialCandidates(opts).then(function (entries) {
            if (!pickerStillOpen()) return;
            if (entries && entries.length) {
              materialEntries = entries.slice(0, PICKER_LIST_CAP);
            }
            renderPinned();
            renderOptionsDebounced(search ? search.value : "");
          });
        } else if (materialEntries.length) {
          renderOptionsDebounced("");
        }
      } else if (opts.kind === "variant" && opts.brandingSearch) {
        loadBrandingMaterialCandidates(opts).then(function (entries) {
          if (!pickerStillOpen()) return;
          if (entries && entries.length) {
            materialEntries = entries.slice(0, PICKER_LIST_CAP);
          }
          renderPinned();
          renderOptionsDebounced(search ? search.value : "");
        });
      } else if (opts.kind === "variant" && opts.productSearchForVariants) {
        renderOptionsDebounced("");
      } else if (opts.kind === "variant") {
        if ((opts.variantCandidates || []).length <= 40) renderOptionsDebounced("");
      } else {
        /* GOLDEN: kind=product */
        renderOptionsDebounced("");
      }
      activatePreviewFromBtn(
        pop.querySelector(".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]")
      );

      pop._damAssocRebindChrome = function () {
        var closeBtn = pop.querySelector("[data-close]");
        if (closeBtn) closeBtn.onclick = closePicker;
        var cancelEl = pop.querySelector("[data-cancel]");
        if (cancelEl) cancelEl.onclick = closePicker;
        var confirmEl = pop.querySelector("[data-confirm]");
        if (confirmEl) {
          confirmEl.onclick = function () {
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
            if (opts.brandingSearch && opts.kind === "variant") {
              ids = filterBrandingVariantIdsForPrimary(
                opts.asset || {},
                ids,
                brandingPathById(materialEntries)
              );
            }
            if (typeof opts.onConfirmVariants === "function") {
              var picks = ids.map(parseRevisionPickerKey).filter(Boolean);
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
      pop._damAssocRebindChrome();
    }
    /* Wszystkie kind (product|variant|material): ten sam async gate co „Dodaj/Edytuj produkty”. */
    function schedulePaintPicker(fi) {
      setTimeout(function () {
        paintPicker(fi || { products: [] });
      }, 0);
    }
    if (
      global._DAM_FILE_INDEX &&
      global._DAM_FILE_INDEX.products &&
      global._DAM_FILE_INDEX.products.length &&
      !pickerSkipsWarmFileIndex(opts)
    ) {
      schedulePaintPicker(global._DAM_FILE_INDEX);
      return;
    }
    if (pickerSkipsWarmFileIndex(opts)) {
      schedulePaintPicker({ products: [] });
      return;
    }
    ensureFileIndex().then(function (fi) {
      schedulePaintPicker(fi);
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

  function loadBrandingMaterialCandidates(opts) {
    opts = opts || {};
    var include = (opts.selectedIds || opts.pinnedIds || []).slice(0, 40).join(",");
    var url =
      bridgeUrl() +
      "/branding-search-picker?q=" +
      encodeURIComponent(String(opts.bootstrapQuery || "").trim()) +
      "&limit=120" +
      (include ? "&include=" + encodeURIComponent(include) : "");
    return fetch(url, { headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        return ((data && (data.entries || data.items || data.results)) || [])
          .map(function (entry) {
            if (!entry) return null;
            if (entry.thumb_url && String(entry.thumb_url).indexOf("/media?") === 0) {
              entry = Object.assign({}, entry, { thumb_url: bridgeUrl() + entry.thumb_url });
            }
            var row = brandingEntryToPickerRow(entry);
            if (!row) return null;
            row.linked_product_ids = entry.linked_product_ids || [];
            row.linked_variant_ids = entry.linked_variant_ids || [];
            row.folder_group_id = entry.folder_group_id || "";
            return row;
          })
          .filter(function (entry) {
            return entry && entry.id;
          });
      })
      .catch(function () {
        return (opts.materialCandidates || []).slice();
      });
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

  function saveAssociations(ctx, productIds, variantIds, opts) {
    opts = opts || {};
    if (!ctx || !ctx.asset || !ctx.asset.id) {
      toast("Brak kontekstu materiału do zapisu skojarzeń.");
      return Promise.resolve({ ok: false, error: "missing_asset_ctx" });
    }
    if (productIds && productIds.length) {
      productIds = dedupeProductIds(
        productIds,
        productsByIdFromCache(),
        linkedMetaByIdFromCtx(ctx)
      );
    }
    return ensureBridgeSession()
      .then(function () {
        return fetch(bridgeUrl() + "/branding/asset-associations", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            asset_id: ctx.asset.id,
            folder_group_id: (ctx.groupContext && ctx.groupContext.folder_group_id) || "",
            linked_product_ids: productIds || [],
            linked_variant_ids: variantIds || [],
          }),
        });
      })
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
        /* Pomin "Zapisano" gdy zaraz leci toastUndo (pkt 32 - bez podwojnego toasta). */
        if (!opts.silentToast) toast("Zapisano skojarzenia");
        if (global.DamBranding && typeof global.DamBranding.clearComputeCache === "function") {
          global.DamBranding.clearComputeCache();
        }
        if (typeof ctx.onSaved === "function") ctx.onSaved(productIds, variantIds);
        return res;
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
    (asset.linked_products || []).forEach(function (p) {
      if (p && p.id) add(p.id);
    });
    (asset.linked_product_ids || []).forEach(add);
    (asset.folder_linked_product_ids || []).forEach(add);
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
    var selectedIds = collectLinkedIdsFromCtx(ctx, kind);
    var excludeIds = [];
    var excludeIndexes = [];
    var gc = ctx.groupContext = ctx.groupContext || {};
    var asset = ctx.asset || {};
    if (kind === "product") {
      var rawIds = (asset.linked_product_ids || asset.folder_linked_product_ids || []).slice();
      if (rawIds.length > selectedIds.length) {
        gc.linked_product_ids = selectedIds.slice();
        patchLinkedProductsWithFolderPick(ctx, selectedIds, null);
        var prevVids = collectLinkedIdsFromCtx(ctx, "variant");
        saveAssociations(ctx, selectedIds, prevVids, { silentToast: true }).then(function () {
          if (typeof ctx.onRefresh === "function") ctx.onRefresh();
        });
        toast("Usunięto duplikaty indeksu ze skojarzeń");
      }
    }
    if (gc.product_id) excludeIds.push(gc.product_id);
    if (gc.source_product_id) excludeIds.push(gc.source_product_id);
    if (gc.product_index) excludeIndexes.push(gc.product_index);
    if (gc.index) excludeIndexes.push(gc.index);
    if (ctx.asset && ctx.asset.product_id) excludeIds.push(ctx.asset.product_id);
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
        (ctx.productContext && ctx.productContext.id) || gc.product_id || ""
      ).trim();
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
      /* 5fb3493 bootstrap + fallback indeksu gdy brak materials (pusty stan nie crashuje). */
      var bootstrapQuery = "";
      if (ctx.productContext) {
        bootstrapQuery =
          ctx.productContext.index ||
          ctx.productContext.display_name ||
          ctx.productContext.name ||
          "";
      }
      if (!String(bootstrapQuery || "").trim()) {
        bootstrapQuery = pickerBootstrapQueryFromCtx(ctx);
      }
      var prevMatIds = selectedIds.slice();
      var matPickerOpts = {
        kind: "material",
        head: "Skojarzone materiały brandingowe",
        selectedIds: selectedIds,
        pinnedIds: selectedIds.slice(),
        materialCandidates: materialCandidates,
        bootstrapQuery: bootstrapQuery,
        productContext: ctx.productContext,
        groupContext: gc,
        assocCtx: ctx,
        onConfirm: function (ids) {
          saveProductMaterialSuggestions(productId, ids, prevMatIds).then(function (res) {
            if (res && res.ok && typeof ctx.onRefresh === "function") ctx.onRefresh();
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
        head: isVizProductPick
          ? "Warianty produktu — wybierz rewizję (folder)"
          : "Warianty materiału",
        productSearchForVariants: isVizProductPick,
        brandingSearch: isBrandingMat,
        /* bootstrapQuery jak 5fb3493 — marketing_id/index assetu, nie agresywny pickerBootstrapQueryFromCtx */
        bootstrapQuery: isBrandingMat
          ? String(
              (asset && (asset.marketing_id || asset.index || asset.name)) ||
                (gc && gc.index) ||
                ""
            ).trim()
          : "",
        filterType: isVizProductPick ? "product" : filterType,
        selectedIds: isVizProductPick ? [] : selectedIds,
        pinnedIds: selectedIds.slice(),
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
          var prevPids = (gc.linked_products || [])
            .map(function (p) {
              return p && p.id;
            })
            .filter(Boolean);
          saveAssociations(ctx, prevPids, ids || [], { silentToast: false }).then(function () {
            if (typeof ctx.onRefresh === "function") ctx.onRefresh();
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
        var prevPids = (gc.linked_products || [])
          .map(function (p) {
            return p && p.id;
          })
          .filter(Boolean);
        var prevVids = (gc.variants || [])
          .map(function (v) {
            return v && v.id;
          })
          .filter(Boolean);
        var pids = kind === "product" ? ids : prevPids;
        var vids = kind === "variant" ? ids : prevVids;

        if (kind === "product") {
          pids = dedupeProductIds(pids, productsByIdFromCache(), linkedMetaByIdFromCtx(ctx));
        }

        if (kind === "product" && ctx.lastFolderPick) {
          patchLinkedProductsWithFolderPick(ctx, pids, ctx.lastFolderPick);
          if (typeof ctx.onRefresh === "function") ctx.onRefresh();
        }

        /* Pkt 32: cooldown / soft-delete. Jesli zapis USUWA skojarzenia,
           daj okno "Cofnij" (~7 s) przywracajace poprzedni stan. */
        var prevForKind = kind === "product" ? prevPids : prevVids;
        var nextForKind = ids || [];
        var removed = prevForKind.filter(function (x) {
          return nextForKind.indexOf(x) === -1;
        });

        saveAssociations(ctx, pids, vids, { silentToast: removed.length > 0 }).then(function () {
          ctx.lastFolderPick = null;
          if (typeof ctx.onRefresh === "function") ctx.onRefresh();
          if (removed.length && global.DamDanger && typeof global.DamDanger.toastUndo === "function") {
            global.DamDanger.toastUndo({
              message:
                removed.length === 1
                  ? "Usunieto 1 skojarzenie"
                  : "Usunieto skojarzenia: " + removed.length,
              actionLabel: "Cofnij",
              duration: 8000,
              onUndo: function () {
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
      message: "Usunieto 1 skojarzenie",
      actionLabel: "Cofnij",
      duration: 8000,
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
      message: "Usunieto 1 wariant",
      actionLabel: "Cofnij",
      duration: 8000,
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
        duration: 8000,
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
   * Shift+hover UX — JEDNA sciezka globalna:
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
      message: "Usunieto 1 skojarzenie",
      actionLabel: "Cofnij",
      duration: 8000,
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

  function openVizMaterialsEdit315(anchorBtn, modalRoot) {
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    modalRoot =
      modalRoot ||
      (anchorBtn && anchorBtn.closest("#damVizModal")) ||
      document.getElementById("damVizModal");
    var col =
      (anchorBtn && anchorBtn.closest(".dam-media-preview__assoc-col")) ||
      (modalRoot && modalRoot.querySelector(".dam-media-preview__assoc-col--materials"));
    var ctx = resolveMaterialsCtx(modalRoot, col);
    if (!col || !ctx) {
      toast("Brak kontekstu materiałów.");
      return;
    }
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
    var kind = btn.getAttribute("data-viz-assoc-cta") || btn.getAttribute("data-assoc-edit-all") || "product";
    if (kind === "suggestions") kind = "material";
    if (kind === "variants") kind = "variant";
    /* product: golden path — bez zmian (openEditPicker → ensureFileIndex async). */
    var col = btn.closest(".dam-media-preview__assoc-col");
    var ctx = resolvePickerCtx(root, col, kind);
    if (!col || !ctx) {
      toast(kind === "material" ? "Brak kontekstu materiałów." : "Brak kontekstu skojarzeń.");
      return;
    }
    openEditPicker(col, kind, ctx);
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
    assocEl._damMaterialsCtx = ctx;
    assocEl._damAssocCtx = ctx;
    var vizRoot = assocEl.closest("#damVizModal");
    if (vizRoot) {
      vizRoot._damMaterialsCtx = ctx;
      vizRoot._damAssocCtx = ctx;
      bindVizAssocCtas(vizRoot, { materialsCtx: ctx });
    }
    wireAssocEditButtons(assocEl, ctx, vizRoot || assocEl);
    ensureShiftHoverAssocUx(assocEl, ctx);
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
    var ctx = {
      asset: null,
      materialsList: [],
      shownPrimaries: [],
      selectedIds: [],
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
      pane._damMaterialsCtx = ctx;
      pane._damAssocCtx = ctx;
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

  global.DamAssocEdit = {
    canEdit: canEditAssoc,
    bind: bindAssocSection,
    /** Shift+/−/plus na panelu materialow (#damVizModalAssoc + branding linked). */
    bindMaterialsPane: bindMaterialsPane,
    /** P1: sync ctx przed async enrich (viz modal open). */
    seedMaterialsCtx: seedMaterialsCtx,
    /** Delegowany listener na CTA sugestie|warianty w #damVizModal. */
    bindVizAssocCtas: bindVizAssocCtas,
    openVizAssocSuggestionsPicker: openVizAssocSuggestionsPicker,
    openVizAssocVariantsPicker: openVizAssocVariantsPicker,
    openVizMaterialsEdit315: openVizMaterialsEdit315,
    ensureShiftHoverAssocUx: ensureShiftHoverAssocUx,
    /** Shift-minus on studio .all-file tiles (soft-hide picker; no disk delete). */
    wireStudioAllFiles: wireStudioAllFiles,
    enrichLinkedProducts: enrichLinkedProducts,
    dedupeProductIds: dedupeProductIds,
    dedupeLinkedProductRecords: dedupeLinkedProductRecords,
    productThumb: productThumb,
    openActionMenu: openActionMenu,
    closeActionMenu: closeActionMenu,
    closePicker: closePicker,
    /** Otwiera picker skojarzen (produkty/warianty); uzywane tez w QA/CDP gdy synthetic click nie odpala handlerow. */
    openPicker: openMediaPicker,
    /** Shift+edit na karcie materialu brandingowego (viz assoc / Elementy). */
    openEditPicker: openEditPicker,
    save: saveAssociations,
  };

  /* Anti-FOUC and bounded click path: prepare styles once at module load. */
  if (document.head) ensureInjectedCss();
  else {
    document.addEventListener("DOMContentLoaded", function () {
      ensureInjectedCss();
    });
  }
})(window);
