#!/bin/bash
# Start Vehicle Edge Runtime Docker container inside simulation container

set -euo pipefail

CONTAINER="vehicle-edge-pi"
RUNTIME_CONTAINER="vehicle-edge-runtime"

print_status() {
    local status=$1
    local msg=$2
    case $status in
        OK) echo -e "\033[0;32m✅ $msg\033[0m" ;;
        WARN) echo -e "\033[1;33m⚠️  $msg\033[0m" ;;
        ERROR) echo -e "\033[0;31m❌ $msg\033[0m" ;;
    esac
}

# Check prerequisites
if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    print_status ERROR "Container $CONTAINER not running"
    echo "Start with: ./0-start-pi-ci.sh"
    exit 1
fi

if ! docker exec "$CONTAINER" test -f /home/pi/vehicle-edge-runtime/workspace/package.json; then
    print_status ERROR "Runtime not installed"
    echo "Install with: ./1a-install-runtime-simulated.sh"
    exit 1
fi

# Check if Kit Manager is accessible
if ! curl -s http://localhost:3090/listAllKits >/dev/null 2>&1; then
    print_status ERROR "Kit Manager not accessible"
    echo "Start Kit Manager first with: ./2a-start-kit-manager-internal.sh or ./2b-start-kit-manager-external.sh"
    exit 1
fi

# Stop existing runtime
if docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -q '$RUNTIME_CONTAINER'" 2>/dev/null; then
    print_status WARN "Runtime already running, stopping..."
    docker exec "$CONTAINER" docker stop "$RUNTIME_CONTAINER" 2>/dev/null || true
    docker exec "$CONTAINER" docker rm "$RUNTIME_CONTAINER" 2>/dev/null || true
fi

echo "Starting Vehicle Edge Runtime Docker inside $CONTAINER..."

# Build runtime image
print_status INFO "Building runtime image..."
docker exec "$CONTAINER" bash -c "
    cd /home/pi/vehicle-edge-runtime/workspace
    docker build -f Dockerfile.runtime -t vehicle-edge-runtime:sim .
"

# Create data directory
docker exec "$CONTAINER" bash -c "
    mkdir -p /home/pi/vehicle-edge-runtime/workspace/data
    chown -R 1001:1001 /home/pi/vehicle-edge-runtime/workspace/data
"

# Start runtime
print_status INFO "Starting runtime container..."
docker exec "$CONTAINER" docker run -d \
    --name "$RUNTIME_CONTAINER" \
    --network bridge \
    -p 3002:3002 \
    -p 3003:3003 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v /home/pi/vehicle-edge-runtime/workspace/data:/app/data \
    -e KIT_MANAGER_URL=ws://kit-manager:3090 \
    -e PORT=3002 \
    -e LOG_LEVEL=info \
    -e DATA_PATH=/app/data \
    -e SKIP_KUKSA=true \
    --user root \
    vehicle-edge-runtime:sim

# Wait for startup
sleep 8

# Check if running
if docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -q '$RUNTIME_CONTAINER'"; then
    print_status OK "Runtime started successfully"

    # Test health endpoint
    for i in {1..10}; do
        if curl -s http://localhost:3003/health >/dev/null 2>&1; then
            print_status OK "Runtime health endpoint responding"
            break
        fi
        sleep 1
    done

    echo "Runtime WebSocket: ws://localhost:3002/runtime"
    echo "Runtime Health: http://localhost:3003/health"

    # Check registration
    KITS_RESPONSE=$(curl -s http://localhost:3090/listAllKits 2>/dev/null)
    KIT_COUNT=$(echo "$KITS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")
    print_status INFO "Kits registered with Kit Manager: $KIT_COUNT"
else
    print_status ERROR "Failed to start runtime"
    docker exec "$CONTAINER" docker logs "$RUNTIME_CONTAINER" 2>&1 | tail -10
    exit 1
fi