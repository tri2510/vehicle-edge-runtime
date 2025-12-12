import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'node:http';

describe('End-to-End Vehicle Application Lifecycle Tests', () => {
    const WS_PORT = 3004;
    const HEALTH_PORT = 3005;
    const TEST_TIMEOUT = 60000; // 60 seconds for E2E tests

    let runtimeProcess;
    let ws;
    const deployedApps = [];

    // Test vehicle applications
    const testApps = {
        simpleCounter: {
            name: 'Simple Counter',
            code: `import asyncio
import time

class SimpleCounterApp:
    def __init__(self):
        self.counter = 0
        self.max_iterations = 10

    async def run(self):
        print("🚀 Simple Counter App started")
        print(f"📊 Will count from 0 to {self.max_iterations - 1}")

        for i in range(self.max_iterations):
            self.counter = i
            print(f"🔢 Count: {i+1}/{self.max_iterations}")
            await asyncio.sleep(0.5)

        print(f"✅ Simple Counter App completed. Final count: {self.counter + 1}")

async def main():
    app = SimpleCounterApp()
    await app.run()

if __name__ == "__main__":
    asyncio.run(main())`
        },
        vehicleSignalSimulator: {
            name: 'Vehicle Signal Simulator',
            code: `import asyncio
import time
import json
import random

class VehicleSignalSimulator:
    def __init__(self):
        self.signals = {
            'Vehicle.Speed': 0.0,
            'Vehicle.Body.Lights.IsLowBeamOn': False,
            'Vehicle.Body.Lights.IsHighBeamOn': False,
            'Vehicle.Powertrain.Transmission.CurrentGear': 1,
            'Vehicle.ADAS.ABS.IsActive': False
        }
        self.iterations = 15

    async def run(self):
        print("🚗 Vehicle Signal Simulator started")
        print("📡 Simulating vehicle sensor data...")

        for i in range(self.iterations):
            # Simulate vehicle dynamics
            self.signals['Vehicle.Speed'] = min(120.0, max(0.0, self.signals['Vehicle.Speed'] + random.uniform(-10, 15)))

            # Simulate gear changes based on speed
            if self.signals['Vehicle.Speed'] > 80:
                self.signals['Vehicle.Powertrain.Transmission.CurrentGear'] = 5
            elif self.signals['Vehicle.Speed'] > 60:
                self.signals['Vehicle.Powertrain.Transmission.CurrentGear'] = 4
            elif self.signals['Vehicle.Speed'] > 40:
                self.signals['Vehicle.Powertrain.Transmission.CurrentGear'] = 3
            elif self.signals['Vehicle.Speed'] > 20:
                self.signals['Vehicle.Powertrain.Transmission.CurrentGear'] = 2
            else:
                self.signals['Vehicle.Powertrain.Transmission.CurrentGear'] = 1

            # Simulate light controls
            if i > 5 and i < 12:
                self.signals['Vehicle.Body.Lights.IsLowBeamOn'] = True
            if i > 8 and i < 10:
                self.signals['Vehicle.Body.Lights.IsHighBeamOn'] = True
            elif i >= 10:
                self.signals['Vehicle.Body.Lights.IsHighBeamOn'] = False

            # Simulate ABS activation
            if self.signals['Vehicle.Speed'] > 80 and random.random() > 0.7:
                self.signals['Vehicle.ADAS.ABS.IsActive'] = True
            else:
                self.signals['Vehicle.ADAS.ABS.IsActive'] = False

            print(f"🚗 Iteration {i+1}/{self.iterations}")
            print(f"   Speed: {self.signals['Vehicle.Speed']:.1f} km/h")
            print(f"   Gear: {self.signals['Vehicle.Powertrain.Transmission.CurrentGear']}")
            print(f"   Low Beam: {self.signals['Vehicle.Body.Lights.IsLowBeamOn']}")
            print(f"   High Beam: {self.signals['Vehicle.Body.Lights.IsHighBeamOn']}")
            print(f"   ABS: {self.signals['Vehicle.ADAS.ABS.IsActive']}")

            await asyncio.sleep(0.8)

        print("✅ Vehicle Signal Simulator completed")
        print("📊 Final signal states:")
        for signal, value in self.signals.items():
            print(f"   {signal}: {value}")

async def main():
    simulator = VehicleSignalSimulator()
    await simulator.run()

if __name__ == "__main__":
    asyncio.run(main())`
        },
        dataProcessor: {
            name: 'Data Processor',
            code: `import asyncio
import json
import time
from datetime import datetime

class DataProcessor:
    def __init__(self):
        self.processed_items = 0
        self.batches = 3
        self.items_per_batch = 5

    async def process_batch(self, batch_num):
        print(f"📊 Processing batch {batch_num}/{self.batches}")

        for i in range(self.items_per_batch):
            # Simulate data processing
            data_item = {
                'timestamp': datetime.now().isoformat(),
                'batch': batch_num,
                'item': i + 1,
                'value': random.random() * 100,
                'processed': True
            }

            print(f"   🔄 Processing item {i+1}/{self.items_per_batch}: {data_item['value']:.2f}")
            self.processed_items += 1

            # Simulate processing time
            await asyncio.sleep(0.3)

        print(f"✅ Batch {batch_num} completed")

    async def run(self):
        print("🔧 Data Processor started")
        print(f"📋 Will process {self.batches} batches with {self.items_per_batch} items each")

        start_time = time.time()

        for batch_num in range(1, self.batches + 1):
            await self.process_batch(batch_num)
            print(f"⏸️ Short pause between batches...")
            await asyncio.sleep(0.5)

        end_time = time.time()
        processing_time = end_time - start_time

        print(f"✅ Data Processor completed")
        print(f"📈 Total processed items: {self.processed_items}")
        print(f"⏱️ Total processing time: {processing_time:.2f} seconds")
        print(f"📊 Average processing rate: {self.processed_items/processing_time:.2f} items/second")

async def main():
    processor = DataProcessor()
    await processor.run()

if __name__ == "__main__":
    asyncio.run(main())`
        }
    };

    // Helper function to wait for service
    async function waitForService(port, timeoutMs = 30000) {
        const startTime = Date.now();
        // http is already imported

        while (Date.now() - startTime < timeoutMs) {
            try {
                await new Promise((resolve, reject) => {
                    const req = http.get(`http://localhost:${port}/health`, (res) => {
                        resolve(res.statusCode === 200);
                    });
                    req.on('error', reject);
                    req.setTimeout(2000, reject);
                });
                return true;
            } catch (error) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        throw new Error(`Service on port ${port} not ready within ${timeoutMs}ms`);
    }

    // Helper function to connect WebSocket
    async function connectWebSocket(timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${WS_PORT}/runtime`);

            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, timeoutMs);

            ws.on('open', () => {
                clearTimeout(timeout);
                resolve(ws);
            });

            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    // Helper function to send message and wait for response
    async function sendMessage(ws, message, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Message response timeout'));
            }, timeoutMs);

            const messageHandler = (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === message.id) {
                        clearTimeout(timeout);
                        ws.removeListener('message', messageHandler);
                        resolve(response);
                    }
                } catch (error) {
                    // Ignore malformed responses
                }
            };

            ws.on('message', messageHandler);

            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            } else {
                clearTimeout(timeout);
                ws.removeListener('message', messageHandler);
                reject(new Error('WebSocket not open'));
            }
        });
    }

    before(async () => {
        console.log('🚀 Starting Vehicle Edge Runtime for E2E tests...');

        // Ensure test data directory exists
        const testDataDir = './test-data-e2e';
        if (!fs.existsSync(testDataDir)) {
            fs.mkdirSync(testDataDir, { recursive: true });
        }

        runtimeProcess = spawn('node', ['src/index.js'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: process.cwd(),
            env: {
                ...process.env,
                PORT: WS_PORT.toString(),
                HEALTH_PORT: HEALTH_PORT.toString(),
                KUKSA_ENABLED: 'true', // MANDATORY Kuksa integration
                KUKSA_HOST: 'localhost',
                KUKSA_GRPC_PORT: '55555',
                DATA_DIR: testDataDir
            }
        });

        runtimeProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output.includes('ERROR') || output.includes('Exception')) {
                console.error(`Runtime Error: ${output}`);
            }
        });

        runtimeProcess.stderr.on('data', (data) => {
            console.error(`Runtime Stderr: ${data.toString().trim()}`);
        });

        await waitForService(HEALTH_PORT, 45000);
        console.log('✅ Runtime ready for E2E testing');
    });

    after(async () => {
        if (ws) {
            ws.close();
        }

        if (runtimeProcess) {
            console.log('🛑 Stopping runtime...');
            runtimeProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 3000));

            if (runtimeProcess.kill) {
                runtimeProcess.kill('SIGKILL');
            }
        }

        // Cleanup test data
        try {
            if (fs.existsSync('./test-data-e2e')) {
                fs.rmSync('./test-data-e2e', { recursive: true, force: true });
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    beforeEach(async () => {
        ws = await connectWebSocket();
    });

    afterEach(() => {
        if (ws) {
            ws.close();
        }
    });

    test('complete application lifecycle: deploy -> monitor -> stop -> cleanup', async () => {
        console.log('🔄 Testing complete application lifecycle...');

        // Step 1: Deploy application
        const deployMessage = {
            type: 'deploy_request',
            id: 'lifecycle-deploy-' + Date.now(),
            code: testApps.simpleCounter.code,
            language: 'python',
            name: 'Lifecycle Test App'
        };

        const deployResponse = await sendMessage(ws, deployMessage, 20000);

        assert.strictEqual(deployResponse.type, 'deploy_request-response');
        assert(deployResponse.status === 'started');
        assert(deployResponse.executionId);
        assert(deployResponse.appId);

        deployedApps.push(deployResponse.appId);

        // Step 2: Monitor application status
        await new Promise(resolve => setTimeout(resolve, 2000)); // Let app start

        const statusMessage = {
            type: 'get_app_status',
            id: 'lifecycle-status-' + Date.now(),
            appId: deployResponse.appId
        };

        const statusResponse = await sendMessage(ws, statusMessage, 10000);

        assert(['get_app_status-response', 'error'].includes(statusResponse.type));

        // Step 3: Wait for app to complete some execution
        console.log('⏳ Waiting for app execution...');
        await new Promise(resolve => setTimeout(resolve, 8000));

        // Step 4: Check final status
        const finalStatusResponse = await sendMessage(ws, statusMessage, 10000);

        // Step 5: Stop application (if still running)
        const stopMessage = {
            type: 'stop_app',
            id: 'lifecycle-stop-' + Date.now(),
            appId: deployResponse.appId
        };

        const stopResponse = await sendMessage(ws, stopMessage, 10000);

        assert(['stop_app-response', 'error'].includes(stopResponse.type));

        console.log('✅ Complete application lifecycle test passed');
    });

    test('multi-application deployment and concurrent execution', async () => {
        console.log('🔄 Testing multi-application deployment...');

        const deploymentPromises = [];
        const appNames = Object.keys(testApps);

        // Deploy all test applications concurrently
        for (const [appKey, appConfig] of Object.entries(testApps)) {
            const deployMessage = {
                type: 'deploy_request',
                id: `multi-deploy-${appKey}-${Date.now()}`,
                code: appConfig.code,
                language: 'python',
                name: appConfig.name
            };

            deploymentPromises.push(
                sendMessage(ws, deployMessage, 25000)
                    .then(response => {
                        deployedApps.push(response.appId);
                        return { appKey, response };
                    })
                    .catch(error => ({ appKey, error: error.message }))
            );
        }

        const deploymentResults = await Promise.allSettled(deploymentPromises);
        const successfulDeployments = [];
        const failedDeployments = [];

        deploymentResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const { appKey, response, error } = result.value;
                if (error) {
                    failedDeployments.push({ appKey, error });
                } else if (response.status === 'started') {
                    successfulDeployments.push({ appKey, response });
                } else {
                    failedDeployments.push({ appKey, error: 'Deployment failed' });
                }
            } else {
                failedDeployments.push({ appKey: appNames[index], error: result.reason.message });
            }
        });

        console.log(`✅ Deployments: ${successfulDeployments.length} successful, ${failedDeployments.length} failed`);

        // At least some deployments should succeed
        assert(successfulDeployments.length >= 1, 'At least one application should deploy successfully');

        // Step 2: Monitor all deployed applications
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get list of all applications
        const listMessage = {
            type: 'list_deployed_apps',
            id: 'multi-list-' + Date.now()
        };

        const listResponse = await sendMessage(ws, listMessage, 10000);

        assert.strictEqual(listResponse.type, 'list_deployed_apps-response');
        assert(Array.isArray(listResponse.applications));

        // Should have the deployed apps in the list
        const deployedAppIds = listResponse.applications.map(app => app.appId);
        const successfulAppIds = successfulDeployments.map(deployment => deployment.response.appId);
        const foundApps = successfulAppIds.filter(appId => deployedAppIds.includes(appId));
        assert(foundApps.length >= successfulDeployments.length);

        // Step 3: Wait for execution
        console.log('⏳ Waiting for concurrent execution...');
        await new Promise(resolve => setTimeout(resolve, 15000));

        // Step 4: Get final status of all apps
        const statusPromises = successfulDeployments.map(({ response }) => {
            const statusMessage = {
                type: 'get_app_status',
                id: `multi-status-${response.appId}-${Date.now()}`,
                appId: response.appId
            };
            return sendMessage(ws, statusMessage, 10000);
        });

        const statusResults = await Promise.allSettled(statusPromises);

        // Step 5: Stop all running applications
        const stopPromises = successfulDeployments.map(({ response }) => {
            const stopMessage = {
                type: 'stop_app',
                id: `multi-stop-${response.appId}-${Date.now()}`,
                appId: response.appId
            };
            return sendMessage(ws, stopMessage, 10000);
        });

        await Promise.allSettled(stopPromises);

        console.log('✅ Multi-application test completed');
    });

    test('error handling and recovery', async () => {
        console.log('🔄 Testing error handling and recovery...');

        // Test 1: Invalid Python code
        const invalidDeployMessage = {
            type: 'deploy_request',
            id: 'error-deploy-invalid-' + Date.now(),
            code: 'print("Unclosed string',  // Invalid syntax
            language: 'python'
        };

        const invalidResponse = await sendMessage(ws, invalidDeployMessage, 10000);

        // Should handle invalid code gracefully
        assert(['deploy_request-response', 'error'].includes(invalidResponse.type));
        if (invalidResponse.type === 'deploy_request-response') {
            assert(invalidResponse.status === 'failed');
        }

        // Test 2: Non-existent app operations
        const nonExistentAppMessage = {
            type: 'get_app_status',
            id: 'error-nonexistent-' + Date.now(),
            appId: 'non-existent-app-id'
        };

        const nonExistentResponse = await sendMessage(ws, nonExistentAppMessage, 5000);

        assert.strictEqual(nonExistentResponse.type, 'error');

        // Test 3: Valid deployment after errors
        const recoveryDeployMessage = {
            type: 'deploy_request',
            id: 'error-recovery-' + Date.now(),
            code: 'print("✅ Recovery test app completed successfully")',
            language: 'python'
        };

        const recoveryResponse = await sendMessage(ws, recoveryDeployMessage, 15000);

        assert.strictEqual(recoveryResponse.type, 'deploy_request-response');
        assert(['started', 'failed'].includes(recoveryResponse.status));

        if (recoveryResponse.status === 'started') {
            deployedApps.push(recoveryResponse.appId);
        }

        console.log('✅ Error handling and recovery test passed');
    });

    test('runtime state and health monitoring', async () => {
        console.log('🔄 Testing runtime state monitoring...');

        // Test runtime state at multiple points
        const stateChecks = [];

        for (let i = 0; i < 3; i++) {
            const stateMessage = {
                type: 'report_runtime_state',
                id: `state-check-${i}-${Date.now()}`
            };

            const stateResponse = await sendMessage(ws, stateMessage, 10000);

            assert.strictEqual(stateResponse.type, 'runtime_state_response');
            assert(stateResponse.result);
            assert(typeof stateResponse.result.timestamp === 'string');
            assert(typeof stateResponse.result.activeConnections === 'number');
            assert(typeof stateResponse.result.activeDeployments === 'number');

            stateChecks.push(stateResponse.result);

            if (i < 2) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Verify state consistency
        assert(stateChecks.length === 3);
        stateChecks.forEach((state, index) => {
            assert(state.activeConnections >= 0);
            assert(state.activeDeployments >= 0);
        });

        console.log('✅ Runtime state monitoring test passed');
    });
});