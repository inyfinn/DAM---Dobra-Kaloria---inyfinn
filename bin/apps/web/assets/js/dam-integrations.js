/**
 * DAM - Integracje OAuth (Asana, Microsoft) + karty infrastruktury + finanse.
 * Wspoldzielone przez integrations.html i settings.html.
 */
(function () {
  "use strict";

  /** "hub" | "bento" (integrations.html 4-col) | "settings-bento" (settings.html 3-col) */
  var layoutMode = "hub";

  function isTileLayout() {
    return layoutMode === "bento" || layoutMode === "settings-bento";
  }

  function resolveLayout(opts, box) {
    opts = opts || {};
    if (opts.layout === "bento" || opts.layout === "settings-bento" || opts.layout === "hub") {
      return opts.layout;
    }
    if (box && box.closest && box.closest("#damIntegrations")) {
      return "settings-bento";
    }
    return "hub";
  }

  /** Fallback gdy link CSS nie zdąży / konflikt H2 — wstrzyknięcie siatki 3-col */
  function ensureSettingsBentoCss() {
    if (layoutMode !== "settings-bento") return;
    if (document.getElementById("dam-int-settings-bento")) return;
    if (document.querySelector('link[href*="dam-integrations-settings.css"]')) return;
    var s = document.createElement("style");
    s.id = "dam-int-settings-bento";
    s.textContent =
      "#damIntegrations .dam-int-bento-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}" +
      "@media(max-width:960px){#damIntegrations .dam-int-bento-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
      "@media(max-width:560px){#damIntegrations .dam-int-bento-grid{grid-template-columns:1fr}}" +
      "#damIntegrations .dam-int-chip{display:inline-flex!important;width:auto!important;max-width:max-content!important;" +
      "font-size:12.5px;padding:4px 11px;border-radius:999px;flex:0 0 auto!important}";
    document.head.appendChild(s);
  }

  /**
   * Fix: bento `.dam-int-config__panel` was position:absolute with left/right:16px
   * inside `.dam-int-tile__config` (inline-flex + position:relative ≈ summary width ~88px),
   * which crushed the open panel to ~56px. Expand in-flow to full tile foot width.
   * Injected (not dam-integrations.css) to avoid merge fights with concurrent CSS agents.
   */
  function ensureConfigPanelFixCss() {
    if (!isTileLayout()) return;
    if (document.getElementById("damIntConfigPanelFix")) return;
    var s = document.createElement("style");
    s.id = "damIntConfigPanelFix";
    s.textContent =
      ".dam-integrations-page--bento .dam-int-tile__foot .dam-int-tile__config," +
      ".dam-integrations-page--bento .dam-int-tile__config{" +
      "position:static!important;display:block;flex:1 1 100%;width:100%;max-width:100%;min-width:0;" +
      "}" +
      ".dam-integrations-page--bento .dam-int-config{" +
      "display:block;width:100%;max-width:100%;min-width:0;" +
      "}" +
      ".dam-integrations-page--bento .dam-int-config__panel{" +
      "position:static!important;left:auto!important;right:auto!important;z-index:auto;" +
      "width:100%;min-width:0;max-width:100%;box-sizing:border-box;margin-top:8px;" +
      "}";
    document.head.appendChild(s);
  }

  var EXTRA_INTEGRATIONS = [
    {
      id: "slack",
      label: "Slack",
      desc: "Kanały zespołu marketingu - powiadomienia o zapotrzebowaniach.",
      icon: "uil-slack",
      iconClass: "dam-int-card__icon--slack",
    },
    {
      id: "gdrive",
      label: "Google Drive",
      desc: "Udostępnianie folderów eksportu i briefów.",
      icon: "uil-google-drive-alt",
      iconClass: "dam-int-card__icon--gdrive",
    },
    {
      id: "dropbox",
      label: "Dropbox",
      desc: "Alternatywny sync dla partnerów zewnętrznych.",
      icon: "uil-dropbox",
      iconClass: "dam-int-card__icon--dropbox",
    },
    {
      id: "notion",
      label: "Notion",
      desc: "Briefy i checklisty projektów w bazie Notion.",
      icon: "uil-book-alt",
      iconClass: "dam-int-card__icon--notion",
    },
    {
      id: "smtp",
      label: "E-mail SMTP",
      desc: "Wysyłka powiadomień z grup (grafik) przez firmowy SMTP.",
      icon: "uil-envelope-send",
      iconClass: "dam-int-card__icon--smtp",
    },
  ];

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Foot CTA = profil `.dam-welcome-link` (neutral outline), nie lavender geex */
  var CTA_CLS = "dam-int-cta";

  function bridge() {
    if (window.DamPaths && typeof DamPaths.bridgeUrl === "function") {
      return DamPaths.bridgeUrl();
    }
    if (window.DamRuntime && typeof DamRuntime.bridgeUrl === "function") {
      return DamRuntime.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function authHeaders() {
    if (window.DamApi && typeof DamApi.authHeaders === "function") {
      return DamApi.authHeaders();
    }
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
    };
  }

  function oauthRedirectUri() {
    return bridge() + "/oauth/callback";
  }

  function statusBadge(st, label, chipMods) {
    if (isTileLayout()) {
      var mod = chipMods ? " " + chipMods : "";
      var tip =
        label && String(label).length > 12
          ? ' title="' + esc(label) + '"'
          : "";
      return (
        '<span class="dam-int-chip dam-int-st dam-int-st--' +
        esc(st) +
        mod +
        '"' +
        tip +
        ">" +
        esc(label) +
        "</span>"
      );
    }
    var cls = "geex-badge geex-badge--warning-transparent";
    if (st === "ok") cls = "geex-badge geex-badge--success-transparent";
    else if (st === "ready") cls = "geex-badge geex-badge--primary-transparent";
    else if (st === "err") cls = "geex-badge geex-badge--danger-transparent";
    else if (st === "wait") cls = "geex-badge geex-badge--warning-transparent";
    return '<span class="' + cls + ' dam-int-st dam-int-st--' + esc(st) + '">' + esc(label) + "</span>";
  }

  function chipLabelForStatus(st, fullLabel) {
    if (st === "ok") {
      if (fullLabel && /^\d+\s/.test(String(fullLabel))) return String(fullLabel).slice(0, 14);
      return "Połączono";
    }
    if (st === "ready") return "Gotowe";
    if (st === "err") return "Błąd";
    return "Brak";
  }

  function oauthStatusLabel(p, err) {
    if (err) return "Błąd";
    if (p.connected) {
      if (isTileLayout()) return "Połączono";
      var extra = p.email ? " · " + p.email : "";
      if (p.connected_at) {
        extra += " · od " + String(p.connected_at).replace("T", " ").slice(0, 16);
      }
      return "Połączono" + extra;
    }
    if (p.configured) return isTileLayout() ? "Gotowe" : "Gotowe do logowania";
    return isTileLayout() ? "Brak" : "Nie skonfigurowane";
  }

  function oauthStatusKey(p, err) {
    if (err) return "err";
    if (p.connected) return "ok";
    if (p.configured) return "ready";
    return "wait";
  }

  function cardHtml(opts) {
    var st = opts.status || "wait";
    var stLabel = opts.statusLabel || "Nie skonfigurowane";
    var chipMods = "";
    if (isTileLayout()) {
      if (opts.planned) {
        stLabel = "Wdrożenie planowane";
        chipMods = "dam-int-chip--planned";
      } else {
        stLabel = chipLabelForStatus(st, opts.statusLabel || opts.chipLabel);
      }
    }
    var body = opts.bodyHtml ? '<div class="dam-int-card__body">' + opts.bodyHtml + "</div>" : "";
    var config = opts.configHtml || "";
    var actions = opts.actionsHtml || "";
    /* Tile: Konfiguruj + CTA w jednym foot (Geex outline), nie belka pod opisem */
    var footInner = "";
    if (isTileLayout()) {
      if (config) footInner += '<div class="dam-int-tile__config">' + config + "</div>";
      if (actions) footInner += actions;
    } else if (actions) {
      footInner = actions;
    }
    var foot = footInner
      ? '<footer class="dam-int-card__foot' +
        (isTileLayout() ? " dam-int-tile__foot" : "") +
        '">' +
        footInner +
        "</footer>"
      : "";

    if (isTileLayout()) {
      var tileMods = " dam-int-tile";
      if (opts.feature && layoutMode === "bento") tileMods += " dam-int-tile--feature";
      if (st === "ok") tileMods += " dam-int-tile--live";
      if (opts.planned) tileMods += " dam-int-tile--planned";
      return (
        '<article class="dam-int-card' +
        tileMods +
        '" data-int="' +
        esc(opts.id) +
        '">' +
        '<div class="dam-int-tile__top">' +
        '<div class="dam-int-card__icon ' +
        esc(opts.iconClass || "") +
        '"><i class="uil ' +
        esc(opts.icon || "uil-link") +
        '" aria-hidden="true"></i></div>' +
        statusBadge(st, stLabel, chipMods) +
        "</div>" +
        '<p class="dam-int-card__name">' +
        esc(opts.label) +
        "</p>" +
        '<p class="dam-int-card__desc">' +
        esc(opts.desc || "") +
        "</p>" +
        body +
        foot +
        "</article>"
      );
    }

    var head =
      '<header class="dam-int-card__head">' +
      '<div class="dam-int-card__top">' +
      '<div class="dam-int-card__icon ' +
      esc(opts.iconClass || "") +
      '"><i class="uil ' +
      esc(opts.icon || "uil-link") +
      '" aria-hidden="true"></i></div>' +
      "<div><p class=\"dam-int-card__name\">" +
      esc(opts.label) +
      '</p><p class="dam-int-card__desc">' +
      esc(opts.desc || "") +
      "</p></div></div>" +
      statusBadge(st, stLabel) +
      "</header>";

    return (
      '<article class="dam-int-card" data-int="' +
      esc(opts.id) +
      '">' +
      head +
      body +
      config +
      foot +
      "</article>"
    );
  }

  /** Race: wiszący fetch nie może trzymać skeletonu w nieskończoność */
  function withTimeout(promise, ms, fallback) {
    var settled = false;
    return new Promise(function (resolve) {
      var t = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve(fallback);
      }, ms || 8000);
      Promise.resolve(promise)
        .then(function (v) {
          if (settled) return;
          settled = true;
          window.clearTimeout(t);
          resolve(v);
        })
        .catch(function () {
          if (settled) return;
          settled = true;
          window.clearTimeout(t);
          resolve(fallback);
        });
    });
  }

  function configAccordion(title, innerHtml) {
    var summaryText = isTileLayout() ? "Konfiguruj" : title || "Konfiguracja";
    return (
      '<details class="dam-int-config">' +
      "<summary>" +
      esc(summaryText) +
      '</summary><div class="dam-int-config__panel">' +
      innerHtml +
      "</div></details>"
    );
  }

  function field(label, id, type, value, opts) {
    opts = opts || {};
    var hint = opts.hint
      ? '<span class="dam-int-form__hint">' + esc(opts.hint) + "</span>"
      : "";
    var ro = opts.readonly ? " readonly" : "";
    var ph = opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : "";
    return (
      "<label for=\"" +
      esc(id) +
      '">' +
      esc(label) +
      hint +
      '<input type="' +
      esc(type || "text") +
      '" id="' +
      esc(id) +
      '" name="' +
      esc(id) +
      '" value="' +
      esc(value || "") +
      '"' +
      ph +
      ro +
      "></label>"
    );
  }

  function iconForProvider(k) {
    if (k === "asana") return { icon: "uil-check-square", cls: "dam-int-card__icon--asana" };
    if (k === "microsoft" || k === "teams" || k === "outlook") {
      return { icon: "uil-microsoft", cls: "dam-int-card__icon--ms" };
    }
    return { icon: "uil-link", cls: "" };
  }

  function entraCard(saved) {
    saved = saved || {};
    var cfg =
      configAccordion(
        "Konfiguracja Entra ID",
        '<form class="dam-int-form" data-config-form="entra">' +
          field("Tenant ID", "dam-int-entra-tenant", "text", saved.tenant_id || saved.tenant || "") +
          field("Client ID", "dam-int-entra-client", "text", saved.client_id || "") +
          field(
            "Redirect URI (readonly)",
            "dam-int-entra-redirect",
            "text",
            saved.redirect_uri || oauthRedirectUri(),
            { readonly: true, hint: "Ustaw ten adres w rejestracji aplikacji Azure." }
          ) +
          '<div class="dam-int-form__actions">' +
          '<button type="submit" class="geex-btn geex-btn--primary">Zapisz</button>' +
          "</div>" +
          '<p class="dam-int-msg" data-config-msg="entra"></p>' +
          "</form>"
      );
    return cardHtml({
      id: "entra",
      label: "Microsoft Entra ID",
      desc: "Logowanie domenowe. Tenant i client id w dam-connection.env lub poniżej.",
      icon: "uil-microsoft",
      iconClass: "dam-int-card__icon--ms",
      status: saved.tenant_id && saved.client_id ? "ready" : "wait",
      statusLabel: saved.tenant_id && saved.client_id ? "Gotowe do logowania" : "Nie skonfigurowane",
      configHtml: cfg,
    });
  }

  function ldapCard(saved) {
    saved = saved || {};
    var cfg =
      configAccordion(
        "Konfiguracja Synology / LDAP",
        '<form class="dam-int-form" data-config-form="ldap">' +
          '<div class="dam-int-form__row">' +
          field("Host LDAP", "dam-int-ldap-host", "text", saved.host || "", {
            placeholder: "ldap.synology.local",
          }) +
          field("Port", "dam-int-ldap-port", "number", saved.port || "636") +
          "</div>" +
          field("Base DN", "dam-int-ldap-base", "text", saved.base_dn || "", {
            placeholder: "dc=firma,dc=local",
          }) +
          '<div class="dam-int-form__actions">' +
          '<button type="submit" class="geex-btn geex-btn--primary">Zapisz</button>' +
          "</div>" +
          '<p class="dam-int-msg" data-config-msg="ldap"></p>' +
          "</form>"
      );
    var configured = !!(saved.host && saved.base_dn);
    return cardHtml({
      id: "ldap",
      label: "Synology / LDAP",
      desc: "Katalog użytkowników (DSM Directory Server, LDAPS lub OIDC). Opcjonalne uzupełnienie Entra.",
      icon: "uil-server-network",
      iconClass: "dam-int-card__icon--synology",
      status: configured ? "ready" : "wait",
      statusLabel: configured ? "Gotowe do logowania" : "Nie skonfigurowane",
      configHtml: cfg,
    });
  }

  function oauthConfigForm(provider, saved, p) {
    saved = saved || {};
    p = p || {};
    var isAsana = provider === "asana";
    var tenantField = isAsana
      ? field(
          "Workspace GID (opcjonalnie)",
          "dam-int-" + provider + "-workspace",
          "text",
          saved.workspace_gid || "",
          { placeholder: "1234567890" }
        )
      : field(
          "Tenant ID (opcjonalnie)",
          "dam-int-" + provider + "-tenant",
          "text",
          saved.tenant_id || saved.tenant || "",
          { placeholder: "common lub GUID" }
        );
    var syncBtn = isAsana
      ? '<button type="button" class="' +
        CTA_CLS +
        '" data-asana-sync>Synchronizuj teraz</button>'
      : "";
    return (
      configAccordion(
        isAsana ? "Konfiguracja Asana" : "Konfiguracja Microsoft",
        '<form class="dam-int-form" data-config-form="' +
          esc(provider) +
          '">' +
          field("Client ID", "dam-int-" + provider + "-client", "text", saved.client_id || "") +
          field(
            "Client secret",
            "dam-int-" + provider + "-secret",
            "password",
            saved.client_secret || "",
            { placeholder: p.configured ? "••••••••" : "" }
          ) +
          tenantField +
          '<div class="dam-int-form__actions">' +
          '<button type="submit" class="geex-btn geex-btn--primary">Zapisz konfigurację</button>' +
          syncBtn +
          "</div>" +
          '<p class="dam-int-msg" data-config-msg="' +
          esc(provider) +
          '"></p>' +
          "</form>"
      )
    );
  }

  function oauthCard(k, p, saved, err) {
    var ic = iconForProvider(k);
    var st = oauthStatusKey(p, err);
    var stLabel = oauthStatusLabel(p, err);
    var desc =
      p.hint ||
      (k === "asana"
        ? "Taski graficzne, kalkulator kosztów i inbox zgłoszeń."
        : "Teams, Outlook i Graph API - powiadomienia o brakach assetów.");
    var actions = "";
    if (p.connected) {
      actions +=
        '<button type="button" class="' +
        CTA_CLS +
        '" data-oauth-disconnect="' +
        esc(k) +
        '">Odłącz</button>';
    } else {
      actions +=
        '<button type="button" class="' +
        CTA_CLS +
        '" data-oauth-connect="' +
        esc(k) +
        '"' +
        (p.configured
          ? ""
          : ' disabled title="Najpierw zapisz Client ID i Secret w Konfiguruj"') +
        ">Zaloguj</button>";
    }
    return cardHtml({
      id: k,
      label: p.label || k,
      desc: desc,
      icon: ic.icon,
      iconClass: ic.cls,
      status: st,
      statusLabel: stLabel,
      feature: layoutMode === "bento" && st === "ok",
      configHtml: oauthConfigForm(k, saved, p),
      actionsHtml: actions,
    });
  }

  function costRatesCard(ratesJson) {
    var peopleCount = 0;
    try {
      var parsed = typeof ratesJson === "string" ? JSON.parse(ratesJson) : ratesJson;
      peopleCount = Object.keys((parsed && parsed.people) || {}).length;
    } catch (eCount) { /* ignore */ }
    var cfg =
      configAccordion(
        "Edytor stawek",
        '<form class="dam-int-form" data-finance-form="cost-rates">' +
          "<label>cost-rates.json<textarea id=\"dam-int-cost-rates-json\" name=\"rates\">" +
          esc(typeof ratesJson === "string" ? ratesJson : JSON.stringify(ratesJson, null, 2)) +
          "</textarea></label>" +
          '<div class="dam-int-form__actions">' +
          '<button type="submit" class="geex-btn geex-btn--primary">Zapisz stawki</button>' +
          '<a class="' +
          CTA_CLS +
          '" href="costs.html">Pełny kalkulator</a>' +
          "</div>" +
          '<p class="dam-int-msg" data-config-msg="cost-rates"></p>' +
          "</form>"
      );
    return cardHtml({
      id: "cost-rates",
      label: "Stawki kosztów",
      desc: "Osoby, mapa godzin i katalog bezpośrednich kosztów projektu.",
      icon: "uil-money-bill",
      iconClass: "dam-int-card__icon--finance",
      status: peopleCount ? "ok" : "wait",
      statusLabel: peopleCount ? peopleCount + " osób w bazie" : "Nie skonfigurowane",
      bodyHtml:
        '<p class="dam-int-card__meta">Labor, godziny zadań i koszty bezpośrednie z cost-rates.</p>',
      configHtml: cfg,
    });
  }

  function fmcgCard(summary) {
    summary = summary || {};
    var filled = summary.filled_count != null ? summary.filled_count : null;
    var total = summary.item_count != null ? summary.item_count : null;
    var stageHint =
      filled != null && total != null
        ? filled + " z " + total + " pozycji ma kwotę"
        : summary.estimate
          ? "Średnie branżowe (estimate)"
          : "Katalog łańcucha wartości";
    var cfg =
      configAccordion(
        "Katalog i import FMCG",
        '<form class="dam-int-form" data-finance-form="fmcg-import">' +
          '<p class="dam-int-fmcg-summary">Łańcuch: zamówienie → przygotowanie → produkcja → magazyn → dostawa. Import CSV lub ręczna edycja mapowań i kwot.</p>' +
          '<div class="dam-int-fmcg-actions">' +
          '<button type="button" class="' +
          CTA_CLS +
          '" id="dam-int-fmcg-edit" data-fmcg-edit>' +
          "Edytuj" +
          "</button>" +
          '<a class="' +
          CTA_CLS +
          '" href="data/templates/fmcg-cost-import-template.csv" download>Pobierz szablon CSV</a>' +
          '<label class="' +
          CTA_CLS +
          '" style="cursor:pointer">' +
          "Importuj CSV/XLSX" +
          '<input type="file" class="dam-int-file-input" id="dam-int-fmcg-file" accept=".csv,text/csv,.xlsx" hidden>' +
          "</label>" +
          "</div>" +
          '<p class="dam-int-msg" data-config-msg="fmcg-import"></p>' +
          "</form>"
      );
    return cardHtml({
      id: "fmcg-catalog",
      label: "Katalog FMCG",
      desc: "Pełny łańcuch wartości FMCG + import CSV gdy będą dane.",
      icon: "uil-package",
      iconClass: "dam-int-card__icon--fmcg",
      status: total ? "ok" : "wait",
      statusLabel: total ? "Katalog aktywny" : "Nie skonfigurowane",
      bodyHtml:
        '<p class="dam-int-fmcg-summary"><strong>' +
        esc(stageHint) +
        "</strong>" +
        (summary.currency ? " · " + esc(summary.currency) : "") +
        (summary.imported_at
          ? " · import " + esc(String(summary.imported_at).replace("T", " ").slice(0, 16))
          : "") +
        "</p>",
      configHtml: cfg,
    });
  }

  function section(title, cardsHtml, sectionId) {
    if (!cardsHtml) return "";
    var gridCls = "dam-int-hub-grid";
    if (layoutMode === "bento") gridCls = "dam-int-bento-grid";
    else if (layoutMode === "settings-bento") gridCls = "dam-int-bento-grid dam-int-bento-grid--3";
    if (!title) return '<div class="' + gridCls + '">' + cardsHtml + "</div>";
    return (
      '<section class="dam-int-section"' +
      (sectionId ? ' id="' + esc(sectionId) + '"' : "") +
      ">" +
      '<h3 class="dam-int-section__title">' +
      esc(title) +
      '</h3><div class="' +
      gridCls +
      '">' +
      cardsHtml +
      "</div></section>"
    );
  }

  /**
   * Skeleton mirroring live bento geometry (not DamGridReveal auto-fill).
   * Hub 4-col: span-2 hero + 2 singles (row1), 4 singles (row2); Planowane 4+1.
   */
  function skelCard(feature) {
    return (
      '<div class="dam-skeleton__card dam-int-tile' +
      (feature ? " dam-int-tile--feature" : "") +
      '" aria-hidden="true"></div>'
    );
  }

  function paintIntegrationsSkeleton(box, opts) {
    opts = opts || {};
    if (layoutMode === "bento") {
      var primary = "";
      var nPrimary = 0;
      if (opts.includeSynology !== false) {
        primary += skelCard(true);
        nPrimary += 1;
      }
      var singles =
        (opts.includeAuthInfra ? 2 : 0) +
        2 + /* Asana + Microsoft placeholders */
        (opts.includeFinance ? 2 : 0);
      var i;
      for (i = 0; i < singles; i++) primary += skelCard(false);
      nPrimary += singles;
      if (!nPrimary) {
        for (i = 0; i < 6; i++) primary += skelCard(i === 0);
      }
      var html = section("Integracje", primary, "damIntegrationsOAuth");
      if (opts.includeExtras === true) {
        var planned = "";
        for (i = 0; i < EXTRA_INTEGRATIONS.length; i++) planned += skelCard(false);
        html += section("Planowane", planned);
      }
      box.innerHTML =
        '<div class="dam-skeleton dam-skeleton--int-bento" aria-busy="true" aria-hidden="true">' +
        html +
        "</div>";
      return;
    }
    if (layoutMode === "settings-bento") {
      var cards = "";
      var n = opts.includeFinance ? 5 : 3;
      for (i = 0; i < n; i++) {
        cards +=
          '<div class="dam-skeleton__card dam-int-tile" aria-hidden="true"></div>';
      }
      box.innerHTML =
        '<div class="dam-skeleton dam-skeleton--int-bento" aria-busy="true" aria-hidden="true">' +
        '<div class="dam-int-bento-grid dam-int-bento-grid--3">' +
        cards +
        "</div></div>";
      return;
    }
    if (window.DamGridReveal && window.DamGridReveal.skeleton) {
      window.DamGridReveal.skeleton(box, { variant: "cards", count: 6 });
    } else {
      box.innerHTML = '<p class="dam-widget__meta">Wczytywanie statusu integracji…</p>';
    }
  }

  function setMsg(key, text, ok) {
    document.querySelectorAll('[data-config-msg="' + key + '"]').forEach(function (el) {
      el.textContent = text || "";
      el.className = "dam-int-msg" + (text ? (ok ? " dam-int-msg--ok" : " dam-int-msg--err") : "");
    });
  }

  function readForm(form) {
    var data = {};
    form.querySelectorAll("input, textarea, select").forEach(function (inp) {
      if (!inp.name && !inp.id) return;
      var key = inp.name || inp.id;
      if (inp.type === "checkbox") data[key] = inp.checked;
      else data[key] = inp.value;
    });
    return data;
  }

  function saveConfig(provider, payload) {
    return fetch(bridge() + "/integrations/config", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ provider: provider, config: payload }),
    }).then(function (r) {
      return r.json().then(function (data) {
        return { httpOk: r.ok, data: data };
      });
    });
  }

  function bindConfigForms(box, reload) {
    box.querySelectorAll("[data-config-form]").forEach(function (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var provider = form.getAttribute("data-config-form");
        var raw = readForm(form);
        var payload = {};
        if (provider === "entra") {
          payload = {
            tenant_id: raw["dam-int-entra-tenant"] || "",
            client_id: raw["dam-int-entra-client"] || "",
            redirect_uri: raw["dam-int-entra-redirect"] || oauthRedirectUri(),
          };
        } else if (provider === "ldap") {
          payload = {
            host: raw["dam-int-ldap-host"] || "",
            port: raw["dam-int-ldap-port"] || "",
            base_dn: raw["dam-int-ldap-base"] || "",
          };
        } else if (provider === "asana") {
          payload = {
            client_id: raw["dam-int-asana-client"] || "",
            client_secret: raw["dam-int-asana-secret"] || "",
            workspace_gid: raw["dam-int-asana-workspace"] || "",
          };
        } else if (provider === "microsoft") {
          payload = {
            client_id: raw["dam-int-microsoft-client"] || "",
            client_secret: raw["dam-int-microsoft-secret"] || "",
            tenant_id: raw["dam-int-microsoft-tenant"] || "",
          };
        }
        saveConfig(provider, payload)
          .then(function (res) {
            if (res.httpOk && res.data && res.data.ok !== false) {
              setMsg(provider, "Zapisano konfigurację.", true);
              reload();
            } else {
              setMsg(
                provider,
                (res.data && (res.data.hint || res.data.error)) || "Błąd zapisu.",
                false
              );
            }
          })
          .catch(function () {
            setMsg(provider, "Bridge offline - uruchom DAM / local_bridge.", false);
          });
      });
    });

    box.querySelectorAll("[data-asana-sync]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        btn.disabled = true;
        fetch(bridge() + "/integrations/asana/sync", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({}),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (res) {
            btn.disabled = false;
            if (res.ok) {
              setMsg("asana", "Synchronizacja zakonczona.", true);
              reload();
            } else {
              setMsg("asana", res.error || res.hint || "Błąd synchronizacji.", false);
            }
          })
          .catch(function () {
            btn.disabled = false;
            setMsg("asana", "Bridge offline.", false);
          });
      });
    });

    box.querySelectorAll("[data-finance-form]").forEach(function (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var kind = form.getAttribute("data-finance-form");
        if (kind !== "cost-rates") return;
        var ta = document.getElementById("dam-int-cost-rates-json");
        var parsed;
        try {
          parsed = JSON.parse(ta.value);
        } catch (eJson) {
          setMsg("cost-rates", "Niepoprawny JSON.", false);
          return;
        }
        fetch(bridge() + "/finance/cost-rates", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(parsed),
        })
          .then(function (r) {
            return r.json().then(function (data) {
              return { httpOk: r.ok, data: data };
            });
          })
          .then(function (res) {
            if (res.httpOk && res.data && res.data.ok !== false) {
              setMsg("cost-rates", "Zapisano stawki.", true);
            } else {
              setMsg(
                "cost-rates",
                (res.data && (res.data.error || res.data.hint)) || "Błąd zapisu.",
                false
              );
            }
          })
          .catch(function () {
            setMsg("cost-rates", "Bridge offline.", false);
          });
      });
    });

    var fmcgEditBtn = box.querySelector("[data-fmcg-edit]");
    if (fmcgEditBtn) {
      fmcgEditBtn.addEventListener("click", function (ev) {
        ev.preventDefault();
        if (window.DamFmcgCatalog && typeof DamFmcgCatalog.openEditor === "function") {
          DamFmcgCatalog.openEditor({
            onSaved: function () {
              setMsg("fmcg-import", "Zapisano mapowanie i katalog.", true);
              if (typeof reload === "function") reload();
            },
          });
        } else {
          setMsg(
            "fmcg-import",
            "Moduł edytora FMCG nie załadowany (dam-fmcg-catalog.js).",
            false
          );
        }
      });
    }

    var fmcgInput = box.querySelector("#dam-int-fmcg-file");
    if (fmcgInput) {
      fmcgInput.addEventListener("change", function () {
        var file = fmcgInput.files && fmcgInput.files[0];
        if (!file) return;
        var fd = new FormData();
        fd.append("file", file);
        var ah = authHeaders();
        var headers = {};
        if (ah.Authorization) headers.Authorization = ah.Authorization;
        fetch(bridge() + "/finance/fmcg-import", {
          method: "POST",
          headers: headers,
          body: fd,
        })
          .then(function (r) {
            return r.json().then(function (data) {
              return { httpOk: r.ok, data: data };
            });
          })
          .then(function (res) {
            fmcgInput.value = "";
            if (res.httpOk && res.data && res.data.ok !== false) {
              setMsg("fmcg-import", "Import zakonczony.", true);
              reload();
            } else {
              setMsg(
                "fmcg-import",
                (res.data && (res.data.error || res.data.hint)) || "Błąd importu.",
                false
              );
            }
          })
          .catch(function () {
            fmcgInput.value = "";
            setMsg("fmcg-import", "Bridge offline.", false);
          });
      });
    }
  }

  function bindActions(box, reload) {
    box.querySelectorAll(".dam-int-soon").forEach(function (btn) {
      if (!btn.getAttribute("title")) {
        btn.setAttribute("title", "Wdrożenie planowane - niedostępne");
      }
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      });
    });

    box.querySelectorAll("[data-filter-jump]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var f = btn.getAttribute("data-filter-jump");
        var chip = document.querySelector('#damSettingsFilter [data-filter="' + f + '"]');
        if (chip) chip.click();
      });
    });

    box.querySelectorAll("[data-oauth-connect]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var provider = btn.getAttribute("data-oauth-connect");
        btn.disabled = true;
        fetch(bridge() + "/integrations/connect", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ provider: provider }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (res) {
            btn.disabled = false;
            if (res.ok && res.authorize_url) {
              window.open(res.authorize_url, "_blank", "noopener");
            } else {
              alert(res.hint || res.error || "Nie udało się rozpocząć OAuth");
            }
          })
          .catch(function () {
            btn.disabled = false;
            alert("Bridge offline - uruchom DAM / local_bridge");
          });
      });
    });

    box.querySelectorAll("[data-oauth-disconnect]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var provider = btn.getAttribute("data-oauth-disconnect");
        if (!confirm("Odłączyć " + provider + "?")) return;
        fetch(bridge() + "/integrations/disconnect", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ provider: provider }),
        }).then(function () {
          reload();
        });
      });
    });

    bindConfigForms(box, reload);
  }

  function fetchSavedConfig() {
    return fetch(bridge() + "/integrations/config", { headers: authHeaders() })
      .then(function (r) {
        if (!r.ok) return {};
        return r.json();
      })
      .then(function (data) {
        return (data && data.config) || data || {};
      })
      .catch(function () {
        return {};
      });
  }

  function fetchCostRates() {
    return fetch(bridge() + "/finance/cost-rates", { headers: authHeaders() })
      .then(function (r) {
        if (r.ok) return r.json();
        throw new Error("bridge");
      })
      .catch(function () {
        return fetch("data/cost-rates.json?v=" + Date.now(), { cache: "no-store" })
          .then(function (r2) {
            return r2.ok ? r2.json() : {};
          })
          .catch(function () {
            return {};
          });
      });
  }

  function fetchFmcgSummary() {
    return fetch(bridge() + "/finance/fmcg-compute", { headers: authHeaders(), cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("bridge");
        return r.json();
      })
      .then(function (compute) {
        return fetch(bridge() + "/finance/fmcg-catalog", {
          headers: authHeaders(),
          cache: "no-store",
        })
          .then(function (r2) {
            return r2.ok ? r2.json() : {};
          })
          .then(function (catalog) {
            return Object.assign({}, compute, {
              version: catalog.version,
              currency: catalog.currency || compute.currency,
              imported_at: catalog.imported_at || compute.imported_at,
            });
          })
          .catch(function () {
            return compute;
          });
      })
      .catch(function () {
        return fetch("data/fmcg-cost-catalog.json?v=" + Date.now(), { cache: "no-store" })
          .then(function (r) {
            return r.ok ? r.json() : {};
          })
          .then(function (catalog) {
            var items = catalog.items || [];
            var filled = items.filter(function (i) {
              return i && i.amount != null && i.amount !== "";
            }).length;
            return {
              version: catalog.version,
              currency: catalog.currency,
              item_count: items.length,
              filled_count: filled,
              missing_count: items.length - filled,
              imported_at: catalog.imported_at,
            };
          })
          .catch(function () {
            return {};
          });
      });
  }

  function mount(containerId, opts) {
    opts = opts || {};
    var box = document.getElementById(containerId);
    if (!box) return;

    layoutMode = resolveLayout(opts, box);
    ensureSettingsBentoCss();
    ensureConfigPanelFixCss();
    box.classList.add("dam-integrations-page");
    box.classList.toggle("dam-integrations-page--bento", isTileLayout());
    box.classList.toggle("dam-integrations-page--settings", layoutMode === "settings-bento");

    var includeExtras = opts.includeExtras === true;
    var includeAuthInfra = !!opts.includeAuthInfra;
    var includeSynology = opts.includeSynology !== false;
    var includeFinance = opts.includeFinance === true;

    function reload() {
      mount(containerId, opts);
    }

    function showLoadError(msg) {
      box.innerHTML =
        '<p class="dam-int-auth-warn" role="alert"><i class="uil uil-exclamation-triangle" aria-hidden="true"></i> ' +
        esc(msg || "Nie udało się wczytać integracji.") +
        ' <button type="button" class="' +
        CTA_CLS +
        '" data-int-retry>Spróbuj ponownie</button></p>';
      var retry = box.querySelector("[data-int-retry]");
      if (retry) {
        retry.addEventListener("click", function () {
          reload();
        });
      }
    }

    function renderAll(statusData, savedCfg, rates, fmcg) {
      savedCfg = savedCfg || {};
      var providers = (statusData && statusData.providers) || {};
      var keys = Object.keys(providers);

      var authBanner = statusData.authWarning
        ? '<p class="dam-int-auth-warn"><i class="uil uil-exclamation-triangle" aria-hidden="true"></i> ' +
          esc(statusData.authWarning) +
          ' <a href="signin.html">Zaloguj się</a></p>'
        : "";

      var parts = [];
      var oauthCardsHtml =
        keys
          .map(function (k) {
            return oauthCard(k, providers[k], savedCfg[k] || {}, providers[k]._error);
          })
          .join("") ||
        cardHtml({
          id: "oauth-empty",
          label: "Brak danych OAuth",
          desc: "Odśwież stronę lub uruchom most lokalny (port 8766).",
          icon: "uil-sync",
          status: "wait",
          statusLabel: "Nie skonfigurowane",
        });

      var synOn = localStorage.getItem("dam_synology_enabled") !== "false";
      var synActions =
        opts.prefsJump === "filter"
          ? '<button type="button" class="' +
            CTA_CLS +
            '" data-filter-jump="prefs">Preferencje</button>'
          : '<a class="' +
            CTA_CLS +
            '" href="settings.html#damPrefs">Preferencje</a>';
      var synCardHtml = includeSynology
        ? cardHtml({
            id: "synology",
            label: "Synology Drive",
            desc: "Przycisk Udostępnij w galerii wizualizacji (klient lokalny).",
            icon: "uil-cloud-share",
            iconClass: "dam-int-card__icon--synology",
            status: synOn ? "ok" : "wait",
            statusLabel: synOn ? "Połączono" : "Nie skonfigurowane",
            feature: layoutMode === "bento" && synOn,
            actionsHtml: synActions,
          })
        : "";

      if (isTileLayout()) {
        /* Jedna gęsta siatka aktywnych + osobny grid Planowane */
        var primaryHtml = "";
        if (includeSynology) primaryHtml += synCardHtml;
        if (includeAuthInfra) {
          primaryHtml +=
            entraCard(savedCfg.entra || savedCfg.entra_id || {}) +
            ldapCard(savedCfg.ldap || savedCfg.synology_ldap || {});
        }
        primaryHtml += oauthCardsHtml;
        if (includeFinance) primaryHtml += costRatesCard(rates) + fmcgCard(fmcg);
        parts.push(
          section(
            layoutMode === "settings-bento" ? "" : "Integracje",
            primaryHtml,
            "damIntegrationsOAuth"
          )
        );
        if (includeExtras) {
          parts.push(
            section(
              "Planowane",
              EXTRA_INTEGRATIONS.map(function (x) {
                return cardHtml({
                  id: x.id,
                  label: x.label,
                  desc: x.desc,
                  icon: x.icon,
                  iconClass: x.iconClass,
                  status: "wait",
                  statusLabel: "Nie skonfigurowane",
                  planned: true,
                  actionsHtml:
                    '<button type="button" class="dam-int-soon" aria-disabled="true" tabindex="-1" title="Wdrożenie planowane - niedostępne">Wkrótce</button>',
                });
              }).join("")
            )
          );
        }
      } else {
        if (includeAuthInfra) {
          parts.push(
            section(
              "Logowanie i katalog",
              entraCard(savedCfg.entra || savedCfg.entra_id || {}) +
                ldapCard(savedCfg.ldap || savedCfg.synology_ldap || {})
            )
          );
        }

        parts.push(
          section(
            includeAuthInfra ? "OAuth (Asana, Microsoft)" : "",
            oauthCardsHtml,
            "damIntegrationsOAuth"
          )
        );

        if (includeSynology) {
          parts.push(section("Synology Drive", synCardHtml));
        }

        if (includeFinance) {
          parts.push(
            section("Finanse", costRatesCard(rates) + fmcgCard(fmcg), "damIntegrationsFinance")
          );
        }

        if (includeExtras) {
          parts.push(
            section(
              "Planowane",
              EXTRA_INTEGRATIONS.map(function (x) {
                return cardHtml({
                  id: x.id,
                  label: x.label,
                  desc: x.desc,
                  icon: x.icon,
                  iconClass: x.iconClass,
                  status: "wait",
                  statusLabel: "Nie skonfigurowane",
                  planned: true,
                  actionsHtml:
                    '<button type="button" class="dam-int-soon" aria-disabled="true" tabindex="-1" title="Wdrożenie planowane - niedostępne">Wkrótce</button>',
                });
              }).join("")
            )
          );
        }
      }

      box.innerHTML = authBanner + parts.join("");
      bindActions(box, reload);
      if (window.DamGridReveal && window.DamGridReveal.revealRows) {
        window.DamGridReveal.revealRows(box, ".dam-int-card");
      }
      /* Safety: GSAP reveal bywa mid-tween / stuck (opacity 0.3–0.9) — kill + force. */
      window.setTimeout(function () {
        box.querySelectorAll(".dam-int-card").forEach(function (el) {
          if (window.gsap && typeof window.gsap.killTweensOf === "function") {
            try {
              window.gsap.killTweensOf(el);
            } catch (eKill) { /* ignore */ }
          }
          el.style.opacity = "1";
          el.style.visibility = "visible";
          el.style.transform = "none";
        });
      }, isTileLayout() ? 500 : 1000);

      if (location.hash === "#damIntegrationsOAuth" || location.hash === "#damIntegrations") {
        var anchor = document.getElementById("damIntegrationsOAuth");
        if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function safeRender(statusData, savedCfg, rates, fmcg) {
      try {
        renderAll(statusData, savedCfg, rates, fmcg);
      } catch (errRender) {
        showLoadError(
          (errRender && errRender.message) ||
            "Błąd renderowania kart integracji. Spróbuj ponownie."
        );
      }
    }

    try {
      paintIntegrationsSkeleton(box, {
        includeExtras: includeExtras,
        includeAuthInfra: includeAuthInfra,
        includeSynology: includeSynology,
        includeFinance: includeFinance,
      });
    } catch (eSk) {
      box.innerHTML = '<p class="dam-widget__meta">Wczytywanie statusu integracji…</p>';
    }

    var loadGen = (box.getAttribute("data-int-load-gen") || "0") | 0;
    loadGen += 1;
    box.setAttribute("data-int-load-gen", String(loadGen));

    /** Hard failsafe: skeleton nigdy nie zostaje na stałe (nawet przy zawieszonym event-loop Promise) */
    var failSafe = window.setTimeout(function () {
      if ((box.getAttribute("data-int-load-gen") || "0") !== String(loadGen)) return;
      if (box.querySelector(".dam-skeleton") || !box.querySelector(".dam-int-card, .dam-int-auth-warn")) {
        showLoadError(
          "Timeout ładowania integracji. Most :8766 może nie odpowiadać lub skrypt zawisł."
        );
      }
    }, 14000);

    function clearFailSafe() {
      window.clearTimeout(failSafe);
    }

    withTimeout(
      Promise.all([
        withTimeout(
          fetch(bridge() + "/integrations/status", { headers: authHeaders() })
            .then(function (r) {
              return r.json().then(function (data) {
                return { httpOk: r.ok, data: data };
              });
            })
            .catch(function () {
              return { httpOk: false, data: null };
            }),
          8000,
          { httpOk: false, data: { error: "timeout", hint: "Timeout mostu (status)." } }
        ),
        withTimeout(fetchSavedConfig(), 8000, {}),
        includeFinance
          ? withTimeout(
              fetchCostRates().catch(function () {
                return {};
              }),
              8000,
              {}
            )
          : Promise.resolve(null),
        includeFinance
          ? withTimeout(
              fetchFmcgSummary().catch(function () {
                return {};
              }),
              8000,
              {}
            )
          : Promise.resolve(null),
      ]),
      12000,
      null
    )
      .then(function (all) {
        if ((box.getAttribute("data-int-load-gen") || "0") !== String(loadGen)) return;
        clearFailSafe();
        if (!all) {
          showLoadError("Timeout ładowania integracji. Most :8766 może nie odpowiadać.");
          return;
        }
        var res = all[0] || { httpOk: false, data: null };
        var savedCfg = all[1] || {};
        var rates = all[2];
        var fmcg = all[3] || {};

        var data = res.data || {};
        if (!res.httpOk || data.error === "login_required" || !data.providers) {
          var hint =
            data.hint ||
            (data.error === "login_required"
              ? "Zaloguj się ponownie, aby zarządzać integracjami OAuth."
              : "Nie udało się odczytać statusu integracji.");
          safeRender(
            {
              providers: {
                asana: {
                  configured: false,
                  connected: false,
                  label: "Asana",
                  hint: hint,
                },
                microsoft: {
                  configured: false,
                  connected: false,
                  label: "Microsoft (Teams + Outlook)",
                  hint: hint,
                },
              },
              authWarning: hint,
            },
            savedCfg,
            rates,
            fmcg
          );
          return;
        }
        safeRender(data, savedCfg, rates, fmcg);
      })
      .catch(function () {
        if ((box.getAttribute("data-int-load-gen") || "0") !== String(loadGen)) return;
        clearFailSafe();
        safeRender(
          {
            providers: {
              asana: { configured: false, connected: false, label: "Asana" },
              microsoft: {
                configured: false,
                connected: false,
                label: "Microsoft (Teams + Outlook)",
              },
            },
            authWarning: "Bridge offline lub błąd ładowania. Odśwież stronę.",
          },
          {},
          {},
          {}
        );
      });
  }

  window.DamIntegrations = {
    mount: mount,
    refresh: function (containerId, opts) {
      mount(containerId || "damIntegrationsList", opts);
    },
    EXTRA_INTEGRATIONS: EXTRA_INTEGRATIONS,
  };
})();
