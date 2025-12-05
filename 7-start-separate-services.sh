#!/bin/sh

# Separate Kit-Manager + Vehicle Edge Runtime Startup Script
# Runs services in separate Docker containers (recommended approach)

echo "Starting Vehicle Edge Runtime Services (Separate Containers)"
echo "============================================================"

# Check Docker availability
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running or not accessible"
    exit 1
fi

# Stop existing containers
echo "🔄 Stopping existing containers..."
docker stop kit-manager vehicle-edge-runtime 2>/dev/null
docker rm kit-manager vehicle-edge-runtime 2>/dev/null

# Create network if it doesn't exist
echo "🌐 Setting up Docker network..."
docker network create vehicle-edge-network 2>/dev/null

# Build images
echo "🏗️  Building Kit-Manager image..."
cd Kit-Manager && docker build -t kit-manager:latest . && cd ..

echo "🏗️  Building Vehicle Edge Runtime image..."
docker build -f Dockerfile.runtime -t vehicle-edge-runtime:tests-fixed .

# Create data directory
mkdir -p data/applications data/logs data/configs

# Start Kit-Manager
echo "🚀 Starting Kit-Manager..."
docker run -d \
  --name kit-manager \
  --network vehicle-edge-network \
  -p 3090:3090 \
  --restart unless-stopped \
  kit-manager:latest

# Wait for Kit-Manager to be ready
echo "⏳ Waiting for Kit-Manager to start..."
sleep 5

# Test Kit-Manager
if curl -s http://localhost:3090/listAllKits > /dev/null; then
    echo "✅ Kit-Manager is running"
else
    echo "❌ Kit-Manager failed to start"
    exit 1
fi

# Start Vehicle Edge Runtime
echo "🚀 Starting Vehicle Edge Runtime..."
docker run -d \
  --name vehicle-edge-runtime \
  --network vehicle-edge-network \
  -p 3002:3002 -p 3003:3003 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$(pwd)/data:/app/data" \
  -e KIT_MANAGER_URL=ws://kit-manager:3090 \
  -e PORT=3002 \
  -e LOG_LEVEL=info \
  --restart unless-stopped \
  --user root \
  vehicle-edge-runtime:tests-fixed

# Wait for Vehicle Edge Runtime
echo "⏳ Waiting for Vehicle Edge Runtime to start..."
sleep 5

# Verify both services are running
echo ""
echo "📊 Service Status:"
KIT_STATUS=$(docker ps --format "{{.Names}}: {{.Status}}" | grep kit-manager)
RUNTIME_STATUS=$(docker ps --format "{{.Names}}: {{.Status}}" | grep vehicle-edge-runtime)

echo "  $KIT_STATUS"
echo "  $RUNTIME_STATUS"

echo ""
echo "🌐 Service Endpoints:"
echo "  Kit-Manager HTTP:    http://localhost:3090"
echo "  Kit-Manager WebSocket: ws://localhost:3090"
echo "  Runtime WebSocket:   ws://localhost:3002/runtime"
echo "  Runtime Health:      http://localhost:3003/health"

echo ""
echo "📁 Data Directory: ./data/"
echo "🐳 Container Names:  kit-manager, vehicle-edge-runtime"
echo "🌐 Docker Network:    vehicle-edge-network"

echo ""
echo "✅ Separate Vehicle Edge Runtime services started successfully!"
echo ""
echo "To view logs:"
echo "  docker logs -f kit-manager"
echo "  docker logs -f vehicle-edge-runtime"
echo ""
echo "To stop services:"
echo "  docker stop kit-manager vehicle-edge-runtime"