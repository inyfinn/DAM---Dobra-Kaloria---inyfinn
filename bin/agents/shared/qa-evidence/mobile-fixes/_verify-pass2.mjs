import { chromium } from "../mobile-audit/node_modules/playwright/index.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = "http://127.0.0.1:8765";

async function main() {
  const token = process.env.DAM_TOKEN;
  const MID = process.env.DAM_MID;
  const DID = process.env.DAM_DID;
  const SID = process.env.DAM_SID;
  const browser = await chromium.launch({ headless: true, channel: "chrome", timeout: 20000 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "pl-PL",
  });
  await context.addInitScript(
    ({ token, MID, DID, SID }) => {
      try {
        localStorage.setItem("dam_token", token);
        localStorage.setItem("dam_machine_id", MID);
        localStorage.setItem("dam_device_id", DID);
        localStorage.setItem("dam_session_id", SID);
        localStorage.setItem("dam_role", "admin");
        localStorage.setItem("dam_tutorial_done", "1");
        localStorage.setItem("dam_tutorial_dismissed", "1");
        localStorage.setItem("dam_onboarding_done", "1");
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
            new Response(JSON.stringify({ ok: true, user: { role: "admin", name: "K" }, device_id: DID, machine_id: MID, session_id: SID }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        return orig.apply(this, arguments);
      };
    },
    { token, MID, DID, SID }
  );

  const page = await context.newPage();
  const extra = {};

  async function openNarrow(url, w, h) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(600);
    await page.evaluate(function () {
      document.querySelectorAll(".dam-tutorial, .dam-tutorial-card, [class*='tutorial']").forEach(function (el) {
        if (el && el.style) el.style.display = "none";
      });
      var overlay = document.querySelector(".dam-tutorial-overlay, .dam-onboarding, #damTutorial");
      if (overlay) overlay.remove();
    });
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
  }

  await openNarrow("/dashboard.html", 360, 800);
  await page.evaluate(function () {
    var t = document.querySelector("#dw-title-newest_viz_3, h3.dam-widget__title");
    if (t && t.scrollIntoView) t.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "dashboard-360.png"), fullPage: false });
  extra.dash360 = await page.evaluate(function () {
    var t = document.querySelector("#dw-title-newest_viz_3");
    var r = t ? t.getBoundingClientRect() : null;
    return {
      href: location.href,
      tutorial: !!document.querySelector(".dam-tutorial, .dam-tutorial-card"),
      titleW: r ? Math.round(r.width) : null,
      titleTxt: t ? (t.textContent || "").trim() : null,
    };
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.evaluate(function () {
    var t = document.querySelector("#dw-title-newest_viz_3");
    if (t && t.scrollIntoView) t.scrollIntoView({ block: "start" });
  });
  await page.screenshot({ path: path.join(OUT, "dashboard-390.png"), fullPage: false });

  await openNarrow("/index.html", 390, 844);
  await page.waitForSelector(".dam-project-card, .dam-projects-show-more", { timeout: 15000 }).catch(function () {});
  await page.evaluate(function () {
    var c = document.querySelector(".dam-project-card");
    if (c && c.scrollIntoView) c.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "projects-390.png"), fullPage: false });
  extra.projects = await page.evaluate(function () {
    return {
      docH: document.documentElement.scrollHeight,
      cards: document.querySelectorAll(".dam-project-card").length,
      more: !!(document.querySelector(".dam-projects-show-more") && document.querySelector(".dam-projects-show-more").textContent),
      moreTxt: (document.querySelector(".dam-projects-show-more") && document.querySelector(".dam-projects-show-more").textContent) || "",
    };
  });

  var search = page.locator("#damProjectsSearch");
  if (await search.count()) {
    await search.focus();
    await page.waitForTimeout(200);
    extra.search = await page.evaluate(function () {
      var el = document.querySelector("#damProjectsSearch");
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      return { fs: parseFloat(cs.fontSize), w: Math.round(r.width), h: Math.round(r.height) };
    });
    await page.screenshot({ path: path.join(OUT, "input-focus-390.png"), fullPage: false });
  }

  await openNarrow("/costs.html", 360, 800);
  extra.costsInputs = await page.evaluate(function () {
    var out = [];
    document.querySelectorAll("input[type=text], input[type=number], input[type=search], input:not([type])").forEach(function (el, i) {
      if (i > 8) return;
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      if (r.width < 8) return;
      out.push({ id: el.id, type: el.type, fs: parseFloat(cs.fontSize), w: Math.round(r.width), h: Math.round(r.height) });
    });
    return out;
  });

  async function timePage(url, name) {
    var t0 = Date.now();
    var err = null;
    try {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 12000 });
      var mark = await page.evaluate(function () {
        var t = performance.now();
        return { t: Math.round(t), nodes: document.querySelectorAll("*").length, href: location.href };
      });
      await page.waitForTimeout(1500);
      var later = await page.evaluate(function () {
        return { t: Math.round(performance.now()), nodes: document.querySelectorAll("*").length, href: location.href };
      });
      return { name, ms: Date.now() - t0, mark, later };
    } catch (e) {
      err = String(e && e.message ? e.message : e);
      return { name, ms: Date.now() - t0, err };
    }
  }

  extra.perf = [];
  extra.perf.push(await timePage("/explorer.html", "explorer"));
  extra.perf.push(await timePage("/visualizations.html", "visualizations"));
  extra.perf.push(await timePage("/branding.html", "branding"));

  fs.writeFileSync(path.join(OUT, "measurements-pass2.json"), JSON.stringify(extra, null, 2), "utf8");
  console.log(JSON.stringify(extra, null, 2));
  await browser.close();
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
