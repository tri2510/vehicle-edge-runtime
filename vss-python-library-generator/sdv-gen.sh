#!/bin/bash
#
# SDV Vehicle Library Generator - Standalone Shell Script
# Black-box wrapper for generating Python vehicle libraries from VSS specifications
#
# Usage: ./sdv-gen.sh [OPTIONS]
#

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="${SCRIPT_DIR}"

# Default values
VSS_VERSION="default"
VSS_DIR=""
OUTPUT_DIR="output"
OVERLAYS=()
SHOW_HELP=0
SHOW_VERSION=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# Help message
show_help() {
    cat << EOF
🚗 SDV Vehicle Library Generator v1.0.0

Generate Python vehicle libraries from VSS (Vehicle Signal Specification) files.

USAGE:
    ./sdv-gen.sh [OPTIONS]

OPTIONS:
    -o, --overlay FILE       Add custom VSS overlay file (can be used multiple times)
    --vss-version VERSION    VSS version to use (3.0, 3.1, 3.1.1, 4.0, default)
    --vss-dir DIR           Use custom VSS specification directory
    --output, -out DIR      Output directory (default: ./output)
    -v, --version           Show version number
    -h, --help              Show this help message

EXAMPLES:
    # Generate with default VSS
    ./sdv-gen.sh

    # Generate with VSS 4.0
    ./sdv-gen.sh --vss-version 4.0

    # Generate with custom overlay
    ./sdv-gen.sh --overlay my_signals.vspec

    # Generate to custom directory
    ./sdv-gen.sh --output /path/to/output

    # Combine options
    ./sdv-gen.sh --vss-version 4.0 --overlay custom.vspec --output my_lib

SUPPORTED VSS VERSIONS:
    default - Use bundled VSS in src/
    4.0     - VSS version 4.0 (recommended)
    3.1.1   - VSS version 3.1.1
    3.1     - VSS version 3.1
    3.0     - VSS version 3.0

OUTPUT:
    The generated library will be in the output directory with:
    - vehicle/      Generated Python module
    - sdv/          Velocitas SDK alias
    - requirements.txt Runtime dependencies
    - vss.json      VSS in JSON format
    - README.md     Documentation

For more information, see INSTALL.md

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -o|--overlay)
            OVERLAYS+=("$2")
            shift 2
            ;;
        --vss-version)
            VSS_VERSION="$2"
            shift 2
            ;;
        --vss-dir)
            VSS_DIR="$2"
            shift 2
            ;;
        --output|-out)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -v|--version)
            SHOW_VERSION=1
            shift
            ;;
        -h|--help)
            SHOW_HELP=1
            shift
            ;;
        *)
            error "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Show version
if [ "$SHOW_VERSION" -eq 1 ]; then
    echo "sdv-gen version 1.0.0"
    exit 0
fi

# Show help
if [ "$SHOW_HELP" -eq 1 ]; then
    show_help
    exit 0
fi

# Validate VSS version
case "$VSS_VERSION" in
    3.0|3.1|3.1.1|4.0|default)
        ;;
    *)
        error "Invalid VSS version: $VSS_VERSION"
        echo "Supported versions: 3.0, 3.1, 3.1.1, 4.0, default"
        exit 1
        ;;
esac

# Validate overlay files
for overlay in "${OVERLAYS[@]}"; do
    if [ ! -f "$overlay" ]; then
        error "Overlay file not found: $overlay"
        exit 1
    fi
done

# Print header
echo "=================================================="
echo "🚗 SDV Vehicle Library Generator"
echo "=================================================="
echo ""

# Show VSS version
if [ "$VSS_VERSION" = "default" ]; then
    info "VSS Version: default (local copy)"
else
    info "VSS Version: $VSS_VERSION"
    if [[ "$VSS_VERSION" =~ ^3\. ]]; then
        warning "VSS $VSS_VERSION may not be fully compatible with vss-tools 4.0"
        warning "If errors occur, use 'default' version or VSS 4.0"
    fi
fi
echo ""

# Check if src directory exists
if [ ! -d "$BASE_DIR/src" ]; then
    error "Cannot find src/ directory"
    error "Please run this script from the repository root directory"
    exit 1
fi

# Build Python command arguments
PYTHON_ARGS=()
PYTHON_ARGS+=("--output" "$OUTPUT_DIR")

if [ "$VSS_VERSION" != "default" ]; then
    PYTHON_ARGS+=("--vss-version" "$VSS_VERSION")
fi

if [ -n "$VSS_DIR" ]; then
    if [ ! -d "$VSS_DIR" ]; then
        error "VSS directory not found: $VSS_DIR"
        exit 1
    fi
    PYTHON_ARGS+=("--vss-dir" "$VSS_DIR")
fi

for overlay in "${OVERLAYS[@]}"; do
    PYTHON_ARGS+=("--overlay" "$overlay")
done

# Run the Python generator
info "Running generator..."
cd "$BASE_DIR"

# Check if Python package is installed
if ! python3 -c "import sdv_lib_generator" 2>/dev/null; then
    warning "Package not installed. Installing..."
    pip3 install -e . --quiet
    success "Package installed"
fi

# Run the CLI
python3 -m sdv_lib_generator.cli "${PYTHON_ARGS[@]}"

exit $?
