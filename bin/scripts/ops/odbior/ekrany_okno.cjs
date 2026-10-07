// Zrzuty OKNA PROGRAMU DAM (pywebview/WebView2) instancji testu odbioru - wylacznie przez CDP.
// Decyzja wlasciciela 07.10.2026: DAM-u nie otwieramy w przegladarce (brak dostepu do dyskow,
// falszywe wyniki). Ten skrypt NIE uruchamia zadnej przegladarki: podlacza sie (connectOverCDP)
// do okna, ktore wystartowal launcher_odbior.py w trybie "okno".
//
// Uzycie: node ekrany_okno.cjs <config.json>   (wolane przez odbior.py)
// config: {playwright, out, cdp:"http://127.0.0.1:<port>", t0_ms, points:[5,15,30,60,180], login:bool}
// Haslo konta testowego: tylko zmienne ODBIOR_EMAIL / ODBIOR_PASSWORD (nigdy na dysk).
// Jedno logowanie formularzem (tak jak czlowiek), na koncu wylogowanie - takze po bledzie.
// Okno ma jedna strone, wiec plan jest planem czlowieka: w kazdej zadanej sekundzie zrzut tego,
// co akurat widac ("okno"), a od trzeciego punktu po zrzucie przejscie na drugi ekran
// (Pulpit <-> Projekty) i zrzut po wejsciu. Kazdy zrzut zapisuje, kiedy strona zostala wczytana.
// Bezpiecznik: zadania do portow 8765/8766 (DAM uzytkownika) sa przerywane i liczone.
"use strict";
const fs = require("fs");
const path = require("path");

const cfg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const { chromium } = require(cfg.playwright);
const T = () => (Date.now() - cfg.t0_ms) / 1000;
const r1 = (n) => Math.round(n * 10) / 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(Math.round(n)).padStart(3, "0");
const report = { mode: "okno programu przez CDP", cdp: cfg.cdp, cdp_connected_s: null, login: {}, shots: [],
                 blocked_production_requests: [], console_errors: [], failed_responses: {}, bridge_status: {},
                 fps: [], logout: {}, errors: [] };

// Haslo nie moze trafic na dysk nawet przez komunikat bledu (dziennik wywolan fill()).
function clean(text) {
  const pw = process.env.ODBIOR_PASSWORD;
  return pw ? String(text).split(pw).join("***") : String(text);
}

function save() {
  fs.writeFileSync(path.join(cfg.out, "ekrany.json"), clean(JSON.stringify(report, null, 2)));
}

const timeout = (ms, value) => new Promise((r) => setTimeout(() => r(value), ms));

