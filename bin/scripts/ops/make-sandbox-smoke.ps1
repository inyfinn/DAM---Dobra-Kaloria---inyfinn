# Generator pliku Piaskownicy pod TE maszyne.
#
# Po co: sandbox-smoke.wsb ma zahardkodowane sciezki (HostFolder), bo Piaskownica
# Windows nie rozwija zmiennych srodowiskowych w konfiguracji. Plik w repo powstal
# na maszynie domowej (C:\Users\xpret, X:\Marketing) i na komputerze firmowym
# (inny uzytkownik, repo na D:) NIE DZIALA - dlatego test czystej instalacji
# nigdy tam nie ruszyl.
#
# Ten skrypt wykrywa sciezki lokalnie i zapisuje sandbox-smoke.local.wsb,
# ktory jest w .gitignore (nie zasmieca repo przy kazdej maszynie).
#
# Uzycie:
#   powershell -NoProfile -ExecutionPolicy Bypass -File bin\scripts\ops\make-sandbox-smoke.ps1
#   potem dwuklik na bin\scripts\ops\sandbox-smoke.local.wsb

$ErrorActionPreference = 'Stop'

$opsDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $opsDir '..\..\..')).Path
$setupDir = Join-Path $env:LOCALAPPDATA 'DAM-build\out'
$outDir   = 'C:\Temp\dam-sandbox-out'
$target   = Join-Path $opsDir 'sandbox-smoke.local.wsb'

Write-Host "Repo:       $repoRoot"
Write-Host "Instalator: $setupDir"
Write-Host "Wyniki:     $outDir"

# --- kontrola przed zapisem: Piaskownica nie wstanie, gdy HostFolder nie istnieje ---
$problems = @()
if (-not (Test-Path $setupDir)) {
    $problems += "brak katalogu z instalatorem: $setupDir (zbuduj: bin\scripts\ops\build-installer.ps1)"
} elseif (-not (Test-Path (Join-Path $setupDir 'DAM-Setup.exe'))) {
    $problems += "w $setupDir nie ma DAM-Setup.exe"
}
if (-not (Test-Path $opsDir)) { $problems += "brak katalogu skryptow: $opsDir" }

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    Write-Host "Utworzono katalog wynikow: $outDir"
}

$feature = $null
try {
    $feature = (Get-WindowsOptionalFeature -Online -FeatureName 'Containers-DisposableClientVM' -ErrorAction Stop).State
} catch {
    $feature = 'nieznany (brak uprawnien do sprawdzenia)'
}
Write-Host "Piaskownica Windows: $feature"
if ($feature -eq 'Disabled') {
    $problems += "funkcja 'Piaskownica systemu Windows' jest WYLACZONA - wlacz ja w Funkcjach systemu Windows"
}

if ($problems.Count -gt 0) {
    Write-Host ''
    Write-Host 'NIE MOGE URUCHOMIC TESTU - do naprawy:' -ForegroundColor Yellow
    $problems | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host ''
}

# --- sam plik konfiguracji ---
$xml = @"
<Configuration>
  <!--
    WYGENEROWANE AUTOMATYCZNIE przez bin\scripts\ops\make-sandbox-smoke.ps1
    dla maszyny: $env:COMPUTERNAME / uzytkownik: $env:USERNAME
    Nie edytuj recznie - uruchom generator ponownie.
  -->
  <MappedFolders>
    <MappedFolder>
      <HostFolder>$setupDir</HostFolder>
      <SandboxFolder>C:\dam-setup</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
    <MappedFolder>
      <HostFolder>$opsDir</HostFolder>
      <SandboxFolder>C:\dam-scripts</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
    <MappedFolder>
      <HostFolder>$outDir</HostFolder>
      <SandboxFolder>C:\dam-results</SandboxFolder>
      <ReadOnly>false</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\dam-scripts\sandbox-smoke.ps1 -SetupDir C:\dam-setup -OutDir C:\dam-results</Command>
  </LogonCommand>
  <Networking>Enable</Networking>
  <vGPU>Disable</vGPU>
  <MemoryInMB>8192</MemoryInMB>
</Configuration>
"@

Set-Content -Path $target -Value $xml -Encoding UTF8
Write-Host ''
Write-Host "Zapisano: $target"
Write-Host 'Teraz kliknij dwukrotnie ten plik. Wyniki pojawia sie w:' $outDir
