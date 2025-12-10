#!/usr/bin/env node

/**
 * Quick Database Test
 * Test the SQLite foreign key constraint fix
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const WS_URL = 'ws://localhost:3025/runtime';

const testApp = {
    id: 'test-db-fix-' + Date.now(),
    name: 'Database Fix Test',
    type: 'python',
    version: '1.0.0',
    description: 'Test database foreign key constraint fix',
    code: 'print("Hello from database fix test!")',
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
                if (response.id === messageId || response.type === 'error' || response.type === message.type) {
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

async function testDatabaseFix() {
    console.log('🧪 Testing Database Foreign Key Constraint Fix');

    const ws = new WebSocket(WS_URL);

    return new Promise((resolve, reject) => {
        ws.on('open', async () => {
            console.log('✅ Connected to Vehicle Edge Runtime');

            try {
                // Test app installation
                console.log('📦 Testing app installation...');
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

                // Test listing apps
                console.log('📋 Testing app listing...');
                const listResponse = await sendMessage(ws, {
                    type: 'list_apps'
                });

                if (listResponse.type === 'apps_list') {
                    console.log('✅ App listing successful!');
                    console.log(`   Found ${listResponse.apps.length} apps`);
                } else {
                    console.log('❌ App listing failed:', listResponse);
                    resolve(false);
                    return;
                }

                // Test getting app logs
                console.log('📝 Testing app logs...');
                const logsResponse = await sendMessage(ws, {
                    type: 'get_app_logs',
                    appId: testApp.id
                });

                if (logsResponse.type === 'app_logs') {
                    console.log('✅ App logs retrieval successful!');
                    console.log(`   Found ${logsResponse.logs.length} log entries`);
                } else {
                    console.log('❌ App logs retrieval failed:', logsResponse);
                    resolve(false);
                    return;
                }

                console.log('\n🎉 ALL DATABASE TESTS PASSED!');
                console.log('✅ Foreign key constraint issue has been fixed');
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
testDatabaseFix()
    .then((success) => {
        if (success) {
            console.log('\n✅ Database fix verification completed successfully');
            process.exit(0);
        } else {
            console.log('\n❌ Database fix verification failed');
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    });