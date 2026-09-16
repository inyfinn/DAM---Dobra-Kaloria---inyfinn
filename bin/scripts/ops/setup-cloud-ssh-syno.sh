#!/usr/bin/env bash
# Cloud VM: SSH do Synology (aliasy: nas + syno).
# Sekrety jak w https://github.com/inyfinn/synology-mcp (docs/dom/cloud-agent-ssh.md):
#   NAS_SSH_KEY, NAS_SSH_USER, NAS_SSH_HOST, NAS_SSH_PORT (domyslnie 5022, NIE 22).
# DAM sync-database-backups-to-git.py uzywa Host syno.
set -euo pipefail

SSH_DIR="${HOME}/.ssh"
KEY_FILE="${SSH_DIR}/cloud-agent-nas"
CONFIG_FILE="${SSH_DIR}/config"
MARK_BEGIN="# >>> dam-syno-nas >>>"
MARK_END="# <<< dam-syno-nas <<<"

NAS_SSH_HOST="${NAS_SSH_HOST:-${DAM_SSH_HOST:-inyfinn.synology.me}}"
NAS_SSH_PORT="${NAS_SSH_PORT:-${DAM_SSH_PORT:-5022}}"
NAS_SSH_USER="${NAS_SSH_USER:-${DAM_SSH_USER:-Inyfinn}}"

VERIFY_ONLY=false
if [[ "${1:-}" == "--verify-only" ]]; then
  VERIFY_ONLY=true
fi

mkdir -p "${SSH_DIR}"
chmod 700 "${SSH_DIR}"

if [[ -n "${NAS_SSH_KEY:-}" ]]; then
  printf '%s\n' "${NAS_SSH_KEY}" > "${KEY_FILE}"
  sed -i 's/\r$//' "${KEY_FILE}"
  chmod 600 "${KEY_FILE}"
  KEY_SOURCE="NAS_SSH_KEY (Cursor secret)"
elif [[ -f "${KEY_FILE}" ]]; then
  chmod 600 "${KEY_FILE}"
  KEY_SOURCE="existing ${KEY_FILE}"
else
  echo "BRAK SEKRETU: NAS_SSH_KEY"
  echo "Sekrety sa w Cursor Cloud Environment (repo synology-mcp ma runbook)."
  echo "Dodaj do Environment tego agenta (DAM):"
  echo "  NAS_SSH_KEY, NAS_SSH_USER=Inyfinn, NAS_SSH_HOST=inyfinn.synology.me, NAS_SSH_PORT=5022"
  echo "Instrukcja: https://github.com/inyfinn/synology-mcp/blob/main/docs/dom/cloud-agent-ssh.md"
  exit 1
fi

if [[ -f "${CONFIG_FILE}" ]] && grep -q "${MARK_BEGIN}" "${CONFIG_FILE}"; then
  sed -i "/${MARK_BEGIN}/,/${MARK_END}/d" "${CONFIG_FILE}"
fi

{
  echo "${MARK_BEGIN}"
  cat <<EOF
Host nas syno inyfinn-nas
  HostName ${NAS_SSH_HOST}
  User ${NAS_SSH_USER}
  Port ${NAS_SSH_PORT}
  IdentityFile ${KEY_FILE}
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
  ConnectTimeout 15
  ServerAliveInterval 30
  ServerAliveCountMax 3
EOF
  echo "${MARK_END}"
} >> "${CONFIG_FILE}"
chmod 600 "${CONFIG_FILE}"

echo "SSH OK: ${NAS_SSH_USER}@${NAS_SSH_HOST}:${NAS_SSH_PORT} (aliasy: nas, syno) [${KEY_SOURCE}]"

if [[ "${VERIFY_ONLY}" == "true" ]]; then
  if ssh -o BatchMode=yes -o ConnectTimeout=15 syno "echo SSH_OK && hostname && whoami"; then
    echo "Polaczenie syno: OK"
  else
    echo "Polaczenie syno: NIEUDANE (klucz publiczny na NAS? port ${NAS_SSH_PORT}?)"
    exit 1
  fi
fi
