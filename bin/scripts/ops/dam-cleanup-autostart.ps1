#Requires -Version 5.1
<#
.SYNOPSIS
  Sprzata po starych instalacjach DAM: autostart (Run/RunOnce, zadania, skroty),
  procesy w tle i stare foldery instalacji (kosz Windows, z odwracalna rezerwa).
  TYLKO rzeczy DAM, nic innego.

.OPIS
  2026-09-28: komputer KINGAUR mial DAM, ktorego nikt nie otwieral od 24.09, a most
  (pythonw local_bridge.py z autostartu HKCU\...\Run\DAM-Bridge) co rano sam startowal
  i zapisywal do wspolnej bazy dane ze skanu, ktory przyszedl w starym instalatorze.
  Poprzednia wersja tego skryptu miala blad blokujacy: Keep() porownywala CALE polecenie
  (z cudzyslowem na poczatku) z -KeepDir przez StartsWith, wiec swiezy wpis DAM-Bridge
  ("C:\...\pythonw.exe" "...local_bridge.py") nigdy nie byl rozpoznany jako "wlasny" i byl
  kasowany zaraz po zapisaniu - a swiezo uruchomiony DAM (ssPostInstall) zabijany.
  Naprawa: Keep() wyciaga folder DAM z polecenia (Get-DamRootFromCmd, ktory juz zdejmuje
  cudzyslowy) i porownuje FOLDER, nie caly tekst polecenia.

  Wlasciciel (28.09, DECYZJE.md sekcja 8 pkt 4): stare foldery DAM (inne niz {app}) ida
  do KOSZA WINDOWS (odwracalne), nie tylko rozbrojenie. Deinstalacja usuwa swoje foldery.
  Nowa instalacja nie moze nakladac sie na stare pliki starej instalacji.

  Piaskownica (B3 B-1, BLOKUJACE): -Apply poza instalatorem (bez -Installer) na PRAWDZIWYM
  systemie tego komputera jest zabronione. Wymaga -RegRoot, -StartupDir, -LocalAppData,
  -TasksJson; zatrzymywanie procesow tylko dla PID-ow z -OnlyPids. Bez tych parametrow
  -Apply konczy sie kodem <> 0 (odmowa), chyba ze podano -Installer (wywolanie z Inno,
  ktore dziala na prawdziwym systemie uzytkownika - to jest jego wlasciwe zadanie).

  Co uznajemy za uklad DAM (proces/autostart):
  - polecenie zawiera \bin\apps\desktop\ , \bin\apps\web\scripts\ (obserwator indeksu,
    build-*.py) albo \bin\scripts\ops\ ;
  - DAM.exe / dam-appw.exe w folderze z bin\apps\desktop (albo folder juz nie istnieje,
    a nazwa wpisu to token "DAM", nie np. "Adam"/"Amsterdam").

  Co uznajemy za "stary folder DAM" (do kosza, B1 pkt 2 - wszystkie warunki naraz):
  - ma bin\ ORAZ (DAM.exe albo unins*.exe albo bin\apps\desktop\) ORAZ co najmniej jedno
    z bin\apps\desktop\data, bin\DATABASE, bin\runtime\win\python, bin\PAMIEC-PODRECZNA;
  - NIGDY: .git w korzeniu albo w ktoryms przodku (repo dewelopera), %LOCALAPPDATA%\DAM
    i wszystko w nim, {app}/-KeepDir, korzen dysku/profil/Windows/ProgramData, dysk
    nie-Fixed (sieciowy/RaiDrive), junction/symlink, "DAM-repair", "DAM-build" (po nazwie).

.PARAMETER Phase
  Stop  - tylko zatrzymanie procesow DAM (przed nadpisaniem plikow).
  Clean - autostart + stare foldery (kosz/kwarantanna) + aktywacja.
  All   - Stop + Clean (domyslnie).

.PARAMETER Mode
  Install   - po instalacji/aktualizacji: zostaw wpisy/procesy z -KeepDir.
  Uninstall - przy odinstalowaniu: usun takze wpisy/procesy z -KeepDir.
  Manual    - reczne uruchomienie (jak Install).

.PARAMETER Apply
  Bez tego tylko wypisuje, co by zrobil (na sucho, domyslnie).

.PARAMETER Installer
  Skrypt wywolany przez Inno Setup (PrepareToInstall / ssInstall / usUninstall) -
  dziala na prawdziwym systemie uzytkownika. Bez tego przelacznika -Apply wymaga
  parametrow piaskownicy (patrz wyzej) i bez nich odmawia.

.PARAMETER RegRoot
  Piaskownica: JEDEN klucz rejestru uzywany zamiast prawdziwych
  HKCU/HKLM ...\Run i \RunOnce (tworzony i sprzatany przez test).

.PARAMETER StartupDir, LocalAppDataDir, ProgramFilesDir
  Piaskownica: foldery uzywane zamiast prawdziwego folderu Autostart,
  prawdziwego %LOCALAPPDATA% i prawdziwego {autopf}.

.PARAMETER TasksJson
  Piaskownica: plik JSON z atrapami zadan harmonogramu (zamiast Get-ScheduledTask).

.PARAMETER OnlyPids
  Piaskownica: Stop-Process tylko dla podanych PID-ow (nigdy realnej listy procesow).

.EXAMPLE
  powershell -NoProfile -File dam-cleanup-autostart.ps1
  powershell -NoProfile -File dam-cleanup-autostart.ps1 -Installer -Apply -Mode Install -KeepDir "C:\DAM"
  powershell -NoProfile -File dam-cleanup-autostart.ps1 -Apply -RegRoot HKCU:\Software\Inyfinn\DAM-test\Run -StartupDir D:\sandbox\startup -LocalAppDataDir D:\sandbox\lad -TasksJson D:\sandbox\tasks.json
