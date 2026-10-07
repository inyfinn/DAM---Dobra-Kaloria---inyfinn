(function () {
  "use strict";

  /* Etykiety ludzkie - jak w Eksploratorze (nie kody API: artwork / viz_3d) */
  var ROLE_META = {
    artwork: { label: "Plik źródłowy projektu graficznego", icon: "uil-palette" },
    prev: { label: "Podgląd PDF projektu", icon: "uil-eye" },
    print_pdf: { label: "Pliki do druku", icon: "uil-file-alt" },
    viz_3d: { label: "Wizualizacje", icon: "uil-cube" },
    tech: { label: "Elementy / składniki", icon: "uil-clipboard-notes" },
    marketing: { label: "Materiały marketingowe", icon: "uil-megaphone" },
    karta: { label: "Karta wprowadzenia", icon: "uil-file-bookmark-alt" },
    presentation: { label: "Prezentacja", icon: "uil-presentation" },
  };

  /* Szersza checklista: 8 pozycji (karta + prezentacja). */
  var CHECK_ROLES = [
    "artwork", "prev", "print_pdf", "viz_3d", "tech", "marketing", "karta", "presentation",
  ];

  var VIEW_STATE_KEY = "dam_projects_view";
  var PROJECTS_ARCHIVE_KEY = "dam_projects_include_archive";
  var PROJECTS_SORT_KEY = "dam_projects_sort";
  var PROJECTS_RECENT_KEY = "dam_projects_recent";

  var SORT_OPTIONS = [
    { id: "date_desc", label: "Wprowadzenie: najnowsze" },
    { id: "date_asc", label: "Wprowadzenie: najstarsze" },
    { id: "mtime_desc", label: "Modyfikacja: najnowsze" },
    { id: "created_desc", label: "Utworzenie: najnowsze" },
    { id: "name_asc", label: "Nazwa: A–Z" },
    { id: "name_desc", label: "Nazwa: Z–A" },
    { id: "priority", label: "Priorytet: niekompletne" },
    { id: "recent", label: "Ostatnio przeglądane" },
  ];

  var state = {
    all: [],
    source: "",
    query: "",
    variantsHint: "",
    metaById: {},
    rawById: {},
    sortMode: "date_desc",
    shown: 0,
    busy: "",
    notice: "",
    scanning: false,
    seenGen: "",
    waitSince: 0,
    fail: "",
    stamp: "",
    noRoot: false,
  };

  function includeArchive() {
    var cb = document.getElementById("damProjectsIncludeArchive");
    return cb && cb.checked;
  }

  function rawProduct(p) {
    if (!p || !p.id) return null;
    if (state.rawById[p.id]) return state.rawById[p.id];
    var fi = window._DAM_FILE_INDEX;
    if (!fi || !fi.products) return null;
    for (var i = 0; i < fi.products.length; i++) {
      if (fi.products[i] && fi.products[i].id === p.id) return fi.products[i];
    }
    return null;
  }

  function projectVisibleInList(p) {
    if (includeArchive()) return true;
    var raw = rawProduct(p);
    if (!raw) return true;
    if (window.DamSearch && typeof window.DamSearch.productHasLivePresence === "function") {
      return window.DamSearch.productHasLivePresence(raw);
    }
    return true;
  }

  function readStoredQuery() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      var fromUrl = params.get("q");
      if (fromUrl != null && String(fromUrl).length) return String(fromUrl);
    } catch (e1) { /* ignore */ }
    try {
      var raw = sessionStorage.getItem(VIEW_STATE_KEY);
      if (!raw) return "";
      var data = JSON.parse(raw);
      return data && data.query != null ? String(data.query) : "";
    } catch (e2) {
      return "";
    }
  }

  function persistViewState(query) {
    var q = String(query || "");
    try {
      sessionStorage.setItem(VIEW_STATE_KEY, JSON.stringify({ query: q, ts: Date.now() }));
    } catch (e) { /* ignore */ }
    var next = q ? "index.html?q=" + encodeURIComponent(q) : "index.html";
    try {
      var cur = (window.location.pathname.split("/").pop() || "index.html") + (window.location.search || "");
      if (cur !== next) {
        history.replaceState(null, "", next);
      }
    } catch (e2) { /* ignore */ }
    if (window.DamShell && typeof window.DamShell.replaceNavStackTop === "function") {
      window.DamShell.replaceNavStackTop(next);
    } else {
      try {
        var stack = JSON.parse(sessionStorage.getItem("dam_nav_stack") || "[]");
        if (Array.isArray(stack) && stack.length) {
          var topFile = String(stack[stack.length - 1]).split("?")[0];
          if (topFile === "index.html") {
            stack[stack.length - 1] = next;
            sessionStorage.setItem("dam_nav_stack", JSON.stringify(stack));
          }
        }
      } catch (e3) { /* ignore */ }
    }
  }

  function statusMeta(status) {
    if (status === "complete") {
      return {
        cls: "dam-project-card--ok",
        badge: "dam-int-chip dam-int-st dam-int-st--ok",
        label: "Kompletny",
      };
    }
    if (status === "incomplete") {
      return {
        cls: "dam-project-card--incomplete",
        badge: "dam-int-chip dam-int-st dam-int-st--danger",
        label: "Niekompletny",
      };
    }
    return {
      cls: "dam-project-card--warn",
      badge: "dam-int-chip dam-int-st dam-int-st--warn",
      label: "Do weryfikacji",
    };
  }

  function roleMeta(role) {
    return ROLE_META[role] || { label: String(role || "Element"), icon: "uil-times-circle" };
  }

  function fileExt(name) {
    var m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  function isVizImageName(name) {
    var e = fileExt(name);
    return e === "png" || e === "jpg" || e === "jpeg" || e === "webp" || e === "tif" || e === "tiff";
  }

  function isArchiveName(name) {
    return ["zip", "rar", "7z"].indexOf(fileExt(name)) >= 0;
  }

  function pickLatestRevision(product, queryOpt) {
    var revs = (product && product.revisions) || [];
    if (!revs.length) return null;
    var candidates = [];
    for (var i = 0; i < revs.length; i++) {
      if (revs[i] && revs[i].is_latest) candidates.push(revs[i]);
    }
    if (!candidates.length) candidates = revs.slice();
    var qDig = "";
    if (queryOpt) {
      if (window.DamSearch && typeof window.DamSearch.digitsOnly === "function") {
        qDig = window.DamSearch.digitsOnly(queryOpt);
      } else {
        qDig = String(queryOpt).replace(/\D/g, "");
      }
    }
    candidates.sort(function (a, b) {
      if (qDig && qDig.length >= 3) {
        var da = String((a && a.index) || "").replace(/\D/g, "");
        var db = String((b && b.index) || "").replace(/\D/g, "");
        var ma = da.indexOf(qDig) === 0 || qDig.indexOf(da) === 0;
        var mb = db.indexOf(qDig) === 0 || qDig.indexOf(db) === 0;
        if (ma && !mb) return -1;
        if (mb && !ma) return 1;
      }
      var ibA =
        parseInt(String((a && a.index_base) || String((a && a.index) || "").replace(/\D/g, "") || "0"), 10) ||
        0;
      var ibB =
        parseInt(String((b && b.index_base) || String((b && b.index) || "").replace(/\D/g, "") || "0"), 10) ||
        0;
      if (ibB !== ibA) return ibB - ibA;
      var vizA =
        (((a && a.files_by_role) && a.files_by_role.viz) || []).length +
        (((a && a.wizki) || []).length);
      var vizB =
        (((b && b.files_by_role) && b.files_by_role.viz) || []).length +
        (((b && b.wizki) || []).length);
      if (vizB !== vizA) return vizB - vizA;
      var dd = String((b && b.date) || "").localeCompare(String((a && a.date) || ""));
      if (dd) return dd;
      return String((b && b.folder) || "").localeCompare(String((a && a.folder) || ""));
    });
    return candidates[0];
  }

  /* Mini-checklista jak Eksplorator - z najnowszej rewizji produktu. */
  function computeWideChecklist(product, queryOpt) {
    var rev = pickLatestRevision(product, queryOpt);
    if (window.DamApi && typeof window.DamApi.revisionRoles === "function") {
      return window.DamApi.revisionRoles(rev, product);
    }
    return {
      artwork: false, prev: false, print_pdf: false, viz_3d: false,
      tech: false, marketing: false, karta: false, presentation: false,
    };
  }

  function projectCompleteness(p) {
    var raw = rawProduct(p);
    if (!raw) return p.completeness || "incomplete";
    var flags = computeWideChecklist(raw, state.query);
    var missing = [];
    ["artwork", "viz_3d", "print_pdf"].forEach(function (r) {
      if (!flags[r]) missing.push(r);
    });
    return missing.length ? "incomplete" : "complete";
  }

  function renderGaps(p) {
    var meta = state.metaById[p.id] || {};
    var raw = rawProduct(p);
    var flags =
      (raw ? computeWideChecklist(raw, state.query) : null) || meta.checklist || null;
    var missing = p.missing_roles || [];
    var missSet = {};
    missing.forEach(function (r) {
      missSet[r] = true;
    });
    var folderPath = p.path || "";
    var rawRev = raw ? pickLatestRevision(raw, state.query) : null;
    var rolePaths =
      window.DamApi && typeof window.DamApi.revisionRolePaths === "function" && rawRev
        ? window.DamApi.revisionRolePaths(rawRev, raw)
        : {};
    var winIcon =
      window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';

    var rows = CHECK_ROLES.map(function (r) {
      var m = roleMeta(r);
      var ok;
      if (flags && typeof flags[r] === "boolean") {
        ok = flags[r];
      } else if (r === "artwork" || r === "viz_3d" || r === "print_pdf") {
        ok = !missSet[r];
      } else {
        ok = false;
      }
      var rowPath = rolePaths[r] || folderPath;
      var rowEsc = String(rowPath).replace(/"/g, "&quot;");
      var cls = ok ? "dam-check-ok" : "dam-check-brak";
      var icon = ok ? "uil-check-circle" : "uil-times-circle";
      var actions = "";
      if (ok) {
        actions =
          '<span class="dam-check-row__actions" hidden>' +
          '<a class="dam-int-cta dam-btn-icon dam-check-go" href="explorer.html?product=' +
          encodeURIComponent(p.id) +
          '" title="Przejdź do Eksplorera" data-dam-tip="Otwórz slot w Eksplorerze">' +
          '<i class="uil uil-arrow-right" aria-hidden="true"></i><span>Przejdź</span></a>' +
          '<button type="button" class="dam-int-cta dam-int-cta--icon dam-btn-icon dam-btn-icon-only dam-win-btn dam-check-win" data-path="' +
          rowEsc +
          '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwórz folder w Eksploratorze plików Windows">' +
          winIcon +
          "</button></span>";
      }
      return (
        '<div class="' +
        cls +
        (ok ? " dam-check-row--interactive" : "") +
        '" data-path="' +
        rowEsc +
        '"' +
        (ok ? ' tabindex="0" role="button"' : "") +
        ">" +
        '<i class="uil ' +
        icon +
        ' dam-check-icon" aria-hidden="true"></i>' +
        '<span class="dam-check-label">' +
        m.label +
        "</span>" +
        actions +
        "</div>"
      );
    }).join("");

    return (
      '<div class="dam-card-checklist" aria-label="Kompletność materiałów">' +
      rows +
      "</div>"
    );
  }

  /* Znane linki Asana (rozszerzac gdy beda mapowania) */
  var ASANA_BY_INDEX = {
    "6300728.00":
      "https://app.asana.com/1/1143952495030509/project/1212679241997947/list/1212717099105923",
  };

  function renderCardBadges(p, opts) {
    opts = opts || {};
    var meta = state.metaById[p.id] || {};
    /* TYLKO surowe langs. Zakaz domyslu market=PL -> pl. */
    var langs = meta.langs || p.langs || [];
    if (window.DamBadges && typeof window.DamBadges.render === "function") {
      var carrierLbl = "";
      if (window.DamLabels && typeof window.DamLabels.carrierLabel === "function") {
        carrierLbl = window.DamLabels.carrierLabel(meta.carrier || "", meta.revisionFolder || meta.carrier || "", {
          productName: p.title,
          tags: meta.tags,
        }) || "";
      }
      return (
        '<div class="dam-project-card__badges">' +
        window.DamBadges.render({
          brand: meta.brand || p.brand || (p.market === "GC" ? "GC" : "DK"),
          category: meta.category || p.category,
          subcategory: meta.subcategory_slug || p.subcategory_slug,
          subcategoryLabel: meta.subcategory_label || p.subcategory_label,
          carrier: meta.carrier || p.carrier,
          carrierLabel: carrierLbl,
          carrierGuessed: !!meta.carrier_guessed,
          langs: langs,
          index: opts.includeIndex ? (p.product_index || meta.index || "") : "",
          multiLang: langs.length > 1,
          multiIndex: !!meta.multiIndex,
          mix: !!(
            window.DamLabels &&
            DamLabels.isMixProduct &&
            DamLabels.isMixProduct(p.title, meta.tags)
          ),
          productName: p.title,
          productId: p.id,
          tags: meta.tags,
          revisionFolder: meta.revisionFolder,
          showCarrierPlaceholder: false,
          compact: true,
          maxPerKind: 2,
          maxTotal: 8,
          packagingTags: (meta.tag_groups && meta.tag_groups.pakowanie) || [],
          includeTagTiers:
            window.DamBadges && typeof window.DamBadges.getIncludeTagTiers === "function"
              ? window.DamBadges.getIncludeTagTiers()
              : ["primary"],
        }) +
        "</div>"
      );
    }
    var tg = meta.tag_groups || {};
    var chips = []
      .concat(tg.smak || [])
      .concat(tg.typ || [])
      .concat(tg.opakowanie || [])
      .slice(0, 6);
    if (!chips.length && (meta.tags || []).length) chips = meta.tags.slice(0, 6);
    if (!chips.length) return "";
    return (
      '<div class="dam-project-card__badges">' +
      chips
        .map(function (t) {
          return '<span class="dam-viz-badge dam-viz-badge--cat">' + String(t).replace(/</g, "&lt;") + "</span>";
        })
        .join("") +
      "</div>"
    );
  }

  function projectsI18n(key, fallback) {
    if (window.DamI18n && typeof window.DamI18n.t === "function") {
      var v = window.DamI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function projectIndexCopyChipHtml(ix) {
    return (
      '<button type="button" class="dam-viz-badge dam-viz-badge--index dam-branding-id-chip dam-viz-card__id-chip" data-copy-id="' +
      esc(ix) +
      '" data-tag-value="' +
      esc(ix) +
      '" data-dam-tip="Kliknij, aby skopiować" aria-label="Kopiuj indeks ' +
      esc(ix) +
      '"><i class="uil uil-copy" aria-hidden="true"></i>' +
      esc(ix) +
      "</button>"
    );
  }

  function renderIndexCorner(p) {
    var meta = state.metaById[p.id] || {};
    var raw = rawProduct(p);
    var indexes = (meta.indexes && meta.indexes.length ? meta.indexes.slice() : []) ||
      (raw && raw.indexes ? raw.indexes.slice() : []);
    if (!indexes.length) {
      var rev = pickLatestRevision(raw, state.query);
      var idx = (rev && rev.index) || p.product_index || meta.index || "";
      if (idx) indexes = [idx];
    }
    indexes.sort(function (a, b) {
      var na = parseFloat(String(a)) || 0;
      var nb = parseFloat(String(b)) || 0;
      if (nb !== na) return nb - na;
      return String(b).localeCompare(String(a));
    });
    if (!indexes.length) return "";
    var html = '<div class="dam-project-card__index-corner">';
    if (indexes.length > 1) {
      var showLabel = projectsI18n("dash.widget.show_indexes", "Pokaż indeksy");
      var showTip = projectsI18n(
        "dash.widget.show_indexes_tip",
        "Pokaż wszystkie indeksy wariantów (klik = kopiuj)"
      );
      html +=
        '<div class="dam-viz-card__indexes-anchor">' +
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-viz-card__show-indexes" data-dam-tip="' +
        esc(showTip) +
        '" aria-expanded="false">' +
        '<i class="uil uil-layer-group" aria-hidden="true"></i><span>' +
        esc(showLabel) +
        "</span></button>" +
        '<div class="dam-viz-card__indexes-wrap" hidden>' +
        indexes.map(projectIndexCopyChipHtml).join("") +
        "</div></div>";
    } else {
      html += projectIndexCopyChipHtml(indexes[0]);
    }
    html += "</div>";
    return html;
  }

  function toastIndexCopied(msg) {
    if (typeof window.damShowToast === "function") {
      window.damShowToast(msg);
      return;
    }
    var el = document.getElementById("damGlobalToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damGlobalToast";
      el.className = "dam-global-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove("is-on");
    }, 1600);
  }

  function copyProjectIndexChip(chip) {
    var text = chip.getAttribute("data-copy-id") || chip.getAttribute("data-tag-value") || "";
    text = String(text).trim();
    if (!text) return;
    var onOk = function () {
      toastIndexCopied("Skopiowano: " + text);
    };
    var onFail = function () {
      toastIndexCopied("Nie udało się skopiować");
    };
    if (window.DamBadges && typeof window.DamBadges.copyTagText === "function") {
      window.DamBadges.copyTagText(chip).then(onOk).catch(onFail);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onOk).catch(onFail);
    }
  }

  function bindProjectGridIndexDelegation(grid) {
    if (!grid || grid._damProjectsIndexDelegation) return;
    grid._damProjectsIndexDelegation = true;
    grid.addEventListener("click", function (ev) {
      var corner = ev.target.closest(".dam-project-card__index-corner");
      if (!corner || !grid.contains(corner)) return;

      var showBtn = ev.target.closest(".dam-viz-card__show-indexes");
      if (showBtn && corner.contains(showBtn)) {
        ev.preventDefault();
        ev.stopPropagation();
        var anchor = showBtn.closest(".dam-viz-card__indexes-anchor");
        var wrap =
          (anchor && anchor.querySelector(".dam-viz-card__indexes-wrap")) ||
          (showBtn.parentNode && showBtn.parentNode.querySelector(".dam-viz-card__indexes-wrap"));
        if (!wrap) return;
        var open = !(anchor && anchor.classList.contains("is-expanded"));
        if (anchor) {
          if (open) anchor.classList.add("is-expanded");
          else anchor.classList.remove("is-expanded");
        }
        if (open) wrap.removeAttribute("hidden");
        else wrap.setAttribute("hidden", "");
        showBtn.setAttribute("aria-expanded", open ? "true" : "false");
        return;
      }

      var copyChip = ev.target.closest("[data-copy-id]");
      if (copyChip && corner.contains(copyChip)) {
        ev.preventDefault();
        ev.stopPropagation();
        copyProjectIndexChip(copyChip);
      }
    });
  }

  function cardCategoryLabel(p) {
    var meta = state.metaById[p.id] || {};
    var raw = meta.category || p.category || "";
    if (!raw) return "";
    if (window.DamLabels && typeof window.DamLabels.categoryTitle === "function") {
      return window.DamLabels.categoryTitle(raw) || "";
    }
    return String(raw)
      .replace(/^\s*\d+\s*[-–—]\s*/u, "")
      .trim();
  }

  function cardTitleHtml(p) {
    var name = p.title || "Projekt";
    var cat = cardCategoryLabel(p);
    var label = cat ? cat + " · " + name : name;
    var href = "project.html?id=" + encodeURIComponent(p.id);
    return (
      '<h3 class="dam-project-card__title">' +
      '<a class="dam-project-card__title-link" href="' +
      href +
      '" title="Szczegóły produktu" data-dam-tip="Karta produktu - katalog, checklista, materiały">' +
      String(label).replace(/</g, "&lt;") +
      "</a></h3>"
    );
  }

  function renderCard(p) {
    var meta = statusMeta(projectCompleteness(p));
    var listHtml = renderGaps(p);
    var indexHtml = renderIndexCorner(p);
    var badgesHtml = renderCardBadges(p, { includeIndex: false });
    var folderPath = p.path || "";
    var pathEsc = String(folderPath).replace(/"/g, "&quot;");
    var asanaUrl = ASANA_BY_INDEX[String(p.product_index || "").trim()] || "";
    var asanaIcon =
      window.DamIcons && typeof window.DamIcons.asanaSvg === "function"
        ? window.DamIcons.asanaSvg()
        : '<i class="uil uil-external-link-alt" aria-hidden="true"></i>';
    var winIcon =
      window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';
    var asanaBtn = asanaUrl
      ? '<a class="dam-int-cta dam-int-cta--icon dam-btn-icon dam-btn-icon-only dam-project-asana-btn" href="' +
        asanaUrl +
        '" target="_blank" rel="noopener noreferrer" aria-label="Asana" title="Otwórz w Asanie" data-dam-tip="Projekt w Asanie">' +
        asanaIcon +
        "</a>"
      : "";
    return (
      '<div class="col-12 col-md-6 col-xl-4">' +
      '<article class="dam-project-card ' +
      meta.cls +
      '" data-product-id="' +
      String(p.id).replace(/"/g, "&quot;") +
      '" data-path="' +
      pathEsc +
      '">' +
      '<div class="dam-project-card__top">' +
      '<span class="' +
      meta.badge +
      '">' +
      meta.label +
      "</span>" +
      indexHtml +
      "</div>" +
      cardTitleHtml(p) +
      badgesHtml +
      listHtml +
      '<div class="dam-project-card__actions">' +
      '<a class="dam-int-cta dam-btn-icon dam-project-check-btn" href="project.html?id=' +
      encodeURIComponent(p.id) +
      '" title="Sprawdź projekt" data-dam-tip="Checklista i szczegóły projektu">' +
      '<i class="uil uil-arrow-right" aria-hidden="true"></i><span>Sprawdź projekt</span></a>' +
      '<a class="dam-int-cta dam-btn-icon dam-project-go-btn" href="explorer.html?product=' +
      encodeURIComponent(p.id) +
      '" title="Przejdź" data-dam-tip="Otwórz produkt w Eksplorerze">' +
      '<i class="uil uil-sitemap" aria-hidden="true"></i><span>Przejdź</span></a>' +
      '<button type="button" class="dam-int-cta dam-int-cta--icon dam-btn-icon dam-btn-icon-only dam-project-win-btn dam-win-btn" data-path="' +
      pathEsc +
      '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwiera folder w Eksploratorze plików Windows">' +
      winIcon +
      "</button>" +
      asanaBtn +
      "</div>" +
      "</article></div>"
    );
  }

  function productHaystack(p) {
    var missing = (p.missing_roles || [])
      .map(function (r) {
        return (ROLE_META[r] && ROLE_META[r].label) || r;
      })
      .join(" ");
    var meta = state.metaById[p.id] || {};
    var tags = (meta.tags || []).join(" ");
    var authors = (meta.authors || []).join(" ");
    var tg = meta.tag_groups || {};
    var groupTags = ["smak", "typ", "opakowanie", "autor", "osoba"]
      .map(function (k) {
        return (tg[k] || []).join(" ");
      })
      .join(" ");
    return [
      p.id,
      p.product_index,
      (meta.indexes || []).join(" "),
      p.title,
      p.market,
      p.completeness,
      missing,
      tags,
      authors,
      groupTags,
      meta.subcategory_slug || "",
      meta.subcategory_label || "",
      meta.category || "",
    ]
      .join(" ")
      .toLowerCase();
  }

  function variantHaystack(p) {
    var meta = state.metaById[p.id] || {};
    var blob = String(meta.search_blob || "").toLowerCase();
    var indexes = [];
    if (Array.isArray(meta.indexes)) indexes = meta.indexes;
    else if (Array.isArray(p.indexes)) indexes = p.indexes;
    var revs = (meta.revisions || p.revisions || [])
      .map(function (r) {
        if (!r) return "";
        return [r.index, r.name, r.folder, r.carrier].join(" ");
      })
      .join(" ");
    return [blob, indexes.join(" "), revs].join(" ").toLowerCase();
  }

  function haystackForScope(p) {
    var mode =
      window.DamSearch && typeof window.DamSearch.getScopeMode === "function"
        ? window.DamSearch.getScopeMode()
        : "all";
    if (mode === "products") return productHaystack(p);
    if (mode === "variants") return variantHaystack(p);
    return productHaystack(p) + " " + variantHaystack(p);
  }

  function projectMatchesTextQuery(p, q) {
    var raw = rawProduct(p);
    if (raw && window.DamSearch && typeof window.DamSearch.productMatchesTextQuery === "function") {
      var normFn = window.DamSearch.normQuery || function (s) { return String(s || "").toLowerCase(); };
      var digFn = window.DamSearch.digitsOnly || function (s) { return String(s || "").replace(/\D/g, ""); };
      var nq = normFn(q);
      var dig = digFn(q);
      return window.DamSearch.productMatchesTextQuery(raw, nq, dig, includeArchive());
    }
    var parts = String(q || "")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return true;
    var h = haystackForScope(p);
    return parts.every(function (part) {
      return h.indexOf(part) !== -1;
    });
  }

  /* RRRRMMDD albo 0. Odrzuca niemozliwe daty i dalsze niz rok w przyszlosc:
     "doy_65g_2026_08_31" czytane jako 26.08.2031 stalo zawsze na gorze sortu (07.10.2026). */
  function ymdScore(y, m, d) {
    if (y < 100) y += 2000;
    if (!(m >= 1 && m <= 12 && d >= 0 && d <= 31)) return 0;
    var now = new Date();
    var max = (now.getFullYear() + 1) * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    var score = y * 10000 + m * 100 + d;
    return score > max ? 0 : score;
  }

  function parseFolderDateScore(folderName) {
    var s = String(folderName || "");
    /* RRRR-MM-DD (takze _ . i spacja) PRZED DD.MM.RRRR: inaczej "2026_08_31" daje rok 2031. */
    var m = s.match(/(?:^|[^\d.])(20\d{2})[._ -](\d{1,2})[._ -](\d{1,2})(?![\d.])/);
    var score = m ? ymdScore(+m[1], +m[2], +m[3]) : 0;
    if (score) return score;
    /* Wzorzec z dam-viz.js (lewa granica, spacja) plus podkreslenie: "RĘKAW - 17_09_2026". */
    m = s.match(/(?:^|[^\d.])(\d{1,2})[./_ -](\d{1,2})[./_ -](\d{4}|\d{2})(?![\d.])/);
    score = m ? ymdScore(+m[3], +m[2], +m[1]) : 0;
    if (score) return score;
    /* MM.RR bez dnia ("DOYPACK - 03.26"); granice, zeby nie lapac kawalka odrzuconej pelnej daty. */
    m = s.match(/(?:^|[^\d._-])(\d{1,2})[./-](\d{2})(?![\d._-])/);
    return m ? ymdScore(+m[2], +m[1], 0) : 0;
  }

  /* Wariant: najpierw data ze spisu (rev.date, ISO), dopiero potem nazwa folderu. */
  function revisionDateScore(r) {
    if (!r) return 0;
    var iso = String(r.date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    var score = iso ? ymdScore(+iso[1], +iso[2], +iso[3]) : 0;
    if (score) return score;
    var seg = String(r.revision_path || r.path || "").replace(/\\/g, "/").split("/").pop();
    return parseFolderDateScore(r.folder || r.revision_folder) || parseFolderDateScore(seg);
  }

  function projectDateScore(p) {
    var raw = rawProduct(p);
    var best = 0;
    ((raw && raw.revisions) || []).forEach(function (r) {
      best = Math.max(best, revisionDateScore(r));
    });
    if (best) return best;
    /* Zaden wariant nie ma daty: nazwy folderow na sciezce produktu. */
    var meta = state.metaById[p.id] || {};
    best = parseFolderDateScore(meta.revisionFolder);
    String(p.path || (raw && raw.path) || "").replace(/\\/g, "/").split("/").forEach(function (part) {
      best = Math.max(best, parseFolderDateScore(part));
    });
    return best;
  }

  function takeTimeMs(v) {
    if (typeof v === "number" && isFinite(v) && v > 0) return v;
    var t = Date.parse(String(v || ""));
    return t && !isNaN(t) ? t : 0;
  }

  function projectMtimeMs(p) {
    var raw = rawProduct(p);
    var best = 0;
    function bump(v) {
      var t = takeTimeMs(v);
      if (t > best) best = t;
    }
    bump(p && (p.mtime_ms || p.mtime));
    if (raw) {
      bump(raw.mtime_ms || raw.mtime);
      (raw.revisions || []).forEach(function (r) {
        if (r) bump(r.mtime_ms || r.mtime);
      });
      /* Stary spis (sprzed pol mtime produktu/wariantu): najnowszy plik wariantow. */
      if (!best) {
        (raw.revisions || []).forEach(function (r) {
          var byRole = (r && r.files_by_role) || {};
          Object.keys(byRole).forEach(function (role) {
            (byRole[role] || []).forEach(function (f) {
              if (f) bump(f.mtime_ms || f.mtime);
            });
          });
        });
      }
    }
    return best;
  }

  function projectCreatedMs(p) {
    var raw = rawProduct(p);
    var best = 0;
    function bumpEarliest(v) {
      var t = takeTimeMs(v);
      if (!t) return;
      if (!best || t < best) best = t;
    }
    bumpEarliest(p && (p.created_ms || p.created || p.ctime || p.created_at));
    if (raw) {
      bumpEarliest(raw.created_ms || raw.created || raw.ctime);
      (raw.revisions || []).forEach(function (r) {
        if (r) bumpEarliest(r.created || r.ctime || r.date);
      });
    }
    return best || projectDateScore(p);
  }

  function projectDisplayName(p) {
    var meta = state.metaById[p.id] || {};
    return String(p.name || p.title || meta.index || p.product_index || p.id || "").trim();
  }

  function priorityRank(p) {
    var status = projectCompleteness(p);
    if (status === "incomplete") return 0;
    if (status === "warn") return 1;
    if (status === "complete") return 2;
    return 3;
  }

  function readRecentProjectIds() {
    try {
      var raw = localStorage.getItem(PROJECTS_RECENT_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function touchRecentProject(id) {
    var pid = String(id || "").trim();
    if (!pid) return;
    var list = readRecentProjectIds().filter(function (x) {
      return x !== pid;
    });
    list.unshift(pid);
    if (list.length > 80) list.length = 80;
    try {
      localStorage.setItem(PROJECTS_RECENT_KEY, JSON.stringify(list));
    } catch (e) { /* ignore */ }
  }

  function readStoredSortMode() {
    try {
      var stored = localStorage.getItem(PROJECTS_SORT_KEY);
      if (stored && SORT_OPTIONS.some(function (o) { return o.id === stored; })) return stored;
    } catch (e) { /* ignore */ }
    return "date_desc";
  }

  function persistSortMode(mode) {
    state.sortMode = mode || "date_desc";
    try {
      localStorage.setItem(PROJECTS_SORT_KEY, state.sortMode);
    } catch (e) { /* ignore */ }
  }

  function sortProjects(rows) {
    var mode = state.sortMode || "date_desc";
    var out = rows.slice();
    if (mode === "recent") {
      var recent = readRecentProjectIds();
      var rank = {};
      recent.forEach(function (id, i) {
        rank[id] = i;
      });
      out.sort(function (a, b) {
        var ra = rank[a.id];
        var rb = rank[b.id];
        if (ra == null && rb == null) return projectDateScore(b) - projectDateScore(a);
        if (ra == null) return 1;
        if (rb == null) return -1;
        return ra - rb;
      });
      return out;
    }
    if (mode === "name_asc" || mode === "name_desc") {
      var dir = mode === "name_asc" ? 1 : -1;
      out.sort(function (a, b) {
        var cmp = projectDisplayName(a).localeCompare(projectDisplayName(b), "pl", { sensitivity: "base" });
        if (cmp !== 0) return cmp * dir;
        return String(a.id).localeCompare(String(b.id)) * dir;
      });
      return out;
    }
    if (mode === "priority") {
      out.sort(function (a, b) {
        var pa = priorityRank(a);
        var pb = priorityRank(b);
        if (pa !== pb) return pa - pb;
        return projectDateScore(b) - projectDateScore(a);
      });
      return out;
    }
    if (mode === "mtime_desc") {
      var mtimeById = {};
      out.forEach(function (p) {
        mtimeById[p.id] = projectMtimeMs(p);
      });
      out.sort(function (a, b) {
        var da = mtimeById[a.id];
        var db = mtimeById[b.id];
        if (da !== db) return db - da;
        return projectDisplayName(a).localeCompare(projectDisplayName(b), "pl", { sensitivity: "base" });
      });
      return out;
    }
    if (mode === "created_desc") {
      out.sort(function (a, b) {
        var da = projectCreatedMs(a);
        var db = projectCreatedMs(b);
        if (da !== db) return db - da;
        return projectDisplayName(a).localeCompare(projectDisplayName(b), "pl", { sensitivity: "base" });
      });
      return out;
    }
    var dateDir = mode === "date_asc" ? 1 : -1;
    out.sort(function (a, b) {
      var da = projectDateScore(a);
      var db = projectDateScore(b);
      if (da !== db) return (da - db) * dateDir;
      return projectDisplayName(a).localeCompare(projectDisplayName(b), "pl", { sensitivity: "base" });
    });
    return out;
  }

  function filteredRows() {
    var q = (state.query || "").trim();
    var base = state.all.filter(projectVisibleInList);
    var rows = !q
      ? base
      : base.filter(function (p) {
          return projectMatchesTextQuery(p, q);
        });
    return sortProjects(rows);
  }

  function revealProjectCards(grid) {
    if (window.DamGridReveal && typeof window.DamGridReveal.reveal === "function") {
      window.DamGridReveal.reveal(grid, window.DamGridReveal.selectors.projectCard);
    }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pickEmptyMascotBundle() {
    if (window.DamEmptyMascot && typeof window.DamEmptyMascot.pick === "function") {
      return window.DamEmptyMascot.pick();
    }
    return {
      text: "Hmm... albo literówka, albo ten produkt żyje w innej galaktyce.",
      mood: "think",
      poseUrl: "assets/img/maskotka/pose-think-q.png"
    };
  }

  function wrapEmptyWithMascot(cardHtml) {
    var bundle = pickEmptyMascotBundle();
    var pose = String(bundle.poseUrl || "").replace(/'/g, "%27");
    var line = bundle.text || "";
    return (
      '<div class="dam-empty-mascot-row" data-empty-mood="' +
      esc(bundle.mood || "think") +
      '">' +
      '<div class="dam-empty-mascot-row__speak">' +
      '<div class="dam-empty-mascot-row__bubble">' +
      '<p class="dam-empty-mascot-row__bubble-text">' +
      esc(line) +
      "</p>" +
      "</div>" +
      '<div class="dam-empty-mascot-row__mascot" aria-hidden="true" style="--dam-empty-pose:url(\'' +
      pose +
      "')\">" +
      '<span class="dam-empty-mascot-row__mascot-img"></span>' +
      "</div>" +
      "</div>" +
      '<div class="dam-empty-mascot-row__card">' +
      cardHtml +
      "</div>" +
      "</div>"
    );
  }

  function clearProjectsSearchFilters() {
    var search = document.getElementById("damProjectsSearch");
    if (search) search.value = "";
    state.query = "";
    persistViewState("");
    var grid = document.getElementById("damProjectsGrid");
    var statusEl = document.getElementById("damProjectsStatus");
    if (grid) scheduleRenderGrid(grid, statusEl);
  }

  function projectsEmptySearchHtml() {
    var q = (state.query || "").trim();
    var filters = q
      ? '<ul class="dam-branding-empty__filters"><li>Szukaj: ' + esc(q) + "</li></ul>"
      : "";
    var clearBtn = q
      ? '<button type="button" class="geex-btn geex-btn--primary-transparent dam-projects-clear-filters">Wyczyść filtry</button>'
      : "";
    return (
      '<div class="col-12"><div class="dam-branding-empty-wrap">' +
      wrapEmptyWithMascot(
        '<div class="dam-branding-empty" role="status">' +
          '<div class="dam-branding-empty__icon" aria-hidden="true"><i class="uil uil-search-alt"></i></div>' +
          '<h3 class="dam-branding-empty__title">Brak wyników</h3>' +
          '<p class="dam-branding-empty__desc">Żaden produkt nie pasuje do aktywnego wyszukiwania.</p>' +
          filters +
          clearBtn +
          "</div>"
      ) +
      "</div></div>"
    );
  }

  var _renderGridScheduled = false;

  function renderGrid(grid, statusEl) {
    var rows = filteredRows();
    if (!state.all.length) {
      grid.innerHTML =
        '<div class="col-12"><p class="dam-page-status">Brak projektów. Kliknij <strong>Odśwież listę</strong> albo poproś administratora o <strong>Skanuj dysk</strong>.</p></div>';
    } else if (!rows.length) {
      grid.innerHTML = projectsEmptySearchHtml();
      var clearBtn = grid.querySelector(".dam-projects-clear-filters");
      if (clearBtn) {
        clearBtn.addEventListener("click", clearProjectsSearchFilters);
      }
    } else {
      grid.innerHTML = rows.map(renderCard).join("");
      if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
        grid._damBadgesBound = false;
        window.DamBadges.bindClicks(grid, "project");
      }
      if (window.DamIcons && typeof window.DamIcons.bindChecklistRows === "function") {
        window.DamIcons.bindChecklistRows(grid);
      } else if (window.DamIcons && typeof window.DamIcons.bindWinButtons === "function") {
        window.DamIcons.bindWinButtons(grid);
      }
      revealProjectCards(grid);
      bindProjectGridIndexDelegation(grid);
      if (!grid._damProjectsRecentBound) {
        grid._damProjectsRecentBound = true;
        grid.addEventListener("click", function (e) {
          var link = e.target && e.target.closest
            ? e.target.closest("a[href*='project.html?id='], a[href*='explorer.html?product=']")
            : null;
          if (!link) return;
          var card = link.closest("[data-product-id]");
          if (card && card.getAttribute("data-product-id")) {
            touchRecentProject(card.getAttribute("data-product-id"));
          }
        });
      }
    }
    state.shown = rows.length;
    paintStatus(statusEl);
  }

  /* "2026-10-07T09:08:45" (generated_at spisu) -> "07.10 09:08". */
  function indexStamp() {
    var idx = window._DAM_FILE_INDEX;
    return String((idx && idx.generated_at) || "");
  }

  function indexStampLabel() {
    var m = indexStamp().match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
    return m ? m[2] + "." + m[1] + " " + m[3] : "";
  }

  /* Licznik + z kiedy i skad jest spis. state.busy (trwa pobieranie / skan) zastepuje licznik,
     state.notice (wynik ostatniej akcji) stoi przed nim i przezywa kolejne przerysowania.
     state.waitSince (pierwsze pobranie katalogu z bazy) wygrywa ze wszystkim; state.fail
     (katalogu nie udalo sie pobrac) zastepuje licznik "0 produktów". */
  function paintStatus(statusEl) {
    if (!statusEl) return;
    /* Twarda spacja po "o", "z", "w" itd. - wspolny pomocnik z dam-i18n.js. */
    var pl =
      window.DamI18n && typeof window.DamI18n.nbspPl === "function"
        ? window.DamI18n.nbspPl
        : String;
    if (state.waitSince) {
      /* Sekundy w aria-hidden i odswiezane w miejscu: wiersz jest aria-live, czytnik
         ekranu ma uslyszec "Pobieram katalog z bazy..." raz, nie co sekunde. */
      statusEl.textContent = pl("Pobieram katalog z bazy...");
      _waitSpan = document.createElement("span");
      _waitSpan.setAttribute("aria-hidden", "true");
      _waitSpan.textContent = waitSeconds();
      statusEl.appendChild(_waitSpan);
      return;
    }
    if (state.busy || state.fail) {
      statusEl.textContent = pl(state.busy || state.fail);
      return;
    }
    var parts = [];
    if (state.notice) parts.push(state.notice);
    parts.push((state.query ? state.shown + " / " : "") + state.all.length + " produktów");
    if (state.variantsHint) parts.push(state.variantsHint + " wariantów");
    if (state.source === "file-index") {
      var stamp = indexStampLabel();
      parts.push(stamp ? "spis z " + stamp : "indeks Marketing");
    } else if (state.source === "local") {
      parts.push("dane lokalne");
    }
    statusEl.textContent = pl(parts.join(" · "));
    if (state.source === "file-index" && window.DamIndexSource) {
      /* Osobny wezel na kazde malowanie: spozniona odpowiedz dla starego tekstu trafia
         w odlaczony element i nie dokleja zrodla np. do "Skanuję dysk...". */
      var srcHost = document.createElement("span");
      statusEl.appendChild(srcHost);
      window.DamIndexSource.decorate(srcHost, "file-index");
    }
  }

  /** Defer heavy grid rebuild so chip clicks (Warianty) never block the click tick. */
  function scheduleRenderGrid(grid, statusEl) {
    if (_renderGridScheduled) return;
    _renderGridScheduled = true;
    setTimeout(function () {
      _renderGridScheduled = false;
      try {
        renderGrid(grid, statusEl);
      } catch (errRender) {
        console.error("[DamProjects] renderGrid failed", errRender);
      }
    }, 0);
  }

  function parseFileIndexDeferred(text) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        try {
          resolve(JSON.parse(text));
        } catch (eParse) {
          console.error("[DamProjects] file-index parse failed", eParse);
          resolve(null);
        }
      }, 0);
    });
  }

  function applyFileIndexMeta(idx) {
    if (!idx || !idx.products) return;
    var revs = 0;
    var map = {};
    var rawMap = {};
    idx.products.forEach(function (p) {
      revs += (p.revisions || []).length;
      if (p.id) {
        rawMap[p.id] = p;
        var latest = pickLatestRevision(p);
        var langs = (latest && latest.langs) || [];
        var indexes = p.indexes || p.index_bases || [];
        map[p.id] = {
          tags: p.tags || [],
          authors: p.authors || [],
          tag_groups: p.tag_groups || {},
          search_blob: p.search_blob || "",
          revisions: p.revisions || [],
          indexes: indexes,
          brand: p.brand || "DK",
          category: p.category || "",
          subcategory_slug: p.subcategory_slug || "",
          subcategory_label: p.subcategory_label || "",
          carrier: (latest && latest.carrier) || p.carrier || "",
          carrier_guessed: !!(latest && latest.carrier_guessed),
          revisionFolder: (latest && latest.folder) || "",
          langs: langs,
          index: (latest && latest.index) || (indexes[0] || ""),
          multiIndex: indexes.length > 1,
          checklist: computeWideChecklist(p, state.query),
        };
      }
    });
    state.metaById = map;
    state.rawById = rawMap;
    if (revs > state.all.length) state.variantsHint = String(revs);
    try {
      window._DAM_FILE_INDEX = idx;
    } catch (eShare) {
      /* ignore */
    }
  }

  async function loadProjects(grid, statusEl) {
    try {
      if (statusEl && !state.waitSince) statusEl.textContent = "Ładowanie...";
      var res = await DamApi.projects();
      state.fail = "";
      state.stamp = indexStamp();
      state.all = (res && res.data) || [];
      state.source = (res && res.source) || "";
      state.variantsHint = "";
      /* Paint shell immediately - never await 388MB branding-index or sync 8MB parse. */
      renderGrid(grid, statusEl);
      try {
        if (window.DamProductCorrelation && typeof DamProductCorrelation.ensureBrandingCounts === "function") {
          DamProductCorrelation.ensureBrandingCounts().then(function () {
            scheduleRenderGrid(grid, statusEl);
          });
        }
        var cached = window._DAM_FILE_INDEX;
        if (cached && cached.products) {
          applyFileIndexMeta(cached);
          scheduleRenderGrid(grid, statusEl);
        }
        if (window.DamApi && typeof window.DamApi.loadChecklistExtras === "function") {
          window.DamApi.loadChecklistExtras().then(function () {
            if (cached && cached.products) applyFileIndexMeta(cached);
            scheduleRenderGrid(grid, statusEl);
          });
        }
      } catch (ignore) {}
    } catch (e) {
      showIndexFail(grid, statusEl, e);
    }
  }

  function clockNow() {
    var d = new Date();
    return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
  }

  var _waitTimer = null;
  var _waitSpan = null;

  function waitSeconds() {
    return " " + Math.max(0, Math.round((Date.now() - state.waitSince) / 1000)) + " s";
  }

  /* Pierwsze pobranie katalogu z bazy (dam-file-index.js: zdarzenie dam:file-index-state).
     Na swiezym komputerze pliku spisu jeszcze nie ma: zamiast bledu licznik czasu, a lista
     pojawia sie sama (wiszace DamApi.projects() rozwiazuje sie, gdy spis przyjdzie). */
  function onIndexState(d, grid, statusEl) {
    clearInterval(_waitTimer);
    _waitTimer = null;
    state.waitSince = d && d.state === "waiting" ? d.since || Date.now() : 0;
    if (state.waitSince) {
      state.fail = "";
      if (!state.all.length) {
        grid.innerHTML =
          '<div class="col-12"><p class="dam-page-status">Pobieram katalog produktów z bazy. Lista pojawi się sama.</p></div>';
      }
      _waitTimer = setInterval(function () {
        if (_waitSpan) _waitSpan.textContent = waitSeconds();
      }, 1000);
    }
    /* "ready" przy pustej liscie: zostaje ostatni tekst czekania, licznik produktow
       namaluje dopiero gotowa lista (bez mrugniecia "0 produktów"). */
    if (!d || d.state !== "ready" || state.all.length) paintStatus(statusEl);
  }

  function indexFailText(e) {
    return e && e.code === "index_first_sync_failed" && e.message
      ? e.message
      : "Nie udało się wczytać spisu produktów";
  }

  /* Tekst dla czlowieka zamiast "Brak file-index.json (404)" / "Błąd API". Ponowienie = "Odśwież listę". */
  function showIndexFail(grid, statusEl, e) {
    state.fail = indexFailText(e);
    if (!state.all.length) {
      grid.innerHTML =
        '<div class="col-12"><p class="dam-page-status">' +
        esc(state.fail) +
        ". Kliknij <strong>Odśwież listę</strong>, żeby spróbować ponownie.</p></div>";
    }
    paintStatus(statusEl);
  }

  var _reload = null;

  /* Swiezy spis z serwera i przerysowanie listy. Zapytanie i sort siedza w state / polach
     strony, wiec zostaja; przewijanie przywracamy, bo siatka jest budowana od nowa.
     Nieudane pobranie nie kasuje listy. Rownolegle wywolania dziela jedno pobranie.
     alreadyFresh: ktos (naglowkowe "Pliki") wlasnie pobral swiezy spis do DamFileIndex -
     rysujemy z niego, bez drugiego pobrania 8 MB. */
  function reloadProjects(grid, statusEl, notice, alreadyFresh) {
    if (!_reload) {
      var y = window.scrollY;
      state.busy = "Pobieram aktualny spis...";
      paintStatus(statusEl);
      if (window.DamIndexSource) window.DamIndexSource.reload();
      _reload = (alreadyFresh ? DamApi.loadLocalIndex() : DamApi.reloadLocalIndex())
        .then(function () {
          state.busy = "";
          return loadProjects(grid, statusEl);
        })
        .then(
          function () {
            window.scrollTo({ top: y, behavior: "instant" });
            return true;
          },
          function (e) {
            if (!state.all.length) showIndexFail(grid, statusEl, e);
            return false;
          }
        )
        .then(function (ok) {
          _reload = null;
          state.busy = "";
          return ok;
        });
    }
    return _reload.then(function (ok) {
      state.notice = ok
        ? notice + " o " + clockNow()
        : "Nie udało się pobrać nowego spisu - lista pokazuje poprzedni";
      paintStatus(statusEl);
      return ok;
    });
  }

  function bridgeUrl() {
    var base =
      window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function"
        ? window.DamRuntime.bridgeUrl()
        : "http://127.0.0.1:8766";
    return String(base).replace(/\/+$/, "");
  }

  /* Kody mostu (POST /index/rebuild, rebuild.last_error) -> tekst dla czlowieka. */
  var SCAN_ERRORS = {
    login_required: "Sesja wygasła - zaloguj się ponownie, żeby uruchomić skan dysku",
    admin_required: "Skan dysku może uruchomić tylko administrator",
    root_partial: "Folder Marketing jest podłączony tylko częściowo - skan wstrzymany, żeby nie zgubić produktów",
    lock_held: "Inny skan dysku już trwa - poczekaj na jego koniec",
    cancelled: "Skan dysku został przerwany - lista pokazuje poprzedni spis",
    bridge_unreachable: "Most DAM nie odpowiada - nie wiadomo, czy skan się zakończył",
    bridge_no_start: "Most DAM nie odpowiada - skan nie został uruchomiony",
  };

  function scanErrorText(code, httpStatus) {
    if (httpStatus === 401) code = "login_required";
    if (httpStatus === 403) code = "admin_required";
    return SCAN_ERRORS[code] || "Skan dysku nie powiódł się - lista pokazuje poprzedni spis";
  }

  /* Blad z tekstem dla czlowieka; kazdy inny wyjatek scanDisk zamienia na tekst ogolny. */
  function scanFail(code, httpStatus) {
    var e = new Error(scanErrorText(code, httpStatus));
    e.forUser = true;
    return e;
  }

  function scanProgressText(st) {
    var p = (st && st.progress) || {};
    var text = "Skanuję dysk...";
    if (p.products_total > 0) text += " " + (p.products_done || 0) + " z " + p.products_total + " produktów";
    if (p.eta_sec > 0) text += " · jeszcze ok. " + Math.max(1, Math.round(p.eta_sec / 60)) + " min";
    return text;
  }

  function scanRunning(st) {
    if (window.DamIndexPoller && typeof window.DamIndexPoller.isRunning === "function") {
      return window.DamIndexPoller.isRunning(st);
    }
    return !!(st && (st.rebuild_running || (st.rebuild && st.rebuild.running)));
  }

  /* Czeka na koniec skanu (GET /index/status co 2 s). Bez limitu czasu: pelny skan trwa
     ok. 20 min, a "gotowe" po 2 minutach byloby nieprawda. 5 nieudanych odczytow = blad
     (odpowiedz inna niz 200 to tez nieudany odczyt, nie "skan zakonczony").
     Wynik: { st: ostatni stan, sawRunning: czy choc raz widzielismy trwajacy skan }. */
  function waitForScan(statusEl) {
    var misses = 0;
    var sawRunning = false;
    return new Promise(function (resolve, reject) {
      (function poll() {
        fetch(bridgeUrl() + "/index/status", { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) throw new Error("index_status_" + r.status);
            return r.json();
          })
          .then(function (st) {
            misses = 0;
            if (!scanRunning(st)) return resolve({ st: st, sawRunning: sawRunning });
            sawRunning = true;
            state.busy = scanProgressText(st);
            paintStatus(statusEl);
            setTimeout(poll, 2000);
          })
          .catch(function () {
            misses += 1;
            if (misses >= 5) return reject(new Error("bridge_unreachable"));
            setTimeout(poll, 2000);
          });
      })();
    });
  }

  /* "Skanuj dysk": prawdziwy skan = POST <most>/index/rebuild (tylko admin), potem swiezy spis. */
  async function scanDisk(grid, statusEl, btn) {
    /* Przycisk "nieaktywny" przez aria-disabled (dymek dziala, klawiatura go widzi):
       klikniecie mowi to samo co dymek, do mostu nic nie idzie. */
    if (state.noRoot) {
      state.notice = SCAN_NO_ROOT;
      paintStatus(statusEl);
      return;
    }
    /* Pelny skan dysku sieciowego: mowimy, ile to trwa, ZANIM ruszy. */
    if (
      !window.confirm(
        "Pełny skan folderów Marketing trwa 20-50 minut. " +
          "Do pobrania aktualnej listy wystarczy „Odśwież listę”. Uruchomić skan dysku?"
      )
    ) {
      return;
    }
    btn.disabled = true;
    var before = state.all.length;
    state.scanning = true;
    state.notice = "";
    state.busy = "Skanuję dysk... pełny skan trwa 20-50 minut";
    paintStatus(statusEl);
    try {
      /* Jak Eksplorator: najpierw odnow sesje mostu, zeby 401 znaczylo naprawde "zaloguj sie". */
      var sess = await DamApi.ensureSession().catch(function () {
        return null;
      });
      if (!sess || !sess.ok) throw scanFail("login_required");
      var r;
      try {
        r = await fetch(bridgeUrl() + "/index/rebuild", {
          method: "POST",
          headers: DamApi.authHeaders(),
          body: "{}",
        });
      } catch (eNet) {
        throw scanFail("bridge_no_start");
      }
      var data = await r.json().catch(function () {
        return {};
      });
      if (!r.ok || (data && data.ok === false)) throw scanFail(data && data.error, r.status);
      var waited;
      try {
        waited = await waitForScan(statusEl);
      } catch (eWait) {
        throw scanFail("bridge_unreachable");
      }
      var st = waited.st;
      var rb = (st && st.rebuild) || {};
      /* lock_held = skan robil juz ktos inny (obserwator). Jesli doczekalismy jego konca,
         spis jest swiezy - "poczekaj na koniec" po fakcie byloby nieprawda. */
      var othersScanDone = rb.last_error === "lock_held" && waited.sawRunning;
      if (rb.last_ok === false && !othersScanDone) throw scanFail(rb.last_error);
      state.seenGen = indexGeneration(st);
      state.busy = "";
      var ok = await reloadProjects(grid, statusEl, "Skan zakończony");
      var diff = state.all.length - before;
      if (ok && diff) {
        state.notice += diff > 0 ? " · przybyło " + diff : " · ubyło " + -diff;
        paintStatus(statusEl);
      }
    } catch (e) {
      state.busy = "";
      state.notice = e && e.forUser ? e.message : scanErrorText();
      paintStatus(statusEl);
    } finally {
      state.scanning = false;
      btn.disabled = false;
    }
  }

  /* Naglowkowe "Pliki" (dam-root-status.js) czeka na skan najwyzej 120 s i wtedy oglasza
     dam:index-refreshed, choc pelny skan trwa dalej. Ten sam znacznik spisu = nic nowego:
     nie piszemy "Odświeżono". Koniec skanu zglosi poller (zmiana znacznika). */
  function onHeaderRefreshed(grid, statusEl, detail) {
    if (state.scanning) return Promise.resolve();
    if (detail && detail.scanRunning) {
      state.notice = "Skan jeszcze trwa - lista odświeży się sama";
      paintStatus(statusEl);
      return Promise.resolve();
    }
    var before = state.stamp;
    return reloadProjects(grid, statusEl, "Odświeżono", true).then(function (ok) {
      if (!ok || !before || state.stamp !== before) return;
      state.notice = "";
      paintStatus(statusEl);
      return fetch(bridgeUrl() + "/index/status", { cache: "no-store" })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (st) {
          state.notice = scanRunning(st) ? "Skan jeszcze trwa - lista odświeży się sama" : "Spis bez zmian";
          paintStatus(statusEl);
        });
    });
  }

  var SCAN_NO_ROOT = "Ten komputer nie ma podłączonego całego folderu Marketing - skan dysku jest tu niedostępny";
  var SCAN_NO_ROOT_TIP = SCAN_NO_ROOT + ". Aktualną listę pobiera Odśwież listę.";

  /* Admin na komputerze bez zywego folderu Marketing: skan nic by nie przeczytal
     (build-file-index.py konczy "NO_MARKETING_ROOT" z kodem 0, a strona oglosilaby
     "Skan zakończony"). GET <most>/data-mode -> root_alive (true = caly folder widoczny).
     Brak odpowiedzi albo pola = przycisku nie ruszamy. Ponowne sprawdzenie przy powrocie
     do okna (dysk podlaczony pozniej). aria-disabled zamiast disabled: dam-tooltips.js
     pomija elementy disabled, a podpowiedz ma byc widac; styl .dam-int-cta[aria-disabled]
     juz istnieje. Natywny title ruszamy tylko, gdy dam-tooltips.js go nie zabral. */
  function guardScanButton(btn) {
    var title = btn.getAttribute("title");
    var tip = btn.getAttribute("data-dam-tip");
    function check() {
      return fetch(bridgeUrl() + "/data-mode", { cache: "no-store" })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (d) {
          if (!d || d.ok === false || typeof d.root_alive !== "boolean" || state.scanning) return;
          state.noRoot = !d.root_alive;
          if (state.noRoot) btn.setAttribute("aria-disabled", "true");
          else btn.removeAttribute("aria-disabled");
          btn.setAttribute("data-dam-tip", state.noRoot ? SCAN_NO_ROOT_TIP : tip);
          if (btn.hasAttribute("title")) btn.setAttribute("title", state.noRoot ? SCAN_NO_ROOT_TIP : title);
        });
    }
    window.addEventListener("focus", check);
    return check();
  }

  /* Znacznik spisu dla pollera. Swiezy komputer nie ma jeszcze pliku spisu (mtime null):
     bez wlasnej wartosci "brak" poller nie zauwazylby pierwszego pobrania z bazy. */
  function indexGeneration(st) {
    return (window.DamIndexPoller && window.DamIndexPoller.pickGeneration(st)) || "brak";
  }

  function bindProjectsSortControl(grid, statusEl) {
    var select = document.getElementById("damProjectsSort");
    if (!select || select._damBound) return;
    select._damBound = true;
    state.sortMode = readStoredSortMode();
    select.value = state.sortMode;
    select.addEventListener("change", function () {
      persistSortMode(select.value);
      scheduleRenderGrid(grid, statusEl);
    });
  }

  async function boot() {
    var grid = document.getElementById("damProjectsGrid");
    var ingestBtn = document.getElementById("damIngestBtn");
    var statusEl = document.getElementById("damProjectsStatus");
    var search = document.getElementById("damProjectsSearch");
    var refreshBtn = document.getElementById("damProjectsRefresh");
    if (!window.DamApi || !grid) return;
    state.sortMode = readStoredSortMode();
    bindProjectsSortControl(grid, statusEl);
    /* Shell ustawia sesje async - nie blokuj listy gdy requireAuth jeszcze false */
    if (typeof DamApi.requireAuth === "function") {
      try {
        DamApi.requireAuth();
      } catch (ignore) {}
    }

    if (ingestBtn) {
      /* Most wpuszcza do /index/rebuild tylko admina (_require_admin): innym rolom nie
         pokazujemy przycisku, ktory moglby tylko odmowic. */
      if (DamApi.role() !== "admin") {
        ingestBtn.classList.add("d-none");
      } else {
        ingestBtn.addEventListener("click", function () {
          scanDisk(grid, statusEl, ingestBtn);
        });
        guardScanButton(ingestBtn);
      }
    }

    if (search) {
      var restored = readStoredQuery();
      if (restored) {
        search.value = restored;
        state.query = restored;
      }
      var onSearch = function () {
        state.query = search.value || "";
        persistViewState(state.query);
        scheduleRenderGrid(grid, statusEl);
      };
      search.addEventListener("input", onSearch);
      search.addEventListener("search", onSearch);
      search.addEventListener("keyup", function (e) {
        if (e.key === "Escape") {
          search.value = "";
          onSearch();
        }
      });
      var scopeEl = document.getElementById("damProjectsSearchScope");
      var archSwitch = document.createElement("label");
      archSwitch.className = "dam-switch";
      archSwitch.setAttribute("for", "damProjectsIncludeArchive");
      archSwitch.setAttribute(
        "data-dam-tip",
        "Domyślnie ukryte foldery ARCHIWUM na dysku Marketing"
      );
      archSwitch.innerHTML =
        '<input type="checkbox" id="damProjectsIncludeArchive" class="dam-switch__input" />' +
        '<span class="dam-switch__track" aria-hidden="true"></span>' +
        '<span class="dam-switch__label">Pokaż archiwum</span>';
      try {
        var archInput = archSwitch.querySelector("#damProjectsIncludeArchive");
        if (archInput) archInput.checked = localStorage.getItem(PROJECTS_ARCHIVE_KEY) === "1";
      } catch (eArchInit) { /* ignore */ }
      archSwitch.addEventListener("change", function (e) {
        var t = e.target;
        if (!t || t.id !== "damProjectsIncludeArchive") return;
        try {
          localStorage.setItem(PROJECTS_ARCHIVE_KEY, t.checked ? "1" : "0");
        } catch (eArchStore) { /* ignore */ }
        scheduleRenderGrid(grid, statusEl);
      });
      if (scopeEl && window.DamSearch && typeof window.DamSearch.bindScopeChips === "function") {
        window.DamSearch.bindScopeChips(
          scopeEl,
          function () {
            /*
             * HARD: empty query → scope (Wszystko/Produkty/Warianty) does not change
             * the row set. Skip full card rebuild so "Warianty" never freezes UI.
             */
            if (!(state.query || "").trim()) {
              return;
            }
            scheduleRenderGrid(grid, statusEl);
          },
          { trailingEl: archSwitch }
        );
      }
      /* Sync URL/stack even when query restored from session (no input event) */
      persistViewState(state.query);
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        refreshBtn.disabled = true;
        reloadProjects(grid, statusEl, "Odświeżono").then(function () {
          refreshBtn.disabled = false;
        });
      });
    }

    /* Nowy spis (skan na tym komputerze albo pobranie z bazy) -> lista sama, bez F5.
       Ten sam rytm co Eksplorator / Wizualizacje: wspolny poller GET /index/status. */
    if (window.DamIndexPoller && typeof window.DamIndexPoller.create === "function") {
      window.DamIndexPoller.create({
        name: "projects",
        statusPath: "/index/status",
        getGeneration: indexGeneration,
        onChange: function (gen) {
          /* Wlasny skan sam przeladuje spis po zakonczeniu - bez drugiego pobrania 8 MB. */
          if (state.scanning || gen === state.seenGen) return;
          state.seenGen = gen;
          reloadProjects(grid, statusEl, "Nowy spis wczytany");
        },
      });
    }

    /* Naglowek. "Pliki" (dam-root-status.js) po skanie sam pobiera swiezy spis i oglasza
       dam:index-refreshed. "Baza" (dam-db-status.js) nie oglasza konca odswiezenia, wiec
       pamietamy klikniecie i przeladowujemy liste przy jej najblizszym dam:db-status. */
    window.addEventListener("dam:index-refreshed", function (e) {
      onHeaderRefreshed(grid, statusEl, e && e.detail);
    });
    var dbRefreshClicked = false;
    document.addEventListener(
      "click",
      function (e) {
        if (e.target && e.target.closest && e.target.closest("#damDbRefreshBtn")) dbRefreshClicked = true;
      },
      true
    );
    window.addEventListener("dam:db-status", function () {
      if (!dbRefreshClicked || state.scanning) return;
      dbRefreshClicked = false;
      reloadProjects(grid, statusEl, "Odświeżono");
    });

    if (window.DamTagBar) {
      window.DamTagBar.bind({
        tagsEl: "damProjectsTags",
        inputEl: "damProjectsSearch",
      });
    }

    var revealLow = document.getElementById("damRevealLowTags");
    if (revealLow && window.DamBadges && typeof window.DamBadges.setRevealLowTags === "function") {
      try {
        revealLow.checked = localStorage.getItem("dam_reveal_low_tags") === "1";
      } catch (eRev) { /* ignore */ }
      revealLow.addEventListener("change", function () {
        window.DamBadges.setRevealLowTags(revealLow.checked);
        renderGrid(grid, statusEl);
      });
    }
    document.addEventListener("dam-tag-tiers-changed", function () {
      renderGrid(grid, statusEl);
    });

    /* Inny skrypt mogl zaczac czekac na katalog przed nami - stan czytamy tez na starcie. */
    window.addEventListener("dam:file-index-state", function (e) {
      onIndexState(e.detail, grid, statusEl);
    });
    if (window.DamFileIndex && typeof window.DamFileIndex.state === "function") {
      var idxState = window.DamFileIndex.state();
      if (idxState.state === "waiting") onIndexState(idxState, grid, statusEl);
    }

    await loadProjects(grid, statusEl);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();