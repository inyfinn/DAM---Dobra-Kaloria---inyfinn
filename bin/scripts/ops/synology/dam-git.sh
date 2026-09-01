#!/bin/sh
# Git DAM z NAS — SSH deploy key + HTTPS token fallback
export PATH="/opt/bin:/opt/sbin:/usr/local/bin:$PATH"
export GIT_SSH_COMMAND="ssh -i /var/services/homes/Inyfinn/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
PROJ="/volume1/INYFINN-magazyn/--- INYFINN - PROJEKTY/--- OSOBISTE/DAM - Dobra Kaloria - Inyfinn/DAM---Dobra-Kaloria---inyfinn"
CREDS="/var/services/homes/Inyfinn/.git-credentials"
cd "$PROJ" || { echo "Brak katalogu projektu: $PROJ"; exit 1; }
exec /opt/bin/git -c credential.helper="store --file=$CREDS" "$@"
