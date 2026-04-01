#!/bin/bash
# Builds the Docker image, pushes to registry, and triggers Watchtower redeploy.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# Load deployment config
DEPLOY_ENV="secrets/deploy.agent_visible_env"
if [ ! -f "$DEPLOY_ENV" ]; then
    echo "ERROR: $DEPLOY_ENV not found. Copy from secrets/example.deploy.env and fill in values."
    exit 1
fi
while IFS='=' read -r key value; do
    key="${key//$'\r'/}"
    value="${value//$'\r'/}"
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    export "$key"="$value"
done < "$DEPLOY_ENV"

for var in REGISTRY NAS_IP WATCHTOWER_PORT WATCHTOWER_TOKEN; do
    if [ -z "${!var:-}" ]; then
        echo "ERROR: $var not set in $DEPLOY_ENV"
        exit 1
    fi
done

IMAGE_NAME="trainer"
FULL_NAME="${REGISTRY}/${IMAGE_NAME}"
TIMESTAMP=$(date +"%Y%m%d%H%M")

echo "=== Building Angular frontend ==="
cd web-app
npm ci --silent
MSYS_NO_PATHCONV=1 npx ng build --base-href="/app/"
cd ..

echo ""
echo "=== Building Kotlin backend ==="
./gradlew --no-daemon installDist

echo ""
echo "=== Building Docker image ==="
docker build -f Dockerfile.prebuilt -t "${FULL_NAME}:${TIMESTAMP}" -t "${FULL_NAME}:latest" .

echo ""
echo "=== Pushing to registry ==="
docker push "${FULL_NAME}:${TIMESTAMP}"
docker push "${FULL_NAME}:latest"

echo ""
echo "Done! Pushed:"
echo "  ${FULL_NAME}:${TIMESTAMP}"
echo "  ${FULL_NAME}:latest"

echo ""
echo "Triggering Watchtower redeploy..."
curl -s -H "Authorization: Bearer ${WATCHTOWER_TOKEN}" \
    "http://${NAS_IP}:${WATCHTOWER_PORT}/v1/update" > /dev/null 2>&1 \
    && echo "Watchtower accepted the update request. Container will restart shortly." \
    || echo "WARNING: Watchtower request failed. Container may need manual restart."

echo ""
echo "To rollback: docker pull ${FULL_NAME}:rollback && docker tag ${FULL_NAME}:rollback ${FULL_NAME}:latest"
