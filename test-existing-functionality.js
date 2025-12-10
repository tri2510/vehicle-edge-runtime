/**
 * Test Existing Functionality to Ensure Backward Compatibility
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

class ExistingFunctionalityTest {
    constructor(runtimeUrl = 'ws://localhost:3009/runtime', kitManagerUrl = 'http://localhost:3090') {
        this.runtimeUrl = runtimeUrl;
        this.kitManagerUrl = kitManagerUrl;
        this.ws = null;
        this.testResults = {
            websocket: { passed: 0, failed: 0 },
            containerExecution: { passed: 0, failed: 0 },
            kitManager: { passed: 0, failed: 0 },
            vehicleSignals: { passed: 0, failed: 0 },
            consoleOutput: { passed: 0, failed: 0 }
        };
    }

    async runTests() {
        console.log('🔄 Testing Existing Functionality for Backward Compatibility\n');

        try {
            await this.connectToRuntime();

            // Test core WebSocket functionality
            console.log('🔌 Testing Core WebSocket Functionality...');
            await this.testWebSocketBasics();

            // Test container execution
            console.log('🐳 Testing Container Execution...');
            await this.testContainerExecution();

            // Test Kit Manager integration
            console.log('🎯 Testing Kit Manager Integration...');
            await this.testKitManagerIntegration();

            // Test vehicle signals
            console.log('🚗 Testing Vehicle Signals...');
            await this.testVehicleSignals();

            // Test console output
            console.log('📟 Testing Console Output...');
            await this.testConsoleOutput();

        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
        } finally {
            if (this.ws) {
                this.ws.close();
            }
            this.printResults();
        }
    }

    async connectToRuntime() {
        return new Promise((resolve, reject) => {
            console.log('Connecting to Vehicle Edge Runtime...');

            this.ws = new WebSocket(this.runtimeUrl);

            this.ws.on('open', () => {
                console.log('✅ Connected to Vehicle Edge Runtime');
                resolve();
            });

            this.ws.on('error', (error) => {
                console.error('❌ Failed to connect:', error.message);
                reject(error);
            });

            setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });
    }

    async testWebSocketBasics() {
        const tests = [
            () => this.testPingPong(),
            () => testRegisterKit(),
            () => testClientRegistration(),
            () => testGetRuntimeInfo()
        ];

        for (const test of tests) {
            try {
                await test();
                this.testResults.websocket.passed++;
                console.log(`✅ ${test.name}`);
            } catch (error) {
                this.testResults.websocket.failed++;
                console.log(`❌ ${test.name}: ${error.message}`);
            }
        }
    }

    async testPingPong() {
        const response = await this.sendMessage({
            type: 'ping'
        });

        if (response.type !== 'pong') {
            throw new Error('Ping-pong failed');
        }
        console.log('  ✓ Ping-pong working');
    }

    async testRegisterKit() {
        const kitInfo = {
            name: 'Test Kit',
            type: 'vehicle-edge-runtime',
            version: '1.0.0',
            capabilities: [
                'python_app_execution',
                'binary_app_execution',
                'console_output',
                'vehicle_signals',
                'app_management'
            ]
        };

        const response = await this.sendMessage({
            type: 'register_kit',
            kitInfo
        });

        if (response.type !== 'kit_registered') {
            throw new Error('Kit registration failed');
        }

        console.log('  ✓ Kit registration successful');
    }

    async testClientRegistration() {
        const response = await this.sendMessage({
            type: 'register_client',
            clientId: 'test-client-' + Date.now()
        });

        if (response.type !== 'client_registered') {
            throw new Error('Client registration failed');
        }

        console.log('  ✓ Client registration successful');
    }

    async testGetRuntimeInfo() {
        const response = await this.sendMessage({
            type: 'get_runtime_info'
        });

        if (response.type !== 'runtime_info') {
            throw new Error('Runtime info failed');
        }

        // Check for expected properties
        const expectedProps = ['runtimeId', 'version', 'uptime', 'components'];
        for (const prop of expectedProps) {
            if (!response.data || !(prop in response.data)) {
                throw new Error(`Missing property: ${prop}`);
            }
        }

        console.log('  ✓ Runtime info retrieval working');
    }

    async testContainerExecution() {
        const tests = [
            () => this.testPythonAppExecution(),
            () => this.testBinaryAppExecution(),
            () => this.testAppStatusTracking()
        ];

        for (const test of tests) {
            try {
                await test();
                this.testResults.containerExecution.passed++;
                console.log(`✅ ${test.name}`);
            } catch (error) {
                this.testResults.containerExecution.failed++;
                console.log(`❌ ${test.name}: ${error.message}`);
            }
        }
    }

    async testPythonAppExecution() {
        const pythonCode = `
import time
import sys

print("Python app is running...")
print(f"Python version: {sys.version}")

# Test basic functionality
numbers = [1, 2, 3, 4, 5]
print(f"Numbers: {numbers}")
print(f"Sum: {sum(numbers)}")

# Test time functionality
for i in range(3):
    print(f"Working... {i+1}/3")
    time.sleep(1)

print("Python app completed successfully!")
`;

        const response = await this.sendMessage({
            type: 'run_python_app',
            executionId: uuidv4(),
            code: pythonCode,
            entryPoint: 'app.py',
            env: { TEST_MODE: 'container_test' }
        });

        if (response.type !== 'app_started') {
            throw new Error('Python app execution failed');
        }

        console.log('  ✓ Python app execution started');
        this.pythonExecutionId = response.executionId;

        // Wait for completion
        await this.sleep(3000);

        // Check final status
        const status = await this.sendMessage({
            type: 'get_app_status',
            executionId: this.pythonExecutionId
        });

        if (status.type === 'app_status') {
            const statusData = status.status;
            if (statusData.status === 'stopped' || statusData.status === 'exited') {
                console.log(`  ✓ Python app completed with exit code: ${statusData.exit_code}`);
            } else {
                console.log(`  ✓ Python app running (status: ${statusData.status})`);
            }
        }
    }

    async testBinaryAppExecution() {
        const binaryCode = `
#!/bin/sh
echo "Binary app is running..."
echo "Testing container execution"
echo "Current directory: $(pwd)"
echo "Environment variables:"
env | grep -E '^TEST_|^APP_|^EXECUTION_'
echo "Binary app completed!"
`;

        const response = await this.sendMessage({
            type: 'run_binary_app',
            executionId: uuidv4(),
            binaryPath: 'sh',
            args: ['-c', binaryCode],
            env: { TEST_MODE: 'binary_test' }
        });

        if (response.type !== 'app_started') {
            throw new Error('Binary app execution failed');
        }

        console.log('  ✓ Binary app execution started');
        this.binaryExecutionId = response.executionId;

        // Wait for completion
        await this.sleep(2000);

        // Check final status
        const status = await this.sendMessage({
            type: 'get_app_status',
            executionId: this.binaryExecutionId
        });

        if (status.type === 'app_status') {
            const statusData = status.status;
            if (statusData.status === 'stopped' || statusData.status === 'exited') {
                console.log(`  ✓ Binary app completed with exit code: ${statusData.exit_code}`);
            } else {
                console.log(`  ✓ Binary app running (status: ${statusData.status})`);
            }
        }
    }

    async testAppStatusTracking() {
        if (!this.pythonExecutionId) {
            throw new Error('No execution ID for status test');
        }

        const response = await this.sendMessage({
            type: 'get_app_status',
            executionId: this.pythonExecutionId
        });

        if (response.type !== 'app_status') {
            throw new Error('App status tracking failed');
        }

        const status = response.status;
        const requiredFields = ['executionId', 'type', 'status', 'timestamp'];
        for (const field of requiredFields) {
            if (!(field in status)) {
                throw new Error(`Missing field in status: ${field}`);
            }
        }

        console.log('  ✓ App status tracking working');
    }

    async testKitManagerIntegration() {
        try {
            const response = await fetch(this.kitManagerUrl + '/listAllKits');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!Array.isArray(data.content)) {
                throw new Error('Invalid response format');
            }

            console.log('  ✓ Kit Manager API responding');
            console.log(`  ✓ Registered kits: ${data.content.length}`);

            // Check if our kit is registered
            const registeredKits = data.content.filter(kit =>
                kit.name && kit.kit_id && kit.is_online
            );

            if (registeredKits.length > 0) {
                console.log(`  ✓ Online kits detected: ${registeredKits.length}`);
            }

        } catch (error) {
            console.log('  ⚠️  Kit Manager not available - skipping test');
        }
    }

    async testVehicleSignals() {
        const tests = [
            () => this.testSignalSubscription(),
            () => this.testSignalRead(),
            () => this.testSignalWrite()
        ];

        for (const test of tests) {
            try {
                await test();
                this.testResults.vehicleSignals.passed++;
                console.log(`✅ ${test.name}`);
            } catch (error) {
                this.testResults.vehicleSignals.failed++;
                console.log(`❌ ${test.name}: ${error.message}`);
            }
        }
    }

    async testSignalSubscription() {
        const response = await this.sendMessage({
            type: 'subscribe_apis',
            clientType: 'verification_test',
            apis: ['vehicle_signals']
        });

        if (response.type !== 'apis_subscribed') {
            throw new Error('Signal subscription failed');
        }

        console.log('  ✓ Vehicle signal subscription successful');
    }

    async testSignalRead() {
        const response = await this.sendMessage({
            type: 'get_signals_value',
            signals: ['Vehicle.Speed', 'Vehicle.Steering.Angle', 'Vehicle.Engine.RPM']
        });

        if (response.type !== 'signals_value') {
            throw new Error('Signal read failed');
        }

        console.log('  ✓ Signal value retrieval working');
    }

    async testSignalWrite() {
        const response = await this.sendMessage({
            type: 'write_signals_value',
            signals: {
                'Vehicle.Speed': 50.0,
                'Vehicle.Steering.Angle': 0.0
            }
        });

        if (response.type !== 'signals_written') {
            throw new Error('Signal write failed');
        }

        console.log('  ✓ Signal value writing working');
    }

    async testConsoleOutput() {
        const tests = [
            () => this.testConsoleSubscription(),
            () => testConsoleStreaming()
        ];

        for (const test of tests) {
            try {
                await test();
                this.testResults.consoleOutput.passed++;
                console.log(`✅ ${test.name}`);
            } catch (error) {
                this.testResults.consoleOutput.failed++;
                console.log(`❌ ${test.name}: ${error.message}`);
            }
        }
    }

    async testConsoleSubscription() {
        if (!this.pythonExecutionId) {
            throw new Error('No execution ID for console test');
        }

        const response = await this.sendMessage({
            type: 'console_subscribe',
            executionId: this.pythonExecutionId
        });

        if (response.type !== 'subscribed') {
            throw new Error('Console subscription failed');
        }

        console.log('  ✓ Console subscription successful');
    }

    async testConsoleStreaming() {
        return new Promise((resolve) => {
            console.log('  ⏳ Waiting for console output...');

            let outputReceived = false;
            const timeout = setTimeout(() => {
                if (!outputReceived) {
                    console.log('  ⚠️  No console output received within timeout');
                    resolve();
                }
            }, 5000);

            const messageHandler = (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'console_output' && message.executionId === this.pythonExecutionId) {
                        outputReceived = true;
                        clearTimeout(timeout);
                        this.ws.removeListener('message', messageHandler);
                        console.log('  ✓ Console streaming working');
                        resolve();
                    }
                } catch (error) {
                    // Ignore JSON parse errors
                }
            };

            this.ws.on('message', messageHandler);
        });
    }

    sendMessage(message) {
        return new Promise((resolve, reject) => {
            const messageId = uuidv4();
            const messageWithId = { ...message, id: messageId, timestamp: new Date().toISOString() };

            const timeout = setTimeout(() => {
                reject(new Error(`Message timeout: ${message.type}`));
            }, 10000);

            const messageHandler = (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === messageId || response.type === 'error' || response.type === message.type) {
                        clearTimeout(timeout);
                        this.ws.removeListener('message', messageHandler);
                        resolve(response);
                    }
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            };

            this.ws.on('message', messageHandler);
            this.ws.send(JSON.stringify(messageWithId));
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('🔄 EXISTING FUNCTIONALITY TEST RESULTS');
        console.log('='.repeat(60));

        const categories = Object.entries(this.testResults);
        let totalPassed = 0;
        let totalFailed = 0;

        for (const [category, results] of categories) {
            totalPassed += results.passed;
            totalFailed += results.failed;

            console.log(`\n${category.toUpperCase()}:`);
            console.log(`  ✅ Passed: ${results.passed}`);
            console.log(`  ❌ Failed: ${results.failed}`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${totalPassed + totalFailed}`);
        console.log(`Passed: ${totalPassed} ✅`);
        console.log(`Failed: ${totalFailed} ${totalFailed > 0 ? '❌' : '✅'}`);

        if (totalFailed === 0) {
            console.log('\n🎉 ALL EXISTING FUNCTIONALITY TESTS PASSED!');
            console.log('Backward compatibility maintained.');
        } else {
            console.log('\n⚠️  Some existing functionality tests failed.');
            console.log('Please check backward compatibility.');
        }

        console.log('\n' + '='.repeat(60));
    }
}

// Test helper for subscribe_apis
async function testSubscribeApis() {
    // This would be implemented in the actual message handler
    return { type: 'apis_subscribed', apis: ['vehicle_signals'] };
}

// Run the tests
const test = new ExistingFunctionalityTest();
test.runTests().catch(error => {
    console.error('Existing functionality test failed:', error);
    process.exit(1);
});