/**
 * DAM - Faza 4 (2026-07-18): edycja typu (nosnika) dla WSZYSTKICH rol.
 * Wybor w liscie = podglad (pending). Zatwierdz (zielony check) / Anuluj (czerwony X).
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
    if (pop) pop.remove();
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onDocKey, true);
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
    /* Zmiana marki w tagach brand - osobna sciezka. Tu: ostrzezenie gdy folder GC a user
       ustawia cos typowo DK-only nie dotyczy nosnika. Ostrzezenie brand jest w openBrandConfirm. */
    void typedLabel;
    void label;
    return true;
  }

  /** Potwierdzenie gdy admin zmienia tag marki sprzeczny ze sciezka folderu. */
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
          /* Po zatwierdzeniu znika "?" (carrier_guessed) - odswiez badge w DOM */
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
          if (typeof ctx.onApplied === "function") ctx.onApplied(res);
          else if (global.location) setTimeout(function () { global.location.reload(); }, 600);
        } else {
          showToast(
            "Zgloszenie JSON wyslane do kolejki. Admin zatwierdza w Ustawieniach / Inbox. Bez auto-zapisu."
          );
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
      /* localStorage niedostepny - kontynuuj bez auto-wlaczenia */
    }
  }

  function openCarrierPicker(anchorEl, ctx) {
    openTagPicker(anchorEl, Object.assign({ kind: "carrier" }, ctx || {}));
  }

  function tagPickerHead(kind) {
    var k = String(kind || "carrier");
    if (k === "status") return "Wybierz status";
    if (k === "brand") return "Wybierz marke";
    if (k === "lang") return "Wybierz jezyk";
    if (k === "category") return "Wybierz kategorie";
    if (k === "subcategory") return "Wybierz podkategorie";
    if (k === "index") return "Wybierz / wpisz indeks";
    if (k === "asset_role") return "Wybierz przeznaczenie";
    if (k === "appearance") return "Wybierz tag produktowy";
    if (k === "carrier") return isAdmin() && adminModeOn() ? "Wybierz typ" : "Zaproponuj typ";
    return "Wybierz wartosc tagu";
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

  function ensureFileIndex() {
    if (fileIndexProducts().length) {
      return Promise.resolve(global._DAM_FILE_INDEX);
    }
    if (global.DamSearch && typeof global.DamSearch.reload === "function") {
      return global.DamSearch.reload()
        .then(function () {
          return global._DAM_FILE_INDEX;
        })
        .catch(function () {
          return fetch("data/file-index.json?v=" + Date.now())
            .then(function (r) {
              return r.ok ? r.json() : null;
            })
            .then(function (d) {
              if (d) global._DAM_FILE_INDEX = d;
              return d;
            });
        });
    }
    return fetch("data/file-index.json?v=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (d) {
        if (d) global._DAM_FILE_INDEX = d;
        return d;
      })
      .catch(function () {
        return null;
      });
  }

  function collectSubcategoryOptions(cur) {
    var map = {};
    fileIndexProducts().forEach(function (p) {
      var slug = String(p.subcategory_slug || "").trim();
      if (!slug) return;
      var key = slug.toLowerCase();
      if (map[key]) return;
      var pl = String(p.subcategory_label || slug).trim() || slug;
      map[key] = { code: slug, pl: pl, label: bilingualSubcatLabel(slug, pl) };
    });
    if (cur) {
      var ck = String(cur).toLowerCase();
      if (!map[ck]) {
        map[ck] = { code: cur, pl: cur, label: bilingualSubcatLabel(cur, cur) };
      }
    }
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
    function addIx(raw) {
      var v = String(raw || "").trim();
      if (!v) return;
      var base = v.indexOf(".") > 0 ? v.split(".")[0] : v;
      if (!/^\d{4,}/.test(base)) return;
      map[base] = base;
    }
    fileIndexProducts().forEach(function (p) {
      (p.index_bases || []).forEach(addIx);
      (p.indexes || []).forEach(addIx);
      (p.revisions || []).forEach(function (r) {
        addIx(r && r.index);
      });
    });
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
      return ["pl", "en", "de", "fr", "es", "it", "cs", "sk", "uk", "gb", "lt", "lv", "ee"].map(function (lg) {
        var short =
          global.DamLabels && typeof global.DamLabels.langShort === "function"
            ? global.DamLabels.langShort(lg)
            : lg.toUpperCase();
        return { code: lg, label: short || lg.toUpperCase(), search: lg + " " + short };
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
      showToast("Marka ustawiona na " + newCode + " (wymaga zatwierdzenia w bazie / inbox).");
      if (global.location) setTimeout(function () { global.location.reload(); }, 500);
      return Promise.resolve({ ok: true });
    }
    showToast("Wybrano " + newCode + " dla tagu " + k + ". Zgloszenie trafia do moderacji (Wiadomosci).");
    return Promise.resolve({ ok: true });
  }

  function openTagPicker(anchorEl, ctx) {
    ctx = ctx || {};
    var kind = ctx.kind || (anchorEl && anchorEl.getAttribute("data-tag-kind")) || "carrier";
    if (kind === "carrier") {
      ctx = Object.assign(
        {
          revisionPath: anchorEl.getAttribute("data-revision-path") || "",
          currentCode: anchorEl.getAttribute("data-current-code") || ctx.value || "",
          productId: anchorEl.getAttribute("data-product-id") || "",
          productName: anchorEl.getAttribute("data-product-name") || "",
        },
        ctx
      );
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

    var needsIndex = kind === "subcategory" || kind === "index";
    var ready = needsIndex ? ensureFileIndex() : Promise.resolve(null);
    ready
      .then(function () {
        var options = tagPickerOptions(kind, ctx);
        renderTagPicker(anchorEl, ctx, kind, options);
      })
      .catch(function () {
        var options = tagPickerOptions(kind, ctx);
        renderTagPicker(anchorEl, ctx, kind, options);
      });
  }

  function renderTagPicker(anchorEl, ctx, kind, options) {
    if (!options.length) {
      showToast("Brak listy opcji dla tego tagu.");
      return;
    }

    var rect = anchorEl.getBoundingClientRect();
    var pop = document.createElement("div");
    pop.id = "damTagEditPopover";
    pop.className =
      "dam-tag-edit-popover" +
      (kind === "subcategory" || kind === "index" ? " dam-tag-edit-popover--wide" : "");
    pop.style.top = window.scrollY + rect.bottom + 6 + "px";
    pop.style.left = window.scrollX + rect.left + "px";

    var pendingCode = ctx.currentCode || ctx.value || "";
    if (kind === "index" && pendingCode.indexOf(".") > 0) {
      pendingCode = pendingCode.split(".")[0];
    }
    var headTxt = tagPickerHead(kind);
    var canDirect = isAdmin() && adminModeOn();

    var html =
      '<div class="dam-tag-edit-popover__head">' +
      "<span>" + esc(headTxt) + "</span>" +
      '<button type="button" class="dam-tag-edit-popover__close" aria-label="Zamknij" data-close data-dam-tip="Zamknij bez zapisu">' +
      '<i class="uil uil-times"></i></button></div>' +
      '<div class="dam-tag-edit-popover__search-wrap">' +
      '<i class="uil uil-search" aria-hidden="true"></i>' +
      '<input type="text" id="damTagEditSearch" class="dam-tag-edit-popover__search" placeholder="Szukaj..." autocomplete="off" />' +
      "</div>" +
      '<div class="dam-tag-edit-popover__list">';

    options.forEach(function (opt) {
      var isCur =
        String(opt.code) === String(pendingCode) ||
        String(opt.label) === String(ctx.value) ||
        (kind === "subcategory" &&
          String(opt.code).toLowerCase() === String(ctx.value || "").toLowerCase());
      var isSel = String(opt.code) === String(pendingCode);
      html +=
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
        "</button>";
    });
    html += '<p class="dam-tag-edit-popover__empty" data-empty hidden>Brak opcji dla tego wyszukiwania.</p></div>';
    html +=
      '<div class="dam-tag-edit-popover__actions">' +
      '<button type="button" class="dam-tag-edit-popover__confirm" data-confirm data-dam-tip="' +
      (canDirect ? "Zatwierdz wybor" : "Zglos propozycje") +
      '"><i class="uil uil-check" aria-hidden="true"></i><span>' +
      (canDirect ? "Zatwierdz" : "Zglos") +
      "</span></button>" +
      '<button type="button" class="dam-tag-edit-popover__cancel" data-cancel data-dam-tip="Anuluj bez zapisu">' +
      '<i class="uil uil-times" aria-hidden="true"></i><span>Anuluj</span></button></div>';

    if (kind === "carrier" && isAdmin()) {
      html +=
        '<div class="dam-tag-edit-popover__foot">' +
        '<button type="button" class="dam-tag-edit-popover__addtype" data-add-type data-dam-tip="Dodaj nowy typ do slownika (tylko admin)">' +
        '<i class="uil uil-plus"></i> Dodaj typ</button></div>';
    }

    pop.innerHTML = html;
    document.body.appendChild(pop);

    requestAnimationFrame(function () {
      var pr = pop.getBoundingClientRect();
      var margin = 12;
      var top = window.scrollY + rect.bottom + 6;
      if (pr.bottom > window.innerHeight - margin) {
        top = window.scrollY + rect.top - pr.height - 6;
      }
      if (top < window.scrollY + margin) top = window.scrollY + margin;
      var left = window.scrollX + rect.left;
      if (pr.right > window.innerWidth - margin) {
        left = Math.max(margin, window.scrollX + window.innerWidth - pr.width - margin);
      }
      pop.style.top = top + "px";
      pop.style.left = left + "px";
    });

    function setPending(code) {
      pendingCode = code;
      pop.querySelectorAll("[data-code]").forEach(function (btn) {
        btn.classList.toggle("is-selected", btn.getAttribute("data-code") === String(code));
      });
    }

    pop.querySelectorAll("[data-code]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        setPending(btn.getAttribute("data-code"));
      });
    });

    var searchInput = pop.querySelector("#damTagEditSearch");
    var emptyMsg = pop.querySelector("[data-empty]");
    function applySearch() {
      var q = (searchInput.value || "").trim().toLowerCase();
      var visibleCount = 0;
      pop.querySelectorAll("[data-code]").forEach(function (btn) {
        var label = btn.getAttribute("data-search-label") || "";
        var match = !q || label.indexOf(q) !== -1;
        btn.hidden = !match;
        if (match) visibleCount++;
      });
      if (emptyMsg) emptyMsg.hidden = visibleCount > 0;
    }
    if (searchInput) {
      searchInput.addEventListener("input", applySearch);
      searchInput.addEventListener("keydown", function (e) {
        e.stopPropagation();
      });
      requestAnimationFrame(function () {
        searchInput.focus();
      });
    }

    var confirmBtn = pop.querySelector("[data-confirm]");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        closePopover();
        applyTagPickerChoice(kind, ctx, pendingCode);
      });
    }

    var cancelBtn = pop.querySelector("[data-cancel]");
    if (cancelBtn) cancelBtn.addEventListener("click", closePopover);
    var closeBtn = pop.querySelector("[data-close]");
    if (closeBtn) closeBtn.addEventListener("click", closePopover);

    var addBtn = pop.querySelector("[data-add-type]");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var code = window.prompt("Kod nowego typu (np. SASZETKA-XL):");
        if (!code) return;
        var label = window.prompt("Nazwa PL nowego typu:", code) || code;
        fetch(bridgeUrl() + "/carrier-types", {
          method: "POST",
          headers: bridgeAuthHeaders(),
          body: JSON.stringify({ action: "add", code: code.trim().toUpperCase(), label_pl: label, actor: userLabel() }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function () {
            refreshCarrierTypesCache();
            closePopover();
            showToast("Typ dodany: " + label);
          });
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
    if (c === "f" || c === "aktualne" || c === "current" || c === "active") return "aktualne";
    if (c === "x" || c === "nieaktualne" || c === "outdated" || c === "obsolete") return "nieaktualne";
    if (c === "d" || c === "demo" || c === "prototype" || c === "prototyp") return "demo / prototyp";
    return String(code);
  }

  function formatChangeLogEntry(entry) {
    if (!entry) return "Brak zmian do cofnięcia";
    var ts = String(entry.ts || "").replace("T", " ").slice(0, 16);
    var cat = String(entry.category || entry.action || "");
    var action = String(entry.action || "");
    var detail = "";
    if (action === "rename_index" || cat === "index") {
      detail = "indeks " + (entry.index_from || "?") + " -> " + (entry.index_to || "?");
    } else if (entry.carrier_from || entry.carrier_to) {
      detail =
        "typ " +
        humanCarrierForLog(entry.carrier_from) +
        " -> " +
        humanCarrierForLog(entry.carrier_to);
    } else if (cat === "lifecycle_status" || action.indexOf("lifecycle") === 0) {
      var stFrom = humanDiskStatusLabel(entry.status_from || entry.from);
      var stTo = humanDiskStatusLabel(entry.status_to || entry.to || entry.status);
      if (stFrom && stTo) detail = "status " + stFrom + " -> " + stTo;
      else if (stTo) detail = "status -> " + stTo;
      else detail = "status na dysku";
    } else if (action === "rename_folder" || cat === "rename") {
      detail = "rename folderu / plików";
    } else {
      detail = cat || action || "zmiana na dysku";
    }
    /* Jasny copy: ostatnia zmiana na dysku + Cofnij/Ponów (bez „Status cyklu życia…”) */
    return "Ostatnia zmiana na dysku: " + detail + (ts ? " · " + ts : "");
  }

  function setChangeLogOfflineHint(hint, reason) {
    if (!hint) return;
    var msg =
      reason === "login"
        ? "Zaloguj się, aby zobaczyć historię zmian"
        : "Most zmian niedostępny - Cofnij/Ponów lokalnie";
    var tip =
      reason === "login"
        ? "Most 8766 działa, ale /change-log wymaga sesji. „Baza online” to Postgres - to osobny status."
        : "Nie udało się połączyć z mostem (8766) albo endpoint historii zmian nie odpowiada. Cofnij/Ponów działają tylko przez most na dysku X:; nie mylić z „Baza online”.";
    hint.textContent = msg;
    hint.title = tip;
    hint.setAttribute("data-dam-tip", tip);
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

  function refreshChangeLogBar() {
    var bar = document.getElementById("damChangeLogBar");
    var hint = document.getElementById("damChangeLogHint");
    var undoBtn = document.getElementById("damChangeUndo");
    var redoBtn = document.getElementById("damChangeRedo");
    if (!bar) return;
    mountChangeLogBarInSearchScope();
    /* Widoczny tylko przy roli admin + przełączniku ADMIN ON (jak w headerze). */
    if (!isAdmin() || !adminModeOn()) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    fetch(bridgeBase() + "/change-log?limit=20", {
      headers: bridgeAuthHeaders(),
      credentials: "same-origin",
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { httpOk: r.ok, status: r.status, data: data };
        });
      })
      .then(function (pack) {
        var data = pack && pack.data;
        if (!data || !data.ok) {
          var err = String((data && data.error) || "");
          var isLogin =
            err === "login_required" ||
            err === "unauthorized" ||
            pack.status === 401 ||
            pack.status === 403;
          setChangeLogOfflineHint(hint, isLogin ? "login" : "offline");
          if (undoBtn) undoBtn.disabled = true;
          if (redoBtn) redoBtn.disabled = true;
          return;
        }
        var entries = data.entries || [];
        var last = entries.length ? entries[entries.length - 1] : null;
        if (hint) {
          if (last) {
            hint.textContent = formatChangeLogEntry(last);
            hint.title = hint.textContent;
            hint.setAttribute(
              "data-dam-tip",
              "Ostatnia zatwierdzona zmiana na dysku (typ / indeks / rename). Cofnij i Ponów cofają lub przywracają ten wpis przez most."
            );
          } else {
            hint.textContent = "Brak historii zmian";
            hint.title = "Brak wpisów w change-log - nie ma czego cofać.";
            hint.setAttribute(
              "data-dam-tip",
              "Historia zmian na dysku jest pusta. Po zatwierdzeniu rename typu/indeksu/plików pojawi się tu ostatni wpis."
            );
          }
        }
        if (undoBtn) undoBtn.disabled = !data.can_undo;
        if (redoBtn) redoBtn.disabled = !data.can_redo;
      })
      .catch(function () {
        setChangeLogOfflineHint(hint, "offline");
        if (undoBtn) undoBtn.disabled = true;
        if (redoBtn) redoBtn.disabled = true;
      });
  }

  function bindChangeLogBar() {
    var undoBtn = document.getElementById("damChangeUndo");
    var redoBtn = document.getElementById("damChangeRedo");
    if (!undoBtn && !redoBtn) return;
    function postAction(path, okMsg) {
      return fetch(bridgeBase() + path, {
        method: "POST",
        headers: bridgeAuthHeaders(),
        body: JSON.stringify({ actor: userLabel() }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (res) {
          if (!res.ok) {
            showToast("Blad: " + (res.error || "operacja nieudana"));
            return res;
          }
          showToast(okMsg);
          refreshChangeLogBar();
          setTimeout(function () {
            if (global.location) global.location.reload();
          }, 500);
          return res;
        })
        .catch(function () {
          showToast("Most zmian niedostępny - uruchom DAM / local_bridge (8766).");
        });
    }
    if (undoBtn) {
      undoBtn.addEventListener("click", function () {
        if (!confirm("Cofnąć ostatnią zmianę na dysku (typ, indeks lub pliki)?")) return;
        postAction("/change-log/undo", "Cofnięto ostatnią zmianę.");
      });
    }
    if (redoBtn) {
      redoBtn.addEventListener("click", function () {
        if (!confirm("Ponowić cofniętą zmianę na dysku?")) return;
        postAction("/change-log/redo", "Ponowiono zmianę.");
      });
    }
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
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      bindChangeLogBar();
    });
  }

  global.DamTagEdit = {
    openCarrierPicker: openCarrierPicker,
    openTagPicker: openTagPicker,
    renderModerationPanel: renderModerationPanel,
    isPrivileged: isPrivileged,
    adminModeOn: adminModeOn,
    confirmBrandTagChange: confirmBrandTagChange,
    refreshChangeLogBar: refreshChangeLogBar,
    NONE_CODE: NONE_CODE,
  };
})(typeof window !== "undefined" ? window : globalThis);
