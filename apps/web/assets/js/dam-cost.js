/**
 * DAM - Kalkulator kosztów (czytelny wybor projektu + breakdown)
 * Loads data/project-costs.json (built from Asana + cost-rates).
 */
(function () {
  "use strict";

  function easterSunday(year) {
    var a = year % 19;
    var b = Math.floor(year / 100);
    var c = year % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function toKey(date) {
    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  }

  function polishHolidays(year) {
    var easter = easterSunday(year);
    var fixed = [
      year + "-01-01",
      year + "-01-06",
      year + "-05-01",
      year + "-05-03",
      year + "-08-15",
      year + "-11-01",
      year + "-11-11",
      year + "-12-25",
      year + "-12-26",
    ];
    fixed.push(toKey(addDays(easter, 1)));
    fixed.push(toKey(addDays(easter, 60)));
    return fixed;
  }

  function workingHoursInMonth(year, month) {
    var holidays = polishHolidays(year);
    var days = 0;
    var d = new Date(year, month - 1, 1);
    while (d.getMonth() === month - 1) {
      var dow = d.getDay();
      if (dow !== 0 && dow !== 6 && holidays.indexOf(toKey(d)) === -1) days++;
      d.setDate(d.getDate() + 1);
    }
    return days * 8;
  }

  function formatPLN(val) {
    var n = Number(val) || 0;
    return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " PLN";
  }

  function formatDate(iso) {
    if (!iso) return "-";
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    return p[2] + "." + p[1] + "." + p[0];
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function t(key, fallback) {
    if (window.DamI18n) {
      var v = window.DamI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  var GENERAL_RE = /^(marketing|e-commerce|zmiany\b)/i;

  var state = {
    data: null,
    activeId: null,
    query: "",
    bucket: "product", // product | general | all
  };

  function isGeneralProject(p) {
    var name = String(p.name || p.label || "");
    return GENERAL_RE.test(name.trim()) || !(p.name || "").match(/\(DK\)|\(GC\)/i);
  }

  function projectBucket(p) {
    return isGeneralProject(p) ? "general" : "product";
  }

  function preferDefaultProject(projects) {
    var cy = projects.find(function (p) {
      return /cynamon/i.test(p.name || "") || /cynamon/i.test(p.label || "");
    });
    if (cy) return cy.id;
    var product = projects.find(function (p) {
      return projectBucket(p) === "product";
    });
    return (product || projects[0]).id;
  }

  function filteredProjects() {
    if (!state.data || !state.data.projects) return [];
    var q = state.query.trim().toLowerCase();
    return state.data.projects.filter(function (p) {
      if (state.bucket !== "all" && projectBucket(p) !== state.bucket) return false;
      if (!q) return true;
      var blob = ((p.label || "") + " " + (p.name || "") + " " + (p.id || "")).toLowerCase();
      return blob.indexOf(q) !== -1;
    });
  }

  function renderPicker(projects) {
    var mount = document.getElementById("damCostTabs");
    if (!mount) return;

    var list = filteredProjects();
    var active = projects.find(function (p) {
      return p.id === state.activeId;
    });

    var options = list
      .map(function (p) {
        var selected = p.id === state.activeId ? " selected" : "";
        var openNote = p.open_tasks ? " · otwarte: " + p.open_tasks : "";
        return (
          '<option value="' +
          escapeHtml(p.id) +
          '"' +
          selected +
          ">" +
          escapeHtml(p.label || p.name) +
          openNote +
          "</option>"
        );
      })
      .join("");

    mount.innerHTML =
      '<div class="dam-cost-picker">' +
      '<div class="dam-cost-picker__intro">' +
      "<h3 class=\"dam-cost-picker__title\">" +
      escapeHtml(t("cost.pick_title", "Wybierz projekt")) +
      "</h3>" +
      '<p class="dam-cost-picker__hint">' +
      escapeHtml(
        t(
          "cost.pick_hint",
          "Najpierw wybierz projekt. Potem zobaczysz koszt osob i koszty bezposrednie."
        )
      ) +
      "</p>" +
      "</div>" +
      '<div class="dam-cost-picker__buckets" role="tablist" aria-label="' +
      escapeHtml(t("cost.buckets", "Rodzaj projektu")) +
      '">' +
      '<button type="button" class="dam-cost-bucket' +
      (state.bucket === "product" ? " is-active" : "") +
      '" data-bucket="product">' +
      escapeHtml(t("cost.bucket_product", "Produkty opakowań")) +
      "</button>" +
      '<button type="button" class="dam-cost-bucket' +
      (state.bucket === "general" ? " is-active" : "") +
      '" data-bucket="general">' +
      escapeHtml(t("cost.bucket_general", "Marketing / e-commerce")) +
      "</button>" +
      '<button type="button" class="dam-cost-bucket' +
      (state.bucket === "all" ? " is-active" : "") +
      '" data-bucket="all">' +
      escapeHtml(t("cost.bucket_all", "Wszystkie")) +
      "</button>" +
      "</div>" +
      '<div class="dam-cost-picker__controls">' +
      '<label class="dam-cost-picker__search-wrap" for="damCostSearch">' +
      '<span class="visually-hidden">' +
      escapeHtml(t("cost.search", "Szukaj projektu")) +
      "</span>" +
      '<i class="uil uil-search" aria-hidden="true"></i>' +
      '<input type="search" id="damCostSearch" class="dam-cost-picker__search" placeholder="' +
      escapeHtml(t("cost.search_ph", "np. cynamonka")) +
      '" value="' +
      escapeHtml(state.query) +
      '" autocomplete="off" />' +
      "</label>" +
      '<label class="dam-cost-picker__select-wrap" for="damCostSelect">' +
      '<span class="dam-cost-picker__select-label">' +
      escapeHtml(t("cost.select_label", "Projekt")) +
      "</span>" +
      '<select id="damCostSelect" class="dam-cost-picker__select" aria-label="' +
      escapeHtml(t("cost.select_label", "Projekt")) +
      '">' +
      (options ||
        '<option value="">' +
          escapeHtml(t("cost.none_match", "Brak projektów w tym filtrze")) +
          "</option>") +
      "</select>" +
      "</label>" +
      "</div>" +
      (active
        ? '<div class="dam-cost-picker__selected" aria-live="polite">' +
          '<div class="dam-cost-picker__selected-kicker">' +
          escapeHtml(t("cost.selected", "Wybrany projekt")) +
          "</div>" +
          '<div class="dam-cost-picker__selected-name">' +
          escapeHtml(active.name || active.label) +
          "</div>" +
          '<div class="dam-cost-picker__selected-meta">' +
          escapeHtml(formatPLN(active.total)) +
          " · " +
          escapeHtml(String(active.task_count || 0)) +
          " zadan" +
          (active.open_tasks ? " · " + active.open_tasks + " otwarte" : "") +
          "</div>" +
          "</div>"
        : "") +
      '<p class="dam-cost-picker__count">' +
      escapeHtml(
        t("cost.list_count", "Pokazano") +
          ": " +
          list.length +
          " / " +
          projects.length
      ) +
      "</p>" +
      "</div>";

    mount.querySelectorAll(".dam-cost-bucket").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.bucket = this.getAttribute("data-bucket") || "all";
        var still = filteredProjects();
        if (still.length && !still.some(function (p) { return p.id === state.activeId; })) {
          state.activeId = still[0].id;
        }
        renderPicker(projects);
        renderActive();
      });
    });

    var search = document.getElementById("damCostSearch");
    if (search) {
      search.addEventListener("input", function () {
        state.query = this.value || "";
        var still = filteredProjects();
        if (still.length && !still.some(function (p) { return p.id === state.activeId; })) {
          state.activeId = still[0].id;
        }
        renderPicker(projects);
        renderActive();
        var again = document.getElementById("damCostSearch");
        if (again) {
          again.focus();
          var len = again.value.length;
          again.setSelectionRange(len, len);
        }
      });
    }

    var sel = document.getElementById("damCostSelect");
    if (sel) {
      sel.addEventListener("change", function () {
        state.activeId = this.value;
        renderPicker(projects);
        renderActive();
      });
    }
  }

  function renderMeta(project) {
    var mount = document.getElementById("damCostMeta");
    if (!mount || !project) return;
    var people = (project.people || []).map(escapeHtml).join(", ") || "-";
    mount.innerHTML =
      '<h5 class="dam-cost-card__title">' +
      escapeHtml(t("cost.meta_title", "O projekcie")) +
      "</h5>" +
      '<p class="dam-cost-card__sub">' +
      escapeHtml(project.name) +
      "</p>" +
      '<ul class="dam-cost-meta-list">' +
      "<li><span>" +
      escapeHtml(t("cost.meta_duration", "Czas trwania")) +
      "</span><strong>" +
      escapeHtml(String(project.duration_months)) +
      " mies. (" +
      project.duration_days +
      " dni)</strong></li>" +
      "<li><span>" +
      escapeHtml(t("cost.meta_dates", "Okres")) +
      "</span><strong>" +
      formatDate(project.start) +
      " - " +
      formatDate(project.end) +
      "</strong></li>" +
      "<li><span>" +
      escapeHtml(t("cost.meta_tasks", "Zadania Asana")) +
      "</span><strong>" +
      project.task_count +
      " (otwarte: " +
      project.open_tasks +
      ")</strong></li>" +
      "<li><span>" +
      escapeHtml(t("cost.meta_people", "Osoby")) +
      "</span><strong>" +
      people +
      "</strong></li>" +
      "<li><span>" +
      escapeHtml(t("cost.meta_labor", "Koszt osob")) +
      "</span><strong>" +
      formatPLN(project.labor_total) +
      "</strong></li>" +
      "<li><span>" +
      escapeHtml(t("cost.meta_direct", "Koszty bezposrednie")) +
      "</span><strong>" +
      formatPLN(project.direct_total) +
      "</strong></li>" +
      "</ul>" +
      '<p class="dam-cost-card__note">' +
      escapeHtml(
        t("cost.rates_note", "Stawki godzinowe z konfiguracji firmy. Godziny liczone z typow zadan w Asanie.")
      ) +
      "</p>";
  }

  function renderResult(project) {
    var mount = document.getElementById("damCostResult");
    if (!mount || !project) return;

    var laborRows = (project.labor || [])
      .map(function (row) {
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(row.name) +
          '<div class="dam-cost-row-meta">' +
          escapeHtml(row.role) +
          " · " +
          row.hours +
          " h × " +
          formatPLN(row.hourly_rate) +
          "/h</div></td>" +
          '<td class="text-end fw-500">' +
          formatPLN(row.cost) +
          "</td></tr>"
        );
      })
      .join("");

    var directRows = (project.direct || [])
      .map(function (row) {
        return (
          "<tr><td>" +
          escapeHtml(row.label) +
          '</td><td class="text-end fw-500">' +
          formatPLN(row.amount) +
          "</td></tr>"
        );
      })
      .join("");

    var invRows = (project.invoices || [])
      .map(function (inv) {
        return (
          "<tr><td>" +
          escapeHtml(inv.label || inv.id) +
          '<div class="dam-cost-row-meta">' +
          escapeHtml(inv.type || "") +
          " · " +
          escapeHtml(inv.status || "") +
          "</div></td>" +
          '<td class="text-end fw-500">' +
          formatPLN(inv.amount) +
          "</td></tr>"
        );
      })
      .join("");

    mount.innerHTML =
      '<h5 class="dam-cost-card__title">' +
      escapeHtml(t("cost.result_title", "Szacowany koszt")) +
      "</h5>" +
      '<p class="dam-cost-card__sub">' +
      escapeHtml(t("cost.result_sub", "Osoby + surowiec/druk/dostawa z Asany")) +
      "</p>" +
      '<div class="dam-cost-total">' +
      '<div class="dam-cost-total__label">' +
      escapeHtml(t("cost.total_label", "Koszt calkowity projektu")) +
      "</div>" +
      '<div class="dam-cost-total__value">' +
      formatPLN(project.total) +
      "</div>" +
      "</div>" +
      '<h6 class="dam-cost-section-title">' +
      escapeHtml(t("cost.section_labor", "Osoby zaangazowane")) +
      "</h6>" +
      '<div class="dam-cost-table-wrap"><table class="table table-sm dam-cost-table"><tbody>' +
      (laborRows || '<tr><td colspan="2" class="dam-cost-empty">-</td></tr>') +
      '<tr class="dam-cost-sum"><td><strong>' +
      escapeHtml(t("cost.meta_labor", "Suma osob")) +
      '</strong></td><td class="text-end"><strong>' +
      formatPLN(project.labor_total) +
      "</strong></td></tr>" +
      "</tbody></table></div>" +
      '<h6 class="dam-cost-section-title">' +
      escapeHtml(t("cost.section_direct", "Koszty bezposrednie")) +
      "</h6>" +
      '<div class="dam-cost-table-wrap"><table class="table table-sm dam-cost-table"><tbody>' +
      (directRows ||
        '<tr><td colspan="2" class="dam-cost-empty">Brak dopasowanych pozycji</td></tr>') +
      '<tr class="dam-cost-sum"><td><strong>' +
      escapeHtml(t("cost.meta_direct", "Suma bezposrednich")) +
      '</strong></td><td class="text-end"><strong>' +
      formatPLN(project.direct_total) +
      "</strong></td></tr>" +
      "</tbody></table></div>" +
      (invRows
        ? '<h6 class="dam-cost-section-title">' +
          escapeHtml(t("cost.section_invoices", "Powiazane faktury (info)")) +
          '</h6><div class="dam-cost-table-wrap"><table class="table table-sm dam-cost-table"><tbody>' +
          invRows +
          '<tr class="dam-cost-sum"><td><strong>' +
          escapeHtml(t("cost.invoices_sum", "Suma faktur")) +
          '</strong></td><td class="text-end"><strong>' +
          formatPLN(project.invoices_total) +
          "</strong></td></tr></tbody></table></div>" +
          '<p class="dam-cost-card__note">' +
          escapeHtml(
            t(
              "cost.invoices_note",
              "Faktury sa informacyjnie - nie wchodza drugi raz do sumy operacyjnej."
            )
          ) +
          "</p>"
        : "") +
      '<p class="dam-cost-card__note">' +
      escapeHtml(
        t(
          "cost.formula_note",
          "Suma = koszt osob (stawka x godziny zadan) + koszty bezposrednie z katalogu."
        )
      ) +
      "</p>";
  }

  function renderActive() {
    if (!state.data || !state.data.projects) return;
    var project = state.data.projects.find(function (p) {
      return p.id === state.activeId;
    });
    if (!project) {
      project = state.data.projects[0];
      if (project) state.activeId = project.id;
    }
    if (!project) return;
    renderMeta(project);
    renderResult(project);
    if (window.DamShell && typeof window.DamShell.setTrailLeaf === "function") {
      window.DamShell.setTrailLeaf(project.label);
    }
    if (window.DamI18n && typeof window.DamI18n.apply === "function") {
      window.DamI18n.apply();
    }
  }

  function initUI() {
    var tabs = document.getElementById("damCostTabs");
    if (!tabs) return;

    document.querySelectorAll(".geex-content__summary, .geex-content__invoice").forEach(function (el) {
      el.style.display = "none";
    });

    fetch("data/project-costs.json?v=" + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error("Brak project-costs.json");
        return r.json();
      })
      .then(function (data) {
        state.data = data;
        window._DAM_PROJECT_COSTS = data;
        var gen = document.getElementById("damCostGeneratedAt");
        if (gen && data.generated_at) {
          gen.textContent =
            t("cost.generated", "Wygenerowano") + ": " + data.generated_at.replace("T", " ");
        }
        if (!data.projects || !data.projects.length) {
          document.getElementById("damCostMeta").innerHTML =
            '<p class="dam-cost-empty">' +
            escapeHtml(t("cost.empty", "Brak projektów do wyliczenia.")) +
            "</p>";
          return;
        }
        state.activeId = preferDefaultProject(data.projects);
        state.bucket = "product";
        renderPicker(data.projects);
        renderActive();
      })
      .catch(function (err) {
        var meta = document.getElementById("damCostMeta");
        if (meta) {
          meta.innerHTML =
            '<p style="color:#FF5653">Nie udalo sie zaladowac kosztów: ' +
            escapeHtml(err.message) +
            "</p>" +
            '<p class="dam-cost-card__note">Uruchom: python apps/web/scripts/build-project-costs.py</p>';
        }
      });
  }

  window.DamCost = {
    workingHoursInMonth: workingHoursInMonth,
    easterSunday: easterSunday,
    polishHolidays: polishHolidays,
    formatPLN: formatPLN,
    getData: function () {
      return state.data;
    },
    selectProject: function (id) {
      state.activeId = id;
      if (state.data) {
        renderPicker(state.data.projects);
        renderActive();
      }
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI);
  } else {
    initUI();
  }
})();
