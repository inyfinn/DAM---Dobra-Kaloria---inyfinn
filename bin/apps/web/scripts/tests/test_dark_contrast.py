# -*- coding: utf-8 -*-
"""Kontrast w ciemnym motywie - kazda strona i glowne okna. Narzedzie deweloperskie.

Run (UI i most musza dzialac, np. kopia robocza na 8865/8866):
  python bin/apps/web/scripts/tests/test_dark_contrast.py --base http://127.0.0.1:8865 \
      --email qa.dark@inyfinn.test --password test

Wymaganie uzytkownika (2026-09-22): "popraw kontrasty i widocznosc, bo nie widac w trybie
dark. nie widac Batony, kulki... elementy dalej sa szarawe albo jasne".

Jak liczymy, zeby "0 naruszen" cos znaczylo:
  - TLO to piksele ze zrzutu ekranu z ukrytym tekstem (color: transparent), mediana pod
    prostokatem napisu. Dzieki temu gradient, obraz tla, nakladka modalu i polprzezroczystosc
    licza sie tak, jak widzi je oko - nie przez chodzenie w gore DOM.
  - Liczone sa tylko elementy naprawde widoczne: niezerowy prostokat w oknie i
    elementFromPoint w srodku trafia w ten element (nie jest przykryty ani uciety).
  - Pseudo-elementy ::before/::after z tekstem, placeholder pol i tekst w polach.
  - Kolor tekstu z przezroczystoscia i opacity przodkow jest mieszany z tlem.
  - Osobno: "jasne powierzchnie" - element >= 40x20 z nieprzezroczystym tlem o jasnosci > 0.6.
  - Samosprawdzenie (--expect-known): znane bledy z 2026-09-22 MUSZA zostac zlapane.
    Jesli nie - zly jest test, nie aplikacja.

Kod wyjscia: 0 = 0 naruszen; 1 = sa naruszenia; 2 = samosprawdzenie nie zlapalo znanych bledow.
"""
from __future__ import annotations

import argparse
import io
import json
import re
import statistics
import sys
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

WEB = Path(__file__).resolve().parents[2]
VIEWPORT = {"width": 1600, "height": 2400}
MIN_NORMAL = 4.5
MIN_LARGE = 3.0
LIGHT_SURFACE_LUM = 0.6

SKIP_PAGES = {"index-geex", "signin", "signin-geex"}

# Znane bledy zgloszone zrzutami 2026-09-22 (strona, selektor, opis).
KNOWN = [
    ("explorer", ".dam-folder-item__name", "Eksplorer: nazwy kategorii (Batony, Kulki...)"),
    ("index", ".dam-card-checklist", "Projekty: biale panele listy kompletnosci w kartach"),
    ("branding#modal", ".dam-viz-modal__actions", "Okno materialu: bialy pasek przyciskow"),
    ("branding#quiz", ".dam-assoc-quiz__panel", "Quiz skojarzen: bialy panel"),
]

HIDE_TEXT_CSS = """
*, *::before, *::after, *::placeholder {
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  text-shadow: none !important;
  caret-color: transparent !important;
}
"""

