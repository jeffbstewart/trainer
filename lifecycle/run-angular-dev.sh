#!/usr/bin/env bash
# Start the Angular dev server with API proxy to the local Kotlin server.
# PID is tracked in data/angular-dev.pid for clean shutdown.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PIDFILE="data/angular-dev.pid"

# Check if already running
if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE" 2>/dev/null)
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Angular dev server is already running (PID $OLD_PID)."
        echo "Run lifecycle/stop-angular-dev.sh first."
        exit 1
    fi
    rm -f "$PIDFILE"
fi

mkdir -p data

echo "Starting Angular dev server (http://localhost:4200)..."
echo "  API proxy: localhost:9090"
cd web-app
npx ng serve &
NG_PID=$!
cd ..
echo "$NG_PID" > "$PIDFILE"
echo "Angular dev server started (PID $NG_PID)."
echo "  Stop: lifecycle/stop-angular-dev.sh"
