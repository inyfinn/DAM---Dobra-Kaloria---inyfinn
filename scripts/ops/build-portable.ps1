#Requires -Version 5.1
<#
.SYNOPSIS
  Portable DAM: sync apps, vendor embeddable Python, PyInstaller DAM.exe, stage, zip.
.NOTES
  bin/runtime/win/python is vendored on the BUILD machine (not in git).
  Output: dist/release/portable/DAM-portable.zip
#>
$ErrorActionPreference = "Stop"

$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$BinRoot = Join-Path $GitRoot "bin"
$RuntimePyw = Join-Path $BinRoot "runtime\win\python\pythonw.exe"
$Staging = Join-Path $GitRoot "dist\staging\DAM"
$ReleaseDir = Join-Path $GitRoot "dist\release\portable"
$ZipPath = Join-Path $ReleaseDir "DAM-portable.zip"

function Invoke-Robocopy([string]$src, [string]$dst, [string[]]$xd, [string[]]$xf) {
  if (-not (Test-Path -LiteralPath $src)) { throw "Missing source: $src" }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  $rcArgs = @($src, $dst, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np")
  if ($xd -and $xd.Count) { $rcArgs += "/XD"; $rcArgs += $xd }
  if ($xf -and $xf.Count) { $rcArgs += "/XF"; $rcArgs += $xf }
  & robocopy @rcArgs
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE): $src -> $dst" }
}

Write-Host "== sync apps -> bin =="
& (Join-Path $GitRoot "scripts\ops\sync-apps-to-bin.ps1")

Write-Host "== ensure embeddable Python =="
if (-not (Test-Path -LiteralPath $RuntimePyw)) {
  & (Join-Path $GitRoot "scripts\ops\vendor-runtime-win.ps1")
}
if (-not (Test-Path -LiteralPath $RuntimePyw)) {
  throw "Brak $RuntimePyw po vendor-runtime-win.ps1"
}

Write-Host "== PyInstaller DAM.exe =="
$spec = Join-Path $GitRoot "DAM.spec"
if (-not (Test-Path -LiteralPath $spec)) { throw "Brak DAM.spec w GIT_ROOT" }
Push-Location $GitRoot
try {
  & py -3.12 -m PyInstaller $spec --noconfirm --clean
  if ($LASTEXITCODE -ne 0) { throw "PyInstaller exit $LASTEXITCODE" }
  Copy-Item -LiteralPath (Join-Path $GitRoot "dist\DAM.exe") -Destination (Join-Path $GitRoot "DAM.exe") -Force
} finally {
  Pop-Location
}

Write-Host "== stage dist/staging/DAM =="
if (Test-Path -LiteralPath $Staging) { Remove-Item -LiteralPath $Staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Staging | Out-Null
Copy-Item -LiteralPath (Join-Path $GitRoot "DAM.exe") -Destination $Staging -Force
foreach ($name in @("README.txt", "DAM.cmd")) {
  $p = Join-Path $GitRoot $name
  if (Test-Path -LiteralPath $p) { Copy-Item -LiteralPath $p -Destination $Staging -Force }
}

$binDst = Join-Path $Staging "bin"
New-Item -ItemType Directory -Force -Path $binDst | Out-Null

$xdCommon = @(
  "__pycache__", ".venv", "node_modules", "webview2-profile", "logs", "_qa",
  "vendor", "framework", "bootstrap", "thumbs", "_invoice_mail_stage", "tooling", "dam-app"
)
$xfCommon = @(
  "*.pyc", "*.bak*", "*backup*", "*Conflict*", "*.drifted*", "*.pre-*",
  "index-watcher.log", "audit-log.jsonl", "branding-index.json"
)

Write-Host "  copy bin/runtime"
Invoke-Robocopy (Join-Path $BinRoot "runtime") (Join-Path $binDst "runtime") $xdCommon $xfCommon

Write-Host "  copy bin/THEME"
Invoke-Robocopy (Join-Path $BinRoot "THEME") (Join-Path $binDst "THEME") @("__pycache__", "documentation") @("*.zip", "*.map")

Write-Host "  copy bin/apps"
Invoke-Robocopy (Join-Path $BinRoot "apps") (Join-Path $binDst "apps") $xdCommon $xfCommon

Write-Host "== zip =="
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($Staging, $ZipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$zip = Get-Item -LiteralPath $ZipPath
$stagingSize = (Get-ChildItem -LiteralPath $Staging -Recurse -File | Measure-Object -Property Length -Sum).Sum
Write-Host ("OK zip={0} size_mb={1:N1} staging_mb={2:N1}" -f $zip.FullName, ($zip.Length / 1MB), ($stagingSize / 1MB))
