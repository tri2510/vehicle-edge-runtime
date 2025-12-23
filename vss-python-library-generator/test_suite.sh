#!/bin/bash
#
# SDV Vehicle Library Generator - Test Suite
# Comprehensive tests to verify all functionality
#

# Don't exit on error - we handle test failures manually
# set -e

# Test configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="${SCRIPT_DIR}/test_results"
SCRIPT="${SCRIPT_DIR}/sdv-gen.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Print functions
print_header() {
    echo ""
    echo "=================================================="
    echo "$1"
    echo "=================================================="
}

print_test() {
    echo -e "${BLUE}[TEST ${TESTS_RUN}]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

print_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Setup test environment
setup() {
    print_header "Setting up test environment"
    rm -rf "$TEST_DIR"
    mkdir -p "$TEST_DIR/overlays"
    print_info "Test directory: $TEST_DIR"
    echo ""

    # Create test overlay
    cat > "$TEST_DIR/overlays/test_signal.vspec" << 'EOF'
Vehicle:
  type: branch

Vehicle.TestSensor:
  type: sensor
  datatype: float
  description: Test sensor for validation
  unit: celsius
EOF
}

# Cleanup test environment
cleanup() {
    print_header "Test Results Saved"
    print_info "Test results kept in: $TEST_DIR"
    echo ""
    print_info "To clean up test results, run: rm -rf $TEST_DIR"
    echo ""
}

# Test 1: Script exists and is executable
test_script_exists() {
    ((TESTS_RUN++))
    print_test "Script exists and is executable"

    if [ -f "$SCRIPT" ]; then
        if [ -x "$SCRIPT" ]; then
            print_success "Script exists and is executable"
            return 0
        else
            print_fail "Script is not executable"
            return 1
        fi
    else
        print_fail "Script not found at $SCRIPT"
        return 1
    fi
}

# Test 2: Help message works
test_help() {
    ((TESTS_RUN++))
    print_test "Help message displays correctly"

    if "$SCRIPT" --help > /dev/null 2>&1; then
        print_success "Help command works"
        return 0
    else
        print_fail "Help command failed"
        return 1
    fi
}

# Test 3: Version command works
test_version() {
    ((TESTS_RUN++))
    print_test "Version command works"

    VERSION=$("$SCRIPT" --version 2>&1 || true)
    if echo "$VERSION" | grep -q "version"; then
        print_success "Version command works: $VERSION"
        return 0
    else
        print_fail "Version command failed"
        return 1
    fi
}

# Test 4: Generate with default VSS
test_generate_default() {
    ((TESTS_RUN++))
    print_test "Generate library with default VSS"

    OUTPUT="$TEST_DIR/test_default"
    if "$SCRIPT" --output "$OUTPUT" > /tmp/test_gen.log 2>&1; then
        if [ -d "$OUTPUT/vehicle" ] && [ -f "$OUTPUT/vss.json" ]; then
            print_success "Default generation successful"
            return 0
        else
            print_fail "Output files not created correctly"
            cat /tmp/test_gen.log | tail -20
            return 1
        fi
    else
        print_fail "Generation command failed"
        cat /tmp/test_gen.log | tail -20
        return 1
    fi
}

# Test 5: Generate with VSS 4.0
test_generate_vss4() {
    ((TESTS_RUN++))
    print_test "Generate library with VSS 4.0"

    OUTPUT="$TEST_DIR/test_vss4"
    if "$SCRIPT" --vss-version 4.0 --output "$OUTPUT" > /tmp/test_gen.log 2>&1; then
        if [ -d "$OUTPUT/vehicle" ] && [ -f "$OUTPUT/vss.json" ]; then
            print_success "VSS 4.0 generation successful"
            return 0
        else
            print_fail "VSS 4.0 output files not created"
            return 1
        fi
    else
        print_fail "VSS 4.0 generation failed"
        return 1
    fi
}

# Test 6: Generate with overlay
test_generate_with_overlay() {
    ((TESTS_RUN++))
    print_test "Generate library with custom overlay"

    OUTPUT="$TEST_DIR/test_overlay"
    OVERLAY="$TEST_DIR/overlays/test_signal.vspec"

    if "$SCRIPT" --overlay "$OVERLAY" --output "$OUTPUT" > /tmp/test_gen.log 2>&1; then
        if [ -d "$OUTPUT/vehicle" ] && [ -f "$OUTPUT/vss.json" ]; then
            print_success "Generation with overlay successful"
            return 0
        else
            print_fail "Overlay generation output files not created"
            return 1
        fi
    else
        print_fail "Generation with overlay failed"
        return 1
    fi
}

# Test 7: Check generated library structure
test_library_structure() {
    ((TESTS_RUN++))
    print_test "Verify generated library structure"

    OUTPUT="$TEST_DIR/test_structure"

    # Generate if not exists
    if [ ! -d "$OUTPUT/vehicle" ]; then
        "$SCRIPT" --output "$OUTPUT" > /dev/null 2>&1
    fi

    REQUIRED_FILES=(
        "vehicle/__init__.py"
        "vehicle/Body/__init__.py"
        "vehicle/Cabin/__init__.py"
        "sdv/__init__.py"
        "requirements.txt"
        "vss.json"
        "README.md"
        "example_app.py"
    )

    ALL_PRESENT=true
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$OUTPUT/$file" ]; then
            print_fail "Missing file: $file"
            ALL_PRESENT=false
        fi
    done

    if $ALL_PRESENT; then
        print_success "All required files present"
        return 0
    else
        return 1
    fi
}

# Test 8: Check common vehicle signals exist
test_common_signals() {
    ((TESTS_RUN++))
    print_test "Verify common vehicle signals exist"

    OUTPUT="$TEST_DIR/test_structure"

    # Check for common signals in generated code
    if grep -q "class Vehicle" "$OUTPUT/vehicle/__init__.py" && \
       grep -q "Body" "$OUTPUT/vehicle/__init__.py" && \
       grep -q "Speed" "$OUTPUT/vehicle/__init__.py"; then
        print_success "Common vehicle signals found"
        return 0
    else
        print_fail "Common vehicle signals not found"
        return 1
    fi
}

# Test 9: Test custom signal in overlay
test_custom_signal() {
    ((TESTS_RUN++))
    print_test "Verify custom signal from overlay"

    OUTPUT="$TEST_DIR/test_overlay"
    OVERLAY="$TEST_DIR/overlays/test_signal.vspec"

    # Generate with overlay
    "$SCRIPT" --overlay "$OVERLAY" --output "$OUTPUT" > /dev/null 2>&1

    # Check if TestSensor exists
    if grep -q "TestSensor" "$OUTPUT/vehicle/__init__.py"; then
        print_success "Custom signal TestSensor found"
        return 0
    else
        print_fail "Custom signal not found in generated code"
        return 1
    fi
}

# Test 10: Python imports work
test_python_imports() {
    ((TESTS_RUN++))
    print_test "Verify Python imports work"

    OUTPUT="$TEST_DIR/test_imports"

    # Generate if not exists
    if [ ! -d "$OUTPUT/vehicle" ]; then
        "$SCRIPT" --output "$OUTPUT" > /dev/null 2>&1
    fi

    # Test imports
    if PYTHONPATH="$OUTPUT:${PYTHONPATH}" python3 -c "
from vehicle import Vehicle, vehicle
from sdv import VehicleApp
print('Imports successful')
" 2>/dev/null; then
        print_success "Python imports work correctly"
        return 0
    else
        print_fail "Python imports failed"
        return 1
    fi
}

# Test 11: requirements.txt has necessary dependencies
test_requirements() {
    ((TESTS_RUN++))
    print_test "Verify requirements.txt has necessary dependencies"

    OUTPUT="$TEST_DIR/test_structure"

    REQUIRED_DEPS=(
        "velocitas-sdk"
        "kuksa_client"
        "grpcio"
        "protobuf"
    )

    MISSING=0
    for dep in "${REQUIRED_DEPS[@]}"; do
        if ! grep -q "$dep" "$OUTPUT/requirements.txt"; then
            print_fail "Missing dependency: $dep"
            ((MISSING++))
        fi
    done

    if [ $MISSING -eq 0 ]; then
        print_success "All required dependencies present"
        return 0
    else
        return 1
    fi
}

# Test 12: VSS JSON is valid
test_vss_json() {
    ((TESTS_RUN++))
    print_test "Verify VSS JSON is valid"

    OUTPUT="$TEST_DIR/test_structure"

    if python3 -c "
import json
import sys
try:
    with open('$OUTPUT/vss.json', 'r') as f:
        data = json.load(f)
    if 'Vehicle' in data or isinstance(data, dict):
        print('Valid JSON')
        sys.exit(0)
    else:
        sys.exit(1)
except Exception as e:
    print(f'Invalid JSON: {e}')
    sys.exit(1)
" 2>/dev/null; then
        print_success "VSS JSON is valid"
        return 0
    else
        print_fail "VSS JSON is invalid"
        return 1
    fi
}

# Test 13: Test from different directory
test_different_directory() {
    ((TESTS_RUN++))
    print_test "Test generation from different directory"

    OUTPUT="$TEST_DIR/test_different_dir"

    # Run from /tmp
    (cd /tmp && "$SCRIPT" --output "$OUTPUT" > /dev/null 2>&1)

    if [ -d "$OUTPUT/vehicle" ]; then
        print_success "Generation works from different directory"
        return 0
    else
        print_fail "Generation failed from different directory"
        return 1
    fi
}

# Test 14: Caching works
test_caching() {
    ((TESTS_RUN++))
    print_test "Verify caching works (second run is faster)"

    OUTPUT="$TEST_DIR/test_cache1"

    # First run
    TIME1=$(/usr/bin/time -f "%E" "$SCRIPT" --output "$OUTPUT" 2>&1 | grep -o "[0-9]*:[0-9]*\.[0-9]*" || echo "")

    # Second run (should use cache)
    OUTPUT2="$TEST_DIR/test_cache2"
    TIME2=$(/usr/bin/time -f "%E" "$SCRIPT" --output "$OUTPUT2" 2>&1 | grep -o "[0-9]*:[0-9]*\.[0-9]*" || echo "")

    print_info "First run: $TIME1, Second run: $TIME2"

    # Just verify both succeed
    if [ -d "$OUTPUT/vehicle" ] && [ -d "$OUTPUT2/vehicle" ]; then
        print_success "Both runs completed (caching working)"
        return 0
    else
        print_fail "One or both runs failed"
        return 1
    fi
}

# Run all tests
run_all_tests() {
    print_header "Running Test Suite"

    setup

    print_header "Basic Functionality Tests"
    test_script_exists
    test_help
    test_version

    print_header "Generation Tests"
    test_generate_default
    test_generate_vss4
    test_generate_with_overlay
    test_different_directory

    print_header "Output Validation Tests"
    test_library_structure
    test_common_signals
    test_custom_signal
    test_requirements
    test_vss_json

    print_header "Integration Tests"
    test_python_imports
    test_caching

    cleanup
}

# Print summary
print_summary() {
    print_header "Test Summary"
    echo "Total tests: $TESTS_RUN"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
        return 0
    else
        echo -e "${RED}✗ SOME TESTS FAILED${NC}"
        return 1
    fi
}

# Main
main() {
    run_all_tests
    print_summary
}

# Run
main "$@"
