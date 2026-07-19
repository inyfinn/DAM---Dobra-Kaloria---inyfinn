/**
 * Wspolny podglad mediow (branding, explorer, …) - ten sam DOM/CSS co dam-viz-modal.
 */
(function () {
  "use strict";

  var PLACEHOLDER_SVG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">' +
        '<rect fill="#f1f3f6" width="320" height="240"/>' +
        '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="14">Brak podgladu</text>' +
        "</svg>"
    );

  var PREVIEW_EXTS = { tif: 1, tiff: 1, psd: 1, psb: 1, bmp: 1 };
  var VIDEO_EXTS = { mp4: 1, mov: 1, webm: 1, avi: 1, mkv: 1, m4v: 1 };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function bridgeUrl() {
    return (
      (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function" && window.DamPaths.bridgeUrl()) ||
      (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function" && window.DamRuntime.bridgeUrl()) ||
      "http://127.0.0.1:8766"
    );
  }

  function toLocal(path) {
    if (window.DamPaths && typeof window.DamPaths.toLocal === "function") {
      return window.DamPaths.toLocal(path);
    }
    return path || "";
  }

  function fileExt(nameOrPath) {
    var m = /\.([a-z0-9]+)$/i.exec(String(nameOrPath || ""));
    return m ? m[1].toLowerCase() : "";
  }

  function isVideoAsset(asset) {
    if (!asset) return false;
    if (asset.media_type === "video") return true;
    return !!VIDEO_EXTS[fileExt(asset.name || asset.path)];
  }

  function needsServerPreview(asset) {
    var ext = fileExt(asset && (asset.name || asset.path));
    if (PREVIEW_EXTS[ext]) return true;
    if (asset && asset.media_type === "source") return true;
    return false;
  }

  function streamUrl(path) {
    if (!path) return "";
    return bridgeUrl() + "/media?path=" + encodeURIComponent(toLocal(path));
  }

  function posterUrl(path) {
    if (!path) return "";
    return streamUrl(path) + "&preview=1";
  }

  function previewUrl(path, asset) {
    if (!path) return "";
    if (isVideoAsset(asset) || VIDEO_EXTS[fileExt(path)]) {
      return streamUrl(path);
    }
    var local = toLocal(path);
    var url = bridgeUrl() + "/media?path=" + encodeURIComponent(local);
    if ((asset && needsServerPreview(asset)) || PREVIEW_EXTS[fileExt(path)]) {
      url += "&preview=1";
    }
    return url;
  }

  function mediaUrl(path, asset) {
    return previewUrl(path, asset);
  }

  function isRasterPreviewable(asset) {
    if (!asset) return false;
    if (asset.media_type === "video" || asset.media_type === "vector") return false;
    var ext = fileExt(asset.name || asset.path);
    if (/^(png|jpe?g|webp|gif|svg)$/i.test(ext)) return true;
    if (PREVIEW_EXTS[ext]) return true;
    if (asset.media_type === "raster" || asset.media_type === "source") return true;
    return false;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text || "");
    }
    return Promise.reject(new Error("clipboard"));
  }

  function toast(msg) {
    if (window.DamToast && typeof window.DamToast.show === "function") {
      window.DamToast.show(msg);
    }
  }

  function badgesHtml(asset) {
    if (window.DamBadges && typeof window.DamBadges.renderBranding === "function") {
      return window.DamBadges.renderBranding(asset, {
        includeTagTiers: ["primary", "low", "minimal"],
        maxPerKind: 5,
        maxTotal: 14,
      });
    }
    return '<span class="dam-viz-badge dam-viz-badge--brand">' + esc(asset.brand || "DK") + "</span>";
  }

  function marketingDisplayId(asset) {
    if (window.DamMarketingId && typeof window.DamMarketingId.format === "function") {
      return window.DamMarketingId.format(asset);
    }
    return asset && asset.id ? asset.id : "";
  }

  function assetIdChipHtml(asset) {
    if (!asset || !asset.id) return "";
    var displayId = marketingDisplayId(asset);
    return (
      '<span class="dam-viz-badge dam-viz-badge--index dam-branding-id-chip dam-media-preview__asset-id" data-tag-value="' +
      esc(asset.id) +
      '" data-marketing-id="' +
      esc(displayId) +
      '" data-dam-tip="ID marketingowe: ' +
      esc(displayId) +
      " (wewn.: " +
      esc(asset.id) +
      ')" title="ID marketingowe">' +
      esc(displayId) +
      "</span>"
    );
  }

  function assocLabelRow(label, editKind) {
    var editBtn =
      '<button type="button" class="dam-assoc-edit-all" data-assoc-edit-all="' +
      editKind +
      '" hidden>Edytuj wszystko</button>';
    return (
      '<div class="dam-media-preview__assoc-label-row">' +
      '<span class="dam-media-preview__assoc-label">' +
      esc(label) +
      "</span>" +
      editBtn +
      "</div>"
    );
  }

  function variantFileLabel(v) {
    if (v && v.name) return v.name;
    if (v && v.path) {
      var p = String(v.path).replace(/\\/g, "/");
      var i = p.lastIndexOf("/");
      return i >= 0 ? p.slice(i + 1) : p;
    }
    return v && (v.label || v.id) ? String(v.label || v.id) : "Plik";
  }

  function linkedProductsHtml(linkedProducts) {
    var list = (linkedProducts || []).filter(Boolean);
    var body =
      list.length > 0
        ? list
            .map(function (p) {
              var thumb = p.thumb_url || PLACEHOLDER_SVG;
              var label = p.display_name || p.id || "Produkt";
              var idx = p.product_index || "";
              return (
                '<div class="dam-media-preview__assoc-item" role="listitem" data-product-id="' +
                esc(p.id) +
                '">' +
                '<button type="button" class="dam-media-preview__assoc-thumb-btn" data-assoc-thumb-go data-product-id="' +
                esc(p.id) +
                '" title="' +
                esc(label) +
                '">' +
                '<img class="dam-media-preview__assoc-thumb" src="' +
                esc(thumb) +
                '" alt="' +
                esc(label) +
                '" loading="lazy" onerror="this.src=\'' +
                PLACEHOLDER_SVG.replace(/'/g, "%27") +
                "'\">" +
                "</button>" +
                '<button type="button" class="dam-media-preview__assoc-name" data-assoc-name data-product-id="' +
                esc(p.id) +
                '" title="' +
                esc(label) +
                '">' +
                esc(label) +
                "</button>" +
                (idx
                  ? '<span class="dam-media-preview__assoc-index">' + esc(idx) + "</span>"
                  : "") +
                "</div>"
              );
            })
            .join("")
        : '<p class="dam-media-preview__assoc-empty">Brak skojarzonych produktów</p>';
    return (
      '<div class="dam-media-preview__assoc-col dam-media-preview__assoc-col--products">' +
      assocLabelRow("Skojarzone produkty", "product") +
      '<div class="dam-media-preview__assoc-grid" role="list">' +
      body +
      "</div></div>"
    );
  }

  function variantIsVideo(v) {
    if (!v) return false;
    if (v.media_type === "video") return true;
    return !!VIDEO_EXTS[fileExt(v.name || v.path)];
  }

  function variantThumbInnerHtml(v, fileName) {
    if (variantIsVideo(v)) {
      return (
        '<div class="dam-viz-modal__variant-placeholder dam-media-preview__variant-placeholder dam-media-preview__variant-placeholder--video" title="' +
        esc(fileName) +
        '"><i class="uil uil-play-circle" aria-hidden="true"></i></div>'
      );
    }
    return (
      '<img class="dam-viz-modal__variant-thumb" src="' +
      esc(previewUrl(v.path, v)) +
      '" alt="' +
      esc(fileName) +
      '" loading="lazy" onerror="window.__damVariantThumbFallback&&__damVariantThumbFallback(this)">'
    );
  }

  function folderVariantsHtml(variants, activeId) {
    var list = (variants || []).filter(function (v) {
      return v && v.id;
    });
    var body =
      list.length > 0
        ? list
            .map(function (v) {
              var active = v.id === activeId ? " is-active" : "";
              var fileName = variantFileLabel(v);
              return (
                '<button type="button" class="dam-viz-modal__variant dam-media-preview__variant' +
                active +
                '" role="option" aria-selected="' +
                (active ? "true" : "false") +
                '" data-variant-id="' +
                esc(v.id) +
                '" title="' +
                esc(fileName) +
                '">' +
                (v.path
                  ? variantThumbInnerHtml(v, fileName)
                  : '<div class="dam-viz-modal__variant-placeholder dam-media-preview__variant-placeholder"><i class="uil uil-image" aria-hidden="true"></i></div>') +
                '<span class="dam-viz-modal__variant-label">' +
                esc(v.label || fileName.replace(/.*\./, "").toUpperCase() || "Plik") +
                "</span></button>"
              );
            })
            .join("")
        : '<p class="dam-media-preview__assoc-empty">Brak wariantów</p>';
    return (
      '<div class="dam-media-preview__assoc-col dam-media-preview__assoc-col--variants">' +
      assocLabelRow("Warianty materiału", "variant") +
      '<div class="dam-media-preview__variant-grid" role="listbox" aria-label="Warianty w folderze">' +
      body +
      "</div></div>"
    );
  }

  function associationsFooterHtml(asset, groupContext, options) {
    options = options || {};
    var alwaysShow = options.alwaysShowAssociations !== false;
    var variants = (groupContext && groupContext.variants) || asset.folder_variants || [];
    var linked = (groupContext && groupContext.linked_products) || asset.linked_products || [];
    if (!linked.length && (asset.folder_linked_product_ids || asset.linked_product_ids)) {
      linked = (asset.linked_product_ids || []).map(function (pid) {
        return { id: pid, display_name: pid, thumb_url: "" };
      });
    }
    var variantsHtml = folderVariantsHtml(variants, asset.id);
    var productsHtml = linkedProductsHtml(linked);
    if (!alwaysShow && variants.length <= 1 && !linked.length) return "";
    return (
      '<div class="dam-media-preview__assoc">' +
      variantsHtml +
      '<div class="dam-media-preview__assoc-sep" aria-hidden="true"></div>' +
      productsHtml +
      "</div>"
    );
  }

  function editableFilesFor(asset, groupContext) {
    var fromCtx = groupContext && groupContext.folder_editable_files;
    if (fromCtx && fromCtx.length) return fromCtx;
    if (asset.folder_editable_files && asset.folder_editable_files.length) return asset.folder_editable_files;
    return [];
  }

  function splitNameExt(name) {
    var raw = String(name || "").trim();
    if (!raw) return { base: "", ext: "" };
    var dot = raw.lastIndexOf(".");
    if (dot <= 0 || dot === raw.length - 1) return { base: raw, ext: "" };
    var ext = raw.slice(dot + 1).toLowerCase();
    if (!/^[a-z0-9]{1,8}$/.test(ext)) return { base: raw, ext: "" };
    return { base: raw.slice(0, dot), ext: ext };
  }

  function extTagClass(ext) {
    if (!ext) return "dam-media-preview__ext-tag--default";
    if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") return "dam-media-preview__ext-tag--png";
    if (ext === "tif" || ext === "tiff") return "dam-media-preview__ext-tag--tif";
    if (ext === "psd" || ext === "psb" || ext === "ai") return "dam-media-preview__ext-tag--psd";
    if (ext === "pdf") return "dam-media-preview__ext-tag--pdf";
    if (ext === "mp4" || ext === "mov" || ext === "webm") return "dam-media-preview__ext-tag--mp4";
    return "dam-media-preview__ext-tag--default";
  }

  function titleHtml(name, fallbackId) {
    var parts = splitNameExt(name || fallbackId || "Material");
    var base = parts.base || name || fallbackId || "Material";
    var extTag = parts.ext
      ? '<span class="dam-media-preview__ext-tag ' +
        extTagClass(parts.ext) +
        '">' +
        esc(parts.ext.toUpperCase()) +
        "</span>"
      : "";
    return '<span class="dam-media-preview__title-base">' + esc(base) + "</span>" + extTag;
  }

  function isEditableSourceAsset(asset) {
    var ext = fileExt(asset && (asset.name || asset.path));
    return ext === "psd" || ext === "psb" || ext === "ai" || ext === "indd";
  }

  function titleMetaHtml(asset) {
    return assetIdChipHtml(asset);
  }

  function sourceFileActionHtml(asset, groupContext) {
    var target = primaryEditableFile(asset, groupContext);
    if (!target || !target.path || (asset.path && target.path === asset.path)) return "";
    var parts = splitNameExt(target.name || target.path);
    var extLabel = (parts.ext || "plik").toUpperCase();
    var label = target.name || target.path;
    var tip = "Otwiera plik zrodlowy (" + extLabel + "): " + label;
    return (
      '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-viz-modal__cta" id="damMediaPreviewSource" data-path="' +
      esc(target.path) +
      '" data-dam-tip="' +
      esc(tip) +
      '" aria-label="' +
      esc(tip) +
      '" title="' +
      esc(tip) +
      '">' +
      '<i class="uil uil-layer-group" aria-hidden="true"></i><span>Źródło</span></button>'
    );
  }

  function firstLinkedProductId(asset, groupContext) {
    var list =
      (groupContext && groupContext.linked_products) ||
      (asset && asset.linked_products) ||
      [];
    var hit = (list || []).find(function (p) {
      return p && p.id;
    });
    if (hit) return hit.id;
    var ids =
      (asset && (asset.linked_product_ids || asset.folder_linked_product_ids)) || [];
    return ids[0] || "";
  }

  function primaryEditableFile(asset, groupContext) {
    var editableFiles = editableFilesFor(asset, groupContext);
    if (!editableFiles.length) return null;
    var target = null;
    editableFiles.some(function (f) {
      if (f && f.path && f.path !== asset.path) {
        target = f;
        return true;
      }
      return false;
    });
    return target || editableFiles[0];
  }

  function initZoomDock(thumbStage, zoomBar) {
    if (!thumbStage || !zoomBar) return;
    zoomBar.classList.add("is-docked");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var dockedY = 30;

    function animateTo(y, duration) {
      if (reduceMotion) {
        zoomBar.style.transform = "translateX(-50%) translateY(" + y + "px)";
        return;
      }
      if (window.gsap) {
        window.gsap.to(zoomBar, {
          y: y,
          duration: duration || 0.3,
          ease: "power2.out",
          overwrite: true,
        });
        return;
      }
      zoomBar.style.transform = "translateX(-50%) translateY(" + y + "px)";
    }

    function showDock() {
      zoomBar.classList.remove("is-docked");
      animateTo(0, 0.3);
    }

    function hideDock() {
      zoomBar.classList.add("is-docked");
      animateTo(dockedY, 0.3);
    }

    if (window.gsap) {
      window.gsap.set(zoomBar, { xPercent: -50, y: dockedY });
    } else {
      zoomBar.style.transform = "translateX(-50%) translateY(" + dockedY + "px)";
    }

    thumbStage.addEventListener("mousemove", function (e) {
      var rect = thumbStage.getBoundingClientRect();
      var nearBottom = e.clientY >= rect.bottom - 52;
      if (nearBottom) showDock();
      else if (!zoomBar.matches(":hover")) hideDock();
    });
    thumbStage.addEventListener("mouseleave", hideDock);
    zoomBar.addEventListener("mouseenter", showDock);
    zoomBar.addEventListener("focusin", showDock);
    zoomBar.addEventListener("mouseleave", function () {
      hideDock();
    });
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.remove();
    document.body.classList.remove("dam-media-preview-open");
  }

  function openAsset(asset, options) {
    options = options || {};
    if (!asset) return;

    var siblings = Array.isArray(options.siblings) ? options.siblings.slice() : [asset];
    var idx = typeof options.index === "number" ? options.index : 0;
    if (idx < 0 || idx >= siblings.length) idx = 0;

    var groupContext = options.groupContext || null;
    if (!groupContext) {
      groupContext = {
        variants: asset.folder_variants || [],
        linked_products: asset.linked_products || [],
        folder_group_id: asset.folder_group_id || "",
        folder_editable_files: asset.folder_editable_files || [],
      };
    }

    var assetById = {};
    siblings.forEach(function (s) {
      if (s && s.id) assetById[s.id] = s;
    });
    (groupContext.variants || []).forEach(function (v) {
      if (v && v.id && !assetById[v.id]) assetById[v.id] = v;
    });
    var mergedList = Object.keys(assetById).map(function (id) {
      return assetById[id];
    });
    if (mergedList.length > 1) {
      siblings = mergedList;
      if (typeof options.index !== "number") {
        idx = siblings.findIndex(function (x) {
          return x.id === asset.id;
        });
        if (idx < 0) idx = 0;
      }
    }

    var existing = document.getElementById("damMediaPreview");
    if (existing) existing.remove();

    var syEnabled = localStorage.getItem("dam_synology_enabled") !== "false";
    var shareTitle = syEnabled ? "Udostepnij przez Synology" : "Udostepnij (wylaczone)";

    var navPrev =
      siblings.length > 1
        ? '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewPrev" aria-label="Poprzedni" title="Poprzedni"><i class="uil uil-angle-left"></i></button>'
        : "";
    var navNext =
      siblings.length > 1
        ? '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewNext" aria-label="Nastepny" title="Nastepny"><i class="uil uil-angle-right"></i></button>'
        : "";

    var html =
      '<div class="dam-viz-modal-overlay dam-media-preview-overlay" id="damMediaPreview" role="dialog" aria-modal="true" aria-label="Podglad materialu">' +
      '<div class="dam-viz-modal-box">' +
      '<button type="button" class="dam-viz-modal-close" id="damMediaPreviewClose" aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
      '<div class="dam-viz-modal__thumb" id="damMediaPreviewThumb">' +
      '<div class="dam-viz-modal__zoom dam-media-preview__zoom" role="group" aria-label="Przyblizenie" data-dam-tip="CTRL+scroll lub ALT+scroll: zoom. Przy przyblizeniu: przeciagnij, zeby przesunac.">' +
      navPrev +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewZoomOut" aria-label="Pomniejsz"><i class="uil uil-search-minus"></i></button>' +
      '<span class="dam-viz-modal__zoom-label" id="damMediaPreviewZoomLabel">100%</span>' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewZoomIn" aria-label="Powieksz"><i class="uil uil-search-plus"></i></button>' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewZoomReset" aria-label="Reset"><i class="uil uil-search"></i></button>' +
      navNext +
      "</div>" +
      "</div>" +
      '<div class="dam-viz-modal__body">' +
      '<div class="dam-viz-card__badges" id="damMediaPreviewBadges"></div>' +
      '<div class="dam-media-preview__title-block">' +
      '<div class="dam-media-preview__title-row">' +
      '<h4 class="dam-viz-modal__title" id="damMediaPreviewTitle"></h4>' +
      '<div id="damMediaPreviewTitleMeta"></div>' +
      "</div></div>" +
      '<div id="damMediaPreviewAssoc"></div>' +
      '<div class="dam-viz-modal__actions">' +
      '<div class="dam-viz-modal__actions-main">' +
      '<button type="button" class="geex-btn geex-btn--primary geex-btn--sm dam-btn-icon dam-viz-modal__cta" id="damMediaPreviewGoProduct" data-dam-tip="Otwiera produkt w Eksplorerze">' +
      '<i class="uil uil-sitemap" aria-hidden="true"></i><span>Przejdź</span></button>' +
      '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-viz-modal__cta dam-win-btn" id="damMediaPreviewExplorer" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwiera folder w Eksploratorze plikow Windows">' +
      (window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>') +
      "<span>Folder</span></button>" +
      '<span id="damMediaPreviewSourceMount"></span>' +
      '<button type="button" class="dam-viz-icon-btn" id="damMediaPreviewCopy" data-dam-tip="Kopiuje lokalna sciezke pliku" aria-label="Kopiuj sciezke" title="Kopiuj sciezke">' +
      '<i class="uil uil-copy" aria-hidden="true"></i></button>' +
      '<button type="button" class="dam-viz-icon-btn' +
      (syEnabled ? "" : " is-disabled") +
      '" id="damMediaPreviewShare" aria-label="Udostepnij" title="' +
      esc(shareTitle) +
      '" data-dam-tip="' +
      esc(shareTitle) +
      '"' +
      (syEnabled ? "" : " disabled") +
      '><i class="uil uil-share-alt" aria-hidden="true"></i></button>' +
      "</div></div></div></div></div>";

    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("damMediaPreview");
    document.body.classList.add("dam-media-preview-open");

    var zoom = 1;
    var panX = 0;
    var panY = 0;
    var dragging = false;
    var dragStartX = 0;
    var dragStartY = 0;
    var panAtDragStartX = 0;
    var panAtDragStartY = 0;
    var thumbStage = document.getElementById("damMediaPreviewThumb");
    var heroEl = null;

    function clampZoom(z) {
      return Math.min(4, Math.max(0.4, +Number(z).toFixed(2)));
    }

    function paintZoom() {
      var label = document.getElementById("damMediaPreviewZoomLabel");
      if (heroEl && heroEl.tagName === "IMG") {
        heroEl.style.transform = "translate(" + panX + "px, " + panY + "px) scale(" + zoom + ")";
        heroEl.classList.toggle("is-zoomed", zoom > 1.01);
      }
      if (thumbStage) {
        thumbStage.classList.toggle("is-zoomed", zoom > 1.01);
        thumbStage.classList.toggle("is-panning", dragging);
      }
      if (label) label.textContent = Math.round(zoom * 100) + "%";
    }

    function resetView() {
      zoom = 1;
      panX = 0;
      panY = 0;
      dragging = false;
      paintZoom();
    }

    function setZoom(next) {
      var prev = zoom;
      zoom = clampZoom(next);
      if (zoom <= 1.01) {
        panX = 0;
        panY = 0;
      } else if (prev <= 1.01 && zoom > 1.01) {
        panX = 0;
        panY = 0;
      }
      paintZoom();
    }

    window.__damVariantThumbFallback = function (img) {
      if (!img || !img.parentNode) return;
      var alt = img.getAttribute("alt") || "Plik";
      var ph = document.createElement("div");
      ph.className = "dam-viz-modal__variant-placeholder dam-media-preview__variant-placeholder";
      ph.title = alt;
      ph.innerHTML = '<i class="uil uil-image" aria-hidden="true"></i>';
      img.replaceWith(ph);
    };

    window.__damMediaPreviewFallback = function (img) {
      if (!img || img.dataset.fallbackTried) {
        img.onerror = null;
        img.src = PLACEHOLDER_SVG;
        return;
      }
      img.dataset.fallbackTried = "1";
      var path = img.getAttribute("data-path");
      if (path) {
        img.src = previewUrl(path);
        return;
      }
      img.onerror = null;
      img.src = PLACEHOLDER_SVG;
    };

  function detectVideoAspect(name) {
    var n = String(name || "").toLowerCase();
    if (/9\s*[x×]\s*16|9:16|\b9x16\b|vertical|pion/.test(n)) return "9 / 16";
    if (/1\s*[x×]\s*1|1:1|\b1x1\b|square|kwadrat/.test(n)) return "1 / 1";
    return "16 / 9";
  }

  function renderVideoHero(thumb, a) {
    var stack = document.createElement("div");
    stack.className = "dam-media-preview__media-stack";

    var stage = document.createElement("div");
    stage.className = "dam-media-preview__video-stage";
    stage.style.setProperty("--dam-video-aspect", detectVideoAspect(a.name));

    var vid = document.createElement("video");
    vid.id = "damMediaPreviewHero";
    vid.className = "dam-media-preview__video";
    vid.controls = true;
    vid.playsInline = true;
    vid.preload = "metadata";
    vid.poster = posterUrl(a.path);
    vid.src = streamUrl(a.path);

    var playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "dam-media-preview__play";
    playBtn.setAttribute("aria-label", "Odtwórz wideo");
    playBtn.innerHTML = '<i class="uil uil-play" aria-hidden="true"></i>';

    var hintSlot = document.createElement("div");
    hintSlot.className = "dam-media-preview__hint-slot";

    stage.appendChild(vid);
    stage.appendChild(playBtn);
    stack.appendChild(stage);
    stack.appendChild(hintSlot);
    thumb.appendChild(stack);

    playBtn.addEventListener("click", function () {
      var p = vid.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
      stage.classList.add("is-playing");
    });
    vid.addEventListener("play", function () {
      stage.classList.add("is-playing");
    });
    vid.addEventListener("pause", function () {
      if (vid.currentTime <= 0.05) stage.classList.remove("is-playing");
    });
    vid.addEventListener("ended", function () {
      stage.classList.remove("is-playing");
    });
    vid.addEventListener("loadedmetadata", function () {
      if (vid.videoWidth > 0 && vid.videoHeight > 0) {
        stage.style.setProperty("--dam-video-aspect", vid.videoWidth + " / " + vid.videoHeight);
      }
      stage.classList.add("is-ready");
    });
    vid.onerror = function () {
      stage.classList.add("is-error");
      hintSlot.innerHTML =
        '<p class="dam-media-preview__hint">Nie udało się odtworzyć wideo (sprawdź bridge /media i rozmiar pliku).</p>';
    };

    heroEl = vid;
  }

    function renderStage(a) {
      var thumb = document.getElementById("damMediaPreviewThumb");
      if (!thumb) return;
      var oldHero = document.getElementById("damMediaPreviewHero");
      if (oldHero) oldHero.remove();
      var oldVideo = thumb.querySelector(".dam-media-preview__video");
      if (oldVideo) oldVideo.remove();
      var oldStack = thumb.querySelector(".dam-media-preview__media-stack");
      if (oldStack) oldStack.remove();
      var oldNothumb = thumb.querySelector(".dam-viz-modal__nothumb");
      if (oldNothumb) oldNothumb.remove();
      heroEl = null;
      resetView();

      if (a.media_type === "video" || isVideoAsset(a)) {
        renderVideoHero(thumb, a);
        return;
      }

      if (isRasterPreviewable(a)) {
        var img = document.createElement("img");
        img.id = "damMediaPreviewHero";
        img.alt = a.name || "";
        img.setAttribute("data-path", a.path || "");
        img.onerror = function () {
          window.__damMediaPreviewFallback && window.__damMediaPreviewFallback(img);
        };
        img.src = mediaUrl(a.path, a);
        thumb.appendChild(img);
        heroEl = img;
        return;
      }

      if (a.media_type === "vector") {
        var wrap = document.createElement("div");
        wrap.className = "dam-viz-modal__nothumb";
        wrap.innerHTML = '<i class="uil uil-vector-square"></i>';
        thumb.appendChild(wrap);
        var hint = document.createElement("p");
        hint.className = "dam-media-preview__hint";
        hint.textContent = "Wektor - otworz w aplikacji graficznej";
        thumb.appendChild(hint);
        return;
      }

      var fileWrap = document.createElement("div");
      fileWrap.className = "dam-viz-modal__nothumb";
      fileWrap.innerHTML = '<i class="uil uil-file"></i>';
      thumb.appendChild(fileWrap);
      var hint2 = document.createElement("p");
      hint2.className = "dam-media-preview__hint";
      hint2.textContent = a.name || "Plik";
      thumb.appendChild(hint2);
    }

    function renderMeta(a) {
      var title = document.getElementById("damMediaPreviewTitle");
      var titleMeta = document.getElementById("damMediaPreviewTitleMeta");
      var badges = document.getElementById("damMediaPreviewBadges");
      var assocHost = document.getElementById("damMediaPreviewAssoc");
      var sourceMount = document.getElementById("damMediaPreviewSourceMount");
      if (title) title.innerHTML = titleHtml(a.name, a.id);
      if (titleMeta) titleMeta.innerHTML = titleMetaHtml(a);
      if (sourceMount) sourceMount.innerHTML = sourceFileActionHtml(a, groupContext);
      if (assocHost) {
        var paintAssoc = function () {
          assocHost.innerHTML = associationsFooterHtml(a, groupContext, options);
          assocHost.querySelectorAll("[data-variant-id]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var vid = btn.getAttribute("data-variant-id") || "";
              var targetIdx = siblings.findIndex(function (x) {
                return x.id === vid;
              });
              if (targetIdx >= 0) showAt(targetIdx);
            });
          });
          if (window.DamAssocEdit && typeof window.DamAssocEdit.bind === "function") {
            window.DamAssocEdit.bind(assocHost, {
              asset: a,
              groupContext: groupContext,
              onRefresh: function () {
                renderMeta(asset);
              },
              onSaved: function (productIds, variantIds) {
                if (productIds && productIds.length) {
                  a.linked_product_ids = productIds.slice();
                  a.folder_linked_product_ids = productIds.slice();
                }
                if (variantIds && variantIds.length && groupContext.variants) {
                  var byId = {};
                  groupContext.variants.forEach(function (v) {
                    if (v && v.id) byId[v.id] = v;
                  });
                  groupContext.variants = variantIds.map(function (id) {
                    return byId[id] || { id: id, name: id };
                  });
                }
                if (window.DamAssocEdit.enrichLinkedProducts) {
                  window.DamAssocEdit.enrichLinkedProducts(
                    (productIds || []).map(function (id) {
                      return { id: id };
                    })
                  ).then(function (linked) {
                    groupContext.linked_products = linked;
                    a.linked_products = linked;
                    renderMeta(asset);
                  });
                } else {
                  renderMeta(asset);
                }
              },
            });
          }
        };
        if (window.DamAssocEdit && typeof window.DamAssocEdit.enrichLinkedProducts === "function") {
          window.DamAssocEdit.enrichLinkedProducts(groupContext.linked_products || []).then(function (linked) {
            groupContext.linked_products = linked;
            a.linked_products = linked;
            paintAssoc();
          });
        } else {
          paintAssoc();
        }
      }
      var editableLink = document.getElementById("damMediaPreviewSource");
      if (editableLink) {
        editableLink.addEventListener("click", function () {
          var p = editableLink.getAttribute("data-path") || "";
          if (window.DamPaths && typeof window.DamPaths.revealInExplorer === "function") {
            window.DamPaths.revealInExplorer(p);
          } else if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
            window.DamPaths.openFolderInExplorer(p);
          }
        });
      }
      if (badges) {
        badges.innerHTML = badgesHtml(a);
        if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
          window.DamBadges.bindClicks(badges, "branding");
        }
      }
      var goProduct = document.getElementById("damMediaPreviewGoProduct");
      var explorer = document.getElementById("damMediaPreviewExplorer");
      var copyBtn = document.getElementById("damMediaPreviewCopy");
      var shareBtn = document.getElementById("damMediaPreviewShare");
      var pid = firstLinkedProductId(a, groupContext);
      if (goProduct) {
        goProduct.setAttribute("data-pid", pid || "");
        goProduct.disabled = !pid;
        goProduct.classList.toggle("is-disabled", !pid);
        goProduct.setAttribute(
          "data-dam-tip",
          pid ? "Otwiera produkt w Eksplorerze" : "Brak skojarzonego produktu"
        );
      }
      if (explorer) explorer.setAttribute("data-path", a.path || "");
      if (copyBtn) copyBtn.setAttribute("data-path", a.path || "");
      if (shareBtn) shareBtn.setAttribute("data-path", a.path || "");
      renderStage(a);
    }

    function showAt(newIdx) {
      if (newIdx < 0 || newIdx >= siblings.length) return;
      idx = newIdx;
      asset = siblings[idx];
      renderMeta(asset);
      paintZoom();
    }

    renderMeta(asset);
    paintZoom();

    var zoomBar = thumbStage && thumbStage.querySelector(".dam-media-preview__zoom, .dam-viz-modal__zoom");
    initZoomDock(thumbStage, zoomBar);

    var zin = document.getElementById("damMediaPreviewZoomIn");
    var zout = document.getElementById("damMediaPreviewZoomOut");
    var zreset = document.getElementById("damMediaPreviewZoomReset");
    if (zin) zin.addEventListener("click", function (e) { e.stopPropagation(); setZoom(zoom + 0.2); });
    if (zout) zout.addEventListener("click", function (e) { e.stopPropagation(); setZoom(zoom - 0.2); });
    if (zreset) zreset.addEventListener("click", function (e) { e.stopPropagation(); resetView(); });

    var prevBtn = document.getElementById("damMediaPreviewPrev");
    var nextBtn = document.getElementById("damMediaPreviewNext");
    if (prevBtn) prevBtn.addEventListener("click", function (e) { e.stopPropagation(); showAt(idx - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function (e) { e.stopPropagation(); showAt(idx + 1); });

    if (thumbStage) {
      thumbStage.addEventListener(
        "wheel",
        function (e) {
          if (!(e.ctrlKey || e.altKey || e.metaKey)) return;
          e.preventDefault();
          e.stopPropagation();
          setZoom(zoom + (e.deltaY > 0 ? -0.15 : 0.15));
        },
        { passive: false }
      );
      thumbStage.addEventListener("pointerdown", function (e) {
        if (zoom <= 1.01) return;
        if (e.target.closest(".dam-viz-modal__zoom")) return;
        if (e.button !== 0) return;
        dragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        panAtDragStartX = panX;
        panAtDragStartY = panY;
        thumbStage.classList.add("is-panning");
        try { thumbStage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        e.preventDefault();
      });
      thumbStage.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        panX = panAtDragStartX + (e.clientX - dragStartX);
        panY = panAtDragStartY + (e.clientY - dragStartY);
        paintZoom();
      });
      function endPan(e) {
        if (!dragging) return;
        dragging = false;
        thumbStage.classList.remove("is-panning");
        if (e && e.pointerId != null) {
          try { thumbStage.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
        paintZoom();
      }
      thumbStage.addEventListener("pointerup", endPan);
      thumbStage.addEventListener("pointercancel", endPan);
    }

    document.getElementById("damMediaPreviewClose").addEventListener("click", function () {
      closeModal(modal);
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal(modal);
    });
    document.addEventListener("keydown", function onKey(e) {
      if (!document.getElementById("damMediaPreview")) {
        document.removeEventListener("keydown", onKey);
        return;
      }
      if (e.key === "Escape") {
        if (document.getElementById("damAssocActionMenu")) {
          if (window.DamAssocEdit && typeof window.DamAssocEdit.closeActionMenu === "function") {
            window.DamAssocEdit.closeActionMenu();
          }
          e.preventDefault();
          return;
        }
        if (document.getElementById("damAssocEditOverlay") || document.getElementById("damAssocEditPopover")) {
          if (window.DamAssocEdit && typeof window.DamAssocEdit.closePicker === "function") {
            window.DamAssocEdit.closePicker();
          }
          e.preventDefault();
          return;
        }
        closeModal(modal);
        document.removeEventListener("keydown", onKey);
      } else if (e.key === "ArrowLeft" && siblings.length > 1) {
        showAt(idx - 1);
      } else if (e.key === "ArrowRight" && siblings.length > 1) {
        showAt(idx + 1);
      }
    });

    var goProductBtn = document.getElementById("damMediaPreviewGoProduct");
    if (goProductBtn) {
      goProductBtn.addEventListener("click", function () {
        var pid = goProductBtn.getAttribute("data-pid") || "";
        if (!pid) {
          toast("Brak skojarzonego produktu");
          return;
        }
        closeModal(modal);
        location.href = "explorer.html?product=" + encodeURIComponent(pid);
      });
    }

    var explorerBtn = document.getElementById("damMediaPreviewExplorer");
    if (explorerBtn) {
      explorerBtn.addEventListener("click", function () {
        var p = explorerBtn.getAttribute("data-path") || "";
        if (window.DamPaths && typeof window.DamPaths.revealInExplorer === "function") {
          window.DamPaths.revealInExplorer(p);
        } else if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
          window.DamPaths.openFolderInExplorer(p);
        }
      });
    }

    var copyBtn = document.getElementById("damMediaPreviewCopy");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        copyToClipboard(copyBtn.getAttribute("data-path") || "").then(function () {
          toast("Skopiowano sciezke do schowka");
        });
      });
    }

    var shareBtn = document.getElementById("damMediaPreviewShare");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        if (!syEnabled) return;
        var p = shareBtn.getAttribute("data-path") || "";
        closeModal(modal);
        if (window.DamPaths && typeof window.DamPaths.shareViaSynology === "function") {
          window.DamPaths.shareViaSynology(p);
        }
      });
    }

    if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
      window.DamTooltips.bind(modal);
    }
  }

  window.DamMediaPreview = {
    openAsset: openAsset,
    previewUrl: previewUrl,
    mediaUrl: mediaUrl,
    streamUrl: streamUrl,
    posterUrl: posterUrl,
    needsServerPreview: needsServerPreview,
    isRasterPreviewable: isRasterPreviewable,
    isVideoAsset: isVideoAsset,
  };
})();
