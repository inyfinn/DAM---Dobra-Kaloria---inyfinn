/**
 * DAM Explorer - Dodaj produkt / kategorię (EXP-B, redesign EXP-C 2026-07-20).
 * Dry-run preview → confirm → POST /explorer/create-* → index rebuild.
 * Redesign: live preview bez zargonu, edytowalny licznik kategorii, warianty
 * domyślnie odznaczone (tag + podgląd nazwy), hierarchia folderów, status
 * bez pustej czerwonej ramki, potwierdzenie po utworzeniu z cofnięciem (~2 min),
 * nowy wariant globalny (naming-dictionary + carrier-types), Geex checkboxy.
 */
(function (global) {
  "use strict";

  var MODAL_ID = "damExplorerCreateModal";
  var STYLE_ID = "damExplorerCreateModalCss";
  var EM_DASH = "\u2014";
  var UNDO_WINDOW_SECONDS = 120;

  function bridgeUrl() {
    if (global.DamRuntime && typeof global.DamRuntime.bridgeUrl === "function") {
      return global.DamRuntime.bridgeUrl();
    }
    if (global.DamPaths && typeof global.DamPaths.bridgeUrl === "function") {
      return global.DamPaths.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    var tok =
      (global.DamApi && typeof global.DamApi.token === "function" && global.DamApi.token()) ||
      localStorage.getItem("dam_token") ||
      "";
    if (tok) h.Authorization = "Bearer " + tok;
    return h;
  }

  function ensureSession() {
    if (global.DamApi && typeof global.DamApi.ensureSession === "function") {
      return global.DamApi.ensureSession();
    }
    return Promise.resolve({ ok: true });
  }

  function toast(msg, kind) {
    var el = document.getElementById("damExplorerToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damExplorerToast";
      el.className = "dam-explorer-toast";
      document.body.appendChild(el);
    }
    el.className = "dam-explorer-toast dam-explorer-toast--" + (kind || "info") + " is-visible";
    el.textContent = msg;
    clearTimeout(el._damTimer);
    el._damTimer = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 3200);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function detectBrand() {
    try {
      if (global.DamBrandFilter && typeof global.DamBrandFilter.loadBrands === "function") {
        var b = global.DamBrandFilter.loadBrands();
        if (b.DK && !b.GC) return "DK";
        if (b.GC && !b.DK) return "GC";
      }
    } catch (e) { /* ignore */ }
    var ex = global.DamExplorer;
    if (ex && ex.state && ex.state.brands) {
      if (ex.state.brands.DK && !ex.state.brands.GC) return "DK";
      if (ex.state.brands.GC && !ex.state.brands.DK) return "GC";
    }
    return "DK";
  }

  function resolveCategoryPath(catCtx) {
    catCtx = catCtx || {};
    var id = String(catCtx.id || catCtx.canonCat || "").trim();
    var title = String(catCtx.title || "").trim();
    var ex = global.DamExplorer;
    var idx = (ex && ex.state && ex.state.fileIndex) || null;
    var products = (idx && (idx.products || idx.items)) || [];
    if (!Array.isArray(products) && idx && typeof idx === "object") {
      products = Object.keys(idx.products || {}).map(function (k) {
        return idx.products[k];
      });
    }
    var labels = [];
    var DL = global.DamLabels;
    if (DL && DL.CATEGORY_CANON) {
      DL.CATEGORY_CANON.forEach(function (c) {
        if (c.id === id || c.title === title) {
          labels = (c.labels || []).concat([c.title, c.id]);
        }
      });
    }
    if (!labels.length && (id || title)) labels = [id, title];

    function matchFolder(folderName) {
      var bare = String(folderName || "")
        .replace(/^\s*\d+\s*[-–—]\s*/u, "")
        .trim()
        .toUpperCase();
      for (var i = 0; i < labels.length; i++) {
        var L = String(labels[i] || "").toUpperCase();
        if (!L) continue;
        if (bare === L || bare.indexOf(L) === 0) return true;
      }
      return false;
    }

    for (var p = 0; p < products.length; p++) {
      var prod = products[p];
      if (!prod) continue;
      var path = String(prod.path || prod.folder || "");
      if (!path) continue;
      var parts = path.replace(/\//g, "\\").split("\\").filter(Boolean);
      for (var j = parts.length - 1; j >= 0; j--) {
        if (matchFolder(parts[j])) {
          return parts.slice(0, j + 1).join("\\");
        }
      }
      var cid = prod.category_id || prod.category || prod.canon_cat;
      if (cid && String(cid).toUpperCase() === id.toUpperCase() && parts.length >= 2) {
        return parts.slice(0, parts.length - 1).join("\\");
      }
    }
    if (title) return title.toUpperCase();
    return id;
  }

  /* ---------------------------------------------------------------------
   * Client-side path preview (mirror apps/desktop/explorer_create.py) -
   * kosmetyczny podglad na biezaco, autorytatywny wynik zawsze z mostu
   * (dry-run). Zgodnie z program-instructions explorer.create_modal_ux.
   * ------------------------------------------------------------------- */
  var BRAND_REL = {
    DK: ["- POLSKA", "01 - PRODUKTY", "- DK"],
    GC: ["- EKSPORT", "01 - PRODUCTS", "- GC"]
  };
  var PLACEHOLDER_DATE_TOKENS = ["DD MM RRRR", "DD MM YYYY", "DD_MM_YYYY", "DD.MM.RRRR"];
  var PLACEHOLDER_INDEX_RE = /6300XXX(?:\.\d+)?/gi;
  var DEMO_INDEX_RE = /^6300XXX(?:\.\d+)?$/i;

  function winJoin() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      var seg = String(arguments[i] || "").replace(/^[\\\/]+|[\\\/]+$/g, "");
      if (seg) parts.push(seg);
    }
    return parts.join("\\");
  }

  function getBasePathGuess() {
    try {
      if (global.DamPaths && typeof global.DamPaths.getBasePath === "function") {
        return String(global.DamPaths.getBasePath() || "").replace(/[\\\/]+$/, "");
      }
    } catch (e) { /* ignore */ }
    try {
      return String(localStorage.getItem("dam_base_path") || "").replace(/[\\\/]+$/, "");
    } catch (e2) {
      return "";
    }
  }

  function looksAbsolute(p) {
    p = String(p || "").trim();
    return /^[A-Za-z]:[\\\/]/.test(p) || /^\\\\/.test(p);
  }

  function pad2(n) {
    n = parseInt(n, 10);
    if (!n || n < 1) n = 1;
    return n < 10 ? "0" + n : String(n);
  }

  function categoryFolderName(seq, name) {
    var n = String(name || "").trim().toUpperCase() || "NAZWA";
    return pad2(seq) + " - " + n;
  }

  function guessCategoryRoot(brand) {
    var base = getBasePathGuess();
    var rel = BRAND_REL[brand] || BRAND_REL.DK;
    if (!base) return winJoin.apply(null, rel);
    return winJoin.apply(null, [base].concat(rel));
  }

  function guessCategoryFullPath(brand, seq, name) {
    return winJoin(guessCategoryRoot(brand), categoryFolderName(seq, name));
  }

  function productFolderPreview(name, sub, demo) {
    var n = String(name || "").trim().toUpperCase() || "NAZWA";
    var s = String(sub || "").trim().toLowerCase() || "podkategoria";
    var base = n + " " + EM_DASH + " [ " + s + " ]";
    if (demo) base += " - D";
    return base;
  }

  function guessCategoryPathForProduct(brand, catPathValue) {
    var raw = String(catPathValue || "").trim();
    if (!raw) return "";
    if (looksAbsolute(raw)) return raw.replace(/\//g, "\\");
    return winJoin(guessCategoryRoot(brand), raw);
  }

  function guessProductFullPath(brand, catPathValue, name, sub, demo) {
    var catFull = guessCategoryPathForProduct(brand, catPathValue);
    var folder = productFolderPreview(name, sub, demo);
    if (!catFull) return folder;
    return winJoin(catFull, folder);
  }

  function isDemoIndexClient(idx) {
    idx = String(idx || "").trim();
    if (!idx) return true;
    return DEMO_INDEX_RE.test(idx);
  }

  function appendDemoSuffixClient(name, apply) {
    name = String(name || "").replace(/\s+$/, "");
    if (!apply) return name;
    if (/\s-\sD$/i.test(name)) return name;
    return name + " - D";
  }

  function replacePlaceholdersClient(text, date, index) {
    var out = String(text || "");
    date = String(date || "").trim();
    index = String(index || "").trim();
    if (date) {
      PLACEHOLDER_DATE_TOKENS.forEach(function (tok) {
        out = out.split(tok).join(date);
      });
    }
    if (index) {
      out = out.replace(PLACEHOLDER_INDEX_RE, index);
    }
    return out;
  }

  function variantFolderPreviewClient(templateFolder, date, index, forceDemo) {
    var demo = !!forceDemo || isDemoIndexClient(index);
    var replaced = replacePlaceholdersClient(templateFolder, date, index);
    return appendDemoSuffixClient(replaced, demo);
  }

  function variantTagLabel(templateFolder) {
    var DL = global.DamLabels;
    try {
      if (DL && typeof DL.parseCarrierCode === "function") {
        var code = DL.parseCarrierCode(templateFolder);
        if (code && code !== "UNKNOWN" && typeof DL.carrierLabel === "function") {
          var label = DL.carrierLabel(code);
          if (label) return label;
        }
      }
    } catch (e) { /* ignore */ }
    var first = String(templateFolder || "").split(" - ")[0] || templateFolder || "?";
    return first.trim().toUpperCase();
  }

  function iconTree(name) {
    return '<i class="uil uil-' + esc(name) + '" aria-hidden="true"></i>';
  }

  /* ------------------------------------------------------------------- */

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      "#" + MODAL_ID + "{position:fixed;inset:0;z-index:12400;display:flex;align-items:center;justify-content:center;font-size:13px;}" +
      "#" + MODAL_ID + "[hidden]{display:none!important}" +
      "#" + MODAL_ID + " .dam-exp-create__backdrop{position:absolute;inset:0;background:rgba(28,22,40,.45)}" +
      "#" + MODAL_ID + " .dam-exp-create__panel{position:relative;z-index:1;width:min(920px,92vw);max-height:min(88vh,920px);overflow:auto;" +
      "background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(40,30,60,.22);padding:26px 32px 30px;" +
      "display:flex;flex-direction:column;gap:14px;font-size:13px;line-height:1.42;color:#464255}" +
      "#" + MODAL_ID + " .dam-exp-create__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}" +
      "#" + MODAL_ID + " .dam-exp-create__eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ab54db;margin:0 0 4px}" +
      "#" + MODAL_ID + " .dam-exp-create__title{margin:0;font-size:20px;font-weight:700;color:#1f1a2a}" +
      "#" + MODAL_ID + " .dam-exp-create__sub{margin:5px 0 0;font-size:12.5px;color:#6b6578}" +
      "#" + MODAL_ID + " .dam-exp-create__grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}" +
      "#" + MODAL_ID + " .dam-exp-create__field{display:flex;flex-direction:column;gap:5px;min-width:0}" +
      "#" + MODAL_ID + " .dam-exp-create__field--full{grid-column:1/-1}" +
      "#" + MODAL_ID + " .dam-exp-create__field--seq{max-width:130px}" +
      "#" + MODAL_ID + " label{font-size:11.5px;font-weight:600;color:#6b6578;text-transform:uppercase;letter-spacing:.03em}" +
      "#" + MODAL_ID + " input[type=text],#" + MODAL_ID + " input[type=number],#" + MODAL_ID + " select{" +
      "height:34px;border:1px solid #e7e2ef;border-radius:8px;padding:0 11px;font-size:13px;line-height:1;color:#302b3d;background:#fff}" +
      "#" + MODAL_ID + " input:focus,#" + MODAL_ID + " select:focus{outline:2px solid rgba(171,84,219,.35);outline-offset:1px;border-color:#ab54db}" +
      "#" + MODAL_ID + " input[type=checkbox]{width:16px;height:16px;accent-color:var(--dam-primary,#AB54DB);cursor:pointer;margin:0}" +
      "#" + MODAL_ID + " .dam-exp-create__checkline{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:500;color:#464255;" +
      "text-transform:none;cursor:pointer}" +
      "#" + MODAL_ID + " .dam-exp-create__preview{background:#f7f4fb;border:1px solid #ebe4f4;border-radius:10px;padding:11px 13px;" +
      "font-size:12.5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#3d3550;word-break:break-all;line-height:1.5}" +
      "#" + MODAL_ID + " .dam-exp-create__preview b{font-weight:700;color:#1f1a2a;font-family:inherit}" +
      "#" + MODAL_ID + " .dam-exp-create__status{font-size:12.5px;min-height:0;display:flex;align-items:center;gap:6px;border-radius:8px;" +
      "padding:0;transition:padding .15s ease}" +
      "#" + MODAL_ID + " .dam-exp-create__status:empty{display:none}" +
      "#" + MODAL_ID + " .dam-exp-create__status.is-error{color:#b42318;background:#fdf1f0;padding:8px 12px;border:1px solid #f6d9d6}" +
      "#" + MODAL_ID + " .dam-exp-create__status.is-info{color:#6b3fa0;background:#f7f2fb;padding:7px 12px;border:1px solid #ebdff5}" +
      "#" + MODAL_ID + " .dam-exp-create__status.is-ok{color:#1a7a4c;background:#f0faf4;padding:7px 12px;border:1px solid #d3ede0}" +
      "#" + MODAL_ID + " .dam-exp-create__tree{border:1px dashed #e7e2ef;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:4px}" +
      "#" + MODAL_ID + " .dam-exp-create__tree:empty{display:none;padding:0;border:0}" +
      "#" + MODAL_ID + " .dam-exp-create__tree-title{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9a93ab;margin:0 0 2px}" +
      "#" + MODAL_ID + " .dam-exp-create__tree-row{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#3d3550}" +
      "#" + MODAL_ID + " .dam-exp-create__tree-row i{color:#ab54db;font-size:15px}" +
      "#" + MODAL_ID + " .dam-exp-create__tree-row--child{margin-left:22px;color:#5c5468}" +
      "#" + MODAL_ID + " .dam-exp-create__tree-row--child i{color:#c6a8e0;font-size:14px}" +
      "#" + MODAL_ID + " .dam-exp-create__tree-row--muted{color:#9a93ab;font-style:italic}" +
      "#" + MODAL_ID + " .dam-exp-create__variants-head{display:flex;flex-direction:column;gap:1px}" +
      "#" + MODAL_ID + " .dam-exp-create__variants-hint{font-size:11.5px;font-weight:500;color:#9a93ab;text-transform:none;letter-spacing:0}" +
      "#" + MODAL_ID + " .dam-exp-create__variants{display:flex;flex-direction:column;gap:2px;max-height:230px;overflow:auto;border:1px solid #ece7f3;border-radius:10px;padding:6px}" +
      "#" + MODAL_ID + " .dam-exp-create__var-legend,#" + MODAL_ID + " .dam-exp-create__var{display:grid;" +
      "grid-template-columns:26px 108px 106px 122px 1fr;gap:8px;align-items:center;font-size:12px;padding:6px 6px}" +
      "#" + MODAL_ID + " .dam-exp-create__var-legend{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#b0a9c0;padding-bottom:2px;border-bottom:1px solid #f1eef7}" +
      "#" + MODAL_ID + " .dam-exp-create__var:hover{background:#faf8fd;border-radius:8px}" +
      "#" + MODAL_ID + " .dam-exp-create__var-tag{display:inline-flex;align-items:center;justify-content:center;height:22px;padding:0 8px;" +
      "border-radius:999px;background:#f2e9fa;color:#7a2fae;font-size:11px;font-weight:700;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#" + MODAL_ID + " .dam-exp-create__var input[type=text]{height:28px;font-size:11.5px;padding:0 8px}" +
      "#" + MODAL_ID + " .dam-exp-create__var-preview{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:#6b6578;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#" + MODAL_ID + " .dam-exp-create__var.is-checked .dam-exp-create__var-preview{color:#3d3550;font-weight:600}" +
      "#" + MODAL_ID + " .dam-exp-create__newvariant{border-top:1px solid #f1eef7;padding-top:12px;display:flex;flex-direction:column;gap:8px}" +
      "#" + MODAL_ID + " .dam-exp-create__newvariant-head{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#9a93ab;text-transform:uppercase;letter-spacing:.03em}" +
      "#" + MODAL_ID + " .dam-exp-create__newvariant-row{display:grid;grid-template-columns:110px 110px 1fr auto;gap:8px;align-items:end}" +
      "#" + MODAL_ID + " .dam-exp-create__newvariant-hint{font-size:11.5px;color:#9a93ab}" +
      "#" + MODAL_ID + " .dam-exp-create__actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:2px}" +
      "#" + MODAL_ID + " .dam-int-cta{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;height:34px;padding:8px 14px;" +
      "border-radius:8px;border:1px solid #e7e2ef;background:#fff;color:#464255;font-size:12.5px;font-weight:500;cursor:pointer}" +
      "#" + MODAL_ID + " .dam-int-cta:disabled{opacity:.5;cursor:not-allowed}" +
      "#" + MODAL_ID + " .dam-int-cta--primary{background:#ab54db;border-color:#ab54db;color:#fff}" +
      "#" + MODAL_ID + " .dam-int-cta--primary:hover{filter:brightness(1.05)}" +
      "#" + MODAL_ID + " .dam-int-cta--danger{color:#b42318;border-color:#f0c6c1}" +
      "#" + MODAL_ID + " .dam-int-cta--danger:hover{background:#fdf1f0}" +
      "#" + MODAL_ID + " .dam-modal-x{flex:0 0 auto;background:transparent;border:0;font-size:18px;line-height:1;color:#9a93ab;cursor:pointer;padding:2px 4px}" +
      "#" + MODAL_ID + " .dam-modal-x:hover{color:#464255}" +
      "#" + MODAL_ID + " .dam-exp-confirm{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:18px 6px 6px}" +
      "#" + MODAL_ID + " .dam-exp-confirm__icon{width:52px;height:52px;border-radius:50%;background:#eaf7ef;color:#1a7a4c;display:flex;" +
      "align-items:center;justify-content:center;font-size:26px}" +
      "#" + MODAL_ID + " .dam-exp-confirm__title{margin:0;font-size:18px;font-weight:700;color:#1f1a2a}" +
      "#" + MODAL_ID + " .dam-exp-confirm__path{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:#6b6578;" +
      "background:#f7f4fb;border-radius:8px;padding:8px 12px;word-break:break-all;max-width:100%}" +
      "#" + MODAL_ID + " .dam-exp-confirm__countdown{font-size:12px;color:#9a93ab}" +
      "#" + MODAL_ID + " .dam-exp-confirm__actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:6px}" +
      "@media (max-width:720px){#" + MODAL_ID + " .dam-exp-create__grid{grid-template-columns:1fr}" +
      "#" + MODAL_ID + " .dam-exp-create__var-legend{display:none}" +
      "#" + MODAL_ID + " .dam-exp-create__var{grid-template-columns:1fr;gap:4px}" +
      "#" + MODAL_ID + " .dam-exp-create__newvariant-row{grid-template-columns:1fr}}";
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = css;
    document.head.appendChild(st);
  }

  function lockScroll(on) {
    document.documentElement.style.overflow = on ? "hidden" : "";
    document.body.style.overflow = on ? "hidden" : "";
  }

  function closeModal() {
    var el = document.getElementById(MODAL_ID);
    if (el && el._damFinalizeOnClose) {
      try { el._damFinalizeOnClose(); } catch (e) { /* ignore */ }
    }
    if (el) el.hidden = true;
    lockScroll(false);
    document.removeEventListener("keydown", onEsc, true);
  }

  function onEsc(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
    }
  }

  function postJson(path, body) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = null;
    if (ctrl) {
      timer = setTimeout(function () {
        try { ctrl.abort(); } catch (e) { /* ignore */ }
      }, 20000);
    }
    function clearTimer() {
      if (timer) clearTimeout(timer);
      timer = null;
    }
    return ensureSession()
      .then(function (sess) {
        if (!sess || !sess.ok) {
          clearTimer();
          return { http: 401, data: { ok: false, error: (sess && sess.error) || "login_required" } };
        }
        return fetch(bridgeUrl() + path, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body || {}),
          signal: ctrl ? ctrl.signal : undefined
        }).then(function (r) {
          return r.json().then(function (data) {
            clearTimer();
            return { http: r.status, data: data };
          }).catch(function () {
            clearTimer();
            return { http: r.status, data: { ok: false, error: "bad_json" } };
          });
        });
      })
      .catch(function (e) {
        clearTimer();
        var msg = String((e && e.message) || e || "fetch_failed");
        if (msg.indexOf("abort") >= 0 || (e && e.name === "AbortError")) {
          msg = "Timeout mostu (20s) - sprawdź X: / bridge.";
        }
        return { http: 0, data: { ok: false, error: "network", message: msg } };
      });
  }

  function getJson(path) {
    return ensureSession()
      .then(function (sess) {
        if (!sess || !sess.ok) return { http: 401, data: { ok: false } };
        return fetch(bridgeUrl() + path, { headers: authHeaders() }).then(function (r) {
          return r.json().then(function (data) {
            return { http: r.status, data: data };
          }).catch(function () {
            return { http: r.status, data: { ok: false } };
          });
        });
      })
      .catch(function () {
        return { http: 0, data: { ok: false } };
      });
  }

  function triggerRebuild() {
    return postJson("/index/rebuild", {}).catch(function () {
      return null;
    });
  }

  function reloadExplorer() {
    if (global.DamExplorer && typeof global.DamExplorer.reload === "function") {
      return global.DamExplorer.reload();
    }
    var btn = document.getElementById("damIndexRefresh");
    if (btn) btn.click();
    return Promise.resolve();
  }

  function collectVariants(root) {
    var rows = root.querySelectorAll("[data-var-row]");
    var out = [];
    rows.forEach(function (row) {
      var en = row.querySelector("[data-var-enabled]");
      var folder = row.getAttribute("data-template-folder") || "";
      var dateEl = row.querySelector("[data-var-date]");
      var idxEl = row.querySelector("[data-var-index]");
      out.push({
        enabled: !!(en && en.checked),
        template_folder: folder,
        date: dateEl ? dateEl.value.trim() : "",
        index: idxEl ? idxEl.value.trim() : ""
      });
    });
    return out;
  }

  function renderVariantRows(list, host) {
    host.innerHTML = "";
    if (!list || !list.length) {
      host.innerHTML = "<div class=\"dam-exp-create__variants-hint\">Brak wariantów w szablonie (albo dry-run nie zwrócił listy).</div>";
      return;
    }
    var legend = document.createElement("div");
    legend.className = "dam-exp-create__var-legend";
    legend.innerHTML = "<span></span><span>Wariant</span><span>Data</span><span>Indeks</span><span>Podgląd folderu</span>";
    host.appendChild(legend);
    list.forEach(function (name) {
      var row = document.createElement("div");
      row.className = "dam-exp-create__var";
      row.setAttribute("data-var-row", "1");
      row.setAttribute("data-template-folder", name);
      var tag = variantTagLabel(name);
      row.innerHTML =
        "<label class=\"dam-exp-create__checkline\"><input type=\"checkbox\" data-var-enabled aria-label=\"Kopiuj wariant " + esc(tag) + "\"></label>" +
        "<span class=\"dam-exp-create__var-tag\" title=\"" + esc(name) + "\">" + esc(tag) + "</span>" +
        "<input type=\"text\" data-var-date placeholder=\"DD MM RRRR\" aria-label=\"Data wariantu " + esc(tag) + "\">" +
        "<input type=\"text\" data-var-index placeholder=\"6300XXX.00\" aria-label=\"Indeks wariantu " + esc(tag) + "\">" +
        "<span class=\"dam-exp-create__var-preview\" data-var-preview title=\"" + esc(name) + "\">" + esc(name) + "</span>";
      host.appendChild(row);
    });
  }

  function open(opts) {
    opts = opts || {};
    injectCss();
    var mode = opts.mode === "category" ? "category" : "product";
    var brand = detectBrand();
    var catCtx = opts.categoryContext || {};
    var catPath = resolveCategoryPath(catCtx);

    var existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    var html =
      "<div id=\"" + MODAL_ID + "\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"damExpCreateTitle\">" +
        "<div class=\"dam-exp-create__backdrop\" data-close=\"1\"></div>" +
        "<div class=\"dam-exp-create__panel\">" +
          "<div class=\"dam-exp-create__head\">" +
            "<div>" +
              "<p class=\"dam-exp-create__eyebrow\">DAM · Eksplorer</p>" +
              "<h2 class=\"dam-exp-create__title\" id=\"damExpCreateTitle\">" +
                (mode === "category" ? "Dodaj kategorię" : "Dodaj produkt") +
              "</h2>" +
              "<p class=\"dam-exp-create__sub\">Szablon z dysku Marketing. Podgląd ścieżki aktualizuje się na bieżąco - zapis dopiero po potwierdzeniu.</p>" +
            "</div>" +
            "<button type=\"button\" class=\"dam-modal-x\" data-close=\"1\" aria-label=\"Zamknij\">×</button>" +
          "</div>" +
          "<div class=\"dam-exp-create__body\">" +
          "<div class=\"dam-exp-create__grid\">" +
            "<div class=\"dam-exp-create__field\">" +
              "<label for=\"damExpBrand\">Marka</label>" +
              "<select id=\"damExpBrand\">" +
                "<option value=\"DK\"" + (brand === "DK" ? " selected" : "") + ">DK (Dobra Kaloria)</option>" +
                "<option value=\"GC\"" + (brand === "GC" ? " selected" : "") + ">GC (Good Calories)</option>" +
              "</select>" +
            "</div>" +
            (mode === "category"
              ? "<div class=\"dam-exp-create__field\"><label for=\"damExpName\">Nazwa kategorii</label>" +
                "<input id=\"damExpName\" type=\"text\" placeholder=\"np. NOWA LINIA\" autocomplete=\"off\"></div>" +
                "<div class=\"dam-exp-create__field dam-exp-create__field--seq\"><label for=\"damExpSeq\">Numer (edytowalny)</label>" +
                "<input id=\"damExpSeq\" type=\"number\" min=\"1\" max=\"99\" placeholder=\"np. 09\"></div>"
              : "<div class=\"dam-exp-create__field\"><label for=\"damExpName\">Nazwa produktu</label>" +
                "<input id=\"damExpName\" type=\"text\" placeholder=\"np. BATON PROTEINOWY\" autocomplete=\"off\"></div>" +
                "<div class=\"dam-exp-create__field\"><label for=\"damExpSub\">Podkategoria</label>" +
                "<input id=\"damExpSub\" type=\"text\" placeholder=\"np. proteinowy\" autocomplete=\"off\"></div>" +
                "<div class=\"dam-exp-create__field\"><label for=\"damExpCatPath\">Folder kategorii (ścieżka)</label>" +
                "<input id=\"damExpCatPath\" type=\"text\" value=\"" + esc(catPath) + "\" placeholder=\"01 - BATONY\"></div>" +
                "<div class=\"dam-exp-create__field\"><label class=\"dam-exp-create__checkline\" style=\"margin-top:9px\">" +
                "<input type=\"checkbox\" id=\"damExpDemo\"> Wymuś DEMO (- D)</label></div>") +
            "<div class=\"dam-exp-create__field dam-exp-create__field--full\">" +
              "<label>Podgląd ścieżki</label>" +
              "<div class=\"dam-exp-create__preview\" id=\"damExpPreview\" aria-live=\"polite\"></div>" +
            "</div>" +
            "<div class=\"dam-exp-create__field dam-exp-create__field--full\">" +
              "<div class=\"dam-exp-create__status\" id=\"damExpErr\" role=\"status\"></div>" +
            "</div>" +
            "<div class=\"dam-exp-create__field dam-exp-create__field--full\">" +
              "<div class=\"dam-exp-create__tree\" id=\"damExpTree\"></div>" +
            "</div>" +
            (mode === "product"
              ? "<div class=\"dam-exp-create__field dam-exp-create__field--full\">" +
                "<div class=\"dam-exp-create__variants-head\">" +
                "<label style=\"margin-bottom:0\">Warianty</label>" +
                "<span class=\"dam-exp-create__variants-hint\">Wybierz warianty do skopiowania - domyślnie wszystkie odznaczone.</span>" +
                "</div>" +
                "<div class=\"dam-exp-create__variants\" id=\"damExpVariants\"></div></div>" +
                "<div class=\"dam-exp-create__field dam-exp-create__field--full dam-exp-create__newvariant\">" +
                "<div class=\"dam-exp-create__newvariant-head\">" + iconTree("plus-circle") + " Nowy wariant globalny</div>" +
                "<div class=\"dam-exp-create__newvariant-row\">" +
                "<input type=\"text\" id=\"damExpNewVarPl\" placeholder=\"Kod PL np. PUSZ\" maxlength=\"16\" aria-label=\"Kod PL wariantu\">" +
                "<input type=\"text\" id=\"damExpNewVarEn\" placeholder=\"Kod EN np. CAN\" maxlength=\"16\" aria-label=\"Kod EN wariantu\">" +
                "<input type=\"text\" id=\"damExpNewVarLabel\" placeholder=\"Pełna nazwa np. PUSZKA\" maxlength=\"48\" aria-label=\"Pełna nazwa wariantu\">" +
                "<button type=\"button\" class=\"dam-int-cta\" id=\"damExpNewVarAdd\">Dodaj</button>" +
                "</div>" +
                "<span class=\"dam-exp-create__newvariant-hint\">Zapisuje etykietę i prefiks globalnie (cały program) - nie tworzy jeszcze fizycznego folderu szablonu na dysku.</span>" +
                "</div>"
              : "") +
          "</div>" +
          "</div>" +
          "<div class=\"dam-exp-create__actions\" id=\"damExpFormActions\">" +
            "<button type=\"button\" class=\"dam-int-cta\" data-close=\"1\">Anuluj</button>" +
            "<button type=\"button\" class=\"dam-int-cta\" id=\"damExpDryRun\">Podgląd</button>" +
            "<button type=\"button\" class=\"dam-int-cta dam-int-cta--primary\" id=\"damExpConfirm\" disabled>Potwierdź i utwórz</button>" +
          "</div>" +
        "</div>" +
      "</div>";

    document.body.insertAdjacentHTML("beforeend", html);
    var root = document.getElementById(MODAL_ID);
    lockScroll(true);
    document.addEventListener("keydown", onEsc, true);

    var lastPlan = null;
    var errEl = root.querySelector("#damExpErr");
    var previewEl = root.querySelector("#damExpPreview");
    var treeEl = root.querySelector("#damExpTree");
    var confirmBtn = root.querySelector("#damExpConfirm");
    var variantsHost = root.querySelector("#damExpVariants");
    var bodyEl = root.querySelector(".dam-exp-create__body");
    var actionsEl = root.querySelector("#damExpFormActions");

    function setStatus(msg, kind) {
      msg = msg || "";
      errEl.textContent = msg;
      errEl.className = "dam-exp-create__status" + (msg ? " is-" + (kind || "error") : "");
      errEl.setAttribute("role", kind === "error" || !kind ? "alert" : "status");
    }

    function currentSeq() {
      var seqEl = root.querySelector("#damExpSeq");
      if (!seqEl) return 1;
      var v = parseInt(seqEl.value, 10);
      return v && v > 0 ? v : parseInt(seqEl.placeholder || "1", 10) || 1;
    }

    function buildTreeForCategory() {
      var brandVal = root.querySelector("#damExpBrand").value;
      var name = root.querySelector("#damExpName").value;
      var folder = categoryFolderName(currentSeq(), name);
      treeEl.innerHTML =
        "<p class=\"dam-exp-create__tree-title\">Zostanie utworzone</p>" +
        "<div class=\"dam-exp-create__tree-row\">" + iconTree("folder") + "<span>" + esc(folder) + "</span></div>";
    }

    function buildTreeForProduct() {
      var name = root.querySelector("#damExpName").value;
      var sub = root.querySelector("#damExpSub").value;
      var demo = root.querySelector("#damExpDemo").checked;
      var folder = productFolderPreview(name, sub, demo);
      var rows = variantsHost.querySelectorAll("[data-var-row]");
      var checkedRows = [];
      rows.forEach(function (row) {
        var en = row.querySelector("[data-var-enabled]");
        if (en && en.checked) checkedRows.push(row);
      });
      var html = "<p class=\"dam-exp-create__tree-title\">Zostanie utworzone</p>" +
        "<div class=\"dam-exp-create__tree-row\">" + iconTree("folder") + "<span>" + esc(folder) + "</span></div>";
      if (!rows.length) {
        treeEl.innerHTML = html;
        return;
      }
      if (!checkedRows.length) {
        html += "<div class=\"dam-exp-create__tree-row dam-exp-create__tree-row--child dam-exp-create__tree-row--muted\">" +
          iconTree("info-circle") + "<span>Brak zaznaczonych wariantów - zostanie skopiowany cały szablon (wszystkie warianty)</span></div>";
      } else {
        checkedRows.forEach(function (row) {
          var preview = row.querySelector("[data-var-preview]");
          html += "<div class=\"dam-exp-create__tree-row dam-exp-create__tree-row--child\">" +
            iconTree("folder-open") + "<span>" + esc(preview ? preview.textContent : "") + "</span></div>";
        });
      }
      treeEl.innerHTML = html;
    }

    function updateVariantRowPreview(row) {
      var folder = row.getAttribute("data-template-folder") || "";
      var dateEl = row.querySelector("[data-var-date]");
      var idxEl = row.querySelector("[data-var-index]");
      var enEl = row.querySelector("[data-var-enabled]");
      var previewEl2 = row.querySelector("[data-var-preview]");
      var forceDemo = mode === "product" && root.querySelector("#damExpDemo") && root.querySelector("#damExpDemo").checked;
      var finalName = variantFolderPreviewClient(folder, dateEl ? dateEl.value : "", idxEl ? idxEl.value : "", forceDemo);
      if (previewEl2) previewEl2.textContent = finalName;
      row.classList.toggle("is-checked", !!(enEl && enEl.checked));
    }

    function updateAllVariantPreviews() {
      variantsHost.querySelectorAll("[data-var-row]").forEach(updateVariantRowPreview);
    }

    function updateLocalPreview() {
      var brandVal = root.querySelector("#damExpBrand").value;
      var fullPath;
      if (mode === "category") {
        var name = root.querySelector("#damExpName").value;
        fullPath = guessCategoryFullPath(brandVal, currentSeq(), name);
        buildTreeForCategory();
      } else {
        var pname = root.querySelector("#damExpName").value;
        var sub = root.querySelector("#damExpSub").value;
        var demo = root.querySelector("#damExpDemo").checked;
        var catVal = root.querySelector("#damExpCatPath").value;
        fullPath = guessProductFullPath(brandVal, catVal, pname, sub, demo);
        updateAllVariantPreviews();
        buildTreeForProduct();
      }
      previewEl.innerHTML = "Tworzenie: <b>" + esc(fullPath) + "</b>";
    }

    function seedCategorySeq() {
      if (mode !== "category") return;
      var brandVal = root.querySelector("#damExpBrand").value;
      getJson("/explorer/next-category-seq?brand=" + encodeURIComponent(brandVal)).then(function (res) {
        var data = res.data || {};
        var seqEl = root.querySelector("#damExpSeq");
        if (!seqEl) return;
        if (data.ok && data.suggested_seq) {
          seqEl.placeholder = String(data.suggested_seq);
          if (!seqEl.value) seqEl.value = data.suggested_seq;
        } else {
          seqEl.placeholder = "1";
        }
        updateLocalPreview();
      }).catch(function () { /* ignore - live preview still works with placeholder */ });
    }

    root.querySelectorAll("[data-close]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        closeModal();
      });
    });

    var liveFieldSelectors = mode === "category"
      ? ["#damExpName", "#damExpSeq", "#damExpBrand"]
      : ["#damExpName", "#damExpSub", "#damExpCatPath", "#damExpDemo", "#damExpBrand"];
    liveFieldSelectors.forEach(function (sel) {
      var el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener("input", updateLocalPreview);
      el.addEventListener("change", updateLocalPreview);
    });
    root.querySelector("#damExpBrand").addEventListener("change", function () {
      if (mode === "category") seedCategorySeq();
    });
    updateLocalPreview();
    seedCategorySeq();

    root.querySelector("#damExpDryRun").addEventListener("click", function () {
      setStatus("");
      confirmBtn.disabled = true;
      lastPlan = null;
      var brandVal = root.querySelector("#damExpBrand").value;
      var nameVal = root.querySelector("#damExpName").value.trim();
      if (!nameVal) {
        setStatus("Podaj nazwę.", "error");
        return;
      }

      var body;
      var path;
      if (mode === "category") {
        path = "/explorer/create-category";
        var seqVal = root.querySelector("#damExpSeq").value;
        body = { brand: brandVal, name: nameVal, seq: seqVal || undefined, dry_run: true, confirm: false };
      } else {
        path = "/explorer/create-product";
        var subVal = root.querySelector("#damExpSub").value.trim() || "standard";
        var catVal = root.querySelector("#damExpCatPath").value.trim();
        if (!catVal) {
          setStatus("Podaj folder kategorii (np. 01 - BATONY).", "error");
          return;
        }
        body = {
          brand: brandVal,
          category_path: catVal,
          name: nameVal,
          subcategory: subVal,
          demo: root.querySelector("#damExpDemo").checked,
          variants: collectVariants(root),
          dry_run: true,
          confirm: false
        };
      }

      setStatus("Sprawdzanie z dyskiem…", "info");
      postJson(path, body).then(function (res) {
        var data = res.data || {};
        if (res.http === 401 || data.error === "login_required" || data.error === "admin_required") {
          setStatus("Wymagana sesja admina (zaloguj się i włącz ADMIN).", "error");
          return;
        }
        if (!data.ok) {
          setStatus(data.message || data.error || "Podgląd nieudany.", "error");
          if (mode === "product" && data.available_variants && variantsHost) {
            renderVariantRows(data.available_variants, variantsHost);
            bindVariantRowEvents();
            updateLocalPreview();
          }
          return;
        }
        lastPlan = data;
        if (mode === "category" && typeof data.suggested_seq === "number") {
          var seqEl = root.querySelector("#damExpSeq");
          if (seqEl) seqEl.placeholder = String(data.suggested_seq);
        }
        previewEl.innerHTML = "Tworzenie: <b>" + esc(data.planned_path || "") + "</b>";
        if (mode === "product" && variantsHost && data.available_variants) {
          if (!variantsHost.querySelector("[data-var-row]")) {
            renderVariantRows(data.available_variants, variantsHost);
            bindVariantRowEvents();
            updateAllVariantPreviews();
          }
        }
        buildTreeForProductOrCategory();
        confirmBtn.disabled = false;
        setStatus("Podgląd gotowy - sprawdź ścieżkę przed potwierdzeniem.", "ok");
      }).catch(function (e) {
        setStatus(String(e && e.message || e), "error");
      });
    });

    function buildTreeForProductOrCategory() {
      if (mode === "category") buildTreeForCategory();
      else buildTreeForProduct();
    }

    function bindVariantRowEvents() {
      variantsHost.querySelectorAll("[data-var-row]").forEach(function (row) {
        if (row._damBound) return;
        row._damBound = true;
        row.addEventListener("input", function () {
          updateVariantRowPreview(row);
          buildTreeForProduct();
        });
        row.addEventListener("change", function () {
          updateVariantRowPreview(row);
          buildTreeForProduct();
        });
      });
    }

    root.querySelector("#damExpConfirm").addEventListener("click", function () {
      if (!lastPlan || !lastPlan.ok) {
        setStatus("Najpierw uruchom Podgląd.", "error");
        return;
      }
      setStatus("");
      var brandVal = root.querySelector("#damExpBrand").value;
      var nameVal = root.querySelector("#damExpName").value.trim();
      var path;
      var body;
      if (mode === "category") {
        path = "/explorer/create-category";
        var seqVal = root.querySelector("#damExpSeq").value;
        body = { brand: brandVal, name: nameVal, seq: seqVal || undefined, dry_run: false, confirm: true };
      } else {
        path = "/explorer/create-product";
        body = {
          brand: brandVal,
          category_path: root.querySelector("#damExpCatPath").value.trim(),
          name: nameVal,
          subcategory: root.querySelector("#damExpSub").value.trim() || "standard",
          demo: root.querySelector("#damExpDemo").checked,
          variants: collectVariants(root),
          dry_run: false,
          confirm: true
        };
      }
      confirmBtn.disabled = true;
      postJson(path, body).then(function (res) {
        var data = res.data || {};
        if (!data.ok) {
          setStatus(data.message || data.error || "Tworzenie nieudane.", "error");
          confirmBtn.disabled = false;
          return;
        }
        showConfirmationPanel(data, mode === "category" ? nameVal : nameVal);
      }).catch(function (e) {
        setStatus(String(e && e.message || e), "error");
        confirmBtn.disabled = false;
      });
    });

    function showConfirmationPanel(data, label) {
      var createdPath = data.created_path || data.planned_path || "";
      bodyEl.style.display = "none";
      actionsEl.style.display = "none";
      var panel = document.createElement("div");
      panel.className = "dam-exp-confirm";
      panel.innerHTML =
        "<div class=\"dam-exp-confirm__icon\">" + iconTree("check") + "</div>" +
        "<h3 class=\"dam-exp-confirm__title\">Utworzono: " + esc(label) + "</h3>" +
        "<div class=\"dam-exp-confirm__path\">" + esc(createdPath) + "</div>" +
        "<div class=\"dam-exp-confirm__countdown\" id=\"damExpCountdown\"></div>" +
        "<div class=\"dam-exp-confirm__actions\">" +
        "<button type=\"button\" class=\"dam-int-cta\" id=\"damExpGoFolder\">" + iconTree("folder-open") + " Przejdź do folderu</button>" +
        "<button type=\"button\" class=\"dam-int-cta dam-int-cta--danger\" id=\"damExpUndo\">" + iconTree("undo") + " Cofnij</button>" +
        "<button type=\"button\" class=\"dam-int-cta dam-int-cta--primary\" id=\"damExpFinalize\">" + iconTree("check") + " Zatwierdź</button>" +
        "</div>";
      root.querySelector(".dam-exp-create__panel").appendChild(panel);

      var remaining = UNDO_WINDOW_SECONDS;
      var countdownEl = panel.querySelector("#damExpCountdown");
      var finalized = false;
      var undone = false;
      var timerId = null;

      function tick() {
        var mm = Math.floor(remaining / 60);
        var ss = remaining % 60;
        countdownEl.textContent = "Automatyczne zatwierdzenie za " + mm + ":" + (ss < 10 ? "0" + ss : ss);
        if (remaining <= 0) {
          clearInterval(timerId);
          finalize();
          return;
        }
        remaining -= 1;
      }

      function stopCountdown() {
        if (timerId) clearInterval(timerId);
        timerId = null;
      }

      function setButtonsDisabled(on) {
        panel.querySelectorAll("button").forEach(function (b) { b.disabled = on; });
      }

      function finalize() {
        if (finalized || undone) return;
        finalized = true;
        stopCountdown();
        setButtonsDisabled(true);
        countdownEl.textContent = "Zatwierdzanie…";
        var rebuildP = data.index_rebuild_suggested !== false ? triggerRebuild() : Promise.resolve();
        rebuildP.then(function () {
          return reloadExplorer();
        }).then(function () {
          toast("Zatwierdzono: " + (createdPath || "OK"), "ok");
          root._damFinalizeOnClose = null;
          closeModal();
        });
      }

      function undo() {
        if (finalized || undone) return;
        undone = true;
        stopCountdown();
        setButtonsDisabled(true);
        countdownEl.textContent = "Cofanie…";
        postJson("/explorer/undo-create", { path: createdPath }).then(function (res) {
          var d = res.data || {};
          if (!d.ok) {
            undone = false;
            setButtonsDisabled(false);
            countdownEl.textContent = d.message || d.error || "Cofnięcie nieudane.";
            return;
          }
          toast("Cofnięto - folder usunięty.", "info");
          root._damFinalizeOnClose = null;
          closeModal();
        });
      }

      panel.querySelector("#damExpGoFolder").addEventListener("click", function () {
        if (global.DamPaths && typeof global.DamPaths.revealInExplorer === "function") {
          global.DamPaths.revealInExplorer(createdPath);
        } else {
          toast("Otwórz recznie: " + createdPath, "info");
        }
      });
      panel.querySelector("#damExpFinalize").addEventListener("click", finalize);
      panel.querySelector("#damExpUndo").addEventListener("click", undo);

      root._damFinalizeOnClose = finalize;
      tick();
      timerId = setInterval(tick, 1000);
    }

    if (mode === "product" && root.querySelector("#damExpNewVarAdd")) {
      root.querySelector("#damExpNewVarAdd").addEventListener("click", function () {
        var plEl = root.querySelector("#damExpNewVarPl");
        var enEl = root.querySelector("#damExpNewVarEn");
        var labelEl = root.querySelector("#damExpNewVarLabel");
        var code = plEl.value.trim();
        var codeEn = enEl.value.trim();
        var label = labelEl.value.trim();
        if (!code || !label) {
          setStatus("Podaj przynajmniej kod PL i pełną nazwę nowego wariantu.", "error");
          return;
        }
        var btn = root.querySelector("#damExpNewVarAdd");
        btn.disabled = true;
        postJson("/explorer/add-variant-type", { code: code, code_en: codeEn, label_pl: label }).then(function (res) {
          btn.disabled = false;
          var data = res.data || {};
          if (!data.ok) {
            setStatus(data.message || data.error || "Nie udało się dodać wariantu.", "error");
            return;
          }
          setStatus(data.message || ("Dodano wariant globalny: " + label), "ok");
          plEl.value = "";
          enEl.value = "";
          labelEl.value = "";
          toast("Wariant globalny zapisany: " + label, "ok");
        }).catch(function (e) {
          btn.disabled = false;
          setStatus(String(e && e.message || e), "error");
        });
      });
    }

    // Bootstrap variant list for product mode via dry-run with placeholder names.
    if (mode === "product" && variantsHost) {
      var bootCat = root.querySelector("#damExpCatPath").value.trim();
      if (bootCat) {
        postJson("/explorer/create-product", {
          brand: brand,
          category_path: bootCat,
          name: "PROBE",
          subcategory: "probe",
          dry_run: true,
          confirm: false,
          variants: []
        }).then(function (res) {
          var data = res.data || {};
          if (data.available_variants) {
            renderVariantRows(data.available_variants, variantsHost);
            bindVariantRowEvents();
            updateLocalPreview();
          } else if (data.error === "already_exists" && data.available_variants) {
            renderVariantRows(data.available_variants, variantsHost);
            bindVariantRowEvents();
            updateLocalPreview();
          }
        }).catch(function () { /* ignore bootstrap errors */ });
      }
    }

    setTimeout(function () {
      var focus = root.querySelector("#damExpName");
      if (focus) focus.focus();
    }, 30);
  }

  global.DamExplorerAddProduct = { open: open, close: closeModal };
})(window);
