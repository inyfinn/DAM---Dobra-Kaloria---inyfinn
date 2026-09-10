# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPLORER = ROOT / "assets" / "js" / "dam-explorer.js"
VIZ = ROOT / "assets" / "js" / "dam-viz.js"
TAG = ROOT / "assets" / "js" / "dam-tag-edit.js"
PL = ROOT / "i18n" / "pl.json"
VERSION = ROOT / "assets" / "js" / "dam-version.js"
BRAND_CSS = ROOT / "assets" / "css" / "dam-brand.css"
BRANDING_CSS = ROOT / "assets" / "css" / "dam-branding.css"

def patch_explorer(text: str) -> str:
    text = text.replace(
        "    if (!isAdminRole() || !state.adminMode) {\n"
        "      showToast(\"Włącz tryb admina, aby zmieniać statusy F/X/D\", \"error\");\n"
        "      return Promise.resolve({ ok: false });\n"
        "    }",
        "    if (!canWriteLifecycleStatus()) {\n"
        "      showToast(\"Brak uprawnień do zmiany statusów F/X/D (admin, power_user lub Graficy).\", \"error\");\n"
        "      return Promise.resolve({ ok: false });\n"
        "    }",
        1,
    )
    text = text.replace(
        "if (err === \"login_required\" || err === \"admin_required\" || res.http === 401 || res.http === 403) {",
        "if (\n"
        "            err === \"login_required\" ||\n"
        "            err === \"lifecycle_writer_required\" ||\n"
        "            err === \"admin_required\" ||\n"
        "            res.http === 401 ||\n"
        "            res.http === 403\n"
        "          ) {",
        1,
    )
    text = text.replace(
        "    var lifeHtml = state.adminMode\n"
        "      ? '<div class=\"dam-prod-row__lifecycle\" data-stop-nav=\"1\">' +",
        "    var lifeHtml = canWriteLifecycleStatus()\n"
        "      ? '<div class=\"dam-prod-row__lifecycle\" data-stop-nav=\"1\">' +",
        1,
    )
    if "function renderStatusFilterPanel" not in text:
        insert_before = "  function renderSearchResultsPanel(mount) {"
        block = r'''  function renderStatusEmptyCard(letter) {
    var isClear = letter === "-";
    var title = isClear
      ? i18nText("explorer.empty_status_clear_title", "Brak produktów bez statusu")
      : i18nText("explorer.empty_status_generic_title", "Brak produktów z tym statusem");
    var desc = isClear
      ? i18nText(
          "explorer.empty_status_clear_desc",
          "W bieżącym widoku wszystkie produkty mają literkę F, X lub D w nazwie folderu na dysku."
        )
      : i18nText(
          "explorer.empty_status_generic_desc",
          "Żaden produkt ani wariant w bieżącym widoku nie pasuje do wybranego filtra statusu."
        );
    var clearLbl = i18nText("branding.clear_filters", "Wyczyść filtry");
    return (
      '<div class="dam-branding-empty-wrap dam-branding-empty-wrap--status-only">' +
      '<div class="dam-branding-empty" role="status">' +
      '<div class="dam-branding-empty__icon" aria-hidden="true"><i class="uil uil-layer-group"></i></div>' +
      '<h3 class="dam-branding-empty__title">' + esc(title) + "</h3>" +
      '<p class="dam-branding-empty__desc">' + esc(desc) + "</p>" +
      '<ul class="dam-branding-empty__filters"><li>' + esc(statusFilterLabel(letter)) + "</li></ul>" +
      '<button type="button" class="geex-btn geex-btn--primary-transparent dam-empty-clear-btn dam-explorer-clear-status">' +
      esc(clearLbl) +
      "</button></div></div>"
    );
  }

  function renderStatusFilterPanel(mount) {
    var letter = state.statusLetterFilter;
    var products = productsForStatusLetterFilter(letter);
    var label = statusFilterLabel(letter);
    var html =
      '<div class="dam-explorer-panel">' +
      panelHeadHtml({
        icon: "uil-layer-group",
        kicker: i18nText("explorer.status_filter_kicker", "Filtr statusu"),
        title: label,
        meta:
          products.length +
          " " +
          (products.length === 1
            ? "trafiony produkt"
            : products.length >= 2 && products.length <= 4
              ? "trafione produkty"
              : "trafionych produktów")
      });
    if (!products.length) {
      html += renderStatusEmptyCard(letter) + "</div>";
    } else {
      html += '<div class="dam-prod-list">';
      products.forEach(function (p) {
        html += buildProductRowHtml(p);
      });
      html += "</div></div>";
    }
    mount.innerHTML = html;
    bindPanelNav(mount);
    bindProductRowClicks(mount);
    bindLifecycleControls(mount);
    var clearBtn = mount.querySelector(".dam-explorer-clear-status");
    if (clearBtn) {
      clearBtn.addEventListener("click", function (e) {
        e.preventDefault();
        clearStatusLetterFilter();
      });
    }
    if (window.DamTooltips && typeof window.DamTooltips.refresh === "function") {
      window.DamTooltips.refresh(mount);
    }
    revealExplorerModules(mount);
  }

'''
        text = text.replace(insert_before, block + insert_before, 1)

    old_main = """    /* Live search results in panel (AJAX) - zanim welcome / kategoria */
    if (!state.product && state.searchQuery && state.searchQuery.length >= 2 && state.searchHits) {
      renderSearchResultsPanel(mount);
      return;
    }"""
    new_main = """    /* Filtr statusu F/X/D/- (nie wyszukiwanie tekstowe) */
    if (!state.product && state.statusLetterFilter) {
      renderStatusFilterPanel(mount);
      return;
    }

    /* Live search results in panel (AJAX) - zanim welcome / kategoria */
    if (!state.product && state.searchQuery && state.searchQuery.length >= 2 && state.searchHits) {
      var statusFromQ = parseStatusLetterFromQuery(state.searchQuery);
      if (statusFromQ) {
        applyStatusLetterFilter(statusFromQ);
        return;
      }
      renderSearchResultsPanel(mount);
      return;
    }"""
    if old_main in text:
        text = text.replace(old_main, new_main, 1)

    old_search_empty = """      var emptyDesc = !state.showAllRevisions
        ? "Włącz Pokaż wszystkie, aby przeszukiwać też warianty z archiwum kategorii (- ARCHIWUM)."
        : "Brak trafień w indeksie. Kliknij Odśwież z dysku, aby zindeksować archiwum na dysku.";
      var emptyFilters = q
        ? '<ul class="dam-branding-empty__filters"><li>Szukaj: ' + esc(q) + "</li></ul>"
        : "";
      html +=
        '<div class="dam-branding-empty-wrap">' +
        '<div class="dam-empty-mascot-row" data-empty-mood="' +
        esc(emptyBundle.mood || "think") +
        '">' +
        '<div class="dam-empty-mascot-row__speak">' +
        '<div class="dam-empty-mascot-row__bubble">' +
        '<p class="dam-empty-mascot-row__bubble-text">' +
        esc(emptyBundle.text || "") +
        "</p>" +
        "</div>" +
        '<div class="dam-empty-mascot-row__mascot" aria-hidden="true" style="--dam-empty-pose:url(\'' +
        emptyPose +
        "')\">" +
        '<span class="dam-empty-mascot-row__mascot-img"></span>' +
        "</div>" +
        "</div>" +
        '<div class="dam-empty-mascot-row__card">' +
        '<div class="dam-branding-empty" role="status">' +
        '<div class="dam-branding-empty__icon" aria-hidden="true"><i class="uil uil-search-alt"></i></div>' +
        '<h3 class="dam-branding-empty__title">Brak wyników</h3>' +
        '<p class="dam-branding-empty__desc">' +
        esc(emptyDesc) +
        "</p>" +
        emptyFilters +
        '<button type="button" class="geex-btn geex-btn--primary-transparent dam-explorer-clear-filters">Wyczyść filtry</button>' +
        "</div>" +
        "</div>" +
        "</div>" +
        "</div></div>";"""

    if "parseStatusLetterFromQuery(qEarly)" not in text:
        text = text.replace(
            "  function renderSearchResultsPanel(mount) {\n"
            "    var res = filterSearchResponse(state.searchHits || {}) || {};",
            "  function renderSearchResultsPanel(mount) {\n"
            "    var qEarly = state.searchQuery || \"\";\n"
            "    var statusQ = parseStatusLetterFromQuery(qEarly);\n"
            "    if (statusQ) {\n"
            "      applyStatusLetterFilter(statusQ);\n"
            "      return;\n"
            "    }\n"
            "    var res = filterSearchResponse(state.searchHits || {}) || {};",
            1,
        )

    if "global.damExplorerApplyStatusLetterFilter" not in text:
        text = text.replace(
            "  window.DamExplorer = {",
            "  global.damExplorerApplyStatusLetterFilter = applyStatusLetterFilter;\n\n"
            "  window.DamExplorer = {",
            1,
        )

    if "loadGrafikGroup()" not in text.split("function bindExplorerData")[1][:800]:
        text = text.replace(
            "    bindSearchPanelSync(input);\n  }",
            "    bindSearchPanelSync(input);\n    loadGrafikGroup();\n  }",
            1,
        )

    text = text.replace(
        "  function clearSearchPanel() {\n"
        "    state.searchQuery = \"\";",
        "  function clearSearchPanel() {\n"
        "    state.statusLetterFilter = null;\n"
        "    state.searchQuery = \"\";",
        1,
    )
    text = text.replace(
        "    state.searchQuery = \"\";\n"
        "    state.searchHits = null;\n"
        "    var inp = document.getElementById(\"damFileSearch\");\n"
        "    if (inp) inp.value = \"\";\n"
        "    var searchDrop = document.getElementById(\"damSearchResults\");",
        "    state.statusLetterFilter = null;\n"
        "    state.searchQuery = \"\";\n"
        "    state.searchHits = null;\n"
        "    var inp = document.getElementById(\"damFileSearch\");\n"
        "    if (inp) inp.value = \"\";\n"
        "    var searchDrop = document.getElementById(\"damSearchResults\");",
        1,
    )
    return text


