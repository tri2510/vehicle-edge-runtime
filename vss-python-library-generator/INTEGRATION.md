# Vehicle Signal Library Integration Guide

## Overview

The VSS (Vehicle Signal Specification) Python library is now integrated into vehicle-edge-runtime, allowing deployed Python applications to easily access vehicle signals in a type-safe manner.

## How It Works

### Architecture

```
vehicle-edge-runtime Container
├── vss-python-library-generator/
│   └── output/                    # Pre-generated vehicle library
│       ├── vehicle/              # Main vehicle module
│       │   ├── Body/
│       │   ├── Cabin/
│       │   ├── Chassis/
│       │   └── ... (20+ branches)
│       ├── sdv/                  # Velocitas SDK compatibility
│       └── requirements.txt      # Runtime dependencies
│
└── Python App Containers         # Mounted at /app/vehicle-lib:ro
    ├── /app/vehicle-lib/         # Vehicle library (read-only)
    ├── /app/dependencies/        # App-specific dependencies
    └── /tmp/app.py              # User application code
```

### Integration Points

1. **Pre-generated Library**: The vehicle library is generated once during build/deployment
2. **Volume Mount**: Automatically mounted into all Python containers at `/app/vehicle-lib`
3. **PYTHONPATH**: Automatically added to Python path: `/app/vehicle-lib:/app/dependencies:/tmp`
4. **No Runtime Overhead**: No generation delay when deploying apps

## Usage

### Basic Example

```python
#!/usr/bin/env python3
from vehicle import vehicle

# Read vehicle speed
async def get_speed():
    speed_data = await vehicle.Speed.get()
    print(f"Current speed: {speed_data.value} km/h")

# Set a value
async def turn_on_lights():
    await vehicle.Body.Lights.Beam.Low.IsOn.set(True)
```

### With Velocitas SDK

```python
#!/usr/bin/env python3
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle

class MyVehicleApp(VehicleApp):
    async def on_start(self):
        # Subscribe to speed changes
        await vehicle.Speed.subscribe(self.on_speed_changed)

    async def on_speed_changed(self, data):
        speed = data.value
        print(f"Speed changed: {speed} km/h")

        # Control actuators
        if speed > 100:
            await vehicle.Body.Lights.Beam.Low.IsOn.set(True)

app = MyVehicleApp(vehicle)
```

### Available Signal Branches

The library includes the following major branches (VSS 4.0):

- **Vehicle.Speed** - Current vehicle speed
- **Vehicle.Body** - Body components (lights, doors, windows, etc.)
- **Vehicle.Cabin** - Interior cabin controls
- **Vehicle.Chassis** - Chassis-related signals
- **Vehicle.Powertrain** - Powertrain (engine, motor, transmission)
- **Vehicle.ADAS** - Advanced Driver Assistance Systems
- **Vehicle.OBD** - On-Board Diagnostics
- **Vehicle.Connectivity** - Network and connectivity
- **And 12 more branches...**

See `/app/vehicle-lib/vss.json` in container for complete specification.

## Available Dependencies

The vehicle library includes these pre-installed dependencies:

- `velocitas-sdk==0.14.1` - Velocitas Vehicle App SDK
- `kuksa_client==0.4.3` - Kuksa databroker client
- `grpcio==1.64.1` - gRPC framework
- `protobuf==5.27.3` - Protocol buffers
- `aiohttp==3.9.3` - Async HTTP client
- `cloudevents==1.11.0` - CloudEvents standard
- `python-socketio==5.11.3` - Socket.IO client
- `async-timeout==4.0.3` - Async timeout support
- `attrs==24.2.0` - Python attributes

## Environment Configuration

When Python apps are deployed, these environment variables are automatically set:

```bash
PYTHONUNBUFFERED=1
PYTHONPATH=/app/vehicle-lib:/app/dependencies:/tmp
APP_ID=<your-app-id>
EXECUTION_ID=<execution-id>
KUKSA_DATA_BROKER_ADDR=127.0.0.1:55555  # If Kuksa is running
```

## Deployment Examples

### Example 1: Simple Speed Monitor

