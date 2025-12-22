# Docker App Type API Specification

## Overview
API specification for the new Docker app type that allows direct Docker command execution while maintaining full lifecycle management and database integration.

## 🚀 New Docker App Deployment API

### 1. Deploy Docker App
```javascript
// Request: Deploy a Docker application with direct command execution
{
  "type": "deploy_request",
  "id": "string",                    // Unique request ID
  "prototype": {
    "id": "string",                  // App identifier (will be prefixed)
    "name": "string",                // Display name
    "type": "docker",                // ⭐ NEW: Docker app type
    "description": "string",         // App description
    "config": {
      "dockerCommand": ["string"]    // Docker command arguments
    }
  },
  "vehicleId": "string"              // Vehicle identifier
}

// Example: Kuksa Server Deployment
{
  "type": "deploy_request",
  "id": "deploy-kuksa-" + Date.now(),
  "prototype": {
    "id": "databroker",
    "name": "Kuksa Data Broker",
    "type": "docker",
    "description": "Eclipse Kuksa vehicle signal databroker - Production deployment",
    "config": {
      "dockerCommand": [
        "run", "-d",
        "--name", "kuksa-databroker-prod",
        "--network", "host",          // Host networking for localhost access
        "-p", "55555:55555",         // gRPC port
        "-p", "8090:8090",           // HTTP/VSS port
        "ghcr.io/eclipse-kuksa/kuksa-databroker:main",
        "--insecure",
        "--enable-viss",
        "--viss-port", "8090"
      ]
    }
  },
  "vehicleId": "test-vehicle-001"
}

// Response: Success with prefixed app ID
{
  "type": "deploy_request-response",
  "id": "string",                    // Request ID
  "cmd": "deploy_request",
  "executionId": "string",           // Final app ID (with prefix)
  "appId": "string",                 // Same as executionId
  "status": "started",               // | failed | stopped
  "result": "string",                // Success message
  "isDone": true,
  "code": 0,                         // | 1 for error
  "kit_id": "string",                // Runtime ID
  "timestamp": "ISO 8601 string"
}
```

### 2. App ID Prefixing Logic
```javascript
// Automatic prefixing based on app type and name:
if (prototype?.type === 'docker') {
  if (prototype.name?.toLowerCase().includes('kuksa')) {
    baseId = `kuksa-${prototype.id}`;    // e.g., "kuksa-databroker"
  } else {
    baseId = `docker-${prototype.id}`;   // e.g., "docker-nginx"
  }
}

// Examples:
// Input:  {id: "databroker", name: "Kuksa Data Broker"}
// Output: "kuksa-databroker"

// Input:  {id: "webserver", name: "Nginx"}
// Output: "docker-webserver"
```

## 📋 Docker App Management API

### 3. List All Apps (including Docker)
```javascript
// Request
{
  "type": "list_deployed_apps",
  "id": "string"
}

// Response: Shows all app types with Docker integration
{
  "type": "list_deployed_apps-response",
  "id": "string",
  "applications": [
    {
      "app_id": "kuksa-databroker",          // Prefixed ID
      "name": "Kuksa Data Broker",
      "type": "docker",                      // ⭐ Docker app type
      "status": "running",                   // | stopped | error
      "deploy_time": "2025-12-22 08:51:42",
      "auto_start": true,
      "description": "Eclipse Kuksa vehicle signal databroker",
      "container_id": "c778105f3608...",     // Docker container ID
      "resources": "{\"cpu_limit\":\"100%\",\"memory_limit\":\"unlimited\"}",
      "last_heartbeat": "2025-12-22 08:51:42",
      "exit_code": null
    },
    {
      "app_id": "docker-nginx",
      "name": "Nginx Web Server",
      "type": "docker",
      "status": "stopped",
      "container_id": "a1b2c3d4e5f6...",
      // ... other fields
    },
    {
      "app_id": "python-app-1",
      "name": "Python Vehicle App",
      "type": "python",                     // Regular Python app
      // ... other fields
    }
  ],
  "total_count": 3,
  "running_count": 1,
  "paused_count": 0,
  "stopped_count": 1,
  "error_count": 0,
  "timestamp": "ISO 8601 string"
}
```

### 4. Docker App Lifecycle Management
```javascript
// Start Docker App
{
  "type": "manage_app",
  "id": "string",
  "appId": "kuksa-databroker",              // Prefixed app ID
  "action": "start"                         // | stop | restart | pause | resume | remove
}

// Response
{
  "type": "manage_app-response",
  "id": "string",
  "appId": "string",
  "action": "string",
  "status": "success" | "failed",
  "message": "string",
  "containerId": "string",                  // Updated container ID
  "timestamp": "ISO 8601 string"
}

// Get specific app status
{
  "type": "get_app_status",
  "id": "string",
  "appId": "kuksa-databroker"
}

// Response
{
  "type": "get_app_status-response",
  "id": "string",
  "appId": "string",
  "status": "running",                      // | stopped | error
  "running": true,
  "containerId": "c778105f3608...",
  "timestamp": "ISO 8601 string"
}
```

