/**
 * DAM - Invoices list controller
 * Loads from data/invoices.json and fills the invoice table
 */
(function () {
  "use strict";

  var STATUS_LABELS = {
    paid: "Oplacona",
    pending: "Oczekuje",
    overdue: "Po terminie"
  };
  var STATUS_CLASSES = {
    paid: "geex-badge--success-transparent",
    pending: "geex-badge--warning-transparent",
    overdue: "geex-badge--danger-transparent"
  };

  function formatDate(str) {
    if (!str) return "-";
    try {
      var d = new Date(str);
      return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch (e) { return str; }
  }

  function formatPLN(val) {
    return val.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " PLN";
  }

  var allInvoices = [];
  var currentFilter = "all";

  function renderTable(invoices) {
    var tbody = document.getElementById("invTableBody");
    if (!tbody) return;
    var filtered = currentFilter === "all" ? invoices : invoices.filter(function (inv) { return inv.status === currentFilter; });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">Brak faktur</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (inv) {
      var statusLabel = STATUS_LABELS[inv.status] || inv.status;
      var statusClass = STATUS_CLASSES[inv.status] || "";
      var isOverdue = inv.status === "overdue";
      return '<tr>' +
        '<td style="font-weight:500;white-space:nowrap">' + inv.id + '</td>' +
        '<td>' +
          '<div style="font-weight:500">' + (inv.project || "-") + '</div>' +
          '<div style="font-size:11px;color:#888">' + (inv.type || "") + '</div>' +
        '</td>' +
        '<td style="font-weight:600;white-space:nowrap;color:#AB54DB">' + formatPLN(inv.amount) + '</td>' +
        '<td style="white-space:nowrap">' + formatDate(inv.issue_date) + '</td>' +
        '<td style="white-space:nowrap;color:' + (isOverdue ? "#ff5653" : "inherit") + '">' + formatDate(inv.due_date) + '</td>' +
        '<td><span class="geex-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
        '</tr>';
    }).join("");
  }

  function updateSummary(invoices) {
    var total = invoices.length;
    var paid = invoices.filter(function (i) { return i.status === "paid"; }).length;
    var pending = invoices.filter(function (i) { return i.status === "pending"; }).length;
    var overdue = invoices.filter(function (i) { return i.status === "overdue"; }).length;
    var totalAmt = invoices.reduce(function (acc, i) { return acc + (i.amount || 0); }, 0);

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

  function init() {
    fetch("data/invoices.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allInvoices = data.invoices || [];
        updateSummary(allInvoices);
        renderTable(allInvoices);
      })
      .catch(function (e) {
        console.warn("DAM Invoices: could not load invoices.json", e);
        var tbody = document.getElementById("invTableBody");
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">Brak danych</td></tr>';
      });

    // Filter buttons
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".inv-filter-btn");
      if (!btn) return;
      currentFilter = btn.getAttribute("data-filter") || "all";
      document.querySelectorAll(".inv-filter-btn").forEach(function (b) {
        b.classList.toggle("active", b === btn);
        b.style.background = b === btn ? "#AB54DB" : "";
        b.style.color = b === btn ? "#fff" : "";
      });
      renderTable(allInvoices);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
