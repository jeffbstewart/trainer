#!/usr/bin/env bash
# Start the Kotlin dev server in the background.
# Uses installDist for a clean build, then runs the app binary.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

LOGFILE="data/server.log"

# Source secrets
if [ -f "secrets/.env" ]; then
    while IFS='=' read -r key value; do
        key="${key//$'\r'/}"
        value="${value//$'\r'/}"
        [[ -z "$key" || "$key" =~ ^# ]] && continue
        export "$key"="$value"
    done < "secrets/.env"
fi

# Ensure data directory exists; clear stale log
mkdir -p data
rm -f "$LOGFILE"

# Build
echo "Building..."
./gradlew --no-daemon installDist > /dev/null 2>&1

# Run
echo "Starting server (logs: $LOGFILE)..."
build/install/trainer/bin/trainer "$@" > "$LOGFILE" 2>&1 &
echo "Server started."
echo "  Logs:  tail -f $LOGFILE"
echo "  Stop:  lifecycle/stop-server.sh"
