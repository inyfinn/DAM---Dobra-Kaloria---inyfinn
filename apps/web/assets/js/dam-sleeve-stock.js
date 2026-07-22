/**
 * DamSleeveStock - panel STANY RĘKAWKÓW na integrations.html
 * (pod Wykrojniki ↔ produkty). Bridge GET /sleeve-stock + reimport/import.
 */
(function () {
  "use strict";

  var STYLE_ID = "dam-sleeve-stock-inject";
  var MOUNT_ID = "damSleeveStock";
  var state = {
    data: null,
    filter: "",
    tagFilter: "all",
    busy: "",
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

  function ensureCss() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      ".dam-sleeve-stock.dam-int-card{padding:18px 20px 22px;display:flex;flex-direction:column;gap:14px;margin-top:20px}" +
      ".dam-sleeve-stock__title{margin:0;font-size:1.15rem;font-weight:650}" +
      ".dam-sleeve-stock__purpose{margin:4px 0 0;font-size:13px;line-height:1.45;color:#5c5c6a;max-width:70ch}" +
      ".dam-sleeve-stock__meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
      ".dam-sleeve-stock__chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:12px;background:#f0eef6;color:#3d2a55;border:1px solid #e2dced}" +
      ".dam-sleeve-stock__actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
      ".dam-sleeve-stock__toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}" +
      ".dam-sleeve-stock__filters{display:flex;flex-wrap:wrap;gap:6px}" +
      ".dam-sleeve-stock__filter{border:1px solid #ddd;background:#fff;border-radius:999px;padding:5px 12px;font-size:12px;cursor:pointer}" +
      ".dam-sleeve-stock__filter.is-active{background:color-mix(in srgb,var(--dam-primary,#ab54db) 14%,#fff);border-color:color-mix(in srgb,var(--dam-primary,#ab54db) 45%,#ccc);color:#4a1f6b;font-weight:600}" +
      ".dam-sleeve-stock__search{min-width:200px;max-width:280px}" +
      ".dam-sleeve-stock__table-wrap{overflow:auto;max-height:min(62vh,640px);border:1px solid #e8e8ee;border-radius:12px}" +
      ".dam-sleeve-stock__table{width:100%;border-collapse:collapse;font-size:12.5px}" +
      ".dam-sleeve-stock__table th,.dam-sleeve-stock__table td{padding:8px 10px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}" +
      ".dam-sleeve-stock__table th{position:sticky;top:0;background:#f7f7fa;z-index:1;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:#666}" +
      ".dam-sleeve-stock__table tr.is-critical{background:#fff5f4}" +
      ".dam-sleeve-stock__num{font-variant-numeric:tabular-nums;white-space:nowrap}" +
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
      ".dam-sleeve-stock__lead{color:#b54708;font-weight:600;white-space:nowrap}";
    document.head.appendChild(st);
  }

  function fmtNum(n) {
    if (n == null || n === "") return "—";
    var v = Number(n);
    if (!isFinite(v)) return "—";
    return Math.round(v)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function fmtMonths(n) {
    if (n == null || n === "") return "—";
    var v = Number(n);
    if (!isFinite(v)) return "—";
    return v.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
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

  function paint() {
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) return;
    ensureCss();
    var data = state.data || {};
    var rows = filtered();
    var people = data.stakeholders || {};
    var zakupy = (people.zakupy || []).join(", ");
    var inni = (people.inni || []).join(", ");
    var sched = data.schedule_lead_days || {};

    mount.innerHTML =
      '<article class="dam-int-card dam-sleeve-stock" data-sleeve-stock="1">' +
      '<div><h3 class="dam-sleeve-stock__title">Stany rękawków</h3>' +
      '<p class="dam-sleeve-stock__purpose">Zapasy opakowań (rękawy / kartoniki) z działu zakupów. Tagi ostrzegają o niskim zapasie, zamówieniach i przejściach na nowy rękaw. Lead time grafiki (orientacyjnie): nowy produkt ' +
      esc(String(sched.new_product_existing_die || 46)) +
      " d.r., nowy smak " +
      esc(String(sched.new_flavor_family || 30)) +
      " d.r., przeformatowanie " +
      esc(String(sched.reformat || 19)) +
      " d.r.</p></div>" +
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
      '<div class="dam-sleeve-stock__table-wrap"><table class="dam-sleeve-stock__table"><thead><tr>' +
      "<th>Kod</th><th>Nazwa</th><th>Zużycie / msc</th><th>STAN</th><th>Zapas msc</th><th>W zam.</th><th>Z zam. msc</th><th>Tagi</th><th>Wykrojnik</th><th>Kom.</th>" +
      "</tr></thead><tbody>" +
      (rows.length
        ? rows
            .map(function (e) {
              var crit = (e.tags || []).indexOf("critical") !== -1;
              var lead =
                e.order_lead_weeks != null
                  ? '<div class="dam-sleeve-stock__lead">Zamów ≥' +
                    esc(String(e.order_lead_weeks)) +
                    " tyg. wcześniej</div>"
                  : "";
              return (
                '<tr class="' +
                (crit ? "is-critical" : "") +
                '">' +
                '<td class="dam-sleeve-stock__num"><strong>' +
                esc(e.article_code) +
                "</strong>" +
                (e.automat_alias_code
                  ? '<div class="dam-sleeve-stock__hint">→ ' +
                    esc(e.automat_alias_code) +
                    "</div>"
                  : "") +
                "</td>" +
                "<td>" +
                esc(e.name) +
                (e.extra_name
                  ? '<div class="dam-sleeve-stock__hint">' + esc(e.extra_name) + "</div>"
                  : "") +
                lead +
                "</td>" +
                '<td class="dam-sleeve-stock__num">' +
                esc(fmtNum(e.avg_monthly_usage)) +
                "</td>" +
                '<td class="dam-sleeve-stock__num"><strong>' +
                esc(fmtNum(e.stock)) +
                "</strong></td>" +
                '<td class="dam-sleeve-stock__num">' +
                esc(fmtMonths(e.months_of_stock)) +
                "</td>" +
                '<td class="dam-sleeve-stock__num">' +
                esc(fmtNum(e.on_order || 0)) +
                "</td>" +
                '<td class="dam-sleeve-stock__num">' +
                esc(fmtMonths(e.months_with_order)) +
                "</td>" +
                "<td>" +
                tagHtml(e.tags) +
                "</td>" +
                "<td>" +
                esc(e.die_type || "—") +
                "</td>" +
                "<td>" +
                esc(e.comment || "—") +
                "</td>" +
                "</tr>"
              );
            })
            .join("")
        : '<tr><td colspan="10">Brak pozycji dla filtra.</td></tr>') +
      "</tbody></table></div>" +
      '<p class="dam-sleeve-stock__hint">Źródło: ' +
      esc(data.source_xlsx || "sleeve-stock.json") +
      ". Import nadpisuje listę z XLSX / CSV (admin).</p>" +
      "</article>";

    bind();
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

  window.DamSleeveStock = { boot: boot, reload: boot };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
