$ErrorActionPreference = "Stop"
$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$env:PYTHONUTF8 = "1"
$Desktop = Join-Path $GitRoot "bin\apps\desktop"
if (-not (Test-Path $Desktop)) { throw "Brak $Desktop" }
Set-Location $Desktop
$pyw = Join-Path $GitRoot "bin\runtime\win\python\pythonw.exe"
if (Test-Path $pyw) {
  & $pyw launch.py
} else {
  pythonw launch.py
  if ($LASTEXITCODE -ne 0) { python launch.py }
}
