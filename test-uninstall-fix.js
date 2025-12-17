#!/usr/bin/env node

/**
 * Test uninstall functionality to debug why apps aren't being removed
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

class UninstallTester {
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

    async testUninstall() {
        console.log('🧪 Testing Uninstall Functionality...\n');

        try {
            await this.connect();

            // Step 1: List current apps to get app IDs
            console.log('📋 Step 1: Listing current apps');
            const listResponse = await this.sendMessage({
                type: 'list_deployed_apps',
                id: 'list-before-uninstall-' + Date.now()
            });

            if (!listResponse.applications || listResponse.applications.length === 0) {
                console.log('❌ No apps found to test uninstall');
                return false;
            }

            console.log(`Found ${listResponse.applications.length} apps:`);
            listResponse.applications.forEach((app, index) => {
                console.log(`  ${index + 1}. ${app.name} (${app.status})`);
                console.log(`     app_id: ${app.app_id}`);
                console.log(`     Type: ${app.type}, Version: ${app.version}`);
            });

            // Step 2: Try to uninstall the first app using different message formats
            const testApp = listResponse.applications[0];
            console.log(`\n🗑️ Step 2: Attempting to uninstall: ${testApp.name}`);

            // Test different message formats that frontend might send
            const uninstallFormats = [
                {
                    name: 'uninstall_app (standard format)',
                    message: {
                        type: 'uninstall_app',
                        id: 'uninstall-test-' + Date.now(),
                        appId: testApp.app_id  // Using executionId as appId
                    }
                },
                {
                    name: 'uninstall_app with different ID',
                    message: {
                        type: 'uninstall_app',
                        id: 'uninstall-test-' + Date.now(),
                        app_id: testApp.app_id,  // Alternative field name
                        appId: testApp.app_id
                    }
                },
                {
                    name: 'remove_app (alternative name)',
                    message: {
                        type: 'remove_app',
                        id: 'remove-test-' + Date.now(),
                        appId: testApp.app_id
                    }
                }
            ];

            for (const format of uninstallFormats) {
                console.log(`\n   Trying: ${format.name}`);
                console.log(`   Message: ${JSON.stringify(format.message, null, 2)}`);

                try {
                    const response = await this.sendMessage(format.message);
                    console.log(`   ✅ Response received: ${JSON.stringify(response, null, 2)}`);

                    // Check if it was successful
                    if (response.type === 'app_uninstalled' || response.status === 'success') {
                        console.log(`   🎉 SUCCESS with ${format.name}!`);

                        // Step 3: List apps again to verify removal
                        console.log('\n📋 Step 3: Verifying app removal...');
                        await this.sleep(2000);

                        const afterUninstall = await this.sendMessage({
                            type: 'list_deployed_apps',
                            id: 'list-after-uninstall-' + Date.now()
                        });

                        console.log(`   Apps after uninstall: ${afterUninstall.applications?.length || 0}`);
                        if (afterUninstall.applications?.length < listResponse.applications.length) {
                            console.log('   ✅ App successfully removed from list!');
                            return true;
                        } else {
                            console.log('   ⚠️  App still in list after uninstall');
                        }
                    } else {
                        console.log(`   ❌ Failed with ${format.name}: ${response.error || response.type}`);
                    }
                } catch (error) {
                    console.log(`   ❌ Error with ${format.name}: ${error.message}`);
                }
            }

            return false;

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
    const tester = new UninstallTester();
    const success = await tester.testUninstall();

    console.log('\n📋 FINAL RESULT:');
    console.log('='.repeat(50));
    console.log(`Uninstall Test: ${success ? 'PASS ✅' : 'FAIL ❌'}`);

    process.exit(success ? 0 : 1);
}

// Run the test
main().catch(console.error);