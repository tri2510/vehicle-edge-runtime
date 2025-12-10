# Enhanced Vehicle Edge Runtime - Final Architecture Goals

## Overview
This document captures the final architectural goals and implementation strategy for enhancing the Vehicle Edge Runtime based on comprehensive analysis of the existing SDV-Runtime patterns and the current Vehicle Edge Runtime implementation.

## Core Architecture Philosophy

### **Host-like Application Experience**
The enhanced Vehicle Edge Runtime should provide a complete host-like application lifecycle experience where:
- Applications feel like they're running directly on a host system
- Full install/deploy/uninstall lifecycle with proper dependency management
- Persistent application state across runtime restarts
- Granular control over application execution (pause/resume/restart)

### **Real-time Software-Defined Vehicle Experience**
True SDV application development requires:
- Real-time bidirectional console I/O streaming
- Immediate feedback from vehicle signal interactions
- Live debugging capabilities with streaming output
- Performance characteristics matching native development

---

## Enhanced Application Lifecycle Management

### **Granular Lifecycle Controls**
Beyond basic start/stop, implement complete lifecycle operations:

```javascript
// Enhanced WebSocket API endpoints
/api/apps/{id}/install     // Full deployment with dependency resolution
/api/apps/{id}/uninstall   // Complete removal with cleanup
/api/apps/{id}/start       // Start application
/api/apps/{id}/stop        // Graceful shutdown
/api/apps/{id}/pause       // Suspend execution (preserve state)
/api/apps/{id}/resume      // Resume from paused state
/api/apps/{id}/restart     // Full restart cycle
```

### **Application State Machine**
```
INSTALLING → INSTALLED → STARTING → RUNNING → PAUSED → STOPPED → UNINSTALLING
     ↑           ↑          ↑          ↑        ↑        ↑           ↑
   └───────────┴──────────┴──────────┴────────┴────────┴───────────┘
                    (graceful transitions, state preservation)
```

### **Application States and Operations**

**INSTALLING State:**
- Download application code/binaries
- Resolve and install Python dependencies
- Generate vehicle signal library
- Setup container environment and storage

**INSTALLED State:**
- Application ready for execution
- Configuration preserved
- Dependencies installed
- Signal library available

**RUNNING State:**
- Active execution with real-time streaming
- Resource monitoring active
- Signal communication established

**PAUSED State:**
- Execution suspended but state preserved
- Container kept alive but processes stopped
- Can resume to exact previous state

---

## Real-time Streaming Architecture

### **Bidirectional Console Streaming**
Following SDV-runtime patterns with enhanced capabilities:

```javascript
// Real-time streaming events
socket.on('app:stdout', (data) => {
    // Real-time stdout from application
    console.log(`[${data.app_id}] ${data.content}`);
});

socket.on('app:stderr', (data) => {
    // Real-time stderr from application
    console.error(`[${data.app_id}] ERROR: ${data.content}`);
});

socket.on('app:status', (data) => {
    // Real-time status updates
    updateAppStatus(data.app_id, data.status);
});

// Bidirectional input support
socket.emit('app:stdin', {
    app_id: 'my_app_001',
    input: 'user_input_here\n'
});
```

### **Enhanced Streaming Features**
- **Buffer Management**: Configurable output buffering during disconnections
- **Multi-app Console**: Separate streams for concurrent applications
- **Log Persistence**: Persistent storage with search capabilities
- **Performance Optimization**: Efficient high-output streaming
- **Searchable History**: Console output indexed and searchable

---

## Application Dependency Management

### **Two-Tier Dependency System**

#### **Tier 1: Python Package Dependencies**
```json
{
  "python_deps": [
    "numpy>=1.20.0",
    "requests>=2.25.0",
    "flask>=2.0.0",
    "asyncio-mqtt>=0.11.0"
  ]
}
```

**Features:**
- Automatic pip installation during app deployment
- Version conflict resolution
- Shared dependency caching for efficiency
- Dependency validation against runtime environment

