import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = "http://127.0.0.1:8765";
const BRIDGE = "http://127.0.0.1:8766";
const BOUND = {
  machine_id: "dam-mid-a6a2acce751029d4e04eb1e410740948",
  device_id: "dam-dev-a6a2acce751029d4e04eb1e410740948",
  session_id: "dam-sid-25cqWILYSn_ohnXs23ofxrirRY0sAQNJ",
};

const VIEWPORTS = [
  { name: "360", width: 360, height: 800, dsf: 2 },
  { name: "390", width: 390, height: 844, dsf: 3 },
  { name: "414", width: 414, height: 896, dsf: 3 },
  { name: "768", width: 768, height: 1024, dsf: 2 },
];

const PAGES = [
  { id: "signin", url: "/signin.html", auth: false, wait: "#authEmail" },
  { id: "index", url: "/index.html", auth: true, wait: ".geex-content" },
  { id: "dashboard", url: "/dashboard.html", auth: true, wait: ".geex-content" },
  {
    id: "project",
    url: "/project.html?id=figa-z-makiem-owocowe",
    auth: true,
    wait: ".geex-content",
    ready: "section.dam-catalog-fmcg, .dam-catalog-kpi",
  },
  { id: "costs", url: "/costs.html", auth: true, wait: ".geex-content" },
  { id: "invoices", url: "/invoices.html", auth: true, wait: ".geex-content" },
  { id: "explorer", url: "/explorer.html", auth: true, wait: "body", fast: true },
  { id: "visualizations", url: "/visualizations.html", auth: true, wait: "body", fast: true },
  { id: "branding", url: "/branding.html", auth: true, wait: "body", fast: true },
  { id: "settings", url: "/settings.html", auth: true, wait: "#damAppearance, .geex-content" },
  { id: "inbox", url: "/inbox.html", auth: true, wait: ".geex-content" },
  { id: "tasks", url: "/tasks.html", auth: true, wait: ".geex-content" },
];

