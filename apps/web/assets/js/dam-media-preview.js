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

  function needsServerPreview(asset) {
    var ext = fileExt(asset && (asset.name || asset.path));
    if (PREVIEW_EXTS[ext]) return true;
    if (VIDEO_EXTS[ext]) return true;
    if (asset && asset.media_type === "video") return true;
    if (asset && asset.media_type === "source") return true;
    return false;
  }

  function previewUrl(path, asset) {
    if (!path) return "";
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

  function linkedProductsHtml(asset) {
    var linked = (asset.product_ids || asset.linked_product_ids || []).filter(Boolean);
    if (!linked.length) return "";
    return (
      '<p class="dam-media-preview__linked"><strong>Produkty:</strong> ' +
      linked
        .map(function (pid) {
          return (
            '<a href="project.html?id=' + encodeURIComponent(pid) + '">' + esc(pid) + "</a>"
          );
        })
        .join(", ") +
      "</p>"
    );
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

    var siblings = Array.isArray(options.siblings) ? options.siblings : [asset];
    var idx = typeof options.index === "number" ? options.index : 0;
    if (idx < 0 || idx >= siblings.length) idx = 0;

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
      '<h4 class="dam-viz-modal__title" id="damMediaPreviewTitle"></h4>' +
      '<p class="dam-viz-modal__carrier" id="damMediaPreviewPath"></p>' +
      '<div id="damMediaPreviewLinked"></div>' +
      '<div class="dam-viz-modal__actions">' +
      '<div class="dam-viz-modal__actions-main">' +
      '<button type="button" class="geex-btn geex-btn--primary geex-btn--sm dam-btn-icon dam-viz-modal__cta dam-win-btn" id="damMediaPreviewExplorer" data-dam-tip="Otwiera folder w Eksploratorze plikow Windows">' +
      (window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>') +
      "<span>Pokaz w Explorerze</span></button>" +
      '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-viz-modal__cta" id="damMediaPreviewCopy" data-dam-tip="Kopiuje lokalna sciezke pliku">' +
      '<i class="uil uil-copy" aria-hidden="true"></i><span>Kopiuj sciezke</span></button>' +
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

    function renderStage(a) {
      var thumb = document.getElementById("damMediaPreviewThumb");
      if (!thumb) return;
      var oldHero = document.getElementById("damMediaPreviewHero");
      if (oldHero) oldHero.remove();
      var oldVideo = thumb.querySelector(".dam-media-preview__video");
      if (oldVideo) oldVideo.remove();
      var oldHint = thumb.querySelector(".dam-media-preview__hint");
      if (oldHint) oldHint.remove();
      var oldNothumb = thumb.querySelector(".dam-viz-modal__nothumb");
      if (oldNothumb) oldNothumb.remove();
      heroEl = null;
      resetView();

      if (a.media_type === "video") {
        var vid = document.createElement("video");
        vid.id = "damMediaPreviewHero";
        vid.className = "dam-media-preview__video";
        vid.controls = true;
        vid.playsInline = true;
        vid.src = mediaUrl(a.path, a);
        thumb.appendChild(vid);
        heroEl = vid;
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
      var pathEl = document.getElementById("damMediaPreviewPath");
      var badges = document.getElementById("damMediaPreviewBadges");
      var linkedHost = document.getElementById("damMediaPreviewLinked");
      if (title) title.textContent = a.name || a.id || "Material";
      if (pathEl) pathEl.textContent = a.path || "";
      if (linkedHost) linkedHost.innerHTML = linkedProductsHtml(a);
      if (badges) {
        badges.innerHTML = badgesHtml(a);
        if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
          window.DamBadges.bindClicks(badges, "branding");
        }
      }
      var explorer = document.getElementById("damMediaPreviewExplorer");
      var copyBtn = document.getElementById("damMediaPreviewCopy");
      var shareBtn = document.getElementById("damMediaPreviewShare");
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
        closeModal(modal);
        document.removeEventListener("keydown", onKey);
      } else if (e.key === "ArrowLeft" && siblings.length > 1) {
        showAt(idx - 1);
      } else if (e.key === "ArrowRight" && siblings.length > 1) {
        showAt(idx + 1);
      }
    });

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
    needsServerPreview: needsServerPreview,
    isRasterPreviewable: isRasterPreviewable,
  };
})();
