#!/usr/bin/env node

/**
 * Simple test to check restart recovery
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

async function testRecovery() {
    console.log('🧪 Testing Restart Recovery...\n');

    // Connect to runtime
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.log('✅ Connected to Vehicle Edge Runtime');

        // Send list request to see what apps are recovered
        const message = {
            type: 'list_deployed_apps',
            id: 'recovery-test-' + Date.now()
        };

        ws.send(JSON.stringify(message));
        console.log('📤 Sent list request to check for recovered apps');
    });

    ws.on('message', (data) => {
        const response = JSON.parse(data);

        if (response.type === 'connection_established') {
            return; // Wait for actual response
        }

        if (response.type === 'list_deployed_apps-response') {
            console.log('\n📥 Recovery Test Results:');
            console.log('='.repeat(40));
            console.log(`Total apps found: ${response.total_count || 0}`);
            console.log(`Stats: ${JSON.stringify(response.stats)}`);

            if (response.applications && response.applications.length > 0) {
                console.log('\n📋 Recovered Applications:');
                response.applications.forEach((app, index) => {
                    console.log(`  ${index + 1}. ${app.name} (${app.status})`);
                    console.log(`     ID: ${app.app_id}`);
                });

                // Look for our test apps
                const testApp1 = response.applications.find(app =>
                    app.name.includes('Restart Test App 1')
                );
                const testApp2 = response.applications.find(app =>
                    app.name.includes('Restart Test App 2')
                );

                if (testApp1 && testApp2) {
                    console.log('\n🎉 SUCCESS: Both test apps were recovered!');
                    console.log('✅ Persistent storage is working correctly!');
                    console.log('✅ Runtime restart recovery is functional!');
                } else {
                    console.log('\n⚠️  PARTIAL: Apps recovered but test apps missing');
                    console.log('   Test App 1 found:', !!testApp1);
                    console.log('   Test App 2 found:', !!testApp2);
                }
            } else {
                console.log('\n❌ FAILED: No apps were recovered after restart');
                console.log('   This indicates persistent storage recovery is not working');
            }

            console.log('\n🔍 Recovery Analysis:');
            if (response.total_count >= 2) {
                console.log('✅ Database persistence working');
            } else {
                console.log('❌ Database persistence failed');
            }

            ws.close();
        } else {
            console.log('❌ Unexpected response type:', response.type);
            console.log('Full response:', JSON.stringify(response, null, 2));
            ws.close();
        }
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
    });

    ws.on('close', () => {
        console.log('\n🔌 Connection closed - test complete');
        process.exit(0);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
        console.log('\n⏰ Test timeout');
        ws.close();
        process.exit(1);
    }, 10000);
}

// Run the test
testRecovery().catch(console.error);