#Requires -Version 5.1
<#
.SYNOPSIS
  Testy dla bin/scripts/ops/dam-cleanup-autostart.ps1. Bez Pester (nie ma go w tym srodowisku) -
  proste asercje PowerShell, exit 0 = wszystko OK, exit 1 = przynajmniej jeden blad.

.OPIS
  Dwie czesci:
  1) Testy jednostkowe: dot-source skryptu z -FunctionsOnly (definiuje funkcje, nie wykonuje
     glownej logiki) i wywolania bezposrednio na funkcjach. Pokrywaja liste z W4 "Gotowe":
     wpis w cudzyslowie zostaje, stary wpis usuwany, .git pomijany, DAM-repair/DAM-build
     pomijane, Adam.lnk nietykalny, zadanie na dysku sieciowym nietykalne, brak
     pg-config.code.dpapi obslugiwany bez wyjatku.
  2) Test integracyjny w piaskownicy (-RunSandbox): buduje pelne drzewo testowe pod
     work\2026-09-28\W4\tests-sandbox\ (NIGDY %TEMP%, NIGDY prawdziwy rejestr/Autostart/
     zadania/procesy tego komputera - patrz B3 B-1) i rejestr testowy pod
     HKCU:\Software\Inyfinn\DAM-test\Run-tests (tworzony i sprzatany przez ten test),
     uruchamia dam-cleanup-autostart.ps1 -Apply z parametrami piaskownicy, sprawdza wynik
     i SPRZATA po sobie (swoj wlasny klucz testowy i swoj wlasny folder scratch).

.EXAMPLE
  powershell -NoProfile -File dam-cleanup.Tests.ps1
  powershell -NoProfile -File dam-cleanup.Tests.ps1 -RunSandbox
#>
param(
  [switch]$RunSandbox
)

$ErrorActionPreference = "Stop"
$ScriptUnderTest = Join-Path $PSScriptRoot '..\dam-cleanup-autostart.ps1'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$WorkDir = Join-Path $RepoRoot 'work\2026-09-28\W4'

. $ScriptUnderTest -FunctionsOnly

$script:total = 0
$script:failed = 0
function Assert([bool]$cond, [string]$name) {
  $script:total++
  if ($cond) { Write-Host "PASS: $name" }
  else { Write-Host "FAIL: $name"; $script:failed++ }
}

Write-Host "=== Testy jednostkowe (funkcje z dam-cleanup-autostart.ps1) ==="

# 1) Wpis w cudzyslowie biezacej instalacji ZOSTAJE (naprawa bledu Keep() z 28.09 - KINGAUR).
$keepDir = 'C:\Users\test\AppData\Local\Programs\DAM'
$freshQuoted = '"C:\Users\test\AppData\Local\Programs\DAM\bin\runtime\win\python\pythonw.exe" "C:\Users\test\AppData\Local\Programs\DAM\bin\apps\desktop\local_bridge.py"'
Assert (Keep $freshQuoted $keepDir "Install") "wpis w cudzyslowie biezacej instalacji jest KEPT"

# 2) Wpis z innego (starego) korzenia jest usuwany.
$oldQuoted = '"C:\Old\Path\DAM\bin\runtime\win\python\pythonw.exe" "C:\Old\Path\DAM\bin\apps\desktop\local_bridge.py"'
Assert (-not (Keep $oldQuoted $keepDir "Install")) "wpis ze starego korzenia NIE jest kept"

# 3) .git w korzeniu/przodku wyklucza folder z kwarantanny.
$gitTestRoot = Join-Path $WorkDir 'tests-scratch\git-root'
New-Item -ItemType Directory -Force -Path (Join-Path $gitTestRoot '.git') | Out-Null
Assert (Test-HasGitAncestor $gitTestRoot) ".git w korzeniu wykryty"
Assert (Test-IsExcludedRoot -Path $gitTestRoot -AppDir 'C:\App' -LocalAppData (Join-Path $WorkDir 'tests-scratch\lad') -DriveTypeMap @{'C'=3}) "folder z .git wykluczony z kwarantanny"

