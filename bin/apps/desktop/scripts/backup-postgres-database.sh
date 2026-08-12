#!/bin/sh
# Backup PostgreSQL DAM ETA na Synology (ADR-009).
# Cron: co godzine. Retencja: 1 plik / dzien, max 72 dni.
#
# Zapis:
#   /volume1/docker/dam-eta-postgres/DATABASE/dam_eta_YYYY-MM-DD.sql.gz
#   (opcjonalnie kopia do share Drive, jesli istnieje)
#
# Uruchomienie reczne:
#   /volume1/docker/dam-eta-postgres/backup-postgres-database.sh

set -eu

DOCKER_BIN="/var/packages/ContainerManager/target/usr/bin/docker"
CONTAINER="dam-eta-postgres"
PGUSER="dam_eta"
PGDB="dam_eta"
BASE="/volume1/docker/dam-eta-postgres"
OUT_DIR="${BASE}/DATABASE"
MAX_DAYS=72
TODAY="$(date +%Y-%m-%d)"
OUT_FILE="${OUT_DIR}/dam_eta_${TODAY}.sql.gz"
LOG="${OUT_DIR}/backup.log"

# Opcjonalna kopia widoczna w Synology Drive (jesli folder istnieje)
DRIVE_MIRROR="/volume1/homes/Inyfinn/Drive/DATABASE"

export PATH="${PATH}:/var/packages/ContainerManager/target/usr/bin"

mkdir -p "${OUT_DIR}"

if ! "${DOCKER_BIN}" ps --format '{{.Names}}' 2>/dev/null | grep -qx "${CONTAINER}"; then
  echo "$(date -Iseconds) ERROR: container ${CONTAINER} not running" >> "${LOG}"
  exit 1
fi

# pg_dump w kontenerze → gzip na hostcie (nadpisuje dzisiejszy plik)
"${DOCKER_BIN}" exec -t "${CONTAINER}" pg_dump -U "${PGUSER}" -d "${PGDB}" --no-owner --no-acl \
  | gzip -c > "${OUT_FILE}.tmp"
mv -f "${OUT_FILE}.tmp" "${OUT_FILE}"

# Retencja: zostaw max MAX_DAYS plikow (portable — bez head -n -N, BusyBox)
rotate_dir() {
  _dir="$1"
  _count="$(ls -1 "${_dir}"/dam_eta_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"
  _count="${_count:-0}"
  if [ "${_count}" -gt "${MAX_DAYS}" ]; then
    _drop=$((_count - MAX_DAYS))
    ls -1 "${_dir}"/dam_eta_*.sql.gz 2>/dev/null | sort | head -n "${_drop}" | while read -r old; do
      [ -n "${old}" ] || continue
      rm -f "${old}"
      echo "$(date '+%Y-%m-%dT%H:%M:%S') rotated away: ${old}" >> "${LOG}"
    done
  fi
}

rotate_dir "${OUT_DIR}"

if [ -d "/volume1/homes/Inyfinn/Drive" ]; then
  mkdir -p "${DRIVE_MIRROR}"
  cp -f "${OUT_FILE}" "${DRIVE_MIRROR}/"
  rotate_dir "${DRIVE_MIRROR}"
fi

SIZE="$(wc -c < "${OUT_FILE}" | tr -d ' ')"
echo "$(date -Iseconds) OK ${OUT_FILE} (${SIZE} bytes)" >> "${LOG}"
exit 0
