# Instaluje zadanie Windows: co godzine sync dumpow z Synology -> DATABASE/ -> git push.
# Uruchom raz jako uzytkownik, ktory ma SSH do syno i git push do origin:
#   powershell -ExecutionPolicy Bypass -File apps/desktop/scripts/schedule-database-git-sync.ps1

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$py = (Get-Command python -ErrorAction Stop).Source
$script = Join-Path $repo "apps\desktop\scripts\sync-database-backups-to-git.py"
$taskName = "DAM-ETA-Database-Git-Sync"

$action = New-ScheduledTaskAction -Execute $py -Argument "`"$script`" --push" -WorkingDirectory $repo
# Co godzine, start za 5 minut od teraz, powtarzaj przez 10 lat (Windows nie lubi MaxValue)
$start = (Get-Date).AddMinutes(5)
$trigger = New-ScheduledTaskTrigger -Once -At $start `
  -RepetitionInterval (New-TimeSpan -Hours 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "OK: zadanie '$taskName' zarejestrowane (co 1h, --push)."
Write-Host "Repo: $repo"
Write-Host "Recznie: python apps/desktop/scripts/sync-database-backups-to-git.py --push"
