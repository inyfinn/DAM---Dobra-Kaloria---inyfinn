#!/usr/bin/env bash
# Clone inyfinn/synology-mcp (private) for Cloud Agent install/start hooks.
# Auth order: gh credential helper → GITHUB_PAT / SYNOLOGY_MCP_GITHUB_TOKEN → anonymous.
set -euo pipefail

DEST="${1:-/tmp/synology-mcp}"
REPO="inyfinn/synology-mcp"
URL="https://github.com/${REPO}.git"

clone_with_url() {
  local u="$1"
  rm -rf "${DEST}"
  git clone --depth 1 "${u}" "${DEST}"
}

if [[ -d "${DEST}/.git" ]] && git -C "${DEST}" remote get-url origin >/dev/null 2>&1; then
  if git -C "${DEST}" fetch --depth 1 origin main 2>/dev/null; then
    git -C "${DEST}" checkout -q main 2>/dev/null || git -C "${DEST}" checkout -q FETCH_HEAD
    echo "synology-mcp: updated ${DEST}"
    exit 0
  fi
fi

TOKEN="${GITHUB_PAT:-${SYNOLOGY_MCP_GITHUB_TOKEN:-}}"
if [[ -n "${TOKEN}" ]]; then
  clone_with_url "https://x-access-token:${TOKEN}@github.com/${REPO}.git"
  echo "synology-mcp: cloned via GITHUB_PAT → ${DEST}"
  exit 0
fi

if command -v gh >/dev/null 2>&1; then
  if gh api "repos/${REPO}" --jq .name >/dev/null 2>&1; then
    clone_with_url "${URL}"
    echo "synology-mcp: cloned via gh (Cursor GitHub App) → ${DEST}"
    exit 0
  fi
fi

if git ls-remote "${URL}" HEAD >/dev/null 2>&1; then
  clone_with_url "${URL}"
  echo "synology-mcp: cloned (public) → ${DEST}"
  exit 0
fi

cat >&2 <<'EOF'
synology-mcp: brak dostępu (repo private).

Dodaj repozytorium do aplikacji Cursor na GitHubie:
  github.com/settings/installations → Cursor → Configure
  → Repository access → wybierz inyfinn/synology-mcp (lub All repositories)

Albo dodaj sekret w Cursor Environment:
  GITHUB_PAT = fine-grained PAT z read access do synology-mcp

Albo dodaj współpracownika cursor[bot] z Write:
  github.com/inyfinn/synology-mcp/settings/access
EOF
exit 1
