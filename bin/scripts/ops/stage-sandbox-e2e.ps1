#Requires -Version 5.1
<#
  Kopiuje wejscie testu E2E na dysk lokalny i uruchamia Piaskownice.

  Po co: 20.09.2026 dwa przebiegi sandbox-e2e.wsb stanely BEZ JEDNEGO pliku wyniku,
  bo .wsb mapowal foldery z dysku X: (Synology Drive), a dostawca chmury zwracal
  "Dostawca synchronizacji z chmura nie mogl wykonac operacji z powodu braku
  dostepnosci sieci". Windows Sandbox nie startuje LogonCommand, gdy mapowanie padnie.
  Wejscie testu musi lezec na dysku stalym.

  Niczego nie kasuje. Pliki nadpisuje w C:\Temp\dam-sandbox-in.
#>
param(
  [string]$In = "C:\Temp\dam-sandbox-in",
  [string]$Out = "C:\Temp\dam-sandbox-out",
  [switch]$NoLaunch
)
$ErrorActionPreference = "Stop"
$BinRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
New-Item -ItemType Directory -Force -Path (Join-Path $In "ops"), (Join-Path $In "secrets"), $Out | Out-Null

$copies = @(
  @{ src = Join-Path $PSScriptRoot "sandbox-e2e.ps1"; dst = Join-Path $In "ops\sandbox-e2e.ps1" },
  # Smart App Control w obrazie Piaskownicy blokuje niepodpisane .pyd (cryptography/_rust,
  # psycopg2/_psycopg), przez co aktywacja zglasza falszywe "code_invalid". Wylaczamy je
  # TYLKO w jednorazowej Piaskownicy, zeby test pokazal prawdziwy stan aplikacji.
  @{ src = Join-Path $PSScriptRoot "kill-sac.ps1"; dst = Join-Path $In "ops\kill-sac.ps1" },
  @{ src = Join-Path $BinRoot "installer\inyfinn-dam-codesign.cer"; dst = Join-Path $In "ops\inyfinn-dam-codesign.cer" },
  # Setup instaluje VC++ Redistributable; tryb awaryjny (bez Setupu) musi zrobic to sam,
  # inaczej cryptography/psycopg2 nie zaimportuja sie i aktywacja zglosi "code_invalid".
  @{ src = Join-Path $BinRoot "installer\redist\vc_redist.x64.exe"; dst = Join-Path $In "ops\vc_redist.x64.exe" },
  @{ src = Join-Path $BinRoot "secrets\activation-code.txt"; dst = Join-Path $In "secrets\activation-code.txt" }
)
foreach ($c in $copies) {
  if (-not (Test-Path -LiteralPath $c.src)) { throw "Brak pliku wejsciowego: $($c.src)" }
  Copy-Item -LiteralPath $c.src -Destination $c.dst -Force
  Write-Host ("OK {0} ({1} B)" -f $c.dst, (Get-Item -LiteralPath $c.dst).Length)
}

$setup = Join-Path $env:LOCALAPPDATA "DAM-build\out\DAM-Setup.exe"
if (-not (Test-Path -LiteralPath $setup)) { throw "Brak instalatora: $setup (uruchom build-installer.ps1)" }
Write-Host ("Instalator: {0} ({1:N1} MB, {2})" -f $setup, ((Get-Item -LiteralPath $setup).Length / 1MB), (Get-Item -LiteralPath $setup).LastWriteTime)

# Smart App Control w czystym Windows 11 blokuje instalator podpisany self-signed.
# Zeby test nie konczyl sie na pierwszym kroku, mapujemy tez ladunek (staging tego
# samego buildu): skrypt wylozy go recznie i wystartuje bundlowanym python.exe.
$stagingRoot = Join-Path $env:LOCALAPPDATA "DAM-build\staging"
$payload = @(Get-ChildItem -LiteralPath $stagingRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "DAM-install-*" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
if (-not $payload) { throw "Brak katalogu staging w $stagingRoot" }
$payloadDir = $payload[0].FullName
Write-Host "Ladunek: $payloadDir"

$wsb = Join-Path $In "sandbox-e2e-local.wsb"
@"
<Configuration>
  <MappedFolders>
    <MappedFolder><HostFolder>$(Split-Path $setup -Parent)</HostFolder><SandboxFolder>C:\dam-setup</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>$payloadDir</HostFolder><SandboxFolder>C:\dam-payload</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>$In\ops</HostFolder><SandboxFolder>C:\dam-scripts</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>$In\secrets</HostFolder><SandboxFolder>C:\dam-secrets</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>$Out</HostFolder><SandboxFolder>C:\dam-results</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "New-Item -ItemType Directory -Force -Path C:\dam-results | Out-Null; 'boot ' + (Get-Date -Format s) | Set-Content -LiteralPath C:\dam-results\_BOOT.txt -Encoding UTF8; &amp; C:\dam-scripts\kill-sac.ps1 *&gt; C:\dam-results\_sac.log; &amp; C:\dam-scripts\sandbox-e2e.ps1 *&gt; C:\dam-results\_ps.log"</Command>
  </LogonCommand>
  <Networking>Enable</Networking>
  <vGPU>Disable</vGPU>
  <MemoryInMB>8192</MemoryInMB>
</Configuration>
"@ | Set-Content -LiteralPath $wsb -Encoding UTF8
[xml]$null = Get-Content -LiteralPath $wsb -Raw
Write-Host "Konfiguracja: $wsb"

if (-not $NoLaunch) {
  if (Get-Process -Name WindowsSandboxRemoteSession -ErrorAction SilentlyContinue) {
    throw "Piaskownica juz dziala. Zamknij ja i uruchom ponownie."
  }
  Start-Process -FilePath $wsb
  Write-Host "Piaskownica wystartowana. Wyniki: $Out\e2e.json"
}
