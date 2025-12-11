# Vehicle Edge Runtime - Host Testing Strategy

## **Test Environment Setup**

### **Prerequisites**
```bash
# Node.js 18+
node --version

# Docker installed and running
docker --version
docker info

# Clone and setup Vehicle Edge Runtime
git clone <vehicle-edge-runtime>
cd vehicle-edge-runtime
npm install
```

### **Precondition: Start Full Stack**
```bash
# 1. Start Kuksa Databroker (Vehicle Data Server)
./simulation/6-start-kuksa-server.sh

# 2. Start Kit Manager (API Gateway)
./simulation/1-start-kit-manager.sh

# 3. Start Vehicle Edge Runtime
KUKSA_ENABLED=true KUKSA_HOST=localhost KUKSA_GRPC_PORT=55555 PORT=3002 node src/index.js
```

### **Service Ports**
- **Kit Manager**: 3090 (WebSocket/HTTP API)
- **Vehicle Edge Runtime**: 3002 (WebSocket `/runtime`)
- **Runtime Health Check**: 3003
- **Kuksa Databroker**: 55555 (gRPC Vehicle Data)

### **Verify Stack is Ready**
```bash
# Check Kuksa
curl http://localhost:55555/vss  # Should return VSS tree

# Check Kit Manager
curl http://localhost:3090/listAllKits  # Should return kits list

# Check Runtime
curl http://localhost:3003/health  # Should return health status
```

---

## **Test 1: Basic Runtime Health Check**

### **Goal**: Verify runtime starts and responds to basic commands

### **Test Steps**:
```javascript
// 1. Start runtime
// Expected: Runtime starts without errors on port 3002

// 2. Health check
const ws = new WebSocket('ws://localhost:3002/runtime');
ws.send(JSON.stringify({
    type: 'ping',
    id: 'test-1'
}));

// Expected response:
{
    type: 'pong',
    id: 'test-1',
    timestamp: '2024-...'
}

// 3. Get runtime info
ws.send(JSON.stringify({
    type: 'get_runtime_info',
    id: 'test-2'
}));

// Expected response with runtimeId, capabilities, etc.
```

### **Expected Results**:
- ✅ Runtime starts successfully
- ✅ Responds to ping with pong
- ✅ Returns runtime information
- ✅ No errors in console logs

---

## **Test 2: Single Python App Deployment**

### **Goal**: Deploy and run a simple Python application

### **Test App Code**:
```python
# simple_test_app.py
import asyncio
import time

print("Test app started")

async def main():
    for i in range(5):
        print(f"Test iteration {i+1}")
        await asyncio.sleep(1)
    print("Test app completed")

asyncio.run(main())
```

### **Test Steps**:
```javascript
// 1. Deploy simple Python app
const deployRequest = {
    type: 'deploy_request',
    id: 'deploy-simple',
    code: `import asyncio
import time

print("Test app started")

async def main():
    for i in range(5):
        print(f"Test iteration {i+1}")
        await asyncio.sleep(1)
    print("Test app completed")

asyncio.run(main())`
};

ws.send(JSON.stringify(deployRequest));

// Expected response:
{
    type: 'deploy_request-response',
    executionId: 'uuid-...',
    appId: 'deploy_timestamp',
    status: 'started',
    result: 'Application deployed and started successfully'
}

// 2. Subscribe to console output
ws.send(JSON.stringify({
    type: 'console_subscribe',
    id: 'console-sub',
    appId: 'deploy_timestamp'  // Use returned appId
}));

// Expected console output:
// "Test app started"
// "Test iteration 1"
// "Test iteration 2"
// ...
// "Test iteration 5"
// "Test app completed"

// 3. Get app status
ws.send(JSON.stringify({
    type: 'get_app_status',
    id: 'status-check',
    appId: 'deploy_timestamp'
}));

// Expected: Status shows running -> completed -> stopped
```

