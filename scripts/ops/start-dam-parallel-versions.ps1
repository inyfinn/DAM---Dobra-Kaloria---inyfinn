$ErrorActionPreference = "Stop"

$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$parent = Split-Path $repo -Parent
$serve = Join-Path $repo "scripts\ops\serve_dam_instance.py"
$serveBrowser = Join-Path $repo "apps\desktop\serve_browser.py"
$sharedDesktop = Join-Path $repo "apps\desktop"

if (-not (Test-Path $serve)) {
  Write-Error "Brak serve_dam_instance.py: $serve"
}
if (-not (Test-Path $serveBrowser)) {
  Write-Error "Brak serve_browser.py: $serveBrowser"
}

function Ensure-Worktree($path, $commit) {
  if (-not (Test-Path $path)) {
    Write-Host "Tworze worktree: $path @ $commit"
    Set-Location $repo
    git worktree add $path $commit
  }
}

Ensure-Worktree (Join-Path $parent "DAM-kopia-092821f") "092821f"
Ensure-Worktree (Join-Path $parent "DAM-kopia-3.1.5") "2b3873a"

$legacyInstances = @(
  @{
    Label = "3.2.0 pre-realign"
    Version = "3.2.0"
    Repo = (Join-Path $parent "DAM-kopia-092821f")
    UiPort = 8767
    BridgePort = 8768
    SharedDesktop = $sharedDesktop
  },
  @{
    Label = "3.1.5 legacy"
    Version = "3.1.5"
    Repo = (Join-Path $parent "DAM-kopia-3.1.5")
    UiPort = 8769
    BridgePort = 8770
    SharedDesktop = $sharedDesktop
  }
)

Write-Host "Zatrzymuje stare porty 8765-8770..."
8765,8766,8767,8768,8769,8770 | ForEach-Object {
  Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "Start current (main) -> http://127.0.0.1:8765/visualizations.html  (bridge :8766, BEZ prefiksu wersji)"
$browserCmd = "Set-Location `"$(Join-Path $repo 'apps\desktop')`"; python `"$serveBrowser`""
Start-Process -WindowStyle Minimized -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-Command", $browserCmd -WorkingDirectory $repo
Start-Sleep -Milliseconds 1200

foreach ($inst in $legacyInstances) {
  $sharedArg = ""
  if ($inst.SharedDesktop) {
    $sharedArg = " --shared-desktop `"$($inst.SharedDesktop)`""
  }
  $cmd = "python `"$serve`" --repo `"$($inst.Repo)`" --version $($inst.Version) --ui-port $($inst.UiPort) --bridge-port $($inst.BridgePort) --no-browser$sharedArg"
  Write-Host ""
  Write-Host "Start $($inst.Label) -> http://127.0.0.1:$($inst.UiPort)/$($inst.Version)/visualizations.html"
  Start-Process -WindowStyle Minimized -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-Command", $cmd -WorkingDirectory $repo
  Start-Sleep -Milliseconds 900
}

Write-Host ""
Write-Host "=== DAM parallel dev ==="
Write-Host "  current  http://127.0.0.1:8765/visualizations.html  (bridge :8766)"
foreach ($inst in $legacyInstances) {
  Write-Host "  v$($inst.Version)  http://127.0.0.1:$($inst.UiPort)/$($inst.Version)/visualizations.html  (bridge :$($inst.BridgePort))"
}
Write-Host ""
Write-Host "Stop: zamknij okna python lub ubij porty 8765-8770."
