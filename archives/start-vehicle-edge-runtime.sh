#!/bin/sh

# Vehicle Edge Runtime Startup Script

cd "$(dirname "$0")" || exit 1

PORT=3002

# kill existing processes
pid=$(lsof -ti:$PORT 2>/dev/null)
[ -n "$pid" ] && kill -9 $pid 2>/dev/null

# create .env if missing
[ ! -f .env ] && cp .env.example .env

# load env
export $(grep -v '^#' .env | xargs)

# create directories
mkdir -p data/applications data/logs data/configs

# check Docker availability
if ! docker info >/dev/null 2>&1; then
    echo "error: Docker is not running or not accessible" >&2
    exit 1
fi

# install deps if needed
[ ! -d "node_modules" ] && npm install

# start Vehicle Edge Runtime
echo "Starting Vehicle Edge Runtime..."
echo "Port: ${PORT:-3002}"
echo "Logs: ./logs/vehicle-edge-runtime.log"
echo "Data: ./data/"

mkdir -p ../logs
npm run dev > ../logs/vehicle-edge-runtime.log 2>&1 &
RUNTIME_PID=$!

sleep 2

echo "Vehicle Edge Runtime started with PID: $RUNTIME_PID"
echo "WebSocket: ws://localhost:${PORT:-3002}/runtime"
echo "logs: ../logs/vehicle-edge-runtime.log"

tail -f ../logs/vehicle-edge-runtime.log &
TAIL_PID=$!
trap "kill $TAIL_PID 2>/dev/null" EXIT

wait $RUNTIME_PID