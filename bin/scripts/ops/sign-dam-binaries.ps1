#Requires -Version 5.1
<#
.SYNOPSIS
  Podpis Authenticode (Windows) dla DAM.exe i DAM-Setup.exe.

.DESCRIPTION
  SmartScreen "Nieznany wydawca" = brak zaufanego podpisu Authenticode.
  Ten skrypt:
    1) Uzywa DAM_CODE_SIGN_PFX / DAM_CODE_SIGN_THUMBPRINT gdy sa (cert OV/EV z CA).
    2) Inaczej tworzy/uzywa certu CurrentUser "Inyfinn DAM code signing"
       (CN=Inyfinn, O=Inyfinn). To NIE jest Photo Resizer.
    3) Podpisuje SHA256 + timestamp DigiCert.
    4) Eksportuje publiczny .cer (bez klucza) do bin/installer/.

  Self-signed NIE kasuje SmartScreen przy pliku z internetu (MOTW + GitHub).
  Zeby zielona plansza zniknela u obcych: kup Code Signing OV/EV (Certum/DigiCert)
  i ustaw DAM_CODE_SIGN_PFX. Ten podpis i tak zmienia wydawce z "Nieznany"
  na "Inyfinn" w Wlasciwosci pliku i po zaufaniu lokalnym.

  Exit 0 = podpisano. Exit 2 = blad.
#>
param(
  [string[]]$Path,
  [switch]$SkipWhenMissing
)

$ErrorActionPreference = "Stop"

$DamSubject = "CN=Inyfinn, O=Inyfinn, C=PL"
$DamFriendly = "Inyfinn DAM code signing"
$TsDefault = "http://timestamp.digicert.com"

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

function Get-ContentRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Export-PublicCer([System.Security.Cryptography.X509Certificates.X509Certificate2]$Cert) {
  $cerPath = Join-Path (Get-ContentRoot) "installer\inyfinn-dam-codesign.cer"
  New-Item -ItemType Directory -Force -Path (Split-Path $cerPath) | Out-Null
  $bytes = $Cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
  [System.IO.File]::WriteAllBytes($cerPath, $bytes)
  Write-Host "Public CER: $cerPath"
  return $cerPath
}

