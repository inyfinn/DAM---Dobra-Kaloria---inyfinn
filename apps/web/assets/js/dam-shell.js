/**
 * DAM - Shell navigation + auth guard + messages popup
 * Rewrites Geex sidebar/header Demo menu to DAM items
 * Requires: dam-api.js, dam-i18n.js loaded before this script
 */
(function () {
  "use strict";

  /* Soft-boot akcentu gdy dam-accent.js nie jest na stronie (chrome tylko, nie tagi). */
  (function softAccentBoot() {
    if (window.DamAccent) return;
    try {
      var a = localStorage.getItem("dam_accent");
      if (!a || !/^#[0-9A-Fa-f]{6}$/.test(a)) return;
      var h = a.slice(1);
      var r = parseInt(h.slice(0, 2), 16);
      var g = parseInt(h.slice(2, 4), 16);
      var b = parseInt(h.slice(4, 6), 16);
      var root = document.documentElement;
      root.style.setProperty("--dam-primary", a);
      root.style.setProperty("--primary-color", a);
      root.style.setProperty(
        "--primary-color-transparent",
        "rgba(" + r + ", " + g + ", " + b + ", 0.15)"
      );
      root.setAttribute("data-dam-accent", a.toUpperCase());
    } catch (e) { /* ignore */ }
  })();

  /* Soft-boot motywu (data-theme) gdy dam-theme.js nie jest na stronie. */
  (function softThemeBoot() {
    if (window.DamTheme) return;
    try {
      var pref = localStorage.getItem("dam_theme_pref") || localStorage.getItem("theme") || "light";
      var resolved = pref;
      if (pref === "system") {
        resolved =
          window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
      }
      if (resolved !== "dark" && resolved !== "light") resolved = "light";
      document.documentElement.setAttribute("data-theme", resolved);
      if (pref === "system" || pref === "dark" || pref === "light") {
        document.documentElement.setAttribute("data-dam-theme-pref", pref);
      }
    } catch (e) { /* ignore */ }
  })();

  // Tryb roboczy: zawsze zalogowany jako admin (bez Microsoft).
  // Wyłącz (false) gdy włączymy prawdziwe Entra ID.
  // false = prawdziwe konta (bcrypt + sesja urządzenia). Nie wymuszaj demo-admin.
  var DAM_DEV_ALWAYS_ADMIN = false;
  // Dobra Kaloria (NIE Niemiesa). Zrodlo brand: Marketing/.../DOBRA KALORIA/01 - LOGO/SVG
  // Light: zielony (#008244) - czytelny na jasnym sidebarze. Dark: ten sam zielony (kontrast OK).
  var LOGO_SRC_LIGHT = "assets/img/logo-dk-green.svg";
  var LOGO_SRC_DARK = "assets/img/logo-dk-green.svg";
  var LOGO_SRC = LOGO_SRC_LIGHT;
  var FAVICON_SRC = "assets/img/favicon-dk.svg";
  var MANIFEST_HREF = "manifest.webmanifest";

  /** Global accent CSS (chrome only) - once per page. */
  function ensureAccentCss() {
    var head = document.head;
    if (!head || head.querySelector('link[data-dam-accent-css]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./assets/css/dam-accent.css?v=20260718accent3";
    link.setAttribute("data-dam-accent-css", "1");
    head.appendChild(link);
  }

  /** Favicon DK + meta PWA (telefon / Add to Home Screen). */
  function ensureAppIcons() {
    var head = document.head;
    if (!head) return;

    function upsertLink(rel, attrs) {
      var sel = 'link[rel="' + rel + '"]';
      if (attrs.sizes) sel += '[sizes="' + attrs.sizes + '"]';
      var el = head.querySelector(sel);
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        head.appendChild(el);
      }
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, attrs[k]);
      });
      return el;
    }

    function upsertMeta(name, content) {
      var el = head.querySelector('meta[name="' + name + '"]');
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        head.appendChild(el);
      }
      el.setAttribute("content", content);
    }

    upsertLink("icon", { type: "image/svg+xml", href: FAVICON_SRC + "?v=20260718dk1" });
    upsertLink("shortcut icon", { type: "image/svg+xml", href: FAVICON_SRC + "?v=20260718dk1" });
    upsertLink("apple-touch-icon", { href: LOGO_SRC_LIGHT });
    upsertLink("manifest", { href: MANIFEST_HREF });
    upsertMeta("theme-color", "#008244");
    upsertMeta("apple-mobile-web-app-capable", "yes");
    upsertMeta("apple-mobile-web-app-status-bar-style", "default");
    upsertMeta("apple-mobile-web-app-title", "DAM");
    upsertMeta("mobile-web-app-capable", "yes");
    if (!document.title || /geex/i.test(document.title)) {
      /* nie nadpisuj sensownych tytulow stron */
    }
  }

  var NAV_ITEMS = [
    {
      key: "dashboard",
      href: "dashboard.html",
      icon: "uil-apps",
      i18n: "nav.dashboard"
    },
    {
      key: "explorer",
      href: "explorer.html",
      icon: "uil-sitemap",
      i18n: "nav.explorer"
    },
    {
      key: "visualizations",
      href: "visualizations.html",
      icon: "uil-image",
      i18n: "nav.visualizations"
    },
    {
      key: "branding",
      href: "branding.html",
      icon: "uil-palette",
      i18n: "nav.branding"
    },
    {
      key: "projects",
      href: "index.html",
      icon: "uil-box",
      i18n: "nav.projects"
    },
    {
      key: "inbox",
      href: "inbox.html",
      icon: "uil-envelope",
      i18n: "nav.inbox"
    },
    {
      key: "invoices",
      href: "invoices.html",
      icon: "uil-invoice",
      i18n: "nav.invoices"
    },
    {
      key: "costs",
      href: "costs.html",
      icon: "uil-calculator-alt",
      i18n: "nav.costs"
    },
    {
      key: "integrations",
      href: "integrations.html",
      icon: "uil-plug",
      i18n: "nav.integrations"
    }
  ];

  // Detect current page key
  function currentPageKey() {
    var path = window.location.pathname.split("/").pop().replace(".html", "");
    if (path === "dashboard" || path === "index-4" || path === "") return "dashboard";
    if (path === "explorer" || path === "file-manager") return "explorer";
    if (path === "visualizations" || path === "viz") return "visualizations";
    if (path === "branding") return "branding";
    if (path === "index" || path === "projects") return "projects";
    if (path === "project") return "project";
    if (path === "inbox") return "inbox";
    if (path === "invoices") return "invoices";
    if (path === "costs") return "costs";
    if (path === "integrations") return "integrations";
    if (path === "profile") return "profile";
    if (path === "settings") return "settings";
    if (path === "billing") return "billing";
    if (path === "activity") return "activity";
    if (path === "help") return "help";
    return "";
  }

  /** Hierarchia jak kategorie w sklepie: Panel > Sekcja > [opcjonalnie szczegol] */
  var PAGE_TRAIL = {
    dashboard: { labelKey: "nav.home", label: "Panel", parent: null, href: "dashboard.html" },
    explorer: { labelKey: "nav.explorer", label: "Eksplorer", parent: "dashboard", href: "explorer.html" },
    visualizations: { labelKey: "nav.visualizations", label: "Wizualizacje", parent: "dashboard", href: "visualizations.html" },
    branding: { labelKey: "nav.branding", label: "Branding", parent: "dashboard", href: "branding.html" },
    projects: { labelKey: "nav.projects", label: "Projekty", parent: "dashboard", href: "index.html" },
    project: { labelKey: "nav.project", label: "Projekt", parent: "projects", href: "project.html" },
    invoices: { labelKey: "nav.invoices", label: "Faktury", parent: "dashboard", href: "invoices.html" },
    costs: { labelKey: "nav.costs", label: "Kalkulator kosztów", parent: "dashboard", href: "costs.html" },
    integrations: { labelKey: "nav.integrations", label: "Integracje", parent: "dashboard", href: "integrations.html" },
    profile: { labelKey: "user.profile", label: "Profil", parent: "dashboard", href: "profile.html" },
    settings: { labelKey: "user.settings", label: "Ustawienia", parent: "dashboard", href: "settings.html" },
    billing: { labelKey: "user.billing", label: "Rozliczenia", parent: "dashboard", href: "billing.html" },
    activity: { labelKey: "user.activity", label: "Aktywność", parent: "dashboard", href: "activity.html" },
    inbox: { labelKey: "nav.inbox", label: "Wiadomości", parent: "dashboard", href: "inbox.html" },
    help: { labelKey: "user.help", label: "Pomoc", parent: "dashboard", href: "help.html" }
  };

  var NAV_STACK_KEY = "dam_nav_stack";

  function trailLabel(meta) {
    if (!meta) return "";
    // Prefer explicit PL fallbacks until i18n dictionary is ready
    if (window.DamI18n && typeof window.DamI18n.t === "function") {
      var v = window.DamI18n.t(meta.labelKey);
      if (v && v !== meta.labelKey) return v;
    }
    return meta.label;
  }

  function navItemLabel(item) {
    if (window.DamI18n && typeof window.DamI18n.t === "function") {
      var v = window.DamI18n.t(item.i18n);
      if (v && v !== item.i18n) return v;
    }
    var fallbacks = {
      "nav.dashboard": "Dashboard",
      "nav.explorer": "Eksplorer",
      "nav.visualizations": "Wizualizacje",
      "nav.branding": "Branding",
      "nav.projects": "Projekty",
      "nav.inbox": "Wiadomości",
      "nav.invoices": "Faktury",
      "nav.costs": "Kalkulator kosztów",
      "nav.integrations": "Integracje",
      "nav.logout": "Wyloguj"
    };
    return fallbacks[item.i18n] || item.i18n;
  }

  function currentNavUrl() {
    var file = window.location.pathname.split("/").pop() || "dashboard.html";
    return file + (window.location.search || "");
  }

  function pushNavStack() {
    var url = currentNavUrl();
    var stack = [];
    try { stack = JSON.parse(sessionStorage.getItem(NAV_STACK_KEY) || "[]"); } catch (e) { stack = []; }
    if (!Array.isArray(stack)) stack = [];
    if (stack[stack.length - 1] !== url) stack.push(url);
    if (stack.length > 40) stack = stack.slice(-40);
    sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
  }

  /* Aktualizuj wierzcholek stosu (np. index.html -> index.html?q=test) bez push */
  function replaceNavStackTop(url) {
    if (!url) return;
    var stack = [];
    try { stack = JSON.parse(sessionStorage.getItem(NAV_STACK_KEY) || "[]"); } catch (e) { stack = []; }
    if (!Array.isArray(stack)) stack = [];
    if (!stack.length) {
      stack.push(url);
    } else {
      var topFile = String(stack[stack.length - 1]).split("?")[0];
      var nextFile = String(url).split("?")[0];
      if (topFile === nextFile) {
        stack[stack.length - 1] = url;
      } else {
        stack.push(url);
      }
    }
    if (stack.length > 40) stack = stack.slice(-40);
    sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
  }

  function parentHrefForKey(key) {
    var meta = PAGE_TRAIL[key];
    if (!meta || !meta.parent) return "dashboard.html";
    var parent = PAGE_TRAIL[meta.parent];
    return parent ? parent.href : "dashboard.html";
  }

  /* Faza 6 (2026-07-18, P-audyt X/Wstecz): jeśli jest otwarty podgląd/modal
     (lightbox wizualizacji, popover edycji tagu, modal zgłoszenia), "Wstecz"
     ZAMYKA GO i nie nawiguje do innej strony. Wyjatek zgodny z prosba usera. */
  function closeTopmostOverlayIfAny() {
    var overlaySelectors = [
      "#damMediaPreview",
      "#damLifecycleHistoryModal",
      "#damLightbox",
      "#damVizModal",
      "#damVizRequestModal",
      "#damTagEditPopover",
      "#damThumbPicker",
      "#damAddVariantModal",
      "#damBasepathModal",
      "#damElementsPicker",
    ];
    for (var i = 0; i < overlaySelectors.length; i++) {
      var el = document.querySelector(overlaySelectors[i]);
      if (el) {
        if (el.id === "damMediaPreview") {
          document.body.classList.remove("dam-media-preview-open");
        }
        el.remove();
        return true;
      }
    }
    return false;
  }

  function goBackNav() {
    if (closeTopmostOverlayIfAny()) return;
    /* Na inboxie: Wstecz cofa ostatnia akcje (expand, potem filtr), nie nawigacje */
    if (window.DamInbox && typeof window.DamInbox.collapseExpanded === "function") {
      if (window.DamInbox.collapseExpanded()) return;
    }
    if (window.DamInbox && typeof window.DamInbox.popFilter === "function") {
      if (window.DamInbox.popFilter()) return;
    }
    var stack = [];
    try { stack = JSON.parse(sessionStorage.getItem(NAV_STACK_KEY) || "[]"); } catch (e) { stack = []; }
    if (!Array.isArray(stack)) stack = [];
    var here = currentNavUrl();
    if (stack[stack.length - 1] === here) stack.pop();
    var prev = stack.pop();
    sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
    if (prev && prev !== here) {
      window.location.href = prev;
      return;
    }
    var parent = parentHrefForKey(currentPageKey());
    try {
      var ref = document.referrer;
      if (ref) {
        var u = new URL(ref);
        if (u.origin === window.location.origin) {
          var file = (u.pathname.split("/").pop() || "").split("?")[0];
          var refUrl = file + (u.search || "");
          if (/\.html$/i.test(file) && file.indexOf("signin") === -1 && refUrl !== here) {
            window.history.back();
            return;
          }
        }
      }
    } catch (e2) { /* ignore */ }
    window.location.href = parent;
  }

  function buildTrailCrumbs(leafOverride) {
    var key = currentPageKey();
    var crumbs = [];
    var home = PAGE_TRAIL.dashboard;
    crumbs.push({ href: home.href, label: trailLabel(home), current: key === "dashboard" && !leafOverride });

    if (key && key !== "dashboard") {
      var chain = [];
      var walk = key;
      while (walk && PAGE_TRAIL[walk] && walk !== "dashboard") {
        chain.unshift(walk);
        walk = PAGE_TRAIL[walk].parent;
      }
      chain.forEach(function (k, idx) {
        var meta = PAGE_TRAIL[k];
        var isLast = idx === chain.length - 1;
        var label = trailLabel(meta);
        if (isLast && leafOverride) label = leafOverride;
        crumbs.push({
          href: isLast ? null : meta.href,
          label: label,
          current: isLast
        });
      });
    } else if (leafOverride) {
      crumbs.push({ href: null, label: leafOverride, current: true });
      crumbs[0].current = false;
    }
    return crumbs;
  }

  function renderNavTrail(leafOverride) {
    var mount = document.querySelector(".geex-content__header__content");
    if (!mount) return;
    var existing = document.getElementById("damNavTrail");
    var crumbs = buildTrailCrumbs(leafOverride);
    var backLabel = window.DamI18n ? window.DamI18n.t("nav.back") : "Wstecz";
    if (backLabel === "nav.back") backLabel = "Wstecz";

    var crumbsHtml = crumbs.map(function (c) {
      if (c.current || !c.href) {
        return '<li class="dam-breadcrumb__item"><span class="dam-breadcrumb__current" aria-current="page">' +
          escapeHtml(c.label) + "</span></li>";
      }
      return '<li class="dam-breadcrumb__item"><a class="dam-breadcrumb__link" href="' + c.href + '">' +
        escapeHtml(c.label) + "</a></li>";
    }).join("");

    var html =
      '<nav class="dam-nav-trail" id="damNavTrail" aria-label="' + escapeHtml(backLabel) + ' / ścieżka">' +
      '<button type="button" class="dam-nav-back" id="damNavBack" aria-label="' + escapeHtml(backLabel) + '">' +
      '<i class="uil uil-arrow-left" aria-hidden="true"></i>' +
      '<span class="dam-nav-back__label">' + escapeHtml(backLabel) + "</span>" +
      "</button>" +
      '<ol class="dam-breadcrumb">' + crumbsHtml + "</ol>" +
      "</nav>";

    if (existing) {
      existing.outerHTML = html;
    } else {
      mount.insertAdjacentHTML("afterbegin", html);
    }
    var btn = document.getElementById("damNavBack");
    if (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        goBackNav();
      });
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setTrailLeaf(label) {
    renderNavTrail(label || null);
  }

  function injectNavTrail() {
    var isSignin = window.location.pathname.indexOf("signin") !== -1;
    if (isSignin) return;
    pushNavStack();
    var leaf = null;
    var titleEl = document.getElementById("damProjectTitle");
    if (currentPageKey() === "project" && titleEl) {
      var t = (titleEl.textContent || "").trim();
      if (t && t !== "Projekt" && t.toLowerCase() !== "ładowanie...") leaf = t;
    }
    renderNavTrail(leaf);
  }

  function ensureAdminSession() {
    if (!DAM_DEV_ALWAYS_ADMIN) return;
    localStorage.setItem("dam_token", "demo-admin-dev-token");
    localStorage.setItem("dam_role", "admin");
    // Użytkownik: Krzysztof Wieczorek (Grafik Marketing, Kubara)
    var stored = localStorage.getItem("dam_user_name");
    if (!stored || stored === "Administrator DAM") {
      localStorage.setItem("dam_user_name", "Krzysztof Wieczorek");
    }
    localStorage.setItem("dam_user", JSON.stringify({
      email: "krzysztof.wieczorek@kubara.pl",
      role: "admin",
      name: "Krzysztof Wieczorek",
      title: "GRAFIK",
      department: "MARKETING",
      company: "KUBARA",
      phone: "502597985",
      manager: "Karolina Poznar",
      managerTitle: "Czlonek Zarządu / Dyrektor Marketingu",
      colleagues: ["Szymon Ryngwelski", "Anna Polanska", "Marta Zasępa", "Beata Scibik", "Sylwia Zarychta", "Maciej Labus"]
    }));
  }

  // Auth guard - redirect to signin if no token (skipped in always-admin mode)
  function enforceAuth() {
    var isSigninPage = window.location.pathname.indexOf("signin") !== -1;
    ensureAdminSession();
    if (DAM_DEV_ALWAYS_ADMIN) {
      if (isSigninPage) {
        window.location.replace("dashboard.html");
      }
      return;
    }
    if (isSigninPage) {
      if (window.DamApi && typeof window.DamApi.fetchIdentity === "function") {
        window.DamApi.fetchIdentity().catch(function () {});
      }
      return;
    }
    var token = localStorage.getItem("dam_token");
    if (!token || token === "demo-admin-dev-token" || token === "qa") {
      if (token === "demo-admin-dev-token" || token === "qa") {
        localStorage.removeItem("dam_token");
        localStorage.removeItem("dam_role");
      }
      /* Brak tokena: sprobuj rehydrate z bound-session (desktop), inaczej signin. */
      if (window.DamApi && typeof window.DamApi.rehydrate === "function") {
        window.DamApi.rehydrate()
          .then(function (rh) {
            if (!(rh && rh.ok && rh.token)) {
              window.location.href = "signin.html?reason=no_token";
            }
          })
          .catch(function () {
            window.location.href = "signin.html?reason=no_token";
          });
        return;
      }
      window.location.href = "signin.html";
      return;
    }
    /* Weryfikacja sesji na bridgu (+ anti-spoof roli / chrome admin). */
    if (window.DamApi && typeof window.DamApi.me === "function") {
      window.DamApi.me()
        .then(function () {
          if (!isAdminRole()) {
            try {
              localStorage.setItem(ADMIN_MODE_KEY, "0");
            } catch (e) { /* ignore */ }
          }
          ensureAdminModeSwitch();
          try {
            window.dispatchEvent(
              new CustomEvent("dam:admin-mode", {
                detail: { on: isAdminModeOn() },
              })
            );
          } catch (e2) { /* ignore */ }
        })
        .catch(function () {});
    }
  }

  function applyDobraKaloriaLogo() {
    document.querySelectorAll(
      ".geex-sidebar__logo img, .geex-header__logo img, .geex-content__authentication__content__logo img"
    ).forEach(function (img) {
      // Geex: .logo-lite = motyw jasny, .logo-dark = motyw ciemny
      var isDarkSlot = img.classList.contains("logo-dark");
      img.src = isDarkSlot ? LOGO_SRC_DARK : LOGO_SRC_LIGHT;
      img.alt = "Dobra Kaloria";
      img.classList.add("dam-logo-dk");
      img.removeAttribute("hidden");
      img.style.opacity = "";
      img.style.visibility = "";
    });
    document.querySelectorAll(".geex-sidebar__logo, .geex-header__logo").forEach(function (a) {
      a.href = "dashboard.html";
      a.setAttribute("title", "Dobra Kaloria - DAM - Inyfinn");
    });
    // Usuń stare napisy Geex przy logo (jeśli sa w markupie)
    document.querySelectorAll(".geex-sidebar__logo, .geex-header__logo").forEach(function (wrap) {
      wrap.querySelectorAll("span, h1, h2, h3, h4, h5, p, small").forEach(function (el) {
        var t = (el.textContent || "").toLowerCase();
        if (t.indexOf("geex") !== -1 || t.indexOf("modern admin") !== -1) {
          el.style.display = "none";
        }
      });
    });
  }

  // Build sidebar nav HTML
  /** Klucz pozycji w sidebarze (projekt = Projekty). */
  function sidebarActiveKey() {
    var k = currentPageKey();
    if (k === "project") return "projects";
    return k;
  }

  function buildSidebarNav() {
    var active = sidebarActiveKey();
    var logoutLabel = navItemLabel({ i18n: "nav.logout" });
    return NAV_ITEMS.map(function (item) {
      var label = navItemLabel(item);
      var on = item.key === active;
      return '<li class="geex-sidebar__menu__item' + (on ? " active" : "") + '">' +
        '<a href="' + item.href + '" class="geex-sidebar__menu__link' + (on ? " active" : "") + '"' +
        (on ? ' aria-current="page"' : "") +
        ' title="' + label + '" aria-label="' + label + '">' +
        '<i class="uil ' + item.icon + '" aria-hidden="true" style="font-size:20px;margin-right:8px;width:22px;text-align:center"></i>' +
        '<span class="dam-nav-label" data-i18n="' + item.i18n + '">' + label + '</span>' +
        '</a></li>';
    }).join("") +
    /* (1) Sesja urzadzenia - naturalnie po nav (BEZ margin-top:auto = bez pchania w dol) */
    '<li class="geex-sidebar__menu__item dam-nav-device-session">' +
    '<a href="profile.html#damDevicePathsRoot" class="geex-sidebar__menu__link dam-device-session-btn" id="damShellDeviceSession"' +
    ' title="Sesja urządzenia - ścieżki Marketing" aria-label="Sesja urządzenia"' +
    ' data-dam-tip="Sesja urządzenia: ścieżki Marketing na tym PC">' +
    '<i class="uil uil-desktop" aria-hidden="true" style="font-size:20px;margin-right:8px;width:22px;text-align:center"></i>' +
    '<span class="dam-nav-label">Sesja urządzenia</span>' +
    '</a></li>' +
    /* (2) Wyloguj - prawdziwy logout, +50px friction od Sesji */
    '<li class="geex-sidebar__menu__item dam-nav-logout">' +
    '<a href="#" class="geex-sidebar__menu__link dam-logout-btn" id="damShellLogout"' +
    ' title="Wyloguj" aria-label="Wyloguj"' +
    ' data-dam-tip="Wyloguj z konta DAM">' +
    '<i class="uil uil-signout" aria-hidden="true" style="font-size:20px;margin-right:8px;width:22px;text-align:center"></i>' +
    '<span class="dam-nav-label" data-i18n="nav.logout">' + logoutLabel + '</span>' +
    '</a></li>';
  }

  /** Sidebar: Sesja urzadzenia -> profil z CRUD sciezek per device (nie logout). */
  function goDeviceSessionPaths(e) {
    if (e) e.preventDefault();
    var target = "profile.html#damDevicePathsRoot";
    var onProfile = /profile\.html$/i.test(location.pathname.replace(/\\/g, "/").split("/").pop() || "");
    if (onProfile) {
      if (location.hash !== "#damDevicePathsRoot") {
        location.hash = "damDevicePathsRoot";
      }
      var el = document.getElementById("damDevicePathsRoot");
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (window.DamDevicePaths && typeof DamDevicePaths.focusSection === "function") {
        DamDevicePaths.focusSection();
      }
      return;
    }
    window.location.href = target;
  }

  /** Prawdziwe wylogowanie (DamApi.logout -> clear session + signin). */
  function performLogout(e) {
    if (e) e.preventDefault();
    if (window.DamApi && typeof window.DamApi.logout === "function") {
      try {
        var p = window.DamApi.logout();
        if (p && typeof p.catch === "function") {
          p.catch(function () {
            window.location.href = "signin.html";
          });
        }
        return;
      } catch (err) { /* fallback nizej */ }
    }
    [
      "dam_token",
      "dam_session_id",
      "dam_role",
      "dam_user",
      "dam_user_name",
    ].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (err2) { /* ignore */ }
    });
    window.location.href = "signin.html";
  }

  /**
   * Warstwy shell: menu profilu / popupy headera ZAWSZE nad sticky search (z-index 52)
   * + Y-stable rail (bez 80vh shrink) + Wyloguj +50px + tor ikon bez recenter.
   * Inject - bez walki o cudzy dam-brand.css.
   */
  function ensureShellLayerCss() {
    var s = document.getElementById("damShellLayerCss");
    var created = false;
    if (!s) {
      s = document.createElement("style");
      s.id = "damShellLayerCss";
      created = true;
    }
    s.textContent =
      "/* Header popups ZAWSZE nad sticky search/filters */" +
      ".geex-content__header{position:relative;z-index:200;isolation:isolate;}" +
      ".geex-content__header__action{position:relative;z-index:12500;}" +
      ".geex-content__header__action .geex-content__header__popup," +
      ".geex-content__header__action .geex-content__header__popup.is-open," +
      ".geex-content__header__popup--author," +
      ".geex-content__header__popup--author.dam-user-menu," +
      ".geex-content__header__popup--author.dam-user-menu.is-open{" +
      "z-index:12550!important;}" +
      "/* Gdy dowolny popup headera otwarty - sticky search schodzi nizej */" +
      "body.dam-header-popup-open .dam-explorer-toolbar," +
      "body.dam-header-popup-open .dam-global-search-block .dam-explorer-toolbar," +
      "body.dam-header-popup-open .dam-filter-chips," +
      "body.dam-header-popup-open .dam-explorer-grid-toolbar{" +
      "z-index:20!important;}" +
      "/* Sesja: naturalny slot po Integracjach (bez margin-top:auto); separator bez paddingu PCHAJacego slot */" +
      ".geex-sidebar__menu__item.dam-nav-device-session{" +
      "margin-top:8px!important;padding-top:0!important;" +
      "border-top:1px solid rgba(255,255,255,0.1);}" +
      "/* Wyloguj: +50px friction od Sesji - TEN SAM gap expanded i collapsed */" +
      ".geex-sidebar__menu__item.dam-nav-logout{margin-top:50px!important;}" +
      "/* Flex column; footer/logo na dole przez margin-top:auto NA FOOTER, nie na Sesji */" +
      ".geex-sidebar__menu-wrapper{" +
      "display:flex!important;flex-direction:column!important;" +
      "flex:1 1 auto!important;min-height:0!important;}" +
      ".geex-sidebar__menu{" +
      "display:flex!important;flex-direction:column!important;" +
      "flex:0 0 auto!important;min-height:0!important;height:auto!important;" +
      "gap:0!important;}" +
      "body.dam-sidebar-collapsed .geex-sidebar__menu{gap:0!important;}" +
      "/* Geex first-child margin-top:15px - collapsed dam-brand zeruje → Y jump -15px */" +
      ".geex-sidebar__menu__item:first-child," +
      "body.dam-sidebar-collapsed .geex-sidebar__menu__item:first-child," +
      "body.dam-sidebar-morphing .geex-sidebar__menu__item:first-child{" +
      "margin-top:15px!important;margin-bottom:0!important;}" +
      ".geex-sidebar__wrapper{gap:16px!important;}" +
      ".geex-sidebar__footer{flex-shrink:0;margin-top:auto!important;}" +
      "/* Y-STABLE SLOTS: stale 56px (Geex pad 16+16+line) - bez wrap 80px na Kalkulator/Sesja */" +
      ".geex-sidebar .geex-sidebar__menu__link{" +
      "box-sizing:border-box!important;" +
      "min-height:56px!important;height:56px!important;" +
      "white-space:nowrap!important;" +
      "align-items:center!important;}" +
      "/* Ikony: ten sam box 20×20 / line-height 1 w expanded+collapsed (bez 24→20 snap) */" +
      ".geex-sidebar .geex-sidebar__menu__link i," +
      ".geex-sidebar .geex-sidebar__menu__link .uil," +
      "body.dam-sidebar-collapsed .geex-sidebar .geex-sidebar__menu__link i," +
      "body.dam-sidebar-collapsed .geex-sidebar .geex-sidebar__menu__link .uil," +
      "body.dam-sidebar-morphing .geex-sidebar .geex-sidebar__menu__link i," +
      "body.dam-sidebar-morphing .geex-sidebar .geex-sidebar__menu__link .uil{" +
      "font-size:20px!important;line-height:1!important;" +
      "width:22px!important;height:20px!important;" +
      "display:inline-flex!important;align-items:center!important;" +
      "justify-content:center!important;flex-shrink:0!important;" +
      "margin:0!important;text-align:center;}" +
      "/* Y-STABLE RAIL: kill dam-brand 80vh height shrink + 12px pad (to bylo Y jump) */" +
      "body.dam-sidebar-collapsed .geex-sidebar," +
      "body.dam-sidebar-morphing .geex-sidebar{" +
      "top:22px!important;" +
      "height:calc(100vh - 44px)!important;" +
      "min-height:calc(100vh - 44px)!important;" +
      "max-height:calc(100vh - 44px)!important;}" +
      "body.dam-sidebar-collapsed .geex-sidebar{" +
      "padding-top:38px!important;" +
      "padding-bottom:38px!important;" +
      "padding-left:var(--dam-sb-pad-x,10px)!important;" +
      "padding-right:var(--dam-sb-pad-x,10px)!important;}" +
      "/* Header: staly slot 56px (zmierzony expanded) - logo out of flow, bez skracania rzedu */" +
      ".geex-sidebar__header," +
      "body.dam-sidebar-collapsed .geex-sidebar__header," +
      "body.dam-sidebar-morphing .geex-sidebar__header{" +
      "height:56px!important;min-height:56px!important;max-height:56px!important;" +
      "margin:0!important;box-sizing:border-box!important;" +
      "align-items:center!important;}" +
      "body.dam-sidebar-collapsed .geex-sidebar__header," +
      "body.dam-sidebar-morphing .geex-sidebar__header{" +
      "padding:0!important;justify-content:center!important;position:relative!important;}" +
      "/* Morph: logo OUT OF FLOW - inaczej po zdjeciu collapsed logo wraca do flex i pcha btn */" +
      "body.dam-sidebar-morphing .geex-sidebar__header .geex-sidebar__logo," +
      "body.dam-sidebar-morphing .geex-sidebar__logo{" +
      "position:absolute!important;left:0;top:0;z-index:0;" +
      "pointer-events:none!important;margin:0!important;}" +
      "body.dam-sidebar-collapsed .geex-sidebar__header .geex-sidebar__logo," +
      "body.dam-sidebar-collapsed .geex-sidebar__logo{" +
      "position:absolute!important;left:0;top:0;" +
      "visibility:hidden!important;opacity:0!important;" +
      "pointer-events:none!important;width:1px!important;height:1px!important;" +
      "overflow:hidden!important;margin:0!important;padding:0!important;}" +
      "/* Collapse btn: WYŚRODKOWANY w railu (= ta sama oś X co ikony; bylo flex-start → CX 49 vs ikony 59) */" +
      "body.dam-sidebar-collapsed .dam-sidebar-collapse-btn," +
      "body.dam-sidebar-morphing .dam-sidebar-collapse-btn{" +
      "position:relative!important;z-index:1;" +
      "margin:0 auto!important;" +
      "width:40px!important;height:40px!important;" +
      "flex-shrink:0!important;}" +
      "/* Logo dolne: TYLKO collapsed/morph - expanded NIGDY (GSAP display:flex leftover) */" +
      "body:not(.dam-sidebar-collapsed):not(.dam-sidebar-morphing) .dam-sidebar-logo-collapsed{" +
      "display:none!important;opacity:0!important;visibility:hidden!important;" +
      "pointer-events:none!important;width:0!important;height:0!important;" +
      "overflow:hidden!important;margin:0!important;padding:0!important;}" +
      "body:not(.dam-sidebar-collapsed):not(.dam-sidebar-morphing) .dam-sidebar-collapsed-meta{" +
      "display:none!important;opacity:0!important;visibility:hidden!important;" +
      "pointer-events:none!important;width:0!important;height:0!important;" +
      "overflow:hidden!important;margin:0!important;padding:0!important;}" +
      "body.dam-sidebar-collapsed .dam-sidebar-logo-collapsed," +
      "body.dam-sidebar-morphing .dam-sidebar-logo-collapsed{" +
      "display:flex!important;visibility:visible!important;" +
      "margin-top:auto!important;flex-shrink:0;" +
      "width:48px!important;max-width:48px!important;height:auto!important;" +
      "align-self:center!important;overflow:visible!important;}" +
      "body.dam-sidebar-collapsed .dam-sidebar-collapsed-meta," +
      "body.dam-sidebar-morphing .dam-sidebar-collapsed-meta{" +
      "align-self:center!important;width:100%;}" +
      "body.dam-sidebar-collapsed .geex-sidebar__wrapper," +
      "body.dam-sidebar-morphing .geex-sidebar__wrapper{" +
      "gap:16px!important;}" +
      "/* Tor ikon collapsed = flex-start + te same CSS vars co morph (ZERO justify:center snap) */" +
      "body.dam-sidebar-collapsed .geex-sidebar .geex-sidebar__menu__link{" +
      "justify-content:flex-start!important;" +
      "align-items:center!important;" +
      "gap:0!important;" +
      "padding-left:var(--dam-link-pad-x,14px)!important;" +
      "padding-right:var(--dam-link-pad-x,14px)!important;" +
      "font-size:inherit!important;" +
      "line-height:normal!important;" +
      "min-height:56px!important;" +
      "height:56px!important;}" +
      "body.dam-sidebar-collapsed .geex-sidebar .geex-sidebar__menu__link i," +
      "body.dam-sidebar-collapsed .geex-sidebar .geex-sidebar__menu__link .uil{" +
      "font-size:20px!important;" +
      "width:22px!important;" +
      "margin:0!important;" +
      "flex-shrink:0!important;" +
      "text-align:center;}" +
      "/* Compact identity under logo (footer pelny w expanded; tu tylko DAM + v) */" +
      ".dam-sidebar-collapsed-meta{display:none;flex-direction:column;align-items:center;" +
      "gap:2px;padding:0 2px 6px;text-align:center;flex-shrink:0;" +
      "color:var(--dam-text-muted,#8a8696);font-size:10px;line-height:1.25;font-weight:600;}" +
      "body.dam-sidebar-collapsed .dam-sidebar-collapsed-meta{display:flex!important;}" +
      ".dam-sidebar-collapsed-meta__brand{letter-spacing:0.04em;}" +
      ".dam-sidebar-collapsed-meta__ver{opacity:0.9;}" +
      "/* Morph collapse: footer out of flow od razu (inaczej margin-top:auto skacze z logo) */" +
      "body.dam-sidebar-morph-to-collapsed .geex-sidebar__footer{display:none!important;}" +
      "body.dam-sidebar-morph-to-collapsed .dam-sidebar-logo-collapsed," +
      "body.dam-sidebar-morph-to-collapsed .dam-sidebar-collapsed-meta," +
      "body.dam-sidebar-morph-to-expanded .dam-sidebar-logo-collapsed," +
      "body.dam-sidebar-morph-to-expanded .dam-sidebar-collapsed-meta{display:flex!important;}" +
      "body.dam-sidebar-morphing .geex-sidebar__wrapper{position:relative!important;}" +
      "body.dam-sidebar-morphing .dam-sidebar-logo-collapsed," +
      "body.dam-sidebar-morphing .dam-sidebar-collapsed-meta{" +
      "margin-top:0!important;transform:none!important;will-change:opacity;}" +
      "body.dam-sidebar-morphing .dam-sidebar-logo-collapsed{" +
      "position:absolute!important;left:0!important;right:0!important;" +
      "bottom:38px!important;width:48px!important;margin-left:auto!important;" +
      "margin-right:auto!important;justify-content:center!important;}" +
      "body.dam-sidebar-morphing .dam-sidebar-collapsed-meta{" +
      "position:absolute!important;left:0!important;right:0!important;" +
      "bottom:10px!important;width:100%!important;box-sizing:border-box!important;}" +
      "/* Steady collapsed = ten sam slot co morph (bez skoku absolute->flex) */" +
      "body.dam-sidebar-collapsed .dam-sidebar-logo-collapsed," +
      "body.dam-sidebar-collapsed .dam-sidebar-collapsed-meta{" +
      "margin-top:0!important;transform:none!important;}" +
      "body.dam-sidebar-collapsed .dam-sidebar-logo-collapsed{" +
      "position:absolute!important;left:0!important;right:0!important;" +
      "bottom:38px!important;width:48px!important;margin-left:auto!important;" +
      "margin-right:auto!important;justify-content:center!important;}" +
      "body.dam-sidebar-collapsed .dam-sidebar-collapsed-meta{" +
      "position:absolute!important;left:0!important;right:0!important;" +
      "bottom:10px!important;width:100%!important;box-sizing:border-box!important;}" +
      "body.dam-sidebar-collapsed .geex-sidebar__menu-wrapper{padding-bottom:108px!important;}" +
      "/* Morph: kill Geex transition:all; width + icon track via CSS vars; pad-Y locked */" +
      "body.dam-sidebar-morphing .geex-sidebar," +
      "body.dam-sidebar-morphing .geex-main-content," +
      "body.dam-sidebar-morphing .geex-sidebar *{" +
      "transition:none!important;}" +
      "body.dam-sidebar-morphing .geex-sidebar{" +
      "overflow-x:hidden!important;" +
      "will-change:width;" +
      "padding-top:38px!important;" +
      "padding-bottom:38px!important;" +
      "padding-left:var(--dam-sb-pad-x,29px)!important;" +
      "padding-right:var(--dam-sb-pad-x,29px)!important;}" +
      "body.dam-sidebar-morphing .geex-main-content{" +
      "will-change:padding-inline-start;}" +
      "body.dam-sidebar-morphing .geex-sidebar__menu__link{" +
      "position:relative!important;" +
      "overflow:hidden!important;" +
      "white-space:nowrap!important;" +
      "justify-content:flex-start!important;" +
      "align-items:center!important;" +
      "gap:0!important;" +
      "min-height:56px!important;" +
      "height:56px!important;" +
      "box-sizing:border-box!important;" +
      "padding-left:var(--dam-link-pad-x,25px)!important;" +
      "padding-right:var(--dam-link-pad-x,25px)!important;}" +
      "/* Labels out of flow = icons keep track (no reflow / recenter) */" +
      "body.dam-sidebar-morphing .geex-sidebar__menu__link .dam-nav-label," +
      "body.dam-sidebar-morphing .geex-sidebar__menu__link span{" +
      "position:absolute!important;" +
      "left:calc(var(--dam-link-pad-x,25px) + 30px)!important;" +
      "top:50%!important;" +
      "transform:translateY(-50%)!important;" +
      "margin:0!important;" +
      "display:inline-block!important;" +
      "pointer-events:none;" +
      "white-space:nowrap!important;}" +
      "body.dam-sidebar-morphing .geex-sidebar__menu__link i," +
      "body.dam-sidebar-morphing .geex-sidebar__menu__link .uil," +
      "body.dam-sidebar-morphing .geex-sidebar__menu__link svg{" +
      "flex-shrink:0!important;" +
      "margin:0!important;" +
      "width:22px!important;" +
      "font-size:20px!important;" +
      "position:relative!important;" +
      "z-index:1;" +
      "will-change:filter;}" +
      "body.dam-sidebar-morphing .geex-sidebar__menu__link:hover i," +
      "body.dam-sidebar-morphing .geex-sidebar__menu__link:hover .uil{" +
      "transform:none!important;}" +
      "/* Default avatar: circle crop, bez artefaktow */" +
      ".geex-content__header__quickaction .user-img," +
      ".dam-user-menu__avatar img," +
      ".geex-content__header__popup--author img{" +
      "object-fit:cover;border-radius:50%;background:#EDE9F5;}" +
      "/* Identity block: +20px odstep od Profil/Ustawienia/Pomoc */" +
      ".dam-user-menu.is-open .geex-content__header__popup__header.dam-user-menu__identity," +
      ".geex-content__header__popup--author.dam-user-menu .dam-user-menu__identity{" +
      "margin-bottom:20px!important;}" +
      "/* User menu rows: Geex .popup__link ma align-items:flex-start !important -" +
      "   bez przebicia highlight kapsula jest nizej niz ikona/tekst." +
      "   Kapsula = row padding (rowne gora/dol), nie stretch min-height + flex-start. */" +
      ".geex-content__header__popup--author.dam-user-menu a.dam-user-menu__link," +
      ".geex-content__header__popup--author.dam-user-menu .dam-user-menu__link.geex-content__header__popup__link{" +
      "display:flex!important;" +
      "align-items:center!important;" +
      "-webkit-box-align:center!important;" +
      "-ms-flex-align:center!important;" +
      "align-content:center!important;" +
      "gap:10px!important;" +
      "min-height:0!important;" +
      "height:auto!important;" +
      "padding:11px 12px!important;" +
      "line-height:1.2!important;" +
      "box-sizing:border-box!important;}" +
      ".geex-content__header__popup--author.dam-user-menu .dam-user-menu__link i{" +
      "display:inline-flex!important;" +
      "align-items:center!important;" +
      "justify-content:center!important;" +
      "align-self:center!important;" +
      "line-height:1!important;" +
      "font-size:18px!important;" +
      "width:18px!important;" +
      "height:18px!important;" +
      "flex:0 0 18px!important;" +
      "margin:0!important;" +
      "padding:0!important;" +
      "position:static!important;" +
      "top:auto!important;" +
      "transform:none!important;" +
      "vertical-align:middle!important;}" +
      ".geex-content__header__popup--author.dam-user-menu .dam-user-menu__link i:before{" +
      "line-height:1!important;" +
      "display:block!important;" +
      "margin:0!important;}" +
      ".geex-content__header__popup--author.dam-user-menu .dam-user-menu__link span{" +
      "line-height:1.2!important;" +
      "display:inline-block!important;" +
      "align-self:center!important;" +
      "padding:0!important;" +
      "margin:0!important;}";
    if (created) document.head.appendChild(s);
  }

  // Build header menu nav HTML (top bar)
  function buildHeaderNav() {
    var active = sidebarActiveKey();
    return NAV_ITEMS.map(function (item) {
      var on = item.key === active;
      return '<li class="geex-header__menu__item' + (on ? " active" : "") + '">' +
        '<a href="' + item.href + '" class="geex-header__menu__link' + (on ? " active" : "") + '"' +
        (on ? ' aria-current="page"' : "") + '>' +
        '<i class="uil ' + item.icon + '" style="font-size:18px;margin-right:6px"></i>' +
        '<span data-i18n="' + item.i18n + '">' + navItemLabel(item) + '</span>' +
        '</a></li>';
    }).join("");
  }

  // Build brand in sidebar header + footer identity (DAM / Dobra Kaloria - Inyfinn / v…)
  function ensureSidebarFooterEl() {
    var wrapper = document.querySelector(".geex-sidebar .geex-sidebar__wrapper");
    if (!wrapper) return null;
    var footer = wrapper.querySelector(".geex-sidebar__footer");
    if (footer) return footer;
    footer = document.createElement("div");
    footer.className = "geex-sidebar__footer";
    /* Expanded: footer nad collapsed-logo / collapsed-meta (te sa tylko w rail). */
    var insertBefore =
      wrapper.querySelector(".dam-sidebar-logo-collapsed") ||
      wrapper.querySelector(".dam-sidebar-collapsed-meta");
    if (insertBefore) wrapper.insertBefore(footer, insertBefore);
    else wrapper.appendChild(footer);
    return footer;
  }

  function updateSidebarBrand() {
    var logo = document.querySelector(".geex-sidebar__logo");
    if (logo) {
      logo.href = "dashboard.html";
    }
    var brand = "DAM";
    var brandSub = "Dobra Kaloria - Inyfinn";
    var madeBy = "inyfinn.art";
    if (window.DamI18n && typeof window.DamI18n.t === "function") {
      try {
        var tb = window.DamI18n.t("nav.brand");
        var ts = window.DamI18n.t("nav.brand_sub");
        var tm = window.DamI18n.t("footer.made_by");
        if (tb && tb !== "nav.brand") brand = tb;
        if (ts && ts !== "nav.brand_sub") brandSub = ts;
        if (tm && tm !== "footer.made_by") madeBy = tm;
      } catch (eI18n) { /* keep defaults */ }
    }
    var year = new Date().getFullYear();
    var ver = String(window.DAM_APP_VERSION || "2.0.7").replace(/^v/i, "");
    var footer = ensureSidebarFooterEl();
    if (footer) {
      footer.innerHTML =
        '<span class="geex-sidebar__footer__title" data-i18n="nav.brand">' + brand + '</span>' +
        '<p class="geex-sidebar__footer__copyright" data-i18n="nav.brand_sub">' + brandSub + '</p>' +
        '<p class="geex-sidebar__footer__author">' +
          '<a class="dam-footer-author-link" href="https://inyfinn.art" target="_blank" rel="noopener noreferrer" data-i18n="footer.made_by">' +
            madeBy +
          "</a> &copy; " + year +
          ' <span class="dam-app-version" title="Wersja programu DAM">v' + ver + "</span>" +
        "</p>";
      /* Morph GSAP moze zostawic autoAlpha:0 - twardy reset widocznosci expanded. */
      footer.style.removeProperty("opacity");
      footer.style.removeProperty("visibility");
    }
    var meta = document.querySelector(".dam-sidebar-collapsed-meta");
    if (meta) {
      meta.innerHTML =
        '<span class="dam-sidebar-collapsed-meta__brand">' + brand + "</span>" +
        '<span class="dam-sidebar-collapsed-meta__ver" title="Wersja programu DAM">v' + ver + "</span>";
      resetSidebarIdentityEl(meta);
    }
    resetSidebarIdentityEl(document.querySelector(".dam-sidebar-logo-collapsed"));
  }

  function resetSidebarIdentityEl(el) {
    if (!el) return;
    if (window.gsap) {
      try {
        window.gsap.killTweensOf(el);
        window.gsap.set(el, { clearProps: "opacity,visibility,autoAlpha,x,y,transform" });
      } catch (eReset) { /* ignore */ }
    }
    el.style.removeProperty("transform");
    el.style.removeProperty("translate");
    el.style.removeProperty("opacity");
    el.style.removeProperty("visibility");
  }

  /**
   * Logo DK w sidebarze - musi byc na KAZDEJ stronie (index.html mial tylko menu bez headera).
   */
  function ensureSidebarLogo() {
    var wrapper = document.querySelector(".geex-sidebar .geex-sidebar__wrapper");
    if (!wrapper) return;
    var header = wrapper.querySelector(".geex-sidebar__header");
    if (!header) {
      header = document.createElement("div");
      header.className = "geex-sidebar__header";
      wrapper.insertBefore(header, wrapper.firstChild);
    }
    var logo = header.querySelector(".geex-sidebar__logo");
    if (!logo) {
      logo = document.createElement("a");
      logo.href = "dashboard.html";
      logo.className = "geex-sidebar__logo";
      logo.setAttribute("aria-label", "Dobra Kaloria - DAM - Inyfinn");
      logo.setAttribute("title", "Dobra Kaloria - DAM - Inyfinn");
      logo.innerHTML =
        '<img class="logo-lite dam-logo-dk" src="' + LOGO_SRC_LIGHT + '" alt="Dobra Kaloria" width="150" height="48" />' +
        '<img class="logo-dark dam-logo-dk" src="' + LOGO_SRC_DARK + '" alt="Dobra Kaloria" width="150" height="48" />';
      header.insertBefore(logo, header.firstChild);
    }

    var bottomLogo = wrapper.querySelector(".dam-sidebar-logo-collapsed");
    if (!bottomLogo) {
      bottomLogo = document.createElement("a");
      bottomLogo.href = "dashboard.html";
      bottomLogo.className = "dam-sidebar-logo-collapsed";
      bottomLogo.setAttribute("aria-label", "Dobra Kaloria - DAM - Inyfinn");
      bottomLogo.setAttribute("title", "Dobra Kaloria - DAM - Inyfinn");
      bottomLogo.innerHTML =
        '<img class="logo-lite dam-logo-dk" src="' + LOGO_SRC_LIGHT + '" alt="Dobra Kaloria" width="48" height="48" />' +
        '<img class="logo-dark dam-logo-dk" src="' + LOGO_SRC_DARK + '" alt="Dobra Kaloria" width="48" height="48" />';
      wrapper.appendChild(bottomLogo);
      bottomLogo.addEventListener("click", function (e) {
        if (!document.body.classList.contains("dam-sidebar-collapsed")) return;
        e.preventDefault();
        setSidebarCollapsed(false);
      });
    }

    /* Compact author/version under logo (collapsed); pelny footer w expanded. */
    var collapsedMeta = wrapper.querySelector(".dam-sidebar-collapsed-meta");
    if (!collapsedMeta) {
      collapsedMeta = document.createElement("div");
      collapsedMeta.className = "dam-sidebar-collapsed-meta";
      collapsedMeta.setAttribute("aria-label", "DAM - Dobra Kaloria - Inyfinn");
      if (bottomLogo.nextSibling) {
        wrapper.insertBefore(collapsedMeta, bottomLogo.nextSibling);
      } else {
        wrapper.appendChild(collapsedMeta);
      }
    }

    applyDobraKaloriaLogo();
  }

  /**
   * GLOBAL header chrome - ten sam markup na kazdej stronie (design system).
   * Jezeli strona nie ma .geex-content__header__action - wstrzyknij.
   */
  /**
   * Geex demo wstawia grube fill-SVG. Zastepujemy cienkimi Unicons (line),
   * zeby header wyglądal jak reszta DAM / theme.
   */
  function normalizeHeaderIcons() {
    var list = document.querySelector(
      ".geex-content__header__action .geex-content__header__quickaction"
    );
    if (!list) return;
    var iconByIndex = ["uil-search", "uil-comment-alt-dots", "uil-bell"];
    var items = list.querySelectorAll(":scope > .geex-content__header__quickaction__item");
    items.forEach(function (item, idx) {
      var link = item.querySelector(":scope > .geex-content__header__quickaction__link");
      if (!link) return;
      if (link.querySelector("img.user-img")) return;
      var want = iconByIndex[idx];
      if (!want) return;
      link.querySelectorAll("svg").forEach(function (svg) {
        svg.remove();
      });
      var icon = link.querySelector("i.uil");
      if (!icon) {
        icon = document.createElement("i");
        icon.setAttribute("aria-hidden", "true");
        link.insertBefore(icon, link.firstChild);
      }
      icon.className = "uil " + want + " dam-header-icon";
    });

    // Badge: czytelniejsze warianty (messages = amber, notif = teal)
    var msgBadge = document.getElementById("damMsgBadge");
    if (msgBadge) {
      msgBadge.classList.add("dam-badge--msg");
      msgBadge.classList.remove("bg-info");
    }
    var notifBadge = document.getElementById("damNotifBadge");
    if (notifBadge) {
      notifBadge.classList.add("dam-badge--notif");
      notifBadge.classList.remove("bg-info");
    }
    list.querySelectorAll(".geex-content__header__badge").forEach(function (badge, i) {
      if (badge.id === "damMsgBadge" || badge.id === "damNotifBadge") return;
      if (i === 0) badge.classList.add("dam-badge--msg");
      if (i === 1) {
        badge.classList.add("dam-badge--notif");
        badge.classList.remove("bg-info");
      }
    });
  }

  var ADMIN_MODE_KEY = "dam_admin_mode";

  function isAdminRole() {
    var role =
      (window.DamApi && typeof window.DamApi.role === "function" && window.DamApi.role()) ||
      localStorage.getItem("dam_role") ||
      "";
    return String(role).toLowerCase() === "admin";
  }

  function isAdminModeOn() {
    return isAdminRole() && localStorage.getItem(ADMIN_MODE_KEY) === "1";
  }

  function setAdminMode(on) {
    var next = !!on && isAdminRole();
    localStorage.setItem(ADMIN_MODE_KEY, next ? "1" : "0");
    syncAdminModeSwitchUi();
    try {
      window.dispatchEvent(
        new CustomEvent("dam:admin-mode", { detail: { on: next } })
      );
    } catch (e) { /* ignore */ }
  }

  function adminSwitchHtml() {
    return (
      '<li class="geex-content__header__quickaction__item dam-admin-switch-item" id="damAdminSwitchItem" hidden>' +
        '<label class="dam-switch dam-admin-header-switch" for="damAdminModeSwitch" ' +
          'title="Tryb admina: edycja tagów (Shift+klik), statusy wariantów, miniatury" ' +
          'data-dam-tip="Włącz edycję tagów i narzędzi admina. Wyłączony = zwykły widok.">' +
          '<input type="checkbox" class="dam-switch__input" id="damAdminModeSwitch" />' +
          '<span class="dam-switch__track" aria-hidden="true"></span>' +
          '<span class="dam-switch__label">Admin</span>' +
        "</label>" +
      "</li>"
    );
  }

  function headerQuickactionHtml() {
    return (
      '<div class="geex-content__header__customizer">' +
        '<button type="button" class="geex-btn geex-btn__toggle-sidebar" aria-label="Menu boczne" data-dam-tip="Otwórz / zamknij menu">' +
          '<i class="uil uil-align-center-alt"></i></button>' +
      "</div>" +
      '<div class="geex-content__header__action__wrap">' +
        '<ul class="geex-content__header__quickaction">' +
          '<li class="geex-content__header__quickaction__item">' +
            '<a href="#" class="geex-content__header__quickaction__link" aria-label="Szukaj" data-dam-tip="Szukaj">' +
              '<i class="uil uil-search" style="font-size:22px;color:#464255"></i></a>' +
            '<div class="geex-content__header__searchform geex-content__header__popup">' +
              '<input type="text" placeholder="Szukaj..." class="geex-content__header__btn" />' +
              '<i class="uil uil-search"></i></div>' +
          "</li>" +
          '<li class="geex-content__header__quickaction__item">' +
            '<a href="#" class="geex-content__header__quickaction__link" id="damMsgBellLink" aria-label="Wiadomości" data-dam-tip="Wiadomości Asana i Teams">' +
              '<i class="uil uil-comment-alt-dots" style="font-size:22px;color:#464255"></i>' +
              '<span class="geex-content__header__badge dam-badge--msg" id="damMsgBadge" hidden>0</span></a>' +
            '<div class="geex-content__header__popup geex-content__header__popup--message" role="dialog" aria-label="Wiadomości"></div>' +
          "</li>" +
          '<li class="geex-content__header__quickaction__item">' +
            '<a href="#" class="geex-content__header__quickaction__link" id="damNotifBellLink" aria-label="Powiadomienia" data-dam-tip="Powiadomienia operacyjne">' +
              '<i class="uil uil-bell" style="font-size:22px;color:#464255"></i>' +
              '<span class="geex-content__header__badge dam-badge--notif" id="damNotifBadge" hidden>0</span></a>' +
            '<div class="geex-content__header__popup geex-content__header__popup--notification" role="dialog" aria-label="Powiadomienia"></div>' +
          "</li>" +
          adminSwitchHtml() +
          '<li class="geex-content__header__quickaction__item">' +
            '<a href="#" class="geex-content__header__quickaction__link" aria-label="Profil" data-dam-tip="Menu użytkownika">' +
              '<img class="user-img" src="assets/img/avatar/avatar-male.svg" alt="" /></a>' +
            '<div class="geex-content__header__popup geex-content__header__popup--author dam-user-menu" role="menu" aria-label="Menu użytkownika">' +
              authorPopupInnerHtml() +
            "</div>" +
          "</li>" +
        "</ul></div>"
    );
  }

  function ensureAdminModeSwitch() {
    var list = document.querySelector(
      ".geex-content__header__action .geex-content__header__quickaction"
    );
    if (!list) return;
    var profileItem = null;
    list.querySelectorAll(":scope > .geex-content__header__quickaction__item").forEach(function (item) {
      if (item.querySelector("img.user-img")) profileItem = item;
    });
    var existing = document.getElementById("damAdminSwitchItem");
    if (!existing) {
      var wrap = document.createElement("div");
      wrap.innerHTML = adminSwitchHtml();
      existing = wrap.firstChild;
    }
    // ZAWSZE tuż przed avatarem (po PL / jezyku, nie przed nim)
    if (profileItem) {
      if (existing.nextElementSibling !== profileItem) {
        list.insertBefore(existing, profileItem);
      }
    } else if (!existing.parentNode) {
      list.appendChild(existing);
    }
    // Usun lokalne przełączniki trybu admina ze stron (jedyny switch = header)
    document.querySelectorAll("#damAdminToggle, #vizAdminToggle, label.dam-admin-toggle").forEach(function (el) {
      var kill = el.id === "vizAdminToggle" ? el.closest("label.dam-admin-toggle") || el : el;
      if (kill && kill.parentNode) kill.parentNode.removeChild(kill);
    });
    syncAdminModeSwitchUi();
    bindAdminModeSwitch();
  }

  function syncAdminModeSwitchUi() {
    var item = document.getElementById("damAdminSwitchItem");
    var input = document.getElementById("damAdminModeSwitch");
    var label = item && item.querySelector(".dam-admin-header-switch");
    if (!item || !input) return;
    var admin = isAdminRole();
    item.hidden = !admin;
    if (!admin) {
      input.checked = false;
      if (label) label.classList.add("is-off");
      return;
    }
    var on = localStorage.getItem(ADMIN_MODE_KEY) === "1";
    input.checked = on;
    if (label) label.classList.toggle("is-off", !on);
  }

  function bindAdminModeSwitch() {
    var input = document.getElementById("damAdminModeSwitch");
    if (!input || input._damAdminBound) return;
    input._damAdminBound = true;
    input.addEventListener("change", function () {
      setAdminMode(!!input.checked);
    });
    input.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  function authorPopupInnerHtml() {
    return (
      '<div class="geex-content__header__popup__header dam-user-menu__identity">' +
        '<div class="geex-content__header__popup__header__img dam-user-menu__avatar"><img src="assets/img/avatar/avatar-male.svg" alt="" /></div>' +
        '<div class="geex-content__header__popup__header__content dam-user-menu__meta">' +
          '<h3 class="geex-content__header__popup__header__title dam-user-menu__name">Użytkownik</h3>' +
          '<span class="geex-content__header__popup__header__subtitle dam-user-menu__role"></span>' +
        "</div></div>" +
      /* Bez aria-label na nav/legal: dam-tooltips.js tipuje kazdy [aria-label] */
      /* i pokazywal stray tip "Konto" / "Dokumenty" nad Wyloguj. */
      '<nav class="dam-user-menu__nav">' +
        '<ul class="geex-content__header__popup__items dam-user-menu__items">' +
          '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link dam-user-menu__link" href="profile.html" role="menuitem"><i class="uil uil-user"></i><span>Profil</span></a></li>' +
          '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link dam-user-menu__link" href="settings.html" role="menuitem"><i class="uil uil-cog"></i><span>Ustawienia</span></a></li>' +
          '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link dam-user-menu__link" href="help.html" role="menuitem"><i class="uil uil-question-circle"></i><span>Pomoc</span></a></li>' +
        "</ul>" +
      "</nav>" +
      '<div class="dam-user-menu__legal">' +
        '<a class="dam-user-menu__legal-link" href="privacy.html">Prywatność</a>' +
        '<span class="dam-user-menu__legal-sep" aria-hidden="true">·</span>' +
        '<a class="dam-user-menu__legal-link" href="terms.html">Regulamin</a>' +
        '<span class="dam-user-menu__legal-sep" aria-hidden="true">·</span>' +
        '<a class="dam-user-menu__legal-link" href="license.html">Licencja</a>' +
      "</div>" +
      '<div class="geex-content__header__popup__footer dam-user-menu__footer">' +
        '<a href="#" class="geex-content__header__popup__footer__link dam-user-menu__logout" role="menuitem"><i class="uil uil-signout"></i><span>Wyloguj</span></a>' +
      "</div>"
    );
  }

  function ensureUserMenuMarkup() {
    var popup = document.querySelector(".geex-content__header__popup--author");
    if (!popup) return;
    if (popup.classList.contains("dam-user-menu") && popup.querySelector(".dam-user-menu__legal")) {
      /* Strip legacy aria-label that dam-tooltips turned into stray "Konto" tip */
      var nav = popup.querySelector(".dam-user-menu__nav");
      if (nav) nav.removeAttribute("aria-label");
      var legal = popup.querySelector(".dam-user-menu__legal");
      if (legal) legal.removeAttribute("aria-label");
      return;
    }
    popup.classList.add("dam-user-menu");
    popup.setAttribute("role", "menu");
    popup.setAttribute("aria-label", "Menu użytkownika");
    popup.innerHTML = authorPopupInnerHtml();
  }

  function ensureHeaderChrome() {
    var header = document.querySelector(".geex-content__header");
    if (!header) return;
    // Header content (title/subtitle) zostaje ze strony - chrome action ZAWSZE
    var existing = header.querySelector(".geex-content__header__action");
    // inbox.html ma pusty #damHeaderAction - wypelnij, nie wychodz wczesnie
    if (existing) {
      if (!existing.querySelector(".geex-content__header__quickaction")) {
        existing.innerHTML = headerQuickactionHtml();
      }
      ensureUserMenuMarkup();
      normalizeHeaderIcons();
      ensureAdminModeSwitch();
      return;
    }

    var wrap = document.createElement("div");
    wrap.className = "geex-content__header__action";
    wrap.id = "damHeaderAction";
    wrap.innerHTML = headerQuickactionHtml();
    header.appendChild(wrap);
    ensureUserMenuMarkup();
    normalizeHeaderIcons();
    ensureAdminModeSwitch();
  }

  /**
   * Globalne otwieranie popupow headera - class .is-open.
   * Geex main.js uzywa jQuery slideToggle, ktore psuje panel wiadomości (stala wysokosc).
   */
  function bindDamHeaderPopups() {
    var root = document.querySelector(".geex-content__header__action");
    if (!root) return;

    if (window.jQuery) {
      try {
        window.jQuery(root).find(".geex-content__header__quickaction__link").off("click");
      } catch (e) { /* ignore */ }
    }

    if (root.getAttribute("data-dam-popups") === "1") return;
    root.setAttribute("data-dam-popups", "1");

    function syncHeaderPopupOpenClass() {
      var anyOpen = !!root.querySelector(".geex-content__header__popup.is-open");
      document.body.classList.toggle("dam-header-popup-open", anyOpen);
    }

    root.addEventListener("click", function (e) {
      var link = e.target.closest(".geex-content__header__quickaction__link");
      if (!link || !root.contains(link)) return;
      e.preventDefault();
      e.stopPropagation();
      var item = link.closest(".geex-content__header__quickaction__item");
      if (!item) return;
      var popup = item.querySelector(".geex-content__header__popup");
      if (!popup) return;
      var wasOpen = popup.classList.contains("is-open");
      root.querySelectorAll(".geex-content__header__popup.is-open").forEach(function (p) {
        p.classList.remove("is-open");
      });
      if (!wasOpen) {
        popup.classList.add("is-open");
        popup.style.display = "";
        popup.style.height = popup.classList.contains("geex-content__header__popup--message")
          ? (popup.style.height || "")
          : "";
      }
      syncHeaderPopupOpenClass();
    }, true);

    document.addEventListener("click", function (e) {
      if (e.target.closest(".geex-content__header__action")) return;
      root.querySelectorAll(".geex-content__header__popup.is-open").forEach(function (p) {
        p.classList.remove("is-open");
      });
      syncHeaderPopupOpenClass();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      root.querySelectorAll(".geex-content__header__popup.is-open").forEach(function (p) {
        p.classList.remove("is-open");
      });
      syncHeaderPopupOpenClass();
    });
  }

  function formatBadgeCount(n) {
    var c = parseInt(n, 10) || 0;
    if (c <= 0) return "";
    return c > 99 ? "99+" : String(c);
  }

  function findBadgeNearPopup(popupClass, fallbackId) {
    var byId = document.getElementById(fallbackId);
    if (byId) return byId;
    var popup = document.querySelector(popupClass);
    if (!popup) return null;
    var item = popup.closest(".geex-content__header__quickaction__item");
    return item ? item.querySelector(".geex-content__header__badge") : null;
  }

  function setHeaderBadge(id, count) {
    var el = id === "damMsgBadge"
      ? findBadgeNearPopup(".geex-content__header__popup--message", "damMsgBadge")
      : id === "damNotifBadge"
        ? findBadgeNearPopup(".geex-content__header__popup--notification", "damNotifBadge")
        : document.getElementById(id);
    if (!el) return;
    var label = formatBadgeCount(count);
    if (!label) {
      el.hidden = true;
      el.setAttribute("hidden", "hidden");
      el.textContent = "0";
      return;
    }
    el.hidden = false;
    el.removeAttribute("hidden");
    el.textContent = label;
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Build messages popup with Asana + Teams tabs (Geex + dam-brand tokens)
  function buildMessagesPopup() {
    var msgPopup = document.querySelector(".geex-content__header__popup--message");
    if (!msgPopup) return;

    var asanaTasks = [];
    try {
      if (window._DAM_ASANA_TASKS && window._DAM_ASANA_TASKS.length) {
        asanaTasks = window._DAM_ASANA_TASKS.slice(0, 10);
      }
    } catch (e) { /* ignore */ }

    var teamsMessages = [
      { from: "Anna Polanska", time: "10 min temu", msg: "Prosze sprawdz projekt Tuba Prezentowa - oczekuje na akceptacje." },
      { from: "Marek Paluszewski", time: "1 godz. temu", msg: "Karta wprowadzenia dla DK TUBA gotowa do przejrzenia." },
      { from: "Karolina Kubara", time: "2 godz. temu", msg: "Potrzebujemy grafiki do kategorii dla nowej linii produktów." },
      { from: "Maciej Labus", time: "wczoraj", msg: "Specyfikacja techniczna zaktualizowana - prosze weryfikowac." }
    ];

    var pendingMod = 0;
    try {
      pendingMod = parseInt(localStorage.getItem("dam_pending_moderation") || "0", 10) || 0;
    } catch (e2) {
      pendingMod = 0;
    }
    var totalMsg = asanaTasks.length + teamsMessages.length + pendingMod;
    setHeaderBadge("damMsgBadge", totalMsg);
    /* Odśwież licznik pending zgloszen (admin) w tle */
    try {
      var bridge =
        (window.DamPaths && window.DamPaths.bridgeUrl && window.DamPaths.bridgeUrl()) ||
        "http://127.0.0.1:8766";
      var hdrs =
        (window.DamApi && window.DamApi.authHeaders && window.DamApi.authHeaders()) || {
          Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
        };
      fetch(bridge + "/tag-proposals", { headers: hdrs })
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          var n = (d.proposals || []).filter(function (p) {
            return p.status === "pending";
          }).length;
          try {
            localStorage.setItem("dam_pending_moderation", String(n));
          } catch (e3) {
            /* ignore */
          }
          setHeaderBadge("damMsgBadge", asanaTasks.length + teamsMessages.length + n);
        })
        .catch(function () {
          /* ignore */
        });
    } catch (e4) {
      /* ignore */
    }

    var asanaHTML = asanaTasks.length
      ? asanaTasks.map(function (task) {
          var due = task.due
            ? '<span class="dam-msg-time">Termin: ' + escHtml(task.due) + "</span>"
            : "";
          var section = task.section
            ? '<span class="dam-msg-source">' + escHtml(task.section) + "</span>"
            : '<span class="dam-msg-source">Asana</span>';
          var parent = task.parent
            ? '<div class="geex-content__header__popup__item__desc dam-msg-desc">' + escHtml(task.parent) + "</div>"
            : "";
          return '<li class="geex-content__header__popup__item">' +
            '<a class="geex-content__header__popup__link" href="inbox.html?tag=asana">' +
            '<div class="geex-content__header__popup__item__img" aria-hidden="true">' +
            '<i class="uil uil-check-square"></i></div>' +
            '<div class="geex-content__header__popup__item__content">' +
            '<h5 class="geex-content__header__popup__item__title dam-msg-title-wrap">' +
            escHtml(task.name) +
            "</h5>" +
            due + parent +
            '<div class="dam-msg-section-row">' + section + "</div>" +
            "</div></a></li>";
        }).join("")
      : '<li class="dam-msg-empty">Brak otwartych zadań Asana albo jeszcze sie laduja.</li>';

    var teamsHTML = teamsMessages.map(function (m) {
      return '<li class="geex-content__header__popup__item">' +
        '<a class="geex-content__header__popup__link" href="#">' +
        '<div class="geex-content__header__popup__item__img">' +
        '<img src="assets/img/avatar/user.svg" alt="" />' +
        "</div>" +
        '<div class="geex-content__header__popup__item__content">' +
        '<h5 class="geex-content__header__popup__item__title">' + escHtml(m.from) + "</h5>" +
        '<span class="geex-content__header__popup__item__time">' + escHtml(m.time) + "</span>" +
        '<div class="geex-content__header__popup__item__desc dam-msg-desc">' + escHtml(m.msg) + "</div>" +
        '<span class="dam-msg-source">Teams</span>' +
        "</div></a></li>";
    }).join("");

    msgPopup.innerHTML =
      '<div class="dam-popup-head">' +
        '<h3 class="dam-popup-head__title">Wiadomości</h3>' +
        '<span class="dam-popup-head__count">' + escHtml(formatBadgeCount(totalMsg) || "0") + "</span>" +
      "</div>" +
      '<div class="dam-msg-tabs" role="tablist">' +
        '<button type="button" class="dam-msg-tab is-active" data-tab="asana" role="tab" aria-selected="true">Asana (' + asanaTasks.length + ")</button>" +
        '<button type="button" class="dam-msg-tab" data-tab="teams" role="tab" aria-selected="false">Teams (' + teamsMessages.length + ")</button>" +
      "</div>" +
      '<div class="geex-content__header__popup__content">' +
        '<div id="damMsgAsana"><ul class="geex-content__header__popup__items">' + asanaHTML + "</ul></div>" +
        '<div id="damMsgTeams" hidden><ul class="geex-content__header__popup__items">' + teamsHTML + "</ul></div>" +
      "</div>" +
      '<div class="dam-msg-footer-link"><a href="inbox.html">Wszystkie zadania</a></div>' +
      '<div class="dam-msg-resize-handle" title="Przeciagnij, aby zmienic wysokosc" aria-label="Zmien wysokosc okna wiadomości"></div>';

    msgPopup.querySelectorAll(".dam-msg-tab").forEach(function (tab) {
      tab.addEventListener("click", function (e) {
        e.stopPropagation();
        var target = this.getAttribute("data-tab");
        msgPopup.querySelectorAll(".dam-msg-tab").forEach(function (t) {
          var on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        var asana = document.getElementById("damMsgAsana");
        var teams = document.getElementById("damMsgTeams");
        if (asana) asana.hidden = target !== "asana";
        if (teams) teams.hidden = target !== "teams";
      });
    });

    enableMessagePopupResize(msgPopup);
  }

  function enableMessagePopupResize(msgPopup) {
    if (!msgPopup) return;

    var DEFAULT_H = 520;
    var MIN_H = 320;
    var MAX_H = Math.min(window.innerHeight * 0.85, 900);
    var saved = parseInt(localStorage.getItem("dam_msg_popup_h") || "", 10);
    if (!isNaN(saved) && saved >= MIN_H) {
      msgPopup.style.height = Math.min(saved, MAX_H) + "px";
    } else if (!msgPopup.style.height) {
      msgPopup.style.height = DEFAULT_H + "px";
    }

    var handle = msgPopup.querySelector(".dam-msg-resize-handle");
    if (!handle || handle.getAttribute("data-dam-resize-bound") === "1") return;
    handle.setAttribute("data-dam-resize-bound", "1");

    var dragging = false;
    var startY = 0;
    var startH = 0;

    function onMove(clientY) {
      if (!dragging) return;
      var next = startH + (clientY - startY);
      next = Math.max(MIN_H, Math.min(MAX_H, next));
      msgPopup.style.height = next + "px";
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      var h = parseInt(msgPopup.style.height, 10);
      if (!isNaN(h)) localStorage.setItem("dam_msg_popup_h", String(h));
    }

    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      startY = e.clientY;
      startH = msgPopup.getBoundingClientRect().height;
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    });

    handle.addEventListener("touchstart", function (e) {
      if (!e.touches || !e.touches[0]) return;
      dragging = true;
      startY = e.touches[0].clientY;
      startH = msgPopup.getBoundingClientRect().height;
    }, { passive: true });

    document.addEventListener("mousemove", function (e) { onMove(e.clientY); });
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", function (e) {
      if (!dragging || !e.touches || !e.touches[0]) return;
      onMove(e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener("touchend", onUp);
  }

  // Replace English notification popup with Polish ops alerts
  function buildNotificationsPopup() {
    var notifPopup = document.querySelector(".geex-content__header__popup--notification");
    if (!notifPopup) return;
    var items = [
      { title: "Brak pliku do druku", time: "12 min temu", desc: "Banoffee kakao - DOYPACK 65 g", icon: "uil-file-times", tone: "warn", source: "DAM" },
      { title: "Termin jutro", time: "1 godz. temu", desc: "Wykonanie wizualizacji - Nuggets", icon: "uil-clock", tone: "info", source: "Asana" },
      { title: "Prosba o akceptacje", time: "2 godz. temu", desc: "Tuba prezentowa 516 g", icon: "uil-comment-alt-message", tone: "info", source: "Teams" },
      { title: "Checklist uzupelniony", time: "wczoraj", desc: "Tiramisu czekolada kakao", icon: "uil-check-circle", tone: "ok", source: "DAM" }
    ];
    setHeaderBadge("damNotifBadge", items.length);
    notifPopup.innerHTML =
      '<div class="dam-popup-head">' +
        '<h3 class="dam-popup-head__title">Powiadomienia</h3>' +
        '<span class="dam-popup-head__count">' + items.length + "</span>" +
      "</div>" +
      '<div class="geex-content__header__popup__content"><ul class="geex-content__header__popup__items">' +
      items.map(function (n) {
        return '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link" href="#">' +
          '<div class="dam-notif-icon dam-notif-icon--' + n.tone + '" aria-hidden="true">' +
          '<i class="uil ' + n.icon + '"></i></div>' +
          '<div class="geex-content__header__popup__item__content">' +
          '<h5 class="geex-content__header__popup__item__title">' + escHtml(n.title) + "</h5>" +
          '<span class="geex-content__header__popup__item__time">' + escHtml(n.time) + "</span>" +
          '<div class="geex-content__header__popup__item__desc">' + escHtml(n.desc) + "</div>" +
          '<span class="dam-msg-source">' + escHtml(n.source) + "</span>" +
          "</div></a></li>";
      }).join("") +
      "</ul></div>";
  }

  function tt(key, fallback) {
    if (window.DamI18n) {
      var v = window.DamI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function polishUserMenu() {
    var labels = {
      profile: tt("user.profile", "Profil"),
      settings: tt("user.settings", "Ustawienia"),
      help: tt("user.help", "Pomoc"),
      logout: tt("user.logout", "Wyloguj"),
      privacy: tt("user.privacy", "Prywatność"),
      terms: tt("user.terms", "Regulamin"),
      license: tt("user.license", "Licencja"),
    };
    var byHref = {
      "profile.html": labels.profile,
      "settings.html": labels.settings,
      "help.html": labels.help,
    };
    document.querySelectorAll(".dam-user-menu__link").forEach(function (a) {
      var href = (a.getAttribute("href") || "").split("/").pop();
      var label = byHref[href];
      if (!label) return;
      var icon = a.querySelector("i");
      a.innerHTML = "";
      if (icon) a.appendChild(icon);
      var span = document.createElement("span");
      span.textContent = label;
      a.appendChild(span);
    });
    var legalMap = {
      "privacy.html": labels.privacy,
      "terms.html": labels.terms,
      "license.html": labels.license,
    };
    document.querySelectorAll(".dam-user-menu__legal-link").forEach(function (a) {
      var href = (a.getAttribute("href") || "").split("/").pop();
      if (legalMap[href]) a.textContent = legalMap[href];
    });
    var foot = document.querySelector(
      ".dam-user-menu__logout, .geex-content__header__popup--author .geex-content__header__popup__footer__link"
    );
    if (foot) {
      foot.innerHTML = '<i class="uil uil-signout"></i><span>' + labels.logout + "</span>";
      foot.setAttribute("href", "#");
    }
  }

  function polishBalanceMenu() {
    var links = document.querySelectorAll(".geex-content__summary__balance__more__content a");
    if (links[0]) links[0].textContent = tt("dash.cost_details", "Szczegóły kosztu");
    if (links[1]) {
      links[1].textContent = tt("dash.cost_calc", "Kalkulator");
      links[1].href = "costs.html";
    }
  }

  /** Translate leftover Geex English chrome (Customizer, Edit/Delete, Search...). */
  function polishGeexChrome() {
    var customizerLabel = tt("customizer.title", "Dostosuj wygląd");
    document.querySelectorAll(".geex-btn__customizer > span").forEach(function (el) {
      var parts = String(customizerLabel || "").trim().split(/\s+/);
      if (parts.length >= 2) {
        el.innerHTML =
          '<span class="dam-status-line">' +
          parts[0] +
          '</span><span class="dam-status-line">' +
          parts.slice(1).join(" ") +
          "</span>";
      } else {
        el.textContent = customizerLabel;
      }
    });
    document.querySelectorAll(".geex-customizer__title").forEach(function (el) {
      el.textContent = customizerLabel;
    });

    document.querySelectorAll(".geex-customizer__single__title").forEach(function (el) {
      var raw = (el.textContent || "").trim();
      if (/Layout Types|Kierunek tekstu/i.test(raw)) el.textContent = tt("customizer.layout", "Kierunek tekstu");
      else if (/Mode Type|Motyw/i.test(raw)) el.textContent = tt("customizer.mode", "Motyw");
      else if (/Navbar Type|Nawigacja/i.test(raw)) el.textContent = tt("customizer.navbar", "Nawigacja");
    });

    var searchPh = tt("header.search", "Szukaj...");
    document.querySelectorAll(".geex-content__header__searchform input, input.geex-content__header__btn").forEach(function (inp) {
      var ph = (inp.getAttribute("placeholder") || "").trim();
      if (!ph || /Search|Szukaj/i.test(ph)) inp.setAttribute("placeholder", searchPh);
    });

    var editLbl = tt("common.edit", "Edytuj");
    var delLbl = tt("common.delete", "Usuń");
    document.querySelectorAll("a, button, .geex-content__chat__header__filter__content__list__link").forEach(function (el) {
      var t = (el.textContent || "").trim();
      if (t === "Edit" || t === "Edytuj") el.textContent = editLbl;
      else if (t === "Delete" || t === "Usuń") el.textContent = delLbl;
    });

    polishUserMenu();
    polishBalanceMenu();

    var langTitle = document.querySelector(".dam-lang-popup .geex-content__header__popup__title");
    if (langTitle) langTitle.textContent = tt("header.lang_title", "Język");
    var langTrigger = document.querySelector(".dam-lang-trigger");
    if (langTrigger) {
      var langLbl = tt("header.lang_title", "Język");
      langTrigger.setAttribute("title", langLbl);
      langTrigger.setAttribute("aria-label", langLbl);
    }
  }

  /* Uniwersalne awatary plciowe (nie zdjecia osob) - ui-taste placeholders */
  var FEMALE_EMAILS = {
    "agata.karon@kubara.pl": 1,
    "andzelika.borowicz@kubara.pl": 1,
    "anna.polanska@kubara.pl": 1,
    "beata.scibik@kubara.pl": 1,
    "dagmara.bartnik@kubara.pl": 1,
    "ewa.prazmowska@kubara.pl": 1,
    "justyna.zroslak@kubara.pl": 1,
    "karolina.kubara@kubara.pl": 1,
    "malgorzata.oleksiak@kubara.pl": 1,
    "marta.zasepa@kubara.pl": 1,
    "sylwia.zarychta@kubara.pl": 1,
  };
  var MALE_EMAILS = {
    "krzysztof.wieczorek@kubara.pl": 1,
    "maciej.labus@kubara.pl": 1,
    "marek.milek@kubara.pl": 1,
    "marek.paluszewski@kubara.pl": 1,
    "ryszard.domagala@kubara.pl": 1,
    "szymon.ryngwelski@kubara.pl": 1,
    "magazyn.detal@kubara.pl": 1,
  };

  function avatarForEmail(email) {
    var e = String(email || "").trim().toLowerCase();
    if (FEMALE_EMAILS[e]) return "assets/img/avatar/avatar-female.svg";
    if (MALE_EMAILS[e]) return "assets/img/avatar/avatar-male.svg";
    /* heurystyka imienia gdy brak mapy */
    var local = e.split("@")[0] || "";
    var first = local.split(".")[0] || "";
    var femaleHints = {
      agata: 1, andzelika: 1, anna: 1, beata: 1, dagmara: 1, ewa: 1,
      justyna: 1, karolina: 1, malgorzata: 1, marta: 1, sylwia: 1, kinga: 1, zofia: 1,
    };
    if (femaleHints[first]) return "assets/img/avatar/avatar-female.svg";
    return "assets/img/avatar/avatar-male.svg";
  }

  function applyUserAvatar() {
    var userDataRaw = localStorage.getItem("dam_user");
    var userData = {};
    try { userData = JSON.parse(userDataRaw || "{}"); } catch (e) { userData = {}; }
    var email = userData.email || localStorage.getItem("dam_user_email") || "";
    var src = avatarForEmail(email);
    /* cache-bust SVG (czysta sylwetka bez czapeczki) */
    if (src.indexOf("?") === -1) src = src + "?v=avatarflat20260720a";
    document.querySelectorAll(
      ".geex-content__header__popup--author img, .geex-content__header__quickaction__item .user-img"
    ).forEach(function (img) {
      img.setAttribute("src", src);
      img.setAttribute("alt", "");
    });
  }

  function updateUserPopup() {
    var userName = localStorage.getItem("dam_user_name") || "Krzysztof Wieczorek";
    var userDataRaw = localStorage.getItem("dam_user");
    var userData = {};
    try { userData = JSON.parse(userDataRaw || "{}"); } catch (e) { userData = {}; }
    var userTitle = userData.title ? (userData.title + " - " + (userData.department || "")) : "GRAFIK - MARKETING";
    var popupTitle = document.querySelector(".geex-content__header__popup--author .geex-content__header__popup__header__title");
    if (popupTitle) popupTitle.textContent = userName;
    var popupSub = document.querySelector(".geex-content__header__popup--author .geex-content__header__popup__header__subtitle");
    if (popupSub) popupSub.textContent = userTitle + " - " + (userData.company || "KUBARA");
    applyUserAvatar();
    polishUserMenu();
    bindLogoutAndDeviceLinks();
  }

  function bindLogoutAndDeviceLinks() {
    document.querySelectorAll("#damShellDeviceSession, .dam-device-session-btn").forEach(function (link) {
      if (link._damDeviceBound) return;
      link._damDeviceBound = true;
      link.setAttribute("href", "profile.html#damDevicePathsRoot");
      link.setAttribute("title", "Sesja urządzenia - ścieżki Marketing");
      link.setAttribute("aria-label", "Sesja urządzenia");
      link.setAttribute("data-dam-tip", "Sesja urządzenia: ścieżki Marketing na tym PC");
      link.addEventListener("click", goDeviceSessionPaths);
    });
    document.querySelectorAll(
      "#damShellLogout, .dam-logout-btn, .dam-user-menu__logout, " +
      ".geex-content__header__popup--author .geex-content__header__popup__footer__link"
    ).forEach(function (link) {
      if (link.id === "damShellDeviceSession" || link.classList.contains("dam-device-session-btn")) return;
      if (link._damLogoutBound) return;
      link._damLogoutBound = true;
      var span = link.querySelector(".dam-nav-label, span");
      if (span) span.textContent = "Wyloguj";
      link.setAttribute("href", "#");
      link.setAttribute("title", "Wyloguj");
      link.setAttribute("aria-label", "Wyloguj");
      link.setAttribute("data-dam-tip", "Wyloguj z konta DAM");
      var icon = link.querySelector("i");
      if (icon) {
        icon.className = "uil uil-signout";
        icon.setAttribute("aria-hidden", "true");
      }
      link.addEventListener("click", performLogout);
    });
  }

  // Fetch Asana tasks and cache
  function loadAsanaTasks(callback) {
    fetch("data/asana-tasks.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        window._DAM_ASANA_TASKS = (data.tasks || []).filter(function (t) { return t.status === "open"; });
        if (callback) callback();
      })
      .catch(function () {
        window._DAM_ASANA_TASKS = [];
        if (callback) callback();
      });
  }

  var SIDEBAR_COLLAPSE_KEY = "dam_sidebar_collapsed";
  /** Dim + width morph duration (user: 0.7s). */
  var SIDEBAR_MORPH_DUR = 0.7;
  var SIDEBAR_MORPH_EASE = "power3.inOut";
  var SIDEBAR_COLLAPSED_W = 72;
  var SIDEBAR_W_VAR = "--dam-sidebar-w";
  var SIDEBAR_PAD_X_VAR = "--dam-sb-pad-x";
  var LINK_PAD_X_VAR = "--dam-link-pad-x";
  /** Expanded Geex padding (style.css .geex-sidebar / .geex-sidebar__menu__link). */
  var SIDEBAR_PAD_X_EXP = 29;
  var SIDEBAR_PAD_X_COL = 10;
  var LINK_PAD_X_EXP = 25;
  var _sidebarMorphTl = null;
  var _sidebarMorphing = false;
  /** Docelowy stan podczas morph (klasa body bywa zdjeta w trakcie tweenu). */
  var _sidebarMorphWant = null;

  function syncCollapseBtn(collapsed) {
    var btn = document.getElementById("damSidebarCollapse");
    if (!btn) return;
    btn.setAttribute("aria-pressed", collapsed ? "true" : "false");
    btn.setAttribute("title", collapsed ? "Rozwiń menu" : "Zwiń menu");
    btn.setAttribute("aria-label", collapsed ? "Rozwiń menu" : "Zwiń menu");
  }

  function prefersReducedMotion() {
    return !!(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function isSidebarCollapsedNow() {
    if (_sidebarMorphing && _sidebarMorphWant !== null) return !!_sidebarMorphWant;
    return document.body.classList.contains("dam-sidebar-collapsed");
  }

  function loadGsapShell(cb) {
    if (window.gsap) {
      cb(window.gsap);
      return;
    }
    var existing = document.querySelector('script[data-dam-gsap="1"]');
    if (existing) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        cb(window.gsap || null);
      }
      existing.addEventListener("load", finish);
      if (window.gsap) finish();
      return;
    }
    var s = document.createElement("script");
    s.src = "./assets/vendor/js/gsap/gsap.min.js";
    s.setAttribute("data-dam-gsap", "1");
    s.onload = function () { cb(window.gsap || null); };
    s.onerror = function () { cb(null); };
    document.head.appendChild(s);
  }

  function measureExpandedSidebarW() {
    var root = document.documentElement;
    var saved = root.style.getPropertyValue(SIDEBAR_W_VAR);
    /* Tymczasowo przywroc CSS clamp, zeby zmierzyc docelowa szerokosc expanded. */
    root.style.removeProperty(SIDEBAR_W_VAR);
    var raw = getComputedStyle(root).getPropertyValue(SIDEBAR_W_VAR).trim();
    var w = 0;
    if (raw) {
      var probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;width:" + raw + ";pointer-events:none";
      document.body.appendChild(probe);
      w = probe.offsetWidth;
      document.body.removeChild(probe);
    }
    if (saved) root.style.setProperty(SIDEBAR_W_VAR, saved);
    if (w > 0) return w;
    var sidebar = document.querySelector(".geex-sidebar");
    if (sidebar && !document.body.classList.contains("dam-sidebar-collapsed")) {
      var rectW = sidebar.getBoundingClientRect().width;
      if (rectW > SIDEBAR_COLLAPSED_W + 40) return Math.round(rectW);
    }
    return 300;
  }

  function applyCollapsedIconTrackVars() {
    var root = document.documentElement;
    var linkPad = collapsedLinkPadForIcon(22);
    root.style.setProperty(SIDEBAR_PAD_X_VAR, SIDEBAR_PAD_X_COL + "px");
    root.style.setProperty(LINK_PAD_X_VAR, Math.round(linkPad * 100) / 100 + "px");
  }

  function applySidebarCollapsedClass(collapsed) {
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? "1" : "0");
    document.body.classList.toggle("dam-sidebar-collapsed", !!collapsed);
    document.documentElement.style.removeProperty(SIDEBAR_W_VAR);
    var bottomLogo = document.querySelector(".dam-sidebar-logo-collapsed");
    var collapsedMeta = document.querySelector(".dam-sidebar-collapsed-meta");
    if (collapsed) {
      /* Zachowaj tor ikon = koniec morph (bez snap do justify:center). */
      applyCollapsedIconTrackVars();
      if (bottomLogo) {
        bottomLogo.style.display = "flex";
        resetSidebarIdentityEl(bottomLogo);
      }
      if (collapsedMeta) {
        collapsedMeta.style.display = "flex";
        resetSidebarIdentityEl(collapsedMeta);
      }
    } else {
      clearSidebarMorphVars();
      var footer = document.querySelector(".geex-sidebar__footer");
      if (footer) {
        footer.style.removeProperty("opacity");
        footer.style.removeProperty("visibility");
      }
      /* HARD: logo collapsed NIE smie zostac display:flex po expand (GSAP leftover). */
      if (bottomLogo) {
        bottomLogo.style.display = "none";
        resetSidebarIdentityEl(bottomLogo);
      }
      if (collapsedMeta) {
        collapsedMeta.style.display = "none";
        resetSidebarIdentityEl(collapsedMeta);
      }
    }
    syncCollapseBtn(collapsed);
    _sidebarMorphWant = null;
  }

  function collapsedLinkPadForIcon(iconW) {
    var inner = SIDEBAR_COLLAPSED_W - SIDEBAR_PAD_X_COL * 2;
    var w = iconW > 0 ? iconW : 22;
    return Math.max(0, (inner - w) / 2);
  }

  function clearSidebarMorphVars() {
    var root = document.documentElement;
    root.style.removeProperty(SIDEBAR_W_VAR);
    root.style.removeProperty(SIDEBAR_PAD_X_VAR);
    root.style.removeProperty(LINK_PAD_X_VAR);
  }

  function clearSidebarMorphInline(gsap, nodes, keepPadVars) {
    if (gsap && nodes && nodes.length) {
      gsap.set(nodes, {
        clearProps: "x,autoAlpha,opacity,visibility,filter,color,transform",
      });
      /* clearProps bywa niewystarczajace na filter - twarde czyszczenie */
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (!el || !el.style) continue;
        el.style.removeProperty("filter");
        el.style.removeProperty("color");
      }
    }
    if (!keepPadVars) clearSidebarMorphVars();
  }

  /**
   * Morph collapse ~0.7s (gsap-core):
   * - JEDNA os layoutu: --dam-sidebar-w (sidebar width + main pad)
   * - Tor ikon: --dam-sb-pad-x + --dam-link-pad-x (flex-start; pad zostaje po collapse)
   * - Y-stable: wysokosc raila = calc(100vh-44px) w morph+collapsed (nie 80vh)
   * - Labels: absolute (bez reflow ikon) + autoAlpha / x
   * - Dim: filter brightness tylko nieaktywne, duration = SIDEBAR_MORPH_DUR
   * - prefers-reduced-motion / brak GSAP => natychmiast
   * - Boot: animate=false (applySidebarCollapse) - bez flashu
   */
  function setSidebarCollapsed(collapsed, animate) {
    var want = !!collapsed;
    var now = isSidebarCollapsedNow();
    var doAnimate = animate !== false;
    var sidebarPre = document.querySelector(".geex-sidebar");

    if (_sidebarMorphTl) {
      try { _sidebarMorphTl.kill(); } catch (e) { /* ignore */ }
      _sidebarMorphTl = null;
    }
    _sidebarMorphing = false;
    document.body.classList.remove("dam-sidebar-morphing");
    clearSidebarMorphVars();
    if (sidebarPre && window.gsap) {
      try {
        window.gsap.killTweensOf(
          sidebarPre.querySelectorAll(
            ".geex-sidebar__menu__link i, .geex-sidebar__menu__link .uil, .geex-sidebar__menu__link svg, .geex-sidebar__menu__link .dam-nav-label, .geex-sidebar__menu__link span, .geex-sidebar__footer, .dam-sidebar-logo-collapsed, .geex-sidebar__header .geex-sidebar__logo"
          )
        );
      } catch (eKill) { /* ignore */ }
    }

    if (!doAnimate || prefersReducedMotion() || now === want) {
      applySidebarCollapsedClass(want);
      return;
    }

    var sidebar = sidebarPre;
    if (!sidebar) {
      applySidebarCollapsedClass(want);
      return;
    }

    loadGsapShell(function (gsap) {
      if (!gsap || prefersReducedMotion()) {
        applySidebarCollapsedClass(want);
        return;
      }

      var root = document.documentElement;
      var labels = Array.prototype.slice.call(
        sidebar.querySelectorAll(".geex-sidebar__menu__link .dam-nav-label, .geex-sidebar__menu__link span")
      );
      var icons = Array.prototype.slice.call(
        sidebar.querySelectorAll(
          ".geex-sidebar__menu__link i, .geex-sidebar__menu__link .uil, .geex-sidebar__menu__link svg"
        )
      );
      /* Unikalne wezly (i.uil bywa w obu selektorach). */
      icons = icons.filter(function (el, idx, arr) {
        return el && arr.indexOf(el) === idx;
      });
      var footer = sidebar.querySelector(".geex-sidebar__footer");
      var bottomLogo = sidebar.querySelector(".dam-sidebar-logo-collapsed");
      var headerLogo = sidebar.querySelector(".geex-sidebar__header .geex-sidebar__logo");
      var expandedW = measureExpandedSidebarW();
      var collapsedW = SIDEBAR_COLLAPSED_W;
      var dur = SIDEBAR_MORPH_DUR;
      var ease = SIDEBAR_MORPH_EASE;
      /* Staly slot ikony 22px = ten sam w morph i collapsed (bez font-size snap). */
      var iconW = 22;
      var linkPadCol = collapsedLinkPadForIcon(iconW);
      var fadeTargets = labels.slice().concat(icons);
      if (footer) fadeTargets.push(footer);
      if (bottomLogo) fadeTargets.push(bottomLogo);
      if (headerLogo) fadeTargets.push(headerLogo);
      var collapsedMeta = sidebar.querySelector(".dam-sidebar-collapsed-meta");
      if (collapsedMeta) fadeTargets.push(collapsedMeta);

      /* Dim tylko nieaktywne ikony (aktywna zostaje primary / bez snap do #52545c). */
      var iconsDim = icons.filter(function (el) {
        var link = el.closest(".geex-sidebar__menu__link");
        if (!link) return true;
        if (link.classList.contains("active") || link.classList.contains("default-active")) return false;
        if (link.getAttribute("aria-current") === "page") return false;
        var item = link.closest(".geex-sidebar__menu__item");
        if (item && item.classList.contains("active")) return false;
        return true;
      });

      gsap.killTweensOf(fadeTargets);

      function setSidebarWPx(px) {
        root.style.setProperty(SIDEBAR_W_VAR, Math.round(px) + "px");
      }
      function setPadVars(sbPad, linkPad) {
        root.style.setProperty(SIDEBAR_PAD_X_VAR, Math.round(sbPad * 100) / 100 + "px");
        root.style.setProperty(LINK_PAD_X_VAR, Math.round(linkPad * 100) / 100 + "px");
      }

      /* Ustaw tor ikon PRZED zdjeciem klasy collapsed - zero jump przy starcie expand. */
      var startW = want ? expandedW : collapsedW;
      var startSbPad = want ? SIDEBAR_PAD_X_EXP : SIDEBAR_PAD_X_COL;
      var startLinkPad = want ? LINK_PAD_X_EXP : linkPadCol;
      setSidebarWPx(startW);
      setPadVars(startSbPad, startLinkPad);

      /* FLIP collapse-btn: zmierz PRZED zmiana layoutu (logo out-of-flow + center). */
      var collapseBtn = document.getElementById("damSidebarCollapse");
      var btnFirst = collapseBtn ? collapseBtn.getBoundingClientRect() : null;

      document.body.classList.add("dam-sidebar-morphing");
      document.body.classList.remove("dam-sidebar-morph-to-collapsed", "dam-sidebar-morph-to-expanded");
      document.body.classList.add(want ? "dam-sidebar-morph-to-collapsed" : "dam-sidebar-morph-to-expanded");
      _sidebarMorphing = true;
      _sidebarMorphWant = want;
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, want ? "1" : "0");
      syncCollapseBtn(want);
      document.body.classList.remove("dam-sidebar-collapsed");
      void sidebar.offsetWidth;

      /* FLIP: zachowaj wizualna pozycje btn, tween x→0 (razem z kurczeniem raila = płynny tor). */
      if (collapseBtn && btnFirst) {
        var btnLast = collapseBtn.getBoundingClientRect();
        var btnDx = btnFirst.left - btnLast.left;
        gsap.killTweensOf(collapseBtn);
        if (Math.abs(btnDx) > 0.5) {
          gsap.fromTo(
            collapseBtn,
            { x: btnDx },
            { x: 0, duration: dur, ease: ease, overwrite: "auto" }
          );
        } else {
          gsap.set(collapseBtn, { x: 0 });
        }
      }

      function finishMorph() {
        var btnPre = collapseBtn ? collapseBtn.getBoundingClientRect() : null;
        applySidebarCollapsedClass(want);
        document.body.classList.remove(
          "dam-sidebar-morphing",
          "dam-sidebar-morph-to-collapsed",
          "dam-sidebar-morph-to-expanded"
        );
        _sidebarMorphing = false;
        /* Collapsed: NIE czysc pad vars (tor ikon = koniec tweenu). */
        clearSidebarMorphInline(gsap, fadeTargets, !!want);
        if (want) applyCollapsedIconTrackVars();
        if (!want && footer) {
          footer.style.removeProperty("opacity");
          footer.style.removeProperty("visibility");
        }
        /* Expand koniec: logo wraca do flex → btn skacze w prawo; FLIP dogrywka. */
        if (!want && collapseBtn && btnPre) {
          void sidebar.offsetWidth;
          var btnPost = collapseBtn.getBoundingClientRect();
          var endDx = btnPre.left - btnPost.left;
          gsap.killTweensOf(collapseBtn);
          if (Math.abs(endDx) > 0.5) {
            gsap.fromTo(
              collapseBtn,
              { x: endDx },
              {
                x: 0,
                duration: 0.28,
                ease: "power2.out",
                overwrite: "auto",
                clearProps: "x",
              }
            );
          } else {
            gsap.set(collapseBtn, { clearProps: "x" });
          }
        } else if (collapseBtn) {
          gsap.set(collapseBtn, { clearProps: "x" });
        }
        _sidebarMorphTl = null;
      }

      var layoutProxy = {
        w: startW,
        sbPad: startSbPad,
        linkPad: startLinkPad,
      };

      function applyLayoutProxy() {
        setSidebarWPx(layoutProxy.w);
        setPadVars(layoutProxy.sbPad, layoutProxy.linkPad);
      }

      _sidebarMorphTl = gsap.timeline({
        defaults: { ease: ease, overwrite: "auto" },
        onComplete: finishMorph,
      });

      /* Width + pad track = jedna oś; flex-start + pad vars (bez justify:center). */
      _sidebarMorphTl.to(
        layoutProxy,
        {
          w: want ? collapsedW : expandedW,
          sbPad: want ? SIDEBAR_PAD_X_COL : SIDEBAR_PAD_X_EXP,
          linkPad: want ? linkPadCol : LINK_PAD_X_EXP,
          duration: dur,
          onUpdate: applyLayoutProxy,
        },
        0
      );

      if (iconsDim.length) {
        if (want) {
          gsap.set(iconsDim, { filter: "brightness(1)" });
          _sidebarMorphTl.to(
            iconsDim,
            { filter: "brightness(0.72)", duration: dur },
            0
          );
        } else {
          gsap.set(iconsDim, { filter: "brightness(0.72)" });
          _sidebarMorphTl.to(
            iconsDim,
            { filter: "brightness(1)", duration: dur },
            0
          );
        }
      }

      if (want) {
        gsap.set(labels, { autoAlpha: 1, x: 0 });
        if (footer) {
          footer.style.display = "none";
          gsap.set(footer, { autoAlpha: 0 });
        }
        if (headerLogo) gsap.set(headerLogo, { autoAlpha: 1 });
        if (bottomLogo) {
          gsap.set(bottomLogo, { display: "flex", autoAlpha: 0, x: 0, y: 0, transform: "none" });
        }
        if (collapsedMeta) {
          gsap.set(collapsedMeta, { display: "flex", autoAlpha: 0, x: 0, y: 0, transform: "none" });
        }

        _sidebarMorphTl.to(labels, { autoAlpha: 0, x: -8, duration: dur * 0.4 }, 0);
        if (footer) {
          _sidebarMorphTl.to(footer, { autoAlpha: 0, duration: dur * 0.3 }, 0);
        }
        if (headerLogo) {
          _sidebarMorphTl.to(headerLogo, { autoAlpha: 0, duration: dur * 0.28 }, 0);
        }
        if (bottomLogo) {
          _sidebarMorphTl.to(
            bottomLogo,
            { autoAlpha: 1, x: 0, y: 0, duration: dur * 0.35 },
            dur * 0.4
          );
        }
        if (collapsedMeta) {
          _sidebarMorphTl.to(
            collapsedMeta,
            { autoAlpha: 1, x: 0, y: 0, duration: dur * 0.3 },
            dur * 0.45
          );
        }
      } else {
        gsap.set(labels, { autoAlpha: 0, x: -8 });
        if (footer) {
          footer.style.removeProperty("display");
          gsap.set(footer, { autoAlpha: 0 });
        }
        if (headerLogo) gsap.set(headerLogo, { autoAlpha: 0 });
        if (bottomLogo) {
          gsap.set(bottomLogo, { display: "flex", autoAlpha: 1, x: 0, y: 0, transform: "none" });
        }
        if (collapsedMeta) {
          gsap.set(collapsedMeta, { display: "flex", autoAlpha: 1, x: 0, y: 0, transform: "none" });
        }

        _sidebarMorphTl.to(labels, { autoAlpha: 1, x: 0, duration: dur * 0.4 }, dur * 0.22);
        if (footer) {
          _sidebarMorphTl.to(footer, { autoAlpha: 1, duration: dur * 0.35 }, dur * 0.28);
        }
        if (headerLogo) {
          _sidebarMorphTl.to(headerLogo, { autoAlpha: 1, duration: dur * 0.32 }, dur * 0.25);
        }
        if (bottomLogo) {
          _sidebarMorphTl.to(
            bottomLogo,
            {
              autoAlpha: 0,
              duration: dur * 0.25,
              onComplete: function () {
                if (bottomLogo) {
                  bottomLogo.style.display = "none";
                  if (window.gsap) {
                    try { window.gsap.set(bottomLogo, { clearProps: "opacity,visibility" }); } catch (eB) { /* ignore */ }
                  }
                }
              },
            },
            0
          );
        }
        if (collapsedMeta) {
          _sidebarMorphTl.to(
            collapsedMeta,
            {
              autoAlpha: 0,
              duration: dur * 0.22,
              onComplete: function () {
                if (collapsedMeta) {
                  collapsedMeta.style.display = "none";
                  if (window.gsap) {
                    try {
                      window.gsap.set(collapsedMeta, { clearProps: "opacity,visibility" });
                    } catch (eM) { /* ignore */ }
                  }
                }
              },
            },
            0
          );
        }
      }
    });
  }

  function applySidebarCollapse() {
    /* Boot / restore: BEZ morph (finishBoot / flash fix) */
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1", false);
  }

  function injectSidebarCollapse() {
    var header = document.querySelector(".geex-sidebar__header");
    if (!header) return;

    var btn = document.getElementById("damSidebarCollapse");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "damSidebarCollapse";
      btn.className = "dam-sidebar-collapse-btn";
      btn.innerHTML = '<i class="uil uil-angle-double-left" aria-hidden="true"></i>';
      header.appendChild(btn);
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        /* Interrupt-safe: kill poprzedni TL i lec w przeciwna strone */
        setSidebarCollapsed(!isSidebarCollapsedNow(), true);
      });
    }

    // Klik w logo przy zwinietym panelu = rozwin (awaryjne przywrocenie)
    var logo = header.querySelector(".geex-sidebar__logo");
    if (logo && !logo.getAttribute("data-dam-expand-bound")) {
      logo.setAttribute("data-dam-expand-bound", "1");
      logo.addEventListener("click", function (e) {
        if (!isSidebarCollapsedNow()) return;
        e.preventDefault();
        setSidebarCollapsed(false, true);
      });
    }

    applySidebarCollapse();
  }

  function bindSearchClearInputs() {
    document.querySelectorAll(".dam-search-input-wrap").forEach(function (wrap) {
      if (wrap._damClearBound) return;
      var input = wrap.querySelector("input.dam-search-input, input[type='search']");
      if (!input) return;
      wrap._damClearBound = true;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dam-search-clear";
      btn.setAttribute("aria-label", "Wyczyść wyszukiwanie");
      btn.setAttribute("data-dam-tip", "Usuń tekst z pola wyszukiwania");
      btn.innerHTML = '<i class="uil uil-times" aria-hidden="true"></i>';
      btn.hidden = true;
      wrap.appendChild(btn);
      function syncClear() {
        btn.hidden = !(input.value || "").length;
      }
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        input.value = "";
        syncClear();
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("search", { bubbles: true }));
        input.focus();
      });
      input.addEventListener("input", syncClear);
      input.addEventListener("search", syncClear);
      syncClear();
    });
  }

  /**
   * Typografia PL na podtytulach stron (sieroty / wdowy).
   * Shared z DamI18n.nbspPl gdy dostepne.
   */
  function nbspPlLocal(s) {
    if (window.DamI18n && typeof window.DamI18n.nbspPl === "function") {
      return window.DamI18n.nbspPl(s);
    }
    if (s == null || s === "") return s;
    var out = String(s);
    out = out.replace(/(^|[\s\u00A0])([iaouwzIAOUWZ])[ \t]+(?=\S)/g, function (_m, before, letter) {
      return before + letter + "\u00A0";
    });
    out = out.replace(/(\S+)[ \t]+(\S+)([.!?…]*)$/, function (_m, a, b, punct) {
      return a + "\u00A0" + b + (punct || "");
    });
    return out;
  }

  function polishPageSubs() {
    document.querySelectorAll(
      ".dam-page-sub, .geex-content__header > .geex-content__header__content .geex-content__header__subtitle"
    ).forEach(function (el) {
      if (el.closest && el.closest(".geex-content__header__popup")) return;
      var raw = el.textContent || "";
      if (!raw.trim()) return;
      var fixed = nbspPlLocal(raw);
      if (fixed !== raw) el.textContent = fixed;
    });
  }

  /**
   * Zdejmij html.dam-booting / body.is-booting po przepisaniu chrome.
   * Double rAF = pierwsza klatka po rewrite zanim fade-in (bez flashu Geex Demo).
   * HARD: nie odslaniaj zanim DamI18n overlay jest ready (anti mojibake flash).
   */
  var bootFinished = false;
  var bootRevealScheduled = false;
  function finishBoot(force) {
    function reveal() {
      var root = document.documentElement;
      var body = document.body;
      root.classList.remove("dam-booting");
      root.classList.add("dam-booted");
      if (body) {
        body.classList.remove("is-booting");
        /* Domknij ewentualny stuck CSSTransition opacity (body zostawal na 0). */
        try {
          if (typeof body.getAnimations === "function") {
            body.getAnimations().forEach(function (a) {
              try { a.finish(); } catch (eFin) { /* ignore */ }
            });
          }
        } catch (eAnim) { /* ignore */ }
        body.style.setProperty("opacity", "1", "important");
        body.style.setProperty("pointer-events", "auto");
      }
      bootFinished = true;
      bootRevealScheduled = false;
    }
    // Juz odsloniete i nie wymuszamy - nic nie rob
    if (bootFinished && !force && !document.documentElement.classList.contains("dam-booting")) {
      return;
    }
    if (bootFinished || force) {
      reveal();
      return;
    }
    if (bootRevealScheduled) return;
    bootRevealScheduled = true;
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () {
        requestAnimationFrame(reveal);
      });
    } else {
      setTimeout(reveal, 0);
    }
  }

  /**
   * Final chrome pass + reveal: dopiero gdy i18n overlay gotowy
   * (albo failsafe timeout). Kolejnosc: apply -> polish -> page-subs -> finishBoot.
   * HARD: finishBoot ZAWSZE w finally - wyjatek w polish nie moze zostawic
   * html.dam-booting (body opacity:0 = pusty ekran).
   */
  function revealAfterOverlayReady() {
    try {
      if (window.DamI18n && typeof window.DamI18n.apply === "function") {
        window.DamI18n.apply();
      }
      polishGeexChrome();
      polishPageSubs();
      injectNavTrail();
    } catch (eBoot) {
      console.warn("DAM shell: boot chrome pass failed", eBoot);
    } finally {
      finishBoot(true);
      if (window.DamGridReveal && typeof window.DamGridReveal.clearHeaderRevealInline === "function") {
        /* odblokuj title/sub gdy entrance odpalił się za wcześnie pod dam-booting */
        window.DamGridReveal.clearHeaderRevealInline();
      }
      if (window.DamGridReveal && typeof window.DamGridReveal.revealPageEntrance === "function") {
        try { window.DamGridReveal.revealPageEntrance(); } catch (eEnt) { /* ignore */ }
      }
    }
  }

  function scheduleBootReveal() {
    var released = false;
    function release() {
      if (released) return;
      released = true;
      revealAfterOverlayReady();
    }
    if (window.DamI18n && typeof window.DamI18n.whenReady === "function") {
      window.DamI18n.whenReady(release);
      /* failsafe: nigdy nie trzymac body opacity:0 w nieskonczonosc */
      setTimeout(release, 1800);
    } else {
      release();
    }
  }

  // Main init
  function init() {
    bootFinished = false;
    bootRevealScheduled = false;
    ensureShellLayerCss();
    ensureAppIcons();
    ensureAccentCss();
    enforceAuth();
    ensureSidebarLogo();
    applyDobraKaloriaLogo();
    applySidebarCollapse();

    bindSearchClearInputs();

    var sidebarMenu = document.querySelector(".geex-sidebar__menu");
    if (sidebarMenu) {
      sidebarMenu.innerHTML = buildSidebarNav();
      injectSidebarCollapse();
      bindLogoutAndDeviceLinks();
    }
    // Po wstrzyknieciu collapse - logo musi nadal byc (re-ensure)
    ensureSidebarLogo();

    // Status ROOT plików (czerwona kropka gdy offline)
    if (!window.DamRootStatus) {
      var rs = document.createElement("script");
      rs.src = "assets/js/dam-root-status.js?v=20260719statusPill1";
      document.head.appendChild(rs);
    } else if (typeof window.DamRootStatus.start === "function") {
      window.DamRootStatus.start();
    }

    // Status bazy danych (obok Pliki online)
    if (!window.DamDbStatus) {
      var dbs = document.createElement("script");
      dbs.src = "assets/js/dam-db-status.js?v=20260719statusPill1";
      document.head.appendChild(dbs);
    } else if (typeof window.DamDbStatus.start === "function") {
      window.DamDbStatus.start();
    }

    // F1 pomoc / F5 odśwież
    if (!window.DamShortcuts) {
      var sc = document.createElement("script");
      sc.src = "assets/js/dam-shortcuts.js?v=helprestart20260720a";
      document.head.appendChild(sc);
    }

    var headerMenu = document.querySelector(".geex-header__menu");
    if (headerMenu) {
      headerMenu.innerHTML = buildHeaderNav();
    }

    ensureHeaderChrome();
    normalizeHeaderIcons();
    ensureAdminModeSwitch();
    bindDamHeaderPopups();
    updateSidebarBrand();
    updateUserPopup();
    buildNotificationsPopup();
    buildMessagesPopup();
    polishGeexChrome();
    applyDobraKaloriaLogo();
    injectNavTrail();
    /* NIE finishBoot tutaj - czekaj na DamI18n.whenReady (overlay UTF-8 gotowy) */
    scheduleBootReveal();

    loadAsanaTasks(function () {
      buildMessagesPopup();
      buildNotificationsPopup();
      polishGeexChrome();
      polishPageSubs();
      ensureAdminModeSwitch();
      if (window.DamI18n && typeof window.DamI18n.apply === "function") {
        window.DamI18n.apply();
      }
    });

    // Re-apply after i18n / Geex main.js (odpinamy slideToggle jeśli wrocil)
    // Po boot reveal - odswiez chrome, ale NIE flashuj wczesniej
    function refreshChrome() {
      ensureHeaderChrome();
      bindDamHeaderPopups();
      normalizeHeaderIcons();
      ensureAdminModeSwitch();
      if (window.jQuery) {
        try {
          window.jQuery(".geex-content__header__action .geex-content__header__quickaction__link").off("click");
        } catch (e) { /* ignore */ }
      }
      polishGeexChrome();
      polishPageSubs();
      injectNavTrail();
      if (window.DamI18n && typeof window.DamI18n.apply === "function") {
        window.DamI18n.apply();
      }
    }
    setTimeout(refreshChrome, 80);
    setTimeout(refreshChrome, 400);
    // Po rehydrate sesji rola moze dojsc pozniej - odswiez widocznosc switcha
    setTimeout(ensureAdminModeSwitch, 900);
    setTimeout(ensureAdminModeSwitch, 2000);
  }

  function ensureStickyChromeScript() {
    if (!document.querySelector(".dam-explorer-toolbar")) return;
    if (document.querySelector('script[data-dam-sticky-chrome]')) return;
    var s = document.createElement("script");
    s.src = "./assets/js/dam-sticky-chrome.js?v=hub20260719sticky02";
    s.setAttribute("data-dam-sticky-chrome", "1");
    s.defer = true;
    document.body.appendChild(s);
  }

  // Run after DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureStickyChromeScript);
  } else {
    ensureStickyChromeScript();
  }

  // Public API
  window.DamShell = {
    reload: init,
    finishBoot: finishBoot,
    loadAsanaTasks: loadAsanaTasks,
    polishChrome: polishGeexChrome,
    polishPageSubs: polishPageSubs,
    injectNavTrail: injectNavTrail,
    setTrailLeaf: setTrailLeaf,
    goBack: goBackNav,
    replaceNavStackTop: replaceNavStackTop,
    currentNavUrl: currentNavUrl,
    isAdminMode: isAdminModeOn,
    setAdminMode: setAdminMode,
    syncAdminModeSwitch: ensureAdminModeSwitch
  };
})();
