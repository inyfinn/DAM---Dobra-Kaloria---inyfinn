/**

 * DAM - UI zarzadzania sciezkami Marketing per urzadzenie.

 * Mount: profile.html#damDevicePathsRoot oraz settings.html#damDisk (ta sama karta).

 * Zalezy od DamPaths (API bridge) + opcjonalnie DamDanger (hold-to-delete).

 * Style wstrzykniete lokalnie (nie ruszamy cudzych CSS przy wspolbieznych agentach).

 */

(function (global) {

  "use strict";



  function esc(s) {

    return String(s == null ? "" : s)

      .replace(/&/g, "&amp;")

      .replace(/</g, "&lt;")

      .replace(/>/g, "&gt;")

      .replace(/"/g, "&quot;");

  }



  function ensureCss() {

    if (document.getElementById("damDevicePathsCss")) return;

    var s = document.createElement("style");

    s.id = "damDevicePathsCss";

    s.textContent =

      ".dam-devpath-card{background:#fff;border:1px solid #E7E7E7;border-radius:14px;" +

      "padding:22px 20px;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,.04)}" +

      "#damDisk .dam-devpath-card{background:transparent;border:none;box-shadow:none;" +

      "padding:0;margin:0;border-radius:0}" +

      "#damDisk .dam-devpath-head{display:none}" +

      ".dam-devpath-head{display:flex;align-items:flex-start;justify-content:space-between;" +

      "gap:12px;margin-bottom:14px;flex-wrap:wrap}" +

      ".dam-devpath-title{margin:0;font-size:16px;font-weight:700;color:#464255}" +

      ".dam-devpath-lead{margin:4px 0 0;font-size:13px;color:#8b8d97;max-width:52ch;line-height:1.45}" +

      ".dam-devpath-current{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;" +

      "padding:10px 12px;border-radius:10px;background:#f6f7f9;border:1px solid #eceef1;margin-bottom:14px}" +

      ".dam-devpath-pill{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;" +

      "color:#5b8c6a;background:rgba(91,140,106,.12);padding:3px 8px;border-radius:999px}" +

      ".dam-devpath-pill.is-missing{color:#a15c2d;background:rgba(161,92,45,.12)}" +

      ".dam-devpath-meta{font-size:13px;color:#464255;font-weight:500}" +

      ".dam-devpath-meta code{font-size:12px;background:#fff;border:1px solid #e7e7e7;" +

      "padding:1px 6px;border-radius:6px}" +

      ".dam-devpath-list{display:flex;flex-direction:column;gap:10px}" +

      ".dam-devpath-row{display:grid;grid-template-columns:1fr auto;gap:10px 12px;" +

      "align-items:start;padding:12px 12px;border:1px solid #E7E7E7;border-radius:12px;background:#fafafa}" +

      ".dam-devpath-row.is-current{border-color:rgba(91,140,106,.45);background:rgba(91,140,106,.06)}" +

      ".dam-devpath-row-title{font-size:14px;font-weight:600;color:#464255;margin:0 0 2px}" +

      ".dam-devpath-row-sub{font-size:12px;color:#8b8d97;margin:0;word-break:break-all}" +

      ".dam-devpath-row-path{font-size:13px;font-weight:500;color:#2f3540;margin:6px 0 0}" +

      ".dam-devpath-actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;align-items:center}" +

      ".dam-devpath-actions .geex-btn{min-height:36px;padding:6px 12px;font-size:12px}" +

      /* Edytuj / Usun = jak .dam-welcome-link (system DAM), nie outline lavender */

      ".dam-devpath-actions .dam-welcome-link," +

      ".dam-devpath-actions button.dam-welcome-link{" +

      "display:inline-flex;align-items:center;gap:6px;padding:8px 12px;" +

      "border:1px solid #E7E7E7;border-radius:8px;background:#fff;color:#464255;" +

      "font-size:12px;font-weight:500;text-decoration:none;cursor:pointer;line-height:1.2;" +

      "font-family:inherit;min-height:36px}" +

      ".dam-devpath-actions .dam-welcome-link:hover{" +

      "border-color:var(--dam-primary,#AB54DB);background:#fbf7fe;color:var(--dam-primary,#AB54DB)}" +

      ".dam-devpath-actions .dam-welcome-link.dam-devpath-del:hover," +

      ".dam-devpath-actions .dam-welcome-link.dam-danger-holding{" +

      "border-color:color-mix(in srgb,var(--dam-danger,#ff5b5b) 55%,transparent);" +

      "color:var(--dam-danger,#d63b38);" +

      "background:color-mix(in srgb,var(--dam-danger,#ff5b5b) 8%,transparent)}" +

      ".dam-devpath-form{display:none;margin-top:12px;padding:14px;border:1px dashed #cfd3d8;" +

      "border-radius:12px;background:#fff}" +

      ".dam-devpath-form.is-open{display:block}" +

      ".dam-devpath-form label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;" +

      "letter-spacing:.05em;color:#8b8d97;margin:0 0 4px}" +

      ".dam-devpath-form .form-control{margin-bottom:10px}" +

      ".dam-devpath-path-row{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch;margin-bottom:10px}" +

      ".dam-devpath-path-row .form-control{flex:1 1 200px;margin-bottom:0;min-width:0}" +

      ".dam-devpath-path-row .geex-btn{flex:0 0 auto;min-height:40px}" +

      ".dam-devpath-msg{font-size:12px;margin:8px 0 0;min-height:1.2em}" +

      ".dam-devpath-msg.is-ok{color:#2f6b45}.dam-devpath-msg.is-err{color:#a33}" +

      ".dam-devpath-empty{font-size:13px;color:#8b8d97;padding:8px 0}" +

      "[data-theme='dark'] .dam-devpath-card,[data-theme='dark'] .dam-devpath-form{background:#171b19;border-color:#2a312d}" +

      "[data-theme='dark'] #damDisk .dam-devpath-card{background:transparent;border:none}" +

      "[data-theme='dark'] .dam-devpath-current,[data-theme='dark'] .dam-devpath-row{background:#121614;border-color:#2a312d}" +

      "[data-theme='dark'] .dam-devpath-title,[data-theme='dark'] .dam-devpath-row-title," +

      "[data-theme='dark'] .dam-devpath-meta,[data-theme='dark'] .dam-devpath-row-path{color:#e8ebe9}" +

      "[data-theme='dark'] .dam-devpath-actions .dam-welcome-link{background:#171b19;border-color:#2a312d;color:#e8ebe9}";

    document.head.appendChild(s);

  }



  function toast(msg) {

    if (global.DamPaths && typeof DamPaths.showToast === "function") {

      DamPaths.showToast(msg);

    }

  }



  function syncLegacySettingsField(path) {

    var el = document.getElementById("settingBasePath");

    if (el) el.value = path || "";

  }



  function applyNormalizedPath(inputEl, pickedPath, normalizedPath, setMsg) {

    var finalPath = normalizedPath || pickedPath || "";

    if (inputEl) inputEl.value = finalPath;

    if (!finalPath) return;

    var pickedWin = String(pickedPath || "").replace(/\//g, "\\");

    var finalWin = String(finalPath || "").replace(/\//g, "\\");

    if (pickedWin && finalWin.toLowerCase() !== pickedWin.toLowerCase()) {

      setMsg("Wskazano podfolder - zapisze root Marketing: " + finalPath, true);

    } else {

      setMsg("Wybrano: " + finalPath, true);

    }

  }



  function mount(root) {

    if (!root) return;

    if (root.getAttribute("data-dam-devpath-mounted") === "1") return;

    root.setAttribute("data-dam-devpath-mounted", "1");

    ensureCss();

    root.innerHTML =

      '<div class="dam-devpath-card" id="damDevPathCard">' +

        '<div class="dam-devpath-head">' +

          "<div>" +

            '<h3 class="dam-devpath-title">Urzadzenia i sciezki Marketing</h3>' +

            '<p class="dam-devpath-lead">Kazda stacja (dom, praca) ma wlasna litere dysku. ' +

              "Sciezka zapisana tu dotyczy tylko wybranego urzadzenia - nie przenosi sie miedzy komputerami. " +

              "Wskaz folder przyciskiem Folder (nie musisz klepac sciezki).</p>" +

          "</div>" +

          '<button type="button" class="geex-btn geex-btn--primary" id="damDevPathAddBtn">' +

            '<i class="uil uil-plus" aria-hidden="true"></i> Dodaj / ustaw</button>' +

        "</div>" +

        '<div class="dam-devpath-toolbar" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">' +

          '<button type="button" class="geex-btn geex-btn--primary" id="damDevPathAddBtnBar">' +

            '<i class="uil uil-plus" aria-hidden="true"></i> Dodaj / ustaw</button>' +

        "</div>" +

        '<div class="dam-devpath-current" id="damDevPathCurrent" aria-live="polite"></div>' +

        '<div class="dam-devpath-list" id="damDevPathList"></div>' +

        '<div class="dam-devpath-form" id="damDevPathForm" aria-hidden="true">' +

          '<label for="damDevPathLabel">Etykieta (opcjonalnie)</label>' +

          '<input type="text" id="damDevPathLabel" class="form-control" placeholder="np. Dom, Praca, Laptop" maxlength="64" />' +

          '<label for="damDevPathHostname">Nazwa urzadzenia (hostname)</label>' +

          '<input type="text" id="damDevPathHostname" class="form-control" placeholder="np. DESKTOP-ABC" />' +

          '<label for="damDevPathDeviceId">Device ID</label>' +

          '<input type="text" id="damDevPathDeviceId" class="form-control" placeholder="dam-dev-..." />' +

          '<label for="damDevPathBase">Sciezka Marketing (root)</label>' +

          '<div class="dam-devpath-path-row">' +

            '<input type="text" id="damDevPathBase" class="form-control" placeholder="np. X:\\Marketing" spellcheck="false" />' +

            '<button type="button" class="geex-btn geex-btn--primary" id="damDevPathFolder" ' +

              'title="Wskaz folder w Eksploratorze Windows" data-dam-tip="Otwiera wybor folderu - nie musisz klepac sciezki">' +

              '<i class="uil uil-folder" aria-hidden="true"></i> Folder</button>' +

          "</div>" +

          '<div class="dam-devpath-actions" style="justify-content:flex-start;margin-top:4px">' +

            '<button type="button" class="geex-btn geex-btn--primary" id="damDevPathSave">Zapisz</button>' +

            '<button type="button" class="geex-btn geex-btn--primary-transparent" id="damDevPathCancel">Anuluj</button>' +

            '<button type="button" class="geex-btn geex-btn--primary-transparent" id="damDevPathDetect" ' +

              'data-dam-tip="Szuka folderu Marketing na dyskach. Nic nie zapisuje samo.">' +

              '<i class="uil uil-search" aria-hidden="true"></i> Wykryj</button>' +

            '<button type="button" class="geex-btn geex-btn--primary-transparent" id="damDevPathTest" ' +

              'data-dam-tip="Sprawdza, czy sa wymagane foldery ARCHIWUM / EKSPORT / POLSKA">' +

              '<i class="uil uil-check-circle" aria-hidden="true"></i> Sprawdz</button>' +

          "</div>" +

          '<p class="dam-devpath-msg" id="damDevPathMsg"></p>' +

        "</div>" +

      "</div>";



    var form = document.getElementById("damDevPathForm");

    var editingId = null;

    var inSettings = !!(root.closest && root.closest("#damDisk"));

    var addBar = document.getElementById("damDevPathAddBtnBar");

    if (addBar) {

      addBar.style.display = inSettings ? "" : "none";

    }



    function setMsg(text, ok) {

      var el = document.getElementById("damDevPathMsg");

      if (!el) return;

      el.textContent = text || "";

      el.className = "dam-devpath-msg" + (text ? (ok ? " is-ok" : " is-err") : "");

    }



    function openForm(prefill) {

      form.classList.add("is-open");

      form.setAttribute("aria-hidden", "false");

      editingId = (prefill && prefill.device_id) || null;

      document.getElementById("damDevPathLabel").value = (prefill && prefill.label) || "";

      document.getElementById("damDevPathHostname").value = (prefill && prefill.hostname) || "";

      document.getElementById("damDevPathDeviceId").value = (prefill && prefill.device_id) || "";

      var base = (prefill && prefill.base_path) || "";

      if (base && global.DamPaths && DamPaths.normalizeMarketingRoot) {

        base = DamPaths.normalizeMarketingRoot(base) || base;

      }

      document.getElementById("damDevPathBase").value = base;

      setMsg("", true);

    }



    function closeForm() {

      form.classList.remove("is-open");

      form.setAttribute("aria-hidden", "true");

      editingId = null;

      setMsg("", true);

    }



    function doDelete(id, current) {

      if (!id || !global.DamPaths || !DamPaths.deleteUserDevicePath) return;

      DamPaths.deleteUserDevicePath(id).then(function (res) {

        if (res && res.ok) {

          toast("Usunieto wpis urzadzenia");

          if (current && current.device_id === id && DamPaths.setBasePath) {

            try {

              localStorage.removeItem("dam_base_path");

              localStorage.removeItem("dam_base_path::" + id);

            } catch (_e) { /* ignore */ }

            syncLegacySettingsField("");

          }

          reload();

        } else {

          toast((res && res.error) || "Nie usunieto");

        }

      }).catch(function () { toast("Bridge offline"); });

    }



    function bindDeleteButton(btn, id, current) {

      if (!btn || !id) return;

      if (global.DamDanger && typeof DamDanger.bind === "function") {

        DamDanger.bind(btn, {

          label: "Usun urzadzenie",

          hint: "Przytrzymaj, aby usunac",

          holdMs: 300,

          onConfirm: function () { doDelete(id, current); }

        });

        return;

      }

      btn.addEventListener("click", function () {

        if (!window.confirm("Usunac sciezke dla urzadzenia " + id + "?")) return;

        doDelete(id, current);

      });

    }



    function render(data) {

      var current = (data && data.current) || {};

      var devices = (data && data.devices) || [];

      var curEl = document.getElementById("damDevPathCurrent");

      var listEl = document.getElementById("damDevPathList");

      var has = !!current.has_path || !!(current.entry && current.entry.base_path);

      var path = (current.base_path || (current.entry && current.entry.base_path) || "") ||

        (global.DamPaths && DamPaths.getBasePath ? DamPaths.getBasePath() : "");

      syncLegacySettingsField(path);

      curEl.innerHTML =

        '<span class="dam-devpath-pill' + (has || path ? "" : " is-missing") + '">' +

          (has || path ? "To urzadzenie" : "Brak sciezki") +

        "</span>" +

        '<span class="dam-devpath-meta">Hostname: <strong>' +

          esc(current.hostname || "—") +

        "</strong></span>" +

        '<span class="dam-devpath-meta">Device: <code>' +

          esc(current.device_id || "—") +

        "</code></span>" +

        '<span class="dam-devpath-meta">Sciezka: <code>' +

          esc(path || "(nie ustawiono)") +

        "</code></span>";



      if (!devices.length) {

        listEl.innerHTML =

          '<p class="dam-devpath-empty">Brak zapisanych urzadzen w bazie. ' +

          "Ustaw sciezke dla tego komputera przyciskiem Dodaj / ustaw, potem Folder.</p>";

        return;

      }



      listEl.innerHTML = devices.map(function (d) {

        var isCur = d.device_id && d.device_id === current.device_id;

        var title = d.label || d.hostname || d.device_id || "Urzadzenie";

        return (

          '<div class="dam-devpath-row' + (isCur ? " is-current" : "") + '" data-device="' + esc(d.device_id) + '">' +

            "<div>" +

              '<p class="dam-devpath-row-title">' + esc(title) +

                (isCur ? ' <span class="dam-devpath-pill">aktywne</span>' : "") +

              "</p>" +

              '<p class="dam-devpath-row-sub">' + esc(d.hostname || "") +

                (d.hostname && d.device_id ? " · " : "") +

                esc(d.device_id || "") +

              "</p>" +

              '<p class="dam-devpath-row-path"><code>' + esc(d.base_path || "—") + "</code></p>" +

            "</div>" +

            '<div class="dam-devpath-actions">' +

              '<button type="button" class="dam-welcome-link dam-devpath-edit" data-device="' +

                esc(d.device_id) + '"><i class="uil uil-edit" aria-hidden="true"></i> Edytuj</button>' +

              '<button type="button" class="dam-welcome-link dam-devpath-del" data-device="' +

                esc(d.device_id) + '" title="Przytrzymaj, aby usunac">' +

                '<i class="uil uil-trash-alt" aria-hidden="true"></i> Usun</button>' +

            "</div>" +

          "</div>"

        );

      }).join("");



      listEl.querySelectorAll(".dam-devpath-edit").forEach(function (btn) {

        btn.addEventListener("click", function () {

          var id = btn.getAttribute("data-device");

          var row = devices.filter(function (x) { return x.device_id === id; })[0];

          if (row) openForm(row);

        });

      });

      listEl.querySelectorAll(".dam-devpath-del").forEach(function (btn) {

        bindDeleteButton(btn, btn.getAttribute("data-device"), current);

      });

    }



    function reload() {

      if (!global.DamPaths || !DamPaths.fetchUserDevicePaths) {

        document.getElementById("damDevPathList").innerHTML =

          '<p class="dam-devpath-empty">DamPaths niedostepne - odswiez strone.</p>';

        return;

      }

      DamPaths.fetchUserDevicePaths().then(function (data) {

        if (!data || !data.ok) {

          document.getElementById("damDevPathCurrent").innerHTML =

            '<span class="dam-devpath-pill is-missing">Wymagane logowanie</span>' +

            '<span class="dam-devpath-meta">Zaloguj sie, aby zarzadzac sciezkami urzadzen w bazie.</span>';

          document.getElementById("damDevPathList").innerHTML = "";

          return;

        }

        render(data);

      });

    }



    function startAdd() {

      var prefill = {

        device_id: (global.DamPaths && DamPaths.currentDeviceId && DamPaths.currentDeviceId()) || "",

        hostname: "",

        base_path: (global.DamPaths && DamPaths.getBasePath && DamPaths.getBasePath()) || "",

        label: ""

      };

      if (global.DamApi && typeof DamApi.fetchIdentity === "function") {

        DamApi.fetchIdentity().then(function (ident) {

          if (ident) {

            prefill.device_id = ident.device_id || prefill.device_id;

            prefill.hostname = ident.hostname || "";

          }

          openForm(prefill);

        }).catch(function () { openForm(prefill); });

      } else {

        openForm(prefill);

      }

    }



    var addBtn = document.getElementById("damDevPathAddBtn");

    if (addBtn) addBtn.addEventListener("click", startAdd);

    if (addBar) addBar.addEventListener("click", startAdd);



    document.getElementById("damDevPathCancel").addEventListener("click", closeForm);



    document.getElementById("damDevPathFolder").addEventListener("click", function () {

      if (!global.DamPaths || !DamPaths.pickFolder) {

        setMsg("Wybor folderu niedostepny - wpisz sciezke lub uruchom most.", false);

        return;

      }

      var input = document.getElementById("damDevPathBase");

      var start = (input && input.value) || (DamPaths.getBasePath && DamPaths.getBasePath()) || "";

      setMsg("Otwieram Eksplorator Windows...", true);

      DamPaths.pickFolder(start).then(function (res) {

        if (!res || res.cancelled) {

          setMsg("", true);

          return;

        }

        if (!res.ok || !res.path) {

          setMsg(res.error || "Nie wybrano folderu.", false);

          return;

        }

        applyNormalizedPath(input, res.picked || res.path, res.path, setMsg);

      });

    });



    document.getElementById("damDevPathDetect").addEventListener("click", function () {

      if (!global.DamPaths || !DamPaths.detectMarketingBasesRemote) return;

      setMsg("Szukam na tym komputerze...", true);

      DamPaths.detectMarketingBasesRemote().then(function (res) {

        if (res && res.recommended) {

          var rec = res.recommended;

          if (DamPaths.normalizeMarketingRoot) {

            rec = DamPaths.normalizeMarketingRoot(rec) || rec;

          }

          document.getElementById("damDevPathBase").value = rec;

          setMsg("Podpowiedz: " + rec + " (jeszcze nie zapisane)", true);

        } else {

          setMsg("Nie znaleziono automatycznie - uzyj Folder albo wpisz sciezke.", false);

        }

      }).catch(function () {

        setMsg("Most offline - uzyj Folder albo wpisz sciezke.", false);

      });

    });



    document.getElementById("damDevPathTest").addEventListener("click", function () {

      var raw = (document.getElementById("damDevPathBase").value || "").trim();

      if (!raw) {

        setMsg("Wskaz najpierw folder Marketing (przycisk Folder).", false);

        return;

      }

      if (!global.DamPaths || !DamPaths.validateBaseRemote) {

        setMsg("Walidacja niedostepna offline.", false);

        return;

      }

      var norm = DamPaths.normalizeMarketingRoot ? DamPaths.normalizeMarketingRoot(raw) : raw;

      if (norm && norm !== raw) {

        document.getElementById("damDevPathBase").value = norm;

        raw = norm;

      }

      setMsg("Sprawdzam foldery...", true);

      DamPaths.validateBaseRemote(raw).then(function (res) {

        if (res && res.ok) {

          setMsg("OK - ta sciezka zawiera ARCHIWUM / EKSPORT / POLSKA.", true);

        } else if (res && res.missing && res.missing.length) {

          setMsg("Brakuje folderow: " + res.missing.join(", "), false);

        } else {

          setMsg((res && res.error) || "Nie mozna sprawdzic - most offline.", false);

        }

      }).catch(function () {

        setMsg("Nie mozna sprawdzic - most offline (port 8766).", false);

      });

    });



    document.getElementById("damDevPathSave").addEventListener("click", function () {

      var deviceId = (document.getElementById("damDevPathDeviceId").value || "").trim();

      var hostname = (document.getElementById("damDevPathHostname").value || "").trim();

      var label = (document.getElementById("damDevPathLabel").value || "").trim();

      var base = (document.getElementById("damDevPathBase").value || "").trim();

      if (!deviceId) {

        setMsg("Podaj device_id (dla tego PC uzupelni sie automatycznie).", false);

        return;

      }

      if (!base) {

        setMsg("Wskaz folder Marketing (przycisk Folder).", false);

        return;

      }

      if (global.DamPaths && DamPaths.normalizeMarketingRoot) {

        var norm = DamPaths.normalizeMarketingRoot(base);

        if (norm && norm !== base) {

          document.getElementById("damDevPathBase").value = norm;

          base = norm;

          setMsg("Znormalizowano do rootu: " + base, true);

        }

      }

      if (!global.DamPaths || !DamPaths.upsertUserDevicePath) {

        setMsg("DamPaths niedostepne.", false);

        return;

      }

      setMsg("Zapisuje...", true);

      DamPaths.upsertUserDevicePath({

        device_id: deviceId,

        hostname: hostname,

        label: label,

        base_path: base

      }).then(function (res) {

        if (!res || !res.ok) {

          setMsg((res && res.error) || "Blad zapisu", false);

          return;

        }

        var saved = (res.entry && res.entry.base_path) || base;

        if (DamPaths.normalizeMarketingRoot) {

          saved = DamPaths.normalizeMarketingRoot(saved) || saved;

        }

        var cur = DamPaths.currentDeviceId && DamPaths.currentDeviceId();

        if (cur && cur === deviceId && DamPaths.setBasePath) {

          DamPaths.setBasePath(saved, { device_id: deviceId, hostname: hostname, label: label });

        }

        syncLegacySettingsField(saved);

        setMsg("Zapisano.", true);

        toast("Zapisano sciezke urzadzenia");

        closeForm();

        reload();

      }).catch(function () {

        setMsg("Bridge offline lub brak sesji.", false);

      });

    });



    reload();

  }



  function focusSection() {

    var host =

      document.getElementById("damDevicePathsRoot") ||

      document.getElementById("damDisk");

    if (!host) return;

    try {

      host.scrollIntoView({ behavior: "smooth", block: "start" });

    } catch (e) {

      host.scrollIntoView(true);

    }

    host.classList.add("dam-device-paths--focus");

    window.setTimeout(function () {

      host.classList.remove("dam-device-paths--focus");

    }, 2200);

  }



  function ensureFocusStyle() {

    if (document.getElementById("damDevicePathsFocusStyle")) return;

    var s = document.createElement("style");

    s.id = "damDevicePathsFocusStyle";

    s.textContent =

      "#damDevicePathsRoot.dam-device-paths--focus," +

      "#damDisk.dam-device-paths--focus{" +

      "outline:2px solid rgba(171,84,219,0.55);outline-offset:6px;" +

      "border-radius:12px;transition:outline-color .3s ease}";

    document.head.appendChild(s);

  }



  function boot() {

    var host = document.getElementById("damDevicePathsRoot");

    if (host) mount(host);

    ensureFocusStyle();

    var hash = (location.hash || "").replace(/^#/, "");

    if (hash === "damDevicePathsRoot" || hash === "damDisk") {

      window.setTimeout(focusSection, 80);

    }

    window.addEventListener("hashchange", function () {

      var h = (location.hash || "").replace(/^#/, "");

      if (h === "damDevicePathsRoot" || h === "damDisk") {

        focusSection();

      }

    });

  }



  global.DamDevicePaths = { mount: mount, boot: boot, focusSection: focusSection };



  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", boot);

  } else {

    boot();

  }

})(window);


