/**
 * DAM - Kalkulator kosztów (czytelny wybor projektu + breakdown)
 * Preferuje GET /finance/project-costs (bridge), fallback: data/project-costs.json.
 */
(function () {
  "use strict";

  function bridgeUrl() {
    if (window.DamRuntime && typeof DamRuntime.bridgeUrl === "function") {
      return DamRuntime.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function authHeaders() {
    if (window.DamApi && typeof DamApi.authHeaders === "function") {
      return DamApi.authHeaders();
    }
    return {
      Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
      Accept: "application/json",
    };
  }

  function isAdmin() {
    if (window.DamShell && typeof window.DamShell.isAdminMode === "function") {
      return window.DamShell.isAdminMode();
    }
    if (window.DamProductFinance && typeof DamProductFinance.isAdminMode === "function") {
      return DamProductFinance.isAdminMode();
    }
    var role = (localStorage.getItem("dam_role") || "").toLowerCase();
    return role === "admin" || role === "power_user";
  }

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
    source: "local",
    syncing: false,
    fmcgCompute: null,
    fmcgCatalog: null,
    baseRatesQuery: "",
    baseRatesKind: "all",
  };

  var BASE_KINDS = [
    { id: "all", key: "cost.base_kind_all" },
    { id: "opakowanie", key: "cost.base_kind_pack" },
    { id: "karton", key: "cost.base_kind_carton" },
    { id: "wykrojnik", key: "cost.base_kind_die" },
    { id: "drukarnia", key: "cost.base_kind_print" },
    { id: "logistyka", key: "cost.base_kind_logistics" },
    { id: "badania", key: "cost.base_kind_research" },
  ];

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
          "Najpierw wybierz projekt. Potem zobaczysz koszt osób i koszty bezpośrednie."
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
      escapeHtml(t("cost.meta_direct", "Koszty bezpośrednie")) +
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
        var meta = "";
        if (row.department || row.qty != null) {
          var parts = [];
          if (row.department) parts.push(row.department);
          if (row.qty != null && row.unit) {
            parts.push(String(row.qty).replace(".", ",") + " " + row.unit);
          }
          if (row.rate != null) parts.push(formatPLN(row.rate) + "/" + (row.unit || "j."));
          meta = '<div class="dam-cost-row-meta">' + escapeHtml(parts.join(" · ")) + "</div>";
        }
        return (
          "<tr><td>" +
          escapeHtml(row.label) +
          meta +
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

    var testChip =
      project.isTest || project.source === "seed"
        ? window.DamProductFinance && typeof DamProductFinance.testBadgeHtml === "function"
          ? DamProductFinance.testBadgeHtml()
          : ' <span class="dam-seed-test-badge">(TESTOWE)</span>'
        : "";
    mount.innerHTML =
      '<h5 class="dam-cost-card__title">' +
      escapeHtml(t("cost.result_title", "Szacowany koszt")) +
      testChip +
      "</h5>" +
      '<p class="dam-cost-card__sub">' +
      escapeHtml(t("cost.result_sub", "Osoby + surowiec/druk/dostawa z Asany")) +
      "</p>" +
      '<div class="dam-cost-total">' +
      '<div class="dam-cost-total__label">' +
      escapeHtml(t("cost.total_label", "Koszt całkowity projektu")) +
      "</div>" +
      '<div class="dam-cost-total__value">' +
      formatPLN(project.total) +
      "</div>" +
      "</div>" +
      '<h6 class="dam-cost-section-title">' +
      escapeHtml(t("cost.section_labor", "Osoby zaangażowane")) +
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
      escapeHtml(t("cost.section_direct", "Koszty bezpośrednie")) +
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
    if (window.DamGridReveal && window.DamGridReveal.revealRows) {
      window.DamGridReveal.revealRows(document.getElementById("damCostMeta"), ":scope > *");
      window.DamGridReveal.revealRows(document.getElementById("damCostResult"), ":scope > *");
    }
    if (window.DamShell && typeof window.DamShell.setTrailLeaf === "function") {
      window.DamShell.setTrailLeaf(project.label);
    }
    if (window.DamI18n && typeof window.DamI18n.apply === "function") {
      window.DamI18n.apply();
    }
  }

  function updateSourceBadge() {
    var badge = document.getElementById("damCostSourceBadge");
    var gen = document.getElementById("damCostGeneratedAt");
    var syncBtn = document.getElementById("damCostSyncBtn");
    var when = state.data && state.data.generated_at
      ? String(state.data.generated_at).replace("T", " ").slice(0, 16)
      : "";
    if (badge) {
      if (state.source === "asana" || state.source === "bridge") {
        badge.textContent = when
          ? "Źródło: Asana · sync " + when
          : "Źródło: bridge (project-costs)";
        badge.className = "geex-badge geex-badge--success-transparent dam-cost-toolbar__badge";
      } else {
        badge.textContent = when
          ? "Snapshot lokalny · " + when
          : "Snapshot lokalny (brak połączenia)";
        badge.className = "geex-badge geex-badge--warning-transparent dam-cost-toolbar__badge";
      }
    }
    if (gen && when) {
      gen.textContent = t("cost.generated", "Wygenerowano") + ": " + when;
    }
    if (syncBtn) {
      syncBtn.disabled = !isAdmin() || state.syncing;
      syncBtn.textContent = state.syncing
        ? "Synchronizacja..."
        : "Synchronizuj z Asany";
    }
  }

  function STAGE_LABELS() {
    return {
      procurement: "Zamówienie i zakup",
      prepress: "Przygotowanie",
      production: "Produkcja",
      warehouse: "Magazyn",
      logistics: "Dostawa",
    };
  }

  function catalogSearchBlob(item) {
    var parts = [
      item.label_pl,
      item.id,
      item.kind,
      item.vendor,
      item.notes,
      item.stage,
    ];
    (item.aliases || []).forEach(function (a) {
      parts.push(a);
    });
    return parts.join(" ").toLowerCase();
  }

  function filteredCatalogItems() {
    var items = (state.fmcgCatalog && state.fmcgCatalog.items) || [];
    var q = state.baseRatesQuery.trim().toLowerCase();
    var kind = state.baseRatesKind;
    return items.filter(function (it) {
      if (kind !== "all" && String(it.kind || "") !== kind) return false;
      if (!q) return true;
      return catalogSearchBlob(it).indexOf(q) !== -1;
    });
  }

  function unitLabel(unit) {
    var map = {
      per_1000: "/1000 szt",
      per_order: "/zlecenie",
      per_kg: "/kg",
      per_hour: "/h",
      per_pallet: "/paleta",
      per_sku: "/SKU",
      per_km: "/km",
    };
    return map[unit] || unit || "";
  }

  function renderBaseRatesPanel() {
    var mount = document.getElementById("damCostBaseRates");
    if (!mount) return;
    var cat = state.fmcgCatalog;
    if (!cat || !cat.items) {
      mount.innerHTML =
        '<p class="dam-cost-empty">' + escapeHtml(t("cost.base_loading", "Ładowanie katalogu stawek…")) + "</p>";
      return;
    }
    var admin = isAdmin();
    var list = filteredCatalogItems();
    var kindBtns = BASE_KINDS.map(function (k) {
      var active = state.baseRatesKind === k.id ? " is-active" : "";
      return (
        '<button type="button" class="dam-cost-bucket dam-cost-base-kind' +
        active +
        '" data-base-kind="' +
        escapeHtml(k.id) +
        '">' +
        escapeHtml(t(k.key, k.id)) +
        "</button>"
      );
    }).join("");
    var rows = list
      .slice(0, 120)
      .map(function (it) {
        var amtCell = admin
          ? '<input type="number" step="0.01" class="form-control form-control-sm dam-cost-base-rate-input text-end" data-catalog-id="' +
            escapeHtml(it.id) +
            '" value="' +
            escapeHtml(it.amount != null ? String(it.amount) : "") +
            '" />'
          : escapeHtml(formatPLN(it.amount));
        return (
          "<tr><td>" +
          escapeHtml(it.label_pl || it.id) +
          '<div class="dam-cost-row-meta">' +
          escapeHtml(
            [it.kind, it.vendor, it.stage].filter(Boolean).join(" · ")
          ) +
          "</div></td><td class=\"text-end\">" +
          amtCell +
          "</td><td class=\"text-end text-muted\">" +
          escapeHtml(unitLabel(it.unit)) +
          "</td></tr>"
        );
      })
      .join("");
    mount.innerHTML =
      '<div class="dam-cost-base-rates">' +
      "<h5 class=\"dam-cost-card__title\">" +
      escapeHtml(t("cost.base_title", "Kwoty bazowe")) +
      " " +
      (window.DamProductFinance && DamProductFinance.testBadgeHtml
        ? DamProductFinance.testBadgeHtml()
        : "") +
      "</h5>" +
      '<p class="dam-cost-card__sub">' +
      escapeHtml(
        t(
          "cost.base_sub",
          "Stawki opakowań i usług — źródło liczenia na karcie produktu. Szukaj po nazwie, aliasie, drukarni."
        )
      ) +
      "</p>" +
      '<div class="dam-cost-picker__controls dam-cost-base-search">' +
      '<label class="dam-cost-picker__search-wrap" for="damCostBaseSearch">' +
      '<span class="visually-hidden">' +
      escapeHtml(t("cost.base_search", "Szukaj stawki")) +
      "</span>" +
      '<i class="uil uil-search" aria-hidden="true"></i>' +
      '<input type="search" id="damCostBaseSearch" class="dam-cost-picker__search" placeholder="' +
      escapeHtml(t("cost.base_search_ph", "doypack, kilometr, badanie…")) +
      '" value="' +
      escapeHtml(state.baseRatesQuery) +
      '" autocomplete="off" />' +
      "</label></div>" +
      '<div class="dam-cost-picker__buckets dam-cost-base-kinds" role="tablist">' +
      kindBtns +
      "</div>" +
      '<p class="dam-cost-picker__count">' +
      escapeHtml(t("cost.base_count", "Pozycji")) +
      ": " +
      list.length +
      " / " +
      cat.items.length +
      "</p>" +
      (admin
        ? '<button type="button" class="geex-btn geex-btn--sm geex-btn--primary" id="damCostBaseSave">' +
          escapeHtml(t("cost.base_save", "Zapisz zmienione stawki")) +
          "</button>"
        : "") +
      '<div class="dam-cost-table-wrap"><table class="table table-sm dam-cost-table"><thead><tr><th>' +
      escapeHtml(t("cost.base_col_item", "Pozycja")) +
      "</th><th class=\"text-end\">" +
      escapeHtml(t("cost.base_col_rate", "Stawka")) +
      "</th><th class=\"text-end\">" +
      escapeHtml(t("cost.base_col_unit", "Jednostka")) +
      "</th></tr></thead><tbody>" +
      (rows ||
        '<tr><td colspan="3" class="dam-cost-empty">' +
          escapeHtml(t("cost.base_none", "Brak dopasowań")) +
          "</td></tr>") +
      "</tbody></table></div></div>";

    mount.querySelectorAll(".dam-cost-base-kind").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.baseRatesKind = this.getAttribute("data-base-kind") || "all";
        renderBaseRatesPanel();
      });
    });
    var search = document.getElementById("damCostBaseSearch");
    if (search) {
      search.addEventListener("input", function () {
        state.baseRatesQuery = this.value || "";
        renderBaseRatesPanel();
        var again = document.getElementById("damCostBaseSearch");
        if (again) {
          again.focus();
          var len = again.value.length;
          again.setSelectionRange(len, len);
        }
      });
    }
    var saveBase = document.getElementById("damCostBaseSave");
    if (saveBase && !saveBase._damBound) {
      saveBase._damBound = true;
      saveBase.addEventListener("click", function () {
        if (!isAdmin()) return;
        var patches = [];
        mount.querySelectorAll(".dam-cost-base-rate-input").forEach(function (inp) {
          var id = inp.getAttribute("data-catalog-id");
          if (!id) return;
          patches.push({ id: id, amount: Number(inp.value) });
        });
        fetch(bridgeUrl() + "/finance/fmcg-catalog", {
          method: "POST",
          headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
          body: JSON.stringify({ action: "patch", items: patches }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (j) {
            if (!j || j.ok === false) {
              alert((j && j.error) || "Zapis stawek nie powiódł się.");
              return;
            }
            return loadFmcgCatalog(true);
          })
          .catch(function () {
            alert("Bridge offline.");
          });
      });
    }
    if (window.DamGridReveal && window.DamGridReveal.revealRows) {
      window.DamGridReveal.revealRows(mount, ":scope > *");
    }
  }

  function loadFmcgCatalog(skipCompute) {
    return fetch(bridgeUrl() + "/finance/fmcg-catalog", {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("bridge");
        return r.json();
      })
      .then(function (data) {
        state.fmcgCatalog = data;
        renderBaseRatesPanel();
        if (!skipCompute) {
          state.fmcgCompute =
            window.DamFmcg && typeof DamFmcg.computeFromCatalog === "function"
              ? DamFmcg.computeFromCatalog(data)
              : data.compute || null;
          renderFmcgPanel();
        }
      })
      .catch(function () {
        return fetch("data/fmcg-cost-catalog.json?v=" + Date.now(), { cache: "no-store" })
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .then(function (catalog) {
            state.fmcgCatalog = catalog;
            renderBaseRatesPanel();
            if (catalog && window.DamFmcg && typeof DamFmcg.computeFromCatalog === "function") {
              state.fmcgCompute = DamFmcg.computeFromCatalog(catalog);
            }
            renderFmcgPanel();
          });
      });
  }

  function renderFmcgPanel() {
    var mount = document.getElementById("damCostFmcg");
    if (!mount) return;
    var c = state.fmcgCompute;
    if (!c) {
      mount.innerHTML =
        '<h5 class="dam-cost-card__title">Łańcuch FMCG</h5>' +
        '<p class="dam-cost-empty">Brak danych katalogu. Skonfiguruj w Integracjach.</p>';
      return;
    }
    var labels = STAGE_LABELS();
    var by = c.by_stage || {};
    var rows = Object.keys(by)
      .map(function (k) {
        return (
          "<tr><td>" +
          escapeHtml(labels[k] || k) +
          '</td><td class="text-end fw-500">' +
          formatPLN(by[k]) +
          "</td></tr>"
        );
      })
      .join("");
    var filled = c.filled_count || 0;
    var total = c.item_count || 0;
    var missing = c.missing_count || 0;
    var sum = Object.keys(by).reduce(function (a, k) {
      return a + (Number(by[k]) || 0);
    }, 0);
    mount.innerHTML =
      '<h5 class="dam-cost-card__title">Łańcuch FMCG</h5>' +
      '<p class="dam-cost-card__sub">' +
      filled +
      " z " +
      total +
      " pozycji ma kwotę" +
      (missing ? " · część bez kwoty (szacunek)" : "") +
      "</p>" +
      '<div class="dam-cost-table-wrap"><table class="table table-sm dam-cost-table"><tbody>' +
      (rows || '<tr><td colspan="2" class="dam-cost-empty">-</td></tr>') +
      '<tr class="dam-cost-sum"><td><strong>Suma etapów (katalog)</strong></td>' +
      '<td class="text-end"><strong>' +
      formatPLN(sum) +
      "</strong></td></tr></tbody></table></div>" +
      (missing
        ? '<p class="dam-cost-card__note">Część pozycji bez kwoty — uzupełnij katalog lub import CSV w Integracjach.</p>'
        : "");
    if (window.DamGridReveal && window.DamGridReveal.revealRows) {
      window.DamGridReveal.revealRows(mount, ":scope > *");
    }
  }

  function projectIdFromUrl() {
    try {
      return (
        new URLSearchParams(window.location.search).get("project") ||
        new URLSearchParams(window.location.search).get("product_id") ||
        ""
      );
    } catch (e) {
      return "";
    }
  }

  function applyProjectCosts(data, source) {
    state.data = data;
    state.source = source || "local";
    window._DAM_PROJECT_COSTS = data;
    updateSourceBadge();
    if (!data.projects || !data.projects.length) {
      var meta = document.getElementById("damCostMeta");
      if (meta) {
        meta.innerHTML =
          '<p class="dam-cost-empty">' +
          escapeHtml(t("cost.empty", "Brak projektów do wyliczenia.")) +
          "</p>";
      }
      return;
    }
    var fromUrl = projectIdFromUrl();
    if (fromUrl) {
      var match = data.projects.find(function (p) {
        return p.id === fromUrl || p.linked_product_id === fromUrl;
      });
      if (match) state.activeId = match.id;
      else state.activeId = preferDefaultProject(data.projects);
    } else {
      state.activeId = preferDefaultProject(data.projects);
    }
    state.bucket = "product";
    renderPicker(data.projects);
    renderActive();
  }

  function loadProjectCosts() {
    return fetch(bridgeUrl() + "/finance/project-costs", {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("bridge");
        return r.json();
      })
      .then(function (payload) {
        if (!payload || payload.ok === false) throw new Error("bridge");
        var src =
          payload.source ||
          (payload.source_csv ? "bridge" : "bridge");
        if (String(payload.source_csv || "").indexOf("asana") !== -1) src = "asana";
        applyProjectCosts(payload, src);
      })
      .catch(function () {
        return fetch("data/project-costs.json?v=" + Date.now(), { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) throw new Error("Brak project-costs.json");
            return r.json();
          })
          .then(function (data) {
            applyProjectCosts(data, "local");
          });
      });
  }

  function loadFmcgCompute() {
    return fetch(bridgeUrl() + "/finance/fmcg-compute", {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("bridge");
        return r.json();
      })
      .then(function (data) {
        state.fmcgCompute = data;
        renderFmcgPanel();
      })
      .catch(function () {
        return fetch("data/fmcg-cost-catalog.json?v=" + Date.now(), { cache: "no-store" })
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .then(function (catalog) {
            if (!catalog || !window.DamFmcg || typeof DamFmcg.computeFromCatalog !== "function") {
              state.fmcgCompute = null;
              renderFmcgPanel();
              return;
            }
            state.fmcgCompute = DamFmcg.computeFromCatalog(catalog);
            renderFmcgPanel();
          })
          .catch(function () {
            state.fmcgCompute = null;
            renderFmcgPanel();
          });
      });
  }

  function bindSync() {
    var syncBtn = document.getElementById("damCostSyncBtn");
    if (!syncBtn) return;
    updateSourceBadge();
    syncBtn.addEventListener("click", function () {
      if (!isAdmin() || state.syncing) return;
      state.syncing = true;
      updateSourceBadge();
      fetch(bridgeUrl() + "/integrations/asana/sync", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
        body: "{}",
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (res) {
          state.syncing = false;
          if (!res.ok || (res.j && res.j.ok === false)) {
            updateSourceBadge();
            var msg =
              (res.j && (res.j.error || res.j.message)) ||
              "Sync nie powiódł się. Sprawdź Asanę w Integracjach.";
            alert(msg);
            return;
          }
          return loadProjectCosts().then(function () {
            updateSourceBadge();
          });
        })
        .catch(function () {
          state.syncing = false;
          updateSourceBadge();
          alert("Bridge offline lub brak OAuth Asany.");
        });
    });
  }

  function initUI() {
    var tabs = document.getElementById("damCostTabs");
    if (!tabs) return;

    document.querySelectorAll(".geex-content__summary, .geex-content__invoice").forEach(function (el) {
      el.style.display = "none";
    });

    bindSync();
    if (window.DamGridReveal && window.DamGridReveal.skeleton) {
      window.DamGridReveal.skeleton(document.getElementById("damCostMeta"), { count: 4 });
      window.DamGridReveal.skeleton(document.getElementById("damCostResult"), { variant: "rows", count: 4 });
      window.DamGridReveal.skeleton(document.getElementById("damCostFmcg"), { variant: "rows", count: 3 });
      window.DamGridReveal.skeleton(document.getElementById("damCostBaseRates"), { variant: "rows", count: 4 });
    }
    document.addEventListener("dam:admin-mode", function () {
      renderBaseRatesPanel();
      updateSourceBadge();
    });
    loadProjectCosts().catch(function (err) {
      var meta = document.getElementById("damCostMeta");
      if (meta) {
        meta.innerHTML =
          '<p style="color:#FF5653">Nie udalo sie zaladowac kosztów: ' +
          escapeHtml(err.message || String(err)) +
          "</p>" +
          '<p class="dam-cost-card__note">Uruchom: python apps/web/scripts/build-project-costs.py</p>';
      }
    });
    loadFmcgCatalog();
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
