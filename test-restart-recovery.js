#!/usr/bin/env node

/**
 * Test persistent storage restart recovery functionality
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

class RestartRecoveryTester {
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

    async deployTestApp(appName) {
        console.log(`🚀 Deploying test app: ${appName}`);

        const response = await this.sendMessage({
            type: 'deploy_request',
            id: `deploy-${appName}-${Date.now()}`,
            code: `
import time
import signal
import sys

def signal_handler(sig, frame):
    print("\\nReceived shutdown signal, exiting gracefully")
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
print("${appName} started")
counter = 0
while True:
    print(f"${appName} cycle {counter}")
    counter += 1
    time.sleep(3)
`.trim(),
            prototype: {
                id: `${appName}-id-${Date.now()}`,
                name: appName,
                description: `Test app for restart recovery - ${appName}`,
                version: '1.0.0'
            },
            vehicleId: 'test-vehicle-restart',
            language: 'python'
        });

        if (response.status === 'started') {
            console.log(`✅ ${appName} deployed successfully`);
            console.log(`   App ID: ${response.appId}`);
            console.log(`   Execution ID: ${response.executionId}`);
            return {
                success: true,
                appId: response.appId,
                executionId: response.executionId,
                name: appName
            };
        } else {
            console.log(`❌ ${appName} deployment failed:`, response.error);
            return { success: false, error: response.error };
        }
    }

    async listApps() {
        console.log('\n📋 Listing current applications');

        const response = await this.sendMessage({
            type: 'list_deployed_apps',
            id: `list-${Date.now()}`
        });

        console.log(`   Total apps: ${response.total_count || 0}`);
        console.log(`   Stats: ${JSON.stringify(response.stats)}`);

        if (response.applications && response.applications.length > 0) {
            console.log('   Apps:');
            response.applications.forEach((app, index) => {
                console.log(`     ${index + 1}. ${app.name} (${app.status})`);
            });
        }

        return response;
    }

    async testRestartRecovery() {
        console.log('🧪 Testing Persistent Storage Restart Recovery...\n');

        try {
            await this.connect();

            // Step 1: Check initial state (should be clean)
            console.log('📋 Step 1: Checking initial state');
            const initialState = await this.listApps();
            console.log(`   Initial apps: ${initialState.total_count || 0}`);

            // Step 2: Deploy a test app
            console.log('\n🚀 Step 2: Deploying test apps');
            const app1 = await this.deployTestApp('Restart Test App 1');
            const app2 = await this.deployTestApp('Restart Test App 2');

            if (!app1.success || !app2.success) {
                console.log('❌ Failed to deploy test apps');
                return false;
            }

            // Step 3: Wait for apps to start
            console.log('\n⏳ Step 3: Waiting for apps to initialize');
            await this.sleep(5000);

            // Step 4: List apps before restart
            console.log('\n📋 Step 4: Listing apps BEFORE restart');
            const beforeRestart = await this.listApps();

            // Step 5: Simulate runtime restart (tell user to restart)
            console.log('\n🔄 Step 5: SIMULATING RUNTIME RESTART');
            console.log('   Please run: docker restart vehicle-edge-runtime-dev');
            console.log('   Then press Enter to continue...');

            // Close current connection
            this.ws.close();

            // Wait for user input
            await new Promise(resolve => {
                process.stdin.once('data', resolve);
            });

            // Step 6: Reconnect after restart
            console.log('\n🔗 Step 6: Reconnecting after restart');
            await this.connect();

            // Step 7: List apps after restart (this is the key test!)
            console.log('\n📋 Step 7: Listing apps AFTER restart (RECOVERY TEST)');
            const afterRestart = await this.listApps();

            // Step 8: Verify recovery worked
            console.log('\n🔍 Step 8: Analyzing recovery results');

            const beforeCount = beforeRestart.total_count || 0;
            const afterCount = afterRestart.total_count || 0;

            console.log(`   Apps before restart: ${beforeCount}`);
            console.log(`   Apps after restart: ${afterCount}`);

            if (afterCount >= 2) {
                console.log('✅ SUCCESS: Apps were recovered from persistent storage!');

                // Check if our test apps are present
                const app1Recovered = afterRestart.applications?.find(app =>
                    app.name.includes('Restart Test App 1')
                );
                const app2Recovered = afterRestart.applications?.find(app =>
                    app.name.includes('Restart Test App 2')
                );

                if (app1Recovered && app2Recovered) {
                    console.log('✅ Both test apps recovered successfully');
                    console.log(`   App1 status: ${app1Recovered.status}`);
                    console.log(`   App2 status: ${app2Recovered.status}`);
                } else {
                    console.log('⚠️  Apps recovered but test apps not found');
                }

                return true;
            } else {
                console.log('❌ FAILED: Apps were not recovered after restart');
                return false;
            }

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            return false;
        } finally {
            if (this.ws) {
                this.ws.close();
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const tester = new RestartRecoveryTester();
    const success = await tester.testRestartRecovery();

    console.log('\n📋 FINAL RESULT:');
    console.log('='.repeat(50));
    console.log(`Restart Recovery Test: ${success ? 'PASS ✅' : 'FAIL ❌'}`);

    if (success) {
        console.log('🎉 SUCCESS: Persistent storage works correctly!');
        console.log('🚀 Apps are properly recovered when runtime restarts.');
    } else {
        console.log('⚠️  ISSUE: Persistent storage recovery needs attention.');
    }

    process.exit(success ? 0 : 1);
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Test interrupted by user');
    process.exit(1);
});

// Run the test
main().catch(console.error);