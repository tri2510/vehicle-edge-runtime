#!/bin/bash
# ==============================================================================
# Vehicle Edge Runtime Setup Script
# Automatically installs all dependencies and starts the Vehicle Edge Runtime
# Works on Ubuntu, Debian, Raspberry Pi OS, CentOS, RHEL, Fedora
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$HOME/.vehicle-edge-runtime-venv"
RUNTIME_PATH="$HOME/vehicle-edge-runtime"
SERVICE_NAME="vehicle-edge-runtime"
SERVICE_USER="$USER"

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Detect system information
detect_system() {
    log "Detecting system information..."

    # OS Detection
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME=$NAME
        OS_VERSION=$VERSION_ID
    else
        OS_NAME=$(uname -s)
        OS_VERSION=$(uname -r)
    fi

    # Architecture Detection
    ARCH=$(uname -m)
    case $ARCH in
        x86_64)
            ARCH="x86_64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        armv7l)
            ARCH="armv7"
            ;;
        *)
            error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac

    log "Detected: $OS_NAME $OS_VERSION ($ARCH)"

    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        warning "Running as root. Consider running as a regular user."
        SERVICE_USER="vehicle-edge"
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."

    # Check minimum RAM
    TOTAL_RAM=$(free -m | awk 'NR==2{print $2}')
    if [ "$TOTAL_RAM" -lt 1024 ]; then
        error "Minimum 1GB RAM required. Found: ${TOTAL_RAM}MB"
        exit 1
    fi

    # Check disk space
    AVAILABLE_SPACE=$(df -BG "$HOME" | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -lt 2 ]; then
        error "Minimum 2GB free disk space required. Found: ${AVAILABLE_SPACE}GB"
        exit 1
    fi

    success "System requirements met: ${TOTAL_RAM}MB RAM, ${AVAILABLE_SPACE}GB disk space"
}

# Install system packages
install_system_packages() {
    log "Installing system packages..."

    if command -v apt-get &> /dev/null; then
        # Ubuntu/Debian/Raspberry Pi OS
        log "Using apt package manager..."

        # Update package list
        sudo apt-get update -qq

        # Install essential packages
        sudo apt-get install -y \
            curl \
            wget \
            git \
            build-essential \
            python3 \
            python3-pip \
            python3-venv \
            nodejs \
            npm \
            docker.io \
            docker-compose-plugin \
            systemd \
            ufw \
            jq \
            htop \
            net-tools \
            network-manager

    elif command -v dnf &> /dev/null; then
        # Fedora/RHEL/CentOS
        log "Using dnf package manager..."

        sudo dnf update -y

        sudo dnf groupinstall -y "Development Tools"
        sudo dnf install -y \
            curl \
            wget \
            git \
            python3 \
            python3-pip \
            nodejs \
            npm \
            docker \
            docker-compose \
            systemd \
            firewalld \
            jq \
            htop \
            net-tools \
            NetworkManager

    elif command -v yum &> /dev/null; then
        # CentOS 7
        log "Using yum package manager..."

        sudo yum update -y
        sudo yum groupinstall -y "Development Tools"
        sudo yum install -y \
            curl \
            wget \
            git \
            python3 \
            python3-pip \
            nodejs \
            npm \
            docker \
            docker-compose \
            systemd \
            firewalld \
            jq \
            htop \
            net-tools \
            NetworkManager

    else
        error "Unsupported package manager. Please install packages manually."
        exit 1
    fi

    success "System packages installed successfully"
}

# Setup Docker
setup_docker() {
    log "Setting up Docker..."

    # Add user to docker group
    if ! groups "$USER" | grep -q docker; then
        log "Adding user to docker group..."
        sudo usermod -aG docker "$USER"
        warning "You may need to log out and log back in for docker group changes to take effect"
    fi

    # Start and enable docker service
    sudo systemctl enable docker
    sudo systemctl start docker

    # Test docker installation
    if sudo docker run --rm hello-world > /dev/null 2>&1; then
        success "Docker setup completed successfully"
    else
        error "Docker setup failed"
        exit 1
    fi
}

# Create Python virtual environment
setup_python_env() {
    log "Setting up Python virtual environment..."

    # Remove existing venv if it exists
    if [ -d "$VENV_PATH" ]; then
        log "Removing existing virtual environment..."
        rm -rf "$VENV_PATH"
    fi

    # Create new virtual environment
    log "Creating Python virtual environment at $VENV_PATH"
    python3 -m venv "$VENV_PATH"

    # Activate virtual environment and install packages
    log "Installing Python packages..."
    source "$VENV_PATH/bin/activate"

    # Upgrade pip
    pip install --upgrade pip setuptools wheel

    # Install essential Python packages
    pip install \
        flask \
        flask-socketio \
        flask-cors \
        requests \
        python-dotenv \
        psutil \
        pyyaml \
        jsonschema \
        pytest \
        pytest-asyncio \
        black \
        flake8 \
        mypy

    # Install vehicle-specific libraries
    pip install \
        python-obd \
        paho-mqtt \
        redis \
        pandas \
        numpy \
        matplotlib

    deactivate

    success "Python environment setup completed"
}

