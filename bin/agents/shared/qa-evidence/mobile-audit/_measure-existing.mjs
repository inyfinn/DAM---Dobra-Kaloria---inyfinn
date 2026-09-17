import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEASURE_JS = `(() => {
  function path(el){ if(!el||!el.tagName) return ""; return el.tagName.toLowerCase()+(el.id?("#"+el.id):"")+(typeof el.className==="string"&&el.className?("."+el.className.trim().split(/\\s+/).slice(0,3).join(".")):""); }
  function vis(el){ var r=el.getBoundingClientRect(); var cs=getComputedStyle(el); return r.width>0&&r.height>0&&cs.display!=="none"; }
  var vw=innerWidth, vh=innerHeight, sw=document.documentElement.scrollWidth;
  var out={href:location.href,vw:vw,vh:vh,sw:sw,overflow:sw-vw,sidebar:null,header:null,fmcg:[],squeezed:[],narrow:[],wordBreak:[],touch:[],tables:[],iosZoom:[],fabs:[],indexReport:null};
  var sb=document.querySelector(".geex-sidebar");
  if(sb){ var r=sb.getBoundingClientRect(); var cs=getComputedStyle(sb); out.sidebar={w:Math.round(r.width),left:Math.round(r.left),transform:cs.transform,open:sb.classList.contains("is-open")}; }
  var hd=document.querySelector(".geex-content__header");
  if(hd){ var hr=hd.getBoundingClientRect(); out.header={h:Math.round(hr.height),w:Math.round(hr.width),pos:getComputedStyle(hd).position}; }
  ["section.dam-catalog-fmcg","div.dam-catalog-fmcg__inner","div.dam-catalog-kpi",".dam-catalog-fmcg__row-label",".dam-catalog-fmcg__row-text",".dam-catalog-fmcg__tile"].forEach(function(sel){
    document.querySelectorAll(sel).forEach(function(el,i){ if(i>5)return; var r=el.getBoundingClientRect(); var cs=getComputedStyle(el);
      out.fmcg.push({sel:sel,w:Math.round(r.width),left:Math.round(r.left),pct:Math.round(100*r.width/vw),wb:cs.wordBreak,ow:cs.overflowWrap,txt:(el.textContent||"").trim().slice(0,70)}); });
  });
  document.querySelectorAll("button, a.geex-btn, .dam-btn-icon, [role=button], .geex-content__header a, .geex-content__header button").forEach(function(el){
    if(!vis(el)) return; var r=el.getBoundingClientRect(); if(r.width<44||r.height<44) out.touch.push({sel:path(el),w:Math.round(r.width),h:Math.round(r.height),txt:((el.getAttribute("aria-label")||el.textContent||"").trim().slice(0,40))});
  });
  out.touch=out.touch.slice(0,20);
  document.querySelectorAll("table").forEach(function(t){ var r=t.getBoundingClientRect(); var pcs=t.parentElement?getComputedStyle(t.parentElement):null; out.tables.push({sel:path(t),w:Math.round(r.width),ov:Math.round(r.width-vw),parentOx:pcs?pcs.overflowX:""}); });
  document.querySelectorAll(".dam-catalog-fmcg__row-label, .dam-catalog-fmcg__tile-label, label, h2, h3").forEach(function(el){
    if(!vis(el)||el.children.length>2) return; var r=el.getBoundingClientRect(); var cs=getComputedStyle(el); var txt=(el.textContent||"").trim();
    if(r.width<120 && txt.length>8) out.narrow.push({sel:path(el),w:Math.round(r.width),ow:cs.overflowWrap,wb:cs.wordBreak,txt:txt.slice(0,55)});
    if(cs.overflowWrap==="anywhere"||cs.wordBreak==="break-all") out.wordBreak.push({sel:path(el),w:Math.round(r.width),ow:cs.overflowWrap,wb:cs.wordBreak,txt:txt.slice(0,50)});
  });
  document.querySelectorAll("input,select,textarea").forEach(function(el){ if(!vis(el))return; var fs=parseFloat(getComputedStyle(el).fontSize)||0; if(fs<16) out.iosZoom.push({id:el.id,type:el.type,fs:fs,w:Math.round(el.getBoundingClientRect().width)}); });
  ["#damHelpFab","#damDbStatusFab",".dam-index-report__card"].forEach(function(sel){ var el=document.querySelector(sel); if(!el||!vis(el))return; var r=el.getBoundingClientRect(); out.fabs.push({sel:sel,w:Math.round(r.width),h:Math.round(r.height),left:Math.round(r.left),top:Math.round(r.top)}); });
  var ir=document.querySelector(".dam-index-report__card");
  if(ir){ var irr=ir.getBoundingClientRect(); out.indexReport={w:Math.round(irr.width),h:Math.round(irr.height),left:Math.round(irr.left),top:Math.round(irr.top)}; }
  document.querySelectorAll(".geex-content > *, section.dam-catalog-fmcg, .dam-catalog-kpi, .dam-cost-panel").forEach(function(el){
    if(!vis(el))return; var r=el.getBoundingClientRect(); if(r.width>40&&r.width<vw*0.6&&r.height>60) out.squeezed.push({sel:path(el),w:Math.round(r.width),pct:Math.round(100*r.width/vw)});
  });
  return out;
})()`;
const BOUND = {
  machine_id: "dam-mid-a6a2acce751029d4e04eb1e410740948",
  device_id: "dam-dev-a6a2acce751029d4e04eb1e410740948",
  session_id: "dam-sid-25cqWILYSn_ohnXs23ofxrirRY0sAQNJ",
};
const jobs = [
  { id: "signin", url: "/signin.html", w: 360, h: 800 },
  { id: "index", url: "/index.html", w: 360, h: 800 },
  { id: "dashboard", url: "/dashboard.html", w: 360, h: 800 },
  { id: "project", url: "/project.html?id=figa-z-makiem-owocowe", w: 360, h: 800 },
  { id: "project", url: "/project.html?id=figa-z-makiem-owocowe", w: 390, h: 844 },
  { id: "project", url: "/project.html?id=figa-z-makiem-owocowe", w: 768, h: 1024 },
  { id: "costs", url: "/costs.html", w: 360, h: 800 },
  { id: "invoices", url: "/invoices.html", w: 360, h: 800 },
  { id: "settings", url: "/settings.html", w: 360, h: 800 },
  { id: "inbox", url: "/inbox.html", w: 360, h: 800 },
  { id: "tasks", url: "/tasks.html", w: 360, h: 800 },
];

