# Mock Mode Analysis for Vehicle Edge Runtime

## 🎯 Goal

Add a **mock mode** to vehicle-edge-runtime that allows Python apps (using VSS library) to run with simulated vehicle signals instead of requiring real vehicle data or Kuksa databroker.

## 📊 Current State Analysis

### How vehicle-edge-runtime Works Now

```
Python App Deployment
├── Uses VSS Python Library (pre-generated)
├── Connects to Kuksa databroker (REQUIRED)
├── Gets/sets vehicle signals via Kuksa
└── Environment: PYTHONPATH=/app/vehicle-lib
```

**Key points:**
- ✅ VSS library is pre-generated in `vss-python-library-generator/output/`
- ✅ Library is auto-mounted at `/app/vehicle-lib` in Python containers
- ✅ Apps use: `from vehicle import vehicle`
- ✅ Requires Kuksa databroker to be running
- ❌ No mock/simulation mode available

### How sdv-runtime Mock Service Works

From `/home/htr1hc/01_SDV/76_NEW_autowrx_deployment_extension/sdv-runtime/mock/`:

```
Mock Service Architecture
├── mockservice.py - Main mock service
├── mock.py - Defines mock datapoints
├── signals.json - Initial signal values
└── lib/ - Support libraries
    ├── dsl.py - Domain Specific Language for mocks
    ├── behaviorexecutor.py - Executes mock behaviors
    ├── mockeddatapoint.py - Mock datapoint class
    ├── trigger.py - Event triggers
    └── action.py - Actions (set, animate, etc.)
```

**Mock Service Features:**
1. ✅ Reads signal definitions from JSON file
2. ✅ Subscribes to Kuksa target value changes
3. ✅ Simulates vehicle signal behavior
4. ✅ Can animate values over time
5. ✅ Supports event-driven updates
6. ✅ Runs alongside Kuksa databroker

**Example mock.py:**
```python
for signal in listOfSignals:
    mock_datapoint(
        path=signal["signal"],
        initial_value=signal["value"],
        behaviors=[
            create_behavior(
                trigger=create_event_trigger(EventType.ACTUATOR_TARGET),
                action=create_set_action("$event.value"),
            )
        ],
    )
```

**Example signals.json:**
```json
[
    { "signal": "Vehicle.Speed", "value": 0 },
    { "signal": "Vehicle.Body.Lights.Beam.High.IsOn", "value": false },
    { "signal": "Vehicle.Cabin.Door.Row1.Left.IsOpen", "value": false }
]
```

## 💡 Proposed Solution: Add Mock Mode to vehicle-edge-runtime

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  vehicle-edge-runtime (Main Container)                      │
│                                                              │
│  ┌───────────────────────────────────────────────────┐     │
│  │  Current: VSS Python Library                       │     │
│  │  ├─ vehicle/ (signal classes)                     │     │
│  │  └─ sdv/ (SDK wrappers)                           │     │
│  └───────────────────────────────────────────────────┘     │
│                                                              │
│  ┌───────────────────────────────────────────────────┐     │
│  │  NEW: Mock Service Layer                           │     │
│  │  ├─ mock-service.py (from sdv-runtime)            │     │
│  │  ├─ mock.py (signal definitions)                  │     │
│  │  ├─ signals.json (initial values)                 │     │
│  │  └─ lib/ (support libraries)                      │     │
│  └───────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Two Deployment Modes

#### Mode 1: Normal (Current - Keep as is)

```bash
# Frontend API call
POST /api/applications/deploy
{
    "code": "...",
    "language": "python",
    "mockMode": false  # or omitted
}

# Backend behavior:
# 1. Deploy Python container
# 2. Mount VSS library
# 3. Connect to Kuksa databroker
# 4. App runs with real/simulated data from Kuksa
```

#### Mode 2: Mock Mode (NEW)

```bash
# Frontend API call
POST /api/applications/deploy
{
    "code": "...",
    "language": "python",
    "mockMode": true,
    "mockSignals": {
        "Vehicle.Speed": 0,
        "Vehicle.Body.Lights.Beam.High.IsOn": false
    }
}

# Backend behavior:
# 1. Start Kuksa databroker (if not running)
# 2. Start mock service container
# 3. Deploy Python container
# 4. Mock service populates Kuksa with initial values
# 5. App reads from Kuksa (gets mock data)
# 6. App can set values (mock service reflects them)
```

### Docker Compose Addition

```yaml
# docker-compose.yml - Add mock service

services:
  kuksa-databroker:
    # ... existing config

  mock-service:
    build:
      context: ./services/mock-service
      dockerfile: Dockerfile
    container_name: vehicle-mock-service
    profiles:
      - mock  # Only start with mock mode
    depends_on:
      kuksa-databroker:
        condition: service_healthy
    environment:
      - KUKSA_HOST=kuksa-databroker
      - KUKSA_PORT=55555
      - MOCK_SIGNAL=/app/signals.json
    volumes:
      - ./services/mock-service/signals.json:/app/signals.json:ro
    networks:
      - vehicle-edge-network
```

