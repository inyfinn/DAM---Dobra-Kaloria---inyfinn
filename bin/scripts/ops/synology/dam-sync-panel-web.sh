#!/bin/sh
# Sync bin/apps/web -> /volume1/web/Panel-DAM after git pull on NAS.
# Excludes pamiec-podreczna, local identity/runtime JSON, data/thumbs, conflicts, tmp.
export PATH="/opt/bin:/opt/sbin:/usr/local/bin:$PATH"

PROJ="/volume1/INYFINN-magazyn/--- INYFINN - PROJEKTY/--- OSOBISTE/DAM - Dobra Kaloria - Inyfinn/DAM---Dobra-Kaloria---inyfinn"
SRC="$PROJ/bin/apps/web"
DST="/volume1/web/Panel-DAM"

if [ ! -d "$SRC" ]; then
  echo "Brak zrodla: $SRC"
  exit 1
fi

mkdir -p "$DST"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude='pamiec-podreczna/' \
    --exclude='data/thumbs/' \
    --exclude='dam-runtime.json' \
    --exclude='dam-identity.json' \
    --exclude='*_Conflict*' \
    --exclude='*.tmp' \
    "$SRC/" "$DST/"
  echo "rsync Panel-DAM OK"
  exit 0
fi

# Fallback: robocopy-like mirror via find+cp (no delete of extra files — conservative)
echo "rsync niedostepny; uzyj deploy-panel-dam-synology.ps1 z PC lub zainstaluj rsync."
exit 2
