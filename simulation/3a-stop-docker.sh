#!/bin/bash
# Stop Vehicle Edge Runtime services running in Docker containers

set -euo pipefail

CONTAINER="vehicle-edge-pi"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    echo "Container $CONTAINER is not running"
    exit 1
fi

echo "Stopping Docker Vehicle Edge Runtime services..."

# Check if Docker is available
if ! docker exec "$CONTAINER" command -v docker >/dev/null 2>&1; then
    echo "Docker is not available in simulation container"
    exit 1
fi

# Check if any Docker containers are running
RUNNING_CONTAINERS=$(docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -E 'kit-manager|vehicle-edge-runtime' | wc -l" || echo "0")

if [[ $RUNNING_CONTAINERS -eq 0 ]]; then
    echo "No Docker Vehicle Edge Runtime services are running"
    echo ""
    echo "Running Docker containers:"
    docker exec "$CONTAINER" bash -c "docker ps --format 'table {{.Names}}\t{{.Status}}'" || echo "None"
    exit 0
fi

echo "Found $RUNNING_CONTAINERS running Vehicle Edge Runtime container(s)"
echo "Current containers:"
docker exec "$CONTAINER" bash -c "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" | grep -E 'kit-manager|vehicle-edge-runtime' || echo "None found"

# Stop containers gracefully
echo ""
echo "Stopping Docker containers..."
docker exec "$CONTAINER" bash -c "docker stop kit-manager vehicle-edge-runtime 2>/dev/null || true"

# Wait for graceful shutdown
sleep 5

# Remove containers
echo "Removing Docker containers..."
docker exec "$CONTAINER" bash -c "docker rm kit-manager vehicle-edge-runtime 2>/dev/null || true"

# Check if containers are still running
REMAINING_CONTAINERS=$(docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -E 'kit-manager|vehicle-edge-runtime' | wc -l" || echo "0")

if [[ $REMAINING_CONTAINERS -eq 0 ]]; then
    echo "✅ Docker Vehicle Edge Runtime services stopped successfully"
else
    echo "⚠️  $REMAINING_CONTAINERS container(s) still running"
    echo "Remaining containers:"
    docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}\t{{.Status}}'" | grep -E 'kit-manager|vehicle-edge-runtime' || echo "None found"
fi

# Force cleanup if requested
if [[ "${1:-}" == "--force" ]]; then
    echo "Force removing containers..."
    docker exec "$CONTAINER" bash -c "docker rm -f kit-manager vehicle-edge-runtime 2>/dev/null || true"
    echo "✅ Force cleanup completed"
fi

# Clean up unused Docker resources
if [[ "${1:-}" == "--cleanup" ]] || [[ "${2:-}" == "--cleanup" ]]; then
    echo ""
    echo "Cleaning up unused Docker resources..."
    docker exec "$CONTAINER" bash -c "
        docker system prune -f 2>/dev/null || true
        docker volume prune -f 2>/dev/null || true
        docker network prune -f 2>/dev/null || true
    "
    echo "✅ Docker cleanup completed"
fi

echo ""
echo "Docker services status:"
REMAINING=$(docker exec "$CONTAINER" bash -c "docker ps --format '{{.Names}}' | grep -E 'kit-manager|vehicle-edge-runtime' | wc -l" || echo "0")
echo "  Running containers: $REMAINING"
if [[ $REMAINING -gt 0 ]]; then
    echo "  Still running:"
    docker exec "$CONTAINER" bash -c "docker ps --format 'table {{.Names}}\t{{.Status}}'" | grep -E 'kit-manager|vehicle-edge-runtime' || echo "None found"
fi

echo ""
echo "Available commands:"
echo "  Start Docker services: ./2-start-docker.sh"
echo "  Start native services: ./2-start-native.sh"
echo "  Access shell: docker exec -it $CONTAINER su pi -c bash"
echo ""
echo "Docker Commands:"
echo "  View all containers: docker exec $CONTAINER docker ps -a"
echo "  View images: docker exec $CONTAINER docker images"