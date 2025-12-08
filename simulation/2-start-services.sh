#!/bin/bash
# Start Vehicle Edge Runtime services in pi-ci container
# Supports both native Node.js execution and Docker container execution

set -euo pipefail

CONTAINER="vehicle-edge-pi"
MODE="${1:-native}"  # Options: native, docker
RESTART_FLAG=""

# Parse arguments
for arg in "$@"; do
    case "$arg" in
        --restart)
            RESTART_FLAG="--restart"
            ;;
        native|docker)
            MODE="$arg"
            ;;
        *)
            echo "Unknown argument: $arg"
            exit 1
            ;;
    esac
done

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

# Validate mode
if [[ "$MODE" != "native" && "$MODE" != "docker" ]]; then
    echo "Invalid mode: $MODE"
    echo "Usage: $0 [native|docker] [--restart]"
    exit 1
fi

# Function to check if services are running
check_services_running() {
    local mode="$1"
    case "$mode" in
        "native")
            docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' >/dev/null 2>&1"
            ;;
        "docker")
            docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -E 'kit-manager|vehicle-edge-runtime' >/dev/null 2>&1"
            ;;
    esac
}

# Function to stop services
stop_services() {
    local mode="$1"
    case "$mode" in
        "native")
            echo "Stopping native Node.js services..."
            docker exec "$CONTAINER" bash -c "pkill -f 'node src/index.js' 2>/dev/null || true"
            ;;
        "docker")
            echo "Stopping Docker containers..."
            docker exec "$CONTAINER" bash -c "docker stop kit-manager vehicle-edge-runtime 2>/dev/null || true"
            docker exec "$CONTAINER" bash -c "docker rm kit-manager vehicle-edge-runtime 2>/dev/null || true"
            ;;
    esac
}

# Function to start native services
start_native_services() {
    echo "Starting services in NATIVE mode..."
    echo "  - Kit Manager and Vehicle Edge Runtime will run as Node.js processes"
    echo "  - Services will not be visible to LazyDocker"
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
}

# Function to start Docker services
start_docker_services() {
    echo "Starting services in DOCKER mode..."
    echo "  - Services will run in Docker containers"
    echo "  - Services will be visible to LazyDocker"
    echo "  - Installing Docker in simulation container..."
    echo ""

    # Install Docker if not present
    if ! docker exec "$CONTAINER" command -v docker >/dev/null 2>&1; then
        echo "Docker not found, installing..."
        docker exec "$CONTAINER" bash -c "
            apt-get update &&
            apt-get install -y ca-certificates curl gnupg &&
            install -m 0755 -d /etc/apt/keyrings &&
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg &&
            chmod a+r /etc/apt/keyrings/docker.gpg &&
            echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo \"\$VERSION_CODENAME\") stable\" > /etc/apt/sources.list.d/docker.list &&
            apt-get update &&
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        "

        # Start Docker daemon
        echo "Starting Docker daemon..."
        docker exec -d "$CONTAINER" bash -c "dockerd --host=unix:///var/run/docker.sock"

        # Wait for Docker daemon to start
        sleep 10

        # Verify Docker is working
        if ! docker exec "$CONTAINER" docker ps >/dev/null 2>&1; then
            echo "❌ Failed to start Docker daemon"
            exit 1
        fi
    fi

    echo "Building Docker images..."

    # Build Kit Manager image
    echo "Building Kit Manager image..."
    docker exec "$CONTAINER" bash -c "
        cd /home/pi/vehicle-edge-runtime/workspace/Kit-Manager &&
        su pi -c 'docker build -t kit-manager:sim .'
    " || {
        echo "❌ Failed to build Kit Manager image"
        exit 1
    }

    # Build Vehicle Edge Runtime image
    echo "Building Vehicle Edge Runtime image..."
    docker exec "$CONTAINER" bash -c "
        cd /home/pi/vehicle-edge-runtime/workspace &&
        su pi -c 'docker build -f Dockerfile.runtime -t vehicle-edge-runtime:sim .'
    " || {
        echo "❌ Failed to build Vehicle Edge Runtime image"
        exit 1
    }

    echo "Starting Docker containers..."

    # Create network
    docker exec "$CONTAINER" bash -c "
        su pi -c 'docker network create vehicle-edge-network 2>/dev/null || true'
    "

    # Create data directory
    docker exec "$CONTAINER" bash -c "
        mkdir -p /home/pi/vehicle-edge-runtime/workspace/data
    "

    # Start Kit Manager container
    echo "Starting Kit Manager container..."
    docker exec "$CONTAINER" bash -c "
        su pi -c 'docker run -d \
            --name kit-manager \
            --network vehicle-edge-network \
            -p 3090:3090 \
            kit-manager:sim'
    " || {
        echo "❌ Failed to start Kit Manager container"
        exit 1
    }

    # Wait for Kit Manager to start
    sleep 5

    # Start Vehicle Edge Runtime container
    echo "Starting Vehicle Edge Runtime container..."
    docker exec "$CONTAINER" bash -c "
        su pi -c 'docker run -d \
            --name vehicle-edge-runtime \
            --network vehicle-edge-network \
            -p 3002:3002 \
            -p 3003:3003 \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v /home/pi/vehicle-edge-runtime/workspace/data:/app/data \
            -e KIT_MANAGER_URL=ws://kit-manager:3090 \
            -e PORT=3002 \
            -e LOG_LEVEL=info \
            -e DATA_PATH=/app/data \
            -e SKIP_KUKSA=true \
            vehicle-edge-runtime:sim'
    " || {
        echo "❌ Failed to start Vehicle Edge Runtime container"
        exit 1
    }
}

