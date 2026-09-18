#Requires -Version 5.1
<#
  Test czystej instalacji DAM w Windows Sandbox (uruchamiany WEWNATRZ sandboksa).

  JAK UZYWAC (na maszynie budujacej, nie w sandboksie):
    1. Zbuduj instalator: bin\scripts\ops\build-installer.ps1
    2. Utworz folder na wyniki, domyslnie:  mkdir C:\Temp\dam-sandbox-out
    3. Sprawdz sciezki HostFolder w bin\scripts\ops\sandbox-smoke.wsb
       (folder z DAM-Setup.exe = tylko odczyt, folder wynikow = do zapisu).
    4. Kliknij dwukrotnie sandbox-smoke.wsb. Sandbox sam uruchomi ten skrypt.
    5. Po ok. 3 minutach zajrzyj do folderu wynikow:
       summary.json (PASS/FAIL), health.json, preflight.json, processes.txt, install.log

  Co sprawdza: cicha instalacja, start DAM.exe, odpowiedz mostu na /health
  i /preflight (max 120 s), lista procesow. Nie dotyka bazy produkcyjnej
  poza tym, co robi sam program przy starcie.
#>
param(
  [string]$SetupDir = "C:\dam-setup",
  [string]$OutDir = "C:\dam-results",
  [int]$WaitSeconds = 120,
  [string]$BridgeUrl = "http://127.0.0.1:8766"
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

try {
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

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
    $guess = Join-Path $env:LOCALAPPDATA "Programs\DAM - Dobra Kaloria"
    if (Test-Path -LiteralPath $guess) { $installPath = $guess }
  }
  if (-not $installPath) { throw "Nie znaleziono sciezki instalacji (HKCU\Software\Inyfinn\DAM)" }
  $summary.install_path = $installPath

  $exe = Join-Path $installPath "DAM.exe"
  if (-not (Test-Path -LiteralPath $exe)) { throw "Brak $exe po instalacji" }
  Write-Step ("Start {0}" -f $exe)
  Start-Process -FilePath $exe -WorkingDirectory $installPath | Out-Null

  $waitStart = Get-Date
  $deadline = $waitStart.AddSeconds($WaitSeconds)
  $health = $null
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri ($BridgeUrl + "/health") -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) {
        $health = $r.Content
        break
      }
    } catch {
      Start-Sleep -Seconds 3
    }
  }
  if (-not $health) { throw "Most nie odpowiedzial na /health w $WaitSeconds s" }
  $summary.bridge_up_after_sec = [int][math]::Round(((Get-Date) - $waitStart).TotalSeconds)
  $summary.health_ok = $true
  Save-Text "health.json" $health
  Write-Step "GET /health OK"

  $preflight = ""
  try {
    $rp = Invoke-WebRequest -Uri ($BridgeUrl + "/preflight") -UseBasicParsing -TimeoutSec 10
    $preflight = $rp.Content
  } catch {
    $preflight = ""
  }
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

  if ($summary.health_ok -and $summary.preflight_ok) { $summary.result = "PASS" }
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
