#!/bin/bash
# Check status of all services

set -euo pipefail

print_status() {
    local status=$1
    local msg=$2
    case $status in
        OK) echo -e "\033[0;32m✅ $msg\033[0m" ;;
        WARN) echo -e "\033[1;33m⚠️  $msg\033[0m" ;;
        ERROR) echo -e "\033[0;31m❌ $msg\033[0m" ;;
    esac
}

echo "🔍 Vehicle Edge Runtime Status Check"
echo "=================================="

# Check Docker containers
echo ""
echo "📦 Docker Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(vehicle-edge|kit-manager)" || echo "No runtime containers found"

# List all runtime instances with their ports
echo ""
echo "🚀 Runtime Instances:"
RUNTIME_CONTAINERS=$(docker ps --format '{{.Names}}' | grep '^vehicle-edge-runtime[a-zA-Z]*$' || true)
if [[ -n "$RUNTIME_CONTAINERS" ]]; then
    echo "$RUNTIME_CONTAINERS" | while read container; do
        INSTANCE_ID=$(echo "$container" | sed 's/vehicle-edge-runtime//')
        PORTS=$(docker port "$container" 2>/dev/null || echo "N/A")
        echo "   Runtime ${INSTANCE_ID}: $container - Ports: $PORTS"
    done
else
    echo "   No runtime instances running"
fi

# Check Kit Manager
echo ""
echo "🎯 Kit Manager (http://localhost:3090):"
if curl -s http://localhost:3090/listAllKits >/dev/null 2>&1; then
    print_status OK "Kit Manager API responding"
    KITS_RESPONSE=$(curl -s http://localhost:3090/listAllKits 2>/dev/null)
    KIT_COUNT=$(echo "$KITS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")
    echo "   Registered kits: $KIT_COUNT"
else
    print_status ERROR "Kit Manager not responding"
fi

# Check Runtime Health for all instances
echo ""
echo "🚀 Runtime Health Endpoints:"
RUNTIME_CONTAINERS=$(docker ps --format '{{.Names}}' | grep '^vehicle-edge-runtime[a-zA-Z]*$' || true)
if [[ -n "$RUNTIME_CONTAINERS" ]]; then
    echo "$RUNTIME_CONTAINERS" | while read container; do
        # Get the mapped health port
        HEALTH_PORT=$(docker port "$container" 3003/tcp 2>/dev/null | cut -d: -f2 || echo "")
        if [[ -n "$HEALTH_PORT" ]]; then
            INSTANCE_ID=$(echo "$container" | sed 's/vehicle-edge-runtime//')
            if curl -s "http://localhost:${HEALTH_PORT}/health" >/dev/null 2>&1; then
                print_status OK "Runtime ${INSTANCE_ID} health endpoint responding (port ${HEALTH_PORT})"
            else
                print_status ERROR "Runtime ${INSTANCE_ID} health endpoint not responding (port ${HEALTH_PORT})"
            fi
        fi
    done
else
    echo "   No runtime instances to check"
fi

# Check Runtime WebSocket ports
echo ""
echo "🔌 Runtime WebSocket Ports:"
RUNTIME_CONTAINERS=$(docker ps --format '{{.Names}}' | grep '^vehicle-edge-runtime[a-zA-Z]*$' || true)
if [[ -n "$RUNTIME_CONTAINERS" ]]; then
    echo "$RUNTIME_CONTAINERS" | while read container; do
        # Get the mapped WebSocket port
        WS_PORT=$(docker port "$container" 3002/tcp 2>/dev/null | cut -d: -f2 || echo "")
        if [[ -n "$WS_PORT" ]]; then
            INSTANCE_ID=$(echo "$container" | sed 's/vehicle-edge-runtime//')
            if netstat -tlnp 2>/dev/null | grep -q ":${WS_PORT}"; then
                print_status OK "Runtime ${INSTANCE_ID} WebSocket listening on port ${WS_PORT}"
            else
                print_status ERROR "Runtime ${INSTANCE_ID} WebSocket not listening on port ${WS_PORT}"
            fi
        fi
    done
else
    echo "   No runtime WebSocket ports to check"
fi

# Check Network
echo ""
echo "🌐 Network Status:"
if docker network ls | grep -q "vehicle-edge-network"; then
    print_status OK "vehicle-edge-network exists"
    echo "   Connected containers:"
    docker network inspect vehicle-edge-network --format='{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || echo "   No connected containers"
else
    print_status WARN "vehicle-edge-network not found"
fi

echo ""
echo "📊 Summary:"
KIT_MANAGER_RUNNING=$(docker ps --format '{{.Names}}' | grep -q "^kit-manager$" && echo "1" || echo "0")
RUNTIME_COUNT=$(docker ps --format '{{.Names}}' | grep '^vehicle-edge-runtime[a-zA-Z]*$' | wc -l)
TOTAL_CONTAINERS=$((KIT_MANAGER_RUNNING + RUNTIME_COUNT))

echo "   Kit Manager: $KIT_MANAGER_RUNNING/1"
echo "   Runtime instances: $RUNTIME_COUNT"

if [[ $KIT_MANAGER_RUNNING -eq 1 && $RUNTIME_COUNT -gt 0 ]]; then
    print_status OK "Services running ($TOTAL_CONTAINERS containers)"
elif [[ $KIT_MANAGER_RUNNING -eq 1 ]]; then
    print_status WARN "Kit Manager running, no runtime instances"
elif [[ $RUNTIME_COUNT -gt 0 ]]; then
    print_status WARN "Runtime instances running, no Kit Manager"
else
    print_status ERROR "No services running"
fi