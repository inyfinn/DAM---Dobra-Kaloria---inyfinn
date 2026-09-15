/**
 * DamSleeveStock - panel STANY RĘKAWKÓW na integrations.html
 * (pod Wykrojniki ↔ produkty). Bridge GET /sleeve-stock + reimport/import.
 *
 * Zapas msc (Excel) = STAN / zużycie_msc.
 * Dni w UI = floor(msc × DAYS_PER_MONTH), DAYS_PER_MONTH = 30.5.
 */
(function () {
  "use strict";

  var STYLE_ID = "dam-sleeve-stock-inject";
  var MOUNT_ID = "damSleeveStock";
  /** Średnia długość miesiąca kalendarzowego (365 / 12 ≈ 30.42; 30.5 jak w briefie zakupów). */
  var DAYS_PER_MONTH = 30.5;
  var LS_ORDER = "dam_sleeve_col_order_v1";
  var LS_WIDTHS = "dam_sleeve_col_widths_v1";

  var COL_DEFS = [
    { id: "code", label: "Kod", min: 72, w: 96 },
    { id: "name", label: "Nazwa", min: 160, w: 240 },
    { id: "usage", label: "Zużycie / msc", min: 88, w: 110 },
    { id: "stock", label: "STAN", min: 72, w: 96 },
    { id: "months", label: "Zapas", min: 96, w: 118 },
    { id: "on_order", label: "W zam.", min: 64, w: 80 },
    { id: "months_ord", label: "Z zam.", min: 96, w: 118 },
    { id: "tags", label: "Tagi", min: 120, w: 160 },
    { id: "die", label: "Wykrojnik", min: 72, w: 100 },
    { id: "comment", label: "Kom.", min: 100, w: 160 },
  ];

  var state = {
    data: null,
    filter: "",
    tagFilter: "all",
    busy: "",
    colOrder: null,
    colWidths: null,
  };

  var TAG_LABELS = {
    critical: "Zagrożone",
    order_now: "Zamów teraz",
    on_order: "W zamówieniu",
    waiting_retailer: "Czeka sieć",
    transition: "Przejście",
    automat_alias: "Jest automat",
    ok: "OK",
  };

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

  function loadColPrefs() {
    try {
      var order = JSON.parse(localStorage.getItem(LS_ORDER) || "null");
      var widths = JSON.parse(localStorage.getItem(LS_WIDTHS) || "null");
      var ids = COL_DEFS.map(function (c) {
        return c.id;
      });
      if (Array.isArray(order)) {
        order = order.filter(function (id) {
          return ids.indexOf(id) !== -1;
        });
        ids.forEach(function (id) {
          if (order.indexOf(id) === -1) order.push(id);
        });
        state.colOrder = order;
      } else {
        state.colOrder = ids.slice();
      }
      state.colWidths = widths && typeof widths === "object" ? widths : {};
    } catch (e) {
      state.colOrder = COL_DEFS.map(function (c) {
        return c.id;
      });
      state.colWidths = {};
    }
  }

  function saveColPrefs() {
    try {
      localStorage.setItem(LS_ORDER, JSON.stringify(state.colOrder || []));
      localStorage.setItem(LS_WIDTHS, JSON.stringify(state.colWidths || {}));
    } catch (e) {
      /* ignore */
    }
  }

  function colDef(id) {
    for (var i = 0; i < COL_DEFS.length; i++) {
      if (COL_DEFS[i].id === id) return COL_DEFS[i];
    }
    return { id: id, label: id, min: 64, w: 100 };
  }

  function colWidth(id) {
    var d = colDef(id);
    var w = state.colWidths && state.colWidths[id];
    w = Number(w);
    if (!isFinite(w) || w < d.min) return d.w;
    return w;
  }

  function ensureCss() {
    var st = document.getElementById(STYLE_ID);
    if (!st) {
      st = document.createElement("style");
      st.id = STYLE_ID;
      document.head.appendChild(st);
    }
    st.textContent =
      ".dam-sleeve-stock.dam-int-card{padding:18px 20px 22px;display:flex;flex-direction:column;gap:14px;margin-top:20px}" +
      ".dam-sleeve-stock__title{margin:0;font-size:1.15rem;font-weight:650}" +
      ".dam-sleeve-stock__purpose{margin:4px 0 0;font-size:13px;line-height:1.45;color:#5c5c6a;max-width:78ch}" +
      ".dam-sleeve-stock__meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
      ".dam-sleeve-stock__chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:12px;background:#f0eef6;color:#3d2a55;border:1px solid #e2dced}" +
      ".dam-sleeve-stock__actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
      ".dam-sleeve-stock__toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}" +
      ".dam-sleeve-stock__filters{display:flex;flex-wrap:wrap;gap:6px}" +
      ".dam-sleeve-stock__filter{border:1px solid #ddd;background:#fff;border-radius:999px;padding:5px 12px;font-size:12px;cursor:pointer}" +
      ".dam-sleeve-stock__filter.is-active{background:color-mix(in srgb,var(--dam-primary,#005A29) 14%,#fff);border-color:color-mix(in srgb,var(--dam-primary,#005A29) 45%,#ccc);color:#4a1f6b;font-weight:600}" +
      ".dam-sleeve-stock__search{min-width:200px;max-width:280px}" +
      ".dam-sleeve-stock__table-wrap{overflow:auto;max-height:min(62vh,640px);border:1px solid #e8e8ee;border-radius:12px}" +
      ".dam-sleeve-stock__table{width:max-content;min-width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px;table-layout:fixed}" +
      ".dam-sleeve-stock__table th,.dam-sleeve-stock__table td{padding:8px 10px;border-bottom:1px solid #eee;text-align:left;vertical-align:top;overflow:hidden;box-sizing:border-box}" +
      ".dam-sleeve-stock__table th:not(:first-child),.dam-sleeve-stock__table td:not(:first-child){border-left:1px solid rgba(15,15,25,0.10)}" +
      ".dam-sleeve-stock__table th{position:sticky;top:0;background:#f7f7fa;z-index:2;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:#666;user-select:none;cursor:grab;white-space:nowrap}" +
      ".dam-sleeve-stock__table th.is-dragging{opacity:.55;cursor:grabbing}" +
      ".dam-sleeve-stock__table th.is-drop-target{box-shadow:inset 3px 0 0 var(--dam-primary,#005A29)}" +
      ".dam-sleeve-stock__th-inner{position:relative;display:block;padding-right:8px;min-height:1.2em}" +
      ".dam-sleeve-stock__col-resizer{position:absolute;top:0;right:-4px;width:10px;height:100%;cursor:col-resize;z-index:3}" +
      ".dam-sleeve-stock__col-resizer:hover,.dam-sleeve-stock__col-resizer.is-active{background:color-mix(in srgb, var(--dam-primary, #005A29) 18%, transparent)}" +
      ".dam-sleeve-stock__table tr.is-critical{background:#fff5f4}" +
      ".dam-sleeve-stock__num{font-variant-numeric:tabular-nums}" +
      ".dam-sleeve-stock__horizon{line-height:1.25}" +
      ".dam-sleeve-stock__horizon-m{display:block;font-weight:650;white-space:nowrap}" +
      ".dam-sleeve-stock__horizon-d{display:block;font-size:11px;color:#5c5c6a;white-space:nowrap}" +
      ".dam-sleeve-stock__tags{display:flex;flex-wrap:wrap;gap:4px}" +
      ".dam-sleeve-tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:600;line-height:1.4}" +
      ".dam-sleeve-tag--critical{background:#fde8e6;color:#b42318}" +
      ".dam-sleeve-tag--order_now{background:#fff4e5;color:#b54708}" +
      ".dam-sleeve-tag--on_order{background:#e8f1ff;color:#175cd3}" +
      ".dam-sleeve-tag--waiting_retailer{background:#ececf2;color:#4b4b5c}" +
      ".dam-sleeve-tag--transition{background:#f3e8ff;color:#6941c6}" +
      ".dam-sleeve-tag--automat_alias{background:#e6f4f1;color:#0f6e56}" +
      ".dam-sleeve-tag--ok{background:#e8f8ef;color:#067647}" +
      ".dam-sleeve-stock__people{font-size:12px;color:#5c5c6a;line-height:1.45}" +
      ".dam-sleeve-stock__people strong{color:#2a2a32;font-weight:600}" +
      ".dam-sleeve-stock__hint{font-size:11.5px;color:#7a7a88}" +
      ".dam-sleeve-stock__lead{color:#b54708;font-weight:600;white-space:nowrap}" +
      "body.dam-sleeve-col-resizing{cursor:col-resize;user-select:none}" +
      "body.dam-sleeve-col-resizing *{cursor:col-resize!important}";
  }

  function fmtNum(n) {
    if (n == null || n === "") return "—";
    var v = Number(n);
    if (!isFinite(v)) return "—";
    return Math.round(v)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function fmtMonthsPlain(n) {
    if (n == null || n === "") return "—";
    var v = Number(n);
    if (!isFinite(v)) return "—";
    return v.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
  }

  /**
   * Excel: months = stock / avg_monthly_usage.
   * UI: "1,3 msc" + "≈39 dni" where days = floor(months × 30.5).
   */
  function fmtHorizonHtml(months, stock, usage, kind) {
    if (months == null || months === "") {
      return '<span class="dam-sleeve-stock__num">—</span>';
    }
    var m = Number(months);
    if (!isFinite(m)) {
      return '<span class="dam-sleeve-stock__num">—</span>';
    }
    var days = Math.floor(m * DAYS_PER_MONTH);
    var mLabel = fmtMonthsPlain(m);
    var dayLabel =
      days <= 0
        ? m > 0
          ? "(<1 dzień)"
          : "(0 dni)"
        : "(≈" + days.toLocaleString("pl-PL") + " dni)";
    var tipParts = [];
    tipParts.push(
      (kind === "with_order" ? "Zapas z zamówieniem" : "Zapas") +
        " (Excel) = " +
        (kind === "with_order" ? "(STAN + w zam.)" : "STAN") +
        " ÷ zużycie/msc"
    );
    var u = Number(usage);
    var s = Number(stock);
    if (isFinite(u) && u > 0 && isFinite(s)) {
      tipParts.push(
        fmtNum(s) +
          " ÷ " +
          fmtNum(u) +
          " ≈ " +
          mLabel +
          " msc"
      );
    } else {
      tipParts.push(mLabel + " msc");
    }
    tipParts.push(
      "Dni ≈ floor(" + mLabel + " × " + String(DAYS_PER_MONTH).replace(".", ",") + ") = " + dayLabel.replace("≈", "")
    );
    return (
      '<div class="dam-sleeve-stock__horizon dam-sleeve-stock__num" title="' +
      esc(tipParts.join(" · ")) +
      '">' +
      '<span class="dam-sleeve-stock__horizon-m">' +
      esc(mLabel) +
      " msc</span>" +
      '<span class="dam-sleeve-stock__horizon-d">' +
      esc(dayLabel) +
      "</span></div>"
    );
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var s = String(iso).replace("T", " ");
    return s.slice(0, 16);
  }

  async function loadData(force) {
    if (state.data && !force) return state.data;
    try {
      var r = await fetch(bridge() + "/sleeve-stock", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (r.ok) {
        state.data = await r.json();
        return state.data;
      }
    } catch (e1) {
      /* fallback */
    }
    try {
      var r2 = await fetch("data/sleeve-stock.json?v=" + Date.now(), {
        cache: "no-store",
      });
      if (r2.ok) {
        state.data = await r2.json();
        return state.data;
      }
    } catch (e2) {
      /* ignore */
    }
    state.data = { entries: [], entry_count: 0 };
    return state.data;
  }

  function entries() {
    return (state.data && state.data.entries) || [];
  }

  function filtered() {
    var q = String(state.filter || "")
      .trim()
      .toLowerCase();
    var tag = state.tagFilter || "all";
    return entries().filter(function (e) {
      var tags = e.tags || [];
      if (tag !== "all" && tags.indexOf(tag) === -1) return false;
      if (!q) return true;
      var blob = [
        e.article_code,
        e.name,
        e.extra_name,
        e.die_type,
        e.comment,
        (tags || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return blob.indexOf(q) !== -1;
    });
  }

  function countTag(tag) {
    return entries().filter(function (e) {
      return (e.tags || []).indexOf(tag) !== -1;
    }).length;
  }

  function tagHtml(tags) {
    if (!tags || !tags.length) return "—";
    return (
      '<div class="dam-sleeve-stock__tags">' +
      tags
        .map(function (t) {
          return (
            '<span class="dam-sleeve-tag dam-sleeve-tag--' +
            esc(t) +
            '">' +
            esc(TAG_LABELS[t] || t) +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function cellHtml(colId, e) {
    var critLead =
      e.order_lead_weeks != null
        ? '<div class="dam-sleeve-stock__lead">Zamów ≥' +
          esc(String(e.order_lead_weeks)) +
          " tyg. wcześniej</div>"
        : "";
    switch (colId) {
      case "code":
        return (
          '<td class="dam-sleeve-stock__num" data-col="' +
          colId +
          '"><strong>' +
          esc(e.article_code) +
          "</strong>" +
          (e.automat_alias_code
            ? '<div class="dam-sleeve-stock__hint">→ ' +
              esc(e.automat_alias_code) +
              "</div>"
            : "") +
          "</td>"
        );
      case "name":
        return (
          '<td data-col="' +
          colId +
          '">' +
          esc(e.name) +
          (e.extra_name
            ? '<div class="dam-sleeve-stock__hint">' + esc(e.extra_name) + "</div>"
            : "") +
          critLead +
          "</td>"
        );
      case "usage":
        return (
          '<td class="dam-sleeve-stock__num" data-col="' +
          colId +
          '">' +
          esc(fmtNum(e.avg_monthly_usage)) +
          "</td>"
        );
      case "stock":
        return (
          '<td class="dam-sleeve-stock__num" data-col="' +
          colId +
          '"><strong>' +
          esc(fmtNum(e.stock)) +
          "</strong></td>"
        );
      case "months":
        return (
          '<td data-col="' +
          colId +
          '">' +
          fmtHorizonHtml(e.months_of_stock, e.stock, e.avg_monthly_usage, "stock") +
          "</td>"
        );
      case "on_order":
        return (
          '<td class="dam-sleeve-stock__num" data-col="' +
          colId +
          '">' +
          esc(fmtNum(e.on_order || 0)) +
          "</td>"
        );
      case "months_ord":
        return (
          '<td data-col="' +
          colId +
          '">' +
          fmtHorizonHtml(
            e.months_with_order,
            Number(e.stock || 0) + Number(e.on_order || 0),
            e.avg_monthly_usage,
            "with_order"
          ) +
          "</td>"
        );
      case "tags":
        return '<td data-col="' + colId + '">' + tagHtml(e.tags) + "</td>";
      case "die":
        return (
          '<td data-col="' + colId + '">' + esc(e.die_type || "—") + "</td>"
        );
      case "comment":
        return (
          '<td data-col="' + colId + '">' + esc(e.comment || "—") + "</td>"
        );
      default:
        return '<td data-col="' + colId + '">—</td>';
    }
  }

  function paint() {
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) return;
    ensureCss();
    if (!state.colOrder) loadColPrefs();
    var data = state.data || {};
    var rows = filtered();
    var people = data.stakeholders || {};
    var zakupy = (people.zakupy || []).join(", ");
    var inni = (people.inni || []).join(", ");
    var sched = data.schedule_lead_days || {};
    var order = state.colOrder || [];

    var colgroup =
      "<colgroup>" +
      order
        .map(function (id) {
          return (
            '<col data-col="' +
            esc(id) +
            '" style="width:' +
            colWidth(id) +
            'px" />'
          );
        })
        .join("") +
      "</colgroup>";

    var thead =
      "<thead><tr>" +
      order
        .map(function (id) {
          var d = colDef(id);
          var tip =
            id === "months" || id === "months_ord"
              ? "Przeciągnij = kolejność · krawędź = szerokość · podwójny klik = dopasuj. Zapas msc = STAN÷zużycie; dni = floor(msc×30,5)."
              : "Przeciągnij = kolejność · krawędź = szerokość · podwójny klik = dopasuj do treści";
          return (
            '<th draggable="true" data-col="' +
            esc(id) +
            '" title="' +
            esc(tip) +
            '"><span class="dam-sleeve-stock__th-inner">' +
            esc(d.label) +
            '<span class="dam-sleeve-stock__col-resizer" data-resize="' +
            esc(id) +
            '" aria-hidden="true"></span></span></th>'
          );
        })
        .join("") +
      "</tr></thead>";

    mount.innerHTML =
      '<article class="dam-int-card dam-sleeve-stock" data-sleeve-stock="1">' +
      '<div><h3 class="dam-sleeve-stock__title">Stany rękawków</h3>' +
      '<p class="dam-sleeve-stock__purpose">Zapasy opakowań (rękawy / kartoniki) z działu zakupów. Tagi ostrzegają o niskim zapasie, zamówieniach i przejściach na nowy rękaw. Lead time grafiki (orientacyjnie): nowy produkt ' +
      esc(String(sched.new_product_existing_die || 46)) +
      " d.r., nowy smak " +
      esc(String(sched.new_flavor_family || 30)) +
      " d.r., przeformatowanie " +
      esc(String(sched.reformat || 19)) +
      " d.r. " +
      "<strong>Zapas</strong> = STAN ÷ zużycie/msc (jak w Excelu); obok pokazujemy też dni: floor(msc × 30,5).</p></div>" +
      '<div class="dam-sleeve-stock__meta">' +
      '<span class="dam-sleeve-stock__chip">' +
      esc(String(data.entry_count || entries().length)) +
      " pozycji</span>" +
      '<span class="dam-sleeve-stock__chip">Zagrożone: ' +
      esc(String(countTag("critical"))) +
      "</span>" +
      '<span class="dam-sleeve-stock__chip">Zamów: ' +
      esc(String(countTag("order_now"))) +
      "</span>" +
      '<span class="dam-sleeve-stock__chip">Zaktualizowano: ' +
      esc(fmtDate(data.updated_at)) +
      "</span>" +
      "</div>" +
      '<div class="dam-sleeve-stock__people"><strong>Dział zakupów:</strong> ' +
      esc(zakupy || "—") +
      "<br><strong>Inni zaangażowani:</strong> " +
      esc(inni || "—") +
      "</div>" +
      '<div class="dam-sleeve-stock__toolbar">' +
      '<div class="dam-sleeve-stock__filters" role="group" aria-label="Filtr tagów">' +
      filterBtn("all", "Wszystkie") +
      filterBtn("critical", "Zagrożone") +
      filterBtn("order_now", "Zamów") +
      filterBtn("on_order", "W zamówieniu") +
      filterBtn("transition", "Przejście") +
      filterBtn("waiting_retailer", "Czeka sieć") +
      "</div>" +
      '<input type="search" class="form-control form-control-sm dam-sleeve-stock__search" id="damSleeveSearch" placeholder="Szukaj kodu / nazwy…" value="' +
      esc(state.filter) +
      '" aria-label="Szukaj w stanach rękawków" />' +
      "</div>" +
      '<div class="dam-sleeve-stock__actions">' +
      '<button type="button" class="geex-btn geex-btn--primary geex-btn--sm" id="damSleeveReimport"' +
      (state.busy ? " disabled" : "") +
      '><i class="uil uil-sync" aria-hidden="true"></i> Wczytaj z XLSX</button>' +
      '<label class="geex-btn geex-btn--primary-transparent geex-btn--sm" style="margin:0;cursor:pointer">' +
      '<i class="uil uil-upload" aria-hidden="true"></i> Import pliku' +
      '<input type="file" id="damSleeveFile" accept=".xlsx,.xlsm,.csv" hidden ' +
      (state.busy ? "disabled" : "") +
      " /></label>" +
      (state.busy
        ? '<span class="dam-sleeve-stock__hint">' + esc(state.busy) + "</span>"
        : "") +
      "</div>" +
      '<div class="dam-sleeve-stock__table-wrap"><table class="dam-sleeve-stock__table" id="damSleeveTable">' +
      colgroup +
      thead +
      "<tbody>" +
      (rows.length
        ? rows
            .map(function (e) {
              var crit = (e.tags || []).indexOf("critical") !== -1;
              return (
                '<tr class="' +
                (crit ? "is-critical" : "") +
                '">' +
                order
                  .map(function (id) {
                    return cellHtml(id, e);
                  })
                  .join("") +
                "</tr>"
              );
            })
            .join("")
        : '<tr><td colspan="' +
          order.length +
          '">Brak pozycji dla filtra.</td></tr>') +
      "</tbody></table></div>" +
      '<p class="dam-sleeve-stock__hint">Źródło: ' +
      esc(data.source_xlsx || "sleeve-stock.json") +
      ". Kolumny: przeciągnij nagłówek (kolejność), przeciągnij krawędź (szerokość), podwójny klik nagłówka = dopasuj do treści. Hover na Zapas pokazuje wzór Excel.</p>" +
      "</article>";

    bind();
    bindColumnUi();
  }

  function filterBtn(id, label) {
    return (
      '<button type="button" class="dam-sleeve-stock__filter' +
      (state.tagFilter === id ? " is-active" : "") +
      '" data-sleeve-tag="' +
      esc(id) +
      '">' +
      esc(label) +
      "</button>"
    );
  }

  function setColWidth(id, px) {
    var d = colDef(id);
    var w = Math.max(d.min, Math.round(px));
    if (!state.colWidths) state.colWidths = {};
    state.colWidths[id] = w;
    var col = document.querySelector(
      '#damSleeveTable colgroup col[data-col="' + id + '"]'
    );
    if (col) col.style.width = w + "px";
  }

  function autofitColumn(id) {
    var table = document.getElementById("damSleeveTable");
    if (!table) return;
    var th = table.querySelector('thead th[data-col="' + id + '"]');
    var cells = table.querySelectorAll('tbody td[data-col="' + id + '"]');
    var max = 0;
    var probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font:12.5px/1.25 Jost,system-ui,sans-serif;padding:0 10px;box-sizing:border-box";
    document.body.appendChild(probe);
    if (th) {
      probe.textContent = (colDef(id).label || "").toUpperCase();
      max = Math.max(max, probe.offsetWidth + 28);
    }
    cells.forEach(function (td) {
      probe.innerHTML = td.innerHTML;
      probe.style.whiteSpace = "nowrap";
      max = Math.max(max, probe.offsetWidth + 20);
      var nested = td.querySelector(".dam-sleeve-stock__horizon");
      if (nested) {
        probe.textContent = nested.innerText.replace(/\n/g, " ");
        max = Math.max(max, probe.offsetWidth + 20);
      }
    });
    document.body.removeChild(probe);
    setColWidth(id, Math.min(max, 520));
    saveColPrefs();
  }

  function bindColumnUi() {
    var table = document.getElementById("damSleeveTable");
    if (!table) return;
    var dragId = null;

    table.querySelectorAll("thead th[data-col]").forEach(function (th) {
      th.addEventListener("dragstart", function (ev) {
        if (ev.target && ev.target.getAttribute && ev.target.getAttribute("data-resize")) {
          ev.preventDefault();
          return;
        }
        dragId = th.getAttribute("data-col");
        th.classList.add("is-dragging");
        try {
          ev.dataTransfer.setData("text/plain", dragId || "");
          ev.dataTransfer.effectAllowed = "move";
        } catch (e) {
          /* ignore */
        }
      });
      th.addEventListener("dragend", function () {
        th.classList.remove("is-dragging");
        table.querySelectorAll("thead th.is-drop-target").forEach(function (el) {
          el.classList.remove("is-drop-target");
        });
        dragId = null;
      });
      th.addEventListener("dragover", function (ev) {
        ev.preventDefault();
        th.classList.add("is-drop-target");
      });
      th.addEventListener("dragleave", function () {
        th.classList.remove("is-drop-target");
      });
      th.addEventListener("drop", function (ev) {
        ev.preventDefault();
        th.classList.remove("is-drop-target");
        var from = dragId || (ev.dataTransfer && ev.dataTransfer.getData("text/plain"));
        var to = th.getAttribute("data-col");
        if (!from || !to || from === to || !state.colOrder) return;
        var order = state.colOrder.slice();
        var fi = order.indexOf(from);
        var ti = order.indexOf(to);
        if (fi < 0 || ti < 0) return;
        order.splice(fi, 1);
        order.splice(ti, 0, from);
        state.colOrder = order;
        saveColPrefs();
        paint();
      });
      th.addEventListener("dblclick", function (ev) {
        if (ev.target && ev.target.getAttribute && ev.target.getAttribute("data-resize")) {
          return;
        }
        ev.preventDefault();
        autofitColumn(th.getAttribute("data-col"));
      });
    });

    table.querySelectorAll("[data-resize]").forEach(function (handle) {
      handle.addEventListener("mousedown", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var id = handle.getAttribute("data-resize");
        var startX = ev.clientX;
        var startW = colWidth(id);
        handle.classList.add("is-active");
        document.body.classList.add("dam-sleeve-col-resizing");
        function onMove(e2) {
          setColWidth(id, startW + (e2.clientX - startX));
        }
        function onUp() {
          handle.classList.remove("is-active");
          document.body.classList.remove("dam-sleeve-col-resizing");
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          saveColPrefs();
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
      handle.addEventListener("dblclick", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        autofitColumn(handle.getAttribute("data-resize"));
      });
    });
  }

  function bind() {
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) return;
    mount.querySelectorAll("[data-sleeve-tag]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.tagFilter = btn.getAttribute("data-sleeve-tag") || "all";
        paint();
      });
    });
    var search = document.getElementById("damSleeveSearch");
    if (search) {
      search.addEventListener("input", function () {
        state.filter = search.value || "";
        paint();
        var s2 = document.getElementById("damSleeveSearch");
        if (s2) {
          s2.focus();
          try {
            s2.setSelectionRange(s2.value.length, s2.value.length);
          } catch (e) {
            /* ignore */
          }
        }
      });
    }
    var reimport = document.getElementById("damSleeveReimport");
    if (reimport) {
      reimport.addEventListener("click", function () {
        doReimport();
      });
    }
    var file = document.getElementById("damSleeveFile");
    if (file) {
      file.addEventListener("change", function () {
        var f = file.files && file.files[0];
        if (f) doUpload(f);
      });
    }
  }

  async function doReimport() {
    state.busy = "Wczytywanie XLSX…";
    paint();
    try {
      var r = await fetch(bridge() + "/sleeve-stock/reimport", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      var data = {};
      try {
        data = await r.json();
      } catch (e) {
        /* ignore */
      }
      if (!r.ok || data.ok === false) {
        throw new Error(data.error || data.path || "Reimport nieudany");
      }
      toast("Wczytano " + (data.entry_count || 0) + " pozycji z XLSX");
      state.busy = "";
      await loadData(true);
      paint();
    } catch (err) {
      state.busy = "";
      paint();
      toast(
        "Nie udało się wczytać XLSX (" +
          (err && err.message ? err.message : "błąd") +
          "). Użyj Import pliku lub seed JSON."
      );
    }
  }

  async function doUpload(file) {
    state.busy = "Import " + file.name + "…";
    paint();
    try {
      var fd = new FormData();
      fd.append("file", file, file.name);
      var headers = authHeaders();
      delete headers["Content-Type"];
      var r = await fetch(bridge() + "/sleeve-stock/import", {
        method: "POST",
        headers: headers,
        body: fd,
      });
      var data = {};
      try {
        data = await r.json();
      } catch (e) {
        /* ignore */
      }
      if (!r.ok || data.ok === false) {
        throw new Error(data.error || "Import nieudany");
      }
      toast("Zaimportowano " + (data.entry_count || 0) + " pozycji");
      state.busy = "";
      await loadData(true);
      paint();
    } catch (err) {
      state.busy = "";
      paint();
      toast("Import nieudany: " + (err && err.message ? err.message : "błąd"));
    }
  }

  async function boot() {
    ensureCss();
    loadColPrefs();
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) {
      var after = document.getElementById("damWykrojnikQueue");
      if (!after || !after.parentNode) return;
      mount = document.createElement("div");
      mount.id = MOUNT_ID;
      mount.className = "dam-int-queue-wrap";
      mount.setAttribute("aria-live", "polite");
      after.parentNode.insertBefore(mount, after.nextSibling);
    }
    mount.innerHTML = '<p class="dam-widget__meta">Ładowanie stanów rękawków…</p>';
    await loadData(true);
    paint();
  }

  window.DamSleeveStock = {
    boot: boot,
    reload: boot,
    DAYS_PER_MONTH: DAYS_PER_MONTH,
    fmtHorizonHtml: fmtHorizonHtml,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