const rh = await fetch("http://127.0.0.1:8766/auth/rehydrate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(BOUND),
}).then((r) => r.json());

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
await context.addInitScript(
  ({ token, user, MID, DID, SID }) => {
    localStorage.setItem("dam_token", token);
    localStorage.setItem("dam_machine_id", MID);
    localStorage.setItem("dam_device_id", DID);
    localStorage.setItem("dam_session_id", SID);
    localStorage.setItem("dam_role", "admin");
    localStorage.setItem("dam_admin_mode", "0");
    window.fetch = new Proxy(window.fetch, {
      apply(orig, thisArg, args) {
        const url = String(typeof args[0] === "string" ? args[0] : args[0] && args[0].url);
        if (url.includes("/auth/identity")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, machine_id: MID, device_id: DID }), { headers: { "Content-Type": "application/json" } }));
        }
        if (url.includes("/auth/me")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, user, device_id: DID, machine_id: MID, session_id: SID }), { headers: { "Content-Type": "application/json" } }));
        }
        return orig.apply(thisArg, args);
      },
    });
  },
  { token: rh.token, user: rh.user, MID: BOUND.machine_id, DID: BOUND.device_id, SID: BOUND.session_id }
);
const page = await context.newPage();
const out = [];
for (const job of jobs) {
  await page.setViewportSize({ width: job.w, height: job.h });
  await page.goto("http://127.0.0.1:8765" + job.url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(job.id === "project" ? 1600 : 700);
  if (job.id === "project") {
    await page.evaluate(() => { const el = document.querySelector("section.dam-catalog-fmcg"); if (el) el.scrollIntoView(); });
    await page.waitForTimeout(400);
  }
  const measure = await page.evaluate(MEASURE_JS);
  out.push({ tag: `${job.id}-${job.w}`, measure });
  console.log(job.id, job.w, "overflow", measure.overflow, "fmcg", (measure.fmcg || []).slice(0, 3), "sidebar", measure.sidebar, "squeezed", measure.squeezed, "touchN", (measure.touch || []).length);
}
fs.writeFileSync(path.join(__dirname, "measurements-core.json"), JSON.stringify(out, null, 2));
await browser.close();
console.log("CORE_DONE");
