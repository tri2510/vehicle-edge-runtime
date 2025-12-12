# Docker Tests for Vehicle Edge Runtime

This directory contains comprehensive Docker-specific tests to validate the containerized deployment of the Vehicle Edge Runtime.

## 📁 Test Structure

```
tests/docker/
├── build/                    # Docker build and image tests
│   └── dockerfile-build.test.js
├── runtime/                  # Container lifecycle tests
│   └── container-lifecycle.test.js
├── integration/             # Docker integration tests
│   └── docker-websocket-api.test.js
├── deployment/              # Deployment script tests
│   └── docker-deploy-script.test.js
└── README.md                # This file
```

## 🧪 Test Categories

### 1. Build Tests (`tests/docker/build/`)
Validates that the Docker image is built correctly:
- ✅ Successful Docker build
- ✅ Correct base image (node:20-alpine)
- ✅ Proper working directory (/app)
- ✅ Exposed ports (3002, 3003)
- ✅ Non-root user configuration
- ✅ Health check configuration
- ✅ System dependencies (docker-cli, curl)
- ✅ Production-only dependencies (no devDependencies)

### 2. Runtime Tests (`tests/docker/runtime/`)
Tests container behavior and lifecycle:
- ✅ Container start/stop functionality
- ✅ Port mapping and accessibility
- ✅ Volume mounting (/app/data)
- ✅ Docker socket access
- ✅ Environment variable application
- ✅ Resource limits (memory, CPU)
- ✅ Container isolation
- ✅ Graceful shutdown handling

### 3. Integration Tests (`tests/docker/integration/`)
Validates runtime functionality through Docker:
- ✅ WebSocket API through Docker networking
- ✅ Application deployment in containerized environment
- ✅ Kit-Manager connectivity (wss://kit.digitalauto.tech)
- ✅ Health check endpoint accessibility
- ✅ Concurrent connection handling
- ✅ Error handling and recovery
- ✅ Connection stability

### 4. Deployment Tests (`tests/docker/deployment/`)
Tests the deployment automation:
- ✅ `docker-deploy.sh` script functionality
- ✅ Different deployment profiles (base, kuksa, redis, full)
- ✅ Service status and health monitoring
- ✅ Cleanup operations
- ✅ Environment configuration handling
- ✅ Error handling and user feedback

## 🚀 Running Docker Tests

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- Docker daemon running
- Sufficient disk space (~2GB for test images)

### Available Commands

```bash
# Run all Docker tests
npm run test:docker

# Run specific test categories
npm run test:docker:build        # Build and image tests
npm run test:docker:runtime      # Container lifecycle tests
npm run test:docker:integration # Docker integration tests
npm run test:docker:deployment  # Deployment script tests

# Run all tests (including Docker tests)
npm test

# Run regular tests only (excluding Docker)
npm run test:unit
npm run test:integration
npm run test:e2e
```

## 🔧 Test Configuration

### Environment Variables
Docker tests use these environment variables (can be overridden):

```bash
# Test configuration
TEST_IMAGE=vehicle-edge-runtime:test
TEST_TIMEOUT=180000  # 3 minutes
WS_PORT=3002
HEALTH_PORT=3003
```

### Test Isolation
- Each test runs in isolated containers
- Test containers use different port ranges (13002, 13003) to avoid conflicts
- Automatic cleanup after each test
- Temporary compose files for deployment tests

## 🐳 Docker Test Scenarios

### Smart Default Testing
The tests validate the smart default configuration:
- **Kit-Manager:** `wss://kit.digitalauto.tech` (always online)
- **Kuksa:** `localhost:55555` (local, customizable)
- **Runtime:** WebSocket API on port 3002
- **Health:** HTTP endpoint on port 3003

### Deployment Profile Testing
```bash
# Base deployment (online Kit-Manager)
./docker-deploy.sh deploy base

# With local Kuksa databroker
./docker-deploy.sh deploy kuksa

# With Redis caching
./docker-deploy.sh deploy redis

# Complete stack
./docker-deploy.sh deploy full
```

## 🔍 Test Coverage

### Docker Build Coverage
- ✅ Multi-stage build optimization
- ✅ Production dependencies only
- ✅ Security hardening (non-root user)
- ✅ Health check integration
- ✅ Minimal attack surface

### Docker Runtime Coverage
- ✅ Container lifecycle management
- ✅ Port exposure and mapping
- ✅ Volume mounting and persistence
- ✅ Docker-in-Docker functionality
- ✅ Resource management
- ✅ Network isolation

### Docker Integration Coverage
- ✅ End-to-end WebSocket communication
- ✅ Application deployment in containers
- ✅ External service connectivity
- ✅ Container orchestration behavior
- ✅ Service discovery

## ⚠️ Known Limitations

1. **Docker Environment Tests:** Tests require Docker daemon to be running
2. **Resource Requirements:** Docker tests consume significant resources
3. **Timing Sensitivity:** Some tests have timing dependencies
4. **Platform Dependencies:** Tests may behave differently on various platforms

## 🐛 Troubleshooting

### Common Issues

#### Docker Permission Denied
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

#### Port Conflicts
```bash
# Check what's using the port
lsof -i :3002
lsof -i :3003

# Kill conflicting processes
sudo kill -9 <PID>
```

#### Docker Daemon Not Running
```bash
# Start Docker daemon
sudo systemctl start docker
# or
sudo service docker start
```

#### Insufficient Disk Space
```bash
# Clean up Docker
docker system prune -a
```

### Test Debugging

#### Enable Verbose Logging
```bash
# Run with debug output
DEBUG=* npm run test:docker
```

#### Keep Test Containers
```bash
# Comment out cleanup in test to inspect containers
# await stopContainer();
```

#### Manual Container Inspection
```bash
# Check running containers
docker ps -a

# Inspect specific container
docker inspect vehicle-edge-test

# View container logs
docker logs vehicle-edge-test
```

## 📊 Test Metrics

### Performance Benchmarks
- **Build Time:** ~2-3 minutes for full image build
- **Container Start:** ~5-10 seconds
- **Health Check:** ~15-30 seconds to become healthy
- **Test Duration:** ~5-8 minutes for full Docker test suite

### Resource Usage
- **Memory:** ~200-400MB per test container
- **Disk:** ~1GB for test image and containers
- **CPU:** Variable based on test operations

## 🔄 Continuous Integration

### GitHub Actions
```yaml
name: Docker Tests
on: [push, pull_request]
jobs:
  docker-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Docker
        uses: docker/setup-buildx-action@v2
      - name: Run Docker Tests
        run: npm run test:docker
```

### Jenkins Pipeline
```groovy
pipeline {
    agent any
    stages {
        stage('Docker Tests') {
            steps {
                sh 'npm run test:docker'
            }
        }
    }
}
```

## 📝 Contributing

When adding new Docker tests:

1. **Follow naming convention:** `docker-*.test.js`
2. **Use appropriate category:** build, runtime, integration, or deployment
3. **Include cleanup:** Ensure containers are stopped and removed
4. **Handle timeouts:** Docker operations may take longer
5. **Test isolation:** Use unique container names and ports
6. **Error handling:** Gracefully handle Docker daemon issues

## 🎯 Best Practices

1. **Test Isolation:** Each test should be independent
2. **Resource Cleanup:** Always clean up containers and images
3. **Error Recovery:** Handle Docker daemon connectivity issues
4. **Timing:** Allow sufficient time for container operations
5. **Verification:** Validate both success and failure scenarios