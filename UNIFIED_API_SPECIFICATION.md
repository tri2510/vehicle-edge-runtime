# Vehicle Edge Runtime - Unified API Specification

## Overview
Complete WebSocket API specification for Vehicle Edge Runtime supporting Python, Binary, and Docker application deployment with smart features.

**Connection:** `ws://localhost:3002/runtime`

## 🚀 Core Application Deployment APIs

### 1. Universal App Deployment (`deploy_request`)
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
    "id": "databroker",
    "name": "Kuksa Data Broker",        // Must contain "kuksa" for prefix
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
// Result: App ID = "kuksa-databroker" (with prefix)
```

#### Docker App (Other)
```javascript
{
  "type": "deploy_request",
  "id": "deploy-nginx-" + Date.now(),
  "prototype": {
    "id": "webserver",
    "name": "Nginx Web Server",         // No "kuksa" in name
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
// Result: App ID = "docker-webserver" (with prefix)
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
      "app_id": "kuksa-databroker",      // Prefixed ID
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

### 5. Smart Deployment (`smart_deploy`)
**Intelligent deployment with auto-detection**

```javascript
// Request: Smart deployment for Python/Binary apps
{
  "type": "smart_deploy",
  "id": "string",
  "name": "string",                    // Display name
  "type": "python" | "binary",         // App type (docker not supported here)
  "code": "string",                    // Application code (required)
  "dependencies": ["string"],          // Optional manual dependencies
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

## 🎯 App ID Prefixing Logic

**Automatic prefixing based on app type and name:**

```javascript
// Docker Apps:
if (prototype.type === 'docker') {
  if (prototype.name.toLowerCase().includes('kuksa')) {
    baseId = `kuksa-${prototype.id}`;    // e.g., "kuksa-databroker"
  } else {
    baseId = `docker-${prototype.id}`;   // e.g., "docker-nginx"
  }
}

// Python/Binary Apps:
// No prefix applied - use prototype.id directly
// e.g., "vehicle-sensor-app" (not "python-vehicle-sensor-app")
```

**Examples:**
- `{id: "databroker", name: "Kuksa Data Broker", type: "docker"}` → `kuksa-databroker`
- `{id: "webserver", name: "Nginx", type: "docker"}` → `docker-webserver`
- `{id: "sensor-app", name: "Vehicle Sensor", type: "python"}` → `vehicle-sensor-app`

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

**Issue: Kuksa prefix not applied**
- **Symptoms:** App ID is "databroker" instead of "kuksa-databroker"
- **Solution:** Ensure `prototype.name` contains "kuksa" (case-insensitive)

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

## 📞 Integration Support

**For integration issues:**
1. Verify message format matches examples exactly
2. Check runtime logs for detailed error messages
3. Ensure WebSocket connection to `ws://localhost:3002/runtime`
4. Test with provided examples before customizing
5. Reference this unified specification for all API needs

**Complete API specification synced with current Vehicle Edge Runtime implementation.**