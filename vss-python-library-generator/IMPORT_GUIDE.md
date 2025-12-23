# Correct Import Patterns for Vehicle Library

## Common Mistakes

### ❌ WRONG: Importing Vehicle (capital V)

```python
from vehicle import Vehicle, vehicle  # WRONG! Vehicle doesn't exist

class TestApp(VehicleApp):
    def __init__(self, vehicle_client: Vehicle):  # WRONG!
        ...
```

**Error**: `ModuleNotFoundError: No module named 'sdv'` or `ImportError: cannot import name 'Vehicle' from 'vehicle'`

### ✅ CORRECT: Import vehicle (lowercase)

```python
from vehicle import vehicle  # CORRECT

class TestApp(VehicleApp):
    def __init__(self, vehicle_client):  # Just use vehicle_client
        super().__init__()
        self.Vehicle = vehicle_client
```

## Standard Patterns

### Pattern 1: Direct Usage (Without Velocitas SDK)

```python
from vehicle import vehicle

async def main():
    # Read speed
    speed = await vehicle.Speed.get()
    print(f"Speed: {speed.value}")

    # Set lights
    await vehicle.Body.Lights.Beam.Low.IsOn.set(True)
```

### Pattern 2: With Velocitas VehicleApp

```python
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle

class MyApp(VehicleApp):
    def __init__(self, vehicle_client):
        super().__init__()
        self.Vehicle = vehicle_client  # Store for use in methods

    async def on_start(self):
        # Use self.Vehicle
        await self.Vehicle.Speed.subscribe(self.on_speed_changed)

    async def on_speed_changed(self, data):
        print(f"Speed: {data.value}")

# Usage
app = MyApp(vehicle)
```

### Pattern 3: Type Hints (Optional)

If you want type hints, import the vehicle instance type:

```python
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sdv.vehicle import Vehicle  # Only for type checking

class MyApp(VehicleApp):
    def __init__(self, vehicle_client):  # No type hint needed
        super().__init__()
        self.Vehicle = vehicle_client
```

## What's Available in the Vehicle Library

### The `vehicle` Object

The `vehicle` object is the **main entry point** for accessing vehicle signals:

```python
from vehicle import vehicle

# vehicle is an instance of the Vehicle class
# It provides access to all VSS branches:
# - vehicle.Speed
# - vehicle.Body
# - vehicle.Cabin
# - vehicle.Chassis
# - etc.
```

### What You CAN Import

```python
from vehicle import vehicle  # ✅ Main vehicle instance

# Individual signal data types (if needed)
from sdv.vdb.reply import DataPointReply  # ✅ Data types
from sdv.vdb.reply import DataPointError  # ✅ Error types
```

### What You CANNOT Import

```python
from vehicle import Vehicle  # ❌ Class not exported
from vehicle import VehicleClass  # ❌ Doesn't exist
import Vehicle  # ❌ Wrong capitalization
```

## Complete Working Example

```python
import asyncio
import signal
from sdv.vehicle_app import VehicleApp
from vehicle import vehicle

class MyTestApp(VehicleApp):
    """
    Test application that toggles lights
    """

    def __init__(self, vehicle_client):
        super().__init__()
        self.Vehicle = vehicle_client

    async def on_start(self):
        """Called when app starts"""
        print("🚗 Test App Starting...")

        while True:
            try:
                # Turn lights ON
                await self.Vehicle.Body.Lights.Beam.Low.IsOn.set(True)
                await asyncio.sleep(1)

                # Read lights status
                result = await self.Vehicle.Body.Lights.Beam.Low.IsOn.get()
                print(f"💡 Lights ON: {result.value}")

                await asyncio.sleep(2)

                # Turn lights OFF
                await self.Vehicle.Body.Lights.Beam.Low.IsOn.set(False)
                await asyncio.sleep(1)

                # Read lights status
                result = await self.Vehicle.Body.Lights.Beam.Low.IsOn.get()
                print(f"🌙 Lights OFF: {result.value}")

                await asyncio.sleep(2)

            except Exception as e:
                print(f"❌ Error: {e}")
                await asyncio.sleep(5)

async def main():
    app = MyTestApp(vehicle)
    await app.run()

if __name__ == "__main__":
    LOOP = asyncio.get_event_loop()
    LOOP.add_signal_handler(signal.SIGTERM, LOOP.stop)
    LOOP.run_until_complete(main())
    LOOP.close()
```

## Quick Checklist

Before deploying your Python app:

- [ ] Import: `from vehicle import vehicle` (lowercase)
- [ ] Class: `class MyApp(VehicleApp):` (if using SDK)
- [ ] Constructor: `def __init__(self, vehicle_client):` (no type hint)
- [ ] Store: `self.Vehicle = vehicle_client`
- [ ] Use: `await self.Vehicle.Speed.get()` (inside methods)
- [ ] Pass to app: `MyApp(vehicle)` when creating instance

## Troubleshooting

### Error: `ModuleNotFoundError: No module named 'sdv'`

**Cause**: Vehicle library dependencies not installed
**Solution**: This is now automatic - vehicle library dependencies are installed on every deployment

### Error: `ImportError: cannot import name 'Vehicle' from 'vehicle'`

**Cause**: Trying to import `Vehicle` class (capital V)
**Solution**: Change to `from vehicle import vehicle` (lowercase)

### Error: `AttributeError: 'Vehicle' object has no attribute 'Speed'`

**Cause**: Signal path is incorrect
**Solution**: Check VSS spec at `/app/vehicle-lib/vss.json` or use tab completion in IDE

### Error: `TypeError: __init__() missing 1 required positional argument`

**Cause**: Not passing `vehicle` to VehicleApp
**Solution**: Use `app = MyApp(vehicle)` instead of `app = MyApp()`
