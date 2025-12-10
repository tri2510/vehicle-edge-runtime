# 📚 Vehicle Edge Runtime API Specification

## 🌐 Overview

The Vehicle Edge Runtime provides a comprehensive WebSocket API for vehicle application management, real-time monitoring, and vehicle signal access. The runtime features SQLite persistence, enhanced application lifecycle management, Python dependency resolution, and bidirectional console streaming.

**Default WebSocket URL:** `ws://localhost:3002/runtime`
**Health Check URL:** `http://localhost:3003`

---

## 🔌 WebSocket API

The Vehicle Edge Runtime uses native WebSocket (ws://) for bidirectional communication with proper message ID correlation for request/response tracking.

### Connection

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3002/runtime');

ws.on('open', () => {
  console.log('Connected to Vehicle Edge Runtime');
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  console.log('Response:', response);
});
```

### Message Format

All messages use JSON format with optional message ID for request/response correlation:

```json
{
  "id": "uuid-v4-optional-for-tracking",
  "type": "message_type",
  "timestamp": "2025-12-10T04:32:00.000Z",
  // Additional fields specific to message type
}
```

---

## 🚀 Application Lifecycle Management

### 1. Install Application

Install a new application with Python dependency management.

```javascript
const installApp = {
  type: 'install_app',
  appData: {
    id: 'my-app-123',
    name: 'My Vehicle App',
    version: '1.0.0',
    description: 'Sample vehicle application',
    type: 'python',
    code: 'print("Hello from vehicle app!")',
    entryPoint: 'main.py',
    python_deps: ['requests==2.28.0', 'numpy==1.24.0'],
    vehicle_signals: ['Vehicle.Speed', 'Vehicle.Steering.Angle']
  }
};
```

**Response:**
```json
{
  "type": "app_installed",
  "id": "original-request-id",
  "appId": "my-app-123",
  "name": "My Vehicle App",
  "appType": "python",
  "status": "installed",
  "appDir": "/app-data/my-app-123",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 2. List Applications

Retrieve all installed applications with optional filtering.

```javascript
const listApps = {
  type: 'list_apps',
  filters: {
    status: 'installed',
    type: 'python'
  }
};
```

**Response:**
```json
{
  "type": "apps_list",
  "id": "original-request-id",
  "apps": [
    {
      "id": "my-app-123",
      "name": "My Vehicle App",
      "version": "1.0.0",
      "type": "python",
      "status": "installed",
      "created_at": "2025-12-10T04:32:00.000Z",
      "python_deps": ["requests==2.28.0"],
      "vehicle_signals": ["Vehicle.Speed"]
    }
  ],
  "count": 1,
  "filters": {},
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 3. Run Application

Start an installed application.

```javascript
const runApp = {
  type: 'run_python_app',
  appId: 'my-app-123',
  env: {
    VEHICLE_ID: 'test-vehicle-001'
  },
  workingDir: '/app'
};
```

**Response:**
```json
{
  "type": "python_app_started",
  "id": "original-request-id",
  "executionId": "exec-456",
  "appId": "my-app-123",
  "status": "running",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 4. Pause Application

Pause a running application without stopping it completely.

```javascript
const pauseApp = {
  type: 'pause_app',
  appId: 'my-app-123'
};
```

**Response:**
```json
{
  "type": "app_paused",
  "id": "original-request-id",
  "appId": "my-app-123",
  "status": "paused",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 5. Resume Application

Resume a paused application.

```javascript
const resumeApp = {
  type: 'resume_app',
  appId: 'my-app-123'
};
```

**Response:**
```json
{
  "type": "app_resumed",
  "id": "original-request-id",
  "appId": "my-app-123",
  "status": "running",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 6. Stop Application

Stop a running application.

```javascript
const stopApp = {
  type: 'stop_app',
  appId: 'my-app-123'
};
```

**Response:**
```json
{
  "type": "app_stopped",
  "id": "original-request-id",
  "appId": "my-app-123",
  "executionId": "exec-456",
  "status": "stopped",
  "exitCode": 0,
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 7. Uninstall Application

Remove an application from the system.

```javascript
const uninstallApp = {
  type: 'uninstall_app',
  appId: 'my-app-123'
};
```

**Response:**
```json
{
  "type": "app_uninstalled",
  "id": "original-request-id",
  "appId": "my-app-123",
  "status": "uninstalled",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 8. Get Application Status

Get detailed status information for an application.

```javascript
const getAppStatus = {
  type: 'get_app_status',
  appId: 'my-app-123'
};
```

**Response:**
```json
{
  "type": "app_status",
  "id": "original-request-id",
  "status": {
    "appId": "my-app-123",
    "state": "running",
    "uptime": 3600,
    "cpu": "15.2%",
    "memory": "128MB",
    "startTime": "2025-12-10T03:32:00.000Z"
  },
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

---

## 📊 Application Logs & Console

### 1. Get Application Logs

Retrieve structured logs for an application with filtering options.

```javascript
const getLogs = {
  type: 'get_app_logs',
  appId: 'my-app-123',
  options: {
    limit: 100,
    level: 'info',
    since: '2025-12-10T04:00:00.000Z'
  }
};
```

**Response:**
```json
{
  "type": "app_logs",
  "id": "original-request-id",
  "appId": "my-app-123",
  "logs": [
    {
      "id": 1,
      "timestamp": "2025-12-10T04:32:00.000Z",
      "level": "info",
      "message": "Application started successfully",
      "source": "runtime"
    }
  ],
  "options": {
    "limit": 100,
    "level": "info"
  },
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 2. Subscribe to Console Output

Real-time console streaming from running applications.

```javascript
const subscribeConsole = {
  type: 'console_subscribe',
  executionId: 'exec-456'
};
```

**Response:**
```json
{
  "type": "console_subscribed",
  "id": "original-request-id",
  "clientId": "client-789",
  "executionId": "exec-456",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

**Console Output Messages:**
```json
{
  "type": "console_output",
  "executionId": "exec-456",
  "stream": "stdout",
  "data": "Hello from vehicle app!",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 3. Send Input to Application

Send stdin input to a running application.

```javascript
const sendInput = {
  type: 'console_stdin',
  executionId: 'exec-456',
  input: "user input here\n"
};
```

### 4. Unsubscribe from Console

Stop receiving console output for an application.

```javascript
const unsubscribeConsole = {
  type: 'console_unsubscribe',
  executionId: 'exec-456'
};
```

---

## 🚗 Vehicle Signal Management

### 1. Subscribe to Vehicle Signals

Subscribe to real-time vehicle signal updates.

```javascript
const subscribeSignals = {
  type: 'subscribe_apis',
  apis: [
    {
      path: 'Vehicle.Speed',
      access: 'read'
    },
    {
      path: 'Vehicle.Steering.Angle',
      access: 'read'
    }
  ]
};
```

**Response:**
```json
{
  "type": "apis_subscribed",
  "id": "original-request-id",
  "subscriptionId": "sub-123",
  "apis": ["Vehicle.Speed", "Vehicle.Steering.Angle"],
  "kit_id": "runtime-456",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

**Signal Update Messages:**
```json
{
  "type": "signal_update",
  "subscriptionId": "sub-123",
  "path": "Vehicle.Speed",
  "value": 55.2,
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 2. Get Signal Values

Read current values of vehicle signals.

```javascript
const getSignals = {
  type: 'get_signals_value',
  apis: ['Vehicle.Speed', 'Vehicle.Steering.Angle']
};
```

**Response:**
```json
{
  "type": "signals_value_response",
  "id": "original-request-id",
  "result": {
    "Vehicle.Speed": 55.2,
    "Vehicle.Steering.Angle": 12.5
  },
  "kit_id": "runtime-456",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 3. Write Signal Values

Set values for writable vehicle signals.

```javascript
const writeSignals = {
  type: 'write_signals_value',
  data: {
    "Vehicle.Cabin.Lights.IsOn": true,
    "Vehicle.Cabin.HVAC.Temperature": 22.5
  }
};
```

**Response:**
```json
{
  "type": "signals_written",
  "id": "original-request-id",
  "response": {
    "Vehicle.Cabin.Lights.IsOn": true,
    "Vehicle.Cabin.HVAC.Temperature": 22.5
  },
  "kit_id": "runtime-456",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 4. Generate Vehicle Signal Library

Generate Python SDK for vehicle signals.

```javascript
const generateLibrary = {
  type: 'generate_vehicle_model',
  data: {
    signals: ['Vehicle.Speed', 'Vehicle.Steering.Angle'],
    outputFormat: 'python'
  }
};
```

**Response:**
```json
{
  "type": "vehicle_model_generated",
  "id": "original-request-id",
  "success": true,
  "vssPath": "/data/vehicle-signals.py",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

---

## 📈 Resource Monitoring

### 1. Get Runtime Status

Get comprehensive runtime status and resource metrics.

```javascript
const getRuntimeState = {
  type: 'report_runtime_state'
};
```

**Response:**
```json
{
  "type": "runtime_state_response",
  "id": "original-request-id",
  "runtimeState": {
    "runtimeId": "runtime-456",
    "status": "running",
    "uptime": 86400,
    "version": "2.0.0",
    "runningApplications": [
      {
        "executionId": "exec-456",
        "appId": "my-app-123",
        "status": "running",
        "uptime": 3600
      }
    ],
    "resources": {
      "cpu": "25.5%",
      "memory": "512MB",
      "disk": "2.1GB"
    }
  },
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 2. Get Runtime Information

Get detailed runtime configuration and capabilities.

```javascript
const getRuntimeInfo = {
  type: 'get_runtime_info'
};
```

**Response:**
```json
{
  "type": "get-runtime-info-response",
  "id": "original-request-id",
  "kit_id": "runtime-456",
  "data": {
    "lsOfRunner": [
      {
        "executionId": "exec-456",
        "appId": "my-app-123",
        "status": "running"
      }
    ],
    "lsOfApiSubscriber": [
      {
        "subscriptionId": "sub-123",
        "apis": ["Vehicle.Speed"],
        "from": 1704831120000
      }
    ]
  },
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

---

## ⚙️ Configuration Management

### 1. Get VSS Configuration

Get Vehicle Signal Specification configuration.

```javascript
const getVssConfig = {
  type: 'get_vss_config'
};
```

**Response:**
```json
{
  "type": "get_vss_config-response",
  "id": "original-request-id",
  "vss_config": {
    "version": "3.0",
    "url": "http://localhost:55555",
    "local_cache": "/data/configs/vss.json",
    "refresh_interval": 3600
  },
  "last_updated": "2025-12-10T04:32:00.000Z",
  "signal_count": 150,
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 2. Check Signal Conflicts

Validate vehicle signal requirements for deployment.

```javascript
const checkConflicts = {
  type: 'check_signal_conflicts',
  app_id: 'my-app-123',
  signals: [
    {
      signal: 'Vehicle.Speed',
      access: 'read'
    }
  ]
};
```

**Response:**
```json
{
  "type": "check_signal_conflicts-response",
  "id": "original-request-id",
  "deployment_precheck": {
    "app_id": "my-app-123",
    "signals_required": [
      {
        "signal": "Vehicle.Speed",
        "access": "read",
        "conflict": false
      }
    ],
    "deployment_approved": true,
    "conflicts_found": 0,
    "recommended_actions": []
  },
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

---

## 🔧 Utility Operations

### 1. Ping/Pong

Health check and connection validation.

```javascript
const ping = {
  type: 'ping'
};
```

**Response:**
```json
{
  "type": "pong",
  "id": "original-request-id",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### 2. Mock Signal Management

Development support for vehicle signal simulation.

```javascript
// List mock signals
const listMockSignals = {
  type: 'list_mock_signal'
};

// Set mock signal values
const setMockSignals = {
  type: 'set_mock_signals',
  data: [
    {
      name: 'Vehicle.Speed',
      value: 60.0
    }
  ]
};
```

---

## 🔄 Bidirectional Streaming Examples

### JavaScript Client with Full Lifecycle

```javascript
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

class VehicleEdgeRuntimeClient {
  constructor(url = 'ws://localhost:3002/runtime') {
    this.ws = new WebSocket(url);
    this.pendingRequests = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.ws.on('open', () => {
      console.log('Connected to Vehicle Edge Runtime');
    });

    this.ws.on('message', (data) => {
      const response = JSON.parse(data.toString());
      this.handleResponse(response);
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  async sendMessage(message) {
    const messageId = uuidv4();
    const messageWithId = { ...message, id: messageId, timestamp: new Date().toISOString() };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(messageId, { resolve, reject });
      this.ws.send(JSON.stringify(messageWithId));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(messageId)) {
          this.pendingRequests.delete(messageId);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  handleResponse(response) {
    if (response.id && this.pendingRequests.has(response.id)) {
      const { resolve } = this.pendingRequests.get(response.id);
      this.pendingRequests.delete(response.id);
      resolve(response);
    } else {
      // Handle unsolicited messages (console output, signal updates)
      this.handleUnsolicitedMessage(response);
    }
  }

  handleUnsolicitedMessage(message) {
    switch (message.type) {
      case 'console_output':
        console.log(`[${message.executionId}] ${message.stream}: ${message.data}`);
        break;
      case 'signal_update':
        console.log(`Signal ${message.path}: ${message.value}`);
        break;
      default:
        console.log('Received message:', message);
    }
  }

  async installApp(appData) {
    return await this.sendMessage({
      type: 'install_app',
      appData
    });
  }

  async runApp(appId, options = {}) {
    return await this.sendMessage({
      type: 'run_python_app',
      appId,
      ...options
    });
  }

  async subscribeConsole(executionId) {
    const response = await this.sendMessage({
      type: 'console_subscribe',
      executionId
    });
    return response;
  }

  async getLogs(appId, options = {}) {
    return await this.sendMessage({
      type: 'get_app_logs',
      appId,
      options
    });
  }

  async subscribeSignals(apis) {
    return await this.sendMessage({
      type: 'subscribe_apis',
      apis
    });
  }

  close() {
    this.ws.close();
  }
}

// Usage example
const client = new VehicleEdgeRuntimeClient();

// Install and run an app
client.installApp({
  id: 'test-app',
  name: 'Test Vehicle App',
  type: 'python',
  code: `
import time
print("Vehicle app started")
for i in range(5):
    print(f"Running... {i+1}/5")
    time.sleep(1)
print("Vehicle app completed")
`,
  python_deps: ['requests==2.28.0']
}).then(async (installResponse) => {
  console.log('App installed:', installResponse);

  const runResponse = await client runApp('test-app');
  console.log('App started:', runResponse);

  // Subscribe to console output
  await client.subscribeConsole(runResponse.executionId);

  // Get logs after some time
  setTimeout(async () => {
    const logs = await client.getLogs('test-app');
    console.log('App logs:', logs);
  }, 3000);
});
```

### Python Client with Async Support

```python
import asyncio
import websockets
import json
import uuid
from typing import Dict, Any, Optional

class VehicleEdgeRuntimeClient:
    def __init__(self, url: str = "ws://localhost:3002/runtime"):
        self.url = url
        self.websocket = None
        self.pending_requests = {}
        self.message_handlers = {}

    async def connect(self):
        """Connect to the Vehicle Edge Runtime"""
        self.websocket = await websockets.connect(self.url)
        asyncio.create_task(self._message_loop())

    async def _message_loop(self):
        """Handle incoming messages"""
        async for message in self.websocket:
            data = json.loads(message)
            await self._handle_message(data)

    async def _handle_message(self, message: Dict[str, Any]):
        """Process incoming message"""
        message_id = message.get('id')

        if message_id and message_id in self.pending_requests:
            # Response to a request
            future = self.pending_requests.pop(message_id)
            future.set_result(message)
        else:
            # Unsolicited message (console output, signal updates, etc.)
            message_type = message.get('type')
            if message_type in self.message_handlers:
                await self.message_handlers[message_type](message)
            else:
                print(f"Received unsolicited message: {message}")

    async def send_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Send a message and wait for response"""
        message_id = str(uuid.uuid4())
        message_with_id = {
            **message,
            "id": message_id,
            "timestamp": asyncio.get_event_loop().time()
        }

        # Create future for response
        future = asyncio.get_event_loop().create_future()
        self.pending_requests[message_id] = future

        # Send message
        await self.websocket.send(json.dumps(message_with_id))

        # Wait for response
        try:
            return await asyncio.wait_for(future, timeout=10.0)
        except asyncio.TimeoutError:
            self.pending_requests.pop(message_id, None)
            raise TimeoutError(f"Request timeout for {message.get('type')}")

    def register_handler(self, message_type: str, handler):
        """Register a handler for unsolicited messages"""
        self.message_handlers[message_type] = handler

    async def install_app(self, app_data: Dict[str, Any]) -> Dict[str, Any]:
        """Install an application"""
        return await self.send_message({
            "type": "install_app",
            "appData": app_data
        })

    async def run_app(self, app_id: str, **options) -> Dict[str, Any]:
        """Run an application"""
        return await self.send_message({
            "type": "run_python_app",
            "appId": app_id,
            **options
        })

    async def subscribe_console(self, execution_id: str) -> Dict[str, Any]:
        """Subscribe to console output"""
        return await self.send_message({
            "type": "console_subscribe",
            "executionId": execution_id
        })

    async def get_logs(self, app_id: str, **options) -> Dict[str, Any]:
        """Get application logs"""
        return await self.send_message({
            "type": "get_app_logs",
            "appId": app_id,
            "options": options
        })

    async def ping(self) -> Dict[str, Any]:
        """Ping the runtime"""
        return await self.send_message({"type": "ping"})

    async def close(self):
        """Close the connection"""
        if self.websocket:
            await self.websocket.close()

# Usage example
async def main():
    client = VehicleEdgeRuntimeClient()
    await client.connect()

    # Register console output handler
    async def handle_console_output(message):
        print(f"[{message['executionId']}] {message['stream']}: {message['data']}")

    client.register_handler("console_output", handle_console_output)

    # Install and run app
    app_data = {
        "id": "python-test-app",
        "name": "Python Test App",
        "type": "python",
        "code": """
import time
print("Starting vehicle app...")
for i in range(3):
    print(f"Processing step {i+1}")
    time.sleep(1)
print("Vehicle app completed!")
""",
        "python_deps": ["requests==2.28.0"]
    }

    install_response = await client.install_app(app_data)
    print("Install response:", install_response)

    run_response = await client.run_app("python-test-app")
    print("Run response:", run_response)

    # Subscribe to console
    await client.subscribe_console(run_response["executionId"])

    # Wait for app to complete
    await asyncio.sleep(5)

    # Get logs
    logs = await client.get_logs("python-test-app")
    print("Logs:", logs)

    await client.close()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 🛡️ Error Handling

### Standard Error Response Format

All error responses follow this format:

```json
{
  "type": "error",
  "id": "original-request-id",
  "error": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2025-12-10T04:32:00.000Z"
}
```

### Common Error Codes

| Code | Description | Example |
|------|-------------|---------|
| `APP_NOT_FOUND` | Application does not exist | `App with ID 'invalid-app' not found` |
| `APP_ALREADY_RUNNING` | Application is already running | `App 'my-app' is already running` |
| `DEPENDENCY_ERROR` | Python dependency installation failed | `Failed to install requests==2.28.0` |
| `CONTAINER_ERROR` | Docker container operation failed | `Container failed to start` |
| `DATABASE_ERROR` | Database operation failed | `Failed to save application data` |
| `SIGNAL_ERROR` | Vehicle signal operation failed | `Signal 'Invalid.Path' not found` |
| `VALIDATION_ERROR` | Request validation failed | `Missing required field: appId` |

### Error Handling Best Practices

```javascript
try {
  const response = await client.sendMessage(request);

  if (response.type === 'error') {
    console.error('API Error:', response.error);
    return;
  }

  // Handle successful response
  console.log('Success:', response);
} catch (error) {
  if (error.message === 'Request timeout') {
    console.error('Request timed out');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## 📊 Performance Considerations

### Message Throughput
- **Maximum message size**: 1MB
- **Recommended message rate**: 100 messages/second per client
- **Concurrent clients**: 100+ supported

### Resource Limits
- **Maximum concurrent applications**: 50
- **Per-application memory limit**: 512MB (configurable)
- **Database connections**: 1 shared connection pool
- **Console buffer size**: 10MB per application

### Optimization Tips
1. **Batch Operations**: Group multiple signal reads/writes
2. **Message Filtering**: Use specific filters in log requests
3. **Connection Reuse**: Maintain persistent WebSocket connections
4. **Subscription Management**: Unsubscribe from unused signal streams

---

## 🔍 Monitoring & Debugging

### Health Check

```bash
curl http://localhost:3003
```

**Response:**
```json
{
  "status": "healthy",
  "runtime": "Vehicle Edge Runtime",
  "version": "2.0.0",
  "uptime": 86400,
  "applications": {
    "total": 5,
    "running": 2,
    "stopped": 3
  },
  "resources": {
    "cpu_usage": "25.5%",
    "memory_usage": "512MB",
    "disk_usage": "2.1GB"
  }
}
```

### Debug Logging

Enable debug mode by setting log level:

```javascript
// Connect with debug logging
const ws = new WebSocket('ws://localhost:3002/runtime?debug=true');
```

### Message Tracing

Enable message ID correlation for debugging:

```javascript
const messageId = uuidv4();
const message = { type: 'install_app', id: messageId, ... };
console.log('Sending message:', messageId);
```

---

## 🚀 Integration Examples

### React Component Integration

```jsx
import React, { useState, useEffect } from 'react';

function VehicleRuntimeDashboard() {
  const [apps, setApps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [ws, setWs] = useState(null);
  const [runtimeStatus, setRuntimeStatus] = useState({});

  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:3002/runtime');
    setWs(websocket);

    websocket.onopen = () => {
      console.log('Connected to Vehicle Edge Runtime');
      loadApps();
      pingRuntime();
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    return () => websocket.close();
  }, []);

  const handleMessage = (message) => {
    switch (message.type) {
      case 'apps_list':
        setApps(message.apps);
        break;
      case 'app_logs':
        setLogs(message.logs);
        break;
      case 'console_output':
        setLogs(prev => [...prev, {
          timestamp: message.timestamp,
          stream: message.stream,
          data: message.data
        }]);
        break;
      case 'runtime_state_response':
        setRuntimeStatus(message.runtimeState);
        break;
    }
  };

  const sendMessage = (message) => {
    const messageId = uuidv4();
    const messageWithId = { ...message, id: messageId, timestamp: new Date().toISOString() };
    ws.send(JSON.stringify(messageWithId));
  };

  const loadApps = () => {
    sendMessage({ type: 'list_apps' });
  };

  const installApp = async (appData) => {
    sendMessage({ type: 'install_app', appData });
  };

  const runApp = (appId) => {
    sendMessage({ type: 'run_python_app', appId });
  };

  const pingRuntime = () => {
    sendMessage({ type: 'ping' });
  };

  return (
    <div className="dashboard">
      <h1>Vehicle Edge Runtime Dashboard</h1>

      <div className="status-section">
        <h2>Runtime Status</h2>
        <div>CPU: {runtimeStatus.resources?.cpu || 'N/A'}</div>
        <div>Memory: {runtimeStatus.resources?.memory || 'N/A'}</div>
        <div>Uptime: {runtimeStatus.uptime || 'N/A'}</div>
      </div>

      <div className="apps-section">
        <h2>Applications ({apps.length})</h2>
        {apps.map(app => (
          <div key={app.id} className="app-card">
            <h3>{app.name}</h3>
            <p>Status: {app.status}</p>
            <p>Type: {app.type}</p>
            <button onClick={() => runApp(app.id)}>Run</button>
          </div>
        ))}
      </div>

      <div className="logs-section">
        <h2>Console Output</h2>
        <div className="logs-container">
          {logs.map((log, index) => (
            <div key={index} className={`log-entry log-${log.stream}`}>
              <span className="timestamp">{log.timestamp}</span>
              <span className="data">{log.data}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Command Line Interface

```bash
#!/bin/bash
# Install an application
curl -X POST ws://localhost:3002/runtime \
  -H "Content-Type: application/json" \
  -d '{
    "type": "install_app",
    "appData": {
      "id": "cli-test-app",
      "name": "CLI Test App",
      "type": "python",
      "code": "print(\"Hello from CLI!\")",
      "python_deps": ["requests==2.28.0"]
    }
  }'

# List applications
curl -X POST ws://localhost:3002/runtime \
  -H "Content-Type: application/json" \
  -d '{"type": "list_apps"}'

# Get health status
curl http://localhost:3003
```

---

## 🔒 Security Considerations

### Current State
- **No Authentication**: All endpoints are publicly accessible
- **No Rate Limiting**: Unlimited requests per client
- **No Input Validation**: Basic validation implemented

### Recommended Security Enhancements
1. **Authentication**: Implement JWT or API key authentication
2. **Rate Limiting**: Add request rate limits per client
3. **Input Validation**: Comprehensive request validation and sanitization
4. **HTTPS**: Use TLS for WebSocket connections
5. **CORS**: Configure appropriate CORS policies
6. **Audit Logging**: Log all API calls for security monitoring

---

## 📝 API Versioning

### Current Version: v2.0

The Vehicle Edge Runtime API follows semantic versioning:

- **Major (X.0.0)**: Breaking changes to existing APIs
- **Minor (0.Y.0)**: New features without breaking changes
- **Patch (0.0.Z)**: Bug fixes and minor improvements

### Version Negotiation

```javascript
const ws = new WebSocket('ws://localhost:3002/runtime?version=2.0');
```

### Backward Compatibility

The runtime maintains backward compatibility with v1.0 clients where possible. Deprecated APIs will be marked with warnings in responses.

---

*Generated based on Vehicle Edge Runtime v2.0 implementation*
*Last updated: 2025-12-10*