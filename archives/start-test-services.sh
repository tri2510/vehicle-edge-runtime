#!/bin/bash
# Start all required services for Docker testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Test Services for Docker Tests${NC}"
echo "=============================================="

# Function to check if service is ready
check_service() {
    local service_name=$1
    local host=$2
    local port=$3
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Waiting for $service_name (${host}:${port})...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if timeout 2 bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
            echo -e "${GREEN}✅ $service_name is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    echo -e "\n${RED}❌ $service_name failed to start within expected time${NC}"
    return 1
}

# Function to start Kit Manager
start_kit_manager() {
    echo -e "${YELLOW}📦 Starting Kit Manager...${NC}"
    
    # Navigate to Kit-Manager directory
    cd Kit-Manager
    
    # Check if start.sh exists and is executable
    if [ ! -f "start.sh" ]; then
        echo -e "${RED}❌ Kit-Manager start.sh not found${NC}"
        return 1
    fi
    
    chmod +x start.sh
    
    # Start Kit Manager
    ./start.sh
    
    # Go back to main directory
    cd ..
    
    # Wait for Kit Manager to be ready
    check_service "Kit Manager" "localhost" 3090
}

# Function to start Kuksa Databroker
start_kuksa() {
    echo -e "${YELLOW}🚗 Starting Kuksa Databroker...${NC}"
    
    # Check if Kuksa script exists
    if [ ! -f "simulation/6-start-kuksa-server.sh" ]; then
        echo -e "${RED}❌ Kuksa startup script not found${NC}"
        return 1
    fi
    
    chmod +x simulation/6-start-kuksa-server.sh
    
    # Start Kuksa (this will handle dependencies like Docker network)
    ./simulation/6-start-kuksa-server.sh
    
    # Wait for Kuksa to be ready
    check_service "Kuksa Databroker" "localhost" 55555
}

# Function to cleanup services
cleanup_services() {
    echo -e "${YELLOW}🧹 Cleaning up existing services...${NC}"
    
    # Stop existing Kit Manager container
    docker stop kit-manager-container 2>/dev/null || true
    docker rm kit-manager-container 2>/dev/null || true
    
    # Stop existing Kuksa container
    docker stop kuksa-databroker 2>/dev/null || true
    docker rm kuksa-databroker 2>/dev/null || true
}

# Function to show service status
show_service_status() {
    echo ""
    echo -e "${BLUE}📊 Service Status${NC}"
    echo "==================="
    
    # Kit Manager status
    if docker ps -q -f name="kit-manager-container" | grep -q . > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Kit Manager: Running (localhost:3090)${NC}"
    else
        echo -e "${RED}❌ Kit Manager: Not running${NC}"
    fi
    
    # Kuksa status
    if docker ps -q -f name="kuksa-databroker" | grep -q . > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Kuksa Databroker: Running (localhost:55555)${NC}"
    else
        echo -e "${RED}❌ Kuksa Databroker: Not running${NC}"
    fi
}

# Function to stop all services
stop_services() {
    echo -e "${YELLOW}🛑 Stopping all test services...${NC}"
    
    # Stop Kit Manager
    if docker ps -q -f name="kit-manager-container" | grep -q . > /dev/null 2>&1; then
        docker stop kit-manager-container
        docker rm kit-manager-container
        echo -e "${GREEN}✅ Kit Manager stopped${NC}"
    fi
    
    # Stop Kuksa
    if docker ps -q -f name="kuksa-databroker" | grep -q . > /dev/null 2>&1; then
        docker stop kuksa-databroker
        docker rm kuksa-databroker
        echo -e "${GREEN}✅ Kuksa Databroker stopped${NC}"
    fi
}

# Main execution
main() {
    case "${1:-start}" in
        "start"|"")
            cleanup_services
            start_kit_manager
            start_kuksa
            show_service_status
            echo ""
            echo -e "${GREEN}🎉 All test services are ready!${NC}"
            echo ""
            echo -e "${BLUE}Test Environment Variables:${NC}"
            echo "  KIT_MANAGER_URL=ws://localhost:3090"
            echo "  KUKSA_ENABLED=true"
            echo "  KUKSA_HOST=localhost"
            echo "  KUKSA_GRPC_PORT=55555"
            ;;
        "stop")
            stop_services
            ;;
        "status")
            show_service_status
            ;;
        "restart")
            stop_services
            sleep 2
            main start
            ;;
        "cleanup")
            cleanup_services
            echo -e "${GREEN}✅ Cleanup completed${NC}"
            ;;
        "help"|"-h"|"--help")
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  start    Start all test services (default)"
            echo "  stop     Stop all test services"
            echo "  status   Show service status"
            echo "  restart  Restart all test services"
            echo "  cleanup  Clean up existing containers"
            echo "  help     Show this help message"
            echo ""
            echo "This script starts the local Kit Manager and Kuksa Databroker"
            echo "required for Docker integration and runtime tests."
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $1${NC}"
            echo "Use '$0 help' for available commands"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}⚠️ Script interrupted${NC}"; stop_services; exit 1' INT

# Run main function
main "$@"