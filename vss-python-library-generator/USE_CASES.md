# SDV Vehicle Library Generator - 3 Essential Use Cases

Quick guide for the most common scenarios.

## Use Case 1: Use Existing Generated Library (Quickest)

**When to use:** You just want to start coding with vehicle signals right away.

### Step 1: Install Dependencies

```bash
cd /path/to/79_sdv_lib_generator/output
pip3 install -r requirements.txt
```

### Step 2: Add to Python Environment

**Option A: Temporary (current session only)**
```bash
export PYTHONPATH="/path/to/79_sdv_lib_generator/output:${PYTHONPATH}"
```

**Option B: Permanent (add to ~/.bashrc)**
```bash
echo 'export PYTHONPATH="/path/to/79_sdv_lib_generator/output:${PYTHONPATH}"' >> ~/.bashrc
source ~/.bashrc
```

**Option C: Install as Python package**
```bash
cd /path/to/79_sdv_lib_generator/output
pip3 install -e .
```

### Step 3: Verify It Works

```bash
python3 -c "from vehicle import vehicle; from sdv import VehicleApp; print('✅ Library available!')"
```

### Step 4: Use in Your Code

```python
#!/usr/bin/env python3
import asyncio
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle

class MyApp(VehicleApp):
    async def on_start(self):
        # Read vehicle speed
        speed = (await vehicle.Speed.get()).value
        print(f"Current speed: {speed} km/h")

        # Turn on lights
        await vehicle.Body.Lights.Beam.Low.IsOn.set(True)

        # Check if door is open
        is_open = (await vehicle.Cabin.Door.Row1.Left.IsOpen.get()).value
        if is_open:
            print("Driver door is open!")

async def main():
    app = MyApp(vehicle)
    await app.run()

if __name__ == "__main__":
    asyncio.run(main())
```

**✅ Done!** Start coding your vehicle app.

---

## Use Case 2: Generate New Library (Default Signals Only)

**When to use:** You want a fresh copy of the standard vehicle library.

### Step 1: Generate Library

```bash
cd /path/to/79_sdv_lib_generator
./sdv-gen.sh --output my_vehicle_lib
```

Or with specific VSS version:
```bash
./sdv-gen.sh --vss-version 4.0 --output my_vehicle_lib
```

### Step 2: Install Dependencies

```bash
cd my_vehicle_lib
pip3 install -r requirements.txt
```

### Step 3: Add to Python Environment

**Temporary:**
```bash
export PYTHONPATH="$(pwd):${PYTHONPATH}"
```

**Permanent:**
```bash
pip3 install -e .
```

### Step 4: Verify

```bash
python3 -c "from vehicle import vehicle; print('✅ New library ready!')"
```

### Step 5: Use It

```python
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle

class MyApp(VehicleApp):
    async def on_start(self):
        # Access any standard vehicle signal
        await vehicle.Body.Lights.Hazard.IsOn.set(True)

app = MyApp(vehicle)
await app.run()
```

**✅ Done!** You have a fresh vehicle library.

---

## Use Case 3: Generate New Library with Custom Signals

**When to use:** You need to add your own custom vehicle signals.

### Step 1: Create Custom Signal File

Create `my_custom_signals.vspec`:

```vspec
Vehicle:
  type: branch
  description: High-level vehicle data

# Custom sensor example
Vehicle.MyCustomTemperature:
  type: sensor
  datatype: float
  description: Custom temperature sensor
  unit: celsius
  min: -40
  max: 120

# Custom actuator example
Vehicle.MyCustomFan:
  type: actuator
  datatype: boolean
  description: Custom fan control

# Custom attribute example
Vehicle.MyCustomConfig:
  type: attribute
  datatype: string
  description: Custom configuration setting
```

### Step 2: Generate Library with Your Custom Signals

```bash
cd /path/to/79_sdv_lib_generator
./sdv-gen.sh --overlay my_custom_signals.vspec --output my_custom_lib
```

With VSS version:
```bash
./sdv-gen.sh --vss-version 4.0 --overlay my_custom_signals.vspec --output my_custom_lib
```

### Step 3: Install Dependencies

```bash
cd my_custom_lib
pip3 install -r requirements.txt
```

### Step 4: Add to Python Environment

**Temporary:**
```bash
export PYTHONPATH="$(pwd):${PYTHONPATH}"
```

