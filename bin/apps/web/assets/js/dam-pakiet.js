/**
 * DAM PAKIET flow: Dobrokaloriuś choice → optional multi picker → progress dock.
 * Does not replace create_print_package; wraps POST /explorer/pack-print.
 */
(function (global) {
  "use strict";

  var CB = "5.0.196";
  /* DamLoader = 13000 (center "ładowanie") - PAKIET must sit ABOVE it. */
  var Z_CHOICE = 13120;
  var Z_PICKER = 13130;
  var Z_PROGRESS = 13140;
  var Z_COACH = 13180;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bridgeUrl() {
    if (global.DamRuntime && typeof global.DamRuntime.bridge === "function") {
      return global.DamRuntime.bridge();
    }
    return "http://127.0.0.1:8766";
  }

  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    try {
      if (global.DamApi && typeof global.DamApi.authHeaders === "function") {
        var ah = global.DamApi.authHeaders();
        if (ah && ah.Authorization) h.Authorization = ah.Authorization;
      }
    } catch (e) { /* ignore */ }
    return h;
  }

  function toast(msg, kind) {
    if (global.DamExplorer && typeof global.DamExplorer.showToast === "function") {
      global.DamExplorer.showToast(msg, kind || "info");
      return;
    }
    if (global.DamShell && typeof global.DamShell.toast === "function") {
      global.DamShell.toast(msg, kind || "info");
      return;
    }
  }

  function poseUrl(file) {
    if (global.DamEmptyMascot && typeof global.DamEmptyMascot.poseUrl === "function") {
      return global.DamEmptyMascot.poseUrl(file);
    }
    var rel = "assets/img/maskotka/" + (file || "pose-think-q.png") + "?v=" + CB;
    try {
      return new URL(rel, global.location.href).href;
    } catch (e) {
      return rel;
    }
  }

  function ensureCss() {
    if (document.getElementById("damPakietCss")) return;
    var st = document.createElement("style");
    st.id = "damPakietCss";
    st.textContent =
      ".dam-pakiet-overlay{position:fixed;inset:0;z-index:" +
      Z_CHOICE +
      ";display:flex;align-items:center;justify-content:center;padding:20px;" +
      "background:rgba(28,25,38,.48);backdrop-filter:blur(3px);}" +
      ".dam-pakiet-card{width:min(520px,96vw);background:#fff;border-radius:16px;" +
      "border:1px solid rgba(70,66,85,.12);box-shadow:0 18px 48px rgba(28,25,38,.22);" +
      "padding:20px 20px 16px;position:relative;}" +
      ".dam-pakiet-card__x{position:absolute;top:10px;right:10px;width:31px;height:31px;" +
      "border:none;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(28,25,38,.12);" +
      "color:#3d3a4a;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;}" +
      ".dam-pakiet-card__x:hover,.dam-pakiet-card__x:focus-visible{color:#c62828;}" +
      ".dam-pakiet-mascot-row{display:flex;gap:14px;align-items:flex-end;margin:4px 0 14px;}" +
      ".dam-pakiet-mascot{width:88px;height:96px;flex:0 0 auto;position:relative;}" +
      ".dam-pakiet-mascot__img{display:block;width:100%;height:100%;background:var(--dam-pakiet-pose) center bottom/contain no-repeat;}" +
      ".dam-pakiet-bubble{flex:1;min-width:0;background:#f7f6fa;border-radius:14px;padding:12px 14px;" +
      "border:1px solid rgba(70,66,85,.08);font-size:14px;line-height:1.45;color:#3d3a4a;}" +
      ".dam-pakiet-bubble strong{display:block;font-size:15px;margin-bottom:4px;color:#2d2a37;}" +
      ".dam-pakiet-actions.dam-dialog-actions{display:grid!important;grid-template-columns:1fr auto;" +
      "gap:8px;align-items:center;margin-top:4px;}" +
      ".dam-pakiet-actions .geex-btn{white-space:nowrap;}" +
      ".dam-pakiet-picker{position:fixed;inset:0;z-index:" +
      Z_PICKER +
      ";display:flex;align-items:center;justify-content:center;padding:16px;" +
      "background:rgba(28,25,38,.5);backdrop-filter:blur(3px);}" +
      ".dam-pakiet-picker__panel{width:min(720px,96vw);max-height:min(88vh,820px);display:flex;flex-direction:column;" +
      "background:#fff;border-radius:16px;border:1px solid rgba(70,66,85,.12);" +
      "box-shadow:0 20px 56px rgba(28,25,38,.24);overflow:hidden;}" +
      ".dam-pakiet-picker__head{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;" +
      "border-bottom:1px solid rgba(70,66,85,.08);background:#faf9fc;}" +
      ".dam-pakiet-picker__head-text{flex:1;min-width:0;}" +
      ".dam-pakiet-picker__eyebrow{margin:0;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#7a7488;}" +
      ".dam-pakiet-picker__title{margin:2px 0 0;font-size:18px;font-weight:700;color:#2d2a37;}" +
      ".dam-pakiet-picker__body{flex:1;min-height:0;overflow:auto;padding:12px 16px;}" +
      ".dam-pakiet-search{width:100%;margin:0 0 10px;}" +
      ".dam-pakiet-dest{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px;" +
      "padding:10px 12px;border-radius:12px;background:#f7f6fa;border:1px solid rgba(70,66,85,.08);}" +
      ".dam-pakiet-dest label{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#3d3a4a;cursor:pointer;}" +
      ".dam-pakiet-dest__path{flex:1 1 180px;min-width:0;font-size:12px;color:#5c5668;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".dam-pakiet-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}" +
      ".dam-pakiet-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;" +
      "padding:10px 12px;border-radius:12px;border:1px solid rgba(70,66,85,.1);background:#fff;}" +
      ".dam-pakiet-row:hover{border-color:rgba(124,92,191,.35);}" +
      ".dam-pakiet-row.is-seed{background:#f4f0fb;border-color:rgba(124,92,191,.28);}" +
      ".dam-pakiet-row__meta{font-size:12px;color:#7a7488;}" +
      ".dam-pakiet-row__title{font-size:13px;font-weight:600;color:#2d2a37;}" +
      ".dam-pakiet-picker__footer{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;" +
      "padding:12px 14px;min-height:65px;background:#f7f6fa;border-top:1px solid rgba(70,66,85,.08);}" +
      ".dam-pakiet-progress{position:fixed;right:18px;bottom:78px;z-index:" +
      Z_PROGRESS +
      ";width:min(420px,calc(100vw - 28px));background:#fff;border-radius:16px;" +
      "border:1px solid rgba(70,66,85,.12);box-shadow:0 16px 40px rgba(28,25,38,.2);overflow:hidden;}" +
      ".dam-pakiet-progress__head{display:flex;align-items:center;gap:10px;padding:12px 14px;" +
      "background:#faf9fc;border-bottom:1px solid rgba(70,66,85,.08);}" +
      ".dam-pakiet-progress__title{flex:1;font-size:14px;font-weight:700;color:#2d2a37;margin:0;}" +
      ".dam-pakiet-progress__bar{height:8px;margin:0 14px 8px;border-radius:999px;background:#eceaf2;overflow:hidden;}" +
      ".dam-pakiet-progress__bar > i{display:block;height:100%;width:0%;background:linear-gradient(90deg,#7c5cbf,#9b7de8);" +
      "border-radius:inherit;transition:width .25s ease;}" +
      ".dam-pakiet-progress__meta{display:flex;justify-content:space-between;gap:8px;padding:0 14px 8px;" +
      "font-size:12px;color:#5c5668;}" +
      ".dam-pakiet-progress__list{max-height:280px;overflow:auto;padding:0 10px 10px;margin:0;list-style:none;}" +
      ".dam-pakiet-job{border:1px solid rgba(70,66,85,.1);border-radius:12px;padding:8px 10px;margin-top:8px;background:#fff;}" +
      ".dam-pakiet-job.is-done{border-color:rgba(46,125,50,.35);background:#f3faf4;}" +
      ".dam-pakiet-job.is-err{border-color:rgba(198,40,40,.35);background:#fff6f6;}" +
      ".dam-pakiet-job.is-run{border-color:rgba(124,92,191,.4);}" +
      ".dam-pakiet-job__top{display:flex;align-items:center;gap:8px;}" +
      ".dam-pakiet-job__name{flex:1;min-width:0;font-size:13px;font-weight:600;color:#2d2a37;" +
      "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".dam-pakiet-job__pct{font-size:12px;font-weight:700;color:#5c5668;}" +
      ".dam-pakiet-job.is-done .dam-pakiet-job__pct{color:#2e7d32;}" +
      ".dam-pakiet-files{margin:6px 0 0;padding:0 0 0 4px;list-style:none;}" +
      ".dam-pakiet-files li{display:flex;align-items:center;gap:6px;font-size:11px;color:#7a7488;padding:2px 0;}" +
      ".dam-pakiet-files li.is-done{color:#2e7d32;}" +
      ".dam-pakiet-files li.is-wait{color:#9a94a6;}" +
      ".dam-pakiet-files li.is-run{color:#6a4fb0;}" +
      ".dam-pakiet-job__open{border:none;background:#f2f8fb;border-radius:6px;width:28px;height:28px;cursor:pointer;color:#3d3a4a;}" +
      ".dam-pakiet-job__open:hover{color:#6a4fb0;}" +
      ".dam-coach-spotlight{position:fixed;z-index:" +
      Z_COACH +
      ";pointer-events:none;border:3px solid #7c5cbf;border-radius:12px;" +
      "box-shadow:0 0 0 9999px rgba(28,25,38,.45),0 0 0 6px rgba(124,92,191,.25);" +
      "transition:top .2s,left .2s,width .2s,height .2s;}" +
      ".dam-coach-bubble{position:fixed;z-index:" +
      (Z_COACH + 1) +
      ";max-width:280px;background:#fff;border-radius:14px;padding:12px 14px;" +
      "border:1px solid rgba(70,66,85,.12);box-shadow:0 12px 32px rgba(28,25,38,.2);font-size:13px;color:#3d3a4a;}" +
      ".dam-help-search{margin:0 0 14px;}" +
      ".dam-help-search__input{width:100%;}" +
      ".dam-help-suggest{list-style:none;margin:8px 0 0;padding:0;border:1px solid rgba(70,66,85,.12);" +
      "border-radius:12px;overflow:hidden;background:#fff;}" +
      ".dam-help-suggest[hidden]{display:none!important;}" +
      ".dam-help-suggest__item{display:block;width:100%;text-align:left;border:none;background:#fff;" +
      "padding:10px 12px;cursor:pointer;border-bottom:1px solid rgba(70,66,85,.06);}" +
      ".dam-help-suggest__item:hover,.dam-help-suggest__item:focus{background:#f4f0fb;}" +
      ".dam-help-suggest__item:last-child{border-bottom:none;}" +
      ".dam-help-suggest__label{display:block;font-size:13px;font-weight:600;color:#2d2a37;}" +
      ".dam-help-suggest__hint{display:block;font-size:12px;color:#7a7488;margin-top:2px;}";
    document.head.appendChild(st);
  }

  function removeEl(id) {
    var n = document.getElementById(id);
    if (n && n.parentNode) n.parentNode.removeChild(n);
  }

  function ctxFromButton(btn) {
    return {
      revPath: (btn && btn.getAttribute("data-pakiet-path")) || "",
      index: (btn && btn.getAttribute("data-pakiet-index")) || "",
      productId:
        (btn && btn.getAttribute("data-pakiet-product")) ||
        (global.DamExplorer &&
          global.DamExplorer.state &&
          global.DamExplorer.state.product &&
          global.DamExplorer.state.product.id) ||
        "",
      label:
        (btn && (btn.getAttribute("data-dam-tip") || btn.textContent)) ||
        "PAKIET",
      btn: btn || null,
    };
  }

  function packOne(job, destDir) {
    return fetch(bridgeUrl() + "/explorer/pack-print", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        revision_path: job.revPath || "",
        path: job.revPath || "",
        product_id: job.productId || "",
        index: job.index || "",
        dry_run: false,
        dest_dir: destDir || "",
      }),
    }).then(function (r) {
      return r.json().then(function (data) {
        return { http: r.status, data: data || {} };
      });
    });
  }

  function dryOne(job) {
    return fetch(bridgeUrl() + "/explorer/pack-print", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        revision_path: job.revPath || "",
        path: job.revPath || "",
        product_id: job.productId || "",
        index: job.index || "",
        dry_run: true,
      }),
    })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return null;
      });
  }

  function applyResultToExplorer(data, btn) {
    if (!data || !data.ok) return;
    if (global.DamExplorer && typeof global.DamExplorer.applyPakietFileToProduct === "function") {
      global.DamExplorer.applyPakietFileToProduct(data);
    }
    try {
      if (btn) {
        var toggleRow = btn.closest(".dam-carrier-toggle-row[data-toggle-code]");
        if (toggleRow && global.DamExplorer && global.DamExplorer.state) {
          var code = toggleRow.getAttribute("data-toggle-code");
          if (code) global.DamExplorer.state.expandedCarriers[code] = true;
        }
      }
      if (global.DamExplorer && typeof global.DamExplorer.renderMain === "function") {
        global.DamExplorer.renderMain();
      }
    } catch (e) { /* ignore */ }
  }

  function revealPath(path) {
    if (!path) return;
    if (global.DamPaths && typeof global.DamPaths.revealInExplorer === "function") {
      global.DamPaths.revealInExplorer(path);
      return;
    }
    fetch(bridgeUrl() + "/reveal", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ path: path }),
    }).catch(function () { /* ignore */ });
  }

  /* ---------- Choice dialog ---------- */
  function openChoice(ctx) {
    ensureCss();
    removeEl("damPakietChoice");
    var wrap = document.createElement("div");
    wrap.id = "damPakietChoice";
    wrap.className = "dam-pakiet-overlay";
    wrap.innerHTML =
      '<div class="dam-pakiet-card" role="dialog" aria-modal="true" aria-labelledby="damPakietChoiceTitle">' +
      '<button type="button" class="dam-pakiet-card__x" data-pakiet-act="close" aria-label="Zamknij">' +
      '<i class="uil uil-times" aria-hidden="true"></i></button>' +
      '<div class="dam-pakiet-mascot-row">' +
      '<div class="dam-pakiet-mascot" aria-hidden="true" style="--dam-pakiet-pose:url(\'' +
      esc(poseUrl("pose-think-q.png")) +
      "')\">" +
      '<span class="dam-pakiet-mascot__img"></span></div>' +
      '<div class="dam-pakiet-bubble">' +
      '<strong id="damPakietChoiceTitle">Dobrokaloriuś pyta</strong>' +
      "<p>Pakujemy tylko ten wariant, czy za jednym zamachem chcesz spakować więcej?</p>" +
      "</div></div>" +
      '<div class="dam-pakiet-actions dam-dialog-actions">' +
      '<button type="button" class="geex-btn geex-btn--primary" data-pakiet-act="one">Tylko ten</button>' +
      '<button type="button" class="geex-btn geex-btn--secondary" data-pakiet-act="more">Spakuj więcej</button>' +
      "</div></div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-pakiet-act]") : null;
      if (!btn) {
        if (e.target === wrap) removeEl("damPakietChoice");
        return;
      }
      var act = btn.getAttribute("data-pakiet-act");
      if (act === "close") {
        removeEl("damPakietChoice");
        return;
      }
      removeEl("damPakietChoice");
      if (act === "one") {
        runJobs([ctx], "", ctx.btn);
        return;
      }
      if (act === "more") openPicker(ctx);
    });
    document.addEventListener(
      "keydown",
      function onEsc(e) {
        if (e.key !== "Escape") return;
        e.preventDefault();
        removeEl("damPakietChoice");
        document.removeEventListener("keydown", onEsc, true);
      },
      true
    );
  }

  /* ---------- Multi picker ---------- */
  function collectSiblingJobs(ctx) {
    var out = [];
    var seen = {};
    function add(job, seed) {
      if (!job || !job.revPath) return;
      var key = String(job.revPath).toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push({
        revPath: job.revPath,
        index: job.index || "",
        productId: job.productId || ctx.productId || "",
        title: job.title || job.index || "Wariant",
        meta: job.meta || "",
        seed: !!seed,
        checked: !!seed || key === String(ctx.revPath || "").toLowerCase(),
      });
    }
    add(
      {
        revPath: ctx.revPath,
        index: ctx.index,
        productId: ctx.productId,
        title: (ctx.index ? ctx.index + " · " : "") + "Bieżący wariant",
        meta: ctx.productId || "",
      },
      true
    );
    try {
      document.querySelectorAll("[data-pakiet-path]").forEach(function (b) {
        add({
          revPath: b.getAttribute("data-pakiet-path") || "",
          index: b.getAttribute("data-pakiet-index") || "",
          productId: b.getAttribute("data-pakiet-product") || ctx.productId || "",
          title: b.getAttribute("data-pakiet-index") || "Wariant",
          meta: b.closest(".dam-carrier-toggle-row")
            ? b.closest(".dam-carrier-toggle-row").getAttribute("data-toggle-code") || ""
            : "",
        });
      });
    } catch (e) { /* ignore */ }
    return out;
  }

  function searchExtraJobs(q, limit) {
    limit = limit || 40;
    q = String(q || "").trim().toLowerCase();
    if (q.length < 2) return Promise.resolve([]);
    var idx = global._DAM_FILE_INDEX;
    function fromProducts(products) {
      var rows = [];
      for (var i = 0; i < products.length && rows.length < limit; i++) {
        var p = products[i];
        if (!p) continue;
        var blob = (
          (p.name || "") +
          " " +
          (p.id || "") +
          " " +
          (p.search_blob || "") +
          " " +
          ((p.indexes || []).join(" ") || "")
        ).toLowerCase();
        if (blob.indexOf(q) === -1) continue;
        var revs = p.revisions || p.variants || [];
        if (!revs.length && p.path) {
          rows.push({
            revPath: p.path,
            index: (p.indexes && p.indexes[0]) || "",
            productId: p.id || "",
            title: p.name || p.id || "Produkt",
            meta: p.id || "",
            checked: false,
          });
          continue;
        }
        for (var r = 0; r < revs.length && rows.length < limit; r++) {
          var rev = revs[r];
          if (!rev || !rev.path) continue;
          rows.push({
            revPath: rev.path,
            index: rev.index || rev.code || "",
            productId: p.id || "",
            title: (p.name || p.id || "Produkt") + " · " + (rev.index || rev.code || "rev"),
            meta: p.id || "",
            checked: false,
          });
        }
      }
      return rows;
    }
    if (idx && Array.isArray(idx.products)) {
      return Promise.resolve(fromProducts(idx.products));
    }
    if (global.DamSearch && typeof global.DamSearch.search === "function") {
      return Promise.resolve(global.DamSearch.search(q, { limit: limit })).then(function (hits) {
        return (hits || []).slice(0, limit).map(function (h) {
          return {
            revPath: h.path || h.revision_path || "",
            index: h.index || "",
            productId: h.product_id || h.id || "",
            title: h.name || h.label || h.id || "Wynik",
            meta: h.product_id || "",
            checked: false,
          };
        }).filter(function (x) {
          return !!x.revPath;
        });
      });
    }
    return fetch("data/file-index.json?v=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (d) {
        if (d) global._DAM_FILE_INDEX = d;
        return fromProducts((d && d.products) || []);
      })
      .catch(function () {
        return [];
      });
  }

  function openPicker(ctx) {
    ensureCss();
    removeEl("damPakietPicker");
    var jobs = collectSiblingJobs(ctx);
    var destMode = "per-revision";
    var destPath = "";
    var wrap = document.createElement("div");
    wrap.id = "damPakietPicker";
    wrap.className = "dam-pakiet-picker";
    wrap.innerHTML =
      '<div class="dam-pakiet-picker__panel" role="dialog" aria-modal="true" aria-labelledby="damPakietPickerTitle">' +
      '<header class="dam-pakiet-picker__head">' +
      '<div class="dam-pakiet-picker__head-text">' +
      '<p class="dam-pakiet-picker__eyebrow">PAKIET</p>' +
      '<h3 class="dam-pakiet-picker__title" id="damPakietPickerTitle">Wybierz warianty do spakowania</h3>' +
      "</div>" +
      '<button type="button" class="dam-pakiet-card__x" data-pakiet-pick="close" aria-label="Zamknij">' +
      '<i class="uil uil-times" aria-hidden="true"></i></button>' +
      "</header>" +
      '<div class="dam-pakiet-picker__body">' +
      '<input type="search" class="form-control dam-pakiet-search" id="damPakietSearch" ' +
      'placeholder="Szukaj produktu / indeksu…" autocomplete="off" />' +
      '<div class="dam-pakiet-dest">' +
      '<label><input type="radio" name="damPakietDest" value="per-revision" checked /> ' +
      "3 - DRUK każdego wariantu</label>" +
      '<label><input type="radio" name="damPakietDest" value="custom" /> Jeden folder</label>' +
      '<button type="button" class="geex-btn geex-btn--ghost" data-pakiet-pick="browse" disabled>Wybierz folder…</button>' +
      '<span class="dam-pakiet-dest__path" id="damPakietDestPath">Domyślnie: ZIP w 3 - DRUK (źródła: 2 - PROJEKT + 4 - WIZKI)</span>' +
      "</div>" +
      '<ul class="dam-pakiet-list" id="damPakietList"></ul>' +
      "</div>" +
      '<footer class="dam-pakiet-picker__footer dam-dialog-actions">' +
      '<button type="button" class="geex-btn geex-btn--ghost" data-pakiet-pick="close">Anuluj</button>' +
      '<span class="dam-dialog-actions__spacer" aria-hidden="true"></span>' +
      '<button type="button" class="geex-btn geex-btn--primary" data-pakiet-pick="go">Spakuj zaznaczone</button>' +
      "</footer></div>";
    document.body.appendChild(wrap);

    function renderList(extra) {
      var map = {};
      jobs.forEach(function (j) {
        map[String(j.revPath).toLowerCase()] = j;
      });
      (extra || []).forEach(function (j) {
        var k = String(j.revPath).toLowerCase();
        if (!map[k]) {
          jobs.push(j);
          map[k] = j;
        }
      });
      var ul = document.getElementById("damPakietList");
      if (!ul) return;
      ul.innerHTML = jobs
        .map(function (j, i) {
          return (
            '<li class="dam-pakiet-row' +
            (j.seed ? " is-seed" : "") +
            '">' +
            '<input type="checkbox" data-pakiet-i="' +
            i +
            '"' +
            (j.checked ? " checked" : "") +
            " />" +
            "<div><div class=\"dam-pakiet-row__title\">" +
            esc(j.title) +
            '</div><div class="dam-pakiet-row__meta">' +
            esc(j.meta || j.revPath) +
            "</div></div>" +
            "<span>" +
            esc(j.index || "") +
            "</span></li>"
          );
        })
        .join("");
    }

    renderList();

    var search = document.getElementById("damPakietSearch");
    var searchTimer = null;
    if (search) {
      search.addEventListener("input", function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          searchExtraJobs(search.value).then(function (extra) {
            renderList(extra);
          });
        }, 220);
      });
    }

    wrap.addEventListener("change", function (e) {
      var t = e.target;
      if (t && t.name === "damPakietDest") {
        destMode = t.value;
        var browse = wrap.querySelector('[data-pakiet-pick="browse"]');
        if (browse) browse.disabled = destMode !== "custom";
        var pathEl = document.getElementById("damPakietDestPath");
        if (pathEl && destMode === "per-revision") {
          pathEl.textContent = "Domyślnie: ZIP w 3 - DRUK (źródła: 2 - PROJEKT + 4 - WIZKI)";
          destPath = "";
        }
      }
      if (t && t.getAttribute && t.getAttribute("data-pakiet-i") != null) {
        var ix = parseInt(t.getAttribute("data-pakiet-i"), 10);
        if (jobs[ix]) jobs[ix].checked = !!t.checked;
      }
    });

    wrap.addEventListener("click", function (e) {
      var actBtn = e.target && e.target.closest ? e.target.closest("[data-pakiet-pick]") : null;
      if (!actBtn) {
        if (e.target === wrap) removeEl("damPakietPicker");
        return;
      }
      var act = actBtn.getAttribute("data-pakiet-pick");
      if (act === "close") {
        removeEl("damPakietPicker");
        return;
      }
      if (act === "browse") {
        var start =
          (global.DamPaths && typeof global.DamPaths.getBasePath === "function" && global.DamPaths.getBasePath()) ||
          "";
        var picker =
          global.DamPaths && typeof global.DamPaths.pickFolder === "function"
            ? global.DamPaths.pickFolder(start)
            : Promise.resolve({ ok: false, error: "pick_unavailable" });
        picker.then(function (res) {
          if (!res || !res.ok || !res.path) {
            if (res && res.cancelled) return;
            toast((res && res.error) || "Nie wybrano folderu.", "error");
            return;
          }
          destMode = "custom";
          destPath = res.path;
          var radios = wrap.querySelectorAll('input[name="damPakietDest"]');
          radios.forEach(function (r) {
            r.checked = r.value === "custom";
          });
          var browse = wrap.querySelector('[data-pakiet-pick="browse"]');
          if (browse) browse.disabled = false;
          var pathEl = document.getElementById("damPakietDestPath");
          if (pathEl) pathEl.textContent = destPath;
        });
        return;
      }
      if (act === "go") {
        var selected = jobs.filter(function (j) {
          return j.checked && j.revPath;
        });
        if (!selected.length) {
          toast("Zaznacz przynajmniej jeden wariant.", "error");
          return;
        }
        if (destMode === "custom" && !destPath) {
          toast("Wybierz folder docelowy albo wróć do 3 - DRUK.", "error");
          return;
        }
        removeEl("damPakietPicker");
        runJobs(selected, destMode === "custom" ? destPath : "", ctx.btn);
      }
    });
  }

  /* ---------- Progress ---------- */
  function ensureProgress() {
    ensureCss();
    var el = document.getElementById("damPakietProgress");
    if (el) return el;
    el = document.createElement("div");
    el.id = "damPakietProgress";
    el.className = "dam-pakiet-progress";
    el.innerHTML =
      '<div class="dam-pakiet-progress__head">' +
      '<h4 class="dam-pakiet-progress__title">Pakowanie PAKIET</h4>' +
      '<button type="button" class="dam-pakiet-card__x" data-pakiet-prog="close" aria-label="Zamknij">' +
      '<i class="uil uil-times" aria-hidden="true"></i></button>' +
      "</div>" +
      '<div class="dam-pakiet-progress__bar" aria-hidden="true"><i id="damPakietBarFill"></i></div>' +
      '<div class="dam-pakiet-progress__meta"><span id="damPakietProgPct">0%</span><span id="damPakietProgEta">ETA…</span></div>' +
      '<ul class="dam-pakiet-progress__list" id="damPakietProgList"></ul>';
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("[data-pakiet-prog]") : null;
      if (!b) return;
      var a = b.getAttribute("data-pakiet-prog");
      if (a === "close") removeEl("damPakietProgress");
      if (a === "open") revealPath(b.getAttribute("data-path") || "");
    });
    return el;
  }

  function fmtSec(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + " s";
    return Math.floor(s / 60) + " min " + (s % 60) + " s";
  }

  function renderProgress(state) {
    var el = ensureProgress();
    var fill = document.getElementById("damPakietBarFill");
    var pctEl = document.getElementById("damPakietProgPct");
    var etaEl = document.getElementById("damPakietProgEta");
    var list = document.getElementById("damPakietProgList");
    var done = state.jobs.filter(function (j) {
      return j.status === "done" || j.status === "err";
    }).length;
    var pct = state.jobs.length ? Math.round((done / state.jobs.length) * 100) : 0;
    if (fill) fill.style.width = pct + "%";
    if (pctEl) pctEl.textContent = pct + "%";
    var remaining = state.jobs.length - done;
    var avg = state.times.length
      ? state.times.reduce(function (a, b) {
          return a + b;
        }, 0) / state.times.length
      : 0;
    if (etaEl) {
      etaEl.textContent =
        remaining <= 0
          ? "Gotowe · " + fmtSec(Date.now() - state.t0)
          : "ETA ~ " + fmtSec(avg * remaining);
    }
    if (!list) return;
    list.innerHTML = state.jobs
      .map(function (j) {
        if (j.condensed) {
          return (
            '<li class="dam-pakiet-job is-done">' +
            '<div class="dam-pakiet-job__top">' +
            '<span class="dam-pakiet-job__name">' +
            esc(j.title) +
            "</span>" +
            '<span class="dam-pakiet-job__pct">' +
            (j.okPct != null ? j.okPct + "%" : "100%") +
            " · " +
            esc(fmtSec(j.elapsed || 0)) +
            "</span>" +
            (j.zipPath
              ? '<button type="button" class="dam-pakiet-job__open" data-pakiet-prog="open" data-path="' +
                esc(j.zipPath) +
                '" title="Otwórz w Eksploratorze Windows"><i class="uil uil-folder-open" aria-hidden="true"></i></button>'
              : "") +
            "</div></li>"
          );
        }
        var cls =
          "dam-pakiet-job" +
          (j.status === "done" ? " is-done" : "") +
          (j.status === "err" ? " is-err" : "") +
          (j.status === "run" ? " is-run" : "");
        var files = (j.files || [])
          .map(function (f) {
            return (
              '<li class="' +
              (f.status === "done" ? "is-done" : f.status === "run" ? "is-run" : "is-wait") +
              '">' +
              '<i class="uil ' +
              (f.status === "done" ? "uil-check" : f.status === "run" ? "uil-spinner" : "uil-circle") +
              '" aria-hidden="true"></i>' +
              esc(f.name) +
              "</li>"
            );
          })
          .join("");
        return (
          '<li class="' +
          cls +
          '">' +
          '<div class="dam-pakiet-job__top">' +
          '<span class="dam-pakiet-job__name">' +
          esc(j.title) +
          "</span>" +
          '<span class="dam-pakiet-job__pct">' +
          (j.status === "run" ? "…" : j.status === "done" ? "OK" : j.status === "err" ? "Błąd" : "w kolejce") +
          "</span></div>" +
          (files ? '<ul class="dam-pakiet-files">' + files + "</ul>" : "") +
          (j.message ? '<div class="dam-pakiet-row__meta">' + esc(j.message) + "</div>" : "") +
          "</li>"
        );
      })
      .join("");
  }

  function runJobs(jobList, destDir, sourceBtn) {
    var state = {
      t0: Date.now(),
      times: [],
      jobs: jobList.map(function (j) {
        return {
          revPath: j.revPath,
          index: j.index,
          productId: j.productId,
          title: j.title || j.index || "Wariant",
          status: "wait",
          files: [],
          condensed: false,
          zipPath: "",
          okPct: null,
          elapsed: 0,
          message: "",
        };
      }),
    };
    renderProgress(state);

    var i = 0;
    function next() {
      if (i >= state.jobs.length) {
        renderProgress(state);
        toast("Pakowanie zakończone.", "success");
        return;
      }
      var job = state.jobs[i];
      job.status = "run";
      renderProgress(state);
      var tStart = Date.now();
      dryOne(job)
        .then(function (dry) {
          if (dry && dry.ok && Array.isArray(dry.entries)) {
            job.files = dry.entries.map(function (e) {
              return { name: e.name || e.arc || "plik", status: "wait" };
            });
          } else if (dry && dry.ok && dry.file_count) {
            job.files = [];
            for (var n = 0; n < Math.min(dry.file_count, 40); n++) {
              job.files.push({ name: "plik " + (n + 1), status: "wait" });
            }
          }
          job.files.forEach(function (f) {
            f.status = "run";
          });
          renderProgress(state);
          return packOne(job, destDir);
        })
        .then(function (res) {
          var data = (res && res.data) || {};
          var elapsed = Date.now() - tStart;
          state.times.push(elapsed);
          job.elapsed = elapsed;
          if (!res || res.http >= 400 || !data.ok) {
            job.status = "err";
            job.message =
              (data && data.message) ||
              (data && data.error) ||
              "pack_failed";
            job.files.forEach(function (f) {
              f.status = "wait";
            });
          } else {
            job.status = "done";
            job.zipPath = data.zip_path || (data.file && data.file.path) || "";
            job.okPct = 100;
            job.files.forEach(function (f) {
              f.status = "done";
            });
            job.condensed = true;
            applyResultToExplorer(data, sourceBtn);
          }
          renderProgress(state);
          i += 1;
          setTimeout(next, 40);
        })
        .catch(function (err) {
          job.status = "err";
          job.message = (err && err.message) || "bridge_error";
          job.elapsed = Date.now() - tStart;
          renderProgress(state);
          i += 1;
          setTimeout(next, 40);
        });
    }
    next();
  }

  function openFromButton(btn) {
    var ctx = ctxFromButton(btn);
    if (!ctx.revPath && !ctx.productId) {
      toast("Brak ścieżki wariantu do pakietu.", "error");
      return;
    }
    openChoice(ctx);
  }

  /* ---------- F1 help catalog / coach ---------- */
  var HELP_CATALOG = [
    {
      id: "pakiet",
      label: "PAKIET / pakowanie ZIP dla agencji",
      hint: "Eksplorator → wiersz wariantu → przycisk PAKIET",
      aliases: [
        "pakiet",
        "pakowanie",
        "zip",
        "paczka",
        "paczka dla agencji",
        "pakiet dla agencji",
        "wizualizacje dla agencji",
        "druk",
        "3 - druk",
        "wizki",
      ],
      href: "explorer.html",
      selector: ".dam-pakiet-btn, [data-pakiet-path]",
      coach: "Tu jest PAKIET - spakujesz 2 - PROJEKT i 4 - WIZKI do ZIP.",
    },
    {
      id: "wizualizacje",
      label: "Wizualizacje",
      hint: "Panel boczny → Wizualizacje",
      aliases: ["wizualizacje", "wizki", "wiz", "galeria"],
      href: "visualizations.html",
      selector: null,
      coach: "Sekcja Wizualizacje w menu po lewej.",
    },
    {
      id: "branding",
      label: "Branding",
      hint: "Panel boczny → Branding",
      aliases: ["branding", "materiały", "materialy", "reklamy"],
      href: "branding.html",
      selector: null,
      coach: "Branding: reklamy, grafiki i skojarzenia.",
    },
    {
      id: "explorer",
      label: "Eksplorator produktów",
      hint: "Panel boczny → Eksplorator",
      aliases: ["eksplorator", "produkty", "folder", "struktura"],
      href: "explorer.html",
      selector: null,
      coach: "Eksplorator: struktura produktów i wariantów.",
    },
  ];

  function searchHelp(q) {
    q = String(q || "").trim().toLowerCase();
    if (!q) return [];
    return HELP_CATALOG.filter(function (item) {
      if (item.label.toLowerCase().indexOf(q) !== -1) return true;
      return (item.aliases || []).some(function (a) {
        return a.indexOf(q) !== -1 || q.indexOf(a) !== -1;
      });
    }).slice(0, 8);
  }

  function coachHighlight(selector, text) {
    ensureCss();
    removeEl("damCoachSpotlight");
    removeEl("damCoachBubble");
    if (!selector) {
      toast(text || "Znaleziono opcję.", "info");
      return;
    }
    var el = document.querySelector(selector);
    if (!el) {
      toast(text || "Otwórz produkt z wariantami, żeby zobaczyć PAKIET.", "info");
      return;
    }
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) { /* ignore */ }
    var r = el.getBoundingClientRect();
    var spot = document.createElement("div");
    spot.id = "damCoachSpotlight";
    spot.className = "dam-coach-spotlight";
    spot.style.top = Math.max(8, r.top - 6) + "px";
    spot.style.left = Math.max(8, r.left - 6) + "px";
    spot.style.width = Math.max(40, r.width + 12) + "px";
    spot.style.height = Math.max(32, r.height + 12) + "px";
    document.body.appendChild(spot);
    var bubble = document.createElement("div");
    bubble.id = "damCoachBubble";
    bubble.className = "dam-coach-bubble";
    bubble.textContent = text || "Tu jest ta opcja.";
    bubble.style.top = Math.min(window.innerHeight - 80, r.bottom + 10) + "px";
    bubble.style.left = Math.min(window.innerWidth - 300, Math.max(12, r.left)) + "px";
    document.body.appendChild(bubble);
    setTimeout(function () {
      removeEl("damCoachSpotlight");
      removeEl("damCoachBubble");
    }, 6000);
  }

  function goHelpItem(item) {
    if (!item) return;
    var here = (global.location.pathname || "").split("/").pop() || "";
    var target = (item.href || "").split("/").pop();
    if (target && here.toLowerCase() !== target.toLowerCase()) {
      try {
        sessionStorage.setItem(
          "dam_help_coach",
          JSON.stringify({ selector: item.selector, coach: item.coach, t: Date.now() })
        );
      } catch (e) { /* ignore */ }
      global.location.href = item.href + (item.href.indexOf("?") >= 0 ? "&" : "?") + "v=" + CB;
      return;
    }
    coachHighlight(item.selector, item.coach);
  }

  function enhanceHelpModal(modal) {
    if (!modal) return;
    ensureCss();
    var body = modal.querySelector(".dam-help-modal__body");
    if (!body || body.querySelector("#damHelpSearch")) return;
    var box = document.createElement("div");
    box.className = "dam-help-search";
    box.innerHTML =
      '<label class="dam-help-modal__eyebrow" for="damHelpSearch">Szukaj opcji w programie</label>' +
      '<input id="damHelpSearch" class="form-control dam-help-search__input" type="search" ' +
      'placeholder="np. pakowanie, zip, paczka dla agencji…" autocomplete="off" />' +
      '<ul class="dam-help-suggest" id="damHelpSuggest" hidden></ul>';
    body.insertBefore(box, body.firstChild);
    var input = box.querySelector("#damHelpSearch");
    var suggest = box.querySelector("#damHelpSuggest");
    function paint(items) {
      if (!items.length) {
        suggest.hidden = true;
        suggest.innerHTML = "";
        return;
      }
      suggest.hidden = false;
      suggest.innerHTML = items
        .map(function (it, i) {
          return (
            '<button type="button" class="dam-help-suggest__item" data-help-i="' +
            i +
            '">' +
            '<span class="dam-help-suggest__label">' +
            esc(it.label) +
            '</span><span class="dam-help-suggest__hint">' +
            esc(it.hint) +
            "</span></button>"
          );
        })
        .join("");
      suggest._items = items;
    }
    input.addEventListener("input", function () {
      paint(searchHelp(input.value));
    });
    suggest.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("[data-help-i]") : null;
      if (!b) return;
      var ix = parseInt(b.getAttribute("data-help-i"), 10);
      var item = (suggest._items || [])[ix];
      if (global.DamShortcuts && typeof global.DamShortcuts.closeHelp === "function") {
        global.DamShortcuts.closeHelp();
      }
      goHelpItem(item);
    });
  }

  function consumeCoachFromStorage() {
    try {
      var raw = sessionStorage.getItem("dam_help_coach");
      if (!raw) return;
      sessionStorage.removeItem("dam_help_coach");
      var data = JSON.parse(raw);
      if (!data || Date.now() - (data.t || 0) > 60000) return;
      setTimeout(function () {
        coachHighlight(data.selector, data.coach);
      }, 600);
    } catch (e) { /* ignore */ }
  }

  function hookHelpOpen() {
    var orig = global.DamShortcuts && global.DamShortcuts.openHelp;
    if (!orig || orig.__damPakietWrapped) return;
    function wrapped() {
      orig.apply(global.DamShortcuts, arguments);
      enhanceHelpModal(document.getElementById("damHelpModal"));
    }
    wrapped.__damPakietWrapped = true;
    global.DamShortcuts.openHelp = wrapped;
  }

  function start() {
    ensureCss();
    consumeCoachFromStorage();
    hookHelpOpen();
    setTimeout(hookHelpOpen, 800);
  }

  global.DamPakiet = {
    openFromButton: openFromButton,
    openChoice: openChoice,
    searchHelp: searchHelp,
    goHelpItem: goHelpItem,
    coachHighlight: coachHighlight,
    HELP_CATALOG: HELP_CATALOG,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window);
