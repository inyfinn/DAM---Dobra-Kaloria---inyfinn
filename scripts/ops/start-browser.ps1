param(
  [switch]$DevAuth
)

$ErrorActionPreference = "Stop"
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$serve = Join-Path $repo "apps\desktop\serve_browser.py"
if (-not (Test-Path $serve)) {
  Write-Error "Brak serve_browser.py: $serve"
}
if ($DevAuth) {
  $env:DAM_LOCAL_DEV_AUTH = "1"
  Write-Host "DAM_LOCAL_DEV_AUTH=1 (stub admin na 127.0.0.1, ADR-006)"
}
Write-Host "DAM browser mode: UI :8765 + bridge :8766"
Write-Host "Ctrl+C aby zatrzymac."
Set-Location (Join-Path $repo "apps\desktop")
python $serve
