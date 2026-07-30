# Sync DAM UI (apps/web) -> Synology Web Station: W:\web\Panel-DAM
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/ops/deploy-panel-dam-synology.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/ops/deploy-panel-dam-synology.ps1 -NasWebRoot "W:\web"

param(
  [string]$NasWebRoot = "W:\web",
  [string]$TargetName = "Panel-DAM"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Source = Join-Path $Root "apps\web"
$Dest = Join-Path $NasWebRoot $TargetName

if (-not (Test-Path -LiteralPath $Source)) {
  throw "Brak zrodla UI: $Source"
}
if (-not (Test-Path -LiteralPath $NasWebRoot)) {
  throw "Brak udzialu NAS web: $NasWebRoot (zmapuj W: = Inyfinn Synology)"
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null

$ExcludeDirNames = @(
  "_qa", "node_modules", ".venv", "venv", "__pycache__"
)
$ExcludeFileGlobs = @(
  "*.code-workspace", "_bump_*.py", "_qa_*", "_patch_*.js", "_debug_*.py"
)

function ShouldSkipDir([string]$name) {
  return $ExcludeDirNames -contains $name
}

function ShouldSkipFile([string]$name) {
  foreach ($g in $ExcludeFileGlobs) {
    if ($name -like $g) { return $true }
  }
  return $false
}

function Copy-DamWebTree($src, $dst) {
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Get-ChildItem -Force -LiteralPath $src | ForEach-Object {
    if ($_.PSIsContainer) {
      if (ShouldSkipDir $_.Name) { return }
      Copy-DamWebTree $_.FullName (Join-Path $dst $_.Name)
    } else {
      if (ShouldSkipFile $_.Name) { return }
      Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dst $_.Name) -Force
    }
  }
}

Write-Host "DAM deploy: $Source -> $Dest"
Copy-DamWebTree $Source $Dest

# Runtime dla przegladarki zdalnej (bridge musi byc wystawiony na NAS/PC - patrz docs/SYNOLOGY-WEB-PANEL.md)
$runtimeSyno = @{
  app          = "dam-eta"
  host         = "inyfinn.synology.me"
  ui_port      = 443
  bridge_port  = 8766
  ui_origin    = "https://inyfinn.synology.me/Panel-DAM"
  bridge       = "https://inyfinn.synology.me:8766"
  start_url    = "https://inyfinn.synology.me/Panel-DAM/dashboard.html"
  deploy_note  = "Synology Web Station 443; URL https://inyfinn.synology.me/Panel-DAM/ (bez :5001). Pelny DAM = bridge."
}
$runtimePath = Join-Path $Dest "data\dam-runtime.json"
New-Item -ItemType Directory -Force -Path (Split-Path $runtimePath) | Out-Null
$runtimeSyno | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $runtimePath -Encoding UTF8

$indexHtml = @'
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=./dashboard.html">
  <title>DAM Panel</title>
</head>
<body>
  <p><a href="./dashboard.html">DAM - Dobra Kaloria</a></p>
</body>
</html>
'@
Set-Content -LiteralPath (Join-Path $Dest "index.html") -Value $indexHtml -Encoding UTF8

# Guest snapshot (podglad przegladarki bez mostu)
$warmScript = Join-Path $Root "scripts\ops\warm-guest-cache.ps1"
if (Test-Path -LiteralPath $warmScript) {
  $hasThumbs = Test-Path -LiteralPath (Join-Path $Source "data\thumbs")
  $hasManifest = Test-Path -LiteralPath (Join-Path $Source "data\guest-cache-manifest.json")
  if (-not $hasThumbs -or -not $hasManifest) {
    Write-Host 'WARN: brak guest cache - uruchom: powershell -File scripts/ops/warm-guest-cache.ps1 -Warm'
  }
}

$exportScript = Join-Path $Root "scripts\ops\export-guest-snapshot.ps1"
if (Test-Path -LiteralPath $exportScript) {
  $hasManifest = Test-Path -LiteralPath (Join-Path $Source "data\guest-cache-manifest.json")
  if ($hasManifest) {
    & $exportScript -Dest (Join-Path $Dest "data") -SkipThumbBuild
  } else {
    & $exportScript -Dest (Join-Path $Dest "data")
  }
  Write-Host "OK: guest-snapshot.json + guest-cache-manifest.json + digest thumbs"
}

# Instalator Windows do pobrania (opcjonalnie - nie blokuje deployu UI)
$buildInstaller = Join-Path $Root "apps\desktop\installer\build-dam-installer.ps1"
if (Test-Path -LiteralPath $buildInstaller) {
  try {
    & $buildInstaller
    $zip = Join-Path $Root "dist\DAM-DobraKaloria-Windows-Setup.zip"
    if (Test-Path -LiteralPath $zip) {
      $relDir = Join-Path $Dest "releases"
      New-Item -ItemType Directory -Force -Path $relDir | Out-Null
      Copy-Item -LiteralPath $zip -Destination (Join-Path $relDir "DAM-DobraKaloria-Windows-Setup.zip") -Force
      Write-Host "OK: releases/DAM-DobraKaloria-Windows-Setup.zip"
    }
  } catch {
    Write-Warning "Instalator ZIP pominiety: $($_.Exception.Message)"
  }
}

Write-Host "OK: wrzucono Panel-DAM na NAS."
Write-Host "Kanoniczny URL: https://inyfinn.synology.me/Panel-DAM/"
Write-Host "Pelny DAM: wymaga mostu (bridge) - docs/SYNOLOGY-WEB-PANEL.md"
