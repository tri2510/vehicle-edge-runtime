#!/bin/bash
# Vehicle Edge Runtime - Docker Compose Plugin Setup Script
# This script installs the Docker Compose V2 plugin for users who don't have it

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Docker Compose Plugin Setup${NC}"
echo "=================================="
echo ""

# Check if docker compose already works
if docker compose version > /dev/null 2>&1; then
    COMPOSE_VERSION=$(docker compose version)
    echo -e "${GREEN}✅ Docker Compose plugin already installed!${NC}"
    echo "   Version: $COMPOSE_VERSION"
    echo ""
    echo "You're all set! You can now run:"
    echo "  ./docker-deploy.sh deploy base"
    exit 0
fi

echo -e "${YELLOW}📦 Installing Docker Compose V2 plugin...${NC}"
echo ""

# Create plugins directory
mkdir -p ~/.docker/cli-plugins

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        COMPOSE_ARCH="linux-x86_64"
        ;;
    aarch64|arm64)
        COMPOSE_ARCH="linux-aarch64"
        ;;
    *)
        echo -e "${RED}❌ Unsupported architecture: $ARCH${NC}"
        echo "Please install docker-compose-plugin manually"
        exit 1
        ;;
esac

# Get latest version (or use specific version)
COMPOSE_VERSION="v2.30.3"
DOWNLOAD_URL="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-${COMPOSE_ARCH}"

echo "Downloading Docker Compose ${COMPOSE_VERSION} for ${ARCH}..."
curl -SL "$DOWNLOAD_URL" -o ~/.docker/cli-plugins/docker-compose

# Make executable
chmod +x ~/.docker/cli-plugins/docker-compose

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""

# Verify installation
if ~/.docker/cli-plugins/docker-compose version > /dev/null 2>&1; then
    INSTALLED_VERSION=$(~/.docker/cli-plugins/docker-compose version)
    echo "   Version: $INSTALLED_VERSION"
    echo ""
    echo -e "${GREEN}🎉 Docker Compose plugin installed successfully!${NC}"
    echo ""
    echo "You can now run:"
    echo "  ./docker-deploy.sh deploy base"
else
    echo -e "${RED}❌ Installation failed${NC}"
    echo "Please install manually:"
    echo "  sudo apt-get install -y docker-compose-plugin"
    exit 1
fi
