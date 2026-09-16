#Requires -Version 5.1
param(
  [switch]$SkipSync,
  [switch]$SkipVendor,
  [switch]$SkipExeBuild,
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"

function Remove-TreeForce([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $full = (Resolve-Path -LiteralPath $Path).Path
  $long = if ($full.StartsWith('\\?\')) { $full } else { "\\?\$full" }
  cmd /c "rmdir /s /q `"$long`"" | Out-Null
}

function Invoke-Robo([string]$src, [string]$dst, [string[]]$xd, [string[]]$xf) {
  if (-not (Test-Path -LiteralPath $src)) { return }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  $rcArgs = @($src, $dst, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np", "/XJ", "/XJD")
  if ($xd -and $xd.Count -gt 0) { $rcArgs += "/XD"; $rcArgs += $xd }
  if ($xf -and $xf.Count -gt 0) { $rcArgs += "/XF"; $rcArgs += $xf }
  & robocopy @rcArgs | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE): $src" }
}

function Test-ThumbMagic([byte[]]$bytes) {
  if ($null -eq $bytes -or $bytes.Length -lt 12) { return $false }
  if ($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8) { return $true } # JPEG
  $brand = [Text.Encoding]::ASCII.GetString($bytes, 4, [Math]::Min(8, $bytes.Length - 4))
  return ($brand -like 'ftyp*')
}

function Copy-PamiecMaterialized([string]$src, [string]$dst) {
  <#
    Dropbox FeRp reparse (0x9000601a) na D:\ — robocopy zostawia placeholdery;
    Inno potem wypluwa "Plik zrodlowy jest uszkodzony". Czytamy bajty (hydrate)
    i zapisujemy zwykle pliki Archive w staging.
  #>
  if (-not (Test-Path -LiteralPath $src)) { throw "Brak PAMIEC zrodla: $src" }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  $srcFull = (Resolve-Path -LiteralPath $src).Path.TrimEnd('\')
  $copied = 0
  $skipped = 0
  Get-ChildItem -LiteralPath $src -Recurse -File -ErrorAction Stop | ForEach-Object {
    $name = $_.Name
    if ($name -like '*.tmp' -or $name -like '*.lock') { $skipped++; return }
    $rel = $_.FullName.Substring($srcFull.Length).TrimStart('\')
    if ($rel -match '(^|\\)(__pycache__|_probe)(\\|$)') { $skipped++; return }
    $out = Join-Path $dst $rel
    $outDir = Split-Path -Parent $out
    if (-not (Test-Path -LiteralPath $outDir)) {
      New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    }
    try {
      $bytes = [IO.File]::ReadAllBytes($_.FullName)
    } catch {
      Write-Warning "Pomijam (odczyt): $rel — $($_.Exception.Message)"
      $skipped++
      return
    }
    if ($bytes.Length -lt 32 -or -not (Test-ThumbMagic $bytes)) {
      Write-Warning "Pomijam (magia/rozmiar): $rel ($($bytes.Length) B)"
      $skipped++
      return
    }
    [IO.File]::WriteAllBytes($out, $bytes)
    $copied++
    if (($copied % 1000) -eq 0) { Write-Host "  materialized $copied..." }
  }
  Write-Host "PAMIEC materialized: copied=$copied skipped=$skipped"
  if ($copied -lt 1000) {
    throw "Za malo zmaterializowanych thumbs ($copied). Dropbox offline albo cache pusty."
  }
}

function Assert-StagedThumbsHealthy([string]$thumbsDir) {
  $reparse = 0
  $bad = 0
  $ok = 0
  Get-ChildItem -LiteralPath $thumbsDir -File -Recurse -ErrorAction Stop | ForEach-Object {
    if (($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      $reparse++
      return
    }
    try {
      $fs = [IO.File]::Open($_.FullName, 'Open', 'Read', 'Read')
      $buf = New-Object byte[] 12
      [void]$fs.Read($buf, 0, 12)
      $fs.Close()
      if (Test-ThumbMagic $buf) { $ok++ } else { $bad++ }
    } catch { $bad++ }
  }
  Write-Host "Staged thumbs health: ok=$ok reparse=$reparse bad=$bad"
  if ($reparse -gt 0) {
    throw "Staging PAMIEC nadal ma $reparse plikow ReparsePoint (Dropbox). Nie wolno pakowac."
  }
  if ($bad -gt 0) {
    throw "Staging PAMIEC ma $bad plikow bez magii AVIF/JPEG."
  }
  if ($ok -lt 1000) {
    throw "Staging PAMIEC ma tylko $ok zdrowych thumbs."
  }
}

$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$BinRoot = Join-Path $GitRoot "bin"

$Iscc = Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $Iscc)) {
  $alt = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($alt) { $Iscc = $alt } else { throw "Brak ISCC.exe (zainstaluj Inno Setup 6)." }
}

if (-not $Version) {
  $verJson = Join-Path $BinRoot "apps\web\version.json"
  if (Test-Path $verJson) {
    try {
      $vj = Get-Content $verJson -Raw | ConvertFrom-Json
      if ($vj.version) { $Version = [string]$vj.version }
    } catch {}
  }
  if (-not $Version) { $Version = "5.0.130" }
}

Write-Host "GIT_ROOT=$GitRoot Version=$Version"
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

$stageRoot = Join-Path $BinRoot "dist\staging\DAM-install"
Remove-TreeForce $stageRoot
New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
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
  "__pycache__", ".venv", "node_modules", "webview2-profile", "logs", "_qa",
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
function Test-PgConfigSecret([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  try {
    $j = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    $pw = [string]$j.password
    $portOk = ([string]$j.port) -eq "5433"
    $dbOk = ([string]$j.dbname) -eq "dam_eta"
    return ($pw.Length -ge 8) -and $portOk -and $dbOk
  } catch {
    return $false
  }
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
$xfData = $xfCommon + @(
  "*.tmp", "*.log", "*.jsonl", "*.lock.json", "dam-runtime.json", "dam-identity.json",
  "branding-index.json.*", "file-index.json.*", "search-index.json.*",
  "_refilter-*.json", "_ocr_batch_ids.json", "warm-*.json"
)
Invoke-Robo $webDataSrc $webDataDst @("thumbs", "_invoice_mail_stage", "__pycache__", "backups", "backup") $xfData
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
  (Join-Path $env:LOCALAPPDATA "Programs\DAM\bin\apps\desktop\data\pg-config.json"),
  (Join-Path $BinRoot "apps\desktop\data\pg-config.json"),
  (Join-Path $BinRoot "apps\desktop\data\pg-config.json.off")
)
$pgSrc = $pgCands | Where-Object { Test-PgConfigSecret $_ } | Select-Object -First 1
if (-not $pgSrc) {
  throw "Brak passworded pg-config.json (gitignored). Setup NIE moze wyjechac — dummy user nie kopiuje nic. Poloz sekret w bin\apps\desktop\data\pg-config.json albo w zainstalowanym DAM."
}
Copy-Item -LiteralPath $pgSrc -Destination (Join-Path $deskDataDst "pg-config.json") -Force
Copy-Item -LiteralPath $pgSrc -Destination (Join-Path $binDst "apps\desktop\pg-config.json") -Force
Write-Host "Embedded pg-config.json (Synology, passworded) from build-machine secret. Not committed."
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
  Set-Content -Path (Join-Path $webDataDst "branding-index.json") -Value '{"version":1,"assets":[],"note":"slim-only-installer-use-branding-grid-head"}' -Encoding UTF8
}

# Obrazy logowania + ikony — bez tego WebView pokazuje broken image.
$authJpg = Join-Path $binDst "apps\web\assets\img\auth\kubara-building.jpg"
if (-not (Test-Path -LiteralPath $authJpg) -or ((Get-Item -LiteralPath $authJpg).Length -lt 10000)) {
  throw "Brak kubara-building.jpg w staging — Setup NIE moze wyjechac bez zdjecia logowania."
}
Write-Host "Auth hero OK: $authJpg ($((Get-Item $authJpg).Length) B)"

# Cala pamiec podreczna (AVIF) w instalatorze — first paint bez NAS.
$pamiecSrc = Join-Path $BinRoot "PAMIEC-PODRECZNA"
$pamiecDst = Join-Path $binDst "PAMIEC-PODRECZNA"
$thumbsSrc = Join-Path $pamiecSrc "thumbs"
if (-not (Test-Path -LiteralPath $thumbsSrc)) {
  throw "Brak bin\PAMIEC-PODRECZNA\thumbs — Setup NIE moze wyjechac bez cache."
}
$thumbCount = (Get-ChildItem -LiteralPath $thumbsSrc -File -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
if ($thumbCount -lt 1000) {
  throw "PAMIEC-PODRECZNA\thumbs ma tylko $thumbCount plikow (<1000). Uzupelnij cache przed buildem."
}
Write-Host "Staging PAMIEC-PODRECZNA ($thumbCount thumbs) — materialize Dropbox reparse..."
Copy-PamiecMaterialized $pamiecSrc $pamiecDst
$thumbDstCount = (Get-ChildItem -LiteralPath (Join-Path $pamiecDst "thumbs") -File -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
if ($thumbDstCount -lt 1000) {
  throw "Staging PAMIEC niekompletny ($thumbDstCount)."
}
Assert-StagedThumbsHealthy (Join-Path $pamiecDst "thumbs")
Write-Host "Shipped PAMIEC-PODRECZNA thumbs=$thumbDstCount (no reparse)"

$readmeSrc = Join-Path $BinRoot "installer\README.txt"
if (Test-Path $readmeSrc) { Copy-Item $readmeSrc (Join-Path $stageRoot "README.txt") -Force }

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

$releaseDir = Join-Path $BinRoot "instalator"
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

& $Iscc @isccArgs $iss
if ($LASTEXITCODE -ne 0) { throw "ISCC failed: $LASTEXITCODE" }

$setupExe = Join-Path $releaseDir "DAM-Setup.exe"
if (-not (Test-Path $setupExe)) { throw "Brak $setupExe" }
& $signScript -Path @($setupExe)
if ($LASTEXITCODE -ne 0) { throw "Podpis DAM-Setup.exe nieudany (exit $LASTEXITCODE)." }
$stageExe = Join-Path $env:LOCALAPPDATA "DAM-sign\DAM-Setup.exe"
$setupSig = Get-AuthenticodeSignature -LiteralPath $setupExe
if ((-not $setupSig.SignerCertificate) -and (Test-Path -LiteralPath $stageExe)) {
  $stageSig = Get-AuthenticodeSignature -LiteralPath $stageExe
  if ($stageSig.SignerCertificate) {
    Write-Warning "Dropbox/reparse obcial podpis w $setupExe — przywracam z $stageExe"
    [IO.File]::Copy($stageExe, $setupExe, $true)
    $setupSig = Get-AuthenticodeSignature -LiteralPath $setupExe
    if (-not $setupSig.SignerCertificate) {
      $setupExe = $stageExe
      $setupSig = $stageSig
      Write-Warning "Repo nadal bez podpisu. Artefakt do GitHub Release: $stageExe"
    }
  }
}
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
Write-Host ""

