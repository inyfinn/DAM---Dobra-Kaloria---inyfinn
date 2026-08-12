# Sync apps/ (git source) -> bin/ (CONTENT_ROOT for DAM.exe).
# Run from GIT_ROOT after git pull.
$ErrorActionPreference = 'Stop'
$gitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$src = Join-Path $gitRoot 'apps'
$dst = Join-Path $gitRoot 'bin\apps'
if (-not (Test-Path $src)) { throw "Missing $src" }
New-Item -ItemType Directory -Force -Path $dst | Out-Null
robocopy $src $dst /MIR /XD node_modules .venv __pycache__ _qa webview2-profile /NFL /NDL /NJH /NJS /nc /ns /np
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit $LASTEXITCODE" }
Write-Host "OK: synced apps -> bin/apps (exit $LASTEXITCODE)"