## 🔧 Implementation Plan

### Phase 1: Copy Mock Service Files

```bash
services/
└── mock-service/
    ├── Dockerfile
    ├── mockservice.py (from sdv-runtime/mock/)
    ├── mock.py (from sdv-runtime/mock/)
    ├── signals.json (default mock signals)
    ├── lib/ (from sdv-runtime/mock/lib/)
    │   ├── dsl.py
    │   ├── behaviorexecutor.py
    │   ├── mockeddatapoint.py
    │   ├── trigger.py
    │   ├── action.py
    │   ├── animator.py
    │   ├── baseservice.py
    │   ├── datapoint.py
    │   ├── loader.py
    │   └── types.py
    └── README.md
```

### Phase 2: Add Mock Service to docker-compose.yml

```yaml
mock-service:
  profiles:
    - mock
  # ... config as above
```

### Phase 3: Update EnhancedApplicationManager.js

```javascript
class EnhancedApplicationManager {
    async deployPythonApp(appData, options = {}) {
        const {
            mockMode = false,
            mockSignals = null
        } = options;

        if (mockMode) {
            // Start mock service
            await this._startMockService(mockSignals);
        }

        // Deploy Python app (existing logic)
        // App will connect to Kuksa (populated by mock service)
    }

    async _startMockService(customSignals = null) {
        // 1. Generate signals.json with custom values
        // 2. Start mock-service container
        // 3. Wait for service to populate Kuksa
    }
}
```

### Phase 4: Add API Endpoint

```javascript
// POST /api/applications/deploy-python-mock
router.post('/applications/deploy-python-mock', async (req, res) => {
    const {
        code,
        mockSignals = {}
    } = req.body;

    // Deploy with mock mode
    const result = await appManager.deployPythonApp(code, {
        mockMode: true,
        mockSignals: mockSignals
    });

    res.json(result);
});
```

## 📝 API Changes

### Current API (Keep as is)

```javascript
POST /api/applications/deploy
{
    "code": "from vehicle import vehicle ...",
    "language": "python"
}

// Result: App deployed, connects to Kuksa
```

### New API: Mock Mode

```javascript
POST /api/applications/deploy
{
    "code": "from vehicle import vehicle ...",
    "language": "python",
    "options": {
        "mockMode": true,
        "mockSignals": {
            "Vehicle.Speed": 100,
            "Vehicle.Body.Lights.Beam.High.IsOn": true,
            "Vehicle.Cabin.Door.Row1.Left.IsOpen": false
        }
    }
}

// Result:
// 1. Kuksa started
// 2. Mock service started
// 3. Mock service populates Kuksa with initial values
// 4. Python app deployed
// 5. App reads mock data from Kuksa
```

## 🎯 Benefits

1. ✅ **No breaking changes** - Existing API and behavior unchanged
2. ✅ **Easy testing** - Test apps without vehicle hardware
3. ✅ **Development friendly** - Quick prototyping
4. ✅ **Staging environment** - Simulated vehicle data
5. ✅ **Flexible** - Custom mock signals per deployment
6. ✅ **Reusable** - Mock service from sdv-runtime (proven)

## 🚀 Use Cases

### Use Case 1: Development/Test
```python
# Deploy app with mock data
POST /api/applications/deploy
{
    "code": "...",
    "options": {
        "mockMode": true,
        "mockSignals": {
            "Vehicle.Speed": 50,  # Mock speed at 50 km/h
            "Vehicle.Body.Lights.Beam.High.IsOn": true
        }
    }
}
```

### Use Case 2: Staging/Production (Current)
```python
# Deploy app normally (uses real Kuksa data)
POST /api/applications/deploy
{
    "code": "..."
    // No mockMode - uses Kuksa as before
}
```

## 📋 Implementation Checklist

- [ ] Copy mock service files from sdv-runtime
- [ ] Create `services/mock-service/` directory
- [ ] Add mock service to docker-compose.yml
- [ ] Update EnhancedApplicationManager.js
- [ ] Add mock mode detection in deploy API
- [ ] Create signals.json generator
- [ ] Test mock service startup
- [ ] Test Python app with mock mode
- [ ] Document mock mode usage
- [ ] Add frontend support (optional)

## 🎉 Summary

**What we're adding:**
- A mock mode service (from sdv-runtime)
- New API option: `options.mockMode = true`
- Customizable mock signals per deployment
- Docker compose profile for mock service

**What we're keeping:**
- Current VSS library integration (unchanged)
- Current deploy API (unchanged)
- Current Python app deployment (unchanged)
- All existing features (unchanged)

**Result:** Developers can choose to deploy apps with mock data for testing, or use real Kuksa data - all through a simple API flag!

---

**Ready to implement?** This plan adds mock functionality while keeping everything working as before.