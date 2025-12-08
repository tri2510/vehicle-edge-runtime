#!/bin/bash
# Stop Vehicle Edge Runtime services in pi-ci container

set -euo pipefail

CONTAINER="vehicle-edge-pi"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    echo "Container $CONTAINER is not running"
    exit 1
fi

echo "Stopping Vehicle Edge Runtime services..."

# Check if any services are running
RUNNING_PROCESSES=$(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null | wc -l" || echo "0")

if [[ $RUNNING_PROCESSES -eq 0 ]]; then
    echo "No Vehicle Edge Runtime services are running"
    exit 0
fi

echo "Found $RUNNING_PROCESSES running Vehicle Edge Runtime process(es)"

# Stop processes gracefully
echo "Attempting graceful shutdown..."
docker exec "$CONTAINER" bash -c "pkill -f 'node src/index.js'" 2>/dev/null || true

# Wait for graceful shutdown
sleep 3

# Check if processes are still running
REMAINING_PROCESSES=$(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null | wc -l" || echo "0")

if [[ $REMAINING_PROCESSES -gt 0 ]]; then
    echo "Still running $REMAINING_PROCESSES process(es), forcing shutdown..."
    docker exec "$CONTAINER" bash -c "pkill -9 -f 'node src/index.js'" 2>/dev/null || true
    sleep 1
fi

# Final check
FINAL_PROCESSES=$(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null | wc -l" || echo "0")

if [[ $FINAL_PROCESSES -eq 0 ]]; then
    echo "✅ All Vehicle Edge Runtime services stopped successfully"
else
    echo "⚠️  $FINAL_PROCESSES process(es) still running"
    echo "Remaining processes:"
    docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null" || echo "None found"
fi

# Clean up any remaining node processes if needed
if [[ "${1:-}" == "--force" ]]; then
    echo "Force cleaning all node processes..."
    docker exec "$CONTAINER" bash -c "pkill -9 node" 2>/dev/null || true
    echo "✅ Force cleanup completed"
fi

echo ""
echo "Services status:"
echo "  Vehicle Edge Runtime: $(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' >/dev/null 2>&1 && echo 'Running' || echo 'Stopped'")"
echo ""
echo "Available commands:"
echo "  Start services: ./2-start-services.sh"
echo "  Check status: ./4-check-status.sh"
echo "  Access shell: docker exec -it $CONTAINER su pi -c bash"