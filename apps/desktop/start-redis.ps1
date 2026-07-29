# One-liner start: native Redis for DAM (127.0.0.1:6379)
# Usage: powershell -File apps/desktop/start-redis.ps1
$dest = Join-Path $env:LOCALAPPDATA "DAM-Redis"
$server = Join-Path $dest "redis-server.exe"
$cli = Join-Path $dest "redis-cli.exe"
$conf = Join-Path $dest "redis.windows.conf"
if (-not (Test-Path $server)) {
    Write-Error "Redis not installed. See apps/desktop/README-redis.md (tporadowski zip)."
    exit 1
}
$listening = Get-NetTCPConnection -LocalPort 6379 -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    Write-Output "Redis already listening on 6379"
} else {
    Start-Process -FilePath $server `
        -ArgumentList "`"$conf`"", "--bind", "127.0.0.1", "--port", "6379" `
        -WorkingDirectory $dest -WindowStyle Hidden
    Start-Sleep -Seconds 1
}
& $cli -h 127.0.0.1 -p 6379 ping
# expected: PONG
