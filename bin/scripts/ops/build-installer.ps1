#Requires -Version 5.1
param(
  [switch]$SkipSync,
  [switch]$SkipVendor,
  [switch]$SkipExeBuild,
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"

# Build NIE kasuje rekurencyjnie (zasada 0 w ~/.claude/CLAUDE.md, 2026-09-18): kazdy build
# dostaje nowy katalog staging. Stare katalogi DAM-build\staging\DAM-install-* usuwa czlowiek.

function Invoke-Robo([string]$src, [string]$dst, [string[]]$xd, [string[]]$xf) {
  if (-not (Test-Path -LiteralPath $src)) { return }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  $rcArgs = @($src, $dst, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np", "/XJ", "/XJD")
  if ($xd -and $xd.Count -gt 0) { $rcArgs += "/XD"; $rcArgs += $xd }
  if ($xf -and $xf.Count -gt 0) { $rcArgs += "/XF"; $rcArgs += $xf }
  & robocopy @rcArgs | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE): $src" }
}

$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$BinRoot = Join-Path $GitRoot "bin"

$Iscc = Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $Iscc)) {
  $alt = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($alt) { $Iscc = $alt } else { throw "Brak ISCC.exe (zainstaluj Inno Setup 6)." }
}

# version.json czytamy ZAWSZE (nie tylko gdy brak -Version): to zrodlo zarowno
# numeru, jak i tekstu release_note na ostatnia strone kreatora.
# 20.09.2026: niepoprawny JSON (niecytowany cudzyslow w "note") przeszedl tu po cichu
# i Setup wyjechal jako 5.0.130. Mechanizm aktualizacji porownuje wlasnie ten numer,
# wiec cicha wersja zapasowa jest grozniejsza niz przerwany build.
$verJson = Join-Path $BinRoot "apps\web\version.json"
if (-not (Test-Path $verJson)) { throw "Brak $verJson - nie zgaduje wersji." }
try {
  # -Encoding UTF8 obowiazkowo: PowerShell 5.1 czyta plik BEZ BOM jako ANSI
  # (CP1250), wiec "RĘKAW" z version.json wjezdzalo do README jako "RÄKAW".
  $vj = Get-Content $verJson -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
  throw "version.json jest niepoprawnym JSON-em: $($_.Exception.Message)"
}
if (-not $Version) {
  $Version = [string]$vj.version
  if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "version.json ma bledna wersje: '$Version'" }
}

# --- Bramka spojnosci wersji -------------------------------------------------
# Wersja zyje w czterech plikach naraz. 2.1.5 wyjechalo z runtime_config.py
# stojacym na 2.1.1, bo nikt tego nie porownywal. Rozjazd konczy build zamiast
# wypuszczac paczke, ktora klamie o swojej wersji.
$verSources = @(
  @{ Name = "apps\web\version.json";               Path = (Join-Path $BinRoot "apps\web\version.json");               Pattern = '"version"\s*:\s*"(\d+\.\d+\.\d+)"' },
  @{ Name = "apps\web\assets\js\dam-version.js";   Path = (Join-Path $BinRoot "apps\web\assets\js\dam-version.js");   Pattern = 'DAM_APP_VERSION\s*=\s*"(\d+\.\d+\.\d+)"' },
  @{ Name = "apps\desktop\runtime_config.py";      Path = (Join-Path $BinRoot "apps\desktop\runtime_config.py");      Pattern = 'APP_VERSION\s*=\s*"(\d+\.\d+\.\d+)"' },
  @{ Name = "installer\DAM-Setup.iss";             Path = (Join-Path $BinRoot "installer\DAM-Setup.iss");             Pattern = 'MyAppVersion\s+"(\d+\.\d+\.\d+)"' }
)
$verMismatch = @()
foreach ($src in $verSources) {
  if (-not (Test-Path -LiteralPath $src.Path)) { $verMismatch += "$($src.Name): BRAK PLIKU"; continue }
  $m = [regex]::Match((Get-Content -LiteralPath $src.Path -Raw), $src.Pattern)
  if (-not $m.Success) { $verMismatch += "$($src.Name): nie znalazlem numeru wersji"; continue }
  if ($m.Groups[1].Value -ne $Version) { $verMismatch += "$($src.Name): $($m.Groups[1].Value) (oczekiwano $Version)" }
}
if ($verMismatch.Count -gt 0) {
  throw ("Wersja rozjechana miedzy plikami - popraw i powtorz build:`n  " + ($verMismatch -join "`n  "))
}
Write-Host "Wersja $Version zgodna we wszystkich $($verSources.Count) plikach."

