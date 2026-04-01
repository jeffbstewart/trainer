#!/bin/bash
# Builds the Kotlin backend and Angular frontend locally.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=== Building Kotlin backend ==="
./gradlew build

echo ""
echo "=== Building Angular frontend ==="
cd web-app
npm ci --silent
MSYS_NO_PATHCONV=1 npx ng build --base-href="/app/"
cd ..

echo ""
echo "Done! Backend: build/libs/   Frontend: web-app/dist/"
