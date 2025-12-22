# Vehicle Edge Runtime - Unified API Specification

## Overview
Complete WebSocket API specification for Vehicle Edge Runtime supporting **Python, Binary, and Docker** application deployment through **unified Docker container management**.

**Connection:** `ws://localhost:3002/runtime`

## 🚀 NEW: Unified Docker Container Architecture

All application types (Python, Binary, Docker) now run in **isolated Docker containers** with:
- Consistent deployment workflow
- Real-time progress tracking
- Enhanced dependency management
- Resource isolation and security
- Unified lifecycle management

## 🚀 Core Application Deployment APIs

### 1. Smart Unified Deployment (`smart_deploy`) ⭐ **RECOMMENDED**
**Primary API for all app types - Python, Binary, and Docker - with unified Docker container management**

### 2. Legacy App Deployment (`deploy_request`)
**Primary API for all app types - Python, Binary, and Docker**

```javascript
// Request: Universal deployment for all app types
{
  "type": "deploy_request",
  "id": "string",                    // Unique request ID (use timestamp)
  "prototype": {
    "id": "string",                  // App identifier (will be prefixed)
    "name": "string",                // Display name
    "type": "python" | "binary" | "docker", // ⭐ CRITICAL: App type
    "language": "string",            // Optional: for python/binary
    "description": "string",         // App description
    "config": {
      // Python/Binary apps
      "args": ["string"],
      "env": {"key": "value"},
      "workingDir": "string",

      // ⭐ Docker apps ONLY
      "dockerCommand": ["string"]    // Docker command arguments array
    }
  },
  "code": "string",                  // Optional: for python/binary apps
  "vehicleId": "string"              // Vehicle identifier
}

// Response: Success for all app types
{
  "type": "deploy_request-response",
  "id": "string",
  "cmd": "deploy_request",
  "executionId": "string",           // Final app ID (with prefix)
  "appId": "string",                 // Same as executionId
  "status": "started" | "failed" | "stopped",
  "result": "string",                // Success/error message
  "isDone": true,
  "code": 0 | 1,                     // Exit code
  "containerId": "string",           // Docker apps only
  "kit_id": "string",                // Runtime ID
  "timestamp": "ISO 8601 string"
}
```

### 2. App Type Examples

#### Python App
```javascript
{
  "type": "deploy_request",
  "id": "deploy-python-" + Date.now(),
  "prototype": {
    "id": "vehicle-sensor-app",
    "name": "Vehicle Sensor Monitor",
    "type": "python",
    "description": "Monitors vehicle sensors"
  },
  "code": "import kuksa_client\nprint('Hello Vehicle')",
  "vehicleId": "test-vehicle-001"
}
// Result: App ID = "vehicle-sensor-app" (no prefix)
```

#### Docker App (Kuksa Server)
```javascript
{
  "type": "deploy_request",
  "id": "deploy-kuksa-" + Date.now(),
  "prototype": {
    "id": "kuksa-vea-kuksa-databroker",  // Frontend provides complete ID
    "name": "Kuksa Data Broker",        // Display name (no prefix logic)
    "type": "docker",                  // ⭐ CRITICAL: MUST be "docker"
    "description": "Eclipse Kuksa vehicle signal databroker",
    "config": {
      "dockerCommand": [               // ⭐ CRITICAL: MUST be array
        "run", "-d",
        "--name", "kuksa-databroker-prod",
        "--network", "host",
        "-p", "55555:55555",           // gRPC port
        "-p", "8090:8090",             // HTTP/VSS port
        "ghcr.io/eclipse-kuksa/kuksa-databroker:main",
        "--insecure",
        "--enable-viss",
        "--viss-port", "8090"
      ]
    }
  },
  "vehicleId": "default-vehicle"
}
// Result: App ID = "kuksa-vea-kuksa-databroker" (exact frontend ID)
```

#### Docker App (Other)
```javascript
{
  "type": "deploy_request",
  "id": "deploy-nginx-" + Date.now(),
  "prototype": {
    "id": "docker-nginx",                // Frontend provides complete ID
    "name": "Nginx Web Server",         // Display name
    "type": "docker",
    "description": "Web server for vehicle UI",
    "config": {
      "dockerCommand": [
        "run", "-d",
        "--name", "vehicle-web-server",
        "-p", "8080:80",
        "nginx:alpine"
      ]
    }
  },
  "vehicleId": "default-vehicle"
}
// Result: App ID = "docker-nginx" (exact frontend ID)
```

## 🔧 App Management APIs

