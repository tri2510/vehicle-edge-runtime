#!/usr/bin/env node

/**
 * Quick test to check what list_deployed_apps returns
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/runtime';

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('🔗 Connected to Vehicle Edge Runtime');

    // Send list_deployed_apps request
    const message = {
        type: 'list_deployed_apps',
        id: 'test-list-' + Date.now()
    };

    console.log('📤 Sending:', JSON.stringify(message, null, 2));
    ws.send(JSON.stringify(message));
});

let messageReceived = false;
const timeout = setTimeout(() => {
    if (!messageReceived) {
        console.log('⏰ Timeout - no response received');
        ws.close();
    }
}, 10000);

ws.on('message', (data) => {
    const response = JSON.parse(data);

    console.log('📥 Received response:');
    console.log('Type:', response.type);

    if (response.type === 'connection_established') {
        console.log('✅ Connection established, waiting for actual response...');
        return; // Don't close, wait for the actual response
    }

    messageReceived = true;
    clearTimeout(timeout);

    if (response.type === 'list_deployed_apps-response') {
        console.log('Total applications:', response.applications?.length || 0);
        console.log('Stats:', JSON.stringify(response.stats, null, 2));
        console.log('Response fields:', Object.keys(response));

        if (response.applications && response.applications.length > 0) {
            console.log('\nFirst few apps:');
            response.applications.slice(0, 5).forEach((app, index) => {
                console.log(`  ${index + 1}. ${app.name} (${app.status}) - ${app.app_id}`);
            });

            console.log('\nStatus breakdown:');
            const statusCounts = {};
            response.applications.forEach(app => {
                statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
            });
            Object.entries(statusCounts).forEach(([status, count]) => {
                console.log(`  ${status}: ${count}`);
            });
        } else {
            console.log('❌ No applications found in response');
        }
    } else {
        console.log('❌ Unexpected response type:', response.type);
        console.log('Full response:', JSON.stringify(response, null, 2));
    }

    ws.close();
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
    console.log('❌ WebSocket connection closed');
});