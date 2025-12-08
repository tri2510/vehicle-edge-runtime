#!/bin/bash
# Stop Vehicle Edge Runtime services running in Docker mode with external Kit Manager

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

echo "🛑 Stopping Docker Vehicle Edge Runtime services with external Kit Manager..."

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    print_status "ERROR" "Container $CONTAINER is not running"
    exit 1
fi

# Check if Docker is available
if ! docker exec "$CONTAINER" command -v docker >/dev/null 2>&1; then
    print_status "ERROR" "Docker is not available in simulation container"
    exit 1
fi

# Check if Docker container is running
RUNNING_CONTAINER=$(docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep 'vehicle-edge-runtime' | wc -l" || echo "0")

if [[ $RUNNING_CONTAINER -eq 0 ]]; then
    print_status "INFO" "No Docker Vehicle Edge Runtime is running"
    echo ""
    echo "Running Docker containers:"
    docker exec "$CONTAINER" bash -c "docker ps --format 'table {{.Names}}\t{{.Status}}'" || echo "None"
    exit 0
fi

print_status "OK" "Found running Vehicle Edge Runtime container"
echo "Current containers:"
docker exec "$CONTAINER" bash -c "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" | grep 'vehicle-edge-runtime' || echo "None found"

# Show final status before stopping
echo ""
echo "📊 Final Runtime Status:"
KITS_RESPONSE=$(curl -s http://localhost:3090/listAllKits 2>/dev/null || echo '{"content": []}')
if echo "$KITS_RESPONSE" | jq -e '.content' >/dev/null 2>&1; then
    KIT_COUNT=$(echo "$KITS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")
    echo "  Connected kits: $KIT_COUNT"

    if [ "$KIT_COUNT" -gt 0 ]; then
        echo "  Kit details:"
        echo "$KITS_RESPONSE" | jq -r '.content[]? | "    • \(.name // "Unknown") (\(.kit_id // "Unknown")) - \(.is_online // "unknown")"' 2>/dev/null || true
    fi
else
    echo "  Could not retrieve kit status"
fi

# Stop container gracefully
echo ""
echo "🛑 Stopping Vehicle Edge Runtime container..."
docker exec "$CONTAINER" bash -c "docker stop vehicle-edge-runtime 2>/dev/null || true"

# Wait for graceful shutdown
sleep 5

# Remove container
echo "🗑️  Removing Vehicle Edge Runtime container..."
docker exec "$CONTAINER" bash -c "docker rm vehicle-edge-runtime 2>/dev/null || true"

# Check if container is still running
REMAINING_CONTAINER=$(docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep 'vehicle-edge-runtime' | wc -l" || echo "0")

if [[ $REMAINING_CONTAINER -eq 0 ]]; then
    print_status "OK" "Docker Vehicle Edge Runtime stopped successfully"
else
    print_status "WARN" "$REMAINING_CONTAINER container(s) still running"
    echo "Remaining containers:"
    docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}\t{{.Status}}'" | grep 'vehicle-edge-runtime' || echo "None found"
fi

# Force cleanup if requested
if [[ "${1:-}" == "--force" ]]; then
    echo "Force removing container..."
    docker exec "$CONTAINER" bash -c "docker rm -f vehicle-edge-runtime 2>/dev/null || true"
    print_status "OK" "Force cleanup completed"
fi

echo ""
echo "🔗 External Kit Manager Status:"
if curl -s --max-time 3 http://localhost:3090/listAllKits >/dev/null 2>&1; then
    print_status "INFO" "External Kit Manager is still running"
    echo "  To stop it: ./1a-stop-kit-manager.sh"
else
    print_status "INFO" "External Kit Manager is not accessible"
fi

echo ""
echo "🛠️  Remaining Services:"
echo "  Stop Kit Manager: ./1a-stop-kit-manager.sh"
echo "  Access shell: docker exec -it $CONTAINER su pi -c bash"
echo ""
echo "Docker Commands:"
echo "  View all containers: docker exec $CONTAINER docker ps -a"
echo "  View images: docker exec $CONTAINER docker images"