# --- Commit, z ktorego powstaje paczka ---------------------------------------
# "Tresc z commita" ma byc prawda, nie deklaracja: SHA ladu-je do README,
# a niezacommitowane zmiany kodu dostaja glosne ostrzezenie.
$buildCommit = ""
$buildDirty = $false
try {
  $buildCommit = (& git -C $GitRoot rev-parse --short HEAD 2>$null | Select-Object -First 1)
  # Interesuje nas tylko KOD, ktory trafia do paczki:
  #  - diff --name-only zamiast status: status znaczy plik takze wtedy, gdy
  #    zmienily sie same konce linii (CRLF po edytorze albo Synology Drive),
  #  - apps/desktop/data i *.log zmieniaja sie od samego uruchomienia DAM,
  #  - bin/instalator i .cer to artefakty, ktore ten build wlasnie nadpisuje.
  $dirty = @(& git -C $GitRoot diff --name-only HEAD 2>$null |
    Where-Object {
      $_ -notmatch 'apps/desktop/data/' -and
      $_ -notmatch '\.log$' -and
      $_ -notmatch '^bin/instalator/' -and
      $_ -notmatch '\.cer$'
    })
  $buildDirty = ($dirty.Count -gt 0)
  if ($buildDirty) { Write-Host "Niezacommitowany kod: $($dirty -join ', ')" }
} catch { $buildCommit = "" }
if ($buildDirty) {
  Write-Warning "Drzewo ma niezacommitowane zmiany - paczka nie odpowiada dokladnie commitowi $buildCommit."
}

Write-Host "GIT_ROOT=$GitRoot Version=$Version Commit=$buildCommit"
$appsSrc = Join-Path $GitRoot "apps"
if (-not $SkipSync -and -not (Test-Path -LiteralPath $appsSrc)) {
  Write-Host "Skip sync: brak GIT_ROOT\apps (X: CONTENT-only). Uzywam bin\apps."
  $SkipSync = $true
}
if (-not $SkipSync) { & (Join-Path $PSScriptRoot "sync-apps-to-bin.ps1") }

$rtPy = Join-Path $BinRoot "runtime\win\python\pythonw.exe"
$rtPyExe = Join-Path $BinRoot "runtime\win\python\python.exe"
$rtSite = Join-Path $BinRoot "runtime\win\python\Lib\site-packages"
$rtModules = "webview,bcrypt,psycopg2,PIL,ijson,openpyxl,cryptography"

# Sam pythonw.exe NIE jest brama: embed CPython bez site-packages startuje,
# ale launch.py pada na "import webview" i launcher tlumi stderr = klik bez efektu.
$script:RuntimeDepsError = ""
function Test-RuntimeDeps {
  if (-not (Test-Path -LiteralPath $rtPyExe)) {
    $script:RuntimeDepsError = "brak python.exe: $rtPyExe"
    return $false
  }
  $errFile = [System.IO.Path]::GetTempFileName()
  try {
    & $rtPyExe -c "import $rtModules" 1>$null 2>$errFile
    if ($LASTEXITCODE -eq 0) {
      $script:RuntimeDepsError = ""
      return $true
    }
    $errTxt = ""
    if (Test-Path -LiteralPath $errFile) {
      $errTxt = (Get-Content -LiteralPath $errFile -Raw -ErrorAction SilentlyContinue)
    }
    if (-not $errTxt) { $errTxt = "python.exe import exit $LASTEXITCODE (brak stderr)" }
    $script:RuntimeDepsError = $errTxt.Trim()
    return $false
  } finally {
    Remove-Item -LiteralPath $errFile -Force -ErrorAction SilentlyContinue
  }
}

if ($SkipVendor -and (Test-RuntimeDeps)) {
  Write-Host "Skip vendor (runtime kompletny)."
} elseif ($SkipVendor) {
  throw "SkipVendor: runtime bez bibliotek. Nie odpalam vendor-runtime. $($script:RuntimeDepsError)"
} else {
  & (Join-Path $PSScriptRoot "vendor-runtime-win.ps1")
  if (-not (Test-Path $rtPy)) { throw "Brak pythonw po vendor." }
}

