param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path,
    [string]$OutFile = ""
)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($OutFile)) {
    $OutFile = Join-Path $RepoRoot "dist\evidence\a0-size-baseline.json"
}
$contentData = Join-Path $RepoRoot "apps\web\data"
$binData = Join-Path $RepoRoot "bin\apps\web\data"
$dataRoot = if (Test-Path -LiteralPath $contentData) { $contentData } else { $binData }
function Get-FileMb([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    return [math]::Round((Get-Item -LiteralPath $Path).Length / 1MB, 3)
}
$slimNames = @("file-index.json","search-index.json","branding-grid-index.json","branding-grid-head.json","branding-search-index.json")
$payloadIn = @()
$maxMb = 0.0
foreach ($name in $slimNames) {
    $full = Join-Path $dataRoot $name
    $exists = Test-Path -LiteralPath $full
    $bytes = if ($exists) { (Get-Item -LiteralPath $full).Length } else { $null }
    $mb = if ($bytes -ne $null) { [math]::Round($bytes / 1MB, 3) } else { $null }
    if ($mb -ne $null -and $mb -gt $maxMb) { $maxMb = $mb }
    $payloadIn += @{ name = $name; path = $full; exists = $exists; size_bytes = $bytes; size_mb = $mb }
}
$fatPath = Join-Path $dataRoot "branding-index.json"
$fatMb = Get-FileMb $fatPath
$fatInPayload = ($payloadIn | ForEach-Object { $_.name }) -contains "branding-index.json"
$runtimeRoot = Join-Path $RepoRoot "bin\runtime\win\python"
$runtimeMb = $null
$runtimeExists = Test-Path -LiteralPath $runtimeRoot
if ($runtimeExists) {
    $sum = (Get-ChildItem -LiteralPath $runtimeRoot -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $runtimeMb = [math]::Round($sum / 1MB, 3)
    if ($runtimeMb -gt $maxMb) { $maxMb = $runtimeMb }
}
$latencyMs = $null
$latencyNote = "skipped"
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8765/branding.html" -UseBasicParsing -TimeoutSec 5
    $sw.Stop()
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) {
        $latencyMs = [int]$sw.ElapsedMilliseconds
        $latencyNote = "GET branding.html"
    }
} catch { $latencyNote = "skipped: $($_.Exception.Message)" }
$result = @{
    generated_at_utc = (Get-Date).ToUniversalTime().ToString("o")
    repo_root = $RepoRoot
    data_root = $dataRoot
    max_mb = $maxMb
    payload_in_slim = $payloadIn
    payload_out_fat = @("branding-index.json","branding-index*.backup*")
    branding_index = @{
        path = $fatPath
        size_mb = $fatMb
        in_payload_candidates = $fatInPayload
        expected_not_in_payload = (-not $fatInPayload)
    }
    runtime_embed_python = @{ path = $runtimeRoot; size_mb = $runtimeMb; exists = $runtimeExists }
    branding_cold_latency = @{ ms = $latencyMs; note = $latencyNote }
}
$outDir = Split-Path -Parent $OutFile
if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutFile -Encoding utf8
Write-Host "Wrote $OutFile max_mb=$maxMb branding-index NOT in payload: $(-not $fatInPayload)"
if ($fatInPayload) { exit 2 }
exit 0

