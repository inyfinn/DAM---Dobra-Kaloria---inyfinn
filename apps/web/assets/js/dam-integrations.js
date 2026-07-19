/**
 * DAM - Integracje OAuth (Asana, Microsoft) + karty infrastruktury + finanse.
 * Wspoldzielone przez integrations.html i settings.html.
 */
(function () {
  "use strict";

  var EXTRA_INTEGRATIONS = [
    {
      id: "slack",
      label: "Slack",
      desc: "Kanaly zespolu marketingu - powiadomienia o zapotrzebowaniach.",
      icon: "uil-slack",
      iconClass: "dam-int-card__icon--slack",
    },
    {
      id: "gdrive",
      label: "Google Drive",
      desc: "Udostepnianie folderow eksportu i briefow.",
      icon: "uil-google-drive-alt",
      iconClass: "dam-int-card__icon--gdrive",
    },
    {
      id: "dropbox",
      label: "Dropbox",
      desc: "Alternatywny sync dla partnerow zewnetrznych.",
      icon: "uil-dropbox",
      iconClass: "dam-int-card__icon--dropbox",
    },
    {
      id: "notion",
      label: "Notion",
      desc: "Briefy i checklisty projektow w bazie Notion.",
      icon: "uil-book-alt",
      iconClass: "dam-int-card__icon--notion",
    },
    {
      id: "smtp",
      label: "E-mail SMTP",
      desc: "Wysylka powiadomien z grup (grafik) przez firmowy SMTP.",
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

  function statusBadge(st, label) {
    var cls = "geex-badge geex-badge--warning-transparent";
    if (st === "ok") cls = "geex-badge geex-badge--success-transparent";
    else if (st === "ready") cls = "geex-badge geex-badge--primary-transparent";
    else if (st === "err") cls = "geex-badge geex-badge--danger-transparent";
    else if (st === "wait") cls = "geex-badge geex-badge--warning-transparent";
    return '<span class="' + cls + ' dam-int-st dam-int-st--' + esc(st) + '">' + esc(label) + "</span>";
  }

  function oauthStatusLabel(p, err) {
    if (err) return "Blad";
    if (p.connected) {
      var extra = p.email ? " · " + p.email : "";
      if (p.connected_at) {
        extra += " · od " + String(p.connected_at).replace("T", " ").slice(0, 16);
      }
      return "Polaczono" + extra;
    }
    if (p.configured) return "Gotowe do logowania";
    return "Nie skonfigurowane";
  }

  function oauthStatusKey(p, err) {
    if (err) return "err";
    if (p.connected) return "ok";
    if (p.configured) return "ready";
    return "wait";
  }

  function cardHtml(opts) {
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
      statusBadge(opts.status || "wait", opts.statusLabel || "Nie skonfigurowane") +
      "</header>";

    var body = opts.bodyHtml ? '<div class="dam-int-card__body">' + opts.bodyHtml + "</div>" : "";
    var config = opts.configHtml || "";
    var foot = opts.actionsHtml
      ? '<footer class="dam-int-card__foot">' + opts.actionsHtml + "</footer>"
      : "";

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

  function configAccordion(title, innerHtml) {
    return (
      '<details class="dam-int-config">' +
      "<summary>" +
      esc(title || "Konfiguracja") +
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
      desc: "Logowanie domenowe. Tenant i client id w dam-connection.env lub ponizej.",
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
      desc: "Katalog uzytkownikow (DSM Directory Server, LDAPS lub OIDC). Opcjonalne uzupelnienie Entra.",
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
      ? '<button type="button" class="geex-btn geex-btn--primary-transparent" data-asana-sync>Synchronizuj teraz</button>'
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
          '<button type="submit" class="geex-btn geex-btn--primary">Zapisz konfiguracje</button>' +
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
        ? "Taski graficzne, kalkulator kosztow i inbox zgloszen."
        : "Teams, Outlook i Graph API - powiadomienia o brakach assetow.");
    var actions = "";
    if (p.connected) {
      actions +=
        '<button type="button" class="geex-btn geex-btn--primary-transparent" data-oauth-disconnect="' +
        esc(k) +
        '">Odlacz</button>';
    } else {
      actions +=
        '<button type="button" class="geex-btn geex-btn--primary" data-oauth-connect="' +
        esc(k) +
        '"' +
        (p.configured ? "" : " disabled") +
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
          '<a class="geex-btn geex-btn--primary-transparent" href="costs.html">Pelny kalkulator</a>' +
          "</div>" +
          '<p class="dam-int-msg" data-config-msg="cost-rates"></p>' +
          "</form>"
      );
    return cardHtml({
      id: "cost-rates",
      label: "Stawki kosztow",
      desc: "Osoby, mapa godzin i katalog bezposrednich kosztow projektu.",
      icon: "uil-money-bill",
      iconClass: "dam-int-card__icon--finance",
      status: peopleCount ? "ok" : "wait",
      statusLabel: peopleCount ? peopleCount + " osob w bazie" : "Nie skonfigurowane",
      bodyHtml:
        '<p class="dam-int-card__meta">Labor, godziny zadan i koszty bezposrednie z cost-rates.</p>',
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
          ? "Srednie branzowe (estimate)"
          : "Katalog łańcucha wartości";
    var cfg =
      configAccordion(
        "Katalog i import FMCG",
        '<form class="dam-int-form" data-finance-form="fmcg-import">' +
          '<p class="dam-int-fmcg-summary">Łańcuch: zamówienie → przygotowanie → produkcja → magazyn → dostawa. Import CSV wypełnia kwoty.</p>' +
          '<a class="geex-btn geex-btn--primary-transparent" style="width:fit-content" href="data/templates/fmcg-cost-import-template.csv" download>Pobierz szablon CSV</a>' +
          '<label class="geex-btn geex-btn--primary" style="width:fit-content;cursor:pointer">' +
          "Importuj CSV/XLSX" +
          '<input type="file" class="dam-int-file-input" id="dam-int-fmcg-file" accept=".csv,text/csv,.xlsx">' +
          "</label>" +
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
    if (!title) return '<div class="dam-int-hub-grid">' + cardsHtml + "</div>";
    return (
      '<section class="dam-int-section"' +
      (sectionId ? ' id="' + esc(sectionId) + '"' : "") +
      ">" +
      '<h3 class="dam-int-section__title">' +
      esc(title) +
      '</h3><div class="dam-int-hub-grid">' +
      cardsHtml +
      "</div></section>"
    );
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
              setMsg(provider, "Zapisano konfiguracje.", true);
              reload();
            } else {
              setMsg(
                provider,
                (res.data && (res.data.hint || res.data.error)) || "Blad zapisu.",
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
              setMsg("asana", res.error || res.hint || "Blad synchronizacji.", false);
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
                (res.data && (res.data.error || res.data.hint)) || "Blad zapisu.",
                false
              );
            }
          })
          .catch(function () {
            setMsg("cost-rates", "Bridge offline.", false);
          });
      });
    });

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
                (res.data && (res.data.error || res.data.hint)) || "Blad importu.",
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
              alert(res.hint || res.error || "Nie udalo sie rozpoczac OAuth");
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
        if (!confirm("Odlaczyc " + provider + "?")) return;
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

    var includeExtras = opts.includeExtras === true;
    var includeAuthInfra = !!opts.includeAuthInfra;
    var includeSynology = opts.includeSynology !== false;
    var includeFinance = opts.includeFinance === true;

    function reload() {
      mount(containerId, opts);
    }

    function renderAll(statusData, savedCfg, rates, fmcg) {
      savedCfg = savedCfg || {};
      var providers = (statusData && statusData.providers) || {};
      var keys = Object.keys(providers);

      var authBanner = statusData.authWarning
        ? '<p class="dam-int-auth-warn"><i class="uil uil-exclamation-triangle" aria-hidden="true"></i> ' +
          esc(statusData.authWarning) +
          ' <a href="signin.html">Zaloguj sie</a></p>'
        : "";

      var parts = [];

      if (includeAuthInfra) {
        parts.push(
          section(
            "Logowanie i katalog",
            entraCard(savedCfg.entra || savedCfg.entra_id || {}) +
              ldapCard(savedCfg.ldap || savedCfg.synology_ldap || {})
          )
        );
      }

      var oauthCards = keys.map(function (k) {
        return oauthCard(k, providers[k], savedCfg[k] || {}, providers[k]._error);
      });

      parts.push(
        section(
          includeAuthInfra ? "OAuth (Asana, Microsoft)" : "",
          oauthCards.join("") ||
            cardHtml({
              id: "oauth-empty",
              label: "Brak danych OAuth",
              desc: "Odswiez strone lub uruchom most lokalny (port 8766).",
              icon: "uil-sync",
              status: "wait",
              statusLabel: "Nie skonfigurowane",
            }),
          "damIntegrationsOAuth"
        )
      );

      if (includeSynology) {
        var synOn = localStorage.getItem("dam_synology_enabled") !== "false";
        var synActions =
          opts.prefsJump === "filter"
            ? '<button type="button" class="geex-btn geex-btn--primary-transparent" data-filter-jump="prefs">Preferencje</button>'
            : '<a class="geex-btn geex-btn--primary-transparent" href="settings.html#damPrefs">Preferencje</a>';
        parts.push(
          section(
            "Synology Drive",
            cardHtml({
              id: "synology",
              label: "Synology Drive",
              desc: "Przycisk Udostepnij w galerii wizualizacji (klient lokalny).",
              icon: "uil-cloud-share",
              iconClass: "dam-int-card__icon--synology",
              status: synOn ? "ok" : "wait",
              statusLabel: synOn ? "Polaczono" : "Nie skonfigurowane",
              actionsHtml: synActions,
            })
          )
        );
      }

      if (includeFinance) {
        parts.push(
          section(
            "Finanse",
            costRatesCard(rates) + fmcgCard(fmcg),
            "damIntegrationsFinance"
          )
        );
      }

      if (includeExtras) {
        parts.push(
          section(
            "Planowane integracje",
            EXTRA_INTEGRATIONS.map(function (x) {
              return cardHtml({
                id: x.id,
                label: x.label,
                desc: x.desc,
                icon: x.icon,
                iconClass: x.iconClass,
                status: "wait",
                statusLabel: "Nie skonfigurowane",
                actionsHtml:
                  '<button type="button" class="geex-btn geex-btn--primary-transparent" disabled>Wkrotce</button>',
              });
            }).join("")
          )
        );
      }

      box.innerHTML = authBanner + parts.join("");
      bindActions(box, reload);
      if (window.DamGridReveal && window.DamGridReveal.revealRows) {
        window.DamGridReveal.revealRows(box, ".dam-int-card");
      }

      if (location.hash === "#damIntegrationsOAuth" || location.hash === "#damIntegrations") {
        var anchor = document.getElementById("damIntegrationsOAuth");
        if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    if (window.DamGridReveal && window.DamGridReveal.skeleton) {
      window.DamGridReveal.skeleton(box, { variant: "cards", count: 6 });
    } else {
      box.innerHTML = '<p class="dam-widget__meta">Wczytywanie statusu integracji…</p>';
    }

    Promise.all([
      fetch(bridge() + "/integrations/status", { headers: authHeaders() })
        .then(function (r) {
          return r.json().then(function (data) {
            return { httpOk: r.ok, data: data };
          });
        })
        .catch(function () {
          return { httpOk: false, data: null };
        }),
      fetchSavedConfig(),
      includeFinance
        ? fetchCostRates().catch(function () {
            return {};
          })
        : Promise.resolve(null),
      includeFinance
        ? fetchFmcgSummary().catch(function () {
            return {};
          })
        : Promise.resolve(null),
    ])
      .then(function (all) {
        var res = all[0] || { httpOk: false, data: null };
        var savedCfg = all[1] || {};
        var rates = all[2];
        var fmcg = all[3] || {};

        var data = res.data || {};
        if (!res.httpOk || data.error === "login_required" || !data.providers) {
          var hint =
            data.hint ||
            (data.error === "login_required"
              ? "Zaloguj sie ponownie, aby zarzadzac integracjami OAuth."
              : "Nie udalo sie odczytac statusu integracji.");
          renderAll(
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
        renderAll(data, savedCfg, rates, fmcg);
      })
      .catch(function () {
        renderAll(
          {
            providers: {
              asana: { configured: false, connected: false, label: "Asana" },
              microsoft: {
                configured: false,
                connected: false,
                label: "Microsoft (Teams + Outlook)",
              },
            },
            authWarning: "Bridge offline lub blad ladowania. Odswiez strone.",
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
