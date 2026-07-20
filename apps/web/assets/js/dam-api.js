(function () {
  "use strict";
  var API = window.DAM_API_BASE || "http://127.0.0.1:8000/api";
  var API_TIMEOUT_MS = 2500;
  var INDEX_URL = "data/file-index.json";

  /* ------------------------------------------------------------------ */
  /* Lokalna baza plikow (w repo)                                        */
  /* Struktura katalogow jest zawsze ta sama; prefix sciezki (D:/ P:/)   */
  /* tylko odblokowuje otwieranie plikow. Metadane = file-index.json.    */
  /* ------------------------------------------------------------------ */

  var _indexPromise = null;
  var _projectsCache = null;

  function fileExt(name) {
    var m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  function pickLatestRevision(product) {
    var revs = (product && product.revisions) || [];
    if (!revs.length) return null;
    /* Wiele is_latest (np. dwa TUBA z 6300XXX) - wybierz najnowsza date. */
    var candidates = [];
    for (var i = 0; i < revs.length; i++) {
      if (revs[i] && revs[i].is_latest) candidates.push(revs[i]);
    }
    if (!candidates.length) candidates = revs.slice();
    candidates.sort(function (a, b) {
      var dd = String((b && b.date) || "").localeCompare(String((a && a.date) || ""));
      if (dd) return dd;
      return String((b && b.folder) || "").localeCompare(String((a && a.folder) || ""));
    });
    return candidates[0];
  }

  function fileExtName(name) {
    var m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  function isVizImageName(name) {
    return ["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"].indexOf(fileExtName(name)) >= 0;
  }

  function isArchiveName(name) {
    return ["zip", "rar", "7z"].indexOf(fileExtName(name)) >= 0;
  }

  /** Mapowanie rol z indeksu dysku -> checklista DAM (szersza, jak Eksplorator) */
  function rolesFromRevision(rev, product) {
    var fbr = (rev && rev.files_by_role) || {};
    var src = fbr.source || [];
    var prt = fbr.print || [];
    var viz = (fbr.viz || []).filter(function (f) { return isVizImageName(f.name); });
    var wizki = ((rev && rev.wizki) || []).filter(function (f) { return isVizImageName(f.name); });
    var elements = fbr.elements || [];
    var archivePrint = []
      .concat(fbr.viz || [])
      .concat((rev && rev.wizki) || [])
      .filter(function (f) { return isArchiveName(f.name); });

    /* AI/edytowalny - jak Eksplorator (nie kazdy PDF w source) */
    var hasArtwork = src.some(function (f) {
      var e = fileExt(f.name);
      return e === "ai" || e === "psd" || e === "indd";
    });

    var hasPrev = src.some(function (f) {
      var u = String(f.name || "").toUpperCase();
      return /\bPREV\b/.test(u) || (/[-_]F([-_.]|$)/.test(u) && !/FQ/.test(u));
    });

    var hasViz = viz.length > 0 || wizki.length > 0;

    var hasPrint = prt.length > 0 || archivePrint.length > 0 || src.some(function (f) {
      var u = String(f.name || "").toUpperCase();
      return /FQ/.test(u) && fileExt(f.name) === "pdf";
    });

    var hasTech = elements.length > 0 || ((rev && rev.slots) || []).some(function (s) {
      var su = String(s).toUpperCase();
      return su.indexOf("ELEMENTY") >= 0 || su.indexOf("ELEMENTS") >= 0 ||
        su.indexOf("SKLADNIKI") >= 0 || su.indexOf("INGREDIENTS") >= 0 || su.indexOf("TECH") >= 0;
    });
    /* Reczne powiazanie Elementy (explorer -> elements-overrides.json) */
    if (!hasTech && rev) {
      try {
        var elLinks = JSON.parse(localStorage.getItem("dam_elements_links") || "{}");
        var map = (elLinks && elLinks.links) || {};
        var rk = String(rev.path || "").replace(/\\/g, "/").replace(/\/+$/, "");
        var idx = String(rev.index || "").trim();
        if ((rk && map[rk] && map[rk].path) || (idx && map[idx] && map[idx].path)) {
          hasTech = true;
        }
      } catch (e) { /* ignore */ }
    }

    var hasMarketing = ((product && product.related_materials) || []).some(function (m) {
      return m && m.file_count > 0;
    });
    if (!hasMarketing && window.DamProductCorrelation && product && product.id) {
      hasMarketing = DamProductCorrelation.hasBrandingMaterials(product.id);
    }

    var hasKarta =
      ((fbr.karty_wprowadzenia || []).length > 0) ||
      src.some(function (f) {
        var u = String(f.name || "").toUpperCase();
        return /KARTA/.test(u) && /WPROWADZ/.test(u);
      });

    var hasPresentation =
      ((fbr.strategia || []).length > 0) ||
      src.some(function (f) {
        var e = fileExtName(f.name);
        var u = String(f.name || "").toUpperCase();
        return (e === "pptx" || e === "ppt" || e === "key") &&
          (/PREZENT|STRATEG|POZYCJON/.test(u));
      });

    return {
      artwork: hasArtwork,
      prev: hasPrev,
      viz_3d: hasViz,
      print_pdf: hasPrint,
      tech: hasTech,
      marketing: hasMarketing,
      karta: hasKarta,
      presentation: hasPresentation,
    };
  }

  function firstFilePath(files) {
    if (!files || !files.length) return "";
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f && (f.path || f.folder)) return f.path || f.folder || "";
    }
    return "";
  }

  function rolePathsFromRevision(rev, product) {
    var fbr = (rev && rev.files_by_role) || {};
    var base = (rev && rev.path) || (product && product.path) || "";
    var vizFiles = (fbr.viz || []).concat((rev && rev.wizki) || []);
    var paths = {
      artwork: firstFilePath(fbr.source) || base,
      prev: firstFilePath(
        (fbr.source || []).filter(function (f) {
          var u = String(f.name || "").toUpperCase();
          return /\bPREV\b/.test(u) || (/[-_]F([-_.]|$)/.test(u) && !/FQ/.test(u));
        })
      ) || base,
      viz_3d: firstFilePath(vizFiles) || base,
      print_pdf: firstFilePath(fbr.print) || base,
      tech: firstFilePath(fbr.elements) || base,
      marketing: firstFilePath((product && product.related_materials) || []) || base,
      karta: firstFilePath(fbr.karty_wprowadzenia) || base,
      presentation: firstFilePath(fbr.strategia) || base,
    };
    return paths;
  }

  function asset(role, done, path) {
    return {
      asset_role: role,
      current_revision_id: done ? 1 : null,
      path: path || "",
    };
  }

  function productToProject(product, seq) {
    var rev = pickLatestRevision(product);
    var roles = rolesFromRevision(rev, product);
    var rolePaths = rolePathsFromRevision(rev, product);
    // Wymagane z indeksu dysku: projekt + wizki + druk.
    // prev / tech / marketing - w checklistcie, nie blokuja statusu listy.
    var missing = [];
    ["artwork", "viz_3d", "print_pdf"].forEach(function (r) {
      if (!roles[r]) missing.push(r);
    });
    var status = missing.length ? "incomplete" : "complete";
    var index =
      (rev && rev.index) ||
      (product.indexes && product.indexes[0]) ||
      (product.index_bases && product.index_bases[0]) ||
      "";
    var title =
      (window.DamLabels && typeof window.DamLabels.cleanProductDisplayName === "function"
        ? window.DamLabels.cleanProductDisplayName(product.display_name || product.name)
        : null) ||
      product.display_name ||
      product.name ||
      product.id;
    /* Indeks + baseline DK=PL. Extra / GC tylko z dowodu (bez GC=gb). */
    var langs = ((rev && rev.langs) || []).slice();
    var brandCode = product.brand || "DK";
    if (brandCode === "DK" && langs.indexOf("pl") < 0) {
      langs = ["pl"].concat(langs);
    }

    return {
      id: product.id,
      seq: seq,
      product_index: index,
      title: title,
      market: product.brand === "GC" ? "GC" : "PL",
      brand: product.brand || "DK",
      category: product.category || "",
      subcategory_slug: product.subcategory_slug || "",
      subcategory_label: product.subcategory_label || "",
      carrier: (rev && rev.carrier) || product.carrier || "",
      langs: langs,
      path: product.path || (rev && rev.path) || "",
      rel: product.rel || "",
      completeness: status,
      missing_roles: missing,
      revision_count: (product.revisions || []).length,
      variants: [
        {
          id: product.id + "::" + (rev && rev.index ? rev.index : "0"),
          checklist_status: { status: status, missing_roles: missing },
          assets: [
            asset("artwork", roles.artwork, rolePaths.artwork),
            asset("prev", roles.prev, rolePaths.prev),
            asset("viz_3d", roles.viz_3d, rolePaths.viz_3d),
            asset("print_pdf", roles.print_pdf, rolePaths.print_pdf),
            asset("tech", roles.tech, rolePaths.tech),
            asset("marketing", roles.marketing, rolePaths.marketing),
            asset("karta", roles.karta, rolePaths.karta),
            asset("presentation", roles.presentation, rolePaths.presentation),
          ],
        },
      ],
    };
  }

  function loadFileIndex() {
    if (_indexPromise) return _indexPromise;
    _indexPromise = fetch(INDEX_URL + "?v=" + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error("Brak file-index.json (" + r.status + ")");
        return r.json();
      })
      .then(function (data) {
        if (window.DamPaths && typeof window.DamPaths.detectIndexBaseFromRoots === "function") {
          window.DamPaths.detectIndexBaseFromRoots(data.roots || []);
        }
        var products = data.products || [];
        _projectsCache = products.map(function (p, i) {
          return productToProject(p, i + 1);
        });
        return { index: data, projects: _projectsCache };
      })
      .catch(function (e) {
        _indexPromise = null;
        throw e;
      });
    return _indexPromise;
  }

  function localProjects() {
    return loadFileIndex().then(function (pack) {
      return pack.projects;
    });
  }

  function localProjectById(id) {
    return localProjects().then(function (rows) {
      var key = String(id);
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i].id) === key) return rows[i];
        if (String(rows[i].product_index) === key) return rows[i];
        if (String(rows[i].seq) === key) return rows[i];
      }
      return rows[0] || null;
    });
  }

  function localVariantById(variantId) {
    return localProjects().then(function (rows) {
      var key = String(variantId);
      for (var i = 0; i < rows.length; i++) {
        var v = rows[i].variants && rows[i].variants[0];
        if (v && String(v.id) === key) return v;
      }
      return (rows[0] && rows[0].variants && rows[0].variants[0]) || {
        checklist_status: { status: "incomplete", missing_roles: [] },
      };
    });
  }

  function offlineQueuePush(entry) {
    try {
      var q = JSON.parse(localStorage.getItem("dam_offline_queue") || "[]");
      q.push(Object.assign({ at: new Date().toISOString() }, entry));
      localStorage.setItem("dam_offline_queue", JSON.stringify(q.slice(-50)));
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */

  function bridgeAuthUrl() {
    if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
      return window.DamRuntime.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  var _identityCache = null;
  /** Rola z ostatniego /auth/me (anti-spoof localStorage.dam_role). */
  var _sessionRole = "";

  function clearLocalAuth() {
    _sessionRole = "";
    [
      "dam_token",
      "dam_device_id",
      "dam_machine_id",
      "dam_session_id",
      "dam_role",
      "dam_user_name",
      "dam_user",
      "dam_admin_mode",
      "dam_viz_admin_mode",
    ].forEach(function (k) {
      try {
        localStorage.removeItem(k);
      } catch (e) { /* ignore */ }
    });
  }

  async function fetchIdentity() {
    if (_identityCache && _identityCache.machine_id) return _identityCache;
    try {
      var r = await fetch(bridgeAuthUrl() + "/auth/identity", { cache: "no-store" });
      var data = await r.json();
      if (data && data.ok && data.machine_id) {
        _identityCache = data;
        localStorage.setItem("dam_machine_id", data.machine_id);
        if (data.device_id) localStorage.setItem("dam_device_id", data.device_id);
        return data;
      }
    } catch (e) { /* bridge offline */ }
    try {
      var ri = await fetch("data/dam-identity.json?_=" + Date.now(), { cache: "no-store" });
      var idata = await ri.json();
      if (idata && idata.machine_id) {
        _identityCache = idata;
        localStorage.setItem("dam_machine_id", idata.machine_id);
        if (idata.device_id) localStorage.setItem("dam_device_id", idata.device_id);
        return idata;
      }
    } catch (e2) { /* ignore */ }
    return _identityCache || {};
  }

  function deviceId() {
    var key = "dam_device_id";
    var id = localStorage.getItem(key);
    if (id && String(id).indexOf("dam-dev-") === 0) return id;
    if (_identityCache && _identityCache.device_id) {
      localStorage.setItem(key, _identityCache.device_id);
      return _identityCache.device_id;
    }
    id = localStorage.getItem("dam_machine_id");
    if (id && String(id).indexOf("dam-mid-") === 0) {
      var derived = "dam-dev-" + String(id).replace("dam-mid-", "");
      localStorage.setItem(key, derived);
      return derived;
    }
    /* Legacy random - zostanie nadpisany po /auth/identity lub loginie */
    if (id) return id;
    id = "dev_pending_" + Date.now().toString(36);
    localStorage.setItem(key, id);
    return id;
  }

  function machineId() {
    return (
      localStorage.getItem("dam_machine_id") ||
      (_identityCache && _identityCache.machine_id) ||
      ""
    );
  }

  function token() {
    return localStorage.getItem("dam_token") || "";
  }

  function persistSession(data) {
    if (!data || !data.token) return;
    localStorage.setItem("dam_token", data.token);
    if (data.device_id) localStorage.setItem("dam_device_id", data.device_id);
    if (data.machine_id) localStorage.setItem("dam_machine_id", data.machine_id);
    if (data.session_id) localStorage.setItem("dam_session_id", data.session_id);
    if (data.user) {
      var role = String(data.user.role || "user").toLowerCase() || "user";
      _sessionRole = role;
      localStorage.setItem("dam_role", role);
      localStorage.setItem("dam_user_name", data.user.name || "");
      localStorage.setItem("dam_user", JSON.stringify({
        email: data.user.email || "",
        role: role,
        name: data.user.name || "",
        auth_provider: data.user.auth_provider || "local",
        title: "GRAFIK",
        department: "MARKETING",
        company: "KUBARA"
      }));
      if (role !== "admin") {
        try {
          localStorage.setItem("dam_admin_mode", "0");
          localStorage.setItem("dam_viz_admin_mode", "0");
        } catch (e) { /* ignore */ }
      }
    }
  }

  function authHeaders() {
    return {
      Authorization: "Bearer " + token(),
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  function apiFetch(url, opts) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var options = Object.assign({}, opts || {});
    if (ctrl) options.signal = ctrl.signal;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, API_TIMEOUT_MS);
    return fetch(url, options).finally(function () { clearTimeout(timer); });
  }

  async function parse(r) {
    var data = null;
    try {
      data = await r.json();
    } catch (e) {
      data = null;
    }
    if (r.status === 401) {
      // Sesja urzadzenia: nie kasuj tokenu automatycznie przy chwilowym 401 API Laravel.
      // Tylko przekieruj gdy naprawde brak lokalnej sesji.
      if (!token()) location.href = "signin.html";
      throw new Error("Unauthenticated");
    }
    if (!r.ok) {
      throw new Error((data && data.message) || "HTTP " + r.status);
    }
    return data;
  }

  function isNetworkError(e) {
    return (
      e instanceof TypeError ||
      (e && (e.name === "AbortError" || /fetch|network|abort/i.test(String(e.message))))
    );
  }

  window.DamApi = {
    base: API,
    offline: false,
    token: token,
    authHeaders: authHeaders,
    role: function () {
      /* Preferuj role z sesji mostu (anti-spoof localStorage). */
      if (_sessionRole) return _sessionRole;
      return localStorage.getItem("dam_role") || "";
    },
    requireAuth: function () {
      var t = token();
      // Stary tryb demo - wymus zalogowanie prawdziwym kontem (raz)
      if (!t || t === "demo-admin-dev-token") {
        if (t === "demo-admin-dev-token") {
          localStorage.removeItem("dam_token");
          localStorage.removeItem("dam_role");
        }
        location.href = "signin.html";
        return false;
      }
      return true;
    },
    /** Jawne zasilenie z lokalnej bazy (file-index) */
    loadLocalIndex: loadFileIndex,
    async health() {
      try {
        return await parse(await apiFetch(API + "/health"));
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        this.offline = true;
        return { ok: true, mode: "offline", source: "file-index" };
      }
    },
    deviceId: deviceId,
    machineId: machineId,
    fetchIdentity: fetchIdentity,
    clearLocalAuth: clearLocalAuth,
    async login(email, password) {
      // 1) Lokalna baza kont (bridge) - bcrypt + machine_id / session_id
      try {
        var ident = await fetchIdentity();
        var br = await fetch(bridgeAuthUrl() + "/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            email: email,
            password: password,
            device_id: (ident && ident.device_id) || deviceId(),
            machine_id: (ident && ident.machine_id) || machineId(),
          }),
        });
        var bdata = await br.json();
        if (bdata && bdata.ok && bdata.token) {
          persistSession(bdata);
          return bdata;
        }
        if (bdata && bdata.error === "invalid_credentials") {
          throw new Error("Nieprawidlowy email lub haslo.");
        }
        if (bdata && bdata.error === "machine_id_required") {
          throw new Error("Brak ID maszyny - uruchom DAM przez skrot desktop.");
        }
      } catch (e) {
        if (e && e.message && /Nieprawidlowy|Brak ID/.test(e.message)) throw e;
        /* bridge offline - sprobuj Laravel */
      }
      try {
        var r = await apiFetch(API + "/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email: email, password: password }),
        });
        var data = await parse(r);
        persistSession(data);
        return data;
      } catch (e2) {
        throw e2 instanceof Error ? e2 : new Error("Logowanie nieudane");
      }
    },
    async register(email, password, name) {
      var r = await fetch(bridgeAuthUrl() + "/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email, password: password, name: name || "" }),
      });
      var data = await r.json();
      if (!data || !data.ok) {
        var err = (data && data.error) || "register_failed";
        if (err === "email_taken") throw new Error("Konto z tym emailem juz istnieje.");
        if (err === "password_too_short") throw new Error("Haslo min. 8 znakow.");
        if (err === "admin_required") {
          throw new Error("Nowe konta zaklada tylko administrator.");
        }
        throw new Error("Nie udalo sie utworzyc konta.");
      }
      // Po rejestracji od razu zaloguj na tym urzadzeniu
      return this.login(email, password);
    },
    logout: async function () {
      var t = token();
      try {
        await fetch(bridgeAuthUrl() + "/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: t ? "Bearer " + t : "",
          },
          body: "{}",
        });
      } catch (e) {
        /* most offline - i tak czyscimy lokalnie */
      }
      // device_id / machine_id zostaja (tozsamosc maszyny); sesja i user wylatuja
      [
        "dam_token",
        "dam_session_id",
        "dam_role",
        "dam_user",
        "dam_user_name",
      ].forEach(function (k) {
        try {
          localStorage.removeItem(k);
        } catch (err) { /* ignore */ }
      });
      if (window.DamPaths && typeof window.DamPaths.showToast === "function") {
        window.DamPaths.showToast("Wylogowano.");
      }
      window.location.href = "signin.html";
      return { ok: true, mode: "logged_out" };
    },
    async rehydrate() {
      var ident = await fetchIdentity();
      var r = await fetch(bridgeAuthUrl() + "/auth/rehydrate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          session_id: localStorage.getItem("dam_session_id") || "",
          device_id: (ident && ident.device_id) || deviceId(),
          machine_id: (ident && ident.machine_id) || machineId(),
        }),
      });
      var data = await r.json();
      if (data && data.ok && data.token) {
        persistSession(data);
        return data;
      }
      return data || { ok: false, error: "rehydrate_failed" };
    },
    /** Sesja bridge przed zapisem F/X/D, odswiezaniem indeksu itd. */
    async ensureSession() {
      var t = token();
      if (!t || t === "demo-admin-dev-token" || t === "qa") {
        var rh = await this.rehydrate();
        if (rh && rh.ok && rh.token) return rh;
        return { ok: false, error: "login_required" };
      }
      try {
        var ident = await fetchIdentity();
        var url =
          bridgeAuthUrl() +
          "/auth/me?device_id=" +
          encodeURIComponent((ident && ident.device_id) || deviceId()) +
          "&machine_id=" +
          encodeURIComponent((ident && ident.machine_id) || machineId());
        var r = await fetch(url, { headers: authHeaders() });
        var data = await r.json();
        if (data && data.ok && data.user) {
          persistSession({
            token: t,
            device_id: data.device_id,
            machine_id: data.machine_id,
            session_id: data.session_id,
            user: data.user,
          });
          return { ok: true, user: data.user, token: t };
        }
        if (
          data &&
          (data.error === "invalid_session" ||
            data.error === "no_token" ||
            data.error === "login_required")
        ) {
          var rh2 = await this.rehydrate();
          if (rh2 && rh2.ok && rh2.token) return rh2;
          return { ok: false, error: data.error || "login_required" };
        }
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        /* Offline: zostaw lokalny token jesli jest */
        return { ok: true, token: t, offline: true };
      }
      return { ok: true, token: t };
    },
    async me() {
      try {
        var ident = await fetchIdentity();
        var storedMid = localStorage.getItem("dam_machine_id") || "";
        if (
          storedMid &&
          ident.machine_id &&
          storedMid !== ident.machine_id
        ) {
          clearLocalAuth();
          location.href = "signin.html";
          throw new Error("machine_mismatch");
        }
        var url =
          bridgeAuthUrl() +
          "/auth/me?device_id=" +
          encodeURIComponent((ident && ident.device_id) || deviceId()) +
          "&machine_id=" +
          encodeURIComponent((ident && ident.machine_id) || machineId());
        var r = await fetch(url, { headers: authHeaders() });
        var data = await r.json();
        if (data && (data.error === "machine_mismatch" || data.error === "device_mismatch")) {
          clearLocalAuth();
          location.href = "signin.html";
          throw new Error(data.error);
        }
        if (data && data.ok && data.user) {
          persistSession({
            token: token(),
            device_id: data.device_id,
            machine_id: data.machine_id,
            session_id: data.session_id,
            user: data.user,
          });
          return { data: data.user, source: "bridge" };
        }
        /* Token wygasl / "qa" / stary localStorage: odswiez z bound-session (bez hasla). */
        if (
          data &&
          (data.error === "invalid_session" ||
            data.error === "no_token" ||
            data.error === "login_required")
        ) {
          var rh = await this.rehydrate();
          if (rh && rh.ok && rh.user) {
            return { data: rh.user, source: "bridge-rehydrate" };
          }
          clearLocalAuth();
          location.href = "signin.html?reason=session_expired";
          throw new Error("session_expired");
        }
      } catch (e) {
        if (e && /mismatch|session_expired/.test(String(e.message || e))) throw e;
      }
      try {
        return await parse(await apiFetch(API + "/auth/me", { headers: authHeaders() }));
      } catch (e2) {
        if (!isNetworkError(e2)) throw e2;
        this.offline = true;
        /* Offline: NIE udawaj zalogowania samym profiliem bez tokena. */
        var tok = token();
        if (!tok || tok === "demo-admin-dev-token" || tok === "qa") {
          clearLocalAuth();
          location.href = "signin.html?reason=offline_no_session";
          throw new Error("offline_no_session");
        }
        var u = {};
        try { u = JSON.parse(localStorage.getItem("dam_user") || "{}"); } catch (e3) { u = {}; }
        return {
          data: {
            name: localStorage.getItem("dam_user_name") || "",
            role: localStorage.getItem("dam_role") || "",
            email: u.email || "",
          },
          source: "offline-cache",
        };
      }
    },
    async projects() {
      // Metadane ZAWSZE z lokalnej bazy (file-index). Pliki = ROOT usera.
      try {
        var rows = await localProjects();
        return { data: rows, source: "file-index", count: rows.length };
      } catch (localErr) {
        try {
          return await parse(await apiFetch(API + "/projects", { headers: authHeaders() }));
        } catch (e) {
          throw localErr instanceof Error ? localErr : new Error(String(localErr));
        }
      }
    },
    async project(id) {
      try {
        return await parse(await apiFetch(API + "/projects/" + id, { headers: authHeaders() }));
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        this.offline = true;
        var row = await localProjectById(id);
        if (!row) throw new Error("Brak projektu w file-index: " + id);
        return { data: row, source: "file-index" };
      }
    },
    async completeness(variantId) {
      try {
        return await parse(await apiFetch(API + "/variants/" + variantId + "/completeness", { headers: authHeaders() }));
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        this.offline = true;
        var v = await localVariantById(variantId);
        return v.checklist_status;
      }
    },
    async recompute(variantId) {
      try {
        return await parse(await apiFetch(API + "/variants/" + variantId + "/completeness/recompute", {
          method: "POST",
          headers: authHeaders(),
        }));
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        this.offline = true;
        var st = (await localVariantById(variantId)).checklist_status;
        offlineQueuePush({ action: "recompute", variant: variantId });
        return { status: st.status, missing_roles: st.missing_roles, mode: "offline" };
      }
    },
    async ingestPointers(index) {
      try {
        return await parse(await apiFetch(API + "/ingest/pointers", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ index: index || null }),
        }));
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        this.offline = true;
        _indexPromise = null;
        _projectsCache = null;
        var pack = await loadFileIndex();
        offlineQueuePush({ action: "ingest_pointers" });
        return {
          data: {
            projects: pack.projects.length,
            assets: pack.projects.reduce(function (n, p) {
              return n + ((p.variants && p.variants[0] && p.variants[0].assets) || []).length;
            }, 0),
            viz: (pack.index && pack.index.viz_count) || 0,
          },
          mode: "offline",
          source: "file-index",
        };
      }
    },
    async notifyIntegrations(variantId) {
      try {
        return await parse(await apiFetch(API + "/variants/" + variantId + "/integrations/notify", {
          method: "POST",
          headers: authHeaders(),
        }));
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        this.offline = true;
        offlineQueuePush({ action: "notify_integrations", variant: variantId });
        return { message: "Zakolejkowano powiadomienie (Asana + Teams) - wysylka po polaczeniu z API", mode: "offline" };
      }
    },
    async authSettings() {
      try {
        return await parse(await apiFetch(API + "/auth/settings", { headers: authHeaders() }));
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        this.offline = true;
        return { data: { providers: ["local"], mode: "offline" } };
      }
    },
  };
})();