#### **Tier 2: Vehicle Signal Library (Velocitas-inspired)**
```json
{
  "vehicle_signal_lib": {
    "version": "1.0.0",
    "signals": [
      "Vehicle.Speed",
      "Vehicle.Steering.Angle",
      "Vehicle.Engine.RPM"
    ],
    "auto_generate": true,
    "vss_endpoint": "https://customer.vehicle.server/vss.json"
  }
}
```

**Generated Python SDK:**
```python
# Auto-generated from VSS model
from vehicle_signal_runtime import VehicleApp, VehicleSignal

class MyApp(VehicleApp):
    def __init__(self):
        super().__init__()
        self.speed_signal = VehicleSignal("Vehicle.Speed")
        self.steering_signal = VehicleSignal("Vehicle.Steering.Angle")

    async def on_start(self):
        await self.speed_signal.subscribe(self.on_speed_change)
        await self.steering_signal.subscribe(self.on_steering_change)

    async def on_speed_change(self, data):
        vehicle_speed = data.value
        print(f"Vehicle speed: {vehicle_speed} km/h")
```

### **Dependency Resolution Process**
1. **Parse Dependencies**: Extract Python and vehicle signal dependencies
2. **Resolve Conflicts**: Check for version conflicts and signal access conflicts
3. **Install Python Packages**: pip install with caching
4. **Generate Signal Library**: Create SDK from VSS model
5. **Validate Environment**: Ensure all dependencies available

---

## Application Persistency & State Management

### **SQLite Database Architecture**
Replacing in-memory storage with persistent SQLite database:

```sql
-- Application Registry
CREATE TABLE apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT,
  status TEXT DEFAULT 'installed',
  config JSON,
  python_deps JSON,
  vehicle_signals JSON,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Runtime State Tracking
CREATE TABLE app_runtime_state (
  app_id TEXT PRIMARY KEY,
  container_id TEXT,
  pid INTEGER,
  last_start TIMESTAMP,
  total_runtime INTEGER DEFAULT 0,
  current_state TEXT, -- running, paused, stopped, error
  resources JSON
);

-- Persistent Logs
CREATE TABLE app_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT,
  timestamp TIMESTAMP,
  stream TEXT, -- 'stdout', 'stderr', 'status'
  content TEXT,
  FOREIGN KEY (app_id) REFERENCES apps(id)
);

-- Dependency Registry
CREATE TABLE app_dependencies (
  app_id TEXT,
  dependency_type TEXT, -- 'python' or 'vehicle_signal'
  name TEXT,
  version_spec TEXT,
  resolved_version TEXT,
  FOREIGN KEY (app_id) REFERENCES apps(id)
);
```

### **App Store Experience**
- **Install**: Download dependencies, generate libraries, setup containers
- **Uninstall**: Clean up containers, remove data, cleanup dependencies
- **Update**: Graceful migration of state and configuration
- **Backup/Export**: Package app with its data and configuration

### **Crash Recovery Features**
- Automatic restart on application crash (configurable)
- State restoration from database
- Last known good configuration preservation
- Error logs and diagnostic information

---

## Vehicle Signal Library Management

### **Signal Registry Architecture**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vehicle App   │───▶│  Signal Library  │───▶│ Vehicle Signals │
│                 │    │   (Generated)    │    │   Registry      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Signal Provider│
                       │ (Kuksa/Mock)   │
                       └─────────────────┘
