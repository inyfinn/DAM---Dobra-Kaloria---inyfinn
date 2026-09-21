/**
 * DAM - opisy wariantow (notatki obok indeksu).
 *
 * Po samym indeksie nikt nie wie, czym rozni sie 6300631 od 6300569. Notatka
 * ("GRILL", "Zelazo, Magnez, Witamina E") jest doklejana w UI obok indeksu
 * i NIE zmienia nazwy folderu na dysku - nazwa folderu zostaje data + indeks.
 *
 * Klucz = sam indeks bez ".00" (firma wycofuje sie z tej koncowki), wiec ten
 * sam opis obowiazuje dla "6300631" i "6300631.00".
 *
 * Zrodlo: data/variant-notes.json, mirror w SQLite/PG przez KV_STORE_KEYS.
 */
(function (global) {
  "use strict";

  var STORE = { notes: {}, tags: {}, suggestions: [] };
  var loaded = null;

  function noteKey(raw) {
    var txt = String(raw == null ? "" : raw).trim();
    if (!txt) return "";
    var m = txt.match(/(\d{6,8})(?:\.\d+)?/);
    return m ? m[1] : "";
  }

  function get(raw) {
    var k = noteKey(raw);
    if (!k) return "";
    var entry = STORE.notes[k];
    if (!entry) return "";
    return typeof entry === "string" ? entry : String(entry.note || "");
  }

  /** Notatka dla rewizji: index ma pierwszenstwo, folder/sciezka jako zapas. */
  function forRevision(rev) {
    if (!rev) return "";
    return get(rev.index || rev.index_rev) || get(rev.folder) || get(rev.path);
  }

  function setLocal(raw, note) {
    var k = noteKey(raw);
    if (!k) return "";
    var text = String(note == null ? "" : note).replace(/\s+/g, " ").trim().slice(0, 120);
    if (text) STORE.notes[k] = { note: text };
    else delete STORE.notes[k];
    return text;
  }

  /* Podpowiedzi = to, czego juz uzyto (czesciej uzyte wyzej) + tagi ze slownika. */
  function buildSuggestions() {
    var counts = {};
    Object.keys(STORE.notes).forEach(function (k) {
      var txt = String((STORE.notes[k] || {}).note || "").trim();
      if (!txt) return;
      var key = normTag(txt);
      if (!counts[key]) counts[key] = { tag: txt, uses: 0 };
      counts[key].uses += 1;
    });
    Object.keys(STORE.tags).forEach(function (k) {
      if (!counts[normTag(k)]) counts[normTag(k)] = { tag: k, uses: 0 };
    });
    return Object.keys(counts).map(function (k) { return counts[k]; })
      .sort(function (a, b) {
        if (b.uses !== a.uses) return b.uses - a.uses;
        return a.tag.toLowerCase().localeCompare(b.tag.toLowerCase());
      });
  }

  function bridgeBase() {
    if (global.DamRuntime && typeof global.DamRuntime.bridgeUrl === "function") {
      return global.DamRuntime.bridgeUrl();
    }
    if (global.DamPaths && typeof global.DamPaths.bridgeUrl === "function") {
      return global.DamPaths.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function load(force) {
    if (loaded && !force) return loaded;
    loaded = fetch("data/variant-notes.json?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && typeof data.notes === "object" && data.notes) STORE.notes = data.notes;
        if (data && typeof data.tags === "object" && data.tags) STORE.tags = data.tags;
        STORE.suggestions = buildSuggestions();
        return STORE;
      })
      .catch(function () { return STORE; });
    return loaded;
  }

  /** Zapis przez most; lokalny stan aktualizujemy dopiero po potwierdzeniu. */
  function save(raw, note) {
    var k = noteKey(raw);
    if (!k) return Promise.resolve({ ok: false, error: "index_required" });
    return fetch(bridgeBase() + "/variant-note", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index: k, note: String(note == null ? "" : note) })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) setLocal(k, res.note || "");
        return res || { ok: false };
      })
      .catch(function (err) { return { ok: false, error: String(err && err.message || err) }; });
  }

  /* ------------------------------------------------------------------ *
   * SEZON
   *
   * Wariant poza sezonem JEST aktualny - grill w styczniu nie przestaje byc
   * zatwierdzona wersja opakowania. Nie jest tylko teraz w obiegu. Dlatego
   * sezon NIE kasuje statusu, tylko dokleja "poza sezonem", a UI przestaje
   * liczyc taki wariant jako aktualny w domyslnym widoku.
   *
   * Sezon nalezy do TAGU, nie do wariantu: definiujesz raz "GRILL = V-IX",
   * a dziedziczy to kazdy wariant tak opisany.
   *
   * Zakres moze przechodzic przez Nowy Rok (11 -> 2 = listopad..luty).
   * ------------------------------------------------------------------ */
  var MONTHS_PL = ["stycznia","lutego","marca","kwietnia","maja","czerwca",
                   "lipca","sierpnia","wrzesnia","pazdziernika","listopada","grudnia"];

  function normTag(name) {
    return String(name == null ? "" : name).replace(/\s+/g, " ").trim().toUpperCase();
  }

  function seasonFor(noteText) {
    var t = STORE.tags[normTag(noteText)];
    var se = t && t.season;
    if (!se) return null;
    var f = parseInt(se.from, 10), to = parseInt(se.to, 10);
    if (!(f >= 1 && f <= 12 && to >= 1 && to <= 12)) return null;
    return { from: f, to: to };
  }

  function monthInSeason(month, season) {
    if (!season) return true;
    if (season.from <= season.to) return month >= season.from && month <= season.to;
    /* Zakres przez Nowy Rok: listopad..luty. */
    return month >= season.from || month <= season.to;
  }

  function seasonLabel(season) {
    if (!season) return "";
    return "sezon: " + MONTHS_PL[season.from - 1] + " - " + MONTHS_PL[season.to - 1];
  }

  /** {inSeason, season, label} dla podanego opisu. now = do testow. */
  function seasonState(noteText, now) {
    var season = seasonFor(noteText);
    if (!season) return { inSeason: true, season: null, label: "" };
    var d = now instanceof Date ? now : new Date();
    return {
      inSeason: monthInSeason(d.getMonth() + 1, season),
      season: season,
      label: seasonLabel(season)
    };
  }

  function suggestions() {
    return (STORE.suggestions || []).slice();
  }

  global.DamVariantNotes = {
    normTag: normTag,
    seasonFor: seasonFor,
    monthInSeason: monthInSeason,
    seasonLabel: seasonLabel,
    seasonState: seasonState,
    suggestions: suggestions,
    noteKey: noteKey,
    get: get,
    forRevision: forRevision,
    setLocal: setLocal,
    load: load,
    save: save,
    all: function () { return STORE.notes; }
  };
})(typeof window !== "undefined" ? window : this);
