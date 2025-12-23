#!/bin/bash
# Vehicle Edge Runtime - Docker Deployment Script
# Manages Docker-based deployment with profiles

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
readonly DOCKER_COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Global variables
ACTION=""
PROFILE="base"

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
	echo "Usage: $0 [deploy|stop|restart|logs|status|clean] [profile]"
	echo ""
	echo "Actions:"
	echo "  deploy   Deploy or update services"
	echo "  stop     Stop all services"
	echo "  restart  Restart services"
	echo "  logs     Show service logs"
	echo "  status   Show service status"
	echo "  clean    Remove containers and images"
	echo ""
	echo "Profiles:"
	echo "  base     - Runtime only (default)"
	echo "  kuksa    - Runtime + local Kuksa databroker"
	echo "  redis    - Runtime + Redis caching"
	echo "  full     - Runtime + Kuksa + Redis"
	echo ""
	echo "Examples:"
	echo "  $0 deploy          # Deploy base runtime"
	echo "  $0 deploy full     # Deploy complete stack"
	echo "  $0 logs            # Show logs"
	echo "  $0 status          # Show status"
}

check_docker() {
	if ! command -v docker >/dev/null 2>&1; then
		error "Docker not found. Please run: ./scripts/setup.sh"
		exit 1
	fi

	if ! docker info >/dev/null 2>&1; then
		error "Docker is not running. Please start Docker first."
		exit 1
	fi

	if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
		error "Docker Compose not found. Please run: ./scripts/setup.sh"
		exit 1
	fi
}

get_docker_compose_cmd() {
	if docker compose version >/dev/null 2>&1; then
		echo "docker compose"
	else
		echo "docker-compose"
	fi
}

check_docker_files() {
	local docker_compose_files=("$PROJECT_DIR/docker-compose.yml" "$PROJECT_DIR/docker-compose.new.yml")
	local dockerfile="$PROJECT_DIR/Dockerfile"

	local found_compose=""
	for file in "${docker_compose_files[@]}"; do
		if [[ -f "$file" ]]; then
			found_compose="$file"
			break
		fi
	done

	if [[ -z "$found_compose" ]]; then
		error "No docker-compose.yml file found in $PROJECT_DIR"
		exit 1
	fi

	if [[ ! -f "$dockerfile" ]] && [[ ! -f "$PROJECT_DIR/Dockerfile.new" ]]; then
		error "No Dockerfile found in $PROJECT_DIR"
		exit 1
	fi

	echo "$found_compose"
}

build_image() {
	log "Building Docker image..."

	local dockerfile="$PROJECT_DIR/Dockerfile"
	if [[ ! -f "$dockerfile" ]] && [[ -f "$PROJECT_DIR/Dockerfile.new" ]]; then
		dockerfile="$PROJECT_DIR/Dockerfile.new"
	fi

	cd "$PROJECT_DIR"

	docker build -f "$dockerfile" -t vehicle-edge-runtime:latest .

	if [[ $? -eq 0 ]]; then
		success "Docker image built successfully"
	else
		error "Docker build failed"
		exit 1
	fi
}

setup_environment() {
	cd "$PROJECT_DIR"

	# Create .env if missing
	if [[ ! -f .env ]]; then
		log "Creating environment configuration..."
		if [[ -f .env.example ]]; then
			cp .env.example .env
		elif [[ -f .env.production ]]; then
			cp .env.production .env
		else
			warning "No environment template found, using defaults"
			cat > .env << 'EOF'
# Vehicle Edge Runtime Configuration
COMPOSE_PROJECT_NAME=vehicle-edge-runtime
NODE_ENV=production
PORT=3002
HEALTH_PORT=3003

# Logging
LOG_LEVEL=info

# Performance
MAX_CONCURRENT_APPS=10
DEFAULT_MEMORY_LIMIT=524288000
DEFAULT_CPU_LIMIT=50000
EOF
		fi
	fi

	# Ensure data directories exist with proper permissions
	mkdir -p data/applications data/logs data/configs
	chmod -R 755 data/
}

