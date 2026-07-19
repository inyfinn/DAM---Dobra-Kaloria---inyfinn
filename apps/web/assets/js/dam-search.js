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

  function loadIndexes() {
    if (searchIndex && fileIndex) return Promise.resolve({ searchIndex: searchIndex, fileIndex: fileIndex });
    if (loading) return loading;
    var bust = Date.now();
    loading = Promise.all([
      fetch("data/search-index.json?v=20260717ux3&_=" + bust).then(function (r) {
        if (!r.ok) throw new Error("search-index.json");
        return r.json();
      }),
      fetch("data/file-index.json?v=20260717ux3&_=" + bust).then(function (r) {
        if (!r.ok) throw new Error("file-index.json");
        return r.json();
      })
    ]).then(function (pair) {
      searchIndex = pair[0];
      fileIndex = pair[1];
      window._DAM_SEARCH_INDEX = searchIndex;
      window._DAM_FILE_INDEX = fileIndex;
      loading = null;
      return { searchIndex: searchIndex, fileIndex: fileIndex };
    }).catch(function (e) {
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

  function revisionMatchesQuery(rev, nq, dig) {
    if (!rev) return false;
    var blob = norm(
      [rev.index, rev.name, rev.folder, rev.path, rev.carrier, (rev.tags || []).join(" ")].join(" ")
    );
    if (nq && blob.indexOf(nq) !== -1) return true;
    if (dig && dig.length >= 3) {
      var idxDig = digitsOnly(rev.index || "");
      if (idxDig && (idxDig.indexOf(dig) === 0 || dig.indexOf(idxDig) === 0)) return true;
    }
    return false;
  }

  function buildStructuredHits(products, nq, dig, scope) {
    var hits = [];
    (products || []).forEach(function (p) {
      if (!p) return;
      var pname = norm(p.display_name || p.name || "");
      var pblob = norm(
        [p.display_name, p.name, p.category, (p.indexes || []).join(" "), (p.tags || []).join(" ")].join(" ")
      );
      var productMatch =
        !nq ||
        pname.indexOf(nq) !== -1 ||
        pblob.indexOf(nq) !== -1 ||
        (dig && dig.length >= 3 && (p.indexes || []).some(function (ix) {
          var d = digitsOnly(ix);
          return d.indexOf(dig) === 0 || dig.indexOf(d) === 0 || String(ix).toLowerCase().indexOf(nq) !== -1;
        }));
      var matchingRevs = (p.revisions || []).filter(function (r) {
        return revisionMatchesQuery(r, nq, dig);
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
    return hits;
  }

  function search(query, opts) {
    opts = opts || {};
    var q = String(query || "").trim();
    var scope = opts.scope ? Object.assign({}, getScope(), opts.scope) : getScope();
    if (!q) {
      return Promise.resolve({
        query: q,
        mode: "empty",
        products: [],
        hits: [],
        scope: scope,
        suggestions: [],
        message: null,
        tags: (searchIndex && searchIndex.by_tag) ? Object.keys(searchIndex.by_tag).slice(0, 40) : []
      });
    }

    return loadIndexes().then(function () {
      var dig = digitsOnly(q);
      var nq = norm(q);
      var productIds = [];
      var mode = "text";
      var message = null;
      var suggestions = [];

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
          // partial tag
          Object.keys(searchIndex.by_tag || {}).forEach(function (tag) {
            if (tag.indexOf(nq) !== -1 || nq.indexOf(tag) !== -1) {
              (searchIndex.by_tag[tag] || []).forEach(function (id) { productIds.push(id); });
            }
          });
          productIds = unique(productIds);
          if (!productIds.length) {
            // blob search
            (searchIndex.entries || []).forEach(function (e) {
              if ((e.search_blob || "").indexOf(nq) !== -1) productIds.push(e.id);
            });
            productIds = unique(productIds);
            mode = "text";
          } else {
            mode = "tag";
          }
        }
      }

      /* Dolacz produkty, ktorych wariant pasuje do query (nawet gdy blob produktu nie) */
      if (nq && fileIndex && fileIndex.products) {
        fileIndex.products.forEach(function (p) {
          if (!p || productIds.indexOf(p.id) !== -1) return;
          var anyRev = (p.revisions || []).some(function (r) {
            return revisionMatchesQuery(r, nq, dig);
          });
          if (anyRev) productIds.push(p.id);
        });
        productIds = unique(productIds);
      }

      var products = productIds.map(productById).filter(Boolean);
      if (opts.limit) products = products.slice(0, opts.limit);
      var hits = buildStructuredHits(products, nq, dig, scope);

      return {
        query: q,
        mode: mode,
        products: products,
        hits: hits,
        scope: scope,
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

  function latestRevisions(product) {
    if (!product) return [];
    var latest = (product.revisions || []).filter(function (r) { return r.is_latest; });
    if (latest.length) return latest;
    return product.revisions || [];
  }

  /**
   * Radio + odklik:
   * - domyslnie Wszystko
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

    function paint() {
      var mode = locked ? "all" : getScopeMode();
      var disAttr = locked ? ' disabled aria-disabled="true"' : "";
      var disCls = locked ? " is-disabled" : "";
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
    }
    paint();
  }

  function bindSearchBox(inputEl, resultsEl, onSelect, scopeEl, opts) {
    if (!inputEl) return;
    opts = opts || {};
    var timer = null;
    function runSearch() {
      var q = inputEl.value;
      return search(q, { limit: 30 }).then(render).catch(function (err) {
        resultsEl.innerHTML = '<div class="dam-search-msg">Blad indeksu: ' + escapeHtml(err.message) + "</div>";
        resultsEl.style.display = "block";
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
        html += '<ul class="dam-search-hits">';
        hits.slice(0, 40).forEach(function (h) {
          var p = h.product || {};
          var r = h.revision;
          var cls = "dam-search-hit dam-search-hit--" + (h.kind || "product");
          if (h.nested) cls += " dam-search-hit--nested";
          var badge = h.kind === "variant" ? "Wariant" : "Produkt";
          var focusIdx = r && r.index ? r.index : "";
          html +=
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
            escapeHtml(h.label || "") +
            "</span>" +
            '<span class="dam-search-meta">' +
            escapeHtml(h.meta || "") +
            (h.kind === "product" && h.childCount
              ? " · " + h.childCount + " dopas. wariant" + (h.childCount === 1 ? "" : "y")
              : "") +
            "</span></a></li>";
        });
        html += "</ul>";
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
      resultsEl.querySelectorAll("a[data-pid]").forEach(function (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          var pid = this.getAttribute("data-pid");
          var sug = this.getAttribute("data-suggest");
          if (sug) inputEl.value = sug;
          var prod = productById(pid);
          if (onSelect) onSelect(prod, sug || null);
          resultsEl.style.display = "none";
        });
      });
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

  window.DamSearch = {
    load: loadIndexes,
    reload: reload,
    search: search,
    bindSearchBox: bindSearchBox,
    bindScopeChips: bindScopeChips,
    getScope: getScope,
    setScope: setScope,
    getScopeMode: getScopeMode,
    setScopeMode: setScopeMode,
    productById: productById,
    latestRevisions: latestRevisions,
    suggestIndexes: suggestIndexes
  };
})();
