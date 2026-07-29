/**
 * DAM - Settings page controller (widget layout)
 */
(function () {
  "use strict";

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bridge() {
    return (
      (window.DamPaths && DamPaths.bridgeUrl && DamPaths.bridgeUrl()) ||
      "http://127.0.0.1:8766"
    );
  }

  function authHeaders() {
    return (
      (window.DamApi && DamApi.authHeaders && DamApi.authHeaders()) || {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
      }
    );
  }

  function isAdminRole() {
    var role =
      (window.DamApi && typeof DamApi.role === "function" && DamApi.role()) ||
      localStorage.getItem("dam_role") ||
      "";
    return String(role).toLowerCase() === "admin";
  }

  /** Karty / akcje tylko dla admina (Historia, grupy powiadomien). */
  function gateAdminSettingsUi() {
    var hist = document.getElementById("historiaZmian");
    var notify = document.getElementById("damNotificationGroups");
    var conv = document.getElementById("damElementyConversion");
    var convAdminBadge = document.getElementById("damElementyConvAdminBadge");
    var convGateHint = document.getElementById("damElementyConvGateHint");
    var convInputs = conv
      ? conv.querySelectorAll("input, button, select, textarea")
      : [];
    if (!isAdminRole()) {
      if (hist) {
        hist.setAttribute("hidden", "");
        hist.setAttribute("aria-hidden", "true");
      }
      if (notify) {
        notify.querySelectorAll("button, input, select, textarea").forEach(function (el) {
          el.disabled = true;
        });
        var meta = notify.querySelector(".dam-widget__meta");
        if (!notify.querySelector("[data-admin-gate-hint]")) {
          var hint = document.createElement("p");
          hint.className = "dam-widget__meta";
          hint.setAttribute("data-admin-gate-hint", "1");
          hint.textContent = "Edycja list odbiorców wymaga roli administratora.";
          var body = notify.querySelector(".dam-widget__body");
          if (body) body.appendChild(hint);
          else notify.appendChild(hint);
        }
      }
      if (conv) {
        convInputs.forEach(function (el) {
          el.disabled = true;
        });
        if (convGateHint) convGateHint.hidden = false;
      }
    } else if (hist) {
      hist.removeAttribute("hidden");
      hist.removeAttribute("aria-hidden");
    }
    if (isAdminRole()) {
      if (convAdminBadge) convAdminBadge.hidden = false;
      if (convGateHint) convGateHint.hidden = true;
      if (conv) {
        convInputs.forEach(function (el) {
          if (el.id !== "damElementyConvPngTransparency") el.disabled = false;
        });
      }
    }
  }

  function initials(name) {
    var parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /* ---------- Profile ---------- */
  function initProfile() {
    var nameEl = document.getElementById("settingProfileName");
    var emailEl = document.getElementById("settingProfileEmail");
    var roleEl = document.getElementById("settingProfileRole");
    var phoneEl = document.getElementById("settingProfilePhone");
    var titleEl = document.getElementById("settingProfileTitle");
    var avatarEl = document.getElementById("settingProfileAvatar");
    if (!nameEl) return;

    var user = {};
    try {
      user = JSON.parse(localStorage.getItem("dam_user") || "{}");
    } catch (e) {
      user = {};
    }
    var name =
      localStorage.getItem("dam_user_name") ||
      user.name ||
      "";
    var email = user.email || localStorage.getItem("dam_user_email") || "";
    var role = user.role || localStorage.getItem("dam_role") || "user";
    var phone =
      localStorage.getItem("dam_user_phone") || user.phone || "";
    var title =
      localStorage.getItem("dam_user_title") ||
      user.title ||
      user.job_title ||
      "";

    nameEl.value = name;
    if (emailEl) emailEl.value = email;
    if (roleEl) roleEl.value = role;
    if (phoneEl) phoneEl.value = phone;
    if (titleEl) titleEl.value = title;
    if (avatarEl) avatarEl.textContent = initials(name);

    nameEl.addEventListener("input", function () {
      if (avatarEl) avatarEl.textContent = initials(nameEl.value);
    });
  }

  function saveProfile() {
    var nameEl = document.getElementById("settingProfileName");
    var phoneEl = document.getElementById("settingProfilePhone");
    var titleEl = document.getElementById("settingProfileTitle");
    if (!nameEl) return;
    var name = (nameEl.value || "").trim();
    if (name) localStorage.setItem("dam_user_name", name);
    if (phoneEl) localStorage.setItem("dam_user_phone", (phoneEl.value || "").trim());
    if (titleEl) localStorage.setItem("dam_user_title", (titleEl.value || "").trim());
    try {
      var user = JSON.parse(localStorage.getItem("dam_user") || "{}");
      user.name = name || user.name;
      if (phoneEl) user.phone = (phoneEl.value || "").trim();
      if (titleEl) user.title = (titleEl.value || "").trim();
      localStorage.setItem("dam_user", JSON.stringify(user));
    } catch (e) { /* ignore */ }
  }

  /* ---------- Section filter (chips) + command-palette search (UI only) ---------- */
  var _settingsChipFilter = "all";
  var _settingsSearchQ = "";

  /**
   * Rejestr skrótów UI (NIE produkty / wizki / branding assets).
   * Szukanie „historia” musi trafić tu + w kartę #historiaZmian.
   */
  var UI_JUMP_REGISTRY = [
    {
      id: "settings-disk-history",
      label: "Historia zmian na dysku",
      where: "Ustawienia → Dysk",
      keywords: "historia zmian dysk changelog change-log status wariantu nieaktualne rename log zatwierdzonych history",
      href: "#historiaZmian",
      icon: "uil-history",
    },
    {
      id: "settings-disk-paths",
      label: "Urządzenia i ścieżki Marketing",
      where: "Ustawienia → Dysk",
      keywords: "dysk sciezka ścieżka folder urzadzenie urządzenie archiwum polska eksport marketing path device sesja",
      href: "#damDisk",
      icon: "uil-folder",
    },
    {
      id: "settings-profile",
      label: "Profil",
      where: "Ustawienia → Profil",
      keywords: "profil imie imię nazwa stanowisko telefon email konto rola",
      href: "#damProfile",
      icon: "uil-user",
    },
    {
      id: "settings-appearance",
      label: "Wygląd panelu",
      where: "Ustawienia → Wygląd",
      keywords: "wyglad wygląd motyw theme jasny ciemny kolor akcent",
      href: "#damAppearance",
      icon: "uil-palette",
    },
    {
      id: "settings-prefs",
      label: "Preferencje",
      where: "Ustawienia → Preferencje",
      keywords: "preferencje podpowiedzi tooltips marka synology usuwanie bezpieczenstwo",
      href: "#damPrefs",
      icon: "uil-sliders-v",
    },
    {
      id: "settings-integrations",
      label: "Integracje (karta w ustawieniach)",
      where: "Ustawienia → Integracje",
      keywords: "integracje asana teams entra oauth synology",
      href: "#damIntegrations",
      icon: "uil-link",
    },
    {
      id: "settings-notify",
      label: "Powiadomienia",
      where: "Ustawienia → Powiadomienia",
      keywords: "powiadomienia notify email odbiorcy",
      href: "#damNotificationGroups",
      icon: "uil-users-alt",
    },
    {
      id: "settings-naming",
      label: "Nazewnictwo",
      where: "Ustawienia → Nazewnictwo",
      keywords: "nazewnictwo naming doypack folia nosnik typ",
      href: "#damNamingPolicy",
      icon: "uil-tag-alt",
    },
    {
      id: "settings-conversion",
      label: "Konwersja elementów",
      where: "Ustawienia → Konwersja",
      keywords: "konwersja elementy links png jpg kompresja jakosc transparency",
      href: "#damElementyConversion",
      icon: "uil-compress-arrows",
    },
    {
      id: "settings-instructions",
      label: "Instrukcje programu",
      where: "Ustawienia → Instrukcje",
      keywords: "instrukcje programu program-instructions reguly zasady",
      href: "#damProgramInstructions",
      icon: "uil-book-open",
    },
    {
      id: "settings-danger",
      label: "Strefa ryzyka",
      where: "Ustawienia → System",
      keywords: "strefa ryzyka danger clear local prefs usuwanie",
      href: "#damDangerZone",
      icon: "uil-exclamation-triangle",
    },
    {
      id: "nav-inbox-historia",
      label: "Historia (Wiadomości)",
      where: "Wiadomości → Zgłoszenia → Historia",
      keywords: "historia inbox wiadomosci wiadomości moderacja decyzje zgloszenia zgłoszenia undo redo",
      href: "inbox.html?tag=historia",
      icon: "uil-envelope",
    },
    {
      id: "nav-inbox",
      label: "Wiadomości",
      where: "Menu → Wiadomości",
      keywords: "wiadomosci wiadomości inbox skrzynka zgloszenia asana teams",
      href: "inbox.html",
      icon: "uil-envelope",
    },
    {
      id: "nav-viz-history",
      label: "Historia zmian na dysku (Wizualizacje)",
      where: "Wizualizacje → pasek Dysk (ADMIN ON)",
      keywords: "historia zmian wizualizacje dysk admin changelog viz",
      href: "visualizations.html#damChangeLogBar",
      icon: "uil-image",
    },
    {
      id: "nav-viz",
      label: "Wizualizacje",
      where: "Menu → Wizualizacje",
      keywords: "wizualizacje viz miniatury produkty",
      href: "visualizations.html",
      icon: "uil-image",
    },
    {
      id: "nav-explorer",
      label: "Eksplorer",
      where: "Menu → Eksplorer",
      keywords: "eksplorer explorer folder dysk pliki",
      href: "explorer.html",
      icon: "uil-folder-open",
    },
    {
      id: "nav-branding",
      label: "Branding",
      where: "Menu → Branding",
      keywords: "branding materialy materiały marketing",
      href: "branding.html",
      icon: "uil-palette",
    },
    {
      id: "nav-integrations",
      label: "Integracja i produkcja",
      where: "Menu → Integracje",
      keywords: "integracje asana teams microsoft entra fmcg",
      href: "integrations.html",
      icon: "uil-plug",
    },
    {
      id: "nav-costs",
      label: "Kalkulator kosztów",
      where: "Menu → Kalkulator",
      keywords: "kalkulator kosztow kosztów costs fmcg",
      href: "costs.html",
      icon: "uil-calculator-alt",
    },
    {
      id: "nav-invoices",
      label: "Faktury",
      where: "Menu → Faktury",
      keywords: "faktury invoices erp",
      href: "invoices.html",
      icon: "uil-invoice",
    },
    {
      id: "nav-profile-session",
      label: "Sesja urządzenia",
      where: "Profil → ścieżki",
      keywords: "sesja urzadzenia urządzenia device path sciezka",
      href: "profile.html#damDevicePathsRoot",
      icon: "uil-desktop",
    },
    {
      id: "nav-help",
      label: "Pomoc / Docs",
      where: "Menu → Pomoc",
      keywords: "pomoc help docs dokumentacja samouczek",
      href: "help.html",
      icon: "uil-question-circle",
    },
    {
      id: "nav-activity",
      label: "Aktywność",
      where: "Menu użytkownika → Aktywność",
      keywords: "aktywnosc aktywność activity log",
      href: "activity.html",
      icon: "uil-chart-line",
    },
  ];

  function normSearch(s) {
    var t = String(s || "").toLowerCase();
    try {
      t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (e) { /* ignore */ }
    return t.replace(/\s+/g, " ").trim();
  }

  function matchJumpQuery(item, q) {
    if (!q) return false;
    var blob = normSearch(
      [item.label, item.where, item.keywords, item.id, item.href].join(" ")
    );
    return blob.indexOf(q) !== -1;
  }

  function filterJumpRegistry(q) {
    if (!q) return [];
    return UI_JUMP_REGISTRY.filter(function (item) {
      return matchJumpQuery(item, q);
    }).slice(0, 12);
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function navigateJump(href) {
    var h = String(href || "").trim();
    if (!h) return;
    if (h.charAt(0) === "#") {
      jumpToSettingsHash(h.slice(1));
      return;
    }
    if (/^settings\.html#/i.test(h)) {
      jumpToSettingsHash(h.split("#")[1] || "");
      return;
    }
    window.location.href = h;
  }

  function jumpToSettingsHash(rawId) {
    var id = String(rawId || "")
      .replace(/^#/, "")
      .trim();
    if (!id) return;
    if (id === "damDiskHistory") id = "historiaZmian";
    var sec = document.getElementById(id);
    if (!sec) {
      window.location.hash = id;
      return;
    }
    var sectionKey = sec.getAttribute("data-section") || "all";
    try {
      if (sectionKey && sectionKey !== "system") {
        sessionStorage.setItem("dam_settings_filter", sectionKey);
      }
    } catch (e) { /* ignore */ }
    _settingsChipFilter = sectionKey === "system" ? "all" : sectionKey;
    var nav = document.getElementById("damSettingsFilter");
    if (nav) {
      nav.querySelectorAll(".dam-settings-jump__chip").forEach(function (chip) {
        var on = chip.getAttribute("data-filter") === _settingsChipFilter;
        chip.classList.toggle("is-active", on);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    _settingsSearchQ = "";
    var input = document.getElementById("damSettingsSearch");
    if (input) input.value = "";
    applySettingsVisibility();
    try {
      history.replaceState(null, "", "#" + id);
    } catch (e2) {
      window.location.hash = id;
    }
    setTimeout(function () {
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
      sec.classList.add("is-hash-focus");
      setTimeout(function () {
        sec.classList.remove("is-hash-focus");
      }, 1600);
      if (id === "historiaZmian" && window.DamTagEdit && typeof window.DamTagEdit.refreshChangeLogBar === "function") {
        window.DamTagEdit.refreshChangeLogBar();
      }
    }, 60);
  }

  function renderJumpResults(hits) {
    var list = document.getElementById("damSettingsJumpResults");
    if (!list) return 0;
    if (!hits.length) {
      list.hidden = true;
      list.innerHTML = "";
      return 0;
    }
    list.hidden = false;
    list.innerHTML = hits
      .map(function (item, idx) {
        return (
          '<li class="dam-settings-jump-results__item" role="option">' +
          '<button type="button" class="dam-settings-jump-results__btn" data-jump-href="' +
          escHtml(item.href) +
          '" data-jump-id="' +
          escHtml(item.id) +
          '"' +
          (idx === 0 ? ' data-jump-first="1"' : "") +
          ">" +
          '<i class="uil ' +
          escHtml(item.icon || "uil-arrow-right") +
          '" aria-hidden="true"></i>' +
          '<span class="dam-settings-jump-results__text">' +
          '<span class="dam-settings-jump-results__label">' +
          escHtml(item.label) +
          "</span>" +
          '<span class="dam-settings-jump-results__where">' +
          escHtml(item.where) +
          "</span>" +
          "</span>" +
          "</button></li>"
        );
      })
      .join("");
    return hits.length;
  }

  function applySettingsVisibility() {
    var grid = document.getElementById("damSettingsGrid");
    var hint = document.getElementById("damSettingsSearchHint");
    if (!grid) return;
    var q = normSearch(_settingsSearchQ);
    var chip = _settingsChipFilter || "all";
    var isChipAll = chip === "all";
    var matchCount = 0;
    var jumpHits = filterJumpRegistry(q);
    var jumpCount = renderJumpResults(jumpHits);

    grid.classList.toggle("is-filtered", !isChipAll || !!q);
    grid.classList.toggle("is-searching", !!q);

    grid.querySelectorAll(".dam-widget[data-section]").forEach(function (sec) {
      var secId = sec.getAttribute("data-section");
      /* HARD: przy wyszukiwaniu chip NIE ukrywa trafień (np. Profil + „historia”). */
      var chipOk = q ? true : isChipAll ? true : secId === chip;
      if (!q && secId === "system") chipOk = isChipAll;

      var rows = sec.querySelectorAll(".dam-sw-row[data-search]");
      var anyRowMatch = false;
      if (q && rows.length) {
        rows.forEach(function (row) {
          var blob =
            normSearch(row.getAttribute("data-search") || "") +
            " " +
            normSearch(row.textContent || "");
          var hit = blob.indexOf(q) !== -1;
          row.classList.toggle("is-search-miss", !hit);
          if (hit) anyRowMatch = true;
        });
      } else {
        rows.forEach(function (row) {
          row.classList.remove("is-search-miss");
        });
      }

      var secBlob =
        normSearch(sec.getAttribute("data-search") || "") +
        " " +
        normSearch(sec.id || "") +
        " " +
        normSearch((sec.querySelector(".dam-widget__title") || {}).textContent || "") +
        " " +
        normSearch((sec.querySelector(".dam-widget__meta") || {}).textContent || "");
      var secHit = !q || secBlob.indexOf(q) !== -1 || anyRowMatch;
      var show = chipOk && secHit;

      sec.classList.toggle("is-filtered-out", !show);
      if (show) {
        sec.removeAttribute("hidden");
        matchCount += 1;
      } else {
        sec.setAttribute("hidden", "");
      }
    });

    if (hint) {
      if (q) {
        hint.hidden = false;
        var total = matchCount + jumpCount;
        if (total > 0) {
          hint.textContent =
            "Znaleziono " +
            matchCount +
            " kart" +
            (jumpCount ? " + " + jumpCount + " skrótów" : "") +
            " dla „" +
            _settingsSearchQ.trim() +
            "”.";
        } else {
          hint.textContent = "Brak ustawień ani skrótów dla „" + _settingsSearchQ.trim() + "”.";
        }
      } else {
        hint.hidden = true;
        hint.textContent = "";
      }
    }
  }

  function initSectionFilter() {
    var nav = document.getElementById("damSettingsFilter");
    var grid = document.getElementById("damSettingsGrid");
    if (!nav || !grid) return;

    function setFilter(filter) {
      var f = filter || "all";
      _settingsChipFilter = f;
      nav.querySelectorAll(".dam-settings-jump__chip").forEach(function (chip) {
        var on = chip.getAttribute("data-filter") === f;
        chip.classList.toggle("is-active", on);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });
      try {
        if (f === "all") sessionStorage.removeItem("dam_settings_filter");
        else sessionStorage.setItem("dam_settings_filter", f);
      } catch (e) { /* ignore */ }
      applySettingsVisibility();
    }

    nav.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-filter]");
      if (!btn || !nav.contains(btn)) return;
      ev.preventDefault();
      setFilter(btn.getAttribute("data-filter") || "all");
    });

    var initial = "all";
    try {
      initial = sessionStorage.getItem("dam_settings_filter") || "all";
    } catch (e) { /* ignore */ }
    setFilter(initial);
  }

  function initSettingsSearch() {
    var input = document.getElementById("damSettingsSearch");
    var results = document.getElementById("damSettingsJumpResults");
    if (!input) return;
    var timer = null;
    function run() {
      _settingsSearchQ = input.value || "";
      applySettingsVisibility();
    }
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(run, 80);
    });
    input.addEventListener("search", run);
    if (results) {
      results.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-jump-href]");
        if (!btn || !results.contains(btn)) return;
        ev.preventDefault();
        navigateJump(btn.getAttribute("data-jump-href") || "");
      });
    }
    input.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter") return;
      var first = document.querySelector("#damSettingsJumpResults [data-jump-first]");
      if (first) {
        ev.preventDefault();
        navigateJump(first.getAttribute("data-jump-href") || "");
      }
    });

    var hash = String(location.hash || "").replace(/^#/, "");
    if (hash === "historiaZmian" || hash === "damDiskHistory" || hash === "damHistoriaZmian") {
      setTimeout(function () {
        jumpToSettingsHash(hash);
      }, 120);
    }
  }

  /* ---------- Theme (light/dark/system overlay) ---------- */
  function initTheme() {
    var picker = document.getElementById("damThemePicker");
    if (!picker || !window.DamTheme) return;

    function syncUi() {
      var pref = DamTheme.currentPref();
      picker.querySelectorAll("[data-theme-pick]").forEach(function (btn) {
        var on = btn.getAttribute("data-theme-pick") === pref;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    picker.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-theme-pick]");
      if (!btn) return;
      DamTheme.apply(btn.getAttribute("data-theme-pick"));
      syncUi();
    });
    syncUi();
  }

  /* ---------- Accent ---------- */
  function initAccent() {
    var presetsEl = document.getElementById("damAccentPresets");
    var colorEl = document.getElementById("settingAccentColor");
    var hexEl = document.getElementById("settingAccentHex");
    var resetBtn = document.getElementById("settingAccentReset");
    if (!window.DamAccent) return;

    var current = DamAccent.current();

    function syncUi(hex) {
      if (colorEl) colorEl.value = hex;
      if (hexEl) hexEl.value = hex;
      if (presetsEl) {
        presetsEl.querySelectorAll(".dam-accent-swatch").forEach(function (btn) {
          btn.classList.toggle(
            "is-active",
            DamAccent.normalize(btn.getAttribute("data-hex")) === hex
          );
        });
      }
    }

    if (presetsEl) {
      presetsEl.innerHTML = DamAccent.presets
        .map(function (p) {
          return (
            '<button type="button" class="dam-accent-swatch" data-hex="' +
            esc(p.hex) +
            '" title="' +
            esc(p.label) +
            '" aria-label="' +
            esc(p.label) +
            '" style="background:' +
            esc(p.hex) +
            '"></button>'
          );
        })
        .join("");
      presetsEl.addEventListener("click", function (ev) {
        var btn = ev.target.closest(".dam-accent-swatch");
        if (!btn) return;
        var hex = DamAccent.apply(btn.getAttribute("data-hex"));
        syncUi(hex);
      });
    }

    if (colorEl) {
      colorEl.addEventListener("input", function () {
        var hex = DamAccent.apply(colorEl.value);
        syncUi(hex);
      });
    }
    if (hexEl) {
      hexEl.addEventListener("change", function () {
        var hex = DamAccent.apply(hexEl.value);
        syncUi(hex);
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        syncUi(DamAccent.reset());
      });
    }
    syncUi(current);
  }

  /* ---------- Prefs / path / save ---------- */
  function syncSafeDeleteToggle() {
    var el = document.getElementById("settingSafeDelete");
    if (!el) return;
    var on = true;
    if (window.DamUserPrefs && typeof DamUserPrefs.isSafeDeleteEnabled === "function") {
      on = DamUserPrefs.isSafeDeleteEnabled() !== false;
    } else {
      try {
        var raw = localStorage.getItem("dam_user_prefs");
        if (raw) {
          var p = JSON.parse(raw);
          if (p && "safe_delete" in p) on = !!p.safe_delete;
        }
      } catch (e) { /* ignore */ }
    }
    el.checked = on;
  }

  function initPrefs() {
    var tooltipEl = document.getElementById("settingTooltips");
    var synologyEl = document.getElementById("settingSynology");
    var brandDkEl = document.getElementById("settingBrandDK");
    var brandGcEl = document.getElementById("settingBrandGC");
    var safeDelEl = document.getElementById("settingSafeDelete");
    var basePathEl = document.getElementById("settingBasePath");
    var baseMsg = document.getElementById("settingBasePathMsg");
    var detectInfo = document.getElementById("settingBasePathDetectInfo");
    if (!tooltipEl || !basePathEl) return;

    tooltipEl.checked = localStorage.getItem("dam_tooltips") !== "off";
    if (synologyEl) {
      synologyEl.checked = localStorage.getItem("dam_synology_enabled") !== "false";
    }
    var brands = {};
    try {
      brands = JSON.parse(localStorage.getItem("dam_brands") || "{}");
    } catch (e) {
      brands = {};
    }
    if (brandDkEl) brandDkEl.checked = brands.DK !== false;
    if (brandGcEl) brandGcEl.checked = brands.GC !== false;
    basePathEl.value = localStorage.getItem("dam_base_path") || "";
    syncSafeDeleteToggle();
    if (window.DamUserPrefs && typeof DamUserPrefs.load === "function") {
      DamUserPrefs.load().then(syncSafeDeleteToggle);
    }
    window.addEventListener("dam:user-prefs", syncSafeDeleteToggle);
    if (safeDelEl) {
      safeDelEl.addEventListener("change", function () {
        if (window.DamUserPrefs && typeof DamUserPrefs.setSafeDelete === "function") {
          DamUserPrefs.setSafeDelete(!!safeDelEl.checked);
        }
      });
    }

    if (window.DamPaths && typeof DamPaths.ensureUserBase === "function") {
      DamPaths.ensureUserBase().then(function (res) {
        if (res && res.base) basePathEl.value = res.base;
        if (res && res.detect && res.detect.candidates && detectInfo) {
          var bits = res.detect.candidates.map(function (c) {
            return c.path + (c.ok ? " OK" : " brak");
          });
          detectInfo.classList.add("is-on");
          detectInfo.textContent =
            "Znaleziono na dysku (nie zapisane automatycznie): " + bits.join(" | ");
        }
      });
    }

    function showBaseMsg(text, ok) {
      if (!baseMsg) return;
      baseMsg.classList.add("is-on");
      baseMsg.classList.toggle("dam-sw-msg--ok", !!ok);
      baseMsg.classList.toggle("dam-sw-msg--err", !ok);
      baseMsg.textContent = text;
    }

    var testBtn = document.getElementById("settingBasePathTest");
    if (testBtn) {
      testBtn.addEventListener("click", function () {
        var raw = (basePathEl.value || "").trim();
        if (!raw) {
          showBaseMsg("Wpisz najpierw ścieżkę do folderu Marketing.", false);
          return;
        }
        if (!window.DamPaths) {
          showBaseMsg("Zapisano lokalnie (weryfikacja niedostępna offline).", true);
          return;
        }
        showBaseMsg("Sprawdzam foldery...", true);
        DamPaths.validateBaseRemote(raw)
          .then(function (res) {
            if (res && res.ok) {
              showBaseMsg("Wszystko w porządku - ta ścieżka zawiera wymagane foldery.", true);
            } else if (res && res.missing) {
              showBaseMsg("Brakuje folderów: " + res.missing.join(", "), false);
            } else {
              showBaseMsg("Nie można sprawdzić - most lokalny jest offline.", false);
            }
          })
          .catch(function () {
            showBaseMsg("Nie można sprawdzić - most lokalny jest offline (port 8766).", false);
          });
      });
    }

    var detectBtn = document.getElementById("settingBasePathDetect");
    if (detectBtn) {
      detectBtn.addEventListener("click", function () {
        if (!window.DamPaths || !DamPaths.detectMarketingBasesRemote) {
          showBaseMsg(
            "Automatyczne wykrywanie wymaga aplikacji desktop (most lokalny offline).",
            false
          );
          return;
        }
        showBaseMsg("Szukam folderu Marketing na dyskach tego komputera...", true);
        DamPaths.detectMarketingBasesRemote()
          .then(function (res) {
            if (!res || !res.candidates) {
              showBaseMsg("Nie znaleziono żadnych propozycji - wpisz ścieżkę ręcznie.", false);
              return;
            }
            var bits = res.candidates.map(function (c) {
              return c.path + (c.ok ? " OK" : " brak");
            });
            if (detectInfo) {
              detectInfo.classList.add("is-on");
              detectInfo.textContent =
                "Znaleziono na dysku (nie zapisane automatycznie): " + bits.join(" | ");
            }
            if (res.recommended) {
              basePathEl.value = res.recommended;
              showBaseMsg(
                "Znaleziono: " +
                  res.recommended +
                  ' - kliknij „Zapisz ustawienia”, jeśli to prawidłowa ścieżka.',
                true
              );
            } else {
              showBaseMsg(
                "Nie znaleziono folderu Marketing automatycznie - wpisz ścieżkę ręcznie.",
                false
              );
            }
          })
          .catch(function () {
            showBaseMsg(
              "Nie można wykryć - most lokalny jest offline (port 8766).",
              false
            );
          });
      });
    }

    var saveBtn = document.getElementById("settingsSave");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        localStorage.setItem("dam_tooltips", tooltipEl.checked ? "on" : "off");
        if (synologyEl) {
          localStorage.setItem(
            "dam_synology_enabled",
            synologyEl.checked ? "true" : "false"
          );
        }
        localStorage.setItem(
          "dam_brands",
          JSON.stringify({
            DK: !brandDkEl || brandDkEl.checked,
            GC: !brandGcEl || brandGcEl.checked,
          })
        );
        var safeP =
          window.DamUserPrefs && typeof DamUserPrefs.setSafeDelete === "function"
            ? DamUserPrefs.setSafeDelete(safeDelEl ? !!safeDelEl.checked : true)
            : Promise.resolve();
        var raw = (basePathEl.value || "").trim();
        if (raw && window.DamPaths) {
          DamPaths.setBasePath(raw);
          DamPaths.logAction("set_base_path", {
            local_path: raw,
            detail: "Zapisano w Ustawieniach",
          });
        } else if (raw) {
          localStorage.setItem("dam_base_path", raw);
        }
        saveProfile();
        Promise.all([saveNotifications(), saveElementyConversion(), safeP]).then(function () {
          var msg = document.getElementById("settingsSaveMsg");
          if (msg) {
            msg.classList.add("is-on");
            setTimeout(function () {
              msg.classList.remove("is-on");
            }, 2500);
          }
        });
        if (window.DamTooltips) {
          tooltipEl.checked ? DamTooltips.enable() : DamTooltips.disable();
        }
      });
    }

    initRestart();
  }

  function initRestart() {
    var restartBtn = document.getElementById("settingRestartApp");
    var restartMsg = document.getElementById("settingRestartMsg");
    if (!restartBtn) return;

    function showRestartMsg(text, ok) {
      if (!restartMsg) return;
      restartMsg.classList.add("is-on");
      restartMsg.classList.toggle("dam-sw-msg--ok", !!ok);
      restartMsg.classList.toggle("dam-sw-msg--err", !ok);
      restartMsg.textContent = text;
    }

    function callRestartApi() {
      var api = window.pywebview && window.pywebview.api;
      if (!api || typeof api.restart_window !== "function") {
        showRestartMsg("Restart działa tylko w aplikacji desktop (DAM).", false);
        return Promise.resolve(null);
      }
      return Promise.resolve(api.restart_window())
        .then(function (res) {
          if (res && res.ok) showRestartMsg("Restartuje okno…", true);
          else showRestartMsg((res && res.error) || "Nie udało się zrestartować.", false);
          return res;
        })
        .catch(function (err) {
          showRestartMsg(String((err && err.message) || err || "Błąd restartu"), false);
        });
    }

    restartBtn.addEventListener("click", function () {
      if (!window.confirm("Zamknąć i uruchomić ponownie okno DAM?")) return;
      restartBtn.disabled = true;
      var done = false;
      function runOnce() {
        if (done) return;
        done = true;
        callRestartApi().then(function (res) {
          if (!(res && res.ok)) restartBtn.disabled = false;
        });
      }
      if (window.pywebview && window.pywebview.api) {
        runOnce();
        return;
      }
      window.addEventListener("pywebviewready", function onReady() {
        window.removeEventListener("pywebviewready", onReady);
        runOnce();
      });
      setTimeout(runOnce, 600);
    });
  }

  /* ---------- Instructions (RO) ---------- */
  function loadInstructions() {
    var list = document.getElementById("damInstrList");
    var meta = document.getElementById("damInstrMeta");
    if (!list) return;

    function priColor(p) {
      if (p === "critical") return "#C62828";
      if (p === "high") return "#E65100";
      return "#8b8d97";
    }

    function render(data) {
      var items = (data && data.instructions) || [];
      if (meta) {
        meta.textContent =
          "Wersja " +
          (data.version || "?") +
          " · " +
          items.length +
          " instrukcji · tylko odczyt";
      }
      if (!items.length) {
        list.innerHTML =
          '<p class="dam-widget__meta">Brak instrukcji - uzupełnij program-instructions.json i zrestartuj bridge.</p>';
        return;
      }
      var critical = items.filter(function (i) {
        return i.priority === "critical";
      });
      var rest = items.filter(function (i) {
        return i.priority !== "critical";
      });
      list.innerHTML = critical
        .concat(rest)
        .map(function (i) {
          var must = (i.must || [])
            .slice(0, 3)
            .map(function (m) {
              return "<li>" + esc(m) + "</li>";
            })
            .join("");
          return (
            '<div class="dam-instr-item">' +
            '<div class="dam-instr-item__meta">' +
            '<span style="font-weight:700;color:' +
            priColor(i.priority) +
            '">' +
            esc(i.priority || "normal") +
            "</span>" +
            "<span>" +
            esc(i.category || "") +
            "</span>" +
            "<code>" +
            esc(i.id || "") +
            "</code></div>" +
            '<div class="dam-instr-item__title">' +
            esc(i.title_pl || i.id) +
            "</div>" +
            '<div class="dam-instr-item__body">' +
            esc(i.body_pl || "") +
            "</div>" +
            (must ? "<ul>" + must + "</ul>" : "") +
            "</div>"
          );
        })
        .join("");
    }

    fetch(bridge() + "/program-instructions")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.ok) {
          render(data);
          return;
        }
        throw new Error("bridge");
      })
      .catch(function () {
        fetch("data/program-instructions.json?v=20260718instr1")
          .then(function (r) {
            return r.json();
          })
          .then(render)
          .catch(function () {
            list.innerHTML =
              '<p class="dam-widget__meta">Nie udało się wczytać instrukcji (bridge offline / brak pliku).</p>';
          });
      });
  }

  /* ---------- Elementy conversion (admin global) ---------- */
  var elementyConvState = {
    enabled: true,
    quality: 50,
    formats: { png: true, jpg: true },
    png_transparency: true,
  };

  function applyElementyConvUi(cfg) {
    var enabledEl = document.getElementById("damElementyConvEnabled");
    var pngEl = document.getElementById("damElementyConvFmtPng");
    var jpgEl = document.getElementById("damElementyConvFmtJpg");
    var qualEl = document.getElementById("damElementyConvQuality");
    var qualVal = document.getElementById("damElementyConvQualityVal");
    var alphaEl = document.getElementById("damElementyConvPngTransparency");
    if (enabledEl) enabledEl.checked = cfg.enabled !== false;
    if (pngEl) pngEl.checked = cfg.formats ? cfg.formats.png !== false : true;
    if (jpgEl) jpgEl.checked = cfg.formats ? cfg.formats.jpg !== false : true;
    if (alphaEl) alphaEl.checked = cfg.png_transparency !== false;
    if (qualEl) qualEl.value = String(cfg.quality || 50);
    if (qualVal) qualVal.textContent = String(cfg.quality || 50) + "%";
  }

  function readElementyConvFromUi() {
    var enabledEl = document.getElementById("damElementyConvEnabled");
    var pngEl = document.getElementById("damElementyConvFmtPng");
    var jpgEl = document.getElementById("damElementyConvFmtJpg");
    var qualEl = document.getElementById("damElementyConvQuality");
    var alphaEl = document.getElementById("damElementyConvPngTransparency");
    return {
      enabled: enabledEl ? !!enabledEl.checked : true,
      quality: qualEl ? parseInt(qualEl.value, 10) || 50 : 50,
      formats: {
        png: pngEl ? !!pngEl.checked : true,
        jpg: jpgEl ? !!jpgEl.checked : true,
      },
      png_transparency: alphaEl ? !!alphaEl.checked : true,
    };
  }

  function loadElementyConversion() {
    var qualEl = document.getElementById("damElementyConvQuality");
    var qualVal = document.getElementById("damElementyConvQualityVal");
    if (qualEl && qualVal) {
      qualEl.addEventListener("input", function () {
        qualVal.textContent = qualEl.value + "%";
      });
    }
    function applyCfg(cfg) {
      elementyConvState = cfg || elementyConvState;
      applyElementyConvUi(elementyConvState);
    }
    fetch(bridge() + "/app-settings")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.elementy_conversion) {
          applyCfg(data.elementy_conversion);
          return;
        }
        throw new Error("bridge");
      })
      .catch(function () {
        fetch("data/app-settings.json?v=5.0.69")
          .then(function (r) {
            return r.json();
          })
          .then(function (json) {
            applyCfg((json && json.elementy_conversion) || elementyConvState);
          })
          .catch(function () {
            applyCfg(elementyConvState);
          });
      });
  }

  function saveElementyConversion() {
    if (!isAdminRole()) {
      return Promise.resolve({ ok: false, error: "admin_required" });
    }
    var payload = readElementyConvFromUi();
    if (!payload.formats.png && !payload.formats.jpg) {
      alert("Wybierz co najmniej jeden format wyjściowy (PNG lub JPG).");
      return Promise.resolve({ ok: false, error: "no_formats" });
    }
    elementyConvState = payload;
    return fetch(bridge() + "/app-settings", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ elementy_conversion: payload }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        if (!(res && res.ok)) {
          console.warn("app-settings save:", res);
        }
        return res;
      })
      .catch(function () {
        return { ok: false, offline: true };
      });
  }

  /* ---------- Naming (RO) ---------- */
  function loadNaming() {
    var table = document.getElementById("damNamingCarrierTable");
    if (!table) return;

    function render(dict) {
      var policy =
        (dict && dict.policy) ||
        (window.DamLabels && DamLabels.CARRIER_POLICY) ||
        {};
      var ui = policy.carrier_display_in_ui || "label_pl";
      var disk = policy.carrier_prefix_on_disk || "short";
      var uiEl = document.getElementById("damNamingUiRule");
      var diskEl = document.getElementById("damNamingDiskRule");
      var descEl = document.getElementById("damNamingPolicyDesc");
      var uiBadge = document.getElementById("damNamingUiBadge");
      var diskBadge = document.getElementById("damNamingDiskBadge");
      if (uiEl) {
        uiEl.textContent =
          ui === "short"
            ? "Skróty w UI (nietypowe - sprawdź słownik)"
            : "Pełne nazwy: DOYPACK, FOLIA, BATON…";
      }
      if (diskEl) {
        diskEl.textContent =
          disk === "short"
            ? "Skróty folderów: DOY, FOL, BAT…"
            : "Pełne nazwy także na dysku";
      }
      if (uiBadge) uiBadge.textContent = ui;
      if (diskBadge) diskBadge.textContent = disk;
      if (descEl) descEl.textContent = policy.description_pl || "";
      var carriers = (dict && dict.carriers) || {};
      var keys = Object.keys(carriers).sort();
      if (!keys.length) {
        table.innerHTML =
          '<p class="dam-widget__meta" style="padding:12px">Brak słownika naming-dictionary.</p>';
        return;
      }
      table.innerHTML =
        '<table class="dam-naming-table"><thead><tr>' +
        "<th>Kod</th><th>W programie</th><th>Na dysku</th>" +
        "</tr></thead><tbody>" +
        keys
          .map(function (code) {
            var c = carriers[code] || {};
            return (
              "<tr><td><strong>" +
              esc(code) +
              "</strong></td><td>" +
              esc(c.label_pl || code) +
              "</td><td>" +
              esc(c.short || code) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>";
    }

    fetch("data/naming-dictionary.json?v=20260718namingPolicy1")
      .then(function (r) {
        return r.json();
      })
      .then(function (dict) {
        if (window.DamLabels && DamLabels.applyNamingDict) DamLabels.applyNamingDict(dict);
        render(dict);
      })
      .catch(function () {
        render(window.DamNaming || null);
      });
  }

  /* ---------- Integrations (dam-integrations.js) ---------- */
  function loadIntegrations() {
    if (!window.DamIntegrations) return;
    DamIntegrations.mount("damIntegrationsList", {
      layout: "settings-bento",
      includeExtras: true,
      includeSynology: true,
      prefsJump: "filter",
    });
  }

  /* ---------- Notifications (editable) ---------- */
  var notifyState = { grafik: [] };

  function renderNotifyList() {
    var list = document.getElementById("damNotificationGroupsList");
    if (!list) return;
    var rows = notifyState.grafik || [];
    if (!rows.length) {
      list.innerHTML =
        '<p class="dam-widget__meta">Brak odbiorców - dodaj osobę poniżej.</p>';
      return;
    }
    list.innerHTML = rows
      .map(function (p, idx) {
        return (
          '<div class="dam-notify-row" data-idx="' +
          idx +
          '">' +
          '<input type="text" data-field="name" value="' +
          esc(p.name || "") +
          '" placeholder="Imię i nazwisko" aria-label="Imię">' +
          '<input type="email" data-field="email" value="' +
          esc(p.email || "") +
          '" placeholder="email@firma.pl" aria-label="E-mail">' +
          '<button type="button" class="dam-notify-row__remove" data-remove="' +
          idx +
          '" aria-label="Usuń"><i class="uil uil-trash-alt" aria-hidden="true"></i></button>' +
          "</div>"
        );
      })
      .join("");

    list.querySelectorAll(".dam-notify-row").forEach(function (row) {
      var idx = parseInt(row.getAttribute("data-idx"), 10);
      row.querySelectorAll("input").forEach(function (inp) {
        inp.addEventListener("change", function () {
          var field = inp.getAttribute("data-field");
          if (!notifyState.grafik[idx]) notifyState.grafik[idx] = {};
          notifyState.grafik[idx][field] = inp.value.trim();
        });
      });
    });
    list.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-remove"), 10);
        notifyState.grafik.splice(idx, 1);
        renderNotifyList();
      });
    });
  }

  function loadNotifications() {
    var addBtn = document.getElementById("damNotifyAdd");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var nameEl = document.getElementById("damNotifyName");
        var emailEl = document.getElementById("damNotifyEmail");
        var name = (nameEl && nameEl.value.trim()) || "";
        var email = (emailEl && emailEl.value.trim()) || "";
        if (!email || email.indexOf("@") < 0) {
          alert("Podaj poprawny adres e-mail.");
          return;
        }
        notifyState.grafik.push({ name: name || email, email: email });
        if (nameEl) nameEl.value = "";
        if (emailEl) emailEl.value = "";
        renderNotifyList();
      });
    }

    function applyData(data) {
      notifyState.grafik = Array.isArray(data && data.grafik)
        ? data.grafik.map(function (p) {
            return {
              name: (p && p.name) || "",
              email: (p && p.email) || String(p || ""),
            };
          })
        : [];
      renderNotifyList();
    }

    fetch(bridge() + "/notification-groups")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.ok && data.groups) {
          applyData(data.groups);
          return;
        }
        throw new Error("bridge");
      })
      .catch(function () {
        fetch("data/notification-groups.json?v=20260718inbox3")
          .then(function (r) {
            return r.json();
          })
          .then(applyData)
          .catch(function () {
            var list = document.getElementById("damNotificationGroupsList");
            if (list) {
              list.innerHTML =
                '<p class="dam-widget__meta">Nie udało się wczytać grup powiadomień.</p>';
            }
          });
      });
  }

  function saveNotifications() {
    if (!isAdminRole()) {
      return Promise.resolve({ ok: false, error: "admin_required" });
    }
    var payload = {
      grafik: (notifyState.grafik || []).filter(function (p) {
        return p && p.email && String(p.email).indexOf("@") > 0;
      }),
    };
    return fetch(bridge() + "/notification-groups", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ groups: payload }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        if (!(res && res.ok)) {
          /* fallback: local only hint */
          console.warn("notification-groups save:", res);
        }
        return res;
      })
      .catch(function () {
        return { ok: false, offline: true };
      });
  }

  function boot() {
    initSectionFilter();
    initSettingsSearch();
    initTheme();
    initProfile();
    initAccent();
    initPrefs();
    gateAdminSettingsUi();
    loadInstructions();
    loadNaming();
    loadElementyConversion();
    loadIntegrations();
    loadNotifications();
    if (window.DamApi && typeof DamApi.me === "function") {
      DamApi.me()
        .then(function () {
          gateAdminSettingsUi();
        })
        .catch(function () {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