deploy_services() {
	log "Deploying Vehicle Edge Runtime with profile: $PROFILE"

	local docker_compose_file
	docker_compose_file=$(check_docker_files)

	cd "$PROJECT_DIR"
	setup_environment

	# Build image if needed or forced
	local build_flag=""
	if [[ $FORCE_BUILD -eq 1 ]] || ! docker image inspect vehicle-edge-runtime:latest >/dev/null 2>&1; then
		build_flag="--build"
	fi

	local docker_compose_cmd
	docker_compose_cmd=$(get_docker_compose_cmd)

	# Deploy with profile
	case "$PROFILE" in
		full)
			log "Deploying complete stack (Runtime + Kuksa + Redis)..."
			if [[ "$docker_compose_file" == *"new"* ]]; then
				$docker_compose_cmd -f "$docker_compose_file" --profile local-kuksa --profile redis up -d $build_flag
			else
				$docker_compose_cmd -f "$docker_compose_file" --profile kuksa --profile redis up -d $build_flag
			fi
			;;
		kuksa)
			log "Deploying with local Kuksa..."
			$docker_compose_cmd -f "$docker_compose_file" --profile local-kuksa up -d $build_flag
			;;
		redis)
			log "Deploying with Redis..."
			$docker_compose_cmd -f "$docker_compose_file" --profile redis up -d $build_flag
			;;
		base|*)
			log "Deploying base runtime..."
			$docker_compose_cmd -f "$docker_compose_file" up -d $build_flag
			;;
	esac

	if [[ $? -eq 0 ]]; then
		success "Deployment completed successfully"
		show_service_info
	else
		error "Deployment failed"
		exit 1
	fi
}

show_service_info() {
	local docker_compose_file
	docker_compose_file=$(check_docker_files)

	local docker_compose_cmd
	docker_compose_cmd=$(get_docker_compose_cmd)

	cd "$PROJECT_DIR"

	echo ""
	echo -e "${BLUE}Service Status:${NC}"
	$docker_compose_cmd -f "$docker_compose_file" ps

	echo ""
	echo -e "${BLUE}Access Points:${NC}"
	echo "  • WebSocket API: ws://localhost:3002/runtime"
	echo "  • Health Check:  http://localhost:3003/health"

	if [[ "$PROFILE" == "full" || "$PROFILE" == "kuksa" ]]; then
		echo "  • Kuksa Web UI:  http://localhost:55555"
	fi

	if [[ "$PROFILE" == "full" || "$PROFILE" == "redis" ]]; then
		echo "  • Redis:         localhost:6379"
	fi

	# Wait for services to be healthy
	echo ""
	log "Waiting for services to be healthy..."
	local count=0
	while [[ $count -lt 30 ]]; do
		if curl -s http://localhost:3003/health >/dev/null 2>&1; then
			success "All services are healthy!"
			break
		fi
		sleep 2
		((count++))
		echo -n "."
	done
	echo

	if [[ $count -ge 30 ]]; then
		warning "Services may still be starting up. Check status with: $0 status"
	fi
}

stop_services() {
	log "Stopping Vehicle Edge Runtime services..."

	local docker_compose_file
	docker_compose_file=$(check_docker_files)

	local docker_compose_cmd
	docker_compose_cmd=$(get_docker_compose_cmd)

	cd "$PROJECT_DIR"

	$docker_compose_cmd -f "$docker_compose_file" down

	success "Services stopped"
}

restart_services() {
	log "Restarting Vehicle Edge Runtime services..."
	stop_services
	sleep 2
	deploy_services
}

