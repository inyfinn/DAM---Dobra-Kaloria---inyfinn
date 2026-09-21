#Requires -Version 5.1
<#
  Test czystej instalacji DAM (Windows Sandbox lub -LocalDir bez sandboksa).

  JAK UZYWAC w Windows Sandbox (na maszynie budujacej, nie w sandboksie):
    1. Zbuduj instalator: bin\scripts\ops\build-installer.ps1
    2. Utworz folder na wyniki, domyslnie:  mkdir C:\Temp\dam-sandbox-out
    3. Sprawdz sciezki HostFolder w bin\scripts\ops\sandbox-smoke.wsb
       (folder z DAM-Setup.exe = tylko odczyt, folder wynikow = do zapisu).
    4. Kliknij dwukrotnie sandbox-smoke.wsb. Sandbox sam uruchomi ten skrypt.
    5. Po ok. 3 minutach zajrzyj do folderu wynikow:
       summary.json (PASS/FAIL), health.json, preflight.json, processes.txt, install.log

  JAK UZYWAC bez Windows Sandbox (konto bez uprawnien administratora, Sandbox
  niewlaczony) - parametr -LocalDir:
    powershell -File sandbox-smoke.ps1 -LocalDir C:\DAM-nowy-uzytkownik `
      -Installer C:\dam-setup\DAM-Setup.exe -OutDir C:\dam-results-local

  Co sprawdza: cicha instalacja, start DAM.exe, odpowiedz mostu na /health
  i /preflight (max WaitSeconds), lista procesow (w trybie -LocalDir tylko
  python/pythonw/ssh/git z pelna linia polecenia). Nie dotyka bazy
  produkcyjnej poza tym, co robi sam program przy starcie.

  WYNIK = FAIL rowniez wtedy, gdy /preflight odpowiedzial, ale zglasza
  chociaz jedna blokujaca pozycje (blocking niepuste) - odpowiedz sama w
  sobie NIE jest dowodem PASS.
#>
param(
  [string]$SetupDir = "C:\dam-setup",
  [string]$OutDir = "C:\dam-results",
  [int]$WaitSeconds = 120,
  [string]$BridgeUrl = "http://127.0.0.1:8766",
  [string]$LocalDir = "",
  [string]$Installer = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step([string]$Text) {
  Write-Host ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $Text)
}

function Save-Text([string]$Name, [string]$Text) {
  $path = Join-Path $OutDir $Name
  Set-Content -LiteralPath $path -Value $Text -Encoding utf8
}

$summary = [ordered]@{
  started_at = (Get-Date).ToString("s")
  mode = if ($LocalDir) { "local" } else { "sandbox" }
  setup_exe = ""
  setup_sha256 = ""
  install_exit_code = $null
  install_path = ""
  bridge_up_after_sec = $null
  health_ok = $false
  preflight_ok = $false
  preflight_blocking = @()
  result = "FAIL"
  error = ""
}

function Get-DamProcessesLocal() {
  # -LocalDir (bez Windows Sandbox): lista python/pythonw/ssh/git z pelna
  # linia polecenia - dowod izolacji ("zero ssh.exe/git.exe uruchomionego
  # przez DAM" wymaga CommandLine, nie tylko nazwy procesu).
  $names = @("python", "pythonw", "ssh", "git")
  try {
    Get-CimInstance Win32_Process |
      Where-Object {
        $n = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
        $names -contains $n.ToLowerInvariant()
      } |
      Select-Object -Property ProcessId, Name, ExecutablePath, CommandLine |
      Format-Table -AutoSize | Out-String -Width 400
  } catch {
    "Get-CimInstance Win32_Process nie zadzialal: $($_.Exception.Message)"
  }
}

function Wait-DamBridge([string]$BaseUrl, [int]$TimeoutSeconds) {
  $waitStart = Get-Date
  $deadline = $waitStart.AddSeconds($TimeoutSeconds)
  $health = $null
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri ($BaseUrl + "/health") -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) {
        $health = $r.Content
        break
      }
    } catch {
      Start-Sleep -Seconds 3
    }
  }
  $upSec = [int][math]::Round(((Get-Date) - $waitStart).TotalSeconds)
  return @{ health = $health; up_after_sec = $upSec }
}

function Test-DamThumbs([string]$InstallPath, [string]$BaseUrl) {
  # Swiezy PC bez dysku Marketing: miniatury musza przyjsc z cache z instalatora, od razu.
  $pamiec = Join-Path $InstallPath "bin\PAMIEC-PODRECZNA"
  $out = [ordered]@{ installed = 0; tried = 0; ok = 0; max_ms = 0; ok_pct = 0 }
  $out.installed = @(Get-ChildItem -LiteralPath (Join-Path $pamiec "thumbs") -File -ErrorAction SilentlyContinue).Count
  $idxPath = Join-Path $pamiec "thumb-rel-index.bundled.json"
  if (-not (Test-Path -LiteralPath $idxPath)) { return $out }
  $idx = Get-Content -LiteralPath $idxPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $keys = @($idx.PSObject.Properties.Name | Where-Object { $_ -like "*|grid" } | Select-Object -First 40)
  foreach ($k in $keys) {
    $rel = $k.Substring(0, $k.Length - 5)
    $url = $BaseUrl + "/thumb-cache?profile=grid&path=" + [uri]::EscapeDataString("X:/Marketing/" + $rel)
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
      if ($r.StatusCode -eq 200 -and $r.RawContentLength -gt 100) { $out.ok++ }
    } catch { }
    $sw.Stop()
    $out.tried++
    if ($sw.ElapsedMilliseconds -gt $out.max_ms) { $out.max_ms = [int]$sw.ElapsedMilliseconds }
  }
  if ($out.tried -gt 0) { $out.ok_pct = [int](100 * $out.ok / $out.tried) }
  return $out
}

function Get-DamPreflight([string]$BaseUrl) {
  try {
    $rp = Invoke-WebRequest -Uri ($BaseUrl + "/preflight") -UseBasicParsing -TimeoutSec 10
    return $rp.Content
  } catch {
    return ""
  }
}

try {
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

  if ($LocalDir) {
    # --- Trybu -LocalDir: instalacja bez Windows Sandbox, bezposrednio do wskazanego katalogu ---
    if (-not $Installer) { $Installer = Join-Path $SetupDir "DAM-Setup.exe" }
    if (-not (Test-Path -LiteralPath $Installer)) { throw "Brak instalatora $Installer (podaj -Installer)" }
    $summary.setup_exe = $Installer
    $summary.setup_sha256 = (Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash
    Write-Step ("Instalator: {0}  SHA256 {1}" -f $Installer, $summary.setup_sha256)

    $installLog = Join-Path $OutDir "install.log"
    Write-Step ("Cicha instalacja do {0} (/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR=...)..." -f $LocalDir)
    $proc = Start-Process -FilePath $Installer `
      -ArgumentList @("/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/SP-", "/DIR=$LocalDir", "/LOG=$installLog") `
      -Wait -PassThru
    $summary.install_exit_code = $proc.ExitCode
    if ($proc.ExitCode -ne 0) { throw "Instalator zwrocil kod $($proc.ExitCode)" }

    $summary.install_path = $LocalDir
    $exe = Join-Path $LocalDir "DAM.exe"
    if (-not (Test-Path -LiteralPath $exe)) { throw "Brak $exe po instalacji" }
    Write-Step ("Start {0}" -f $exe)
    Start-Process -FilePath $exe -WorkingDirectory $LocalDir | Out-Null

    $wait = Wait-DamBridge -BaseUrl $BridgeUrl -TimeoutSeconds $WaitSeconds
    if (-not $wait.health) { throw "Most nie odpowiedzial na /health w $WaitSeconds s" }
    $summary.bridge_up_after_sec = $wait.up_after_sec
    $summary.health_ok = $true
    Save-Text "health.json" $wait.health
    Write-Step "GET /health OK"

    $preflight = Get-DamPreflight -BaseUrl $BridgeUrl
    if ($preflight) {
      Save-Text "preflight.json" $preflight
      $summary.preflight_ok = $true
      try {
        $pf = $preflight | ConvertFrom-Json
        if ($pf.blocking) { $summary.preflight_blocking = @($pf.blocking) }
        foreach ($item in $pf.items) {
          Write-Step ("  preflight {0}: ok={1} {2}" -f $item.id, $item.ok, $item.label)
        }
      } catch {
        Write-Warning "preflight.json nie parsuje sie jako JSON"
      }
    } else {
      Write-Warning "GET /preflight bez odpowiedzi (starsza wersja mostu?)"
    }

    $procs = Get-DamProcessesLocal
    Save-Text "processes.txt" $procs

    if ($summary.health_ok -and $summary.preflight_ok -and ($summary.preflight_blocking.Count -eq 0)) {
      $summary.result = "PASS"
    }
  } else {
    # --- Tryb Windows Sandbox (domyslny, bez zmian w mechanice instalacji) ---
    $setup = Join-Path $SetupDir "DAM-Setup.exe"
    if (-not (Test-Path -LiteralPath $setup)) { throw "Brak $setup (sprawdz MappedFolder w .wsb)" }
    $summary.setup_exe = $setup
    $summary.setup_sha256 = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash
    Write-Step ("Instalator: {0}  SHA256 {1}" -f $setup, $summary.setup_sha256)

    $installLog = Join-Path $OutDir "install.log"
    Write-Step "Cicha instalacja (/VERYSILENT /NORESTART /SUPPRESSMSGBOXES)..."
    $proc = Start-Process -FilePath $setup `
      -ArgumentList @("/VERYSILENT", "/NORESTART", "/SUPPRESSMSGBOXES", "/SP-", "/LOG=$installLog") `
      -Wait -PassThru
    $summary.install_exit_code = $proc.ExitCode
    if ($proc.ExitCode -ne 0) { throw "Instalator zwrocil kod $($proc.ExitCode)" }

    $installPath = ""
    try {
      $reg = Get-ItemProperty -Path "HKCU:\Software\Inyfinn\DAM" -ErrorAction Stop
      $installPath = [string]$reg.InstallPath
    } catch {
      $installPath = ""
    }
    if (-not $installPath) {
      # Domyslna sciezka instalatora (DAM-Setup.iss DefaultDirName) - nie stara "DAM - Dobra Kaloria".
      $guess = Join-Path $env:LOCALAPPDATA "Programs\DAM"
      if (Test-Path -LiteralPath $guess) { $installPath = $guess }
    }
    if (-not $installPath) { throw "Nie znaleziono sciezki instalacji (HKCU\Software\Inyfinn\DAM)" }
    $summary.install_path = $installPath

    $exe = Join-Path $installPath "DAM.exe"
    if (-not (Test-Path -LiteralPath $exe)) { throw "Brak $exe po instalacji" }
    Write-Step ("Start {0}" -f $exe)
    Start-Process -FilePath $exe -WorkingDirectory $installPath | Out-Null

    $wait = Wait-DamBridge -BaseUrl $BridgeUrl -TimeoutSeconds $WaitSeconds
    if (-not $wait.health) { throw "Most nie odpowiedzial na /health w $WaitSeconds s" }
    $summary.bridge_up_after_sec = $wait.up_after_sec
    $summary.health_ok = $true
    Save-Text "health.json" $wait.health
    Write-Step "GET /health OK"

    $preflight = Get-DamPreflight -BaseUrl $BridgeUrl
    if ($preflight) {
      Save-Text "preflight.json" $preflight
      $summary.preflight_ok = $true
      try {
        $pf = $preflight | ConvertFrom-Json
        if ($pf.blocking) { $summary.preflight_blocking = @($pf.blocking) }
        foreach ($item in $pf.items) {
          Write-Step ("  preflight {0}: ok={1} {2}" -f $item.id, $item.ok, $item.label)
        }
      } catch {
        Write-Warning "preflight.json nie parsuje sie jako JSON"
      }
    } else {
      Write-Warning "GET /preflight bez odpowiedzi (starsza wersja mostu?)"
    }

    $procs = Get-Process | Sort-Object -Property Name |
      Select-Object -Property Name, Id, @{Name = "Path"; Expression = { $_.Path } } |
      Format-Table -AutoSize | Out-String -Width 300
    Save-Text "processes.txt" $procs

    if ($summary.health_ok -and $summary.preflight_ok -and ($summary.preflight_blocking.Count -eq 0)) {
      $summary.result = "PASS"
    }
  }
  $thumbs = Test-DamThumbs -InstallPath $summary.install_path -BaseUrl $BridgeUrl
  $summary.thumbs = $thumbs
  Write-Step ("Miniatury: w instalacji {0}, z cache {1}/{2} ({3}%), najwolniejsza {4} ms" -f $thumbs.installed, $thumbs.ok, $thumbs.tried, $thumbs.ok_pct, $thumbs.max_ms)
  if ($thumbs.installed -lt 1000 -or $thumbs.tried -lt 10 -or $thumbs.ok_pct -lt 90) {
    $summary.result = "FAIL"
    $summary.error = "Miniatury z cache nie dzialaja na swiezej instalacji"
  }
} catch {
  $summary.error = $_.Exception.Message
  Write-Warning $summary.error
} finally {
  $summary.finished_at = (Get-Date).ToString("s")
  try {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    $json = $summary | ConvertTo-Json -Depth 4
    Set-Content -LiteralPath (Join-Path $OutDir "summary.json") -Value $json -Encoding utf8
    Write-Host ""
    Write-Host ("WYNIK: {0}  (szczegoly w {1})" -f $summary.result, $OutDir)
  } catch {
    Write-Warning "Nie zapisano summary.json: $($_.Exception.Message)"
  }
}

if ($summary.result -ne "PASS") { exit 1 }
exit 0
