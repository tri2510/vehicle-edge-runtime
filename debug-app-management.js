#!/usr/bin/env node

/**
 * Debug app management functionality to understand ID mismatch
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

class AppManagementDebugger {
    constructor() {
        this.ws = null;
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
                console.log('📥 Received response:', JSON.stringify(response, null, 2));
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

            console.log('📤 Sending message:', JSON.stringify(message, null, 2));
            this.ws.send(JSON.stringify(message));

            // Simple timeout for message processing
            setTimeout(() => {
                resolve();
            }, 3000);
        });
    }

    async testAppManagement() {
        try {
            console.log('🧪 Starting App Management Debug...\n');

            // Step 1: Connect
            await this.connect();

            // Step 2: List apps to see current structure
            console.log('\n📋 Step 1: List deployed apps');
            await this.sendMessage({
                type: 'list_deployed_apps',
                id: 'debug-list-' + Date.now()
            });

            // Step 3: Try to stop an app using executionId (what frontend is doing)
            console.log('\n🛑 Step 2: Try to stop app using executionId');
            await this.sendMessage({
                type: 'stop_app',
                id: 'debug-stop-executionId-' + Date.now(),
                appId: '5765759a-c6d4-4d26-900d-ae53f0cf040e' // This is executionId from logs
            });

            // Step 4: Deploy a new app to see the full structure
            console.log('\n🚀 Step 3: Deploy a new test app');
            await this.sendMessage({
                type: 'deploy_request',
                id: 'debug-deploy-' + Date.now(),
                code: `
import time
print("Debug test app running")
for i in range(5):
    print(f"Cycle {i + 1}/5")
    time.sleep(1)
print("Debug test app completed")
`.trim(),
                prototype: {
                    id: 'debug-test-app-' + Date.now(),
                    name: 'Debug Test App',
                    description: 'Test app for debugging',
                    version: '1.0.0'
                },
                vehicleId: 'debug-vehicle',
                language: 'python'
            });

            // Step 5: List apps again to see the new app
            console.log('\n📋 Step 4: List apps after deployment');
            await this.sleep(2000);
            await this.sendMessage({
                type: 'list_deployed_apps',
                id: 'debug-list-after-' + Date.now()
            });

            console.log('\n🎯 Debug complete');

        } catch (error) {
            console.error('❌ Debug failed:', error.message);
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
    const debugTester = new AppManagementDebugger();
    await debugTester.testAppManagement();
}

// Run the debug
main().catch(console.error);