COLLECT_JS = r"""
(known) => {
  const out = { texts: [], surfaces: [] };
  const vw = window.innerWidth, vh = window.innerHeight;
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const path = (el) => {
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && parts.length < 4) {
      let s = n.tagName.toLowerCase();
      if (n.id) { s += "#" + n.id; parts.unshift(s); break; }
      const cls = [...n.classList].filter(c => !/^(is-|has-|js-)/.test(c)).slice(0, 2);
      if (cls.length) s += "." + cls.join(".");
      parts.unshift(s);
      n = n.parentElement;
    }
    return parts.join(" > ");
  };
  const opacityChain = (el) => {
    let o = 1, n = el;
    while (n && n.nodeType === 1) { o *= parseFloat(getComputedStyle(n).opacity || "1"); n = n.parentElement; }
    return o;
  };
  const visibleRect = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    if (r.bottom <= 0 || r.right <= 0 || r.top >= vh || r.left >= vw) return null;
    const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2));
    const cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) return null;
    return r;
  };
  const knownTags = (el) => known.filter(k => el.closest(k)).map(k => k);
  const pushText = (el, kind, color, text, fontPx, weight) => {
    const r = visibleRect(el);
    if (!r) return;
    const c = parse(color);
    if (!c || c[3] === 0) return;
    const op = opacityChain(el);
    if (op < 0.05) return;
    out.texts.push({
      sel: path(el), kind, text: text.slice(0, 60), color: c, opacity: op,
      rect: [r.left, r.top, r.width, r.height], font_px: fontPx, weight,
      known: knownTags(el),
    });
  };
  const all = document.body ? document.body.querySelectorAll("*") : [];
  for (const el of all) {
    const tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEMPLATE") continue;
    if (el.closest("svg")) continue;
    const cs = getComputedStyle(el);
    // tekst wlasny elementu (bezposrednie wezly tekstowe)
    let own = "";
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.textContent;
    own = own.replace(/\s+/g, " ").trim();
    if (own && /[\p{L}\p{N}]/u.test(own)) {
      pushText(el, "text", cs.color, own, parseFloat(cs.fontSize), parseInt(cs.fontWeight, 10) || 400);
    }
    if ((tag === "INPUT" || tag === "TEXTAREA") && el.type !== "hidden" && el.type !== "checkbox" && el.type !== "radio" && el.type !== "range" && el.type !== "color") {
      if (el.value) pushText(el, "value", cs.color, el.value, parseFloat(cs.fontSize), 400);
      else if (el.placeholder) pushText(el, "placeholder", getComputedStyle(el, "::placeholder").color, el.placeholder, parseFloat(cs.fontSize), 400);
    }
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      const content = ps.content;
      if (!content || content === "none" || content === "normal") continue;
      const m = /^"(.*)"$/.exec(content);
      if (!m) continue;
      const txt = m[1];
      // znaki ikon z prywatnej strefy Unicode (fonty ikon) - pomijamy jak obrazy
      if (!txt.trim() || /^[-]+$/.test(txt)) continue;
      if (!/[\p{L}\p{N}]/u.test(txt)) continue;
      pushText(el, "pseudo" + pseudo, ps.color, txt, parseFloat(ps.fontSize), parseInt(ps.fontWeight, 10) || 400);
    }
    // jasne powierzchnie. Wyjatek: obraz (packshot, awatar) i ramka wypelniona w >=90%
    // jednym obrazem - to, co widac, decyduje zdjecie, nie tlo elementu.
    // Obraz liczy sie jako "treść" tylko gdy NAPRAWDE sie wczytal. Zepsuty <img> (ikona +
    // alt) pokazuje samo tlo elementu - to jest powierzchnia do oceny (2026-09-22: biale pole
    // w oknie materialu uszlo testowi, bo <img> byl wyjatkiem mimo bledu wczytania).
    const loaded = (n) => n.tagName !== "IMG" || (n.complete && n.naturalWidth > 0);
    const isMedia = (n) => /^(IMG|PICTURE|VIDEO|CANVAS|SVG)$/i.test(n.tagName) && loaded(n);
    const coveredByMedia = (n) => {
      const kids = [...n.querySelectorAll("img,picture,video,canvas")];
      if (kids.length !== 1 || !loaded(kids[0])) return false;
      const a = n.getBoundingClientRect(), b = kids[0].getBoundingClientRect();
      return a.width * a.height > 0 && (b.width * b.height) / (a.width * a.height) >= 0.9;
    };
    const bg = (isMedia(el) || coveredByMedia(el)) ? null : parse(cs.backgroundColor);
    if (bg && bg[3] >= 0.9) {
      const lum = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const L = 0.2126 * lum(bg[0]) + 0.7152 * lum(bg[1]) + 0.0722 * lum(bg[2]);
      if (L > __LIGHT__) {
        const r = el.getBoundingClientRect();
        // 40x20: lapie tez biale przyciski paska narzedzi (~30 px wysokosci)
        if (r.width >= 40 && r.height >= 20 && visibleRect(el)) {
          out.surfaces.push({ sel: path(el), bg, lum: +L.toFixed(3), rect: [r.left, r.top, r.width, r.height], known: knownTags(el) });
        }
      }
    }
  }
  return out;
}
"""


def lum(rgb) -> float:
    def ch(v: float) -> float:
        v = v / 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])


def ratio(a, b) -> float:
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def mix(fg, bg, alpha: float):
    return tuple(fg[i] * alpha + bg[i] * (1 - alpha) for i in range(3))


