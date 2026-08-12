# Redis for DAM (Windows) — bez Dockera

**Redis bez Dockera: tak.** Preferujemy natywny Redis na `127.0.0.1:6379`.  
Docker Compose (`docker-compose.redis.yml`) to tylko opcjonalny fallback.

Most (`local_bridge.py` :8766) działa bez Redis — circuit breaker OPEN + fallback matrix.  
`DAM_REDIS_URL` default: `redis://127.0.0.1:6379/0` (bez zmian).

### One-liner (gdy Redis nie działa — już zainstalowany)

```powershell
powershell -File apps/desktop/start-redis.ps1
# albo:
$d="$env:LOCALAPPDATA\DAM-Redis"; Start-Process "$d\redis-server.exe" -ArgumentList "`"$d\redis.windows.conf`"","--bind","127.0.0.1","--port","6379" -WorkingDirectory $d -WindowStyle Hidden; & "$d\redis-cli.exe" -h 127.0.0.1 -p 6379 ping
```

Po `PONG` most zwykle sam zamyka circuit (~12s probe). Restart mostu tylko gdy `/health` nadal `redis:open` po ~20s.

---

## Preferowane: natywny Redis for Windows (tporadowski)

Oficjalny port Redis 5.x na Windows (bez Docker Desktop).

### Instalacja (user-space, bez admina)

```powershell
$dest = Join-Path $env:LOCALAPPDATA "DAM-Redis"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$zip = Join-Path $dest "Redis-x64-5.0.14.1.zip"
$url = "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip"
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath $dest -Force
```

### Start (localhost only)

```powershell
$dest = Join-Path $env:LOCALAPPDATA "DAM-Redis"
Start-Process -FilePath (Join-Path $dest "redis-server.exe") `
  -ArgumentList "`"$(Join-Path $dest 'redis.windows.conf')`"", "--bind", "127.0.0.1", "--port", "6379" `
  -WorkingDirectory $dest -WindowStyle Hidden
& (Join-Path $dest "redis-cli.exe") -h 127.0.0.1 -p 6379 ping
# oczekiwane: PONG
```

### Weryfikacja mostu

```powershell
curl.exe -s --max-time 8 http://127.0.0.1:8766/health
# po starcie Redis + ewentualnym restarcie mostu: "redis":"ok", "redis_circuit":"closed"
# bez Redis: "redis":"open" — UI nadal OK
```

---

## Alternatywa: Memurai Developer (Chocolatey, wymaga admina)

Redis-compatible na Windows. Gdy masz podniesione uprawnienia:

```powershell
# PowerShell / cmd jako Administrator
choco install memurai-developer -y
# usługa Memurai nasłuchuje zwykle na 127.0.0.1:6379
```

Jeśli `choco` zgłasza lock / brak elevation — użyj ścieżki tporadowski powyżej (bez admina).

---

## Opcjonalny fallback: Docker

Tylko gdy Docker Desktop już działa u Ciebie:

```powershell
docker compose -f apps/desktop/docker-compose.redis.yml up -d
```

Nie wymagaj Dockera od kolegów — native Redis jest ścieżką domyślną.

---

## Circuit breaker (bez zmian zachowania)

| Stan | Zachowanie |
|------|------------|
| CLOSED | Normalny ruch Redis |
| OPEN | Po refuse / N błędach — zero connect per HTTP request |
| HALF-OPEN | Background probe (~12s) — jedna próba; sukces → CLOSED |

Kod: `apps/desktop/dam_redis.py`.
