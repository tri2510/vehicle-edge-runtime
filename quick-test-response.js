#!/usr/bin/env node

/**
 * Quick test to verify response mapping fix
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

async function testResponseMapping() {
    console.log('🧪 Testing Response Mapping Fix...\n');

    const ws = new WebSocket(WS_URL);

    return new Promise((resolve, reject) => {
        ws.on('open', () => {
            console.log('✅ Connected to Vehicle Edge Runtime');

            // Deploy a simple app
            const deployRequest = {
                type: 'deploy_request',
                id: 'test-response-' + Date.now(),
                code: `
import time
print("Testing response mapping...")
for i in range(10):
    print(f"Iteration {i+1}")
    time.sleep(1)
print("App completed successfully")
`.trim(),
                prototype: {
                    id: 'response-test-app-' + Date.now(),
                    name: 'Response Test App',
                    description: 'Testing response field mapping',
                    version: '1.0.0'
                },
                vehicleId: 'test-vehicle-response',
                language: 'python'
            };

            ws.send(JSON.stringify(deployRequest));
        });

        ws.on('message', (data) => {
            const response = JSON.parse(data);

            if (response.type === 'deploy_request-response') {
                console.log('🚀 Deployment Response:');
                console.log(`   Status: ${response.status}`);
                console.log(`   App ID: ${response.appId}`);
                console.log(`   Execution ID: ${response.executionId}`);

                // Wait 2 seconds then list apps
                setTimeout(() => {
                    console.log('\n📋 Listing deployed apps...');
                    const listRequest = {
                        type: 'list_deployed_apps',
                        id: 'list-' + Date.now()
                    };
                    ws.send(JSON.stringify(listRequest));
                }, 2000);
            }

            if (response.type === 'list_deployed_apps-response') {
                console.log('\n📱 Applications in List:');
                console.log(`   Total Count: ${response.total_count}`);
                console.log(`   Running Count: ${response.running_count}`);

                if (response.applications && response.applications.length > 0) {
                    response.applications.forEach((app, index) => {
                        console.log(`\n   App ${index + 1}:`);
                        console.log(`     app_id: ${app.app_id}`);
                        console.log(`     name: ${app.name} 🎯`);
                        console.log(`     status: ${app.status}`);
                        console.log(`     deploy_time: ${app.deploy_time}`);
                    });

                    // Check if name field is properly set
                    const hasProperNames = response.applications.every(app =>
                        app.name && app.name !== app.app_id
                    );

                    console.log(`\n🔍 Name Field Test: ${hasProperNames ? 'PASS ✅' : 'FAIL ❌'}`);
                    console.log(`📊 Response Structure: ${response.applications.length > 0 ? 'PASS ✅' : 'FAIL ❌'}`);
                } else {
                    console.log('\n❌ No applications found in response');
                }

                ws.close();
                resolve();
            }
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            reject(error);
        });

        ws.on('close', () => {
            console.log('\n🔌 Connection closed');
        });

        // Set timeout
        setTimeout(() => {
            console.log('\n⏰ Test timeout');
            ws.close();
            resolve();
        }, 15000);
    });
}

// Run test
testResponseMapping().catch(console.error);