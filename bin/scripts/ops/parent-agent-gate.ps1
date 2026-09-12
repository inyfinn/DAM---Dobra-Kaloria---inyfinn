# Parent evidence collector. Does NOT decide PASS/FAIL of the plan.
# Parent (Monday) reads this JSON + screenshots. Workers must not self-declare done.
# Usage: powershell -NoProfile -File bin/scripts/ops/parent-agent-gate.ps1

$ErrorActionPreference = "Continue"
$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$Bin = Join-Path $GitRoot "bin"
$OutDir = Join-Path $GitRoot ".cursor\parent-gate"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"

function Get-FileFact([string]$rel) {
  $p = Join-Path $GitRoot $rel
  if (-not (Test-Path -LiteralPath $p)) {
    return [ordered]@{ path = $rel; exists = $false }
  }
  $i = Get-Item -LiteralPath $p
  return [ordered]@{
    path = $rel
    exists = $true
    bytes = $i.Length
    mtime = $i.LastWriteTime.ToString("yyyy-MM-ddTHH:mm:ss")
  }
}

function Get-TextVersion([string]$rel, [string]$pattern) {
  $p = Join-Path $GitRoot $rel
  if (-not (Test-Path -LiteralPath $p)) { return $null }
  $m = Select-String -LiteralPath $p -Pattern $pattern | Select-Object -First 1
  if ($null -eq $m) { return $null }
  return $m.Line.Trim()
}

$bridge = Join-Path $Bin "apps\desktop\local_bridge.py"
$bridgeLines = 0
if (Test-Path -LiteralPath $bridge) {
  $bridgeLines = (Get-Content -LiteralPath $bridge | Measure-Object -Line).Lines
}

$port8765 = $null
$port8766 = $null
try { $port8765 = (curl.exe -s -S --max-time 5 -o NUL -w "%{http_code}" "http://127.0.0.1:8765/explorer.html") } catch { $port8765 = "err" }
try { $port8766 = (curl.exe -s -S --max-time 5 -o NUL -w "%{http_code}" "http://127.0.0.1:8766/health") } catch { $port8766 = "err" }

$agentDir = "C:\Users\xpret\.cursor\projects\x-Marketing-POLSKA-99-WYMIANA-Krzysztof-Moj-obszar-pracy-DAM-Dobra-Kaloria-inyfinn\agent-transcripts\609508ea-6a65-4c1e-8287-de43d8a2cd4c\subagents"
$watchIds = @(
  "571662b6-04e2-47d0-b8ba-dc10e9ac7839"
)
$watchFile = Join-Path $OutDir "watch-agents.txt"
if (Test-Path -LiteralPath $watchFile) {
  $watchIds = @(Get-Content -LiteralPath $watchFile | Where-Object { $_.Trim() -ne "" })
}

$agents = @()
foreach ($id in $watchIds) {
  $jl = Join-Path $agentDir "$id.jsonl"
  $fact = @{ id = $id; transcript_exists = $false; age_sec = $null; last_role = $null; lines = 0 }
  if (Test-Path -LiteralPath $jl) {
    $i = Get-Item -LiteralPath $jl
    $fact.transcript_exists = $true
    $fact.age_sec = [int]((Get-Date) - $i.LastWriteTime).TotalSeconds
    $fact.bytes = $i.Length
    $fact.mtime = $i.LastWriteTime.ToString("yyyy-MM-ddTHH:mm:ss")
    $fact.lines = (Get-Content -LiteralPath $jl | Measure-Object -Line).Lines
    $last = Get-Content -LiteralPath $jl -Tail 1
    if ($last -match '"role":"([^"]+)"') { $fact.last_role = $Matches[1] }
    if ($fact.age_sec -gt 600) { $fact.stale_hint = "silent_over_10m" }
  }
  $agents += $fact
}

$shots = @(
  "bin\docs\project\qa-6.0.0-explorer-elementy.png",
  "bin\docs\project\qa-6.0.0-db-panel.png",
  "bin\docs\project\qa-6.0.0-settings-db.png"
) | ForEach-Object { Get-FileFact $_ }

$ev = [ordered]@{
  collected_at = $stamp
  judge = "parent-only"
  product_version_target = "6.0.0"
  version_json = Get-TextVersion "bin\apps\web\version.json" '"version"'
  dam_version_js = Get-TextVersion "bin\apps\web\assets\js\dam-version.js" "5\.0\.|6\.0\."
  app_version_py = Get-TextVersion "bin\apps\desktop\runtime_config.py" "APP_VERSION"
  iss_version = Get-TextVersion "bin\installer\DAM-Setup.iss" "AppVersion|MyAppVersion|#define MyAppVersion"
  local_bridge_lines = $bridgeLines
  local_bridge_ok_size = ($bridgeLines -ge 8900)
  ports = [ordered]@{ ui_8765 = $port8765; bridge_8766 = $port8766 }
  setup = Get-FileFact "DAM-Setup.exe"
  screenshots = $shots
  agents = $agents
  facts_not_verdict = "Parent must Read screenshots and confirm version 6.0.0. This file is not a PASS."
}

$jsonPath = Join-Path $OutDir "last-evidence.json"
$ev | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
$logLine = "{0} version={1} bridge={2} ui={3} br={4} setupBytes={5} agents={6}" -f `
  $stamp, $ev.version_json, $bridgeLines, $port8765, $port8766, $ev.setup.bytes, ($agents.Count)
Add-Content -LiteralPath (Join-Path $OutDir "gate.log") -Value $logLine
Write-Output $logLine
Write-Output "WROTE $jsonPath"
