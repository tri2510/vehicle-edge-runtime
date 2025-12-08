#!/bin/bash
# Check Vehicle Edge Runtime simulation status
# Provides comprehensive status information for both modes

set -euo pipefail

CONTAINER="vehicle-edge-pi"
MODE="${1:-auto}"  # Options: native, docker, auto

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "🚗 Vehicle Edge Runtime Simulation Status"
echo "=========================================="
echo ""

# Function to print colored status
print_status() {
    local status="$1"
    local message="$2"

    case "$status" in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Check if container is running
echo "📦 Container Status:"
if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    print_status "OK" "Vehicle Edge Pi container is running"
    echo "   Container: $CONTAINER"
    echo "   Image: $(docker inspect $CONTAINER --format='{{.Config.Image}}' 2>/dev/null || echo 'Unknown')"
    echo "   Status: $(docker ps --format '{{.Status}}' --filter name=$CONTAINER)"
else
    print_status "ERROR" "Vehicle Edge Pi container is NOT running"
    echo ""
    echo "🚀 Start it first:"
    echo "   ./0-start-pi-ci.sh"
    exit 1
fi

echo ""

# Function to detect running mode
detect_mode() {
    if docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -E 'kit-manager|vehicle-edge-runtime' >/dev/null 2>&1"; then
        echo "docker"
    elif docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' >/dev/null 2>&1"; then
        echo "native"
    else
        echo "none"
    fi
}

# Auto-detect mode if needed
if [[ "$MODE" == "auto" ]]; then
    DETECTED_MODE=$(detect_mode)
    if [[ "$DETECTED_MODE" == "none" ]]; then
        echo "🔍 Running Mode: ${YELLOW}No services detected${NC}"
        echo ""
        echo "🚀 To start services:"
        echo "   Native mode:  ./2b-start-native.sh"
        echo "   Docker mode:  ./2a-start-docker.sh"
        MODE="none"
    else
        echo "🔍 Running Mode: ${GREEN}$DETECTED_MODE${NC}"
        MODE="$DETECTED_MODE"
    fi
else
    echo "🔍 Checking Mode: ${BLUE}$MODE${NC}"
fi

echo ""

# Check native services
echo "💻 Native Services Status:"
NATIVE_PROCESSES=$(docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null | wc -l" || echo "0")

if [[ $NATIVE_PROCESSES -gt 0 ]]; then
    print_status "OK" "Native Node.js processes running ($NATIVE_PROCESSES)"
    echo "   Process IDs:"
    docker exec "$CONTAINER" bash -c "pgrep -f 'node src/index.js' 2>/dev/null" | while read pid; do
        echo "     PID: $pid (Command: $(docker exec "$CONTAINER" ps -p $pid -o cmd= 2>/dev/null || echo 'Unknown'))"
    done

    # Check if processes are Kit Manager or Runtime
    echo "   Process Details:"
    docker exec "$CONTAINER" bash -c "ps aux | grep 'node src/index.js' | grep -v grep" | while read line; do
        if [[ "$line" == *"Kit-Manager"* ]]; then
            echo "     📋 Kit Manager: $line"
        elif [[ "$line" == *"workspace"* ]]; then
            echo "     🚗 Vehicle Edge Runtime: $line"
        fi
    done
else
    print_status "WARN" "No native Node.js processes running"
fi

echo ""

# Check Docker services
echo "🐳 Docker Services Status:"
if docker exec "$CONTAINER" command -v docker >/dev/null 2>&1; then
    print_status "OK" "Docker is available in simulation container"

    DOCKER_CONTAINERS=$(docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -E 'kit-manager|vehicle-edge-runtime' | wc -l" || echo "0")

    if [[ $DOCKER_CONTAINERS -gt 0 ]]; then
        print_status "OK" "Docker containers running ($DOCKER_CONTAINERS)"
        echo "   Container Details:"
        docker exec "$CONTAINER" bash -c "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" | while IFS=$'\t' read -r name status ports; do
            if [[ "$name" == *"kit-manager"* ]] || [[ "$name" == *"vehicle-edge-runtime"* ]]; then
                echo "     📦 $name: $status (Ports: $ports)"
            fi
        done
    else
        print_status "WARN" "No Docker containers running"
    fi

    # Check Docker images
    echo ""
    echo "   Available Docker Images:"
    docker exec "$CONTAINER" bash -c "docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'" | grep -E "kit-manager|vehicle-edge-runtime" || echo "     No simulation images found"
else
    print_status "WARN" "Docker is not available in simulation container"
    echo "   Install Docker with: ./2a-start-docker.sh"
fi

echo ""

# Check service endpoints
echo "🌐 Service Endpoints:"

if [[ "$MODE" != "none" ]]; then
    echo "   Testing endpoints inside simulation container..."

    # Check Kit Manager (port 3090)
    if docker exec "$CONTAINER" bash -c "curl -s --max-time 3 http://localhost:3090/listAllKits >/dev/null 2>&1"; then
        print_status "OK" "Kit Manager (port 3090): Responding"
        KITS=$(docker exec "$CONTAINER" curl -s http://localhost:3090/listAllKits 2>/dev/null | jq -r '.content | length' 2>/dev/null || echo "Unknown")
        echo "     Registered kits: $KITS"
    else
        print_status "ERROR" "Kit Manager (port 3090): Not responding"
    fi

    # Check Vehicle Edge Runtime Health (port 3003)
    if docker exec "$CONTAINER" bash -c "curl -s --max-time 3 http://localhost:3003/health >/dev/null 2>&1"; then
        print_status "OK" "Runtime Health (port 3003): Responding"
        HEALTH=$(docker exec "$CONTAINER" curl -s http://localhost:3003/health 2>/dev/null | jq -r '.status' 2>/dev/null || echo "Unknown")
        echo "     Health status: $HEALTH"
    else
        print_status "ERROR" "Runtime Health (port 3003): Not responding"
    fi

    # Check WebSocket API (port 3002)
    if docker exec "$CONTAINER" bash -c "timeout 3 bash -c 'echo >/dev/tcp/localhost/3002' 2>/dev/null"; then
        print_status "OK" "WebSocket API (port 3002): Listening"
    else
        print_status "ERROR" "WebSocket API (port 3002): Not listening"
    fi
else
    print_status "INFO" "No services running - skipping endpoint checks"
fi

echo ""

# Check data directory
echo "💾 Data Directory Status:"
if docker exec "$CONTAINER" test -d "/home/pi/vehicle-edge-runtime/workspace/data"; then
    print_status "OK" "Data directory exists"

    # Show data directory contents
    echo "   Data directory contents:"
    docker exec "$CONTAINER" bash -c "ls -la /home/pi/vehicle-edge-runtime/workspace/data/" 2>/dev/null | head -10 | while read line; do
        echo "     $line"
    done

    # Check for logs
    LOGS=$(docker exec "$CONTAINER" bash -c "find /home/pi/vehicle-edge-runtime/workspace/data -name '*.log' 2>/dev/null | wc -l" || echo "0")
    echo "   Log files found: $LOGS"
else
    print_status "WARN" "Data directory does not exist"
fi

echo ""

# Show system resources
echo "📊 System Resources:"
echo "   Container Memory Usage:"
docker stats "$CONTAINER" --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.CPUPerc}}" 2>/dev/null || echo "     Unable to get memory stats"

echo ""
echo "   Container Disk Usage:"
DISK_USAGE=$(docker exec "$CONTAINER" bash -c "du -sh /home/pi/vehicle-edge-runtime 2>/dev/null" || echo "Unknown")
echo "     Simulation files: $DISK_USAGE"

echo ""

# Quick actions menu
echo "🛠️  Quick Actions:"
echo "   Start services:"
echo "     Native:  ./2b-start-native.sh"
echo "     Docker:  ./2a-start-docker.sh"
echo ""
echo "   Stop services:"
echo "     Native:  ./3b-stop-native.sh"
echo "     Docker:  ./3a-stop-docker.sh"
echo ""
echo "   Check specific mode:"
echo "     Native:  ./4-check-status.sh native"
echo "     Docker:  ./4-check-status.sh docker"

echo ""

# Summary
if [[ "$MODE" == "native" ]]; then
    print_status "OK" "Simulation running in NATIVE mode"
    echo "   Services: Direct Node.js processes"
    echo "   LazyDocker: Not visible"
    echo "   Use: ./3b-stop-native.sh to stop"
elif [[ "$MODE" == "docker" ]]; then
    print_status "OK" "Simulation running in DOCKER mode"
    echo "   Services: Docker containers"
    echo "   LazyDocker: Visible and manageable"
    echo "   Use: ./3a-stop-docker.sh to stop"
elif [[ "$MODE" == "none" ]]; then
    print_status "INFO" "No services currently running"
    echo "   Use ./2b-start-native.sh or ./2a-start-docker.sh to start"
fi

echo ""
echo "=========================================="