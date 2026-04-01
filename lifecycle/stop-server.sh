#!/usr/bin/env bash
# Stop the Kotlin dev server using the PID tracked in data/server.pid.
# Does NOT use killall — only kills the specific process we started.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PIDFILE="data/server.pid"

if [ ! -f "$PIDFILE" ]; then
    echo "Server is not running (no PID file)."
    exit 0
fi

PID=$(cat "$PIDFILE" 2>/dev/null)

if [ -z "$PID" ]; then
    echo "PID file is empty. Removing."
    rm -f "$PIDFILE"
    exit 0
fi

if ! kill -0 "$PID" 2>/dev/null; then
    echo "Server process $PID is not running. Cleaning up PID file."
    rm -f "$PIDFILE"
    exit 0
fi

echo "Stopping server (PID $PID)..."

# On Windows (Git Bash/MSYS), use taskkill to kill the process tree.
# On Unix, send SIGTERM then SIGKILL if needed.
case "$OSTYPE" in
    msys*|cygwin*|win32*)
        # Kill the Gradle wrapper and its child Java process
        taskkill //PID "$PID" //T //F > /dev/null 2>&1 || true
        ;;
    *)
        kill "$PID" 2>/dev/null || true
        # Wait up to 5 seconds for graceful shutdown
        for _ in $(seq 1 10); do
            if ! kill -0 "$PID" 2>/dev/null; then break; fi
            sleep 0.5
        done
        # Force kill if still running
        if kill -0 "$PID" 2>/dev/null; then
            echo "Force killing PID $PID..."
            kill -9 "$PID" 2>/dev/null || true
        fi
        ;;
esac

rm -f "$PIDFILE"
echo "Server stopped."