$rtSiteCount = 0
if (Test-Path -LiteralPath $rtSite) {
  $rtSiteCount = (Get-ChildItem -LiteralPath $rtSite -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
}
if ($rtSiteCount -lt 500) {
  throw "Runtime site-packages ma $rtSiteCount plikow (<500). Setup NIE moze wyjechac - DAM nie wstanie na czystym PC."
}
& $rtPyExe -c "import $rtModules; print('runtime_deps_ok')"
if ($LASTEXITCODE -ne 0) { throw "Runtime bez bibliotek ($rtModules). Setup NIE moze wyjechac." }
Write-Host "Runtime OK: $rtSiteCount plikow w site-packages."

if ($SkipExeBuild -and (Test-Path (Join-Path $GitRoot "DAM.exe"))) {
  Write-Host "Skip DAM.exe build."
} else {
  & (Join-Path $BinRoot "scripts\ops\build-dam-root-exe.ps1")
}

if (-not $env:LOCALAPPDATA -or -not [System.IO.Path]::IsPathRooted($env:LOCALAPPDATA)) {
  throw "LOCALAPPDATA puste albo wzgledne - przerywam (staging musi miec sciezke bezwzgledna)."
}
$stageStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stageRoot = Join-Path $env:LOCALAPPDATA "DAM-build\staging\DAM-install-$Version-$stageStamp"
Write-Host "STAGE_ROOT=$stageRoot (poza Dropbox, nowy katalog na kazdy build - bez kasowania)"
if (Test-Path -LiteralPath $stageRoot) { throw "Katalog staging juz istnieje: $stageRoot" }
New-Item -ItemType Directory -Path $stageRoot | Out-Null
$oldStages = @(Get-ChildItem -LiteralPath (Split-Path $stageRoot -Parent) -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -ne $stageRoot })
if ($oldStages.Count) {
  Write-Host ("Stare katalogi staging do recznego usuniecia: " + (($oldStages | ForEach-Object { $_.FullName }) -join "; "))
}
$damSrc = Join-Path $GitRoot "DAM.exe"
$damDst = Join-Path $stageRoot "DAM.exe"
$damReadable = $false
if (Test-Path -LiteralPath $damSrc) {
  try {
    $fs = [System.IO.File]::Open($damSrc, "Open", "Read", "ReadWrite")
    $probe = New-Object byte[] 64
    $n = $fs.Read($probe, 0, 64)
    $fs.Close()
    $damReadable = ($n -gt 0)
  } catch {
    Write-Warning "GIT_ROOT DAM.exe nieczytelny (chmura/X:): $($_.Exception.Message)"
    $damReadable = $false
  }
}
if (-not $damReadable) {
  $damAlt = Join-Path $env:LOCALAPPDATA "Programs\DAM\DAM.exe"
  if (Test-Path -LiteralPath $damAlt) {
    Write-Warning "Uzywam DAM.exe z zainstalowanego DAM: $damAlt"
    $damSrc = $damAlt
  } else {
    throw "Brak czytelnego DAM.exe (GIT_ROOT chmura + brak $env:LOCALAPPDATA\Programs\DAM\DAM.exe)."
  }
}
Copy-Item -LiteralPath $damSrc -Destination $damDst -Force
if (-not (Test-Path -LiteralPath $damDst) -or ((Get-Item -LiteralPath $damDst).Length -lt 100000)) {
  throw "Nie skopiowano DAM.exe do staging (src=$damSrc)."
}

$binDst = Join-Path $stageRoot "bin"
New-Item -ItemType Directory -Force -Path $binDst | Out-Null

$xdCommon = @(
  "__pycache__", ".pytest_cache", ".ocr-thumb-cache", ".venv", "node_modules", "webview2-profile", "logs", "_qa",
  "vendor", "framework", "bootstrap", "thumbs", "_invoice_mail_stage", "tooling", "data"
)
$xfCommon = @(
  "*.pyc", "*.bak*", "*backup*", "*Conflict*", "*.drifted*", "*.pre-*",
  "index-watcher.log", "audit-log.jsonl", "branding-index.json",
  "machine-config.json", "dam-connection.env", "pg-config.json"
)

