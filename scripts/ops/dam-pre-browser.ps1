# Gate before cursor-ide-browser MCP: HTTP smoke + probe (5s). Exit 0 = server OK.
# Chrome headless is diagnostic only (WARN, not FAIL). On fail run unstick once.
param(
  [int]$MaxAttempts = 5,
  [switch]$TryChrome
)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Watchdog = Join-Path $PSScriptRoot "dam-connection-watchdog.ps1"
$Unstick = Join-Path $PSScriptRoot "dam-agent-unstick.ps1"
$ProbeJs = Join-Path $RepoRoot "scripts\qa\dam-browser-probe.js"

for ($i = 1; $i -le $MaxAttempts; $i++) {
  Write-Host "[pre-browser] attempt $i / $MaxAttempts"
  & powershell -NoProfile -File $Watchdog
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[pre-browser] watchdog FAIL - running unstick"
    & powershell -NoProfile -File $Unstick -MaxAttempts 3
    continue
  }
  $probeArgs = @($ProbeJs)
  if ($TryChrome) { $probeArgs += "--try-chrome" }
  & node @probeArgs
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[pre-browser] PASS - HTTP gate OK. Browser MCP: 5s timeout; on hang run dam-agent-unstick and log FREEZE."
    exit 0
  }
  Write-Host "[pre-browser] probe FAIL - unstick"
  & powershell -NoProfile -File $Unstick -MaxAttempts 3
}

Write-Host "[pre-browser] FAIL after $MaxAttempts attempts - do NOT use browser_navigate; check logs/dam-connection/"
exit 1
