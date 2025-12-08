#!/bin/bash
# Stop Vehicle Edge Runtime services running in Native mode with external Kit Manager

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

echo "🛑 Stopping Native Vehicle Edge Runtime services with external Kit Manager..."

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    print_status "ERROR" "Container $CONTAINER is not running"
    exit 1
fi

# Check if native process is running
NATIVE_PROCESSES=$(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null | wc -l" || echo "0")

if [[ $NATIVE_PROCESSES -eq 0 ]]; then
    print_status "INFO" "No native Vehicle Edge Runtime processes are running"
    echo ""
    echo "Current Node.js processes:"
    docker exec "$CONTAINER" bash -c "ps aux | grep node | grep -v grep || echo 'None found'"
    exit 0
fi

print_status "OK" "Found $NATIVE_PROCESSES running Vehicle Edge Runtime process(es)"
echo "Current processes:"
docker exec "$CONTAINER" bash -c "
    ps aux | grep 'node src/index.js' | grep -v grep | while read line; do
        echo '  PID: '$(echo $line | awk '{print $2}')' - '$(echo $line | awk '{for(i=11;i<=NF;i++) printf $i\" \"; print \"\"}')
    done
"

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

# Stop native processes gracefully
echo ""
echo "🛑 Stopping Vehicle Edge Runtime processes..."
docker exec "$CONTAINER" bash -c "pkill -f 'node src/index.js' 2>/dev/null || true"

# Wait for graceful shutdown
sleep 3

# Check if processes are still running
REMAINING_PROCESSES=$(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null | wc -l" || echo "0")

if [[ $REMAINING_PROCESSES -eq 0 ]]; then
    print_status "OK" "Native Vehicle Edge Runtime processes stopped successfully"
else
    print_status "WARN" "$REMAINING_PROCESSES process(es) still running"
    echo "Remaining processes:"
    docker exec "$CONTAINER" bash -c "
        ps aux | grep 'node src/index.js' | grep -v grep | while read line; do
            echo '  PID: '$(echo $line | awk '{print $2}')' - '$(echo $line | awk '{for(i=11;i<=NF;i++) printf $i\" \"; print \"\"}')
        done
    "
fi

# Force cleanup if requested
if [[ "${1:-}" == "--force" ]]; then
    echo "Force stopping processes..."
    docker exec "$CONTAINER" bash -c "pkill -9 -f 'node src/index.js' 2>/dev/null || true"
    print_status "OK" "Force cleanup completed"
fi

# Show recent logs
echo ""
echo "📋 Recent Runtime Logs:"
docker exec "$CONTAINER" bash -c "
    if [ -f /home/pi/vehicle-edge-runtime/workspace/data/logs/runtime.log ]; then
        echo 'Last 10 lines of runtime log:'
        tail -10 /home/pi/vehicle-edge-runtime/workspace/data/logs/runtime.log
    else
        echo 'Log file not found'
    fi
"

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
echo "Data Status:"
echo "  Data directory: /home/pi/vehicle-edge-runtime/workspace/data/"
docker exec "$CONTAINER" bash -c "
    if [ -d '/home/pi/vehicle-edge-runtime/workspace/data' ]; then
        echo '  Files in data directory:'
        ls -la /home/pi/vehicle-edge-runtime/workspace/data/ 2>/dev/null | head -5 || echo '    Directory empty'
    else
        echo '  Data directory not found'
    fi
"