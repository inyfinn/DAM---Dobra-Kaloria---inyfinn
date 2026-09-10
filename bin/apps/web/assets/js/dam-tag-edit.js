/**
 * DAM - Faza 4 (2026-07-18): edycja typu (nosnika) dla WSZYSTKICH rol.
 * Wybor w liscie = podgląd (pending). Zatwierdz (zielony check) / Anuluj (czerwony X).
 * Opcja BRAK TYPU. Admin: dblclick <=500ms lub Shift+klik otwiera picker.
 */
(function (global) {
  "use strict";

  var NONE_CODE = "NONE";

  function bridgeUrl() {
    return (global.DamPaths && typeof global.DamPaths.bridgeUrl === "function" && global.DamPaths.bridgeUrl()) || "http://127.0.0.1:8766";
  }

  function role() {
    return String((global.DamApi && typeof global.DamApi.role === "function" && global.DamApi.role()) || localStorage.getItem("dam_role") || "user").toLowerCase();
  }

  function isPrivileged() {
    var r = role();
    return r === "admin" || r === "power_user";
  }

  /** Tylko admin zatwierdza kanoniczna baze / dysk (power_user tez tylko zglaszа). */
  function isAdmin() {
    return role() === "admin";
  }

  function adminModeOn() {
    return localStorage.getItem("dam_admin_mode") === "1" || localStorage.getItem("dam_viz_admin_mode") === "1";
  }

  function bridgeAuthHeaders() {
    if (global.DamApi && typeof global.DamApi.authHeaders === "function") {
      return global.DamApi.authHeaders();
    }
    var t = localStorage.getItem("dam_token") || "";
    return {
      Authorization: "Bearer " + t,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  function userLabel() {
    try {
      var u = JSON.parse(localStorage.getItem("dam_user") || "null");
      return (u && (u.email || u.name)) || localStorage.getItem("dam_user_name") || "anonim";
    } catch (e) {
      return localStorage.getItem("dam_user_name") || "anonim";
    }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(msg) {
    var el = document.getElementById("damVizToast") || document.getElementById("damExplorerToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damTagEditToast";
      el.className = "dam-explorer-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 3600);
  }

  function allCarrierTypes() {
    var out = {};
    var naming = (global.DamNaming && global.DamNaming.carriers) || {};
    Object.keys(naming).forEach(function (code) {
      var short =
        naming[code].short ||
        (global.DamLabels && global.DamLabels.CARRIER_SHORTS && global.DamLabels.CARRIER_SHORTS[code]) ||
        code;
      var long = naming[code].label_pl || code;
      // Lista w UI: pelna nazwa; skrot w nawiasie (na dysku bedzie DOY)
      out[code] = short && short !== long ? long + " (" + short + ")" : long;
    });
    try {
      var custom = JSON.parse(localStorage.getItem("dam_carrier_types_cache") || "null");
      if (custom && custom.custom_types) {
        Object.keys(custom.custom_types).forEach(function (code) {
          var ct = custom.custom_types[code];
          var short = (ct && ct.short) || code;
          var long = (ct && ct.label_pl) || code;
          out[code] = short && short !== long ? long + " (" + short + ")" : long;
        });
      }
      if (custom && custom.deleted_types) {
        Object.keys(custom.deleted_types).forEach(function (code) {
          delete out[code];
        });
      }
    } catch (e) {
      /* brak cache - tylko naming-dictionary */
    }
    return out;
  }

  function refreshCarrierTypesCache() {
    fetch(bridgeUrl() + "/carrier-types")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        localStorage.setItem("dam_carrier_types_cache", JSON.stringify(data));
      })
      .catch(function () {
        /* offline - uzyj cache/naming-dictionary */
      });
  }

  function closePopover() {
    var pop = document.getElementById("damTagEditPopover");
    if (pop) {
      if (pop._damTagSearchTimer) clearTimeout(pop._damTagSearchTimer);
      if (typeof pop._damTagPopCleanup === "function") pop._damTagPopCleanup();
      pop.remove();
    }
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onDocKey, true);
    _tagPickerOpening = false;
  }

  function onDocClick(e) {
    var pop = document.getElementById("damTagEditPopover");
    if (pop && !pop.contains(e.target)) closePopover();
  }
  function onDocKey(e) {
    if (e.key === "Escape") closePopover();
  }

  function pathBrandHint(revisionPath) {
    var p = String(revisionPath || "").replace(/\\/g, "/").toUpperCase();
    if (p.indexOf("/- GC/") >= 0 || p.indexOf("/GC/") >= 0 || /\/-?\s*GC\b/.test(p)) return "GC";
    if (p.indexOf("/- DK/") >= 0 || p.indexOf("/DK/") >= 0 || /\/-?\s*DK\b/.test(p)) return "DK";
    return "";
  }

  function confirmBrandSafety(ctx, newCode) {
    var pathBrand = pathBrandHint(ctx.revisionPath);
    if (!pathBrand) return true;
    var label = String(newCode || "").toUpperCase();
    var types = allCarrierTypes();
    var typedLabel = (types[newCode] || newCode || "").toUpperCase();
    /* Zmiana marki w tagach brand - osobna ścieżka. Tu: ostrzezenie gdy folder GC a user
       ustawia cos typowo DK-only nie dotyczy nosnika. Ostrzezenie brand jest w openBrandConfirm. */
    void typedLabel;
    void label;
    return true;
  }

  /** Potwierdzenie gdy admin zmienia tag marki sprzeczny ze ścieżka folderu. */
  function confirmBrandTagChange(revisionPath, newBrand) {
    var pathBrand = pathBrandHint(revisionPath);
    var nb = String(newBrand || "").toUpperCase();
    if (!pathBrand || !nb || pathBrand === nb) return true;
    return window.confirm(
      "Folder lezy pod marka " +
        pathBrand +
        ", a ustawiasz tag " +
        nb +
        ". Na pewno chcesz ta zmiane? (czasem indeks jest blednie wykryty - to zabezpieczenie)"
    );
  }

  function submitCarrierChange(ctx, newCode) {
    if (!confirmBrandSafety(ctx, newCode)) return Promise.resolve({ ok: false });
    var payload = {
      revision_path: ctx.revisionPath,
      product_id: ctx.productId,
      product_name: ctx.productName,
      current_carrier_code: ctx.currentCode || "",
      new_carrier_code: newCode,
      /* role/admin_mode: UX; bridge bierze privilege z Bearer sesji */
      role: role(),
      admin_mode: isAdmin() && adminModeOn(),
      user_email: userLabel(),
      user_name: userLabel(),
    };
    return fetch(bridgeUrl() + "/rename-revision-prefix", {
      method: "POST",
      headers: bridgeAuthHeaders(),
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (res) {
          res._http = r.status;
          return res;
        });
      })
      .then(function (res) {
        if (!res.ok) {
          showToast(
            "Blad: " +
              (res.error || "nie udalo sie zapisac") +
              (res.hint ? " - " + res.hint : "")
          );
          return res;
        }
        res.new_carrier_code = newCode === NONE_CODE ? "" : newCode;
        if (res.immediate) {
          var shown = newCode === NONE_CODE ? "BRAK TYPU" : newCode;
          var nFiles = res.file_rename_count || (res.file_renames && res.file_renames.length) || 0;
          showToast(
            "Typ zmieniony na " +
              shown +
              " - zapisano na dysku" +
              (nFiles ? " (+" + nFiles + " plikow)" : "") +
              "."
          );
          /* Po zatwierdzeniu znika "?" (carrier_guessed) - odśwież badge w DOM */
          try {
            document.querySelectorAll(".dam-viz-badge--guessed").forEach(function (el) {
              var rp = el.getAttribute("data-revision-path") || "";
              if (
                rp &&
                (rp === (ctx.revisionPath || "") ||
                  rp === (res.old_path || "") ||
                  rp === (res.new_path || ""))
              ) {
                el.classList.remove("dam-viz-badge--guessed");
                el.setAttribute("data-current-code", newCode === NONE_CODE ? "" : newCode);
                if (newCode !== NONE_CODE) {
                  el.setAttribute("data-tag-value", shown);
                  el.textContent = shown;
                }
              }
            });
          } catch (ignore) {}
          if (res.old_path && res.new_path && res.old_path !== res.new_path) {
            try {
              document.querySelectorAll("[data-revision-path]").forEach(function (el) {
                var rp = el.getAttribute("data-revision-path") || "";
                if (rp === ctx.revisionPath || rp === res.old_path) {
                  el.setAttribute("data-revision-path", res.new_path);
                }
              });
              document.querySelectorAll("[data-path]").forEach(function (el) {
                var p = el.getAttribute("data-path") || "";
                if (p === ctx.revisionPath || p === res.old_path || p.indexOf(res.old_path) >= 0) {
                  el.setAttribute("data-path", p.replace(res.old_path, res.new_path));
                }
              });
            } catch (ignorePath) {}
          }
          if (typeof ctx.onApplied === "function") ctx.onApplied(res);
          else if (global.DamViz && typeof global.DamViz.refreshAfterTagChange === "function") {
            global.DamViz.refreshAfterTagChange(res);
          }
          /* HARD: admin AJAX - no full page reload */
        } else if (!isAdmin()) {
          showToast(
            "Zgloszenie JSON wyslane do kolejki. Admin zatwierdza w Ustawieniach / Inbox. Bez auto-zapisu."
          );
        } else {
          showToast("Zapis wymaga sesji admin (Bearer). Sprawdz logowanie.");
        }
        return res;
      })
      .catch(function () {
        showToast("Bridge offline - nie udalo sie wyslac zgloszenia.");
      });
  }

  /**
   * @param {HTMLElement} anchorEl - element klikniety (tag typu)
   * @param {object} ctx - {revisionPath, productId, productName, currentCode, onApplied}
   */
  var ADMIN_MODE_KEY = "dam_admin_mode";

  /* Tylko admin: auto-wlacz tryb edycji, zeby od razu stosowac zmiany. */
  function autoEnableAdminModeIfPrivileged() {
    if (!isAdmin() || adminModeOn()) return;
    if (global.DamShell && typeof global.DamShell.setAdminMode === "function") {
      global.DamShell.setAdminMode(true);
      return;
    }
    try {
      localStorage.setItem(ADMIN_MODE_KEY, "1");
      global.dispatchEvent(new CustomEvent("dam:admin-mode", { detail: { on: true } }));
    } catch (e) {
      /* localStorage niedostępny - kontynuuj bez auto-wlaczenia */
    }
  }

  function openCarrierPicker(anchorEl, ctx) {
    openTagPicker(anchorEl, Object.assign({ kind: "carrier" }, ctx || {}));
  }

  function tagPickerHead(kind) {
    var k = String(kind || "carrier");
    if (k === "status") return "Wybierz status";
    if (k === "brand") return "Wybierz markę";
    if (k === "lang") return "Wybierz język";
    if (k === "category") return "Wybierz kategorię";
    if (k === "subcategory") return "Wybierz podkategorię";
    if (k === "index") return "Wybierz / wpisz indeks";
    if (k === "asset_role") return "Wybierz przeznaczenie";
    if (k === "appearance") return "Wybierz tag produktówy";
    if (k === "carrier") return isAdmin() && adminModeOn() ? "Wybierz typ" : "Zaproponuj typ";
    return "Wybierz wartość tagu";
  }

  /** Contextual label for admin "add tag" CTA (not "Dodaj typ"). */
  function addTagButtonLabel(kind) {
    var k = String(kind || "");
    if (k === "lang") return "Dodaj język";
    if (k === "carrier") return "Dodaj nośnik";
    if (k === "brand") return "Dodaj markę";
    if (k === "status") return "Dodaj status";
    if (k === "category") return "Dodaj kategorię";
    if (k === "subcategory") return "Dodaj podkategorię";
    if (k === "index") return "Dodaj indeks";
    if (k === "asset_role") return "Dodaj przeznaczenie";
    if (k === "appearance") return "Dodaj tag";
    return "Dodaj tag";
  }

  function ensureTagPopoverWideCss() {
    if (document.getElementById("dam-tag-edit-popover-wide")) return;
    var s = document.createElement("style");
    s.id = "dam-tag-edit-popover-wide";
    s.textContent =
      "#damTagEditPopover.dam-tag-edit-popover--wide{" +
      "width:min(50vw,960px)!important;min-width:min(50vw,480px);min-height:500px;}";
    document.head.appendChild(s);
  }

  function ensureTagPopoverBtnStyles() {
    ensureTagPopoverWideCss();
    var old = document.getElementById("damTagEditDodajStyles");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var st = document.getElementById("damTagEditPopBtnStyles");
    if (!st) {
      st = document.createElement("style");
      st.id = "damTagEditPopBtnStyles";
      document.head.appendChild(st);
    }
    st.setAttribute("data-token", "comboChromeFlush20260727a");
    /* COMBO/assoc chrome: flex column, list fills, footer flush grid (no white void). */
    st.textContent =
      "#damTagEditPopover.dam-tag-edit-popover{position:fixed!important;z-index:12350!important;" +
      "min-width:320px;width:min(340px,calc(100vw - 24px));display:flex!important;flex-direction:column!important;" +
      "overflow:hidden!important;padding:0!important;box-sizing:border-box;}" +
      "#damTagEditPopover.dam-tag-edit-popover--wide{width:min(50vw,960px)!important;min-height:500px;}" +
      "#damTagEditPopover .dam-tag-edit-popover__list{flex:1 1 auto!important;min-height:0!important;max-height:none!important;}" +
      "#damTagEditPopover .dam-thumb-picker__footer," +
      "#damTagEditPopover .dam-tag-edit-popover__actions{" +
      "display:grid!important;grid-template-columns:auto 1fr auto!important;" +
      "align-items:center!important;gap:8px!important;min-height:65px!important;box-sizing:border-box!important;" +
      "padding:12px 14px!important;margin:0!important;border-top:1px solid #ececf2!important;" +
      "background:#f7f6fa!important;flex:0 0 auto!important;border-radius:0!important;}" +
      "#damTagEditPopover .dam-thumb-picker__footer .dam-dialog-actions__spacer," +
      "#damTagEditPopover .dam-tag-edit-popover__actions .dam-dialog-actions__spacer{display:none!important;}" +
      "#damTagEditPopover .dam-thumb-picker__footer > [data-cancel]," +
      "#damTagEditPopover .dam-tag-edit-popover__actions > [data-cancel]{grid-column:1!important;}" +
      "#damTagEditPopover .dam-thumb-picker__footer > [data-confirm]," +
      "#damTagEditPopover .dam-tag-edit-popover__actions > [data-confirm]{grid-column:3!important;justify-self:end!important;margin-left:0!important;" +
      "#damTagEditPopover .dam-tag-edit-popover__foot{" +
      "display:grid!important;grid-template-columns:1fr 1fr;gap:8px;align-items:stretch;" +
      "padding:10px 12px;border-top:1px solid #ececf2;flex:0 0 auto;box-sizing:border-box;}" +
      "#damTagEditPopover .dam-tag-edit-popover__foot > button{" +
      "display:inline-flex!important;flex-direction:row!important;align-items:center;justify-content:center;" +
      "gap:5px;width:100%!important;min-width:0;min-height:44px;height:auto;padding:8px 8px;" +
      "border-radius:10px;font-size:11.5px;font-weight:600;cursor:pointer;box-sizing:border-box;" +
      "line-height:1.2;white-space:normal;text-align:center;}" +
      "#damTagEditPopover .dam-tag-edit-popover__foot > button i{font-size:14px;line-height:1;flex:0 0 auto;}" +
      "#damTagEditPopover .dam-tag-edit-popover__foot > button span{" +
      "min-width:0;text-align:left;}" +
      "#damTagEditPopover .dam-tag-edit-popover__addtag," +
      "#damTagEditPopover .dam-tag-edit-popover__addtype{" +
      "color:#7a3aa8;background:color-mix(in srgb,var(--dam-primary,#ab54db) 6%,#fff);" +
      "border:1px dashed color-mix(in srgb,var(--dam-primary,#ab54db) 50%,#d7d7e0)!important;}" +
      "#damTagEditPopover .dam-tag-edit-popover__addtag:hover," +
      "#damTagEditPopover .dam-tag-edit-popover__addtype:hover{" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 12%,#fff);" +
      "border-color:var(--dam-primary,#ab54db)!important;}" +
      "#damTagEditPopover .dam-tag-edit-popover__changecat{" +
      "border:1px solid #e2e2ea!important;background:#fff;color:#3d3a48;}" +
      "#damTagEditPopover .dam-tag-edit-popover__changecat:hover{" +
      "border-color:var(--dam-primary,#ab54db)!important;color:#7a3aa8;}" +
      "#damTagEditPopover .dam-tag-edit-popover__foot > button:focus-visible{" +
      "outline:2px solid var(--dam-primary,#ab54db);outline-offset:2px;}" +
      "#damTagEditPopover .dam-tag-edit-popover__confirm," +
      "#damTagEditPopover .dam-tag-edit-popover__cancel{" +
      "width:auto!important;min-width:44px;min-height:40px;justify-content:center;}" +
      "#damTagEditPopover .dam-tag-edit-popover__list--checks{" +
      "display:flex;flex-direction:column;gap:4px;overflow:auto;padding:6px 8px;" +
      "flex:1 1 auto;min-height:0;max-height:none;}" +
      "#damTagEditPopover .dam-tag-edit-popover__check{" +
      "display:grid;grid-template-columns:auto auto 1fr;gap:8px;align-items:center;" +
      "padding:6px 8px;border-radius:8px;cursor:pointer;border:1px solid transparent;}" +
      "#damTagEditPopover .dam-tag-edit-popover__check.is-selected{" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 8%,#fff);" +
      "border-color:color-mix(in srgb,var(--dam-primary,#ab54db) 35%,#ececf2);}" +
      "#damTagEditPopover .dam-tag-edit-popover__check-group{" +
      "font-size:10px;font-weight:600;text-transform:uppercase;color:#9a9caa;white-space:nowrap;}" +
      "#damTagEditPopover .dam-tag-edit-popover__check-label{font-size:13px;color:#3d3a48;min-width:0;}" +
      "#damTagEditPopover .dam-tag-edit-popover__opt--check{" +
      "display:grid!important;grid-template-columns:20px 1fr;gap:8px;align-items:center;text-align:left;}" +
      "#damTagEditPopover .dam-tag-edit-popover__opt-check{" +
      "width:18px;text-align:center;font-weight:700;color:var(--dam-primary,#ab54db);}";
  }

  /** PL / EN gdy slug angielski rozni sie od etykiety PL. */
  function bilingualSubcatLabel(slug, plLabel) {
    var s = String(slug || "").trim();
    var pl = String(plLabel || s).trim() || s;
    if (!s) return pl;
    if (pl.toLowerCase() === s.toLowerCase()) return pl;
    return pl + " / " + s;
  }

  function fileIndexProducts() {
    var fi = global._DAM_FILE_INDEX;
    return (fi && Array.isArray(fi.products) && fi.products) || [];
  }

  function isLightProductCatalog() {
    var fi = global._DAM_FILE_INDEX;
    return !!(fi && fi._fromSearchIndex && Array.isArray(fi.products) && fi.products.length);
  }

  function applyLightProductCatalogFromSearch(si) {
    var existing = global._DAM_FILE_INDEX;
    /* HARD: never overwrite a full file-index (has subcategory_slug / revisions)
       with light search-index rows — that emptied subcategory tag picker. */
    if (
      existing &&
      !existing._fromSearchIndex &&
      Array.isArray(existing.products) &&
      existing.products.length
    ) {
      return existing;
    }
    var entries = (si && si.entries) || [];
    var products = entries
      .map(function (e) {
        if (!e || !e.id) return null;
        var subLabel = String(e.subcategory || e.subcategory_label || "").trim();
        var subSlug = String(e.subcategory_slug || "").trim();
        if (!subSlug && subLabel) subSlug = subLabel;
        return {
          id: e.id,
          name: e.name || e.id,
          display_name: e.display_name || e.name || e.id,
          category: e.category || "",
          tags: e.tags || [],
          indexes: e.indexes || [],
          index_bases: e.index_bases || [],
          search_blob: e.search_blob || "",
          path: e.path || "",
          brand: e.brand || "",
          subcategory_slug: subSlug,
          subcategory_label: subLabel || subSlug,
          _fromSearchIndex: true,
        };
      })
      .filter(Boolean);
    var light = { products: products, _fromSearchIndex: true };
    if (!global._DAM_FILE_INDEX || global._DAM_FILE_INDEX._fromSearchIndex) {
      global._DAM_FILE_INDEX = light;
    }
    return global._DAM_FILE_INDEX;
  }

  function ensureSearchIndexBootstrap() {
    if (global._DAM_SEARCH_INDEX && global._DAM_SEARCH_INDEX.entries) {
      return Promise.resolve(global._DAM_SEARCH_INDEX);
    }
    if (global.DamSearch && typeof global.DamSearch.loadSearchOnly === "function") {
      return global.DamSearch.loadSearchOnly().then(function (si) {
        return si || global._DAM_SEARCH_INDEX || { entries: [] };
      });
    }
    return fetch("data/search-index.json?v=" + Date.now())
            .then(function (r) {
        return r.ok ? r.text() : "";
      })
      .then(function (text) {
        if (!text) throw new Error("search-index empty");
        var parse =
          global.DamSearch && typeof global.DamSearch.parseJsonInWorker === "function"
            ? global.DamSearch.parseJsonInWorker(text, "search-index", 12000)
            : Promise.resolve().then(function () {
                return JSON.parse(text);
              });
        return parse.then(function (d) {
          global._DAM_SEARCH_INDEX = d;
              return d;
            });
        });
    }

  function ensureFileIndex() {
    var fi = global._DAM_FILE_INDEX;
    if (fi && !fi._fromSearchIndex && Array.isArray(fi.products) && fi.products.length) {
      return Promise.resolve(fi);
    }
    if (isLightProductCatalog()) {
      return Promise.resolve(global._DAM_FILE_INDEX);
    }
    /* HARD: prefer light search-index; never block UI with ~8MB main-thread file-index parse. */
    return ensureSearchIndexBootstrap()
      .then(function (si) {
        return applyLightProductCatalogFromSearch(si);
      })
      .catch(function () {
        return global._DAM_FILE_INDEX || { products: [], _fromSearchIndex: true };
      });
  }

  function productsHaveSubcategorySlugs(products) {
    var list = products || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p && String(p.subcategory_slug || "").trim()) return true;
    }
    return false;
  }

  function ingestSubcategoryRowsIntoCache(rows) {
    var map = global._DAM_SUBCATEGORY_CATALOG || {};
    (rows || []).forEach(function (row) {
      if (!row) return;
      var slug = String(row.slug || row.code || row.subcategory_slug || "").trim();
      if (!slug) return;
      var pl = String(row.label_pl || row.pl || row.subcategory_label || slug).trim() || slug;
      map[slug.toLowerCase()] = { code: slug, pl: pl };
    });
    global._DAM_SUBCATEGORY_CATALOG = map;
    return map;
  }

  function ensureSubcategoryCatalog() {
    if (productsHaveSubcategorySlugs(fileIndexProducts())) {
      return Promise.resolve(true);
    }
    if (global._DAM_SUBCATEGORY_CATALOG && Object.keys(global._DAM_SUBCATEGORY_CATALOG).length) {
      return Promise.resolve(true);
    }
    if (global._DAM_SUBCATEGORY_CATALOG_P) return global._DAM_SUBCATEGORY_CATALOG_P;
    try {
      var pn = String((typeof location !== "undefined" && location.pathname) || "").toLowerCase();
      if (pn.indexOf("explorer.html") !== -1 || pn.indexOf("visualizations.html") !== -1) {
        return Promise.resolve(false);
      }
    } catch (ePage) { /* ignore */ }
    global._DAM_SUBCATEGORY_CATALOG_P = fetch("data/file-index.json?v=" + Date.now())
      .then(function (r) {
        return r.ok ? r.text() : "";
      })
      .then(function (text) {
        if (!text) return false;
        var parse =
          global.DamSearch && typeof global.DamSearch.parseJsonInWorker === "function"
            ? global.DamSearch.parseJsonInWorker(text, "file-index-subcats", 20000)
            : Promise.resolve().then(function () {
                return JSON.parse(text);
              });
        return parse.then(function (d) {
          var products = (d && d.products) || [];
          var rows = [];
          for (var i = 0; i < products.length; i++) {
            var p = products[i];
            if (!p) continue;
            var slug = String(p.subcategory_slug || "").trim();
            if (!slug) continue;
            rows.push({
              slug: slug,
              label_pl: String(p.subcategory_label || slug).trim() || slug,
            });
          }
          ingestSubcategoryRowsIntoCache(rows);
          /* If UI still has only light catalog, keep it — do not replace with 8MB index. */
          if (!global._DAM_FILE_INDEX || global._DAM_FILE_INDEX._fromSearchIndex) {
            /* optional: leave light; catalog cache is enough for picker */
          } else if (!productsHaveSubcategorySlugs(global._DAM_FILE_INDEX.products)) {
            /* full index without slugs — unlikely; still have cache */
          }
          return true;
        });
      })
      .catch(function () {
        return false;
      })
      .then(function (ok) {
        global._DAM_SUBCATEGORY_CATALOG_P = null;
        return ok;
      });
    return global._DAM_SUBCATEGORY_CATALOG_P;
  }

  function collectSubcategoryOptions(cur) {
    var map = {};
    function addSub(slug, plLabel) {
      var s = String(slug || "").trim();
      if (!s) return;
      var key = s.toLowerCase();
      if (map[key]) return;
      var pl = String(plLabel || s).trim() || s;
      map[key] = { code: s, pl: pl, label: bilingualSubcatLabel(s, pl) };
    }
    var dictSubs =
      (global.DamNaming && Array.isArray(global.DamNaming.subcategories) && global.DamNaming.subcategories) ||
      [];
    dictSubs.forEach(function (row) {
      if (!row) return;
      addSub(row.slug || row.code, row.label_pl || row.pl);
    });
    var cached = global._DAM_SUBCATEGORY_CATALOG || {};
    Object.keys(cached).forEach(function (k) {
      var row = cached[k];
      if (row) addSub(row.code || k, row.pl);
    });
    var products = fileIndexProducts();
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      if (!p) continue;
      var slug = String(p.subcategory_slug || "").trim();
      if (!slug) {
        var lblOnly = String(p.subcategory_label || "").trim();
        if (lblOnly) slug = lblOnly;
      }
      if (!slug) continue;
      addSub(slug, p.subcategory_label || slug);
    }
    if (cur) addSub(cur, cur);
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (a, b) {
        return a.pl.localeCompare(b.pl, "pl");
      })
      .map(function (it) {
        return {
          code: it.code,
          label: it.label,
          search: (it.pl + " " + it.code + " " + it.label).toLowerCase(),
        };
      });
  }

  function collectIndexOptions(cur) {
    var map = {};
    var mapCount = 0;
    var MAX_IX = 400;
    function addIx(raw) {
      if (mapCount >= MAX_IX) return;
      var v = String(raw || "").trim();
      if (!v) return;
      var base = v.indexOf(".") > 0 ? v.split(".")[0] : v;
      if (!/^\d{4,}/.test(base)) return;
      if (map[base]) return;
      map[base] = base;
      mapCount++;
    }
    var entries = (global._DAM_SEARCH_INDEX && global._DAM_SEARCH_INDEX.entries) || [];
    if (entries.length) {
      for (var ei = 0; ei < entries.length && mapCount < MAX_IX; ei++) {
        var ent = entries[ei];
        if (!ent) continue;
        (ent.index_bases || []).forEach(addIx);
        (ent.indexes || []).forEach(addIx);
      }
    } else {
      var products = fileIndexProducts();
      for (var i = 0; i < products.length && mapCount < MAX_IX; i++) {
        var p = products[i];
      (p.index_bases || []).forEach(addIx);
      (p.indexes || []).forEach(addIx);
        if (!p._fromSearchIndex && p.revisions) {
      (p.revisions || []).forEach(function (r) {
        addIx(r && r.index);
      });
        }
      }
    }
    if (cur) {
      var c = String(cur).trim();
      var cb = c.indexOf(".") > 0 ? c.split(".")[0] : c;
      if (cb) map[cb] = cb;
    }
    var list = Object.keys(map)
      .sort(function (a, b) {
        return a.localeCompare(b, "pl", { numeric: true });
      })
      .map(function (ix) {
        return { code: ix, label: ix, search: ix };
      });
    list.unshift({ code: "", label: "Bez indeksu", search: "brak indeksu bez" });
    return list;
  }

  function tagPickerOptions(kind, ctx) {
    var k = String(kind || "carrier");
    var cur = String((ctx && ctx.value) || "").trim();
    if (k === "status") {
      return [
        { code: "aktualne", label: "Aktualne", search: "aktualne" },
        { code: "nieaktualne", label: "Nieaktualne", search: "nieaktualne starsza" },
      ];
    }
    if (k === "brand") {
      return [
        { code: "DK", label: "DK", search: "dk dobra kaloria" },
        { code: "GC", label: "GC", search: "gc good calories" },
      ];
    }
    if (k === "lang") {
      /* HARD: EN not GB; UA not UK; one English option */
      return ["pl", "en", "de", "fr", "es", "it", "cs", "sk", "ua", "lt", "lv", "ee"].map(function (lg) {
        var code =
          global.DamLabels && typeof global.DamLabels.normalizeLangCode === "function"
            ? global.DamLabels.normalizeLangCode(lg)
            : lg;
        var short =
          global.DamLabels && typeof global.DamLabels.langShort === "function"
            ? global.DamLabels.langShort(code)
            : String(code || lg).toUpperCase();
        var labelFull =
          global.DamLabels && typeof global.DamLabels.langLabel === "function"
            ? global.DamLabels.langLabel(code)
            : short;
        return {
          code: code || lg,
          label: short || String(lg).toUpperCase(),
          search: (code + " " + short + " " + labelFull).toLowerCase(),
        };
      });
    }
    if (k === "category") {
      var cats = (global.DamLabels && global.DamLabels.CATEGORY_CANON) || [];
      return cats.map(function (c) {
        return { code: c.id, label: c.title, search: (c.id + " " + c.title).toLowerCase() };
      });
    }
    if (k === "subcategory") {
      return collectSubcategoryOptions(cur);
    }
    if (k === "carrier") {
      var types = allCarrierTypes();
      var list = [{ code: NONE_CODE, label: "BRAK TYPU", search: "brak typu none" }];
      Object.keys(types)
        .sort(function (a, b) {
          return types[a].localeCompare(types[b]);
        })
        .forEach(function (code) {
          list.push({ code: code, label: types[code], search: (types[code] + " " + code).toLowerCase() });
        });
      return list;
    }
    if (k === "index") {
      return collectIndexOptions(cur);
    }
    if (k === "asset_role") {
      if (global.DamAssetTaxonomy && typeof global.DamAssetTaxonomy.assetRoleOptions === "function") {
        return global.DamAssetTaxonomy.assetRoleOptions(cur);
      }
      return [];
    }
    if (k === "appearance") {
      var base = [
        "Logo",
        "Proteina",
        "Baton",
        "Karmel",
        "Banoffee",
        "Lemon cheesecake",
        "Indeks glikemiczny",
        "Deserowe",
        "Super cena",
        "Mini",
        "MCT",
        "Datesy",
        "Kulki",
        "Mix",
        "Bez cukru",
        "Doypack",
        "Boost",
        "Folia",
        "Sypkie",
        "Baner",
        "Kampania",
        "Social media",
      ];
      var map = {};
      base.forEach(function (label) {
        map[label.toLowerCase()] = { code: label, label: label, search: label.toLowerCase() };
      });
      if (cur) {
        var ck = cur.toLowerCase();
        if (!map[ck]) map[ck] = { code: cur, label: cur, search: ck };
      }
      return Object.keys(map)
        .sort(function (a, b) {
          return map[a].label.localeCompare(map[b].label, "pl");
        })
        .map(function (k2) {
          return map[k2];
        });
    }
    if (cur) return [{ code: cur, label: cur, search: cur.toLowerCase() }];
    return [];
  }

  function submitBrandingMetadataChange(ctx, field, newValue) {
    var assetId = ctx.brandingAssetId || "";
    if (!assetId) {
      showToast("Brak ID assetu branding.");
      return Promise.resolve({ ok: false });
    }
    if (!isPrivileged()) {
      showToast("Edycja tagow wymaga roli admin lub power_user.");
      return Promise.resolve({ ok: false });
    }
    var payload = {
      asset_id: assetId,
      field: field,
      value: newValue,
      user_email: userLabel(),
      role: role(),
    };
    return fetch(bridgeUrl() + "/branding/asset-metadata", {
      method: "POST",
      headers: bridgeAuthHeaders(),
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (res) {
          res._http = r.status;
          return res;
        });
      })
      .then(function (res) {
        if (!res.ok) {
          showToast("Blad: " + (res.error || "nie zapisano metadanych"));
          return res;
        }
        if (global.DamBranding && typeof global.DamBranding.clearComputeCache === "function") {
          global.DamBranding.clearComputeCache();
        }
        showToast("Zapisano: " + field);
        if (global.DamBranding && typeof global.DamBranding.patchAssetField === "function") {
          global.DamBranding.patchAssetField(assetId, field, newValue);
        }
        if (typeof ctx.onApplied === "function") ctx.onApplied(res);
        return res;
      })
      .catch(function () {
        showToast("Bridge offline - nie zapisano metadanych.");
      });
  }

  function patchLangBadgesInDom(ctx, langs, paths) {
    var codes = (langs || []).map(function (x) {
      return global.DamLabels && typeof global.DamLabels.normalizeLangCode === "function"
        ? global.DamLabels.normalizeLangCode(x)
        : String(x || "").toLowerCase();
    }).filter(Boolean);
    var label = codes
      .map(function (c) {
        return global.DamLabels && typeof global.DamLabels.langShort === "function"
          ? global.DamLabels.langShort(c)
          : String(c).toUpperCase();
      })
      .join(" ");
    var pathSet = {};
    (paths || []).forEach(function (p) {
      if (p) pathSet[String(p)] = true;
    });
    try {
      document.querySelectorAll('.dam-tag-editable[data-tag-kind="lang"]').forEach(function (el) {
        var rp = el.getAttribute("data-revision-path") || "";
        if (pathSet[rp] || rp === (ctx.revisionPath || "")) {
          el.setAttribute("data-tag-value", label);
          el.setAttribute("data-current-code", codes.join(","));
          el.textContent = label || "?";
        }
      });
    } catch (ignore) {}
  }

  function submitLangChange(ctx, newCodeOrList) {
    autoEnableAdminModeIfPrivileged();
    var langs = Array.isArray(newCodeOrList)
      ? newCodeOrList
      : String(newCodeOrList || "")
          .split(/[,\s]+/)
          .filter(Boolean);
    langs = langs.map(function (x) {
      return global.DamLabels && typeof global.DamLabels.normalizeLangCode === "function"
        ? global.DamLabels.normalizeLangCode(x)
        : String(x || "").toLowerCase();
    }).filter(Boolean);
    /* Preserve existing langs when adding one (multi) unless replace flag */
    if (!ctx.replaceLangs && ctx.currentLangs && ctx.currentLangs.length) {
      var merged = ctx.currentLangs.slice();
      langs.forEach(function (c) {
        if (merged.indexOf(c) === -1) merged.push(c);
      });
      langs = merged;
    }
    if (langs.indexOf("pl") === -1 && String(ctx.brand || "").toUpperCase() === "DK") {
      langs = ["pl"].concat(langs.filter(function (c) { return c !== "pl"; }));
    }
    var payload = {
      revision_path: ctx.revisionPath || "",
      index: ctx.revisionIndex || ctx.index || "",
      product_id: ctx.productId || "",
      product_name: ctx.productName || "",
      langs: langs,
      current_langs: (ctx.currentLangs || []).join(","),
      user_email: userLabel(),
    };
    function postRevisionLangs() {
      return fetch(bridgeUrl() + "/revision-langs", {
      method: "POST",
      headers: bridgeAuthHeaders(),
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (res) {
          res._http = r.status;
          return res;
        });
      })
      .then(function (res) {
        if (!res.ok) {
          showToast("Blad: " + (res.error || "nie zapisano jezykow"));
          return res;
        }
        if (res.immediate || res.applied) {
          showToast("Jezyki: " + (res.langs || langs).join(", ").toUpperCase());
          patchLangBadgesInDom(ctx, res.langs || langs, [
            ctx.revisionPath,
            res.old_path,
            res.new_path,
          ]);
          if (res.new_path && ctx.revisionPath && res.new_path !== ctx.revisionPath) {
            try {
              document.querySelectorAll("[data-revision-path]").forEach(function (el) {
                if (el.getAttribute("data-revision-path") === ctx.revisionPath) {
                  el.setAttribute("data-revision-path", res.new_path);
                }
              });
            } catch (ignore2) {}
            ctx.revisionPath = res.new_path;
          }
          if (typeof ctx.onApplied === "function") ctx.onApplied(res);
          else if (global.DamViz && typeof global.DamViz.refreshAfterTagChange === "function") {
            global.DamViz.refreshAfterTagChange(res);
          }
        } else {
          showToast("Zgloszenie jezykow wyslane do kolejki (Wiadomosci).");
        }
        return res;
      })
      .catch(function () {
        showToast("Bridge offline - nie zapisano jezykow.");
      });
    }
    if (global.DamApi && typeof global.DamApi.ensureSession === "function") {
      return global.DamApi.ensureSession().then(function (sess) {
        if (!sess || !sess.ok) {
          showToast("Blad: login_required");
          return sess || { ok: false, error: "login_required" };
        }
        return postRevisionLangs();
      });
    }
    return postRevisionLangs();
  }

  function applyTagPickerChoice(kind, ctx, newCode) {
    var k = String(kind || "carrier");
    if (k === "asset_role") {
      return submitBrandingMetadataChange(ctx, "asset_role", newCode || "");
    }
    if (k === "appearance") {
      return submitBrandingMetadataChange(ctx, "appearance_primary", newCode || "");
    }
    if (k === "carrier") {
      return submitCarrierChange(ctx, newCode || NONE_CODE);
    }
    if (kind === "lang") {
      return submitLangChange(
        Object.assign({}, ctx, { replaceLangs: true }),
        Array.isArray(newCode) ? newCode : newCode || ""
      );
    }
    if (k === "status") {
      if (typeof global.damSetRevisionStatus === "function") {
        global.damSetRevisionStatus({
          path: ctx.revisionPath || "",
          index: ctx.revisionIndex || "",
          status: newCode,
        });
      }
      return Promise.resolve({ ok: true });
    }
    if (k === "brand") {
      if (!confirmBrandTagChange(ctx.revisionPath || "", newCode)) {
        return Promise.resolve({ ok: false });
      }
      if (isAdmin()) {
        showToast("Marka: " + newCode + " (zapis lokalny UI - wymagany sync slownika).");
        try {
          document.querySelectorAll('.dam-tag-editable[data-tag-kind="brand"]').forEach(function (el) {
            var rp = el.getAttribute("data-revision-path") || "";
            if (!ctx.revisionPath || rp === ctx.revisionPath) {
              el.setAttribute("data-tag-value", newCode);
              el.textContent = newCode;
            }
          });
        } catch (ignore) {}
        if (typeof ctx.onApplied === "function") ctx.onApplied({ ok: true, brand: newCode });
        return Promise.resolve({ ok: true, immediate: true });
      }
      showToast("Zgloszenie marki trafia do moderacji (Wiadomosci).");
      return Promise.resolve({ ok: true });
    }
    if (isAdmin()) {
      var shown =
        k === "category" && global.DamLabels && typeof global.DamLabels.categoryTitle === "function"
          ? global.DamLabels.categoryTitle(newCode)
          : k === "subcategory" && global.DamLabels && typeof global.DamLabels.formatTagLabel === "function"
            ? global.DamLabels.formatTagLabel(newCode, "subcategory")
            : String(newCode || "");
      showToast("Wybrano " + shown + " dla tagu " + k + ".");
      try {
        document.querySelectorAll('.dam-badge-tag[data-tag-kind="' + k + '"]').forEach(function (el) {
          var rp = el.getAttribute("data-revision-path") || "";
          if (ctx.revisionPath && rp && rp !== ctx.revisionPath) return;
          el.setAttribute("data-tag-value", newCode);
          el.setAttribute("data-current-code", newCode);
          el.textContent = shown;
        });
      } catch (ignoreDom) {}
      if (typeof ctx.onApplied === "function") {
        ctx.onApplied({ ok: true, code: newCode, kind: k, immediate: true });
      }
      return Promise.resolve({ ok: true, immediate: true });
    }
    showToast("Wybrano " + newCode + " dla tagu " + k + ". Zgloszenie trafia do moderacji (Wiadomosci).");
    return Promise.resolve({ ok: true });
  }

  // #region agent log
  function __damTagDbg() {
    /* noop — debug ingest wylaczony (martwy port 7922 potrafil wisiec UI). */
  }
  // #endregion

  var _tagPickerOpening = false;

  function panicTagReset() {
    _tagPickerOpening = false;
    try {
      closePopover();
    } catch (eClose) {
      /* ignore */
    }
  }
  try {
    global.addEventListener("dam:panic-reset", panicTagReset);
  } catch (ePanic) {
    /* ignore */
  }

  function openTagPicker(anchorEl, ctx) {
    // #region agent log
    __damTagDbg("dam-tag-edit.js:openTagPicker", "entry", {
      opening: _tagPickerOpening,
      kind: (ctx && ctx.kind) || "",
    }, "H2");
    // #endregion
    /* Soft unstick only: never dispatch dam:panic-reset here (re-enters handlers / UI freeze). */
    if (_tagPickerOpening) {
      if (document.getElementById("damTagEditPopover")) {
        closePopover();
      } else {
        _tagPickerOpening = false;
      }
    } else if (document.getElementById("damTagEditPopover")) {
      closePopover();
    }
    /* Do not call DamAssocEdit.closePicker here - it can tear down unrelated overlays mid-click. */
    _tagPickerOpening = true;
    /* Macrotask: click / CDP evaluate must return before building popover DOM. */
    setTimeout(function () {
      try {
        openTagPickerNow(anchorEl, ctx);
      } catch (errSync) {
        console.error("[DamTagEdit] openTagPicker sync failed", errSync);
        showToast("Nie udalo sie otworzyc pickera tagow.");
        _tagPickerOpening = false;
      }
    }, 0);
  }

  function openTagPickerNow(anchorEl, ctx) {
    ctx = ctx || {};
    var kind = ctx.kind || (anchorEl && anchorEl.getAttribute("data-tag-kind")) || "carrier";
    // #region agent log
    __damTagDbg("dam-tag-edit.js:openTagPickerNow", "start", {
      kind: kind,
      warmProducts: (global._DAM_FILE_INDEX && global._DAM_FILE_INDEX.products || []).length,
      fromSearchIndex: !!(global._DAM_FILE_INDEX && global._DAM_FILE_INDEX._fromSearchIndex),
    }, "H1");
    // #endregion
    if (kind === "carrier" || kind === "lang") {
      ctx = Object.assign(
        {
          revisionPath: (anchorEl && anchorEl.getAttribute("data-revision-path")) || "",
          currentCode: (anchorEl && anchorEl.getAttribute("data-current-code")) || ctx.value || "",
          productId: (anchorEl && anchorEl.getAttribute("data-product-id")) || "",
          productName: (anchorEl && anchorEl.getAttribute("data-product-name")) || "",
          revisionIndex: (anchorEl && anchorEl.getAttribute("data-revision-index")) || ctx.revisionIndex || "",
          brand: (anchorEl && anchorEl.getAttribute("data-brand")) || ctx.brand || "",
        },
        ctx
      );
      if (kind === "lang") {
        var curRaw = String(ctx.currentCode || ctx.value || "");
        ctx.currentLangs = curRaw
          .split(/[,\s+/]+/)
          .map(function (x) {
            return global.DamLabels && typeof global.DamLabels.normalizeLangCode === "function"
              ? global.DamLabels.normalizeLangCode(x)
              : String(x || "").toLowerCase();
          })
          .filter(Boolean);
        /* Picking a lang adds it (multi) unless user confirms replace */
        ctx.replaceLangs = false;
      }
    }
    if (typeof global._damVizOnTagApplied === "function" && !ctx.onApplied) {
      ctx.onApplied = global._damVizOnTagApplied;
    }
    if (!ctx.value && anchorEl) {
      ctx.value = anchorEl.getAttribute("data-tag-value") || ctx.value || "";
    }
    if (!ctx.brandingAssetId && anchorEl) {
      ctx.brandingAssetId =
        anchorEl.getAttribute("data-branding-asset-id") ||
        (anchorEl.closest("[data-id]") && anchorEl.closest("[data-id]").getAttribute("data-id")) ||
        "";
    }

    closePopover();
    autoEnableAdminModeIfPrivileged();
    if (kind === "carrier") refreshCarrierTypesCache();

    /**
     * HARD: ALWAYS paint picker synchronously from warm/dict data.
     * Never await ensureFileIndex / search-index BEFORE first paint —
     * that left UI with no popover, stuck _tagPickerOpening, and orphaned
     * overlays that blocked #damVizModalClose (z-index 12100 over modal).
     */
    var options = tagPickerOptions(kind, ctx) || [];
    if (options.length > 400) options = options.slice(0, 400);
    if (!options.length && ctx.value) {
      options = [
        {
          code: ctx.value,
          label: String(ctx.value),
          search: String(ctx.value).toLowerCase(),
        },
      ];
    }
    renderTagPicker(anchorEl, ctx, kind, options);
    _tagPickerOpening = false;

    /* Background enrich list only (index/subcategory) — never block open. */
    if (kind === "index" || kind === "subcategory") {
      var enrichKind = kind;
      var enrichCtx = ctx;
      var enrichAnchor = anchorEl;
      setTimeout(function () {
        var boot =
          enrichKind === "index"
            ? ensureSearchIndexBootstrap().then(function (si) {
                applyLightProductCatalogFromSearch(si);
                return si;
              })
            : ensureSubcategoryCatalog().then(function () {
                return ensureFileIndex();
              });
        boot
          .then(function () {
            var pop = document.getElementById("damTagEditPopover");
            if (!pop || pop._damTagKind !== enrichKind) return;
            var next = tagPickerOptions(enrichKind, enrichCtx) || [];
            if (next.length > 400) next = next.slice(0, 400);
            if (!next.length) return;
            var prevLen = (pop._damTagOptions && pop._damTagOptions.length) || 0;
            pop._damTagOptions = next.slice();
            var list = pop.querySelector("[data-tag-list]");
            if (!list) {
              renderTagPicker(enrichAnchor, enrichCtx, enrichKind, next);
              return;
            }
            /* Rebuild when catalog grew (light filter cannot add new option buttons). */
            if (next.length !== prevLen && typeof pop._damTagRebuild === "function") {
              pop._damTagRebuild("");
            } else if (typeof pop._damTagRebuild === "function") {
              pop._damTagRebuild("");
            } else if (typeof pop._damTagRepaint === "function") {
              pop._damTagRepaint("");
            } else {
              renderTagPicker(enrichAnchor, enrichCtx, enrichKind, next);
            }
          })
          .catch(function () {
            /* keep sync list */
          });
      }, 0);
    }
  }

  function findTagPopoverScrollRoots(anchorEl) {
    var roots = [];
    if (!anchorEl || !anchorEl.closest) return roots;
    [
      ".dam-viz-modal__assoc-pane",
      ".dam-viz-modal__body",
      "#damVizModal",
      "#damMediaPreview",
      ".dam-media-preview__body",
    ].forEach(function (sel) {
      var el = anchorEl.closest(sel);
      if (el && roots.indexOf(el) < 0) roots.push(el);
    });
    return roots;
  }

  function positionTagPopover(pop, anchorEl) {
    if (!pop || !anchorEl) return;
    /* HARD: always on body + fixed to viewport (transform ancestors trap fixed). */
    if (pop.parentNode !== document.body) {
      document.body.appendChild(pop);
    }
    var rect = anchorEl.getBoundingClientRect();
    var margin = 12;
    var vw = window.innerWidth || document.documentElement.clientWidth || 1024;
    var vh = window.innerHeight || document.documentElement.clientHeight || 768;
    pop.style.setProperty("position", "fixed", "important");
    pop.style.setProperty("z-index", "12350", "important");
    pop.style.setProperty("transform", "none", "important");
    pop.style.setProperty("inset", "auto", "important");
    pop.style.setProperty("right", "auto", "important");
    pop.style.setProperty("bottom", "auto", "important");
    pop.style.setProperty("margin", "0", "important");
    /* Prefer measured size; width:min(50vw,…) can be 0 before first layout. */
    var pr = pop.getBoundingClientRect();
    var w = pr.width || pop.offsetWidth || 0;
    var h = pr.height || pop.offsetHeight || 0;
    if (!w || w < 40) w = pop.classList.contains("dam-tag-edit-popover--wide") ? Math.min(vw * 0.5, 960) : 320;
    if (!h || h < 40) h = pop.classList.contains("dam-tag-edit-popover--wide") ? 500 : 360;
    var anchorOk =
      rect &&
      isFinite(rect.left) &&
      isFinite(rect.top) &&
      (rect.width > 0 || rect.height > 0 || (rect.left !== 0 && rect.top !== 0));
    var top = anchorOk ? rect.bottom + 6 : margin;
    var left = anchorOk ? rect.left : margin;
    if (top + h > vh - margin) {
      top = (anchorOk ? rect.top : margin) - h - 6;
    }
    if (!isFinite(top) || top < margin) top = margin;
    if (top + h > vh - margin) top = Math.max(margin, vh - h - margin);
    if (left + w > vw - margin) {
      left = Math.max(margin, vw - w - margin);
    }
    if (!isFinite(left) || left < margin) left = margin;
    if (left > vw - margin) left = margin;
    if (top > vh - margin) top = margin;
    pop.style.top = Math.round(top) + "px";
    pop.style.left = Math.round(left) + "px";
  }

  /** Double rAF: first paint may measure width 0 for 50vw; second pass clamps for real size. */
  function scheduleTagPopoverPosition(pop, anchorEl) {
    if (!pop || !anchorEl) return;
    positionTagPopover(pop, anchorEl);
    requestAnimationFrame(function () {
      if (!document.getElementById("damTagEditPopover")) return;
      positionTagPopover(pop, anchorEl);
      requestAnimationFrame(function () {
        if (!document.getElementById("damTagEditPopover")) return;
        positionTagPopover(pop, anchorEl);
      });
    });
  }

  function bindTagPopoverReposition(pop, anchorEl) {
    if (!pop || !anchorEl) return;
    if (pop._damTagPopReposition) return;
    pop._damTagPopReposition = true;
    var scrollRoots = findTagPopoverScrollRoots(anchorEl);
    var reposition = function () {
      if (!document.getElementById("damTagEditPopover")) return;
      positionTagPopover(pop, anchorEl);
    };
    pop._damTagPopCleanup = function () {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      scrollRoots.forEach(function (host) {
        host.removeEventListener("scroll", reposition);
      });
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    scrollRoots.forEach(function (host) {
      host.addEventListener("scroll", reposition, { passive: true });
      });
  }

  function renderTagPicker(anchorEl, ctx, kind, options) {
    if (!options.length) {
      showToast("Brak listy opcji dla tego tagu.");
      _tagPickerOpening = false;
      return;
    }

    var pop = document.createElement("div");
    pop.id = "damTagEditPopover";
    pop.className =
      "dam-tag-edit-popover" +
      (kind === "subcategory" || kind === "index" ? " dam-tag-edit-popover--wide" : "");

    var pendingCode = ctx.currentCode || ctx.value || "";
    if (kind === "index" && pendingCode.indexOf(".") > 0) {
      pendingCode = pendingCode.split(".")[0];
    }
    var isLangMulti = kind === "lang";
    var pendingLangs = isLangMulti
      ? (ctx.currentLangs && ctx.currentLangs.slice()) || (pendingCode ? [pendingCode] : [])
      : null;
    var headTxt = tagPickerHead(kind);
    var canDirect = isAdmin() && adminModeOn();

    var html =
      '<div class="dam-thumb-picker__head dam-tag-edit-popover__head">' +
      "<strong>" +
      esc(headTxt) +
      (isLangMulti
        ? ' <small style="font-weight:500;color:#8b8d97">(wielokrotny)</small>'
        : "") +
      "</strong>" +
      '<button type="button" class="dam-viz-modal-close" aria-label="Zamknij" data-close data-dam-tip="Zamknij bez zapisu">' +
      '<i class="uil uil-times"></i></button></div>' +
      '<div class="dam-tag-edit-popover__search-wrap dam-search-wrap dam-search-wrap--picker">' +
      '<div class="dam-search-input-wrap">' +
      '<i class="uil uil-search" aria-hidden="true"></i>' +
      '<input type="text" id="damTagEditSearch" class="form-control dam-search-input dam-tag-edit-popover__search" placeholder="Szukaj..." autocomplete="off" />' +
      "</div></div>" +
      '<div class="dam-tag-edit-popover__list" data-tag-list></div>' +
      '<p class="dam-tag-edit-popover__empty" data-empty hidden>Brak opcji dla tego wyszukiwania.</p>';

    /* Tylko typ nośnika: admin może dodać nowy typ do słownika */
    if (isAdmin() && kind === "carrier") {
      html +=
        '<div class="dam-tag-edit-popover__foot">' +
        '<button type="button" class="dam-tag-edit-popover__addtype" data-add-type data-dam-tip="Dodaj nowy typ nośnika do słownika i Szablonów folderów (admin)">' +
        '<i class="uil uil-plus" aria-hidden="true"></i><span>Dodaj typ</span></button></div>';
    }

    html +=
      '<div class="dam-thumb-picker__footer dam-tag-edit-popover__actions dam-dialog-actions dam-modal-footer">' +
      '<button type="button" class="dam-tag-edit-popover__cancel" data-cancel data-dam-tip="Anuluj bez zapisu">' +
      '<i class="uil uil-times" aria-hidden="true"></i><span>Anuluj</span></button>' +
      '<button type="button" class="dam-tag-edit-popover__confirm dam-modal-footer__primary" data-confirm data-dam-tip="' +
      (canDirect ? "Zatwierdź wybór" : "Zgłoś propozycję") +
      '"><i class="uil uil-check" aria-hidden="true"></i><span>' +
      (canDirect ? "Zatwierdź" : "Zgłoś") +
      "</span></button></div>";

    ensureTagPopoverBtnStyles();

    pop._damTagOptions = options.slice();
    pop._damTagKind = kind;
    pop._damTagCtx = ctx;

    function optionBtnHtml(opt) {
      if (isLangMulti) {
        var langSel = pendingLangs.indexOf(String(opt.code)) !== -1;
        return (
          '<button type="button" class="dam-tag-edit-popover__opt dam-tag-edit-popover__opt--check' +
          (langSel ? " is-selected" : "") +
          '" data-code="' +
          esc(opt.code) +
          '" data-search-label="' +
          esc(String(opt.search || opt.label || opt.code).toLowerCase()) +
          '"><span class="dam-tag-edit-popover__opt-check" aria-hidden="true">' +
          (langSel ? "✓" : "") +
          '</span><span class="dam-tag-edit-popover__opt-label">' +
          esc(opt.label) +
          "</span></button>"
        );
      }
      var isCur =
        String(opt.code) === String(pendingCode) ||
        String(opt.label) === String(ctx.value) ||
        (kind === "subcategory" &&
          String(opt.code).toLowerCase() === String(ctx.value || "").toLowerCase());
      var isSel = String(opt.code) === String(pendingCode);
      return (
        '<button type="button" class="dam-tag-edit-popover__opt' +
        (isCur ? " is-current" : "") +
        (isSel ? " is-selected" : "") +
        '" data-code="' +
        esc(opt.code) +
        '" data-search-label="' +
        esc(String(opt.search || opt.label || opt.code).toLowerCase()) +
        '"><span class="dam-tag-edit-popover__opt-label">' +
        esc(opt.label) +
        "</span>" +
        (isCur ? ' <i class="uil uil-check"></i>' : "") +
        "</button>"
      );
    }

    function bindOptionClicks(scope) {
      if (!scope) return;
      scope.querySelectorAll("[data-code]").forEach(function (btn) {
        if (btn._damTagBound) return;
        btn._damTagBound = true;
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          setPending(btn.getAttribute("data-code"));
        });
      });
    }

    function paintTagList(filtered) {
      var listEl = pop.querySelector("[data-tag-list]");
      var emptyMsg = pop.querySelector("[data-empty]");
      if (!listEl) return;
      if (!filtered.length) {
        listEl.innerHTML = "";
        if (emptyMsg) emptyMsg.hidden = false;
        return;
      }
      if (emptyMsg) emptyMsg.hidden = true;
      listEl.innerHTML = filtered.map(optionBtnHtml).join("");
      bindOptionClicks(listEl);
    }

    /** Lekki filtr jak 3.1.5: hide/show istniejacych btn — bez rebuild innerHTML na kazdy znak. */
    function applySearchFilterLight(q) {
      var listEl = pop.querySelector("[data-tag-list]");
      var emptyMsg = pop.querySelector("[data-empty]");
      if (!listEl) return;
      q = String(q || "")
        .trim()
        .toLowerCase();
      var btns = listEl.querySelectorAll("[data-code]");
      if (!btns.length) {
        var boot = pop._damTagOptions || [];
        paintTagList(boot.length > 400 ? boot.slice(0, 400) : boot.slice());
        btns = listEl.querySelectorAll("[data-code]");
      }
      var visibleCount = 0;
      btns.forEach(function (btn) {
        var label = btn.getAttribute("data-search-label") || "";
        var match = !q || label.indexOf(q) !== -1;
        btn.hidden = !match;
        if (match) visibleCount++;
      });
      if (emptyMsg) emptyMsg.hidden = visibleCount > 0;
    }

    function filterTagOptions(q) {
      q = String(q || "")
        .trim()
        .toLowerCase();
      var src = pop._damTagOptions || [];
      if (!q) return src.length > 200 ? src.slice(0, 200) : src.slice();
      var out = [];
      var cap = 120;
      var numericOnly = kind === "index" && /^[\d.\s]+$/.test(q.replace(/\s/g, ""));
      for (var fi = 0; fi < src.length && out.length < cap; fi++) {
        var opt = src[fi];
        var label = String(opt.search || opt.label || opt.code || "").toLowerCase();
        if (numericOnly) {
          if (label.indexOf(q) === 0) out.push(opt);
        } else if (label.indexOf(q) !== -1) {
          out.push(opt);
        }
      }
      return out;
    }

    pop.innerHTML = html;
    document.body.appendChild(pop);
    requestAnimationFrame(function () {
      var boot = pop._damTagOptions || [];
      paintTagList(boot.length > 400 ? boot.slice(0, 400) : boot.slice());
      scheduleTagPopoverPosition(pop, anchorEl);
      bindTagPopoverReposition(pop, anchorEl);
    });

    function setPending(code) {
      if (isLangMulti) {
        var c = String(code);
        var ix = pendingLangs.indexOf(c);
        if (ix === -1) pendingLangs.push(c);
        else pendingLangs.splice(ix, 1);
        paintTagList(filterTagOptions(searchInput ? searchInput.value : ""));
        return;
      }
      pendingCode = code;
      pop.querySelectorAll("[data-code]").forEach(function (btn) {
        btn.classList.toggle("is-selected", btn.getAttribute("data-code") === String(code));
      });
    }

    bindOptionClicks(pop);

    var searchInput = pop.querySelector("#damTagEditSearch");
    function applySearch() {
      if (!searchInput) return;
      if (pop._damTagSearchTimer) clearTimeout(pop._damTagSearchTimer);
      pop._damTagSearchTimer = setTimeout(function () {
        pop._damTagSearchTimer = null;
        if (!document.getElementById("damTagEditPopover")) return;
        /* Light path: toggle hidden (3.1.5). Full paint only for lang multi (checkbox state). */
        if (isLangMulti) {
          requestAnimationFrame(function () {
            if (!document.getElementById("damTagEditPopover")) return;
            paintTagList(filterTagOptions(searchInput.value));
          });
          return;
        }
        applySearchFilterLight(searchInput.value);
      }, 80);
    }
    if (searchInput) {
      searchInput.addEventListener("input", applySearch);
      searchInput.addEventListener("keydown", function (e) {
        e.stopPropagation();
      });
      /* No auto-focus on open — WebView2 focus() freezes shell (parity assoc picker). */
    }

    pop._damTagRepaint = function (q) {
      applySearchFilterLight(q);
    };
    pop._damTagRebuild = function (q) {
      paintTagList(filterTagOptions(q));
    };

    var confirmBtn = pop.querySelector("[data-confirm]");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var choice = isLangMulti
          ? pendingLangs.slice()
          : pendingCode || ctx.currentCode || ctx.value || "";
        closePopover();
        applyTagPickerChoice(kind, ctx, choice);
      });
    }

    var cancelBtn = pop.querySelector("[data-cancel]");
    if (cancelBtn) cancelBtn.addEventListener("click", closePopover);
    var closeBtn = pop.querySelector("[data-close]");
    if (closeBtn) closeBtn.addEventListener("click", closePopover);

    var addBtn = pop.querySelector("[data-add-type]");
    if (addBtn) {
      addBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!isAdmin()) {
          showToast("Dodaj typ: tylko admin.");
          return;
        }
        var code = window.prompt("Kod PL / skrot na dysku (np. SASZ):");
        if (!code) return;
        var codeEn = window.prompt("Kod EN / alias (opcjonalnie):", "") || "";
        var label = window.prompt("Pelna nazwa PL (etykieta UI):", code) || code;
        fetch(bridgeUrl() + "/explorer/add-variant-type", {
          method: "POST",
          headers: bridgeAuthHeaders(),
          body: JSON.stringify({
            code: code.trim().toUpperCase(),
            code_en: String(codeEn || "").trim().toUpperCase(),
            label_pl: label,
          }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (res) {
            if (!res || !res.ok) {
              showToast("Blad: " + ((res && (res.message || res.error)) || "nie dodano typu"));
              return;
            }
            refreshCarrierTypesCache();
            closePopover();
            var nT = (res.templates_created && res.templates_created.length) || 0;
            showToast(
              "Typ dodany: " +
                label +
                (nT ? " (+" + nT + " szablonow)" : "") +
                (res.templates_errors && res.templates_errors.length
                  ? " [szablony: " + res.templates_errors[0] + "]"
                  : "")
            );
            /* Reopen picker with fresh types */
            setTimeout(function () {
              openTagPicker(anchorEl, Object.assign({}, ctx, { kind: "carrier" }));
            }, 200);
          })
          .catch(function () {
            showToast("Bridge offline - nie dodano typu.");
          });
      });
    }

    var addTagBtn = pop.querySelector("[data-add-tag]");
    if (addTagBtn) {
      addTagBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (kind === "subcategory") {
          if (!isAdmin()) {
            showToast("Dodaj podkategorie: tylko admin.");
            return;
          }
          var labelPl = window.prompt("Etykieta PL podkategorii (np. Mini batoniki):");
          if (!labelPl) return;
          var slugHint = String(labelPl)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48);
          var slug = window.prompt("Slug (a-z0-9-, max 48):", slugHint || "");
          if (!slug) return;
          fetch(bridgeUrl() + "/explorer/add-subcategory", {
            method: "POST",
            headers: bridgeAuthHeaders(),
            body: JSON.stringify({
              slug: String(slug).trim().toLowerCase(),
              label_pl: String(labelPl).trim(),
            }),
          })
            .then(function (r) {
              return r.json();
            })
            .then(function (res) {
              if (!res || !res.ok) {
                showToast("Blad: " + ((res && (res.message || res.error)) || "nie dodano"));
                return;
              }
              if (global.DamNaming) {
                if (!Array.isArray(global.DamNaming.subcategories)) {
                  global.DamNaming.subcategories = [];
                }
                global.DamNaming.subcategories.push(
                  res.subcategory || { slug: res.slug, label_pl: res.label_pl, custom: true }
                );
              }
              closePopover();
              showToast(res.message || ("Dodano podkategorie: " + res.label_pl));
              setTimeout(function () {
                openTagPicker(anchorEl, Object.assign({}, ctx, { kind: "subcategory" }));
              }, 200);
            })
            .catch(function () {
              showToast("Bridge offline - nie dodano podkategorii.");
            });
          return;
        }
        if (searchInput) {
          searchInput.focus();
          searchInput.placeholder = addTagButtonLabel(kind) + " (kategoria: " + kind + ")";
        }
        showToast("Zaznacz tag z listy i zatwierdz (kategoria: " + kind + ").");
      });
    }

    var changeCatBtn = pop.querySelector("[data-change-cat]");
    if (changeCatBtn) {
      changeCatBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var cats = ["lang", "carrier", "brand", "status", "category", "subcategory", "index"];
        var labels = {
          lang: "Jezyk",
          carrier: "Typ / nosnik",
          brand: "Marka",
          status: "Status",
          category: "Kategoria",
          subcategory: "Podkategoria",
          index: "Indeks",
        };
        var msg =
          "Zmien kategorie tagu:\n" +
          cats
            .map(function (c, i) {
              return i + 1 + ". " + (labels[c] || c);
            })
            .join("\n") +
          "\n\nPodaj numer:";
        var pick = window.prompt(msg, String(cats.indexOf(kind) + 1));
        if (!pick) return;
        var idx = parseInt(pick, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= cats.length) {
          showToast("Nieprawidlowy numer kategorii.");
          return;
        }
        closePopover();
        openTagPicker(anchorEl, Object.assign({}, ctx, { kind: cats[idx] }));
      });
    }

    if (global.DamTooltips && typeof global.DamTooltips.bind === "function") {
      global.DamTooltips.bind();
    }

    setTimeout(function () {
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onDocKey, true);
    }, 0);
  }

  /** Panel moderacji - decyzje TYLKO admin (sesja Bearer). */
  function fetchProposals() {
    return fetch(bridgeUrl() + "/tag-proposals", { headers: bridgeAuthHeaders() })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return { proposals: [] };
      });
  }

  function decideProposal(id, decision, newValue) {
    return fetch(bridgeUrl() + "/tag-proposals/decide", {
      method: "POST",
      headers: bridgeAuthHeaders(),
      body: JSON.stringify({ proposal_id: id, decision: decision, new_value: newValue || "" }),
    }).then(function (r) {
      return r.json();
    });
  }

  /** @deprecated Moderacja tylko w inbox.html (Wiadomosci). Zachowane API dla starych wywolan. */
  function renderModerationPanel(container) {
    if (!container) return;
    container.innerHTML =
      '<p class="dam-widget__meta">Moderacja tagow jest w <a href="inbox.html?tag=zgloszenie">Wiadomosci → Zgloszenia DAM</a>. Historia decyzji: filtr „Historia moderacji”.</p>';
  }

  function bridgeBase() {
    return bridgeUrl();
  }

  function humanCarrierForLog(code) {
    if (!code) return "?";
    if (global.DamLabels && typeof global.DamLabels.carrierLabel === "function") {
      return global.DamLabels.carrierLabel(code, code) || String(code);
    }
    return String(code);
  }

  function humanDiskStatusLabel(code) {
    var c = String(code || "")
      .trim()
      .toLowerCase();
    if (!c) return "";
    if (c === "f" || c === "aktualne" || c === "current" || c === "active") return "Aktualne";
    if (c === "x" || c === "nieaktualne" || c === "outdated" || c === "obsolete") return "Nieaktualne";
    if (c === "d" || c === "demo" || c === "prototype" || c === "prototyp") return "Demo / prototyp";
    if (c === "clear" || c === "none" || c === "bez" || c === "bez statusu") return "Bez statusu";
    return String(code);
  }

  /* Etykieta pochodzi z basename ścieżki na dysku (np. "Boost - Doypack - F") -
     usuwamy koncowa litere statusu, zeby nie duplikowac jej z detalem statusu. */
  function pathBasenameForLog(p) {
    var s = String(p || "").replace(/[\\/]+$/, "");
    if (!s) return "";
    var base = s.split(/[\\/]/).pop() || "";
    return base.replace(/\s*-\s*[FXD]$/i, "").trim();
  }

  /** Nazwa produktu z product_name albo folderu „NAZWA - [ wariant ]” w sciezce. */
  function productLabelForLog(entry) {
    if (!entry) return "";
    var named = String(entry.product_name || "").trim();
    if (named) return named;
    var p = String(entry.path || "").replace(/[\\/]+$/, "");
    if (!p) return "";
    var parts = p.split(/[\\/]/);
    var i;
    for (i = parts.length - 1; i >= 0; i--) {
      var part = String(parts[i] || "");
      if (!/[\u2014\u2013]\s*\[/.test(part) && !/\s-\s\[/.test(part)) continue;
      return part
        .replace(/\s*-\s*[FXD]\s*$/i, "")
        .replace(/\s*[\u2014\u2013-]\s*\[[^\]]*\]\s*$/, "")
        .trim();
    }
    return "";
  }

  function formatChangeLogTs(ts) {
    var raw = String(ts || "").trim();
    if (!raw) return "";
    var m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (m) return m[3] + "." + m[2] + "." + m[1] + " " + m[4] + ":" + m[5];
    return raw.replace("T", " ").slice(0, 16);
  }

  function statusLetterFromCode(code) {
    var c = String(code || "")
      .trim()
      .toLowerCase();
    if (!c) return "";
    if (c === "f" || c === "aktualne" || c === "current" || c === "active") return "F";
    if (c === "x" || c === "nieaktualne" || c === "outdated" || c === "obsolete") return "X";
    if (c === "d" || c === "demo" || c === "prototype" || c === "prototyp") return "D";
    if (c === "clear" || c === "none" || c === "bez" || c === "bez statusu") return "-";
    if (/^[fxd]$/i.test(String(code).trim())) return String(code).trim().toUpperCase();
    return "";
  }

  function changelogChipClass(letter) {
    if (letter === "F") return "dam-lifecycle-chip dam-lifecycle-chip--f";
    if (letter === "X") return "dam-lifecycle-chip dam-lifecycle-chip--x";
    if (letter === "D") return "dam-lifecycle-chip dam-lifecycle-chip--d";
    if (letter === "-" || letter === "\u2014" || letter === "∅") {
      return "dam-lifecycle-chip dam-lifecycle-chip--clear";
    }
    return "dam-lifecycle-chip dam-lifecycle-chip--clear";
  }

  function changelogAuthorShort(actor) {
    var full = String(actor || "").trim();
    if (!full) return { label: "", full: "" };
    var at = full.indexOf("@");
    var label = at > 0 ? full.slice(0, at) : full;
    if (label.length > 24) label = label.slice(0, 22) + "…";
    return { label: label, full: full };
  }

  /** Struktura wpisu jak w modalu Historia statusów (dam-life-hist) - do popovera. */
  function changeLogEntryParts(entry) {
    var empty = {
      letter: "-",
      scope: "Zmiana",
      title: "zmiana na dysku",
      product: "",
      index: "",
      when: "",
      actor: "",
      actorFull: "",
    };
    if (!entry) return empty;
    var cat = String(entry.category || entry.action || "");
    var action = String(entry.action || "");
    var when = formatChangeLogTs(entry.ts);
    var who = changelogAuthorShort(entry.actor);
    var prod = productLabelForLog(entry);
    var idx = String(entry.revision_index || entry.index || "").trim();
    var parts = {
      letter: "-",
      scope: "Zmiana",
      title: "",
      product: prod,
      index: idx,
      when: when,
      actor: who.label,
      actorFull: who.full,
    };

    if (action === "rename_index" || cat === "index") {
      parts.letter = "I";
      parts.scope = "Indeks";
      parts.title = "Indeks " + (entry.index_from || "?") + " -> " + (entry.index_to || "?");
      if (!parts.index) parts.index = String(entry.index_to || entry.index_from || "").trim();
      return parts;
    }
    if (entry.carrier_from || entry.carrier_to) {
      parts.letter = "T";
      parts.scope = "Typ";
      parts.title =
        "Typ " + humanCarrierForLog(entry.carrier_from) + " -> " + humanCarrierForLog(entry.carrier_to);
      return parts;
    }
    if (cat === "lifecycle_status" || action.indexOf("lifecycle") === 0) {
      /* "Nieaktualne" = status PRODUKTU/WARIANTU na dysku (litera X / archiwum).
         To NIE znaczy, ze ten log jest przestarzaly - to jest tresc zatwierdzonej zmiany. */
      var stFrom = humanDiskStatusLabel(entry.status_from || entry.from);
      var stTo = humanDiskStatusLabel(entry.status_to || entry.to || entry.status);
      var scope = String(entry.scope || "").toLowerCase();
      var whoLabel =
        scope === "product" ? "Status produktu" : scope === "variant" ? "Status wariantu" : "Status";
      parts.scope = scope === "product" ? "Produkt" : scope === "variant" ? "Wariant" : "Status";
      parts.letter =
        statusLetterFromCode(entry.status_to || entry.to || entry.status) ||
        statusLetterFromCode(entry.status_from || entry.from) ||
        "-";
      if (stFrom && stTo && stFrom !== stTo) {
        parts.title = whoLabel + ": " + stFrom + " -> " + stTo;
      } else if (stTo) {
        parts.title = whoLabel + ": " + stTo;
      } else {
        parts.title = whoLabel + " na dysku";
      }
      if (!parts.index) {
        var base = pathBasenameForLog(entry.path);
        if (base && base !== prod) parts.index = base;
      }
      return parts;
    }
    if (action === "rename_folder" || cat === "rename") {
      parts.letter = "R";
      parts.scope = "Rename";
      parts.title = "Rename folderu / plików";
      if (!parts.product) {
        var bn = pathBasenameForLog(entry.path);
        if (bn) parts.product = bn;
      }
      return parts;
    }
    parts.title = cat || action || "zmiana na dysku";
    return parts;
  }

  function changeLogRowDetail(entry) {
    if (!entry) return "zmiana na dysku";
    var p = changeLogEntryParts(entry);
    var bits = [p.title || "zmiana na dysku"];
    if (p.product) bits.push(p.product);
    if (p.index && p.index !== p.product) bits.push(p.index);
    return bits.join(" · ");
  }

  function formatChangeLogEntry(entry) {
    if (!entry) return "Brak historii zmian";
    /* Bez prefiksu „Ostatnia zmiana…” - etykieta DYSK + tip to tlumacza;
       wazna tresc (Status wariantu: Nieaktualne · produkt) musi byc na poczatku
       bo hint ma ellipsis (max ~340px). */
    var ts = formatChangeLogTs(entry.ts);
    return changeLogRowDetail(entry) + (ts ? " · " + ts : "");
  }

  var CHANGELOG_HINT_TIP =
    "Ostatnia zatwierdzona zmiana na dysku X: (status produktu/wariantu F/X/D, typ, indeks lub rename). " +
    "„Nieaktualne” = litera X (archiwum wariantu/produktu), nie oznacza że ten pasek jest przestarzały. " +
    "To podgląd logu mostu 8766 - nie mylić z „Baza online” (Postgres).";

  var CHANGELOG_LABEL_TIP =
    "Log zatwierdzonych zmian na dysku X: (status produktu/wariantu, typ, indeks, rename). Wymaga ADMIN ON. Nie mylić z Postgres „Baza online”.";

  var CHANGELOG_BTN_TIP =
    "Pełna lista ostatnich zatwierdzonych zmian na dysku X: (status, typ, indeks, rename). To podgląd - każda zmiana jest już na trwałe zapisana w logu, nie trzeba jej cofać z tego miejsca.";

  function rebindChangeLogTips() {
    var bar = document.getElementById("damChangeLogBar");
    if (!bar) return;
    var label = bar.querySelector(".dam-changelog-bar__label");
    var btn = document.getElementById("damChangeHistoryBtn");
    if (label) {
      label.removeAttribute("title");
      label.setAttribute("data-dam-tip", CHANGELOG_LABEL_TIP);
      label._damTipBound = false;
    }
    if (btn) {
      btn.removeAttribute("title");
      btn.setAttribute("data-dam-tip", CHANGELOG_BTN_TIP);
      btn._damTipBound = false;
    }
    if (global.DamTooltips && typeof global.DamTooltips.bind === "function") {
      global.DamTooltips.bind(bar);
    }
  }

  function setChangeLogOfflineHint(hint, reason) {
    if (!hint) return;
    var msg =
      reason === "login"
        ? "Zaloguj się, aby zobaczyć historię zmian"
        : "Most zmian niedostępny - historia lokalnie niedostępna";
    var tip =
      reason === "login"
        ? "Most 8766 działa, ale /change-log wymaga sesji. „Baza online” to Postgres - to osobny status."
        : "Nie udało się połączyć z mostem (8766) albo endpoint historii zmian nie odpowiada. Historia działa tylko przez most na dysku X:; nie mylić z „Baza online”.";
    hint.textContent = msg;
    hint.removeAttribute("title");
    hint.setAttribute("data-dam-tip", tip);
  }

  function setChangeLogTipSuppress(on) {
    var bar = document.getElementById("damChangeLogBar");
    if (!bar) return;
    if (on) {
      bar.setAttribute("data-dam-tip-suppress", "1");
      if (global.DamTooltips && typeof global.DamTooltips.hide === "function") {
        global.DamTooltips.hide();
      }
    } else {
      bar.removeAttribute("data-dam-tip-suppress");
    }
  }

  function mountChangeLogBarInSearchScope() {
    var bar = document.getElementById("damChangeLogBar");
    if (!bar) return;
    var scope =
      document.querySelector("#vizSearchScope > .dam-search-scope") ||
      document.querySelector("#vizSearchScope .dam-search-scope");
    if (scope && bar.parentElement !== scope) {
      scope.appendChild(bar);
    }
    /* Nested under toolbar: skip / undo stuck DamGridReveal page-entrance */
    bar.setAttribute("data-dam-bar-revealed", "1");
    bar.style.opacity = "";
    bar.style.visibility = "";
    bar.style.transform = "";
  }

  /* === Shared Historia (product chrome) - modes: global | recent | product === */
  var lastChangeLogEntries = [];
  var lastLifecycleHistory = [];
  var lastMergedLifeRows = [];
  var changeHistoryPopoverEl = null;
  var changeHistoryAnchorBtn = null;
  var lifeHistOverlayEl = null;
  var lifeHistBusy = false;
  var lifeHistUndo = null;
  var LIFE_HIST_RECENT_LIMIT = 40;
  var LIFE_HIST_GLOBAL_LIMIT = 250;

  function changeHistoryTriggerBtns() {
    return [
      document.getElementById("damChangeHistoryBtn"),
      document.getElementById("damSettingsChangeHistoryBtn"),
    ].filter(Boolean);
  }

  function setChangeHistoryExpanded(on) {
    changeHistoryTriggerBtns().forEach(function (btn) {
      btn.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  function lifeHistAuthorShort(who) {
    var raw = String(who || "").trim();
    if (!raw) return { label: "", full: "" };
    var at = raw.indexOf("@");
    if (at < 1) return { label: raw.length > 24 ? raw.slice(0, 22) + "…" : raw, full: raw };
    var name = raw
      .slice(0, at)
      .split(/[._-]+/)
      .filter(Boolean)
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
    var label = name || raw;
    if (label.length > 24) label = label.slice(0, 22) + "…";
    return { label: label, full: raw };
  }

  function lifeHistHashtag(id) {
    var s = String(id || "").trim();
    if (!s || s === "current") return "";
    return s.charAt(0) === "#" ? s : "#" + s;
  }

  function lifeHistFilterLetter(letter) {
    var l = String(letter || "-");
    if (l === "-" || l === "∅" || l === "clear" || !l) return "∅";
    if (l === "F" || l === "X" || l === "D") return l;
    return "∅";
  }

  function lifeHistStatusCode(letterOrStatus) {
    var lit = statusLetterFromCode(letterOrStatus);
    if (!lit) {
      var raw = String(letterOrStatus || "").trim().toLowerCase();
      if (raw === "aktualne") return "aktualne";
      if (raw === "nieaktualne") return "nieaktualne";
      if (raw === "demo") return "demo";
      return "clear";
    }
    if (lit === "F") return "aktualne";
    if (lit === "X") return "nieaktualne";
    if (lit === "D") return "demo";
    return "clear";
  }

  function normalizeLifecycleHistRow(h) {
    if (!h || !h.id) return null;
    var action = String(h.action || "");
    if (action.indexOf("reconcile") !== -1 && !h.letter && !h.status && !h.scope) return null;
    var letter =
      statusLetterFromCode(h.letter || h.status || h.to || h.after) ||
      (h.letter == null && (h.status === "clear" || !h.status) ? "-" : "");
    if (!letter && action !== "lifecycle_status" && action !== "lifecycle_restore") return null;
    if (!letter) letter = "-";
    var scope = String(h.scope || "").toLowerCase();
    var scopeLabel =
      scope === "product" ? "Produkt" : scope === "variant" ? "Wariant" : "Status";
    var st = humanDiskStatusLabel(h.status || h.letter || letter);
    var title =
      scopeLabel +
      ": " +
      (st || ((letter === "-" || letter === "\u2014") ? "Bez statusu" : letter));
    var pid = String(h.product_id || "");
    var pname = productLabelForLog(h) || pid;
    var idx = String(h.revision_index || h.index || "").trim();
    var tagId = h.id;
    return {
      id: String(h.id),
      ts: h.ts || "",
      letter: letter,
      status: h.status || lifeHistStatusCode(letter),
      scope: scope || "variant",
      scopeLabel: scopeLabel,
      title: title,
      product_id: pid,
      product_name: pname,
      revision_index: idx,
      path: h.path || h.variant_path || "",
      product_path: h.product_path || "",
      actor: h.actor || h.user || h.by || "",
      hashtag: lifeHistHashtag(tagId),
      kind: "lifecycle",
      can_restore: !!(h.path || h.product_path || idx || pid),
      restored_from: h.restored_from || "",
      action: action,
      undo_snapshot: h.undo_snapshot || null,
      _isCurrent: !!h._isCurrent,
      _raw: h,
    };
  }

  function normalizeChangeLogHistRow(entry) {
    if (!entry) return null;
    var p = changeLogEntryParts(entry);
    var cat = String(entry.category || entry.action || "");
    var action = String(entry.action || "");
    var isLife =
      cat === "lifecycle_status" || action.indexOf("lifecycle") === 0;
    var lcId = String(entry.lifecycle_history_id || "").trim();
    var id = lcId || String(entry.id || "");
    if (!id) return null;
    var letter = isLife
      ? statusLetterFromCode(entry.letter || entry.status_to || entry.to || entry.status) ||
        statusLetterFromCode(entry.status_from || entry.from) ||
        "-"
      : p.letter === "I" || p.letter === "T" || p.letter === "R"
        ? "-"
        : p.letter || "-";
    var scope = String(entry.scope || "").toLowerCase();
    var scopeLabel = p.scope || (isLife ? "Status" : "Plik na dysku");
    return {
      id: id,
      chg_id: String(entry.id || ""),
      ts: entry.ts || "",
      letter: letter,
      status: entry.status || entry.status_to || lifeHistStatusCode(letter),
      scope: scope || (isLife ? "variant" : "disk"),
      scopeLabel: scopeLabel,
      title: (p.title || changeLogRowDetail(entry) || "zmiana na dysku"),
      product_id: String(entry.product_id || ""),
      product_name: p.product || productLabelForLog(entry) || "",
      revision_index: p.index || String(entry.revision_index || entry.index || "").trim(),
      path: entry.path || (entry.folder_rename && entry.folder_rename.new_path) || "",
      product_path: entry.product_path || "",
      actor: entry.actor || "",
      hashtag: lifeHistHashtag(lcId || entry.id),
      kind: isLife ? "lifecycle" : "disk",
      can_restore: !!(isLife && (entry.path || entry.product_id || entry.revision_index)),
      restored_from: "",
      action: action,
      undo_snapshot: null,
      _isCurrent: false,
      _raw: entry,
    };
  }

  function mergeLifeHistRows(chgEntries, lifeHist, mode) {
    var byId = {};
    var out = [];
    (lifeHist || []).forEach(function (h) {
      var row = normalizeLifecycleHistRow(h);
      if (!row) return;
      byId[row.id] = row;
    });
    (chgEntries || []).forEach(function (e) {
      var row = normalizeChangeLogHistRow(e);
      if (!row) return;
      if (byId[row.id]) {
        /* Prefer lifecycle store row; enrich name from change-log */
        if (!byId[row.id].product_name && row.product_name) {
          byId[row.id].product_name = row.product_name;
        }
      return;
    }
      byId[row.id] = row;
    });
    Object.keys(byId).forEach(function (k) {
      out.push(byId[k]);
    });
    out.sort(function (a, b) {
      return String(b.ts || "").localeCompare(String(a.ts || ""));
    });
    var limit = mode === "recent" ? LIFE_HIST_RECENT_LIMIT : LIFE_HIST_GLOBAL_LIMIT;
    if (out.length > limit) out = out.slice(0, limit);
    return out;
  }

  function lifeHistFilterChipsHtml() {
    return ["F", "X", "D", "∅"]
      .map(function (l) {
        var label = l === "∅" ? "-" : l;
        var tip =
          l === "∅"
            ? "Filtruj wpisy: bez statusu (odznaczono) oraz inne zmiany dysku"
            : "Filtruj wpisy: status " + l;
        var chipL = l === "∅" ? "-" : l;
        return (
          '<button type="button" class="dam-life-hist__filter ' +
          changelogChipClass(chipL) +
          '" data-life-filter="' +
          l +
          '" aria-pressed="false" title="' +
          esc(tip) +
          '" data-dam-tip="' +
          esc(tip) +
          '">' +
          esc(label) +
          "</button>"
        );
      })
      .join("");
  }

  function lifeHistEntryHtml(h, opts) {
    opts = opts || {};
    var letter = lifeHistFilterLetter(h.letter);
    var dotLetter = letter === "∅" ? "-" : letter;
    var when = formatChangeLogTs(h.ts) || String(h.ts || "").replace("T", " ").slice(0, 16);
    var who = lifeHistAuthorShort(h.actor);
    var scope = h._isCurrent ? "Teraz" : h.scopeLabel || "Status";
    var idxShow = String(h.revision_index || "");
    var pid = String(h.product_id || "");
    var pname = String(h.product_name || pid || "");
    var tag = h.hashtag || "";
    var noteParts = [];
    if (h._isCurrent) {
      noteParts.push(
        '<span class="dam-life-hist__note dam-life-hist__note--current">Aktualny stan na dysku</span>'
      );
    } else if (tag) {
      noteParts.push(
        '<span class="dam-life-hist__tag" title="Identyfikator wpisu">' + esc(tag) + "</span>"
      );
    }
    if (h.restored_from) {
      var fromTag =
        String(h.restored_from).charAt(0) === "#"
          ? h.restored_from
          : "#" + h.restored_from;
      noteParts.push(
        '<span class="dam-life-hist__note">Przywrócono z <strong>' +
          esc(fromTag) +
          "</strong></span>"
      );
    } else if (!h._isCurrent && h.kind === "lifecycle" && (h.letter === "-" || h.letter === "\u2014" || h.status === "clear")) {
      noteParts.push(
        '<span class="dam-life-hist__note">Bez statusu (odznaczono F/X/D)</span>'
      );
    }
    var noteHtml = noteParts.join("");
    var newestId = opts.newestId || "";
    var canUndo =
      !h._isCurrent &&
      h.id &&
      h.id === newestId &&
      (h.restored_from ||
        h.action === "lifecycle_restore" ||
        (lifeHistUndo && lifeHistUndo.entryId === h.id));
    var adminOk = isAdmin() && adminModeOn();
    var restoreDisabled = lifeHistBusy || h._isCurrent || !h.can_restore || !adminOk;
    var undoDisabled = lifeHistBusy || !canUndo || !adminOk;
    var copyTarget = tag || idxShow;
    return (
      '<li class="dam-life-hist__item' +
      (h._isCurrent ? " dam-life-hist__item--current" : "") +
      '" data-life-row-id="' +
      esc(h.id) +
      '">' +
      '<span class="dam-life-hist__rail">' +
      '<span class="dam-life-hist__dot ' +
      changelogChipClass(dotLetter) +
      '" title="' +
      (h._isCurrent ? "Aktualny stan" : "Status " + esc(dotLetter)) +
      '">' +
      esc(dotLetter) +
      "</span>" +
      '<span class="dam-life-hist__line" aria-hidden="true"></span>' +
      "</span>" +
      '<span class="dam-life-hist__body">' +
      '<span class="dam-life-hist__row1">' +
      '<span class="dam-life-hist__when">' +
      esc(when || "brak daty") +
      "</span>" +
      '<span class="dam-life-hist__scope">' +
      esc(scope) +
      "</span>" +
      (noteHtml ? '<span class="dam-life-hist__meta-inline">' + noteHtml + "</span>" : "") +
      '<span class="dam-life-hist__actions">' +
      (copyTarget
        ? '<button type="button" class="dam-life-hist__act" data-life-copy="' +
          esc(copyTarget) +
          '" title="Kopiuj" aria-label="Kopiuj" data-dam-tip="Kopiuj ' +
          esc(copyTarget) +
          '"><i class="uil uil-copy"></i></button>'
        : "") +
      (pid
        ? '<button type="button" class="dam-life-hist__act" data-life-go="' +
          esc(pid) +
          '" title="Przejdź do produktu" aria-label="Przejdź do produktu" data-dam-tip="Otwiera produkt w Eksplorerze"><i class="uil uil-sitemap"></i></button>'
        : "") +
      (!h._isCurrent && h.can_restore
        ? '<button type="button" class="dam-life-hist__act dam-life-hist__act--restore" data-life-restore="' +
          esc(h.id) +
          '" data-life-letter="' +
          esc(dotLetter) +
          '"' +
          (restoreDisabled ? " disabled" : "") +
          ' title="Przywróć ten stan" aria-label="Przywróć stan" data-dam-tip="Przywraca status tej pozycji"><i class="uil uil-redo" aria-hidden="true"></i></button>'
        : "") +
      (canUndo
        ? '<button type="button" class="dam-life-hist__act dam-life-hist__act--undo" data-life-undo="' +
          esc(h.id) +
          '"' +
          (undoDisabled ? " disabled" : "") +
          ' title="Cofnij zmianę" aria-label="Cofnij zmianę" data-dam-tip="Przywraca poprzedni stan sprzed ostatniego przywrócenia"><i class="uil uil-undo" aria-hidden="true"></i></button>'
        : "") +
      "</span></span>" +
      '<span class="dam-life-hist__detail">' +
      esc(h.title || (h.kind === "disk" ? "Zmiana na dysku" : "Zmiana statusu")) +
      (pname && h.title && h.title.indexOf(pname) === -1 ? " · " + esc(pname) : "") +
      "</span>" +
      '<span class="dam-life-hist__row2">' +
      (pname
        ? '<span class="dam-viz-badge" title="Produkt">' + esc(pname) + "</span>"
        : "") +
      (idxShow && idxShow !== pname
        ? '<span class="dam-viz-badge dam-viz-badge--index dam-life-hist__index" title="Indeks" data-life-index="' +
          esc(idxShow) +
          '" data-life-path="' +
          esc(h.path || "") +
          '"><span class="dam-life-hist__index-label">' +
          esc(idxShow) +
          '</span><span class="dam-life-hist__index-preview" aria-hidden="true"><img alt="" loading="lazy" decoding="async" /></span></span>'
        : "") +
      (who.label
        ? '<span class="dam-life-hist__author" title="' +
          esc(who.full) +
          '" data-dam-tip="' +
          esc(who.full) +
          '"><i class="uil uil-user" aria-hidden="true"></i> ' +
          esc(who.label) +
          "</span>"
        : "") +
      "</span></span></li>"
    );
  }


  function resolveLifeHistThumbPath(idx, pathHint) {
    if (pathHint) return String(pathHint);
    var fi = global._DAM_FILE_INDEX;
    if (!fi || !fi.products) return "";
    var ik = String(idx || "").trim();
    for (var pi = 0; pi < fi.products.length; pi++) {
      var p = fi.products[pi];
      var revs = (p && p.revisions) || [];
      for (var ri = 0; ri < revs.length; ri++) {
        var r = revs[ri];
        if (r && r.index === ik && r.path) return r.path;
      }
    }
    return "";
  }

  function bindLifeHistIndexPreviews(root) {
    if (!root) return;
    root.querySelectorAll(".dam-life-hist__index").forEach(function (el) {
      if (el._damIdxPrevBound) return;
      el._damIdxPrevBound = true;
      var img = el.querySelector(".dam-life-hist__index-preview img");
      if (!img) return;
      var loaded = "";
      function showThumb() {
        var path = resolveLifeHistThumbPath(
          el.getAttribute("data-life-index") || "",
          el.getAttribute("data-life-path") || ""
        );
        if (!path) return;
        var url =
          global.DamPreviewTruth && typeof global.DamPreviewTruth.thumbCacheUrl === "function"
            ? global.DamPreviewTruth.thumbCacheUrl(path, "card")
            : "";
        if (!url) return;
        if (loaded !== url) {
          loaded = url;
          img.src = url;
        }
        el.classList.add("is-preview-ready");
      }
      el.addEventListener("mouseenter", showThumb);
      el.addEventListener("focus", showThumb);
    });
  }

  function lifeHistListHtml(rows, opts) {
    opts = opts || {};
    if (!rows.length) {
      return (
        '<div class="dam-life-hist__empty">' +
        '<i class="uil uil-history" aria-hidden="true"></i>' +
        "<p>" +
        (opts.emptyFiltered
          ? "Brak wpisów dla wybranego filtra / wyszukiwania."
          : "Brak wpisów historii.<br>Zmiany F / X / D i rename pojawią się tutaj automatycznie.") +
        "</p></div>"
      );
    }
    var newestId = "";
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i]._isCurrent && rows[i].id) {
        newestId = rows[i].id;
        break;
      }
    }
    return (
      '<ul class="dam-life-hist__timeline" aria-label="Oś czasu zmian">' +
      rows
        .map(function (h) {
          return lifeHistEntryHtml(h, { newestId: newestId });
        })
        .join("") +
      "</ul>"
    );
  }

  function lifeHistChromeHtml(cfg) {
    cfg = cfg || {};
    var mode = cfg.mode || "global";
    var title =
      cfg.title ||
      (mode === "recent" ? "Historia zmian na dysku" : "Historia zmian na dysku");
    var lead =
      cfg.lead ||
      "Pełna historia F / X / D / bez statusu oraz zmian na dysku (wszystkie produkty). Filtry, hashtagi (#lc_…), kopiuj / drzewo / przywróć.";
    var closeBtn = cfg.showClose
      ? '<button type="button" class="dam-changelog-history__close" aria-label="Zamknij" data-life-hist-close data-dam-no-tip="1">&times;</button>'
      : "";
    var foot =
      cfg.footerHtml ||
      (mode === "recent"
        ? '<p class="dam-changelog-history__footnote">Podgląd ostatnich wpisów. Pełna lista: <a href="settings.html#historiaZmian">Ustawienia → Historia zmian na dysku</a>.</p>'
        : '<p class="dam-changelog-history__footnote">Źródło: most 8766 (lifecycle-status + change-log). Przywracanie wymaga ADMIN ON.</p>');
    var actions =
      cfg.actionsHtml ||
      (cfg.showClose
        ? '<div class="dam-lifecycle-history-modal__actions">' +
          '<button type="button" class="geex-btn geex-btn--sm" data-life-hist-close>Zamknij</button>' +
          '<a class="geex-btn geex-btn--sm geex-btn--primary" href="inbox.html" data-dam-tip="Zgłoś problem w Wiadomościach">Zgłoś</a>' +
          "</div>"
        : "");
    return (
      '<div class="dam-life-hist dam-life-hist--' +
      esc(mode) +
      '" data-life-hist-mode="' +
      esc(mode) +
      '">' +
      '<div class="dam-life-hist__head">' +
      "<" +
      (cfg.headingTag || "h3") +
      ' class="dam-life-hist__title">' +
      esc(title) +
      "</" +
      (cfg.headingTag || "h3") +
      ">" +
      '<span class="dam-life-hist__count" data-life-hist-count title="Liczba wpisów">0</span>' +
      closeBtn +
      "</div>" +
      '<p class="dam-lifecycle-history__lead">' +
      lead +
      "</p>" +
      '<div class="dam-life-hist__filters" role="group" aria-label="Filtr statusów">' +
      '<span class="dam-life-hist__filter-label">Filtr:</span>' +
      lifeHistFilterChipsHtml() +
      "</div>" +
      '<div class="dam-life-hist__search">' +
      '<label class="visually-hidden" for="' +
      esc(cfg.searchId || "damLifeHistSearch") +
      '">Szukaj w historii</label>' +
      '<input type="search" class="dam-life-hist__search-input" id="' +
      esc(cfg.searchId || "damLifeHistSearch") +
      '" placeholder="Szukaj: nazwa, indeks, produkt, #lc_…" autocomplete="off" />' +
      "</div>" +
      '<div class="dam-life-hist__list-host" data-life-hist-list></div>' +
      foot +
      actions +
      "</div>"
    );
  }

  function findLifeRowById(id) {
    if (!id) return null;
    for (var i = 0; i < lastMergedLifeRows.length; i++) {
      if (lastMergedLifeRows[i].id === id) return lastMergedLifeRows[i];
    }
    return null;
  }

  function applyLifecycleFromHistRow(row, mode) {
    if (!row) return Promise.resolve({ ok: false });
    if (!isAdmin() || !adminModeOn()) {
      showToast("Włącz tryb admina, aby przywracać statusy");
      return Promise.resolve({ ok: false });
    }
    var targetStatus =
      mode === "undo" && lifeHistUndo && lifeHistUndo.snapshot
        ? lifeHistUndo.snapshot.status || "clear"
        : lifeHistStatusCode(row.letter || row.status);
    var path = row.path || "";
    var body = {
      scope: row.scope === "product" ? "product" : "variant",
      status: targetStatus,
      path: path,
      product_path: row.product_path || "",
      product_id: row.product_id || "",
      revision_index: row.revision_index || "",
      dry_run: false,
    };
    if (!body.path && !body.revision_index && !body.product_id) {
      showToast("Brak ścieżki do przywrócenia statusu");
      return Promise.resolve({ ok: false });
    }
    lifeHistBusy = true;
    showToast(mode === "undo" ? "Cofam przywrócenie…" : "Przywracam stan z historii…");
    return fetch(bridgeBase() + "/lifecycle-status", {
      method: "POST",
      headers: bridgeAuthHeaders(),
      credentials: "same-origin",
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.ok) {
          showToast((data && data.hint) || (data && data.error) || "Błąd przywracania");
          return data || { ok: false };
        }
        if (mode === "restore") {
          lifeHistUndo = {
            entryId: data.history_id || "",
            snapshot: {
              status: row.status || lifeHistStatusCode(row.letter),
              scope: body.scope,
              path: body.path,
              product_id: body.product_id,
              revision_index: body.revision_index,
            },
            restoredFrom: row.id,
          };
        } else {
          lifeHistUndo = null;
        }
        showToast(mode === "undo" ? "Cofnięto ostatnie przywrócenie" : "Przywrócono stan z historii");
        return fetchLifeHistBundle().then(function () {
          return data;
        });
      })
      .finally(function () {
        lifeHistBusy = false;
        refreshAllLifeHistViews();
      });
  }

  function bindLifeHistRoot(root, opts) {
    opts = opts || {};
    if (!root) return;
    var mode = opts.mode || root.getAttribute("data-life-hist-mode") || "global";
    var state = root._damLifeHistState || { filters: {}, q: "" };
    root._damLifeHistState = state;

    function allRows() {
      var rows = lastMergedLifeRows.slice();
      if (mode === "recent" && rows.length > LIFE_HIST_RECENT_LIMIT) {
        rows = rows.slice(0, LIFE_HIST_RECENT_LIMIT);
      }
      return rows;
    }

    function visibleRows() {
      var rows = allRows();
      var keys = Object.keys(state.filters);
      var q = String(state.q || "")
        .trim()
        .toLowerCase();
      if (keys.length) {
        rows = rows.filter(function (h) {
          if (h._isCurrent) return true;
          return !!state.filters[lifeHistFilterLetter(h.letter)];
        });
      }
      if (q) {
        rows = rows.filter(function (h) {
          var blob = [
            h.product_name,
            h.product_id,
            h.revision_index,
            h.hashtag,
            h.title,
            h.actor,
            h.path,
          ]
            .join(" ")
            .toLowerCase();
          return blob.indexOf(q) !== -1;
        });
      }
      return rows;
    }

    function repaint() {
      var host = root.querySelector("[data-life-hist-list]");
      var cnt = root.querySelector("[data-life-hist-count]");
      var vis = visibleRows();
      if (cnt) cnt.textContent = String(vis.length);
      if (host) {
        host.innerHTML = lifeHistListHtml(vis, {
          emptyFiltered: !!(Object.keys(state.filters).length || state.q) && allRows().length,
        });
      }
      root.classList.toggle("is-life-hist-busy", lifeHistBusy);
      bindRowActions();
      if (global.DamTooltips && typeof global.DamTooltips.bind === "function") {
        global.DamTooltips.bind(root);
      }
    }

    function bindRowActions() {
      root.querySelectorAll("[data-life-copy]").forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var txt = btn.getAttribute("data-life-copy") || "";
          if (!txt) return;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(function () {
              showToast("Skopiowano: " + txt);
            });
          }
        };
      });
      root.querySelectorAll("[data-life-go]").forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var pid = btn.getAttribute("data-life-go") || "";
          if (!pid) return;
          location.href = "explorer.html?product=" + encodeURIComponent(pid);
        };
      });
      root.querySelectorAll("[data-life-restore]").forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          if (btn.disabled || lifeHistBusy) return;
          var row = findLifeRowById(btn.getAttribute("data-life-restore") || "");
          if (!row) {
            showToast("Nie znaleziono wpisu historii");
          return;
        }
          applyLifecycleFromHistRow(row, "restore");
        };
      });
      root.querySelectorAll("[data-life-undo]").forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          if (btn.disabled || lifeHistBusy) return;
          var row = findLifeRowById(btn.getAttribute("data-life-undo") || "");
          if (!row && lifeHistUndo) {
            row = {
              id: lifeHistUndo.entryId,
              status: lifeHistUndo.snapshot && lifeHistUndo.snapshot.status,
              letter: "",
              scope: lifeHistUndo.snapshot && lifeHistUndo.snapshot.scope,
              path: lifeHistUndo.snapshot && lifeHistUndo.snapshot.path,
              product_id: lifeHistUndo.snapshot && lifeHistUndo.snapshot.product_id,
              revision_index: lifeHistUndo.snapshot && lifeHistUndo.snapshot.revision_index,
              can_restore: true,
            };
          }
          applyLifecycleFromHistRow(row, "undo");
        };
      });
    }

    if (!root._damLifeHistBound) {
      root._damLifeHistBound = true;
      root.querySelectorAll("[data-life-filter]").forEach(function (chip) {
        chip.addEventListener("click", function () {
          var l = chip.getAttribute("data-life-filter") || "";
          if (state.filters[l]) delete state.filters[l];
          else state.filters[l] = true;
          chip.classList.toggle("is-on", !!state.filters[l]);
          chip.setAttribute("aria-pressed", state.filters[l] ? "true" : "false");
          repaint();
        });
      });
      var search = root.querySelector(".dam-life-hist__search-input");
      if (search) {
        search.addEventListener("input", function () {
          state.q = search.value || "";
          repaint();
        });
      }
      root.querySelectorAll("[data-life-hist-close]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (typeof opts.onClose === "function") opts.onClose();
        });
      });
    }

    root._damLifeHistRepaint = function () {
      repaint();
      bindLifeHistIndexPreviews(root.querySelector("[data-life-hist-list]"));
    };
    root._damLifeHistRepaint();
  }

  function refreshAllLifeHistViews() {
    var settingsRoot = document.getElementById("damSettingsLifeHistRoot");
    if (settingsRoot && settingsRoot._damLifeHistRepaint) settingsRoot._damLifeHistRepaint();
    if (changeHistoryPopoverEl) {
      var popRoot = changeHistoryPopoverEl.querySelector(".dam-life-hist");
      if (popRoot && popRoot._damLifeHistRepaint) popRoot._damLifeHistRepaint();
    }
    if (lifeHistOverlayEl) {
      var ovRoot = lifeHistOverlayEl.querySelector(".dam-life-hist");
      if (ovRoot && ovRoot._damLifeHistRepaint) ovRoot._damLifeHistRepaint();
    }
  }

  function mountSettingsLifeHistPanel(state) {
    var host = document.getElementById("damSettingsChangeHistoryPanel");
    var hint = document.getElementById("damSettingsChangeHistoryHint");
    var openBtn = document.getElementById("damSettingsChangeHistoryBtn");
    var refreshBtn = document.getElementById("damSettingsChangeHistoryRefresh");
    if (!host && !hint) return;

    if (state === "role" || state === "login" || state === "offline") {
        if (hint) {
        hint.textContent =
          state === "role"
            ? "Wymaga roli administratora."
            : state === "login"
              ? "Zaloguj się, aby zobaczyć historię zmian."
              : "Most zmian niedostępny - historia lokalnie niedostępna.";
      }
      if (host) {
        host.innerHTML =
          '<div class="dam-life-hist__empty"><i class="uil uil-history" aria-hidden="true"></i><p>' +
          (state === "role"
            ? "Historia zmian na dysku jest dostępna dla konta admin."
            : state === "login"
              ? "Wymagane logowanie do mostu 8766."
              : "Brak połączenia z mostem 8766.") +
          "</p></div>";
      }
      if (openBtn) openBtn.disabled = true;
      if (refreshBtn) refreshBtn.disabled = state === "role";
      return;
    }

    if (refreshBtn) refreshBtn.disabled = false;
    var last = lastMergedLifeRows.length ? lastMergedLifeRows[0] : null;
    if (hint) {
      hint.textContent = last
        ? (last.title || "zmiana") +
          (last.product_name ? " · " + last.product_name : "") +
          (last.ts ? " · " + formatChangeLogTs(last.ts) : "")
        : "Brak historii zmian";
    }
    if (openBtn) openBtn.disabled = !lastMergedLifeRows.length;
    if (!host) return;

    host.className = "dam-changelog-history dam-changelog-history--panel dam-life-hist-host";
    var root = document.getElementById("damSettingsLifeHistRoot");
    if (!root) {
      host.innerHTML = lifeHistChromeHtml({
        mode: "global",
        title: "Historia zmian na dysku",
        headingTag: "span",
        searchId: "damSettingsLifeHistSearch",
        showClose: false,
        lead:
          "Wszystkie produkty i warianty: F / X / D / bez statusu, hashtagi (#lc_…), kopiuj / drzewo / przywróć (ADMIN ON).",
        footerHtml:
          '<p class="dam-changelog-history__footnote">Źródło: most 8766 /lifecycle-status + /change-log. Nie mylić z „Baza online” (Postgres).</p>',
      });
      root = host.querySelector(".dam-life-hist");
      if (root) {
        root.id = "damSettingsLifeHistRoot";
        bindLifeHistRoot(root, { mode: "global" });
      }
    } else if (root._damLifeHistRepaint) {
      root._damLifeHistRepaint();
    } else {
      bindLifeHistRoot(root, { mode: "global" });
    }
  }

  function applyLifeHistFetchResult(pack) {
    var bar = document.getElementById("damChangeLogBar");
    var hint = document.getElementById("damChangeLogHint");
    var historyBtn = document.getElementById("damChangeHistoryBtn");
    var chg = pack && pack.changeLog;
    var life = pack && pack.lifecycle;

    if (!chg || !chg.ok) {
      var err = String((chg && chg.error) || "");
      var isLogin =
        err === "login_required" ||
        err === "unauthorized" ||
        (pack && (pack.chgStatus === 401 || pack.chgStatus === 403));
      setChangeLogOfflineHint(hint, isLogin ? "login" : "offline");
      lastChangeLogEntries = [];
      lastLifecycleHistory = [];
      lastMergedLifeRows = [];
      if (historyBtn) historyBtn.disabled = true;
      mountSettingsLifeHistPanel(isLogin ? "login" : "offline");
      refreshAllLifeHistViews();
      return;
    }

    lastChangeLogEntries = chg.entries || [];
    lastLifecycleHistory = (life && life.ok && life.history) || [];
    lastMergedLifeRows = mergeLifeHistRows(
      lastChangeLogEntries,
      lastLifecycleHistory,
      "global"
    );
    if (historyBtn) historyBtn.disabled = !lastMergedLifeRows.length;

    var lastChg = lastChangeLogEntries.length
      ? lastChangeLogEntries[lastChangeLogEntries.length - 1]
      : null;
    if (hint) {
      if (lastChg) {
        hint.textContent = formatChangeLogEntry(lastChg);
        hint.removeAttribute("title");
        hint.setAttribute("data-dam-tip", CHANGELOG_HINT_TIP);
      } else if (lastMergedLifeRows.length) {
        var lr = lastMergedLifeRows[0];
        hint.textContent =
          (lr.title || "zmiana") +
          (lr.product_name ? " · " + lr.product_name : "") +
          (lr.ts ? " · " + formatChangeLogTs(lr.ts) : "");
        hint.setAttribute("data-dam-tip", CHANGELOG_HINT_TIP);
          } else {
            hint.textContent = "Brak historii zmian";
        hint.setAttribute(
          "data-dam-tip",
          "Historia zmian na dysku X: jest pusta. Po zatwierdzeniu rename typu/indeksu/plików albo zmianie statusu produktu/wariantu pojawi się tu ostatni wpis."
        );
      }
      hint._damTipBound = false;
    }
    if (bar) rebindChangeLogTips();
    mountSettingsLifeHistPanel("ok");
    refreshAllLifeHistViews();
  }

  function fetchLifeHistBundle() {
    var headers = bridgeAuthHeaders();
    return Promise.all([
      fetch(bridgeBase() + "/change-log?limit=" + LIFE_HIST_GLOBAL_LIMIT, {
        headers: headers,
        credentials: "same-origin",
      }).then(function (r) {
        return r.json().then(function (data) {
          return { status: r.status, data: data };
        });
      }),
      fetch(bridgeBase() + "/lifecycle-status", {
        headers: headers,
        credentials: "same-origin",
      }).then(function (r) {
        return r.json().then(function (data) {
          return { status: r.status, data: data };
        });
      }),
    ])
      .then(function (pair) {
        var chgPack = pair[0];
        var lifePack = pair[1];
        applyLifeHistFetchResult({
          changeLog: chgPack.data,
          lifecycle: lifePack.data,
          chgStatus: chgPack.status,
          lifeStatus: lifePack.status,
        });
      })
      .catch(function () {
        var hint = document.getElementById("damChangeLogHint");
        var historyBtn = document.getElementById("damChangeHistoryBtn");
        setChangeLogOfflineHint(hint, "offline");
        lastChangeLogEntries = [];
        lastLifecycleHistory = [];
        lastMergedLifeRows = [];
        if (historyBtn) historyBtn.disabled = true;
        mountSettingsLifeHistPanel("offline");
      });
  }

  function refreshChangeLogBar() {
    var bar = document.getElementById("damChangeLogBar");
    var settingsPanel = document.getElementById("historiaZmian");
    if (!bar && !settingsPanel) return;

    if (bar) {
      mountChangeLogBarInSearchScope();
      var headerAdminOn = localStorage.getItem(ADMIN_MODE_KEY) === "1";
      if (!isAdmin() || !headerAdminOn) {
        bar.hidden = true;
        closeChangeHistoryPopover();
      } else {
        bar.hidden = false;
      }
    }

    if (!isAdmin()) {
      lastChangeLogEntries = [];
      lastLifecycleHistory = [];
      lastMergedLifeRows = [];
      if (settingsPanel) {
        settingsPanel.setAttribute("hidden", "");
        settingsPanel.setAttribute("aria-hidden", "true");
      }
      mountSettingsLifeHistPanel("role");
      return;
    }

    if (settingsPanel) {
      settingsPanel.removeAttribute("hidden");
      settingsPanel.removeAttribute("aria-hidden");
    }
    fetchLifeHistBundle();
  }

  function closeChangeHistoryPopover() {
    if (!changeHistoryPopoverEl) return;
    changeHistoryPopoverEl.remove();
    changeHistoryPopoverEl = null;
    changeHistoryAnchorBtn = null;
    setChangeLogTipSuppress(false);
    setChangeHistoryExpanded(false);
    document.removeEventListener("mousedown", onChangeHistoryOutsideClick, true);
    document.removeEventListener("keydown", onChangeHistoryEscape, true);
  }

  function onLifeHistOverlayEsc(e) {
    if (e.key === "Escape") closeLifeHistOverlay();
  }

  function onChangeHistoryOutsideClick(e) {
    if (!changeHistoryPopoverEl) return;
    if (changeHistoryPopoverEl.contains(e.target)) return;
    var triggers = changeHistoryTriggerBtns();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].contains(e.target)) return;
    }
    closeChangeHistoryPopover();
  }

  function onChangeHistoryEscape(e) {
    if (e.key === "Escape") closeChangeHistoryPopover();
  }

  /**
   * Global Historia - TEN SAM DOM co produkt:
   * #damLifecycleHistoryModal > .dam-basepath-box.dam-lifecycle-history-modal
   * + --global (70vw × 90vh) + search (indeks / nazwa / tagi).
   */
  function openLifeHistOverlay(mode) {
    closeChangeHistoryPopover();
    closeLifeHistOverlay();
    var existing = document.getElementById("damLifecycleHistoryModal");
    if (existing) existing.remove();
    mode = mode || "global";

    var overlay = document.createElement("div");
    overlay.className = "dam-basepath-overlay";
    overlay.id = "damLifecycleHistoryModal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Historia zmian na dysku");
    overlay.setAttribute("data-life-hist-scope", "global");
    overlay.innerHTML =
      '<div class="dam-basepath-box dam-lifecycle-history-modal dam-lifecycle-history-modal--global">' +
      '<button type="button" class="dam-viz-modal-close" data-life-hist-close aria-label="Zamknij" style="position:absolute;top:12px;right:12px;z-index:2"><i class="uil uil-times"></i></button>' +
      '<div class="dam-life-hist dam-life-hist--global" data-life-hist-mode="global">' +
      '<div class="dam-life-hist__head">' +
      "<h3>Historia zmian na dysku</h3>" +
      '<span class="dam-life-hist__count" id="damLifeHistCount" data-life-hist-count title="Liczba wpisów">0</span>' +
      "</div>" +
      '<p class="dam-lifecycle-history__lead">Wszystkie produkty: F / X / D / bez statusu + zmiany dysku. U góry najnowsze; każdy wpis lifecycle ma hashtag (#lc_…).</p>' +
      '<div class="dam-life-hist__filters" role="group" aria-label="Filtr statusów">' +
      '<span class="dam-life-hist__filter-label">Filtr:</span>' +
      lifeHistFilterChipsHtml() +
      "</div>" +
      '<div class="dam-life-hist__search">' +
      '<label class="visually-hidden" for="damLifeHistSearchGlobal">Szukaj w historii</label>' +
      '<input type="search" class="dam-life-hist__search-input" id="damLifeHistSearchGlobal" placeholder="Szukaj: indeks, nazwa, tagi (#lc_…)" autocomplete="off" />' +
      "</div>" +
      '<div id="damLifeHistList" class="dam-life-hist__scroll" data-life-hist-list></div>' +
      '<div class="dam-lifecycle-history-modal__actions">' +
      '<button type="button" class="geex-btn geex-btn--sm" data-life-hist-close>Zamknij</button>' +
      '<a class="geex-btn geex-btn--sm geex-btn--primary" href="inbox.html" data-dam-tip="Zgłoś problem w Wiadomościach">Zgłoś</a>' +
      "</div></div></div>";
    document.body.appendChild(overlay);
    lifeHistOverlayEl = overlay;
    var root = overlay.querySelector(".dam-life-hist");
    bindLifeHistRoot(root, { mode: "global", onClose: closeLifeHistOverlay });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || (e.target.closest && e.target.closest("[data-life-hist-close]"))) {
        closeLifeHistOverlay();
      }
    });
    document.addEventListener("keydown", onLifeHistOverlayEsc, true);
    setChangeHistoryExpanded(true);
    setChangeLogTipSuppress(true);
  }

  /** Settings + Viz: zawsze duży modal produktówy (global data) - bez chudego popovera. */
  function openChangeHistoryPopover(anchorBtn) {
    var open = document.getElementById("damLifecycleHistoryModal");
    if (open && open.getAttribute("data-life-hist-scope") === "global") {
      closeLifeHistOverlay();
      return;
    }
    openLifeHistOverlay("global");
  }

  function closeLifeHistOverlay() {
    var modal = lifeHistOverlayEl || document.getElementById("damLifecycleHistoryModal");
    if (modal && modal.getAttribute("data-life-hist-scope") === "global") {
      modal.remove();
    } else if (lifeHistOverlayEl) {
      lifeHistOverlayEl.remove();
    }
    lifeHistOverlayEl = null;
    setChangeLogTipSuppress(false);
    setChangeHistoryExpanded(false);
    document.removeEventListener("keydown", onLifeHistOverlayEsc, true);
  }

  function scrollToSettingsChangeHistory() {
    var sec = document.getElementById("historiaZmian");
    if (!sec) return;
    try {
      sessionStorage.setItem("dam_settings_filter", "disk");
    } catch (e) { /* ignore */ }
    var diskChip = document.querySelector('#damSettingsFilter [data-filter="disk"]');
    if (diskChip) diskChip.click();
          setTimeout(function () {
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
      sec.classList.add("is-hash-focus");
      setTimeout(function () {
        sec.classList.remove("is-hash-focus");
      }, 1600);
    }, 80);
  }

  function bindChangeLogBar() {
    var historyBtn = document.getElementById("damChangeHistoryBtn");
    if (historyBtn && !historyBtn._damChgBound) {
      historyBtn._damChgBound = true;
      historyBtn.addEventListener("click", function () {
        openChangeHistoryPopover(historyBtn);
      });
    }
    var settingsBtn = document.getElementById("damSettingsChangeHistoryBtn");
    if (settingsBtn && !settingsBtn._damChgBound) {
      settingsBtn._damChgBound = true;
      settingsBtn.addEventListener("click", function () {
        openChangeHistoryPopover(settingsBtn);
      });
    }
    var refreshBtn = document.getElementById("damSettingsChangeHistoryRefresh");
    if (refreshBtn && !refreshBtn._damChgBound) {
      refreshBtn._damChgBound = true;
      refreshBtn.addEventListener("click", function () {
        refreshChangeLogBar();
      });
    }
    rebindChangeLogTips();
    refreshChangeLogBar();
    if (!global._damTagEditAdminBound) {
      global._damTagEditAdminBound = true;
      global.addEventListener("dam:admin-mode", refreshChangeLogBar);
      global.addEventListener("storage", function (e) {
        if (e && (e.key === ADMIN_MODE_KEY || e.key === "dam_viz_admin_mode")) {
          refreshChangeLogBar();
        }
      });
    }
    if (
      document.getElementById("historiaZmian") &&
      (location.hash === "#historiaZmian" ||
        location.hash === "#damHistoriaZmian" ||
        location.hash === "#damDiskHistory")
    ) {
      scrollToSettingsChangeHistory();
    }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      bindChangeLogBar();
      ensureModalTagEditableDelegation();
    });
  }

  var _modalTagEditLastClick = { t: 0, el: null };

  /** Fallback Shift+dblclick na .dam-tag-editable w modalach (viz + branding preview). */
  function ensureModalTagEditableDelegation() {
    if (typeof document === "undefined" || document.documentElement._damModalTagEditBound) return;
    document.documentElement._damModalTagEditBound = true;
    document.addEventListener(
      "click",
      function (e) {
        var root = e.target.closest("#damVizModal, #damMediaPreview");
        if (!root) return;
        var btn = e.target.closest(".dam-tag-editable[data-tag-kind], .dam-badge-tag[data-tag-kind]");
        if (!btn || !root.contains(btn)) return;
        if (!isPrivileged()) return;
        var now = Date.now();
        var dblClick = _modalTagEditLastClick.el === btn && now - _modalTagEditLastClick.t <= 420;
        if (!(e.shiftKey || e.altKey || dblClick)) {
          _modalTagEditLastClick = { t: now, el: btn };
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        _modalTagEditLastClick = { t: 0, el: null };
        setTimeout(function () {
          var kind = btn.getAttribute("data-tag-kind") || "";
          var tagCtx = {
            kind: kind,
            value: btn.getAttribute("data-tag-value") || "",
            revisionPath: btn.getAttribute("data-revision-path") || "",
            revisionIndex: btn.getAttribute("data-revision-index") || "",
            currentCode: btn.getAttribute("data-current-code") || btn.getAttribute("data-tag-value") || "",
            productId: btn.getAttribute("data-product-id") || "",
            productName: btn.getAttribute("data-product-name") || "",
            brandingAssetId:
              btn.getAttribute("data-branding-asset-id") ||
              (btn.closest("[data-id]") && btn.closest("[data-id]").getAttribute("data-id")) ||
              "",
          };
          if (kind === "carrier") {
            openCarrierPicker(btn, tagCtx);
          } else {
            openTagPicker(btn, tagCtx);
          }
        }, 0);
      },
      true
    );
  }

  var PRODUCT_TAG_GROUP_ORDER = ["smak", "typ", "opakowanie", "autor"];
  var PRODUCT_TAG_GROUP_LABELS = {
    smak: "Smak",
    typ: "Typ",
    opakowanie: "Opakowanie",
    autor: "Autor",
  };

  function productTagCatalogFromGroups(tagGroups) {
    var out = [];
    PRODUCT_TAG_GROUP_ORDER.forEach(function (gk) {
      (tagGroups[gk] || []).forEach(function (tag) {
        if (!tag) return;
        var label =
          global.DamLabels && typeof global.DamLabels.formatTagLabel === "function"
            ? global.DamLabels.formatTagLabel(String(tag), gk === "opakowanie" ? "opakowanie" : gk)
            : String(tag);
        out.push({
          group: gk,
          groupLabel: PRODUCT_TAG_GROUP_LABELS[gk] || gk,
          code: String(tag),
          label: label,
          search: (PRODUCT_TAG_GROUP_LABELS[gk] + " " + label + " " + tag).toLowerCase(),
        });
      });
    });
    return out;
  }

  function selectionFromTagGroups(tagGroups) {
    var sel = {};
    PRODUCT_TAG_GROUP_ORDER.forEach(function (gk) {
      (tagGroups[gk] || []).forEach(function (t) {
        sel[gk + "::" + String(t)] = true;
      });
    });
    return sel;
  }

  function tagGroupsFromSelection(catalog, selectedMap) {
    var out = { smak: [], typ: [], opakowanie: [], autor: [] };
    catalog.forEach(function (opt) {
      var key = opt.group + "::" + opt.code;
      if (!selectedMap[key]) return;
      if (!out[opt.group]) out[opt.group] = [];
      if (out[opt.group].indexOf(opt.code) < 0) out[opt.group].push(opt.code);
    });
    return out;
  }

  function openProductTagsMultiPicker(anchorEl, ctx) {
    ctx = ctx || {};
    if (_tagPickerOpening) {
      if (document.getElementById("damTagEditPopover")) return;
      _tagPickerOpening = false;
    }
    _tagPickerOpening = true;
    setTimeout(function () {
      try {
        openProductTagsMultiPickerNow(anchorEl, ctx);
      } catch (err) {
        console.error("[DamTagEdit] openProductTagsMultiPicker failed", err);
        showToast("Nie udalo sie otworzyc pickera tagow produktu.");
        _tagPickerOpening = false;
      }
    }, 0);
  }

  function openProductTagsMultiPickerNow(anchorEl, ctx) {
    closePopover();
    autoEnableAdminModeIfPrivileged();
    _tagPickerOpening = false;

    /* Shell FIRST — never await search-index before paint (freeze on open). */
    var pop = document.createElement("div");
    pop.id = "damTagEditPopover";
    pop.className = "dam-tag-edit-popover dam-tag-edit-popover--wide";
    pop.innerHTML =
      '<div class="dam-thumb-picker__head dam-tag-edit-popover__head">' +
      "<strong>Tagi produktu</strong>" +
      '<button type="button" class="dam-viz-modal-close" aria-label="Zamknij" data-close>' +
      '<i class="uil uil-times"></i></button></div>' +
      '<div class="dam-tag-edit-popover__search-wrap dam-search-wrap dam-search-wrap--picker">' +
      '<div class="dam-search-input-wrap">' +
      '<i class="uil uil-search" aria-hidden="true"></i>' +
      '<input type="text" id="damTagEditSearch" class="form-control dam-search-input dam-tag-edit-popover__search" placeholder="Szukaj tag…" autocomplete="off" />' +
      "</div></div>" +
      '<div class="dam-tag-edit-popover__list dam-tag-edit-popover__list--checks" data-tag-list>' +
      '<p class="dam-tag-edit-popover__empty">Ladowanie slownika tagow…</p></div>' +
      '<p class="dam-tag-edit-popover__empty" data-empty hidden>Brak tagow dla tego wyszukiwania.</p>' +
      '<div class="dam-thumb-picker__footer dam-tag-edit-popover__actions dam-dialog-actions dam-modal-footer">' +
      '<button type="button" class="dam-tag-edit-popover__cancel" data-cancel><i class="uil uil-times"></i><span>Anuluj</span></button>' +
      '<button type="button" class="dam-tag-edit-popover__confirm dam-modal-footer__primary" data-confirm disabled><i class="uil uil-check"></i><span>Zatwierdz</span></button></div>';

    ensureTagPopoverBtnStyles();
    document.body.appendChild(pop);
    scheduleTagPopoverPosition(pop, anchorEl);
    bindTagPopoverReposition(pop, anchorEl);
    pop.querySelector("[data-close]") &&
      pop.querySelector("[data-close]").addEventListener("click", closePopover);
    pop.querySelector("[data-cancel]") &&
      pop.querySelector("[data-cancel]").addEventListener("click", closePopover);
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onDocKey, true);

    ensureSearchIndexBootstrap()
      .then(function (si) {
        if (!document.getElementById("damTagEditPopover")) return;
        var tagGroups = (si && si.tag_groups) || {};
        var catalog = productTagCatalogFromGroups(tagGroups);
        if (!catalog.length) {
          var listEmpty = pop.querySelector("[data-tag-list]");
          if (listEmpty) {
            listEmpty.innerHTML =
              '<p class="dam-tag-edit-popover__empty">Brak slownika tagow produktu (search-index).</p>';
          }
          showToast("Brak slownika tagow produktu (search-index).");
          return;
        }
        var selected = selectionFromTagGroups(ctx.tagGroups || (ctx.product && ctx.product.tag_groups) || {});

        function rowHtml(opt) {
          var key = opt.group + "::" + opt.code;
          var on = !!selected[key];
          return (
            '<label class="dam-tag-edit-popover__check' +
            (on ? " is-selected" : "") +
            '" data-tag-key="' +
            esc(key) +
            '" data-search-label="' +
            esc(opt.search) +
            '">' +
            '<input type="checkbox"' +
            (on ? " checked" : "") +
            ' data-tag-key="' +
            esc(key) +
            '" />' +
            '<span class="dam-tag-edit-popover__check-group">' +
            esc(opt.groupLabel) +
            "</span>" +
            '<span class="dam-tag-edit-popover__check-label">' +
            esc(opt.label) +
            "</span></label>"
          );
        }

        function paintList(filtered) {
          var listEl = pop.querySelector("[data-tag-list]");
          var emptyMsg = pop.querySelector("[data-empty]");
          if (!listEl) return;
          if (!filtered.length) {
            listEl.innerHTML = "";
            if (emptyMsg) emptyMsg.hidden = false;
            return;
          }
          if (emptyMsg) emptyMsg.hidden = true;
          listEl.innerHTML = filtered.map(rowHtml).join("");
          listEl.querySelectorAll(".dam-tag-edit-popover__check").forEach(function (row) {
            row.addEventListener("click", function (e) {
              if (e.target && e.target.tagName === "INPUT") return;
              var cb = row.querySelector('input[type="checkbox"]');
              if (!cb) return;
              cb.checked = !cb.checked;
              var k = cb.getAttribute("data-tag-key");
              selected[k] = cb.checked;
              row.classList.toggle("is-selected", cb.checked);
            });
            var cb = row.querySelector('input[type="checkbox"]');
            if (cb) {
              cb.addEventListener("change", function () {
                var k = cb.getAttribute("data-tag-key");
                selected[k] = cb.checked;
                row.classList.toggle("is-selected", cb.checked);
              });
            }
          });
        }

        function filterCatalog(q) {
          q = String(q || "")
            .trim()
            .toLowerCase();
          if (!q) return catalog.length > 200 ? catalog.slice(0, 200) : catalog.slice();
          var out = [];
          var cap = 120;
          for (var ci = 0; ci < catalog.length && out.length < cap; ci++) {
            var opt = catalog[ci];
            if (opt.search.indexOf(q) !== -1) out.push(opt);
          }
          return out;
        }

        paintList(filterCatalog(""));
        var confirmBtn = pop.querySelector("[data-confirm]");
        if (confirmBtn) confirmBtn.disabled = false;

        var searchInput = pop.querySelector("#damTagEditSearch");
        if (searchInput) {
          var catSearchTimer = null;
          searchInput.addEventListener("input", function () {
            clearTimeout(catSearchTimer);
            catSearchTimer = setTimeout(function () {
              if (!document.getElementById("damTagEditPopover")) return;
              paintList(filterCatalog(searchInput.value));
            }, 160);
          });
        }

        if (confirmBtn) {
          confirmBtn.addEventListener("click", function () {
            var nextGroups = tagGroupsFromSelection(catalog, selected);
            if (typeof ctx.onTagsApplied === "function") {
              ctx.onTagsApplied(nextGroups);
            }
            if (ctx.product) ctx.product.tag_groups = nextGroups;
            showToast("Zaktualizowano tagi produktu (podgląd). Zapis na dysk: kolejka moderacji.");
            closePopover();
          });
        }
      })
      .catch(function () {
        showToast("Nie udalo sie zaladowac slownika tagow.");
        var listErr = pop.querySelector("[data-tag-list]");
        if (listErr) {
          listErr.innerHTML =
            '<p class="dam-tag-edit-popover__empty">Blad ladowania. ESC zamyka.</p>';
        }
      });
  }

  global.DamTagEdit = {
    openCarrierPicker: openCarrierPicker,
    openTagPicker: openTagPicker,
    closePopover: closePopover,
    openProductTagsMultiPicker: openProductTagsMultiPicker,
    renderModerationPanel: renderModerationPanel,
    isPrivileged: isPrivileged,
    adminModeOn: adminModeOn,
    confirmBrandTagChange: confirmBrandTagChange,
    refreshChangeLogBar: refreshChangeLogBar,
    openChangeHistory: openChangeHistoryPopover,
    openGlobalLifeHist: function () {
      openLifeHistOverlay("global");
    },
    NONE_CODE: NONE_CODE,
  };
})(typeof window !== "undefined" ? window : globalThis);