const MEASURE_JS = `(() => {
  function path(el){
    if(!el || !el.tagName) return "";
    var id = el.id ? ("#" + el.id) : "";
    var cls = (el.className && typeof el.className === "string")
      ? ("." + el.className.trim().split(/\\s+/).slice(0, 3).join(".")) : "";
    return el.tagName.toLowerCase() + id + cls;
  }
  function vis(el){
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
  }
  var vw = innerWidth, vh = innerHeight, sw = document.documentElement.scrollWidth;
  var out = {
    href: location.href, title: document.title, vw: vw, vh: vh, sw: sw, overflow: sw - vw,
    dpr: devicePixelRatio, bodyCls: document.body.className, signin: !!document.body.classList.contains("authentication-page"),
    sidebar: null, header: null, fmcg: [], squeezed: [], narrow: [], wordBreak: [], touch: [],
    tables: [], overflowEls: [], smallText: [], iosZoom: [], fabs: [], sticky: [], indexReport: null
  };
  var sb = document.querySelector(".geex-sidebar");
  if (sb) {
    var r = sb.getBoundingClientRect(); var cs = getComputedStyle(sb);
    out.sidebar = { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left),
      display: cs.display, pos: cs.position, transform: cs.transform, cls: sb.className, open: sb.classList.contains("is-open") };
  }
  var hd = document.querySelector(".geex-content__header, .geex-header");
  if (hd && vis(hd)) {
    var hr = hd.getBoundingClientRect();
    out.header = { sel: path(hd), w: Math.round(hr.width), h: Math.round(hr.height), pos: getComputedStyle(hd).position };
  }
  ["section.dam-catalog-fmcg","div.dam-catalog-fmcg__inner","div.dam-catalog-kpi",".dam-catalog-fmcg__tile",".dam-catalog-fmcg__row-label",".dam-catalog-fmcg__row-text"].forEach(function(sel){
    document.querySelectorAll(sel).forEach(function(el, i){
      if (i > 6) return;
      var r = el.getBoundingClientRect(); var cs = getComputedStyle(el);
      out.fmcg.push({ sel: sel, w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left),
        right: Math.round(r.right), pct: Math.round(100 * r.width / vw),
        wb: cs.wordBreak, ow: cs.overflowWrap, display: cs.display, grid: cs.gridTemplateColumns,
        txt: (el.textContent || "").trim().slice(0, 70) });
    });
  });
  Array.prototype.slice.call(document.querySelectorAll("button, a.geex-btn, a.dam-int-cta, .dam-btn-icon, [role=button], .geex-btn, .dam-switch, .geex-content__header__quickaction a, .geex-content__header button")).forEach(function(el){
    if (!vis(el)) return;
    var r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) {
      out.touch.push({ sel: path(el), w: Math.round(r.width), h: Math.round(r.height),
        txt: ((el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 42)) });
    }
  });
  out.touch = out.touch.slice(0, 30);
  Array.prototype.slice.call(document.querySelectorAll("table")).forEach(function(t){
    var r = t.getBoundingClientRect(); var p = t.parentElement; var pcs = p ? getComputedStyle(p) : null;
    var scroll = pcs && (pcs.overflowX === "auto" || pcs.overflowX === "scroll");
    out.tables.push({ sel: path(t), w: Math.round(r.width), overflow: Math.round(r.width - vw),
      parentOverflowX: pcs ? pcs.overflowX : "", hasScroll: !!scroll });
  });
  var overflowProbe = document.querySelectorAll(".geex-content > *, .dam-catalog-fmcg, .dam-explorer-shell, table, .geex-content__header, .dam-viz-grid, .dam-viz-card");
  Array.prototype.slice.call(overflowProbe).forEach(function(el){
    if (!vis(el)) return;
    var r = el.getBoundingClientRect();
    if (r.right > vw + 4 && r.width > 24) {
      out.overflowEls.push({ sel: path(el), w: Math.round(r.width), right: Math.round(r.right), ov: Math.round(r.right - vw) });
    }
  });
  out.overflowEls = out.overflowEls.slice(0, 18);
  Array.prototype.slice.call(document.querySelectorAll("label, p, h1, h2, h3, h4, h5, h6, a, button, td, th, .dam-catalog-fmcg__row-label, .dam-viz-card__title")).forEach(function(el){
    if (!vis(el) || el.children.length > 2) return;
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    var fs = parseFloat(cs.fontSize) || 0;
    var txt = (el.textContent || "").trim();
    if (r.width > 0 && r.width < 120 && txt.length > 8) {
      out.narrow.push({ sel: path(el), w: Math.round(r.width), fs: fs, wb: cs.wordBreak, ow: cs.overflowWrap, txt: txt.slice(0, 55) });
    }
    if (fs > 0 && fs < 12 && txt.length > 0) {
      out.smallText.push({ sel: path(el), fs: fs, txt: txt.slice(0, 40) });
    }
    if ((cs.wordBreak === "break-all" || cs.overflowWrap === "anywhere") && r.width < 280 && txt.length > 4) {
      out.wordBreak.push({ sel: path(el), w: Math.round(r.width), wb: cs.wordBreak, ow: cs.overflowWrap, txt: txt.slice(0, 50) });
    }
  });
  out.narrow = out.narrow.slice(0, 20);
  out.smallText = out.smallText.slice(0, 12);
  out.wordBreak = out.wordBreak.slice(0, 15);
  Array.prototype.slice.call(document.querySelectorAll("input, select, textarea")).forEach(function(el){
    if (!vis(el)) return;
    var cs = getComputedStyle(el); var fs = parseFloat(cs.fontSize) || 0;
    var r = el.getBoundingClientRect();
    if (fs < 16) out.iosZoom.push({ sel: path(el), id: el.id, type: el.type, fs: fs, w: Math.round(r.width), h: Math.round(r.height) });
  });
  out.iosZoom = out.iosZoom.slice(0, 16);
  ["#damHelpFab",".dam-help-fab","#damDbStatusFab",".dam-status-fab","#damIndexReport",".dam-index-report__card",".dam-fab"].forEach(function(sel){
    var el = document.querySelector(sel);
    if (!el || !vis(el)) return;
    var r = el.getBoundingClientRect();
    out.fabs.push({ sel: sel, w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left),
      top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) });
  });
  var ir = document.querySelector("#damIndexReport .dam-index-report__card, .dam-index-report__card");
  if (ir) {
    var irr = ir.getBoundingClientRect(); var ics = getComputedStyle(ir);
    out.indexReport = { sel: path(ir), w: Math.round(irr.width), h: Math.round(irr.height),
      left: Math.round(irr.left), top: Math.round(irr.top), display: ics.display, pos: ics.position };
  }
  Array.prototype.slice.call(document.querySelectorAll(".geex-content > *, .dam-catalog-fmcg, .dam-cost-panel, .dam-project-main, .dam-catalog-kpi-panel")).forEach(function(el){
    if (!vis(el)) return;
    var r = el.getBoundingClientRect();
    if (r.width > 40 && r.width < vw * 0.6 && r.height > 60 && r.top < vh + 400) {
      out.squeezed.push({ sel: path(el), w: Math.round(r.width), pct: Math.round(100 * r.width / vw), left: Math.round(r.left), h: Math.round(r.height) });
    }
  });
  out.squeezed = out.squeezed.slice(0, 12);
  return out;
})()`;

