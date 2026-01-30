# Vehicle Edge Runtime - Setup Guide

## Prerequisites

### 1. Docker Compose Plugin (Required)

This project uses the newer `docker compose` (V2) syntax, not the older `docker-compose` standalone command.

**Check if you have it:**
```bash
docker compose version
```

**If you get "unknown command: docker compose", install it:**

#### Option A: System-wide install (requires sudo)
```bash
sudo apt-get update
sudo apt-get install -y docker-compose-plugin
```

#### Option B: User-level install (no sudo)
Run the provided setup script:
```bash
./scripts/setup-docker-compose.sh
```

Or manually:
```bash
mkdir -p ~/.docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.30.3/docker-compose-linux-x86_64 \
  -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
```

### 2. Docker Daemon Running

Ensure Docker is running:
```bash
docker info
```

### 3. User in Docker Group (Recommended)

Add your user to the docker group to avoid using sudo:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

## Known Issues

### Network Conflict

If you encounter this error:
```
failed to create network ... Pool overlaps with other one on this address space
```

The subnet `172.20.0.0/16` defined in `docker-compose.yml` is already in use by another Docker network.

**Solutions:**

1. **Find conflicting network:**
   ```bash
   docker network ls
   docker network inspect <network-name> | grep Subnet
   ```

2. **Option A - Remove conflicting network** (if safe to do so):
   ```bash
   docker network rm <network-name>
   ```

3. **Option B - Change the subnet** in `docker-compose.yml`:
   ```yaml
   networks:
     vehicle-edge-network:
       driver: bridge
       ipam:
         config:
           - subnet: 172.28.0.0/16  # Use different subnet
   ```

## Quick Start

After installing Docker Compose plugin:

```bash
# Deploy base runtime
./docker-deploy.sh deploy base

# Check status
./docker-deploy.sh status

# View logs
./docker-deploy.sh logs

# Stop services
./docker-deploy.sh stop
```

## Access Points

- WebSocket API: `ws://localhost:3002/runtime`
- Health Check: `http://localhost:3003/health`
- Kuksa Web UI (when using kuksa/full profiles): `http://localhost:55555`
