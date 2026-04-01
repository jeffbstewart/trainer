#!/bin/bash
# Builds the Docker image locally.
# Later: push to registry and trigger Watchtower redeploy.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

IMAGE_NAME="trainer"
TIMESTAMP=$(date +"%Y%m%d%H%M")

echo "=== Building Angular frontend ==="
cd web-app
npm ci --silent
npx ng build --base-href="/app/"
cd ..

echo ""
echo "=== Building Kotlin backend ==="
./gradlew --no-daemon installDist

echo ""
echo "=== Building Docker image ==="
# Build without the composite-build toolkit deps in the Dockerfile.
# Instead, pre-build the installDist and use a simpler runtime-only image.
docker build -f Dockerfile.prebuilt -t "${IMAGE_NAME}:${TIMESTAMP}" -t "${IMAGE_NAME}:latest" .

echo ""
echo "Done! Tagged:"
echo "  ${IMAGE_NAME}:${TIMESTAMP}"
echo "  ${IMAGE_NAME}:latest"
