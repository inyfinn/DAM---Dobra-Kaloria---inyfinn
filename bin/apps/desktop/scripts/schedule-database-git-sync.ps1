# Instaluje zadanie Windows: co godzine sync dumpow z Synology -> DATABASE/ -> git push.
# Uruchom raz jako uzytkownik, ktory ma SSH do syno i git push do origin.
#
# Z CONTENT_ROOT (bin/):
#   powershell -ExecutionPolicy Bypass -File apps/desktop/scripts/schedule-database-git-sync.ps1
# Z GIT_ROOT:
#   powershell -ExecutionPolicy Bypass -File bin/apps/desktop/scripts/schedule-database-git-sync.ps1
#
# Layout: GIT_ROOT / bin = CONTENT_ROOT. Ten skrypt zawsze celuje w bin\apps\...
# (stare zadanie bez "bin\" konczylo sie WSH: "Nie mozna znalezc pliku skryptu").

$ErrorActionPreference = "Stop"
# PSScriptRoot = ...\bin\apps\desktop\scripts -> CONTENT_ROOT = ...\bin
$contentRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$gitRoot = (Resolve-Path (Join-Path $contentRoot "..")).Path

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
$script = Join-Path $contentRoot "apps\desktop\scripts\sync-database-backups-to-git.py"
$vbsSilent = Join-Path $contentRoot "apps\desktop\scripts\sync-database-backups-silent.vbs"
$taskName = "DAM-ETA-Database-Git-Sync"

if (-not (Test-Path -LiteralPath $vbsSilent)) {
  throw "Brak VBS: $vbsSilent`nSpodziewany layout: GIT_ROOT\bin\apps\desktop\scripts\..."
}
if (-not (Test-Path -LiteralPath $script)) {
  throw "Brak skryptu sync: $script"
}

# Usun stare zadanie (np. rejestracja z python.exe = widoczne okno CMD,
# albo sciezka bez bin\ z przed layoutu CONTENT_ROOT).
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null

# Uruchomienie przez VBS = brak migajacego okna CMD (WindowStyle Hidden + pythonw).
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsSilent`"" -WorkingDirectory $contentRoot
# Co godzine, start za 5 minut od teraz, powtarzaj przez 10 lat (Windows nie lubi MaxValue)
$start = (Get-Date).AddMinutes(5)
$trigger = New-ScheduledTaskTrigger -Once -At $start `
  -RepetitionInterval (New-TimeSpan -Hours 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Hidden
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "OK: zadanie '$taskName' zarejestrowane (co 1h, silent VBS + pythonw)."
Write-Host "CONTENT_ROOT: $contentRoot"
Write-Host "GIT_ROOT: $gitRoot"
Write-Host "VBS: $vbsSilent"
Write-Host "Pythonw: $pyw"
Write-Host "Recznie (silent): wscript `"$vbsSilent`""
