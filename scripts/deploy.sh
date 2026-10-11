#!/bin/bash
# Runs ON THE APP SERVER (Jenkins triggers it through AWS Systems Manager).
# Pulls an image from ECR, replaces the running container, checks health,
# and rolls back to the previous image if the new one is unhealthy.
#
# Usage: /opt/cicd-app/deploy.sh <full-image-uri>
set -euo pipefail

IMAGE="${1:?Usage: deploy.sh <full-image-uri>}"
APP_NAME="cicd-app"
STATE_DIR="/opt/cicd-app"
DATA_DIR="$STATE_DIR/data"
HEALTH_URL="http://127.0.0.1/health"

REGISTRY="${IMAGE%%/*}"
REGION="$(echo "$REGISTRY" | cut -d. -f4)"

start_container() {
  local image="$1"
  docker rm -f "$APP_NAME" >/dev/null 2>&1 || true
  docker run -d \
    --name "$APP_NAME" \
    --restart unless-stopped \
    --init \
    --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=16m \
    --cap-drop ALL \
    --security-opt no-new-privileges:true \
    --pids-limit 100 \
    -p 80:3000 \
    -v "$DATA_DIR:/data" \
    "$image" >/dev/null
}

wait_until_healthy() {
  for _ in $(seq 1 20); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

mkdir -p "$DATA_DIR"
chown -R 1000:1000 "$DATA_DIR"

echo "==> Logging in to ECR ($REGION)"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

echo "==> Pulling $IMAGE"
docker pull "$IMAGE"

PREVIOUS=""
if [ -f "$STATE_DIR/current_image" ]; then
  PREVIOUS="$(cat "$STATE_DIR/current_image")"
fi

echo "==> Starting new container"
start_container "$IMAGE"

if wait_until_healthy; then
  echo "$IMAGE" > "$STATE_DIR/current_image"
  if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$IMAGE" ]; then
    echo "$PREVIOUS" > "$STATE_DIR/previous_image"
  fi
  echo "==> Deploy succeeded: $IMAGE"
  docker image prune -f >/dev/null 2>&1 || true
  exit 0
fi

echo "==> Health check FAILED for $IMAGE"
docker logs --tail 30 "$APP_NAME" || true

if [ -n "$PREVIOUS" ]; then
  echo "==> Rolling back to $PREVIOUS"
  start_container "$PREVIOUS"
  if wait_until_healthy; then
    echo "==> Rollback succeeded. The old version is live again."
  else
    echo "==> Rollback ALSO failed. Manual action needed."
  fi
else
  echo "==> No previous version to roll back to."
  docker rm -f "$APP_NAME" >/dev/null 2>&1 || true
fi
exit 1