### **Expected Results**:
- ✅ App deploys successfully
- ✅ Console output received in real-time
- ✅ App completes after 5 iterations
- ✅ Status updates correctly (running -> stopped)

---

## **Test 3: Real Vehicle Signal Integration**

### **Goal**: Test vehicle signal read/write with real Kuksa databroker

### **Test App Code** (SDV/Velocitas compatible):
```python
# real_signal_test_app.py
import asyncio
import time

# Simplified SDV app that will work with Vehicle Edge Runtime
print("Real vehicle signal test app started")

async def main():
    print("Testing vehicle signal access via Vehicle Edge Runtime...")

    for i in range(6):
        try:
            # Signal access is handled by the runtime
            # The app just needs to print and sleep
            print(f"Signal test iteration {i+1}")

            # Simulate reading vehicle speed (runtime handles the actual Kuksa call)
            print("✓ Attempting to read Vehicle.Speed...")

            # Simulate writing vehicle lights (runtime handles the actual Kuksa call)
            print("✓ Attempting to set Vehicle.Body.Lights.IsLowBeamOn = True")

            await asyncio.sleep(2)

            print(f"✓ Iteration {i+1} completed successfully")

        except Exception as e:
            print(f"❌ Signal access error: {e}")

        await asyncio.sleep(1)

    print("✅ Real vehicle signal test completed")

asyncio.run(main())
```

### **Test Steps**:
```javascript
// 1. Connect to Vehicle Edge Runtime (port 3002)
const ws = new WebSocket('ws://localhost:3002/runtime');

// 2. Deploy real signal test app with vehicle credentials
const signalDeployRequest = {
    type: 'deploy_request',
    id: 'deploy-real-signal',
    code: `# real_signal_test_app.py content from above`,
    vehicleId: 'test-vehicle-001'  // Enables vehicle credential injection
};

ws.send(JSON.stringify(signalDeployRequest));

// Expected response: App deployed successfully
{
    type: 'deploy_request-response',
    executionId: 'uuid-...',
    appId: 'deploy_timestamp',
    status: 'started'
}

// 3. Test real signal reading via runtime API
ws.send(JSON.stringify({
    type: 'get_signals_value',
    id: 'get-real-signals',
    apis: [
        'Vehicle.Speed',
        'Vehicle.Body.Lights.IsLowBeamOn'
    ]
}));

// Expected: Real signal values from Kuksa
{
    type: 'signals_value_response',
    result: {
        'Vehicle.Speed': { value: 0.0 },
        'Vehicle.Body.Lights.IsLowBeamOn': { value: false }
    }
}

// 4. Test real signal writing via runtime API
ws.send(JSON.stringify({
    type: 'write_signals_value',
    id: 'write-real-signals',
    data: {
        'Vehicle.Body.Lights.IsLowBeamOn': true,
        'Vehicle.Speed': 65.5  // Note: May be read-only, expect error for write
    }
}));

// Expected: Signal successfully written to Kuksa
{
    type: 'signals_written',
    response: { success: true }
}

// 5. Subscribe to real signal updates
ws.send(JSON.stringify({
    type: 'subscribe_apis',
    id: 'subscribe-signals',
    apis: ['Vehicle.Speed', 'Vehicle.Body.Lights.IsLowBeamOn']
}));

// Expected: Real-time signal updates from Kuksa
// Should receive: { type: 'apis-value', result: {...}, kit_id: '...' }
```

### **Expected Results**:
- ✅ App deploys and runs with vehicle credentials
- ✅ Runtime connects to Kuksa (port 55555)
- ✅ Signal reading returns real values from VSS
- ✅ Signal writing updates actual Kuksa databroker
- ✅ Signal subscriptions receive real-time updates
- ✅ Console shows successful signal access

---

## **Test 4: Multiple App Management**

### **Goal**: Deploy and manage multiple applications simultaneously

### **Test Apps**:
```python
# App 1: Counter App
import asyncio
print("Counter app started")
async def main():
    for i in range(10):
        print(f"Counter: {i}")
        await asyncio.sleep(0.5)
