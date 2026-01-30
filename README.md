# Vehicle Edge Runtime

A simplified application execution environment for Eclipse Autowrx applications, providing edge computing capabilities for vehicle systems.

## Quick Start (Docker)

The easiest way to run the Vehicle Edge Runtime is using the provided `docker-deploy.sh` script.

### Prerequisites

- Docker (with Docker Compose V2 plugin)
- Docker daemon running

> **Note:** This project requires the newer `docker compose` (V2) plugin, not the older `docker-compose` standalone command.
>
> See [SETUP.md](SETUP.md) for detailed setup instructions or run:
> ```bash
> ./scripts/setup-docker-compose.sh
> ```

### Pre-flight Check

Before deploying, run the pre-flight check to validate your environment:

```bash
./scripts/preflight-check.sh
```

This will check for:
- Docker installation and status
- Docker Compose V2 plugin
- Port availability
- Network conflicts
- Configuration files

### Basic Usage

```bash
# Deploy runtime only (connects to online Kit-Manager)
./docker-deploy.sh deploy

# Deploy with local Kuksa databroker
./docker-deploy.sh deploy kuksa

# Deploy complete stack (Runtime + Kuksa + Redis)
./docker-deploy.sh deploy full

# Stop services
./docker-deploy.sh stop

# View logs
./docker-deploy.sh logs

# Check service status
./docker-deploy.sh status

# Clean up (remove containers, volumes, and images)
./docker-deploy.sh clean
```

## Deployment Profiles

The `docker-deploy.sh` script supports multiple deployment profiles:

| Profile | Description |
|---------|-------------|
| `base` | Runtime only (connects to online Kit-Manager) |
| `kuksa` | Runtime + local Kuksa databroker |
| `redis` | Runtime + Redis caching |
| `full` | Runtime + Kuksa + Redis (complete stack) |

### Naming Your Runtime

You can optionally provide a custom runtime name for Kit-Manager registration:

```bash
# Deploy with custom name
./docker-deploy.sh deploy base my-production-runtime

# The runtime will register as: Edge-Runtime-<hash>-my-production-runtime
```

### Examples

```bash
# Runtime only
./docker-deploy.sh deploy base

# Named 'production'
./docker-deploy.sh deploy base production

# With local Kuksa, named 'vehicle-1'
./docker-deploy.sh deploy kuksa vehicle-1

# Complete stack
./docker-deploy.sh deploy full
```

## What the Script Does

When you run `./docker-deploy.sh deploy`, the script automatically:

1. **Checks Docker** - Verifies Docker is running
2. **Creates .env** - Copies `.env.production` if `.env` doesn't exist
3. **Detects Docker GID** - Sets the Docker group ID for container access
4. **Pre-pulls Images** - Pulls required images (Python, Kuksa) to avoid runtime errors
5. **Builds Mock Service** - Builds the mock service image if needed
6. **Builds Runtime** - Builds the vehicle-edge-runtime Docker image
7. **Starts Services** - Starts services based on the selected profile
8. **Shows Status** - Displays service status and access points

## Access Points

After deployment, the runtime exposes the following endpoints:

| Endpoint | URL | Description |
|----------|-----|-------------|
| WebSocket API | `ws://localhost:3002/runtime` | Main WebSocket API for app management |
| Health Check | `http://localhost:3003/health` | HTTP health check endpoint |
| Kuksa Web UI | `http://localhost:55555` | Kuksa databroker web UI (kuksa/full profile) |

## Troubleshooting

If you encounter issues during deployment or runtime:

- **Pre-flight Check**: Run `./scripts/preflight-check.sh` to validate your environment
- **Setup Guide**: See [SETUP.md](SETUP.md) for detailed setup instructions
- **Troubleshooting Guide**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions

Common issues:
- **Docker Compose not found**: Run `./scripts/setup-docker-compose.sh`
- **Port already in use**: Check what's using ports 3002, 3003, 55555
- **Network conflicts**: Remove old networks with `docker network prune`
- **Container exits immediately**: Check logs with `./docker-deploy.sh logs`

## Configuration

The runtime uses environment variables for configuration. Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
# Edit .env with your settings
```

### Key Configuration Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3002 | WebSocket server port |
| `LOG_LEVEL` | info | Logging level (debug, info, warn, error) |
| `RUNTIME_NAME` | - | Optional runtime name suffix |
| `KIT_MANAGER_URL` | ws://localhost:3090 | Kit Manager WebSocket URL |
| `DATA_PATH` | ./data | Data storage directory |
| `MAX_CONCURRENT_APPS` | 10 | Maximum concurrent applications |
| `KUKSA_DATABROKER_URL` | http://localhost:8090 | Kuksa Data Broker URL |

## WebSocket API

The runtime exposes a WebSocket API for application management. Key message types:

### Application Lifecycle

- `run_python_app` - Execute a Python application
- `run_binary_app` - Execute a binary application
- `stop_app` - Stop a running application
- `pause_app` / `resume_app` - Pause/resume applications

### Application Management

- `deploy_request` - Deploy a new application
- `list_apps` - List all applications
- `get_app_status` - Get application status
- `get_app_logs` - Get application logs

### Console & Logs

- `console_subscribe` / `console_unsubscribe` - Subscribe to console output

### Vehicle Signals

- `write_signals_value` - Write vehicle signal values
- `get_signals_value` - Get vehicle signal values
- `subscribe_apis` - Subscribe to vehicle APIs

### Example: Run Python App

```json
{
  "type": "run_python_app",
  "code": "print('Hello Vehicle!')",
  "id": "my-app-001"
}
```

### Example: Deploy Application

```json
{
  "type": "deploy_request",
  "code": "print('Hello Vehicle!')",
  "language": "python",
  "name": "My Vehicle App",
  "id": "deploy-001"
}
```

## Features

- **Application Management**: Deploy, monitor, and manage vehicle applications (Python, Binary, Rust, C++, Docker)
- **Docker Integration**: Containerized application execution with resource management
- **WebSocket API**: Real-time communication and control interface with console streaming
- **Kit Manager Integration**: Connects to Kit Manager for coordinated fleet management
- **Kuksa Integration**: Vehicle signal access and management via Kuksa Data Broker
- **Health Monitoring**: Runtime health checks, resource monitoring, and status reporting
- **Mock Services**: Built-in mock service management for testing
- **Vehicle Model Generation**: Automatic VSS (Vehicle Signal Specification) model generation

## Project Structure

```
vehicle-edge-runtime/
├── src/
│   ├── api/           # WebSocket API handlers
│   ├── apps/          # Application management
│   ├── console/       # Console interface with streaming
│   ├── core/          # Core runtime components
│   ├── database/      # Database management
│   ├── monitoring/    # Resource monitoring
│   ├── services/      # Service management (Mock, etc.)
│   ├── utils/         # Utility functions
│   ├── vehicle/       # Vehicle-specific integrations (Kuksa, VSS)
│   └── index.js       # Main entry point
├── tests/             # Test suites
├── data/              # Runtime data directory
├── docker-deploy.sh   # Docker deployment script
└── docker-compose.yml # Docker Compose configuration
```

## Development

For local development (without Docker):

```bash
# Install dependencies
npm install

# Development mode with auto-reload
npm run dev

# Run tests
npm test
```

## License

Apache-2.0 License
