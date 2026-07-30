# Buduje paczke instalatora DAM do pobrania z Panel-DAM.
# Output: dist/DAM-DobraKaloria-Windows-Setup.zip

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Dist = Join-Path $Root "dist"
$Staging = Join-Path $Dist "dam-installer-staging"
$ZipName = "DAM-DobraKaloria-Windows-Setup.zip"
$ZipPath = Join-Path $Dist $ZipName

if (Test-Path $Staging) { Remove-Item -Recurse -Force $Staging }
New-Item -ItemType Directory -Force -Path $Staging | Out-Null
New-Item -ItemType Directory -Force -Path $Dist | Out-Null

# Instalator + skroty bootstrap
Copy-Item -Recurse -Force (Join-Path $Root "apps\desktop\installer\*") $Staging
Copy-Item -Recurse -Force (Join-Path $Root "apps\desktop\run-dam.vbs") (Join-Path $Staging "run-dam.vbs")
Copy-Item -Recurse -Force (Join-Path $Root "apps\desktop\open-dam-browser.vbs") (Join-Path $Staging "open-dam-browser.vbs") -ErrorAction SilentlyContinue

# Payload (slim) - apps tylko (bez webview2-profile / locked files)
$appsStaging = Join-Path $Staging "payload\apps"
New-Item -ItemType Directory -Force -Path $appsStaging | Out-Null
Copy-Item -Recurse -Force (Join-Path $Root "apps\web") (Join-Path $appsStaging "web")

function Copy-TreeExclude($src, $dst, $excludeDirs) {
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Get-ChildItem -Force -LiteralPath $src | ForEach-Object {
    if ($_.PSIsContainer) {
      if ($excludeDirs -contains $_.Name) { return }
      Copy-TreeExclude $_.FullName (Join-Path $dst $_.Name) $excludeDirs
    } else {
      try {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dst $_.Name) -Force -ErrorAction Stop
      } catch {
        Write-Warning "Pominieto (zablokowany): $($_.FullName)"
      }
    }
  }
}
$deskExclude = @("data\webview2-profile", "logs", "_qa")
Copy-TreeExclude (Join-Path $Root "apps\desktop") (Join-Path $appsStaging "desktop") $deskExclude

# README
@"
DAM Dobra Kaloria - Instalator Windows

1. Rozpakuj ZIP
2. Uruchom Setup-DAM.ps1 (PPM -> Uruchom w programie PowerShell)
   lub: powershell -ExecutionPolicy Bypass -File Setup-DAM.ps1
3. Wybierz folder instalacji i root Marketing
4. Po instalacji uruchomi sie DAM z mostem lokalnym

Przegladarka bez instalatora = tylko podglad (Panel-DAM).
"@ | Set-Content -LiteralPath (Join-Path $Staging "README.txt") -Encoding UTF8

if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
Compress-Archive -Path (Join-Path $Staging "*") -DestinationPath $ZipPath -CompressionLevel Optimal

Write-Host "OK: $ZipPath"
Write-Host "Skopiuj do Panel-DAM: dist/$ZipName -> releases/"
