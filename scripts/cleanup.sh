#!/bin/bash
# Vehicle Edge Runtime - Cleanup Script
# Removes deployment artifacts, logs, and temporary files

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Global flags
CLEAN_ALL=0
CLEAN_LOGS=0
CLEAN_DEPLOYMENTS=0
CLEAN_DOCKER=0
CLEAN_BUILD=0
DRY_RUN=0

log() {
	echo -e "${BLUE}[CLEANUP]${NC} $1"
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
	echo "Usage: $0 [options]"
	echo ""
	echo "Options:"
	echo "  --all           Clean everything"
	echo "  --logs          Clean log files"
	echo "  --deployments   Clean deployment artifacts"
	echo "  --docker        Clean Docker containers and images"
	echo "  --build         Clean build artifacts"
	echo "  --dry-run       Show what would be cleaned without actually doing it"
	echo ""
	echo "Examples:"
	echo "  $0 --logs              # Clean only log files"
	echo "  $0 --deployments       # Clean deployment artifacts"
	echo "  $0 --docker            # Clean Docker resources"
	echo "  $0 --all               # Clean everything"
	echo "  $0 --all --dry-run     # Preview what would be cleaned"
}

confirm_cleanup() {
	if [[ $DRY_RUN -eq 1 ]]; then
		return 0
	fi

	echo -e "${YELLOW}This will permanently delete files. Are you sure?${NC}"
	read -p "Type 'yes' to continue: " -r
	echo
	if [[ ! $REPLY =~ ^yes$ ]]; then
		log "Cleanup cancelled"
		exit 0
	fi
}

safe_remove() {
	local path="$1"
	local description="${2:-$path}"

	if [[ -e "$path" ]]; then
		if [[ $DRY_RUN -eq 1 ]]; then
			echo "Would remove: $description"
			return 0
		fi

		echo "Removing: $description"
		rm -rf "$path"
	else
		log "Already removed: $description"
	fi
}

