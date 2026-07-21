from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent / "phase0"
FAILS = [
    ("dashboard", "http://127.0.0.1:8765/dashboard.html", "light", 1440),
    ("dashboard", "http://127.0.0.1:8765/dashboard.html", "light", 1024),
    ("dashboard", "http://127.0.0.1:8765/dashboard.html", "light", 390),
    ("dashboard", "http://127.0.0.1:8765/dashboard.html", "dark", 1024),
    ("explorer", "http://127.0.0.1:8765/explorer.html", "dark", 1024),
    ("settings", "http://127.0.0.1:8765/settings.html", "dark", 1024),
    ("inbox", "http://127.0.0.1:8765/inbox.html", "dark", 1024),
    ("dashboard", "http://127.0.0.1:8765/dashboard.html", "dark", 390),
]


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for slug, url, theme, w in FAILS:
            h = 900 if w >= 1024 else 844
            ctx = browser.new_context(
                viewport={"width": w, "height": h},
                color_scheme="dark" if theme == "dark" else "light",
            )
            page = ctx.new_page()
            page.add_init_script(
                "localStorage.setItem('theme', %r);" % theme
            )
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(800)
                page.screenshot(
                    path=str(OUT / f"phase0-{slug}-{theme}-{w}.png"),
                    full_page=False,
                    timeout=90000,
                    animations="disabled",
                )
                print("ok", slug, theme, w)
            except Exception as e:  # noqa: BLE001
                print("fail", slug, theme, w, e)
            ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
