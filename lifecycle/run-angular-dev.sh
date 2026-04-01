#!/usr/bin/env bash
# Start the Angular dev server with API proxy.
# Default target: http://localhost:9090 (local backend).
# Override: set TRAINER_API_TARGET env var.
#
# Examples:
#   lifecycle/run-angular-dev.sh                          # local backend
#   TRAINER_API_TARGET=https://trainer.example.com:8443 lifecycle/run-angular-dev.sh  # remote
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

export TRAINER_API_TARGET="${TRAINER_API_TARGET:-http://localhost:9090}"
echo "Angular dev server proxying API to: $TRAINER_API_TARGET"

cd web-app
npx ng serve --proxy-config proxy.conf.js