clean_logs() {
	log "Cleaning log files..."

	local log_files=(
		"$PROJECT_DIR/logs"
		"$PROJECT_DIR/runtime.log"
		"$PROJECT_DIR/*.log"
		"$PROJECT_DIR/data/logs"
	)

	for log_path in "${log_files[@]}"; do
		# Handle wildcards
		if [[ "$log_path" == *"*"* ]]; then
			for file in $PROJECT_DIR/*.log 2>/dev/null; do
				if [[ -f "$file" ]]; then
					safe_remove "$file" "log file: $(basename "$file")"
				fi
			done
		else
			safe_remove "$log_path" "log directory/file: $log_path"
		fi
	done

	success "Log files cleaned"
}

clean_deployments() {
	log "Cleaning deployment artifacts..."

	# Clean application deployments
	if [[ -d "$PROJECT_DIR/data/applications" ]]; then
		local deploy_dirs
		deploy_dirs=$(find "$PROJECT_DIR/data/applications" -name "deploy_*" -type d 2>/dev/null || true)

		if [[ -n "$deploy_dirs" ]]; then
			log "Found $(echo "$deploy_dirs" | wc -l) deployment directories"
			echo "$deploy_dirs" | while read -r dir; do
				if [[ -d "$dir" ]]; then
					safe_remove "$dir" "deployment directory: $(basename "$dir")"
				fi
			done
		fi
	fi

	# Clean runtime databases
	local db_files=(
		"$PROJECT_DIR/data/vehicle-edge.db"
		"$PROJECT_DIR/data/vehicle-edge.db-shm"
		"$PROJECT_DIR/data/vehicle-edge.db-wal"
		"$PROJECT_DIR/data/*.db"
		"$PROJECT_DIR/data/*.sqlite"
	)

	for db_file in "${db_files[@]}"; do
		if [[ "$db_file" == *"*"* ]]; then
			for file in $PROJECT_DIR/data/*.db $PROJECT_DIR/data/*.sqlite 2>/dev/null; do
				if [[ -f "$file" ]]; then
					safe_remove "$file" "database file: $(basename "$file")"
				fi
			done
		else
			safe_remove "$db_file" "database file: $(basename "$db_file")"
		fi
	done

	# Clean PID files
	local pid_files=(
		"$PROJECT_DIR/*.pid"
		"$PROJECT_DIR/runtime.pid"
		"$PROJECT_DIR/kuksa-server.pid"
	)

	for pid_file in "${pid_files[@]}"; do
		if [[ "$pid_file" == *"*"* ]]; then
			for file in $PROJECT_DIR/*.pid 2>/dev/null; do
				if [[ -f "$file" ]]; then
					safe_remove "$file" "PID file: $(basename "$file")"
				fi
			done
		else
			safe_remove "$pid_file" "PID file: $(basename "$pid_file")"
		fi
	done

	# Clean test artifacts
	safe_remove "$PROJECT_DIR/test-reports" "test reports"
	safe_remove "$PROJECT_DIR/workspace" "test workspace"
	safe_remove "$PROJECT_DIR/coverage" "coverage reports"
	safe_remove "$PROJECT_DIR/.nyc_output" "NYC coverage output"

	success "Deployment artifacts cleaned"
}

clean_docker() {
	log "Cleaning Docker resources..."

	if ! command -v docker >/dev/null 2>&1; then
		warning "Docker not found, skipping Docker cleanup"
		return 0
	fi

	if ! docker info >/dev/null 2>&1; then
		warning "Docker not running, skipping Docker cleanup"
		return 0
	fi

	cd "$PROJECT_DIR"

	# Stop and remove containers
	local containers
	containers=$(docker ps -aq --filter "name=vehicle-edge" 2>/dev/null || true)

	if [[ -n "$containers" ]]; then
		log "Stopping Vehicle Edge Runtime containers..."
		if [[ $DRY_RUN -eq 1 ]]; then
			echo "Would stop containers: $containers"
		else
			echo "$containers" | xargs docker stop 2>/dev/null || true
			echo "$containers" | xargs docker rm 2>/dev/null || true
		fi
	else
		log "No Vehicle Edge Runtime containers found"
	fi

	# Remove images
	local images
	images=$(docker images -q "vehicle-edge-runtime" 2>/dev/null || true)

	if [[ -n "$images" ]]; then
		log "Removing Vehicle Edge Runtime images..."
		if [[ $DRY_RUN -eq 1 ]]; then
			echo "Would remove images: $images"
		else
			echo "$images" | xargs docker rmi -f 2>/dev/null || true
		fi
	else
		log "No Vehicle Edge Runtime images found"
	fi

	# Remove volumes
	local volumes
	volumes=$(docker volume ls -q --filter "name=vehicle-edge" 2>/dev/null || true)

	if [[ -n "$volumes" ]]; then
		log "Removing Vehicle Edge Runtime volumes..."
		if [[ $DRY_RUN -eq 1 ]]; then
			echo "Would remove volumes: $volumes"
		else
			echo "$volumes" | xargs docker volume rm -f 2>/dev/null || true
		fi
	else
		log "No Vehicle Edge Runtime volumes found"
	fi

	# Clean up docker-compose services
	local compose_files=("$PROJECT_DIR/docker-compose.yml" "$PROJECT_DIR/docker-compose.new.yml")

	for compose_file in "${compose_files[@]}"; do
		if [[ -f "$compose_file" ]]; then
			if [[ $DRY_RUN -eq 1 ]]; then
				echo "Would stop services from: $compose_file"
			else
				log "Stopping services from: $compose_file"
				docker-compose -f "$compose_file" down -v 2>/dev/null || true
			fi
		fi
	done

	success "Docker resources cleaned"
}

clean_build() {
	log "Cleaning build artifacts..."

	# Remove build directories
	local build_dirs=(
		"$PROJECT_DIR/dist"
		"$PROJECT_DIR/build"
		"$PROJECT_DIR/.next"
		"$PROJECT_DIR/out"
		"$PROJECT_DIR/public/build"
	)

	for build_dir in "${build_dirs[@]}"; do
		safe_remove "$build_dir" "build directory: $(basename "$build_dir")"
	done

	# Remove temporary files
	local temp_patterns=(
		"$PROJECT_DIR/*.tmp"
		"$PROJECT_DIR/*.temp"
		"$PROJECT_DIR/*.swp"
		"$PROJECT_DIR/*.swo"
		"$PROJECT_DIR/*~"
		"$PROJECT_DIR/.DS_Store"
		"$PROJECT_DIR/Thumbs.db"
	)

	for pattern in "${temp_patterns[@]}"; do
		for file in $pattern 2>/dev/null; do
			if [[ -f "$file" ]]; then
				safe_remove "$file" "temporary file: $(basename "$file")"
			fi
		done
	done

	# Remove cache directories
	local cache_dirs=(
		"$PROJECT_DIR/.cache"
		"$PROJECT_DIR/node_modules/.cache"
		"$PROJECT_DIR/.eslintcache"
	)

	for cache_dir in "${cache_dirs[@]}"; do
		safe_remove "$cache_dir" "cache directory: $(basename "$cache_dir")"
	done

	success "Build artifacts cleaned"
}

clean_all() {
	log "Performing complete cleanup..."

	confirm_cleanup
	clean_logs
	clean_deployments
	clean_docker
	clean_build

	# Clean configuration backups
	local backup_files=(
		"$PROJECT_DIR/.env.backup"
		"$PROJECT_DIR/package-lock.json.backup"
	)

	for backup_file in "${backup_files[@]}"; do
		safe_remove "$backup_file" "backup file: $(basename "$backup_file")"
	done

	success "Complete cleanup finished"
}

show_cleanup_summary() {
	echo ""
	echo -e "${BLUE}Cleanup Summary${NC}"
	echo "=================="

	local total_size=0

	# Calculate sizes before cleanup (if not dry run)
	if [[ $DRY_RUN -eq 0 ]]; then
		# Calculate sizes of various directories
		for dir in logs data/applications data/logs dist build .cache; do
			if [[ -d "$PROJECT_DIR/$dir" ]]; then
				local size
				size=$(du -sb "$PROJECT_DIR/$dir" 2>/dev/null | cut -f1 || echo "0")
				total_size=$((total_size + size))
			fi
		done

		if [[ $total_size -gt 0 ]]; then
			local human_size
			human_size=$(numfmt --to=iec $total_size 2>/dev/null || echo "$total_size bytes")
			success "Freed approximately $human_size"
		fi
	fi

	echo ""
	echo -e "${BLUE}What was cleaned:${NC}"
	if [[ $CLEAN_LOGS -eq 1 || $CLEAN_ALL -eq 1 ]]; then
		echo "  ✅ Log files and directories"
	fi
	if [[ $CLEAN_DEPLOYMENTS -eq 1 || $CLEAN_ALL -eq 1 ]]; then
		echo "  ✅ Deployment artifacts and databases"
	fi
	if [[ $CLEAN_DOCKER -eq 1 || $CLEAN_ALL -eq 1 ]]; then
		echo "  ✅ Docker containers, images, and volumes"
	fi
	if [[ $CLEAN_BUILD -eq 1 || $CLEAN_ALL -eq 1 ]]; then
		echo "  ✅ Build artifacts and temporary files"
	fi

	echo ""
	echo -e "${BLUE}What remains:${NC}"
	echo "  📁 Source code (src/ directory)"
	echo "  📁 Configuration files (.env, package.json)"
	echo "  📁 Essential structure (scripts/, proto/, etc.)"
	echo "  📁 Docker files (Dockerfile, docker-compose.yml)"
	echo "  📁 Documentation (README.md, docs/)"
}

main() {
	# Parse command line arguments
	while [[ $# -gt 0 ]]; do
		case $1 in
			--all)
				CLEAN_ALL=1
				shift
				;;
			--logs)
				CLEAN_LOGS=1
				shift
				;;
			--deployments)
				CLEAN_DEPLOYMENTS=1
				shift
				;;
			--docker)
				CLEAN_DOCKER=1
				shift
				;;
			--build)
				CLEAN_BUILD=1
				shift
				;;
			--dry-run)
				DRY_RUN=1
				echo -e "${YELLOW}DRY RUN MODE - No files will be actually removed${NC}"
				echo ""
				shift
				;;
			--help|-h)
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

	# If no specific options provided, show usage
	if [[ $CLEAN_ALL -eq 0 && $CLEAN_LOGS -eq 0 && $CLEAN_DEPLOYMENTS -eq 0 && $CLEAN_DOCKER -eq 0 && $CLEAN_BUILD -eq 0 ]]; then
		show_usage
		exit 1
	fi

	echo -e "${BLUE}"
	echo "=================================="
	echo "  Vehicle Edge Runtime Cleanup"
	echo "=================================="
	echo -e "${NC}"

	cd "$PROJECT_DIR"

	# Execute cleanup based on flags
	if [[ $CLEAN_ALL -eq 1 ]]; then
		clean_all
	else
		if [[ $DRY_RUN -eq 0 ]]; then
			confirm_cleanup
		fi

		[[ $CLEAN_LOGS -eq 1 ]] && clean_logs
		[[ $CLEAN_DEPLOYMENTS -eq 1 ]] && clean_deployments
		[[ $CLEAN_DOCKER -eq 1 ]] && clean_docker
		[[ $CLEAN_BUILD -eq 1 ]] && clean_build
	fi

	show_cleanup_summary

	if [[ $DRY_RUN -eq 0 ]]; then
		success "Cleanup completed successfully!"
		echo ""
		echo "Next steps:"
		echo "  • Start fresh: ./scripts/runtime.sh start"
		echo "  • Deploy with Docker: ./scripts/deploy.sh deploy"
		echo "  • Setup for development: ./scripts/dev.sh watch"
	fi
}

# Handle script interruption
trap 'echo ""; warning "Interrupted by user"; exit 130' INT TERM

# Run main function
main "$@"