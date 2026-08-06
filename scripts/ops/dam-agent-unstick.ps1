# Recover DAM connection path when cursor-ide-browser MCP hangs.
# NEVER waits on browser_tabs / browser_navigate / browser_cdp.
# Loop: watchdog -> probe -> diag -> kill hung headless chrome / restart serve -> report.
param(
  [int]$MaxAttempts = 5
)

$ErrorActionPreference = "Continue"
$OpsDir = $PSScriptRoot
$ContentRoot = Split-Path (Split-Path $OpsDir -Parent) -Parent
$Watchdog = Join-Path $OpsDir "dam-connection-watchdog.ps1"
$ProbeJs = Join-Path $ContentRoot "scripts\qa\dam-browser-probe.js"
$LogDir = Join-Path $ContentRoot "logs\dam-connection"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Report = Join-Path $LogDir "last-unstick-report.md"
$Jsonl = Join-Path $LogDir "unstick-attempts.jsonl"
$tStart = Get-Date

function Kill-HungHeadlessChrome {
  Write-Host "[unstick] killing headless chrome with remote-debugging-port..."
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -match 'chrome|msedge' -and
      $_.CommandLine -match 'remote-debugging-port|headless|dam-browser-probe|dam-cdp-'
    } |
    ForEach-Object {
      try {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "  killed PID $($_.ProcessId)"
      } catch {}
    }
}

function Write-Attempt([hashtable]$row) {
  $row.ts = (Get-Date).ToUniversalTime().ToString("o")
  Add-Content -LiteralPath $Jsonl -Value ($row | ConvertTo-Json -Compress) -Encoding UTF8
}

$lastWatch = -1
$lastProbe = -1
$passed = $false
$passAttempt = 0

for ($i = 1; $i -le $MaxAttempts; $i++) {
  Write-Host "==== unstick attempt $i / $MaxAttempts ===="
  & powershell -NoProfile -File $Watchdog
  $lastWatch = $LASTEXITCODE
  if ($lastWatch -ne 0) {
    Kill-HungHeadlessChrome
    Write-Attempt @{ attempt = $i; phase = "watchdog"; exit = $lastWatch; recovery = "restart_via_watchdog" }
    Start-Sleep -Seconds 1
    continue
  }

  & node $ProbeJs
  $lastProbe = $LASTEXITCODE
  Write-Attempt @{ attempt = $i; phase = "probe"; watchdogExit = $lastWatch; probeExit = $lastProbe }

  if ($lastProbe -eq 0) {
    $passed = $true
    $passAttempt = $i
    break
  }

  Kill-HungHeadlessChrome
  Write-Host "[unstick] probe FAIL - retry after kill"
  Start-Sleep -Seconds 1
}

$elapsed = [int]((Get-Date) - $tStart).TotalSeconds
$result = if ($passed) { "PASS" } else { "FAIL" }

@(
  "# DAM agent unstick report",
  "",
  "- result: **$result**",
  "- attempt: $passAttempt / $MaxAttempts",
  "- elapsed_s: $elapsed",
  "- watchdogExit: $lastWatch",
  "- probeExit: $lastProbe",
  "- ts: $((Get-Date).ToUniversalTime().ToString('o'))",
  "",
  "If cursor-ide-browser still hangs: **do not wait**. Use headless CDP (`scripts/qa/dam-pakiet-cdp-smoke.js`) or curl. MCP hang != server down.",
  ""
) | Set-Content -LiteralPath $Report -Encoding UTF8

Write-Host "[unstick] RESULT $result attempt=$passAttempt elapsed=${elapsed}s watchdogExit=$lastWatch probeExit=$lastProbe"
Write-Host "[unstick] report: $Report"

if ($passed) { exit 0 } else { exit 1 }
