/**
 * DAM Explorer - Dodaj produkt / kategorię (EXP-B).
 * Dry-run preview → confirm → POST /explorer/create-* → index rebuild.
 */
(function (global) {
  "use strict";

  var MODAL_ID = "damExplorerCreateModal";
  var STYLE_ID = "damExplorerCreateModalCss";
  var EM_DASH = "\u2014";

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

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      "#" + MODAL_ID + "{position:fixed;inset:0;z-index:12400;display:flex;align-items:center;justify-content:center;}" +
      "#" + MODAL_ID + "[hidden]{display:none!important}" +
      "#" + MODAL_ID + " .dam-exp-create__backdrop{position:absolute;inset:0;background:rgba(28,22,40,.45)}" +
      "#" + MODAL_ID + " .dam-exp-create__panel{position:relative;z-index:1;width:min(920px,92vw);max-height:min(86vh,900px);overflow:auto;" +
      "background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(40,30,60,.22);padding:28px 34px 34px;" +
      "display:flex;flex-direction:column;gap:16px}" +
      "#" + MODAL_ID + " .dam-exp-create__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}" +
      "#" + MODAL_ID + " .dam-exp-create__eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ab54db;margin:0 0 4px}" +
      "#" + MODAL_ID + " .dam-exp-create__title{margin:0;font-size:22px;font-weight:700;color:#1f1a2a}" +
      "#" + MODAL_ID + " .dam-exp-create__sub{margin:6px 0 0;font-size:13px;color:#6b6578}" +
      "#" + MODAL_ID + " .dam-exp-create__grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}" +
      "#" + MODAL_ID + " .dam-exp-create__field{display:flex;flex-direction:column;gap:6px}" +
      "#" + MODAL_ID + " .dam-exp-create__field--full{grid-column:1/-1}" +
      "#" + MODAL_ID + " label{font-size:12px;font-weight:600;color:#464255}" +
      "#" + MODAL_ID + " input[type=text],#" + MODAL_ID + " select{height:36px;border:1px solid #e7e7e7;border-radius:8px;padding:0 12px;font:inherit;color:#464255}" +
      "#" + MODAL_ID + " .dam-exp-create__preview{background:#f7f4fb;border:1px solid #ebe4f4;border-radius:10px;padding:12px 14px;font-size:12px;color:#3d3550;word-break:break-all}" +
      "#" + MODAL_ID + " .dam-exp-create__variants{display:flex;flex-direction:column;gap:8px;max-height:220px;overflow:auto;border:1px solid #eee;border-radius:10px;padding:10px}" +
      "#" + MODAL_ID + " .dam-exp-create__var{display:grid;grid-template-columns:auto 1fr 120px 140px;gap:8px;align-items:center;font-size:12px}" +
      "#" + MODAL_ID + " .dam-exp-create__actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:4px}" +
      "#" + MODAL_ID + " .dam-exp-create__err{color:#b42318;font-size:13px;min-height:1.2em}" +
      "#" + MODAL_ID + " .dam-int-cta{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;height:34px;padding:8px 12px;" +
      "border-radius:8px;border:1px solid #e7e7e7;background:#fff;color:#464255;font-size:12px;font-weight:500;cursor:pointer}" +
      "#" + MODAL_ID + " .dam-int-cta--primary{background:#ab54db;border-color:#ab54db;color:#fff}" +
      "#" + MODAL_ID + " .dam-int-cta--primary:hover{filter:brightness(1.05)}" +
      "#" + MODAL_ID + " .dam-modal-x{flex:0 0 auto}" +
      "@media (max-width:720px){#" + MODAL_ID + " .dam-exp-create__grid{grid-template-columns:1fr}" +
      "#" + MODAL_ID + " .dam-exp-create__var{grid-template-columns:1fr}}";
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = css;
    document.head.appendChild(st);
  }

  function lockScroll(on) {
    document.documentElement.style.overflow = on ? "hidden" : "";
    document.body.style.overflow = on ? "hidden" : "";
  }

  function productFolderPreview(name, sub, demo) {
    var n = String(name || "").trim().toUpperCase() || "NAZWA";
    var s = String(sub || "").trim().toLowerCase() || "podkategoria";
    var base = n + " " + EM_DASH + " [ " + s + " ]";
    if (demo) base += " - D";
    return base;
  }

  function closeModal() {
    var el = document.getElementById(MODAL_ID);
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
      host.innerHTML = "<div class=\"dam-exp-create__sub\">Brak wariantów w szablonie (albo dry-run nie zwrócił listy).</div>";
      return;
    }
    list.forEach(function (name) {
      var row = document.createElement("div");
      row.className = "dam-exp-create__var";
      row.setAttribute("data-var-row", "1");
      row.setAttribute("data-template-folder", name);
      row.innerHTML =
        "<label><input type=\"checkbox\" data-var-enabled checked aria-label=\"Kopiuj wariant\"></label>" +
        "<div title=\"" + esc(name) + "\">" + esc(name) + "</div>" +
        "<input type=\"text\" data-var-date placeholder=\"DD MM RRRR\" aria-label=\"Data wariantu\">" +
        "<input type=\"text\" data-var-index placeholder=\"6300XXX.00\" aria-label=\"Indeks wariantu\">";
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
              "<p class=\"dam-exp-create__sub\">Szablon z dysku Marketing. Najpierw podgląd ścieżki, zapis dopiero po potwierdzeniu.</p>" +
            "</div>" +
            "<button type=\"button\" class=\"dam-modal-x\" data-close=\"1\" aria-label=\"Zamknij\">×</button>" +
          "</div>" +
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
                "<input id=\"damExpName\" type=\"text\" placeholder=\"np. NOWA LINIA\" autocomplete=\"off\"></div>"
              : "<div class=\"dam-exp-create__field\"><label for=\"damExpName\">Nazwa produktu</label>" +
                "<input id=\"damExpName\" type=\"text\" placeholder=\"np. BATON PROTEINOWY\" autocomplete=\"off\"></div>" +
                "<div class=\"dam-exp-create__field\"><label for=\"damExpSub\">Podkategoria</label>" +
                "<input id=\"damExpSub\" type=\"text\" placeholder=\"np. proteinowy\" autocomplete=\"off\"></div>" +
                "<div class=\"dam-exp-create__field\"><label for=\"damExpCatPath\">Folder kategorii (ścieżka)</label>" +
                "<input id=\"damExpCatPath\" type=\"text\" value=\"" + esc(catPath) + "\" placeholder=\"01 - BATONY\"></div>" +
                "<div class=\"dam-exp-create__field\"><label><input type=\"checkbox\" id=\"damExpDemo\"> Wymuś DEMO (- D)</label></div>") +
            "<div class=\"dam-exp-create__field dam-exp-create__field--full\">" +
              "<label>Podgląd ścieżki</label>" +
              "<div class=\"dam-exp-create__preview\" id=\"damExpPreview\">Wypełnij pola i kliknij „Podgląd”.</div>" +
            "</div>" +
            (mode === "product"
              ? "<div class=\"dam-exp-create__field dam-exp-create__field--full\">" +
                "<label>Warianty z szablonu (checkbox = kopiuj)</label>" +
                "<div class=\"dam-exp-create__variants\" id=\"damExpVariants\"></div></div>"
              : "") +
          "</div>" +
          "<div class=\"dam-exp-create__err\" id=\"damExpErr\" role=\"alert\"></div>" +
          "<div class=\"dam-exp-create__actions\">" +
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
    var confirmBtn = root.querySelector("#damExpConfirm");
    var variantsHost = root.querySelector("#damExpVariants");

    function setErr(msg) {
      errEl.textContent = msg || "";
    }

    function updateLocalPreview() {
      if (mode !== "product") return;
      var name = root.querySelector("#damExpName").value;
      var sub = root.querySelector("#damExpSub").value;
      var demo = root.querySelector("#damExpDemo").checked;
      var folder = productFolderPreview(name, sub, demo);
      previewEl.textContent =
        "Folder produktu: " + folder +
        (catPath ? "\nKategoria (kontekst): " + catPath : "");
    }

    root.querySelectorAll("[data-close]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        closeModal();
      });
    });

    ["#damExpName", "#damExpSub", "#damExpDemo"].forEach(function (sel) {
      var el = root.querySelector(sel);
      if (el) el.addEventListener("input", updateLocalPreview);
      if (el) el.addEventListener("change", updateLocalPreview);
    });
    updateLocalPreview();

    root.querySelector("#damExpDryRun").addEventListener("click", function () {
      setErr("");
      confirmBtn.disabled = true;
      lastPlan = null;
      var brandVal = root.querySelector("#damExpBrand").value;
      var nameVal = root.querySelector("#damExpName").value.trim();
      if (!nameVal) {
        setErr("Podaj nazwę.");
        return;
      }

      var body;
      var path;
      if (mode === "category") {
        path = "/explorer/create-category";
        body = { brand: brandVal, name: nameVal, dry_run: true, confirm: false };
      } else {
        path = "/explorer/create-product";
        var subVal = root.querySelector("#damExpSub").value.trim() || "standard";
        var catVal = root.querySelector("#damExpCatPath").value.trim();
        if (!catVal) {
          setErr("Podaj folder kategorii (np. 01 - BATONY).");
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

      previewEl.textContent = "Liczenie podglądu…";
      postJson(path, body).then(function (res) {
        var data = res.data || {};
        if (res.http === 401 || data.error === "login_required" || data.error === "admin_required") {
          setErr("Wymagana sesja admina (zaloguj się i włącz ADMIN).");
          previewEl.textContent = "Brak uprawnień.";
          return;
        }
        if (!data.ok) {
          setErr(data.message || data.error || "Dry-run nieudany.");
          previewEl.textContent = JSON.stringify(data, null, 2);
          if (mode === "product" && data.available_variants && variantsHost) {
            renderVariantRows(data.available_variants, variantsHost);
          }
          return;
        }
        lastPlan = data;
        previewEl.textContent =
          (data.message || "OK") +
          "\n" +
          (data.planned_path || "") +
          (data.planned_tree && data.planned_tree.length
            ? "\n\nDrzewo:\n- " + data.planned_tree.join("\n- ")
            : "");
        if (mode === "product" && variantsHost && data.available_variants) {
          if (!variantsHost.querySelector("[data-var-row]")) {
            renderVariantRows(data.available_variants, variantsHost);
          }
        }
        confirmBtn.disabled = false;
        toast("Podgląd gotowy - sprawdź ścieżkę przed potwierdzeniem.", "info");
      }).catch(function (e) {
        setErr(String(e && e.message || e));
      });
    });

    confirmBtn.addEventListener("click", function () {
      if (!lastPlan || !lastPlan.ok) {
        setErr("Najpierw uruchom Podgląd.");
        return;
      }
      setErr("");
      var brandVal = root.querySelector("#damExpBrand").value;
      var nameVal = root.querySelector("#damExpName").value.trim();
      var path;
      var body;
      if (mode === "category") {
        path = "/explorer/create-category";
        body = { brand: brandVal, name: nameVal, dry_run: false, confirm: true };
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
          setErr(data.message || data.error || "Tworzenie nieudane.");
          confirmBtn.disabled = false;
          return;
        }
        toast("Utworzono: " + (data.created_path || data.planned_path || "OK"), "ok");
        closeModal();
        var rebuildP = data.index_rebuild_suggested !== false ? triggerRebuild() : Promise.resolve();
        rebuildP.then(function () {
          return reloadExplorer();
        });
      }).catch(function (e) {
        setErr(String(e && e.message || e));
        confirmBtn.disabled = false;
      });
    });

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
          } else if (data.error === "already_exists" && data.available_variants) {
            renderVariantRows(data.available_variants, variantsHost);
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
