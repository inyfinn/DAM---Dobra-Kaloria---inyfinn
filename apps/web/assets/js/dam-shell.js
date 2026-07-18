/**
 * DAM ETA - Shell navigation + auth guard + messages popup
 * Rewrites Geex sidebar/header Demo menu to DAM items
 * Requires: dam-api.js, dam-i18n.js loaded before this script
 */
(function () {
  "use strict";

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
    upsertMeta("apple-mobile-web-app-title", "DAM ETA");
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
    /* Weryfikacja sesji na bridgu (+ auto-rehydrate gdy token niewazny). */
    if (window.DamApi && typeof window.DamApi.me === "function") {
      window.DamApi.me().catch(function () {});
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
      a.setAttribute("title", "Dobra Kaloria - DAM ETA");
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
    '<li class="geex-sidebar__menu__item" style="margin-top:auto;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px">' +
    '<a href="#" class="geex-sidebar__menu__link dam-logout-btn" id="damShellLogout" title="Sesja urządzenia" aria-label="Sesja urządzenia">' +
    '<i class="uil uil-sign-out-alt" aria-hidden="true" style="font-size:20px;margin-right:8px;width:22px;text-align:center"></i>' +
    '<span class="dam-nav-label" data-i18n="nav.logout">' + navItemLabel({ i18n: "nav.logout" }) + '</span>' +
    '</a></li>';
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

  // Build brand in sidebar header
  function updateSidebarBrand() {
    var logo = document.querySelector(".geex-sidebar__logo");
    if (logo) {
      logo.href = "dashboard.html";
    }
    var footer = document.querySelector(".geex-sidebar__footer");
    if (footer) {
      var brand = window.DamI18n ? window.DamI18n.t("nav.brand") : "DAM ETA";
      var brandSub = window.DamI18n ? window.DamI18n.t("nav.brand_sub") : "Panel assetów opakowań";
      var madeBy = window.DamI18n ? window.DamI18n.t("footer.made_by") : "inyfinn.art";
      var year = new Date().getFullYear();
      footer.innerHTML =
        '<span class="geex-sidebar__footer__title" data-i18n="nav.brand">' + brand + '</span>' +
        '<p class="geex-sidebar__footer__copyright" data-i18n="nav.brand_sub">' + brandSub + '</p>' +
        '<p class="geex-sidebar__footer__author">' +
          '<a class="dam-footer-author-link" href="https://inyfinn.art" target="_blank" rel="noopener noreferrer" data-i18n="footer.made_by">' +
            madeBy +
          "</a> &copy; " + year +
        "</p>";
    }
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
      logo.setAttribute("aria-label", "Dobra Kaloria - DAM ETA");
      logo.setAttribute("title", "Dobra Kaloria - DAM ETA");
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
      bottomLogo.setAttribute("aria-label", "Dobra Kaloria - DAM ETA");
      bottomLogo.setAttribute("title", "Dobra Kaloria - DAM ETA");
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
      '<nav class="dam-user-menu__nav" aria-label="Konto">' +
        '<ul class="geex-content__header__popup__items dam-user-menu__items">' +
          '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link dam-user-menu__link" href="profile.html" role="menuitem"><i class="uil uil-user"></i><span>Profil</span></a></li>' +
          '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link dam-user-menu__link" href="settings.html" role="menuitem"><i class="uil uil-cog"></i><span>Ustawienia</span></a></li>' +
          '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link dam-user-menu__link" href="help.html" role="menuitem"><i class="uil uil-question-circle"></i><span>Pomoc</span></a></li>' +
        "</ul>" +
      "</nav>" +
      '<div class="dam-user-menu__legal" aria-label="Dokumenty">' +
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
    }, true);

    document.addEventListener("click", function (e) {
      if (e.target.closest(".geex-content__header__action")) return;
      root.querySelectorAll(".geex-content__header__popup.is-open").forEach(function (p) {
        p.classList.remove("is-open");
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      root.querySelectorAll(".geex-content__header__popup.is-open").forEach(function (p) {
        p.classList.remove("is-open");
      });
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
    if (langTrigger) langTrigger.setAttribute("title", tt("header.lang_title", "Język"));
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
    document.querySelectorAll(".geex-content__header__popup--author .geex-content__header__popup__footer__link, #damShellLogout, .dam-logout-btn").forEach(function (link) {
      link.textContent = "Sesja urządzenia";
      link.setAttribute("title", "Sesja = ID urządzenia - bez wylogowania");
      link.addEventListener("click", function (e) {
        e.preventDefault();
        if (window.DamApi && typeof DamApi.logout === "function") DamApi.logout();
        else if (window.DamPaths && DamPaths.showToast) {
          DamPaths.showToast("Sesja urządzenia pozostaje aktywna.");
        }
      });
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

  function setSidebarCollapsed(collapsed) {
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? "1" : "0");
    document.body.classList.toggle("dam-sidebar-collapsed", !!collapsed);
    var btn = document.getElementById("damSidebarCollapse");
    if (btn) {
      btn.setAttribute("aria-pressed", collapsed ? "true" : "false");
      btn.setAttribute("title", collapsed ? "Rozwiń menu" : "Zwiń menu");
      btn.setAttribute("aria-label", collapsed ? "Rozwiń menu" : "Zwiń menu");
    }
  }

  function applySidebarCollapse() {
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
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
        setSidebarCollapsed(!document.body.classList.contains("dam-sidebar-collapsed"));
      });
    }

    // Klik w logo przy zwinietym panelu = rozwin (awaryjne przywrocenie)
    var logo = header.querySelector(".geex-sidebar__logo");
    if (logo && !logo.getAttribute("data-dam-expand-bound")) {
      logo.setAttribute("data-dam-expand-bound", "1");
      logo.addEventListener("click", function (e) {
        if (!document.body.classList.contains("dam-sidebar-collapsed")) return;
        e.preventDefault();
        setSidebarCollapsed(false);
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

  // Main init
  function init() {
    ensureAppIcons();
    enforceAuth();
    ensureSidebarLogo();
    applyDobraKaloriaLogo();
    applySidebarCollapse();

    bindSearchClearInputs();

    var sidebarMenu = document.querySelector(".geex-sidebar__menu");
    if (sidebarMenu) {
      sidebarMenu.innerHTML = buildSidebarNav();
      injectSidebarCollapse();
      var logoutBtn = document.getElementById("damShellLogout");
      if (logoutBtn) {
        var span = logoutBtn.querySelector("span");
        if (span) span.textContent = "Sesja urządzenia";
        logoutBtn.addEventListener("click", function (e) {
          e.preventDefault();
          if (window.DamApi && typeof DamApi.logout === "function") DamApi.logout();
        });
      }
    }
    // Po wstrzyknieciu collapse - logo musi nadal byc (re-ensure)
    ensureSidebarLogo();

    // Status ROOT plików (czerwona kropka gdy offline)
    if (!window.DamRootStatus) {
      var rs = document.createElement("script");
      rs.src = "assets/js/dam-root-status.js?v=20260718carrierFix1";
      document.head.appendChild(rs);
    } else if (typeof window.DamRootStatus.start === "function") {
      window.DamRootStatus.start();
    }

    // Status bazy danych (obok Pliki online)
    if (!window.DamDbStatus) {
      var dbs = document.createElement("script");
      dbs.src = "assets/js/dam-db-status.js?v=20260718adminHdr1";
      document.head.appendChild(dbs);
    } else if (typeof window.DamDbStatus.start === "function") {
      window.DamDbStatus.start();
    }

    // F1 pomoc / F5 odśwież
    if (!window.DamShortcuts) {
      var sc = document.createElement("script");
      sc.src = "assets/js/dam-shortcuts.js?v=20260718lifeHelp1";
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
    if (window.DamI18n && typeof window.DamI18n.apply === "function") {
      window.DamI18n.apply();
    }

    loadAsanaTasks(function () {
      buildMessagesPopup();
      buildNotificationsPopup();
      polishGeexChrome();
      ensureAdminModeSwitch();
      if (window.DamI18n && typeof window.DamI18n.apply === "function") {
        window.DamI18n.apply();
      }
    });

    // Re-apply after i18n / Geex main.js (odpinamy slideToggle jeśli wrocil)
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

  // Run after DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Public API
  window.DamShell = {
    reload: init,
    loadAsanaTasks: loadAsanaTasks,
    polishChrome: polishGeexChrome,
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
