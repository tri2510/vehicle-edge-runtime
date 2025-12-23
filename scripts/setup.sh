#!/bin/bash
# Vehicle Edge Runtime - Unified Setup Script
# Installs dependencies and configures the runtime environment

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Global variables
DEV_MODE=0
FORCE_INSTALL=0
OS_NAME=""
OS_VERSION=""
ARCH=""

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

show_usage() {
	echo "Usage: $0 [--dev] [--force]"
	echo ""
	echo "Options:"
	echo "  --dev    Install development dependencies"
	echo "  --force  Force reinstall all packages"
	echo ""
	echo "Examples:"
	echo "  $0                # Standard production setup"
	echo "  $0 --dev          # Development setup with extra tools"
	echo "  $0 --force        # Force reinstall everything"
}

detect_system() {
	log "Detecting system information..."

	if [[ -f /etc/os-release ]]; then
		eval "$(grep -E "^(NAME|VERSION_ID)=" /etc/os-release)"
		OS_NAME="$NAME"
		OS_VERSION="$VERSION_ID"
	else
		error "Cannot detect OS version"
		exit 1
	fi

	ARCH="$(uname -m)"
	log "Detected: $OS_NAME $OS_VERSION on $ARCH"

	case "$ARCH" in
	x86_64)
		ARCH="x86_64"
		;;
	aarch64|arm64)
		ARCH="arm64"
		;;
	armv7l)
		ARCH="armv7"
		;;
	*)
		error "Unsupported architecture: $ARCH"
		exit 1
		;;
	esac

	# Check if running as root
	if [[ $EUID -eq 0 && ! -f /.dockerenv ]]; then
		error "This script should not be run as root for security reasons."
		error "Please run as a regular user with sudo privileges."
		exit 1
	fi
}

check_requirements() {
	log "Checking system requirements..."

	# Check minimum RAM
	local total_ram
	total_ram=$(free -m | awk 'NR==2{print $2}')
	if [[ $total_ram -lt 1024 ]]; then
		error "Minimum 1GB RAM required. Found: ${total_ram}MB"
		exit 1
	fi

	# Check disk space
	local available_space
	available_space=$(df -BG "$PROJECT_DIR" | awk 'NR==2{print $4}' | sed 's/G//')
	if [[ $available_space -lt 2 ]]; then
		error "Minimum 2GB free disk space required. Found: ${available_space}GB"
		exit 1
	fi

	success "System requirements met: ${total_ram}MB RAM, ${available_space}GB disk space"
}

command_exists() {
	command -v "$1" >/dev/null 2>&1
}

get_prefix() {
	if [[ $EUID -eq 0 ]]; then
		echo ""
	else
		echo "sudo"
	fi
}

install_system_packages() {
	log "Installing system packages..."

	local prefix
	prefix=$(get_prefix)

	$prefix apt update -qq

	local packages="curl wget git build-essential python3 python3-pip \
		software-properties-common apt-transport-https ca-certificates \
		gnupg lsb-release jq htop net-tools"

	# Development packages
	if [[ $DEV_MODE -eq 1 ]]; then
		packages="$packages nodejs npm docker.io docker-compose-plugin \
			systemd ufw vim nano"
	else
		packages="$packages nodejs npm docker.io docker-compose-plugin \
			systemd"
	fi

	$prefix apt install -y $packages

	success "System packages installed"
}

install_nodejs() {
	log "Setting up Node.js..."

	local prefix
	prefix=$(get_prefix)

	if command_exists node && [[ $FORCE_INSTALL -eq 0 ]]; then
		local node_version
		node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
		if [[ $node_version -ge 18 ]]; then
			success "Node.js $(node -v) already installed (>= 18.0.0)"
			return
		else
			warning "Node.js $node_version found, but >= 18.0.0 required"
		fi
	fi

	log "Installing Node.js 18 LTS..."
	curl -fsSL https://deb.nodesource.com/setup_18.x | $prefix -E bash -
	$prefix apt install -y nodejs

	if command_exists node; then
		success "Node.js $(node -v) installed"
	else
		error "Node.js installation failed"
		exit 1
	fi
}

setup_docker() {
	log "Setting up Docker..."

	local prefix
	prefix=$(get_prefix)

	if command_exists docker && [[ $FORCE_INSTALL -eq 0 ]]; then
		local docker_version
		docker_version=$(docker --version --format '{{.Client.Version}}')
		success "Docker $docker_version already installed"
	else
		log "Installing Docker..."
		curl -fsSL https://get.docker.com | sh
	fi

	# Docker Compose plugin
	if ! docker compose version >/dev/null 2>&1; then
		log "Installing Docker Compose plugin..."
		$prefix apt install -y docker-compose-plugin
	fi

	# Add user to docker group
	if ! groups "$USER" | grep -q docker; then
		log "Adding user to docker group..."
		sudo usermod -aG docker "$USER"
		warning "You will need to log out and log back in for docker group changes to take effect"
		warning "Or run 'newgrp docker' to apply changes to current session"
	fi

	# Start and enable Docker service
	sudo systemctl enable docker
	sudo systemctl start docker

	success "Docker setup completed"
}

