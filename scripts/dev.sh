#!/bin/bash
# Vehicle Edge Runtime - Development Tools Script
# Provides development utilities and helpers

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

log() {
	echo -e "${BLUE}[DEV]${NC} $1"
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
	echo "Usage: $0 <command> [options]"
	echo ""
	echo "Development Commands:"
	echo "  watch            Start runtime in development mode with auto-restart"
	echo "  test             Run test suite"
	echo "  lint             Run code linting and formatting"
	echo "  deps             Install/update dependencies"
	echo "  env              Manage environment files"
	echo "  logs             Show development logs"
	echo "  debug            Start runtime with debugging enabled"
	echo "  build            Build the project"
	echo "  clean            Clean development artifacts"
	echo ""
	echo "Utilities:"
	echo "  port             Check which ports are in use"
	echo "  health           Quick health check of running services"
	echo "  shell            Start a shell in the runtime container"
	echo ""
	echo "Examples:"
	echo "  $0 watch         # Start development server"
	echo "  $0 test          # Run tests"
	echo "  $0 lint --fix    # Fix linting issues"
	echo "  $0 env dev       # Switch to development environment"
}

check_project() {
	if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
		error "package.json not found. Are you in the correct directory?"
		exit 1
	fi

	cd "$PROJECT_DIR"
}

start_watch() {
	log "Starting Vehicle Edge Runtime in development mode..."

	check_project

	# Install dependencies if needed
	if [[ ! -d "node_modules" ]]; then
		log "Installing dependencies..."
		npm install
	fi

	# Create .env for development if missing
	if [[ ! -f .env ]]; then
		log "Creating development environment..."
		if [[ -f .env.example ]]; then
			cp .env.example .env
		else
			cat > .env << 'EOF'
# Development Configuration
NODE_ENV=development
PORT=3002
HEALTH_PORT=3003
LOG_LEVEL=debug
EOF
		fi
	fi

	# Ensure logs directory exists
	mkdir -p logs

	log "Starting development server with nodemon..."
	log "WebSocket API: ws://localhost:3002/runtime"
	log "Health Check: http://localhost:3003/health"
	log "Press Ctrl+C to stop"

	# Run with nodemon for auto-restart
	if npm list nodemon >/dev/null 2>&1; then
		npm run dev
	else
		# Fallback to regular npm start
		npm start
	fi
}

run_tests() {
	log "Running test suite..."

	check_project

	# Install test dependencies if needed
	if ! npm list jest >/dev/null 2>&1; then
		log "Installing test dependencies..."
		npm install --save-dev jest
	fi

	if [[ -d "tests" ]]; then
		log "Running unit tests..."
		npm test
	else
		warning "No tests directory found. Creating basic test structure..."
		mkdir -p tests/unit tests/integration

		# Create basic test file
		cat > tests/unit/basic.test.js << 'EOF'
// Basic Vehicle Edge Runtime Tests
describe('Vehicle Edge Runtime', () => {
	test('should pass basic sanity check', () => {
		expect(1 + 1).toBe(2);
	});

	test('should have required environment variables', () => {
		expect(process.env.NODE_ENV).toBeDefined();
	});
});
EOF

		log "Basic test structure created. Run tests again after adding your tests."
	fi
}

run_linting() {
	local fix_flag=""
	if [[ "$1" == "--fix" ]]; then
		fix_flag="--fix"
	fi

	log "Running code linting and formatting..."

	check_project

	# Install linting dependencies if needed
	local needs_install=0
	if ! npm list eslint >/dev/null 2>&1; then
		needs_install=1
	fi
	if ! npm list prettier >/dev/null 2>&1; then
		needs_install=1
	fi

	if [[ $needs_install -eq 1 ]]; then
		log "Installing linting dependencies..."
		npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-prettier
	fi

	# Run ESLint
	if npm list eslint >/dev/null 2>&1; then
		log "Running ESLint..."
		npx eslint src/ $fix_flag || true
	else
		warning "ESLint not available"
	fi

	# Run Prettier
	if npm list prettier >/dev/null 2>&1; then
		log "Running Prettier..."
		if [[ -n "$fix_flag" ]]; then
			npx prettier --write "src/**/*.{js,json,md}"
		else
			npx prettier --check "src/**/*.{js,json,md}" || true
		fi
	else
		warning "Prettier not available"
	fi

	success "Linting completed"
}

