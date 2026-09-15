/**
 * DAM theme overlay - jasny / ciemny / jak system + zestawy + dostrojenie HSL.
 * Tylko data-theme + html.dark + CSS tokeny. Zero invert(), zero per-element black.
 * Persist: localStorage.theme, dam_theme_pref, dam_theme_tuning, dam_scheme
 */
(function () {
  var PREF_KEY = "dam_theme_pref";
  var THEME_KEY = "theme";
  var TUNING_KEY = "dam_theme_tuning";
  var SCHEME_KEY = "dam_scheme";
  var SCHEME_NAMED_KEY = "dam_scheme_named";
  var TUNING_MIN = -90;
  var TUNING_MAX = 90;
  var TUNING_WARN = 50;
  var DEFAULT_SCHEME_ID = "dobra-kaloria";
  /* Shop 2026-09-15 https://dobrakaloria.pl/ theme-d2c8261578.css
     .btn-primary { background-color:#007936 } hover/active #00642E
     body { background-color:#fff }  #FDF8EC = category tile only, not page. */
  var DK_ACCENT = "#007936";
  var DK_ACCENT_HOVER = "#00642E";
  var DK_ACCENT_DARK = "#008244";
  var DK_BG_DARK = "#060F0C";
  var DK_SURF_DARK = "#0B1814";
  var DK_CHROME_DARK = "#0E1E19";
  var DK_SUNKEN_DARK = "#081310";
  /* Fiolet keeps lilac paper. Other green-family colorify keep cool near-white
     (unchanged). Dobra Kaloria light paper follows the shop, not mint sludge. */
  var SHARED_LIGHT_PAPER = {
    bg: "#F7F2F7",
    surface: "#FFFFFF",
    elevated: "#FFFFFF",
    input: "#FFFFFF",
    chrome: "#E8DFEA",
    border: "#E8DFEA",
    sidebar: "#F7F2F7",
    sidebarEnd: "#F7F2F7",
  };
  var DK_LIGHT_PAPER = {
    bg: "#F4F7F5",
    surface: "#FFFFFF",
    elevated: "#FFFFFF",
    input: "#FFFFFF",
    chrome: "#E4EBE7",
    border: "#E4EBE7",
    sidebar: "#F4F7F5",
    sidebarEnd: "#F4F7F5",
  };
  /* Fiolet gap copied as luminance, not hue: canvas #F7F2F7 vs tiles #FFFFFF.
     DK canvas is a whisper off-white (not sage #F4F7F5, not cream #FDF8EC).
     Tiles / inputs stay #FFFFFF like fiolet cards. */
  var DK_SHOP_PAPER = {
    bg: "#F6F7F6",
    surface: "#FFFFFF",
    elevated: "#FFFFFF",
    input: "#FFFFFF",
    chrome: "#E4E6E4",
    border: "#E4E6E4",
    sidebar: "#F6F7F6",
    sidebarEnd: "#F6F7F6",
    well: "#F2F3F2",
    accentHover: DK_ACCENT_HOVER,
  };
  var DARK_ACCENT_L_FLOOR = 25.1;
  var LADDER_MIGRATE_KEY = "dam_theme_ladder_v8";
  var CONTRAST_AA = 4.5;
  var applyingScheme = false;

  var LIGHT_BASE = {
    bg: DK_SHOP_PAPER.bg,
    surface: DK_SHOP_PAPER.surface,
    elevated: DK_SHOP_PAPER.elevated,
    chrome: DK_SHOP_PAPER.chrome,
    text: "#222222",
    muted: "#6B6B6B",
    border: DK_SHOP_PAPER.border,
    dark: "#060F0C",
    input: DK_SHOP_PAPER.input,
  };
  var DARK_BASE = {
    bg: "#060F0C",
    surface: "#0B1814",
    elevated: "#0B1814",
    chrome: "#0E1E19",
    text: "#EEF4F0",
    muted: "#A8C4B6",
    border: "#143028",
    dark: "#060F0C",
  };

  function pack(bg, surface, elevated, chrome, border, text, muted, dark, accent) {
    return {
      bg: bg,
      surface: surface,
      elevated: elevated,
      chrome: chrome,
      border: border,
      text: text,
      muted: muted,
      dark: dark,
      accent: accent || "",
    };
  }

  function mixHexSimple(a, b, t) {
    function toRgb(hex) {
      var h = String(hex || "").replace("#", "");
      if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      return [
        parseInt(h.slice(0, 2), 16) || 0,
        parseInt(h.slice(2, 4), 16) || 0,
        parseInt(h.slice(4, 6), 16) || 0,
      ];
    }
    function hx(n) {
      var s = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return s.length === 1 ? "0" + s : s;
    }
    var A = toRgb(a);
    var B = toRgb(b);
    return (
      "#" +
      hx(A[0] + (B[0] - A[0]) * t) +
      hx(A[1] + (B[1] - A[1]) * t) +
      hx(A[2] + (B[2] - A[2]) * t)
    ).toUpperCase();
  }

  function lightenTowardWhite(hex, amount) {
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return hslToHex(hsl.h, hsl.s, hsl.l + (100 - hsl.l) * amount);
  }

  function darkModeAccent(hex) {
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    if (hsl.l < DARK_ACCENT_L_FLOOR) {
      return hslToHex(hsl.h, hsl.s, DARK_ACCENT_L_FLOOR);
    }
    return String(hex || "").toUpperCase();
  }

  function hueTintedDark(accentHex, lightness, satFactor, hueNudge) {
    var rgb = hexToRgb(accentHex);
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    var sat = Math.max(18, Math.min(52, hsl.s * satFactor));
    return hslToHex(hsl.h + (hueNudge || 0), sat, lightness);
  }

  function relativeLuminance(hex) {
    var c = hexToRgb(hex);
    function chan(v) {
      var x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b);
  }

  function contrastRatio(a, b) {
    var l1 = relativeLuminance(a);
    var l2 = relativeLuminance(b);
    var hi = Math.max(l1, l2);
    var lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function chromeAccent(hex) {
    var raw = String(hex || "").toUpperCase();
    if (!raw || raw === "#") return DK_ACCENT;
    if (contrastRatio(raw, "#FFFFFF") >= CONTRAST_AA) return raw;
    var rgb = hexToRgb(raw);
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    var lo = 8;
    var hi = hsl.l;
    var best = hslToHex(hsl.h, hsl.s, 8);
    var i;
    for (i = 0; i < 30; i++) {
      var mid = (lo + hi) / 2;
      var cand = hslToHex(hsl.h, hsl.s, mid);
      if (contrastRatio(cand, "#FFFFFF") >= CONTRAST_AA) {
        best = cand;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return best;
  }

  function paleHueTint(accentHex, amount) {
    return mixHexSimple("#FFFFFF", accentHex, amount);
  }

  function ensureCoolMint(hex) {
    var rgb = hexToRgb(hex);
    if (rgb.g > rgb.r && rgb.g >= rgb.b) return String(hex || "").toUpperCase();
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    var out = hslToHex(150, Math.max(12, Math.min(36, hsl.s || 18)), hsl.l);
    var o = hexToRgb(out);
    if (o.g > o.r && o.g >= o.b) return out;
    function hx(n) {
      var s = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return s.length === 1 ? "0" + s : s;
    }
    var g = Math.max(o.g, o.r + 2, o.b);
    return ("#" + hx(Math.min(o.r, g - 2)) + hx(g) + hx(Math.min(o.b, g))).toUpperCase();
  }

  function colorifyToDam(id, label, group, _bgDark, _surfDark, accent, accentSoft) {
    var identity = String(accent || DK_ACCENT).toUpperCase();
    var slot3 = chromeAccent(identity);
    var lightBg = paleHueTint(identity, 0.04);
    var lightSurf = "#FFFFFF";
    var lightElev = "#FFFFFF";
    var lightChrome = paleHueTint(identity, 0.09);
    var lightInput = "#FFFFFF";
    var lightText = hueTintedDark(slot3, 18, 0.28, 0);
    var lightMuted = hueTintedDark(slot3, 42, 0.22, 0);
    var darkBg = hueTintedDark(slot3, 4.12, 0.444, 14);
    var darkSurf = hueTintedDark(slot3, 6.86, 0.36, 12);
    var darkElev = hueTintedDark(slot3, 8.63, 0.32, 12);
    var darkBorder = hueTintedDark(slot3, 16.5, 0.28, 12);
    var darkMuted = hueTintedDark(slot3, 68, 0.18, 8);
    var darkText = lightenTowardWhite(hueTintedDark(slot3, 92, 0.08, 6), 0.15);
    var darkAccent = darkModeAccent(chromeAccent(accentSoft || identity));
    var light = pack(lightBg, lightSurf, lightElev, lightChrome, lightChrome, lightText, lightMuted, darkBg, slot3);
    light.input = lightInput;
    return {
      id: id,
      label: label,
      group: group,
      accent: slot3,
      light: light,
      dark: pack(darkBg, darkSurf, darkSurf, darkElev, darkBorder, darkText, darkMuted, darkBg, darkAccent),
    };
  }

  /* Colorify pool (colorify-admin-schemes.php scheme_pool_raw). Skip colorify-custom. */
  var COLORIFY_POOL = [
    ["colorify-deep", "Głęboka zieleń", "green", "#020806", "#040E0A", "#4A9B84", "#6DB89F"],
    ["colorify-hunter", "Myśliwska", "green", "#030908", "#05100C", "#355E3B", "#4A7C59"],
    ["colorify-marsh", "Bagno", "green", "#030A08", "#06100D", "#1C4B42", "#2A5C52"],
    ["colorify-pine", "Sosna", "green", "#040B09", "#07110F", "#1B6B3A", "#3D8F58"],
    ["colorify-jade", "Jadeit", "green", "#040C0A", "#081210", "#10B981", "#34D399"],
    ["colorify-fern", "Paproć", "green", "#040D0A", "#091311", "#3D8B37", "#5CB85C"],
    ["colorify-eucalyptus", "Eukaliptus", "green", "#050D0B", "#0A1412", "#44D7A8", "#7AE582"],
    ["colorify-forest", "Las", "green", "#050E0B", "#0A1614", "#92C200", "#B4E717"],
    ["colorify-lime", "Limonka", "green", "#050F0C", "#0B1816", "#B4E717", "#C8F033"],
    ["colorify-mint", "Mięta", "green", "#05100C", "#0B1A18", "#2DD4BF", "#5EEAD4"],
    ["colorify-sage", "Szałwia", "green", "#05110D", "#0C1C1A", "#4A7C59", "#6B9E78"],
    ["colorify-seafoam", "Rubin", "warm", "#0A0407", "#160B12", "#E11D48", "#FB7185"],
    ["colorify-chartreuse", "Szkarłat", "warm", "#0B0405", "#180C0D", "#DC2626", "#F87171"],
    ["colorify-neon", "Wiśnia", "warm", "#0A0306", "#170A10", "#BE123C", "#E11D48"],
    ["colorify-lime-soft", "Koral", "warm", "#0C0504", "#1A0E0C", "#F97316", "#FB923C"],
    ["colorify-moss", "Wino", "warm", "#0A0308", "#160C14", "#9F1239", "#BE185D"],
    ["colorify-olive", "Rdza", "warm", "#0B0403", "#181008", "#C2410C", "#EA580C"],
    ["colorify-avocado", "Miedź", "warm", "#0A0503", "#1A1209", "#B45309", "#D97706"],
    ["colorify-basil", "Pomarańcza", "warm", "#0B0503", "#1B1308", "#EA580C", "#F97316"],
    ["colorify-canopy", "Złoto", "warm", "#0A0603", "#1C1509", "#CA8A04", "#EAB308"],
    ["colorify-spring", "Brzoskwinia", "warm", "#0B0605", "#1D120E", "#FDBA74", "#FCD34D"],
    ["colorify-grove", "Czekolada", "warm", "#080604", "#151008", "#92400E", "#B45309"],
    ["colorify-onyx", "Czerń", "blue", "#0A0A0A", "#141414", "#7C3AED", "#A78BFA"],
    ["colorify-indigo", "Indigo", "blue", "#0A0A0B", "#151515", "#6366F1", "#818CF8"],
    ["colorify-graphite", "Grafit", "blue", "#0A0A0A", "#1C1C1F", "#6366F1", "#818CF8"],
    ["colorify-midnight", "Północ", "blue", "#0F172A", "#1E293B", "#06B6D4", "#22D3EE"],
    ["colorify-blue", "Niebieski", "blue", "#0A0B0D", "#16171A", "#3B82F6", "#60A5FA"],
    ["colorify-cyan", "Cyjan", "blue", "#0B0B0D", "#17181B", "#06B6D4", "#22D3EE"],
    ["colorify-sky", "Błękit", "blue", "#0B0C0E", "#18191C", "#0EA5E9", "#38BDF8"],
    ["colorify-teal", "Morski", "blue", "#0B0C0F", "#181A1D", "#14B8A6", "#2DD4BF"],
    ["colorify-charcoal", "Antracyt", "blue", "#171717", "#262626", "#3B82F6", "#60A5FA"],
    ["colorify-slate", "Łupkowy", "blue", "#18181B", "#27272A", "#0EA5E9", "#38BDF8"],
    ["colorify-smoke", "Dymny", "blue", "#111827", "#1F2937", "#94A3B8", "#CBD5E1"],
    ["colorify-violet", "Fiolet", "purple", "#0A0A0C", "#151618", "#7C3AED", "#A78BFA"],
    ["colorify-purple", "Purpura", "purple", "#0A0B0C", "#161619", "#9333EA", "#A855F7"],
    ["colorify-fuchsia", "Fuksja", "purple", "#0C0D10", "#191B1E", "#D946EF", "#E879F9"],
    ["colorify-rose", "Róż", "purple", "#0C0E11", "#1A1C1F", "#F43F5E", "#FB7185"],
    ["colorify-amber", "Bursztyn", "earth", "#0D0F13", "#1C1E21", "#F59E0B", "#FBBF24"],
    ["colorify-stone", "Kamień", "earth", "#1C1917", "#292524", "#F59E0B", "#FBBF24"],
    ["colorify-emerald", "Szmaragd", "earth", "#0D0E12", "#1B1D20", "#10B981", "#34D399"],
  ];

  var SCHEME_ALIASES = {
    lime: "colorify-lime",
    warm: "colorify-olive",
    violet: "colorify-violet",
    earth: "colorify-stone",
    brand: "dobra-kaloria",
    ocean: "colorify-sky",
    slate: "colorify-slate",
    rose: "colorify-rose",
    amber: "colorify-amber",
    indigo: "colorify-indigo",
    teal: "colorify-teal",
  };
  var SCHEME_GROUP_LABELS = {
    dam: "DAM",
    green: "Zielone",
    warm: "Ciepłe",
    blue: "Niebieskie",
    purple: "Fioletowe",
    earth: "Ziemia",
  };

  function applyPaperPack(pack, paper) {
    if (!pack || !paper) return pack;
    pack.bg = paper.bg;
    pack.surface = paper.surface;
    pack.elevated = paper.elevated;
    pack.input = paper.input;
    pack.chrome = paper.chrome;
    pack.border = paper.border;
    return pack;
  }

  function applySharedLightPaper(pack) {
    return applyPaperPack(pack, SHARED_LIGHT_PAPER);
  }

  function applyDkLightPaper(pack) {
    return applyPaperPack(pack, DK_LIGHT_PAPER);
  }

  function applyDkShopPaper(pack) {
    return applyPaperPack(pack, DK_SHOP_PAPER);
  }

  function usesSharedLightPaper(scheme) {
    return scheme && scheme.id === "default";
  }

  function usesDkShopPaper(scheme) {
    return scheme && scheme.id === "dobra-kaloria";
  }

  function usesDkCoolPaper(scheme) {
    return scheme && scheme.group === "green";
  }

  function lightPaperFor(scheme) {
    if (usesSharedLightPaper(scheme)) return SHARED_LIGHT_PAPER;
    if (usesDkShopPaper(scheme)) return DK_SHOP_PAPER;
    if (usesDkCoolPaper(scheme)) return DK_LIGHT_PAPER;
    return null;
  }

  function buildDobraKaloriaScheme() {
    var built = colorifyToDam("dobra-kaloria", "Dobra Kaloria", "dam", DK_BG_DARK, DK_SURF_DARK, DK_ACCENT, DK_ACCENT_DARK);
    built.accent = DK_ACCENT;
    built.light.accent = DK_ACCENT;
    applyDkShopPaper(built.light);
    built.light.text = LIGHT_BASE.text;
    built.light.muted = LIGHT_BASE.muted;
    built.dark.bg = DK_BG_DARK;
    built.dark.surface = DK_SURF_DARK;
    built.dark.elevated = DK_SURF_DARK;
    built.dark.chrome = DK_CHROME_DARK;
    built.dark.border = "#143028";
    built.dark.dark = DK_BG_DARK;
    built.dark.accent = DK_ACCENT_DARK;
    return built;
  }

  function buildDamVioletScheme() {
    var built = colorifyToDam("default", "DAM fiolet", "dam", "#100814", "#1A1220", "#AB54DB", "#AB54DB");
    var violet = chromeAccent("#AB54DB");
    built.accent = violet;
    built.light.accent = violet;
    applySharedLightPaper(built.light);
    return built;
  }

  var SCHEMES = [buildDobraKaloriaScheme(), buildDamVioletScheme()].concat(
    COLORIFY_POOL.map(function (row) {
      var built = colorifyToDam(row[0], row[1], row[2], row[3], row[4], row[5], row[6]);
      if (built.group === "green") applyDkLightPaper(built.light);
      return built;
    })
  );
  var SCHEME_BY_ID = {};
  SCHEMES.forEach(function (s) {
    SCHEME_BY_ID[s.id] = s;
  });

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
    "dam_scheme",
    "dam_scheme_named",
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
    return DK_ACCENT;
  }

  function clonePack(src) {
    if (!src) {
      var fallback = pack(
        LIGHT_BASE.bg, LIGHT_BASE.surface, LIGHT_BASE.elevated, LIGHT_BASE.chrome,
        LIGHT_BASE.border, LIGHT_BASE.text, LIGHT_BASE.muted, LIGHT_BASE.dark, ""
      );
      fallback.input = LIGHT_BASE.input;
      return fallback;
    }
    var cloned = pack(
      src.bg, src.surface, src.elevated, src.chrome || src.border,
      src.border, src.text, src.muted, src.dark, src.accent || ""
    );
    if (src.input) cloned.input = src.input;
    return cloned;
  }

  function getScheme(id) {
    var key = SCHEME_ALIASES[id] || id;
    return SCHEME_BY_ID[key] || SCHEME_BY_ID[id] || SCHEME_BY_ID[DEFAULT_SCHEME_ID];
  }

  function writeSchemeId(id, namedId) {
    try {
      localStorage.setItem(SCHEME_KEY, id);
      if (namedId) localStorage.setItem(SCHEME_NAMED_KEY, namedId);
    } catch (e) { /* ignore */ }
  }

  function currentNamedSchemeId() {
    try {
      var named = localStorage.getItem(SCHEME_NAMED_KEY);
      if (named && SCHEME_BY_ID[named]) return named;
    } catch (e) { /* ignore */ }
    return DEFAULT_SCHEME_ID;
  }

  function matchSchemeByAccent(hex) {
    var h = String(hex || "").toUpperCase();
    var i;
    for (i = 0; i < SCHEMES.length; i++) {
      var s = SCHEMES[i];
      if (String(s.accent || "").toUpperCase() === h) return s;
      if (s.light && String(s.light.accent || "").toUpperCase() === h) return s;
      if (s.dark && String(s.dark.accent || "").toUpperCase() === h) return s;
    }
    return null;
  }

  function currentSchemeId() {
    try {
      var raw = localStorage.getItem(SCHEME_KEY);
      if (raw === "custom") return "custom";
      if (raw && SCHEME_ALIASES[raw]) return SCHEME_ALIASES[raw];
      if (raw && SCHEME_BY_ID[raw]) return raw;
    } catch (e) { /* ignore */ }
    return DEFAULT_SCHEME_ID;
  }

  function resolveScheme() {
    var id = currentSchemeId();
    if (id === "custom") {
      var named = getScheme(currentNamedSchemeId());
      var hex = currentAccent();
      var light = clonePack(named.light);
      var dark = clonePack(named.dark);
      light.accent = hex;
      dark.accent = hex;
      return {
        id: "custom",
        label: "Własny",
        group: "custom",
        accent: hex,
        light: light,
        dark: dark,
      };
    }
    return getScheme(id);
  }

  function packAccent(scheme, mode) {
    var p = scheme && scheme[mode];
    if (scheme && scheme.id === "custom") return currentAccent();
    if (p && p.accent) return p.accent;
    return (scheme && scheme.accent) || currentAccent();
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
    var scheme = resolveScheme();
    var rawPack = (scheme && scheme[mode]) || (isDark ? DARK_BASE : LIGHT_BASE);
    var base = clonePack(rawPack);
    if (rawPack && rawPack.input) base.input = rawPack.input;
    var t = (tuning && tuning[mode]) || TUNING_DEFAULTS[mode];
    var bgB = effectiveTuningDelta(t.bg_brightness);
    var bgS = effectiveTuningDelta(t.bg_saturation);
    var accB = effectiveTuningDelta(t.accent_brightness);
    var accS = effectiveTuningDelta(t.accent_saturation);
    var bg = adjustHexHsl(base.bg, bgB, bgS);
    var surface = adjustHexHsl(base.surface, bgB, bgS);
    var elevated = adjustHexHsl(base.elevated, bgB, bgS);
    var chrome = adjustHexHsl(base.chrome || (isDark ? elevated : base.border), bgB * 0.4, bgS * 0.4);
    if (isDark) {
      var bgRgb = hexToRgb(bg);
      var surfRgb = hexToRgb(surface);
      var bgL = rgbToHsl(bgRgb.r, bgRgb.g, bgRgb.b).l;
      var surfL = rgbToHsl(surfRgb.r, surfRgb.g, surfRgb.b).l;
      if (surfL - bgL < 4) {
        surface = adjustHexHsl(bg, 7, 0);
        elevated = adjustHexHsl(surface, 5, 0);
        chrome = adjustHexHsl(surface, 4, 0);
      }
    } else if (scheme && scheme.id === "dobra-kaloria") {
      surface = "#FFFFFF";
      elevated = "#FFFFFF";
    } else {
      var lightBgRgb = hexToRgb(bg);
      var lightSurfRgb = hexToRgb(surface);
      var lightBgL = rgbToHsl(lightBgRgb.r, lightBgRgb.g, lightBgRgb.b).l;
      var lightSurfL = rgbToHsl(lightSurfRgb.r, lightSurfRgb.g, lightSurfRgb.b).l;
      if (lightSurfL - lightBgL < 3) {
        surface = "#FFFFFF";
        elevated = "#FFFFFF";
      }
    }
    if (isDark && scheme && scheme.id === "custom") {
      var srcAccent = currentAccent();
      base.bg = hueTintedDark(srcAccent, 4.12, 0.444, 14);
      base.surface = hueTintedDark(srcAccent, 6.86, 0.385, 12);
      base.elevated = hueTintedDark(srcAccent, 6.86, 0.385, 12);
      base.chrome = hueTintedDark(srcAccent, 8.63, 0.32, 12);
      base.border = hueTintedDark(srcAccent, 16.5, 0.28, 12);
      base.dark = base.bg;
      bg = adjustHexHsl(base.bg, bgB, bgS);
      surface = adjustHexHsl(base.surface, bgB, bgS);
      elevated = adjustHexHsl(base.elevated, bgB, bgS);
      chrome = adjustHexHsl(base.chrome, bgB * 0.4, bgS * 0.4);
    }
    var accentHex = packAccent(scheme, mode);
    if (isDark) accentHex = darkModeAccent(accentHex);
    else accentHex = chromeAccent(accentHex);
    var accent = adjustHexHsl(accentHex, accB, accS);
    if (!isDark && contrastRatio(accent, "#FFFFFF") < CONTRAST_AA) {
      accent = chromeAccent(accent);
    }
    var root = document.documentElement;
    root.setAttribute("data-dam-scheme", scheme.id);
    setVar(root, "--dam-surface-muted", bg);
    setVar(root, "--dam-bg", bg);
    setVar(root, "--dam-surface", surface);
    setVar(root, "--dam-surface-elevated", isDark ? surface : elevated);
    setVar(root, "--dam-chrome", chrome);
    var sunken = isDark
      ? mixHexSimple(bg, surface, 0.45)
      : (scheme && scheme.id === "dobra-kaloria"
        ? (DK_SHOP_PAPER.well || "#F5F5F5")
        : (base.bg || bg));
    var inputBg = isDark
      ? chrome
      : (base.input || elevated || paleHueTint(accentHex, 0.028));
    setVar(root, "--dam-surface-sunken", sunken);
    setVar(root, "--dam-surface-raised", inputBg);
    setVar(root, "--dam-input-bg", inputBg);
    setVar(root, "--dam-border", isDark ? adjustHexHsl(base.border, bgB * 0.3, bgS * 0.3) : base.border);
    setVar(root, "--dam-text", base.text);
    setVar(root, "--dam-text-muted", base.muted);
    setVar(root, "--dam-muted", base.muted);
    setVar(root, "--dam-dark", base.dark);
    setVar(root, "--dam-primary", accent);
    setVar(root, "--primary-color", accent);
    var hoverHex = (!isDark && scheme && scheme.id === "dobra-kaloria")
      ? DK_ACCENT_HOVER
      : adjustHexHsl(accent, isDark ? 8 : -10, 0);
    setVar(root, "--dam-primary-hover", hoverHex);
    setVar(root, "--dam-hash", isDark ? adjustHexHsl(accent, 12, -8) : accent);
    setVar(root, "--white-color", surface);
    setVar(root, "--section-color", bg);
    setVar(root, "--sectionTwo-color", bg);
    setVar(root, "--sectionThree-color", surface);
    setVar(root, "--body-color", base.text);
    setVar(root, "--desc-color", base.text);
    setVar(root, "--sec-color", base.muted);
    setVar(root, "--gray-color", isDark ? adjustHexHsl(base.text, -6, -8) : chrome);
    setVar(root, "--light-color", bg);
    setVar(root, "--dark-color", base.dark);
    setVar(root, "--dam-bento-surface", surface);
    setVar(root, "--dam-bento-muted", bg);
    setVar(root, "--dam-bento-border", isDark
      ? "rgba(255,255,255,0.10)"
      : "color-mix(in srgb, " + chrome + " 70%, transparent)");
    setVar(root, "--dam-sticky-chrome-bg", bg);
    setVar(root, "--card-bg", surface);
    var paper = lightPaperFor(scheme);
    var sidebarStart = isDark
      ? bg
      : (paper ? paper.sidebar : paleHueTint(accentHex, 0.018));
    var sidebarEnd = isDark
      ? mixHexSimple(bg, accent, 0.22)
      : (paper ? paper.sidebarEnd : bg);
    setVar(root, "--dam-sidebar-bg", sidebarStart);
    setVar(root, "--dam-sidebar-bg-end", sidebarEnd);
    setVar(root, "--dam-sidebar-grad", "linear-gradient(165deg, " + sidebarStart + " 0%, " + sidebarEnd + " 100%)");
    setVar(root, "--dam-chrome-ink", isDark ? adjustHexHsl(accent, 8, -12) : adjustHexHsl(accent, -8, -6));
    root.style.backgroundColor = bg;
    return {
      bg: bg,
      surface: surface,
      elevated: elevated,
      chrome: chrome,
      accent: accent,
      scheme: scheme.id,
    };
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
    var scheme = resolveScheme();
    var nextAccent = packAccent(scheme, resolved);
    if (nextAccent && window.DamAccent && typeof DamAccent.apply === "function") {
      applyingScheme = true;
      try {
        DamAccent.apply(nextAccent);
      } catch (eAcc) { /* ignore */ }
      applyingScheme = false;
    }
    applyTokenPaint(resolved, readTuning());
    try {
      window.dispatchEvent(
        new CustomEvent("dam:theme", { detail: { pref: p, theme: resolved, scheme: scheme.id } })
      );
    } catch (e3) { /* ignore */ }
    syncSchemeTiles();
    return { pref: p, theme: resolved, scheme: scheme.id };
  }

  function applyScheme(id) {
    var scheme = id === "custom" ? resolveScheme() : getScheme(id);
    if (id !== "custom") {
      writeSchemeId(scheme.id, scheme.id);
    } else {
      writeSchemeId("custom", currentNamedSchemeId());
    }
    var resolved = resolve(currentPref());
    var hex = packAccent(scheme, resolved);
    applyingScheme = true;
    try {
      if (window.DamAccent && typeof DamAccent.apply === "function") {
        DamAccent.apply(hex);
      }
    } catch (e) { /* ignore */ }
    applyingScheme = false;
    applyTokenPaint(resolved, readTuning());
    try {
      window.dispatchEvent(
        new CustomEvent("dam:scheme", { detail: { id: scheme.id, accent: hex } })
      );
    } catch (e2) { /* ignore */ }
    syncSchemeTiles();
    return scheme.id;
  }

  function noteAccentFromPicker(hex) {
    if (applyingScheme) return currentSchemeId();
    var matched = matchSchemeByAccent(hex);
    if (matched) {
      writeSchemeId(matched.id, matched.id);
    } else {
      writeSchemeId("custom", currentNamedSchemeId());
    }
    applyTokenPaint(resolve(currentPref()), readTuning());
    syncSchemeTiles();
    return currentSchemeId();
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
      scheme: currentSchemeId(),
      scheme_named: currentNamedSchemeId(),
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

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function injectSchemeCss() {
    if (document.getElementById("damSchemeTilesCss")) return;
    var st = document.createElement("style");
    st.id = "damSchemeTilesCss";
    st.textContent =
      ".dam-appearance-schemes{width:100%;}" +
      ".dam-scheme-trigger-row{display:flex;align-items:stretch;gap:10px;width:100%;}" +
      "#damSchemeCurrent.dam-scheme-current-tile{flex:1 1 auto;min-width:0;max-width:280px;}" +
      "#damSchemeOpenPicker{flex:0 0 auto;min-height:44px;}" +
      ".dam-scheme-groups{display:flex;flex-direction:column;gap:14px;}" +
      ".dam-scheme-group__label{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--dam-text-muted,#8b8d97);}" +
      "#damSchemePickerOverlay .dam-scheme-grid,.dam-scheme-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;width:100%;}" +
      ".dam-scheme-tile{display:flex;flex-direction:column;gap:6px;width:100%;min-width:0;min-height:44px;padding:8px;border:1px solid var(--dam-border,#ececf2);border-radius:12px;background:var(--dam-surface,#fff);color:var(--dam-text,#464255);cursor:pointer;text-align:left;font:inherit;box-sizing:border-box;}" +
      ".dam-scheme-tile.is-active{border-color:var(--dam-primary,#005A29);box-shadow:0 0 0 2px color-mix(in srgb,var(--dam-primary,#005A29) 28%,transparent);}" +
      ".dam-scheme-tile:focus-visible{outline:2px solid var(--dam-primary,#005A29);outline-offset:2px;}" +
      ".dam-scheme-tile__swatches{display:grid;grid-template-columns:repeat(4,1fr);height:22px;border-radius:6px;overflow:hidden;border:1px solid color-mix(in srgb,var(--dam-text,#464255) 12%,transparent);}" +
      ".dam-scheme-tile__chip{display:block;min-width:0;height:100%;}" +
      ".dam-scheme-tile__label{font-size:11px;font-weight:600;line-height:1.25;color:var(--dam-text,#464255);}" +
      ".dam-appearance-tune{width:100%;min-width:0;display:flex;flex-direction:column;gap:14px;}" +
      ".dam-accent-presets{display:flex;flex-wrap:wrap;gap:10px;}" +
      "#damSchemePickerOverlay.dam-scheme-picker-overlay{position:fixed;inset:0;z-index:12300;display:none;align-items:stretch;justify-content:flex-end;padding:20px;box-sizing:border-box;background:rgba(8,10,16,.32);}" +
      "#damSchemePickerOverlay.dam-scheme-picker-overlay.is-open{display:flex;}" +
      "#damSchemePickerOverlay .dam-scheme-picker-dialog{width:min(520px,100%);max-height:calc(100vh - 40px);display:flex;flex-direction:column;min-width:0;background:var(--dam-surface-elevated,#fff);color:var(--dam-text,#464255);border:1px solid var(--dam-border,#ececf2);border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.35);overflow:hidden;}" +
      "#damSchemePickerOverlay .dam-scheme-picker__head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px 8px;flex:0 0 auto;}" +
      "#damSchemePickerOverlay .dam-scheme-picker__head h2{margin:0;font-size:16px;font-weight:700;line-height:1.3;}" +
      "#damSchemePickerOverlay .dam-scheme-picker__close{flex:0 0 auto;width:44px;height:44px;min-width:44px;min-height:44px;border:0;border-radius:10px;background:transparent;color:inherit;cursor:pointer;font-size:22px;line-height:1;}" +
      "#damSchemePickerOverlay .dam-scheme-picker__close:hover{background:color-mix(in srgb,var(--dam-primary,#005A29) 12%,transparent);}" +
      "#damSchemePickerOverlay .dam-scheme-picker__hint{margin:0 16px 10px;font-size:12px;line-height:1.4;color:var(--dam-text-muted,#8b8d97);}" +
      "#damSchemePickerOverlay .dam-scheme-groups{flex:1 1 auto;min-height:0;overflow:auto;padding:0 16px 12px;}" +
      "#damSchemePickerOverlay .dam-scheme-picker__foot{flex:0 0 auto;display:flex;justify-content:flex-end;padding:10px 16px 14px;border-top:1px solid var(--dam-border,#ececf2);}" +
      "#damSchemePickerOverlay .dam-scheme-picker__foot [data-scheme-picker-close]{min-height:44px;padding:0 16px;border-radius:10px;border:1px solid var(--dam-primary,#005A29);background:var(--dam-primary,#005A29);color:#fff;font:inherit;font-weight:600;cursor:pointer;}" +
      "html.dark .dam-scheme-tile,html[data-theme=dark] .dam-scheme-tile{background:var(--dam-surface-elevated);border-color:var(--dam-border);}" +
      "html.dark .dam-scheme-tile__label,html[data-theme=dark] .dam-scheme-tile__label{color:var(--dam-text);}" +
      "html.dark #damSchemePickerOverlay .dam-scheme-picker-dialog,html[data-theme=dark] #damSchemePickerOverlay .dam-scheme-picker-dialog{background:var(--dam-surface-elevated);border-color:var(--dam-border);}";
    document.head.appendChild(st);
  }

  function schemeSwatchHtml(pack) {
    var p = pack || LIGHT_BASE;
    var bits = [p.bg, p.surface, p.accent || DK_ACCENT, p.dark || p.text];
    return bits
      .map(function (c) {
        return '<span class="dam-scheme-tile__chip" style="background:' + escHtml(c) + '"></span>';
      })
      .join("");
  }

  function tileButtonHtml(s, mode) {
    var p = s[mode] || s.light;
    return (
      '<button type="button" class="dam-scheme-tile" role="option" data-scheme-id="' +
      escHtml(s.id) +
      '" aria-label="' +
      escHtml(s.label) +
      '" title="' +
      escHtml(s.label) +
      '"><span class="dam-scheme-tile__swatches" aria-hidden="true">' +
      schemeSwatchHtml(p) +
      '</span><span class="dam-scheme-tile__label">' +
      escHtml(s.label) +
      "</span></button>"
    );
  }

  function currentPreviewInnerHtml() {
    var scheme = resolveScheme();
    var mode = resolve(currentPref());
    var p = scheme[mode] || scheme.light;
    var label = scheme.id === "custom" ? "Własny" : scheme.label;
    return (
      '<span class="dam-scheme-tile__swatches" aria-hidden="true">' +
      schemeSwatchHtml(p) +
      '</span><span class="dam-scheme-tile__label">' +
      escHtml(label) +
      "</span>"
    );
  }

  function renderCurrentPreview() {
    var el = document.getElementById("damSchemeCurrent");
    if (!el) return;
    var scheme = resolveScheme();
    var label = scheme.id === "custom" ? "Własny" : scheme.label || scheme.id;
    el.innerHTML = currentPreviewInnerHtml();
    el.setAttribute("aria-label", "Aktualny zestaw: " + label + ". Otwórz listę zestawów.");
    el.title = label;
  }

  function retireInlineSchemeGrid() {
    var inline = document.getElementById("damSchemeGrid");
    var overlay = document.getElementById("damSchemePickerOverlay");
    if (inline && overlay && !overlay.contains(inline)) {
      inline.id = "damSchemeGridLegacy";
      inline.setAttribute("hidden", "hidden");
      inline.innerHTML = "";
    } else if (inline && !overlay) {
      inline.id = "damSchemeGridLegacy";
      inline.setAttribute("hidden", "hidden");
      inline.innerHTML = "";
    }
  }

  function ensurePickerOverlay() {
    injectSchemeCss();
    retireInlineSchemeGrid();
    var overlay = document.getElementById("damSchemePickerOverlay");
    if (overlay) {
      overlay.style.zIndex = "12300";
      return overlay;
    }
    overlay = document.createElement("div");
    overlay.id = "damSchemePickerOverlay";
    overlay.className = "dam-scheme-picker-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.zIndex = "12300";
    overlay.innerHTML =
      '<div class="dam-scheme-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="damSchemePickerTitle">' +
      '<div class="dam-scheme-picker__head">' +
      '<h2 id="damSchemePickerTitle">Zestawy kolorystyczne</h2>' +
      '<button type="button" class="dam-scheme-picker__close" data-scheme-picker-close aria-label="Zamknij">' +
      '<i class="uil uil-times" aria-hidden="true"></i></button></div>' +
      '<p class="dam-scheme-picker__hint">Kliknij zestaw, żeby zobaczyć go na całym panelu. Okno nie zamyka się po wyborze. Esc albo Zamknij kończy przeglądanie. Klik w tło nakładki nie zamyka okna.</p>' +
      '<div id="damSchemeGrid" class="dam-scheme-groups" role="listbox" aria-label="Zestawy kolorystyczne"></div>' +
      '<div class="dam-scheme-picker__foot">' +
      '<button type="button" data-scheme-picker-close>Zamknij</button>' +
      "</div></div>";
    document.body.appendChild(overlay);
    return overlay;
  }

  function isSchemePickerOpen() {
    var overlay = document.getElementById("damSchemePickerOverlay");
    return !!(overlay && overlay.classList.contains("is-open"));
  }

  function openSchemePicker() {
    var overlay = ensurePickerOverlay();
    renderSchemeTiles();
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    overlay.style.zIndex = "12300";
    document.body.classList.add("dam-scheme-picker-open");
    var opener = document.getElementById("damSchemeOpenPicker");
    if (opener) opener.setAttribute("aria-expanded", "true");
    var current = document.getElementById("damSchemeCurrent");
    if (current) current.setAttribute("aria-expanded", "true");
    var active = overlay.querySelector("#damSchemeGrid [data-scheme-id].is-active");
    var first = overlay.querySelector("#damSchemeGrid [data-scheme-id]");
    var focusEl = active || first || overlay.querySelector("[data-scheme-picker-close]");
    if (focusEl) focusEl.focus();
  }

  function closeSchemePicker() {
    var overlay = document.getElementById("damSchemePickerOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("dam-scheme-picker-open");
    var opener = document.getElementById("damSchemeOpenPicker");
    if (opener) opener.setAttribute("aria-expanded", "false");
    var current = document.getElementById("damSchemeCurrent");
    if (current) current.setAttribute("aria-expanded", "false");
    if (opener) opener.focus();
  }

  function renderSchemeTiles() {
    var overlay = ensurePickerOverlay();
    var grid = overlay.querySelector("#damSchemeGrid") || document.getElementById("damSchemeGrid");
    if (!grid) return;
    var mode = resolve(currentPref());
    var groups = [];
    var seen = {};
    SCHEMES.forEach(function (s) {
      if (!seen[s.group]) {
        seen[s.group] = [];
        groups.push(s.group);
      }
      seen[s.group].push(s);
    });
    grid.innerHTML = groups
      .map(function (g) {
        return (
          '<div class="dam-scheme-group" data-scheme-group="' +
          escHtml(g) +
          '"><p class="dam-scheme-group__label">' +
          escHtml(SCHEME_GROUP_LABELS[g] || g) +
          '</p><div class="dam-scheme-grid">' +
          seen[g]
            .map(function (s) {
              return tileButtonHtml(s, mode);
            })
            .join("") +
          "</div></div>"
        );
      })
      .join("");
    grid.classList.add("dam-scheme-groups");
    syncSchemeTiles();
  }

  function syncSchemeTiles() {
    renderCurrentPreview();
    var grid = document.getElementById("damSchemeGrid");
    if (!grid) return;
    var id = currentSchemeId();
    var mode = resolve(currentPref());
    grid.querySelectorAll("[data-scheme-id]").forEach(function (btn) {
      var sid = btn.getAttribute("data-scheme-id");
      var on = sid === id;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
      var scheme = getScheme(sid);
      var sw = btn.querySelector(".dam-scheme-tile__swatches");
      if (sw && scheme) sw.innerHTML = schemeSwatchHtml(scheme[mode] || scheme.light);
      var lab = btn.querySelector(".dam-scheme-tile__label");
      if (lab && scheme) lab.textContent = scheme.label;
    });
  }

  function bindSchemePicker() {
    var opener = document.getElementById("damSchemeOpenPicker");
    var current = document.getElementById("damSchemeCurrent");
    if (!opener && !current) return;
    injectSchemeCss();
    renderCurrentPreview();
    var overlay = ensurePickerOverlay();
    if (overlay.getAttribute("data-dam-scheme-bound") === "1") {
      renderSchemeTiles();
      return;
    }
    overlay.setAttribute("data-dam-scheme-bound", "1");
    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      var closer = ev.target.closest("[data-scheme-picker-close]");
      if (closer) {
        ev.preventDefault();
        closeSchemePicker();
        return;
      }
      var btn = ev.target.closest("#damSchemeGrid [data-scheme-id]");
      if (!btn) return;
      applyScheme(btn.getAttribute("data-scheme-id"));
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape") return;
      if (!isSchemePickerOpen()) return;
      ev.preventDefault();
      closeSchemePicker();
    });
    var openers = [
      document.getElementById("damSchemeOpenPicker"),
      document.getElementById("damSchemeCurrent"),
    ];
    openers.forEach(function (el) {
      if (!el || el.getAttribute("data-dam-scheme-open-bound") === "1") return;
      el.setAttribute("data-dam-scheme-open-bound", "1");
      el.setAttribute("aria-expanded", "false");
      el.addEventListener("click", function (ev) {
        ev.preventDefault();
        openSchemePicker();
      });
    });
    renderSchemeTiles();
  }

  function bindSchemeGrid() {
    bindSchemePicker();
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
    bindSchemeGrid();
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
      syncSchemeTiles();
    });
  }

  function hookAccent() {
    if (window.DamAccent) {
      DamAccent.DEFAULT = DK_ACCENT;
    }
    if (!window.DamAccent || typeof DamAccent.apply !== "function") return;
    if (DamAccent.apply._damThemeHooked) return;
    var orig = DamAccent.apply;
    DamAccent.apply = function (hex) {
      var out = orig.call(DamAccent, hex);
      if (!applyingScheme) noteAccentFromPicker(out);
      else applyTokenPaint(resolve(currentPref()), readTuning());
      return out;
    };
    DamAccent.apply._damThemeHooked = true;
  }

  function migrateDarkLadder() {
    try {
      if (localStorage.getItem(LADDER_MIGRATE_KEY) === "1") return;
      resetTuning();
      localStorage.setItem(LADDER_MIGRATE_KEY, "1");
    } catch (e) { /* ignore */ }
  }

  function boot() {
    migrateDarkLadder();
    var id = currentSchemeId();
    writeSchemeId(id === "custom" ? "custom" : id, id === "custom" ? currentNamedSchemeId() : id);
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
    SCHEME_KEY: SCHEME_KEY,
    SCHEMES: SCHEMES,
    apply: apply,
    applyScheme: applyScheme,
    currentSchemeId: currentSchemeId,
    currentNamedSchemeId: currentNamedSchemeId,
    currentPref: currentPref,
    resolve: resolve,
    boot: boot,
    readTuning: readTuning,
    setTuningValue: setTuningValue,
    resetTuning: resetTuning,
    exportProfile: exportProfile,
    collectProfileSettings: collectProfileSettings,
    bindSettings: bindSettings,
    renderSchemeTiles: renderSchemeTiles,
    syncSchemeTiles: syncSchemeTiles,
    openSchemePicker: openSchemePicker,
    closeSchemePicker: closeSchemePicker,
    isSchemePickerOpen: isSchemePickerOpen,
  };
})();
