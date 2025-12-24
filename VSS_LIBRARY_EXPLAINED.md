# VSS Python Library Generator - Complete Explanation

## 🎯 What is the VSS Python Library Generator?

The **VSS Python Library Generator** is a tool that converts **Vehicle Signal Specification (VSS)** files into **usable Python code**. It's a "black-box" tool that takes vehicle signal definitions and generates a Python library for accessing those signals.

## 📚 Understanding VSS (Vehicle Signal Specification)

VSS is a standardized tree structure that defines ALL vehicle signals:

```
Vehicle (root)
├── Speed                    (sensor - speed in km/h)
├── Body
│   ├── Lights
│   │   └── Beam
│   │       ├── Low
│   │       │   └── IsOn    (actuator - toggle low beams)
│   │       └── High
│   │           └── IsOn    (actuator - toggle high beams)
├── Cabin
│   ├── Door
│   │   ├── Row1
│   │   │   ├── Left
│   │   │   │   └── IsOpen  (sensor/actuator - door state)
│   │   │   └── Right
│   │       └── ...
│   └── Light
│       └── IsOn           (actuator - cabin light)
└── Chassis
    ├── SteeringWheel
    │   └── Angle          (sensor - steering angle)
    └── Axle
        └── Row1
            └── Wheel
                ├── FrontLeft
                │   └── Speed   (sensor - wheel speed)
                └── ...
```

### Why VSS Matters

1. **Standardization** - Same signal names across all vehicles
2. **Type Safety** - Datatypes defined (float, bool, int, string)
3. **Tree Structure** - Organized, logical hierarchy
4. **Vendor Agnostic** - Works with any vehicle implementing VSS

## 🔄 How the Generator Works

### Input → Process → Output

```
┌─────────────────┐
│  VSS Files      │  (vss.json, custom.vspec, etc.)
│  (Text/JSON)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  sdv-gen.sh (Generator Script)      │
│  ┌─────────────────────────────┐   │
│  │ 1. Parse VSS files          │   │
│  │ 2. Build tree structure     │   │
│  │ 3. Generate Python classes  │   │
│  │ 4. Create type definitions  │   │
│  │ 5. Add SDK integration      │   │
│  └─────────────────────────────┘   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Python Library │  (output/vehicle/, output/sdv/)
│  (Code)         │
└─────────────────┘
```

### What Gets Generated

#### 1. **Vehicle Signal Classes** (`output/vehicle/`)

For each VSS signal, a Python class is generated:

```python
# VSS: Vehicle.Speed (sensor, float)
# Generated: vehicle/Speed.py

class Speed:
    """Vehicle.Speed sensor"""

    async def get(self) -> Datapoint:
        """Get current speed value"""
        ...

# VSS: Vehicle.Body.Lights.Beam.Low.IsOn (actuator, boolean)
# Generated: vehicle/Body/Lights/Beam/Low/IsOn.py

class IsOn:
    """Vehicle.Body.Lights.Beam.Low.IsOn actuator"""

    async def get(self) -> Datapoint:
        """Get current light state"""
        ...

    async def set(self, value: bool) -> None:
        """Set light state"""
        ...
```

#### 2. **SDK Integration** (`output/sdv/`)

Wrappers for Velocitas Vehicle SDK:

```python
# sdv/vehicle_app.py
from velocitas_sdk.vehicle_app import VehicleApp as _VehicleApp

class VehicleApp(_VehicleApp):
    """Base class for vehicle applications"""
    ...

# sdv/__init__.py
from .vehicle_app import VehicleApp
__all__ = ['VehicleApp']
```

#### 3. **Main Vehicle Object** (`output/vehicle/__init__.py`)

```python
from .Speed import Speed
from .Body import Body
from .Cabin import Cabin
# ... imports all branches

class Vehicle:
    Speed = Speed
    Body = Body
    Cabin = Cabin
    # ... all branches

vehicle = Vehicle()
```

