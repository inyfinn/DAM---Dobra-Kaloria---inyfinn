/**
 * DAM ETA - File Explorer v3 (nosniki ludzkie, MIXY, checklista, DK+GC)
 * Wymaga: dam-labels.js zaladowanego PRZED tym plikiem (window.DamLabels)
 */
(function () {
  "use strict";

  var DL = window.DamLabels;

  var STATUS_KEY = "dam_product_status";
  var ADMIN_KEY  = "dam_admin_mode";
  var RECENT_KEY = "dam_explorer_recent";
  var VIZ_VIEW_KEY = "dam_viz_view_mode";
  var VIZ_SCALE_KEY = "dam_viz_scale";

  var state = {
    fileIndex:        null,
    statusStore:      null,
    carrierOverrides: { overrides: {} },
    adminMode:        false,
    brands:           (window.DamBrandFilter ? window.DamBrandFilter.loadBrands() : { DK: true, GC: true }),
    canonCat:         null,
    product:          null,
    expandedCarriers: {},
    showOlderCarriers:{},
    filter:           "",
    expandedTagGroups:{},
    vizViewMode:      localStorage.getItem(VIZ_VIEW_KEY) || "tiles",
    vizScale:         parseInt(localStorage.getItem(VIZ_SCALE_KEY) || "96", 10) || 96
  };

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
    if (ext === "zip") return "uil uil-archive";
    if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp" || ext === "tif" || ext === "tiff") return "uil uil-image";
    return "uil uil-file";
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

  function setRevisionStatus(rev, status) {
    var key = revisionStatusKey(rev);
    var local = loadLocalStatus();
    if (!local.revisions) local.revisions = {};
    local.revisions[key] = { status: status, note: "" };
    if (rev.index) local.revisions[rev.index] = { status: status, note: "" };
    local.updated_at = new Date().toISOString();
    saveLocalStatus(local);
    state.statusStore = mergeStatusStore(state.statusStore);
    showToast("Zapisano lokalnie");
    renderAll();
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
    if (!DL) return code;
    if (code === "UNKNOWN") {
      // Pokaz date/indeks zamiast zgadywac
      var f = String(folder || "");
      return f || "Nosnik nieokreslony";
    }
    var gram = DL.extractGram(folder);
    return DL.carrierLabel(code, gram);
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

  function computeChecklist(rev, allProductRevisions, product) {
    var fbr = rev.files_by_role || {};
    var src  = fbr.source || [];
    var prt  = fbr.print  || [];
    var viz  = fbr.viz    || [];
    var wizki = rev.wizki || [];

    // AI / edytowalny
    var hasAI = src.some(function (f) {
      var e = fileExt(f.name);
      return e === "ai" || e === "psd" || e === "indd";
    });

    // Podglad akceptacji (PREV lub F bez FQ)
    var hasPrev = src.some(function (f) {
      if (!DL) return false;
      return DL.fileRole(f.name) === "podglad";
    }) || src.some(function (f) {
      var u = String(f.name || "").toUpperCase();
      return /\bPREV\b/.test(u) || (/[-_]F([-_.]|$)/.test(u) && !/FQ/.test(u));
    });

    // Pliki do druku
    var drukFiles = prt.filter(function (f) { return f && f.name; });
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

    // Wizualizacje
    var hasViz = viz.length > 0 || wizki.length > 0;

    // Elementy: tylko folder ELEMENTY/ELEMENTS (nie sam "MATERIALY")
    function revisionHasElements(r) {
      var slotsR = r.slots || [];
      if (slotsR.some(function (s) {
        var su = String(s).toUpperCase();
        return su.indexOf("ELEMENTY") >= 0 || su.indexOf("ELEMENTS") >= 0;
      })) return true;
      var allf = ((r.files_by_role && r.files_by_role.source) || [])
        .concat((r.files_by_role && r.files_by_role.print) || [])
        .concat((r.files_by_role && r.files_by_role.viz) || [])
        .concat((r.files_by_role && r.files_by_role.elements) || [])
        .concat(r.wizki || []);
      return allf.some(function (f) {
        var pa = String(f.path || f.name || "").toUpperCase();
        return pa.indexOf("ELEMENTY") >= 0 || pa.indexOf("ELEMENTS") >= 0 ||
          String(f.layer || "").toLowerCase() === "elements";
      });
    }
    var hasElements = revisionHasElements(rev);
    var elementsNote = "";
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
      }
    }

    // Marketing
    var hasMkt = ((product && product.related_materials) || []).some(function (m) { return m.file_count > 0; });

    return {
      ai: hasAI, prev: hasPrev, druk: hasDruk, drukarnia: drukarnia,
      viz: hasViz, elements: hasElements, elementsNote: elementsNote, marketing: hasMkt
    };
  }

  /* ------------------------------------------------------------------ */
  /* Viz grouping                                                         */
  /* ------------------------------------------------------------------ */

  function groupVizFiles(vizFiles) {
    var PERSP_ORDER = ["ENFACE", "TYL-ENFACE", "FRONT", "BACK", "INNE"];
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

  /* ------------------------------------------------------------------ */
  /* HTML builders                                                        */
  /* ------------------------------------------------------------------ */

  function renderIndexChips(indexes) {
    return (indexes || []).slice(0, 5).map(function (idx) {
      return '<span class="dam-index-chip">' + esc(idx) + "</span>";
    }).join("");
  }

  function statusBadge(status) {
    if (status === "aktualne")    return '<span class="dam-status-badge dam-status-badge--aktualne">Aktualne</span>';
    if (status === "nieaktualne") return '<span class="dam-status-badge dam-status-badge--nieaktualne">Nieaktualne</span>';
    return '<span class="dam-status-badge dam-status-badge--starsza">Starsza</span>';
  }

  function pathActions(path) {
    if (window.DamPaths && typeof window.DamPaths.pathActionsHtml === "function") {
      return window.DamPaths.pathActionsHtml(path);
    }
    return '<button type="button" class="dam-file-copy" data-path="' + esc(path) + '" title="Kopiuj sciezke"><i class="uil uil-copy" aria-hidden="true"></i></button>';
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
    return '<div class="dam-file-layer">' +
      '<div class="dam-file-layer__title">' + esc(title) + "</div>" +
      files.map(function (f) { return renderFileRow(f, role); }).join("") +
    "</div>";
  }

  function renderChecklist(cl) {
    function row(ok, label, detail) {
      var cls = ok ? "dam-check-ok" : "dam-check-brak";
      var icon = ok ? "uil-check-circle" : "uil-times-circle";
      return '<div class="' + cls + '">' +
        '<i class="uil ' + icon + ' dam-check-icon" aria-hidden="true"></i>' +
        '<span class="dam-check-label">' + esc(label) +
          (detail ? ' <span class="dam-check-detail">' + esc(detail) + "</span>" : "") +
        "</span></div>";
    }
    var drukDetail = cl.drukarnia ? "drukarnia: " + cl.drukarnia : "";
    var elemDetail = cl.elementsNote ? cl.elementsNote : (cl.elements ? "" : "BRAK");
    return '<div class="dam-checklist">' +
      row(cl.ai,       "Projekt / zrodlo (AI)", "") +
      row(cl.prev,     "Podglad akceptacji", "") +
      row(cl.druk,     "Pliki do druku", drukDetail) +
      row(cl.viz,      "Wizualizacje", "") +
      row(cl.elements, "Elementy / skladniki", elemDetail) +
      row(cl.marketing,"Materialy marketingowe", "") +
    "</div>";
  }

  function mediaUrl(indexPath) {
    if (!indexPath) return "";
    var local = window.DamPaths ? window.DamPaths.toLocal(indexPath) : indexPath;
    return "http://127.0.0.1:8766/media?path=" + encodeURIComponent(local);
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
    var allFiles = vizFiles || [];
    if (!allFiles.length) return "";
    var groups = groupVizFiles(allFiles);
    if (!groups.length) return "";

    var mode = state.vizViewMode || "tiles";
    var scale = Math.max(48, Math.min(220, state.vizScale || 96));
    var SIZE_ORDER = ["XL", "L", "S", "S-SKLEP", ""];
    var flat = [];

    var html = '<div class="dam-viz-groups dam-viz-groups--' + esc(mode) + '" style="--dam-viz-size:' + scale + 'px">';
    groups.forEach(function (g) {
      html += '<div class="dam-viz-persp-group">' +
        '<div class="dam-viz-persp-title">' + esc(g.perspective) + "</div>" +
        '<div class="dam-viz-persp-files">';
      SIZE_ORDER.forEach(function (sz) {
        var files = g.bySizes[sz] || [];
        files.forEach(function (f) {
          var ext = fileExt(f.name).toUpperCase();
          var sizeLabel = sz || "";
          var cands = thumbCandidates(f);
          var idx = flat.length;
          flat.push(f);
          if (mode === "list") {
            html += '<div class="dam-viz-list-row" data-lightbox-idx="' + idx + '">' +
              '<button type="button" class="dam-viz-list-row__open" data-lightbox-idx="' + idx + '">' +
                '<img class="dam-viz-list-row__thumb" src="' + cands[0] + '" alt="" ' +
                  'data-fallbacks="' + esc(cands.slice(1).join("|")) + '" onerror="window.__damThumbFallback&&window.__damThumbFallback(this)">' +
                '<span class="dam-viz-list-row__name">' + esc(f.name) + "</span>" +
              "</button>" +
              pathActions(f.path) +
            "</div>";
          } else {
            html += '<div class="dam-viz-mini" data-lightbox-idx="' + idx + '">' +
              '<button type="button" class="dam-viz-mini__thumb" data-lightbox-idx="' + idx + '" data-dam-tip="Podglad wizualizacji">' +
                '<img src="' + cands[0] + '" alt="' + esc(f.name) + '" ' +
                  'data-fallbacks="' + esc(cands.slice(1).join("|")) + '" ' +
                  'onerror="window.__damThumbFallback&&window.__damThumbFallback(this)">' +
                '<span class="dam-viz-mini__placeholder" hidden><i class="uil uil-image" aria-hidden="true"></i></span>' +
              "</button>" +
              '<div class="dam-viz-mini__meta">' +
                (sizeLabel ? '<span class="dam-viz-badge dam-viz-badge--index">' + esc(sizeLabel) + "</span> " : "") +
                '<span class="dam-viz-badge dam-viz-badge--' + (ext === "PNG" ? "brand" : "lang") + '">' + esc(ext) + "</span>" +
              "</div>" +
              '<div class="dam-viz-mini__actions">' + pathActions(f.path) + "</div>" +
            "</div>";
          }
        });
      });
      html += "</div></div>";
    });
    html += "</div>";
    state._lightboxFiles = flat;
    return html;
  }

  function renderMarketingSection(materials) {
    var mats = (materials || []).filter(function (m) { return m.title; });
    if (!mats.length) return "";
    var html = '<div class="dam-file-layer"><div class="dam-file-layer__title">Materialy marketingowe</div>';
    mats.forEach(function (m) {
      html += '<div class="dam-marketing-row">' +
        '<div class="dam-marketing-row__body">' +
          '<div class="dam-marketing-row__title">' + esc(m.title) + "</div>" +
          '<div class="dam-marketing-row__path">' + esc(m.path) + "</div>" +
          '<div class="dam-marketing-row__meta">' + esc(m.type || "marketing") +
            (m.file_count ? " - " + m.file_count + " plikow" : "") +
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
      '<button type="button" class="dam-admin-btn dam-admin-btn--ok" data-ridx="' + idx + '" data-status="aktualne">Aktualne</button>' +
      '<button type="button" class="dam-admin-btn dam-admin-btn--no" data-ridx="' + idx + '" data-status="nieaktualne">Nieaktualne</button>' +
    "</div>";
  }

  /* ------------------------------------------------------------------ */
  /* Carrier card                                                         */
  /* ------------------------------------------------------------------ */

  function renderCarrierCard(code, currentRevs, olderRevs, product, allProductRevisions) {
    var rev = currentRevs[0]; // primary current revision
    if (!rev) return "";

    var label = carrierLabel(code, rev.folder);
    if (code === "UNKNOWN") {
      label = "Nosnik nieokreslony";
      if (rev.folder) label += " · " + rev.folder;
    }
    var st = getRevisionStatus(rev);
    var cardId = "dam-carrier-" + esc(code);
    var isExpanded = !!state.expandedCarriers[code];
    var showOlder = !!state.showOlderCarriers[code];

    // Gather all viz files from current revision(s)
    var allViz = [];
    currentRevs.forEach(function (r) {
      allViz = allViz.concat((r.files_by_role && r.files_by_role.viz) || []).concat(r.wizki || []);
    });

    var cl = computeChecklist(rev, allProductRevisions, product);

    // Current revision tags
    var tags = "";
    if (rev.index) tags += '<span class="dam-index-chip">' + esc(rev.index) + "</span> ";
    if (rev.date)  tags += '<span class="dam-date-chip">' + esc(rev.date) + "</span> ";
    tags += statusBadge(st);

    // Extra current revisions (admin marked multiple)
    var extraCurrHtml = "";
    currentRevs.slice(1).forEach(function (r2, i) {
      var st2 = getRevisionStatus(r2);
      extraCurrHtml += '<div class="dam-carrier-extra-rev">' +
        '<span class="dam-rev-row__folder">' + esc(r2.folder) + "</span> " +
        statusBadge(st2) +
        renderAdminRevButtons(r2, "extra_" + i) +
      "</div>";
    });

    // Older revisions section
    var olderHtml = "";
    if (olderRevs.length > 0) {
      olderHtml = '<div class="dam-carrier-older">' +
        '<button type="button" class="dam-show-older-btn" data-code="' + esc(code) + '">' +
          (showOlder ? "Ukryj starsze" : "Pokaz starsze (" + olderRevs.length + ")") +
        "</button>";
      if (showOlder) {
        olderHtml += '<div class="dam-older-revs">';
        olderRevs.forEach(function (r, ri) {
          var ost = getRevisionStatus(r);
          olderHtml += '<div class="dam-older-rev-row">' +
            '<span class="dam-rev-row__folder">' + esc(r.folder) + "</span> " +
            (r.index ? '<span class="dam-index-chip">' + esc(r.index) + "</span> " : "") +
            statusBadge(ost) +
            renderAdminRevButtons(r, "older_" + ri) +
          "</div>";
        });
        olderHtml += "</div>";
      }
      olderHtml += "</div>";
    }

    // Full detail (shown when expanded)
    var detailHtml = "";
    if (isExpanded) {
      var fbr = rev.files_by_role || {};
      detailHtml =
        renderChecklist(cl) +
        renderFileSection("Projekt / zrodlo", fbr.source, "source") +
        renderFileSection("Pliki do druku",   fbr.print,  "print") +
        renderVizGroups(allViz) +
        renderMarketingSection(product.related_materials) +
        extraCurrHtml +
        olderHtml +
        (state.adminMode ? renderAdminRevButtons(rev, "curr") : "");
    }

    return '<div class="dam-carrier-card' + (isExpanded ? " is-expanded" : "") + '" id="' + cardId + '">' +
      '<div class="dam-carrier-toggle-row">' +
        '<button type="button" class="dam-carrier-toggle" data-toggle-code="' + esc(code) + '" aria-expanded="' + isExpanded + '">' +
          '<div class="dam-carrier-toggle__left">' +
            '<span class="dam-carrier-toggle__label">' + esc(label) + "</span>" +
            '<div class="dam-carrier-toggle__chips">' + tags + "</div>" +
          "</div>" +
          '<i class="uil dam-carrier-chevron ' + (isExpanded ? "uil-angle-up" : "uil-angle-down") + '" aria-hidden="true"></i>' +
        "</button>" +
        '<div class="dam-carrier-toggle__actions" data-dam-tip="Akcje dla folderu wariantu">' +
          pathActions(rev.path || "") +
        "</div>" +
      "</div>" +
      '<div class="dam-carrier-body"' + (isExpanded ? "" : ' hidden') + ">" +
        detailHtml +
      "</div>" +
    "</div>";
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
      var pName = DL ? DL.cleanProductDisplayName(state.product.display_name || state.product.name) : (state.product.display_name || state.product.name);
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
      mount.innerHTML = '<div class="dam-explorer-empty">Ladowanie indeksu dysku...</div>';
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
        '<h5 class="dam-explorer-panel__title">Eksplorator plikow DAM ETA</h5>' +
        '<p class="dam-explorer-panel__lead">Wybierz kategorie po lewej lub wyszukaj indeks / skojarzenie (np. <strong>6300</strong>, <strong>czekolada</strong>).</p>' +
        '<div class="dam-welcome-section"><div class="dam-welcome-section__title">Szybkie linki</div>' +
        '<div class="dam-welcome-links">' +
          '<a href="visualizations.html" class="dam-welcome-link"><i class="uil uil-image" aria-hidden="true"></i> Wizualizacje</a>' +
          '<button type="button" class="dam-welcome-link" data-focus-search="1"><i class="uil uil-search" aria-hidden="true"></i> Szukaj indeksu</button>' +
        "</div></div>" + recentHtml +
        '<p class="dam-welcome-hint">' + (state.fileIndex.product_count || 0) + " produktow - wybierz kategorie z panelu bocznego.</p>" +
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

      function prodRowHtml(p) {
        var name = DL ? DL.cleanProductDisplayName(p.display_name || p.name) : (p.display_name || p.name);
        var brand = getProductBrand(p);
        return '<div class="dam-prod-row" data-pid="' + esc(p.id) + '">' +
          '<div class="dam-prod-row__main">' +
            '<div class="dam-prod-row__title">' + esc(name) + "</div>" +
            '<div class="dam-prod-row__sub">' +
              renderIndexChips(p.indexes) +
              (brand === "GC" ? ' <span class="dam-brand-chip dam-brand-chip--gc">GC</span>' : "") +
            "</div>" +
          "</div>" +
          '<div class="dam-prod-row__revcount">' + (p.revision_count || 0) + " rew.</div>" +
        "</div>";
      }

      var html = '<div class="dam-explorer-panel">' +
        '<h5 class="dam-explorer-panel__title">' + esc(catTitle) + "</h5>";

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
    var pName = DL ? DL.cleanProductDisplayName(state.product.display_name || state.product.name) : (state.product.display_name || state.product.name);
    var mode = state.vizViewMode || "tiles";
    var scale = state.vizScale || 96;

    var html2 = '<div class="dam-explorer-panel">' +
      '<div class="dam-product-toolbar">' +
        '<div class="dam-product-toolbar__main">' +
          '<h5 class="dam-explorer-panel__title">' + esc(pName) + "</h5>" +
          '<p class="dam-explorer-panel__lead">' + groups.length + " typ" + (groups.length === 1 ? "" : "y") +
            " nosnika. Kliknij, aby rozwinac szczegoly.</p>" +
        "</div>" +
        '<div class="dam-product-toolbar__slot1" id="damProductBrandMount" data-dam-tip="Filtr marki DK / GC"></div>' +
        '<div class="dam-product-toolbar__slot2" id="damVizViewControls">' +
          '<div class="dam-viz-viewbar" role="group" aria-label="Widok wizualizacji">' +
            '<button type="button" class="dam-viz-viewbtn' + (mode === "tiles" ? " is-active" : "") + '" data-viz-mode="tiles" data-dam-tip="Kafelki">Kafelki</button>' +
            '<button type="button" class="dam-viz-viewbtn' + (mode === "list" ? " is-active" : "") + '" data-viz-mode="list" data-dam-tip="Lista">Lista</button>' +
            '<label class="dam-viz-scale" data-dam-tip="Skala miniatur">' +
              '<span>Skala</span>' +
              '<input type="range" id="damVizScale" min="48" max="180" step="8" value="' + scale + '">' +
            "</label>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="dam-carrier-list">';

    if (groups.length === 0) {
      html2 += '<div class="dam-explorer-empty">Brak danych o nosnikach. Sprawdz indeks dysku.</div>';
    } else {
      groups.forEach(function (g) {
        var curRevs = getCurrentRevisions(g.revisions);
        var oldRevs = getOlderRevisions(g.revisions, curRevs);
        html2 += renderCarrierCard(g.code, curRevs, oldRevs, state.product, allRevisions);
      });
    }

    html2 += "</div>" +
      '<div class="dam-add-variant-wrap">' +
        '<button type="button" class="geex-btn dam-add-variant-btn" id="damAddVariantBtn" data-dam-tip="Wskaz folder wariantu i zmapuj go do bazy">' +
          "Nie widzisz wariantu? Dodaj go</button>" +
      "</div>" +
    "</div>";
    mount.innerHTML = html2;

    bindProductToolbar(mount);
    bindCarrierInteractions(mount);
    bindCopyButtons(mount);
    if (window.DamTooltips && typeof window.DamTooltips.refresh === "function") {
      window.DamTooltips.refresh(mount);
    }
  }

  function bindProductToolbar(mount) {
    var brandMount = document.getElementById("damProductBrandMount");
    if (brandMount && window.DamBrandFilter && typeof window.DamBrandFilter.renderChips === "function") {
      window.DamBrandFilter.renderChips(brandMount, function (brands) {
        state.brands = brands;
        renderSidebar();
        renderMain();
      });
    } else if (brandMount) {
      brandMount.innerHTML =
        '<button type="button" class="dam-filter-trigger" id="damProductBrandTrigger"></button>';
      if (window.DamBrandFilter) {
        window.DamBrandFilter.init("#damProductBrandTrigger", function (brands) {
          state.brands = brands;
          renderSidebar();
          renderMain();
        });
      }
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
        state.vizScale = parseInt(this.value, 10) || 96;
        localStorage.setItem(VIZ_SCALE_KEY, String(state.vizScale));
        mount.querySelectorAll(".dam-viz-groups").forEach(function (el) {
          el.style.setProperty("--dam-viz-size", state.vizScale + "px");
        });
      });
      scaleEl.addEventListener("change", function () {
        renderMain();
      });
    }

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
    // Bind carrier toggle
    mount.querySelectorAll("[data-toggle-code]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var code = this.getAttribute("data-toggle-code");
        state.expandedCarriers[code] = !state.expandedCarriers[code];
        renderMain();
        var card = document.getElementById("dam-carrier-" + code);
        if (card && state.expandedCarriers[code]) {
          setTimeout(function () {
            card.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 60);
        }
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
    var files = state._lightboxFiles || [];
    if (!files.length) return;
    var idx = Math.max(0, Math.min(files.length - 1, startIdx || 0));

    function paint() {
      var f = files[idx];
      var overlay = document.getElementById("damLightbox");
      if (!overlay) return;
      var img = overlay.querySelector(".dam-lightbox__img");
      var title = overlay.querySelector(".dam-lightbox__title");
      var counter = overlay.querySelector(".dam-lightbox__counter");
      var cands = thumbCandidates(f);
      if (img) {
        img.onerror = function () { window.__damThumbFallback(img); };
        img.setAttribute("data-fallbacks", cands.slice(1).join("|"));
        img.src = cands[0];
        img.alt = f.name || "";
      }
      if (title) title.textContent = f.name || "";
      if (counter) counter.textContent = (idx + 1) + " / " + files.length;
      var prev = overlay.querySelector("[data-lb-prev]");
      var next = overlay.querySelector("[data-lb-next]");
      if (prev) prev.disabled = idx <= 0;
      if (next) next.disabled = idx >= files.length - 1;
    }

    var existing = document.getElementById("damLightbox");
    if (existing) existing.remove();

    var html =
      '<div class="dam-lightbox" id="damLightbox" role="dialog" aria-modal="true" aria-label="Podglad wizualizacji">' +
        '<button type="button" class="dam-lightbox__close" data-lb-close aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
        '<button type="button" class="dam-lightbox__nav dam-lightbox__nav--prev" data-lb-prev aria-label="Poprzedni"><i class="uil uil-angle-left"></i></button>' +
        '<button type="button" class="dam-lightbox__nav dam-lightbox__nav--next" data-lb-next aria-label="Nastepny"><i class="uil uil-angle-right"></i></button>' +
        '<div class="dam-lightbox__stage"><img class="dam-lightbox__img" alt=""></div>' +
        '<div class="dam-lightbox__footer">' +
          '<div class="dam-lightbox__title"></div>' +
          '<div class="dam-lightbox__counter"></div>' +
          '<div class="dam-lightbox__actions" id="damLightboxActions"></div>' +
        "</div>" +
      "</div>";
    document.body.insertAdjacentHTML("beforeend", html);
    var overlay = document.getElementById("damLightbox");

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft" && idx > 0) { idx -= 1; paint(); syncActions(); }
      if (e.key === "ArrowRight" && idx < files.length - 1) { idx += 1; paint(); syncActions(); }
    }
    function syncActions() {
      var box = document.getElementById("damLightboxActions");
      if (box && files[idx]) box.innerHTML = pathActions(files[idx].path || "");
      if (window.DamPaths) window.DamPaths.bindPathActions(box);
    }

    overlay.querySelector("[data-lb-close]").addEventListener("click", close);
    overlay.querySelector("[data-lb-prev]").addEventListener("click", function () {
      if (idx > 0) { idx -= 1; paint(); syncActions(); }
    });
    overlay.querySelector("[data-lb-next]").addEventListener("click", function () {
      if (idx < files.length - 1) { idx += 1; paint(); syncActions(); }
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", onKey);
    paint();
    syncActions();
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
          '<h3 id="damAddVariantTitle">Dodaj / popraw wariant</h3>' +
          '<p class="dam-basepath-lead">Wklej sciezke folderu wariantu (z D: lub Twojej bazy). Okresl typ nosnika i status. Rynek (DK/GC) rozpoznamy ze sciezki.</p>' +
          '<label class="dam-basepath-label" for="damAddVariantPath">Sciezka folderu</label>' +
          '<input type="text" id="damAddVariantPath" class="dam-basepath-input" placeholder="D:\\Marketing\\- POLSKA\\01 - PRODUKTY\\...">' +
          '<label class="dam-basepath-label" for="damAddVariantCarrier">Typ nosnika</label>' +
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
    document.getElementById("damAddVariantSave").addEventListener("click", function () {
      var pathRaw = (document.getElementById("damAddVariantPath").value || "").trim();
      var carrier = document.getElementById("damAddVariantCarrier").value;
      var status = document.getElementById("damAddVariantStatus").value;
      var market = (document.getElementById("damAddVariantMarket").dataset.market) || "";
      if (!pathRaw) { showToast("Podaj sciezke folderu"); return; }
      if (!carrier || carrier === "UNKNOWN") {
        showToast("Wybierz konkretny typ nosnika - nie zapisujemy UNKNOWN");
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
        showToast("Zapisano mapowanie nosnika");
        modal.remove();
        return loadCarrierOverrides().then(function () { renderMain(); });
      }).catch(function (err) {
        showToast("Blad zapisu: " + (err && err.message ? err.message : "bridge"));
      });
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
    return fetch("http://127.0.0.1:8766/carrier-override", {
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
          navigator.clipboard.writeText(path).then(function () { showToast("Skopiowano sciezke"); });
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

  function bindAdminControls() {
    var toggle = document.getElementById("damAdminToggle");
    var exportBtn = document.getElementById("damStatusExport");
    if (toggle && !toggle._damBound) {
      toggle._damBound = true;
      state.adminMode = localStorage.getItem(ADMIN_KEY) === "1";
      toggle.checked = state.adminMode;
      toggle.addEventListener("change", function () {
        state.adminMode = !!this.checked;
        localStorage.setItem(ADMIN_KEY, state.adminMode ? "1" : "0");
        var bar = document.getElementById("damAdminBar");
        var expBtn = document.getElementById("damStatusExport");
        if (bar) bar.style.display = state.adminMode ? "flex" : "none";
        if (expBtn) expBtn.style.display = state.adminMode ? "inline-flex" : "none";
        renderAll();
      });
    }
    if (exportBtn && !exportBtn._damBound) {
      exportBtn._damBound = true;
      exportBtn.addEventListener("click", exportStatusJson);
      exportBtn.style.display = state.adminMode ? "inline-flex" : "none";
    }
    var bar = document.getElementById("damAdminBar");
    if (bar) bar.style.display = state.adminMode ? "flex" : "none";
  }

  /* ------------------------------------------------------------------ */
  /* Tag chips (search helper)                                            */
  /* ------------------------------------------------------------------ */

  var TAG_CAP = 8;
  var TAG_GROUP_LABELS = { smak: "Smak", typ: "Typ", opakowanie: "Opakowanie", osoba: "Osoba" };
  var TAG_GROUP_CLASS  = { smak: "dam-tag-group--smak", typ: "dam-tag-group--typ", opakowanie: "dam-tag-group--opakowanie", osoba: "dam-tag-group--osoba" };

  function renderTagChips() {
    var tagsEl = document.getElementById("damSearchTags");
    var input  = document.getElementById("damFileSearch");
    if (!tagsEl || !window._DAM_SEARCH_INDEX) return;
    var groups = window._DAM_SEARCH_INDEX.tag_groups || {};
    var html = "";
    ["smak", "typ", "opakowanie", "osoba"].forEach(function (gk) {
      var tags = groups[gk] || [];
      if (!tags.length) return;
      var expanded = state.expandedTagGroups[gk];
      var visible = expanded ? tags : tags.slice(0, TAG_CAP);
      html += '<div class="dam-tag-group-row ' + (TAG_GROUP_CLASS[gk] || "") + '">' +
        '<span class="dam-tag-group-label">' + esc(TAG_GROUP_LABELS[gk] || gk) + ":</span>" +
        '<span class="dam-tag-group-pills">';
      visible.forEach(function (t) {
        html += '<button type="button" class="dam-tag-pill" data-tag="' + esc(t) + '">' + esc(t) + "</button>";
      });
      if (tags.length > TAG_CAP && !expanded) {
        html += '<button type="button" class="dam-tag-more" data-group="' + gk + '">wiecej</button>';
      }
      html += "</span></div>";
    });
    tagsEl.innerHTML = html;
    tagsEl.querySelectorAll(".dam-tag-pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (input) { input.value = this.getAttribute("data-tag"); input.dispatchEvent(new Event("input")); input.focus(); }
      });
    });
    tagsEl.querySelectorAll(".dam-tag-more").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.expandedTagGroups[this.getAttribute("data-group")] = true;
        renderTagChips();
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
    bindCopyButtons(document.getElementById("damExplorerMain"));

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
    return Promise.all([loadStatusStore(), loadCarrierOverrides()]);
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
    setStatus("Odswiezanie indeksu...");
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
      setStatus("Blad odswiezania: " + err.message);
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
    if (sub) sub.textContent = "Pelna struktura produktow ETA - DK i GC";

    // Inicjuj dropdown filtru marki w toolbarze
    if (window.DamBrandFilter) {
      var triggerBtn = document.getElementById("damBrandFilterTrigger");
      if (triggerBtn) {
        window.DamBrandFilter.init(triggerBtn, function (brands) {
          state.brands = brands;
          renderAll();
        });
        // Sync initial state
        state.brands = window.DamBrandFilter.loadBrands();
      }
    }

    bindAdminControls();
    setStatus("Ladowanie indeksu...");

    var loader = Promise.all([
      window.DamSearch
        ? window.DamSearch.load()
        : fetch("data/file-index.json?v=20260717ux3").then(function (r) { return r.json(); }).then(function (d) { return { fileIndex: d }; }),
      loadAllMeta()
    ]);

    loader.then(function (pair) {
      bindExplorerData(pair[0]);
      applyDeepLink();
    }).catch(function (err) {
      setStatus("Blad indeksu: " + err.message);
      main.innerHTML =
        '<div class="dam-explorer-empty"><p style="color:#FF5653">Nie zaladowano file-index.json</p>' +
        "<p>Uruchom: <code>python apps/web/scripts/build-file-index.py</code></p></div>";
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

  window.DamExplorer = {
    openProduct: openProduct,
    reload:      refreshIndex,
    exportStatus: exportStatusJson
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
