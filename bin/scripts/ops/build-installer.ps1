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
  "index-watcher.log", "audit-log.jsonl", "branding-index.json",
  "machine-config.json", "dam-connection.env", "pg-config.json"
)

Write-Host "Staging bin (runtime + THEME + apps)..."
Invoke-Robo (Join-Path $BinRoot "runtime") (Join-Path $binDst "runtime") $xdCommon $xfCommon
Invoke-Robo (Join-Path $BinRoot "THEME") (Join-Path $binDst "THEME") @("__pycache__", "documentation") @("*.zip", "*.map")
Invoke-Robo (Join-Path $BinRoot "apps\desktop") (Join-Path $binDst "apps\desktop") $xdCommon $xfCommon
# apps/web: NIE wykluczaj assets/vendor (Jost + Unicons). Bez tego ikony w WebView giną.
$xdWeb = @($xdCommon | Where-Object { $_ -ne "vendor" }) + @("data")
Invoke-Robo (Join-Path $BinRoot "apps\web") (Join-Path $binDst "apps\web") $xdWeb $xfCommon
function Test-PgConfigSecret([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  try {
    $j = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    $pw = [string]$j.password
    $portOk = ([string]$j.port) -eq "5433"
    $dbOk = ([string]$j.dbname) -eq "dam_eta"
    return ($pw.Length -ge 8) -and $portOk -and $dbOk
  } catch {
    return $false
  }
}

$webVendorSrc = Join-Path $BinRoot "apps\web\assets\vendor"
$webVendorDst = Join-Path $binDst "apps\web\assets\vendor"
$uniconsCss = Join-Path $webVendorSrc "icons\unicons-line.css"
if (-not (Test-Path -LiteralPath $uniconsCss)) {
  throw "Brak apps/web/assets/vendor/icons/unicons-line.css — Setup NIE moze wyjechac bez ikon."
}
New-Item -ItemType Directory -Force -Path $webVendorDst | Out-Null
Invoke-Robo $webVendorSrc $webVendorDst @() @()
Write-Host "Shipped apps/web/assets/vendor (fonts/icons)."

$webDataSrc = Join-Path $BinRoot "apps\web\data"
$webDataDst = Join-Path $binDst "apps\web\data"
New-Item -ItemType Directory -Force -Path $webDataDst | Out-Null
$keepData = @(
  "app-settings.json", "program-instructions.json", "naming-dictionary.json",
  "product-name-pl.json", "product-people.json", "product-status.json",
  "lifecycle-status.json", "search-index.json", "file-index.json",
  "change-log.json", "pg-config.example.json",
  "branding-grid-head.json", "branding-grid-index.json",
  "branding-search-index.json", "branding-segments.json",
  "brand-formats.json", "brand-perspectives.json"
)
foreach ($name in $keepData) {
  $src = Join-Path $webDataSrc $name
  if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination (Join-Path $webDataDst $name) -Force }
}
$headSrc = Join-Path $webDataSrc "branding-grid-head.json"
$indexDst = Join-Path $webDataDst "branding-grid-index.json"
if ((-not (Test-Path -LiteralPath $indexDst) -or ((Get-Item -LiteralPath $indexDst).Length -lt 1000)) -and (Test-Path -LiteralPath $headSrc)) {
  Copy-Item -LiteralPath $headSrc -Destination $indexDst -Force
  Write-Host "Staged branding-grid-index.json from head (slim)."
}
$headDst = Join-Path $webDataDst "branding-grid-head.json"
if (-not (Test-Path -LiteralPath $headDst)) {
  throw "Brak branding-grid-head.json — Setup NIE moze wyjechac z pustym Brandingiem."
}
if ((Get-Item -LiteralPath $headDst).Length -lt 1000) {
  throw "branding-grid-head.json jest stubem (<1 KB) — Setup NIE moze wyjechac."
}
if (-not (Test-Path -LiteralPath $indexDst) -or ((Get-Item -LiteralPath $indexDst).Length -lt 1000)) {
  throw "branding-grid-index.json pusty/brak — Setup NIE moze wyjechac."
}
New-Item -ItemType Directory -Force -Path (Join-Path $webDataDst "thumbs") | Out-Null
$deskDataDst = Join-Path $binDst "apps\desktop\data"
New-Item -ItemType Directory -Force -Path $deskDataDst | Out-Null
$pgEx = Join-Path $BinRoot "apps\desktop\pg-config.example.json"
if (Test-Path -LiteralPath $pgEx) {
  Copy-Item -LiteralPath $pgEx -Destination (Join-Path $deskDataDst "pg-config.example.json") -Force
  Copy-Item -LiteralPath $pgEx -Destination (Join-Path $binDst "apps\desktop\pg-config.example.json") -Force
}
$pgCands = @(
  (Join-Path $env:LOCALAPPDATA "Programs\DAM\bin\apps\desktop\data\pg-config.json"),
  (Join-Path $BinRoot "apps\desktop\data\pg-config.json")
)
$pgSrc = $pgCands | Where-Object { Test-PgConfigSecret $_ } | Select-Object -First 1
if (-not $pgSrc) {
  throw "Brak passworded pg-config.json (gitignored). Setup NIE moze wyjechac — dummy user nie kopiuje nic. Poloz sekret w bin\apps\desktop\data\pg-config.json albo w zainstalowanym DAM."
}
Copy-Item -LiteralPath $pgSrc -Destination (Join-Path $deskDataDst "pg-config.json") -Force
Copy-Item -LiteralPath $pgSrc -Destination (Join-Path $binDst "apps\desktop\pg-config.json") -Force
Write-Host "Embedded pg-config.json (Synology, passworded) from build-machine secret. Not committed."
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
if (-not (Test-Path -LiteralPath (Join-Path $webDataDst "branding-index.json"))) {
  Set-Content -Path (Join-Path $webDataDst "branding-index.json") -Value '{"version":1,"assets":[],"note":"slim-only-installer-use-branding-grid-head"}' -Encoding UTF8
}

$readmeSrc = Join-Path $BinRoot "installer\README.txt"
if (Test-Path $readmeSrc) { Copy-Item $readmeSrc (Join-Path $stageRoot "README.txt") -Force }

$redistDir = Join-Path $BinRoot "installer\redist"
New-Item -ItemType Directory -Force -Path $redistDir | Out-Null
$vcRedist = Join-Path $redistDir "vc_redist.x64.exe"
if (-not (Test-Path $vcRedist)) {
  Write-Host "Downloading VC++ redist..."
  Invoke-WebRequest -Uri "https://aka.ms/vs/17/release/vc_redist.x64.exe" -OutFile $vcRedist -UseBasicParsing
}
$wv2Bootstrap = Join-Path $redistDir "MicrosoftEdgeWebview2Setup.exe"
if (-not (Test-Path $wv2Bootstrap)) {
  Write-Host "Downloading WebView2 bootstrapper..."
  Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $wv2Bootstrap -UseBasicParsing
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

