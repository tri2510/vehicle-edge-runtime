# Vehicle Edge Runtime - Docker Setup Guide

Complete guide to set up Vehicle Edge Runtime from scratch on a new Ubuntu host to run with Docker.

## 🚀 Quick Start (One-Command Setup)

```bash
# Clone and run setup
git clone <your-repo-url> vehicle-edge-runtime
cd vehicle-edge-runtime
./scripts/setup.sh --dev && ./scripts/deploy.sh deploy
```

## 📋 Prerequisites

### Hardware Requirements
- **CPU**: x86_64 (Intel/AMD) or ARM64 (aarch64)
- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: Minimum 5GB free space
- **OS**: Ubuntu 20.04+, Debian 10+, or Raspberry Pi OS

### System Access
- **User account** with sudo privileges
- **Internet connection** for downloading packages

## 🔧 Complete Step-by-Step Setup

### Step 1: System Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install git if not present
sudo apt install -y git
```

### Step 2: Clone Repository

```bash
# Clone the Vehicle Edge Runtime repository
git clone <your-repo-url> vehicle-edge-runtime
cd vehicle-edge-runtime

# Verify you're in the right directory
ls -la
# You should see: scripts/, src/, proto/, Dockerfile, etc.
```

### Step 3: Automated System Setup

```bash
# Install all dependencies and configure system
./scripts/setup.sh --dev
```

**This step installs:**
- **Node.js 18+** (JavaScript runtime)
- **Docker** (container platform)
- **Docker Compose** (multi-container orchestration)
- **System tools** (curl, wget, git, jq, etc.)
- **Project dependencies** (npm packages)

### Step 4: Docker User Configuration

```bash
# Apply Docker group changes (important!)
newgrp docker

# OR restart your terminal session for changes to take effect
```

### Step 5: Deploy Vehicle Edge Runtime

```bash
# Build and start Docker containers
./scripts/deploy.sh deploy
```

**This step:**
- **Builds Docker image** from your project
- **Starts runtime services** in containers
- **Creates data directories** and networks
- **Verifies health** of all services

### Step 6: Verify Installation

```bash
# Check service status
./scripts/deploy.sh status

# Test health endpoint
curl http://localhost:3003/health

# Check WebSocket endpoint
timeout 5 bash -c "</dev/tcp/localhost/3002" && echo "WebSocket OK"
```

## 🌐 Access Points

After successful deployment, you'll have access to:

| Service | URL | Description |
|---------|-----|-------------|
| **WebSocket API** | `ws://localhost:3002/runtime` | Main runtime communication |
| **Health Check** | `http://localhost:3003/health` | Service health monitoring |
| **Kit Manager** | `http://localhost:3090` | Application management |
| **Kuksa Web UI** | `http://localhost:55555` | Vehicle data broker (if using full profile) |

## 🛠 Management Commands

### Service Management
```bash
# Start services
./scripts/deploy.sh deploy

# Stop services
./scripts/deploy.sh stop

# Restart services
./scripts/deploy.sh restart

# View logs
./scripts/deploy.sh logs

# Check status
./scripts/deploy.sh status
```

### Deployment Profiles
```bash
# Base runtime only
./scripts/deploy.sh deploy base

# Runtime with local Kuksa databroker
./scripts/deploy.sh deploy kuksa

# Runtime with Redis caching
./scripts/deploy.sh deploy redis

# Complete stack (Kuksa + Redis)
./scripts/deploy.sh deploy full
```

### Development Tools
```bash
# Start development mode
./scripts/dev.sh watch

# Run tests
./scripts/dev.sh test

# Run linting
./scripts/dev.sh lint

# Check ports usage
./scripts/dev.sh port

# Quick health check
./scripts/dev.sh health
```

## 🔍 Troubleshooting

### Common Issues

#### Docker Permission Denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Apply changes immediately
newgrp docker

# OR logout and login again
```

#### Port Already in Use
```bash
# Check what's using the ports
./scripts/dev.sh port

