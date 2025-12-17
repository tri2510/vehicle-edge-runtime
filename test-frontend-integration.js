#!/usr/bin/env node

/**
 * Test frontend integration with long-running application
 * Verifies that deployed apps appear in list_deployed_apps
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

class FrontendIntegrationTester {
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
            }, 15000); // 15 second timeout

            const originalResolve = resolve;
            resolve = (response) => {
                clearTimeout(timeout);
                originalResolve(response);
            };

            this.ws.send(JSON.stringify(message));
        });
    }

    async deployLongRunningApp() {
        console.log('🚀 Deploying long-running test application...');

        const longRunningAppCode = `
import time
import datetime

DURATION = 1200
INTERVAL = 10

start = time.time()
while time.time() - start < DURATION:
    elapsed = time.time() - start
    if int(elapsed) % INTERVAL == 0:
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] Elapsed: {elapsed:.0f}s")
    time.sleep(1)

print("\\nDone.")
`.trim();

        const message = {
            type: 'deploy_request',
            id: 'deploy-long-' + Date.now(),
            code: longRunningAppCode,
            prototype: {
                id: 'long-running-test-app-' + Date.now(),
                name: 'Long Running Test App',
                description: 'Test app that runs for 20 minutes to verify frontend integration',
                version: '1.0.0'
            },
            vehicleId: 'test-vehicle-frontend',
            language: 'python'
        };

        try {
            const response = await this.sendMessage(message);

            if (response.status === 'started') {
                console.log('✅ Long-running app deployed successfully');
                console.log(`   App ID: ${response.appId}`);
                console.log(`   Execution ID: ${response.executionId}`);
                console.log(`   Container ID: ${response.containerId}`);
                return {
                    success: true,
                    appId: response.appId,
                    executionId: response.executionId,
                    containerId: response.containerId
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

    async listDeployedApps() {
        console.log('📋 Listing deployed applications...');

        const message = {
            type: 'list_deployed_apps',
            id: 'list-' + Date.now()
        };

        try {
            const response = await this.sendMessage(message);

            const applications = response.applications || response.apps || [];
            console.log(`📊 Found ${applications.length} deployed applications`);

            if (applications.length > 0) {
                console.log('\n📱 Applications in frontend list:');
                applications.forEach((app, index) => {
                    console.log(`  ${index + 1}. ${app.name} (${app.status})`);
                    console.log(`     App ID: ${app.app_id}`);
                    console.log(`     Deploy Time: ${app.deploy_time}`);
                });
            }

            return {
                success: true,
                applications: applications,
                totalCount: applications.length
            };
        } catch (error) {
            console.error('❌ Failed to list applications:', error.message);
            return { success: false, error: error.message };
        }
    }

    async checkAppInList(deploymentResult) {
        console.log('\n🔍 Checking if deployed app appears in frontend list...');

        // Wait a moment for database to sync
        console.log('⏳ Waiting for database synchronization...');
        await this.sleep(2000);

        const listResult = await this.listDeployedApps();

        if (!listResult.success) {
            console.log('❌ Failed to get application list');
            return false;
        }

        const found = listResult.applications.some(app => {
            return app.app_id === deploymentResult.executionId ||
                   app.name === deploymentResult.appId ||
                   app.app_id === deploymentResult.appId;
        });

        if (found) {
            console.log('✅ SUCCESS: Deployed app appears in frontend list!');
            return true;
        } else {
            console.log('❌ FAILED: Deployed app NOT found in frontend list');
            console.log('\n🔎 Debugging information:');
            console.log(`   Looking for executionId: ${deploymentResult.executionId}`);
            console.log(`   Looking for appId: ${deploymentResult.appId}`);
            console.log(`   Available app_ids:`, listResult.applications.map(app => app.app_id));
            console.log(`   Available names:`, listResult.applications.map(app => app.name));
            return false;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async stopApp(appId) {
        console.log(`\n🛑 Stopping application: ${appId}`);

        const message = {
            type: 'stop_app',
            id: 'stop-' + Date.now(),
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

    async runTest() {
        try {
            console.log('🧪 Starting Frontend Integration Test...\n');

            // Step 1: Connect to runtime
            await this.connect();

            // Step 2: Deploy long-running app
            const deploymentResult = await this.deployLongRunningApp();
            if (!deploymentResult.success) {
                console.error('❌ Test failed: Could not deploy app');
                return false;
            }

            // Step 3: Wait for app to start and database to sync
            console.log('\n⏳ Waiting for application to initialize...');
            await this.sleep(5000);

            // Step 4: Check if app appears in frontend list
            const appearsInList = await this.checkAppInList(deploymentResult);

            // Step 5: Clean up - stop the app
            if (deploymentResult.success) {
                await this.stopApp(deploymentResult.appId);
            }

            // Final result
            console.log('\n📋 FINAL TEST RESULT:');
            console.log('='.repeat(50));
            console.log(`Frontend Integration Test: ${appearsInList ? 'PASS ✅' : 'FAIL ❌'}`);

            if (appearsInList) {
                console.log('🎉 SUCCESS: Direct WebSocket deployments now appear in frontend UI!');
                console.log('🚀 The deployment pipeline fixes are working correctly.');
            } else {
                console.log('⚠️  ISSUE: Direct WebSocket deployments still not appearing in frontend.');
            }

            return appearsInList;

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
    const tester = new FrontendIntegrationTester();
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