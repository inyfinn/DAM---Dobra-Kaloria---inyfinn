#Requires -Version 5.1
<#
.SYNOPSIS
  Portable DAM: sync -> vendor runtime -> engine onedir -> Go bootstrap -> stage -> zip.
  Public entry: GIT_ROOT/DAM.exe (Go). Engine: bin/runtime/win/dam-app/dam-appw.exe.
#>
param(
  [switch]$SkipVendorRuntime,
  [switch]$SkipZip
)

$ErrorActionPreference = "Stop"

$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$BinRoot = Join-Path $GitRoot "bin"
$GoExe = Join-Path $GitRoot "bin\tooling\go\bin\go.exe"
if (-not (Test-Path -LiteralPath $GoExe)) { $GoExe = "go" }
$RuntimePyw = Join-Path $BinRoot "runtime\win\python\pythonw.exe"
$Staging = Join-Path $GitRoot "dist\staging\DAM"
$ReleaseDir = Join-Path $GitRoot "dist\release\portable"

function Invoke-Robocopy([string]$src, [string]$dst, [string[]]$xd, [string[]]$xf) {
  if (-not (Test-Path -LiteralPath $src)) { throw "Missing source: $src" }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  $rcArgs = @($src, $dst, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np")
  if ($xd -and $xd.Count) { $rcArgs += "/XD"; $rcArgs += $xd }
  if ($xf -and $xf.Count) { $rcArgs += "/XF"; $rcArgs += $xf }
  & robocopy @rcArgs | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE): $src -> $dst" }
}

foreach ($d in @("dist\evidence", "dist\evidence\cm", "dist\prep", "dist\manifests", "dist\release\portable")) {
  New-Item -ItemType Directory -Force -Path (Join-Path $GitRoot $d) | Out-Null
}

Write-Host "== 1/7 sync apps -> bin =="
& (Join-Path $GitRoot "scripts\ops\sync-apps-to-bin.ps1")

Write-Host "== 2/7 embeddable Python =="
if (-not $SkipVendorRuntime -and -not (Test-Path -LiteralPath $RuntimePyw)) {
  & (Join-Path $GitRoot "scripts\ops\vendor-runtime-win.ps1")
}
if (-not (Test-Path -LiteralPath $RuntimePyw)) { throw "Brak $RuntimePyw" }

Write-Host "== 3/7 engine onedir dam-appw =="
& (Join-Path $GitRoot "scripts\ops\build-engine-onedir.ps1")

Write-Host "== 4/7 Go bootstrap DAM.exe =="
$env:CGO_ENABLED = "0"
$env:GOOS = "windows"
$env:GOARCH = "amd64"
$outExe = Join-Path $GitRoot "DAM.exe"
Push-Location (Join-Path $GitRoot "apps\desktop\bootstrap")
try {
  & $GoExe build -ldflags="-H windowsgui -s -w" -o $outExe .
  if ($LASTEXITCODE -ne 0) { throw "go build exit $LASTEXITCODE" }
} finally { Pop-Location }

Write-Host "== 5/7 stage dist/staging/DAM =="
# Zasada 0: bez kasowania rekurencyjnego - poprzedni staging tylko przemianowany.
if (Test-Path -LiteralPath $Staging) {
  Rename-Item -LiteralPath $Staging -NewName ((Split-Path $Staging -Leaf) + ".old-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
}
New-Item -ItemType Directory -Force -Path $Staging | Out-Null
Copy-Item -LiteralPath $outExe -Destination $Staging -Force
foreach ($name in @("README.txt", "DAM.cmd")) {
  $p = Join-Path $GitRoot $name
  if (Test-Path -LiteralPath $p) { Copy-Item -LiteralPath $p -Destination $Staging -Force }
}

$binDst = Join-Path $Staging "bin"
New-Item -ItemType Directory -Force -Path $binDst | Out-Null
$xdCommon = @(
  "__pycache__", ".venv", "node_modules", "webview2-profile", "logs", "_qa",
  "vendor", "framework", "bootstrap", "thumbs", "_invoice_mail_stage", "tooling"
)
$xfCommon = @(
  "*.pyc", "*.bak*", "*backup*", "*Conflict*", "*.drifted*", "*.pre-*",
  "index-watcher.log", "audit-log.jsonl", "branding-index.json"
)

Invoke-Robocopy (Join-Path $BinRoot "runtime") (Join-Path $binDst "runtime") $xdCommon $xfCommon
Invoke-Robocopy (Join-Path $BinRoot "THEME") (Join-Path $binDst "THEME") @("__pycache__", "documentation") @("*.zip", "*.map")
$appsXd = $xdCommon + @("api")
Invoke-Robocopy (Join-Path $BinRoot "apps") (Join-Path $binDst "apps") $appsXd $xfCommon

Write-Host "== 6/7 manifests + secret scan =="
$manifestDir = Join-Path $GitRoot "dist\manifests"
$hashFile = Join-Path $manifestDir "portable-sha256.json"
$files = Get-ChildItem -LiteralPath $Staging -Recurse -File
$manifest = [ordered]@{
  generated_at_utc = (Get-Date).ToUniversalTime().ToString("o")
  root = "DAM"
  bootstrap = "go"
  files = @()
}
foreach ($f in $files) {
  $rel = $f.FullName.Substring($Staging.Length).TrimStart('\').Replace('\', '/')
  $hash = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLower()
  $manifest.files += [ordered]@{ path = $rel; sha256 = $hash; bytes = $f.Length }
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $hashFile -Encoding utf8
& (Join-Path $GitRoot "scripts\qa\secret-scan.ps1") -SourcePath $Staging
& (Join-Path $GitRoot "scripts\qa\validate-cm-ids.ps1") | Out-Null
python (Join-Path $GitRoot "scripts\qa\test-ipc-names-contract.py")

Write-Host "== 7/7 zip =="
$ver = "portable"
try {
  $vj = Get-Content (Join-Path $GitRoot "apps\web\version.json") -Raw | ConvertFrom-Json
  if ($vj.version) { $ver = $vj.version }
} catch {}
$zipPath = Join-Path $ReleaseDir ("DAM-portable-{0}-{1}.zip" -f $ver, (Get-Date -Format "yyyyMMdd-HHmm"))
if (-not $SkipZip) {
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory($Staging, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
  Copy-Item -LiteralPath $zipPath -Destination (Join-Path $ReleaseDir "DAM-portable.zip") -Force
}

$rtSize = (Get-ChildItem (Join-Path $Staging "bin\runtime\win\python") -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
$evidence = Join-Path $GitRoot "dist\evidence\portable-build.log"
@(
  "built_at=$(Get-Date -Format o)",
  "zip=$zipPath",
  "runtime_mb=$([math]::Round($rtSize/1MB,1))",
  "stage=$Staging",
  "dam_exe_bytes=$((Get-Item (Join-Path $Staging 'DAM.exe')).Length)",
  "bootstrap=go"
) | Set-Content -LiteralPath $evidence -Encoding utf8

Write-Host ("OK zip={0} runtime_mb={1:N1}" -f $zipPath, ($rtSize/1MB))
exit 0

