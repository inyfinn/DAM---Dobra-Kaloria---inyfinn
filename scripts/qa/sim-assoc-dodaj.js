/**

 * QA contract: viz assoc fixes v4.0.34.

 */

const fs = require("fs");

const path = require("path");

const { extractFunctionBody } = require("./_assoc-qa-lib.js");



const root = path.resolve(__dirname, "..", "..");

const assoc = fs.readFileSync(path.join(root, "apps/web/assets/js/dam-assoc-edit.js"), "utf8");

const preview = fs.readFileSync(path.join(root, "apps/web/assets/js/dam-media-preview.js"), "utf8");

const viz = fs.readFileSync(path.join(root, "apps/web/assets/js/dam-viz.js"), "utf8");

const branding = fs.readFileSync(path.join(root, "apps/web/branding.html"), "utf8");

const visualizations = fs.readFileSync(path.join(root, "apps/web/visualizations.html"), "utf8");

const explorer = fs.readFileSync(path.join(root, "apps/web/explorer.html"), "utf8");

const dashboard = fs.readFileSync(path.join(root, "apps/web/dashboard.html"), "utf8");

const folderPicker = fs.readFileSync(path.join(root, "apps/web/assets/js/dam-folder-picker.js"), "utf8");

const bridge = fs.readFileSync(path.join(root, "apps/desktop/local_bridge.py"), "utf8");

const ver = JSON.parse(fs.readFileSync(path.join(root, "apps/web/version.json"), "utf8"));



const fails = [];

function ok(name, cond, detail) {

  if (!cond) fails.push(name + (detail ? ": " + detail : ""));

  else console.log("PASS " + name);

}



ok("version 4.0.67", ver.version === "4.0.67");
ok(
  "branding picker anti-freeze",
  /function collectBrandingPickerRows/.test(assoc) &&
    /function listSafeThumb/.test(assoc) &&
    /applyBrandingSeed/.test(assoc) &&
    /bootstrapQuery[\s\S]{0,120}marketing_id \|\| asset\.index/.test(assoc) &&
    !/asset\.marketing_id \|\| asset\.index \|\| asset\.name/.test(assoc)
);

ok("bindVizAssocCtas export", /bindVizAssocCtas:\s*bindVizAssocCtas/.test(assoc));

ok("openVizMaterialsEdit315 export", /openVizMaterialsEdit315:\s*openVizMaterialsEdit315/.test(assoc));

ok("315 plus editBtn click", /editBtn\.click\s*\(\s*\)/.test(assoc));

ok("branding no edit-all button", !/data-assoc-edit-all/.test(preview) && /dam-viz-assoc-cta/.test(preview));
ok("picker debounce", /renderOptionsDebounced/.test(assoc) && /scheduleMaterialSearchFetch/.test(assoc));
ok("picker async product search", /pickerUsesAsyncProductSearch/.test(assoc) && /scheduleProductSearchFetch/.test(assoc));
ok(
  "materialCandidates seed from ctx",
  /ctx\.materialsList[\s\S]{0,80}ctx\.shownPrimaries/.test(assoc)
);
ok("openModal primary first", /ensurePrimaryFirstInList/.test(fs.readFileSync(path.join(root, "apps/web/assets/js/dam-branding.js"), "utf8")));

ok("viz modal no product edit-all", !/data-assoc-edit-all="product"/.test(viz));