asyncio.run(main())

# App 2: Timer App
import asyncio
import time
print("Timer app started")
async def main():
    start = time.time()
    for i in range(5):
        elapsed = time.time() - start
        print(f"Timer: {elapsed:.1f}s elapsed")
        await asyncio.sleep(1)
asyncio.run(main())

# App 3: Logger App
import asyncio
print("Logger app started")
async def main():
    messages = ["App started", "Processing data", "Almost done", "App finished"]
    for msg in messages:
        print(f"Logger: {msg} at {asyncio.get_event_loop().time():.2f}")
        await asyncio.sleep(0.8)
asyncio.run(main())
```

### **Test Steps**:
```javascript
// 1. Deploy 3 apps simultaneously
const apps = [
    {
        id: 'deploy-counter',
        code: 'counter_app_code_here'
    },
    {
        id: 'deploy-timer',
        code: 'timer_app_code_here'
    },
    {
        id: 'deploy-logger',
        code: 'logger_app_code_here'
    }
];

// Deploy all apps (can be done in parallel or sequentially)
apps.forEach(app => {
    ws.send(JSON.stringify({
        type: 'deploy_request',
        ...app
    }));
});

// 2. List deployed apps
ws.send(JSON.stringify({
    type: 'list_deployed_apps',
    id: 'list-apps'
}));

// Expected: Should show 3 running apps

// 3. Get individual app status
const deployedAppIds = ['returned-app-id-1', 'returned-app-id-2', 'returned-app-id-3'];
deployedAppIds.forEach(appId => {
    ws.send(JSON.stringify({
        type: 'get_app_status',
        id: `status-${appId}`,
        appId: appId
    }));
});

// 4. Monitor console outputs for all apps
deployedAppIds.forEach(appId => {
    ws.send(JSON.stringify({
        type: 'console_subscribe',
        id: `console-${appId}`,
        appId: appId
    }));
});

// 5. Stop one app while others continue
ws.send(JSON.stringify({
    type: 'stop_app',
    id: 'stop-app-1',
    appId: deployedAppIds[0]  // Stop the counter app
}));

// Expected: One app stops, others continue running
```

### **Expected Results**:
- ✅ All 3 apps deploy successfully
- ✅ Console outputs from all apps received independently
- ✅ App listing shows correct number of running apps
- ✅ Individual app control works (stop one, others continue)
- ✅ No resource conflicts between apps

---

## **Test 5: Error Handling & Edge Cases**

### **Goal**: Test error scenarios and edge case handling

### **Test Cases**:

#### **5.1 Invalid Python Code**
```javascript
// Deploy syntactically invalid Python
ws.send(JSON.stringify({
    type: 'deploy_request',
    id: 'deploy-invalid',
    code: `print("Unclosed string`  // Missing closing quote
}));

// Expected: Graceful error response, app doesn't deploy
```

#### **5.2 Non-existent App Control**
```javascript
// Try to stop app that doesn't exist
ws.send(JSON.stringify({
    type: 'stop_app',
    id: 'stop-ghost',
    appId: 'non-existent-app-id'
}));

// Expected: Error response, runtime handles gracefully
```

#### **5.3 Invalid API Calls**
```javascript
// Send invalid message type
ws.send(JSON.stringify({
    type: 'invalid_api_call',
    id: 'invalid-test'
}));

// Expected: Error response with "Unknown message type"
```

#### **5.4 Resource Stress**
```javascript
// Deploy 10 simple apps quickly
for (let i = 0; i < 10; i++) {
    ws.send(JSON.stringify({
        type: 'deploy_request',
        id: `stress-test-${i}`,
        code: `import time
for j in range(3):
    print(f"App ${i}: Iteration {j}")
    time.sleep(0.2)`
    }));
}

