(function () {
  "use strict";

  var queue = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function bridge() {
    if (window.DamPaths && typeof DamPaths.bridgeUrl === "function") {
      return DamPaths.bridgeUrl();
    }
    if (window.DamRuntime && typeof DamRuntime.bridgeUrl === "function") {
      return DamRuntime.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function authHeaders() {
    if (window.DamApi && typeof DamApi.authHeaders === "function") {
      return DamApi.authHeaders();
    }
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
    };
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid() {
    return "wq-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function toast(msg) {
    var el = document.createElement("div");
    el.className = "dam-int-toast";
    el.setAttribute("role", "status");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2800);
  }

  async function loadQueue(force) {
    if (queue && !force) return queue;
    try {
      var r = await fetch(bridge() + "/wykrojnik-mapping-queue", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (r.ok) {
        queue = await r.json();
        return queue;
      }
    } catch (eBridge) { /* fallback */ }
    try {
      var r2 = await fetch("data/wykrojnik-mapping-queue.json?v=" + Date.now(), {
        cache: "no-store",
      });
      if (r2.ok) {
        queue = await r2.json();
        return queue;
      }
    } catch (eFile) { /* ignore */ }
    queue = { version: 1, pending: [], resolved: [] };
    return queue;
  }

  async function postQueue(payload) {
    var r = await fetch(bridge() + "/wykrojnik-mapping-queue", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    var data = {};
    try {
      data = await r.json();
    } catch (eParse) { /* ignore */ }
    if (!r.ok || data.ok === false) {
      throw new Error(data.error || data.hint || "Zapis nie powiodl sie");
    }
    return data;
  }

  function renderPending() {
    var host = document.getElementById("damWykrojnikQueuePending");
    if (!host || !queue) return;
    var pending = queue.pending || [];
    if (!pending.length) {
      host.innerHTML = '<p class="dam-wykrojnik-queue__empty">Kolejka pusta.</p>';
      return;
    }
    host.innerHTML =
      '<table class="dam-wykrojnik-queue__table"><thead><tr>' +
      "<th>Kod</th><th>Produkt</th><th>Notatka</th><th></th></tr></thead><tbody>" +
      pending
        .map(function (it) {
          return (
            "<tr><td>" +
            esc(it.wykrojnik_kod || it.kod || "—") +
            "</td><td>" +
            esc(it.product_id || "—") +
            "</td><td>" +
            esc(it.note || "") +
            '</td><td class="dam-wykrojnik-queue__row-actions">' +
            '<button type="button" class="geex-btn geex-btn--sm geex-btn--primary-transparent" data-resolve="' +
            esc(it.id) +
            '">Rozwiazane</button> ' +
            '<button type="button" class="geex-btn geex-btn--sm" data-remove="' +
            esc(it.id) +
            '">Usun</button></td></tr>'
          );
        })
        .join("") +
      "</tbody></table>";
    host.querySelectorAll("[data-resolve]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        resolveItem(btn.getAttribute("data-resolve"));
      });
    });
    host.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        removeItem(btn.getAttribute("data-remove"));
      });
    });
  }

  function renderUnlinked(entries) {
    var host = document.getElementById("damWykrojnikQueueUnlinked");
    if (!host) return;
    var list = Object.keys(entries || {})
      .map(function (k) {
        var e = entries[k];
        e._key = k;
        return e;
      })
      .filter(function (e) {
        if ((e.linked_product_ids || []).length) return false;
        var kod = String(e.kod || e._key || "").trim();
        var nazwa = String(e.nazwa || "").trim();
        if (!kod && !nazwa) return false;
        // Placeholder z uszkodzonego importu XLSX (row-1… bez nazwy)
        if (/^row[-_]?\d+$/i.test(kod) && !nazwa) return false;
        return !!(nazwa || (/^\d{5,}/.test(kod)));
      })
      .slice(0, 30);
    if (!list.length) {
      host.innerHTML =
        '<p class="dam-wykrojnik-queue__empty">Brak oczywistych brakow w rejestrze (pierwsze 30).</p>';
      return;
    }
    host.innerHTML =
      '<ul class="dam-wykrojnik-queue__hints">' +
      list
        .map(function (e) {
          return (
            '<li><button type="button" class="dam-wykrojnik-queue__hint-btn" data-kod="' +
            esc(e.kod || e._key) +
            '">' +
            esc(e.nazwa || e.kod || e._key) +
            "</button></li>"
          );
        })
        .join("") +
      "</ul>";
    host.querySelectorAll(".dam-wykrojnik-queue__hint-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kodEl = document.getElementById("damWykrojnikQueueKod");
        if (kodEl) kodEl.value = btn.getAttribute("data-kod") || "";
      });
    });
  }

  function render() {
    renderPending();
    var status = document.getElementById("damWykrojnikQueueStatus");
    if (status && queue) {
      status.textContent =
        (queue.pending || []).length +
        " oczekujacych · ostatnia edycja: " +
        String(queue.updated_at || "—").slice(0, 19).replace("T", " ");
    }
  }

  async function addItem(kod, productId, note) {
    var item = {
      id: uid(),
      wykrojnik_kod: kod,
      product_id: productId,
      note: note || "",
      created_at: nowIso(),
    };
    await postQueue({ action: "add", item: item });
    await loadQueue(true);
    render();
    toast("Zapisano w DAM");
  }

  async function resolveItem(id) {
    if (!id) return;
    await postQueue({ action: "resolve", id: id });
    await loadQueue(true);
    render();
    toast("Zapisano w DAM");
  }

  async function removeItem(id) {
    if (!id) return;
    try {
      await postQueue({ action: "remove", id: id });
    } catch (eRemove) {
      await postQueue({ action: "resolve", id: id });
    }
    await loadQueue(true);
    render();
    toast("Zapisano w DAM");
  }

  async function boot() {
    var root = document.getElementById("damWykrojnikQueue");
    if (!root) return;
    await loadQueue();
    try {
      var reg = await fetch("data/wykrojniki-registry.json?v=" + Date.now(), {
        cache: "no-store",
      }).then(function (r) {
        return r.ok ? r.json() : { entries: {} };
      });
      renderUnlinked(reg.entries || {});
    } catch (eReg) {
      renderUnlinked({});
    }
    render();

    var form = document.getElementById("damWykrojnikQueueForm");
    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var kod = (document.getElementById("damWykrojnikQueueKod") || {}).value || "";
        var pid = (document.getElementById("damWykrojnikQueueProduct") || {}).value || "";
        var note = (document.getElementById("damWykrojnikQueueNote") || {}).value || "";
        if (!kod.trim() || !pid.trim()) return;
        addItem(kod.trim(), pid.trim(), note.trim())
          .then(function () {
            form.reset();
          })
          .catch(function (err) {
            alert(err.message || "Blad zapisu kolejki");
          });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
