/**
 * DamSavedLogins - zapisane loginy/hasla na tym komputerze (jak w przegladarce).
 *
 * Kontrakt mostu (local_bridge.py :8766, robi worker A1 rownolegle):
 *   GET  /auth/saved                -> {"ok":true,"accounts":[{email,name,autologin,saved_at,last_used_at}],
 *                                        "autologin_email":"...","available":bool}
 *   POST /auth/saved/login  {email} -> ta sama odpowiedz co /auth/login (token/device_id/machine_id/session_id/user)
 *                                       lub blad: invalid_credentials, password_change_required,
 *                                       too_many_attempts, saved_login_unreadable.
 *   POST /auth/saved/delete {email}
 *   POST /auth/saved/autologin {email, enabled}
 *
 * Uzycie:
 *   - signin.html: DamSavedLogins.mountSignin({ listEl, autoBarEl, autoTextEl, autoCancelEl,
 *       onFillEmail(email), onResult(promise, ctx) }) - renderowanie listy + pasek autologowania.
 *     Sama logika sukcesu/bledu logowania (przekierowanie, password_change_required z hasłem)
 *     zostaje w signin.html (onResult) - ten modul tylko woła /auth/saved/* i renderuje UI,
 *     zeby nie duplikowac logiki obslugi odpowiedzi z dam-api.js / signin.html.
 *   - settings.html: DamSavedLogins.mountSettings("containerId") - zarzadzanie (autologin, usun).
 *
 * UWAGA (zakres zadania): dam-api.js wolno tu ruszac tylko w funkcji wysylajacej /auth/login
 * (pola save_login/autologin), wiec /auth/saved/login NIE przechodzi przez DamApi. Zapis sesji
 * po udanym /auth/saved/login (localStorage: dam_token/dam_device_id/... ) jest tu swiadomie
 * powtorzony z persistSession() w dam-api.js - trzymaj oba miejsca w synchronizacji, jesli
 * ktoregos dnia zmieni sie ksztalt odpowiedzi logowania.
 */
