#!/bin/bash
# Install native Vehicle Edge Runtime dependencies on host

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    local status=$1
    local msg=$2
    case $status in
        OK) echo -e "${GREEN}✅ $msg${NC}" ;;
        WARN) echo -e "${YELLOW}⚠️  $msg${NC}" ;;
        ERROR) echo -e "${RED}❌ $msg${NC}" ;;
    esac
}

echo "Installing Vehicle Edge Runtime native dependencies on host..."

# Check if Node.js is installed
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    print_status OK "Node.js is installed: $NODE_VERSION"
else
    print_status WARN "Node.js not found, installing..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_status OK "Node.js installed successfully"
fi

# Check if npm is installed
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    print_status OK "npm is installed: $NPM_VERSION"
else
    print_status ERROR "npm not found after Node.js installation"
    exit 1
fi

# Check if Docker is installed
if command -v docker >/dev/null 2>&1; then
    DOCKER_VERSION=$(docker --version)
    print_status OK "Docker is installed: $DOCKER_VERSION"
else
    print_status WARN "Docker not found, installing..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    print_status OK "Docker installed successfully"
    print_status INFO "You may need to log out and log back in for Docker group changes"
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

# Create workspace directory
mkdir -p "$WORKSPACE_DIR/workspace-native"
cd "$WORKSPACE_DIR/workspace-native"

# Copy necessary files
print_status OK "Copying Vehicle Edge Runtime files..."
cp -r "$WORKSPACE_DIR/src" ./
cp "$WORKSPACE_DIR/package*.json" ./
cp "$WORKSPACE_DIR/.env" ./ 2>/dev/null || echo "No .env file, skipping"

# Install dependencies
print_status OK "Installing Node.js dependencies..."
npm install

# Create data directory
mkdir -p data/{applications,logs,configs}

print_status OK "Native runtime installation completed successfully!"
echo ""
echo "Workspace location: $WORKSPACE_DIR/workspace-native"
echo "Ready to start native runtime with: ./3b-start-runtime-native.sh"