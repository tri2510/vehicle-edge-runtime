# Vehicle Edge Runtime - Frontend API Guide

## Overview
This guide provides comprehensive API documentation for frontend developers integrating with the Vehicle Edge Runtime. The runtime manages vehicle application lifecycles with full visibility across all states (running, paused, stopped, error).

## WebSocket Connection
**Endpoint:** `ws://localhost:3002/runtime`

### Connection Example
```javascript
const ws = new WebSocket('ws://localhost:3002/runtime');

ws.onopen = () => {
    console.log('Connected to Vehicle Edge Runtime');
};

ws.onmessage = (event) => {
    const response = JSON.parse(event.data);
    handleResponse(response);
};
```

## Message Format
All messages must include:
- `type`: The operation type
- `id`: Unique message identifier for request/response matching

```javascript
{
    "type": "operation_type",
    "id": "unique-message-id",
    ...other_fields
}
```

## API Operations

### 1. Deploy Application
Deploy a new vehicle application to the runtime.

**Request:**
```javascript
{
    "type": "deploy_request",
    "id": "deploy-123",
    "code": "import time\nprint('Hello Vehicle')\nwhile True:\n    print('Running...')\n    time.sleep(1)",
    "prototype": {
        "id": "my-vehicle-app",
        "name": "My Vehicle App",
        "description": "Application description",
        "version": "1.0.0"
    },
    "vehicleId": "vehicle-001",
    "language": "python"
}
```

**Response:**
```javascript
{
    "type": "deploy_request-response",
    "id": "deploy-123",
    "status": "started",
    "appId": "app-uuid",
    "executionId": "execution-uuid",
    "message": "Application deployed successfully"
}
```

### 2. List All Deployed Applications ⭐ **NEW FULL LIFECYCLE SUPPORT**
Get comprehensive list of all applications regardless of state.

**Request:**
```javascript
{
    "type": "list_deployed_apps",
    "id": "list-123"
}
```

**Response:**
```javascript
{
    "type": "list_deployed_apps-response",
    "id": "list-123",
    "applications": [
        {
            "app_id": "execution-uuid",
            "name": "My Vehicle App",
            "version": "1.0.0",
            "status": "running|paused|stopped|error",
            "deploy_time": "2025-12-17T15:40:00.000Z",
            "auto_start": true,
            "description": "Application description",
            "type": "python|binary",
            "resources": {
                "cpu_limit": "50%",
                "memory_limit": "512MB"
            },
            "container_id": "container-uuid",
            "pid": 12345,
            "last_heartbeat": "2025-12-17T15:40:00.000Z",
            "exit_code": null
        }
    ],
    "stats": {
        "total": 57,
        "running": 5,
        "paused": 3,
        "stopped": 38,
        "error": 10
    },
    "total_count": 57,
    "running_count": 5,
    "paused_count": 3,
    "stopped_count": 38,
    "error_count": 10
}
```

**Status Values:**
- `running`: Application is currently executing
- `paused`: Application is paused (visible in UI) ⭐ **NO LONGER DISAPPEARS**
- `stopped`: Application is stopped (visible in UI)
- `error`: Application encountered an error (visible in UI)

### 3. Start Application
Start a stopped application.

**Request:**
```javascript
{
    "type": "run_app",
    "id": "start-123",
    "appId": "execution-uuid-or-app-id"
}
```

**Response:**
```javascript
{
    "type": "run_app-response",
    "id": "start-123",
    "status": "started|already_running",
    "appId": "app-uuid",
    "executionId": "new-execution-uuid",
    "message": "Application started successfully"
}
```

### 4. Pause Application ⭐ **IMPROVED**
Pause a running application. The app will remain visible in the UI.

**Request:**
```javascript
{
    "type": "pause_app",
    "id": "pause-123",
    "appId": "execution-uuid"
}
```

**Response:**
```javascript
{
    "type": "app_paused",
    "id": "pause-123",
    "appId": "execution-uuid",
    "status": "paused"
}
```

### 5. Resume Application
Resume a paused application.

**Request:**
```javascript
{
    "type": "resume_app",
    "id": "resume-123",
    "appId": "execution-uuid"
}
```

**Response:**
```javascript
{
    "type": "app_resumed",
    "id": "resume-123",
    "appId": "execution-uuid",
    "status": "running"
}
```

