"use strict";
const fs = require("fs");
const token = "4.0.71-assocTutorialMoGuard20260726a";
const files = [
  "apps/web/branding.html",
  "apps/web/visualizations.html",
  "apps/web/explorer.html",
  "apps/web/dashboard.html",
];
files.forEach(function (f) {
  let s = fs.readFileSync(f, "utf8");
  s = s.replace(/dam-assoc-edit\.js\?v=[^"']+/g, "dam-assoc-edit.js?v=" + token);
  s = s.replace(/dam-search\.js\?v=[^"']+/g, "dam-search.js?v=" + token);
  s = s.replace(/dam-media-preview\.js\?v=[^"']+/g, "dam-media-preview.js?v=" + token);
  s = s.replace(/dam-tutorial\.js\?v=[^"']+/g, "dam-tutorial.js?v=" + token);
  fs.writeFileSync(f, s);
  console.log("ok", f);
});