show_logs() {
	local docker_compose_file
	docker_compose_file=$(check_docker_files)

	local docker_compose_cmd
	docker_compose_cmd=$(get_docker_compose_cmd)

	cd "$PROJECT_DIR"

	local service="vehicle-edge-runtime"
	if [[ $# -gt 1 ]]; then
		service="$2"
	fi

	log "Showing logs for service: $service"
	$docker_compose_cmd -f "$docker_compose_file" logs -f "$service"
}

show_status() {
	local docker_compose_file
	docker_compose_file=$(check_docker_files)

	local docker_compose_cmd
	docker_compose_cmd=$(get_docker_compose_cmd)

	cd "$PROJECT_DIR"

	echo -e "${BLUE}Vehicle Edge Runtime Docker Status${NC}"
	echo "======================================="

	echo ""
	echo -e "${BLUE}Container Status:${NC}"
	$docker_compose_cmd -f "$docker_compose_file" ps

	echo ""
	echo -e "${BLUE}Health Checks:${NC}"

	# Check runtime health
	if curl -s http://localhost:3003/health >/dev/null 2>&1; then
		success "Runtime health endpoint: Responding"
	else
		error "Runtime health endpoint: Not responding"
	fi

	# Check WebSocket endpoint
	if timeout 5 bash -c "</dev/tcp/localhost/3002" 2>/dev/null; then
		success "WebSocket endpoint (3002): Open"
	else
		error "WebSocket endpoint (3002): Not open"
	fi

	# Check Kuksa if enabled
	if [[ "$PROFILE" == "full" || "$PROFILE" == "kuksa" ]]; then
		if curl -s http://localhost:55555 >/dev/null 2>&1; then
			success "Kuksa Web UI (55555): Responding"
		else
			warning "Kuksa Web UI (55555): Not responding"
		fi
	fi

	# Check Redis if enabled
	if [[ "$PROFILE" == "full" || "$PROFILE" == "redis" ]]; then
		if docker exec vehicle-edge-runtime-redis redis-cli ping >/dev/null 2>&1; then
			success "Redis: Connected"
		else
			warning "Redis: Not responding"
		fi
	fi

	echo ""
	echo -e "${BLUE}Resource Usage:${NC}"
	docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
		$(docker ps --filter "name=vehicle-edge" --format "{{.Names}}") 2>/dev/null || \
		echo "No running containers found"
}

clean_deployment() {
	log "Cleaning up Vehicle Edge Runtime deployment..."

	local docker_compose_file
	docker_compose_file=$(check_docker_files)

	local docker_compose_cmd
	docker_compose_cmd=$(get_docker_compose_cmd)

	cd "$PROJECT_DIR"

	# Stop and remove containers
	$docker_compose_cmd -f "$docker_compose_file" down -v 2>/dev/null || true

	# Remove images
	docker rmi vehicle-edge-runtime:latest 2>/dev/null || true

	# Clean up unused Docker resources
	docker system prune -f 2>/dev/null || true

	# Clean up local data directories (optional)
	if [[ $CLEAN_DATA -eq 1 ]]; then
		warning "Cleaning up data directories..."
		rm -rf data/applications/* data/logs/* data/configs/* 2>/dev/null || true
	fi

	success "Cleanup completed"
}

main() {
	# Global flags
	FORCE_BUILD=0
	CLEAN_DATA=0

	# Parse command line arguments
	while [[ $# -gt 0 ]]; do
		case $1 in
			--build)
				FORCE_BUILD=1
				shift
				;;
			--clean-data)
				CLEAN_DATA=1
				shift
				;;
			--help|-h)
				show_usage
				exit 0
				;;
			deploy|stop|restart|logs|status|clean)
				ACTION="$1"
				shift
				if [[ $# -gt 0 && ! "$1" =~ ^- ]]; then
					PROFILE="$1"
					shift
				fi
				;;
			*)
				error "Unknown option: $1"
				show_usage
				exit 1
				;;
		esac
	done

	if [[ -z "$ACTION" ]]; then
		show_usage
		exit 1
	fi

	check_docker

	case "$ACTION" in
		deploy)
			deploy_services
			;;
		stop)
			stop_services
			;;
		restart)
			restart_services
			;;
		logs)
			show_logs "$@"
			;;
		status)
			show_status
			;;
		clean)
			clean_deployment
			;;
		*)
			error "Unknown action: $ACTION"
			show_usage
			exit 1
			;;
	esac
}

# Handle script interruption
trap 'echo ""; warning "Interrupted by user"; exit 130' INT TERM

# Run main function
main "$@"