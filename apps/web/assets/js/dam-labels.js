/**
 * DAM ETA – etykiety ludzkie (z normalize-migrated.ps1 / migracji DK↔GC)
 */
(function (global) {
  "use strict";

  /* Zgodnie z naming-dictionary.json - UI zawsze PL (nigdy FOIL/SLEEVE/CARTON) */
  var CARRIER_LABELS = {
    KAR6X: "KARTON 6x MINI",
    KAR: "KARTON",
    DOY6X: "DOYPACK 6x MINI",
    DOY: "DOYPACK",
    BAT: "BATON",
    BAR: "BATON",
    MINI: "MINI BATON",
    BIGPAK: "BIGPAK",
    OBW: "OBWOLUTA",
    TUBA: "TUBA",
    FOLIA: "FOLIA",
    FOL: "FOLIA",
    FOIL: "FOLIA",
    SASZ: "SASZETKA",
    "ETY-BUT": "ETYKIETA BUTELKA",
    "ETY-SLO": "ETYKIETA SŁOIK",
    ETY: "ETYKIETA",
    REKAW: "RĘKAW",
    SLEEVE: "RĘKAW",
    LABEL: "ETYKIETA",
    WARIANT: "WARIANT",
    WIZKA: "WIZUALIZACJE",
  };

  /* Pelne polskie znaki (2026-07-18) - "nauczylem sie" byla zasada bez diakrytykow,
     user wymaga poprawnych znakow WSZĘDZIE w projekcie. */
  var LANG_LABELS = {
    pl: "Polska",
    de: "Niemcy",
    gb: "Wielka Brytania",
    uk: "Ukraina",
    cz: "Czechy",
    sk: "Słowacja",
    hu: "Węgry",
    ro: "Rumunia",
    lt: "Litwa",
    lv: "Łotwa",
    ee: "Estonia",
    fr: "Francja",
    it: "Włochy",
    es: "Hiszpania",
    nl: "Holandia",
    ru: "Rosja",
    hr: "Chorwacja",
    si: "Słowenia",
    bg: "Bułgaria",
    at: "Austria",
    be: "Belgia",
    dk: "Dania",
    se: "Szwecja",
    no: "Norwegia",
    fi: "Finlandia",
    pt: "Portugalia",
    gr: "Grecja",
    ie: "Irlandia",
    ch: "Szwajcaria",
  };

  var UI_STRINGS = {
    multi_index_label: "Warianty",
    multi_lang_label: "Multijęzyczny",
    no_index_label: "Bez indeksu",
    demo_label: "Demo",
    mix_prefix: "MIX - ",
  };

  /* Kolejnosc: dluzsze tokeny pierwsze (KAR6X przed KAR) */
  var CARRIER_DETECT = [
    { re: /\bKAR\s*6\s*X\b|\bKAR6X\b|\bKARTON\s*6/i, code: "KAR6X" },
    { re: /\bDOY\s*6\s*X\b|\bDOY6X\b|\bDOYPACK\s*6/i, code: "DOY6X" },
    { re: /\bETY[\s\-_]?BUT|\bLAB[\s\-_]?GLASS|\bETYKIETA[\s\-]?BUTEL/i, code: "ETY-BUT" },
    { re: /\bETY[\s\-_]?SLO|\bLAB[\s\-_]?JAR|\bETYKIETA[\s\-]?S[LŁ]O/i, code: "ETY-SLO" },
    { re: /\bDOYPACK\b|\bDOY\b|\bPOUCH\b/i, code: "DOY" },
    { re: /\bKARTON\b|\bKAR\b(?!\d)/i, code: "KAR" },
    { re: /\bMINI\b/i, code: "MINI" },
    { re: /\bBATON\b|\bBAT\b|\bBAR\b/i, code: "BAT" },
    { re: /\bBIGPAK\b|\bBIG[\s\-]?PAK\b|\bBIGPACK\b/i, code: "BIGPAK" },
    { re: /\bTUBA\b|\bTUBE\b/i, code: "TUBA" },
    { re: /\bFOLIA\b|\bFOIL\b/i, code: "FOLIA" },
    { re: /\bSASZ|\bSACHET\b/i, code: "SASZ" },
    { re: /\bR[EĘ]KAW\b|\bSLEEVE\b|\bOWIJKA\b/i, code: "REKAW" },
    { re: /\bOBWOLUT|\bOBW\b/i, code: "OBW" },
    { re: /\bETYKIETA\b|\bETY\b|\bLABEL\b/i, code: "ETY" },
    { re: /\bWIZKA\b|\bWIZKI\b/i, code: "WIZKA" },
  ];

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

  function matchCarrierInText(text) {
    var s = String(text || "");
    if (!s) return "";
    for (var i = 0; i < CARRIER_DETECT.length; i++) {
      if (CARRIER_DETECT[i].re.test(s)) return CARRIER_DETECT[i].code;
    }
    return "";
  }

  function parseCarrierCode(revisionFolder) {
    var raw = String(revisionFolder || "").trim();
    if (!raw) return "UNKNOWN";
    var head = raw.split(/\s*-\s*/)[0].trim();
    // 1) Prefiks przed pierwszym " - " (FOLIA - 09.02.2024 - 6300450.00)
    var fromHead = matchCarrierInText(head);
    if (fromHead) return fromHead;
    // 2) Cala nazwa folderu (gdy nosnik jest w srodku)
    var fromAll = matchCarrierInText(raw);
    if (fromAll) return fromAll;
    // 3) Folder tylko data/indeks - nie zgaduj
    var headU = head.toUpperCase().replace(/_/g, " ");
    if (/^\d{2}\.\d{2}\.\d{4}/.test(headU) || /^\d{7}/.test(headU)) return "UNKNOWN";
    return "UNKNOWN";
  }

  /** Indeks jak extractIndexFromString() w EKSPORT WIZEK PS.jsx */
  function extractIndexFromString(source) {
    if (!source) return "";
    var s = String(source);
    s = s.replace(/1200px/gi, "_").replace(/300dpi/gi, "_").replace(/_A[0-6]/gi, "_").replace(/_v\d+/gi, "_");
    var folDot = s.match(/(FOL\d+\.\d{2})/i);
    if (folDot) return folDot[1].toUpperCase();
    var fol = s.match(/(FOL\d+)/i);
    if (fol) return fol[1].toUpperCase();
    var withDot = s.match(/(\d{5,9}\.\d{2})/g);
    if (withDot) {
      var bestD = withDot[0];
      for (var i = 1; i < withDot.length; i++) {
        if (withDot[i].length >= bestD.length) bestD = withDot[i];
      }
      return bestD;
    }
    var plain = s.match(/(\d{5,9})/g);
    if (plain) {
      var best = plain[0];
      for (var j = 1; j < plain.length; j++) {
        if (plain[j].length >= best.length) best = plain[j];
      }
      return best;
    }
    return "";
  }

  /** Meta z nazwy folderu wariantu / pliku - jak parsujDaneProduktu w EKSPORT WIZEK PS */
  function parseRevisionMeta(folderOrName, pathHint) {
    var raw = String(folderOrName || "");
    var path = String(pathHint || "");
    var brand = detectMarketFromPath(path) || "";
    var brandMatch = raw.match(/^(DK|GC|GK)\b/i) || path.match(/[\\\/](-?\s*DK|-?\s*GC)[\\\/]/i);
    if (!brand && brandMatch) {
      var b = String(brandMatch[1] || "").toUpperCase().replace(/[^A-Z]/g, "");
      brand = b === "GK" || b === "GC" ? "GC" : "DK";
    }
    if (!brand && /DOBRA\s*KALORIA|[/\\]-?\s*DK\b/i.test(path + " " + raw)) brand = "DK";
    if (!brand && /GOOD\s*CALORI|[/\\]-?\s*GC\b/i.test(path + " " + raw)) brand = "GC";

    var carrier = parseCarrierCode(raw);
    var index = extractIndexFromString(raw) || extractIndexFromString(path);
    var dateM = raw.match(/\b(\d{2})[.\s_\-](\d{2})[.\s_\-](\d{4})\b/);
    var date = "";
    if (dateM) date = dateM[3] + "-" + dateM[2] + "-" + dateM[1];
    var label = carrier !== "UNKNOWN" ? (CARRIER_LABELS[carrier] || carrier) : "";
    // Nigdy nie pokazuj "nieokreslony" gdy w nazwie jest czytelny token nosnika
    if (!label) {
      var token = headToken(raw);
      if (token && !/^\d/.test(token)) label = token;
    }
    return { brand: brand, carrier: carrier, index: index, date: date, label: label || "" };
  }

  function headToken(folder) {
    var head = String(folder || "").split(/\s*-\s*/)[0].trim();
    return head.replace(/_/g, " ").toUpperCase();
  }

  /** Prefiks nazwy pliku wizki: KAR6X-..., MINI-..., BAT-... */
  function inferCarrierFromFileName(fileName) {
    var n = String(fileName || "");
    // Prefiks kanoniczny: DK-FOLIA-... albo DK_FOLIA_...
    var m = n.match(/^(?:DK|GC)[-_]([A-Z0-9ŁłĘęÓóĄąŚśŹźŻż\-]+)[-_]/i);
    if (m) {
      var fromPref = matchCarrierInText(m[1]);
      if (fromPref) return fromPref;
    }
    return matchCarrierInText(n) || "";
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

  var CARRIER_FORBIDDEN_RE = /^(OTHER|UNKNOWN|WARIANT)$/i;

  /**
   * Zwraca "" (brak tagu) gdy typ nie jest znany - NIGDY literal "OTHER"/"UNKNOWN"/"WARIANT".
   * "Lepiej nic nie pisac, niz pisac OTHER" (2026-07-18). Zgadywanie z "?" - patrz Faza 2.
   */
  function carrierLabel(code, gramFromName, opts) {
    opts = opts || {};
    // gramFromName bywa pelna nazwa folderu - wyciagnij nosnik z niej zanim powiesz brak typu
    if ((!code || CARRIER_FORBIDDEN_RE.test(code)) && gramFromName) {
      var rescued = parseCarrierCode(gramFromName);
      if (rescued && !CARRIER_FORBIDDEN_RE.test(rescued)) code = rescued;
      else {
        var tok = headToken(gramFromName);
        // Normalizuj EN -> PL gdy token to FOIL/SLEEVE/CARTON/BAR
        var fromTok = matchCarrierInText(tok);
        if (fromTok) code = fromTok;
        else if (tok && !/^\d/.test(tok) && tok.length >= 2 && tok.length <= 24) {
          /* nie zwracaj golego EN tokenu jako typu */
          code = "UNKNOWN";
        } else {
          return "";
        }
      }
    }
    if (!code || CARRIER_FORBIDDEN_RE.test(code)) return "";
    var base = CARRIER_LABELS[code] || code;
    if (!base || CARRIER_FORBIDDEN_RE.test(base)) return "";
    var mix = opts.isMix || isMixProduct(opts.productName || gramFromName, opts.tags);
    if (mix) base = (UI_STRINGS.mix_prefix || "MIX - ") + base;
    var gramOnly = extractGram(gramFromName);
    if (!mix && gramOnly && (code === "BAT" || code === "DOY" || code === "TUBA" || code === "BAR")) {
      return base + " (" + gramOnly + ")";
    }
    var m = String(gramFromName || "").match(/(\d+)\s*[gG]/);
    if (!mix && m && (code === "BAT" || code === "BAR")) return "BATON (" + m[1] + " g)";
    return base;
  }

  function langLabel(code) {
    var c = String(code || "").toLowerCase();
    if (c === "en") c = "gb";
    if (c === "ua") c = "uk";
    return LANG_LABELS[c] || (c ? c.toUpperCase() : "");
  }

  function langShort(code) {
    var c = String(code || "").toLowerCase();
    if (c === "en") c = "gb";
    if (c === "ua") c = "uk";
    return c ? c.toUpperCase() : "";
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
    var u = String(name || "").toUpperCase()
      .replace(/Ł/g, "L")
      .replace(/Ą/g, "A")
      .replace(/Ę/g, "E")
      .replace(/Ó/g, "O")
      .replace(/Ś/g, "S")
      .replace(/Ż|Ź/g, "Z")
      .replace(/Ć/g, "C")
      .replace(/Ń/g, "N");
    if (/TYL[-_]?ENFACE|BACK[-_]?ENFACE|TYL[-_]?ENCAFE/.test(u)) return "TYL-ENFACE";
    if (/ENFACE|ENCAFE/.test(u)) return "ENFACE";
    if (/\bBACK\b|[-_]TYL([-_.]|$)|[-_]TYL$/.test(u)) return "BACK";
    if (/\bFRONT\b/.test(u)) return "FRONT";
    if (/\bSIDE\b|[-_]BOK([-_.]|$)/.test(u)) return "BOK";
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

  /** Z tlem (JPG/TIF) vs bez tla (PNG) - nadpisania z nazwy */
  function vizBackground(name) {
    var n = String(name || "");
    var u = n.toUpperCase();
    var ext = (n.split(".").pop() || "").toLowerCase();
    if (/BEZ[-_]?TLA|NO[-_]?BG|TRANSPARENT|ALPHA|CUTOUT/.test(u)) return "bez-tla";
    if (/Z[-_]?TLEM|WITH[-_]?BG|NA[-_]?TLE/.test(u)) return "z-tlem";
    if (ext === "png" || ext === "webp") return "bez-tla";
    return "z-tlem";
  }

  function vizSizeHint(size) {
    var map = {
      XL: "XL - maksymalna rozdzielczosc (archiwum / print)",
      L: "L - duza (produkcja, prezentacje)",
      S: "S - mala (web, szybki podglad)",
      "S-SKLEP": "S-SKLEP - pod sklep / marketplace"
    };
    return map[size] || (size ? size + " - wariant rozmiaru" : "Rozmiar nieoznaczony");
  }

  function vizFormatHint(ext) {
    var e = String(ext || "").toUpperCase();
    var map = {
      JPG: "JPG - ze tlem (splaszczone, RGB)",
      JPEG: "JPEG - ze tlem (splaszczone, RGB)",
      PNG: "PNG - bez tla (przezroczystosc)",
      TIF: "TIF - archiwum / druk (wysoka jakosc)",
      TIFF: "TIFF - archiwum / druk (wysoka jakosc)",
      WEBP: "WEBP - web (lekki)"
    };
    return map[e] || (e + " - format pliku");
  }

  function vizBgLabel(bg) {
    return bg === "bez-tla" ? "Bez tla" : "Z tlem";
  }

  function vizLangFromFile(f) {
    if (f && f.lang) return String(f.lang).toLowerCase();
    var u = String((f && f.name) || "").toUpperCase();
    var m = u.match(/(?:^|[-_])(PL|EN|DE|CZ|SK|HU|HR|RO|BG|LT|LV|EE|UA|RU|FR|IT|ES|NL|DK|SE|NO|FI)(?:[-_.]|$)/);
    return m ? m[1].toLowerCase() : "pl";
  }

  function fileRole(name, layer) {
    var u = String(name || "").toUpperCase();
    var ext = (u.split(".").pop() || "");
    if (ext === "AI" || ext === "PSD" || ext === "INDD") return "edytowalny";
    if (/FQ/.test(u) && ext === "PDF") return "druk";
    if (/\bPREV\b/.test(u) || /[-_]F([-_.]|$)/.test(u) && !/FQ/.test(u)) return "podglad";
    // ZIP/RAR: zwykle pakiet do druku. NIGDY wizualizacja (nawet gdy lezy w 4-WIZKI).
    if (ext === "ZIP" || ext === "RAR" || ext === "7Z") {
      if (layer === "source" && !/PAKIET|FQ|DRUK|KUBARA|PRODUKCYJ|POLZDOB/.test(u)) return "inny";
      return "druk";
    }
    if (layer === "print") return "druk";
    if (layer === "visual") return "wizualizacja";
    if (layer === "elements") return "element";
    return "inny";
  }

  /** Tylko obrazy rastra moga byc "wizualizacja" w studio / galerii. */
  function isVizImage(nameOrFile) {
    var name = typeof nameOrFile === "string"
      ? nameOrFile
      : (nameOrFile && (nameOrFile.name || nameOrFile.path)) || "";
    var ext = String(name).split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"].indexOf(ext) >= 0;
  }

  function isArchive(nameOrFile) {
    var name = typeof nameOrFile === "string"
      ? nameOrFile
      : (nameOrFile && (nameOrFile.name || nameOrFile.path)) || "";
    var ext = String(name).split(".").pop().toLowerCase();
    return ext === "zip" || ext === "rar" || ext === "7z";
  }

  function applyNamingDict(dict) {
    if (!dict || typeof dict !== "object") return;
    if (dict.carriers) {
      Object.keys(dict.carriers).forEach(function (code) {
        var c = dict.carriers[code];
        if (c && c.label_pl) CARRIER_LABELS[code] = c.label_pl;
      });
      CARRIER_LABELS.SLEEVE = CARRIER_LABELS.REKAW || "REKAW";
      CARRIER_LABELS.FOIL = CARRIER_LABELS.FOLIA || "FOLIA";
      CARRIER_LABELS.FOL = CARRIER_LABELS.FOLIA || "FOLIA";
      CARRIER_LABELS.LABEL = CARRIER_LABELS.ETY || "ETYKIETA";
      CARRIER_LABELS.BAR = CARRIER_LABELS.BAT || "BATON";
    }
    if (dict.languages) {
      Object.keys(dict.languages).forEach(function (code) {
        LANG_LABELS[code] = dict.languages[code];
      });
    }
    if (dict.ui) {
      Object.keys(dict.ui).forEach(function (k) {
        UI_STRINGS[k] = dict.ui[k];
      });
    }
    if (dict.categories && dict.categories.length) {
      CATEGORY_CANON.length = 0;
      dict.categories.forEach(function (c) {
        CATEGORY_CANON.push(c);
      });
    }
    global.DamNaming = dict;
  }

  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "data/naming-dictionary.json", false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
      applyNamingDict(JSON.parse(xhr.responseText));
    }
  } catch (e) {
    /* fallback: lokalne CARRIER_LABELS */
  }

  global.DamLabels = {
    CARRIER_LABELS: CARRIER_LABELS,
    LANG_LABELS: LANG_LABELS,
    UI_STRINGS: UI_STRINGS,
    CATEGORY_CANON: CATEGORY_CANON,
    DRUKARNIE: DRUKARNIE,
    applyNamingDict: applyNamingDict,
    stripCategoryNumber: stripCategoryNumber,
    categoryCanonId: categoryCanonId,
    categoryTitle: categoryTitle,
    cleanProductDisplayName: cleanProductDisplayName,
    isMixProduct: isMixProduct,
    isBogusRevision: isBogusRevision,
    parseCarrierCode: parseCarrierCode,
    parseRevisionMeta: parseRevisionMeta,
    extractIndexFromString: extractIndexFromString,
    matchCarrierInText: matchCarrierInText,
    inferCarrierFromFileName: inferCarrierFromFileName,
    inferCarrierFromRevision: inferCarrierFromRevision,
    carrierLabel: carrierLabel,
    langLabel: langLabel,
    langShort: langShort,
    detectMarketFromPath: detectMarketFromPath,
    extractGram: extractGram,
    detectDrukarnia: detectDrukarnia,
    vizPerspective: vizPerspective,
    vizSize: vizSize,
    vizBackground: vizBackground,
    vizSizeHint: vizSizeHint,
    vizFormatHint: vizFormatHint,
    vizBgLabel: vizBgLabel,
    vizLangFromFile: vizLangFromFile,
    fileRole: fileRole,
    isVizImage: isVizImage,
    isArchive: isArchive,
  };
})(typeof window !== "undefined" ? window : globalThis);
