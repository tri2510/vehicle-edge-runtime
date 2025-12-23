#!/bin/bash
#
# Installation script for SDV Vehicle Library Generator
# Installs the sdv-gen command globally
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

success() { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${BLUE}ℹ${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================="
echo "🚦 SDV Vehicle Library Generator - Installation"
echo "=================================================="
echo ""

# Check if running from correct directory
if [ ! -f "$SCRIPT_DIR/setup.py" ]; then
    error "Please run this script from the repository root directory"
    exit 1
fi

# Install Python package
info "Installing Python package..."
pip3 install -e "$SCRIPT_DIR" --quiet
success "Python package installed"

# Create symlink in /usr/local/bin
if [ -w /usr/local/bin ] || sudo -n true 2>/dev/null; then
    info "Creating global command symlink..."

    # Use sudo if needed
    if [ -w /usr/local/bin ]; then
        ln -sf "$SCRIPT_DIR/sdv-gen.sh" /usr/local/bin/sdv-gen
    else
        sudo ln -sf "$SCRIPT_DIR/sdv-gen.sh" /usr/local/bin/sdv-gen
    fi

    success "Global 'sdv-gen' command installed"
    echo ""
    echo "You can now run 'sdv-gen' from anywhere!"
else
    warning "Cannot write to /usr/local/bin"
    info "You can still use the script directly:"
    echo "  $SCRIPT_DIR/sdv-gen.sh"
fi

echo ""
echo "=================================================="
success "Installation completed!"
echo "=================================================="
echo ""
echo "Usage:"
echo "  sdv-gen                    # Generate with defaults"
echo "  sdv-gen --help             # Show all options"
echo "  sdv-gen --vss-version 4.0  # Use VSS 4.0"
echo "  sdv-gen --overlay x.vspec  # Add custom overlay"
echo ""