async function rehydrate() {
  const r = await fetch(`${BRIDGE}/auth/rehydrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(BOUND),
  });
  return r.json();
}

async function applyViewport(page, vp, light) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  if (light) return null;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: vp.dsf,
    mobile: true,
  });
  return cdp;
}

async function settle(page, spec) {
  if (spec.fast) {
    await page.waitForTimeout(1200);
    return;
  }
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  if (spec.wait) {
    await page.waitForSelector(spec.wait, { timeout: 8000 }).catch(() => {});
  }
  if (spec.ready) {
    await page.waitForSelector(spec.ready, { timeout: 10000 }).catch(() => {});
  }
  await Promise.race([
    page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())),
    page.waitForTimeout(2000),
  ]).catch(() => {});
  await page.waitForTimeout(600);
}

async function main() {
  const session = await rehydrate();
  if (!session || !session.ok || !session.token) {
    console.error("REHYDRATE_FAILED", session && session.error);
    process.exit(2);
  }
  const token = session.token;
  const user = session.user || { email: "krzysztof.wieczorek@kubara.pl", name: "Krzysztof Wieczorek", role: "admin" };

  const browser = await chromium.launch({ headless: true });
  const results = [];

  async function runPass(adminOn) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "pl-PL",
    });
    await context.addInitScript(
      ({ token, user, MID, DID, SID, adminOn }) => {
        try {
          localStorage.setItem("dam_token", token);
          localStorage.setItem("dam_machine_id", MID);
          localStorage.setItem("dam_device_id", DID);
          localStorage.setItem("dam_session_id", SID);
          localStorage.setItem("dam_role", String(user.role || "admin").toLowerCase());
          localStorage.setItem("dam_user_name", user.name || "");
          localStorage.setItem("dam_admin_mode", adminOn ? "1" : "0");
          localStorage.setItem("dam_viz_admin_mode", adminOn ? "1" : "0");
          localStorage.setItem(
            "dam_user",
            JSON.stringify({
              email: user.email || "",
              role: String(user.role || "admin").toLowerCase(),
              name: user.name || "",
            })
          );
        } catch (e) {}
        const orig = window.fetch;
        window.fetch = function (input, init) {
          const url = String(typeof input === "string" ? input : (input && input.url) || "");
          if (url.indexOf("/auth/identity") !== -1) {
            return Promise.resolve(
              new Response(JSON.stringify({ ok: true, machine_id: MID, device_id: DID }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              })
            );
          }
          if (url.indexOf("/auth/me") !== -1) {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  ok: true,
                  user: user,
                  device_id: DID,
                  machine_id: MID,
                  session_id: SID,
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          return orig.apply(this, arguments);
        };
      },
      {
        token,
        user,
        MID: BOUND.machine_id,
        DID: BOUND.device_id,
        SID: BOUND.session_id,
        adminOn,
      }
    );

    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const skipHeavy = process.argv.includes("--skip-heavy");
    const list = adminOn
      ? PAGES.filter((p) => p.id === "project" || p.id === "settings")
      : PAGES.filter((p) => !(skipHeavy && p.fast));

    for (const spec of list) {
      const prefix = adminOn ? spec.id + "-admin" : spec.id;
      for (const vp of VIEWPORTS) {
        const tag = `${prefix}-${vp.name}`;
        const shot = path.join(OUT, `${tag}.png`);
        const already = fs.existsSync(shot);
        if (already && !adminOn && ["signin", "index", "dashboard", "project", "costs", "invoices"].includes(spec.id)) {
          console.log("SKIP", tag);
          continue;
        }
        console.log(already ? "MEASURE" : "CAPTURE", tag);
        await applyViewport(page, vp, !!spec.fast);
        try {
          await page.goto(BASE + spec.url, {
            waitUntil: spec.fast ? "commit" : "domcontentloaded",
            timeout: spec.fast ? 12000 : 20000,
          });
        } catch (e) {
          results.push({ tag, error: String(e), href: page.url() });
          console.log("  goto_error", String(e).slice(0, 120));
          continue;
        }
        await settle(page, spec);
        if (spec.id === "settings") {
          await page.evaluate(() => {
            const el = document.querySelector("#damAppearance");
            if (el) el.scrollIntoView({ block: "start" });
          });
          await page.waitForTimeout(400);
        }
        if (spec.id === "project") {
          await page.evaluate(() => {
            const el = document.querySelector("section.dam-catalog-fmcg, .dam-catalog-kpi");
            if (el) el.scrollIntoView({ block: "start" });
          });
          await page.waitForTimeout(500);
        }
        if (!already) {
          try {
            const sess = await page.context().newCDPSession(page);
            const cap = await sess.send("Page.captureScreenshot", { format: "png", fromSurface: true });
            fs.writeFileSync(shot, Buffer.from(cap.data, "base64"));
          } catch (e) {
            console.log("  cdp_shot_error", String(e).slice(0, 80));
            try {
              await page.screenshot({ path: shot, fullPage: false, timeout: 6000 });
            } catch (e2) {
              console.log("  shot_error", String(e2).slice(0, 80));
            }
          }
        }
        let measure = null;
        try {
          measure = await Promise.race([
            page.evaluate(MEASURE_JS),
            page.waitForTimeout(8000).then(() => ({ error: "measure_timeout" })),
          ]);
        } catch (e) {
          measure = { error: String(e) };
        }
        const info = { tag, adminOn, file: shot, measure };
        if (vp.name === "390" && !adminOn && spec.id !== "explorer") {
          const full = path.join(OUT, `${prefix}-390-full.png`);
          await page.screenshot({ path: full, fullPage: true, timeout: 25000 });
          info.full = full;
        }
        if (spec.id === "project" && vp.name === "360") {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(OUT, `${prefix}-360-top.png`), fullPage: false });
        }
        results.push(info);
        console.log(
          "  vw",
          measure && measure.vw,
          "sw",
          measure && measure.sw,
          "fmcg",
          measure && measure.fmcg && measure.fmcg.length,
          "touch",
          measure && measure.touch && measure.touch.length,
          "signin",
          measure && measure.signin
        );
      }
    }
    await context.close();
  }

  await runPass(false);
  await runPass(true);
  await browser.close();
  fs.writeFileSync(path.join(OUT, "measurements.json"), JSON.stringify(results, null, 2));
  console.log("DONE", results.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
