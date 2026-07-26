#!/usr/bin/env node
/**
 * CDP resilience probe — Mode B ONLY (same truth as e2e Mode B).
 *
 * PASS only when real UI click + async DamSearch settle succeeds.
 * Sync paint / programmatic openPicker / http_only MUST NOT count as PASS.
 *
 * Usage:
 *   node scripts/qa/dam-cdp-resilience-probe.js [--max-attempts 20] [--cta viz-suggestions] [--cta viz-variants]
 *
 * Logs:
 *   logs/dam-connection/freeze-log.jsonl
 *   logs/dam-connection/resilience-attempts.jsonl
 *   logs/dam-connection/last-resilience-report.md
 *   logs/dam-connection/resilience-report.json
 */
"use strict";

const fs = require("fs");
const path = require("path");
const core = require("./lib/dam-cdp-assoc-probe-core");

const REPO = path.resolve(__dirname, "..", "..");
const LOG_DIR = path.join(REPO, "logs", "dam-connection");
const FREEZE_LOG = path.join(LOG_DIR, "freeze-log.jsonl");
const ATTEMPTS_LOG = path.join(LOG_DIR, "resilience-attempts.jsonl");
const REPORT_MD = path.join(LOG_DIR, "last-resilience-report.md");
const REPORT_JSON = path.join(LOG_DIR, "resilience-report.json");

const METHODS = [
  { id: "cdp_port_9339", port: 9339, kind: "cdp" },
  { id: "cdp_port_9222", port: 9222, kind: "cdp" },
  { id: "cdp_port_9223", port: 9223, kind: "cdp" },
  { id: "cdp_port_9340", port: 9340, kind: "cdp" },
  { id: "cdp_port_9335", port: 9335, kind: "cdp" },
  { id: "cdp_killall_9336", port: 9336, kind: "cdp_killall" },
];

function parseArgs() {
  const argv = process.argv.slice(2);
  let maxAttempts = 20; /* session default — do not wait for 100 until tool fixed */
  const ctaIds = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--max-attempts" && argv[i + 1]) {
      maxAttempts = Math.max(1, parseInt(argv[++i], 10) || 20);
    } else if (argv[i] === "--cta" && argv[i + 1]) {
      ctaIds.push(argv[++i]);
    }
  }
  const viz = core.CTAS.filter((c) => c.page === "viz");
  const ctas = ctaIds.length
    ? core.CTAS.filter((c) => ctaIds.indexOf(c.id) >= 0)
    : viz;
  return { maxAttempts, ctas: ctas.length ? ctas : viz };
}

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function appendJsonl(file, row) {
  ensureLogDir();
  fs.appendFileSync(
    file,
    JSON.stringify(Object.assign({ ts: core.nowIso() }, row)) + "\n",
    "utf8"
  );
}

async function attemptOnce(browserPath, method, cta, attemptNo) {
  const t0 = Date.now();
  const result = await core.runModeBOnly(browserPath, cta, method.port, LOG_DIR, {
    killAllFirst: method.kind === "cdp_killall",
  });
  const modeBPass = !!(result.ok && result.mode_b && result.mode_b.pass);
  const row = {
    attempt: attemptNo,
    cta: cta.id,
    method_used: method.id,
    mode: "B",
    hang_point: result.hang_point || null,
    latency_ms: result.latency_ms != null ? result.latency_ms : Date.now() - t0,
    diagnosis: modeBPass ? "pass" : result.diagnosis || "unknown",
    recovery_action: modeBPass ? "none" : "kill_chrome_rotate_port",
    error: result.error || null,
    search_ms: result.search_ms,
    async_wait_ms: result.async_wait_ms,
    open_ms: result.open_ms,
    options_count: result.options_count,
    ok: modeBPass,
    /* Explicit: never treat sync/programmatic as pass */
    sync_paint_alone_not_pass: true,
    wsUrl: result.wsUrl || null,
  };
  appendJsonl(ATTEMPTS_LOG, row);
  if (!modeBPass) {
    appendJsonl(FREEZE_LOG, {
      tool: "dam-cdp-resilience-probe",
      cta: cta.id,
      method_used: method.id,
      mode: "B",
      hang_point: row.hang_point,
      outcome: "FREEZE",
      latency_ms: row.latency_ms,
      diagnosis: row.diagnosis,
      recovery_action: row.recovery_action,
      error: row.error,
    });
  }
  return row;
}

