/**
 * DAM ETA - skroty klawiszowe (jak w typowych aplikacjach desktop).
 * F1  = Pomoc / skroty
 * F5 / Ctrl+R = odswiez (reload strony; w pywebview restart okna jesli dostepne)
 * Esc = zamknij modal pomocy / popupy
 */
(function () {
  "use strict";

  var MODAL_ID = "damHelpModal";

  function isTypingTarget(el) {
    if (!el || !el.tagName) return false;
    var t = el.tagName.toLowerCase();
    if (t === "input" || t === "textarea" || t === "select") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function refreshApp() {
    try {
      if (
        window.pywebview &&
        window.pywebview.api &&
        typeof window.pywebview.api.restart_window === "function"
      ) {
        window.pywebview.api.restart_window();
        return;
      }
    } catch (e) { /* browser / no api */ }
    window.location.reload();
  }

  function ensureModal() {
    var existing = document.getElementById(MODAL_ID);
    if (existing) return existing;

    var wrap = document.createElement("div");
    wrap.id = MODAL_ID;
    wrap.className = "dam-help-modal";
    wrap.setAttribute("hidden", "hidden");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "damHelpModalTitle");
    wrap.innerHTML =
      '<div class="dam-help-modal__backdrop" data-dam-help-close="1"></div>' +
      '<div class="dam-help-modal__panel">' +
        '<header class="dam-help-modal__head">' +
          '<div class="dam-help-modal__head-text">' +
            '<p class="dam-help-modal__eyebrow">DAM ETA</p>' +
            '<h2 id="damHelpModalTitle" class="dam-help-modal__title">Pomoc i skroty klawiszowe</h2>' +
            '<p class="dam-help-modal__lead">Szybki przewodnik po panelu plikow opakowan Dobra Kaloria.</p>' +
          "</div>" +
          '<button type="button" class="dam-help-modal__close" data-dam-help-close="1" aria-label="Zamknij">' +
            '<i class="uil uil-times" aria-hidden="true"></i>' +
          "</button>" +
        "</header>" +
        '<div class="dam-help-modal__body">' +
          '<section class="dam-help-modal__section">' +
            "<h3>Skroty</h3>" +
            '<ul class="dam-help-keys">' +
              '<li><kbd>F1</kbd><span>Otwiera to okno pomocy</span></li>' +
              '<li><kbd>F5</kbd><span>Odswieza aplikacje (jak F5 w przegladarce). W oknie DAM ETA restartuje caly shell.</span></li>' +
              '<li><kbd>Ctrl</kbd>+<kbd>R</kbd><span>To samo co F5 - odswiez widok</span></li>' +
              '<li><kbd>Esc</kbd><span>Zamyka pomoc, popupy i panele</span></li>' +
            "</ul>" +
          "</section>" +
          '<section class="dam-help-modal__section">' +
            "<h3>Co do czego sluzy</h3>" +
            '<div class="dam-help-cards">' +
              '<article class="dam-help-card">' +
                '<i class="uil uil-folder-open" aria-hidden="true"></i>' +
                "<div><strong>Eksplorator</strong>" +
                "<p>Przegladasz kategorie, produkty i nosniki (FOLIA, ETYKIETA…). Tu sprawdzasz kompletnosc plikow i otwierasz foldery na dysku.</p></div>" +
              "</article>" +
              '<article class="dam-help-card">' +
                '<i class="uil uil-image" aria-hidden="true"></i>' +
                "<div><strong>Wizualizacje</strong>" +
                "<p>Galeria aktualnych wizualizacji produktow. Pokazuje tylko najnowsze wersje (np. indeks .01 zamiast starego .00).</p></div>" +
              "</article>" +
              '<article class="dam-help-card">' +
                '<i class="uil uil-comment-alt-dots" aria-hidden="true"></i>' +
                "<div><strong>Wiadomosci</strong>" +
                "<p>Zadania i watki z Asany oraz Teams. Badge przy ikonie pokazuje liczbe otwartych pozycji.</p></div>" +
              "</article>" +
              '<article class="dam-help-card">' +
                '<i class="uil uil-bell" aria-hidden="true"></i>' +
                "<div><strong>Powiadomienia</strong>" +
                "<p>Alerty operacyjne DAM: indeks, sciezka Marketing, status mostu plikow, braki w kompletnosci.</p></div>" +
              "</article>" +
              '<article class="dam-help-card">' +
                '<i class="uil uil-hdd" aria-hidden="true"></i>' +
                "<div><strong>Pliki online / offline</strong>" +
                "<p>Status polaczenia z Twoja sciezka Marketing przez lokalny most (bridge). Offline = nie da sie czytac dysku ani otwierac folderow.</p></div>" +
              "</article>" +
              '<article class="dam-help-card">' +
                '<i class="uil uil-setting" aria-hidden="true"></i>' +
                "<div><strong>Ustawienia</strong>" +
                "<p>Sciezka bazowa Marketing, marki, jezyk. Przycisk Podpowiedz tylko sugeruje - zapisujesz po Sprawdz / Zapisz.</p></div>" +
              "</article>" +
            "</div>" +
          "</section>" +
          '<section class="dam-help-modal__section dam-help-modal__section--note">' +
            "<h3>Jesli widzisz Pliki offline</h3>" +
            "<p>Uruchom skrot <strong>DAM ETA</strong> z pulpitu (startuje UI + most). " +
            "W trybie przegladarki: <code>python apps/desktop/serve_browser.py</code> " +
            "albo osobno <code>python apps/desktop/local_bridge.py</code> przy dzialajacym UI.</p>" +
          "</section>" +
          '<p class="dam-help-modal__more"><a href="help.html">Wiecej w pelnej Pomocy</a></p>' +
        "</div>" +
      "</div>";

    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-dam-help-close") === "1") {
        closeHelp();
      }
    });
    return wrap;
  }

  function openHelp() {
    var modal = ensureModal();
    modal.removeAttribute("hidden");
    document.body.classList.add("dam-help-open");
    var closeBtn = modal.querySelector(".dam-help-modal__close");
    if (closeBtn) closeBtn.focus();
  }

  function closeHelp() {
    var modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.setAttribute("hidden", "hidden");
    document.body.classList.remove("dam-help-open");
  }

  function onKey(e) {
    var key = e.key;
    if (key === "Escape") {
      var modal = document.getElementById(MODAL_ID);
      if (modal && !modal.hasAttribute("hidden")) {
        e.preventDefault();
        closeHelp();
        return;
      }
      return;
    }

    if (isTypingTarget(e.target)) return;

    if (key === "F1") {
      e.preventDefault();
      openHelp();
      return;
    }

    if (key === "F5") {
      e.preventDefault();
      refreshApp();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (key === "r" || key === "R")) {
      e.preventDefault();
      refreshApp();
    }
  }

  function start() {
    if (window.location.pathname.indexOf("signin") !== -1) return;
    document.addEventListener("keydown", onKey, true);
    ensureModal();
  }

  window.DamShortcuts = {
    openHelp: openHelp,
    closeHelp: closeHelp,
    refreshApp: refreshApp
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
