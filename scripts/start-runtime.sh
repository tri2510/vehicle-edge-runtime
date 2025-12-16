#!/bin/bash
# ==============================================================================
# Vehicle Edge Runtime Start Script
# Starts the Vehicle Edge Runtime without performing setup
# Assumes setup has already been completed via setup-runtime.sh
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$HOME/.vehicle-edge-runtime-venv"
RUNTIME_PATH="$HOME/vehicle-edge-runtime"
SERVICE_NAME="vehicle-edge-runtime"
DEFAULT_PORT=3090

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

# Check if runtime is already running
check_if_running() {
    if pgrep -f "node index.js" > /dev/null 2>&1; then
        local pid=$(pgrep -f "node index.js")
        if [ -n "$pid" ]; then
            error "Vehicle Edge Runtime is already running (PID: $pid)"
            echo "Use '$0 stop' to stop the running instance first"
            exit 1
        fi
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please run ./setup-runtime.sh first"
        exit 1
    fi

    # Check if runtime directory exists
    if [ ! -d "$RUNTIME_PATH" ]; then
        error "Runtime directory not found: $RUNTIME_PATH"
        echo "Please run ./setup-runtime.sh first"
        exit 1
    fi

    # Check if index.js exists
    if [ ! -f "$RUNTIME_PATH/index.js" ]; then
        error "Runtime application not found: $RUNTIME_PATH/index.js"
        echo "Please run ./setup-runtime.sh first"
        exit 1
    fi

    # Check if port is available
    local port=${PORT:-$DEFAULT_PORT}
    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        error "Port $port is already in use"
        echo "Please choose a different port or stop the service using that port"
        exit 1
    fi

    success "Prerequisites check passed"
}

# Start runtime in foreground
start_foreground() {
    log "Starting Vehicle Edge Runtime in foreground..."

    cd "$RUNTIME_PATH"

    # Load environment variables
    if [ -f .env ]; then
        log "Loading environment variables from .env file"
        export $(grep -v '^#' .env | xargs)
    else
        warning "No .env file found, using default configuration"
    fi

    # Set default environment variables
    export PORT=${PORT:-$DEFAULT_PORT}
    export NODE_ENV=${NODE_ENV:-production}

    # Create logs directory
    mkdir -p logs

    log "Starting on port $PORT..."
    log "Press Ctrl+C to stop the runtime"
    log "API endpoint: http://localhost:$PORT"
    log "WebSocket endpoint: ws://localhost:$PORT"
    log "Health check: http://localhost:$PORT/health"

    echo

    # Start the application
    exec node index.js
}

# Start runtime as daemon
start_daemon() {
    log "Starting Vehicle Edge Runtime as daemon..."

    cd "$RUNTIME_PATH"

    # Load environment variables
    if [ -f .env ]; then
        log "Loading environment variables from .env file"
        export $(grep -v '^#' .env | xargs)
    fi

    # Set default environment variables
    export PORT=${PORT:-$DEFAULT_PORT}
    export NODE_ENV=${NODE_ENV:-production}

    # Create logs directory
    mkdir -p logs

    # Start in background with nohup
    nohup node index.js > "logs/runtime-$(date +%Y%m%d-%H%M%S).log" 2>&1 &
    local pid=$!

    # Wait a moment and check if it started successfully
    sleep 2

    if kill -0 $pid 2>/dev/null; then
        success "Vehicle Edge Runtime started successfully"
        log "PID: $pid"
        log "Port: $PORT"
        log "Log file: $RUNTIME_PATH/logs/runtime-$(date +%Y%m%d-%H%M%S).log"
        log "API endpoint: http://localhost:$PORT"
        log "Health check: http://localhost:$PORT/health"

        # Save PID to file for easy management
        echo $pid > "$RUNTIME_PATH/runtime.pid"
    else
        error "Failed to start Vehicle Edge Runtime"
        exit 1
    fi
}

# Start runtime via systemd
start_systemd() {
    log "Starting Vehicle Edge Runtime via systemd..."

    if ! systemctl is-active --quiet vehicle-edge-runtime; then
        sudo systemctl start vehicle-edge-runtime

        # Wait for service to start
        local count=0
        while [ $count -lt 10 ]; do
            if systemctl is-active --quiet vehicle-edge-runtime; then
                success "Vehicle Edge Runtime started via systemd"
                log "Status: sudo systemctl status vehicle-edge-runtime"
                log "Logs: sudo journalctl -u vehicle-edge-runtime -f"
                return 0
            fi
            sleep 1
            count=$((count + 1))
        done

        error "Failed to start Vehicle Edge Runtime via systemd"
        exit 1
    else
        warning "Vehicle Edge Runtime is already running via systemd"
        log "Status: sudo systemctl status vehicle-edge-runtime"
    fi
}