```python
#!/usr/bin/env python3
import asyncio
from vehicle import vehicle

async def main():
    while True:
        try:
            speed = await vehicle.Speed.get()
            print(f"Speed: {speed.value} km/h")
            await asyncio.sleep(1)
        except Exception as e:
            print(f"Error: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())
```

### Example 2: Light Control App

```python
#!/usr/bin/env python3
import asyncio
from vehicle import vehicle

async def main():
    try:
        # Turn on low beam lights
        await vehicle.Body.Lights.Beam.Low.IsOn.set(True)
        print("Lights turned on")

        # Check status
        status = await vehicle.Body.Lights.Beam.Low.IsOn.get()
        print(f"Lights status: {status.value}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
```

### Example 3: Velocitas Vehicle App

```python
#!/usr/bin/env python3
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle

class SpeedWarningApp(VehicleApp):
    async def on_start(self):
        self.speed_limit = 120
        print("Speed Warning App Started")

        # Subscribe to speed changes
        await vehicle.Speed.subscribe(self.on_speed_changed)

    async def on_speed_changed(self, data):
        speed = data.value

        if speed > self.speed_limit:
            print(f"⚠️  Warning: Speed {speed} km/h exceeds limit {self.speed_limit} km/h")
            # Turn on hazard lights
            await vehicle.Body.Lights.Hazard.IsOn.set(True)
        else:
            await vehicle.Body.Lights.Hazard.IsOn.set(False)

if __name__ == "__main__":
    app = SpeedWarningApp(vehicle)
    app.run()
```

## Updating the Vehicle Library

If you need to regenerate the vehicle library with custom signals or different VSS version:

### 1. SSH into vehicle-edge-runtime container

```bash
docker exec -it vehicle-edge-runtime-dev bash
```

### 2. Navigate to generator directory

```bash
cd /app/vss-python-library-generator
```

### 3. Regenerate with options

```bash
# Default VSS version
./sdv-gen.sh --output output

# Specific VSS version
./sdv-gen.sh --vss-version 4.0 --output output

# With custom overlay signals
./sdv-gen.sh --overlay /path/to/custom.vspec --output output
```

### 4. Restart Python apps

The updated library will be immediately available to newly deployed apps. Running apps will need to be restarted.

## Troubleshooting

### Import Error: "No module named 'vehicle'"

**Problem**: Vehicle library not found
**Solution**: Check that the container has the volume mount:
```bash
docker inspect <container-id> | grep -A 10 "Mounts"
```
Should show: `/app/vss-python-library-generator/output:/app/vehicle-lib`

### Connection Error: Kuksa databroker

**Problem**: Cannot connect to Kuksa databroker
**Solution**: Ensure Kuksa is running:
```bash
docker ps | grep kuksa
```
Check connection:
```bash
curl http://127.0.0.1:55555
```

### Signal Not Found

**Problem**: `AttributeError: 'Vehicle' object has no attribute 'X'`
**Solution**: Check available signals in VSS spec:
```python
import json
with open('/app/vehicle-lib/vss.json') as f:
    vss = json.load(f)
    # Print available signals
```

## Technical Details

### Library Location

- **Host**: `/home/htr1hc/01_SDV/78_deploy_extension/vehicle-edge-runtime/vss-python-library-generator/output/`
- **Container**: `/app/vss-python-library-generator/output/`
- **Mount Point**: `/app/vehicle-lib` (in Python app containers)

### Container Configuration

From `EnhancedApplicationManager.js`:
```javascript
Binds: [
    '/app/vss-python-library-generator/output:/app/vehicle-lib:ro',
    '/app/storage/dependencies/<appId>:/app/dependencies:ro'
],
Env: [
    'PYTHONPATH=/app/vehicle-lib:/app/dependencies:/tmp',
    'PYTHONUNBUFFERED=1',
    // ... other env vars
]
```

## Additional Resources

- **VSS Specification**: `/app/vehicle-lib/vss.json`
- **Generator Source**: `/app/vss-python-library-generator/`
- **Examples**: `/app/vss-python-library-generator/output/example_app.py`
- **Velocitas SDK Docs**: https://eclipse-velocitas.github.io/vehicle-app-python-sdk/