# Setup Node.js environment
setup_node_env() {
    log "Setting up Node.js environment..."

    # Create runtime directory
    mkdir -p "$RUNTIME_PATH"
    cd "$RUNTIME_PATH"

    # Initialize Node.js project
    if [ ! -f "package.json" ]; then
        log "Initializing Node.js project..."
        npm init -y

        # Update package.json with basic information
        jq '.name = "vehicle-edge-runtime" |
           .version = "1.0.0" |
           .description = "Vehicle Edge Runtime for deploying and managing vehicle applications" |
           .main = "index.js" |
           .scripts = {"start": "node index.js", "dev": "nodemon index.js"} |
           .keywords = ["vehicle", "edge", "runtime", "iot"] |
           .author = "Vehicle Edge Runtime" |
           .license = "MIT"' package.json > package.json.tmp && mv package.json.tmp package.json
    fi

    # Install Node.js dependencies
    log "Installing Node.js dependencies..."
    npm install --save \
        express \
        socket.io \
        cors \
        dotenv \
        axios \
        ws \
        node-cron \
        winston \
        multer

    npm install --save-dev \
        nodemon \
        eslint \
        prettier \
        jest

    success "Node.js environment setup completed"
}

# Create Vehicle Edge Runtime application
create_runtime_application() {
    log "Creating Vehicle Edge Runtime application..."

    cd "$RUNTIME_PATH"

    # Create main application file
    cat > index.js << 'EOF'
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const psutil = require('psutil');
const winston = require('winston');

// Configure logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({ format: winston.format.simple() })
    ]
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Kit management
const kits = new Map();
let kitIdCounter = 1;

// Kit Manager endpoints
app.get('/listAllKits', (req, res) => {
    const kitList = Array.from(kits.values()).map(kit => ({
        kit_id: kit.kit_id,
        socket_id: kit.socket_id,
        name: kit.name,
        is_online: Date.now() - kit.last_seen < 30000,
        last_seen: kit.last_seen,
        desc: kit.desc,
        noRunner: kit.noRunner,
        noSubscriber: kit.noSubscriber,
        support_apis: kit.support_apis || []
    }));

    res.json({
        status: 'success',
        content: kitList
    });
});

app.get('/listAllClient', (req, res) => {
    const clientList = Array.from(kits.values())
        .filter(kit => kit.is_client)
        .map(client => ({
            username: client.username,
            user_id: client.user_id,
            domain: client.domain,
            last_seen: client.last_seen,
            is_online: Date.now() - client.last_seen < 30000
        }));

    res.json({
        status: 'success',
        content: clientList
    });
});

// Application deployment
app.post('/deployApp', (req, res) => {
    const { to_kit_id, code, prototype } = req.body;

    if (!to_kit_id || !code) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing required fields: to_kit_id, code'
        });
    }

    const kit = kits.get(to_kit_id);
    if (!kit) {
        return res.status(404).json({
            status: 'error',
            message: 'Kit not found'
        });
    }

    // Simulate deployment
    const deploymentId = `deploy-${Date.now()}`;
    logger.info(`Deploying to kit ${to_kit_id}:`, { deploymentId, prototype });

    // Notify kit about deployment
    if (kit.socket) {
        kit.socket.emit('deploy', {
            deploymentId,
            code,
            prototype,
            timestamp: Date.now()
        });
    }

    res.json({
        status: 'success',
        message: 'Deployment initiated',
        deploymentId
    });
});

// Socket.IO handling
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Handle kit registration
    socket.on('register-kit', (data) => {
        const kitInfo = {
            kit_id: data.kit_id || `kit-${kitIdCounter++}`,
            socket_id: socket.id,
            socket: socket,
            name: data.name || 'Unknown Kit',
            is_online: true,
            is_client: data.is_client || false,
            last_seen: Date.now(),
            desc: data.desc || '',
            noRunner: data.noRunner || 0,
            noSubscriber: data.noSubscriber || 0,
            support_apis: data.support_apis || [],
            username: data.username,
            user_id: data.user_id,
            domain: data.domain
        };

        kits.set(kitInfo.kit_id, kitInfo);
        logger.info(`Kit registered: ${kitInfo.kit_id} (${kitInfo.name})`);

        socket.emit('registration-complete', {
            kit_id: kitInfo.kit_id,
            message: 'Successfully registered'
        });
    });

    // Handle heartbeat
    socket.on('heartbeat', () => {
        socket.emit('pong');
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);

        // Mark kit as offline
        for (const [kitId, kit] of kits.entries()) {
            if (kit.socket_id === socket.id) {
                kit.is_online = false;
                kit.last_seen = Date.now();
                logger.info(`Kit went offline: ${kitId}`);
                break;
            }
        }
    });

    // Handle runtime messages
    socket.on('runtime-message', (data) => {
        logger.info('Runtime message received:', data);
        // Broadcast to interested clients
        socket.broadcast.emit('runtime-update', data);
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        kits: kits.size,
        online_kits: Array.from(kits.values()).filter(kit => kit.is_online).length
    });
});

