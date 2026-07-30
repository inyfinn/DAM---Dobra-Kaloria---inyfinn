# Deploy Panel-DAM na NAS (Web Station 443 — bez portu DSM :5001)
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/ops/install-panel-dam-synology.ps1
# Opcjonalnie (legacy, niezalecane):
#   ... -WithDsm5001Nginx
#   ... -RemoveDsm5001Nginx

param(
  [string]$SshHost = "syno",
  [string]$NasWebRoot = "W:\web",
  [switch]$WithDsm5001Nginx,
  [switch]$RemoveDsm5001Nginx
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$DeployScript = Join-Path $PSScriptRoot "deploy-panel-dam-synology.ps1"
$NginxConf = Join-Path $PSScriptRoot "synology\dsm.panel-dam.conf"

if (-not (Test-Path -LiteralPath $DeployScript)) {
  throw "Brak: $DeployScript"
}

Write-Host "=== Deploy plikow web (Web Station) ==="
& $DeployScript -NasWebRoot $NasWebRoot

$licenseSrc = Join-Path $Root "LICENSE.md"
$licenseDst = Join-Path $NasWebRoot "Panel-DAM\LICENSE.md"
if (Test-Path -LiteralPath $licenseSrc) {
  Copy-Item -LiteralPath $licenseSrc -Destination $licenseDst -Force
  Write-Host "Skopiowano LICENSE.md -> Panel-DAM/"
}

if ($RemoveDsm5001Nginx) {
  Write-Host "=== Usuwanie legacy nginx DSM :5001 ==="
  ssh $SshHost "sudo rm -f /usr/local/etc/nginx/conf.d/dsm.panel-dam.conf /etc/nginx/conf.d/dsm.panel-dam.conf; sudo nginx -t; sudo nginx -s reload; echo removed_dsm_panel_dam"
}

if ($WithDsm5001Nginx) {
  if (-not (Test-Path -LiteralPath $NginxConf)) {
    throw "Brak: $NginxConf"
  }
  Write-Host "=== LEGACY: nginx DSM :5001 (niezalecane) ==="
  $nginxShareDir = Join-Path $NasWebRoot "_nginx"
  New-Item -ItemType Directory -Force -Path $nginxShareDir | Out-Null
  Copy-Item -LiteralPath $NginxConf -Destination (Join-Path $nginxShareDir "dsm.panel-dam.conf") -Force
  ssh $SshHost "sudo cp /volume1/web/_nginx/dsm.panel-dam.conf /usr/local/etc/nginx/conf.d/dsm.panel-dam.conf; sudo cp /volume1/web/_nginx/dsm.panel-dam.conf /etc/nginx/conf.d/dsm.panel-dam.conf; sudo nginx -t; sudo nginx -s reload; echo nginx_OK_legacy"
}

Write-Host ""
Write-Host "Gotowe."
Write-Host "  Kanoniczny URL: https://inyfinn.synology.me/Panel-DAM/"
Write-Host "  (bez :5001 - tylko Web Station / HTTPS 443)"
Write-Host "  Pelny DAM (API): most na PC lub NAS - docs/SYNOLOGY-WEB-PANEL.md"
