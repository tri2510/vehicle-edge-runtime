#!/usr/bin/env node

/**
 * Test run_app functionality to match frontend interface
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

class RunAppTester {
    constructor() {
        this.ws = null;
        this.pendingResponses = new Map();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            console.log('🔗 Connecting to Vehicle Edge Runtime...');
            this.ws = new WebSocket(WS_URL);

            this.ws.on('open', () => {
                console.log('✅ Connected to Vehicle Edge Runtime');
                resolve();
            });

            this.ws.on('message', (data) => {
                const response = JSON.parse(data);
                const pending = this.pendingResponses.get(response.id);
                if (pending) {
                    pending.resolve(response);
                    this.pendingResponses.delete(response.id);
                }
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
            }, 15000);

            const originalResolve = resolve;
            resolve = (response) => {
                clearTimeout(timeout);
                originalResolve(response);
            };

            this.ws.send(JSON.stringify(message));
        });
    }

    async deployTestApp() {
        console.log('🚀 Deploying test app to use for run_app test...');

        const message = {
            type: 'deploy_request',
            id: 'deploy-for-run-test-' + Date.now(),
            code: `
import time
print("Test app for run_app functionality")
for i in range(10):
    print(f"Running cycle {i + 1}/10")
    time.sleep(1)
print("Test app completed")
`.trim(),
            prototype: {
                id: 'run-test-app-' + Date.now(),
                name: 'Run Test App',
                description: 'Test app for run_app functionality',
                version: '1.0.0'
            },
            vehicleId: 'test-vehicle-run',
            language: 'python'
        };

        try {
            const response = await this.sendMessage(message);

            if (response.status === 'started') {
                console.log('✅ Test app deployed successfully');
                console.log(`   App ID: ${response.appId}`);
                console.log(`   Execution ID: ${response.executionId}`);

                // Stop the app immediately so we can test run_app
                await this.sleep(2000);
                await this.stopApp(response.appId);
                await this.sleep(1000); // Wait for full stop

                return {
                    success: true,
                    appId: response.appId,
                    executionId: response.executionId
                };
            } else {
                console.error('❌ Deployment failed:', response.error);
                return { success: false, error: response.error };
            }
        } catch (error) {
            console.error('❌ Deployment error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async testRunApp(appId) {
        console.log('\n🏃 Testing run_app functionality...');

        const message = {
            type: 'run_app',
            id: 'run-test-' + Date.now(),
            appId: appId
        };

        try {
            console.log('📤 Sending run_app request:', JSON.stringify(message, null, 2));
            const response = await this.sendMessage(message);

            console.log('📥 Received run_app response:', JSON.stringify(response, null, 2));

            if (response.type === 'run_app-response') {
                console.log('✅ run_app request processed successfully');
                console.log(`   Status: ${response.status}`);
                console.log(`   Message: ${response.message}`);

                if (response.executionId) {
                    console.log(`   New Execution ID: ${response.executionId}`);
                }

                return {
                    success: true,
                    status: response.status,
                    executionId: response.executionId
                };
            } else {
                console.log('❌ Unexpected response type:', response.type);
                return { success: false, error: `Unexpected response type: ${response.type}` };
            }

        } catch (error) {
            console.error('❌ run_app request failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async stopApp(appId) {
        console.log(`\n🛑 Stopping application: ${appId}`);

        const message = {
            type: 'stop_app',
            id: 'stop-for-run-test-' + Date.now(),
            appId: appId
        };

        try {
            const response = await this.sendMessage(message);
            console.log('✅ Stop command sent successfully');
            return { success: true, response };
        } catch (error) {
            console.error('❌ Failed to stop app:', error.message);
            return { success: false, error: error.message };
        }
    }

    async listApps() {
        console.log('\n📋 Listing deployed applications...');

        const message = {
            type: 'list_deployed_apps',
            id: 'list-for-run-test-' + Date.now()
        };

        try {
            const response = await this.sendMessage(message);

            if (response.applications && response.applications.length > 0) {
                console.log(`📊 Found ${response.applications.length} deployed applications`);
                response.applications.forEach((app, index) => {
                    console.log(`  ${index + 1}. ${app.name} (${app.status}) - ID: ${app.app_id}`);
                });
            } else {
                console.log('📊 No deployed applications found');
            }

            return { success: true, applications: response.applications || [] };
        } catch (error) {
            console.error('❌ Failed to list applications:', error.message);
            return { success: false, error: error.message };
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async runTest() {
        try {
            console.log('🧪 Starting run_app Interface Test...\n');

            // Step 1: Connect to runtime
            await this.connect();

            // Step 2: List current apps
            await this.listApps();

            // Step 3: Deploy a test app and stop it
            const deploymentResult = await this.deployTestApp();
            if (!deploymentResult.success) {
                console.error('❌ Test failed: Could not deploy test app');
                return false;
            }

            // Step 4: Test run_app on the stopped app
            console.log('\n🎯 Testing run_app with appId:', deploymentResult.appId);
            const runAppResult = await this.testRunApp(deploymentResult.appId);

            // Step 5: List apps again to see if it's running
            console.log('\n📊 Checking app status after run_app...');
            await this.sleep(2000); // Wait for app to start
            await this.listApps();

            // Step 6: Test run_app on already running app (should return already_running)
            if (runAppResult.success) {
                console.log('\n🔄 Testing run_app on already running app...');
                const runAgainResult = await this.testRunApp(deploymentResult.appId);

                if (runAgainResult.success && runAgainResult.status === 'already_running') {
                    console.log('✅ Correctly handled already_running case');
                }
            }

            // Step 7: Cleanup - stop the app
            await this.stopApp(deploymentResult.appId);

            // Final result
            console.log('\n📋 FINAL TEST RESULT:');
            console.log('='.repeat(50));
            console.log(`run_app Interface Test: ${runAppResult.success ? 'PASS ✅' : 'FAIL ❌'}`);

            if (runAppResult.success) {
                console.log('🎉 SUCCESS: run_app message type is now supported!');
                console.log('🚀 Frontend team can use run_app for starting applications.');
            } else {
                console.log('⚠️  ISSUE: run_app functionality needs attention.');
            }

            return runAppResult.success;

        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
            return false;
        } finally {
            if (this.ws) {
                this.ws.close();
            }
        }
    }
}

// Main execution
async function main() {
    const tester = new RunAppTester();
    const success = await tester.runTest();
    process.exit(success ? 0 : 1);
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Test interrupted by user');
    process.exit(1);
});

// Run the test
main().catch(console.error);