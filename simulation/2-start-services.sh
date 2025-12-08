#!/bin/bash
# Start Vehicle Edge Runtime services in pi-ci container

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

echo "Starting Vehicle Edge Runtime services..."

# Handle restart flag
if [[ "${1:-}" == "--restart" ]]; then
    echo "Stopping existing services..."
    docker exec "$CONTAINER" bash -c "pkill -f 'node src/index.js' 2>/dev/null || true"
    sleep 2
else
    # Check if services are already running
    if docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' >/dev/null 2>&1"; then
        echo "Services are already running"
        echo "Stop them first or use --restart flag"
        exit 1
    fi
fi

# Configure environment for pi-ci
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

echo "Configuration set for port 3002"

# Start Vehicle Edge Runtime in background
echo "Starting Vehicle Edge Runtime..."
docker exec -d "$CONTAINER" bash -c "
    cd /home/pi/vehicle-edge-runtime/workspace
    su pi -c 'npm start'
"

# Wait for service to start
echo "Waiting for services to initialize..."
sleep 5

# Check if service is running
if docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' >/dev/null 2>&1"; then
    echo "✅ Vehicle Edge Runtime started successfully"
else
    echo "❌ Failed to start Vehicle Edge Runtime"
    docker exec "$CONTAINER" tail -10 /home/pi/.npm/_logs/*.log 2>/dev/null || true
    exit 1
fi

# Check if port is accessible (inside container)
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
echo "🎉 Vehicle Edge Runtime is running!"
echo ""
echo "Service status:"
echo "  Runtime: http://localhost:3003/health"
echo "  WebSocket: ws://localhost:3002/runtime"
echo "  Process ID:"
docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' | xargs -I {} echo '    {}'"
echo ""
echo "Available commands:"
echo "  View logs: docker exec $CONTAINER su pi -c 'tail -f /home/pi/vehicle-edge-runtime/workspace/data/logs/*.log'"
echo "  Stop services: ./3-stop-services.sh"
echo "  Check status: ./4-check-status.sh"
echo "  Access shell: docker exec -it $CONTAINER su pi -c bash"
echo ""
echo "Note: Ports 3002/3003 are accessible inside the container."
echo "Use port mapping if you need external access."