// System info endpoint
app.get('/system-info', (req, res) => {
    res.json({
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        cpus: os.cpus().length,
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        networkInterfaces: os.networkInterfaces()
    });
});

// Start server
const PORT = process.env.PORT || 3090;
server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Vehicle Edge Runtime started on port ${PORT}`);
    logger.info(`WebSocket available: ws://localhost:${PORT}`);
    logger.info(`HTTP API available: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});
EOF

    # Create requirements.txt for Python apps
    cat > requirements.txt << 'EOF'
# Core Vehicle Edge Runtime Requirements
flask==2.3.3
flask-socketio==5.3.6
flask-cors==4.0.0
requests==2.31.0
python-dotenv==1.0.0
psutil==5.9.6
pyyaml==6.0.1
jsonschema==4.19.2
pytest==7.4.3
pytest-asyncio==0.21.1
black==23.11.0
flake8==6.1.0
mypy==1.7.1

# Vehicle-Specific Libraries
python-obd==0.7.3
paho-mqtt==1.6.1
redis==5.0.1
pandas==2.1.4
numpy==1.26.2
matplotlib==3.8.2
can==4.0.0
serial==0.0.97

# Development Tools
nodemon==3.0.1
eslint==8.54.0
prettier==3.1.0
jest==29.7.0
EOF

    # Create .env template
    cat > .env.template << 'EOF'
# Vehicle Edge Runtime Configuration
PORT=3090
NODE_ENV=production

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/vehicle-edge-runtime/app.log

# Security
CORS_ORIGIN=*
MAX_PAYLOAD_SIZE=10mb

# Performance
MAX_CONNECTIONS=100
HEARTBEAT_INTERVAL=30000
KIT_TIMEOUT=60000

# Vehicle Integration
VEHICLE_INTERFACE=can0
BAUDRATE=500000
GPS_PORT=/dev/ttyUSB0

# External Services
REDIS_URL=redis://localhost:6379
MQTT_BROKER=localhost
MQTT_PORT=1883
EOF

    # Create simple test app
    mkdir -p test-apps
    cat > test-apps/hello_world.py << 'EOF'
#!/usr/bin/env python3
"""
Simple Hello World Vehicle Application
Demonstrates basic Vehicle Edge Runtime app structure
"""

import time
import json
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class HelloWorldApp:
    def __init__(self):
        self.running = True
        self.counter = 0

    def run(self):
        """Main application loop"""
        logger.info("Hello World Vehicle Application Started!")
        logger.info("Press Ctrl+C to stop the application")

        try:
            while self.running:
                self.counter += 1
                timestamp = datetime.now().isoformat()

                # Create vehicle-like data
                vehicle_data = {
                    'timestamp': timestamp,
                    'counter': self.counter,
                    'vehicle_speed': min(120, self.counter * 2),
                    'engine_rpm': min(8000, self.counter * 100),
                    'fuel_level': max(0, 100 - self.counter * 0.1),
                    'message': f'Hello from Vehicle Edge Runtime! Count: {self.counter}'
                }

                logger.info(f"Vehicle Data: {json.dumps(vehicle_data)}")

                # Simulate vehicle data processing delay
                time.sleep(2)

        except KeyboardInterrupt:
            logger.info("Application stopped by user")
        except Exception as e:
            logger.error(f"Application error: {e}")

    def stop(self):
        """Stop the application"""
        self.running = False
        logger.info("Hello World Vehicle Application Stopped")

if __name__ == "__main__":
    app = HelloWorldApp()
    app.run()
EOF

    chmod +x test-apps/hello_world.py

    success "Vehicle Edge Runtime application created"
}

# Create systemd service
create_systemd_service() {
    log "Creating systemd service..."

    sudo tee /etc/systemd/system/vehicle-edge-runtime.service > /dev/null << EOF
[Unit]
Description=Vehicle Edge Runtime Service
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$RUNTIME_PATH
Environment=NODE_ENV=production
Environment=PORT=3090
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$RUNTIME_PATH /var/log/vehicle-edge-runtime

[Install]
WantedBy=multi-user.target
EOF

    # Create log directory
    sudo mkdir -p /var/log/vehicle-edge-runtime
    sudo chown "$SERVICE_USER":"$SERVICE_USER" /var/log/vehicle-edge-runtime

    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable vehicle-edge-runtime

    success "Systemd service created and enabled"
}

# Create startup script
create_startup_script() {
    log "Creating startup script..."

    cat > "$RUNTIME_PATH/start.sh" << EOF
#!/bin/bash
# Vehicle Edge Runtime Startup Script

echo "Starting Vehicle Edge Runtime..."

# Load environment variables
if [ -f .env ]; then
    export \$(cat .env | grep -v '^#' | xargs)
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the application
node index.js
EOF

    chmod +x "$RUNTIME_PATH/start.sh"

    # Create stop script
    cat > "$RUNTIME_PATH/stop.sh" << EOF
#!/bin/bash
# Vehicle Edge Runtime Stop Script

echo "Stopping Vehicle Edge Runtime..."

# Kill the Node.js process
pkill -f "node index.js" || echo "No running process found"

echo "Vehicle Edge Runtime stopped"
EOF

    chmod +x "$RUNTIME_PATH/stop.sh"

    success "Startup scripts created"
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."

    if command -v ufw &> /dev/null; then
        # Ubuntu/Debian with UFW
        sudo ufw allow 3090/tcp
        sudo ufw allow from 127.0.0.1 to any port 3090

    elif command -v firewall-cmd &> /dev/null; then
        # RHEL/CentOS/Fedora with firewalld
        sudo firewall-cmd --permanent --add-port=3090/tcp
        sudo firewall-cmd --reload

    else
        warning "No supported firewall found. Please manually configure firewall to allow port 3090."
    fi

    success "Firewall configured"
}

# Test installation
test_installation() {
    log "Testing installation..."

    # Test Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js installation failed"
        exit 1
    fi

    # Test Docker
    if ! sudo docker info &> /dev/null; then
        error "Docker installation or configuration failed"
        exit 1
    fi

    # Test Python
    if ! source "$VENV_PATH/bin/activate" && python --version &> /dev/null; then
        error "Python environment setup failed"
        exit 1
    fi

    # Test application start (quick test)
    cd "$RUNTIME_PATH"
    timeout 5s node index.js &> /dev/null || {
        error "Vehicle Edge Runtime application failed to start"
        exit 1
    }

    success "Installation test passed"
}

# Print summary
print_summary() {
    log "Vehicle Edge Runtime setup completed successfully!"
    echo
    echo "=== Installation Summary ==="
    echo "📁 Installation directory: $RUNTIME_PATH"
    echo "🐍 Python virtual environment: $VENV_PATH"
    echo "🔗 API endpoint: http://localhost:3090"
    echo "🌐 WebSocket endpoint: ws://localhost:3090"
    echo "📊 Health check: http://localhost:3090/health"
    echo
    echo "=== Next Steps ==="
    echo "1. Start the service:"
    echo "   sudo systemctl start vehicle-edge-runtime"
    echo "   OR manually:"
    echo "   cd $RUNTIME_PATH && ./start.sh"
    echo
    echo "2. Check status:"
    echo "   sudo systemctl status vehicle-edge-runtime"
    echo "   OR check logs:"
    echo "   sudo journalctl -u vehicle-edge-runtime -f"
    echo
    echo "3. Test with a sample app:"
    echo "   cd $RUNTIME_PATH/test-apps"
    echo "   source $VENV_PATH/bin/activate"
    echo "   python hello_world.py"
    echo
    echo "4. Access the API:"
    echo "   curl http://localhost:3090/health"
    echo "   curl http://localhost:3090/listAllKits"
    echo
    echo "=== Service Management ==="
    echo "Start:  sudo systemctl start vehicle-edge-runtime"
    echo "Stop:   sudo systemctl stop vehicle-edge-runtime"
    echo "Status: sudo systemctl status vehicle-edge-runtime"
    echo "Logs:   sudo journalctl -u vehicle-edge-runtime -f"
    echo
}

# Main execution
main() {
    log "Starting Vehicle Edge Runtime setup..."

    detect_system
    check_requirements
    install_system_packages
    setup_docker
    setup_python_env
    setup_node_env
    create_runtime_application
    create_systemd_service
    create_startup_script
    configure_firewall
    test_installation
    print_summary

    success "Setup completed successfully! 🚀"
}

# Handle script errors
handle_error() {
    error "Setup failed at line $1"
    exit 1
}

# Run main function with error handling
trap 'handle_error $LINENO' ERR
main "$@"