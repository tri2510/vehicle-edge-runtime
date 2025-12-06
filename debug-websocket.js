#!/usr/bin/env node

/**
 * Debug WebSocket Communication
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';

console.log('🔍 Debugging WebSocket communication...');

// Start runtime with debug output
const runtimeProcess = spawn('node', ['src/index.js'], {
    env: { ...process.env, SKIP_KIT_MANAGER: 'true', LOG_LEVEL: 'debug' },
    stdio: 'pipe'
});

runtimeProcess.stdout.on('data', (data) => {
    console.log('📤 Runtime stdout:', data.toString());
});

runtimeProcess.stderr.on('data', (data) => {
    console.log('📤 Runtime stderr:', data.toString());
});

// Wait for startup and test
setTimeout(() => {
    console.log('\n🔌 Connecting to WebSocket...');
    const ws = new WebSocket('ws://localhost:3002/runtime');
    
    ws.on('open', () => {
        console.log('✅ WebSocket connected');
        
        // Wait for connection established message
        setTimeout(() => {
            // Send test command
            const testCommand = {
                type: 'ping',
                timestamp: new Date().toISOString()
            };
            
            console.log('📤 Sending command:', JSON.stringify(testCommand));
            ws.send(JSON.stringify(testCommand));
        }, 1000);
    });
    
    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        console.log('📨 Received message:', JSON.stringify(message, null, 2));
        
        // Test another command after receiving response
        if (message.type === 'pong') {
            setTimeout(() => {
                const kitCommand = {
                    type: 'register_kit',
                    kitInfo: {
                        kit_id: 'debug-test-kit',
                        name: 'Debug Test Kit'
                    }
                };
                
                console.log('📤 Sending kit registration:', JSON.stringify(kitCommand));
                ws.send(JSON.stringify(kitCommand));
            }, 1000);
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
    
    ws.on('close', (code, reason) => {
        console.log('🔌 WebSocket closed:', code, reason);
        runtimeProcess.kill();
    });
    
    // Close after timeout
    setTimeout(() => {
        console.log('⏰ Test timeout - closing');
        ws.close();
        runtimeProcess.kill();
    }, 15000);
    
}, 5000);