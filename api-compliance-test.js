#!/usr/bin/env node

/**
 * API Specification Compliance Test
 * Tests all APIs documented in API_SPEC.md against the actual implementation
 * Using correct default ports: WebSocket 3002, HTTP 3003
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';

const WS_URL = 'ws://localhost:3002/runtime';
const HTTP_URL = 'http://localhost:3003';

class APISpecComplianceTest {
    constructor() {
        this.testResults = [];
        this.ws = null;
        this.pendingRequests = new Map();
        this.testApp = {
            id: 'api-compliance-test-' + Date.now(),
            name: 'API Compliance Test App',
            version: '1.0.0',
            description: 'Test app for API specification compliance',
            type: 'python',
            code: `
import time
print("API Compliance Test App Started")
for i in range(3):
    print(f"Processing step {i+1}/3")
    time.sleep(0.5)
print("API Compliance Test App Completed")
            `,
            entryPoint: 'app.py',
            python_deps: ['requests==2.28.0'],
            vehicle_signals: ['Vehicle.Speed', 'Vehicle.Steering.Angle']
        };
    }

    async runAllTests() {
        console.log('🧪 Starting API Specification Compliance Tests');
        console.log(`WebSocket URL: ${WS_URL}`);
        console.log(`HTTP URL: ${HTTP_URL}\n`);

        try {
            // Test HTTP Health Check
            await this.testHTTPHealthCheck();

            // WebSocket Connection Test
            await this.testWebSocketConnection();

            // Core API Tests
            await this.testPingPong();
            await this.testApplicationLifecycle();
            await this.testApplicationListing();
            await this.testApplicationLogs();
            await this.testConsoleStreaming();
            await this.testVehicleSignals();
            await this.testRuntimeStatus();
            await this.testConfiguration();

            // Summary
            this.printTestSummary();

        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        } finally {
            if (this.ws) {
                this.ws.close();
            }
        }
    }

    async testHTTPHealthCheck() {
        console.log('🌐 Testing HTTP Health Check...');

        try {
            const response = await this.makeHTTPRequest('/health');
            this.addResult('HTTP Health Check', true, 'Health check responded');
            console.log('   ✅ Health check working');
        } catch (error) {
            this.addResult('HTTP Health Check', false, error.message);
            console.log('   ❌ Health check failed:', error.message);
        }
    }

    async testWebSocketConnection() {
        console.log('🔌 Testing WebSocket Connection...');

        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(WS_URL);

            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 5000);

            this.ws.on('open', () => {
                clearTimeout(timeout);

                // Set up message handler
                this.ws.on('message', (data) => {
                    this.handleWebSocketMessage(data);
                });

                this.ws.on('error', (error) => {
                    console.error('WebSocket error:', error.message);
                });

                this.addResult('WebSocket Connection', true, 'Connected successfully');
                console.log('   ✅ WebSocket connected');
                resolve();
            });

            this.ws.on('error', (error) => {
                clearTimeout(timeout);
                this.addResult('WebSocket Connection', false, error.message);
                reject(error);
            });
        });
    }

    async testPingPong() {
        console.log('🏓 Testing Ping/Pong...');

        try {
            const response = await this.sendMessage({
                type: 'ping'
            });

            const isValid = response.type === 'pong' && response.id && response.timestamp;
            this.addResult('Ping/Pong', isValid, `Response type: ${response.type}`);
            console.log('   ✅ Ping/Pong working');
        } catch (error) {
            this.addResult('Ping/Pong', false, error.message);
            console.log('   ❌ Ping/Pong failed:', error.message);
        }
    }

    async testApplicationLifecycle() {
        console.log('🚀 Testing Application Lifecycle...');

        try {
            // Test 1: Install Application
            console.log('   📦 Installing application...');
            const installResponse = await this.sendMessage({
                type: 'install_app',
                appData: this.testApp
            });

            const installValid = installResponse.type === 'app_installed' &&
                               installResponse.appId === this.testApp.id;
            this.addResult('Install App', installValid, `Status: ${installResponse.status}`);
            console.log('   ✅ Application installed');

            // Test 2: Get Application Status
            console.log('   📊 Getting application status...');
            const statusResponse = await this.sendMessage({
                type: 'get_app_status',
                appId: this.testApp.id
            });

            const statusValid = statusResponse.type === 'app_status' &&
                               statusResponse.status.appId === this.testApp.id;
            this.addResult('Get App Status', statusValid, `State: ${statusResponse.status?.state}`);
            console.log('   ✅ Application status retrieved');

            // Test 3: Run Application
            console.log('   ▶️ Running application...');
            const runResponse = await this.sendMessage({
                type: 'run_python_app',
                appId: this.testApp.id
            });

            const runValid = runResponse.type === 'python_app_started' &&
                           runResponse.appId === this.testApp.id;
            this.addResult('Run App', runValid, `Execution ID: ${runResponse.executionId}`);
            console.log('   ✅ Application started');

            // Wait a bit for the app to run
            await this.sleep(2000);

            // Test 4: Stop Application
            console.log('   ⏹️ Stopping application...');
            const stopResponse = await this.sendMessage({
                type: 'stop_app',
                appId: this.testApp.id
            });

            const stopValid = stopResponse.type === 'app_stopped' &&
                            stopResponse.appId === this.testApp.id;
            this.addResult('Stop App', stopValid, `Exit code: ${stopResponse.exitCode}`);
            console.log('   ✅ Application stopped');

            // Test 5: Uninstall Application
            console.log('   🗑️ Uninstalling application...');
            const uninstallResponse = await this.sendMessage({
                type: 'uninstall_app',
                appId: this.testApp.id
            });

            const uninstallValid = uninstallResponse.type === 'app_uninstalled' &&
                                  uninstallResponse.appId === this.testApp.id;
            this.addResult('Uninstall App', uninstallValid, `Status: ${uninstallResponse.status}`);
            console.log('   ✅ Application uninstalled');

        } catch (error) {
            this.addResult('Application Lifecycle', false, error.message);
            console.log('   ❌ Application lifecycle test failed:', error.message);
        }
    }

    async testApplicationListing() {
        console.log('📋 Testing Application Listing...');

        try {
            // Test list apps with filters
            const response = await this.sendMessage({
                type: 'list_apps',
                filters: {
                    type: 'python'
                }
            });

            const isValid = response.type === 'apps_list' &&
                           Array.isArray(response.apps) &&
                           typeof response.count === 'number';

            this.addResult('List Apps', isValid, `Found ${response.count} apps`);
            console.log('   ✅ Application listing working');
        } catch (error) {
            this.addResult('List Apps', false, error.message);
            console.log('   ❌ Application listing failed:', error.message);
        }
    }

    async testApplicationLogs() {
        console.log('📝 Testing Application Logs...');

        try {
            const response = await this.sendMessage({
                type: 'get_app_logs',
                appId: this.testApp.id,
                options: {
                    limit: 50,
                    level: 'info'
                }
            });

            const isValid = response.type === 'app_logs' &&
                           Array.isArray(response.logs);

            this.addResult('Get App Logs', isValid, `Found ${response.logs.length} log entries`);
            console.log('   ✅ Application logs working');
        } catch (error) {
            this.addResult('Get App Logs', false, error.message);
            console.log('   ❌ Application logs failed:', error.message);
        }
    }

    async testConsoleStreaming() {
        console.log('🖥️ Testing Console Streaming...');

        try {
            // Test console subscription
            const subscribeResponse = await this.sendMessage({
                type: 'console_subscribe',
                executionId: 'test-execution-id'
            });

            const subscribeValid = subscribeResponse.type === 'console_subscribed';
            this.addResult('Console Subscribe', subscribeValid, `Client ID: ${subscribeResponse.clientId}`);

            // Test console unsubscribe
            const unsubscribeResponse = await this.sendMessage({
                type: 'console_unsubscribe',
                executionId: 'test-execution-id'
            });

            const unsubscribeValid = unsubscribeResponse.type === 'console_unsubscribed';
            this.addResult('Console Unsubscribe', unsubscribeValid);

            console.log('   ✅ Console streaming working');
        } catch (error) {
            this.addResult('Console Streaming', false, error.message);
            console.log('   ❌ Console streaming failed:', error.message);
        }
    }

    async testVehicleSignals() {
        console.log('🚗 Testing Vehicle Signals...');

        try {
            // Test signal subscription
            const subscribeResponse = await this.sendMessage({
                type: 'subscribe_apis',
                apis: [
                    { path: 'Vehicle.Speed', access: 'read' },
                    { path: 'Vehicle.Steering.Angle', access: 'read' }
                ]
            });

            const subscribeValid = subscribeResponse.type === 'apis_subscribed' &&
                                  Array.isArray(subscribeResponse.apis);
            this.addResult('Subscribe Signals', subscribeValid, `Subscribed to ${subscribeResponse.apis.length} signals`);

            // Test get signal values
            const getSignalsResponse = await this.sendMessage({
                type: 'get_signals_value',
                apis: ['Vehicle.Speed', 'Vehicle.Steering.Angle']
            });

            const getSignalsValid = getSignalsResponse.type === 'signals_value_response' &&
                                   typeof getSignalsResponse.result === 'object';
            this.addResult('Get Signals', getSignalsValid, `Retrieved signal values`);

            // Test write signal values
            const writeSignalsResponse = await this.sendMessage({
                type: 'write_signals_value',
                data: {
                    'Vehicle.Cabin.Lights.IsOn': true
                }
            });

            const writeSignalsValid = writeSignalsResponse.type === 'signals_written';
            this.addResult('Write Signals', writeSignalsValid, `Wrote signal values`);

            console.log('   ✅ Vehicle signals working');
        } catch (error) {
            this.addResult('Vehicle Signals', false, error.message);
            console.log('   ❌ Vehicle signals failed:', error.message);
        }
    }

    async testRuntimeStatus() {
        console.log('📈 Testing Runtime Status...');

        try {
            // Test runtime state
            const stateResponse = await this.sendMessage({
                type: 'report_runtime_state'
            });

            const stateValid = stateResponse.type === 'runtime_state_response' &&
                             stateResponse.runtimeState.runtimeId;
            this.addResult('Runtime State', stateValid, `Runtime ID: ${stateResponse.runtimeState.runtimeId}`);

            // Test runtime info
            const infoResponse = await this.sendMessage({
                type: 'get_runtime_info'
            });

            const infoValid = infoResponse.type === 'get-runtime-info-response' &&
                             infoResponse.kit_id;
            this.addResult('Runtime Info', infoValid, `Kit ID: ${infoResponse.kit_id}`);

            console.log('   ✅ Runtime status working');
        } catch (error) {
            this.addResult('Runtime Status', false, error.message);
            console.log('   ❌ Runtime status failed:', error.message);
        }
    }

    async testConfiguration() {
        console.log('⚙️ Testing Configuration Management...');

        try {
            // Test VSS config
            const vssResponse = await this.sendMessage({
                type: 'get_vss_config'
            });

            const vssValid = vssResponse.type === 'get_vss_config-response' &&
                           vssResponse.vss_config;
            this.addResult('VSS Config', vssValid, `VSS version: ${vssResponse.vss_config?.version}`);

            // Test signal conflict checking
            const conflictResponse = await this.sendMessage({
                type: 'check_signal_conflicts',
                app_id: 'test-app',
                signals: [
                    { signal: 'Vehicle.Speed', access: 'read' }
                ]
            });

            const conflictValid = conflictResponse.type === 'check_signal_conflicts-response' &&
                                 conflictResponse.deployment_precheck;
            this.addResult('Signal Conflicts', conflictValid, `Deployment approved: ${conflictResponse.deployment_precheck?.deployment_approved}`);

            // Test mock signals
            const mockResponse = await this.sendMessage({
                type: 'list_mock_signal'
            });

            const mockValid = mockResponse.type === 'mock_signal_list';
            this.addResult('Mock Signals', mockValid, `Mock signals listed`);

            console.log('   ✅ Configuration management working');
        } catch (error) {
            this.addResult('Configuration', false, error.message);
            console.log('   ❌ Configuration management failed:', error.message);
        }
    }

    // Helper methods
    async sendMessage(message) {
        return new Promise((resolve, reject) => {
            const messageId = uuidv4();
            const messageWithId = { ...message, id: messageId, timestamp: new Date().toISOString() };

            const timeout = setTimeout(() => {
                this.pendingRequests.delete(messageId);
                reject(new Error(`Message timeout: ${message.type}`));
            }, 10000);

            this.pendingRequests.set(messageId, { resolve, reject, timeout });

            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(messageWithId));
            } else {
                reject(new Error('WebSocket not connected'));
            }
        });
    }

    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data.toString());

            if (message.id && this.pendingRequests.has(message.id)) {
                const { resolve, timeout } = this.pendingRequests.get(message.id);
                clearTimeout(timeout);
                this.pendingRequests.delete(message.id);
                resolve(message);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    }

    async makeHTTPRequest(path) {
        return new Promise((resolve, reject) => {
            const req = http.get(`${HTTP_URL}${path}`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    }
                });
            });

            req.on('error', reject);
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('HTTP request timeout'));
            });
        });
    }

    addResult(testName, passed, details = '') {
        this.testResults.push({
            name: testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printTestSummary() {
        console.log('\n📊 Test Results Summary');
        console.log('='.repeat(50));

        const passed = this.testResults.filter(r => r.passed).length;
        const failed = this.testResults.filter(r => !r.passed).length;
        const total = this.testResults.length;

        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

        console.log('\nDetailed Results:');
        this.testResults.forEach(result => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${status} ${result.name}`);
            if (result.details) {
                console.log(`    ${result.details}`);
            }
        });

        if (failed === 0) {
            console.log('\n🎉 All API specification tests passed!');
            console.log('✅ The Vehicle Edge Runtime API works exactly as documented.');
        } else {
            console.log('\n⚠️ Some API specification tests failed.');
            console.log('❌ Please review the implementation against the API specification.');
        }
    }
}

// Run the tests
const tester = new APISpecComplianceTest();
tester.runAllTests()
    .then(() => {
        const failed = tester.testResults.filter(r => !r.passed).length;
        process.exit(failed > 0 ? 1 : 0);
    })
    .catch((error) => {
        console.error('Test suite error:', error);
        process.exit(1);
    });