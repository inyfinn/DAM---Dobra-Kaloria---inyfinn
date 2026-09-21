# Uruchamiane w piaskownicy przy logowaniu. Nic nie wylacza - przygotowuje pulpit i raportuje stan.
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force -Path C:\dam-results | Out-Null
$desktop = 'C:\Users\WDAGUtilityAccount\Desktop'

# instalator na lokalny dysk piaskownicy (z mapowanego folderu tylko do odczytu)
$src = Join-Path 'C:\dam-setup' 'DAM-Setup.exe'
if (Test-Path $src) { Copy-Item $src (Join-Path $desktop 'DAM-Setup.exe') -Force }

$sac = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy' -ErrorAction SilentlyContinue).VerifiedAndReputablePolicyState
$boot = 0
if (Test-Path C:\dam-results\boot-count.txt) { $boot = [int](Get-Content C:\dam-results\boot-count.txt) }
$boot++
Set-Content C:\dam-results\boot-count.txt $boot

[ordered]@{
  when  = (Get-Date).ToString('s')
  boot  = $boot
  sac   = $sac
  setup = Test-Path (Join-Path $desktop 'DAM-Setup.exe')
} | ConvertTo-Json | Set-Content C:\dam-results\stan.json -Encoding UTF8

$txt = @"
TEST INSTALATORA DAM W PIASKOWNICY

Stan teraz: Smart App Control = $sac   (1 = wlaczony i blokuje niepodpisane pliki, 0 = wylaczony)
Rozruch nr: $boot

Jesli SAC = 1, instalator sie nie uruchomi. Kolejnosc:

  1. Zabezpieczenia Windows -> Kontrola aplikacji i przegladarki -> Inteligentna kontrola aplikacji -> Wylacz
     (to ustawienie tej jednorazowej maszyny - piaskownica znika po zamknieciu)
  2. Restart tego goscia: w PowerShell wpisz  shutdown /r /t 0
     Piaskownica przezywa restart, pliki i rejestr zostaja. Restart jest konieczny -
     polityka App Control laduje sie przy starcie systemu i bez niego zmiana nie dziala.
  3. Po ponownym rozruchu ten plik pokaze SAC = 0, a DAM-Setup.exe z Pulpitu ruszy normalnie.

Wyniki i logi pisz do C:\dam-results (to folder C:\Temp\dam-sandbox-out na hoscie).
"@
Set-Content -Path (Join-Path $desktop 'CZYTAJ-MNIE.txt') -Value $txt -Encoding UTF8
Start-Process notepad.exe (Join-Path $desktop 'CZYTAJ-MNIE.txt')