```

### **Centralized Signal Management**
- **Signal Registry**: Central catalog of all vehicle signals
- **Conflict Resolution**: Handle signal access conflicts between applications
- **Version Management**: Signal library versioning and compatibility
- **Type Validation**: Signal data type and access validation

### **Signal Library Generation Process**
1. **Fetch VSS Model**: Retrieve from customer vehicle server
2. **Parse Signal Definitions**: Extract signal metadata and types
3. **Generate Python SDK**: Create type-safe Python library
4. **Validate Access Patterns**: Ensure proper signal usage
5. **Package for Application**: Bundle with application deployment

---

## Lightweight Resource Monitoring

### **Monitoring Metrics**
Collected every 30 seconds (configurable) with minimal performance impact:

```javascript
{
  "app_id": "speed_monitor_001",
  "timestamp": "2025-01-15T10:30:00Z",
  "resources": {
    "cpu_percent": 15.2,
    "memory_rss": "256MB",
    "memory_percent": 12.8,
    "network_bytes_in": 1024576,
    "network_bytes_out": 512288,
    "disk_usage": "45MB",
    "uptime_seconds": 3600
  }
}
```

### **Resource Management Features**
- Per-application resource limits
- Historical resource usage tracking
- Alerting for resource exceeded thresholds
- Automatic resource cleanup on app removal

---

## Implementation Phases

### **Phase 1: Enhanced Lifecycle & Real-time Streaming**
**Priority: High - Core user experience improvements**

**Deliverables:**
- Enhanced lifecycle operations (pause/resume/restart/install/uninstall)
- Bidirectional real-time console streaming
- Basic SQLite persistency for application state
- Lightweight resource monitoring

**Success Criteria:**
- Applications feel like they run on host system
- Real-time streaming works smoothly
- Application state persists across runtime restarts

### **Phase 2: Dependency Management System**
**Priority: High - Complete application development experience**

**Deliverables:**
- Python package dependency resolution
- Vehicle signal library generation and management
- Signal registry and conflict resolution
- Complete install/uninstall app store experience

**Success Criteria:**
- Automatic dependency management works reliably
- Vehicle signal libraries generate correctly from VSS
- Developers can deploy complex applications easily

### **Phase 3: Advanced Features (Future)**
**Priority: Medium - Production readiness**

**Deliverables:**
- C++ binary application support
- Customer vehicle server integration
- Advanced performance optimization
- Multi-runtime orchestration
- Enhanced security and authentication

---

## Technical Architecture Decisions

### **Why SQLite vs File-based Persistence**
- **SQLite Benefits**: ACID compliance, query capabilities, scalability
- **Use Case**: Application registry, logs, and state management
- **Backup**: Easy backup and migration capabilities
- **Performance**: Sufficient for vehicle edge scale

### **Why Generated Vehicle Signal Library vs Direct WebSocket**
- **Developer Experience**: Type-safe Python SDK
- **Performance**: Optimized signal access patterns
- **Validation**: Compile-time signal validation
- **Maintainability**: Centralized signal management

### **Why Container-based vs Process-based Execution**
- **Isolation**: Strong application isolation
- **Dependency Management**: Clean dependency separation
- **Security**: Container security boundaries
- **Portability**: Consistent execution environment

---

## Integration with Existing System

### **Backward Compatibility**
- Existing frontend continues to work with current WebSocket API
- New features added as optional enhancements
- Migration path from current implementation

### **Frontend Integration Points**
- Enhanced application management UI components
- Real-time console display improvements
- Dependency management interface
- Resource monitoring dashboards

### **Kit-Manager Compatibility**
- Maintain existing Kit-Manager integration
- Add new capabilities without breaking changes
- Enhanced runtime registration with capabilities

---

## Success Metrics

### **User Experience Metrics**
- Application deployment time < 10 seconds
- Console streaming latency < 100ms
- Application recovery time < 30 seconds
- Zero-downtime updates for running applications

### **Technical Metrics**
- Resource monitoring overhead < 2% CPU
- Database query response time < 10ms
- Application isolation effectiveness 100%
- Signal library generation time < 5 seconds

### **Developer Experience Metrics**
- Zero-configuration dependency resolution
- Auto-completion for vehicle signals
- Real-time debugging capabilities
- One-click application deployment

---

*This document represents the final architectural goals for the enhanced Vehicle Edge Runtime. Implementation should prioritize Phase 1 features first, with Phase 2 following based on user feedback and technical feasibility.*