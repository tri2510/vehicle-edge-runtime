#!/bin/bash
# Stop all Vehicle Edge services

set -euo pipefail

print_status() {
    local status=$1
    local msg=$2
    case $status in
        OK) echo -e "\033[0;32m✅ $msg\033[0m" ;;
        WARN) echo -e "\033[1;33m⚠️  $msg\033[0m" ;;
        ERROR) echo -e "\033[0;31m❌ $msg\033[0m" ;;
    esac
}

echo "🛑 Stopping all Vehicle Edge services..."

# Stop all runtime instances
RUNTIME_CONTAINERS=$(docker ps --format '{{.Names}}' | grep '^vehicle-edge-runtime[a-zA-Z]*$' || true)
if [[ -n "$RUNTIME_CONTAINERS" ]]; then
    echo "Stopping runtime instances..."
    echo "$RUNTIME_CONTAINERS" | xargs -r docker stop >/dev/null
    echo "$RUNTIME_CONTAINERS" | xargs -r docker rm >/dev/null
    print_status OK "Runtime instances stopped"
fi

# Stop Kit Manager
if docker ps --format '{{.Names}}' | grep -q "^kit-manager$"; then
    echo "Stopping Kit Manager..."
    docker stop kit-manager >/dev/null
    docker rm kit-manager >/dev/null
    print_status OK "Kit Manager stopped"
fi

# Remove network (optional)
if docker network ls | grep -q "vehicle-edge-network"; then
    echo "Removing vehicle-edge-network..."
    docker network rm vehicle-edge-network >/dev/null 2>&1 || true
    print_status OK "Network removed"
fi

print_status OK "All services stopped"