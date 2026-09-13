/**
 * DAM theme overlay - jasny / ciemny / jak system + dostrojenie HSL (Colorify-like).
 * Tylko data-theme + html.dark + CSS tokeny. Zero invert(), zero per-element black.
 * Persist: localStorage.theme, dam_theme_pref, dam_theme_tuning
 */
(function () {
  var PREF_KEY = "dam_theme_pref";
  var THEME_KEY = "theme";
  var TUNING_KEY = "dam_theme_tuning";
  var TUNING_MIN = -90;
  var TUNING_MAX = 90;
  var TUNING_WARN = 50;

  var LIGHT_BASE = {
    bg: "#f3f4f7",
    surface: "#ffffff",
    elevated: "#ffffff",
    text: "#464255",
    muted: "#8f8b9f",
    border: "#ececf2",
    dark: "#17161e",
  };
  var DARK_BASE = {
    bg: "#101114",
    surface: "#1c1d24",
    elevated: "#262730",
    text: "#eeeaf6",
    muted: "#b8b3c6",
    border: "#2c2b36",
    dark: "#0c0c10",
  };

  var TUNING_DEFAULTS = {
    dark: {
      bg_brightness: 0,
      bg_saturation: 0,
      accent_brightness: 0,
      accent_saturation: 0,
    },
    light: {
      bg_brightness: 0,
      bg_saturation: 0,
      accent_brightness: 0,
      accent_saturation: 0,
    },
  };

  var EXPORT_KEYS = [
    "dam_theme_pref",
    "theme",
    "dam_accent",
    "dam_theme_tuning",
    "dam_user_name",
    "dam_user_email",
    "dam_user_phone",
    "dam_user_title",
    "dam_role",
    "dam_tooltips",
    "dam_synology_enabled",
    "dam_brands",
    "dam_base_path",
    "dam_user_prefs",
  ];

  var SECRET_USER_FIELDS = {
    token: 1,
    access_token: 1,
    refresh_token: 1,
    password: 1,
    secret: 1,
  };

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

  function clampTuning(value) {
    var n = parseInt(value, 10);
    if (isNaN(n)) return 0;
    if (n < TUNING_MIN) return TUNING_MIN;
    if (n > TUNING_MAX) return TUNING_MAX;
    return n;
  }

  function legacyEffectiveMagnitude(magnitude) {
    var mag = Math.max(0, magnitude);
    if (mag === 0) return 0;
    var fullAt = 50;
    var min = 0.05;
    var scale = mag >= fullAt ? 1 : min + (1 - min) * (mag / fullAt);
    return mag * scale;
  }

  function effectiveTuningDelta(value) {
    if (!value) return 0;
    var sign = value < 0 ? -1 : 1;
    var abs = Math.abs(value);
    var anchorSoft = 50;
    var anchorStrong = 70;
    var effSoft = legacyEffectiveMagnitude(20);
    var effStrong = legacyEffectiveMagnitude(45);
    if (abs >= anchorStrong) return sign * (effStrong + (abs - anchorStrong));
    if (abs >= anchorSoft) {
      var t = (abs - anchorSoft) / (anchorStrong - anchorSoft);
      return sign * (effSoft + t * (effStrong - effSoft));
    }
    return sign * (effSoft * (abs / anchorSoft));
  }

  function hexToRgb(hex) {
    var s = String(hex || "").trim();
    if (s.charAt(0) === "#") s = s.slice(1);
    if (s.length === 3) {
      s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
    }
    if (!/^[0-9A-Fa-f]{6}$/.test(s)) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
    };
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h = 0;
    var s = 0;
    var l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    var r;
    var g;
    var b;
    if (s === 0) {
      r = g = b = l;
    } else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      var hk = h / 360;
      r = hue2rgb(p, q, hk + 1 / 3);
      g = hue2rgb(p, q, hk);
      b = hue2rgb(p, q, hk - 1 / 3);
    }
    function toHex(x) {
      var n = Math.round(x * 255);
      var hx = n.toString(16);
      return hx.length === 1 ? "0" + hx : hx;
    }
    return ("#" + toHex(r) + toHex(g) + toHex(b)).toUpperCase();
  }

  function adjustHexHsl(hex, brightness, saturation) {
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return hslToHex(hsl.h, hsl.s + saturation, hsl.l + brightness);
  }

  function currentAccent() {
    try {
      if (window.DamAccent && typeof DamAccent.current === "function") {
        return DamAccent.current();
      }
      var raw = localStorage.getItem("dam_accent");
      if (raw && /^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();
    } catch (e) { /* ignore */ }
    return "#AB54DB";
  }

  function emptyTuning() {
    return {
      dark: Object.assign({}, TUNING_DEFAULTS.dark),
      light: Object.assign({}, TUNING_DEFAULTS.light),
    };
  }

  function readTuning() {
    var out = emptyTuning();
    try {
      var raw = localStorage.getItem(TUNING_KEY);
      if (!raw) return out;
      var parsed = JSON.parse(raw);
      ["dark", "light"].forEach(function (mode) {
        var src = parsed && parsed[mode] ? parsed[mode] : {};
        Object.keys(TUNING_DEFAULTS[mode]).forEach(function (key) {
          out[mode][key] = clampTuning(src[key]);
        });
      });
    } catch (e) { /* ignore */ }
    return out;
  }

  function writeTuning(tuning) {
    try {
      localStorage.setItem(TUNING_KEY, JSON.stringify(tuning));
    } catch (e) { /* ignore */ }
    return tuning;
  }

  function setVar(root, name, value) {
    root.style.setProperty(name, value);
  }

  function applyTokenPaint(mode, tuning) {
    var isDark = mode === "dark";
    var base = isDark ? DARK_BASE : LIGHT_BASE;
    var t = (tuning && tuning[mode]) || TUNING_DEFAULTS[mode];
    var bgB = effectiveTuningDelta(t.bg_brightness);
    var bgS = effectiveTuningDelta(t.bg_saturation);
    var accB = effectiveTuningDelta(t.accent_brightness);
    var accS = effectiveTuningDelta(t.accent_saturation);
    var bg = adjustHexHsl(base.bg, bgB, bgS);
    var surface = adjustHexHsl(base.surface, bgB, bgS);
    var elevated = adjustHexHsl(base.elevated, bgB, bgS);
    if (isDark) {
      var bgRgb = hexToRgb(bg);
      var surfRgb = hexToRgb(surface);
      var bgL = rgbToHsl(bgRgb.r, bgRgb.g, bgRgb.b).l;
      var surfL = rgbToHsl(surfRgb.r, surfRgb.g, surfRgb.b).l;
      if (surfL <= bgL) {
        surface = adjustHexHsl(bg, 6, 0);
        elevated = adjustHexHsl(surface, 5, 0);
      }
    }
    var accent = adjustHexHsl(currentAccent(), accB, accS);
    var root = document.documentElement;
    setVar(root, "--dam-surface-muted", bg);
    setVar(root, "--dam-bg", bg);
    setVar(root, "--dam-surface", surface);
    setVar(root, "--dam-surface-elevated", elevated);
    setVar(root, "--dam-chrome", isDark ? elevated : base.border);
    setVar(root, "--dam-border", isDark ? adjustHexHsl(base.border, bgB * 0.3, bgS * 0.3) : base.border);
    setVar(root, "--dam-text", base.text);
    setVar(root, "--dam-text-muted", base.muted);
    setVar(root, "--dam-muted", base.muted);
    setVar(root, "--dam-dark", base.dark);
    setVar(root, "--dam-primary", accent);
    setVar(root, "--primary-color", accent);
    setVar(root, "--dam-hash", isDark ? adjustHexHsl(accent, 12, -8) : accent);
    setVar(root, "--white-color", surface);
    setVar(root, "--section-color", bg);
    setVar(root, "--sectionTwo-color", bg);
    setVar(root, "--sectionThree-color", surface);
    setVar(root, "--body-color", base.text);
    setVar(root, "--desc-color", base.text);
    setVar(root, "--sec-color", base.muted);
    setVar(root, "--gray-color", isDark ? "#d2cedc" : base.border);
    setVar(root, "--light-color", bg);
    setVar(root, "--dark-color", base.dark);
    setVar(root, "--dam-bento-surface", surface);
    setVar(root, "--dam-bento-muted", bg);
    setVar(root, "--dam-bento-border", isDark ? "rgba(255,255,255,0.10)" : "rgba(70,66,85,0.12)");
    setVar(root, "--dam-sticky-chrome-bg", bg);
    setVar(root, "--card-bg", surface);
    root.style.backgroundColor = bg;
    return { bg: bg, surface: surface, elevated: elevated, accent: accent };
  }

  function apply(pref) {
    var p = normalizePref(pref);
    var resolved = resolve(p);
    var root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-dam-theme-pref", p);
    root.classList.toggle("dark", resolved === "dark");
    try {
      root.style.colorScheme = resolved;
    } catch (e2) { /* ignore */ }
    try {
      localStorage.setItem(PREF_KEY, p);
      localStorage.setItem(THEME_KEY, resolved);
    } catch (e) { /* ignore */ }
    applyTokenPaint(resolved, readTuning());
    try {
      window.dispatchEvent(
        new CustomEvent("dam:theme", { detail: { pref: p, theme: resolved } })
      );
    } catch (e3) { /* ignore */ }
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

  function setTuningValue(mode, key, value) {
    var modeKey = mode === "dark" ? "dark" : "light";
    var tuning = readTuning();
    if (!TUNING_DEFAULTS[modeKey].hasOwnProperty(key)) return readTuning();
    tuning[modeKey][key] = clampTuning(value);
    writeTuning(tuning);
    applyTokenPaint(resolve(currentPref()), tuning);
    return tuning;
  }

  function resetTuning() {
    var tuning = writeTuning(emptyTuning());
    applyTokenPaint(resolve(currentPref()), tuning);
    return tuning;
  }

  function parseMaybeJson(raw) {
    if (raw == null || raw === "") return raw;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return raw;
    }
  }

  function sanitizeUser(user) {
    if (!user || typeof user !== "object") return user;
    var out = {};
    Object.keys(user).forEach(function (k) {
      if (SECRET_USER_FIELDS[k]) return;
      out[k] = user[k];
    });
    return out;
  }

  function collectProfileSettings() {
    var payload = {
      exported_at: new Date().toISOString(),
      app_version: String(window.DAM_APP_VERSION || ""),
      theme_pref: currentPref(),
      theme_resolved: resolve(currentPref()),
      accent: currentAccent(),
      tuning: readTuning(),
      localStorage: {},
    };
    EXPORT_KEYS.forEach(function (key) {
      try {
        var raw = localStorage.getItem(key);
        if (raw == null) return;
        payload.localStorage[key] = parseMaybeJson(raw);
      } catch (e) { /* ignore */ }
    });
    try {
      var user = JSON.parse(localStorage.getItem("dam_user") || "null");
      if (user) payload.user = sanitizeUser(user);
    } catch (e2) { /* ignore */ }
    return payload;
  }

  function exportProfile() {
    var payload = collectProfileSettings();
    var blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    var stamp = new Date().toISOString().slice(0, 10);
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dam-profile-settings-" + stamp + ".json";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try {
        URL.revokeObjectURL(a.href);
      } catch (e) { /* ignore */ }
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 800);
    return payload;
  }

  function syncTuneControls(rootEl, mode, tuning) {
    if (!rootEl) return;
    var t = (tuning && tuning[mode]) || TUNING_DEFAULTS[mode];
    rootEl.querySelectorAll("[data-tune-key]").forEach(function (el) {
      var key = el.getAttribute("data-tune-key");
      if (!key || t[key] == null) return;
      el.value = String(t[key]);
      el.classList.toggle("is-over-threshold", Math.abs(t[key]) > TUNING_WARN);
    });
    rootEl.querySelectorAll("[data-tune-mode-tab]").forEach(function (btn) {
      var on = btn.getAttribute("data-tune-mode-tab") === mode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    rootEl.setAttribute("data-tune-mode", mode);
  }

  function bindSettings() {
    var host = document.getElementById("damThemeTuning");
    var exportBtn = document.getElementById("damThemeExportBtn");
    if (exportBtn && !exportBtn.getAttribute("data-dam-theme-bound")) {
      exportBtn.setAttribute("data-dam-theme-bound", "1");
      exportBtn.addEventListener("click", function () {
        exportProfile();
      });
    }
    if (!host || host.getAttribute("data-dam-theme-bound") === "1") return;
    host.setAttribute("data-dam-theme-bound", "1");
    var mode = resolve(currentPref());
    syncTuneControls(host, mode, readTuning());

    host.addEventListener("click", function (ev) {
      var tab = ev.target.closest("[data-tune-mode-tab]");
      if (!tab) return;
      mode = tab.getAttribute("data-tune-mode-tab") === "dark" ? "dark" : "light";
      syncTuneControls(host, mode, readTuning());
    });

    host.addEventListener("input", function (ev) {
      var el = ev.target.closest("[data-tune-key]");
      if (!el) return;
      var key = el.getAttribute("data-tune-key");
      var tuning = setTuningValue(mode, key, el.value);
      syncTuneControls(host, mode, tuning);
    });

    var resetBtn = document.getElementById("damThemeTuningReset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        var tuning = resetTuning();
        syncTuneControls(host, mode, tuning);
      });
    }

    window.addEventListener("dam:theme", function (ev) {
      var next = ev && ev.detail && ev.detail.theme;
      if (next === "dark" || next === "light") mode = next;
      syncTuneControls(host, mode, readTuning());
    });
  }

  function hookAccent() {
    if (!window.DamAccent || typeof DamAccent.apply !== "function") return;
    if (DamAccent.apply._damThemeHooked) return;
    var orig = DamAccent.apply;
    DamAccent.apply = function (hex) {
      var out = orig.call(DamAccent, hex);
      applyTokenPaint(resolve(currentPref()), readTuning());
      return out;
    };
    DamAccent.apply._damThemeHooked = true;
  }

  function boot() {
    apply(currentPref());
    hookAccent();
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      hookAccent();
      bindSettings();
      applyTokenPaint(resolve(currentPref()), readTuning());
    });
  } else {
    hookAccent();
    bindSettings();
  }

  window.DamTheme = {
    PREF_KEY: PREF_KEY,
    TUNING_KEY: TUNING_KEY,
    apply: apply,
    currentPref: currentPref,
    resolve: resolve,
    boot: boot,
    readTuning: readTuning,
    setTuningValue: setTuningValue,
    resetTuning: resetTuning,
    exportProfile: exportProfile,
    collectProfileSettings: collectProfileSettings,
    bindSettings: bindSettings,
  };
})();