async function info(page) {
  const work = page.evaluate((t0) => {
    let idx = null;
    try { idx = window.DamFileIndex && window.DamFileIndex.peek && window.DamFileIndex.peek(); } catch (e) {}
    const txt = document.body ? document.body.innerText : "";
    const lines = txt.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const re = /indeks|katalog|z bazy|paczk|instalator|lokaln|aktualn|pobiera|synchroniz|ładow|łączenie|offline|brak danych|brak połączenia|wstrzyman|bez folderu|miniatur/i;
    const imgs = Array.from(document.images);
    const thumbs = imgs.filter((i) => /thumb/i.test(i.currentSrc || i.src || ""));
    const products = idx ? idx.products || [] : [];
    const el = (id) => { const e = document.getElementById(id); return e ? e.textContent.trim().slice(0, 240) : null; };
    const shown = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
      return r.width > 40 && r.height > 40 && s.visibility !== "hidden" && s.display !== "none" && r.bottom > 0 && r.top < innerHeight; };
    const modal = Array.from(document.querySelectorAll(".modal.show, [role=dialog], .dam-tour, .dam-mascot-bubble")).filter(shown)[0];
    return {
      url: location.href, title: document.title,
      loaded_at_s: Math.round((performance.timeOrigin - t0) / 100) / 10,
      has_pywebview_api: !!(window.pywebview && window.pywebview.api),
      file_index_in_page: idx ? {
        generated_at: idx.generated_at || null, products: products.length,
        kreatyna: products.filter((p) => /kreatyn/i.test((p.id || "") + " " + (p.name || ""))).map((p) => p.id),
      } : null,
      text_kreatyna: (txt.match(/kreatyn/gi) || []).length,
      project_cards: document.querySelectorAll(".dam-project-card__title").length,
      thumbs_total: thumbs.length,
      thumbs_loaded: thumbs.filter((i) => i.complete && i.naturalWidth > 0).length,
      imgs_broken: imgs.filter((i) => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src)).length,
      status_projects: el("damProjectsStatus"), sidebar_version: el("damSidebarVersion"),
      index_source_labels: Array.from(document.querySelectorAll(".dam-index-source")).map((e) => e.textContent.trim()),
      source_lines: lines.filter((s) => s.length < 260 && re.test(s)).slice(0, 30),
      window_on_top_text: modal ? (modal.innerText || "").trim().replace(/\s+/g, " ").slice(0, 300) : "",
      visibility: document.visibilityState, text_len: txt.length,
    };
  }, cfg.t0_ms).catch((e) => ({ error: String(e).slice(0, 200) }));
  return Promise.race([work, timeout(6000, { error: "strona nie odpowiedziala w 6 s (watek zajety)" })]);
}

async function fps(page, label) {
  const work = page.evaluate(() => new Promise((res) => {
    let n = 0; const t = performance.now();
    const tick = () => { n++; if (performance.now() - t < 1000) requestAnimationFrame(tick); else res(n); };
    requestAnimationFrame(tick);
    setTimeout(() => res(n), 1500);
  })).catch(() => null);
  const v = await Promise.race([work, timeout(4000, null)]);
  report.fps.push({ at_s: r1(T()), label, frames_per_s: v });
  return v;
}

async function shot(page, planned, name) {
  const file = path.join(cfg.out, `t${pad(planned)}-${name}.png`);
  const t = T();
  const t1 = Date.now();
  let ok = true;
  try {
    await page.screenshot({ path: file, fullPage: false, timeout: 15000 });
  } catch (e) {
    ok = false;
    report.errors.push(`zrzut ${name}@${planned}: ${clean(e).slice(0, 160)}`);
  }
  const shot_ms = Date.now() - t1;
  const t2 = Date.now();
  const rec = { planned_s: planned, actual_s: r1(t), name, file: ok ? file : "", shot_ms, info: await info(page) };
  rec.info_ms = Date.now() - t2;
  report.shots.push(rec);
  save();
  return rec;
}

// Komputer bez ROOT: okno "Sciezka Marketing na tym komputerze" zaslania kazdy ekran, dopoki czlowiek
// nie kliknie "Zrobie to pozniej". Zrzut surowy juz jest; klikamy tak jak czlowiek i robimy drugi.
async function dismissRootModal(page, planned, name) {
  try {
    const later = page.locator("#damBasePathSkip, button.dam-basepath-later").or(page.getByRole("button", { name: "Zrobię to później" }));
    if ((await later.count()) && (await later.first().isVisible())) {
      await later.first().click({ timeout: 3000 });
      report.root_modal_dismissed = (report.root_modal_dismissed || 0) + 1;
      await sleep(900);
      await shot(page, planned, name + "-po-zrobie-to-pozniej");
    }
  } catch (e) { /* okna nie ma albo zniknelo samo */ }
}

async function connect() {
  // connect_delay_s: nie dotykaj okna przez pierwsze N s (proba kontrolna: czy program sam, bez CDP, startuje czysto)
  if (cfg.connect_delay_s) { const w = cfg.connect_delay_s - T(); if (w > 0) await sleep(w * 1000); }
  for (;;) {
    try {
      const b = await chromium.connectOverCDP(cfg.cdp, { timeout: 3000 });
      report.cdp_connected_s = r1(T());
      return b;
    } catch (e) {
      if (T() > (cfg.connect_timeout_s || 120) + (cfg.connect_delay_s || 0)) throw new Error("okno programu nie wystawilo CDP: " + clean(e).slice(0, 200));
      await sleep(250);
    }
  }
}

