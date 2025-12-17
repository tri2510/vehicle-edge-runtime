#!/bin/bash
# ==============================================================================
# Vehicle Edge Runtime Docker Development Start Script
# Quick development startup using Docker with default settings
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTAINER_NAME="vehicle-edge-runtime-dev"
IMAGE_NAME="vehicle-edge-runtime:dev"
PORT="3002"
HEALTH_PORT="3003"

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        exit 1
    fi

    success "Docker is available"
}

# Clean up existing container
cleanup_container() {
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log "Removing existing container: ${CONTAINER_NAME}"
        docker stop "${CONTAINER_NAME}" 2>/dev/null || true
        docker rm "${CONTAINER_NAME}" 2>/dev/null || true
    fi
}

# Build Docker image
build_image() {
    log "Building Docker image: ${IMAGE_NAME}"

    cd "$PROJECT_DIR"

    # Check if Dockerfile exists
    if [ ! -f "Dockerfile" ]; then
        error "Dockerfile not found in project directory"
        exit 1
    fi

    # Build the image
    if docker build -t "${IMAGE_NAME}" .; then
        success "Docker image built successfully"
    else
        error "Failed to build Docker image"
        exit 1
    fi
}

# Start container
start_container() {
    log "Starting Vehicle Edge Runtime container..."
    log "Kit Manager: ${ENABLE_KIT_MANAGER}"
    log "Kuksa: ${ENABLE_KUKSA}"

    # Create data directory
    mkdir -p "${PROJECT_DIR}/data"

    # Set environment variables based on options
    local env_args=(
        -e NODE_ENV=development
        -e PORT=3002
        -e HEALTH_PORT=3003
        -e LOG_LEVEL=debug
        -e KIT_MANAGER_URL="${KIT_MANAGER_URL}"
        -e KUKSA_URL="${KUKSA_URL}"
    )

    # Configure Kit Manager
    if [ "$ENABLE_KIT_MANAGER" = "true" ]; then
        env_args+=(-e SKIP_KIT_MANAGER=false)
        log "Kit Manager enabled: ${KIT_MANAGER_URL}"
        # Update URL for host networking
        KIT_MANAGER_URL="ws://localhost:3090"
        env_args+=(-e KIT_MANAGER_URL="${KIT_MANAGER_URL}")
    else
        env_args+=(-e SKIP_KIT_MANAGER=true)
        log "Kit Manager disabled"
    fi

    # Configure Kuksa
    if [ "$ENABLE_KUKSA" = "true" ]; then
        env_args+=(-e SKIP_KUKSA=false -e KUKSA_ENABLED=true)
        log "Kuksa enabled: ${KUKSA_URL}"
    else
        env_args+=(-e SKIP_KUKSA=true -e KUKSA_ENABLED=false)
        log "Kuksa disabled"
    fi

    # Ensure data directory exists and has proper permissions
    mkdir -p "${PROJECT_DIR}/data/db"
    chmod 777 "${PROJECT_DIR}/data/db"

    # Build docker run command
    local docker_args=(
        --name "${CONTAINER_NAME}"
        --restart unless-stopped
        -v "${PROJECT_DIR}/data:/app/data"
        -v "${PROJECT_DIR}/data:/app/data/db"
        -v "${PROJECT_DIR}/data:/app/data/applications"
        -v /var/run/docker.sock:/var/run/docker.sock
        -e DATA_DIR="/app/data"
    )

    # Add docker group for socket access if available
    if getent group docker >/dev/null 2>&1; then
        docker_args+=(--group-add $(getent group docker | cut -d: -f3))
        log "Adding docker group for socket access"
    else
        log "Docker group not found, container will run with basic socket access"
    fi

    # Use host network when Kit Manager is enabled for easier connectivity
    if [ "$ENABLE_KIT_MANAGER" = "true" ]; then
        docker_args+=(--network=host)
        log "Using host network for Kit Manager connectivity"
    else
        docker_args+=(-p "${PORT}:3002" -p "${HEALTH_PORT}:3003")
    fi

    # Start the container
    docker run -d \
        "${docker_args[@]}" \
        "${env_args[@]}" \
        "${IMAGE_NAME}"

    if [ $? -eq 0 ]; then
        success "Container started successfully"
        show_info
    else
        error "Failed to start container"
        exit 1
    fi
}

