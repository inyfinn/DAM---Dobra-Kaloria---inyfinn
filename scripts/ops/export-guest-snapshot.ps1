# Eksport snapshotu dla trybu goscia (Panel-DAM / przegladarka bez mostu).
# Usage: powershell -File scripts/ops/export-guest-snapshot.ps1 [-Dest W:\web\Panel-DAM\data] [-SkipThumbBuild]

param(
  [string]$Dest = "",
  [switch]$SkipThumbBuild
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$OutDir = if ($Dest) { $Dest } else { Join-Path $Root "apps\web\data" }

$pyScript = Join-Path $Root "apps\desktop\scripts\export_guest_snapshot.py"
if (-not (Test-Path -LiteralPath $pyScript)) {
  throw "Brak: $pyScript"
}

Write-Host "Eksport guest snapshot -> $OutDir"
$args = @($pyScript, "--dest", $OutDir)
if ($SkipThumbBuild) { $args += "--skip-thumb-build" }
& python @args
if ($LASTEXITCODE -ne 0) { throw "export_guest_snapshot.py failed ($LASTEXITCODE)" }
Write-Host "OK: guest-snapshot.json + manifest + digest thumbs"
