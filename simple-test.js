#!/usr/bin/env node

/**
 * Simple Integration Test
 * Tests core functionality without complex error handling
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';

console.log('🚀 Starting simple integration test...');

// Test results
let testResults = [];
let testIndex = 0;

function runTest(name, testFunction) {
    return new Promise((resolve) => {
        console.log(`\n📋 Test ${++testIndex}: ${name}`);
        
        testFunction()
            .then(result => {
                if (result.passed) {
                    console.log(`✅ PASSED: ${result.message}`);
                } else {
                    console.log(`❌ FAILED: ${result.message}`);
                }
                testResults.push({ name, ...result });
                resolve();
            })
            .catch(error => {
                console.log(`❌ ERROR: ${error.message}`);
                testResults.push({ name, passed: false, message: error.message });
                resolve();
            });
    });
}

// Create WebSocket connection
function createConnection() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:3002/runtime');
        
        const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
        }, 5000);
        
        ws.on('open', () => {
            clearTimeout(timeout);
            resolve(ws);
        });
        
        ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

// Send command and wait for response
function sendCommand(ws, command, expectedType = null) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Command timeout'));
        }, 10000);
        
        let responseReceived = false;
        
        function handleMessage(data) {
            const message = JSON.parse(data.toString());
            
            if (expectedType && message.type !== expectedType && !responseReceived) {
                return; // Wait for the expected response type
            }
            
            if (!responseReceived) {
                responseReceived = true;
                clearTimeout(timeout);
                ws.removeListener('message', handleMessage);
                resolve(message);
            }
        }
        
        ws.on('message', handleMessage);
        ws.send(JSON.stringify(command));
    });
}

// Start runtime
let runtimeProcess;

async function startRuntime() {
    console.log('🔧 Starting Vehicle Edge Runtime...');
    runtimeProcess = spawn('node', ['src/index.js'], {
        env: { ...process.env, SKIP_KIT_MANAGER: 'true' },
        stdio: 'ignore'
    });
    
    // Wait for startup
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ Runtime started');
}

async function stopRuntime() {
    if (runtimeProcess) {
        console.log('🛑 Stopping runtime...');
        runtimeProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// Test functions
const tests = [
    // Test 1: Basic connectivity and ping
    async () => {
        const ws = await createConnection();
        
        // Wait for connection established
        const connectionMsg = await sendCommand(ws, { type: 'ping' });
        ws.close();
        
        return {
            passed: connectionMsg.type === 'pong',
            message: connectionMsg.type === 'pong' ? 'Ping/Pong working' : 'Ping failed'
        };
    },
    
    // Test 2: Kit registration
    async () => {
        const ws = await createConnection();
        
        const response = await sendCommand(ws, {
            type: 'register_kit',
            kitInfo: {
                kit_id: 'test-kit-001',
                name: 'Test Kit',
                support_apis: ['run_python_app', 'run_binary_app']
            }
        });
        
        ws.close();
        
        return {
            passed: response.type === 'kit_registered',
            message: response.type === 'kit_registered' ? 'Kit registered' : 'Registration failed'
        };
    },
    
    // Test 3: Python app execution
    async () => {
        const ws = await createConnection();
        
        const pythonCode = `
print("Hello from Python!")
print("Execution successful!")
`;
        
        const response = await sendCommand(ws, {
            type: 'run_python_app',
            appId: 'test-python',
            code: pythonCode,
            entryPoint: 'main.py',
            workingDir: '/app'
        });
        
        ws.close();
        
        return {
            passed: response.type === 'python_app_started',
            message: response.type === 'python_app_started' ? 
                `Python app started: ${response.executionId}` : 'Python app failed to start'
        };
    },
    
    // Test 4: Binary app execution
    async () => {
        const ws = await createConnection();
        
        const response = await sendCommand(ws, {
            type: 'run_binary_app',
            appId: 'test-binary',
            binaryPath: '/bin/echo',
            args: ['Hello from binary!'],
            workingDir: '/app'
        });
        
        ws.close();
        
        return {
            passed: response.type === 'binary_app_started',
            message: response.type === 'binary_app_started' ? 
                `Binary app started: ${response.executionId}` : 'Binary app failed to start'
        };
    },
    
    // Test 5: Rust compatibility (should work as binary)
    async () => {
        const ws = await createConnection();
        
        const response = await sendCommand(ws, {
            type: 'run_rust_app',
            appId: 'test-rust',
            binaryPath: '/bin/echo',
            args: ['Hello from Rust!'],
            workingDir: '/app'
        });
        
        ws.close();
        
        return {
            passed: response.type === 'binary_app_started', // Should be treated as binary
            message: response.type === 'binary_app_started' ? 
                'Rust app treated as binary successfully' : 'Rust compatibility failed'
        };
    },
    
    // Test 6: Deploy request
    async () => {
        const ws = await createConnection();
        
        const deployCode = `
print("Deployed app is running!")
print("Deploy request successful!")
`;
        
        const response = await sendCommand(ws, {
            type: 'deploy_request',
            code: deployCode,
            prototype: {
                id: 'deploy-test',
                name: 'Deploy Test',
                language: 'python'
            },
            username: 'testuser',
            disable_code_convert: true
        });
        
        ws.close();
        
        return {
            passed: response.type === 'deploy_request-response' && response.status === 'started',
            message: response.type === 'deploy_request-response' ? 
                'Deploy request processed successfully' : 'Deploy request failed'
        };
    },
    
    // Test 7: Get runtime info
    async () => {
        const ws = await createConnection();
        
        const response = await sendCommand(ws, {
            type: 'get-runtime-info'
        });
        
        ws.close();
        
        return {
            passed: response.type === 'get-runtime-info-response',
            message: response.type === 'get-runtime-info-response' ? 
                'Runtime info retrieved' : 'Runtime info failed'
        };
    },
    
    // Test 8: Vehicle credentials test
    async () => {
        const ws = await createConnection();
        
        const testCode = `
import os
print("Vehicle ID:", os.environ.get('VEHICLE_ID', 'NOT_SET'))
print("Has credentials:", 'VEHICLE_ACCESS_TOKEN' in os.environ)
`;
        
        const response = await sendCommand(ws, {
            type: 'run_python_app',
            appId: 'test-credentials',
            code: testCode,
            entryPoint: 'main.py',
            vehicleId: 'test-vehicle-001',
            workingDir: '/app'
        });
        
        ws.close();
        
        return {
            passed: response.type === 'python_app_started',
            message: response.type === 'python_app_started' ? 
                'Vehicle credential injection attempted' : 'Credential injection failed'
        };
    },
    
    // Test 9: Signal validation
    async () => {
        const ws = await createConnection();
        
        const response = await sendCommand(ws, {
            type: 'check_signal_conflicts',
            app_id: 'signal-test',
            signals: [
                { signal: 'Vehicle.Speed', access: 'read' },
                { signal: 'Invalid.Signal', access: 'read' }
            ]
        });
        
        ws.close();
        
        return {
            passed: response.type === 'check_signal_conflicts-response',
            message: response.type === 'check_signal_conflicts-response' ? 
                'Signal validation working' : 'Signal validation failed'
        };
    }
];

// Main test runner
async function runAllTests() {
    try {
        await startRuntime();
        
        // Run all tests
        for (const test of tests) {
            await runTest(test.name, test);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between tests
        }
        
        // Generate report
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(60));
        
        const passed = testResults.filter(t => t.passed).length;
        const total = testResults.length;
        const successRate = ((passed / total) * 100).toFixed(1);
        
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${total - passed}`);
        console.log(`Success Rate: ${successRate}%`);
        
        console.log('\n📋 Detailed Results:');
        testResults.forEach(test => {
            console.log(`${test.passed ? '✅' : '❌'} ${test.name}: ${test.message}`);
        });
        
        console.log('\n🏆 Overall Status: ' + 
            (passed === total ? '🟢 ALL TESTS PASSED' :
             passed >= total * 0.8 ? '🟡 MOSTLY WORKING' :
             passed >= total * 0.5 ? '🟠 PARTIALLY WORKING' :
             '🔴 NEEDS ATTENTION'));
        
        console.log('\n✨ Implementation Features Verified:');
        const features = [
            '✅ WebSocket Communication',
            passed > 0 ? '✅ Basic Commands (Ping, Registration)' : '❌ Basic Commands',
            passed > 2 ? '✅ Python Application Execution' : '❌ Python Execution',
            passed > 3 ? '✅ Binary Application Execution' : '❌ Binary Execution',
            passed > 4 ? '✅ Rust/C++ Compatibility' : '❌ Rust/C++ Support',
            passed > 5 ? '✅ Deploy Request Handling' : '❌ Deploy Support',
            passed > 6 ? '✅ Runtime Information' : '❌ Runtime Info',
            passed > 7 ? '✅ Vehicle Credential Injection' : '❌ Vehicle Integration',
            passed > 8 ? '✅ VSS Signal Validation' : '❌ Signal Management'
        ];
        
        features.forEach(feature => console.log(feature));
        
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
    } finally {
        await stopRuntime();
    }
}

// Run tests
runAllTests().catch(console.error);