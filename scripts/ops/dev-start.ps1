$ErrorActionPreference = 'SilentlyContinue'
$repo = 'D:\--- INYFINN - PROJEKTY\--- OSOBISTE\DAM - Dobra Kaloria - Inyfinn\DAM---Dobra-Kaloria---inyfinn'
$desktop = Join-Path $repo 'apps\desktop'

# Bridge (threaded) on 8766
$env:DAM_BRIDGE_PORT = '8766'
Start-Process -WindowStyle Hidden -FilePath 'python' `
    -ArgumentList ('"' + (Join-Path $desktop 'local_bridge.py') + '"') `
    -WorkingDirectory $desktop

# Static UI on 8765 (dev)
Start-Process -WindowStyle Hidden -FilePath 'python' `
    -ArgumentList '-m', 'http.server', '8765' `
    -WorkingDirectory (Join-Path $repo 'apps\web')

Start-Sleep -Seconds 3

function Probe($url) {
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 $url
        $sw.Stop()
        Write-Output ("{0}  {1}  {2} ms  {3} bytes" -f $r.StatusCode, $url, $sw.ElapsedMilliseconds, $r.RawContentLength)
    } catch {
        Write-Output ("FAIL  {0}  {1}" -f $url, $_.Exception.Message)
    }
}

Probe 'http://127.0.0.1:8766/health'
Probe 'http://127.0.0.1:8765/dashboard.html'
