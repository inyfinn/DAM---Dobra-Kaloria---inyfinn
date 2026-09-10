/**
 * DAM - wspólny pasek tagow skojarzen (Smak / Typ / Opakowanie / Autor).
 * Wszystkie kategorie widoczne od razu. Gdy w kategorii > ROW_LIMIT tagow:
 * pierwsze N widoczne, "rozwin" dla TEJ kategorii rozwija wiersz w dol
 * i przesuwa reszte UI nizej (bez globalnego przycinania).
 *
 * Casing: globalnie przez DamLabels.formatTagLabel (tagi sa globalne).
 */
(function () {
  "use strict";

  var ROW_LIMIT = 8;
  var GROUP_ORDER = ["smak", "typ", "opakowanie", "autor", "osoba"];
  var GROUP_LABELS = {
    smak: "Smak",
    typ: "Typ",
    opakowanie: "Opakowanie",
    autor: "Autor",
    osoba: "Autor",
  };
  var GROUP_CLASS = {
    smak: "dam-tag-group--smak",
    typ: "dam-tag-group--typ",
    opakowanie: "dam-tag-group--opakowanie",
    autor: "dam-tag-group--autor",
    osoba: "dam-tag-group--autor",
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tagLabel(t, groupKey) {
    var key = String(t || "");
    var kind = groupKey === "opakowanie" ? "opakowanie" : groupKey === "typ" ? "typ" : groupKey === "smak" ? "smak" : "autor";
    if (window.DamLabels && typeof window.DamLabels.formatTagLabel === "function") {
      return window.DamLabels.formatTagLabel(key, kind);
    }
    return key;
  }

  function fetchTagGroups(cb) {
    var bust =
      (typeof window !== "undefined" && window.DAM_APP_VERSION) || "1";
    fetch("data/search-index.json?v=" + encodeURIComponent(bust))
      .then(function (r) {
        if (!r.ok) return {};
        return r.text().then(function (text) {
          if (
            window.DamSearch &&
            typeof window.DamSearch.parseJsonInWorker === "function"
          ) {
            return window.DamSearch.parseJsonInWorker(text, "search-index", 8000);
          }
          return JSON.parse(text);
        });
      })
      .then(function (si) {
        window._DAM_SEARCH_INDEX = si || {};
        cb((si && si.tag_groups) || {});
      })
      .catch(function () {
        cb({});
      });
  }

  function loadTagGroups(cb) {
    /* Tag bar laduje search-index sam - nie blokuj na DamSearch.load */
    if (window._DAM_SEARCH_INDEX && window._DAM_SEARCH_INDEX.tag_groups) {
      var tg = window._DAM_SEARCH_INDEX.tag_groups;
      if (tg.typ && tg.typ.length) {
        cb(tg);
        return;
      }
    }
    fetchTagGroups(cb);
  }

  function buildGroupRow(spec) {
    spec = spec || {};
    var gk = spec.groupKey || "group";
    var chips = spec.chips || [];
    if (!chips.length) return "";
    var rowLimit = spec.rowLimit == null ? ROW_LIMIT : spec.rowLimit;
    var expandedGroups = spec.expandedGroups || {};
    var isLong = chips.length > rowLimit;
    var isOpen = !!expandedGroups[gk];
    var visible = isLong && !isOpen ? chips.slice(0, rowLimit) : chips;
    var hiddenCount = isLong && !isOpen ? chips.length - rowLimit : 0;
    var label = spec.label || gk;
    var className = spec.className || "";
    var html =
      '<div class="dam-tag-group-row ' +
      className +
      (isLong ? " dam-tag-group-row--long" : "") +
      (isOpen ? " is-expanded" : "") +
      '" data-group="' +
      esc(gk) +
      '">' +
      '<span class="dam-tag-group-label">' +
      esc(label) +
      ":</span>" +
      '<span class="dam-tag-group-pills">';
    visible.forEach(function (chip) {
      var active = spec.activeMap && spec.activeMap[chip.key];
      if (typeof spec.pillHtml === "function") {
        html += spec.pillHtml(chip, !!active);
      } else {
        html +=
          '<button type="button" class="dam-tag-pill" data-tag="' +
          esc(chip.key) +
          '" title="' +
          esc(chip.label) +
          '">' +
          esc(chip.label) +
          "</button>";
      }
    });
    if (isLong) {
      if (!isOpen) {
        html +=
          '<button type="button" class="dam-tag-more" data-expand-group="' +
          esc(gk) +
          '" aria-expanded="false" title="Pokaz wszystkie tagi w kategorii ' +
          esc(label) +
          '">+' +
          hiddenCount +
          "</button>";
      } else {
        html +=
          '<button type="button" class="dam-tag-more" data-expand-group="' +
          esc(gk) +
          '" aria-expanded="true" title="Zwin liste tagow">mniej</button>';
      }
    }
    html += "</span></div>";
    return html;
  }

  function bind(opts) {
    var tagsEl = typeof opts.tagsEl === "string" ? document.getElementById(opts.tagsEl) : opts.tagsEl;
    var inputEl = typeof opts.inputEl === "string" ? document.getElementById(opts.inputEl) : opts.inputEl;
    if (!tagsEl) return;

    /* Idempotent: drugi bind = refresh, bez podwojnych listenerow */
    if (tagsEl._damTagBarApi && typeof tagsEl._damTagBarApi.refresh === "function") {
      tagsEl._damTagBarApi.refresh();
      return tagsEl._damTagBarApi;
    }

    var state = { groups: {}, expandedGroups: {} };

    function applyQuery(tag, append) {
      if (!inputEl) return;
      var token = String(tag || "").trim();
      if (!token) return;
      if (append) {
        var cur = String(inputEl.value || "").trim();
        var parts = cur ? cur.split(/\s+/).filter(Boolean) : [];
        var lower = parts.map(function (p) {
          return p.toLowerCase();
        });
        token.split(/\s+/).forEach(function (part) {
          if (!part) return;
          if (lower.indexOf(part.toLowerCase()) === -1) {
            parts.push(part);
            lower.push(part.toLowerCase());
          }
        });
        inputEl.value = parts.join(" ");
      } else {
        inputEl.value = token;
      }
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
      inputEl.focus();
      if (typeof opts.onTag === "function") opts.onTag(token);
    }

    function render() {
      var groups = state.groups || {};
      var seenAutor = false;
      var html = '<div class="dam-tag-groups__inner">';
      GROUP_ORDER.forEach(function (gk) {
        if (gk === "osoba" && seenAutor) return;
        if (gk === "autor" || gk === "osoba") seenAutor = true;
        var tags = groups[gk] || [];
        if (!tags.length) return;
        var label = GROUP_LABELS[gk] || gk;
        var isLong = tags.length > ROW_LIMIT;
        var isOpen = !!state.expandedGroups[gk];
        var visible = isLong && !isOpen ? tags.slice(0, ROW_LIMIT) : tags;
        var hiddenCount = isLong && !isOpen ? tags.length - ROW_LIMIT : 0;

        html +=
          '<div class="dam-tag-group-row ' +
          (GROUP_CLASS[gk] || "") +
          (isLong ? " dam-tag-group-row--long" : "") +
          (isOpen ? " is-expanded" : "") +
          '" data-group="' +
          esc(gk) +
          '">' +
          '<span class="dam-tag-group-label">' +
          esc(label) +
          ":</span>" +
          '<span class="dam-tag-group-pills">';

        visible.forEach(function (t) {
          var display = tagLabel(t, gk);
          html +=
            '<button type="button" class="dam-tag-pill" data-tag="' +
            esc(t) +
            '" title="' +
            esc(display) +
            '">' +
            esc(display) +
            "</button>";
        });

        if (isLong) {
          if (!isOpen) {
            html +=
              '<button type="button" class="dam-tag-more" data-expand-group="' +
              esc(gk) +
              '" aria-expanded="false" title="Pokaz wszystkie tagi w kategorii ' +
              esc(label) +
              '">+' +
              hiddenCount +
              "</button>";
          } else {
            html +=
              '<button type="button" class="dam-tag-more" data-expand-group="' +
              esc(gk) +
              '" aria-expanded="true" title="Zwin liste tagow">mniej</button>';
          }
        }

        html += "</span></div>";
      });
      html += "</div>";

      tagsEl.innerHTML = html;
      tagsEl.className = "dam-tag-groups";

      tagsEl.querySelectorAll(".dam-tag-pill").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          if (typeof opts.onPillClick === "function") {
            var handled = opts.onPillClick(this, e);
            if (handled) return;
          }
          applyQuery(this.getAttribute("data-tag") || "", !!(e.ctrlKey || e.metaKey));
        });
      });

      tagsEl.querySelectorAll("[data-expand-group]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var g = this.getAttribute("data-expand-group");
          if (!g) return;
          state.expandedGroups[g] = !state.expandedGroups[g];
          render();
        });
      });

      if (typeof opts.afterRender === "function") {
        opts.afterRender(tagsEl, state);
      }
    }

    loadTagGroups(function (groups) {
      state.groups = groups || {};
      state.expandedGroups = {};
      render();
    });

    var api = {
      refresh: function () {
        loadTagGroups(function (groups) {
          state.groups = groups || {};
          render();
        });
      },
      destroy: function () {
        tagsEl._damTagBarApi = null;
        tagsEl.innerHTML = "";
      },
    };
    tagsEl._damTagBarApi = api;
    return api;
  }

  /* Cold-load: sam montuje #damSearchTags (nie czekaj na ciezkie init Explorera).
     HARD: na explorer.html NIE — 3× fetch search-index (~491 KB) + Worker clone
     blokuje first paint drzewa (puste Kategorie + „Ładowanie indeksu...”). */
  function pageIsExplorer() {
    try {
      return /explorer\.html/i.test(String((location && location.pathname) || ""));
    } catch (_eExp) {
      return false;
    }
  }
  function autoMount() {
    if (pageIsExplorer()) return;
    var el = document.getElementById("damSearchTags");
    if (!el) return;
    if (el.querySelector(".dam-tag-pill")) return;
    bind({
      tagsEl: el,
      inputEl: document.getElementById("damFileSearch") || "damFileSearch",
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }
  setTimeout(autoMount, 120);
  setTimeout(autoMount, 700);

  window.DamTagBar = { bind: bind, ROW_LIMIT: ROW_LIMIT, buildGroupRow: buildGroupRow, autoMount: autoMount };
})();
