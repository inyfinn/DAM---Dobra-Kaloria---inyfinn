/**
 * DAM ETA - Ajax search over search-index.json + file-index.json
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

  function search(query, opts) {
    opts = opts || {};
    var q = String(query || "").trim();
    if (!q) {
      return Promise.resolve({
        query: q,
        mode: "empty",
        products: [],
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
        var tagHits = (searchIndex.by_tag && searchIndex.by_tag[nq]) || [];
        if (tagHits.length) {
          mode = "tag";
          productIds = tagHits.slice();
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

      var products = productIds.map(productById).filter(Boolean);
      if (opts.limit) products = products.slice(0, opts.limit);

      return {
        query: q,
        mode: mode,
        products: products,
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

  function bindSearchBox(inputEl, resultsEl, onSelect) {
    if (!inputEl) return;
    var timer = null;
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
      if (res.products && res.products.length) {
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
      var q = inputEl.value;
      clearTimeout(timer);
      timer = setTimeout(function () {
        search(q, { limit: 30 }).then(render).catch(function (err) {
          resultsEl.innerHTML = '<div class="dam-search-msg">Blad indeksu: ' + escapeHtml(err.message) + "</div>";
          resultsEl.style.display = "block";
        });
      }, 120);
    });

    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        resultsEl.style.display = "none";
      }
    });

    document.addEventListener("click", function (e) {
      if (!resultsEl.contains(e.target) && e.target !== inputEl) {
        resultsEl.style.display = "none";
      }
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
    productById: productById,
    latestRevisions: latestRevisions,
    suggestIndexes: suggestIndexes
  };
})();
