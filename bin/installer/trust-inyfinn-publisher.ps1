#Requires -Version 5.1
# Instalacja: zaufaj wydawcy Inyfinn (publiczny .cer, bez klucza prywatnego).
# Per-user, bez admina. Nie wklada certu do LocalMachine\Root.
$ErrorActionPreference = "Stop"
$cer = Join-Path $PSScriptRoot "inyfinn-dam-codesign.cer"
if (-not (Test-Path -LiteralPath $cer)) {
  Write-Host "Brak $cer - pomijam zaufanie wydawcy."
  exit 0
}
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $cer
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPublisher", "CurrentUser")
$store.Open("ReadWrite")
try { $store.Add($cert) } finally { $store.Close() }
$app = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$exe = Join-Path $app "DAM.exe"
if (Test-Path -LiteralPath $exe) {
  Unblock-File -LiteralPath $exe -ErrorAction SilentlyContinue
}
Write-Host "Zaufany wydawca Inyfinn (TrustedPublisher, ten uzytkownik)."
exit 0