def patch_viz(text: str) -> str:
    if "var statusLetterFilter" not in text:
        text = text.replace(
            "  var showAll = false;",
            "  var showAll = false;\n  var statusLetterFilter = null;",
            1,
        )
    if "function i18nText" not in text:
        text = text.replace(
            "  var CARD_BASE_MIN_PX = 220;",
            "  var CARD_BASE_MIN_PX = 220;\n\n"
            "  function i18nText(key, fallback) {\n"
            "    if (window.DamI18n && typeof window.DamI18n.t === \"function\") {\n"
            "      var v = window.DamI18n.t(key);\n"
            "      if (v && v !== key) return v;\n"
            "    }\n"
            "    return fallback || key;\n"
            "  }\n\n"
            "  function rowStatusLetter(v) {\n"
            "    var nm = String((v && (v.revision_path || v.path)) || \"\").split(/[/\\\\]/).pop() || \"\";\n"
            "    var m = nm.match(/\\s-\\s([FXD])$/i);\n"
            "    return m ? m[1].toUpperCase() : \"-\";\n"
            "  }\n\n"
            "  function statusFilterLabelViz(letter) {\n"
            "    if (letter === \"-\") return i18nText(\"explorer.status_label_clear\", \"Bez statusu\");\n"
            "    if (letter === \"F\") return i18nText(\"explorer.status_label_f\", \"Aktualne (F)\");\n"
            "    if (letter === \"X\") return i18nText(\"explorer.status_label_x\", \"Nieaktualne (X)\");\n"
            "    if (letter === \"D\") return i18nText(\"explorer.status_label_d\", \"Demo (D)\");\n"
            "    return letter;\n"
            "  }\n\n"
            "  function applyStatusLetterFilterViz(letter) {\n"
            "    statusLetterFilter = letter || null;\n"
            "    var search = document.getElementById(\"vizSearch\");\n"
            "    if (search) search.value = \"\";\n"
            "    applyFilters();\n"
            "  }\n"
            "  global.damVizApplyStatusLetterFilter = applyStatusLetterFilterViz;",
            1,
        )
    if "statusLetterFilter && rowStatusLetter" not in text:
        text = text.replace(
            "      if (lang && (v.lang || \"\") !== lang) return false;",
            "      if (lang && (v.lang || \"\") !== lang) return false;\n"
            "      if (statusLetterFilter && rowStatusLetter(v) !== statusLetterFilter) return false;",
            1,
        )
    if "statusLetterFilter" not in text.split("function clearVizFiltersSoft")[1][:400]:
        text = text.replace(
            "  function clearVizFiltersSoft() {\n"
            "    var search = document.getElementById(\"vizSearch\");",
            "  function clearVizFiltersSoft() {\n"
            "    statusLetterFilter = null;\n"
            "    var search = document.getElementById(\"vizSearch\");",
            1,
        )
    if "statusLetterFilter" not in text.split("function vizActiveFilterLabels")[1][:500]:
        text = text.replace(
            "    var parts = [];\n"
            "    var q = ((document.getElementById(\"vizSearch\") || {}).value || \"\").trim();",
            "    var parts = [];\n"
            "    if (statusLetterFilter) parts.push(statusFilterLabelViz(statusLetterFilter));\n"
            "    var q = ((document.getElementById(\"vizSearch\") || {}).value || \"\").trim();",
            1,
        )
    # Replace renderVizEmptyState body for status-only empty
    if "dam-viz-empty--status-only" not in text:
        old = "    var bundle = pickVizEmptyBundle();\n"
        new = "    var isStatusOnly = !!statusLetterFilter;\n"
        "    var bundle = isStatusOnly ? null : pickVizEmptyBundle();\n"
        text = text.replace(old, new, 1)
        text = text.replace(
            "    var line = bundle.text || \"\";",
            "    var line = bundle ? bundle.text || \"\" : \"\";",
            1,
        )
        text = text.replace(
            "    var filterHtml = filters.length",
            "    var statusTitle = statusLetterFilter === \"-\"\n"
            "      ? i18nText(\"viz.empty_status_clear_title\", \"Brak wariantów bez statusu\")\n"
            "      : i18nText(\"viz.empty_status_generic_title\", \"Brak wyników dla statusu\");\n"
            "    var statusDesc = statusLetterFilter === \"-\"\n"
            "      ? i18nText(\n"
            "          \"viz.empty_status_clear_desc\",\n"
            "          \"Wszystkie warianty w widoku mają już literkę F, X lub D w nazwie folderu.\"\n"
            "        )\n"
            "      : i18nText(\n"
            "          \"viz.empty_status_generic_desc\",\n"
            "          \"Żaden wariant nie pasuje do wybranego filtra statusu.\"\n"
            "        );\n"
            "    var filterHtml = filters.length",
            1,
        )
        text = text.replace(
            "'<div class=\"dam-viz-empty\" role=\"status\"",
            "'<div class=\"dam-viz-empty' + (isStatusOnly ? \" dam-viz-empty--status-only\" : \"\") + '\" role=\"status\"",
            1,
        )
        text = text.replace(
            "      '<div class=\"dam-empty-mascot-row\" data-empty-mood=\"' +\n"
            "      esc(bundle.mood || \"think\") +\n"
            "      '\">' +\n"
            "      '<div class=\"dam-empty-mascot-row__speak\">' +\n"
            "      '<div class=\"dam-empty-mascot-row__bubble\">' +\n"
            "      '<p class=\"dam-empty-mascot-row__bubble-text\">' +\n"
            "      esc(line) +\n"
            "      \"</p>\" +\n"
            "      \"</div>\" +\n"
            "      '<div class=\"dam-empty-mascot-row__mascot\" aria-hidden=\"true\" style=\"--dam-empty-pose:url(\\'' +\n"
            "      pose +\n"
            "      \"')\\\">\" +\n"
            "      '<span class=\"dam-empty-mascot-row__mascot-img\"></span>' +\n"
            "      \"</div>\" +\n"
            "      \"</div>\" +\n"
            "      '<div class=\"dam-empty-mascot-row__card\">' +",
            "      (isStatusOnly\n"
            "        ? \"\"\n"
            "        : '<div class=\"dam-empty-mascot-row\" data-empty-mood=\"' +\n"
            "          esc(bundle.mood || \"think\") +\n"
            "          '\">' +\n"
            "          '<div class=\"dam-empty-mascot-row__speak\">' +\n"
            "          '<div class=\"dam-empty-mascot-row__bubble\">' +\n"
            "          '<p class=\"dam-empty-mascot-row__bubble-text\">' +\n"
            "          esc(line) +\n"
            "          \"</p>\" +\n"
            "          \"</div>\" +\n"
            "          '<div class=\"dam-empty-mascot-row__mascot\" aria-hidden=\"true\" style=\"--dam-empty-pose:url(\\'' +\n"
            "          pose +\n"
            "          \"')\\\">\" +\n"
            "          '<span class=\"dam-empty-mascot-row__mascot-img\"></span>' +\n"
            "          \"</div>\" +\n"
            "          \"</div>\") +\n"
            "      '<div class=\"dam-empty-mascot-row__card\">' +",
            1,
        )
        text = text.replace(
            "      '<h3 class=\"dam-branding-empty__title\">Brak wynik\\u00f3w</h3>' +\n"
            "      '<p class=\"dam-branding-empty__desc\">\\u017baden materia\\u0142 nie pasuje do aktywnych filtr\\u00f3w w tej sekcji.</p>' +",
            "      '<h3 class=\"dam-branding-empty__title\">' +\n"
            "      esc(isStatusOnly ? statusTitle : \"Brak wyników\") +\n"
            "      \"</h3>\" +\n"
            "      '<p class=\"dam-branding-empty__desc\">' +\n"
            "      esc(isStatusOnly ? statusDesc : \"Żaden materiał nie pasuje do aktywnych filtrów w tej sekcji.\") +\n"
            "      \"</p>\" +",
            1,
        )
        text = text.replace(
            "      '<button type=\"button\" class=\"geex-btn geex-btn--primary-transparent dam-viz-empty__clear\">Wyczy\\u015b\\0107 filtry</button>' +",
            "      '<button type=\"button\" class=\"geex-btn geex-btn--primary-transparent dam-empty-clear-btn dam-viz-empty__clear\">' +\n"
            "      esc(i18nText(\"branding.clear_filters\", \"Wyczyść filtry\")) +\n"
            "      \"</button>\" +",
            1,
        )
    return text


