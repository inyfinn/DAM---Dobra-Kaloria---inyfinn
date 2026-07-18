(function () {
  "use strict";

  // Human-readable labels for asset roles - no tech jargon
  var ROLE_LABEL = {
    artwork: "Projekt graficzny",
    viz_3d: "Wizualizacje",
    print_pdf: "Pliki do druku",
    tech: "Specyfikacja techniczna",
    photo: "Fotografia produktowa",
    packaging_text: "Teksty na opakowanie"
  };

  // Human labels for missing roles in status
  var MISSING_LABEL = {
    artwork: "Projekt graficzny",
    viz_3d: "Wizualizacje",
    print_pdf: "Pliki do druku",
    tech: "Specyfikacja techniczna",
    photo: "Fotografia produktowa",
    packaging_text: "Teksty na opakowanie"
  };

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function humanizeRole(role) {
    return ROLE_LABEL[role] || role;
  }

  function humanizeMissing(roles) {
    if (!roles || !roles.length) return "brak";
    return roles.map(function (r) { return MISSING_LABEL[r] || r; }).join(", ");
  }

  var ROLE_ICON = {
    artwork: "uil-palette",
    viz_3d: "uil-cube",
    print_pdf: "uil-file-alt",
    tech: "uil-clipboard-notes",
    photo: "uil-camera",
    packaging_text: "uil-text",
  };

  function rowHtml(role, ok) {
    var label = humanizeRole(role);
    var roleIcon = ROLE_ICON[role] || "uil-file";
    var cls = ok ? "dam-check-ok" : "dam-check-brak";
    var mark = ok ? "uil-check-circle" : "uil-times-circle";
    var badge = ok ? "Gotowe" : "Brakuje";
    return (
      '<div class="dam-slot-row ' + cls + '">' +
      '<i class="uil ' + mark + ' dam-check-icon" aria-hidden="true"></i>' +
      '<span class="dam-check-label">' +
      '<i class="uil ' + roleIcon + ' dam-check-role-icon" aria-hidden="true"></i> ' +
      label +
      "</span>" +
      '<span class="dam-slot-badge' + (ok ? " dam-slot-badge--ok" : " dam-slot-badge--miss") + '">' +
      badge +
      "</span></div>"
    );
  }

  async function boot() {
    if (!window.DamApi || !DamApi.requireAuth()) return;
    var id = qs("id") || "1";
    var titleEl = document.getElementById("damProjectTitle");
    var subEl = document.getElementById("damProjectSub");
    var listEl = document.getElementById("damChecklistRows");
    var statusEl = document.getElementById("damProjectStatus");
    var recomputeBtn = document.getElementById("damRecomputeBtn");
    var notifyBtn = document.getElementById("damNotifyBtn");
    var actionDescEl = document.getElementById("damActionDesc");

    // Show action description
    if (actionDescEl) {
      actionDescEl.textContent = "Przelicz checklistke - zapisuje aktualny status kompletnosci. Powiadomienie trafia do Asany i Teams.";
    }

    try {
      var res = await DamApi.project(id);
      var p = res.data;
      var variant = (p.variants && p.variants[0]) || null;

      if (titleEl) {
        titleEl.textContent = (p.product_index ? p.product_index + " - " : "") + (p.title || "Projekt");
        if (window.DamShell && typeof window.DamShell.setTrailLeaf === "function") {
          window.DamShell.setTrailLeaf(titleEl.textContent);
        }
      }
      if (subEl) {
        var st = variant && variant.checklist_status ? variant.checklist_status.status : "";
        var stHuman = st === "complete" ? "kompletny" : (st === "incomplete" ? "niekompletny" : "do sprawdzenia");
        subEl.textContent = variant
          ? "Wariant #" + (variant.id || "") + " - status: " + stHuman
          : "Brak wariantu dla tego projektu.";
      }

      var present = {};
      if (variant && variant.assets) {
        variant.assets.forEach(function (a) {
          if (a.current_revision_id) present[a.asset_role] = true;
        });
      }

      var required = ["artwork", "viz_3d", "print_pdf", "tech"];
      if (listEl) {
        listEl.innerHTML = required.map(function (r) {
          return rowHtml(r, !!present[r]);
        }).join("");
      }

      var completeness = variant && variant.checklist_status;
      if (statusEl && completeness) {
        var missingHuman = humanizeMissing(completeness.missing_roles);
        var stH = completeness.status === "complete" ? "kompletny" : "niekompletny";
        statusEl.textContent =
          "Status: " + stH +
          (missingHuman !== "brak" ? " | Brakuje: " + missingHuman : " | Wszystkie pliki kompletne");
      }

      var role = DamApi.role();
      var canWrite = role === "admin" || role === "power_user";

      if (recomputeBtn) {
        if (!canWrite || !variant) {
          recomputeBtn.classList.add("d-none");
        } else {
          recomputeBtn.addEventListener("click", async function () {
            recomputeBtn.disabled = true;
            recomputeBtn.textContent = "Obliczam...";
            try {
              var c = await DamApi.recompute(variant.id);
              if (statusEl) {
                var missingH = humanizeMissing(c.missing_roles);
                statusEl.textContent = "Status: " + c.status +
                  (missingH !== "brak" ? " | Brakujace: " + missingH : " | Wszystkie pliki kompletne");
              }
              location.reload();
            } catch (e) {
              if (statusEl) statusEl.textContent = "Blad: " + e.message;
            } finally {
              recomputeBtn.disabled = false;
              recomputeBtn.textContent = "Przelicz checklistke";
            }
          });
        }
      }

      if (notifyBtn) {
        if (!canWrite || !variant) {
          notifyBtn.classList.add("d-none");
        } else {
          notifyBtn.addEventListener("click", async function () {
            notifyBtn.disabled = true;
            notifyBtn.textContent = "Wysylam...";
            try {
              var n = await DamApi.notifyIntegrations(variant.id);
              if (statusEl) statusEl.textContent = "Powiadomienie wyslane: " + (n.message || "OK");
            } catch (e) {
              if (statusEl) statusEl.textContent = "Blad powiadomienia: " + e.message;
            } finally {
              notifyBtn.disabled = false;
              notifyBtn.textContent = "Powiadom (Asana + Teams)";
            }
          });
        }
      }
    } catch (e) {
      if (titleEl) titleEl.textContent = "Blad ladowania projektu";
      if (subEl) subEl.textContent = e.message;
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
