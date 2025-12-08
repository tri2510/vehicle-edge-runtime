# 🚗 Vehicle Edge Runtime Simulation Framework

A Raspberry Pi simulation environment for testing the Vehicle Edge Runtime with support for both native Node.js execution and Docker containerization.

## 📋 Quick Start (Just Follow the Numbers!)

### **Step 0: Start Simulation Container**
```bash
./0-start-pi-ci.sh
```
- Starts the Raspberry Pi simulation container
- Sets up the basic environment

### **Step 1a: Start Standalone Kit Manager (NEW - Recommended)**
```bash
./1a-start-kit-manager.sh
```
- 🆕 **NEW**: Runs Kit Manager independently outside simulation container
- ✅ **Better isolation** - Cleaner separation of services
- ✅ **Production-like** - Simulates real deployment architecture
- ✅ **Easier debugging** - Independent service monitoring
- ⚡ **Faster startup** - No nested Docker setup

### **Step 1b: Install Runtime Dependencies**
```bash
./1-install-runtime.sh
```
- Installs Node.js 18.x and npm
- Sets up the Vehicle Edge Runtime environment
- Copies repository files to the container

### **Step 2: Choose Your Execution Mode**

#### **🆕 NEW: External Kit Manager Mode (Recommended)**
```bash
# Docker with External Kit Manager
./2a-start-docker-external.sh

# Native with External Kit Manager
./2b-start-native-external.sh
```
- ✅ **Clean separation** - Kit Manager runs independently
- ✅ **Production-like** - Real deployment simulation
- ✅ **Better monitoring** - Independent service visibility
- ⚡ **Faster debugging** - Isolated service management

#### **Legacy: Internal Kit Manager Mode**
```bash
# Docker Mode (Kit Manager inside container)
./2a-start-docker.sh

# Native Mode (Kit Manager inside container)
./2b-start-native.sh
```
- ⚠️ **Legacy** - Kit Manager runs nested inside simulation
- ❌ **Complex architecture** - Harder to debug and monitor
- ⏳ **Slower setup** - Nested Docker complexity

### **Step 3: Stop Services (When Done)**

#### **External Kit Manager Mode:**
```bash
# Stop Docker Runtime
./3a-stop-docker-external.sh

# Stop Native Runtime
./3b-stop-native-external.sh

# Stop Kit Manager (when done with all runtimes)
./1a-stop-kit-manager.sh
```

#### **Legacy Mode:**
```bash
# Stop Docker Runtime
./3a-stop-docker.sh

# Stop Native Runtime
./3b-stop-native.sh
```

### **Step 4: Check Status (Anytime)**
```bash
./4-check-status.sh
```
- Shows current running mode
- Checks service health
- Displays resource usage
- Provides quick access commands

### **Step 5: Test Multi-Instance Runtime (Optional)**
```bash
./5-start-second-runtime.sh
```
- 🚀 **NEW**: Add second Vehicle Edge Runtime instance
- ✅ **Load balancing** - Multiple runtime instances
- ✅ **Parallel deployment** - Deploy to different runtimes
- ✅ **Independent data** - Separate data directories
- 🎯 **Real-world testing** - Simulate production clusters

## 🔄 Restart Services

```bash
# External Kit Manager mode restart
./2a-start-docker-external.sh --restart
./2b-start-native-external.sh --restart

# Legacy mode restart
./2a-start-docker.sh --restart
./2b-start-native.sh --restart
```

## 📊 Mode Comparison

### **External Kit Manager Architecture (Recommended)**

| Feature | Docker-External (2a) | Native-External (2b) |
|---------|----------------------|----------------------|
| **Service Isolation** | ✅ Excellent | ✅ Excellent |
| **Production Simulation** | ✅ Realistic | ✅ Realistic |
| **Debug Separation** | ✅ Clear | ✅ Clear |
| **Startup Speed** | ⏳ Medium | ⚡ Fast |
| **Resource Usage** | 💾 Medium | 💾 Lower |
| **Monitoring** | ✅ Independent | ✅ Independent |

### **Legacy Internal Architecture**

| Feature | Docker-Internal (2a) | Native-Internal (2b) |
|---------|----------------------|----------------------|
| **LazyDocker Visibility** | ✅ Yes | ❌ No |
| **Service Isolation** | ⚠️ Mixed | ⚠️ Mixed |
| **Production Simulation** | ⚠️ Nested | ⚠️ Nested |
| **Debug Complexity** | ❌ High | ❌ High |
| **Startup Speed** | ⏳ Slow | ⚡ Medium |
| **Resource Usage** | 💾 High | 💾 Medium |

## 🛠️ Advanced Usage

### **Force Stop Services**
```bash
./3a-stop-docker.sh --force
./3b-stop-native.sh --force
```

