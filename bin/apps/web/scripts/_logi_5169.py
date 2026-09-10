# -*- coding: utf-8 -*-
from pathlib import Path

logi = Path(__file__).resolve().parents[3] / "agents" / "shared" / "LOGI.md"
entry = (
    "2026-09-07 | UX 5.0.169: Bez statusu / Graficy / historia / hover | OK | "
    "status letter filter (explorer+viz+badges); empty state geex-btn bez maskotki; "
    "lifecycle writer admin|power_user|grafik (bridge+UI); historia PL + index hover thumb 0.3s; "
    "loadGrafikGroup prefetch; dam-badges export naprawiony; curl explorer+viz 200 | "
    "DONE bez commita\n\n"
)
text = logi.read_text(encoding="utf-8")
marker = "Format: Data | Akcja | Status | Efekt | Dalej\n\n---\n\n"
if entry.strip() not in text:
    text = text.replace(marker, marker + entry, 1)
    logi.write_text(text, encoding="utf-8")
    print("LOGI updated")
else:
    print("LOGI already has entry")
