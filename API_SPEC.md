# Vehicle Edge Runtime - WebSocket API Specification

## Connection

**WebSocket URL:** `ws://localhost:3002/runtime` (or configured Kit-Manager)

---

## Console Output

### Subscribe to Console
```json
{
  "type": "console_subscribe",
  "id": "msg-123",
  "appId": "VEA-my-app"
}
```

**Response:**
```json
{
  "type": "console_subscribed",
  "id": "msg-123",
  "clientId": "client-uuid",
  "appId": "VEA-my-app"
}
```

### Console Output (Streaming)
```json
{
  "type": "console_output",
  "executionId": "VEA-my-app",
  "stream": "stdout",
  "output": "line content",
  "timestamp": "2026-01-08T10:00:00.000Z"
}
```

**Streams:** `stdout`, `stderr`

### Unsubscribe
```json
{
  "type": "console_unsubscribe",
  "id": "msg-123",
  "appId": "VEA-my-app"
}
```

### Get App Output (Historical)
```json
{
  "type": "app_output",
  "id": "msg-123",
  "appId": "VEA-my-app",
  "lines": 100
}
```

---

## Application Lifecycle

### List Deployed Apps
```json
{
  "type": "list_deployed_apps",
  "id": "msg-123"
}
```

**Response:**
```json
{
  "type": "list_deployed_apps-response",
  "id": "msg-123",
  "apps": [
    {
      "id": "VEA-my-app",
      "name": "My App",
      "type": "python",
      "status": "running",
      "createdAt": "2026-01-08T10:00:00.000Z"
    }
  ],
  "total": 1,
  "running": 1,
  "paused": 0,
  "stopped": 0,
  "error": 0
}
```

**Statuses:** `installing`, `installed`, `starting`, `running`, `paused`, `stopped`, `uninstalling`, `error`

**App Types:** `python`, `binary`, `docker`, `mock-service`, `kuksa-server`

### Deploy App (Python Code)
```json
{
  "type": "deploy_request",
  "id": "deploy-123",
  "prototype": {
    "id": "my-app",
    "name": "My App",
    "type": "python",
    "code": "import asyncio\nfrom sdv import VehicleApp\n...",
    "config": {}
  },
  "vehicle_id": "default-vehicle"
}
```

### Start App
```json
{
  "type": "run_app",
  "id": "msg-123",
  "appId": "VEA-my-app"
}
```

### Stop App
```json
{
  "type": "stop_app",
  "id": "msg-123",
  "appId": "VEA-my-app"
}
```

### Pause App
```json
{
  "type": "pause_app",
  "id": "msg-123",
  "appId": "VEA-my-app"
}
```

### Resume App
```json
{
  "type": "resume_app",
  "id": "msg-123",
  "appId": "VEA-my-app"
}
```

### Uninstall App
```json
{
  "type": "uninstall_app",
  "id": "msg-123",
  "appId": "VEA-my-app"
}
```

---

## Mock Service (Special)

### Start Mock Service
```json
{
  "type": "mock_service_start",
  "id": "mock-start-123",
  "mode": "echo-all"
}
```

**Modes:** `echo-all`, `echo-specific`, `random`, `static`, `off`

### Stop Mock Service
```json
{
  "type": "mock_service_stop",
  "id": "mock-stop-123"
}
```

### Configure Mock Service
```json
{
  "type": "mock_service_configure",
  "id": "mock-config-123",
  "mode": "echo-specific",
  "signals": ["Vehicle.Body.Lights.Beam.High.IsOn"]
}
```

### Mock Service Status
```json
{
  "type": "mock_service_status",
  "id": "mock-status-123"
}
```

---

## Vehicle Signals

### Subscribe to Signals
```json
{
  "type": "subscribe_apis",
  "id": "msg-123",
  "apis": ["Vehicle.Speed", "Vehicle.Body.Lights.*"]
}
```

### Write Signal Values
```json
{
  "type": "write_signals_value",
  "id": "msg-123",
  "data": {
    "Vehicle.Speed": 100
  }
}
```

### Get Signal Values
```json
{
  "type": "get_signals_value",
  "id": "msg-123",
  "apis": ["Vehicle.Speed"]
}
```

---

## Runtime Info

### Health Check
**HTTP:** `GET http://localhost:3003/health`

**Response:**
```json
{
  "status": "healthy",
  "runtimeId": "uuid",
  "kitManagerConnected": true,
  "timestamp": "2026-01-08T10:00:00.000Z"
}
```

---

## Error Responses

All error responses follow this format:
```json
{
  "type": "error",
  "id": "msg-123",
  "error": "Error message description",
  "timestamp": "2026-01-08T10:00:00.000Z"
}
```

---

## Supported Capabilities

The runtime advertises these capabilities via Kit-Manager:
- `python_app_execution`
- `binary_app_execution`
- `console_output`
- `app_status_monitoring`
- `vehicle_signals`
- `vss_management`
- `signal_subscription`
