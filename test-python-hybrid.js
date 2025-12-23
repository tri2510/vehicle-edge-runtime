#!/usr/bin/env node

import WebSocket from 'ws';

// Test Python deployment using hybrid approach
const ws = new WebSocket('ws://localhost:3002/runtime');

ws.on('open', () => {
    console.log('✅ Connected to Vehicle Edge Runtime');

    // Test Python smart deployment
    const pythonDeployRequest = {
        type: 'smart_deploy',
        id: 'test-python-hybrid-' + Date.now(),
        name: 'Test Python Hybrid',
        deploymentType: 'python',
        code: `
import time
import sys

print("🐍 Python app is running!")
print("✅ Traditional Python deployment is working!")

for i in range(5):
    print(f"Processing step {i + 1}/5...")
    time.sleep(1)

print("🎉 Python app completed successfully!")
        `,
        dependencies: ['requests'],
        environment: 'production',
        signals: [
            {
                path: 'Vehicle.Speed',
                access: 'get',
                rate_hz: 10
            }
        ]
    };

    console.log('📤 Sending Python smart deployment request...');
    ws.send(JSON.stringify(pythonDeployRequest));
});

ws.on('message', (data) => {
    const response = JSON.parse(data.toString());
    console.log('📥 Response:', response);

    if (response.type === 'smart_deploy-response') {
        console.log('✅ Python deployment successful!');
        console.log(`📦 App ID: ${response.app_id}`);
        console.log(`🚀 Status: ${response.status}`);

        if (response.auto_detected_dependencies && response.auto_detected_dependencies.length > 0) {
            console.log(`🔍 Auto-detected dependencies: ${response.auto_detected_dependencies.join(', ')}`);
        }

        setTimeout(() => {
            ws.close();
        }, 1000);
    }

    if (response.type === 'error') {
        console.error('❌ Deployment failed:', response.error);
        if (response.suggestions) {
            console.log('💡 Suggestions:', response.suggestions);
        }
        ws.close();
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
    console.log('🔌 Connection closed');
    process.exit(0);
});

// Timeout after 30 seconds
setTimeout(() => {
    console.log('⏰ Test timeout');
    ws.close();
    process.exit(1);
}, 30000);