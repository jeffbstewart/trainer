#!/usr/bin/env bash
# Start the Kotlin dev server in the background.
# PID is tracked in data/server.pid for clean shutdown via stop-server.sh.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PIDFILE="data/server.pid"
LOGFILE="data/server.log"

# Check if already running
if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE" 2>/dev/null)
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Server is already running (PID $OLD_PID)."
        echo "Run lifecycle/stop-server.sh first."
        exit 1
    fi
    rm -f "$PIDFILE"
fi

# Ensure data directory exists
mkdir -p data

# Source secrets
if [ -f "secrets/.env" ]; then
    while IFS='=' read -r key value; do
        key="${key//$'\r'/}"
        value="${value//$'\r'/}"
        [[ -z "$key" || "$key" =~ ^# ]] && continue
        export "$key"="$value"
    done < "secrets/.env"
fi

echo "Starting server (logs: $LOGFILE)..."
./gradlew --no-daemon run > "$LOGFILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PIDFILE"
echo "Server started (PID $SERVER_PID)."
echo "  Logs:  tail -f $LOGFILE"
echo "  Stop:  lifecycle/stop-server.sh"
