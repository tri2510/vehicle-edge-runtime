# Vehicle Edge Runtime - Test Application

## Vehicle Light Control Example

This Python app demonstrates vehicle signal access through the Vehicle Edge Runtime.

## How it Works

The app:
1. **Starts** when deployed via `deploy_request`
2. **Writes** to vehicle signal: `Vehicle.Body.Lights.Beam.Low.IsOn`
3. **Reads** back the signal value
4. **Logs** the light state changes
5. **Runs continuously** in a loop

## Expected Console Output

```
Vehicle Light Control App started
Light value True
Light value False
Light value True
Light value False
...
```

## Deployment via Vehicle Edge Runtime

```javascript
// Frontend sends this deploy_request:
{
    type: 'deploy_request',
    id: 'unique-id',
    code: // Python app content from vehicle_light_control.py
}
```

## Runtime Integration

- **Containerization**: App runs in Docker with Python 3.11
- **Vehicle Access**: Runtime handles Kuksa gRPC communication
- **Signal Path**: `Vehicle.Body.Lights.Beam.Low.IsOn` (boolean)
- **Real-time**: Signal updates broadcast to all clients

## Test Flow Verification

1. Deploy app → Runtime starts Python container
2. Signal writes → Kuksa updates vehicle lights
3. Signal reads → Runtime logs light states
4. Console output → Real-time feedback to frontend

This verifies the complete Vehicle Edge Runtime flow: **Deploy → Execute → Access Vehicle → Monitor**