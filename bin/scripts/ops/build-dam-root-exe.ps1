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

if (-not $SkipEngine) {
  & (Join-Path $PSScriptRoot "build-engine-onedir.ps1")
}

$GoExe = Join-Path $BinRoot "tooling\go\bin\go.exe"
if (-not (Test-Path -LiteralPath $GoExe)) { $GoExe = "go" }

$env:CGO_ENABLED = "0"
$env:GOOS = "windows"
$env:GOARCH = "amd64"

$outExe = Join-Path $GitRoot "DAM.exe"
$bootstrapDir = Join-Path $BinRoot "apps\desktop\bootstrap"
if (-not (Test-Path -LiteralPath $bootstrapDir)) {
  throw "Brak $bootstrapDir"
}

Push-Location $bootstrapDir
try {
  & $GoExe build -ldflags="-H windowsgui -s -w" -o $outExe .
  if ($LASTEXITCODE -ne 0) { throw "go build exit $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host "OK DAM.exe -> $outExe"
