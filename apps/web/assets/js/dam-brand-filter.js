/**
 * DAM ETA - Brand Filter Dropdown (shared component)
 * Wspolny komponent dla explorer.html i visualizations.html.
 * Persist: localStorage.dam_brands { DK: true, GC: true }
 * API: window.DamBrandFilter
 */
(function () {
  "use strict";

  var STORAGE_KEY = "dam_brands";

  function loadBrands() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        return {
          DK: parsed.DK !== false,
          GC: parsed.GC !== false
        };
      }
    } catch (e) { /* ignore */ }
    return { DK: true, GC: true };
  }

  function saveBrands(brands) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(brands));
    } catch (e) { /* ignore */ }
  }

  function brandLabel(brands) {
    var dk = brands.DK, gc = brands.GC;
    if (dk && gc) return "Marka: DK+GC";
    if (dk) return "Marka: DK";
    if (gc) return "Marka: GC";
    return "Marka: brak";
  }

  /**
   * Inicjalizuje dropdown filtra marki w podanym elemencie docelowym.
   * @param {string|Element} target - selektor CSS lub element DOM przycisku
   * @param {Function} onChange - callback(brands) wywoływany po zmianie
   */
  function init(target, onChange) {
    var triggerEl = typeof target === "string"
      ? document.getElementById(target) || document.querySelector(target)
      : target;
    if (!triggerEl) return;

    var brands = loadBrands();

    // Sync initial label
    triggerEl.textContent = brandLabel(brands);
    triggerEl.setAttribute("aria-haspopup", "true");
    triggerEl.setAttribute("aria-expanded", "false");

    var panelEl = null;

    function getOrCreatePanel() {
      if (panelEl) return panelEl;
      panelEl = document.createElement("div");
      panelEl.className = "dam-filter-dropdown";
      panelEl.setAttribute("role", "dialog");
      panelEl.setAttribute("aria-label", "Filtr marki");
      document.body.appendChild(panelEl);
      return panelEl;
    }

    function renderPanel() {
      var panel = getOrCreatePanel();
      var rect = triggerEl.getBoundingClientRect();
      var scrollY = window.scrollY || document.documentElement.scrollTop;
      var scrollX = window.scrollX || document.documentElement.scrollLeft;
      panel.style.top = (rect.bottom + scrollY + 4) + "px";
      panel.style.left = (rect.left + scrollX) + "px";

      panel.innerHTML =
        '<div class="dam-filter-dropdown__header">Filtr marki</div>' +
        '<div class="dam-filter-dropdown__checks">' +
          '<label class="dam-filter-cb-label">' +
            '<input type="checkbox" class="dam-filter-cb" data-brand="DK" ' + (brands.DK ? "checked" : "") + '> DK (Polska)' +
          '</label>' +
          '<label class="dam-filter-cb-label">' +
            '<input type="checkbox" class="dam-filter-cb" data-brand="GC" ' + (brands.GC ? "checked" : "") + '> GC (Eksport)' +
          '</label>' +
        '</div>' +
        '<div class="dam-filter-dropdown__btns">' +
          '<button type="button" class="dam-filter-btn" data-brandact="clear">Wyczysc</button>' +
          '<button type="button" class="dam-filter-btn" data-brandact="all">Zaznacz wszystko</button>' +
          '<button type="button" class="dam-filter-btn" data-brandact="none">Odznacz wszystko</button>' +
          '<button type="button" class="dam-filter-btn" data-brandact="invert">Odwroc</button>' +
        '</div>';

      // Bind checkboxes
      panel.querySelectorAll(".dam-filter-cb").forEach(function (cb) {
        cb.addEventListener("change", function () {
          brands[this.getAttribute("data-brand")] = this.checked;
          saveBrands(brands);
          triggerEl.textContent = brandLabel(brands);
          renderPanel(); // re-render to sync checkboxes
          notifyAll(brands);
        });
      });

      // Bind action buttons
      panel.querySelectorAll(".dam-filter-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var act = this.getAttribute("data-brandact");
          if (act === "all" || act === "clear") {
            brands.DK = act === "all";
            brands.GC = act === "all";
          } else if (act === "none") {
            brands.DK = false;
            brands.GC = false;
          } else if (act === "invert") {
            brands.DK = !brands.DK;
            brands.GC = !brands.GC;
          }
          saveBrands(brands);
          triggerEl.textContent = brandLabel(brands);
          renderPanel();
          notifyAll(brands);
        });
      });
    }

    function openPanel() {
      var panel = getOrCreatePanel();
      renderPanel();
      panel.style.display = "block";
      triggerEl.setAttribute("aria-expanded", "true");
      triggerEl.classList.add("is-active");
    }

    function closePanel() {
      if (panelEl) {
        panelEl.style.display = "none";
      }
      triggerEl.setAttribute("aria-expanded", "false");
      triggerEl.classList.remove("is-active");
    }

    function togglePanel() {
      var panel = getOrCreatePanel();
      if (panel.style.display === "block") {
        closePanel();
      } else {
        openPanel();
      }
    }

    triggerEl.addEventListener("click", function (e) {
      e.stopPropagation();
      togglePanel();
    });

    // Klik poza zamyka
    document.addEventListener("click", function (e) {
      if (panelEl && panelEl.style.display === "block") {
        if (!panelEl.contains(e.target) && e.target !== triggerEl) {
          closePanel();
        }
      }
    });

    // ESC zamyka
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panelEl && panelEl.style.display === "block") {
        closePanel();
      }
    });

    if (onChange) {
      listeners.push(onChange);
    }

    instances.push({ trigger: triggerEl, getBrands: function () { return brands; } });

    return {
      getBrands: function () { return brands; },
      setBrands: function (b) {
        brands.DK = !!b.DK;
        brands.GC = !!b.GC;
        saveBrands(brands);
        triggerEl.textContent = brandLabel(brands);
        if (panelEl) renderPanel();
        notifyAll(brands);
      }
    };
  }

  var listeners = [];
  var instances = [];

  function notifyAll(brands) {
    listeners.forEach(function (fn) {
      try { fn(brands); } catch (e) { /* ignore */ }
    });
  }

  /** Sync brands from localStorage (e.g. when called from another page) */
  function syncFromStorage() {
    return loadBrands();
  }

  /** Inline chips DK/GC (product toolbar slot 1) */
  function renderChips(container, onChange) {
    var el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) return;
    var brands = loadBrands();

    function paint() {
      el.innerHTML =
        '<div class="dam-brand-chips" role="group" aria-label="Filtr marki">' +
          '<button type="button" class="dam-brand-chip-btn' + (brands.DK ? " is-active" : "") + '" data-brand="DK" aria-pressed="' + !!brands.DK + '">DK</button>' +
          '<button type="button" class="dam-brand-chip-btn' + (brands.GC ? " is-active" : "") + '" data-brand="GC" aria-pressed="' + !!brands.GC + '">GC</button>' +
        "</div>";
      el.querySelectorAll("[data-brand]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var key = this.getAttribute("data-brand");
          brands[key] = !brands[key];
          if (!brands.DK && !brands.GC) brands[key] = true;
          saveBrands(brands);
          paint();
          notifyAll(brands);
          if (onChange) onChange(brands);
        });
      });
    }

    if (onChange) listeners.push(onChange);
    paint();
    return { getBrands: function () { return brands; } };
  }

  window.DamBrandFilter = {
    init: init,
    loadBrands: loadBrands,
    saveBrands: saveBrands,
    brandLabel: brandLabel,
    renderChips: renderChips,
    syncFromStorage: syncFromStorage,
    addListener: function (fn) { listeners.push(fn); }
  };
})();
