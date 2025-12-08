#!/bin/bash
# Start Additional Vehicle Edge Runtime Instance
# Connects to existing Kit Manager to test multiple instances

set -euo pipefail

INSTANCE_NAME="runtime-2"
INSTANCE_PORT="4002"  # Different from primary (3002)
INSTANCE_HEALTH_PORT="4003"  # Different from primary (3003)
HOST_IP=$(hostname -I | awk '{print $1}')  # Get actual host IP

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

# Check if Kit Manager is accessible
echo "🔍 Checking Kit Manager connectivity..."
if ! curl -s --max-time 3 http://localhost:3090/listAllKits >/dev/null 2>&1; then
    print_status "ERROR" "Kit Manager is not accessible"
    echo ""
    echo "🚀 Make sure Kit Manager is running:"
    echo "   cd simulation && ./2a-start-docker.sh"
    exit 1
fi

print_status "OK" "Kit Manager is accessible"

# Check if second instance is already running
echo "🔍 Checking for existing $INSTANCE_NAME instance..."
if docker ps --format '{{.Names}}' | grep -q "^$INSTANCE_NAME$"; then
    print_status "WARN" "$INSTANCE_NAME is already running"
    echo ""
    echo "🛠️  To restart:"
    echo "   docker stop $INSTANCE_NAME"
    echo "   docker rm $INSTANCE_NAME"
    echo "   ./5-start-second-runtime.sh"
    exit 1
fi

print_status "OK" "No existing $INSTANCE_NAME instance found"

echo ""
echo "🚀 Starting Additional Vehicle Edge Runtime Instance..."
echo "  Instance Name: $INSTANCE_NAME"
echo "  WebSocket Port: $INSTANCE_PORT"
echo "  Health Check Port: $INSTANCE_HEALTH_PORT"
echo "  Connecting to: Kit Manager at ws://kit-manager:3090 (via Docker network)"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

# Check if Docker image exists
echo "🔍 Checking Docker image..."
if ! docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "vehicle-edge-runtime:sim"; then
    print_status "WARN" "Docker image not found, building..."
    docker build -f "$WORKSPACE_DIR/Dockerfile.runtime" -t vehicle-edge-runtime:sim "$WORKSPACE_DIR" || {
        print_status "ERROR" "Failed to build Docker image"
        exit 1
    }
fi

print_status "OK" "Docker image is available"

# Create data directory for second instance
echo "📁 Creating data directory..."
DATA_DIR="$WORKSPACE_DIR/data-$INSTANCE_NAME"
mkdir -p "$DATA_DIR/applications"
mkdir -p "$DATA_DIR/logs"
mkdir -p "$DATA_DIR/configs"

# Create the second runtime container
echo "🚀 Starting $INSTANCE_NAME container..."
docker run -d \
    --name "$INSTANCE_NAME" \
    --network vehicle-edge-network \
    -p "$INSTANCE_PORT:4002" \
    -p "$INSTANCE_HEALTH_PORT:4003" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$DATA_DIR:/app/data" \
    -e KIT_MANAGER_URL="ws://kit-manager:3090" \
    -e PORT="4002" \
    -e LOG_LEVEL="info" \
    -e DATA_PATH="/app/data" \
    -e SKIP_KUKSA="true" \
    -e RUNTIME_NAME="$INSTANCE_NAME" \
    --user root \
    vehicle-edge-runtime:sim

if [ $? -ne 0 ]; then
    print_status "ERROR" "Failed to start $INSTANCE_NAME container"
    exit 1
fi

print_status "OK" "$INSTANCE_NAME container started"

# Wait for the instance to initialize
echo ""
echo "⏳ Waiting for instance to initialize..."
sleep 10

# Check if the container is running
echo "🔍 Checking container status..."
if ! docker ps --format '{{.Names}}\t{{.Status}}' | grep -q "$INSTANCE_NAME"; then
    print_status "ERROR" "$INSTANCE_NAME container is not running"
    echo ""
    echo "🔍 Checking logs:"
    docker logs "$INSTANCE_NAME" 2>&1 | tail -15
    exit 1
fi

print_status "OK" "$INSTANCE_NAME is running"

# Check if the instance connected to Kit Manager
echo "🔍 Checking Kit Manager registration..."
sleep 5

