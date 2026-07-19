/**
 * DAM - Integracje OAuth (Asana, Microsoft) + karty infrastruktury.
 * Współdzielone przez integrations.html i settings.html.
 */
(function () {
  "use strict";

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bridge() {
    return (
      (window.DamPaths && DamPaths.bridgeUrl && DamPaths.bridgeUrl()) ||
      "http://127.0.0.1:8766"
    );
  }

  function authHeaders() {
    return (
      (window.DamApi && DamApi.authHeaders && DamApi.authHeaders()) || {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
      }
    );
  }

  var EXTRA_INTEGRATIONS = [
    {
      id: "slack",
      label: "Slack",
      desc: "Kanały zespołu marketingu - powiadomienia o zapotrzebowaniach.",
      icon: "uil-slack",
      iconClass: "dam-int-card__icon--slack",
      status: "plan",
      statusLabel: "W planie (stub ADR-005)",
    },
    {
      id: "gdrive",
      label: "Google Drive",
      desc: "Udostępnianie folderów eksportu i briefów.",
      icon: "uil-google-drive-alt",
      iconClass: "dam-int-card__icon--gdrive",
      status: "plan",
      statusLabel: "W planie",
    },
    {
      id: "dropbox",
      label: "Dropbox",
      desc: "Alternatywny sync dla partnerów zewnętrznych.",
      icon: "uil-dropbox",
      iconClass: "dam-int-card__icon--dropbox",
      status: "plan",
      statusLabel: "W planie",
    },
    {
      id: "notion",
      label: "Notion",
      desc: "Briefy i checklisty projektów w bazie Notion.",
      icon: "uil-book-alt",
      iconClass: "dam-int-card__icon--notion",
      status: "plan",
      statusLabel: "W planie",
    },
    {
      id: "smtp",
      label: "E-mail SMTP",
      desc: "Wysyłka powiadomień z grup (grafik) przez firmowy SMTP.",
      icon: "uil-envelope-send",
      iconClass: "dam-int-card__icon--smtp",
      status: "plan",
      statusLabel: "Stub - konfiguracja w dam-connection.env",
    },
  ];

  var AUTH_INFRA = [
    {
      id: "entra",
      label: "Microsoft Entra ID",
      desc: "Logowanie domenowe. Tenant, client id i redirect URI w dam-connection.env na P.",
      icon: "uil-microsoft",
      iconClass: "dam-int-card__icon--ms",
      status: "wait",
      statusLabel: "Do konfiguracji w .env",
      actionsHtml:
        '<a class="dam-sw-btn dam-sw-btn--ghost" href="settings.html">Ustawienia DAM</a>',
    },
    {
      id: "ldap",
      label: "Synology / LDAP",
      desc: "Katalog użytkowników (DSM Directory Server, LDAPS lub OIDC). Opcjonalne uzupełnienie Entra.",
      icon: "uil-server-network",
      iconClass: "dam-int-card__icon--synology",
      status: "plan",
      statusLabel: "Opcjonalnie",
      actionsHtml:
        '<a class="dam-sw-btn dam-sw-btn--ghost" href="settings.html">Preferencje</a>',
    },
  ];

  function statusClass(st) {
    if (st === "ok") return "dam-int-st--ok";
    if (st === "ready") return "dam-int-st--ready";
    if (st === "plan") return "dam-int-st--plan";
    return "dam-int-st--wait";
  }

  function cardHtml(opts) {
    return (
      '<article class="dam-int-card" data-int="' +
      esc(opts.id) +
      '">' +
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
      '<div class="dam-int-card__status ' +
      statusClass(opts.status) +
      '">' +
      esc(opts.statusLabel) +
      "</div>" +
      (opts.actionsHtml
        ? '<div class="dam-int-card__actions">' + opts.actionsHtml + "</div>"
        : "") +
      "</article>"
    );
  }

  function iconForProvider(k) {
    if (k === "asana") return { icon: "uil-check-square", cls: "dam-int-card__icon--asana" };
    if (k === "microsoft" || k === "teams" || k === "outlook") {
      return { icon: "uil-microsoft", cls: "dam-int-card__icon--ms" };
    }
    return { icon: "uil-link", cls: "" };
  }

  function bindActions(box, reload) {
    box.querySelectorAll("[data-filter-jump]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var f = btn.getAttribute("data-filter-jump");
        var chip = document.querySelector(
          '#damSettingsFilter [data-filter="' + f + '"]'
        );
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
  }

  function mount(containerId, opts) {
    opts = opts || {};
    var box = document.getElementById(containerId);
    if (!box) return;

    var includeExtras = opts.includeExtras !== false && opts.includeExtras;
    var includeAuthInfra = !!opts.includeAuthInfra;
    var includeSynology = opts.includeSynology !== false;

    function reload() {
      mount(containerId, opts);
    }

    function section(title, cardsHtml, sectionId) {
      if (!cardsHtml) return "";
      if (!title) return '<div class="dam-int-grid">' + cardsHtml + "</div>";
      return (
        '<section class="dam-int-section"' +
        (sectionId ? ' id="' + esc(sectionId) + '"' : "") +
        ">" +
        '<h3 class="dam-int-section__title">' +
        esc(title) +
        '</h3><div class="dam-int-grid">' +
        cardsHtml +
        "</div></section>"
      );
    }

    function renderOauth(data) {
      var authBanner = data.authWarning
        ? '<p class="dam-int-auth-warn"><i class="uil uil-exclamation-triangle" aria-hidden="true"></i> ' +
          esc(data.authWarning) +
          ' <a href="signin.html">Zaloguj się</a></p>'
        : "";
      var providers = (data && data.providers) || {};
      var keys = Object.keys(providers);
      var oauthCards = keys.map(function (k) {
        var p = providers[k];
        var ic = iconForProvider(k);
        var st = p.connected ? "ok" : p.configured ? "ready" : "wait";
        var stLabel = p.connected
          ? "Połączono" +
            (p.email ? " · " + p.email : "") +
            (p.connected_at
              ? " · od " + String(p.connected_at).replace("T", " ").slice(0, 16)
              : "")
          : p.configured
            ? "Gotowe do logowania"
            : "Wymaga Client ID/Secret w .env";
        var actions = p.connected
          ? '<button type="button" class="dam-sw-btn dam-sw-btn--ghost" data-oauth-disconnect="' +
            esc(k) +
            '">Odłącz</button>'
          : '<button type="button" class="dam-sw-btn dam-sw-btn--primary" data-oauth-connect="' +
            esc(k) +
            '"' +
            (p.configured ? "" : " disabled") +
            ">Zaloguj</button>";
        var desc =
          p.hint ||
          (k === "asana"
            ? "Taski graficzne, kalkulator kosztów i inbox zgłoszeń."
            : "Teams, Outlook i Graph API - powiadomienia o brakach assetów.");
        return cardHtml({
          id: k,
          label: p.label || k,
          desc: desc,
          icon: ic.icon,
          iconClass: ic.cls,
          status: st,
          statusLabel: stLabel,
          actionsHtml: actions,
        });
      });

      var parts = [];

      if (includeAuthInfra) {
        parts.push(
          section(
            "Logowanie i katalog",
            AUTH_INFRA.map(function (x) {
              return cardHtml(x);
            }).join("")
          )
        );
      }

      parts.push(
        section(
          includeAuthInfra ? "OAuth (Asana, Microsoft)" : "",
          oauthCards.join("") || cardHtml({
            id: "oauth-empty",
            label: "Brak danych OAuth",
            desc: "Odśwież stronę lub uruchom most lokalny (port 8766).",
            icon: "uil-sync",
            status: "wait",
            statusLabel: "Niedostępne",
          }),
          "damIntegrationsOAuth"
        )
      );

      if (includeSynology) {
        var synOn = localStorage.getItem("dam_synology_enabled") !== "false";
        var synActions =
          opts.prefsJump === "filter"
            ? '<button type="button" class="dam-sw-btn dam-sw-btn--ghost" data-filter-jump="prefs">Preferencje</button>'
            : '<a class="dam-sw-btn dam-sw-btn--ghost" href="settings.html#damPrefs">Preferencje</a>';
        parts.push(
          section(
            "",
            cardHtml({
              id: "synology",
              label: "Synology Drive",
              desc: "Przycisk Udostępnij w galerii wizualizacji (klient lokalny).",
              icon: "uil-cloud-share",
              iconClass: "dam-int-card__icon--synology",
              status: synOn ? "ok" : "wait",
              statusLabel: synOn ? "Włączone w preferencjach" : "Wyłączone",
              actionsHtml: synActions,
            })
          )
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
                status: x.status,
                statusLabel: x.statusLabel,
                actionsHtml:
                  '<button type="button" class="dam-sw-btn dam-sw-btn--ghost" disabled>Wkrótce</button>',
              });
            }).join("")
          )
        );
      }

      box.innerHTML = authBanner + parts.join("");
      bindActions(box, reload);

      if (location.hash === "#damIntegrationsOAuth" || location.hash === "#damIntegrations") {
        var anchor = document.getElementById("damIntegrationsOAuth");
        if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    box.innerHTML = '<p class="dam-widget__meta">Wczytywanie statusu integracji…</p>';

    fetch(bridge() + "/integrations/status", { headers: authHeaders() })
      .then(function (r) {
        return r.json().then(function (data) {
          return { httpOk: r.ok, data: data };
        });
      })
      .then(function (res) {
        var data = res.data || {};
        if (!res.httpOk || data.error === "login_required" || !data.providers) {
          var hint =
            data.hint ||
            (data.error === "login_required"
              ? "Zaloguj się ponownie, aby zarządzać integracjami OAuth."
              : "Nie udało się odczytać statusu integracji.");
          renderOauth({
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
          });
          return;
        }
        renderOauth(data);
      })
      .catch(function () {
        var offline =
          cardHtml({
            id: "offline",
            label: "Most lokalny offline",
            desc: "Uruchom DAM Desktop lub local_bridge (port 8766), aby połączyć Asanę i Microsoft.",
            icon: "uil-wifi-slash",
            status: "wait",
            statusLabel: "Bridge niedostępny",
            actionsHtml:
              '<button type="button" class="dam-sw-btn dam-sw-btn--primary" onclick="location.reload()">Odśwież</button>',
          }) +
          (includeAuthInfra
            ? AUTH_INFRA.map(function (x) {
                return cardHtml(x);
              }).join("")
            : "");

        box.innerHTML =
          '<div class="dam-int-grid">' +
          offline +
          (includeExtras
            ? EXTRA_INTEGRATIONS.map(function (x) {
                return cardHtml(x);
              }).join("")
            : "") +
          "</div>";
      });
  }

  window.DamIntegrations = {
    mount: mount,
    refresh: function (containerId, opts) {
      mount(containerId || "damIntegrationsList", opts);
    },
  };
})();
