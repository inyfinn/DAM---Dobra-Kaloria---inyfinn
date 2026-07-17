$ErrorActionPreference = "Stop"
$root = "P:\DAM\apps\web"
$port = 8765
Write-Host "Starting browser mode http://127.0.0.1:$port/"
Set-Location $root
python -m http.server $port --bind 127.0.0.1