# Kill processes using the ports
sudo lsof -ti:3002 | xargs kill -9
sudo lsof -ti:3003 | xargs kill -9
```

#### Container Fails to Start
```bash
# Check Docker daemon status
sudo systemctl status docker

# Start Docker if not running
sudo systemctl start docker

# Check Docker logs
sudo journalctl -u docker -f
```

#### Build Fails
```bash
# Force rebuild image
./scripts/deploy.sh deploy --build

# Clean and rebuild
./scripts/cleanup.sh --docker
./scripts/deploy.sh deploy --build
```

### Debug Commands
```bash
# Get inside container
docker exec -it vehicle-edge-runtime sh

# Check container logs
docker logs vehicle-edge-runtime

# Check all containers
docker ps -a

# Check system resources
docker stats
```

## 🗃 Project Structure

```
vehicle-edge-runtime/
├── scripts/              # Unified management scripts
│   ├── setup.sh         # System installation and configuration
│   ├── runtime.sh       # Service management (start/stop/status)
│   ├── deploy.sh        # Docker deployment with profiles
│   ├── dev.sh           # Development tools and utilities
│   └── cleanup.sh       # Cleanup and maintenance
├── src/                 # Application source code
├── proto/               # Protocol buffer definitions
├── Dockerfile           # Container image definition
├── docker-compose.yml   # Multi-container orchestration
├── package.json         # Node.js dependencies
└── data/                # Runtime data (applications, logs, configs)
    ├── applications/
    ├── logs/
    └── configs/
```

## 📝 Command Parameter Reference

### setup.sh Parameters
```bash
./scripts/setup.sh [options]
```
- `--dev` - Install development dependencies (Node.js, npm, dev tools)
- `--force` - Force reinstall all packages even if already installed
- `--help` - Show usage information

**Examples:**
```bash
./scripts/setup.sh          # Standard production setup
./scripts/setup.sh --dev    # Setup with development tools
./scripts/setup.sh --force  # Force reinstall everything
```

### deploy.sh Parameters
```bash
./scripts/deploy.sh [action] [profile] [options]
```

**Actions:**
- `deploy` - Build and start services
- `stop` - Stop all services
- `restart` - Restart services
- `logs` - Show service logs
- `status` - Show service status
- `clean` - Remove containers and images

**Profiles:**
- `base` - Runtime only (default)
- `kuksa` - Runtime + local Kuksa databroker
- `redis` - Runtime + Redis caching
- `full` - Runtime + Kuksa + Redis

**Options:**
- `--build` - Force rebuild Docker image
- `--clean-data` - Clean data directories with clean action

**Examples:**
```bash
./scripts/deploy.sh deploy          # Deploy base runtime
./scripts/deploy.sh deploy full     # Deploy complete stack
./scripts/deploy.sh logs            # Show all logs
./scripts/deploy.sh stop            # Stop services
./scripts/deploy.sh clean --build   # Clean and rebuild
```

### runtime.sh Parameters
```bash
./scripts/runtime.sh [command]
```

**Commands:**
- `start` - Start the Vehicle Edge Runtime
- `stop` - Stop the Vehicle Edge Runtime
- `restart` - Restart the Vehicle Edge Runtime
- `status` - Show runtime status and health
- `logs` - Show runtime logs

**Examples:**
```bash
./scripts/runtime.sh start    # Start runtime
./scripts/runtime.sh status   # Check status
./scripts/runtime.sh logs     # View logs
```

### dev.sh Parameters
```bash
./scripts/dev.sh <command> [options]
```

**Commands:**
- `watch` - Start development server with auto-restart
- `test` - Run test suite
- `lint` - Run code linting and formatting
- `deps` - Install/update dependencies
- `env` - Manage environment files
- `logs` - Show development logs
- `debug` - Start runtime with debugging enabled
- `build` - Build the project
- `clean` - Clean development artifacts
- `port` - Check which ports are in use
- `health` - Quick health check of services
- `shell` - Start shell in runtime container

**Options for `deps`:**
- `install` - Install dependencies (default)
- `update` - Update dependencies
- `clean` - Remove dependencies

**Options for `env`:**
- `dev` - Switch to development environment
- `prod` - Switch to production environment
- `test` - Switch to test environment

**Options for `lint`:**
- `--fix` - Auto-fix linting issues

**Examples:**
```bash
./scripts/dev.sh watch            # Start dev server
./scripts/dev.sh deps update      # Update dependencies
./scripts/dev.sh env prod         # Switch to production
./scripts/dev.sh lint --fix       # Fix linting issues
./scripts/dev.sh health           # Quick health check
```

### cleanup.sh Parameters
```bash
./scripts/cleanup.sh [options]
```

**Options:**
- `--all` - Clean everything (logs, deployments, Docker, build)
- `--logs` - Clean log files only
- `--deployments` - Clean deployment artifacts only
- `--docker` - Clean Docker resources only
- `--build` - Clean build artifacts only
- `--dry-run` - Show what would be cleaned without doing it

**Examples:**
```bash
./scripts/cleanup.sh --logs              # Clean only logs
./scripts/cleanup.sh --deployments       # Clean deployments
./scripts/cleanup.sh --all               # Clean everything
./scripts/cleanup.sh --all --dry-run     # Preview cleanup
```

## 🔧 Configuration

### Environment Variables
Edit `.env` file to customize:

```bash
# Main configuration
NODE_ENV=production
PORT=3002
HEALTH_PORT=3003
LOG_LEVEL=info

