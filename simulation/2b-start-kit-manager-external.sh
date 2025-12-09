#!/bin/bash
# Start Kit Manager Docker container outside simulation container

set -euo pipefail

KIT_MANAGER_CONTAINER="kit-manager-standalone"
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

# Stop existing container
if docker ps --format '{{.Names}}' | grep -q "^$KIT_MANAGER_CONTAINER$"; then
    print_status WARN "Kit Manager already running, stopping..."
    docker stop "$KIT_MANAGER_CONTAINER" 2>/dev/null || true
    docker rm "$KIT_MANAGER_CONTAINER" 2>/dev/null || true
fi

# Create network
docker network create "$NETWORK_NAME" 2>/dev/null || print_status INFO "Network already exists"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting Kit Manager outside container..."

# Build image
print_status INFO "Building Kit Manager image..."
docker build -t kit-manager:sim "$WORKSPACE_DIR/Kit-Manager"

# Start container
print_status INFO "Starting Kit Manager container..."
docker run -d \
    --name "$KIT_MANAGER_CONTAINER" \
    --network "$NETWORK_NAME" \
    -p 3090:3090 \
    kit-manager:sim

# Wait for startup
sleep 5

# Check if running
if docker ps --format '{{.Names}}' | grep -q "^$KIT_MANAGER_CONTAINER$"; then
    print_status OK "Kit Manager started successfully"

    # Test API
    for i in {1..10}; do
        if curl -s http://localhost:3090/listAllKits >/dev/null 2>&1; then
            print_status OK "Kit Manager API responding"
            break
        fi
        sleep 1
    done

    echo "Kit Manager available at: http://localhost:3090"
    echo "Container: $KIT_MANAGER_CONTAINER"
else
    print_status ERROR "Failed to start Kit Manager"
    docker logs "$KIT_MANAGER_CONTAINER" 2>&1 | tail -10
    exit 1
fi