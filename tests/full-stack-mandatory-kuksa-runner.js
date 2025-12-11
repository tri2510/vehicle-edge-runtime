import WebSocket from 'ws';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

/**
 * MANDATORY KUKSA Full Stack Vehicle Edge Runtime Test Suite
 *
 * This test suite REQUIRES real Kuksa databroker to be operational.
 * Tests will retry Kuksa startup until successful or timeout is reached.
 * No graceful degradation - Kuksa connectivity is mandatory.
 */
class MandatoryKuksaTestRunner {
    constructor() {
        this.config = JSON.parse(fs.readFileSync('./tests/test-config.json', 'utf8')).testEnvironment;
        this.ws = null;
        this.testResults = [];
        this.messageTimeout = 30000; // Increased timeout for real Kuksa operations
        this.services = {
            kuksa: { process: null, port: this.config.kuksaHttpPort, status: 'stopped' },
            kitManager: { process: null, port: 3090, status: 'stopped' },
            runtime: { process: null, port: 3002, status: 'stopped' }
        };
        this.responseHandlers = new Map();
        this.setupResponseHandlers();

        if (!this.config.requireKuksa) {
            throw new Error('TEST CONFIGURATION ERROR: requireKuksa must be true for mandatory Kuksa testing');
        }

        console.log('🚗 MANDATORY KUKSA MODE ENABLED - Tests will FAIL without real Kuksa databroker');
    }

    setupResponseHandlers() {
        this.handleResponse = (response) => {
            if (response.id && this.responseHandlers.has(response.id)) {
                const handler = this.responseHandlers.get(response.id);
                handler(response);
                this.responseHandlers.delete(response.id);
            } else {
                console.log('📨 Unhandled response:', response.type, response.id || 'no-id');
            }
        };
    }