#>
[CmdletBinding()]
param(
  [ValidateSet("Stop", "Clean", "All")]
  [string]$Phase = "All",
  [ValidateSet("Install", "Uninstall", "Manual")]
  [string]$Mode = "Manual",
  [string]$KeepDir = "",
  [switch]$Apply,
  [switch]$SelfTest,
  [switch]$FunctionsOnly,
  [switch]$Installer,
  [string]$RegRoot = "",
  [string]$StartupDir = "",
  [string]$LocalAppDataDir = "",
  [string]$ProgramFilesDir = "",
  [string]$TasksJson = "",
  [int[]]$OnlyPids = @(),
  [string]$StateDirOverride = "",
  [string[]]$DriveTypeFake = @(),  # piaskownica SelfTest: "Z=4" (4=Network) itp.
  [string]$DoneFile = "",         # Inno PrepareToInstall: plik-znacznik zapisywany na koncu (ewNoWait + limit czasu)
  [string]$ScratchDir = ""        # SelfTest: folder na tymczasowe pliki testowe (NIGDY %TEMP% - zasada "pliki DAM tylko w work")
)

$ErrorActionPreference = "Continue"

# ---------------------------------------------------------------------------
# Pomocnicze: normalizacja, wyciaganie sciezek z polecen
# ---------------------------------------------------------------------------