Write-Host "Staging bin (runtime + THEME + apps + scripts + docs + agents)..."
$xdRuntime = @($xdCommon | Where-Object { $_ -ne "data" })
Invoke-Robo (Join-Path $BinRoot "runtime") (Join-Path $binDst "runtime") $xdRuntime $xfCommon
Invoke-Robo (Join-Path $BinRoot "THEME") (Join-Path $binDst "THEME") @("__pycache__", "documentation") @("*.zip", "*.map")
Invoke-Robo (Join-Path $BinRoot "apps\desktop") (Join-Path $binDst "apps\desktop") $xdCommon $xfCommon
# Lustro repo w paczce: skrypty ops/qa (README do nich odsyla), dokumentacja, wykladnia agentow.
# agents: NIE pakuj dumpow design-system/graphify (MAX_PATH w ISCC).
$xdAgents = $xdCommon + @(
  "graphify-out",
  "design-system-2026-09-07",
  "design-system-2026-09-09",
  "design-system-2026-09-10",
  "qa-evidence",
  "sandbox"
)
foreach ($tree in @("apps\api", "scripts", "docs", "agents")) {
  $src = Join-Path $BinRoot $tree
  if (Test-Path -LiteralPath $src) {
    $xd = if ($tree -eq "agents") { $xdAgents } else { $xdCommon }
    Invoke-Robo $src (Join-Path $binDst $tree) $xd $xfCommon
    Write-Host "Shipped bin\$tree."
  }
}
# apps/web: NIE wykluczaj assets/vendor (Jost + Unicons). Bez tego ikony w WebView giną.
$xdWeb = @($xdCommon | Where-Object { $_ -ne "vendor" }) + @("data")
Invoke-Robo (Join-Path $BinRoot "apps\web") (Join-Path $binDst "apps\web") $xdWeb $xfCommon
# 2026-09-20: ksztalt pliku to za malo. Setup 2.1.2 wyjechal z nieaktualnym haslem
# (kandydat z %LOCALAPPDATA% wygral kolejnosc), a kazda czysta instalacja startowala
# w trybie offline: 'password authentication failed for user "dam_eta"'.
# Kandydata przyjmujemy dopiero, gdy naprawde zaloguje sie do bazy.
function Test-PgConfigSecret([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  try {
    $j = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    $pw = [string]$j.password
    $portOk = ([string]$j.port) -eq "5433"
    $dbOk = ([string]$j.dbname) -eq "dam_eta"
    if (-not (($pw.Length -ge 8) -and $portOk -and $dbOk)) { return $false }
  } catch {
    return $false
  }
  $probe = Join-Path $env:TEMP "dam-pg-probe.py"
  @'
import json, sys
import psycopg2
c = json.loads(open(sys.argv[1], encoding="utf-8").read())
psycopg2.connect(host=c["host"], port=c["port"], dbname=c["dbname"], user=c["user"],
                 password=c["password"], sslmode=c.get("sslmode", "require"),
                 connect_timeout=10).close()
print("PG_OK")
'@ | Set-Content -LiteralPath $probe -Encoding UTF8
  $out = & $rtPyExe $probe $Path 2>&1
  Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
  if ($LASTEXITCODE -eq 0) { return $true }
  Write-Host ("pg-config odrzucony (baza nie przyjmuje hasla): {0} — {1}" -f $Path, (($out | Select-Object -Last 1) -replace '\s+', ' '))
  return $false
}

$webVendorSrc = Join-Path $BinRoot "apps\web\assets\vendor"
$webVendorDst = Join-Path $binDst "apps\web\assets\vendor"
$uniconsCss = Join-Path $webVendorSrc "icons\unicons-line.css"
if (-not (Test-Path -LiteralPath $uniconsCss)) {
  throw "Brak apps/web/assets/vendor/icons/unicons-line.css — Setup NIE moze wyjechac bez ikon."
}
New-Item -ItemType Directory -Force -Path $webVendorDst | Out-Null
Invoke-Robo $webVendorSrc $webVendorDst @() @()
Write-Host "Shipped apps/web/assets/vendor (fonts/icons)."

$webDataSrc = Join-Path $BinRoot "apps\web\data"
$webDataDst = Join-Path $binDst "apps\web\data"
New-Item -ItemType Directory -Force -Path $webDataDst | Out-Null
# Pelne dane, bez whitelisty: kazdy ekran (Wykrojniki, Kampanie, Koszty) ma dane
# od pierwszego uruchomienia. Wykluczamy tylko smieci, logi, fat index i pliki per-maszyna.
# UWAGA: NIE dodawaj tu wzorcow "file-index.json.*" / "search-index.json.*".
# Robocopy (dopasowanie Win32) traktuje "nazwa.*" jak "nazwa" bez rozszerzenia,
# wiec wyklucza tez sam file-index.json - przez to kazda instalacja miala
# "Brak file-index.json (404)", pusty Eksplorer/Projekty i bridge_viz_index_404.
# Kopie zapasowe indeksow usuwamy po kopiowaniu, dokladnym regexem.
$xfData = $xfCommon + @(
  "*.tmp", "*.log", "*.jsonl", "*.lock.json", "dam-runtime.json", "dam-identity.json",
  "_refilter-*.json", "_ocr_batch_ids.json", "warm-*.json"
)
Invoke-Robo $webDataSrc $webDataDst @("thumbs", "_invoice_mail_stage", "__pycache__", "backups", "backup") $xfData
Get-ChildItem -LiteralPath $webDataDst -File |
  Where-Object { $_.Name -match '^(branding|file|search)-index\.json\..+' } |
  Remove-Item -Force
foreach ($req in @("file-index.json", "search-index.json")) {
  $reqPath = Join-Path $webDataDst $req
  if (-not (Test-Path -LiteralPath $reqPath) -or ((Get-Item -LiteralPath $reqPath).Length -lt 1000)) {
    throw "Brak $req w staging - Setup NIE moze wyjechac (Eksplorer, Projekty i Wizualizacje beda puste)."
  }
}
Write-Host "Indeksy OK: file-index.json $((Get-Item (Join-Path $webDataDst 'file-index.json')).Length) B"
$headSrc = Join-Path $webDataSrc "branding-grid-head.json"
$indexDst = Join-Path $webDataDst "branding-grid-index.json"
if ((-not (Test-Path -LiteralPath $indexDst) -or ((Get-Item -LiteralPath $indexDst).Length -lt 1000)) -and (Test-Path -LiteralPath $headSrc)) {
  Copy-Item -LiteralPath $headSrc -Destination $indexDst -Force
  Write-Host "Staged branding-grid-index.json from head (slim)."
}
$headDst = Join-Path $webDataDst "branding-grid-head.json"
if (-not (Test-Path -LiteralPath $headDst)) {
  throw "Brak branding-grid-head.json — Setup NIE moze wyjechac z pustym Brandingiem."
}
if ((Get-Item -LiteralPath $headDst).Length -lt 1000) {
  throw "branding-grid-head.json jest stubem (<1 KB) — Setup NIE moze wyjechac."
}
if (-not (Test-Path -LiteralPath $indexDst) -or ((Get-Item -LiteralPath $indexDst).Length -lt 1000)) {
  throw "branding-grid-index.json pusty/brak — Setup NIE moze wyjechac."
}
New-Item -ItemType Directory -Force -Path (Join-Path $webDataDst "thumbs") | Out-Null
$deskDataDst = Join-Path $binDst "apps\desktop\data"
New-Item -ItemType Directory -Force -Path $deskDataDst | Out-Null
$pgEx = Join-Path $BinRoot "apps\desktop\pg-config.example.json"
if (Test-Path -LiteralPath $pgEx) {
  Copy-Item -LiteralPath $pgEx -Destination (Join-Path $deskDataDst "pg-config.example.json") -Force
  Copy-Item -LiteralPath $pgEx -Destination (Join-Path $binDst "apps\desktop\pg-config.example.json") -Force
}
$pgCands = @(
  (Join-Path $BinRoot "apps\desktop\data\pg-config.json"),
  (Join-Path $env:LOCALAPPDATA "Programs\DAM\bin\apps\desktop\data\pg-config.json"),
  (Join-Path $BinRoot "apps\desktop\data\pg-config.json.off")
)
$pgSrc = $pgCands | Where-Object { Test-PgConfigSecret $_ } | Select-Object -First 1
if (-not $pgSrc) {
  throw "Brak passworded pg-config.json (gitignored). Setup NIE moze wyjechac — dummy user nie kopiuje nic. Poloz sekret w bin\apps\desktop\data\pg-config.json albo w zainstalowanym DAM."
}
# Audyt 2026-09-17: jawny pg-config.json w Setupie = haslo do bazy dla kazdego, kto pobierze
# instalator. Do Setupu idzie TYLKO szyfrogram; odblokowuje go kod aktywacyjny (pg_seal.py).
$sealScript = Join-Path $BinRoot "scripts\ops\seal-pg-config.py"
$sealedDst = Join-Path $deskDataDst "pg-config.sealed.json"
& $rtPyExe $sealScript --in $pgSrc --out $sealedDst
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $sealedDst)) {
  throw "Pieczetowanie pg-config nieudane (exit $LASTEXITCODE). Setup NIE moze wyjechac."
}
$pgSecret = [string](Get-Content -LiteralPath $pgSrc -Raw -Encoding UTF8 | ConvertFrom-Json).password
$leaks = @(Get-ChildItem -LiteralPath $stageRoot -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Length -lt 5MB -and $_.Extension -in @(".json", ".env", ".py", ".ps1", ".txt", ".off", ".ini", ".cfg", ".md") } |
  Where-Object { Select-String -LiteralPath $_.FullName -SimpleMatch -Pattern $pgSecret -Quiet })