(function (w, d) {
  "use strict";

  function bridgeUrl() {
    try {
      if (w.DamRuntime && typeof w.DamRuntime.bridgeUrl === "function") {
        return String(w.DamRuntime.bridgeUrl()).replace(/\/+$/, "");
      }
      if (w.DamPaths && typeof w.DamPaths.bridgeUrl === "function") {
        return String(w.DamPaths.bridgeUrl()).replace(/\/+$/, "");
      }
      if (w.DamBridgeUrl && typeof w.DamBridgeUrl.resolve === "function") {
        return String(w.DamBridgeUrl.resolve()).replace(/\/+$/, "");
      }
    } catch (e) {
      /* ignore */
    }
    return "http://127.0.0.1:8766";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return (
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c] || c
      );
    });
  }

  function isLogoutRedirect() {
    try {
      var params = new URLSearchParams(w.location.search || "");
      return params.get("logout") === "1";
    } catch (e) {
      return false;
    }
  }

  function fetchJson(path, opts) {
    return fetch(bridgeUrl() + path, opts).then(function (r) {
      return r
        .json()
        .catch(function () {
          return null;
        })
        .then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
    });
  }

  /** GET /auth/saved - nigdy nie rzuca; brak/stary most = {ok:false}. */
  function fetchSaved() {
    return fetchJson("/auth/saved", { cache: "no-store" })
      .then(function (res) {
        return res.data || { ok: false };
      })
      .catch(function () {
        return { ok: false };
      });
  }

  function mapSavedLoginError(data) {
    var code = data && data.error;
    if (code === "invalid_credentials") {
      return "Zapisane haslo jest juz nieaktualne. Zaloguj sie recznie.";
    }
    if (code === "password_change_required") {
      return "To haslo jest za slabe. Ustaw nowe haslo, zeby sie zalogowac.";
    }
    if (code === "too_many_attempts") {
      return "Za duzo nieudanych prob. Odczekaj 5 minut.";
    }
    if (code === "saved_login_unreadable") {
      return "Nie mozna odczytac zapisanego hasla na tym koncie Windows. Zaloguj sie recznie.";
    }
    return (data && data.error) || "Nie udalo sie zalogowac.";
  }

  /**
   * Zapis sesji identyczny jak persistSession() w dam-api.js (patrz komentarz na gorze pliku:
   * ta funkcja NIE moze wejsc do dam-api.js w tym zadaniu, wiec kopia jest celowa).
   */
  function persistSavedSession(data) {
    if (!data || !data.token) return;
    try {
      localStorage.setItem("dam_token", data.token);
      if (data.device_id) localStorage.setItem("dam_device_id", data.device_id);
      if (data.machine_id) localStorage.setItem("dam_machine_id", data.machine_id);
      if (data.session_id) localStorage.setItem("dam_session_id", data.session_id);
      if (data.user) {
        var role = String(data.user.role || "user").toLowerCase() || "user";
        localStorage.setItem("dam_role", role);
        localStorage.setItem("dam_user_name", data.user.name || "");
        localStorage.setItem(
          "dam_user",
          JSON.stringify({
            email: data.user.email || "",
            role: role,
            name: data.user.name || "",
            auth_provider: data.user.auth_provider || "local",
            title: "GRAFIK",
            department: "MARKETING",
            company: "KUBARA",
          })
        );
        if (role !== "admin") {
          localStorage.setItem("dam_admin_mode", "0");
          localStorage.setItem("dam_viz_admin_mode", "0");
        }
      }
    } catch (e) {
      /* ignore - most i tak zwrocil token, sesja dziala w tej karcie */
    }
  }

  /** POST /auth/saved/login {email} -> jak DamApi.login(), ale bez hasla. */
  function savedLogin(email) {
    return fetch(bridgeUrl() + "/auth/saved/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.ok && data.token) {
          persistSavedSession(data);
          return data;
        }
        var err = new Error(mapSavedLoginError(data));
        err.code = data && data.error;
        err.canSkip = !!(data && data.can_skip);
        throw err;
      });
  }

  function deleteSaved(email) {
    return fetchJson("/auth/saved/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email }),
    }).then(function (res) {
      return res.data || { ok: false };
    });
  }

  function setAutologin(email, enabled) {
    return fetchJson("/auth/saved/autologin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email, enabled: !!enabled }),
    }).then(function (res) {
      return res.data || { ok: false };
    });
  }

  /* ------------------------------------------------------------------ */
  /* signin.html - lista kont + pasek autologowania                      */
  /* ------------------------------------------------------------------ */

  function mountSignin(opts) {
    opts = opts || {};
    var listEl = opts.listEl;
    var autoBarEl = opts.autoBarEl;
    var autoTextEl = opts.autoTextEl;
    var autoCancelEl = opts.autoCancelEl;
    var onFillEmail = typeof opts.onFillEmail === "function" ? opts.onFillEmail : function () {};
    var onResult = typeof opts.onResult === "function" ? opts.onResult : function (p) { return p; };
    var autologinCancelled = false;
    var autologinTimer = null;

    function renderList(accounts) {
      if (!listEl) return;
      if (!accounts || !accounts.length) {
        listEl.hidden = true;
        listEl.innerHTML = "";
        return;
      }
      listEl.hidden = false;
      listEl.innerHTML =
        '<p class="dam-saved-logins__label">Zapisane konta</p>' +
        '<div class="dam-saved-logins__list">' +
        accounts
          .map(function (a) {
            var email = esc(a && a.email);
            var name = esc((a && (a.name || a.email)) || "");
            return (
              '<div class="dam-saved-logins__item">' +
              '<button type="button" class="dam-saved-logins__id" data-fill-email="' +
              email +
              '">' +
              '<span class="dam-saved-logins__name">' +
              name +
              "</span>" +
              '<span class="dam-saved-logins__email">' +
              email +
              "</span>" +
              "</button>" +
              '<button type="button" class="dam-saved-logins__go" data-saved-login="' +
              email +
              '">Zaloguj</button>' +
              '<button type="button" class="dam-saved-logins__remove" data-remove-saved="' +
              email +
              '" aria-label="Usun zapisane konto" title="Usun zapisane konto">&times;</button>' +
              "</div>"
            );
          })
          .join("") +
        "</div>";

      listEl.querySelectorAll("[data-fill-email]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          onFillEmail(btn.getAttribute("data-fill-email"));
        });
      });
      listEl.querySelectorAll("[data-saved-login]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var email = btn.getAttribute("data-saved-login");
          onResult(savedLogin(email), { savedLogin: true, email: email });
        });
      });
      listEl.querySelectorAll("[data-remove-saved]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var email = btn.getAttribute("data-remove-saved");
          if (!w.confirm("Usunac zapisane logowanie dla " + email + "?")) return;
          deleteSaved(email).then(refresh);
        });
      });
    }

    function stopAutologin() {
      autologinCancelled = true;
      if (autologinTimer) {
        clearInterval(autologinTimer);
        autologinTimer = null;
      }
      if (autoBarEl) autoBarEl.hidden = true;
    }

    function startAutologin(email) {
      if (!autoBarEl || !autoTextEl) return;
      autologinCancelled = false;
      autoBarEl.hidden = false;
      var remaining = 2;
      autoTextEl.textContent = "Loguje jako " + email + "...";
      autologinTimer = setInterval(function () {
        remaining -= 1;
        if (autologinCancelled) {
          clearInterval(autologinTimer);
          return;
        }
        if (remaining <= 0) {
          clearInterval(autologinTimer);
          autologinTimer = null;
          if (autoBarEl) autoBarEl.hidden = true;
          onResult(savedLogin(email), { savedLogin: true, email: email, autologin: true });
        }
      }, 1000);
      if (autoCancelEl) {
        autoCancelEl.onclick = stopAutologin;
      }
    }

    function refresh() {
      fetchSaved().then(function (data) {
        if (!data || !data.ok || data.available === false) {
          /* stary most - nic nie pokazuj, formularz dziala jak dotad */
          if (listEl) {
            listEl.hidden = true;
            listEl.innerHTML = "";
          }
          if (autoBarEl) autoBarEl.hidden = true;
          return;
        }
        renderList(data.accounts || []);
        if (data.autologin_email && !isLogoutRedirect()) {
          startAutologin(data.autologin_email);
        }
      });
    }

    refresh();
    return { refresh: refresh, stopAutologin: stopAutologin };
  }

  /* ------------------------------------------------------------------ */
  /* settings.html - zarzadzanie (autologin jedno konto, usun)           */
  /* ------------------------------------------------------------------ */

  function mountSettings(containerId) {
    var container = typeof containerId === "string" ? d.getElementById(containerId) : containerId;
    if (!container) return;

    function render(data) {
      if (!data || !data.ok) {
        container.innerHTML =
          '<p class="dam-widget__meta">Brak polaczenia z mostem DAM - zapisane logowania niedostepne.</p>';
        return;
      }
      if (data.available === false) {
        container.innerHTML =
          '<p class="dam-widget__meta">Ta wersja mostu DAM nie obsluguje jeszcze zapisanych logowan.</p>';
        return;
      }
      var accounts = data.accounts || [];
      if (!accounts.length) {
        container.innerHTML =
          '<p class="dam-widget__meta">Brak zapisanych logowan na tym komputerze.</p>';
        return;
      }
      container.innerHTML = accounts
        .map(function (a) {
          var email = esc(a && a.email);
          var name = esc((a && (a.name || a.email)) || "");
          var checked = a && a.autologin ? " checked" : "";
          var lastUsed = a && a.last_used_at ? esc(String(a.last_used_at)) : "";
          return (
            '<div class="dam-notify-row" data-email="' +
            email +
            '">' +
            "<div>" +
            '<p class="dam-sw-row__name">' +
            name +
            "</p>" +
            '<p class="dam-sw-row__desc">' +
            email +
            (lastUsed ? " &middot; ostatnio: " + lastUsed : "") +
            "</p>" +
            "</div>" +
            '<label class="dam-toggle" style="justify-self:start" title="Loguj automatycznie przy starcie">' +
            '<input type="checkbox" data-autologin-toggle="' +
            email +
            '"' +
            checked +
            ">" +
            '<span class="dam-toggle-track"></span>' +
            '<span class="dam-toggle-thumb"></span>' +
            "</label>" +
            '<button type="button" class="dam-notify-row__remove" data-remove-saved="' +
            email +
            '" aria-label="Usun zapisane logowanie" title="Usun zapisane logowanie">' +
            '<i class="uil uil-trash-alt" aria-hidden="true"></i>' +
            "</button>" +
            "</div>"
          );
        })
        .join("");

      container.querySelectorAll("[data-autologin-toggle]").forEach(function (chk) {
        chk.addEventListener("change", function () {
          var email = chk.getAttribute("data-autologin-toggle");
          chk.disabled = true;
          setAutologin(email, chk.checked).then(load, load);
        });
      });
      container.querySelectorAll("[data-remove-saved]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var email = btn.getAttribute("data-remove-saved");
          if (!w.confirm("Usunac zapisane logowanie dla " + email + "?")) return;
          deleteSaved(email).then(load, load);
        });
      });
    }

    function load() {
      container.innerHTML = '<p class="dam-widget__meta">Wczytywanie...</p>';
      fetchSaved().then(render);
    }

    load();
    return { refresh: load };
  }

  w.DamSavedLogins = {
    esc: esc,
    isLogoutRedirect: isLogoutRedirect,
    fetchSaved: fetchSaved,
    savedLogin: savedLogin,
    deleteSaved: deleteSaved,
    setAutologin: setAutologin,
    mapSavedLoginError: mapSavedLoginError,
    mountSignin: mountSignin,
    mountSettings: mountSettings,
  };
})(typeof window !== "undefined" ? window : globalThis, typeof document !== "undefined" ? document : {});