### 3. List Deployed Apps
```javascript
// Request
{
  "type": "list_deployed_apps",
  "id": "string"
}

// Response: All app types (python, binary, docker)
{
  "type": "list_deployed_apps-response",
  "id": "string",
  "applications": [
    {
      "app_id": "kuksa-vea-kuksa-databroker", // Frontend ID
      "name": "Kuksa Data Broker",
      "type": "docker",                  // | "python" | "binary"
      "status": "running",               // | "stopped" | "error" | "paused"
      "deploy_time": "2025-12-22 09:16:39",
      "auto_start": true,
      "description": "Vehicle signal databroker",
      "container_id": "99d5f9eedad2...", // Docker apps only
      "pid": 12345,                      // Python/Binary apps only
      "exit_code": null,
      "last_heartbeat": "2025-12-22 09:16:40"
    }
  ],
  "total_count": number,
  "running_count": number,
  "paused_count": number,
  "stopped_count": number,
  "error_count": number,
  "timestamp": "ISO 8601 string"
}
```

### 4. App Lifecycle Management
```javascript
// Request: Control app lifecycle
{
  "type": "manage_app",
  "id": "string",
  "appId": "string",                   // App ID from list_deployed_apps
  "action": "start" | "stop" | "restart" | "pause" | "resume" | "remove"
}

// Response
{
  "type": "manage_app-response",
  "id": "string",
  "appId": "string",
  "action": "string",
  "status": "success" | "failed",
  "message": "string",
  "containerId": "string",              // Docker apps: updated container ID
  "timestamp": "ISO 8601 string"
}

// Request: Get specific app status
{
  "type": "get_app_status",
  "id": "string",
  "appId": "string"
}

// Response
{
  "type": "get_app_status-response",
  "id": "string",
  "appId": "string",
  "status": "running" | "stopped" | "error",
  "running": boolean,
  "containerId": "string",              // Docker apps only
  "pid": number,                        // Python/Binary apps only
  "timestamp": "ISO 8601 string"
}
```

## 🧠 Smart Features APIs

### 5. Smart Deployment (`smart_deploy`) ⭐ **ENHANCED**
**Unified intelligent deployment with auto-detection and Docker container management**

```javascript
// Request: Unified smart deployment for ALL app types (Python, Binary, Docker)
{
  "type": "smart_deploy",
  "id": "string",
  "name": "string",                    // Display name
  "deploymentType": "python" | "binary" | "docker",  // ⭐ NEW: Explicit deployment type
  "code": "string",                    // Python only: Application code
  "binaryUrl": "string",               // Binary only: Download URL for binary
  "binaryFile": "string",              // Binary only: Base64 encoded binary
  "runCommand": "string",              // Binary only: Command to execute binary
  "dockerImage": "string",             // Docker only: Existing Docker image
  "dockerCommand": ["string"],         // Docker only: Custom Docker command array
  "dependencies": ["string"],          // Python only: Package dependencies
  "baseImage": "string",               // Optional: Custom base Docker image
  "pythonVersion": "string",           // Optional: Python version (default: 3.9)
  "ports": ["string"],                 // Optional: Port mappings (host:container)
  "volumes": ["string"],               // Optional: Volume mappings
  "dockerEnv": {"key": "value"},        // Optional: Docker environment variables
  "resources": {"key": "value"},       // Optional: Resource limits
  "signals": ["string" | {path: "string", access: "string", rate_hz: number}],
  "kuksa_config": {                    // Optional KUKSA configuration
    "server": "string",
    "tls": {"ca_cert": "string"}
  },
  "environment": "production" | "staging" | "development"
}

// Response: Success with auto-detected features
{
  "type": "smart_deploy-response",
  "id": "string",
  "app_id": "string",                  // Unique ID (may have suffix added)
  "status": "success",
  "auto_detected_dependencies": ["string"],
  "signal_validation": {
    "valid": [Signal],
    "invalid": [Signal],
    "warnings": ["string"],
    "total": number
  },
  "deployment_id": "string",
  "timestamp": "ISO 8601 string"
}
```

### 6. Dependency Detection
```javascript
// Request: Analyze code for dependencies
{
  "type": "detect_dependencies",
  "id": "string",
  "code": "string",                    // Source code to analyze
  "language": "python" | "binary"      // Language (default: "python")
}

// Response: Detected dependencies
{
  "type": "dependencies_detected",
  "id": "string",
  "language": "string",
  "dependencies": ["string"],          // Package names
  "count": number,
  "timestamp": "ISO 8601 string"
}
```

