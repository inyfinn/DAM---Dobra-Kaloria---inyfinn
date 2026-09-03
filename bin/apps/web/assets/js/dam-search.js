/**
 * DAM - Ajax search over search-index.json + file-index.json
 * - Prefix index match from 4 digits (6300...)
 * - Normalize 6300275 <-> 6300275.00
 * - Fuzzy suggestions when miss
 * - Tag search (czekolada, doypack, kulki, persons...)
 */
(function () {
  "use strict";

  var searchIndex = null;
  var fileIndex = null;
  var loading = null;
  /**
   * Scope radio: all | products | variants.
   * Wszystko = produkty+warianty; odklik Produkty/Warianty wraca do Wszystko.
   */
  var searchScope = { products: true, variants: true };

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function digitsOnly(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function reload() {
    searchIndex = null;
    fileIndex = null;
    loading = null;
    window._DAM_SEARCH_INDEX = null;
    window._DAM_FILE_INDEX = null;
    return loadIndexes();
  }

  function loadIndexes(opts) {
    opts = opts || {};
    if (opts.force) {
      searchIndex = null;
      fileIndex = null;
      loading = null;
      try {
        window._DAM_SEARCH_INDEX = null;
        window._DAM_FILE_INDEX = null;
      } catch (eForce) {
        /* ignore */
      }
    }
    /* HARD: reuse window warm caches — never re-fetch/re-parse 7MB+ JSON
       (picker #damAssocEditSearch freeze after first DamSearch.search). */
    if (!opts.force) {
      if (!fileIndex && typeof window !== "undefined" && window._DAM_FILE_INDEX) {
        fileIndex = window._DAM_FILE_INDEX;
      }
      if (!searchIndex && typeof window !== "undefined" && window._DAM_SEARCH_INDEX) {
        searchIndex = window._DAM_SEARCH_INDEX;
      }
      if (searchIndex && fileIndex) {
        return Promise.resolve({ searchIndex: searchIndex, fileIndex: fileIndex });
      }
    }
    if (loading) return loading;
    var bust = Date.now();
    var needSearch = !searchIndex;
    var needFile = !fileIndex;
    loading = Promise.all([
      needSearch
        ? fetch("data/search-index.json?v=20260717ux3&_=" + bust).then(function (r) {
            if (!r.ok) throw new Error("search-index.json");
            return r.json();
          })
        : Promise.resolve(searchIndex),
      needFile
        ? fetch("data/file-index.json?v=20260717ux3&_=" + bust).then(function (r) {
            if (!r.ok) throw new Error("file-index.json");
            return r.json();
          })
        : Promise.resolve(fileIndex),
    ])
      .then(function (pair) {
        searchIndex = pair[0];
        fileIndex = pair[1];
        window._DAM_SEARCH_INDEX = searchIndex;
        window._DAM_FILE_INDEX = fileIndex;
        loading = null;
        return { searchIndex: searchIndex, fileIndex: fileIndex };
      })
      .catch(function (e) {
        loading = null;
        throw e;
      });
    return loading;
  }

  function productById(id) {
    if (!fileIndex || !fileIndex.products) return null;
    return fileIndex.products.find(function (p) { return p.id === id; }) || null;
  }

  function levenshtein(a, b) {
    a = String(a); b = String(b);
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var row = [];
    var i, j, prev, tmp;
    for (j = 0; j <= n; j++) row[j] = j;
    for (i = 1; i <= m; i++) {
      prev = i;
      for (j = 1; j <= n; j++) {
        tmp = row[j - 1];
        row[j - 1] = prev;
        prev = a.charAt(i - 1) === b.charAt(j - 1) ? tmp : Math.min(tmp, prev, row[j]) + 1;
      }
      row[n] = prev;
    }
    return row[n];
  }

  function longestCommonPrefixLen(a, b) {
    var n = Math.min(a.length, b.length);
    var i = 0;
    while (i < n && a.charAt(i) === b.charAt(i)) i++;
    return i;
  }

  function suggestIndexes(queryDigits) {
    if (!searchIndex || !searchIndex.by_base) return [];
    var q = String(queryDigits || "");
    if (q.length > 7) q = q.slice(0, 7);
    var bases = Object.keys(searchIndex.by_base);
    var scored = [];
    bases.forEach(function (base) {
      var dist = levenshtein(q, base);
      var lcp = longestCommonPrefixLen(q, base);
      // Prefer near-misses that share a long prefix (6300538 -> 6300539)
      if (dist > 2 && lcp < 5) return;
      if (dist > 3) return;
      var score = dist * 100 - lcp * 20 + Math.abs(base.length - q.length);
      var items = searchIndex.by_base[base] || [];
      items.forEach(function (it) {
        // Prefer higher revision (.01 over .00) when same base
        var revBoost = 0;
        var m = String(it.index || "").match(/\.(\d{2})$/);
        if (m) revBoost = -parseInt(m[1], 10);
        scored.push({
          dist: dist,
          lcp: lcp,
          score: score + revBoost,
          index: it.index,
          product_id: it.product_id,
          name: it.name,
          base: base
        });
      });
    });
    scored.sort(function (a, b) {
      if (a.score !== b.score) return a.score - b.score;
      if (a.lcp !== b.lcp) return b.lcp - a.lcp;
      return String(b.index).localeCompare(String(a.index));
    });
    var seen = {};
    var out = [];
    scored.forEach(function (s) {
      if (seen[s.index]) return;
      seen[s.index] = 1;
      out.push(s);
    });
    return out.slice(0, 8);
  }

  function getScope() {
    return {
      products: !!searchScope.products,
      variants: !!searchScope.variants
    };
  }

  /** @returns {"all"|"products"|"variants"} */
  function getScopeMode() {
    var sc = getScope();
    if (sc.products && !sc.variants) return "products";
    if (!sc.products && sc.variants) return "variants";
    return "all";
  }

  function setScope(next) {
    next = next || {};
    if (typeof next.products === "boolean") searchScope.products = next.products;
    if (typeof next.variants === "boolean") searchScope.variants = next.variants;
    if (!searchScope.products && !searchScope.variants) {
      searchScope.products = true;
      searchScope.variants = true;
    }
    try {
      localStorage.setItem(
        "dam_search_scope",
        JSON.stringify({
          products: searchScope.products,
          variants: searchScope.variants,
          mode: getScopeMode()
        })
      );
    } catch (e) { /* ignore */ }
    return getScope();
  }

  function setScopeMode(mode) {
    if (mode === "products") return setScope({ products: true, variants: false });
    if (mode === "variants") return setScope({ products: false, variants: true });
    return setScope({ products: true, variants: true });
  }

  function loadScopeFromStorage() {
    try {
      var raw = localStorage.getItem("dam_search_scope");
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      if (parsed.mode === "products" || parsed.mode === "variants" || parsed.mode === "all") {
        setScopeMode(parsed.mode);
        return;
      }
      setScope(parsed);
    } catch (e) { /* ignore */ }
  }
  loadScopeFromStorage();

  function pathInCategoryArchive(path) {
    var p = String(path || "").toUpperCase();
    if (!p || p.indexOf("ARCHIWUM") === -1) return false;
    return (
      p.indexOf("— ARCHIWUM") !== -1 ||
      p.indexOf("/ARCHIWUM/") !== -1 ||
      p.indexOf("\\ARCHIWUM\\") !== -1 ||
      p.indexOf("0 - ARCHIWUM") !== -1
    );
  }

  function revisionInArchive(rev) {
    if (!rev) return false;
    if (rev.in_archive) return true;
    return pathInCategoryArchive(rev.path || rev.folder || rev.archive_wrapper || "");
  }

  function productPathInArchive(p) {
    if (!p) return false;
    return pathInCategoryArchive(p.path || p.name || "");
  }

  function revisionMatchesQuery(rev, nq, dig, includeArchive) {
    if (!rev) return false;
    if (!includeArchive && revisionInArchive(rev)) return false;
    var blob = norm(
      [
        rev.index,
        rev.name,
        rev.folder,
        rev.path,
        rev.carrier,
        rev.archive_wrapper,
        (rev.tags || []).join(" "),
        (rev.files || [])
          .map(function (f) {
            return f && f.name;
          })
          .join(" "),
      ].join(" ")
    );
    if (nq && blob.indexOf(nq) !== -1) return true;
    if (dig && dig.length >= 3) {
      var idxDig = digitsOnly(rev.index || "");
      if (idxDig && (idxDig.indexOf(dig) === 0 || dig.indexOf(idxDig) === 0)) return true;
    }
    return false;
  }

  function revisionsForSearch(product, includeArchive) {
    var revs = (product && product.revisions) || [];
    if (!includeArchive) revs = revs.filter(function (r) { return !revisionInArchive(r); });
    return revs;
  }

  function productHasLivePresence(p) {
    if (!p) return false;
    var revs = p.revisions || [];
    if (revs.some(function (r) { return r && !revisionInArchive(r); })) return true;
    if (!productPathInArchive(p)) return true;
    return revs.length === 0;
  }

  function productMatchesTextQuery(p, nq, dig, includeArchive) {
    if (!p) return false;
    if (!includeArchive && productPathInArchive(p) && !productHasLivePresence(p)) {
      /* Produkt tylko w archiwum kategorii */
    }
    var pblob = norm(
      [
        p.display_name,
        p.name,
        p.category,
        p.path,
        (p.indexes || []).join(" "),
        (p.tags || []).join(" ")
      ].join(" ")
    );
    var productDirect =
      (nq && pblob.indexOf(nq) !== -1) ||
      (dig &&
        dig.length >= 3 &&
        (p.indexes || []).some(function (ix) {
          var d = digitsOnly(ix);
          return d.indexOf(dig) === 0 || dig.indexOf(d) === 0 || String(ix).toLowerCase().indexOf(nq) !== -1;
        }));
    if (productDirect) {
      if (includeArchive || productHasLivePresence(p) || !productPathInArchive(p)) return true;
    }
    return revisionsForSearch(p, includeArchive).some(function (r) {
      return revisionMatchesQuery(r, nq, dig, includeArchive);
    });
  }

  function getActiveFileIndex(opts) {
    if (opts && opts.fileIndex && opts.fileIndex.products) return opts.fileIndex;
    if (window._DAM_FILE_INDEX && window._DAM_FILE_INDEX.products) return window._DAM_FILE_INDEX;
    return fileIndex;
  }

  function explorerShowAllEnabled() {
    try {
      return localStorage.getItem("dam_explorer_show_all") === "1";
    } catch (e) {
      return false;
    }
  }

  function appendFileIndexMatches(productIds, nq, dig, includeArchive, fi, optsScan) {
    if (!nq || !fi || !fi.products) return productIds;
    optsScan = optsScan || {};
    var limit = optsScan.limit || 0;
    /* Picker/light: hard budget — full 50k forEach = whole-app FREEZE on nonsense q. */
    var budget =
      typeof optsScan.scanBudget === "number"
        ? optsScan.scanBudget
        : limit
          ? Math.max(400, limit * 10)
          : fi.products.length;
    var list = fi.products;
    for (var i = 0; i < list.length; i++) {
      if (i >= budget) break;
      if (limit && productIds.length >= limit) break;
      var p = list[i];
      if (!p || !p.id || productIds.indexOf(p.id) !== -1) continue;
      if (!includeArchive && !productHasLivePresence(p)) continue;
      if (productMatchesTextQuery(p, nq, dig, includeArchive)) productIds.push(p.id);
    }
    return unique(productIds);
  }

  function adoptWarmCaches() {
    if (!fileIndex && typeof window !== "undefined" && window._DAM_FILE_INDEX) {
      fileIndex = window._DAM_FILE_INDEX;
    }
    if (!searchIndex && typeof window !== "undefined" && window._DAM_SEARCH_INDEX) {
      searchIndex = window._DAM_SEARCH_INDEX;
    }
    return !!(searchIndex && fileIndex);
  }

  function buildStructuredHits(products, nq, dig, scope, includeArchive) {
    includeArchive = !!includeArchive;
    var hits = [];
    (products || []).forEach(function (p) {
      if (!p) return;
      var pname = norm(p.display_name || p.name || "");
      var pblob = norm(
        [p.display_name, p.name, p.category, p.path, (p.indexes || []).join(" "), (p.tags || []).join(" ")].join(" ")
      );
      var productMatch =
        !nq ||
        pname.indexOf(nq) !== -1 ||
        pblob.indexOf(nq) !== -1 ||
        (dig && dig.length >= 3 && (p.indexes || []).some(function (ix) {
          var d = digitsOnly(ix);
          return d.indexOf(dig) === 0 || dig.indexOf(d) === 0 || String(ix).toLowerCase().indexOf(nq) !== -1;
        }));
      var matchingRevs = revisionsForSearch(p, includeArchive).filter(function (r) {
        return revisionMatchesQuery(r, nq, dig, includeArchive);
      });
      /* Gdy brak dopasowania wariantu, a produkt pasuje - pokaz wszystkie latest jako kontekst opcjonalnie nie */
      if (scope.products && productMatch) {
        hits.push({
          kind: "product",
          product: p,
          revision: null,
          label: p.display_name || p.name,
          meta: (p.category || "") + (p.indexes && p.indexes.length ? " · " + p.indexes.slice(0, 3).join(", ") : ""),
          childCount: matchingRevs.length
        });
      }
      if (scope.variants) {
        var revsToShow = matchingRevs;
        if (!revsToShow.length && productMatch && scope.products) {
          /* Produkt trafiony, warianty z "test" w srodku - juz w matchingRevs; jesli puste, nie duplikuj */
          revsToShow = [];
        }
        if (!scope.products && !revsToShow.length && productMatch) {
          /* Tylko warianty: pokaz latest gdy produkt pasuje */
          revsToShow = latestRevisions(p);
        }
        revsToShow.forEach(function (r) {
          hits.push({
            kind: "variant",
            product: p,
            revision: r,
            label: r.index || r.name || "Wariant",
            meta: (p.display_name || p.name || "") + (r.carrier ? " · " + r.carrier : ""),
            nested: productMatch && scope.products
          });
        });
      }
    });
    return dedupeHits(hits);
  }

  function search(query, opts) {
    opts = opts || {};
    var includeArchive =
      typeof opts.includeArchive === "boolean" ? opts.includeArchive : explorerShowAllEnabled();
    var q = String(query || "").trim();
    var scope = opts.scope ? Object.assign({}, getScope(), opts.scope) : getScope();
    if (!q) {
      return Promise.resolve({
        query: q,
        mode: "empty",
        products: [],
        hits: [],
        scope: scope,
        includeArchive: includeArchive,
        suggestions: [],
        message: null,
        tags: (searchIndex && searchIndex.by_tag) ? Object.keys(searchIndex.by_tag).slice(0, 40) : []
      });
    }

    return loadIndexes().then(function () {
      var fi = getActiveFileIndex(opts);
      var dig = digitsOnly(q);
      var nq = norm(q);
      var productIds = [];
      var mode = "text";
      var message = null;
      var suggestions = [];
      var light = !!opts.light;
      var hitLimit = opts.limit || 0;

      // Index / numeric search
      if (dig.length >= 4 && /^[\d.\s]+$/.test(q.replace(/\s/g, ""))) {
        mode = "index";
        var pref = dig;
        // exact base lookup
        var bases = searchIndex.by_base || {};
        var exactBase = dig.length >= 7 ? dig.slice(0, 7) : dig;
        // try full digit string as base (7 digits typical)
        var candidates = [];
        var base7 = dig.length >= 7 ? dig.slice(0, 7) : dig;
        if (searchIndex.by_prefix && searchIndex.by_prefix[pref]) {
          candidates = searchIndex.by_prefix[pref].slice();
        } else if (bases[base7]) {
          candidates = bases[base7].map(function (x) { return x.product_id; });
        } else if (dig.length >= 7) {
          // strict 7-digit query: no broad prefix fallback (miss + suggest)
          candidates = [];
        } else if (dig.length >= 4) {
          // try shorter prefixes for partial index typing
          for (var L = Math.min(dig.length, 10); L >= 4; L--) {
            var p = dig.slice(0, L);
            if (searchIndex.by_prefix[p]) {
              candidates = searchIndex.by_prefix[p].slice();
              break;
            }
          }
        }

        // If user typed exact base without revision, still match
        if (!candidates.length && bases[exactBase]) {
          candidates = bases[exactBase].map(function (x) { return x.product_id; });
        }

        productIds = unique(candidates);

        if (!productIds.length) {
          suggestions = suggestIndexes(dig.length >= 7 ? dig.slice(0, 7) : dig);
          message = "Nie znaleziono indeksu \"" + q + "\"";
          if (suggestions.length) {
            message += ". Moze chodziło o:";
          }
        } else {
          // Prefer products that have exact base match for display ordering
          productIds.sort(function (a, b) {
            var pa = productById(a);
            var pb = productById(b);
            var sa = scoreIndexProduct(pa, dig);
            var sb = scoreIndexProduct(pb, dig);
            return sb - sa;
          });
        }
        } else {
          // Tag or text
          mode = "tag_or_text";
          var assocIds = [];
          var rev = searchIndex.association_reverse || {};
          nq.split(/\s+/).forEach(function (tok) {
            if (!tok) return;
            (rev[tok] || []).forEach(function (id) {
              assocIds.push(id);
            });
          });
          assocIds = unique(assocIds);
          var tagHits = (searchIndex.by_tag && searchIndex.by_tag[nq]) || [];
          if (tagHits.length) {
            mode = "tag";
            productIds = unique(tagHits.concat(assocIds));
          } else if (assocIds.length) {
            mode = "association";
            productIds = assocIds.slice();
          } else {
            // partial tag — light: skip full Object.keys scans (picker freeze on garbage q)
            var tagKeys = Object.keys(searchIndex.by_tag || {});
            var tagScanCap = light ? Math.min(tagKeys.length, 200) : tagKeys.length;
            for (var ti = 0; ti < tagScanCap; ti++) {
              var tag = tagKeys[ti];
              if (tag.indexOf(nq) !== -1 || nq.indexOf(tag) !== -1) {
                (searchIndex.by_tag[tag] || []).forEach(function (id) {
                  productIds.push(id);
                });
              }
              if (hitLimit && productIds.length >= hitLimit) break;
            }
            productIds = unique(productIds);
            if (!productIds.length) {
              var entries = searchIndex.entries || [];
              var entryCap = light ? Math.min(entries.length, 600) : entries.length;
              for (var ei = 0; ei < entryCap; ei++) {
                var e = entries[ei];
                if (e && (e.search_blob || "").indexOf(nq) !== -1) productIds.push(e.id);
                if (hitLimit && productIds.length >= hitLimit) break;
              }
              productIds = unique(productIds);
              var baseKeys = Object.keys(searchIndex.by_base || {});
              var baseScanCap = light ? Math.min(baseKeys.length, 300) : baseKeys.length;
              for (var bi = 0; bi < baseScanCap; bi++) {
                var base = baseKeys[bi];
                var nb = norm(base);
                if (!nb || nb.indexOf(nq) === -1) continue;
                (searchIndex.by_base[base] || []).forEach(function (x) {
                  productIds.push(x.product_id);
                });
                if (hitLimit && productIds.length >= hitLimit) break;
              }
              productIds = unique(productIds);
              var exactAlpha = String(q || "")
                .trim()
                .toUpperCase();
              if (/^TEST-[A-Z0-9-]+$/.test(exactAlpha) && searchIndex.by_base[exactAlpha]) {
                (searchIndex.by_base[exactAlpha] || []).forEach(function (x) {
                  productIds.push(x.product_id);
                });
                productIds = unique(productIds);
                mode = "index";
              } else {
                mode = "text";
              }
            } else {
              mode = "tag";
            }
          }
        }

      /* Dolacz produkty z file-index — ALWAYS budgeted when light/limit (picker). */
      productIds = appendFileIndexMatches(productIds, nq, dig, includeArchive, fi, {
        limit: hitLimit || 0,
        scanBudget: light ? Math.max(400, (hitLimit || 80) * 10) : undefined,
      });

      if (!includeArchive) {
        productIds = productIds.filter(function (pid) {
          var p = productById(pid);
          if (!p && fi && fi.products) {
            p = fi.products.find(function (x) { return x.id === pid; }) || null;
          }
          return productHasLivePresence(p);
        });
      }

      var products = productIds.map(function (pid) {
        if (fi && fi.products) {
          var fromFi = fi.products.find(function (x) { return x.id === pid; });
          if (fromFi) return fromFi;
        }
        return productById(pid);
      }).filter(Boolean);
      if (opts.limit) products = products.slice(0, opts.limit);
      var hits = buildStructuredHits(products, nq, dig, scope, includeArchive);

      return {
        query: q,
        mode: mode,
        products: products,
        hits: hits,
        scope: scope,
        includeArchive: includeArchive,
        suggestions: suggestions,
        message: message,
        tags: Object.keys(searchIndex.by_tag || {}).slice(0, 60)
      };
    });
  }

  function scoreIndexProduct(p, dig) {
    if (!p) return 0;
    var score = 0;
    (p.index_bases || []).forEach(function (b) {
      if (b === dig || b === dig.slice(0, 7)) score += 100;
      if (dig.indexOf(b) === 0 || b.indexOf(dig) === 0) score += 40;
    });
    (p.indexes || []).forEach(function (idx) {
      if (digitsOnly(idx).indexOf(dig) === 0) score += 20;
    });
    return score;
  }

  function unique(arr) {
    var seen = {};
    var out = [];
    (arr || []).forEach(function (x) {
      if (seen[x]) return;
      seen[x] = 1;
      out.push(x);
    });
    return out;
  }

  function normPathKey(p) {
    return String(p || "")
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .toLowerCase()
      .trim();
  }

  function dedupeHits(hits) {
    var seen = {};
    return (hits || []).filter(function (h) {
      if (!h || !h.product || !h.product.id) return false;
      var revKey = "";
      if (h.revision) {
        revKey = normPathKey(h.revision.path || h.revision.folder || h.revision.index || "");
      }
      var key = (h.kind || "product") + "|" + h.product.id + "|" + revKey;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function latestRevisions(product) {
    if (!product) return [];
    var latest = (product.revisions || []).filter(function (r) { return r.is_latest; });
    if (latest.length) return latest;
    return product.revisions || [];
  }

  /**
   * Radio + odklik:
   * - domyślnie Wszystko
   * - klik Produkty/Warianty = tylko ten zakres
   * - ponowny klik aktywnego Produkty/Warianty = Wszystko
   * - klik Wszystko zawsze = Wszystko
   * opts.locked = true (Wizualizacje): zawsze Wszystko, Produkty/Warianty wygaszone
   */
  function bindScopeChips(mountEl, onChange, opts) {
    if (!mountEl) return;
    opts = opts || {};
    var locked = !!opts.locked;
    /* locked: tylko UI (Wizualizacje) - nie nadpisuj localStorage scope z Eksplorera */
    /* opts.trailingEl: element (np. #damChangeLogBar) doklejany na prawo w .dam-search-scope */

    function paint() {
      var mode = locked ? "all" : getScopeMode();
      var disAttr = locked ? ' disabled aria-disabled="true"' : "";
      var disCls = locked ? " is-disabled" : "";
      var trailingEl = opts.trailingEl || null;
      if (trailingEl && trailingEl.parentNode) {
        trailingEl.parentNode.removeChild(trailingEl);
      }
      mountEl.innerHTML =
        '<div class="dam-search-scope" role="group" aria-label="Zakres wyszukiwania">' +
        '<button type="button" class="dam-search-scope__btn' +
        (mode === "all" ? " is-on" : "") +
        '" data-scope="all" aria-pressed="' +
        (mode === "all") +
        '">Wszystko</button>' +
        '<button type="button" class="dam-search-scope__btn' +
        (mode === "products" ? " is-on" : "") +
        disCls +
        '" data-scope="products" aria-pressed="' +
        (mode === "products") +
        '"' +
        disAttr +
        ">Produkty</button>" +
        '<button type="button" class="dam-search-scope__btn' +
        (mode === "variants" ? " is-on" : "") +
        disCls +
        '" data-scope="variants" aria-pressed="' +
        (mode === "variants") +
        '"' +
        disAttr +
        ">Warianty</button>" +
        "</div>";
      if (locked) mountEl.classList.add("dam-search-scope-mount--locked");
      else mountEl.classList.remove("dam-search-scope-mount--locked");

      var scopeRow = mountEl.querySelector(".dam-search-scope");
      if (scopeRow && trailingEl) {
        trailingEl.classList.add("dam-search-scope__trailing");
        scopeRow.appendChild(trailingEl);
      }

      mountEl.querySelectorAll("[data-scope]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (locked) return;
          var kind = this.getAttribute("data-scope");
          var cur = getScopeMode();
          if (kind === "all") {
            setScopeMode("all");
          } else if (kind === "products") {
            setScopeMode(cur === "products" ? "all" : "products");
          } else if (kind === "variants") {
            setScopeMode(cur === "variants" ? "all" : "variants");
          }
          paint();
          if (onChange) onChange(getScope());
        });
      });
      if (typeof opts.afterPaint === "function") {
        try {
          opts.afterPaint(mountEl, scopeRow);
        } catch (ePaint) { /* ignore */ }
      }
    }
    paint();
  }

  function buildHitItemHtml(h) {
    var p = h.product || {};
    var r = h.revision;
    var cls = "dam-search-hit dam-search-hit--" + (h.kind || "product");
    if (h.nested) cls += " dam-search-hit--nested";
    var badge = h.kind === "variant" ? "Wariant" : "Produkt";
    var focusIdx = r && r.index ? r.index : "";
    if (focusIdx && /[/\\]/.test(focusIdx) && r && r.path) {
      focusIdx = String(r.path).split(/[/\\]/).filter(Boolean).pop() || focusIdx;
    }
    var hitName =
      h.label ||
      (p.display_name || p.name || "") ||
      (r && r.path ? String(r.path).split(/[/\\]/).filter(Boolean).pop() : "") ||
      p.id ||
      "";
    var hitMeta = h.meta || "";
    if (!hitMeta && r && r.path) {
      hitMeta = String(r.path)
        .replace(/^.*[\\/]Marketing[\\/]/i, "")
        .replace(/\//g, "\\");
    } else if (!hitMeta && p.path) {
      hitMeta = String(p.path)
        .replace(/^.*[\\/]Marketing[\\/]/i, "")
        .replace(/\//g, "\\");
    }
    return (
      '<li class="' +
      cls +
      '"><a href="#" data-pid="' +
      escapeHtml(p.id || "") +
      '"' +
      (focusIdx ? ' data-suggest="' + escapeHtml(focusIdx) + '"' : "") +
      ' data-hit-kind="' +
      escapeHtml(h.kind || "product") +
      '">' +
      '<span class="dam-search-hit__badge">' +
      escapeHtml(badge) +
      "</span>" +
      '<span class="dam-search-name">' +
      escapeHtml(hitName) +
      "</span>" +
      '<span class="dam-search-meta">' +
      escapeHtml(hitMeta) +
      (h.kind === "product" && h.childCount
        ? " · " + h.childCount + " dopas. wariant" + (h.childCount === 1 ? "" : "y")
        : "") +
      "</span></a></li>"
    );
  }

  function renderHitsHtml(res, opts) {
    opts = opts || {};
    var hits = (res && res.hits) || [];
    if (!hits.length) return "";
    var panelCls = opts.panel ? " dam-search-hits--panel" : "";
    var html = '<ul class="dam-search-hits' + panelCls + '">';
    hits.slice(0, opts.limit || 40).forEach(function (h) {
      html += buildHitItemHtml(h);
    });
    html += "</ul>";
    return html;
  }

  function bindHitsClick(root, onSelect, opts) {
    opts = opts || {};
    (root || document).querySelectorAll(".dam-search-hits a[data-pid]").forEach(function (a) {
      if (a._damHitBound) return;
      a._damHitBound = true;
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var pid = this.getAttribute("data-pid");
        var sug = this.getAttribute("data-suggest");
        if (opts.clearInput !== false) {
          var wrap = this.closest(".dam-search-wrap");
          var inp = wrap && wrap.querySelector("input");
          if (inp) inp.value = "";
          var drop = wrap && wrap.querySelector("#damSearchResults, .dam-search-results");
          if (drop) {
            drop.innerHTML = "";
            drop.style.display = "none";
          }
        }
        var prod = productById(pid);
        if (onSelect) onSelect(prod, sug || null);
      });
    });
  }

  function bindSearchBox(inputEl, resultsEl, onSelect, scopeEl, opts) {
    if (!inputEl) return;
    opts = opts || {};
    var timer = null;
    function notifyResults(res, q) {
      if (opts.onResults && typeof opts.onResults === "function") {
        opts.onResults(res, q);
      }
    }
    function runSearch() {
      var q = inputEl.value;
      return search(q, {
        limit: opts.limit || 30,
        includeArchive: explorerShowAllEnabled(),
        fileIndex: opts.fileIndex || window._DAM_FILE_INDEX
      }).then(function (res) {
        if (opts.enrichResults && typeof opts.enrichResults === "function") {
          res = opts.enrichResults(res, q) || res;
        }
        render(res);
        notifyResults(res, q);
        return res;
      }).catch(function (err) {
        resultsEl.innerHTML = '<div class="dam-search-msg">Blad indeksu: ' + escapeHtml(err.message) + "</div>";
        resultsEl.style.display = "block";
        notifyResults({ query: q, hits: [], products: [], message: err.message }, q);
      });
    }
    if (scopeEl) {
      bindScopeChips(
        scopeEl,
        function () {
          if (inputEl.value.trim()) runSearch();
        },
        opts
      );
    }
    function render(res) {
      if (!resultsEl) return;
      if (!res.query) {
        resultsEl.innerHTML = "";
        resultsEl.style.display = "none";
        notifyResults({ query: "", hits: [], products: [], suggestions: [] }, "");
        return;
      }
      var html = "";
      if (res.message) {
        html += '<div class="dam-search-msg">' + escapeHtml(res.message) + "</div>";
      }
      if (res.suggestions && res.suggestions.length) {
        html += '<ul class="dam-search-suggest">';
        res.suggestions.forEach(function (s) {
          html += '<li><a href="#" data-suggest="' + escapeHtml(s.index) + '" data-pid="' +
            escapeHtml(s.product_id) + '"><strong>' + escapeHtml(s.index) +
            "</strong> - " + escapeHtml(s.name) + "</a></li>";
        });
        html += "</ul>";
      }
      var hits = res.hits || [];
      if (hits.length) {
        html += renderHitsHtml(res, { limit: opts.limit || 40 });
      } else if (res.products && res.products.length) {
        html += '<ul class="dam-search-hits">';
        res.products.slice(0, 20).forEach(function (p) {
          var label = p.display_name || p.name;
          html += '<li><a href="#" data-pid="' + escapeHtml(p.id) + '">' +
            '<span class="dam-search-name">' + escapeHtml(label) + "</span>" +
            '<span class="dam-search-meta">' + escapeHtml(p.category) + " · " +
            escapeHtml((p.indexes || []).slice(0, 3).join(", ")) +
            "</span></a></li>";
        });
        html += "</ul>";
      } else if (!res.suggestions.length) {
        html += '<div class="dam-search-msg">Brak wynikow</div>';
      }
      resultsEl.innerHTML = html;
      resultsEl.style.display = "block";
      bindHitsClick(resultsEl, onSelect, { clearInput: true });
    }

    inputEl.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        runSearch();
      }, 120);
    });

    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        resultsEl.style.display = "none";
      }
    });

    document.addEventListener("click", function (e) {
      if (!resultsEl || !resultsEl.contains) return;
      var wrap = inputEl.closest ? inputEl.closest(".dam-search-wrap") : null;
      if (resultsEl.contains(e.target)) return;
      if (e.target === inputEl) return;
      if (wrap && wrap.contains(e.target)) return;
      resultsEl.style.display = "none";
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function load(opts) {
    return loadIndexes(opts || {});
  }

  window.DamSearch = {
    load: load,
    reload: reload,
    search: search,
    bindSearchBox: bindSearchBox,
    renderHitsHtml: renderHitsHtml,
    bindHitsClick: bindHitsClick,
    bindScopeChips: bindScopeChips,
    getScope: getScope,
    setScope: setScope,
    getScopeMode: getScopeMode,
    setScopeMode: setScopeMode,
    productById: productById,
    normQuery: norm,
    digitsOnly: digitsOnly,
    productMatchesTextQuery: productMatchesTextQuery,
    /** Sync-adopt window._DAM_* without fetch/JSON.parse. */
    adoptWarmCaches: adoptWarmCaches,
    /** True when module already holds parsed indexes (no pending JSON.parse). */
    isReady: function () {
      adoptWarmCaches();
      return !!(searchIndex && fileIndex);
    },
    latestRevisions: latestRevisions,
    suggestIndexes: suggestIndexes
  };
})();
