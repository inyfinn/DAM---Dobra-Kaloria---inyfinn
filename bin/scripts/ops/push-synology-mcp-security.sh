#!/usr/bin/env bash
# Push security hardening branch to inyfinn/synology-mcp (requires GitHub write access).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE="${SCRIPT_DIR}/../../docs/ops/synology-mcp-security"
WORK="/tmp/synology-mcp-push-$$"
BRANCH="cursor/secure-github-repo-90ad"

cleanup() { rm -rf "${WORK}"; }
trap cleanup EXIT

bash "${SCRIPT_DIR}/clone-synology-mcp.sh" "${WORK}"
cd "${WORK}"
git checkout -B "${BRANCH}"

cp "${BUNDLE}/SECURITY.md" .
cp "${BUNDLE}/github-bezpieczenstwo.md" docs/dom/
cp "${BUNDLE}/files/cloud-agent-ssh.md" docs/dom/cloud-agent-ssh.md

# Merge .gitignore extras (idempotent markers)
if ! grep -q '# >>> security-hardening >>>' .gitignore 2>/dev/null; then
  cat >> .gitignore <<'EOF'

# >>> security-hardening >>>
**/.env
**/.env.*
!**/.env.example
**/credentials.json
**/*credentials*
**/id_rsa
**/id_ed25519
**/*.pem
**/*.p12
# <<< security-hardening <<<
EOF
fi

if ! grep -q 'Bezpieczeństwo:' README.md; then
  sed -i '1a\
\
> **Bezpieczeństwo:** repo jest **Private**. Sekrety tylko w Cursor Environment. Zob. [SECURITY.md](SECURITY.md).
' README.md
fi

git add SECURITY.md docs/dom/github-bezpieczenstwo.md docs/dom/cloud-agent-ssh.md .gitignore README.md
if ! git diff --cached --quiet; then
  git commit -m "docs(security): harden private repo (Cursor agent)"
fi

TOKEN="${GITHUB_PAT:-${SYNOLOGY_MCP_GITHUB_TOKEN:-}}"
if [[ -n "${TOKEN}" ]]; then
  git push "https://x-access-token:${TOKEN}@github.com/inyfinn/synology-mcp.git" "${BRANCH}"
else
  git push -u origin "${BRANCH}"
fi

echo "OK: ${BRANCH} pushed to inyfinn/synology-mcp"