### **Docker Mode Cleanup**
```bash
./3a-stop-docker.sh --cleanup
```

### **Access Simulation Container**
```bash
docker exec -it vehicle-edge-pi su pi -c bash
```

### **View Logs**

#### **Docker Mode:**
```bash
# Kit Manager logs
docker exec vehicle-edge-pi docker logs kit-manager -f

# Runtime logs
docker exec vehicle-edge-pi docker logs vehicle-edge-runtime -f
```

#### **Native Mode:**
```bash
docker exec vehicle-edge-pi su pi -c 'tail -f /home/pi/vehicle-edge-runtime/workspace/data/logs/*.log'
```

## 🔧 Service Endpoints

Once services are running, access them from **inside** the simulation container:

- **Kit Manager API**: `http://localhost:3090/listAllKits`
- **Runtime Health**: `http://localhost:3003/health`
- **WebSocket API**: `ws://localhost:3002/runtime`

## 🚨 Troubleshooting

### **"Container not running"**
```bash
# Make sure step 0 completed successfully
./0-start-pi-ci.sh
```

### **"Runtime not installed"**
```bash
# Run step 1 again
./1-install-runtime.sh
```

### **Docker build failures**
```bash
# Stop and restart Docker mode
./3a-stop-docker.sh
./2a-start-docker.sh
```

### **Services not responding**
```bash
# Check detailed status
./4-check-status.sh

# Try force restart
./2a-start-docker.sh --restart  # or ./2b-start-native.sh --restart
```

## 📁 Simulation Directory Structure

```
simulation/
├── 0-start-pi-ci.sh           # Start Raspberry Pi container
├── 1a-start-kit-manager.sh    # 🆕 Start standalone Kit Manager
├── 1a-stop-kit-manager.sh     # 🆕 Stop standalone Kit Manager
├── 1-install-runtime.sh       # Install Node.js and dependencies
├── 2a-start-docker-external.sh # 🆕 Docker mode with external Kit Manager
├── 2b-start-native-external.sh # 🆕 Native mode with external Kit Manager
├── 2a-start-docker.sh         # Legacy: Docker mode (internal Kit Manager)
├── 2b-start-native.sh         # Legacy: Native mode (internal Kit Manager)
├── 3a-stop-docker-external.sh  # 🆕 Stop Docker runtime (external Kit Manager)
├── 3b-stop-native-external.sh  # 🆕 Stop Native runtime (external Kit Manager)
├── 3a-stop-docker.sh          # Legacy: Stop Docker services
├── 3b-stop-native.sh          # Legacy: Stop native services
├── 4-check-status.sh          # Check service status and health
├── 5-start-second-runtime.sh  # 🆕 Add second runtime instance
├── pi-dist/                    # Raspberry Pi disk images
└── README.md                   # This file
```

## 🎯 Best Practices

### **🆕 Recommended Workflow (External Kit Manager)**
1. **Start Services**: `./1a-start-kit-manager.sh` → `./0-start-pi-ci.sh` → `./1-install-runtime.sh` → `./2a-start-docker-external.sh` or `./2b-start-native-external.sh`
2. **Add More Runtimes**: `./5-start-second-runtime.sh` (for load balancing)
3. **Monitor**: `./4-check-status.sh` + Kit Manager API
4. **Stop**: Runtime stop scripts → `./1a-stop-kit-manager.sh`

### **📋 Development Guidelines**
- **Use External Kit Manager** for cleaner architecture
- **Docker-External** for production-like testing with proper isolation
- **Native-External** for faster development iteration
- **Multi-instance** testing with `./5-start-second-runtime.sh`
- **Always check status** before adding/removing services
- **Clean shutdown** using provided stop scripts

### **🔧 Legacy vs New Architecture**
- **NEW**: External Kit Manager = Better isolation, monitoring, production simulation
- **LEGACY**: Internal Kit Manager = Nested complexity, harder debugging

### **🎯 Quick Start Sequence**
```bash
# Recommended: External Kit Manager Architecture
./1a-start-kit-manager.sh          # Step 1a: Standalone Kit Manager
./0-start-pi-ci.sh                # Step 0: Simulation container
./1-install-runtime.sh            # Step 1b: Install dependencies
./2a-start-docker-external.sh     # Step 2: Runtime with external Kit Manager
./5-start-second-runtime.sh       # Step 5: Add more instances (optional)
```

## 🔗 Related Documentation

- [Main Repository README](../README.md)
- [Docker Deployment Guide](../DOCKER.md)
- [Installation Guide](../INSTALLATION.md)

---

**Pro Tip**: The numbering system (0-1-2-3-4) is designed to guide you through the entire workflow. Just run them in order! 🎯