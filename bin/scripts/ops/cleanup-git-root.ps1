#Requires -Version 5.1
# GIT_ROOT shows only: DAM.exe, URUCHOM-DAM.bat, bin/, .cursor/, .git*
$ErrorActionPreference = "Stop"
$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
Set-Location $GitRoot

function Remove-TreeForce([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $full = (Resolve-Path -LiteralPath $Path).Path
  $long = if ($full.StartsWith('\\?\')) { $full } else { "\\?\$full" }
  cmd /c "rmdir /s /q `"$long`"" | Out-Null
}

Write-Host "== cleanup-git-root =="

foreach ($d in @("_restore_backups", "_restore_snapshots", "_restore_stage", "_qa_screenshots", "build")) {
  if (Test-Path $d) { Write-Host "DELETE $d"; Remove-TreeForce $d }
}

# Legacy root folders -> bin/
if (Test-Path "dist") {
  New-Item -ItemType Directory -Force -Path "bin\dist" | Out-Null
  Write-Host "MOVE dist -> bin\dist"
  robocopy "dist" "bin\dist" /E /MOVE /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -lt 8) { Remove-TreeForce "dist" }
}
if (Test-Path "installer") {
  New-Item -ItemType Directory -Force -Path "bin\installer" | Out-Null
  Write-Host "MOVE installer -> bin\installer"
  Get-ChildItem "installer" | ForEach-Object {
    $dst = Join-Path "bin\installer" $_.Name
    if (Test-Path $dst) { Remove-TreeForce $dst }
    Move-Item $_.FullName $dst -Force
  }
  Remove-TreeForce "installer"
}

Write-Host "OK cleanup-git-root"
Write-Host "Root should show: DAM.exe, URUCHOM-DAM.bat, bin\, .cursor\, .git*"
