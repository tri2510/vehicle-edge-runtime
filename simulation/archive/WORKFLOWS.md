# Vehicle Edge Runtime Workflows

## Linux Torvalds Style Scripts

**No folders, no complexity. Just run scripts in order.**

---

## 🎯 Quick Workflows

### Simulation Workflow (Inside Container)
```bash
0-start-pi-ci.sh                    # Start simulation container
1a-install-runtime-simulated.sh      # Install simulation dependencies
2a-start-kit-manager-internal.sh      # Kit Manager inside container (Docker)
3a-start-runtime-docker.sh            # Runtime inside container (Docker)
4b-check-status.sh                    # Check status
4c-stop-all.sh                        # Stop everything
```

### Native Development Workflow (Mixed)
```bash
1b-install-runtime-native.sh          # Install native dependencies on host
2a-start-kit-manager-internal.sh      # Kit Manager inside container (Docker)
3b-start-runtime-native.sh            # Runtime inside container (Native process)
4b-check-status.sh                    # Check status
4c-stop-all.sh                        # Stop everything
```

### Production Simulation Workflow (Outside Container)
```bash
1b-install-runtime-native.sh          # Install native dependencies on host
2b-start-kit-manager-external.sh      # Kit Manager outside container (Docker)
3c-start-runtime-external.sh          # Runtime outside container (Docker)
4a-add-runtime-instance.sh            # Add more instances (optional)
4b-check-status.sh                    # Check status
4c-stop-all.sh                        # Stop everything
```

### Maximum Flexibility Workflow (Hybrid)
```bash
0-start-pi-ci.sh                    # Start simulation container
1a-install-runtime-simulated.sh      # Install simulation dependencies
1b-install-runtime-native.sh          # Install native dependencies
2a-start-kit-manager-internal.sh      # Kit Manager inside
3b-start-runtime-native.sh            # Runtime native inside
4a-add-runtime-instance.sh            # Add external runtime instances
4b-check-status.sh                    # Check status
4c-stop-all.sh                        # Stop everything
```

---

## 📋 Script Reference

### Phase 1: Environment Setup
- `0-start-pi-ci.sh` - Start Raspberry Pi simulation container
- `1a-install-runtime-simulated.sh` - Install for simulation (inside container)
- `1b-install-runtime-native.sh` - Install for native runtime (on host)

### Phase 2: Kit Manager
- `2a-start-kit-manager-internal.sh` - Kit Manager Docker inside container
- `2b-start-kit-manager-external.sh` - Kit Manager Docker outside container

### Phase 3: Runtime
- `3a-start-runtime-docker.sh` - Runtime Docker inside container
- `3b-start-runtime-native.sh` - Runtime Native process inside container
- `3c-start-runtime-external.sh` - Runtime Docker outside container

### Phase 4: Management
- `4a-add-runtime-instance.sh` - Add more runtime instances
- `4b-check-status.sh` - Comprehensive status check
- `4c-stop-all.sh` - Stop all services

---

## 🔧 Common Commands

### Check Status
```bash
./4b-check-status.sh
```

### Add More Runtime Instances
```bash
./4a-add-runtime-instance.sh
```

### Stop Everything
```bash
./4c-stop-all.sh
```

### View Logs
```bash
# External containers
docker logs <container-name> -f

# Internal container logs
docker exec vehicle-edge-pi docker logs <internal-container> -f

# Native process logs
docker exec vehicle-edge-pi tail -f /home/pi/vehicle-edge-runtime/workspace/data/logs/*.log
```

---

## 🚀 Getting Started

1. **Choose your workflow** from above
2. **Run scripts in order** (just follow the numbers)
3. **Use management scripts** to monitor and control

**That's it. No folders, no complexity. Just run scripts in order.**