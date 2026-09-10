# Screenshot-only (no --dump-dom: it waits on hung network after viz).
$ErrorActionPreference = "Stop"
$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $Chrome)) {
  $Chrome = Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $Chrome)) { throw "no chrome" }

$Evidence = "D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\bin\agents\shared\design-system-2026-09-09"
$Work = Join-Path $env:TEMP "dam-ex-cli-work-183"
$UserData = Join-Path $env:TEMP ("dam-ex-cli-ud-183-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
New-Item -ItemType Directory -Path $Work -Force | Out-Null
New-Item -ItemType Directory -Path $UserData | Out-Null
Write-Host "[work] $Work"
Write-Host "[user-data] $UserData"

function Invoke-ChromeShot {
  param(
    [string]$Url,
    [string]$Stem,
    [int]$BudgetMs = 12000,
    [switch]$DumpDom
  )
  $png = Join-Path $Work ($Stem + ".png")
  $dom = Join-Path $Work ($Stem + ".dom.html")
  $err = Join-Path $Work ($Stem + ".err.log")
  if (Test-Path $png) { Remove-Item $png -Force }
  Write-Host "[start] $Stem $Url $(Get-Date -Format o)"
  $arg = @(
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--disable-session-crashed-bubble',
    '--hide-crash-restore-bubble',
    '--noerrdialogs',
    '--disable-features=InfiniteSessionRestore,TranslateUI',
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
  $outTask = $p.StandardOutput.ReadToEndAsync()
  $errTask = $p.StandardError.ReadToEndAsync()
  $ok = $p.WaitForExit(35000)
  if (-not $ok) {
    Write-Host "[kill] hung chrome pid=$($p.Id) after 35s"
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    Get-CimInstance Win32_Process -Filter "name='chrome.exe'" | Where-Object { $_.CommandLine -match [regex]::Escape($UserData) } | ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      Write-Host "[kill-child] $($_.ProcessId)"
    }
    Write-Host ("HANG " + $Stem + " pid=" + $p.Id + " killed")
    return $false
  }
  $errText = $errTask.Result
  Set-Content -Path $err -Value $errText -Encoding UTF8
  if ($DumpDom) { Set-Content -Path $dom -Value $outTask.Result -Encoding UTF8 }
  $bytes = 0
  if (Test-Path $png) { $bytes = (Get-Item $png).Length }
  Copy-Item $png (Join-Path $Evidence ($Stem + ".png")) -Force -ErrorAction SilentlyContinue
  Copy-Item $err (Join-Path $Evidence ($Stem + ".err.log")) -Force
  Write-Host "[done] $Stem exit=$($p.ExitCode) pngBytes=$bytes $(Get-Date -Format o)"
  Get-CimInstance Win32_Process -Filter "name='chrome.exe'" | Where-Object { $_.CommandLine -match [regex]::Escape($UserData) } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
  foreach ($sub in @(
    'Default\Sessions','Default\Session Storage','Default\Current Session','Default\Last Session',
    'Default\Service Worker','Default\Service Worker\CacheStorage',
    'Default\Cache','Default\Code Cache','Default\GPUCache'
  )) {
    $p = Join-Path $UserData $sub
    if (Test-Path $p) { Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue }
  }
  Start-Sleep -Milliseconds 400
  return $true
}

function Invoke-DumpDom {
  param([string]$Url, [string]$Stem, [int]$BudgetMs = 8000)
  $dom = Join-Path $Work ($Stem + ".dom.html")
  Write-Host "[dump] $Stem $(Get-Date -Format o)"
  $arg = @(
    '--headless=new','--disable-gpu','--disable-extensions','--no-first-run',
    '--no-default-browser-check','--window-size=1280,1800',
    ('--user-data-dir=' + $UserData),
    ('--virtual-time-budget=' + $BudgetMs),
    '--dump-dom',
    $Url
  )
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $Chrome
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $psi.Arguments = [string]::Join(' ', $arg)
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  $outTask = $p.StandardOutput.ReadToEndAsync()
  [void]$p.StandardError.ReadToEndAsync()
  $ok = $p.WaitForExit(20000)
  if (-not $ok) {
    Write-Host "[kill-dump] pid=$($p.Id)"
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    return
  }
  Set-Content -Path $dom -Value $outTask.Result -Encoding UTF8
  Copy-Item $dom (Join-Path $Evidence ($Stem + ".dom.html")) -Force
  Write-Host "[dump-done] $Stem bytes=$((Get-Item $dom).Length)"
}

Invoke-ChromeShot -Url "http://127.0.0.1:8765/explorer.html?v=5.0.183" -Stem "explorer-183-1-first" -BudgetMs 12000
Invoke-ChromeShot -Url "http://127.0.0.1:8765/visualizations.html?v=5.0.182" -Stem "explorer-183-2-viz" -BudgetMs 10000
$imm = Invoke-ChromeShot -Url "http://127.0.0.1:8765/explorer.html?v=5.0.183" -Stem "explorer-183-3-imm" -BudgetMs 8000
if (-not $imm) {
  $script:UserData = Join-Path $env:TEMP ("dam-ex-cli-ud-183-fresh-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
  New-Item -ItemType Directory -Path $script:UserData | Out-Null
  Write-Host "[fallback-fresh-profile] $script:UserData"
  Invoke-ChromeShot -Url "http://127.0.0.1:8765/explorer.html?v=5.0.183" -Stem "explorer-183-3-fresh" -BudgetMs 12000
} else {
  Invoke-ChromeShot -Url "http://127.0.0.1:8765/explorer.html?v=5.0.183" -Stem "explorer-183-3-3s" -BudgetMs 3000
  Invoke-ChromeShot -Url "http://127.0.0.1:8765/explorer.html?v=5.0.183" -Stem "explorer-183-3-8s" -BudgetMs 8000
  Invoke-DumpDom -Url "http://127.0.0.1:8765/explorer.html?v=5.0.183" -Stem "explorer-183-3-8s" -BudgetMs 8000
}
Write-Host "[all-done]"
