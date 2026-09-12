#Requires -Version 5.1
<#
.SYNOPSIS
  Register Windows Scheduled Task: hourly deploy bin\apps\web -> W:\web\Panel-DAM.
.NOTES
  Run elevated if Register-ScheduledTask fails. DSM alternative: see SYNOLOGY-WEB-PANEL.md
#>
param(
    [string]$TaskName = 'DAM-Panel-DAM-HourlySync',
    [switch]$Unregister
)

$deployScript = Join-Path $PSScriptRoot '..\deploy-panel-dam-synology.ps1'
$deployScript = (Resolve-Path $deployScript).Path

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed task: $TaskName"
    exit 0
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$deployScript`""
$startAt = (Get-Date).AddMinutes(2)
$trigger = New-ScheduledTaskTrigger -Once -At $startAt -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Hourly mirror DAM apps/web to Synology Panel-DAM (RaiDrive W:)' -Force | Out-Null
Write-Host "Registered: $TaskName (every 1h for 3650d, first run ~2 min)"
Write-Host "Deploy script: $deployScript"
