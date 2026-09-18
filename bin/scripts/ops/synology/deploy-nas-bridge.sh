#!/usr/bin/env bash
# Wdrozenie mostu DAM na PRYWATNY NAS (inyfinn-syno, alias SSH syno-ddns) i restart.
# NIE dotyczy firmowego NAS (administratorkubara).
#
# Uruchom z Git Bash na komputerze z repo:
#   bash "bin/scripts/ops/synology/deploy-nas-bridge.sh"
#
# Co robi (nic nie kasuje):
#  1. kopiuje aktualny kod z bin/apps/desktop i bin/apps/web/scripts do
#     /volume1/docker/dam-bridge/bin/apps (bez data/, tests/, logs/) - konfiguracja
#     z haslem w data/pg-config.json i dam-connection.env zostaje nietknieta,
#  2. robi kopie /volume1/web/_nginx/start-dam-bridge.sh (.bak-<data>) i ustawia
#     w nim DESKTOP na nowy katalog (stary folder INYFINN-magazyn ma ucięty kod),
#  3. zatrzymuje stary proces (plik PID) i startuje most przez start-dam-bridge.sh,
#  4. sprawdza https://inyfinn.synology.me/dam-api/health.
# Most w trybie publicznym od 2.0.9 NIE zapisuje przy starcie magazynow KV do bazy.
set -euo pipefail

REPO_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HOST="syno-ddns"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=15 "$HOST")
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "Repo bin: $REPO_BIN"
test -f "$REPO_BIN/apps/desktop/local_bridge.py" || { echo "Brak local_bridge.py"; exit 1; }

echo "[1/4] Kopiowanie kodu mostu..."
tar -cf - \
  --exclude='__pycache__' --exclude='./desktop/data' --exclude='./desktop/tests' \
  --exclude='./desktop/logs' --exclude='./desktop/bootstrap' \
  -C "$REPO_BIN/apps" ./desktop ./web/scripts \
| "${SSH[@]}" 'set -e; T=/volume1/docker/dam-bridge/bin/apps; mkdir -p "$T/desktop/data" /volume1/docker/dam-bridge/bin/DATABASE; tar -xf - -C "$T"; /usr/local/bin/python3.13 -m py_compile "$T/desktop/local_bridge.py" "$T/desktop/pg_db.py" && echo "   kompilacja OK"; test -f "$T/desktop/data/pg-config.json" && echo "   konfiguracja bazy obecna"'

echo "[2/4] Skrypt startowy -> nowy katalog (kopia .bak-$STAMP)..."
"${SSH[@]}" "S=/volume1/web/_nginx/start-dam-bridge.sh; cp -p \"\$S\" \"\$S.bak-$STAMP\"; sed -i 's#^DESKTOP=.*#DESKTOP=\"/volume1/docker/dam-bridge/bin/apps/desktop\"#' \"\$S\"; grep -n '^DESKTOP=' \"\$S\""

echo "[3/4] Restart mostu..."
"${SSH[@]}" 'P=/volume1/web/_nginx/dam-bridge.pid; if [ -f "$P" ] && kill -0 "$(cat "$P")" 2>/dev/null; then kill "$(cat "$P")"; sleep 3; fi; sh /volume1/web/_nginx/start-dam-bridge.sh'

echo "[4/4] Health..."
sleep 8
curl -sk -m 15 -w '  HTTP %{http_code}\n' https://inyfinn.synology.me/dam-api/health || true
"${SSH[@]}" 'grep -v "kv_cache watcher" /volume1/web/_nginx/dam-bridge.log | tail -12'
