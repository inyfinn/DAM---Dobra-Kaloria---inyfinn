# Instaluje skrot "DAM - Dobra Kaloria - Inyfinn" na pulpicie i w menu Start.
# Uruchom raz po sklonowaniu repo lub po aktualizacji launchera.
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$DesktopDir = Join-Path $RepoRoot "apps\desktop"
$LaunchPy = Join-Path $DesktopDir "launch.py"
$RunVbs = Join-Path $DesktopDir "run-dam.vbs"
$IconPath = Join-Path $DesktopDir "dam_app.ico"
$BuildIcon = Join-Path $RepoRoot "scripts\ops\build-desktop-icon.py"
$AppName = "DAM - Dobra Kaloria - Inyfinn"

if (-not (Test-Path $LaunchPy)) {
  throw "Brak $LaunchPy"
}

if (-not (Test-Path $IconPath)) {
  Write-Host "Buduje ikone aplikacji..."
  python $BuildIcon
}

if (-not (Test-Path $IconPath)) {
  Write-Warning "Brak ikony - skrot bez wlasnej ikony."
}

$Wsh = New-Object -ComObject WScript.Shell

function New-DamShortcut($Path) {
  $sc = $Wsh.CreateShortcut($Path)
  $sc.TargetPath = "wscript.exe"
  $sc.Arguments = "`"$RunVbs`""
  $sc.WorkingDirectory = $DesktopDir
  if (Test-Path $IconPath) {
    $sc.IconLocation = "$IconPath,0"
  }
  $sc.Description = "$AppName (aplikacja lokalna)"
  $sc.Save()
  Write-Host "Skrot: $Path"
}

$DesktopLnk = Join-Path $env:USERPROFILE "Desktop\$AppName.lnk"
New-DamShortcut $DesktopLnk

# Usun stary skrot "DAM ETA" jesli zostal po poprzednich instalacjach
$legacy = Join-Path $env:USERPROFILE "Desktop\DAM ETA.lnk"
if (Test-Path $legacy) {
  Remove-Item $legacy -Force
  Write-Host "Usunieto stary skrot: $legacy"
}

$StartMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
if (-not (Test-Path $StartMenu)) {
  New-Item -ItemType Directory -Path $StartMenu -Force | Out-Null
}
New-DamShortcut (Join-Path $StartMenu "$AppName.lnk")
$legacyStart = Join-Path $StartMenu "DAM ETA.lnk"
if (Test-Path $legacyStart) {
  Remove-Item $legacyStart -Force
  Write-Host "Usunieto stary skrot Start: $legacyStart"
}

Write-Host ""
Write-Host "Gotowe. Dwukliknij '$AppName' na pulpicie - otworzy sie okno aplikacji (bez przegladarki)."
Write-Host "Wymagania: Python 3.10+, pywebview (pip install -r apps/desktop/requirements.txt)"
