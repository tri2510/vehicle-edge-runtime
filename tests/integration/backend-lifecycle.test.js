#!/usr/bin/env node

/**
 * Backend Lifecycle Test Suite
 *
 * Comprehensive test suite that simulates frontend lifecycle management
 * to validate backend API responses match expected format.
 *
 * Based on frontend integration requirements from autowrx project.
 *
 * Usage:
 *   node tests/integration/backend-lifecycle.test.js
 *   WS_URL=ws://localhost:3002/runtime node tests/integration/backend-lifecycle.test.js
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import { spawn } from 'child_process';
import http from 'node:http';

const WS_URL = process.env.WS_URL || 'ws://localhost:3002/runtime';
const WS_PORT = 3002;
const HEALTH_PORT = 3003;

// Test tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: 0,
  tests: []
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate response format matches frontend expectations
 */
function validateResponse(message) {
  const errors = [];

  if (message.type === 'error') {
    // Error responses must have:
    if (!message.error) {
      errors.push('Error response missing "error" field');
    }
    if (!message.app_id) {
      errors.push('Error response missing "app_id" field');
    }
    return { isValid: errors.length === 0, errors, isErrorResponse: true };
  }

  // Success responses must have:
  if (!message.status) {
    errors.push('Missing required field: "status"');
  }
  if (!message.result) {
    errors.push('Missing required field: "result"');
  }
  if (!message.state) {
    errors.push('Missing required field: "state"');
  }

  return { isValid: errors.length === 0, errors, isErrorResponse: false };
}

function recordTest(testName, message, responseTime) {
  const validation = validateResponse(message);
  const result = {
    test: testName,
    type: message.type,
    timestamp: new Date().toISOString(),
    responseTime: responseTime + 'ms',
    valid: validation.isValid,
    errors: validation.errors,
    isErrorResponse: validation.isErrorResponse
  };

  testResults.tests.push(result);

  if (validation.isValid) {
    testResults.passed++;
    log(`   ✅ PASS: ${message.result || 'Success'}`, 'green');
    if (message.state) {
      log(`   State: ${message.state}, Status: ${message.status}`, 'blue');
    }
  } else {
    testResults.failed++;
    log(`   ❌ FAIL: Missing required fields`, 'red');
    validation.errors.forEach(err => log(`      - ${err}`, 'red'));
  }

  if (validation.isErrorResponse) {
    testResults.errors++;
    log(`   ⚠️  Expected Error: ${message.error}`, 'yellow');
  }
}

/**
 * Wait for service to be ready
 */
async function waitForService(port, path = '/', timeoutMs = 15000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}${path}`, (res) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', reject);
        req.setTimeout(2000, reject);
      });
      return true;
    } catch (error) {
      await sleep(500);
    }
  }
  throw new Error(`Service on port ${port} not ready within ${timeoutMs}ms`);
}

/**
 * Connect to WebSocket
 */
async function connectWebSocket(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, timeoutMs);

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

/**
 * Send message and wait for response
 */
async function sendMessage(ws, message, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Message response timeout'));
    }, timeoutMs);

    const messageHandler = (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id === message.id) {
          clearTimeout(timeout);
          ws.removeListener('message', messageHandler);
          resolve(response);
        }
      } catch (error) {
        // Ignore malformed responses
      }
    };

    ws.on('message', messageHandler);

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      clearTimeout(timeout);
      ws.removeListener('message', messageHandler);
      reject(new Error('WebSocket not open'));
    }
  });
}

describe('Backend Lifecycle Management Tests', { timeout: 120000 }, () => {
  let runtimeProcess;
  let ws;
  let messageCounter = 0;
  const messageTimestamps = new Map();

  before(async () => {
    log('\n╔══════════════════════════════════════════════════════════════╗', 'magenta');
    log('║  Backend Lifecycle Test Suite                                ║', 'magenta');
    log('║  Frontend Integration Validation                             ║', 'magenta');
    log('╚══════════════════════════════════════════════════════════════╝', 'magenta');

    // Start the runtime process
    log('\n🚀 Starting Vehicle Edge Runtime...', 'cyan');
    runtimeProcess = spawn('node', ['src/index.js'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: WS_PORT.toString(),
        HEALTH_PORT: HEALTH_PORT.toString()
      }
    });

    runtimeProcess.stdout.on('data', (data) => {
      // Uncomment to see runtime output
      // process.stdout.write(data);
    });

    runtimeProcess.stderr.on('data', (data) => {
      // Uncomment to see runtime errors
      // process.stderr.write(data);
    });

    // Wait for service to be ready
    await waitForService(HEALTH_PORT, '/health');
    log('✅ Runtime health check passed', 'green');

    // Connect WebSocket
    log(`🔌 Connecting to WebSocket: ${WS_URL}`, 'cyan');
    ws = await connectWebSocket();
    log('✅ WebSocket connected', 'green');

    // Register client
    const registerMsg = {
      type: 'register_client',
      id: `test-register-${Date.now()}`,
      clientInfo: {
        name: 'Backend Lifecycle Test Suite',
        version: '1.0.0',
        platform: 'node'
      }
    };

    ws.send(JSON.stringify(registerMsg));
    await sleep(1000);
    log('✅ Client registered', 'green');
  });

  after(async () => {
    if (ws) {
      ws.close();
    }
    if (runtimeProcess) {
      runtimeProcess.kill('SIGTERM');
      await sleep(1000);
      runtimeProcess.kill('SIGKILL');
    }
    printResults();
  });

  test('DEPLOYMENT TESTS', async () => {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
    log('  DEPLOYMENT TESTS', 'blue');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');

    // Test 1: Deploy KUKSA Data Broker
    log('\n📦 Test 1: Deploy KUKSA Data Broker', 'blue');
    const deploy1 = {
      type: 'deploy_request',
      id: `test-deploy-1-${Date.now()}`,
      code: `print("KUKSA Data Broker Running...")
