/**
 * DAM - Dashboard orchestrator (widget grid + side panel)
 */
(function () {
  "use strict";

  function formatDate(str) {
    if (!str) return "-";
    try {
      var d = new Date(str);
      return d.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch (e) {
      return str;
    }
  }

  function sectionBadge(section) {
    if (!section) return "";
    var cls = "geex-badge--primary-transparent";
    if (section === "Dzis" || section === "Dziś") cls = "geex-badge--danger-transparent";
    else if (section === "Ten Tydzien" || section === "Ten Tydzień")
      cls = "geex-badge--warning-transparent";
    else if (section === "Odlozone w czasie" || section === "Odłożone w czasie")
      cls = "geex-badge--success-transparent";
    return (
      '<span class="geex-badge ' +
      cls +
      '" style="font-size:11px">' +
      (section || "") +
      "</span>"
    );
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function looksLikeProject(s) {
    return /\(DK\)|\|\s*C\/\d+/i.test(String(s || ""));
  }

  function enrichPanelTask(task, byName) {
    var project = String(task.project || "").trim();
    var walk = String(task.parent || "").trim();
    var hops = 0;
    while (!project && walk && hops < 6) {
      if (looksLikeProject(walk)) {
        project = walk;
        break;
      }
      var p = byName[walk];
      if (!p) break;
      project = String(p.project || "").trim();
      walk = String(p.parent || "").trim();
      hops += 1;
    }
    if (!project && task.parent) project = String(task.parent).trim();
    var due = task.due || "";
    var dueLabel = "";
    if (due) {
      try {
        var d = new Date(due.length === 10 ? due + "T12:00:00" : due);
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var t0 = new Date(d);
        t0.setHours(0, 0, 0, 0);
        var diff = Math.round((t0 - today) / 86400000);
        if (diff === 0) dueLabel = "Dzisiaj";
        else if (diff === 1) dueLabel = "Jutro";
        else dueLabel = formatDate(due);
      } catch (e) {
        dueLabel = formatDate(due);
      }
    }
    return {
      title: task.name || "Zadanie",
      project: project,
      dueLabel: dueLabel,
      section: task.section || ""
    };
  }

  function panelItem(title, metaHtml) {
    return (
      '<li class="dam-dash-panel__item">' +
      '<p class="dam-dash-panel__item-title">' +
      escapeHtml(title) +
      "</p>" +
      '<p class="dam-dash-panel__item-meta">' +
      metaHtml +
      "</p></li>"
    );
  }

  function fillSidePanel(data) {
    var allTasks = data.tasks || [];
    var byName = {};
    allTasks.forEach(function (t) {
      if (t && t.name) byName[String(t.name)] = t;
    });
    var tasks = allTasks
      .filter(function (t) {
        return t.status === "open";
      })
      .slice()
      .sort(function (a, b) {
        return String(a.due || "9999").localeCompare(String(b.due || "9999"));
      })
      .slice(0, 8);
    var asanaList = document.getElementById("damPanelAsanaList");
    var teamsList = document.getElementById("damPanelTeamsList");
    if (asanaList) {
      asanaList.innerHTML =
        tasks
          .map(function (task) {
            var e = enrichPanelTask(task, byName);
            var meta =
              (e.project
                ? '<span class="dam-dash-panel__pill">' +
                  escapeHtml(
                    e.project.length > 40
                      ? e.project.slice(0, 38) + "\u2026"
                      : e.project
                  ) +
                  "</span>"
                : "") +
              (e.dueLabel
                ? '<span class="dam-dash-panel__due">' +
                  escapeHtml(e.dueLabel) +
                  "</span>"
                : "") +
              (e.section && !e.project
                ? '<span class="dam-dash-panel__due">' +
                  escapeHtml(e.section) +
                  "</span>"
                : "");
            return panelItem(e.title, meta || escapeHtml("Bez terminu"));
          })
          .join("") ||
        '<li class="dam-dash-panel__item dam-dash-panel__item--empty">Brak otwartych zadan Asana</li>';
    }
    if (teamsList) {
      fillTeamsPanel(teamsList);
    }

    wirePanelTabs();
  }

  function fillTeamsPanel(teamsList) {
    fetch("data/inbox-items.json?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : { items: [] };
      })
      .then(function (data) {
        var items = ((data && data.items) || []).filter(function (it) {
          var tags = it.tags || [];
          return tags.indexOf("teams") !== -1 || it.type === "teams" || it.source === "teams";
        });
        if (!items.length && window._DAM_TEAMS_MESSAGES && window._DAM_TEAMS_MESSAGES.length) {
          items = window._DAM_TEAMS_MESSAGES;
        }
        if (!items.length) {
          teamsList.innerHTML =
            '<li class="dam-dash-panel__item dam-dash-panel__item--empty">' +
            "Brak powiadomien Teams. Polacz Microsoft w Integracjach albo poczekaj na sync." +
            "</li>";
          return;
        }
        teamsList.innerHTML = items
          .slice(0, 8)
          .map(function (m) {
            return panelItem(
              m.title || m.from || "Teams",
              escapeHtml(m.detail || m.msg || m.preview || "")
            );
          })
          .join("");
      })
      .catch(function () {
        teamsList.innerHTML =
          '<li class="dam-dash-panel__item dam-dash-panel__item--empty">' +
          "Teams niedostępny (brak sync)." +
          "</li>";
      });
  }

  function wirePanelTabs() {
    var tabs = document.querySelectorAll(".dam-dash-panel__tab");
    tabs.forEach(function (tab) {
      if (tab._damPanelBound) return;
      tab._damPanelBound = true;
      tab.addEventListener("shown.bs.tab", function () {
        tabs.forEach(function (t) {
          t.classList.toggle("is-active", t === tab);
        });
      });
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) {
          t.classList.toggle("is-active", t === tab);
        });
      });
    });
  }

  function loadVizFlags() {
    return fetch("data/viz-flags.json?v=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (data) return data;
        try {
          return JSON.parse(localStorage.getItem("dam_viz_flags") || "{}");
        } catch (e) {
          return { demo: {}, hidden: {} };
        }
      })
      .catch(function () {
        return { demo: {}, hidden: {} };
      });
  }

  function buildCtx(parts) {
    var ctx = {
      asana: parts.asana || { tasks: [] },
      projects: parts.projects || [],
      fileIndex: parts.fileIndex || {},
      projectCosts: parts.projectCosts || null,
      costRates: parts.costRates || null,
      fmcg: parts.fmcg || null,
      catalog: parts.catalog || null,
      vizFlags: parts.vizFlags || { demo: {}, hidden: {} },
      vizLatest: (parts.fileIndex && parts.fileIndex.viz_latest) || []
    };
    if (window.DamFmcg) {
      ctx.landed = DamFmcg.computeMonthLanded(ctx);
    }
    return ctx;
  }

  function render(ctx) {
    var grid = document.getElementById("damDashGrid");
    if (window.DamDashWidgets && grid) {
      DamDashWidgets.renderGrid(grid, ctx);
    }
  }

  /* Z kiedy i skad jest spis (jak Eksplorator / Projekty): "Spis z 07.10 09:08 · indeks ...". */
  function paintIndexMeta(fileIndex) {
    var el = document.getElementById("damDashIndexMeta");
    if (!el) return;
    var m = String((fileIndex && fileIndex.generated_at) || "").match(
      /^\d{4}-(\d{2})-(\d{2})T(\d{2}:\d{2})/
    );
    el.textContent = m ? "Spis z " + m[2] + "." + m[1] + " " + m[3] : "";
    if (m && window.DamIndexSource) window.DamIndexSource.decorate(el, "file-index");
  }

  /* Swiezy komputer: instalator nie niesie spisu, katalog idzie z bazy. dam-file-index.js
     oglasza to zdarzeniem "dam:file-index-state" i oddaje w DamFileIndex.state():
     { state: "waiting" | "failed" | "ready" | "idle", message: tekst PL przy "failed" }. */
  var CATALOG_WAIT_TEXT = "Pobieram katalog z bazy...";
  var CATALOG_FAIL_TEXT = "Nie udało się pobrać katalogu z bazy - sprawdź połączenie";
  var CATALOG_FAIL_NOTE = "Katalog nie został jeszcze pobrany z bazy.";

  function catalogState() {
    var FI = window.DamFileIndex;
    try {
      return (FI && typeof FI.state === "function" && FI.state()) || {};
    } catch (e) {
      return {};
    }
  }

  function catalogMissing(st) {
    return !!st && (st.state === "waiting" || st.state === "failed");
  }

  /* Tekst dla widzetow zaleznych od katalogu (zamiast "Brak ..." i zer) albo "". */
  function catalogNote(st) {
    if (!catalogMissing(st)) return "";
    return st.state === "waiting" ? CATALOG_WAIT_TEXT : CATALOG_FAIL_NOTE;
  }

  /* Wiersz statusu spisu: czekanie albo porazka. Gdy spis jest, wiersz maluje paintIndexMeta. */
  function paintCatalogState(st) {
    var el = document.getElementById("damDashIndexMeta");
    if (!el || !catalogMissing(st)) return;
    el.textContent =
      st.state === "waiting" ? CATALOG_WAIT_TEXT : String(st.message || CATALOG_FAIL_TEXT);
  }

  /* Zmiana stanu pierwszego pobrania: wiersz statusu + spokojne widzety; "ready" = wypelnij. */
  function onCatalogState(ctxRef, st) {
    st = st || {};
    if (!ctxRef.parts || !ctxRef.current) return;
    if (!catalogMissing(st)) {
      if (st.state === "ready") refreshFromIndex(ctxRef, 0, true);
      return;
    }
    paintCatalogState(st);
    var note = catalogNote(st);
    if (ctxRef.current.catalogNote === note) return;
    ctxRef.current.catalogNote = note;
    var W = window.DamDashWidgets;
    if (!(W && typeof W.isCustomizeOpen === "function" && W.isCustomizeOpen())) {
      render(ctxRef.current);
    }
  }

  /* Brak pliku spisu = DamFileIndex.get() czeka na pierwsze pobranie (nawet 3 minuty).
     Pulpit nie stoi wtedy na szkielecie: bramka puszcza pierwszy obraz z pustym katalogiem
     (zadania, koszty i reszta sa od razu), a spis doplywa sam po zdarzeniu "ready". */
  function catalogGate() {
    return new Promise(function (resolve) {
      function check(st) {
        if (!catalogMissing(st)) return;
        paintCatalogState(st);
        resolve(st);
      }
      window.addEventListener("dam:file-index-state", function (ev) {
        check(ev && ev.detail);
      });
      check(catalogState());
    });
  }

  function orEmptyCatalog(promise, gate, empty) {
    return Promise.race([
      promise,
      gate.then(function () {
        return empty;
      })
    ]);
  }

  /* Katalog kosztow FMCG idzie z mostu (/finance/fmcg-catalog) i zasila tylko koszt
     miesiaca. Gdy most jest zajety (pierwsza synchronizacja na swiezym komputerze),
     odpowiada po kilkunastu sekundach - a Pulpit stal wtedy na szkielecie z zerami, choc
     spis mial juz w pamieci (odbior C-2.5.9-110850). Pierwszy obraz czeka na katalog
     najwyzej FMCG_CATALOG_WAIT_MS; spozniony katalog dochodzi sam i przerysowuje siatke raz. */
  var FMCG_CATALOG_WAIT_MS = 1500;
  var FMCG_CATALOG_LATE = {};

  function firstPaintCatalog(pCatalog) {
    return Promise.race([
      pCatalog,
      new Promise(function (resolve) {
        setTimeout(function () {
          resolve(FMCG_CATALOG_LATE);
        }, FMCG_CATALOG_WAIT_MS);
      })
    ]);
  }

  function applyLateCatalog(ctxRef, catalog) {
    if (!catalog || !ctxRef.parts || !ctxRef.current) return false;
    ctxRef.parts.catalog = catalog;
    var note = ctxRef.current.catalogNote;
    ctxRef.current = buildCtx(ctxRef.parts);
    ctxRef.current.dashLoading = false;
    ctxRef.current.catalogNote = note;
    var W = window.DamDashWidgets;
    if (!(W && typeof W.isCustomizeOpen === "function" && W.isCustomizeOpen())) {
      render(ctxRef.current);
    }
    return true;
  }

  /* Nowy spis (skan na tym komputerze albo pobranie z bazy) -> Pulpit sam, bez F5.
     keep = wez to, co loader juz ma albo wlasnie pobiera (get), bez wymuszania nowego
     pobrania: tak wypelnia sie Pulpit po pierwszym pobraniu katalogu. */
  function refreshFromIndex(ctxRef, attempt, keep) {
    if (!ctxRef.parts || !window.DamFileIndex || typeof window.DamFileIndex.refresh !== "function") {
      return Promise.resolve(false);
    }
    /* Dwie zmiany spisu pod rzad: liczy sie tylko ostatnie pobranie. */
    var seq = (ctxRef.refreshSeq = (ctxRef.refreshSeq || 0) + 1);
    return (keep ? window.DamFileIndex.get() : window.DamFileIndex.refresh())
      .then(function (data) {
        /* DamApi przelicza projekty, gdy DamFileIndex odda nowy obiekt spisu. */
        var pProjects = window.DamApi
          ? DamApi.projects().then(function (res) {
              return (res && res.data) || [];
            })
          : Promise.resolve(ctxRef.parts.projects);
        return pProjects.then(function (projects) {
          if (seq !== ctxRef.refreshSeq) return false;
          ctxRef.parts.fileIndex = data || {};
          ctxRef.parts.projects = projects;
          ctxRef.current = buildCtx(ctxRef.parts);
          ctxRef.current.dashLoading = false;
          if (window.DamIndexSource) window.DamIndexSource.reload();
          paintIndexMeta(ctxRef.current.fileIndex);
          /* ponytail: w trakcie "Dostosuj pulpit" nie przerysowujemy siatki pod reka;
             nowe dane wejda przy Zatwierdz albo przy kolejnej zmianie spisu. */
          var W = window.DamDashWidgets;
          if (!(W && typeof W.isCustomizeOpen === "function" && W.isCustomizeOpen())) {
            render(ctxRef.current);
          }
          return true;
        });
      })
      .catch(function () {
        /* Pobranie nie wyszlo: zostaje poprzedni spis i jego data na ekranie. Poller
           uznal juz te zmiane za widziana, wiec ponawiamy sami: 2 razy co 15 s
           (spis bywa wlasnie zapisywany albo serwer plikow zajety). Przy keep nie
           ponawiamy: na brak katalogu czeka sam loader i oglasza wynik zdarzeniem. */
        if (!keep && seq === ctxRef.refreshSeq && (attempt || 0) < 2) {
          setTimeout(function () {
            if (seq === ctxRef.refreshSeq) refreshFromIndex(ctxRef, (attempt || 0) + 1);
          }, 15000);
        }
        return false;
      });
  }

  function wireCustomize(ctxRef) {
    var btn = document.getElementById("damDashCustomizeBtn");
    if (!btn || !window.DamDashWidgets) return;
    btn.addEventListener("click", function () {
      /* Edit mode: primary becomes Zatwierdz (save). */
      if (
        DamDashWidgets.isCustomizeOpen &&
        DamDashWidgets.isCustomizeOpen() &&
        typeof DamDashWidgets.confirmCustomize === "function"
      ) {
        DamDashWidgets.confirmCustomize();
        return;
      }
      DamDashWidgets.openCustomize(function () {
        render(ctxRef.current);
        if (window.DamI18n && typeof DamI18n.apply === "function") {
          try {
            DamI18n.apply(document);
          } catch (e) { /* ignore */ }
        }
      });
    });
  }

  function paintDashSkeleton() {
    var grid = document.getElementById("damDashGrid");
    if (!grid || !window.DamDashWidgets) return;
    try {
      DamDashWidgets.renderGrid(grid, {
        asana: { tasks: [] },
        asanaLoading: true,
        dashLoading: true,
        projects: [],
        fileIndex: {},
        vizFlags: { demo: {}, hidden: {} }
      });
    } catch (e) { /* ignore */ }
  }

  function init() {
    /* HARD: single boot (skeleton once, then one data paint). */
    if (window.__DAM_DASH_INIT__) return;
    window.__DAM_DASH_INIT__ = true;

    /* Karty: /thumb-cache AVIF (PAMIEC-PODRECZNA), potem /media. Nie wylaczac cache. */
    if (window.DAM_DISABLE_THUMB_WARM === true) {
      window.DAM_DISABLE_THUMB_WARM = false;
    }

    var ctxRef = { current: {} };
    wireCustomize(ctxRef);
    paintDashSkeleton();

    var pAsana = fetch("data/asana-tasks.json?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return { tasks: [], open: 0 };
      });

    var gate = catalogGate();

    /* Wspolne Promise strony (dam-file-index.js) zamiast wlasnego fetch 9 MB. */
    var pIndex = orEmptyCatalog(
      (window.DamFileIndex && typeof window.DamFileIndex.get === "function"
        ? window.DamFileIndex.get()
        : fetch("data/file-index.json?v=" + Date.now()).then(function (r) {
            return r.ok ? r.json() : {};
          })
      )
        .then(function (data) {
          /* Nie zapisuj calego indeksu w window._DAM_FILE_INDEX (RAM + explorer freeze). */
          return data || {};
        })
        .catch(function () {
          return {};
        }),
      gate,
      {}
    );

    var pCosts = fetch("data/project-costs.json?v=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });

    var pRates = fetch("data/cost-rates.json?v=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });

    var pFmcg = window.DamFmcg
      ? DamFmcg.loadAverages()
      : Promise.resolve(null);

    var pCatalogReal = (window.DamFmcg && typeof DamFmcg.loadCatalog === "function"
      ? DamFmcg.loadCatalog()
      : Promise.resolve(null)
    ).catch(function () {
      return null;
    });
    var pCatalog = firstPaintCatalog(pCatalogReal);

    var pFlags = loadVizFlags();

    /* DamApi.projects() tez czeka na spis - ta sama bramka. */
    var pProjects = window.DamApi
      ? orEmptyCatalog(
          DamApi.projects()
            .then(function (res) {
              return (res && res.data) || [];
            })
            .catch(function () {
              return [];
            }),
          gate,
          []
        )
      : Promise.resolve([]);

    Promise.all([pAsana, pIndex, pCosts, pRates, pFmcg, pFlags, pProjects, pCatalog]).then(
      function (all) {
        if (window.__DAM_DASH_DATA_PAINTED__) return;
        window.__DAM_DASH_DATA_PAINTED__ = true;

        var asana = all[0] || { tasks: [] };
        window._DAM_ASANA_TASKS = (asana.tasks || []).filter(function (t) {
          return t.status === "open";
        });
        window._DAM_PROJECT_COSTS = all[2];

        ctxRef.parts = {
          asana: asana,
          fileIndex: all[1],
          projectCosts: all[2],
          costRates: all[3],
          fmcg: all[4],
          vizFlags: all[5],
          projects: all[6],
          catalog: all[7] === FMCG_CATALOG_LATE ? null : all[7]
        };
        ctxRef.current = buildCtx(ctxRef.parts);
        ctxRef.current.dashLoading = false;
        var st0 = catalogState();
        ctxRef.current.catalogNote = catalogNote(st0);

        render(ctxRef.current);
        paintIndexMeta(ctxRef.current.fileIndex);
        paintCatalogState(st0);
        fillSidePanel(asana);

        if (all[7] === FMCG_CATALOG_LATE) {
          pCatalogReal.then(function (catalog) {
            applyLateCatalog(ctxRef, catalog);
          });
        }

        window.addEventListener("dam:file-index-state", function (ev) {
          onCatalogState(ctxRef, (ev && ev.detail) || catalogState());
        });
        /* Katalog doszedl miedzy bramka a pierwszym obrazem: ekran ma pusty spis, wypelnij. */
        if (!catalogMissing(st0) && !ctxRef.parts.fileIndex.generated_at) {
          gate.then(function () {
            refreshFromIndex(ctxRef, 0, true);
          });
        }

        /* Ten sam rytm co Eksplorator / Wizualizacje: wspolny poller GET /index/status. */
        if (window.DamIndexPoller && typeof window.DamIndexPoller.create === "function") {
          window.DamIndexPoller.create({
            name: "dashboard",
            statusPath: "/index/status",
            /* Pojawienie sie spisu, ktorego nie bylo (po nieudanym pierwszym pobraniu),
               poller sam zglasza jako zmiane (dam-index-poller.js, sawEmpty). */
            onChange: function () {
              var s = catalogState().state;
              /* Na pierwsze pobranie czeka loader i sam oglosi "ready". Po porazce
                 zmiana znacznika spisu = sprobuj od nowa (get, bez wymuszania). */
              if (s === "waiting") return;
              refreshFromIndex(ctxRef, 0, s === "failed");
            }
          });
        }

        if (window.DamShell && typeof DamShell.loadAsanaTasks === "function") {
          DamShell.loadAsanaTasks(function () {});
        }
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // expose helpers used by legacy markup if any
  window._DAM_DASH = {
    formatDate: formatDate,
    sectionBadge: sectionBadge,
    paintIndexMeta: paintIndexMeta
  };
})();
