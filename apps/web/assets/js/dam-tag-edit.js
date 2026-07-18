/**
 * DAM ETA - Faza 4 (2026-07-18): edycja typu (nosnika) dla WSZYSTKICH rol.
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

  function adminModeOn() {
    return localStorage.getItem("dam_admin_mode") === "1" || localStorage.getItem("dam_viz_admin_mode") === "1";
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
      out[code] = naming[code].label_pl || code;
    });
    try {
      var custom = JSON.parse(localStorage.getItem("dam_carrier_types_cache") || "null");
      if (custom && custom.custom_types) {
        Object.keys(custom.custom_types).forEach(function (code) {
          out[code] = custom.custom_types[code].label_pl || code;
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
      role: role(),
      admin_mode: adminModeOn(),
      user_email: userLabel(),
      user_name: userLabel(),
    };
    return fetch(bridgeUrl() + "/rename-revision-prefix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        if (!res.ok) {
          showToast("Blad: " + (res.error || "nie udalo sie zapisac"));
          return res;
        }
        if (res.immediate) {
          var shown = newCode === NONE_CODE ? "BRAK TYPU" : newCode;
          showToast("Typ zmieniony na " + shown + " - zapisano na dysku.");
          if (typeof ctx.onApplied === "function") ctx.onApplied(res);
          else if (global.location) setTimeout(function () { global.location.reload(); }, 600);
        } else {
          showToast("Zgloszenie wyslane do moderacji (admin/power_user). Auto-zatwierdzenie po 72h bez decyzji.");
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
  function openCarrierPicker(anchorEl, ctx) {
    closePopover();
    refreshCarrierTypesCache();
    var types = allCarrierTypes();
    var rect = anchorEl.getBoundingClientRect();
    var pop = document.createElement("div");
    pop.id = "damTagEditPopover";
    pop.className = "dam-tag-edit-popover";
    pop.style.top = window.scrollY + rect.bottom + 6 + "px";
    pop.style.left = window.scrollX + rect.left + "px";

    var canDirect = isPrivileged() && adminModeOn();
    var headTxt = canDirect ? "Wybierz typ (zatwierdz ponizej)" : "Zaproponuj typ (zatwierdz ponizej)";
    var pendingCode = ctx.currentCode || "";

    var html =
      '<div class="dam-tag-edit-popover__head">' +
      "<span>" + esc(headTxt) + "</span>" +
      '<button type="button" class="dam-tag-edit-popover__close" aria-label="Zamknij" data-close data-dam-tip="Zamknij bez zapisu">' +
      '<i class="uil uil-times"></i></button></div>' +
      '<div class="dam-tag-edit-popover__list">' +
      '<button type="button" class="dam-tag-edit-popover__opt dam-tag-edit-popover__opt--none' +
      (pendingCode === "" || pendingCode === NONE_CODE ? " is-selected" : "") +
      '" data-code="' +
      NONE_CODE +
      '" data-dam-tip="Usun prefiks typu z nazwy folderu">' +
      "BRAK TYPU</button>";

    Object.keys(types)
      .sort(function (a, b) {
        return types[a].localeCompare(types[b]);
      })
      .forEach(function (code) {
        var isCur = code === ctx.currentCode;
        var isSel = code === pendingCode;
        html +=
          '<button type="button" class="dam-tag-edit-popover__opt' +
          (isCur ? " is-current" : "") +
          (isSel ? " is-selected" : "") +
          '" data-code="' +
          esc(code) +
          '">' +
          esc(types[code]) +
          (isCur ? ' <i class="uil uil-check"></i>' : "") +
          "</button>";
      });
    html += "</div>";

    html +=
      '<div class="dam-tag-edit-popover__actions">' +
      '<button type="button" class="dam-tag-edit-popover__confirm" data-confirm data-dam-tip="Zatwierdz wybor i zapisz">' +
      '<i class="uil uil-check" aria-hidden="true"></i><span>Zatwierdz</span></button>' +
      '<button type="button" class="dam-tag-edit-popover__cancel" data-cancel data-dam-tip="Anuluj bez zapisu">' +
      '<i class="uil uil-times" aria-hidden="true"></i><span>Anuluj</span></button>' +
      "</div>";

    if (isPrivileged()) {
      html +=
        '<div class="dam-tag-edit-popover__foot">' +
        '<button type="button" class="dam-tag-edit-popover__addtype" data-add-type data-dam-tip="Dodaj nowy typ do slownika">' +
        '<i class="uil uil-plus"></i> Dodaj typ</button></div>';
    }
    pop.innerHTML = html;
    document.body.appendChild(pop);

    /* Trzymaj footer (Zatwierdz/Anuluj) w viewportcie */
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
        var c = btn.getAttribute("data-code");
        btn.classList.toggle("is-selected", c === code);
      });
    }

    pop.querySelectorAll("[data-code]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        setPending(btn.getAttribute("data-code"));
      });
    });

    var confirmBtn = pop.querySelector("[data-confirm]");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!pendingCode && pendingCode !== NONE_CODE) {
          showToast("Wybierz typ z listy (albo BRAK TYPU).");
          return;
        }
        var code = pendingCode || NONE_CODE;
        closePopover();
        submitCarrierChange(ctx, code);
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
          headers: { "Content-Type": "application/json" },
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

  /** Panel moderacji (admin/power_user) - lista propozycji + akcje. */
  function fetchProposals() {
    return fetch(bridgeUrl() + "/tag-proposals")
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposal_id: id, decision: decision, new_value: newValue || "", decided_by: userLabel() }),
    }).then(function (r) {
      return r.json();
    });
  }

  function renderModerationPanel(container) {
    if (!container) return;
    if (!isPrivileged()) {
      container.innerHTML = '<p class="dam-widget__meta">Panel moderacji jest widoczny tylko dla admina / power usera.</p>';
      return;
    }
    container.innerHTML = '<p class="dam-widget__meta">Wczytywanie zgloszen...</p>';
    fetchProposals().then(function (data) {
      var pending = (data.proposals || []).filter(function (p) {
        return p.status === "pending";
      });
      if (!pending.length) {
        container.innerHTML = '<p class="dam-widget__meta">Brak oczekujacych zgloszen.</p>';
        return;
      }
      var types = allCarrierTypes();
      var html = '<ul class="dam-moderation-list">';
      pending.forEach(function (p) {
        html +=
          '<li class="dam-moderation-item" data-id="' + esc(p.id) + '">' +
          '<div class="dam-moderation-item__main">' +
          "<strong>" + esc(p.product_name || p.revision_path) + "</strong>" +
          '<div class="dam-widget__meta">' +
          esc(p.current_value || "brak") + " &rarr; " + esc(p.proposed_value === NONE_CODE ? "BRAK TYPU" : p.proposed_value) +
          " &middot; zglosil: " + esc(p.submitted_by) +
          " &middot; wygasa: " + esc(String(p.expires_at || "").replace("T", " ").slice(0, 16)) +
          "</div></div>" +
          '<div class="dam-moderation-item__actions">' +
          '<button type="button" class="dam-moderation-btn dam-moderation-btn--approve" data-action="approve" title="Zatwierdz"><i class="uil uil-check-circle"></i></button>' +
          '<select class="dam-moderation-select" data-action="pick">' +
          '<option value="">Wybierz inny typ...</option>' +
          '<option value="' + NONE_CODE + '">BRAK TYPU</option>' +
          Object.keys(types)
            .sort()
            .map(function (c) {
              return '<option value="' + esc(c) + '">' + esc(types[c]) + "</option>";
            })
            .join("") +
          "</select>" +
          '<button type="button" class="dam-moderation-btn dam-moderation-btn--reject" data-action="reject" title="Odrzuc"><i class="uil uil-times-circle"></i></button>' +
          "</div></li>";
      });
      html += "</ul>";
      container.innerHTML = html;

      container.querySelectorAll(".dam-moderation-item").forEach(function (li) {
        var id = li.getAttribute("data-id");
        var approveBtn = li.querySelector('[data-action="approve"]');
        var rejectBtn = li.querySelector('[data-action="reject"]');
        var pickSelect = li.querySelector('[data-action="pick"]');
        if (approveBtn) {
          approveBtn.addEventListener("click", function () {
            decideProposal(id, "approve").then(function () {
              showToast("Zatwierdzono.");
              renderModerationPanel(container);
            });
          });
        }
        if (rejectBtn) {
          rejectBtn.addEventListener("click", function () {
            decideProposal(id, "reject").then(function () {
              showToast("Odrzucono.");
              renderModerationPanel(container);
            });
          });
        }
        if (pickSelect) {
          pickSelect.addEventListener("change", function () {
            if (!pickSelect.value) return;
            decideProposal(id, "pick_other", pickSelect.value).then(function () {
              showToast("Zastosowano inny typ: " + pickSelect.value);
              renderModerationPanel(container);
            });
          });
        }
      });
    });
  }

  global.DamTagEdit = {
    openCarrierPicker: openCarrierPicker,
    renderModerationPanel: renderModerationPanel,
    isPrivileged: isPrivileged,
    adminModeOn: adminModeOn,
    confirmBrandTagChange: confirmBrandTagChange,
    NONE_CODE: NONE_CODE,
  };
})(typeof window !== "undefined" ? window : globalThis);
