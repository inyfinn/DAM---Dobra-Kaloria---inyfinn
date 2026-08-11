$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$env:PYTHONUTF8 = "1"
Set-Location (Join-Path $RepoRoot "apps\desktop")
pythonw launch.py
if ($LASTEXITCODE -ne 0) {
  python launch.py
}
