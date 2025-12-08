# 📚 Kit Manager API Specification

## 🌐 Overview

The Kit Manager provides a REST API for basic operations and a real-time WebSocket API for interactive communication with Vehicle Edge Runtime kits. The service runs on **port 3090** by default.

**Base URL:** `http://localhost:3090`
**WebSocket URL:** `http://localhost:3090` (Socket.IO)

---

## 📡 REST API Endpoints

### Authentication
> **Note:** No authentication is currently implemented (CORS is open to all origins)

### Content-Type
```http
Content-Type: application/json
```

---

### 1. List All Kits

Retrieve all registered Vehicle Edge Runtime kits.

```http
GET /listAllKits
```

**Response:**
```json
{
  "status": "OK",
  "message": "List all kits",
  "content": [
    {
      "socket_id": "KLja5vVz-ZfGDzbcAAAB",
      "kit_id": "146986f7-6675-402e-9257-1a4c9080356f",
      "name": "Vehicle Edge Runtime",
      "last_seen": 1765185828124,
      "is_online": true,
      "noRunner": 0,
      "noSubscriber": 0,
      "support_apis": [
        "python_app_execution",
        "binary_app_execution",
        "console_output",
        "app_status_monitoring",
        "vehicle_signals",
        "vss_management",
        "signal_subscription"
      ],
      "desc": "Vehicle Edge Runtime for Eclipse Autowrx - Vehicle application execution with Kuksa integration"
    }
  ]
}
```

**Kit Object Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `socket_id` | string | Internal Socket.IO connection ID |
| `kit_id` | string | Unique kit identifier (UUID) |
| `name` | string | Human-readable kit name |
| `last_seen` | number | Unix timestamp of last heartbeat |
| `is_online` | boolean | Connection status |
| `noRunner` | number | Number of running applications |
| `noSubscriber` | number | Number of active subscriptions |
| `support_apis` | string[] | List of supported capabilities |
| `desc` | string | Kit description |

---

### 2. List All Clients

Retrieve all connected web clients.

```http
GET /listAllClient
```

**Response:**
```json
{
  "status": "OK",
  "message": "List all clients",
  "content": [
    {
      "username": "webuser",
      "user_id": "web_1234567890",
      "domain": "web",
      "last_seen": 1765185828124,
      "is_online": true
    }
  ]
}
```

**Client Object Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `username` | string | Client username |
| `user_id` | string | Unique client identifier |
| `domain` | string | Client domain/type |
| `last_seen` | number | Unix timestamp of last activity |
| `is_online` | boolean | Connection status |

---

### 3. Convert Code

Convert generic Python code to Eclipse SDV Vehicle App format.

```http
POST /convertCode
```

**Request Body:**
```json
{
  "code": "print('hello world')"
}
```

**Response:**
```json
{
  "status": "OK",
  "message": "Successful",
  "content": "# Generated Python Vehicle App code..."
}
```

**Error Response:**
```json
{
  "status": "ERR",
  "message": "Missing code"
}
```

---

## 🔌 WebSocket API (Socket.IO)

The WebSocket API enables real-time bidirectional communication between clients, kits, and the Kit Manager.

### Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3090', {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 5000,
  reconnectionAttempts: Infinity
});
```

---

### 📤 Emitted Events (Client → Server)

#### 1. Register Client

Register your client application with the Kit Manager.

```javascript
socket.emit('register_client', {
  username: string,      // Required: Client username
  user_id: string,       // Required: Unique client identifier
  domain: string         // Required: Client domain/type
});
```

**Example:**
```javascript
socket.emit('register_client', {
  username: "webuser",
  user_id: "web_" + Date.now(),
  domain: "web"
});
```

#### 2. Unregister Client

Unregister your client from the Kit Manager.

```javascript
socket.emit('unregister_client');
```

#### 3. List All Kits

Request the current list of registered kits.

```javascript
socket.emit('list-all-kits');
```

#### 4. List All Hardware Sync Kits

Request the current list of hardware synchronization kits.

```javascript
socket.emit('list-all-syncer_hw');
```

#### 5. Subscribe to Kit Updates

Subscribe to real-time updates from a specific kit.

```javascript
socket.emit('clientSubscribeToKit', {
  kit_id: string     // Required: Target kit ID
});
```

#### 6. Unsubscribe from Kit Updates

Unsubscribe from updates for a specific kit.

```javascript
socket.emit('clientUnsubscribeToKit', {
  kit_id: string     // Required: Target kit ID
});
```

#### 7. Send Message to Kit

Send commands or deployment requests to a specific kit.

```javascript
socket.emit('messageToKit', {
  to_kit_id: string,                    // Required: Target kit ID
  cmd: string,                          // Required: Command type
  code?: string,                        // Optional: Python code to deploy
  prototype?: {                         // Optional: App prototype info
    name: string
  },
  disable_code_convert?: boolean,       // Optional: Skip code conversion (default: false)
  [key: string]: any                    // Optional: Additional metadata
});
```

**Supported Commands:**
- `"deploy_request"` - Deploy application code
- `"deploy_n_run"` - Deploy and immediately run application
- `"custom_command"` - Any custom command supported by the kit

**Example:**
```javascript
// Deploy and run Python app
socket.emit('messageToKit', {
  to_kit_id: "146986f7-6675-402e-9257-1a4c9080356f",
  cmd: "deploy_n_run",
  code: "print('Hello from deployed app!')",
  prototype: {
    name: "HelloWorldApp"
  },
  disable_code_convert: false
});
```

#### 8. Send Message to Hardware Sync Kit

Send configuration commands to hardware synchronization kits.

```javascript
socket.emit('messageToSyncerHw', {
  to_kit_id: string,     // Required: Target hardware kit ID
  cmd: string,           // Required: Command type (e.g., "syncer_set")
  [key: string]: any     // Optional: Configuration data
});
```

---

### 📥 Received Events (Server → Client)

#### 1. Kits List Result

Receive the current list of kits (response to `list-all-kits`).

```javascript
socket.on('list-all-kits-result', (kits) => {
  // kits: Array of kit objects (same format as REST API)
});
```

#### 2. Hardware Kits List Result

Receive the current list of hardware sync kits.

```javascript
socket.on('list-all-hw-result', (hwKits) => {
  // hwKits: Array of hardware kit objects
});
```

#### 3. Kit Message Reply

Receive response from a kit after sending a message.

```javascript
socket.on('messageToKit-kitReply', (reply) => {
  // reply: Object containing kit's response
  /*
  {
    request_from: string,    // Original requester socket ID
    kit_id: string,          // Responding kit ID
    status: string,          // Response status
    message: string,         // Response message
    data?: any,             // Optional response data
    timestamp: number       // Response timestamp
  }
  */
});
```

#### 4. Broadcast from Kit

Receive broadcasted messages from kits.

```javascript
socket.on('broadcastToClient', (message) => {
  // message: Object containing broadcasted data
  /*
  {
    kit_id: string,          // Broadcasting kit ID
    cmd: string,            // Command type
    data: any,              // Broadcast data
    timestamp: number       // Broadcast timestamp
  }
  */
});
```

#### 5. Hardware Kit Reply

Receive response from hardware sync kits.

```javascript
socket.on('messageToSyncerHw-kitReply', (reply) => {
  // reply: Hardware kit response object
});
```

---

## 🔧 Integration Examples

### JavaScript/TypeScript Client

```typescript
import { io } from 'socket.io-client';

class KitManagerClient {
  private socket: any;
  private kits: any[] = [];

  constructor() {
    this.socket = io('http://localhost:3090');
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.socket.on('connect', () => {
      this.registerClient();
      this.requestKits();
    });

    this.socket.on('list-all-kits-result', (kits: any[]) => {
      this.kits = kits;
      console.log('Available kits:', kits);
    });

    this.socket.on('messageToKit-kitReply', (reply: any) => {
      console.log('Kit response:', reply);
    });
  }

  registerClient() {
    this.socket.emit('register_client', {
      username: 'typescript_client',
      user_id: 'ts_' + Date.now(),
      domain: 'web'
    });
  }

  requestKits() {
    this.socket.emit('list-all-kits');
  }

  deployApp(kitId: string, code: string, appName: string) {
    this.socket.emit('messageToKit', {
      to_kit_id: kitId,
      cmd: 'deploy_n_run',
      code: code,
      prototype: { name: appName },
      disable_code_convert: false
    });
  }

  getKits(): any[] {
    return this.kits;
  }
}

// Usage
const client = new KitManagerClient();
client.deployApp('kit-id-here', 'print("Hello!")', 'TestApp');
```

### Python Client

```python
import socketio
import requests
import time