function Normalize-Cmd([string]$s) {
  if (-not $s) { return "" }
  return ($s -replace '/', '\').ToLowerInvariant()
}

function Get-CmdExe([string]$cmd) {
  if (-not $cmd) { return "" }
  $c = $cmd.Trim()
  if ($c.StartsWith('"')) {
    $end = $c.IndexOf('"', 1)
    if ($end -gt 1) { return $c.Substring(1, $end - 1) }
  }
  $sp = $c.IndexOf(' ')
  if ($sp -gt 0) { return $c.Substring(0, $sp) }
  return $c
}

# Folder instalacji DAM wyliczony z polecenia: wszystko przed pierwszym \bin\.
function Get-DamRootFromCmd([string]$cmd) {
  if (-not $cmd) { return "" }
  $raw = ([string]$cmd -replace '/', '\')
  $n = $raw.ToLowerInvariant()
  $i = $n.IndexOf('\bin\')
  if ($i -gt 0) {
    $start = 0
    if ($raw.TrimStart().StartsWith('"')) { $start = $raw.IndexOf('"') + 1 }
    if ($i -gt $start) { return $raw.Substring($start, $i - $start).Trim('"', ' ') }
  }
  $exe = Get-CmdExe $cmd
  if ($exe) { return (Split-Path -Parent $exe) }
  return ""
}

function Test-NameHasDamToken([string]$name) {
  if (-not $name) { return $false }
  $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
  $tokens = $base -split '[^a-zA-Z0-9]+'
  foreach ($t in $tokens) { if ($t -and ($t -ieq 'dam')) { return $true } }
  return $false
}

function Test-IsDamAutostart([string]$name, [string]$cmd) {
  $n = Normalize-Cmd $cmd
  if (-not $n) { return $false }
  foreach ($m in @('\bin\apps\desktop\', '\bin\apps\web\scripts\', '\bin\scripts\ops\')) {
    if ($n.Contains($m)) { return $true }
  }
  $exe = Get-CmdExe $cmd
  $leaf = [System.IO.Path]::GetFileName($exe).ToLowerInvariant()
  if ($leaf -eq 'dam.exe' -or $leaf -eq 'dam-appw.exe') {
    $dir = Split-Path -Parent $exe
    if ($dir -and (Test-Path -LiteralPath (Join-Path $dir 'bin\apps\desktop'))) { return $true }
    # Folder juz nie istnieje (odinstalowany recznie) - tylko gdy nazwa wpisu to slowo "DAM".
    if ($dir -and -not (Test-Path -LiteralPath $dir) -and (Test-NameHasDamToken $name)) { return $true }
  }
  return $false
}

function Test-UnderDir([string]$path, [string]$dir) {
  if (-not $path -or -not $dir) { return $false }
  $p = (Normalize-Cmd $path).TrimEnd('\') + '\'
  $d = (Normalize-Cmd $dir).TrimEnd('\') + '\'
  return $p.StartsWith($d)
}

function Test-SamePath([string]$a, [string]$b) {
  if (-not $a -or -not $b) { return $false }
  return ((Normalize-Cmd $a).TrimEnd('\')) -eq ((Normalize-Cmd $b).TrimEnd('\'))
}

# Naprawiony Keep(): wyciaga FOLDER z polecenia (Get-DamRootFromCmd juz zdejmuje cudzyslowy),
# nie porownuje calego tekstu polecenia. To naprawia blad z KINGAUR (28.09): wpis w cudzyslowie
# "C:\...\pythonw.exe" "...\local_bridge.py" nie zaczynal sie tekstem KeepDir -> byl kasowany.
function Keep([string]$cmd, [string]$keepDir, [string]$mode) {
  if ($mode -eq "Uninstall") { return $false }
  if (-not $keepDir) { return $false }
  $root = Get-DamRootFromCmd $cmd
  if ($root -and (Test-UnderDir $root $keepDir)) { return $true }
  $exe = Get-CmdExe $cmd
  return (Test-UnderDir $exe $keepDir)
}

# ---------------------------------------------------------------------------
# Wykluczenia i klasyfikacja "starego folderu DAM" (B1 pkt 2)
# ---------------------------------------------------------------------------

function Test-HasGitAncestor([string]$path) {
  if (-not $path) { return $false }
  $cur = $path.TrimEnd('\')
  $guard = 0
  while ($cur -and $guard -lt 64) {
    $guard++
    if ((Test-Path -LiteralPath (Join-Path $cur '.git'))) { return $true }
    $parent = Split-Path -Parent $cur
    if (-not $parent -or $parent -eq $cur) { break }
    $cur = $parent
  }
  return $false
}

function Get-DriveTypeFor([string]$path, [hashtable]$fakeMap) {
  if (-not $path) { return $null }
  $m = [regex]::Match($path, '^([A-Za-z]):')
  if (-not $m.Success) { return $null }
  $letter = $m.Groups[1].Value.ToUpperInvariant()
  if ($fakeMap -and $fakeMap.ContainsKey($letter)) { return [int]$fakeMap[$letter] }
  try {
    $ld = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$letter`:'" -ErrorAction Stop
    if ($ld) { return [int]$ld.DriveType }
  } catch {}
  return $null
}

# DriveType: 2=Removable 3=Fixed 4=Network 5=CD. RaiDrive/UNC/nieznany -> traktuj jako NIE-Fixed
# (bezpieczna strona: wolimy pominac niz ruszyc dysk sieciowy).
function Test-IsFixedDrive([string]$path, [hashtable]$fakeMap) {
  $dt = Get-DriveTypeFor $path $fakeMap
  if ($null -eq $dt) { return $false }
  return ($dt -eq 3)
}

# "Zadanie z plikiem na dysku sieciowym nigdy nie jest <brak pliku>" - UNC i dyski nie-Fixed
# (a takze dysk nierozpoznany, np. RaiDrive w trybie offline) NIGDY nie licza sie jako "brak".
function Test-PathMissingButFixed([string]$path, [hashtable]$fakeMap) {
  if (-not $path) { return $false }
  if ($path.StartsWith('\\')) { return $false }
  if (-not (Test-IsFixedDrive $path $fakeMap)) { return $false }
  return -not (Test-Path -LiteralPath $path)
}

function Test-IsExcludedRoot {
  param(
    [string]$Path,
    [string]$AppDir,
    [string]$LocalAppData,
    [hashtable]$DriveTypeMap
  )
  if (-not $Path) { return $true }
  $norm = (Normalize-Cmd $Path).TrimEnd('\')
  if ($norm -match '^[a-z]:$') { return $true }                       # korzen dysku
  if ($norm -match '^[a-z]:\\$') { return $true }
  if (Test-HasGitAncestor $Path) { return $true }                     # repo dewelopera
  $damLocal = Join-Path $LocalAppData 'DAM'
  if (Test-SamePath $Path $damLocal) { return $true }                 # %LOCALAPPDATA%\DAM sam
  if (Test-UnderDir $Path $damLocal) { return $true }                 # ...i wszystko w nim
  if ($AppDir -and (Test-SamePath $Path $AppDir)) { return $true }    # {app} / -KeepDir
  $leaf = Split-Path -Leaf $Path
  if ($leaf -ieq 'DAM-repair' -or $leaf -ieq 'DAM-build') { return $true }
  $u = $norm
  $profileDir = if ($env:USERPROFILE) { (Normalize-Cmd $env:USERPROFILE).TrimEnd('\') } else { "" }
  $winDir = if ($env:WINDIR) { (Normalize-Cmd $env:WINDIR).TrimEnd('\') } else { "" }
  foreach ($sys in @($profileDir, $winDir, 'c:\programdata', (Normalize-Cmd $LocalAppData).TrimEnd('\'))) {
    if ($sys -and $u -eq $sys) { return $true }
  }
  if (-not (Test-IsFixedDrive $Path $DriveTypeMap)) { return $true }   # dysk nie-Fixed
  try {
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if ($item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $true }
  } catch {}
  return $false
}

function Test-IsDamRootLayout([string]$Path) {
  if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Container)) { return $false }
  $binDir = Join-Path $Path 'bin'
  if (-not (Test-Path -LiteralPath $binDir -PathType Container)) { return $false }
  $hasExeOrDesktop = $false
  if (Test-Path -LiteralPath (Join-Path $Path 'DAM.exe')) { $hasExeOrDesktop = $true }
  if (-not $hasExeOrDesktop) {
    $unins = Get-ChildItem -LiteralPath $Path -Filter 'unins*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($unins) { $hasExeOrDesktop = $true }
  }
  if (-not $hasExeOrDesktop -and (Test-Path -LiteralPath (Join-Path $binDir 'apps\desktop'))) { $hasExeOrDesktop = $true }
  if (-not $hasExeOrDesktop) { return $false }
  $hasDataMarker =
    (Test-Path -LiteralPath (Join-Path $binDir 'apps\desktop\data')) -or
    (Test-Path -LiteralPath (Join-Path $binDir 'DATABASE')) -or
    (Test-Path -LiteralPath (Join-Path $binDir 'runtime\win\python')) -or
    (Test-Path -LiteralPath (Join-Path $binDir 'PAMIEC-PODRECZNA'))
  return $hasDataMarker
}

# ---------------------------------------------------------------------------
# Aktywacja: kopia pary pg-config.* (nigdy przeniesienie), brakujacy plik = pominiecie, nie blad.
# ---------------------------------------------------------------------------

function Copy-DamActivationPair {
  param(
    [string]$OldRoot,
    [string]$AppDir,
    [string]$StateDir,
    [switch]$WhatIfOnly
  )
  $names = @('pg-config.dpapi', 'pg-config.code.dpapi', 'pg-config.sealed.used')
  $srcDir = Join-Path $OldRoot 'bin\apps\desktop\data'
  $result = [ordered]@{ CopiedToApp = @(); CopiedToState = @(); MissingSource = @(); Errors = @() }
  foreach ($n in $names) {
    $src = Join-Path $srcDir $n
    if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { $result.MissingSource += $n; continue }
    $appDest = if ($AppDir) { Join-Path (Join-Path $AppDir 'bin\apps\desktop\data') $n } else { "" }
    $stateDest = if ($StateDir) { Join-Path (Join-Path $StateDir 'activation') $n } else { "" }
    if ($AppDir -and $appDest -and -not (Test-Path -LiteralPath $appDest)) {
      if (-not $WhatIfOnly) {
        try {
          New-Item -ItemType Directory -Force -Path (Split-Path -Parent $appDest) -ErrorAction Stop | Out-Null
          Copy-Item -LiteralPath $src -Destination $appDest -Force -ErrorAction Stop
        } catch { $result.Errors += "app:$n $($_.Exception.Message)" }
      }
      $result.CopiedToApp += $n
    }
    if ($StateDir -and $stateDest -and -not (Test-Path -LiteralPath $stateDest)) {
      if (-not $WhatIfOnly) {
        try {
          New-Item -ItemType Directory -Force -Path (Split-Path -Parent $stateDest) -ErrorAction Stop | Out-Null
          Copy-Item -LiteralPath $src -Destination $stateDest -Force -ErrorAction Stop
        } catch { $result.Errors += "state:$n $($_.Exception.Message)" }
      }
      $result.CopiedToState += $n
    }
  }
  return $result
}

# ---------------------------------------------------------------------------
# Kosz Windows (odwracalne) + rezerwa: zmiana nazwy na tym samym dysku do kosz\<data>\<nazwa>
# ---------------------------------------------------------------------------

function Send-DamRootToRecycleBinOrKosz {
  param(
    [string]$Path,
    [string]$KoszRoot,
    [switch]$WhatIfOnly
  )
  if ($WhatIfOnly) { return [ordered]@{ Ok = $true; Method = "na sucho" } }
  try {
    Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction Stop
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory(
      $Path,
      [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
      [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin,
      [Microsoft.VisualBasic.FileIO.UICancelOption]::DoNothing
    )
    if (-not (Test-Path -LiteralPath $Path)) {
      return [ordered]@{ Ok = $true; Method = "KoszWindows" }
    }
    throw "folder nadal istnieje po DeleteDirectory"
  } catch {
    $firstErr = $_.Exception.Message
    try {
      $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
      $name = Split-Path -Leaf $Path
      $destDir = Join-Path $KoszRoot $stamp
      $dest = Join-Path $destDir $name
      New-Item -ItemType Directory -Force -Path $destDir -ErrorAction Stop | Out-Null
      Move-Item -LiteralPath $Path -Destination $dest -Force -ErrorAction Stop
      $manifestPath = Join-Path $KoszRoot 'MANIFEST.txt'
      $line = "{0}`t{1}`t{2}`t(kosz Windows nieudany: {3})" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Path, $dest, $firstErr
      Add-Content -LiteralPath $manifestPath -Value $line -Encoding UTF8
      return [ordered]@{ Ok = $true; Method = "RenameKosz"; Dest = $dest; RecycleBinError = $firstErr }
    } catch {
      return [ordered]@{ Ok = $false; Method = "Zaden"; RecycleBinError = $firstErr; RenameError = $_.Exception.Message }
    }
  }
}

# ---------------------------------------------------------------------------
# Zadania harmonogramu: prawdziwe (Get-ScheduledTask) albo atrapy z -TasksJson (piaskownica)
# ---------------------------------------------------------------------------

function Get-DamTaskCandidates([string]$tasksJsonPath) {
  if ($tasksJsonPath) {
    if (-not (Test-Path -LiteralPath $tasksJsonPath)) { return @() }
    try {
      $raw = Get-Content -LiteralPath $tasksJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
      return @($raw)
    } catch { return @() }
  }
  try { return @(Get-ScheduledTask -TaskName 'DAM-*' -ErrorAction SilentlyContinue) } catch { return @() }
}

# ---------------------------------------------------------------------------
# Log
# ---------------------------------------------------------------------------

$script:LogFile = $null
function Init-Log([string]$localAppData) {
  $logDir = Join-Path $localAppData "DAM\logs"
  try { New-Item -ItemType Directory -Force -Path $logDir -ErrorAction Stop | Out-Null } catch {}
  $script:LogFile = Join-Path $logDir ("cleanup-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))
}
function Log([string]$msg) {
  $tag = if ($Apply) { "" } else { ",na sucho" }
  $line = "{0} [{1}{2}] {3}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Mode, $tag, $msg
  Write-Host $line
  if ($script:LogFile) {
    try { Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8 } catch {}
  }
}

if ($FunctionsOnly) { return }

# ---------------------------------------------------------------------------
# SelfTest: czysta logika, bez rejestru/dysku/procesow (poza tymczasowymi plikami testowymi
# w folderze podanym przez wywolujacego - patrz dam-cleanup.Tests.ps1).
# ---------------------------------------------------------------------------
if ($SelfTest) {
  $fail = 0
  function Assert([bool]$cond, [string]$msg) {
    if (-not $cond) { Write-Host "FAIL: $msg"; $script:fail++ } else { Write-Host "ok: $msg" }
  }
  # Pliki testowe DAM tylko w work\ (nigdy %TEMP%, nigdy AppData\Local\DAM-repair) - zasada z pamieci.
  $tmp = if ($ScratchDir) { $ScratchDir } else {
    try { Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path 'work\2026-09-28\W4\selftest-scratch' }
    catch { Join-Path $PSScriptRoot 'selftest-scratch' }
  }
  New-Item -ItemType Directory -Force -Path $tmp -ErrorAction SilentlyContinue | Out-Null

  # --- Test-IsDamAutostart ---
  $cases = @(
    @('DAM-Bridge', '"C:\Users\k\AppData\Local\Programs\DAM\bin\runtime\win\python\pythonw.exe" "C:\Users\k\AppData\Local\Programs\DAM\bin\apps\desktop\local_bridge.py"', $true),
    @('DAM', 'C:/X/DAM/bin/apps/desktop/launch.py', $true),
    @('OneDrive', '"C:\Program Files\Microsoft OneDrive\OneDrive.exe" /background', $false),
    @('Python tool', 'C:\Python312\pythonw.exe C:\tools\local_bridge_other.py', $false),
    @('DAM-old', '"C:\Nie\Istnieje\DAM.exe"', $true),
    @('Damian', '"C:\Nie\Istnieje\DAM.exe"', $false),
    @('Something', '"C:\Nie\Istnieje\DAM.exe"', $false),
    @('Watcher', 'C:\DAM\bin\apps\web\scripts\watch-file-index.py', $true),
    @('Ops', 'C:\DAM\bin\scripts\ops\dam-cleanup-autostart.ps1', $true)
  )
  foreach ($c in $cases) {
    $got = Test-IsDamAutostart $c[0] $c[1]
    Assert ($got -eq $c[2]) "Test-IsDamAutostart('$($c[0])') = $got (oczekiwane $($c[2]))"
  }

  # --- Get-DamRootFromCmd ---
  $root = Get-DamRootFromCmd '"C:\Users\k\AppData\Local\Programs\DAM\bin\runtime\win\python\pythonw.exe" "x"'
  Assert ($root -eq 'C:\Users\k\AppData\Local\Programs\DAM') "Get-DamRootFromCmd root='$root'"

  # --- Test-UnderDir ---
  Assert (Test-UnderDir 'C:\A\DAM\bin\x.py' 'c:\a\dam') "Test-UnderDir prefiks"
  Assert (-not (Test-UnderDir 'C:\A\DAM2\bin\x.py' 'c:\a\dam')) "Test-UnderDir bez fałszywego prefiksu (DAM2)"

  # --- Keep() - NAPRAWIONY BLAD (wpis w cudzyslowie musi zostac dla biezacej instalacji) ---
  $keepDir = 'C:\Users\k\AppData\Local\Programs\DAM'
  $freshCmd = '"C:\Users\k\AppData\Local\Programs\DAM\bin\runtime\win\python\pythonw.exe" "C:\Users\k\AppData\Local\Programs\DAM\bin\apps\desktop\local_bridge.py"'
  Assert (Keep $freshCmd $keepDir "Install") "Keep(): swiezy wpis w cudzyslowie ZOSTAJE (naprawa bledu KINGAUR)"
  $oldCmd = '"C:\Old\DAM\bin\runtime\win\python\pythonw.exe" "C:\Old\DAM\bin\apps\desktop\local_bridge.py"'
  Assert (-not (Keep $oldCmd $keepDir "Install")) "Keep(): wpis z innego (starego) korzenia jest usuwany"
  Assert (-not (Keep $freshCmd $keepDir "Uninstall")) "Keep(): w trybie Uninstall nic nie jest chronione"

  # --- Test-NameHasDamToken (Adam.lnk nietykalny) ---
  Assert (-not (Test-NameHasDamToken 'Adam.lnk')) "Test-NameHasDamToken('Adam.lnk') = false"
  Assert (-not (Test-NameHasDamToken 'Amsterdam.lnk')) "Test-NameHasDamToken('Amsterdam.lnk') = false"
  Assert (Test-NameHasDamToken 'DAM.lnk') "Test-NameHasDamToken('DAM.lnk') = true"
  Assert (Test-NameHasDamToken 'DAM-Bridge.lnk') "Test-NameHasDamToken('DAM-Bridge.lnk') = true"

  # --- .git przodek ---
  $tmpGit = Join-Path $tmp ("dam-selftest-git-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path (Join-Path $tmpGit '.git') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $tmpGit 'sub\dir') | Out-Null
  Assert (Test-HasGitAncestor (Join-Path $tmpGit 'sub\dir')) "Test-HasGitAncestor wykrywa .git w przodku"
  Assert (-not (Test-HasGitAncestor $env:WINDIR)) "Test-HasGitAncestor: TEMP bez .git = false"
  Remove-Item -LiteralPath $tmpGit -Recurse -Force -ErrorAction SilentlyContinue

  # --- Test-IsExcludedRoot: DAM-repair / DAM-build / %LOCALAPPDATA%\DAM / {app} ---
  $lad = Join-Path $tmp ("dam-selftest-lad-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path (Join-Path $lad 'DAM\state') | Out-Null
  $fakeDrives = @{ 'C' = 3 }
  Assert (Test-IsExcludedRoot -Path (Join-Path $lad 'DAM') -AppDir 'C:\App' -LocalAppData $lad -DriveTypeMap $fakeDrives) "wykluczone: %LOCALAPPDATA%\DAM sam"
  Assert (Test-IsExcludedRoot -Path (Join-Path $lad 'DAM\state') -AppDir 'C:\App' -LocalAppData $lad -DriveTypeMap $fakeDrives) "wykluczone: wnetrze %LOCALAPPDATA%\DAM"
  Assert (Test-IsExcludedRoot -Path 'C:\Users\x\DAM-repair' -AppDir 'C:\App' -LocalAppData $lad -DriveTypeMap $fakeDrives) "wykluczone: DAM-repair (nazwa)"
  Assert (Test-IsExcludedRoot -Path 'C:\Users\x\DAM-build' -AppDir 'C:\App' -LocalAppData $lad -DriveTypeMap $fakeDrives) "wykluczone: DAM-build (nazwa)"
  Assert (Test-IsExcludedRoot -Path 'C:\App' -AppDir 'C:\App' -LocalAppData $lad -DriveTypeMap $fakeDrives) "wykluczone: {app} sam"
  Assert (-not (Test-IsExcludedRoot -Path 'C:\Users\x\DAM-old' -AppDir 'C:\App' -LocalAppData $lad -DriveTypeMap $fakeDrives)) "NIE wykluczone: zwykly stary folder DAM na dysku Fixed"
  $fakeDrivesNetwork = @{ 'C' = 3; 'M' = 4 }
  Assert (Test-IsExcludedRoot -Path 'M:\DAM' -AppDir 'C:\App' -LocalAppData $lad -DriveTypeMap $fakeDrivesNetwork) "wykluczone: dysk nie-Fixed (M: sieciowy)"
  Remove-Item -LiteralPath $lad -Recurse -Force -ErrorAction SilentlyContinue

  # --- zadanie na dysku sieciowym nigdy nie jest "brak pliku" ---
  Assert (-not (Test-PathMissingButFixed 'M:\DAM\bin\scripts\ops\run.ps1' $fakeDrivesNetwork)) "task na M: (sieciowy) nigdy nie jest 'brak'"
  Assert (-not (Test-PathMissingButFixed '\\serwer\udzial\DAM\run.ps1' $fakeDrivesNetwork)) "task UNC nigdy nie jest 'brak'"
  $missingLocal = Join-Path $tmp ("dam-selftest-brak-" + [Guid]::NewGuid().ToString('N') + '.ps1')
  Assert (Test-PathMissingButFixed $missingLocal $fakeDrivesNetwork) "task na C: (Fixed) faktycznie brakujacy = true"

  # --- Copy-DamActivationPair: brak pg-config.code.dpapi obslugiwany bez wyjatku ---
  $oldRoot = Join-Path $tmp ("dam-selftest-old-" + [Guid]::NewGuid().ToString('N'))
  $appDir = Join-Path $tmp ("dam-selftest-app-" + [Guid]::NewGuid().ToString('N'))
  $stateDir = Join-Path $tmp ("dam-selftest-state-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path (Join-Path $oldRoot 'bin\apps\desktop\data') | Out-Null
  Set-Content -LiteralPath (Join-Path $oldRoot 'bin\apps\desktop\data\pg-config.dpapi') -Value 'x' -Encoding UTF8
  # celowo BRAK pg-config.code.dpapi
  $r = Copy-DamActivationPair -OldRoot $oldRoot -AppDir $appDir -StateDir $stateDir
  Assert ($r.MissingSource -contains 'pg-config.code.dpapi') "Copy-DamActivationPair: brakujacy plik zglaszany, nie wyjatek"
  Assert ($r.CopiedToApp -contains 'pg-config.dpapi') "Copy-DamActivationPair: istniejacy plik kopiowany do {app}"
  Assert (Test-Path -LiteralPath (Join-Path $appDir 'bin\apps\desktop\data\pg-config.dpapi')) "Copy-DamActivationPair: plik faktycznie na dysku w {app}"
  Assert (Test-Path -LiteralPath (Join-Path $stateDir 'activation\pg-config.dpapi')) "Copy-DamActivationPair: plik faktycznie na dysku w state\activation"
  # drugi przebieg: juz jest -> nie dubluje listy "Copied"
  $r2 = Copy-DamActivationPair -OldRoot $oldRoot -AppDir $appDir -StateDir $stateDir
  Assert ($r2.CopiedToApp.Count -eq 0) "Copy-DamActivationPair: idempotentne (drugi raz nic nie kopiuje)"
  Remove-Item -LiteralPath $oldRoot, $appDir, $stateDir -Recurse -Force -ErrorAction SilentlyContinue

  # --- Test-IsDamRootLayout ---
  $layoutRoot = Join-Path $tmp ("dam-selftest-layout-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path (Join-Path $layoutRoot 'bin\apps\desktop\data') | Out-Null
  Set-Content -LiteralPath (Join-Path $layoutRoot 'DAM.exe') -Value 'x'
  Assert (Test-IsDamRootLayout $layoutRoot) "Test-IsDamRootLayout: pelny uklad DAM rozpoznany"
  $notDam = Join-Path $tmp ("dam-selftest-notdam-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path (Join-Path $notDam 'bin') | Out-Null
  Assert (-not (Test-IsDamRootLayout $notDam)) "Test-IsDamRootLayout: samo bin\ bez znacznikow = false"
  Remove-Item -LiteralPath $layoutRoot, $notDam -Recurse -Force -ErrorAction SilentlyContinue

  if ($fail -eq 0) { Write-Host "SELFTEST OK"; exit 0 } else { Write-Host "SELFTEST: $fail BLEDOW"; exit 1 }
}

# ---------------------------------------------------------------------------
# Brama piaskownicy (B3 B-1, BLOKUJACE): -Apply poza instalatorem wymaga parametrow piaskownicy.
# ---------------------------------------------------------------------------
if ($Apply -and -not $Installer) {
  $missing = @()
  if (-not $RegRoot) { $missing += '-RegRoot' }
  if (-not $StartupDir) { $missing += '-StartupDir' }
  if (-not $LocalAppDataDir) { $missing += '-LocalAppDataDir' }
  if (-not $TasksJson) { $missing += '-TasksJson' }
  if ($missing.Count -gt 0) {
    Write-Host "ODMOWA: -Apply poza instalatorem (-Installer) wymaga parametrow piaskownicy: $($missing -join ', ')."
    Write-Host "Bez nich -Apply dzialalby na PRAWDZIWYM rejestrze/Autostarcie/zadaniach/procesach tego komputera (B3 B-1)."
    exit 2
  }
}

# ---------------------------------------------------------------------------
# Efektywne sciezki (piaskownica > prawdziwy system)
# ---------------------------------------------------------------------------
$EffLocalAppData = if ($LocalAppDataDir) { $LocalAppDataDir } else { $env:LOCALAPPDATA }
$EffStateDir = if ($StateDirOverride) { $StateDirOverride } else { Join-Path $EffLocalAppData 'DAM\state' }
$EffStartup = if ($StartupDir) { $StartupDir } else { [Environment]::GetFolderPath('Startup') }
$EffProgramFiles = if ($ProgramFilesDir) { $ProgramFilesDir } else { ${env:ProgramFiles} }
$KoszRoot = Join-Path $EffLocalAppData 'DAM\kosz'
$DriveTypeMap = @{}
foreach ($e in $DriveTypeFake) {
  if ($e -match '^([A-Za-z])=(\d+)$') { $DriveTypeMap[$Matches[1].ToUpperInvariant()] = [int]$Matches[2] }
}

Init-Log $EffLocalAppData
Log "start Phase=$Phase Mode=$Mode KeepDir=$KeepDir Installer=$Installer Apply=$Apply Sandbox=$([bool]($RegRoot -or $LocalAppDataDir -or $StartupDir -or $TasksJson))"

$exitCode = 0
try {

  # =========================================================================
  # FAZA STOP: zatrzymanie procesow DAM (uklad DAM) z {app}/KeepDir i ze starych korzeni.
  # Bez /T (nie zabija drzewa potomnego), po PID. Wykluczenia: .git (przodek), *Setup*,
  # data\updates, przodkowie wlasnego procesu instalatora (PPID lancuch).
  # =========================================================================
  if ($Phase -eq "Stop" -or $Phase -eq "All") {
    $ownAncestors = New-Object System.Collections.Generic.HashSet[int]
    try {
      $pid0 = $PID
      $guard = 0
      while ($pid0 -and $guard -lt 32) {
        $guard++
        [void]$ownAncestors.Add($pid0)
        $p = Get-CimInstance Win32_Process -Filter "ProcessId=$pid0" -ErrorAction SilentlyContinue
        if (-not $p -or -not $p.ParentProcessId) { break }
        $pid0 = $p.ParentProcessId
      }
    } catch {}

    if ($OnlyPids.Count -gt 0) {
      # Piaskownica: zatrzymaj WYLACZNIE podane PID-y (nigdy prawdziwej listy procesow).
      foreach ($procId in $OnlyPids) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
        if (-not $proc) { continue }
        Log "zatrzymuje proces piaskownicy $procId $($proc.Name)"
        if ($Apply) { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }
      }
    } elseif ($Installer) {
      # Prawdziwy system - tylko wywolanie z Inno moze tu dzialac (B3 B-1).
      $procNames = @('python.exe', 'pythonw.exe', 'DAM.exe', 'dam-appw.exe')
      Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $procNames -contains $_.Name
      } | ForEach-Object {
        if ($ownAncestors.Contains([int]$_.ProcessId)) { return }
        if ($_.Name -like '*Setup*') { return }
        $exePath = [string]$_.ExecutablePath
        $cmdLine = [string]$_.CommandLine
        if ($exePath -match '\\data\\updates\\' -or $cmdLine -match '\\data\\updates\\') { return }
        if (-not (Test-IsDamAutostart $_.Name $cmdLine) -and $_.Name -notin @('DAM.exe', 'dam-appw.exe')) { return }
        $root = if ($exePath) { Get-DamRootFromCmd $exePath } else { Get-DamRootFromCmd $cmdLine }
        if ($root -and (Test-HasGitAncestor $root)) { Log "pomijam (repo .git): $root pid $($_.ProcessId)"; return }
        Log "zatrzymuje proces $($_.ProcessId) $($_.Name) z $root"
        if ($Apply) { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
      }
    } else {
      Log "pomijam zatrzymywanie procesow: brak -OnlyPids (piaskownica) i brak -Installer (prawdziwy system)"
    }
  }

  # =========================================================================
  # FAZA CLEAN: autostart (Run/RunOnce, zadania, skroty) + stare foldery (kosz) + aktywacja.
  # =========================================================================
  if ($Phase -eq "Clean" -or $Phase -eq "All") {

    $staleRoots = New-Object System.Collections.Generic.List[string]
    $changed = 0

    # --- 1) Run/RunOnce ---
    $regKeys = @()
    if ($RegRoot) {
      $regKeys += @{ Hive = "Sandbox"; Path = $RegRoot }
    } else {
      $regKeys += @{ Hive = "HKCU"; Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" }
      $regKeys += @{ Hive = "HKCU"; Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce" }
      $regKeys += @{ Hive = "HKLM"; Path = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" }
      $regKeys += @{ Hive = "HKLM"; Path = "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run" }
    }
    foreach ($k in $regKeys) {
      if (-not (Test-Path -LiteralPath $k.Path)) { continue }
      try { $props = Get-ItemProperty -LiteralPath $k.Path -ErrorAction Stop } catch { continue }
      foreach ($p in $props.PSObject.Properties) {
        if ($p.Name -like 'PS*') { continue }
        $cmd = [string]$p.Value
        if (-not (Test-IsDamAutostart $p.Name $cmd)) { continue }
        $root = Get-DamRootFromCmd $cmd
        if ($root -and (Test-HasGitAncestor $root)) { Log "zostaje (repo .git): $($k.Hive) $($p.Name)"; continue }
        if (Keep $cmd $KeepDir $Mode) { Log "zostaje (biezaca instalacja): $($k.Hive) $($p.Name) = $cmd"; continue }
        Log "usuwam autostart: $($k.Hive) $($p.Name) = $cmd"
        if ($root -and -not $staleRoots.Contains($root)) { $staleRoots.Add($root) }
        if ($Apply) {
          try { Remove-ItemProperty -LiteralPath $k.Path -Name $p.Name -ErrorAction Stop; $changed++ }
          catch { Log "  nie udalo sie (wymaga admina?): $($_.Exception.Message)" }
        }
      }
    }
    if ($Mode -eq "Uninstall" -and $KeepDir -and -not $staleRoots.Contains($KeepDir)) { $staleRoots.Add($KeepDir) }

    # --- 2) Zadania harmonogramu "DAM-*" ---
    $tasks = Get-DamTaskCandidates $TasksJson
    foreach ($t in @($tasks)) {
      if (-not $t) { continue }
      $refs = @()
      foreach ($a in @($t.Actions)) {
        $refs += (Get-CmdExe ([string]$a.Execute))
        foreach ($m in [regex]::Matches([string]$a.Arguments, '"([^"]+\.(ps1|py|exe|bat))"|(\S+\.(ps1|py|exe|bat))')) {
          $v = if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[3].Value }
          $refs += $v
        }
      }
      $files = @($refs | Where-Object { $_ -and ($_ -match '[\\/]') })
      $missing = @($files | Where-Object { Test-PathMissingButFixed $_ $DriveTypeMap })
      $inApp = ($Mode -eq "Uninstall") -and $KeepDir -and (@($files | Where-Object { Test-UnderDir $_ $KeepDir }).Count -gt 0)
      $isDamAction = (@($files | Where-Object { Test-IsDamAutostart $t.TaskName $_ }).Count -gt 0)
      if (-not $isDamAction -and $files.Count -eq 0) { continue }
      if (($missing.Count -gt 0 -and $isDamAction) -or $inApp) {
        $why = if ($inApp) { "wskazuje do odinstalowywanego folderu" } else { "brak pliku (dysk lokalny): $($missing -join ', ')" }
        Log "usuwam zadanie harmonogramu $($t.TaskName) ($why)"
        if ($Apply) {
          if ($TasksJson) {
            Log "  (piaskownica: symulacja usuniecia zadania $($t.TaskName), Unregister-ScheduledTask nie wywolany)"
            $changed++
          } elseif ($Installer) {
            try { Unregister-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath -Confirm:$false -ErrorAction Stop; $changed++ }
            catch { Log "  nie udalo sie: $($_.Exception.Message)" }
          }
        }
      }
    }

    # --- 3) Skroty w folderze Autostart ---
    if ($EffStartup -and (Test-Path -LiteralPath $EffStartup)) {
      $shell = $null
      try { $shell = New-Object -ComObject WScript.Shell } catch {}
      Get-ChildItem -LiteralPath $EffStartup -Filter '*.lnk' -ErrorAction SilentlyContinue | Where-Object { Test-NameHasDamToken $_.Name } | ForEach-Object {
        $target = ""
        if ($shell) { try { $sc = $shell.CreateShortcut($_.FullName); $target = $sc.TargetPath + " " + $sc.Arguments } catch {} }
        $isDam = Test-IsDamAutostart $_.Name $target
        if ($isDam -and -not (Keep $target $KeepDir $Mode)) {
          Log "usuwam skrot Autostart: $($_.FullName) -> $target"
          if ($Apply) { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue; $changed++ }
        }
      }
    }

    # --- 4) Aktywacja przy ODINSTALOWANIU: kopia z {app} (KeepDir) do state\activation, jesli brak.
    #        (przy Uninstall {app} jest zrodlem tracacym dane, nie "starym folderem" do kosza)
    if ($Mode -eq "Uninstall" -and $KeepDir) {
      $actU = Copy-DamActivationPair -OldRoot $KeepDir -AppDir "" -StateDir $EffStateDir -WhatIfOnly:(-not $Apply)
      if ($actU.CopiedToState.Count -gt 0) { Log "odinstalowanie: aktywacja -> state\activation: $($actU.CopiedToState -join ', ')" }
      if ($actU.MissingSource.Count -gt 0) { Log "odinstalowanie: aktywacja brak zrodla (pomijam, nie blad): $($actU.MissingSource -join ', ')" }
      if ($actU.Errors.Count -gt 0) { Log "odinstalowanie: aktywacja bledy kopii: $($actU.Errors -join ' | ')" }
    }

    # --- 5) Stare foldery DAM (TYLKO Install/Manual - odinstalowanie usuwa wylacznie swoj wlasny
    #        {app} przez [UninstallDelete], nie inne instalacje): aktywacja -> kopia, potem kosz.
    if ($Mode -ne "Uninstall") {
      $candidates = New-Object System.Collections.Generic.List[string]
      foreach ($r in $staleRoots) { if ($r) { [void]$candidates.Add($r) } }
      foreach ($baseDir in @($EffLocalAppData, (Join-Path $EffLocalAppData 'Programs'), $EffProgramFiles)) {
        if (-not $baseDir -or -not (Test-Path -LiteralPath $baseDir)) { continue }
        Get-ChildItem -LiteralPath $baseDir -Directory -ErrorAction SilentlyContinue | Where-Object {
          $_.Name -match '^DAM([-_].*)?$'
        } | ForEach-Object { [void]$candidates.Add($_.FullName) }
      }
      if ($Installer) {
        $procNames = @('python.exe', 'pythonw.exe', 'DAM.exe', 'dam-appw.exe')
        try {
          Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $procNames -contains $_.Name } | ForEach-Object {
            $r = Get-DamRootFromCmd ([string]$_.ExecutablePath)
            if ($r) { [void]$candidates.Add($r) }
          }
        } catch {}
        foreach ($regHive in @('HKCU:\Software\Inyfinn\DAM', 'HKLM:\Software\Inyfinn\DAM')) {
          try {
            if (Test-Path -LiteralPath $regHive) {
              $ip = (Get-ItemProperty -LiteralPath $regHive -Name 'InstallPath' -ErrorAction SilentlyContinue).InstallPath
              if ($ip) { [void]$candidates.Add($ip) }
            }
          } catch {}
        }
      }

      $seen = New-Object System.Collections.Generic.HashSet[string]
      $oldRoots = New-Object System.Collections.Generic.List[string]
      foreach ($c in $candidates) {
        $normC = (Normalize-Cmd $c).TrimEnd('\')
        if (-not $normC -or $seen.Contains($normC)) { continue }
        [void]$seen.Add($normC)
        if (Test-IsExcludedRoot -Path $c -AppDir $KeepDir -LocalAppData $EffLocalAppData -DriveTypeMap $DriveTypeMap) {
          Log "pomijam kandydata (wykluczenie): $c"
          continue
        }
        if (-not (Test-IsDamRootLayout $c)) { Log "pomijam kandydata (nie wyglada jak instalacja DAM): $c"; continue }
        [void]$oldRoots.Add($c)
      }

      foreach ($old in $oldRoots) {
        Log "stary folder DAM: $old"
        $act = Copy-DamActivationPair -OldRoot $old -AppDir $KeepDir -StateDir $EffStateDir -WhatIfOnly:(-not $Apply)
        if ($act.CopiedToApp.Count -gt 0) { Log "  aktywacja -> {app}: $($act.CopiedToApp -join ', ')" }
        if ($act.CopiedToState.Count -gt 0) { Log "  aktywacja -> state\activation: $($act.CopiedToState -join ', ')" }
        if ($act.MissingSource.Count -gt 0) { Log "  aktywacja brak zrodla (pomijam, nie blad): $($act.MissingSource -join ', ')" }
        if ($act.Errors.Count -gt 0) { Log "  aktywacja bledy kopii: $($act.Errors -join ' | ')" }

        $stillRunning = $false
        try {
          $stillRunning = [bool](Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
            Test-UnderDir ([string]$_.ExecutablePath) $old
          } | Select-Object -First 1)
        } catch {}
        if ($stillRunning) {
          Log "  UWAGA: proces ze starego korzenia nadal dziala (konfiguracja w pamieci) - zmiana nazwy nie odcina mostu: $old"
        }

        if (-not $Apply) {
          Log "  na sucho: zostalby wyslany do Kosza Windows (rezerwa: zmiana nazwy do $KoszRoot)"
          continue
        }
        $res = Send-DamRootToRecycleBinOrKosz -Path $old -KoszRoot $KoszRoot
        if ($res.Ok) {
          Log "  usuniety metoda: $($res.Method)$(if ($res.Dest) { ' -> ' + $res.Dest })"
          $changed++
        } else {
          Log "  NIE udalo sie usunac (Kosz: $($res.RecycleBinError); zmiana nazwy: $($res.RenameError)) - zostaje, log, ponowienie przy nastepnej instalacji"
        }
      }
      Log "koniec fazy Clean: zmian $changed, stare foldery: $($oldRoots.Count)"
    } else {
      Log "koniec fazy Clean (Uninstall): zmian $changed, stare foldery pominiete (tylko wlasny {app})"
    }
  }

  Log "koniec: OK"
} catch {
  Log "WYJATEK: $($_.Exception.Message)"
  $exitCode = 1
}

if ($DoneFile) {
  # Inno PrepareToInstall: uruchamia ta faze przez ewNoWait i czeka na ten plik do 90 s,
  # potem instalacja idzie dalej niezaleznie ("nigdy nie blokuj instalacji na zawsze").
  try { Set-Content -LiteralPath $DoneFile -Value ([string]$exitCode) -Encoding ASCII -ErrorAction Stop } catch {}
}

exit $exitCode