### 7. Signal Validation
```javascript
// Request: Validate vehicle signal availability
{
  "type": "validate_signals",
  "id": "string",
  "signals": ["string" | {path: "string", access: "string", rate_hz: number}]
}

// Response: Signal validation results
{
  "type": "signals_validated",
  "id": "string",
  "validation": {
    "valid": [Signal],                 // Available signals
    "invalid": [Signal],               // Unavailable signals
    "warnings": ["string"],            // Validation warnings
    "total": number
  },
  "timestamp": "ISO 8601 string"
}

// Signal object format
{
  "path": "Vehicle.Speed",             // VSS signal path
  "access": "subscribe" | "get",       // Access type
  "rate_hz": number                    // Update frequency (optional)
}
```

## 🎯 App ID Management

**No automatic prefixing - frontend controls complete ID:**

The runtime uses the `prototype.id` field directly without any automatic modifications. The frontend is responsible for providing the complete app ID including any desired prefixes.

```javascript
// Runtime behavior:
executionId = await this._ensureUniqueId(prototype.id);  // Uses frontend ID directly
appId = executionId;  // Both IDs are the same

// Examples of frontend-provided IDs:
- {id: "kuksa-vea-kuksa-databroker"} → Final ID: "kuksa-vea-kuksa-databroker"
- {id: "vehicle-sensor-app"} → Final ID: "vehicle-sensor-app"
- {id: "docker-webserver"} → Final ID: "docker-webserver"
- {id: "my-custom-app"} → Final ID: "my-custom-app"
```

**Frontend Responsibility:**
- Provide complete, unique IDs in `prototype.id`
- Include any desired prefixes (kuksa-, docker-, etc.)
- Handle ID generation logic according to app naming conventions

**Runtime Responsibility:**
- Ensure uniqueness by appending `_2`, `_3`, etc. if conflicts exist
- Use the frontend-provided ID as the base for uniqueness checking

## 🔧 Troubleshooting & Common Issues

### ❌ Docker App Deployment Issues

**Issue: App not deploying as Docker type**
- **Symptoms:** No prefix applied, no container created, error status
- **Solution:** Ensure exact format:
  ```javascript
  {
    "prototype": {
      "type": "docker",              // MUST be exactly "docker"
      "config": {
        "dockerCommand": [...]      // MUST be array, not string
      }
    }
  }
  ```


**Issue: No container ID in response**
- **Solution:** Check `dockerCommand` is array format:
  ```javascript
  // ✅ CORRECT
  "dockerCommand": ["run", "-d", "--name", "my-app", "image:tag"]
  // ❌ WRONG
  "dockerCommand": "run -d --name my-app image:tag"
  ```

### ❌ Smart Deployment Issues

**Issue: Smart deploy not working for Docker apps**
- **Solution:** Smart deployment only supports Python/Binary apps. Use `deploy_request` for Docker apps.

**Issue: Dependency detection failing**
- **Solution:** Ensure `code` field contains valid Python/binary code.

## 🌐 Network Configuration

### Host Networking
All apps (Python, Binary, Docker) use **host networking** for localhost access:
- **Kuksa server:** `localhost:55555` (gRPC), `localhost:8090` (HTTP)
- **Other services:** `localhost:PORT`
- **Docker apps:** Can connect to host services directly

### Container Port Access
```javascript
// Docker apps with host networking
{
  "dockerCommand": [
    "run", "-d",
    "--network", "host",              // Host networking enabled
    "my-vehicle-app:latest"           // Direct access to host ports
  ]
}
```

## 📋 Testing Checklist

### Before Production Deployment:

1. **✅ Basic App Types**
   - Python app deploys with `type: "python"`
   - Binary app deploys with `type: "binary"`
   - Docker app deploys with `type: "docker"`

2. **✅ App ID Prefixing**
   - Kuksa apps get `kuksa-*` prefix
   - Non-Kuksa Docker apps get `docker-*` prefix
   - Python/Binary apps keep original ID

3. **✅ Docker Container Management**
   - Container starts with correct ID
   - Container accessible via host networking
   - Container lifecycle works (start/stop/restart)

4. **✅ Database Registration**
   - All apps registered in applications table
   - Correct app_type stored
   - Container ID tracked for Docker apps
   - PID tracked for Python/Binary apps

5. **✅ Smart Features**
   - Dependency detection works for Python code
   - Signal validation functions correctly
   - Smart deployment handles auto-detected features

## 🎯 Complete Deployment Examples

