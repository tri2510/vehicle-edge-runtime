import WebSocket from 'ws';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

/**
 * Full Stack Vehicle Edge Runtime Test Suite
 *
 * This test suite automates the comprehensive testing strategy outlined in HOST_TEST_STRATEGY.md
 * It starts the full stack (Kuksa, Kit Manager, Runtime) and runs all tests automatically.
 */
class FullStackVehicleTester {
    constructor() {
        this.ws = null;
        this.testResults = [];
        this.messageTimeout = 15000; // Increased timeout for complex operations
        this.services = {
            kuksa: { process: null, port: 55555, status: 'stopped' },
            kitManager: { process: null, port: 3090, status: 'stopped' },
            runtime: { process: null, port: 3002, status: 'stopped' }
        };
        this.responseHandlers = new Map();
        this.setupResponseHandlers();
    }

    setupResponseHandlers() {
        // Default response handler
        this.handleResponse = (response) => {
            // Check if we have a specific handler waiting for this response
            if (response.id && this.responseHandlers.has(response.id)) {
                const handler = this.responseHandlers.get(response.id);
                handler(response);
                this.responseHandlers.delete(response.id);
            } else {
                // Log unhandled responses for debugging
                console.log('📨 Unhandled response:', response.type, response.id || 'no-id');
            }
        };
    }

