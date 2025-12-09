#!/bin/bash
# Comprehensive status check for all services

set -euo pipefail

CONTAINER="vehicle-edge-pi"

print_status() {
    local status=$1
    local msg=$2
    case $status in
        OK) echo -e "\033[0;32m✅ $msg\033[0m" ;;
        WARN) echo -e "\033[1;33m⚠️  $msg\033[0m" ;;
        ERROR) echo -e "\033[0;31m❌ $msg\033[0m" ;;
        INFO) echo -e "\033[0;34mℹ️  $msg\033[0m" ;;
    esac
}

echo "🚗 Vehicle Edge Runtime Status"
echo "================================"

# Check simulation container
echo ""
echo "📦 Simulation Container:"
if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    print_status OK "$CONTAINER is running"
    echo "  Image: $(docker inspect $CONTAINER --format='{{.Config.Image}}' 2>/dev/null || echo 'Unknown')"
    echo "  Uptime: $(docker ps --format '{{.Status}}' --filter name=$CONTAINER | cut -d' ' -f3-)"
else
    print_status ERROR "$CONTAINER is not running"
    echo "  Start with: ./0-start-pi-ci.sh"
fi

# Check Kit Manager
echo ""
echo "🔧 Kit Manager:"
if curl -s http://localhost:3090/listAllKits >/dev/null 2>&1; then
    print_status OK "Kit Manager API responding"

    KITS_RESPONSE=$(curl -s http://localhost:3090/listAllKits 2>/dev/null)
    if echo "$KITS_RESPONSE" | jq -e '.content' >/dev/null 2>&1; then
        KIT_COUNT=$(echo "$KITS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")
        echo "  Registered kits: $KIT_COUNT"

        if [ "$KIT_COUNT" -gt 0 ]; then
            echo "  Kit details:"
            echo "$KITS_RESPONSE" | jq -r '.content[]? | "    • \(.name // "Unknown") (\(.kit_id // "Unknown")) - \(.is_online // "unknown")"'
        fi
    else
        print_status WARN "Invalid response from Kit Manager"
    fi

    CLIENTS_RESPONSE=$(curl -s http://localhost:3090/listAllClient 2>/dev/null)
    if echo "$CLIENTS_RESPONSE" | jq -e '.content' >/dev/null 2>&1; then
        CLIENT_COUNT=$(echo "$CLIENTS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")
        echo "  Connected clients: $CLIENT_COUNT"
    fi
else
    print_status ERROR "Kit Manager not accessible"
    echo "  Start Kit Manager with: ./2a-start-kit-manager-internal.sh or ./2b-start-kit-manager-external.sh"
fi

# Check Docker containers
echo ""
echo "🐳 Docker Containers:"
echo "  Kit Manager containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -i kit-manager || echo "    None found"

echo "  Runtime containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -i runtime || echo "    None found"

# Check internal processes if container is running
if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    echo ""
    echo "💻 Internal Processes:"

    # Check native Node.js processes
    NATIVE_PROCESSES=$(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null | wc -l" || echo "0")
    if [ "$NATIVE_PROCESSES" -gt 0 ]; then
        print_status OK "Native Node.js processes running ($NATIVE_PROCESSES)"
        echo "  Process details:"
        docker exec "$CONTAINER" bash -c "
            ps aux | grep 'node src/index.js' | grep -v grep | while read line; do
                echo '    PID: '$(echo $line | awk '{print $2}')' - '$(echo $line | awk '{for(i=11;i<=NF;i++) printf $i\" \"; print \"\"}')
            done
        "
    else
        print_status INFO "No native Node.js processes found"
    fi

    # Check Docker inside container
    if docker exec "$CONTAINER" command -v docker >/dev/null 2>&1; then
        INTERNAL_DOCKER=$(docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' 2>/dev/null | grep -E '(kit-manager|vehicle-edge-runtime)' | wc -l" || echo "0")
        if [ "$INTERNAL_DOCKER" -gt 0 ]; then
            print_status OK "Docker containers running inside simulation ($INTERNAL_DOCKER)"
            echo "  Internal containers:"
            docker exec "$CONTAINER" bash -c "docker ps --format 'table {{.Names}}\t{{.Status}}'" 2>/dev/null | grep -E '(kit-manager|vehicle-edge-runtime)' || echo "    None found"
        else
            print_status INFO "No Docker containers running inside simulation"
        fi
    else
        print_status INFO "Docker not available inside simulation container"
    fi
fi

# Health endpoint checks
echo ""
echo "🔍 Health Endpoint Tests:"
test_endpoint() {
    local port=$1
    local name=$2
    if curl -s --max-time 3 "http://localhost:$port/health" >/dev/null 2>&1; then
        print_status OK "$name (port $port): Responding"
    else
        print_status ERROR "$name (port $port): Not responding"
    fi
}

test_endpoint 3003 "Primary Runtime Health"
test_endpoint 4003 "Secondary Runtime Health (if running)"
test_endpoint 5003 "Additional Runtime Health (if running)"

# Network status
echo ""
echo "🌐 Network Status:"
if docker network ls --format '{{.Name}}' | grep -q "vehicle-edge-network"; then
    print_status OK "vehicle-edge-network exists"

    echo "  Network connections:"
    docker network ls --format "table {{.Name}}" | grep vehicle-edge-network || echo "    None"

    # Check connected containers
    CONNECTED=$(docker network inspect vehicle-edge-network | jq -r '.[0].Containers | length' 2>/dev/null || echo "0")
    echo "  Connected containers: $CONNECTED"
else
    print_status WARN "vehicle-edge-network not found"
fi

# Summary
echo ""
echo "📊 Summary:"
KIT_COUNT=$(curl -s http://localhost:3090/listAllKits 2>/dev/null | jq -r '.content | length' 2>/dev/null || echo "0")
RUNTIME_DOCKER=$(docker ps --format '{{.Names}}' | grep -i runtime | wc -l || echo "0")

if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    NATIVE_RUNTIME=$(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null | wc -l" || echo "0")
else
    NATIVE_RUNTIME=0
fi

echo "  Kit Manager: $(curl -s http://localhost:3090/listAllKits >/dev/null 2>&1 && echo "Running" || echo "Stopped")"
echo "  Registered Kits: $KIT_COUNT"
echo "  Runtime Docker Containers: $RUNTIME_DOCKER"
echo "  Runtime Native Processes: $NATIVE_RUNTIME"
echo "  Total Runtime Instances: $((RUNTIME_DOCKER + NATIVE_RUNTIME))"

echo ""
echo "🛠️  Quick Actions:"
echo "  View logs: docker logs <container-name> -f"
echo "  Check specific kit: curl -s http://localhost:3090/listAllKits | jq ."
echo "  Stop everything: ./4c-stop-all.sh"