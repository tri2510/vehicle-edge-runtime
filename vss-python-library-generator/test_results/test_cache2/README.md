# SDV Vehicle Library

Generated Python vehicle module from VSS specification.

## Installation

### Option 1: Direct PYTHONPATH
```bash
export PYTHONPATH="/path/to/output:${PYTHONPATH}"
```

### Option 2: Install as package
```bash
cd /path/to/output
pip3 install -r requirements.txt
pip3 install -e .
```

### Option 3: Copy to Docker
```dockerfile
COPY output/ /app/vehicle-lib/
RUN pip3 install -r /app/vehicle-lib/requirements.txt
ENV PYTHONPATH="/app/vehicle-lib:${PYTHONPATH}"
```

## Usage

```python
from sdv.vdb.reply import DataPointReply
from sdv.vehicle_app import VehicleApp
from vehicle import Vehicle, vehicle

class MyApp(VehicleApp):
    def __init__(self, vehicle_client: Vehicle):
        super().__init__()
        self.Vehicle = vehicle_client

    async def on_start(self):
        # Read sensor
        value = (await self.Vehicle.Body.Lights.Beam.Low.IsOn.get()).value
        print(f"Light value: {value}")

        # Set actuator
        await self.Vehicle.Body.Lights.Beam.Low.IsOn.set(True)

# Run app
app = MyApp(vehicle)
await app.run()
```

## Environment Variables

- `KUKSA_DATABROKER_ADDR` - Kuksa Data Broker address (default: 127.0.0.1)
- `KUKSA_DATABROKER_PORT` - Kuksa Data Broker port (default: 55555)
