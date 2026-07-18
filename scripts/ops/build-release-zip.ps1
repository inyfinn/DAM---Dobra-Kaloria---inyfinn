# Build DAM ETA release ZIP (bez .git, thumbs, sqlite, venv).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/ops/build-release-zip.ps1 [-Version 2026.07.18]
param(
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

if (-not $Version) {
  $Version = (Get-Date -Format "yyyy.MM.dd")
  try {
    $sha = (git rev-parse --short HEAD 2>$null)
    if ($sha) { $Version = "$Version-$sha" }
  } catch {}
}

$Dist = Join-Path $Root "dist"
New-Item -ItemType Directory -Force -Path $Dist | Out-Null
$Staging = Join-Path $Dist ("DAM-ETA-" + $Version)
$ZipPath = Join-Path $Dist ("DAM-ETA-" + $Version + ".zip")

if (Test-Path $Staging) { Remove-Item -Recurse -Force $Staging }
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
New-Item -ItemType Directory -Force -Path $Staging | Out-Null

$ExcludeDirNames = @(
  ".git", ".cursor", "node_modules", ".venv", "venv",
  "__pycache__", "tooling", "data", "dist", "ui-complete",
  "Marketing"
)
$ExcludeFileGlobs = @(
  "*.sqlite", "*.sqlite-*", ".env", ".env.*",
  "machine-config.json", "bound-session.json",
  "dam-runtime.json", "dam-identity.json", "audit-log.jsonl"
)

function ShouldSkipDir([string]$name) {
  return $ExcludeDirNames -contains $name
}

function Copy-Tree($src, $dst) {
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Get-ChildItem -Force -LiteralPath $src | ForEach-Object {
    if ($_.PSIsContainer) {
      if (ShouldSkipDir $_.Name) { return }
      if ($_.Name -eq "thumbs" -and $src -match "apps[\\/]web[\\/]data$") { return }
      Copy-Tree $_.FullName (Join-Path $dst $_.Name)
    } else {
      $skip = $false
      foreach ($g in $ExcludeFileGlobs) {
        if ($_.Name -like $g) { $skip = $true; break }
      }
      if ($skip) { return }
      Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dst $_.Name) -Force
    }
  }
}

Write-Host "Staging -> $Staging"
Copy-Tree $Root $Staging

# Placeholders
$keepDirs = @(
  (Join-Path $Staging "apps\desktop\data"),
  (Join-Path $Staging "apps\web\data\thumbs")
)
foreach ($d in $keepDirs) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  Set-Content -Path (Join-Path $d ".gitkeep") -Value "" -Encoding UTF8
}

# Version stamp
@"
{
  "app": "DAM ETA",
  "version": "$Version",
  "built_at": "$(Get-Date -Format o)"
}
"@ | Set-Content -Path (Join-Path $Staging "VERSION.json") -Encoding UTF8

Compress-Archive -Path (Join-Path $Staging "*") -DestinationPath $ZipPath -Force
Write-Host "OK $ZipPath"
Write-Host ("Size MB: {0:N1}" -f ((Get-Item $ZipPath).Length / 1MB))
