#!/bin/bash
# Start pi-ci container with Vehicle Edge Runtime

set -euo pipefail

CONTAINER="vehicle-edge-pi"
IMAGE="ptrsr/pi-ci"
REPO_DIR="$(dirname "$(pwd)")"

# Clean up existing container
docker rm -f "$CONTAINER" 2>/dev/null || true

# Create required directories
mkdir -p pi-dist

# Initialize pi-ci first
docker run --rm \
    -v "$(pwd)/pi-dist:/dist" \
    "$IMAGE" \
    init -v

# Start container with pi-ci runtime
docker run -d \
    --name "$CONTAINER" \
    -v "$REPO_DIR:/workspace:ro" \
    -v "$(pwd)/pi-dist:/dist" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    "$IMAGE" \
    start -v

echo "pi-ci container started: $CONTAINER"
echo "Attach with: docker exec -it $CONTAINER bash"