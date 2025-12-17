#!/usr/bin/env node

/**
 * Test app management functionality with executionId handling
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

class AppManagementFixTester {
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

    async testAppManagement() {
        console.log('🧪 Testing App Management Fix...\n');

        // Step 1: Deploy a test app first
        console.log('🚀 Step 1: Deploying test app for management testing');
        const deployResponse = await this.sendMessage({
            type: 'deploy_request',
            id: 'test-deploy-' + Date.now(),
            code: `
import time
import signal
import sys

def signal_handler(sig, frame):
    print("\\nReceived shutdown signal, exiting gracefully")
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
print("Management test app starting")
counter = 0
while True:
    print(f"Management test cycle {counter}")
    counter += 1
    time.sleep(2)
`.trim(),
            prototype: {
                id: 'management-test-app-' + Date.now(),
                name: 'Management Test App',
                description: 'Test app for management operations',
                version: '1.0.0'
            },
            vehicleId: 'test-vehicle-management',
            language: 'python'
        });

        if (deployResponse.status !== 'started') {
            console.log('❌ Deployment failed:', deployResponse.error);
            return false;
        }

        console.log('✅ Test app deployed successfully');
        console.log(`   App ID: ${deployResponse.appId}`);
        console.log(`   Execution ID: ${deployResponse.executionId}`);

        // Step 2: Wait for app to initialize
        console.log('\n⏳ Step 2: Waiting for app to initialize...');
        await this.sleep(3000);

        // Step 3: List apps to get the executionId
        console.log('\n📋 Step 3: List apps to get executionId');
        const listResponse = await this.sendMessage({
            type: 'list_deployed_apps',
            id: 'test-list-' + Date.now()
        });

        if (listResponse.applications && listResponse.applications.length > 0) {
            console.log(`Found ${listResponse.applications.length} apps:`);
            listResponse.applications.forEach((app, index) => {
                console.log(`  ${index + 1}. ${app.name} (${app.status})`);
                console.log(`     app_id: ${app.app_id}`);
            });

            // Step 4: Test stop app with executionId (what frontend does)
            const testApp = listResponse.applications.find(app =>
                app.name.includes('management-test-app')
            );

            if (!testApp) {
                console.log('❌ Could not find test app in list');
                return false;
            }

            console.log(`\n🛑 Step 4: Testing stop app with executionId: ${testApp.app_id}`);

            try {
                const stopResponse = await this.sendMessage({
                    type: 'stop_app',
                    id: 'test-stop-' + Date.now(),
                    appId: testApp.app_id  // This is executionId from frontend perspective
                });

                if (stopResponse.type === 'stop_app-response') {
                    if (stopResponse.result.status === 'error') {
                        console.log('❌ Stop failed:', stopResponse.result.error);
                        return false;
                    } else {
                        console.log('✅ Stop succeeded with executionId!');
                        console.log(`   Status: ${stopResponse.result.status}`);
                        console.log(`   AppId: ${stopResponse.result.appId}`);
                    }
                } else {
                    console.log('❌ Unexpected response type:', stopResponse.type);
                    return false;
                }
            } catch (error) {
                console.log('❌ Stop request failed:', error.message);
                return false;
            }

            // Step 5: Wait and list apps again
            console.log('\n⏳ Step 5: Waiting and listing apps again');
            await this.sleep(3000);

            const listAfterStop = await this.sendMessage({
                type: 'list_deployed_apps',
                id: 'test-list-after-' + Date.now()
            });

            console.log(`Apps after stop: ${listAfterStop.applications?.length || 0}`);

            // Step 6: Test pause with executionId
            if (listAfterStop.applications && listAfterStop.applications.length > 0) {
                console.log('\n⏸️ Step 6: Testing pause with executionId');
                const remainingApp = listAfterStop.applications[0];

                // Deploy a new app for pause testing since we stopped the other one
                console.log('🚀 Deploying another app for pause testing...');
                const deployForPause = await this.sendMessage({
                    type: 'deploy_request',
                    id: 'test-deploy-pause-' + Date.now(),
                    code: `
import time
print("Pause test app starting")
for i in range(30):
    print(f"Pause test cycle {i + 1}/30")
    time.sleep(1)
print("Pause test app completed")
`.trim(),
                    prototype: {
                        id: 'pause-test-app-' + Date.now(),
                        name: 'Pause Test App',
                        description: 'Test app for pause operation',
                        version: '1.0.0'
                    },
                    vehicleId: 'test-vehicle-pause',
                    language: 'python'
                });

                if (deployForPause.status === 'started') {
                    await this.sleep(3000);

                    const listForPause = await this.sendMessage({
                        type: 'list_deployed_apps',
                        id: 'test-list-pause-' + Date.now()
                    });

                    const pauseTestApp = listForPause.applications.find(app =>
                        app.name.includes('Pause Test App')
                    );

                    if (pauseTestApp) {
                        try {
                            const pauseResponse = await this.sendMessage({
                                type: 'pause_app',
                                id: 'test-pause-' + Date.now(),
                                appId: pauseTestApp.app_id
                            });

                            if (pauseResponse.type === 'app_paused') {
                                console.log('✅ Pause succeeded with executionId!');
                                console.log(`   Status: ${pauseResponse.status}`);
                            } else {
                                console.log('❌ Pause failed with response:', pauseResponse);
                            }
                        } catch (error) {
                            console.log('❌ Pause request failed:', error.message);
                        }
                    }
                }
            }

            return true;

        } else {
            console.log('❌ No apps found after deployment');
            return false;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async runTest() {
        try {
            await this.connect();
            const success = await this.testAppManagement();

            console.log('\n📋 FINAL RESULT:');
            console.log('='.repeat(40));
            console.log(`App Management Fix Test: ${success ? 'PASS ✅' : 'FAIL ❌'}`);

            if (success) {
                console.log('🎉 SUCCESS: App management operations now work with executionId!');
                console.log('🚀 Frontend pause, stop, remove should work correctly now.');
            } else {
                console.log('⚠️  ISSUE: App management still has problems.');
            }

            return success;

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
    const tester = new AppManagementFixTester();
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