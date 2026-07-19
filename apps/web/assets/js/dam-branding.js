(function () {
  "use strict";

  var index = null;
  var tokens = null;
  var campaigns = null;
  var CB = "hub20260719";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function bridgeUrl() {
    return window.DamRuntime && DamRuntime.bridgeUrl ? DamRuntime.bridgeUrl() : "http://127.0.0.1:8766";
  }

  function mediaUrl(path) {
    return bridgeUrl() + "/media?path=" + encodeURIComponent(path || "");
  }

  function elVal(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function includeArchive() {
    var cb = document.getElementById("damBrandingIncludeArchive");
    return cb && cb.checked;
  }

  async function loadIndex() {
    if (index) return index;
    var r = await fetch("data/branding-index.json?v=" + CB + "&_=" + Date.now());
    if (!r.ok) throw new Error("branding-index.json");
    index = await r.json();
    return index;
  }

  async function loadTokens() {
    if (tokens) return tokens;
    var r = await fetch("data/brand-tokens.json?v=" + CB);
    tokens = r.ok ? await r.json() : { colors: [] };
    return tokens;
  }

  async function loadCampaigns() {
    if (campaigns) return campaigns;
    try {
      var r = await fetch("data/campaigns.json?v=" + CB);
      if (r.ok) {
        campaigns = await r.json();
        return campaigns;
      }
    } catch (eCamp) { /* fallback below */ }
    campaigns = { campaigns: [] };
    return campaigns;
  }

  function isArchived(a) {
    var tags = a.tags || [];
    if (tags.indexOf("ARCHIWUM") !== -1) return true;
    var p = String(a.path || "").toUpperCase();
    return p.indexOf("ARCHIWUM") !== -1;
  }

  function filteredAssets(opts) {
    opts = opts || {};
    var q = elVal("damBrandingSearch").toLowerCase();
    var media = elVal("damBrandingMedia");
    var persp = elVal("damBrandingPerspective");
    var brand = elVal("damBrandingBrand");
    var size = elVal("damBrandingSize");
    var bg = elVal("damBrandingBackground");
    var channel = elVal("damBrandingChannel").toLowerCase();
    var keyOnly = !!opts.keyVisuale;
    return (index.assets || []).filter(function (a) {
      if (!includeArchive() && isArchived(a)) return false;
      if (media && a.media_type !== media) return false;
      if (persp && a.perspective !== persp) return false;
      if (brand && a.brand !== brand) return false;
      if (size && a.size !== size) return false;
      if (bg && a.background !== bg) return false;
      if (channel) {
        var ch = (a.channels || []).map(function (c) {
          return String(c).toLowerCase();
        });
        var blob = (a.search_blob || "").toLowerCase();
        if (ch.indexOf(channel) === -1 && blob.indexOf(channel) === -1) return false;
      }
      if (keyOnly && !a.perspective) return false;
      if (q && (a.search_blob || "").indexOf(q) === -1 && (a.name || "").toLowerCase().indexOf(q) === -1) {
        return false;
      }
      return true;
    });
  }

  function metaLine(a) {
    return [a.media_type, a.perspective, a.size].filter(Boolean).join(", ");
  }

  function cardHtml(a) {
    var thumb = "";
    if (a.media_type === "video") {
      thumb = '<i class="uil uil-play-circle" style="font-size:42px;color:var(--dam-brand-green,#008244)"></i>';
    } else if (a.media_type === "vector") {
      thumb = '<i class="uil uil-vector-square" style="font-size:42px;color:#4338ca"></i>';
    } else if (/\.(png|jpe?g)$/i.test(a.name || "")) {
      thumb = '<img src="' + esc(mediaUrl(a.path)) + '" alt="" loading="lazy" />';
    } else {
      thumb = '<i class="uil uil-file" style="font-size:36px;color:#6b7280"></i>';
    }
    return (
      '<button type="button" class="dam-branding-card" data-id="' +
      esc(a.id) +
      '">' +
      '<div class="dam-branding-card__thumb">' +
      thumb +
      "</div>" +
      '<div class="dam-branding-card__body">' +
      '<p class="dam-branding-card__name">' +
      esc(a.name) +
      "</p>" +
      '<p class="dam-branding-card__meta">' +
      esc(metaLine(a)) +
      "</p></div></button>"
    );
  }

  function renderGrid() {
    var grid = document.getElementById("damBrandingGrid");
    if (!grid) return;
    var list = filteredAssets().slice(0, 240);
    grid.innerHTML = list.length
      ? list.map(cardHtml).join("")
      : '<p class="dam-branding-muted">Brak wyników.</p>';
    bindCards(grid);
  }

  function renderKeyVisuale() {
    var grid = document.getElementById("damBrandingKeyGrid");
    if (!grid) return;
    var list = filteredAssets({ keyVisuale: true })
      .filter(function (a) {
        return a.perspective && (a.size === "L" || a.size === "S" || a.size === "S_SKLEP");
      })
      .slice(0, 48);
    grid.innerHTML = list.length
      ? list.map(cardHtml).join("")
      : '<p class="dam-branding-muted">Brak key visuali dla wybranych filtrów.</p>';
    bindCards(grid);
  }

  function bindCards(grid) {
    grid.querySelectorAll(".dam-branding-card").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openModal(btn.getAttribute("data-id"));
      });
    });
  }

  function openModal(id) {
    var a = (index.assets || []).find(function (x) {
      return x.id === id;
    });
    if (!a) return;
    var modal = document.getElementById("damBrandingModal");
    var media = document.getElementById("damBrandingModalMedia");
    var meta = document.getElementById("damBrandingModalMeta");
    if (a.media_type === "video") {
      media.innerHTML =
        '<video controls src="' +
        esc(mediaUrl(a.path)) +
        '" style="max-width:100%;max-height:60vh"></video>';
    } else if (a.media_type === "vector") {
      media.innerHTML =
        '<p class="dam-branding-muted"><i class="uil uil-vector-square"></i> Wektor: ' +
        esc(a.name) +
        '</p><a class="geex-btn geex-btn--sm" href="' +
        esc(mediaUrl(a.path)) +
        '" target="_blank" rel="noopener">Otwórz plik</a>';
    } else if (/\.(png|jpe?g)$/i.test(a.name || "")) {
      media.innerHTML =
        '<img src="' + esc(mediaUrl(a.path)) + '" alt="" style="max-width:100%;max-height:60vh" />';
    } else {
      media.innerHTML = '<p class="dam-branding-muted">' + esc(a.media_type || "asset") + "</p>";
    }
    var linked = (a.product_ids || a.linked_products || []).filter(Boolean);
    var linkedHtml = linked.length
      ? "<p><strong>Produkty:</strong> " +
        linked
          .map(function (pid) {
            return (
              '<a href="project.html?id=' +
              encodeURIComponent(pid) +
              '">' +
              esc(pid) +
              "</a>"
            );
          })
          .join(", ") +
        "</p>"
      : "";
    meta.innerHTML =
      '<p id="damBrandingModalTitle"><strong>' +
      esc(a.name) +
      "</strong></p><p>" +
      esc(a.path) +
      "</p><p>" +
      esc(metaLine(a)) +
      (a.campaign_id ? ", kampania: " + esc(a.campaign_id) : "") +
      "</p>" +
      linkedHtml +
      '<button type="button" class="geex-btn geex-btn--sm" id="damBrandingCopyPath">Kopiuj ścieżkę</button>';
    var copyBtn = document.getElementById("damBrandingCopyPath");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        navigator.clipboard.writeText(a.path || "");
      });
    }
    modal.hidden = false;
  }

  function closeModal() {
    var modal = document.getElementById("damBrandingModal");
    if (modal) modal.hidden = true;
  }

  async function renderCampaigns() {
    var host = document.getElementById("damBrandingCampaignTree");
    if (!host) return;
    await loadCampaigns();
    var list = campaigns.campaigns || [];
    if (!list.length) {
      var map = {};
      (index.assets || []).forEach(function (a) {
        if (!a.campaign_id) return;
        map[a.campaign_id] = (map[a.campaign_id] || 0) + 1;
      });
      list = Object.keys(map)
        .sort()
        .map(function (k) {
          return { id: k, nazwa: k, asset_count: map[k] };
        });
    }
    host.innerHTML = list.length
      ? list
          .map(function (c) {
            var n = c.asset_count != null ? c.asset_count : (c.asset_ids || []).length;
            return (
              '<p><button type="button" class="dam-branding-campaign-link" data-campaign="' +
              esc(c.id) +
              '"><strong>' +
              esc(c.nazwa || c.id) +
              "</strong></button> (" +
              n +
              " assetów)</p>"
            );
          })
          .join("")
      : '<p class="dam-branding-muted">Brak kampanii w indeksie.</p>';
    host.querySelectorAll(".dam-branding-campaign-link").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var search = document.getElementById("damBrandingSearch");
        if (search) search.value = btn.getAttribute("data-campaign") || "";
        document.querySelector('.dam-branding-tab[data-tab="browse"]').click();
        renderGrid();
      });
    });
  }

  function renderBrandbook() {
    var host = document.getElementById("damBrandbookTokens");
    if (!host) return;
    host.innerHTML = (tokens.colors || [])
      .map(function (c) {
        return (
          '<div class="dam-brandbook-swatch" style="background:' +
          esc(c.hex) +
          '"><strong style="color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4)">' +
          esc(c.name) +
          "</strong><br><code>" +
          esc(c.hex) +
          "</code></div>"
        );
      })
      .join("");
  }

  function renderLayoutPresets() {
    var host = document.getElementById("damBrandingLayoutPresets");
    if (!host) return;
    var presets = [
      { id: "shop-848x1200", label: "Zestaw sklepu 848×1200", w: 848, h: 1200 },
      { id: "slider-cat", label: "Slider kategorii", w: 1920, h: 600 },
      { id: "hero-www", label: "Slider główny WWW", w: 1920, h: 800 },
    ];
    host.innerHTML = presets
      .map(function (p) {
        return (
          '<article class="dam-branding-layout-preset"><h4 class="dam-hub-section-title">' +
          esc(p.label) +
          '</h4><div class="dam-branding-layout-frame" style="aspect-ratio:' +
          p.w +
          "/" +
          p.h +
          '"><span>' +
          p.w +
          "×" +
          p.h +
          "</span></div></article>"
        );
      })
      .join("");
  }

  function bindTabs() {
    document.querySelectorAll(".dam-branding-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".dam-branding-tab").forEach(function (b) {
          b.classList.remove("is-active");
        });
        btn.classList.add("is-active");
        var tab = btn.getAttribute("data-tab");
        document.querySelectorAll(".dam-branding-panel").forEach(function (p) {
          p.hidden = true;
        });
        var panel = document.getElementById(
          "damBrandingPanel" + tab.charAt(0).toUpperCase() + tab.slice(1)
        );
        if (panel) panel.hidden = false;
        if (tab === "campaigns") renderCampaigns();
        if (tab === "brandbook") renderBrandbook();
        if (tab === "keyvisuale") renderKeyVisuale();
        if (tab === "layout") renderLayoutPresets();
      });
    });
  }

  function bindFilters() {
    [
      "damBrandingSearch",
      "damBrandingMedia",
      "damBrandingPerspective",
      "damBrandingBrand",
      "damBrandingSize",
      "damBrandingBackground",
      "damBrandingChannel",
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", function () {
        renderGrid();
        renderKeyVisuale();
      });
      el.addEventListener("change", function () {
        renderGrid();
        renderKeyVisuale();
      });
    });
    var arch = document.getElementById("damBrandingIncludeArchive");
    if (arch) {
      arch.addEventListener("change", function () {
        renderGrid();
        renderKeyVisuale();
      });
    }
  }

  async function boot() {
    try {
      await loadIndex();
      await loadTokens();
      renderGrid();
      renderBrandbook();
      bindTabs();
      bindFilters();
      document.querySelectorAll("[data-close]").forEach(function (el) {
        el.addEventListener("click", closeModal);
      });
      var rebuild = document.getElementById("damBrandingRebuild");
      if (rebuild) {
        rebuild.addEventListener("click", async function () {
          rebuild.disabled = true;
          try {
            await fetch(bridgeUrl() + "/branding/rebuild", { method: "POST" });
            index = null;
            campaigns = null;
            await loadIndex();
            renderGrid();
          } finally {
            rebuild.disabled = false;
          }
        });
      }
      var qs = new URLSearchParams(location.search).get("q");
      if (qs) {
        var search = document.getElementById("damBrandingSearch");
        if (search) search.value = qs;
        renderGrid();
      }
    } catch (e) {
      var grid = document.getElementById("damBrandingGrid");
      if (grid) grid.innerHTML = '<p class="dam-branding-muted">Błąd: ' + esc(e.message) + "</p>";
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
