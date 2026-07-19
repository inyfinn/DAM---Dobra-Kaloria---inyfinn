/**
 * DAM - edycja skojarzen produktow / wariantow w podgladzie mediow (Shift+klik, admin).
 */
(function (global) {
  "use strict";

  var PLACEHOLDER_SVG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">' +
        '<rect fill="#f1f3f6" width="320" height="240"/>' +
        '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="14">Brak</text>' +
        "</svg>"
    );

  function bridgeUrl() {
    return (
      (global.DamPaths && typeof global.DamPaths.bridgeUrl === "function" && global.DamPaths.bridgeUrl()) ||
      "http://127.0.0.1:8766"
    );
  }

  function authHeaders() {
    if (global.DamApi && typeof global.DamApi.authHeaders === "function") {
      return global.DamApi.authHeaders();
    }
    return {
      Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  function role() {
    return String(
      (global.DamApi && typeof global.DamApi.role === "function" && global.DamApi.role()) ||
        localStorage.getItem("dam_role") ||
        "user"
    ).toLowerCase();
  }

  function isPrivileged() {
    var r = role();
    return r === "admin" || r === "power_user";
  }

  function adminModeOn() {
    return localStorage.getItem("dam_admin_mode") === "1" || localStorage.getItem("dam_viz_admin_mode") === "1";
  }

  function canEditAssoc() {
    return isPrivileged() && adminModeOn();
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    if (global.DamToast && typeof global.DamToast.show === "function") {
      global.DamToast.show(msg);
      return;
    }
    var el = document.getElementById("damTagEditToast") || document.getElementById("damExplorerToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damAssocEditToast";
      el.className = "dam-explorer-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 3600);
  }

  function ensureFileIndex() {
    if (global.DamSearch && typeof global.DamSearch.load === "function") {
      return global.DamSearch.load().then(function (bundle) {
        return bundle.fileIndex || global._DAM_FILE_INDEX || null;
      });
    }
    if (global._DAM_FILE_INDEX && global._DAM_FILE_INDEX.products) {
      return Promise.resolve(global._DAM_FILE_INDEX);
    }
    return fetch("data/file-index.json?v=" + Date.now())
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        global._DAM_FILE_INDEX = d;
        return d;
      });
  }

  function productIndexOf(p) {
    if (!p) return "";
    var idx = "";
    if (p.indexes && p.indexes.length) idx = String(p.indexes[0]);
    else if (p.revisions && p.revisions[0] && p.revisions[0].index) idx = String(p.revisions[0].index);
    if (idx && idx.indexOf(".") > 0) idx = idx.split(".")[0];
    return idx;
  }

  function productThumb(p) {
    if (!p) return PLACEHOLDER_SVG;
    var slug = p.id || "";
    var rev = (p.revisions && p.revisions[0]) || {};
    var base = (rev.path || rev.viz_path || "").split(/[/\\]/).pop() || "000098";
    base = base.replace(/\.[^.]+$/, "");
    return "data/thumbs/" + slug + "__" + base + "_pl.jpg?v=" + (Date.now() % 999999);
  }

  function enrichLinkedProducts(list) {
    return ensureFileIndex().then(function (fi) {
      var byId = {};
      (fi && fi.products ? fi.products : []).forEach(function (p) {
        if (p && p.id) byId[p.id] = p;
      });
      return (list || []).map(function (lp) {
        var p = byId[lp.id] || lp;
        return {
          id: lp.id,
          display_name: lp.display_name || p.display_name || p.name || lp.id,
          thumb_url: lp.thumb_url || productThumb(p),
          product_index: lp.product_index || productIndexOf(p),
          path: p.path || lp.path || "",
        };
      });
    });
  }

  function closePicker() {
    var overlay = document.getElementById("damAssocEditOverlay");
    if (overlay) overlay.remove();
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onDocKey, true);
  }

  function onDocClick(e) {
    var overlay = document.getElementById("damAssocEditOverlay");
    if (!overlay) return;
    var pop = document.getElementById("damAssocEditPopover");
    if (pop && !pop.contains(e.target) && e.target === overlay) closePicker();
  }

  function onDocKey(e) {
    if (e.key === "Escape") closePicker();
  }

  function openActionMenu(anchorEl, product) {
    closeActionMenu();
    if (!product || !product.id) return;
    var rect = anchorEl.getBoundingClientRect();
    var menu = document.createElement("div");
    menu.id = "damAssocActionMenu";
    menu.className = "dam-assoc-action-menu is-entering";
    menu.setAttribute("role", "menu");
    var pid = product.id;
    var path = product.path || "";
    var winIcon =
      global.DamIcons && typeof global.DamIcons.winExplorerSvg === "function"
        ? global.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';
    menu.innerHTML =
      '<div class="dam-assoc-action-menu__inner">' +
      '<a class="dam-assoc-action-menu__item" role="menuitem" href="explorer.html?product=' +
      encodeURIComponent(pid) +
      '"><i class="uil uil-sitemap" aria-hidden="true"></i><span>Przejdź</span></a>' +
      '<button type="button" class="dam-assoc-action-menu__item" role="menuitem" data-action="explorer"' +
      (path ? ' data-path="' + esc(path) + '"' : " disabled") +
      ">" +
      winIcon +
      "<span>Eksplorator</span></button>" +
      '<a class="dam-assoc-action-menu__item" role="menuitem" href="visualizations.html?product=' +
      encodeURIComponent(pid) +
      '"><i class="uil uil-image" aria-hidden="true"></i><span>Wizualizacja</span></a>' +
      '<button type="button" class="dam-assoc-action-menu__item" role="menuitem" data-action="copy-link" data-pid="' +
      esc(pid) +
      '"><i class="uil uil-link" aria-hidden="true"></i><span>Kopiuj link</span></button>' +
      "</div>";
    document.body.appendChild(menu);
    var top = window.scrollY + rect.bottom + 6;
    var left = window.scrollX + rect.left;
    menu.style.top = top + "px";
    menu.style.left = left + "px";
    requestAnimationFrame(function () {
      menu.classList.remove("is-entering");
      menu.classList.add("is-visible");
    });
    menu.querySelector('[data-action="explorer"]') &&
      menu.querySelector('[data-action="explorer"]').addEventListener("click", function () {
        var p = this.getAttribute("data-path") || "";
        if (p && global.DamPaths && typeof global.DamPaths.revealInExplorer === "function") {
          global.DamPaths.revealInExplorer(p);
        }
        closeActionMenu();
      });
    menu.querySelector('[data-action="copy-link"]') &&
      menu.querySelector('[data-action="copy-link"]').addEventListener("click", function () {
        var link = location.origin + location.pathname.replace(/[^/]+$/, "") + "explorer.html?product=" + encodeURIComponent(pid);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(function () {
            toast("Skopiowano link do produktu");
          });
        }
        closeActionMenu();
      });
    setTimeout(function () {
      document.addEventListener("click", closeActionMenuOnOutside, true);
      document.addEventListener("keydown", closeActionMenuOnKey, true);
    }, 0);
  }

  function closeActionMenuOnOutside(e) {
    var menu = document.getElementById("damAssocActionMenu");
    if (menu && !menu.contains(e.target)) closeActionMenu();
  }

  function closeActionMenuOnKey(e) {
    if (e.key === "Escape") closeActionMenu();
  }

  function closeActionMenu() {
    var menu = document.getElementById("damAssocActionMenu");
    if (menu) {
      menu.classList.remove("is-visible");
      menu.classList.add("is-leaving");
      setTimeout(function () {
        if (menu.parentNode) menu.parentNode.removeChild(menu);
      }, 180);
    }
    document.removeEventListener("click", closeActionMenuOnOutside, true);
    document.removeEventListener("keydown", closeActionMenuOnKey, true);
  }

  function openMediaPicker(anchorEl, opts) {
    opts = opts || {};
    closePicker();
    ensureFileIndex().then(function (fi) {
      var products = (fi && fi.products) || [];
      var selected = {};
      (opts.selectedIds || []).forEach(function (id) {
        selected[id] = true;
      });
      var pinnedIds = (opts.pinnedIds || opts.selectedIds || []).slice();
      var pinnedSet = {};
      pinnedIds.forEach(function (id) {
        pinnedSet[id] = true;
      });

      var overlay = document.createElement("div");
      overlay.id = "damAssocEditOverlay";
      overlay.className = "dam-assoc-edit-overlay";
      overlay.setAttribute("role", "presentation");

      var pop = document.createElement("div");
      pop.id = "damAssocEditPopover";
      pop.className = "dam-tag-edit-popover dam-tag-edit-popover--wide dam-assoc-edit-popover";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-modal", "true");

      var head = opts.kind === "variant" ? "Warianty materiału" : "Skojarzone produkty";
      var html =
        '<div class="dam-tag-edit-popover__head">' +
        "<span>" +
        esc(head) +
        '</span><button type="button" class="dam-tag-edit-popover__close" data-close aria-label="Zamknij">' +
        '<i class="uil uil-times"></i></button></div>' +
        '<div class="dam-assoc-edit-popover__pinned-wrap">' +
        '<div class="dam-assoc-edit-popover__pinned-label">Aktualne</div>' +
        '<div class="dam-assoc-edit-popover__pinned"></div>' +
        "</div>" +
        '<div class="dam-assoc-edit-popover__section-sep" aria-hidden="true"></div>' +
        '<div class="dam-tag-edit-popover__search-wrap">' +
        '<i class="uil uil-search" aria-hidden="true"></i>' +
        '<input type="text" id="damAssocEditSearch" class="dam-tag-edit-popover__search" placeholder="Szukaj tytuł, indeks, wariant…" autocomplete="off" />' +
        "</div>" +
        '<div class="dam-tag-edit-popover__list dam-assoc-edit-popover__list">';

      function lookupItem(id) {
        if (opts.kind === "variant") {
          var v = (opts.variantCandidates || []).find(function (x) {
            return x && x.id === id;
          });
          if (v) {
            return {
              id: v.id,
              label: v.name || v.label || v.id,
              thumb: v.path && global.DamMediaPreview ? global.DamMediaPreview.previewUrl(v.path, v) : "",
              sub: v.id || "",
            };
          }
        } else {
          var p = products.find(function (x) {
            return x && x.id === id;
          });
          if (p) {
            return {
              id: p.id,
              label: p.display_name || p.name || p.id,
              thumb: productThumb(p),
              sub: productIndexOf(p) || p.id,
            };
          }
        }
        return { id: id, label: id, thumb: PLACEHOLDER_SVG, sub: "" };
      }

      function optionButtonHtml(it, pinned) {
        var on = !!selected[it.id];
        return (
          '<button type="button" class="dam-assoc-edit-popover__opt' +
          (on ? " is-selected" : "") +
          (pinned ? " is-pinned" : "") +
          '" data-id="' +
          esc(it.id) +
          '">' +
          '<span class="dam-assoc-edit-popover__thumb-wrap">' +
          '<img class="dam-assoc-edit-popover__thumb" src="' +
          esc(it.thumb || PLACEHOLDER_SVG) +
          '" alt="" loading="lazy" onerror="this.src=\'' +
          PLACEHOLDER_SVG.replace(/'/g, "%27") +
          "'\">" +
          "</span>" +
          '<span class="dam-assoc-edit-popover__meta">' +
          '<span class="dam-assoc-edit-popover__label">' +
          esc(it.label) +
          "</span>" +
          (it.sub ? '<span class="dam-assoc-edit-popover__sub">' + esc(it.sub) + "</span>" : "") +
          "</span>" +
          '<span class="dam-assoc-edit-popover__check" aria-hidden="true">' +
          (on ? '<i class="uil uil-check"></i>' : "") +
          "</span></button>"
        );
      }

      function bindOptionButtons(scope) {
        if (!scope) return;
        scope.querySelectorAll("[data-id]").forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var id = btn.getAttribute("data-id");
            if (selected[id]) delete selected[id];
            else selected[id] = true;
            renderPinned();
            renderOptions(pop.querySelector("#damAssocEditSearch").value);
          });
        });
      }

      function renderPinned() {
        var pinnedEl = pop.querySelector(".dam-assoc-edit-popover__pinned");
        if (!pinnedEl) return;
        if (!pinnedIds.length) {
          pinnedEl.innerHTML = '<p class="dam-tag-edit-popover__empty">Brak aktualnych skojarzen.</p>';
          return;
        }
        pinnedEl.innerHTML = pinnedIds
          .map(function (id) {
            return optionButtonHtml(lookupItem(id), true);
          })
          .join("");
        bindOptionButtons(pinnedEl);
      }

      function renderOptions(filter) {
        var q = String(filter || "")
          .toLowerCase()
          .trim();
        var listEl = pop.querySelector(".dam-assoc-edit-popover__list");
        if (!listEl) return;
        var items = [];
        if (opts.kind === "variant") {
          (opts.variantCandidates || []).forEach(function (v) {
            if (!v || !v.id || pinnedSet[v.id]) return;
            var label = (v.name || v.label || v.id || "").toLowerCase();
            if (q && label.indexOf(q) === -1 && String(v.id || "").indexOf(q) === -1) return;
            items.push({
              id: v.id,
              label: v.name || v.label || v.id,
              thumb: v.path && global.DamMediaPreview ? global.DamMediaPreview.previewUrl(v.path, v) : "",
              sub: v.id || "",
            });
          });
        } else {
          products.forEach(function (p) {
            if (!p || !p.id || pinnedSet[p.id]) return;
            var blob =
              (p.display_name || p.name || "") +
              " " +
              (p.id || "") +
              " " +
              (productIndexOf(p) || "") +
              " " +
              ((p.tags || []).join(" ") || "");
            if (q && blob.toLowerCase().indexOf(q) === -1) return;
            items.push({
              id: p.id,
              label: p.display_name || p.name || p.id,
              thumb: productThumb(p),
              sub: productIndexOf(p) || p.id,
            });
          });
        }
        items = items.slice(0, 120);
        if (!items.length) {
          listEl.innerHTML = '<p class="dam-tag-edit-popover__empty">Brak wyników dla tego wyszukiwania.</p>';
          return;
        }
        listEl.innerHTML = items.map(function (it) {
          return optionButtonHtml(it, false);
        }).join("");
        bindOptionButtons(listEl);
      }

      html +=
        "</div>" +
        '<div class="dam-tag-edit-popover__actions">' +
        (opts.kind === "product"
          ? '<button type="button" class="dam-tag-edit-popover__confirm dam-assoc-edit-popover__disk" data-disk data-dam-tip="Wybierz folder projektu na dysku">' +
            '<i class="uil uil-folder-plus" aria-hidden="true"></i><span>Dodaj z dysku</span></button>'
          : "") +
        (opts.kind === "variant"
          ? '<button type="button" class="dam-tag-edit-popover__confirm dam-assoc-edit-popover__disk" data-browse data-dam-tip="Wyszukaj plik w eksploratorze">' +
            '<i class="uil uil-folder-open" aria-hidden="true"></i><span>Wskaż plik</span></button>'
          : "") +
        '<button type="button" class="dam-tag-edit-popover__confirm" data-confirm><i class="uil uil-check"></i><span>Zatwierdź</span></button>' +
        '<button type="button" class="dam-tag-edit-popover__cancel" data-cancel><i class="uil uil-arrow-left"></i><span>Wstecz</span></button>' +
        "</div>";
      pop.innerHTML = html;
      overlay.appendChild(pop);
      document.body.appendChild(overlay);
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onDocKey, true);

      var search = pop.querySelector("#damAssocEditSearch");
      if (search) {
        search.focus();
        search.addEventListener("input", function () {
          renderOptions(search.value);
        });
      }
      renderPinned();
      renderOptions("");

      pop.querySelector("[data-close]") &&
        pop.querySelector("[data-close]").addEventListener("click", closePicker);
      pop.querySelector("[data-cancel]") &&
        pop.querySelector("[data-cancel]").addEventListener("click", closePicker);
      pop.querySelector("[data-confirm]") &&
        pop.querySelector("[data-confirm]").addEventListener("click", function () {
          var ids = Object.keys(selected);
          closePicker();
          if (typeof opts.onConfirm === "function") opts.onConfirm(ids, selected);
        });
      pop.querySelector("[data-disk]") &&
        pop.querySelector("[data-disk]").addEventListener("click", function () {
          openDiskFolderPicker(opts, selected, function (ids) {
            closePicker();
            if (typeof opts.onConfirm === "function") opts.onConfirm(ids, selected);
          });
        });
      pop.querySelector("[data-browse]") &&
        pop.querySelector("[data-browse]").addEventListener("click", function () {
          openVariantBrowsePicker(opts, selected, function (ids) {
            closePicker();
            if (typeof opts.onConfirm === "function") opts.onConfirm(ids, selected);
          });
        });
    });
  }

  function openVariantBrowsePicker(opts, selected, onDone) {
    var start = (opts.asset && opts.asset.path) || "";
    var dir = start.replace(/\\/g, "/");
    var i = dir.lastIndexOf("/");
    if (i > 0) dir = dir.slice(0, i);
    openFolderGrid(dir, function (picked) {
      if (picked && picked.variant_id) selected[picked.variant_id] = true;
      onDone(Object.keys(selected));
    }, true);
  }

  function openDiskFolderPicker(opts, selected, onDone) {
    var start = (opts.asset && opts.asset.path) || "X:/Marketing";
    var dir = start.replace(/\\/g, "/");
    var i = dir.lastIndexOf("/");
    if (i > 0) dir = dir.slice(0, i);
    openFolderGrid(dir, function (picked) {
      if (!picked || !picked.folder) return;
      fetch(bridgeUrl() + "/folder-images?path=" + encodeURIComponent(picked.folder))
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          var files = (data && data.files) || [];
          if (files.length) {
            toast("Znaleziono wizualizacje w folderze — dodaj produkt recznie z listy.");
            return;
          }
          if (!confirm("Nie znaleziono wizualizacji w tym folderze. Czy chcesz wskazac miejsce wizualizacji?")) {
            toast("Dodano bez miniatury (tymczasowo brak).");
            return;
          }
          openFolderGrid(picked.folder, function (vis) {
            if (!vis || !vis.path) return;
            toast("Wskazano wizualizacje: " + (vis.name || vis.path));
          }, false);
        });
    }, false);
  }

  function openFolderGrid(startDir, onPicked, pickVariants) {
    var existing = document.getElementById("damAssocFolderPicker");
    if (existing) existing.remove();
    var overlay = document.createElement("div");
    overlay.id = "damAssocFolderPicker";
    overlay.className = "dam-thumb-picker-overlay";
    overlay.innerHTML =
      '<div class="dam-thumb-picker-box">' +
      '<div class="dam-thumb-picker__head"><strong>' +
      (pickVariants ? "Wskaż plik wariantu" : "Wybierz folder projektu") +
      "</strong>" +
      '<button type="button" class="dam-admin-control" id="damAssocFolderPickerClose">×</button></div>' +
      '<div class="dam-thumb-picker__nav">' +
      '<button type="button" class="dam-admin-control" id="damAssocFolderPickerUp"><i class="uil uil-arrow-up"></i></button>' +
      '<input type="text" id="damAssocFolderPickerPath" class="dam-thumb-picker__path-input" />' +
      '<button type="button" class="dam-admin-control" id="damAssocFolderPickerGo">Idź</button>' +
      "</div>" +
      '<div class="dam-thumb-picker__grid" id="damAssocFolderPickerGrid">Ładowanie…</div></div>';
    document.body.appendChild(overlay);
    document.getElementById("damAssocFolderPickerClose").onclick = function () {
      overlay.remove();
    };
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });

    function loadDir(target) {
      var grid = document.getElementById("damAssocFolderPickerGrid");
      var pathInput = document.getElementById("damAssocFolderPickerPath");
      if (grid) grid.innerHTML = "Ładowanie…";
      fetch(bridgeUrl() + "/folder-browse?path=" + encodeURIComponent(target) + "&mode=assets")
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          grid = document.getElementById("damAssocFolderPickerGrid");
          if (!grid) return;
          if (!data || !data.ok) {
            grid.innerHTML = "<p>Nie udało się otworzyć folderu.</p>";
            return;
          }
          if (pathInput) pathInput.value = data.path || target;
          var folders = data.folders || [];
          var files = data.files || [];
          var html = "";
          if (!pickVariants) {
            html +=
              '<button type="button" class="dam-thumb-picker__item dam-thumb-picker__item--folder dam-admin-control" data-select-folder="' +
              esc(data.path || target) +
              '"><i class="uil uil-check-circle"></i><span class="dam-thumb-picker__name">Użyj tego folderu</span></button>';
          }
          html += folders
            .map(function (f) {
              return (
                '<button type="button" class="dam-thumb-picker__item dam-thumb-picker__item--folder dam-admin-control" data-open="' +
                esc(f.path) +
                '"><i class="uil uil-folder"></i><span class="dam-thumb-picker__name">' +
                esc(f.name) +
                "</span></button>"
              );
            })
            .join("");
          html += files
            .map(function (f) {
              return (
                '<button type="button" class="dam-thumb-picker__item dam-admin-control" data-file="' +
                esc(f.path) +
                '" data-name="' +
                esc(f.name) +
                '"><span class="dam-thumb-picker__name">' +
                esc(f.name) +
                "</span></button>"
              );
            })
            .join("");
          grid.innerHTML = html || "<p>Folder pusty.</p>";
          grid.querySelectorAll("[data-open]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              loadDir(btn.getAttribute("data-open"));
            });
          });
          grid.querySelectorAll("[data-select-folder]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              overlay.remove();
              onPicked({ folder: btn.getAttribute("data-select-folder") });
            });
          });
          grid.querySelectorAll("[data-file]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              overlay.remove();
              onPicked({
                path: btn.getAttribute("data-file"),
                name: btn.getAttribute("data-name"),
                variant_id: btn.getAttribute("data-file"),
              });
            });
          });
        });
    }

    document.getElementById("damAssocFolderPickerGo").onclick = function () {
      loadDir(document.getElementById("damAssocFolderPickerPath").value || startDir);
    };
    document.getElementById("damAssocFolderPickerUp").onclick = function () {
      var cur = document.getElementById("damAssocFolderPickerPath").value || startDir;
      var p = cur.replace(/\\/g, "/");
      var j = p.lastIndexOf("/");
      if (j > 0) loadDir(p.slice(0, j));
    };
    loadDir(startDir);
  }

  function saveAssociations(ctx, productIds, variantIds) {
    return fetch(bridgeUrl() + "/branding/asset-associations", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        asset_id: ctx.asset.id,
        folder_group_id: ctx.groupContext.folder_group_id || "",
        linked_product_ids: productIds || [],
        linked_variant_ids: variantIds || [],
      }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || "save_failed");
        toast("Zapisano skojarzenia");
        if (typeof ctx.onSaved === "function") ctx.onSaved(productIds, variantIds);
        return res;
      })
      .catch(function (err) {
        toast("Błąd zapisu: " + (err.message || err));
      });
  }

  function ensureAssocGrid(colEl, kind) {
    if (!colEl) return null;
    var grid = colEl.querySelector(".dam-media-preview__assoc-grid, .dam-media-preview__variant-grid");
    if (grid) return grid;
    var empty = colEl.querySelector(".dam-media-preview__assoc-empty");
    grid = document.createElement("div");
    grid.className =
      kind === "variant" ? "dam-media-preview__variant-grid" : "dam-media-preview__assoc-grid";
    if (kind === "variant") {
      grid.setAttribute("role", "listbox");
      grid.setAttribute("aria-label", "Warianty w folderze");
    } else {
      grid.setAttribute("role", "list");
    }
    if (empty) {
      grid.appendChild(empty);
    }
    colEl.appendChild(grid);
    return grid;
  }

  function openEditPicker(colEl, kind, ctx) {
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    var selectedIds =
      kind === "product"
        ? (ctx.groupContext.linked_products || [])
            .map(function (p) {
              return p && p.id;
            })
            .filter(Boolean)
        : (ctx.groupContext.variants || [])
            .map(function (v) {
              return v && v.id;
            })
            .filter(Boolean);
    openMediaPicker(colEl, {
      kind: kind,
      selectedIds: selectedIds,
      pinnedIds: selectedIds.slice(),
      variantCandidates: ctx.groupContext.variants || [],
      asset: ctx.asset,
      groupContext: ctx.groupContext,
      onConfirm: function (ids) {
        var pids =
          kind === "product"
            ? ids
            : (ctx.groupContext.linked_products || [])
                .map(function (p) {
                  return p && p.id;
                })
                .filter(Boolean);
        var vids =
          kind === "variant"
            ? ids
            : (ctx.groupContext.variants || [])
                .map(function (v) {
                  return v && v.id;
                })
                .filter(Boolean);
        saveAssociations(ctx, pids, vids).then(function () {
          if (typeof ctx.onRefresh === "function") ctx.onRefresh();
        });
      },
    });
  }

  function enterEditMode(colEl, kind, ctx) {
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    var grid = ensureAssocGrid(colEl, kind);
    if (!grid) {
      toast("Brak sekcji do edycji.");
      return;
    }
    if (grid.classList.contains("is-editing")) return;
    grid.classList.add("is-editing");
    colEl.classList.add("is-editing");

    var selectedProducts = {};
    var selectedVariants = {};
    (ctx.groupContext.linked_products || []).forEach(function (p) {
      if (p && p.id) selectedProducts[p.id] = true;
    });
    (ctx.groupContext.variants || []).forEach(function (v) {
      if (v && v.id) selectedVariants[v.id] = true;
    });

    var toolbar = document.createElement("div");
    toolbar.className = "dam-assoc-edit-toolbar";
    toolbar.innerHTML =
      '<button type="button" class="dam-assoc-edit-toolbar__btn" data-add><i class="uil uil-plus"></i> Dodaj</button>' +
      (kind === "product"
        ? '<button type="button" class="dam-assoc-edit-toolbar__btn" data-disk><i class="uil uil-folder-plus"></i> Dodaj z dysku</button>'
        : '<button type="button" class="dam-assoc-edit-toolbar__btn" data-browse><i class="uil uil-folder-open"></i> Wskaż</button>') +
      '<button type="button" class="dam-assoc-edit-toolbar__btn dam-assoc-edit-toolbar__btn--primary" data-save><i class="uil uil-check"></i> Zapisz</button>' +
      '<button type="button" class="dam-assoc-edit-toolbar__btn" data-cancel><i class="uil uil-times"></i> Anuluj</button>';
    var labelRow = colEl.querySelector(".dam-media-preview__assoc-label-row");
    if (labelRow && labelRow.parentNode) {
      labelRow.insertAdjacentElement("afterend", toolbar);
    } else {
      colEl.insertBefore(toolbar, grid);
    }
    requestAnimationFrame(function () {
      toolbar.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    function exitEdit() {
      grid.classList.remove("is-editing");
      colEl.classList.remove("is-editing");
      if (toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
      if (typeof ctx.onRefresh === "function") ctx.onRefresh();
    }

    toolbar.querySelector("[data-cancel]").addEventListener("click", exitEdit);
    toolbar.querySelector("[data-save]").addEventListener("click", function () {
      var pids =
        kind === "product"
          ? Object.keys(selectedProducts)
          : (ctx.groupContext.linked_products || [])
              .map(function (p) {
                return p && p.id;
              })
              .filter(Boolean);
      var vids =
        kind === "variant"
          ? Object.keys(selectedVariants)
          : (ctx.groupContext.variants || [])
              .map(function (v) {
                return v && v.id;
              })
              .filter(Boolean);
      saveAssociations(ctx, pids, vids).then(function () {
        exitEdit();
      });
    });
    toolbar.querySelector("[data-add]").addEventListener("click", function () {
      openMediaPicker(toolbar.querySelector("[data-add]"), {
        kind: kind,
        selectedIds: kind === "product" ? Object.keys(selectedProducts) : Object.keys(selectedVariants),
        variantCandidates: ctx.groupContext.variants || [],
        asset: ctx.asset,
        onConfirm: function (ids) {
          ids.forEach(function (id) {
            if (kind === "product") selectedProducts[id] = true;
            else selectedVariants[id] = true;
          });
        },
      });
    });
    if (toolbar.querySelector("[data-disk]")) {
      toolbar.querySelector("[data-disk]").addEventListener("click", function () {
        openDiskFolderPicker({ asset: ctx.asset }, selectedProducts, function () {});
      });
    }
    if (toolbar.querySelector("[data-browse]")) {
      toolbar.querySelector("[data-browse]").addEventListener("click", function () {
        openVariantBrowsePicker({ asset: ctx.asset, groupContext: ctx.groupContext }, selectedVariants, function (ids) {
          ids.forEach(function (id) {
            selectedVariants[id] = true;
          });
        });
      });
    }
  }

  function bindAssocSection(assocEl, ctx) {
    if (!assocEl || !ctx) return;

    assocEl.querySelectorAll("[data-assoc-edit-all]").forEach(function (btn) {
      if (!canEditAssoc()) {
        btn.hidden = true;
        return;
      }
      btn.hidden = false;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var kind = btn.getAttribute("data-assoc-edit-all");
        var col = btn.closest(".dam-media-preview__assoc-col");
        if (col) openEditPicker(col, kind, ctx);
      });
    });

    assocEl.querySelectorAll(".dam-media-preview__assoc-col").forEach(function (col) {
      col.addEventListener("click", function (e) {
        if (!e.shiftKey || !canEditAssoc()) return;
        if (e.target.closest("[data-assoc-edit-all]")) return;
        var kind =
          col.classList.contains("dam-media-preview__assoc-col--products") ||
          col.classList.contains("dam-media-preview__assoc-col--product")
            ? "product"
            : "variant";
        e.preventDefault();
        e.stopPropagation();
        openEditPicker(col, kind, ctx);
      });
    });

    assocEl.querySelectorAll("[data-assoc-name]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          if (!canEditAssoc()) {
            toast("Włącz tryb admina, aby edytować skojarzenia.");
            return;
          }
          var col = btn.closest(".dam-media-preview__assoc-col");
          if (col) openEditPicker(col, "product", ctx);
          return;
        }
        var pid = btn.getAttribute("data-product-id") || "";
        ensureFileIndex().then(function (fi) {
          var p = (fi.products || []).find(function (x) {
            return x.id === pid;
          });
          openActionMenu(btn, p || { id: pid, display_name: btn.textContent.trim() });
        });
      });
    });

    assocEl.querySelectorAll("[data-assoc-thumb-go]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          if (!canEditAssoc()) {
            toast("Włącz tryb admina, aby edytować skojarzenia.");
            return;
          }
          var col = btn.closest(".dam-media-preview__assoc-col");
          if (col) openEditPicker(col, "product", ctx);
          return;
        }
        var pid = btn.getAttribute("data-product-id") || "";
        if (pid) location.href = "explorer.html?product=" + encodeURIComponent(pid);
      });
    });

    assocEl.querySelectorAll(".dam-media-preview__assoc-item").forEach(function (item) {
      item.addEventListener("click", function (e) {
        if (!e.shiftKey || !canEditAssoc()) return;
        if (e.target.closest("[data-assoc-edit-all]")) return;
        e.preventDefault();
        e.stopPropagation();
        var col = item.closest(".dam-media-preview__assoc-col");
        if (col) openEditPicker(col, "product", ctx);
      });
    });
  }

  global.DamAssocEdit = {
    canEdit: canEditAssoc,
    bind: bindAssocSection,
    enrichLinkedProducts: enrichLinkedProducts,
    openActionMenu: openActionMenu,
    closeActionMenu: closeActionMenu,
    closePicker: closePicker,
    save: saveAssociations,
  };
})(window);
