/**
 * DAM - edytor / podsumowanie katalogu FMCG (Integracje + Kalkulator).
 * Zależność: bridge /finance/fmcg-* (catalog, import-map, compute).
 * CTA „Edytuj”: mapowanie kolumn + ręczne kwoty bez wymaganego CSV.
 */
(function (global) {
  "use strict";

  var STAGE_LABELS = {
    procurement: "Zamówienie i zakup",
    prepress: "Przygotowanie",
    production: "Produkcja",
    warehouse: "Magazyn",
    logistics: "Dostawa",
  };

  var META_CATALOG_IDS = {
    catalog_id: 1,
    amount: 1,
    _id_field: 1,
    _amount_field: 1,
  };

  var OVERLAY_ID = "damFmcgEditOverlay";
  var STYLE_ID = "damFmcgEditUi";

  function bridgeUrl() {
    if (global.DamPaths && typeof DamPaths.bridgeUrl === "function") {
      return DamPaths.bridgeUrl();
    }
    if (global.DamRuntime && typeof DamRuntime.bridgeUrl === "function") {
      return DamRuntime.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function authHeaders(json) {
    var h = {};
    if (global.DamApi && typeof DamApi.authHeaders === "function") {
      h = DamApi.authHeaders() || {};
    } else {
      h.Authorization = "Bearer " + (localStorage.getItem("dam_token") || "");
    }
    if (json !== false) h["Content-Type"] = "application/json";
    return h;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function summarize(catalog) {
    catalog = catalog || {};
    var items = catalog.items || [];
    var filled = 0;
    var byStage = {};
    Object.keys(STAGE_LABELS).forEach(function (s) {
      byStage[s] = { total: 0, filled: 0, amount: 0 };
    });
    items.forEach(function (it) {
      if (!it) return;
      var st = String(it.stage || "");
      if (!byStage[st]) byStage[st] = { total: 0, filled: 0, amount: 0 };
      byStage[st].total += 1;
      if (it.amount != null && it.amount !== "") {
        filled += 1;
        byStage[st].filled += 1;
        byStage[st].amount += Number(it.amount) || 0;
      }
    });
    return {
      item_count: items.length,
      filled_count: filled,
      missing_count: items.length - filled,
      by_stage: byStage,
      currency: catalog.currency || "PLN",
      imported_at: catalog.imported_at || null,
      version: catalog.version,
    };
  }

  function renderStageAccordion(catalog, mountEl) {
    if (!mountEl) return;
    var s = summarize(catalog);
    var html = Object.keys(STAGE_LABELS)
      .map(function (key) {
        var row = s.by_stage[key] || { total: 0, filled: 0, amount: 0 };
        var items = (catalog.items || []).filter(function (it) {
          return it && it.stage === key;
        });
        var rows = items
          .map(function (it) {
            var amt =
              it.amount == null || it.amount === ""
                ? '<span class="dam-fmcg-missing">brak danych</span>'
                : String(it.amount) + " " + (it.currency || "PLN");
            return (
              "<li><strong>" +
              esc(it.label_pl || it.id) +
              "</strong> · " +
              amt +
              ' <span class="dam-fmcg-chip">' +
              esc(it.source || "placeholder") +
              "</span></li>"
            );
          })
          .join("");
        return (
          '<details class="dam-fmcg-stage">' +
          "<summary>" +
          STAGE_LABELS[key] +
          " (" +
          row.filled +
          "/" +
          row.total +
          ")</summary>" +
          "<ul>" +
          (rows || "<li>-</li>") +
          "</ul></details>"
        );
      })
      .join("");
    mountEl.innerHTML =
      '<p class="dam-fmcg-summary">' +
      s.filled_count +
      " z " +
      s.item_count +
      " pozycji ma kwotę</p>" +
      html;
  }

  function ensureEditCss() {
    var s = document.getElementById(STYLE_ID);
    if (!s) {
      s = document.createElement("style");
      s.id = STYLE_ID;
      document.head.appendChild(s);
    }
    s.textContent =
      "body.dam-fmcg-edit-open,html.dam-fmcg-edit-open{overflow:hidden!important;}" +
      "#" +
      OVERLAY_ID +
      "{position:fixed;inset:0;z-index:12150;display:flex;align-items:center;" +
      "justify-content:center;padding:clamp(12px,2.5vh,28px) clamp(12px,2vw,28px);" +
      "background:rgba(18,18,22,.48);box-sizing:border-box;overscroll-behavior:none;" +
      "pointer-events:auto}" +
      "#" +
      OVERLAY_ID +
      "[hidden]{display:none!important}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit{" +
      "position:relative;display:flex;flex-direction:column;" +
      "width:min(80vw,1280px);height:min(80vh,900px);min-width:min(320px,100%);" +
      "min-height:min(360px,80vh);max-width:100%;max-height:100%;" +
      "overflow:hidden;background:#fff;border:1px solid #d8d8e0;border-radius:12px;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.18);padding:18px 20px 16px;" +
      "box-sizing:border-box;color:#1c1c22;overscroll-behavior:contain}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__head{display:flex;align-items:flex-start;justify-content:flex-start;" +
      "gap:12px;margin:0 0 12px;padding-right:44px;flex:0 0 auto;position:relative}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__title{margin:0;font-size:1.15rem;font-weight:650;letter-spacing:-.01em}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__sub{margin:4px 0 0;font-size:13px;color:#5c5c6a;line-height:1.35}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__close.dam-modal-x{position:absolute;top:0;right:0;z-index:3}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__tabs{display:flex;gap:6px;margin:0 0 12px;flex-wrap:wrap;flex:0 0 auto}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__tab{appearance:none;border:1px solid #d0d0d8;background:#f6f6f9;" +
      "color:#2a2a32;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:600;" +
      "cursor:pointer;min-height:40px}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__tab.is-active{background:#1c1c22;border-color:#1c1c22;color:#fff}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;" +
      "overflow:hidden}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__panel{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;" +
      "overflow:hidden}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__panel[hidden]{display:none!important}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__hint{margin:0 0 10px;font-size:12.5px;color:#5c5c6a;flex:0 0 auto}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__table-wrap{flex:1 1 auto;min-height:0;overflow:auto;" +
      "overscroll-behavior:contain;-webkit-overflow-scrolling:touch;" +
      "border:1px solid #e4e4ea;border-radius:8px;pointer-events:auto}" +
      "#" +
      OVERLAY_ID +
      " table.dam-fmcg-edit__table{width:100%;border-collapse:collapse;font-size:12.5px}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__table th{position:sticky;top:0;background:#f3f3f7;text-align:left;" +
      "padding:8px 8px;font-weight:650;border-bottom:1px solid #e0e0e8;z-index:1;" +
      "white-space:nowrap}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__table td{padding:6px 8px;border-bottom:1px solid #eeeef3;vertical-align:middle}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__table input," +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__table select{" +
      "width:100%;min-width:0;box-sizing:border-box;border:1px solid #d4d4dc;border-radius:6px;" +
      "padding:6px 8px;font:inherit;background:#fff;min-height:36px}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__empty{padding:18px 12px;text-align:center;color:#6a6a78;font-size:13px}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;" +
      "margin-top:14px;flex:0 0 auto}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__actions .dam-int-cta{min-height:40px}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__msg{margin:0 0 0 auto;font-size:12.5px;min-height:1.2em}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__msg.is-ok{color:#1a7a3c}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__msg.is-err{color:#b42318}" +
      "#" +
      OVERLAY_ID +
      " .dam-fmcg-edit__rm.dam-int-cta{min-height:32px;padding:4px 10px;font-size:12px}" +
      /* fallback CTA anatomy gdy dam-integrations.css nie zaladowany (np. dashboard) */
      "#" +
      OVERLAY_ID +
      " .dam-int-cta{display:inline-flex;align-items:center;justify-content:center;gap:6px;" +
      "min-height:34px;padding:8px 12px;margin:0;font:inherit;font-size:12px;font-weight:500;" +
      "line-height:1.2;border-radius:8px;border:1px solid #e7e7e7;background:#fff;color:#464255;" +
      "cursor:pointer;box-shadow:none;-webkit-appearance:none;appearance:none}" +
      "#" +
      OVERLAY_ID +
      " .dam-int-cta:hover{border-color:var(--dam-primary,#ab54db);background:#fbf7fe;" +
      "color:var(--dam-primary,#ab54db)}" +
      "#" +
      OVERLAY_ID +
      " .dam-int-cta:focus-visible{outline:2px solid color-mix(in srgb,var(--dam-primary,#ab54db) 55%,transparent);" +
      "outline-offset:2px}" +
      ".dam-int-fmcg-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}" +
      ".dam-int-fmcg-actions .dam-int-cta," +
      ".dam-int-fmcg-actions label.dam-int-cta{width:fit-content;min-height:34px}";
  }

  var _bodyLockCount = 0;
  var _prevBodyOverflow = "";
  var _prevHtmlOverflow = "";

  function lockPageScroll() {
    _bodyLockCount += 1;
    if (_bodyLockCount !== 1) return;
    _prevBodyOverflow = document.body.style.overflow || "";
    _prevHtmlOverflow = document.documentElement.style.overflow || "";
    document.body.classList.add("dam-fmcg-edit-open");
    document.documentElement.classList.add("dam-fmcg-edit-open");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }

  function unlockPageScroll() {
    _bodyLockCount = Math.max(0, _bodyLockCount - 1);
    if (_bodyLockCount !== 0) return;
    document.body.classList.remove("dam-fmcg-edit-open");
    document.documentElement.classList.remove("dam-fmcg-edit-open");
    document.body.style.overflow = _prevBodyOverflow;
    document.documentElement.style.overflow = _prevHtmlOverflow;
  }

  function onOverlayWheel(ev) {
    var root = document.getElementById(OVERLAY_ID);
    if (!root || root.hidden) return;
    var wrap = ev.target && ev.target.closest
      ? ev.target.closest(".dam-fmcg-edit__table-wrap")
      : null;
    if (wrap && root.contains(wrap)) {
      var dy = ev.deltaY || 0;
      var can = wrap.scrollHeight > wrap.clientHeight + 1;
      if (!can) {
        ev.preventDefault();
        return;
      }
      var top = wrap.scrollTop <= 0;
      var bottom = wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 1;
      if ((dy < 0 && top) || (dy > 0 && bottom)) {
        ev.preventDefault();
      }
      ev.stopPropagation();
      return;
    }
    /* wheel poza scrollportem tabeli - nie przewijaj tla */
    ev.preventDefault();
    ev.stopPropagation();
  }

  function onOverlayTouchMove(ev) {
    var root = document.getElementById(OVERLAY_ID);
    if (!root || root.hidden) return;
    var wrap = ev.target && ev.target.closest
      ? ev.target.closest(".dam-fmcg-edit__table-wrap")
      : null;
    if (wrap && root.contains(wrap)) return;
    ev.preventDefault();
  }

  function fetchJson(url, opts) {
    opts = opts || {};
    return fetch(url, opts).then(function (r) {
      return r.json().then(function (data) {
        return { httpOk: r.ok, data: data };
      });
    });
  }

  function loadCatalog() {
    return fetchJson(bridgeUrl() + "/finance/fmcg-catalog", {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then(function (res) {
        if (res.httpOk && res.data && res.data.ok !== false) {
          return {
            version: res.data.version || 1,
            currency: res.data.currency || "PLN",
            imported_at: res.data.imported_at || null,
            stages: res.data.stages || Object.keys(STAGE_LABELS),
            items: Array.isArray(res.data.items) ? res.data.items : [],
          };
        }
        return fetch("data/fmcg-cost-catalog.json?v=" + Date.now(), { cache: "no-store" }).then(
          function (r) {
            return r.json();
          }
        );
      })
      .catch(function () {
        return fetch("data/fmcg-cost-catalog.json?v=" + Date.now(), { cache: "no-store" }).then(
          function (r) {
            return r.json();
          }
        );
      });
  }

  function loadImportMap() {
    return fetchJson(bridgeUrl() + "/finance/fmcg-import-map", {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then(function (res) {
        if (res.httpOk && res.data && res.data.ok !== false) {
          return {
            version: res.data.version || 1,
            maps: Array.isArray(res.data.maps) ? res.data.maps : [],
          };
        }
        return fetch("data/fmcg-cost-import-map.json?v=" + Date.now(), { cache: "no-store" }).then(
          function (r) {
            return r.json();
          }
        );
      })
      .catch(function () {
        return fetch("data/fmcg-cost-import-map.json?v=" + Date.now(), { cache: "no-store" })
          .then(function (r) {
            return r.json();
          })
          .catch(function () {
            return { version: 1, maps: [] };
          });
      });
  }

  function stageOptions(selected) {
    return Object.keys(STAGE_LABELS)
      .map(function (k) {
        return (
          '<option value="' +
          esc(k) +
          '"' +
          (k === selected ? " selected" : "") +
          ">" +
          esc(STAGE_LABELS[k]) +
          "</option>"
        );
      })
      .join("");
  }

  function catalogIdOptions(items, selected) {
    var opts =
      '<option value="">- wybierz -</option>' +
      '<option value="catalog_id"' +
      (selected === "catalog_id" ? " selected" : "") +
      ">catalog_id (meta)</option>" +
      '<option value="amount"' +
      (selected === "amount" ? " selected" : "") +
      ">amount (meta)</option>";
    (items || []).forEach(function (it) {
      if (!it || !it.id) return;
      opts +=
        '<option value="' +
        esc(it.id) +
        '"' +
        (it.id === selected ? " selected" : "") +
        ">" +
        esc((it.label_pl || it.id) + " [" + it.id + "]") +
        "</option>";
    });
    if (selected && !META_CATALOG_IDS[selected]) {
      var known = (items || []).some(function (it) {
        return it && it.id === selected;
      });
      if (!known) {
        opts +=
          '<option value="' +
          esc(selected) +
          '" selected>' +
          esc(selected) +
          " (spoza katalogu)</option>";
      }
    }
    return opts;
  }

  function setMsg(el, text, ok) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("is-ok", "is-err");
    if (text) el.classList.add(ok ? "is-ok" : "is-err");
  }

  function collectMaps(root) {
    var rows = root.querySelectorAll("[data-fmcg-map-row]");
    var maps = [];
    rows.forEach(function (tr) {
      var col = tr.querySelector('[name="column"]');
      var cid = tr.querySelector('[name="catalog_id"]');
      var column = col ? String(col.value || "").trim() : "";
      var catalogId = cid ? String(cid.value || "").trim() : "";
      if (!column && !catalogId) return;
      maps.push({ column: column, catalog_id: catalogId });
    });
    return maps;
  }

  function collectItems(root) {
    var rows = root.querySelectorAll("[data-fmcg-item-row]");
    var items = [];
    rows.forEach(function (tr) {
      var idEl = tr.querySelector('[name="id"]');
      var labelEl = tr.querySelector('[name="label_pl"]');
      var stageEl = tr.querySelector('[name="stage"]');
      var amtEl = tr.querySelector('[name="amount"]');
      var vendorEl = tr.querySelector('[name="vendor"]');
      var pid = idEl ? String(idEl.value || "").trim() : "";
      if (!pid) return;
      var amtRaw = amtEl ? String(amtEl.value || "").trim() : "";
      var amount = null;
      if (amtRaw !== "") {
        var n = Number(String(amtRaw).replace(",", ".").replace(/\s/g, ""));
        amount = isFinite(n) ? n : amtRaw;
      }
      items.push({
        id: pid,
        label_pl: labelEl ? String(labelEl.value || "").trim() || pid : pid,
        stage: stageEl ? String(stageEl.value || "procurement") : "procurement",
        amount: amount,
        vendor: vendorEl ? String(vendorEl.value || "").trim() : "",
        source: amount == null ? "placeholder" : "manual",
      });
    });
    return items;
  }

  function renderMapRows(maps, items) {
    maps = maps || [];
    if (!maps.length) {
      return (
        '<tr><td colspan="3" class="dam-fmcg-edit__empty">' +
        "Brak mapowań. Dodaj wiersz albo zostaw puste - import CSV i tak zadziała na kolumnach catalog_id/amount." +
        "</td></tr>"
      );
    }
    return maps
      .map(function (m, idx) {
        return (
          '<tr data-fmcg-map-row data-idx="' +
          idx +
          '">' +
          '<td><input name="column" type="text" value="' +
          esc(m.column || "") +
          '" placeholder="Kolumna CSV" autocomplete="off"></td>' +
          "<td><select name=\"catalog_id\">" +
          catalogIdOptions(items, m.catalog_id || "") +
          "</select></td>" +
          '<td><button type="button" class="dam-int-cta dam-fmcg-edit__rm" data-fmcg-rm-map ' +
          'data-dam-hold-delete data-dam-hold-ms="1000" data-dam-label="Usuń" ' +
          'data-dam-hint="Spróbuj przytrzymać, by usunąć" aria-label="Usuń">Usuń</button></td>' +
          "</tr>"
        );
      })
      .join("");
  }

  function renderItemRows(items) {
    items = items || [];
    if (!items.length) {
      return (
        '<tr><td colspan="6" class="dam-fmcg-edit__empty">' +
        "Brak pozycji w katalogu. Dodaj wiersz ręcznie - plik CSV nie jest wymagany." +
        "</td></tr>"
      );
    }
    return items
      .map(function (it, idx) {
        var amt =
          it.amount == null || it.amount === "" ? "" : String(it.amount);
        return (
          '<tr data-fmcg-item-row data-idx="' +
          idx +
          '">' +
          '<td><input name="id" type="text" value="' +
          esc(it.id || "") +
          '" placeholder="id" autocomplete="off"></td>' +
          '<td><input name="label_pl" type="text" value="' +
          esc(it.label_pl || "") +
          '" placeholder="Nazwa" autocomplete="off"></td>' +
          "<td><select name=\"stage\">" +
          stageOptions(it.stage || "procurement") +
          "</select></td>" +
          '<td><input name="amount" type="text" inputmode="decimal" value="' +
          esc(amt) +
          '" placeholder="-" autocomplete="off"></td>' +
          '<td><input name="vendor" type="text" value="' +
          esc(it.vendor || "") +
          '" placeholder="Dostawca" autocomplete="off"></td>' +
          '<td><button type="button" class="dam-int-cta dam-fmcg-edit__rm" data-fmcg-rm-item ' +
          'data-dam-hold-delete data-dam-hold-ms="1000" data-dam-label="Usuń" ' +
          'data-dam-hint="Spróbuj przytrzymać, by usunąć" aria-label="Usuń">Usuń</button></td>' +
          "</tr>"
        );
      })
      .join("");
  }

  function ensureOverlay() {
    ensureEditCss();
    var el = document.getElementById(OVERLAY_ID);
    if (el) {
      /* migrate: stary fat Zamknij CTA -> cichy X; Zapisz geex -> dam-int-cta */
      var oldClose = el.querySelector(
        "[data-fmcg-edit-close]:not(.dam-modal-x)"
      );
      if (oldClose) {
        var head = el.querySelector(".dam-fmcg-edit__head");
        if (head) {
          oldClose.remove();
          if (!head.querySelector(".dam-fmcg-edit__close")) {
            var x = document.createElement("button");
            x.type = "button";
            x.className = "dam-modal-x dam-fmcg-edit__close";
            x.setAttribute("data-fmcg-edit-close", "");
            x.setAttribute("aria-label", "Zamknij");
            x.innerHTML = '<i class="uil uil-times" aria-hidden="true"></i>';
            head.appendChild(x);
          }
        }
      }
      var saveBtn = el.querySelector("[data-fmcg-save]");
      if (saveBtn) {
        saveBtn.className = "dam-int-cta";
      }
      var card = el.querySelector(".dam-fmcg-edit");
      if (card && !el.querySelector(".dam-fmcg-edit__body")) {
        /* soft rebuild if structure too old */
        el.remove();
        el = null;
      }
    }
    if (el) return el;
    el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "damFmcgEditTitle");
    el.innerHTML =
      '<div class="dam-fmcg-edit" data-fmcg-edit-card>' +
      '<div class="dam-fmcg-edit__head">' +
      "<div>" +
      '<h2 class="dam-fmcg-edit__title" id="damFmcgEditTitle">Edytuj katalog FMCG</h2>' +
      '<p class="dam-fmcg-edit__sub">Mapowanie pól CSV i ręczne kwoty - bez wymaganego pliku.</p>' +
      "</div>" +
      '<button type="button" class="dam-modal-x dam-fmcg-edit__close" data-fmcg-edit-close ' +
      'aria-label="Zamknij"><i class="uil uil-times" aria-hidden="true"></i></button>' +
      "</div>" +
      '<div class="dam-fmcg-edit__tabs" role="tablist">' +
      '<button type="button" class="dam-fmcg-edit__tab is-active" data-fmcg-tab="map" role="tab">Mapowanie</button>' +
      '<button type="button" class="dam-fmcg-edit__tab" data-fmcg-tab="data" role="tab">Dane ręczne</button>' +
      "</div>" +
      '<div class="dam-fmcg-edit__body">' +
      '<div class="dam-fmcg-edit__panel" data-fmcg-panel="map" role="tabpanel">' +
      '<p class="dam-fmcg-edit__hint">Kolumna z pliku CSV → pozycja w katalogu kosztów. Meta catalog_id / amount sterują polami identyfikatora i kwoty.</p>' +
      '<div class="dam-fmcg-edit__table-wrap" tabindex="0"><table class="dam-fmcg-edit__table"><thead><tr>' +
      "<th>Kolumna CSV</th><th>Pole katalogu</th><th></th>" +
      "</tr></thead><tbody data-fmcg-map-body></tbody></table></div>" +
      "</div>" +
      '<div class="dam-fmcg-edit__panel" data-fmcg-panel="data" role="tabpanel" hidden>' +
      '<p class="dam-fmcg-edit__hint">Wpisz kwoty ręcznie. Puste amount = brak danych (nie blokuje zapisu).</p>' +
      '<div class="dam-fmcg-edit__table-wrap" tabindex="0"><table class="dam-fmcg-edit__table"><thead><tr>' +
      "<th>ID</th><th>Nazwa</th><th>Etap</th><th>Kwota</th><th>Dostawca</th><th></th>" +
      "</tr></thead><tbody data-fmcg-item-body></tbody></table></div>" +
      "</div>" +
      "</div>" +
      '<div class="dam-fmcg-edit__actions">' +
      '<button type="button" class="dam-int-cta" data-fmcg-add-map>+ Mapowanie</button>' +
      '<button type="button" class="dam-int-cta" data-fmcg-add-item>+ Pozycja</button>' +
      '<button type="button" class="dam-int-cta" data-fmcg-save>Zapisz</button>' +
      '<p class="dam-fmcg-edit__msg" data-fmcg-edit-msg></p>' +
      "</div>" +
      "</div>";
    document.body.appendChild(el);
    return el;
  }

  function switchTab(root, tab) {
    root.querySelectorAll("[data-fmcg-tab]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-fmcg-tab") === tab);
    });
    root.querySelectorAll("[data-fmcg-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-fmcg-panel") !== tab;
    });
  }

  function paintEditor(state) {
    var root = ensureOverlay();
    var mapBody = root.querySelector("[data-fmcg-map-body]");
    var itemBody = root.querySelector("[data-fmcg-item-body]");
    if (mapBody) mapBody.innerHTML = renderMapRows(state.maps, state.items);
    if (itemBody) itemBody.innerHTML = renderItemRows(state.items);
    root._fmcgState = state;
  }

  function bindOverlayOnce(root, onSaved) {
    if (root._fmcgBound) return;
    root._fmcgBound = true;

    root.addEventListener(
      "wheel",
      onOverlayWheel,
      { passive: false, capture: true }
    );
    root.addEventListener(
      "touchmove",
      onOverlayTouchMove,
      { passive: false, capture: true }
    );

    root.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t === root || t.closest("[data-fmcg-edit-close]")) {
        closeEditor();
        return;
      }
      var tabBtn = t.closest("[data-fmcg-tab]");
      if (tabBtn) {
        switchTab(root, tabBtn.getAttribute("data-fmcg-tab"));
        return;
      }
      if (t.closest("[data-fmcg-add-map]")) {
        var st = root._fmcgState || { maps: [], items: [] };
        st.maps = collectMaps(root);
        st.items = collectItems(root);
        st.maps.push({ column: "", catalog_id: "" });
        root._fmcgState = st;
        var mapBody = root.querySelector("[data-fmcg-map-body]");
        if (mapBody) mapBody.innerHTML = renderMapRows(st.maps, st.items);
        switchTab(root, "map");
        return;
      }
      if (t.closest("[data-fmcg-add-item]")) {
        var st2 = root._fmcgState || { maps: [], items: [] };
        st2.maps = collectMaps(root);
        st2.items = collectItems(root);
        st2.items.push({
          id: "",
          label_pl: "",
          stage: "procurement",
          amount: null,
          vendor: "",
          source: "manual",
        });
        root._fmcgState = st2;
        var itemBody = root.querySelector("[data-fmcg-item-body]");
        if (itemBody) itemBody.innerHTML = renderItemRows(st2.items);
        switchTab(root, "data");
        return;
      }
      if (t.closest("[data-fmcg-rm-map]")) {
        var tr = t.closest("[data-fmcg-map-row]");
        if (tr) tr.remove();
        var mb = root.querySelector("[data-fmcg-map-body]");
        var st3 = root._fmcgState || { maps: [], items: [] };
        st3.maps = collectMaps(root);
        st3.items = collectItems(root);
        root._fmcgState = st3;
        if (mb && !mb.querySelector("[data-fmcg-map-row]")) {
          mb.innerHTML = renderMapRows([], st3.items);
        }
        return;
      }
      if (t.closest("[data-fmcg-rm-item]")) {
        var tr2 = t.closest("[data-fmcg-item-row]");
        if (tr2) tr2.remove();
        var ib = root.querySelector("[data-fmcg-item-body]");
        var st4 = root._fmcgState || { maps: [], items: [] };
        st4.maps = collectMaps(root);
        st4.items = collectItems(root);
        root._fmcgState = st4;
        if (ib && !ib.querySelector("[data-fmcg-item-row]")) {
          ib.innerHTML = renderItemRows([]);
        }
        return;
      }
      if (t.closest("[data-fmcg-save]")) {
        saveEditor(root, onSaved);
      }
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && root && !root.hidden) closeEditor();
    });
  }

  function mergeCatalogItems(root, edited) {
    var prev = (root._fmcgState && root._fmcgState.items) || [];
    var byId = {};
    prev.forEach(function (it) {
      if (it && it.id) byId[String(it.id)] = it;
    });
    return edited.map(function (row) {
      var base = byId[row.id] ? Object.assign({}, byId[row.id]) : {};
      return Object.assign({}, base, {
        id: row.id,
        label_pl: row.label_pl,
        stage: row.stage,
        amount: row.amount,
        vendor: row.vendor,
        source: row.source || base.source || "manual",
        currency: base.currency || (root._fmcgState && root._fmcgState.currency) || "PLN",
        unit: base.unit || "per_order",
        asana_keywords: Array.isArray(base.asana_keywords) ? base.asana_keywords : [],
        notes: base.notes || "",
      });
    });
  }

  function saveEditor(root, onSaved) {
    var msg = root.querySelector("[data-fmcg-edit-msg]");
    var saveBtn = root.querySelector("[data-fmcg-save]");
    var maps = collectMaps(root);
    var edited = collectItems(root);
    var items = mergeCatalogItems(root, edited);
    setMsg(msg, "Zapisywanie…", true);
    if (saveBtn) saveBtn.disabled = true;

    var mapReq = fetchJson(bridgeUrl() + "/finance/fmcg-import-map", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ version: 1, maps: maps }),
    });

    var catReq = fetchJson(bridgeUrl() + "/finance/fmcg-catalog", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        action: "replace",
        catalog: {
          version: (root._fmcgState && root._fmcgState.version) || 1,
          currency: (root._fmcgState && root._fmcgState.currency) || "PLN",
          imported_at: (root._fmcgState && root._fmcgState.imported_at) || null,
          stages:
            (root._fmcgState && root._fmcgState.stages) || Object.keys(STAGE_LABELS),
          items: items,
        },
      }),
    });

    Promise.all([mapReq, catReq])
      .then(function (results) {
        var mapRes = results[0];
        var catRes = results[1];
        var mapOk = mapRes.httpOk && mapRes.data && mapRes.data.ok !== false;
        var catOk = catRes.httpOk && catRes.data && catRes.data.ok !== false;
        if (mapOk && catOk) {
          setMsg(
            msg,
            "Zapisano mapowanie (" +
              (mapRes.data.map_count != null ? mapRes.data.map_count : maps.length) +
              ") i katalog (" +
              (catRes.data.item_count != null ? catRes.data.item_count : items.length) +
              ").",
            true
          );
          if (typeof onSaved === "function") onSaved({ maps: maps, items: items });
          return;
        }
        var err =
          (!mapOk && mapRes.data && (mapRes.data.error || mapRes.data.hint)) ||
          (!catOk && catRes.data && (catRes.data.error || catRes.data.hint)) ||
          "Błąd zapisu (wymagany admin / bridge).";
        setMsg(msg, String(err), false);
      })
      .catch(function () {
        setMsg(msg, "Bridge offline.", false);
      })
      .then(function () {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function closeEditor() {
    var el = document.getElementById(OVERLAY_ID);
    if (!el || el.hidden) return;
    el.hidden = true;
    unlockPageScroll();
  }

  /**
   * Otwórz edytor mapowania + danych ręcznych.
   * @param {{ onSaved?: function }} [opts]
   */
  function openEditor(opts) {
    opts = opts || {};
    ensureEditCss();
    var root = ensureOverlay();
    bindOverlayOnce(root, opts.onSaved);
    setMsg(root.querySelector("[data-fmcg-edit-msg]"), "Ładowanie…", true);
    if (root.hidden) lockPageScroll();
    root.hidden = false;
    switchTab(root, "map");
    if (global.DamUserPrefs && typeof DamUserPrefs.load === "function") {
      DamUserPrefs.load();
    }

    Promise.all([loadCatalog(), loadImportMap()])
      .then(function (pair) {
        var catalog = pair[0] || {};
        var imap = pair[1] || {};
        var state = {
          version: catalog.version || 1,
          currency: catalog.currency || "PLN",
          imported_at: catalog.imported_at || null,
          stages: catalog.stages || Object.keys(STAGE_LABELS),
          items: Array.isArray(catalog.items) ? catalog.items.slice() : [],
          maps: Array.isArray(imap.maps) ? imap.maps.slice() : [],
        };
        paintEditor(state);
        setMsg(root.querySelector("[data-fmcg-edit-msg]"), "", true);
      })
      .catch(function () {
        paintEditor({ version: 1, currency: "PLN", items: [], maps: [] });
        setMsg(
          root.querySelector("[data-fmcg-edit-msg]"),
          "Nie udało się wczytać danych - możesz dodać wiersze ręcznie.",
          false
        );
      });
  }

  global.DamFmcgCatalog = {
    STAGE_LABELS: STAGE_LABELS,
    summarize: summarize,
    renderStageAccordion: renderStageAccordion,
    openEditor: openEditor,
    closeEditor: closeEditor,
    loadCatalog: loadCatalog,
    loadImportMap: loadImportMap,
  };
})(typeof window !== "undefined" ? window : globalThis);
