# Vehicle Edge Runtime

A no-bullshit application execution environment for Eclipse Autowrx. This replaces the over-engineered SDV-Runtime with something that actually works and doesn't make you want to tear your hair out.

## What This Is

The Vehicle Edge Runtime is a simplified Node.js service that runs Python and binary applications in Docker containers with real-time console output. It talks WebSocket protocol and integrates with the existing Eclipse Autowrx ecosystem without the complexity baggage of the original SDV-Runtime.

**Key design decisions:**
- Applications handle their own vehicle connections. We don't pretend to be smart about signal wiring.
- Docker gives us isolation. Let it do its job.
- WebSocket protocol that doesn't suck.
- Logs that are actually useful for debugging.

## Quick Start

### Prerequisites

- Node.js 18+ (if you're running directly)
- Docker daemon running (required regardless of deployment method)
- Linux or Unix-like system (this isn't Windows-friendly, deal with it)

### Running It

```bash
# Get the code
git clone https://github.com/tri2510/vehicle-edge-runtime.git
cd vehicle-edge-runtime

# Option 1: Run directly (development)
npm install
cp .env.example .env
npm start

# Option 2: Separate Containers (Recommended Production Setup)
./7-start-separate-services.sh

# Option 3: Development with hot reload
docker compose -f docker-compose.dev.yml up --build
```

### Separate Container Architecture (Recommended)

The production setup uses separate containers for Kit-Manager and Vehicle Edge Runtime:

```bash
# Automated setup with script
./7-start-separate-services.sh

# Or manual setup:
docker-compose -f docker-compose.separate.yml up -d

# Services:
# - Kit-Manager: http://localhost:3090 (WebSocket & HTTP API)
# - Vehicle Edge Runtime: ws://localhost:3002/runtime (WebSocket API)
# - Health Check: http://localhost:3003/health
```

### Legacy Combined Container

For development/testing, a combined container is still available:

```bash
# Build the combined container
docker build -f Dockerfile.dev -t vehicle-edge-runtime:combined .

# Run it
docker run -d --name vehicle-combined \
  -p 3002:3002 -p 3003:3003 -p 3090:3090 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/data:/app/data \
  vehicle-edge-runtime:combined
```

**⚠️ Note**: The combined container approach is deprecated. Use separate containers for production.

## Configuration

Create a `.env` file. Don't use the defaults in production unless you like getting hacked.

```bash
PORT=3002                              # Runtime WebSocket port
KIT_MANAGER_URL=ws://localhost:3090    # Kit-Manager WebSocket URL
DATA_PATH=./data                       # Where we store applications and logs
LOG_LEVEL=info                         # Don't run with 'debug' in production
MAX_CONCURRENT_APPS=10                 # Don't set this too high
DEFAULT_MEMORY_LIMIT=524288000        # 512MB per app (adjust for your hardware)
DEFAULT_CPU_LIMIT=50000               # 50% CPU per app (be reasonable)
```

## WebSocket API

The runtime listens on `ws://localhost:3002/runtime`. The Vehicle Edge Runtime uses standard WebSocket protocol, while Kit-Manager communication uses Socket.IO protocol for reliable service-to-service communication.

### Core Commands

**Register your kit:**
```json
{
  "type": "register_kit",
  "kit_id": "my-vehicle-edge-runtime",
  "name": "Vehicle Edge Runtime",
  "support_apis": ["run_python_app", "run_binary_app", "console_subscribe"]
}
```

**Run a Python application:**
```json
{
  "type": "run_python_app",
  "appId": "test-app",
  "code": "print('Hello World')\nimport time\ntime.sleep(1)",
  "entryPoint": "main.py",
  "env": {"TEST_VAR": "value"},
  "workingDir": "/app"
}
```

**Get real-time output:**
```json
{
  "type": "console_subscribe",
  "executionId": "execution-id-from-run-response"
}
```

**Stop an application:**
```json
{
  "type": "stop_app",
  "appId": "test-app"
}
```

### Response Format

All responses include a `type` field that echoes the request type with `-response` suffix:

```json
{
  "type": "run_python_app-response",
  "success": true,
  "executionId": "unique-execution-id",
  "appId": "test-app",
  "message": "Application started successfully"
}
```

Real-time console output:
```json
{
  "type": "console_output",
  "executionId": "unique-execution-id",
  "stream": "stdout",
  "output": "Hello World\n",
  "timestamp": "2025-12-04T13:15:01.582Z"
}
```

## Architecture

```
src/
├── core/
│   ├── VehicleEdgeRuntime.js      # Main runtime orchestrator
│   └── RuntimeRegistry.js         # What this runtime can do
├── apps/
│   └── ApplicationManager.js      # Docker container lifecycle
├── console/
│   └── ConsoleManager.js          # Output buffering and streaming
├── api/
│   ├── WebSocketHandler.js        # Connection housekeeping
│   └── MessageHandler.js          # Command processing
└── utils/
    ├── Logger.js                  # Structured logging that's actually useful
    └── HealthCheck.js             # Health monitoring
```

**Design principles:**
- Single responsibility for each module
- Fail fast and loudly
- No hidden magic
- Logging that helps debug real problems
- Resource limits that prevent system abuse

## Docker Deployment

### Security Considerations

This runs with proper isolation:
- Non-root user (UID 1001) inside containers
- Read-only filesystem where possible
- Resource limits enforced by Docker
- Network isolation between application containers

**Warning**: We mount `/var/run/docker.sock` so the runtime can spawn containers. This is necessary but means the runtime has container management privileges. Don't run untrusted code.

### Health Checks

- `http://localhost:3003/health` - Basic health status
- `http://localhost:3003/ready` - Readiness for load balancers

Both endpoints return JSON with status and basic metrics.

## Testing

The test suite is organized into unit, integration, and E2E tests:

```bash
# Run all unit tests (*.test.js files)
npm run test:unit

# Run integration tests (requires Docker daemon)
npm run test:integration

# Run E2E tests (Docker integration tests)
npm run test:e2e

# Run manual tests (interactive testing)
npm run test:manual

# Run all automated tests
npm test
```

### Test Structure
```
tests/
├── unit/                   # Unit tests for core components
│   ├── apps/ApplicationManager.test.js
│   └── core/VehicleEdgeRuntime.test.js
├── integration/            # Integration tests
│   ├── test-client.js      # WebSocket API tests
│   ├── test-python-app.js  # Python execution tests
│   └── websocket.test.js   # Automated WebSocket tests
└── e2e/                    # End-to-end tests
    └── test-client-docker.test.js
```

### Manual Testing

For development and debugging:

```bash
# Start the runtime
npm start

# Test WebSocket connectivity (separate terminal)
node tests/integration/test-client.js

# Test Python application execution
node tests/integration/test-python-app.js

# Quick smoke test
echo '{"type":"run_python_app","appId":"quick","code":"print(\"Working!\")","entryPoint":"main.py","workingDir":"/app"}' | websocat ws://localhost:3002/runtime
```

**Important Fixes Applied:**
- Docker volume naming: Uses absolute paths and sanitized container names
- UUID handling: Removes hyphens for Docker compatibility
- Proper error handling for stopped containers

### Test Coverage
- WebSocket connection handling and protocol
- Python application lifecycle (start/stop/status)
- Docker container management and isolation
- Real-time console output streaming
- Error conditions and edge cases
- Resource limit enforcement
- Kit-Manager integration

## Status

### Current Implementation Status: **✅ OPERATIONAL**

**Core Features Working:**
- ✅ WebSocket server and client connections
- ✅ Python application execution in Docker containers
- ✅ Real-time console output streaming
- ✅ Application lifecycle management (start/stop/status)
- ✅ Kit registration and discovery
- ✅ Runtime state monitoring and health checks
- ✅ Docker container isolation with resource limits
- ✅ Comprehensive test suite (unit/integration/E2E/manual)

**Recent Fixes Applied:**
- ✅ Docker volume naming: Fixed UUID hyphen compatibility issues
- ✅ Absolute path resolution: Proper volume binding for containers
- ✅ Error handling: Better handling of stopped containers and edge cases
- ✅ Test organization: All tests properly organized in tests/ folder
- ✅ Socket.IO Integration: Fixed Kit-Manager communication protocol
- ✅ Separate Container Architecture: Production-ready deployment model
- ✅ Test Suite Updates: All tests pass with Socket.IO integration

**Production Ready Components:**
- ✅ Separate container architecture (Kit-Manager + Vehicle Edge Runtime)
- ✅ Socket.IO protocol for reliable service communication
- ✅ Docker deployment with security best practices and open permissions
- ✅ Resource monitoring and limits
- ✅ Structured logging and debugging support
- ✅ WebSocket API compatibility with Eclipse Autowrx
- ✅ Comprehensive test suite with skipKitManager mode for testing

**Next Phase Development:**
- 🔄 Vehicle integration with Kuksa/external VSS servers
- 🔄 Enhanced error recovery and retry mechanisms
- 🔄 Performance optimization for high-concurrency scenarios

## Performance

Real-world metrics on reasonable hardware:
- **Startup**: ~2 seconds to ready state
- **Memory**: ~50MB base + container overhead
- **Latency**: <10ms WebSocket message processing
- **Throughput**: Limited by Docker daemon, not Node.js

### Don't Do This

- Don't set MAX_CONCURRENT_APPS above your hardware can handle
- Don't run without memory limits
- Don't disable logging in production
- Don't mount sensitive directories into application containers

## Integration with Eclipse Autowrx

This is designed as a drop-in replacement for SDV-Runtime:

**What works:**
- ✅ Kit-Manager communication protocol
- ✅ Existing frontend WebSocket clients
- ✅ Application deployment workflows
- ✅ Authentication and authorization
- ✅ Real-time console output

**What's different:**
- Applications must handle their own VSS/vehicle connections
- No built-in signal management (this is a feature, not a bug)
- Simpler deployment (no complex dependencies)
- Better error messages

## Building From Source

```bash
# Development build (with hot reload)
docker compose -f docker-compose.dev.yml build

# Production build
docker build -t vehicle-edge-runtime:latest .

# Combined container (Kit-Manager + Runtime)
docker build -f Dockerfile.dev -t vehicle-edge-runtime:combined .
```

## Debugging

**Enable debug logging:**
```bash
LOG_LEVEL=debug npm start
```

**Common issues:**

1. **Docker socket permissions**: Make sure your user can access `/var/run/docker.sock`
2. **Port conflicts**: Kill existing processes on ports 3002, 3003, 3090
3. **Docker volume errors**: If you see "invalid characters for a local volume name", ensure absolute paths are used
4. **Resource exhaustion**: Check Docker container limits and system resources
5. **Application timeouts**: Default is 30 seconds, adjust if needed

**Known Issues and Fixes:**
- **Docker volume naming**: Fixed UUID hyphen issues in container names and volume paths
- **Container already stopped**: Normal when Python apps finish quickly - not an error
- **Kit-Manager connection**: Fixed Socket.IO protocol compatibility - now connects properly
- **WebSocket vs Socket.IO**: Runtime uses WebSocket for clients, Socket.IO for Kit-Manager communication
- **Test failures**: Fixed with skipKitManager option and unique port allocation

**Useful commands:**
```bash
# Check running containers
docker ps

# View container logs
docker logs vehicle-combined

# Exec into container for debugging
docker exec -it vehicle-combined sh

# Monitor resource usage
docker stats vehicle-combined
```

## Contributing

I accept patches that:
1. Fix real bugs
2. Add useful features without breaking existing functionality
3. Don't over-engineer simple problems
4. Include tests for new functionality
5. Follow the existing code style

**Don't submit:**
- "Refactoring" that doesn't fix anything
- Features nobody needs
- Dependencies that bloat the project
- Code that doesn't follow the project patterns

## License

MIT License. Do whatever you want with this code, but don't blame me if it breaks something important.

## Support

If you find a real bug, open an issue with:
1. Clear description of the problem
2. Steps to reproduce
3. Expected vs actual behavior
4. Relevant logs

If you have questions, check the existing documentation first. I don't have time to handhold through basic Node.js or Docker troubleshooting.

---

**Vehicle Edge Runtime** - Because vehicle application execution shouldn't be this complicated.