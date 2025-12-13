#!/bin/bash

echo "Building Kit Manager Docker image..."
docker build -t kit-manager .

echo "Stopping and removing existing container if exists..."
docker stop kit-manager-container 2>/dev/null || true
docker rm kit-manager-container 2>/dev/null || true

echo "Starting Kit Manager container..."
# Create kuksa network if it doesn't exist
docker network create kuksa 2>/dev/null || true
docker run -d -p 3090:3090 --name kit-manager-container --network kuksa kit-manager

echo "Kit Manager is starting..."
echo "Access it at: http://localhost:3090"
echo "View logs with: docker logs -f kit-manager-container"
echo "Stop with: docker stop kit-manager-container"