function classifyCta(attempts) {
  const real = attempts.filter((a) => a && a.mode === "B");
  const passes = real.filter((a) => a.ok);
  if (passes.length) {
    return {
      verdict: "PASS",
      layer: "mode_b_ok",
      pass_method: passes[0].method_used,
      search_ms: passes[0].search_ms,
      async_wait_ms: passes[0].async_wait_ms,
      options_count: passes[0].options_count,
    };
  }
  const codeFails = real.filter(
    (a) => a.diagnosis === "code" || /async_search|blocked|freeze|picker|cta/i.test(a.error || "")
  );
  const connFails = real.filter((a) => a.diagnosis === "connection" || a.diagnosis === "connection_or_boot");
  const methodsTried = Array.from(new Set(real.map((a) => a.method_used)));
  if (codeFails.length >= 3 && codeFails.length >= connFails.length) {
    return {
      verdict: "FAIL_CODE",
      layer: "code",
      reason: "Mode B async DamSearch fail persists across CDP ports",
      methodsTried,
    };
  }
  if (connFails.length && !codeFails.length) {
    return {
      verdict: "FAIL_CONNECTION",
      layer: "connection",
      reason: "all Mode B failures classified connection/boot",
      methodsTried,
    };
  }
  return {
    verdict: "FAIL_EXHAUSTED",
    layer: codeFails.length >= connFails.length ? "code_likely" : "connection_likely",
    reason: "max attempts exhausted without Mode B pass",
    methodsTried,
    codeFails: codeFails.length,
    connFails: connFails.length,
  };
}

