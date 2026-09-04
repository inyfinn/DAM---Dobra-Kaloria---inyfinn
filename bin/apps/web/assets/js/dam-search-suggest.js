/**
 * DAM - autouzupelnianie wyszukiwarek (prefix + synonimy + tagi z search-index).
 * Wpis "Dak" -> podpowiedz: datesy, daktyle, daktylowy.
 */
(function (global) {
  "use strict";

  var MIDDOT = "\u00B7";
  var attached = new WeakSet();
  var tagKeysCache = null;
  var tagKeysLoading = null;

  var PREFIX_HINTS = [
    { p: "dak", terms: ["datesy", "daktyle", "daktylowy"], note: "linia DATESY / daktyle" },
    { p: "dat", terms: ["datesy", "date", "daktylowy"], note: "datesy" },
    { p: "bur", terms: ["burger"], note: "burger" },
    { p: "pro", terms: ["proteina"], note: "proteina" },
    { p: "czek", terms: ["czekolada"], note: "czekolada" },
    { p: "karm", terms: ["karmel"], note: "karmel" },
    { p: "mal", terms: ["malina", "malinowa"], note: "malina" },
    { p: "ban", terms: ["banoffee"], note: "banoffee" },
    { p: "kul", terms: ["kulki"], note: "kulki" },
    { p: "bat", terms: ["baton", "batoniki"], note: "baton" },
    { p: "doy", terms: ["doypack"], note: "doypack" },
    { p: "fol", terms: ["folia"], note: "folia" },
    { p: "mix", terms: ["mix", "mixy"], note: "mix" },
    { p: "niem", terms: ["niemiesne"], note: "niemiesa" },
    { p: "szny", terms: ["sznyce"], note: "sznycel" },
    { p: "miel", terms: ["mielone"], note: "mielone" },
    { p: "lem", terms: ["lemon cheesecake", "cytryna"], note: "lemon / cytryna" },
    { p: "cytr", terms: ["cytryna"], note: "cytryna" },
    { p: "porz", terms: ["porzeczka"], note: "porzeczka" },
    { p: "wan", terms: ["wanilia"], note: "wanilia" },
    { p: "tir", terms: ["tiramisu"], note: "tiramisu" },
    { p: "boost", terms: ["boost", "boosty"], note: "boost" },
    { p: "par", terms: ["parowka"], note: "parowka" },
    { p: "kie", terms: ["kielbaski"], note: "kielbaski" },
    { p: "gril", terms: ["grill"], note: "grill" },
    { p: "slid", terms: ["slider", "slidery"], note: "slider" },
    { p: "baner", terms: ["baner"], note: "baner" },
    { p: "630", terms: [], note: "indeks produktu" },
  ];

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureTagKeys() {
    if (tagKeysCache) return Promise.resolve(tagKeysCache);
    if (tagKeysLoading) return tagKeysLoading;
    if (global.DamSearch && typeof global.DamSearch.load === "function") {
      tagKeysLoading = global.DamSearch.load()
        .then(function (bundle) {
          var si = (bundle && bundle.searchIndex) || global._DAM_SEARCH_INDEX || {};
          tagKeysCache = Object.keys(si.by_tag || {}).filter(function (k) {
            return k && k.length >= 2 && !/[^\x00-\x7F]/.test(k);
          });
          tagKeysLoading = null;
          return tagKeysCache;
        })
        .catch(function () {
          tagKeysLoading = null;
          tagKeysCache = [];
          return tagKeysCache;
        });
      return tagKeysLoading;
    }
    tagKeysCache = [];
    return Promise.resolve(tagKeysCache);
  }

  function suggestionsFor(query, limit) {
    var q = norm(query);
    limit = limit || 8;
    if (q.length < 2) return Promise.resolve([]);
    var out = [];
    var seen = {};
    function add(term, note) {
      var key = norm(term);
      if (!key || seen[key] || key.length < 2) return;
      seen[key] = true;
      out.push({ term: term, note: note || "" });
    }

    PREFIX_HINTS.forEach(function (h) {
      if (q.indexOf(h.p) !== 0 && h.p.indexOf(q) !== 0) return;
      (h.terms || []).forEach(function (t) {
        add(t, h.note);
      });
    });

    return ensureTagKeys().then(function (keys) {
      keys.forEach(function (k) {
        if (out.length >= limit) return;
        var nk = norm(k);
        if (nk.indexOf(q) === 0 || (q.length >= 3 && nk.indexOf(q) >= 0)) add(k, "tag");
      });
      return out.slice(0, limit);
    });
  }

  function ensureSuggestCss() {
    if (document.getElementById("damSearchSuggestCss")) return;
    var st = document.createElement("style");
    st.id = "damSearchSuggestCss";
    st.textContent =
      ".dam-search-suggest-host{position:relative;}" +
      ".dam-search-suggest{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:12450;" +
      "margin:0;padding:6px 0;list-style:none;background:#fff;border:1px solid #ececf2;" +
      "border-radius:10px;box-shadow:0 12px 32px rgb(23 22 30 / 0.14);max-height:min(40dvh,280px);overflow:auto;}" +
      ".dam-search-suggest[hidden]{display:none!important;}" +
      ".dam-search-suggest__item{display:flex;align-items:center;justify-content:space-between;gap:10px;" +
      "width:100%;padding:8px 12px;border:0;background:transparent;text-align:left;cursor:pointer;font:inherit;}" +
      ".dam-search-suggest__item:hover,.dam-search-suggest__item.is-active{background:#f8f4fd;}" +
      ".dam-search-suggest__term{font-weight:600;color:#464255;}" +
      ".dam-search-suggest__note{font-size:11px;color:#8b8d97;white-space:nowrap;}";
    document.head.appendChild(st);
  }

  function attach(input, opts) {
    if (!input || attached.has(input)) return;
    attached.add(input);
    opts = opts || {};
    ensureSuggestCss();
    var host =
      input.closest(".dam-search-input-wrap") ||
      input.closest(".dam-search-wrap") ||
      input.parentElement;
    if (host && !host.classList.contains("dam-search-suggest-host")) {
      host.classList.add("dam-search-suggest-host");
    }
    if (host && host.classList.contains("dam-search-input-wrap") && !host._damFocusBound) {
      host._damFocusBound = true;
      host.addEventListener("mousedown", function (e) {
        if (e.button !== 0) return;
        if (e.target === input) return;
        if (e.target.closest && e.target.closest(".dam-search-clear")) return;
        e.preventDefault();
        input.focus({ preventScroll: true });
      });
    }
    var list = document.createElement("ul");
    list.className = "dam-search-suggest";
    list.setAttribute("role", "listbox");
    list.hidden = true;
    if (host) host.appendChild(list);
    else input.insertAdjacentElement("afterend", list);

    var active = -1;
    var items = [];
    var debounceTimer = null;

    function hide() {
      list.hidden = true;
      active = -1;
      items = [];
      list.innerHTML = "";
    }

    function paint() {
      if (!items.length) {
        hide();
        return;
      }
      list.hidden = false;
      list.innerHTML = items
        .map(function (it, i) {
          return (
            '<li role="presentation"><button type="button" class="dam-search-suggest__item' +
            (i === active ? " is-active" : "") +
            '" role="option" data-idx="' +
            i +
            '"><span class="dam-search-suggest__term">' +
            esc(it.term) +
            '</span><span class="dam-search-suggest__note">' +
            esc(it.note) +
            "</span></button></li>"
          );
        })
        .join("");
      list.querySelectorAll(".dam-search-suggest__item").forEach(function (btn) {
        btn.addEventListener("mousedown", function (e) {
          e.preventDefault();
        });
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.getAttribute("data-idx"), 10);
          var pick = items[idx];
          if (!pick) return;
          input.value = pick.term;
          hide();
          input.dispatchEvent(new Event("input", { bubbles: true }));
          if (typeof opts.onPick === "function") opts.onPick(pick.term);
          input.focus();
        });
      });
    }

    function refresh() {
      var q = input.value;
      suggestionsFor(q, opts.limit || 8).then(function (res) {
        if (norm(input.value) !== norm(q)) return;
        items = res;
        active = res.length ? 0 : -1;
        paint();
      });
    }

    input.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      var q = String(input.value || "").trim();
      if (q.length < 2) {
        hide();
        return;
      }
      debounceTimer = setTimeout(refresh, 120);
    });

    input.addEventListener("keydown", function (e) {
      if (list.hidden || !items.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        active = Math.min(items.length - 1, active + 1);
        paint();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        active = Math.max(0, active - 1);
        paint();
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        input.value = items[active].term;
        hide();
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (e.key === "Escape") {
        hide();
      }
    });

    input.addEventListener("blur", function () {
      setTimeout(hide, 150);
    });
  }

  function attachAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(
      "#damFileSearch,#damBrandingSearch,#damTagEditSearch,#damAssocEditSearch,.dam-search-input"
    ).forEach(function (el) {
      attach(el);
    });
  }

  global.DamSearchSuggest = {
    attach: attach,
    attachAll: attachAll,
    suggestionsFor: suggestionsFor,
    MIDDOT: MIDDOT,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      attachAll(document);
    });
  } else {
    attachAll(document);
  }
})(typeof window !== "undefined" ? window : globalThis);
