#!/usr/bin/env node

/**
 * Debug Test - Simple WebSocket Connection Test
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';

console.log('🔍 Starting debug test...');

// Start runtime in background
console.log('Starting runtime...');
const runtimeProcess = spawn('node', ['src/index.js'], {
    env: { ...process.env, SKIP_KIT_MANAGER: 'true' },
    stdio: 'pipe'
});

// Wait for startup
setTimeout(() => {
    console.log('Connecting to WebSocket...');
    const ws = new WebSocket('ws://localhost:3002/runtime');
    
    ws.on('open', () => {
        console.log('✅ WebSocket connected');
        
        // Send a simple ping
        const pingMessage = {
            type: 'ping',
            timestamp: new Date().toISOString()
        };
        
        console.log('Sending ping:', JSON.stringify(pingMessage));
        ws.send(JSON.stringify(pingMessage));
    });
    
    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        console.log('📨 Received message:', JSON.stringify(message, null, 2));
        
        if (message.type === 'connection_established') {
            console.log('✅ Connection established properly');
        }
        
        // Close after receiving response
        setTimeout(() => {
            ws.close();
            runtimeProcess.kill();
            console.log('✅ Debug test completed');
        }, 1000);
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        runtimeProcess.kill();
    });
    
    ws.on('close', () => {
        console.log('🔌 WebSocket closed');
        runtimeProcess.kill();
    });
    
}, 5000);