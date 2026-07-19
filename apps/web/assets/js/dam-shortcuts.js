/**
 * DAM - skróty klawiszowe + FAB pomocy (?)
 * F1 / FAB = Pomoc
 * F5 / Ctrl+R = odśwież
 * Esc = zamknij modal
 *
 * Treść pomocy odświeżana przy każdym otwarciu (rola admin / Tryb admina).
 */
(function () {
  "use strict";

  var MODAL_ID = "damHelpModal";
  var FAB_ID = "damHelpFab";

  function isTypingTarget(el) {
    if (!el || !el.tagName) return false;
    var t = el.tagName.toLowerCase();
    if (t === "input" || t === "textarea" || t === "select") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function roleName() {
    try {
      if (window.DamApi && typeof window.DamApi.role === "function") {
        return String(window.DamApi.role() || "user").toLowerCase();
      }
    } catch (e) { /* ignore */ }
    return String(localStorage.getItem("dam_role") || "user").toLowerCase();
  }

  function isAdminRole() {
    return roleName() === "admin";
  }

  function adminModeOn() {
    if (window.DamTagEdit && typeof window.DamTagEdit.adminModeOn === "function") {
      return !!window.DamTagEdit.adminModeOn();
    }
    return (
      localStorage.getItem("dam_admin_mode") === "1" ||
      localStorage.getItem("dam_viz_admin_mode") === "1"
    );
  }

  function showAdminTips() {
    return isAdminRole();
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

  function keyRow(keysHtml, text) {
    return "<li>" + keysHtml + "<span>" + text + "</span></li>";
  }

  function kbd(label) {
    return "<kbd>" + label + "</kbd>";
  }

  function card(icon, title, body) {
    return (
      '<article class="dam-help-card">' +
        '<i class="uil ' + icon + '" aria-hidden="true"></i>' +
        "<div><strong>" + title + "</strong><p>" + body + "</p></div>" +
      "</article>"
    );
  }

  function buildBodyHtml() {
    var admin = showAdminTips();
    var modeOn = adminModeOn();

    var keys =
      keyRow(kbd("F1") + " / " + kbd("?"), "Otwiera to okno pomocy (ikona ? w prawym dolnym rogu)") +
      keyRow(kbd("F5"), "Odświeża aplikację. W oknie DAM restartuje cały shell.") +
      keyRow(kbd("Ctrl") + "+" + kbd("R"), "To samo co F5 - odśwież widok") +
      keyRow(kbd("Esc"), "Zamyka pomoc, lightbox, popupy i panele") +
      keyRow(kbd("Ctrl") + " / " + kbd("Alt") + " + scroll", "Przybliża / oddala obraz w studio wizualizacji") +
      keyRow(kbd("+") + " / " + kbd("-"), "Zoom w podglądzie (lightbox) w Eksploratorze");

    var adminKeys = "";
    if (admin) {
      adminKeys =
        '<section class="dam-help-modal__section dam-help-modal__section--admin">' +
          "<h3>Skróty admina" +
          (modeOn
            ? ' <span class="dam-help-pill dam-help-pill--on">Tryb admina ON</span>'
            : ' <span class="dam-help-pill">włącz „Tryb admina”</span>') +
          "</h3>" +
          '<ul class="dam-help-keys">' +
            keyRow(
              kbd("Shift") + "+klik",
              "Na DOWOLNYM tagu (marka, kategoria, typ, język, status…) - otwiera listę dostępnych opcji. Zatwierdzenie zapisuje / zgłasza zmianę."
            ) +
            keyRow(
              kbd("2× klik"),
              "Podwójny klik (do 500 ms) na tagu działa jak Shift+klik."
            ) +
            keyRow(
              kbd("Pobierz kopie statusu"),
              "Opcjonalny backup JSON z tej sesji. Wspolne statusy F/X/D zapisuje most (dysk + apps/web/data + Postgres), nie ten przycisk."
            ) +
            keyRow(
              kbd("F") + " / " + kbd("X") + " / " + kbd("D"),
              "Przy produkcie lub wariancie (Eksplorer): oznacza status na dysku - dopina literkę do nazwy folderu."
            ) +
          "</ul>" +
          '<p class="dam-help-hint">Bez włączonego „Tryb admina” Shift nie edytuje tagów - tylko filtruje jak zwykły klik. Edycja dotyczy każdego tagu, nie tylko typu nośnika czy statusu.</p>' +
          '<div class="dam-help-cards" style="margin-top:12px">' +
            card(
              "uil-check-circle",
              "F = Aktualny (skończony)",
              "Dopina do nazwy folderu końcówkę <code> - F</code>. Dla całego produktu: też wariantom. Folder zostaje na miejscu."
            ) +
            card(
              "uil-times-circle",
              "X = Nieaktualny (archiwum)",
              "Dopina <code> - X</code>. Produkt: cały folder idzie do <code>— ARCHIWUM</code> kategorii. Sam wariant: do archiwum w strukturze <code>PRODUKT\\WARIANT - X</code> (łatwy powrót)."
            ) +
            card(
              "uil-flask",
              "D = Demo / szkic",
              "Dopina <code> - D</code>. Produkt Demo: warianty też dostają <code> - D</code>. Odznaczenie wariantu z Demo przy produkcie Demo zdejmuje literkę także z produktu."
            ) +
            card(
              "uil-history",
              "Bez statusu + historia",
              "Usuwa literkę z nazwy. Przywraca z archiwum jeśli było X. Program zapisuje poprzednią nazwę i ścieżkę (change-log / lifecycle) - da się cofnąć."
            ) +
          "</div>" +
        "</section>";
    }

    return (
      '<section class="dam-help-modal__section">' +
        "<h3>Skróty klawiszowe</h3>" +
        '<ul class="dam-help-keys">' + keys + "</ul>" +
      "</section>" +
      adminKeys +
      '<section class="dam-help-modal__section">' +
        "<h3>Jak zacząć (pierwszy raz)</h3>" +
        '<ol class="dam-help-steps">' +
          "<li><strong>Eksplorer</strong> - wybierz kategorię (np. BATONY) albo wpisz indeks w wyszukiwarkę (np. 6300, czekolada).</li>" +
          "<li>Kliknij produkt - zobaczysz nośniki (FOLIA, KARTON…). Kliknij wiersz, żeby rozwinąć pliki i checklistę.</li>" +
          "<li>Ikony obok ścieżki: kopiuj / otwórz folder w Windows (wymaga mostu plików online).</li>" +
          "<li>Filtr marek <strong>DK / GC</strong> jest przy nagłówku Kategorie (lewy panel).</li>" +
          "<li>Na produkcie: switch <strong>Pokaż wszystko</strong> odsłania nieaktualne / starsze indeksy.</li>" +
        "</ol>" +
      "</section>" +
      '<section class="dam-help-modal__section">' +
        "<h3>Tagi (działają wszędzie tak samo)</h3>" +
        '<div class="dam-help-cards">' +
          card(
            "uil-filter",
            "Klik na tag",
            "Filtruje listę (smak, typ, język, indeks…). PPM (prawy przycisk) kopiuje tekst tagu."
          ) +
          card(
            "uil-eye",
            "Pokaż wszystko",
            "W produkcie i w Wizualizacjach: OFF = tylko aktualne. ON = też nieaktualne, starsze, dema."
          ) +
          card(
            "uil-tag-alt",
            "Edycja tagów (admin)",
            "Shift+klik lub podwójny klik na KAŻDYM tagu otwiera listę opcji (typ, marka, język, status…). PPM kopiuje tekst tagu."
          ) +
          card(
            "uil-folder",
            "Typ nośnika",
            "Pomarańczowy tag (FOLIA, DOY…). W trybie admina: wybór z listy. Zwykły user może zgłosić propozycję."
          ) +
        "</div>" +
      "</section>" +
      '<section class="dam-help-modal__section">' +
        "<h3>Moduły</h3>" +
        '<div class="dam-help-cards">' +
          card(
            "uil-sitemap",
            "Eksplorer",
            "Kategorie, produkty, nośniki, kompletność plików, studio wizualizacji, dodawanie wariantu."
          ) +
          card(
            "uil-image",
            "Wizualizacje",
            "Galeria. Domyślnie aktualne. Pokaż wszystkie = prototypy, dema, starsze. CTRL+scroll = zoom w modalu."
          ) +
          card(
            "uil-briefcase",
            "Projekty",
            "Karty projektów z tagami i przejściem do Eksplorera / folderu Windows."
          ) +
          card(
            "uil-comment-alt-dots",
            "Wiadomości",
            "Asana, Teams oraz zgłoszenia tagów (moderacja dla admina). Badge = liczba otwartych."
          ) +
          card(
            "uil-bell",
            "Powiadomienia",
            "Alerty DAM: indeks, ścieżka Marketing, most plików, braki w kompletności."
          ) +
          card(
            "uil-setting",
            "Ustawienia",
            "Ścieżka Marketing, język, preferencje bazy. „Wykryj” tylko podpowiada - zapisujesz Zapisz."
          ) +
        "</div>" +
      "</section>" +
      '<section class="dam-help-modal__section dam-help-modal__section--note">' +
        "<h3>Jeśli widzisz Pliki offline</h3>" +
        "<p>Uruchom skrót <strong>DAM</strong> z pulpitu (UI + most). " +
        "W przeglądarce: <code>python apps/desktop/serve_browser.py</code> " +
        "albo osobno <code>python apps/desktop/local_bridge.py</code>.</p>" +
      "</section>" +
      '<p class="dam-help-modal__more">' +
        '<a href="help.html">Pełna pomoc z wyszukiwarką problemów</a>' +
      "</p>"
    );
  }

  function fillModalBody(modal) {
    var body = modal.querySelector(".dam-help-modal__body");
    if (!body) return;
    body.innerHTML = buildBodyHtml();
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
            '<p class="dam-help-modal__eyebrow">DAM</p>' +
            '<h2 id="damHelpModalTitle" class="dam-help-modal__title">Pomoc i skróty klawiszowe</h2>' +
            '<p class="dam-help-modal__lead">Szybki przewodnik - jak korzystać z panelu plików opakowań.</p>' +
          "</div>" +
          '<button type="button" class="dam-help-modal__close" data-dam-help-close="1" aria-label="Zamknij">' +
            '<i class="uil uil-times" aria-hidden="true"></i>' +
          "</button>" +
        "</header>" +
        '<div class="dam-help-modal__body"></div>' +
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

  function ensureFab() {
    if (document.getElementById(FAB_ID)) return;
    if (window.location.pathname.indexOf("signin") !== -1) return;

    var btn = document.createElement("button");
    btn.id = FAB_ID;
    btn.type = "button";
    btn.className = "dam-help-fab";
    btn.setAttribute("aria-label", "Pomoc i skróty (F1)");
    btn.setAttribute("data-dam-tip", "Pomoc i skróty klawiszowe (F1)");
    btn.innerHTML = '<i class="uil uil-question" aria-hidden="true"></i>';
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openHelp();
    });
    document.body.appendChild(btn);
  }

  function openHelp() {
    var modal = ensureModal();
    fillModalBody(modal);
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
    ensureFab();
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