if ($leaks.Count -gt 0) {
  throw ("Haslo bazy w staging (jawnie): " + (($leaks | ForEach-Object { $_.FullName }) -join "; "))
}
Remove-Variable pgSecret
# Klucz podpisujacy i kod aktywacyjny leza w bin\secrets (folder roboczy, 2026-09-18).
# Nigdy nie moga trafic do Setupu - sprawdzamy staging po nazwie i rozszerzeniu.
$secretLeaks = @(Get-ChildItem -LiteralPath $stageRoot -Recurse -File -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -eq ".pem" -or $_.Name -eq "activation-code.txt" -or $_.FullName -match '\\secrets\\' })
if ($secretLeaks.Count -gt 0) {
  throw ("Sekret w staging: " + (($secretLeaks | ForEach-Object { $_.FullName }) -join "; "))
}
Write-Host "Sealed pg-config (kod aktywacyjny poza Setupem). Jawnego hasla w staging brak."
New-Item -ItemType Directory -Force -Path (Join-Path $binDst "DATABASE") | Out-Null
$usersSeedSrc = Join-Path $BinRoot "DATABASE\users-seed.sqlite"
if (-not (Test-Path -LiteralPath $usersSeedSrc)) {
  $usersSeedSrc = Join-Path $BinRoot "apps\desktop\data\users-seed.sqlite"
}
$usersSeedDst = Join-Path $binDst "DATABASE\users-seed.sqlite"
if (Test-Path -LiteralPath $usersSeedSrc) {
  Copy-Item -LiteralPath $usersSeedSrc -Destination $usersSeedDst -Force
  Write-Host "Shipped DATABASE/users-seed.sqlite ($((Get-Item $usersSeedSrc).Length) bytes)"
} else {
  Write-Warning "Brak users-seed.sqlite - swieza instalacja bez kont!"
}
$readmeDb = Join-Path $BinRoot "DATABASE\README.md"
if (Test-Path -LiteralPath $readmeDb) {
  Copy-Item -LiteralPath $readmeDb -Destination (Join-Path $binDst "DATABASE\README.md") -Force
}
if (-not (Test-Path -LiteralPath (Join-Path $webDataDst "branding-index.json"))) {
  # -Encoding UTF8 w Windows PowerShell 5.1 dopisuje BOM: ijson (build-branding-grid-index.py)
  # padal na tym IncompleteJSONError zamiast zwrocic pusta liste - most nigdy nie odzyskiwal
  # lokalnych skojarzen po instalacji, bo auto-naprawa siatki przy starcie zawsze konczyla sie rc=1.
  [IO.File]::WriteAllText(
    (Join-Path $webDataDst "branding-index.json"),
    '{"version":1,"assets":[],"note":"slim-only-installer-use-branding-grid-head"}',
    (New-Object Text.UTF8Encoding $false)
  )
}

