(function () {
  "use strict";

  var ROLE_LABEL = {
    artwork: "Projekt graficzny",
    viz_3d: "Wizualizacja 3D",
    print_pdf: "Plik do druku",
    tech: "Specyfikacja techniczna",
  };

  function statusMeta(status) {
    if (status === "complete") {
      return { cls: "dam-project-card--ok", badge: "dam-status--ok", label: "Kompletny" };
    }
    if (status === "incomplete") {
      return { cls: "dam-project-card--incomplete", badge: "dam-status--missing", label: "Niekompletny" };
    }
    return { cls: "dam-project-card--warn", badge: "dam-status--warn", label: "Do weryfikacji" };
  }

  function renderCard(p) {
    var meta = statusMeta(p.completeness);
    var missing = p.missing_roles || [];
    var listHtml;
    if (p.completeness === "complete" || missing.length === 0) {
      listHtml = '<ul class="dam-missing-list dam-missing-list--empty"><li>Wszystkie wymagania spelnione</li></ul>';
    } else {
      listHtml =
        '<ul class="dam-missing-list">' +
        missing
          .map(function (r) {
            return "<li>Brak: " + (ROLE_LABEL[r] || r) + "</li>";
          })
          .join("") +
        "</ul>";
    }
    return (
      '<div class="col-12 col-md-6 col-xl-4">' +
      '<article class="dam-project-card ' +
      meta.cls +
      '">' +
      '<div class="dam-project-card__top">' +
      '<span class="dam-status ' +
      meta.badge +
      '">' +
      meta.label +
      "</span>" +
      '<span class="dam-meta">' +
      (p.product_index || "") +
      "</span></div>" +
      '<h3 class="dam-project-card__title">' +
      (p.title || "Projekt") +
      "</h3>" +
      '<p class="dam-project-card__sub">' +
      (p.market ? "Rynek " + p.market : "Wariant DAM") +
      "</p>" +
      listHtml +
      '<a class="geex-btn geex-btn--primary" href="project.html?id=' +
      p.id +
      '">Otworz projekt</a>' +
      "</article></div>"
    );
  }

  async function boot() {
    var grid = document.getElementById("damProjectsGrid");
    var badge = document.getElementById("damUserBadge");
    var ingestBtn = document.getElementById("damIngestBtn");
    var statusEl = document.getElementById("damProjectsStatus");
    if (!window.DamApi || !grid) return;
    if (!DamApi.requireAuth()) return;

    if (badge) {
      badge.textContent = DamApi.role() || "user";
    }

    if (ingestBtn) {
      var role = DamApi.role();
      if (role !== "admin" && role !== "power_user") {
        ingestBtn.classList.add("d-none");
      } else {
        ingestBtn.addEventListener("click", async function () {
          ingestBtn.disabled = true;
          if (statusEl) statusEl.textContent = "Ingest pointerow...";
          try {
            var res = await DamApi.ingestPointers();
            if (statusEl) {
              statusEl.textContent =
                "Ingest: +" +
                res.data.projects +
                " proj, +" +
                res.data.assets +
                " assetow";
            }
            await loadProjects(grid, statusEl);
          } catch (e) {
            if (statusEl) statusEl.textContent = e.message;
          } finally {
            ingestBtn.disabled = false;
          }
        });
      }
    }

    var logout = document.getElementById("damLogoutBtn");
    if (logout) logout.addEventListener("click", function () { DamApi.logout(); });

    await loadProjects(grid, statusEl);
  }

  async function loadProjects(grid, statusEl) {
    try {
      if (statusEl) statusEl.textContent = "Ladowanie z API...";
      var res = await DamApi.projects();
      var rows = (res && res.data) || [];
      if (rows.length === 0) {
        grid.innerHTML =
          '<div class="col-12"><p class="text-muted">Brak projektow. Uruchom ingest pointerow (power user / admin).</p></div>';
      } else {
        grid.innerHTML = rows.map(renderCard).join("");
      }
      if (statusEl) statusEl.textContent = rows.length + " projektow opakowan";
    } catch (e) {
      grid.innerHTML = '<div class="col-12"><p class="text-danger">' + e.message + "</p></div>";
      if (statusEl) statusEl.textContent = "Blad API";
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
