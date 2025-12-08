# Vehicle Edge Runtime - Complete Installation Guide

## 🚀 Quick Install (Ubuntu/Debian)

### System Requirements
- **OS**: Ubuntu 20.04+, Debian 11+, Raspberry Pi OS (64-bit)
- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: Minimum 10GB free space
- **Architecture**: x86_64 or ARM64 (aarch64)

### One-Line Installation
```bash
curl -fsSL https://raw.githubusercontent.com/tri2510/vehicle-edge-runtime/main/install.sh | bash
```

## 📋 Detailed Installation Instructions

### Step 1: System Preparation
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git build-essential python3 python3-pip
```

### Step 2: Install Node.js 18+ (Required: >=18.0.0)
```bash
# Install Node.js 18 LTS (recommended)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

**Alternative: Install Node.js 20 (Latest LTS)**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 3: Install Docker & Docker Compose
```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add user to docker group (IMPORTANT!)
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

**⚠️ CRITICAL: Re-login Required**
```bash
# You MUST re-login for docker group changes to take effect
newgrp docker
# Or completely log out and log back in
```

### Step 4: Install Vehicle Edge Runtime
```bash
# Clone repository (using HTTPS)
git clone https://github.com/tri2510/vehicle-edge-runtime.git
cd vehicle-edge-runtime

# Install Node.js dependencies
npm install

# Create environment configuration
cp .env.example .env

# Create required data directories
mkdir -p data/applications data/logs data/configs
chmod 755 data/logs
```

### Step 5: Configure Environment
```bash
# Edit configuration file
nano .env
```

**Essential Configuration:**
```bash
# Basic Settings
PORT=3002
LOG_LEVEL=info
DATA_PATH=./data

# Kit Manager Connection
KIT_MANAGER_URL=ws://localhost:3090

# Docker Settings
DOCKER_HOST=unix:///var/run/docker.sock

# Application Limits
MAX_CONCURRENT_APPS=5          # Reduce for Raspberry Pi
DEFAULT_MEMORY_LIMIT=268435456 # 256MB (reduce for low-memory systems)
DEFAULT_CPU_LIMIT=50000        # 50% CPU

# Vehicle Integration (Phase 2)
KUKSA_DATABROKER_URL=http://localhost:55555
VSS_CONFIG_PATH=./data/configs/vss.json

# Security
ENABLE_AUTH=false
JWT_SECRET=your-secret-key-here
```

## 🐳 Deployment Options

### Option 1: Docker Deployment (Recommended)
```bash
# Start separate containers (production)
./7-start-separate-services.sh

# Or use Docker Compose directly
./docker-setup.sh prod

# Or development mode with hot reload
./docker-setup.sh dev
```

### Option 2: Native Node.js (Development)
```bash
# Start directly with Node.js
npm start

# Or development mode with auto-restart
npm run dev
```

### Option 3: System Service (Production)
```bash
# Create systemd service
sudo cp scripts/vehicle-edge-runtime.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable vehicle-edge-runtime
sudo systemctl start vehicle-edge-runtime
```

## 🔧 Raspberry Pi Specific Setup

### ARM64 Architecture Support
```bash
# Verify ARM64 architecture
uname -m  # Should show aarch64

# Use ARM-compatible Docker images
docker build -f Dockerfile.runtime -t vehicle-edge-runtime:arm64 .
```

### Performance Optimization for Pi
```bash
# .env settings for Raspberry Pi 4
MAX_CONCURRENT_APPS=3
DEFAULT_MEMORY_LIMIT=134217728  # 128MB
DEFAULT_CPU_LIMIT=25000         # 25% CPU
LOG_LEVEL=warn                  # Reduce logging overhead
```

### Memory Configuration
```bash
# Enable GPU memory split (if using display)
sudo raspi-config
# Advanced Options -> Memory Split -> 16

# Disable swap for better performance
sudo dphys-swapfile swapoff
sudo dphys-swapfile uninstall
```

## ✅ Installation Verification

### Test Basic Functionality
```bash
# Check if runtime is running
curl http://localhost:3003/health

# Should return: {"status":"healthy","timestamp":"..."}

# Test WebSocket connection
echo '{"type":"ping"}' | websocat ws://localhost:3002/runtime

# Should return: {"type":"pong","timestamp":"..."}
```

### Test Docker Integration
```bash
# Run Python test application
node tests/integration/test-python-app.js

# Should show successful Python execution in container
```

### Test Vehicle Signal Integration (Phase 2)
```bash
# Test Kuksa integration
node tests/integration/phase2-vehicle-signals.test.js

# Should show vehicle signal subscription working
```

## 🛠️ Troubleshooting

### Common Issues

#### Docker Permission Denied
```bash
# Fix docker permissions
sudo usermod -aG docker $USER
newgrp docker
# Or completely re-login
```

#### Port Already in Use
```bash
# Check what's using ports
sudo netstat -tlnp | grep :3002
sudo netstat -tlnp | grep :3003

# Kill conflicting processes
sudo kill -9 <PID>
```

#### npm Install Fails
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules
npm install
```

#### Out of Memory on Raspberry Pi
```bash
# Increase swap space
sudo dphys-swapfile swapoff
sudo sed -i 's/CONF_SWAPSIZE=100/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### Service Status Checks
```bash
# Check if Node.js process is running
ps aux | grep "node src/index.js"

# Check Docker containers
docker ps

# Check system resources
free -h
df -h
```

### Log Locations
```bash
# Runtime logs
tail -f data/logs/vehicle-edge-runtime.log

# Docker logs
docker logs -f vehicle-edge-runtime
docker logs -f kit-manager

# System service logs
sudo journalctl -u vehicle-edge-runtime -f
```

## 🔄 Maintenance

### Updates
```bash
# Update repository
git pull origin main

# Update dependencies
npm update

# Restart service
sudo systemctl restart vehicle-edge-runtime
# Or if using Docker
./docker-setup.sh down && ./docker-setup.sh prod
```

### Backup Configuration
```bash
# Backup data directory
tar -czf vehicle-edge-backup-$(date +%Y%m%d).tar.gz data/

# Backup environment file
cp .env .env.backup
```

### Clean Up
```bash
# Clean Docker resources
docker system prune -f

# Clean old logs
find data/logs -name "*.log" -mtime +7 -delete

# Clean application data
find data/applications -name "*" -mtime +30 -exec rm -rf {} +
```

## 📞 Support

### Health Check Endpoints
- **Runtime Health**: `http://localhost:3003/health`
- **Runtime Ready**: `http://localhost:3003/ready`
- **Status Check**: WebSocket command `{"type":"report-runtime-state"}`

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Or set in .env
echo "LOG_LEVEL=debug" >> .env
```

### Community Support
- **GitHub Issues**: https://github.com/tri2510/vehicle-edge-runtime/issues
- **Documentation**: https://github.com/tri2510/vehicle-edge-runtime/wiki
- **Discord**: [Invite Link]

---

## 🎯 Installation Checklist

- [ ] System updated and upgraded
- [ ] Node.js 18+ installed
- [ ] Docker and Docker Compose installed
- [ ] User added to docker group
- [ ] Repository cloned successfully
- [ ] npm dependencies installed
- [ ] Environment file configured
- [ ] Data directories created with proper permissions
- [ ] Service started successfully
- [ ] Health check endpoint responding
- [ ] WebSocket connection working
- [ ] Test applications running successfully

**🚀 Your Vehicle Edge Runtime is now ready for development and production use!**