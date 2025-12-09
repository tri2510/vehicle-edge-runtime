#!/bin/bash
# Start Kit Manager Docker container inside simulation container

set -euo pipefail

CONTAINER="vehicle-edge-pi"
KIT_MANAGER_CONTAINER="kit-manager"

print_status() {
    local status=$1
    local msg=$2
    case $status in
        OK) echo -e "\033[0;32m✅ $msg\033[0m" ;;
        WARN) echo -e "\033[1;33m⚠️  $msg\033[0m" ;;
        ERROR) echo -e "\033[0;31m❌ $msg\033[0m" ;;
    esac
}

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    print_status ERROR "Container $CONTAINER not running"
    echo "Start with: ./0-start-pi-ci.sh"
    exit 1
fi

# Check if runtime is installed
if ! docker exec "$CONTAINER" test -f /home/pi/vehicle-edge-runtime/workspace/package.json; then
    print_status ERROR "Runtime not installed"
    echo "Install with: ./1a-install-runtime-simulated.sh"
    exit 1
fi

# Stop existing Kit Manager
if docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -q '$KIT_MANAGER_CONTAINER'" 2>/dev/null; then
    print_status WARN "Kit Manager already running, stopping..."
    docker exec "$CONTAINER" docker stop "$KIT_MANAGER_CONTAINER" 2>/dev/null || true
    docker exec "$CONTAINER" docker rm "$KIT_MANAGER_CONTAINER" 2>/dev/null || true
fi

echo "Starting Kit Manager inside $CONTAINER..."

# Install Docker in container if needed
if ! docker exec "$CONTAINER" command -v docker >/dev/null 2>&1; then
    print_status INFO "Installing Docker in container..."
    docker exec "$CONTAINER" bash -c "
        export DEBIAN_FRONTEND=noninteractive
        apt-get update
        apt-get install -y ca-certificates curl gnupg
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo \"\$VERSION_CODENAME\") stable\" > /etc/apt/sources.list.d/docker.list
        apt-get update
        apt-get install -y docker-ce docker-ce-cli containerd.io
        usermod -aG docker pi
    "
fi

# Build Kit Manager image
print_status INFO "Building Kit Manager image..."
docker exec "$CONTAINER" bash -c "
    cd /home/pi/vehicle-edge-runtime/workspace/Kit-Manager
    docker build -t kit-manager:sim .
"

# Start Kit Manager
print_status INFO "Starting Kit Manager container..."
docker exec "$CONTAINER" docker run -d \
    --name "$KIT_MANAGER_CONTAINER" \
    --network bridge \
    -p 3090:3090 \
    kit-manager:sim

# Wait for startup
sleep 5

# Check if running
if docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -q '$KIT_MANAGER_CONTAINER'"; then
    print_status OK "Kit Manager started successfully"

    # Test API
    for i in {1..10}; do
        if curl -s http://localhost:3090/listAllKits >/dev/null 2>&1; then
            print_status OK "Kit Manager API responding"
            break
        fi
        sleep 1
    done

    echo "Kit Manager available at: http://localhost:3090"
else
    print_status ERROR "Failed to start Kit Manager"
    docker exec "$CONTAINER" docker logs "$KIT_MANAGER_CONTAINER" 2>&1 | tail -10
    exit 1
fi