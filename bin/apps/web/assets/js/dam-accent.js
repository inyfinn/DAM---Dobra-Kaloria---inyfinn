/**
 * Globalny kolor akcentu UI (chrome). Nie zmienia kolorow TAGOW.
 * Persist: localStorage.dam_accent (#rrggbb). Apply ASAP przed paintem.
 */
(function () {
  var KEY = "dam_accent";
  var DEFAULT = "#005A29";

  function normalizeHex(raw) {
    var s = String(raw || "").trim();
    if (!s) return DEFAULT;
    if (s.charAt(0) !== "#") s = "#" + s;
    if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
      s =
        "#" +
        s.charAt(1) +
        s.charAt(1) +
        s.charAt(2) +
        s.charAt(2) +
        s.charAt(3) +
        s.charAt(3);
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return DEFAULT;
    return s.toUpperCase();
  }

  function hexToRgb(hex) {
    var h = normalizeHex(hex).slice(1);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function apply(hex) {
    var color = normalizeHex(hex);
    var rgb = hexToRgb(color);
    var root = document.documentElement;
    root.style.setProperty("--dam-primary", color);
    root.style.setProperty("--primary-color", color);
    root.style.setProperty(
      "--primary-color-transparent",
      "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", 0.15)"
    );
    root.style.setProperty(
      "--dam-primary-rgb",
      rgb.r + " " + rgb.g + " " + rgb.b
    );
    root.setAttribute("data-dam-accent", color);
    try {
      localStorage.setItem(KEY, color);
    } catch (e) { /* ignore */ }
    return color;
  }

  function current() {
    try {
      return normalizeHex(localStorage.getItem(KEY) || DEFAULT);
    } catch (e) {
      return DEFAULT;
    }
  }

  function reset() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) { /* ignore */ }
    document.documentElement.removeAttribute("data-dam-accent");
    document.documentElement.style.removeProperty("--dam-primary");
    document.documentElement.style.removeProperty("--primary-color");
    document.documentElement.style.removeProperty("--primary-color-transparent");
    document.documentElement.style.removeProperty("--dam-primary-rgb");
    return apply(DEFAULT);
  }

  /* Boot immediately */
  apply(current());

  window.DamAccent = {
    KEY: KEY,
    DEFAULT: DEFAULT,
    apply: apply,
    current: current,
    reset: reset,
    normalize: normalizeHex,
    presets: [
      { id: "brand", label: "Dobra Kaloria", hex: "#005A29" },
      { id: "default", label: "DAM fiolet", hex: "#AB54DB" },
      { id: "ocean", label: "Ocean", hex: "#0B6E99" },
      { id: "slate", label: "Szary", hex: "#475569" },
      { id: "rose", label: "Róż", hex: "#C02675" },
      { id: "amber", label: "Bursztyn", hex: "#B45309" },
      { id: "indigo", label: "Indygo", hex: "#4F46E5" },
      { id: "teal", label: "Turkus", hex: "#0F766E" },
    ],
  };
})();
