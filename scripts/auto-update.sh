#!/usr/bin/env bash
set -euo pipefail

# Keep PATH explicit for cron/systemd environments.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd -- "${SCRIPT_DIR}/.." && pwd)}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
CONTAINER_NAME="${CONTAINER_NAME:-hisaab}"
LOCK_DIR="${LOCK_DIR:-/tmp/hisaab-auto-update.lock}"

log() {
  printf "[%s] %s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"
}

compose() {
  if [[ "${USE_DOCKER_COMPOSE_V1:-0}" == "1" ]]; then
    if [[ -n "${COMPOSE_FILE:-}" ]]; then
      docker-compose -f "${COMPOSE_FILE}" "$@"
    else
      docker-compose "$@"
    fi
  else
    if [[ -n "${COMPOSE_FILE:-}" ]]; then
      docker compose -f "${COMPOSE_FILE}" "$@"
    else
      docker compose "$@"
    fi
  fi
}

cleanup_lock() {
  rmdir "${LOCK_DIR}" 2>/dev/null || true
}

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  log "Another auto-update process is already running. Exiting."
  exit 0
fi
trap cleanup_lock EXIT

cd "${REPO_DIR}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "Directory is not a git repository: ${REPO_DIR}"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  log "Docker CLI not found."
  exit 1
fi

if [[ "${USE_DOCKER_COMPOSE_V1:-0}" == "1" ]]; then
  if ! command -v docker-compose >/dev/null 2>&1; then
    log "docker-compose not found while USE_DOCKER_COMPOSE_V1=1."
    exit 1
  fi
else
  if ! docker compose version >/dev/null 2>&1; then
    log "docker compose plugin not available."
    exit 1
  fi
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  log "Working tree has local changes. Skipping auto-update to avoid merge conflicts."
  exit 0
fi

log "Fetching ${REMOTE}/${BRANCH}..."
git fetch --prune "${REMOTE}" "${BRANCH}"

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "${REMOTE}/${BRANCH}")"

if [[ "${LOCAL_SHA}" == "${REMOTE_SHA}" ]]; then
  log "No updates available."
  exit 0
fi

log "Updating ${LOCAL_SHA:0:7} -> ${REMOTE_SHA:0:7}"
git pull --ff-only "${REMOTE}" "${BRANCH}"

log "Rebuilding and restarting containers..."
compose up -d --build --remove-orphans

if docker ps --format "{{.Names}}" | grep -Fxq "${CONTAINER_NAME}"; then
  HEALTH_STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${CONTAINER_NAME}" 2>/dev/null || echo "unknown")"
  log "Container '${CONTAINER_NAME}' health: ${HEALTH_STATUS}"
else
  log "Container '${CONTAINER_NAME}' not found after deploy."
fi

if [[ "${PRUNE_IMAGES:-0}" == "1" ]]; then
  log "Pruning dangling images..."
  docker image prune -f >/dev/null || true
fi

log "Auto-update completed."
