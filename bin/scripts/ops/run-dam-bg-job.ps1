#Requires -Version 5.1
<#
.SYNOPSIS
  Hidden wrapper for DAM scheduled jobs. No visible console.
.DESCRIPTION
  Abort (exit 0) unless DAM.exe or dam-appw.exe is running.
  python serve_browser.py alone is NOT enough.
  Mock (do not kill user's DAM):
    $env:DAM_REQUIRE_PROCESS='1'; $env:DAM_MOCK_NO_PROCESS='1'
  Persist last status in bin/apps/desktop/data/background-jobs.json
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('panel-dam-sync', 'db-git-sync')]
    [string]$JobId,

    [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Get-DamGitRoot {
    $ops = $PSScriptRoot
    if (-not $ops) { $ops = Split-Path -Parent $MyInvocation.MyCommand.Path }
    return (Resolve-Path (Join-Path $ops '..\..\..')).Path
}

function Test-DamDesktopProcess {
    if ($env:DAM_MOCK_NO_PROCESS -eq '1' -or $env:DAM_MOCK_PROCESS -eq '0') {
        return $false
    }
    if ($env:DAM_MOCK_PROCESS -eq '1') {
        return $true
    }
    $procs = Get-Process -Name @('DAM', 'dam-appw') -ErrorAction SilentlyContinue
    return [bool]$procs
}

function Get-JobsStatePath {
    $gitRoot = Get-DamGitRoot
    return Join-Path $gitRoot 'bin\apps\desktop\data\background-jobs.json'
}

function Read-JobsDoc {
    $p = Get-JobsStatePath
    if (-not (Test-Path -LiteralPath $p)) {
        return [ordered]@{ updated_at = $null; jobs = [ordered]@{} }
    }
    try {
        $raw = Get-Content -LiteralPath $p -Raw -Encoding UTF8
        $doc = $raw | ConvertFrom-Json
        if ($null -eq $doc.jobs) {
            $doc | Add-Member -NotePropertyName jobs -NotePropertyValue ([pscustomobject]@{}) -Force
        }
        return $doc
    } catch {
        return [ordered]@{ updated_at = $null; jobs = [ordered]@{} }
    }
}

function Write-JobStatus {
    param(
        [string]$Id,
        [string]$Status,
        [string]$Detail
    )
    $path = Get-JobsStatePath
    $dir = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $stamp = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
    $junk = @('IsFixedSize', 'IsSynchronized', 'Count', 'IsReadOnly', 'Values', 'Keys', 'SyncRoot')
    $autoById = @{}
    $doc = Read-JobsDoc
    if ($doc.jobs) {
        $doc.jobs.PSObject.Properties | Where-Object { $junk -notcontains $_.Name } | ForEach-Object {
            $autoById[$_.Name] = $true
            try {
                if ($null -ne $_.Value.auto) { $autoById[$_.Name] = [bool]$_.Value.auto }
            } catch { }
        }
    }
    $auto = $true
    if ($autoById.ContainsKey($Id)) { $auto = [bool]$autoById[$Id] }

    $jobJson = @{
        auto        = $auto
        last_run    = $stamp
        last_status = $Status
        last_detail = $Detail
        hidden      = $true
        gate        = 'DAM.exe or dam-appw.exe'
        require_dam = $true
    } | ConvertTo-Json -Compress

    $jobsMap = @{}
    foreach ($k in $autoById.Keys) {
        if ($k -eq $Id) { continue }
        $prevAuto = $autoById[$k]
        $jobsMap[$k] = "{`"auto`":$(if ($prevAuto) { 'true' } else { 'false' })}"
    }
    $jobsMap[$Id] = $jobJson

    $parts = @()
    foreach ($k in $jobsMap.Keys) {
        $parts += '    "' + $k + '": ' + $jobsMap[$k]
    }
    $blob = "{`r`n  `"updated_at`": `"$stamp`",`r`n  `"jobs`": {`r`n" + ($parts -join ",`r`n") + "`r`n  }`r`n}`r`n"
    Set-Content -LiteralPath $path -Value $blob -Encoding UTF8
}

function Get-JobAutoEnabled {
    param([string]$Id)
    $doc = Read-JobsDoc
    if (-not $doc.jobs) { return $true }
    $entry = $null
    try { $entry = $doc.jobs.$Id } catch { $entry = $null }
    if ($null -eq $entry) { return $true }
    if ($null -eq $entry.auto) { return $true }
    return [bool]$entry.auto
}

$env:DAM_BG_JOB = '1'

# User asked: DAM_REQUIRE_PROCESS=1 + mock = treat process as missing.
$require = ($env:DAM_REQUIRE_PROCESS -eq '1') -or $true
if ($require -and -not (Test-DamDesktopProcess)) {
    Write-JobStatus -Id $JobId -Status 'skipped_no_dam' -Detail 'DAM.exe / dam-appw.exe not running; exit 0'
    exit 0
}

if (-not $Force) {
    if (-not (Get-JobAutoEnabled -Id $JobId)) {
        Write-JobStatus -Id $JobId -Status 'skipped_disabled' -Detail 'auto off in Settings'
        exit 0
    }
}

$GitRoot = Get-DamGitRoot
$ContentRoot = Join-Path $GitRoot 'bin'

try {
    if ($JobId -eq 'panel-dam-sync') {
        $deploy = Join-Path $PSScriptRoot 'deploy-panel-dam-synology.ps1'
        & $deploy
        $rc = $LASTEXITCODE
        if ($null -eq $rc) { $rc = 0 }
        Write-JobStatus -Id $JobId -Status 'ok' -Detail "deploy exit $rc"
        exit 0
    }

    if ($JobId -eq 'db-git-sync') {
        $lock = Join-Path $ContentRoot 'apps\desktop\data\dam-running.lock'
        if ((Test-Path -LiteralPath $lock) -and -not $Force) {
            Write-JobStatus -Id $JobId -Status 'skipped_lock' -Detail 'dam-running.lock present; bridge watcher owns sync'
            exit 0
        }
        $script = Join-Path $ContentRoot 'apps\desktop\scripts\sync-database-backups-to-git.py'
        $pywCandidates = @(
            'C:\Python314\pythonw.exe',
            'C:\Python313\pythonw.exe',
            'C:\Python312\pythonw.exe',
            (Join-Path $env:LocalAppData 'Programs\Python\Python314\pythonw.exe'),
            (Join-Path $env:LocalAppData 'Programs\Python\Python313\pythonw.exe')
        )
        $pyw = $pywCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if (-not $pyw) {
            $cmd = Get-Command pythonw -ErrorAction SilentlyContinue
            if ($cmd) { $pyw = $cmd.Source }
        }
        if (-not $pyw) {
            Write-JobStatus -Id $JobId -Status 'error' -Detail 'pythonw.exe not found'
            exit 0
        }
        $p = Start-Process -FilePath $pyw -ArgumentList @("`"$script`"", '--push', '--quiet') -WorkingDirectory $ContentRoot -WindowStyle Hidden -Wait -PassThru
        Write-JobStatus -Id $JobId -Status 'ok' -Detail "pythonw exit $($p.ExitCode)"
        exit 0
    }
} catch {
    Write-JobStatus -Id $JobId -Status 'error' -Detail $_.Exception.Message
    exit 0
}
