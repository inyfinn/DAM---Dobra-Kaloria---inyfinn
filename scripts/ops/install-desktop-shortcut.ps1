# Instaluje skroty DAM: aplikacja (okno), przegladarka (auto-start), autostart po logowaniu.
# Uruchom raz po sklonowaniu repo lub po aktualizacji launchera.
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$DesktopDir = Join-Path $RepoRoot "apps\desktop"
$LaunchPy = Join-Path $DesktopDir "launch.py"
$RunVbs = Join-Path $DesktopDir "run-dam.vbs"
$BrowserVbs = Join-Path $DesktopDir "open-dam-browser.vbs"
$WatchVbs = Join-Path $DesktopDir "run-dam-watch.vbs"
$IconPath = Join-Path $DesktopDir "dam_app.ico"
$BuildIcon = Join-Path $RepoRoot "scripts\ops\build-desktop-icon.py"
$AppName = "DAM - Dobra Kaloria - Inyfinn"
$BrowserName = "DAM (przegladarka)"
$WatchName = "DAM autostart (przegladarka)"

if (-not (Test-Path $LaunchPy)) {
  throw "Brak $LaunchPy"
}
if (-not (Test-Path $BrowserVbs)) {
  throw "Brak $BrowserVbs"
}
if (-not (Test-Path $WatchVbs)) {
  throw "Brak $WatchVbs"
}

if (-not (Test-Path $IconPath)) {
  Write-Host "Buduje ikone aplikacji..."
  python $BuildIcon
}

if (-not (Test-Path $IconPath)) {
  Write-Warning "Brak ikony - skrot bez wlasnej ikony."
}

$Wsh = New-Object -ComObject WScript.Shell

function New-VbsShortcut {
  param(
    [string]$Path,
    [string]$Vbs,
    [string]$Description
  )
  $sc = $Wsh.CreateShortcut($Path)
  $sc.TargetPath = "wscript.exe"
  $sc.Arguments = "`"$Vbs`""
  $sc.WorkingDirectory = $DesktopDir
  if (Test-Path $IconPath) {
    $sc.IconLocation = "$IconPath,0"
  }
  $sc.Description = $Description
  $sc.Save()
  Write-Host "Skrot: $Path"
}

New-VbsShortcut (Join-Path $env:USERPROFILE "Desktop\$AppName.lnk") $RunVbs "$AppName (okno aplikacji)"
New-VbsShortcut (Join-Path $env:USERPROFILE "Desktop\$BrowserName.lnk") $BrowserVbs "$BrowserName - uruchamia serwer i otwiera http://127.0.0.1:8765"

$legacy = Join-Path $env:USERPROFILE "Desktop\DAM ETA.lnk"
if (Test-Path $legacy) {
  Remove-Item $legacy -Force
  Write-Host "Usunieto stary skrot: $legacy"
}

$StartMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
if (-not (Test-Path $StartMenu)) {
  New-Item -ItemType Directory -Path $StartMenu -Force | Out-Null
}
New-VbsShortcut (Join-Path $StartMenu "$AppName.lnk") $RunVbs "$AppName (okno aplikacji)"
New-VbsShortcut (Join-Path $StartMenu "$BrowserName.lnk") $BrowserVbs "$BrowserName"

$legacyStart = Join-Path $StartMenu "DAM ETA.lnk"
if (Test-Path $legacyStart) {
  Remove-Item $legacyStart -Force
  Write-Host "Usunieto stary skrot Start: $legacyStart"
}

# Autostart: pilnuje portow 8765/8766 — wpisanie URL w przegladarce dziala po logowaniu
$Startup = [Environment]::GetFolderPath("Startup")
if (-not (Test-Path $Startup)) {
  New-Item -ItemType Directory -Path $Startup -Force | Out-Null
}
New-VbsShortcut (Join-Path $Startup "$WatchName.lnk") $WatchVbs "DAM w tle - auto-start serwera dla przegladarki"

Write-Host ""
Write-Host "Gotowe:"
Write-Host "  - $AppName - okno aplikacji (WebView2)"
Write-Host "  - $BrowserName - przegladarka (start serwera + dashboard)"
Write-Host "  - Autostart po logowaniu - porty 8765/8766 zawsze gotowe"
Write-Host ""
Write-Host "Adres w przegladarce: http://127.0.0.1:8765/dashboard.html"
Write-Host "Bez npm/build - pliki statyczne, odswiez F5 po zmianach."
