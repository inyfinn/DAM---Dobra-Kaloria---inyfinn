(function () {
  "use strict";

  /* Etykiety ludzkie - jak w Eksploratorze (nie kody API: artwork / viz_3d) */
  var ROLE_META = {
    artwork: { label: "Projekt graficzny", icon: "uil-palette" },
    viz_3d: { label: "Wizualizacje", icon: "uil-cube" },
    print_pdf: { label: "Pliki do druku", icon: "uil-file-alt" },
    tech: { label: "Specyfikacja techniczna", icon: "uil-clipboard-notes" },
  };

  var state = {
    all: [],
    source: "",
    query: "",
    variantsHint: "",
    metaById: {},
  };

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

  var CHECK_ROLES = ["artwork", "viz_3d", "print_pdf"];

  function renderGaps(p) {
    var missing = p.missing_roles || [];
    var missSet = {};
    missing.forEach(function (r) {
      missSet[r] = true;
    });
    var isComplete = p.completeness === "complete" || missing.length === 0;

    /* Jedna ikona na wiersz (status), bez drugiej ikony roli. Pelna lista: co jest / czego brak. */
    var rows = CHECK_ROLES.map(function (r) {
      var m = roleMeta(r);
      var bad = !!missSet[r];
      var cls = bad ? "dam-check-brak" : "dam-check-ok";
      var icon = bad ? "uil-times-circle" : "uil-check-circle";
      return (
        '<div class="' +
        cls +
        '">' +
        '<i class="uil ' +
        icon +
        ' dam-check-icon" aria-hidden="true"></i>' +
        '<span class="dam-check-label">' +
        m.label +
        "</span></div>"
      );
    }).join("");

    var head = isComplete
      ? '<div class="dam-card-checklist__head">Materialy kompletne</div>'
      : '<div class="dam-card-checklist__head dam-card-checklist__head--miss">Brakuje materialow</div>';

    return (
      '<div class="dam-card-checklist" aria-label="Kompletnosc materialow">' +
      head +
      rows +
      "</div>"
    );
  }

  function renderCard(p) {
    var meta = statusMeta(p.completeness);
    var listHtml = renderGaps(p);
    return (
      '<div class="col-12 col-md-6 col-xl-4">' +
      '<article class="dam-project-card ' +
      meta.cls +
      '">' +
      '<div class="dam-project-card__top">' +
      '<span class="dam-status ' +
      meta.badge +
      '">' +
      meta.label +
      "</span>" +
      '<span class="dam-meta">' +
      (p.product_index || "") +
      "</span></div>" +
      '<h3 class="dam-project-card__title">' +
      (p.title || "Projekt") +
      "</h3>" +
      '<p class="dam-project-card__sub">' +
      (p.market ? "Rynek " + p.market : "Wariant DAM") +
      "</p>" +
      listHtml +
      '<div class="dam-project-card__actions">' +
      '<a class="geex-btn geex-btn--primary geex-btn--sm" href="explorer.html?product=' +
      encodeURIComponent(p.id) +
      '" title="Otworz w eksploratorze"><i class="uil uil-folder-open" aria-hidden="true"></i><span>Eksplorator</span></a>' +
      '<a class="geex-btn geex-btn--sm" href="project.html?id=' +
      encodeURIComponent(p.id) +
      '" title="Checklista kompletnosci"><i class="uil uil-check-square" aria-hidden="true"></i><span>Checklista</span></a>' +
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
    var groupTags = ["smak", "typ", "opakowanie", "autor", "osoba"]
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
        '<div class="col-12"><p class="dam-page-status">Brak projektow. Kliknij <strong>Wczytaj z dysku</strong> (admin) albo odswiez indeks w Eksploratorze.</p></div>';
    } else if (!rows.length) {
      grid.innerHTML =
        '<div class="col-12"><p class="dam-page-status">Brak wynikow dla: <strong>' +
        (state.query || "") +
        "</strong></p></div>";
    } else {
      grid.innerHTML = rows.map(renderCard).join("");
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
          rows.length + " / " + state.all.length + " produktow" + variantsHint + src;
      } else {
        statusEl.textContent =
          state.all.length + " produktow" + variantsHint + src;
      }
    }
  }

  async function loadProjects(grid, statusEl) {
    try {
      if (statusEl) statusEl.textContent = "Ladowanie...";
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
              map[p.id] = {
                tags: p.tags || [],
                authors: p.authors || [],
                tag_groups: p.tag_groups || {},
                search_blob: p.search_blob || "",
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
      if (statusEl) statusEl.textContent = "Blad API";
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
                " produktow, " +
                (res.data.assets || 0) +
                " plikow";
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
      var onSearch = function () {
        state.query = search.value || "";
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
