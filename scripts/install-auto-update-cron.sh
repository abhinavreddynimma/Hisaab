#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

INTERVAL="${INTERVAL:-*/10 * * * *}"
LOG_FILE="${LOG_FILE:-${REPO_DIR}/data/auto-update.log}"
MARKER="# hisaab-auto-update"

mkdir -p "$(dirname "${LOG_FILE}")"

REPO_ESCAPED="$(printf '%q' "${REPO_DIR}")"
SCRIPT_ESCAPED="$(printf '%q' "${REPO_DIR}/scripts/auto-update.sh")"
LOG_ESCAPED="$(printf '%q' "${LOG_FILE}")"

CRON_LINE="${INTERVAL} cd ${REPO_ESCAPED} && /usr/bin/env bash ${SCRIPT_ESCAPED} >> ${LOG_ESCAPED} 2>&1 ${MARKER}"

CURRENT_CRONTAB="$(mktemp)"
trap 'rm -f "${CURRENT_CRONTAB}"' EXIT

crontab -l 2>/dev/null | grep -v "${MARKER}" > "${CURRENT_CRONTAB}" || true
printf "%s\n" "${CRON_LINE}" >> "${CURRENT_CRONTAB}"
crontab "${CURRENT_CRONTAB}"

printf "Installed auto-update cron job:\n%s\n" "${CRON_LINE}"
