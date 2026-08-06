# Smoke :8765/:8766 (max 5s). On fail: restart serve_browser once, re-smoke.
# Hang of cursor-ide-browser MCP is NOT server-down - use this BEFORE any browser MCP.
param(
  [int]$TimeoutSec = 5,
  [switch]$NoRestart
)

$ErrorActionPreference = "Continue"
$OpsDir = $PSScriptRoot
$ContentRoot = Split-Path (Split-Path $OpsDir -Parent) -Parent
$LogDir = Join-Path $ContentRoot "logs\dam-connection"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir "watchdog.jsonl"

function Write-LogRow([hashtable]$row) {
  $row.ts = (Get-Date).ToUniversalTime().ToString("o")
  Add-Content -LiteralPath $LogFile -Value ($row | ConvertTo-Json -Compress) -Encoding UTF8
}

function Test-Url([string]$Name, [string]$Url) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    $raw = & curl.exe -s -S --max-time $TimeoutSec -o NUL -w "%{http_code}|%{time_total}" $Url 2>&1
    $text = if ($raw -is [array]) { ($raw | Out-String).Trim() } else { "$raw".Trim() }
    if ($text -match "^(\d+)\|([\d\.]+)") {
      $code = [int]$Matches[1]
      $tt = [double]$Matches[2]
      $ok = ($code -ge 200 -and $code -lt 300 -and $tt -le $TimeoutSec)
      Write-Host ("{0}  {1}  HTTP {2}  time_total={3:N3}s  ({4})" -f ($(if ($ok) { "OK " } else { "FAIL" })), $Name, $code, $tt, $Url)
      return @{ ok = $ok; name = $Name; url = $Url; http = $code; time_total = $tt }
    }
    Write-Host "FAIL $Name  bad_curl  ($Url) :: $text"
    return @{ ok = $false; name = $Name; url = $Url; error = $text; time_total = $sw.Elapsed.TotalSeconds }
  } catch {
    Write-Host "FAIL $Name  exception  ($Url) :: $_"
    return @{ ok = $false; name = $Name; url = $Url; error = "$_"; time_total = $sw.Elapsed.TotalSeconds }
  }
}

function Restart-DamServe {
  Write-Host "[watchdog] restarting serve_browser + bridge..."
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'serve_browser\.py|local_bridge\.py' } |
    ForEach-Object {
      try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
    }
  Start-Sleep -Seconds 1
  $py = Join-Path $ContentRoot "runtime\win\python\python.exe"
  if (-not (Test-Path $py)) { $py = "python" }
  $serve = Join-Path $ContentRoot "apps\desktop\serve_browser.py"
  $desk = Join-Path $ContentRoot "apps\desktop"
  Start-Process -FilePath $py -ArgumentList "`"$serve`"" -WorkingDirectory $desk -WindowStyle Hidden
  Start-Sleep -Seconds 3
}

$ui = Test-Url "UI" "http://127.0.0.1:8765/explorer.html"
$br = Test-Url "Bridge" "http://127.0.0.1:8766/health"
Write-LogRow @{
  tool = "dam-connection-watchdog"
  phase = "smoke1"
  ui_ok = [bool]$ui.ok
  bridge_ok = [bool]$br.ok
  ui = $ui
  bridge = $br
}

if ($ui.ok -and $br.ok) {
  Write-Host "[watchdog] PASS"
  exit 0
}

if ($NoRestart) {
  Write-Host "[watchdog] FAIL (NoRestart)"
  exit 1
}

Restart-DamServe
$ui2 = Test-Url "UI" "http://127.0.0.1:8765/explorer.html"
$br2 = Test-Url "Bridge" "http://127.0.0.1:8766/health"
Write-LogRow @{
  tool = "dam-connection-watchdog"
  phase = "smoke2_after_restart"
  ui_ok = [bool]$ui2.ok
  bridge_ok = [bool]$br2.ok
  ui = $ui2
  bridge = $br2
}

if ($ui2.ok -and $br2.ok) {
  Write-Host "[watchdog] PASS after restart"
  exit 0
}

Write-Host "[watchdog] FAIL - servers still down after restart"
Write-Host "  next: powershell -File scripts/ops/dam-agent-unstick.ps1"
exit 1