## 🏗️ Integration with Vehicle Edge Runtime

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Vehicle Edge Runtime (Main Container)                      │
│                                                              │
│  ┌───────────────────────────────────────────────────┐     │
│  │  vss-python-library-generator/                     │     │
│  │  ├─ src/ (generator code)                          │     │
│  │  ├─ sdv-gen.sh (generator script)                 │     │
│  │  └─ output/ (GENERATED LIBRARY - Pre-built)       │     │
│  │      ├─ vehicle/ (signal classes)                 │     │
│  │      ├─ sdv/ (SDK wrappers)                       │     │
│  │      └─ requirements.txt                           │     │
│  └───────────────────────────────────────────────────┘     │
│                           │                                  │
│                           │ Docker Volume Mount             │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────┐     │
│  │  Docker Volume: vehicle-edge-data                  │     │
│  │  └─ applications/vehicle-library/                   │     │
│  │      ├─ vehicle/ (copied from output/)             │     │
│  │      ├─ sdv/ (copied from output/)                 │     │
│  │      └─ requirements.txt                           │     │
│  └───────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Volume Mount (read-only)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Python App Container (Deployed by Runtime)                 │
│                                                              │
│  Environment:                                                │
│  ├─ PYTHONPATH=/app/vehicle-lib:/app/dependencies:/tmp     │
│  ├─ KUKSA_DATA_BROKER_ADDR=127.0.0.1                       │
│  └─ KUKSA_DATA_BROKER_PORT=55555                           │
│                                                              │
│  User Code:                                                  │
│  ┌──────────────────────────────────────────────────┐       │
│  │  from sdv import VehicleApp                       │       │
│  │  from vehicle import vehicle                      │       │
│  │                                                   │       │
│  │  class MyApp(VehicleApp):                         │       │
│  │      async def on_start(self):                    │       │
│  │          speed = await self.Vehicle.Speed.get()   │       │
│  │          print(f"Speed: {speed.value}")            │       │
│  └──────────────────────────────────────────────────┘       │
│                           │                                  │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Kuksa Databroker (Container or Host)             │      │
│  │  Port: 55555                                      │      │
│  │  - Stores vehicle signal values                   │      │
│  │  - Provides gRPC API                             │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Key Integration Points

#### 1. **Pre-Generated Library** (Not Generated at Runtime)

```bash
# Library is ALREADY generated in output/
# Runtime just copies it to Docker volume

vss-python-library-generator/
└── output/               # Pre-generated, ready to use
    ├── vehicle/
    ├── sdv/
    └── requirements.txt
```

#### 2. **Automatic Volume Mounting**

When deploying Python apps, the runtime:

```javascript
// In EnhancedApplicationManager.js
const vehicleLibPath = '/var/lib/docker/volumes/vehicle-edge-data/_data/applications/vehicle-library';

// Copy library to volume (once on startup)
await this._initializeVehicleLibrary();

// Mount in all Python containers
Binds: [
    `${vehicleLibPath}:/app/vehicle-lib:ro`
],

Env: [
    'PYTHONPATH=/app/vehicle-lib:/app/dependencies:/tmp'
]
```

#### 3. **Dependency Management**

```python
# output/requirements.txt
velocitas-sdk==0.14.1
kuksa_client==0.4.3
grpcio==1.64.1
# ... etc

# These are auto-installed when deploying Python apps
```

## 💡 How Python Apps Use It

### Complete Example

```python
# 1. Import the SDK and vehicle library
from sdv import VehicleApp
from vehicle import vehicle

# 2. Extend VehicleApp base class
class MySpeedMonitor(VehicleApp):
    async def on_start(self):
        """Called when app starts"""
        print("✅ Speed monitor started!")

        # 3. Read vehicle signals
        while True:
            try:
                # Get current speed
                speed_datapoint = await self.Vehicle.Speed.get()
                speed = speed_datapoint.value  # Extract value

                print(f"Current speed: {speed} km/h")

                # Read multiple signals
                lights = await self.Vehicle.Body.Lights.Beam.Low.IsOn.get()
                print(f"Lights on: {lights.value}")

                # Set an actuator (if allowed)
                await self.Vehicle.Cabin.Light.IsOn.set(True)

                # Wait 2 seconds
                await asyncio.sleep(2)

            except Exception as e:
                print(f"Error: {e}")
                break

# 4. Create app instance with vehicle object
app = MySpeedMonitor(vehicle)

# 5. Run the app (async)
asyncio.run(app.run())
```

### What Happens Under the Hood

