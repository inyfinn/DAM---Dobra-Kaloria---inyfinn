/**
 * DAM - Faktury: bridge GET /finance/invoices + import/export ERP + lista Asana.
 */
(function () {
  "use strict";

  var STATUS_LABELS = {
    paid: "Opłacona",
    pending: "Oczekuje",
    overdue: "Po terminie",
  };
  var STATUS_CLASSES = {
    paid: "dam-int-chip dam-int-st dam-int-st--ok",
    pending: "dam-int-chip dam-int-st dam-int-st--wait",
    overdue: "dam-int-chip dam-int-st dam-int-st--danger",
  };

  var allInvoices = [];
  var currentFilter = "all";
  var source = "local";
  var erpSync = null;

  function bridgeUrl() {
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
      Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
      Accept: "application/json",
    };
  }

  function isAdmin() {
    var role = (localStorage.getItem("dam_role") || "").toLowerCase();
    return role === "admin" || role === "power_user";
  }

  function ensureCtaStyles() {
    /* Visual anatomy lives in assets/css/dam-invoices.css + dam-ui-cta.js */
    if (window.DamUiCta && typeof DamUiCta.ensureStyles === "function") {
      DamUiCta.ensureStyles();
    }
  }

  function formatDate(str) {
    if (!str) return "-";
    try {
      var d = new Date(str);
      return d.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return str;
    }
  }

  function formatDateTime(str) {
    if (!str) return "-";
    try {
      var d = new Date(str);
      return d.toLocaleString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return str;
    }
  }

  function formatPLN(val) {
    return (
      (Number(val) || 0).toLocaleString("pl-PL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " PLN"
    );
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateSourceBadge() {
    var el = document.getElementById("invSourceBadge");
    if (!el) return;
    el.textContent =
      source === "bridge"
        ? "Źródło: bridge · " + allInvoices.length + " faktur"
        : "Snapshot lokalny · " + allInvoices.length + " faktur";
    el.className =
      "dam-int-chip dam-int-st " +
      (source === "bridge" ? "dam-int-st--ok" : "dam-int-st--wait");
  }

  function renderErpSync(sync) {
    erpSync = sync || null;
    var badge = document.getElementById("invErpStatusBadge");
    var meta = document.getElementById("invErpSyncMeta");
    var status = (sync && sync.status) || "idle";
    var direction = (sync && sync.direction) || "bidirectional";
    var statusLabel =
      status === "ok"
        ? "OK"
        : status === "error"
          ? "Błąd"
          : status === "idle"
            ? "Bezczynny"
            : status;
    if (badge) {
      badge.textContent = "ERP: " + statusLabel + " · " + (direction === "bidirectional" ? "↔" : direction);
      badge.className =
        "dam-int-chip dam-int-st " +
        (status === "ok"
          ? "dam-int-st--ok"
          : status === "error"
            ? "dam-int-st--danger"
            : "dam-int-st--wait");
      badge.title =
        "Provider: " +
        ((sync && sync.erp_provider) || "stub") +
        " · import: ERP→DAM · export: DAM→ERP";
    }
    if (meta) {
      meta.textContent =
        "Kierunek: dwukierunkowy (ERP ↔ DAM). Ostatni import: " +
        formatDateTime(sync && sync.last_import) +
        " · Ostatni eksport: " +
        formatDateTime(sync && sync.last_export) +
        (sync && sync.last_error ? " · Błąd: " + sync.last_error : "");
    }
  }

  function loadErpStatus() {
    return fetch(bridgeUrl() + "/finance/invoices/erp-status", {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("bridge");
        return r.json();
      })
      .then(function (data) {
        renderErpSync(data);
      })
      .catch(function () {
        return fetch("data/invoice-erp-sync.json?v=" + Date.now(), {
          cache: "no-store",
        })
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .then(function (data) {
            if (data) renderErpSync(data);
            else renderErpSync({ status: "idle", direction: "bidirectional" });
          })
          .catch(function () {
            renderErpSync({ status: "idle", direction: "bidirectional" });
          });
      });
  }

  function renderTable(invoices) {
    var tbody = document.getElementById("invTableBody");
    if (!tbody) return;
    var filtered =
      currentFilter === "all"
        ? invoices
        : invoices.filter(function (inv) {
            return inv.status === currentFilter;
          });

    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">Brak faktur</td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map(function (inv) {
        var statusLabel = STATUS_LABELS[inv.status] || inv.status;
        var statusClass = STATUS_CLASSES[inv.status] || "";
        var isOverdue = inv.status === "overdue";
        return (
          "<tr>" +
          '<td style="font-weight:500;white-space:nowrap">' +
          escapeHtml(inv.id) +
          "</td>" +
          "<td>" +
          '<div style="font-weight:500">' +
          escapeHtml(inv.project || "-") +
          "</div>" +
          '<div style="font-size:11px;color:#888">' +
          escapeHtml(inv.type || inv.client || "") +
          "</div>" +
          "</td>" +
          '<td style="font-weight:600;white-space:nowrap;color:#AB54DB">' +
          formatPLN(inv.amount) +
          "</td>" +
          '<td style="white-space:nowrap">' +
          formatDate(inv.issue_date) +
          "</td>" +
          '<td style="white-space:nowrap;color:' +
          (isOverdue ? "#ff5653" : "inherit") +
          '">' +
          formatDate(inv.due_date) +
          "</td>" +
          '<td><span class="' +
          statusClass +
          '">' +
          escapeHtml(statusLabel) +
          "</span></td>" +
          "</tr>"
        );
      })
      .join("");
    if (window.DamGridReveal && window.DamGridReveal.revealRows) {
      window.DamGridReveal.revealRows(tbody, "tr");
    }
  }

  function updateSummary(invoices) {
    var total = invoices.length;
    var paid = invoices.filter(function (i) {
      return i.status === "paid";
    }).length;
    var pending = invoices.filter(function (i) {
      return i.status === "pending";
    }).length;
    var overdue = invoices.filter(function (i) {
      return i.status === "overdue";
    }).length;
    var totalAmt = invoices.reduce(function (acc, i) {
      return acc + (Number(i.amount) || 0);
    }, 0);

    var setEl = function (id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setEl("invTotal", total);
    setEl("invPaid", paid);
    setEl("invPending", pending);
    setEl("invOverdue", overdue);
    setEl("invTotalAmount", formatPLN(totalAmt));
  }

  function applyInvoices(list, src) {
    allInvoices = list || [];
    source = src || "local";
    updateSummary(allInvoices);
    renderTable(allInvoices);
    updateSourceBadge();
  }

  function loadInvoices() {
    return fetch(bridgeUrl() + "/finance/invoices", {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("bridge");
        return r.json();
      })
      .then(function (data) {
        applyInvoices(data.invoices || [], "bridge");
      })
      .catch(function () {
        return fetch("data/invoices.json?v=" + Date.now(), { cache: "no-store" })
          .then(function (r) {
            return r.json();
          })
          .then(function (data) {
            applyInvoices(data.invoices || [], "local");
          });
      });
  }

  function renderAsanaTasks(tasks) {
    var mount = document.getElementById("damAsanaTasksList");
    var banner = document.getElementById("damAsanaTasksBanner");
    if (!mount) return;
    if (!tasks || !tasks.length) {
      mount.innerHTML = "";
      if (banner) {
        banner.hidden = false;
        banner.innerHTML =
          'Brak zadań Asana. Połącz i zsynchronizuj w <a href="integrations.html">Integracjach</a>.';
      }
      return;
    }
    if (banner) banner.hidden = true;
    mount.innerHTML = tasks
      .slice(0, 40)
      .map(function (t) {
        var name = t.name || t.title || t.gid || "Zadanie";
        var project = t.project || t.projects || t.section || "";
        var due = t.due_on || t.due_date || "";
        return (
          '<li class="dam-inv-asana-item">' +
          '<span class="dam-inv-asana-item__title">' +
          escapeHtml(name) +
          "</span>" +
          (project
            ? '<span class="dam-inv-asana-item__meta">' + escapeHtml(String(project)) + "</span>"
            : "") +
          (due
            ? '<span class="dam-inv-asana-item__due">' + escapeHtml(formatDate(due)) + "</span>"
            : "") +
          "</li>"
        );
      })
      .join("");
  }

  function loadAsanaTasks() {
    return fetch("data/asana-tasks.json?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        var tasks = [];
        if (!data) {
          renderAsanaTasks([]);
          return;
        }
        if (Array.isArray(data.tasks)) tasks = data.tasks;
        else if (Array.isArray(data)) tasks = data;
        else if (data.projects && Array.isArray(data.projects)) {
          data.projects.forEach(function (p) {
            (p.tasks || []).forEach(function (t) {
              tasks.push(
                Object.assign({}, t, { project: p.name || p.label || p.id })
              );
            });
          });
        }
        renderAsanaTasks(tasks);
      })
      .catch(function () {
        renderAsanaTasks([]);
      });
  }

  function bindErpActions() {
    var adminWrap = document.getElementById("invErpAdminWrap");
    var legacyWrap = document.getElementById("invImportWrap");
    var input = document.getElementById("invCsvImport");
    var exportBtn = document.getElementById("invErpExportBtn");
    var admin = isAdmin();
    if (adminWrap) {
      adminWrap.hidden = !admin;
      adminWrap.classList.toggle("is-visible", !!admin);
      adminWrap.style.removeProperty("display");
    }
    if (legacyWrap) {
      legacyWrap.hidden = true;
      legacyWrap.style.removeProperty("display");
    }
    if (input) {
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var fd = new FormData();
        fd.append("file", file);
        fetch(bridgeUrl() + "/finance/invoices/import", {
          method: "POST",
          headers: authHeaders(),
          body: fd,
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, j: j };
            });
          })
          .then(function (res) {
            input.value = "";
            if (!res.ok || (res.j && res.j.ok === false)) {
              alert(
                (res.j && (res.j.error || res.j.message)) ||
                  "Import nie powiódł się."
              );
              return;
            }
            var n = (res.j && res.j.imported) || 0;
            alert("Zaimportowano z ERP (CSV): " + n);
            return Promise.all([loadInvoices(), loadErpStatus()]);
          })
          .catch(function () {
            input.value = "";
            alert("Bridge offline.");
          });
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        if (!admin) return;
        exportBtn.disabled = true;
        fetch(bridgeUrl() + "/finance/invoices/export", {
          method: "POST",
          headers: Object.assign(
            { "Content-Type": "application/json" },
            authHeaders()
          ),
          body: JSON.stringify({}),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, j: j };
            });
          })
          .then(function (res) {
            exportBtn.disabled = false;
            if (!res.ok || (res.j && res.j.ok === false)) {
              alert(
                (res.j && (res.j.error || res.j.message)) ||
                  "Eksport do ERP nie powiódł się."
              );
              return loadErpStatus();
            }
            var n = (res.j && res.j.exported) || 0;
            alert(
              "Wyeksportowano do ERP (stub): " +
                n +
                " faktur. Stan zapisany w invoice-erp-sync.json."
            );
            if (res.j && res.j.sync) renderErpSync(res.j.sync);
            return loadErpStatus();
          })
          .catch(function () {
            exportBtn.disabled = false;
            alert("Bridge offline.");
          });
      });
    }
  }

  function init() {
    ensureCtaStyles();
    document.querySelectorAll(".geex-content__summary, .geex-content__invoice").forEach(function (el) {
      el.style.display = "none";
    });

    bindErpActions();
    var skelBody = document.getElementById("invTableBody");
    if (skelBody && window.DamGridReveal && window.DamGridReveal.skeleton) {
      window.DamGridReveal.skeleton(skelBody, { count: 6, cols: 6 });
    }
    loadInvoices().catch(function () {
      var tbody = document.getElementById("invTableBody");
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">Brak danych</td></tr>';
      }
    });
    loadErpStatus();
    loadAsanaTasks();

    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".inv-filter-btn");
      if (!btn) return;
      currentFilter = btn.getAttribute("data-filter") || "all";
      document.querySelectorAll(".inv-filter-btn").forEach(function (b) {
        var on = b === btn;
        b.classList.toggle("active", on);
        b.classList.toggle("is-active", on);
        b.removeAttribute("style");
      });
      renderTable(allInvoices);
    });
  }

  window.DamInvoices = {
    reload: function () {
      return Promise.all([loadInvoices(), loadErpStatus()]);
    },
    getErpSync: function () {
      return erpSync;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
