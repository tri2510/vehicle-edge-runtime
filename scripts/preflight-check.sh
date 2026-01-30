#!/bin/bash
# Vehicle Edge Runtime - Pre-flight Check Script
# Validates environment before deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo -e "${BLUE}🔍 Vehicle Edge Runtime - Pre-flight Check${NC}"
echo "=================================================="
echo ""

# Helper functions
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    ERRORS=$((ERRORS + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

check_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 1. Check Docker is installed
echo -e "${BLUE}Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
    check_pass "Docker installed (version $DOCKER_VERSION)"
else
    check_fail "Docker is not installed"
    echo "   Install Docker from: https://docs.docker.com/get-docker/"
fi
echo ""

# 2. Check Docker is running
echo -e "${BLUE}Checking Docker daemon...${NC}"
if docker info > /dev/null 2>&1; then
    check_pass "Docker daemon is running"
else
    check_fail "Docker daemon is not running"
    echo "   Start Docker with: sudo systemctl start docker"
fi
echo ""

# 3. Check Docker Compose plugin
echo -e "${BLUE}Checking Docker Compose...${NC}"
if docker compose version &> /dev/null 2>&1; then
    COMPOSE_VERSION=$(docker compose version --short)
    check_pass "Docker Compose V2 plugin installed (version $COMPOSE_VERSION)"
elif docker-compose version &> /dev/null 2>&1; then
    check_warn "Old docker-compose standalone found (not docker compose V2)"
    echo "   Run: ./scripts/setup-docker-compose.sh"
else
    check_fail "Docker Compose not found"
    echo "   Run: ./scripts/setup-docker-compose.sh"
fi
echo ""

# 4. Check user in docker group
echo -e "${BLUE}Checking Docker permissions...${NC}"
if groups | grep -q docker; then
    check_pass "User is in docker group"
else
    check_warn "User not in docker group (may need sudo)"
    echo "   Add user with: sudo usermod -aG docker \$USER && newgrp docker"
fi
echo ""

# 5. Check required ports
echo -e "${BLUE}Checking required ports...${NC}"
PORTS=(3002 3003 3090)
for PORT in "${PORTS[@]}"; do
    if sudo lsof -i :$PORT &> /dev/null || sudo netstat -tulpn 2>/dev/null | grep -q ":$PORT "; then
        check_warn "Port $PORT is already in use"
        echo "   Conflicting service may prevent startup"
    else
        check_pass "Port $PORT is available"
    fi
done
echo ""

# 6. Check for network conflicts
echo -e "${BLUE}Checking for network conflicts...${NC}"
if docker network ls | grep -q "vehicle-edge-network"; then
    EXISTING_NET=$(docker network ls | grep "vehicle-edge-network" | awk '{print $2}')
    # Check if subnet conflicts
    if docker network inspect $EXISTING_NET &> /dev/null; then
        SUBNET=$(docker network inspect $EXISTING_NET -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null)
        if [ "$SUBNET" = "172.20.0.0/16" ]; then
            check_warn "Existing network with 172.20.0.0/16 subnet found: $EXISTING_NET"
            echo "   May cause conflict. Remove with: docker network rm $EXISTING_NET"
        else
            check_pass "No subnet conflicts detected"
        fi
    fi
else
    check_pass "No conflicting networks found"
fi
echo ""

# 7. Check disk space
echo -e "${BLUE}Checking disk space...${NC}"
AVAILABLE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$AVAILABLE" -lt 5 ]; then
    check_warn "Low disk space (${AVAILABLE}G available, recommend 5G+)"
else
    check_pass "Sufficient disk space (${AVAILABLE}G available)"
fi
echo ""

# 8. Check .env file
echo -e "${BLUE}Checking configuration...${NC}"
if [ -f ".env" ]; then
    check_pass ".env file exists"
else
    check_warn ".env file not found (will be created during deploy)"
fi

if [ -f ".env.production" ]; then
    check_pass ".env.production template exists"
else
    check_fail ".env.production template not found"
fi
echo ""

# 9. Check if old containers exist
echo -e "${BLUE}Checking for existing containers...${NC}"
EXISTING_CONTAINERS=$(docker ps -a --filter "name=vehicle-edge-runtime" --format "{{.Names}}" | wc -l)
if [ "$EXISTING_CONTAINERS" -gt 0 ]; then
    check_warn "Found $EXISTING_CONTAINERS existing vehicle-edge-runtime container(s)"
    echo "   Clean up with: ./docker-deploy.sh clean"
else
    check_pass "No existing containers found"
fi
echo ""

# 10. Check critical files
echo -e "${BLUE}Checking required files...${NC}"
REQUIRED_FILES=("Dockerfile" "docker-compose.yml" "package.json" "src/index.js")
for FILE in "${REQUIRED_FILES[@]}"; do
    if [ -f "$FILE" ]; then
        check_pass "$FILE exists"
    else
        check_fail "$FILE not found"
    fi
done
echo ""

# Summary
echo "=================================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Ready to deploy.${NC}"
    echo ""
    echo "Run: ./docker-deploy.sh deploy base"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Found $WARNINGS warning(s). Deployment may still work.${NC}"
    echo ""
    echo "Run: ./docker-deploy.sh deploy base"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s) and $WARNINGS warning(s).${NC}"
    echo ""
    echo "Please fix the errors before deploying."
    echo "See TROUBLESHOOTING.md for help."
    exit 1
fi
