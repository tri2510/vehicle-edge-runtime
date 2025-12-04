#!/bin/sh

# Vehicle Edge Runtime Docker Setup Script
# This script sets up and runs the Vehicle Edge Runtime in Docker containers

set -e

echo "Vehicle Edge Runtime Docker Setup"
echo "================================="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Error: Docker is not running or not accessible"
    echo "Please start Docker and try again"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
    echo "Error: Docker Compose is not available"
    echo "Please install Docker Compose and try again"
    exit 1
fi

# Function to detect docker-compose command
DOCKER_COMPOSE_CMD=""
if command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
fi

# Create data directories
echo "Creating data directories..."
mkdir -p data/applications data/logs data/configs

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.docker .env
    echo "Created .env file. You can modify it as needed."
fi

# Parse command line arguments
COMMAND=${1:-"dev"}

case "$COMMAND" in
    "dev")
        echo "Starting Vehicle Edge Runtime in development mode..."
        echo "This will start the runtime with hot-reloading and development tools"
        echo ""
        echo "The following services will be available:"
        echo "- Vehicle Edge Runtime: ws://localhost:3002/runtime"
        echo "- Health Check: http://localhost:3003/health"
        echo "- Redis: localhost:6379"
        echo ""
        echo "Press Ctrl+C to stop all services"
        echo ""
        $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml up --build
        ;;
    "prod")
        echo "Starting Vehicle Edge Runtime in production mode..."
        echo "This will start the runtime with production optimizations"
        echo ""
        $DOCKER_COMPOSE_CMD up -d --build
        echo "Services started in background"
        echo ""
        echo "To view logs: $0 logs"
        echo "To stop services: $0 down"
        ;;
    "build")
        echo "Building Docker image..."
        docker build -t vehicle-edge-runtime .
        echo "Build completed. Image tag: vehicle-edge-runtime"
        ;;
    "run")
        echo "Running single container..."
        echo "This runs the runtime without Docker Compose"
        echo ""
        docker run -it --rm \
            -p 3002:3002 -p 3003:3003 \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v "$(pwd)/data:/app/data" \
            --name vehicle-edge-runtime \
            vehicle-edge-runtime
        ;;
    "logs")
        echo "Showing logs..."
        $DOCKER_COMPOSE_CMD logs -f vehicle-edge-runtime
        ;;
    "down")
        echo "Stopping and removing containers..."
        $DOCKER_COMPOSE_CMD down
        echo "Services stopped"
        ;;
    "clean")
        echo "Cleaning up containers, images, and volumes..."
        $DOCKER_COMPOSE_CMD down -v --rmi all
        docker system prune -f
        echo "Cleanup completed"
        ;;
    "status")
        echo "Container status:"
        $DOCKER_COMPOSE_CMD ps
        ;;
    "test")
        echo "Running tests against running container..."
        if [ -f test-client.js ]; then
            node test-client.js
        else
            echo "Error: test-client.js not found"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  dev     - Start development environment with hot-reload (default)"
        echo "  prod    - Start production environment in background"
        echo "  build   - Build Docker image only"
        echo "  run     - Run single container without Docker Compose"
        echo "  logs    - Show logs from running containers"
        echo "  down    - Stop and remove containers"
        echo "  clean   - Clean up all containers, images, and volumes"
        echo "  status  - Show container status"
        echo "  test    - Run tests against running container"
        echo ""
        echo "Examples:"
        echo "  $0              # Start development mode"
        echo "  $0 prod         # Start production mode"
        echo "  $0 logs         # View logs"
        echo "  $0 down         # Stop services"
        exit 1
        ;;
esac