# Obrazy logowania + ikony — bez tego WebView pokazuje broken image.
$authJpg = Join-Path $binDst "apps\web\assets\img\auth\kubara-building.jpg"
if (-not (Test-Path -LiteralPath $authJpg) -or ((Get-Item -LiteralPath $authJpg).Length -lt 10000)) {
  throw "Brak kubara-building.jpg w staging — Setup NIE moze wyjechac bez zdjecia logowania."
}
Write-Host "Auth hero OK: $authJpg ($((Get-Item $authJpg).Length) B)"

# PAMIEC-PODRECZNA jedzie w Setup.exe (decyzja wlasciciela 2026-09-19): miniatury maja byc
# widoczne od pierwszego uruchomienia, takze bez dysku Marketing. Synology tylko aktualizuje.
$pamiecSrc = Join-Path $BinRoot "PAMIEC-PODRECZNA"
$pamiecDst = Join-Path $binDst "PAMIEC-PODRECZNA"
Invoke-Robo (Join-Path $pamiecSrc "thumbs") (Join-Path $pamiecDst "thumbs") @() @("*.tmp")
$thumbCount = @(Get-ChildItem -LiteralPath (Join-Path $pamiecDst "thumbs") -File -ErrorAction SilentlyContinue).Count
if ($thumbCount -lt 1000) {
  throw "PAMIEC: tylko $thumbCount miniatur w staging (zrodlo: $pamiecSrc). Setup NIE moze wyjechac bez cache."
}
$relSrc = Join-Path $pamiecSrc "thumb-rel-index.json"
if (Test-Path -LiteralPath $relSrc) {
  # Pod osobna nazwa: most scala go z lokalnym spisem, wiec aktualizacja nie kasuje wpisow uzytkownika.
  Copy-Item -LiteralPath $relSrc -Destination (Join-Path $pamiecDst "thumb-rel-index.bundled.json") -Force
}
Write-Host "PAMIEC: $thumbCount miniatur w Setup, spis: $(Test-Path -LiteralPath $relSrc)."

# README na ostatniej stronie kreatora generujemy z version.json przy kazdym
# buildzie. Wczesniej byl to plik pisany recznie i zostal na "DAM 6.0.2" -
# instalator 2.1.5 pokazywal na koncu wersje 6 i nieaktualne kroki.
# release_note, NIE note: note to rejestr licznika wersji (historia buildow),
# ktory po obcieciu do 300 znakow czytal sie jak smiec na ekranie uzytkownika.
$readmeNote = @()
try { $readmeNote = @([string[]]($vj.release_note -split "`n")) } catch { $readmeNote = @() }
$readmeNote = @($readmeNote | Where-Object { $_.Trim().Length -gt 0 })
$readmeLines = @(
  "DAM $Version - Dobra Kaloria (Inyfinn)",
  "",
  "Gotowe. Nic wiecej nie konfigurujesz i nic nie kopiujesz.",
  "",
  "Instalator wgral juz komplet:",
  "- program, skrot na pulpicie i w menu Start,",
  "- runtime Pythona z bibliotekami, ikony i fonty (Unicons + Jost),",
  "- polaczenie z baza (pg-config) - bez recznego kopiowania example,",
  "- konta startowe, dane ekranow (Wykrojniki, Kampanie, Koszty) i siatke Brandingu,",
  "- pamiec podreczna miniatur, wiec panel ma podglady od pierwszego uruchomienia.",
  "",
  "Uslugi w tle (podglady, odswiezanie listy plikow, aktualizacje) startuja same",
  "razem z Windows. Nie ma tu nic do wlaczania ani zakladania.",
  "",
  "Pierwsze uruchomienie: skrot ""DAM - Dobra Kaloria"" -> logowanie kontem z paczki.",
  "",
  "Aktualizacje: DAM sam sprawdza GitHub i pobiera najnowsze wydanie w tle.",
  "Recznie: menu profilu -> Sprawdz aktualizacje."
)
if ($readmeNote.Count -gt 0) {
  $readmeLines += @("", "Co nowego w ${Version}:") + $readmeNote
}
# Stopka: paczka zawsze mowi, z jakiego commita powstala.
$stamp = (Get-Date -Format "yyyy-MM-dd")
$buildLine = "Wersja $Version, zbudowana $stamp"
if ($buildCommit) { $buildLine += ", commit $buildCommit" }
if ($buildDirty) { $buildLine += " (+ zmiany lokalne, nie z commita)" }
$readmeLines += @("", $buildLine)
$readmePath = Join-Path $stageRoot "README.txt"
Set-Content -LiteralPath $readmePath -Value $readmeLines -Encoding UTF8
# Wersja w README musi zgadzac sie z budowana - inaczej build staje.
# Typowe slady podwojnego kodowania UTF-8 -> CP1250. Zakaz w regulach projektu:
# polskie znaki nie moga wyjechac polamane do uzytkownika.
$readmeText = Get-Content -LiteralPath $readmePath -Raw -Encoding UTF8
foreach ($bad in @("Ä", "Ĺ", "Å", "Â", "ď»ż")) {
  if ($readmeText.Contains($bad)) {
    throw "README.txt ma polamane polskie znaki (znaleziono '$bad') - popraw kodowanie i powtorz build."
  }
}
if (-not (Select-String -LiteralPath $readmePath -SimpleMatch "DAM $Version" -Quiet)) {
  throw "README.txt nie zawiera wersji $Version - koniec buildu."
}
Write-Host "README.txt wygenerowany dla wersji $Version."

