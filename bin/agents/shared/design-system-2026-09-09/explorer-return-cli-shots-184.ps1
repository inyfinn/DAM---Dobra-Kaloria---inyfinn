# Same user-data-dir: explorer -> viz -> explorer. No fresh-profile fallback. No dump-dom.
$ErrorActionPreference = "Stop"
$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $Chrome)) {
  $Chrome = Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $Chrome)) { throw "no chrome" }

$Evidence = "D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\bin\agents\shared\design-system-2026-09-09"
$Work = Join-Path $env:TEMP "dam-ex-cli-work-184"
$UserData = Join-Path $env:TEMP ("dam-ex-cli-ud-184-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
New-Item -ItemType Directory -Path $Work -Force | Out-Null
New-Item -ItemType Directory -Path $UserData | Out-Null
Write-Host "[work] $Work"
Write-Host "[user-data] $UserData"

function Get-ChromeForProfile {
  Get-CimInstance Win32_Process -Filter "name='chrome.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and ($_.CommandLine -match [regex]::Escape($UserData))
  }
}

function Stop-ChromeForProfile {
  Get-ChromeForProfile | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "[kill-child] $($_.ProcessId)"
  }
}

function Wait-ProfileIdle {
  $deadline = (Get-Date).AddSeconds(8)
  while ((Get-Date) -lt $deadline) {
    $left = @(Get-ChromeForProfile)
    if ($left.Count -eq 0) { break }
    Start-Sleep -Milliseconds 250
  }
  $left = @(Get-ChromeForProfile)
  if ($left.Count -gt 0) {
    Write-Host "[idle-timeout] still $($left.Count) chrome; killing"
    Stop-ChromeForProfile
    Start-Sleep -Milliseconds 400
  }
  foreach ($name in @('SingletonLock', 'SingletonCookie', 'SingletonSocket')) {
    $lock = Join-Path $UserData $name
    if (Test-Path $lock) {
      Remove-Item $lock -Force -ErrorAction SilentlyContinue
      Write-Host "[drop-lock] $name"
    }
  }
  foreach ($sub in @(
    'Default\Sessions', 'Default\Session Storage', 'Default\Current Session', 'Default\Last Session',
    'Default\Service Worker', 'Default\Service Worker\CacheStorage',
    'Default\Cache', 'Default\Code Cache', 'Default\GPUCache'
  )) {
    $p = Join-Path $UserData $sub
    if (Test-Path $p) { Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

function Invoke-ChromeShot {
  param(
    [string]$Url,
    [string]$Stem,
    [int]$BudgetMs = 12000
  )
  $png = Join-Path $Work ($Stem + ".png")
  $err = Join-Path $Work ($Stem + ".err.log")
  if (Test-Path $png) { Remove-Item $png -Force }
  Write-Host "[start] $Stem $Url $(Get-Date -Format o)"
  $arg = @(
    '--headless=old',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--disable-session-crashed-bubble',
    '--hide-crash-restore-bubble',
    '--noerrdialogs',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-hang-monitor',
    '--disable-features=InfiniteSessionRestore,TranslateUI,RendererCodeIntegrity',
    '--window-size=1280,1800',
    ('--user-data-dir=' + $UserData),
    ('--virtual-time-budget=' + $BudgetMs),
    ('--screenshot=' + $png),
    $Url
  )
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $Chrome
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $quoted = $arg | ForEach-Object {
    if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
  }
  $psi.Arguments = [string]::Join(' ', $quoted)
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  [void]$p.StandardOutput.ReadToEndAsync()
  $errTask = $p.StandardError.ReadToEndAsync()
  $ok = $p.WaitForExit(40000)
  if (-not $ok) {
    Write-Host "[kill] hung chrome pid=$($p.Id) after 40s"
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    Stop-ChromeForProfile
    Write-Host ("HANG " + $Stem + " pid=" + $p.Id + " killed")
    return $false
  }
  $errText = $errTask.Result
  Set-Content -Path $err -Value $errText -Encoding UTF8
  $bytes = 0
  if (Test-Path $png) { $bytes = (Get-Item $png).Length }
  if ($bytes -gt 0) {
    Copy-Item $png (Join-Path $Evidence ($Stem + ".png")) -Force
  }
  Copy-Item $err (Join-Path $Evidence ($Stem + ".err.log")) -Force
  Write-Host "[done] $Stem exit=$($p.ExitCode) pngBytes=$bytes $(Get-Date -Format o)"
  Wait-ProfileIdle
  return ($bytes -gt 0)
}

$first = Invoke-ChromeShot -Url "http://127.0.0.1:8765/explorer.html?v=5.0.184" -Stem "explorer-184-1-first" -BudgetMs 12000
$viz = Invoke-ChromeShot -Url "http://127.0.0.1:8765/visualizations.html?v=5.0.184" -Stem "explorer-184-2-viz" -BudgetMs 12000
$watch = Start-Job -ScriptBlock {
  $log = Join-Path $env:TEMP "dam-ex-184-curl-watch.log"
  "" | Set-Content $log
  1..20 | ForEach-Object {
    $line = & curl.exe -s -o NUL -w "%{http_code} t=%{time_total}`n" --max-time 3 "http://127.0.0.1:8765/explorer.html?v=5.0.184"
    Add-Content $log ("{0} {1}" -f (Get-Date -Format o), $line)
    Start-Sleep -Seconds 2
  }
}
$ret = Invoke-ChromeShot -Url "http://127.0.0.1:8765/explorer.html?v=5.0.184" -Stem "explorer-184-3-return" -BudgetMs 12000
Stop-Job $watch -ErrorAction SilentlyContinue
Receive-Job $watch | Out-Null
Remove-Job $watch -Force -ErrorAction SilentlyContinue
$watchLog = Join-Path $env:TEMP "dam-ex-184-curl-watch.log"
if (Test-Path $watchLog) {
  Write-Host "[curl-watch]"
  Get-Content $watchLog
  Copy-Item $watchLog (Join-Path $Evidence "explorer-184-3-return-curl-watch.log") -Force
}
Write-Host "[summary] first=$first viz=$viz return=$ret user-data=$UserData"
Write-Host "[all-done]"
