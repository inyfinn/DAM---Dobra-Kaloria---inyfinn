"use strict";
/**
 * Step 1 isolation: B warianty open + type asdhaskljdas with/without dam-tutorial.js.
 * Usage: node scripts/qa/_isolate-tutorial-step1.js [--tutorial on|off]
 * Logs fresh ISO timestamps + main-thread ping ms.
 */
const path = require("path");
const os = require("os");
const fs = require("fs");
const core = require("./lib/dam-cdp-assoc-probe-core");

const REPO = path.resolve(__dirname, "..", "..");
const BRANDING_HTML = path.join(REPO, "apps/web/branding.html");
const TUTORIAL_ON =
  '<script src="./assets/js/dam-tutorial.js?v=4.0.71-assocTutorialMoGuard20260726a"></script>';
const TUTORIAL_OFF =
  "<!-- ISOLATION: tutorial disabled for Step 1 -->\n  <!-- <script src=\"./assets/js/dam-tutorial.js?v=4.0.71-assocTutorialMoGuard20260726a\"></script> -->";

function setTutorialInHtml(on) {
  let html = fs.readFileSync(BRANDING_HTML, "utf8");
  if (on) {
    html = html.replace(TUTORIAL_OFF, TUTORIAL_ON);
  } else {
    html = html.replace(TUTORIAL_ON, TUTORIAL_OFF);
  }
  fs.writeFileSync(BRANDING_HTML, html, "utf8");
}

function tutorialCurrentlyOn() {
  const html = fs.readFileSync(BRANDING_HTML, "utf8");
  return html.includes(TUTORIAL_ON) && !html.includes("<!-- ISOLATION: tutorial disabled");
}

async function probeBVariant(tutorialMode) {
  const cta = core.CTAS.find((c) => c.id === "branding-variant");
  const port = tutorialMode === "on" ? 9391 : 9390;
  const ts = core.nowIso();
  const launch = core.launchChrome(core.findBrowser(), port, {
    userData: path.join(os.tmpdir(), "dam-iso-" + tutorialMode + "-" + Date.now()),
  });
  let cdp = null;
  const row = {
    ts,
    tutorial: tutorialMode,
    cta: "branding-variant",
    open_ok: false,
    open_ms: null,
    picker_ms: null,
    ping_max_ms: null,
    type_ok: false,
    type_ms: null,
    freeze: false,
    error: null,
  };
  try {
    await core.waitForDebugger(port, 40);
    const conn = await core.connectPageCdp(port);
    cdp = conn.cdp;
    const boot = await core.navigateAndBoot(cdp, cta);
    if (!boot.ok) {
      row.error = "boot:" + boot.error;
      return row;
    }
    for (let w = 0; w < 40; w++) {
      const n = await cdp.evaluate("document.querySelectorAll('.dam-branding-card').length", 3000);
      if (n > 0) break;
      await core.sleep(500);
    }
    const card = await cdp.evaluate(core.clickCardExpr(cta), 8000);
    if (!card || !card.ok) {
      row.error = "card:" + (card && card.error);
      return row;
    }
    await core.sleep(1800);
    const tCta = Date.now();
    const ctaClick = await cdp.evaluate(core.clickCtaExpr(cta), 12000);
    row.open_ms = ctaClick && ctaClick.open_ms;
    if (!ctaClick || !ctaClick.ok) {
      row.error = "cta:" + (ctaClick && ctaClick.error);
      return row;
    }
    const tPick = Date.now();
    let search = false;
    while (Date.now() - tPick < 10000) {
      search = await cdp.evaluate(
        "(() => { var s=document.querySelector('#damAssocEditSearch'); return !!(s && s.closest('#damAssocEditPopover')); })()",
        3000
      );
      if (search) break;
      await core.sleep(150);
    }
    row.picker_ms = Date.now() - tPick;
    row.open_ok = !!search;
    if (!search) {
      row.error = "picker_timeout";
      row.freeze = row.picker_ms > 3000;
      return row;
    }
    let pingMax = 0;
    for (let i = 0; i < 8; i++) {
      const t0 = Date.now();
      try {
        await cdp.evaluate(
          "(() => ({ pop: !!document.querySelector('#damAssocEditPopover'), emptyCls: (document.querySelector('#damAssocEditPopover .dam-tag-edit-popover__empty, #damAssocEditPopover .dam-assoc-edit-popover__empty-msg')||{}).className||null, tut: typeof window.DamTutorial }))()",
          3000
        );
        const dt = Date.now() - t0;
        if (dt > pingMax) pingMax = dt;
        if (dt > 3000) {
          row.freeze = true;
          row.error = "ping_blocked_" + dt + "ms";
        }
      } catch (e) {
        const dt = Date.now() - t0;
        pingMax = Math.max(pingMax, dt);
        row.freeze = true;
        row.error = "ping_fail_" + dt + "ms:" + String(e.message || e);
        break;
      }
      await core.sleep(300);
    }
    row.ping_max_ms = pingMax;
    const tType = Date.now();
    try {
      const typed = await cdp.evaluate(
        "(() => { var s=document.querySelector('#damAssocEditSearch'); if(!s) return {ok:false,err:'no_search'}; s.focus(); s.value='asdhaskljdas'; s.dispatchEvent(new Event('input',{bubbles:true})); return {ok:true}; })()",
        8000
      );
      row.type_ms = Date.now() - tType;
      row.type_ok = !!(typed && typed.ok);
      if (row.type_ms > 3000) {
        row.freeze = true;
        row.error = (row.error ? row.error + ";" : "") + "type_blocked_" + row.type_ms + "ms";
      }
    } catch (e) {
      row.type_ms = Date.now() - tType;
      row.freeze = true;
      row.error = (row.error ? row.error + ";" : "") + "type_fail:" + String(e.message || e);
    }
    row.open_ok = row.open_ok && !row.freeze;
    return row;
  } catch (e) {
    row.error = String(e.message || e);
    row.freeze = true;
    return row;
  } finally {
    if (cdp) cdp.close();
    core.killProc(launch.child);
    await core.sleep(300);
  }
}

(async () => {
  const arg = process.argv.find((a) => a.startsWith("--tutorial="));
  const mode = arg ? arg.split("=")[1] : "both";
  const results = [];
  const modes = mode === "both" ? ["off", "on"] : [mode];
  const origOn = tutorialCurrentlyOn();
  try {
    for (const m of modes) {
      setTutorialInHtml(m === "on");
      console.log("=== ISOLATE tutorial=" + m + " @ " + new Date().toISOString());
      const row = await probeBVariant(m);
      console.log(JSON.stringify(row));
      results.push(row);
    }
  } finally {
    setTutorialInHtml(origOn);
  }
  const off = results.find((r) => r.tutorial === "off");
  const on = results.find((r) => r.tutorial === "on");
  let verdict = "INCONCLUSIVE";
  if (off && on) {
    if (off.open_ok && !off.freeze && (on.freeze || !on.open_ok)) verdict = "CONFIRMED";
    else if (off.freeze && on.freeze) verdict = "REJECTED";
    else if (off.freeze && !on.freeze) verdict = "REJECTED";
    else if (!off.freeze && !on.freeze) verdict = "BOTH_PASS";
    else verdict = "INCONCLUSIVE";
  }
  console.log(
    "VERDICT",
    verdict,
    JSON.stringify({ off, on, ts: core.nowIso() })
  );
  process.exit(verdict === "REJECTED" || (on && on.freeze && !off) ? 2 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
