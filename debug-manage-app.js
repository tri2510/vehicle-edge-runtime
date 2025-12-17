#!/usr/bin/env node

/**
 * Debug manage_app functionality - check app IDs and test manually
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

class DebugManageApp {
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
                } else {
                    // Log all messages that aren't part of our pending responses
                    console.log('📥 Unsolicited message:', JSON.stringify(response, null, 2));
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

    async listApps() {
        console.log('\n📋 Listing all deployed applications...');

        const message = {
            type: 'list_deployed_apps',
            id: 'debug-list-' + Date.now()
        };

        try {
            const response = await this.sendMessage(message);

            if (response.applications && response.applications.length > 0) {
                console.log(`📊 Found ${response.applications.length} deployed applications:`);
                response.applications.forEach((app, index) => {
                    console.log(`  ${index + 1}. Name: ${app.name}`);
                    console.log(`     ID: ${app.app_id}`);
                    console.log(`     Status: ${app.status}`);
                    console.log(`     Type: ${app.type}`);
                    console.log(`     Created: ${app.deploy_time || 'Unknown'}`);
                    console.log('');
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

    async testManageAppStart(appId) {
        console.log(`\n🎮 Testing manage_app start with appId: ${appId}`);

        const message = {
            type: 'manage_app',
            id: 'debug-start-' + Date.now(),
            app_id: appId,
            action: 'start'
        };

        try {
            console.log('📤 Sending manage_app start request:', JSON.stringify(message, null, 2));
            const response = await this.sendMessage(message);

            console.log('📥 Received manage_app response:', JSON.stringify(response, null, 2));

            if (response.type === 'manage_app-response') {
                console.log('✅ manage_app start request processed successfully');
                return {
                    success: true,
                    action: response.action,
                    status: response.status,
                    executionId: response.executionId
                };
            } else if (response.type === 'error') {
                console.log('❌ Error received from server:', response.error);
                return { success: false, error: response.error };
            } else {
                console.log('❌ Unexpected response type:', response.type);
                return { success: false, error: `Unexpected response type: ${response.type}` };
            }

        } catch (error) {
            console.error('❌ manage_app start request failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async testRunApp(appId) {
        console.log(`\n🏃 Testing run_app with appId: ${appId}`);

        const message = {
            type: 'run_app',
            id: 'debug-run-' + Date.now(),
            appId: appId
        };

        try {
            console.log('📤 Sending run_app request:', JSON.stringify(message, null, 2));
            const response = await this.sendMessage(message);

            console.log('📥 Received run_app response:', JSON.stringify(response, null, 2));

            if (response.type === 'run_app-response') {
                console.log('✅ run_app request processed successfully');
                return {
                    success: true,
                    status: response.status,
                    executionId: response.executionId
                };
            } else if (response.type === 'error') {
                console.log('❌ Error received from server:', response.error);
                return { success: false, error: response.error };
            } else {
                console.log('❌ Unexpected response type:', response.type);
                return { success: false, error: `Unexpected response type: ${response.type}` };
            }

        } catch (error) {
            console.error('❌ run_app request failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async runDebug() {
        try {
            console.log('🧪 Starting Debug Session...\n');

            // Step 1: Connect to runtime
            await this.connect();

            // Step 2: List all apps to see what we have
            const listResult = await this.listApps();

            if (!listResult.success || listResult.applications.length === 0) {
                console.error('❌ No applications found to test with');
                return false;
            }

            // Step 3: Test manage_app start on the first stopped app
            const stoppedApps = listResult.applications.filter(app => app.status === 'stopped');

            if (stoppedApps.length === 0) {
                console.log('ℹ️  No stopped apps found. All apps are already running.');
                return true;
            }

            console.log(`Found ${stoppedApps.length} stopped apps. Testing with first one.`);
            const testApp = stoppedApps[0];

            // Step 4: Test manage_app start
            console.log('\n=== Testing manage_app start ===');
            const manageResult = await this.testManageAppStart(testApp.app_id);

            // Step 5: Test run_app for comparison
            console.log('\n=== Testing run_app for comparison ===');
            const runResult = await this.testRunApp(testApp.app_id);

            // Step 6: List apps again to see if anything changed
            console.log('\n=== Checking final state ===');
            await this.listApps();

            // Final result
            console.log('\n📋 FINAL DEBUG RESULTS:');
            console.log('='.repeat(50));
            console.log(`manage_app start: ${manageResult.success ? 'SUCCESS ✅' : 'FAILED ❌'}`);
            if (!manageResult.success) {
                console.log(`Error: ${manageResult.error}`);
            }
            console.log(`run_app: ${runResult.success ? 'SUCCESS ✅' : 'FAILED ❌'}`);
            if (!runResult.success) {
                console.log(`Error: ${runResult.error}`);
            }

            return manageResult.success || runResult.success;

        } catch (error) {
            console.error('❌ Debug session failed:', error.message);
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
    const debugSession = new DebugManageApp();
    const success = await debugSession.runDebug();
    process.exit(success ? 0 : 1);
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Debug session interrupted by user');
    process.exit(1);
});

// Run the debug session
main().catch(console.error);