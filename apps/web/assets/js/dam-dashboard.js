/**
 * DAM ETA - Dashboard controller
 * Fills summary cards and task list from Asana data + API
 */
(function () {
  "use strict";

  function formatDate(str) {
    if (!str) return "-";
    try {
      var d = new Date(str);
      return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch (e) { return str; }
  }

  function sectionBadge(section) {
    if (!section) return "";
    var cls = "geex-badge--primary-transparent";
    if (section === "Dzis" || section === "Dziś") cls = "geex-badge--danger-transparent";
    else if (section === "Ten Tydzien" || section === "Ten Tydzień") cls = "geex-badge--warning-transparent";
    else if (section === "Odlozone w czasie" || section === "Odłożone w czasie") cls = "geex-badge--success-transparent";
    return '<span class="geex-badge ' + cls + '" style="font-size:11px">' + (section || "") + '</span>';
  }

  function fillCards(data) {
    var tasks = data.tasks || [];
    var openTasks = tasks.filter(function (t) { return t.status === "open"; });

    // Card1/3/4: projekty + kompletnosc (API z fallbackiem lokalnym w DamApi)
    var card1Val = document.getElementById("damCard1Val");
    var card3Val = document.getElementById("damCard3Val");
    var card4Val = document.getElementById("damCard4Val");
    if (window.DamApi && (card1Val || card3Val || card4Val)) {
      DamApi.projects()
        .then(function (res) {
          var rows = (res && res.data) || [];
          var complete = rows.filter(function (p) { return p.completeness === "complete"; }).length;
          if (card1Val) card1Val.textContent = String(rows.length);
          if (card3Val) card3Val.textContent = String(complete);
          if (card4Val) card4Val.textContent = String(rows.length - complete);
        })
        .catch(function () {
          if (card1Val) card1Val.textContent = "3";
          if (card3Val) card3Val.textContent = "1";
          if (card4Val) card4Val.textContent = "2";
        });
    }

    // Card2: otwarte zadania Asana
    var card2Val = document.getElementById("damCard2Val");
    if (card2Val) card2Val.textContent = data.open || openTasks.length;

    // Balance card - sum of open project costs from project-costs.json
    var balanceTitle = document.getElementById("damBalanceTitle");
    var balanceTime = document.getElementById("damBalanceTime");
    if (balanceTime) {
      var now = new Date();
      balanceTime.textContent = now.toLocaleDateString("pl-PL", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      });
    }
    if (balanceTitle) {
      balanceTitle.textContent = "...";
      fetch("data/project-costs.json?v=" + Date.now())
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) {
            balanceTitle.textContent = "-";
            return;
          }
          window._DAM_PROJECT_COSTS = data;
          var sum = typeof data.sum_open_projects === "number"
            ? data.sum_open_projects
            : (data.projects || []).reduce(function (acc, p) {
                return acc + (p.open_tasks > 0 ? (p.total || 0) : 0);
              }, 0);
          balanceTitle.textContent = Math.round(sum).toLocaleString("pl-PL") + " PLN";
          var chip = document.getElementById("damBalanceChip") ||
            document.querySelector(".geex-content__summary__balance__time + *");
          // Prefer explicit chip with i18n if present
          var autoChip = document.querySelector("[data-i18n='dash.balance_chip']");
          if (autoChip) autoChip.textContent = "Wyliczone automatycznie";
        })
        .catch(function () {
          balanceTitle.textContent = "-";
        });
    }
  }

  function fillTaskList(data) {
    var tasks = (data.tasks || []).filter(function (t) { return t.status === "open"; }).slice(0, 12);
    var container = document.getElementById("damTaskList");
    if (!container) return;

    if (!tasks.length) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#888">Brak otwartych zadan Asana</div>';
      return;
    }

    container.innerHTML = tasks.map(function (task) {
      var assignee = task.assignee || "-";
      var due = formatDate(task.due);
      var project = task.project || task.parent || "-";
      var section = sectionBadge(task.section);

      return '<div class="geex-content__todo__list__single">' +
        '<div class="geex-content__todo__list__single__text" style="flex:2;min-width:0">' +
        '<h6 style="margin:0;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + task.name + '">' + task.name + '</h6>' +
        '<p style="margin:0;font-size:11px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + project + '</p>' +
        '</div>' +
        '<div class="geex-content__todo__list__single__text" style="min-width:80px">' +
        '<span style="font-size:12px">' + assignee.split(" ")[0] + '</span>' +
        '</div>' +
        '<div class="geex-content__todo__list__single__text" style="min-width:80px">' +
        '<span style="font-size:12px;color:' + (task.due && new Date(task.due) < new Date() ? "#ff5653" : "#888") + '">' + due + '</span>' +
        '</div>' +
        '<div class="geex-content__todo__list__single__text">' +
        section +
        '</div>' +
        '</div>';
    }).join("");
  }

  function fillSidePanel(data) {
    var tasks = (data.tasks || []).filter(function (t) { return t.status === "open"; }).slice(0, 6);
    var asanaList = document.getElementById("damPanelAsanaList");
    var teamsList = document.getElementById("damPanelTeamsList");
    if (asanaList) {
      asanaList.innerHTML = tasks.map(function (task) {
        return '<li style="padding:10px 0;border-bottom:1px solid #f0f0f0">' +
          '<div style="font-size:13px;font-weight:500">' + task.name + '</div>' +
          '<div style="font-size:11px;color:#888">' + (task.section || "") + (task.due ? " - " + task.due : "") + '</div>' +
          '</li>';
      }).join("") || '<li style="padding:12px;color:#888">Brak otwartych zadan</li>';
    }
    if (teamsList) {
      var teams = [
        { from: "Anna Polanska", msg: "Prosze sprawdzic projekt Tuba Prezentowa." },
        { from: "Marek Paluszewski", msg: "Karta wprowadzenia gotowa do przejrzenia." },
        { from: "Karolina Kubara", msg: "Potrzebujemy grafiki do nowej linii." }
      ];
      teamsList.innerHTML = teams.map(function (m) {
        return '<li style="padding:10px 0;border-bottom:1px solid #f0f0f0">' +
          '<div style="font-size:13px;font-weight:500">' + m.from + '</div>' +
          '<div style="font-size:12px;color:#555">' + m.msg + '</div></li>';
      }).join("");
    }
  }

  function init() {
    fetch("data/asana-tasks.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        window._DAM_ASANA_TASKS = (data.tasks || []).filter(function (t) { return t.status === "open"; });
        fillCards(data);
        fillTaskList(data);
        fillSidePanel(data);
        if (window.DamShell) DamShell.loadAsanaTasks(function () {});
      })
      .catch(function (e) {
        console.warn("DAM Dashboard: could not load asana-tasks.json", e);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
