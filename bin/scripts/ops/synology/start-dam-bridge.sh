#!/bin/sh
# DAM local_bridge na Synology (auth API dla Panel-DAM)
DESKTOP="/volume1/INYFINN-magazyn/--- INYFINN - PROJEKTY/--- OSOBISTE/DAM - Dobra Kaloria - Inyfinn/DAM---Dobra-Kaloria---inyfinn/bin/apps/desktop"
PY="/usr/local/bin/python3.13"
LOG="/volume1/web/_nginx/dam-bridge.log"
PID="/volume1/web/_nginx/dam-bridge.pid"

export DAM_UI_ORIGIN="https://inyfinn.synology.me/Panel-DAM"
export DAM_WEB_ROOT="/volume1/web/Panel-DAM"
export DAM_BRIDGE_PORT="8766"

cd "$DESKTOP" || exit 1

if [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; then
  echo "Bridge juz dziala (PID $(cat "$PID"))"
  exit 0
fi

nohup "$PY" local_bridge.py >> "$LOG" 2>&1 &
echo $! > "$PID"
sleep 2
if kill -0 "$(cat "$PID")" 2>/dev/null; then
  echo "OK bridge PID $(cat "$PID")"
else
  echo "FAIL bridge - sprawdz $LOG"
  tail -20 "$LOG"
  exit 1
fi
