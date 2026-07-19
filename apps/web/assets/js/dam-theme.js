/**
 * DAM theme overlay — jasny / ciemny / jak system.
 * Tylko data-theme + CSS tokeny (dam-tokens). Zero per-komponentowych ifow.
 * Persist: localStorage.theme = light|dark; localStorage.dam_theme_pref = light|dark|system
 */
(function () {
  var PREF_KEY = "dam_theme_pref";
  var THEME_KEY = "theme";

  function systemDark() {
    try {
      return (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    } catch (e) {
      return false;
    }
  }

  function normalizePref(raw) {
    var s = String(raw || "").toLowerCase();
    if (s === "dark" || s === "light" || s === "system") return s;
    return "light";
  }

  function resolve(pref) {
    var p = normalizePref(pref);
    if (p === "system") return systemDark() ? "dark" : "light";
    return p;
  }

  function apply(pref) {
    var p = normalizePref(pref);
    var resolved = resolve(p);
    var root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-dam-theme-pref", p);
    try {
      localStorage.setItem(PREF_KEY, p);
      localStorage.setItem(THEME_KEY, resolved);
    } catch (e) { /* ignore */ }
    return { pref: p, theme: resolved };
  }

  function currentPref() {
    try {
      var pref = localStorage.getItem(PREF_KEY);
      if (pref) return normalizePref(pref);
      var legacy = localStorage.getItem(THEME_KEY);
      if (legacy === "dark" || legacy === "light") return legacy;
    } catch (e) { /* ignore */ }
    return "light";
  }

  function boot() {
    apply(currentPref());
  }

  boot();

  try {
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        if (currentPref() === "system") apply("system");
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  } catch (e) { /* ignore */ }

  window.DamTheme = {
    PREF_KEY: PREF_KEY,
    apply: apply,
    currentPref: currentPref,
    resolve: resolve,
    boot: boot,
  };
})();
