#Requires -Version 5.1
<#
.SYNOPSIS
  Podpis Authenticode (Windows) dla DAM.exe i DAM-Setup.exe.

.DESCRIPTION
  Ostrzezenie Windows "nieznany wydawca" / SmartScreen NIE jest podpisem sterownika.
  To brak podpisu Authenticode na EXE, ktore user klika.

  Ten skrypt NIE kupuje certyfikatu. Bez PFX / certu OV-EV w magazynie
  Windows nadal pokaze nieznane zrodlo. Apple/macOS: DAM nie ma .app —
  Gatekeeper na Macu wymaga osobnego Developer ID + notarization (osobny produkt).

  Zmienne (jedna sciezka):
    DAM_CODE_SIGN_PFX          - sciezka do .pfx (nie commituj)
    DAM_CODE_SIGN_PASSWORD     - haslo PFX
    DAM_CODE_SIGN_THUMBPRINT - odcisk z Cert:\CurrentUser\My lub LocalMachine\My
    DAM_CODE_SIGN_TIMESTAMP  - URL znacznika czasu (domyslnie DigiCert)

  Exit 0 = podpisano albo swiadomie pominieto (brak certu, -SkipWhenMissing).
  Exit 2 = miano podpisac, ale signtool/cert padl.
#>
param(
  [string[]]$Path,
  [switch]$SkipWhenMissing
)

$ErrorActionPreference = "Stop"

function Find-SignTool {
  $cmd = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $roots = @(
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin",
    "${env:ProgramFiles}\Windows Kits\10\bin"
  )
  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    $hit = Get-ChildItem -LiteralPath $root -Recurse -Filter "signtool.exe" -ErrorAction SilentlyContinue |
      Where-Object { $_.DirectoryName -match '\\x64$' } |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  return $null
}

function Test-AuthenticodeOk([string]$Exe) {
  if (-not (Test-Path -LiteralPath $Exe)) { return $false }
  $sig = Get-AuthenticodeSignature -LiteralPath $Exe
  return ($sig.Status -eq "Valid")
}

function Invoke-SignOne([string]$Exe, [string]$Tool) {
  $ts = $env:DAM_CODE_SIGN_TIMESTAMP
  if (-not $ts) { $ts = "http://timestamp.digicert.com" }
  $args = @("sign", "/fd", "SHA256", "/td", "SHA256", "/tr", $ts, "/v")
  if ($env:DAM_CODE_SIGN_PFX) {
    if (-not (Test-Path -LiteralPath $env:DAM_CODE_SIGN_PFX)) {
      throw "DAM_CODE_SIGN_PFX nie istnieje: $($env:DAM_CODE_SIGN_PFX)"
    }
    $args += @("/f", $env:DAM_CODE_SIGN_PFX)
    if ($env:DAM_CODE_SIGN_PASSWORD) {
      $args += @("/p", $env:DAM_CODE_SIGN_PASSWORD)
    }
  } elseif ($env:DAM_CODE_SIGN_THUMBPRINT) {
    $args += @("/sha1", $env:DAM_CODE_SIGN_THUMBPRINT)
  } else {
    throw "Brak DAM_CODE_SIGN_PFX i DAM_CODE_SIGN_THUMBPRINT"
  }
  $args += $Exe
  & $Tool @args
  if ($LASTEXITCODE -ne 0) { throw "signtool exit $LASTEXITCODE for $Exe" }
  if (-not (Test-AuthenticodeOk $Exe)) {
    throw "Podpis niewazny po signtool: $Exe status=$((Get-AuthenticodeSignature -LiteralPath $Exe).Status)"
  }
}

$tool = Find-SignTool
$hasCred = [bool]($env:DAM_CODE_SIGN_PFX -or $env:DAM_CODE_SIGN_THUMBPRINT)

if (-not $Path -or $Path.Count -eq 0) {
  Write-Host "sign-dam-binaries: brak -Path"
  exit 0
}

$missing = @()
foreach ($p in $Path) {
  if (-not (Test-Path -LiteralPath $p)) { $missing += $p }
}
if ($missing.Count -gt 0) {
  Write-Warning ("Brak plikow do podpisu: {0}" -f ($missing -join ", "))
}

$targets = @($Path | Where-Object { Test-Path -LiteralPath $_ })
if ($targets.Count -eq 0) {
  Write-Warning "sign-dam-binaries: nic do podpisu"
  exit 0
}

if (-not $hasCred) {
  $msg = "Brak certyfikatu Authenticode (DAM_CODE_SIGN_PFX lub DAM_CODE_SIGN_THUMBPRINT). Windows nadal pokaze 'nieznany wydawca'. To NIE jest podpis sterownika. Instrukcja: bin/installer/CODE-SIGNING.md"
  if ($SkipWhenMissing) {
    Write-Warning $msg
    foreach ($t in $targets) {
      $st = Get-AuthenticodeSignature -LiteralPath $t
      Write-Host ("  {0}  Authenticode={1}  Signer={2}" -f $t, $st.Status, $(if ($st.SignerCertificate) { $st.SignerCertificate.Subject } else { "(none)" }))
    }
    exit 0
  }
  throw $msg
}

if (-not $tool) {
  $msg = "Brak signtool.exe (zainstaluj Windows SDK - Signing Tools). https://developer.microsoft.com/windows/downloads/windows-sdk/"
  if ($SkipWhenMissing) {
    Write-Warning $msg
    exit 0
  }
  throw $msg
}

Write-Host "signtool=$tool"
foreach ($t in $targets) {
  if (Test-AuthenticodeOk $t) {
    Write-Host "Juz podpisany (Valid): $t"
    continue
  }
  Invoke-SignOne $t $tool
  Write-Host "OK signed $t"
}
exit 0
