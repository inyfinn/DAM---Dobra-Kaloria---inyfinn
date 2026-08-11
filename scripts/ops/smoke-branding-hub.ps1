# Smoke test: Branding DAM Hub (UI static + local bridge)
# Uruchom po pullu / aktualizacji mostu. Wymaga dzialajacego bridge na 8766.

$ErrorActionPreference = "Stop"
$bridge = $env:DAM_BRIDGE_URL
if (-not $bridge) { $bridge = "http://127.0.0.1:8766" }
$ui = $env:DAM_UI_URL
if (-not $ui) { $ui = "http://127.0.0.1:8765" }

$fail = 0

function Test-Url {
    param([string]$Url, [string]$Label)
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
        if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) {
            Write-Host "OK  $Label"
            return $true
        }
        Write-Host "FAIL $Label (HTTP $($r.StatusCode))"
        return $false
    } catch {
        Write-Host "FAIL $Label :: $($_.Exception.Message)"
        return $false
    }
}

Write-Host "=== DAM Branding Hub smoke ==="
Write-Host "Bridge: $bridge"
Write-Host "UI:     $ui"
Write-Host ""

if (-not (Test-Url "$ui/branding.html" "branding.html")) { $fail++ }
if (-not (Test-Url "$ui/explorer.html" "explorer.html")) { $fail++ }
if (-not (Test-Url "$ui/project.html?id=1" "project.html")) { $fail++ }

try {
    $health = Invoke-RestMethod -Uri "$bridge/health" -TimeoutSec 10
    $ver = $health.api_version
    if ($null -eq $ver -or [int]$ver -lt 2) {
        Write-Host "FAIL bridge api_version (stary most - zrestartuj local_bridge.py)"
        $fail++
    } else {
        Write-Host "OK  bridge api_version=$ver"
    }
} catch {
    Write-Host "FAIL bridge /health :: $($_.Exception.Message)"
    $fail++
}

$hubRoutes = @(
    "/branding-index",
    "/product-catalog",
    "/bulk-packaging",
    "/branding/status"
)
foreach ($route in $hubRoutes) {
    if (-not (Test-Url "$bridge$route" $route)) { $fail++ }
}

# JSON lokalne (bez serwera)
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$dataFiles = @(
    "apps/web/data/branding-index.json",
    "apps/web/data/campaigns.json",
    "apps/web/data/product-catalog.json",
    "apps/web/data/bulk-packaging.json"
)
foreach ($rel in $dataFiles) {
    $path = Join-Path $repoRoot $rel
    if (Test-Path $path) {
        try {
            $null = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
            Write-Host "OK  JSON $rel"
        } catch {
            Write-Host "FAIL JSON $rel :: $($_.Exception.Message)"
            $fail++
        }
    } else {
        Write-Host "FAIL brak pliku $rel"
        $fail++
    }
}

Write-Host ""
if ($fail -gt 0) {
    Write-Host "Wynik: $fail bledow. Po aktualizacji kodu zrestartuj most: python apps/desktop/local_bridge.py"
    exit 1
}
Write-Host "Wynik: PASS"
exit 0
