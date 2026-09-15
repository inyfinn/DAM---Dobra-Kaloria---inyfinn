# Incremental PAMIEC-PODRECZNA -> NAS /volume1/web/Panel-DAM/bin/PAMIEC-PODRECZNA
# Requires SSH alias syno-ddns. Does not modify the local cache. No password in file.
# Hidden console: caller must use powershell -WindowStyle Hidden (Task Scheduler XML).
# This wrapper uses pythonw so even a visible host cannot spawn a Python console.
param(
    [string]$SshHost = "syno-ddns",
    [switch]$DryRun
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Join-Path $here "sync-pamiec-podreczna.py"
$pythonw = Get-Command pythonw -ErrorAction SilentlyContinue
$python = Get-Command python -ErrorAction SilentlyContinue
$exe = if ($pythonw) { $pythonw.Source } elseif ($python) { $python.Source } else { $null }
if (-not $exe) {
    throw "pythonw/python not found on PATH"
}
$argList = @($py, "--ssh-host", $SshHost)
if ($DryRun) { $argList += "--dry-run" }
$p = Start-Process -FilePath $exe -ArgumentList $argList -Wait -PassThru -WindowStyle Hidden
exit $p.ExitCode
