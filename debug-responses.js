#!/usr/bin/env node

/**
 * Debug Application Execution Responses
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';

console.log('🔍 Debugging application execution responses...');

// Start runtime
const runtimeProcess = spawn('node', ['src/index.js'], {
    env: { ...process.env, SKIP_KIT_MANAGER: 'true' },
    stdio: 'pipe'
});

setTimeout(() => {
    const ws = new WebSocket('ws://localhost:3002/runtime');
    
    ws.on('open', () => {
        console.log('✅ Connected');
        
        // Wait for connection established
        setTimeout(() => {
            // Test Python app execution
            const pythonCommand = {
                type: 'run_python_app',
                appId: 'debug-python',
                code: 'print("Hello from debug test!")',
                entryPoint: 'main.py',
                workingDir: '/app'
            };
            
            console.log('📤 Sending Python command:', JSON.stringify(pythonCommand));
            ws.send(JSON.stringify(pythonCommand));
        }, 1000);
    });
    
    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        console.log('📨 Received:', JSON.stringify(message, null, 2));
        
        // Test binary after receiving Python response
        if (message.type && message.type.includes('python')) {
            setTimeout(() => {
                const binaryCommand = {
                    type: 'run_binary_app',
                    appId: 'debug-binary',
                    binaryPath: '/bin/echo',
                    args: ['Hello from binary debug!'],
                    workingDir: '/app'
                };
                
                console.log('📤 Sending Binary command:', JSON.stringify(binaryCommand));
                ws.send(JSON.stringify(binaryCommand));
            }, 2000);
        }
    });
    
    setTimeout(() => {
        ws.close();
        runtimeProcess.kill();
    }, 15000);
    
}, 5000);