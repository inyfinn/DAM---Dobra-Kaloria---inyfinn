/**
 * DAM ETA – etykiety ludzkie (z normalize-migrated.ps1 / migracji DK↔GC)
 */
(function (global) {
  "use strict";

  var CARRIER_LABELS = {
    KAR6X: "KARTON 6x MINI BATONIKI",
    KAR: "KARTON",
    DOY6X: "DOYPACK 6x MINI",
    DOY: "DOYPACK",
    BAT: "BATON",
    BAR: "BATON",
    MINI: "MINI BATONIK",
    BIGPAK: "BIGPAK",
    OBW: "OBWOLUTA",
    TUBA: "TUBA",
    "ETY-BUT": "ETYKIETA BUTELKA",
    "ETY-SLO": "ETYKIETA SŁOIK",
    ETY: "ETYKIETA",
    REKAW: "RĘKAW / OWIJKA",
    WARIANT: "WARIANT",
    WIZKA: "WIZUALIZACJE",
  };

  /** Klucz kanoniczny kategorii (PL) → aliasy folderów DK/GC */
  var CATEGORY_CANON = [
    { id: "BATONY", labels: ["BATONY", "BARS"], title: "BATONY" },
    { id: "KULKI", labels: ["KULKI", "BALLS"], title: "KULKI" },
    { id: "ROSLINNE", labels: ["ROSLINNE", "ROŚLINNE", "PLANT BASED", "PLANT-BASED"], title: "ROŚLINNE" },
    { id: "SYPKIE", labels: ["SYPKIE", "BREAKFAST"], title: "SYPKIE" },
    { id: "NAPOJE", labels: ["NAPOJE", "DRINKS"], title: "NAPOJE" },
    { id: "PRZETWORY", labels: ["PRZETWORY", "SPREADS", "CREAMS", "KREMY"], title: "PRZETWORY" },
    { id: "DATESY", labels: ["DATESY", "DATES"], title: "DATESY" },
  ];

  var DRUKARNIE = ["POLZDOB", "CONGRAPH", "MULTIPOL", "FOLDRUK", "KUBARA"];

  function stripCategoryNumber(name) {
    return String(name || "")
      .replace(/^\s*\d+\s*[-–—]\s*/u, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function categoryCanonId(folderName) {
    var bare = stripCategoryNumber(folderName).toUpperCase();
    for (var i = 0; i < CATEGORY_CANON.length; i++) {
      var c = CATEGORY_CANON[i];
      for (var j = 0; j < c.labels.length; j++) {
        if (bare === c.labels[j].toUpperCase() || bare.indexOf(c.labels[j].toUpperCase()) === 0) {
          return c.id;
        }
      }
    }
    return bare || "INNE";
  }

  function categoryTitle(folderName) {
    var id = categoryCanonId(folderName);
    for (var i = 0; i < CATEGORY_CANON.length; i++) {
      if (CATEGORY_CANON[i].id === id) return CATEGORY_CANON[i].title;
    }
    return stripCategoryNumber(folderName) || folderName;
  }

  function cleanProductDisplayName(name) {
    var s = String(name || "");
    s = s.replace(/\s*[—–-]\s*\[[^\]]*\]\s*$/u, "");
    s = s.replace(/^\s*-\s*MIX\s*-\s*/i, "");
    s = s.replace(/^\s*MIX\s*-\s*/i, "");
    s = s.replace(/^\s*-\s*/, "");
    return s.replace(/\s+/g, " ").trim() || name;
  }

  function isMixProduct(name, tags) {
    var n = String(name || "");
    if (/\bMIX\b/i.test(n) || /^\s*-\s*MIX/i.test(n)) return true;
    if (Array.isArray(tags) && tags.some(function (t) { return String(t).toLowerCase() === "mix"; })) return true;
    return false;
  }

  function isBogusRevision(folderName) {
    var n = String(folderName || "").toUpperCase();
    if (/ELEMENTY\s+Z\s+OPAKOWA/.test(n)) return true;
    if (/^-\s*ELEMENTY/.test(n)) return true;
    if (/^0\s*-\s*ARCHIWUM/.test(n)) return true;
    if (/KONFLIKTY/.test(n) && !/\d{7}/.test(n)) return true;
    return false;
  }

  function parseCarrierCode(revisionFolder) {
    var head = String(revisionFolder || "").split(/\s*-\s*/)[0].trim().toUpperCase();
    head = head.replace(/_/g, " ");
    if (/^KAR6X\b/.test(head) || /^KARTON\s*6/.test(head)) return "KAR6X";
    if (/^DOY6X\b/.test(head) || /^DOYPACK\s*6/.test(head)) return "DOY6X";
    if (/^KAR\b/.test(head) || /^KARTON\b/.test(head)) return "KAR";
    if (/^DOY\b/.test(head) || /^DOYPACK\b/.test(head)) return "DOY";
    if (/^MINI\b/.test(head)) return "MINI";
    if (/^BAT\b/.test(head) || /^BATON\b/.test(head) || /^BAR\b/.test(head)) return "BAT";
    if (/^BIGPAK\b/.test(head) || /^BIGPACK\b/.test(head)) return "BIGPAK";
    if (/^TUBA\b/.test(head) || /^TUBE\b/.test(head)) return "TUBA";
    if (/^OBW/.test(head)) return "OBW";
    if (/^ETY/.test(head) || /^LABEL/.test(head)) return "ETY";
    // KRYTYCZNE: folder tylko data/indeks (np. "13.02.2025 - 6300622.00") - NIE zgaduj BATON
    if (/^\d{2}\.\d{2}\.\d{4}/.test(head) || /^\d{7}/.test(head)) return "UNKNOWN";
    return "UNKNOWN";
  }

  /** Prefiks nazwy pliku wizki: KAR6X-..., MINI-..., BAT-... */
  function inferCarrierFromFileName(fileName) {
    var n = String(fileName || "").toUpperCase();
    if (/^KAR6X[-_]/.test(n) || /KARTON\s*6/.test(n)) return "KAR6X";
    if (/^DOY6X[-_]/.test(n)) return "DOY6X";
    if (/^MINI[-_]/.test(n)) return "MINI";
    if (/^BAT[-_]/.test(n) || /^BATON[-_]/.test(n) || /^BAR[-_]/.test(n)) return "BAT";
    if (/^DOY[-_]/.test(n) || /^DOYPACK[-_]/.test(n)) return "DOY";
    if (/^KAR[-_]/.test(n) || /^KARTON[-_]/.test(n)) return "KAR";
    if (/^TUBA[-_]/.test(n) || /^TUBE[-_]/.test(n)) return "TUBA";
    if (/^BIGPAK[-_]/.test(n)) return "BIGPAK";
    return "";
  }

  function inferCarrierFromRevision(rev) {
    if (!rev) return "UNKNOWN";
    var fromFolder = parseCarrierCode(rev.folder);
    if (fromFolder && fromFolder !== "UNKNOWN") return fromFolder;
    var files = [];
    if (rev.files_by_role && rev.files_by_role.viz) files = files.concat(rev.files_by_role.viz);
    if (rev.wizki) files = files.concat(rev.wizki);
    for (var i = 0; i < files.length; i++) {
      var code = inferCarrierFromFileName(files[i].name || files[i].file || "");
      if (code) return code;
    }
    return "UNKNOWN";
  }

  function carrierLabel(code, gramFromName) {
    if (code === "UNKNOWN" || !code) {
      return "Nosnik nieokreslony";
    }
    var base = CARRIER_LABELS[code] || code || "WARIANT";
    if (gramFromName && (code === "BAT" || code === "DOY" || code === "TUBA")) {
      return base + " (" + gramFromName + ")";
    }
    var m = String(gramFromName || "").match(/(\d+)\s*[gG]/);
    if (m && (code === "BAT" || code === "BAR")) return "BATON (" + m[1] + " g)";
    return base;
  }

  /** PL vs eksport z kanonicznej sciezki indeksu */
  function detectMarketFromPath(path) {
    var p = String(path || "").replace(/\\/g, "/").toUpperCase();
    if (p.indexOf("/- EKSPORT") !== -1 || p.indexOf("/-EKSPORT") !== -1 || /\/-?\s*GC\b/.test(p) || p.indexOf("/GC/") !== -1) {
      return "GC";
    }
    if (p.indexOf("/- POLSKA") !== -1 || p.indexOf("/-POLSKA") !== -1 || p.indexOf("/- DK") !== -1) {
      return "DK";
    }
    return "";
  }

  function extractGram(folderName) {
    var m = String(folderName || "").match(/(\d+)\s*[gG]\b/);
    return m ? m[1] + " g" : "";
  }

  function detectDrukarnia(text) {
    var u = String(text || "").toUpperCase();
    for (var i = 0; i < DRUKARNIE.length; i++) {
      if (u.indexOf(DRUKARNIE[i]) >= 0) return DRUKARNIE[i];
    }
    return "";
  }

  function vizPerspective(name) {
    var u = String(name || "").toUpperCase().replace(/Ł/g, "L");
    if (/TYL[-_]?ENFACE|BACK[-_]?ENFACE|TYL[-_]?ENCAFE/.test(u)) return "TYL-ENFACE";
    if (/ENFACE|ENCAFE/.test(u)) return "ENFACE";
    if (/\bBACK\b|\bTYL\b/.test(u)) return "BACK";
    if (/\bFRONT\b/.test(u)) return "FRONT";
    return "INNE";
  }

  function vizSize(name) {
    var u = String(name || "").toUpperCase();
    if (/S[-_]?SKLEP|SKLEP/.test(u)) return "S-SKLEP";
    if (/(^|[-_])XL([-_.]|$)/.test(u)) return "XL";
    if (/(^|[-_])L([-_.]|$)/.test(u) && !/XL/.test(u)) return "L";
    if (/(^|[-_])S([-_.]|$)/.test(u)) return "S";
    return "";
  }

  function fileRole(name, layer) {
    var u = String(name || "").toUpperCase();
    var ext = (u.split(".").pop() || "");
    if (ext === "AI" || ext === "PSD" || ext === "INDD") return "edytowalny";
    if (/FQ/.test(u) && ext === "PDF") return "druk";
    if (/\bPREV\b/.test(u) || /[-_]F([-_.]|$)/.test(u) && !/FQ/.test(u)) return "podglad";
    if (ext === "ZIP" || layer === "print") return "druk";
    if (layer === "visual") return "wizualizacja";
    if (layer === "elements") return "element";
    return "inny";
  }

  global.DamLabels = {
    CARRIER_LABELS: CARRIER_LABELS,
    CATEGORY_CANON: CATEGORY_CANON,
    DRUKARNIE: DRUKARNIE,
    stripCategoryNumber: stripCategoryNumber,
    categoryCanonId: categoryCanonId,
    categoryTitle: categoryTitle,
    cleanProductDisplayName: cleanProductDisplayName,
    isMixProduct: isMixProduct,
    isBogusRevision: isBogusRevision,
    parseCarrierCode: parseCarrierCode,
    inferCarrierFromFileName: inferCarrierFromFileName,
    inferCarrierFromRevision: inferCarrierFromRevision,
    carrierLabel: carrierLabel,
    detectMarketFromPath: detectMarketFromPath,
    extractGram: extractGram,
    detectDrukarnia: detectDrukarnia,
    vizPerspective: vizPerspective,
    vizSize: vizSize,
    fileRole: fileRole,
  };
})(typeof window !== "undefined" ? window : globalThis);
