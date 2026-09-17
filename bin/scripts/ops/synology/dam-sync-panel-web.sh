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
    --exclude='scripts/' \
    --exclude='data/invoices.json' \
    --exclude='data/invoice-erp-export-last.json' \
    --exclude='data/invoice-erp-sync.json' \
    --exclude='data/project-costs.json' \
    --exclude='data/cost-rates.json' \
    --exclude='data/production-cost-catalog.json' \
    --exclude='data/fmcg-cost-averages.json' \
    --exclude='data/fmcg-cost-catalog.json' \
    --exclude='data/fmcg-cost-import-map.json' \
    --exclude='data/inbox-items.json' \
    --exclude='data/notification-groups.json' \
    --exclude='data/asana-tasks.json' \
    --exclude='data/asana-tasks-kw.csv' \
    --exclude='data/product-people.json' \
    --exclude='data/app-settings.json' \
    --exclude='data/user-prefs.json' \
    --exclude='data/audit-log.jsonl' \
    --exclude='data/campaigns.json' \
    "$SRC/" "$DST/"
  # Audyt 2026-09-17: /volume1/web jest publiczny. Dane firmowe (faktury, koszty, skrzynka,
  # ludzie) panel dostaje przez most po zalogowaniu, nie jako statyczny JSON. rsync --delete
  # nie rusza plikow wykluczonych, wiec stare kopie kasujemy jawnie.
  for f in invoices.json invoice-erp-export-last.json invoice-erp-sync.json project-costs.json cost-rates.json production-cost-catalog.json fmcg-cost-averages.json fmcg-cost-catalog.json fmcg-cost-import-map.json inbox-items.json notification-groups.json asana-tasks.json asana-tasks-kw.csv product-people.json app-settings.json user-prefs.json audit-log.jsonl campaigns.json; do
    rm -f "$DST/data/$f"
  done
  rm -rf "$DST/scripts"
  echo "rsync Panel-DAM OK"
  exit 0
fi

# Fallback: robocopy-like mirror via find+cp (no delete of extra files — conservative)
echo "rsync niedostepny; uzyj deploy-panel-dam-synology.ps1 z PC lub zainstaluj rsync."
exit 2
