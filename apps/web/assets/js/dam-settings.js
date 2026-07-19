/**
 * DAM - Settings page controller (widget layout)
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

  function initials(name) {
    var parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /* ---------- Profile ---------- */
  function initProfile() {
    var nameEl = document.getElementById("settingProfileName");
    var emailEl = document.getElementById("settingProfileEmail");
    var roleEl = document.getElementById("settingProfileRole");
    var phoneEl = document.getElementById("settingProfilePhone");
    var titleEl = document.getElementById("settingProfileTitle");
    var avatarEl = document.getElementById("settingProfileAvatar");
    if (!nameEl) return;

    var user = {};
    try {
      user = JSON.parse(localStorage.getItem("dam_user") || "{}");
    } catch (e) {
      user = {};
    }
    var name =
      localStorage.getItem("dam_user_name") ||
      user.name ||
      "";
    var email = user.email || localStorage.getItem("dam_user_email") || "";
    var role = user.role || localStorage.getItem("dam_role") || "user";
    var phone =
      localStorage.getItem("dam_user_phone") || user.phone || "";
    var title =
      localStorage.getItem("dam_user_title") ||
      user.title ||
      user.job_title ||
      "";

    nameEl.value = name;
    if (emailEl) emailEl.value = email;
    if (roleEl) roleEl.value = role;
    if (phoneEl) phoneEl.value = phone;
    if (titleEl) titleEl.value = title;
    if (avatarEl) avatarEl.textContent = initials(name);

    nameEl.addEventListener("input", function () {
      if (avatarEl) avatarEl.textContent = initials(nameEl.value);
    });
  }

  function saveProfile() {
    var nameEl = document.getElementById("settingProfileName");
    var phoneEl = document.getElementById("settingProfilePhone");
    var titleEl = document.getElementById("settingProfileTitle");
    if (!nameEl) return;
    var name = (nameEl.value || "").trim();
    if (name) localStorage.setItem("dam_user_name", name);
    if (phoneEl) localStorage.setItem("dam_user_phone", (phoneEl.value || "").trim());
    if (titleEl) localStorage.setItem("dam_user_title", (titleEl.value || "").trim());
    try {
      var user = JSON.parse(localStorage.getItem("dam_user") || "{}");
      user.name = name || user.name;
      if (phoneEl) user.phone = (phoneEl.value || "").trim();
      if (titleEl) user.title = (titleEl.value || "").trim();
      localStorage.setItem("dam_user", JSON.stringify(user));
    } catch (e) { /* ignore */ }
  }

  /* ---------- Section filter (chips, nie scroll) ---------- */
  function initSectionFilter() {
    var nav = document.getElementById("damSettingsFilter");
    var grid = document.getElementById("damSettingsGrid");
    if (!nav || !grid) return;

    function setFilter(filter) {
      var f = filter || "all";
      var isAll = f === "all";
      nav.querySelectorAll(".dam-settings-jump__chip").forEach(function (chip) {
        var on = chip.getAttribute("data-filter") === f;
        chip.classList.toggle("is-active", on);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });
      grid.classList.toggle("is-filtered", !isAll);
      grid.querySelectorAll(".dam-widget[data-section]").forEach(function (sec) {
        var secId = sec.getAttribute("data-section");
        var show = isAll ? true : secId === f;
        if (secId === "system") show = isAll;
        sec.classList.toggle("is-filtered-out", !show);
        if (show) sec.removeAttribute("hidden");
        else sec.setAttribute("hidden", "");
      });
      try {
        if (isAll) sessionStorage.removeItem("dam_settings_filter");
        else sessionStorage.setItem("dam_settings_filter", f);
      } catch (e) { /* ignore */ }
    }

    nav.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-filter]");
      if (!btn || !nav.contains(btn)) return;
      ev.preventDefault();
      setFilter(btn.getAttribute("data-filter") || "all");
    });

    var initial = "all";
    try {
      initial = sessionStorage.getItem("dam_settings_filter") || "all";
    } catch (e) { /* ignore */ }
    setFilter(initial);
  }

  /* ---------- Theme (light/dark/system overlay) ---------- */
  function initTheme() {
    var picker = document.getElementById("damThemePicker");
    if (!picker || !window.DamTheme) return;

    function syncUi() {
      var pref = DamTheme.currentPref();
      picker.querySelectorAll("[data-theme-pick]").forEach(function (btn) {
        var on = btn.getAttribute("data-theme-pick") === pref;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    picker.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-theme-pick]");
      if (!btn) return;
      DamTheme.apply(btn.getAttribute("data-theme-pick"));
      syncUi();
    });
    syncUi();
  }

  /* ---------- Accent ---------- */
  function initAccent() {
    var presetsEl = document.getElementById("damAccentPresets");
    var colorEl = document.getElementById("settingAccentColor");
    var hexEl = document.getElementById("settingAccentHex");
    var resetBtn = document.getElementById("settingAccentReset");
    if (!window.DamAccent) return;

    var current = DamAccent.current();

    function syncUi(hex) {
      if (colorEl) colorEl.value = hex;
      if (hexEl) hexEl.value = hex;
      if (presetsEl) {
        presetsEl.querySelectorAll(".dam-accent-swatch").forEach(function (btn) {
          btn.classList.toggle(
            "is-active",
            DamAccent.normalize(btn.getAttribute("data-hex")) === hex
          );
        });
      }
    }

    if (presetsEl) {
      presetsEl.innerHTML = DamAccent.presets
        .map(function (p) {
          return (
            '<button type="button" class="dam-accent-swatch" data-hex="' +
            esc(p.hex) +
            '" title="' +
            esc(p.label) +
            '" aria-label="' +
            esc(p.label) +
            '" style="background:' +
            esc(p.hex) +
            '"></button>'
          );
        })
        .join("");
      presetsEl.addEventListener("click", function (ev) {
        var btn = ev.target.closest(".dam-accent-swatch");
        if (!btn) return;
        var hex = DamAccent.apply(btn.getAttribute("data-hex"));
        syncUi(hex);
      });
    }

    if (colorEl) {
      colorEl.addEventListener("input", function () {
        var hex = DamAccent.apply(colorEl.value);
        syncUi(hex);
      });
    }
    if (hexEl) {
      hexEl.addEventListener("change", function () {
        var hex = DamAccent.apply(hexEl.value);
        syncUi(hex);
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        syncUi(DamAccent.reset());
      });
    }
    syncUi(current);
  }

  /* ---------- Prefs / path / save ---------- */
  function initPrefs() {
    var tooltipEl = document.getElementById("settingTooltips");
    var synologyEl = document.getElementById("settingSynology");
    var brandDkEl = document.getElementById("settingBrandDK");
    var brandGcEl = document.getElementById("settingBrandGC");
    var basePathEl = document.getElementById("settingBasePath");
    var baseMsg = document.getElementById("settingBasePathMsg");
    var detectInfo = document.getElementById("settingBasePathDetectInfo");
    if (!tooltipEl || !basePathEl) return;

    tooltipEl.checked = localStorage.getItem("dam_tooltips") !== "off";
    if (synologyEl) {
      synologyEl.checked = localStorage.getItem("dam_synology_enabled") !== "false";
    }
    var brands = {};
    try {
      brands = JSON.parse(localStorage.getItem("dam_brands") || "{}");
    } catch (e) {
      brands = {};
    }
    if (brandDkEl) brandDkEl.checked = brands.DK !== false;
    if (brandGcEl) brandGcEl.checked = brands.GC !== false;
    basePathEl.value = localStorage.getItem("dam_base_path") || "";

    if (window.DamPaths && typeof DamPaths.ensureUserBase === "function") {
      DamPaths.ensureUserBase().then(function (res) {
        if (res && res.base) basePathEl.value = res.base;
        if (res && res.detect && res.detect.candidates && detectInfo) {
          var bits = res.detect.candidates.map(function (c) {
            return c.path + (c.ok ? " OK" : " brak");
          });
          detectInfo.classList.add("is-on");
          detectInfo.textContent =
            "Znaleziono na dysku (nie zapisane automatycznie): " + bits.join(" | ");
        }
      });
    }

    function showBaseMsg(text, ok) {
      if (!baseMsg) return;
      baseMsg.classList.add("is-on");
      baseMsg.classList.toggle("dam-sw-msg--ok", !!ok);
      baseMsg.classList.toggle("dam-sw-msg--err", !ok);
      baseMsg.textContent = text;
    }

    var testBtn = document.getElementById("settingBasePathTest");
    if (testBtn) {
      testBtn.addEventListener("click", function () {
        var raw = (basePathEl.value || "").trim();
        if (!raw) {
          showBaseMsg("Wpisz najpierw ścieżkę do folderu Marketing.", false);
          return;
        }
        if (!window.DamPaths) {
          showBaseMsg("Zapisano lokalnie (weryfikacja niedostępna offline).", true);
          return;
        }
        showBaseMsg("Sprawdzam foldery...", true);
        DamPaths.validateBaseRemote(raw)
          .then(function (res) {
            if (res && res.ok) {
              showBaseMsg("Wszystko w porządku - ta ścieżka zawiera wymagane foldery.", true);
            } else if (res && res.missing) {
              showBaseMsg("Brakuje folderów: " + res.missing.join(", "), false);
            } else {
              showBaseMsg("Nie można sprawdzić - most lokalny jest offline.", false);
            }
          })
          .catch(function () {
            showBaseMsg("Nie można sprawdzić - most lokalny jest offline (port 8766).", false);
          });
      });
    }

    var detectBtn = document.getElementById("settingBasePathDetect");
    if (detectBtn) {
      detectBtn.addEventListener("click", function () {
        if (!window.DamPaths || !DamPaths.detectMarketingBasesRemote) {
          showBaseMsg(
            "Automatyczne wykrywanie wymaga aplikacji desktop (most lokalny offline).",
            false
          );
          return;
        }
        showBaseMsg("Szukam folderu Marketing na dyskach tego komputera...", true);
        DamPaths.detectMarketingBasesRemote()
          .then(function (res) {
            if (!res || !res.candidates) {
              showBaseMsg("Nie znaleziono żadnych propozycji - wpisz ścieżkę ręcznie.", false);
              return;
            }
            var bits = res.candidates.map(function (c) {
              return c.path + (c.ok ? " OK" : " brak");
            });
            if (detectInfo) {
              detectInfo.classList.add("is-on");
              detectInfo.textContent =
                "Znaleziono na dysku (nie zapisane automatycznie): " + bits.join(" | ");
            }
            if (res.recommended) {
              basePathEl.value = res.recommended;
              showBaseMsg(
                "Znaleziono: " +
                  res.recommended +
                  ' - kliknij „Zapisz ustawienia”, jeśli to prawidłowa ścieżka.',
                true
              );
            } else {
              showBaseMsg(
                "Nie znaleziono folderu Marketing automatycznie - wpisz ścieżkę ręcznie.",
                false
              );
            }
          })
          .catch(function () {
            showBaseMsg(
              "Nie można wykryć - most lokalny jest offline (port 8766).",
              false
            );
          });
      });
    }

    var saveBtn = document.getElementById("settingsSave");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        localStorage.setItem("dam_tooltips", tooltipEl.checked ? "on" : "off");
        if (synologyEl) {
          localStorage.setItem(
            "dam_synology_enabled",
            synologyEl.checked ? "true" : "false"
          );
        }
        localStorage.setItem(
          "dam_brands",
          JSON.stringify({
            DK: !brandDkEl || brandDkEl.checked,
            GC: !brandGcEl || brandGcEl.checked,
          })
        );
        var raw = (basePathEl.value || "").trim();
        if (raw && window.DamPaths) {
          DamPaths.setBasePath(raw);
          DamPaths.logAction("set_base_path", {
            local_path: raw,
            detail: "Zapisano w Ustawieniach",
          });
        } else if (raw) {
          localStorage.setItem("dam_base_path", raw);
        }
        saveProfile();
        saveNotifications().then(function () {
          var msg = document.getElementById("settingsSaveMsg");
          if (msg) {
            msg.classList.add("is-on");
            setTimeout(function () {
              msg.classList.remove("is-on");
            }, 2500);
          }
        });
        if (window.DamTooltips) {
          tooltipEl.checked ? DamTooltips.enable() : DamTooltips.disable();
        }
      });
    }

    initRestart();
  }

  function initRestart() {
    var restartBtn = document.getElementById("settingRestartApp");
    var restartMsg = document.getElementById("settingRestartMsg");
    if (!restartBtn) return;

    function showRestartMsg(text, ok) {
      if (!restartMsg) return;
      restartMsg.classList.add("is-on");
      restartMsg.classList.toggle("dam-sw-msg--ok", !!ok);
      restartMsg.classList.toggle("dam-sw-msg--err", !ok);
      restartMsg.textContent = text;
    }

    function callRestartApi() {
      var api = window.pywebview && window.pywebview.api;
      if (!api || typeof api.restart_window !== "function") {
        showRestartMsg("Restart działa tylko w aplikacji desktop (DAM).", false);
        return Promise.resolve(null);
      }
      return Promise.resolve(api.restart_window())
        .then(function (res) {
          if (res && res.ok) showRestartMsg("Restartuje okno…", true);
          else showRestartMsg((res && res.error) || "Nie udało się zrestartować.", false);
          return res;
        })
        .catch(function (err) {
          showRestartMsg(String((err && err.message) || err || "Błąd restartu"), false);
        });
    }

    restartBtn.addEventListener("click", function () {
      if (!window.confirm("Zamknąć i uruchomić ponownie okno DAM?")) return;
      restartBtn.disabled = true;
      var done = false;
      function runOnce() {
        if (done) return;
        done = true;
        callRestartApi().then(function (res) {
          if (!(res && res.ok)) restartBtn.disabled = false;
        });
      }
      if (window.pywebview && window.pywebview.api) {
        runOnce();
        return;
      }
      window.addEventListener("pywebviewready", function onReady() {
        window.removeEventListener("pywebviewready", onReady);
        runOnce();
      });
      setTimeout(runOnce, 600);
    });
  }

  /* ---------- Instructions (RO) ---------- */
  function loadInstructions() {
    var list = document.getElementById("damInstrList");
    var meta = document.getElementById("damInstrMeta");
    if (!list) return;

    function priColor(p) {
      if (p === "critical") return "#C62828";
      if (p === "high") return "#E65100";
      return "#8b8d97";
    }

    function render(data) {
      var items = (data && data.instructions) || [];
      if (meta) {
        meta.textContent =
          "Wersja " +
          (data.version || "?") +
          " · " +
          items.length +
          " instrukcji · tylko odczyt";
      }
      if (!items.length) {
        list.innerHTML =
          '<p class="dam-widget__meta">Brak instrukcji - uzupełnij program-instructions.json i zrestartuj bridge.</p>';
        return;
      }
      var critical = items.filter(function (i) {
        return i.priority === "critical";
      });
      var rest = items.filter(function (i) {
        return i.priority !== "critical";
      });
      list.innerHTML = critical
        .concat(rest)
        .map(function (i) {
          var must = (i.must || [])
            .slice(0, 3)
            .map(function (m) {
              return "<li>" + esc(m) + "</li>";
            })
            .join("");
          return (
            '<div class="dam-instr-item">' +
            '<div class="dam-instr-item__meta">' +
            '<span style="font-weight:700;color:' +
            priColor(i.priority) +
            '">' +
            esc(i.priority || "normal") +
            "</span>" +
            "<span>" +
            esc(i.category || "") +
            "</span>" +
            "<code>" +
            esc(i.id || "") +
            "</code></div>" +
            '<div class="dam-instr-item__title">' +
            esc(i.title_pl || i.id) +
            "</div>" +
            '<div class="dam-instr-item__body">' +
            esc(i.body_pl || "") +
            "</div>" +
            (must ? "<ul>" + must + "</ul>" : "") +
            "</div>"
          );
        })
        .join("");
    }

    fetch(bridge() + "/program-instructions")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.ok) {
          render(data);
          return;
        }
        throw new Error("bridge");
      })
      .catch(function () {
        fetch("data/program-instructions.json?v=20260718instr1")
          .then(function (r) {
            return r.json();
          })
          .then(render)
          .catch(function () {
            list.innerHTML =
              '<p class="dam-widget__meta">Nie udało się wczytać instrukcji (bridge offline / brak pliku).</p>';
          });
      });
  }

  /* ---------- Naming (RO) ---------- */
  function loadNaming() {
    var table = document.getElementById("damNamingCarrierTable");
    if (!table) return;

    function render(dict) {
      var policy =
        (dict && dict.policy) ||
        (window.DamLabels && DamLabels.CARRIER_POLICY) ||
        {};
      var ui = policy.carrier_display_in_ui || "label_pl";
      var disk = policy.carrier_prefix_on_disk || "short";
      var uiEl = document.getElementById("damNamingUiRule");
      var diskEl = document.getElementById("damNamingDiskRule");
      var descEl = document.getElementById("damNamingPolicyDesc");
      var uiBadge = document.getElementById("damNamingUiBadge");
      var diskBadge = document.getElementById("damNamingDiskBadge");
      if (uiEl) {
        uiEl.textContent =
          ui === "short"
            ? "Skróty w UI (nietypowe - sprawdź słownik)"
            : "Pełne nazwy: DOYPACK, FOLIA, BATON…";
      }
      if (diskEl) {
        diskEl.textContent =
          disk === "short"
            ? "Skróty folderów: DOY, FOL, BAT…"
            : "Pełne nazwy także na dysku";
      }
      if (uiBadge) uiBadge.textContent = ui;
      if (diskBadge) diskBadge.textContent = disk;
      if (descEl) descEl.textContent = policy.description_pl || "";
      var carriers = (dict && dict.carriers) || {};
      var keys = Object.keys(carriers).sort();
      if (!keys.length) {
        table.innerHTML =
          '<p class="dam-widget__meta" style="padding:12px">Brak słownika naming-dictionary.</p>';
        return;
      }
      table.innerHTML =
        '<table class="dam-naming-table"><thead><tr>' +
        "<th>Kod</th><th>W programie</th><th>Na dysku</th>" +
        "</tr></thead><tbody>" +
        keys
          .map(function (code) {
            var c = carriers[code] || {};
            return (
              "<tr><td><strong>" +
              esc(code) +
              "</strong></td><td>" +
              esc(c.label_pl || code) +
              "</td><td>" +
              esc(c.short || code) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>";
    }

    fetch("data/naming-dictionary.json?v=20260718namingPolicy1")
      .then(function (r) {
        return r.json();
      })
      .then(function (dict) {
        if (window.DamLabels && DamLabels.applyNamingDict) DamLabels.applyNamingDict(dict);
        render(dict);
      })
      .catch(function () {
        render(window.DamNaming || null);
      });
  }

  /* ---------- Integrations (dam-integrations.js) ---------- */
  function loadIntegrations() {
    if (!window.DamIntegrations) return;
    DamIntegrations.mount("damIntegrationsList", {
      includeExtras: true,
      includeSynology: true,
      prefsJump: "filter",
    });
  }

  /* ---------- Notifications (editable) ---------- */
  var notifyState = { grafik: [] };

  function renderNotifyList() {
    var list = document.getElementById("damNotificationGroupsList");
    if (!list) return;
    var rows = notifyState.grafik || [];
    if (!rows.length) {
      list.innerHTML =
        '<p class="dam-widget__meta">Brak odbiorców - dodaj osobę poniżej.</p>';
      return;
    }
    list.innerHTML = rows
      .map(function (p, idx) {
        return (
          '<div class="dam-notify-row" data-idx="' +
          idx +
          '">' +
          '<input type="text" data-field="name" value="' +
          esc(p.name || "") +
          '" placeholder="Imię i nazwisko" aria-label="Imię">' +
          '<input type="email" data-field="email" value="' +
          esc(p.email || "") +
          '" placeholder="email@firma.pl" aria-label="E-mail">' +
          '<button type="button" class="dam-notify-row__remove" data-remove="' +
          idx +
          '" aria-label="Usuń"><i class="uil uil-trash-alt" aria-hidden="true"></i></button>' +
          "</div>"
        );
      })
      .join("");

    list.querySelectorAll(".dam-notify-row").forEach(function (row) {
      var idx = parseInt(row.getAttribute("data-idx"), 10);
      row.querySelectorAll("input").forEach(function (inp) {
        inp.addEventListener("change", function () {
          var field = inp.getAttribute("data-field");
          if (!notifyState.grafik[idx]) notifyState.grafik[idx] = {};
          notifyState.grafik[idx][field] = inp.value.trim();
        });
      });
    });
    list.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-remove"), 10);
        notifyState.grafik.splice(idx, 1);
        renderNotifyList();
      });
    });
  }

  function loadNotifications() {
    var addBtn = document.getElementById("damNotifyAdd");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var nameEl = document.getElementById("damNotifyName");
        var emailEl = document.getElementById("damNotifyEmail");
        var name = (nameEl && nameEl.value.trim()) || "";
        var email = (emailEl && emailEl.value.trim()) || "";
        if (!email || email.indexOf("@") < 0) {
          alert("Podaj poprawny adres e-mail.");
          return;
        }
        notifyState.grafik.push({ name: name || email, email: email });
        if (nameEl) nameEl.value = "";
        if (emailEl) emailEl.value = "";
        renderNotifyList();
      });
    }

    function applyData(data) {
      notifyState.grafik = Array.isArray(data && data.grafik)
        ? data.grafik.map(function (p) {
            return {
              name: (p && p.name) || "",
              email: (p && p.email) || String(p || ""),
            };
          })
        : [];
      renderNotifyList();
    }

    fetch(bridge() + "/notification-groups")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.ok && data.groups) {
          applyData(data.groups);
          return;
        }
        throw new Error("bridge");
      })
      .catch(function () {
        fetch("data/notification-groups.json?v=20260718inbox3")
          .then(function (r) {
            return r.json();
          })
          .then(applyData)
          .catch(function () {
            var list = document.getElementById("damNotificationGroupsList");
            if (list) {
              list.innerHTML =
                '<p class="dam-widget__meta">Nie udało się wczytać grup powiadomień.</p>';
            }
          });
      });
  }

  function saveNotifications() {
    var payload = {
      grafik: (notifyState.grafik || []).filter(function (p) {
        return p && p.email && String(p.email).indexOf("@") > 0;
      }),
    };
    return fetch(bridge() + "/notification-groups", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ groups: payload }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        if (!(res && res.ok)) {
          /* fallback: local only hint */
          console.warn("notification-groups save:", res);
        }
        return res;
      })
      .catch(function () {
        return { ok: false, offline: true };
      });
  }

  function boot() {
    initSectionFilter();
    initTheme();
    initProfile();
    initAccent();
    initPrefs();
    loadInstructions();
    loadNaming();
    loadIntegrations();
    loadNotifications();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
