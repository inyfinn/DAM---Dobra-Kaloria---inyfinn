# -*- coding: utf-8 -*-
from pathlib import Path

src = Path(r"P:/DAM/apps/web/costs.html")
dst = Path(r"P:/DAM/apps/web/visualizations.html")
t = src.read_text(encoding="utf-8")
t = t.replace("Kalkulator kosztow - DAM ETA", "Wizualizacje - DAM ETA")
t = t.replace(
    'data-i18n="cost.title">Kalkulator kosztow',
    'data-i18n="viz.title">Wizualizacje',
)
t = t.replace(
    'data-i18n="cost.subtitle">Automatyczne koszty per projekt (Asana + stawki)',
    'data-i18n="viz.subtitle">Zawsze aktualna wizualizacja (najwyzsza rewizja indeksu)',
)
t = t.replace("dam-brand.css?v=20260717auto", "dam-brand.css?v=20260717viz")
t = t.replace("dam-shell.js?v=20260717nav2", "dam-shell.js?v=20260717viz")

start = t.find("<!-- AUTO PROJECT COST TABS -->")
end = t.find("<!-- END AUTO PROJECT COST TABS -->")
new_block = """<!-- VIZ GALLERY -->
				<div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between">
					<span class="geex-badge geex-badge--success-transparent" style="padding:6px 12px;border-radius:8px;font-size:12px" data-i18n="viz.badge">Tylko aktualne rewizje (.01 &gt; .00)</span>
					<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
						<select id="vizLangFilter" class="form-select" style="width:auto;min-width:110px;border-radius:8px">
							<option value="">Wszystkie jezyki</option>
							<option value="pl">PL</option>
							<option value="de">DE</option>
							<option value="gb">GB</option>
							<option value="cz">CZ</option>
							<option value="sk">SK</option>
						</select>
						<input type="text" id="vizSearch" class="form-control" placeholder="Indeks lub nazwa..." style="width:220px;border-radius:8px" />
					</div>
				</div>
				<div id="vizStatus" style="font-size:12px;color:#8b8d97;margin-bottom:10px"></div>
				<div id="vizGrid" class="dam-viz-grid"></div>
				<!-- END VIZ GALLERY -->"""
if start != -1 and end != -1:
    t = t[:start] + new_block + t[end + len("<!-- END AUTO PROJECT COST TABS -->") :]

t = t.replace(
    '<script src="./assets/js/dam-cost.js?v=20260717auto"></script>',
    '<script src="./assets/js/dam-search.js?v=20260717viz"></script>\n\t'
    '<script src="./assets/js/dam-viz.js?v=20260717viz"></script>',
)
dst.write_text(t, encoding="utf-8")
print("wrote", dst, "has viz grid", "vizGrid" in t)
