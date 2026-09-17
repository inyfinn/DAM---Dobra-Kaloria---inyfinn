from pathlib import Path

p = Path(__file__).resolve().parents[1] / "assets" / "js" / "dam-invoices.js"
text = p.read_text(encoding="utf-8")

text = text.replace(
    "  var allInvoices = [];\n  var currentFilter = \"all\";\n  var source = \"local\";",
    "  var allInvoices = [];\n  var currentFilter = \"all\";\n  var projectFilterQuery = \"\";\n  var source = \"local\";",
)

insert = """  function invoiceMatchesProjectFilter(inv, q) {
    if (!q) return true;
    var blob = (
      (inv.project || \"\") +
      \" \" +
      (inv.id || \"\") +
      \" \" +
      (inv.linked_product_id || \"\")
    ).toLowerCase();
    var needle = String(q).toLowerCase();
    if (blob.indexOf(needle) >= 0) return true;
    if (needle.indexOf(\"figa\") >= 0 && /figa|makiem/i.test(blob)) return true;
    if (needle.indexOf(\"cynamon\") >= 0 && /cynamon/i.test(blob)) return true;
    return false;
  }

  function testBadgeInline(inv) {
    if (!inv || (!inv.isTest && inv.source !== \"seed\")) return \"\";
    if (window.DamProductFinance && typeof DamProductFinance.testBadgeHtml === \"function\") {
      return \" \" + DamProductFinance.testBadgeHtml();
    }
    return ' <span class=\"dam-seed-test-badge dam-viz-badge\">(TESTOWE)</span>';
  }

"""

marker = "  function renderTable(invoices) {"
if insert.strip() not in text:
    text = text.replace(marker, insert + marker, 1)

text = text.replace(
    """    var filtered =
      currentFilter === \"all\"
        ? invoices
        : invoices.filter(function (inv) {
            return inv.status === currentFilter;
          });""",
    """    var scoped = projectFilterQuery
      ? invoices.filter(function (inv) {
          return invoiceMatchesProjectFilter(inv, projectFilterQuery);
        })
      : invoices;
    var filtered =
      currentFilter === \"all\"
        ? scoped
        : scoped.filter(function (inv) {
            return inv.status === currentFilter;
          });""",
)

text = text.replace(
    "          escapeHtml(inv.project || \"-\") +\n          \"</div>\" +",
    "          escapeHtml(inv.project || \"-\") +\n          testBadgeInline(inv) +\n          \"</div>\" +",
)

old_apply = """  function applyInvoices(list, src) {
    allInvoices = list || [];
    source = src || \"local\";
    updateSummary(allInvoices);
    renderTable(allInvoices);
    updateSourceBadge();
  }"""

new_apply = """  function visibleInvoices() {
    if (!projectFilterQuery) return allInvoices;
    return allInvoices.filter(function (inv) {
      return invoiceMatchesProjectFilter(inv, projectFilterQuery);
    });
  }

  function showProjectFilterBanner() {
    var banner = document.getElementById(\"damInvProjectFilter\");
    if (!banner) return;
    if (!projectFilterQuery) {
      banner.hidden = true;
      banner.textContent = \"\";
      return;
    }
    banner.hidden = false;
    banner.innerHTML =
      '<span class=\"dam-int-chip dam-int-st dam-int-st--wait\">' +
      escapeHtml(\"Filtr produktu: \" + projectFilterQuery) +
      '</span> <a class=\"geex-btn geex-btn--sm geex-btn--primary-transparent\" href=\"invoices.html\">Wyczyść filtr</a>';
  }

  function applyInvoices(list, src) {
    allInvoices = list || [];
    source = src || \"local\";
    updateSummary(visibleInvoices());
    renderTable(allInvoices);
    updateSourceBadge();
    showProjectFilterBanner();
  }"""

text = text.replace(old_apply, new_apply)

text = text.replace(
    "  function init() {\n    ensureCtaStyles();\n    ensureInvStyles();",
    """  function init() {
    ensureCtaStyles();
    ensureInvStyles();
    try {
      projectFilterQuery =
        new URLSearchParams(window.location.search).get(\"project\") ||
        new URLSearchParams(window.location.search).get(\"product_id\") ||
        \"\";
    } catch (eQs) {
      projectFilterQuery = \"\";
    }""",
)

text = text.replace(
    "      renderTable(allInvoices);\n    });\n  }",
    "      updateSummary(visibleInvoices());\n      renderTable(allInvoices);\n    });\n    showProjectFilterBanner();\n  }",
)

p.write_text(text, encoding="utf-8")
print("patched", p)
