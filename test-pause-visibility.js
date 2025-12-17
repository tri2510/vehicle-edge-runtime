#!/usr/bin/env node

/**
 * Test pause functionality and ensure apps remain visible in frontend
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

class PauseVisibilityTester {
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

    async testPauseVisibility() {
        console.log('🧪 Testing Pause Visibility Fix...\n');

        try {
            // Step 1: List current apps
            console.log('📋 Step 1: Listing current apps');
            const initialList = await this.sendMessage({
                type: 'list_deployed_apps',
                id: 'list-initial-' + Date.now()
            });

            console.log(`   Initial apps: ${initialList.applications?.length || 0}`);

            // Step 2: Deploy a test app
            console.log('\n🚀 Step 2: Deploying test app');
            const deployResponse = await this.sendMessage({
                type: 'deploy_request',
                id: 'deploy-pause-test-' + Date.now(),
                code: `
import time
import signal
import sys

def signal_handler(sig, frame):
    print("\\nReceived shutdown signal, exiting gracefully")
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
print("Pause visibility test app starting")
counter = 0
while True:
    print(f"Pause test cycle {counter}")
    counter += 1
    time.sleep(2)
`.trim(),
                prototype: {
                    id: 'pause-visibility-test-' + Date.now(),
                    name: 'Pause Visibility Test App',
                    description: 'Test app for pause visibility',
                    version: '1.0.0'
                },
                vehicleId: 'test-vehicle-pause-visibility',
                language: 'python'
            });

            if (deployResponse.status !== 'started') {
                console.log('❌ Deployment failed:', deployResponse.error);
                return false;
            }

            const testAppId = deployResponse.appId;
            const testExecutionId = deployResponse.executionId;
            console.log(`✅ App deployed - AppId: ${testAppId}, ExecutionId: ${testExecutionId}`);

            // Step 3: Wait for app to initialize
            console.log('\n⏳ Step 3: Waiting for app to initialize...');
            await this.sleep(3000);

            // Step 4: List apps - should see running app
            console.log('\n📋 Step 4: Listing apps - should show running app');
            const runningList = await this.sendMessage({
                type: 'list_deployed_apps',
                id: 'list-running-' + Date.now()
            });

            console.log(`   Apps after deployment: ${runningList.applications?.length || 0}`);
            const runningApp = runningList.applications?.find(app => app.app_id === testExecutionId);
            if (runningApp) {
                console.log(`   ✅ Found running app: ${runningApp.name} (${runningApp.status})`);
            } else {
                console.log('   ❌ Running app not found in list');
                return false;
            }

            // Step 5: Pause the app
            console.log('\n⏸️ Step 5: Pausing the app');
            const pauseResponse = await this.sendMessage({
                type: 'pause_app',
                id: 'pause-test-' + Date.now(),
                appId: testExecutionId  // Use executionId like frontend does
            });

            if (pauseResponse.type === 'app_paused') {
                console.log('✅ App paused successfully');
            } else {
                console.log('❌ Pause failed:', pauseResponse);
                return false;
            }

            // Step 6: Wait for pause to complete
            console.log('\n⏳ Step 6: Waiting for pause to complete...');
            await this.sleep(2000);

            // Step 7: List apps - should STILL see paused app (this is the fix)
            console.log('\n📋 Step 7: Listing apps - should STILL show paused app (THE FIX)');
            const pausedList = await this.sendMessage({
                type: 'list_deployed_apps',
                id: 'list-paused-' + Date.now()
            });

            console.log(`   Apps after pause: ${pausedList.applications?.length || 0}`);
            console.log(`   Stats: ${JSON.stringify(pausedList.stats)}`);

            const pausedApp = pausedList.applications?.find(app => app.app_id === testExecutionId);
            if (pausedApp) {
                console.log(`   ✅ SUCCESS: Paused app still visible: ${pausedApp.name} (${pausedApp.status})`);
                console.log(`   🎯 This proves the fix works - paused apps no longer disappear!`);
            } else {
                console.log('   ❌ FAILED: Paused app disappeared from list');
                return false;
            }

            // Step 8: Resume the app
            console.log('\n▶️ Step 8: Resuming the app');
            const resumeResponse = await this.sendMessage({
                type: 'resume_app',
                id: 'resume-test-' + Date.now(),
                appId: testExecutionId
            });

            if (resumeResponse.type === 'app_resumed') {
                console.log('✅ App resumed successfully');
            } else {
                console.log('❌ Resume failed:', resumeResponse);
                return false;
            }

            // Step 9: Wait for resume to complete
            console.log('\n⏳ Step 9: Waiting for resume to complete...');
            await this.sleep(2000);

            // Step 10: Final list - should show running app again
            console.log('\n📋 Step 10: Final listing - should show running app again');
            const finalList = await this.sendMessage({
                type: 'list_deployed_apps',
                id: 'list-final-' + Date.now()
            });

            console.log(`   Final apps: ${finalList.applications?.length || 0}`);
            console.log(`   Final stats: ${JSON.stringify(finalList.stats)}`);

            const finalApp = finalList.applications?.find(app => app.app_id === testExecutionId);
            if (finalApp && finalApp.status === 'running') {
                console.log(`   ✅ App running again: ${finalApp.name} (${finalApp.status})`);
            } else {
                console.log('❌ App did not resume properly');
                return false;
            }

            // Step 11: Cleanup - stop the app
            console.log('\n🛑 Step 11: Cleanup - stopping test app');
            const stopResponse = await this.sendMessage({
                type: 'stop_app',
                id: 'cleanup-stop-' + Date.now(),
                appId: testExecutionId
            });

            if (stopResponse.type === 'stop_app-response') {
                console.log('✅ Test app stopped for cleanup');
            }

            return true;

        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
            return false;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async runTest() {
        try {
            await this.connect();
            const success = await this.testPauseVisibility();

            console.log('\n📋 FINAL RESULT:');
            console.log('='.repeat(50));
            console.log(`Pause Visibility Test: ${success ? 'PASS ✅' : 'FAIL ❌'}`);

            if (success) {
                console.log('🎉 SUCCESS: Apps remain visible when paused!');
                console.log('🚀 Frontend pause functionality now works correctly.');
                console.log('📊 Enhanced API provides full lifecycle visibility.');
            } else {
                console.log('⚠️  ISSUE: Pause visibility still needs work.');
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
    const tester = new PauseVisibilityTester();
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