### Python Application (Enhanced Docker-based)
```javascript
{
  "type": "smart_deploy",
  "id": "deploy-python-enhanced-" + Date.now(),
  "deploymentType": "python",
  "name": "Enhanced Python Vehicle App",
  "code": `
import requests
import kuksa_client

def main():
    print("🚀 Enhanced Python app running in Docker container!")
    # Your vehicle app logic here
  `,
  "dependencies": ["requests", "kuksa-client"],
  "baseImage": "python:3.9-slim",
  "pythonVersion": "3.9",
  "ports": ["8080:8080"],
  "kuksa_config": {
    "server": "localhost:55555"
  },
  "environment": "production"
}
// Result: Docker container built with Python runtime + dependencies
```

### Binary Application (NEW)
```javascript
{
  "type": "smart_deploy",
  "id": "deploy-binary-" + Date.now(),
  "deploymentType": "binary",
  "name": "Compiled Vehicle Application",
  "binaryUrl": "https://releases.example.com/vehicle-app-linux-amd64",
  "runCommand": "./vehicle-app --config=/app/config.json",
  "baseImage": "alpine:latest",
  "ports": ["9090:9090"],
  "environment": "production",
  "dockerEnv": {
    "APP_ENV": "production",
    "LOG_LEVEL": "info"
  },
  "resources": {
    "memory": "256m",
    "cpu": "0.5"
  }
}
// Result: Binary packaged in Docker container with alpine base
```

### Docker Container - Existing Image (NEW)
```javascript
{
  "type": "smart_deploy",
  "id": "deploy-docker-image-" + Date.now(),
  "deploymentType": "docker",
  "name": "Nginx Web Server",
  "dockerImage": "nginx:alpine",
  "ports": ["8888:80"],
  "volumes": ["/host/www:/usr/share/nginx/html"],
  "environment": "production"
}
// Result: Pulls nginx:alpine and runs as managed application
```

### Docker Container - Custom Command (NEW)
```javascript
{
  "type": "smart_deploy",
  "id": "deploy-custom-docker-" + Date.now(),
  "deploymentType": "docker",
  "name": "Custom Docker Service",
  "dockerCommand": [
    "run", "-d",
    "--name", "custom-service",
    "-p", "7777:3000",
    "-e", "NODE_ENV=production",
    "-v", "/host/data:/app/data",
    "my-custom-app:latest"
  ],
  "environment": "production"
}
// Result: Custom Docker command executed as managed application
```

## 📱 Real-time Progress Tracking

All deployments now provide detailed progress updates:

```javascript
// Progress stages for all deployment types
{
  "installing_dependencies": "Setting up dependencies...",
  "building_container": "Building Docker image...",
  "deploying_container": "Deploying container...",
  "starting_container": "Starting application...",
  "deployment_success": "Application running successfully!",
  "deployment_failed": "Deployment failed"
}

// WebSocket progress messages
{
  "type": "deployment_progress",
  "appId": "app-id",
  "stage": "building_container",
  "details": {
    "deploymentType": "python",
    "progress": 45,
    "imageName": "vea-my-app-python"
  }
}
```

## 🔄 Migration Guide for Existing Python Deployments

### Before (Traditional)
```javascript
// Old approach - direct Python execution
{
  "type": "smart_deploy",
  "code": "print('Hello')",
  "dependencies": ["requests"]
}
```

### After (Enhanced Docker-based) ⭐ **RECOMMENDED**
```javascript
// New approach - Docker container with enhanced features
{
  "type": "smart_deploy",
  "deploymentType": "python",
  "code": "print('Hello')",
  "dependencies": ["requests"],
  "baseImage": "python:3.9-slim",
  "ports": ["8080:8080"],
  "environment": "production"
}
```

### Benefits of Migration
✅ **Better Isolation** - Apps run in isolated containers
✅ **Enhanced Security** - Container boundaries prevent conflicts
✅ **Dependency Management** - No global Python package conflicts
✅ **Resource Control** - Memory and CPU limits available
✅ **Progress Tracking** - Real-time deployment progress
✅ **Consistent Environment** - Same environment everywhere

## 📞 Integration Support

**For integration issues:**
1. **Use `smart_deploy` with `deploymentType`** for all new implementations
2. Verify message format matches examples exactly
3. Check runtime logs for detailed error messages
4. Ensure WebSocket connection to `ws://localhost:3002/runtime`
5. Test with provided examples before customizing
6. Monitor progress via WebSocket for better user experience
7. Reference `FRONTEND_BINARY_DOCKER_IMPLEMENTATION.md` for UI guidelines

**Complete unified API specification with Docker container management for all deployment types.**