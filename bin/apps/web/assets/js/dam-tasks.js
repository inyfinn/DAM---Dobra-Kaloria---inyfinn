/**
 * DAM - Zadania (Asana Home kokpit). Skeleton per-element, then real data.
 */
(function (global) {
  "use strict";

  var DONE_KEY = "dam_asana_local_done_v1";
  var NOTES_KEY = "dam_tasks_private_notes_v1";
  var EXPAND_KEY = "dam_tasks_expanded_v1";
  var state = {
    tab: "upcoming",
    peopleTab: "week",
    showAllTasks: false,
    showAllProjects: false,
    tasks: [],
    source: "file",
    expanded: {},
    /* Session sticky: just-completed ids stay in current tab until tab change */
    stickyDoneIds: {},
    /* Bento chrome (move/resize) only while Dostosuj is on */
    customizeOn: false
  };

  function setTasksCustomize(on) {
    state.customizeOn = !!on;
    var bentos = document.querySelectorAll(".dam-tasks-bento");
    for (var i = 0; i < bentos.length; i++) {
      bentos[i].classList.toggle("is-tasks-customize", state.customizeOn);
    }
    if (document.body) {
      document.body.classList.toggle("dam-tasks-customize", state.customizeOn);
    }
    var btns = document.querySelectorAll("[data-customize]");
    for (var j = 0; j < btns.length; j++) {
      btns[j].setAttribute("aria-pressed", state.customizeOn ? "true" : "false");
      btns[j].classList.toggle("is-active", state.customizeOn);
    }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    var el = document.getElementById("damTasksToast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.hidden = true;
    }, 2600);
  }

  function loadDoneSet() {
    try {
      var raw = JSON.parse(localStorage.getItem(DONE_KEY) || "[]");
      var set = {};
      (Array.isArray(raw) ? raw : []).forEach(function (id) {
        set[String(id)] = true;
      });
      return set;
    } catch (e) {
      return {};
    }
  }

  function saveDoneSet(set) {
    localStorage.setItem(DONE_KEY, JSON.stringify(Object.keys(set)));
  }

  function loadExpanded() {
    try {
      return JSON.parse(localStorage.getItem(EXPAND_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function saveExpanded() {
    localStorage.setItem(EXPAND_KEY, JSON.stringify(state.expanded || {}));
  }

  function startOfDay(d) {
    var x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function parseDue(due) {
    if (!due) return null;
    var raw = String(due);
    var d = new Date(raw.length === 10 ? raw + "T12:00:00" : raw);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDue(due) {
    var d = parseDue(due);
    if (!d) return "";
    var today = startOfDay(new Date());
    var target = startOfDay(d);
    var diff = Math.round((target - today) / 86400000);
    if (diff === 0) return "Dzisiaj";
    if (diff === 1) return "Jutro";
    if (diff === -1) return "Wczoraj";
    var days = [
      "Niedziela",
      "Poniedzia\u0142ek",
      "Wtorek",
      "\u015aroda",
      "Czwartek",
      "Pi\u0105tek",
      "Sobota"
    ];
    if (diff > 1 && diff < 7) return days[target.getDay()];
    return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  }

  function looksLikeProject(s) {
    return /\(DK\)|\|\s*C\/\d+/i.test(String(s || ""));
  }

  function shortPill(s) {
    var t = String(s || "").trim();
    if (t.length > 48) return t.slice(0, 46) + "\u2026";
    return t;
  }

  function initials(name) {
    var parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function avatarColor(name) {
    var palette = ["#5c6b7a", "#6b7280", "#4a6670", "#70665c", "#5a6a5e", "#6a5a6e"];
    var h = 0;
    String(name || "").split("").forEach(function (c) {
      h = (h + c.charCodeAt(0) * 17) % palette.length;
    });
    return palette[h];
  }

  function greetName() {
    try {
      var u = JSON.parse(localStorage.getItem("dam_user") || "{}");
      if (u && u.name) return String(u.name).split(/\s+/)[0];
      if (u && u.email) return String(u.email).split("@")[0];
    } catch (e) { /* ignore */ }
    return "Krzysztof";
  }

  function formatHeroDate() {
    var d = new Date();
    try {
      var s = d.toLocaleDateString("pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long"
      });
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch (e) {
      return d.toLocaleDateString("pl-PL");
    }
  }

  /* ---------- skeleton (HARD: no "Wczytywanie…" meta) ---------- */

  function skelTaskRowHtml() {
    return (
      '<li class="dam-tasks-row dam-tasks-skel__row" aria-hidden="true">' +
      '<div class="dam-tasks-row__main">' +
      '<span class="dam-tasks-skel__gap"></span>' +
      '<span class="dam-tasks-skel__check"></span>' +
      '<span class="dam-tasks-row__body">' +
      '<span class="dam-tasks-skel__line"></span>' +
      '<span class="dam-tasks-skel__pill"></span>' +
      "</span>" +
      '<span class="dam-tasks-skel__due"></span>' +
      "</div></li>"
    );
  }

  function skelProjectTileHtml() {
    return (
      '<div class="dam-tasks-project dam-tasks-skel__tile" aria-hidden="true">' +
      '<span class="dam-tasks-skel__icon"></span>' +
      '<span class="dam-tasks-skel__line"></span>' +
      '<span class="dam-tasks-skel__line dam-tasks-skel__line--short"></span>' +
      "</div>"
    );
  }

  function skelPersonHtml() {
    return (
      '<li class="dam-tasks-person dam-tasks-skel__person" aria-hidden="true">' +
      '<span class="dam-tasks-skel__avatar"></span>' +
      '<span class="dam-tasks-row__body">' +
      '<span class="dam-tasks-skel__line"></span>' +
      '<span class="dam-tasks-skel__line dam-tasks-skel__line--short"></span>' +
      "</span></li>"
    );
  }

  function skelCommentHtml() {
    return (
      '<li class="dam-tasks-comment dam-tasks-skel__comment" aria-hidden="true">' +
      '<span class="dam-tasks-skel__line"></span>' +
      '<span class="dam-tasks-skel__line dam-tasks-skel__line--short"></span>' +
      '<span class="dam-tasks-skel__line" style="width:88%"></span>' +
      "</li>"
    );
  }

  function skeletonHomeHtml() {
    var i;
    var taskRows = "";
    for (i = 0; i < 7; i++) taskRows += skelTaskRowHtml();
    var projectTiles = "";
    for (i = 0; i < 6; i++) projectTiles += skelProjectTileHtml();
    var people = "";
    for (i = 0; i < 5; i++) people += skelPersonHtml();
    var comments = "";
    for (i = 0; i < 3; i++) comments += skelCommentHtml();

    return (
      '<header class="dam-tasks-home__hero">' +
      '<div><p class="dam-tasks-home__date">' +
      esc(formatHeroDate()) +
      '</p><h1 class="dam-tasks-home__greet">Dzie\u0144 dobry, ' +
      esc(greetName()) +
      "</h1></div>" +
      '<div class="dam-tasks-home__hero-actions" aria-hidden="true">' +
      '<span class="dam-tasks-skel__chip"></span>' +
      '<span class="dam-tasks-skel__chip" aria-hidden="true"></span>' +
      '<span class="dam-tasks-skel__chip dam-tasks-skel__chip--wide" aria-hidden="true"></span>' +
      "</div></header>" +
      '<section class="dam-tasks-ai" aria-busy="true">' +
      '<div class="dam-tasks-ai__head"><h3 class="dam-tasks-ai__title">Asystent DAM</h3></div>' +
      '<div class="dam-tasks-ai__prompts">' +
      '<span class="dam-tasks-skel__chip" aria-hidden="true"></span>' +
      '<span class="dam-tasks-skel__chip dam-tasks-skel__chip--wide" aria-hidden="true"></span>' +
      '<span class="dam-tasks-skel__chip" aria-hidden="true"></span>' +
      "</div>" +
      '<div class="dam-tasks-skel__input" aria-hidden="true"></div>' +
      "</section>" +
      '<div class="dam-tasks-bento" aria-busy="true">' +
      '<section class="dam-tasks-card dam-tasks-card--mytasks">' +
      '<div class="dam-tasks-card__head"><h3 class="dam-tasks-card__title">Moje zadania</h3></div>' +
      '<ul class="dam-tasks-list dam-tasks-skel">' +
      taskRows +
      "</ul></section>" +
      '<section class="dam-tasks-card">' +
      '<div class="dam-tasks-card__head"><h3 class="dam-tasks-card__title">Notatnik prywatny</h3></div>' +
      '<div class="dam-tasks-skel__notes" aria-hidden="true"></div>' +
      "</section>" +
      '<section class="dam-tasks-card">' +
      '<div class="dam-tasks-card__head"><h3 class="dam-tasks-card__title">Projekty</h3></div>' +
      '<div class="dam-tasks-projects dam-tasks-skel">' +
      projectTiles +
      "</div></section>" +
      '<section class="dam-tasks-card">' +
      '<div class="dam-tasks-card__head"><h3 class="dam-tasks-card__title">Osoby</h3></div>' +
      '<ul class="dam-tasks-people dam-tasks-skel">' +
      people +
      "</ul></section>" +
      '<section class="dam-tasks-card">' +
      '<div class="dam-tasks-card__head"><h3 class="dam-tasks-card__title">Komentarze</h3></div>' +
      '<ul class="dam-tasks-comments dam-tasks-skel">' +
      comments +
      "</ul></section>" +
      '<section class="dam-tasks-card dam-tasks-card--customize" aria-hidden="true">' +
      '<span class="dam-tasks-skel__chip"></span>' +
      "</section></div>"
    );
  }

  function paintSkeleton(root) {
    if (!root) return;
    root.innerHTML = skeletonHomeHtml();
    root.setAttribute("aria-busy", "true");
  }

  /* ---------- data model ---------- */

  function enrichTasks(raw) {
    var doneLocal = loadDoneSet();
    var byName = {};
    (raw || []).forEach(function (t) {
      if (t && t.name) byName[String(t.name)] = t;
    });
    var list = (raw || []).map(function (task) {
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
      var id = String(task.id || task.gid || "");
      var isDone =
        task.status === "done" ||
        task.status === "completed" ||
        !!doneLocal[id];
      var dueDate = parseDue(task.due);
      var today = startOfDay(new Date());
      var isOverdue =
        !isDone && dueDate && startOfDay(dueDate).getTime() < today.getTime();
      var dueLabel = formatDue(task.due);
      var parent = String(task.parent || "").trim();
      return {
        id: id,
        name: task.name || "Zadanie",
        parent: parent,
        project: task.project || "",
        projectPill: shortPill(project),
        assignee: task.assignee || "",
        due: task.due || "",
        dueLabel: dueLabel,
        section: task.section || "",
        status: isDone ? "done" : "open",
        isDone: isDone,
        isOverdue: !!isOverdue,
        isToday: dueLabel === "Dzisiaj",
        children: []
      };
    });

    var byId = {};
    var byNameList = {};
    list.forEach(function (t) {
      byId[t.id] = t;
      if (!byNameList[t.name]) byNameList[t.name] = [];
      byNameList[t.name].push(t);
    });

    list.forEach(function (t) {
      if (!t.parent) return;
      var parents = byNameList[t.parent] || [];
      var parentTask = parents[0];
      if (parentTask && parentTask.id !== t.id) {
        parentTask.children.push(t);
        t._childOf = parentTask.id;
      }
    });

    return list.filter(function (t) {
      return !t._childOf;
    });
  }

  function filterTab(roots, tab) {
    function match(t) {
      var id = String(t.id || "");
      var sticky =
        !!(state.stickyDoneIds && state.stickyDoneIds[id]) && !!t.isDone;
      if (tab === "done") return t.isDone;
      if (tab === "overdue") {
        if (!t.isDone && t.isOverdue) return true;
        /* Keep just-completed overdue rows visible until user leaves tab */
        return sticky;
      }
      if (!t.isDone && !t.isOverdue) return true;
      /* Keep just-completed upcoming rows visible until user leaves tab */
      return sticky;
    }
    function walk(nodes) {
      var out = [];
      (nodes || []).forEach(function (n) {
        var kids = walk(n.children || []);
        if (match(n) || kids.length) {
          out.push({
            task: n,
            children: kids
          });
        }
      });
      return out;
    }
    var tree = walk(roots);
    tree.sort(function (a, b) {
      return String(a.task.due || "9999-99-99").localeCompare(
        String(b.task.due || "9999-99-99")
      );
    });
    return tree;
  }

  function countTab(roots, tab) {
    var n = 0;
    function walk(list) {
      (list || []).forEach(function (t) {
        if (tab === "done" && t.isDone) n += 1;
        else if (tab === "overdue" && !t.isDone && t.isOverdue) n += 1;
        else if (tab === "upcoming" && !t.isDone && !t.isOverdue) n += 1;
        walk(t.children);
      });
    }
    walk(roots);
    return n;
  }

  function projectStats(roots) {
    var map = {};
    function walk(list) {
      (list || []).forEach(function (t) {
        if (!t.isDone && t.projectPill) {
          if (!map[t.projectPill]) map[t.projectPill] = 0;
          map[t.projectPill] += 1;
        }
        walk(t.children);
      });
    }
    walk(roots);
    return Object.keys(map)
      .map(function (k) {
        return { name: k, n: map[k] };
      })
      .sort(function (a, b) {
        return b.n - a.n;
      });
  }

  function peopleStats(roots) {
    var map = {};
    function ensure(name) {
      if (!map[name]) {
        map[name] = { name: name, overdue: 0, done: 0, upcoming: 0 };
      }
      return map[name];
    }
    function walk(list) {
      (list || []).forEach(function (t) {
        var a = t.assignee || "Nieprzypisane";
        var row = ensure(a);
        if (t.isDone) row.done += 1;
        else if (t.isOverdue) row.overdue += 1;
        else row.upcoming += 1;
        walk(t.children);
      });
    }
    walk(roots);
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (a, b) {
        return b.upcoming + b.overdue - (a.upcoming + a.overdue);
      });
  }

  /* ---------- render ---------- */

  function taskNodeHtml(node, depth) {
    var t = node.task;
    var kids = node.children || [];
    var hasKids = kids.length > 0;
    var open = !!state.expanded[t.id];
    var dueCls =
      "dam-tasks-due" +
      (t.isOverdue ? " is-overdue" : t.isToday ? " is-today" : "");
    var rowCls = "dam-tasks-row" + (t.isDone ? " is-done" : "");
    var href = t.id
      ? "https://app.asana.com/0/0/" + encodeURIComponent(t.id)
      : "#";

    var childHtml = "";
    if (hasKids) {
      childHtml =
        '<ul class="dam-tasks-children" data-children-of="' +
        esc(t.id) +
        '"' +
        (open ? "" : " hidden") +
        ">" +
        kids
          .map(function (c) {
            return taskNodeHtml(c, depth + 1);
          })
          .join("") +
        "</ul>";
    }

    var expandBtn = hasKids
      ? '<button type="button" class="dam-tasks-expand' +
        (open ? " is-open" : "") +
        '" data-expand="' +
        esc(t.id) +
        '" aria-expanded="' +
        (open ? "true" : "false") +
        '" aria-label="Rozwi\u0144 subtaski"><i class="uil uil-angle-' +
        (open ? "down" : "right") +
        '" aria-hidden="true"></i></button>'
      : '<span class="dam-tasks-expand is-empty" aria-hidden="true"></span>';

    var mainCols =
      depth > 0
        ? '<button type="button" class="dam-tasks-check' +
          (t.isDone ? " is-done" : "") +
          '" data-toggle-done="' +
          esc(t.id) +
          '" aria-label="Oznacz jako uko\u0144czone"></button>'
        : expandBtn +
          '<button type="button" class="dam-tasks-check' +
          (t.isDone ? " is-done" : "") +
          '" data-toggle-done="' +
          esc(t.id) +
          '" aria-label="Oznacz jako uko\u0144czone"></button>';

    return (
      '<li class="' +
      rowCls +
      '" data-task-id="' +
      esc(t.id) +
      '">' +
      '<div class="dam-tasks-row__main">' +
      mainCols +
      '<div class="dam-tasks-row__body">' +
      '<button type="button" class="dam-tasks-row__title" data-open-task="' +
      esc(t.id) +
      '" data-href="' +
      esc(href) +
      '">' +
      esc(t.name) +
      "</button>" +
      '<div class="dam-tasks-row__meta">' +
      (t.projectPill
        ? '<span class="dam-tasks-pill" title="' +
          esc(t.projectPill) +
          '">' +
          esc(t.projectPill) +
          "</span>"
        : "") +
      (hasKids
        ? '<span class="dam-tasks-source">' + kids.length + " sub</span>"
        : "") +
      "</div></div>" +
      '<span class="' +
      dueCls +
      '">' +
      esc(t.dueLabel || "\u2014") +
      "</span></div>" +
      childHtml +
      "</li>"
    );
  }

  function renderTaskList(roots) {
    var tree = filterTab(roots, state.tab);
    var limit = state.showAllTasks ? 40 : 8;
    var slice = tree.slice(0, limit);
    if (!slice.length) {
      return (
        '<li class="dam-tasks-empty">Brak zadan w tej zakladce</li>'
      );
    }
    return slice.map(function (n) {
      return taskNodeHtml(n, 0);
    }).join("");
  }

  function renderProjects(roots) {
    var rows = projectStats(roots);
    var limit = state.showAllProjects ? 12 : 5;
    var tiles =
      '<button type="button" class="dam-tasks-project dam-tasks-project--create" data-create-project="1">' +
      '<i class="uil uil-plus" aria-hidden="true"></i> Utw\u00f3rz projekt</button>';
    rows.slice(0, limit).forEach(function (r, idx) {
      tiles +=
        '<button type="button" class="dam-tasks-project" data-project="' +
        esc(r.name) +
        '">' +
        '<span class="dam-tasks-project__icon"><i class="uil uil-list-ul" aria-hidden="true"></i></span>' +
        (idx < 2 ? '<span class="dam-tasks-badge">Nowe</span>' : "") +
        '<span class="dam-tasks-project__name" title="' +
        esc(r.name) +
        '">' +
        esc(r.name) +
        "</span>" +
        '<span class="dam-tasks-project__meta">' +
        r.n +
        " zada\u0144 do wykonania wkrótce</span></button>";
    });
    if (!rows.length) {
      return (
        tiles +
        '<p class="dam-tasks-empty">Brak projektów w eksporcie Asana</p>'
      );
    }
    return tiles;
  }

  function renderPeople(roots) {
    var rows = peopleStats(roots).slice(0, 6);
    if (!rows.length) {
      return '<li class="dam-tasks-empty">Brak osób w danych Asana</li>';
    }
    return rows
      .map(function (r) {
        return (
          '<li class="dam-tasks-person">' +
          '<span class="dam-tasks-avatar" style="background:' +
          avatarColor(r.name) +
          '">' +
          esc(initials(r.name)) +
          "</span>" +
          "<div><div class=\"dam-tasks-person__name\">" +
          esc(r.name) +
          '</div><div class="dam-tasks-person__stats">' +
          '<span class="is-overdue">' +
          r.overdue +
          " po terminie</span>" +
          '<span class="is-done">Uko\u0144czono ' +
          r.done +
          "</span>" +
          "<span>" +
          r.upcoming +
          " nadchodz\u0105cych</span>" +
          "</div></div></li>"
        );
      })
      .join("");
  }

  function renderComments() {
    return (
      '<li class="dam-tasks-empty">Brak komentarzy / wzmianek w lokalnym eksporcie Asana. Po\u0142\u0105cz OAuth w Integracjach, aby pobra\u0107 mentions.</li>'
    );
  }

  function sourceLabel() {
    if (state.source === "asana-api" || state.source === "oauth") {
      return "API Asana (live)";
    }
    if (state.source === "asana-export") return "Eksport Asana";
    return "Lokalny cache";
  }

  function renderHome(root) {
    var roots = state.tasks;
    var nUp = countTab(roots, "upcoming");
    var nOd = countTab(roots, "overdue");
    var nDn = countTab(roots, "done");
    var notes = "";
    try {
      notes = localStorage.getItem(NOTES_KEY) || "";
    } catch (e) {
      notes = "";
    }

    root.setAttribute("aria-busy", "false");
    root.innerHTML =
      '<header class="dam-tasks-home__hero">' +
      "<div><p class=\"dam-tasks-home__date\">" +
      esc(formatHeroDate()) +
      '</p><h1 class="dam-tasks-home__greet">Dzie\u0144 dobry, ' +
      esc(greetName()) +
      "</h1></div>" +
      '<div class="dam-tasks-home__hero-actions">' +
      '<select class="dam-tasks-select" data-week-range aria-label="Ramy czasowe">' +
      '<option>M\u00f3j tydzie\u0144</option><option>Ten miesi\u0105c</option></select>' +
      '<span class="dam-tasks-stat"><strong>' +
      nDn +
      "</strong> uko\u0144czonych zada\u0144</span>" +
      '<span class="dam-tasks-stat"><strong>' +
      peopleStats(roots).length +
      "</strong> wsp\u00f3\u0142pracownicy</span>" +
      '<button type="button" class="dam-tasks-btn" data-customize="1" aria-pressed="false"><i class="uil uil-apps" aria-hidden="true"></i> Dostosuj</button>' +
      "</div></header>" +
      '<div class="dam-tasks-bento" data-bento-scope="tasks">' +
      '<section class="dam-tasks-ai" data-bento-id="ai">' +
      '<div class="dam-tasks-ai__head">' +
      '<h3 class="dam-tasks-ai__title"><i class="uil uil-bright" aria-hidden="true"></i> Asystent DAM</h3>' +
      '<div class="dam-tasks-ai__tabs">' +
      '<button type="button" class="dam-tasks-ai__tab is-active" data-ai-tab="ask">Zapytaj</button>' +
      '<button type="button" class="dam-tasks-ai__tab" data-ai-tab="recent">Ostatnie</button>' +
      "</div></div>" +
      '<div class="dam-tasks-ai__prompts">' +
      '<button type="button" class="dam-tasks-ai__chip" data-ai-prompt="priorytety">Podsumuj moje nadchodz\u0105ce priorytety</button>' +
      '<button type="button" class="dam-tasks-ai__chip" data-ai-prompt="osiagniecia">Podsumuj moje ostatnie osi\u0105gni\u0119cia</button>' +
      '<button type="button" class="dam-tasks-ai__chip" data-ai-prompt="uwaga">Znajd\u017a, co wymaga mojej uwagi</button>' +
      "</div>" +
      '<div class="dam-tasks-ai__input-row">' +
      '<input class="dam-tasks-ai__input" type="search" placeholder="Zapytaj, wyszukaj lub utw\u00f3rz, co tylko chcesz" data-ai-input />' +
      '<button type="button" class="dam-tasks-btn dam-tasks-btn--primary" data-ai-send>Zapytaj</button>' +
      "</div>" +
      '<p class="dam-tasks-ai__hint">Asystent DAM to stub UI (bez Asana AI). \u0179r\u00f3d\u0142o danych: ' +
      esc(sourceLabel()) +
      ".</p></section>" +
      '<section class="dam-tasks-card dam-tasks-card--mytasks" data-bento-id="mytasks">' +
      '<div class="dam-tasks-card__head">' +
      '<h3 class="dam-tasks-card__title"><i class="uil uil-lock-alt" aria-hidden="true"></i> Moje zadania</h3>' +
      '<div class="dam-tasks-card__tools">' +
      '<div class="dam-tasks-tabs" role="tablist">' +
      '<button type="button" class="dam-tasks-tab' +
      (state.tab === "upcoming" ? " is-active" : "") +
      '" data-task-tab="upcoming">Nadchodz\u0105ce (' +
      nUp +
      ")</button>" +
      '<button type="button" class="dam-tasks-tab' +
      (state.tab === "overdue" ? " is-active" : "") +
      '" data-task-tab="overdue">Zaleg\u0142e (' +
      nOd +
      ")</button>" +
      '<button type="button" class="dam-tasks-tab' +
      (state.tab === "done" ? " is-active" : "") +
      '" data-task-tab="done">Uko\u0144czone (' +
      nDn +
      ")</button>" +
      "</div>" +
      '<button type="button" class="dam-tasks-link" data-create-task="1">+ Utw\u00f3rz zadanie</button>' +
      "</div></div>" +
      '<ul class="dam-tasks-list" data-task-list>' +
      renderTaskList(roots) +
      "</ul>" +
      '<div class="dam-tasks-foot">' +
      '<button type="button" class="dam-tasks-link dam-tasks-link--muted" data-show-more-tasks="1">' +
      (state.showAllTasks ? "Poka\u017c mniej" : "Poka\u017c wi\u0119cej") +
      "</button>" +
      '<span class="dam-tasks-source">' +
      esc(sourceLabel()) +
      "</span></div></section>" +
      '<section class="dam-tasks-card dam-tasks-card--notes" data-bento-id="notes">' +
      '<div class="dam-tasks-card__head"><h3 class="dam-tasks-card__title"><i class="uil uil-lock-alt" aria-hidden="true"></i> Notatnik prywatny</h3></div>' +
      '<textarea class="dam-tasks-notes" data-notes placeholder="Prywatne notatki (zapis lokalny w przegl\u0105darce)…">' +
      esc(notes) +
      "</textarea>" +
      '<div class="dam-tasks-notes-toolbar" aria-hidden="true">' +
      '<button type="button" tabindex="-1"><i class="uil uil-plus"></i></button>' +
      '<button type="button" tabindex="-1"><i class="uil uil-bold"></i></button>' +
      '<button type="button" tabindex="-1"><i class="uil uil-italic"></i></button>' +
      '<button type="button" tabindex="-1"><i class="uil uil-list-ul"></i></button>' +
      "</div></section>" +
      '<section class="dam-tasks-card" data-bento-id="projects">' +
      '<div class="dam-tasks-card__head">' +
      '<h3 class="dam-tasks-card__title">Projekty</h3>' +
      '<div class="dam-tasks-card__tools">' +
      '<span class="dam-tasks-source">Ostatnie</span>' +
      '<a class="dam-tasks-link" href="index.html">Przegl\u0105daj projekty</a>' +
      "</div></div>" +
      '<div class="dam-tasks-projects" data-projects>' +
      renderProjects(roots) +
      "</div>" +
      '<div class="dam-tasks-foot"><button type="button" class="dam-tasks-link dam-tasks-link--muted" data-show-more-projects="1">' +
      (state.showAllProjects ? "Poka\u017c mniej" : "Poka\u017c wi\u0119cej") +
      "</button></div></section>" +
      '<section class="dam-tasks-card" data-bento-id="people">' +
      '<div class="dam-tasks-card__head">' +
      '<h3 class="dam-tasks-card__title">Osoby</h3>' +
      '<div class="dam-tasks-tabs">' +
      '<button type="button" class="dam-tasks-tab' +
      (state.peopleTab === "week" ? " is-active" : "") +
      '" data-people-tab="week">W tym tygodniu</button>' +
      '<button type="button" class="dam-tasks-tab' +
      (state.peopleTab === "month" ? " is-active" : "") +
      '" data-people-tab="month">Ten miesi\u0105c</button>' +
      "</div></div>" +
      '<ul class="dam-tasks-people" data-people>' +
      renderPeople(roots) +
      "</ul>" +
      '<div class="dam-tasks-foot"><button type="button" class="dam-tasks-link dam-tasks-link--muted" data-people-more="1">Poka\u017c wi\u0119cej</button></div></section>' +
      '<section class="dam-tasks-card" data-bento-id="comments">' +
      '<div class="dam-tasks-card__head"><h3 class="dam-tasks-card__title">Komentarze, w kt\u00f3rych mnie wspomniano</h3></div>' +
      '<ul class="dam-tasks-comments" data-comments>' +
      renderComments() +
      "</ul>" +
      '<div class="dam-tasks-foot"><button type="button" class="dam-tasks-link dam-tasks-link--muted" data-comments-more="1">Poka\u017c wi\u0119cej</button></div></section>' +
      '<section class="dam-tasks-card dam-tasks-card--customize" data-bento-id="customize">' +
      "<p>Przeci\u0105gaj i upuszczaj nowe wid\u017cety</p>" +
      '<button type="button" class="dam-tasks-btn dam-tasks-btn--primary" data-customize="1" aria-pressed="false">Dostosuj</button>' +
      "</section></div>";
    mountTasksBento(root);
  }

  function mountTasksBento(root) {
    var bento = root && root.querySelector
      ? root.querySelector(".dam-tasks-bento")
      : null;
    if (!bento || !global.DamBentoResize || typeof DamBentoResize.mount !== "function") {
      return;
    }
    DamBentoResize.mount(bento, {
      scope: "tasks",
      defaults: DamBentoResize.defaultTasksLayout(),
      noStretchIds: ["ai", "customize"],
      stackOnNarrow: true
    });
    if (state.customizeOn) setTasksCustomize(true);
  }

  function findTaskById(id, list) {
    var found = null;
    function walk(arr) {
      (arr || []).forEach(function (t) {
        if (t.id === id) found = t;
        if (!found) walk(t.children);
      });
    }
    walk(list || state.tasks);
    return found;
  }

  function bindHome(root) {
    if (!root || root._damTasksBound) return;
    root._damTasksBound = true;
    if (!document._damTasksCustomizeEsc) {
      document._damTasksCustomizeEsc = true;
      document.addEventListener("keydown", function (ev) {
        if (!state.customizeOn) return;
        if (ev.key === "Escape" || ev.key === "Esc") {
          setTasksCustomize(false);
          toast("Tryb dostosowywania wy\u0142\u0105czony.");
        }
      });
    }
    root.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;

      var tab = t.closest("[data-task-tab]");
      if (tab) {
        var nextTab = tab.getAttribute("data-task-tab") || "upcoming";
        if (nextTab !== state.tab) {
          state.stickyDoneIds = {};
        }
        state.tab = nextTab;
        renderHome(root);
        return;
      }
      var ptab = t.closest("[data-people-tab]");
      if (ptab) {
        state.peopleTab = ptab.getAttribute("data-people-tab") || "week";
        toast(
          state.peopleTab === "week"
            ? "Widok: ten tydzie\u0144 (lokalne liczniki)"
            : "Widok: ten miesi\u0105c (lokalne liczniki)"
        );
        renderHome(root);
        return;
      }
      var expand = t.closest("[data-expand]");
      if (expand) {
        var eid = expand.getAttribute("data-expand");
        state.expanded[eid] = !state.expanded[eid];
        saveExpanded();
        renderHome(root);
        return;
      }
      var doneBtn = t.closest("[data-toggle-done]");
      if (doneBtn) {
        var did = String(doneBtn.getAttribute("data-toggle-done") || "");
        var set = loadDoneSet();
        var task = findTaskById(did);
        if (task && task.isDone && !set[did]) {
          /* already done in export - keep */
          toast("Zadanie ju\u017c uko\u0144czone w eksporcie Asana");
          return;
        }
        if (!state.stickyDoneIds) state.stickyDoneIds = {};
        if (set[did]) {
          delete set[did];
          delete state.stickyDoneIds[did];
        } else {
          set[did] = true;
          /* Stay in current list (struck through) so user can uncheck */
          if (state.tab !== "done") state.stickyDoneIds[did] = true;
        }
        saveDoneSet(set);
        state.tasks = enrichTasks(state._raw || []);
        renderHome(root);
        toast(
          set[did]
            ? "Oznaczono lokalnie jako uko\u0144czone (zostaje na li\u015bcie)"
            : "Przywr\u00f3cono jako otwarte (lokalnie)"
        );
        return;
      }
      var open = t.closest("[data-open-task]");
      if (open) {
        var href = open.getAttribute("data-href");
        if (href && href !== "#") window.open(href, "_blank", "noopener");
        else toast("Brak permalinku Asana dla tego zadania");
        return;
      }
      if (t.closest("[data-create-task]")) {
        toast("Utw\u00f3rz zadanie: API Asana niedost\u0119pne (OAuth). Stub UI.");
        return;
      }
      if (t.closest("[data-create-project]")) {
        toast("Utw\u00f3rz projekt: stub UI (brak create API).");
        return;
      }
      var proj = t.closest("[data-project]");
      if (proj) {
        toast("Projekt: " + (proj.getAttribute("data-project") || ""));
        return;
      }
      if (t.closest("[data-show-more-tasks]")) {
        state.showAllTasks = !state.showAllTasks;
        renderHome(root);
        return;
      }
      if (t.closest("[data-show-more-projects]")) {
        state.showAllProjects = !state.showAllProjects;
        renderHome(root);
        return;
      }
      if (t.closest("[data-people-more]") || t.closest("[data-comments-more]")) {
        toast("Poka\u017c wi\u0119cej: brak dodatkowych danych w eksporcie");
        return;
      }
      if (t.closest("[data-customize]")) {
        setTasksCustomize(!state.customizeOn);
        toast(
          state.customizeOn
            ? "Przeci\u0105gnij kraw\u0119dzie kart (uchwyty), aby zmieni\u0107 uk\u0142ad 9\u00d721. Escape lub ponownie Dostosuj, aby zako\u0144czy\u0107."
            : "Tryb dostosowywania wy\u0142\u0105czony."
        );
        return;
      }
      var chip = t.closest("[data-ai-prompt], [data-ai-send]");
      if (chip) {
        toast("Asystent DAM: stub (bez Asana AI). Po\u0142\u0105cz integracje, aby sync.");
        return;
      }
    });

    root.addEventListener("change", function (ev) {
      var notes = ev.target && ev.target.closest
        ? ev.target.closest("[data-notes]")
        : null;
      if (notes) {
        try {
          localStorage.setItem(NOTES_KEY, notes.value || "");
        } catch (e) { /* ignore */ }
      }
    });
    root.addEventListener("input", function (ev) {
      var notes = ev.target && ev.target.matches && ev.target.matches("[data-notes]")
        ? ev.target
        : null;
      if (notes) {
        try {
          localStorage.setItem(NOTES_KEY, notes.value || "");
        } catch (e) { /* ignore */ }
      }
    });
  }

  function loadAsana() {
    return fetch("data/asana-tasks.json?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("asana_fetch_failed");
        return r.json();
      })
      .then(function (data) {
        state._raw = data.tasks || [];
        state.source =
          data.source ||
          (data.meta && data.meta.source) ||
          "file";
        state.tasks = enrichTasks(state._raw);
        return data;
      });
  }

  /**
   * Zadania NIE wymuszaja dark. Prefer dam_theme_pref, default light.
   * Naprawia race z Geex main.js (localStorage.theme=dark nadpisujacy light pref).
   */
  function ensureTasksThemeRespectsPref() {
    try {
      if (window.DamTheme && typeof DamTheme.boot === "function") {
        DamTheme.boot();
        return;
      }
      var prefRaw = localStorage.getItem("dam_theme_pref");
      var themeRaw = localStorage.getItem("theme");
      var pref = prefRaw || themeRaw || "light";
      if (pref !== "dark" && pref !== "light" && pref !== "system") pref = "light";
      var resolved = pref;
      if (pref === "system") {
        resolved =
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
      }
      if (resolved !== "dark" && resolved !== "light") resolved = "light";
      var root = document.documentElement;
      root.setAttribute("data-theme", resolved);
      root.setAttribute("data-dam-theme-pref", pref);
      try {
        root.style.colorScheme = resolved;
      } catch (e2) { /* ignore */ }
      try {
        localStorage.setItem("theme", resolved);
        if (!prefRaw) localStorage.setItem("dam_theme_pref", pref);
      } catch (e3) { /* ignore */ }
    } catch (e) { /* ignore */ }
  }

  function init() {
    var root = document.getElementById("damTasksHome");
    if (!root) return;
    ensureTasksThemeRespectsPref();
    state.expanded = loadExpanded();
    paintSkeleton(root);
    bindHome(root);

    var slow = /(?:\?|&)slowskel=1\b/.test(location.search);
    var delay = slow ? 4500 : 0;

    loadAsana()
      .then(function () {
        return new Promise(function (resolve) {
          setTimeout(resolve, delay);
        });
      })
      .then(function () {
        renderHome(root);
        if (global.DamPageReady && typeof DamPageReady.mark === "function") {
          DamPageReady.mark("tasks-home");
        }
      })
      .catch(function () {
        root.setAttribute("aria-busy", "false");
        root.innerHTML =
          '<div class="dam-tasks-card"><p class="dam-tasks-empty">' +
          "Nie udalo sie wczytac zadan Asana. Sprawdz data/asana-tasks.json albo polacz OAuth w Integracjach." +
          "</p>" +
          '<p class="dam-tasks-foot"><a class="dam-tasks-link" href="integrations.html">Integracja i produkcja</a></p></div>';
      });
  }

  /* Dashboard preview skeleton helper (shared) */
  function dashboardAsanaSkeletonHtml() {
    var rows = "";
    var i;
    for (i = 0; i < 5; i++) {
      rows +=
        '<li class="dam-asana-home__row dam-tasks-skel__row" aria-hidden="true">' +
        '<span class="dam-tasks-skel__check"></span>' +
        '<span class="dam-asana-home__main">' +
        '<span class="dam-tasks-skel__line"></span>' +
        '<span class="dam-tasks-skel__pill"></span>' +
        "</span>" +
        '<span class="dam-tasks-skel__due"></span></li>';
    }
    var mini = "";
    for (i = 0; i < 4; i++) {
      mini +=
        "<li aria-hidden=\"true\"><span class=\"dam-tasks-skel__line\"></span><span class=\"dam-tasks-skel__due\"></span></li>";
    }
    return (
      '<div class="dam-asana-home" aria-busy="true">' +
      '<p class="dam-asana-home__greet"><span class="dam-tasks-skel__line" style="width:55%"></span></p>' +
      '<div class="dam-asana-home__bento">' +
      '<section class="dam-asana-home__tasks">' +
      '<div class="dam-asana-home__tasks-head"><h4>Moje zadania</h4></div>' +
      '<ul class="dam-asana-home__list">' +
      rows +
      "</ul></section>" +
      '<aside class="dam-asana-home__rail">' +
      '<div class="dam-asana-home__card"><h4>Projekty</h4><ul class="dam-asana-home__mini">' +
      mini +
      "</ul></div>" +
      '<div class="dam-asana-home__card"><h4>Osoby</h4><ul class="dam-asana-home__mini">' +
      mini +
      "</ul></div>" +
      "</aside></div>" +
      '<p class="dam-asana-home__meta-line"><a href="tasks.html">Otw\u00f3rz Zadania</a></p></div>'
    );
  }

  global.DamTasks = {
    init: init,
    paintSkeleton: paintSkeleton,
    skeletonHomeHtml: skeletonHomeHtml,
    dashboardAsanaSkeletonHtml: dashboardAsanaSkeletonHtml
  };

  if (document.getElementById("damTasksHome")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(window);
