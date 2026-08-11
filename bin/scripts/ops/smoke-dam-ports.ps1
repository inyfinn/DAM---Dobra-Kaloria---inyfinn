# Smoke: DAM UI :8765 + bridge :8766 (max 5s each, hard). Exit 1 if down.
# Prefer this or dam-connection-watchdog.ps1 BEFORE any browser MCP navigate.
$ErrorActionPreference = "Stop"
$timeoutSec = 5

function Test-DamPort {
  param([string]$Name, [string]$Url)
  try {
    $raw = curl.exe -s -S --max-time $timeoutSec -o NUL -w "%{http_code}|%{time_total}" $Url 2>&1
    $text = if ($raw -is [array]) { ($raw | Out-String).Trim() } else { "$raw".Trim() }
    if ($text -match "^(\d+)\|([\d\.]+)") {
      $code = [int]$Matches[1]
      $tt = [double]$Matches[2]
      if ($code -ge 200 -and $code -lt 300 -and $tt -le $timeoutSec) {
        Write-Host ("OK  {0}  HTTP {1}  time_total={2:N3}s  ({3})" -f $Name, $code, $tt, $Url)
        return $true
      }
      Write-Host ("FAIL {0}  HTTP {1}  time_total={2:N3}s  ({3})" -f $Name, $code, $tt, $Url)
      return $false
    }
    Write-Host "FAIL $Name  bad_curl_output  ($Url) :: $text"
    return $false
  } catch {
    Write-Host "FAIL $Name  timeout/error  ($Url) :: $_"
    return $false
  }
}

$uiOk = Test-DamPort "UI" "http://127.0.0.1:8765/explorer.html"
$brOk = Test-DamPort "Bridge" "http://127.0.0.1:8766/health"

if (-not ($uiOk -and $brOk)) {
  Write-Host ""
  Write-Host "Serwery nie odpowiadaja 2xx w ${timeoutSec}s. Uruchom:"
  Write-Host "  powershell -File scripts/ops/dam-connection-watchdog.ps1"
  Write-Host "  albo: python apps/desktop/serve_browser.py"
  Write-Host "  potem: node scripts/qa/dam-browser-probe.js"
  Write-Host "  (browser MCP hang != server down - nie czekaj na browser_navigate)"
  exit 1
}

exit 0