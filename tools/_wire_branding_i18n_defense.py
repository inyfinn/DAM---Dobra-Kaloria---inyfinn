# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"


def main() -> None:
    pl_path = WEB / "i18n" / "pl.json"
    data = json.loads(pl_path.read_text(encoding="utf-8"))
    extra = {
        "branding.clear_filters": "Wyczyść filtry",
        "branding.date_week": "Ostatni tydzień",
        "branding.date_month": "Ostatni miesiąc",
        "branding.sort_priority": "Priorytet użycia",
        "branding.show_all": "Pokaż wszystko",
        "branding.show_archive": "Pokaż archiwum",
        "branding.loading_index": "Ładowanie indeksu…",
        "branding.back_browse": "Wróć do przeglądania",
    }
    data.update(extra)
    pl_path.write_bytes(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8") + b"\n")
    print("pl.json ok", len(extra))

    html_path = WEB / "branding.html"
    text = html_path.read_text(encoding="utf-8")
    repls = [
        (
            'id="damBrandingClearTags">Wyczyść filtry</button>',
            'id="damBrandingClearTags" data-i18n="branding.clear_filters">Wyczyść filtry</button>',
        ),
        (
            'data-preset="week">Ostatni tydzień</button>',
            'data-preset="week" data-i18n="branding.date_week">Ostatni tydzień</button>',
        ),
        (
            'data-preset="month">Ostatni miesiąc</button>',
            'data-preset="month" data-i18n="branding.date_month">Ostatni miesiąc</button>',
        ),
        (
            'option value="priority" selected>Priorytet użycia</option>',
            'option value="priority" selected data-i18n="branding.sort_priority">Priorytet użycia</option>',
        ),
        ("dam-branding.css?v=brenc20260720d", "dam-branding.css?v=brenc20260721a"),
        ("dam-branding.js?v=brenc20260720d", "dam-branding.js?v=brenc20260721a"),
        ("dam-i18n.js?v=i18nboot20260721a", "dam-i18n.js?v=i18nboot20260721b"),
    ]
    for a, b in repls:
        if a not in text:
            # tolerate already-applied
            if b in text or a.split("?v=")[0] in text and "brenc20260721a" in text:
                print("skip/ok", a[:48])
                continue
            print("MISS", a[:80])
            continue
        text = text.replace(a, b)
        print("ok", a[:48])

    # also wire show-all tabs if clean PL present
    text2 = text.replace(
        'data-tab="all" role="tab" aria-selected="true">Pokaż wszystko</button>',
        'data-tab="all" role="tab" aria-selected="true" data-i18n="branding.show_all">Pokaż wszystko</button>',
    )
    if text2 != text:
        text = text2
        print("ok show_all i18n")

    html_path.write_bytes(text.encode("utf-8"))
    raw = html_path.read_bytes()
    assert "Wyczyść filtry".encode("utf-8") in raw
    assert b"\xc5\x9b" in raw
    assert b"\xef\xbf\xbd" not in raw
    print("VERIFY PASS bytes", len(raw))


if __name__ == "__main__":
    main()
