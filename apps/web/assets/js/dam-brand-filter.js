/**
 * DAM ETA - Brand Filter (shared)
 * Wspolny komponent dla explorer.html i visualizations.html.
 * Persist: localStorage.dam_brands { DK: true, GC: true }
 *
 * Zrodlo prawdy: localStorage. Kazda zmiana (dropdown LUB chipy DK/GC)
 * aktualizuje WSZYSTKIE widoki (label "Marka: ..." + chipy is-active).
 * API: window.DamBrandFilter
 */
(function () {
  "use strict";

  var STORAGE_KEY = "dam_brands";
  var listeners = [];
  var dropdownInstances = [];
  var chipInstances = [];
  var syncing = false;

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

  function cloneBrands(b) {
    return { DK: !!b.DK, GC: !!b.GC };
  }

  function notifyListeners(brands) {
    listeners.forEach(function (fn) {
      try { fn(cloneBrands(brands)); } catch (e) { /* ignore */ }
    });
  }

  /** Odswiez label dropdownow + chipy - bez ponownego notify */
  function syncAllUi(brands) {
    pruneChipInstances();
    dropdownInstances.forEach(function (inst) {
      if (!inst.trigger || !document.documentElement.contains(inst.trigger)) return;
      inst.brands.DK = !!brands.DK;
      inst.brands.GC = !!brands.GC;
      inst.trigger.textContent = brandLabel(inst.brands);
      if (inst.panelEl && inst.panelEl.style.display === "block" && typeof inst.renderPanel === "function") {
        inst.renderPanel();
      }
    });
    chipInstances.forEach(function (inst) {
      inst.brands.DK = !!brands.DK;
      inst.brands.GC = !!brands.GC;
      if (typeof inst.paint === "function") inst.paint(true);
    });
  }

  /** Zapisz + sync UI + listeners (jedno miejsce zmiany stanu) */
  function commitBrands(brands, opts) {
    opts = opts || {};
    brands = cloneBrands(brands);
    // Pojedyncze toggle: nie pozwol odznaczyc obu (zostaw klikniety).
    // Jawne "Odznacz wszystko" moze wyczyścic obie (opts.allowEmpty).
    if (!brands.DK && !brands.GC && !opts.allowEmpty) {
      if (opts.preferKey) brands[opts.preferKey] = true;
      else brands.DK = true;
    }
    saveBrands(brands);
    syncing = true;
    try {
      syncAllUi(brands);
    } finally {
      syncing = false;
    }
    if (!opts.silent) notifyListeners(brands);
    return brands;
  }

  function addListenerOnce(fn) {
    if (!fn) return;
    if (listeners.indexOf(fn) === -1) listeners.push(fn);
  }

  /** Usun chipy z DOM-u ktory juz nie istnieje (explorer robi remount) */
  function pruneChipInstances() {
    chipInstances = chipInstances.filter(function (inst) {
      return inst.el && document.documentElement.contains(inst.el);
    });
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
    if (!triggerEl) return null;

    // Idempotent: nie podpinaj drugiego raza tego samego triggera
    for (var i = 0; i < dropdownInstances.length; i++) {
      if (dropdownInstances[i].trigger === triggerEl) {
        addListenerOnce(onChange);
        dropdownInstances[i].brands = loadBrands();
        triggerEl.textContent = brandLabel(dropdownInstances[i].brands);
        return {
          getBrands: function () { return cloneBrands(dropdownInstances[i].brands); },
          setBrands: function (b) { commitBrands(b); }
        };
      }
    }

    var brands = loadBrands();
    triggerEl.textContent = brandLabel(brands);
    triggerEl.setAttribute("aria-haspopup", "true");
    triggerEl.setAttribute("aria-expanded", "false");

    var panelEl = null;
    var inst = {
      trigger: triggerEl,
      brands: brands,
      panelEl: null,
      renderPanel: null
    };

    function getOrCreatePanel() {
      if (panelEl) return panelEl;
      panelEl = document.createElement("div");
      panelEl.className = "dam-filter-dropdown";
      panelEl.setAttribute("role", "dialog");
      panelEl.setAttribute("aria-label", "Filtr marki");
      document.body.appendChild(panelEl);
      inst.panelEl = panelEl;
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
            '<input type="checkbox" class="dam-filter-cb" data-brand="DK" ' + (inst.brands.DK ? "checked" : "") + '> DK (Polska)' +
          '</label>' +
          '<label class="dam-filter-cb-label">' +
            '<input type="checkbox" class="dam-filter-cb" data-brand="GC" ' + (inst.brands.GC ? "checked" : "") + '> GC (Eksport)' +
          '</label>' +
        '</div>' +
        '<div class="dam-filter-dropdown__btns">' +
          '<button type="button" class="dam-filter-btn" data-brandact="clear">Wyczysc</button>' +
          '<button type="button" class="dam-filter-btn" data-brandact="all">Zaznacz wszystko</button>' +
          '<button type="button" class="dam-filter-btn" data-brandact="none">Odznacz wszystko</button>' +
          '<button type="button" class="dam-filter-btn" data-brandact="invert">Odwroc</button>' +
        '</div>';

      panel.querySelectorAll(".dam-filter-cb").forEach(function (cb) {
        cb.addEventListener("change", function () {
          var next = cloneBrands(inst.brands);
          next[this.getAttribute("data-brand")] = this.checked;
          commitBrands(next, { preferKey: this.getAttribute("data-brand") });
        });
      });

      panel.querySelectorAll(".dam-filter-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var act = this.getAttribute("data-brandact");
          var next = cloneBrands(inst.brands);
          if (act === "all") {
            next.DK = true;
            next.GC = true;
            commitBrands(next);
          } else if (act === "clear" || act === "none") {
            next.DK = false;
            next.GC = false;
            commitBrands(next, { allowEmpty: true });
          } else if (act === "invert") {
            next.DK = !next.DK;
            next.GC = !next.GC;
            commitBrands(next, { preferKey: "DK", allowEmpty: true });
          } else {
            commitBrands(next, { preferKey: "DK" });
          }
        });
      });
    }

    inst.renderPanel = renderPanel;

    function openPanel() {
      renderPanel();
      getOrCreatePanel().style.display = "block";
      triggerEl.setAttribute("aria-expanded", "true");
      triggerEl.classList.add("is-active");
    }

    function closePanel() {
      if (panelEl) panelEl.style.display = "none";
      triggerEl.setAttribute("aria-expanded", "false");
      triggerEl.classList.remove("is-active");
    }

    function togglePanel() {
      var panel = getOrCreatePanel();
      if (panel.style.display === "block") closePanel();
      else openPanel();
    }

    triggerEl.addEventListener("click", function (e) {
      e.stopPropagation();
      togglePanel();
    });

    document.addEventListener("click", function (e) {
      if (panelEl && panelEl.style.display === "block") {
        if (!panelEl.contains(e.target) && e.target !== triggerEl) closePanel();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panelEl && panelEl.style.display === "block") closePanel();
    });

    addListenerOnce(onChange);
    dropdownInstances.push(inst);

    return {
      getBrands: function () { return cloneBrands(inst.brands); },
      setBrands: function (b) { commitBrands(b); }
    };
  }

  /** Inline chips DK/GC (product toolbar) - zawsze zsynchronizowane z dropdownem */
  function renderChips(container, onChange) {
    var el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) return null;
    pruneChipInstances();

    var existing = null;
    for (var i = 0; i < chipInstances.length; i++) {
      if (chipInstances[i].el === el) {
        existing = chipInstances[i];
        break;
      }
    }

    if (existing) {
      addListenerOnce(onChange);
      existing.brands = loadBrands();
      existing.paint(true);
      return { getBrands: function () { return cloneBrands(existing.brands); } };
    }

    var brands = loadBrands();
    var inst = { el: el, brands: brands, paint: null };

    function paint(fromSync) {
      if (!fromSync) inst.brands = loadBrands();
      el.innerHTML =
        '<div class="dam-brand-chips" role="group" aria-label="Filtr marki">' +
          '<button type="button" class="dam-brand-chip-btn' + (inst.brands.DK ? " is-active" : "") + '" data-brand="DK" aria-pressed="' + !!inst.brands.DK + '">DK</button>' +
          '<button type="button" class="dam-brand-chip-btn' + (inst.brands.GC ? " is-active" : "") + '" data-brand="GC" aria-pressed="' + !!inst.brands.GC + '">GC</button>' +
        "</div>";
      el.querySelectorAll("[data-brand]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (syncing) return;
          var key = this.getAttribute("data-brand");
          var next = cloneBrands(inst.brands);
          next[key] = !next[key];
          commitBrands(next, { preferKey: key });
        });
      });
    }

    inst.paint = paint;
    addListenerOnce(onChange);
    chipInstances.push(inst);
    paint(true);

    return { getBrands: function () { return cloneBrands(inst.brands); } };
  }

  window.DamBrandFilter = {
    init: init,
    loadBrands: loadBrands,
    saveBrands: saveBrands,
    brandLabel: brandLabel,
    renderChips: renderChips,
    syncFromStorage: loadBrands,
    commitBrands: commitBrands,
    addListener: addListenerOnce
  };
})();