## 🔧 Docker App Configuration

### 5. Docker Command Structure
```javascript
// Full Docker command structure supported:
{
  "type": "deploy_request",
  "prototype": {
    "id": "my-app",
    "type": "docker",
    "config": {
      "dockerCommand": [
        // Any valid Docker command arguments
        "run",                              // Docker command
        "-d",                               // Detached mode
        "--name", "my-container",           // Container name
        "--network", "host",                // Network mode
        "-p", "8080:8080",                 // Port mapping (if not host network)
        "-e", "ENV_VAR=value",              // Environment variables
        "-v", "/host/path:/container/path", // Volume mounts
        "--restart", "unless-stopped",      // Restart policy
        "image:tag",                        // Docker image
        "--arg1", "value1",                 // Container arguments
        "--arg2", "value2"
      ]
    }
  }
}
```

### 6. Database Schema Extension
```sql
-- Docker apps stored in same applications table
CREATE TABLE applications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT DEFAULT '1.0.0',
    type TEXT CHECK (type IN ('python', 'binary', 'docker')) NOT NULL,  -- ⭐ Includes 'docker'
    code TEXT,                              -- NULL for Docker apps
    status TEXT CHECK (status IN ('installed', 'starting', 'running', 'paused', 'stopped', 'error', 'updating', 'unknown')) NOT NULL,
    auto_start BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_start TIMESTAMP,
    last_heartbeat TIMESTAMP,
    exit_code INTEGER,
    resources TEXT,                         -- JSON for resource limits
    container_id TEXT,                      -- Docker container ID
    pid INTEGER,                            -- NULL for Docker apps
    signals TEXT,                           -- JSON array of VSS signals
    python_deps TEXT,                       -- NULL for Docker apps
    FOREIGN KEY (signals) REFERENCES signals(path)
);
```

## 🌐 Network Configuration

### 7. Host Networking Support
```javascript
// Docker apps automatically use host networking for localhost access
{
  "type": "deploy_request",
  "prototype": {
    "id": "vehicle-app",
    "type": "docker",
    "config": {
      "dockerCommand": [
        "run",
        "--network", "host",              // ⭐ Host networking enabled
        "my-vehicle-app:latest"
      ]
    }
  }
}

// Vehicle apps can then connect to localhost services:
// - Kuksa server: localhost:55555 (gRPC), localhost:8090 (HTTP)
// - Other services: localhost:PORT
```

## 🔍 Docker App Examples

### 8. Common Docker App Patterns
```javascript
// Kuksa Data Broker
{
  "type": "deploy_request",
  "prototype": {
    "id": "databroker",
    "name": "Kuksa Data Broker",
    "type": "docker",
    "config": {
      "dockerCommand": [
        "run", "-d",
        "--name", "kuksa-databroker-prod",
        "--network", "host",
        "ghcr.io/eclipse-kuksa/kuksa-databroker:main",
        "--insecure", "--enable-viss", "--viss-port", "8090"
      ]
    }
  }
}

// Web Server
{
  "type": "deploy_request",
  "prototype": {
    "id": "nginx",
    "name": "Nginx Web Server",
    "type": "docker",
    "config": {
      "dockerCommand": [
        "run", "-d",
        "--name", "vehicle-web-server",
        "-p", "8080:80",
        "nginx:alpine"
      ]
    }
  }
}

// Custom Vehicle App with Environment Variables
{
  "type": "deploy_request",
  "prototype": {
    "id": "my-app",
    "name": "My Vehicle App",
    "type": "docker",
    "config": {
      "dockerCommand": [
        "run", "-d",
        "--name", "my-vehicle-app",
        "--network", "host",
        "-e", "KUKSA_SERVER=localhost:55555",
        "-e", "LOG_LEVEL=debug",
        "-e", "VEHICLE_ID=test-001",
        "my-vehicle-app:latest"
      ]
    }
  }
}
```

## ⚡ API Endpoints Summary

| Message Type | Purpose | Key Features |
|-------------|---------|--------------|
| `deploy_request` | Deploy Docker apps | Direct Docker commands, prefixing |
| `list_deployed_apps` | List all apps | Docker, Python, Binary apps together |
| `manage_app` | Lifecycle control | start/stop/restart/remove Docker apps |
| `get_app_status` | App details | Container ID, status, runtime info |
| `connection_established` | WebSocket handshake | Client & runtime IDs |

## 🎯 Key Benefits

1. **Unified Management**: Docker apps managed same as Python/Binary apps
2. **Database Integration**: Full lifecycle tracking and persistence
3. **Prefix Organization**: `kuksa-*` and `docker-*` prefixes for identification
4. **Host Networking**: Vehicle apps can connect to localhost services
5. **Direct Docker Access**: Any Docker command can be executed
6. **Frontend Ready**: Complete WebSocket API for UI integration
7. **Container Lifecycle**: Automatic container management and cleanup

This API provides complete Docker app integration while maintaining the existing vehicle app management patterns and database structure.