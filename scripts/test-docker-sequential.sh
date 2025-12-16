#!/bin/bash

# Sequential Docker test runner
# This script runs Docker tests sequentially to avoid resource conflicts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test files in order of execution
declare -a TEST_FILES=(
    "tests/docker/build/dockerfile-build.test.js"
    "tests/docker/build/dockerfile-build-optimized.test.js"
    "tests/docker/deployment/docker-deploy-script.test.js"
    "tests/docker/deployment/docker-deploy-script-optimized.test.js"
    "tests/docker/runtime/container-lifecycle-fast.test.js"
    "tests/docker/runtime/container-lifecycle-optimized.test.js"
    "tests/docker/runtime/container-lifecycle.test.js"
    "tests/docker/integration/docker-websocket-api.test.js"
    "tests/docker/integration/docker-websocket-api-optimized.test.js"
)

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to run a single test
run_test() {
    local test_file=$1
    local start_time=$(date +%s)

    print_status "Running: $test_file"
    echo "----------------------------------------"

    # Run the test with increased timeout
    if node --test "$test_file" --test-timeout=180000; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_status "✅ PASSED: $test_file (${duration}s)"
        echo "----------------------------------------"
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_error "❌ FAILED: $test_file (${duration}s)"
        echo "----------------------------------------"
        return 1
    fi
}

# Main execution
main() {
    print_status "Starting sequential Docker tests..."
    echo ""

    local total_tests=${#TEST_FILES[@]}
    local passed_tests=0
    local failed_tests=0
    local overall_start_time=$(date +%s)

    # Clean up any existing containers and images before starting
    print_status "Cleaning up existing Docker resources..."
    docker system prune -f > /dev/null 2>&1 || true
    echo ""

    # Run each test
    for test_file in "${TEST_FILES[@]}"; do
        if [[ -f "$test_file" ]]; then
            if run_test "$test_file"; then
                ((passed_tests++))
            else
                ((failed_tests++))
                # Continue with other tests even if one fails
            fi
        else
            print_warning "Test file not found: $test_file"
        fi
        echo ""
    done

    # Final cleanup
    print_status "Final cleanup..."
    docker system prune -f > /dev/null 2>&1 || true

    # Summary
    local overall_end_time=$(date +%s)
    local total_duration=$((overall_end_time - overall_start_time))

    echo "========================================="
    print_status "Test Summary:"
    echo "  Total tests: $total_tests"
    echo "  Passed: $passed_tests"
    echo "  Failed: $failed_tests"
    echo "  Duration: ${total_duration}s"
    echo "========================================="

    if [[ $failed_tests -eq 0 ]]; then
        print_status "🎉 All Docker tests passed!"
        exit 0
    else
        print_error "💥 $failed_tests test(s) failed"
        exit 1
    fi
}

# Handle interrupt signal
trap 'print_error "Test execution interrupted"; exit 1' INT

# Run main function
main "$@"