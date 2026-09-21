<#
  Prowadzi test instalatora DAM w Piaskownicy Windows na maszynie, gdzie Smart App Control
  blokuje niepodpisane pliki.

  Przebieg:
    1. kopiuje instalator + skrypt logowania do C:\Temp\dam-sandbox-in
    2. startuje piaskownice z sandbox-dam-test.wsb
    3. czeka, az w piaskownicy wylaczysz Smart App Control (jedno polecenie, opisane na Pulpicie)
    4. restartuje goscia z zachowaniem stanu (shutdown /r) - dopiero to odlacza polityke CI
    5. uruchamia instalator i zapisuje wynik do C:\Temp\dam-sandbox-out

  Skrypt niczego nie wylacza sam - krok 3 nalezy do Ciebie.

  Uzycie:
    .\sandbox-dam-test.ps1                       # bierze najnowszy DAM-Setup.exe z wydania GitHub
    .\sandbox-dam-test.ps1 -Setup C:\sciezka.exe # bierze wskazany plik
#>
[CmdletBinding()]
param(
  [string]$Setup,
  [string]$InDir  = 'C:\Temp\dam-sandbox-in',
  [string]$OutDir = 'C:\Temp\dam-sandbox-out',
  [int]$WaitMinutes = 20
)

$ErrorActionPreference = 'Stop'
$ops = $PSScriptRoot

function Get-Wsb {
  $pkg = Get-AppxPackage -Name MicrosoftWindows.WindowsSandbox -ErrorAction SilentlyContinue
  if (-not $pkg) { throw "Brak aplikacji Piaskownica systemu Windows (wsb.exe). Zainstaluj ze Sklepu." }
  Join-Path $pkg.InstallLocation 'wsb.exe'
}
$wsb = Get-Wsb

New-Item -ItemType Directory -Force -Path $InDir, $OutDir | Out-Null
Get-ChildItem $OutDir -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

if (-not $Setup) {
  $repo = Split-Path (Split-Path $ops -Parent) -Parent   # ...\bin
  $local = Join-Path $repo 'instalator\DAM-Setup.exe'
  if (Test-Path $local) {
    $Setup = $local
  } else {
    Write-Host "Pobieram najnowsze wydanie z GitHub..."
    & gh release download --repo inyfinn/DAM---Dobra-Kaloria---inyfinn --pattern DAM-Setup.exe --dir $InDir --clobber
    $Setup = Join-Path $InDir 'DAM-Setup.exe'
  }
}
if (-not (Test-Path $Setup)) { throw "Nie znalazlem instalatora: $Setup" }
Copy-Item $Setup (Join-Path $InDir 'DAM-Setup.exe') -Force
Copy-Item (Join-Path $ops 'sandbox-dam-logon.ps1') $InDir -Force
Write-Host ("Instalator: {0} ({1:N0} B)" -f $Setup, (Get-Item $Setup).Length)

# jedna piaskownica na raz
$running = (& $wsb list 2>$null | Out-String).Trim()
if ($running) { Write-Host "Zamykam poprzednia piaskownice $running"; & $wsb stop --id $running | Out-Null; Start-Sleep -Seconds 5 }

Start-Process -FilePath 'C:\Windows\System32\WindowsSandbox.exe' -ArgumentList (Join-Path $ops 'sandbox-dam-test.wsb')

$id = $null
for ($i = 0; $i -lt 60 -and -not $id; $i++) {
  Start-Sleep -Seconds 3
  $id = (& $wsb list 2>$null | Out-String).Trim()
}
if (-not $id) { throw "Piaskownica nie wstala." }
Write-Host "Piaskownica: $id"

function Get-SacInSandbox {
  $c = 'powershell -NoProfile -Command "(Get-ItemProperty HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy).VerifiedAndReputablePolicyState | Set-Content C:\dam-results\sac.txt"'
  & $wsb exec --id $id -r System -c $c 2>&1 | Out-Null
  $f = Join-Path $OutDir 'sac.txt'
  if (Test-Path $f) { return (Get-Content $f -Raw).Trim() }
  return $null
}

Write-Host ""
Write-Host "TERAZ TWOJ KROK - w oknie piaskownicy:" -ForegroundColor Yellow
Write-Host "  Zabezpieczenia Windows -> Kontrola aplikacji i przegladarki -> Inteligentna kontrola aplikacji -> Wylacz" -ForegroundColor Yellow
Write-Host "Instrukcja lezy tez na Pulpicie piaskownicy (CZYTAJ-MNIE.txt). Czekam do $WaitMinutes min..."

$deadline = (Get-Date).AddMinutes($WaitMinutes)
$sac = Get-SacInSandbox
while ($sac -ne '0' -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 10
  $sac = Get-SacInSandbox
}
if ($sac -ne '0') { throw "Smart App Control dalej = $sac. Przerwane." }

Write-Host "SAC = 0. Restartuje goscia (stan zostaje)..."
& $wsb exec --id $id -r System -c "shutdown /r /t 0" 2>&1 | Out-Null

$bootFile = Join-Path $OutDir 'boot-count.txt'
$before = if (Test-Path $bootFile) { [int](Get-Content $bootFile) } else { 0 }
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 5
  if ((Test-Path $bootFile) -and ([int](Get-Content $bootFile) -gt $before)) { break }
}
Write-Host "Piaskownica wstala po restarcie."

$run = 'powershell -NoProfile -Command "$p = Start-Process C:\Users\WDAGUtilityAccount\Desktop\DAM-Setup.exe -ArgumentList ''/VERYSILENT'',''/SUPPRESSMSGBOXES'',''/NORESTART'',''/LOG=C:\dam-results\install.log'' -PassThru -Wait; $p.ExitCode | Set-Content C:\dam-results\install-exit.txt"'
& $wsb exec --id $id -r ExistingLogin -c $run 2>&1 | Out-Null

$exitFile = Join-Path $OutDir 'install-exit.txt'
if (Test-Path $exitFile) {
  Write-Host ("Instalator zakonczyl sie kodem: {0}" -f (Get-Content $exitFile -Raw).Trim())
} else {
  Write-Host "Brak install-exit.txt - sprawdz C:\Temp\dam-sandbox-out\install.log"
}
Write-Host "Wyniki: $OutDir"