$redistDir = Join-Path $BinRoot "installer\redist"
New-Item -ItemType Directory -Force -Path $redistDir | Out-Null
$vcRedist = Join-Path $redistDir "vc_redist.x64.exe"
if (-not (Test-Path $vcRedist)) {
  Write-Host "Downloading VC++ redist..."
  Invoke-WebRequest -Uri "https://aka.ms/vs/17/release/vc_redist.x64.exe" -OutFile $vcRedist -UseBasicParsing
}
$wv2Bootstrap = Join-Path $redistDir "MicrosoftEdgeWebview2Setup.exe"
if (-not (Test-Path $wv2Bootstrap)) {
  Write-Host "Downloading WebView2 bootstrapper..."
  Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $wv2Bootstrap -UseBasicParsing
}

# ISCC + podpis POZA Synology Drive (D: = cloud-drive reparse obcinal 90 MB exe
# -> "Plik zrodlowy jest uszkodzony"). Do repo idzie kopia sprawdzona SHA256.
$releaseDir = Join-Path $env:LOCALAPPDATA "DAM-build\out"
$repoReleaseDir = Join-Path $BinRoot "instalator"
New-Item -ItemType Directory -Force -Path $repoReleaseDir | Out-Null
$oldOut = Join-Path $releaseDir "DAM-Setup.exe"
if (Test-Path -LiteralPath $oldOut) { [IO.File]::Delete($oldOut) }
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$iss = Join-Path $BinRoot "installer\DAM-Setup.iss"
$signScript = Join-Path $PSScriptRoot "sign-dam-binaries.ps1"
$stageExe = Join-Path $stageRoot "DAM.exe"
if (-not (Test-Path -LiteralPath $signScript)) { throw "Brak $signScript" }
& $signScript -Path @($stageExe)
if ($LASTEXITCODE -ne 0) { throw "Podpis DAM.exe nieudany (exit $LASTEXITCODE)." }

