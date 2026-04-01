#!/usr/bin/env bash
# Stop the Angular dev server using the PID tracked in data/angular-dev.pid.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PIDFILE="data/angular-dev.pid"

if [ ! -f "$PIDFILE" ]; then
    echo "Angular dev server is not running (no PID file)."
    exit 0
fi

PID=$(cat "$PIDFILE" 2>/dev/null)

if [ -z "$PID" ]; then
    echo "PID file is empty. Removing."
    rm -f "$PIDFILE"
    exit 0
fi

if ! kill -0 "$PID" 2>/dev/null; then
    echo "Angular dev server process $PID is not running. Cleaning up PID file."
    rm -f "$PIDFILE"
    exit 0
fi

echo "Stopping Angular dev server (PID $PID)..."

case "$OSTYPE" in
    msys*|cygwin*|win32*)
        taskkill //PID "$PID" //T //F > /dev/null 2>&1 || true
        ;;
    *)
        kill "$PID" 2>/dev/null || true
        sleep 1
        if kill -0 "$PID" 2>/dev/null; then
            kill -9 "$PID" 2>/dev/null || true
        fi
        ;;
esac

rm -f "$PIDFILE"
echo "Angular dev server stopped."
