# Rdzen instalacji DAM (wywolywany z Setup-DAM.ps1).
param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [Parameter(Mandatory = $true)][string]$MarketingRoot,
  [Parameter(Mandatory = $true)][string]$SourceRepo,
  [string]$UserEmail = ""
)

$ErrorActionPreference = "Stop"

function Copy-Tree($src, $dst, $excludeDirs) {
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Get-ChildItem -Force -LiteralPath $src | ForEach-Object {
    if ($_.PSIsContainer) {
      if ($excludeDirs -contains $_.Name) { return }
      Copy-Tree $_.FullName (Join-Path $dst $_.Name) $excludeDirs
    } else {
      Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dst $_.Name) -Force
    }
  }
}

$exclude = @(
  ".git", ".venv", "venv", "node_modules", "_qa", ".cursor",
  "PAMIEC-PODRECZNA", "DATABASE", "agents", ".ralph"
)

Write-Host "Instalacja DAM -> $InstallDir"
Write-Host "Marketing root: $MarketingRoot"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# apps/web + apps/desktop (repo lub paczka instalatora payload/)
$appsBase = Join-Path $SourceRepo "apps"
$payloadApps = Join-Path $SourceRepo "payload\apps"
if (Test-Path -LiteralPath $payloadApps) { $appsBase = $payloadApps }
$webSrc = Join-Path $appsBase "web"
$deskSrc = Join-Path $appsBase "desktop"
$webDst = Join-Path $InstallDir "apps\web"
$deskDst = Join-Path $InstallDir "apps\desktop"

if (-not (Test-Path $webSrc)) { throw "Brak $webSrc" }
if (-not (Test-Path $deskSrc)) { throw "Brak $deskSrc" }

Copy-Tree $webSrc $webDst $exclude
Copy-Tree $deskSrc $deskDst @("_qa", "logs", "data\webview2-profile")

# Marketing path — zapis lokalny (most zsynchronizuje z Postgres przy logowaniu)
$dataDir = Join-Path $deskDst "data"
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

$marketingNorm = $MarketingRoot.TrimEnd('\')
if (-not (Test-Path -LiteralPath $marketingNorm)) {
  Write-Warning "Uwaga: folder Marketing nie istnieje jeszcze: $marketingNorm"
}

$manifest = @{
  installed_at   = (Get-Date).ToUniversalTime().ToString("o")
  install_dir    = $InstallDir
  marketing_root = $marketingNorm
  source_repo    = $SourceRepo
  user_email     = $UserEmail
} | ConvertTo-Json -Depth 4
Set-Content -LiteralPath (Join-Path $InstallDir "install-manifest.json") -Value $manifest -Encoding UTF8

$machineCfg = @{
  users = @{
    $env:USERNAME = @{
      base_path  = $marketingNorm
      updated_at = (Get-Date).ToUniversalTime().ToString("o")
    }
  }
} | ConvertTo-Json -Depth 6
Set-Content -LiteralPath (Join-Path $deskDst "machine-config.json") -Value $machineCfg -Encoding UTF8

# Skrot uruchomienia
$Wsh = New-Object -ComObject WScript.Shell
$icon = Join-Path $deskDst "dam_app.ico"
$runVbs = Join-Path $deskDst "run-dam.vbs"
$browserVbs = Join-Path $deskDst "open-dam-browser.vbs"

function New-Sc($path, $vbs, $desc) {
  $sc = $Wsh.CreateShortcut($path)
  $sc.TargetPath = "wscript.exe"
  $sc.Arguments = "`"$vbs`""
  $sc.WorkingDirectory = $deskDst
  if (Test-Path $icon) { $sc.IconLocation = "$icon,0" }
  $sc.Description = $desc
  $sc.Save()
}

$appName = "DAM - Dobra Kaloria - Inyfinn"
New-Sc (Join-Path $env:USERPROFILE "Desktop\$appName.lnk") $runVbs "$appName"
New-Sc (Join-Path $env:USERPROFILE "Desktop\DAM (przegladarka).lnk") $browserVbs "DAM przegladarka"

$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
New-Sc (Join-Path $startMenu "$appName.lnk") $runVbs $appName

Write-Host "Instalacja zakonczona."