async function firstPage(browser) {
  for (;;) {
    for (const ctx of browser.contexts()) {
      const pg = cfg.start_url ? ctx.pages()[0] : ctx.pages().find((p) => /^https?:/.test(p.url()));
      if (pg) return pg;
    }
    if (T() > (cfg.connect_timeout_s || 120) + (cfg.connect_delay_s || 0)) throw new Error("okno nie ma strony http");
    await sleep(200);
  }
}

async function loginFlow(page) {
  if (!(cfg.login && process.env.ODBIOR_EMAIL && process.env.ODBIOR_PASSWORD)) {
    report.login = { ok: false, error: "bez logowania" };
    return;
  }
  try {
    await page.waitForSelector("#authEmail", { state: "visible", timeout: 90000 });
    report.login.form_visible_s = r1(T());
    await page.fill("#authEmail", process.env.ODBIOR_EMAIL);
    await page.fill("#authPassword", process.env.ODBIOR_PASSWORD);
    report.login.submitted_s = r1(T());
    await page.click("#authSubmit");
    await page.waitForURL("**/dashboard.html*", { timeout: 90000 });
    report.login.dashboard_s = r1(T());
    report.login.ok = true;
  } catch (e) {
    report.login.ok = false;
    report.login.error = clean(e).slice(0, 240);
  }
  report.login.device = await page.evaluate(() => ({
    device_id: localStorage.getItem("dam_device_id"), machine_id: localStorage.getItem("dam_machine_id"),
    user: localStorage.getItem("dam_user_name"), has_token: !!localStorage.getItem("dam_token"),
  })).catch(() => ({}));
  save();
}

async function logout(page) {
  if (!report.login.ok || report.logout.at_s) return;
  report.logout = await page.evaluate(async () => {
    try {
      const rt = await (await fetch("/dam-runtime.json", { cache: "no-store" })).json();
      const r = await fetch(rt.bridge + "/auth/logout", { method: "POST",
        headers: { Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""), "Content-Type": "application/json" },
        body: "{}" });
      return { status: r.status, body: (await r.text()).slice(0, 200) };
    } catch (e) { return { error: String(e).slice(0, 200) }; }
  }).catch((e) => ({ error: clean(e).slice(0, 200) }));
  report.logout.at_s = r1(T());
}

// Przejscie na DRUGI ekran niz ten, ktory wlasnie widac (Pulpit <-> Projekty), jak zrobilby czlowiek.
async function enter(page, planned) {
  const target = /\/index\.html/.test(page.url()) ? "pulpit" : "projekty";
  const [name, file, ready] = target === "projekty"
    ? ["projekty-po-wejsciu", "/index.html", () => document.querySelectorAll(".dam-project-card__title").length > 0]
    : ["pulpit-po-wejsciu", "/dashboard.html", () => window.__damBootSucceeded === true];
  const origin = new URL(page.url()).origin;
  const t = T();
  await page.goto(origin + file, { waitUntil: "domcontentloaded", timeout: 30000 }).catch((e) => report.errors.push(`wejscie ${name}: ${clean(e).slice(0, 120)}`));
  const okReady = await page.waitForFunction(ready, null, { timeout: 20000 }).then(() => true).catch(() => false);
  const readyAfter = r1(T() - t);
  await sleep(1500);
  const rec = await shot(page, planned, name);
  rec.navigation = { started_s: r1(t), content_ready: okReady, content_ready_after_s: readyAfter };
  save();
  await dismissRootModal(page, planned, name);
}

