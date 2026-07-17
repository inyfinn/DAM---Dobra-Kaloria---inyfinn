/**
 * DAM ETA - Shell navigation + auth guard + messages popup
 * Rewrites Geex sidebar/header Demo menu to DAM items
 * Requires: dam-api.js, dam-i18n.js loaded before this script
 */
(function () {
  "use strict";

  // Tryb roboczy: zawsze zalogowany jako admin (bez Microsoft).
  // Wylacz (false) gdy wlaczymy prawdziwe Entra ID.
  var DAM_DEV_ALWAYS_ADMIN = true;
  // Dobra Kaloria (NIE Niemiesa). Zrodlo brand: Marketing/.../DOBRA KALORIA/01 - LOGO/SVG
  // Light: zielony (#008244) - czytelny na jasnym sidebarze. Dark: ten sam zielony (kontrast OK).
  var LOGO_SRC_LIGHT = "assets/img/logo-dk-green.svg";
  var LOGO_SRC_DARK = "assets/img/logo-dk-green.svg";
  var LOGO_SRC = LOGO_SRC_LIGHT;

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
      icon: "uil-folder-open",
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
    explorer: { labelKey: "nav.explorer", label: "Eksplorator plikow", parent: "dashboard", href: "explorer.html" },
    visualizations: { labelKey: "nav.visualizations", label: "Wizualizacje", parent: "dashboard", href: "visualizations.html" },
    projects: { labelKey: "nav.projects", label: "Projekty", parent: "dashboard", href: "index.html" },
    project: { labelKey: "nav.project", label: "Projekt", parent: "projects", href: "project.html" },
    invoices: { labelKey: "nav.invoices", label: "Faktury", parent: "dashboard", href: "invoices.html" },
    costs: { labelKey: "nav.costs", label: "Kalkulator kosztow", parent: "dashboard", href: "costs.html" },
    integrations: { labelKey: "nav.integrations", label: "Integracje", parent: "dashboard", href: "integrations.html" },
    profile: { labelKey: "user.profile", label: "Profil", parent: "dashboard", href: "profile.html" },
    settings: { labelKey: "user.settings", label: "Ustawienia", parent: "dashboard", href: "settings.html" },
    billing: { labelKey: "user.billing", label: "Rozliczenia", parent: "dashboard", href: "billing.html" },
    activity: { labelKey: "user.activity", label: "Aktywnosc", parent: "dashboard", href: "activity.html" },
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
      "nav.explorer": "Eksplorator plikow",
      "nav.visualizations": "Wizualizacje",
      "nav.projects": "Projekty",
      "nav.invoices": "Faktury",
      "nav.costs": "Kalkulator kosztow",
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

  function parentHrefForKey(key) {
    var meta = PAGE_TRAIL[key];
    if (!meta || !meta.parent) return "dashboard.html";
    var parent = PAGE_TRAIL[meta.parent];
    return parent ? parent.href : "dashboard.html";
  }

  function goBackNav() {
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
      '<nav class="dam-nav-trail" id="damNavTrail" aria-label="' + escapeHtml(backLabel) + ' / sciezka">' +
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
      if (t && t !== "Projekt" && t.toLowerCase() !== "ladowanie...") leaf = t;
    }
    renderNavTrail(leaf);
  }

  function ensureAdminSession() {
    if (!DAM_DEV_ALWAYS_ADMIN) return;
    localStorage.setItem("dam_token", "demo-admin-dev-token");
    localStorage.setItem("dam_role", "admin");
    // Uzytkownik: Krzysztof Wieczorek (Grafik Marketing, Kubara)
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
    if (isSigninPage) return;
    var token = localStorage.getItem("dam_token");
    if (!token) {
      window.location.href = "signin.html";
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
    // Usun stare napisy Geex przy logo (jesli sa w markupie)
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
  function buildSidebarNav() {
    var active = currentPageKey();
    return NAV_ITEMS.map(function (item) {
      var isActive = item.key === active ? " active" : "";
      return '<li class="geex-sidebar__menu__item' + isActive + '">' +
        '<a href="' + item.href + '" class="geex-sidebar__menu__link">' +
        '<i class="uil ' + item.icon + '" style="font-size:20px;margin-right:8px;width:22px;text-align:center"></i>' +
        '<span data-i18n="' + item.i18n + '">' + navItemLabel(item) + '</span>' +
        '</a></li>';
    }).join("") +
    '<li class="geex-sidebar__menu__item" style="margin-top:auto;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px">' +
    '<a href="#" class="geex-sidebar__menu__link dam-logout-btn" id="damShellLogout">' +
    '<i class="uil uil-sign-out-alt" style="font-size:20px;margin-right:8px;width:22px;text-align:center"></i>' +
    '<span data-i18n="nav.logout">' + navItemLabel({ i18n: "nav.logout" }) + '</span>' +
    '</a></li>';
  }

  // Build header menu nav HTML (top bar)
  function buildHeaderNav() {
    var active = currentPageKey();
    return NAV_ITEMS.map(function (item) {
      var isActive = item.key === active ? " active" : "";
      return '<li class="geex-header__menu__item' + isActive + '">' +
        '<a href="' + item.href + '" class="geex-header__menu__link">' +
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
      var brandSub = window.DamI18n ? window.DamI18n.t("nav.brand_sub") : "Zarzadzanie assetami opakowan";
      footer.innerHTML = '<span class="geex-sidebar__footer__title" data-i18n="nav.brand">' + brand + '</span>' +
        '<p class="geex-sidebar__footer__copyright" data-i18n="nav.brand_sub">' + brandSub + '</p>' +
        '<p class="geex-sidebar__footer__author">ETA Innovations &copy; ' + new Date().getFullYear() + '</p>';
    }
  }

  /**
   * GLOBAL header chrome - ten sam markup na kazdej stronie (design system).
   * Jezeli strona nie ma .geex-content__header__action - wstrzyknij.
   */
  function ensureHeaderChrome() {
    var header = document.querySelector(".geex-content__header");
    if (!header) return;
    if (header.querySelector(".geex-content__header__action")) return;

    var wrap = document.createElement("div");
    wrap.className = "geex-content__header__action";
    wrap.id = "damHeaderAction";
    wrap.innerHTML =
      '<div class="geex-content__header__customizer">' +
        '<button type="button" class="geex-btn geex-btn__toggle-sidebar" aria-label="Menu boczne" data-dam-tip="Otworz / zamknij menu">' +
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
            '<a href="#" class="geex-content__header__quickaction__link" aria-label="Wiadomosci" data-dam-tip="Wiadomosci Asana i Teams">' +
              '<i class="uil uil-comment-alt-dots" style="font-size:22px;color:#464255"></i>' +
              '<span class="geex-content__header__badge">84</span></a>' +
            '<div class="geex-content__header__popup geex-content__header__popup--message" role="dialog" aria-label="Wiadomosci"></div>' +
          "</li>" +
          '<li class="geex-content__header__quickaction__item">' +
            '<a href="#" class="geex-content__header__quickaction__link" aria-label="Powiadomienia" data-dam-tip="Powiadomienia operacyjne">' +
              '<i class="uil uil-bell" style="font-size:22px;color:#464255"></i>' +
              '<span class="geex-content__header__badge bg-primary">2</span></a>' +
            '<div class="geex-content__header__popup geex-content__header__popup--notification" role="dialog" aria-label="Powiadomienia"></div>' +
          "</li>" +
          '<li class="geex-content__header__quickaction__item">' +
            '<a href="#" class="geex-content__header__quickaction__link" aria-label="Profil" data-dam-tip="Menu uzytkownika">' +
              '<img class="user-img" src="assets/img/avatar/user.svg" alt="" /></a>' +
            '<div class="geex-content__header__popup geex-content__header__popup--author">' +
              '<div class="geex-content__header__popup__header">' +
                '<div class="geex-content__header__popup__header__img"><img src="assets/img/avatar/user.svg" alt="" /></div>' +
                '<div class="geex-content__header__popup__header__content">' +
                  '<h3 class="geex-content__header__popup__header__title">Uzytkownik</h3>' +
                  '<span class="geex-content__header__popup__header__subtitle"></span>' +
                "</div></div>" +
              '<div class="geex-content__header__popup__content"><ul class="geex-content__header__popup__items">' +
                '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link" href="profile.html"><i class="uil uil-user"></i> Profil</a></li>' +
                '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link" href="settings.html"><i class="uil uil-cog"></i> Ustawienia</a></li>' +
                '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link" href="billing.html"><i class="uil uil-dollar-alt"></i> Rozliczenia</a></li>' +
                '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link" href="activity.html"><i class="uil uil-users-alt"></i> Aktywnosc</a></li>' +
                '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link" href="help.html"><i class="uil uil-question-circle"></i> Pomoc</a></li>' +
              "</ul></div>" +
              '<div class="geex-content__header__popup__footer">' +
                '<a href="#" class="geex-content__header__popup__footer__link"><i class="uil uil-arrow-up-left"></i>Wyloguj</a>' +
              "</div>" +
            "</div>" +
          "</li>" +
        "</ul></div>";
    header.appendChild(wrap);
  }

  /**
   * Globalne otwieranie popupow headera - class .is-open.
   * Geex main.js uzywa jQuery slideToggle, ktore psuje panel wiadomosci (stala wysokosc).
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

  // Build messages popup with Asana + Teams tabs (Geex + dam-brand tokens)
  function buildMessagesPopup() {
    var msgPopup = document.querySelector(".geex-content__header__popup--message");
    if (!msgPopup) return;

    var asanaTasks = [];
    try {
      if (window._DAM_ASANA_TASKS && window._DAM_ASANA_TASKS.length) {
        asanaTasks = window._DAM_ASANA_TASKS.slice(0, 8);
      }
    } catch (e) { /* ignore */ }

    var teamsMessages = [
      { from: "Anna Polanska", time: "10 min temu", msg: "Prosze sprawdz projekt Tuba Prezentowa - oczekuje na akceptacje." },
      { from: "Marek Paluszewski", time: "1.2 godz temu", msg: "Karta wprowadzenia dla DK TUBA gotowa do przejrzenia." },
      { from: "Karolina Kubara", time: "2 godz temu", msg: "Potrzebujemy grafiki do kategorii dla nowej linii produktow." },
      { from: "Maciej Labus", time: "wczoraj", msg: "Specyfikacja techniczna zaktualizowana - prosze weryfikowac." }
    ];

    var asanaHTML = asanaTasks.length
      ? asanaTasks.map(function (task) {
          var due = task.due ? ' <small class="dam-msg-meta">(' + task.due + ")</small>" : "";
          var section = task.section
            ? '<span class="geex-badge geex-badge--primary-transparent dam-msg-section">' + task.section + "</span>"
            : "";
          var parent = task.parent ? '<div class="dam-msg-meta">' + task.parent + "</div>" : "";
          return '<li class="geex-content__header__popup__item">' +
            '<a class="geex-content__header__popup__link" href="dashboard.html">' +
            '<div class="geex-content__header__popup__item__content">' +
            '<h5 class="geex-content__header__popup__item__title dam-msg-title-wrap">' +
            task.name + due +
            "</h5>" +
            parent +
            '<div class="dam-msg-section-row">' + section + "</div>" +
            "</div></a></li>";
        }).join("")
      : '<li class="dam-msg-empty">Ladowanie zadan Asana...</li>';

    var teamsHTML = teamsMessages.map(function (m) {
      return '<li class="geex-content__header__popup__item">' +
        '<a class="geex-content__header__popup__link" href="#">' +
        '<div class="geex-content__header__popup__item__img">' +
        '<img src="assets/img/avatar/user.svg" alt="' + m.from + '" />' +
        "</div>" +
        '<div class="geex-content__header__popup__item__content">' +
        '<h5 class="geex-content__header__popup__item__title">' + m.from +
        '<span class="geex-content__header__popup__item__time">' + m.time + "</span></h5>" +
        '<div class="geex-content__header__popup__item__desc dam-msg-desc">' + m.msg + "</div>" +
        "</div></a></li>";
    }).join("");

    msgPopup.innerHTML =
      '<div class="dam-msg-tabs" role="tablist">' +
        '<button type="button" class="dam-msg-tab is-active" data-tab="asana" role="tab" aria-selected="true" data-i18n="dash.tab_asana">Asana</button>' +
        '<button type="button" class="dam-msg-tab" data-tab="teams" role="tab" aria-selected="false" data-i18n="dash.tab_teams">Teams</button>' +
      "</div>" +
      '<div class="geex-content__header__popup__content">' +
        '<div id="damMsgAsana"><ul class="geex-content__header__popup__items">' + asanaHTML + "</ul>" +
          '<div class="dam-msg-footer-link"><a href="dashboard.html" data-i18n="messages.view_all">Wszystkie zadania</a></div></div>' +
        '<div id="damMsgTeams" hidden><ul class="geex-content__header__popup__items">' + teamsHTML + "</ul></div>" +
      "</div>" +
      '<div class="dam-msg-resize-handle" title="Przeciagnij, aby zmienic wysokosc" aria-label="Zmien wysokosc okna wiadomosci"></div>';

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
      { title: "Brak pliku do druku", time: "12 min temu", desc: "Banoffee kakao - DOYPACK 65 g" },
      { title: "Asana: termin jutro", time: "1 godz temu", desc: "wykonanie wizualizacji - Nuggets" },
      { title: "Teams: prosba o akceptacje", time: "2 godz temu", desc: "Tuba prezentowa 516 g" },
      { title: "Checklist uzupelniony", time: "wczoraj", desc: "Tiramisu czekolada kakao" }
    ];
    notifPopup.innerHTML =
      '<h3 class="geex-content__header__popup__title" data-i18n="notif.title">Powiadomienia' +
      '<span class="content__header__popup__title__count">' + items.length + '</span></h3>' +
      '<div class="geex-content__header__popup__content"><ul class="geex-content__header__popup__items">' +
      items.map(function (n) {
        return '<li class="geex-content__header__popup__item"><a class="geex-content__header__popup__link" href="#">' +
          '<div class="geex-content__header__popup__item__content">' +
          '<h5 class="geex-content__header__popup__item__title">' + n.title +
          '<span class="geex-content__header__popup__item__time">' + n.time + '</span></h5>' +
          '<div class="geex-content__header__popup__item__desc">' + n.desc + '</div>' +
          '</div></a></li>';
      }).join("") +
      '</ul></div>';
  }

  function tt(key, fallback) {
    if (window.DamI18n) {
      var v = window.DamI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function polishUserMenu() {
    var map = [
      { keys: ["Profile", "Profil"], out: tt("user.profile", "Profil"), href: "profile.html" },
      { keys: ["Settings", "Ustawienia"], out: tt("user.settings", "Ustawienia"), href: "settings.html" },
      { keys: ["Billing", "Rozliczenia"], out: tt("user.billing", "Rozliczenia"), href: "billing.html" },
      { keys: ["Activity", "Aktywnosc"], out: tt("user.activity", "Aktywnosc"), href: "activity.html" },
      { keys: ["Help", "Pomoc"], out: tt("user.help", "Pomoc"), href: "help.html" },
      { keys: ["Logout", "Wyloguj"], out: tt("user.logout", "Wyloguj"), href: null }
    ];
    document.querySelectorAll(".geex-content__header__popup--author .geex-content__header__popup__link").forEach(function (a) {
      var t = (a.textContent || "").trim();
      map.forEach(function (m) {
        m.keys.forEach(function (k) {
          if (t === k || t.indexOf(k) !== -1) {
            var html = a.innerHTML;
            m.keys.forEach(function (kk) {
              html = html.replace(kk, m.out);
            });
            a.innerHTML = html;
            if (m.href) a.href = m.href;
          }
        });
      });
    });
    var foot = document.querySelector(".geex-content__header__popup--author .geex-content__header__popup__footer__link");
    if (foot) {
      foot.innerHTML = '<i class="uil uil-arrow-up-left"></i> ' + tt("user.logout", "Wyloguj");
      foot.removeAttribute("href");
    }
  }

  function polishBalanceMenu() {
    var links = document.querySelectorAll(".geex-content__summary__balance__more__content a");
    if (links[0]) links[0].textContent = tt("dash.cost_details", "Szczegoly kosztu");
    if (links[1]) {
      links[1].textContent = tt("dash.cost_calc", "Kalkulator");
      links[1].href = "costs.html";
    }
  }

  /** Translate leftover Geex English chrome (Customizer, Edit/Delete, Search...). */
  function polishGeexChrome() {
    var customizerLabel = tt("customizer.title", "Dostosuj wyglad");
    document.querySelectorAll(".geex-btn__customizer span, .geex-customizer__title").forEach(function (el) {
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
    var delLbl = tt("common.delete", "Usun");
    document.querySelectorAll("a, button, .geex-content__chat__header__filter__content__list__link").forEach(function (el) {
      var t = (el.textContent || "").trim();
      if (t === "Edit" || t === "Edytuj") el.textContent = editLbl;
      else if (t === "Delete" || t === "Usun") el.textContent = delLbl;
    });

    polishUserMenu();
    polishBalanceMenu();

    var langTitle = document.querySelector(".dam-lang-popup .geex-content__header__popup__title");
    if (langTitle) langTitle.textContent = tt("header.lang_title", "Jezyk");
    var langTrigger = document.querySelector(".dam-lang-trigger");
    if (langTrigger) langTrigger.setAttribute("title", tt("header.lang_title", "Jezyk"));
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
    polishUserMenu();
    document.querySelectorAll(".geex-content__header__popup--author .geex-content__header__popup__footer__link, #damShellLogout, .dam-logout-btn").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        if (DAM_DEV_ALWAYS_ADMIN) {
          ensureAdminSession();
          window.location.href = "dashboard.html";
          return;
        }
        if (window.DamApi) DamApi.logout();
        else {
          localStorage.removeItem("dam_token");
          localStorage.removeItem("dam_role");
          window.location.href = "signin.html";
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

  function applySidebarCollapse() {
    var collapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1";
    document.body.classList.toggle("dam-sidebar-collapsed", collapsed);
    var btn = document.getElementById("damSidebarCollapse");
    if (btn) {
      btn.setAttribute("aria-pressed", collapsed ? "true" : "false");
      btn.setAttribute("title", collapsed ? "Rozwin menu" : "Zwin menu");
    }
  }

  function injectSidebarCollapse() {
    var header = document.querySelector(".geex-sidebar__header");
    if (!header || document.getElementById("damSidebarCollapse")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "damSidebarCollapse";
    btn.className = "dam-sidebar-collapse-btn";
    btn.setAttribute("aria-label", "Zwin lub rozwin menu");
    btn.innerHTML = '<i class="uil uil-angle-double-left" aria-hidden="true"></i>';
    header.appendChild(btn);
    btn.addEventListener("click", function () {
      var next = !document.body.classList.contains("dam-sidebar-collapsed");
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      applySidebarCollapse();
    });
    applySidebarCollapse();
  }

  // Main init
  function init() {
    enforceAuth();
    applyDobraKaloriaLogo();
    applySidebarCollapse();

    var sidebarMenu = document.querySelector(".geex-sidebar__menu");
    if (sidebarMenu) {
      sidebarMenu.innerHTML = buildSidebarNav();
      injectSidebarCollapse();
      var logoutBtn = document.getElementById("damShellLogout");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", function (e) {
          e.preventDefault();
          if (DAM_DEV_ALWAYS_ADMIN) {
            ensureAdminSession();
            window.location.href = "dashboard.html";
            return;
          }
          if (window.DamApi) { DamApi.logout(); }
          else {
            localStorage.removeItem("dam_token");
            localStorage.removeItem("dam_role");
            window.location.href = "signin.html";
          }
        });
      }
    }

    var headerMenu = document.querySelector(".geex-header__menu");
    if (headerMenu) {
      headerMenu.innerHTML = buildHeaderNav();
    }

    ensureHeaderChrome();
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
      polishGeexChrome();
      if (window.DamI18n && typeof window.DamI18n.apply === "function") {
        window.DamI18n.apply();
      }
    });

    // Re-apply after i18n / Geex main.js (odpinamy slideToggle jesli wrocil)
    function refreshChrome() {
      bindDamHeaderPopups();
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
    goBack: goBackNav
  };
})();
