#!/usr/bin/env node

/**
 * Comprehensive test to verify Vehicle Edge Runtime deployment fixes
 * Tests both Kit Manager and Direct WebSocket deployments
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const WS_URL = 'ws://localhost:3002/runtime';

class DeploymentTester {
    constructor() {
        this.ws = null;
        this.testResults = [];
        this.messageHandlers = new Map();
        this.pendingResponses = new Map();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            console.log('🔗 Connecting to Vehicle Edge Runtime...');
            this.ws = new WebSocket(WS_URL);

            this.ws.on('open', () => {
                console.log('✅ Connected to Vehicle Edge Runtime');
                this.setupMessageHandlers();
                resolve();
            });

            this.ws.on('message', (data) => {
                const response = JSON.parse(data);
                this.handleResponse(response);
            });

            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error.message);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('❌ WebSocket connection closed');
            });
        });
    }

    setupMessageHandlers() {
        this.messageHandlers.set('deploy_request-response', (response) => {
            const pending = this.pendingResponses.get(response.id);
            if (pending) {
                pending.resolve(response);
                this.pendingResponses.delete(response.id);
            }
        });

        this.messageHandlers.set('list_deployed_apps-response', (response) => {
            const pending = this.pendingResponses.get(response.id);
            if (pending) {
                pending.resolve(response);
                this.pendingResponses.delete(response.id);
            }
        });

        this.messageHandlers.set('stop_app-response', (response) => {
            const pending = this.pendingResponses.get(response.id);
            if (pending) {
                pending.resolve(response);
                this.pendingResponses.delete(response.id);
            }
        });
    }

    handleResponse(response) {
        const handler = this.messageHandlers.get(response.type);
        if (handler) {
            handler(response);
        } else {
            console.log('📩 Received unhandled message:', response.type);
        }
    }

    sendMessage(message) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            const messageId = message.id;
            this.pendingResponses.set(messageId, { resolve, reject });

            // Set timeout
            const timeout = setTimeout(() => {
                if (this.pendingResponses.has(messageId)) {
                    this.pendingResponses.delete(messageId);
                    reject(new Error(`Message timeout: ${message.type}`));
                }
            }, 10000); // 10 second timeout

            const originalResolve = resolve;
            resolve = (response) => {
                clearTimeout(timeout);
                originalResolve(response);
            };

            this.ws.send(JSON.stringify(message));
        });
    }

    async deployPythonApp(appConfig) {
        console.log(`🚀 Deploying Python app: ${appConfig.name}`);

        const message = {
            type: 'deploy_request',
            id: 'deploy-test-' + uuidv4(),
            code: appConfig.code,
            prototype: {
                id: appConfig.id,
                name: appConfig.name,
                description: appConfig.description,
                version: appConfig.version || '1.0.0'
            },
            vehicleId: appConfig.vehicleId || 'test-vehicle-123',
            language: 'python'
        };

        try {
            const response = await this.sendMessage(message);

            const result = {
                success: response.status === 'started',
                appId: response.appId,
                executionId: response.executionId,
                containerId: response.containerId,
                message: response.result,
                error: response.error,
                testConfig: appConfig
            };

            this.testResults.push({
                test: `Deploy ${appConfig.name}`,
                status: result.success ? 'PASS' : 'FAIL',
                details: result
            });

            console.log(`${result.success ? '✅' : '❌'} Deployment ${result.success ? 'succeeded' : 'failed'}: ${result.message || result.error}`);

            return result;
        } catch (error) {
            console.error(`❌ Deployment failed: ${error.message}`);
            this.testResults.push({
                test: `Deploy ${appConfig.name}`,
                status: 'FAIL',
                details: { error: error.message }
            });
            throw error;
        }
    }

    async listDeployedApps() {
        console.log('📋 Listing deployed applications...');

        const message = {
            type: 'list_deployed_apps',
            id: 'list-test-' + uuidv4()
        };

        try {
            const response = await this.sendMessage(message);

            const result = {
                success: true,
                applications: response.applications || response.apps || [],
                totalCount: response.total_count || response.applications?.length || 0,
                response: response
            };

            console.log(`📊 Found ${result.totalCount} deployed applications`);

            return result;
        } catch (error) {
            console.error(`❌ Failed to list applications: ${error.message}`);
            throw error;
        }
    }

    async stopApp(appId) {
        console.log(`🛑 Stopping application: ${appId}`);

        const message = {
            type: 'stop_app',
            id: 'stop-test-' + uuidv4(),
            appId: appId
        };

        try {
            const response = await this.sendMessage(message);

            const result = {
                success: true,
                appId: appId,
                response: response
            };

            console.log(`✅ Application stop initiated: ${appId}`);

            return result;
        } catch (error) {
            console.error(`❌ Failed to stop application ${appId}: ${error.message}`);
            throw error;
        }
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async runComprehensiveTest() {
        console.log('🧪 Starting comprehensive deployment test...\n');

        const testApps = [
            {
                id: 'test-app-simple-' + Date.now(),
                name: 'Simple Print App',
                description: 'Test app that prints messages',
                code: `
import time
print("Simple app starting")
for i in range(5):
    print(f"Cycle {i + 1}/5")
    time.sleep(1)
print("Simple app completed")
`.trim(),
                vehicleId: 'test-vehicle-1'
            },
            {
                id: 'test-app-loop-' + Date.now(),
                name: 'Long Running Loop App',
                description: 'Test app that runs for longer period',
                code: `
import time
import signal
import sys

def signal_handler(sig, frame):
    print("\\nReceived shutdown signal, exiting gracefully")
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
print("Long running app starting")

counter = 0
while True:
    print(f"Long running cycle {counter}")
    counter += 1
    time.sleep(2)
`.trim(),
                vehicleId: 'test-vehicle-2'
            },
            {
                id: 'test-app-error-' + Date.now(),
                name: 'Error App',
                description: 'Test app that encounters an error',
                code: `
print("Error app starting")
print("About to cause an error")
# This will cause a syntax error
invalid_function_call()
print("This should never be reached")
`.trim(),
                vehicleId: 'test-vehicle-3'
            }
        ];

        const deploymentResults = [];
        let expectedRunningApps = 0;

        // Deploy all test apps
        for (const appConfig of testApps) {
            try {
                const result = await this.deployPythonApp(appConfig);
                deploymentResults.push(result);
                if (result.success && appConfig.name !== 'Error App') {
                    expectedRunningApps++;
                }
                await this.wait(1000); // Wait between deployments
            } catch (error) {
                console.error(`Failed to deploy ${appConfig.name}:`, error.message);
            }
        }

        // Wait for apps to initialize
        console.log('\n⏳ Waiting for applications to initialize...');
        await this.wait(3000);

        // List deployed apps
        console.log('\n📊 Checking deployed applications...');
        let deployedApps = [];
        try {
            const listResult = await this.listDeployedApps();
            deployedApps = listResult.applications;
        } catch (error) {
            console.error('Failed to list deployed apps:', error.message);
        }

        // Verify our deployments appear in the list
        console.log('\n🔍 Verifying deployments appear in frontend list...');
        let foundInList = 0;
        for (const deployment of deploymentResults) {
            if (deployment.success) {
                const found = deployedApps.some(app =>
                    app.app_id === deployment.executionId ||
                    app.name === deployment.appId
                );

                if (found) {
                    foundInList++;
                    console.log(`✅ ${deployment.testConfig.name} found in frontend list`);
                } else {
                    console.log(`❌ ${deployment.testConfig.name} NOT found in frontend list`);
                    console.log(`   Looking for executionId: ${deployment.executionId}`);
                    console.log(`   Available apps:`, deployedApps.map(app => ({
                        app_id: app.app_id,
                        name: app.name,
                        status: app.status
                    })));
                }
            }
        }

        // Test frontend functionality
        console.log('\n🎯 Testing frontend management functions...');

        // Test stop functionality
        if (deploymentResults.length > 0) {
            const testApp = deploymentResults.find(r => r.success && r.testConfig.name !== 'Error App');
            if (testApp) {
                try {
                    await this.stopApp(testApp.appId);
                    console.log('✅ Stop app functionality works');

                    // Wait and verify app status changed
                    await this.wait(2000);

                    const listAfterStop = await this.listDeployedApps();
                    const stoppedApp = listAfterStop.applications.find(app =>
                        app.app_id === testApp.executionId ||
                        app.name === testApp.appId
                    );

                    if (stoppedApp && stoppedApp.status !== 'running') {
                        console.log('✅ App status correctly updated after stop');
                    } else {
                        console.log('❌ App status not updated after stop');
                    }
                } catch (error) {
                    console.log('❌ Stop app functionality failed:', error.message);
                }
            }
        }

        // Cleanup remaining apps
        console.log('\n🧹 Cleaning up test applications...');
        for (const deployment of deploymentResults) {
            if (deployment.success) {
                try {
                    await this.stopApp(deployment.appId);
                } catch (error) {
                    console.log(`Warning: Failed to cleanup ${deployment.appId}:`, error.message);
                }
            }
        }

        // Final report
        console.log('\n📋 FINAL TEST REPORT');
        console.log('='.repeat(50));

        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
        const failedTests = totalTests - passedTests;

        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests} ✅`);
        console.log(`Failed: ${failedTests} ❌`);

        console.log('\n📊 Frontend Integration Test:');
        console.log(`Expected apps in frontend: ${expectedRunningApps}`);
        console.log(`Apps found in frontend: ${foundInList}`);

        const frontendSuccess = foundInList === expectedRunningApps;
        console.log(`Frontend test: ${frontendSuccess ? 'PASS ✅' : 'FAIL ❌'}`);

        console.log('\n📝 Test Results Details:');
        this.testResults.forEach(result => {
            console.log(`  ${result.status === 'PASS' ? '✅' : '❌'} ${result.test}`);
            if (result.status === 'FAIL' && result.details.error) {
                console.log(`     Error: ${result.details.error}`);
            }
        });

        if (failedTests === 0 && frontendSuccess) {
            console.log('\n🎉 ALL TESTS PASSED! The deployment fixes are working correctly.');
            return true;
        } else {
            console.log('\n⚠️  SOME TESTS FAILED. Please review the results above.');
            return false;
        }
    }
}

// Main execution
async function main() {
    const tester = new DeploymentTester();

    try {
        await tester.connect();
        const success = await tester.runComprehensiveTest();

        if (tester.ws) {
            tester.ws.close();
        }

        process.exit(success ? 0 : 1);

    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Test interrupted by user');
    process.exit(1);
});

// Run the test
main().catch(console.error);