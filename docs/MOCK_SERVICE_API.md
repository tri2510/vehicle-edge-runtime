# Mock Service Control API

## Overview

The mock service provides configurable vehicle signal mocking for testing without real hardware. It supports multiple modes and can be controlled via WebSocket API from the frontend.

## Mock Modes

### 1. **echo-all** (Default)
Echoes all actuator target values to current values.
- **Use case**: Standard testing without vehicle hardware
- **Behavior**: Subscribes to all target value changes and echoes them to current values
- **Example**: App sets `Vehicle.Body.Lights.Beam.Low.IsOn` target → Mock service sets current value

### 2. **echo-specific**
Echoes only specific signals.
- **Use case**: Test specific vehicle signals in isolation
- **Behavior**: Only echoes signals listed in `MOCK_SPECIFIC_SIGNALS`
- **Example**: Only echo lights, ignore other actuators
- **Config**: Set `MOCK_SPECIFIC_SIGNALS` environment variable

### 3. **random**
Generates random values for all signals.
- **Use case**: Simulate varying sensor data
- **Behavior**: Generates random values within predefined ranges every N seconds
- **Example**: Random speed values between 0-200 km/h
- **Config**: Set `MOCK_RANDOM_INTERVAL` (default: 2.0 seconds)

### 4. **static**
Sets static default values (no updates).
- **Use case**: Initialize signals to known states
- **Behavior**: Sets all signals to default values once, then idles
- **Example**: All lights off, speed 0, hood closed

### 5. **off**
Service runs but doesn't update any signals.
- **Use case**: Test with real hardware (mock disabled but service available)
- **Behavior**: Container running but no signal updates

## WebSocket API

All mock service control messages use the WebSocket connection to the vehicle-edge-runtime.

### Get Mock Service Status

Get current status of the mock service.

```javascript
const message = {
  type: 'mock_service_status',
  id: 'unique-request-id'
};

websocket.send(JSON.stringify(message));
```

**Response:**
```javascript
{
  type: 'mock_service_status',
  id: 'unique-request-id',
  running: true,           // Whether container is running
  status: 'running',       // Container status
  mode: 'echo-all',        // Current mode
  image: 'vehicle-simple-mock-service:latest',
  timestamp: '2025-12-24T12:00:00.000Z'
}
```

### Start Mock Service

Start the mock service with specified configuration.

```javascript
const message = {
  type: 'mock_service_start',
  id: 'unique-request-id',
  mode: 'echo-all',        // Optional: default is 'echo-all'
  signals: [               // Optional: only for echo-specific mode
    'Vehicle.Body.Lights.Beam.Low.IsOn',
    'Vehicle.ADAS.CruiseControl.SpeedSet'
  ],
  kuksaHost: '127.0.0.1',  // Optional: default is 127.0.0.1
  kuksaPort: '55555'       // Optional: default is 55555
};

websocket.send(JSON.stringify(message));
```

**Response:**
```javascript
{
  type: 'mock_service_status',
  id: 'unique-request-id',
  success: true,
  message: 'Mock service started in echo-all mode',
  status: {
    running: true,
    status: 'running',
    mode: 'echo-all',
    image: 'vehicle-simple-mock-service:latest'
  },
  timestamp: '2025-12-24T12:00:00.000Z'
}
```

### Stop Mock Service

Stop the mock service container.

```javascript
const message = {
  type: 'mock_service_stop',
  id: 'unique-request-id'
};

websocket.send(JSON.stringify(message));
```

**Response:**
```javascript
{
  type: 'mock_service_status',
  id: 'unique-request-id',
  success: true,
  message: 'Mock service stopped successfully',
  timestamp: '2025-12-24T12:00:00.000Z'
}
```

### Configure Mock Service

Change mock service configuration (restarts with new settings).

```javascript
const message = {
  type: 'mock_service_configure',
  id: 'unique-request-id',
  mode: 'random',
  kuksaHost: '127.0.0.1',
  kuksaPort: '55555'
};

websocket.send(JSON.stringify(message));
```

**Response:**
```javascript
{
  type: 'mock_service_configured',
  id: 'unique-request-id',
  success: true,
  message: 'Mock service configured and restarted',
  configured: true,
  status: {
    running: true,
    status: 'running',
    mode: 'random',
    image: 'vehicle-simple-mock-service:latest'
  },
  timestamp: '2025-12-24T12:00:00.000Z'
}
```

## Frontend Integration Example

### React Component

