#!/bin/bash
# Start Vehicle Edge Runtime on host (supports multiple instances)

set -euo pipefail

BASE_NAME="vehicle-edge-runtime"

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
    echo "Start Kit Manager first: ./1-start-kit-manager.sh"
    exit 1
fi

# Generate unique letter ID based on time
generate_letter_id() {
    local timestamp=$(date +%s)
    local letters="abcdefghijklmnopqrstuvwxyz"
    local id=""
    local temp=$timestamp

    # Convert timestamp to letters (base-26)
    while [[ $temp -gt 0 ]]; do
        local index=$((temp % 26))
        id="${letters:$index:1}$id"
        temp=$((temp / 26))
    done

    # If result is too long, use last 3 chars
    if [[ ${#id} -gt 3 ]]; then
        id="${id: -3}"
    fi

    # Ensure ID doesn't conflict
    while docker ps -a --format '{{.Names}}' | grep -q "^${BASE_NAME}${id}$"; do
        # Add random letter if conflict
        local random_index=$((RANDOM % 26))
        id="${id}${letters:$random_index:1}"
    done

    echo "$id"
}

INSTANCE_ID=$(generate_letter_id)
CONTAINER="${BASE_NAME}${INSTANCE_ID}"

# Find available ports
find_available_port() {
    local base_port=$1
    local port=$base_port
    while netstat -tlnp 2>/dev/null | grep -q ":${port} " || docker ps --format "{{.Ports}}" | grep -q ":${port}->"; do
        ((port++))
    done
    echo $port
}

WEBSOCKET_PORT=$(find_available_port 3002)
HEALTH_PORT=$(find_available_port $((WEBSOCKET_PORT + 1)))

echo "Starting Vehicle Edge Runtime ${INSTANCE_ID}..."
echo "WebSocket port: ${WEBSOCKET_PORT}"
echo "Health port: ${HEALTH_PORT}"

# Connect to vehicle-edge-network if not already connected
docker network create vehicle-edge-network >/dev/null 2>&1 || true

# Get Kit Manager IP
KIT_MANAGER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' kit-manager)

# Start runtime
docker run -d \
    --name "$CONTAINER" \
    --network vehicle-edge-network \
    --add-host kit-manager:"$KIT_MANAGER_IP" \
    -p "${WEBSOCKET_PORT}:3002" \
    -p "${HEALTH_PORT}:3003" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v $(pwd)/workspace/data:/app/data \
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
if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    print_status OK "Runtime ${INSTANCE_ID} started successfully"

    # Test health endpoint
    for i in {1..10}; do
        if curl -s "http://localhost:${HEALTH_PORT}/health" >/dev/null 2>&1; then
            print_status OK "Runtime ${INSTANCE_ID} health endpoint responding"
            break
        fi
        sleep 1
    done

    echo "Runtime ${INSTANCE_ID} WebSocket: ws://localhost:${WEBSOCKET_PORT}/runtime"
    echo "Runtime ${INSTANCE_ID} Health: http://localhost:${HEALTH_PORT}/health"

    # Check registration
    KITS_RESPONSE=$(curl -s http://localhost:3090/listAllKits 2>/dev/null)
    KIT_COUNT=$(echo "$KITS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")
    print_status INFO "Total kits registered with Kit Manager: $KIT_COUNT"
else
    print_status ERROR "Failed to start runtime ${INSTANCE_ID}"
    docker logs "$CONTAINER" 2>&1 | tail -10
    exit 1
fi