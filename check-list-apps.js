#!/usr/bin/env node

/**
 * Simple test to check list_deployed_apps response
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

async function checkListApps() {
    console.log('🔍 Checking list_deployed_apps response...\n');

    const ws = new WebSocket(WS_URL);

    return new Promise((resolve, reject) => {
        let responseReceived = false;

        ws.on('open', () => {
            console.log('✅ Connected to Vehicle Edge Runtime');

            // Send list_deployed_apps request
            const listRequest = {
                type: 'list_deployed_apps',
                id: 'check-list-' + Date.now()
            };

            console.log('📤 Sending request:', JSON.stringify(listRequest, null, 2));
            ws.send(JSON.stringify(listRequest));
        });

        ws.on('message', (data) => {
            const response = JSON.parse(data);
            console.log('📥 Received response:', JSON.stringify(response, null, 2));

            // Only process list_deployed_apps response, ignore connection_established
            if (response.type === 'list_deployed_apps-response') {
                responseReceived = true;

                // Analyze response
                console.log('\n🔍 Response Analysis:');
                console.log(`   Type: ${response.type}`);
                console.log(`   Has applications array: ${!!response.applications}`);

                if (response.applications) {
                    console.log(`   Applications count: ${response.applications.length}`);
                    if (response.applications.length > 0) {
                        console.log('   Application details:');
                        response.applications.forEach((app, index) => {
                            console.log(`     ${index + 1}. app_id: ${app.app_id}, name: ${app.name}, status: ${app.status}`);
                        });
                    }
                } else {
                    console.log('   ❌ No applications array in response');
                }

                console.log(`   Total count: ${response.total_count}`);
                console.log(`   Running count: ${response.running_count}`);

                // Wait a moment before closing to ensure message is fully processed
                setTimeout(() => {
                    ws.close();
                }, 100);
            }
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            reject(error);
        });

        ws.on('close', () => {
            console.log('\n🔌 Connection closed');
            if (!responseReceived) {
                console.log('❌ No response received');
            }
            resolve();
        });

        // Set timeout
        setTimeout(() => {
            if (!responseReceived) {
                console.log('\n⏰ Timeout - no response received');
            }
            ws.close();
            resolve();
        }, 20000);
    });
}

// Run test
checkListApps().catch(console.error);