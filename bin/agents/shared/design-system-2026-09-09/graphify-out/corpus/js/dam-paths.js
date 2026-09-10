/**
 * DAM - sciezki lokalne, reveal w Eksploratorze, audit log.
 *
 * Struktura katalogow ZAWSZE ta sama (-- ARCHIWUM --, - EKSPORT, - POLSKA).
 * Prefix Marketing = TYLKO dla BIEZACEGO urzadzenia (device_id), nie globalnie
 * dla konta na wszystkich PC (dom X: vs praca D:). Patrz program-instruction
 * device-scoped-base-paths + ADR-008.
 *
 * Zrodlo prawdy: Postgres / bridge GET /user-device-paths/current
 * Cache lokalny:
 *   localStorage dam_base_path::{device_id} (+ legacy dam_base_path)
 *   machine-config.json (backup per Windows USERNAME na tym PC)
 */
(function () {
  "use strict";

  function bridgeBase() {
    if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
      return window.DamRuntime.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  /** Naglowki JSON + Bearer (POST /reveal,/audit,/synology-share wymagaja sesji). */
  function bridgeAuthHeaders() {
    var headers = { "Content-Type": "application/json", Accept: "application/json" };
    try {
      if (window.DamApi && typeof DamApi.authHeaders === "function") {
        var ah = DamApi.authHeaders();
        if (ah && ah.Authorization) headers.Authorization = ah.Authorization;
      } else {
        var t = localStorage.getItem("dam_token") || "";
        if (t) headers.Authorization = "Bearer " + t;
      }
    } catch (_e) { /* ignore */ }
    return headers;
  }

  var BASE_KEY = "dam_base_path";
  var BASE_KEY_PREFIX = "dam_base_path::";
  var INDEX_BASE_KEY = "dam_index_base";
  var AUDIT_KEY = "dam_audit_log";
  var REQUIRED = ["-- ARCHIWUM --", "- EKSPORT", "- POLSKA"];
  var bridgeOk = null;
  var _ensurePromise = null;

  function currentDeviceId() {
    try {
      if (window.DamApi && typeof DamApi.deviceId === "function") {
        return String(DamApi.deviceId() || "").trim();
      }
    } catch (_e) { /* ignore */ }
    try {
      return String(localStorage.getItem("dam_device_id") || "").trim();
    } catch (_e2) {
      return "";
    }
  }

  function baseStorageKey(deviceId) {
    var did = String(deviceId || currentDeviceId() || "").trim();
    return did ? BASE_KEY_PREFIX + did : BASE_KEY;
  }

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

  /**
   * Normalizuj wskazanie do rootu Marketing.
   * Przyklad: X:\Marketing\- POLSKA -> X:\Marketing
   * Struktura znana: -- ARCHIWUM --, - EKSPORT, - POLSKA.
   */
  function normalizeMarketingRoot(raw) {
    var win = String(raw || "").trim().replace(/\//g, "\\");
    if (!win) return "";
    if (/^[A-Za-z]:\\?$/.test(win)) {
      return win.charAt(0).toUpperCase() + ":\\";
    }
    win = win.replace(/\\+$/, "");
    var parts = win.split("\\").filter(function (seg) { return seg !== ""; });
    if (!parts.length) return win;

    function isMarketChild(name) {
      var n = String(name || "").replace(/^\s+|\s+$/g, "").toLowerCase();
      if (!n) return false;
      if (n === "-- archiwum --" || n === "- archiwum -" || n === "archiwum") return true;
      if (n === "- eksport" || n === "eksport") return true;
      if (n === "- polska" || n === "polska") return true;
      // warianty z wiodacym myslnikiem / spacja
      if (/^-+\s*archiwum/.test(n)) return true;
      if (/^-+\s*eksport/.test(n)) return true;
      if (/^-+\s*polska/.test(n)) return true;
      return false;
    }

    var mIdx = -1;
    for (var i = 0; i < parts.length; i++) {
      if (String(parts[i]).toLowerCase() === "marketing") {
        mIdx = i;
        break;
      }
    }
    if (mIdx >= 0) {
      return parts.slice(0, mIdx + 1).join("\\");
    }

    // Brak segmentu Marketing: jesli ostatni segment to POLSKA/EKSPORT/ARCHIWUM - wez rodzica
    while (parts.length > 1 && isMarketChild(parts[parts.length - 1])) {
      parts.pop();
    }
    return parts.join("\\");
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
    var did = currentDeviceId();
    if (did) {
      var scoped = localStorage.getItem(BASE_KEY_PREFIX + did);
      if (scoped) return scoped;
    }
    return localStorage.getItem(BASE_KEY) || "";
  }

  function setBasePathLocalCache(win, deviceId) {
    var did = String(deviceId || currentDeviceId() || "").trim();
    if (did) {
      localStorage.setItem(BASE_KEY_PREFIX + did, win);
    }
    // Legacy key = cache TYLKO biezacego urzadzenia (kompatybilnosc starych readerow)
    localStorage.setItem(BASE_KEY, win);
  }

  function persistBasePathToBridge(win, meta) {
    var body = { base_path: win };
    var did = (meta && meta.device_id) || currentDeviceId();
    if (did) body.device_id = did;
    if (meta && meta.hostname) body.hostname = meta.hostname;
    if (meta && meta.label != null) body.label = meta.label;
    // 1) machine-config (lokalny backup Windows USER) - most lustrzuje tez do UDP
    var p1 = fetch(bridgeBase() + "/machine-config", {
      method: "POST",
      headers: bridgeAuthHeaders(),
      body: JSON.stringify({ base_path: win })
    }).catch(function () { return null; });
    // 2) jawny zapis per-urzadzenie (gdy token jest)
    var p2 = fetch(bridgeBase() + "/user-device-paths", {
      method: "POST",
      headers: bridgeAuthHeaders(),
      body: JSON.stringify({
        action: "upsert",
        device_id: did || undefined,
        hostname: (meta && meta.hostname) || undefined,
        label: meta && meta.label != null ? meta.label : undefined,
        base_path: win
      })
    }).catch(function () { return null; });
    return Promise.all([p1, p2]);
  }

  function setBasePath(p, meta) {
    // Zachowaj root dysku: "M:\" / "M:" -> "M:\"; inaczej bez trailing slash
    var win = normalizeMarketingRoot(p);
    if (!win) return;
    if (/^[A-Za-z]:\\?$/.test(win)) {
      win = win.charAt(0).toUpperCase() + ":\\";
    } else {
      win = win.replace(/\\+$/, "");
    }
    setBasePathLocalCache(win, meta && meta.device_id);
    persistBasePathToBridge(win, meta || {});
    // Po ustawieniu ROOT - sprawdz czy fetch plikow dziala
    if (window.DamRootStatus && typeof window.DamRootStatus.check === "function") {
      setTimeout(function () { window.DamRootStatus.check(); }, 200);
    }
  }

  function fetchCurrentDevicePath() {
    return fetch(bridgeBase() + "/user-device-paths/current", {
      headers: bridgeAuthHeaders(),
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).catch(function () { return null; });
  }

  function fetchUserDevicePaths() {
    return fetch(bridgeBase() + "/user-device-paths", {
      headers: bridgeAuthHeaders(),
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).catch(function () { return null; });
  }

  function upsertUserDevicePath(entry) {
    var rawPath = (entry && (entry.base_path || entry.path)) || "";
    var body = {
      action: "upsert",
      device_id: (entry && entry.device_id) || currentDeviceId(),
      hostname: (entry && entry.hostname) || "",
      base_path: normalizeMarketingRoot(rawPath) || rawPath,
      label: entry && entry.label != null ? entry.label : undefined
    };
    return fetch(bridgeBase() + "/user-device-paths", {
      method: "POST",
      headers: bridgeAuthHeaders(),
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  /**
   * Natywny wybor folderu: pywebview (desktop) albo bridge POST /pick-folder (przegladarka + most).
   * Zwraca Promise<{ ok, path?, cancelled?, error? }>.
   */
  function pickFolder(startDir) {
    var start = String(startDir || getBasePath() || "").trim();
    var api = window.pywebview && window.pywebview.api;
    if (api && typeof api.pick_folder === "function") {
      return Promise.resolve(api.pick_folder(start)).then(function (res) {
        if (!res) return { ok: false, cancelled: true };
        if (res.cancelled) return { ok: false, cancelled: true };
        if (!res.ok || !res.path) {
          return { ok: false, error: res.error || "Nie wybrano folderu." };
        }
        var norm = normalizeMarketingRoot(res.path);
        return { ok: true, path: norm || res.path, picked: res.path, normalized: norm !== res.path };
      }).catch(function (err) {
        return { ok: false, error: (err && err.message) || "pick_folder_failed" };
      });
    }
    return fetch(bridgeBase() + "/pick-folder", {
      method: "POST",
      headers: bridgeAuthHeaders(),
      body: JSON.stringify({ start: start, path: start })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res) return { ok: false, error: "empty_response" };
      if (res.cancelled) return { ok: false, cancelled: true };
      if (!res.ok || !res.path) {
        return { ok: false, error: res.error || "Nie wybrano folderu." };
      }
      var norm = normalizeMarketingRoot(res.path);
      return {
        ok: true,
        path: norm || res.path,
        picked: res.path,
        normalized: !!(norm && toWin(norm).toLowerCase() !== toWin(res.path).toLowerCase())
      };
    }).catch(function () {
      return {
        ok: false,
        error: "Wskazywanie folderu wymaga aplikacji desktop lub mostu lokalnego (8766)."
      };
    });
  }

  function deleteUserDevicePath(deviceId) {
    return fetch(bridgeBase() + "/user-device-paths", {
      method: "POST",
      headers: bridgeAuthHeaders(),
      body: JSON.stringify({ action: "delete", device_id: deviceId })
    }).then(function (r) { return r.json(); });
  }

  function hasBasePath() {
    return !!getBasePath();
  }

  function currentUser() {
    return localStorage.getItem("dam_user_name") || "anonymous";
  }

  function isMarketingTail(rel) {
    return /^(- POLSKA|- EKSPORT|-- ARCHIWUM --)(\/|$)/i.test(String(rel || ""));
  }

  /**
   * Wytnij prefix Marketing z dowolnej litery dysku (X:/ D:/ ...) albo ze starego dam_index_base.
   * Obsluga tez M:/- POLSKA/... (Synology bez segmentu Marketing w indeksie brandingowym).
   * Zwraca sciezke wzgledna: "- POLSKA/..." albo "".
   */
  function relativeFromMarketing(indexPath) {
    var src = trimSlash(indexPath);
    if (!src) return "";
    var m = src.match(/^[A-Za-z]:\/Marketing\/?(.*)$/i);
    if (m) return m[1] || "";
    var direct = src.match(/^[A-Za-z]:\/(- POLSKA|- EKSPORT|-- ARCHIWUM --)(\/.*)?$/i);
    if (direct) return src.replace(/^[A-Za-z]:\//i, "");
    var prefix = trimSlash(getIndexBase());
    if (prefix && src.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
      return src.slice(prefix.length).replace(/^\//, "");
    }
    if (isMarketingTail(src)) return src;
    return src;
  }

  /**
   * Mapuj sciezke z indeksu na lokalna baze TEJ MASZYNY.
   * Indeks moze miec X:/Marketing/... a Ty na innym kompie D:\Marketing -> remap OK.
   * Stary localStorage dam_index_base=D: przy indeksie X: NIE psuje juz sciezki.
   */
  function toLocal(indexPath) {
    if (!indexPath) return "";
    var src = trimSlash(normSlashes(indexPath));
    var base = getBasePath();
    if (!base) return toWin(indexPath);
    var baseNorm = trimSlash(normSlashes(base));
    if (src.toLowerCase().indexOf(baseNorm.toLowerCase()) === 0) {
      return toWin(src);
    }
    var srcDrive = src.match(/^([A-Za-z]:)\/(.*)$/i);
    var baseDrive = baseNorm.match(/^([A-Za-z]:)/i);
    if (srcDrive && baseDrive && srcDrive[1].toLowerCase() === baseDrive[1].toLowerCase()) {
      var tail = srcDrive[2] || "";
      if (
        isMarketingTail(tail) ||
        tail.toLowerCase() === "marketing" ||
        tail.toLowerCase().indexOf("marketing/") === 0
      ) {
        return toWin(src);
      }
    }
    var rel = relativeFromMarketing(indexPath);
    var joined = baseNorm + (rel ? "/" + rel : "");
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

  /** Basename pliku (lub ostatni segment folderu) ze sciezki index/local. */
  function basename(path) {
    var n = normSlashes(path);
    if (!n) return "";
    var i = n.lastIndexOf("/");
    return i >= 0 ? n.slice(i + 1) : n;
  }

  function pathHasVizSlot(p) {
    return /\/4\s*-\s*(wizki|visuals)(\/|$)/i.test(normSlashes(p));
  }

  /**
   * Sciezka dla przycisku Folder Windows: zawsze slot wizualizacji (4 - WIZKI / 4 - VISUALS),
   * nie root rewizji ani folder produktu.
   */
  function resolveWinFolderPath(input) {
    var path = "";
    var brand = "";
    if (typeof input === "string") {
      path = String(input || "").trim();
    } else if (input && typeof input === "object") {
      brand = String(input.brand || "").toUpperCase();
      var filePath = String(input.path || "").trim();
      var revPath = String(input.revision_path || input.revisionPath || "").trim();
      if (filePath && (!revPath || filePath !== revPath)) {
        path = filePath;
      } else {
        path = revPath || filePath;
      }
      if (path && !pathHasVizSlot(path)) {
        var base = revPath || (looksLikeFile(path) ? parentOf(path) : path);
        base = trimSlash(base);
        if (base && !pathHasVizSlot(base)) {
          var slot = brand === "GC" ? "4 - VISUALS" : "4 - WIZKI";
          path = base + "/" + slot;
        } else {
          path = base;
        }
      }
    }
    if (!path) return "";
    if (looksLikeFile(path)) path = parentOf(path);
    return path;
  }

  function bridgeErrorMessage(err) {
    var code = String(err || "").trim().toLowerCase();
    if (code === "login_required") {
      return "Zaloguj się w DAM (profil), potem spróbuj ponownie.";
    }
    if (code === "path_not_found") {
      return "Folder nie istnieje na dysku Marketing.";
    }
    if (code === "path_outside_marketing") {
      return "Ta ścieżka jest poza folderem Marketing.";
    }
    if (code === "bridge_offline" || code === "no_base_path") {
      return "Uruchom aplikację DAM lub ustaw ścieżkę Marketing w ustawieniach.";
    }
    return "";
  }

  function showToast(msg, kind) {
    var k = kind || "info";
    if (k !== "success" && k !== "error" && k !== "info") k = "info";
    if (window.DamShell && typeof window.DamShell.toast === "function") {
      window.DamShell.toast(msg, k);
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
    el.classList.remove("dam-explorer-toast--success", "dam-explorer-toast--error", "dam-explorer-toast--info");
    el.classList.add("dam-explorer-toast--" + k);
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("is-visible"); }, k === "error" ? 5200 : 3200);
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
      headers: bridgeAuthHeaders(),
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
   * Preferencja PER URZADZENIE jest swieta.
   * Kolejnosc prawdy:
   *  1) baza (bridge /user-device-paths/current dla tego device_id)
   *  2) cache localStorage dla tego device_id
   *  3) machine-config (tylko ten PC / Windows USER) - nigdy sciezka z innego device
   * Auto-detect NIGDY nie nadpisuje zapisu.
   */
  function ensureUserBase() {
    if (_ensurePromise) return _ensurePromise;
    var identPromise = Promise.resolve(null);
    try {
      if (window.DamApi && typeof DamApi.fetchIdentity === "function") {
        identPromise = DamApi.fetchIdentity().catch(function () { return null; });
      }
    } catch (_e) { /* ignore */ }

    _ensurePromise = Promise.all([
      detectMarketingBasesRemote().catch(function () { return null; }),
      readMachineConfigRemote().catch(function () { return null; }),
      fetchCurrentDevicePath(),
      identPromise,
      (function fetchIndexRootsOptional() {
        var pn = "";
        try {
          pn = String((typeof location !== "undefined" && location.pathname) || "").toLowerCase();
        } catch (_pn) { /* ignore */ }
        /* Explorer/Viz first paint: never pull 9MB data/file-index.json from :8765
           (abort on leave wedges the next explorer.html in the same Chrome profile). */
        if (pn.indexOf("explorer.html") !== -1 || pn.indexOf("visualizations.html") !== -1) {
          return Promise.resolve(window._DAM_FILE_INDEX || null);
        }
        return fetch("data/file-index.json?v=" + Date.now())
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; });
      })()
    ]).then(function (pack) {
      var detect = pack[0];
      var machine = pack[1];
      var devicePath = pack[2];
      var ident = pack[3] || {};
      var index = pack[4];
      if (index && index.roots) detectIndexBaseFromRoots(index.roots);

      var did = String(
        (devicePath && devicePath.device_id) ||
        (ident && ident.device_id) ||
        currentDeviceId() ||
        ""
      ).trim();
      var hostname = String(
        (devicePath && devicePath.hostname) ||
        (ident && ident.hostname) ||
        ""
      ).trim();

      // 1) Prawda z bazy dla TEGO device_id
      var fromDb = devicePath && devicePath.base_path
        ? String(devicePath.base_path).trim()
        : "";
      if (fromDb) {
        setBasePathLocalCache(fromDb, did);
        return {
          base: fromDb,
          source: devicePath.source || "user-device-paths",
          device_id: did,
          hostname: hostname,
          detect: detect,
          suggestion: (detect && detect.recommended) || ""
        };
      }

      // 2) Cache lokalny juz pod to urzadzenie
      var current = getBasePath();
      if (current) {
        // Migacja: jesli jest lokalny cache a brak wpisu w bazie - wypchnij do UDP
        if (did) {
          persistBasePathToBridge(current, { device_id: did, hostname: hostname });
        }
        return {
          base: current,
          source: "local-cache",
          device_id: did,
          hostname: hostname,
          detect: detect,
          suggestion: (detect && detect.recommended) || ""
        };
      }

      // 3) machine-config TYLKO tego PC (nie innego urzadzenia konta)
      var saved = machine && machine.base_path ? String(machine.base_path).trim() : "";
      if (saved) {
        setBasePathLocalCache(saved, did);
        if (did) {
          persistBasePathToBridge(saved, { device_id: did, hostname: hostname });
        }
        return {
          base: saved,
          source: "machine-config-fallback",
          device_id: did,
          hostname: hostname,
          detect: detect,
          suggestion: (detect && detect.recommended) || ""
        };
      }

      return {
        base: "",
        source: "unset",
        device_id: did,
        hostname: hostname,
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

  /**
   * Sciezka przenosna (do schowka): bez litery dysku, od "Marketing\..." z backslashami.
   * Kazdy user montuje udzial pod inna litera, wiec kopiujemy bez root-a.
   * Gdy sciezka nie zawiera segmentu "Marketing" - tylko zdejmij prefix dysku / UNC.
   */
  function toPortablePath(path) {
    var src = normSlashes(path);
    if (!src) return "";
    var parts = src.split("/");
    var idx = -1;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].toLowerCase() === "marketing") {
        idx = i;
        break;
      }
    }
    var rel;
    if (idx >= 0) {
      rel = parts.slice(idx).join("/");
    } else {
      rel = src.replace(/^[A-Za-z]:\/?/, "").replace(/^\/+/, "");
    }
    return toWin(rel);
  }

  /** Kopiuje sciezke przenosna (Marketing\...) do schowka + toast + audit. */
  function copyPortablePath(indexPath) {
    var portable = toPortablePath(indexPath);
    var p;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      p = navigator.clipboard.writeText(portable);
    } else {
      p = Promise.reject();
    }
    return p.then(function () {
      logAction("copy_path", { path: indexPath, local_path: portable, detail: "Skopiowano sciezke przenosna (bez litery dysku)" });
      showToast("Skopiowano: " + portable);
    }).catch(function () {
      showToast("Skopiuj recznie: " + portable);
    });
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
   * Otworz plik domyslna aplikacja Windows (bridge POST /open -> os.startfile).
   */
  function openInDefaultApp(indexPath) {
    if (!hasBasePath()) {
      openSetupModal();
      showToast("Najpierw ustaw sciezke bazowa");
      return Promise.resolve({ ok: false, error: "no_base_path" });
    }
    var local = toLocal(indexPath);
    if (!looksLikeFile(local)) {
      showToast("Wybierz plik do otwarcia", "error");
      return Promise.resolve({ ok: false, error: "not_a_file" });
    }
    logAction("open_file", { path: indexPath, local_path: local, detail: "Otworz plik w domyslnej aplikacji" });
    return checkBridge().then(function (ok) {
      if (!ok) {
        showToast("Funkcja niedostepna - uruchom aplikacje DAM (skrot na pulpicie).", "error");
        return { ok: false, error: "bridge_offline", path: local };
      }
      return fetch(bridgeBase() + "/open", {
        method: "POST",
        headers: bridgeAuthHeaders(),
        body: JSON.stringify({ path: local })
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (res && res.ok) {
          showToast("Otwarto plik w domyslnej aplikacji", "success");
        } else {
          var hint = bridgeErrorMessage(res && res.error);
          showToast(hint || "Nie udalo sie otworzyc pliku.", "error");
        }
        return res;
      }).catch(function () {
        showToast("Blad polaczenia z mostem (open).", "error");
        return { ok: false, error: "fetch_failed", path: local };
      });
    });
  }

  /**
   * Otworz plik + skopiuj sciezke przenosna (Marketing\\...) do schowka.
   * Uzywane przez przycisk "Otworz plik" w modalach (lewo od Kopiuj sciezke).
   */
  function openFileAndCopyPath(indexPath) {
    if (!indexPath) {
      showToast("Brak sciezki pliku", "error");
      return Promise.resolve({ ok: false, error: "path_required" });
    }
    if (!hasBasePath()) {
      openSetupModal();
      showToast("Najpierw ustaw sciezke bazowa");
      return Promise.resolve({ ok: false, error: "no_base_path" });
    }
    var local = toLocal(indexPath);
    if (!looksLikeFile(local)) {
      showToast("Wybierz plik do otwarcia", "error");
      return Promise.resolve({ ok: false, error: "not_a_file" });
    }
    var portable = toPortablePath(indexPath) || local;
    var clipP =
      navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(portable)
        : Promise.resolve();
    logAction("open_file_copy", {
      path: indexPath,
      local_path: local,
      detail: "Otworz plik + kopiuj sciezke przenosna"
    });
    return clipP.catch(function () { /* ignore clipboard fail */ }).then(function () {
      return checkBridge().then(function (ok) {
        if (!ok) {
          showToast("Skopiowano sciezke. Uruchom aplikacje DAM, aby otworzyc plik.");
          return { ok: false, error: "bridge_offline", copied: true, path: local };
        }
        return fetch(bridgeBase() + "/open", {
          method: "POST",
          headers: bridgeAuthHeaders(),
          body: JSON.stringify({ path: local })
        }).then(function (r) { return r.json(); }).then(function (res) {
          if (res && res.ok) {
            showToast("Otwarto plik i skopiowano sciezke", "success");
          } else {
            var hint = bridgeErrorMessage(res && res.error);
            showToast(
              hint || ("Skopiowano sciezke. Nie udalo sie otworzyc pliku."),
              res && res.error === "path_not_found" ? "error" : "error"
            );
          }
          return Object.assign({}, res || {}, { copied: true });
        }).catch(function () {
          showToast("Skopiowano sciezke. Blad mostu przy otwieraniu pliku.", "error");
          return { ok: false, error: "fetch_failed", copied: true, path: local };
        });
      });
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
        showToast("Funkcja niedostepna - uruchom aplikacje DAM (skrot na pulpicie).");
        return { ok: false, error: "bridge_offline", path: local, folder: hint };
      }
      var headers = bridgeAuthHeaders();
      // #region agent log
      fetch("http://127.0.0.1:7922/ingest/8b6cf650-a21b-4d56-ad4a-ad3ea44edb8c", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a78fa0" },
        body: JSON.stringify({
          sessionId: "a78fa0",
          hypothesisId: "A",
          location: "dam-paths.js:revealInExplorer",
          message: "reveal fetch about to fire",
          data: {
            hasToken: !!(localStorage.getItem("dam_token")),
            sentAuth: !!headers.Authorization,
            pathLen: (local || "").length,
            looksFile: looksLikeFile(local),
            basename: basename(local),
            hasFrontS: /FRONT[-_ ]?S\b/i.test(basename(local) || ""),
            hasFrontL: /FRONT[-_ ]?L\b/i.test(basename(local) || ""),
          },
          timestamp: Date.now(),
          runId: "select-s-fix",
        }),
      }).catch(function () {});
      // #endregion
      return fetch(bridgeBase() + "/reveal", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ path: local })
      }).then(function (r) {
        // #region agent log
        fetch("http://127.0.0.1:7922/ingest/8b6cf650-a21b-4d56-ad4a-ad3ea44edb8c", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a78fa0" },
          body: JSON.stringify({
            sessionId: "a78fa0",
            hypothesisId: "A",
            location: "dam-paths.js:revealInExplorer:response",
            message: "reveal HTTP status",
            data: { status: r.status, sentAuth: !!headers.Authorization },
            timestamp: Date.now(),
            runId: "select-s-fix",
          }),
        }).catch(function () {});
        // #endregion
        return r.json();
      }).then(function (res) {
        // #region agent log
        fetch("http://127.0.0.1:7922/ingest/8b6cf650-a21b-4d56-ad4a-ad3ea44edb8c", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a78fa0" },
          body: JSON.stringify({
            sessionId: "a78fa0",
            hypothesisId: "B",
            location: "dam-paths.js:revealInExplorer:body",
            message: "reveal JSON body",
            data: {
              ok: !!(res && res.ok),
              error: (res && res.error) || null,
              command: (res && res.command) || null,
              pathTail: res && res.path ? String(res.path).slice(-90) : null,
            },
            timestamp: Date.now(),
            runId: "select-s-fix",
          }),
        }).catch(function () {});
        // #endregion
        if (res && res.ok) {
          showToast(
            res.command === "select" ? "Zaznaczono plik w Eksploratorze" : "Otwarto folder w Eksploratorze",
            "success"
          );
        } else {
          var hint = bridgeErrorMessage(res && res.error);
          showToast(hint || "Nie udało się otworzyć lokalizacji na dysku.", "error");
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
        showToast("Funkcja niedostepna - uruchom aplikacje DAM (skrot na pulpicie).");
        return { ok: false, error: "bridge_offline", path: folder };
      }
      var headers = bridgeAuthHeaders();
      // #region agent log
      fetch("http://127.0.0.1:7922/ingest/8b6cf650-a21b-4d56-ad4a-ad3ea44edb8c", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a78fa0" },
        body: JSON.stringify({
          sessionId: "a78fa0",
          hypothesisId: "A",
          location: "dam-paths.js:openFolderInExplorer",
          message: "open folder reveal fetch",
          data: {
            hasToken: !!(localStorage.getItem("dam_token")),
            sentAuth: !!headers.Authorization,
            pathLen: (folder || "").length,
          },
          timestamp: Date.now(),
          runId: "post-fix",
        }),
      }).catch(function () {});
      // #endregion
      return fetch(bridgeBase() + "/reveal", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ path: folder })
      }).then(function (r) {
        // #region agent log
        fetch("http://127.0.0.1:7922/ingest/8b6cf650-a21b-4d56-ad4a-ad3ea44edb8c", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a78fa0" },
          body: JSON.stringify({
            sessionId: "a78fa0",
            hypothesisId: "A",
            location: "dam-paths.js:openFolderInExplorer:response",
            message: "open folder HTTP status",
            data: { status: r.status, sentAuth: !!headers.Authorization },
            timestamp: Date.now(),
            runId: "post-fix",
          }),
        }).catch(function () {});
        // #endregion
        return r.json();
      }).then(function (res) {
        if (res && res.ok) {
          showToast("Otwarto folder w Eksploratorze Windows", "success");
        } else {
          var hint = bridgeErrorMessage(res && res.error);
          showToast(hint || "Nie udało się otworzyć folderu.", "error");
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
        showToast("Funkcja niedostepna - uruchom aplikacje DAM (skrot na pulpicie).");
        return { ok: false, error: "bridge_offline", path: local };
      }
      showToast("Otwieram okno Synology Drive...");
      return fetch(bridgeBase() + "/synology-share", {
        method: "POST",
        headers: bridgeAuthHeaders(),
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
        '<button type="button" class="dam-modal-x" id="damBasePathClose" aria-label="Zamknij"><i class="uil uil-times" aria-hidden="true"></i></button>' +
        '<h3 id="damBasePathTitle">Sciezka Marketing na tym komputerze</h3>' +
        '<p class="dam-basepath-lead">Ustawienie dotyczy tylko <strong>tego urzadzenia</strong> ' +
          '(dom / praca moga miec inna litere dysku). Folder musi zawierac: ' +
          '<strong>-- ARCHIWUM --</strong>, <strong>- EKSPORT</strong>, <strong>- POLSKA</strong>.</p>' +
        '<p class="dam-basepath-examples">Przyklady: <code>X:\\Marketing</code> | <code>D:\\Marketing</code> | <code>M:\\</code></p>' +
        '<p id="damBasePathDeviceHint" class="dam-basepath-examples" hidden></p>' +
        '<label class="dam-basepath-label" for="damBasePathInput">Sciezka bazowa</label>' +
        '<div class="dam-basepath-field">' +
          '<input type="text" id="damBasePathInput" class="dam-basepath-input" placeholder="np. X:\\Marketing" ' +
            'value="' + esc(getBasePath() || "") + '" autocomplete="off" spellcheck="false" />' +
          '<button type="button" class="dam-basepath-browse" id="damBasePathBrowse" title="Wskaz folder w Eksploratorze Windows" aria-label="Wskaz folder">' +
            '<i class="uil uil-folder" aria-hidden="true"></i>' +
            '<span>Wskaz folder</span>' +
          "</button>" +
        "</div>" +
        '<p id="damBasePathMsg" class="dam-basepath-msg" hidden></p>' +
        '<div class="dam-basepath-actions">' +
          '<button type="button" class="geex-btn geex-btn--primary dam-basepath-save" id="damBasePathSave">Zapisz i kontynuuj</button>' +
          '<button type="button" class="geex-btn geex-btn--primary-transparent dam-btn-icon dam-basepath-detect" id="damBasePathSuggest"><i class="uil uil-search" aria-hidden="true"></i><span>Wykryj automatycznie</span></button>' +
          '<button type="button" class="geex-btn dam-basepath-later" id="damBasePathSkip">Zrobie to pozniej</button>' +
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

    function pickFolderNative() {
      var start = (document.getElementById("damBasePathInput").value || getBasePath() || "").trim();
      setMsg("Otwieram Eksplorator Windows...", true);
      return pickFolder(start).then(function (res) {
        if (!res || res.cancelled) {
          setMsg("", true);
          return null;
        }
        if (!res.ok || !res.path) {
          setMsg(res.error || "Nie wybrano folderu.", false);
          return null;
        }
        document.getElementById("damBasePathInput").value = res.path;
        if (res.normalized && res.picked) {
          setMsg("Wybrano podfolder - zapisze root: " + res.path, true);
        } else {
          setMsg("Wybrano: " + res.path, true);
        }
        return res.path;
      });
    }

    document.getElementById("damBasePathClose").addEventListener("click", function () {
      modal.remove();
    });
    document.getElementById("damBasePathSkip").addEventListener("click", function () {
      modal.remove();
    });
    document.getElementById("damBasePathBrowse").addEventListener("click", function () {
      pickFolderNative();
    });
    document.getElementById("damBasePathSuggest").addEventListener("click", function () {
      setMsg("Szukam folderu Marketing na dyskach tego komputera...", true);
      detectMarketingBasesRemote().then(function (res) {
        if (res && res.recommended) {
          document.getElementById("damBasePathInput").value = res.recommended;
          setMsg("Znaleziono: " + res.recommended + " - kliknij \"Zapisz i kontynuuj\", jesli to prawidlowa sciezka.", true);
        } else {
          setMsg("Nie znaleziono folderu Marketing automatycznie - wpisz sciezke recznie.", false);
        }
      }).catch(function () {
        setMsg("Nie mozna wykryc - most lokalny jest offline. Wpisz sciezke recznie.", false);
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

    // Podpis urzadzenia (hostname / device_id)
    ensureUserBase().then(function (info) {
      var hint = document.getElementById("damBasePathDeviceHint");
      if (!hint) return;
      var host = (info && info.hostname) || "";
      var did = (info && info.device_id) || currentDeviceId();
      if (host || did) {
        hint.hidden = false;
        hint.textContent = "Urzadzenie: " + (host || "ten komputer") +
          (did ? " (" + did.slice(0, 22) + (did.length > 22 ? "…" : "") + ")" : "");
      }
    }).catch(function () { /* ignore */ });

    // Wypelnia pole podpowiedzia TYLKO gdy jest puste - nie zapisuje automatycznie
    detectMarketingBasesRemote().then(function (res) {
      var input = document.getElementById("damBasePathInput");
      if (input && !input.value && res && res.recommended) {
        input.placeholder = "wykryto: " + res.recommended;
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
    normalizeMarketingRoot: normalizeMarketingRoot,
    pickFolder: pickFolder,
    currentDeviceId: currentDeviceId,
    getIndexBase: getIndexBase,
    setIndexBase: setIndexBase,
    detectIndexBaseFromRoots: detectIndexBaseFromRoots,
    relativeFromMarketing: relativeFromMarketing,
    toLocal: toLocal,
    parentOf: parentOf,
    basename: basename,
    resolveWinFolderPath: resolveWinFolderPath,
    toPortablePath: toPortablePath,
    copyPortablePath: copyPortablePath,
    copyPath: copyPath,
    openInDefaultApp: openInDefaultApp,
    openFileAndCopyPath: openFileAndCopyPath,
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
    fetchCurrentDevicePath: fetchCurrentDevicePath,
    fetchUserDevicePaths: fetchUserDevicePaths,
    upsertUserDevicePath: upsertUserDevicePath,
    deleteUserDevicePath: deleteUserDevicePath,
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
