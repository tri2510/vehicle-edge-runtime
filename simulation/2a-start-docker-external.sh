#!/bin/bash
# Start Vehicle Edge Runtime in Docker mode with external Kit Manager
# Runtime runs in Docker container, Kit Manager runs separately

set -euo pipefail

CONTAINER="vehicle-edge-pi"
NETWORK_NAME="vehicle-edge-network"

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
    echo "Restarting Docker services..."
    docker exec "$CONTAINER" bash -c "docker stop vehicle-edge-runtime 2>/dev/null || true"
    docker exec "$CONTAINER" bash -c "docker rm vehicle-edge-runtime 2>/dev/null || true"
    sleep 3
else
    # Check if services are already running
    if docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep 'vehicle-edge-runtime' >/dev/null 2>&1"; then
        echo "Docker Vehicle Edge Runtime is already running"
        echo "Stop it first or use --restart flag"
        echo ""
        echo "Running containers:"
        docker exec "$CONTAINER" bash -c "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" | grep 'vehicle-edge-runtime' || echo "None found"
        exit 1
    fi
fi

echo ""
echo "🚀 Starting Vehicle Edge Runtime in DOCKER mode with external Kit Manager..."
echo "  - Runtime will run in Docker container inside $CONTAINER"
echo "  - Kit Manager runs externally (port 3090)"
echo "  - Runtime connects to external Kit Manager"
echo ""

# Install Docker if not present
if ! docker exec "$CONTAINER" command -v docker >/dev/null 2>&1; then
    echo "Docker not found, installing..."
    docker exec "$CONTAINER" bash -c "
        export DEBIAN_FRONTEND=noninteractive &&
        apt-get update &&
        apt-get install -y ca-certificates curl gnupg &&
        install -m 0755 -d /etc/apt/keyrings

        # Try GPG method first
        if curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null; then
            chmod a+r /etc/apt/keyrings/docker.gpg &&
            echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo \"\$VERSION_CODENAME\") stable\" > /etc/apt/sources.list.d/docker.list &&
            apt-get update &&
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        else
            echo \"GPG failed, trying alternative installation...\" &&
            curl -fsSL https://get.docker.com -o get-docker.sh &&
            sh get-docker.sh --dry-run &&
            curl -fsSL https://get.docker.com | sh
        fi
    " || {
        print_status "ERROR" "Failed to install Docker"
        exit 1
    }

    # Add pi user to docker group for permissions
    echo "Setting Docker permissions..."
    docker exec "$CONTAINER" bash -c "usermod -aG docker pi" || echo "User group modification failed (may already exist)"

    # Start Docker daemon
    echo "Starting Docker daemon..."
    docker exec -d "$CONTAINER" bash -c "dockerd --host=unix:///var/run/docker.sock"

    # Wait for Docker daemon to start
    sleep 10

    # Verify Docker is working
    if ! docker exec "$CONTAINER" docker ps >/dev/null 2>&1; then
        print_status "ERROR" "Failed to start Docker daemon"
        exit 1
    fi

    print_status "OK" "Docker installed and started successfully"
else
    print_status "OK" "Docker is already available"
fi

# Connect the container to the external Kit Manager network
echo "🔧 Connecting container to external Kit Manager network..."
if ! docker network ls --format '{{.Name}}' | grep -q "^$NETWORK_NAME$"; then
    print_status "WARN" "Vehicle Edge network not found - this should be created by Kit Manager"
    print_status "INFO" "Creating network..."
    docker network create "$NETWORK_NAME"
fi

docker network connect "$NETWORK_NAME" "$CONTAINER" 2>/dev/null || print_status "INFO" "Container already connected to network"

echo "Building Docker image..."

# Build Vehicle Edge Runtime image
echo "Building Vehicle Edge Runtime image..."
docker exec "$CONTAINER" bash -c "
    cd /home/pi/vehicle-edge-runtime/workspace &&
    docker build -f Dockerfile.runtime -t vehicle-edge-runtime:sim .
" || {
    print_status "ERROR" "Failed to build Vehicle Edge Runtime image"
    exit 1
}

echo "✅ Docker image built successfully"

echo "Starting Docker container..."

# Create data directory
docker exec "$CONTAINER" bash -c "
    mkdir -p /home/pi/vehicle-edge-runtime/workspace/data
    chown -R 1001:1001 /home/pi/vehicle-edge-runtime/workspace/data
"

# Start Vehicle Edge Runtime container
echo "Starting Vehicle Edge Runtime container..."
docker exec "$CONTAINER" bash -c "
    docker run -d \
        --name vehicle-edge-runtime \
        --network $NETWORK_NAME \
        -p 3002:3002 \
        -p 3003:3003 \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v /home/pi/vehicle-edge-runtime/workspace/data:/app/data \
        -e KIT_MANAGER_URL=ws://kit-manager-standalone:3090 \
        -e PORT=3002 \
        -e LOG_LEVEL=info \
        -e DATA_PATH=/app/data \
        -e SKIP_KUKSA=true \
        --user root \
        vehicle-edge-runtime:sim
" || {
    print_status "ERROR" "Failed to start Vehicle Edge Runtime container"
    exit 1
}

echo "✅ Docker container started successfully"

# Wait for services to initialize
echo ""
echo "Waiting for services to initialize..."
sleep 5

# Check if container is running
if docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep 'vehicle-edge-runtime' >/dev/null 2>&1"; then
    echo "✅ Docker container is running"
    echo ""
    echo "📋 Docker Containers:"
    docker exec "$CONTAINER" bash -c "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
else
    echo "❌ Failed to start Docker container"
    echo "Checking logs..."
    docker exec "$CONTAINER" bash -c "docker logs vehicle-edge-runtime 2>&1 | tail -10" || true
    exit 1
fi

# Check service health
echo "Checking service health..."
for i in {1..10}; do
    if docker exec "$CONTAINER" bash -c "docker exec vehicle-edge-runtime curl -s http://localhost:3003/health >/dev/null 2>&1"; then
        echo "✅ Health endpoint responding"
        break
    fi
    if [[ $i -eq 10 ]]; then
        echo "⚠️  Health endpoint not responding yet, but service is starting"
    fi
    sleep 2
done

echo ""
echo "🎉 Vehicle Edge Runtime is running in DOCKER mode with external Kit Manager!"
echo ""
echo "Service Access (from inside simulation container):"
echo "  Runtime Health: http://localhost:3003/health"
echo "  WebSocket API: ws://localhost:3002/runtime"
echo ""
echo "🐳 Docker Container Management:"
echo "  View containers: docker exec $CONTAINER docker ps"
echo "  View Runtime logs: docker exec $CONTAINER docker logs vehicle-edge-runtime -f"
echo "  Access Runtime: docker exec -it $CONTAINER docker exec -it vehicle-edge-runtime bash"
echo ""
echo "🔗 External Kit Manager:"
echo "  API: http://localhost:3090/listAllKits"
echo "  WebSocket: ws://localhost:3090"
echo "  Status: Check registration with 'curl -s http://localhost:3090/listAllKits | jq .'"
echo ""
echo "🛠️  Management Commands:"
echo "  Stop services: ./3a-stop-docker-external.sh"
echo "  Restart: ./2a-start-docker-external.sh --restart"
echo "  Access shell: docker exec -it $CONTAINER su pi -c bash"
echo ""
echo "📖 Mode Information:"
echo "  This is DOCKER mode with EXTERNAL Kit Manager"
echo "  • Runtime runs in container inside simulation container"
echo "  • Kit Manager runs independently for better isolation"
echo "  • Clean separation of services"
echo "  • Production-like deployment architecture"