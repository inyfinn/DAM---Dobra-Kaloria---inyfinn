(function (w) {
  "use strict";
  function inferBridgeUrl() {
    try {
      if (w.__DAM_BRIDGE__) return String(w.__DAM_BRIDGE__).replace(/\/+$/, "");
      if (w.__DAM_API_BASE__) {
        var base = String(w.__DAM_API_BASE__).replace(/\/api\/?$/i, "").replace(/\/+$/, "");
        if (base) return base;
      }
      if (typeof location !== "undefined" && location.hostname && location.protocol !== "file:") {
        var port = location.port ? parseInt(location.port, 10) : NaN;
        if (!port || isNaN(port)) {
          port = location.protocol === "https:" ? 443 : 80;
        }
        var bridgePort = port === 8765 ? 8766 : port === 8766 ? 8766 : port + 1;
        return location.protocol + "//" + location.hostname + ":" + bridgePort;
      }
    } catch (_inferBridge) {
      /* ignore */
    }
    return "http://127.0.0.1:8766";
  }
  function inferUiOrigin() {
    try {
      if (typeof location !== "undefined" && location.origin && location.protocol !== "file:") {
        return String(location.origin).replace(/\/+$/, "");
      }
    } catch (_inferUi) {
      /* ignore */
    }
    return "http://127.0.0.1:8765";
  }
  w.DamBridgeUrl = w.DamBridgeUrl || { resolve: inferBridgeUrl, uiOrigin: inferUiOrigin };
})(typeof window !== "undefined" ? window : globalThis);

