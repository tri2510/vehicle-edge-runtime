#!/usr/bin/env node

/**
 * Quick test for message ID passthrough fix
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const WS_URL = 'ws://localhost:3025/runtime';

function sendMessage(ws, message) {
    return new Promise((resolve, reject) => {
        const messageId = uuidv4();
        const messageWithId = { ...message, id: messageId, timestamp: new Date().toISOString() };

        const timeout = setTimeout(() => {
            reject(new Error(`Message timeout: ${message.type}`));
        }, 5000);

        const messageHandler = (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.id === messageId || response.type === message.type) {
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

async function testMessageFix() {
    console.log('🔧 Testing Message ID Passthrough Fix');

    const ws = new WebSocket(WS_URL);

    return new Promise((resolve, reject) => {
        ws.on('open', async () => {
            console.log('✅ Connected to Vehicle Edge Runtime');

            try {
                // Test 1: Ping/pong
                console.log('🏓 Testing ping/pong...');
                const pingResponse = await sendMessage(ws, { type: 'ping' });
                if (pingResponse.type === 'pong' && pingResponse.id) {
                    console.log('✅ Ping/pong with message ID working');
                } else {
                    console.log('❌ Ping/pong failed:', pingResponse);
                    resolve(false);
                    return;
                }

                // Test 2: List apps (expect apps_list)
                console.log('📋 Testing list apps...');
                const listResponse = await sendMessage(ws, { type: 'list_apps' });
                if (listResponse.type === 'apps_list' && listResponse.id) {
                    console.log('✅ List apps with correct type and message ID working');
                } else {
                    console.log('❌ List apps failed:', listResponse);
                    resolve(false);
                    return;
                }

                console.log('\n🎉 ALL MESSAGE FIXES PASSED!');
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
testMessageFix()
    .then((success) => {
        if (success) {
            console.log('\n✅ Message ID passthrough fixes completed successfully');
            process.exit(0);
        } else {
            console.log('\n❌ Message ID passthrough fixes failed');
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    });