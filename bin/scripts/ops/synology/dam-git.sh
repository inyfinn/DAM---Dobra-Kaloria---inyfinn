#!/bin/sh
# Git DAM z NAS — SSH deploy key + HTTPS token fallback
export PATH="/opt/bin:/opt/sbin:/usr/local/bin:$PATH"
export GIT_SSH_COMMAND="ssh -i /var/services/homes/Inyfinn/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
PROJ="/volume1/INYFINN-magazyn/--- INYFINN - PROJEKTY/--- OSOBISTE/DAM - Dobra Kaloria - Inyfinn/DAM---Dobra-Kaloria---inyfinn"
CREDS="/var/services/homes/Inyfinn/.git-credentials"
cd "$PROJ" || { echo "Brak katalogu projektu: $PROJ"; exit 1; }
exec /opt/bin/git -c credential.helper="store --file=$CREDS" "$@"

# --- DSM Task Scheduler (hourly git pull + optional web sync) ---
# Panel: Sterowanie -> Harmonogram zadan -> Utworz -> Zaplanowane zadanie uzytkownika
# Uzytkownik: Inyfinn (lub root). Harmonogram: co 1 godzine.
#
# Krok 1 — git pull (ten skrypt):
#   /bin/sh /volume1/INYFINN-magazyn/---\ INYFINN\ -\ PROJEKTY/---\ OSOBISTE/DAM\ -\ Dobra\ Kaloria\ -\ Inyfinn/DAM---Dobra-Kaloria---inyfinn/bin/scripts/ops/synology/dam-git.sh pull --ff-only
#
# Krok 2 — sync statycznego UI do Web Station (po pull):
#   /bin/sh .../bin/scripts/ops/synology/dam-sync-panel-web.sh
#
# Fallback z PC (RaiDrive W:): co godzine
#   powershell -ExecutionPolicy Bypass -File bin\scripts\ops\synology\install-panel-dam-hourly-task.ps1
#   (rejestruje zadanie wywolujace deploy-panel-dam-synology.ps1)
