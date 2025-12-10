#!/usr/bin/env node

/**
 * Quick test for the remaining API issues
 * Using port 3030 for WebSocket and 3031 for HTTP
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const WS_URL = 'ws://localhost:3002/runtime';
const HTTP_URL = 'http://localhost:3003';

const testApp = {
    id: 'test-fixes-' + Date.now(),
    name: 'Test App for Fixes',
    type: 'python',
    version: '1.0.0',
    description: 'Test app to verify fixes',
    code: 'print("Hello from test app!")\nprint("This should work now")',
    entryPoint: 'app.py',
    python_deps: ['requests==2.28.0'],
    vehicle_signals: ['Vehicle.Speed', 'Vehicle.Steering.Angle']
};

function sendMessage(ws, message) {
    return new Promise((resolve, reject) => {
        const messageId = uuidv4();
        const messageWithId = { ...message, id: messageId, timestamp: new Date().toISOString() };

        const timeout = setTimeout(() => {
            reject(new Error(`Message timeout: ${message.type}`));
        }, 10000);

        const messageHandler = (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.id === messageId || response.type === 'error' || response.type === message.type.replace('_app', 'ped')) {
                    clearTimeout(timeout);
                    ws.removeListener('message', messageHandler);
                    resolve(response);
                }
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        };

        ws.on('message', messageHandler);
        ws.send(JSON.stringify(messageWithId));
    });
}

async function testFixes() {
    console.log('🧪 Testing API Fixes');
    console.log(`WebSocket URL: ${WS_URL}`);
    console.log(`HTTP URL: ${HTTP_URL}`);

    const ws = new WebSocket(WS_URL);

    return new Promise((resolve, reject) => {
        ws.on('open', async () => {
            console.log('✅ Connected to Vehicle Edge Runtime');

            try {
                // Test 1: Install App
                console.log('📦 Installing app...');
                const installResponse = await sendMessage(ws, {
                    type: 'install_app',
                    appData: testApp
                });

                if (installResponse.type === 'app_installed') {
                    console.log('✅ App installation successful!');
                } else {
                    console.log('❌ App installation failed:', installResponse);
                    resolve(false);
                    return;
                }

                // Test 2: Run App
                console.log('▶️ Running app...');
                const runResponse = await sendMessage(ws, {
                    type: 'run_python_app',
                    appId: testApp.id
                });

                if (runResponse.type === 'python_app_started') {
                    console.log('✅ App started successfully!');
                    console.log(`   Execution ID: ${runResponse.executionId}`);
                    console.log(`   Container ID: ${runResponse.containerId}`);
                } else {
                    console.log('❌ App start failed:', runResponse);
                    resolve(false);
                    return;
                }

                // Wait a bit for the app to run
                await new Promise(r => setTimeout(r, 3000));

                // Test 3: Stop App
                console.log('⏹️ Stopping app...');
                const stopResponse = await sendMessage(ws, {
                    type: 'stop_app',
                    appId: testApp.id
                });

                if (stopResponse.type === 'app_stopped') {
                    console.log('✅ App stopped successfully!');
                    console.log(`   Exit code: ${stopResponse.exitCode}`);
                } else {
                    console.log('❌ App stop failed:', stopResponse);
                    resolve(false);
                    return;
                }

                // Test 4: Write Vehicle Signal
                console.log('🚗 Testing vehicle signal write...');
                const writeResponse = await sendMessage(ws, {
                    type: 'write_signals_value',
                    data: {
                        'Vehicle.Cabin.Lights.IsOn': true
                    }
                });

                if (writeResponse.type === 'signals_written') {
                    console.log('✅ Vehicle signal write successful!');
                } else {
                    console.log('❌ Vehicle signal write failed:', writeResponse);
                    resolve(false);
                    return;
                }

                // Test 5: Uninstall App
                console.log('🗑️ Uninstalling app...');
                const uninstallResponse = await sendMessage(ws, {
                    type: 'uninstall_app',
                    appId: testApp.id
                });

                if (uninstallResponse.type === 'app_uninstalled') {
                    console.log('✅ App uninstalled successfully!');
                } else {
                    console.log('❌ App uninstall failed:', uninstallResponse);
                    resolve(false);
                    return;
                }

                console.log('\n🎉 ALL TESTS PASSED!');
                console.log('✅ The API fixes are working correctly');
                resolve(true);

            } catch (error) {
                console.error('❌ Test failed:', error.message);
                resolve(false);
            } finally {
                ws.close();
            }
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            reject(error);
        });

        setTimeout(() => {
            reject(new Error('Connection timeout'));
        }, 10000);
    });
}

// Run the test
testFixes()
    .then((success) => {
        if (success) {
            console.log('\n✅ API fixes verification completed successfully');
            process.exit(0);
        } else {
            console.log('\n❌ API fixes verification failed');
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    });