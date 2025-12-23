#!/bin/bash
# Copyright (c) 2025 Eclipse Foundation.
#
# Vehicle Edge Runtime - Production Cleanup Script
# Removes test-generated files and prepares for production deployment

set -e

echo "🧹 Vehicle Edge Runtime - Production Cleanup"
echo "============================================"

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to remove if exists
safe_remove() {
    if [ -e "$1" ]; then
        echo "Removing: $1"
        rm -rf "$1"
    else
        echo "Already removed: $1"
    fi
}

# Function to clean directory contents but keep structure
clean_directory_contents() {
    local dir="$1"
    if [ -d "$dir" ]; then
        echo "Cleaning directory contents: $dir"
        find "$dir" -mindepth 1 -delete
    else
        echo "Directory doesn't exist: $dir"
    fi
}

echo ""
echo "🗑️  Removing test-generated files..."

# Remove PID files
safe_remove "kuksa-server.pid"

# Remove test reports
safe_remove "test-reports"

# Remove workspace directory (test artifacts)
safe_remove "workspace"

# Clean application deployment artifacts (499 deploy_* folders)
if [ -d "data/applications/dependencies" ]; then
    echo "Cleaning test deployment folders..."
    find data/applications/dependencies -name "deploy_*" -type d -exec rm -rf {} + 2>/dev/null || true
fi

# Clean application logs
if [ -d "data/logs" ]; then
    echo "Cleaning application logs..."
    find data/logs -name "app-*.log" -delete 2>/dev/null || true
fi

# Clean test database (but keep structure)
safe_remove "data/vehicle-edge.db"
safe_remove "data/vehicle-edge.db-shm"
safe_remove "data/vehicle-edge.db-wal"

# Clean temporary files
find . -name "*.tmp" -delete 2>/dev/null || true
find . -name "*.temp" -delete 2>/dev/null || true

echo ""
echo "📊 Cleanup summary:"
echo "===================="

# Show what remains
echo "✅ Essential directories preserved:"
echo "   - src/                    (source code)"
echo "   - data/                   (data structure, cleaned)"
echo "   - tests/                  (test suite)"
echo "   - proto/                  (protobuf files)"
echo "   - Kit-Manager/            (kit manager)"
echo "   - simulation/             (simulation files)"
echo "   - example/                (example files)"

echo ""
echo "🗑️  Removed for production:"
echo "   - 499 test deployment folders"
echo "   - Application logs (app-*.log)"
echo "   - Test database files"
echo "   - PID files"
echo "   - Test reports"
echo "   - Workspace artifacts"
echo "   - Temporary files"

echo ""
echo "🐳 Ready for Docker build:"
echo "   docker build -t vehicle-edge-runtime:latest ."
echo "   docker-compose up -d"

echo ""
echo "✨ Production cleanup complete!"