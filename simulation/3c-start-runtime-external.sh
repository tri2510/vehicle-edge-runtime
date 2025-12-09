#!/bin/bash
# Start Vehicle Edge Runtime Docker container outside simulation container

set -euo pipefail

RUNTIME_CONTAINER="vehicle-edge-runtime"
NETWORK_NAME="vehicle-edge-network"

print_status() {
    local status=$1
    local msg=$2
    case $status in
        OK) echo -e "\033[0;32m✅ $msg\033[0m" ;;
        WARN) echo -e "\033[1;33m⚠️  $msg\033[0m" ;;
        ERROR) echo -e "\033[0;31m❌ $msg\033[0m" ;;
    esac
}

# Check if Kit Manager is accessible
if ! curl -s http://localhost:3090/listAllKits >/dev/null 2>&1; then
    print_status ERROR "Kit Manager not accessible"
    echo "Start Kit Manager first with: ./2b-start-kit-manager-external.sh"
    exit 1
fi

# Stop existing runtime
if docker ps --format '{{.Names}}' | grep -q "^$RUNTIME_CONTAINER$"; then
    print_status WARN "Runtime already running, stopping..."
    docker stop "$RUNTIME_CONTAINER" 2>/dev/null || true
    docker rm "$RUNTIME_CONTAINER" 2>/dev/null || true
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting Vehicle Edge Runtime Docker outside container..."

# Build image
print_status INFO "Building runtime image..."
docker build -f "$WORKSPACE_DIR/Dockerfile.runtime" -t vehicle-edge-runtime:sim "$WORKSPACE_DIR"

# Create data directory
DATA_DIR="$WORKSPACE_DIR/data-runtime"
mkdir -p "$DATA_DIR"/{applications,logs,configs}

# Start container
print_status INFO "Starting runtime container..."
docker run -d \
    --name "$RUNTIME_CONTAINER" \
    --network "$NETWORK_NAME" \
    -p 3002:3002 \
    -p 3003:3003 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$DATA_DIR:/app/data" \
    -e KIT_MANAGER_URL=ws://kit-manager-standalone:3090 \
    -e PORT=3002 \
    -e LOG_LEVEL=info \
    -e DATA_PATH=/app/data \
    -e SKIP_KUKSA=true \
    --user root \
    vehicle-edge-runtime:sim

# Wait for startup
sleep 8

# Check if running
if docker ps --format '{{.Names}}' | grep -q "^$RUNTIME_CONTAINER$"; then
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
    echo "Data directory: $DATA_DIR"

    # Check registration
    KITS_RESPONSE=$(curl -s http://localhost:3090/listAllKits 2>/dev/null)
    KIT_COUNT=$(echo "$KITS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")
    print_status INFO "Kits registered with Kit Manager: $KIT_COUNT"
else
    print_status ERROR "Failed to start runtime"
    docker logs "$RUNTIME_CONTAINER" 2>&1 | tail -10
    exit 1
fi