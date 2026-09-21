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

  var STORE = { notes: {} };
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

  global.DamVariantNotes = {
    noteKey: noteKey,
    get: get,
    forRevision: forRevision,
    setLocal: setLocal,
    load: load,
    save: save,
    all: function () { return STORE.notes; }
  };
})(typeof window !== "undefined" ? window : this);