### 6. Stop Application ⭐ **IMPROVED**
Stop a running application. The app will remain visible in the UI.

**Request:**
```javascript
{
    "type": "stop_app",
    "id": "stop-123",
    "appId": "execution-uuid-or-app-id"
}
```

**Response:**
```javascript
{
    "type": "stop_app-response",
    "id": "stop-123",
    "result": {
        "status": "stopped|success",
        "appId": "app-uuid",
        "message": "Application stopped successfully"
    }
}
```

### 7. Remove Application ⭐ **IMPROVED**
Completely remove an application from the system.

**Request:**
```javascript
{
    "type": "uninstall_app",
    "id": "remove-123",
    "appId": "execution-uuid-or-app-id"
}
```

**Response:**
```javascript
{
    "type": "app_uninstalled",
    "id": "remove-123",
    "appId": "app-uuid",
    "status": "success"
}
```

## Key Improvements for Frontend

### 🎯 **Full Lifecycle Visibility**
- **Paused apps no longer disappear** from the application list
- **Stopped apps remain visible** for management
- **Error states are tracked** and displayed
- **Comprehensive statistics** for dashboard views

### 📊 **Enhanced Statistics**
```javascript
"stats": {
    "total": 57,        // Total apps
    "running": 5,       // Currently running
    "paused": 3,        // Currently paused
    "stopped": 38,      // Currently stopped
    "error": 10         // Error states
}
```

### 🔄 **ID Resolution**
Both execution IDs and app IDs are supported for management operations:
```javascript
// Either format works for pause/stop/remove
"appId": "execution-uuid"     // What frontend receives from deployment
"appId": "app-uuid"          // Internal app ID
```

### 💾 **Real-time Status Updates**
Applications list provides real-time status from Docker containers with automatic database synchronization.

## Frontend Integration Best Practices

### 1. Application Display
```javascript
function displayApplications(apps) {
    apps.forEach(app => {
        const statusClass = getStatusClass(app.status);
        const statusIcon = getStatusIcon(app.status);

        // All apps are visible regardless of status
        console.log(`${statusIcon} ${app.name} (${app.status})`);
    });
}

function getStatusIcon(status) {
    const icons = {
        'running': '🟢',
        'paused': '⏸️',
        'stopped': '⏹️',
        'error': '❌'
    };
    return icons[status] || '❓';
}
```

### 2. Status-based Actions
```javascript
function getAvailableActions(app) {
    const actions = [];

    switch(app.status) {
        case 'running':
            actions.push('pause', 'stop', 'remove');
            break;
        case 'paused':
            actions.push('resume', 'stop', 'remove');
            break;
        case 'stopped':
            actions.push('start', 'remove');
            break;
        case 'error':
            actions.push('remove');
            break;
    }

    return actions;
}
```

### 3. Dashboard Statistics
```javascript
function updateDashboard(stats) {
    document.getElementById('total-apps').textContent = stats.total;
    document.getElementById('running-apps').textContent = stats.running;
    document.getElementById('paused-apps').textContent = stats.paused;
    document.getElementById('stopped-apps').textContent = stats.stopped;
    document.getElementById('error-apps').textContent = stats.error;
}
```

## Error Handling
All operations include comprehensive error responses:

```javascript
{
    "type": "error",
    "id": "message-id",
    "error": "Error description",
    "timestamp": "2025-12-17T15:40:00.000Z"
}
```

## Response Pattern
All successful responses follow this pattern:
- Include original message `id` for request matching
- Include `timestamp` for timing
- Include relevant data based on operation type

## Testing Your Integration
Use these WebSocket message examples to test your frontend:

```javascript
// Test deployment
ws.send(JSON.stringify({
    "type": "deploy_request",
    "id": "test-" + Date.now(),
    "code": "print('Test app')\nimport time\ntime.sleep(10)",
    "prototype": {
        "id": "test-app-" + Date.now(),
        "name": "Frontend Test App",
        "description": "Test app for frontend integration",
        "version": "1.0.0"
    },
    "vehicleId": "test-vehicle",
    "language": "python"
}));

// Test listing
ws.send(JSON.stringify({
    "type": "list_deployed_apps",
    "id": "list-" + Date.now()
}));
```

## Support
For questions or issues with the API, contact the Vehicle Edge Runtime team.

---

**Note:** This guide reflects the latest improvements including full lifecycle visibility where paused and stopped applications remain visible in the frontend management interface.