async function main() {
  fs.mkdirSync(cfg.out, { recursive: true });
  const browser = await connect();
  let page = null;
  try {
    page = await firstPage(browser);
    if (cfg.only_logout) {  // --stop: zamknij sesje okna zostawionego dla recenzentow
      report.login.ok = true;
      await logout(page);
      console.log("WYLOGOWANO " + JSON.stringify(report.logout));
      report.login.ok = false;
      return;
    }
    report.first_page_s = r1(T());
    await page.context().route(/^https?:\/\/(127\.0\.0\.1|localhost):(8765|8766)\//, (route) => {
      report.blocked_production_requests.push(`${route.request().method()} ${route.request().url().slice(0, 160)}`);
      return route.abort();
    }).catch((e) => report.errors.push("route: " + clean(e).slice(0, 120)));
    // WebView2 ma --host-rules odcinajace 8765/8766; tu tylko liczymy proby (takze te sprzed CDP sa odciete).
    page.on("requestfailed", (r) => {
      if (/^https?:\/\/(127\.0\.0\.1|localhost):(8765|8766)\//.test(r.url())) report.blocked_production_requests.push(`${r.method()} ${r.url().slice(0, 160)} (odciete)`);
    });
    page.on("console", (m) => { if (m.type() === "error" && report.console_errors.length < 60) report.console_errors.push(`${T().toFixed(1)}s ${m.text().slice(0, 220)}`); });
    page.on("response", (r) => {
      let u;
      try { u = new URL(r.url()); } catch (e) { return; }
      if (r.status() >= 400) { const k = `${r.status()} ${u.pathname}`; report.failed_responses[k] = (report.failed_responses[k] || 0) + 1; }
      if (!/\.(js|css|png|svg|avif|woff2?|json|html|ico|jpg|webp|map)$/.test(u.pathname)) {
        const k = `${r.request().method()} ${u.pathname} ${r.status()}`;
        report.bridge_status[k] = (report.bridge_status[k] || 0) + 1;
      }
    });
    if (cfg.start_url) {  // okno czekalo na pustej stronie: pierwsze wejscie na program dopiero teraz, z nasluchem
      // Pusta strona startowa musi sie najpierw wczytac do konca: wejscie w trakcie jej ladowania
      // konczy sie net::ERR_ABORTED (okno zostaje na about:blank). Potem do 5 prob wejscia.
      await page.waitForFunction(() => document.readyState === "complete" && document.title === "DAM", null, { timeout: 15000 }).catch(() => {});
      report.start_navigation_s = r1(T());
      for (let i = 0; i < 5; i++) {
        const err = await page.goto(cfg.start_url, { waitUntil: "commit", timeout: 30000 }).then(() => null, (e) => clean(e).slice(0, 160));
        if (!err && /^https?:/.test(page.url())) break;
        report.start_navigation_retries = i + 1;
        if (i === 4) report.errors.push("start: " + err);
        await sleep(500);
      }
    }
    const login = loginFlow(page);  // rownolegle do osi czasu: zrzuty sa w zadanych sekundach, nie "po logowaniu"
    let step = 0;
    for (const p of cfg.points) {
      const wait = p - T();
      if (wait > 0) await sleep(wait * 1000);
      await shot(page, p, "okno");
      await dismissRootModal(page, p, "okno");
      step += 1;
      if (report.login.ok) {
        await fps(page, `t${p}`);  // ok. 60 = okno renderuje normalnie; ok. 1 = okno dlawione, pomiar falszywy
        if (step >= 3) await enter(page, p);
      }
    }
    await Promise.race([login, timeout(1000)]);
  } finally {
    if (page && !cfg.keep_session) await logout(page).catch(() => {});
    if (!cfg.only_logout) save();
    await browser.close().catch(() => {});  // CDP: tylko rozlaczenie, okno programu zostaje
  }
  if (!cfg.only_logout) console.log("EKRANY_OK " + report.shots.length);
}

main().catch((e) => { report.errors.push(clean(e).slice(0, 400)); save(); console.error(clean(e && e.stack || e)); process.exit(1); });
