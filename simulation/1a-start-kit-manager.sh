#!/bin/bash
# Start Standalone Kit Manager
# Runs Kit Manager outside the simulation container for better isolation

set -euo pipefail

# Container and configuration
KIT_MANAGER_CONTAINER="kit-manager-standalone"
KIT_MANAGER_PORT="3090"
NETWORK_NAME="vehicle-edge-network"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored status
print_status() {
    local status="$1"
    local message="$2"

    case "$status" in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Check if Kit Manager is already running
echo "🔍 Checking for existing Kit Manager..."
if docker ps --format '{{.Names}}' | grep -q "^$KIT_MANAGER_CONTAINER$"; then
    print_status "WARN" "Kit Manager is already running"
    echo ""
    echo "🛠️  To restart:"
    echo "   docker stop $KIT_MANAGER_CONTAINER"
    echo "   docker rm $KIT_MANAGER_CONTAINER"
    echo "   ./1a-start-kit-manager.sh"
    exit 1
fi

# Check if container exists but stopped
if docker ps -a --format '{{.Names}}' | grep -q "^$KIT_MANAGER_CONTAINER$"; then
    print_status "INFO" "Found existing Kit Manager container, cleaning up..."
    docker rm "$KIT_MANAGER_CONTAINER"
fi

print_status "OK" "No existing Kit Manager found"

echo ""
echo "🚀 Starting Standalone Kit Manager..."
echo "  Container Name: $KIT_MANAGER_CONTAINER"
echo "  Port: $KIT_MANAGER_PORT"
echo "  Network: $NETWORK_NAME"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

# Create Docker network if it doesn't exist
echo "🔧 Setting up Docker network..."
if ! docker network ls --format '{{.Name}}' | grep -q "^$NETWORK_NAME$"; then
    docker network create "$NETWORK_NAME"
    print_status "OK" "Created Docker network: $NETWORK_NAME"
else
    print_status "OK" "Docker network already exists: $NETWORK_NAME"
fi

# Check if Kit Manager image exists
echo "🔍 Checking Kit Manager Docker image..."
if ! docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "kit-manager:sim"; then
    print_status "WARN" "Kit Manager image not found, building..."
    docker build -t kit-manager:sim "$WORKSPACE_DIR/Kit-Manager" || {
        print_status "ERROR" "Failed to build Kit Manager image"
        exit 1
    }
else
    print_status "OK" "Kit Manager image is available"
fi

# Create the Kit Manager container
echo "🚀 Starting Kit Manager container..."
docker run -d \
    --name "$KIT_MANAGER_CONTAINER" \
    --network "$NETWORK_NAME" \
    -p "$KIT_MANAGER_PORT:3090" \
    kit-manager:sim

if [ $? -ne 0 ]; then
    print_status "ERROR" "Failed to start Kit Manager container"
    exit 1
fi

print_status "OK" "Kit Manager container started"

# Wait for Kit Manager to initialize
echo ""
echo "⏳ Waiting for Kit Manager to initialize..."
sleep 8

# Check if the container is running
echo "🔍 Checking container status..."
if ! docker ps --format '{{.Names}}\t{{.Status}}' | grep -q "$KIT_MANAGER_CONTAINER"; then
    print_status "ERROR" "Kit Manager container is not running"
    echo ""
    echo "🔍 Checking logs:"
    docker logs "$KIT_MANAGER_CONTAINER" 2>&1 | tail -15
    exit 1
fi

print_status "OK" "Kit Manager is running"

# Test Kit Manager health endpoint
echo "🔍 Testing Kit Manager API..."
for i in {1..10}; do
    if curl -s --max-time 3 "http://localhost:$KIT_MANAGER_PORT/listAllKits" >/dev/null 2>&1; then
        print_status "OK" "Kit Manager API is responding"
        break
    fi
    if [[ $i -eq 10 ]]; then
        print_status "WARN" "Kit Manager API not responding yet (may still be starting)"
    fi
    sleep 2
done

# Test the kits endpoint
echo "🔍 Testing kits endpoint..."
KITS_RESPONSE=$(curl -s "http://localhost:$KIT_MANAGER_PORT/listAllKits" 2>/dev/null)
if echo "$KITS_RESPONSE" | jq -e '.status == "OK"' >/dev/null 2>&1; then
    KIT_COUNT=$(echo "$KITS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")
    print_status "OK" "Kits endpoint working (current kits: $KIT_COUNT)"
else
    print_status "WARN" "Kits endpoint not responding correctly"
fi

# Test the clients endpoint
echo "🔍 Testing clients endpoint..."
CLIENTS_RESPONSE=$(curl -s "http://localhost:$KIT_MANAGER_PORT/listAllClient" 2>/dev/null)
if echo "$CLIENTS_RESPONSE" | jq -e '.status == "OK"' >/dev/null 2>&1; then
    CLIENT_COUNT=$(echo "$CLIENTS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")
    print_status "OK" "Clients endpoint working (current clients: $CLIENT_COUNT)"
else
    print_status "WARN" "Clients endpoint not responding correctly"
fi

# Show container logs
echo ""
echo "📋 Kit Manager Container Logs:"
docker logs "$KIT_MANAGER_CONTAINER" 2>&1 | tail -5

echo ""
echo "🎉 Standalone Kit Manager is running!"
echo ""
echo "📊 Service Information:"
echo "  Container: $KIT_MANAGER_CONTAINER"
echo "  API Endpoint: http://localhost:$KIT_MANAGER_PORT"
echo "  WebSocket: ws://localhost:$KIT_MANAGER_PORT"
echo "  Network: $NETWORK_NAME"
echo ""
echo "🔗 Available Endpoints:"
echo "  List Kits: curl -s http://localhost:$KIT_MANAGER_PORT/listAllKits | jq ."
echo "  List Clients: curl -s http://localhost:$KIT_MANAGER_PORT/listAllClient | jq ."
echo "  Convert Code: curl -X POST -H 'Content-Type: application/json' -d '{\"code\":\"print(\\\"hello\\\")\"}' http://localhost:$KIT_MANAGER_PORT/convertCode"
echo ""
echo "🛠️  Management Commands:"
echo "  View logs: docker logs $KIT_MANAGER_CONTAINER -f"
echo "  Stop Kit Manager: docker stop $KIT_MANAGER_CONTAINER"
echo "  Remove Kit Manager: docker rm $KIT_MANAGER_CONTAINER"
echo ""
echo "📖 Integration with Simulation:"
echo "  Run Vehicle Edge Runtime instances that connect to this Kit Manager:"
echo "    ./2-start-docker-external.sh    # Docker mode with external Kit Manager"
echo "    ./2-start-native-external.sh    # Native mode with external Kit Manager"
echo "    ./5-start-second-runtime.sh     # Additional runtime instances"
echo ""
echo "🎯 Architecture Benefits:"
echo "  • Kit Manager runs independently of simulation environment"
echo "  • Cleaner separation of services"
echo "  • Easier debugging and monitoring"
echo "  • Better simulation of real deployment scenarios"