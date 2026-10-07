/**
 * Lustro reguly wykluczen katalogow technicznych w UI (isBrandingScopeExcluded) daje te same wyniki co
 * branding_scope.py na wspolnej tabeli przypadkow (branding_scope_cases.json). Stara siatka sprzed przebudowy tez
 * nie pokazuje kart z tych katalogow (isBrandingGridEligible).
 */
const fs = require("fs");
const path = require("path");
const { load } = require("./branding_vm_helper.js");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const { dbg } = load();
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "branding_scope_cases.json"), "utf8")).cases;
let bad = 0;
for (const c of cases) {
  const got = dbg.isBrandingScopeExcluded(c.path);
  if (got !== c.excluded) {
    bad++;
    console.error("ROZNICA:", JSON.stringify(c.path), "oczekiwano", c.excluded, "jest", got, "-", c.note);
  }
}
if (bad) fail(bad + " przypadkow rozni sie od tabeli");

const mk = (p) => ({ id: "br-1", name: "a.png", path: p, media_type: "image", asset_role: "brand_asset", source: "marketing" });
if (dbg.isBrandingGridEligible(mk("M:/- POLSKA/02 - FIRMOWE MATERIAŁY/PREZENTACJE/— SZABLON AI - skrypt/WORK/x/a.png"))) fail("karta z katalogu technicznego nie powinna byc w siatce");
if (!dbg.isBrandingGridEligible(mk("M:/- POLSKA/02 - FIRMOWE MATERIAŁY/PREZENTACJE/24.09.2026 - KULKI z kreatyną/Elementy/a.png"))) fail("prawdziwy material wycięty");

console.log("OK branding: lustro reguly wykluczen w JS zgodne z tabela (" + cases.length + " przypadkow)");
