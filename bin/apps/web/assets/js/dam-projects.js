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
    var multi = indexes.length > 1;
    var html =
      '<div class="dam-project-card__index-corner' +
      (multi ? " dam-project-card__index-corner--multi" : "") +
      '">';
    indexes.slice(0, 3).forEach(function (ix) {
      if (window.DamBadges && typeof window.DamBadges.render === "function") {
        html +=
          window.DamBadges.render({
            index: ix,
            compact: true,
            maxTotal: 1,
            showCarrierPlaceholder: false,
          });
      } else {
        html +=
          '<button type="button" class="dam-viz-badge dam-badge-tag dam-viz-badge--index" data-tag-kind="index" data-tag-value="' +
          String(ix).replace(/"/g, "&quot;") +
          '">' +
          String(ix).replace(/</g, "&lt;") +
          "</button>";
      }
    });
    html += "</div>";
    return html;
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

  function parseFolderDateScore(folderName) {
    var s = String(folderName || "");
    var m = s.match(/(\d{1,2})[./_-](\d{1,2})[./_-](\d{2,4})/);
    if (m) {
      var y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      return y * 10000 + parseInt(m[2], 10) * 100 + parseInt(m[1], 10);
    }
    m = s.match(/\b(\d{1,2})[./_-](\d{2})\b/);
    if (m) return (2000 + parseInt(m[2], 10)) * 10000 + parseInt(m[1], 10) * 100;
    return 0;
  }

  function projectDateScore(p) {
    var meta = state.metaById[p.id] || {};
    var raw = rawProduct(p);
    var best = 0;
    var rev = pickLatestRevision(raw || p, state.query);
    var folder =
      (rev && (rev.folder || rev.revision_folder)) ||
      meta.revisionFolder ||
      "";
    best = Math.max(best, parseFolderDateScore(folder));
    if (rev && rev.revision_path) {
      var revSeg = String(rev.revision_path).replace(/\\/g, "/").split("/").pop() || "";
      best = Math.max(best, parseFolderDateScore(revSeg));
    }
    if (rev && rev.path) {
      var rpSeg = String(rev.path).replace(/\\/g, "/").split("/").pop() || "";
      best = Math.max(best, parseFolderDateScore(rpSeg));
    }
    var path = p.path || (raw && raw.path) || "";
    if (path) {
      var parts = String(path).replace(/\\/g, "/").split("/");
      for (var pi = 0; pi < parts.length; pi++) {
        best = Math.max(best, parseFolderDateScore(parts[pi]));
      }
    }
    if (raw && raw.revisions) {
      raw.revisions.forEach(function (r) {
        if (!r) return;
        if (r.folder) best = Math.max(best, parseFolderDateScore(r.folder));
        if (r.date) {
          var t = Date.parse(String(r.date || ""));
          if (t && !isNaN(t)) {
            var dt = new Date(t);
            best = Math.max(
              best,
              dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate()
            );
          }
        }
      });
    }
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
      out.sort(function (a, b) {
        var da = projectMtimeMs(a);
        var db = projectMtimeMs(b);
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
        '<div class="col-12"><p class="dam-page-status">Brak projektów. Kliknij <strong>Wczytaj z dysku</strong> (admin) albo odśwież indeks w Eksplorerze.</p></div>';
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
    if (statusEl) {
      var src =
        state.source === "file-index"
          ? " · indeks Marketing"
          : state.source === "local"
            ? " · dane lokalne"
            : "";
      var variantsHint = state.variantsHint ? " · " + state.variantsHint + " wariantów" : "";
      if (state.query) {
        statusEl.textContent =
          rows.length + " / " + state.all.length + " produktów" + variantsHint + src;
      } else {
        statusEl.textContent =
          state.all.length + " produktów" + variantsHint + src;
      }
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
      if (statusEl) statusEl.textContent = "Ładowanie...";
      var res = await DamApi.projects();
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
      grid.innerHTML = '<div class="col-12"><p class="text-danger">' + e.message + "</p></div>";
      if (statusEl) statusEl.textContent = "Błąd API";
    }
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
      var role = DamApi.role();
      if (role !== "admin" && role !== "power_user") {
        ingestBtn.classList.add("d-none");
      } else {
        ingestBtn.addEventListener("click", async function () {
          ingestBtn.disabled = true;
          if (statusEl) statusEl.textContent = "Wczytywanie z dysku Marketing...";
          try {
            var res = await DamApi.ingestPointers();
            if (statusEl) {
              statusEl.textContent =
                "Wczytano: " +
                (res.data.projects || 0) +
                " produktów, " +
                (res.data.assets || 0) +
                " plików";
            }
            await loadProjects(grid, statusEl);
          } catch (e) {
            if (statusEl) statusEl.textContent = e.message;
          } finally {
            ingestBtn.disabled = false;
          }
        });
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
        loadProjects(grid, statusEl);
      });
    }

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

    await loadProjects(grid, statusEl);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