ok("viz variants openMediaPicker", /openEditPicker\(col,\s*"variant"/.test(extractFunctionBody(assoc, "openVizAssocVariantsPicker")));

ok(
  "variant pinned not candidate pool",
  /ctx\.variantPinnedIds/.test(assoc) &&
    /poolIsCandidates/.test(assoc) &&
    !/openMediaPickerImmediate/.test(assoc) &&
    /schedulePaintPicker/.test(assoc)
);

ok(
  "footer global Dodaj z dysku",
  /Dodaj z dysku<\/span>/.test(assoc) &&
    !/data-browse data-dam-tip="Wyszukaj plik/.test(assoc)
);

ok(
  "viz variant product expand UI",
  /dam-assoc-edit-popover__expand/.test(assoc) &&
    /expandedProductId/.test(assoc) &&
    /isProductRow/.test(assoc)
);
ok(
  "viz variant rev select only",
  /indexOf\("rev:"\)\s*!==\s*0/.test(assoc) &&
    /parseRevisionPickerKey/.test(assoc) &&
    /produkt i zaznacz wariant/.test(assoc)
);
ok(
  "picker search DamSearch gate",
  /scheduleListPaint\(raw\)/.test(assoc) &&
    /scheduleProductSearchFetch\(raw\)/.test(assoc) &&
    !/scheduleProductSearchFetch\(raw\);\s*return/.test(assoc) &&
    /qq\.length\s*>=\s*2/.test(assoc) &&
    /collectProductPickerRows\(productSearchHits/.test(assoc) &&
    /renderOptionsDebounced/.test(assoc)
);
ok(
  "sugestie empty ctx seed",
  /seedMaterialsCtx\(modal/.test(assoc) &&
    /Pusty stan/.test(assoc)
);

ok(
  "viz variantPinnedIds seed",
  /variantPinnedIds:\s*variantPinnedIds/.test(viz) &&
    /productVariantRepresentatives\(items\)/.test(viz)
);

ok("suggestions material picker", /if\s*\(\s*kind\s*===\s*"material"\s*\)[\s\S]{0,1200}kind:\s*"material"/.test(assoc));

ok("suggestions saveProductMaterialSuggestions", /saveProductMaterialSuggestions\(productId/.test(assoc));

ok("disk picker is combo alias", /function openDiskFolderPicker/.test(assoc) && /openDiskFolderPicker[\s\S]{0,120}openComboExplorerFromAssoc/.test(assoc));

ok("viz no edit-all in modal html", !/data-assoc-edit-all="product"/.test(viz));

ok("merge opts skips null", /mergeVizAssocCtasOpts/.test(assoc) && /next\[key\]\s*!==\s*null/.test(assoc));

ok("cta css inject branding", /#damMediaPreview \.dam-viz-assoc-cta\.dam-int-cta/.test(assoc));

ok("groupContext guard openEditPicker", /ctx\.groupContext\s*=\s*ctx\.groupContext\s*\|\|\s*\{\}/.test(assoc));

ok("COMBO picker only", /DamFolderPicker\.open/.test(assoc) && !/damAssocFolderPicker/.test(assoc));

ok("COMBO footer action", /data-goto-combo/.test(assoc) && /<span>Dodaj z dysku<\/span>/.test(assoc));

ok("branding CTA builder", /data-viz-assoc-cta="' \+/.test(preview) && /ctaMeta/.test(preview));

ok("viz bind on modal open", /bindVizAssocCtas\(modal/.test(viz));

ok("viz modal bind without null ctx", !/bindVizAssocCtas\(modal,\s*\{\s*variantsCtx:\s*null/.test(viz));

ok("viz P1 seedMaterialsCtx", /seedMaterialsCtx\s*\(modal/.test(viz));

ok(
  "suggestions golden openEditPicker",
  /kind === "material"/.test(assoc) &&
    /openEditPicker\(col,\s*"material"/.test(assoc) &&
    /suggestions"\)\s*kind\s*=\s*"material"/.test(assoc)
);

ok(
  "viz linked assets lite fetch",
  /loadLinkedBrandingAssetsForProduct/.test(preview) &&
    /branding-for-product/.test(preview) &&
    !/renderLinkedBrandingAssets[\s\S]{0,400}loadIndexAssets\s*\(\)/.test(preview)
);

ok(
  "cache token all assoc pages",
  [branding, visualizations, explorer, dashboard].every(function (html) {
    return /4\.0\.67-assocBrandFreeze20260726a/.test(html);
  })
);

ok("folder revision match", /folderRevisionIndex/.test(assoc) && /byRevision/.test(assoc));
ok("branding related materials", /renderBrandingRelatedMaterials/.test(preview));
ok("dedupe product ids export", /dedupeProductIds/.test(assoc) && /dedupeLinkedProductRecords/.test(assoc));
ok("assoc picker viz close", /class=\"dam-viz-modal-close\" data-close/.test(assoc));
ok("combo close in head css", /dam-thumb-picker__head .dam-viz-modal-close/.test(folderPicker));
ok("dialog actions pattern", /dam-dialog-actions/.test(assoc) && /damThumbPickerBackStep/.test(folderPicker));
ok("picker combo shell", /dam-thumb-picker-box dam-assoc-edit-popover/.test(assoc) && /dam-thumb-picker__head/.test(assoc) && /dam-thumb-picker__footer/.test(assoc));
ok("combo stack on assoc", /stackOnAssoc/.test(assoc) && /alignStackedToAssoc/.test(folderPicker));
ok("goto combo keeps picker", /\[data-goto-combo\]/.test(assoc) && !/\[data-goto-combo\][\s\S]{0,120}closePicker\(\)/.test(assoc));
ok("branding produkty toggle", /data-produkty-host/.test(preview) && /Produkty \(/.test(preview));



if (fails.length) {

  console.error("FAIL count=" + fails.length);

  fails.forEach(function (f) {

    console.error(" - " + f);

  });

  process.exit(1);

}

console.log("ALL PASS sim-assoc-dodaj version=" + ver.version);

process.exit(0);