import time
for i in range(100):
    print(f"KUKSA: Vehicle.Speed={50 + i} km/h")
    time.sleep(1)`,
      vehicleId: 'test-vehicle',
      language: 'python',
      prototype: {
        id: 'kuksa-data-broker',
        name: 'KUKSA Data Broker',
        description: 'Vehicle data broker service',
        version: '1.0.0'
      },
      dependencies: []
    };
    messageTimestamps.set(deploy1.id, Date.now());

    const response1 = await sendMessage(ws, deploy1);
    const responseTime1 = Date.now() - messageTimestamps.get(deploy1.id);
    log(`📨 Received: ${response1.type}`, 'magenta');
    recordTest('Deploy KUKSA Data Broker', response1, responseTime1);

    assert.strictEqual(response1.type, 'deploy_request-response');
    await sleep(3000);

    // Test 2: Deploy Mock Service
    log('\n📦 Test 2: Deploy Mock Service', 'blue');
    const deploy2 = {
      type: 'deploy_request',
      id: `test-deploy-2-${Date.now()}`,
      code: `print("Mock Service Running...")
import time
for i in range(50):
    print(f"Mock: iteration={i}, value={i*10}")
    time.sleep(1)`,
      vehicleId: 'test-vehicle',
      language: 'python',
      prototype: {
        id: 'mock-service',
        name: 'Mock Service',
        description: 'Test mock service',
        version: '1.0.0'
      },
      dependencies: []
    };
    messageTimestamps.set(deploy2.id, Date.now());

    const response2 = await sendMessage(ws, deploy2);
    const responseTime2 = Date.now() - messageTimestamps.get(deploy2.id);
    log(`📨 Received: ${response2.type}`, 'magenta');
    recordTest('Deploy Mock Service', response2, responseTime2);

    assert.strictEqual(response2.type, 'deploy_request-response');
    await sleep(3000);

    // Test 3: Deploy Custom Python App
    log('\n📦 Test 3: Deploy Custom Python App', 'blue');
    const deploy3 = {
      type: 'deploy_request',
      id: `test-deploy-3-${Date.now()}`,
      code: `print("Custom App Running...")
