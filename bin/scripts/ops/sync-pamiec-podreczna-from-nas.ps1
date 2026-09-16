#Requires -Version 5.1
<#
.SYNOPSIS
  Opcjonalne odswiezenie PAMIEC-PODRECZNA z Synology po instalacji.
  Domyslnie instalator JUŻ ma cache w paczce — ten skrypt jest tylko przy tasku cachesync.
#>
param(
  [switch]$Quiet
)

$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$binRoot = (Resolve-Path (Join-Path $here "..\..")).Path
$dest = Join-Path $binRoot "PAMIEC-PODRECZNA"
$manifestUrl = "https://inyfinn.synology.me/Panel-DAM/bin/PAMIEC-PODRECZNA/manifest.json"

function Write-Info([string]$m) {
  if (-not $Quiet) { Write-Host $m }
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
try {
  $tmp = Join-Path $env:TEMP ("dam-cache-manifest-" + [guid]::NewGuid().ToString("n") + ".json")
  Invoke-WebRequest -Uri $manifestUrl -OutFile $tmp -UseBasicParsing -TimeoutSec 30
  Copy-Item -LiteralPath $tmp -Destination (Join-Path $dest "manifest.json") -Force
  Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  Write-Info "manifest OK — dalsze delty robi most DAM (/thumb-cache/sync)."
} catch {
  Write-Info "Sync pominięty/niedostępny: $($_.Exception.Message)"
  exit 0
}
exit 0
