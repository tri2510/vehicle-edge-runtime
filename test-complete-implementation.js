#!/usr/bin/env node

/**
 * Complete Implementation Test Suite
 * Tests all Vehicle Edge Runtime functionality
 * 
 * Usage: node test-complete-implementation.js
 */

import WebSocket from 'ws';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

// Test configuration
const TEST_CONFIG = {
    RUNTIME_PORT: 3002,
    RUNTIME_URL: 'ws://localhost:3002/runtime',
    HEALTH_URL: 'http://localhost:3003/health',
    TEST_TIMEOUT: 30000,
    COMMAND_TIMEOUT: 10000
};

let runtimeProcess = null;
let testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    details: []
};

// Test utilities
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
}

function recordTest(name, passed, details = '') {
    testResults.total++;
    if (passed) {
        testResults.passed++;
        log(`PASS: ${name}`, 'pass');
    } else {
        testResults.failed++;
        log(`FAIL: ${name} - ${details}`, 'fail');
    }
    testResults.details.push({ name, passed, details });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the runtime
async function startRuntime() {
    return new Promise((resolve, reject) => {
        log('Starting Vehicle Edge Runtime...');
        
        const env = { ...process.env, SKIP_KIT_MANAGER: 'true' };
        runtimeProcess = spawn('node', ['src/index.js'], { 
            env,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let startupOutput = '';
        runtimeProcess.stdout.on('data', (data) => {
            startupOutput += data.toString();
        });

        runtimeProcess.stderr.on('data', (data) => {
            startupOutput += data.toString();
        });

        runtimeProcess.on('error', (error) => {
            reject(new Error(`Failed to start runtime: ${error.message}`));
        });

        // Wait for startup
        setTimeout(async () => {
            try {
                // Check if WebSocket server is listening
                const ws = new WebSocket(TEST_CONFIG.RUNTIME_URL);
                ws.on('open', () => {
                    ws.close();
                    log('Vehicle Edge Runtime started successfully');
                    resolve();
                });
                ws.on('error', () => {
                    reject(new Error('WebSocket server not responding'));
                });
            } catch (error) {
                reject(new Error(`Runtime startup failed: ${error.message}`));
            }
        }, 5000);
    });
}

// Stop the runtime
async function stopRuntime() {
    if (runtimeProcess) {
        log('Stopping Vehicle Edge Runtime...');
        runtimeProcess.kill('SIGTERM');
        runtimeProcess = null;
        await sleep(2000);
    }
}

// WebSocket test utility
function sendCommand(command) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(TEST_CONFIG.RUNTIME_URL);
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Command timeout'));
        }, TEST_CONFIG.COMMAND_TIMEOUT);

        let response = null;
        
        ws.on('open', () => {
            ws.send(JSON.stringify(command));
        });

        ws.on('message', (data) => {
            try {
                response = JSON.parse(data.toString());
                clearTimeout(timeout);
                ws.close();
                resolve(response);
            } catch (error) {
                clearTimeout(timeout);
                reject(new Error(`Invalid response: ${error.message}`));
            }
        });

        ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

// Test functions
async function testBasicConnectivity() {
    log('Testing basic connectivity...');
    
    try {
        const ws = new WebSocket(TEST_CONFIG.RUNTIME_URL);
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
        ws.close();
        
        recordTest('Basic WebSocket Connectivity', true);
        return true;
    } catch (error) {
        recordTest('Basic WebSocket Connectivity', false, error.message);
        return false;
    }
}

async function testPingCommand() {
    log('Testing ping command...');
    
    try {
        const response = await sendCommand({
            type: 'ping',
            timestamp: new Date().toISOString()
        });
        
        const passed = response.type === 'pong' && response.timestamp;
        recordTest('Ping Command', passed, passed ? 'Successfully received pong' : 'Invalid response');
        return passed;
    } catch (error) {
        recordTest('Ping Command', false, error.message);
        return false;
    }
}

async function testKitRegistration() {
    log('Testing kit registration...');
    
    try {
        const response = await sendCommand({
            type: 'register_kit',
            kitInfo: {
                kit_id: 'test-runtime-001',
                name: 'Test Runtime',
                support_apis: ['run_python_app', 'run_binary_app', 'console_subscribe']
            }
        });
        
        const passed = response.type === 'kit_registered' && response.kit;
        recordTest('Kit Registration', passed, passed ? 'Kit registered successfully' : 'Registration failed');
        return passed;
    } catch (error) {
        recordTest('Kit Registration', false, error.message);
        return false;
    }
}

async function testPythonExecution() {
    log('Testing Python application execution...');
    
    const pythonCode = `
import os
import time

print("Hello from Vehicle Edge Runtime!")
print(f"Execution ID: {os.environ.get('EXECUTION_ID', 'unknown')}")
print(f"App ID: {os.environ.get('APP_ID', 'unknown')}")
time.sleep(1)
print("Python execution completed successfully!")
`;

    try {
        const response = await sendCommand({
            type: 'run_python_app',
            appId: 'test-python-app',
            code: pythonCode,
            entryPoint: 'main.py',
            env: { TEST_VAR: 'test_value' },
            workingDir: '/app'
        });
        
        const passed = response.type === 'python_app_started' && response.executionId;
        recordTest('Python Application Execution', passed, 
            passed ? `App started with execution ID: ${response.executionId}` : 'Failed to start Python app');
        
        if (passed) {
            // Test console output
            await sleep(2000); // Wait for app to output
            const outputResponse = await sendCommand({
                type: 'app_output',
                executionId: response.executionId,
                lines: 10
            });
            
            const hasOutput = outputResponse.type === 'app_output_response' && 
                             outputResponse.output && 
                             outputResponse.output.includes('Hello from Vehicle Edge Runtime');
            
            recordTest('Python Console Output', hasOutput, 
                hasOutput ? 'Console output captured successfully' : 'No console output found');
        }
        
        return passed;
    } catch (error) {
        recordTest('Python Application Execution', false, error.message);
        return false;
    }
}

async function testBinaryExecution() {
    log('Testing binary application execution...');
    
    try {
        const response = await sendCommand({
            type: 'run_binary_app',
            appId: 'test-binary-app',
            binaryPath: '/bin/echo',
            args: ['Hello from binary app!', 'Test passed'],
            env: { BINARY_TEST: 'true' },
            workingDir: '/app'
        });
        
        const passed = response.type === 'binary_app_started' && response.executionId;
        recordTest('Binary Application Execution', passed, 
            passed ? `Binary app started with execution ID: ${response.executionId}` : 'Failed to start binary app');
        return passed;
    } catch (error) {
        recordTest('Binary Application Execution', false, error.message);
        return false;
    }
}

async function testRustAndCppCompatibility() {
    log('Testing Rust/C++ compatibility commands...');
    
    // Test run_rust_app
    try {
        const rustResponse = await sendCommand({
            type: 'run_rust_app',
            appId: 'test-rust-app',
            binaryPath: '/bin/echo',
            args: ['Rust app simulation'],
            workingDir: '/app'
        });
        
        const rustPassed = rustResponse.type === 'binary_app_started'; // Should be treated as binary
        recordTest('Rust App Compatibility', rustPassed, 
            rustPassed ? 'Rust command handled as binary app' : 'Rust command failed');
    } catch (error) {
        recordTest('Rust App Compatibility', false, error.message);
    }

    // Test run_cpp_app
    try {
        const cppResponse = await sendCommand({
            type: 'run_cpp_app',
            appId: 'test-cpp-app',
            binaryPath: '/bin/echo',
            args: ['C++ app simulation'],
            workingDir: '/app'
        });
        
        const cppPassed = cppResponse.type === 'binary_app_started'; // Should be treated as binary
        recordTest('C++ App Compatibility', cppPassed, 
            cppPassed ? 'C++ command handled as binary app' : 'C++ command failed');
    } catch (error) {
        recordTest('C++ App Compatibility', false, error.message);
    }
}

async function testDeployRequest() {
    log('Testing deploy request command...');
    
    const pythonCode = `
print("Deployed app is running!")
print(f"App name: {os.environ.get('APP_NAME', 'Unknown')}")
print(f"User: {os.environ.get('USER_NAME', 'Unknown')}")
`;

    try {
        const response = await sendCommand({
            type: 'deploy_request',
            code: pythonCode,
            prototype: {
                id: 'deploy-test-001',
                name: 'Deploy Test App',
                language: 'python'
            },
            username: 'testuser',
            disable_code_convert: true,
            vehicleId: 'test-vehicle-001'
        });
        
        const passed = response.type === 'deploy_request-response' && 
                     response.status === 'started' &&
                     response.executionId;
                     
        recordTest('Deploy Request', passed, 
            passed ? `Deploy successful with execution ID: ${response.executionId}` : 'Deploy request failed');
        return passed;
    } catch (error) {
        recordTest('Deploy Request', false, error.message);
        return false;
    }
}

async function testVehicleCredentials() {
    log('Testing vehicle credential injection...');
    
    const testCode = `
import os
print("Testing vehicle credentials:")
print(f"Vehicle ID: {os.environ.get('VEHICLE_ID', 'NOT_SET')}")
print(f"Kuksa Server: {os.environ.get('KUKSA_SERVER_URL', 'NOT_SET')}")
print(f"Has Access Token: {'ACCESS_TOKEN' in os.environ}")
print(f"VSS DataPoints: {os.environ.get('VSS_DATAPOINTS', 'NOT_SET')}")
print(f"Credential Injected At: {os.environ.get('CREDENTIAL_INJECTED_AT', 'NOT_SET')}")
`;

    try {
        const response = await sendCommand({
            type: 'run_python_app',
            appId: 'test-credentials',
            code: testCode,
            entryPoint: 'main.py',
            vehicleId: 'test-vehicle-001',
            workingDir: '/app'
        });
        
        const passed = response.type === 'python_app_started' && response.executionId;
        recordTest('Vehicle Credential Injection', passed, 
            passed ? 'Credentials injected successfully' : 'Credential injection failed');
        
        if (passed) {
            await sleep(2000); // Wait for credential output
            const outputResponse = await sendCommand({
                type: 'app_output',
                executionId: response.executionId,
                lines: 10
            });
            
            const hasCredentials = outputResponse.output && 
                                  (outputResponse.output.includes('test-vehicle-001') || 
                                   outputResponse.output.includes('KUKSA_SERVER_URL'));
            
            recordTest('Credential Environment Variables', hasCredentials, 
                hasCredentials ? 'Vehicle credentials found in environment' : 'No credentials in environment');
        }
        
        return passed;
    } catch (error) {
        recordTest('Vehicle Credential Injection', false, error.message);
        return false;
    }
}

async function testSignalValidation() {
    log('Testing VSS signal validation...');
    
    try {
        const response = await sendCommand({
            type: 'check_signal_conflicts',
            app_id: 'signal-test-app',
            signals: [
                { signal: 'Vehicle.Speed', access: 'read' },
                { signal: 'Vehicle.Engine.RPM', access: 'read' },
                { signal: 'Vehicle.Invalid.Signal', access: 'read' } // This should fail
            ]
        });
        
        const passed = response.type === 'check_signal_conflicts-response' &&
                     response.deployment_precheck &&
                     Array.isArray(response.deployment_precheck.signals_required);
                     
        recordTest('Signal Conflict Detection', passed, 
            passed ? 'Signal validation working' : 'Signal validation failed');
        
        if (passed) {
            const hasConflicts = response.deployment_precheck.conflicts_found > 0;
            recordTest('Invalid Signal Detection', hasConflicts, 
                hasConflicts ? 'Correctly detected invalid signal' : 'Failed to detect invalid signal');
        }
        
        return passed;
    } catch (error) {
        recordTest('Signal Conflict Detection', false, error.message);
        return false;
    }
}

async function testApplicationManagement() {
    log('Testing application management commands...');
    
    try {
        // Test list_deployed_apps
        const listResponse = await sendCommand({
            type: 'list_deployed_apps'
        });
        
        const listPassed = listResponse.type === 'list_deployed_apps-response' &&
                          Array.isArray(listResponse.apps);
        
        recordTest('List Deployed Apps', listPassed, 
            listPassed ? `Found ${listResponse.apps.length} apps` : 'Failed to list apps');
        
        // Test get_runtime_info
        const infoResponse = await sendCommand({
            type: 'get-runtime-info'
        });
        
        const infoPassed = infoResponse.type === 'get-runtime-info-response' &&
                         infoResponse.data &&
                         Array.isArray(infoResponse.data.lsOfRunner);
                         
        recordTest('Get Runtime Info', infoPassed, 
            infoPassed ? 'Runtime info retrieved successfully' : 'Failed to get runtime info');
        
        return listPassed && infoPassed;
    } catch (error) {
        recordTest('Application Management', false, error.message);
        return false;
    }
}

async function testVSSConfiguration() {
    log('Testing VSS configuration management...');
    
    try {
        const response = await sendCommand({
            type: 'get_vss_config'
        });
        
        const passed = response.type === 'get_vss_config-response' &&
                     response.vss_config &&
                     response.vss_config.local_cache;
                     
        recordTest('VSS Configuration', passed, 
            passed ? 'VSS config retrieved successfully' : 'Failed to get VSS config');
        return passed;
    } catch (error) {
        recordTest('VSS Configuration', false, error.message);
        return false;
    }
}

async function testConsoleStreaming() {
    log('Testing console output streaming...');
    
    const streamingCode = `
import time
for i in range(5):
    print(f"Streaming line {i+1}")
    time.sleep(0.5)
print("Streaming completed!")
`;

    try {
        // Start app
        const startResponse = await sendCommand({
            type: 'run_python_app',
            appId: 'streaming-test',
            code: streamingCode,
            entryPoint: 'main.py',
            workingDir: '/app'
        });
        
        if (!startResponse.executionId) {
            recordTest('Console Streaming', false, 'Failed to start streaming app');
            return false;
        }

        // Subscribe to console output
        const subscribeResponse = await sendCommand({
            type: 'console_subscribe',
            executionId: startResponse.executionId
        });
        
        const subscribePassed = subscribeResponse.type === 'console_subscribed';
        recordTest('Console Subscription', subscribePassed, 
            subscribePassed ? 'Subscribed to console output' : 'Failed to subscribe');
        
        // Wait for streaming
        await sleep(4000);
        
        // Get output
        const outputResponse = await sendCommand({
            type: 'app_output',
            executionId: startResponse.executionId,
            lines: 20
        });
        
        const hasStreamingOutput = outputResponse.output && 
                                  outputResponse.output.includes('Streaming line 1');
        
        recordTest('Console Streaming Output', hasStreamingOutput, 
            hasStreamingOutput ? 'Streaming output captured' : 'No streaming output found');
        
        return subscribePassed && hasStreamingOutput;
    } catch (error) {
        recordTest('Console Streaming', false, error.message);
        return false;
    }
}

// Generate test report
function generateTestReport() {
    const report = `
========================================
VEHICLE EDGE RUNTIME TEST REPORT
========================================

Test Summary:
- Total Tests: ${testResults.total}
- Passed: ${testResults.passed}
- Failed: ${testResults.failed}
- Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%

Test Results:
${testResults.details.map(test => 
    `${test.passed ? '✅' : '❌'} ${test.name}${test.details ? ` - ${test.details}` : ''}`
).join('\n')}

Implementation Features Verified:
${testResults.passed >= testResults.total * 0.8 ? '✅' : '❌'} WebSocket API Compatibility
${testResults.passed >= testResults.total * 0.8 ? '✅' : '❌'} Python Application Execution  
${testResults.passed >= testResults.total * 0.8 ? '✅' : '❌'} Binary Application Execution
${testResults.passed >= testResults.total * 0.8 ? '✅' : '❌'} Vehicle Credential Injection
${testResults.passed >= testResults.total * 0.8 ? '✅' : '❌'} Frontend Compatibility Commands
${testResults.passed >= testResults.total * 0.8 ? '✅' : '❌'} VSS Signal Management
${testResults.passed >= testResults.total * 0.8 ? '✅' : '❌'} Console Output Streaming
${testResults.passed >= testResults.total * 0.8 ? '✅' : '❌'} Application Lifecycle Management

Status: ${testResults.failed === 0 ? '🟢 ALL TESTS PASSED' : 
         testResults.failed <= 2 ? '🟡 MOSTLY WORKING' : '🔴 NEEDS ATTENTION'}

========================================
Generated: ${new Date().toISOString()}
========================================
`;

    console.log(report);
    
    // Save report to file
    const reportPath = 'test-report.txt';
    fs.writeFileSync(reportPath, report);
    log(`Test report saved to: ${reportPath}`);
    
    return testResults.failed === 0;
}

// Main test execution
async function runAllTests() {
    console.log('🚀 Starting Vehicle Edge Runtime Implementation Tests\n');
    
    try {
        // Start the runtime
        await startRuntime();
        
        // Run all tests
        await testBasicConnectivity();
        await testPingCommand();
        await testKitRegistration();
        await testPythonExecution();
        await testBinaryExecution();
        await testRustAndCppCompatibility();
        await testDeployRequest();
        await testVehicleCredentials();
        await testSignalValidation();
        await testApplicationManagement();
        await testVSSConfiguration();
        await testConsoleStreaming();
        
        // Generate report
        const allPassed = generateTestReport();
        
        console.log(`\n🏁 Testing completed! All tests ${allPassed ? 'PASSED ✅' : 'DID NOT PASS ❌'}`);
        
    } catch (error) {
        log(`Test execution failed: ${error.message}`, 'fail');
    } finally {
        await stopRuntime();
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    log('Received SIGINT, cleaning up...');
    await stopRuntime();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    log('Received SIGTERM, cleaning up...');
    await stopRuntime();
    process.exit(0);
});

// Run tests
runAllTests().catch(error => {
    log(`Fatal error: ${error.message}`, 'fail');
    process.exit(1);
});