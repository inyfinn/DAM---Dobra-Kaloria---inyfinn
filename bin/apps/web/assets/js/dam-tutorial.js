/**
 * DAM - interaktywny samouczek panelu (nakladka + maskotka DobroKaloriuś).
 * Eksport: window.DamTutorial = { start, stop, restart, isActive, showInvite,
 *   showSad, showCheer, resumeFromCompanion }
 *
 * HARD (program-instructions ui.tutorial_dobrokalorius_hard):
 * - Poprawny cel: ZAWSZE advance natychmiast; potem opcjonalny toast praise (~25%).
 * - Praise NIE blokuje tipu / Dalej; toast ~2.275s (3500 * 0.65); rare burst ~12% praise.
 * - Off-path = exploreMode: companion BR + tryExplore (nie sad spam), UI klikalne.
 * - Media/nosniki: pozy explain-assets/image/video (NIGDY ksiazka pose-5).
 * - Stan: localStorage damTutorialPhase; finished: damTutorialFinished.
 * - Z-index warstwy: 14000+ (nad modalami 9999-12400 i loaderem 13000).
 */
(function (global) {
  "use strict";

  var SEEN_KEY = "damTutorialSeen";
  var PHASE_KEY = "damTutorialPhase";
  var SESSION_DISMISS_KEY = "damTutorialNotNow";
  var FINISHED_KEY = "damTutorialFinished";
  var CHEER_AT_KEY = "damTutorialCheerAt";
  var CHEER_BUDGET_KEY = "damTutorialCheerBudget";
  var PENDING_PRAISE_KEY = "damTutorialPendingPraise";
  /** Toast visible time: 3500ms * 0.65 = 2275ms (−35%). */
  var CONGRATS_MS = 2275;
  /** Probability of showing praise toast on a correct target hit (after advance). */
  var PRAISE_CHANCE = 0.25;
  /** Among praise toasts, chance of micro-burst ("petardy"). Overall ~3% of correct hits. */
  var BURST_CHANCE = 0.12;
  var CHEER_COOLDOWN_MS = 8 * 60 * 1000;
  var CHEER_SESSION_MAX = 4;
  var EXPLORE_COPY_THROTTLE_MS = 12000;
  var COPY_URL = "data/dobrokalorius-copy.json";
  var COPY_CACHE_TOKEN = "tutorialDash188";
  var TARGET_WAIT_MS = 3000;

  // ---------------------------------------------------------------------------
  // Pozy: 1-9 klasyczne + arkusze sad/joy/approve + media teaching (sheet 7/8/9).
  // Wartosc = numer (pose-N.png) albo nazwa pliku (pose-<name>.png).
  // UWAGA: pose-5 (ksiazka "Pyszne roslinne") NIE jest w mapie ani w krokach.
  // ---------------------------------------------------------------------------
  var POSE_FILES = {
    standard: 1,
    explain: 2,
    happy: 3,
    joy: 4,
    think: 6,
    wave: 7,
    approve: 8,
    zen: 9,
    guide: "megaphone",
    megaphone: "megaphone",
    neutral: "neutral",
    sad: "sad-1",
    sad1: "sad-1",
    sad2: "sad-2",
    sad3: "sad-3",
    "sad-1": "sad-1",
    "sad-2": "sad-2",
    "sad-3": "sad-3",
    "sad-report": "sad-report",
    "joy-1": "joy-1",
    "joy-2": "joy-2",
    "joy-3": "joy-3",
    "joy-4": "joy-4",
    "joy-5": "joy-5",
    "joy-6": "joy-6",
    "approve-8": "approve-8",
    "think-q": "think-q",
    "think-dots": "think-dots",
    "explain-assets": "explain-assets",
    "explain-image": "explain-image",
    "explain-video": "explain-video",
    "media-assets": "explain-assets",
    "media-image": "explain-image",
    "media-video": "explain-video"
  };

  var copyCache = null;
  var copyLoading = false;

  function poseFileToken(name) {
    var mapped = POSE_FILES[name];
    if (mapped == null) mapped = POSE_FILES.standard;
    return mapped;
  }

  function applyPose(el, name) {
    if (!el) return;
    var token = poseFileToken(name);
    var file = "pose-" + token + ".png";
    var abs;
    try {
      abs = new URL("assets/img/maskotka/" + file, global.location.href).href;
    } catch (e) {
      abs = "assets/img/maskotka/" + file;
    }
    var img = el.querySelector
      ? el.querySelector(".dam-tut__mascot-img, .dam-tut-companion__mascot-img, .dam-tut-invite__mascot-img")
      : null;
    if (img && !prefersReducedMotion()) {
      img.classList.remove("is-pose-swap");
      void img.offsetWidth;
      img.classList.add("is-pose-swap");
    }
    el.style.setProperty("--dam-tut-pose", "url('" + abs + "')");
    el.setAttribute("data-dam-pose", name || "standard");
    if (img && img.tagName === "IMG") {
      img.setAttribute("alt", "DobroKaloriuś");
      img.src = abs;
    }
  }

  function tutT(key, fallback) {
    if (global.DamI18n && typeof DamI18n.t === "function") {
      var v = DamI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function stepCopy(step, field) {
    var key = step[field + "Key"];
    var fb = step[field] || "";
    if (!key) return fb;
    return tutT(key, fb);
  }

  // ---------------------------------------------------------------------------
  // Imie z sesji (email local-part) + odmiana PL
  // ---------------------------------------------------------------------------
  var VOCATIVE_MAP = {
    szymon: "Szymonie",
    ewa: "Ewo",
    anna: "Anno",
    maria: "Mario",
    magda: "Magdo",
    magdalena: "Magdaleno",
    katarzyna: "Katarzyno",
    kasia: "Kasiu",
    krzysztof: "Krzysztofie",
    piotr: "Piotrze",
    michal: "Michale",
    "michał": "Michale",
    tomasz: "Tomaszu",
    pawel: "Pawle",
    "paweł": "Pawle",
    adam: "Adamie",
    jakub: "Jakubie",
    bartosz: "Bartoszu",
    marcin: "Marcinie",
    agata: "Agato",
    joanna: "Joanno",
    monika: "Moniko",
    natalia: "Natalio"
  };

  var DIM_MAP = {
    szymon: "Szymuś",
    ewa: "Ewka",
    anna: "Ania",
    maria: "Marysia",
    krzysztof: "Krzyś",
    piotr: "Piotrek",
    michal: "Michałek",
    "michał": "Michałek",
    katarzyna: "Kasia",
    magdalena: "Magda",
    tomasz: "Tomek",
    pawel: "Pawełek",
    "paweł": "Pawełek",
    adam: "Adaś",
    jakub: "Kuba",
    bartosz: "Bartek",
    marcin: "Marcin"
  };

  // Tylko jawna mapa - NIGDY heurystyka "a = kobieta" (unknown = neutral).
  var FEMALE_NAMES = {
    ewa: 1,
    anna: 1,
    maria: 1,
    magda: 1,
    magdalena: 1,
    katarzyna: 1,
    kasia: 1,
    agata: 1,
    joanna: 1,
    monika: 1,
    natalia: 1,
    aleksandra: 1,
    ola: 1,
    paulina: 1,
    karolina: 1,
    justyna: 1,
    marta: 1,
    aleksandra: 1
  };
  var MALE_NAMES = {
    szymon: 1,
    krzysztof: 1,
    krzyś: 1,
    piotr: 1,
    michal: 1,
    "michał": 1,
    tomasz: 1,
    pawel: 1,
    "paweł": 1,
    adam: 1,
    jakub: 1,
    bartosz: 1,
    marcin: 1,
    mateusz: 1,
    lukasz: 1,
    "łukasz": 1,
    andrzej: 1,
    robert: 1,
    dawid: 1
  };

  function capitalizeName(s) {
    s = String(s || "").trim();
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  function firstNameFromSession() {
    var email = "";
    var full = "";
    try {
      var u = JSON.parse(localStorage.getItem("dam_user") || "null");
      if (u) {
        email = u.email || "";
        full = u.name || u.displayName || "";
      }
    } catch (e) { /* ignore */ }
    if (!email) email = localStorage.getItem("dam_user_email") || "";
    if (!full) full = localStorage.getItem("dam_user_name") || "";
    var fromEmail = "";
    if (email && email.indexOf("@") !== -1) {
      var local = email.split("@")[0] || "";
      fromEmail = local.split(/[._-]/)[0] || local;
    }
    if (fromEmail) return capitalizeName(fromEmail);
    if (full) return capitalizeName(String(full).split(/\s+/)[0]);
    return "Ty";
  }

  function genderFromName(name) {
    var key = String(name || "").toLowerCase();
    if (!key || key === "ty") return "n";
    if (FEMALE_NAMES[key]) return "f";
    if (MALE_NAMES[key]) return "m";
    return "n";
  }

  function trySelfForGender(gender) {
    if (gender === "f") return "sama";
    if (gender === "m") return "sam";
    return "sobie";
  }

  function nameForms() {
    var name = firstNameFromSession();
    var key = name.toLowerCase();
    var gender = genderFromName(name);
    var voc = VOCATIVE_MAP[key];
    if (!voc) {
      if (gender === "f" && /[aA]$/.test(name)) voc = name.slice(0, -1) + "o";
      else if (gender === "m" && /[bcdfghjklmnpqrstvwxyz]$/i.test(name)) voc = name + "ie";
      else voc = name;
    }
    var dim = DIM_MAP[key] || name;
    if (key === "szymon") dim = Math.random() < 0.5 ? "Szymi" : "Szymuś";
    return {
      name: name,
      nameVocative: voc,
      nameDim: dim,
      gender: gender,
      trySelf: trySelfForGender(gender)
    };
  }

  function fillSlots(tpl) {
    var forms = nameForms();
    return String(tpl || "")
      .replace(/\{nameVocative\}/g, forms.nameVocative)
      .replace(/\{nameDim\}/g, forms.nameDim)
      .replace(/\{trySelf\}/g, forms.trySelf)
      .replace(/\{name\}/g, forms.name);
  }

  function ensureCopy(cb) {
    if (copyCache) {
      if (cb) cb(copyCache);
      return;
    }
    if (copyLoading) {
      global.setTimeout(function () { ensureCopy(cb); }, 80);
      return;
    }
    copyLoading = true;
    fetch(COPY_URL + "?v=" + COPY_CACHE_TOKEN, { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        copyCache = j;
        copyLoading = false;
        if (cb) cb(copyCache);
      })
      .catch(function () {
        copyCache = {
          tryExplore: [
            { text: "Super, fajnie że próbujesz! Poklikaj {trySelf}, ja poczekam.", pose: "joy-4" },
            { text: "Tak właśnie, {name}! Spróbuj {trySelf} - samouczek nie ucieknie.", pose: "approve-8" }
          ],
          wander: [
            { text: "Widzę, że działasz na własną rękę, Zuch! Jak coś, to wiesz gdzie jestem.", pose: "sad-1" },
            { text: "Wiem, że trochę przynudzam, ale fajnie, że podoba Ci się ta opcja!", pose: "sad-2" }
          ],
          sad: [
            { text: "Może nie wszystko jeszcze działa, ale się staram.", pose: "sad-1" },
            { text: "Może z innym produktem pójdzie lepiej?", pose: "sad-2" }
          ],
          cheer_poses: ["joy-4", "joy-5", "joy-6", "approve-8"],
          congrats_title: "Brawo!"
        };
        copyLoading = false;
        if (cb) cb(copyCache);
      });
  }

  function pickCopy(list) {
    if (!list || !list.length) return { text: "...", pose: "sad-1" };
    return list[Math.floor(Math.random() * list.length)];
  }

  function ensureTutCss() {
    var existing = document.getElementById("damTutInjectCss");
    if (existing) {
      if (existing.getAttribute("data-v") === COPY_CACHE_TOKEN) return;
      if (existing.parentNode) existing.parentNode.removeChild(existing);
    }
    var s = document.createElement("style");
    s.id = "damTutInjectCss";
    s.setAttribute("data-v", COPY_CACHE_TOKEN);
    s.textContent =
      ".dam-tut__bubble{max-width:calc(100vw - 32px)!important;}" +
      "@keyframes damTutFadeIn{from{opacity:0}to{opacity:1}}" +
      ".dam-tut__bubble.is-fade-in{animation:damTutFadeIn .45s ease-out both;}" +
      "@media (prefers-reduced-motion:reduce){.dam-tut__bubble.is-fade-in{animation:none;opacity:1!important;}}" +
      ".dam-tut{opacity:1!important;}" +
      ".dam-tut__ctrl{z-index:14020!important;pointer-events:auto!important;}" +
      ".dam-tut__bubble{z-index:14015!important;pointer-events:auto!important;}" +
      ".dam-tut.is-explore .dam-tut__spot{box-shadow:0 0 0 200vmax rgba(15,14,22,.07)!important;" +
      "outline:2px dashed rgba(0,130,68,.35)!important;outline-offset:2px;pointer-events:none!important;}" +
      "@keyframes damTutCompanionIn{from{opacity:0;transform:translate(28px,18px)}to{opacity:1;transform:translate(0,0)}}" +
      "@keyframes damTutPoseSwap{0%{opacity:.35}100%{opacity:1}}" +
      ".dam-tut-companion{position:fixed;right:20px;bottom:100px;z-index:14050;width:min(360px,calc(100vw - 40px));" +
      "display:flex;gap:18px;align-items:flex-start;padding:28px 26px 22px;background:#fff;color:#464255;" +
      "border:1px solid #ececf2;border-radius:16px;box-shadow:0 14px 36px rgba(23,22,30,.22);pointer-events:auto;" +
      "font-family:var(--dam-font,'Jost',sans-serif);overflow:visible;}" +
      ".dam-tut-companion.is-enter{animation:damTutCompanionIn .4s ease-out both;}" +
      ".dam-tut-companion__mascot{position:relative;flex:0 0 78px;width:78px;height:92px;margin-top:6px;}" +
      ".dam-tut-companion__mascot::before{content:'';position:absolute;left:3px;bottom:2px;width:72px;height:72px;" +
      "border-radius:50%;background:#fff;border:1px solid #ececf2;box-shadow:0 6px 16px rgba(0,130,68,.28);}" +
      ".dam-tut-companion__mascot-img,.dam-tut__mascot-img,.dam-tut-invite__mascot-img{" +
      "background-image:var(--dam-tut-pose);background-repeat:no-repeat;background-size:contain;background-position:center bottom;}" +
      ".dam-tut-companion__mascot-img{position:absolute;left:0;bottom:6px;width:100%;height:100%;}" +
      ".dam-tut-companion__mascot-img.is-pose-swap,.dam-tut__mascot-img.is-pose-swap{" +
      "animation:damTutPoseSwap .28s ease-out both;}" +
      ".dam-tut-companion__body{flex:1;min-width:0;padding-right:28px;padding-top:6px;}" +
      ".dam-tut-companion__text{margin:0;font-size:13.5px;line-height:1.45;}" +
      ".dam-tut-companion__resume{margin-top:14px;border:0;background:var(--dam-brand-green,#008244);color:#fff;" +
      "border-radius:8px;padding:8px 12px;font-size:12.5px;font-weight:600;cursor:pointer;}" +
      ".dam-tut-companion__x{position:absolute;top:16px;right:16px;width:28px;height:28px;border:0;border-radius:8px;" +
      "background:transparent;color:#7a7489;cursor:pointer;font-size:18px;line-height:1;}" +
      ".dam-tut-companion__x:hover{background:#f3f1f7;color:#464255;}" +
      ".dam-tut-cheer{position:fixed;right:16px;bottom:20px;z-index:13950;pointer-events:none;" +
      "width:96px;height:110px;opacity:0;}" +
      ".dam-tut-cheer.is-on{opacity:1;transition:opacity .35s ease;}" +
      ".dam-tut-praise-toast{position:fixed;right:20px;bottom:112px;z-index:14120;" +
      "width:min(280px,calc(100vw - 40px));padding:16px 18px;background:#fff;color:#464255;" +
      "border:1px solid #ececf2;border-left:3px solid var(--dam-brand-green,#008244);border-radius:12px;" +
      "box-shadow:0 12px 28px rgba(23,22,30,.14);font-family:var(--dam-font,'Jost',sans-serif);" +
      "pointer-events:none;opacity:0;transform:translateY(12px);overflow:visible;}" +
      ".dam-tut-praise-toast.is-on{opacity:1;transform:translateY(0);" +
      "transition:opacity .28s ease,transform .28s cubic-bezier(.22,.9,.3,1);}" +
      ".dam-tut-praise-toast.is-out{opacity:0;transform:translateY(6px);" +
      "transition:opacity .22s ease,transform .22s ease;}" +
      ".dam-tut-praise-toast__title{margin:0 0 4px;font-size:14px;font-weight:700;color:#008244;line-height:1.25;}" +
      ".dam-tut-praise-toast__text{margin:0;font-size:13px;line-height:1.4;color:#464255;}" +
      ".dam-tut-praise-burst{position:absolute;inset:0;pointer-events:none;overflow:visible;}" +
      ".dam-tut-praise-burst span{position:absolute;left:50%;top:40%;width:6px;height:6px;border-radius:50%;" +
      "background:var(--dam-brand-green,#008244);opacity:.85;}" +
      ".dam-tut-praise-burst[data-v=\"1\"] span:nth-child(1){animation:damTutBurst1 .7s ease-out both;}" +
      ".dam-tut-praise-burst[data-v=\"1\"] span:nth-child(2){animation:damTutBurst1 .7s .04s ease-out both;--bx:18px;--by:-22px;}" +
      ".dam-tut-praise-burst[data-v=\"1\"] span:nth-child(3){animation:damTutBurst1 .7s .08s ease-out both;--bx:-16px;--by:-18px;}" +
      ".dam-tut-praise-burst[data-v=\"1\"] span:nth-child(4){animation:damTutBurst1 .7s .05s ease-out both;--bx:22px;--by:8px;background:#5bb88a;}" +
      ".dam-tut-praise-burst[data-v=\"1\"] span:nth-child(5){animation:damTutBurst1 .7s .09s ease-out both;--bx:-20px;--by:10px;background:#5bb88a;}" +
      ".dam-tut-praise-burst[data-v=\"2\"] span{width:5px;height:5px;border-radius:1px;}" +
      ".dam-tut-praise-burst[data-v=\"2\"] span:nth-child(1){animation:damTutBurst2 .65s ease-out both;--bx:0;--by:-26px;}" +
      ".dam-tut-praise-burst[data-v=\"2\"] span:nth-child(2){animation:damTutBurst2 .65s .05s ease-out both;--bx:20px;--by:-10px;}" +
      ".dam-tut-praise-burst[data-v=\"2\"] span:nth-child(3){animation:damTutBurst2 .65s .08s ease-out both;--bx:-18px;--by:-8px;background:#7bc9a0;}" +
      ".dam-tut-praise-burst[data-v=\"2\"] span:nth-child(4){animation:damTutBurst2 .65s .03s ease-out both;--bx:14px;--by:14px;}" +
      ".dam-tut-praise-burst[data-v=\"2\"] span:nth-child(5){animation:damTutBurst2 .65s .07s ease-out both;--bx:-12px;--by:16px;background:#7bc9a0;}" +
      ".dam-tut-praise-burst[data-v=\"3\"] span{width:4px;height:8px;border-radius:2px;}" +
      ".dam-tut-praise-burst[data-v=\"3\"] span:nth-child(1){animation:damTutBurst3 .75s ease-out both;--bx:-8px;--by:-24px;}" +
      ".dam-tut-praise-burst[data-v=\"3\"] span:nth-child(2){animation:damTutBurst3 .75s .06s ease-out both;--bx:16px;--by:-20px;background:#5bb88a;}" +
      ".dam-tut-praise-burst[data-v=\"3\"] span:nth-child(3){animation:damTutBurst3 .75s .1s ease-out both;--bx:-22px;--by:2px;}" +
      ".dam-tut-praise-burst[data-v=\"3\"] span:nth-child(4){animation:damTutBurst3 .75s .04s ease-out both;--bx:24px;--by:4px;background:#5bb88a;}" +
      ".dam-tut-praise-burst[data-v=\"3\"] span:nth-child(5){animation:damTutBurst3 .75s .09s ease-out both;--bx:2px;--by:18px;}" +
      "@keyframes damTutBurst1{0%{opacity:.9;transform:translate(-50%,-50%) scale(.6)}100%{opacity:0;transform:translate(calc(-50% + var(--bx,0)),calc(-50% + var(--by,-20px))) scale(.2)}}" +
      "@keyframes damTutBurst2{0%{opacity:.85;transform:translate(-50%,-50%) rotate(0)}100%{opacity:0;transform:translate(calc(-50% + var(--bx,0)),calc(-50% + var(--by,-20px))) rotate(40deg)}}" +
      "@keyframes damTutBurst3{0%{opacity:.9;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(calc(-50% + var(--bx,0)),calc(-50% + var(--by,-20px))) scale(.35)}}" +
      "@media (prefers-reduced-motion:reduce){" +
      ".dam-tut-cheer.is-on{transition:none;}" +
      ".dam-tut-companion.is-enter{animation:none;opacity:1;transform:none;}" +
      ".dam-tut-companion__mascot-img.is-pose-swap,.dam-tut__mascot-img.is-pose-swap{animation:none;opacity:1;}" +
      ".dam-tut-praise-toast.is-on,.dam-tut-praise-toast.is-out{transition:opacity .12s ease;transform:none;}" +
      ".dam-tut-praise-burst span{animation:none!important;opacity:0;}" +
      "}";
    document.head.appendChild(s);
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
          titleKey: "tut.dash.hello_title",
          textKey: "tut.dash.hello_text",
          hintKey: "tut.hint.dalej",
          title: "Cześć, tu DobroKaloriuś!",
          text: "Oprowadzę Cię po DAM — zaczynamy od Dashboardu.",
          hint: "Kliknij Dalej (albo strzałkę w prawo).",
          target: [sideLink("dashboard.html")]
        },
        {
          pose: "explain",
          titleKey: "tut.dash.customize_title",
          textKey: "tut.dash.customize_text",
          hintKey: "tut.hint.dalej",
          title: "Dostosuj pulpit",
          text: "Dostosuj pulpit otwiera listę kart tego ekranu.",
          hint: "Nie musisz klikać. Kliknij Dalej.",
          target: ["#damDashCustomizeBtn"]
        },
        {
          pose: "happy",
          titleKey: "tut.dash.stats_title",
          textKey: "tut.dash.stats_text",
          hintKey: "tut.hint.dalej",
          title: "Trzy karty na górze",
          text: "Te trzy karty to liczniki z indeksu DAM, nie z Asany.",
          hint: "Tylko odczyt. Kliknij Dalej.",
          target: [".dam-widget--stat"],
          targetAll: ".dam-widget--stat"
        },
        {
          pose: "media-image",
          titleKey: "tut.dash.viz_title",
          textKey: "tut.dash.viz_text",
          hintKey: "tut.hint.dalej",
          title: "Najnowsze wizualizacje",
          text: "Tu widać ostatnie packshoty z indeksu.",
          hint: "Tylko odczyt. Kliknij Dalej.",
          target: ['[data-widget-id="newest_viz_3"]', ".dam-widget--media-latest"]
        },
        {
          pose: "explain",
          titleKey: "tut.dash.asana_title",
          textKey: "tut.dash.asana_text",
          hintKey: "tut.hint.dalej",
          title: "Asana w szynie powiadomień",
          text: "Zakładka Asana to zadania z eksportu Asany, nie pliki DAM.",
          hint: "Tylko odczyt. Kliknij Dalej.",
          target: ["#damDashSide", ".dam-dash-panel", "#damPanelAsana"]
        },
        {
          pose: "think",
          titleKey: "tut.dash.teams_title",
          textKey: "tut.dash.teams_text",
          hintKey: "tut.hint.dalej",
          title: "Teams",
          text: "Teams czyta skrzynkę DAM z tagiem teams — pusta lista oznacza brak sync.",
          hint: "Tylko odczyt. Kliknij Dalej.",
          target: ['.dam-dash-panel__tab[data-bs-target="#damPanelTeams"]', "#damPanelTeams", "#damDashSide"]
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
          titleKey: "tut.ex.hello_title",
          textKey: "tut.ex.hello_text",
          hintKey: "tut.hint.dalej",
          title: "Eksplorer",
          text: "Tu leżą produkty i nośniki — rozwiń wiersz, żeby zobaczyć pliki.",
          hint: "Tylko odczyt. Kliknij Dalej.",
          target: ["#damExplorerMain", sideLink("explorer.html")]
        },
        {
          pose: "media-assets",
          titleKey: "tut.ex.assoc_title",
          textKey: "tut.ex.assoc_text",
          hintKey: "tut.hint.dalej",
          title: "Skojarzenia",
          text: "Skojarzenie łączy produkt z materiałem — wpisz indeks w to pole.",
          hint: "Kliknij Dalej.",
          target: ["#damFileSearch"]
        },
        {
          pose: "think",
          titleKey: "tut.ex.pakiet_title",
          textKey: "tut.ex.pakiet_text",
          hintKey: "tut.hint.click_or_dalej",
          title: "Eksport PAKIET",
          text: "PAKIET spakuje 2-PROJEKT i 4-WIZKI do ZIP w 3-DRUK.",
          hint: "Ten przycisk. Możesz kliknąć albo Dalej.",
          target: [".dam-pakiet-btn"],
          prepare: "explorer-carrier",
          sample: "pakiet",
          allowClick: true,
          go: true
        },
        {
          pose: "standard",
          titleKey: "tut.ex.icons_title",
          textKey: "tut.ex.icons_text",
          hintKey: "tut.hint.click_or_dalej",
          title: "Ikony bez podpisu",
          text: "Ikony kopiuj i folder: najedź, żeby zobaczyć nazwę.",
          hint: "Najedź albo kliknij Dalej.",
          target: [".dam-carrier-toggle-row .dam-path-actions", ".dam-path-actions"],
          prepare: "explorer-carrier",
          sample: "icons",
          allowClick: true
        }
      ]
    },
    {
      key: "visualizations",
      label: "Wizualizacje",
      href: "visualizations.html",
      steps: [
        {
          pose: "media-image",
          title: "Wizualizacje",
          text: "Galeria wizualizacji produktów. Domyślnie widzisz tylko aktualne wersje, więc nic starego nie miesza się do pracy.",
          target: [".dam-viz-grid", sideLink("visualizations.html")]
        },
        {
          pose: "media-image",
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
          pose: "media-assets",
          title: "Branding",
          text: "Materiały brandingowe: logotypy, banery, kampanie, social media. Wszystko z tagami i podglądem.",
          target: ["#damBrandingSectionGrid", ".dam-branding-grid", sideLink("branding.html")]
        },
        {
          pose: "happy",
          title: "Tagi i filtry",
          text: "Tagi oraz filtry zawężają listę do tego, czego szukasz. Kliknięcie w kafelek otwiera podgląd ze szczegółami i skojarzonymi produktami.",
          target: [sideLink("branding.html"), ".dam-search-wrap--branding-chrome .dam-branding-tabs", "#damBrandingTagFilters"],
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
          titleKey: "tut.proj.hello_title",
          textKey: "tut.proj.hello_text",
          hintKey: "tut.hint.dalej_or_go",
          title: "Projekty",
          text: "Karty opakowań i kompletności — Dalej idzie dalej nawet przy ładowaniu.",
          hint: "Kliknij Dalej, żeby pominąć czekanie. Przejdź tam otwiera stronę Projektów.",
          target: [
            ".dam-projects-grid-toolbar",
            "#damProjectsStatus",
            "#damProjectsGrid",
            sideLink("index.html")
          ],
          go: true
        },
        {
          pose: "standard",
          titleKey: "tut.proj.pack_title",
          textKey: "tut.proj.pack_text",
          hintKey: "tut.hint.dalej",
          title: "Info Pakowania",
          text: "Info Pakowania pokazuje na kartach opakowanie zbiorcze, nie ZIP.",
          hint: "Tylko odczyt. Kliknij Dalej, nawet jeśli przełącznika jeszcze nie widać.",
          target: [
            "label[for='damRevealLowTags']",
            "#damRevealLowTags",
            ".dam-projects-grid-toolbar",
            sideLink("index.html")
          ],
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
          pose: "happy",
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

  // 40 krotkich pochwal (DobroKaloriuś) - ~polowa dlugosci; bez powtorzen az do wyczerpania
  var PRAISES = [
    { pose: "approve", text: "Brawo, {name}!" },
    { pose: "happy", text: "Masz to!" },
    { pose: "joy", text: "Pięknie." },
    { pose: "approve", text: "Celne!" },
    { pose: "happy", text: "Super, {nameDim}!" },
    { pose: "zen", text: "Dokładnie tak." },
    { pose: "joy", text: "Łapiesz to!" },
    { pose: "approve", text: "Brawo za refleks!" },
    { pose: "happy", text: "Jak po maśle." },
    { pose: "happy", text: "Lecimy!" },
    { pose: "approve", text: "W dziesiątkę." },
    { pose: "joy", text: "Listkowy refleks!" },
    { pose: "happy", text: "Ładnie." },
    { pose: "zen", text: "Spokojnie i pewnie." },
    { pose: "approve", text: "Ogarniasz." },
    { pose: "happy", text: "Z klasą." },
    { pose: "joy", text: "Szybko!" },
    { pose: "happy", text: "Dobrze Ci idzie." },
    { pose: "approve", text: "Panel lubi to." },
    { pose: "zen", text: "Czysto. Brawo!" },
    { pose: "joy", text: "Rośniesz w temacie!" },
    { pose: "happy", text: "Zero zgadywania." },
    { pose: "approve", text: "Czytasz UI." },
    { pose: "happy", text: "Świetny wybór!" },
    { pose: "joy", text: "Masz wyczucie." },
    { pose: "happy", text: "Klik jak z nut." },
    { pose: "approve", text: "Tam gdzie trzeba." },
    { pose: "zen", text: "Celny strzał." },
    { pose: "joy", text: "Roślinka dumna!" },
    { pose: "happy", text: "Coraz pewniej." },
    { pose: "approve", text: "Dobry ruch." },
    { pose: "happy", text: "Brawo, {nameVocative}!" },
    { pose: "joy", text: "Dobry kierunek." },
    { pose: "happy", text: "Prawie ekspert." },
    { pose: "approve", text: "Widzę progres." },
    { pose: "zen", text: "Z efektem." },
    { pose: "joy", text: "Tak trzymaj!" },
    { pose: "happy", text: "Z sensem." },
    { pose: "approve", text: "Z uznaniem." },
    { pose: "happy", text: "Dobra robota!" }
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
    companionMode: false,
    exploreMode: false,
    exploreCopyAt: 0,
    companionEl: null,
    praiseToastEl: null,
    bobTween: null,
    els: null,
    raf: 0,
    congratsTimer: 0,
    praiseStats: { shown: 0, skipped: 0, bursts: 0 },
    waitPoll: 0,
    waitTimer: 0,
    waitGen: 0
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
    var done = false;
    var finish = function (g) {
      if (done) return;
      done = true;
      cb(g || global.gsap || null);
    };
    if (global.gsap) {
      finish(global.gsap);
      return;
    }
    var existing = document.querySelector('script[data-dam-gsap="1"]');
    if (existing) {
      existing.addEventListener("load", function () { finish(global.gsap); });
      existing.addEventListener("error", function () { finish(null); });
      global.setTimeout(function () { finish(global.gsap); }, 2000);
      return;
    }
    var s = document.createElement("script");
    s.src = "./assets/vendor/js/gsap/gsap.min.js?v=5.0.196";
    s.setAttribute("data-dam-gsap", "1");
    s.onload = function () {
      finish(global.gsap || null);
    };
    s.onerror = function () {
      finish(null);
    };
    document.body.appendChild(s);
    global.setTimeout(function () { finish(global.gsap); }, 2000);
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
    ensureTutCss();
    var root = document.createElement("div");
    root.id = "damTutorialOverlay";
    root.className = "dam-tut";
    root.innerHTML =
      '<div class="dam-tut__spot" aria-hidden="true"></div>' +
      '<div class="dam-tut__bubble" role="dialog" aria-live="polite" aria-label="Samouczek">' +
        '<div class="dam-tut__mascot" aria-hidden="true"><img class="dam-tut__mascot-img" alt="DobroKaloriuś" src="assets/img/maskotka/pose-1.png"></div>' +
        '<div class="dam-tut__bubble-body">' +
          '<h3 class="dam-tut__title"></h3>' +
          '<p class="dam-tut__text"></p>' +
          '<div class="dam-tut__sample" hidden>' +
            '<span class="dam-tut__sample-pakiet" hidden>PAKIET</span>' +
            '<span class="dam-tut__sample-icons" hidden>' +
              '<span class="dam-tut__sample-ico" title="Kopiuj ścieżkę"><i class="uil uil-copy" aria-hidden="true"></i></span>' +
              '<span class="dam-tut__sample-ico dam-tut__sample-ico--folder" title="Folder Windows"><i class="uil uil-folder-open" aria-hidden="true"></i></span>' +
            "</span>" +
          "</div>" +
          '<p class="dam-tut__hint"></p>' +
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
      sample: root.querySelector(".dam-tut__sample"),
      samplePakiet: root.querySelector(".dam-tut__sample-pakiet"),
      sampleIcons: root.querySelector(".dam-tut__sample-icons"),
      hint: root.querySelector(".dam-tut__hint"),
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
  function elVisibleEnough(el) {
    if (!el || !el.getBoundingClientRect) return false;
    try {
      var style = global.getComputedStyle ? global.getComputedStyle(el) : null;
      if (style && (style.visibility === "hidden" || style.display === "none")) return false;
      var r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    } catch (eVis) {
      return false;
    }
  }

  function collectTargets(step) {
    var out = [];
    var seen = [];
    function add(el) {
      if (!el || seen.indexOf(el) !== -1) return;
      if (!elVisibleEnough(el)) return;
      seen.push(el);
      out.push(el);
    }
    if (step && step.targetAll) {
      try {
        var all = document.querySelectorAll(step.targetAll);
        for (var a = 0; a < all.length; a++) add(all[a]);
      } catch (eAll) { /* ignore */ }
    }
    var sels = (step && step.target) || [];
    for (var i = 0; i < sels.length; i++) {
      try {
        add(document.querySelector(sels[i]));
      } catch (eSel) { /* ignore */ }
    }
    return out;
  }

  function resolveTarget(step) {
    var phase = PHASES[state.phase];
    var onOwnPage = phase && currentPageKey() === phase.key;
    var found = collectTargets(step);
    if (found.length) return found[0];
    if (!onOwnPage && phase && phase.href) {
      try {
        var navEl = document.querySelector(sideLink(phase.href));
        if (elVisibleEnough(navEl)) return navEl;
      } catch (eNav) { /* ignore */ }
    }
    return null;
  }

  function isTargetInteractable(el) {
    if (!elVisibleEnough(el)) return false;
    try {
      var r = el.getBoundingClientRect();
      var cx = r.left + Math.min(24, r.width / 2);
      var cy = r.top + Math.min(24, r.height / 2);
      var topEl = document.elementFromPoint(cx, cy);
      if (!topEl) return true;
      if (el === topEl || el.contains(topEl) || topEl.contains(el)) return true;
      if (topEl.closest && topEl.closest(".dam-tut")) return true;
      if (topEl.closest && (
        topEl.closest("#damHelpModal") ||
        topEl.closest("#damVizModal") ||
        topEl.closest("#damMediaPreview")
      )) {
        return false;
      }
    } catch (eInt) { /* ignore */ }
    return true;
  }

  function clickHitsTarget(e, targetEl) {
    if (!targetEl || !e || !e.target) return false;
    var t = e.target;
    if (targetEl === t || targetEl.contains(t)) return true;
    try {
      if (t.closest) {
        var a = t.closest("a,button,[role='button'],.geex-sidebar__menu__link");
        if (a && (targetEl === a || targetEl.contains(a) || a.contains(targetEl))) return true;
      }
    } catch (err) { /* ignore */ }
    return false;
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

  function spotRectForStep(step) {
    var list = collectTargets(step);
    if (step && step.targetAll && list.length > 1) {
      var pad = 8;
      var left = Infinity;
      var top = Infinity;
      var right = -Infinity;
      var bottom = -Infinity;
      for (var i = 0; i < list.length; i++) {
        var r = list[i].getBoundingClientRect();
        if (r.left < left) left = r.left;
        if (r.top < top) top = r.top;
        if (r.right > right) right = r.right;
        if (r.bottom > bottom) bottom = r.bottom;
      }
      return {
        left: Math.max(2, left - pad),
        top: Math.max(2, top - pad),
        width: Math.min(global.innerWidth - 4, right - left + pad * 2),
        height: Math.min(global.innerHeight - 4, bottom - top + pad * 2)
      };
    }
    return spotRectFor(list[0] || resolveTarget(step));
  }

  function clearTargetWait() {
    if (state.waitPoll) {
      global.clearInterval(state.waitPoll);
      state.waitPoll = 0;
    }
    if (state.waitTimer) {
      global.clearTimeout(state.waitTimer);
      state.waitTimer = 0;
    }
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
    var margin = 16; // HARD: tip card nigdy nie dotyka krawedzi viewport
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
      var rect = spotRectForStep(step);
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

  function prepareNamedTarget(step) {
    if (!step || !step.prepare) return;
    if (step.prepare === "explorer-carrier") {
      try {
        var ex = global.DamExplorer;
        if (ex && typeof ex.revealCarrierForTutorial === "function") {
          ex.revealCarrierForTutorial();
        }
      } catch (ePrep) { /* ignore */ }
    }
  }

  function syncSample(step) {
    var els = state.els;
    if (!els || !els.sample) return;
    var kind = (step && step.sample) || "";
    if (!kind) {
      els.sample.hidden = true;
      if (els.samplePakiet) els.samplePakiet.hidden = true;
      if (els.sampleIcons) els.sampleIcons.hidden = true;
      return;
    }
    els.sample.hidden = false;
    if (els.samplePakiet) els.samplePakiet.hidden = kind !== "pakiet";
    if (els.sampleIcons) els.sampleIcons.hidden = kind !== "icons";
  }

  function renderStep(animate) {
    var phase = PHASES[state.phase];
    var step = currentStep();
    if (!phase || !step) {
      stop();
      return;
    }
    var els = state.els;
    if (!els) return;
    savePhase();
    clearTargetWait();
    if (state.els.root) {
      state.els.root.classList.remove("is-companion", "is-explore");
    }
    prepareNamedTarget(step);
    syncSample(step);

    els.title.textContent = nbspPl(stepCopy(step, "title") || phase.label);
    els.text.textContent = nbspPl(stepCopy(step, "text") || "");
    if (els.hint) {
      els.hint.textContent = nbspPl(stepCopy(step, "hint") || tutT("tut.hint.dalej", "Kliknij Dalej."));
    }
    applyPose(els.mascot, step.pose || "standard");

    var onOwnPage = currentPageKey() === phase.key;
    if (step.go && !onOwnPage) {
      els.go.hidden = false;
    } else {
      els.go.hidden = true;
    }

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

    function paint(foundNow, waiting) {
      if (!state.active || !state.els) return;
      var rect = foundNow ? spotRectForStep(step) : spotRectFor(resolveTarget(step));
      setSpotRect(rect, animate !== false && !waiting);
      placeBubble(rect);
      if (waiting && els.hint) {
        els.hint.textContent = tutT("tut.hint.loading", "Ładowanie kroku… max 3 s.");
      }
    }

    var found = collectTargets(step);
    var el = found[0] || resolveTarget(step);
    paint(found.length > 0, !el && onOwnPage);

    if (el && typeof el.scrollIntoView === "function") {
      var r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > global.innerHeight - 120) {
        try { el.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" }); } catch (eScr) { /* ignore */ }
      }
    }

    global.setTimeout(function () {
      if (!state.active) return;
      paint(collectTargets(step).length > 0, false);
      animateBubbleIn();
    }, el ? 120 : 0);

    if (!el && onOwnPage) {
      var gen = ++state.waitGen;
      var started = Date.now();
      var waitMs = step.prepare ? 10000 : TARGET_WAIT_MS;
      state.waitPoll = global.setInterval(function () {
        if (!state.active || gen !== state.waitGen) {
          clearTargetWait();
          return;
        }
        var later = collectTargets(step);
        if (!later.length) prepareNamedTarget(step);
        later = collectTargets(step);
        if (later.length || Date.now() - started >= waitMs) {
          clearTargetWait();
          if (!later.length && els.hint) {
            els.hint.textContent = tutT(
              "tut.hint.loading_skip",
              "Ten ekran jeszcze się ładuje. Kliknij Dalej."
            );
          } else if (els.hint) {
            els.hint.textContent = nbspPl(stepCopy(step, "hint") || tutT("tut.hint.dalej", "Kliknij Dalej."));
          }
          paint(later.length > 0, false);
        }
      }, 120);
    }
  }

  function nextStep() {
    clearTargetWait();
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
    // Advance-first: navigate immediately; optional praise queued for next page.
    maybeQueuePraiseToast();
    savePhase();
    global.location.href = phase.href;
  }

  // ---------------------------------------------------------------------------
  // Praise toast AFTER advance (non-blocking) + companion off-path
  // ---------------------------------------------------------------------------
  function destroyPraiseToast() {
    if (state.congratsTimer) {
      global.clearTimeout(state.congratsTimer);
      state.congratsTimer = 0;
    }
    if (state.praiseToastEl && state.praiseToastEl.parentNode) {
      state.praiseToastEl.parentNode.removeChild(state.praiseToastEl);
    }
    state.praiseToastEl = null;
  }

  function showPraiseToast(opts) {
    opts = opts || {};
    ensureTutCss();
    destroyPraiseToast();
    ensureCopy(function (copy) {
      var praise = opts.praise || nextPraise();
      var withBurst = opts.forceBurst === true
        ? true
        : (opts.forceBurst === false ? false : Math.random() < BURST_CHANCE);
      if (withBurst) state.praiseStats.bursts += 1;
      var titleTpl = (copy && copy.congrats_title) || "Brawo!";
      var toast = document.createElement("div");
      toast.className = "dam-tut-praise-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.setAttribute("data-dam-praise-toast", "1");
      if (withBurst) toast.setAttribute("data-dam-praise-burst", "1");
      var burstHtml = "";
      if (withBurst && !prefersReducedMotion()) {
        var v = String(1 + Math.floor(Math.random() * 3));
        if (opts.burstVariant) v = String(opts.burstVariant);
        burstHtml =
          '<div class="dam-tut-praise-burst" data-v="' + v + '" aria-hidden="true">' +
          "<span></span><span></span><span></span><span></span><span></span></div>";
      }
      toast.innerHTML =
        burstHtml +
        '<p class="dam-tut-praise-toast__title"></p>' +
        '<p class="dam-tut-praise-toast__text"></p>';
      toast.querySelector(".dam-tut-praise-toast__title").textContent = nbspPl(fillSlots(titleTpl));
      toast.querySelector(".dam-tut-praise-toast__text").textContent = nbspPl(fillSlots(praise.text));
      document.body.appendChild(toast);
      state.praiseToastEl = toast;
      // Enter on next frame so CSS transition runs
      global.requestAnimationFrame(function () {
        if (state.praiseToastEl === toast) toast.classList.add("is-on");
      });
      var hideMs = typeof opts.ms === "number" ? opts.ms : CONGRATS_MS;
      state.congratsTimer = global.setTimeout(function () {
        state.congratsTimer = 0;
        if (!toast.parentNode) return;
        toast.classList.remove("is-on");
        toast.classList.add("is-out");
        global.setTimeout(function () {
          if (state.praiseToastEl === toast) destroyPraiseToast();
          else if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, prefersReducedMotion() ? 80 : 240);
      }, hideMs);
    });
  }

  function rollPraisePayload() {
    if (Math.random() >= PRAISE_CHANCE) {
      state.praiseStats.skipped += 1;
      return null;
    }
    state.praiseStats.shown += 1;
    return {
      praise: nextPraise(),
      forceBurst: Math.random() < BURST_CHANCE
    };
  }

  function maybeShowPraiseToast() {
    var payload = rollPraisePayload();
    if (!payload) return;
    showPraiseToast(payload);
  }

  function maybeQueuePraiseToast() {
    var payload = rollPraisePayload();
    if (!payload) return;
    try {
      sessionStorage.setItem(
        PENDING_PRAISE_KEY,
        JSON.stringify({
          text: payload.praise.text,
          pose: payload.praise.pose,
          forceBurst: payload.forceBurst
        })
      );
    } catch (e) { /* ignore */ }
  }

  function flushPendingPraiseToast() {
    var raw = null;
    try {
      raw = sessionStorage.getItem(PENDING_PRAISE_KEY);
      sessionStorage.removeItem(PENDING_PRAISE_KEY);
    } catch (e) { /* ignore */ }
    if (!raw) return;
    try {
      var data = JSON.parse(raw);
      showPraiseToast({
        praise: { text: data.text || "Brawo!", pose: data.pose || "happy" },
        forceBurst: !!data.forceBurst
      });
    } catch (e2) { /* ignore */ }
  }

  /** Legacy alias: never blocks advance; callers should advance first. */
  function showCongrats(thenFn) {
    if (thenFn) thenFn();
    else if (state.active && !state.companionMode) nextStep();
    maybeShowPraiseToast();
  }

  function destroyCompanion() {
    if (state.companionEl && state.companionEl.parentNode) {
      state.companionEl.parentNode.removeChild(state.companionEl);
    }
    state.companionEl = null;
    if (state.els && state.els.root) {
      state.els.root.classList.remove("is-companion", "is-explore");
    }
    state.companionMode = false;
    state.exploreMode = false;
    state.exploreCopyAt = 0;
  }

  function resumeFromCompanion() {
    destroyCompanion();
    if (!state.active) return;
    renderStep(false);
  }

  function applyExploreCopy(box, item) {
    if (!box || !item) return;
    var mascot = box.querySelector(".dam-tut-companion__mascot");
    applyPose(mascot, item.pose || "joy-4");
    var textEl = box.querySelector(".dam-tut-companion__text");
    if (textEl) textEl.textContent = nbspPl(fillSlots(item.text));
  }

  function buildExploreCompanion(item) {
    var box = document.createElement("div");
    box.className = "dam-tut-companion is-enter";
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    box.setAttribute("data-dam-explore", "1");
    box.innerHTML =
      '<button type="button" class="dam-tut-companion__x" aria-label="Zamknij towarzysza">&times;</button>' +
      '<div class="dam-tut-companion__mascot" aria-hidden="true"><span class="dam-tut-companion__mascot-img"></span></div>' +
      '<div class="dam-tut-companion__body">' +
        '<p class="dam-tut-companion__text"></p>' +
        '<button type="button" class="dam-tut-companion__resume">Wróć do samouczka</button>' +
      "</div>";
    document.body.appendChild(box);
    state.companionEl = box;
    applyExploreCopy(box, item);
    box.querySelector(".dam-tut-companion__x").addEventListener("click", function (ev) {
      ev.preventDefault();
      destroyCompanion();
      if (state.active) renderStep(false);
    });
    box.querySelector(".dam-tut-companion__resume").addEventListener("click", function (ev) {
      ev.preventDefault();
      resumeFromCompanion();
    });
    return box;
  }

  /** Off-path explore-to-test: slide companion, soft dim, UI stays clickable, no step advance. */
  function enterExploreMode() {
    if (!state.active || state.praiseLock) return;
    ensureTutCss();
    ensureCopy(function (copy) {
      var now = Date.now();
      var list = (copy && (copy.tryExplore || copy.wander)) || [];
      var item = pickCopy(list);

      if (state.exploreMode && state.companionEl) {
        if (now - state.exploreCopyAt >= EXPLORE_COPY_THROTTLE_MS) {
          state.exploreCopyAt = now;
          applyExploreCopy(state.companionEl, item);
        }
        return;
      }

      destroyCompanion();
      state.exploreMode = true;
      state.companionMode = true;
      state.exploreCopyAt = now;
      if (state.els && state.els.root) {
        state.els.root.classList.add("is-companion", "is-explore");
      }
      buildExploreCompanion(item);
    });
  }

  function enterCompanionMode() {
    enterExploreMode();
  }

  function onDocClick(e) {
    if (!state.active || state.praiseLock) return;
    var t = e.target;
    if (!t || !t.closest) return;
    if (
      t.closest(".dam-tut__bubble") ||
      t.closest(".dam-tut__ctrl") ||
      t.closest("#damTutorialInvite") ||
      t.closest(".dam-tut-companion") ||
      t.closest(".dam-tut-cheer")
    ) {
      return;
    }
    if (t === document.documentElement || t === document.body) return;
    if (t.closest && t.closest(".dam-tut__spot")) return;

    var step = currentStep();
    /* Clicks on the page (incl. spotlighted PAKIET) must not hide the overlay.
       Explore-mode used to steal the bubble; stay on the step unless clickToAdvance. */
    if (!step || !step.clickToAdvance) return;
    var targetEl = resolveTarget(step);
    if (!clickHitsTarget(e, targetEl)) return;
    if (state.companionMode || state.exploreMode) destroyCompanion();
    nextStep();
  }


  function showSad(reason) {
    ensureTutCss();
    ensureCopy(function (copy) {
      var item = pickCopy(copy.sad || []);
      destroyCompanion();
      var box = document.createElement("div");
      box.className = "dam-tut-companion";
      box.setAttribute("data-dam-sad-reason", reason || "generic");
      box.innerHTML =
        '<button type="button" class="dam-tut-companion__x" aria-label="Zamknij">&times;</button>' +
        '<div class="dam-tut-companion__mascot" aria-hidden="true"><span class="dam-tut-companion__mascot-img"></span></div>' +
        '<div class="dam-tut-companion__body"><p class="dam-tut-companion__text"></p></div>';
      document.body.appendChild(box);
      state.companionEl = box;
      applyPose(box.querySelector(".dam-tut-companion__mascot"), item.pose || "sad-1");
      var textEl = box.querySelector(".dam-tut-companion__text");
      if (textEl) textEl.textContent = nbspPl(fillSlots(item.text));
      box.querySelector(".dam-tut-companion__x").addEventListener("click", function (ev) {
        ev.preventDefault();
        if (box.parentNode) box.parentNode.removeChild(box);
        if (state.companionEl === box) state.companionEl = null;
      });
      global.setTimeout(function () {
        if (box.parentNode) box.parentNode.removeChild(box);
        if (state.companionEl === box) state.companionEl = null;
      }, 6000);
    });
  }

  function canCheer() {
    if (lsGet(FINISHED_KEY) !== "1") return false;
    if (state.active) return false;
    try {
      var budget = parseInt(sessionStorage.getItem(CHEER_BUDGET_KEY) || "0", 10) || 0;
      if (budget >= CHEER_SESSION_MAX) return false;
      var last = parseInt(sessionStorage.getItem(CHEER_AT_KEY) || "0", 10) || 0;
      if (Date.now() - last < CHEER_COOLDOWN_MS) return false;
    } catch (e) {
      return false;
    }
    return Math.random() < 0.35;
  }

  function showCheer(force) {
    if (!force && !canCheer()) return;
    ensureTutCss();
    ensureCopy(function (copy) {
      var poses = (copy && copy.cheer_poses) || ["joy-4", "joy-5", "joy-6", "approve-8"];
      var pose = poses[Math.floor(Math.random() * poses.length)];
      var el = document.getElementById("damTutCheer");
      if (!el) {
        el = document.createElement("div");
        el.id = "damTutCheer";
        el.className = "dam-tut-cheer";
        el.innerHTML = '<div class="dam-tut-companion__mascot" aria-hidden="true"><span class="dam-tut-companion__mascot-img"></span></div>';
        document.body.appendChild(el);
      }
      applyPose(el.querySelector(".dam-tut-companion__mascot"), pose);
      el.classList.add("is-on");
      try {
        sessionStorage.setItem(CHEER_AT_KEY, String(Date.now()));
        var budget = parseInt(sessionStorage.getItem(CHEER_BUDGET_KEY) || "0", 10) || 0;
        sessionStorage.setItem(CHEER_BUDGET_KEY, String(budget + 1));
      } catch (e) { /* ignore */ }
      global.setTimeout(function () {
        el.classList.remove("is-on");
      }, 2800);
    });
  }

  function bindCheerHooks() {
    if (bindCheerHooks._done) return;
    bindCheerHooks._done = true;
    document.addEventListener(
      "click",
      function (e) {
        if (!canCheer()) return;
        var t = e.target;
        if (!t || !t.closest) return;
        if (
          t.closest("[data-dam-share]") ||
          t.closest(".dam-share") ||
          t.closest("[data-action='share']") ||
          t.closest(".dam-tag-chip") ||
          t.closest(".dam-prod-row") ||
          t.closest(".dam-branding-card")
        ) {
          global.setTimeout(function () { showCheer(false); }, 400);
        }
      },
      true
    );
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var t = e.target;
      if (!t || !t.matches) return;
      if (t.matches("input[type='search'], #damFileSearch, .dam-search input")) {
        global.setTimeout(function () {
          maybeEmptySearchSad();
          if (canCheer()) showCheer(false);
        }, 500);
      }
    });
  }

  /* 2026-09-18: petla zamrazajaca UI. MutationObserver na body -> showSad dokleja dymek
     do body -> obserwator odpala sie znowu -> ten sam pusty element nadal jest -> showSad...
     Bez konca (1,8 GB RAM, martwe UI po kliknieciu np. kategorii Materialow, ktora na
     chwile pokazuje ".dam-explorer-empty" z "Ladowanie materialow..."). Straznicy nizej. */
  var SAD_COOLDOWN_MS = 30000;
  var _sadSeen = typeof WeakSet === "function" ? new WeakSet() : null;

  function maybeEmptySearchSad() {
    if (state.companionEl) return; /* dymek juz jest - nie przerysowuj go w kolko */
    if (Date.now() - (state.lastSadAt || 0) < SAD_COOLDOWN_MS) return;
    var empty = document.querySelector(
      ".dam-tag-edit-popover__empty:not([hidden]), .dam-assoc-edit-popover__empty, [data-empty]:not([hidden]), .dam-explorer-empty, .dam-empty"
    );
    if (!empty) return;
    if (_sadSeen && _sadSeen.has(empty)) return;
    /* Ladowanie to nie pusty wynik. */
    if (/adowanie|Wczytywanie|Loading/i.test(empty.textContent || "")) return;
    var style = global.getComputedStyle ? global.getComputedStyle(empty) : null;
    if (style && style.display === "none") return;
    if (_sadSeen) _sadSeen.add(empty);
    state.lastSadAt = Date.now();
    showSad("empty-search");
  }

  function watchEmptyResults() {
    if (watchEmptyResults._obs) return;
    try {
      watchEmptyResults._obs = new MutationObserver(function (muts) {
        /* Zmiany zrobione wylacznie przez sam dymek maskotki nie sa powodem do reakcji. */
        var own = true;
        for (var i = 0; i < muts.length && own; i++) {
          var m = muts[i];
          var nodes = [m.target].concat(
            Array.prototype.slice.call(m.addedNodes || []),
            Array.prototype.slice.call(m.removedNodes || [])
          );
          own = nodes.every(function (n) {
            if (n === document.body) return m.type === "childList";
            return !!(n && n.nodeType === 1 && (n.classList.contains("dam-tut-companion") ||
              (n.closest && n.closest(".dam-tut-companion"))));
          });
        }
        if (own) return;
        maybeEmptySearchSad();
      });
      watchEmptyResults._obs.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden", "class", "style"]
      });
    } catch (e) { /* ignore */ }
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
      if (state.companionMode || state.exploreMode) {
        destroyCompanion();
        if (state.active) renderStep(false);
        return;
      }
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
    ensureTutCss();
    ensureCopy();
    lsSet(SEEN_KEY, "1");
    lsDel(FINISHED_KEY);
    state.active = true;
    state.praiseLock = false;
    state.companionMode = false;
    state.exploreMode = false;
    state.exploreCopyAt = 0;
    shufflePraiseOrder();
    state.phase = typeof opts.phase === "number" ? opts.phase : 0;
    state.step = typeof opts.step === "number" ? opts.step : 0;
    if (state.phase < 0 || state.phase >= PHASES.length) state.phase = 0;
    var maxStep = PHASES[state.phase].steps.length - 1;
    if (state.step < 0 || state.step > maxStep) state.step = 0;

    buildOverlay();
    if (state.els && state.els.root) {
      state.els.root.style.opacity = "1";
    }
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    global.addEventListener("scroll", onViewportChange, true);
    global.addEventListener("resize", onViewportChange);

    renderStep(false);
    loadGsap(function () {
      if (!state.active) return;
      startMascotBob();
      flushPendingPraiseToast();
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
    clearTargetWait();
    destroyPraiseToast();
    destroyCompanion();
    state.active = false;
    state.praiseLock = false;
    destroyOverlay();
  }

  function stop() {
    lsDel(PHASE_KEY);
    // Zamkniecie = uznajemy samouczek za zakonczony (cheer moze sie pojawiac)
    lsSet(FINISHED_KEY, "1");
    lsSet(SEEN_KEY, "1");
    teardown();
  }

  function finish() {
    lsDel(PHASE_KEY);
    lsSet(SEEN_KEY, "1");
    lsSet(FINISHED_KEY, "1");
    teardown();
    global.setTimeout(function () { showCheer(true); }, 600);
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
    var isPhone = false;
    try {
      isPhone = !!(window.matchMedia && window.matchMedia("(max-width: 767.98px)").matches);
    } catch (ePhone) { /* ignore */ }
    var box = document.createElement("div");
    box.id = "damTutorialInvite";
    box.className = "dam-tut-invite" + (isPhone ? " dam-tut-invite--phone" : "");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Zaproszenie do samouczka");
    box.innerHTML =
      '<button type="button" class="dam-tut-invite__close" data-tut-invite="later" aria-label="Zamknij">' +
        '<span aria-hidden="true">&times;</span>' +
      "</button>" +
      '<div class="dam-tut-invite__mascot" aria-hidden="true"><span class="dam-tut-invite__mascot-img"></span></div>' +
      '<div class="dam-tut-invite__body">' +
        '<details class="dam-tut-invite__details"' + (isPhone ? "" : " open") + ">" +
          '<summary class="dam-tut-invite__summary">' +
            '<span class="dam-tut-invite__text"></span>' +
          "</summary>" +
          '<div class="dam-tut-invite__actions">' +
            '<button type="button" class="dam-tut__btn dam-tut__btn--primary" data-tut-invite="yes">Jasne, pokaż</button>' +
            '<button type="button" class="dam-tut__btn" data-tut-invite="later">Nie teraz</button>' +
            '<button type="button" class="dam-tut__btn dam-tut__btn--quiet" data-tut-invite="never">Nie pytaj więcej</button>' +
          "</div>" +
        "</details>" +
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
      if (!btn) {
        var details = box.querySelector(".dam-tut-invite__details");
        if (details && !details.open && !(e.target.closest && e.target.closest("summary"))) {
          details.open = true;
        }
        return;
      }
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
    function tryInject() {
      var panel = document.querySelector("#damHelpModal .dam-help-modal__panel");
      if (!panel) return false;
      injectHelpRestartControl(panel.querySelector(".dam-help-modal__head"));
      if (panel.querySelector(".dam-tut-help-entry")) return true;
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
      return true;
    }
    if (tryInject()) return;
    var obs = null;
    try {
      obs = new MutationObserver(function () {
        if (tryInject()) {
          if (obs) obs.disconnect();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (eObs) { /* ignore */ }
    var tries = 0;
    var timer = global.setInterval(function () {
      tries += 1;
      if (tryInject() || tries > 120) {
        global.clearInterval(timer);
        if (obs) obs.disconnect();
      }
    }, 500);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  function boot() {
    if (global.location.pathname.indexOf("signin") !== -1) return;
    try {
      ensureTutCss();
    } catch (eCss) { /* ignore */ }
    try {
      ensureCopy();
    } catch (eCopy) { /* ignore */ }
    try {
      injectHelpEntry();
    } catch (eHelp) { /* ignore */ }
    try {
      bindCheerHooks();
      watchEmptyResults();
    } catch (eHook) { /* ignore */ }

    var qTut = "";
    try {
      qTut = String(new URLSearchParams(global.location.search).get("damTut") || "");
    } catch (eQ) {
      qTut = "";
    }
    if (qTut) {
      var qp = qTut.split(":");
      var qPhase = parseInt(qp[0], 10);
      var qStep = parseInt(qp[1], 10);
      global.setTimeout(function () {
        if (!state.active) {
          try {
            start({
              phase: isNaN(qPhase) ? 0 : qPhase,
              step: isNaN(qStep) ? 0 : qStep
            });
          } catch (eStart) { /* ignore */ }
        }
      }, 800);
      return;
    }

    // wznowienie po nawigacji ("Przejdz tam" lub klik w link podczas samouczka)
    var saved = lsGet(PHASE_KEY);
    if (saved) {
      var parts = saved.split(":");
      var ph = parseInt(parts[0], 10);
      var st = parseInt(parts[1], 10);
      global.setTimeout(function () {
        if (!state.active) start({ phase: isNaN(ph) ? 0 : ph, step: isNaN(st) ? 0 : st });
      }, 250);
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
    attachHelp: function () {
      try { injectHelpEntry(); } catch (eAtt) { /* ignore */ }
    },
    isActive: function () { return state.active; },
    showInvite: showInvite,
    showSad: showSad,
    showCheer: showCheer,
    resumeFromCompanion: resumeFromCompanion,
    nameForms: nameForms,
    praiseStats: function () {
      return {
        shown: state.praiseStats.shown,
        skipped: state.praiseStats.skipped,
        bursts: state.praiseStats.bursts,
        chance: PRAISE_CHANCE,
        burstChance: BURST_CHANCE,
        congratsMs: CONGRATS_MS
      };
    },
    debugShowPraise: function (opts) {
      opts = opts || {};
      showPraiseToast({
        forceBurst: !!opts.burst,
        burstVariant: opts.burstVariant || 1,
        ms: opts.ms
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
