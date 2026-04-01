#!/usr/bin/env bash
# Stop the Angular dev server by finding and killing its Node process.

case "$OSTYPE" in
    msys*|cygwin*|win32*)
        PIDS=$(wmic process where "name='node.exe'" get ProcessId,CommandLine 2>/dev/null \
            | grep -i "ng.*serve\|angular.*dev-server\|vite" \
            | awk '{print $NF}' \
            | tr -d '\r')

        if [ -z "$PIDS" ]; then
            echo "Angular dev server is not running."
            exit 0
        fi

        for PID in $PIDS; do
            echo "Stopping Angular dev server (PID $PID)..."
            taskkill //PID "$PID" //F > /dev/null 2>&1
        done
        ;;
    *)
        PIDS=$(pgrep -f "ng serve" 2>/dev/null)

        if [ -z "$PIDS" ]; then
            echo "Angular dev server is not running."
            exit 0
        fi

        for PID in $PIDS; do
            echo "Stopping Angular dev server (PID $PID)..."
            kill "$PID" 2>/dev/null
        done
        ;;
esac

echo "Angular dev server stopped."
