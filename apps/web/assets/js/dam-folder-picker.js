/* DamFolderPicker - shared COMBO #damThumbPicker (extract from dam-viz).
   chrome HARD: Otworz Eksplorator Windows near views; box 70vw x 90vh; grid pad baseline+10. */
(function () {
  "use strict";

  var THUMB_PICKER_VIEW_KEY = "dam_thumb_picker_view";
  /* K0 baseline pad combo/thumbs = 16; expected after chrome = 26 */
  var GRID_PAD_COMBO = "26px";
  var GRID_PAD_LIST = "22px 26px 26px";

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bridgeBase() {
    return (
      (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function" && window.DamPaths.bridgeUrl()) ||
      "http://127.0.0.1:8766"
    );
  }

  function pickerDbg(message, data) {
    try {
      var payload = {
        sessionId: "0f6c29",
        runId: "post-fix",
        hypothesisId: "H3",
        location: "dam-folder-picker.js:open",
        message: message,
        data: data || {},
        timestamp: Date.now(),
      };
      fetch(bridgeBase().replace(/\/$/, "") + "/debug-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(function () {});
    } catch (eDbg) {
      /* ignore */
    }
  }

  function mediaPreviewUrl(indexPath) {
    if (!indexPath) return "";
    var local =
      window.DamPaths && typeof window.DamPaths.toLocal === "function"
        ? window.DamPaths.toLocal(indexPath)
        : indexPath;
    return bridgeBase() + "/media?path=" + encodeURIComponent(local);
  }

  function thumbPickerIndexOf(nameOrPath) {
    if (window.DamMarketingId && typeof window.DamMarketingId.parseIndexFromPath === "function") {
      return window.DamMarketingId.parseIndexFromPath(nameOrPath);
    }
    var m = /(\d{6,7})(?:\.\d{2})?/.exec(String(nameOrPath || ""));
    return m ? m[1] : "";
  }

  function thumbPickerDateOf(f) {
    var raw = (f && (f.mtime || f.modified || f.date)) || "";
    if (!raw) return "";
    var d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw).slice(0, 10);
    return (
      String(d.getDate()).padStart(2, "0") +
      "." +
      String(d.getMonth() + 1).padStart(2, "0") +
      "." +
      d.getFullYear()
    );
  }

  function thumbPickerFolderTagsHtml(name) {
    var idx = thumbPickerFolderIndex(name);
    if (!idx) return "";
    return (
      '<span class="dam-thumb-picker__item-tags">' +
      '<span class="dam-viz-badge dam-viz-badge--index" title="Indeks rewizji (klik = kopiuj)" data-tag-value="' +
      esc(idx) +
      '">' +
      esc(idx) +
      "</span></span>"
    );
  }

  function thumbPickerFolderIndex(name) {
    var m = /(\d{7}\.\d{2})/.exec(String(name || ""));
    if (m) return m[1];
    return thumbPickerIndexOf(name);
  }

  function thumbPickerTagsHtml(f) {
    var tags = "";
    var idx = thumbPickerIndexOf(f.path || f.name);
    if (idx) {
      tags += '<span class="dam-viz-badge dam-viz-badge--index" title="Indeks produktu">' + esc(idx) + "</span>";
    }
    var ext = /\.([a-z0-9]{1,6})$/i.exec(String(f.name || ""));
    if (ext) {
      tags += '<span class="dam-viz-badge" title="Format pliku">' + esc(ext[1].toUpperCase()) + "</span>";
    }
    var date = thumbPickerDateOf(f);
    if (date) {
      tags += '<span class="dam-viz-badge" title="Data modyfikacji">' + esc(date) + "</span>";
    }
    return tags ? '<span class="dam-thumb-picker__item-tags">' + tags + "</span>" : "";
  }

  function ensureThumbPickerTilesCss() {
    var TOKEN = "embedComboInPopover20260726b";
    var style = document.getElementById("dam-thumb-picker-tiles");
    if (!style) {
      style = document.createElement("style");
      style.id = "dam-thumb-picker-tiles";
      document.head.appendChild(style);
    }
    if (style.getAttribute("data-token") === TOKEN && style.textContent) return;
    style.setAttribute("data-token", TOKEN);
    style.textContent =
      "#damThumbPicker.dam-thumb-picker-overlay{" +
      "position:fixed;inset:0;z-index:12650;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(28,24,40,.45);padding:12px;box-sizing:border-box;}" +
      "#damThumbPicker .dam-thumb-picker-box{" +
      "width:70vw;height:90vh;" +
      "min-width:min(640px,calc(100vw - 24px));" +
      "min-height:min(520px,calc(100vh - 24px));" +
      "max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);" +
      "display:flex;flex-direction:column;border-radius:14px;background:#fff;padding:0;overflow:hidden;" +
      "box-shadow:0 18px 48px rgba(40,34,60,.24);}" +
      "#damThumbPicker .dam-thumb-picker__head{" +
      "display:flex;align-items:center;justify-content:space-between;gap:10px;" +
      "min-height:53px;box-sizing:border-box;" +
      "padding:10px 14px;border-bottom:1px solid #ececf2;flex:0 0 auto;background:#fff;}" +
      "#damThumbPicker .dam-thumb-picker__head strong{font-size:15px;font-weight:600;color:#464255;}" +
      "#damThumbPicker .dam-thumb-picker__head .dam-viz-modal-close," +
      "#damThumbPickerClose{" +
      "position:static!important;top:auto!important;right:auto!important;" +
      "flex:0 0 auto;margin-left:8px;}" +
      "#damThumbPicker .dam-thumb-picker__toolbar{" +
      "display:flex;align-items:center;gap:6px;padding:10px 16px;border-bottom:1px solid #f0eef5;flex-wrap:wrap;}" +
      "#damThumbPicker .dam-thumb-picker__views{" +
      "display:inline-flex;gap:2px;border:1px solid #ececf1;border-radius:8px;}" +
      "#damThumbPicker .dam-thumb-picker__windows{" +
      "margin-left:4px;min-height:36px;padding:6px 12px;font-size:12px;white-space:nowrap;}" +
      "#damThumbPicker .dam-thumb-picker__use-folder{" +
      "margin-left:auto;min-height:36px;padding:6px 12px;font-size:12px;}" +
      "#damThumbPicker .dam-thumb-picker__crumbs{" +
      "flex:1 1 240px;min-width:0;display:flex;align-items:center;flex-wrap:wrap;" +
      "gap:1px 2px;row-gap:1px;column-gap:2px;" +
      "overflow:hidden;white-space:normal!important;" +
      "padding:6px 12px 8px;min-height:36px;max-height:none;box-sizing:border-box;" +
      "border:none;border-radius:12px;line-height:1.2;" +
      "background:var(--dam-surface-muted,#f5f6fa);scrollbar-width:none;}" +
      "#damThumbPicker .dam-thumb-picker__crumbs::-webkit-scrollbar{display:none;height:0;}" +
      "#damThumbPicker .dam-thumb-picker__crumb{" +
      "border:none;background:transparent;padding:2px 8px;border-radius:7px;" +
      "color:#6b6980;font-size:12px;cursor:pointer;white-space:nowrap;" +
      "min-height:24px;height:auto;line-height:1.2;box-sizing:border-box;" +
      "max-width:100%;margin:0;}" +
      "#damThumbPicker .dam-thumb-picker__crumb:hover{" +
      "background:#fff;color:var(--dam-primary,#ab54db);}" +
      "#damThumbPicker .dam-thumb-picker__crumb.is-current{" +
      "background:#fff;color:#464255;font-weight:600;cursor:default;" +
      "box-shadow:none;}" +
      "#damThumbPicker .dam-thumb-picker__crumb-sep{" +
      "color:#c3c1cc;font-size:11px;padding:0 1px;line-height:1.2;align-self:center;}" +
      "#damThumbPicker .dam-thumb-picker__nav-btn{" +
      "width:36px;height:36px;min-width:36px;min-height:36px;}" +
      "#damThumbPickerGrid," +
      "#damThumbPicker .dam-thumb-picker__grid{" +
      "flex:1 1 auto;min-height:0;overflow:auto;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs]," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles]," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo]{" +
      "display:grid;background:var(--dam-surface-muted,#f5f6fa);" +
      "gap:12px;padding:" +
      GRID_PAD_COMBO +
      ";" +
      "grid-template-columns:repeat(auto-fill,minmax(128px,1fr));align-content:start;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item:not(.dam-thumb-picker__item--folder)," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item.dam-admin-control," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item.dam-admin-control," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item:not(.dam-thumb-picker__item--folder).dam-admin-control{" +
      "display:flex;flex-direction:column;align-items:stretch;gap:8px;" +
      "padding:10px!important;min-width:0;min-height:44px!important;" +
      "border:1px solid transparent!important;border-radius:14px!important;background:#fff!important;" +
      "box-shadow:none!important;text-align:left;overflow:hidden;box-sizing:border-box;" +
      "font-size:12px!important;color:#464255!important;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item:hover," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item:hover," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item:hover," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item.is-hover," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item.is-hover," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item.is-hover{" +
      "border-color:transparent!important;" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 6%,#fff)!important;" +
      "outline:2px solid color-mix(in srgb,var(--dam-primary,#ab54db) 28%,transparent);" +
      "outline-offset:1px;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item.is-focus," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item.is-focus," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item.is-focus," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item.is-focus{" +
      "border-color:transparent!important;" +
      "outline:3px solid rgba(171,84,219,.55)!important;outline-offset:2px;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item img," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item img," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item:not(.dam-thumb-picker__item--folder) img{" +
      "display:block;width:100%;max-width:100%;height:auto!important;aspect-ratio:1;" +
      "object-fit:contain;border-radius:10px;background:#fff;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item-tags," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item-tags{display:none;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item--folder > i," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item--folder > i," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item > i.uil-image," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item > i.uil-image," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item:not(.dam-thumb-picker__item--folder) > i.uil-image{" +
      "display:flex;align-items:center;justify-content:center;" +
      "width:100%;aspect-ratio:1;border-radius:10px;" +
      "background:var(--dam-surface-muted,#f5f6fa);font-size:36px;" +
      "color:color-mix(in srgb,var(--dam-primary,#ab54db) 55%,#8b8d97);}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__name," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__name," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item:not(.dam-thumb-picker__item--folder) .dam-thumb-picker__name{" +
      "font-size:11.5px;font-weight:600;color:#464255;line-height:1.35;" +
      "overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;" +
      "word-break:break-word;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list]{" +
      "display:flex;flex-direction:column;gap:8px;" +
      "background:var(--dam-surface-muted,#f5f6fa);padding:" +
      GRID_PAD_LIST +
      ";}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item.dam-admin-control{" +
      "display:flex!important;flex-direction:row!important;align-items:center;gap:12px;" +
      "width:100%;padding:10px 14px!important;min-height:44px!important;" +
      "background:#fff!important;border:1px solid transparent!important;border-radius:12px!important;" +
      "box-shadow:none!important;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item img{" +
      "width:40px;height:40px;aspect-ratio:1;object-fit:contain;border-radius:8px;flex:0 0 auto;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item > i," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item--folder > i{" +
      "display:flex;align-items:center;justify-content:center;" +
      "width:36px;height:36px;flex:0 0 auto;aspect-ratio:auto;border-radius:8px;" +
      "background:var(--dam-surface-muted,#f5f6fa);font-size:20px;" +
      "color:color-mix(in srgb,var(--dam-primary,#ab54db) 55%,#8b8d97);}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__meta{flex:1 1 auto;min-width:0;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__name{" +
      "display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" +
      "font-size:13px;font-weight:600;-webkit-line-clamp:unset;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=list] .dam-thumb-picker__item:hover{" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 6%,#fff)!important;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item--folder," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item--folder.dam-admin-control{" +
      "grid-column:1/-1;display:flex!important;flex-direction:row!important;align-items:center;" +
      "gap:12px;width:100%;padding:10px 14px!important;min-height:44px!important;" +
      "background:#fff!important;border:1px solid transparent!important;border-radius:12px!important;" +
      "overflow:hidden;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item--folder > i{" +
      "display:flex;align-items:center;justify-content:center;" +
      "width:36px;height:36px;flex:0 0 auto;aspect-ratio:auto!important;border-radius:8px;" +
      "background:var(--dam-surface-muted,#f5f6fa);font-size:20px;" +
      "color:color-mix(in srgb,var(--dam-primary,#ab54db) 55%,#8b8d97);}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item--folder .dam-thumb-picker__meta{" +
      "flex:1 1 auto;min-width:0;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=combo] .dam-thumb-picker__item--folder .dam-thumb-picker__name{" +
      "display:block!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" +
      "font-size:13px;font-weight:600;line-height:1.3;" +
      "-webkit-line-clamp:unset!important;-webkit-box-orient:unset!important;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item--folder," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item--folder{" +
      "display:flex!important;flex-direction:column!important;align-items:stretch!important;" +
      "grid-column:auto!important;width:auto!important;gap:8px!important;" +
      "padding:10px!important;min-height:118px!important;overflow:visible;box-sizing:border-box;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item--folder > i," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item--folder > i{" +
      "display:flex!important;align-items:center;justify-content:center;" +
      "width:100%!important;height:52px!important;max-height:52px!important;flex:0 0 52px!important;" +
      "aspect-ratio:unset!important;border-radius:10px;" +
      "background:var(--dam-surface-muted,#f5f6fa);font-size:32px;" +
      "color:color-mix(in srgb,var(--dam-primary,#ab54db) 55%,#8b8d97);}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item--folder .dam-thumb-picker__meta," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item--folder .dam-thumb-picker__meta{" +
      "flex:1 1 auto;min-width:0;width:100%;min-height:2.6em;}" +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=thumbs] .dam-thumb-picker__item--folder .dam-thumb-picker__name," +
      "#damThumbPicker .dam-thumb-picker__grid[data-view=tiles] .dam-thumb-picker__item--folder .dam-thumb-picker__name{" +
      "display:-webkit-box!important;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;" +
      "font-size:11.5px;font-weight:600;color:#464255;line-height:1.35;word-break:break-word;" +
      "white-space:normal!important;text-overflow:unset!important;min-height:2.6em;}" +
      "#damThumbPicker .dam-thumb-picker__item.is-selected{" +
      "outline:3px solid rgba(171,84,219,.55)!important;outline-offset:2px;" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 8%,#fff)!important;}" +
      "#damThumbPicker .dam-thumb-picker__footer{" +
      "display:grid;grid-template-columns:minmax(96px,auto) minmax(148px,auto) 1fr minmax(120px,auto);" +
      "align-items:center;gap:8px;min-height:65px;box-sizing:border-box;" +
      "padding:12px 14px;border-top:1px solid #ececf2;flex:0 0 auto;background:#f7f6fa;}" +
      "#damThumbPicker .dam-thumb-picker__footer .dam-dialog-actions__spacer{display:none;}" +
      "#damThumbPicker .dam-thumb-picker__footer > .dam-modal-footer__back{grid-column:1;}" +
      "#damThumbPicker .dam-thumb-picker__footer > .dam-modal-footer__secondary{grid-column:2;}" +
      "#damThumbPicker .dam-thumb-picker__footer > [data-confirm]{grid-column:4;justify-self:end;}" +
      "#damThumbPicker.dam-thumb-picker-overlay--stacked{background:transparent!important;padding:0!important;pointer-events:none;}" +
      "#damThumbPicker.dam-thumb-picker-overlay--stacked .dam-thumb-picker-box{pointer-events:auto;border:1px solid #e2e2ea;" +
      "box-shadow:0 20px 48px rgba(40,34,60,.28);}" +
      "#damThumbPicker .dam-tag-edit-popover__confirm,#damThumbPicker .dam-tag-edit-popover__cancel{" +
      "display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 16px;" +
      "border-radius:10px;font-size:12.5px;font-weight:600;border-width:1px;cursor:pointer;}" +
      "#damThumbPicker .dam-tag-edit-popover__confirm{background:color-mix(in srgb,var(--dam-primary,#ab54db) 14%,#fff);" +
      "border:1px solid color-mix(in srgb,var(--dam-primary,#ab54db) 55%,#fff);color:#7a3aa8;}" +
      "#damThumbPicker .dam-tag-edit-popover__confirm[data-confirm]{background:var(--dam-primary,#ab54db);" +
      "border-color:var(--dam-primary,#ab54db);color:#fff;}" +
      "#damThumbPicker .dam-tag-edit-popover__confirm[data-confirm]:disabled{opacity:.45;cursor:not-allowed;}" +
      "#damThumbPicker .dam-tag-edit-popover__cancel{background:#fff;border:1px solid #e2e2ea;color:#6b6b76;}" +
      ".dam-thumb-picker-embed-root{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden;flex:1 1 auto;}" +
      ".dam-thumb-picker-embed-root .dam-thumb-picker__toolbar{flex:0 0 auto;}" +
      ".dam-thumb-picker-embed-root .dam-thumb-picker__grid,.dam-thumb-picker-embed-root #damThumbPickerGrid{flex:1 1 auto;min-height:0;overflow:auto;}";
    var embedDup = style.textContent
      .replace(/#damThumbPicker \./g, ".dam-thumb-picker-embed-root .")
      .replace(/#damThumbPickerGrid/g, ".dam-thumb-picker-embed-root #damThumbPickerGrid");
    style.textContent = style.textContent + embedDup;
  }

  function pickerToast(msg) {
    if (window.DamDanger && typeof window.DamDanger.toast === "function") {
      window.DamDanger.toast(msg);
    } else if (typeof window.showToast === "function") {
      window.showToast(msg);
    }
  }

  function normPathKey(p) {
    return String(p || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  }

  function fetchJsonWithTimeout(url, timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = null;
    if (ctrl) {
      timer = setTimeout(function () {
        try {
          ctrl.abort();
        } catch (eAbort) {
          /* ignore */
        }
      }, timeoutMs);
    }
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        if (timer) clearTimeout(timer);
        return r.json();
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        return null;
      });
  }

  function resolveBrandingAssetId(filePath, done) {
    var want = normPathKey(filePath);
    if (!want) {
      done(null);
      return;
    }
    var fname = want.split("/").pop() || "";
    fetchJsonWithTimeout(
      bridgeBase() +
        "/branding-search-picker?q=" +
        encodeURIComponent(fname) +
        "&limit=40",
      8000
    ).then(function (data) {
      var entries = (data && data.entries) || [];
      var exact = null;
      var byName = [];
      for (var i = 0; i < entries.length; i++) {
        var ep = normPathKey(entries[i] && entries[i].path);
        if (!ep) continue;
        if (ep === want) {
          exact = entries[i];
          break;
        }
        if ((ep.split("/").pop() || "") === fname) byName.push(entries[i]);
      }
      if (exact && exact.id) {
        done(exact.id);
        return;
      }
      /* Unique basename hit when path casing/slash differs slightly. */
      if (byName.length === 1 && byName[0].id) {
        done(byName[0].id);
        return;
      }
      done(null);
    });
  }

  function alignStackedToAssoc(overlay) {
    var anchor = document.getElementById("damAssocEditPopover");
    var box = overlay && overlay.querySelector(".dam-thumb-picker-box");
    if (!anchor || !box) return;
    var r = anchor.getBoundingClientRect();
    overlay.classList.add("dam-thumb-picker-overlay--stacked");
    box.style.position = "fixed";
    box.style.left = Math.round(r.left) + "px";
    box.style.top = Math.round(r.top) + "px";
    box.style.width = Math.round(r.width) + "px";
    box.style.height = Math.round(r.height) + "px";
    box.style.maxWidth = Math.round(r.width) + "px";
    box.style.maxHeight = Math.round(r.height) + "px";
    box.style.minWidth = Math.round(r.width) + "px";
    box.style.minHeight = Math.round(r.height) + "px";
  }

  function open(opts) {
    opts = opts || {};
    var embedHost = null;
    if (opts.embedHost) {
      embedHost =
        typeof opts.embedHost === "string" ? document.querySelector(opts.embedHost) : opts.embedHost;
    }
    var startDir = opts.startDir || opts.dir || "";
    var mode = opts.mode === "file" ? "file" : "folder";
    var title =
      opts.title ||
      (mode === "folder" ? "Wybierz folder" : "Wybierz plik");
    var onPicked = typeof opts.onPicked === "function" ? opts.onPicked : function () {};
    var onDismiss = typeof opts.onDismiss === "function" ? opts.onDismiss : null;
    var onCancel = typeof opts.onCancel === "function" ? opts.onCancel : null;
    var showWindowsButton = opts.showWindowsButton !== false;
    var stackOnAssoc = !embedHost && opts.stackOnAssoc === true;

    ensureThumbPickerTilesCss();
    if (!embedHost) {
      var existing = document.getElementById("damThumbPicker");
      if (existing) existing.remove();
    }
    var view = localStorage.getItem(THUMB_PICKER_VIEW_KEY) || "combo";
    if (view === "tiles") view = "thumbs";
    if (["combo", "list", "thumbs"].indexOf(view) < 0) view = "combo";
    var history = [];
    var histPos = -1;
    var currentPath = "";
    var currentParent = "";
    var selection = null;
    /* Explicit opt-in only — title "wariantu produktu" must NOT trigger branding lookup. */
    var resolveAssetIds = opts.resolveBrandingAssetId === true;
    /** File mode + folder click + Wybierz (wariant produktu = folder rewizji). */
    var allowFolderPick = opts.allowFolderPick === true;

    var toolbarHtml =
      '<div class="dam-thumb-picker__toolbar">' +
      '<button type="button" class="dam-thumb-picker__nav-btn" id="damThumbPickerBack" data-dam-tip="Wstecz" aria-label="Wstecz" disabled><i class="uil uil-angle-left"></i></button>' +
      '<button type="button" class="dam-thumb-picker__nav-btn" id="damThumbPickerFwd" data-dam-tip="Dalej" aria-label="Dalej" disabled><i class="uil uil-angle-right"></i></button>' +
      '<button type="button" class="dam-thumb-picker__nav-btn" id="damThumbPickerUp" data-dam-tip="Folder wyżej" aria-label="Folder wyżej" disabled><i class="uil uil-arrow-up"></i></button>' +
      '<button type="button" class="dam-thumb-picker__nav-btn" id="damThumbPickerRefresh" data-dam-tip="Odśwież" aria-label="Odśwież"><i class="uil uil-refresh"></i></button>' +
      '<div class="dam-thumb-picker__crumbs" id="damThumbPickerCrumbs" aria-label="Ścieżka"></div>' +
      '<div class="dam-thumb-picker__toolbar-side">' +
      '<div class="dam-thumb-picker__views" role="group" aria-label="Widok">' +
      '<button type="button" class="dam-thumb-picker__view-btn" data-picker-view="combo" data-dam-tip="Combo: foldery lista, pliki kafelki" aria-label="Combo"><i class="uil uil-apps"></i></button>' +
      '<button type="button" class="dam-thumb-picker__view-btn" data-picker-view="list" data-dam-tip="Lista" aria-label="Lista"><i class="uil uil-list-ul"></i></button>' +
      '<button type="button" class="dam-thumb-picker__view-btn" data-picker-view="thumbs" data-dam-tip="Miniatury" aria-label="Miniatury"><i class="uil uil-table"></i></button>' +
      "</div>" +
      (showWindowsButton
        ? '<button type="button" class="dam-admin-control dam-thumb-picker__windows" id="damThumbPickerWindows">Otwórz Eksplorator Windows</button>'
        : "") +
      "</div></div>";
    var gridHtml =
      '<div class="dam-thumb-picker__grid" id="damThumbPickerGrid" data-view="' +
      esc(view) +
      '"><p class="dam-thumb-picker__status">Ładowanie…</p></div>';

    var overlay;
    var confirmBtn;
    var cancelBtn;

    if (embedHost) {
      embedHost.classList.add("dam-thumb-picker-embed-root");
      embedHost.innerHTML = toolbarHtml + gridHtml;
      overlay = embedHost;
      confirmBtn = opts.externalConfirmBtn || null;
    } else {
      overlay = document.createElement("div");
      overlay.id = "damThumbPicker";
      overlay.className = "dam-thumb-picker-overlay";
      overlay.style.zIndex = "12650";
      overlay.innerHTML =
        '<div class="dam-thumb-picker-box" role="dialog" aria-modal="true" aria-label="' +
        esc(title) +
        '">' +
        '<div class="dam-thumb-picker__head"><strong>' +
        esc(title) +
        "</strong>" +
        '<button type="button" class="dam-viz-modal-close" id="damThumbPickerClose" aria-label="Zamknij"><i class="uil uil-times"></i></button></div>' +
        toolbarHtml +
        gridHtml +
        '<div class="dam-thumb-picker__footer dam-tag-edit-popover__actions dam-dialog-actions dam-modal-footer">' +
        '<button type="button" class="dam-tag-edit-popover__cancel dam-modal-footer__back" id="damThumbPickerBackStep">' +
        '<i class="uil uil-arrow-left"></i><span>Wstecz</span></button>' +
        '<button type="button" class="dam-tag-edit-popover__cancel dam-modal-footer__secondary" id="damThumbPickerCancel">Anuluj</button>' +
        '<button type="button" class="dam-tag-edit-popover__confirm dam-modal-footer__primary dam-thumb-picker__confirm" data-confirm id="damThumbPickerConfirm" disabled>Wybierz</button>' +
        "</div></div>";
      document.body.appendChild(overlay);
      if (stackOnAssoc) alignStackedToAssoc(overlay);
      confirmBtn = document.getElementById("damThumbPickerConfirm");
      cancelBtn = document.getElementById("damThumbPickerCancel");
    }
    pickerDbg("shell_mounted", { mode: mode, title: title, embed: !!embedHost, stackOnAssoc: stackOnAssoc });
    try {
      localStorage.setItem(THUMB_PICKER_VIEW_KEY, view);
    } catch (eLs) {}

    var backBtn = document.getElementById("damThumbPickerBack");
    var fwdBtn = document.getElementById("damThumbPickerFwd");
    var upBtn = document.getElementById("damThumbPickerUp");
    var refreshBtn = document.getElementById("damThumbPickerRefresh");
    var crumbsEl = document.getElementById("damThumbPickerCrumbs");

    function teardownDom() {
      if (embedHost) {
        embedHost.innerHTML = "";
        embedHost.classList.remove("dam-thumb-picker-embed-root");
      } else if (overlay) {
        overlay.remove();
      }
    }

    function dismiss() {
      document.removeEventListener("keydown", onPickerKey, true);
      teardownDom();
      if (onDismiss) {
        var fn = onDismiss;
        onDismiss = null;
        try {
          fn();
        } catch (eDismiss) {
          /* ignore */
        }
      }
    }

    function close() {
      document.removeEventListener("keydown", onPickerKey, true);
      teardownDom();
      if (onCancel) {
        var cb = onCancel;
        onCancel = null;
        try {
          cb();
        } catch (eCancel) {
          /* ignore */
        }
      } else if (onDismiss) {
        var fnDismiss = onDismiss;
        onDismiss = null;
        try {
          fnDismiss();
        } catch (eDismiss2) {
          /* ignore */
        }
      }
    }

    function onPickerKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
      }
    }
    document.addEventListener("keydown", onPickerKey, true);

    function syncConfirmButton() {
      if (!confirmBtn) return;
      var canPick = false;
      if (selection) {
        if (selection.kind === "file") canPick = true;
        else if (selection.kind === "folder" && (mode === "folder" || allowFolderPick)) canPick = true;
      } else if (mode === "folder" && currentPath) {
        canPick = true;
      }
      confirmBtn.disabled = !canPick;
    }

    function clearSelection() {
      selection = null;
      var grid = document.getElementById("damThumbPickerGrid");
      if (grid) {
        grid.querySelectorAll(".dam-thumb-picker__item.is-selected").forEach(function (el) {
          el.classList.remove("is-selected");
        });
      }
      syncConfirmButton();
    }

    function setSelection(kind, path, fileName) {
      if (!path) return;
      selection = { kind: kind, path: path, file: fileName || "" };
      var grid = document.getElementById("damThumbPickerGrid");
      if (grid) {
        grid.querySelectorAll(".dam-thumb-picker__item.is-selected").forEach(function (el) {
          el.classList.remove("is-selected");
        });
        var sel = null;
        if (grid) {
          grid.querySelectorAll(".dam-thumb-picker__item").forEach(function (el) {
            if (kind === "folder" && el.getAttribute("data-open-folder") === path) sel = el;
            if (kind === "file" && el.getAttribute("data-path") === path) sel = el;
          });
        }
        if (sel) sel.classList.add("is-selected");
      }
      syncConfirmButton();
    }

    function finish(picked) {
      if (!picked || !picked.path) return;
      /* Successful pick — do not fire onCancel on close. */
      onCancel = null;
      var filePath = picked.filePath || picked.path;
      if (resolveAssetIds && picked.type === "file" && filePath) {
        resolveBrandingAssetId(filePath, function (assetId) {
          if (!assetId) {
            /* Prefer resolve then save; on fail toast and keep picker open (no silent close/no-op). */
            pickerToast("Plik nie jest w indeksie brandingu. Wybierz inny plik z indeksu.");
            return;
          }
          onPicked({
            ok: true,
            path: assetId,
            id: assetId,
            file: picked.file || "",
            filePath: filePath,
            type: "file",
          });
          if (embedHost) dismiss();
          else close();
        });
        return;
      }
      onPicked(picked);
      if (embedHost) dismiss();
      else close();
    }

    function commitSelection() {
      if (selection) {
        if (selection.kind === "file") {
          finish({
            ok: true,
            path: selection.path,
            file: selection.file,
            filePath: selection.path,
            type: "file",
          });
          return;
        }
        if (selection.kind === "folder" && (mode === "folder" || allowFolderPick)) {
          finish({ path: selection.path, folder: selection.path, type: "folder" });
          return;
        }
        if (selection.kind === "folder" && mode === "file" && !allowFolderPick) {
          pickerToast("Wskaż plik (kliknij miniaturę), nie folder. Podwójne kliknięcie otwiera folder.");
          return;
        }
      }
      if (mode === "folder" && currentPath) {
        finish({ path: currentPath, folder: currentPath, type: "folder" });
      }
    }

    if (!embedHost) {
      var closeEl = document.getElementById("damThumbPickerClose");
      if (closeEl) closeEl.onclick = dismiss;
      var backStepBtn = document.getElementById("damThumbPickerBackStep");
      if (backStepBtn) backStepBtn.onclick = dismiss;
      if (cancelBtn) cancelBtn.onclick = close;
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) dismiss();
      });
    }
    if (confirmBtn) confirmBtn.onclick = commitSelection;

    var winBtn = document.getElementById("damThumbPickerWindows");
    if (winBtn) {
      winBtn.addEventListener("click", function () {
        var start = currentPath || startDir || "";
        if (!window.DamPaths || typeof window.DamPaths.pickFolder !== "function") {
          return;
        }
        Promise.resolve(window.DamPaths.pickFolder(start)).then(function (res) {
          if (!res || res.cancelled || !res.ok || !res.path) return;
          finish({ path: res.path, folder: res.path });
        });
      });
    }

    function syncNavButtons() {
      if (backBtn) backBtn.disabled = histPos <= 0;
      if (fwdBtn) fwdBtn.disabled = histPos >= history.length - 1;
      if (upBtn) upBtn.disabled = !currentParent;
    }

    function paintCrumbs(path) {
      if (!crumbsEl) return;
      var norm = String(path || "").replace(/\\/g, "/");
      var parts = norm.split("/").filter(Boolean);
      var html = "";
      var acc = "";
      parts.forEach(function (seg, i) {
        acc += (i === 0 ? "" : "/") + seg;
        var isLast = i === parts.length - 1;
        if (i > 0) html += '<span class="dam-thumb-picker__crumb-sep" aria-hidden="true">/</span>';
        html +=
          '<button type="button" class="dam-thumb-picker__crumb' +
          (isLast ? " is-current" : "") +
          '" data-crumb-path="' +
          esc(acc + (i === 0 && /^[a-z]:$/i.test(seg) ? "/" : "")) +
          '"' +
          (isLast ? " disabled" : "") +
          ' title="' +
          esc(acc) +
          '">' +
          esc(seg) +
          "</button>";
      });
      crumbsEl.innerHTML = html || '<span class="dam-thumb-picker__crumb is-current">-</span>';
      crumbsEl.querySelectorAll("[data-crumb-path]:not([disabled])").forEach(function (btn) {
        btn.addEventListener("click", function () {
          navigateTo(btn.getAttribute("data-crumb-path"));
        });
      });
      crumbsEl.scrollLeft = crumbsEl.scrollWidth;
    }

    function folderItemHtml(f) {
      return (
        '<button type="button" class="dam-thumb-picker__item dam-thumb-picker__item--folder" data-open-folder="' +
        esc(f.path) +
        '" title="' +
        esc(f.path) +
        '"><i class="uil uil-folder" aria-hidden="true"></i>' +
        '<span class="dam-thumb-picker__meta"><span class="dam-thumb-picker__name">' +
        esc(f.name) +
        "</span></span>" +
        thumbPickerFolderTagsHtml(f.name) +
        "</button>"
      );
    }

    function fileItemHtml(f) {
      var prev = mediaPreviewUrl(f.path);
      if (allowFolderPick) {
        return (
          '<div class="dam-thumb-picker__item dam-thumb-picker__item--file-disabled" data-dam-tip="Wariant wskazujesz folderem rewizji, nie pojedynczym plikiem." title="' +
          esc(f.path) +
          '">' +
          (prev
            ? '<img src="' + esc(prev) + '" alt="" loading="lazy">'
            : '<i class="uil uil-image" aria-hidden="true"></i>') +
          '<span class="dam-thumb-picker__meta"><span class="dam-thumb-picker__name">' +
          esc(f.name) +
          "</span></span>" +
          thumbPickerTagsHtml(f) +
          "</div>"
        );
      }
      return (
        '<button type="button" class="dam-thumb-picker__item" data-path="' +
        esc(f.path) +
        '" data-file="' +
        esc(f.name) +
        '" title="' +
        esc(f.path) +
        '">' +
        (prev
          ? '<img src="' + esc(prev) + '" alt="" loading="lazy">'
          : '<i class="uil uil-image" aria-hidden="true"></i>') +
        '<span class="dam-thumb-picker__meta"><span class="dam-thumb-picker__name">' +
        esc(f.name) +
        "</span></span>" +
        thumbPickerTagsHtml(f) +
        "</button>"
      );
    }

    function loadDir(target) {
      var grid = document.getElementById("damThumbPickerGrid");
      if (grid) grid.innerHTML = '<p class="dam-thumb-picker__status">Ładowanie…</p>';
      fetchJsonWithTimeout(
        bridgeBase() + "/folder-images?path=" + encodeURIComponent(target),
        5000
      )
        .then(function (data) {
          return data;
        })
        .then(function (data) {
          grid = document.getElementById("damThumbPickerGrid");
          if (!grid) return;
          if (!data) {
            grid.innerHTML =
              '<p class="dam-thumb-picker__status">Przekroczono czas oczekiwania (5s) — spróbuj ponownie lub inny folder.</p>';
            return;
          }
          if (!data || !data.ok) {
            grid.innerHTML =
              '<p class="dam-thumb-picker__status">Nie udało się otworzyć: ' +
              esc((data && data.error) || "?") +
              "</p>";
            return;
          }
          currentPath = data.path || target || "";
          currentParent = data.parent || "";
          clearSelection();
          paintCrumbs(currentPath);
          syncNavButtons();
          /* HARD: painting 500+ tiles freezes WebView2 — cap DOM. */
          var folders = (data.folders || []).slice(0, 60);
          var files = (data.files || []).slice(0, 80);
          var truncated =
            (data.folders || []).length > folders.length ||
            (data.files || []).length > files.length;
          if (!folders.length && !files.length) {
            grid.innerHTML =
              '<p class="dam-thumb-picker__status">Folder jest pusty (brak podfolderów i obrazów).</p>';
            return;
          }
          grid.innerHTML =
            folders.map(folderItemHtml).join("") +
            files.map(fileItemHtml).join("") +
            (truncated
              ? '<p class="dam-thumb-picker__status">Pokazano max 60 folderow / 80 plikow — wejdź głębiej.</p>'
              : "");
          grid.querySelectorAll(".dam-thumb-picker__item").forEach(function (btn) {
            btn.addEventListener("focus", function () {
              btn.classList.add("is-focus");
            });
            btn.addEventListener("blur", function () {
              btn.classList.remove("is-focus");
            });
            btn.addEventListener("mouseenter", function () {
              btn.classList.add("is-hover");
            });
            btn.addEventListener("mouseleave", function () {
              btn.classList.remove("is-hover");
            });
          });
          grid.querySelectorAll("[data-open-folder]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
              e.preventDefault();
              var folderPath = btn.getAttribute("data-open-folder") || "";
              setSelection("folder", folderPath, "");
            });
            btn.addEventListener("dblclick", function (e) {
              e.preventDefault();
              navigateTo(btn.getAttribute("data-open-folder"));
            });
          });
          grid.querySelectorAll("[data-path]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
              e.preventDefault();
              setSelection(
                "file",
                btn.getAttribute("data-path") || "",
                btn.getAttribute("data-file") || ""
              );
            });
            btn.addEventListener("dblclick", function (e) {
              e.preventDefault();
              setSelection(
                "file",
                btn.getAttribute("data-path") || "",
                btn.getAttribute("data-file") || ""
              );
              commitSelection();
            });
          });
          syncConfirmButton();
        })
        .catch(function () {
          grid = document.getElementById("damThumbPickerGrid");
          if (grid) {
            grid.innerHTML =
              '<p class="dam-thumb-picker__status">Nie udało się wczytać listy (most lokalny offline?).</p>';
          }
        });
    }

    function navigateTo(target) {
      if (!target) return;
      history = history.slice(0, histPos + 1);
      history.push(target);
      histPos = history.length - 1;
      syncNavButtons();
      loadDir(target);
    }

    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (histPos <= 0) return;
        histPos -= 1;
        syncNavButtons();
        loadDir(history[histPos]);
      });
    }
    if (fwdBtn) {
      fwdBtn.addEventListener("click", function () {
        if (histPos >= history.length - 1) return;
        histPos += 1;
        syncNavButtons();
        loadDir(history[histPos]);
      });
    }
    if (upBtn) {
      upBtn.addEventListener("click", function () {
        if (currentParent) navigateTo(currentParent);
      });
    }
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        if (currentPath) loadDir(currentPath);
      });
    }
    overlay.querySelectorAll("[data-picker-view]").forEach(function (btn) {
      var v = btn.getAttribute("data-picker-view");
      btn.classList.toggle("is-active", v === view);
      btn.addEventListener("click", function () {
        view = v;
        localStorage.setItem(THUMB_PICKER_VIEW_KEY, view);
        overlay.querySelectorAll("[data-picker-view]").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        var grid = document.getElementById("damThumbPickerGrid");
        if (grid) grid.setAttribute("data-view", view);
      });
    });
    if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
      /* deferred below */
    }
    var fallbackRoot =
      (window.DamPaths && typeof window.DamPaths.getBasePath === "function" && window.DamPaths.getBasePath()) ||
      "X:\\Marketing";
    var bootDir = startDir || fallbackRoot;
    setTimeout(function () {
      if (embedHost) {
        if (!embedHost.isConnected) return;
      } else if (!document.getElementById("damThumbPicker")) {
        return;
      }
      if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
        window.DamTooltips.bind(overlay);
      }
      navigateTo(bootDir);
      pickerDbg("navigate_started", { bootDir: bootDir, embed: !!embedHost });
    }, 0);

    return { dismiss: dismiss, close: close };
  }

  window.DamFolderPicker = { open: open };
})();
