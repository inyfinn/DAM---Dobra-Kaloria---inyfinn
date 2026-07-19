/**
 * Wiadomości - inbox + zgłoszenia DAM + moderacja admina (historia w tym samym miejscu).
 * Moderacja NIE jest w Ustawieniach - tylko tutaj (role=admin).
 */
(function () {
  "use strict";

  var activeTag = "all";
  var zgloszenieSub = "typy"; /* typy | wizualizacja | historia */
  var unreadOnly = false;
  var query = "";
  var allItems = [];
  var expanded = {};
  var filterStack = [];
  var changeLogMeta = { can_undo: false, can_redo: false, last_proposal_id: "" };
  var NONE_CODE = "NONE";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bridgeUrl() {
    return (
      (window.DamPaths && window.DamPaths.bridgeUrl && window.DamPaths.bridgeUrl()) ||
      "http://127.0.0.1:8766"
    );
  }

  function authHeaders() {
    return (
      (window.DamApi && typeof window.DamApi.authHeaders === "function" && window.DamApi.authHeaders()) || {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
      }
    );
  }

  function role() {
    return String(
      (window.DamApi && window.DamApi.role && window.DamApi.role()) ||
        localStorage.getItem("dam_role") ||
        "user"
    ).toLowerCase();
  }

  function isAdmin() {
    return role() === "admin";
  }

  function fmtDate(s) {
    if (!s) return "";
    return String(s).replace("T", " ").slice(0, 16);
  }

  function tagPill(t) {
    var key = String(t || "").toLowerCase();
    var cls = "dam-viz-badge dam-viz-badge--meta";
    if (key === "historia") cls = "dam-viz-badge dam-viz-badge--index";
    if (key === "propozycja" || key === "moderacja") cls = "dam-viz-badge dam-viz-badge--carrier";
    if (key === "zgloszenie" || key === "tag") cls = "dam-viz-badge dam-viz-badge--subcat";
    return '<span class="' + cls + ' dam-inbox-foot-tag">' + esc(t) + "</span>";
  }

  function shortActor(s) {
    var v = String(s || "").trim();
    if (!v) return "";
    if (v.indexOf("@") > 0) return v.split("@")[0];
    return v;
  }

  function actorFootHtml(it) {
    var who = "";
    var label = "";
    if (it.decided_by) {
      who = shortActor(it.decided_by);
      var st = String(it.status || "");
      if (st === "rejected") label = "Odrzucił";
      else if (st === "approved" || st === "approve_failed") label = "Zatwierdził";
      else label = "Zmoderował";
    } else if (it.submitted_by || it.requested_by) {
      who = shortActor(it.submitted_by || it.requested_by);
      label = "Zgłosił";
    }
    if (!who) return "";
    return (
      '<span class="dam-inbox-item__actor" title="' +
      esc((it.decided_by || it.submitted_by || it.requested_by || "") + "") +
      '">' +
      esc(label) +
      ": <strong>" +
      esc(who) +
      "</strong></span>"
    );
  }

  function humanCarrierForLog(code) {
    if (!code) return "?";
    if (window.DamLabels && typeof window.DamLabels.carrierLabel === "function") {
      return window.DamLabels.carrierLabel(code, code) || String(code);
    }
    return String(code);
  }

  function formatChangeLogEntry(entry) {
    if (!entry) return "Brak historii zmian";
    var ts = String(entry.ts || "").replace("T", " ").slice(0, 16);
    var cat = String(entry.category || entry.action || "");
    var label = "";
    if (entry.action === "rename_index" || cat === "index") {
      label = "Indeks: " + (entry.index_from || "?") + " -> " + (entry.index_to || "?");
    } else if (entry.carrier_from || entry.carrier_to) {
      // UI: pelne nazwy; w JSON zostaje kod/skrot (API + dysk)
      label =
        "Typ: " +
        humanCarrierForLog(entry.carrier_from) +
        " -> " +
        humanCarrierForLog(entry.carrier_to);
    } else {
      label = cat || "Zmiana";
    }
    return label + (ts ? " · " + ts : "");
  }

  function sourceIcon(tags, type) {
    var t = tags || [];
    if (type === "tag_proposal" || t.indexOf("moderacja") !== -1) return "uil-file-edit-alt";
    if (t.indexOf("asana") !== -1) return "uil-check-square";
    if (t.indexOf("teams") !== -1) return "uil-comment-alt-dots";
    if (t.indexOf("mail") !== -1) return "uil-envelope";
    if (t.indexOf("wizualizacja") !== -1) return "uil-image";
    if (t.indexOf("powiadomienie") !== -1) return "uil-bell";
    return "uil-message";
  }

  function isZgloszenie(it) {
    var tags = it.tags || [];
    var type = String(it.type || "");
    if (type === "lifecycle_history" || tags.indexOf("lifecycle") !== -1) return true;
    if (type.indexOf("tag_proposal") === 0 || type === "viz_request") return true;
    return (
      tags.indexOf("moderacja") !== -1 ||
      tags.indexOf("propozycja") !== -1 ||
      tags.indexOf("zgloszenie") !== -1 ||
      tags.indexOf("wizualizacja") !== -1 ||
      tags.indexOf("historia") !== -1
    );
  }

  function isHistoria(it) {
    if (it && it.type === "lifecycle_history") return true;
    var tags = it && it.tags ? it.tags : [];
    if (tags.indexOf("lifecycle") !== -1) return true;
    var st = String(it.status || it.proposal_status || "");
    return (
      st === "approved" ||
      st === "rejected" ||
      st === "approve_failed" ||
      st === "auto_applied" ||
      st === "awaiting_admin" ||
      st === "undone" ||
      !!(it.decided_at || it.decided_by || it.undone_at)
    );
  }

  function lifecycleLetterLabel(letter, status) {
    var lit = String(letter || "").toUpperCase();
    if (lit === "F" || lit === "X" || lit === "D") return lit;
    var s = String(status || "").toLowerCase();
    if (s === "aktualne") return "F";
    if (s === "nieaktualne") return "X";
    if (s === "demo") return "D";
    if (s === "clear" || !s) return "bez statusu";
    return s;
  }

  function loadLifecycleHistoryAsInbox() {
    return fetch("data/lifecycle-status.json?_=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : { history: [] };
      })
      .then(function (d) {
        var hist = (d && d.history) || [];
        return hist
          .slice()
          .reverse()
          .slice(0, 200)
          .map(function (h) {
            var letter = lifecycleLetterLabel(h.letter, h.status);
            var scope = h.scope === "product" ? "produkt" : h.scope === "variant" ? "wariant" : h.scope || "status";
            var idx = h.revision_index || "";
            var pid = h.product_id || "";
            var title =
              "Lifecycle " +
              letter +
              " · " +
              scope +
              (idx ? " · " + idx : "") +
              (pid ? " · " + pid : "");
            return {
              id: h.id || "lc_" + (h.ts || Math.random()),
              type: "lifecycle_history",
              title: title,
              body:
                (h.actor ? "Autor: " + h.actor + ". " : "") +
                (h.path || h.product_path || "") +
                (h.notes && h.notes.length ? " · " + h.notes.join(", ") : ""),
              status: "approved",
              decided_at: h.ts || "",
              decided_by: h.actor || "",
              created_at: h.ts || "",
              product_id: pid,
              path: h.path || h.product_path || "",
              revision_index: idx,
              tags: ["historia", "lifecycle", scope],
              read: true,
              source: "lifecycle",
            };
          });
      })
      .catch(function () {
        return [];
      });
  }

  function undoGraceActive(it) {
    if (String(it.status || "") !== "undone") return false;
    var raw = String(it.undo_grace_until || "");
    if (!raw) return false;
    var t = Date.parse(raw);
    return !isNaN(t) && t > Date.now();
  }

  function isPendingMod(it) {
    return it.type === "tag_proposal" && String(it.status || "pending") === "pending";
  }

  function isTypeProposal(it) {
    return it.type === "tag_proposal" || (it.tags || []).indexOf("propozycja") !== -1;
  }

  function isVizZgloszenie(it) {
    if (it.type === "tag_proposal") return false;
    if (it.type === "viz_request") return true;
    return (it.tags || []).indexOf("wizualizacja") !== -1;
  }

  function matchesZgloszenieSub(it, sub) {
    if (!isZgloszenie(it)) return false;
    if (sub === "historia") return isHistoria(it);
    if (isHistoria(it)) return false;
    if (sub === "wizualizacja") return isVizZgloszenie(it);
    return isTypeProposal(it) || (!isVizZgloszenie(it) && isPendingMod(it));
  }

  function matchesTag(it, tag) {
    if (tag === "all") return true;
    if (tag === "zgloszenie") return matchesZgloszenieSub(it, zgloszenieSub);
    if (tag === "historia") {
      /* legacy deep-link ?tag=historia */
      return isHistoria(it) && isZgloszenie(it);
    }
    return (it.tags || []).indexOf(tag) !== -1;
  }

  function syncZgloszenieChrome() {
    var tabs = document.getElementById("inboxZgloszenieTabs");
    var histBar = document.getElementById("inboxHistBar");
    var showTabs = activeTag === "zgloszenie" || activeTag === "historia";
    if (tabs) tabs.hidden = !showTabs;
    if (histBar) {
      histBar.hidden = !(showTabs && zgloszenieSub === "historia");
    }
    document.querySelectorAll("[data-zgloszenie-sub]").forEach(function (b) {
      var sub = b.getAttribute("data-zgloszenie-sub") || "";
      var on = sub === zgloszenieSub;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    var undoBtn = document.getElementById("inboxUndoLast");
    var redoBtn = document.getElementById("inboxRedoLast");
    if (undoBtn) undoBtn.disabled = !changeLogMeta.can_undo;
    if (redoBtn) redoBtn.disabled = !changeLogMeta.can_redo;
  }

  function pushFilter(next) {
    if (next === activeTag) return;
    filterStack.push(activeTag);
    if (filterStack.length > 20) filterStack.shift();
    activeTag = next;
  }

  function popFilter() {
    if (!filterStack.length) return false;
    activeTag = filterStack.pop();
    document.querySelectorAll(".dam-inbox-tag[data-tag]").forEach(function (b) {
      b.classList.toggle("is-active", (b.getAttribute("data-tag") || "") === activeTag);
    });
    render();
    return true;
  }

  function filtered() {
    var q = query.trim().toLowerCase();
    return allItems.filter(function (it) {
      if (!matchesTag(it, activeTag)) return false;
      if (unreadOnly && it.read !== false) return false;
      if (!q) return true;
      var hay = (
        (it.title || "") +
        " " +
        (it.detail || "") +
        " " +
        (it.preview || "") +
        " " +
        (it.tags || []).join(" ")
      ).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function updateCounts() {
    var counts = {
      all: allItems.length,
      zgloszenie: 0,
      zgloszenie_typy: 0,
      zgloszenie_wiz: 0,
      zgloszenie_historia: 0,
      historia: 0,
    };
    var reserved = {
      zgloszenie: 1,
      historia: 1,
      zgloszenie_typy: 1,
      zgloszenie_wiz: 1,
      zgloszenie_historia: 1,
    };
    allItems.forEach(function (it) {
      if (isZgloszenie(it) && !isHistoria(it)) counts.zgloszenie += 1;
      if (matchesZgloszenieSub(it, "typy")) counts.zgloszenie_typy += 1;
      if (matchesZgloszenieSub(it, "wizualizacja")) counts.zgloszenie_wiz += 1;
      if (matchesZgloszenieSub(it, "historia")) {
        counts.zgloszenie_historia += 1;
        counts.historia += 1;
      }
      (it.tags || []).forEach(function (t) {
        if (reserved[t]) return;
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    document.querySelectorAll("[data-count-for]").forEach(function (el) {
      var key = el.getAttribute("data-count-for");
      el.textContent = String(counts[key] || 0);
    });
    syncZgloszenieChrome();
    var stats = document.getElementById("inboxStats");
    if (stats) {
      var unread = allItems.filter(function (it) {
        return it.read === false;
      }).length;
      var pending = allItems.filter(isPendingMod).length;
      var subLabel =
        activeTag === "zgloszenie" || activeTag === "historia"
          ? zgloszenieSub === "typy"
            ? "propozycje typów"
            : zgloszenieSub === "wizualizacja"
              ? "wizualizacje"
              : "historia"
          : "";
      stats.textContent =
        filtered().length +
        " z " +
        allItems.length +
        (subLabel ? " · " + subLabel : "") +
        " · nieprzeczytane: " +
        unread +
        (isAdmin() ? " · do decyzji: " + pending : "");
    }
    try {
      var n = allItems.filter(isPendingMod).length;
      localStorage.setItem("dam_pending_moderation", String(n));
      var badge = document.getElementById("damMsgBadge");
      if (badge && n > 0) {
        badge.hidden = false;
        badge.textContent = String(n > 99 ? "99+" : n);
      }
    } catch (e) {
      /* ignore */
    }
  }

  function markRead(id) {
    if (!id || String(id).indexOf("asana-") === 0 || String(id).indexOf("prop_") === 0) {
      return Promise.resolve();
    }
    return fetch(bridgeUrl() + "/inbox-items/mark-read", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: id }),
    }).catch(function () {
      return null;
    });
  }

  function showToast(msg) {
    var el = document.getElementById("damInboxToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damInboxToast";
      el.className = "dam-explorer-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 2800);
  }

  var _carrierTypesCache = null;

  function carrierTypesOptions() {
    var out = {};
    try {
      var naming = (window.DamNaming && window.DamNaming.carriers) || {};
      Object.keys(naming).forEach(function (c) {
        out[c] = naming[c].label_pl || naming[c].label || c;
      });
    } catch (e) {
      /* ignore */
    }
    try {
      var custom = _carrierTypesCache || JSON.parse(localStorage.getItem("dam_carrier_types_cache") || "null");
      if (custom && custom.custom_types) {
        Object.keys(custom.custom_types).forEach(function (c) {
          out[c] = custom.custom_types[c].label_pl || custom.custom_types[c].label || c;
        });
      }
    } catch (e2) {
      /* ignore */
    }
    return out;
  }

  function refreshCarrierTypes() {
    return fetch(bridgeUrl() + "/carrier-types", { headers: authHeaders() })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        _carrierTypesCache = data;
        try {
          localStorage.setItem("dam_carrier_types_cache", JSON.stringify(data));
        } catch (e) {
          /* ignore */
        }
        return data;
      })
      .catch(function () {
        return null;
      });
  }

  function decideProposal(proposalId, decision, newValue) {
    return fetch(bridgeUrl() + "/tag-proposals/decide", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        proposal_id: proposalId,
        decision: decision,
        new_value: newValue || "",
      }),
    }).then(function (r) {
      return r.json();
    });
  }

  function reopenProposal(proposalId) {
    return fetch(bridgeUrl() + "/tag-proposals/reopen", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ proposal_id: proposalId }),
    }).then(function (r) {
      return r.json();
    });
  }

  function undoProposal(proposalId) {
    return fetch(bridgeUrl() + "/tag-proposals/undo", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ proposal_id: proposalId }),
    }).then(function (r) {
      return r.json();
    });
  }

  function cancelUndoProposal(proposalId) {
    return fetch(bridgeUrl() + "/tag-proposals/cancel-undo", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ proposal_id: proposalId }),
    }).then(function (r) {
      return r.json();
    });
  }

  function formatTimelineHtml(res) {
    var lines = [];
    var disk = res.current_disk || {};
    if (disk.kind === "missing") {
      lines.push(
        "<strong>Dysk:</strong> sciezka nie istnieje" +
          (disk.path ? " (" + esc(disk.path) + ")" : "") +
          ". Mozliwe usuniecie lub przeniesienie poza logi DAM."
      );
    }
    (res.timeline || []).forEach(function (row) {
      var ts = String(row.ts || "").replace("T", " ").slice(0, 16);
      var mark = row.is_this ? " [ta zmiana]" : row.is_after ? " [pozniej]" : "";
      var miss =
        row.disk && row.disk.kind === "missing" ? " · BRAK NA DYSKU" : "";
      lines.push(
        "<li><code>" +
          esc(ts) +
          "</code> · " +
          esc(row.actor || "?") +
          " · " +
          esc(row.summary || row.action || "zmiana") +
          esc(mark) +
          esc(miss) +
          "</li>"
      );
    });
    (res.audit || []).slice(0, 6).forEach(function (a) {
      var ts = String(a.ts || "").replace("T", " ").slice(0, 16);
      lines.push(
        "<li class=\"is-audit\"><code>" +
          esc(ts) +
          "</code> · audit · " +
          esc(a.actor || "?") +
          " · " +
          esc(a.action || "") +
          (a.detail ? " (" + esc(a.detail) + ")" : "") +
          "</li>"
      );
    });
    if (!lines.length) {
      return "<p class=\"dam-inbox-timeline__empty\">Brak dalszych wpisow w change-log dla tej sciezki.</p>";
    }
    return "<ul class=\"dam-inbox-timeline__list\">" + lines.join("") + "</ul>";
  }

  function showUndoConflict(res) {
    var hint = (res && (res.hint || res.error)) || "Nie mozna cofnac zmiany.";
    showToast(hint);
    var host = document.getElementById("inboxHistConflict");
    if (!host) {
      var bar = document.getElementById("inboxHistBar");
      if (!bar) return;
      host = document.createElement("div");
      host.id = "inboxHistConflict";
      host.className = "dam-inbox-hist-conflict";
      bar.appendChild(host);
    }
    host.hidden = false;
    host.innerHTML =
      '<div class="dam-inbox-hist-conflict__head">' +
      '<strong>Przebieg zmian</strong>' +
      '<button type="button" class="dam-inbox-hist-conflict__close" data-close-conflict aria-label="Zamknij">×</button>' +
      "</div>" +
      '<p class="dam-inbox-hist-conflict__hint">' +
      esc(hint) +
      "</p>" +
      formatTimelineHtml(res || {}) +
      ((res.redo_available || []).length
        ? '<p class="dam-inbox-hist-conflict__redo">Ostatnio wycofane: ' +
          esc(
            (res.redo_available || [])
              .map(function (r) {
                return (r.summary || r.id) + " (" + (r.actor || "?") + ")";
              })
              .join("; ")
          ) +
          ". Uzyj <strong>Ponow</strong> na pasku.</p>"
        : "");
    var close = host.querySelector("[data-close-conflict]");
    if (close) {
      close.addEventListener("click", function () {
        host.hidden = true;
        host.innerHTML = "";
      });
    }
  }

  function refreshChangeLogMeta() {
    return fetch(bridgeUrl() + "/change-log", { headers: authHeaders() })
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .catch(function () {
        return {};
      })
      .then(function (d) {
        var entries = d.entries || [];
        var redo = d.redo || [];
        var last = entries.length ? entries[entries.length - 1] : null;
        var lastRedo = redo.length ? redo[redo.length - 1] : null;
        changeLogMeta = {
          can_undo: !!d.can_undo,
          can_redo: !!d.can_redo,
          last_proposal_id: (last && last.proposal_id) || "",
          redo_count: redo.length,
          last_redo_summary: lastRedo
            ? (lastRedo.folder_rename &&
                lastRedo.folder_rename.old_path &&
                lastRedo.folder_rename.new_path
                  ? "wycofana zmiana"
                  : lastRedo.action) || "wycofana zmiana"
            : "",
        };
        syncZgloszenieChrome();
        return changeLogMeta;
      });
  }

  function postChangeLog(path) {
    return fetch(bridgeUrl() + path, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    }).then(function (r) {
      return r.json();
    });
  }

  function proposedLabel(v) {
    return v === NONE_CODE ? "BRAK TYPU" : v || "?";
  }

  function typeChangeLabel(it) {
    return (it.current_value || "?") + " → " + proposedLabel(it.proposed_value);
  }

  function navCirclesHtml(opts) {
    opts = opts || {};
    var pid = opts.productId || "";
    var path = opts.path || "";
    var winIcon =
      window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';
    var explorerHref = pid
      ? "explorer.html?product=" + encodeURIComponent(pid)
      : "explorer.html";
    var vizHref = pid
      ? "visualizations.html?product=" + encodeURIComponent(pid)
      : "visualizations.html";
    var goDisabled = !pid ? " is-disabled" : "";
    var winDisabled = !path ? " is-disabled" : "";
    return (
      '<div class="dam-nav-circles dam-nav-circles--row" onclick="event.stopPropagation()">' +
      '<a class="dam-viz-icon-btn dam-viz-icon-btn--explorer' +
      goDisabled +
      '" href="' +
      esc(explorerHref) +
      '" title="Przejdź do Eksplorera" aria-label="Przejdź do Eksplorera" data-dam-tip="Otwórz produkt w Eksplorerze">' +
      '<i class="uil uil-sitemap" aria-hidden="true"></i></a>' +
      '<button type="button" class="dam-viz-icon-btn dam-win-btn' +
      winDisabled +
      '" data-path="' +
      esc(path) +
      '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwiera folder w Eksploratorze plików Windows"' +
      (!path ? " disabled" : "") +
      ">" +
      winIcon +
      "</button>" +
      '<a class="dam-viz-icon-btn dam-viz-icon-btn--viz" href="' +
      esc(vizHref) +
      '" title="Wizualizacje" aria-label="Wizualizacje" data-dam-tip="Otwórz wizualizacje produktu" data-dam-action="open-viz">' +
      '<i class="uil uil-image" aria-hidden="true"></i></a>' +
      "</div>"
    );
  }

  function proposalBadgesHtml(it) {
    if (!(window.DamBadges && typeof window.DamBadges.render === "function")) {
      var bits = [];
      if (it.product_index) {
        bits.push(
          '<span class="dam-viz-badge dam-viz-badge--index">' + esc(it.product_index) + "</span>"
        );
      }
      if (it.brand) {
        bits.push(
          '<span class="dam-viz-badge dam-viz-badge--brand">' + esc(it.brand) + "</span>"
        );
      }
      if (it.current_value || it.proposed_value) {
        bits.push(
          '<span class="dam-viz-badge dam-viz-badge--carrier">' +
            esc(typeChangeLabel(it)) +
            "</span>"
        );
      }
      return bits.length
        ? '<div class="dam-inbox-item__product-badges">' + bits.join("") + "</div>"
        : "";
    }
    var carrierLbl =
      window.DamLabels && typeof window.DamLabels.carrierLabel === "function"
        ? window.DamLabels.carrierLabel(it.carrier || it.proposed_value || it.current_value, "", {
            productName: it.product_name,
            tags: it.product_tags,
          })
        : it.carrier || it.proposed_value || it.current_value || "";
    return (
      '<div class="dam-inbox-item__product-badges">' +
      window.DamBadges.render({
        brand: it.brand || "",
        category: it.category || "",
        subcategory: it.subcategory_slug || "",
        subcategoryLabel: it.subcategory_label || "",
        carrier: it.carrier || it.proposed_value || it.current_value || "",
        carrierLabel: carrierLbl,
        langs: it.langs || [],
        index: "",
        productName: it.product_name || "",
        productId: it.product_id || "",
        tags: it.product_tags || [],
        compact: true,
        maxPerKind: 2,
        maxTotal: 6,
        showCarrierPlaceholder: false,
      }) +
      "</div>"
    );
  }

  function productActionsHtml(pid, path) {
    var winIcon =
      window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';
    var explorerHref = pid
      ? "explorer.html?product=" + encodeURIComponent(pid)
      : "explorer.html";
    var goDisabled = !pid ? " is-disabled" : "";
    var winDisabled = !path ? " is-disabled" : "";
    return (
      '<div class="dam-inbox-item__product-actions" onclick="event.stopPropagation()">' +
      '<a class="geex-btn dam-btn-icon dam-project-go-btn' +
      goDisabled +
      '" href="' +
      esc(explorerHref) +
      '" title="Przejdź" data-dam-tip="Otwórz produkt w Eksplorerze"' +
      (!pid ? ' aria-disabled="true" tabindex="-1"' : "") +
      ">" +
      '<i class="uil uil-sitemap" aria-hidden="true"></i><span>Przejdź</span></a>' +
      '<button type="button" class="geex-btn dam-btn-icon dam-btn-icon-only dam-project-win-btn dam-win-btn' +
      winDisabled +
      '" data-path="' +
      esc(path) +
      '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwiera folder w Eksploratorze plików Windows"' +
      (!path ? " disabled" : "") +
      ">" +
      winIcon +
      "</button>" +
      "</div>"
    );
  }

  function changeChipHtml(it) {
    if (it.type !== "tag_proposal") return "";
    return (
      '<div class="dam-inbox-item__change" title="Proponowana zmiana typu">' +
      '<span class="dam-inbox-item__change-from">' +
      esc(it.current_value || "?") +
      "</span>" +
      '<i class="uil uil-arrow-right" aria-hidden="true"></i>' +
      '<span class="dam-inbox-item__change-to">' +
      esc(proposedLabel(it.proposed_value)) +
      "</span></div>"
    );
  }

  function productContextHtml(it, opts) {
    if (it.type !== "tag_proposal") return "";
    opts = opts || {};
    var expanded = !!opts.expanded;
    var name = it.product_name || it.product_id || "Produkt bez nazwy";
    var pid = it.product_id || "";
    var path =
      window.DamPaths && typeof window.DamPaths.resolveWinFolderPath === "function"
        ? window.DamPaths.resolveWinFolderPath(it)
        : it.path || it.revision_path || "";
    var title = String(it.title || "");
    var nameRedundant =
      title.indexOf(name) === 0 ||
      title === name ||
      title.indexOf(name + " ·") === 0;
    var indexHtml = it.product_index
      ? '<button type="button" class="dam-viz-badge dam-badge-tag dam-viz-badge--index" data-tag-kind="index" data-tag-value="' +
        esc(it.product_index) +
        '" data-dam-tip="Indeks produktu" title="Indeks produktu">' +
        esc(it.product_index) +
        "</button>"
      : "";
    var nameHtml =
      !expanded && nameRedundant
        ? ""
        : pid
          ? '<a class="dam-inbox-item__product-name" href="explorer.html?product=' +
            encodeURIComponent(pid) +
            '" onclick="event.stopPropagation()" title="Otwórz w Eksplorerze" data-dam-tip="Eksplorer - hub plików produktu">' +
            esc(name) +
            "</a>"
          : '<span class="dam-inbox-item__product-name">' + esc(name) + "</span>";
    var changeChip = changeChipHtml(it);
    var metaBits =
      (indexHtml ? '<div class="dam-inbox-item__product-index">' + indexHtml + "</div>" : "") +
      (expanded ? proposalBadgesHtml(it) : "");
    if (!expanded) {
      /* Collapsed: change + nav + date żyją w .dam-inbox-item__row-end */
      return "";
    }
    return (
      '<div class="dam-inbox-item__product is-expanded">' +
      '<div class="dam-inbox-item__product-body">' +
      (nameHtml
        ? '<div class="dam-inbox-item__product-head">' + nameHtml + "</div>"
        : "") +
      (metaBits
        ? '<div class="dam-inbox-item__product-meta">' + metaBits + "</div>"
        : "") +
      "</div>" +
      '<div class="dam-inbox-item__product-end" onclick="event.stopPropagation()">' +
      changeChip +
      navCirclesHtml({ productId: pid, path: path }) +
      "</div></div>"
    );
  }

  function historyActionsHtml(it) {
    if (!isAdmin() || it.type !== "tag_proposal" || !isHistoria(it)) return "";
    var st = String(it.status || "");
    var canUndoDisk = st === "approved" || st === "approve_failed";
    var inGrace = undoGraceActive(it);
    var canReopen =
      st === "rejected" ||
      st === "awaiting_admin" ||
      (st === "undone" && !inGrace);
    var isLast = changeLogMeta.last_proposal_id && changeLogMeta.last_proposal_id === it.id;
    var bits = [];
    if (canUndoDisk) {
      bits.push(
        '<button type="button" class="dam-inbox-hist-item__btn dam-inbox-hist-item__btn--undo" data-hist="undo" data-proposal-id="' +
          esc(it.id) +
          '" title="' +
          (isLast
            ? "Cofnij zmiane na dysku (rename). Potem 30 s na anulowanie."
            : "Dziala tylko gdy to ostatnia zmiana na dysku. Inaczej pokaze przebieg konfliktow.") +
          '">' +
          '<i class="uil uil-corner-up-left" aria-hidden="true"></i><span>Cofnij zmianę na dysku</span></button>'
      );
    }
    if (inGrace) {
      bits.push(
        '<button type="button" class="dam-inbox-hist-item__btn dam-inbox-hist-item__btn--cancel-undo" data-hist="cancel-undo" data-proposal-id="' +
          esc(it.id) +
          '" title="Anuluj cofniecie w ciagu 30 s (ponow zmiane na dysku)">' +
          '<i class="uil uil-history" aria-hidden="true"></i><span>Anuluj cofnięcie</span></button>'
      );
    }
    if (canReopen || st === "rejected") {
      bits.push(
        '<button type="button" class="dam-inbox-hist-item__btn" data-hist="reopen" data-proposal-id="' +
          esc(it.id) +
          '" title="Przywróć zgłoszenie do kolejki (bez zmian na dysku)">' +
          '<i class="uil uil-redo" aria-hidden="true"></i><span>Wróć do kolejki</span></button>'
      );
    }
    bits.push(
      '<button type="button" class="dam-inbox-hist-item__btn dam-inbox-hist-item__btn--ghost" data-hist="timeline" data-proposal-id="' +
        esc(it.id) +
        '" title="Pokaz przebieg change-log i audyt dla tej sciezki">' +
        '<i class="uil uil-list-ul" aria-hidden="true"></i><span>Przebieg zmian</span></button>'
    );
    if (!bits.length) return "";
    var note =
      st === "approved"
        ? isLast
          ? "Ostatnia zmiana na dysku - mozesz ja cofnac. Po cofnieciu masz 30 s na Anuluj cofniecie."
          : "Jesli sa nowsze zmiany, Cofnij pokaze przebieg (kto/kiedy) zamiast cichego bledu."
        : st === "rejected"
          ? "Odrzucono bez zmian na dysku. Wroc do kolejki = ponowna decyzja, nie cofniecie plikow."
          : inGrace
            ? "Wlasnie wycofano. Masz ok. 30 s na Anuluj cofniecie albo pozniej Ponow na pasku."
            : st === "undone"
              ? "Wycofane. Mozesz wrocic do kolejki albo Ponow ostatnio wycofane na pasku."
              : "Mozesz wrocic do kolejki.";
    return (
      '<div class="dam-inbox-hist-item" data-proposal-id="' +
      esc(it.id) +
      '" onclick="event.stopPropagation()">' +
      '<div class="dam-inbox-hist-item__bar" title="' +
      esc(note) +
      '">' +
      '<div class="dam-inbox-hist-item__actions">' +
      bits.join("") +
      "</div>" +
      "</div></div>"
    );
  }

  function enrichProposalFromProduct(it, prod) {
    if (!prod) return it;
    var rev = (prod.revisions && prod.revisions[0]) || null;
    if (!it.product_name) {
      it.product_name =
        (window.DamLabels && typeof window.DamLabels.cleanProductDisplayName === "function"
          ? window.DamLabels.cleanProductDisplayName(prod.display_name || prod.name)
          : null) ||
        prod.display_name ||
        prod.name ||
        "";
    }
    it.brand = it.brand || prod.brand || "";
    it.category = it.category || prod.category || "";
    it.subcategory_slug = it.subcategory_slug || prod.subcategory_slug || "";
    it.subcategory_label = it.subcategory_label || prod.subcategory_label || "";
    it.product_index =
      it.product_index ||
      (rev && rev.index) ||
      (prod.indexes && prod.indexes[0]) ||
      (prod.index_bases && prod.index_bases[0]) ||
      "";
    it.carrier = it.carrier || (rev && rev.carrier) || prod.carrier || "";
    it.langs = it.langs && it.langs.length ? it.langs : (rev && rev.langs) || [];
    if (!it.path && !it.revision_path) {
      it.path = (rev && rev.path) || prod.path || "";
      it.revision_path = it.path;
    } else if (!it.path) {
      it.path = it.revision_path;
    }
    it.product_tags = prod.tags || (rev && rev.tags) || [];
    return it;
  }

  function loadProductLookup() {
    return fetch("data/file-index.json?v=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .catch(function () {
        return {};
      })
      .then(function (data) {
        var byId = {};
        (data.products || []).forEach(function (p) {
          if (p && p.id) byId[p.id] = p;
        });
        return byId;
      });
  }

  function buildDetailHtml(it) {
    var lines = [];
    if (it.type === "tag_proposal") {
      if (it.product_name) lines.push("<strong>Produkt:</strong> " + esc(it.product_name));
      if (it.product_id) lines.push("<strong>ID produktu:</strong> " + esc(it.product_id));
      if (it.product_index) lines.push("<strong>Indeks:</strong> " + esc(it.product_index));
    } else if (it.detail) {
      lines.push(esc(it.detail).replace(/\n/g, "<br>"));
    }
    if (it.type === "tag_proposal" && it.detail && it.detail !== it.product_name) {
      lines.push(esc(it.detail).replace(/\n/g, "<br>"));
    }
    if (it.parent) lines.push("<strong>Rodzic / produkt:</strong> " + esc(it.parent));
    if (it.section) lines.push("<strong>Sekcja:</strong> " + esc(it.section));
    if (it.assignee) lines.push("<strong>Osoba:</strong> " + esc(it.assignee));
    if (it.due || it.due_on) lines.push("<strong>Termin:</strong> " + esc(it.due || it.due_on));
    if (it.proposal_id || (it.type === "tag_proposal" && it.id)) {
      lines.push("<strong>ID propozycji:</strong> " + esc(it.proposal_id || it.id));
    }
    if ((it.path || it.revision_path) && String(it.detail || "").indexOf("Ścieżka:") === -1) {
      lines.push("<strong>Ścieżka:</strong> " + esc(it.path || it.revision_path));
    }
    if (
      (it.requested_by || it.submitted_by) &&
      String(it.detail || "").toLowerCase().indexOf("zgłosił") === -1 &&
      String(it.detail || "").toLowerCase().indexOf("zglosil") === -1
    ) {
      lines.push("<strong>Zgłosił:</strong> " + esc(it.requested_by || it.submitted_by));
    }
    if (it.current_value || it.proposed_value) {
      lines.push("<strong>Zmiana typu:</strong> " + esc(typeChangeLabel(it)));
    }
    if (it.decided_by) {
      lines.push(
        "<strong>Decyzja:</strong> " +
          esc(it.status || "") +
          " · " +
          esc(it.decided_by) +
          (it.decided_at ? " · " + esc(fmtDate(it.decided_at)) : "") +
          (it.final_value ? " · wynik: " + esc(it.final_value) : "")
      );
    }
    if (it.expires_at && isPendingMod(it)) {
      lines.push(
        "<strong>Wygasa:</strong> " +
          esc(fmtDate(it.expires_at)) +
          " (potem przypomnienie w Inbox, bez auto-zapisu)"
      );
    }
    if (!lines.length) {
      return '<p class="dam-widget__meta">Brak dodatkowego opisu.</p>';
    }
    return '<div class="dam-inbox-item__detail-body">' + lines.join("<br>") + "</div>";
  }

  function moderationActionsHtml(it) {
    if (!isAdmin() || !isPendingMod(it)) return "";
    var types = carrierTypesOptions();
    var opts =
      '<option value="">Wybierz inny typ…</option><option value="' +
      NONE_CODE +
      '">BRAK TYPU</option>' +
      Object.keys(types)
        .sort()
        .map(function (c) {
          return '<option value="' + esc(c) + '">' + esc(types[c]) + "</option>";
        })
        .join("");
    return (
      '<div class="dam-inbox-mod" data-proposal-id="' +
      esc(it.id) +
      '">' +
      '<button type="button" class="dam-inbox-mod__btn dam-inbox-mod__btn--ok" data-mod="approve" title="Zatwierdź" aria-label="Zatwierdź">' +
      '<i class="uil uil-check-circle" aria-hidden="true"></i><span>Zatwierdź</span></button>' +
      '<select class="dam-inbox-mod__select" data-mod="pick" aria-label="Wybierz inny typ">' +
      opts +
      "</select>" +
      '<button type="button" class="dam-inbox-mod__btn dam-inbox-mod__btn--no" data-mod="reject" title="Odrzuć" aria-label="Odrzuć">' +
      '<i class="uil uil-times-circle" aria-hidden="true"></i><span>Odrzuć</span></button>' +
      "</div>"
    );
  }

  function bindModeration(list) {
    list.querySelectorAll(".dam-inbox-mod").forEach(function (box) {
      var pid = box.getAttribute("data-proposal-id");
      var approve = box.querySelector('[data-mod="approve"]');
      var reject = box.querySelector('[data-mod="reject"]');
      var pick = box.querySelector('[data-mod="pick"]');
      function after(res, okMsg) {
        if (!res || !res.ok) {
          showToast("Błąd: " + ((res && (res.error || res.hint)) || "nie udało się"));
          return;
        }
        showToast(okMsg);
        load();
      }
      if (approve) {
        approve.addEventListener("click", function (e) {
          e.stopPropagation();
          decideProposal(pid, "approve").then(function (res) {
            after(res, "Zatwierdzono - zapisano na dysku.");
          });
        });
      }
      if (reject) {
        reject.addEventListener("click", function (e) {
          e.stopPropagation();
          decideProposal(pid, "reject").then(function (res) {
            after(res, "Odrzucono.");
          });
        });
      }
      if (pick) {
        pick.addEventListener("change", function (e) {
          e.stopPropagation();
          if (!pick.value) return;
          decideProposal(pid, "pick_other", pick.value).then(function (res) {
            after(res, "Zastosowano inny typ: " + pick.value);
          });
        });
      }
    });
  }

  function bindHistoryActions(list) {
    list.querySelectorAll("[data-hist]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var pid = btn.getAttribute("data-proposal-id") || "";
        var act = btn.getAttribute("data-hist") || "";
        if (!pid) return;
        if (act === "timeline") {
          fetch(
            bridgeUrl() +
              "/tag-proposals/timeline?proposal_id=" +
              encodeURIComponent(pid),
            { headers: authHeaders() }
          )
            .then(function (r) {
              return r.json();
            })
            .then(function (res) {
              if (!res || !res.ok) {
                showToast("Brak przebiegu: " + ((res && res.error) || "?"));
                return;
              }
              showUndoConflict(
                Object.assign({}, res, {
                  hint: "Przebieg change-log i audyt dla tej sciezki.",
                })
              );
            });
          return;
        }
        var p =
          act === "undo"
            ? undoProposal(pid)
            : act === "cancel-undo"
              ? cancelUndoProposal(pid)
              : act === "reopen"
                ? reopenProposal(pid)
                : Promise.resolve({ ok: false, error: "unknown_action" });
        p.then(function (res) {
          if (!res || !res.ok) {
            if (
              res &&
              (res.timeline ||
                res.error === "not_last_change" ||
                res.error === "path_missing" ||
                res.error === "rejected_no_disk_change")
            ) {
              showUndoConflict(res);
              return;
            }
            showToast(
              "Błąd: " + ((res && (res.hint || res.error)) || "nie udało się")
            );
            return;
          }
          if (act === "undo") {
            showToast(
              res.disk_undo
                ? "Cofnięto na dysku. Masz 30 s na Anuluj cofnięcie."
                : res.hint || "Wycofano (bez zmiany na dysku)."
            );
            zgloszenieSub = "historia";
            var graceMs = Math.max(1, Number(res.grace_seconds) || 30) * 1000 + 400;
            setTimeout(function () {
              if (zgloszenieSub === "historia") load();
            }, graceMs);
          } else if (act === "cancel-undo") {
            showToast(res.hint || "Anulowano cofnięcie.");
            zgloszenieSub = "historia";
          } else {
            showToast("Wrócono do kolejki - możesz zdecydować ponownie.");
            zgloszenieSub = "typy";
          }
          load();
        });
      });
    });
  }

  function render() {
    var list = document.getElementById("inboxList");
    if (!list) return;
    updateCounts();
    var items = filtered();
    if (!items.length) {
      var emptyHint = "Brak wpisów dla tego filtra.";
      if (activeTag === "zgloszenie" || activeTag === "historia") {
        if (zgloszenieSub === "historia") {
          emptyHint =
            "Brak historii. Po zatwierdzeniu lub odrzuceniu propozycji typu pojawią się tutaj - z opcją cofnięcia.";
        } else if (zgloszenieSub === "wizualizacja") {
          emptyHint = "Brak zgłoszeń wizualizacji w kolejce.";
        } else {
          emptyHint = isAdmin()
            ? "Brak oczekujących propozycji typów. Nowe zgłoszenia pojawią się tutaj."
            : "Brak Twoich propozycji typów w kolejce.";
        }
      }
      list.innerHTML =
        '<li class="dam-inbox-item dam-inbox-item--empty"><div class="dam-widget__meta">' +
        emptyHint +
        "</div></li>";
      return;
    }
    list.innerHTML = items
      .map(function (it) {
        var id = it.id || "";
        var unread = it.read === false;
        var isOpen = !!expanded[id];
        var href = it.href || it.url || "";
        var preview = it.preview || it.parent || "";
        if (it.type === "tag_proposal") {
          preview =
            "Zmiana typu: " +
            typeChangeLabel(it) +
            (it.submitted_by ? " · " + it.submitted_by : "") +
            (it.product_index ? " · " + it.product_index : "");
        }
        var openBtn = href
          ? '<a class="dam-inbox-item__open" href="' +
            esc(href) +
            '" target="_blank" rel="noopener" onclick="event.stopPropagation()">Otwórz w Asanie</a>'
          : "";
        var statusChip = "";
        if (it.type === "tag_proposal" && it.status && it.status !== "pending") {
          var statusPl = {
            approved: "zatwierdzono",
            rejected: "odrzucono",
            approve_failed: "błąd zapisu",
            awaiting_admin: "do admina",
            auto_applied: "auto (legacy)",
            undone: "wycofano",
          };
          var stLabel = statusPl[it.status] || it.status;
          statusChip =
            '<span class="dam-inbox-item__status dam-inbox-item__status--' +
            esc(it.status) +
            '">' +
            esc(stLabel) +
            "</span>";
        }
        var showPreview =
          preview && !isOpen && it.type !== "tag_proposal";
        return (
          '<li class="dam-inbox-item' +
          (unread ? " is-unread" : "") +
          (isOpen ? " is-expanded" : "") +
          (isPendingMod(it) ? " dam-inbox-item--mod" : "") +
          '" data-id="' +
          esc(id) +
          '" role="button" tabindex="0" aria-expanded="' +
          (isOpen ? "true" : "false") +
          '">' +
          '<div class="dam-inbox-item__icon" aria-hidden="true"><i class="uil ' +
          sourceIcon(it.tags, it.type) +
          '"></i></div>' +
          '<div class="dam-inbox-item__body">' +
          '<div class="dam-inbox-item__row">' +
          '<div class="dam-inbox-item__row-body">' +
          "<strong>" +
          esc(it.title) +
          "</strong>" +
          (showPreview
            ? '<div class="dam-inbox-item__preview">' + esc(preview) + "</div>"
            : "") +
          "</div>" +
          '<div class="dam-inbox-item__row-end">' +
          (!isOpen &&
          it.type === "tag_proposal" &&
          String(it.title || "").indexOf("→") === -1 &&
          String(it.title || "").indexOf("->") === -1
            ? changeChipHtml(it)
            : "") +
          statusChip +
          '<span class="dam-inbox-item__date">' +
          esc(fmtDate(it.created_at || it.submitted_at || it.date || it.due)) +
          "</span>" +
          actorFootHtml(it) +
          (!isOpen && it.type === "tag_proposal"
            ? '<span class="dam-inbox-item__row-nav" onclick="event.stopPropagation()">' +
              navCirclesHtml({
                productId: it.product_id || "",
                path: it.path || it.revision_path || "",
              }) +
              "</span>"
            : "") +
          '<i class="uil ' +
          (isOpen ? "uil-angle-up" : "uil-angle-down") +
          ' dam-inbox-item__chevron" aria-hidden="true"></i>' +
          "</div></div>" +
          productContextHtml(it, { expanded: isOpen }) +
          (isHistoria(it) ? historyActionsHtml(it) : "") +
          '<div class="dam-inbox-item__detail" ' +
          (isOpen ? "" : "hidden") +
          ">" +
          (isOpen && isPendingMod(it) ? moderationActionsHtml(it) : "") +
          (isOpen ? buildDetailHtml(it) : "") +
          "</div>" +
          '<div class="dam-inbox-item__foot">' +
          '<div class="dam-inbox-item__tags">' +
          (it.tags || []).map(tagPill).join("") +
          "</div>" +
          '<div class="dam-inbox-item__foot-end">' +
          '<div class="dam-inbox-item__actions">' +
          openBtn +
          (unread && id && String(id).indexOf("asana-") !== 0 && String(id).indexOf("prop_") !== 0
            ? '<button type="button" class="dam-inbox-item__read" data-mark-read="' +
              esc(id) +
              '">Oznacz jako przeczytane</button>'
            : "") +
          "</div></div></div></div></li>"
        );
      })
      .join("");

    list.querySelectorAll(".dam-inbox-item[data-id]").forEach(function (li) {
      if (li.classList.contains("dam-inbox-item--empty")) return;
      function toggle() {
        var id = li.getAttribute("data-id") || "";
        expanded[id] = !expanded[id];
        if (expanded[id]) {
          markRead(id).then(function () {
            allItems.forEach(function (it) {
              if (it.id === id) it.read = true;
            });
            render();
          });
        } else {
          render();
        }
      }
      li.addEventListener("click", function (e) {
        if (
          e.target.closest(
            "a, button, select, .dam-inbox-mod, .dam-inbox-hist-item, .dam-inbox-item__actions, .dam-inbox-item__product-end, .dam-inbox-item__product-foot, .dam-inbox-item__row-nav, .dam-nav-circles"
          )
        ) {
          return;
        }
        toggle();
      });
      li.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });

    list.querySelectorAll("[data-mark-read]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-mark-read");
        markRead(id).then(function () {
          allItems.forEach(function (it) {
            if (it.id === id) it.read = true;
          });
          render();
        });
      });
    });

    bindModeration(list);
    bindHistoryActions(list);
    if (window.DamIcons && typeof window.DamIcons.bindWinButtons === "function") {
      window.DamIcons.bindWinButtons(list);
    }
    if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
      window.DamBadges.bindClicks(list);
    }

    var params = new URLSearchParams(window.location.search);
    var focusId = params.get("focus") || params.get("proposal_id");
    if (focusId && !expanded[focusId]) {
      expanded[focusId] = true;
      render();
      return;
    }
    if (focusId) {
      var el = list.querySelector('[data-id="' + focusId.replace(/"/g, "") + '"]');
      if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function loadInboxItems() {
    return fetch(bridgeUrl() + "/inbox-items")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        return (d.items || []).map(function (it) {
          var tags = it.tags && it.tags.length ? it.tags.slice() : ["powiadomienie"];
          if (isZgloszenie(it) && tags.indexOf("zgloszenie") === -1) tags.push("zgloszenie");
          return Object.assign({}, it, {
            tags: tags,
            preview: it.preview || (it.detail || "").split("\n")[0] || "",
          });
        });
      })
      .catch(function () {
        return [];
      });
  }

  function loadTagProposals() {
    return fetch(bridgeUrl() + "/tag-proposals", { headers: authHeaders() })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        return (d.proposals || []).map(function (p) {
          var pending = p.status === "pending";
          var tags = ["zgloszenie", "moderacja", "propozycja", "tag"];
          if (!pending) tags.push("historia");
          var pname = p.product_name || p.product_id || "Produkt";
          var change =
            (p.current_value || "?") +
            " → " +
            (p.proposed_value === NONE_CODE ? "BRAK TYPU" : p.proposed_value || "?");
          return {
            id: p.id,
            type: "tag_proposal",
            title: pname + " · " + change,
            detail: p.product_name || "",
            preview: change + (p.submitted_by ? " · " + p.submitted_by : ""),
            product_id: p.product_id || "",
            product_name: p.product_name || "",
            revision_path: p.revision_path || "",
            path: p.revision_path || "",
            current_value: p.current_value || "",
            proposed_value: p.proposed_value || "",
            status: p.status || "pending",
            submitted_by: p.submitted_by || "",
            submitted_at: p.submitted_at || "",
            expires_at: p.expires_at || "",
            decided_by: p.decided_by || "",
            decided_at: p.decided_at || "",
            final_value: p.final_value || "",
            created_at: p.submitted_at || p.decided_at || "",
            read: !pending,
            tags: tags,
          };
        });
      })
      .catch(function () {
        return [];
      });
  }

  function loadAsanaAsInbox() {
    return fetch("data/asana-tasks.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        return (d.tasks || [])
          .filter(function (t) {
            return t.status === "open";
          })
          .map(function (t) {
            var gid = t.gid || t.id || "";
            var due = t.due_on || t.due || "";
            var parent = t.parent || "";
            var project = t.project || "";
            var detailParts = [];
            if (parent) detailParts.push("Produkt / rodzic: " + parent);
            if (project) detailParts.push("Projekt: " + project);
            if (t.section) detailParts.push("Sekcja: " + t.section);
            if (t.assignee) detailParts.push("Przypisane: " + t.assignee);
            if (due) detailParts.push("Termin: " + due);
            return {
              id: "asana-" + gid,
              title: t.name || "Zadanie Asana",
              detail: detailParts.join("\n"),
              preview: parent || project || t.section || "",
              parent: parent,
              section: t.section || "",
              assignee: t.assignee || "",
              due: due,
              tags: ["asana", "projekt"],
              created_at: due || "",
              read: true,
              href: t.permalink_url || (gid ? "https://app.asana.com/0/0/" + gid : ""),
            };
          });
      })
      .catch(function () {
        return [];
      });
  }

  function dedupeMerge(a, b) {
    var seen = {};
    var out = [];
    a.concat(b).forEach(function (it) {
      var key = it.id || it.title + it.created_at;
      if (seen[key]) return;
      seen[key] = true;
      out.push(it);
    });
    return out;
  }

  function load() {
    Promise.all([
      refreshCarrierTypes(),
      loadTagProposals(),
      loadInboxItems(),
      loadAsanaAsInbox(),
      loadProductLookup(),
      refreshChangeLogMeta(),
      loadLifecycleHistoryAsInbox(),
    ]).then(function (results) {
      results = results.slice(1);
      /* Propozycje z API mają pierwszeństwo nad duplikatami inbox_items */
      var props = results[0];
      var productMap = results[3] || {};
      var lifecycleItems = results[5] || [];
      props.forEach(function (p) {
        enrichProposalFromProduct(p, productMap[p.product_id]);
        if (p.type === "tag_proposal") {
          var pname = p.product_name || p.product_id || "Produkt";
          p.title = pname + " · " + typeChangeLabel(p);
        }
      });
      var propIds = {};
      props.forEach(function (p) {
        propIds[p.id] = true;
      });
      var inboxOnly = results[1].filter(function (it) {
        return !(it.proposal_id && propIds[it.proposal_id]);
      });
      allItems = dedupeMerge(props, inboxOnly).concat(results[2]).concat(lifecycleItems);
      allItems.sort(function (a, b) {
        var ap = isPendingMod(a) ? 2 : a.read === false ? 1 : 0;
        var bp = isPendingMod(b) ? 2 : b.read === false ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return String(b.created_at || b.due || "").localeCompare(String(a.created_at || a.due || ""));
      });
      render();
    });
  }

  function applyUrlTag() {
    var params = new URLSearchParams(window.location.search);
    var tag = params.get("tag");
    var sub = params.get("sub") || params.get("zgloszenie");
    if (tag === "historia") {
      activeTag = "zgloszenie";
      zgloszenieSub = "historia";
    } else if (tag) {
      activeTag = tag;
    } else if (isAdmin()) {
      activeTag = "zgloszenie";
    }
    if (sub === "typy" || sub === "wizualizacja" || sub === "historia") {
      zgloszenieSub = sub;
      if (activeTag !== "zgloszenie") activeTag = "zgloszenie";
    }
    document.querySelectorAll(".dam-inbox-tag[data-tag]").forEach(function (b) {
      var t = b.getAttribute("data-tag") || "";
      b.classList.toggle("is-active", t === activeTag || (t === "zgloszenie" && activeTag === "historia"));
    });
    syncZgloszenieChrome();
  }

  function bind() {
    applyUrlTag();
    document.querySelectorAll(".dam-inbox-tag[data-tag]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = btn.getAttribute("data-tag") || "all";
        pushFilter(next);
        if (next === "zgloszenie" && zgloszenieSub === "historia") {
          /* stay on last sub unless coming from elsewhere - default typy for fresh click */
        }
        document.querySelectorAll(".dam-inbox-tag[data-tag]").forEach(function (b) {
          b.classList.remove("is-active");
        });
        btn.classList.add("is-active");
        render();
      });
    });
    document.querySelectorAll("[data-zgloszenie-sub]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        zgloszenieSub = btn.getAttribute("data-zgloszenie-sub") || "typy";
        if (activeTag !== "zgloszenie") {
          pushFilter("zgloszenie");
          document.querySelectorAll(".dam-inbox-tag[data-tag]").forEach(function (b) {
            b.classList.toggle("is-active", (b.getAttribute("data-tag") || "") === "zgloszenie");
          });
        }
        syncZgloszenieChrome();
        render();
      });
    });
    var undoLast = document.getElementById("inboxUndoLast");
    if (undoLast) {
      undoLast.addEventListener("click", function () {
        postChangeLog("/change-log/undo").then(function (res) {
          if (!res || !res.ok) {
            showToast("Błąd: " + ((res && (res.error || res.hint)) || "brak wpisu do cofnięcia"));
            return;
          }
          var undone = res.undone || {};
          var pid = undone.proposal_id || "";
          showToast("Cofnięto ostatnią zmianę na dysku.");
          if (pid) {
            reopenProposal(pid).finally(function () {
              load();
            });
          } else {
            load();
          }
        });
      });
    }
    var redoLast = document.getElementById("inboxRedoLast");
    if (redoLast) {
      redoLast.addEventListener("click", function () {
        postChangeLog("/change-log/redo").then(function (res) {
          if (!res || !res.ok) {
            showToast("Błąd: " + ((res && (res.error || res.hint)) || "brak wpisu do ponowienia"));
            return;
          }
          showToast("Ponowiono ostatnią zmianę na dysku.");
          load();
        });
      });
    }
    var search = document.getElementById("inboxSearch");
    if (search) {
      search.addEventListener("input", function () {
        query = search.value || "";
        render();
      });
    }
    var unread = document.getElementById("inboxUnreadOnly");
    if (unread) {
      unread.addEventListener("change", function () {
        unreadOnly = !!unread.checked;
        render();
      });
    }
    var refresh = document.getElementById("inboxRefresh");
    if (refresh) refresh.addEventListener("click", load);

    window.DamInbox = {
      popFilter: popFilter,
      collapseExpanded: function () {
        var keys = Object.keys(expanded).filter(function (k) {
          return expanded[k];
        });
        if (!keys.length) return false;
        keys.forEach(function (k) {
          expanded[k] = false;
        });
        render();
        return true;
      },
      reload: load,
      isInboxPage: true,
      setZgloszenieSub: function (sub) {
        zgloszenieSub = sub || "typy";
        syncZgloszenieChrome();
        render();
      },
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      bind();
      load();
    });
  } else {
    bind();
    load();
  }
})();
