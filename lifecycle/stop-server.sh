#!/usr/bin/env bash
# Stop the Trainer dev server by finding and killing its Java process.
# Uses process scanning (not PID files) — same pattern as MediaManager.

case "$OSTYPE" in
    msys*|cygwin*|win32*)
        PIDS=$(wmic process where "name='java.exe'" get ProcessId,CommandLine 2>/dev/null \
            | grep "net.stewart.trainer.MainKt" \
            | awk '{print $NF}' \
            | tr -d '\r')

        if [ -z "$PIDS" ]; then
            echo "Server is not running."
            exit 0
        fi

        for PID in $PIDS; do
            echo "Stopping server (PID $PID)..."
            taskkill //PID "$PID" //F > /dev/null 2>&1
        done
        ;;
    *)
        PIDS=$(pgrep -f "net.stewart.trainer.MainKt" 2>/dev/null)

        if [ -z "$PIDS" ]; then
            echo "Server is not running."
            exit 0
        fi

        for PID in $PIDS; do
            echo "Stopping server (PID $PID)..."
            kill "$PID" 2>/dev/null
        done

        sleep 2
        for PID in $PIDS; do
            if kill -0 "$PID" 2>/dev/null; then
                echo "Force killing PID $PID..."
                kill -9 "$PID" 2>/dev/null
            fi
        done
        ;;
esac

echo "Server stopped."
