#!/bin/bash
# Vehicle Edge Runtime - Service Management Script
# Manages runtime services (start, stop, restart, status, logs)

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
readonly RUNTIME_PORT=3002
readonly HEALTH_PORT=3003

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Global variables
PID_FILE="$PROJECT_DIR/runtime.pid"
LOG_FILE="$PROJECT_DIR/logs/runtime.log"

log() {
	echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
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

show_usage() {
	echo "Usage: $0 [start|stop|restart|status|logs]"
	echo ""
	echo "Commands:"
	echo "  start    Start the Vehicle Edge Runtime"
	echo "  stop     Stop the Vehicle Edge Runtime"
	echo "  restart  Restart the Vehicle Edge Runtime"
	echo "  status   Show runtime status"
	echo "  logs     Show runtime logs"
	echo ""
	echo "Examples:"
	echo "  $0 start"
	echo "  $0 status"
	echo "  $0 logs"
}

is_running() {
	[[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

get_pid() {
	if [[ -f "$PID_FILE" ]]; then
		cat "$PID_FILE"
	else
		echo ""
	fi
}

check_prerequisites() {
	# Check if we're in the right directory
	if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
		error "package.json not found. Are you in the correct directory?"
		exit 1
	fi

	# Check Node.js
	if ! command -v node >/dev/null 2>&1; then
		error "Node.js not found. Please run: ./scripts/setup.sh"
		exit 1
	fi

	# Check dependencies
	if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
		error "Node.js dependencies not found. Installing..."
		cd "$PROJECT_DIR"
		npm install
	fi

	# Create .env if missing
	if [[ ! -f "$PROJECT_DIR/.env" ]]; then
		warning ".env file not found. Creating from example..."
		if [[ -f "$PROJECT_DIR/.env.example" ]]; then
			cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
		elif [[ -f "$PROJECT_DIR/.env.production" ]]; then
			cp "$PROJECT_DIR/.env.production" "$PROJECT_DIR/.env"
		else
			error "No environment template found"
			exit 1
		fi
	fi

	# Create data directories
	mkdir -p "$PROJECT_DIR/data/applications" "$PROJECT_DIR/data/logs" "$PROJECT_DIR/data/configs"

	# Create logs directory
	mkdir -p "$(dirname "$LOG_FILE")"
}

start_runtime() {
	log "Starting Vehicle Edge Runtime..."

	if is_running; then
		warning "Runtime is already running with PID $(get_pid)"
		return 0
	fi

	check_prerequisites

	cd "$PROJECT_DIR"

	# Kill any existing processes on the ports
	for port in "$RUNTIME_PORT" "$HEALTH_PORT"; do
		local pid
		pid=$(lsof -ti:"$port" 2>/dev/null || true)
		if [[ -n "$pid" ]]; then
			log "Killing existing process on port $port (PID: $pid)"
			kill -9 "$pid" 2>/dev/null || true
		fi
	done

	# Load environment variables
	export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)

	# Start the runtime in background
	log "Starting Vehicle Edge Runtime..."
	log "WebSocket API: ws://localhost:${RUNTIME_PORT}/runtime"
	log "Health Check: http://localhost:${HEALTH_PORT}/health"
	log "Log file: $LOG_FILE"

	nohup npm run dev > "$LOG_FILE" 2>&1 &
	local runtime_pid=$!

	# Save PID
	echo "$runtime_pid" > "$PID_FILE"

	# Wait for startup
	sleep 3

	if is_running; then
		success "Vehicle Edge Runtime started successfully (PID: $runtime_pid)"

		# Verify health endpoint
		sleep 2
		if curl -s "http://localhost:$HEALTH_PORT/health" >/dev/null; then
			success "Health check passed - runtime is healthy"
		else
			warning "Health check failed - runtime may still be starting"
		fi
	else
		error "Failed to start Vehicle Edge Runtime"
		if [[ -f "$LOG_FILE" ]]; then
			echo "Last 10 lines of log:"
			tail -10 "$LOG_FILE"
		fi
		exit 1
	fi
}

stop_runtime() {
	log "Stopping Vehicle Edge Runtime..."

	if ! is_running; then
		warning "Runtime is not running"
		[[ -f "$PID_FILE" ]] && rm -f "$PID_FILE"
		return 0
	fi

	local pid
	pid=$(get_pid)

	log "Stopping runtime (PID: $pid)"
	kill "$pid" 2>/dev/null || true

	# Wait for graceful shutdown
	local count=0
	while is_running && [[ $count -lt 10 ]]; do
		sleep 1
		((count++))
	done

	# Force kill if still running
	if is_running; then
		warning "Runtime did not stop gracefully, force killing..."
		kill -9 "$pid" 2>/dev/null || true
		sleep 1
	fi

	# Clean up PID file
	[[ -f "$PID_FILE" ]] && rm -f "$PID_FILE"

	# Kill any remaining processes on ports
	for port in "$RUNTIME_PORT" "$HEALTH_PORT"; do
		local pids
		pids=$(lsof -ti:"$port" 2>/dev/null || true)
		if [[ -n "$pids" ]]; then
			log "Killing remaining processes on port $port"
			echo "$pids" | xargs kill -9 2>/dev/null || true
		fi
	done

	success "Vehicle Edge Runtime stopped"
}

restart_runtime() {
	log "Restarting Vehicle Edge Runtime..."
	stop_runtime
	sleep 2
	start_runtime
}

show_status() {
	echo -e "${BLUE}Vehicle Edge Runtime Status${NC}"
	echo "=================================="

	if is_running; then
		local pid
		pid=$(get_pid)
		success "Status: Running"
		echo "PID: $pid"
		echo "Uptime: $(ps -o etimes= -p "$pid" 2>/dev/null | awk '{print int($1/3600)"h "int($1%3600/60)"m "int($1%60)"s"}' || echo 'Unknown')"
	else
		error "Status: Not running"
	fi

	echo ""
	echo "Ports:"
	echo "  WebSocket API: $RUNTIME_PORT"
	echo "  Health Check:  $HEALTH_PORT"

	echo ""
	echo "Services:"
	for port in "$RUNTIME_PORT" "$HEALTH_PORT"; do
		if lsof -ti:"$port" >/dev/null 2>&1; then
			local pid
			pid=$(lsof -ti:"$port")
			success "  Port $port: Active (PID: $pid)"
		else
			error "  Port $port: Not active"
		fi
	done

	echo ""
	echo "Health Check:"
	if curl -s "http://localhost:$HEALTH_PORT/health" >/dev/null 2>&1; then
		local health_response
		health_response=$(curl -s "http://localhost:$HEALTH_PORT/health" 2>/dev/null || echo '{"status":"error"}')
		success "Health endpoint responding"
		if echo "$health_response" | jq -e '.status' >/dev/null 2>&1; then
			echo "Status: $(echo "$health_response" | jq -r '.status // "unknown"')"
			echo "Uptime: $(echo "$health_response" | jq -r '.uptime // "unknown"')"
		fi
	else
		error "Health endpoint not responding"
	fi

	echo ""
	echo "Files:"
	echo "  PID file: $PID_FILE"
	echo "  Log file: $LOG_FILE"
	if [[ -f "$LOG_FILE" ]]; then
		echo "  Log size: $(du -h "$LOG_FILE" | cut -f1)"
	else
		echo "  Log file: Not created yet"
	fi
}

show_logs() {
	log "Showing Vehicle Edge Runtime logs..."
	echo ""

	if [[ ! -f "$LOG_FILE" ]]; then
		warning "Log file not found: $LOG_FILE"
		return 1
	fi

	echo -e "${BLUE}Recent logs (last 50 lines):${NC}"
	echo "======================================"
	tail -50 "$LOG_FILE"
	echo ""

	if command -v less >/dev/null 2>&1; then
		echo -e "${BLUE}Press 'q' to exit log viewer${NC}"
		sleep 2
		tail -f "$LOG_FILE" | less +F
	else
		echo -e "${BLUE}Following logs (Ctrl+C to stop):${NC}"
		tail -f "$LOG_FILE"
	fi
}

main() {
	if [[ $# -eq 0 ]]; then
		show_usage
		exit 1
	fi

	case $1 in
		start)
			start_runtime
			;;
		stop)
			stop_runtime
			;;
		restart)
			restart_runtime
			;;
		status)
			show_status
			;;
		logs)
			show_logs
			;;
		--help|-h)
			show_usage
			exit 0
			;;
		*)
			error "Unknown command: $1"
			echo ""
			show_usage
			exit 1
			;;
	esac
}

# Handle script interruption
trap 'echo ""; warning "Interrupted by user"; exit 130' INT TERM

# Run main function
main "$@"