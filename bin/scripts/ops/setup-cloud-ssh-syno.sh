#!/usr/bin/env bash
# Cloud VM: klucz SSH + alias Host syno (sync-database-backups-to-git.py).
# Nie commituje klucza prywatnego — generowany lokalnie w ~/.ssh/.
set -euo pipefail

SSH_DIR="${HOME}/.ssh"
KEY="${SSH_DIR}/id_ed25519_dam"
HOST="${DAM_SSH_HOST:-inyfinn.synology.me}"
PORT="${DAM_SSH_PORT:-22}"
USER="${DAM_SSH_USER:-Inyfinn}"

mkdir -p "${SSH_DIR}"
chmod 700 "${SSH_DIR}"

if [[ ! -f "${KEY}" ]]; then
  ssh-keygen -t ed25519 -f "${KEY}" -N "" -C "cursor-cloud-dam-agent@$(hostname)"
fi
chmod 600 "${KEY}"
chmod 644 "${KEY}.pub"

CONFIG="${SSH_DIR}/config"
MARK_BEGIN="# >>> dam-syno >>>"
MARK_END="# <<< dam-syno <<<"
if [[ -f "${CONFIG}" ]] && grep -q "${MARK_BEGIN}" "${CONFIG}"; then
  sed -i "/${MARK_BEGIN}/,/${MARK_END}/d" "${CONFIG}"
fi

{
  echo "${MARK_BEGIN}"
  cat <<EOF
Host syno inyfinn-nas
  HostName ${HOST}
  User ${USER}
  Port ${PORT}
  IdentityFile ${KEY}
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
  ConnectTimeout 12
  ServerAliveInterval 30
  ServerAliveCountMax 3
EOF
  echo "${MARK_END}"
} >> "${CONFIG}"
chmod 600 "${CONFIG}"

echo "OK: ~/.ssh/config (Host syno -> ${USER}@${HOST}:${PORT})"
echo "Public key (dodaj na NAS do ~/.ssh/authorized_keys uzytkownika ${USER}):"
cat "${KEY}.pub"
echo
echo "Test: ssh -o BatchMode=yes syno 'echo OK && hostname'"
