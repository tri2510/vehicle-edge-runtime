# Vehicle Edge Runtime - Simple Docker Workflow

A simplified workflow for running Vehicle Edge Runtime services directly on the host using Docker, replacing the complex pi-ci simulation.

## Quick Start

1. **Start Kit Manager:**
   ```bash
   ./1-start-kit-manager.sh
   ```

2. **Start Runtime (can be run multiple times):**
   ```bash
   ./2-start-runtime.sh
   ```

3. **Check Status:**
   ```bash
   ./3-check-status.sh
   ```

## Workflow Scripts

| Script | Purpose | Description |
|--------|---------|-------------|
| `1-start-kit-manager.sh` | Start Kit Manager | Starts the Kit Manager service on port 3090 |
| `2-start-runtime.sh` | Start Runtime | Starts a Runtime instance with unique ID and ports |
| `3-check-status.sh` | Check Status | Shows status of all services and runtime instances |
| `4-stop-runtime.sh [ID]` | Stop Runtime | Stops specific runtime instance or all if no ID |
| `5-stop-all.sh` | Stop All | Stops all services (Kit Manager + all runtimes) |

## Features

### Multiple Runtime Instances
- Each runtime gets a unique letter ID based on timestamp: `vehicle-edge-runtimeabc`, `vehicle-edge-runtimedef`, etc.
- Automatic port assignment to avoid conflicts:
  - WebSocket: 3002, 3004, 3006, ...
  - Health: 3003, 3005, 3007, ...
- All instances connect to the same Kit Manager

### Networking
- All containers use `vehicle-edge-network` for internal communication
- Kit Manager accessible at `http://localhost:3090/listAllKits`
- Each runtime instance has unique WebSocket and health endpoints

## Examples

### Starting Multiple Runtimes
```bash
# Start Kit Manager once
./1-start-kit-manager.sh

# Start multiple runtime instances (each gets unique letter ID)
./2-start-runtime.sh  # Runtime abc (ports 3002/3003)
./2-start-runtime.sh  # Runtime def (ports 3004/3005)
./2-start-runtime.sh  # Runtime ghi (ports 3006/3007)
```

### Stopping Services
```bash
# Stop specific runtime instance (using letter ID)
./4-stop-runtime.sh abc

# Stop all runtime instances
./4-stop-runtime.sh

# Stop everything (Kit Manager + all runtimes)
./5-stop-all.sh
```

### Checking Status
```bash
./3-check-status.sh
```

Output shows:
- All running containers with ports
- Kit Manager API status
- Individual runtime health endpoints
- Network connectivity

## Access Points

After starting services:

- **Kit Manager API**: `http://localhost:3090/listAllKits`
- **Runtime WebSocket**: `ws://localhost:3002/runtime` (or 3004, 3006, ...)
- **Runtime Health**: `http://localhost:3003/health` (or 3005, 3007, ...)

## Requirements

- Docker installed and running
- `kit-manager:sim` and `vehicle-edge-runtime:sim` Docker images built
- `jq` for JSON parsing in status script

## Archive

The original pi-ci simulation scripts are archived in the `archive/` folder for reference.