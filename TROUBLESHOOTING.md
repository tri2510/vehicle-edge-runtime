# Vehicle Edge Runtime - Troubleshooting Guide

## Common Issues and Solutions

### 1. Docker Compose Plugin Not Found

**Error:**
```
unknown shorthand flag: 'd' in -d
docker: unknown command: docker compose
```

**Solution:**
```bash
# Run the setup script
./scripts/setup-docker-compose.sh

# Or verify it's installed
docker compose version
```

---

### 2. Network Pool Overlap Error

**Error:**
```
failed to create network ... Pool overlaps with other one on this address space
```

**Cause:** The subnet `172.20.0.0/16` is already in use by another Docker network.

**Solutions:**

**Option A - Remove conflicting network:**
```bash
# List all networks
docker network ls

# Find the conflicting network and remove it (if safe)
docker network rm <network-name>

# Or prune all unused networks
docker network prune
```

**Option B - Change the subnet** in `docker-compose.yml`:
```yaml
networks:
  vehicle-edge-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16  # Use different subnet
```

---

### 3. Port Already in Use

**Error:**
```
Bind for 0.0.0.0:3002 failed: port is already allocated
```

**Cause:** Another service is using the required ports.

**Used Ports:**
- `3002` - WebSocket API
- `3003` - Health Check
- `55555` - Kuksa Databroker (when using kuksa/full profiles)

**Solutions:**

**Option A - Stop conflicting service:**
```bash
# Find what's using the port
sudo lsof -i :3002
sudo netstat -tulpn | grep :3002

# Stop the conflicting service
```

**Option B - Change ports** in `.env`:
```bash
PORT=3012  # Change WebSocket API port
HEALTH_CHECK_PORT=3013  # Change health check port
```

---

### 4. Container Exits Immediately (Kuksa Connection Failed)

**Error:**
```
Failed to start Vehicle Edge Runtime: Error: Kuksa connection failed: Failed to connect before the deadline
```

**Cause:** Runtime tries to connect to Kuksa with `failFast=true` but Kuksa is not running.

**Solution:**

Set `SKIP_KUKSA=true` when using base profile (default):
```bash
# In .env file
SKIP_KUKSA=true

# Or via docker-compose environment
# Already set in docker-compose.yml for base profile
```

---

### 5. Docker Socket Permission Denied

**Error (in logs):**
```
Failed to list containers for cleanup {"error":"connect EACCES /var/run/docker.sock"}
```

**Cause:** Container user doesn't have proper permissions to access Docker socket.

**Solutions:**

**Option A - Add user to docker group:**
```bash
sudo usermod -aG docker $USER
newgrp docker
```

**Option B - Verify group_add configuration** in `docker-compose.yml`:
```yaml
services:
  vehicle-edge-runtime:
    group_add:
      - "0"      # root group
      - "999"    # docker group GID
      - "994"    # alternative docker group GID
```

**Option C - Check your Docker GID:**
```bash
getent group docker | cut -d: -f3
# Update group_add in docker-compose.yml with your GID
```

---

### 6. Health Check Failing

**Symptoms:**
- Container shows `unhealthy` status
- `curl http://localhost:3003/health` returns connection refused

**Possible Causes:**

1. **Container still starting up**
   ```bash
   # Wait longer and check again
   docker logs vehicle-edge-runtime
   ```

2. **Service crashed**
   ```bash
   # Check logs for errors
   docker logs vehicle-edge-runtime --tail 50
   ```

3. **Wrong port**
   ```bash
   # Verify ports are mapped correctly
   docker ps | grep vehicle-edge-runtime
   ```

---

### 7. Kit Manager Connection Fails

**Error (in logs):**
```
Kit Manager connection error {"error":"websocket error"}
```

**Note:** This is a **warning**, not a fatal error. The runtime will continue without Kit Manager.

**If you need Kit Manager:**

1. **Start Kit Manager locally:**
   ```bash
   # Default Kit Manager runs on ws://localhost:3090
   # Update KIT_MANAGER_URL in .env if different
   KIT_MANAGER_URL=ws://localhost:3090
   ```

2. **Or skip Kit Manager:**
   ```bash
   # In .env
   SKIP_KIT_MANAGER=true
   ```

---

### 8. Container Won't Start (Build Failed)

**Error:**
```
failed to solve: executor failed running [/bin/sh -c npm ci...]
```

**Possible Causes:**

1. **Network issues during build**
   ```bash
   # Check network connectivity
   ping registry.npmjs.org
   ```

2. **Out of disk space**
   ```bash
   # Clean up Docker resources
   docker system prune -a
   ```

3. **Node version mismatch**
   ```bash
   # Check Dockerfile uses compatible Node version
   # Current: node:20-alpine
   ```

---

### 9. Volume/Permission Issues

**Error:**
```
EACCES: permission denied, mkdir '/app/data/...'
```

**Solution:**

```bash
# Remove old volumes and start fresh
docker compose down -v
docker compose up -d
```

---

### 10. Old Containers Left Running

**Symptoms:**
- Multiple vehicle-edge-runtime containers
- "Container name already in use" error

**Solution:**

```bash
# Stop all vehicle containers
docker stop $(docker ps -q --filter "name=vehicle")

# Remove stopped containers
docker rm $(docker ps -aq --filter "name=vehicle")

# Or use the clean script
./docker-deploy.sh clean
```

---

## Diagnostic Commands

### Check Overall Health
```bash
# Service status
docker compose ps

# Container logs
docker compose logs vehicle-edge-runtime --tail 50

# Resource usage
docker stats vehicle-edge-runtime
```

### Network Diagnostics
```bash
# List networks
docker network ls

# Inspect network
docker network inspect 02_vehicle-edge-runtime_vehicle-edge-network

# Test connectivity
docker exec vehicle-edge-runtime ping -c 3 google.com
```

### Port Diagnostics
```bash
# Check what's listening on ports
sudo netstat -tulpn | grep -E ':(3002|3003|55555)'

# Or with ss
sudo ss -tulpn | grep -E ':(3002|3003|55555)'
```

### Docker Socket Test
```bash
# From inside container
docker exec vehicle-edge-runtime ls -l /var/run/docker.sock

# Test Docker access from container
docker exec vehicle-edge-runtime docker ps
```

---

## Getting Help

If none of the solutions work:

1. **Collect diagnostic information:**
   ```bash
   # Save logs for debugging
   docker compose logs > runtime-debug.log
   docker inspect vehicle-edge-runtime > container-inspect.json
   docker network inspect 02_vehicle-edge-runtime_vehicle-edge-network > network-inspect.json
   ```

2. **Check environment:**
   ```bash
   docker-compose config
   docker version
   docker-compose version
   ```

3. **Clean start:**
   ```bash
   ./docker-deploy.sh clean
   ./docker-deploy.sh deploy base
   ```
