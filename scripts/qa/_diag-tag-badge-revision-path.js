"use strict";
const path = require("path");
const os = require("os");
const core = require("./lib/dam-cdp-assoc-probe-core");

(async () => {
  const browser = core.findBrowser();
  const port = 9342;
  const launch = core.launchChrome(browser, port, {
    userData: path.join(os.tmpdir(), "dam-diag-tag-" + Date.now()),
  });
  let cdp = null;
  try {
    await core.waitForDebugger(port, 40);
    const conn = await core.connectPageCdp(port);
    cdp = conn.cdp;
    const cta = core.CTAS.find((c) => c.id === "viz-variants") || core.CTAS[0];
    const boot = await core.navigateAndBoot(cdp, cta);
    if (!boot.ok) {
      console.log("FAIL boot", boot.error);
      process.exit(1);
    }
    await core.sleep(1200);
    await cdp.evaluate(core.clickCardExpr(cta));
    await core.sleep(1500);
    const badgeCheck = await cdp.evaluate(`(function(){
      var badges=document.getElementById('damVizModalBadges');
      if(!badges) return {ok:false, error:'no_badges'};
      var lang=badges.querySelector('.dam-tag-editable[data-tag-kind="lang"]');
      if(!lang) lang=badges.querySelector('[data-tag-kind="lang"]');
      var carrier=badges.querySelector('[data-tag-kind="carrier"]');
      return {
        ok: !!(lang && lang.getAttribute('data-revision-path')),
        langRevisionPath: lang?lang.getAttribute('data-revision-path'):'',
        langEditable: !!(lang&&lang.classList.contains('dam-tag-editable')),
        carrierRevisionPath: carrier?carrier.getAttribute('data-revision-path'):'',
        canEditTags: !!(window.DamTagEdit&&window.DamTagEdit.isPrivileged&&window.DamTagEdit.isPrivileged())
      };
    })()`);
    console.log("badgeCheck", JSON.stringify(badgeCheck));
    if (!badgeCheck.ok) process.exit(2);
    if (badgeCheck.canEditTags) {
      const pickerProbe = await cdp.evaluate(`(function(){
        var lang=document.querySelector('#damVizModalBadges [data-tag-kind="lang"]');
        if(!lang||!window.DamTagEdit||!window.DamTagEdit.openTagPicker) return {ok:false, error:'no_api'};
        try {
          window.DamTagEdit.openTagPicker(lang, {
            kind:'lang',
            revisionPath: lang.getAttribute('data-revision-path')||'',
            productId: lang.getAttribute('data-product-id')||'',
            value: lang.getAttribute('data-tag-value')||''
          });
        } catch(e) { return {ok:false, error:String(e)}; }
        return {ok:true, popover: !!document.querySelector('.dam-tag-edit-popover, .dam-tag-picker-popover')};
      })()`);
      console.log("pickerProbe", JSON.stringify(pickerProbe));
      if (!pickerProbe.ok || !pickerProbe.popover) process.exit(3);
    } else {
      console.log("SKIP picker open (not privileged in CDP session)");
    }
    console.log("PASS tag-badge-revision-path");
  } finally {
    if (cdp) cdp.close();
    core.killProc(launch.child);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
