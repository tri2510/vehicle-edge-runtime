#!/bin/bash
# Start Vehicle Edge Runtime in Native mode with external Kit Manager
# Runtime runs as native process inside simulation container, Kit Manager runs separately

set -euo pipefail

CONTAINER="vehicle-edge-pi"

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

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    print_status "ERROR" "Container $CONTAINER is not running"
    echo "Start it first: ./0-start-pi-ci.sh"
    exit 1
fi

# Check if Kit Manager is accessible (external)
echo "🔍 Checking external Kit Manager connectivity..."
if ! curl -s --max-time 3 http://localhost:3090/listAllKits >/dev/null 2>&1; then
    print_status "ERROR" "External Kit Manager is not accessible"
    echo ""
    echo "🚀 Start Kit Manager first:"
    echo "   ./1a-start-kit-manager.sh"
    exit 1
fi

print_status "OK" "External Kit Manager is accessible"

# Check if Vehicle Edge Runtime is installed
if ! docker exec "$CONTAINER" test -f /home/pi/vehicle-edge-runtime/workspace/package.json; then
    print_status "ERROR" "Vehicle Edge Runtime not installed"
    echo "Install it first: ./1-install-runtime.sh"
    exit 1
fi

# Handle restart flag
if [[ "${1:-}" == "--restart" ]]; then
    echo "Restarting Native services..."
    docker exec "$CONTAINER" bash -c "pkill -f 'node src/index.js' 2>/dev/null || true"
    sleep 3
else
    # Check if services are already running
    if docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' >/dev/null 2>&1"; then
        echo "Native Vehicle Edge Runtime is already running"
        echo "Stop it first or use --restart flag"
        echo ""
        echo "Running processes:"
        docker exec "$CONTAINER" bash -c "ps aux | grep 'node src/index.js' | grep -v grep" || echo "None found"
        exit 1
    fi
fi

echo ""
echo "🚀 Starting Vehicle Edge Runtime in NATIVE mode with external Kit Manager..."
echo "  - Runtime runs as native Node.js process inside $CONTAINER"
echo "  - Kit Manager runs externally (port 3090)"
echo "  - Runtime connects to external Kit Manager"
echo "  - Faster startup, direct process execution"
echo ""

# Connect container to external Kit Manager network
echo "🔧 Connecting container to external Kit Manager network..."
NETWORK_NAME="vehicle-edge-network"
if docker network ls --format '{{.Name}}' | grep -q "^$NETWORK_NAME$"; then
    docker network connect "$NETWORK_NAME" "$CONTAINER" 2>/dev/null || print_status "INFO" "Container already connected to network"
else
    print_status "WARN" "Vehicle Edge network not found - Kit Manager should create it"
fi

# Create data directory
echo "📁 Setting up data directory..."
docker exec "$CONTAINER" bash -c "
    mkdir -p /home/pi/vehicle-edge-runtime/workspace/data/applications
    mkdir -p /home/pi/vehicle-edge-runtime/workspace/data/logs
    mkdir -p /home/pi/vehicle-edge-runtime/workspace/data/configs
    chown -R pi:pi /home/pi/vehicle-edge-runtime/workspace/data
    chmod 755 /home/pi/vehicle-edge-runtime/workspace/data/logs
"

# Start Vehicle Edge Runtime natively
echo "🚀 Starting Vehicle Edge Runtime process..."
docker exec -d "$CONTAINER" bash -c "
    cd /home/pi/vehicle-edge-runtime/workspace &&
    export KIT_MANAGER_URL=ws://kit-manager-standalone:3090 &&
    export PORT=3002 &&
    export LOG_LEVEL=info &&
    export DATA_PATH=/home/pi/vehicle-edge-runtime/workspace/data &&
    export SKIP_KUKSA=true &&
    export RUNTIME_NAME='native-runtime' &&
    npm start
"

if [ $? -ne 0 ]; then
    print_status "ERROR" "Failed to start Vehicle Edge Runtime process"
    exit 1
fi

print_status "OK" "Vehicle Edge Runtime process started"

# Wait for services to initialize
echo ""
echo "⏳ Waiting for services to initialize..."
sleep 8

# Check if process is running
echo "🔍 Checking process status..."
if docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' >/dev/null 2>&1"; then
    print_status "OK" "Vehicle Edge Runtime process is running"

    # Get process details
    echo ""
    echo "📋 Process Details:"
    docker exec "$CONTAINER" bash -c "
        ps aux | grep 'node src/index.js' | grep -v grep | while read line; do
            echo '  PID: '$(echo $line | awk '{print $2}')' - Command: '$(echo $line | awk '{for(i=11;i<=NF;i++) printf $i\" \"; print \"\"}')
        done
    "
else
    print_status "ERROR" "Vehicle Edge Runtime process is not running"
    echo ""
    echo "🔍 Checking logs:"
    docker exec "$CONTAINER" bash -c "
        cd /home/pi/vehicle-edge-runtime/workspace &&
        npm test 2>&1 | tail -15 || echo 'No test output available'
    "
    exit 1
fi

# Test health endpoint
echo ""
echo "🔍 Testing health endpoint..."
for i in {1..10}; do
    if docker exec "$CONTAINER" timeout 3 bash -c 'echo >/dev/tcp/localhost/3003' 2>/dev/null; then
        print_status "OK" "Health endpoint is accessible on port 3003"
        break
    fi
    if [[ $i -eq 10 ]]; then
        print_status "WARN" "Health endpoint not responding yet (may still be starting)"
    fi
    sleep 2
done

# Show recent logs
echo ""
echo "📋 Recent Runtime Logs:"
docker exec "$CONTAINER" bash -c "
    if [ -f /home/pi/vehicle-edge-runtime/workspace/data/logs/runtime.log ]; then
        tail -10 /home/pi/vehicle-edge-runtime/workspace/data/logs/runtime.log
    else
        echo 'Log file not found yet, checking npm output...'
        ps aux | grep 'npm start' | grep -v grep || echo 'No npm processes found'
    fi
"

echo ""
echo "🎉 Vehicle Edge Runtime is running in NATIVE mode with external Kit Manager!"
echo ""
echo "Service Access (from inside simulation container):"
echo "  Runtime Health: http://localhost:3003/health"
echo "  WebSocket API: ws://localhost:3002/runtime"
echo ""
echo "🖥️  Native Process Management:"
echo "  View process: docker exec $CONTAINER ps aux | grep 'node src/index.js'"
echo "  View logs: docker exec $CONTAINER tail -f /home/pi/vehicle-edge-runtime/workspace/data/logs/*.log"
echo "  Access shell: docker exec -it $CONTAINER su pi -c bash"
echo "  Kill process: docker exec $CONTAINER pkill -f 'node src/index.js'"
echo ""
echo "🔗 External Kit Manager:"
echo "  API: http://localhost:3090/listAllKits"
echo "  WebSocket: ws://localhost:3090"
echo "  Status: Check registration with 'curl -s http://localhost:3090/listAllKits | jq .'"
echo ""
echo "🛠️  Management Commands:"
echo "  Stop services: ./3b-stop-native-external.sh"
echo "  Restart: ./2b-start-native-external.sh --restart"
echo "  Access shell: docker exec -it $CONTAINER su pi -c bash"
echo ""
echo "📖 Mode Information:"
echo "  This is NATIVE mode with EXTERNAL Kit Manager"
echo "  • Runtime runs as direct Node.js process"
echo "  • Kit Manager runs independently for better isolation"
echo "  • Faster startup and debugging"
echo "  • Cleaner service separation"