# Show container information
show_info() {
    echo
    echo "🚀 Vehicle Edge Runtime is running!"
    echo
    echo "📊 Service Information:"
    echo "   Container Name: ${CONTAINER_NAME}"
    echo "   Image: ${IMAGE_NAME}"
    echo "   Runtime Port: ${PORT}"
    echo "   Health Port: ${HEALTH_PORT}"
    echo
    echo "🔗 Endpoints:"
    if [ "$ENABLE_KIT_MANAGER" = "true" ]; then
        echo "   Runtime API: http://localhost:3002 (host network)"
        echo "   Health Check: http://localhost:3003 (host network)"
        echo "   WebSocket: ws://localhost:3002/runtime (host network)"
    else
        echo "   Runtime API: http://localhost:${PORT}"
        echo "   Health Check: http://localhost:${HEALTH_PORT}"
        echo "   WebSocket: ws://localhost:${PORT}/runtime"
    fi
    echo
    echo "⚙️ Configuration:"
    echo "   Kit Manager: $([ "$ENABLE_KIT_MANAGER" = "true" ] && echo "✅ Enabled (ws://localhost:3090)" || echo "❌ Disabled")"
    echo "   Kuksa: $([ "$ENABLE_KUKSA" = "true" ] && echo "✅ Enabled (${KUKSA_URL})" || echo "❌ Disabled")"
    if [ "$ENABLE_KIT_MANAGER" = "true" ]; then
        echo "   Network: Host mode (for Kit Manager connectivity)"
    fi
    echo
    if [ "$ENABLE_KIT_MANAGER" = "true" ]; then
        echo "🔗 Kit Manager:"
        echo "   Check registration: curl http://localhost:3090/listAllKits"
        echo "   Deploy app: curl -X POST http://localhost:3090/deployApp -H 'Content-Type: application/json' -d '{\"to_kit_id\":\"<kit_id>\",\"code\":\"console.log(\"hello\")\"}'"
        echo
    fi
    echo "🛠️ Development Commands:"
    echo "   View logs:      docker logs -f ${CONTAINER_NAME}"
    echo "   Stop container: docker stop ${CONTAINER_NAME}"
    echo "   Remove container: docker rm ${CONTAINER_NAME}"
    echo "   View status:    docker ps | grep ${CONTAINER_NAME}"
    echo
    echo "🧪 Testing:"
    echo "   Health check: curl http://localhost:${HEALTH_PORT}"
    echo "   Runtime info:  curl http://localhost:${PORT}/runtime/info"
    echo
}

# Stop container
stop_container() {
    log "Stopping Vehicle Edge Runtime container..."

    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker stop "${CONTAINER_NAME}"
        success "Container stopped"
    else
        warning "Container is not running"
    fi
}

# Remove container
remove_container() {
    log "Removing Vehicle Edge Runtime container..."

    # Stop if running
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker stop "${CONTAINER_NAME}" 2>/dev/null || true
    fi

    # Remove if exists
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker rm "${CONTAINER_NAME}"
        success "Container removed"
    else
        warning "Container not found"
    fi
}

# Show status
show_status() {
    log "Checking Vehicle Edge Runtime status..."

    echo "📋 Container Status:"
    if docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -q "${CONTAINER_NAME}"; then
        docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep "${CONTAINER_NAME}"
    else
        echo "❌ Container is not running"
    fi

    echo
    echo "📦 Image Status:"
    if docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}' | grep -q "${IMAGE_NAME}"; then
        docker images --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}' | grep "${IMAGE_NAME}"
    else
        echo "❌ Image not found"
    fi

    # Test health endpoint
    if command -v curl &> /dev/null; then
        echo
        echo "🏥 Health Check:"
        if curl -s "http://localhost:${HEALTH_PORT}" > /dev/null 2>&1; then
            echo "✅ Health endpoint responding"
            curl -s "http://localhost:${HEALTH_PORT}" 2>/dev/null || echo "Health response unavailable"
        else
            echo "❌ Health endpoint not responding"
        fi
    fi
}