def sample_bg(img: Image.Image, rect) -> tuple[float, float, float] | None:
    x, y, w, h = rect
    x0, y0 = max(0, int(x)), max(0, int(y))
    x1, y1 = min(img.width, int(x + w)), min(img.height, int(y + h))
    if x1 - x0 < 1 or y1 - y0 < 1:
        return None
    crop = img.crop((x0, y0, x1, y1)).convert("RGB")
    step = max(1, int(((x1 - x0) * (y1 - y0)) ** 0.5 // 24))
    px = [crop.getpixel((i, j)) for i in range(0, crop.width, step) for j in range(0, crop.height, step)]
    if not px:
        return None
    return tuple(statistics.median(p[k] for p in px) for k in range(3))


def is_large(font_px: float, weight: int) -> bool:
    return font_px >= 24 or (font_px >= 18.66 and weight >= 700)


def login(page, base: str, email: str, password: str) -> None:
    page.goto(base + "/signin.html", wait_until="domcontentloaded")
    res = page.evaluate(
        """async ([email, password]) => {
            const port = Number(location.port);
            const bridge = "http://127.0.0.1:" + (port === 8765 ? 8766 : port + 1);
            const r = await fetch(bridge + "/auth/login", { method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password, skip_password_change: true }) });
            const d = await r.json();
            if (!d.ok) return d;
            localStorage.setItem("dam_token", d.token);
            if (d.device_id) localStorage.setItem("dam_device_id", d.device_id);
            if (d.machine_id) localStorage.setItem("dam_machine_id", d.machine_id);
            if (d.session_id) localStorage.setItem("dam_session_id", d.session_id);
            const u = d.user || {};
            localStorage.setItem("dam_role", String(u.role || "admin").toLowerCase());
            localStorage.setItem("dam_user_name", u.name || "");
            localStorage.setItem("dam_user", JSON.stringify({ email: u.email || email, name: u.name || "", role: u.role || "admin" }));
            localStorage.setItem("dam_theme_pref", "dark");
            localStorage.setItem("dam_admin_mode", "1");
            localStorage.setItem("dam_tutorial_done", "1");
            return { ok: true };
        }""",
        [email, password],
    )
    if not res or not res.get("ok"):
        raise SystemExit(f"logowanie nieudane: {res}")


def settle(page, extra_ms: int = 1500) -> None:
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        pass
    page.wait_for_timeout(extra_ms)


def audit(page, name: str, out_dir: Path) -> dict:
    theme = page.evaluate("document.documentElement.getAttribute('data-theme')")
    known_sels = [k[1] for k in KNOWN]
    data = page.evaluate(COLLECT_JS.replace("__LIGHT__", str(LIGHT_SURFACE_LUM)), known_sels)
    normal = Image.open(io.BytesIO(page.screenshot()))
    style = page.add_style_tag(content=HIDE_TEXT_CSS)
    page.wait_for_timeout(150)
    hidden = Image.open(io.BytesIO(page.screenshot()))
    style.evaluate("el => el.remove()")
    safe = re.sub(r"[^a-z0-9#_-]+", "-", name.lower())
    normal.save(out_dir / f"{safe}.png")

    violations = []
    for t in data["texts"]:
        bg = sample_bg(hidden, t["rect"])
        if bg is None:
            continue
        alpha = t["color"][3] * t["opacity"]
        fg = mix(t["color"][:3], bg, alpha)
        r = ratio(fg, bg)
        need = MIN_LARGE if is_large(t["font_px"], t["weight"]) else MIN_NORMAL
        if r + 1e-6 < need:
            violations.append({
                "page": name, "sel": t["sel"], "kind": t["kind"], "text": t["text"],
                "fg": [round(v) for v in fg], "bg": [round(v) for v in bg],
                "ratio": round(r, 2), "need": need, "known": t["known"], "rect": t["rect"],
            })
    surfaces = [dict(s, page=name) for s in data["surfaces"]]
    return {"page": name, "theme": theme, "violations": violations, "surfaces": surfaces}


def dismiss_basepath_modal(page) -> None:
    """Okno "Sciezka Marketing na tym komputerze" (brak ROOT) przykrywa strone.
    Samo jest audytowane razem ze strona; potem zdejmujemy je, zeby kliknac dalej."""
    page.evaluate("document.getElementById('damBasePathModal') && document.getElementById('damBasePathModal').remove()")


def open_branding_modal(page) -> bool:
    dismiss_basepath_modal(page)
    btn = page.locator("button:visible:has-text('Podgląd')").first
    try:
        btn.click(timeout=8000)
        page.wait_for_selector(".dam-viz-modal__actions", timeout=10000)
        page.wait_for_timeout(1200)
        return True
    except Exception:
        return False


def open_quiz(page) -> bool:
    dismiss_basepath_modal(page)
    try:
        # przelacznik Admin w naglowku zeruje dam_admin_mode przy starcie strony
        page.evaluate(
            "localStorage.setItem('dam_admin_mode','1'); localStorage.setItem('dam_role','admin');"
            "window.DamAssocQuiz && window.DamAssocQuiz.open()"
        )
        page.wait_for_selector(".dam-assoc-quiz__panel", timeout=10000)
        page.wait_for_timeout(1500)
        return True
    except Exception:
        return False


def open_db_panel(page) -> bool:
    dismiss_basepath_modal(page)
    try:
        page.click("#damDbStatus", timeout=5000)
        page.wait_for_selector("#damDbStatusPanel", state="visible", timeout=5000)
        page.wait_for_timeout(500)
        return True
    except Exception:
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8865")
    ap.add_argument("--email", default="qa.dark@inyfinn.test")
    ap.add_argument("--password", default="test")
    ap.add_argument("--out", default="")
    ap.add_argument("--pages", default="", help="lista stron po przecinku (bez .html); domyslnie wszystkie")
    ap.add_argument("--expect-known", action="store_true", help="samosprawdzenie: znane bledy musza byc zlapane")
    args = ap.parse_args()

    out_dir = Path(args.out) if args.out else Path.cwd() / "dark-contrast-out"
    out_dir.mkdir(parents=True, exist_ok=True)
    pages = [p.strip() for p in args.pages.split(",") if p.strip()] or sorted(
        p.stem for p in WEB.glob("*.html") if p.stem not in SKIP_PAGES and "Conflict" not in p.stem
    )

    results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport=VIEWPORT, device_scale_factor=1)
        page = ctx.new_page()
        login(page, args.base, args.email, args.password)
        for name in pages:
            t0 = time.time()
            page.goto(f"{args.base}/{name}.html", wait_until="domcontentloaded")
            settle(page)
            results.append(audit(page, name, out_dir))
            if name == "dashboard" and open_db_panel(page):
                results.append(audit(page, "dashboard#db-panel", out_dir))
                page.keyboard.press("Escape")
            if name == "branding":
                if open_branding_modal(page):
                    results.append(audit(page, "branding#modal", out_dir))
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(500)
                else:
                    results.append({"page": "branding#modal", "error": "nie otwarto okna materialu", "violations": [], "surfaces": []})
                page.goto(f"{args.base}/branding.html", wait_until="domcontentloaded")
                settle(page, 800)
                if open_quiz(page):
                    results.append(audit(page, "branding#quiz", out_dir))
                else:
                    results.append({"page": "branding#quiz", "error": "nie otwarto quizu", "violations": [], "surfaces": []})
            r = results[-1]
            print(f"{name:18} {len(r['violations']):4} tekst  {len(r['surfaces']):4} jasne  ({time.time() - t0:.1f}s)", flush=True)
        browser.close()

    all_v = [v for r in results for v in r["violations"]]
    all_s = [s for r in results for s in r["surfaces"]]
    known_hits = {}
    for page_name, sel, label in KNOWN:
        hit = any(sel in v["known"] and v["page"] == page_name for v in all_v) or any(
            sel in s["known"] and s["page"] == page_name for s in all_s
        )
        known_hits[label] = hit
    report = {
        "pages": len(results),
        "text_violations": len(all_v),
        "light_surfaces": len(all_s),
        "known_detected": known_hits,
        "errors": [r for r in results if r.get("error")],
        "by_page": {r["page"]: {"text": len(r["violations"]), "light": len(r["surfaces"]), "theme": r.get("theme")} for r in results},
        "violations": all_v,
        "surfaces": all_s,
    }
    (out_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nRAZEM: {len(all_v)} naruszen kontrastu tekstu, {len(all_s)} jasnych powierzchni, stron: {len(results)}")
    for label, hit in known_hits.items():
        print(f"  znany blad {'ZLAPANY' if hit else 'NIE ZLAPANY'}: {label}")
    print(f"raport: {out_dir / 'report.json'}")
    if args.expect_known and not all(known_hits.values()):
        return 2
    return 0 if not all_v and not all_s else 1


if __name__ == "__main__":
    sys.exit(main())