```python
# When you call: await self.Vehicle.Speed.get()

# 1. vehicle.Speed object is accessed
#    (from output/vehicle/__init__.py)

# 2. Speed class calls Kuksa client
#    (from velocitas-sdk)

# 3. gRPC call to Kuksa databroker
#    GET Vehicle.Speed

# 4. Kuksa returns current value
#    { "value": 100.0, "type": "float" }

# 5. SDK wraps in Datapoint object
#    Datapoint(value=100.0)

# 6. Your code receives the datapoint
#    speed_datapoint.value == 100.0
```

## 🔧 Customizing the Library

### Adding Custom Signals

```bash
# 1. Create custom VSS file
cat > my_signals.vspec << 'EOF'
Vehicle:
  type: branch
  Vehicle.CustomSignals:
    type: branch
    Vehicle.CustomSignals.MySensor:
      type: sensor
      datatype: float
      description: "My custom sensor"
      unit: m/s
EOF

# 2. Regenerate library
./vss-python-library-generator/sdv-gen.sh \
    --overlay my_signals.vspec \
    --output my_custom_lib

# 3. Use in app
from vehicle import vehicle  # Now includes CustomSignals!

sensor = await vehicle.CustomSignals.MySensor.get()
```

## 📊 VSS Versions Supported

| Version | Status | Notes |
|---------|--------|-------|
| 3.0 | ✅ | Stable, widely used |
| 3.1 | ✅ | Minor enhancements |
| 3.1.1 | ✅ | Bug fixes |
| 4.0 | ✅ | Latest major version |
| default | ✅ | Uses built-in default |

## 🎯 Key Benefits

1. **Type Safety** - Compile-time type checking
2. **Autocomplete** - IDE knows all available signals
3. **Documentation** - Signal info embedded in code
4. **Consistency** - Same API across all vehicle signals
5. **Maintainability** - Regenerate when VSS changes
6. **Standards Compliant** - Follows VSS standard
7. **Kuksa Integration** - Works seamlessly with Kuksa databroker

## 🔍 Relationship with Vehicle Interface Service

### Two Different Things

**VSS Library Generator:**
- Generates Python code from VSS
- Used by Python apps at development time
- Provides type-safe API for vehicle signals
- Works with Kuksa databroker

**Vehicle Interface Service:**
- Echo service for testing/staging
- Mirrors target values to current values
- Runs as a separate service
- Also works with Kuksa databroker

### How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│  Python App (uses VSS library)                              │
│                                                              │
│  from vehicle import vehicle                                 │
│  await vehicle.Speed.set(100.0)  ─────────────────────┐     │
└───────────────────────────────────────────────────────┼─────┘
                                                        │
                                                        ▼
┌───────────────────────────────────────────────────────────────────┐
│  Kuksa Databroker                                                  │
│                                                                   │
│  Vehicle.Speed target value = 100.0                               │
│         │                                                         │
│         │ subscribe_target_values()                              │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Vehicle Interface Service (Echo Mode)                  │     │
│  │                                                          │     │
│  │  Subscribes to target values                             │     │
│  │  Mirrors to current values                               │     │
│  │  Vehicle.Speed current = 100.0                           │     │
│  └─────────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────────┘
```

## 📝 Summary

The **VSS Python Library Generator** is:

1. ✅ **A code generation tool** - Converts VSS to Python
2. ✅ **Pre-generated** - Already built in `output/` directory
3. ✅ **Auto-deployed** - Mounted in all Python app containers
4. ✅ **Type-safe** - Provides Python classes for all vehicle signals
5. ✅ **Kuksa-integrated** - Uses Kuksa databroker for signal access
6. ✅ **Standard-compliant** - Follows VSS specification

**In Vehicle Edge Runtime:**
- Library is pre-generated in `vss-python-library-generator/output/`
- Automatically mounted at `/app/vehicle-lib` in Python containers
- Apps use `from vehicle import vehicle` to access signals
- Works with Kuksa databroker for signal storage

This makes it **super easy** for developers to access vehicle signals without worrying about gRPC, VSS parsing, or Kuksa internals!

---

**For more details, see:**
- `vss-python-library-generator/README.md` - Generator usage
- `vss-python-library-generator/USE_CASES.md` - Practical examples
- `VSS_LIBRARY_INTEGRATION.md` - Integration with runtime
- `vss-python-library-generator/IMPORT_GUIDE.md` - Import patterns