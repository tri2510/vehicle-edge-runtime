#!/bin/bash

# Vehicle Edge Runtime - Automated Installation Script
# Supports Ubuntu, Debian, and Raspberry Pi OS (64-bit)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root (allow in Docker containers for testing)
if [[ $EUID -eq 0 ]]; then
   if [[ -f /.dockerenv || "$container" == "docker" ]]; then
       print_warning "Running as root in Docker container - this is OK for testing"
   else
       print_error "This script should not be run as root for security reasons."
       print_warning "Please run as a regular user with sudo privileges."
       exit 1
   fi
fi

# System detection
detect_system() {
    print_status "Detecting system..."

    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        print_error "Cannot detect OS version"
        exit 1
    fi

    ARCH=$(uname -m)
    print_status "Detected: $OS $VER on $ARCH"

    # Check architecture
    if [[ "$ARCH" != "x86_64" && "$ARCH" != "aarch64" ]]; then
        print_error "Unsupported architecture: $ARCH"
        print_error "Supported: x86_64 (Intel/AMD) or aarch64 (ARM64)"
        exit 1
    fi

    # Check OS
    if [[ "$OS" != *"Ubuntu"* && "$OS" != *"Debian"* && "$OS" != *"Raspberry"* ]]; then
        print_warning "This script is optimized for Ubuntu/Debian systems"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get appropriate command prefix for root/user
get_prefix() {
    if [[ $EUID -eq 0 ]]; then
        echo ""  # Running as root, no sudo needed
    else
        echo "sudo"  # Running as user, need sudo
    fi
}

# Install system dependencies
install_system_deps() {
    print_status "Installing system dependencies..."

    local PREFIX=$(get_prefix)
    $PREFIX apt update
    $PREFIX apt upgrade -y

    # Essential packages
    local packages="curl wget git build-essential python3 python3-pip software-properties-common apt-transport-https ca-certificates gnupg lsb-release"

    # Install packages
    $PREFIX apt install -y $packages

    print_success "System dependencies installed"
}

# Install Node.js
install_nodejs() {
    print_status "Installing Node.js..."

    if command_exists node; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $NODE_VERSION -ge 18 ]]; then
            print_success "Node.js $(node -v) already installed (>= 18.0.0)"
            return
        else
            print_warning "Node.js $NODE_VERSION found, but >= 18.0.0 required"
        fi
    fi

    # Install Node.js 18 LTS
    print_status "Installing Node.js 18 LTS..."
    local PREFIX=$(get_prefix)
    curl -fsSL https://deb.nodesource.com/setup_18.x | $PREFIX -E bash -
    $PREFIX apt install -y nodejs

    # Verify installation
    if command_exists node; then
        NODE_VER=$(node -v)
        NPM_VER=$(npm -v)
        print_success "Node.js $NODE_VER installed"
        print_success "npm $NPM_VER installed"
    else
        print_error "Node.js installation failed"
        exit 1
    fi
}

# Install Docker
install_docker() {
    print_status "Installing Docker..."

    if command_exists docker; then
        print_success "Docker $(docker --version --format '{{.Client.Version}}') already installed"
    else
        print_status "Installing Docker..."
        curl -fsSL https://get.docker.com | sudo sh

        # Verify Docker installation
        if command_exists docker; then
            print_success "Docker $(docker --version --format '{{.Client.Version}}') installed"
        else
            print_error "Docker installation failed"
            exit 1
        fi
    fi

    # Install Docker Compose plugin
    if ! docker compose version >/dev/null 2>&1; then
        print_status "Installing Docker Compose plugin..."
        sudo apt install -y docker-compose-plugin
        print_success "Docker Compose installed"
    else
        print_success "Docker Compose $(docker compose version --short) already installed"
    fi

    # Add user to docker group
    if ! groups $USER | grep -q docker; then
        print_status "Adding user to docker group..."
        sudo usermod -aG docker $USER
        print_warning "You will need to log out and log back in for docker group changes to take effect"
        print_warning "Or run 'newgrp docker' to apply changes to current session"
    else
        print_success "User already in docker group"
    fi

    # Start and enable Docker service
    sudo systemctl enable docker
    sudo systemctl start docker

    print_success "Docker setup completed"
}

