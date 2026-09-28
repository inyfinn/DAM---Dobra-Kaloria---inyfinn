#Requires -Version 5.1
<#
.SYNOPSIS
  Sprawdza [InstallDelete] w DAM-Setup.iss: (1) zaden wpis nie obejmuje folderu DANYCH
  uzytkownika (rowny mu, jego przodek, ani jego potomek), (2) wszystkie znane foldery
  CZYSTEGO KODU sa pokryte (nic nowego nie zostalo pominiete). Bez Pester - proste asercje,
  exit 0 = OK, exit 1 = problem. Nie uruchamia instalatora, tylko parsuje tekst .iss.

.OPIS (28.09.2026, W4 runda 2 - "aktualizacja w miejscu nie moze nakladac starych plikow")
  Zrodlo prawdy o tym, co faktycznie ląduje pod {app}\bin: bin/scripts/ops/build-installer.ps1
  (funkcja Invoke-Robo, listy $xdCommon/$xfCommon/$xdWeb/$xdRuntime/$xdAgents) - to ONA
  decyduje, ktore foldery repo trafiaja do stagingu, a stad do {app}. DATA_ROOTS ponizej to
  foldery jawnie wykluczone z ogolnego kopiowania kodu i obslugiwane WLASNYM, wąskim [Files]
  (onlyifdoesntexist) - a wiec dane uzytkownika, nie kod: bin\apps\web\data,
  bin\apps\desktop\data (aktywacja, kolejki, locki, updates\<v>\ z dzialajacym instalatorem),
  bin\DATABASE (tylko users-seed.sqlite kopiowany, i to onlyifdoesntexist), bin\PAMIEC-PODRECZNA
  (tylko thumbs\*, miniatury generowane lokalnie i pobierane z serwera - "cache" ale danych
  uzytkownika, nie odtwarzalny z buildu tak jak kod).
#>

$ErrorActionPreference = "Stop"
$IssPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\installer\DAM-Setup.iss')).Path
$text = Get-Content -LiteralPath $IssPath -Raw -Encoding UTF8

$script:total = 0
$script:failed = 0
function Assert([bool]$cond, [string]$name) {
  $script:total++
  if ($cond) { Write-Host "PASS: $name" } else { Write-Host "FAIL: $name"; $script:failed++ }
}

# --- 1) Wyciagnij blok [InstallDelete] (do nastepnej sekcji [...]) ---
$m = [regex]::Match($text, '(?ms)^\[InstallDelete\]\r?\n(.*?)(?=^\[)')
Assert $m.Success "sekcja [InstallDelete] znaleziona w DAM-Setup.iss"
if (-not $m.Success) { Write-Host "WYNIK: 0/1"; exit 1 }
$block = $m.Groups[1].Value

$entries = New-Object System.Collections.Generic.List[string]
foreach ($line in ($block -split "`r?`n")) {
  $l = $line.Trim()
  if (-not $l -or $l.StartsWith(';')) { continue }
  $mm = [regex]::Match($l, 'Name:\s*"([^"]+)"')
  if ($mm.Success) { [void]$entries.Add($mm.Groups[1].Value) }
}
Assert ($entries.Count -gt 0) "co najmniej jeden wpis [InstallDelete] sparsowany ($($entries.Count) razem)"

function Normalize([string]$p) {
  $p = $p -replace '^\{app\}\\?', ''
  return ($p -replace '/', '\').Trim('\').ToLowerInvariant()
}

# --- 2) Foldery DANYCH (nigdy nie moga byc rowne/przodkiem/potomkiem wpisu InstallDelete) ---
$dataRoots = @(
  'bin\apps\web\data',
  'bin\apps\desktop\data',
  'bin\database',
  'bin\pamiec-podreczna'
)

function Test-Overlap([string]$entryNorm, [string]$dataNorm) {
  if (-not $entryNorm -or -not $dataNorm) { return $false }
  if ($entryNorm -eq $dataNorm) { return $true }
  if ($entryNorm.StartsWith($dataNorm + '\')) { return $true }   # wpis WEWNATRZ danych
  if ($dataNorm.StartsWith($entryNorm + '\')) { return $true }   # wpis to PRZODEK danych (usunalby je)
  return $false
}

# Wyjatki: KONKRETNE, nazwane pliki (nie foldery, nie wzorce) wewnatrz folderu danych,
# ktore instalator swiadomie kasuje jako smieci/artefakty buildu (nie stan uzytkownika) -
# udokumentowane komentarzem w samym .iss (linia ok. 101-104): kopia cudzego skanu Brandingu
# (~370 MB) z instalatorow <= 2.4.3, ktora wlasny runner bralby za swoj skan dysku. Wlasny
# build odtwarza oba pliki - to NIE jest "dane uzytkownika do zachowania", tylko blad
# poprzednich wersji instalatora. Rozszerzanie tej listy wymaga takiego samego uzasadnienia
# w komentarzu .iss - to NIE jest "wpisz cokolwiek, zeby test przeszedl".
$knownFileExceptions = @(
  'bin\apps\web\data\branding-index.scan.json',
  'bin\apps\web\data\branding-scan-dirs.json'
)

$badOverlaps = New-Object System.Collections.Generic.List[string]
foreach ($e in $entries) {
  $eNorm = Normalize $e
  if (-not $eNorm) { $badOverlaps.Add("$e (pusty/korzen {app} - zbyt szeroki)"); continue }
  if ($knownFileExceptions -contains $eNorm) { continue }
  foreach ($d in $dataRoots) {
    if (Test-Overlap $eNorm $d) { $badOverlaps.Add("$e  <->  $d") }
  }
}
Assert ($badOverlaps.Count -eq 0) "zaden wpis [InstallDelete] (poza udokumentowanymi wyjatkami plikowymi) nie dotyka folderu danych ($($dataRoots -join ', '))"
foreach ($b in $badOverlaps) { Write-Host "  KONFLIKT: $b" }

# --- 3) Znane foldery CZYSTEGO KODU musza byc pokryte (dokladny wpis LUB przodek-wpis) ---
$expectedCodeFolders = @(
  'bin\apps\web\assets',
  'bin\apps\web\i18n',
  'bin\apps\web\scripts',
  'bin\apps\api',
  'bin\theme',
  'bin\runtime',
  'bin\scripts',
  'bin\docs',
  'bin\agents',
  'bin\apps\desktop\scripts',
  'bin\apps\desktop\tests',
  'bin\apps\desktop\__pycache__',
  'bin\apps\desktop\.pytest_cache'
)
$entriesNorm = @($entries | ForEach-Object { Normalize $_ })
foreach ($cf in $expectedCodeFolders) {
  $covered = [bool]($entriesNorm | Where-Object { $_ -eq $cf -or $cf.StartsWith($_ + '\') })
  Assert $covered "folder kodu pokryty przez [InstallDelete]: $cf"
}

Write-Host "`nWpisy [InstallDelete] ($($entries.Count)):"
$entries | ForEach-Object { Write-Host "  $_" }

Write-Host "`n=== WYNIK: $($script:total - $script:failed)/$($script:total) ==="
if ($script:failed -gt 0) { exit 1 } else { exit 0 }
