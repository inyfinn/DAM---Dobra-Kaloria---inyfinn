#!/bin/sh
# Backup PostgreSQL DAM ETA na Synology (ADR-009).
# Cron / most: co godzine. Nazwa z godzina, zeby 24 zrzuty na dobe wspolistnialy.
# Retencja: 48 plikow godzinowych + 72 zrzuty dzienne.
# Tylko odtwarzanie po katastrofie. NIE scalac zrzutow miedzy maszynami
# (users.id SERIAL / audit_log.id BIGSERIAL = kolizja kluczy).
#
# Zapis:
#   /volume1/docker/dam-eta-postgres/DATABASE/dam_eta_YYYY-MM-DD_HH.sql.gz
#   /volume1/docker/dam-eta-postgres/DATABASE/dam_eta_YYYY-MM-DD.sql.gz (dzienny)
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
MAX_DAILY=72
MAX_HOURLY=48
STAMP_HOUR="$(date +%Y-%m-%d_%H)"
STAMP_DAY="$(date +%Y-%m-%d)"
OUT_HOURLY="${OUT_DIR}/dam_eta_${STAMP_HOUR}.sql.gz"
OUT_DAILY="${OUT_DIR}/dam_eta_${STAMP_DAY}.sql.gz"
LOG="${OUT_DIR}/backup.log"

DRIVE_MIRROR="/volume1/homes/Inyfinn/Drive/DATABASE"

export PATH="${PATH}:/var/packages/ContainerManager/target/usr/bin"

mkdir -p "${OUT_DIR}"

if ! "${DOCKER_BIN}" ps --format '{{.Names}}' 2>/dev/null | grep -qx "${CONTAINER}"; then
  echo "$(date -Iseconds) ERROR: container ${CONTAINER} not running" >> "${LOG}"
  exit 1
fi

"${DOCKER_BIN}" exec -t "${CONTAINER}" pg_dump -U "${PGUSER}" -d "${PGDB}" --no-owner --no-acl \
  | gzip -c > "${OUT_HOURLY}.tmp"
mv -f "${OUT_HOURLY}.tmp" "${OUT_HOURLY}"
cp -f "${OUT_HOURLY}" "${OUT_DAILY}"

rotate_glob() {
  _dir="$1"
  _glob="$2"
  _keep="$3"
  _count="$(ls -1 ${_dir}/${_glob} 2>/dev/null | wc -l | tr -d ' ')"
  _count="${_count:-0}"
  if [ "${_count}" -gt "${_keep}" ]; then
    _drop=$((_count - _keep))
    ls -1 ${_dir}/${_glob} 2>/dev/null | sort | head -n "${_drop}" | while read -r old; do
      [ -n "${old}" ] || continue
      rm -f "${old}"
      echo "$(date '+%Y-%m-%dT%H:%M:%S') rotated away: ${old}" >> "${LOG}"
    done
  fi
}

rotate_glob "${OUT_DIR}" "dam_eta_????-??-??_??.sql.gz" "${MAX_HOURLY}"
rotate_glob "${OUT_DIR}" "dam_eta_????-??-??.sql.gz" "${MAX_DAILY}"

if [ -d "/volume1/homes/Inyfinn/Drive" ]; then
  mkdir -p "${DRIVE_MIRROR}"
  cp -f "${OUT_HOURLY}" "${DRIVE_MIRROR}/"
  cp -f "${OUT_DAILY}" "${DRIVE_MIRROR}/"
  rotate_glob "${DRIVE_MIRROR}" "dam_eta_????-??-??_??.sql.gz" "${MAX_HOURLY}"
  rotate_glob "${DRIVE_MIRROR}" "dam_eta_????-??-??.sql.gz" "${MAX_DAILY}"
fi

SIZE="$(wc -c < "${OUT_HOURLY}" | tr -d ' ')"
echo "$(date -Iseconds) OK ${OUT_HOURLY} (${SIZE} bytes)" >> "${LOG}"
exit 0
