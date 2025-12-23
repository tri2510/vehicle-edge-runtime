#!/bin/bash

set -e

echo "CI Test Suite - Vehicle Edge Runtime"
echo "=================================="

# Environment
export CI=true
export NODE_ENV=test
export SKIP_KUKSA=true
export KIT_MANAGER_URL=ws://kit.digitalauto.tech

# Cleanup
docker system prune -f >/dev/null 2>&1 || true

# Tests
failed=0

echo "Unit tests..."
npm run test:unit || failed=1

echo "Integration tests..."
npm run test:integration || failed=1

echo "Docker tests..."
npm run test:docker || failed=1

echo "Validation tests..."
node --test tests/basic-validation.test.js || failed=1

# Cleanup
docker system prune -f >/dev/null 2>&1 || true

# Result
if [ $failed -eq 0 ]; then
    echo "All tests passed"
    exit 0
else
    echo "Tests failed"
    exit 1
fi