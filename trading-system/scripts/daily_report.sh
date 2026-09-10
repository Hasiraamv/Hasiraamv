#!/usr/bin/env bash
# Runs the Qwen daily report agent and archives its output.
# Intended to be called from cron/systemd — see README.md "Daily Qwen report"
# for setup. Advisory only: this never places an order or changes config;
# it only prints a report and any proposals awaiting human approval.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if [ -f ".venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

REPORT_DIR="${SCRIPT_DIR}/logs/reports"
mkdir -p "$REPORT_DIR"

DATE_STAMP="$(date -u +%F)"
REPORT_FILE="${REPORT_DIR}/${DATE_STAMP}.md"

{
  echo "# Daily Report — ${DATE_STAMP}"
  echo
  python -m app agent --task "daily report"
} > "$REPORT_FILE" 2>&1
AGENT_EXIT=$?

echo "Report written to ${REPORT_FILE}"
if [ "$AGENT_EXIT" -ne 0 ]; then
  echo "WARNING: agent exited with code ${AGENT_EXIT} — see ${REPORT_FILE} for details" >&2
fi
exit "$AGENT_EXIT"
