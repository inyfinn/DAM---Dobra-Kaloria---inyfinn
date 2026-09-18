#!/usr/bin/env bash
# Kopia plikow repo (HEAD, tylko pliki sledzone w git) do /volume1/web/Panel-DAM
# na PRYWATNYM NAS (inyfinn-syno, alias SSH syno-ddns). NIE dotyczy firmowego NAS.
#
# Uruchom z Git Bash na komputerze z repo:
#   bash "bin/scripts/ops/synology/copy-repo-to-panel-dam.sh"
#
# Nic nie kasuje: pliki sa dodawane albo nadpisywane (tar -x), .git na NAS zostaje.
# W paczce sa tylko pliki sledzone w git - bez bin/secrets, pg-config.json, kopii bazy
# i lokalnych logow (te sa w .gitignore). Katalog /volume1/web jest publiczny.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
HOST="syno-ddns"
DEST="/volume1/web/Panel-DAM"

cd "$ROOT"
git rev-parse --is-inside-work-tree >/dev/null
echo "Repo: $ROOT  commit: $(git log --oneline -1)"

git archive --format=tar HEAD \
| ssh -o BatchMode=yes -o ConnectTimeout=20 "$HOST" \
    "test -d '$DEST' || { echo 'Brak $DEST'; exit 9; }; tar -xf - -C '$DEST' && echo 'rozpakowano OK'; head -3 '$DEST/bin/apps/web/version.json'"

for u in bin/apps/web/index.html bin/apps/web/version.json; do
  printf '%-32s ' "$u"
  curl -sk -m 20 -o /dev/null -w '%{http_code}\n' "https://inyfinn.synology.me/Panel-DAM/$u"
done
