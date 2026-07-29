/**
 * DAM - globalna korelacja produkt <-> branding / indeks / materiały.
 * Jedno źródło prawdy dla dopasowania assetów i deep-linków.
 */
(function (global) {
  "use strict";

  var searchIndex = null;
  var searchLoading = null;
  var brandingCounts = null;
  var brandingCountsLoading = null;
  var CB = Date.now();

  function digitsOnly(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function normTag(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/ą/g, "a")
      .replace(/ć/g, "c")
      .replace(/ę/g, "e")
      .replace(/ł/g, "l")
      .replace(/ń/g, "n")
      .replace(/ó/g, "o")
      .replace(/ś/g, "s")
      .replace(/ź|ż/g, "z")
      .trim();
  }

  function unique(arr) {
    var out = [];
    (arr || []).forEach(function (x) {
      if (x && out.indexOf(x) === -1) out.push(x);
    });
    return out;
  }

  function productIndexTokens(p) {
    var out = [];
    function add(v) {
      v = String(v || "").trim();
      if (!v) return;
      if (out.indexOf(v) === -1) out.push(v);
      var base = v.split(".")[0];
      if (base && out.indexOf(base) === -1) out.push(base);
      if (/^\d/.test(base)) {
        var d = digitsOnly(base);
        if (d.length >= 7 && out.indexOf(d.slice(0, 7)) === -1) out.push(d.slice(0, 7));
      }
    }
    if (!p) return out;
    if (typeof p === "string") {
      add(p);
      return out;
    }
    add(p.product_index);
    add(p.id);
    (p.indexes || []).forEach(add);
    var id = String(p.id || "");
    if (id.length >= 8) {
      var parts = id.split("-");
      if (parts.length > 2) add(parts.slice(0, -1).join("-"));
    }
    var dn = String(p.display_name || p.title || p.name || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    if (dn.length >= 8) add(dn);
    return out;
  }

  function isArchivedBranding(a) {
    if (!a) return false;
    if ((a.tags || []).indexOf("ARCHIWUM") !== -1 || a.is_archive) return true;
    return String(a.path || "").toUpperCase().indexOf("ARCHIWUM") !== -1;
  }

  function brandingAssetMatches(a, productId, tokens) {
    if (!a) return false;
    var ids = (a.linked_product_ids || []).concat(a.product_ids || []);
    if (productId && ids.indexOf(productId) !== -1) return true;
    if (a.sku) {
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (!t) continue;
        if (a.sku === t || a.sku.indexOf(t) === 0 || t.indexOf(a.sku) === 0) return true;
      }
    }
    var hay = ((a.path || "") + " " + (a.name || "") + " " + (a.search_blob || "")).toLowerCase();
    for (var j = 0; j < tokens.length; j++) {
      var tok = String(tokens[j] || "").toLowerCase();
      if (tok.length >= 6 && hay.indexOf(tok) !== -1) return true;
      var td = digitsOnly(tok);
      if (td.length >= 6 && hay.indexOf(td) !== -1) return true;
    }
    return false;
  }

  function filterBrandingAssets(assets, productId, tokens, opts) {
    opts = opts || {};
    return (assets || []).filter(function (a) {
      if (!opts.includeArchive && isArchivedBranding(a)) return false;
      return brandingAssetMatches(a, productId, tokens);
    });
  }

  function brandingPickerBlocksIndexLoad() {
    return !!(
      (typeof global !== "undefined" && global.__damBrandingPickerOpen) ||
      (typeof global !== "undefined" && global.__damAssocPickerOpening)
    );
  }

  function ensureSearchIndex() {
    if (searchIndex) return Promise.resolve(searchIndex);
    if (global._DAM_SEARCH_INDEX && global._DAM_SEARCH_INDEX.entries) {
      searchIndex = global._DAM_SEARCH_INDEX;
      return Promise.resolve(searchIndex);
    }
    /*
     * HARD freeze fix (2026-07-24c): NEVER DamSearch.loadIndexes() here.
     * It pulls ~8MB file-index; Worker postMessage clone blocks main thread
     * when user opens Shift+Dodaj on Branding preview (ESC/F5 dead).
     * Dedicated search-index fetch + deferred JSON.parse only.
     */
    if (searchLoading) return searchLoading;
    searchLoading = new Promise(function (resolve) {
      function attemptLoad() {
        if (brandingPickerBlocksIndexLoad()) {
          setTimeout(attemptLoad, 200);
          return;
        }
        fetch("data/search-index.json?v=corrFreeze20260724c&_=" + Date.now())
          .then(function (r) {
            if (!r.ok) throw new Error("search-index.json");
            return r.text();
          })
          .then(function (text) {
            return new Promise(function (res, rej) {
              setTimeout(function () {
                try {
                  res(JSON.parse(text));
                } catch (eParse) {
                  rej(eParse);
                }
              }, 0);
            });
          })
          .then(function (data) {
            searchIndex = data;
            global._DAM_SEARCH_INDEX = data;
            searchLoading = null;
            resolve(searchIndex);
          })
          .catch(function () {
            searchIndex = { by_base: {}, by_prefix: {}, entries: [] };
            searchLoading = null;
            resolve(searchIndex);
          });
      }
      attemptLoad();
    });
    return searchLoading;
  }

  function resolveProductIdsFromQuery(q) {
    var query = String(q || "").trim();
    if (!query || !searchIndex) return [];
    var dig = digitsOnly(query);
    if (dig.length >= 4 && /^[\d.\s]+$/.test(query.replace(/\s/g, ""))) {
      var bases = searchIndex.by_base || {};
      var candidates = [];
      var base7 = dig.length >= 7 ? dig.slice(0, 7) : dig;
      if (searchIndex.by_prefix && searchIndex.by_prefix[dig]) {
        candidates = searchIndex.by_prefix[dig].slice();
      } else if (bases[base7]) {
        candidates = bases[base7].map(function (x) {
          return x.product_id;
        });
      } else if (bases[dig]) {
        candidates = bases[dig].map(function (x) {
          return x.product_id;
        });
      } else if (dig.length >= 4 && searchIndex.by_prefix) {
        for (var L = Math.min(dig.length, 10); L >= 4; L--) {
          var p = dig.slice(0, L);
          if (searchIndex.by_prefix[p]) {
            candidates = searchIndex.by_prefix[p].slice();
            break;
          }
        }
      }
      return unique(candidates);
    }
    if (searchIndex.by_base && searchIndex.by_base[query]) {
      return unique(
        (searchIndex.by_base[query] || []).map(function (x) {
          return x.product_id;
        })
      );
    }
    return [];
  }

  function resolveFromUrl(productParam, qParam) {
    var productId = String(productParam || "").trim();
    var q = String(qParam || "").trim();
    if (productId && !q) {
      return {
        productId: productId,
        tokens: productIndexTokens({ id: productId, product_index: productId }),
        displayQuery: productId,
        source: "product",
      };
    }
    if (productId) {
      var tokens = productIndexTokens({ id: productId, product_index: q || productId });
      if (q) tokens = unique(tokens.concat(productIndexTokens(q)));
      return {
        productId: productId,
        tokens: tokens,
        displayQuery: q || productId,
        source: "product+q",
      };
    }
    if (!q) return null;
    var ids = resolveProductIdsFromQuery(q);
    if (ids.length === 1) {
      return {
        productId: ids[0],
        tokens: unique(productIndexTokens(q).concat(productIndexTokens(ids[0]))),
        displayQuery: q,
        source: "index",
      };
    }
    if (ids.length > 1) {
      return {
        productId: ids[0],
        tokens: unique(productIndexTokens(q).concat(ids.map(function (id) { return id; }))),
        displayQuery: q,
        source: "index-multi",
        productIds: ids,
      };
    }
    return {
      productId: "",
      tokens: productIndexTokens(q),
      displayQuery: q,
      source: "text",
    };
  }

  function brandingUrlForProduct(prod) {
    var p = prod || {};
    var id = p.id || (typeof prod === "string" ? prod : "");
    var idx = p.product_index || "";
    if (id) {
      return "branding.html?product=" + encodeURIComponent(id) + (idx ? "&q=" + encodeURIComponent(idx) : "");
    }
    if (idx) return "branding.html?q=" + encodeURIComponent(idx);
    return "branding.html";
  }

  function isPackagingViz(a) {
    return !!(a && (a.perspective || (a.asset_role === "packshot" && a.perspective)));
  }

  function purposeLabel(a) {
    var tags = a.appearance_tags || [];
    if (tags.length) return tags[0];
    if (a.asset_role === "packshot") return "Packshot";
    if ((a.channels || []).length) return a.channels[0];
    return "Inne materiały graficzne";
  }

  function groupMarketingTiles(assets) {
    assets = assets || [];
    var packViz = assets.filter(function (a) {
      return a.perspective;
    });
    var rest = assets.filter(function (a) {
      return !a.perspective;
    });
    var byPurpose = {};
    rest.forEach(function (a) {
      var key = purposeLabel(a);
      if (!byPurpose[key]) byPurpose[key] = [];
      byPurpose[key].push(a);
    });
    var purposeKeys = Object.keys(byPurpose).sort(function (a, b) {
      return byPurpose[b].length - byPurpose[a].length;
    });
    var tiles = [];
    tiles.push({
      id: "pack-viz",
      title: "Wizualizacja opakowania",
      assets: packViz,
      kind: "viz",
    });
    purposeKeys.slice(0, 3).forEach(function (key, i) {
      tiles.push({
        id: "purpose-" + i + "-" + normTag(key).replace(/[^a-z0-9]+/g, "-"),
        title: key,
        assets: byPurpose[key],
        kind: "graphics",
      });
    });
    if (purposeKeys.length > 3) {
      var overflow = [];
      purposeKeys.slice(3).forEach(function (key) {
        overflow = overflow.concat(byPurpose[key]);
      });
      tiles.push({
        id: "purpose-more",
        title: "Pozostałe materiały",
        assets: overflow,
        kind: "graphics",
      });
    }
    return tiles.filter(function (t) {
      return t.assets && t.assets.length;
    });
  }

  function registerBrandingCountsFromAssets(assets) {
    var map = brandingCounts || {};
    (assets || []).forEach(function (a) {
      if (isArchivedBranding(a)) return;
      (a.linked_product_ids || []).forEach(function (pid) {
        map[pid] = (map[pid] || 0) + 1;
      });
    });
    brandingCounts = map;
    return map;
  }

  function ensureBrandingCounts() {
    if (brandingCounts) return Promise.resolve(brandingCounts);
    if (brandingCountsLoading) return brandingCountsLoading;
    /*
     * HARD freeze fix (2026-07-22): NEVER fetch/parse data/branding-index.json
     * (~388MB). Sync r.json() on that file freezes the whole DAM tab.
     * Reuse in-memory index from Branding page if present; otherwise empty map.
     */
    var shared =
      (typeof window !== "undefined" && window.__damBrandingIndex) ||
      (typeof globalThis !== "undefined" && globalThis.__damBrandingIndex) ||
      null;
    if (shared && Array.isArray(shared.assets) && shared.assets.length) {
      registerBrandingCountsFromAssets(shared.assets);
      return Promise.resolve(brandingCounts);
    }
    brandingCounts = brandingCounts || {};
    brandingCountsLoading = null;
    return Promise.resolve(brandingCounts);
  }

  function getBrandingCount(productId) {
    if (!productId || !brandingCounts) return 0;
    return brandingCounts[productId] || 0;
  }

  function hasBrandingMaterials(productId) {
    return getBrandingCount(productId) > 0;
  }

  global.DamProductCorrelation = {
    productIndexTokens: productIndexTokens,
    isArchivedBranding: isArchivedBranding,
    brandingAssetMatches: brandingAssetMatches,
    filterBrandingAssets: filterBrandingAssets,
    ensureSearchIndex: ensureSearchIndex,
    resolveFromUrl: resolveFromUrl,
    resolveProductIdsFromQuery: resolveProductIdsFromQuery,
    brandingUrlForProduct: brandingUrlForProduct,
    groupMarketingTiles: groupMarketingTiles,
    ensureBrandingCounts: ensureBrandingCounts,
    registerBrandingCountsFromAssets: registerBrandingCountsFromAssets,
    getBrandingCount: getBrandingCount,
    hasBrandingMaterials: hasBrandingMaterials,
  };
})(window);
