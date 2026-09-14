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
  var projectFilterQuery = "";
  var source = "local";
  var erpSync = null;
  var asanaTasks = [];
  var costCatalog = null;
  var draftLines = [];
  var DEFAULT_MAIL_TO = ["faktury@kubara.pl", "alina.andzel@kubara.pl"];
  var DEFAULT_ACCOUNTING_NO = "509012414";

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
    if (window.DamShell && typeof window.DamShell.isAdminMode === "function") {
      return window.DamShell.isAdminMode();
    }
    var role = (localStorage.getItem("dam_role") || "").toLowerCase();
    return role === "admin" || role === "power_user";
  }

  var COMPARE_PRODUCT_IDS = [
    "figa-z-makiem-owocowe",
    "cynamonka-nerkowcowy",
  ];

  function renderProductCompare() {
    var section = document.getElementById("damInvProductCompare");
    var tbody = document.getElementById("damInvProductCompareBody");
    if (!section || !tbody) return;
    var PF = window.DamProductFinance;
    if (!PF || typeof PF.loadProjectCosts !== "function") {
      section.hidden = true;
      return;
    }
    PF.loadProjectCosts()
      .then(function (data) {
        var rows = COMPARE_PRODUCT_IDS.map(function (pid) {
          var proj = PF.findProjectByProductId(pid, data);
          if (!proj) return "";
          var salesSeed = PF.compareSalesSeed && PF.compareSalesSeed(pid);
          var sales = salesSeed ? Number(salesSeed.sales_pln) : 0;
          var pack = Number(proj.direct_total) || 0;
          var profit = sales - pack;
          var name =
            (salesSeed && salesSeed.label) ||
            proj.label ||
            proj.name ||
            pid;
          return (
            "<tr><td>" +
            escapeHtml(name) +
            (PF.testBadgeHtml ? " " + PF.testBadgeHtml() : "") +
            '</td><td class="text-end">' +
            escapeHtml(formatPLN(pack)) +
            '</td><td class="text-end">' +
            escapeHtml(formatPLN(sales)) +
            '</td><td class="text-end">' +
            escapeHtml(formatPLN(profit)) +
            "</td></tr>"
          );
        }).join("");
        if (!rows) {
          section.hidden = true;
          return;
        }
        tbody.innerHTML = rows;
        section.hidden = false;
        if (window.DamI18n && typeof window.DamI18n.apply === "function") {
          window.DamI18n.apply(section);
        }
      })
      .catch(function () {
        section.hidden = true;
      });
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

  function invoiceMatchesProjectFilter(inv, q) {
    if (!q) return true;
    var blob = (
      (inv.project || "") +
      " " +
      (inv.id || "") +
      " " +
      (inv.linked_product_id || "")
    ).toLowerCase();
    var needle = String(q).toLowerCase();
    if (blob.indexOf(needle) >= 0) return true;
    if (needle.indexOf("figa") >= 0 && /figa|makiem/i.test(blob)) return true;
    if (needle.indexOf("cynamon") >= 0 && /cynamon/i.test(blob)) return true;
    return false;
  }

  function testBadgeInline(inv) {
    if (!inv || (!inv.isTest && inv.source !== "seed")) return "";
    if (window.DamProductFinance && typeof DamProductFinance.testBadgeHtml === "function") {
      return " " + DamProductFinance.testBadgeHtml();
    }
    return ' <span class="dam-seed-test-badge dam-viz-badge">(TESTOWE)</span>';
  }

  function renderTable(invoices) {
    var tbody = document.getElementById("invTableBody");
    if (!tbody) return;
    var scoped = projectFilterQuery
      ? invoices.filter(function (inv) {
          return invoiceMatchesProjectFilter(inv, projectFilterQuery);
        })
      : invoices;
    var filtered =
      currentFilter === "all"
        ? scoped
        : scoped.filter(function (inv) {
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
          testBadgeInline(inv) +
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

  function visibleInvoices() {
    if (!projectFilterQuery) return allInvoices;
    return allInvoices.filter(function (inv) {
      return invoiceMatchesProjectFilter(inv, projectFilterQuery);
    });
  }

  function showProjectFilterBanner() {
    var banner = document.getElementById("damInvProjectFilter");
    if (!banner) return;
    if (!projectFilterQuery) {
      banner.hidden = true;
      banner.textContent = "";
      return;
    }
    banner.hidden = false;
    banner.innerHTML =
      '<span class="dam-int-chip dam-int-st dam-int-st--wait">' +
      escapeHtml("Filtr produktu: " + projectFilterQuery) +
      '</span> <a class="geex-btn geex-btn--sm geex-btn--primary-transparent" href="invoices.html">Wyczyść filtr</a>';
  }

  function applyInvoices(list, src) {
    allInvoices = list || [];
    source = src || "local";
    updateSummary(visibleInvoices());
    renderTable(allInvoices);
    updateSourceBadge();
    showProjectFilterBanner();
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

  function ensureInvStyles() {
    var st = document.getElementById("damInvAsanaMailCss");
    if (!st) {
      st = document.createElement("style");
      st.id = "damInvAsanaMailCss";
      document.head.appendChild(st);
    }
    /* Geex purple checkbox (HARD: never native orange) + fixed left-aligned estimate column */
    st.textContent =
      ".dam-inv-asana__list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;max-height:420px;overflow:auto}" +
      ".dam-inv-asana-item{display:grid;grid-template-columns:28px minmax(0,1fr) minmax(15.5rem,18rem);gap:10px 14px;align-items:start;padding:10px 12px;border:1px solid #ececf2;border-radius:10px;background:#fafafc}" +
      ".dam-inv-asana-item__main{min-width:0}" +
      ".dam-inv-asana-item__title{font-weight:600;font-size:13px;display:block}" +
      ".dam-inv-asana-item__meta,.dam-inv-asana-item__due{font-size:12px;color:#5c5c6a}" +
      ".dam-inv-asana-item__est{min-width:15.5rem;width:100%;justify-self:stretch;text-align:left;font-size:12px;color:#5c5c6a;line-height:1.35;box-sizing:border-box}" +
      ".dam-inv-asana-item__est-label{display:block;text-align:left}" +
      ".dam-inv-asana-item__est-amt{display:block;margin-top:2px;text-align:left;font-size:13px;color:#2a2a32}" +
      ".dam-inv-asana__draft{margin-top:14px;padding:12px;border:1px solid #e2dced;border-radius:12px;background:#faf8ff}" +
      ".dam-inv-asana__draft table{width:100%;border-collapse:collapse;font-size:12.5px}" +
      ".dam-inv-asana__draft th,.dam-inv-asana__draft td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}" +
      ".dam-inv-cb{display:inline-flex;align-items:flex-start;margin:0;cursor:pointer}" +
      ".dam-inv-cb__input{-webkit-appearance:none;appearance:none;width:20px;height:20px;margin:1px 0 0;flex:0 0 20px;border:2px solid var(--dam-border-strong,#a8a3b5);border-radius:6px;background:var(--dam-surface,#fff);accent-color:var(--dam-primary,#ab54db);cursor:pointer;position:relative;transition:background .15s ease,border-color .15s ease}" +
      ".dam-inv-cb__input:checked{background:var(--dam-primary,#ab54db);border-color:var(--dam-primary,#ab54db)}" +
      ".dam-inv-cb__input:checked::after{content:\"\";position:absolute;left:5px;top:1px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}" +
      ".dam-inv-cb__input:focus-visible{outline:2px solid var(--dam-primary,#ab54db);outline-offset:2px}" +
      ".dam-inv-mail{margin-top:24px!important;display:block!important}" +
      ".dam-inv-mail__content{display:flex;flex-direction:column;gap:24px;padding:8px 4px 16px}" +
      ".dam-inv-mail__section{padding:16px 18px;border:1px solid #e8e8ee;border-radius:14px;background:#fff}" +
      ".dam-inv-mail__section h5{margin:0 0 10px;font-size:13px;font-weight:650;text-transform:uppercase;letter-spacing:.04em;color:#5c5c6a}" +
      ".dam-inv-mail__chips{display:flex;flex-wrap:wrap;gap:8px}" +
      ".dam-inv-mail__chip{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:#f0eef6;border:1px solid #e2dced;font-size:13px;cursor:pointer}" +
      ".dam-inv-mail__list{display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto}" +
      ".dam-inv-mail__row{display:grid;grid-template-columns:20px minmax(9.5rem,11rem) minmax(0,1fr);gap:10px 12px;align-items:start;font-size:13px;cursor:pointer}" +
      ".dam-inv-mail__row-id{min-width:9.5rem;font-variant-numeric:tabular-nums}" +
      ".dam-inv-mail__row-body{min-width:0;text-align:left;line-height:1.35;color:#3d3d48}" +
      ".dam-inv-mail__actions{display:flex;flex-wrap:wrap;gap:10px}" +
      ".dam-inv-compare{margin:0 0 20px;padding:16px 18px;border:1px solid var(--dam-border,#e7e7e7);border-radius:12px;background:var(--dam-surface,#fff)}" +
      ".dam-inv-compare__head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}" +
      ".dam-inv-compare__title{margin:0;font-size:15px;font-weight:650;color:var(--dam-text,#464255)}" +
      ".dam-inv-compare__table{width:100%;font-size:13px;text-align:left}" +
      ".dam-inv-compare__table th,.dam-inv-compare__table td{text-align:left;vertical-align:middle}" +
      ".dam-inv-compare__table .text-end{text-align:right!important}";
  }

  function loadCostCatalog() {
    return fetch(bridgeUrl() + "/production-cost-catalog", {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      })
      .then(function (data) {
        if (data && data.lines) {
          costCatalog = data;
          return data;
        }
        return fetch("data/production-cost-catalog.json?v=" + Date.now(), {
          cache: "no-store",
        })
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .then(function (local) {
            costCatalog = local || { lines: [] };
            return costCatalog;
          });
      });
  }

  function matchTaskToCostLine(taskName) {
    var name = String(taskName || "").toLowerCase();
    var lines = (costCatalog && costCatalog.lines) || [];
    var fallback = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var pat = line.task_pattern || "";
      if (pat === ".*" || line.id === "fallback") {
        fallback = line;
        continue;
      }
      try {
        if (new RegExp(pat, "i").test(name)) return line;
      } catch (e) {
        if (name.indexOf(String(pat).toLowerCase()) !== -1) return line;
      }
    }
    return fallback;
  }

  function estimateForTask(t) {
    var name = t.name || t.title || "";
    var line = matchTaskToCostLine(name);
    var qty = line && line.default_qty != null ? Number(line.default_qty) : 1;
    var price = line ? Number(line.unit_price) || 0 : 0;
    return {
      task: t,
      catalog_id: line && line.id,
      label: (line && line.label_pl) || "Inna pozycja",
      category: (line && line.category) || "other",
      unit: (line && line.unit) || "per_task",
      qty: qty,
      unit_price: price,
      amount: qty * price,
      description:
        name +
        (t.parent || t.project ? " · " + (t.parent || t.project) : ""),
    };
  }

  function renderAsanaTasks(tasks) {
    ensureInvStyles();
    asanaTasks = tasks || [];
    var mount = document.getElementById("damAsanaTasksList");
    var banner = document.getElementById("damAsanaTasksBanner");
    if (!mount) return;
    if (!tasks || !tasks.length) {
      mount.innerHTML = "";
      if (banner) {
        banner.hidden = false;
        banner.innerHTML =
          'Brak zadań Asana. Połącz i zsynchronizuj w <a href="integrations.html">Integracja i produkcja</a>.';
      }
      return;
    }
    if (banner) banner.hidden = true;
    mount.innerHTML = tasks
      .slice(0, 60)
      .map(function (t, idx) {
        var name = t.name || t.title || t.gid || "Zadanie";
        var project = t.parent || t.project || t.section || "";
        var due = t.due_on || t.due_date || t.due || "";
        var est = estimateForTask(t);
        var tid = t.id || t.gid || "t" + idx;
        return (
          '<li class="dam-inv-asana-item">' +
          '<label class="dam-inv-cb"><input type="checkbox" class="dam-asana-task-cb dam-inv-cb__input" data-task-id="' +
          escapeHtml(String(tid)) +
          '" data-task-idx="' +
          idx +
          '" /></label>' +
          '<div class="dam-inv-asana-item__main">' +
          '<span class="dam-inv-asana-item__title">' +
          escapeHtml(name) +
          "</span>" +
          (project
            ? '<div class="dam-inv-asana-item__meta">' +
              escapeHtml(String(project)) +
              "</div>"
            : "") +
          (due
            ? '<div class="dam-inv-asana-item__due">' +
              escapeHtml(formatDate(due)) +
              "</div>"
            : "") +
          "</div>" +
          '<div class="dam-inv-asana-item__est">' +
          '<span class="dam-inv-asana-item__est-label">' +
          escapeHtml(est.label) +
          "</span>" +
          '<strong class="dam-inv-asana-item__est-amt">' +
          escapeHtml(formatPLN(est.amount)) +
          "</strong></div>" +
          "</li>"
        );
      })
      .join("");
  }

  function renderDraftLines() {
    var box = document.getElementById("damAsanaDraftLines");
    var sumEl = document.getElementById("damAsanaCostSum");
    var total = draftLines.reduce(function (a, L) {
      return a + (Number(L.amount) || 0);
    }, 0);
    if (sumEl) sumEl.textContent = "Suma: " + formatPLN(total);
    if (!box) return;
    if (!draftLines.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.innerHTML =
      "<h5 style=\"margin:0 0 8px;font-size:13px\">Szkic pozycji faktury</h5>" +
      "<table><thead><tr><th>Opis</th><th>Kat.</th><th>Ilość</th><th>Cena</th><th>Suma</th></tr></thead><tbody>" +
      draftLines
        .map(function (L) {
          return (
            "<tr><td>" +
            escapeHtml(L.description) +
            "</td><td>" +
            escapeHtml(L.category) +
            '</td><td class="dam-sleeve-stock__num">' +
            escapeHtml(String(L.qty)) +
            "</td><td>" +
            escapeHtml(formatPLN(L.unit_price)) +
            "</td><td><strong>" +
            escapeHtml(formatPLN(L.amount)) +
            "</strong></td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";
  }

  function selectedAsanaTasks() {
    var out = [];
    document.querySelectorAll(".dam-asana-task-cb:checked").forEach(function (cb) {
      var idx = parseInt(cb.getAttribute("data-task-idx"), 10);
      if (!isNaN(idx) && asanaTasks[idx]) out.push(asanaTasks[idx]);
    });
    return out;
  }

  function generateDraftFromSelection() {
    draftLines = selectedAsanaTasks().map(estimateForTask);
    if (!draftLines.length) {
      alert("Zaznacz co najmniej jedno zadanie Asana.");
      return;
    }
    renderDraftLines();
  }

  function addDraftToInvoice() {
    if (!draftLines.length) {
      alert("Najpierw wygeneruj pozycje faktury.");
      return;
    }
    var total = draftLines.reduce(function (a, L) {
      return a + (Number(L.amount) || 0);
    }, 0);
    var today = new Date();
    var iso = today.toISOString().slice(0, 10);
    var due = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
    var id =
      "FV/" +
      today.getFullYear() +
      "/" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "/AS-" +
      String(Date.now()).slice(-6);
    var inv = {
      id: id,
      client: "Kubara / produkcja (szacunek)",
      project: draftLines
        .slice(0, 3)
        .map(function (L) {
          return L.description;
        })
        .join("; "),
      amount: Math.round(total * 100) / 100,
      currency: "PLN",
      issue_date: iso,
      due_date: due,
      status: "pending",
      type: "Asana kosztorys",
      lines: draftLines.map(function (L) {
        return {
          description: L.description,
          category: L.category,
          qty: L.qty,
          unit_price: L.unit_price,
          amount: L.amount,
          catalog_id: L.catalog_id,
        };
      }),
      accounting_no: DEFAULT_ACCOUNTING_NO,
    };
    var headers = Object.assign(
      { "Content-Type": "application/json" },
      authHeaders()
    );
    fetch(bridgeUrl() + "/finance/invoices", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ action: "upsert", invoice: inv }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        if (!res.ok || (res.j && res.j.ok === false)) {
          // local fallback append
          allInvoices.unshift(inv);
          applyInvoices(allInvoices, source);
          alert(
            "Dodano lokalnie (bridge niedostępny): " +
              id +
              " · " +
              formatPLN(total)
          );
        } else {
          alert("Dodano fakturę " + id + " · " + formatPLN(total));
          return loadInvoices().then(function () {
            renderMailPanel();
          });
        }
        renderMailPanel();
      })
      .catch(function () {
        allInvoices.unshift(inv);
        applyInvoices(allInvoices, source);
        alert("Dodano lokalnie: " + id);
        renderMailPanel();
      });
  }

  function loadAsanaTasks() {
    return loadCostCatalog().then(function () {
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
          tasks = tasks.filter(function (t) {
            return (t.status || "open") !== "completed";
          });
          renderAsanaTasks(tasks);
        })
        .catch(function () {
          renderAsanaTasks([]);
        });
    });
  }

  function renderMailPanel() {
    ensureInvStyles();
    var mount = document.getElementById("damInvMailContent");
    var panel = document.getElementById("damInvMailPanel");
    if (panel) panel.style.display = "block";
    if (!mount) return;
    var invs = allInvoices.slice(0, 40);
    mount.innerHTML =
      '<article class="dam-inv-mail__section" id="damMailSecRecipients">' +
      "<h5>Odbiorcy</h5>" +
      '<div class="dam-inv-mail__chips">' +
      DEFAULT_MAIL_TO.map(function (email) {
        return (
          '<label class="dam-inv-mail__chip"><input type="checkbox" class="dam-mail-to dam-inv-cb__input" value="' +
          escapeHtml(email) +
          '" checked /> ' +
          escapeHtml(email) +
          "</label>"
        );
      }).join("") +
      "</div>" +
      '<input type="email" class="form-control form-control-sm mt-2" id="damMailExtraTo" placeholder="Dodatkowy e-mail (opcjonalnie)" />' +
      "</article>" +
      '<div class="dam-inv-mail__section" id="damMailSecAccounting">' +
      "<h5>Numer księgowości</h5>" +
      '<input type="text" class="form-control" id="damMailAccountingNo" value="' +
      escapeHtml(DEFAULT_ACCOUNTING_NO) +
      '" />' +
      "</div>" +
      '<div class="dam-inv-mail__section" id="damMailSecInvoices">' +
      "<h5>Faktury do wysyłki</h5>" +
      '<div class="dam-inv-mail__list">' +
      (invs.length
        ? invs
            .map(function (inv) {
              return (
                '<label class="dam-inv-mail__row">' +
                '<input type="checkbox" class="dam-mail-inv dam-inv-cb__input" value="' +
                escapeHtml(inv.id) +
                '" />' +
                '<span class="dam-inv-mail__row-id"><strong>' +
                escapeHtml(inv.id) +
                "</strong></span>" +
                '<div class="dam-inv-mail__row-body">' +
                escapeHtml(inv.project || inv.client || "") +
                " · " +
                escapeHtml(formatPLN(inv.amount)) +
                "</div></label>"
              );
            })
            .join("")
        : "<p>Brak faktur na liście.</p>") +
      "</div>" +
      '<textarea class="form-control mt-2" id="damMailNote" rows="3" placeholder="Uwagi do treści maila (opcjonalnie)"></textarea>' +
      "</div>" +
      '<div class="dam-inv-mail__section dam-inv-mail__actions" id="damMailSecActions">' +
      '<button type="button" class="geex-btn geex-btn--primary" id="damMailOutlookBtn">Przygotuj mail w Outlooku</button>' +
      '<button type="button" class="geex-btn geex-btn--primary-transparent" id="damMailCopyBtn">Kopiuj treść</button>' +
      '<span class="dam-widget__meta" id="damMailStatus"></span>' +
      "</div>";

    var outBtn = document.getElementById("damMailOutlookBtn");
    var copyBtn = document.getElementById("damMailCopyBtn");
    if (outBtn) outBtn.addEventListener("click", sendOutlookDraft);
    if (copyBtn) copyBtn.addEventListener("click", copyMailBody);
  }

  function selectedMailRecipients() {
    var to = [];
    document.querySelectorAll(".dam-mail-to:checked").forEach(function (cb) {
      to.push(cb.value);
    });
    var extra = document.getElementById("damMailExtraTo");
    if (extra && extra.value.trim()) to.push(extra.value.trim());
    return to;
  }

  function selectedMailInvoiceIds() {
    var ids = [];
    document.querySelectorAll(".dam-mail-inv:checked").forEach(function (cb) {
      ids.push(cb.value);
    });
    return ids;
  }

  function buildMailBodyText() {
    var acc =
      (document.getElementById("damMailAccountingNo") || {}).value ||
      DEFAULT_ACCOUNTING_NO;
    var note = (document.getElementById("damMailNote") || {}).value || "";
    var ids = selectedMailInvoiceIds();
    var lines = [
      "Dzień dobry,",
      "",
      "W załączeniu faktury DAM do księgowości.",
      "Numer księgowości: " + acc,
      "",
      "Faktury:",
    ];
    ids.forEach(function (id) {
      var inv = allInvoices.find(function (x) {
        return x.id === id;
      });
      lines.push(
        "- " +
          id +
          (inv ? " · " + formatPLN(inv.amount) + " · " + (inv.project || "") : "")
      );
    });
    if (note) {
      lines.push("");
      lines.push(note);
    }
    lines.push("");
    lines.push("Pozdrawiamy,");
    lines.push("DAM Dobra Kaloria");
    return lines.join("\n");
  }

  function copyMailBody() {
    var body = buildMailBodyText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(body).then(function () {
        var st = document.getElementById("damMailStatus");
        if (st) st.textContent = "Skopiowano treść maila.";
      });
    } else {
      alert(body);
    }
  }

  function sendOutlookDraft() {
    var to = selectedMailRecipients();
    var ids = selectedMailInvoiceIds();
    var st = document.getElementById("damMailStatus");
    if (!to.length) {
      alert("Wybierz co najmniej jednego odbiorcę.");
      return;
    }
    if (!ids.length) {
      alert("Zaznacz faktury do wysyłki.");
      return;
    }
    if (st) st.textContent = "Przygotowywanie draftu Outlook…";
    var payload = {
      invoice_ids: ids,
      to: to,
      accounting_no:
        (document.getElementById("damMailAccountingNo") || {}).value ||
        DEFAULT_ACCOUNTING_NO,
      body_note: (document.getElementById("damMailNote") || {}).value || "",
      body: buildMailBodyText(),
    };
    fetch(bridgeUrl() + "/finance/invoices/outlook-draft", {
      method: "POST",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        authHeaders()
      ),
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, status: r.status, j: j };
        });
      })
      .then(function (res) {
        if (res.ok && res.j && res.j.ok) {
          if (st)
            st.textContent =
              "Draft Outlook otwarty (" +
              (res.j.attachments || 0) +
              " załączników).";
          return;
        }
        // fallback mailto + zip url
        if (res.j && res.j.zip_url) {
          window.open(res.j.zip_url, "_blank");
        }
        var mailto =
          "mailto:" +
          encodeURIComponent(to.join(";")) +
          "?subject=" +
          encodeURIComponent("Faktury DAM · ksiegowosc " + payload.accounting_no) +
          "&body=" +
          encodeURIComponent(
            buildMailBodyText() +
              "\n\n[Załączniki: pobierz ZIP z DAM desktop / bridge — mailto nie dołącza plików]"
          );
        window.location.href = mailto;
        if (st)
          st.textContent =
            (res.j && res.j.error
              ? res.j.error + " · "
              : "") +
            "Fallback: mailto + ewentualny ZIP. Uruchom desktop DAM dla załączników Outlook.";
      })
      .catch(function () {
        var mailto =
          "mailto:" +
          encodeURIComponent(to.join(";")) +
          "?subject=" +
          encodeURIComponent("Faktury DAM") +
          "&body=" +
          encodeURIComponent(buildMailBodyText());
        window.location.href = mailto;
        if (st)
          st.textContent =
            "Bridge offline — otwarto mailto bez załączników. Uruchom desktop DAM.";
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
    ensureInvStyles();
    try {
      projectFilterQuery =
        new URLSearchParams(window.location.search).get("project") ||
        new URLSearchParams(window.location.search).get("product_id") ||
        "";
    } catch (eQs) {
      projectFilterQuery = "";
    }
    document.querySelectorAll(".geex-content__summary").forEach(function (el) {
      el.style.display = "none";
    });
    /* Keep .geex-content__invoice visible for mail panel; hide only demo leftovers */
    document.querySelectorAll(".geex-content__invoice > .geex-content__invoice__wrapper").forEach(function (el) {
      if (!el.querySelector("#damInvMailPanel")) el.style.display = "none";
    });
    var mailPanel = document.getElementById("damInvMailPanel");
    if (mailPanel) {
      var invoiceRoot = mailPanel.closest(".geex-content__invoice");
      if (invoiceRoot) invoiceRoot.style.display = "block";
      mailPanel.style.display = "block";
    }

    bindErpActions();
    var genBtn = document.getElementById("damAsanaGenLines");
    var addBtn = document.getElementById("damAsanaAddInvoice");
    if (genBtn) genBtn.addEventListener("click", generateDraftFromSelection);
    if (addBtn) addBtn.addEventListener("click", addDraftToInvoice);

    var skelBody = document.getElementById("invTableBody");
    if (skelBody && window.DamGridReveal && window.DamGridReveal.skeleton) {
      window.DamGridReveal.skeleton(skelBody, { count: 6, cols: 6 });
    }
    renderProductCompare();
    loadInvoices()
      .then(function () {
        renderMailPanel();
      })
      .catch(function () {
        var tbody = document.getElementById("invTableBody");
        if (tbody) {
          tbody.innerHTML =
            '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">Brak danych</td></tr>';
        }
        renderMailPanel();
      });
    loadErpStatus();
    loadAsanaTasks();

    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".inv-filter-btn");
      if (!btn) return;
      currentFilter = btn.getAttribute("data-filter") || "all";
      