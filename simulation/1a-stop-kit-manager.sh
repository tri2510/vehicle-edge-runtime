#!/bin/bash
# Stop Standalone Kit Manager

set -euo pipefail

KIT_MANAGER_CONTAINER="kit-manager-standalone"

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

echo "🛑 Stopping Standalone Kit Manager..."

# Check if Kit Manager container is running
if ! docker ps --format '{{.Names}}' | grep -q "^$KIT_MANAGER_CONTAINER$"; then
    if docker ps -a --format '{{.Names}}' | grep -q "^$KIT_MANAGER_CONTAINER$"; then
        print_status "WARN" "Kit Manager container exists but is not running"
    else
        print_status "INFO" "Kit Manager container not found"
    fi
    echo ""
    echo "📊 Available containers:"
    docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep -E "(kit-manager|runtime)" || echo "No matching containers found"
    exit 0
fi

print_status "OK" "Found running Kit Manager container"

# Show final status before stopping
echo ""
echo "📊 Final Kit Manager Status:"
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

CLIENTS_RESPONSE=$(curl -s http://localhost:3090/listAllClient 2>/dev/null || echo '{"content": []}')
if echo "$CLIENTS_RESPONSE" | jq -e '.content' >/dev/null 2>&1; then
    CLIENT_COUNT=$(echo "$CLIENTS_RESPONSE" | jq -r '.content | length' 2>/dev/null || echo "0")
    echo "  Connected clients: $CLIENT_COUNT"
else
    echo "  Could not retrieve client status"
fi

# Stop the Kit Manager container
echo ""
echo "🛑 Stopping Kit Manager container..."
docker stop "$KIT_MANAGER_CONTAINER"

if [ $? -eq 0 ]; then
    print_status "OK" "Kit Manager container stopped successfully"
else
    print_status "ERROR" "Failed to stop Kit Manager container"
    exit 1
fi

# Remove the container
echo "🗑️  Removing Kit Manager container..."
docker rm "$KIT_MANAGER_CONTAINER"

if [ $? -eq 0 ]; then
    print_status "OK" "Kit Manager container removed successfully"
else
    print_status "WARN" "Failed to remove Kit Manager container (may already be removed)"
fi

# Test that the service is no longer accessible
echo ""
echo "🔍 Verifying service shutdown..."
sleep 2

if ! curl -s --max-time 3 "http://localhost:3090/listAllKits" >/dev/null 2>&1; then
    print_status "OK" "Kit Manager service is no longer accessible"
else
    print_status "WARN" "Kit Manager service still responding (may be another instance)"
fi

echo ""
echo "✅ Standalone Kit Manager has been stopped successfully!"
echo ""
echo "🔗 What's Next:"
echo "  • Start Kit Manager again: ./1a-start-kit-manager.sh"
echo "  • Check remaining containers: docker ps | grep -E '(kit-manager|runtime)'"
echo "  • Clean up Docker network when not needed: docker network rm vehicle-edge-network"
echo ""
echo "📖 Note:"
echo "  Any Vehicle Edge Runtime instances connected to this Kit Manager"
echo "  will show as disconnected and should be stopped or restarted."