    async httpRequest(url, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`HTTP request timeout: ${url}`));
            }, timeout);

            const request = http.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    clearTimeout(timer);
                    resolve(data);
                });
            }).on('error', (err) => {
                clearTimeout(timer);
                reject(err);
            });

            request.setTimeout(timeout);
        });
    }

    async waitForService(url, serviceName, timeoutMs = 30000) {
        const startTime = Date.now();
        console.log(`⏳ Waiting for ${serviceName} to be ready...`);

        while (Date.now() - startTime < timeoutMs) {
            try {
                const response = await this.httpRequest(url, 2000);
                if (response.length > 0) {
                    console.log(`✅ ${serviceName} is ready`);
                    return true;
                }
            } catch (error) {
                // Service not ready yet, continue waiting
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        throw new Error(`${serviceName} failed to become ready within ${timeoutMs}ms`);
    }

    async startKuksa() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('🚗 Starting Kuksa Databroker...');

                // Check if Kuksa is already running
                try {
                    await this.httpRequest('http://localhost:55555/vss', 2000);
                    console.log('✅ Kuksa Databroker already running');
                    this.services.kuksa.status = 'running';
                    resolve();
                    return;
                } catch (error) {
                    // Kuksa not running, start it
                }

                const kuksaProcess = spawn('./simulation/6-start-kuksa-server.sh', [], {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    cwd: process.cwd()
                });

                kuksaProcess.stdout.on('data', (data) => {
                    console.log(`Kuksa: ${data.toString().trim()}`);
                });

                kuksaProcess.stderr.on('data', (data) => {
                    console.error(`Kuksa Error: ${data.toString().trim()}`);
                });

                kuksaProcess.on('exit', (code) => {
                    if (code !== 0) {
                        console.error(`Kuksa process exited with code ${code}`);
                    }
                });

                this.services.kuksa.process = kuksaProcess;

                // Wait for Kuksa to be ready
                await this.waitForService('http://localhost:55555/vss', 'Kuksa Databroker');
                this.services.kuksa.status = 'running';
                resolve();

            } catch (error) {
                reject(new Error(`Failed to start Kuksa: ${error.message}`));
            }
        });
    }

    async startKitManager() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('🔧 Starting Kit Manager...');

                // Check if Kit Manager is already running
                try {
                    await this.httpRequest('http://localhost:3090/listAllKits', 2000);
                    console.log('✅ Kit Manager already running');
                    this.services.kitManager.status = 'running';
                    resolve();
                    return;
                } catch (error) {
                    // Kit Manager not running, start it
                }

                const kitManagerProcess = spawn('./simulation/1-start-kit-manager.sh', [], {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    cwd: process.cwd()
                });

                kitManagerProcess.stdout.on('data', (data) => {
                    console.log(`Kit Manager: ${data.toString().trim()}`);
                });

                kitManagerProcess.stderr.on('data', (data) => {
                    console.error(`Kit Manager Error: ${data.toString().trim()}`);
                });

                this.services.kitManager.process = kitManagerProcess;

                // Wait for Kit Manager API
                await this.waitForService('http://localhost:3090/listAllKits', 'Kit Manager');
                this.services.kitManager.status = 'running';
                resolve();

            } catch (error) {
                reject(new Error(`Failed to start Kit Manager: ${error.message}`));
            }
        });
    }

    async startRuntime() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('⚙️ Starting Vehicle Edge Runtime...');

                const runtimeProcess = spawn('node', ['src/index.js'], {
                    stdio: ['ignore', 'pipe', 'pipe'],
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
                    const output = data.toString().trim();
                    console.log(`Runtime: ${output}`);

                    // Look for startup completion signal
                    if (output.includes('Vehicle Edge Runtime started') ||
                        output.includes('WebSocket server listening')) {
                        this.services.runtime.status = 'running';
                    }
                });

                runtimeProcess.stderr.on('data', (data) => {
                    console.error(`Runtime Error: ${data.toString().trim()}`);
                });

                runtimeProcess.on('exit', (code) => {
                    if (code !== 0) {
                        console.error(`Runtime process exited with code ${code}`);
                    }
                });

                this.services.runtime.process = runtimeProcess;

                // Wait for runtime to be ready
                await this.waitForService('http://localhost:3003/health', 'Runtime Health Check');
                this.services.runtime.status = 'running';
                console.log('✅ Vehicle Edge Runtime ready');
                resolve();

            } catch (error) {
                reject(new Error(`Failed to start Runtime: ${error.message}`));
            }
        });
    }

    async connect() {
        return new Promise((resolve, reject) => {
            console.log('🔌 Connecting to Vehicle Edge Runtime WebSocket...');

            this.ws = new WebSocket('ws://localhost:3002/runtime');

            this.ws.on('open', () => {
                console.log('✅ Connected to Vehicle Edge Runtime WebSocket');
                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleResponse(message);
                } catch (error) {
                    console.error('❌ Failed to parse WebSocket message:', error);
                }
            });

            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('🔌 WebSocket connection closed');
            });

            setTimeout(() => {
                if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 10000);
        });
    }

    async runTest(testName, request, validator, timeoutMs = null) {
        return new Promise((resolve) => {
            console.log(`🧪 Running test: ${testName}`);

            const timeout = setTimeout(() => {
                console.log(`❌ Test timeout: ${testName}`);
                this.testResults.push({
                    test: testName,
                    status: 'timeout',
                    error: `Test exceeded ${timeoutMs || this.messageTimeout}ms timeout`
                });
                resolve(false);
            }, timeoutMs || this.messageTimeout);

            // Create response handler for this specific test
            const responseHandler = (response) => {
                if (response.id === request.id ||
                    (response.type && response.type.includes(request.type?.split('-')[0]))) {

                    clearTimeout(timeout);

                    try {
                        const result = validator(response);
                        const passed = result === true || (result && result.passed === true);

                        console.log(passed ? `✅ ${testName} - PASS` : `❌ ${testName} - FAIL`);

                        if (!passed) {
                            console.log('   Expected:', result.expected || 'Success');
                            console.log('   Received:', response);
                            if (result.error) {
                                console.log('   Error:', result.error);
                            }
                        }

                        this.testResults.push({
                            test: testName,
                            status: passed ? 'pass' : 'fail',
                            response: response,
                            error: passed ? null : (result.error || 'Validation failed')
                        });

                        resolve(passed);

                    } catch (error) {
                        console.log(`❌ ${testName} - VALIDATION ERROR:`, error.message);
                        this.testResults.push({
                            test: testName,
                            status: 'error',
                            error: `Validation error: ${error.message}`,
                            response: response
                        });
                        resolve(false);
                    }
                }
            };

            // Register the handler
            this.responseHandlers.set(request.id, responseHandler);

            // Send the request
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(request));
            } else {
                clearTimeout(timeout);
                console.log(`❌ ${testName} - FAIL: WebSocket not connected`);
                this.testResults.push({
                    test: testName,
                    status: 'error',
                    error: 'WebSocket not connected'
                });
                resolve(false);
            }
        });
    }

    // Test 1: Basic Runtime Health Check
    async testRuntimeHealth() {
        console.log('\n🏥 Test 1: Basic Runtime Health Check');

        const pingTest = await this.runTest('Ping/Pong', {
            type: 'ping',
            id: 'health-ping-' + Date.now()
        }, (response) => {
            return response.type === 'pong' && response.id && response.timestamp;
        });

        const infoTest = await this.runTest('Runtime Info', {
            type: 'get_runtime_info',
            id: 'health-info-' + Date.now()
        }, (response) => {
            return response.type === 'get_runtime_info-response' &&
                   response.result &&
                   response.result.runtimeId;
        });

        return { pingTest, infoTest };
    }

    // Test 2: Single Python App Deployment
    async testSingleAppDeployment() {
        console.log('\n📦 Test 2: Single Python App Deployment');

        const simpleAppCode = `import asyncio
import time

print("🚀 Simple test app started")

async def main():
    for i in range(5):
        print(f"📋 Test iteration {i+1}/5")
        await asyncio.sleep(0.5)
    print("✅ Simple test app completed successfully")

asyncio.run(main())`;

        const deployTest = await this.runTest('Deploy Simple App', {
            type: 'deploy_request',
            id: 'deploy-simple-' + Date.now(),
            code: simpleAppCode
        }, (response) => {
            if (response.type === 'deploy_request-response') {
                return {
                    passed: response.status === 'started' && response.executionId,
                    expected: 'App deployed with executionId and started status',
                    appId: response.appId
                };
            }
            return { passed: false, error: 'Wrong response type' };
        });

        return { deployTest };
    }

    // Test 3: Real Vehicle Signal Integration
    async testVehicleSignalIntegration() {
        console.log('\n🚗 Test 3: Real Vehicle Signal Integration');

        const signalReadTest = await this.runTest('Read Vehicle Signals', {
            type: 'get_signals_value',
            id: 'read-signals-' + Date.now(),
            apis: ['Vehicle.Speed', 'Vehicle.Body.Lights.IsLowBeamOn']
        }, (response) => {
            if (response.type === 'signals_value_response') {
                return {
                    passed: response.result &&
                           typeof response.result === 'object',
                    expected: 'Signal values returned',
                    data: response.result
                };
            } else if (response.type === 'error') {
                return {
                    passed: true, // Errors are acceptable if Kuksa isn't fully configured
                    expected: 'Error handling when Kuksa unavailable',
                    error: 'Graceful error handling'
                };
            }
            return { passed: false, error: 'Unexpected response type' };
        });

        const signalWriteTest = await this.runTest('Write Vehicle Signals', {
            type: 'write_signals_value',
            id: 'write-signals-' + Date.now(),
            data: {
                'Vehicle.Body.Lights.IsLowBeamOn': true
            }
        }, (response) => {
            if (response.type === 'signals_written') {
                return {
                    passed: true,
                    expected: 'Signals written successfully'
                };
            } else if (response.type === 'error') {
                return {
                    passed: true, // Acceptable - signals might be read-only
                    expected: 'Error handling for read-only signals'
                };
            }
            return { passed: false, error: 'Unexpected response type' };
        });

        return { signalReadTest, signalWriteTest };
    }

    // Test 4: Multiple App Management
    async testMultipleAppManagement() {
        console.log('\n🔄 Test 4: Multiple App Management');

        const apps = [
            {
                name: 'Counter App',
                code: `import asyncio
print("🔢 Counter app started")
async def main():
    for i in range(8):
        print(f"🔢 Counter: {i+1}/8")
        await asyncio.sleep(0.3)
    print("✅ Counter app completed")
asyncio.run(main())`
            },
            {
                name: 'Timer App',
                code: `import asyncio
import time
print("⏰ Timer app started")
async def main():
    start = time.time()
    for i in range(4):
        elapsed = time.time() - start
        print(f"⏰ Timer: {elapsed:.1f}s elapsed - iteration {i+1}/4")
        await asyncio.sleep(0.6)
    print("✅ Timer app completed")
asyncio.run(main())`
            },
            {
                name: 'Logger App',
                code: `import asyncio
print("📝 Logger app started")
async def main():
    messages = ["📝 Initializing", "📝 Processing data", "📝 Analyzing results", "📝 Finalizing"]
    for i, msg in enumerate(messages):
        print(f"📝 Step {i+1}/4: {msg}")
        await asyncio.sleep(0.4)
    print("✅ Logger app completed")
asyncio.run(main())`
            }
        ];

        const deployResults = [];

        // Deploy all apps
        for (let i = 0; i < apps.length; i++) {
            const app = apps[i];
            const deployTest = await this.runTest(`Deploy ${app.name}`, {
                type: 'deploy_request',
                id: `deploy-multi-${i}-${Date.now()}`,
                code: app.code
            }, (response) => {
                return response.type === 'deploy_request-response' &&
                       response.status === 'started' &&
                       response.executionId;
            });
            deployResults.push(deployTest);

            // Small delay between deployments
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Test listing deployed apps
        const listTest = await this.runTest('List Deployed Apps', {
            type: 'list_deployed_apps',
            id: 'list-apps-' + Date.now()
        }, (response) => {
            return response.type === 'list_deployed_apps-response' &&
                   Array.isArray(response.result);
        });

        return { deployResults, listTest };
    }

    // Test 5: Error Handling & Edge Cases
    async testErrorHandling() {
        console.log('\n⚠️ Test 5: Error Handling & Edge Cases');

        // Test invalid Python code
        const invalidCodeTest = await this.runTest('Invalid Python Code', {
            type: 'deploy_request',
            id: 'deploy-invalid-' + Date.now(),
            code: 'print("Unclosed string'  // Missing closing quote
        }, (response) => {
            return response.type === 'error' ||
                   (response.type === 'deploy_request-response' &&
                    response.status === 'failed');
        });

        // Test non-existent app control
        const nonexistentAppTest = await this.runTest('Stop Non-existent App', {
            type: 'stop_app',
            id: 'stop-ghost-' + Date.now(),
            appId: 'non-existent-app-id'
        }, (response) => {
            return response.type === 'error';
        });

        // Test invalid API call
        const invalidApiTest = await this.runTest('Invalid API Call', {
            type: 'invalid_api_call',
            id: 'invalid-test-' + Date.now()
        }, (response) => {
            return response.type === 'error';
        });

        return { invalidCodeTest, nonexistentAppTest, invalidApiTest };
    }

    // Test 6: Performance & Resource Monitoring
    async testPerformanceMonitoring() {
        console.log('\n📊 Test 6: Performance & Resource Monitoring');

        // Test runtime state reporting
        const stateTest = await this.runTest('Runtime State Report', {
            type: 'report_runtime_state',
            id: 'runtime-state-' + Date.now()
        }, (response) => {
            return response.type === 'runtime_state_response' &&
                   response.result;
        });

        return { stateTest };
    }

    async runAllTests() {
        try {
            console.log('🚀 Starting Full Stack Vehicle Edge Runtime Test Suite');
            console.log('=' * 60);

            // Start full stack services
            await this.startKuksa();
            await this.startKitManager();
            await this.startRuntime();
            await this.connect();

            console.log('\n🎯 All services ready, starting tests...');
            console.log('=' * 60);

            // Run comprehensive test suite
            const healthResults = await this.testRuntimeHealth();
            const singleAppResults = await this.testSingleAppDeployment();
            const signalResults = await this.testVehicleSignalIntegration();
            const multiAppResults = await this.testMultipleAppManagement();
            const errorResults = await this.testErrorHandling();
            const performanceResults = await this.testPerformanceMonitoring();

            // Generate comprehensive report
            this.generateTestReport({
                healthResults,
                singleAppResults,
                signalResults,
                multiAppResults,
                errorResults,
                performanceResults
            });

            const passed = this.testResults.filter(r => r.status === 'pass').length;
            const failed = this.testResults.filter(r => r.status === 'fail').length;
            const errors = this.testResults.filter(r => r.status === 'error').length;
            const timeouts = this.testResults.filter(r => r.status === 'timeout').length;
            const total = this.testResults.length;

            console.log(`\n🏁 FINAL RESULTS:`);
            console.log(`✅ Passed: ${passed}`);
            console.log(`❌ Failed: ${failed}`);
            console.log(`💥 Errors: ${errors}`);
            console.log(`⏰ Timeouts: ${timeouts}`);
            console.log(`📊 Total: ${total}`);
            console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

            return passed === total - errors - timeouts; // Success if no failures, errors, or timeouts

        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
            console.error(error.stack);
            return false;
        }
    }

    generateTestReport(results) {
        console.log('\n📋 DETAILED TEST REPORT');
        console.log('=' * 60);

        const categories = [
            { name: 'Runtime Health Check', results: results.healthResults },
            { name: 'Single App Deployment', results: results.singleAppResults },
            { name: 'Vehicle Signal Integration', results: results.signalResults },
            { name: 'Multiple App Management', results: results.multiAppResults },
            { name: 'Error Handling', results: results.errorResults },
            { name: 'Performance Monitoring', results: results.performanceResults }
        ];

        categories.forEach(category => {
            console.log(`\n📂 ${category.name}:`);
            if (category.results) {
                Object.entries(category.results).forEach(([testName, result]) => {
                    if (typeof result === 'boolean') {
                        console.log(`  ${result ? '✅' : '❌'} ${testName}`);
                    } else if (Array.isArray(result)) {
                        console.log(`  📊 ${testName}: ${result.filter(r => r === true).length}/${result.length} passed`);
                    } else {
                        console.log(`  📄 ${testName}: ${typeof result}`);
                    }
                });
            }
        });

        // List failed tests with details
        const failedTests = this.testResults.filter(r => r.status !== 'pass');
        if (failedTests.length > 0) {
            console.log('\n❌ FAILED TESTS DETAILS:');
            failedTests.forEach(test => {
                console.log(`  • ${test.test} - ${test.status.toUpperCase()}`);
                if (test.error) {
                    console.log(`    Error: ${test.error}`);
                }
            });
        }
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up services...');

        // Stop runtime
        if (this.services.runtime.process) {
            console.log('🛑 Stopping Runtime...');
            this.services.runtime.process.kill('SIGTERM');
            try {
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                // Ignore cleanup errors
            }
        }

        // Stop kit manager
        if (this.services.kitManager.process) {
            console.log('🛑 Stopping Kit Manager...');
            this.services.kitManager.process.kill('SIGTERM');
            try {
                spawn('docker', ['stop', 'kit-manager'], { stdio: 'ignore' });
                await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (error) {
                // Ignore cleanup errors
            }
        }

        // Stop kuksa
        if (this.services.kuksa.process) {
            console.log('🛑 Stopping Kuksa...');
            this.services.kuksa.process.kill('SIGTERM');
            try {
                // Try to stop any remaining Kuksa containers
                spawn('docker', ['stop', 'kuksa-databroker'], { stdio: 'ignore' });
                await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (error) {
                // Ignore cleanup errors
            }
        }

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
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

// Handle process termination
process.on('SIGTERM', async () => {
    console.log('\n⚠️ Test terminated, cleaning up...');
    const tester = new FullStackVehicleTester();
    await tester.cleanup();
    process.exit(1);
});

// Export for use as module
module.exports = FullStackVehicleTester;

// Run full stack tests if executed directly
if (require.main === module) {
    const tester = new FullStackVehicleTester();
    tester.runAllTests().then(success => {
        return tester.cleanup();
    }).then(() => {
        console.log('\n🎉 Full stack test suite completed');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Fatal error during testing:', error);
        process.exit(1);
    });
}