#!/usr/bin/env node

/**
 * Debug console_subscribe command
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';

console.log('🔍 Debugging console_subscribe command...');

const runtimeProcess = spawn('node', ['src/index.js'], {
    env: { ...process.env, SKIP_KIT_MANAGER: 'true' },
    stdio: 'pipe'
});

runtimeProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('console') || output.includes('Console')) {
        console.log('📤 Runtime:', output.trim());
    }
});

setTimeout(() => {
    const ws = new WebSocket('ws://localhost:3002/runtime');
    
    ws.on('open', () => {
        console.log('✅ Connected');
        
        // Wait for connection established
        setTimeout(() => {
            const consoleCommand = {
                type: 'console_subscribe',
                executionId: 'test-execution-id-123'
            };
            
            console.log('📤 Sending console_subscribe:', JSON.stringify(consoleCommand));
            ws.send(JSON.stringify(consoleCommand));
        }, 1000);
    });
    
    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        console.log('📨 Received:', JSON.stringify(message, null, 2));
    });
    
    setTimeout(() => {
        ws.close();
        runtimeProcess.kill();
    }, 10000);
    
}, 5000);