import time
import random
for i in range(100):
    temp = random.uniform(20, 30)
    print(f"Temperature: {temp:.2f}°C")
    time.sleep(1)`,
      vehicleId: 'test-vehicle',
      language: 'python',
      prototype: {
        id: 'custom-python-app',
        name: 'Custom Python App',
        description: 'Custom monitoring application',
        version: '1.0.0'
      },
      dependencies: []
    };
    messageTimestamps.set(deploy3.id, Date.now());

    const response3 = await sendMessage(ws, deploy3);
    const responseTime3 = Date.now() - messageTimestamps.get(deploy3.id);
    log(`📨 Received: ${response3.type}`, 'magenta');
    recordTest('Deploy Custom Python App', response3, responseTime3);

    assert.strictEqual(response3.type, 'deploy_request-response');
    await sleep(3000);
  });

  test('LIFECYCLE MANAGEMENT TESTS', async () => {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
    log('  LIFECYCLE MANAGEMENT TESTS', 'blue');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');

    // Test 4: List all apps
    log('\n📋 Test 4: List Deployed Apps', 'blue');
    const listMsg = {
      type: 'list_deployed_apps',
      id: `test-list-${Date.now()}`
    };
    messageTimestamps.set(listMsg.id, Date.now());

    const listResponse = await sendMessage(ws, listMsg);
    const listTime = Date.now() - messageTimestamps.get(listMsg.id);
    log(`📨 Received: ${listResponse.type}`, 'magenta');
    log(`   Found ${listResponse.applications?.length || 0} applications`, 'blue');

    if (listResponse.applications) {
      listResponse.applications.forEach(app => {
        log(`   - ${app.name} (${app.app_id}): ${app.status}`, 'cyan');
      });
    }

    assert.strictEqual(listResponse.type, 'list_deployed_apps-response');
    assert.ok(Array.isArray(listResponse.applications));
    await sleep(2000);

    // Test 5: Stop KUKSA Data Broker
    log('\n⏹️  Test 5: Stop KUKSA Data Broker', 'blue');
    const stopMsg = {
      type: 'stop_app',
      id: `test-stop-${Date.now()}`,
      appId: 'kuksa-data-broker'
    };
    messageTimestamps.set(stopMsg.id, Date.now());

    const stopResponse = await sendMessage(ws, stopMsg);
    const stopTime = Date.now() - messageTimestamps.get(stopMsg.id);
    log(`📨 Received: ${stopResponse.type}`, 'magenta');
    recordTest('Stop KUKSA Data Broker', stopResponse, stopTime);

    assert.strictEqual(stopResponse.type, 'stop_app-response');
    await sleep(2000);

    // Test 6: Start Mock Service
    log('\n▶️  Test 6: Start Mock Service', 'blue');
    const startMsg = {
      type: 'run_app',
      id: `test-start-${Date.now()}`,
      appId: 'mock-service'
    };
    messageTimestamps.set(startMsg.id, Date.now());

    const startResponse = await sendMessage(ws, startMsg);
    const startTime = Date.now() - messageTimestamps.get(startMsg.id);
    log(`📨 Received: ${startResponse.type}`, 'magenta');
    recordTest('Start Mock Service', startResponse, startTime);

    assert.strictEqual(startResponse.type, 'run_app-response');
    await sleep(2000);

    // Test 7: Pause Custom App
    log('\n⏸️  Test 7: Pause Custom Python App', 'blue');
    const pauseMsg = {
      type: 'pause_app',
      id: `test-pause-${Date.now()}`,
      appId: 'custom-python-app'
    };
    messageTimestamps.set(pauseMsg.id, Date.now());

    const pauseResponse = await sendMessage(ws, pauseMsg);
    const pauseTime = Date.now() - messageTimestamps.get(pauseMsg.id);
    log(`📨 Received: ${pauseResponse.type}`, 'magenta');
    recordTest('Pause Custom Python App', pauseResponse, pauseTime);

    assert.strictEqual(pauseResponse.type, 'pause_app-response');
    await sleep(2000);

    // Test 8: Resume Custom App
    log('\n▶️  Test 8: Resume Custom Python App', 'blue');
    const resumeMsg = {
      type: 'resume_app',
      id: `test-resume-${Date.now()}`,
      appId: 'custom-python-app'
    };
    messageTimestamps.set(resumeMsg.id, Date.now());

    const resumeResponse = await sendMessage(ws, resumeMsg);
    const resumeTime = Date.now() - messageTimestamps.get(resumeMsg.id);
    log(`📨 Received: ${resumeResponse.type}`, 'magenta');
    recordTest('Resume Custom Python App', resumeResponse, resumeTime);

    assert.strictEqual(resumeResponse.type, 'resume_app-response');
    await sleep(2000);

    // Test 9: Restart KUKSA (stop + start)
    log('\n🔄 Test 9: Restart KUKSA Data Broker', 'blue');
    const restartStop = {
      type: 'stop_app',
      id: `test-restart-stop-${Date.now()}`,
      appId: 'kuksa-data-broker'
    };
    messageTimestamps.set(restartStop.id, Date.now());

    const restartStopResponse = await sendMessage(ws, restartStop);
    const restartStopTime = Date.now() - messageTimestamps.get(restartStop.id);
    log(`📨 Received: ${restartStopResponse.type}`, 'magenta');
    recordTest('Restart Stop KUKSA', restartStopResponse, restartStopTime);

    await sleep(1500);

    const restartStart = {
      type: 'run_app',
      id: `test-restart-start-${Date.now()}`,
      appId: 'kuksa-data-broker'
    };
    messageTimestamps.set(restartStart.id, Date.now());

    const restartStartResponse = await sendMessage(ws, restartStart);
    const restartStartTime = Date.now() - messageTimestamps.get(restartStart.id);
    log(`📨 Received: ${restartStartResponse.type}`, 'magenta');
    recordTest('Restart Start KUKSA', restartStartResponse, restartStartTime);

    await sleep(2000);
  });

  test('ERROR HANDLING TESTS', async () => {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
    log('  ERROR HANDLING TESTS', 'blue');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');

    // Test 10: Try to stop non-existent app (should error)
    log('\n❌ Test 10: Stop Non-Existent App (Should Error)', 'blue');
    const errorTest = {
      type: 'stop_app',
      id: `test-error-${Date.now()}`,
      appId: 'non-existent-app-12345'
    };
    messageTimestamps.set(errorTest.id, Date.now());

    const errorResponse = await sendMessage(ws, errorTest);
    const errorTime = Date.now() - messageTimestamps.get(errorTest.id);
    log(`📨 Received: ${errorResponse.type}`, 'magenta');
    recordTest('Stop Non-Existent App', errorResponse, errorTime);

    assert.strictEqual(errorResponse.type, 'error');
    assert.ok(errorResponse.error);
    await sleep(2000);

    // Test 11: Try to resume non-paused app (should error)
    log('\n❌ Test 11: Resume Non-Paused App (Should Error)', 'blue');
    const errorTest2 = {
      type: 'resume_app',
      id: `test-error2-${Date.now()}`,
      appId: 'kuksa-data-broker'  // Should be running after restart
    };
    messageTimestamps.set(errorTest2.id, Date.now());

    const errorResponse2 = await sendMessage(ws, errorTest2);
    const errorTime2 = Date.now() - messageTimestamps.get(errorTest2.id);
    log(`📨 Received: ${errorResponse2.type}`, 'magenta');
    recordTest('Resume Non-Paused App', errorResponse2, errorTime2);

    // This might not error depending on state, log result either way
    await sleep(2000);

    // Test 12: Uninstall Mock Service
    log('\n🗑️  Test 12: Uninstall Mock Service', 'blue');
    const uninstallMsg = {
      type: 'uninstall_app',
      id: `test-uninstall-${Date.now()}`,
      appId: 'mock-service'
    };
    messageTimestamps.set(uninstallMsg.id, Date.now());

    const uninstallResponse = await sendMessage(ws, uninstallMsg);
    const uninstallTime = Date.now() - messageTimestamps.get(uninstallMsg.id);
    log(`📨 Received: ${uninstallResponse.type}`, 'magenta');
    recordTest('Uninstall Mock Service', uninstallResponse, uninstallTime);

    assert.strictEqual(uninstallResponse.type, 'uninstall_app-response');
    await sleep(2000);

    // Test 13: Test with VEA- prefix
    log('\n🔍 Test 13: Test App ID with VEA- Prefix', 'blue');
    const prefixTest = {
      type: 'run_app',
      id: `test-prefix-${Date.now()}`,
      appId: 'VEA-kuksa-data-broker'  // With prefix
    };
    messageTimestamps.set(prefixTest.id, Date.now());

    const prefixResponse = await sendMessage(ws, prefixTest);
    const prefixTime = Date.now() - messageTimestamps.get(prefixTest.id);
    log(`📨 Received: ${prefixResponse.type}`, 'magenta');
    recordTest('Test with VEA- Prefix', prefixResponse, prefixTime);

    await sleep(2000);

    log('\n✅ All tests completed!', 'green');
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  });
});

function printResults() {
  log('\n╔══════════════════════════════════════════════════════════════╗', 'magenta');
  log('║  TEST RESULTS                                               ║', 'magenta');
  log('╚══════════════════════════════════════════════════════════════╝', 'magenta');

  log(`\n✅ Passed: ${testResults.passed}`, 'green');
  log(`❌ Failed: ${testResults.failed}`, 'red');
  log(`⚠️  Errors (Expected): ${testResults.errors}`, 'yellow');
  log(`📊 Total: ${testResults.tests.length}`, 'blue');

  if (testResults.failed > 0) {
    log('\n❌ Failed Tests:', 'red');
    testResults.tests.filter(t => !t.valid && !t.isErrorResponse).forEach(test => {
      log(`   - ${test.type}`, 'red');
      test.errors.forEach(err => log(`     ${err}`, 'red'));
    });
  }

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');
}
