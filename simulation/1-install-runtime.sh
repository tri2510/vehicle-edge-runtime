#!/bin/bash
# Install Vehicle Edge Runtime inside running pi-ci container

set -euo pipefail

CONTAINER="vehicle-edge-pi"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    echo "Container $CONTAINER is not running"
    echo "Start it first: ./0-start-pi-ci.sh"
    exit 1
fi

echo "Installing Vehicle Edge Runtime in pi-ci container..."

# Check if Node.js and npm are available
if ! docker exec "$CONTAINER" bash -c "command -v node >/dev/null && command -v npm >/dev/null"; then
    echo "Node.js/npm not found, installing..."
    # Install as root with proper error handling
    docker exec "$CONTAINER" bash -c "apt-get update || true"
    docker exec "$CONTAINER" bash -c "apt-get install -y curl git python3 tar wget || true"

    # Clean up any existing Node.js installations
    echo "Cleaning up any existing Node.js installations..."
    docker exec "$CONTAINER" bash -c "apt-get remove -y nodejs npm 2>/dev/null || true"

    # Use binary installation approach to avoid package conflicts
    echo "Installing Node.js 18.x using binary distribution..."
    docker exec "$CONTAINER" bash -c "
        cd /usr/local &&
        wget -q https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.xz &&
        tar -xf node-v18.19.0-linux-x64.tar.xz &&
        mv node-v18.19.0-linux-x64 nodejs &&
        rm node-v18.19.0-linux-x64.tar.xz

        # Remove old Node.js binaries first
        rm -f /usr/bin/node /usr/bin/npm /usr/bin/npx

        # Create symlinks to the new Node.js
        ln -sf /usr/local/nodejs/bin/node /usr/bin/node &&
        ln -sf /usr/local/nodejs/bin/npm /usr/bin/npm &&
        ln -sf /usr/local/nodejs/bin/npx /usr/bin/npx

        # Update PATH in /etc/profile for future sessions
        echo 'export PATH=/usr/local/nodejs/bin:$PATH' >> /etc/profile

        # Update PATH for current session
        export PATH=/usr/local/nodejs/bin:$PATH
    "

    # Verify installation
    echo "Verifying Node.js and npm installation..."
    if ! docker exec "$CONTAINER" command -v node >/dev/null; then
        echo "ERROR: Node.js not found after binary installation"
        exit 1
    fi

    if ! docker exec "$CONTAINER" command -v npm >/dev/null; then
        echo "ERROR: npm not found after binary installation"
        docker exec "$CONTAINER" ls -la /usr/local/nodejs/bin/ || echo "Node.js bin directory not found"
        exit 1
    fi

    echo "Node.js version:"
    docker exec "$CONTAINER" node --version
    echo "npm version:"
    docker exec "$CONTAINER" npm --version
fi

# Create pi user and home directory if needed
echo "Setting up pi user environment..."
docker exec "$CONTAINER" bash -c "
    if ! id pi >/dev/null 2>&1; then
        useradd -m -s /bin/bash pi
    fi
    mkdir -p /home/pi/vehicle-edge-runtime

    # Remove existing directory and copy fresh to avoid issues
    rm -rf /home/pi/vehicle-edge-runtime/workspace
    cp -r /workspace /home/pi/vehicle-edge-runtime/workspace

    chown -R pi:pi /home/pi/vehicle-edge-runtime
"

# Install dependencies as pi user
echo "Installing Node.js dependencies..."
docker exec "$CONTAINER" bash -c "
    cd /home/pi/vehicle-edge-runtime/workspace &&
    su pi -c 'npm install'
"

# Create environment as pi user
echo "Creating environment configuration..."
docker exec "$CONTAINER" bash -c "
    cd /home/pi/vehicle-edge-runtime/workspace &&
    su pi -c 'cp .env.example .env 2>/dev/null || echo \"PORT=3002\" > .env'
"

echo "🎉 Installation complete!"
echo ""
echo "📋 Next Steps (Follow the numbers):"
echo "  1. Start services:"
echo "     Native mode (fast):   ./2b-start-native.sh"
echo "     Docker mode (LazyDocker): ./2a-start-docker.sh"
echo "  2. Check status:           ./4-check-status.sh"
echo "  3. Stop services:"
echo "     Native mode:            ./3b-stop-native.sh"
echo "     Docker mode:            ./3a-stop-docker.sh"
echo ""
echo "💡 Quick Test:"
echo "  docker exec -it $CONTAINER su pi -c bash"