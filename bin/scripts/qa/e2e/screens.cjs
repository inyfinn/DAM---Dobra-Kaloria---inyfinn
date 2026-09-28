// Zrzuty strony Branding (i Wizualizacji) dla instancji A/B/C - run_abc.py --phase screens.
// Uzycie: node screens.cjs <config.json>
// config: {playwright: <sciezka modulu>, out: <katalog>, instances: [{name, ui, bridge, token, user}]}
// Bezpiecznik: kazde zadanie do portow 8765/8766 (produkcyjny UI/most) jest przerywane i liczone.
"use strict";
const fs = require("fs");
const path = require("path");

async function main() {
  const cfg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const { chromium } = require(cfg.playwright);
  const browser = await chromium.launch({ headless: true });
  const report = [];
  try {
    for (const inst of cfg.instances) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const blocked = [];
      const bridgeCalls = new Set();
      await ctx.route(/^https?:\/\/(127\.0\.0\.1|localhost):(8765|8766)\//, (route) => {
        blocked.push(route.request().url());
        return route.abort();
      });
      await ctx.addInitScript(
        ({ bridge, token, user }) => {
          window.__DAM_BRIDGE__ = bridge;
          try {
            localStorage.setItem("dam_token", token);
            localStorage.setItem("dam_role", user.role || "admin");
            localStorage.setItem("dam_user_name", user.name || "");
            localStorage.setItem("dam_user", JSON.stringify({ email: user.email, name: user.name, role: user.role }));
          } catch (e) {}
        },
        { bridge: inst.bridge, token: inst.token, user: inst.user }
      );
      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
      page.on("request", (r) => { if (r.url().startsWith(inst.bridge)) bridgeCalls.add(new URL(r.url()).pathname); });
      const shots = {};
      for (const pg of ["branding.html", "visualizations.html"]) {
        const url = `${inst.ui}/${pg}`;
        let status = null;
        try {
          const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          status = resp ? resp.status() : null;
          await page.waitForTimeout(8000);
        } catch (e) {
          consoleErrors.push("goto: " + String(e).slice(0, 200));
        }
        const base = `${inst.name}-${pg.replace(".html", "")}`;
        // Najpierw stan zastany (np. okno wyboru ROOT na C), potem po "Zrobie to pozniej".
        await page.screenshot({ path: path.join(cfg.out, `${base}-start.png`), fullPage: false });
        let modalText = "";
        try {
          const later = page.getByText("Zrobię to później", { exact: false });
          if (await later.count()) {
            modalText = (await page.locator(".modal.show, [role=dialog]").first().innerText({ timeout: 2000 }).catch(() => "")).slice(0, 600);
            await later.first().click({ timeout: 3000 });
            await page.waitForTimeout(2500);
          }
        } catch (e) {}
        const file = path.join(cfg.out, `${base}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const cards = await page.evaluate(() => {
          const sel = ["[data-asset-id]", ".dam-viz-card", ".dam-branding-card", ".dam-card"];
          const ids = new Set();
          for (const s of sel) document.querySelectorAll(s).forEach((el) => ids.add(el.getAttribute("data-asset-id") || el.id || el.outerHTML.slice(0, 40)));
          // W8: stan miniatur na kartach (zaladowany obraz / "Podglad wkrotce" / brak) -
          // porownanie A/B/C w screens-report.json obok zrzutow.
          const thumbs = [];
          document.querySelectorAll("img[src*='thumb-cache']").forEach((img) => {
            const m = (img.getAttribute("src") || "").match(/[?&]path=([^&]+)/);
            let p = "";
            try { p = m ? decodeURIComponent(m[1]) : ""; } catch (e) { p = m ? m[1] : ""; }
            const i = p.search(/- POLSKA|- EKSPORT|-- ARCHIWUM --/);
            thumbs.push({ rel: i >= 0 ? p.slice(i) : p, loaded: img.complete && img.naturalWidth > 0,
                          w: img.naturalWidth, h: img.naturalHeight });
          });
          const noviz = Array.from(document.querySelectorAll(".dam-viz-thumb__noviz span")).map((el) => el.textContent.trim());
          return { count: ids.size, ids: Array.from(ids).slice(0, 50), title: document.title, url: location.href,
                   thumbs: thumbs.slice(0, 80), noviz: noviz.slice(0, 80) };
        });
        shots[pg] = { file, status, cards, root_modal_text: modalText };
      }
      report.push({ name: inst.name, shots, blocked_production_requests: blocked, bridge_paths: Array.from(bridgeCalls).sort(), console_errors: consoleErrors.slice(0, 20) });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(cfg.out, "screens-report.json"), JSON.stringify(report, null, 2));
  console.log("SCREENS_OK " + report.length);
}

main().catch((e) => { console.error(e); process.exit(1); });