(function () {
  "use strict";
  var API =
    window.DAM_API_BASE ||
    (window.DamBridgeUrl && window.DamBridgeUrl.resolve
      ? window.DamBridgeUrl.resolve().replace(/\/$/, "") + "/api"
      : "http://127.0.0.1:8000/api");
  var API_TIMEOUT_MS = 2500;
  var INDEX_URL = "data/file-index.json";

  /* ------------------------------------------------------------------ */
  /* Lokalna baza plikow (w repo)                                        */
  /* Struktura katalogow jest zawsze ta sama; prefix ścieżki (D:/ P:/)   */
  /* tylko odblokowuje otwieranie plikow. Metadane = file-index.json.    */
  /* ------------------------------------------------------------------ */

  var _indexPromise = null;
  var _projectsCache = null;

  function fileExt(name) {
    var m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  function digitsOnly(s) {
    return String(s || "").replace(/\D/g, "");
  }

  /** Wszystkie aktywne warianty (osobny indeks = osobna rewizja), nie jedna scalona checklista. */
  function listLatestRevisionsByIndex(product) {
    var revs = (product && product.revisions) || [];
    if (!revs.length) return [];
    var byIndex = {};
    revs.forEach(function (r) {
      if (!r || !r.index) return;
      if (r.in_archive) return;
      var key = String(r.index);
      var cur = byIndex[key];
      if (!cur) {
        byIndex[key] = r;
        return;
      }
      if (r.is_latest && !cur.is_latest) {
        byIndex[key] = r;
        return;
      }
      if (r.is_latest && cur.is_latest) {
        var dd = String(r.date || "").localeCompare(String(cur.date || ""));
        if (dd > 0) byIndex[key] = r;
      }
    });
    return Object.keys(byIndex)
      .sort(function (a, b) {
        var ibA =
          parseInt(String(byIndex[a].index_base || digitsOnly(a) || "0"), 10) || 0;
        var ibB =
          parseInt(String(byIndex[b].index_base || digitsOnly(b) || "0"), 10) || 0;
        if (ibB !== ibA) return ibB - ibA;
        return String(b).localeCompare(String(a));
      })
      .map(function (k) {
        return byIndex[k];
      });
  }

  function pickLatestRevision(product, queryOpt) {
    var revs = (product && product.revisions) || [];
    if (!revs.length) return null;
    /* Wiele is_latest (np. KAR6X 6300783 + MINI 6300782) - nie sortuj tylko po dacie folderu. */
    var candidates = [];
    for (var i = 0; i < revs.length; i++) {
      if (revs[i] && revs[i].is_latest) candidates.push(revs[i]);
    }
    if (!candidates.length) candidates = revs.slice();
    var qDig = "";
    if (queryOpt) {
      if (window.DamSearch && typeof window.DamSearch.digitsOnly === "function") {
        qDig = window.DamSearch.digitsOnly(queryOpt);
      } else {
        qDig = String(queryOpt).replace(/\D/g, "");
      }
    }
    candidates.sort(function (a, b) {
      if (qDig && qDig.length >= 3) {
        var da = String((a && a.index) || "").replace(/\D/g, "");
        var db = String((b && b.index) || "").replace(/\D/g, "");
        var ma = da.indexOf(qDig) === 0 || qDig.indexOf(da) === 0;
        var mb = db.indexOf(qDig) === 0 || qDig.indexOf(db) === 0;
        if (ma && !mb) return -1;
        if (mb && !ma) return 1;
      }
      var ibA =
        parseInt(String((a && a.index_base) || String((a && a.index) || "").replace(/\D/g, "") || "0"), 10) ||
        0;
      var ibB =
        parseInt(String((b && b.index_base) || String((b && b.index) || "").replace(/\D/g, "") || "0"), 10) ||
        0;
      if (ibB !== ibA) return ibB - ibA;
      var vizA =
        (((a && a.files_by_role) && a.files_by_role.viz) || []).length +
        (((a && a.wizki) || []).length);
      var vizB =
        (((b && b.files_by_role) && b.files_by_role.viz) || []).length +
        (((b && b.wizki) || []).length);
      if (vizB !== vizA) return vizB - vizA;
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

  function filePathBlob(f) {
    if (!f) return "";
    if (typeof f === "string") return f;
    return String(f.path || f.folder || f.rel || f.name || "");
  }

  /** Gotowe ELEMENTY/skladniki — NEVER Adobe Links, NEVER empty slot name. */
  function isReadyElementsFile(f) {
    var pa = filePathBlob(f).replace(/\//g, "\\").toUpperCase();
    var ready =
      pa.indexOf("\\ELEMENTY\\") >= 0 ||
      pa.indexOf("\\ELEMENTS\\") >= 0 ||
      pa.indexOf("\\SKLADNIKI\\") >= 0 ||
      pa.indexOf("\\SKŁADNIKI\\") >= 0 ||
      pa.indexOf("\\INGREDIENTS\\") >= 0 ||
      /\\ELEMENTY$/i.test(pa);
    if (!ready) return false;
    if ((pa.indexOf("\\LINKS\\") >= 0 || pa.indexOf("\\LINKI\\") >= 0) &&
        pa.indexOf("\\ELEMENTY\\") < 0 && pa.indexOf("\\ELEMENTS\\") < 0) {
      return false;
    }
    return true;
  }

  function isArtworkName(name) {
    var e = fileExtName(name);
    return e === "ai" || e === "psd" || e === "indd";
  }

  function isPreviewName(name) {
    var u = String(name || "").toUpperCase();
    var e = fileExtName(name);
    if (/\bPREV\b/.test(u)) return true;
    if (e === "pdf" && /PODGLAD|PODGLĄD/.test(u)) return true;
    if (/[-_]F([-_.]|$)/.test(u) && !/FQ/.test(u)) return true;
    return false;
  }

  function isPrintName(name) {
    var e = fileExtName(name);
    var u = String(name || "").toUpperCase();
    if (isArchiveName(name)) return true;
    return /FQ/.test(u) && (e === "pdf" || e === "ai");
  }

  var _extrasMap = null;
  var _extrasPromise = null;

  function extrasDigits(index) {
    var d = String(index || "").replace(/\D/g, "");
    return d.length >= 7 ? d.slice(0, 7) : "";
  }

  function extrasForIndex(index) {
    var d = extrasDigits(index);
    if (!d || !_extrasMap) return null;
    return _extrasMap[d] || null;
  }

  function loadChecklistExtras() {
    if (_extrasMap) return Promise.resolve(_extrasMap);
    if (_extrasPromise) return _extrasPromise;
    var url = bridgeAuthUrl().replace(/\/$/, "") + "/checklist-extras";
    _extrasPromise = fetch(url, { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        _extrasMap = (data && data.by_index) || {};
        return _extrasMap;
      })
      .catch(function () {
        _extrasMap = {};
        return _extrasMap;
      });
    return _extrasPromise;
  }

  function mergeSlimChecklist(rev, roles) {
    var slim = rev && rev.checklist;
    if (!slim || !roles) return roles;
    /* Fill gaps from slim bridge checklist (karta / OK.pdf). Promote tech when
       slim.tech is true: slim is built from is_ready_elements_path, never from an
       empty ELEMENTY folder name. Leaving tech false caused BRAK on first paint. */
    ["artwork", "prev", "print_pdf", "viz_3d", "tech", "marketing", "karta", "presentation"].forEach(function (k) {
      if (slim[k] === true) roles[k] = true;
    });
    return roles;
  }

  /** Mapowanie rol z indeksu dysku -> checklista DAM (szersza, jak Eksplorator) */
  function rolesFromRevision(rev, product, opts) {
    opts = opts || {};
    var fbr = (rev && rev.files_by_role) || {};
    var src = fbr.source || [];
    var prt = fbr.print || [];
    var viz = (fbr.viz || []).filter(function (f) { return isVizImageName(f.name); });
    var wizki = ((rev && rev.wizki) || []).filter(function (f) { return isVizImageName(f.name); });
    var readyElements = (fbr.elements || []).filter(isReadyElementsFile);
    var archivePrint = []
      .concat(fbr.viz || [])
      .concat((rev && rev.wizki) || [])
      .filter(function (f) {
        return isArchiveName(f.name);
      });

    var hasArtwork = src.some(function (f) { return isArtworkName(f.name); });
    var hasPrev = src.some(function (f) { return isPreviewName(f.name); });
    var hasViz = viz.length > 0 || wizki.length > 0;
    var hasPrint =
      prt.length > 0 ||
      archivePrint.length > 0 ||
      src.some(function (f) { return isPrintName(f.name); });

    /* HARD: empty ELEMENTY folder / Links-only = red. Slot name is not evidence. */
    var hasTech = readyElements.length > 0;
    if (!hasTech && rev) {
      try {
        var elLinks = JSON.parse(localStorage.getItem("dam_elements_links") || "{}");
        var map = (elLinks && elLinks.links) || {};
        var rk = String(rev.path || "").replace(/\\/g, "/").replace(/\/+$/, "");
        var idx = String(rev.index || "").trim();
        var hit = (rk && map[rk]) || (idx && map[idx]) || null;
        if (hit && (Number(hit.file_count) > 0 || (hit.path && isReadyElementsFile(hit)))) {
          hasTech = true;
        }
      } catch (e) { /* ignore */ }
    }

    var hasMarketing = false;
    if (opts.marketingAssets && opts.marketingAssets.length) {
      hasMarketing = true;
    } else if (((product && product.related_materials) || []).some(function (m) {
      return m && m.file_count > 0;
    })) {
      hasMarketing = true;
    } else if (window.DamProductCorrelation && product && product.id) {
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

    var extra = extrasForIndex((rev && rev.index) || (product && (product.indexes || [])[0]) || "");
    if (extra) {
      if (extra.karta) hasKarta = true;
      /* *- OK.pdf in Projekty wstępne maps to existing presentation slot (finished art). */
      if (extra.presentation) hasPresentation = true;
    }

    var roles = {
      artwork: !!hasArtwork,
      prev: !!hasPrev,
      viz_3d: !!hasViz,
      print_pdf: !!hasPrint,
      tech: !!hasTech,
      marketing: !!hasMarketing,
      karta: !!hasKarta,
      presentation: !!hasPresentation,
    };
    return mergeSlimChecklist(rev, roles);
  }

  function firstFilePath(files, preferExt) {
    if (!files || !files.length) return "";
    var want = String(preferExt || "").toLowerCase();
    if (want) {
      for (var j = 0; j < files.length; j++) {
        var fj = files[j];
        if (fj && (fj.path || fj.folder) && fileExtName(fj.name) === want) return fj.path || fj.folder || "";
      }
    }
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f && (f.path || f.folder)) return f.path || f.folder || "";
    }
    return "";
  }

  function rolePathsFromRevision(rev, product) {
    var fbr = (rev && rev.files_by_role) || {};
    var base = (rev && rev.path) || (product && product.path) || "";
    var slimPaths = (rev && rev.checklist_paths) || {};
    var vizFiles = (fbr.viz || []).concat((rev && rev.wizki) || []);
    var extra = extrasForIndex((rev && rev.index) || (product && (product.indexes || [])[0]) || "");
    var srcFiles = fbr.source || [];
    var printFiles = fbr.print || [];
    var podgladPdf = srcFiles.concat(printFiles).filter(function (f) {
      var u = String((f && f.name) || "").toUpperCase();
      return fileExtName(f && f.name) === "pdf" && /PODGLAD|PODGLĄD/.test(u);
    });
    var paths = {
      artwork: firstFilePath(srcFiles.filter(function (f) { return isArtworkName(f.name); })) || slimPaths.artwork || base,
      prev: firstFilePath(podgladPdf) ||
        firstFilePath(srcFiles.filter(function (f) { return isPreviewName(f.name); }), "pdf") ||
        slimPaths.prev || base,
      viz_3d: firstFilePath(vizFiles) || slimPaths.viz_3d || base,
      print_pdf: firstFilePath(printFiles, "pdf") ||
        firstFilePath(srcFiles.filter(function (f) { return isPrintName(f.name); }), "pdf") ||
        slimPaths.print_pdf || base,
      tech: firstFilePath((fbr.elements || []).filter(isReadyElementsFile)) || slimPaths.tech || "",
      marketing: firstFilePath((product && product.related_materials) || []) || slimPaths.marketing || base,
      karta: firstFilePath(fbr.karty_wprowadzenia) || (extra && extra.karta) || slimPaths.karta || "",
      presentation: firstFilePath(fbr.strategia) || (extra && extra.presentation) || slimPaths.presentation || "",
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

  function buildVariantEntry(product, rev) {
    var roles = rolesFromRevision(rev, product);
    var rolePaths = rolePathsFromRevision(rev, product);
    var missing = [];
    ["artwork", "viz_3d", "print_pdf"].forEach(function (r) {
      if (!roles[r]) missing.push(r);
    });
    var status = missing.length ? "incomplete" : "complete";
    return {
      id: product.id + "::" + (rev && rev.index ? rev.index : "0"),
      revision_index: (rev && rev.index) || "",
      carrier: (rev && rev.carrier) || product.carrier || "",
      folder: (rev && rev.folder) || "",
      path: (rev && rev.path) || product.path || "",
      langs: ((rev && rev.langs) || []).slice(),
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
    };
  }

  function productToProject(product, seq) {
    var revs = listLatestRevisionsByIndex(product);
    if (!revs.length) {
      var single = pickLatestRevision(product);
      if (single) revs = [single];
    }
    var rev = revs[0] || pickLatestRevision(product);
    var roles = rolesFromRevision(rev, product);
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
    var indexes = revs.map(function (r) {
      return r.index;
    });
    if (!indexes.length && index) indexes = [index];
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
      indexes: indexes,
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
      variant_count: revs.length || 1,
      variants: revs.length ? revs.map(function (r) { return buildVariantEntry(product, r); }) : [
        buildVariantEntry(product, rev),
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
        try {
          window._DAM_FILE_INDEX = data;
        } catch (eShareIdx) {
          /* ignore */
        }
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
    if (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function") {
      return window.DamPaths.bridgeUrl();
    }
    if (window.DamBridgeUrl && typeof window.DamBridgeUrl.resolve === "function") {
      return window.DamBridgeUrl.resolve();
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
      // Sesja urządzeńia: nie kasuj tokenu automatycznie przy chwilowym 401 API Laravel.
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
    listVariantRevisions: listLatestRevisionsByIndex,
    revisionRoles: rolesFromRevision,
    revisionRolePaths: rolePathsFromRevision,
    loadChecklistExtras: loadChecklistExtras,
    extrasForIndex: extrasForIndex,
    isReadyElementsFile: isReadyElementsFile,
    isPreviewName: isPreviewName,
    rawProductById: function (id) {
      var data = window._DAM_FILE_INDEX;
      if (!data || !data.products) return null;
      var key = String(id || "");
      for (var i = 0; i < data.products.length; i++) {
        if (String(data.products[i].id) === key) return data.products[i];
      }
      return null;
    },
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
      // Lokalna baza kont (bridge) - bcrypt + machine_id / session_id
      // Laravel fallback tylko gdy jawnie wlaczony (inaczej Failed to fetch myli usera).
      try {
        if (window.DamRuntime && typeof window.DamRuntime.ensureServices === "function") {
          await window.DamRuntime.ensureServices({ skipEnsure: false });
        }
      } catch (eEnsure) { /* ignore */ }
      var bridgeErr = null;
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
        if (bdata && bdata.error === "password_change_required") {
          var pcr = new Error("To haslo jest za slabe. Ustaw nowe haslo, zeby sie zalogowac.");
          pcr.code = "password_change_required";
          throw pcr;
        }
        if (bdata && bdata.error === "too_many_attempts") {
          var tma = new Error("Za duzo nieudanych prob. Odczekaj 5 minut.");
          tma.code = "too_many_attempts";
          throw tma;
        }
        if (bdata && bdata.error) {
          throw new Error(String(bdata.error));
        }
      } catch (e) {
        if (e && (e.code || (e.message && /Nieprawidlowy|Brak ID/.test(e.message)))) throw e;
        bridgeErr = e;
      }
      if (window.DAM_LARAVEL_AUTH) {
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
      }
      throw new Error(
        "Most DAM niedostepny (port 8766). Uruchom URUCHOM-DAM.bat / skrot pulpitu." +
          (bridgeErr && bridgeErr.message ? " (" + bridgeErr.message + ")" : "")
      );
    },
    async register(email, password, name) {
      try {
        if (window.DamRuntime && typeof window.DamRuntime.ensureServices === "function") {
          await window.DamRuntime.ensureServices({ skipEnsure: false });
        }
      } catch (eEnsure) { /* ignore */ }
      var t = token();
      var headers = { "Content-Type": "application/json", Accept: "application/json" };
      if (t) headers.Authorization = "Bearer " + t;
      var sid = localStorage.getItem("dam_session_id") || "";
      var did = deviceId();
      var mid = machineId();
      if (sid) headers["X-Dam-Session-Id"] = sid;
      if (did) headers["X-Dam-Device-Id"] = did;
      if (mid) headers["X-Dam-Machine-Id"] = mid;
      var r = await fetch(bridgeAuthUrl() + "/auth/register", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ email: email, password: password, name: name || "" }),
      });
      var data = await r.json().catch(function () { return null; });
      if (!data || !data.ok) {
        var err = (data && data.error) || "register_failed";
        if (err === "email_taken") throw new Error("Konto z tym emailem juz istnieje.");
        if (err === "password_too_short") throw new Error("Haslo musi miec co najmniej 10 znakow.");
        if (err === "password_too_weak") throw new Error("To haslo jest zbyt oczywiste. Wybierz inne.");
        if (err === "invalid_email") throw new Error("Podaj poprawny email.");
        if (err === "admin_required") {
          throw new Error((data && data.hint) || "Nowe konta zaklada tylko administrator.");
        }
        if (err === "database_unavailable") {
          throw new Error("Brak polaczenia z baza. Sprawdz most DAM i siec do Synology.");
        }
        throw new Error((data && data.hint) || "Nie udalo sie utworzyc konta.");
      }
      if (t) return data;
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
    async changePassword(email, oldPassword, newPassword) {
      var r = await fetch(bridgeAuthUrl() + "/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email, old_password: oldPassword, new_password: newPassword }),
      });
      var data = await r.json().catch(function () { return null; });
      if (data && data.ok) return data;
      var err = (data && data.error) || "change_failed";
      if (err === "password_too_short") throw new Error("Nowe haslo musi miec co najmniej 10 znakow.");
      if (err === "password_too_weak") throw new Error("To haslo jest zbyt oczywiste. Wybierz inne.");
      if (err === "password_unchanged") throw new Error("Nowe haslo musi byc inne niz stare.");
      if (err === "invalid_credentials") throw new Error("Stare haslo jest nieprawidlowe.");
      if (err === "too_many_attempts") throw new Error("Za duzo nieudanych prob. Odczekaj 5 minut.");
      throw new Error("Nie udalo sie zmienic hasla.");
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
    /** Sesja bridge przed zapisem F/X/D, odświeżaniem indeksu itd. */
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
        /* Token wygasl / "qa" / stary localStorage: odśwież z bound-session (bez hasla). */
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