# Performance settings
MAX_CONCURRENT_APPS=10
DEFAULT_MEMORY_LIMIT=524288000
DEFAULT_CPU_LIMIT=50000
```

### Docker Configuration
Key files:
- `Dockerfile` - Container image definition
- `docker-compose.yml` - Service orchestration
- `.dockerignore` - Files excluded from build

## 🚀 Production Deployment

For production deployment:

```bash
# Production setup (no dev tools)
./scripts/setup.sh

# Deploy with full stack
./scripts/deploy.sh deploy full

# Configure firewall
sudo ufw allow 3002/tcp
sudo ufw allow 3003/tcp
sudo ufw allow 3090/tcp

# Monitor services
./scripts/deploy.sh logs
```

## 🧹 Cleanup

To completely clean the installation:

```bash
# Clean everything (containers, images, data)
./scripts/cleanup.sh --all

# Clean only Docker resources
./scripts/cleanup.sh --docker

# Clean only deployment artifacts
./scripts/cleanup.sh --deployments
```

## 📚 Next Steps

After successful setup:

1. **Explore the API**: `curl http://localhost:3003/health`
2. **Deploy applications**: Use Kit Manager at `http://localhost:3090`
3. **Monitor logs**: `./scripts/deploy.sh logs`
4. **Develop locally**: `./scripts/dev.sh watch`
5. **Read documentation**: Check `docs/` directory for detailed guides

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs with `./scripts/deploy.sh logs`
3. Verify Docker installation with `docker --version`
4. Check system resources with `./scripts/dev.sh health`

## 📄 Architecture Overview

```
┌─────────────────────────────────────┐
│            Ubuntu Host               │
│  ┌─────────────────────────────────┐│
│  │        Docker Daemon            ││
│  └─────────────────────────────────┘│
│           ▲                        │
│    ┌──────┴───────┐                 │
│    │             │                 │
│  ┌─▼─┐         ┌─▼─────────────┐   │
│  │VER │         │ Kuksa/Redis   │   │
│  │Container     │ Containers    │   │
│  └───┘         └───────────────┘   │
└─────────────────────────────────────┘

VER = Vehicle Edge Runtime
```

---

**🎉 Congratulations!** You now have Vehicle Edge Runtime running with Docker on your Ubuntu system.