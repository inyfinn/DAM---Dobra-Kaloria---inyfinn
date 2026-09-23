<#
.SYNOPSIS
    Startuje kopie DAM BEZ folderu Marketing (ROOT), obok normalnej (zlotej) aplikacji.

.DESCRIPTION
    Odpala dwa procesy w tle:
      1. most (noroot_bridge.py -> local_bridge.py) na -BridgePort (domyslnie 9766)
      2. serwer statyczny UI (python -m http.server) na -WebPort (domyslnie 9765)
    Startuje kazdy TYLKO jesli port jest wolny - jesli juz cos tam odpowiada
    (np. wczesniej uruchomiony przez czlowieka), nie dotyka go i tylko wypisuje info.
    Nie dotyka portow 8765/8766 (zlota aplikacja) ani procesow z nia zwiazanych.

.PARAMETER App
    Folder skopiowanej aplikacji DAM bez ROOT (np. C:\Users\krzysztof.wieczorek\AppData\Local\DAM-bezroot-test).
    Musi zawierac: DAM.exe rozpakowany do bin\ (bin\apps\desktop\local_bridge.py,
    bin\apps\web\, bin\runtime\win\python\python.exe).

.PARAMETER BridgePort
    Port mostu noroot (domyslnie 9766). NIGDY 8766 (to port zlotej aplikacji).

.PARAMETER WebPort
    Port serwera statycznego UI (domyslnie 9765). NIGDY 8765 (to port zlotej aplikacji).

.EXAMPLE
    .\start-noroot.ps1 -App "C:\Users\krzysztof.wieczorek\AppData\Local\DAM-bezroot-test"
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$App,

    [int]$BridgePort = 9766,
    [int]$WebPort = 9765
)

$ErrorActionPreference = "Stop"

if ($BridgePort -eq 8766 -or $WebPort -eq 8765) {
    Write-Error "Zabronione: 8765/8766 to porty zlotej aplikacji. Wybierz inne."
    exit 1
}

function Test-PortOpen($port) {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $iar = $c.BeginConnect("127.0.0.1", $port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(500)
        if ($ok -and $c.Connected) { $c.Close(); return $true }
        $c.Close()
        return $false
    } catch { return $false }
}

if (-not (Test-Path $App)) {
    Write-Error "Folder aplikacji nie istnieje: $App"
    exit 1
}

$pythonExe = Join-Path $App "bin\runtime\win\python\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Error "Brak Pythona w kopii aplikacji: $pythonExe"
    exit 1
}

$bridgeScript = Join-Path $PSScriptRoot "noroot_bridge.py"
$webDir = Join-Path $App "bin\apps\web"
$stateDir = Join-Path $App "qa-state"
if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Path $stateDir | Out-Null }

# --- Most (bridge) ---
if (Test-PortOpen $BridgePort) {
    Write-Host "[start-noroot] Most juz odpowiada na porcie $BridgePort - nie startuje ponownie."
} else {
    $env:DAM_BRIDGE_PORT = "$BridgePort"
    $env:DAM_UI_ORIGIN = "http://127.0.0.1:$WebPort"
    $env:DAM_STATE_DIR = $stateDir
    # Sciezki ze spacjami ("- POLSKA", "--- Moj obszar pracy") w cudzyslowach - bez nich
    # Python dostawal pocieta sciezke i most padal bez sladu (23.09).
    $logDir = Join-Path $App "qa-logs"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
    $bridgeProc = Start-Process -FilePath $pythonExe `
        -ArgumentList @("`"$bridgeScript`"", "--app", "`"$App`"") `
        -WorkingDirectory (Join-Path $App "bin\apps\desktop") `
        -RedirectStandardOutput (Join-Path $logDir "bridge.out") `
        -RedirectStandardError (Join-Path $logDir "bridge.err") `
        -WindowStyle Hidden -PassThru
    Write-Host "[start-noroot] Most (noroot) wystartowany: pid=$($bridgeProc.Id) port=$BridgePort, log: $logDir"
    # Nie czekamy na cos, czego nie widac: most ma odpowiedziec w 60 s albo skrypt konczy sie bledem.
    $deadline = (Get-Date).AddSeconds(60)
    while (-not (Test-PortOpen $BridgePort)) {
        if ($bridgeProc.HasExited -or (Get-Date) -gt $deadline) {
            Write-Error ("[start-noroot] Most nie wstal (exit={0}). Ostatnie linie bledu:`n{1}" -f `
                $(if ($bridgeProc.HasExited) { $bridgeProc.ExitCode } else { "timeout 60 s" }), `
                ((Get-Content (Join-Path $logDir "bridge.err") -Tail 15 -ErrorAction SilentlyContinue) -join "`n"))
            exit 2
        }
        Start-Sleep -Milliseconds 500
    }
    Write-Host "[start-noroot] Most odpowiada na porcie $BridgePort"
}

# --- Serwer statyczny UI ---
if (Test-PortOpen $WebPort) {
    Write-Host "[start-noroot] Strona (UI) juz odpowiada na porcie $WebPort - nie startuje ponownie."
} else {
    $webProc = Start-Process -FilePath $pythonExe `
        -ArgumentList @("-m", "http.server", "$WebPort", "--bind", "127.0.0.1", "--directory", "`"$webDir`"") `
        -WindowStyle Hidden -PassThru
    Write-Host "[start-noroot] Strona (UI) wystartowana: pid=$($webProc.Id) port=$WebPort"
}

Write-Host "[start-noroot] Sprawdz zdrowie: Invoke-RestMethod http://127.0.0.1:$BridgePort/health"
