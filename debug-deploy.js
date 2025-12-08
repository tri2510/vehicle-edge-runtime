#!/usr/bin/env node

/**
 * Debug deploy_request command
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';

console.log('🔍 Debugging deploy_request command...');

const runtimeProcess = spawn('node', ['src/index.js'], {
    env: { ...process.env, SKIP_KIT_MANAGER: 'true' },
    stdio: 'pipe'
});

runtimeProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('deploy_request') || output.includes('Deploy')) {
        console.log('📤 Runtime:', output.trim());
    }
});

setTimeout(() => {
    const ws = new WebSocket('ws://localhost:3002/runtime');
    
    ws.on('open', () => {
        console.log('✅ Connected');
        
        // Wait for connection established
        setTimeout(() => {
            const deployCommand = {
                type: 'deploy_request',
                code: 'print("Hello from deployed app!")',
                prototype: {
                    id: 'debug-deploy',
                    name: 'Debug Deploy App',
                    language: 'python'
                },
                username: 'debuguser',
                disable_code_convert: true
            };
            
            console.log('📤 Sending deploy_request:', JSON.stringify(deployCommand, null, 2));
            ws.send(JSON.stringify(deployCommand));
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