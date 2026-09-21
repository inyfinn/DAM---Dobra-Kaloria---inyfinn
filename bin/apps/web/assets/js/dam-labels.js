/**
 * DAM – etykiety ludzkie (z normalize-migrated.ps1 / migracji DK↔GC)
 */
(function (global) {
  "use strict";

  /* Pelne nazwy PL w UI programu (badge, meta). Skroty DOY/BAT/FOL = tylko dysk Windows. */
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

  /* Skroty kanoniczne TYLKO do rename folderow/plikow na dysku (sciagawka nazewnictwa) */
  var CARRIER_SHORTS = {
    KAR6X: "KAR6X",
    KAR: "KAR",
    DOY6X: "DOY6X",
    DOY: "DOY",
    BAT: "BAT",
    BAR: "BAT",
    MINI: "MINI",
    BIGPAK: "BIGPAK",
    OBW: "OBW",
    TUBA: "TUBA",
    FOLIA: "FOL",
    FOL: "FOL",
    FOIL: "FOL",
    SASZ: "SASZ",
    "ETY-BUT": "ETY-BUT",
    "ETY-SLO": "ETY-SLO",
    ETY: "ETY",
    REKAW: "REKAW",
    SLEEVE: "REKAW",
    LABEL: "ETY",
    WIZKA: "WIZKA",
    SHOT: "SHOT",
  };

  /* Pelne polskie znaki (2026-07-18) - "nauczylem sie" byla zasada bez diakrytykow,
     user wymaga poprawnych znakow WSZĘDZIE w projekcie. */
  /* HARD 2026-07-21: UK/GB/EN = English = EN. Ukraina = UA (ISO), NIE UK. */
  /* HARD 2026-07-21: etykiety = nazwy JEZYKOW (Polski, Niemiecki), nie krajow. */
  var LANG_LABELS = {
    pl: "Polski",
    de: "Niemiecki",
    en: "Angielski",
    gb: "Angielski",
    ua: "Ukraiński",
    cz: "Czeski",
    sk: "Słowacki",
    hu: "Węgierski",
    ro: "Rumuński",
    lt: "Litewski",
    lv: "Łotewski",
    ee: "Estoński",
    fr: "Francuski",
    it: "Włoski",
    es: "Hiszpański",
    nl: "Holenderski",
    ru: "Rosyjski",
    hr: "Chorwacki",
    si: "Słoweński",
    bg: "Bułgarski",
    at: "Austriacki",
    be: "Belgijski",
    dk: "Duński",
    se: "Szwedzki",
    no: "Norweski",
    fi: "Fiński",
    pt: "Portugalski",
    gr: "Grecki",
    ie: "Irlandzki",
    ch: "Szwajcarski",
  };

  var UI_STRINGS = {
    multi_index_label: "Warianty",
    multi_lang_label: "Multijęzyczny",
    multi_lang_short: "Multi",
    multi_lang_synonyms: [
      "multijęzyczny",
      "multijezyczny",
      "multi",
      "wielojęzykowy",
      "wielojezykowy",
      "wiele języków",
      "wiele jezykow",
      "multilang",
      "multi-lang",
      "multi language",
    ],
    no_index_label: "Bez indeksu",
    demo_label: "Demo",
    mix_prefix: "MIX - ",
  };

  /* Z naming-dictionary.policy (+ Postgres dam_kv_store). UI=label_pl, dysk=short. */
  var CARRIER_POLICY = {
    carrier_display_in_ui: "label_pl",
    carrier_prefix_on_disk: "short",
    description_pl: "",
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
    { re: /\bFOLIA\b|\bFOIL\b|\bFOL\b(?![A-Z])/i, code: "FOLIA" },
    { re: /\bSASZ|\bSACHET\b/i, code: "SASZ" },
    { re: /\bR[EĘ]KAW\b|\bSLEEVE\b|\bOWIJKA\b/i, code: "REKAW" },
    { re: /\bOBWOLUT|\bOBW\b/i, code: "OBW" },
    { re: /\bETYKIETA\b|\bETY\b|\bLABEL\b/i, code: "ETY" },
    { re: /\bWIZKA\b|\bWIZKI\b/i, code: "WIZKA" },
  ];

  /** Klucz kanoniczny kategorii (PL) → aliasy folderów DK/GC */
  var CATEGORY_CANON = [
    { id: "BATONY", labels: ["BATONY", "BARS"], title: "Batony" },
    { id: "KULKI", labels: ["KULKI", "BALLS"], title: "Kulki" },
    { id: "ROSLINNE", labels: ["ROSLINNE", "ROŚLINNE", "PLANT BASED", "PLANT-BASED"], title: "Roślinne" },
    { id: "SYPKIE", labels: ["SYPKIE", "BREAKFAST"], title: "Sypkie" },
    { id: "NAPOJE", labels: ["NAPOJE", "DRINKS"], title: "Napoje" },
    { id: "PRZETWORY", labels: ["PRZETWORY", "SPREADS", "CREAMS", "KREMY"], title: "Przetwory" },
    { id: "DATESY", labels: ["DATESY", "DATES"], title: "Datesy" },
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
      if (CATEGORY_CANON[i].id === id) return formatTagLabel(CATEGORY_CANON[i].title, "category");
    }
    return formatTagLabel(stripCategoryNumber(folderName) || folderName, "category");
  }

  /**
   * Globalny casing tagow (UI). Kody = WERSALIKI jak w slowniku.
   * Etykiety ludzkie = jak w zdaniu (Title Case). Nie mieszac stylow.
   * kind: brand|lang|carrier|index|category|subcategory|smak|typ|opakowanie|status|flag|autor
   */
  /* Kanoniczne PL dla slugow bez diakrytykow (tagi globalne) */
  var HUMAN_TAG_FIXES = {
    niemiesne: "Niemięsne",
    napoj: "Napój",
    napoje: "Napoje",
    roslinne: "Roślinne",
    sniadaniowe: "Śniadaniowe",
    sniadanie: "Śniadanie",
  };

  function formatTagLabel(label, kind) {
    var s = String(label == null ? "" : label).trim();
    if (!s) return s;
    var k = String(kind || "").toLowerCase();
    var codeKinds = { brand: 1, lang: 1, carrier: 1, index: 1 };
    if (codeKinds[k]) return s;

    if (k === "opakowanie") {
      var pack = mapPackagingTagToCarrierLabel(s);
      if (pack) return pack;
    }

    var fixKey = s.toLocaleLowerCase("pl").replace(/[_]+/g, " ");
    if (HUMAN_TAG_FIXES[fixKey]) return HUMAN_TAG_FIXES[fixKey];

    var letters = s.replace(/[^a-zA-ZĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g, "");
    var allCaps = letters.length > 0 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
    var allLower = letters.length > 0 && letters === letters.toLowerCase();
    /* MIX zostaje WERSALIKAMI (krotki kod produktu) */
    if (k === "flag" && /^mix$/i.test(s)) return "MIX";
    if (allCaps && letters.length <= 3) return s;
    if (allCaps || allLower) return toTitleCasePl(s);
    return s;
  }

  function toTitleCasePl(s) {
    return String(s || "")
      .toLocaleLowerCase("pl")
      .replace(/(^|[\s\-_/])(\S)/g, function (_m, sep, ch) {
        return sep + ch.toLocaleUpperCase("pl");
      });
  }

  function mapPackagingTagToCarrierLabel(tag) {
    var raw = String(tag || "").trim();
    if (!raw) return "";
    var key = raw.toLowerCase().replace(/[_]+/g, " ");
    var PACK_TO_CODE = {
      doypack: "DOY",
      doy: "DOY",
      "doy 6x": "DOY6X",
      "doypack 6x": "DOY6X",
      baton: "BAT",
      bat: "BAT",
      bar: "BAT",
      "mini baton": "MINI",
      "mini batoniki": "MINI",
      mini: "MINI",
      karton: "KAR",
      "karton 6x": "KAR6X",
      folia: "FOLIA",
      foil: "FOLIA",
      fol: "FOLIA",
      rekaw: "REKAW",
      "rękaw": "REKAW",
      sleeve: "REKAW",
      bigpak: "BIGPAK",
      bigpack: "BIGPAK",
      saszetka: "SASZ",
      tuba: "TUBA",
      etykieta: "ETY",
    };
    var code = PACK_TO_CODE[key];
    if (!code) {
      var parsed = parseCarrierCode(raw);
      if (parsed && parsed !== "UNKNOWN") code = parsed;
    }
    if (!code) return "";
    return carrierLabelLong(code, code) || "";
  }

  function cleanProductDisplayName(name) {
    var s = String(name || "");
    s = s.replace(/\s*[—–-]\s*\[[^\]]*\]\s*$/u, "");
    s = s.replace(/^\s*-\s*MIX\s*-\s*/i, "");
    s = s.replace(/^\s*MIX\s*-\s*/i, "");
    s = s.replace(/^\s*-\s*/, "");
    s = s.replace(/\s+/g, " ").trim();
    /* DK-DOY-DATESY - LEMONCHEESECAKE 100 g -> Lemon Cheesecake (typ w tagach) */
    var dash = s.indexOf(" - ");
    if (dash > 0 && /^(?:DK|GC)[-_]/i.test(s.slice(0, dash)) && s.slice(0, dash).indexOf("-") >= 0) {
      s = s.slice(dash + 3).trim();
    }
    s = s.replace(/\s*\d+\s*g\b/gi, "").trim();
    s = s.replace(/\s+\d{6,8}(?:\.\d{2})?\s*$/i, "").trim();
    var letters = s.replace(/[^a-zA-ZĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g, "");
    if (letters && letters === letters.toUpperCase() && letters.length > 5 && !/\s/.test(s)) {
      var vocab = [
        "cheesecake", "lemon", "cheese", "cake", "brownie", "muffin", "burger", "sznyce", "mielone",
        "czekolada", "kakao", "malina", "banoffee", "tiramisu", "orzech", "proteina", "cytryna",
        "matcha", "porzeczka", "wanilia", "karmel", "pistacja", "truskawka", "mango", "kawa",
      ].sort(function (a, b) { return b.length - a.length; });
      var lower = s.toLowerCase().replace(/[^a-z0-9]+/g, "");
      var parts = [];
      var i = 0;
      while (i < lower.length) {
        var hit = false;
        for (var vi = 0; vi < vocab.length; vi++) {
          var v = vocab[vi];
          if (v.length >= 3 && lower.indexOf(v, i) === i) {
            parts.push(v);
            i += v.length;
            hit = true;
            break;
          }
        }
        if (hit) continue;
        var j = i + 1;
        while (j <= lower.length) {
          var next = false;
          for (var vj = 0; vj < vocab.length; vj++) {
            if (vocab[vj].length >= 3 && lower.indexOf(vocab[vj], j) === j) { next = true; break; }
          }
          if (next || j === lower.length) { parts.push(lower.slice(i, j)); i = j; break; }
          j++;
        }
      }
      if (parts.length) s = parts.map(function (p) { return toTitleCasePl(p); }).join(" ");
    } else if (s === s.toUpperCase() || s === s.toLowerCase()) {
      s = toTitleCasePl(s);
    }
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
    var label = carrier !== "UNKNOWN" ? (CARRIER_LABELS[carrier] || CARRIER_SHORTS[carrier] || carrier) : "";
    // Nigdy nie pokazuj "nieokreslony" gdy w nazwie jest czytelny token nosnika
    if (!label) {
      var token = headToken(raw);
      var fromTok = matchCarrierInText(token);
      if (fromTok) label = CARRIER_LABELS[fromTok] || CARRIER_SHORTS[fromTok] || fromTok;
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

  /* ---------------------------------------------------------------- */
  /* WYROZNIK WARIANTU                                                   */
  /*                                                                     */
  /* Konwencja nazw folderow ma juz slot na wyroznik:                    */
  /*   DOY - MAGNEZ & ZELAZO - 65 g - 24.02.2026 - 6300753.00            */
  /*   ^nosnik ^WYROZNIK       ^gram  ^data        ^indeks               */
  /* Czarna Porzeczka ma dwa doypacki 65 g z ta sama data - rozni je     */
  /* WYLACZNIE ten czlon. Indeks go nie wyodrebnial, wiec w UI obie      */
  /* pozycje wygladaly identycznie i nie dalo sie ich rozroznic.         */
  /*                                                                     */
  /* Tu zostaje to, czego NIE rozpoznajemy jako nosnik / gramature /     */
  /* date / indeks / jezyki / flage. Pusto = folder nic nie mowi i       */
  /* wtedy opis dokleja sie z DamVariantNotes (bez zmiany nazwy na dysku).*/
  /* Zamiast "wyrzuc caly czlon, jesli wyglada na smiec" - ODEJMIJ znane czesci
     w srodku czlonu. Pierwsza wersja brala "RĘKAW 180 g", "GB AR FR NL" i
     "KAR000147.00" za wyrozniki (42% rewizji), bo sprawdzala tylko caly token.
     Zasada: lepiej NIE pokazac wyroznika niz go zmyslic - brak i tak mozna
     uzupelnic recznie notatka w programie. */
  var DIST_STRIP = [
    /\b\d{6,8}(?:[.,]\d+)?\b/g,                  /* indeks 6300753.00            */
    /\b\d{4,8}X{2,}(?:[.,]\d+)?\b/gi,            /* placeholder 6300XXX.00       */
    /\b0{5,}(?:[.,]\d+)?\b/g,                    /* placeholder 000000.00        */
    /\b\d{1,4}[.\-\/ ]\d{1,2}[.\-\/ ]\d{2,4}\b/g,/* data 24.02.2026 / 18 06 2026 */
    /\bDD[ _-]?MM[ _-]?RRRR\b/gi,                /* placeholder daty             */
    /\b\d+(?:[.,]\d+)?\s?(?:g|gr|ml|kg|l|szt)\b/gi, /* gramatura 65 g / 45g      */
    /\b\d+\s?x\b/gi,                             /* 6x                           */
    /\bARCHIWUM\b/gi,
    /\b(?:SZKIC|SZKICE|PREV|PODGLAD|PODGL\u0104D|FOLDER|KOPIA|COPY|FINAL)\d*\b/gi,
    /\b(?:F|FQ|OK|NEW)\b/g,
    /\bARCHIVE\b/gi,
    /\bUNTITLED\b/gi,
    /\bBEZ[ _-]INDEKSU\b/gi,
    /\b6XMINI\b/gi,
    /\bCARTON\b/gi,
    /^(?:DK|GC)\b/gi,
    /\bfunkc\b/gi
  ];

  function distStripKnown(text) {
    var t = String(text || "").replace(/_/g, " ");
    for (var i = 0; i < DIST_STRIP.length; i++) t = t.replace(DIST_STRIP[i], " ");
    /* Nosniki: najdluzsze etykiety najpierw, zeby "KARTON 6x MINI" poszlo przed "KARTON". */
    var names = [];
    Object.keys(CARRIER_LABELS).forEach(function (k) { names.push(CARRIER_LABELS[k]); names.push(k); });
    Object.keys(CARRIER_SHORTS).forEach(function (k) { names.push(CARRIER_SHORTS[k]); names.push(k); });
    names.sort(function (a, b) { return b.length - a.length; });
    for (var j = 0; j < names.length; j++) {
      var nm = String(names[j] || "").trim();
      if (nm.length < 2) continue;
      var low = t.toLowerCase();
      var nml = nm.toLowerCase();
      var at = low.indexOf(nml);
      while (at >= 0) {
        var before = at === 0 ? " " : t.charAt(at - 1);
        var afterAt = at + nml.length;
        var after = afterAt >= t.length ? " " : t.charAt(afterAt);
        if (!/[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after)) {
          t = t.slice(0, at) + " " + t.slice(afterAt);
          low = t.toLowerCase();
          at = low.indexOf(nml);
        } else {
          at = low.indexOf(nml, at + 1);
        }
      }
    }
    return t.replace(/[\s.\-\u2013\u2014,;:]+/g, " ").trim();
  }

  /* Dwuliterowy token w nazwie folderu to zawsze kod rynku/jezyka (PL EN GB AR). */
  function distIsMeaningful(text) {
    var words = String(text || "").split(/\s+/).filter(Boolean);
    if (!words.length || words.length > 5) return false;
    var real = words.filter(function (w) { return !/^[A-Za-z]{1,2}$/.test(w); });
    if (!real.length) return false;
    var joined = real.join(" ");
    if (joined.replace(/[^A-Za-z\u00C0-\u024F\u0100-\u017F]/g, "").length < 3) return false;
    if (/\d{4,}/.test(joined)) return false;
    return true;
  }

  /** Wyroznik odczytany z nazwy folderu ("" gdy nazwa nic nie wnosi). */
  function variantDistinguisherFromFolder(folder) {
    var raw = String(folder || "").trim();
    if (!raw) return "";
    var tokens = raw.split(/\s+[-\u2013\u2014]\s+/);
    var keep = [];
    for (var i = 0; i < tokens.length; i++) {
      var cleaned = distStripKnown(tokens[i]);
      if (cleaned && distIsMeaningful(cleaned)) keep.push(cleaned);
    }
    if (!keep.length) return "";
    var out = keep.join(" \u00b7 ");
    return distIsMeaningful(out.replace(/\u00b7/g, " ")) ? out : "";
  }

  /**
   * Wyroznik rewizji + jego zrodlo.
   * source: "folder" = z dysku (nazwa mowi sama za siebie),
   *         "note"   = dopisany w programie,
   *         ""       = brak.
   */
  function variantDistinguisher(rev, noteLookup) {
    var fromFolder = variantDistinguisherFromFolder(rev && rev.folder);
    if (fromFolder) return { text: fromFolder, source: "folder" };
    var note = "";
    if (typeof noteLookup === "function") note = noteLookup(rev) || "";
    else if (typeof noteLookup === "string") note = noteLookup;
    note = String(note || "").trim();
    if (note) return { text: note, source: "note" };
    return { text: "", source: "" };
  }

  var CARRIER_FORBIDDEN_RE = /^(OTHER|UNKNOWN|WARIANT)$/i;

  /**
   * Nosnik rewizji. Kolejnosc zrodel ma znaczenie.
   *
   * Indeks liczy "carrier" przy skanowaniu dysku i zna caly kontekst produktu,
   * wiec jest to FAKT, a nie domysl. Wczesniej ta funkcja od razu skakala do
   * zgadywania z nazw plikow i dla BURGERA KLASYCZNEGO robila z osmiu rekawow
   * trzy grupy: piec folderow z plikami "WIZKA-..." ladowalo w WIZUALIZACJE,
   * folder bez wizek w WARIANT, a tylko dwa z prefiksem w folderze trafialy do
   * RĘKAW. Uzytkownik widzial typy nosnika, ktorych na dysku nie ma.
   */
  function carrierFromIndex(rev) {
    var raw = String((rev && (rev.carrier || rev.carrier_code)) || "").trim().toUpperCase();
    if (!raw || CARRIER_FORBIDDEN_RE.test(raw)) return "";
    if (CARRIER_LABELS[raw] || CARRIER_SHORTS[raw]) return raw;
    return matchCarrierInText(raw) || "";
  }

  function inferCarrierFromRevision(rev) {
    if (!rev) return "UNKNOWN";
    var indexed = carrierFromIndex(rev);
    if (indexed) return indexed;
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

  function resolveCarrierCode(code, gramFromName) {
    if ((!code || CARRIER_FORBIDDEN_RE.test(code)) && gramFromName) {
      var rescued = parseCarrierCode(gramFromName);
      if (rescued && !CARRIER_FORBIDDEN_RE.test(rescued)) return rescued;
      var tok = headToken(gramFromName);
      var fromTok = matchCarrierInText(tok);
      if (fromTok) return fromTok;
      return "UNKNOWN";
    }
    return code || "UNKNOWN";
  }

  /**
   * Skrót (DOY / BAT / FOL) - TYLKO nazewnictwo folderow/plikow na dysku (Windows).
   * W UI programu NIE uzywac jako glownej etykiety.
   */
  function carrierShort(code, gramFromName) {
    var c = resolveCarrierCode(code, gramFromName);
    if (!c || CARRIER_FORBIDDEN_RE.test(c)) return "";
    return CARRIER_SHORTS[c] || c;
  }

  /** Alias: pelna nazwa PL (DOYPACK, BATON, FOLIA). */
  function carrierLabelLong(code, gramFromName) {
    var c = resolveCarrierCode(code, gramFromName);
    if (!c || CARRIER_FORBIDDEN_RE.test(c)) return "";
    return CARRIER_LABELS[c] || CARRIER_SHORTS[c] || c;
  }

  /**
   * Etykieta UI nosnika - z policy.carrier_display_in_ui (domyslnie label_pl = DOYPACK).
   * Skrot (DOY) tylko gdy policy wymusi short LUB przy rename na dysku (bridge).
   */
  function carrierLabel(code, gramFromName, opts) {
    opts = opts || {};
    var preferShort = CARRIER_POLICY.carrier_display_in_ui === "short";
    var base = preferShort ? carrierShort(code, gramFromName) : carrierLabelLong(code, gramFromName);
    if (!base) return "";
    var mix = opts.isMix || isMixProduct(opts.productName || gramFromName, opts.tags);
    if (mix) return (UI_STRINGS.mix_prefix || "MIX - ") + base;
    if (opts.withGram && !preferShort) {
      var gramOnly = extractGram(gramFromName);
      var short = carrierShort(code, gramFromName);
      if (gramOnly && (short === "BAT" || short === "DOY" || short === "TUBA" || short === "MINI")) {
        return base + " (" + gramOnly + ")";
      }
    }
    return base;
  }

  /** Canonical market code: EN/GB/UK -> en (English). UKR -> ua. UA stays ua (Ukrainian). */
  function normalizeLangCode(code) {
    var c = String(code || "").toLowerCase().trim();
    if (!c) return "";
    if (c === "ua") return "ua";
    if (c === "en" || c === "uk" || c === "gb") return "en";
    if (c === "ukr") return "ua";
    return c;
  }

  var _LANG_CODES_ORDER = [
    "pl", "de", "en", "gb", "ua", "uk", "cz", "sk", "hu", "ro", "lt", "lv", "ee",
    "fr", "it", "es", "nl", "ru", "hr", "si", "bg", "ar",
  ];

  function parseLangsFromText(text) {
    var n = String(text || "")
      .toLowerCase()
      .replace(/\\/g, "/")
      .replace(/[^a-z0-9/_.\-\s\u2013\u2014]+/g, " ")
      .replace(/[\u2013\u2014]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!n) return [];
    var found = [];
    var seen = {};
    _LANG_CODES_ORDER.forEach(function (code) {
      var re = new RegExp("(^|[^a-z])" + code + "([^a-z]|$)");
      if (re.test(n)) {
        var mapped = normalizeLangCode(code);
        if (mapped && mapped.length === 2 && !seen[mapped]) {
          seen[mapped] = true;
          found.push(mapped);
        }
      }
    });
    return found;
  }

  function parseFolderLangs(folderName) {
    var langs = [];
    var seen = {};
    function addToken(tok) {
      var code = normalizeLangCode(tok);
      if (!code || code.length !== 2 || seen[code]) return;
      seen[code] = true;
      langs.push(code);
    }
    var parts = String(folderName || "")
      .split(" - ")
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean);
    if (!parts.length) return langs;
    var dateRe = /^\d{2}[./-]\d{2}[./-]\d{2,4}$/;
    var indexRe = /^\d{5,9}(?:\.\d{2})?$/;
    parts.forEach(function (part) {
      if (dateRe.test(part) || indexRe.test(part)) return;
      var toks = part.split(/[\s,;/]+/).filter(Boolean);
      var langOnly =
        toks.length &&
        toks.every(function (t) {
          var c = normalizeLangCode(t);
          return c && c.length === 2;
        });
      if (langOnly) {
        toks.forEach(addToken);
        return;
      }
      toks.forEach(addToken);
    });
    return langs;
  }

  function resolveRevisionLangs(revision, storedLangs) {
    var folder = (revision && (revision.folder || revision.revision_folder)) || "";
    var path = (revision && (revision.path || revision.revision_path)) || "";
    var fromFolder = parseFolderLangs(folder);
    var fromText = parseLangsFromText(folder + " " + path);
    var evidence = fromFolder.length ? fromFolder : fromText;
    if (!evidence.length && revision && revision.wizki && revision.wizki.length) {
      revision.wizki.some(function (f) {
        evidence = parseLangsFromText((f && f.name) || "");
        return evidence.length > 0;
      });
    }
    var stored = (storedLangs || [])
      .map(function (x) {
        return normalizeLangCode(x);
      })
      .filter(Boolean);
    if (!evidence.length) return stored;
    if (!stored.length) return evidence;
    var same =
      evidence.length === stored.length &&
      evidence.every(function (c) {
        return stored.indexOf(c) !== -1;
      });
    return same ? stored : evidence;
  }

  function langLabel(code) {
    var c = normalizeLangCode(code);
    if (!c || c === "?" || c === "unknown" || c === "xx") return c === "?" ? "?" : "";
    return LANG_LABELS[c] || c.toUpperCase();
  }

  function langShort(code) {
    var c = normalizeLangCode(code);
    if (!c || c === "?" || c === "unknown" || c === "xx") return "?";
    return c.toUpperCase();
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

  function vizPerspHint(persp) {
    var map = {
      ENFACE: "Przod na plasko (front en face)",
      "TYL-ENFACE": "Tyl na plasko (tyl en face)",
      FRONT: "Przod w pochyleniu - widoczny prawy bok opakowania",
      BACK: "Tyl w pochyleniu - widoczny lewy bok opakowania",
      BOK: "Widok boczny opakowania",
      INNE: "Inny widok / niestandardowy kat"
    };
    return map[persp] || persp;
  }

  function vizSizeHint(size) {
    var map = {
      XL: "XL - bez kompresji, pelna jakosc (druk / archiwum)",
      L: "L - ten sam wymiar co XL (np. 3508x2480), kompresja pod internet",
      S: "S - 1200x1200 px, skompresowana wersja web",
      "S-SKLEP": "S-SKLEP - miniatura sklepu Dobra Kaloria (848x1200 px)"
    };
    return map[size] || (size ? size + " - wariant rozmiaru" : "Rozmiar nieoznaczony");
  }

  function vizSizeTag(size) {
    var map = {
      XL: "Druk",
      L: "Internet",
      S: "Internet",
      "S-SKLEP": "Sklep"
    };
    return map[size] || "";
  }

  function vizFormatHint(ext) {
    var e = String(ext || "").toUpperCase();
    var map = {
      JPG: "JPG - biale tlo, nizsza waga (internet / sklep)",
      JPEG: "JPG - biale tlo, nizsza waga (internet / sklep)",
      PNG: "PNG - bez tla (przezroczystosc, wieksza waga)",
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
    /* Wszystkie kody z nazwy; pierwszy jako primary. Brak = "" (nie "pl"/"gb"). */
    var re = /(?:^|[-_ ])(PL|EN|GB|DE|CZ|SK|HU|HR|RO|BG|LT|LV|EE|UA|UK|RU|FR|IT|ES|NL|DK|SE|NO|FI|AR)(?:[-_. ]|$)/g;
    var m;
    var found = [];
    while ((m = re.exec(u)) !== null) {
      var c = normalizeLangCode(m[1]);
      if (c && found.indexOf(c) === -1) found.push(c);
    }
    return found.length ? found[0] : "";
  }

  function vizLangsFromFile(f) {
    if (f && Array.isArray(f.langs) && f.langs.length) {
      return f.langs.map(function (x) { return normalizeLangCode(x); }).filter(Boolean);
    }
    var u = String((f && (f.name || f.path)) || "").toUpperCase();
    var re = /(?:^|[-_ ])(PL|EN|GB|DE|CZ|SK|HU|HR|RO|BG|LT|LV|EE|UA|UK|RU|FR|IT|ES|NL|DK|SE|NO|FI|AR)(?:[-_. ]|$)/g;
    var m;
    var found = [];
    while ((m = re.exec(u)) !== null) {
      var c = normalizeLangCode(m[1]);
      if (c && found.indexOf(c) === -1) found.push(c);
    }
    return found;
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

  /* EN (GC) -> PL. Zrodlo: data/product-name-pl.json (+ KV). */
  var PRODUCT_NAME_PL = {};

  function applyProductNamePl(dict) {
    if (!dict || typeof dict !== "object") return;
    var names = dict.names || dict;
    if (!names || typeof names !== "object") return;
    Object.keys(names).forEach(function (k) {
      var key = String(k || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");
      var val = String(names[k] || "").trim();
      if (key && val) PRODUCT_NAME_PL[key] = val;
    });
  }

  function lookupProductNamePl(raw) {
    var key = String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
    if (!key) return "";
    var pl = PRODUCT_NAME_PL[key] || "";
    if (!pl || pl.toUpperCase() === key) return "";
    return pl;
  }

  /**
   * Tytul produktu w UI (PL gdy jest mapowanie EN->PL, niezaleznie od marki).
   */
  function localizedProductTitle(name, brand) {
    var raw = cleanProductDisplayName(name) || String(name || "").trim();
    if (!raw) return "";
    return lookupProductNamePl(raw) || raw;
  }

  /**
   * Polska nazwa dla angielskiego produktu (GC).
   * Pusta gdy brak mapowania albo nazwa juz PL / taka sama.
   */
  function productNamePl(name, brand) {
    var raw = cleanProductDisplayName(name) || String(name || "").trim();
    if (!raw) return "";
    return lookupProductNamePl(raw);
  }

  /** Tekst w nawiasie ze spacjami: "( Mielone )" */
  function productNamePlParen(name, brand) {
    var pl = productNamePl(name, brand);
    return pl ? "( " + pl + " )" : "";
  }

  /**
   * Markup PL pod EN: nawiasy jak meta (#8b8d97), tekst w polowie szarosci tytulu.
   * escFn - funkcja escape HTML (np. z dam-viz).
   */
  function productNamePlMarkup(name, brand, escFn) {
    var raw = cleanProductDisplayName(name) || String(name || "").trim();
    if (!raw) return "";
    var pl = lookupProductNamePl(raw);
    if (!pl) return "";
    var e = typeof escFn === "function" ? escFn : function (s) { return String(s || ""); };
    var titlePl = localizedProductTitle(raw, brand);
    /* Gdy tytul jest juz po PL — EN w nawiasie (GC). Gdy tytul EN — PL pod spodem. */
    if (titlePl === pl) {
      if (String(brand || "").toUpperCase() !== "GC") return "";
      return (
        '<br><span class="dam-viz-card__title-pl">' +
        '<span class="dam-viz-card__title-pl-paren">(</span> ' +
        '<span class="dam-viz-card__title-pl-text">' +
        e(raw) +
        "</span> " +
        '<span class="dam-viz-card__title-pl-paren">)</span>' +
        "</span>"
      );
    }
    return (
      '<br><span class="dam-viz-card__title-pl">' +
      '<span class="dam-viz-card__title-pl-paren">(</span> ' +
      '<span class="dam-viz-card__title-pl-text">' +
      e(pl) +
      "</span> " +
      '<span class="dam-viz-card__title-pl-paren">)</span>' +
      "</span>"
    );
  }

  function applyNamingDict(dict) {
    if (!dict || typeof dict !== "object") return;
    if (dict.policy && typeof dict.policy === "object") {
      if (dict.policy.carrier_display_in_ui) {
        CARRIER_POLICY.carrier_display_in_ui = String(dict.policy.carrier_display_in_ui);
      }
      if (dict.policy.carrier_prefix_on_disk) {
        CARRIER_POLICY.carrier_prefix_on_disk = String(dict.policy.carrier_prefix_on_disk);
      }
      if (dict.policy.description_pl) {
        CARRIER_POLICY.description_pl = String(dict.policy.description_pl);
      }
    }
    if (dict.carriers) {
      Object.keys(dict.carriers).forEach(function (code) {
        var c = dict.carriers[code];
        if (c && c.label_pl) CARRIER_LABELS[code] = c.label_pl;
        if (c && c.short) CARRIER_SHORTS[code] = String(c.short).toUpperCase();
        else if (!CARRIER_SHORTS[code]) CARRIER_SHORTS[code] = code;
      });
      CARRIER_LABELS.SLEEVE = CARRIER_LABELS.REKAW || "RĘKAW";
      CARRIER_LABELS.FOIL = CARRIER_LABELS.FOLIA || "FOLIA";
      CARRIER_LABELS.FOL = CARRIER_LABELS.FOLIA || "FOLIA";
      CARRIER_LABELS.LABEL = CARRIER_LABELS.ETY || "ETYKIETA";
      CARRIER_LABELS.BAR = CARRIER_LABELS.BAT || "BATON";
      CARRIER_SHORTS.SLEEVE = CARRIER_SHORTS.REKAW || "REKAW";
      CARRIER_SHORTS.FOIL = CARRIER_SHORTS.FOLIA || "FOL";
      CARRIER_SHORTS.FOL = CARRIER_SHORTS.FOLIA || "FOL";
      CARRIER_SHORTS.LABEL = CARRIER_SHORTS.ETY || "ETY";
      CARRIER_SHORTS.BAR = CARRIER_SHORTS.BAT || "BAT";
    }
    if (dict.languages) {
      Object.keys(dict.languages).forEach(function (code) {
        LANG_LABELS[code] = dict.languages[code];
      });
      /* Ensure EN label exists even if dict still has legacy gb key elsewhere */
      if (!LANG_LABELS.en && LANG_LABELS.gb) LANG_LABELS.en = LANG_LABELS.gb;
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

  try {
    var xhrPl = new XMLHttpRequest();
    xhrPl.open("GET", "data/product-name-pl.json", false);
    xhrPl.send(null);
    if (xhrPl.status >= 200 && xhrPl.status < 300 && xhrPl.responseText) {
      applyProductNamePl(JSON.parse(xhrPl.responseText));
    }
  } catch (e2) {
    /* opcjonalny slownik EN->PL */
  }

  global.DamLabels = {
    CARRIER_LABELS: CARRIER_LABELS,
    CARRIER_SHORTS: CARRIER_SHORTS,
    CARRIER_POLICY: CARRIER_POLICY,
    LANG_LABELS: LANG_LABELS,
    UI_STRINGS: UI_STRINGS,
    CATEGORY_CANON: CATEGORY_CANON,
    DRUKARNIE: DRUKARNIE,
    applyNamingDict: applyNamingDict,
    stripCategoryNumber: stripCategoryNumber,
    categoryCanonId: categoryCanonId,
    categoryTitle: categoryTitle,
    formatTagLabel: formatTagLabel,
    toTitleCasePl: toTitleCasePl,
    mapPackagingTagToCarrierLabel: mapPackagingTagToCarrierLabel,
    cleanProductDisplayName: cleanProductDisplayName,
    PRODUCT_NAME_PL: PRODUCT_NAME_PL,
    applyProductNamePl: applyProductNamePl,
    lookupProductNamePl: lookupProductNamePl,
    localizedProductTitle: localizedProductTitle,
    productNamePl: productNamePl,
    productNamePlParen: productNamePlParen,
    productNamePlMarkup: productNamePlMarkup,
    isMixProduct: isMixProduct,
    isBogusRevision: isBogusRevision,
    parseCarrierCode: parseCarrierCode,
    parseRevisionMeta: parseRevisionMeta,
    extractIndexFromString: extractIndexFromString,
    matchCarrierInText: matchCarrierInText,
    inferCarrierFromFileName: inferCarrierFromFileName,
    inferCarrierFromRevision: inferCarrierFromRevision,
    variantDistinguisherFromFolder: variantDistinguisherFromFolder,
    variantDistinguisher: variantDistinguisher,
    carrierShort: carrierShort,
    carrierLabelLong: carrierLabelLong,
    carrierLabel: carrierLabel,
    normalizeLangCode: normalizeLangCode,
    parseLangsFromText: parseLangsFromText,
    parseFolderLangs: parseFolderLangs,
    resolveRevisionLangs: resolveRevisionLangs,
    langLabel: langLabel,
    langShort: langShort,
    detectMarketFromPath: detectMarketFromPath,
    extractGram: extractGram,
    detectDrukarnia: detectDrukarnia,
    vizPerspective: vizPerspective,
    vizSize: vizSize,
    vizBackground: vizBackground,
    vizPerspHint: vizPerspHint,
    vizSizeHint: vizSizeHint,
    vizSizeTag: vizSizeTag,
    vizFormatHint: vizFormatHint,
    vizBgLabel: vizBgLabel,
    vizLangFromFile: vizLangFromFile,
    vizLangsFromFile: vizLangsFromFile,
    fileRole: fileRole,
    isVizImage: isVizImage,
    isArchive: isArchive,
  };
})(typeof window !== "undefined" ? window : globalThis);