#Requires -Version 5.1
<#
  Seed PAMIEC-PODRECZNA AFTER Inno install — never inside solid Setup.exe.
  Inno + 12k AVIF in SolidCompression caused "Plik zrodlowy jest uszkodzony"
  and Skip-file is useless on solid blocks.

  Kanon (prawdziwe dane): M:\- POLSKA\...\bin\PAMIEC-PODRECZNA
  Exit always 0 — brak M: / blad kopiowania nie wywala instalacji.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Dest,
  [switch]$Quiet
)

$ErrorActionPreference = "Continue"

function Write-Info([string]$Msg) {
  if (-not $Quiet) { Write-Host $Msg }
}

$canon = "M:\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\bin\PAMIEC-PODRECZNA"
$srcThumbs = Join-Path $canon "thumbs"

try {
  New-Item -ItemType Directory -Force -Path (Join-Path $Dest "thumbs") | Out-Null
} catch {}

if (-not (Test-Path -LiteralPath $srcThumbs)) {
  Write-Info "Brak kanonu PAMIEC na M: ($srcThumbs) — pominieto seed. Uzyj sync z Synology."
  exit 0
}

$n = (Get-ChildItem -LiteralPath $srcThumbs -File -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Info "Seed PAMIEC z M: ($n plikow) -> $Dest"
$dstThumbs = Join-Path $Dest "thumbs"
New-Item -ItemType Directory -Force -Path $dstThumbs | Out-Null

# Robocopy: kontynuuj mimo bledow pojedynczych plikow (/R:1 /W:1), bez junctionow.
& robocopy $canon $Dest /E /XO /R:1 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np /XJ /XJD /XF "*.tmp" "*.lock" | Out-Null
$rc = $LASTEXITCODE
# robocopy 0-7 = success-ish
Write-Info "Seed PAMIEC robocopy exit=$rc (0-7 = OK)"
exit 0
