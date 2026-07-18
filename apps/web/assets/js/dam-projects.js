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

  var state = {
    all: [],
    source: "",
    query: "",
    variantsHint: "",
    metaById: {},
  };

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
      return { cls: "dam-project-card--ok", badge: "dam-status--ok", label: "Kompletny" };
    }
    if (status === "incomplete") {
      return { cls: "dam-project-card--incomplete", badge: "dam-status--missing", label: "Niekompletny" };
    }
    return { cls: "dam-project-card--warn", badge: "dam-status--warn", label: "Do weryfikacji" };
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

  function pickLatestRevision(product) {
    var revs = (product && product.revisions) || [];
    if (!revs.length) return null;
    for (var i = 0; i < revs.length; i++) {
      if (revs[i] && revs[i].is_latest) return revs[i];
    }
    return revs[0];
  }

  /* Mini-checklista jak Eksplorator - z najnowszej rewizji produktu. */
  function computeWideChecklist(product) {
    var rev = pickLatestRevision(product);
    var fbr = (rev && rev.files_by_role) || {};
    var src = fbr.source || [];
    var prt = fbr.print || [];
    var viz = (fbr.viz || []).filter(function (f) {
      return isVizImageName(f.name);
    });
    var wizki = ((rev && rev.wizki) || []).filter(function (f) {
      return isVizImageName(f.name);
    });
    var elements = fbr.elements || [];
    var archivePrint = []
      .concat(fbr.viz || [])
      .concat((rev && rev.wizki) || [])
      .filter(function (f) {
        return isArchiveName(f.name);
      });

    var artwork = src.some(function (f) {
      var e = fileExt(f.name);
      return e === "ai" || e === "psd" || e === "indd";
    });

    var prev = src.some(function (f) {
      var u = String(f.name || "").toUpperCase();
      return /\bPREV\b/.test(u) || (/[-_]F([-_.]|$)/.test(u) && !/FQ/.test(u));
    });

    var print_pdf =
      prt.length > 0 ||
      archivePrint.length > 0 ||
      src.some(function (f) {
        var u = String(f.name || "").toUpperCase();
        return /FQ/.test(u) && fileExt(f.name) === "pdf";
      });

    var viz_3d = viz.length > 0 || wizki.length > 0;

    var tech =
      elements.length > 0 ||
      ((rev && rev.slots) || []).some(function (s) {
        var su = String(s).toUpperCase();
        return su.indexOf("ELEMENTY") >= 0 || su.indexOf("ELEMENTS") >= 0 || su.indexOf("TECH") >= 0;
      });

    var marketing = ((product && product.related_materials) || []).some(function (m) {
      return m && m.file_count > 0;
    });

    var karta =
      ((fbr.karty_wprowadzenia || []).length > 0) ||
      src.some(function (f) {
        var u = String(f.name || "").toUpperCase();
        return /KARTA/.test(u) && /WPROWADZ/.test(u);
      });

    var presentation =
      ((fbr.strategia || []).length > 0) ||
      src.some(function (f) {
        var e = fileExt(f.name);
        var u = String(f.name || "").toUpperCase();
        return (e === "pptx" || e === "ppt" || e === "key") &&
          (/PREZENT|STRATEG|POZYCJON/.test(u));
      });

    return {
      artwork: !!artwork,
      prev: !!prev,
      print_pdf: !!print_pdf,
      viz_3d: !!viz_3d,
      tech: !!tech,
      marketing: !!marketing,
      karta: !!karta,
      presentation: !!presentation,
    };
  }

  function renderGaps(p) {
    var meta = state.metaById[p.id] || {};
    var flags = meta.checklist || null;
    var missing = p.missing_roles || [];
    var missSet = {};
    missing.forEach(function (r) {
      missSet[r] = true;
    });
    var folderPath = p.path || "";
    var pathEsc = String(folderPath).replace(/"/g, "&quot;");
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
      } else if (r === "tech") {
        var assets = (((p.variants || [])[0] || {}).assets) || [];
        ok = assets.some(function (a) {
          return a.asset_role === "tech" && a.current_revision_id;
        });
      } else {
        ok = false;
      }
      var cls = ok ? "dam-check-ok" : "dam-check-brak";
      var icon = ok ? "uil-check-circle" : "uil-times-circle";
      var actions = "";
      if (ok) {
        actions =
          '<span class="dam-check-row__actions" hidden>' +
          '<a class="geex-btn geex-btn--sm dam-btn-icon dam-check-go" href="explorer.html?product=' +
          encodeURIComponent(p.id) +
          '" title="Przejdź do Eksplorera" data-dam-tip="Otwórz slot w Eksplorerze">' +
          '<i class="uil uil-arrow-right" aria-hidden="true"></i><span>Przejdź</span></a>' +
          '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-btn-icon-only dam-win-btn dam-check-win" data-path="' +
          pathEsc +
          '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwórz folder w Eksploratorze plików Windows">' +
          winIcon +
          "</button></span>";
      }
      return (
        '<div class="' +
        cls +
        (ok ? " dam-check-row--interactive" : "") +
        '" data-path="' +
        pathEsc +
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
        }) +
        "</div>"
      );
    }
    var tg = meta.tag_groups || {};
    var chips = []
      .concat(tg.smak || [])
      .concat(tg.typ || [])
      .concat(tg.opakowańie || [])
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
    var idx = p.product_index || (state.metaById[p.id] && state.metaById[p.id].index) || "";
    if (!idx) return "";
    if (window.DamBadges && typeof window.DamBadges.render === "function") {
      return (
        '<div class="dam-project-card__index-corner">' +
        window.DamBadges.render({
          index: idx,
          compact: true,
          maxTotal: 1,
          showCarrierPlaceholder: false,
        }) +
        "</div>"
      );
    }
    return (
      '<div class="dam-project-card__index-corner">' +
      '<button type="button" class="dam-viz-badge dam-badge-tag dam-viz-badge--index" data-tag-kind="index" data-tag-value="' +
      String(idx).replace(/"/g, "&quot;") +
      '">' +
      String(idx).replace(/</g, "&lt;") +
      "</button></div>"
    );
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
    var href = "explorer.html?product=" + encodeURIComponent(p.id);
    return (
      '<h3 class="dam-project-card__title">' +
      '<a class="dam-project-card__title-link" href="' +
      href +
      '" title="Otwórz w Eksplorerze" data-dam-tip="Eksplorer - hub plików produktu">' +
      String(label).replace(/</g, "&lt;") +
      "</a></h3>"
    );
  }

  function renderCard(p) {
    var meta = statusMeta(p.completeness);
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
      ? '<a class="geex-btn dam-btn-icon dam-btn-icon-only dam-project-asana-btn" href="' +
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
      '<span class="dam-status ' +
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
      '<a class="geex-btn geex-btn--primary dam-btn-icon dam-project-check-btn" href="project.html?id=' +
      encodeURIComponent(p.id) +
      '" title="Sprawdź projekt" data-dam-tip="Checklista i szczegóły projektu">' +
      '<i class="uil uil-arrow-right" aria-hidden="true"></i><span>Sprawdź projekt</span></a>' +
      '<a class="geex-btn dam-btn-icon dam-project-go-btn" href="explorer.html?product=' +
      encodeURIComponent(p.id) +
      '" title="Przejdź" data-dam-tip="Otwórz produkt w Eksplorerze">' +
      '<i class="uil uil-sitemap" aria-hidden="true"></i><span>Przejdź</span></a>' +
      '<button type="button" class="geex-btn dam-btn-icon dam-btn-icon-only dam-project-win-btn dam-win-btn" data-path="' +
      pathEsc +
      '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwiera folder w Eksploratorze plików Windows">' +
      winIcon +
      "</button>" +
      asanaBtn +
      "</div>" +
      "</article></div>"
    );
  }

  function haystack(p) {
    var missing = (p.missing_roles || [])
      .map(function (r) {
        return (ROLE_META[r] && ROLE_META[r].label) || r;
      })
      .join(" ");
    var meta = state.metaById[p.id] || {};
    var tags = (meta.tags || []).join(" ");
    var authors = (meta.authors || []).join(" ");
    var tg = meta.tag_groups || {};
    var groupTags = ["smak", "typ", "opakowańie", "autor", "osoba"]
      .map(function (k) {
        return (tg[k] || []).join(" ");
      })
      .join(" ");
    return [
      p.id,
      p.product_index,
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
      meta.search_blob || "",
    ]
      .join(" ")
      .toLowerCase();
  }

  function filteredRows() {
    var q = (state.query || "").trim().toLowerCase();
    if (!q) return state.all.slice();
    var parts = q.split(/\s+/).filter(Boolean);
    return state.all.filter(function (p) {
      var h = haystack(p);
      return parts.every(function (part) {
        return h.indexOf(part) !== -1;
      });
    });
  }

  function renderGrid(grid, statusEl) {
    var rows = filteredRows();
    if (!state.all.length) {
      grid.innerHTML =
        '<div class="col-12"><p class="dam-page-status">Brak projektów. Kliknij <strong>Wczytaj z dysku</strong> (admin) albo odśwież indeks w Eksplorerze.</p></div>';
    } else if (!rows.length) {
      grid.innerHTML =
        '<div class="col-12"><p class="dam-page-status">Brak wyników dla: <strong>' +
        (state.query || "") +
        "</strong></p></div>";
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
    }
    if (statusEl) {
      var src =
        state.source === "file-index"
          ? " · indeks Marketing"
          : state.source === "local"
            ? " · dane lokalne"
            : "";
      var variantsHint = state.variantsHint ? " · " + state.variantsHint + " wariantow" : "";
      if (state.query) {
        statusEl.textContent =
          rows.length + " / " + state.all.length + " produktów" + variantsHint + src;
      } else {
        statusEl.textContent =
          state.all.length + " produktów" + variantsHint + src;
      }
    }
  }

  async function loadProjects(grid, statusEl) {
    try {
      if (statusEl) statusEl.textContent = "Ładowanie...";
      var res = await DamApi.projects();
      state.all = (res && res.data) || [];
      state.source = (res && res.source) || "";
      state.variantsHint = "";
      try {
        var idx = await fetch("./data/file-index.json", { cache: "no-store" }).then(function (r) {
          return r.ok ? r.json() : null;
        });
        if (idx && idx.products) {
          var revs = 0;
          var map = {};
          idx.products.forEach(function (p) {
            revs += (p.revisions || []).length;
            if (p.id) {
              var latest = pickLatestRevision(p);
              var langs = (latest && latest.langs) || [];
              var indexes = p.indexes || p.index_bases || [];
              map[p.id] = {
                tags: p.tags || [],
                authors: p.authors || [],
                tag_groups: p.tag_groups || {},
                search_blob: p.search_blob || "",
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
                checklist: computeWideChecklist(p),
              };
            }
          });
          state.metaById = map;
          if (revs > state.all.length) state.variantsHint = String(revs);
        }
      } catch (ignore) {}
      renderGrid(grid, statusEl);
    } catch (e) {
      grid.innerHTML = '<div class="col-12"><p class="text-danger">' + e.message + "</p></div>";
      if (statusEl) statusEl.textContent = "Błąd API";
    }
  }

  async function boot() {
    var grid = document.getElementById("damProjectsGrid");
    var ingestBtn = document.getElementById("damIngestBtn");
    var statusEl = document.getElementById("damProjectsStatus");
    var search = document.getElementById("damProjectsSearch");
    var refreshBtn = document.getElementById("damProjectsRefresh");
    if (!window.DamApi || !grid) return;
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
        renderGrid(grid, statusEl);
      };
      search.addEventListener("input", onSearch);
      search.addEventListener("search", onSearch);
      search.addEventListener("keyup", function (e) {
        if (e.key === "Escape") {
          search.value = "";
          onSearch();
        }
      });
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

    await loadProjects(grid, statusEl);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
