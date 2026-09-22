#Requires -Version 5.1
<#
.SYNOPSIS
  Build dam-appw.exe (PyInstaller onedir) into bin/runtime/win/dam-app/
#>
$ErrorActionPreference = "Stop"

$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$ContentRoot = Join-Path $GitRoot "bin"
$EngineDir = Join-Path $ContentRoot "runtime\win\dam-app"
$Entry = Join-Path $ContentRoot "apps\desktop\engine_launcher.py"
$Ico = Join-Path $ContentRoot "apps\desktop\dam_app.ico"
$DistWork = Join-Path $GitRoot "dist\prep\pyinstaller-engine"
$HostPy = $null
foreach ($c in @(
    "$env:LocalAppData\Programs\Python\Python312\python.exe",
    "python"
  )) {
  try {
    if ($c -eq "python") {
      $v = & python -c "import sys; print(sys.executable)" 2>$null
      if ($LASTEXITCODE -eq 0 -and $v) { $HostPy = $v.Trim(); break }
    } elseif (Test-Path $c) { $HostPy = $c; break }
  } catch {}
}
if (-not $HostPy) { throw "Brak host Python do PyInstaller" }

& $HostPy -m pip install --disable-pip-version-check -q pyinstaller 2>$null | Out-Null

if (-not (Test-Path $Entry)) { throw "Missing $Entry (run sync-apps-to-bin first)" }
if (-not (Test-Path $Ico)) {
  & $HostPy (Join-Path $ContentRoot "apps\desktop\scripts\build-dam-ico.py")
}

# Zasada 0 (~/.claude/CLAUDE.md): bez kasowania rekurencyjnego. PyInstaller buduje do
# swiezego katalogu; stary silnik jest PRZEMIANOWANY (*.old-<data>), usuwa go czlowiek.
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$freshDist = "$EngineDir.new-$stamp"
New-Item -ItemType Directory -Force -Path $DistWork | Out-Null

$specArgs = @(
  "-m", "PyInstaller",
  "--noconfirm", "--clean",
  "--onedir",
  "--name", "dam-appw",
  "--distpath", $freshDist,
  "--workpath", (Join-Path $DistWork "build"),
  "--specpath", $DistWork,
  "--windowed",
  "--icon", $Ico,
  $Entry
)
Write-Host "PyInstaller: $($specArgs -join ' ')"
Push-Location (Split-Path $Entry)
try {
  & $HostPy @specArgs
  if ($LASTEXITCODE -ne 0) { throw "PyInstaller exit $LASTEXITCODE" }
} finally { Pop-Location }

$builtDir = Join-Path $freshDist "dam-appw"
$built = Join-Path $builtDir "dam-appw.exe"
$target = Join-Path $EngineDir "dam-appw.exe"
if (Test-Path $built) {
  if (Test-Path $EngineDir) {
    $oldName = (Split-Path $EngineDir -Leaf) + ".old-$stamp"
    Rename-Item -LiteralPath $EngineDir -NewName $oldName
    Write-Host "Poprzedni silnik przemianowany: $(Join-Path (Split-Path $EngineDir) $oldName) (usun recznie przez Kosz)"
  }
  Move-Item -LiteralPath $builtDir -Destination $EngineDir
  # pusty katalog posredni - bez -Recurse (nie skasuje niczego z zawartoscia)
  Remove-Item -LiteralPath $freshDist -ErrorAction SilentlyContinue
}
if (-not (Test-Path $target)) { throw "Brak $target po build" }
Write-Host "OK engine: $target"

