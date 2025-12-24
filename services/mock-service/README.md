# Mock Service

Vehicle signal mock service for testing and development of Python apps using VSS library.

## 🎯 Purpose

Provides simulated vehicle signal data to Kuksa databroker, allowing Python apps to run without actual vehicle hardware.

## 🚀 Quick Start

### Option 1: Start Mock Service Manually

```bash
# Build and start mock service with Kuksa
docker-compose --profile local-kuksa --profile mock up -d
```

### Option 2: Start via Deploy Script

```bash
# Deploy with mock mode enabled
./scripts/deploy.sh deploy mock
```

## 📝 How It Works

```
1. Mock Service starts
2. Reads signals from signals.json
3. Connects to Kuksa databroker
4. Populates Kuksa with initial values
5. Subscribes to actuator target changes
6. Reflects changes to current values
```

## 🔧 Configuration

### signals.json

Defines mock vehicle signals and their initial values:

```json
[
    {
        "signal": "Vehicle.Speed",
        "value": 0
    },
    {
        "signal": "Vehicle.Body.Lights.Beam.High.IsOn",
        "value": false
    }
]
```

### Environment Variables

- `KUKSA_HOST` - Kuksa databroker host (default: kuksa-databroker)
- `KUKSA_PORT` - Kuksa databroker port (default: 55555)
- `MOCK_SIGNAL` - Path to signals.json file
- `MOCK_IDLE_THRESHOLD` - Idle threshold in seconds (default: 30.0)
- `MOCK_BASE_SLEEP` - Active mode sleep duration (default: 0.1)
- `MOCK_IDLE_SLEEP` - Idle mode sleep duration (default: 1.0)

## 📊 Default Mock Signals

The service includes these default signals:
- Vehicle.Speed
- Vehicle.Body.Hood.IsOpen
- Vehicle.Cabin.HVAC.Station.Row1.Left.FanSpeed
- Vehicle.ADAS.CruiseControl.SpeedSet
- Vehicle.Cabin.Door.Row1.Left.IsOpen
- Vehicle.Cabin.Door.Row1.Right.IsOpen
- Vehicle.Body.Lights.Beam.High.IsOn
- Vehicle.Body.Trunk.Rear.IsOpen
- Vehicle.Cabin.Seat.Row1.Pos1.Position

## 🎨 Usage with Python Apps

### Deploy Python App with Mock Mode

```javascript
// Via API
POST /api/applications/deploy
{
    "code": "from vehicle import vehicle ...",
    "language": "python",
    "options": {
        "mockMode": true,
        "mockSignals": {
            "Vehicle.Speed": 100,
            "Vehicle.Body.Lights.Beam.High.IsOn": true
        }
    }
}
```

The app will:
1. Connect to Kuksa (populated by mock service)
2. Read initial values from mock service
3. Can set values (mock service reflects them)
4. Works exactly like real vehicle data

## 📚 Files

- `mockservice.py` - Main mock service implementation
- `mock.py` - Signal definitions using DSL
- `signals.json` - Initial signal values
- `lib/` - Support libraries for mock functionality
- `Dockerfile` - Container definition
- `requirements.txt` - Python dependencies

## 🔍 Troubleshooting

### Mock service not populating Kuksa

**Check logs:**
```bash
docker logs vehicle-mock-service
```

**Verify Kuksa is running:**
```bash
curl http://localhost:55555
```

### Python app can't read mock data

**Verify VSS library is mounted:**
```bash
docker exec <python-app-container> ls /app/vehicle-lib
```

**Check Kuksa connection:**
```bash
docker exec <python-app-container> env | grep KUKSA
```

## 🚧 Custom Mock Signals

To add custom signals, edit `signals.json`:

```bash
nano services/mock-service/signals.json
```

Then restart mock service:
```bash
docker-compose restart mock-service
```

## 📖 Related Documentation

- `MOCK_MODE_ANALYSIS.md` - Full analysis and design
- `VSS_LIBRARY_INTEGRATION.md` - VSS library integration
- `services/vehicle_interface/README.md` - Vehicle Interface Service (echo mode)

---

**Note:** This mock service is from sdv-runtime and provides proven, tested mock functionality for vehicle signal simulation.