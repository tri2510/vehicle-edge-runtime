#!/usr/bin/env node

/**
 * Backend Lifecycle Test Runner - Standalone Script
 *
 * Simulates frontend lifecycle management to validate backend API responses.
 * This standalone script can be run without the Node.js test runner.
 *
 * Usage:
 *   node backend-lifecycle-test-runner.js
 *   WS_URL=ws://localhost:3002/runtime node backend-lifecycle-test-runner.js
 *
 * Based on frontend integration requirements from autowrx/frontend project.
 */

const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:3002/runtime';

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

async function runTests() {
  log('\n╔══════════════════════════════════════════════════════════════╗', 'magenta');
  log('║  Backend Lifecycle Test Runner                               ║', 'magenta');
  log('║  Frontend Integration Validation                             ║', 'magenta');
  log('╚══════════════════════════════════════════════════════════════╝', 'magenta');

  const ws = new WebSocket(WS_URL);
  let messageCounter = 0;
  const messageTimestamps = new Map();

  ws.on('open', async () => {
    log('\n✅ Connected to Vehicle Edge Runtime', 'green');
    log(`   URL: ${WS_URL}`, 'blue');

    // Register client
    const registerMsg = {
      type: 'register_client',
      id: `test-register-${Date.now()}`,
      clientInfo: {
        name: 'Backend Lifecycle Test Runner',
        version: '1.0.0',
        platform: 'node'
      }
    };

    ws.send(JSON.stringify(registerMsg));
    await sleep(1000);

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
    ws.send(JSON.stringify(deploy1));
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
    ws.send(JSON.stringify(deploy2));
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
    ws.send(JSON.stringify(deploy3));
    await sleep(3000);

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
    ws.send(JSON.stringify(listMsg));
    await sleep(2000);

    // Test 5: Stop KUKSA Data Broker
    log('\n⏹️  Test 5: Stop KUKSA Data Broker', 'blue');
    const stopMsg = {
      type: 'stop_app',
      id: `test-stop-${Date.now()}`,
      appId: 'kuksa-data-broker'
    };
    messageTimestamps.set(stopMsg.id, Date.now());
    ws.send(JSON.stringify(stopMsg));
    await sleep(2000);

    // Test 6: Start Mock Service
    log('\n▶️  Test 6: Start Mock Service', 'blue');
    const startMsg = {
      type: 'run_app',
      id: `test-start-${Date.now()}`,
      appId: 'mock-service'
    };
    messageTimestamps.set(startMsg.id, Date.now());
    ws.send(JSON.stringify(startMsg));
    await sleep(2000);

    // Test 7: Pause Custom App
    log('\n⏸️  Test 7: Pause Custom Python App', 'blue');
    const pauseMsg = {
      type: 'pause_app',
      id: `test-pause-${Date.now()}`,
      appId: 'custom-python-app'
    };
    messageTimestamps.set(pauseMsg.id, Date.now());
    ws.send(JSON.stringify(pauseMsg));
    await sleep(2000);

    // Test 8: Resume Custom App
    log('\n▶️  Test 8: Resume Custom Python App', 'blue');
    const resumeMsg = {
      type: 'resume_app',
      id: `test-resume-${Date.now()}`,
      appId: 'custom-python-app'
    };
    messageTimestamps.set(resumeMsg.id, Date.now());
    ws.send(JSON.stringify(resumeMsg));
    await sleep(2000);

    // Test 9: Restart KUKSA (stop + start)
    log('\n🔄 Test 9: Restart KUKSA Data Broker', 'blue');
    const restartStop = {
      type: 'stop_app',
      id: `test-restart-stop-${Date.now()}`,
      appId: 'kuksa-data-broker'
    };
    messageTimestamps.set(restartStop.id, Date.now());
    ws.send(JSON.stringify(restartStop));
    await sleep(1500);

    const restartStart = {
      type: 'run_app',
      id: `test-restart-start-${Date.now()}`,
      appId: 'kuksa-data-broker'
    };
    messageTimestamps.set(restartStart.id, Date.now());
    ws.send(JSON.stringify(restartStart));
    await sleep(2000);

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
    ws.send(JSON.stringify(errorTest));
    await sleep(2000);

    // Test 11: Try to resume non-paused app (should error)
    log('\n❌ Test 11: Resume Non-Paused App (Should Error)', 'blue');
    const errorTest2 = {
      type: 'resume_app',
      id: `test-error2-${Date.now()}`,
      appId: 'kuksa-data-broker'  // Should be running after restart
    };
    messageTimestamps.set(errorTest2.id, Date.now());
    ws.send(JSON.stringify(errorTest2));
    await sleep(2000);

    // Test 12: Uninstall Mock Service
    log('\n🗑️  Test 12: Uninstall Mock Service', 'blue');
    const uninstallMsg = {
      type: 'uninstall_app',
      id: `test-uninstall-${Date.now()}`,
      appId: 'mock-service'
    };
    messageTimestamps.set(uninstallMsg.id, Date.now());
    ws.send(JSON.stringify(uninstallMsg));
    await sleep(2000);

    // Test 13: Test with VEA- prefix
    log('\n🔍 Test 13: Test App ID with VEA- Prefix', 'blue');
    const prefixTest = {
      type: 'run_app',
      id: `test-prefix-${Date.now()}`,
      appId: 'VEA-kuksa-data-broker'  // With prefix
    };
    messageTimestamps.set(prefixTest.id, Date.now());
    ws.send(JSON.stringify(prefixTest));
    await sleep(2000);

    log('\n✅ All tests completed!', 'green');
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');

    // Wait for final responses then close
    await sleep(3000);
    ws.close();
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      const responseTime = Date.now() - (messageTimestamps.get(message.id) || Date.now());

      log(`\n📨 Received: ${message.type}`, 'magenta');

      if (message.type === 'list_deployed_apps-response') {
        log(`   Found ${message.applications?.length || 0} applications`, 'blue');
        if (message.applications) {
          message.applications.forEach(app => {
            log(`   - ${app.name} (${app.app_id}): ${app.status}`, 'cyan');
          });
        }
      } else if (message.type === 'error') {
        log(`   ❌ Error: ${message.error}`, 'red');
        recordTest('Error Response', message, responseTime);
      } else {
        // Record as lifecycle test
        const testName = message.action || message.type;
        recordTest(testName, message, responseTime);
      }
    } catch (error) {
      log(`   ⚠️  Failed to parse message: ${error.message}`, 'yellow');
    }
  });

  ws.on('error', (error) => {
    log(`\n❌ WebSocket Error: ${error.message}`, 'red');
    process.exit(1);
  });

  ws.on('close', () => {
    printResults();
  });
}

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

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  log(`\n❌ Fatal Error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