def patch_tag(text: str) -> str:
    if "dam-life-hist__index-preview" not in text:
        text = text.replace(
            "      (idxShow && idxShow !== pname\n"
            "        ? '<span class=\"dam-viz-badge dam-viz-badge--index\" title=\"Indeks\">' +\n"
            "          esc(idxShow) +\n"
            "          \"</span>\"\n"
            "        : \"\") +",
            "      (idxShow && idxShow !== pname\n"
            "        ? '<span class=\"dam-viz-badge dam-viz-badge--index dam-life-hist__index\" title=\"Indeks\" data-life-index=\"' +\n"
            "          esc(idxShow) +\n"
            "          '\" data-life-path=\"' +\n"
            "          esc(h.path || \"\") +\n"
            "          '\"><span class=\"dam-life-hist__index-label\">' +\n"
            "          esc(idxShow) +\n"
            "          '</span><span class=\"dam-life-hist__index-preview\" aria-hidden=\"true\"><img alt=\"\" loading=\"lazy\" decoding=\"async\" /></span></span>'\n"
            "        : \"\") +",
            1,
        )
    if "function bindLifeHistIndexPreviews" not in text:
        fn = r'''
  function resolveLifeHistThumbPath(idx, pathHint) {
    if (pathHint) return String(pathHint);
    var fi = global._DAM_FILE_INDEX;
    if (!fi || !fi.products) return "";
    var ik = String(idx || "").trim();
    for (var pi = 0; pi < fi.products.length; pi++) {
      var p = fi.products[pi];
      var revs = (p && p.revisions) || [];
      for (var ri = 0; ri < revs.length; ri++) {
        var r = revs[ri];
        if (r && r.index === ik && r.path) return r.path;
      }
    }
    return "";
  }

  function bindLifeHistIndexPreviews(root) {
    if (!root) return;
    root.querySelectorAll(".dam-life-hist__index").forEach(function (el) {
      if (el._damIdxPrevBound) return;
      el._damIdxPrevBound = true;
      var img = el.querySelector(".dam-life-hist__index-preview img");
      if (!img) return;
      var loaded = "";
      function showThumb() {
        var path = resolveLifeHistThumbPath(
          el.getAttribute("data-life-index") || "",
          el.getAttribute("data-life-path") || ""
        );
        if (!path) return;
        var url =
          global.DamPreviewTruth && typeof global.DamPreviewTruth.thumbCacheUrl === "function"
            ? global.DamPreviewTruth.thumbCacheUrl(path, "card")
            : "";
        if (!url) return;
        if (loaded !== url) {
          loaded = url;
          img.src = url;
        }
        el.classList.add("is-preview-ready");
      }
      el.addEventListener("mouseenter", showThumb);
      el.addEventListener("focus", showThumb);
    });
  }

'''
        text = text.replace("  function lifeHistListHtml(rows, opts) {", fn + "  function lifeHistListHtml(rows, opts) {", 1)
    if "bindLifeHistIndexPreviews(listHost)" not in text:
        text = text.replace(
            "    root._damLifeHistRepaint = repaint;\n"
            "    repaint();",
            "    root._damLifeHistRepaint = function () {\n"
            "      repaint();\n"
            "      bindLifeHistIndexPreviews(root.querySelector(\"[data-life-hist-list]\"));\n"
            "    };\n"
            "    root._damLifeHistRepaint();",
            1,
        )
    text = text.replace(
        "      title: p.title || \"zmiana na dysku\",",
        "      title: (p.title || changeLogRowDetail(entry) || \"zmiana na dysku\"),",
        1,
    )
    text = text.replace(
        "    var scopeLabel = p.scope || (isLife ? \"Status\" : \"Zmiana\");",
        "    var scopeLabel = p.scope || (isLife ? \"Status\" : \"Plik na dysku\");",
        1,
    )
    text = text.replace(
        "      '<span class=\"dam-life-hist__detail\">' +\n"
        "      esc(h.title || \"zmiana na dysku\") +\n"
        "      \"</span>\" +",
        "      '<span class=\"dam-life-hist__detail\">' +\n"
        "      esc(h.title || (h.kind === \"disk\" ? \"Zmiana na dysku\" : \"Zmiana statusu\")) +\n"
        "      (pname && h.title && h.title.indexOf(pname) === -1 ? \" · \" + esc(pname) : \"\") +\n"
        "      \"</span>\" +",
        1,
    )
    return text


