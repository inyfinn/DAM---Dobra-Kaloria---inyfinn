<#
Migracja 2.3.6: stabilne id materialow Brandingu (zloty stan -> obie bazy SQLite -> PostgreSQL).
Autoryzacja: Krzysztof, 2026-09-23 ("dokoncz, masz tylko uwazac, by niczego nie zepsuc").

Kazdy krok robi kopie przed zapisem i przerywa przy bledzie:
  1. zatrzymuje zlota aplikacje (pliki danych nie moga byc zapisywane w trakcie),
  2. migracja plikow danych zlotej aplikacji + obu baz SQLite (kopie *.pre-stable-ids-<czas>),
  3. migracja plikow danych repo (instalator bierze dane z repo),
  4. seed powiazan SKU/OCR i nadpisan od nowa na stabilnych id (obie bazy),
  5. PostgreSQL: kopia tabeli, usuniecie starych id, wgranie zmigrowanych, epoka stable-1.
Nic nie kasuje plikow. Log: bin\scripts\ops\migrate-stable-ids.log
#>
param(
    [string]$App = "C:\Users\krzysztof.wieczorek\AppData\Local\DAM-nowy-uzytkownik",
    [switch]$SkipPg
)
$ErrorActionPreference = "Stop"
$Repo = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$Bin = Join-Path $Repo "bin"
$AppBin = Join-Path $App "bin"
$Py = Join-Path $AppBin "runtime\win\python\python.exe"
# Log i raporty poza folderem synchronizowanym przez Synology Drive (D:): Drive blokowal
# plik logu w trakcie zapisu i przerwal przebieg (23.09, 09:35).
$Work = Join-Path $env:LOCALAPPDATA "DAM-migrate-stable-ids"
New-Item -ItemType Directory -Force $Work | Out-Null
$Log = Join-Path $Work "migrate-stable-ids.log"
$Report = Join-Path $Work "report"
New-Item -ItemType Directory -Force $Report | Out-Null

function Say($m) {
    $l = "{0}  {1}" -f (Get-Date -Format "HH:mm:ss"), $m
    Write-Host $l
    try { [IO.File]::AppendAllText($Log, $l + [Environment]::NewLine) } catch { }
}
function Run($label, [string[]]$argv) {
    Say "== $label"
    & $Py @argv 2>&1 | ForEach-Object { Say "   $_" }
    if ($LASTEXITCODE -ne 0) { throw "$label nieudane (exit $LASTEXITCODE)" }
}

foreach ($p in @($Bin, $AppBin, $Py)) { if (-not (Test-Path $p)) { throw "Brak: $p" } }
Say "repo=$Repo app=$App"

# 1. zatrzymanie zlotej aplikacji (tylko procesy z tego folderu)
$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like "*$App*" -and $_.Name -match "python|DAM" }
foreach ($p in $procs) { Say "stop pid=$($p.ProcessId) $($p.Name)"; Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep 3

$snap = Join-Path $Bin "apps\web\data\branding-grid-index.json.bak-1789644977"
$ocr = Join-Path $Bin "apps\desktop\data\ocr-assoc-batch.jsonl"
$mig = Join-Path $Bin "apps\web\scripts\migrate-stable-asset-ids.py"
$appDb = Join-Path $AppBin "DATABASE\dam-local.sqlite"
$repoDb = Join-Path $Bin "DATABASE\dam-local.sqlite"

# 2. zloty stan + obie bazy
Run "migracja zlotej aplikacji + bazy" @($mig, "--web", (Join-Path $AppBin "apps\web"), "--snapshot", $snap, "--ocr-jsonl", $ocr, "--db", $appDb, "--db", $repoDb, "--report", (Join-Path $Report "app.json"), "--apply")
# 3. dane repo (bez baz - juz zrobione)
Run "migracja danych repo" @($mig, "--web", (Join-Path $Bin "apps\web"), "--snapshot", $snap, "--ocr-jsonl", $ocr, "--report", (Join-Path $Report "repo.json"), "--apply")

# 4. seed na stabilnych id: kopia skryptu seedu z repo, uruchamiany w kontekscie zlotej aplikacji
$seed = Join-Path $Bin "apps\desktop\scripts\seed-asset-product-links.py"
$appSeed = Join-Path $AppBin "apps\desktop\scripts\seed-asset-product-links.py"
Copy-Item $seed $appSeed -Force
foreach ($pair in @(@("app", $appDb), @("repo", $repoDb))) {
    $db = $pair[1]
    # seed_overrides wykonuje sie w tym samym przebiegu (seed-asset-product-links.py:830)
    Run "seed SKU/OCR + nadpisania -> $db" @($appSeed, "--db", $db, "--strong-only", "--apply", "--report", (Join-Path $Report ("seed-" + $pair[0] + ".json")))
}

# 5. PostgreSQL
if (-not $SkipPg) {
    Push-Location (Join-Path $AppBin "apps\desktop")
    try { Run "PostgreSQL" @((Join-Path $Bin "apps\desktop\scripts\migrate-pg-stable-asset-ids.py"), "--db", $appDb, "--apply") }
    finally { Pop-Location }
}
Say "KONIEC - raporty w $Report"
