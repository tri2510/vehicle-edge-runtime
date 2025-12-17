#!/usr/bin/env node

/**
 * Test with frontend-style message IDs to see if that affects the response
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

function testMessage(messageId) {
    return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL);
        let responseReceived = false;

        const timeout = setTimeout(() => {
            if (!responseReceived) {
                console.log(`❌ Timeout for ID: ${messageId}`);
                ws.close();
                resolve({ error: 'timeout', messageId });
            }
        }, 5000);

        ws.on('open', () => {
            console.log(`🔗 Testing with message ID: ${messageId}`);

            const message = {
                type: 'list_deployed_apps',
                id: messageId
            };

            console.log('📤 Sending:', JSON.stringify(message));
            ws.send(JSON.stringify(message));
        });

        ws.on('message', (data) => {
            const response = JSON.parse(data);

            if (response.type === 'connection_established') {
                return; // Wait for actual response
            }

            responseReceived = true;
            clearTimeout(timeout);

            if (response.type === 'list_deployed_apps-response') {
                console.log(`📥 Response for ID: ${messageId}`);
                console.log(`   Total apps: ${response.applications?.length || 0}`);
                console.log(`   Stats: ${JSON.stringify(response.stats)}`);
                console.log(`   Running apps: ${response.stats?.running || 0}`);

                // Show first few running apps
                const runningApps = response.applications?.filter(app => app.status === 'running') || [];
                if (runningApps.length > 0) {
                    console.log(`   Running app names: ${runningApps.map(app => app.name).join(', ')}`);
                }
            } else {
                console.log(`❌ Wrong response type for ID: ${messageId}: ${response.type}`);
            }

            ws.close();
            resolve({ success: true, messageId, response: response.type });
        });

        ws.on('error', (error) => {
            console.error(`❌ WebSocket error for ID: ${messageId}:`, error.message);
            resolve({ error: error.message, messageId });
        });

        ws.on('close', () => {
            clearTimeout(timeout);
        });
    });
}

async function runTests() {
    console.log('🧪 Testing different message ID formats...\n');

    // Test with your frontend format
    const frontendFormat1 = `list-apps-${Date.now()}`;
    const frontendFormat2 = `list-apps-${Date.now()}-123`;

    // Test with my test format
    const testFormat1 = `test-list-${Date.now()}`;
    const testFormat2 = `test-list-${Date.now()}-456`;

    // Test with random format
    const randomFormat = `random-${Math.random().toString(36).substr(2, 9)}`;

    const testCases = [
        { id: frontendFormat1, name: 'Frontend format 1' },
        { id: frontendFormat2, name: 'Frontend format 2' },
        { id: testFormat1, name: 'Test format 1' },
        { id: testFormat2, name: 'Test format 2' },
        { id: randomFormat, name: 'Random format' }
    ];

    const results = [];

    for (const testCase of testCases) {
        console.log(`\n--- ${testCase.name} ---`);
        const result = await testMessage(testCase.id);
        results.push({ ...testCase, result });

        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(50));

    results.forEach(result => {
        if (result.result?.success) {
            console.log(`✅ ${result.name}: SUCCESS - ${result.result.response}`);
        } else if (result.result?.error) {
            console.log(`❌ ${result.name}: FAILED - ${result.result.error}`);
        }
    });

    // Check if all responses are consistent
    const successfulResponses = results.filter(r => r.result?.success);
    const responseTypes = [...new Set(successfulResponses.map(r => r.result.response))];

    if (responseTypes.length === 1) {
        console.log('\n🎯 All successful requests returned the same response type - ID format does NOT affect response');
    } else {
        console.log('\n⚠️  WARNING: Different ID formats returned different response types!');
        console.log('Response types found:', responseTypes);
    }
}

runTests().catch(console.error);