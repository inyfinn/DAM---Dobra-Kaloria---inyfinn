# DAM: budowa statycznego cache miniaturek dla trybu goscia (Panel-DAM / offline).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/ops/warm-guest-cache.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/ops/warm-guest-cache.ps1 -Limit 50
#   powershell -ExecutionPolicy Bypass -File scripts/ops/warm-guest-cache.ps1 -UseBridgeWarm -WaitDrain
#
# Pelny warm (wszystkie indeksy, grid+card):
#   powershell -ExecutionPolicy Bypass -File scripts/ops/warm-guest-cache.ps1 -Warm -Profiles grid,card
#
# Wymaga: dostep do dysku Marketing (X: lub D:) ORAZ most :8766 gdy -UseBridgeWarm.

param(
  [switch]$Warm,
  [switch]$UseBridgeWarm,
  [switch]$WaitDrain,
  [int]$Limit = 0,
  [string]$Profiles = "grid,card",
  [string]$BridgeUrl = "http://127.0.0.1:8766"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ExportPy = Join-Path $Root "apps\desktop\scripts\dam_guest_cache_export.py"
$WarmInvPy = Join-Path $Root "apps\desktop\scripts\dam_warm_inventory.py"
$TmpDir = Join-Path $Root "PAMIEC-PODRECZNA\_warm_guest"
$Inventory = Join-Path $TmpDir "inventory.json"
$LocalDoc = Join-Path $TmpDir "warm-local.json"

function Test-Bridge {
  param([string]$Url)
  try {
    $code = & curl.exe -s --max-time 5 -o NUL -w "%{http_code}" "$Url/health"
    return ($code -eq "200")
  } catch {
    return $false
  }
}

Write-Host "DAM warm-guest-cache (Limit=$Limit Warm=$Warm UseBridgeWarm=$UseBridgeWarm)"

New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

if ($UseBridgeWarm) {
  if (-not (Test-Bridge $BridgeUrl)) {
    Write-Host "Bridge offline ($BridgeUrl). Uruchom: python apps/desktop/serve_browser.py"
    exit 1
  }
  Write-Host "[1/4] Inventory z indeksow..."
  & python $WarmInvPy --file-index --branding-index --out $Inventory
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[2/4] Filter local (tylko pliki na dysku)..."
  & python $WarmInvPy --filter-local --in $Inventory --out $LocalDoc --skip-log (Join-Path $TmpDir "skip.json")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[3/4] Enqueue warm via bridge (async)..."
  $env:DAM_BRIDGE_URL = $BridgeUrl
  & python $WarmInvPy --enqueue --local $LocalDoc --profiles $Profiles --async --batch-size 200
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  if ($WaitDrain) {
    Write-Host "[3b] Czekam na opróżnienie kolejki warm..."
    & python $WarmInvPy --monitor --timeout 30
  }
} elseif ($Warm) {
  Write-Host "[1/2] Direct warm (Python/PIL, bez kolejki bridge)..."
} else {
  Write-Host "[1/2] Eksport istniejacego cache (bez warm)..."
}

$exportArgs = @(
  $ExportPy,
  "--profiles", $Profiles
)
if ($Warm -or $UseBridgeWarm) {
  $exportArgs += "--warm"
}
if ($Limit -gt 0) {
  $exportArgs += @("--limit", $Limit)
}
$exportArgs += "-v"

Write-Host "[export] python $($exportArgs -join ' ')"
& python @exportArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "OK: apps/web/data/guest-cache-manifest.json + apps/web/data/thumbs/"
Write-Host "Deploy: scripts/ops/export-guest-snapshot.ps1 lub deploy-panel-dam-synology.ps1"
