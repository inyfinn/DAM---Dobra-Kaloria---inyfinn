/* DAM - skad jest lista materialow (baza / lokalny skan) i z kiedy.
 *
 * 2026-09-22: komputer bez folderu Marketing pokazywal materialy ze skanu z 14.09, nie
 * mowiac o tym ani slowa. Teraz lista przychodzi z indeksu w bazie (dam_index_snapshots),
 * a przy liczniku widac zrodlo i date. Admin na komputerze z folderem ma przycisk
 * "Wyslij indeks do bazy", zeby nie czekac na automat (co 10 min).
 *
 * API: window.DamIndexSource = { decorate(el, key), mountPublishButton(afterEl) }
 * key: "branding-search-index" | "file-index". Dane tylko przez textContent.
 */
(function () {
  "use strict";

  var _pending = null;
  var _data = null;

  function bridge() {
    if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
      return String(window.DamRuntime.bridgeUrl()).replace(/\/$/, "");
    }
    return "http://127.0.0.1:8766";
  }

  function load(force) {
    if (_pending && !force) return _pending;
    _pending = fetch(bridge() + "/index/snapshots", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { _data = d && d.ok ? d : null; return _data; })
      .catch(function () { return null; });
    return _pending;
  }

  function fmtDate(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return "";
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function describe(key) {
    var k = _data && _data.keys && _data.keys[key];
    if (!k) return "";
    if (k.source === "db") {
      var who = k.built_by ? ", " + k.built_by : "";
      return "indeks z bazy: " + fmtDate(k.built_at) + who;
    }
    if (k.db_built_at) return "indeks lokalny (w bazie: " + fmtDate(k.db_built_at) + ")";
    return "indeks lokalny - baza nie ma nowszego";
  }

  function decorate(el, key) {
    if (!el) return;
    var old = el.querySelector(".dam-index-source");
    if (old) old.remove();
    load(false).then(function () {
      var text = describe(key);
      if (!text || !el.isConnected) return;
      var prev = el.querySelector(".dam-index-source");
      if (prev) prev.remove();
      var span = document.createElement("span");
      span.className = "dam-index-source";
      span.textContent = " · " + text;
      el.appendChild(span);
    });
  }

  function isAdmin() {
    try {
      var role =
        (window.DamApi && typeof window.DamApi.role === "function" && window.DamApi.role()) ||
        localStorage.getItem("dam_role") || "";
      return String(role).toLowerCase() === "admin";
    } catch (_e) {
      return false;
    }
  }

  function mountPublishButton(afterEl) {
    if (!afterEl || !afterEl.parentNode || !isAdmin()) return;
    if (document.getElementById("damIndexPublish")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "damIndexPublish";
    btn.className = afterEl.className || "dam-int-cta";
    btn.textContent = "Wyślij indeks do bazy";
    btn.title = "Wyślij aktualny skan folderu Marketing do bazy - inne komputery pobiorą go w ciągu kilku minut.";
    btn.addEventListener("click", function () {
      btn.disabled = true;
      btn.textContent = "Wysyłam…";
      fetch(bridge() + "/index/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
        },
        body: "{}",
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          btn.disabled = false;
          if (res && res.ok) {
            var n = (res.published || []).length;
            btn.textContent = n ? "Wysłano do bazy" : "Baza ma już ten indeks";
            load(true);
          } else {
            btn.textContent = "Wyślij indeks do bazy";
            window.alert((res && res.hint) || "Nie udało się wysłać indeksu: " + ((res && res.error) || "błąd"));
          }
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = "Wyślij indeks do bazy";
        });
    });
    afterEl.parentNode.insertBefore(btn, afterEl.nextSibling);
  }

  window.DamIndexSource = { decorate: decorate, mountPublishButton: mountPublishButton, reload: function () { return load(true); } };
})();
