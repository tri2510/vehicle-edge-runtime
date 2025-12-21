#!/usr/bin/env node

/**
 * Test script for smart deployment with dependency detection
 */

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3002/runtime');

ws.on('open', function open() {
    console.log('✅ Connected to Vehicle Edge Runtime');
    
    // Test the Flask app with dependencies
    const flaskAppCode = `import requests
import numpy as np
from flask import Flask
import time

app = Flask(__name__)

@app.route('/')
def hello():
    return "Hello Vehicle with Smart Dependencies!"

if __name__ == '__main__':
    print("🚀 Starting Flask app with auto-installed dependencies...")
    app.run(host='0.0.0.0', port=5000)`;

    const deployMessage = {
        type: 'deploy_request',
        id: 'test-smart-deploy',
        code: flaskAppCode,
        prototype: {
            id: 'flask-smart-test',
            name: 'Flask Smart Test App',
            language: 'python',
            version: '1.0.0',
            description: 'Test smart dependency detection'
        },
        language: 'python'
    };

    console.log('📦 Sending smart deployment request...');
    console.log('   Expected auto-detected dependencies: requests, numpy, flask');
    
    ws.send(JSON.stringify(deployMessage));
});

ws.on('message', function message(data) {
    const response = JSON.parse(data.toString());
    
    console.log('\n📨 Response received:');
    console.log('   Type:', response.type);
    console.log('   Status:', response.status || response.result?.status);
    console.log('   Message:', response.result || response.message);
    
    if (response.type === 'deploy_request-response') {
        if (response.status === 'failed') {
            console.log('❌ Deployment failed:', response.error || response.result);
        } else {
            console.log('✅ Smart deployment successful!');
            console.log('   Execution ID:', response.executionId);
            console.log('   App ID:', response.appId);
            console.log('   Container should now install: pip install requests numpy flask');
        }
        ws.close();
    }
});

ws.on('error', function error(err) {
    console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close() {
    console.log('🔌 Connection closed');
    process.exit(0);
});