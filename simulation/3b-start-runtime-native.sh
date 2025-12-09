#!/bin/bash
# Start Vehicle Edge Runtime native process inside simulation container

set -euo pipefail

CONTAINER="vehicle-edge-pi"

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

# Connect container to Kit Manager network
docker network connect vehicle-edge-network "$CONTAINER" 2>/dev/null || true

# Stop existing native processes
if docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js'" >/dev/null 2>&1; then
    print_status WARN "Runtime already running, stopping..."
    docker exec "$CONTAINER" bash -c "pkill -f 'node src/index.js'" 2>/dev/null || true
    sleep 2
fi

echo "Starting Vehicle Edge Runtime native inside $CONTAINER..."

# Create data directory
docker exec "$CONTAINER" bash -c "
    mkdir -p /home/pi/vehicle-edge-runtime/workspace/data/{applications,logs,configs}
    chown -R pi:pi /home/pi/vehicle-edge-runtime/workspace/data
"

# Start native process
print_status INFO "Starting native runtime process..."
docker exec -d "$CONTAINER" bash -c "
    cd /home/pi/vehicle-edge-runtime/workspace
    export KIT_MANAGER_URL=ws://kit-manager-standalone:3090
    export PORT=3002
    export LOG_LEVEL=info
    export DATA_PATH=/home/pi/vehicle-edge-runtime/workspace/data
    export SKIP_KUKSA=true
    npm start
"

# Wait for startup
sleep 8

# Check if running
if docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js'" >/dev/null 2>&1; then
    print_status OK "Runtime started successfully"

    # Get process info
    PID=$(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js'")
    print_status INFO "Runtime process PID: $PID"

    # Test health endpoint
    for i in {1..10}; do
        if docker exec "$CONTAINER" timeout 3 bash -c 'echo >/dev/tcp/localhost/3003' 2>/dev/null; then
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
    docker exec "$CONTAINER" bash -c "npm test 2>&1 | tail -10" || echo "No test output"
    exit 1
fi