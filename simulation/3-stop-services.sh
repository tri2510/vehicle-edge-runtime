#!/bin/bash
# Stop Vehicle Edge Runtime services in pi-ci container
# Supports both native Node.js and Docker container modes

set -euo pipefail

CONTAINER="vehicle-edge-pi"
MODE="${1:-auto}"  # Options: native, docker, auto
FORCE_FLAG=""

# Parse arguments
for arg in "$@"; do
    case "$arg" in
        --force)
            FORCE_FLAG="--force"
            ;;
        native|docker|auto)
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
    exit 1
fi

# Function to detect running mode
detect_mode() {
    if docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -E 'kit-manager|vehicle-edge-runtime' >/dev/null 2>&1"; then
        echo "docker"
    elif docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' >/dev/null 2>&1"; then
        echo "native"
    else
        echo "none"
    fi
}

# Auto-detect mode if needed
if [[ "$MODE" == "auto" ]]; then
    MODE=$(detect_mode)
    if [[ "$MODE" == "none" ]]; then
        echo "No Vehicle Edge Runtime services are currently running"
        echo ""
        echo "Usage: $0 [native|docker|auto] [--force]"
        echo "  native  - Stop native Node.js processes"
        echo "  docker  - Stop Docker containers"
        echo "  auto    - Auto-detect and stop running services (default)"
        echo "  --force - Force stop all processes"
        exit 0
    fi
fi

# Validate mode
if [[ "$MODE" != "native" && "$MODE" != "docker" ]]; then
    echo "Invalid mode: $MODE"
    echo "Usage: $0 [native|docker|auto] [--force]"
    exit 1
fi

echo "Stopping Vehicle Edge Runtime services in $MODE mode..."

# Function to stop native services
stop_native_services() {
    # Check if any native services are running
    RUNNING_PROCESSES=$(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null | wc -l" || echo "0")

    if [[ $RUNNING_PROCESSES -eq 0 ]]; then
        echo "No native Vehicle Edge Runtime services are running"
        return 0
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
        echo "✅ Native Vehicle Edge Runtime services stopped successfully"
        return 0
    else
        echo "⚠️  $FINAL_PROCESSES native process(es) still running"
        docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null" || echo "None found"
        return 1
    fi
}

# Function to stop Docker services
stop_docker_services() {
    # Check if Docker is available
    if ! docker exec "$CONTAINER" command -v docker >/dev/null 2>&1; then
        echo "Docker is not available in simulation container"
        return 1
    fi

    # Check if any Docker containers are running
    RUNNING_CONTAINERS=$(docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -E 'kit-manager|vehicle-edge-runtime' | wc -l" || echo "0")

    if [[ $RUNNING_CONTAINERS -eq 0 ]]; then
        echo "No Docker Vehicle Edge Runtime services are running"
        return 0
    fi

    echo "Found $RUNNING_CONTAINERS running Vehicle Edge Runtime container(s)"

    # Stop containers gracefully
    echo "Stopping Docker containers..."
    docker exec "$CONTAINER" bash -c "docker stop kit-manager vehicle-edge-runtime 2>/dev/null || true"

    # Wait for graceful shutdown
    sleep 5

    # Remove containers
    echo "Removing Docker containers..."
    docker exec "$CONTAINER" bash -c "docker rm kit-manager vehicle-edge-runtime 2>/dev/null || true"

    # Check if containers are still running
    REMAINING_CONTAINERS=$(docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -E 'kit-manager|vehicle-edge-runtime' | wc -l" || echo "0")

    if [[ $REMAINING_CONTAINERS -eq 0 ]]; then
        echo "✅ Docker Vehicle Edge Runtime services stopped successfully"
        return 0
    else
        echo "⚠️  $REMAINING_CONTAINERS container(s) still running"
        docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -E 'kit-manager|vehicle-edge-runtime'" || echo "None found"
        return 1
    fi
}

# Function to force cleanup
force_cleanup() {
    echo "Performing force cleanup..."

    if [[ "$MODE" == "native" || "$MODE" == "auto" ]]; then
        echo "Force stopping all native Node.js processes..."
        docker exec "$CONTAINER" bash -c "pkill -9 node" 2>/dev/null || true
    fi

    if [[ "$MODE" == "docker" || "$MODE" == "auto" ]]; then
        if docker exec "$CONTAINER" command -v docker >/dev/null 2>&1; then
            echo "Force removing all Docker containers..."
            docker exec "$CONTAINER" bash -c "docker rm -f kit-manager vehicle-edge-runtime 2>/dev/null || true"
        fi
    fi

    echo "✅ Force cleanup completed"
}

# Stop services based on mode
STOP_SUCCESS=true

case "$MODE" in
    "native")
        if ! stop_native_services; then
            STOP_SUCCESS=false
        fi
        ;;
    "docker")
        if ! stop_docker_services; then
            STOP_SUCCESS=false
        fi
        ;;
esac

# Force cleanup if requested
if [[ "$FORCE_FLAG" == "--force" ]]; then
    force_cleanup
fi

# Check final status
echo ""
echo "Final service status:"

# Check native processes
NATIVE_PROCESSES=$(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null | wc -l" || echo "0")
echo "  Native processes: $NATIVE_PROCESSES running"

# Check Docker containers
if docker exec "$CONTAINER" command -v docker >/dev/null 2>&1; then
    DOCKER_CONTAINERS=$(docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -E 'kit-manager|vehicle-edge-runtime' | wc -l" || echo "0")
    echo "  Docker containers: $DOCKER_CONTAINERS running"
else
    echo "  Docker containers: Not available"
fi

echo ""

# Show overall result
if [[ "$STOP_SUCCESS" == "true" ]] && [[ $NATIVE_PROCESSES -eq 0 ]] && [[ ${DOCKER_CONTAINERS:-0} -eq 0 ]]; then
    echo "🎉 All Vehicle Edge Runtime services stopped successfully!"
else
    echo "⚠️  Some services may still be running"
fi

echo ""
echo "Available commands:"
echo "  Start services: ./2-start-services.sh [native|docker]"
echo "  Check status: ./4-check-status.sh [native|docker|auto]"
echo "  Access shell: docker exec -it $CONTAINER su pi -c bash"
echo ""
echo "Mode Selection:"
echo "  Native mode: Stops Node.js processes directly"
echo "  Docker mode: Stops Docker containers (visible to LazyDocker)"
echo "  Auto mode: Auto-detects and stops running services (default)"