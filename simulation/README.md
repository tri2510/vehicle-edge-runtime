# 🚗 Vehicle Edge Runtime Simulation Framework

A Raspberry Pi simulation environment for testing the Vehicle Edge Runtime with support for both native Node.js execution and Docker containerization.

## 📋 Quick Start (Just Follow the Numbers!)

### **Step 0: Start Simulation Container**
```bash
./0-start-pi-ci.sh
```
- Starts the Raspberry Pi simulation container
- Sets up the basic environment

### **Step 1: Install Runtime Dependencies**
```bash
./1-install-runtime.sh
```
- Installs Node.js 18.x and npm
- Sets up the Vehicle Edge Runtime environment
- Copies repository files to the container

### **Step 2: Choose Your Execution Mode**

#### **Option 2a: Docker Mode (Recommended for LazyDocker)**
```bash
./2a-start-docker.sh
```
- ✅ **Visible to LazyDocker** 🐳
- ✅ Production-like deployment
- ✅ Proper container isolation
- ⏳ Slower startup (needs to build images)

#### **Option 2b: Native Mode (Faster for Testing)**
```bash
./2b-start-native.sh
```
- ⚡ **Faster startup**
- ✅ Direct Node.js execution
- ❌ Not visible to LazyDocker
- 🔧 Good for quick testing

### **Step 3: Stop Services (When Done)**

#### **Stop Docker Mode:**
```bash
./3a-stop-docker.sh
```

#### **Stop Native Mode:**
```bash
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

## 🔄 Restart Services

```bash
# Docker mode restart
./2a-start-docker.sh --restart

# Native mode restart
./2b-start-native.sh --restart
```

## 📊 Mode Comparison

| Feature | Docker Mode (2a) | Native Mode (2b) |
|---------|------------------|------------------|
| **LazyDocker Visibility** | ✅ Yes | ❌ No |
| **Startup Speed** | ⏳ Slower | ⚡ Fast |
| **Production-like** | ✅ Yes | ❌ No |
| **Resource Usage** | 💾 Higher | 💾 Lower |
| **Debug Access** | 🔧 Container logs | 🔧 Direct processes |
| **Isolation** | ✅ Container | ❌ Shared |

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
├── 0-start-pi-ci.sh       # Start Raspberry Pi container
├── 1-install-runtime.sh    # Install Node.js and dependencies
├── 2a-start-docker.sh      # Start services in Docker containers
├── 2b-start-native.sh      # Start services as native processes
├── 3a-stop-docker.sh       # Stop Docker services
├── 3b-stop-native.sh       # Stop native services
├── 4-check-status.sh       # Check service status and health
├── pi-dist/               # Raspberry Pi disk images
└── README.md              # This file
```

## 🎯 Best Practices

1. **For Development**: Use **Native mode** (2b) for faster iteration
2. **For Testing**: Use **Docker mode** (2a) for production-like testing
3. **Always Check Status**: Use `./4-check-status.sh` to verify everything is running
4. **Clean Shutdown**: Always use the stop scripts instead of killing containers
5. **Use Sequential**: Follow the 0-1-2-3-4 numbering for best results

## 🔗 Related Documentation

- [Main Repository README](../README.md)
- [Docker Deployment Guide](../DOCKER.md)
- [Installation Guide](../INSTALLATION.md)

---

**Pro Tip**: The numbering system (0-1-2-3-4) is designed to guide you through the entire workflow. Just run them in order! 🎯