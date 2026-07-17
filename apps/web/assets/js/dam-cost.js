/**
 * DAM ETA - Automatic project cost tabs
 * Loads data/project-costs.json (built from Asana + cost-rates).
 * No manual form - user picks a project tab and sees breakdown.
 */
(function () {
  "use strict";

  // Keep PL calendar helpers for rates tooling / future use
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
    return date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0") + "-" +
      String(date.getDate()).padStart(2, "0");
  }

  function polishHolidays(year) {
    var easter = easterSunday(year);
    var fixed = [
      year + "-01-01", year + "-01-06", year + "-05-01", year + "-05-03",
      year + "-08-15", year + "-11-01", year + "-11-11", year + "-12-25", year + "-12-26"
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

  var state = {
    data: null,
    activeId: null
  };

  function preferDefaultProject(projects) {
    var cy = projects.find(function (p) {
      return /cynamon/i.test(p.name || "") || /cynamon/i.test(p.label || "");
    });
    if (cy) return cy.id;
    var dk = projects.find(function (p) { return (p.name || "").indexOf("(DK)") === 0; });
    return (dk || projects[0]).id;
  }

  function renderTabs(projects) {
    var mount = document.getElementById("damCostTabs");
    if (!mount) return;
    mount.innerHTML = projects.map(function (p) {
      var active = p.id === state.activeId ? " is-active" : "";
      return '<button type="button" class="dam-cost-tab' + active + '" role="tab" aria-selected="' +
        (p.id === state.activeId ? "true" : "false") + '" data-id="' + escapeHtml(p.id) + '" title="' +
        escapeHtml(p.name) + '">' + escapeHtml(p.label) +
        (p.open_tasks ? '<span class="dam-cost-tab__badge">' + p.open_tasks + "</span>" : "") +
        "</button>";
    }).join("");

    mount.querySelectorAll(".dam-cost-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.activeId = this.getAttribute("data-id");
        renderTabs(projects);
        renderActive();
      });
    });
  }

  function renderMeta(project) {
    var mount = document.getElementById("damCostMeta");
    if (!mount || !project) return;
    var people = (project.people || []).map(escapeHtml).join(", ") || "-";
    mount.innerHTML =
      '<h5 style="margin:0 0 4px;font-weight:600" data-i18n="cost.meta_title">' + escapeHtml(t("cost.meta_title", "Projekt")) + "</h5>" +
      '<p style="color:#888;font-size:13px;margin:0 0 16px">' + escapeHtml(project.name) + "</p>" +
      '<ul class="dam-cost-meta-list">' +
      '<li><span data-i18n="cost.meta_duration">' + escapeHtml(t("cost.meta_duration", "Czas trwania")) + "</span>" +
      "<strong>" + escapeHtml(String(project.duration_months)) + " mies. (" + project.duration_days + " dni)</strong></li>" +
      '<li><span data-i18n="cost.meta_dates">' + escapeHtml(t("cost.meta_dates", "Okres")) + "</span>" +
      "<strong>" + formatDate(project.start) + " - " + formatDate(project.end) + "</strong></li>" +
      '<li><span data-i18n="cost.meta_tasks">' + escapeHtml(t("cost.meta_tasks", "Zadania Asana")) + "</span>" +
      "<strong>" + project.task_count + " (otwarte: " + project.open_tasks + ")</strong></li>" +
      '<li><span data-i18n="cost.meta_people">' + escapeHtml(t("cost.meta_people", "Osoby")) + "</span>" +
      "<strong>" + people + "</strong></li>" +
      '<li><span data-i18n="cost.meta_labor">' + escapeHtml(t("cost.meta_labor", "Koszt osob")) + "</span>" +
      "<strong>" + formatPLN(project.labor_total) + "</strong></li>" +
      '<li><span data-i18n="cost.meta_direct">' + escapeHtml(t("cost.meta_direct", "Koszty bezposrednie")) + "</span>" +
      "<strong>" + formatPLN(project.direct_total) + "</strong></li>" +
      "</ul>" +
      '<p style="font-size:11px;color:#8b8d97;margin:16px 0 0" data-i18n="cost.rates_note">' +
      escapeHtml(t("cost.rates_note", "Stawki z data/cost-rates.json. Godziny z mapy typow zadan Asana.")) +
      "</p>";
  }

  function renderResult(project) {
    var mount = document.getElementById("damCostResult");
    if (!mount || !project) return;

    var laborRows = (project.labor || []).map(function (row) {
      return "<tr>" +
        "<td>" + escapeHtml(row.name) +
        '<div style="font-size:11px;color:#888">' + escapeHtml(row.role) + " · " +
        row.hours + " h × " + formatPLN(row.hourly_rate) + "/h</div></td>" +
        '<td class="text-end fw-500">' + formatPLN(row.cost) + "</td></tr>";
    }).join("");

    var directRows = (project.direct || []).map(function (row) {
      return "<tr><td>" + escapeHtml(row.label) +
        '</td><td class="text-end fw-500">' + formatPLN(row.amount) + "</td></tr>";
    }).join("");

    var invRows = (project.invoices || []).map(function (inv) {
      return "<tr><td>" + escapeHtml(inv.label || inv.id) +
        '<div style="font-size:11px;color:#888">' + escapeHtml(inv.type || "") + " · " +
        escapeHtml(inv.status || "") + "</div></td>" +
        '<td class="text-end fw-500">' + formatPLN(inv.amount) + "</td></tr>";
    }).join("");

    mount.innerHTML =
      '<h5 style="margin:0 0 4px;font-weight:600" data-i18n="cost.result_title">' +
      escapeHtml(t("cost.result_title", "Szacowany koszt")) + "</h5>" +
      '<p style="color:#888;font-size:13px;margin:0 0 16px" data-i18n="cost.result_sub">' +
      escapeHtml(t("cost.result_sub", "Osoby + surowiec/druk/dostawa/marketing z Asany")) + "</p>" +
      '<div style="background:linear-gradient(135deg,#AB54DB,#7c3aed);color:#fff;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center">' +
      '<div style="font-size:13px;opacity:0.85" data-i18n="cost.total_label">' +
      escapeHtml(t("cost.total_label", "Koszt calkowity projektu")) + "</div>" +
      '<div style="font-size:32px;font-weight:700;margin:8px 0">' + formatPLN(project.total) + "</div>" +
      "</div>" +
      '<h6 style="font-size:13px;font-weight:600;margin:0 0 8px" data-i18n="cost.section_labor">' +
      escapeHtml(t("cost.section_labor", "Osoby zaangazowane")) + "</h6>" +
      '<table class="table table-sm" style="font-size:13px"><tbody>' +
      (laborRows || "<tr><td colspan=\"2\" style=\"color:#888\">-</td></tr>") +
      '<tr style="border-top:2px solid #eee"><td><strong data-i18n="cost.meta_labor">' +
      escapeHtml(t("cost.meta_labor", "Suma osob")) +
      '</strong></td><td class="text-end"><strong>' + formatPLN(project.labor_total) + "</strong></td></tr>" +
      "</tbody></table>" +
      '<h6 style="font-size:13px;font-weight:600;margin:16px 0 8px" data-i18n="cost.section_direct">' +
      escapeHtml(t("cost.section_direct", "Koszty bezposrednie")) + "</h6>" +
      '<table class="table table-sm" style="font-size:13px"><tbody>' +
      (directRows || "<tr><td colspan=\"2\" style=\"color:#888\">Brak dopasowanych pozycji</td></tr>") +
      '<tr style="border-top:2px solid #eee"><td><strong>' +
      escapeHtml(t("cost.meta_direct", "Suma bezposrednich")) +
      '</strong></td><td class="text-end"><strong>' + formatPLN(project.direct_total) + "</strong></td></tr>" +
      "</tbody></table>" +
      (invRows
        ? '<h6 style="font-size:13px;font-weight:600;margin:16px 0 8px" data-i18n="cost.section_invoices">' +
          escapeHtml(t("cost.section_invoices", "Powiazane faktury (info)")) + "</h6>" +
          '<table class="table table-sm" style="font-size:13px"><tbody>' + invRows +
          '<tr style="border-top:2px solid #eee"><td><strong>' +
          escapeHtml(t("cost.invoices_sum", "Suma faktur")) +
          '</strong></td><td class="text-end"><strong>' + formatPLN(project.invoices_total) + "</strong></td></tr>" +
          "</tbody></table>" +
          '<p style="font-size:11px;color:#8b8d97;margin:8px 0 0" data-i18n="cost.invoices_note">' +
          escapeHtml(t("cost.invoices_note", "Faktury sa informacyjnie - nie wchodza drugi raz do sumy operacyjnej.")) +
          "</p>"
        : "") +
      '<p style="font-size:11px;color:#aaa;margin:16px 0 0" data-i18n="cost.formula_note">' +
      escapeHtml(t("cost.formula_note", "Suma = koszt osob (stawka x godziny zadan) + koszty bezposrednie z katalogu.")) +
      "</p>";
  }

  function renderActive() {
    if (!state.data || !state.data.projects) return;
    var project = state.data.projects.find(function (p) { return p.id === state.activeId; });
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
          gen.textContent = t("cost.generated", "Wygenerowano") + ": " + data.generated_at.replace("T", " ");
        }
        if (!data.projects || !data.projects.length) {
          document.getElementById("damCostMeta").innerHTML =
            '<p style="color:#888" data-i18n="cost.empty">Brak projektow do wyliczenia.</p>';
          return;
        }
        state.activeId = preferDefaultProject(data.projects);
        renderTabs(data.projects);
        renderActive();
      })
      .catch(function (err) {
        var meta = document.getElementById("damCostMeta");
        if (meta) {
          meta.innerHTML = '<p style="color:#FF5653">Nie udalo sie zaladowac kosztow: ' +
            escapeHtml(err.message) + "</p>" +
            '<p style="font-size:12px;color:#888">Uruchom: python apps/web/scripts/build-project-costs.py</p>';
        }
      });
  }

  window.DamCost = {
    workingHoursInMonth: workingHoursInMonth,
    easterSunday: easterSunday,
    polishHolidays: polishHolidays,
    formatPLN: formatPLN,
    getData: function () { return state.data; },
    selectProject: function (id) {
      state.activeId = id;
      if (state.data) {
        renderTabs(state.data.projects);
        renderActive();
      }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI);
  } else {
    initUI();
  }
})();
