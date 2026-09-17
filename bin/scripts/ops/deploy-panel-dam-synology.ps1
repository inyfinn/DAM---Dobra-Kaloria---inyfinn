#Requires -Version 5.1
<#
.SYNOPSIS
  Mirror bin\apps\web -> W:\web\Panel-DAM (Synology Web Station via RaiDrive).
.DESCRIPTION
  Robocopy /MIR with exclusions. Does not purge pamiec-podreczna.
  Seeds pamiec-podreczna\thumbs from bin\PAMIEC-PODRECZNA\thumbs (329 AVIF).
  Scheduled runs MUST go through run-dam-bg-job-hidden.vbs (no visible console).
  Gate DAM.exe / dam-appw.exe lives in run-dam-bg-job.ps1. Manual console OK.
#>
param(
    [switch]$SkipThumbsSeed,
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

function Get-DamGitRoot {
    $ops = $PSScriptRoot
    if (-not $ops) { $ops = Split-Path -Parent $MyInvocation.MyCommand.Path }
    # ...\bin\scripts\ops -> GIT_ROOT = three levels up from ops
    $gitRoot = (Resolve-Path (Join-Path $ops '..\..\..')).Path
    return $gitRoot
}

$GitRoot = Get-DamGitRoot
$SourceWeb = Join-Path $GitRoot 'bin\apps\web'
$DestPanel = 'W:\web\Panel-DAM'
$ThumbsSource = Join-Path $GitRoot 'bin\PAMIEC-PODRECZNA\thumbs'
$PamiecRoot = Join-Path $DestPanel 'pamiec-podreczna'
$ThumbsDest = Join-Path $PamiecRoot 'thumbs'
$ManifestPath = Join-Path $PamiecRoot 'manifest.json'

Write-Host "GIT_ROOT: $GitRoot"
Write-Host "Source:   $SourceWeb"
Write-Host "Dest:     $DestPanel"

if (-not (Test-Path $SourceWeb)) {
    throw "Brak zrodla: $SourceWeb"
}

if (-not (Test-Path 'W:\web')) {
    throw "W:\web niedostepne - zamontuj RaiDrive / udzial NAS."
}

if (-not (Test-Path $DestPanel)) {
    New-Item -ItemType Directory -Path $DestPanel -Force | Out-Null
}

# Test write
$probe = Join-Path $DestPanel '.deploy-write-probe'
try {
    Set-Content -Path $probe -Value (Get-Date -Format 'o') -Encoding UTF8
    Remove-Item -Path $probe -Force
    Write-Host "W: writable: OK"
} catch {
    throw "W:\web\Panel-DAM nie do zapisu: $_"
}

if ($WhatIf) {
    Write-Host '[WhatIf] Pomijam robocopy.'
    exit 0
}

$robocopy = Join-Path $env:SystemRoot 'System32\robocopy.exe'
$rcArgs = @(
    $SourceWeb,
    $DestPanel,
    '/MIR',
    '/R:2',
    '/W:5',
    '/NP',
    '/NDL',
    '/NFL',
    '/XD', 'pamiec-podreczna',
    '/XD', 'data\thumbs',
    '/XF', 'dam-runtime.json', 'dam-identity.json',
    '/XF', '*_Conflict*', '*.tmp',
    # Audyt 2026-09-17: katalog WWW na NAS jest publiczny - dane firmowe tam nie trafiaja.
    '/XF', 'invoices.json', 'invoice-erp-export-last.json', 'invoice-erp-sync.json', 'project-costs.json', 'cost-rates.json', 'production-cost-catalog.json', 'fmcg-cost-averages.json', 'fmcg-cost-catalog.json', 'fmcg-cost-import-map.json', 'inbox-items.json', 'notification-groups.json', 'asana-tasks.json', 'asana-tasks-kw.csv', 'product-people.json', 'app-settings.json', 'user-prefs.json', 'audit-log.jsonl', 'campaigns.json',
    '/XD', 'scripts'
)

Write-Host "Robocopy: $($rcArgs -join ' ')"
& $robocopy @rcArgs
$rc = $LASTEXITCODE
# Robocopy: 0-7 = success with various copy stats; >=8 = failure
if ($rc -ge 8) {
    throw "Robocopy failed with exit code $rc"
}
Write-Host "Robocopy exit code: $rc (0-7 success)"

if (-not $SkipThumbsSeed) {
    if (-not (Test-Path $ThumbsSource)) {
        Write-Warning "Brak $ThumbsSource - pomijam seed thumbs."
    } else {
        if (-not (Test-Path $PamiecRoot)) {
            New-Item -ItemType Directory -Path $PamiecRoot -Force | Out-Null
        }
        if (-not (Test-Path $ThumbsDest)) {
            New-Item -ItemType Directory -Path $ThumbsDest -Force | Out-Null
        }
        $thumbArgs = @(
            $ThumbsSource,
            $ThumbsDest,
            '/E',
            '/R:2',
            '/W:5',
            '/NP',
            '/NDL',
            '/NFL'
        )
        Write-Host "Seed thumbs: $ThumbsSource -> $ThumbsDest"
        & $robocopy @thumbArgs
        $trc = $LASTEXITCODE
        if ($trc -ge 8) {
            throw "Thumbs robocopy failed with exit code $trc"
        }

        $files = Get-ChildItem -Path $ThumbsDest -File -Recurse -ErrorAction SilentlyContinue
        $count = ($files | Measure-Object).Count
        $bytes = ($files | Measure-Object -Property Length -Sum).Sum
        if ($null -eq $bytes) { $bytes = 0 }

        $manifest = @{
            count  = $count
            bytes  = [long]$bytes
            schema = 'whitebg-v1'
            updated = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        }
        $manifest | ConvertTo-Json -Compress | Set-Content -Path $ManifestPath -Encoding UTF8
        Write-Host "manifest.json: count=$count bytes=$bytes"
    }
}

$destVersion = Join-Path $DestPanel 'version.json'
if (Test-Path $destVersion) {
    try {
        $v = Get-Content $destVersion -Raw | ConvertFrom-Json
        Write-Host "NAS version.json: $($v.version)"
    } catch {
        Write-Warning "Nie mozna odczytac version.json na NAS."
    }
}

$totalFiles = (Get-ChildItem -Path $DestPanel -File -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "Panel-DAM file count (recursive): $totalFiles"

exit 0
