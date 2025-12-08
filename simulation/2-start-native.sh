#!/bin/bash
# Start Vehicle Edge Runtime services in native Node.js mode
# Services run directly as Node.js processes (not in Docker containers)

set -euo pipefail

CONTAINER="vehicle-edge-pi"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    echo "Container $CONTAINER is not running"
    echo "Start it first: ./0-start-pi-ci.sh"
    exit 1
fi

# Check if Vehicle Edge Runtime is installed
if ! docker exec "$CONTAINER" test -f /home/pi/vehicle-edge-runtime/workspace/package.json; then
    echo "Vehicle Edge Runtime not installed"
    echo "Install it first: ./1-install-runtime.sh"
    exit 1
fi

# Handle restart flag
if [[ "${1:-}" == "--restart" ]]; then
    echo "Restarting native services..."
    docker exec "$CONTAINER" bash -c "pkill -f 'node src/index.js' 2>/dev/null || true"
    sleep 3
else
    # Check if services are already running
    if docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' >/dev/null 2>&1"; then
        echo "Native services are already running"
        echo "Stop them first or use --restart flag"
        exit 1
    fi
fi

echo "Starting Vehicle Edge Runtime services in NATIVE mode..."
echo "  - Kit Manager and Vehicle Edge Runtime will run as Node.js processes"
echo "  - Services will not be visible to LazyDocker"
echo "  - Faster startup and good for testing"
echo ""

# Configure environment for native execution
docker exec "$CONTAINER" bash -c "
    cd /home/pi/vehicle-edge-runtime/workspace
    su pi -c 'cat > .env << EOF
PORT=3002
KIT_MANAGER_URL=ws://localhost:3090
DATA_PATH=./data
LOG_LEVEL=info
MAX_CONCURRENT_APPS=3
DEFAULT_MEMORY_LIMIT=268435456
DEFAULT_CPU_LIMIT=75000
SKIP_KUKSA=true
EOF'
"

# Create data directory
docker exec "$CONTAINER" bash -c "
    cd /home/pi/vehicle-edge-runtime/workspace
    su pi -c 'mkdir -p data data/logs data/configs'
"

echo "Configuration set for native mode (ports 3002/3003, 3090)"

# Start Kit Manager in background
echo "Starting Kit Manager..."
docker exec -d "$CONTAINER" bash -c "
    cd /home/pi/vehicle-edge-runtime/workspace/Kit-Manager
    su pi -c 'npm start'
"

# Wait for Kit Manager to start
sleep 3

# Start Vehicle Edge Runtime in background
echo "Starting Vehicle Edge Runtime..."
docker exec -d "$CONTAINER" bash -c "
    cd /home/pi/vehicle-edge-runtime/workspace
    su pi -c 'npm start'
"

# Wait for services to initialize
echo ""
echo "Waiting for services to initialize..."
sleep 5

# Check if services are running
if docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' >/dev/null 2>&1"; then
    echo "✅ Native services started successfully"
    echo "Process IDs:"
    docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' | xargs -I {} echo '    PID: {}'"
else
    echo "❌ Failed to start native services"
    docker exec "$CONTAINER" tail -10 /home/pi/vehicle-edge-runtime/workspace/data/logs/*.log 2>/dev/null || true
    exit 1
fi

# Check service health
echo "Checking service health..."
for i in {1..10}; do
    if docker exec "$CONTAINER" bash -c "curl -s --max-time 2 http://localhost:3003/health >/dev/null 2>&1"; then
        echo "✅ Health endpoint responding"
        break
    fi
    if [[ $i -eq 10 ]]; then
        echo "⚠️  Health endpoint not responding yet, but service is starting"
    fi
    sleep 2
done

echo ""
echo "🎉 Vehicle Edge Runtime is running in NATIVE mode!"
echo ""
echo "Service Access (from inside simulation container):"
echo "  Runtime Health: http://localhost:3003/health"
echo "  WebSocket API: ws://localhost:3002/runtime"
echo "  Kit Manager: http://localhost:3090"

echo ""
echo "💻 Native Processes Management:"
echo "  View processes: docker exec $CONTAINER ps aux | grep node"
echo "  View logs: docker exec $CONTAINER su pi -c 'tail -f /home/pi/vehicle-edge-runtime/workspace/data/logs/*.log'"
echo "  Stop services: ./3-stop-native.sh"
echo "  Restart: ./2-start-native.sh --restart"
echo "  Access shell: docker exec -it $CONTAINER su pi -c bash"

echo ""
echo "📖 Mode Information:"
echo "  This is NATIVE mode - services run as Node.js processes"
echo "  Use Docker mode for LazyDocker visibility: ./2-start-docker.sh"