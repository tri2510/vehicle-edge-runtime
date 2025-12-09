#!/bin/bash
# Stop Vehicle Edge Runtime instances

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

# Check for specific instance ID or stop all
if [[ $# -eq 1 && "$1" =~ ^[a-zA-Z]+$ ]]; then
    INSTANCE_ID="$1"
    CONTAINER="vehicle-edge-runtime${INSTANCE_ID}"

    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
        echo "Stopping Vehicle Edge Runtime ${INSTANCE_ID}..."
        docker stop "$CONTAINER" >/dev/null
        docker rm "$CONTAINER" >/dev/null
        print_status OK "Runtime ${INSTANCE_ID} stopped"
    else
        print_status WARN "Runtime ${INSTANCE_ID} not running"
    fi
else
    # Stop all runtime instances
    echo "Stopping all Vehicle Edge Runtime instances..."

    RUNTIME_CONTAINERS=$(docker ps --format '{{.Names}}' | grep '^vehicle-edge-runtime[a-zA-Z]*$' || true)

    if [[ -n "$RUNTIME_CONTAINERS" ]]; then
        echo "$RUNTIME_CONTAINERS" | xargs -r docker stop >/dev/null
        echo "$RUNTIME_CONTAINERS" | xargs -r docker rm >/dev/null
        print_status OK "All runtime instances stopped"
    else
        print_status WARN "No runtime instances running"
    fi
fi