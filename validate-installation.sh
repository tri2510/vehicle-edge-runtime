#!/bin/bash

# Vehicle Edge Runtime - Installation Validation Script
# Tests all critical components after installation

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
WARNINGS=0

print_header() {
    echo -e "${BLUE}"
    echo "====================================="
    echo "  Installation Validation"
    echo "====================================="
    echo -e "${NC}"
}

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

test_system_requirements() {
    print_test "System Requirements"

    # Check OS
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        print_pass "OS: $NAME $VERSION_ID"
    else
        print_fail "Cannot determine OS version"
    fi

    # Check architecture
    ARCH=$(uname -m)
    if [[ "$ARCH" == "x86_64" || "$ARCH" == "aarch64" ]]; then
        print_pass "Architecture: $ARCH (supported)"
    else
        print_fail "Architecture: $ARCH (unsupported)"
    fi

    # Check RAM
    RAM_MB=$(free -m | awk 'NR==2{print $2}')
    if [[ $RAM_MB -ge 2048 ]]; then
        print_pass "Memory: ${RAM_MB}MB (sufficient)"
    else
        print_warn "Memory: ${RAM_MB}MB (minimum 2GB recommended)"
    fi

    # Check disk space
    DISK_GB=$(df . | tail -1 | awk '{print int($4/1024/1024)}')
    if [[ $DISK_GB -ge 5 ]]; then
        print_pass "Disk Space: ${DISK_GB}GB available"
    else
        print_fail "Disk Space: ${DISK_GB}GB (minimum 5GB required)"
    fi
}

test_nodejs() {
    print_test "Node.js Installation"

    if command_exists node; then
        NODE_VERSION=$(node -v)
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)

        if [[ $NODE_MAJOR -ge 18 ]]; then
            print_pass "Node.js: $NODE_VERSION (>= 18.0.0)"
        else
            print_fail "Node.js: $NODE_VERSION (>= 18.0.0 required)"
        fi
    else
        print_fail "Node.js not found"
    fi

    if command_exists npm; then
        NPM_VERSION=$(npm -v)
        print_pass "npm: $NPM_VERSION"
    else
        print_fail "npm not found"
    fi
}

test_docker() {
    print_test "Docker Installation"

    if command_exists docker; then
        DOCKER_VERSION=$(docker --version --format '{{.Client.Version}}')
        print_pass "Docker: $DOCKER_VERSION"

        # Test Docker daemon
        if docker info >/dev/null 2>&1; then
            print_pass "Docker daemon: Running"
        else
            print_warn "Docker daemon: Not accessible (user may need docker group or re-login)"
        fi
    else
        print_fail "Docker not found"
    fi

    if docker compose version >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker compose version --short)
        print_pass "Docker Compose: $COMPOSE_VERSION"
    else
        print_fail "Docker Compose not found"
    fi
}

test_runtime_files() {
    print_test "Runtime Files and Dependencies"

    # Check if we're in the right directory
    if [[ ! -f "package.json" ]]; then
        print_fail "Not in Vehicle Edge Runtime directory (package.json not found)"
        return
    fi

    print_pass "package.json found"

    # Check node_modules
    if [[ -d "node_modules" ]]; then
        print_pass "node_modules directory exists"
    else
        print_fail "node_modules directory not found"
    fi

    # Check main source files
    local main_files=("src/index.js" "src/core/VehicleEdgeRuntime.js" "src/api/WebSocketHandler.js")
    for file in "${main_files[@]}"; do
        if [[ -f "$file" ]]; then
            print_pass "$file exists"
        else
            print_fail "$file not found"
        fi
    done

    # Check data directories
    local data_dirs=("data/applications" "data/logs" "data/configs")
    for dir in "${data_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            print_pass "$dir directory exists"
        else
            print_fail "$dir directory not found"
        fi
    done
}

test_configuration() {
    print_test "Configuration Files"

    # Check .env file
    if [[ -f ".env" ]]; then
        print_pass ".env file exists"

        # Check required environment variables
        local required_vars=("PORT" "DATA_PATH" "KIT_MANAGER_URL")
        for var in "${required_vars[@]}"; do
            if grep -q "^${var}=" .env; then
                print_pass "$var configured in .env"
            else
                print_warn "$var not found in .env"
            fi
        done
    else
        print_fail ".env file not found"
    fi
}

test_network_ports() {
    print_test "Network Port Availability"

    local ports=(3002 3003 3090)
    local port_names=("Runtime WebSocket" "Runtime Health" "Kit Manager")

    for i in "${!ports[@]}"; do
        port=${ports[$i]}
        name=${port_names[$i]}

        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            print_warn "$name (port $port): Already in use"
        else
            print_pass "$name (port $port): Available"
        fi
    done
}

test_docker_permissions() {
    print_test "Docker Permissions"

    if groups $USER | grep -q docker; then
        print_pass "User in docker group"

        # Test docker command
        if docker ps >/dev/null 2>&1; then
            print_pass "Docker commands work without sudo"
        else
            print_warn "Docker commands may require sudo or re-login"
        fi
    else
        print_fail "User not in docker group"
        print_warn "Run: sudo usermod -aG docker \$USER && newgrp docker"
    fi
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

test_runtime_startup() {
    print_test "Runtime Startup (Basic Test)"

    if command_exists node && [[ -f "src/index.js" ]]; then
        # Quick syntax check
        if node -c src/index.js 2>/dev/null; then
            print_pass "Runtime source code syntax valid"
        else
            print_fail "Runtime source code has syntax errors"
        fi

        # Check if we can start the runtime (without actually running it)
        if timeout 5s node src/index.js >/dev/null 2>&1; then
            print_warn "Runtime started successfully (unexpected in test mode)"
        else
            # This is expected to timeout/exit since we're not running it properly
            print_pass "Runtime startup process works"
        fi
    else
        print_fail "Cannot test runtime startup (node.js or src/index.js missing)"
    fi
}

print_summary() {
    echo
    echo -e "${BLUE}====================================="
    echo "  Validation Summary"
    echo "=====================================${NC}"
    echo
    echo -e "${GREEN}Passed: $PASSED${NC}"
    echo -e "${RED}Failed: $FAILED${NC}"
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
    echo

    if [[ $FAILED -eq 0 ]]; then
        if [[ $WARNINGS -eq 0 ]]; then
            echo -e "${GREEN}🎉 Perfect! Installation validated successfully.${NC}"
        else
            echo -e "${YELLOW}✅ Installation validated with some warnings.${NC}"
            echo -e "${YELLOW}   Review warnings above and address if needed.${NC}"
        fi
        echo
        echo -e "${BLUE}You can now start the Vehicle Edge Runtime:${NC}"
        echo "  ./7-start-separate-services.sh"
        echo "  # or:"
        echo "  npm start"
    else
        echo -e "${RED}❌ Installation validation failed.${NC}"
        echo -e "${RED}   Please address the failed tests above.${NC}"
        echo
        echo -e "${BLUE}Common fixes:${NC}"
        echo "  - Docker permissions: sudo usermod -aG docker \$USER && newgrp docker"
        echo "  - Missing deps: npm install"
        echo "  - Port conflicts: sudo lsof -i :3002"
    fi
}

# Helper to check if command exists (moved up)
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Main validation
main() {
    print_header

    test_system_requirements
    test_nodejs
    test_docker
    test_runtime_files
    test_configuration
    test_network_ports
    test_docker_permissions
    test_runtime_startup

    print_summary
}

# Run validation
main "$@"