#!/bin/bash
# Install Vehicle Edge Runtime inside running pi-ci container

set -euo pipefail

CONTAINER="vehicle-edge-pi"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    echo "Container $CONTAINER is not running"
    echo "Start it first: ./0-start-pi-ci.sh"
    exit 1
fi

echo "Installing Vehicle Edge Runtime in pi-ci container..."

# Install Node.js and dependencies
docker exec "$CONTAINER" apt-get update
docker exec "$CONTAINER" apt-get install -y curl git python3

# Install Node.js 18
docker exec "$CONTAINER" curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
docker exec "$CONTAINER" apt-get install -y nodejs

# Copy and setup runtime
docker exec "$CONTAINER" cp -r /workspace /home/pi/vehicle-edge-runtime
docker exec "$CONTAINER" chown -R 1000:1000 /home/pi/vehicle-edge-runtime

# Install dependencies
docker exec "$CONTAINER" bash -c "cd /home/pi/vehicle-edge-runtime && npm install"

# Create environment
docker exec "$CONTAINER" bash -c "cd /home/pi/vehicle-edge-runtime && cp .env.example .env 2>/dev/null || echo 'PORT=3002' > .env"

echo "Installation complete!"
echo "Start runtime: docker exec -it $CONTAINER bash -c 'cd /home/pi/vehicle-edge-runtime && npm start'"