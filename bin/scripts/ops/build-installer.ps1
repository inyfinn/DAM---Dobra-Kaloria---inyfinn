#Requires -Version 5.1
param(
  [switch]$SkipSync,
  [switch]$SkipVendor,
  [switch]$SkipExeBuild,
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"

function Remove-TreeForce([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $full = (Resolve-Path -LiteralPath $Path).Path
  $long = if ($full.StartsWith('\\?\')) { $full } else { "\\?\$full" }
  cmd /c "rmdir /s /q `"$long`"" | Out-Null
}

function Invoke-Robo([string]$src, [string]$dst, [string[]]$xd, [string[]]$xf) {
  if (-not (Test-Path -LiteralPath $src)) { return }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  $rcArgs = @($src, $dst, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np")
  if ($xd -and $xd.Count -gt 0) { $rcArgs += "/XD"; $rcArgs += $xd }
  if ($xf -and $xf.Count -gt 0) { $rcArgs += "/XF"; $rcArgs += $xf }
  & robocopy @rcArgs | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE): $src" }
}

$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$BinRoot = Join-Path $GitRoot "bin"

$Iscc = Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $Iscc)) {
  $alt = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($alt) { $Iscc = $alt } else { throw "Brak ISCC.exe (zainstaluj Inno Setup 6)." }
}

if (-not $Version) {
  $verJson = Join-Path $BinRoot "apps\web\version.json"
  if (Test-Path $verJson) {
    try {
      $vj = Get-Content $verJson -Raw | ConvertFrom-Json
      if ($vj.version) { $Version = [string]$vj.version }
    } catch {}
  }
  if (-not $Version) { $Version = "5.0.130" }
}

Write-Host "GIT_ROOT=$GitRoot Version=$Version"
if (-not $SkipSync) { & (Join-Path $PSScriptRoot "sync-apps-to-bin.ps1") }

$rtPy = Join-Path $BinRoot "runtime\win\python\pythonw.exe"
if ($SkipVendor -and (Test-Path $rtPy)) {
  Write-Host "Skip vendor."
} else {
  & (Join-Path $PSScriptRoot "vendor-runtime-win.ps1")
  if (-not (Test-Path $rtPy)) { throw "Brak pythonw po vendor." }
}

if ($SkipExeBuild -and (Test-Path (Join-Path $GitRoot "DAM.exe"))) {
  Write-Host "Skip DAM.exe build."
} else {
  & (Join-Path $BinRoot "scripts\ops\build-dam-root-exe.ps1")
}

$stageRoot = Join-Path $BinRoot "dist\staging\DAM-install"
Remove-TreeForce $stageRoot
New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
Copy-Item (Join-Path $GitRoot "DAM.exe") (Join-Path $stageRoot "DAM.exe") -Force

$binDst = Join-Path $stageRoot "bin"
New-Item -ItemType Directory -Force -Path $binDst | Out-Null

$xdCommon = @(
  "__pycache__", ".venv", "node_modules", "webview2-profile", "logs", "_qa",
  "vendor", "framework", "bootstrap", "thumbs", "_invoice_mail_stage", "tooling", "data"
)
$xfCommon = @(
  "*.pyc", "*.bak*", "*backup*", "*Conflict*", "*.drifted*", "*.pre-*",
  "index-watcher.log", "audit-log.jsonl", "branding-index.json"
)

Write-Host "Staging bin (runtime + THEME + apps)..."
Invoke-Robo (Join-Path $BinRoot "runtime") (Join-Path $binDst "runtime") $xdCommon $xfCommon
Invoke-Robo (Join-Path $BinRoot "THEME") (Join-Path $binDst "THEME") @("__pycache__", "documentation") @("*.zip", "*.map")
Invoke-Robo (Join-Path $BinRoot "apps\desktop") (Join-Path $binDst "apps\desktop") $xdCommon $xfCommon
Invoke-Robo (Join-Path $BinRoot "apps\web") (Join-Path $binDst "apps\web") ($xdCommon + @("data")) $xfCommon

$webDataSrc = Join-Path $BinRoot "apps\web\data"
$webDataDst = Join-Path $binDst "apps\web\data"
New-Item -ItemType Directory -Force -Path $webDataDst | Out-Null
$keepData = @(
  "app-settings.json", "program-instructions.json", "naming-dictionary.json",
  "product-name-pl.json", "product-people.json", "product-status.json",
  "lifecycle-status.json", "search-index.json", "file-index.json",
  "change-log.json", "pg-config.example.json"
)
foreach ($name in $keepData) {
  $src = Join-Path $webDataSrc $name
  if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination (Join-Path $webDataDst $name) -Force }
}
New-Item -ItemType Directory -Force -Path (Join-Path $webDataDst "thumbs") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $binDst "apps\desktop\data") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $binDst "DATABASE") | Out-Null
$usersSeedSrc = Join-Path $BinRoot "DATABASE\users-seed.sqlite"
if (-not (Test-Path -LiteralPath $usersSeedSrc)) {
  $usersSeedSrc = Join-Path $BinRoot "apps\desktop\data\users-seed.sqlite"
}
$usersSeedDst = Join-Path $binDst "DATABASE\users-seed.sqlite"
if (Test-Path -LiteralPath $usersSeedSrc) {
  Copy-Item -LiteralPath $usersSeedSrc -Destination $usersSeedDst -Force
  Write-Host "Shipped DATABASE/users-seed.sqlite ($((Get-Item $usersSeedSrc).Length) bytes)"
} else {
  Write-Warning "Brak users-seed.sqlite - swieza instalacja bez kont!"
}
$readmeDb = Join-Path $BinRoot "DATABASE\README.md"
if (Test-Path -LiteralPath $readmeDb) {
  Copy-Item -LiteralPath $readmeDb -Destination (Join-Path $binDst "DATABASE\README.md") -Force
}
Set-Content -Path (Join-Path $webDataDst "branding-index.json") -Value '{"version":1,"items":[],"note":"empty-shipped-installer"}' -Encoding UTF8

$readmeSrc = Join-Path $BinRoot "installer\README.txt"
if (Test-Path $readmeSrc) { Copy-Item $readmeSrc (Join-Path $stageRoot "README.txt") -Force }

$vcRedist = Join-Path $BinRoot "installer\redist\vc_redist.x64.exe"
New-Item -ItemType Directory -Force -Path (Split-Path $vcRedist) | Out-Null
if (-not (Test-Path $vcRedist)) {
  Write-Host "Downloading VC++ redist..."
  Invoke-WebRequest -Uri "https://aka.ms/vs/17/release/vc_redist.x64.exe" -OutFile $vcRedist -UseBasicParsing
}

$releaseDir = $GitRoot
$iss = Join-Path $BinRoot "installer\DAM-Setup.iss"
& $Iscc "/DMyAppVersion=$Version" "/DStageDir=$stageRoot" "/DGitRoot=$GitRoot" "/DReleaseDir=$releaseDir" $iss
if ($LASTEXITCODE -ne 0) { throw "ISCC failed: $LASTEXITCODE" }

$setupExe = Join-Path $releaseDir "DAM-Setup.exe"
if (-not (Test-Path $setupExe)) { throw "Brak $setupExe" }
$sizeMb = [math]::Round((Get-Item $setupExe).Length / 1MB, 1)
Write-Host ""
Write-Host "GOTOWE - kliknij:"
Write-Host ('  {0}  ({1} MB)' -f $setupExe, $sizeMb)
Write-Host ""

