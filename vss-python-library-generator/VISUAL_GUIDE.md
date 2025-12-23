# 🚀 Quick Visual Guide - Choose Your Use Case

## Quick Decision Tree

```
Need vehicle signals in Python?
│
├─ Just want to use existing library?
│  └─→ Use Case 1: Use Existing (10 sec)
│
├─ Need fresh standard library?
│  └─→ Use Case 2: Generate Default (4 sec)
│
└─ Need custom signals?
   └─→ Use Case 3: Generate with Custom (5 min)
```

---

## Use Case 1: Use Existing Library ⚡ Fastest

### When
- ✅ Just want to start coding
- ✅ Default signals are fine
- ✅ Need quick setup

### Commands

```bash
# 1. Install dependencies
cd /path/to/79_sdv_lib_generator/output
pip3 install -r requirements.txt

# 2. Add to Python (pick one)
export PYTHONPATH="$(pwd):${PYTHONPATH}"           # Temporary
pip3 install -e .                                  # Permanent
echo 'export PYTHONPATH="..."' >> ~/.bashrc        # Auto-load

# 3. Verify
python3 -c "from vehicle import vehicle; print('✅ Ready!')"
```

### Time: **10 seconds**

---

## Use Case 2: Generate Default Library 🆕 Fresh Copy

### When
- ✅ Want new output directory
- ✅ Need specific VSS version
- ✅ Starting new project

### Commands

```bash
# 1. Generate
cd /path/to/79_sdv_lib_generator
./sdv-gen.sh --vss-version 4.0 --output my_vehicle_lib

# 2. Install dependencies
cd my_vehicle_lib
pip3 install -r requirements.txt

# 3. Add to Python
export PYTHONPATH="$(pwd):${PYTHONPATH}"
# or
pip3 install -e .

# 4. Verify
python3 -c "from vehicle import vehicle; print('✅ Ready!')"
```

### Time: **4 seconds**

---

## Use Case 3: Generate with Custom Signals 🎨 Customized

### When
- ✅ Need your own signals
- ✅ Extending standard signals
- ✅ Custom sensors/actuators

### Step 1: Create Custom Signals (5 min)

```bash
cat > my_signals.vspec << 'EOF'
Vehicle:
  type: branch

Vehicle.MySensor:
  type: sensor
  datatype: float
  unit: celsius

Vehicle.MyActuator:
  type: actuator
  datatype: boolean
EOF
```

### Step 2: Generate (4 sec)

```bash
cd /path/to/79_sdv_lib_generator
./sdv-gen.sh --overlay my_signals.vspec --output my_custom_lib
```

### Step 3: Install (10 sec)

```bash
cd my_custom_lib
pip3 install -r requirements.txt
export PYTHONPATH="$(pwd):${PYTHONPATH}"
```

### Step 4: Verify

```bash
python3 -c "from vehicle import vehicle; print('Has MySensor:', hasattr(vehicle, 'MySensor'))"
```

### Time: **5 minutes**

---

## Python Environment Setup

### Choose Your Method

```
Temporary testing?
├─ Yes → export PYTHONPATH="..."
└─ No → Continue

     Development?
     ├─ Yes → pip3 install -e . (editable)
     └─ No → Continue

          Production?
          ├─ Yes → Virtual environment + pip install
          └─ No → Continue

               Docker?
               ├─ Yes → Dockerfile with PYTHONPATH
               └─ No → System-wide pip install
```

### Quick Setup Commands

```bash
# Method 1: PYTHONPATH (quickest)
export PYTHONPATH="/path/to/lib:${PYTHONPATH}"

# Method 2: Editable install (recommended for dev)
cd /path/to/lib
pip3 install -e .

# Method 3: Virtual environment (best for production)
python3 -m venv venv
source venv/bin/activate
pip3 install -e /path/to/lib
```

---

## Code Examples

### Use Case 1: Existing Library

```python
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle

class QuickApp(VehicleApp):
    async def on_start(self):
        speed = (await vehicle.Speed.get()).value
        print(f"Speed: {speed}")

app = QuickApp(vehicle)
await app.run()
```

### Use Case 2: New Default Library

```python
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle

class FreshApp(VehicleApp):
    async def on_start(self):
        # All standard signals available
        await vehicle.Body.Lights.Beam.Low.IsOn.set(True)
        is_on = (await vehicle.Body.Lights.Beam.Low.IsOn.get()).value
        print(f"Lights on: {is_on}")

app = FreshApp(vehicle)
await app.run()
```

### Use Case 3: Custom Signals

```python
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle

class CustomApp(VehicleApp):
    async def on_start(self):
        # Standard signals
        speed = (await vehicle.Speed.get()).value

        # Your custom signals
        temp = (await vehicle.MySensor.get()).value
        await vehicle.MyActuator.set(True)

        print(f"Speed: {speed}, Temp: {temp}, Actuator: ON")

app = CustomApp(vehicle)
await app.run()
```

---

## Common Commands Reference

```bash
# Generate commands
./sdv-gen.sh                                    # Default
./sdv-gen.sh --vss-version 4.0                 # With version
./sdv-gen.sh --overlay custom.vspec            # With overlay
./sdv-gen.sh --output my_lib                   # Custom output

# Environment setup
export PYTHONPATH="$(pwd):${PYTHONPATH}"       # Temp
pip3 install -e .                              # Perm
echo 'export PYTHONPATH="..."' >> ~/.bashrc    # Auto

# Verification
python3 -c "from vehicle import vehicle"       # Test import
./test_suite.sh                                # Run all tests

# Help
./sdv-gen.sh --help                            # Show options
```

---

## Troubleshooting Quick Guide

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError` | Add to PYTHONPATH or `pip3 install -e .` |
| `Command not found` | Use full path: `/path/to/sdv-gen.sh` |
| Can't connect to broker | Start Kuksa: `docker run -p 55555:55555 eclipse/kuksa.val:databroker-agl` |
| Custom signal missing | Regenerate library with `--overlay` |
| Permission denied | `chmod +x sdv-gen.sh` |

---

## Summary

| Use Case | Time | Difficulty | Command |
|----------|------|------------|---------|
| **1. Use existing** | 10 sec | ⭐ Easy | `export PYTHONPATH="..."` |
| **2. Generate default** | 4 sec | ⭐ Easy | `./sdv-gen.sh` |
| **3. Generate custom** | 5 min | ⭐⭐ Medium | `./sdv-gen.sh --overlay x.vspec` |

**All methods work!** Choose based on your needs.

**Need details?** See `USE_CASES.md`
**Need to test?** Run `./test_suite.sh`
**Quick reference?** See `QUICKREF.md`
