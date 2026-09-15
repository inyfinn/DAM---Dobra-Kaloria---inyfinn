#!/bin/sh
# NAS backup of github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn
# Semantics: hard reset to origin/<branch>. This is a backup, not a worktree.
# Untracked files (PAMIEC-PODRECZNA, leftover data/) stay inside $REPO. Never git clean.
# Native git is preferred; if missing, alpine/git via Container Manager.
#
# HARD: one folder only: /volume1/web/Panel-DAM. NEVER mv/rename it to a sibling
# (*.pre-git*, *.pre-git-*, *.bak, timestamped sidecars). If the dest exists
# without .git, init in place so cache and leftover data remain inside it.

set -eu

REPO="${DAM_NAS_REPO:-/volume1/web/Panel-DAM}"
BRANCH="${DAM_NAS_BRANCH:-main}"
REMOTE_URL="${DAM_NAS_REMOTE:-git@github.com:inyfinn/DAM---Dobra-Kaloria---inyfinn.git}"
LOG_DIR="${DAM_NAS_LOG_DIR:-/var/services/homes/Inyfinn/logs}"
LOG="${DAM_NAS_LOG:-$LOG_DIR/panel-dam-git-pull.log}"
SSH_KEY="${DAM_NAS_SSH_KEY:-/var/services/homes/Inyfinn/.ssh/id_ed25519}"
KNOWN_HOSTS="${DAM_NAS_KNOWN_HOSTS:-/var/services/homes/Inyfinn/.ssh/known_hosts}"
DOCKER="${DAM_NAS_DOCKER:-/var/packages/ContainerManager/target/usr/bin/docker}"
IMAGE="${DAM_NAS_GIT_IMAGE:-alpine/git:latest}"

PATH="/var/packages/ContainerManager/target/usr/bin:/usr/local/bin:/opt/bin:/usr/bin:/bin:$PATH"
export PATH

mkdir -p "$LOG_DIR"

log() {
    ts=$(date '+%Y-%m-%d %H:%M:%S %z')
    printf '%s %s\n' "$ts" "$*" | tee -a "$LOG"
}

die() {
    log "FAIL $*"
    exit 1
}

resolve_git() {
    _c=""
    for _c in /opt/bin/git /usr/bin/git /usr/local/bin/git; do
        if [ -x "$_c" ] && "$_c" --version >/dev/null 2>&1; then
            echo "$_c"
            return 0
        fi
    done
    echo ""
}

NATIVE_GIT=$(resolve_git)

run_git() {
    if [ -n "$NATIVE_GIT" ]; then
        GIT_SSH_COMMAND="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
            "$NATIVE_GIT" -C "$REPO" "$@"
    else
        [ -x "$DOCKER" ] || die "git missing and docker not executable: $DOCKER"
        "$DOCKER" run --rm \
            -v "$REPO":/repo \
            -v "$SSH_KEY":/root/.ssh/id_ed25519:ro \
            -v "$KNOWN_HOSTS":/root/.ssh/known_hosts:ro \
            -e GIT_SSH_COMMAND="ssh -i /root/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
            -w /repo \
            "$IMAGE" "$@"
    fi
}

run_git_parent() {
    _parent=$(dirname "$REPO")
    _name=$(basename "$REPO")
    if [ -n "$NATIVE_GIT" ]; then
        GIT_SSH_COMMAND="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
            "$NATIVE_GIT" -C "$_parent" "$@"
    else
        [ -x "$DOCKER" ] || die "git missing and docker not executable: $DOCKER"
        "$DOCKER" run --rm \
            -v "$_parent":/work \
            -v "$SSH_KEY":/root/.ssh/id_ed25519:ro \
            -v "$KNOWN_HOSTS":/root/.ssh/known_hosts:ro \
            -e GIT_SSH_COMMAND="ssh -i /root/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
            -w /work \
            "$IMAGE" "$@"
    fi
}

[ -f "$SSH_KEY" ] || die "missing GitHub deploy key: $SSH_KEY"
[ -d "$(dirname "$REPO")" ] || die "missing parent of $REPO"

if [ ! -d "$REPO/.git" ]; then
    log "CLONE start url=$REMOTE_URL dest=$REPO"
    if [ ! -e "$REPO" ]; then
        run_git_parent clone --branch "$BRANCH" -- "$REMOTE_URL" "$(basename "$REPO")" \
            || die "git clone failed"
    elif [ -d "$REPO" ]; then
        # Init in place. Never rename $REPO to a sibling sidecar.
        log "INIT in place (existing folder kept; no sidecar)"
        run_git init || die "git init failed"
        if run_git remote get-url origin >/dev/null 2>&1; then
            run_git remote set-url origin "$REMOTE_URL" || die "remote set-url failed"
        else
            run_git remote add origin "$REMOTE_URL" || die "remote add failed"
        fi
        run_git fetch --prune origin || die "git fetch failed (auth or network)"
        run_git reset --hard "origin/$BRANCH" || die "git reset --hard origin/$BRANCH failed"
    else
        die "dest exists and is not a directory: $REPO"
    fi
    AFTER=$(run_git rev-parse --short HEAD) || die "clone produced no HEAD"
    log "CLONE ok commit=$AFTER branch=$BRANCH"
    exit 0
fi

BEFORE=$(run_git rev-parse HEAD) || die "cannot read HEAD"
BEFORE_SHORT=$(run_git rev-parse --short HEAD)

run_git fetch --prune origin || die "git fetch failed (auth or network)"

ORIGIN_SHA=$(run_git rev-parse "origin/$BRANCH") || die "missing origin/$BRANCH after fetch"

run_git reset --hard "origin/$BRANCH" || die "git reset --hard origin/$BRANCH failed"

AFTER=$(run_git rev-parse HEAD)
AFTER_SHORT=$(run_git rev-parse --short HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
    log "NOOP commit=$AFTER_SHORT branch=$BRANCH"
else
    log "PULLED $BEFORE_SHORT -> $AFTER_SHORT branch=$BRANCH"
fi

CACHE="$REPO/bin/PAMIEC-PODRECZNA"
if [ -d "$CACHE" ]; then
    cache_n=$(find "$CACHE" -type f ! -name manifest.json ! -name cache-pack.tar ! -name files.tsv ! -name cache-pack.meta.json | wc -l | tr -d ' ')
    log "CACHE present files=$cache_n path=$CACHE"
else
    log "CACHE missing (desktop first-run will fetch from this folder once it exists)"
fi

exit 0
