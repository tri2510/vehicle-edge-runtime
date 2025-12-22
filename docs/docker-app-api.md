# Docker App Type API Documentation

## Overview

The Vehicle Edge Runtime now supports a new **Docker App Type** that allows direct Docker command execution with full container lifecycle management. This enables running any Docker container as a regular vehicle app with database persistence and frontend API controls.

## Features

- ✅ **Direct Docker Command Execution**: Run any Docker command with parameters
- ✅ **Database Integration**: Docker apps are stored and managed like regular apps
- ✅ **Frontend API Support**: Start/stop/status controls via WebSocket API
- ✅ **Container Lifecycle Management**: Full Docker container lifecycle controls
- ✅ **Resource Monitoring**: Container resource usage and health tracking
- ✅ **Host Networking**: All containers use host network for seamless connectivity

## API Messages

### 1. Deploy Docker App (deploy_request)

Deploy a Docker app using the `deploy_request` WebSocket message:

```javascript
{
  "type": "deploy_request",
  "id": "unique-request-id",
  "prototype": {
    "id": "docker-app-id",
    "name": "My Docker App",
    "type": "docker",
    "description": "App description",
    "config": {
      "dockerCommand": [
        "run", "-d",
        "--name", "my-container",
        "nginx:latest"
      ]
    }
  },
  "vehicleId": "vehicle-123"
}
```

#### Response

```javascript
{
  "type": "deploy_request-response",
  "id": "unique-request-id",
  "cmd": "deploy_request",
  "executionId": "docker-app-id",
  "appId": "docker-app-id",
  "status": "started",
  "result": "Application deployed and started successfully",
  "isDone": true,
  "code": 0,
  "kit_id": "runtime-id",
  "timestamp": "2025-12-22T08:15:44.193Z"
}
```

### 2. List Deployed Apps (list_deployed_apps)

List all deployed apps including Docker apps:

```javascript
{
  "type": "list_deployed_apps",
  "id": "unique-request-id"
}
```

#### Response

```javascript
{
  "type": "list_deployed_apps-response",
  "id": "unique-request-id",
  "applications": [
    {
      "app_id": "docker-app-id",
      "name": "My Docker App",
      "version": "1.0.0",
      "type": "docker",
      "status": "running",
      "container_id": "container-hash",
      "deploy_time": "2025-12-22 08:15:43",
      "description": "App description"
    }
  ],
  "total_count": 1,
  "running_count": 1,
  "timestamp": "2025-12-22T08:15:46.199Z"
}
```

### 3. Manage Docker App (manage_app)

Control Docker app lifecycle:

```javascript
{
  "type": "manage_app",
  "id": "unique-request-id",
  "appId": "docker-app-id",
  "action": "stop|start|restart|remove"
}
```

## Docker App Configuration

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Must be `"docker"` |
| `config.dockerCommand` | array | Docker command and arguments |

### Example Configurations

#### Simple Web Server
```javascript
{
  "id": "nginx-server",
  "name": "Nginx Web Server",
  "type": "docker",
  "config": {
    "dockerCommand": [
      "run", "-d",
      "--name", "nginx-server",
      "-p", "8080:80",
      "nginx:alpine"
    ]
  }
}
```

#### Database Server
```javascript
{
  "id": "postgres-db",
  "name": "PostgreSQL Database",
  "type": "docker",
  "config": {
    "dockerCommand": [
      "run", "-d",
      "--name", "postgres",
      "-e", "POSTGRES_PASSWORD=mysecretpassword",
      "-p", "5432:5432",
      "postgres:13"
    ]
  }
}
```

#### Kuksa Data Broker
```javascript
{
  "id": "kuksa-server",
  "name": "Kuksa Data Broker",
  "type": "docker",
  "config": {
    "dockerCommand": [
      "run", "-d",
      "--name", "kuksa-server",
      "-p", "55555:55555",
      "-p", "8090:8090",
      "ghcr.io/eclipse-kuksa/kuksa-databroker:main",
      "--insecure",
      "--enable-viss",
      "--viss-port", "8090"
    ]
  }
}
```

## Database Schema

Docker apps are stored in the `apps` table with:

```sql
CREATE TABLE apps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('python', 'binary', 'docker')) NOT NULL,
    config TEXT, -- JSON with dockerCommand
    status TEXT DEFAULT 'installed',
    -- ... other fields
);
```

## WebSocket Endpoints

### Connection
```
ws://localhost:3002/runtime
```

### Message Flow
1. Connect to WebSocket endpoint
2. Receive `connection_established` confirmation
3. Send `deploy_request` with Docker app configuration
4. Receive `deploy_request-response` with deployment status
5. Use `list_deployed_apps` to monitor app status

