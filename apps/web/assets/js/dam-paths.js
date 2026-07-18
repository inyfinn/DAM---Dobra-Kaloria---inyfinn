/**
 * DAM ETA - sciezki lokalne, reveal w Eksploratorze, audit log.
 *
 * Struktura katalogow ZAWSZE ta sama (-- ARCHIWUM --, - EKSPORT, - POLSKA).
 * Prefix Marketing = TYLKO to, co UZYTKOWNIK ustawi (po pierwszym uruchomieniu).
 * Brak stalej litery dysku w aplikacji. Wykrywanie to podpowiedz, nie nadpisanie.
 *
 * localStorage (per profil / konto):
 *   dam_base_path      baza ustawiona przez usera (swieta)
 *   dam_index_base     prefix z file-index (tylko do remap; nie jest "zrodlem prawdy")
 *   dam_audit_log
 *
 * Desktop: machine-config.json trzyma preferencje per konto Windows (USERNAME).
 */
(function () {
  "use strict";

  function bridgeBase() {
    if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
      return window.DamRuntime.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  var BASE_KEY = "dam_base_path";
  var INDEX_BASE_KEY = "dam_index_base";
  var AUDIT_KEY = "dam_audit_log";
  var REQUIRED = ["-- ARCHIWUM --", "- EKSPORT", "- POLSKA"];
  var bridgeOk = null;
  var _ensurePromise = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normSlashes(p) {
    return String(p || "").replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  function trimSlash(p) {
    return normSlashes(p).replace(/\/+$/, "");
  }

  function toWin(p) {
    return normSlashes(p).replace(/\//g, "\\");
  }

  function getIndexBase() {
    var stored = localStorage.getItem(INDEX_BASE_KEY);
    if (stored) return trimSlash(stored);
    // Brak stalej litery dysku - remap i tak zdejmie [A-Z]:/Marketing
    return "";
  }

  function setIndexBase(p) {
    if (!p) {
      localStorage.removeItem(INDEX_BASE_KEY);
      return;
    }
    localStorage.setItem(INDEX_BASE_KEY, trimSlash(p));
  }

  function detectIndexBaseFromRoots(roots) {
    if (!roots || !roots.length) return getIndexBase();
    var paths = roots.map(function (r) { return trimSlash(r.path || r); });
    if (!paths.length) return getIndexBase();
    var parts = paths[0].split("/");
    // Tylko do remap (prefix w indeksie). NIE jest sciezka usera.
    if (parts.length >= 2) {
      var candidate = parts.slice(0, 2).join("/");
      var shared = paths.every(function (p) {
        return p.toLowerCase().indexOf(candidate.toLowerCase()) === 0;
      });
      if (shared) {
        setIndexBase(candidate);
        return candidate;
      }
    }
    return getIndexBase();
  }

  function getBasePath() {
    return localStorage.getItem(BASE_KEY) || "";
  }

  function setBasePath(p) {
    // Zachowaj root dysku: "M:\" / "M:" -> "M:\"; inaczej bez trailing slash
    var win = String(p || "").trim().replace(/\//g, "\\");
    if (/^[A-Za-z]:\\?$/.test(win)) {
      win = win.charAt(0).toUpperCase() + ":\\";
    } else {
      win = win.replace(/\\+$/, "");
    }
    localStorage.setItem(BASE_KEY, win);
    // Backup preferencji tego konta Windows (nie nadpisuje innych userow)
    fetch(bridgeBase() + "/machine-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_path: win })
    }).catch(function () { /* opcjonalne */ });
    // Po ustawieniu ROOT - sprawdz czy fetch plikow dziala
    if (window.DamRootStatus && typeof window.DamRootStatus.check === "function") {
      setTimeout(function () { window.DamRootStatus.check(); }, 200);
    }
  }

  function hasBasePath() {
    return !!getBasePath();
  }

  function currentUser() {
    return localStorage.getItem("dam_user_name") || "anonymous";
  }

  /**
   * Wytnij prefix Marketing z dowolnej litery dysku (X:/ D:/ ...) albo ze starego dam_index_base.
   * Zwraca sciezke wzgledna: "- POLSKA/..." albo "".
   */
  function relativeFromMarketing(indexPath) {
    var src = trimSlash(indexPath);
    if (!src) return "";
    var m = src.match(/^[A-Za-z]:\/Marketing\/?(.*)$/i);
    if (m) return m[1] || "";
    var prefix = trimSlash(getIndexBase());
    if (prefix && src.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
      return src.slice(prefix.length).replace(/^\//, "");
    }
    if (/^(- POLSKA|- EKSPORT|-- ARCHIWUM --)\b/i.test(src)) return src;
    return src;
  }

  /**
   * Mapuj sciezke z indeksu na lokalna baze TEJ MASZYNY.
   * Indeks moze miec X:/Marketing/... a Ty na innym kompie D:\Marketing -> remap OK.
   * Stary localStorage dam_index_base=D: przy indeksie X: NIE psuje juz sciezki.
   */
  function toLocal(indexPath) {
    if (!indexPath) return "";
    var base = getBasePath();
    var rel = relativeFromMarketing(indexPath);
    if (!base) return toWin(indexPath);
    var joined = trimSlash(normSlashes(base)) + (rel ? "/" + rel : "");
    return toWin(joined);
  }

  function parentOf(path) {
    var n = normSlashes(path);
    var i = n.lastIndexOf("/");
    return i > 0 ? toWin(n.slice(0, i)) : toWin(n);
  }

  function looksLikeFile(path) {
    var name = normSlashes(path).split("/").pop() || "";
    return /\.[A-Za-z0-9]{1,8}$/.test(name);
  }

  function showToast(msg) {
    if (window.DamShell && typeof window.DamShell.toast === "function") {
      window.DamShell.toast(msg);
      return;
    }
    var el = document.getElementById("damExplorerToast") || document.querySelector(".dam-explorer-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "dam-explorer-toast";
      el.id = "damExplorerToast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("is-visible"); }, 3200);
  }

  function pushLocalAudit(entry) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]"); } catch (e) { list = []; }
    list.unshift(entry);
    if (list.length > 400) list = list.slice(0, 400);
    try { localStorage.setItem(AUDIT_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

  function getAuditLog() {
    try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]"); } catch (e) { return []; }
  }

  function logAction(action, opts) {
    opts = opts || {};
    var entry = {
      ts: new Date().toISOString(),
      action: action,
      user: currentUser(),
      path: opts.path || "",
      local_path: opts.local_path || (opts.path ? toLocal(opts.path) : ""),
      detail: opts.detail || "",
      meta: opts.meta || {}
    };
    pushLocalAudit(entry);
    fetch(bridgeBase() + "/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry)
    }).catch(function () { /* bridge optional */ });
    return entry;
  }

  function checkBridge() {
    return fetch(bridgeBase() + "/health")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        bridgeOk = !!(d && d.ok);
        return bridgeOk;
      })
      .catch(function () {
        bridgeOk = false;
        return false;
      });
  }

  function validateBaseRemote(path) {
    return fetch(bridgeBase() + "/validate-base", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path })
    }).then(function (r) { return r.json(); });
  }

  function detectMarketingBasesRemote() {
    return fetch(bridgeBase() + "/detect-marketing-bases")
      .then(function (r) { return r.json(); });
  }

  function readMachineConfigRemote() {
    return fetch(bridgeBase() + "/machine-config")
      .then(function (r) { return r.json(); });
  }

  /**
   * Preferencja UZYTKOWNIKA jest swieta.
   * - Jesli dam_base_path jest ustawione: NIGDY nie nadpisuj (ani X:, ani D:, ani detect).
   * - Pierwszy start (pusto): przywroc tylko wlasny backup tego konta Windows (machine-config),
   *   bez auto-wyboru "recommended". Podpowiedz zostaje w modalu / przycisku Wykryj.
   */
  function ensureUserBase() {
    if (_ensurePromise) return _ensurePromise;
    _ensurePromise = Promise.all([
      detectMarketingBasesRemote().catch(function () { return null; }),
      readMachineConfigRemote().catch(function () { return null; }),
      fetch("data/file-index.json?v=" + Date.now())
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
    ]).then(function (pack) {
      var detect = pack[0];
      var machine = pack[1];
      var index = pack[2];
      if (index && index.roots) detectIndexBaseFromRoots(index.roots);

      var current = getBasePath();
      if (current) {
        return {
          base: current,
          source: "user",
          detect: detect,
          suggestion: (detect && detect.recommended) || ""
        };
      }

      // Pierwszy start: przywroc tylko to, co TEN user wczesniej zapisal
      var saved = machine && machine.base_path ? String(machine.base_path).trim() : "";
      if (saved) {
        localStorage.setItem(BASE_KEY, saved);
        return {
          base: saved,
          source: "user-backup",
          detect: detect,
          suggestion: (detect && detect.recommended) || ""
        };
      }

      return {
        base: "",
        source: "unset",
        detect: detect,
        suggestion: (detect && detect.recommended) || ""
      };
    }).finally(function () {
      setTimeout(function () { _ensurePromise = null; }, 2000);
    });
    return _ensurePromise;
  }

  /** @deprecated uzyj ensureUserBase - alias kompatybilnosci */
  function ensureMachineBase() {
    return ensureUserBase();
  }

  function copyPath(indexPath) {
    var local = toLocal(indexPath);
    var p = Promise.resolve();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      p = navigator.clipboard.writeText(local);
    } else {
      p = Promise.reject();
    }
    return p.then(function () {
      logAction("copy_path", { path: indexPath, local_path: local, detail: "Skopiowano sciezke lokalna" });
      showToast("Skopiowano: " + local);
    }).catch(function () {
      showToast("Skopiuj recznie: " + local);
    });
  }

  /**
   * Pokaz w Eksploratorze: otwiera folder i ZAZNACZA plik (nie otwiera pliku).
   * Dla folderu: otwiera ten folder.
   */
  function revealInExplorer(indexPath) {
    if (!hasBasePath()) {
      openSetupModal();
      showToast("Najpierw ustaw sciezke bazowa");
      return Promise.resolve({ ok: false, error: "no_base_path" });
    }
    var local = toLocal(indexPath);
    logAction("reveal_explorer", { path: indexPath, local_path: local, detail: "Pokaz w Eksploratorze" });

    return checkBridge().then(function (ok) {
      if (!ok) {
        // Fallback: skopiuj sciezke folderu / pliku + instrukcja
        var hint = looksLikeFile(local)
          ? parentOf(local)
          : local;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(local);
        }
        showToast("Funkcja niedostepna - uruchom aplikacje DAM ETA (skrot na pulpicie).");
        return { ok: false, error: "bridge_offline", path: local, folder: hint };
      }
      return fetch(bridgeBase() + "/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: local })
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (res && res.ok) {
          showToast(res.command === "select" ? "Zaznaczono plik w Eksploratorze" : "Otwarto folder w Eksploratorze");
        } else {
          showToast("Nie znaleziono: " + local + (res && res.error ? " (" + res.error + ")" : ""));
        }
        return res;
      });
    });
  }

  /**
   * Otworz folder produktu w Eksploratorze Windows (NIGDY nie otwiera pliku).
   * Gdy podano plik - bierze katalog rodzica. Gdy folder - otwiera ten folder.
   */
  function openFolderInExplorer(indexPath) {
    if (!hasBasePath()) {
      openSetupModal();
      showToast("Najpierw ustaw sciezke bazowa");
      return Promise.resolve({ ok: false, error: "no_base_path" });
    }
    var local = toLocal(indexPath);
    var folder = looksLikeFile(local) ? parentOf(local) : local;
    logAction("open_folder_explorer", {
      path: indexPath,
      local_path: folder,
      detail: "Eksplorator produktu - otworz folder"
    });

    return checkBridge().then(function (ok) {
      if (!ok) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(folder);
        }
        showToast("Funkcja niedostepna - uruchom aplikacje DAM ETA (skrot na pulpicie).");
        return { ok: false, error: "bridge_offline", path: folder };
      }
      return fetch(bridgeBase() + "/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folder })
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (res && res.ok) {
          showToast("Otwarto folder w Eksploratorze Windows");
        } else {
          showToast("Nie znaleziono folderu: " + folder + (res && res.error ? " (" + res.error + ")" : ""));
        }
        return res;
      });
    });
  }

  /**
   * Udostepnij przez Synology Drive: wywoluje okno klienta
   * (menu kontekstowe Synology Drive > Uzyskaj lacze / Get link).
   */
  function shareViaSynology(indexPath) {
    if (!hasBasePath()) {
      openSetupModal();
      showToast("Najpierw ustaw sciezke bazowa");
      return Promise.resolve({ ok: false, error: "no_base_path" });
    }
    var local = toLocal(indexPath);
    if (!looksLikeFile(local)) {
      showToast("Wybierz plik do udostepnienia");
      return Promise.resolve({ ok: false, error: "not_a_file" });
    }
    logAction("share_synology", {
      path: indexPath,
      local_path: local,
      detail: "Synology Drive - Uzyskaj lacze"
    });

    return checkBridge().then(function (ok) {
      if (!ok) {
        showToast("Funkcja niedostepna - uruchom aplikacje DAM ETA (skrot na pulpicie).");
        return { ok: false, error: "bridge_offline", path: local };
      }
      showToast("Otwieram okno Synology Drive...");
      return fetch(bridgeBase() + "/synology-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: local })
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (res && res.ok) {
          showToast("Otwarto okno Synology Drive (Uzyskaj lacze)");
        } else {
          var err = (res && res.error) || "unknown";
          if (err === "synology_get_link_not_found") {
            showToast("Brak pozycji Synology Drive > Uzyskaj lacze. Sprawdz klienta Synology na tym PC.");
          } else if (err === "path_not_found") {
            showToast("Nie znaleziono pliku: " + local);
          } else {
            showToast("Nie udalo sie otworzyc Synology (" + err + ")");
          }
        }
        return res;
      }).catch(function () {
        showToast("Blad polaczenia z bridge (synology-share)");
        return { ok: false, error: "fetch_failed", path: local };
      });
    });
  }

  function pathActionsHtml(indexPath, opts) {
    opts = opts || {};
    var cls = opts.className ? " " + opts.className : "";
    return (
      '<div class="dam-path-actions' + cls + '">' +
        '<button type="button" class="dam-file-copy" data-path="' + esc(indexPath) + '" ' +
          'data-dam-tip="Kopiuj sciezke lokalna (po mapowaniu dysku)" title="Kopiuj sciezke">' +
          '<i class="uil uil-copy" aria-hidden="true"></i></button>' +
        '<button type="button" class="dam-file-reveal" data-path="' + esc(indexPath) + '" ' +
          'data-dam-tip="Pokaz w Eksploratorze Windows (zaznacz plik / otworz folder)" title="Pokaz w eksploratorze">' +
          '<i class="uil uil-folder-open" aria-hidden="true"></i></button>' +
      "</div>"
    );
  }

  function bindPathActions(root) {
    var scope = root || document;
    scope.querySelectorAll(".dam-file-copy").forEach(function (btn) {
      if (btn._damPathBound) return;
      btn._damPathBound = true;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        copyPath(this.getAttribute("data-path") || "");
      });
    });
    scope.querySelectorAll(".dam-file-reveal").forEach(function (btn) {
      if (btn._damPathBound) return;
      btn._damPathBound = true;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        revealInExplorer(this.getAttribute("data-path") || "");
      });
    });
  }

  /* ---------- Setup modal (first run) ---------- */

  function openSetupModal() {
    if (document.getElementById("damBasePathModal")) return;
    var modal = document.createElement("div");
    modal.id = "damBasePathModal";
    modal.className = "dam-basepath-overlay";
    modal.innerHTML =
      '<div class="dam-basepath-box" role="dialog" aria-modal="true" aria-labelledby="damBasePathTitle">' +
        '<h3 id="damBasePathTitle">Twoja sciezka Marketing</h3>' +
        '<p class="dam-basepath-lead">Zalezy od Ciebie i konta, na ktorym jestes zalogowany. Podaj folder, w ktorym widzisz: ' +
          '<strong>-- ARCHIWUM --</strong>, <strong>- EKSPORT</strong>, <strong>- POLSKA</strong>.</p>' +
        '<p class="dam-basepath-examples">Przyklady (tylko podpowiedz): <code>X:\\Marketing</code> | <code>D:\\Marketing</code> | <code>M:\\</code></p>' +
        '<label class="dam-basepath-label" for="damBasePathInput">Sciezka bazowa (Twoje ustawienie)</label>' +
        '<input type="text" id="damBasePathInput" class="dam-basepath-input" placeholder="np. X:\\Marketing" ' +
          'value="' + esc(getBasePath() || "") + '" />' +
        '<p id="damBasePathMsg" class="dam-basepath-msg" hidden></p>' +
        '<div class="dam-basepath-actions dam-action-stack">' +
          '<button type="button" class="geex-btn geex-btn--primary" id="damBasePathSave">Zapisz i kontynuuj</button>' +
          '<button type="button" class="geex-btn geex-btn--primary-transparent" id="damBasePathSuggest">Podpowiedz z dysku</button>' +
          '<button type="button" class="geex-btn" id="damBasePathSkip">Pozniej (Ustawienia)</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(modal);

    function setMsg(text, ok) {
      var msg = document.getElementById("damBasePathMsg");
      if (!msg) return;
      msg.hidden = !text;
      msg.textContent = text || "";
      msg.className = "dam-basepath-msg" + (ok ? " is-ok" : " is-err");
    }

    document.getElementById("damBasePathSkip").addEventListener("click", function () {
      modal.remove();
    });
    document.getElementById("damBasePathSuggest").addEventListener("click", function () {
      detectMarketingBasesRemote().then(function (res) {
        if (res && res.recommended) {
          document.getElementById("damBasePathInput").value = res.recommended;
          setMsg("Podpowiedz: " + res.recommended + " (zapisz, jesli OK).", true);
        } else {
          setMsg("Brak podpowiedzi - wpisz sciezke recznie.", false);
        }
      }).catch(function () {
        setMsg("Bridge offline - wpisz sciezke recznie.", false);
      });
    });
    document.getElementById("damBasePathSave").addEventListener("click", function () {
      var raw = (document.getElementById("damBasePathInput").value || "").trim();
      if (!raw) {
        setMsg("Podaj sciezke bazowa.", false);
        return;
      }
      setBasePath(raw);
      validateBaseRemote(raw).then(function (res) {
        if (res && res.ok) {
          setMsg("OK - zapisano Twoje ustawienie.", true);
          logAction("set_base_path", { local_path: raw, detail: "Uzytkownik ustawil sciezke bazowa" });
          setTimeout(function () { modal.remove(); }, 500);
        } else if (res && res.missing && res.missing.length) {
          setMsg("Zapisano Twoj wybor; brakuje: " + res.missing.join(", ") + ".", false);
          setTimeout(function () { modal.remove(); }, 1800);
        } else {
          setMsg("Zapisano Twoj wybor (walidacja bridge offline).", true);
          setTimeout(function () { modal.remove(); }, 700);
        }
      }).catch(function () {
        setMsg("Zapisano Twoj wybor.", true);
        setTimeout(function () { modal.remove(); }, 600);
      });
    });

    // Podpowiedz w polu TYLKO gdy pusto - nie zapisuje sama
    detectMarketingBasesRemote().then(function (res) {
      var input = document.getElementById("damBasePathInput");
      if (input && !input.value && res && res.recommended) {
        input.placeholder = "podpowiedz: " + res.recommended;
      }
    }).catch(function () { /* ignore */ });
  }

  function maybePromptSetup() {
    ensureUserBase().then(function (res) {
      if (res && res.base) return;
      if (hasBasePath()) return;
      setTimeout(openSetupModal, 600);
    }).catch(function () {
      if (!hasBasePath()) setTimeout(openSetupModal, 600);
    });
  }

  window.DamPaths = {
    bridgeUrl: bridgeBase,
    REQUIRED: REQUIRED,
    getBasePath: getBasePath,
    setBasePath: setBasePath,
    hasBasePath: hasBasePath,
    getIndexBase: getIndexBase,
    setIndexBase: setIndexBase,
    detectIndexBaseFromRoots: detectIndexBaseFromRoots,
    relativeFromMarketing: relativeFromMarketing,
    toLocal: toLocal,
    parentOf: parentOf,
    copyPath: copyPath,
    revealInExplorer: revealInExplorer,
    openFolderInExplorer: openFolderInExplorer,
    shareViaSynology: shareViaSynology,
    pathActionsHtml: pathActionsHtml,
    bindPathActions: bindPathActions,
    logAction: logAction,
    getAuditLog: getAuditLog,
    checkBridge: checkBridge,
    validateBaseRemote: validateBaseRemote,
    detectMarketingBasesRemote: detectMarketingBasesRemote,
    ensureUserBase: ensureUserBase,
    ensureMachineBase: ensureMachineBase,
    openSetupModal: openSetupModal,
    maybePromptSetup: maybePromptSetup,
    showToast: showToast
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", maybePromptSetup);
  } else {
    maybePromptSetup();
  }
})();
