# Wrapper: Mode B assoc resilience OR generic connection unstick.
# Default max 20. Does NOT call cursor-ide-browser MCP.
param(
  [int]$MaxAttempts = 20,
  [switch]$ConnectionOnly
)

$ErrorActionPreference = "Continue"
$OpsDir = $PSScriptRoot
$ContentRoot = Split-Path (Split-Path $OpsDir -Parent) -Parent

if ($ConnectionOnly) {
  & powershell -NoProfile -File (Join-Path $OpsDir "dam-agent-unstick.ps1") -MaxAttempts ([Math]::Min($MaxAttempts, 10))
  exit $LASTEXITCODE
}

& powershell -NoProfile -File (Join-Path $OpsDir "dam-pre-browser.ps1") -MaxAttempts 5
if ($LASTEXITCODE -ne 0) {
  Write-Host "[cdp-resilience] pre-browser FAIL - running unstick"
  & powershell -NoProfile -File (Join-Path $OpsDir "dam-agent-unstick.ps1") -MaxAttempts 5
  exit $LASTEXITCODE
}

$Probe = Join-Path $ContentRoot "scripts\qa\dam-cdp-resilience-probe.js"
if (Test-Path $Probe) {
  Write-Host "[cdp-resilience] running Mode B probe max=$MaxAttempts"
  & node $Probe --max-attempts $MaxAttempts
  exit $LASTEXITCODE
}

Write-Host "[cdp-resilience] pre-browser PASS (assoc probe missing)"
exit 0
