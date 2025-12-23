#!/bin/bash
# Start Kit Manager on host

set -euo pipefail

CONTAINER="kit-manager"

print_status() {
    local status=$1
    local msg=$2
    case $status in
        OK) echo -e "\033[0;32m✅ $msg\033[0m" ;;
        WARN) echo -e "\033[1;33m⚠️  $msg\033[0m" ;;
        ERROR) echo -e "\033[0;31m❌ $msg\033[0m" ;;
    esac
}

# Stop existing Kit Manager
if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    print_status WARN "Kit Manager already running, stopping..."
    docker stop "$CONTAINER" >/dev/null
    docker rm "$CONTAINER" >/dev/null
fi

echo "Starting Kit Manager..."

# Start Kit Manager
docker run -d \
    --name "$CONTAINER" \
    --network vehicle-edge-network \
    -p 3090:3090 \
    kit-manager:sim

# Wait for startup
sleep 5

# Check if running
if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    print_status OK "Kit Manager started successfully"

    # Test API
    for i in {1..10}; do
        if curl -s http://localhost:3090/listAllKits >/dev/null 2>&1; then
            print_status OK "Kit Manager API responding"
            break
        fi
        sleep 1
    done

    echo "Kit Manager API: http://localhost:3090/listAllKits"
else
    print_status ERROR "Failed to start Kit Manager"
    docker logs "$CONTAINER" 2>&1 | tail -10
    exit 1
fi