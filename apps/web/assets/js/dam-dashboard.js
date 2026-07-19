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

  function panelItem(title, meta) {
    return (
      '<li class="dam-dash-panel__item">' +
      '<p class="dam-dash-panel__item-title">' +
      title +
      "</p>" +
      '<p class="dam-dash-panel__item-meta">' +
      meta +
      "</p></li>"
    );
  }

  function fillSidePanel(data) {
    var tasks = (data.tasks || [])
      .filter(function (t) {
        return t.status === "open";
      })
      .slice(0, 6);
    var asanaList = document.getElementById("damPanelAsanaList");
    var teamsList = document.getElementById("damPanelTeamsList");
    if (asanaList) {
      asanaList.innerHTML =
        tasks
          .map(function (task) {
            return panelItem(
              task.name,
              (task.section || "") + (task.due ? " - " + formatDate(task.due) : "")
            );
          })
          .join("") ||
        '<li class="dam-dash-panel__item dam-dash-panel__item--empty">Brak otwartych zadan</li>';
    }
    if (teamsList) {
      var teams = [
        { from: "Anna Polanska", msg: "Prosze sprawdzic projekt Tuba Prezentowa." },
        { from: "Marek Paluszewski", msg: "Karta wprowadzenia gotowa do przejrzenia." },
        { from: "Karolina Kubara", msg: "Potrzebujemy grafiki do nowej linii." }
      ];
      teamsList.innerHTML = teams
        .map(function (m) {
          return panelItem(m.from, m.msg);
        })
        .join("");
    }

    wirePanelTabs();
  }

  function wirePanelTabs() {
    var tabs = document.querySelectorAll(".dam-dash-panel__tab");
    tabs.forEach(function (tab) {
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

  function wireCustomize(ctxRef) {
    var btn = document.getElementById("damDashCustomizeBtn");
    if (!btn || !window.DamDashWidgets) return;
    btn.addEventListener("click", function () {
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

  function init() {
    var ctxRef = { current: {} };
    wireCustomize(ctxRef);

    var pAsana = fetch("data/asana-tasks.json")
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return { tasks: [], open: 0 };
      });

    var pIndex = fetch("data/file-index.json?v=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .catch(function () {
        return {};
      });

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

    var pCatalog = window.DamFmcg && typeof DamFmcg.loadCatalog === "function"
      ? DamFmcg.loadCatalog()
      : Promise.resolve(null);

    var pFlags = loadVizFlags();

    var pProjects = window.DamApi
      ? DamApi.projects()
          .then(function (res) {
            return (res && res.data) || [];
          })
          .catch(function () {
            return [];
          })
      : Promise.resolve([]);

    Promise.all([pAsana, pIndex, pCosts, pRates, pFmcg, pFlags, pProjects, pCatalog]).then(
      function (all) {
        var asana = all[0] || { tasks: [] };
        window._DAM_ASANA_TASKS = (asana.tasks || []).filter(function (t) {
          return t.status === "open";
        });
        window._DAM_PROJECT_COSTS = all[2];

        ctxRef.current = buildCtx({
          asana: asana,
          fileIndex: all[1],
          projectCosts: all[2],
          costRates: all[3],
          fmcg: all[4],
          vizFlags: all[5],
          projects: all[6],
          catalog: all[7]
        });

        render(ctxRef.current);
        fillSidePanel(asana);

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
  window._DAM_DASH = { formatDate: formatDate, sectionBadge: sectionBadge };
})();
