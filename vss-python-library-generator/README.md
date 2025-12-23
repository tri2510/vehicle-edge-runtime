# 🚗 SDV Vehicle Library Generator

**Generate Python vehicle libraries from VSS specifications - Black-box CLI tool**

## 🎯 Quick Start

### Option 1: Use Existing Library (Fastest)

```bash
cd output
pip3 install -r requirements.txt
export PYTHONPATH="$(pwd):${PYTHONPATH}"
python3 -c "from vehicle import vehicle; print('✅ Ready!')"
```

### Option 2: Generate New Library

```bash
./sdv-gen.sh --output my_vehicle_lib
```

### Option 3: Generate with Custom Signals

```bash
./sdv-gen.sh --overlay my_signals.vspec --output my_lib
```

## 📚 Documentation

| Guide | For | Description |
|-------|-----|-------------|
| **[VISUAL_GUIDE.md](VISUAL_GUIDE.md)** | Everyone | Visual decision tree & quick commands |
| **[USE_CASES.md](USE_CASES.md)** | Users | 3 essential use cases with Python setup |

## 🚀 Usage

```bash
# Basic usage
./sdv-gen.sh

# With VSS version
./sdv-gen.sh --vss-version 4.0

# With custom overlay
./sdv-gen.sh --overlay custom.vspec

# Custom output
./sdv-gen.sh --output /path/to/output

# Help
./sdv-gen.sh --help

# Version
./sdv-gen.sh --version

# Run tests
./test_suite.sh
```

## 📦 What It Does

**Input:** VSS (Vehicle Signal Specification) files  
**Output:** Python vehicle library with type definitions

### Generated Library Structure

```
output/
├── vehicle/          # Python vehicle module
│   ├── __init__.py  # Main Vehicle class
│   ├── Body/        # Body components
│   ├── Cabin/       # Cabin components
│   ├── Chassis/     # Chassis components
│   └── ...          # 20+ branches
├── sdv/             # SDK compatibility
├── requirements.txt # Dependencies
└── vss.json        # VSS specification
```

## 💡 Example Usage

```python
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle

class MyApp(VehicleApp):
    async def on_start(self):
        # Read sensor
        speed = (await vehicle.Speed.get()).value
        print(f"Speed: {speed} km/h")

        # Control actuator
        await vehicle.Body.Lights.Beam.Low.IsOn.set(True)

app = MyApp(vehicle)
await app.run()
```

## ✨ Features

- ✅ **Black-box shell script** - Just run it
- ✅ **Smart caching** - Fast subsequent runs
- ✅ **VSS versions** - 3.0, 3.1, 3.1.1, 4.0, default
- ✅ **Custom signals** - Add your own overlays
- ✅ **Production ready** - Fully tested
- ✅ **Works anywhere** - No directory restrictions

## ✅ Testing

```bash
./test_suite.sh
```

**Result:** 14/14 tests passing (100%)

## 🎓 Three Essential Use Cases

### 1. Use Existing Library (10 seconds)
```bash
cd output
pip3 install -r requirements.txt
export PYTHONPATH="$(pwd):${PYTHONPATH}"
```

### 2. Generate New Library (4 seconds)
```bash
./sdv-gen.sh --output my_lib
cd my_lib
pip3 install -r requirements.txt
```

### 3. Generate with Custom Signals (5 minutes)
```bash
cat > custom.vspec << 'EOF'
Vehicle:
  type: branch
Vehicle.MySignal:
  type: sensor
  datatype: float