**Permanent:**
```bash
pip3 install -e .
```

### Step 5: Verify Custom Signals Exist

```bash
python3 -c "from vehicle import vehicle; print('Has MyCustomTemperature:', hasattr(vehicle, 'MyCustomTemperature'))"
```

Should output: `Has MyCustomTemperature: True`

### Step 6: Use Your Custom Signals

```python
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle

class MyApp(VehicleApp):
    async def on_start(self):
        # Use standard signals
        speed = (await vehicle.Speed.get()).value
        print(f"Speed: {speed}")

        # Use your custom sensor
        temp = (await vehicle.MyCustomTemperature.get()).value
        print(f"Custom temp: {temp}°C")

        # Use your custom actuator
        await vehicle.MyCustomFan.set(True)
        print("Custom fan turned on")

        # Use your custom attribute
        config = (await vehicle.MyCustomConfig.get()).value
        print(f"Config: {config}")

app = MyApp(vehicle)
await app.run()
```

**✅ Done!** Your custom signals are now part of the library.

---

## How to Add to Python Environment (Complete Guide)

### Method 1: PYTHONPATH (Simplest)

**Temporary (current terminal session):**
```bash
export PYTHONPATH="/path/to/library:${PYTHONPATH}"
```

**Permanent (all new sessions):**
```bash
# Add to ~/.bashrc
echo 'export PYTHONPATH="/path/to/library:${PYTHONPATH}"' >> ~/.bashrc
source ~/.bashrc
```

### Method 2: Install as Package (Recommended)

**Editable mode (development):**
```bash
cd /path/to/library
pip3 install -e .
```

**Regular installation:**
```bash
cd /path/to/library
pip3 install .
```

### Method 3: System-Wide Installation

```bash
cd /path/to/library
sudo pip3 install -e .
```

### Method 4: Virtual Environment (Best Practice)

```bash
# Create virtual env
python3 -m venv /path/to/venv

# Activate
source /path/to/venv/bin/activate

# Install library
cd /path/to/library
pip3 install -e .

# Now it's available in this environment
```

### Method 5: Docker

```dockerfile
FROM python:3.10

# Copy generated library
COPY my_vehicle_lib/ /app/vehicle-lib/

# Install dependencies
RUN pip3 install -r /app/vehicle-lib/requirements.txt

# Add to PYTHONPATH
ENV PYTHONPATH="/app/vehicle-lib:${PYTHONPATH}"

# Your app
COPY app.py /app/
WORKDIR /app
CMD ["python3", "app.py"]
```

## Which Method Should I Use?

| Scenario | Recommended Method |
|----------|-------------------|
| Quick testing | PYTHONPATH (temporary) |
| Development | `pip3 install -e .` |
| Production | Virtual environment |
| Deployment | Docker |
| Multiple projects | Virtual environment per project |

## Quick Verification

After adding to Python environment, verify it works:

```bash
python3 << 'EOF'
from vehicle import vehicle
from sdv import VehicleApp
print("✅ Library available!")
print(f"Vehicle class: {vehicle.__class__.__name__}")
print(f"Has Speed signal: {hasattr(vehicle, 'Speed')}")
EOF
```

Expected output:
```
✅ Library available!
Vehicle class: Vehicle
Has Speed signal: True
```

## Troubleshooting

### "ModuleNotFoundError: No module named 'vehicle'"

**Solution:** Add to PYTHONPATH or install as package:
```bash
export PYTHONPATH="/path/to/library:${PYTHONPATH}"
# or
pip3 install -e /path/to/library
```

### "ModuleNotFoundError: No module named 'sdv'"

**Solution:** Same as above, ensure you're in the correct directory.

### Import works but can't connect to Kuksa Data Broker

**Solution:** Start Kuksa Data Broker first:
```bash
docker run -d --name kuksa -p 127.0.0.1:55555:55555 \
  eclipse/kuksa.val:databroker-agl
```

## Summary

| Use Case | Command | Time |
|----------|---------|------|
| **Use existing** | `export PYTHONPATH=".../output:${PYTHONPATH}"` | 10 seconds |
| **Generate default** | `./sdv-gen.sh --output my_lib` | ~4 seconds |
| **Generate custom** | `./sdv-gen.sh --overlay custom.vspec --output my_lib` | ~4 seconds |

All methods work - choose based on your needs!
