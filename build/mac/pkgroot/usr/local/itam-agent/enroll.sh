#!/bin/bash
set -euo pipefail

# Where your dev server is running
ENROLL_URL="${ENROLL_URL:-http://localhost:5050/api/agent/enroll}"

# --- Collect facts (built-in macOS commands) ---
HOSTNAME="$(scutil --get LocalHostName 2>/dev/null || hostname)"
USER_NAME="$(stat -f%Su /dev/console 2>/dev/null || whoami)"

# Serial number
SERIAL="$(system_profiler SPHardwareDataType 2>/dev/null | awk -F': ' '/Serial Number/{print $2; exit}')"

# Model identifier
MODEL_ID="$(sysctl -n hw.model 2>/dev/null || true)"

# OS name and version
OS_NAME="macOS"
OS_VERSION="$(sw_vers -productVersion 2>/dev/null || true)"

# Primary IPv4 if available
PRIMARY_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

# Uptime seconds
UPTIME_S="$(sysctl -n kern.boottime 2>/dev/null | awk -F'[{}, ]+' '{print systime()-$5}' 2>/dev/null || awk '{print $1}' /proc/uptime 2>/dev/null || echo 0)"

# Build JSON payload (no external deps)
PAYLOAD=$(cat <<JSON
{
  "hostname": "$HOSTNAME",
  "serial": "$SERIAL",
  "os": { "name": "$OS_NAME", "version": "$OS_VERSION" },
  "username": "$USER_NAME",
  "ips": ["$PRIMARY_IP"],
  "uptimeSeconds": $UPTIME_S
}
JSON
)

# --- POST to backend ---
/usr/bin/curl -sS -X POST "$ENROLL_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -o /tmp/itam-enroll-result.json || true

# Optional: write a local log for troubleshooting
{
  echo "[$(date -u +%FT%TZ)] POST $ENROLL_URL"
  echo "$PAYLOAD"
  echo "---- response ----"
  cat /tmp/itam-enroll-result.json
  echo
} >> /usr/local/itam-agent/enroll.log 2>&1

exit 0