def patch_pl(text: str) -> str:
    if "explorer.status_filter_kicker" in text:
        return text
    insert = ''',
  "explorer.status_filter_kicker": "Filtr statusu",
  "explorer.status_label_clear": "Bez statusu",
  "explorer.status_label_f": "Aktualne (F)",
  "explorer.status_label_x": "Nieaktualne (X)",
  "explorer.status_label_d": "Demo (D)",
  "explorer.empty_status_clear_title": "Brak produktów bez statusu",
  "explorer.empty_status_clear_desc": "W bieżącym widoku wszystkie produkty mają literkę F, X lub D w nazwie folderu na dysku.",
  "explorer.empty_status_generic_title": "Brak produktów z tym statusem",
  "explorer.empty_status_generic_desc": "Żaden produkt ani wariant w bieżącym widoku nie pasuje do wybranego filtra statusu.",
  "viz.empty_status_clear_title": "Brak wariantów bez statusu",
  "viz.empty_status_clear_desc": "Wszystkie warianty w widoku mają już literkę F, X lub D w nazwie folderu.",
  "viz.empty_status_generic_title": "Brak wyników dla statusu",
  "viz.empty_status_generic_desc": "Żaden wariant nie pasuje do wybranego filtra statusu.",
  "history.index_preview_tip": "Najedź, aby zobaczyć miniaturę produktu"'''
    return text.replace("\n}", insert + "\n}", 1)


