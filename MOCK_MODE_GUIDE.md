# Mock Mode - Quick Start Guide

## 🎯 What is Mock Mode?

Mock mode allows Python apps (using VSS library) to run with **simulated vehicle data** instead of requiring real vehicle hardware or live Kuksa data.

Perfect for:
- ✅ Testing apps without vehicle hardware
- ✅ Development and prototyping
- ✅ CI/CD pipelines
- ✅ Staging environments

## 🚀 Quick Start

### Option 1: Deploy Mock Service Standalone

```bash
# Deploy with mock service
./scripts/deploy.sh deploy mock
```

This starts:
- Vehicle Edge Runtime
- Kuksa databroker
- Mock Service (provides simulated vehicle data)

### Option 2: Use Custom Mock Signals

```bash
# Generate custom signals
node scripts/generate-signals.js '{"Vehicle.Speed": 100, "Vehicle.Body.Lights.Beam.High.IsOn": true}'

# Then deploy with mock
./scripts/deploy.sh deploy mock
```

## 📝 Using Mock Mode with Python Apps

### Deploy Python App (Backend API)

```javascript
// Standard deployment - uses real Kuksa data (or whatever Kuksa has)
POST /api/applications/deploy
{
    "code": "from vehicle import vehicle ...",
    "language": "python"
    // No mockMode specified
}
```

The mock service will provide data to Kuksa, and the Python app will read from Kuksa as normal.

### How It Works

```
┌─────────────────────────────────────────────────┐
│  Mock Service Container                          │
│  ├─ Reads signals.json                          │
│  ├─ Connects to Kuksa                           │
│  └─ Populates Kuksa with initial values          │
└─────────────────────────────────────────────────┘
                    │ feeds data
                    ▼
┌─────────────────────────────────────────────────┐
│  Kuksa Databroker                               │
│  ├─ Vehicle.Speed = 0 (from mock service)      │
│  ├─ Vehicle.Body.Lights.* = false              │
│  └─ All other signals as defined               │
└─────────────────────────────────────────────────┘
                    │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Python App 1 │ │ Python App 2 │ │ Python App 3 │
│ (reads from  │ │ (reads from  │ │ (reads from  │
│   Kuksa)     │ │   Kuksa)     │ │   Kuksa)     │
└──────────────┘ └──────────────┘ └──────────────┘
```

## 🔧 Customizing Mock Signals

### Edit signals.json Directly

```bash
nano services/mock-service/signals.json
```

Add or modify signals:
```json
[
    {
        "signal": "Vehicle.Speed",
        "value": "100"
    },
    {
        "signal": "Vehicle.Body.Lights.Beam.Low.IsOn",
        "value": "true"
    },
    {
        "signal": "Vehicle.Cabin.Door.Row1.Left.IsOpen",
        "value": "false"
    }
]
```

Restart mock service:
```bash
docker-compose restart mock-service
```

### Using the Generator Script

```bash
# Generate with custom signals
node scripts/generate-signals.js '{
    "Vehicle.Speed": 50,
    "Vehicle.Body.Lights.Beam.High.IsOn": true,
    "Vehicle.Cabin.HVAC.Station.Row1.Left.FanSpeed": 3
}'

# Output: ✅ Generated signals.json with 12 signals
```

## 📊 Available Mock Signals

Default mock signals include:

| Signal Path | Type | Default Value |
|-------------|------|---------------|
| Vehicle.Speed | sensor | 0 |
| Vehicle.Body.Hood.IsOpen | actuator | false |
| Vehicle.Cabin.HVAC.Station.Row1.Left.FanSpeed | actuator | 0 |
| Vehicle.ADAS.CruiseControl.SpeedSet | actuator | 0 |
| Vehicle.Cabin.Door.Row1.Left.IsOpen | sensor/actuator | false |
| Vehicle.Cabin.Door.Row1.Right.IsOpen | sensor/actuator | false |
| Vehicle.Body.Lights.Beam.High.IsOn | actuator | false |
| Vehicle.Body.Trunk.Rear.IsOpen | sensor/actuator | false |
| Vehicle.Cabin.Seat.Row1.Pos1.Position | actuator | 0 |

You can add ANY VSS signal to signals.json!

## 🧪 Testing with Mock Mode

### Example Python App

```python
from sdv import VehicleApp
from vehicle import vehicle

class TestApp(VehicleApp):
    async def on_start(self):
        # Read mock data
        speed = await self.Vehicle.Speed.get()
        print(f"Mock speed: {speed.value} km/h")  # Output: 0

        # Read light status
        lights = await self.Vehicle.Body.Lights.Beam.High.IsOn.get()
        print(f"Lights on: {lights.value}")  # Output: False

        # Set a value (mock service will reflect it)
        await self.Vehicle.Speed.set(50)

        # Read back the set value
        new_speed = await self.Vehicle.Speed.get()
        print(f"New speed: {new_speed.value}")  # Output: 50

app = TestApp(vehicle)
await app.run()
```

The app doesn't know it's using mock data - it just works normally!

## 🎯 Benefits

1. ✅ **No vehicle hardware needed** - Test without actual vehicle
2. ✅ **Consistent test data** - Same values every time
3. ✅ **Fast testing** - No waiting for real vehicle data
4. ✅ **CI/CD friendly** - Automated testing
5. ✅ **Development** - Quick prototyping
6. ✅ **Transparent to apps** - Apps work exactly the same

## 🔍 Troubleshooting

### Mock Service Not Starting

```bash
# Check logs
docker logs vehicle-mock-service

# Verify Kuksa is running
curl http://localhost:55555
```

### Python App Can't Read Data

```bash
# Check VSS library is mounted
docker exec <python-container> ls /app/vehicle-lib

# Check Kuksa connection
docker exec <python-container> env | grep KUKSA

# Check mock service is feeding data
docker logs vehicle-mock-service | grep "Feeding"
```

### Wrong Signal Values

```bash
# Verify signals.json
cat services/mock-service/signals.json

# Regenerate if needed
node scripts/generate-signals.js '{"Vehicle.Speed": 0}'
```

## 🚀 Next Steps

1. ✅ Deploy mock service: `./scripts/deploy.sh deploy mock`
2. ✅ Verify it's running: `docker ps | grep mock`
3. ✅ Check logs: `docker logs vehicle-mock-service`
4. ✅ Deploy your Python app (uses VSS library)
5. ✅ App reads mock data from Kuksa

## 📚 Related Documentation

- `MOCK_MODE_ANALYSIS.md` - Full analysis and design
- `VSS_LIBRARY_INTEGRATION.md` - VSS library usage
- `services/mock-service/README.md` - Mock service details
- `services/vehicle_interface/README.md` - Vehicle Interface Service (echo mode)

---

**Note:** Mock mode is **completely optional**. Existing functionality works exactly as before. Mock mode just adds another way to test apps!