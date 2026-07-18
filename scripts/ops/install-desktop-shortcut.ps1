# Instaluje skrot "DAM ETA" na pulpicie i w menu Start.
# Uruchom raz po sklonowaniu repo lub po aktualizacji launchera.
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$DesktopDir = Join-Path $RepoRoot "apps\desktop"
$LaunchPy = Join-Path $DesktopDir "launch.py"
$RunVbs = Join-Path $DesktopDir "run-dam.vbs"
$IconPath = Join-Path $DesktopDir "dam_app.ico"
$BuildIcon = Join-Path $RepoRoot "scripts\ops\build-desktop-icon.py"

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
  $sc.Description = "DAM ETA - Dobra Kaloria (aplikacja lokalna)"
  $sc.Save()
  Write-Host "Skrot: $Path"
}

New-DamShortcut (Join-Path $env:USERPROFILE "Desktop\DAM ETA.lnk")

$StartMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
if (-not (Test-Path $StartMenu)) {
  New-Item -ItemType Directory -Path $StartMenu -Force | Out-Null
}
New-DamShortcut (Join-Path $StartMenu "DAM ETA.lnk")

Write-Host ""
Write-Host "Gotowe. Dwukliknij 'DAM ETA' na pulpicie - otworzy sie okno aplikacji (bez przegladarki)."
Write-Host "Wymagania: Python 3.10+, pywebview (pip install -r apps/desktop/requirements.txt)"
