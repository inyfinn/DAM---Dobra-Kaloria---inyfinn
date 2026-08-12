# -*- coding: utf-8 -*-
from pathlib import Path

# --- Fix dam-explorer.js init ---
p = Path(r"P:/DAM/apps/web/assets/js/dam-explorer.js")
t = p.read_text(encoding="utf-8")

marker = "  function init() {"
idx = t.find(marker)
if idx < 0:
    raise SystemExit("init() not found")

# Find end of init function: next "\n  if (document.readyState"
end = t.find("\n  if (document.readyState", idx)
if end < 0:
    raise SystemExit("readyState marker not found")

new_init = '''  function hideGeexDemoBlocks() {
    document.querySelectorAll(".row.g-4, .single-feature-card-area-start, .geex-content__todo, .custom_al__file").forEach(function (el) {
      if (el.closest("#damExplorerMain")) return;
      el.style.display = "none";
    });
    var subtitle = document.querySelector(".geex-content__header__subtitle");
    if (subtitle) subtitle.textContent = "Foldery projektow i pliki opakowan";
  }

  function init() {
    hideGeexDemoBlocks();
    allFolders = DEMO_FOLDERS;
    injectExplorerUI();
    renderFolderList(allFolders);

    var token = localStorage.getItem("dam_token");
    if (!token) return;

    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 2500);
    var opts = {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" }
    };
    if (ctrl) opts.signal = ctrl.signal;

    fetch("http://127.0.0.1:8000/api/projects", opts)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        clearTimeout(timer);
        var projects = data.data || data || [];
        if (!projects.length) return;
        allFolders = projects.map(function (proj) {
          return {
            id: String(proj.product_index || proj.id),
            name: proj.name || proj.product_index || "Projekt",
            index: proj.product_index || proj.id,
            files: []
          };
        });
        renderFolderList(allFolders);
      })
      .catch(function () { clearTimeout(timer); });
  }
'''

t = t[:idx] + new_init + t[end:]
p.write_text(t, encoding="utf-8")
print("explorer init OK")

# --- Strip costs leftovers ---
c = Path(r"P:/DAM/apps/web/costs.html")
ct = c.read_text(encoding="utf-8")
start = ct.find("<!-- END COST CALCULATOR -->")
close_block = "\n\t\t\t</div>\n\t\t</div>\n  \t</main>"
if start < 0:
    print("END COST marker missing")
else:
    close_pos = ct.find(close_block, start)
    if close_pos > start:
        ct2 = ct[:start] + "<!-- END COST CALCULATOR -->" + close_block + ct[close_pos + len(close_block) :]
        c.write_text(ct2, encoding="utf-8")
        print("costs strip OK, removed", close_pos - start, "chars")
    else:
        print("costs close_block not found")

# cache bump
for name in ("explorer.html", "costs.html"):
    html = Path(r"P:/DAM/apps/web") / name
    h = html.read_text(encoding="utf-8")
    h = h.replace("dam-explorer.js?v=20260717b", "dam-explorer.js?v=20260717c")
    h = h.replace('dam-explorer.js"', 'dam-explorer.js?v=20260717c"')
    h = h.replace("dam-cost.js?v=20260717b", "dam-cost.js?v=20260717c")
    if 'dam-cost.js"' in h and "dam-cost.js?v=" not in h:
        h = h.replace('dam-cost.js"', 'dam-cost.js?v=20260717c"')
    # avoid double query
    h = h.replace("dam-explorer.js?v=20260717c?v=20260717c", "dam-explorer.js?v=20260717c")
    h = h.replace("dam-cost.js?v=20260717c?v=20260717c", "dam-cost.js?v=20260717c")
    html.write_text(h, encoding="utf-8")
    print(name, "cache bump OK")