def patch_css_brand(text: str) -> str:
    if "dam-life-hist__index-preview" in text:
        return text
    block = """

/* Historia: podgląd miniatury po indeksie (fade 0.3s, thumb-cache) */
.dam-life-hist__index {
  position: relative;
  cursor: help;
}
.dam-life-hist__index-preview {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 30;
  width: 120px;
  height: 120px;
  border-radius: var(--dam-radius-sm, 8px);
  overflow: hidden;
  box-shadow: var(--dam-shadow, 0 10px 30px rgb(var(--dam-shadow-rgb, 23 22 30) / 0.12));
  border: 1px solid var(--dam-border, #ececf2);
  background: var(--dam-surface, #fff);
}
.dam-life-hist__index-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.dam-life-hist__index:hover .dam-life-hist__index-preview,
.dam-life-hist__index:focus-within .dam-life-hist__index-preview,
.dam-life-hist__index.is-preview-ready:hover .dam-life-hist__index-preview {
  opacity: 1;
}
"""
    return text.rstrip() + block + "\n"


def patch_css_branding(text: str) -> str:
    if "dam-empty-clear-btn" in text:
        return text
    block = """
.dam-branding-empty-wrap--status-only .dam-empty-mascot-row__speak {
  display: none !important;
}
.dam-branding-empty .geex-btn.dam-empty-clear-btn {
  align-self: center;
  width: auto;
  max-width: 100%;
  flex: 0 0 auto;
}
#vizGrid .dam-viz-empty--status-only .dam-empty-mascot-row__speak {
  display: none !important;
}
"""
    return text.rstrip() + block + "\n"


def main() -> None:
    EXPLORER.write_text(patch_explorer(EXPLORER.read_text(encoding="utf-8")), encoding="utf-8")
    print("explorer ok")
    VIZ.write_text(patch_viz(VIZ.read_text(encoding="utf-8")), encoding="utf-8")
    print("viz ok")
    TAG.write_text(patch_tag(TAG.read_text(encoding="utf-8")), encoding="utf-8")
    print("tag ok")
    PL.write_text(patch_pl(PL.read_text(encoding="utf-8")), encoding="utf-8")
    print("pl ok")
    BRAND_CSS.write_text(patch_css_brand(BRAND_CSS.read_text(encoding="utf-8")), encoding="utf-8")
    print("brand css ok")
    BRANDING_CSS.write_text(patch_css_branding(BRANDING_CSS.read_text(encoding="utf-8")), encoding="utf-8")
    print("branding css ok")
    VERSION.write_text(
        VERSION.read_text(encoding="utf-8").replace('global.DAM_APP_VERSION = "5.0.168";', 'global.DAM_APP_VERSION = "5.0.169";'),
        encoding="utf-8",
    )
    print("version ok")


if __name__ == "__main__":
    main()