# Handle restart flag
if [[ "$RESTART_FLAG" == "--restart" ]]; then
    echo "Restarting services in $MODE mode..."
    stop_services "$MODE"
    sleep 3
else
    # Check if services are already running
    if check_services_running "$MODE"; then
        echo "Services are already running in $MODE mode"
        echo "Stop them first or use --restart flag"
        echo ""
        echo "Commands:"
        echo "  Stop: ./3-stop-services.sh $MODE"
        echo "  Restart: ./2-start-services.sh $MODE --restart"
        exit 1
    fi
fi

# Start services based on mode
case "$MODE" in
    "native")
        start_native_services
        ;;
    "docker")
        start_docker_services
        ;;
esac

# Wait for services to initialize
echo ""
echo "Waiting for services to initialize..."
sleep 5

# Check if services are running
if check_services_running "$MODE"; then
    echo "✅ Services started successfully in $MODE mode"
else
    echo "❌ Failed to start services in $MODE mode"
    if [[ "$MODE" == "native" ]]; then
        docker exec "$CONTAINER" tail -10 /home/pi/vehicle-edge-runtime/workspace/data/logs/*.log 2>/dev/null || true
    else
        docker exec "$CONTAINER" bash -c "docker logs kit-manager 2>&1 | tail -10" || true
        docker exec "$CONTAINER" bash -c "docker logs vehicle-edge-runtime 2>&1 | tail -10" || true
    fi
    exit 1
fi

# Check service health
echo "Checking service health..."
HEALTH_CHECK_PASSED=false

if [[ "$MODE" == "native" ]]; then
    for i in {1..10}; do
        if docker exec "$CONTAINER" bash -c "curl -s --max-time 2 http://localhost:3003/health >/dev/null 2>&1"; then
            echo "✅ Health endpoint responding"
            HEALTH_CHECK_PASSED=true
            break
        fi
        if [[ $i -eq 10 ]]; then
            echo "⚠️  Health endpoint not responding yet, but service is starting"
        fi
        sleep 2
    done
elif [[ "$MODE" == "docker" ]]; then
    for i in {1..10}; do
        if docker exec "$CONTAINER" bash -c "docker exec vehicle-edge-runtime curl -s http://localhost:3003/health >/dev/null 2>&1"; then
            echo "✅ Health endpoint responding"
            HEALTH_CHECK_PASSED=true
            break
        fi
        if [[ $i -eq 10 ]]; then
            echo "⚠️  Health endpoint not responding yet, but service is starting"
        fi
        sleep 2
    done
fi

echo ""
echo "🎉 Vehicle Edge Runtime is running in $MODE mode!"
echo ""
echo "Service Access (from inside simulation container):"
echo "  Runtime Health: http://localhost:3003/health"
echo "  WebSocket API: ws://localhost:3002/runtime"
echo "  Kit Manager: http://localhost:3090"

if [[ "$MODE" == "docker" ]]; then
    echo ""
    echo "📋 Docker Containers (visible to LazyDocker):"
    echo "  Kit Manager: kit-manager"
    echo "  Vehicle Edge Runtime: vehicle-edge-runtime"
    echo ""
    echo "🐳 Docker Commands:"
    docker exec "$CONTAINER" bash -c "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
else
    echo ""
    echo "💻 Native Processes:"
    echo "  Run 'docker exec $CONTAINER ps aux | grep node' to see PIDs"
fi

echo ""
echo "🛠️  Management Commands:"
if [[ "$MODE" == "docker" ]]; then
    echo "  View Kit Manager logs: docker exec $CONTAINER docker logs kit-manager -f"
    echo "  View Runtime logs: docker exec $CONTAINER docker logs vehicle-edge-runtime -f"
    echo "  Stop services: ./3-stop-services.sh docker"
    echo "  Check status: ./4-check-status.sh docker"
else
    echo "  View logs: docker exec $CONTAINER su pi -c 'tail -f /home/pi/vehicle-edge-runtime/workspace/data/logs/*.log'"
    echo "  Stop services: ./3-stop-services.sh native"
    echo "  Check status: ./4-check-status.sh native"
fi
echo "  Access shell: docker exec -it $CONTAINER su pi -c bash"
echo "  Restart: ./2-start-services.sh $MODE --restart"
echo ""
echo "📖 Mode Selection:"
echo "  Native mode: Direct Node.js execution (faster, good for testing)"
echo "  Docker mode: Containerized services (visible to LazyDocker, production-like)"