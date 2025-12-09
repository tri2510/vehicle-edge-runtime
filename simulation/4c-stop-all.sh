#!/bin/bash
# Stop all Vehicle Edge Runtime services

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

echo "🛑 Stopping All Vehicle Edge Runtime Services"
echo "=========================================="

# Show current status
echo ""
print_status INFO "Current status:"
if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    print_status INFO "Simulation container running: $CONTAINER"
else
    print_status INFO "Simulation container not running"
fi

KIT_COUNT=$(curl -s http://localhost:3090/listAllKits 2>/dev/null | jq -r '.content | length' 2>/dev/null || echo "0")
if [ "$KIT_COUNT" -gt 0 ]; then
    print_status INFO "Kits registered with Kit Manager: $KIT_COUNT"
else
    print_status INFO "No kits registered"
fi

# Stop external Docker containers
echo ""
echo "🐳 Stopping External Docker Containers..."

# Stop runtime containers
for container in $(docker ps --format '{{.Names}}' | grep runtime); do
    print_status INFO "Stopping external runtime: $container"
    docker stop "$container" 2>/dev/null || true
    docker rm "$container" 2>/dev/null || true
done

# Stop Kit Manager
for container in $(docker ps --format '{{.Names}}' | grep -i kit-manager); do
    print_status INFO "Stopping external Kit Manager: $container"
    docker stop "$container" 2>/dev/null || true
    docker rm "$container" 2>/dev/null || true
done

# Stop internal services if container is running
if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    echo ""
    echo "💻 Stopping Internal Services..."

    # Stop native processes
    if docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js'" >/dev/null 2>&1; then
        print_status INFO "Stopping native Node.js processes"
        docker exec "$CONTAINER" bash -c "pkill -f 'node src/index.js'" 2>/dev/null || true
        sleep 2
    fi

    # Stop internal Docker containers
    if docker exec "$CONTAINER" command -v docker >/dev/null 2>&1; then
        INTERNAL_CONTAINERS=$(docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' 2>/dev/null | grep -E '(kit-manager|vehicle-edge-runtime)'")
        if [ -n "$INTERNAL_CONTAINERS" ]; then
            print_status INFO "Stopping internal Docker containers"
            docker exec "$CONTAINER" bash -c "docker stop \$(docker ps -q --filter 'name=kit-manager' --filter 'name=vehicle-edge-runtime')" 2>/dev/null || true
            docker exec "$CONTAINER" bash -c "docker rm \$(docker ps -aq --filter 'name=kit-manager' --filter 'name=vehicle-edge-runtime')" 2>/dev/null || true
        fi
    fi
fi

# Final status check
echo ""
echo "🔍 Final Status Check:"

# Check external containers
EXTERNAL_RUNTIME=$(docker ps --format '{{.Names}}' | grep runtime | wc -l || echo "0")
EXTERNAL_KIT=$(docker ps --format '{{.Names}}' | grep -i kit-manager | wc -l || echo "0")

if [ "$EXTERNAL_RUNTIME" -eq 0 ] && [ "$EXTERNAL_KIT" -eq 0 ]; then
    print_status OK "All external containers stopped"
else
    print_status WARN "Some external containers still running"
    echo "  Runtime containers: $EXTERNAL_RUNTIME"
    echo "  Kit Manager containers: $EXTERNAL_KIT"
fi

# Check internal processes
if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    NATIVE_PROCESSES=$(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null | wc -l" || echo "0")
    if [ "$NATIVE_PROCESSES" -eq 0 ]; then
        print_status OK "All internal processes stopped"
    else
        print_status WARN "$NATIVE_PROCESSES native processes still running"
    fi
fi

# Check Kit Manager accessibility
if curl -s http://localhost:3090/listAllKits >/dev/null 2>&1; then
    print_status WARN "Kit Manager still accessible at http://localhost:3090"
else
    print_status OK "Kit Manager not accessible (stopped)"
fi

echo ""
print_status OK "Vehicle Edge Runtime services stopped successfully!"
echo ""
echo "🗑️  Cleanup Options:"
echo "  Remove Docker network: docker network rm vehicle-edge-network"
echo "  Remove Docker images: docker rmi kit-manager:sim vehicle-edge-runtime:sim"
echo "  Clean data directories: rm -rf data-*"
echo ""
echo "🚀 Restart Options:"
echo "  Full simulation: ./0-start-pi-ci.sh → ./1a-install-runtime-simulated.sh → ./2a-start-kit-manager-internal.sh"
echo "  Native runtime: ./1b-install-runtime-native.sh → ./2b-start-kit-manager-external.sh → ./3b-start-runtime-native.sh"
echo "  Production simulation: ./2b-start-kit-manager-external.sh → ./3c-start-runtime-external.sh"