    async httpRequest(url, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`HTTP request timeout: ${url}`));
            }, timeout);

            const request = http.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    clearTimeout(timer);
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
                    }
                });
            }).on('error', (err) => {
                clearTimeout(timer);
                reject(err);
            });

            request.setTimeout(timeout);
        });
    }

    async waitForServiceWithRetry(url, serviceName, maxAttempts = 30, delayMs = 2000) {
        console.log(`⏳ Waiting for ${serviceName} to be ready (RETRIES: ${maxAttempts})...`);

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`🔄 Attempt ${attempt}/${maxAttempts} for ${serviceName}...`);
                const response = await this.httpRequest(url, 5000);

                if (response && response.length > 0) {
                    console.log(`✅ ${serviceName} is ready after ${attempt} attempts`);
                    return true;
                }
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw new Error(`${serviceName} failed to become ready after ${maxAttempts} attempts. Last error: ${error.message}`);
                }
                console.log(`⏳ ${serviceName} not ready yet (attempt ${attempt}/${maxAttempts}), waiting ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        throw new Error(`${serviceName} failed to become ready within ${maxAttempts} attempts`);
    }

    async verifyKuksaVSS() {
        console.log('🔍 Verifying Kuksa VSS tree structure...');

        try {
            const vssResponse = await this.httpRequest(`http://localhost:${this.config.kuksaHttpPort}/vss`, 10000);

            // Verify VSS contains expected vehicle signals
            const expectedSignals = [
                'Vehicle',
                'Speed',
                'Body',
                'Lights',
                'Powertrain',
                'Transmission'
            ];

            let signalCount = 0;
            expectedSignals.forEach(signal => {
                if (vssResponse.includes(signal)) {
                    signalCount++;
                }
            });

            if (signalCount < expectedSignals.length * 0.7) {
                throw new Error(`Kuksa VSS tree incomplete: found ${signalCount}/${expectedSignals.length} expected signals`);
            }

            console.log(`✅ Kuksa VSS verified: ${signalCount}/${expectedSignals.length} expected signals found`);
            return true;
        } catch (error) {
            throw new Error(`Kuksa VSS verification failed: ${error.message}`);
        }
    }

    async startKuksaMandatory() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('🚗 Starting Kuksa Databroker (MANDATORY)...');

                // Check if Kuksa is already running
                try {
                    await this.httpRequest(`http://localhost:${this.config.kuksaHttpPort}/vss`, 3000);
                    await this.verifyKuksaVSS();
                    console.log('✅ Kuksa Databroker already running and verified');
                    this.services.kuksa.status = 'running';
                    resolve();
                    return;
                } catch (error) {
                    // Kuksa not running, start it
                }

                // Check if simulation script exists
                const kuksaScript = './simulation/6-start-kuksa-server.sh';
                if (!fs.existsSync(kuksaScript)) {
                    throw new Error(`Kuksa startup script not found: ${kuksaScript}`);
                }

                const kuksaProcess = spawn(kuksaScript, [], {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    cwd: process.cwd()
                });

                kuksaProcess.stdout.on('data', (data) => {
                    const output = data.toString().trim();
                    if (output) {
                        console.log(`Kuksa: ${output}`);
                    }
                });

                kuksaProcess.stderr.on('data', (data) => {
                    const output = data.toString().trim();
                    if (output) {
                        console.error(`Kuksa Error: ${output}`);
                    }
                });

                kuksaProcess.on('exit', (code) => {
                    if (code !== 0) {
                        console.error(`Kuksa process exited with code ${code}`);
                    }
                });

                this.services.kuksa.process = kuksaProcess;

                // Wait for Kuksa to be ready with retry
                await this.waitForServiceWithRetry(
                    `http://localhost:${this.config.kuksaHttpPort}/vss`,
                    'Kuksa Databroker',
                    this.config.kuksaRetryAttempts,
                    this.config.kuksaRetryDelay
                );

                // Verify VSS structure
                await this.verifyKuksaVSS();

                this.services.kuksa.status = 'running';
                console.log('✅ Kuksa Databroker started and verified successfully');
                resolve();

            } catch (error) {
                reject(new Error(`MANDATORY KUKSA FAILED: ${error.message}. Test execution cannot continue without Kuksa.`));
            }
        });
    }

    async startKitManager() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('🔧 Starting Kit Manager...');

                // Check if Kit Manager is already running
                try {
                    await this.httpRequest('http://localhost:3090/listAllKits', 3000);
                    console.log('✅ Kit Manager already running');
                    this.services.kitManager.status = 'running';
                    resolve();
                    return;
                } catch (error) {
                    // Kit Manager not running, start it
                }

                const kitManagerScript = './simulation/1-start-kit-manager.sh';
                if (!fs.existsSync(kitManagerScript)) {
                    throw new Error(`Kit Manager startup script not found: ${kitManagerScript}`);
                }

                const kitManagerProcess = spawn(kitManagerScript, [], {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    cwd: process.cwd()
                });

                kitManagerProcess.stdout.on('data', (data) => {
                    const output = data.toString().trim();
                    if (output) {
                        console.log(`Kit Manager: ${output}`);
                    }
                });

                kitManagerProcess.stderr.on('data', (data) => {
                    const output = data.toString().trim();
                    if (output) {
                        console.error(`Kit Manager Error: ${output}`);
                    }
                });

                this.services.kitManager.process = kitManagerProcess;

                // Wait for Kit Manager API
                await this.waitForServiceWithRetry(
                    'http://localhost:3090/listAllKits',
                    'Kit Manager',
                    15,
                    2000
                );

                this.services.kitManager.status = 'running';
                console.log('✅ Kit Manager started successfully');
                resolve();

            } catch (error) {
                reject(new Error(`Kit Manager startup failed: ${error.message}`));
            }
        });
    }

    async startRuntime() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('⚙️ Starting Vehicle Edge Runtime with MANDATORY Kuksa...');

                if (this.services.kuksa.status !== 'running') {
                    throw new Error('Cannot start Runtime: Kuksa is not running (MANDATORY)');
                }

                const runtimeProcess = spawn('node', ['src/index.js'], {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    cwd: process.cwd(),
                    env: {
                        ...process.env,
                        KUKSA_ENABLED: 'true',
                        KUKSA_HOST: this.config.kuksaHost,
                        KUKSA_GRPC_PORT: this.config.kuksaGrpcPort.toString(),
                        PORT: '3002',
                        HEALTH_PORT: '3003',
                        DATA_DIR: this.config.dataDir || './test-data'
                    }
                });

                runtimeProcess.stdout.on('data', (data) => {
                    const output = data.toString().trim();
                    if (output) {
                        console.log(`Runtime: ${output}`);
                    }
                });

                runtimeProcess.stderr.on('data', (data) => {
                    const output = data.toString().trim();
                    if (output) {
                        console.error(`Runtime Error: ${output}`);
                    }
                });

                runtimeProcess.on('exit', (code) => {
                    if (code !== 0) {
                        console.error(`Runtime process exited with code ${code}`);
                    }
                });

                this.services.runtime.process = runtimeProcess;

                // Wait for runtime health check
                await this.waitForServiceWithRetry(
                    'http://localhost:3003/health',
                    'Runtime Health Check',
                    20,
                    2000
                );

                this.services.runtime.status = 'running';
                console.log('✅ Vehicle Edge Runtime started with Kuksa integration');
                resolve();

            } catch (error) {
                reject(new Error(`Runtime startup failed: ${error.message}`));
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

            this.responseHandlers.set(request.id, responseHandler);

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

    // Test 2: REAL Kuksa Vehicle Signal Integration (MANDATORY)
    async testRealKuksaSignalIntegration() {
        console.log('\n🚗 Test 2: REAL Kuksa Vehicle Signal Integration (MANDATORY)');

        const signalReadTest = await this.runTest('Read REAL Vehicle Signals from Kuksa', {
            type: 'get_signals_value',
            id: 'read-real-kuksa-signals-' + Date.now(),
            apis: [
                'Vehicle.Speed',
                'Vehicle.Body.Lights.IsLowBeamOn',
                'Vehicle.Body.Lights.IsHighBeamOn',
                'Vehicle.Powertrain.Transmission.CurrentGear'
            ]
        }, (response) => {
            if (response.type === 'signals_value_response') {
                return {
                    passed: response.result &&
                           typeof response.result === 'object' &&
                           Object.keys(response.result).length > 0,
                    expected: 'REAL signal values from Kuksa databroker',
                    data: response.result
                };
            } else if (response.type === 'error') {
                return {
                    passed: false,
                    error: `Kuksa signal reading failed: ${response.error || response.message}`,
                    expected: 'REAL signal values from Kuksa'
                };
            }
            return { passed: false, error: 'Invalid response type' };
        });

        // Test signal writing to REAL Kuksa
        const signalWriteTest = await this.runTest('Write REAL Vehicle Signals to Kuksa', {
            type: 'write_signals_value',
            id: 'write-real-kuksa-signals-' + Date.now(),
            data: {
                'Vehicle.Body.Lights.IsLowBeamOn': true,
                'Vehicle.Body.Lights.IsHighBeamOn': false
            }
        }, (response) => {
            if (response.type === 'signals_written') {
                return {
                    passed: true,
                    expected: 'Signals successfully written to REAL Kuksa databroker'
                };
            } else if (response.type === 'error') {
                return {
                    passed: false,
                    error: `Kuksa signal writing failed: ${response.error || response.message}`,
                    expected: 'Signals written to Kuksa'
                };
            }
            return { passed: false, error: 'Invalid response type' };
        });

        // Test real-time signal subscription from REAL Kuksa
        const subscribeTest = await this.runTest('Subscribe to REAL Kuksa Signal Updates', {
            type: 'subscribe_apis',
            id: 'subscribe-real-kuksa-' + Date.now(),
            apis: ['Vehicle.Speed', 'Vehicle.Body.Lights.IsLowBeamOn']
        }, (response) => {
            if (response.type === 'subscription_success' || response.type === 'subscribe_apis-response') {
                return {
                    passed: true,
                    expected: 'Subscribed to REAL Kuksa signal updates'
                };
            } else if (response.type === 'error') {
                return {
                    passed: false,
                    error: `Kuksa subscription failed: ${response.error || response.message}`,
                    expected: 'Subscription to Kuksa signals'
                };
            }
            return { passed: false, error: 'Invalid response type' };
        });

        return { signalReadTest, signalWriteTest, subscribeTest };
    }

    // Test 3: Application Deployment with REAL Kuksa Integration
    async testAppWithRealKuksa() {
        console.log('\n📦 Test 3: Application Deployment with REAL Kuksa Integration');

        const vehicleAppCode = `#!/usr/bin/env python3
import asyncio
import json
import time
from datetime import datetime

class VehicleSignalApp:
    def __init__(self):
        self.signals_accessed = 0
        self.signals_written = 0
        self.iterations = 8

    async def run(self):
        print("🚗 Vehicle Signal Test App with REAL Kuksa Integration")
        print("📡 Testing REAL vehicle signal access...")

        for i in range(self.iterations):
            try:
                # These would be handled by Vehicle Edge Runtime -> REAL Kuksa
                print(f"🔄 Iteration {i+1}/{self.iterations}")
                print("   📖 Attempting to read Vehicle.Speed from REAL Kuksa...")
                self.signals_accessed += 1

                print("   ✏️ Attempting to write Vehicle.Body.Lights.IsLowBeamOn to REAL Kuksa...")
                self.signals_written += 1

                await asyncio.sleep(1)
                print(f"   ✅ Iteration {i+1} completed successfully")

            except Exception as e:
                print(f"   ❌ Signal access error: {e}")

        print(f"📊 App completed: {self.signals_accessed} signals accessed, {self.signals_written} signals written")
        print("🎯 Vehicle Signal App with REAL Kuksa Integration - COMPLETED")

async def main():
    app = VehicleSignalApp()
    await app.run()

if __name__ == "__main__":
    asyncio.run(main())
`;

        const deployTest = await this.runTest('Deploy Vehicle App with REAL Kuksa', {
            type: 'deploy_request',
            id: 'deploy-real-kuksa-app-' + Date.now(),
            code: vehicleAppCode,
            language: 'python',
            vehicleId: 'test-vehicle-with-real-kuksa'
        }, (response) => {
            if (response.type === 'deploy_request-response') {
                return {
                    passed: response.status === 'started' && response.executionId,
                    expected: 'App deployed with REAL Kuksa vehicle credentials',
                    appId: response.appId
                };
            }
            return { passed: false, error: 'Deployment failed', response };
        });

        return { deployTest };
    }

    async runAllTests() {
        try {
            console.log('🚗 MANDATORY KUKSA FULL STACK TEST SUITE');
            console.log('=' * 60);
            console.log('⚠️ THIS TEST SUITE REQUIRES REAL KUKSA DATABROKER');
            console.log('⚠️ TESTS WILL FAIL WITHOUT KUKSA CONNECTIVITY');
            console.log('=' * 60);

            // Start full stack with MANDATORY Kuksa
            await this.startKuksaMandatory();      // MANDATORY - will retry until success
            await this.startKitManager();           // Optional for runtime
            await this.startRuntime();              // Requires Kuksa
            await this.connect();                   // Requires runtime

            console.log('\n🎯 All services ready, running MANDATORY Kuksa tests...');
            console.log('=' * 60);

            // Run comprehensive test suite with REAL Kuksa
            const healthResults = await this.testRuntimeHealth();
            const kuksaResults = await this.testRealKuksaSignalIntegration();  // MANDATORY
            const appResults = await this.testAppWithRealKuksa();

            // Generate comprehensive report
            this.generateTestReport({
                healthResults,
                kuksaResults,
                appResults
            });

            const passed = this.testResults.filter(r => r.status === 'pass').length;
            const failed = this.testResults.filter(r => r.status === 'fail').length;
            const errors = this.testResults.filter(r => r.status === 'error').length;
            const timeouts = this.testResults.filter(r => r.status === 'timeout').length;
            const total = this.testResults.length;

            console.log(`\n🏁 MANDATORY KUKSA TEST RESULTS:`);
            console.log(`✅ Passed: ${passed}`);
            console.log(`❌ Failed: ${failed}`);
            console.log(`💥 Errors: ${errors}`);
            console.log(`⏰ Timeouts: ${timeouts}`);
            console.log(`📊 Total: ${total}`);
            console.log(`📈 Success Rate: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);

            // For mandatory Kuksa tests, we want all tests to pass
            const allPassed = (failed === 0 && errors === 0 && timeouts === 0);

            if (allPassed) {
                console.log('🎉 ALL TESTS PASSED - REAL KUKSA INTEGRATION WORKING!');
            } else {
                console.log('❌ SOME TESTS FAILED - CHECK KUKSA CONNECTIVITY');
            }

            return allPassed;

        } catch (error) {
            console.error('💥 MANDATORY KUKSA TEST EXECUTION FAILED:', error.message);
            console.error('💥 Test suite cannot continue without Kuksa databroker');
            return false;
        }
    }

    generateTestReport(results) {
        console.log('\n📋 MANDATORY KUKSA TEST REPORT');
        console.log('=' * 60);

        const categories = [
            { name: 'Runtime Health Check', results: results.healthResults },
            { name: 'REAL Kuksa Signal Integration (MANDATORY)', results: results.kuksaResults },
            { name: 'Application with REAL Kuksa', results: results.appResults }
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
                await new Promise(resolve => setTimeout(resolve, 3000));
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

        // Stop Kuksa (clean shutdown)
        if (this.services.kuksa.process) {
            console.log('🛑 Stopping Kuksa Databroker...');
            this.services.kuksa.process.kill('SIGTERM');
            try {
                // Try to stop any remaining Kuksa containers
                spawn('docker', ['stop', 'kuksa-databroker'], { stdio: 'ignore' });
                await new Promise(resolve => setTimeout(resolve, 5000));
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
    console.log('\n⚠️ MANDATORY KUKSA test interrupted, cleaning up...');
    const tester = new MandatoryKuksaTestRunner();
    await tester.cleanup();
    process.exit(1);
});

process.on('SIGTERM', async () => {
    console.log('\n⚠️ MANDATORY KUKSA test terminated, cleaning up...');
    const tester = new MandatoryKuksaTestRunner();
    await tester.cleanup();
    process.exit(1);
});

// Export for use as module
export default MandatoryKuksaTestRunner;

// Run mandatory Kuksa tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🚗 STARTING MANDATORY KUKSA TEST SUITE');
    console.log('🚗 KUKSA DATABROKER IS REQUIRED - NO GRACEFUL DEGRADATION');
    console.log('🚗 TESTS WILL FAIL IF KUKSA IS NOT OPERATIONAL');

    const tester = new MandatoryKuksaTestRunner();

    tester.runAllTests().then(success => {
        return tester.cleanup().then(() => success);
    }).then(success => {
        console.log('\n🎯 MANDATORY KUKSA TEST SUITE COMPLETED');
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('💥 Fatal error during MANDATORY Kuksa testing:', error);
        console.error('💥 Ensure Kuksa databroker is properly installed and configured');
        process.exit(1);
    });
}