manage_dependencies() {
	local action="${1:-install}"

	log "Managing Node.js dependencies..."

	check_project

	case "$action" in
		install)
			log "Installing dependencies..."
			npm install

			# Install development dependencies
			log "Installing development dependencies..."
			npm install --save-dev nodemon eslint prettier jest

			success "Dependencies installed"
			;;
		update)
			log "Updating dependencies..."
			npm update
			npm audit fix 2>/dev/null || true
			success "Dependencies updated"
			;;
		clean)
			log "Cleaning dependencies..."
			rm -rf node_modules package-lock.json
			success "Dependencies cleaned"
			;;
		*)
			error "Unknown dependency action: $action"
			echo "Available actions: install, update, clean"
			exit 1
			;;
	esac
}

manage_environment() {
	local env_type="${1:-dev}"

	check_project

	case "$env_type" in
		dev|development)
			log "Switching to development environment..."
			if [[ -f .env ]]; then
				cp .env .env.backup
			fi
			cat > .env << 'EOF'
# Development Configuration
NODE_ENV=development
PORT=3002
HEALTH_PORT=3003
LOG_LEVEL=debug
MAX_CONCURRENT_APPS=5
EOF
			success "Development environment configured"
			;;
		prod|production)
			log "Switching to production environment..."
			if [[ -f .env ]]; then
				cp .env .env.backup
			fi
			if [[ -f .env.production ]]; then
				cp .env.production .env
			else
				cat > .env << 'EOF'
# Production Configuration
NODE_ENV=production
PORT=3002
HEALTH_PORT=3003
LOG_LEVEL=info
MAX_CONCURRENT_APPS=10
EOF
			fi
			success "Production environment configured"
			;;
		test)
			log "Switching to test environment..."
			if [[ -f .env ]]; then
				cp .env .env.backup
			fi
			cat > .env << 'EOF'
# Test Configuration
NODE_ENV=test
PORT=3004
HEALTH_PORT=3005
LOG_LEVEL=error
MAX_CONCURRENT_APPS=1
EOF
			success "Test environment configured"
			;;
		*)
			error "Unknown environment type: $env_type"
			echo "Available environments: dev, prod, test"
			exit 1
			;;
	esac
}

show_dev_logs() {
	log "Showing development logs..."

	check_project

	local log_file="$PROJECT_DIR/logs/runtime.log"
	if [[ ! -f "$log_file" ]]; then
		warning "No log file found. Start the runtime first with: $0 watch"
		return 1
	fi

	echo -e "${BLUE}Development logs (last 30 lines):${NC}"
	echo "===================================="
	tail -30 "$log_file"

	echo ""
	echo -e "${BLUE}Following logs (Ctrl+C to stop):${NC}"
	tail -f "$log_file"
}

start_debug() {
	log "Starting Vehicle Edge Runtime in debug mode..."

	check_project

	# Install debug dependencies if needed
	if ! npm list nodemon >/dev/null 2>&1; then
		npm install --save-dev nodemon
	fi

	log "Starting with Node.js debugging enabled..."
	log "Debugger listening on: ws://localhost:9229"
	log "Connect Chrome DevTools to: chrome://inspect"

	# Set debug environment
	export NODE_OPTIONS="--inspect=0.0.0.0:9229"

	# Start with debugging
	if npm list nodemon >/dev/null 2>&1; then
		npx nodemon --inspect=0.0.0.0:9229 src/index.js || npm run dev
	else
		node --inspect=0.0.0.0:9229 src/index.js || npm start
	fi
}