setup_runtime() {
	log "Setting up Vehicle Edge Runtime..."

	cd "$PROJECT_DIR"

	# Install Node.js dependencies
	if [[ $FORCE_INSTALL -eq 1 ]] || [[ ! -d "node_modules" ]]; then
		log "Installing Node.js dependencies..."
		npm install
	fi

	# Create environment file
	if [[ ! -f .env ]]; then
		log "Creating environment configuration..."
		if [[ -f .env.example ]]; then
			cp .env.example .env
		elif [[ -f .env.production ]]; then
			cp .env.production .env
		fi

		# Auto-configure based on system
		if [[ "$ARCH" == "arm64" ]]; then
			# ARM optimizations for Raspberry Pi
			sed -i 's/MAX_CONCURRENT_APPS=10/MAX_CONCURRENT_APPS=3/' .env 2>/dev/null || true
			sed -i 's/DEFAULT_MEMORY_LIMIT=524288000/DEFAULT_MEMORY_LIMIT=134217728/' .env 2>/dev/null || true
			sed -i 's/DEFAULT_CPU_LIMIT=50000/DEFAULT_CPU_LIMIT=25000/' .env 2>/dev/null || true
			log "Applied ARM optimizations"
		fi
	fi

	# Create data directories
	mkdir -p data/applications data/logs data/configs
	chmod 755 data/logs

	success "Vehicle Edge Runtime setup completed"
}

verify_installation() {
	log "Verifying installation..."

	# Check Node.js version
	if command_exists node; then
		local node_version
		node_version=$(node -v | cut -d'v' -f2)
		local node_major
		node_major=$(echo "$node_version" | cut -d'.' -f1)
		if [[ $node_major -lt 18 ]]; then
			error "Node.js version $node_version is too old (>= 18.0.0 required)"
			return 1
		fi
		success "Node.js version check passed: $(node -v)"
	else
		error "Node.js not found"
		return 1
	fi

	# Check Docker
	if ! command_exists docker; then
		error "Docker not found"
		return 1
	fi

	# Test Docker
	if docker info >/dev/null 2>&1; then
		success "Docker is working correctly"
	else
		warning "Docker test failed - user might need to re-login"
		warning "Run 'newgrp docker' or log out and log back in"
	fi

	# Check runtime dependencies
	if [[ -f "$PROJECT_DIR/package.json" && -d "$PROJECT_DIR/node_modules" ]]; then
		success "Runtime dependencies installed correctly"
	else
		error "Runtime dependencies not found"
		return 1
	fi

	success "Installation verification completed"
}

show_next_steps() {
	echo
	success "🚀 Setup completed successfully!"
	echo
	echo -e "${BLUE}Next Steps:${NC}"
	echo
	echo "1. Apply docker group changes (if needed):"
	echo "   newgrp docker"
	echo "   # OR log out and log back in"
	echo
	echo "2. Review configuration:"
	echo "   nano .env"
	echo
	echo "3. Start the runtime:"
	echo "   ./scripts/runtime.sh start"
	echo "   # Or deploy with Docker:"
	echo "   ./scripts/deploy.sh deploy"
	echo
	echo "4. Verify installation:"
	echo "   curl http://localhost:3003/health"
	echo
	echo -e "${BLUE}Service Endpoints:${NC}"
	echo "  - WebSocket API: ws://localhost:3002/runtime"
	echo "  - Health Check:  http://localhost:3003/health"
	echo "  - Kit Manager:   http://localhost:3090"
	echo
}

main() {
	# Parse command line arguments
	while [[ $# -gt 0 ]]; do
		case $1 in
			--dev)
				DEV_MODE=1
				shift
				;;
			--force)
				FORCE_INSTALL=1
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

	echo -e "${BLUE}"
	echo "======================================"
	echo "  Vehicle Edge Runtime Setup"
	echo "======================================"
	echo -e "${NC}"

	detect_system
	check_requirements
	install_system_packages
	install_nodejs
	setup_docker
	setup_runtime
	verify_installation
	show_next_steps

	success "Setup script completed!"
}

# Error handling
trap 'error "Setup failed at line $LINENO"' ERR

# Run main function
main "$@"