# Show logs
show_logs() {
    log "Showing Vehicle Edge Runtime logs..."
    if docker ps --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
        docker logs -f "${CONTAINER_NAME}"
    else
        error "Container is not running"
        exit 1
    fi
}

# Show usage
show_usage() {
    echo "Vehicle Edge Runtime Docker Development Script"
    echo
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo
    echo "Commands:"
    echo "  start       Build and start the runtime (default)"
    echo "  stop        Stop the running container"
    echo "  restart     Stop and restart the container"
    echo "  status      Show container status and health"
    echo "  logs        Show container logs (follow mode)"
    echo "  clean       Stop and remove container"
    echo "  help        Show this help message"
    echo
    echo "Options:"
    echo "  --skip-kit-manager     Disable Kit Manager connection (default: enabled)"
    echo "  --with-kuksa          Enable Kuksa connection (default: disabled)"
    echo "  --kit-manager-url     Set custom Kit Manager URL (default: ws://host.docker.internal:3090)"
    echo "  --kuksa-url           Set custom Kuksa URL (default: localhost:55555)"
    echo
    echo "Environment Variables:"
    echo "  ENABLE_KIT_MANAGER    Set to 'false' to disable Kit Manager (default: true)"
    echo "  ENABLE_KUKSA          Set to 'true' to enable Kuksa (default: false)"
    echo "  KIT_MANAGER_URL       Kit Manager WebSocket URL"
    echo "  KUKSA_URL             Kuksa gRPC URL"
    echo
    echo "Quick Start:"
    echo "  $0                                      # Start the runtime with Kit Manager (default)"
    echo "  $0 --skip-kit-manager                   # Start without Kit Manager (isolated)"
    echo "  $0 --with-kuksa                         # Start with both Kit Manager and Kuksa"
    echo "  ENABLE_KIT_MANAGER=false $0             # Start without Kit Manager via env var"
    echo "  $0 logs                                 # View logs"
    echo "  $0 status                               # Check status"
    echo "  $0 stop                                 # Stop when done"
    echo
}

# Default values
ENABLE_KIT_MANAGER="${ENABLE_KIT_MANAGER:-true}"
ENABLE_KUKSA="${ENABLE_KUKSA:-false}"
KIT_MANAGER_URL="${KIT_MANAGER_URL:-ws://host.docker.internal:3090}"
KUKSA_URL="${KUKSA_URL:-localhost:55555}"

# Parse command line arguments
COMMAND="start"
ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        start|stop|restart|status|logs|clean|help)
            COMMAND="$1"
            shift
            ;;
        --with-kit-manager)
            ENABLE_KIT_MANAGER="true"
            shift
            ;;
        --skip-kit-manager)
            ENABLE_KIT_MANAGER="false"
            shift
            ;;
        --with-kuksa)
            ENABLE_KUKSA="true"
            shift
            ;;
        --kit-manager-url)
            KIT_MANAGER_URL="$2"
            shift 2
            ;;
        --kuksa-url)
            KUKSA_URL="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    case "$COMMAND" in
        help|--help|-h)
            show_usage
            ;;
        start)
            check_docker
            cleanup_container
            build_image
            start_container
            ;;
        stop)
            stop_container
            ;;
        restart)
            stop_container
            sleep 2
            check_docker
            start_container
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        clean)
            remove_container
            ;;
        *)
            error "Unknown command: $COMMAND"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with error handling
handle_error() {
    error "Script failed at line $1"
    exit 1
}

trap 'handle_error $LINENO' ERR
main "$@"