# Check kits list for the second instance
echo "🔍 Checking if second instance registered with Kit Manager..."
KITS_RESPONSE=$(curl -s http://localhost:3090/listAllKits)
KIT_COUNT=$(echo "$KITS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")

if [ "$KIT_COUNT" -gt 1 ]; then
    print_status "OK" "Multiple kits registered with Kit Manager"
    echo ""
    echo "📋 Registered Kits:"
    echo "$KITS_RESPONSE" | jq -r '.content[]? | "  • \(.name // "Unknown") (\(.kit_id // "Unknown")) - Last seen: \(.last_seen // "Never")"' 2>/dev/null || echo "$KITS_RESPONSE"
elif [ "$KIT_COUNT" -eq 1 ]; then
    print_status "WARN" "Only one kit registered (second instance may still be connecting)"
    echo ""
    echo "📋 Current Kit:"
    echo "$KITS_RESPONSE" | jq -r '.content[0]? | "  • \(.name // "Unknown") (\(.kit_id // "Unknown"))"' 2>/dev/null || echo "$KITS_RESPONSE"

    # Give it more time to register
    echo ""
    echo "⏳ Waiting additional time for registration..."
    sleep 15

    # Check again
    KITS_RESPONSE=$(curl -s http://localhost:3090/listAllKits)
    KIT_COUNT=$(echo "$KITS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")

    if [ "$KIT_COUNT" -gt 1 ]; then
        print_status "OK" "Second instance now registered"
    else
        print_status "WARN" "Second instance still not registered - checking logs"
        echo ""
        echo "🔍 Second instance logs:"
        docker logs "$INSTANCE_NAME" 2>&1 | tail -20
    fi
else
    print_status "ERROR" "No kits registered with Kit Manager"
    exit 1
fi

# Test health endpoint if available
echo ""
echo "🔍 Testing health endpoints..."
echo "Primary Runtime (Port 3003):"
if timeout 3 bash -c 'echo >/dev/tcp/localhost/3003' 2>/dev/null; then
    print_status "OK" "Primary runtime health endpoint reachable"
else
    print_status "WARN" "Primary runtime health endpoint not reachable (may be inside container)"
fi

echo "Second Runtime (Port $INSTANCE_HEALTH_PORT):"
if timeout 3 bash -c "echo >/dev/tcp/localhost/$INSTANCE_HEALTH_PORT" 2>/dev/null; then
    print_status "OK" "Second runtime health endpoint reachable"
else
    print_status "WARN" "Second runtime health endpoint not reachable (may need more time)"
fi

# Show container logs for the second instance
echo ""
echo "📋 Second Runtime Container Logs:"
docker logs "$INSTANCE_NAME" 2>&1 | tail -10

echo ""
echo "🎉 Multiple Vehicle Edge Runtime instances are now running!"
echo ""
echo "📊 Instance Summary:"
echo "  Primary Runtime:"
echo "    Container: vehicle-edge-runtime (inside vehicle-edge-pi)"
echo "    WebSocket: ws://localhost:3002/runtime"
echo "    Health: http://localhost:3003/health"
echo "    Data: (container data directory)"
echo ""
echo "  Secondary Runtime:"
echo "    Container: $INSTANCE_NAME"
echo "    WebSocket: ws://localhost:$INSTANCE_PORT/runtime"
echo "    Health: http://localhost:$INSTANCE_HEALTH_PORT/health"
echo "    Data: $DATA_DIR"
echo ""
echo "🔗 Kit Manager:"
echo "    API: http://localhost:3090/listAllKits"
echo "    WebSocket: ws://localhost:3090"
echo ""
echo "🛠️  Management Commands:"
echo "  View second instance logs: docker logs $INSTANCE_NAME -f"
echo "  Stop second instance: docker stop $INSTANCE_NAME"
echo "  Remove second instance: docker rm $INSTANCE_NAME"
echo "  Check kits: curl -s http://localhost:3090/listAllKits | jq ."
echo ""
echo "🎯 Test Multi-Instance Deployment:"
echo "  You can now deploy apps to either runtime using their kit_id from the Kit Manager!"
echo ""
echo "📖 Mode Information:"
echo "  This script adds a second Vehicle Edge Runtime instance to test:"
echo "  • Multiple runtime registration"
echo "  • Load balancing across runtimes"
echo "  • Independent app deployment"
echo "  • Parallel execution capabilities"