/**
 * DAM ETA - Dashboard widget registry, layout store, customize modal.
 */
(function (global) {
  "use strict";

  var LAYOUT_PREFIX = "dam_dash_layout_v1:";
  var registry = [];
  var draftOrder = null;

  function t(key, fallback) {
    if (global.DamI18n && typeof DamI18n.t === "function") {
      var v = DamI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function userKey() {
    try {
      var u = JSON.parse(localStorage.getItem("dam_user") || "{}");
      if (u && u.email) return String(u.email).toLowerCase();
    } catch (e) { /* ignore */ }
    return localStorage.getItem("dam_user_email") || "anon";
  }

  function userRole() {
    return (
      localStorage.getItem("dam_role") ||
      (function () {
        try {
          return (JSON.parse(localStorage.getItem("dam_user") || "{}").role) || "";
        } catch (e) {
          return "";
        }
      })() ||
      "user"
    );
  }

  function defaultOrder() {
    return registry
      .filter(function (w) {
        return w.defaultOn;
      })
      .map(function (w) {
        return w.id;
      });
  }

  function allIds() {
    return registry.map(function (w) {
      return w.id;
    });
  }

  function loadLayout() {
    var key = LAYOUT_PREFIX + userKey();
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return { order: defaultOrder(), version: 1 };
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.order)) {
        return { order: defaultOrder(), version: 1 };
      }
      var known = {};
      allIds().forEach(function (id) {
        known[id] = true;
      });
      var order = parsed.order.filter(function (id) {
        return known[id];
      });
      if (!order.length) order = defaultOrder();
      return { order: order, version: 1 };
    } catch (e) {
      return { order: defaultOrder(), version: 1 };
    }
  }

  function saveLayout(layout) {
    localStorage.setItem(
      LAYOUT_PREFIX + userKey(),
      JSON.stringify({ version: 1, order: layout.order || [] })
    );
  }

  function resetLayout() {
    localStorage.removeItem(LAYOUT_PREFIX + userKey());
  }

  function findWidget(id) {
    for (var i = 0; i < registry.length; i++) {
      if (registry[i].id === id) return registry[i];
    }
    return null;
  }

  function allowedForRole(w) {
    if (!w.roles || !w.roles.length) return true;
    var role = userRole();
    return w.roles.indexOf(role) !== -1;
  }

  function shell(w, bodyHtml, extraClass) {
    var size = w.size || "sm";
    var cls =
      "dam-widget dam-widget--" +
      size +
      (extraClass ? " " + extraClass : "") +
      (w.accent ? " dam-widget--accent" : "");
    return (
      '<article class="' +
      cls +
      '" data-widget-id="' +
      escapeHtml(w.id) +
      '" aria-labelledby="dw-title-' +
      escapeHtml(w.id) +
      '">' +
      '<div class="dam-widget__head">' +
      '<h3 class="dam-widget__title" id="dw-title-' +
      escapeHtml(w.id) +
      '">' +
      escapeHtml(w.title) +
      "</h3>" +
      "</div>" +
      '<div class="dam-widget__body">' +
      bodyHtml +
      "</div>" +
      "</article>"
    );
  }

  function statBody(value, meta) {
    return (
      '<p class="dam-widget__value">' +
      escapeHtml(String(value)) +
      "</p>" +
      (meta
        ? '<span class="dam-widget__meta">' + escapeHtml(meta) + "</span>"
        : "")
    );
  }

  function openTasks(ctx) {
    return ((ctx.asana && ctx.asana.tasks) || []).filter(function (task) {
      return task.status === "open";
    });
  }

  function monthPrefix() {
    var d = new Date();
    var m = String(d.getMonth() + 1);
    if (m.length < 2) m = "0" + m;
    return d.getFullYear() + "-" + m;
  }

  /* ---------- widget defs ---------- */

  function defineWidgets() {
    registry = [
      {
        id: "products_count",
        title: t("dash.widget.products", "Produkty"),
        size: "sm",
        defaultOn: true,
        accentClass: "primary-bg",
        render: function (el, ctx) {
          var n =
            (ctx.projects && ctx.projects.length) ||
            (ctx.fileIndex && ctx.fileIndex.product_count) ||
            0;
          el.outerHTML = shell(
            this,
            statBody(n, t("dash.widget.products_meta", "W indeksie / API")),
            "dam-widget--stat dam-widget--fill-brand"
          );
        }
      },
      {
        id: "asana_open",
        title: t("dash.widget.asana_open", "Zadania Asana"),
        size: "sm",
        defaultOn: true,
        render: function (el, ctx) {
          var tasks = openTasks(ctx);
          el.outerHTML = shell(
            this,
            statBody(tasks.length, t("dash.widget.asana_open_meta", "Otwarte")),
            "dam-widget--stat dam-widget--fill-info"
          );
        }
      },
      {
        id: "checklists_ok",
        title: t("dash.widget.checklists_ok", "Kompletne checklisty"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var rows = ctx.projects || [];
          var n = rows.filter(function (p) {
            return p.completeness === "complete";
          }).length;
          el.outerHTML = shell(
            this,
            statBody(n, t("dash.widget.checklists_ok_meta", "Gotowe")),
            "dam-widget--stat dam-widget--fill-success"
          );
        }
      },
      {
        id: "checklists_gap",
        title: t("dash.widget.checklists_gap", "Z brakami"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var rows = ctx.projects || [];
          var n = rows.length
            ? rows.filter(function (p) {
                return p.completeness !== "complete";
              }).length
            : "-";
          el.outerHTML = shell(
            this,
            statBody(n, t("dash.widget.checklists_gap_meta", "Do uzupelnienia")),
            "dam-widget--stat dam-widget--fill-warning"
          );
        }
      },
      {
        id: "cost_month",
        title: t("dash.balance_label", "Szacowany koszt miesiaca"),
        size: "md",
        defaultOn: false,
        accent: true,
        render: function (el, ctx) {
          var landed =
            (ctx.landed && ctx.landed.landed_month) ||
            (ctx.projectCosts && ctx.projectCosts.sum_open_projects) ||
            0;
          var chip =
            (ctx.landed && ctx.landed.chip) ||
            t("dash.balance_chip", "Szacunek branżowy");
          var when = new Date().toLocaleDateString("pl-PL", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          });
          el.outerHTML = shell(
            this,
            statBody(
              global.DamFmcg ? DamFmcg.formatPLN(landed) : Math.round(landed) + " PLN",
              when
            ) +
              '<span class="dam-widget__chip">' +
              escapeHtml(chip) +
              "</span>",
            ""
          );
        }
      },
      {
        id: "cost_fmcg_breakdown",
        title: t("dash.widget.fmcg_breakdown", "Landed cost (FMCG)"),
        size: "lg",
        defaultOn: false,
        render: function (el, ctx) {
          var L = ctx.landed || { lines: [], estimate: true };
          var rows = (L.lines || [])
            .map(function (line) {
              return (
                '<li><span>' +
                escapeHtml(line.label) +
                '</span><strong style="margin-left:auto">' +
                escapeHtml(
                  global.DamFmcg
                    ? DamFmcg.formatPLN(line.total)
                    : Math.round(line.total) + " PLN"
                ) +
                "</strong></li>"
              );
            })
            .join("");
          var risk =
            '<li><span>Narzut ryzyka (' +
            escapeHtml(String(L.risk_pct || 0)) +
            '%)</span><strong style="margin-left:auto">' +
            escapeHtml(
              global.DamFmcg ? DamFmcg.formatPLN(L.risk) : Math.round(L.risk || 0) + " PLN"
            ) +
            "</strong></li>";
          el.outerHTML = shell(
            this,
            '<span class="dam-widget__chip">' +
              escapeHtml(
                L.chip || "Szacunek branżowy - podmienimy na dane realne"
              ) +
              "</span>" +
              '<ul class="dam-widget__list">' +
              rows +
              risk +
              "</ul>" +
              '<p class="dam-widget__value" style="font-size:1.35rem;margin-top:4px">' +
              escapeHtml(
                global.DamFmcg
                  ? DamFmcg.formatPLN(L.landed_month)
                  : Math.round(L.landed_month || 0) + " PLN"
              ) +
              "</p>"
          );
        }
      },
      {
        id: "cost_swot_risk",
        title: t("dash.widget.swot", "SWOT / ryzyko kosztowe"),
        size: "lg",
        defaultOn: false,
        render: function (el, ctx) {
          var sw =
            (global.DamFmcg && DamFmcg.getSwot(ctx.fmcg)) || {
              strengths: [],
              weaknesses: [],
              opportunities: [],
              threats: []
            };
          function card(label, items, tone) {
            var lis = (items || [])
              .slice(0, 3)
              .map(function (x) {
                return "<li>" + escapeHtml(x) + "</li>";
              })
              .join("");
            return (
              '<div class="dam-widget__swot-card" data-tone="' +
              tone +
              '"><h6>' +
              escapeHtml(label) +
              "</h6><ul>" +
              lis +
              "</ul></div>"
            );
          }
          el.outerHTML = shell(
            this,
            '<div class="dam-widget__swot">' +
              card("Sily", sw.strengths, "s") +
              card("Slabe strony", sw.weaknesses, "w") +
              card("Szanse", sw.opportunities, "o") +
              card("Zagrozenia", sw.threats, "t") +
              "</div>"
          );
        }
      },
      {
        id: "projects_this_month",
        title: t("dash.widget.projects_month", "Projekty w tym miesiacu"),
        size: "sm",
        defaultOn: true,
        render: function (el, ctx) {
          var prefix = monthPrefix();
          var viz = (ctx.fileIndex && ctx.fileIndex.viz_latest) || [];
          var ids = {};
          viz.forEach(function (v) {
            if ((v.mtime || "").indexOf(prefix) === 0) {
              ids[v.product_id || v.path] = true;
            }
          });
          var asanaNew = ((ctx.projectCosts && ctx.projectCosts.projects) || []).filter(
            function (p) {
              return (p.start || "").indexOf(prefix) === 0;
            }
          ).length;
          var n = Object.keys(ids).length || asanaNew;
          el.outerHTML = shell(
            this,
            statBody(n, t("dash.widget.projects_month_meta", "Nowe / aktywne w indeksie")),
            "dam-widget--stat dam-widget--fill-primary"
          );
        }
      },
      {
        id: "newest_viz_3",
        title: t("dash.widget.newest_viz", "3 najnowsze wizualizacje"),
        size: "md",
        defaultOn: true,
        render: function (el, ctx) {
          var sorted = ((ctx.fileIndex && ctx.fileIndex.viz_latest) || [])
            .slice()
            .sort(function (a, b) {
              return String(b.mtime || "").localeCompare(String(a.mtime || ""));
            });
          var seenPid = {};
          var list = [];
          sorted.forEach(function (v) {
            var pid = v.product_id || v.path || "";
            if (seenPid[pid]) return;
            seenPid[pid] = true;
            list.push(v);
          });
          list = list.slice(0, 3);
          if (!list.length) {
            el.outerHTML = shell(
              this,
              '<p class="dam-widget__meta">Brak wizualizacji w indeksie</p>'
            );
            return;
          }
          var html =
            '<ul class="dam-widget__list">' +
            list
              .map(function (v) {
                var name = v.product_name || v.product_id || "Wizualizacja";
                var carrierTxt =
                  window.DamLabels && typeof window.DamLabels.carrierLabel === "function"
                    ? window.DamLabels.carrierLabel(v.carrier, v.revision_folder || v.carrier, {
                        isMix: v.is_mix,
                        productName: v.product_name,
                        tags: v.tags,
                      })
                    : /^(OTHER|UNKNOWN|WARIANT)$/i.test(String(v.carrier_label || v.carrier || ""))
                    ? ""
                    : v.carrier_label || v.carrier || "";
                var langShort =
                  window.DamLabels && typeof window.DamLabels.langShort === "function"
                    ? window.DamLabels.langShort(v.lang)
                    : String(v.lang || "").toUpperCase();
                var sub = [carrierTxt, langShort].filter(Boolean).join(" / ");
                var thumb = v.thumb_url || "assets/img/placeholder-product.svg";
                return (
                  "<li>" +
                  '<img class="dam-widget__thumb" src="' +
                  escapeHtml(thumb) +
                  '" alt="" loading="lazy" />' +
                  '<div style="min-width:0">' +
                  '<a href="visualizations.html">' +
                  escapeHtml(name) +
                  "</a>" +
                  '<div class="dam-widget__meta">' +
                  escapeHtml(sub) +
                  "</div></div></li>"
                );
              })
              .join("") +
            "</ul>";
          el.outerHTML = shell(this, html);
        }
      },
      {
        id: "notify_new_viz",
        title: t("dash.widget.notify", "Powiadomienia o wizualizacjach"),
        size: "md",
        defaultOn: true,
        render: function (el, ctx) {
          var enabled = global.DamNotify && DamNotify.isEnabled();
          var status =
            (global.DamNotify && DamNotify.statusText()) || "Niedostepne";
          var id = "damNotifyToggle";
          el.outerHTML = shell(
            this,
            '<div class="dam-widget__notify">' +
              '<label class="dam-widget__toggle" for="' +
              id +
              '">' +
              '<input type="checkbox" id="' +
              id +
              '"' +
              (enabled ? " checked" : "") +
              " />" +
              "<span>" +
              escapeHtml(
                t("dash.widget.notify_label", "Powiadom gdy pojawi sie nowa wizualizacja")
              ) +
              "</span></label>" +
              '<span class="dam-widget__meta" id="damNotifyStatus">' +
              escapeHtml(status) +
              "</span></div>"
          );
          var input = document.getElementById(id);
          if (input && global.DamNotify) {
            input.addEventListener("change", function () {
              var on = !!input.checked;
              if (on) {
                DamNotify.requestPermission().then(function () {
                  DamNotify.setEnabled(true);
                  var st = document.getElementById("damNotifyStatus");
                  if (st) st.textContent = DamNotify.statusText();
                });
              } else {
                DamNotify.setEnabled(false);
                var st2 = document.getElementById("damNotifyStatus");
                if (st2) st2.textContent = DamNotify.statusText();
              }
            });
          }
        }
      },
      {
        id: "tasks_next",
        title: t("dash.widget.tasks_next", "Nastepne zadania"),
        size: "md",
        defaultOn: true,
        render: function (el, ctx) {
          var tasks = openTasks(ctx)
            .slice()
            .sort(function (a, b) {
              return String(a.due || "9999").localeCompare(String(b.due || "9999"));
            })
            .slice(0, 6);
          if (!tasks.length) {
            el.outerHTML = shell(
              this,
              '<p class="dam-widget__meta">Brak otwartych zadan</p>'
            );
            return;
          }
          var html =
            '<ul class="dam-widget__list">' +
            tasks
              .map(function (task) {
                var due = task.due
                  ? new Date(task.due).toLocaleDateString("pl-PL")
                  : "-";
                var overdueCls =
                  task.due && new Date(task.due) < new Date()
                    ? " is-overdue"
                    : "";
                return (
                  "<li>" +
                  '<span title="' +
                  escapeHtml(task.name) +
                  '">' +
                  escapeHtml(task.name) +
                  "</span>" +
                  '<span class="' +
                  overdueCls.trim() +
                  '">' +
                  escapeHtml(due) +
                  "</span></li>"
                );
              })
              .join("") +
            "</ul>";
          el.outerHTML = shell(this, html);
        }
      },
      {
        id: "tasks_by_section",
        title: t("dash.widget.tasks_sections", "Zadania wg sekcji"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var buckets = { Dzis: 0, Tydzien: 0, Odlozone: 0, Inne: 0 };
          openTasks(ctx).forEach(function (task) {
            var s = (task.section || "").toLowerCase();
            if (s.indexOf("dzi") !== -1) buckets.Dzis++;
            else if (s.indexOf("tydzie") !== -1 || s.indexOf("tydzień") !== -1)
              buckets.Tydzien++;
            else if (s.indexOf("odloz") !== -1 || s.indexOf("odłoż") !== -1)
              buckets.Odlozone++;
            else buckets.Inne++;
          });
          var html =
            '<ul class="dam-widget__list">' +
            Object.keys(buckets)
              .map(function (k) {
                return (
                  "<li><span>" +
                  escapeHtml(k) +
                  '</span><strong style="margin-left:auto">' +
                  buckets[k] +
                  "</strong></li>"
                );
              })
              .join("") +
            "</ul>";
          el.outerHTML = shell(this, html);
        }
      },
      {
        id: "tasks_overdue",
        title: t("dash.widget.tasks_overdue", "Przeterminowane"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var now = new Date();
          var n = openTasks(ctx).filter(function (task) {
            return task.due && new Date(task.due) < now;
          }).length;
          el.outerHTML = shell(this, statBody(n, "Z due w przeszlosci"));
        }
      },
      {
        id: "assignees_load",
        title: t("dash.widget.assignees", "Obciazenie osob"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var map = {};
          openTasks(ctx).forEach(function (task) {
            var a = task.assignee || "Bez przypisania";
            map[a] = (map[a] || 0) + 1;
          });
          var rows = Object.keys(map)
            .map(function (k) {
              return { name: k, n: map[k] };
            })
            .sort(function (a, b) {
              return b.n - a.n;
            })
            .slice(0, 5);
          var max = (rows[0] && rows[0].n) || 1;
          var html =
            '<div class="dam-widget__bars">' +
            rows
              .map(function (r) {
                var pct = Math.round((r.n / max) * 100);
                return (
                  '<div class="dam-widget__bar-row">' +
                  "<span>" +
                  escapeHtml(r.name.split(" ")[0]) +
                  "</span>" +
                  '<div class="dam-widget__bar-track"><div class="dam-widget__bar-fill" style="width:' +
                  pct +
                  '%"></div></div>' +
                  "<span>" +
                  r.n +
                  "</span></div>"
                );
              })
              .join("") +
            "</div>";
          el.outerHTML = shell(
            this,
            rows.length
              ? html
              : '<p class="dam-widget__meta">Brak danych Asana</p>'
          );
        }
      },
      {
        id: "sales_mock",
        title: t("dash.widget.sales", "Sprzedaz (szacunek)"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var s =
            (global.DamFmcg && DamFmcg.getSalesMock(ctx.fmcg)) || {
              monthly_revenue_pln: 0,
              trend_pct: 0,
              note: ""
            };
          el.outerHTML = shell(
            this,
            '<p class="dam-widget__value">' +
              escapeHtml(
                global.DamFmcg
                  ? DamFmcg.formatPLN(s.monthly_revenue_pln)
                  : Math.round(s.monthly_revenue_pln || 0) + " PLN"
              ) +
              "</p>" +
              '<span class="dam-widget__meta">Trend ' +
              escapeHtml(String(s.trend_pct || 0)) +
              "% · " +
              escapeHtml(String(s.monthly_units || 0)) +
              " szt.</span>" +
              '<span class="dam-widget__chip">' +
              escapeHtml(
                s.note || "Szacunek do czasu danych rzeczywistych"
              ) +
              "</span>"
          );
        }
      },
      {
        id: "langs_mix",
        title: t("dash.widget.langs", "Jezyki / MIX"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var viz = (ctx.fileIndex && ctx.fileIndex.viz_latest) || [];
          var langs = {};
          var mix = 0;
          viz.forEach(function (v) {
            if (v.is_mix) mix++;
            var lg = v.lang || "pl";
            langs[lg] = (langs[lg] || 0) + 1;
          });
          var top = Object.keys(langs)
            .sort(function (a, b) {
              return langs[b] - langs[a];
            })
            .slice(0, 6);
          var html =
            '<p class="dam-widget__value" style="font-size:1.35rem">' +
            Object.keys(langs).length +
            ' jezykow · MIX: ' +
            mix +
            "</p>" +
            '<ul class="dam-widget__list">' +
            top
              .map(function (lg) {
                return (
                  "<li><span>" +
                  escapeHtml(lg.toUpperCase()) +
                  '</span><strong style="margin-left:auto">' +
                  langs[lg] +
                  "</strong></li>"
                );
              })
              .join("") +
            "</ul>";
          el.outerHTML = shell(this, html);
        }
      },
      {
        id: "carriers_top",
        title: t("dash.widget.carriers", "Top opakowan"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var viz = (ctx.fileIndex && ctx.fileIndex.viz_latest) || [];
          var map = {};
          viz.forEach(function (v) {
            var c =
              window.DamLabels && typeof window.DamLabels.carrierLabel === "function"
                ? window.DamLabels.carrierLabel(v.carrier, v.revision_folder || v.carrier, {
                    isMix: v.is_mix,
                    productName: v.product_name,
                    tags: v.tags,
                  })
                : v.carrier_label || v.carrier || "";
            /* Typ nieznany - nie liczymy go do "Top opakowan" (bez OTHER/WARIANT) */
            if (!c || /^(OTHER|UNKNOWN|WARIANT)$/i.test(c)) return;
            map[c] = (map[c] || 0) + 1;
          });
          var rows = Object.keys(map)
            .map(function (k) {
              return { name: k, n: map[k] };
            })
            .sort(function (a, b) {
              return b.n - a.n;
            })
            .slice(0, 6);
          var html =
            '<ul class="dam-widget__list">' +
            rows
              .map(function (r) {
                return (
                  "<li><span>" +
                  escapeHtml(r.name) +
                  '</span><strong style="margin-left:auto">' +
                  r.n +
                  "</strong></li>"
                );
              })
              .join("") +
            "</ul>";
          el.outerHTML = shell(this, html);
        }
      },
      {
        id: "index_health",
        title: t("dash.widget.index_health", "Stan indeksu"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var fi = ctx.fileIndex || {};
          var when = fi.generated_at
            ? new Date(fi.generated_at).toLocaleString("pl-PL")
            : "-";
          el.outerHTML = shell(
            this,
            '<p class="dam-widget__value" style="font-size:1.2rem">' +
              escapeHtml(String(fi.viz_count || 0)) +
              " wiz</p>" +
              '<span class="dam-widget__meta">' +
              escapeHtml(String(fi.product_count || 0)) +
              " produktow · " +
              escapeHtml(when) +
              "</span>"
          );
        }
      },
      {
        id: "viz_flags",
        title: t("dash.widget.viz_flags", "Flagi wizualizacji"),
        size: "sm",
        defaultOn: false,
        roles: ["admin"],
        render: function (el, ctx) {
          var flags = ctx.vizFlags || { demo: {}, hidden: {} };
          var demo = Object.keys(flags.demo || {}).length;
          var hidden = Object.keys(flags.hidden || {}).length;
          el.outerHTML = shell(
            this,
            statBody(demo + " / " + hidden, "Demo / ukryte")
          );
        }
      },
      {
        id: "missing_thumbs",
        title: t("dash.widget.missing_thumbs", "Bez miniatury"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var viz = (ctx.fileIndex && ctx.fileIndex.viz_latest) || [];
          var n = viz.filter(function (v) {
            return !v.thumb_url || String(v.thumb_url).indexOf("noid") !== -1;
          }).length;
          el.outerHTML = shell(this, statBody(n, "Wymagaja thumbs"));
        }
      },
      {
        id: "demo_vs_prod",
        title: t("dash.widget.demo_vs_prod", "Demo vs produkcja"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var viz = (ctx.fileIndex && ctx.fileIndex.viz_latest) || [];
          var flags = ctx.vizFlags || { demo: {} };
          var demo = 0;
          viz.forEach(function (v) {
            var key = [v.index_base || "", v.lang || "", v.path || ""].join("|");
            if (flags.demo && flags.demo[key]) demo++;
            else if ((v.revision_folder || "").toUpperCase().indexOf("DEMO") !== -1)
              demo++;
          });
          el.outerHTML = shell(
            this,
            statBody(demo + " / " + Math.max(0, viz.length - demo), "Demo / reszta")
          );
        }
      },
      {
        id: "quick_links",
        title: t("dash.widget.quick_links", "Szybkie skroty"),
        size: "md",
        defaultOn: true,
        render: function (el) {
          el.outerHTML = shell(
            this,
            '<div class="dam-widget__links">' +
              '<a href="visualizations.html"><i class="uil uil-image-v"></i> Wizualizacje</a>' +
              '<a href="costs.html"><i class="uil uil-calculator-alt"></i> Koszty</a>' +
              '<a href="explorer.html"><i class="uil uil-folder"></i> Eksplorator</a>' +
              '<a href="invoices.html"><i class="uil uil-invoice"></i> Faktury</a>' +
              "</div>"
          );
        }
      },
      {
        id: "labor_vs_print",
        title: t("dash.widget.labor_vs_print", "Praca vs druk"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var L = ctx.landed || {};
          var labor = L.labor_total || 0;
          var print = L.print_total || 0;
          var sum = labor + print || 1;
          el.outerHTML = shell(
            this,
            '<div class="dam-widget__bars">' +
              '<div class="dam-widget__bar-row"><span>Praca</span><div class="dam-widget__bar-track"><div class="dam-widget__bar-fill" style="width:' +
              Math.round((labor / sum) * 100) +
              '%"></div></div><span>' +
              Math.round((labor / sum) * 100) +
              "%</span></div>" +
              '<div class="dam-widget__bar-row"><span>Druk</span><div class="dam-widget__bar-track"><div class="dam-widget__bar-fill" style="width:' +
              Math.round((print / sum) * 100) +
              '%;background:#AB54DB"></div></div><span>' +
              Math.round((print / sum) * 100) +
              "%</span></div></div>" +
              '<span class="dam-widget__chip">Szacunek FMCG</span>'
          );
        }
      },
      {
        id: "efficiency_mock",
        title: t("dash.widget.efficiency", "Koszt / wariant"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var L = ctx.landed || {};
          var units = L.variantUnits || 1;
          var per = (L.landed_month || 0) / units;
          el.outerHTML = shell(
            this,
            statBody(
              global.DamFmcg ? DamFmcg.formatPLN(per) : Math.round(per) + " PLN",
              "Na otwarty wariant (szacunek)"
            )
          );
        }
      }
    ];
  }

  function renderGrid(mount, ctx) {
    if (!mount) return;
    defineWidgets();
    var layout = loadLayout();
    var order = layout.order.slice();
    mount.innerHTML = "";
    order.forEach(function (id) {
      var w = findWidget(id);
      if (!w || !allowedForRole(w)) return;
      var placeholder = document.createElement("div");
      placeholder.dataset.widgetId = id;
      mount.appendChild(placeholder);
      try {
        w.render(placeholder, ctx || {});
      } catch (e) {
        console.warn("DAM widget fail", id, e);
        placeholder.outerHTML = shell(
          w,
          '<p class="dam-widget__meta">Blad renderu widgetu</p>'
        );
      }
    });
  }

  /* ---------- customize modal ---------- */

  function ensureModal() {
    var existing = document.getElementById("damDashCustomize");
    if (existing) return existing;
    var wrap = document.createElement("div");
    wrap.id = "damDashCustomize";
    wrap.className = "dam-dash-modal";
    wrap.hidden = true;
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "damDashCustomizeTitle");
    wrap.innerHTML =
      '<div class="dam-dash-modal__backdrop" data-dam-close="1"></div>' +
      '<div class="dam-dash-modal__panel">' +
      '<h3 id="damDashCustomizeTitle">Dostosuj pulpit</h3>' +
      "<p>Wybierz widgety i kolejnosc. Koszt miesiaca nie jest domyslnie wlaczony.</p>" +
      '<ul class="dam-dash-modal__list" id="damDashCustomizeList"></ul>' +
      '<div class="dam-dash-modal__footer">' +
      '<button type="button" class="geex-btn" id="damDashReset">Przywroc domyslne</button>' +
      '<button type="button" class="geex-btn" data-dam-close="1">Anuluj</button>' +
      '<button type="button" class="geex-btn geex-btn--primary" id="damDashSave">Zapisz</button>' +
      "</div></div>";
    document.body.appendChild(wrap);
    return wrap;
  }

  function buildDraftFromLayout() {
    defineWidgets();
    var layout = loadLayout();
    var on = {};
    layout.order.forEach(function (id) {
      on[id] = true;
    });
    draftOrder = allIds()
      .filter(function (id) {
        var w = findWidget(id);
        return w && allowedForRole(w);
      })
      .sort(function (a, b) {
        var ia = layout.order.indexOf(a);
        var ib = layout.order.indexOf(b);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
      .map(function (id) {
        return { id: id, on: !!on[id] };
      });
  }

  function paintModalList() {
    var list = document.getElementById("damDashCustomizeList");
    if (!list || !draftOrder) return;
    list.innerHTML = draftOrder
      .map(function (row, idx) {
        var w = findWidget(row.id);
        if (!w) return "";
        return (
          '<li class="dam-dash-modal__row" data-idx="' +
          idx +
          '">' +
          '<label><input type="checkbox" data-id="' +
          escapeHtml(row.id) +
          '"' +
          (row.on ? " checked" : "") +
          " />" +
          escapeHtml(w.title) +
          (w.defaultOn ? "" : ' <span class="dam-widget__meta">(opcjonalny)</span>') +
          "</label>" +
          '<div class="dam-dash-modal__move">' +
          '<button type="button" data-move="up" data-idx="' +
          idx +
          '" aria-label="W gore"' +
          (idx === 0 ? " disabled" : "") +
          '><i class="uil uil-angle-up" aria-hidden="true"></i></button>' +
          '<button type="button" data-move="down" data-idx="' +
          idx +
          '" aria-label="W dol"' +
          (idx === draftOrder.length - 1 ? " disabled" : "") +
          '><i class="uil uil-angle-down" aria-hidden="true"></i></button>' +
          "</div></li>"
        );
      })
      .join("");
  }

  function openCustomize(onSaved) {
    var modal = ensureModal();
    buildDraftFromLayout();
    paintModalList();
    modal.hidden = false;
    var prevFocus = document.activeElement;
    var saveBtn = document.getElementById("damDashSave");
    if (saveBtn) saveBtn.focus();

    function close() {
      modal.hidden = true;
      modal.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    }

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }

    function onClick(e) {
      var tEl = e.target;
      if (tEl.closest && tEl.closest("[data-dam-close]")) {
        close();
        return;
      }
      var moveBtn = tEl.closest ? tEl.closest("[data-move]") : null;
      var move = moveBtn && moveBtn.getAttribute("data-move");
      if (move != null) {
        var idx = parseInt(moveBtn.getAttribute("data-idx"), 10);
        if (move === "up" && idx > 0) {
          var tmp = draftOrder[idx - 1];
          draftOrder[idx - 1] = draftOrder[idx];
          draftOrder[idx] = tmp;
          paintModalList();
        }
        if (move === "down" && idx < draftOrder.length - 1) {
          var tmp2 = draftOrder[idx + 1];
          draftOrder[idx + 1] = draftOrder[idx];
          draftOrder[idx] = tmp2;
          paintModalList();
        }
        return;
      }
      if (tEl.closest && tEl.closest("#damDashReset")) {
        resetLayout();
        buildDraftFromLayout();
        paintModalList();
        return;
      }
      if (tEl.closest && tEl.closest("#damDashSave")) {
        var checks = modal.querySelectorAll('input[type="checkbox"][data-id]');
        var onMap = {};
        checks.forEach(function (c) {
          onMap[c.getAttribute("data-id")] = c.checked;
        });
        draftOrder.forEach(function (row) {
          row.on = !!onMap[row.id];
        });
        var order = draftOrder
          .filter(function (row) {
            return row.on;
          })
          .map(function (row) {
            return row.id;
          });
        if (!order.length) order = defaultOrder();
        saveLayout({ order: order });
        close();
        if (typeof onSaved === "function") onSaved();
      }
    }

    modal.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
  }

  global.DamDashWidgets = {
    defineWidgets: defineWidgets,
    getRegistry: function () {
      defineWidgets();
      return registry.slice();
    },
    loadLayout: loadLayout,
    saveLayout: saveLayout,
    resetLayout: resetLayout,
    renderGrid: renderGrid,
    openCustomize: openCustomize,
    userKey: userKey
  };
})(typeof window !== "undefined" ? window : globalThis);