$isccArgs = @(
  "/DMyAppVersion=$Version",
  "/DStageDir=$stageRoot",
  "/DGitRoot=$GitRoot",
  "/DReleaseDir=$releaseDir"
)
$signToolExe = $null
$cmdSign = Get-Command signtool.exe -ErrorAction SilentlyContinue
if ($cmdSign) { $signToolExe = $cmdSign.Source }
if (-not $signToolExe) {
  $kit = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter "signtool.exe" -ErrorAction SilentlyContinue |
    Where-Object { $_.DirectoryName -match '\\x64$' } | Sort-Object FullName -Descending | Select-Object -First 1
  if ($kit) { $signToolExe = $kit.FullName }
}
$tsUrl = $env:DAM_CODE_SIGN_TIMESTAMP
if (-not $tsUrl) { $tsUrl = "http://timestamp.digicert.com" }
if ($signToolExe -and ($env:DAM_CODE_SIGN_PFX -or $env:DAM_CODE_SIGN_THUMBPRINT)) {
  $signCmd = "`"$signToolExe`" sign /fd SHA256 /td SHA256 /tr $tsUrl `$f"
  if ($env:DAM_CODE_SIGN_PFX) {
    $signCmd = "`"$signToolExe`" sign /fd SHA256 /td SHA256 /tr $tsUrl /f `"$($env:DAM_CODE_SIGN_PFX)`""
    if ($env:DAM_CODE_SIGN_PASSWORD) { $signCmd += " /p `"$($env:DAM_CODE_SIGN_PASSWORD)`"" }
    $signCmd += " `$f"
  } elseif ($env:DAM_CODE_SIGN_THUMBPRINT) {
    $signCmd = "`"$signToolExe`" sign /fd SHA256 /td SHA256 /tr $tsUrl /sha1 $($env:DAM_CODE_SIGN_THUMBPRINT) `$f"
  }
  $isccArgs += "/DDamSignTool=1"
  $isccArgs += "/Sdamsigntool=$signCmd"
  Write-Host "ISCC SignTool=damsigntool (Authenticode)"
} else {
  Write-Host "ISCC bez SignTool (brak SDK albo PFX CA). DAM-Setup.exe podpisze PowerShell po kompilacji."
}

# Licencja w kreatorze = ta sama tresc, co strona Licencja w aplikacji (2026-09-22: kreator
# pokazywal tekst z 12.08 bez polskich znakow). DAM-Setup.iss czyta bin\installer\LICENSE.txt.
& $rtPyExe (Join-Path $BinRoot "scripts\ops\license-from-html.py") `
  --html (Join-Path $BinRoot "apps\web\license.html") `
  --version-json (Join-Path $BinRoot "apps\web\version.json") `
  --out (Join-Path $BinRoot "installer\LICENSE.txt")
if ($LASTEXITCODE -ne 0) { throw "Generowanie LICENSE.txt z license.html nieudane." }

& $Iscc @isccArgs $iss
if ($LASTEXITCODE -ne 0) { throw "ISCC failed: $LASTEXITCODE" }

$setupExe = Join-Path $releaseDir "DAM-Setup.exe"
if (-not (Test-Path $setupExe)) { throw "Brak $setupExe" }
& $signScript -Path @($setupExe)
if ($LASTEXITCODE -ne 0) { throw "Podpis DAM-Setup.exe nieudany (exit $LASTEXITCODE)." }
$setupSig = Get-AuthenticodeSignature -LiteralPath $setupExe
$outHash = (Get-FileHash -LiteralPath $setupExe -Algorithm SHA256).Hash
$repoExe = Join-Path $repoReleaseDir "DAM-Setup.exe"
try {
  [IO.File]::Copy($setupExe, $repoExe, $true)
  $repoHash = (Get-FileHash -LiteralPath $repoExe -Algorithm SHA256).Hash
  if ($repoHash -ne $outHash) { Write-Warning "Kopia w repo rozni sie od artefaktu (sync chmury). Uzywaj: $setupExe" }
  else { Write-Host "Kopia repo OK: $repoExe" }
} catch {
  Write-Warning "Nie skopiowano do repo: $($_.Exception.Message)"
}
Write-Host "SHA256 $outHash"
# Podpis wydania (Ed25519). Bez DAM-Setup.exe.sig w wydaniu GitHub aplikacje odrzuca aktualizacje.
$signRelease = Join-Path $BinRoot "scripts\ops\sign-release.py"
& $rtPyExe $signRelease sign $setupExe --version $Version
if ($LASTEXITCODE -ne 0) { throw "Podpis wydania (sign-release.py) nieudany. Najpierw: sign-release.py init" }
try { [IO.File]::Copy("$setupExe.sig", "$repoExe.sig", $true) } catch { Write-Warning "Nie skopiowano .sig do repo: $($_.Exception.Message)" }
Write-Host "Do wydania GitHub wgraj OBA pliki: DAM-Setup.exe i DAM-Setup.exe.sig"
$sizeMb = [math]::Round((Get-Item -LiteralPath $setupExe).Length / 1MB, 1)
Write-Host ""
Write-Host "GOTOWE - kliknij:"
Write-Host ('  {0}  ({1} MB)' -f $setupExe, $sizeMb)
Write-Host ('  Authenticode: {0}' -f $setupSig.Status)
if ($setupSig.SignerCertificate) {
  Write-Host ('  Wydawca: {0}' -f $setupSig.SignerCertificate.Subject)
}
if (-not $setupSig.SignerCertificate) {
  throw "DAM-Setup.exe nadal bez podpisu Authenticode."
}
if ($setupSig.Status -ne "Valid") {
  Write-Warning "Status=$($setupSig.Status). Self-signed: SmartScreen przy pliku z GitHuba moze zostac, dopoki nie bedzie certu OV/EV (DAM_CODE_SIGN_PFX). CODE-SIGNING.md"
}
Write-Host "Przed wydaniem przetestuj czysta instalacje: bin\scripts\ops\sandbox-smoke.wsb (Windows Sandbox, wyniki w C:\Temp\dam-sandbox-out)."
Write-Host ""