# Clone and setup Vehicle Edge Runtime
setup_runtime() {
    print_status "Setting up Vehicle Edge Runtime..."

    # Check if already cloned
    if [[ -d "vehicle-edge-runtime" && -f "vehicle-edge-runtime/package.json" ]]; then
        print_warning "Vehicle Edge Runtime directory already exists"
        read -p "Update existing installation? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cd vehicle-edge-runtime
            git pull origin main
        else
            cd vehicle-edge-runtime
        fi
    else
        # Clone repository
        print_status "Cloning Vehicle Edge Runtime repository..."
        git clone https://github.com/tri2510/vehicle-edge-runtime.git
        cd vehicle-edge-runtime
    fi

    # Install Node.js dependencies
    print_status "Installing Node.js dependencies..."
    npm install

    # Create environment file
    if [[ ! -f .env ]]; then
        print_status "Creating environment configuration..."
        cp .env.example .env

        # Auto-configure based on system
        if [[ "$ARCH" == "aarch64" ]]; then
            # Raspberry Pi optimizations
            sed -i 's/MAX_CONCURRENT_APPS=10/MAX_CONCURRENT_APPS=3/' .env
            sed -i 's/DEFAULT_MEMORY_LIMIT=524288000/DEFAULT_MEMORY_LIMIT=134217728/' .env
            sed -i 's/DEFAULT_CPU_LIMIT=50000/DEFAULT_CPU_LIMIT=25000/' .env
            print_status "Applied Raspberry Pi optimizations"
        fi

        print_success "Environment configuration created at .env"
    else
        print_warning "Environment file already exists, skipping configuration"
    fi

    # Create data directories
    print_status "Creating data directories..."
    mkdir -p data/applications data/logs data/configs
    chmod 755 data/logs

    print_success "Vehicle Edge Runtime setup completed"
}

# Verify installation
verify_installation() {
    print_status "Verifying installation..."

    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    if [[ $NODE_MAJOR -lt 18 ]]; then
        print_error "Node.js version $NODE_VERSION is too old (>= 18.0.0 required)"
        return 1
    fi
    print_success "Node.js version check passed"

    # Check Docker
    if ! command_exists docker; then
        print_error "Docker not found"
        return 1
    fi

    # Test Docker (might fail if user not in docker group)
    if docker info >/dev/null 2>&1; then
        print_success "Docker is working correctly"
    else
        print_warning "Docker test failed - user might need to re-login"
        print_warning "Run 'newgrp docker' or log out and log back in"
    fi

    # Check if runtime dependencies installed
    if [[ -f "package.json" && -d "node_modules" ]]; then
        print_success "Runtime dependencies installed correctly"
    else
        print_error "Runtime dependencies not found"
        return 1
    fi

    print_success "Installation verification completed"
}

# Show next steps
show_next_steps() {
    echo
    print_success "🚀 Installation completed successfully!"
    echo
    echo -e "${BLUE}Next Steps:${NC}"
    echo
    echo "1. If you haven't already, apply docker group changes:"
    echo "   newgrp docker"
    echo "   # OR log out and log back in"
    echo
    echo "2. Review and customize configuration:"
    echo "   nano .env"
    echo
    echo "3. Start the runtime:"
    echo "   # Docker deployment (recommended):"
    echo "   ./7-start-separate-services.sh"
    echo "   # Or:"
    echo "   ./docker-setup.sh prod"
    echo
    echo "   # Or native Node.js (development):"
    echo "   npm start"
    echo
    echo "4. Verify installation:"
    echo "   curl http://localhost:3003/health"
    echo
    echo "5. Test WebSocket connection:"
    echo "   echo '{\"type\":\"ping\"}' | websocat ws://localhost:3002/runtime"
    echo
    echo -e "${BLUE}Service Endpoints:${NC}"
    echo "  - WebSocket API: ws://localhost:3002/runtime"
    echo "  - Health Check:  http://localhost:3003/health"
    echo "  - Kit Manager:   http://localhost:3090 (if using separate containers)"
    echo
    echo -e "${BLUE}Documentation:${NC}"
    echo "  - README.md: Overview and usage"
    echo "  - INSTALLATION.md: Detailed installation guide"
    echo "  - COMMUNICATION_ARCHITECTURE.md: System architecture"
    echo
    echo -e "${GREEN}Happy coding! 🎉${NC}"
}

# Main installation flow
main() {
    echo -e "${BLUE}"
    echo "======================================"
    echo "  Vehicle Edge Runtime Installer"
    echo "======================================"
    echo -e "${NC}"

    detect_system
    install_system_deps
    install_nodejs
    install_docker
    setup_runtime
    verify_installation
    show_next_steps

    echo
    print_success "Installation script completed!"
}

# Error handling
trap 'print_error "Installation failed at line $LINENO"' ERR

# Run main function
main "$@"