# Stop runtime
stop_runtime() {
    log "Stopping Vehicle Edge Runtime..."

    local stopped=false

    # Try to stop via systemd first
    if systemctl is-active --quiet vehicle-edge-runtime 2>/dev/null; then
        sudo systemctl stop vehicle-edge-runtime
        stopped=true
        success "Stopped Vehicle Edge Runtime via systemd"
    fi

    # Try to stop using PID file
    if [ -f "$RUNTIME_PATH/runtime.pid" ]; then
        local pid=$(cat "$RUNTIME_PATH/runtime.pid")
        if kill -0 $pid 2>/dev/null; then
            kill $pid
            rm -f "$RUNTIME_PATH/runtime.pid"
            stopped=true
            success "Stopped Vehicle Edge Runtime (PID: $pid)"
        else
            rm -f "$RUNTIME_PATH/runtime.pid"
        fi
    fi

    # Try to stop any remaining node processes
    if pgrep -f "node index.js" > /dev/null 2>&1; then
        local pids=$(pgrep -f "node index.js")
        for pid in $pids; do
            if kill -0 $pid 2>/dev/null; then
                kill $pid
                stopped=true
                success "Stopped Vehicle Edge Runtime process (PID: $pid)"
            fi
        done
    fi

    if [ "$stopped" = true ]; then
        success "Vehicle Edge Runtime stopped successfully"
    else
        warning "No running Vehicle Edge Runtime instance found"
    fi
}

# Check runtime status
check_status() {
    log "Checking Vehicle Edge Runtime status..."

    local running=false

    # Check systemd service
    if systemctl is-active --quiet vehicle-edge-runtime 2>/dev/null; then
        echo "✅ Vehicle Edge Runtime is running via systemd"
        sudo systemctl status vehicle-edge-runtime --no-pager
        running=true
    fi

    # Check PID file
    if [ -f "$RUNTIME_PATH/runtime.pid" ]; then
        local pid=$(cat "$RUNTIME_PATH/runtime.pid")
        if kill -0 $pid 2>/dev/null; then
            echo "✅ Vehicle Edge Runtime is running as daemon (PID: $pid)"
            running=true
        else
            echo "❌ PID file exists but process is not running"
            rm -f "$RUNTIME_PATH/runtime.pid"
        fi
    fi

    # Check for running node processes
    if pgrep -f "node index.js" > /dev/null 2>&1; then
        local pids=$(pgrep -f "node index.js")
        echo "✅ Vehicle Edge Runtime processes found: $pids"
        running=true
    fi

    if [ "$running" = false ]; then
        echo "❌ Vehicle Edge Runtime is not running"
        return 1
    fi

    # Test health endpoint if running
    local port=${PORT:-$DEFAULT_PORT}
    if command -v curl &> /dev/null; then
        if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
            echo "✅ Health check endpoint is responding"
            curl -s "http://localhost:$port/health" | python3 -m json.tool 2>/dev/null || curl -s "http://localhost:$port/health"
        else
            warning "Health check endpoint is not responding"
        fi
    fi
}

# Show usage
show_usage() {
    echo "Vehicle Edge Runtime Start Script"
    echo
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo
    echo "Commands:"
    echo "  start       Start runtime in foreground (default)"
    echo "  daemon      Start runtime as background daemon"
    echo "  systemd     Start runtime via systemd service"
    echo "  stop        Stop running runtime"
    echo "  status      Check runtime status"
    echo "  help        Show this help message"
    echo
    echo "Options:"
    echo "  -p, --port PORT    Set custom port (default: 3090)"
    echo "  -e, --env ENV      Set environment (default: production)"
    echo
    echo "Examples:"
    echo "  $0                          # Start in foreground"
    echo "  $0 daemon                   # Start as daemon"
    echo "  $0 systemd                  # Start via systemd"
    echo "  $0 stop                     # Stop runtime"
    echo "  $0 status                   # Check status"
    echo "  $0 -p 8080                  # Start on port 8080"
    echo "  PORT=8080 $0 daemon         # Start on port 8080 as daemon"
    echo
}

# Parse command line arguments
COMMAND="start"
PORT=""
ENV=""

while [[ $# -gt 0 ]]; do
    case $1 in
        start|daemon|systemd|stop|status|help)
            COMMAND="$1"
            shift
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -e|--env)
            ENV="$2"
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

# Set environment variables
if [ -n "$PORT" ]; then
    export PORT="$PORT"
fi
if [ -n "$ENV" ]; then
    export NODE_ENV="$ENV"
fi

# Main execution
main() {
    case "$COMMAND" in
        help)
            show_usage
            ;;
        start)
            check_if_running
            check_prerequisites
            start_foreground
            ;;
        daemon)
            check_if_running
            check_prerequisites
            start_daemon
            ;;
        systemd)
            check_prerequisites
            start_systemd
            ;;
        stop)
            stop_runtime
            ;;
        status)
            check_status
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