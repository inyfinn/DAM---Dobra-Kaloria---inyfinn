/**
 * DAM ETA - File Explorer v3 (nosniki ludzkie, MIXY, checklista, DK+GC)
 * Wymaga: dam-labels.js zaladowanego PRZED tym plikiem (window.DamLabels)
 */
(function () {
  "use strict";

  var DL = window.DamLabels;

  function bridgeUrl() {
    if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
      return window.DamRuntime.bridgeUrl();
    }
    if (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function") {
      return window.DamPaths.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  var STATUS_KEY = "dam_product_status";
  var ADMIN_KEY  = "dam_admin_mode";
  var RECENT_KEY = "dam_explorer_recent";
  var VIZ_VIEW_KEY = "dam_viz_view_mode";
  var VIZ_SCALE_KEY = "dam_viz_scale";
  var SHOW_ALL_KEY = "dam_explorer_show_all";

  var state = {
    fileIndex:        null,
    statusStore:      null,
    carrierOverrides: { overrides: {} },
    elementsLinks:    { links: {} },
    adminMode:        false,
    brands:           (window.DamBrandFilter ? window.DamBrandFilter.loadBrands() : { DK: true, GC: true }),
    canonCat:         null,
    product:          null,
    expandedCarriers: {},
    showOlderCarriers:{},
    showAllRevisions: localStorage.getItem(SHOW_ALL_KEY) === "1",
    filter:           "",
    expandedTagGroups:{},
    vizViewMode:      localStorage.getItem(VIZ_VIEW_KEY) || "tiles",
    vizScale:         parseInt(localStorage.getItem(VIZ_SCALE_KEY) || "140", 10) || 140,
    vizBgFilter:      "z-tlem",
    navStack:         [],
    navPos:           -1,
    navSilent:        false
  };

  function navSnapshot() {
    return {
      canonCat: state.canonCat || null,
      productId: state.product && state.product.id ? state.product.id : null
    };
  }

  function navSame(a, b) {
    return !!a && !!b && a.canonCat === b.canonCat && a.productId === b.productId;
  }

  function navPush() {
    if (state.navSilent) return;
    var snap = navSnapshot();
    if (!snap.canonCat && !snap.productId) return;
    var cur = state.navStack[state.navPos];
    if (navSame(cur, snap)) return;
    state.navStack = state.navStack.slice(0, state.navPos + 1);
    state.navStack.push(snap);
    state.navPos = state.navStack.length - 1;
  }

  function navApply(snap) {
    state.navSilent = true;
    state.canonCat = snap.canonCat || null;
    state.product = null;
    if (snap.productId && state.fileIndex) {
      state.product = (state.fileIndex.products || []).find(function (x) {
        return x.id === snap.productId;
      }) || null;
    }
    state.expandedCarriers = {};
    state.showOlderCarriers = {};
    renderAll();
    state.navSilent = false;
  }

  function navGo(delta) {
    var next = state.navPos + delta;
    if (next < 0 || next >= state.navStack.length) return;
    state.navPos = next;
    navApply(state.navStack[next]);
  }

  function panelCanStepUp() {
    return !!(state.product || state.canonCat);
  }

  function panelStepUp() {
    if (state.product) {
      state.product = null;
    } else if (state.canonCat) {
      state.canonCat = null;
    } else {
      return;
    }
    state.expandedCarriers = {};
    state.showOlderCarriers = {};
    navPush();
    renderAll();
  }

  function panelHeadHtml(opts) {
    opts = opts || {};
    var canBack = state.navPos > 0 || panelCanStepUp();
    var canFwd = state.navPos >= 0 && state.navPos < state.navStack.length - 1;
    var icon = opts.icon || "uil-folder";
    var kicker = opts.kicker || "Kategoria";
    var title = opts.title || "";
    var meta = opts.meta || "";
    return (
      '<div class="dam-panel-head">' +
        '<div class="dam-panel-head__nav" role="group" aria-label="Nawigacja panelu">' +
          '<button type="button" class="dam-panel-nav-btn" data-panel-nav="-1"' +
            (canBack ? "" : " disabled") +
            ' aria-label="Wstecz" data-dam-tip="Wstecz">' +
            '<i class="uil uil-arrow-left" aria-hidden="true"></i></button>' +
          '<button type="button" class="dam-panel-nav-btn" data-panel-nav="1"' +
            (canFwd ? "" : " disabled") +
            ' aria-label="Do przodu" data-dam-tip="Do przodu">' +
            '<i class="uil uil-arrow-right" aria-hidden="true"></i></button>' +
        "</div>" +
        '<div class="dam-panel-head__place">' +
          '<span class="dam-panel-head__icon" aria-hidden="true">' +
            '<i class="uil ' + esc(icon) + '"></i></span>' +
          '<div class="dam-panel-head__text">' +
            '<div class="dam-panel-head__kicker">' + esc(kicker) + "</div>" +
            '<h5 class="dam-explorer-panel__title">' + esc(title) + "</h5>" +
            (meta ? '<p class="dam-panel-head__meta">' + esc(meta) + "</p>" : "") +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function bindPanelNav(root) {
    (root || document).querySelectorAll("[data-panel-nav]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled) return;
        var dir = parseInt(btn.getAttribute("data-panel-nav"), 10) || 0;
        if (dir < 0) {
          if (state.navPos > 0) navGo(-1);
          else panelStepUp();
          return;
        }
        navGo(dir);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                              */
  /* ------------------------------------------------------------------ */

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtSize(n) {
    n = Number(n) || 0;
    if (n > 1048576) return (n / 1048576).toFixed(1) + " MB";
    if (n > 1024)    return (n / 1024).toFixed(1) + " KB";
    return n + " B";
  }

  function fmtDate(s) {
    if (!s) return "";
    var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + "." + m[2] + "." + m[1];
    return String(s).slice(0, 10);
  }

  function getProductBrand(p) {
    if (p.brand) return p.brand;
    var rk = String(p.root_key || "");
    if (rk.indexOf("GC") >= 0 || rk.indexOf("EKSPORT") >= 0) return "GC";
    return "DK";
  }

  function isBrandEnabled(p) {
    return !!state.brands[getProductBrand(p)];
  }

  function fileExt(name) {
    return (String(name || "").split(".").pop() || "").toLowerCase();
  }

  function fileIcon(ext) {
    ext = (ext || "").toLowerCase();
    if (ext === "ai")  return "uil uil-vector-square";
    if (ext === "psd" || ext === "indd") return "uil uil-layer-group";
    if (ext === "pdf") return "uil uil-file-alt";
    if (ext === "zip" || ext === "rar" || ext === "7z") return "uil uil-archive";
    if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp" || ext === "tif" || ext === "tiff") return "uil uil-image";
    return "uil uil-file";
  }

  /** ZIP/RAR nigdy nie sa wizualizacja - tylko obrazy w studio / galerii. */
  function isVizImageFile(f) {
    if (DL && typeof DL.isVizImage === "function") return DL.isVizImage(f);
    var e = fileExt((f && f.name) || "");
    return ["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"].indexOf(e) >= 0;
  }

  function isArchiveFile(f) {
    if (DL && typeof DL.isArchive === "function") return DL.isArchive(f);
    var e = fileExt((f && f.name) || "");
    return e === "zip" || e === "rar" || e === "7z";
  }

  function filterVizImageFiles(files) {
    return (files || []).filter(isVizImageFile);
  }

  /** Archiwa z slotu viz (blednie) traktuj jak druk - zwykle Pakiet.zip. */
  function printFilesFromRevision(rev) {
    var fbr = (rev && rev.files_by_role) || {};
    var prt = (fbr.print || []).slice();
    var misplaced = []
      .concat(fbr.viz || [])
      .concat((rev && rev.wizki) || [])
      .filter(isArchiveFile);
    misplaced.forEach(function (f) {
      if (!prt.some(function (p) { return p.path === f.path; })) prt.push(f);
    });
    return prt;
  }

  /* ------------------------------------------------------------------ */
  /* Status store                                                         */
  /* ------------------------------------------------------------------ */

  function loadLocalStatus() {
    try { return JSON.parse(localStorage.getItem(STATUS_KEY) || "{}"); }
    catch (e) { return {}; }
  }

  function saveLocalStatus(data) {
    localStorage.setItem(STATUS_KEY, JSON.stringify(data));
  }

  function mergeStatusStore(fileDefaults) {
    var merged = {
      updated_at: (fileDefaults && fileDefaults.updated_at) || new Date().toISOString(),
      revisions: Object.assign({}, (fileDefaults && fileDefaults.revisions) || {})
    };
    var local = loadLocalStatus();
    if (local.revisions) {
      Object.keys(local.revisions).forEach(function (k) {
        merged.revisions[k] = local.revisions[k];
      });
    }
    if (local.updated_at) merged.updated_at = local.updated_at;
    return merged;
  }

  function revisionStatusKey(rev) {
    return rev ? (rev.path || rev.index || rev.folder || "") : "";
  }

  function getRevisionStatus(rev) {
    var ov = overrideForRev(rev);
    if (ov && ov.status) return ov.status;
    var store = state.statusStore;
    var keys = [revisionStatusKey(rev), rev.index, rev.path, rev.folder].filter(Boolean);
    for (var i = 0; i < keys.length; i++) {
      if (store && store.revisions && store.revisions[keys[i]]) {
        return store.revisions[keys[i]].status;
      }
    }
    if (rev && rev.is_latest) return "aktualne";
    return "starsza";
  }

  function findRevisionByRef(path, index) {
    var revs = (state.product && state.product.revisions) || [];
    var pathKey = path ? normPathKey(path) : "";
    if (pathKey) {
      for (var i = 0; i < revs.length; i++) {
        if (normPathKey(revs[i].path || "") === pathKey) return revs[i];
      }
    }
    if (index) {
      for (var j = 0; j < revs.length; j++) {
        if (revs[j].index === index) return revs[j];
      }
    }
    return null;
  }

  function setRevisionStatus(rev, status) {
    if (!rev || !status) return;
    var key = revisionStatusKey(rev);
    var local = loadLocalStatus();
    if (!local.revisions) local.revisions = {};
    local.revisions[key] = { status: status, note: "" };
    if (rev.index) local.revisions[rev.index] = { status: status, note: "" };
    local.updated_at = new Date().toISOString();
    saveLocalStatus(local);
    state.statusStore = mergeStatusStore(state.statusStore);

    /* Persist do carrier-overrides (JSON + Postgres przez bridge) */
    var ov = overrideForRev(rev) || {};
    var entry = Object.assign({}, ov, {
      status: status,
      carrier: ov.carrier || resolveCarrierCode(rev) || "",
      note: ov.note || ("Status: " + status)
    });
    var pathKey = rev.path || rev.index || key;
    showToast("Zapisuję status…");
    saveCarrierOverride(pathKey, entry).then(function (res) {
      showToast(res && res.offline ? "Zapisano lokalnie (bridge offline)" : "Zapisano w bazie");
      renderAll();
    });
  }

  /** Strict: tylko status=aktualne (bez fallbacku is_latest). */
  function getAktualneRevisions(revisions) {
    return (revisions || []).filter(function (r) {
      return getRevisionStatus(r) === "aktualne";
    });
  }

  /**
   * Karty nosnikow: OFF = tylko aktualne; ON = wszystkie (nieaktualne/starsze).
   * Zwraca null = ukryj karte.
   */
  function pickCarrierDisplay(revisions, showAll) {
    var all = revisions || [];
    if (!all.length) return null;
    var aktualne = getAktualneRevisions(all);
    if (!showAll) {
      if (!aktualne.length) return null;
      return { current: aktualne, older: [] };
    }
    var current = aktualne.length ? aktualne : getCurrentRevisions(all);
    var older = getOlderRevisions(all, current);
    return { current: current, older: older };
  }

  /* ------------------------------------------------------------------ */
  /* Toast / status                                                       */
  /* ------------------------------------------------------------------ */

  function showToast(msg) {
    var el = document.getElementById("damExplorerToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damExplorerToast";
      el.className = "dam-explorer-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.classList.remove("is-visible"); }, 3200);
  }

  function setStatus(msg) {
    var el = document.getElementById("damExplorerStatus");
    if (el) el.textContent = msg || "";
  }

  /* ------------------------------------------------------------------ */
  /* Category helpers                                                     */
  /* ------------------------------------------------------------------ */

  function getCanonicalCategoryList() {
    var products = (state.fileIndex && state.fileIndex.products) || [];
    var map = {};
    var orderMap = {};
    if (DL) {
      DL.CATEGORY_CANON.forEach(function (c, idx) { orderMap[c.id] = idx; });
    }
    products.forEach(function (p) {
      if (!isBrandEnabled(p)) return;
      var cid = DL ? DL.categoryCanonId(p.category) : p.category;
      var ctitle = DL ? DL.categoryTitle(p.category) : p.category;
      if (!map[cid]) map[cid] = { id: cid, title: ctitle, count: 0 };
      map[cid].count++;
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.sort(function (a, b) {
      var oa = (orderMap[a.id] !== undefined ? orderMap[a.id] : 99);
      var ob = (orderMap[b.id] !== undefined ? orderMap[b.id] : 99);
      return oa - ob;
    });
    return list;
  }

  function getProductsForCanonCat() {
    if (!state.canonCat || !state.fileIndex) return [];
    return (state.fileIndex.products || []).filter(function (p) {
      if (!isBrandEnabled(p)) return false;
      var cid = DL ? DL.categoryCanonId(p.category) : p.category;
      return cid === state.canonCat;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Recent products                                                      */
  /* ------------------------------------------------------------------ */

  function getRecentProducts() {
    try {
      var ids = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return ids.map(function (id) {
        return (state.fileIndex && state.fileIndex.products || []).find(function (p) { return p.id === id; });
      }).filter(Boolean);
    } catch (e) { return []; }
  }

  function trackRecentProduct(product) {
    if (!product || !product.id) return;
    try {
      var ids = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      ids = [product.id].concat(ids.filter(function (id) { return id !== product.id; })).slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /* Carrier helpers                                                      */
  /* ------------------------------------------------------------------ */

  function overrideForRev(rev) {
    var ov = (state.carrierOverrides && state.carrierOverrides.overrides) || {};
    if (!rev) return null;
    if (rev.path && ov[rev.path]) return ov[rev.path];
    if (rev.index && ov[rev.index]) return ov[rev.index];
    return null;
  }

  function resolveCarrierCode(rev) {
    var ov = overrideForRev(rev);
    if (ov && ov.carrier) return ov.carrier;
    if (DL && typeof DL.inferCarrierFromRevision === "function") {
      return DL.inferCarrierFromRevision(rev);
    }
    return parseCode(rev && rev.folder);
  }

  function parseCode(folder) {
    return DL ? DL.parseCarrierCode(folder) : folder;
  }

  function carrierLabel(code, folder) {
    if (!DL) return code || headTokenSafe(folder) || "WARIANT";
    var product = state.product || {};
    // DamLabels.carrierLabel ratuje FOLIA/DOY z nazwy folderu; nie doklejaj raw folderu
    return DL.carrierLabel(code, folder, {
      isMix: DL.isMixProduct(product.display_name || product.name, product.tags),
      productName: product.display_name || product.name,
      tags: product.tags,
    });
  }

  function isBogus(folder) {
    return DL ? DL.isBogusRevision(folder) : false;
  }

  function groupRevisionsByCarrier(revisions) {
    var groups = {};
    var order = [];
    (revisions || []).forEach(function (r) {
      if (isBogus(r.folder)) return;
      var code = resolveCarrierCode(r);
      if (!groups[code]) { groups[code] = []; order.push(code); }
      groups[code].push(r);
    });
    // UNKNOWN na koncu
    order.sort(function (a, b) {
      if (a === "UNKNOWN") return 1;
      if (b === "UNKNOWN") return -1;
      return 0;
    });
    return order.map(function (code) { return { code: code, revisions: groups[code] }; });
  }

  function sortRevsByIndex(revs) {
    return revs.slice().sort(function (a, b) {
      var ra = parseFloat(a.index_rev || a.index || 0) || 0;
      var rb = parseFloat(b.index_rev || b.index || 0) || 0;
      if (ra !== rb) return rb - ra;
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  }

  function getCurrentRevisions(revisions) {
    var withStatus = revisions.filter(function (r) { return getRevisionStatus(r) === "aktualne"; });
    if (withStatus.length > 0) return withStatus;
    var latests = revisions.filter(function (r) { return r.is_latest; });
    if (latests.length > 0) {
      var sorted = sortRevsByIndex(latests);
      return [sorted[0]]; // only one by default
    }
    var sorted2 = sortRevsByIndex(revisions);
    return [sorted2[0]];
  }

  function getOlderRevisions(revisions, currentRevs) {
    var curKeys = currentRevs.map(function (r) { return revisionStatusKey(r); });
    return revisions.filter(function (r) {
      return curKeys.indexOf(revisionStatusKey(r)) < 0;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Checklist computation                                                */
  /* ------------------------------------------------------------------ */

  function normPathKey(p) {
    return String(p || "").replace(/\\/g, "/").replace(/\/+$/, "");
  }

  function getElementsLink(rev) {
    var links = (state.elementsLinks && state.elementsLinks.links) || {};
    var byPath = links[normPathKey(rev && rev.path)];
    if (byPath && byPath.path) return byPath;
    var idx = String((rev && rev.index) || "").trim();
    if (idx && links[idx] && links[idx].path) return links[idx];
    return null;
  }

  function elementsOpenPath(rev) {
    var link = getElementsLink(rev);
    if (link) return link.folder || link.path || "";
    var els = (rev && rev.files_by_role && rev.files_by_role.elements) || [];
    if (els[0] && els[0].path) {
      var p = normPathKey(els[0].path);
      var i = p.lastIndexOf("/");
      return i > 0 ? p.slice(0, i) : p;
    }
    return "";
  }

  function computeChecklist(rev, allProductRevisions, product) {
    var fbr = rev.files_by_role || {};
    var src  = fbr.source || [];
    var viz  = filterVizImageFiles(fbr.viz || []);
    var wizki = filterVizImageFiles(rev.wizki || []);

    // AI / edytowalny
    var hasAI = src.some(function (f) {
      var e = fileExt(f.name);
      return e === "ai" || e === "psd" || e === "indd";
    });

    // Podgląd akceptacji (PREV lub F bez FQ)
    var hasPrev = src.some(function (f) {
      if (!DL) return false;
      return DL.fileRole(f.name) === "podgląd";
    }) || src.some(function (f) {
      var u = String(f.name || "").toUpperCase();
      return /\bPREV\b/.test(u) || (/[-_]F([-_.]|$)/.test(u) && !/FQ/.test(u));
    });

    // Pliki do druku (+ ZIP z 3-DRUK / Pakiet nawet gdy lezal w WIZKI)
    var drukFiles = printFilesFromRevision(rev).filter(function (f) { return f && f.name; });
    var hasDruk = drukFiles.length > 0;
    // Also check source for FQ PDF
    if (!hasDruk) {
      hasDruk = src.some(function (f) {
        var u = String(f.name || "").toUpperCase();
        return /FQ/.test(u) && fileExt(f.name) === "pdf";
      });
    }
    var drukarnia = "";
    drukFiles.forEach(function (f) {
      if (!drukarnia && DL) drukarnia = DL.detectDrukarnia(f.name);
    });

    // Wizualizacje = tylko obrazy (nie ZIP)
    var hasViz = viz.length > 0 || wizki.length > 0;

    // Elementy: indeks, slot/path, albo reczne powiazanie (elements-overrides)
    function revisionHasElements(r) {
      if (getElementsLink(r)) return true;
      var elFiles = (r.files_by_role && r.files_by_role.elements) || [];
      if (elFiles.length > 0) return true;
      var slotsR = r.slots || [];
      if (slotsR.some(function (s) {
        var su = String(s).toUpperCase();
        return su.indexOf("ELEMENTY") >= 0 || su.indexOf("ELEMENTS") >= 0 ||
          su.indexOf("SKLADNIKI") >= 0 || su.indexOf("SKŁADNIKI") >= 0 ||
          su.indexOf("INGREDIENTS") >= 0;
      })) return true;
      var allf = ((r.files_by_role && r.files_by_role.source) || [])
        .concat((r.files_by_role && r.files_by_role.print) || [])
        .concat((r.files_by_role && r.files_by_role.viz) || [])
        .concat(elFiles)
        .concat(r.wizki || []);
      return allf.some(function (f) {
        var pa = String(f.path || f.name || "").toUpperCase().replace(/\//g, "\\");
        return pa.indexOf("ELEMENTY") >= 0 || pa.indexOf("ELEMENTS") >= 0 ||
          pa.indexOf("SKLADNIKI") >= 0 || pa.indexOf("INGREDIENTS") >= 0 ||
          String(f.layer || "").toLowerCase() === "elements";
      });
    }
    var link = getElementsLink(rev);
    var hasElements = revisionHasElements(rev);
    var elementsNote = "";
    var elementsLinked = !!(link && link.path);
    var elementsPath = elementsOpenPath(rev);
    if (elementsLinked) {
      hasElements = true;
      elementsNote = link.file_count
        ? ("powiazane: " + link.file_count + " pl.")
        : "powiazane recznie";
    }
    if (!hasElements) {
      var otherRev = null;
      (allProductRevisions || []).forEach(function (or_) {
        if (otherRev || or_ === rev || isBogus(or_.folder)) return;
        if (revisionHasElements(or_)) otherRev = or_;
      });
      if (otherRev) {
        hasElements = true;
        var code2 = parseCode(otherRev.folder);
        var lbl2  = carrierLabel(code2, otherRev.folder);
        elementsNote = "z wariantu " + lbl2 + " (" + (otherRev.index || otherRev.folder) + ")";
        if (!elementsPath) elementsPath = elementsOpenPath(otherRev);
      }
    }

    // Marketing
    var hasMkt = ((product && product.related_materials) || []).some(function (m) { return m.file_count > 0; });

    var fbr2 = rev.files_by_role || {};
    var hasKarta =
      ((fbr2.karty_wprowadzenia || []).length > 0) ||
      src.some(function (f) {
        var u = String(f.name || "").toUpperCase();
        return /KARTA/.test(u) && /WPROWADZ/.test(u);
      });
    var hasPresentation =
      ((fbr2.strategia || []).length > 0) ||
      src.some(function (f) {
        var e = fileExt(f.name);
        var u = String(f.name || "").toUpperCase();
        return (e === "pptx" || e === "ppt" || e === "key") &&
          (/PREZENT|STRATEG|POZYCJON/.test(u));
      });

    return {
      ai: hasAI, prev: hasPrev, druk: hasDruk, drukarnia: drukarnia,
      viz: hasViz, elements: hasElements, elementsNote: elementsNote,
      elementsLinked: elementsLinked, elementsPath: elementsPath,
      revisionPath: normPathKey(rev && rev.path), revisionIndex: (rev && rev.index) || "",
      marketing: hasMkt, karta: hasKarta, presentation: hasPresentation
    };
  }

  /* ------------------------------------------------------------------ */
  /* Viz grouping                                                         */
  /* ------------------------------------------------------------------ */

  function groupVizFiles(vizFiles) {
    var PERSP_ORDER = ["ENFACE", "FRONT", "BACK", "TYL-ENFACE", "BOK", "INNE"];
    var groups = {};
    (vizFiles || []).forEach(function (f) {
      var persp = DL ? DL.vizPerspective(f.name) : "INNE";
      var size  = DL ? DL.vizSize(f.name) : "";
      if (!groups[persp]) groups[persp] = {};
      if (!groups[persp][size]) groups[persp][size] = [];
      groups[persp][size].push(f);
    });
    return PERSP_ORDER.filter(function (p) { return groups[p]; }).map(function (p) {
      return { perspective: p, bySizes: groups[p] };
    });
  }

  function vizBgOf(f) {
    return DL && DL.vizBackground ? DL.vizBackground(f.name) : "z-tlem";
  }

  function vizLangOf(f) {
    return DL && DL.vizLangFromFile ? DL.vizLangFromFile(f) : (f.lang || "pl");
  }

  function pickHeroFile(files) {
    if (!files || !files.length) return null;
    var SIZE_RANK = { XL: 3, L: 4, S: 2, "S-SKLEP": 1, "": 0 };
    var EXT_RANK = { jpg: 5, jpeg: 5, png: 4, webp: 3, tif: 1, tiff: 1 };
    var scored = files.slice().map(function (f) {
      var sz = DL ? DL.vizSize(f.name) : "";
      var ext = fileExt(f.name).toLowerCase();
      return { f: f, score: (SIZE_RANK[sz] || 0) * 10 + (EXT_RANK[ext] || 0) + ((f.size || 0) / 1e9) };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored[0].f;
  }

  function enrichVizFile(f) {
    return {
      file: f,
      persp: DL ? DL.vizPerspective(f.name) : "INNE",
      size: DL ? DL.vizSize(f.name) : "",
      bg: vizBgOf(f),
      lang: vizLangOf(f),
      ext: fileExt(f.name).toUpperCase()
    };
  }

  function buildVizStudioModel(vizFiles) {
    var items = (vizFiles || []).map(enrichVizFile);
    var byBg = { "z-tlem": [], "bez-tla": [] };
    items.forEach(function (it) {
      (byBg[it.bg] || byBg["z-tlem"]).push(it);
    });
    var PERSP_ORDER = ["ENFACE", "FRONT", "BACK", "TYL-ENFACE", "BOK", "INNE"];
    function heroesFor(list) {
      var map = {};
      list.forEach(function (it) {
        if (!map[it.persp]) map[it.persp] = [];
        map[it.persp].push(it.file);
      });
      return PERSP_ORDER.filter(function (p) { return map[p]; }).map(function (p) {
        return { perspective: p, hero: pickHeroFile(map[p]), files: map[p], count: map[p].length };
      });
    }
    var langs = {};
    items.forEach(function (it) { langs[it.lang] = true; });
    return {
      items: items,
      heroesZ: heroesFor(byBg["z-tlem"]),
      heroesBez: heroesFor(byBg["bez-tla"]),
      langs: Object.keys(langs).sort(),
      counts: { "z-tlem": byBg["z-tlem"].length, "bez-tla": byBg["bez-tla"].length }
    };
  }

  /* ------------------------------------------------------------------ */
  /* HTML builders                                                        */
  /* ------------------------------------------------------------------ */

  function renderIndexChips(indexes) {
    return (indexes || []).slice(0, 5).map(function (idx) {
      return '<span class="dam-index-chip dam-viz-badge dam-viz-badge--index" title="Indeks produktu">' + esc(idx) + "</span>";
    }).join("");
  }

  function categoryTitleOf(productOrCat) {
    var raw = typeof productOrCat === "string"
      ? productOrCat
      : (productOrCat && (productOrCat.category || productOrCat.canon_category)) || "";
    if (!raw && state.canonCat) raw = state.canonCat;
    if (!raw) return "";
    if (DL && typeof DL.categoryTitle === "function") return DL.categoryTitle(raw) || "";
    return String(raw).replace(/^\s*\d+\s*[-–—]\s*/u, "").trim();
  }

  function productDisplayTitle(product) {
    var name = DL
      ? DL.cleanProductDisplayName(product.display_name || product.name || "")
      : (product.display_name || product.name || "");
    var cat = categoryTitleOf(product);
    if (cat && name) return cat + " · " + name;
    return name || cat || "Produkt";
  }

  function statusBadge(status, rev) {
    var st = status || "starsza";
    var mod =
      st === "aktualne" ? "aktualne" :
      st === "nieaktualne" ? "nieaktualne" : "starsza";
    var label =
      mod === "aktualne" ? "Aktualne" :
      mod === "nieaktualne" ? "Nieaktualne" : "Starsza";
    var tip = "Status wariantu. Admin + Shift+klik: wybierz Aktualne / Nieaktualne z listy (zapis do bazy).";
    var path = (rev && rev.path) || "";
    var idx = (rev && rev.index) || "";
    return (
      '<button type="button" class="dam-status-badge dam-status-badge--' + mod +
      ' dam-badge-tag dam-tag-editable" data-tag-kind="status" data-tag-value="' + esc(st) +
      '" data-revision-path="' + esc(path) + '" data-revision-index="' + esc(idx) +
      '" data-dam-tip="' + esc(tip) + '" aria-label="' + esc(label) + '">' +
      esc(label) +
      "</button>"
    );
  }

  function pathActions(path) {
    if (window.DamPaths && typeof window.DamPaths.pathActionsHtml === "function") {
      return window.DamPaths.pathActionsHtml(path);
    }
    return '<button type="button" class="dam-file-copy" data-path="' + esc(path) + '" title="Kopiuj ścieżkę"><i class="uil uil-copy" aria-hidden="true"></i></button>';
  }

  function renderFileRow(f, role) {
    var ext = fileExt(f.name);
    return '<div class="dam-file-row dam-file-role--' + esc(role || "other") + '">' +
      '<i class="' + fileIcon(ext) + ' dam-file-row__icon" aria-hidden="true"></i>' +
      '<div class="dam-file-row__body">' +
        '<div class="dam-file-row__name">' + esc(f.name) + "</div>" +
        '<div class="dam-file-row__meta">' +
          esc(ext.toUpperCase()) + " " + fmtSize(f.size) +
          (f.lang ? " " + esc(String(f.lang).toUpperCase()) : "") +
          (f.mtime ? " " + fmtDate(f.mtime) : "") +
        "</div></div>" +
      pathActions(f.path) +
    "</div>";
  }

  function renderFileSection(title, files, role) {
    if (!files || !files.length) return "";
    return '<div class="dam-file-layer" data-check-section="' + esc(role || "other") + '">' +
      '<div class="dam-file-layer__title">' + esc(title) + "</div>" +
      files.map(function (f) { return renderFileRow(f, role); }).join("") +
    "</div>";
  }

  function renderChecklist(cl, rev, product) {
    var pathEsc = String((rev && rev.path) || "").replace(/"/g, "&quot;");
    var winIcon =
      window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';

    function row(ok, label, detail, scrollSection, winPath, extraActionsHtml) {
      var cls = ok ? "dam-check-ok" : "dam-check-brak";
      var icon = ok ? "uil-check-circle" : "uil-times-circle";
      var actionsHtml = extraActionsHtml || "";
      if (ok) {
        var goPath = String(winPath || (rev && rev.path) || "").replace(/"/g, "&quot;");
        var scrollAttr = scrollSection
          ? ' data-scroll-section="' + esc(scrollSection) + '"'
          : "";
        actionsHtml =
          '<span class="dam-check-row__actions" hidden>' +
          '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-check-go dam-check-scroll"' +
          scrollAttr +
          ' title="Przewiń do plików" data-dam-tip="Przewiń do sekcji plików tego materiału w tym wariancie">' +
          '<i class="uil uil-arrow-down" aria-hidden="true"></i><span>Przejdź</span></button>' +
          '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-btn-icon-only dam-win-btn dam-check-win" data-path="' +
          goPath +
          '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwórz folder w Eksploratorze plików Windows (wymaga mostu online)">' +
          winIcon +
          "</button></span>";
      }
      return (
        '<div class="' +
        cls +
        (ok ? " dam-check-row--interactive" : "") +
        '"' +
        (ok ? ' data-path="' + pathEsc + '" tabindex="0" role="button"' : "") +
        ">" +
        '<i class="uil ' +
        icon +
        ' dam-check-icon" aria-hidden="true"></i>' +
        '<span class="dam-check-label">' +
        esc(label) +
        (detail ? ' <span class="dam-check-detail">' + esc(detail) + "</span>" : "") +
        "</span>" +
        actionsHtml +
        "</div>"
      );
    }
    var drukDetail = cl.drukarnia ? "drukarnia: " + cl.drukarnia : "";
    var elemDetail = cl.elementsNote ? cl.elementsNote : (cl.elements ? "" : "BRAK");
    var elemActions =
      '<span class="dam-check-actions">' +
        (cl.elementsPath
          ? '<button type="button" class="dam-check-action" data-elements-open="' + esc(cl.elementsPath) +
            '" title="Otwórz folder Elementy w Eksploratorze" data-dam-tip="Otwórz folder Elementy">' +
            '<i class="uil uil-folder-open" aria-hidden="true"></i></button>'
          : "") +
        '<button type="button" class="dam-check-action" data-elements-link="' + esc(cl.revisionPath || "") +
          '" data-elements-index="' + esc(cl.revisionIndex || "") +
          '" title="Wskaż folder lub pliki Elementy" data-dam-tip="Wskaż folder / pliki Elementy">' +
          '<i class="uil uil-link" aria-hidden="true"></i></button>' +
        (cl.elementsLinked
          ? '<button type="button" class="dam-check-action dam-check-action--danger" data-elements-unlink="' +
            esc(cl.revisionPath || "") + '" data-elements-index="' + esc(cl.revisionIndex || "") +
            '" title="Usuń powiazanie" data-dam-tip="Usuń reczne powiazanie">' +
            '<i class="uil uil-link-broken" aria-hidden="true"></i></button>'
          : "") +
      "</span>";
    return '<div class="dam-checklist dam-card-checklist" aria-label="Kompletność materiałów">' +
      row(cl.ai,       "Plik źródłowy projektu graficznego", "", "source", rev && rev.path) +
      row(cl.prev,     "Podgląd PDF projektu", "", "source", rev && rev.path) +
      row(cl.druk,     "Pliki do druku", drukDetail, "print", rev && rev.path) +
      row(cl.viz,      "Wizualizacje", "", "viz", rev && rev.path) +
      row(cl.elements, "Elementy / składniki", elemDetail, "elements", cl.elementsPath || (rev && rev.path), elemActions) +
      row(cl.marketing,"Materiały marketingowe", "", "marketing", rev && rev.path) +
      row(cl.karta,    "Karta wprowadzenia", "", "source", rev && rev.path) +
      row(!!cl.presentation, "Prezentacja", "", "source", rev && rev.path) +
    "</div>";
  }

  function mediaUrl(indexPath) {
    if (!indexPath) return "";
    var local = window.DamPaths ? window.DamPaths.toLocal(indexPath) : indexPath;
    return bridgeUrl() + "/media?path=" + encodeURIComponent(local);
  }

  function thumbCandidates(f) {
    var name = f.name || "";
    var stem = name.replace(/\.[^.]+$/, "");
    var list = [
      "data/thumbs/" + encodeURIComponent(stem + ".jpg"),
      "data/thumbs/" + encodeURIComponent(name.replace(/\.(png|tif|tiff|webp)$/i, ".jpg"))
    ];
    if (f.path) list.push(mediaUrl(f.path));
    return list;
  }

  function renderVizGroups(vizFiles) {
    var allFiles = filterVizImageFiles(vizFiles || []);
    if (!allFiles.length) return "";
    var model = buildVizStudioModel(allFiles);
    state._vizStudio = model;
    state._lightboxFiles = allFiles;

    var activeBg = state.vizBgFilter || "z-tlem";
    if (activeBg === "z-tlem" && !model.counts["z-tlem"] && model.counts["bez-tla"]) activeBg = "bez-tla";
    if (activeBg === "bez-tla" && !model.counts["bez-tla"] && model.counts["z-tlem"]) activeBg = "z-tlem";
    state.vizBgFilter = activeBg;

    var heroes = activeBg === "bez-tla" ? model.heroesBez : model.heroesZ;
    var html = '<div class="dam-viz-studio" data-viz-root="1" data-check-section="viz" style="--dam-viz-hero:' + Math.max(120, Math.min(280, state.vizScale || 140)) + 'px">' +
      '<div class="dam-viz-bg-tabs" role="tablist" aria-label="Tlo wizualizacji">' +
        '<button type="button" role="tab" class="dam-viz-bg-tab' + (activeBg === "z-tlem" ? " is-active" : "") + '" data-viz-bg="z-tlem" aria-selected="' + (activeBg === "z-tlem") + '">' +
          'Z tlem <span class="dam-viz-bg-tab__n">' + model.counts["z-tlem"] + "</span></button>" +
        '<button type="button" role="tab" class="dam-viz-bg-tab' + (activeBg === "bez-tla" ? " is-active" : "") + '" data-viz-bg="bez-tla" aria-selected="' + (activeBg === "bez-tla") + '">' +
          'Bez tla <span class="dam-viz-bg-tab__n">' + model.counts["bez-tla"] + "</span></button>" +
      "</div>";

    if (!heroes.length) {
      html += '<p class="dam-viz-empty">Brak plików w tej grupie.</p></div>';
      return html;
    }

    html += '<div class="dam-viz-hero-grid">';
    heroes.forEach(function (h) {
      var f = h.hero;
      if (!f) return;
      var cands = thumbCandidates(f);
      var sizes = {};
      h.files.forEach(function (ff) {
        var s = DL ? DL.vizSize(ff.name) : "";
        if (s) sizes[s] = (sizes[s] || 0) + 1;
      });
      var sizeChips = Object.keys(sizes).map(function (s) {
        return '<span class="dam-viz-badge dam-viz-badge--index" title="' + esc(DL ? DL.vizSizeHint(s) : s) + '">' + esc(s) + "</span>";
      }).join(" ");
      var globalIdx = allFiles.indexOf(f);
      html += '<article class="dam-viz-hero" data-persp="' + esc(h.perspective) + '">' +
        '<button type="button" class="dam-viz-hero__open" data-lightbox-idx="' + globalIdx + '" data-dam-tip="Otwórz studio podglądu">' +
          '<span class="dam-viz-hero__frame">' +
            '<img src="' + cands[0] + '" alt="' + esc(h.perspective + " - " + (f.name || "")) + '" ' +
              'data-fallbacks="' + esc(cands.slice(1).join("|")) + '" ' +
              'onerror="window.__damThumbFallback&&window.__damThumbFallback(this)">' +
            '<span class="dam-viz-mini__placeholder" hidden><i class="uil uil-image" aria-hidden="true"></i></span>' +
          "</span>" +
          '<span class="dam-viz-hero__caption">' +
            '<span class="dam-viz-hero__persp">' + esc(h.perspective) + "</span>" +
            '<span class="dam-viz-hero__meta">' + h.count + " plików " + sizeChips + "</span>" +
          "</span>" +
        "</button>" +
        '<div class="dam-viz-hero__actions">' + pathActions(f.path) + "</div>" +
      "</article>";
    });
    html += "</div>" +
      '<p class="dam-viz-hint">Jeden podgląd na widok (najwyzsza jakosc). Kliknij, aby otwórzyc studio: L/S, formaty, zoom, języki.</p>' +
    "</div>";
    return html;
  }

  function renderMarketingSection(materials) {
    var mats = (materials || []).filter(function (m) { return m.title; });
    if (!mats.length) return "";
    var html = '<div class="dam-file-layer" data-check-section="marketing"><div class="dam-file-layer__title">Materiały marketingowe</div>';
    mats.forEach(function (m) {
      html += '<div class="dam-marketing-row">' +
        '<div class="dam-marketing-row__body">' +
          '<div class="dam-marketing-row__title">' + esc(m.title) + "</div>" +
          '<div class="dam-marketing-row__path">' + esc(m.path) + "</div>" +
          '<div class="dam-marketing-row__meta">' + esc(m.type || "marketing") +
            (m.file_count ? " - " + m.file_count + " plików" : "") +
          "</div></div>" +
        pathActions(m.path) +
      "</div>";
    });
    html += '<p class="dam-marketing-hint">Sciezki lokalne po mapowaniu bazy (Ustawienia). Kopiuj lub pokaz w Eksploratorze.</p></div>';
    return html;
  }

  function renderAdminRevButtons(rev, idx) {
    if (!state.adminMode) return "";
    return '<div class="dam-admin-rev-actions">' +
      '<button type="button" class="dam-admin-btn dam-admin-btn--ok dam-admin-control" data-ridx="' + idx + '" data-status="aktualne">Aktualne</button>' +
      '<button type="button" class="dam-admin-btn dam-admin-btn--no dam-admin-control" data-ridx="' + idx + '" data-status="nieaktualne">Nieaktualne</button>' +
    "</div>";
  }

  /* ------------------------------------------------------------------ */
  /* Carrier card                                                         */
  /* ------------------------------------------------------------------ */

  function headTokenSafe(folder) {
    var head = String(folder || "").split(/\s*-\s*/)[0].trim();
    head = head.replace(/_/g, " ").toUpperCase();
    if (!head || /^\d/.test(head)) return "";
    return head;
  }

  function revisionMeta(rev, product) {
    var folder = (rev && rev.folder) || "";
    var path = (rev && rev.path) || "";
    var meta = DL && typeof DL.parseRevisionMeta === "function"
      ? DL.parseRevisionMeta(folder, path)
      : { brand: "", carrier: "", index: "", date: "", label: "" };
    if (!meta.brand && product) meta.brand = getProductBrand(product);
    if (!meta.index && rev && rev.index) meta.index = rev.index;
    if (!meta.date && rev && rev.date) meta.date = rev.date;
    if ((!meta.label || meta.carrier === "UNKNOWN") && folder) {
      meta.label = carrierLabel(meta.carrier || codeFromRev(rev), folder);
    }
    return meta;
  }

  function codeFromRev(rev) {
    if (DL && typeof DL.inferCarrierFromRevision === "function") {
      return DL.inferCarrierFromRevision(rev);
    }
    return DL ? DL.parseCarrierCode((rev && rev.folder) || "") : "UNKNOWN";
  }

  function renderIndexChip(rev, meta) {
    var idx = meta.index || rev.index || "";
    if (!idx) return "";
    if (!state.adminMode) {
      return '<span class="dam-index-chip dam-viz-badge dam-viz-badge--index" title="Indeks produktu">' + esc(idx) + "</span> ";
    }
    return (
      '<span class="dam-index-chip dam-index-chip--admin dam-viz-badge dam-viz-badge--index" ' +
        'data-dam-tip="Tryb admina: edytuj indeks i zastosuj w folderze" title="Tryb admina: edytuj indeks i zastosuj w folderze">' +
        '<input type="text" class="dam-index-edit" value="' +
        esc(idx) +
        '" readonly ' +
        'data-from-index="' +
        esc(idx) +
        '" ' +
        'data-folder="' +
        esc(rev.path || "") +
        '" ' +
        'aria-label="Indeks produktu" />' +
        '<button type="button" class="dam-index-action" data-mode="edit" ' +
        'data-dam-tip="Wlacz edycje indeksu w tym folderze">Edytuj indeks</button>' +
        "</span> "
    );
  }

  function renderCarrierCard(code, currentRevs, olderRevs, product, allProductRevisions) {
    var rev = currentRevs[0]; // primary current revision
    if (!rev) return "";

    var meta = revisionMeta(rev, product);
    var resolvedCode = (code && code !== "UNKNOWN") ? code : (meta.carrier || codeFromRev(rev) || "UNKNOWN");
    var label = carrierLabel(resolvedCode, rev.folder);
    // Nigdy: "Nośnik nieokreslony · FOLIA..." - jeśli jest nosnik, pokaz tylko niego
    if (!label || /^NOSNIK/i.test(label)) {
      label = meta.label || headTokenSafe(rev.folder) || "WARIANT";
    }
    var st = getRevisionStatus(rev);
    var cardId = "dam-carrier-" + esc(resolvedCode);
    var isExpanded = !!state.expandedCarriers[resolvedCode] || !!state.expandedCarriers[code];
    var showOlder = !!state.showOlderCarriers[resolvedCode] || !!state.showOlderCarriers[code];

    // Gather viz images only (ZIP/Pakiet nigdy nie trafia do studia)
    var allViz = [];
    currentRevs.forEach(function (r) {
      allViz = allViz.concat(
        filterVizImageFiles((r.files_by_role && r.files_by_role.viz) || [])
      ).concat(filterVizImageFiles(r.wizki || []));
    });

    var cl = computeChecklist(rev, allProductRevisions, product);

    var revLangs = (rev.langs || []).slice();
    if (!revLangs.length) {
      var langSet = {};
      var fbrL = rev.files_by_role || {};
      ["source", "print", "viz", "elements"].forEach(function (rk) {
        (fbrL[rk] || []).forEach(function (f) {
          if (f && f.lang) langSet[String(f.lang).toLowerCase()] = true;
        });
      });
      (rev.wizki || []).forEach(function (f) {
        if (f && f.lang) langSet[String(f.lang).toLowerCase()] = true;
      });
      revLangs = Object.keys(langSet).sort();
    }

    // Tagi globalne 22px. Label = nazwa (bez duplikatu tagu nosnika). Indeks TYLKO w meta.
    // Toggle = DIV role=button (nested <button> rozrywa DOM i wyrzuca karty z listy).
    var tags = "";
    var hasVisibleLabel = !!(label && !/^NOSNIK/i.test(label));
    if (window.DamBadges && typeof window.DamBadges.render === "function") {
      tags = window.DamBadges.render({
        brand: meta.brand,
        // Nazwa jest w .dam-carrier-toggle__label - nie powtarzaj tego samego w chipach.
        carrier: hasVisibleLabel ? "" : resolvedCode,
        carrierLabel: hasVisibleLabel ? "" : label,
        revisionFullPath: rev.path || "",
        productId: product && product.id,
        productName: product && (product.display_name || product.name || product.title),
        langs: revLangs,
        index: "",
        compact: true,
        overflow: false,
        maxPerKind: 8,
      });
    } else {
      if (meta.brand) {
        tags +=
          '<button type="button" class="dam-viz-badge dam-badge-tag dam-viz-badge--brand dam-tag-editable" data-tag-kind="brand" data-tag-value="' +
          esc(meta.brand) +
          '">' +
          esc(meta.brand) +
          "</button> ";
      }
      revLangs.slice(0, 6).forEach(function (l) {
        var langCode = String(l || "").toLowerCase();
        var short =
          window.DamLabels && typeof window.DamLabels.langShort === "function"
            ? window.DamLabels.langShort(langCode)
            : langCode.toUpperCase();
        if (!short) return;
        tags +=
          '<button type="button" class="dam-viz-badge dam-badge-tag dam-viz-badge--lang dam-tag-editable" data-tag-kind="lang" data-tag-value="' +
          esc(langCode) +
          '">' +
          esc(short) +
          "</button> ";
      });
    }
    // Data w meta (nie w chipach) - chipy zostaja w jednym rzedzie.
    var dateOutside = "";
    if (meta.date || rev.date) {
      dateOutside =
        '<span class="dam-date-chip dam-viz-badge" title="Data folderu">' +
        esc(meta.date || rev.date) +
        "</span>";
    }
    // Indeks: JEDEN raz w meta (readonly span albo admin Edytuj/Zastosuj). Nie w chipach.
    var indexOutside = renderIndexChip(rev, meta);
    var statusOutside = statusBadge(st, rev);

    // Extra current revisions (admin marked multiple)
    var extraCurrHtml = "";
    currentRevs.slice(1).forEach(function (r2, i) {
      var st2 = getRevisionStatus(r2);
      extraCurrHtml += '<div class="dam-carrier-extra-rev">' +
        '<span class="dam-rev-row__folder">' + esc(r2.folder) + "</span> " +
        statusBadge(st2, r2) +
        renderAdminRevButtons(r2, "extra_" + i) +
      "</div>";
    });

    // Older revisions section (widoczne gdy Pokaż wszystko lub lokalny "Pokaz starsze")
    var olderHtml = "";
    if (olderRevs.length > 0) {
      var forceOlder = !!state.showAllRevisions;
      var olderOpen = forceOlder || showOlder;
      olderHtml = '<div class="dam-carrier-older">' +
        (forceOlder
          ? '<div class="dam-show-older-label">Nieaktualne / starsze (' + olderRevs.length + ")</div>"
          : '<button type="button" class="dam-show-older-btn" data-code="' + esc(resolvedCode) + '">' +
              (showOlder ? "Ukryj starsze" : "Pokaz starsze (" + olderRevs.length + ")") +
            "</button>");
      if (olderOpen) {
        olderHtml += '<div class="dam-older-revs">';
        olderRevs.forEach(function (r, ri) {
          var ost = getRevisionStatus(r);
          olderHtml += '<div class="dam-older-rev-row">' +
            '<span class="dam-rev-row__folder">' + esc(r.folder) + "</span> " +
            (r.index ? '<span class="dam-viz-badge dam-viz-badge--index">' + esc(r.index) + "</span> " : "") +
            statusBadge(ost, r) +
            renderAdminRevButtons(r, "older_" + ri) +
          "</div>";
        });
        olderHtml += "</div>";
      }
      olderHtml += "</div>";
    }

    // Full detail (shown when expanded). Przy "Pokaż wszystko" lista starszych jest poza body.
    var detailHtml = "";
    if (isExpanded) {
      var fbr = rev.files_by_role || {};
      detailHtml =
        renderChecklist(cl, rev, product) +
        renderFileSection("Projekt / zrodlo", fbr.source, "source") +
        renderFileSection("Pliki do druku",   printFilesFromRevision(rev),  "print") +
        renderVizGroups(allViz) +
        renderMarketingSection(product.related_materials) +
        extraCurrHtml +
        (state.showAllRevisions ? "" : olderHtml) +
        (state.adminMode ? renderAdminRevButtons(rev, "curr") : "");
    }

    var cardCls =
      "dam-carrier-card" +
      (isExpanded ? " is-expanded" : "") +
      (st === "aktualne" ? " dam-carrier-card--aktualne" : "");

    return (
      '<div class="' + cardCls + '" id="' + cardId + '">' +
        '<div class="dam-carrier-toggle-row">' +
          '<div class="dam-carrier-head">' +
            '<div class="dam-carrier-toggle" role="button" tabindex="0" data-toggle-code="' +
            esc(resolvedCode) +
            '" aria-expanded="' +
            isExpanded +
            '" aria-label="' +
            esc(label) +
            '">' +
              '<div class="dam-carrier-toggle__left">' +
                '<span class="dam-carrier-toggle__label dam-tag-editable" data-tag-kind="carrier" data-tag-value="' +
                esc(resolvedCode) +
                '" data-revision-path="' +
                esc(rev.path || "") +
                '" data-current-code="' +
                esc(resolvedCode) +
                '" data-product-id="' +
                esc((product && product.id) || "") +
                '" data-product-name="' +
                esc((product && (product.display_name || product.name || product.title)) || "") +
                '" data-dam-tip="Nosnik. Klik: filtr. Admin: Shift+klik lub podwojny klik - wybierz z listy.">' +
                esc(label) +
                "</span>" +
                '<div class="dam-carrier-toggle__chips">' +
                tags +
                "</div>" +
              "</div>" +
              '<i class="uil dam-carrier-chevron ' +
              (isExpanded ? "uil-angle-up" : "uil-angle-down") +
              '" aria-hidden="true"></i>' +
            "</div>" +
            '<div class="dam-carrier-head__meta">' +
              statusOutside +
              dateOutside +
              indexOutside +
            "</div>" +
          "</div>" +
          '<div class="dam-carrier-toggle__actions" data-dam-tip="Kopiuj ścieżkę / otwórz folder w Windows">' +
            pathActions(rev.path || "") +
          "</div>" +
        "</div>" +
        (state.showAllRevisions && olderHtml ? olderHtml : "") +
        '<div class="dam-carrier-body"' +
        (isExpanded ? "" : " hidden") +
        ">" +
        detailHtml +
        "</div>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------ */
  /* Brand filter bar (legacy - nie używany, zastąpiony dam-brand-filter.js) */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Breadcrumb                                                           */
  /* ------------------------------------------------------------------ */

  function renderBreadcrumb() {
    var el = document.getElementById("damBreadcrumb");
    if (!el) return;
    var parts = ['<a href="#" class="dam-breadcrumb__link" data-nav="root">DAM ETA</a>'];
    if (state.canonCat) {
      var title = "";
      if (DL) {
        DL.CATEGORY_CANON.forEach(function (c) { if (c.id === state.canonCat) title = c.title; });
      }
      title = title || state.canonCat;
      parts.push(state.product
        ? '<a href="#" class="dam-breadcrumb__link" data-nav="cat">' + esc(title) + "</a>"
        : "<span>" + esc(title) + "</span>"
      );
    }
    if (state.product) {
      var pName = productDisplayTitle(state.product);
      parts.push("<span>" + esc(pName) + "</span>");
    }
    el.innerHTML = parts.join(' <span class="dam-bc-sep">/</span> ');
    el.querySelectorAll("a[data-nav]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var nav = this.getAttribute("data-nav");
        if (nav === "root") { state.canonCat = null; state.product = null; }
        else if (nav === "cat") { state.product = null; }
        state.expandedCarriers = {};
        state.showOlderCarriers = {};
        navPush();
        renderAll();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sidebar                                                              */
  /* ------------------------------------------------------------------ */

  function renderSidebar() {
    var mount = document.getElementById("damFolderList");
    if (!mount || !state.fileIndex) return;

    var cats = getCanonicalCategoryList();
    var html = '<div class="dam-cat-list">';
    cats.forEach(function (c) {
      var active = state.canonCat === c.id;
      html += '<div class="dam-folder-item' + (active ? " is-active" : "") + '" data-canon-cat="' + esc(c.id) + '">' +
        '<i class="uil uil-folder dam-folder-item__icon" aria-hidden="true"></i>' +
        '<div class="dam-folder-item__text">' +
          '<div class="dam-folder-item__name">' + esc(c.title) + "</div>" +
          '<div class="dam-folder-item__count">' + c.count + " prod.</div>" +
        "</div></div>";
    });
    html += "</div>";
    mount.innerHTML = html;

    // Bind category clicks
    mount.querySelectorAll(".dam-folder-item").forEach(function (item) {
      item.addEventListener("click", function () {
        state.canonCat = this.getAttribute("data-canon-cat");
        state.product = null;
        state.expandedCarriers = {};
        state.showOlderCarriers = {};
        navPush();
        renderAll();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Main panel                                                           */
  /* ------------------------------------------------------------------ */

  function renderMain() {
    var mount = document.getElementById("damExplorerMain");
    if (!mount) return;

    if (!state.fileIndex) {
      mount.innerHTML = '<div class="dam-explorer-empty">Ładowanie indeksu dysku...</div>';
      return;
    }

    /* Welcome */
    if (!state.canonCat) {
      var recent = getRecentProducts().slice(0, 4);
      var recentHtml = recent.length
        ? '<div class="dam-welcome-section"><div class="dam-welcome-section__title">Ostatnio otwierane</div><div class="dam-welcome-links">' +
          recent.map(function (p) {
            var name = DL ? DL.cleanProductDisplayName(p.display_name || p.name) : (p.display_name || p.name);
            return '<button type="button" class="dam-welcome-link" data-pid="' + esc(p.id) + '">' +
              '<i class="uil uil-history" aria-hidden="true"></i> ' + esc(name) + "</button>";
          }).join("") + "</div></div>"
        : "";
      mount.innerHTML = '<div class="dam-explorer-panel dam-explorer-welcome">' +
        '<h5 class="dam-explorer-panel__title">Eksplorator DAM ETA</h5>' +
        '<p class="dam-explorer-panel__lead">Wybierz kategorie po lewej lub wyszukaj indeks / skojarzenie (np. <strong>6300</strong>, <strong>czekolada</strong>).</p>' +
        '<div class="dam-welcome-section"><div class="dam-welcome-section__title">Szybkie linki</div>' +
        '<div class="dam-welcome-links">' +
          '<a href="visualizations.html" class="dam-welcome-link"><i class="uil uil-image" aria-hidden="true"></i> Wizualizacje</a>' +
          '<button type="button" class="dam-welcome-link" data-focus-search="1"><i class="uil uil-search" aria-hidden="true"></i> Szukaj indeksu</button>' +
        "</div></div>" + recentHtml +
        '<p class="dam-welcome-hint">' + (state.fileIndex.product_count || 0) + " produktów - wybierz kategorie z panelu bocznego.</p>" +
      "</div>";
      mount.querySelectorAll("[data-pid]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var p = (state.fileIndex.products || []).find(function (x) { return x.id === this.getAttribute("data-pid"); }.bind(this));
          if (p) openProduct(p);
        });
      });
      mount.querySelectorAll("[data-focus-search]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var inp = document.getElementById("damFileSearch");
          if (inp) { inp.focus(); inp.select(); }
        });
      });
      return;
    }

    /* Product list */
    if (!state.product) {
      var products = getProductsForCanonCat();
      var mixProds = products.filter(function (p) {
        return DL ? DL.isMixProduct(p.display_name || p.name, p.tags) : false;
      });
      var regularProds = products.filter(function (p) {
        return !(DL ? DL.isMixProduct(p.display_name || p.name, p.tags) : false);
      });

      var catTitle = "";
      if (DL) {
        DL.CATEGORY_CANON.forEach(function (c) { if (c.id === state.canonCat) catTitle = c.title; });
      }
      catTitle = catTitle || state.canonCat;

      function collectProductLangs(prod) {
        var set = {};
        (prod.revisions || []).forEach(function (r) {
          ((r && r.langs) || []).forEach(function (l) {
            if (l) set[String(l).toLowerCase()] = true;
          });
          var fbrL = (r && r.files_by_role) || {};
          ["source", "print", "viz", "elements"].forEach(function (rk) {
            (fbrL[rk] || []).forEach(function (f) {
              if (f && f.lang) set[String(f.lang).toLowerCase()] = true;
            });
          });
          ((r && r.wizki) || []).forEach(function (f) {
            if (f && f.lang) set[String(f.lang).toLowerCase()] = true;
          });
        });
        return Object.keys(set).sort();
      }

      function prodRowHtml(p) {
        var name = productDisplayTitle(p);
        var brand = getProductBrand(p);
        var langs = collectProductLangs(p);
        var revCount = p.revision_count || (p.revisions && p.revisions.length) || 0;
        if (!revCount && p.indexes && p.indexes.length) revCount = p.indexes.length;
        var hasVariants = revCount > 1;
        var tagsHtml = "";
        if (window.DamBadges && typeof window.DamBadges.render === "function") {
          tagsHtml = window.DamBadges.render({
            brand: brand || "",
            category: "",
            subcategory: p.subcategory_slug || "",
            subcategoryLabel: p.subcategory_label || "",
            langs: langs,
            productName: name,
            productId: p.id,
            tags: p.tags,
            /* multiIndex w tagach wylaczone - "N Warianty" jest po prawej w __variants */
            multiIndex: false,
            compact: true,
            maxPerKind: 3,
            maxTotal: 7,
            showCarrierPlaceholder: false,
          });
        } else {
          if (brand) {
            tagsHtml +=
              '<span class="dam-viz-badge dam-viz-badge--brand' +
              (brand === "GC" ? " dam-viz-badge--brand-gc" : "") +
              '">' + esc(brand) + "</span>";
          }
          if (p.subcategory_label) {
            tagsHtml +=
              '<span class="dam-viz-badge dam-viz-badge--subcat">' +
              esc(p.subcategory_label) +
              "</span>";
          }
          langs.slice(0, 4).forEach(function (l) {
            tagsHtml +=
              '<span class="dam-viz-badge dam-viz-badge--lang">' +
              esc(String(l).toUpperCase()) +
              "</span>";
          });
        }
        /* Blok wariantow po PRAWEJ (nie po lewej) - 2026-07-18 */
        var variantsHtml = hasVariants
          ? '<div class="dam-prod-row__variants" data-dam-tip="' + esc(String(revCount)) + ' warianty">' +
              '<span class="dam-prod-row__count-num" aria-hidden="true">' + esc(String(revCount)) + "</span>" +
              '<span class="dam-viz-badge dam-viz-badge--variants">Warianty</span>' +
            "</div>"
          : "";
        return '<div class="dam-prod-row' + (hasVariants ? " dam-prod-row--variants" : "") + '" data-pid="' + esc(p.id) + '">' +
          '<div class="dam-prod-row__main">' +
            '<div class="dam-prod-row__title">' + esc(name) + "</div>" +
            (tagsHtml ? '<div class="dam-prod-row__tags">' + tagsHtml + "</div>" : "") +
            '<div class="dam-prod-row__sub">' +
              renderIndexChips(p.indexes) +
            "</div>" +
          "</div>" +
          variantsHtml +
        "</div>";
      }

      navPush();
      var html = '<div class="dam-explorer-panel">' +
        panelHeadHtml({
          icon: "uil-folder",
          kicker: "Kategoria",
          title: catTitle,
          meta: products.length + " " +
            (products.length === 1 ? "produkt" : (products.length >= 2 && products.length <= 4 ? "produkty" : "produktów")) +
            " w tej kategorii"
        });

      if (mixProds.length > 0) {
        var mixOpen = !!state.expandedCarriers["__mix__"];
        html += '<div class="dam-mix-section' + (mixOpen ? " is-open" : "") + '">' +
          '<button type="button" class="dam-mix-toggle" data-toggle-mix="1">' +
            '<span>MIXY (' + mixProds.length + ")</span>" +
            '<i class="uil ' + (mixOpen ? "uil-angle-up" : "uil-angle-down") + '" aria-hidden="true"></i>' +
          "</button>" +
          '<div class="dam-mix-body"' + (mixOpen ? "" : " hidden") + ">" +
          mixProds.map(prodRowHtml).join("") +
          "</div></div>";
      }

      html += '<div class="dam-prod-list">' + regularProds.map(prodRowHtml).join("") + "</div>";
      html += "</div>";
      mount.innerHTML = html;
      bindPanelNav(mount);

      mount.querySelectorAll("[data-toggle-mix]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.expandedCarriers["__mix__"] = !state.expandedCarriers["__mix__"];
          renderMain();
        });
      });
      mount.querySelectorAll(".dam-prod-row").forEach(function (row) {
        row.addEventListener("click", function () {
          var p = (state.fileIndex.products || []).find(function (x) { return x.id === this.getAttribute("data-pid"); }.bind(this));
          if (p) openProduct(p);
        });
      });
      return;
    }

    /* Product detail - carrier list */
    var allRevisions = state.product.revisions || [];
    var groups = groupRevisionsByCarrier(allRevisions);
    var pName = productDisplayTitle(state.product);
    var scale = state.vizScale || 140;

    var catForProduct = "";
    if (DL) {
      DL.CATEGORY_CANON.forEach(function (c) { if (c.id === state.canonCat) catForProduct = c.title; });
    }
    catForProduct = catForProduct || state.canonCat || "Produkt";

    var showAllOn = !!state.showAllRevisions;
    var visibleGroups = 0;
    groups.forEach(function (g) {
      if (pickCarrierDisplay(g.revisions, showAllOn)) visibleGroups++;
    });

    navPush();
    var html2 = '<div class="dam-explorer-panel">' +
      panelHeadHtml({
        icon: "uil-box",
        kicker: "Produkt · " + catForProduct,
        title: pName,
        meta: visibleGroups + " typ" + (visibleGroups === 1 ? "" : "y") +
          " nośnika" + (showAllOn ? " (wszystkie)" : " (aktualne)") +
          ". Kliknij, aby rozwinąć szczegóły."
      }) +
      '<div class="dam-product-toolbar">' +
        '<div class="dam-product-toolbar__main">' +
          '<label class="dam-switch' + (showAllOn ? "" : " is-off") + '" for="damProdShowAll" ' +
            'data-dam-tip="OFF: tylko aktualne warianty. ON: takze nieaktualne / starsze indeksy.">' +
            '<input type="checkbox" id="damProdShowAll" class="dam-switch__input"' +
              (showAllOn ? " checked" : "") + ' />' +
            '<span class="dam-switch__track" aria-hidden="true"></span>' +
            '<span class="dam-switch__label">Pokaż wszystko</span>' +
          "</label>" +
        "</div>" +
        '<div class="dam-product-toolbar__slot2" id="damVizViewControls">' +
          '<div class="dam-viz-viewbar" role="group" aria-label="Skala podglądu wizualizacji">' +
            '<label class="dam-viz-scale" data-dam-tip="Skala podglądu hero">' +
              '<span>Skala podglądu</span>' +
              '<input type="range" id="damVizScale" min="120" max="280" step="10" value="' + scale + '">' +
            "</label>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="dam-carrier-list">';

    if (groups.length === 0) {
      html2 += '<div class="dam-explorer-empty">Brak danych o nośnikach. Sprawdz indeks dysku.</div>';
    } else {
      var anyShown = false;
      groups.forEach(function (g) {
        var picked = pickCarrierDisplay(g.revisions, showAllOn);
        if (!picked) return;
        anyShown = true;
        html2 += renderCarrierCard(g.code, picked.current, picked.older, state.product, allRevisions);
      });
      if (!anyShown) {
        html2 += '<div class="dam-explorer-empty">Brak aktualnych wariantów. Włącz <strong>Pokaż wszystko</strong>, aby zobaczyć nieaktualne.</div>';
      }
    }

    html2 += "</div>" +
      '<div class="dam-add-variant-wrap">' +
        '<button type="button" class="geex-btn dam-add-variant-btn" id="damAddVariantBtn" data-dam-tip="Wskaż folder wariantu i zmapuj go do bazy">' +
          "Nie widzisz wariantu? Dodaj go</button>" +
      "</div>" +
    "</div>";
    mount.innerHTML = html2;
    bindPanelNav(mount);

    bindProductToolbar(mount);
    bindCarrierInteractions(mount);
    bindCopyButtons(mount);
    if (window.DamTooltips && typeof window.DamTooltips.refresh === "function") {
      window.DamTooltips.refresh(mount);
    }
  }

  function onBrandFilterChange(brands) {
    state.brands = brands;
    renderSidebar();
    renderMain();
  }

  function bindProductToolbar(mount) {
    /* Filtr DK/GC tylko w sidebar Kategorie. Tu: switch Pokaż wszystko. */
    var showAllEl = mount.querySelector("#damProdShowAll");
    if (showAllEl && !showAllEl._damBound) {
      showAllEl._damBound = true;
      showAllEl.addEventListener("change", function () {
        state.showAllRevisions = !!this.checked;
        localStorage.setItem(SHOW_ALL_KEY, state.showAllRevisions ? "1" : "0");
        var wrap = this.closest(".dam-switch");
        if (wrap) wrap.classList.toggle("is-off", !state.showAllRevisions);
        renderMain();
      });
    }

    mount.querySelectorAll("[data-viz-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.vizViewMode = this.getAttribute("data-viz-mode") || "tiles";
        localStorage.setItem(VIZ_VIEW_KEY, state.vizViewMode);
        renderMain();
      });
    });
    var scaleEl = document.getElementById("damVizScale");
    if (scaleEl) {
      scaleEl.addEventListener("input", function () {
        state.vizScale = parseInt(this.value, 10) || 140;
        localStorage.setItem(VIZ_SCALE_KEY, String(state.vizScale));
        mount.querySelectorAll(".dam-viz-studio").forEach(function (el) {
          el.style.setProperty("--dam-viz-hero", state.vizScale + "px");
        });
      });
      scaleEl.addEventListener("change", function () {
        renderMain();
      });
    }

    mount.querySelectorAll("[data-viz-bg]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.vizBgFilter = this.getAttribute("data-viz-bg") || "z-tlem";
        renderMain();
      });
    });

    mount.querySelectorAll("[data-lightbox-idx]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        if (e.target.closest(".dam-path-actions")) return;
        var idx = parseInt(this.getAttribute("data-lightbox-idx"), 10);
        if (!isNaN(idx)) openLightbox(idx);
      });
    });

    var addBtn = document.getElementById("damAddVariantBtn");
    if (addBtn) addBtn.addEventListener("click", openAddVariantModal);
  }

  function bindCarrierInteractions(mount) {
    // Admin: edycja indeksu nie rozwija karty
    mount.querySelectorAll(".dam-index-edit, .dam-index-action").forEach(function (el) {
      el.addEventListener("click", function (e) { e.stopPropagation(); });
    });
    mount.querySelectorAll(".dam-index-action").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var wrap = this.closest(".dam-index-chip--admin");
        var input = wrap && wrap.querySelector(".dam-index-edit");
        if (!input) return;
        if (this.getAttribute("data-mode") === "apply" || wrap.classList.contains("dam-index-chip--editing")) {
          applyIndexRename(input, wrap, this);
          return;
        }
        wrap.classList.add("dam-index-chip--editing");
        input.removeAttribute("readonly");
        input.focus();
        try { input.select(); } catch (errSel) { /* ignore */ }
        this.setAttribute("data-mode", "apply");
        this.textContent = "Zastosuj";
        this.setAttribute(
          "data-dam-tip",
          "Zastosuj zmiane indeksu we wszystkich plikach tego folderu"
        );
      });
    });
    mount.querySelectorAll(".dam-index-edit").forEach(function (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          var wrap = this.closest(".dam-index-chip--admin");
          var btn = wrap && wrap.querySelector(".dam-index-action");
          if (wrap && btn && !wrap.classList.contains("dam-index-chip--editing")) {
            wrap.classList.add("dam-index-chip--editing");
            this.removeAttribute("readonly");
            btn.setAttribute("data-mode", "apply");
            btn.textContent = "Zastosuj";
          }
          applyIndexRename(this, wrap, btn);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          var wrap2 = this.closest(".dam-index-chip--admin");
          var btn2 = wrap2 && wrap2.querySelector(".dam-index-action");
          if (!wrap2) return;
          wrap2.classList.remove("dam-index-chip--editing");
          this.value = this.getAttribute("data-from-index") || this.value;
          this.setAttribute("readonly", "readonly");
          if (btn2) {
            btn2.setAttribute("data-mode", "edit");
            btn2.textContent = "Edytuj indeks";
            btn2.setAttribute("data-dam-tip", "Wlacz edycje indeksu w tym folderze");
          }
        }
      });
    });

    // Bind carrier toggle (div[role=button] - tagi wewnatrz sa prawdziwymi <button>)
    function toggleCarrierFromEl(el) {
      var code = el.getAttribute("data-toggle-code");
      if (!code) return;
      state.expandedCarriers[code] = !state.expandedCarriers[code];
      renderMain();
      var card = document.getElementById("dam-carrier-" + code);
      if (card && state.expandedCarriers[code]) {
        setTimeout(function () {
          card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 60);
      }
    }
    mount.querySelectorAll("[data-toggle-code]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (
          e.target.closest(
            "button, a, input, select, textarea, .dam-index-chip--admin, .dam-carrier-toggle__actions, .dam-carrier-head__meta"
          )
        ) {
          return;
        }
        toggleCarrierFromEl(this);
      });
      btn.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (
          e.target.closest(
            "button, a, input, select, textarea, .dam-index-chip--admin"
          )
        ) {
          return;
        }
        e.preventDefault();
        toggleCarrierFromEl(this);
      });
    });

    // Bind "show older" buttons
    mount.querySelectorAll(".dam-show-older-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var code = this.getAttribute("data-code");
        state.showOlderCarriers[code] = !state.showOlderCarriers[code];
        renderMain();
      });
    });

    // Bind admin status buttons
    mount.querySelectorAll(".dam-admin-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var ridx = this.getAttribute("data-ridx");
        var status = this.getAttribute("data-status");
        var allRevs = state.product.revisions || [];
        var groups2 = groupRevisionsByCarrier(allRevs);
        groups2.forEach(function (g) {
          var cur = getCurrentRevisions(g.revisions);
          var older = getOlderRevisions(g.revisions, cur);
          if (ridx === "curr") {
            setRevisionStatus(cur[0], status);
          } else if (ridx.startsWith("extra_")) {
            var i = parseInt(ridx.replace("extra_", ""), 10);
            if (cur[i + 1]) setRevisionStatus(cur[i + 1], status);
          } else if (ridx.startsWith("older_")) {
            var i2 = parseInt(ridx.replace("older_", ""), 10);
            if (older[i2]) setRevisionStatus(older[i2], status);
          }
        });
      });
    });

    // Elementy: otwórz / wskaz / odlacz
    mount.querySelectorAll("[data-elements-open]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var p = this.getAttribute("data-elements-open") || "";
        if (!p) return;
        if (window.DamPaths && typeof window.DamPaths.revealInExplorer === "function") {
          window.DamPaths.revealInExplorer(p);
        } else {
          fetch(bridgeUrl() + "/reveal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: p })
          }).catch(function () {});
        }
      });
    });
    mount.querySelectorAll("[data-elements-link]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openElementsLinkPicker(
          this.getAttribute("data-elements-link") || "",
          this.getAttribute("data-elements-index") || ""
        );
      });
    });
    mount.querySelectorAll("[data-elements-unlink]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        unlinkElementsLink(
          this.getAttribute("data-elements-unlink") || "",
          this.getAttribute("data-elements-index") || ""
        );
      });
    });
  }

  window.__damThumbFallback = function (img) {
    var raw = img.getAttribute("data-fallbacks") || "";
    var list = raw ? raw.split("|").filter(Boolean) : [];
    if (!list.length) {
      img.style.display = "none";
      var ph = img.nextElementSibling;
      if (ph) ph.hidden = false;
      return;
    }
    img.setAttribute("data-fallbacks", list.slice(1).join("|"));
    img.src = list[0];
  };

  function openLightbox(startIdx) {
    var allFiles = state._lightboxFiles || [];
    if (!allFiles.length) return;
    var model = state._vizStudio || buildVizStudioModel(allFiles);
    var items = (model.items || []).length ? model.items : allFiles.map(enrichVizFile);

    var startFile = allFiles[Math.max(0, Math.min(allFiles.length - 1, startIdx || 0))];
    var startItem = items.find(function (it) { return it.file === startFile; }) || items[0];
    if (!startItem) return;

    var studio = {
      persp: startItem.persp,
      lang: startItem.lang,
      bg: startItem.bg,
      file: startItem.file,
      zoom: 1
    };

    function filteredItems() {
      return items.filter(function (it) {
        return it.persp === studio.persp &&
          it.bg === studio.bg &&
          (!studio.lang || it.lang === studio.lang);
      });
    }

    function perspList() {
      var seen = {};
      var order = ["ENFACE", "FRONT", "BACK", "TYL-ENFACE", "BOK", "INNE"];
      items.forEach(function (it) {
        if (it.bg === studio.bg && (!studio.lang || it.lang === studio.lang)) seen[it.persp] = true;
      });
      return order.filter(function (p) { return seen[p]; });
    }

    function langList() {
      var seen = {};
      items.forEach(function (it) {
        if (it.bg === studio.bg && it.persp === studio.persp) seen[it.lang] = true;
      });
      return Object.keys(seen).sort();
    }

    function ensureSelection() {
      var list = filteredItems();
      if (!list.length) {
        var any = items.filter(function (it) { return it.persp === studio.persp && it.bg === studio.bg; });
        if (any.length) studio.lang = any[0].lang;
        list = filteredItems();
      }
      if (!list.length) return;
      var still = list.some(function (it) { return it.file === studio.file; });
      if (!still) studio.file = pickHeroFile(list.map(function (it) { return it.file; })) || list[0].file;
    }

    function metaUrl(indexPath) {
      var local = window.DamPaths ? window.DamPaths.toLocal(indexPath) : indexPath;
      return bridgeUrl() + "/media-meta?path=" + encodeURIComponent(local);
    }

    function loadMeta(f) {
      var box = document.getElementById("damLbMeta");
      if (!box || !f) return;
      box.innerHTML = '<span class="dam-lb-meta__loading">Ładowanie metadanych…</span>';
      var sizeKnown = f.size ? fmtSize(f.size) : "";
      fetch(metaUrl(f.path)).then(function (r) { return r.json(); }).then(function (data) {
        if (!data || !data.ok) {
          box.innerHTML = (sizeKnown ? '<div><strong>Rozmiar</strong> ' + esc(sizeKnown) + "</div>" : "") +
            '<div class="dam-lb-meta__muted">Metadane niedostepne - uruchom aplikacje DAM ETA.</div>';
          return;
        }
        var dims = (data.width && data.height) ? (data.width + " x " + data.height + " px") : "-";
        var cs = data.colorspace || data.mode || "-";
        var weight = data.size_bytes ? fmtSize(data.size_bytes) : sizeKnown || "-";
        var dpi = data.dpi ? (Array.isArray(data.dpi) ? data.dpi.join(" x ") : String(data.dpi)) : "";
        box.innerHTML =
          '<div><strong>Rozdzielczosc</strong> ' + esc(dims) + "</div>" +
          '<div><strong>Waga</strong> ' + esc(weight) + "</div>" +
          '<div><strong>Przestrzen</strong> ' + esc(cs) +
            (data.has_alpha ? ' <span class="dam-viz-badge dam-viz-badge--brand">alpha</span>' : "") +
          "</div>" +
          (dpi ? '<div><strong>DPI</strong> ' + esc(dpi) + "</div>" : "") +
          '<div><strong>Format</strong> ' + esc((data.format || fileExt(f.name)).toUpperCase()) + "</div>";
      }).catch(function () {
        box.innerHTML = sizeKnown
          ? '<div><strong>Rozmiar</strong> ' + esc(sizeKnown) + '</div><div class="dam-lb-meta__muted">Bridge offline</div>'
          : '<div class="dam-lb-meta__muted">Bridge offline</div>';
      });
    }

    function paint() {
      ensureSelection();
      var overlay = document.getElementById("damLightbox");
      if (!overlay) return;
      var f = studio.file;
      var cands = thumbCandidates(f);
      var img = overlay.querySelector(".dam-lightbox__img");
      if (img) {
        img.onerror = function () { window.__damThumbFallback(img); };
        img.setAttribute("data-fallbacks", cands.slice(1).join("|"));
        img.src = mediaUrl(f.path) || cands[0];
        img.alt = f.name || "";
        img.style.transform = "scale(" + studio.zoom + ")";
        var frame = overlay.querySelector(".dam-lightbox__frame");
        if (frame) {
          if (studio.zoom > 1.01) frame.classList.add("is-zoomed");
          else frame.classList.remove("is-zoomed");
        }
      }
      var title = overlay.querySelector(".dam-lightbox__title");
      if (title) {
        title.textContent = f.name || "";
        title.setAttribute("title", f.name || "");
      }

      var bgBox = document.getElementById("damLbBg");
      if (bgBox) {
        var bgOpts = [
          { id: "z-tlem", label: "Z tlem" },
          { id: "bez-tla", label: "Bez tla" }
        ].filter(function (o) {
          return items.some(function (it) { return it.bg === o.id; });
        });
        bgBox.innerHTML = bgOpts.map(function (o) {
          return '<button type="button" class="dam-lb-chip' + (o.id === studio.bg ? " is-active" : "") + '" data-lb-bg="' + esc(o.id) + '">' + esc(o.label) + "</button>";
        }).join("");
      }

      var persps = perspList();
      var perspBox = document.getElementById("damLbPersp");
      if (perspBox) {
        perspBox.innerHTML = persps.map(function (p) {
          return '<button type="button" class="dam-lb-chip' + (p === studio.persp ? " is-active" : "") + '" data-lb-persp="' + esc(p) + '">' + esc(p) + "</button>";
        }).join("");
      }

      var langs = langList();
      var langWrap = document.getElementById("damLbLangWrap");
      var langBox = document.getElementById("damLbLang");
      if (langWrap && langBox) {
        if (langs.length > 1) {
          langWrap.hidden = false;
          langBox.innerHTML = langs.map(function (l) {
            return '<button type="button" class="dam-lb-chip' + (l === studio.lang ? " is-active" : "") + '" data-lb-lang="' + esc(l) + '">' + esc(l.toUpperCase()) + "</button>";
          }).join("");
        } else {
          langWrap.hidden = true;
        }
      }

      var variants = filteredItems();
      var SIZE_ORDER = ["XL", "L", "M", "S-SKLEP", "S", "XS", "WEB", ""];
      /* Jedna kafelek na unikalny rozmiar+format (bez 10x S-SKLEP JPG) */
      var uniqMap = {};
      variants.forEach(function (it) {
        var key = (it.size || "?") + "|" + (it.ext || "");
        if (!uniqMap[key]) uniqMap[key] = [];
        uniqMap[key].push(it);
      });
      variants = Object.keys(uniqMap).map(function (key) {
        var group = uniqMap[key];
        var heroFile = pickHeroFile(group.map(function (g) { return g.file; })) || group[0].file;
        var chosen = group.find(function (g) { return g.file === heroFile; }) || group[0];
        return { it: chosen, count: group.length, files: group.map(function (g) { return g.file; }) };
      }).sort(function (a, b) {
        var ia = SIZE_ORDER.indexOf(a.it.size || "");
        var ib = SIZE_ORDER.indexOf(b.it.size || "");
        if (ia < 0) ia = 99;
        if (ib < 0) ib = 99;
        if (ia !== ib) return ia - ib;
        return String(a.it.ext || "").localeCompare(String(b.it.ext || ""));
      });
      var varBox = document.getElementById("damLbVariants");
      if (varBox) {
        varBox.innerHTML = variants.length
          ? '<div class="dam-lb-size-grid" role="listbox" aria-label="Rozmiar i format">' +
            variants.map(function (row) {
              var it = row.it;
              var active = row.files.some(function (ff) { return ff === studio.file; });
              var sizeH = DL ? DL.vizSizeHint(it.size) : (it.size || "Wariant");
              var fmtH = DL ? DL.vizFormatHint(it.ext) : it.ext;
              var tip = (it.size ? sizeH : "Wariant") + " - " + fmtH +
                (row.count > 1 ? " (" + row.count + " plików)" : "") +
                " - " + (it.file.name || "");
              return '<button type="button" role="option" class="dam-lb-size' + (active ? " is-active" : "") +
                '" data-lb-file="' + esc(it.file.path) + '" title="' + esc(tip) + '" aria-selected="' + active + '">' +
                '<span class="dam-lb-size__code">' + esc(it.size || "?") +
                  (row.count > 1 ? ' <span class="dam-lb-size__n">x' + row.count + "</span>" : "") +
                "</span>" +
                '<span class="dam-lb-size__ext">' + esc(it.ext || "") + "</span>" +
              "</button>";
            }).join("") +
            "</div>"
          : '<p class="dam-lb-meta__muted">Brak wariantow dla tego widoku.</p>';
      }

      var zoomLabel = document.getElementById("damLbZoomLabel");
      if (zoomLabel) zoomLabel.textContent = Math.round(studio.zoom * 100) + "%";

      var prev = overlay.querySelector("[data-lb-prev]");
      var next = overlay.querySelector("[data-lb-next]");
      var pi = persps.indexOf(studio.persp);
      if (prev) prev.disabled = pi <= 0;
      if (next) next.disabled = pi < 0 || pi >= persps.length - 1;

      var actions = document.getElementById("damLightboxActions");
      if (actions) {
        actions.innerHTML = pathActions(f.path || "");
        if (window.DamPaths) window.DamPaths.bindPathActions(actions);
      }
      loadMeta(f);
    }

    var existing = document.getElementById("damLightbox");
    if (existing) existing.remove();

    var html =
      '<div class="dam-lightbox dam-lightbox--studio" id="damLightbox" role="dialog" aria-modal="true" aria-label="Studio podglądu wizualizacji">' +
        '<button type="button" class="dam-lightbox__close" data-lb-close aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
        '<div class="dam-lightbox__layout">' +
          '<aside class="dam-lightbox__side" aria-label="Opcje pliku">' +
            '<div class="dam-lb-filters">' +
              '<div class="dam-lb-section">' +
                '<div class="dam-lb-section__title">Tlo</div>' +
                '<div class="dam-lb-chips" id="damLbBg"></div>' +
              "</div>" +
              '<div class="dam-lb-section">' +
                '<div class="dam-lb-section__title">Widok</div>' +
                '<div class="dam-lb-chips" id="damLbPersp"></div>' +
              "</div>" +
              '<div class="dam-lb-section" id="damLbLangWrap" hidden>' +
                '<div class="dam-lb-section__title">Język</div>' +
                '<div class="dam-lb-chips" id="damLbLang"></div>' +
              "</div>" +
            "</div>" +
            '<div class="dam-lb-section dam-lb-section--sizes">' +
              '<div class="dam-lb-section__title">Rozmiar / format</div>' +
              '<div class="dam-lb-variants" id="damLbVariants"></div>' +
            "</div>" +
            '<details class="dam-lb-details">' +
              '<summary class="dam-lb-details__sum">Metadane i plik</summary>' +
              '<div class="dam-lb-meta" id="damLbMeta"></div>' +
              '<div class="dam-lb-section" id="damLightboxActions"></div>' +
            "</details>" +
          "</aside>" +
          '<div class="dam-lightbox__main">' +
            '<div class="dam-lightbox__toolbar">' +
              '<button type="button" class="dam-lb-tool" data-lb-prev aria-label="Poprzedni widok"><i class="uil uil-angle-left"></i></button>' +
              '<button type="button" class="dam-lb-tool" data-lb-zoom-out aria-label="Pomniejsz"><i class="uil uil-search-minus"></i></button>' +
              '<span class="dam-lb-zoom-label" id="damLbZoomLabel">100%</span>' +
              '<button type="button" class="dam-lb-tool" data-lb-zoom-in aria-label="Powieksz"><i class="uil uil-search-plus"></i></button>' +
              '<button type="button" class="dam-lb-tool" data-lb-zoom-reset aria-label="Reset 100%"><i class="uil uil-search"></i></button>' +
              '<button type="button" class="dam-lb-tool" data-lb-next aria-label="Nastepny widok"><i class="uil uil-angle-right"></i></button>' +
            "</div>" +
            '<div class="dam-lightbox__stage">' +
              '<div class="dam-lightbox__frame">' +
                '<img class="dam-lightbox__img" alt="">' +
              "</div>" +
            "</div>" +
            '<div class="dam-lightbox__footer">' +
              '<div class="dam-lightbox__title" title=""></div>' +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>";
    document.body.insertAdjacentHTML("beforeend", html);
    var overlay = document.getElementById("damLightbox");

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function stepPersp(dir) {
      var persps = perspList();
      var i = persps.indexOf(studio.persp);
      var n = i + dir;
      if (n < 0 || n >= persps.length) return;
      studio.persp = persps[n];
      studio.zoom = 1;
      paint();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") stepPersp(-1);
      if (e.key === "ArrowRight") stepPersp(1);
      if (e.key === "+" || e.key === "=") { studio.zoom = Math.min(3, studio.zoom + 0.15); paint(); }
      if (e.key === "-") { studio.zoom = Math.max(0.4, studio.zoom - 0.15); paint(); }
    }

    overlay.querySelector("[data-lb-close]").addEventListener("click", close);
    overlay.querySelector("[data-lb-prev]").addEventListener("click", function () { stepPersp(-1); });
    overlay.querySelector("[data-lb-next]").addEventListener("click", function () { stepPersp(1); });
    overlay.querySelector("[data-lb-zoom-in]").addEventListener("click", function () {
      studio.zoom = Math.min(3, +(studio.zoom + 0.2).toFixed(2));
      paint();
    });
    overlay.querySelector("[data-lb-zoom-out]").addEventListener("click", function () {
      studio.zoom = Math.max(0.4, +(studio.zoom - 0.2).toFixed(2));
      paint();
    });
    var zoomResetBtn = overlay.querySelector("[data-lb-zoom-reset]");
    if (zoomResetBtn) {
      zoomResetBtn.addEventListener("click", function () {
        studio.zoom = 1;
        paint();
      });
    }
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
      var bgBtn = e.target.closest("[data-lb-bg]");
      if (bgBtn) {
        studio.bg = bgBtn.getAttribute("data-lb-bg") || "z-tlem";
        studio.zoom = 1;
        var nextPersps = perspList();
        if (nextPersps.indexOf(studio.persp) < 0 && nextPersps.length) studio.persp = nextPersps[0];
        paint();
        return;
      }
      var perspBtn = e.target.closest("[data-lb-persp]");
      if (perspBtn) {
        studio.persp = perspBtn.getAttribute("data-lb-persp");
        studio.zoom = 1;
        paint();
        return;
      }
      var langBtn = e.target.closest("[data-lb-lang]");
      if (langBtn) {
        studio.lang = langBtn.getAttribute("data-lb-lang");
        studio.zoom = 1;
        paint();
        return;
      }
      var varBtn = e.target.closest("[data-lb-file]");
      if (varBtn) {
        var path = varBtn.getAttribute("data-lb-file");
        var hit = items.find(function (it) { return it.file.path === path; });
        if (hit) { studio.file = hit.file; studio.zoom = 1; paint(); }
      }
    });
    document.addEventListener("keydown", onKey);
    paint();
  }

  function openAddVariantModal() {
    if (!state.product) return;
    var existing = document.getElementById("damAddVariantModal");
    if (existing) existing.remove();

    var carriers = Object.keys((DL && DL.CARRIER_LABELS) || {}).concat(["UNKNOWN"]);
    var opts = carriers.map(function (c) {
      var lab = DL ? DL.carrierLabel(c) : c;
      return '<option value="' + esc(c) + '">' + esc(lab) + " (" + esc(c) + ")</option>";
    }).join("");

    var html =
      '<div class="dam-basepath-overlay" id="damAddVariantModal">' +
        '<div class="dam-basepath-box" role="dialog" aria-modal="true" aria-labelledby="damAddVariantTitle">' +
          '<button type="button" class="dam-modal-x" id="damAddVariantClose" aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
          '<h3 id="damAddVariantTitle">Dodaj / popraw wariant</h3>' +
          '<p class="dam-basepath-lead">Wklej ścieżkę folderu wariantu (z D: lub Twojej bazy). Okresl typ nośnika i status. Rynek (DK/GC) rozpoznamy ze sciezki.</p>' +
          '<label class="dam-basepath-label" for="damAddVariantPath">Ścieżka folderu</label>' +
          '<input type="text" id="damAddVariantPath" class="dam-basepath-input" placeholder="D:\\Marketing\\- POLSKA\\01 - PRODUKTY\\...">' +
          '<label class="dam-basepath-label" for="damAddVariantCarrier">Typ nośnika</label>' +
          '<select id="damAddVariantCarrier" class="dam-basepath-input">' + opts + "</select>" +
          '<label class="dam-basepath-label" for="damAddVariantStatus">Status</label>' +
          '<select id="damAddVariantStatus" class="dam-basepath-input">' +
            '<option value="aktualne">Aktualne</option>' +
            '<option value="nieaktualne">Nieaktualne</option>' +
            '<option value="starsza">Starsze</option>' +
          "</select>" +
          '<p id="damAddVariantMarket" class="dam-basepath-msg" hidden></p>' +
          '<div class="dam-basepath-actions">' +
            '<button type="button" class="geex-btn geex-btn--primary" id="damAddVariantSave">Zapisz do bazy</button>' +
            '<button type="button" class="geex-btn" id="damAddVariantCancel">Anuluj</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("damAddVariantModal");

    function updateMarket() {
      var path = (document.getElementById("damAddVariantPath").value || "").trim();
      var market = DL && DL.detectMarketFromPath ? DL.detectMarketFromPath(path) : "";
      var msg = document.getElementById("damAddVariantMarket");
      if (!msg) return;
      if (!path) { msg.hidden = true; return; }
      msg.hidden = false;
      msg.className = "dam-basepath-msg is-ok";
      msg.textContent = market ? ("Rozpoznany rynek: " + market + (market === "DK" ? " (Polska)" : " (Eksport)")) : "Nie rozpoznano rynku ze sciezki - uzupelnij recznie w notatce.";
      msg.dataset.market = market || "";
    }

    document.getElementById("damAddVariantPath").addEventListener("input", updateMarket);
    document.getElementById("damAddVariantCancel").addEventListener("click", function () { modal.remove(); });
    document.getElementById("damAddVariantClose").addEventListener("click", function () { modal.remove(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") { modal.remove(); document.removeEventListener("keydown", onEsc); }
    });
    document.getElementById("damAddVariantSave").addEventListener("click", function () {
      var pathRaw = (document.getElementById("damAddVariantPath").value || "").trim();
      var carrier = document.getElementById("damAddVariantCarrier").value;
      var status = document.getElementById("damAddVariantStatus").value;
      var market = (document.getElementById("damAddVariantMarket").dataset.market) || "";
      if (!pathRaw) { showToast("Podaj ścieżkę folderu"); return; }
      if (!carrier || carrier === "UNKNOWN") {
        showToast("Wybierz konkretny typ nośnika - nie zapisujemy UNKNOWN");
        return;
      }
      var canonPath = pathRaw.replace(/\\/g, "/");
      // Remap local base back to index D:/Marketing if possible
      if (window.DamPaths && window.DamPaths.getBasePath && window.DamPaths.getIndexBase) {
        var base = window.DamPaths.getBasePath().replace(/\\/g, "/").replace(/\/+$/, "");
        var idxBase = window.DamPaths.getIndexBase();
        var n = canonPath.replace(/\/+$/, "");
        if (base && n.toLowerCase().indexOf(base.toLowerCase()) === 0) {
          canonPath = idxBase + n.slice(base.length);
        }
      }
      var entry = {
        carrier: carrier,
        status: status,
        market: market,
        note: "Dodane recznie dla " + (state.product.id || ""),
        product_id: state.product.id || "",
        folder: canonPath.split("/").pop()
      };
      saveCarrierOverride(canonPath, entry).then(function () {
        showToast("Zapisano mapowanie nośnika");
        modal.remove();
        return loadCarrierOverrides().then(function () { renderMain(); });
      }).catch(function (err) {
        showToast("Błąd zapisu: " + (err && err.message ? err.message : "bridge"));
      });
    });
  }

  function resetIndexChipEdit(wrap, btn, input) {
    if (!wrap || !input) return;
    wrap.classList.remove("dam-index-chip--editing");
    input.value = input.getAttribute("data-from-index") || input.value;
    input.setAttribute("readonly", "readonly");
    if (btn) {
      btn.setAttribute("data-mode", "edit");
      btn.textContent = "Edytuj indeks";
      btn.setAttribute("data-dam-tip", "Wlacz edycje indeksu w tym folderze");
    }
  }

  function applyIndexRename(input, wrap, btn) {
    if (!state.adminMode) {
      showToast("Wlacz tryb admina, aby edytowac indeks");
      return;
    }
    var fromIndex = String(input.getAttribute("data-from-index") || "").trim();
    var toIndex = String(input.value || "").trim();
    var folder = String(input.getAttribute("data-folder") || "").trim();
    if (!folder) {
      showToast("Brak ścieżki folderu wariantu");
      return;
    }
    if (!fromIndex || !toIndex) {
      showToast("Podaj poprawny indeks");
      return;
    }
    if (fromIndex === toIndex) {
      showToast("Indeks bez zmian");
      return;
    }
    if (!/^(FOL\d+|\d{5,9})(\.\d{2})?$/i.test(toIndex)) {
      showToast("Niepoprawny format indeksu (np. 6300450 lub 6300450.00)");
      return;
    }
    var msg = "Zmienic indeks \"" + fromIndex + "\" -> \"" + toIndex +
      "\" we wszystkich nazwach plików i podfolderow wewnatrz:\n\n" + folder +
      "\n\nTo realna zmiana na dysku. Kontynuowac?";
    if (!window.confirm(msg)) return;

    showToast("Zmieniam indeks w folderze…");
    fetch(bridgeUrl() + "/rename-index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder: folder,
        from_index: fromIndex,
        to_index: toIndex,
        dry_run: false
      })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, data: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.data || !res.data.ok) {
          showToast("Błąd: " + ((res.data && res.data.error) || "rename-index"));
          return;
        }
        var n = (res.data.renamed || []).length;
        showToast("Zmieniono " + n + " nazw. Odśwież indeks dysku, jeśli listy się rozjeżdżają.");
        // Aktualizacja w pamieci UI
        if (state.product && state.product.revisions) {
          state.product.revisions.forEach(function (rev) {
            if (!rev) return;
            if (String(rev.path || "").replace(/\\/g, "/").indexOf(folder.replace(/\\/g, "/")) === 0 ||
                String(rev.path || "") === folder) {
              if (rev.index === fromIndex) rev.index = toIndex;
              if (rev.folder) rev.folder = String(rev.folder).split(fromIndex).join(toIndex);
              if (rev.path) rev.path = String(rev.path).split(fromIndex).join(toIndex);
            }
          });
        }
        if (window.DamPaths && window.DamPaths.logAction) {
          window.DamPaths.logAction("rename_index", {
            path: folder,
            detail: fromIndex + " -> " + toIndex + " (" + n + ")"
          });
        }
        if (window.DamTagEdit && typeof window.DamTagEdit.refreshChangeLogBar === "function") {
          window.DamTagEdit.refreshChangeLogBar();
        }
        resetIndexChipEdit(wrap, btn, input);
        renderMain();
      })
      .catch(function (err) {
        showToast("Bridge niedostępny: " + (err && err.message ? err.message : "fetch"));
      });
  }

  function saveCarrierOverride(pathKey, entry) {
    if (!state.carrierOverrides.overrides) state.carrierOverrides.overrides = {};
    state.carrierOverrides.overrides[pathKey] = entry;
    if (entry.folder && /\d{7}/.test(entry.folder)) {
      var m = String(entry.folder).match(/(\d{7}(?:\.\d+)?)/);
      if (m) state.carrierOverrides.overrides[m[1]] = entry;
    }
    state.carrierOverrides.updated_at = new Date().toISOString();
    try {
      localStorage.setItem("dam_carrier_overrides", JSON.stringify(state.carrierOverrides));
    } catch (e) { /* ignore */ }
    if (window.DamPaths && window.DamPaths.logAction) {
      window.DamPaths.logAction("carrier_override", { path: pathKey, detail: entry.carrier + " / " + entry.status });
    }
    return fetch(bridgeUrl() + "/carrier-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathKey, entry: entry })
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).catch(function () {
      // lokalny zapis wystarczy offline
      return { ok: true, offline: true };
    });
  }

  function loadCarrierOverrides() {
    return fetch("data/carrier-overrides.json?v=" + Date.now())
      .then(function (r) { return r.ok ? r.json() : { overrides: {} }; })
      .catch(function () { return { overrides: {} }; })
      .then(function (fileData) {
        var local = {};
        try { local = JSON.parse(localStorage.getItem("dam_carrier_overrides") || "{}"); } catch (e) { local = {}; }
        var merged = { overrides: Object.assign({}, (fileData && fileData.overrides) || {}, (local && local.overrides) || {}) };
        state.carrierOverrides = merged;
      });
  }

  function loadElementsLinks() {
    return fetch("data/elements-overrides.json?v=" + Date.now())
      .then(function (r) { return r.ok ? r.json() : { links: {} }; })
      .catch(function () { return { links: {} }; })
      .then(function (fileData) {
        var local = {};
        try { local = JSON.parse(localStorage.getItem("dam_elements_links") || "{}"); } catch (e) { local = {}; }
        state.elementsLinks = {
          links: Object.assign({}, (fileData && fileData.links) || {}, (local && local.links) || {}),
          updated_at: (fileData && fileData.updated_at) || (local && local.updated_at) || ""
        };
      });
  }

  function persistElementsLinksLocal() {
    try {
      localStorage.setItem("dam_elements_links", JSON.stringify(state.elementsLinks));
    } catch (e) { /* ignore */ }
  }

  function saveElementsLink(revPath, index, targetPath) {
    var key = normPathKey(revPath);
    var payload = {
      action: "link",
      revision_path: key,
      index: index || "",
      target_path: targetPath,
      product_id: (state.product && (state.product.id || state.product.product_id)) || "",
      linked_by: isAdminRole() ? "admin" : "user"
    };
    return fetch(bridgeUrl() + "/elements-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json().then(function (j) { return { httpOk: r.ok, data: j }; }); })
      .then(function (res) {
        var entry = (res.data && res.data.entry) || {
          path: targetPath,
          folder: targetPath,
          kind: "folder",
          file_count: 0,
          revision_path: key,
          index: index || "",
          linked_at: new Date().toISOString()
        };
        if (!state.elementsLinks.links) state.elementsLinks.links = {};
        state.elementsLinks.links[key] = entry;
        if (index) state.elementsLinks.links[index] = entry;
        state.elementsLinks.updated_at = new Date().toISOString();
        persistElementsLinksLocal();
        if (window.DamPaths && window.DamPaths.logAction) {
          window.DamPaths.logAction("elements_link", { path: key, detail: targetPath });
        }
        if (!res.httpOk || !res.data || !res.data.ok) {
          showToast("Zapisano lokalnie (bridge: " + ((res.data && res.data.error) || "offline") + ")");
        } else {
          var n = entry.file_count || 0;
          showToast("Powiazano Elementy" + (n ? " (" + n + " pl.)" : ""));
        }
        renderMain();
        return entry;
      })
      .catch(function (err) {
        if (!state.elementsLinks.links) state.elementsLinks.links = {};
        var offline = {
          path: targetPath,
          folder: targetPath,
          kind: "folder",
          file_count: 0,
          revision_path: key,
          index: index || "",
          linked_at: new Date().toISOString()
        };
        state.elementsLinks.links[key] = offline;
        if (index) state.elementsLinks.links[index] = offline;
        persistElementsLinksLocal();
        showToast("Powiazano lokalnie (bridge niedostępny)");
        renderMain();
        return offline;
      });
  }

  function unlinkElementsLink(revPath, index) {
    var key = normPathKey(revPath);
    return fetch(bridgeUrl() + "/elements-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlink", revision_path: key, index: index || "" })
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .catch(function () { return {}; })
      .then(function () {
        if (state.elementsLinks.links) {
          delete state.elementsLinks.links[key];
          if (index) delete state.elementsLinks.links[index];
        }
        persistElementsLinksLocal();
        showToast("Usuńieto powiazanie Elementy");
        renderMain();
      });
  }

  function openElementsLinkPicker(revPath, index) {
    var startDir = revPath || "";
    var existing = document.getElementById("damElementsPicker");
    if (existing) existing.remove();
    var overlay = document.createElement("div");
    overlay.id = "damElementsPicker";
    overlay.className = "dam-thumb-picker-overlay";
    overlay.innerHTML =
      '<div class="dam-thumb-picker-box">' +
      '<div class="dam-thumb-picker__head"><strong>Wskaż Elementy / składniki</strong>' +
      '<button type="button" class="dam-admin-control" id="damElementsPickerClose" aria-label="Zamknij">×</button></div>' +
      '<p class="dam-elements-picker__hint">Wybierz folder z elementami albo konkretny plik. Potem checklista uzna je za obecne.</p>' +
      '<div class="dam-thumb-picker__nav">' +
      '<button type="button" class="dam-admin-control" id="damElementsPickerUp" data-dam-tip="Folder wyzej">' +
      '<i class="uil uil-arrow-up" aria-hidden="true"></i></button>' +
      '<input type="text" id="damElementsPickerPathInput" class="dam-thumb-picker__path-input" placeholder="Wklej ścieżkę folderu ELEMENTY" />' +
      '<button type="button" class="dam-admin-control" id="damElementsPickerGo">Idz</button>' +
      '<button type="button" class="dam-admin-control dam-elements-picker__use" id="damElementsPickerUse">Uzyj tego folderu</button>' +
      "</div>" +
      '<div class="dam-thumb-picker__grid" id="damElementsPickerGrid">Ładowanie…</div></div>';
    document.body.appendChild(overlay);
    var pathInput = document.getElementById("damElementsPickerPathInput");
    var upBtn = document.getElementById("damElementsPickerUp");
    var currentPath = startDir;

    function closePicker() { overlay.remove(); }
    document.getElementById("damElementsPickerClose").onclick = closePicker;
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closePicker();
    });

    function pickTarget(target) {
      closePicker();
      saveElementsLink(revPath, index, target);
    }

    document.getElementById("damElementsPickerUse").onclick = function () {
      if (currentPath) pickTarget(currentPath);
      else showToast("Najpierw otwórz folder");
    };

    function loadDir(target) {
      var grid = document.getElementById("damElementsPickerGrid");
      if (grid) grid.innerHTML = "Ładowanie…";
      if (pathInput) pathInput.value = target || "";
      currentPath = target || "";
      fetch(bridgeUrl() + "/folder-browse?mode=assets&path=" + encodeURIComponent(target))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          grid = document.getElementById("damElementsPickerGrid");
          if (!grid) return;
          if (!data || !data.ok) {
            grid.innerHTML = "<p>Nie udalo sie otwórzyc: " + esc((data && data.error) || "?") +
              "</p><p class=\"dam-elements-picker__hint\">Mozesz wkleic pełna ścieżkę i kliknac „Uzyj tego folderu”.</p>";
            return;
          }
          currentPath = data.path || target || "";
          if (pathInput) pathInput.value = currentPath;
          if (upBtn) upBtn.disabled = !data.parent;
          upBtn.onclick = data.parent ? function () { loadDir(data.parent); } : null;
          var folders = data.folders || [];
          var files = data.files || [];
          var countHint = typeof data.file_count === "number"
            ? '<p class="dam-elements-picker__hint">W tym folderze: ' + data.file_count + " plików (AI/PDF/PNG…)</p>"
            : "";
          if (!folders.length && !files.length) {
            grid.innerHTML = countHint + "<p>Folder pusty albo bez rozpoznanych plików. Mozesz i tak uzyc „Uzyj tego folderu”.</p>";
            return;
          }
          var html = countHint;
          html += folders.map(function (f) {
            return (
              '<button type="button" class="dam-thumb-picker__item dam-thumb-picker__item--folder dam-admin-control" data-open-folder="' +
              esc(f.path) + '"><i class="uil uil-folder" aria-hidden="true"></i>' +
              '<span class="dam-thumb-picker__name">' + esc(f.name) + "</span></button>"
            );
          }).join("");
          html += files.map(function (f) {
            return (
              '<button type="button" class="dam-thumb-picker__item dam-admin-control" data-pick-path="' +
              esc(f.path) + '"><i class="uil uil-file" aria-hidden="true"></i>' +
              '<span class="dam-thumb-picker__name">' + esc(f.name) + "</span></button>"
            );
          }).join("");
          grid.innerHTML = html;
          grid.querySelectorAll("[data-open-folder]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              loadDir(btn.getAttribute("data-open-folder"));
            });
          });
          grid.querySelectorAll("[data-pick-path]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              pickTarget(btn.getAttribute("data-pick-path"));
            });
          });
        })
        .catch(function () {
          grid = document.getElementById("damElementsPickerGrid");
          if (grid) {
            grid.innerHTML = "<p>Bridge niedostępny. Wklej ścieżkę i kliknij „Uzyj tego folderu”.</p>";
          }
        });
    }

    document.getElementById("damElementsPickerGo").addEventListener("click", function () {
      if (pathInput && pathInput.value.trim()) loadDir(pathInput.value.trim());
    });
    if (pathInput) {
      pathInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && pathInput.value.trim()) loadDir(pathInput.value.trim());
      });
    }
    loadDir(startDir);
  }

  /* ------------------------------------------------------------------ */
  /* Copy buttons                                                         */
  /* ------------------------------------------------------------------ */

  function bindCopyButtons(root) {
    if (window.DamPaths && typeof window.DamPaths.bindPathActions === "function") {
      window.DamPaths.bindPathActions(root || document);
      return;
    }
    (root || document).querySelectorAll(".dam-file-copy").forEach(function (btn) {
      if (btn._damCopy) return;
      btn._damCopy = true;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var path = this.getAttribute("data-path");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(path).then(function () { showToast("Skopiowano ścieżkę"); });
        } else {
          showToast(path);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Admin controls                                                       */
  /* ------------------------------------------------------------------ */

  function exportStatusJson() {
    var data = mergeStatusStore(state.statusStore);
    data.updated_at = new Date().toISOString();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "product-status.json";
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Pobrano product-status.json");
  }

  function isAdminRole() {
    var role =
      (window.DamApi && typeof window.DamApi.role === "function" && window.DamApi.role()) ||
      localStorage.getItem("dam_role") ||
      "";
    return String(role).toLowerCase() === "admin";
  }

  function bindAdminControls() {
    var toggle = document.getElementById("damAdminToggle");
    var exportBtn = document.getElementById("damStatusExport");
    var adminSlot = document.querySelector(".dam-admin-slot");
    if (!isAdminRole()) {
      if (adminSlot) adminSlot.style.display = "none";
      else if (toggle) toggle.style.display = "none";
      if (exportBtn) exportBtn.hidden = true;
      var barHidden = document.getElementById("damAdminBar");
      if (barHidden) barHidden.style.display = "none";
      state.adminMode = false;
      localStorage.setItem(ADMIN_KEY, "0");
      return;
    }
    if (adminSlot) adminSlot.style.display = "";
    function syncAdminUi() {
      if (toggle) {
        toggle.setAttribute("aria-pressed", state.adminMode ? "true" : "false");
        toggle.classList.toggle("is-on", !!state.adminMode);
      }
      if (exportBtn) exportBtn.hidden = !state.adminMode;
      var bar = document.getElementById("damAdminBar");
      if (bar) bar.style.display = state.adminMode ? "flex" : "none";
    }
    if (toggle && !toggle._damBound) {
      toggle._damBound = true;
      state.adminMode = localStorage.getItem(ADMIN_KEY) === "1";
      syncAdminUi();
      toggle.addEventListener("click", function () {
        state.adminMode = !state.adminMode;
        localStorage.setItem(ADMIN_KEY, state.adminMode ? "1" : "0");
        syncAdminUi();
        renderAll();
      });
    }
    if (exportBtn && !exportBtn._damBound) {
      exportBtn._damBound = true;
      exportBtn.addEventListener("click", exportStatusJson);
      exportBtn.setAttribute(
        "data-dam-tip",
        "Pobierz plik product-status.json z oznaczeniami Aktualne/Nieaktualne z tej przeglądarki. Zastąp nim plik na serwerze (P:\\DAM\\data\\product-status.json), żeby statusy były wspólne dla zespołu."
      );
      exportBtn.title = "Eksport statusów wariantów (JSON)";
    }
    syncAdminUi();
  }

  /* ------------------------------------------------------------------ */
  /* Tag chips (search helper)                                            */
  /* ------------------------------------------------------------------ */

  function renderTagChips() {
    if (window.DamTagBar && typeof window.DamTagBar.bind === "function") {
      /* bind jest idempotentny (refresh); zawsze wywoluj po load indeksu */
      state._tagBar = window.DamTagBar.bind({
        tagsEl: "damSearchTags",
        inputEl: "damFileSearch",
      });
      return;
    }
    /* fallback bez dam-tag-bar.js */
    var tagsEl = document.getElementById("damSearchTags");
    var input = document.getElementById("damFileSearch");
    if (!tagsEl || !window._DAM_SEARCH_INDEX) return;
    var groups = window._DAM_SEARCH_INDEX.tag_groups || {};
    var html = "";
    ["smak", "typ", "opakowańie", "autor", "osoba"].forEach(function (gk) {
      var tags = groups[gk] || [];
      if (!tags.length) return;
      html +=
        '<div class="dam-tag-group-row">' +
        '<span class="dam-tag-group-label">' +
        esc(gk) +
        ':</span><span class="dam-tag-group-pills">';
      tags.slice(0, 24).forEach(function (t) {
        html +=
          '<button type="button" class="dam-tag-pill" data-tag="' +
          esc(t) +
          '">' +
          esc(t) +
          "</button>";
      });
      html += "</span></div>";
    });
    tagsEl.innerHTML = html;
    tagsEl.querySelectorAll(".dam-tag-pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (input) {
          input.value = this.getAttribute("data-tag");
          input.dispatchEvent(new Event("input"));
          input.focus();
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* renderAll                                                            */
  /* ------------------------------------------------------------------ */

  function renderAll() {
    renderBreadcrumb();
    renderSidebar();
    renderMain();
    var mainEl = document.getElementById("damExplorerMain");
    bindCopyButtons(mainEl);
    if (window.DamIcons && typeof window.DamIcons.bindChecklistRows === "function") {
      window.DamIcons.bindChecklistRows(mainEl);
    }
    if (mainEl) {
      mainEl.querySelectorAll(".dam-check-scroll").forEach(function (btn) {
        if (btn._damScrollBound) return;
        btn._damScrollBound = true;
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var section = btn.getAttribute("data-scroll-section");
          var card = btn.closest(".dam-carrier-card");
          var target =
            card && section ? card.querySelector('[data-check-section="' + section + '"]') : null;
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }
    if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
      window.DamBadges.bindClicks(mainEl, "explorer");
    }

    var meta = document.getElementById("damExplorerMeta");
    if (meta && state.fileIndex) {
      meta.textContent =
        (state.fileIndex.product_count || 0) + " prod. " +
        (state.fileIndex.viz_count ? " " + state.fileIndex.viz_count + " wiz." : "") +
        " indeks: " + (state.fileIndex.generated_at || "");
    }

    if (window.DamShell && typeof window.DamShell.setTrailLeaf === "function") {
      var leaf = state.product
        ? (DL ? DL.cleanProductDisplayName(state.product.display_name || state.product.name) : (state.product.display_name || state.product.name))
        : (state.canonCat || "Eksplorator");
      window.DamShell.setTrailLeaf(leaf);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Data loading                                                         */
  /* ------------------------------------------------------------------ */

  function loadStatusStore() {
    return fetch("data/product-status.json?v=20260717ux3")
      .then(function (r) { return r.ok ? r.json() : { updated_at: null, revisions: {} }; })
      .catch(function ()  { return { updated_at: null, revisions: {} }; })
      .then(function (fileData) { state.statusStore = mergeStatusStore(fileData); });
  }

  function loadAllMeta() {
    return Promise.all([loadStatusStore(), loadCarrierOverrides(), loadElementsLinks()]);
  }

  function bindExplorerData(bundle) {
    state.fileIndex = bundle.fileIndex || window._DAM_FILE_INDEX;
    if (!state.fileIndex && bundle.products) state.fileIndex = bundle;
    if (window.DamPaths && state.fileIndex && state.fileIndex.roots) {
      window.DamPaths.detectIndexBaseFromRoots(state.fileIndex.roots);
    }
    setStatus("");
    renderAll();
    renderTagChips();

    var input = document.getElementById("damFileSearch");
    var results = document.getElementById("damSearchResults");
    if (window.DamSearch && input && !input._damBound) {
      input._damBound = true;
      window.DamSearch.bindSearchBox(input, results, function (prod) { openProduct(prod); });
    }
  }

  function applyDeepLink() {
    var params = new URLSearchParams(location.search);
    var qIndex = params.get("index");
    var qProd  = params.get("product");
    if (qProd && window.DamSearch) {
      var p = window.DamSearch.productById(qProd);
      if (p) openProduct(p);
    } else if (qIndex && window.DamSearch) {
      window.DamSearch.search(qIndex).then(function (res) {
        if (res.products[0]) openProduct(res.products[0]);
      });
    }
  }

  function refreshIndex() {
    setStatus("Odświeżanie indeksu...");
    var reloader = window.DamSearch && window.DamSearch.reload
      ? window.DamSearch.reload()
      : fetch("data/file-index.json?v=" + Date.now())
          .then(function (r) { if (!r.ok) throw new Error("file-index.json"); return r.json(); })
          .then(function (d) { return { fileIndex: d }; });
    return reloader.then(function (bundle) {
      return loadAllMeta().then(function () {
        bindExplorerData(bundle);
        var gen = (state.fileIndex && state.fileIndex.generated_at) || "";
        setStatus(gen ? "Zaktualizowano: " + gen : "Zaktualizowano");
        return bundle;
      });
    }).catch(function (err) {
      setStatus("Błąd odświeżania: " + err.message);
      throw err;
    });
  }

  /* ------------------------------------------------------------------ */
  /* openProduct                                                          */
  /* ------------------------------------------------------------------ */

  function openProduct(product) {
    if (!product) return;
    state.canonCat = DL ? DL.categoryCanonId(product.category) : product.category;
    state.product  = product;
    state.expandedCarriers = {};
    state.showOlderCarriers = {};
    trackRecentProduct(product);
    renderAll();
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                 */
  /* ------------------------------------------------------------------ */

  function init() {
    var main = document.getElementById("damExplorerMain");
    if (!main) return;

    /* Tag bar NAJPIERW - zanim brand/admin cos rzuci */
    try {
      renderTagChips();
      setTimeout(renderTagChips, 50);
      setTimeout(renderTagChips, 600);
    } catch (e) { /* ignore */ }

    // Hide Geex demo sections below the live explorer shell
    var shell = document.querySelector(".dam-explorer-shell");
    if (shell) {
      var sib = shell.nextElementSibling;
      while (sib) {
        var next = sib.nextElementSibling;
        if (!sib.classList.contains("dam-explorer-shell")) {
          sib.style.display = "none";
          sib.setAttribute("aria-hidden", "true");
        }
        sib = next;
      }
    }

    var sub = document.querySelector(".geex-content__header__subtitle");
    if (sub) sub.textContent = "Pełna struktura produktów ETA - DK i GC";

    // Filtr marki: chipy DK/GC tylko przy „Kategorie” (sidebar).
    // Synchronizacja: DamBrandFilter.commitBrands / syncAllUi.
    try {
      if (window.DamBrandFilter) {
        window.DamBrandFilter.addListener(onBrandFilterChange);
        var sideBrand = document.getElementById("damSidebarBrandMount");
        if (sideBrand && typeof window.DamBrandFilter.renderChips === "function") {
          window.DamBrandFilter.renderChips(sideBrand);
        }
        state.brands = window.DamBrandFilter.loadBrands();
      }
      bindAdminControls();
      if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
        window.DamBadges.bindClicks(main, "explorer");
      }
    } catch (e) { /* ignore */ }

    setStatus("Ładowanie indeksu...");

    var loader = Promise.all([
      window.DamSearch
        ? window.DamSearch.load()
        : fetch("data/file-index.json?v=20260717ux3").then(function (r) { return r.json(); }).then(function (d) { return { fileIndex: d }; }),
      loadAllMeta()
    ]);

    loader.then(function (pair) {
      bindExplorerData(pair[0]);
      renderTagChips();
      applyDeepLink();
    }).catch(function (err) {
      setStatus("Błąd indeksu: " + err.message);
      main.innerHTML =
        '<div class="dam-explorer-empty"><p style="color:#FF5653">Nie zaladowano file-index.json</p>' +
        "<p>Uruchom: <code>python apps/web/scripts/build-file-index.py</code></p></div>";
      renderTagChips();
    });

    var refreshBtn = document.getElementById("damIndexRefresh");
    if (refreshBtn && !refreshBtn._damBound) {
      refreshBtn._damBound = true;
      refreshBtn.addEventListener("click", refreshIndex);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                           */
  /* ------------------------------------------------------------------ */

  window.damSetRevisionStatus = function (opts) {
    opts = opts || {};
    var rev = findRevisionByRef(opts.path || opts.revision_path || "", opts.index || opts.revision_index || "");
    if (!rev) {
      showToast("Nie znaleziono rewizji do zmiany statusu");
      return;
    }
    var next = opts.status;
    if (!next) {
      var cur = getRevisionStatus(rev);
      next = cur === "aktualne" ? "nieaktualne" : "aktualne";
    }
    setRevisionStatus(rev, next);
  };

  window.DamExplorer = {
    openProduct: openProduct,
    reload:      refreshIndex,
    exportStatus: exportStatusJson,
    getElementsLink: getElementsLink,
    setRevisionStatus: setRevisionStatus,
    init: init,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
