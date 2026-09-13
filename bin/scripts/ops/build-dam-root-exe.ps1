#Requires -Version 5.1
<#
.SYNOPSIS
  Buduje DAM.exe (Go bootstrap) + opcjonalnie silnik PyInstaller (dam-appw).
#>
param(
  [switch]$SkipEngine
)

$ErrorActionPreference = "Stop"

$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$BinRoot = Join-Path $GitRoot "bin"

$engineExe = Join-Path $BinRoot "runtime\win\dam-app\dam-appw.exe"
if (-not $SkipEngine -and (Test-Path -LiteralPath $engineExe)) {
  Write-Host "Skip engine (dam-appw.exe juz jest)."
  $SkipEngine = $true
}
if (-not $SkipEngine) {
  & (Join-Path $PSScriptRoot "build-engine-onedir.ps1")
}

$GoExe = Join-Path $BinRoot "tooling\go\bin\go.exe"
if (-not (Test-Path -LiteralPath $GoExe)) { $GoExe = "go" }

$env:CGO_ENABLED = "0"
$env:GOOS = "windows"
$env:GOARCH = "amd64"

# X:/OneDrive: DAM.exe bywa placeholderem (attrib A O P) - build na lokalny dysk, potem kopia.
$outLocalDir = Join-Path $env:LOCALAPPDATA "DAM\build"
New-Item -ItemType Directory -Force -Path $outLocalDir | Out-Null
$outLocal = Join-Path $outLocalDir "DAM.exe"
$outExe = Join-Path $GitRoot "DAM.exe"
$bootstrapDir = Join-Path $BinRoot "apps\desktop\bootstrap"
if (-not (Test-Path -LiteralPath $bootstrapDir)) {
  throw "Brak $bootstrapDir"
}

Push-Location $bootstrapDir
try {
  & $GoExe build -ldflags="-H windowsgui -s -w" -o $outLocal .
  if ($LASTEXITCODE -ne 0) { throw "go build exit $LASTEXITCODE" }
} finally {
  Pop-Location
}
if (-not (Test-Path -LiteralPath $outLocal) -or ((Get-Item -LiteralPath $outLocal).Length -lt 100000)) {
  throw "go build nie dal czytelnego $outLocal"
}

function Test-ExeReadable([string]$Path) {
  try {
    $fs = [System.IO.File]::Open($Path, "Open", "Read", "ReadWrite")
    $buf = New-Object byte[] 64
    $n = $fs.Read($buf, 0, 64)
    $fs.Close()
    return ($n -gt 1 -and $buf[0] -eq 0x4D -and $buf[1] -eq 0x5A)
  } catch {
    return $false
  }
}

if (Test-Path -LiteralPath $outExe) {
  cmd /c "attrib -O -P -U `"$outExe`"" | Out-Null
  Remove-Item -LiteralPath $outExe -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $outExe) {
    cmd /c "del /f /q `"$outExe`"" | Out-Null
  }
}
Copy-Item -LiteralPath $outLocal -Destination $outExe -Force
if (-not (Test-ExeReadable $outExe)) {
  Write-Warning "GIT_ROOT DAM.exe nadal nieczytelny (chmura). Zostawiam kopie lokalna: $outLocal"
  Copy-Item -LiteralPath $outLocal -Destination $outExe -Force -ErrorAction SilentlyContinue
  if (-not (Test-ExeReadable $outExe)) {
    throw "Nie da sie zapisac czytelnego DAM.exe do GIT_ROOT. Lokalny build: $outLocal"
  }
}

Write-Host "OK DAM.exe -> $outExe ($((Get-Item -LiteralPath $outExe).Length) B, local $outLocal)"
$signScript = Join-Path $PSScriptRoot "sign-dam-binaries.ps1"
if (Test-Path -LiteralPath $signScript) {
  & $signScript -Path @($outExe, $outLocal) -SkipWhenMissing
}
