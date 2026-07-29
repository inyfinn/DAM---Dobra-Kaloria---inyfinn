#!/usr/bin/env node
/**
 * E2E probe: assoc picker CTAs — Mode A (programmatic) + Mode B (real UI click).
 *
 * overall_pass per CTA = Mode B ONLY (real card → CTA click → async DamSearch settle ≤8s).
 * Mode A (openPicker + sync paint) is reported separately and MUST NOT set overall pass.
 *
 * CTAs: branding-product, branding-variant, viz-suggestions, viz-variants
 * Report: logs/dam-connection/e2e-assoc-report.json
 * Shots:  logs/dam-connection/e2e-{cta}-modeB-{ts}.png
 *
 * HARD: localStorage/window only inside CDP Runtime.evaluate strings (see lib core).
 * No browser MCP. No puppeteer required.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const core = require("./lib/dam-cdp-assoc-probe-core");

const REPO = path.resolve(__dirname, "..", "..");
const LOG_DIR = path.join(REPO, "logs", "dam-connection");
const FREEZE_LOG = path.join(LOG_DIR, "freeze-log.jsonl");
const REPORT_PATH = path.join(LOG_DIR, "e2e-assoc-report.json");

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function appendFreeze(entry) {
  ensureLogDir();
  const row = Object.assign(
    { ts: core.nowIso(), tool: "dam-assoc-picker-e2e-probe" },
    entry
  );
  fs.appendFileSync(FREEZE_LOG, JSON.stringify(row) + "\n", "utf8");
  return row;
}

async function main() {
  ensureLogDir();
  const browserPath = core.findBrowser();
  if (!browserPath) {
    const report = {
      ts: core.nowIso(),
      version: core.VERSION,
      cache: core.CACHE,
      pass: false,
      error: "no_chrome_edge",
      results: [],
      note: "overall_pass = Mode B only; Mode A never sets overall pass",
      user_manual_slot: {
        status: "PENDING_USER",
        instruction:
          "Ctrl+F5 branding.html + visualizations.html with cache " +
          core.CACHE +
          "; open card → click each assoc CTA → type 2+ chars; note FREEZE vs list update.",
        results: {},
      },
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
    console.log("[e2e] FAIL no browser");
    process.exit(2);
  }

  console.log("[e2e] browser=" + browserPath);
  console.log("[e2e] cache=" + core.CACHE);
  console.log("[e2e] truth=Mode B (real UI click + async DamSearch ≤" + core.ASYNC_WAIT_MS + "ms)");
  console.log("[e2e] Mode A = programmatic openPicker (labeled only)");

  const results = [];
  for (const cta of core.CTAS) {
    console.log("[e2e] --- " + cta.id + " ---");
    let row = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      row = await core.runCtaBothModes(browserPath, cta, attempt, LOG_DIR);
      if (row.overall_pass) break;
      if (attempt < 2) {
        console.log("[e2e] " + cta.id + " attempt " + attempt + " Mode B FAIL — retry");
        await core.sleep(800);
      }
    }
    results.push(row);

    const a = row.mode_a || {};
    const b = row.mode_b || {};
    console.log(
      "[e2e] " +
        cta.id +
        " mode_a pass=" +
        !!a.pass +
        " open_ms=" +
        a.open_ms +
        " search_ms=" +
        a.search_ms +
        " freeze=" +
        !!a.freeze +
        " | mode_b pass=" +
        !!b.pass +
        " open_ms=" +
        b.open_ms +
        " search_ms=" +
        b.search_ms +
        " async_wait_ms=" +
        b.async_wait_ms +
        " opts=" +
        b.options_count +
        " freeze=" +
        !!b.freeze +
        " | overall=" +
        row.overall_pass +
        (row.error ? " err=" + row.error : "")
    );

    if (b.freeze || (b.error && !b.pass)) {
      appendFreeze({
        cta: cta.id,
        url: cta.url,
        mode: "B",
        outcome: "FREEZE",
        diagnosis: b.error || "mode_b_fail",
        latency_ms: b.async_wait_ms || b.search_ms,
        recovery_action: "resilience_mode_b_or_inspect_dam_assoc_edit",
      });
    }
  }

  const allModeB = results.every((r) => r.overall_pass);
  const report = {
    ts: core.nowIso(),
    version: core.VERSION,
    cache: core.CACHE,
    pass: allModeB,
    truth: "mode_b_only",
    note:
      "overall_pass = Mode B only. Mode A sync paint PASS must NOT be treated as CTA OK. Automated PASS does not replace manual Ctrl+F5 until Mode B green.",
    freeze_ms_threshold: core.FREEZE_MS,
    async_wait_ms: core.ASYNC_WAIT_MS,
    results: results.map((r) => ({
      cta: r.cta,
      selector: r.selector,
      kind: r.kind,
      optsFlags: r.optsFlags,
      pathSummary: r.pathSummary,
      attempt: r.attempt,
      mode_a: {
        open_ms: r.mode_a && r.mode_a.open_ms,
        search_ms: r.mode_a && r.mode_a.search_ms,
        freeze: !!(r.mode_a && r.mode_a.freeze),
        pass: !!(r.mode_a && r.mode_a.pass),
        error: (r.mode_a && r.mode_a.error) || null,
        openMode: (r.mode_a && r.mode_a.openMode) || "programmatic",
      },
      mode_b: {
        open_ms: r.mode_b && r.mode_b.open_ms,
        search_ms: r.mode_b && r.mode_b.search_ms,
        async_wait_ms: r.mode_b && r.mode_b.async_wait_ms,
        options_count: (r.mode_b && r.mode_b.options_count) || 0,
        freeze: !!(r.mode_b && r.mode_b.freeze),
        pass: !!(r.mode_b && r.mode_b.pass),
        error: (r.mode_b && r.mode_b.error) || null,
        result_kind: (r.mode_b && r.mode_b.result_kind) || null,
        message: (r.mode_b && r.mode_b.message) || null,
        screenshot: (r.mode_b && r.mode_b.screenshot) || null,
        openMode: "ui_click",
      },
      overall_pass: !!r.overall_pass,
      error: r.error || null,
      wsUrl: r.wsUrl || null,
    })),
    user_manual_slot: {
      status: "PENDING_USER",
      instruction:
        "Manual > automated until Mode B green. Ctrl+F5 with token " +
        core.CACHE +
        ". For each CTA: open real card → click CTA → type 'bu' → confirm list options or Brak wyników within ~2s (not hang).",
      fill: {
        "branding-product": null,
        "branding-variant": null,
        "viz-suggestions": null,
        "viz-variants": null,
      },
    },
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log("[e2e] report=" + REPORT_PATH);
  console.log("[e2e] === Mode A vs Mode B (overall = Mode B) ===");
  for (const r of report.results) {
    console.log(
      "[e2e] " +
        r.cta +
        " | A=" +
        (r.mode_a.pass ? "PASS" : "FAIL") +
        " (" +
        r.mode_a.search_ms +
        "ms sync)" +
        " | B=" +
        (r.mode_b.pass ? "PASS" : "FAIL") +
        " (async=" +
        r.mode_b.async_wait_ms +
        "ms opts=" +
        r.mode_b.options_count +
        ")" +
        " | overall=" +
        (r.overall_pass ? "PASS" : "FAIL") +
        (r.mode_b.error ? " err=" + r.mode_b.error : "")
    );
  }
  console.log(allModeB ? "[e2e] PASS (all Mode B)" : "[e2e] FAIL (Mode B required)");
  process.exit(allModeB ? 0 : 1);
}

main().catch((err) => {
  appendFreeze({
    outcome: "FREEZE",
    diagnosis: String(err && err.stack ? err.stack : err),
    recovery_action: "run_dam_agent_unstick",
  });
  console.error("[e2e] ERROR", err);
  process.exit(1);
});