build_project() {
	log "Building Vehicle Edge Runtime..."

	check_project

	# Clean previous build
	if [[ -d "dist" ]]; then
		rm -rf dist/
	fi

	# Install dependencies
	if [[ ! -d "node_modules" ]]; then
		npm install
	fi

	# Run linting first
	npx eslint src/ || true

	log "Building project..."

	# If using TypeScript
	if [[ -f "tsconfig.json" ]]; then
		if ! npm list typescript >/dev/null 2>&1; then
			npm install --save-dev typescript @types/node
		fi
		npx tsc
	else
		# For JavaScript projects, just create dist structure
		mkdir -p dist
		cp -r src/* dist/
	fi

	success "Build completed"
}

clean_development() {
	log "Cleaning development artifacts..."

	check_project

	# Remove build artifacts
	rm -rf dist/ build/ 2>/dev/null || true

	# Clean logs but keep directory
	if [[ -d "logs" ]]; then
		rm -f logs/*
	fi

	# Remove coverage reports
	rm -rf coverage/ .nyc_output/ 2>/dev/null || true

	# Remove temporary files
	find . -name "*.tmp" -delete 2>/dev/null || true
	find . -name "*.temp" -delete 2>/dev/null || true
	find . -name ".DS_Store" -delete 2>/dev/null || true

	success "Development artifacts cleaned"
}

check_ports() {
	log "Checking port usage..."

	local ports=(3002 3003 3090 55555 6379 9229)

	for port in "${ports[@]}"; do
		if lsof -ti:"$port" >/dev/null 2>&1; then
			local pid
			pid=$(lsof -ti:"$port")
			local process
			process=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
			echo -e "Port $port: ${RED}In use${NC} (PID: $pid, Process: $process)"
		else
			echo -e "Port $port: ${GREEN}Available${NC}"
		fi
	done
}

quick_health_check() {
	log "Performing quick health check..."

	# Check if runtime is running
	if curl -s http://localhost:3003/health >/dev/null 2>&1; then
		success "Runtime health endpoint: OK"
	else
		error "Runtime health endpoint: Not responding"
	fi

	# Check WebSocket port
	if timeout 5 bash -c "</dev/tcp/localhost/3002" 2>/dev/null; then
		success "WebSocket endpoint (3002): Open"
	else
		error "WebSocket endpoint (3002): Not open"
	fi

	# Check if Docker services are running
	if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
		local running_containers
		running_containers=$(docker ps --filter "name=vehicle-edge" --format "{{.Names}}" | wc -l)
		if [[ $running_containers -gt 0 ]]; then
			success "Docker containers: $running_containers running"
		else
			warning "Docker containers: None running"
		fi
	fi
}

start_shell() {
	log "Starting shell in runtime container..."

	check_project

	local container_name
	container_name=$(docker ps --filter "name=vehicle-edge-runtime" --format "{{.Names}}" | head -1)

	if [[ -z "$container_name" ]]; then
		error "No running Vehicle Edge Runtime container found"
		error "Start the container first with: ./scripts/deploy.sh deploy"
		exit 1
	fi

	log "Opening shell in container: $container_name"
	docker exec -it "$container_name" /bin/bash || docker exec -it "$container_name" /bin/sh
}

main() {
	if [[ $# -eq 0 ]]; then
		show_usage
		exit 1
	fi

	case $1 in
		watch)
			start_watch
			;;
		test)
			run_tests
			;;
		lint)
			run_linting "${2:-}"
			;;
		deps)
			manage_dependencies "${2:-install}"
			;;
		env)
			manage_environment "${2:-dev}"
			;;
		logs)
			show_dev_logs
			;;
		debug)
			start_debug
			;;
		build)
			build_project
			;;
		clean)
			clean_development
			;;
		port)
			check_ports
			;;
		health)
			quick_health_check
			;;
		shell)
			start_shell
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