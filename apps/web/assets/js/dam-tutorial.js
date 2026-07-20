/**
 * DAM - interaktywny samouczek panelu (nakladka + maskotka DobroKaloriuś).
 * Eksport: window.DamTutorial = { start, stop, restart, isActive, showInvite }
 *
 * - Pierwsze wejscie: nieinwazyjny dymek zaproszenia (localStorage damTutorialSeen).
 * - 9 faz = 9 pozycji menu sidebara; kazda faza 2-4 kroki.
 * - Spotlight: element .dam-tut__spot z gigantycznym box-shadow (dziura w scrimie),
 *   pointer-events: none - nic nie blokuje klikania w strone.
 * - Klik poza sterowaniem samouczka = pochwala maskotki + przejscie dalej.
 * - GSAP ladowany jak w dam-grid-reveal.js (loadGsap); prefers-reduced-motion
 *   wylacza animacje.
 * - Kontynuacja miedzy stronami: localStorage damTutorialPhase ("faza:krok").
 * - Z-index warstwy: 14000+ (nad modalami 9999-12400 i loaderem 13000).
 */
(function (global) {
  "use strict";

  var SEEN_KEY = "damTutorialSeen";
  var PHASE_KEY = "damTutorialPhase";
  var SESSION_DISMISS_KEY = "damTutorialNotNow";

  // ---------------------------------------------------------------------------
  // Pozy maskotki: 9 przezroczystych PNG (wyciete ze sprite'a skryptem
  // apps/web/scripts/cut-mascot-sprite.py). Obraz jest warstwa ::after nad
  // bialym medalionem ::before - patrz dam-tutorial.css.
  // ---------------------------------------------------------------------------
  var POSE_FILES = {
    standard: 1,
    explain: 2,
    happy: 3,
    joy: 4,
    present: 5,
    think: 6,
    wave: 7,
    approve: 8,
    zen: 9
  };

  function applyPose(el, name) {
    if (!el) return;
    var n = POSE_FILES[name] || POSE_FILES.standard;
    // Pelny URL: url() w custom property potrafi rozwiazac sie wzgledem pliku
    // CSS (assets/css/), nie dokumentu -> 404. Absolutny adres to ucina.
    var abs;
    try {
      abs = new URL("assets/img/maskotka/pose-" + n + ".png", global.location.href).href;
    } catch (e) {
      abs = "assets/img/maskotka/pose-" + n + ".png";
    }
    el.style.setProperty("--dam-tut-pose", "url('" + abs + "')");
    el.setAttribute("data-dam-pose", name);
  }

  /**
   * Typografia PL: sieroty / wdowy.
   * - NBSP po 1-literowych spojnikach/przyimkach (i, a, o, u, w, z)
   * - sklejenie dwoch ostatnich slow akapitu (anty-wdowa)
   */
  function nbspPl(s) {
    if (s == null || s === "") return s;
    var out = String(s);
    out = out.replace(/(^|[\s\u00A0])([iaouwzIAOUWZ])[ \t]+(?=\S)/g, function (_m, before, letter) {
      return before + letter + "\u00A0";
    });
    // anty-wdowa / anty-bekart: ostatnie dwa slowa razem
    out = out.replace(/(\S+)[ \t]+(\S+)([.!?…]*)$/, function (_m, a, b, punct) {
      return a + "\u00A0" + b + (punct || "");
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Tresc: 9 faz = 9 pozycji menu
  // ---------------------------------------------------------------------------
  function sideLink(href) {
    return ".geex-sidebar__menu__link[href='" + href + "']";
  }

  var PHASES = [
    {
      key: "dashboard",
      label: "Dashboard",
      href: "dashboard.html",
      steps: [
        {
          pose: "wave",
          title: "Cześć, tu DobroKaloriuś!",
          text: "Jestem listkiem Dobrej Kalorii i oprowadzę Cię po panelu DAM. Zaczynamy od Dashboardu, czyli centrum dowodzenia. Klikaj Dalej albo używaj strzałek na klawiaturze.",
          target: [sideLink("dashboard.html")]
        },
        {
          pose: "explain",
          title: "Co tu znajdziesz",
          text: "Dashboard zbiera najświeższe materiały, statystyki i skróty do sekcji, z których korzystasz najczęściej. Rzut oka wystarczy, żeby wiedzieć co się dzieje.",
          target: [".dam-widget--stat", "#damDashGrid", ".geex-content__section-wrapper"]
        },
        {
          pose: "present",
          title: "Od czego zacząć",
          text: "U góry masz wyszukiwarkę i powiadomienia. Wpisz indeks albo nazwę produktu, a panel zaprowadzi Cię prosto na miejsce.",
          target: [".geex-content__header__quickaction", ".geex-content__header", "header"]
        }
      ]
    },
    {
      key: "explorer",
      label: "Eksplorer",
      href: "explorer.html",
      steps: [
        {
          pose: "explain",
          title: "Eksplorer",
          text: "To serce panelu. Wszystkie produkty leżą tu poukładane w kategorie, jak na sklepowej półce. Każdy produkt ma swoje indeksy i nośniki.",
          target: ["#damExplorerMain", sideLink("explorer.html")]
        },
        {
          pose: "present",
          title: "Nośniki i pliki",
          text: "Każdy produkt ma nośniki (folia, karton i inne) z plikami oraz checklistą kompletności. Kliknięcie w wiersz rozwija szczegóły.",
          target: ["#damExplorerMain", ".dam-prod-row", sideLink("explorer.html")]
        },
        {
          pose: "think",
          title: "Od czego zacząć",
          text: "Wybierz kategorię z lewego panelu albo wpisz w wyszukiwarkę indeks, na przykład 6300, lub nazwę smaku. Reszta znajdzie się sama.",
          target: [".dam-explorer-layout__cats", "#damFileSearch", sideLink("explorer.html")],
          go: true
        }
      ]
    },
    {
      key: "visualizations",
      label: "Wizualizacje",
      href: "visualizations.html",
      steps: [
        {
          pose: "explain",
          title: "Wizualizacje",
          text: "Galeria wizualizacji produktów. Domyślnie widzisz tylko aktualne wersje, więc nic starego nie miesza się do pracy.",
          target: [".dam-viz-grid", sideLink("visualizations.html")]
        },
        {
          pose: "present",
          title: "Pokaż wszystko",
          text: "Przełącznik Pokaż wszystko odsłania też prototypy i starsze wersje. W podglądzie obrazka CTRL i scroll przybliżają widok.",
          target: [".dam-viz-toolbar", sideLink("visualizations.html")],
          go: true
        }
      ]
    },
    {
      key: "branding",
      label: "Branding",
      href: "branding.html",
      steps: [
        {
          pose: "explain",
          title: "Branding",
          text: "Materiały brandingowe: logotypy, banery, kampanie, social media. Wszystko z tagami i podglądem.",
          target: ["#damBrandingSectionGrid", ".dam-branding-grid", sideLink("branding.html")]
        },
        {
          pose: "present",
          title: "Tagi i filtry",
          text: "Tagi oraz filtry zawężają listę do tego, czego szukasz. Kliknięcie w kafelek otwiera podgląd ze szczegółami i skojarzonymi produktami.",
          target: [".dam-branding-tabs-row", "#damBrandingTagFilters", sideLink("branding.html")],
          go: true
        }
      ]
    },
    {
      key: "projects",
      label: "Projekty",
      href: "index.html",
      steps: [
        {
          pose: "explain",
          title: "Projekty",
          text: "Karty projektów z tagami i statusami. Z projektu przeskoczysz prosto do Eksplorera albo do folderu na dysku.",
          target: ["#damProjectsGrid", ".geex-content__section-wrapper", sideLink("index.html")]
        },
        {
          pose: "standard",
          title: "Widok całości",
          text: "Zaglądaj tu, gdy chcesz mieć widok całości prac. Jedno spojrzenie i wiesz, co jest w toku.",
          target: [sideLink("index.html")],
          go: true
        }
      ]
    },
    {
      key: "inbox",
      label: "Wiadomości",
      href: "inbox.html",
      steps: [
        {
          pose: "explain",
          title: "Wiadomości",
          text: "Wiadomości zbierają Asanę, Teams i zgłoszenia tagów w jednym miejscu. Koniec ze skakaniem po aplikacjach.",
          target: [".dam-inbox-layout", ".geex-content__section-wrapper", sideLink("inbox.html")]
        },
        {
          pose: "present",
          title: "Ile spraw czeka",
          text: "Badge przy pozycji menu pokazuje liczbę otwartych spraw. Zero oznacza spokój, możesz parzyć herbatę.",
          target: [sideLink("inbox.html")],
          go: true
        }
      ]
    },
    {
      key: "invoices",
      label: "Faktury",
      href: "invoices.html",
      steps: [
        {
          pose: "explain",
          title: "Faktury",
          text: "Sekcja Faktury to dokumenty sprzedażowe i kosztowe w jednym miejscu, z podglądem i statusami.",
          target: [".geex-content__section-wrapper", sideLink("invoices.html")]
        },
        {
          pose: "standard",
          title: "Szybki dostęp",
          text: "Znajdziesz tu listę dokumentów, filtry i eksport. Wszystko pod ręką, gdy przychodzi rozliczenie.",
          target: [sideLink("invoices.html")],
          go: true
        }
      ]
    },
    {
      key: "costs",
      label: "Kalkulator kosztów",
      href: "costs.html",
      steps: [
        {
          pose: "explain",
          title: "Kalkulator kosztów",
          text: "Kalkulator policzy koszty opakowań i materiałów FMCG. Podajesz parametry, wynik dostajesz od ręki.",
          target: [".geex-content__section-wrapper", sideLink("costs.html")]
        },
        {
          pose: "think",
          title: "Kiedy się przydaje",
          text: "Idealny przed wyceną albo gdy porównujesz warianty opakowania. Liczby zamiast zgadywania.",
          target: [sideLink("costs.html")],
          go: true
        }
      ]
    },
    {
      key: "integrations",
      label: "Integracje",
      href: "integrations.html",
      steps: [
        {
          pose: "explain",
          title: "Integracje",
          text: "Integracje łączą panel z Asaną, Teams i innymi narzędziami. Tu sprawdzisz status połączeń i skonfigurujesz nowe.",
          target: [".geex-content__section-wrapper", sideLink("integrations.html")],
          go: true
        },
        {
          pose: "zen",
          title: "To wszystko!",
          text: "Jesteś gotowy do pracy. Gdyby coś umknęło, kliknij znak zapytania w rogu ekranu i uruchom samouczek ponownie. Powodzenia!",
          target: [sideLink("dashboard.html")]
        }
      ]
    }
  ];

  // 40 wariantow pochwal (DobroKaloriuś) - bez powtorzen az do wyczerpania puli
  var PRAISES = [
    { pose: "approve", text: "Ooo, łapiesz to w mig! Lecimy dalej." },
    { pose: "happy", text: "Świetnie Ci idzie! Następny krok." },
    { pose: "joy", text: "No proszę, naturalny talent! Idziemy dalej." },
    { pose: "approve", text: "Widzę, że ogarniasz temat. Super!" },
    { pose: "happy", text: "Pięknie! Jeszcze chwila i będziesz w domu." },
    { pose: "zen", text: "Spokojnie i pewnie. Dokładnie tak." },
    { pose: "joy", text: "Masz to! Panel zaczyna być Twój." },
    { pose: "approve", text: "Brawo za refleks! Jedziemy." },
    { pose: "happy", text: "Jak po maśle. Kolejny przystanek." },
    { pose: "present", text: "Czuję, że to lubisz. Lecimy!" },
    { pose: "approve", text: "Trafione w dziesiątkę. Dalej!" },
    { pose: "joy", text: "Reakcja godna listka! Następny krok." },
    { pose: "happy", text: "Ładnie! Już prawie znasz drogę." },
    { pose: "zen", text: "Bez stresu, z wyczuciem. Super robota." },
    { pose: "approve", text: "Widzę rękę wprawnego użytkownika." },
    { pose: "present", text: "Kliknięte z klasą. Idziemy dalej." },
    { pose: "joy", text: "To było szybkie! Trzymam tempo." },
    { pose: "happy", text: "Dobrze Ci idzie, naprawdę. Dalej!" },
    { pose: "approve", text: "Panel lubi takich jak Ty. Lecimy." },
    { pose: "zen", text: "Czysto i konkretnie. Brawo!" },
    { pose: "joy", text: "Jak świeży kiełek: szybko rośniesz w temacie!" },
    { pose: "happy", text: "Zero zgadywania, pełne ogarnięcie." },
    { pose: "approve", text: "Widzę, że czytasz UI jak książkę." },
    { pose: "present", text: "Świetny wybór! Pokazuję następne." },
    { pose: "joy", text: "Masz wyczucie. To lubię." },
    { pose: "happy", text: "Klik jak z nut. Jedziemy dalej." },
    { pose: "approve", text: "Dokładnie tam, gdzie trzeba. Super!" },
    { pose: "zen", text: "Spokojny strzał, celny efekt." },
    { pose: "joy", text: "Roślinka jest dumna. Lecimy!" },
    { pose: "happy", text: "Coraz pewniej! Następny krok." },
    { pose: "approve", text: "To był dobry ruch. Idziemy." },
    { pose: "present", text: "Łapiesz kontekst w mig. Brawo!" },
    { pose: "joy", text: "Energia dobra, kierunek jeszcze lepszy." },
    { pose: "happy", text: "Już prawie ekspert. Dalej!" },
    { pose: "approve", text: "Widzę progres. Podoba mi się." },
    { pose: "zen", text: "Bez pośpiechu, z efektem. Super." },
    { pose: "joy", text: "Tak trzymaj! Jeszcze kilka kroków." },
    { pose: "happy", text: "Kliknięcie z sensem. Lecimy." },
    { pose: "approve", text: "Panel kiwa z uznaniem. Dalej!" },
    { pose: "present", text: "Dobra robota! Pokazuję kolejny kawałek." }
  ];

  var praiseOrder = null;
  var praiseIdx = 0;

  function shufflePraiseOrder() {
    praiseOrder = [];
    var i;
    for (i = 0; i < PRAISES.length; i++) praiseOrder.push(i);
    for (i = praiseOrder.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = praiseOrder[i];
      praiseOrder[i] = praiseOrder[j];
      praiseOrder[j] = tmp;
    }
    praiseIdx = 0;
  }

  function nextPraise() {
    if (!praiseOrder || praiseIdx >= praiseOrder.length) shufflePraiseOrder();
    var item = PRAISES[praiseOrder[praiseIdx]];
    praiseIdx += 1;
    return item;
  }

  // ---------------------------------------------------------------------------
  // Stan
  // ---------------------------------------------------------------------------
  var state = {
    active: false,
    phase: 0,
    step: 0,
    praiseLock: false,
    bobTween: null,
    els: null,
    raf: 0
  };

  function prefersReducedMotion() {
    try {
      return (
        global.matchMedia &&
        global.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (e) {
      return false;
    }
  }

  // GSAP - ladowanie identyczne jak w dam-grid-reveal.js
  function loadGsap(cb) {
    if (global.gsap) {
      cb(global.gsap);
      return;
    }
    var existing = document.querySelector('script[data-dam-gsap="1"]');
    if (existing) {
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        cb(global.gsap || null);
      };
      existing.addEventListener("load", finish);
      if (global.gsap) finish();
      return;
    }
    var s = document.createElement("script");
    s.src = "./assets/vendor/js/gsap/gsap.min.js";
    s.setAttribute("data-dam-gsap", "1");
    s.onload = function () {
      cb(global.gsap || null);
    };
    s.onerror = function () {
      cb(null);
    };
    document.body.appendChild(s);
  }

  function currentPageKey() {
    var path = global.location.pathname.split("/").pop().replace(".html", "");
    if (path === "" || path === "dashboard" || path === "index-4") return "dashboard";
    if (path === "explorer" || path === "file-manager") return "explorer";
    if (path === "visualizations" || path === "viz") return "visualizations";
    if (path === "branding") return "branding";
    if (path === "index" || path === "projects") return "projects";
    if (path === "inbox") return "inbox";
    if (path === "invoices") return "invoices";
    if (path === "costs") return "costs";
    if (path === "integrations") return "integrations";
    return path;
  }

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }
  function lsDel(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function savePhase() {
    lsSet(PHASE_KEY, state.phase + ":" + state.step);
  }

  // ---------------------------------------------------------------------------
  // Budowa DOM nakladki
  // ---------------------------------------------------------------------------
  function buildOverlay() {
    if (state.els) return state.els;
    var root = document.createElement("div");
    root.id = "damTutorialOverlay";
    root.className = "dam-tut";
    root.innerHTML =
      '<div class="dam-tut__spot" aria-hidden="true"></div>' +
      '<div class="dam-tut__bubble" role="dialog" aria-live="polite" aria-label="Samouczek">' +
        '<div class="dam-tut__mascot" aria-hidden="true"><span class="dam-tut__mascot-img"></span></div>' +
        '<div class="dam-tut__bubble-body">' +
          '<h3 class="dam-tut__title"></h3>' +
          '<p class="dam-tut__text"></p>' +
          '<button type="button" class="dam-tut__go" hidden>Przejdź tam <i class="uil uil-arrow-right" aria-hidden="true"></i></button>' +
          '<div class="dam-tut__mini-nav">' +
            '<button type="button" class="dam-tut__btn dam-tut__btn--mini-prev" title="Wstecz (strzałka w lewo)">' +
              '<i class="uil uil-angle-left" aria-hidden="true"></i> Wstecz</button>' +
            '<button type="button" class="dam-tut__btn dam-tut__btn--primary dam-tut__btn--mini-next" title="Dalej (strzałka w prawo)">' +
              'Dalej <i class="uil uil-angle-right" aria-hidden="true"></i></button>' +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="dam-tut__ctrl" role="group" aria-label="Sterowanie samouczkiem">' +
        '<button type="button" class="dam-tut__btn dam-tut__btn--prev" title="Wstecz (strzałka w lewo)">' +
          '<i class="uil uil-angle-left" aria-hidden="true"></i> Wstecz</button>' +
        '<div class="dam-tut__progress">' +
          '<span class="dam-tut__phase-label"></span>' +
          '<span class="dam-tut__dots" aria-hidden="true"></span>' +
        "</div>" +
        '<button type="button" class="dam-tut__btn dam-tut__btn--next dam-tut__btn--primary" title="Dalej (strzałka w prawo)">' +
          'Dalej <i class="uil uil-angle-right" aria-hidden="true"></i></button>' +
        '<button type="button" class="dam-tut__btn dam-tut__btn--skip" title="Pomiń tę fazę">Pomiń fazę</button>' +
        '<button type="button" class="dam-tut__btn dam-tut__btn--end" title="Zakończ (Esc)">Zakończ samouczek</button>' +
      "</div>";
    document.body.appendChild(root);

    var els = {
      root: root,
      spot: root.querySelector(".dam-tut__spot"),
      bubble: root.querySelector(".dam-tut__bubble"),
      mascot: root.querySelector(".dam-tut__mascot"),
      mascotImg: root.querySelector(".dam-tut__mascot-img"),
      title: root.querySelector(".dam-tut__title"),
      text: root.querySelector(".dam-tut__text"),
      go: root.querySelector(".dam-tut__go"),
      miniPrev: root.querySelector(".dam-tut__btn--mini-prev"),
      miniNext: root.querySelector(".dam-tut__btn--mini-next"),
      ctrl: root.querySelector(".dam-tut__ctrl"),
      phaseLabel: root.querySelector(".dam-tut__phase-label"),
      dots: root.querySelector(".dam-tut__dots"),
      prev: root.querySelector(".dam-tut__btn--prev"),
      next: root.querySelector(".dam-tut__btn--next"),
      skip: root.querySelector(".dam-tut__btn--skip"),
      end: root.querySelector(".dam-tut__btn--end")
    };
    state.els = els;

    els.prev.addEventListener("click", function (e) { e.preventDefault(); prevStep(); });
    els.next.addEventListener("click", function (e) { e.preventDefault(); nextStep(); });
    els.miniPrev.addEventListener("click", function (e) { e.preventDefault(); prevStep(); });
    els.miniNext.addEventListener("click", function (e) { e.preventDefault(); nextStep(); });
    els.skip.addEventListener("click", function (e) { e.preventDefault(); skipPhase(); });
    els.end.addEventListener("click", function (e) { e.preventDefault(); stop(); });
    els.go.addEventListener("click", function (e) {
      e.preventDefault();
      goToPhasePage();
    });
    return els;
  }

  function destroyOverlay() {
    if (state.bobTween) {
      try { state.bobTween.kill(); } catch (e) { /* ignore */ }
      state.bobTween = null;
    }
    if (state.els && state.els.root && state.els.root.parentNode) {
      state.els.root.parentNode.removeChild(state.els.root);
    }
    state.els = null;
  }

  // ---------------------------------------------------------------------------
  // Spotlight + dymek
  // ---------------------------------------------------------------------------
  function resolveTarget(step) {
    var sels = step.target || [];
    for (var i = 0; i < sels.length; i++) {
      try {
        var el = document.querySelector(sels[i]);
        if (el && el.getBoundingClientRect) {
          var r = el.getBoundingClientRect();
          if (r.width > 4 && r.height > 4) return el;
        }
      } catch (e) { /* zly selektor - pomin */ }
    }
    return null;
  }

  function spotRectFor(el) {
    var pad = 8;
    if (!el) {
      // brak celu: dziura o zerowym rozmiarze na srodku = pelny scrim
      return {
        left: global.innerWidth / 2,
        top: global.innerHeight / 2,
        width: 0,
        height: 0
      };
    }
    var r = el.getBoundingClientRect();
    return {
      left: Math.max(2, r.left - pad),
      top: Math.max(2, r.top - pad),
      width: Math.min(global.innerWidth - 4, r.width + pad * 2),
      height: Math.min(global.innerHeight - 4, r.height + pad * 2)
    };
  }

  function setSpotRect(rect, animate) {
    var spot = state.els && state.els.spot;
    if (!spot) return;
    var props = {
      left: rect.left + "px",
      top: rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px"
    };
    if (animate && !prefersReducedMotion() && global.gsap) {
      global.gsap.to(spot, {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        duration: 0.45,
        ease: "power3.out",
        overwrite: true
      });
    } else {
      if (global.gsap) global.gsap.killTweensOf(spot);
      spot.style.left = props.left;
      spot.style.top = props.top;
      spot.style.width = props.width;
      spot.style.height = props.height;
    }
  }

  /**
   * C4 edge-anchor (korekta user):
   * 1) PREFERUJ prawo: lewa krawedz dymka = prawa krawedz targetu + 40px,
   *    gory wyrównane (target TR ≈ bubble TL). Flip wertykalny: BR ≈ BL.
   * 2) Gdy right nie miesci sie → left (analogicznie).
   * 3) Gdy horizontal nie miesci sie → below / above.
   * 4) HARD: dymek NIGDY poza viewport (clamp + padding).
   */
  function placeBubble(rect) {
    var bubble = state.els && state.els.bubble;
    if (!bubble) return;
    var vw = global.innerWidth;
    var vh = global.innerHeight;
    var bw = bubble.offsetWidth || 360;
    var bh = bubble.offsetHeight || 160;
    var EDGE_GAP = 40;
    var margin = 12;
    var ctrlZone = 110; // panel sterujacy na dole
    var maxLeft = vw - bw - margin;
    var maxTop = vh - bh - ctrlZone;

    function fullyFits(left, top) {
      return (
        left >= margin - 0.5 &&
        top >= margin - 0.5 &&
        left + bw <= vw - margin + 0.5 &&
        top + bh <= vh - ctrlZone + 0.5
      );
    }

    function clampPos(left, top) {
      return {
        left: Math.min(Math.max(margin, left), Math.max(margin, maxLeft)),
        top: Math.min(Math.max(margin, top), Math.max(margin, maxTop))
      };
    }

    function overflowAmt(left, top) {
      var ov = 0;
      if (left < margin) ov += margin - left;
      if (top < margin) ov += margin - top;
      if (left + bw > vw - margin) ov += left + bw - (vw - margin);
      if (top + bh > vh - ctrlZone) ov += top + bh - (vh - ctrlZone);
      return ov;
    }

    var left;
    var top;
    var placeId = "center";

    var hasTarget = rect.width > 0 && rect.height > 0;
    if (!hasTarget) {
      var centered = clampPos((vw - bw) / 2, (vh - bh) / 2 - 40);
      left = centered.left;
      top = centered.top;
    } else {
      var tL = rect.left;
      var tT = rect.top;
      var tR = rect.left + rect.width;
      var tB = rect.top + rect.height;

      // Kolejnosc = twarda preferencja usera (NIE score 16-corner)
      var tries = [
        // right: prawa krawedz targetu → lewa dymka +40; TR≈TL / BR≈BL
        { left: tR + EDGE_GAP, top: tT, id: "right-top" },
        { left: tR + EDGE_GAP, top: tB - bh, id: "right-bottom" },
        // left: gdy target po prawej stronie ekranu
        { left: tL - EDGE_GAP - bw, top: tT, id: "left-top" },
        { left: tL - EDGE_GAP - bw, top: tB - bh, id: "left-bottom" },
        // vertical fallback: pod / nad (nie zaslaniaj sidebara gdy right bylby OK)
        { left: tL, top: tB + EDGE_GAP, id: "below" },
        { left: tL, top: tT - EDGE_GAP - bh, id: "above" }
      ];

      var chosen = null;
      var i;
      for (i = 0; i < tries.length; i++) {
        if (fullyFits(tries[i].left, tries[i].top)) {
          chosen = tries[i];
          break;
        }
      }
      if (!chosen) {
        // najmniejszy overflow, lekka preferencja right-*
        var bestOv = Infinity;
        for (i = 0; i < tries.length; i++) {
          var ov = overflowAmt(tries[i].left, tries[i].top);
          if (tries[i].id.indexOf("right") === 0) ov -= 8;
          if (ov < bestOv) {
            bestOv = ov;
            chosen = tries[i];
          }
        }
      }

      var pos = clampPos(chosen.left, chosen.top);
      left = pos.left;
      top = pos.top;
      placeId = chosen.id;
    }

    bubble.style.left = left + "px";
    bubble.style.top = top + "px";
    bubble.setAttribute("data-tut-anchor", placeId);
  }

  function animateBubbleIn() {
    var bubble = state.els && state.els.bubble;
    if (!bubble) return;
    if (prefersReducedMotion() || !global.gsap) {
      bubble.style.opacity = "1";
      bubble.style.transform = "none";
      return;
    }
    global.gsap.killTweensOf(bubble);
    global.gsap.fromTo(
      bubble,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", overwrite: true, clearProps: "transform" }
    );
  }

  function startMascotBob() {
    // Animujemy TYLKO warstwe obrazka (.dam-tut__mascot-img); medalion
    // (::before kontenera) zostaje nieruchomy.
    var img = state.els && state.els.mascotImg;
    if (!img || prefersReducedMotion() || !global.gsap) return;
    if (state.bobTween) {
      try { state.bobTween.kill(); } catch (e) { /* ignore */ }
    }
    state.bobTween = global.gsap.to(img, {
      y: -6,
      duration: 1.4,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1
    });
  }

  // Re-pozycjonowanie przy scrollu / resize (spotlight klei sie do celu)
  function onViewportChange() {
    if (!state.active) return;
    if (state.raf) return;
    state.raf = global.requestAnimationFrame(function () {
      state.raf = 0;
      var step = currentStep();
      if (!step) return;
      var el = resolveTarget(step);
      var rect = spotRectFor(el);
      setSpotRect(rect, false);
      placeBubble(rect);
    });
  }

  // ---------------------------------------------------------------------------
  // Kroki
  // ---------------------------------------------------------------------------
  function currentStep() {
    var phase = PHASES[state.phase];
    if (!phase) return null;
    return phase.steps[state.step] || null;
  }

  function renderStep(animate) {
    var phase = PHASES[state.phase];
    var step = currentStep();
    if (!phase || !step) {
      stop();
      return;
    }
    var els = state.els;
    savePhase();

    els.title.textContent = nbspPl(step.title || phase.label);
    els.text.textContent = nbspPl(step.text || "");
    applyPose(els.mascot, step.pose || "standard");

    // Przycisk "Przejdz tam" tylko gdy faza opisuje INNA strone
    var onOwnPage = currentPageKey() === phase.key;
    if (step.go && !onOwnPage) {
      els.go.hidden = false;
    } else {
      els.go.hidden = true;
    }

    // postep: Faza X/9 + kropki krokow
    els.phaseLabel.textContent = "Faza " + (state.phase + 1) + "/" + PHASES.length + " - " + phase.label;
    var dotsHtml = "";
    for (var i = 0; i < phase.steps.length; i++) {
      dotsHtml += '<i class="dam-tut__dot' + (i === state.step ? " is-on" : "") + '"></i>';
    }
    els.dots.innerHTML = dotsHtml;
    els.prev.disabled = state.phase === 0 && state.step === 0;
    els.miniPrev.disabled = els.prev.disabled;
    var last = state.phase === PHASES.length - 1 && state.step === phase.steps.length - 1;
    els.next.innerHTML = last
      ? 'Zakończ <i class="uil uil-check" aria-hidden="true"></i>'
      : 'Dalej <i class="uil uil-angle-right" aria-hidden="true"></i>';
    els.miniNext.innerHTML = els.next.innerHTML;

    var el = resolveTarget(step);
    // C4: natychmiastowe kotwiczenie (bez "latania" na srodku przed timeoutem)
    var rect0 = spotRectFor(el);
    setSpotRect(rect0, false);
    placeBubble(rect0);

    if (el && typeof el.scrollIntoView === "function") {
      var r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > global.innerHeight - 120) {
        try { el.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" }); } catch (e) { /* ignore */ }
      }
    }
    // doprecyzowanie po ewentualnym scrollu
    global.setTimeout(function () {
      if (!state.active) return;
      var el2 = resolveTarget(step);
      var rect = spotRectFor(el2);
      setSpotRect(rect, animate !== false);
      placeBubble(rect);
      animateBubbleIn();
    }, el ? 120 : 0);
  }

  function nextStep() {
    var phase = PHASES[state.phase];
    if (!phase) { stop(); return; }
    if (state.step < phase.steps.length - 1) {
      state.step += 1;
    } else if (state.phase < PHASES.length - 1) {
      state.phase += 1;
      state.step = 0;
    } else {
      finish();
      return;
    }
    renderStep(true);
  }

  function prevStep() {
    if (state.step > 0) {
      state.step -= 1;
    } else if (state.phase > 0) {
      state.phase -= 1;
      state.step = Math.max(0, PHASES[state.phase].steps.length - 1);
    } else {
      return;
    }
    renderStep(true);
  }

  function skipPhase() {
    if (state.phase < PHASES.length - 1) {
      state.phase += 1;
      state.step = 0;
      renderStep(true);
    } else {
      finish();
    }
  }

  function goToPhasePage() {
    var phase = PHASES[state.phase];
    if (!phase) return;
    // zapisz kontynuacje i przejdz - po zaladowaniu strony samouczek wznowi sie
    savePhase();
    global.location.href = phase.href;
  }

  // ---------------------------------------------------------------------------
  // Pochwala po kliknieciu usera (nic nie blokujemy)
  // ---------------------------------------------------------------------------
  function onDocClick(e) {
    if (!state.active || state.praiseLock) return;
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest(".dam-tut__bubble") || t.closest(".dam-tut__ctrl") || t.closest("#damTutorialInvite")) return;
    // user kliknal cos na stronie - pochwala + przejscie dalej
    state.praiseLock = true;
    var praise = nextPraise();
    var els = state.els;
    if (els) {
      applyPose(els.mascot, praise.pose);
      els.title.textContent = nbspPl("Brawo!");
      els.text.textContent = nbspPl(praise.text);
      els.go.hidden = true;
      animateBubbleIn();
    }
    global.setTimeout(function () {
      state.praiseLock = false;
      if (state.active) nextStep();
    }, 1600);
  }

  function onKeyDown(e) {
    if (!state.active) return;
    var tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      nextStep();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prevStep();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      stop();
    }
  }

  // ---------------------------------------------------------------------------
  // Start / stop / finish
  // ---------------------------------------------------------------------------
  function start(opts) {
    opts = opts || {};
    if (state.active) return;
    removeInvite();
    lsSet(SEEN_KEY, "1");
    state.active = true;
    state.praiseLock = false;
    shufflePraiseOrder();
    state.phase = typeof opts.phase === "number" ? opts.phase : 0;
    state.step = typeof opts.step === "number" ? opts.step : 0;
    if (state.phase < 0 || state.phase >= PHASES.length) state.phase = 0;
    var maxStep = PHASES[state.phase].steps.length - 1;
    if (state.step < 0 || state.step > maxStep) state.step = 0;

    buildOverlay();
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    global.addEventListener("scroll", onViewportChange, true);
    global.addEventListener("resize", onViewportChange);

    loadGsap(function () {
      if (!state.active) return;
      renderStep(false);
      startMascotBob();
      if (!prefersReducedMotion() && global.gsap && state.els) {
        global.gsap.fromTo(state.els.root, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
      }
    });
  }

  function teardown() {
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    global.removeEventListener("scroll", onViewportChange, true);
    global.removeEventListener("resize", onViewportChange);
    if (state.raf) {
      global.cancelAnimationFrame(state.raf);
      state.raf = 0;
    }
    state.active = false;
    destroyOverlay();
  }

  function stop() {
    lsDel(PHASE_KEY);
    teardown();
  }

  function finish() {
    lsDel(PHASE_KEY);
    lsSet(SEEN_KEY, "1");
    teardown();
  }

  /** Restart od fazy 0 / kroku 0 (pomoc, FAB, „Włącz samouczek ponownie”). */
  function restart() {
    if (state.active) stop();
    else {
      lsDel(PHASE_KEY);
      removeInvite();
    }
    try {
      sessionStorage.removeItem(SESSION_DISMISS_KEY);
    } catch (e) { /* ignore */ }
    start({ phase: 0, step: 0 });
  }

  // ---------------------------------------------------------------------------
  // Dymek zaproszenia (pierwsze wejscie)
  // ---------------------------------------------------------------------------
  function removeInvite() {
    var invite = document.getElementById("damTutorialInvite");
    if (invite && invite.parentNode) invite.parentNode.removeChild(invite);
  }

  function showInvite() {
    if (document.getElementById("damTutorialInvite")) return;
    var box = document.createElement("div");
    box.id = "damTutorialInvite";
    box.className = "dam-tut-invite";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Zaproszenie do samouczka");
    box.innerHTML =
      '<div class="dam-tut-invite__mascot" aria-hidden="true"><span class="dam-tut-invite__mascot-img"></span></div>' +
      '<div class="dam-tut-invite__body">' +
        '<p class="dam-tut-invite__text"></p>' +
        '<div class="dam-tut-invite__actions">' +
          '<button type="button" class="dam-tut__btn dam-tut__btn--primary" data-tut-invite="yes">Jasne, pokaż</button>' +
          '<button type="button" class="dam-tut__btn" data-tut-invite="later">Nie teraz</button>' +
          '<button type="button" class="dam-tut__btn dam-tut__btn--quiet" data-tut-invite="never">Nie pytaj więcej</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(box);
    var inviteTextEl = box.querySelector(".dam-tut-invite__text");
    if (inviteTextEl) {
      inviteTextEl.textContent = nbspPl(
        "Cześć, tu DobroKaloriuś! Chcesz krótki samouczek po panelu?"
      );
    }
    applyPose(box.querySelector(".dam-tut-invite__mascot"), "wave");

    box.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-tut-invite]") : null;
      if (!btn) return;
      var action = btn.getAttribute("data-tut-invite");
      if (action === "yes") {
        start();
      } else if (action === "never") {
        lsSet(SEEN_KEY, "1");
        removeInvite();
      } else {
        try { sessionStorage.setItem(SESSION_DISMISS_KEY, "1"); } catch (err) { /* ignore */ }
        removeInvite();
      }
    });

    loadGsap(function (gsap) {
      if (!gsap || prefersReducedMotion()) return;
      gsap.fromTo(box, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" });
      var m = box.querySelector(".dam-tut-invite__mascot-img");
      if (m) {
        gsap.to(m, { y: -5, duration: 1.3, ease: "sine.inOut", yoyo: true, repeat: -1 });
      }
    });
  }

  function closeHelpThenRestart() {
    if (global.DamShortcuts && typeof global.DamShortcuts.closeHelp === "function") {
      global.DamShortcuts.closeHelp();
    }
    restart();
  }

  /**
   * Header pomocy: pod X kontrola „Włącz samouczek ponownie”.
   * Modal tworzy dam-shortcuts.js (head jest trwaly) - dopinamy raz.
   */
  function injectHelpRestartControl(head) {
    if (!head || head.querySelector("[data-dam-tut-restart]")) return;
    var closeBtn = head.querySelector(".dam-help-modal__close");
    if (!closeBtn) return;

    var actions = head.querySelector(".dam-help-modal__head-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "dam-help-modal__head-actions";
      closeBtn.parentNode.insertBefore(actions, closeBtn);
      actions.appendChild(closeBtn);
    }

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dam-help-modal__restart";
    btn.setAttribute("data-dam-tut-restart", "1");
    btn.setAttribute("aria-label", "Włącz samouczek ponownie");
    btn.innerHTML =
      '<i class="uil uil-refresh" aria-hidden="true"></i>' +
      "<span>Włącz samouczek ponownie</span>";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      closeHelpThenRestart();
    });
    actions.appendChild(btn);
  }

  // ---------------------------------------------------------------------------
  // Wpis "Uruchom samouczek" w panelu pomocy (modal tworzy dam-shortcuts.js;
  // panel jest trwaly, przebudowywane jest tylko body - dopinamy stopke raz)
  // ---------------------------------------------------------------------------
  function injectHelpEntry() {
    var tries = 0;
    var timer = global.setInterval(function () {
      tries += 1;
      var panel = document.querySelector("#damHelpModal .dam-help-modal__panel");
      if (panel) {
        global.clearInterval(timer);
        injectHelpRestartControl(panel.querySelector(".dam-help-modal__head"));
        if (panel.querySelector(".dam-tut-help-entry")) return;
        var wrap = document.createElement("div");
        wrap.className = "dam-tut-help-entry";
        wrap.innerHTML =
          '<button type="button" class="dam-tut__btn dam-tut__btn--primary dam-tut-help-entry__btn">' +
            '<i class="uil uil-map-marker-question" aria-hidden="true"></i> Uruchom samouczek</button>';
        panel.appendChild(wrap);
        wrap.querySelector("button").addEventListener("click", function (e) {
          e.preventDefault();
          closeHelpThenRestart();
        });
      } else if (tries > 20) {
        global.clearInterval(timer);
      }
    }, 500);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  function boot() {
    if (global.location.pathname.indexOf("signin") !== -1) return;
    injectHelpEntry();

    // wznowienie po nawigacji ("Przejdz tam" lub klik w link podczas samouczka)
    var saved = lsGet(PHASE_KEY);
    if (saved) {
      var parts = saved.split(":");
      var ph = parseInt(parts[0], 10);
      var st = parseInt(parts[1], 10);
      global.setTimeout(function () {
        if (!state.active) start({ phase: isNaN(ph) ? 0 : ph, step: isNaN(st) ? 0 : st });
      }, 900);
      return;
    }

    // pierwsze wejscie: zaproszenie tylko na dashboardzie, po ~2 s
    if (currentPageKey() !== "dashboard") return;
    if (lsGet(SEEN_KEY)) return;
    try {
      if (sessionStorage.getItem(SESSION_DISMISS_KEY)) return;
    } catch (e) { /* ignore */ }
    global.setTimeout(function () {
      if (!state.active && !lsGet(SEEN_KEY)) showInvite();
    }, 2000);
  }

  global.DamTutorial = {
    start: start,
    stop: stop,
    restart: restart,
    isActive: function () { return state.active; },
    showInvite: showInvite
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
