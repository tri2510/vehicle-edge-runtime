# Vehicle Edge Runtime - Docker Deployment

This guide covers deploying the Vehicle Edge Runtime using Docker containers, similar to how SDV-Runtime is containerized.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Docker daemon running with access to Docker socket
- Host system with Docker-in-Docker capability for application execution

## Quick Start

### Development Environment

```bash
# Clone and navigate to the directory
cd vehicle-edge-runtime

# Start in development mode with hot-reload
./docker-setup.sh dev

# Or use npm script
npm run docker:run-dev
```

### Production Environment

```bash
# Start production environment
./docker-setup.sh prod

# Check status
./docker-setup.sh status

# View logs
./docker-setup.sh logs

# Stop services
./docker-setup.sh down
```

## Architecture

The Docker deployment consists of:

- **Vehicle Edge Runtime**: Main service on port 3002 (WebSocket) and 3003 (Health)
- **Redis**: Caching and session storage (optional)
- **Nginx**: Reverse proxy for production deployments (optional)
- **Docker-in-Docker**: For executing user applications in isolated containers

## Dockerfiles

### Production Dockerfile
- Multi-stage build for minimal image size
- Non-root user execution
- Health checks included
- Production optimizations

### Development Dockerfile
- Single-stage for faster builds
- Development dependencies
- Volume mounts for hot-reloading
- Debug logging enabled

## Docker Compose Files

### docker-compose.yml (Production)
- Optimized for production deployment
- Resource limits and restart policies
- Health checks and monitoring
- Optional Nginx reverse proxy

### docker-compose.dev.yml (Development)
- Development-friendly configuration
- Volume mounts for live coding
- Debug logging
- Development tools enabled

## Configuration

### Environment Variables

Create a `.env` file from `.env.docker`:

```bash
cp .env.docker .env
```

Key variables for Docker:

- `KIT_MANAGER_URL=ws://host.docker.internal:8080` - Connect to host services
- `DATA_PATH=/app/data` - Container data path
- `DOCKER_HOST=unix:///var/run/docker.sock` - Docker socket access

### Volume Mounts

- `/app/data` - Persistent application storage
- `/var/run/docker.sock` - Docker socket for app execution
- `./src:/app/src` - Source code (development only)

## Available Scripts

### NPM Scripts

```bash
npm run docker:build      # Build production image
npm run docker:build-dev  # Build development image
npm run docker:run        # Run single container
npm run docker:run-dev    # Start development environment
npm run docker:up         # Start production environment
npm run docker:down       # Stop containers
npm run docker:logs       # View logs
```

### Setup Script

```bash
./docker-setup.sh dev     # Development mode
./docker-setup.sh prod    # Production mode
./docker-setup.sh build   # Build image only
./docker-setup.sh run     # Run single container
./docker-setup.sh logs    # View logs
./docker-setup.sh status  # Check status
./docker-setup.sh down    # Stop services
./docker-setup.sh clean   # Clean everything
./docker-setup.sh test    # Run tests
```

## Container Security

### Non-Root User
- Container runs as `vehicle-edge` user (UID 1001)
- Minimal privileges for security

### Resource Limits
- Memory limit: 512MB per application
- CPU limit: 50% per application
- Container isolation with Docker

### Docker Socket Access
- Required for application execution
- Mounted read-only where possible
- Monitored for security

## Health Monitoring

### Health Checks
- HTTP endpoint: `http://localhost:3003/health`
- Checks runtime status, memory, and connectivity
- Automatic restart on failure

### Monitoring Endpoints
- `/health` - Basic health status
- `/ready` - Readiness probe for Kubernetes
- Runtime status and metrics included

## Networking

### Port Mappings
- `3002` - WebSocket server for client connections
- `3003` - HTTP health check endpoints
- `6379` - Redis (if enabled)

### Service Discovery
- Uses Docker Compose networking
- Service names: `vehicle-edge-runtime`, `redis`, `nginx`
- Internal DNS resolution

## Troubleshooting

### Common Issues

1. **Docker Socket Permission Denied**
   ```bash
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

2. **Port Already in Use**
   ```bash
   # Check what's using the port
   lsof -i :3002
   # Change port in .env file
   ```

3. **Container Won't Start**
   ```bash
   # Check logs
   ./docker-setup.sh logs

   # Check container status
   ./docker-setup.sh status
   ```

4. **Application Execution Fails**
   ```bash
   # Check Docker daemon is running
   docker info

   # Check Docker socket mount
   docker exec vehicle-edge-runtime ls -la /var/run/docker.sock
   ```

### Debug Mode

Enable debug logging:
```bash
# Set log level in .env
LOG_LEVEL=debug

# Or override in docker-compose
environment:
  - LOG_LEVEL=debug
```

### Container Shell Access

```bash
# Access running container
docker exec -it vehicle-edge-runtime sh

# Check logs inside container
docker exec vehicle-edge-runtime ls -la /app/logs
```

## Production Deployment

### Security Considerations

1. **Network Isolation**: Use custom networks and firewall rules
2. **Resource Limits**: Set appropriate memory and CPU limits
3. **Secrets Management**: Use Docker secrets or environment files
4. **Monitoring**: Enable health checks and logging

### Scaling

The runtime supports horizontal scaling:
- Multiple instances can run behind load balancer
- Shared storage required for application persistence
- Redis can be used for session sharing

### Kubernetes

The Docker image is Kubernetes-ready:
- Health probes configured
- Non-root execution
- Resource requests/limits
- Proper termination handling

Example deployment manifest provided in `k8s/` directory.

## Integration with Eclipse Autowrx

### Service Discovery
- Runtime registers with Kit-Manager via WebSocket
- Health checks monitored by orchestration
- Logs aggregated with existing infrastructure

### Data Persistence
- Application data stored in mounted volumes
- Logs forwarded to centralized logging
- Metrics exported to monitoring systems

## Migration from SDV-Runtime

The Vehicle Edge Runtime provides a compatible API:
- Same WebSocket protocol endpoints
- Compatible message formats
- Drop-in replacement for development environments
- Simplified deployment model

For migration details, see `MIGRATION.md`.