#!/usr/bin/env node

/**
 * Simple test client for Vehicle Edge Runtime
 * Tests basic WebSocket communication
 */

import WebSocket from 'ws';

const RUNTIME_URL = 'ws://localhost:3002/runtime';

async function testBasicConnectivity() {
    console.log('Testing Vehicle Edge Runtime connectivity...');

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(RUNTIME_URL);
        let testResults = { passed: 0, failed: 0 };

        ws.on('open', () => {
            console.log('✓ Connected to Vehicle Edge Runtime');
            testResults.passed++;

            // Test ping
            ws.send(JSON.stringify({ type: 'ping' }));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('Received message:', message);

                if (message.type === 'connection_established') {
                    console.log('✓ Connection established with clientId:', message.clientId);
                    testResults.passed++;
                } else if (message.type === 'pong') {
                    console.log('✓ Ping/Pong test passed');
                    testResults.passed++;

                    // Test register_kit
                    ws.send(JSON.stringify({
                        type: 'register_kit',
                        kitInfo: {
                            name: 'Test Kit',
                            version: '1.0.0',
                            description: 'Test kit from test client'
                        }
                    }));
                } else if (message.type === 'kit_registered') {
                    console.log('✓ Kit registration test passed');
                    console.log('  Kit ID:', message.kit.id);
                    testResults.passed++;

                    // Test list-all-kits
                    ws.send(JSON.stringify({ type: 'list-all-kits' }));
                } else if (message.type === 'kits_list') {
                    console.log('✓ List kits test passed');
                    console.log('  Kits count:', message.count);
                    testResults.passed++;

                    // Test runtime state
                    ws.send(JSON.stringify({ type: 'report-runtime-state' }));
                } else if (message.type === 'runtime_state_response') {
                    console.log('✓ Runtime state test passed');
                    console.log('  Runtime ID:', message.runtimeState.runtimeId);
                    console.log('  Is running:', message.runtimeState.isRunning);
                    testResults.passed++;

                    // All tests passed
                    setTimeout(() => {
                        ws.close();
                        resolve(testResults);
                    }, 100);
                } else if (message.type === 'error') {
                    console.log('✗ Error received:', message.error);
                    testResults.failed++;
                    ws.close();
                    resolve(testResults);
                }
            } catch (error) {
                console.log('✗ Failed to parse message:', error.message);
                testResults.failed++;
                ws.close();
                resolve(testResults);
            }
        });

        ws.on('error', (error) => {
            console.log('✗ WebSocket error:', error.message);
            testResults.failed++;
            reject(testResults);
        });

        ws.on('close', () => {
            console.log('Connection closed');
            resolve(testResults);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            console.log('✗ Test timeout');
            testResults.failed++;
            ws.close();
            resolve(testResults);
        }, 10000);
    });
}

async function main() {
    console.log('Vehicle Edge Runtime Test Client');
    console.log('================================');

    try {
        const results = await testBasicConnectivity();

        console.log('\nTest Results:');
        console.log('Passed:', results.passed);
        console.log('Failed:', results.failed);
        console.log('Total:', results.passed + results.failed);

        if (results.failed === 0) {
            console.log('\n🎉 All tests passed!');
            process.exit(0);
        } else {
            console.log('\n❌ Some tests failed!');
            process.exit(1);
        }

    } catch (error) {
        console.log('\n❌ Test failed with error:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);