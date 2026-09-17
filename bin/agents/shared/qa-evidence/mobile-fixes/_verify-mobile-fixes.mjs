import { chromium } from "../mobile-audit/node_modules/playwright/index.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = "http://127.0.0.1:8765";
const BRIDGE = "http://127.0.0.1:8766";
const BOUND = {
  machine_id: process.env.DAM_MID || "",
  device_id: process.env.DAM_DID || "",
  session_id: process.env.DAM_SID || "",
  token: process.env.DAM_TOKEN || "",
};

const MEASURE = `(() => {
  function vis(el){
    if (!el) return false;
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
  }
  var titles = [];
  document.querySelectorAll("h3.dam-widget__title").forEach(function(el){
    var r = el.getBoundingClientRect();
    titles.push({ id: el.id, w: Math.round(r.width), h: Math.round(r.height), txt: (el.textContent||"").trim().slice(0,60) });
  });
  var handles = [];
  document.querySelectorAll(".dam-bento-handle").forEach(function(el){
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    handles.push({
      cls: el.className,
      w: Math.round(r.width), h: Math.round(r.height),
      display: cs.display, vis: cs.visibility
    });
  });
  var inputs = [];
  document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea").forEach(function(el, i){
    if (i > 12) return;
    var r = el.getBoundingClientRect();
    inputs.push({
      id: el.id, type: el.type || el.tagName, fs: parseFloat(getComputedStyle(el).fontSize)||0,
      w: Math.round(r.width), h: Math.round(r.height), vis: vis(el)
    });
  });
  var cards = document.querySelectorAll(".dam-project-card, article.dam-project-card").length;
  var more = !!document.querySelector(".dam-projects-show-more");
  return {
    href: location.href,
    signin: /signin/i.test(location.pathname),
    vw: innerWidth, vh: innerHeight,
    docH: Math.round(document.documentElement.scrollHeight),
    titles: titles,
    handles: handles,
    inputs: inputs,
    cards: cards,
    more: more,
    controlFsToken: getComputedStyle(document.documentElement).getPropertyValue("--dam-control-fs").trim()
  };
})()`;

async function rehydrate() {
  const r = await fetch(BRIDGE + "/auth/rehydrate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(BOUND),
  });
  return r.json();
}

async function main() {
  var session = { ok: true, token: BOUND.token };
  if (!BOUND.token) {
    console.log("rehydrate");
    session = await rehydrate();
  } else {
    console.log("using env session");
  }
  if (!session || !session.ok || !session.token) {
    console.error("REHYDRATE_FAILED", session && session.error);
    process.exit(2);
  }
  const token = session.token;
  const user = session.user || {
    email: "krzysztof.wieczorek@kubara.pl",
    name: "Krzysztof Wieczorek",
    role: "admin",
  };
  const MID = BOUND.machine_id;
  const DID = BOUND.device_id;
  const SID = BOUND.session_id;

  console.log("launching chrome");
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
    timeout: 20000,
  });
  console.log("browser up");
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    locale: "pl-PL",
  });
  await context.addInitScript(
    ({ token, user, MID, DID, SID }) => {
      try {
        localStorage.setItem("dam_token", token);
        localStorage.setItem("dam_machine_id", MID);
        localStorage.setItem("dam_device_id", DID);
        localStorage.setItem("dam_session_id", SID);
        localStorage.setItem("dam_role", String(user.role || "admin").toLowerCase());
        localStorage.setItem("dam_user_name", user.name || "");
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
    { token, user, MID, DID, SID }
  );

  const page = await context.newPage();
  const report = { session: "ok", frames: [] };

  async function goDesktopThenNarrow(url, w, h, waitSel) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector(waitSel || ".geex-content", { timeout: 12000 }).catch(function () {});
    await page.waitForTimeout(800);
    const desk = await page.evaluate(function () {
      return { href: location.href, signin: /signin/i.test(location.pathname) };
    });
    if (desk.signin) return { blocked: true, desk };
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(700);
    return { blocked: false, desk };
  }

  async function shot(name) {
    const dest = path.join(OUT, name);
    await page.screenshot({ path: dest, fullPage: false });
    const st = fs.statSync(dest);
    return { path: dest, bytes: st.size };
  }

  console.log("dashboard 360");
  var nav = await goDesktopThenNarrow("/dashboard.html", 360, 800, ".dam-dash-grid, .geex-content");
  if (nav.blocked) {
    report.blocked = "signin after dashboard nav";
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    process.exit(3);
  }
  await page.waitForTimeout(900);
  const dash360 = await page.evaluate(MEASURE);
  const s360 = await shot("dashboard-360.png");
  report.frames.push({ name: "dashboard-360", measure: dash360, shot: s360 });

  console.log("dashboard 390");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const dash390 = await page.evaluate(MEASURE);
  const s390 = await shot("dashboard-390.png");
  report.frames.push({ name: "dashboard-390", measure: dash390, shot: s390 });

  console.log("projects 390");
  nav = await goDesktopThenNarrow("/index.html", 390, 844, "#damProjectsGrid, .geex-content");
  if (nav.blocked) {
    report.blocked = "signin after index nav";
  } else {
    await page.waitForSelector("#damProjectsGrid .dam-project-card, .dam-projects-show-more, .dam-page-status", {
      timeout: 15000,
    }).catch(function () {});
    await page.waitForTimeout(1200);
    const idx390 = await page.evaluate(MEASURE);
    const si = await shot("projects-390.png");
    report.frames.push({ name: "projects-390", measure: idx390, shot: si });

    const focused = await page.evaluate(function () {
      var el = document.querySelector("#damProjectsSearch, input[type=search], input[type=text]");
      if (!el) return null;
      el.focus();
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      return {
        id: el.id,
        type: el.type,
        fs: parseFloat(cs.fontSize) || 0,
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    });
    const sf = await shot("input-focus-390.png");
    report.frames.push({ name: "input-focus-390", measure: focused, shot: sf });
  }

  const outJson = path.join(OUT, "measurements-after.json");
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