```jsx
import React, { useState, useEffect } from 'react';

const MockServiceControl = ({ websocket }) => {
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState('echo-all');
  const [loading, setLoading] = useState(false);

  // Get initial status
  useEffect(() => {
    if (websocket) {
      getStatus();

      // Listen for status updates
      websocket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'mock_service_status' || data.type === 'mock_service_configured') {
          setStatus(data.status || data);
          setLoading(false);
        }
      });
    }
  }, [websocket]);

  const getStatus = () => {
    websocket.send(JSON.stringify({
      type: 'mock_service_status',
      id: Date.now().toString()
    }));
  };

  const startService = () => {
    setLoading(true);
    websocket.send(JSON.stringify({
      type: 'mock_service_start',
      id: Date.now().toString(),
      mode: mode
    }));
  };

  const stopService = () => {
    setLoading(true);
    websocket.send(JSON.stringify({
      type: 'mock_service_stop',
      id: Date.now().toString()
    }));
  };

  const configureService = () => {
    setLoading(true);
    websocket.send(JSON.stringify({
      type: 'mock_service_configure',
      id: Date.now().toString(),
      mode: mode
    }));
  };

  return (
    <div className="mock-service-control">
      <h3>Mock Service Control</h3>

      {status && (
        <div className="status">
          <p><strong>Status:</strong> {status.running ? 'Running' : 'Stopped'}</p>
          <p><strong>Mode:</strong> {status.mode || 'N/A'}</p>
        </div>
      )}

      <div className="controls">
        <label>
          Mode:
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="echo-all">Echo All (Default)</option>
            <option value="echo-specific">Echo Specific</option>
            <option value="random">Random</option>
            <option value="static">Static</option>
            <option value="off">Off</option>
          </select>
        </label>

        <button onClick={startService} disabled={loading}>
          Start Mock Service
        </button>

        <button onClick={configureService} disabled={loading || !status?.running}>
          Apply Configuration
        </button>

        <button onClick={stopService} disabled={loading || !status?.running}>
          Stop Mock Service
        </button>
      </div>
    </div>
  );
};

export default MockServiceControl;
```

## Environment Variables

When using Docker Compose or manual Docker run, configure the mock service with environment variables:

```yaml
environment:
  - KUKSA_HOST=127.0.0.1          # Kuksa databroker host
  - KUKSA_PORT=55555               # Kuksa databroker port
  - MOCK_MODE=echo-all             # Mock mode (echo-all, echo-specific, random, static, off)
  - MOCK_SPECIFIC_SIGNALS=Vehicle.Body.Lights.Beam.Low.IsOn,Vehicle.ADAS.CruiseControl.SpeedSet  # For echo-specific
  - MOCK_RANDOM_INTERVAL=2.0       # For random mode (seconds)
```

## Docker Commands

### Start with Docker Compose (echo-all mode)
```bash
docker compose --profile simple-mock up -d simple-mock-service
```

### Start with specific mode
```bash
docker run -d --name vehicle-simple-mock-service \
  --network host \
  -e MOCK_MODE=random \
  -e MOCK_RANDOM_INTERVAL=5.0 \
  -e KUKSA_HOST=127.0.0.1 \
  -e KUKSA_PORT=55555 \
  vehicle-simple-mock-service:latest
```

### Stop service
```bash
docker compose --profile simple-mock down simple-mock-service
# or
docker stop vehicle-simple-mock-service
```

### View logs
```bash
docker logs vehicle-simple-mock-service
```

## Supported Signals

Default signals that are mocked:

1. `Vehicle.Body.Lights.Beam.High.IsOn` - High beam light
2. `Vehicle.Body.Lights.Beam.Low.IsOn` - Low beam light
3. `Vehicle.Body.Hood.IsOpen` - Hood status
4. `Vehicle.Body.Trunk.Rear.IsOpen` - Trunk status
5. `Vehicle.ADAS.CruiseControl.SpeedSet` - Cruise control speed

You can add more signals by modifying `DEFAULT_MOCK_SIGNALS` in `simple_mock.py`.

## Use Cases

### 1. Test Python App Without Hardware
```javascript
// Start mock service in echo-all mode
startMockService({ mode: 'echo-all' });

// Deploy your Python app
deployPythonApp({ ... });

// App can now read back actuator values
```

### 2. Simulate Random Vehicle Data
```javascript
// Start mock service in random mode
startMockService({
  mode: 'random',
  kuksaHost: '127.0.0.1',
  kuksaPort: '55555'
});

// Vehicle signals will change randomly every 2 seconds
```

### 3. Test Specific Signals Only
```javascript
// Start mock service in echo-specific mode
startMockService({
  mode: 'echo-specific',
  signals: [
    'Vehicle.Body.Lights.Beam.Low.IsOn',
    'Vehicle.ADAS.CruiseControl.SpeedSet'
  ]
});

// Only these 2 signals will be echoed
```

### 4. Test with Real Hardware
```javascript
// Stop mock service to use real hardware
stopMockService();

// Or start in off mode (container running but no mocking)
startMockService({ mode: 'off' });
```

## Troubleshooting

### Mock service not starting
- Check if Kuksa is running: `docker ps | grep kuksa`
- Check mock service logs: `docker logs vehicle-simple-mock-service`
- Verify network: Ensure using `--network host` or correct network configuration

### Values not being echoed
- Check mode is set to `echo-all` or `echo-specific`
- Verify signal paths match VSS specification
- Check mock service logs for errors

### API calls failing
- Ensure vehicle-edge-runtime is running
- Check WebSocket connection is established
- Verify message format matches API specification