async function main() {
  ensureLogDir();
  const { maxAttempts, ctas } = parseArgs();
  const browserPath = core.findBrowser();
  if (!browserPath) {
    console.error("[resilience] FAIL no chrome/edge");
    process.exit(2);
  }

  const smoke = await core.httpGet(core.UI + "/visualizations.html?v=" + core.CACHE, 5000);
  if (!smoke.ok) {
    console.error("[resilience] FAIL UI not reachable — run dam-pre-browser.ps1");
    process.exit(2);
  }

  console.log("[resilience] browser=" + browserPath);
  console.log("[resilience] maxAttempts=" + maxAttempts + " ctas=" + ctas.map((c) => c.id).join(","));
  console.log("[resilience] cache=" + core.CACHE);
  console.log("[resilience] truth=Mode B only (real UI click + async DamSearch)");

  const perCta = {};
  let globalAttempt = 0;
  /* Per-CTA budget — never burn all attempts on first failing CTA. */
  const perCtaMax = Math.max(3, Math.ceil(maxAttempts / Math.max(1, ctas.length)));

  for (const cta of ctas) {
    console.log("[resilience] === CTA " + cta.id + " (Mode B) ===");
    const attempts = [];
    let passed = false;
    let methodIdx = 0;
    let ctaAttempt = 0;
    while (!passed && ctaAttempt < perCtaMax && globalAttempt < maxAttempts * 2) {
      const method = METHODS[methodIdx % METHODS.length];
      methodIdx++;
      globalAttempt++;
      ctaAttempt++;
      console.log(
        "[resilience] attempt " +
          ctaAttempt +
          "/" +
          perCtaMax +
          " (global " +
          globalAttempt +
          ") cta=" +
          cta.id +
          " method=" +
          method.id
      );
      const row = await attemptOnce(browserPath, method, cta, globalAttempt);
      attempts.push(row);
      console.log(
        "[resilience] → ok=" +
          row.ok +
          " hang=" +
          row.hang_point +
          " diag=" +
          row.diagnosis +
          (row.error ? " err=" + row.error : "") +
          (row.async_wait_ms != null ? " async_wait_ms=" + row.async_wait_ms : "") +
          (row.options_count != null ? " opts=" + row.options_count : "")
      );
      if (row.ok) {
        passed = true;
        break;
      }
      /* Early stop: Mode B code hang across ≥4 ports */
      const cdpFails = attempts.filter(
        (a) => !a.ok && a.hang_point === "evaluate" && /^cdp_/.test(a.method_used)
      );
      const cdpMethods = Array.from(new Set(cdpFails.map((a) => a.method_used)));
      if (cdpFails.length >= 4 && cdpMethods.length >= 3) {
        console.log(
          "[resilience] EARLY STOP cta=" +
            cta.id +
            " — Mode B evaluate hang on " +
            cdpMethods.length +
            " CDP methods (code hang evidenced)"
        );
        break;
      }
      /* Selector/modal miss across 3 methods → move on (cards/boot), don't starve siblings */
      const selFails = attempts.filter(
        (a) => !a.ok && /modal_not_open|no_card|cta_not_in_modal|DamAssocEdit_boot/i.test(a.error || "")
      );
      if (selFails.length >= 3) {
        console.log(
          "[resilience] EARLY STOP cta=" + cta.id + " — modal/card selector fail ×" + selFails.length
        );
        break;
      }
    }
    perCta[cta.id] = {
      attempts,
      classification: classifyCta(attempts),
      passed,
    };
  }

  const lines = [];
  lines.push("# DAM CDP resilience report (Mode B only)");
  lines.push("");
  lines.push("- ts: " + core.nowIso());
  lines.push("- cache: " + core.CACHE);
  lines.push("- maxAttempts: " + maxAttempts);
  lines.push("- totalAttemptsUsed: " + globalAttempt);
  lines.push("- truth: Mode B (real UI click + async DamSearch) — sync paint NEVER counts as PASS");
  lines.push("");
  lines.push("## Per-CTA");
  lines.push("");
  for (const cta of ctas) {
    const block = perCta[cta.id];
    const cls = block.classification;
    lines.push("### " + cta.id);
    lines.push("- attempts: " + block.attempts.length);
    lines.push("- verdict: **" + cls.verdict + "**");
    lines.push("- layer: " + cls.layer);
    lines.push(
      "- methods: " + (cls.methodsTried || block.attempts.map((a) => a.method_used)).join(", ")
    );
    if (cls.pass_method) {
      lines.push(
        "- pass_method: " +
          cls.pass_method +
          " async_wait_ms=" +
          cls.async_wait_ms +
          " opts=" +
          cls.options_count
      );
    }
    if (cls.reason) lines.push("- reason: " + cls.reason);
    lines.push("");
  }
  lines.push("## Note");
  lines.push("");
  lines.push(
    "Resilience PASS ≠ proof of innocence from broken old probe. Connection recovery on sync-paint probe is VOID."
  );
  lines.push("Logs: `resilience-attempts.jsonl`, `freeze-log.jsonl`");

  fs.writeFileSync(REPORT_MD, lines.join("\n"), "utf8");
  fs.writeFileSync(
    REPORT_JSON,
    JSON.stringify(
      {
        ts: core.nowIso(),
        cache: core.CACHE,
        version: core.VERSION,
        maxAttempts,
        totalAttemptsUsed: globalAttempt,
        truth: "mode_b_only",
        perCta,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("[resilience] report=" + REPORT_MD);
  const allPass = ctas.every((c) => perCta[c.id] && perCta[c.id].passed);
  console.log(
    allPass ? "[resilience] PASS (Mode B)" : "[resilience] FAIL (Mode B required — see report)"
  );
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  appendJsonl(FREEZE_LOG, {
    tool: "dam-cdp-resilience-probe",
    outcome: "FREEZE",
    diagnosis: String(err && err.stack ? err.stack : err),
    recovery_action: "run_dam_agent_unstick",
  });
  console.error("[resilience] ERROR", err);
  process.exit(1);
});