# 4) DAM-repair / DAM-build wykluczone po nazwie (nawet z pelnym ukladem DAM).
$repairRoot = Join-Path $WorkDir 'tests-scratch\DAM-repair'
New-Item -ItemType Directory -Force -Path (Join-Path $repairRoot 'bin\apps\desktop') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $repairRoot 'bin\DATABASE') | Out-Null
Set-Content -LiteralPath (Join-Path $repairRoot 'DAM.exe') -Value 'x'
Assert (Test-IsDamRootLayout $repairRoot) "DAM-repair ma uklad DAM (przed wykluczeniem po nazwie)"
Assert (Test-IsExcludedRoot -Path $repairRoot -AppDir 'C:\App' -LocalAppData (Join-Path $WorkDir 'tests-scratch\lad') -DriveTypeMap @{'C'=3}) "DAM-repair wykluczony po nazwie"
$buildRoot = Join-Path $WorkDir 'tests-scratch\DAM-build'
New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null
Assert (Test-IsExcludedRoot -Path $buildRoot -AppDir 'C:\App' -LocalAppData (Join-Path $WorkDir 'tests-scratch\lad') -DriveTypeMap @{'C'=3}) "DAM-build wykluczony po nazwie"

# 5) "Adam.lnk" nietykalny (token nazwy, nie podciag).
Assert (-not (Test-NameHasDamToken 'Adam.lnk')) "Adam.lnk nie jest traktowany jak DAM"
Assert (-not (Test-NameHasDamToken 'Amsterdam-plan.lnk')) "Amsterdam-plan.lnk nie jest traktowany jak DAM"
Assert (Test-NameHasDamToken 'DAM-Bridge.lnk') "DAM-Bridge.lnk JEST rozpoznany jako DAM"

# 6) Zadanie na dysku sieciowym nigdy nie jest "brak pliku".
$fakeNet = @{ 'C' = 3; 'M' = 4 }
Assert (-not (Test-PathMissingButFixed 'M:\DAM\bin\scripts\ops\run.ps1' $fakeNet)) "plik na dysku sieciowym (M:) nigdy nie jest 'brak'"
Assert (-not (Test-PathMissingButFixed '\\serwer\udzial\DAM\run.ps1' $fakeNet)) "sciezka UNC nigdy nie jest 'brak'"
$missingFixed = Join-Path $WorkDir 'tests-scratch\brak-na-fixed.ps1'
Assert (Test-PathMissingButFixed $missingFixed $fakeNet) "faktycznie brakujacy plik na dysku Fixed (C:) JEST 'brak'"

# 7) Brak pg-config.code.dpapi obslugiwany bez wyjatku - kopiowane jest tylko to, co istnieje.
$oldRootAct = Join-Path $WorkDir 'tests-scratch\old-activation'
New-Item -ItemType Directory -Force -Path (Join-Path $oldRootAct 'bin\apps\desktop\data') | Out-Null
Set-Content -LiteralPath (Join-Path $oldRootAct 'bin\apps\desktop\data\pg-config.dpapi') -Value 'dpapi'
$appAct = Join-Path $WorkDir 'tests-scratch\app-activation'
$stateAct = Join-Path $WorkDir 'tests-scratch\state-activation'
$actResult = $null
$threw = $false
try { $actResult = Copy-DamActivationPair -OldRoot $oldRootAct -AppDir $appAct -StateDir $stateAct }
catch { $threw = $true }
Assert (-not $threw) "Copy-DamActivationPair nie rzuca wyjatku przy braku pg-config.code.dpapi"
Assert ($actResult.MissingSource -contains 'pg-config.code.dpapi') "brakujacy pg-config.code.dpapi zglaszany na liscie MissingSource"
Assert ($actResult.MissingSource -contains 'pg-config.sealed.used') "brakujacy pg-config.sealed.used zglaszany na liscie MissingSource"
Assert (Test-Path -LiteralPath (Join-Path $appAct 'bin\apps\desktop\data\pg-config.dpapi')) "istniejacy plik SKOPIOWANY do {app}"
Assert (Test-Path -LiteralPath (Join-Path $stateAct 'activation\pg-config.dpapi')) "istniejacy plik SKOPIOWANY do state\activation"

# 8) %LOCALAPPDATA%\DAM (i wszystko w nim) nigdy nie jest kandydatem do kwarantanny.
$fakeLad = Join-Path $WorkDir 'tests-scratch\lad2'
New-Item -ItemType Directory -Force -Path (Join-Path $fakeLad 'DAM\state\activation') | Out-Null
Assert (Test-IsExcludedRoot -Path (Join-Path $fakeLad 'DAM') -AppDir 'C:\App' -LocalAppData $fakeLad -DriveTypeMap @{'C'=3}) "%LOCALAPPDATA%\DAM sam jest wykluczony"
Assert (Test-IsExcludedRoot -Path (Join-Path $fakeLad 'DAM\state\activation') -AppDir 'C:\App' -LocalAppData $fakeLad -DriveTypeMap @{'C'=3}) "wnetrze %LOCALAPPDATA%\DAM jest wykluczone"

