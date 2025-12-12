#!/bin/bash
# Vehicle Edge Runtime - Docker Deployment Script
# Simplified deployment with smart defaults

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Vehicle Edge Runtime - Docker Deployment${NC}"
echo "=================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Parse command line arguments
ACTION=${1:-"deploy"}
PROFILE=${2:-"base"}

case "$ACTION" in
    deploy)
        echo -e "${YELLOW}📦 Deploying Vehicle Edge Runtime...${NC}"

        # Use new streamlined files
        if [ ! -f "Dockerfile.new" ]; then
            echo -e "${RED}❌ Dockerfile.new not found${NC}"
            exit 1
        fi

        # Create .env from production defaults if it doesn't exist
        if [ ! -f ".env" ]; then
            echo -e "${YELLOW}📝 Creating .env from production defaults...${NC}"
            cp .env.production .env
        fi

        # Build with new Dockerfile
        echo -e "${BLUE}🔨 Building Docker image...${NC}"
        docker build -f Dockerfile.new -t vehicle-edge-runtime:latest .

        # Deploy with optional profiles
        echo -e "${BLUE}🚢 Starting services...${NC}"
        if [ "$PROFILE" = "full" ]; then
            docker-compose -f docker-compose.new.yml --profile local-kuksa --profile redis up -d
            echo -e "${GREEN}✅ Deployed with local Kuksa and Redis${NC}"
        elif [ "$PROFILE" = "kuksa" ]; then
            docker-compose -f docker-compose.new.yml --profile local-kuksa up -d
            echo -e "${GREEN}✅ Deployed with local Kuksa${NC}"
        elif [ "$PROFILE" = "redis" ]; then
            docker-compose -f docker-compose.new.yml --profile redis up -d
            echo -e "${GREEN}✅ Deployed with Redis${NC}"
        else
            docker-compose -f docker-compose.new.yml up -d
            echo -e "${GREEN}✅ Deployed base runtime (connects to online Kit-Manager)${NC}"
        fi

        echo ""
        echo -e "${BLUE}📊 Service Status:${NC}"
        docker-compose -f docker-compose.new.yml ps

        echo ""
        echo -e "${BLUE}🌐 Access Points:${NC}"
        echo "   • WebSocket API: ws://localhost:3002/runtime"
        echo "   • Health Check:  http://localhost:3003/health"

        if [ "$PROFILE" = "full" ] || [ "$PROFILE" = "kuksa" ]; then
            echo "   • Kuksa Web UI:  http://localhost:55555"
        fi
        ;;

    stop)
        echo -e "${YELLOW}🛑 Stopping Vehicle Edge Runtime...${NC}"
        docker-compose -f docker-compose.new.yml down
        echo -e "${GREEN}✅ Services stopped${NC}"
        ;;

    logs)
        echo -e "${BLUE}📋 Vehicle Edge Runtime Logs:${NC}"
        docker-compose -f docker-compose.new.yml logs -f vehicle-edge-runtime
        ;;

    status)
        echo -e "${BLUE}📊 Service Status:${NC}"
        docker-compose -f docker-compose.new.yml ps

        echo ""
        echo -e "${BLUE}🏥 Health Check:${NC}"
        if curl -s http://localhost:3003/health > /dev/null; then
            echo -e "${GREEN}✅ Runtime is healthy${NC}"
        else
            echo -e "${RED}❌ Runtime health check failed${NC}"
        fi
        ;;

    clean)
        echo -e "${YELLOW}🧹 Cleaning up...${NC}"
        docker-compose -f docker-compose.new.yml down -v
        docker rmi vehicle-edge-runtime:latest 2>/dev/null || true
        echo -e "${GREEN}✅ Cleanup complete${NC}"
        ;;

    *)
        echo -e "${YELLOW}Usage: $0 [deploy|stop|logs|status|clean] [profile]${NC}"
        echo ""
        echo "Profiles:"
        echo "  base     - Runtime only (connects to online Kit-Manager)"
        echo "  kuksa    - Runtime + local Kuksa databroker"
        echo "  redis    - Runtime + Redis caching"
        echo "  full     - Runtime + Kuksa + Redis"
        echo ""
        echo "Examples:"
        echo "  $0 deploy base      # Runtime only"
        echo "  $0 deploy kuksa     # With local Kuksa"
        echo "  $0 deploy full      # Complete stack"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Operation completed successfully!${NC}"