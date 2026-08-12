/**
 * DAM - i18n overlay system
 * Loads language JSON from /i18n/{lang}.json
 * Applies data-i18n and data-i18n-placeholder attributes
 * Language stored in localStorage key: dam_lang (default: pl)
 *
 * Boot contract: body stays hidden (html.dam-booting) until first overlay
 * apply finishes. DamShell.finishBoot waits on DamI18n.whenReady so users
 * never see mojibake / half-applied chrome flashing into fixed UTF-8.
 */
(function () {
  "use strict";

  var SUPPORTED_LANGS = [
    { code: "pl", label: "PL", flag: "\uD83C\uDDF5\uD83C\uDDF1", name: "Polski" },
    { code: "en", label: "EN", flag: "\uD83C\uDDEC\uD83C\uDDE7", name: "English" },
    { code: "de", label: "DE", flag: "\uD83C\uDDE9\uD83C\uDDEA", name: "Deutsch" },
    { code: "fr", label: "FR", flag: "\uD83C\uDDEB\uD83C\uDDF7", name: "Francais" },
    { code: "es", label: "ES", flag: "\uD83C\uDDEA\uD83C\uDDF8", name: "Espanol" },
    { code: "it", label: "IT", flag: "\uD83C\uDDEE\uD83C\uDDF9", name: "Italiano" },
    { code: "nl", label: "NL", flag: "\uD83C\uDDF3\uD83C\uDDF1", name: "Nederlands" },
    { code: "cs", label: "CS", flag: "\uD83C\uDDE8\uD83C\uDDFF", name: "Cestina" },
    { code: "sk", label: "SK", flag: "\uD83C\uDDF8\uD83C\uDDF0", name: "Slovencina" },
    { code: "uk", label: "UK", flag: "\uD83C\uDDFA\uD83C\uDDE6", name: "Ukrainska" },
    { code: "ru", label: "RU", flag: "\uD83C\uDDF7\uD83C\uDDFA", name: "Russkiy" },
    { code: "da", label: "DA", flag: "\uD83C\uDDE9\uD83C\uDDF0", name: "Dansk" }
  ];

  var currentLang = localStorage.getItem("dam_lang") || "pl";
  var translations = {};
  var ready = false;
  var readyWaiters = [];
  var loadGeneration = 0;

  function getLang() { return currentLang; }

  function t(key) {
    return translations[key] || key;
  }

  /**
   * Typografia PL: sieroty / wdowy.
   * NBSP po 1-literowych (a, i, o, u, w, z) + sklejenie dwoch ostatnich slow.
   */
  function nbspPl(s) {
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

  function markReady() {
    if (ready) return;
    ready = true;
    var q = readyWaiters.splice(0, readyWaiters.length);
    for (var i = 0; i < q.length; i++) {
      try { q[i](); } catch (e) { /* ignore waiter errors */ }
    }
  }

  function whenReady(cb) {
    if (typeof cb !== "function") return;
    if (ready) {
      try { cb(); } catch (e) { /* ignore */ }
      return;
    }
    readyWaiters.push(cb);
  }

  function isReady() {
    return ready;
  }

  function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var val = t(key);
      if (val !== key) {
        el.textContent = nbspPl(val);
      }
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      var val = t(key);
      if (val !== key) {
        el.setAttribute("placeholder", nbspPl(val));
      }
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-html");
      var val = t(key);
      if (val !== key) {
        el.innerHTML = val;
      }
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-title");
      var val = t(key);
      if (val !== key) {
        el.setAttribute("title", nbspPl(val));
      }
    });
    /* Tip overlay (DamTooltips data-dam-tip) — fix mojibake via i18n keys. */
    document.querySelectorAll("[data-i18n-tip]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-tip");
      var val = t(key);
      if (val !== key) {
        el.setAttribute("data-dam-tip", nbspPl(val));
      }
    });
  }

  function afterOverlayApplied(callback) {
    applyTranslations();
    if (window.DamShell && typeof window.DamShell.polishChrome === "function") {
      window.DamShell.polishChrome();
    }
    if (window.DamShell && typeof window.DamShell.polishPageSubs === "function") {
      window.DamShell.polishPageSubs();
    }
    if (window.DamShell && typeof window.DamShell.injectNavTrail === "function") {
      window.DamShell.injectNavTrail();
    }
    markReady();
    if (callback) callback();
  }

  function loadLang(lang, callback) {
    var gen = ++loadGeneration;
    var url = "i18n/" + lang + ".json?v=" + Date.now();
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("i18n not found: " + lang);
        return r.json();
      })
      .then(function (data) {
        if (gen !== loadGeneration) return;
        translations = data;
        currentLang = lang;
        localStorage.setItem("dam_lang", lang);
        document.documentElement.setAttribute("lang", lang);
        afterOverlayApplied(callback);
      })
      .catch(function (e) {
        console.warn("DAM i18n: failed to load", lang, e);
        if (lang !== "pl") {
          loadLang("pl", callback);
          return;
        }
        /* PL failed too - still release boot so UI is not stuck hidden */
        afterOverlayApplied(callback);
      });
  }

  function buildSwitcher() {
    // Find quickaction list to inject language switcher
    var quickaction = document.querySelector(".geex-content__header__quickaction");
    if (!quickaction) return;

    var li = document.createElement("li");
    li.className = "geex-content__header__quickaction__item dam-lang-switcher";

    var currentInfo = SUPPORTED_LANGS.find(function (l) { return l.code === currentLang; }) || SUPPORTED_LANGS[0];

    li.innerHTML = '<a href="#" class="geex-content__header__quickaction__link dam-lang-trigger" title="Język" aria-label="Język">' +
      '<span class="dam-lang-code">' + currentInfo.label + '</span>' +
      '</a>' +
      '<div class="geex-content__header__popup dam-lang-popup" style="min-width:180px;right:0;left:auto">' +
      '<h3 class="geex-content__header__popup__title" style="font-size:13px;padding:12px 16px 8px" data-i18n="header.lang_title">Język</h3>' +
      '<div class="geex-content__header__popup__content">' +
      '<ul class="geex-content__header__popup__items">' +
      SUPPORTED_LANGS.map(function (l) {
        return '<li class="geex-content__header__popup__item">' +
          '<a class="geex-content__header__popup__link dam-lang-option' + (l.code === currentLang ? " active" : "") + '" ' +
          'data-lang="' + l.code + '" href="#" style="display:flex;align-items:center;gap:10px">' +
          '<span class="dam-lang-code">' + l.label + '</span>' +
          '<span>' + l.name + '</span>' +
          '</a></li>';
      }).join("") +
      '</ul></div></div>';

    // Insert before user avatar (last item)
    var items = quickaction.querySelectorAll("li.geex-content__header__quickaction__item");
    var lastItem = items[items.length - 1];
    quickaction.insertBefore(li, lastItem);

    // Click handlers for lang options
    li.querySelectorAll(".dam-lang-option").forEach(function (opt) {
      opt.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var lang = this.getAttribute("data-lang");
        loadLang(lang, function () {
          // Update language code pill in trigger (no emoji)
          var info = SUPPORTED_LANGS.find(function (l) { return l.code === lang; });
          if (info) {
            var codeEl = li.querySelector(".dam-lang-trigger .dam-lang-code");
            if (codeEl) codeEl.textContent = info.label;
          }
          // Update active class
          li.querySelectorAll(".dam-lang-option").forEach(function (o) {
            o.classList.toggle("active", o.getAttribute("data-lang") === lang);
          });
          // Close popup
          li.querySelector(".dam-lang-popup").style.display = "none";
          setTimeout(function () { li.querySelector(".dam-lang-popup").style.display = ""; }, 200);
        });
      });
    });
  }

  // Public API
  window.DamI18n = {
    t: t,
    getLang: getLang,
    load: loadLang,
    apply: applyTranslations,
    nbspPl: nbspPl,
    whenReady: whenReady,
    isReady: isReady,
    supportedLangs: SUPPORTED_LANGS
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      loadLang(currentLang, buildSwitcher);
    });
  } else {
    loadLang(currentLang, buildSwitcher);
  }
})();