Write-Host "`n=== Podsumowanie jednostkowe: $($script:total - $script:failed)/$($script:total) OK ==="

if ($RunSandbox) {
  Write-Host "`n=== Test integracyjny w piaskownicy (-Apply, WYLACZNIE parametry piaskownicy) ==="
  # UWAGA: musi byc POZA repo (repo ma .git w korzeniu -> Test-HasGitAncestor wykluczylby
  # kazdy "stary folder" tutaj utworzony - to poprawne zachowanie skryptu, nie blad testu).
  $sbRoot = "D:\DAM-lokalne\testclients\w4-piaskownica\tests-ps1-run"
  $sbApp = Join-Path $sbRoot 'app'
  $sbOld = Join-Path $sbRoot 'old'
  $sbLad = Join-Path $sbRoot 'lad'
  $sbStartup = Join-Path $sbRoot 'startup'
  New-Item -ItemType Directory -Force -Path (Join-Path $sbApp 'bin\apps\desktop\data') | Out-Null
  Set-Content -LiteralPath (Join-Path $sbApp 'DAM.exe') -Value 'x'
  New-Item -ItemType Directory -Force -Path (Join-Path $sbOld 'bin\apps\desktop\data') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $sbOld 'bin\DATABASE') | Out-Null
  Set-Content -LiteralPath (Join-Path $sbOld 'DAM.exe') -Value 'x'
  Set-Content -LiteralPath (Join-Path $sbOld 'bin\apps\desktop\data\pg-config.dpapi') -Value 'd'
  Set-Content -LiteralPath (Join-Path $sbOld 'bin\apps\desktop\data\pg-config.code.dpapi') -Value 'c'
  New-Item -ItemType Directory -Force -Path $sbStartup | Out-Null
  $sbTasksJson = Join-Path $sbRoot 'tasks.json'
  @(@{ TaskName = "DAM-TestTask"; TaskPath = "\"; Actions = @(@{ Execute = (Join-Path $sbRoot 'nieistnieje\bin\scripts\ops\x.ps1'); Arguments = "" }) }) |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $sbTasksJson -Encoding UTF8

  $regRootTest = "HKCU:\Software\Inyfinn\DAM-test\Run-tests"
  New-Item -Path $regRootTest -Force | Out-Null
  New-ItemProperty -Path $regRootTest -Name "DAM-Bridge" -Value ('"' + (Join-Path $sbApp 'bin\runtime\win\python\pythonw.exe') + '" "' + (Join-Path $sbApp 'bin\apps\desktop\local_bridge.py') + '"') -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $regRootTest -Name "DAM-Old" -Value ('"' + (Join-Path $sbOld 'bin\runtime\win\python\pythonw.exe') + '" "' + (Join-Path $sbOld 'bin\apps\desktop\local_bridge.py') + '"') -PropertyType String -Force | Out-Null

  try {
    & powershell -NoProfile -File $ScriptUnderTest -Apply -Mode Install -Phase Clean -KeepDir $sbApp `
      -RegRoot $regRootTest -StartupDir $sbStartup -LocalAppDataDir $sbLad -TasksJson $sbTasksJson | Out-Host
    $rc = $LASTEXITCODE
    Assert ($rc -eq 0) "skrypt w piaskownicy konczy sie kodem 0"

    $freshVal = (Get-ItemProperty -LiteralPath $regRootTest -Name 'DAM-Bridge' -ErrorAction SilentlyContinue).'DAM-Bridge'
    Assert ([bool]$freshVal) "swiezy wpis DAM-Bridge PRZETRWAL w piaskownicy"
    $oldVal = (Get-ItemProperty -LiteralPath $regRootTest -Name 'DAM-Old' -ErrorAction SilentlyContinue).'DAM-Old'
    Assert (-not $oldVal) "stary wpis DAM-Old ZNIKNAL w piaskownicy"
    Assert (-not (Test-Path -LiteralPath $sbOld)) "stary folder zostal wyslany do kosza/kwarantanny"
    Assert (Test-Path -LiteralPath (Join-Path $sbApp 'bin\apps\desktop\data\pg-config.dpapi')) "aktywacja skopiowana do {app} w piaskownicy"
  } finally {
    if (Test-Path -LiteralPath $regRootTest) { Remove-Item -LiteralPath $regRootTest -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

Write-Host "`n=== WYNIK KONCOWY: $($script:total - $script:failed)/$($script:total) ==="
if ($script:failed -gt 0) { exit 1 } else { exit 0 }
