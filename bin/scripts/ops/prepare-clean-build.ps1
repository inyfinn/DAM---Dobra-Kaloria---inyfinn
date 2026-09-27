#Requires -Version 5.1
<#
.SYNOPSIS
  Przygotuj czyste drzewo (dokladnie stan z commita HEAD) do budowy instalatora,
  poza folderem synchronizowanym przez Synology Drive.

.OPIS
  Aplikacja uruchomiona z tego repo zmienia sledzone pliki w bin/apps/web/data
  (file-index.json, campaigns.json, search-index.json, app-settings.json,
  branding-grid-head.json i inne) - build-installer.ps1 pakuje wtedy do Setupu
  stan z dysku, nie stan z commita. Ten skrypt tworzy osobny checkout HEAD
  przez `git worktree add --detach` (NIE clone, NIE checkout w biezacym
  drzewie - bierzace drzewo zostaje nietkniete) i dokleja do niego to, czego
  build potrzebuje, a czego nie ma w commicie (bo jest gitignored albo za
  duze na tracking): runtime Pythona, cache miniatur, redist, DAM.exe,
  lokalny toolchain Go z work/, oraz biezace pliki indeksow.

  NIE kopiuje bin/secrets (klucz podpisu, kod aktywacyjny) - tylko wypisuje,
  co i gdzie trzeba wskazac osobno.

  Tego skryptu NIE uruchamiamy tutaj - tylko sprawdzamy parserem PowerShell.
