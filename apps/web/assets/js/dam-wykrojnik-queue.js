(function () {
  "use strict";

  var LS_KEY = "dam-wykrojnik-queue-draft";
  var queue = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid() {
    return "wq-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  async function loadQueue() {
    if (queue) return queue;
    try {
      var r = await fetch("data/wykrojnik-mapping-queue.json?v=" + Date.now(), { cache: "no-store" });
      if (r.ok) {
        queue = await r.json();
        return queue;
      }
    } catch (e) { /* fallback */ }
    try {
      var draft = localStorage.getItem(LS_KEY);
      if (draft) {
        queue = JSON.parse(draft);
        return queue;
      }
    } catch (e2) { /* ignore */ }
    queue = { version: 1, pending: [], resolved: [] };
    return queue;
  }

  function saveDraft() {
    if (!queue) return;
    queue.updated_at = nowIso();
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(queue));
    } catch (e) { /* quota */ }
    render();
  }

  function downloadJson() {
    if (!queue) return;
    var blob = new Blob([JSON.stringify(queue, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wykrojnik-mapping-queue.json";
    a.click();
    URL.revokeObjectURL(a.href);
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
            '</td><td><button type="button" class="geex-btn geex-btn--sm" data-resolve="' +
            esc(it.id) +
            '">Rozwiązane</button></td></tr>'
          );
        })
        .join("") +
      "</tbody></table>";
    host.querySelectorAll("[data-resolve]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        resolveItem(btn.getAttribute("data-resolve"));
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
        return !(e.linked_product_ids || []).length && (e.nazwa || e.kod);
      })
      .slice(0, 30);
    if (!list.length) {
      host.innerHTML = '<p class="dam-wykrojnik-queue__empty">Brak oczywistych braków w rejestrze (pierwsze 30).</p>';
      return;
    }
    host.innerHTML =
      '<ul class="dam-wykrojnik-queue__hints">' +
      list
        .map(function (e) {
          return (
            "<li><button type=\"button\" class=\"dam-wykrojnik-queue__hint-btn\" data-kod=\"" +
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
        " oczekujących · ostatnia edycja: " +
        String(queue.updated_at || "—").slice(0, 19).replace("T", " ");
    }
  }

  function addItem(kod, productId, note) {
    if (!queue) return;
    queue.pending = queue.pending || [];
    queue.pending.push({
      id: uid(),
      wykrojnik_kod: kod,
      product_id: productId,
      note: note || "",
      created_at: nowIso(),
    });
    saveDraft();
  }

  function resolveItem(id) {
    if (!queue || !id) return;
    var pending = [];
    var resolved = queue.resolved || [];
    (queue.pending || []).forEach(function (it) {
      if (String(it.id) === String(id)) {
        it.resolved_at = nowIso();
        resolved.push(it);
      } else {
        pending.push(it);
      }
    });
    queue.pending = pending;
    queue.resolved = resolved;
    saveDraft();
  }

  async function boot() {
    var root = document.getElementById("damWykrojnikQueue");
    if (!root) return;
    await loadQueue();
    try {
      var reg = await fetch("data/wykrojniki-registry.json?v=" + Date.now(), { cache: "no-store" }).then(function (r) {
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
        addItem(kod.trim(), pid.trim(), note.trim());
        form.reset();
      });
    }

    var dl = document.getElementById("damWykrojnikQueueDownload");
    if (dl) dl.addEventListener("click", downloadJson);

    var clr = document.getElementById("damWykrojnikQueueClearDraft");
    if (clr) {
      clr.addEventListener("click", function () {
        localStorage.removeItem(LS_KEY);
        location.reload();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
