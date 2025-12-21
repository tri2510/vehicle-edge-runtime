import http from 'http';
import WebSocket from 'ws';

// Create a simple test to send deployment request
const deployRequest = {
    type: 'deploy_request',
    id: 'test-smart-deploy-fix',
    code: `import requests
import numpy as np
from flask import Flask
import time

app = Flask(__name__)

@app.route('/')
def hello():
    return "Hello Vehicle with Smart Dependencies Fixed!"

if __name__ == '__main__':
    print("🚀 Starting Flask app with auto-installed dependencies...")
    print("Dependencies should be auto-installed: requests, numpy, flask")
    app.run(host='0.0.0.0', port=5000)`,
    prototype: {
        id: 'flask-smart-dep-test',
        name: 'Flask Smart Dependency Test',
        language: 'python',
        version: '1.0.0',
        description: 'Test automatic dependency installation'
    },
    language: 'python'
};

// Use HTTP to simulate WebSocket deployment for testing
const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/runtime',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    
    res.on('data', (chunk) => {
        console.log(`Response: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

// Write data to request body
req.write(JSON.stringify(deployRequest));
req.end();

console.log('📦 Sending smart deployment request...');
console.log('   Testing auto-detection of: requests, numpy, flask');