## Container Network Configuration

All runtime-created containers use **host networking**:

```javascript
HostConfig: {
    NetworkMode: 'host',  // ✅ Host network access
    // ... other config
}
```

### Benefits
- 🌐 **Direct Host Access**: `127.0.0.1` and `localhost` work normally
- 🔗 **External Connectivity**: Full internet access
- 🚀 **No Port Conflicts**: Containers use host ports directly
- ⚡ **Better Performance**: No network translation overhead

## Error Handling

### Common Errors

#### Invalid Docker Command
```javascript
{
  "type": "error",
  "error": "Docker app requires dockerCommand in config"
}
```

#### Docker Command Failed
```javascript
{
  "type": "error",
  "error": "Failed to start Docker application: docker: command not found"
}
```

#### Container Exit
```javascript
{
  "type": "deploy_request-response",
  "status": "failed",
  "result": "Container exited with code 1"
}
```

## Implementation Details

### Code Changes Made

1. **Database Schema Update** (`src/database/DatabaseManager.js`)
   ```javascript
   type TEXT CHECK (type IN ('python', 'binary', 'docker')) NOT NULL
   ```

2. **Docker App Runner** (`src/apps/EnhancedApplicationManager.js`)
   ```javascript
   async runDockerApp(options) {
       // Execute Docker commands directly
       const { stdout, stderr } = await execAsync(fullCommand);
       // Update runtime state and return result
   }
   ```

3. **Message Handler Support** (`src/api/MessageHandler.js`)
   ```javascript
   if (prototype?.type === 'docker') {
       appType = 'docker';
       // Handle Docker app deployment
       result = await this.runtime.appManager.runDockerApp({...});
   }
   ```

4. **Host Networking** (`src/apps/EnhancedApplicationManager.js`)
   ```javascript
   NetworkMode: 'host'  // For both Python and Binary containers
   ```

## Examples

### Example 1: Simple Hello World

```javascript
const helloWorldApp = {
  type: 'deploy_request',
  id: 'hello-world-' + Date.now(),
  prototype: {
    id: 'hello-world',
    name: 'Hello World',
    type: 'docker',
    config: {
      dockerCommand: [
        'run', '--rm',
        'alpine',
        'echo', 'Hello from Docker!'
      ]
    }
  },
  vehicleId: 'test-vehicle'
};
```

### Example 2: Web Server with Volume

```javascript
const webServerApp = {
  type: 'deploy_request',
  id: 'web-server-' + Date.now(),
  prototype: {
    id: 'web-server',
    name: 'Nginx Web Server',
    type: 'docker',
    config: {
      dockerCommand: [
        'run', '-d',
        '--name', 'my-web-server',
        '-p', '8080:80',
        '-v', '/host/path:/usr/share/nginx/html',
        'nginx:alpine'
      ]
    }
  },
  vehicleId: 'test-vehicle'
};
```

### Example 3: Background Service

```javascript
const backgroundService = {
  type: 'deploy_request',
  id: 'bg-service-' + Date.now(),
  prototype: {
    id: 'background-worker',
    name: 'Background Worker',
    type: 'docker',
    config: {
      dockerCommand: [
        'run', '-d',
        '--name', 'worker',
        '--restart', 'unless-stopped',
        'my-worker-image:latest',
        '--work-interval', '60'
      ]
    }
  },
  vehicleId: 'test-vehicle'
};
```

## Monitoring and Logs

### Container Status
- Check with `list_deployed_apps` response
- Monitor via `container_id` field
- Status values: `running`, `stopped`, `error`

### Logs Access
- Container logs are captured by the runtime
- Available through WebSocket log streaming
- Error details in response messages

## Security Considerations

- ⚠️ **Host Access**: Containers have access to host filesystem and network
- 🔒 **Resource Limits**: Memory and CPU quotas are enforced
- 🚦 **Command Validation**: Docker commands are executed as-is
- 👤 **Runtime Permissions**: Container runs with runtime Docker socket access

## Troubleshooting

### Common Issues

1. **"Connection refused" on 127.0.0.1**
   - ✅ Ensure host networking is enabled
   - ✅ Check if target service is running on host

2. **"Permission denied"**
   - ✅ Check Docker socket permissions
   - ✅ Ensure runtime has Docker group access

3. **"Port already in use"**
   - ✅ With host networking, ports can't be bound multiple times
   - ✅ Stop conflicting containers first

4. **"Container exits immediately"**
   - ✅ Check Docker command syntax
   - ✅ Verify image exists and is accessible
   - ✅ Review container logs for specific errors