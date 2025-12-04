#!/bin/sh

# Combined Kit-Manager + Vehicle Edge Runtime Startup Script
# Runs both services in the same container

cd /app/Kit-Manager

echo "Starting Kit-Manager on port 3090..."
npm start > /app/data/logs/kit-manager.log 2>&1 &
KIT_MANAGER_PID=$!

sleep 2

cd /app

echo "Starting Vehicle Edge Runtime on port 3002..."
npm start > /app/data/logs/vehicle-edge-runtime.log 2>&1 &
RUNTIME_PID=$!

sleep 3

echo "Combined Vehicle Edge Runtime started!"
echo ""
echo "Services:"
echo "  Kit-Manager WebSocket: ws://localhost:3090"
echo "  Runtime WebSocket: ws://localhost:3002/runtime"
echo "  Health Check: http://localhost:3003/health"
echo ""
echo "Processes:"
echo "  Kit-Manager PID: $KIT_MANAGER_PID"
echo "  Runtime PID: $RUNTIME_PID"
echo ""
echo "Logs:"
echo "  Kit-Manager: /app/data/logs/kit-manager.log"
echo "  Runtime: /app/data/logs/vehicle-edge-runtime.log"
echo ""
echo "To stop both services:"
echo "  kill $KIT_MANAGER_PID $RUNTIME_PID"

# Wait for both processes
wait $KIT_MANAGER_PID $RUNTIME_PID