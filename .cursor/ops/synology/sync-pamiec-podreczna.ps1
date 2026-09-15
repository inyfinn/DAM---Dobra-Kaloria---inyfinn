# Incremental PAMIEC-PODRECZNA -> NAS /volume1/web/Panel-DAM/bin/PAMIEC-PODRECZNA
# Requires SSH alias syno-ddns. Does not modify the local cache. No password in file.
param(
    [string]$SshHost = "syno-ddns",
    [switch]$DryRun
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Join-Path $here "sync-pamiec-podreczna.py"
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    throw "python not found on PATH"
}
$argsList = @($py, "--ssh-host", $SshHost)
if ($DryRun) { $argsList += "--dry-run" }
& $python.Source @argsList
exit $LASTEXITCODE