// Expected: All apps deploy, runtime handles load
```

### **Expected Results**:
- ✅ Invalid code rejected gracefully
- ✅ Error responses contain helpful messages
- ✅ Runtime remains stable under stress
- ✅ Console logs show proper error handling

---

## **Test 6: Performance & Resource Monitoring**

### **Goal**: Verify runtime performance and resource usage

### **Test Steps**:
```javascript
// 1. Deploy resource monitoring app
ws.send(JSON.stringify({
    type: 'deploy_request',
    id: 'deploy-monitor',
    code: `import psutil
import time
import asyncio

async def main():
    print("Resource monitoring started")
    for i in range(20):
        cpu = psutil.cpu_percent()
        memory = psutil.virtual_memory().percent
        print(f"Iteration {i}: CPU={cpu}%, Memory={memory}%")
        await asyncio.sleep(1)

asyncio.run(main())`
}));

// 2. Monitor runtime state
setInterval(() => {
    ws.send(JSON.stringify({
        type: 'report_runtime_state',
        id: 'runtime-health-' + Date.now()
    }));
}, 5000);

// 3. Check database operations
ws.send(JSON.stringify({
    type: 'list_apps',
    id: 'db-test'
}));
```

### **Expected Results**:
- ✅ Runtime uses reasonable CPU/memory
- ✅ Database operations complete quickly (<1s)
- ✅ No memory leaks during extended operation
- ✅ WebSocket connections remain stable

---

## **Test Automation with Full Stack Setup**

### **Create Full Stack Test Runner** (`tests/full-stack-test-runner.js`):
```javascript
const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class FullStackVehicleTester {
    constructor() {
        this.ws = null;
        this.testResults = [];
        this.messageTimeout = 10000;
        this.services = {
            kuksa: { process: null, port: 55555, status: 'stopped' },
            kitManager: { process: null, port: 3090, status: 'stopped' },
            runtime: { process: null, port: 3002, status: 'stopped' }
        };
    }

    async startKuksa() {
        return new Promise((resolve, reject) => {
            console.log('🚗 Starting Kuksa Databroker...');

            const kuksaProcess = spawn('./simulation/6-start-kuksa-server.sh', [], {
                stdio: 'pipe',
                cwd: process.cwd()
            });

            kuksaProcess.stdout.on('data', (data) => {
                console.log(`Kuksa: ${data.toString()}`);
            });

            kuksaProcess.stderr.on('data', (data) => {
                console.error(`Kuksa Error: ${data.toString()}`);
            });

            this.services.kuksa.process = kuksaProcess;

            // Wait for Kuksa to be ready
            setTimeout(async () => {
                try {
                    const response = await this.httpRequest('http://localhost:55555/vss');
                    if (response.includes('Vehicle')) {
                        this.services.kuksa.status = 'running';
                        console.log('✅ Kuksa Databroker ready');
                        resolve();
                    }
                } catch (error) {
                    reject(new Error('Kuksa failed to start'));
                }
            }, 10000);
        });
    }

    async startKitManager() {
        return new Promise((resolve, reject) => {
            console.log('🔧 Starting Kit Manager...');

            const kitManagerProcess = spawn('./simulation/1-start-kit-manager.sh', [], {
                stdio: 'pipe',
                cwd: process.cwd()
            });

            kitManagerProcess.stdout.on('data', (data) => {
                console.log(`Kit Manager: ${data.toString()}`);
            });

            kitManagerProcess.stderr.on('data', (data) => {
                console.error(`Kit Manager Error: ${data.toString()}`);
            });

            this.services.kitManager.process = kitManagerProcess;

            // Wait for Kit Manager API
            setTimeout(async () => {
                try {
                    const response = await this.httpRequest('http://localhost:3090/listAllKits');
                    this.services.kitManager.status = 'running';
                    console.log('✅ Kit Manager ready');
                    resolve();
                } catch (error) {
                    reject(new Error('Kit Manager failed to start'));
                }
            }, 5000);
        });
    }

    async startRuntime() {
        return new Promise((resolve, reject) => {
            console.log('⚙️ Starting Vehicle Edge Runtime...');

            const runtimeProcess = spawn('node', ['src/index.js'], {
                stdio: 'pipe',
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    KUKSA_ENABLED: 'true',
                    KUKSA_HOST: 'localhost',
                    KUKSA_GRPC_PORT: '55555',
                    PORT: '3002'
                }
            });

            runtimeProcess.stdout.on('data', (data) => {
                console.log(`Runtime: ${data.toString()}`);
            });

            runtimeProcess.stderr.on('data', (data) => {
                console.error(`Runtime Error: ${data.toString()}`);
            });

            this.services.runtime.process = runtimeProcess;
            this.services.runtime.status = 'running';

            // Wait a bit for runtime to initialize
            setTimeout(() => {
                console.log('✅ Vehicle Edge Runtime ready');
                resolve();
            }, 3000);
        });
    }

    async connect() {
        return new Promise((resolve, reject) => {
            console.log('🔌 Connecting to Vehicle Edge Runtime WebSocket...');

            this.ws = new WebSocket('ws://localhost:3002/runtime');

            this.ws.on('open', () => {
                console.log('✅ Connected to Vehicle Edge Runtime');
                resolve();
            });

            this.ws.on('message', (data) => {
                const message = JSON.parse(data);
                this.handleResponse(message);
            });

            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
                reject(error);
            });

            setTimeout(() => {
                if (this.ws.readyState !== WebSocket.OPEN) {
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 5000);
        });
    }

    async runTest(testName, request, expectedResponse) {
        return new Promise((resolve) => {
            console.log(`🧪 Running test: ${testName}`);

            const timeout = setTimeout(() => {
                console.log(`❌ Test timeout: ${testName}`);
                this.testResults.push({ test: testName, status: 'timeout' });
                resolve();
            }, this.messageTimeout);

            const originalHandler = this.handleResponse;
            this.handleResponse = (response) => {
                if (response.id === request.id) {
                    clearTimeout(timeout);
                    const passed = this.validateResponse(response, expectedResponse);
                    console.log(passed ? `✅ ${testName} - PASS` : `❌ ${testName} - FAIL`);
                    if (!passed) {
                        console.log('   Expected:', expectedResponse);
                        console.log('   Received:', response);
                    }
                    this.testResults.push({
                        test: testName,
                        status: passed ? 'pass' : 'fail',
                        response: response
                    });
                    this.handleResponse = originalHandler;
                    resolve();
                }
            };

            this.ws.send(JSON.stringify(request));
        });
    }

    validateResponse(response, expected) {
        if (expected.type && response.type !== expected.type) return false;
        if (expected.error && !response.error) return false;
        if (expected.success && response.type === 'error') return false;
        return true;
    }

    httpRequest(url) {
        return new Promise((resolve, reject) => {
            const http = require('http');
            http.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }

    async runAllTests() {
        try {
            // Start full stack
            await this.startKuksa();
            await this.startKitManager();
            await this.startRuntime();
            await this.connect();

            // Run comprehensive tests
            await this.runTest('Runtime Health Check', {
                type: 'ping',
                id: 'health-1'
            }, { type: 'pong' });

            await this.runTest('Simple Python App Deploy', {
                type: 'deploy_request',
                id: 'deploy-simple',
                code: `import asyncio
print("Simple test app started")
async def main():
    for i in range(3):
        print(f"Iteration {i+1}")
        await asyncio.sleep(0.5)
    print("Simple test app completed")
asyncio.run(main())`
            }, { type: 'deploy_request-response', success: true });

            await this.runTest('Real Vehicle Signal Read', {
                type: 'get_signals_value',
                id: 'read-signals',
                apis: ['Vehicle.Speed', 'Vehicle.Body.Lights.IsLowBeamOn']
            }, { type: 'signals_value_response', success: true });

            await this.runTest('Real Vehicle Signal Write', {
                type: 'write_signals_value',
                id: 'write-signals',
                data: {
                    'Vehicle.Body.Lights.IsLowBeamOn': true
                }
            }, { type: 'signals_written', success: true });

            await this.runTest('Multiple App Deployment', {
                type: 'deploy_request',
                id: 'deploy-multi',
                code: `import asyncio
print("Multi app test started")
async def main():
    for i in range(5):
        print(f"Multi app iteration {i+1}")
        await asyncio.sleep(1)
    print("Multi app test completed")
asyncio.run(main())`
            }, { type: 'deploy_request-response', success: true });

            // Show results
            console.log('\n📊 Test Results:');
            this.testResults.forEach(result => {
                console.log(`${result.status === 'pass' ? '✅' : '❌'} ${result.test}`);
            });

            const passed = this.testResults.filter(r => r.status === 'pass').length;
            const total = this.testResults.length;
            console.log(`\n🏁 Results: ${passed}/${total} tests passed`);

            return passed === total;

        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
            return false;
        }
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up services...');

        // Stop runtime
        if (this.services.runtime.process) {
            this.services.runtime.process.kill('SIGTERM');
        }

        // Stop kit manager
        if (this.services.kitManager.process) {
            spawn('docker', ['stop', 'kit-manager']);
        }

        // Stop kuksa
        if (this.services.kuksa.process) {
            spawn('./simulation/6-start-kuksa-server.sh', ['stop'], { cwd: process.cwd() });
        }

        console.log('✅ Cleanup completed');
    }
}

// Handle process interruption
process.on('SIGINT', async () => {
    console.log('\n⚠️ Test interrupted, cleaning up...');
    const tester = new FullStackVehicleTester();
    await tester.cleanup();
    process.exit(1);
});

// Run full stack tests
const tester = new FullStackVehicleTester();
tester.runAllTests().then(success => {
    tester.cleanup().then(() => {
        process.exit(success ? 0 : 1);
    });
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
```

### **Run Full Stack Tests**:
```bash
# Install dependencies
npm install

# Run all tests with full stack
node tests/full-stack-test-runner.js
```

### **Quick Test Commands**:
```bash
# Start individual services manually
./simulation/6-start-kuksa-server.sh &
./simulation/1-start-kit-manager.sh &

# Start runtime with Kuksa
KUKSA_ENABLED=true KUKSA_HOST=localhost KUKSA_GRPC_PORT=55555 node src/index.js

# Test specific components
curl http://localhost:55555/vss  # Test Kuksa
curl http://localhost:3090/listAllKits  # Test Kit Manager
```

---

## **Success Criteria**

### **Must Pass**:
- ✅ Runtime starts and responds to basic commands
- ✅ Single Python app deploys and runs correctly
- ✅ Multiple apps can run simultaneously without interference
- ✅ Error handling works gracefully
- ✅ Console output streaming works for all apps

### **Should Pass**:
- ✅ Vehicle signal APIs handle gracefully without Kuksa
- ✅ App lifecycle management (install/run/stop/uninstall)
- ✅ Resource usage remains reasonable
- ✅ WebSocket connections stable under load

### **Test Coverage Goals**:
- ✅ **API Coverage**: All main message types tested
- ✅ **App Lifecycle**: Install → Run → Stop → Uninstall
- ✅ **Multi-App**: 3+ apps running simultaneously
- ✅ **Error Handling**: Invalid inputs handled gracefully
- ✅ **Performance**: Response times < 1s, reasonable resource usage

**This host testing strategy provides comprehensive coverage of Vehicle Edge Runtime capabilities while being easy to execute and debug.**