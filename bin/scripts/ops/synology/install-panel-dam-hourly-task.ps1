#Requires -Version 5.1
<#
.SYNOPSIS
  Register Windows Scheduled Task: hourly deploy bin\apps\web -> W:\web\Panel-DAM.
.NOTES
  Hidden (wscript + WindowStyle Hidden). Abort unless DAM.exe or dam-appw.exe is running.
  RunLevel Limited. Do not use a visible powershell.exe action.
  Run elevated if Register-ScheduledTask fails. DSM alternative: see SYNOLOGY-WEB-PANEL.md
#>
param(
    [string]$TaskName = 'DAM-Panel-DAM-HourlySync',
    [switch]$Unregister
)

$ops = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path $ops 'run-dam-bg-job-hidden.vbs'
if (-not (Test-Path -LiteralPath $vbs)) {
    throw "Brak wrappera: $vbs"
}
$vbs = (Resolve-Path -LiteralPath $vbs).Path

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed task: $TaskName"
    exit 0
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`" panel-dam-sync"
$startAt = (Get-Date).AddMinutes(2)
$trigger = New-ScheduledTaskTrigger -Once -At $startAt -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -Hidden
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Hourly mirror DAM apps/web to Synology Panel-DAM (hidden; requires DAM.exe or dam-appw.exe)' -Force | Out-Null
Write-Host "Registered: $TaskName (every 1h, Hidden, Limited, VBS wrapper)"
Write-Host "VBS: $vbs"
