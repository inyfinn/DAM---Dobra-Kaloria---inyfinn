# Instaluje zadanie Windows: co godzine sync dumpow z Synology -> DATABASE/ -> git push.
# Uruchom raz jako uzytkownik, ktory ma SSH do syno i git push do origin:
#   powershell -ExecutionPolicy Bypass -File apps/desktop/scripts/schedule-database-git-sync.ps1

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path

function Resolve-Pythonw {
  $candidates = @(
    "C:\Python314\pythonw.exe",
    "C:\Python313\pythonw.exe",
    "C:\Python312\pythonw.exe",
    "C:\Python311\pythonw.exe",
    "$env:LocalAppData\Programs\Python\Python314\pythonw.exe",
    "$env:LocalAppData\Programs\Python\Python313\pythonw.exe",
    "$env:LocalAppData\Programs\Python\Python312\pythonw.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { return $c }
  }
  $cmd = Get-Command pythonw -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "Nie znaleziono pythonw.exe. Zainstaluj Python 3 z pythonw."
}

$pyw = Resolve-Pythonw
$script = Join-Path $repo "apps\desktop\scripts\sync-database-backups-to-git.py"
$vbsSilent = Join-Path $repo "apps\desktop\scripts\sync-database-backups-silent.vbs"
$taskName = "DAM-ETA-Database-Git-Sync"

# Uruchomienie przez VBS = brak migajacego okna CMD (WindowStyle Hidden + pythonw).
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsSilent`"" -WorkingDirectory $repo
# Co godzine, start za 5 minut od teraz, powtarzaj przez 10 lat (Windows nie lubi MaxValue)
$start = (Get-Date).AddMinutes(5)
$trigger = New-ScheduledTaskTrigger -Once -At $start `
  -RepetitionInterval (New-TimeSpan -Hours 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Hidden
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "OK: zadanie '$taskName' zarejestrowane (co 1h, silent VBS + pythonw)."
Write-Host "Repo: $repo"
Write-Host "Pythonw: $pyw"
Write-Host "Recznie (silent): wscript apps/desktop/scripts/sync-database-backups-silent.vbs"