class KitManagerClient:
    def __init__(self, base_url="http://localhost:3090"):
        self.base_url = base_url
        self.sio = socketio.Client()
        self.setup_handlers()

    def setup_handlers(self):
        @self.sio.event
        def connect():
            print("Connected to Kit Manager")
            self.register_client()

        @self.sio.event
        def list_all_kits_result(kits):
            print("Available kits:", kits)

        @self.sio.event
        def messageToKit_kit_reply(reply):
            print("Kit response:", reply)

    def connect(self):
        self.sio.connect(self.base_url)

    def register_client(self, username="python_client", domain="python"):
        user_id = f"python_{int(time.time())}"
        self.sio.emit('register_client', {
            'username': username,
            'user_id': user_id,
            'domain': domain
        })

    def get_kits_rest(self):
        response = requests.get(f"{self.base_url}/listAllKits")
        return response.json()

    def convert_code(self, code):
        response = requests.post(
            f"{self.base_url}/convertCode",
            json={'code': code}
        )
        return response.json()

    def deploy_app(self, kit_id, code, app_name):
        self.sio.emit('messageToKit', {
            'to_kit_id': kit_id,
            'cmd': 'deploy_n_run',
            'code': code,
            'prototype': {'name': app_name},
            'disable_code_convert': False
        })

# Usage
client = KitManagerClient()
client.connect()
```

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

function KitManagerDashboard() {
  const [kits, setKits] = useState([]);
  const [socket, setSocket] = useState(null);
  const [deploymentResult, setDeploymentResult] = useState(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3090');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('register_client', {
        username: 'react_user',
        user_id: 'react_' + Date.now(),
        domain: 'web'
      });
      newSocket.emit('list-all-kits');
    });

    newSocket.on('list-all-kits-result', (kitsList) => {
      setKits(kitsList);
    });

    newSocket.on('messageToKit-kitReply', (reply) => {
      setDeploymentResult(reply);
    });

    return () => newSocket.close();
  }, []);

  const deployApp = (kitId, code) => {
    socket.emit('messageToKit', {
      to_kit_id: kitId,
      cmd: 'deploy_n_run',
      code: code,
      prototype: { name: 'ReactApp' },
      disable_code_convert: false
    });
  };

  return (
    <div>
      <h1>Kit Manager Dashboard</h1>
      <div>
        <h2>Available Kits ({kits.length})</h2>
        {kits.map(kit => (
          <div key={kit.kit_id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
            <h3>{kit.name}</h3>
            <p>Status: {kit.is_online ? '🟢 Online' : '🔴 Offline'}</p>
            <button onClick={() => deployApp(kit.kit_id, 'print("Hello from React!")')}>
              Deploy Test App
            </button>
          </div>
        ))}
      </div>
      {deploymentResult && (
        <div>
          <h3>Deployment Result:</h3>
          <pre>{JSON.stringify(deploymentResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

---

## 🚨 Error Handling

### REST API Errors

All REST API responses follow this format:

```json
{
  "status": "ERR",
  "message": "Error description"
}
```

### WebSocket Error Handling

Socket.IO provides built-in error handling:

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});

socket.on('disconnect', (reason) => {
  console.warn('Disconnected:', reason);
});
```

---

## 📊 Rate Limits & Considerations

- **No rate limiting** is currently implemented
- **Message size limit**: 100MB (`maxHttpBufferSize: 1e8`)
- **Auto-reconnection** is enabled by default
- **Heartbeat**: Kits send periodic status updates
- **Cleanup**: Disconnected kits are marked offline but retained in memory

---

## 🔍 Debugging

Enable debug logging:

```javascript
// In browser
localStorage.debug = '*';

// In Node.js
DEBUG=* node your-app.js
```

Monitor WebSocket traffic:
```javascript
socket.onAny((eventName, ...args) => {
  console.log(`Event: ${eventName}`, args);
});
```

---

## 📝 Future Enhancements

Potential improvements to the API:
- Authentication & authorization
- Rate limiting
- Persistent storage (current implementation is in-memory)
- API versioning
- WebSocket message compression
- Metrics & monitoring endpoints

---

*Generated based on Kit Manager source code analysis*
*Source files: `Kit-Manager/src/index.js`, `src/core/VehicleEdgeRuntime.js`*