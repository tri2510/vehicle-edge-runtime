#!/bin/bash
# Add additional Vehicle Edge Runtime instances

set -euo pipefail

INSTANCE_NAME="runtime-$(date +%s)"
INSTANCE_PORT="4002"
INSTANCE_HEALTH_PORT="4003"
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
    echo "Start Kit Manager first"
    exit 1
fi

# Get current port to avoid conflicts
if docker ps --format '{{.Ports}}' | grep -q ":4002-" 2>/dev/null; then
    INSTANCE_PORT="5002"
    INSTANCE_HEALTH_PORT="5003"
fi

print_status INFO "Adding runtime instance: $INSTANCE_NAME"
echo "Ports: $INSTANCE_PORT (WebSocket), $INSTANCE_HEALTH_PORT (Health)"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

# Build image if needed
if ! docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "vehicle-edge-runtime:sim"; then
    print_status INFO "Building runtime image..."
    docker build -f "$WORKSPACE_DIR/Dockerfile.runtime" -t vehicle-edge-runtime:sim "$WORKSPACE_DIR"
fi

# Create data directory
DATA_DIR="$WORKSPACE_DIR/data-$INSTANCE_NAME"
mkdir -p "$DATA_DIR"/{applications,logs,configs}

# Start container
print_status INFO "Starting runtime container..."
docker run -d \
    --name "$INSTANCE_NAME" \
    --network "$NETWORK_NAME" \
    -p "$INSTANCE_PORT:4002" \
    -p "$INSTANCE_HEALTH_PORT:4003" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$DATA_DIR:/app/data" \
    -e KIT_MANAGER_URL=ws://kit-manager-standalone:3090 \
    -e PORT=4002 \
    -e LOG_LEVEL=info \
    -e DATA_PATH=/app/data \
    -e SKIP_KUKSA=true \
    --user root \
    vehicle-edge-runtime:sim

# Wait for startup
sleep 8

# Check if running
if docker ps --format '{{.Names}}' | grep -q "^$INSTANCE_NAME$"; then
    print_status OK "Runtime instance started successfully"

    # Test health endpoint
    for i in {1..10}; do
        if curl -s "http://localhost:$INSTANCE_HEALTH_PORT/health" >/dev/null 2>&1; then
            print_status OK "Health endpoint responding"
            break
        fi
        sleep 1
    done

    # Check registration
    KITS_RESPONSE=$(curl -s http://localhost:3090/listAllKits 2>/dev/null)
    KIT_COUNT=$(echo "$KITS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")
    print_status INFO "Total kits registered: $KIT_COUNT"

    echo ""
    echo "Instance details:"
    echo "  Name: $INSTANCE_NAME"
    echo "  WebSocket: ws://localhost:$INSTANCE_PORT/runtime"
    echo "  Health: http://localhost:$INSTANCE_HEALTH_PORT/health"
    echo "  Data: $DATA_DIR"
    echo ""
    echo "Management commands:"
    echo "  View logs: docker logs $INSTANCE_NAME -f"
    echo "  Stop instance: docker stop $INSTANCE_NAME && docker rm $INSTANCE_NAME"
else
    print_status ERROR "Failed to start runtime instance"
    docker logs "$INSTANCE_NAME" 2>&1 | tail -10
    exit 1
fi