#>
param(
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path

if (-not $Version) {
  $verJson = Join-Path $GitRoot "bin\apps\web\version.json"
  if (Test-Path -LiteralPath $verJson) {
    try {
      $vj = Get-Content -LiteralPath $verJson -Raw -Encoding UTF8 | ConvertFrom-Json
      $Version = [string]$vj.version
    } catch {
      $Version = ""
    }
  }
}
if (-not $Version) { $Version = "unknown" }

$commit = (& git -C $GitRoot rev-parse --short HEAD 2>$null | Select-Object -First 1)
if (-not $commit) { throw "Nie udalo sie ustalic commita HEAD (git rev-parse --short HEAD)." }

if (-not $env:LOCALAPPDATA -or -not [System.IO.Path]::IsPathRooted($env:LOCALAPPDATA)) {
  throw "LOCALAPPDATA puste albo wzgledne - przerywam (katalog docelowy musi miec sciezke bezwzgledna)."
}
$dst = Join-Path $env:LOCALAPPDATA "DAM-build\src-$Version-$commit"

# Odmawiamy, gdy katalog docelowy juz istnieje - nie nadpisujemy cudzej pracy.
if (Test-Path -LiteralPath $dst) {
  throw "Katalog docelowy juz istnieje: $dst - usun go recznie (to nie jest repo, wolno) albo podaj inna wersje/commit."
}

Write-Host "GIT_ROOT (zrodlo)   = $GitRoot"
Write-Host "Wersja/commit       = $Version / $commit"
Write-Host "Katalog docelowy    = $dst (poza Synology Drive - w LOCALAPPDATA)"
Write-Host ""
Write-Host "Tworze czysty worktree HEAD ($commit) przez 'git worktree add --detach' ..."

& git -C $GitRoot worktree add --detach $dst HEAD
if ($LASTEXITCODE -ne 0) { throw "git worktree add nie powiodl sie (exit $LASTEXITCODE)." }
Write-Host "Worktree gotowy: $dst (dokladnie stan z commita $commit, bez lokalnych zmian w bin/apps/web/data)."
Write-Host ""

function Copy-GitignoredTree([string]$relSrc, [string]$relDst, [string[]]$xd, [string[]]$xf) {
  $src = Join-Path $GitRoot $relSrc
  if (-not (Test-Path -LiteralPath $src)) {
    Write-Warning "Brak zrodla (pomijam): $src"
    return
  }
  $dstPath = Join-Path $dst $relDst
  New-Item -ItemType Directory -Force -Path $dstPath | Out-Null
  $rcArgs = @($src, $dstPath, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np", "/XJ", "/XJD")
  if ($xd -and $xd.Count -gt 0) { $rcArgs += "/XD"; $rcArgs += $xd }
  if ($xf -and $xf.Count -gt 0) { $rcArgs += "/XF"; $rcArgs += $xf }
  # Zwykle kopiowanie: bez /MIR, /PURGE, /MOVE - zrodlo zostaje nietkniete.
  & robocopy @rcArgs | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE): $src -> $dstPath" }
  Write-Host "Skopiowano (gitignored, build input): $relSrc -> $relDst"
}

Copy-GitignoredTree "bin\runtime" "bin\runtime" @() @()
Copy-GitignoredTree "bin\PAMIEC-PODRECZNA" "bin\PAMIEC-PODRECZNA" @() @("*_Conflict*", "*conflict_current*")
Copy-GitignoredTree "bin\installer\redist" "bin\installer\redist" @() @()
Copy-GitignoredTree "work\tooling\go" "work\tooling\go" @() @()

$damSrc = Join-Path $GitRoot "DAM.exe"
if (Test-Path -LiteralPath $damSrc) {
  Copy-Item -LiteralPath $damSrc -Destination (Join-Path $dst "DAM.exe") -Force
  Write-Host "Skopiowano DAM.exe (build-installer.ps1 -SkipExeBuild moglby go uzyc jesli aktualny; domyslnie i tak przebuduje z work\tooling\go)."
} else {
  Write-Warning "Brak GIT_ROOT\DAM.exe - build-dam-root-exe.ps1 zbuduje go od nowa z work\tooling\go\bin\go.exe."
}

# Pliki indeksow, ktorych build potrzebuje, a nie ma ich w commicie (zywy stan
# aplikacji, gitignored) - ta sama lista co "onlyifdoesntexist" w DAM-Setup.iss.
$dataFiles = @(
  "app-settings.json", "branding-build-status.json", "branding-grid-head.json",
  "branding-grid-index.json", "branding-search-index.json", "campaigns.json",
  "file-index.json", "lifecycle-status.json", "product-people.json", "search-index.json",
  "thumb-cache-manifest.json", "program-instructions.json"
)
$dataSrcDir = Join-Path $GitRoot "bin\apps\web\data"
$dataDstDir = Join-Path $dst "bin\apps\web\data"
New-Item -ItemType Directory -Force -Path $dataDstDir | Out-Null
$copiedData = 0
foreach ($f in $dataFiles) {
  $s = Join-Path $dataSrcDir $f
  # Plik z commita wygrywa: zywy stan z dysku uzupelnia tylko to, czego w commicie nie ma.
  if ((Test-Path -LiteralPath $s) -and -not (Test-Path -LiteralPath (Join-Path $dataDstDir $f))) {
    Copy-Item -LiteralPath $s -Destination (Join-Path $dataDstDir $f)
    $copiedData++
  }
}
Write-Host "Skopiowano $copiedData/$($dataFiles.Count) plikow indeksow bin\apps\web\data (gitignored, wymagane przez staging)."

Write-Host ""
Write-Host "=== bin\secrets NIE skopiowane (celowo) ===" -ForegroundColor Yellow
Write-Host "Klucz podpisu wydania (Ed25519, sign-release.py) czyta bin\secrets\release-signing-key.pem"
Write-Host "w folderze roboczym ALBO zmienna srodowiskowa DAM_RELEASE_KEY (pelna sciezka do pliku)."
Write-Host "build-installer.ps1 NIE MA parametru -SigningKeyPath (sprawdzone w tym skrypcie i w"
Write-Host "sign-release.py/sign-dam-binaries.ps1) - jedyna droga bez recznego kopiowania klucza:"
Write-Host "  `$env:DAM_RELEASE_KEY = 'D:\...\bin\secrets\release-signing-key.pem'"
Write-Host "przed uruchomieniem build-installer.ps1 w $dst."
Write-Host ""
Write-Host "=== bin\apps\desktop\data\pg-config.json NIE skopiowane (sekret - haslo bazy) ===" -ForegroundColor Yellow
Write-Host "build-installer.ps1 sam przerwie budowe czytelnym bledem, jesli go tam nie bedzie."
Write-Host "Poloz recznie: $dst\bin\apps\desktop\data\pg-config.json"
Write-Host ""
Write-Host "GOTOWE: $dst"
Write-Host "Nastepny krok (recznie, w nowym oknie PowerShell):"
Write-Host "  cd `"$dst`""
Write-Host "  bin\scripts\ops\build-installer.ps1"
