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

  function pageIsViz() {
    try {
      var pv = String((typeof location !== "undefined" && location.pathname) || "").toLowerCase();
      return pv.indexOf("visualizations.html") !== -1;
    } catch (eViz) {
      return false;
    }
  }

  function reload() {
    /* Explorer + Viz: never re-fetch 9MB data/file-index.json from :8765
       (single-thread serve hang on next explorer.html in the same profile). */
    if (pageIsExplorer() || pageIsViz()) {
      searchIndex = null;
      loading = null;
      /* Bez pobierania 9 MB tutaj; tylko porzuc pamiec wspolnego loadera. */
      if (window.DamFileIndex && typeof window.DamFileIndex.invalidate === "function") {
        window.DamFileIndex.invalidate();
      }
      try {
        window._DAM_SEARCH_INDEX = null;
      } catch (eExp) {
        /* ignore */
      }
      return loadIndexes({ searchOnly: true, force: true });
    }
    searchIndex = null;
    fileIndex = null;
    loading = null;
    window._DAM_SEARCH_INDEX = null;
    window._DAM_FILE_INDEX = null;
    /* Po przebudowie: wspolny loader pobierze swiezy plik (nowy znacznik, no-store). */
    if (window.DamFileIndex && typeof window.DamFileIndex.invalidate === "function") {
      window.DamFileIndex.invalidate();
    }
    return loadIndexes();
  }

  /* Slim explorer ~512KB must be allowed on main if Worker parse fails. 9MB full index stays blocked. */
  var MAIN_PARSE_MAX = 1200000;

  function pageIsExplorer() {
    try {
      var p = String((typeof location !== "undefined" && location.pathname) || "").toLowerCase();
      return p.indexOf("explorer.html") !== -1;
    } catch (ePage) {
      return false;
    }
  }

  function parseJsonMaybeMain(text, label) {
    if (typeof text !== "string") return text;
    if (text.length > MAIN_PARSE_MAX) {
      throw new Error((label || "json") + "_too_large_for_main");
    }
    return JSON.parse(text);
  }

  function parseJsonInWorker(text, label, timeoutMs) {
    timeoutMs = timeoutMs || 20000;
    label = label || "json";
    if (typeof text !== "string") {
      return Promise.resolve(text);
    }
    if (typeof Worker === "undefined" || typeof Blob === "undefined") {
      return Promise.resolve(parseJsonMaybeMain(text, label));
    }
    return new Promise(function (resolve, reject) {
      var src =
        "self.onmessage=function(e){try{self.postMessage({ok:1,data:JSON.parse(e.data)});}catch(err){self.postMessage({ok:0,error:String(err)});}};";
      var blob = new Blob([src], { type: "text/javascript" });
      var url = URL.createObjectURL(blob);
      var worker;
      try {
        worker = new Worker(url);
      } catch (errW) {
        URL.revokeObjectURL(url);
        try {
          resolve(parseJsonMaybeMain(text, label));
        } catch (errP) {
          reject(errP);
        }
        return;
      }
      var tid = setTimeout(function () {
        try { worker.terminate(); } catch (eT) { /* ignore */ }
        URL.revokeObjectURL(url);
        reject(new Error(label + "_parse_timeout"));
      }, timeoutMs);
      worker.onmessage = function (ev) {
        clearTimeout(tid);
        try { worker.terminate(); } catch (eM) { /* ignore */ }
        URL.revokeObjectURL(url);
        var msg = ev.data || {};
        if (msg.ok) resolve(msg.data);
        else reject(new Error(msg.error || label + "_parse"));
      };
      worker.onerror = function () {
        clearTimeout(tid);
        try { worker.terminate(); } catch (eE) { /* ignore */ }
        URL.revokeObjectURL(url);
        try {
          resolve(parseJsonMaybeMain(text, label));
        } catch (errP2) {
          reject(errP2);
        }
      };
      worker.postMessage(text);
    });
  }

  function loadIndexes(opts) {
    opts = opts || {};
    if (opts.force) {
      searchIndex = null;
      loading = null;
      try {
        window._DAM_SEARCH_INDEX = null;
      } catch (eSearch) {
        /* ignore */
      }
      if (!opts.searchOnly) {
        fileIndex = null;
        try {
          window._DAM_FILE_INDEX = null;
          if (window.DamFileIndex && typeof window.DamFileIndex.invalidate === "function") {
            window.DamFileIndex.invalidate();
          }
        } catch (eForce) {
          /* ignore */
        }
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
    /* Explorer first paint: NEVER r.json() ~9MB file-index.json (assoc freeze class). */
    var skipFile =
      !!opts.searchOnly ||
      pageIsExplorer() ||
      pageIsViz() ||
      !!(fileIndex && fileIndex.products) ||
      !!(typeof window !== "undefined" && window._DAM_FILE_INDEX && window._DAM_FILE_INDEX.products);
    var needFile = !fileIndex && !skipFile;
    loading = Promise.all([
      needSearch
        ? fetch("data/search-index.json?v=20260717ux3&_=" + bust).then(function (r) {
            if (!r.ok) throw new Error("search-index.json");
            return r.json();
          })
        : Promise.resolve(searchIndex),
      needFile
        ? window.DamFileIndex && typeof window.DamFileIndex.get === "function"
          ? /* Wspolne Promise strony (dam-file-index.js); force -> invalidate wyzej. */
            window.DamFileIndex.get()
          : fetch("data/file-index.json?v=20260717ux3&_=" + bust).then(function (r) {
              if (!r.ok) throw new Error("file-index.json");
              return r.text().then(function (text) {
                return parseJsonInWorker(text, "file-index", 20000);
              });
            })
        : Promise.resolve(fileIndex),
    ])
      .then(function (pair) {
        searchIndex = pair[0];
        if (pair[1]) {
          fileIndex = pair[1];
          window._DAM_FILE_INDEX = fileIndex;
        }
        window._DAM_SEARCH_INDEX = searchIndex;
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

  /* ------------------------------------------------------------------ *
   * PRZESZUKIWANIE OPISOW
   *
   * Opis wariantu ("GRILL", "Żelazo, Magnez, Witamina E") to czesto
   * JEDYNE miejsce, gdzie stoi to, czego uzytkownik szuka - sam indeks
   * 6300631 nikomu nic nie mowi. Dlatego opisy przeszukujemy DOMYSLNIE:
   * wpisujesz "grill" i dostajesz tez warianty opisane jako grillowe,
   * nie tylko te z "grill" w nazwie produktu.
   *
   * Da sie to wylaczyc - brak klucza w localStorage znaczy WLACZONE,
   * wiec domyslka nie wymaga zadnego zapisu przy pierwszym uruchomieniu.
   * ------------------------------------------------------------------ */
  var DESC_KEY = "dam_search_descriptions";

  function descriptionsEnabled() {
    try {
      return localStorage.getItem(DESC_KEY) !== "0";
    } catch (e) {
      return true;
    }
  }

  function setDescriptionsEnabled(on) {
    try {
      localStorage.setItem(DESC_KEY, on ? "1" : "0");
    } catch (e) { /* prywatne okno */ }
    return descriptionsEnabled();
  }

  /** Rozstrzyga flage: jawny boolean z opts wygrywa nad ustawieniem uzytkownika. */
  function resolveDesc(v) {
    return typeof v === "boolean" ? v : descriptionsEnabled();
  }

  /**
   * Opis rewizji: wyroznik z nazwy folderu ALBO notatka dopisana w programie.
   * Zrodlo prawdy jest jedno - DamLabels.variantDistinguisher - zeby wyszukiwarka
   * szukala dokladnie po tym, co uzytkownik widzi na chipie przy wariancie.
   */
  function revisionNoteText(rev) {
    if (!rev) return "";
    var VN = window.DamVariantNotes;
    var DL = window.DamLabels;
    if (DL && typeof DL.variantDistinguisher === "function") {
      var d = DL.variantDistinguisher(rev, function (r) {
        return VN && typeof VN.forRevision === "function" ? VN.forRevision(r) : "";
      });
      if (d && d.text) return String(d.text);
    }
    if (VN && typeof VN.forRevision === "function") return String(VN.forRevision(rev) || "");
    return "";
  }

  /** Czy opis rewizji trafia w zapytanie (po calosci albo po pojedynczym tagu). */
  function revisionNoteMatches(rev, nq) {
    if (!nq) return false;
    var txt = revisionNoteText(rev);
    if (!txt) return false;
    var VN = window.DamVariantNotes;
    if (VN && typeof VN.noteMatches === "function") return VN.noteMatches(txt, nq);
    return norm(txt).indexOf(nq) !== -1;
  }

  /** Opisy musza byc wczytane, zanim po nich szukamy - inaczej pierwsze zapytanie kłamie. */
  function notesReady() {
    var VN = window.DamVariantNotes;
    if (!VN || typeof VN.load !== "function") return Promise.resolve(null);
    try {
      return Promise.resolve(VN.load()).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
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

  function revisionMatchesQuery(rev, nq, dig, includeArchive, useDesc) {
    if (!rev) return false;
    if (!includeArchive && revisionInArchive(rev)) return false;
    /* Opis jest czesto jedyna trescia odrozniajaca wariant - sprawdzamy go
       PRZED blobem, bo notatka nie siedzi w indeksie na dysku. */
    if (resolveDesc(useDesc) && revisionNoteMatches(rev, nq)) return true;
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

  function productMatchesTextQuery(p, nq, dig, includeArchive, useDesc) {
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
      return revisionMatchesQuery(r, nq, dig, includeArchive, useDesc);
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

  function appendFileIndexMatches(productIds, nq, dig, includeArchive, fi, optsScan, useDesc) {
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
      if (productMatchesTextQuery(p, nq, dig, includeArchive, useDesc)) productIds.push(p.id);
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

  function buildStructuredHits(products, nq, dig, scope, includeArchive, useDesc) {
    includeArchive = !!includeArchive;
    useDesc = resolveDesc(useDesc);
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
        return revisionMatchesQuery(r, nq, dig, includeArchive, useDesc);
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

    /* Opisy wczytujemy ROWNOLEGLE z indeksami. Bez tego pierwsze zapytanie po
       starcie szukaloby po pustym STORE i "grill" nie znalazlby wariantu
       opisanego jako GRILL - a przy drugim wpisaniu juz tak. */
    var useDesc = resolveDesc(opts.descriptions);
    return Promise.all([
      loadIndexes({
        searchOnly: pageIsExplorer() || !!(typeof window !== "undefined" && window._DAM_FILE_INDEX)
      }),
      useDesc ? notesReady() : null
    ]).then(function () {
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
      }, useDesc);

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
      var hits = buildStructuredHits(products, nq, dig, scope, includeArchive, useDesc);

      return {
        query: q,
        mode: mode,
        products: products,
        hits: hits,
        scope: scope,
        includeArchive: includeArchive,
        descriptions: useDesc,
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
      var descOn = descriptionsEnabled();
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
        /* Osobny przelacznik, NIE czwarty stan radia: zakres (co pokazujemy)
           i opisy (gdzie szukamy) to dwa niezalezne wymiary. Domyslnie wlaczony. */
        '<span class="dam-search-scope__sep" aria-hidden="true"></span>' +
        '<button type="button" class="dam-search-scope__btn dam-search-scope__btn--desc' +
        (descOn ? " is-on" : "") +
        '" data-desc-toggle="1" role="switch" aria-checked="' +
        (descOn ? "true" : "false") +
        '" title="' +
        (descOn
          ? "Szukamy także w opisach wariantów. Kliknij, aby wyłączyć."
          : "Opisy są pomijane - szukamy tylko w nazwach i indeksach. Kliknij, aby włączyć.") +
        '">Opisy</button>' +
        "</div>";
      if (locked) mountEl.classList.add("dam-search-scope-mount--locked");
      else mountEl.classList.remove("dam-search-scope-mount--locked");

      var scopeRow = mountEl.querySelector(".dam-search-scope");
      if (scopeRow && trailingEl) {
        trailingEl.classList.add("dam-search-scope__trailing");
        scopeRow.appendChild(trailingEl);
      }

      var descBtn = mountEl.querySelector("[data-desc-toggle]");
      if (descBtn) {
        descBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          setDescriptionsEnabled(!descriptionsEnabled());
          paint();
          if (onChange) onChange(getScope());
        });
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

  /* Wyroznik obok indeksu. Dwa zrodla, jedna prezentacja:
     - "folder" = czlon nazwy folderu (MAGNEZ & ŻELAZO) - nic nie trzeba wpisywac,
     - "note"   = opis dopisany w programie, gdy nazwa folderu nic nie mowi.
     Sam indeks (6300631) nikomu nic nie mowi, a to jest jedyna roznica
     miedzy osmioma rekawami Burgera Klasycznego. */
  function variantNoteChip(h, hitName) {
    var DL = window.DamLabels;
    var VN = window.DamVariantNotes;
    if (!DL || typeof DL.variantDistinguisher !== "function") return "";
    var rev = (h && h.revision) || null;
    if (!rev && h && h.label) rev = { folder: h.label };
    if (!rev) return "";
    var d = DL.variantDistinguisher(rev, function (r) {
      return VN ? VN.forRevision(r) : "";
    });
    if (!d.text) return "";
    /* Wiersz PRODUKTU dostawal wyroznik wyliczony z wlasnej nazwy, wiec obok
       "Kiełbasa Grill" wisial chip "Kiełbasa Grill". Chip ma DODAWAC tresc. */
    if (hitName && norm(d.text) === norm(hitName)) return "";

    var tip = d.source === "folder" ? "Wyróżnik z nazwy folderu" : "Opis dodany w programie";
    /* Opis "Żelazo, Magnez, Witamina E" to trzy cechy - trzy chipy, nie jeden
       dlugi napis. Kazdy da sie odczytac osobno i kliknac jak tag. */
    var parts = (VN && typeof VN.tokens === "function") ? VN.tokens(d.text) : [];
    if (!parts.length) parts = [d.text];
    return parts
      .map(function (t) {
        return (
          '<span class="dam-search-hit__note dam-variant-dist dam-variant-dist--' +
          escapeHtml(d.source) +
          '" title="' +
          escapeHtml(tip) +
          '">' +
          escapeHtml(t) +
          "</span>"
        );
      })
      .join("");
  }

  function buildHitItemHtml(h, groupStart) {
    var p = h.product || {};
    var r = h.revision;
    var cls = "dam-search-hit dam-search-hit--" + (h.kind || "product");
    if (h.nested) cls += " dam-search-hit--nested";
    if (groupStart) cls += " dam-search-hit--group-start";
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
      /* Opis wariantu obok indeksu: sam numer nikomu nic nie mowi. */
      variantNoteChip(h, hitName) +
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
    /* Poczatek grupy = ZMIANA PRODUKTU, nie "wiersz typu PRODUKT".
       Wariant trafiony sam (produkt nie pasowal do zapytania - np. GRILL
       w opisie Burgera Klasycznego przy szukaniu "grill") nie ma nad soba
       wiersza produktu. Bez tego znacznika taki wariant przyklejal sie
       wizualnie do poprzedniego produktu i czytalo sie go jako jego czesc. */
    var prevPid = null;
    hits.slice(0, opts.limit || 40).forEach(function (h) {
      var pid = (h && h.product && h.product.id) || "";
      html += buildHitItemHtml(h, pid !== prevPid && prevPid !== null);
      prevPid = pid;
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

  /* --- Wyszukiwanie semantyczne branding (frazy potoczne) ---
     Wpięcie w dam-branding.js (FORBIDDEN tutaj) - 2 latki:

     1) assetMatchesSearchQuery, zaraz po `if (!q) return true;`:
          if (window.DamSearch && DamSearch.semanticQueryHasConcepts && DamSearch.semanticQueryHasConcepts(q)) {
            if (index && index.assets) DamSearch.semanticPrepare(index.assets);
            return DamSearch.semanticAssetInResults(a, q);
          }

     2) sortAssetsForDisplay, na poczatku po `list = asAssetList(list);`:
          if (q && window.DamSearch && DamSearch.semanticOrderAssets && DamSearch.semanticQueryHasConcepts(q)) {
            return DamSearch.semanticOrderAssets(list, q);
          }
  */
  var semanticVocab = null;
  var semanticPrepared = null;
  var semanticPrepareSig = "";
  var semanticRecognition = null;
  var PL_FOLD = {
    "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z",
    "Ą": "a", "Ć": "c", "Ę": "e", "Ł": "l", "Ń": "n", "Ó": "o", "Ś": "s", "Ź": "z", "Ż": "z"
  };

  function semanticFold(text) {
    var s = String(text || "");
    var out = "";
    var i;
    for (i = 0; i < s.length; i++) {
      out += PL_FOLD[s.charAt(i)] || s.charAt(i);
    }
    try {
      out = out.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (eFold) { /* ignore */ }
    return out.toLowerCase();
  }

  function semanticCollapse(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function semanticTokens(text) {
    return semanticFold(text).split(/[^a-z0-9]+/).filter(Boolean);
  }

  function semanticDigitsKey(id) {
    var d = String(id || "").replace(/\D/g, "");
    if (d.length < 6) return "";
    return d.slice(-6);
  }

  function semanticLoadRecognition() {
    if (semanticRecognition) return Promise.resolve(semanticRecognition);
    return fetch("data/branding-recognition.json")
      .then(function (r) {
        return r.ok ? r.json() : { assets: {} };
      })
      .then(function (raw) {
        var map = (raw && raw.assets) || {};
        semanticRecognition = map;
        Object.keys(map).forEach(function (key) {
          var d = semanticDigitsKey(key);
          if (d && !semanticRecognition[d]) semanticRecognition[d] = map[key];
        });
        return semanticRecognition;
      })
      .catch(function () {
        semanticRecognition = {};
        return semanticRecognition;
      });
  }

  function semanticPathIsKopia(path) {
    var parts = String(path || "").replace(/\\/g, "/").split("/");
    return parts.some(function (part) {
      return /-kopia$/i.test(part);
    });
  }

  function semanticCanonicalPath(path) {
    return String(path || "")
      .replace(/\\/g, "/")
      .split("/")
      .map(function (part) {
        return part.replace(/-kopia$/i, "");
      })
      .join("/")
      .toLowerCase();
  }

  function collapseCopyHits(hits) {
    var list = hits || [];
    var groups = {};
    var order = [];
    list.forEach(function (hit) {
      if (!hit) return;
      var key = semanticCanonicalPath(hit.path || "");
      if (!groups[key]) {
        order.push(key);
        groups[key] = [];
      }
      groups[key].push(hit);
    });
    return order.map(function (key) {
      var bunch = groups[key];
      var orig = bunch.filter(function (h) {
        return !semanticPathIsKopia(h.path || "");
      });
      var copies = bunch.filter(function (h) {
        return semanticPathIsKopia(h.path || "");
      });
      var keep = orig[0] || bunch[0];
      if (!copies.length) return keep;
      var out = {};
      Object.keys(keep).forEach(function (k) {
        out[k] = keep[k];
      });
      out.merged_copy_count = orig.length ? copies.length : 0;
      out.is_copy = !orig.length;
      out.copy_paths = copies.map(function (h) {
        return h.path || "";
      });
      return out;
    });
  }

  function humanizeConceptSource(cid, via) {
    var v = String(via || "").toLowerCase();
    if (v.indexOf("subject:czlowiek") !== -1 || v.indexOf("ludzie") !== -1) {
      return "w folderze ze zdjęciami ludzi (to ta osoba)";
    }
    if (cid === "product:kulki" && v.indexOf("path:") === 0) {
      return "w folderze z kulkami";
    }
    if (v.indexOf("tag:") !== -1) {
      var tag = String(via || "").replace(/^[\s\S]*tag:/i, "").trim();
      return tag ? "oznaczone tagiem „" + tag + "”" : "";
    }
    if (v.indexOf("ocr") === 0 || v.indexOf(":ocr") !== -1) {
      var ocrVia = String(via || "").replace(/^ocr:/i, "").trim();
      return ocrVia ? "napis na grafice: „" + ocrVia + "”" : "napis na grafice";
    }
    return "";
  }

  function formatSemanticReason(hit) {
    if (!hit) return "";
    var raw = String(hit.reason || hit.association_reason || "").trim();
    var group = String(hit.group || "");
    var sources = hit.concept_sources || {};
    var extras = [];
    Object.keys(sources).forEach(function (cid) {
      var bit = humanizeConceptSource(cid, sources[cid]);
      if (bit && extras.indexOf(bit) === -1) extras.push(bit);
    });
    var human = raw;
    if (/^folder:\s*/i.test(raw)) {
      human = "W folderze „" + raw.replace(/^folder:\s*/i, "") + "” - tu są zdjęcia z szukanym produktem, nawet gdy nazwa pliku tego nie mówi.";
    } else if (/^tag wyglądu:\s*/i.test(raw)) {
      human = "Oznaczone tagiem wyglądu „" + raw.replace(/^tag wyglądu:\s*/i, "") + "”.";
    } else if (/^ta sama sesja:\s*/i.test(raw)) {
      human = "Ta sama sesja zdjęciowa " + raw.replace(/^ta sama sesja:\s*/i, "") + " - ta sama osoba, co na zdjęciach z szukanym produktem.";
    } else if (/^ta sama kampania:\s*/i.test(raw)) {
      human = "Z tej samej kampanii " + raw.replace(/^ta sama kampania:\s*/i, "") + ".";
    } else if (/^nazwa pliku:\s*/i.test(raw)) {
      human = "Nazwa pliku „" + raw.replace(/^nazwa pliku:\s*/i, "") + "”.";
    } else if (/^tekst z grafiki:\s*/i.test(raw)) {
      human = "Na grafice widać napis „" + raw.replace(/^tekst z grafiki:\s*/i, "") + "”.";
    }
    if (!human && extras.length) {
      human = extras.join("; ") + ".";
    } else if (
      extras.length &&
      human.indexOf("W folderze") === -1 &&
      human.indexOf("Oznaczone tagiem") === -1 &&
      group !== "3"
    ) {
      var extraJoin = extras.join("; ");
      if (human.indexOf(extraJoin) === -1) {
        human = human.replace(/\.*\s*$/, "") + ". " + extraJoin.charAt(0).toUpperCase() + extraJoin.slice(1) + ".";
      }
    }
    if (hit.is_copy) {
      human = (human ? human.replace(/\.*\s*$/, "") + " " : "") + "To kopia folderu (folder kończy się na -kopia).";
    }
    return human.trim();
  }

  function semanticBuildVocab(raw) {
    var stop = {};
    var aliasToIds = {};
    var byId = {};
    var maxN = 1;
    (raw.stopwords || []).forEach(function (w) {
      var f = semanticFold(w);
      if (f) stop[f] = true;
    });
    (raw.concepts || []).forEach(function (item) {
      var cid = String(item.id || "").trim();
      if (!cid) return;
      byId[cid] = item;
      (item.aliases || []).forEach(function (alias) {
        var folded = semanticCollapse(semanticFold(alias));
        if (!folded) return;
        if (!aliasToIds[folded]) aliasToIds[folded] = [];
        if (aliasToIds[folded].indexOf(cid) === -1) aliasToIds[folded].push(cid);
        var n = folded.split(" ").length;
        if (n > maxN) maxN = n;
      });
    });
    return { stop: stop, aliasToIds: aliasToIds, byId: byId, maxN: maxN };
  }

  function semanticLoadVocab() {
    if (semanticVocab) return Promise.resolve(semanticVocab);
    return fetch("data/semantic-vocabulary.json")
      .then(function (r) {
        if (!r.ok) throw new Error("vocab_" + r.status);
        return r.json();
      })
      .then(function (raw) {
        semanticVocab = semanticBuildVocab(raw);
        return semanticVocab;
      })
      .catch(function () {
        semanticVocab = semanticBuildVocab({ concepts: [], stopwords: [] });
        return semanticVocab;
      });
  }

  function semanticMatchAliases(tokens, vocab) {
    var hits = {};
    var i = 0;
    var n = tokens.length;
    while (i < n) {
      var matchedN = 0;
      var size;
      for (size = Math.min(vocab.maxN, n - i); size >= 1; size--) {
        var span = tokens.slice(i, i + size).join(" ");
        var ids = vocab.aliasToIds[span];
        if (ids && ids.length) {
          ids.forEach(function (cid) {
            if (!hits[cid]) hits[cid] = span;
          });
          matchedN = size;
          break;
        }
      }
      i += matchedN || 1;
    }
    return hits;
  }

  function semanticQueryConcepts(query) {
    if (!semanticVocab) return [];
    var tokens = semanticTokens(query).filter(function (t) {
      return !semanticVocab.stop[t];
    });
    return Object.keys(semanticMatchAliases(tokens, semanticVocab));
  }

  function semanticCampaign(path) {
    var raw = String(path || "").replace(/\\/g, "/");
    var m = raw.match(/08\s*-\s*KAMAPANIE\/+(\d{4})\/+([^/]+)/i);
    if (!m) return { key: "", label: "" };
    var label = m[1] + "/" + m[2];
    return { key: semanticFold(label), label: label };
  }

  function semanticLeaf(path) {
    var raw = String(path || "").replace(/\\/g, "/").replace(/\/+$/, "");
    var i = raw.lastIndexOf("/");
    return i === -1 ? raw : raw.slice(0, i);
  }

  function semanticShoots(name) {
    var folded = semanticCollapse(semanticFold(name));
    var re = /(?:^|[^a-z0-9])(bsa\s+\d+)(?![a-z0-9])/g;
    var out = [];
    var m;
    while ((m = re.exec(folded))) {
      var key = semanticCollapse(m[1]);
      if (key && out.indexOf(key) === -1) out.push(key);
    }
    return out;
  }

  function semanticFileConcepts(asset, vocab) {
    var found = {};
    function add(cid, source, via) {
      if (!cid || found[cid]) return;
      found[cid] = { source: source, via: via };
    }
    var parent = semanticLeaf(asset.path || "");
    var pathHits = semanticMatchAliases(semanticTokens(parent), vocab);
    Object.keys(pathHits).forEach(function (cid) {
      add(cid, "path", pathHits[cid]);
    });
    var pathProducts = {};
    Object.keys(found).forEach(function (cid) {
      if (cid.indexOf("product:") === 0) pathProducts[cid] = true;
    });
    var tags = (asset.appearance_tags || []).concat(asset.tags || []);
    var tagHits = semanticMatchAliases(semanticTokens(tags.join(" ")), vocab);
    Object.keys(tagHits).forEach(function (cid) {
      add(cid, "association", "tag:" + tagHits[cid]);
    });
    (asset.linked_product_ids || []).forEach(function (pid) {
      var p = productById(pid);
      if (!p) return;
      var blob = semanticFold(p.category || p.category_title || "");
      var cids = [];
      if (blob.indexOf("chrupkulk") !== -1) cids.push("product:chrupkulki");
      else {
        if (blob.indexOf("kulki") !== -1 || blob.indexOf("balls") !== -1) cids.push("product:kulki");
        if (blob.indexOf("baton") !== -1 || blob.indexOf("bars") !== -1) cids.push("product:batony");
        if (blob.indexOf("roslinn") !== -1 || blob.indexOf("plant") !== -1) {
          cids.push("product:roslinne");
          cids.push("product:niemieso");
        }
        if (blob.indexOf("niemies") !== -1) cids.push("product:niemieso");
        if (blob.indexOf("sypkie") !== -1) cids.push("product:sypkie");
        if (blob.indexOf("napoj") !== -1) cids.push("product:napoje");
        if (blob.indexOf("przetwor") !== -1) cids.push("product:przetwory");
        if (blob.indexOf("dates") !== -1) cids.push("product:datesy");
      }
      cids.forEach(function (cid) {
        if (cid.indexOf("product:") === 0 && Object.keys(pathProducts).length && !pathProducts[cid]) return;
        add(cid, "association", "product:" + pid);
      });
    });
    var ocr = String(asset.ocr_text || "");
    if (!ocr && semanticRecognition) {
      var rec = semanticRecognition[asset.id] || semanticRecognition[semanticDigitsKey(asset.id)];
      ocr = String((rec && rec.ocr_text) || "");
    }
    if (ocr) {
      var ocrHits = semanticMatchAliases(semanticTokens(ocr), vocab);
      Object.keys(ocrHits).forEach(function (cid) {
        add(cid, "ocr", ocrHits[cid]);
      });
    }
    var nameHits = semanticMatchAliases(semanticTokens(asset.name || ""), vocab);
    Object.keys(nameHits).forEach(function (cid) {
      add(cid, "filename", nameHits[cid]);
    });
    return found;
  }

  function semanticQueryMatched(cid, fileCids, vocab) {
    if (fileCids[cid]) return true;
    var rec = (vocab.byId || {})[cid] || {};
    var alts = rec.query_satisfied_by || [];
    var i;
    for (i = 0; i < alts.length; i++) {
      if (fileCids[alts[i]]) return true;
    }
    return false;
  }

  function semanticPrepare(assets) {
    if (!semanticVocab || !assets) return null;
    var sig = String(assets.length) + ":" + ((assets[0] && assets[0].id) || "");
    if (semanticPrepared && semanticPrepareSig === sig) return semanticPrepared;
    var rows = [];
    var shootProducts = {};
    assets.forEach(function (a) {
      var camp = semanticCampaign(a.path || "");
      var rec = {
        asset: a,
        id: a.id || "",
        path: a.path || "",
        name: a.name || "",
        campaign_key: camp.key,
        campaign_label: camp.label,
        shoots: semanticShoots(a.name || ""),
        concepts: semanticFileConcepts(a, semanticVocab)
      };
      rows.push(rec);
      if (!rec.campaign_key) return;
      Object.keys(rec.concepts).forEach(function (cid) {
        if (cid.indexOf("product:") !== 0) return;
        var meta = rec.concepts[cid];
        var via = String(meta.via || "");
        if (meta.source !== "path" && meta.source !== "ocr" && !(meta.source === "association" && via.indexOf("tag:") === 0)) {
          return;
        }
        rec.shoots.forEach(function (shoot) {
          var key = rec.campaign_key + "|" + shoot;
          if (!shootProducts[key]) shootProducts[key] = {};
          if (!shootProducts[key][cid]) shootProducts[key][cid] = rec.name || rec.path;
        });
      });
    });
    rows.forEach(function (rec) {
      if (!rec.campaign_key) return;
      rec.shoots.forEach(function (shoot) {
        var inherited = shootProducts[rec.campaign_key + "|" + shoot] || {};
        Object.keys(inherited).forEach(function (cid) {
          if (!rec.concepts[cid]) {
            rec.concepts[cid] = { source: "shoot", via: shoot + " / " + inherited[cid] };
          }
        });
      });
    });
    semanticPrepared = { rows: rows, byId: {} };
    rows.forEach(function (rec) {
      if (rec.id) semanticPrepared.byId[rec.id] = rec;
    });
    semanticPrepareSig = sig;
    return semanticPrepared;
  }

  function semanticRun(query, limit) {
    var q = String(query || "");
    var concepts = semanticQueryConcepts(q);
    var productNeeded = [];
    concepts.forEach(function (c) {
      if (c.indexOf("product:") === 0) productNeeded.push(c);
    });
    if (!concepts.length || !semanticPrepared) {
      return { query: q, concepts: concepts, strict: [], associated: [], byId: {} };
    }
    var cap = limit || 200;
    var vocab = semanticVocab;
    var strict = [];
    semanticPrepared.rows.forEach(function (rec) {
      var fileCids = rec.concepts;
      var ok;
      if (productNeeded.length) {
        ok = productNeeded.every(function (cid) {
          return semanticQueryMatched(cid, fileCids, vocab);
        });
      } else {
        ok = concepts.some(function (cid) {
          return semanticQueryMatched(cid, fileCids, vocab);
        });
      }
      if (!ok) return;
      var matched = concepts.filter(function (cid) {
        return semanticQueryMatched(cid, fileCids, vocab);
      });
      strict.push({ rec: rec, matched: matched, score: matched.length });
    });
    strict.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.rec.name || "").localeCompare(String(b.rec.name || ""), "pl");
    });
    strict = strict.slice(0, cap);
    var strictIds = {};
    var camps = {};
    var preferred = [];
    strict.forEach(function (row) {
      if (row.rec.id) strictIds[row.rec.id] = true;
      var k = recCampaign(row);
      if (k && !camps[k]) {
        preferred.push(k);
        camps[k] = row.rec.campaign_label || k;
      }
    });
    function recCampaign(row) {
      return row.rec.campaign_key || "";
    }
    var campRank = {};
    preferred.forEach(function (k, i) {
      campRank[k] = i;
    });
    var associated = [];
    if (productNeeded.length && preferred.length) {
      semanticPrepared.rows.forEach(function (rec) {
        if (strictIds[rec.id]) return;
        if (!camps[rec.campaign_key]) return;
        var fileCids = rec.concepts;
        var hasAll = productNeeded.every(function (cid) {
          return semanticQueryMatched(cid, fileCids, vocab);
        });
        if (hasAll) return;
        var matched = concepts.filter(function (cid) {
          return semanticQueryMatched(cid, fileCids, vocab);
        });
        associated.push({
          rec: rec,
          matched: matched,
          score: matched.length,
          reason: "kampania " + (camps[rec.campaign_key] || rec.campaign_key)
        });
      });
      associated.sort(function (a, b) {
        var ra = campRank[a.rec.campaign_key];
        var rb = campRank[b.rec.campaign_key];
        if (ra == null) ra = 999;
        if (rb == null) rb = 999;
        if (ra !== rb) return ra - rb;
        if (b.score !== a.score) return b.score - a.score;
        return String(a.rec.name || "").localeCompare(String(b.rec.name || ""), "pl");
      });
      associated = associated.slice(0, cap);
    }
    var byId = {};
    var order = [];
    strict.forEach(function (row, i) {
      byId[row.rec.id] = { group: "strict", score: row.score, rank: i };
      order.push(row.rec.asset);
    });
    associated.forEach(function (row, i) {
      byId[row.rec.id] = {
        group: "associated",
        score: row.score,
        rank: 10000 + i,
        reason: row.reason
      };
      order.push(row.rec.asset);
    });
    return {
      query: q,
      concepts: concepts,
      strict: strict,
      associated: associated,
      byId: byId,
      order: order
    };
  }

  var semanticLast = null;
  var semanticLastQ = "";

  function semanticEnsureRun(q) {
    if (!semanticVocab || !semanticPrepared) return null;
    if (semanticLast && semanticLastQ === q) return semanticLast;
    semanticLast = semanticRun(q, 200);
    semanticLastQ = q;
    return semanticLast;
  }

  function load(opts) {
    return loadIndexes(opts || {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      semanticLoadVocab();
      semanticLoadRecognition();
    });
  } else {
    semanticLoadVocab();
    semanticLoadRecognition();
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
    descriptionsEnabled: descriptionsEnabled,
    setDescriptionsEnabled: setDescriptionsEnabled,
    productById: productById,
    parseJsonInWorker: parseJsonInWorker,
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
    suggestIndexes: suggestIndexes,
    semanticLoadVocab: semanticLoadVocab,
    semanticPrepare: function (assets) {
      if (!semanticVocab) return null;
      semanticLast = null;
      semanticLastQ = "";
      return semanticPrepare(assets);
    },
    semanticQueryHasConcepts: function (q) {
      return semanticQueryConcepts(q).length > 0;
    },
    semanticQueryConcepts: semanticQueryConcepts,
    semanticAssetInResults: function (a, q) {
      var run = semanticEnsureRun(q);
      if (!run || !run.concepts.length) return false;
      var id = a && a.id;
      return !!(id && run.byId[id]);
    },
    semanticOrderAssets: function (list, q) {
      var run = semanticEnsureRun(q);
      if (!run) return list;
      var rankOf = function (a) {
        var row = run.byId[a && a.id];
        return row ? row.rank : 999999;
      };
      return list.slice().sort(function (a, b) {
        return rankOf(a) - rankOf(b);
      });
    },
    semanticSearch: function (query, assets, limit) {
      if (assets) semanticPrepare(assets);
      return semanticRun(query, limit || 200);
    },
    formatSemanticReason: formatSemanticReason,
    collapseCopyHits: collapseCopyHits,
    semanticLoadRecognition: semanticLoadRecognition
  };
})();
