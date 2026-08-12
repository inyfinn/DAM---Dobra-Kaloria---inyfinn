#Requires -Version 5.1
<#
.SYNOPSIS
  Konfiguracja Postgres Synology + test polaczenia + preferencje bazy (auto).
.EXAMPLE
  powershell -File bin\scripts\ops\setup-postgres-synology.ps1
#>
param(
  [string]$Password = "",
  [switch]$PullDump
)

$ErrorActionPreference = "Stop"
$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$Desktop = Join-Path $GitRoot "bin\apps\desktop"
$DataDir = Join-Path $Desktop "data"
$PgConfig = Join-Path $DataDir "pg-config.json"
$PgExample = Join-Path $Desktop "pg-config.example.json"
$EnvExample = Join-Path $Desktop "dam-connection.env.example"
$EnvFile = Join-Path $Desktop "dam-connection.env"
$Prefer = Join-Path $DataDir "db-prefer.json"

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

if (-not (Test-Path $PgConfig)) {
  if (-not (Test-Path $PgExample)) { throw "Brak $PgExample" }
  Copy-Item $PgExample $PgConfig -Force
  Write-Host "Utworzono $PgConfig z szablonu."
}

if (-not $Password) {
  $sec = Read-Host "Haslo Postgres (dam_eta) - Enter jesli juz w pliku" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}

if ($Password) {
  $cfg = Get-Content $PgConfig -Raw | ConvertFrom-Json
  $cfg.password = $Password
  $cfg | ConvertTo-Json -Depth 5 | Set-Content $PgConfig -Encoding UTF8

  if (-not (Test-Path $EnvFile)) { Copy-Item $EnvExample $EnvFile -Force }
  @(
    "DAM_PG_HOSTS=inyfinn.synology.me,192.168.0.145",
    "DAM_PG_HOST=inyfinn.synology.me",
    "DAM_PG_PORT=5433",
    "DAM_PG_DBNAME=dam_eta",
    "DAM_PG_USER=dam_eta",
    "DAM_PG_PASSWORD=$Password"
  ) | Set-Content $EnvFile -Encoding UTF8
  Write-Host "Zapisano pg-config.json i dam-connection.env (haslo nie trafia do gita)."
}

$preferObj = @{
  mode = "auto"
  sources = @{ synology = $true; github = $true; local = $true }
}
$preferObj | ConvertTo-Json -Depth 4 | Set-Content $Prefer -Encoding UTF8
Write-Host "Ustawiono db-prefer.json -> mode=auto, Synology+GitHub+lokalny."

$py = Join-Path $GitRoot "bin\runtime\win\python\python.exe"
if (-not (Test-Path $py)) { $py = "python" }
$test = @"
import sys
sys.path.insert(0, r'$Desktop')
import pg_db
conn = pg_db.connect()
cur = conn.cursor()
cur.execute('SELECT 1')
print('OK Postgres:', pg_db._LAST_HOST)
conn.close()
"@
& $py -c $test
if ($LASTEXITCODE -ne 0) { throw "Test polaczenia Postgres nieudany." }

if ($PullDump) {
  $sync = Join-Path $Desktop "scripts\sync-database-backups-to-git.py"
  & $py $sync
  Write-Host "Pobrano dumpy do bin\DATABASE\"
}

Write-Host ""
Write-Host "GOTOWE: Postgres Synology (glowna) + lokalny SQLite jako awaria."
Write-Host "Dumpy: bin\DATABASE\ + sync z Synology przez sync-database-backups-to-git.py"