function Add-CertToStore([System.Security.Cryptography.X509Certificates.X509Certificate2]$Cert, [string]$StoreName) {
  $pub = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 @(, $Cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
  $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($StoreName, "CurrentUser")
  $store.Open("ReadWrite")
  try { $store.Add($pub) } finally { $store.Close() }
}

function Find-DamCert {
  $store = Get-ChildItem Cert:\CurrentUser\My -ErrorAction SilentlyContinue
  $hit = $store | Where-Object {
    $_.HasPrivateKey -and
    $_.FriendlyName -eq $DamFriendly -and
    $_.NotAfter -gt (Get-Date) -and
    ($_.EnhancedKeyUsageList.FriendlyName -match "Code Signing|Podpisywanie kodu")
  } | Select-Object -First 1
  if ($hit) { return $hit }
  return $store | Where-Object {
    $_.HasPrivateKey -and
    $_.Subject -eq $DamSubject -and
    $_.NotAfter -gt (Get-Date)
  } | Select-Object -First 1
}

function Ensure-DamCert {
  if ($env:DAM_CODE_SIGN_PFX) {
    if (-not (Test-Path -LiteralPath $env:DAM_CODE_SIGN_PFX)) {
      throw "DAM_CODE_SIGN_PFX nie istnieje: $($env:DAM_CODE_SIGN_PFX)"
    }
    $pwd = $null
    if ($env:DAM_CODE_SIGN_PASSWORD) {
      $pwd = ConvertTo-SecureString $env:DAM_CODE_SIGN_PASSWORD -AsPlainText -Force
    }
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
    if ($pwd) {
      $cert.Import($env:DAM_CODE_SIGN_PFX, $pwd, "Exportable,PersistKeySet")
    } else {
      $cert.Import($env:DAM_CODE_SIGN_PFX)
    }
    return $cert
  }
  if ($env:DAM_CODE_SIGN_THUMBPRINT) {
    $tp = $env:DAM_CODE_SIGN_THUMBPRINT.Replace(" ", "")
    $cert = Get-Item "Cert:\CurrentUser\My\$tp" -ErrorAction SilentlyContinue
    if (-not $cert) { $cert = Get-Item "Cert:\LocalMachine\My\$tp" -ErrorAction SilentlyContinue }
    if (-not $cert) { throw "Brak certu DAM_CODE_SIGN_THUMBPRINT=$tp" }
    return $cert
  }
  $existing = Find-DamCert
  if ($existing) { return $existing }
  Write-Host "Tworze cert Authenticode: $DamSubject"
  $cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $DamSubject `
    -FriendlyName $DamFriendly `
    -KeyExportPolicy Exportable `
    -KeyLength 4096 `
    -HashAlgorithm SHA256 `
    -CertStoreLocation Cert:\CurrentUser\My `
    -NotAfter (Get-Date).AddYears(5) `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3")
  if (-not $cert) { throw "New-SelfSignedCertificate nie zwrocil certu DAM." }
  return $cert
}

function Test-SignaturePresent([string]$Exe) {
  if (-not (Test-Path -LiteralPath $Exe)) { return $false }
  $sig = Get-AuthenticodeSignature -LiteralPath $Exe
  if ($sig.Status -eq "NotSigned") { return $false }
  if ($sig.Status -eq "HashMismatch") { return $false }
  return [bool]$sig.SignerCertificate
}

function Invoke-SignOne([string]$Exe, $Cert, [string]$Tool) {
  $ts = $env:DAM_CODE_SIGN_TIMESTAMP
  if (-not $ts) { $ts = $TsDefault }
  if ($Tool) {
    $args = @("sign", "/fd", "SHA256", "/td", "SHA256", "/tr", $ts, "/v")
    if ($env:DAM_CODE_SIGN_PFX) {
      $args += @("/f", $env:DAM_CODE_SIGN_PFX)
      if ($env:DAM_CODE_SIGN_PASSWORD) { $args += @("/p", $env:DAM_CODE_SIGN_PASSWORD) }
    } else {
      $args += @("/sha1", $Cert.Thumbprint)
    }
    $args += $Exe
    & $Tool @args
    if ($LASTEXITCODE -ne 0) { throw "signtool exit $LASTEXITCODE for $Exe" }
  } else {
    $r = Set-AuthenticodeSignature -FilePath $Exe -Certificate $Cert -HashAlgorithm SHA256 -TimestampServer $ts
    if ($r.Status -eq "NotSigned" -or $r.Status -eq "HashMismatch") {
      throw "Set-AuthenticodeSignature status=$($r.Status) for $Exe"
    }
  }
  if (-not (Test-SignaturePresent $Exe)) {
    throw "Brak podpisu po sign: $Exe"
  }
  $st = Get-AuthenticodeSignature -LiteralPath $Exe
  Write-Host ("  signed {0}  Status={1}  Subject={2}" -f $Exe, $st.Status, $st.SignerCertificate.Subject)
}

if (-not $Path -or $Path.Count -eq 0) {
  Write-Host "sign-dam-binaries: brak -Path"
  exit 0
}

$targets = @($Path | Where-Object { Test-Path -LiteralPath $_ })
if ($targets.Count -eq 0) {
  Write-Warning ("Brak plikow do podpisu: {0}" -f ($Path -join ", "))
  if ($SkipWhenMissing) { exit 0 }
  throw "Nic do podpisu."
}

try {
  $cert = Ensure-DamCert
} catch {
  if ($SkipWhenMissing) {
    Write-Warning $_.Exception.Message
    exit 0
  }
  throw
}

Add-CertToStore $cert "TrustedPublisher"
Export-PublicCer $cert | Out-Null

$tool = Find-SignTool
if ($tool) { Write-Host "signtool=$tool" } else { Write-Host "Brak signtool.exe - uzywam Set-AuthenticodeSignature." }
Write-Host ("cert={0} thumb={1}" -f $cert.Subject, $cert.Thumbprint)

foreach ($t in $targets) {
  Invoke-SignOne $t $cert $tool
}
exit 0
