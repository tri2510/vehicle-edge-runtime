# Vehicle Library Requirements and Setup

## CRITICAL: Kuksa Databroker is REQUIRED

The VSS vehicle library **REQUIRES** a running Kuksa databroker to function. It will NOT work without it.

### Why?

The Velocitas SDK (which the vehicle library is built on) needs to connect to a vehicle data broker during module import. It attempts to connect to either:
- MQTT broker (Native middleware)
- Kuksa databroker

Without one of these running, the import will fail with:
```
ConnectionRefusedError: [Errno 111] Connection refused
```

## Setup Steps

### 1. Deploy Kuksa Databroker

**Option A: Deploy via vehicle-edge-runtime (Recommended)**

Deploy the Kuksa app from the frontend. This will start Kuksa on port 55555.

**Option B: Run Kuksa manually**

```bash
docker run -d --name kuksa-databroker \
  --network host \
  ghcr.io/eclipse-kuksa/kuksa-databroker:0.4.4
```

### 2. Verify Kuksa is Running

```bash
# Check if Kuksa is accessible
curl http://127.0.0.1:55555
```

Expected response:
```json
{"kuksa":"databroker"}
```

### 3. Deploy Python Apps

Once Kuksa is running, Python apps using the vehicle library will work:

```python
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle

class MyApp(VehicleApp):
    def __init__(self, vehicle_client):
        super().__init__()
        self.Vehicle = vehicle_client

    async def on_start(self):
        # Now this will work!
        await self.Vehicle.Body.Lights.Beam.Low.IsOn.set(True)

app = MyApp(vehicle)
await app.run()
```

## Environment Variables

The vehicle library automatically uses these environment variables (set by vehicle-edge-runtime):

```bash
KUKSA_DATA_BROKER_ADDR=127.0.0.1
KUKSA_DATA_BROKER_PORT=55555
PYTHONPATH=/app/vehicle-lib:/app/dependencies:/tmp
```

## Troubleshooting

### Error: `ConnectionRefusedError: [Errno 111] Connection refused`

**Cause**: Kuksa databroker is not running
**Solution**: Deploy Kuksa first (see step 1)

### Error: `ModuleNotFoundError: No module named 'sdv'`

**Cause**: Vehicle library dependencies not installed OR Kuksa not running
**Solution**:
1. Make sure Kuksa is running
2. Dependencies are auto-installed on deployment

### Error: `ImportError: cannot import name 'Vehicle' from 'vehicle'`

**Cause**: Incorrect import statement
**Solution**: Use `from vehicle import vehicle` (lowercase)

## Architecture

```
┌─────────────────────────────────────────────────┐
│  vehicle-edge-runtime                           │
│  - Deploys Python apps                          │
│  - Sets up environment variables                │
│  - Mounts vehicle library                       │
└─────────────────────────────────────────────────┘
                        │
                        ├─> Kuksa Databroker (REQUIRED!)
                        │   Port: 55555
                        │   Network: host
                        │
                        └─> Python App Container
                            ├── /app/vehicle-lib (mounted)
                            ├── Dependencies installed
                            ├── PYTHONPATH set
                            └── KUKSA_* env vars set
```

## Complete Deployment Order

1. **Start vehicle-edge-runtime**
   ```bash
   bash scripts/start-docker-dev.sh
   ```

2. **Deploy Kuksa** (from frontend or API)
   - App will be called "kuksa-databroker" or similar
   - Will start on port 55555

3. **Wait for Kuksa to be ready**
   ```bash
   # Check logs
   docker logs -f <kuksa-container-id>

   # Or test connection
   curl http://127.0.0.1:55555
   ```

4. **Deploy Python apps** that use vehicle library
   - Now they will connect to Kuksa successfully
   - Can read/write vehicle signals

## Example Session

```bash
# Terminal 1: Start runtime
cd /path/to/vehicle-edge-runtime
bash scripts/start-docker-dev.sh

# Terminal 2: Deploy Kuksa (from frontend UI)
# Navigate to http://localhost:3002
# Deploy the Kuksa application

# Terminal 3: Verify Kuksa
curl http://127.0.0.1:55555
# Should return: {"kuksa":"databroker"}

# Terminal 4: Deploy Python app (from frontend)
# Deploy your Python app using the vehicle library

# Check logs
docker logs -f <python-app-container-id>
# Should see: "App started successfully!"
```

## Summary

**You CANNOT use the vehicle library without Kuksa databroker running.**

The library is not standalone - it's a client library that connects to Kuksa for all vehicle data operations.

This is by design - the Velocitas SDK architecture requires a centralized vehicle data broker.
