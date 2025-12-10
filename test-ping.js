#!/usr/bin/env node

/**
 * Simple ping test to verify message handling works
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const WS_URL = 'ws://localhost:3021/runtime';

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

async function testPing() {
    console.log('🏓 Testing basic ping/pong...');

    const ws = new WebSocket(WS_URL);

    return new Promise((resolve, reject) => {
        ws.on('open', async () => {
            console.log('✅ Connected to Vehicle Edge Runtime');

            try {
                // Test ping
                console.log('Sending ping...');
                const response = await sendMessage(ws, { type: 'ping' });

                if (response.type === 'pong') {
                    console.log('✅ Ping/pong successful!');
                    console.log('Response:', response);
                    resolve(true);
                } else {
                    console.log('❌ Unexpected response:', response);
                    resolve(false);
                }

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
testPing()
    .then((success) => {
        if (success) {
            console.log('\n✅ Basic message handling works correctly');
            process.exit(0);
        } else {
            console.log('\n❌ Basic message handling failed');
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    });