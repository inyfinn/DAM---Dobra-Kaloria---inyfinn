/**
 * DAM - globalny custom date picker (design system: tagi/pill, bez natywnego
 * "zoltego" popupu przegladarki). Progresywnie wzbogaca KAZDY input[type="date"]
 * w panelu: chowa natywny picker (readOnly), doklada ikone-trigger i wlasny
 * popover z siatka dni w stylu .dam-viz-badge / .dam-int-cta.
 *
 * Kontrakt: oryginalny <input type="date"> zostaje jedynym zrodlem prawdy
 * (ISO yyyy-mm-dd w .value) - po wyborze dnia odpalamy input+change (bubbles),
 * zeby istniejace listenery (np. dam-branding.js bindFilters) dzialaly bez zmian.
 */
(function () {
  "use strict";

  var ENHANCED_FLAG = "damDatePickerBound";
  var MONTHS_PL = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
  ];
  var WEEKDAYS_PL = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

  var popoverEl = null;
  var activeField = null;
  var viewYear = 0;
  var viewMonth = 0;

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function toIso(y, m, d) {
    return y + "-" + pad2(m + 1) + "-" + pad2(d);
  }

  function parseIso(val) {
    if (!val) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function isSameDate(a, b) {
    return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function setFieldValue(input, iso) {
    input.value = iso;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function closePopover() {
    if (popoverEl) popoverEl.classList.remove("is-open");
    activeField = null;
    document.removeEventListener("mousedown", onOutsideClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("scroll", positionPopover, true);
    window.removeEventListener("resize", positionPopover);
  }

  function onOutsideClick(e) {
    if (!popoverEl || !activeField) return;
    if (popoverEl.contains(e.target) || activeField.contains(e.target)) return;
    closePopover();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      var field = activeField;
      closePopover();
      if (field) field.querySelector("input").focus();
    }
  }

  function ensurePopover() {
    if (popoverEl) return popoverEl;
    popoverEl = document.createElement("div");
    popoverEl.className = "dam-date-popover";
    popoverEl.setAttribute("role", "dialog");
    popoverEl.setAttribute("aria-label", "Wybierz date");
    popoverEl.innerHTML =
      '<div class="dam-date-popover__head">' +
      '<button type="button" class="dam-date-popover__nav" data-nav="-1" aria-label="Poprzedni miesiac"><i class="uil uil-angle-left-b" aria-hidden="true"></i></button>' +
      '<span class="dam-date-popover__title" id="damDatePopoverTitle"></span>' +
      '<button type="button" class="dam-date-popover__nav" data-nav="1" aria-label="Nastepny miesiac"><i class="uil uil-angle-right-b" aria-hidden="true"></i></button>' +
      "</div>" +
      '<div class="dam-date-popover__weekdays">' +
      WEEKDAYS_PL.map(function (w) {
        return '<span class="dam-date-popover__weekday">' + w + "</span>";
      }).join("") +
      "</div>" +
      '<div class="dam-date-popover__grid" id="damDatePopoverGrid" role="grid"></div>' +
      '<div class="dam-date-popover__foot">' +
      '<button type="button" class="dam-date-popover__foot-btn" data-action="clear">Wyczyść</button>' +
      '<button type="button" class="dam-date-popover__foot-btn dam-date-popover__foot-btn--primary" data-action="today">Dziś</button>' +
      "</div>";
    document.body.appendChild(popoverEl);

    popoverEl.addEventListener("click", function (e) {
      var navBtn = e.target.closest("[data-nav]");
      if (navBtn) {
        var delta = Number(navBtn.getAttribute("data-nav")) || 0;
        viewMonth += delta;
        if (viewMonth < 0) {
          viewMonth = 11;
          viewYear -= 1;
        } else if (viewMonth > 11) {
          viewMonth = 0;
          viewYear += 1;
        }
        renderGrid();
        return;
      }
      var dayBtn = e.target.closest("[data-day]");
      if (dayBtn && !dayBtn.disabled) {
        var iso = dayBtn.getAttribute("data-iso");
        if (activeField) setFieldValue(activeField.querySelector("input"), iso);
        closePopover();
        return;
      }
      var actionBtn = e.target.closest("[data-action]");
      if (actionBtn && activeField) {
        var input = activeField.querySelector("input");
        var action = actionBtn.getAttribute("data-action");
        if (action === "clear") {
          setFieldValue(input, "");
          closePopover();
        } else if (action === "today") {
          var now = new Date();
          setFieldValue(input, toIso(now.getFullYear(), now.getMonth(), now.getDate()));
          closePopover();
        }
      }
    });
    return popoverEl;
  }

  function renderGrid() {
    if (!popoverEl) return;
    var title = popoverEl.querySelector("#damDatePopoverTitle");
    var grid = popoverEl.querySelector("#damDatePopoverGrid");
    if (!title || !grid) return;
    title.textContent = MONTHS_PL[viewMonth] + " " + viewYear;

    var input = activeField ? activeField.querySelector("input") : null;
    var selected = input ? parseIso(input.value) : null;
    var today = new Date();
    var minDate = input && input.min ? parseIso(input.min) : null;
    var maxDate = input && input.max ? parseIso(input.max) : null;

    var firstOfMonth = new Date(viewYear, viewMonth, 1);
    /* Poniedzialek = 0 (locale PL) */
    var startOffset = (firstOfMonth.getDay() + 6) % 7;
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    var cells = [];
    for (var i = 0; i < startOffset; i++) cells.push(null);
    for (var d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    var html = "";
    for (var c = 0; c < cells.length; c++) {
      var dayNum = cells[c];
      if (dayNum == null) {
        html += '<span class="dam-date-popover__cell dam-date-popover__cell--empty"></span>';
        continue;
      }
      var cellDate = new Date(viewYear, viewMonth, dayNum);
      var iso = toIso(viewYear, viewMonth, dayNum);
      var isSelected = isSameDate(cellDate, selected);
      var isToday = isSameDate(cellDate, today);
      var disabled = (minDate && cellDate < minDate) || (maxDate && cellDate > maxDate);
      var cls = "dam-date-popover__cell dam-date-popover__day";
      if (isSelected) cls += " is-selected";
      if (isToday) cls += " is-today";
      html +=
        '<button type="button" class="' + cls + '" data-day data-iso="' + iso + '"' +
        (disabled ? " disabled" : "") +
        ' aria-selected="' + (isSelected ? "true" : "false") + '">' + dayNum + "</button>";
    }
    grid.innerHTML = html;
  }

  function positionPopover() {
    if (!popoverEl || !activeField) return;
    var rect = activeField.getBoundingClientRect();
    var top = rect.bottom + 6;
    var left = rect.left;
    var popW = popoverEl.offsetWidth || 264;
    if (left + popW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - popW);
    popoverEl.style.top = Math.round(top) + "px";
    popoverEl.style.left = Math.round(left) + "px";
  }

  function openPopover(field) {
    var pop = ensurePopover();
    if (activeField === field && pop.classList.contains("is-open")) {
      closePopover();
      return;
    }
    activeField = field;
    var input = field.querySelector("input");
    var current = parseIso(input.value) || new Date();
    viewYear = current.getFullYear();
    viewMonth = current.getMonth();
    renderGrid();
    pop.classList.add("is-open");
    positionPopover();
    document.addEventListener("mousedown", onOutsideClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", positionPopover, true);
    window.addEventListener("resize", positionPopover);
    var selDay = pop.querySelector(".dam-date-popover__day.is-selected") || pop.querySelector(".dam-date-popover__day:not([disabled])");
    if (selDay) selDay.focus();
  }

  function enhanceField(input) {
    if (!input || input[ENHANCED_FLAG]) return;
    input[ENHANCED_FLAG] = true;
    input.readOnly = true;
    input.classList.add("dam-date-input");

    var field = document.createElement("span");
    field.className = "dam-date-field";
    input.parentNode.insertBefore(field, input);
    field.appendChild(input);

    var icon = document.createElement("button");
    icon.type = "button";
    icon.className = "dam-date-field__icon";
    icon.setAttribute("aria-label", "Otworz kalendarz");
    icon.setAttribute("tabindex", "-1");
    icon.innerHTML = '<i class="uil uil-calendar-alt" aria-hidden="true"></i>';
    field.appendChild(icon);

    var openHandler = function (e) {
      e.preventDefault();
      openPopover(field);
    };
    input.addEventListener("mousedown", openHandler);
    input.addEventListener("focus", function () {
      if (!activeField || activeField !== field) openPopover(field);
    });
    icon.addEventListener("click", openHandler);
  }

  function scan(root) {
    (root || document).querySelectorAll('input[type="date"]').forEach(enhanceField);
  }

  function init() {
    scan(document);
    if (window.MutationObserver) {
      var obs = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            if (node.matches && node.matches('input[type="date"]')) enhanceField(node);
            if (node.querySelectorAll) scan(node);
          });
        });
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.DamDatePicker = { scan: scan, close: closePopover };
})();
