#!/bin/bash
# Start pi-ci container with Vehicle Edge Runtime (persistent)

set -euo pipefail

CONTAINER="vehicle-edge-pi"
IMAGE="ptrsr/pi-ci"
REPO_DIR="$(dirname "$(pwd)")"

# Check if container already exists and running
if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    echo "✅ Container $CONTAINER already running"
    echo "Attach with: docker exec -it $CONTAINER bash"
    exit 0
fi

# If container exists but stopped, restart it
if docker ps -a --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    echo "🔄 Restarting existing container..."
    docker start "$CONTAINER"
    echo "✅ Container restarted: $CONTAINER"
    echo "Attach with: docker exec -it $CONTAINER bash"
    exit 0
fi

# Create new container
mkdir -p pi-dist

docker run --rm \
    -v "$(pwd)/pi-dist:/dist" \
    "$IMAGE" \
    init -v

docker run -d \
    --name "$CONTAINER" \
    -v "$REPO_DIR:/workspace:ro" \
    -v "$(pwd)/pi-dist:/dist" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    "$IMAGE" \
    start -v

echo "✅ Container started: $CONTAINER"
echo "Attach with: docker exec -it $CONTAINER bash"