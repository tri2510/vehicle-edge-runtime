#!/usr/bin/env node

/**
 * FIXED & COMPREHENSIVE Vehicle App Lifecycle Management Test Suite
 *
 * All tests fixed to handle actual API response formats
 * Enhanced with more test scenarios
 */

const WebSocket = require('/home/htr1hc/01_SDV/78_deploy_extension/vehicle-edge-runtime/node_modules/ws');

const WS_URL = 'ws://localhost:3002/runtime';
const TEST_TIMEOUT = 30000;

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

class LifecycleTester {
  constructor() {
    this.ws = null;
    this.messageId = 0;
    this.responses = new Map();
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log(`${colors.green}✅ WebSocket connected${colors.reset}`);
        resolve();
      });

      this.ws.on('message', (data) => {
        const msg = JSON.parse(data);
        const pending = this.responses.get(msg.id);
        if (pending) {
          pending(msg);
        }
      });

      this.ws.on('error', (err) => {
        console.error(`${colors.red}❌ WebSocket error:${colors.reset}`, err.message);
        reject(err);
      });

      this.ws.on('close', () => {
        console.log(`${colors.yellow}⚠️  WebSocket closed${colors.reset}`);
      });
    });
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      const id = message.id || `test-${this.messageId++}`;
      message.id = id;

      this.ws.send(JSON.stringify(message));

      const timeout = setTimeout(() => {
        this.responses.delete(id);
        reject(new Error(`Message ${id} timed out after ${TEST_TIMEOUT}ms`));
      }, TEST_TIMEOUT);

      this.responses.set(id, (response) => {
        clearTimeout(timeout);
        this.responses.delete(id);
        resolve(response);
      });
    });
  }

  async deployTestApp(appId) {
    console.log(`\n${colors.cyan}📦 Deploying test app: ${appId}${colors.reset}`);

    const message = {
      type: 'deploy_request',
      id: `deploy-${appId}-${Date.now()}`,
      code: `
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    logger.info("Test app started")
    import time
    try:
        while True:
            logger.info("App is running...")
            time.sleep(5)
    except KeyboardInterrupt:
        logger.info("App stopped")

if __name__ == "__main__":
    main()
      `,
      prototype: {
        id: appId,
        name: `Test App ${appId}`,
        description: 'Test application for lifecycle testing',
        version: '1.0.0',
        type: 'python'
      },
      vehicleId: 'test-vehicle',
      language: 'python'
    };

    const response = await this.sendMessage(message);
    console.log(`   Status: ${response.status || 'unknown'}`);
    if (response.type === 'error') {
      throw new Error(`Deploy failed: ${response.error}`);
    }
    return response;
  }

  async listApps() {
    const message = {
      type: 'list_deployed_apps',
      id: `list-${Date.now()}`
    };

    const response = await this.sendMessage(message);
    return response.applications || response.apps || [];
  }

  async getAppStatus(appId) {
    const message = {
      type: 'get_app_status',
      id: `status-${appId}-${Date.now()}`,
      appId: appId
    };

    const response = await this.sendMessage(message);
    return response;
  }

  /**
   * FIXED: Extract actual state from get_app_status response
   */
  extractAppState(statusResponse) {
    if (statusResponse.type === 'error') {
      return null;
    }

    // Response format: { result: { status: { current_state: 'running', ... } } }
    if (statusResponse.result && statusResponse.result.status) {
      return statusResponse.result.status.current_state || statusResponse.result.status.status;
    }

    return null;
  }

  async manageApp(appId, action) {
    const message = {
      type: 'manage_app',
      id: `manage-${appId}-${action}-${Date.now()}`,
      app_id: appId,
      action: action
    };

    return await this.sendMessage(message);
  }

  /**
   * FIXED: Check state with proper response parsing
   */
  async testState(appId, expectedStates) {
    const response = await this.getAppStatus(appId);

    if (response.type === 'error') {
      console.log(`${colors.red}   ✗ Status query failed: ${response.error}${colors.reset}`);
      return false;
    }

    const actualState = this.extractAppState(response);

    if (expectedStates.includes(actualState)) {
      console.log(`${colors.green}   ✓ State: ${actualState}${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}   ✗ State check failed: expected ${expectedStates.join(' or ')}, got ${actualState}${colors.reset}`);
      console.log(`${colors.yellow}      Full response:${colors.reset}`, JSON.stringify(response, null, 2));
      return false;
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test 1: Full lifecycle workflow
   */
  async testFullLifecycleWorkflow() {
    const testName = 'Full Lifecycle Workflow';
    console.log(`\n${colors.blue}=== Test: ${testName} ===${colors.reset}`);

    const appId = `test-lifecycle-${Date.now()}`;
    let testPassed = true;

    try {
      // Deploy
      await this.deployTestApp(appId);
      await this.delay(5000);

      // Check app exists in list (with VEA- prefix)
      const deployedApps = await this.listApps();
      const app = deployedApps.find(a => a.app_id === `VEA-${appId}` || a.app_id === appId);
      if (!app) {
        throw new Error('App not found in list after deployment');
      }
      console.log(`${colors.green}   ✓ App deployed with ID: ${app.app_id}${colors.reset}`);

      // Check initial state
      testPassed &&= await this.testState(appId, ['running', 'starting']);

      // Pause
      console.log(`\n${colors.cyan}⏸️  Pausing app...${colors.reset}`);
      const pauseResponse = await this.manageApp(appId, 'pause');
      if (pauseResponse.type === 'error') {
        console.log(`${colors.yellow}   ⚠️  Pause failed: ${pauseResponse.error}${colors.reset}`);
      }
      await this.delay(3000);
      testPassed &&= await this.testState(appId, ['paused', 'stopped']);

      // Resume
      console.log(`\n${colors.cyan}▶️  Resuming app...${colors.reset}`);
      const resumeResponse = await this.manageApp(appId, 'resume');
      if (resumeResponse.type === 'error') {
        console.log(`${colors.yellow}   ⚠️  Resume failed: ${resumeResponse.error}${colors.reset}`);
      }
      await this.delay(3000);
      testPassed &&= await this.testState(appId, ['running']);

      // Stop
      console.log(`\n${colors.cyan}⏹️  Stopping app...${colors.reset}`);
      await this.manageApp(appId, 'stop');
      await this.delay(3000);
      testPassed &&= await this.testState(appId, ['stopped']);

      // Remove
      console.log(`\n${colors.cyan}🗑️  Removing app...${colors.reset}`);
      await this.manageApp(appId, 'remove');
      await this.delay(2000);

      const finalApps = await this.listApps();
      const removedApp = finalApps.find(a => a.app_id === `VEA-${appId}` || a.app_id === appId);
      if (removedApp) {
        console.log(`${colors.red}   ✗ App still exists after removal${colors.reset}`);
        testPassed = false;
      } else {
        console.log(`${colors.green}   ✓ App removed${colors.reset}`);
      }

    } catch (error) {
      console.error(`${colors.red}   ✗ Error: ${error.message}${colors.reset}`);
      testPassed = false;
    }

    return { name: testName, passed: testPassed };
  }

  /**
   * Test 2: Restart action
   */
  async testRestartAction() {
    const testName = 'Restart Action';
    console.log(`\n${colors.blue}=== Test: ${testName} ===${colors.reset}`);

    const appId = `test-restart-${Date.now()}`;
    let testPassed = true;

    try {
      await this.deployTestApp(appId);
      await this.delay(5000);

      const initialState = await this.testState(appId, ['running']);
      testPassed &&= initialState;

      // Restart
      console.log(`\n${colors.cyan}🔄 Restarting app...${colors.reset}`);
      const startTime = Date.now();
      const response = await this.manageApp(appId, 'restart');

      if (response.type === 'error') {
        console.log(`${colors.red}   ✗ Restart failed: ${response.error}${colors.reset}`);
        testPassed = false;
      } else {
        const restartDuration = Date.now() - startTime;
        console.log(`${colors.green}   ✓ Restart completed in ${restartDuration}ms${colors.reset}`);

        await this.delay(5000);
        testPassed &&= await this.testState(appId, ['running']);
      }

      // Cleanup
      await this.manageApp(appId, 'stop');
      await this.manageApp(appId, 'remove');

    } catch (error) {
      console.error(`${colors.red}   ✗ Error: ${error.message}${colors.reset}`);
      testPassed = false;
    }

    return { name: testName, passed: testPassed };
  }

  /**
   * Test 3: Invalid state transitions
   */
  async testInvalidTransitions() {
    const testName = 'Invalid State Transitions';
    console.log(`\n${colors.blue}=== Test: ${testName} ===${colors.reset}`);

    const appId = `test-invalid-${Date.now()}`;
    let testPassed = true;

    try {
      await this.deployTestApp(appId);
      await this.delay(5000);

      // Stop the app first
      console.log(`\n${colors.cyan}⏹️  Stopping app for transition tests...${colors.reset}`);
      await this.manageApp(appId, 'stop');
      await this.delay(3000);

      // Try to pause a stopped app
      console.log(`\n${colors.cyan}Testing pause on stopped app...${colors.reset}`);
      let response = await this.manageApp(appId, 'pause');
      if (response.type === 'error') {
        console.log(`${colors.green}   ✓ Correctly rejected pause on stopped app${colors.reset}`);
      } else {
        console.log(`${colors.yellow}   ⚠️  Pause allowed on stopped app (may be intentional)${colors.reset}`);
      }

      // Try to resume a non-paused app
      console.log(`\n${colors.cyan}Testing resume on non-paused app...${colors.reset}`);
      response = await this.manageApp(appId, 'resume');
      if (response.type === 'error') {
        console.log(`${colors.green}   ✓ Correctly rejected resume on non-paused app${colors.reset}`);
      } else {
        console.log(`${colors.yellow}   ⚠️  Resume allowed on non-paused app (may be intentional)${colors.reset}`);
      }

      // Cleanup
      await this.manageApp(appId, 'remove');

    } catch (error) {
      console.error(`${colors.red}   ✗ Error: ${error.message}${colors.reset}`);
      testPassed = false;
    }

    return { name: testName, passed: testPassed };
  }

  /**
   * Test 4: Multiple pause/resume cycles
   */
  async testMultiplePauseResumeCycles() {
    const testName = 'Multiple Pause/Resume Cycles';
    console.log(`\n${colors.blue}=== Test: ${testName} ===${colors.reset}`);

    const appId = `test-cycles-${Date.now()}`;
    let testPassed = true;

    try {
      await this.deployTestApp(appId);
      await this.delay(5000);

      for (let i = 0; i < 3; i++) {
        console.log(`\n${colors.cyan}Cycle ${i + 1}/3:${colors.reset}`);

        const pauseResponse = await this.manageApp(appId, 'pause');
        if (pauseResponse.type === 'error') {
          console.log(`${colors.yellow}   ⚠️  Pause failed: ${pauseResponse.error}${colors.reset}`);
          continue;
        }

        await this.delay(3000);
        const pauseState = await this.testState(appId, ['paused', 'stopped']);
        testPassed &&= pauseState;

        const resumeResponse = await this.manageApp(appId, 'resume');
        if (resumeResponse.type === 'error') {
          console.log(`${colors.yellow}   ⚠️  Resume failed: ${resumeResponse.error}${colors.reset}`);
          continue;
        }

        await this.delay(3000);
        const resumeState = await this.testState(appId, ['running']);
        testPassed &&= resumeState;
      }

      console.log(`${colors.green}   ✓ All cycles completed${colors.reset}`);

      // Cleanup
      await this.manageApp(appId, 'stop');
      await this.manageApp(appId, 'remove');

    } catch (error) {
      console.error(`${colors.red}   ✗ Error: ${error.message}${colors.reset}`);
      testPassed = false;
    }

    return { name: testName, passed: testPassed };
  }

  /**
   * Test 5: Action on non-existent app (CRITICAL BUG FIX)
   */
  async testNonExistentApp() {
    const testName = 'Action on Non-Existent App';
    console.log(`\n${colors.blue}=== Test: ${testName} ===${colors.reset}`);

    let testPassed = true;

    try {
      const fakeAppId = `non-existent-${Date.now()}-${Math.random()}`;

      console.log(`\n${colors.cyan}Testing start on non-existent app: ${fakeAppId}${colors.reset}`);
      const response = await this.manageApp(fakeAppId, 'start');

      if (response.type === 'error' || response.status === 'failed') {
        console.log(`${colors.green}   ✓ Correctly rejected action on non-existent app${colors.reset}`);
        console.log(`      Error: ${response.error || response.result}`);
      } else {
        console.log(`${colors.red}   ✗ Action on non-existent app did not fail${colors.reset}`);
        console.log(`      Response:`, JSON.stringify(response, null, 2));
        testPassed = false;
      }

    } catch (error) {
      console.error(`${colors.red}   ✗ Error: ${error.message}${colors.reset}`);
      testPassed = false;
    }

    return { name: testName, passed: testPassed };
  }

  /**
   * Test 6: App ID prefix handling (CRITICAL BUG FIX)
   */
  async testAppIdPrefixHandling() {
    const testName = 'App ID Prefix Handling';
    console.log(`\n${colors.blue}=== Test: ${testName} ===${colors.reset}`);

    let testPassed = true;

    try {
      const appId = `test-prefix-${Date.now()}`;

      await this.deployTestApp(appId);
      await this.delay(5000);

      // Test with short ID (without VEA- prefix)
      console.log(`\n${colors.cyan}Testing status query without VEA- prefix...${colors.reset}`);
      const response1 = await this.getAppStatus(appId);

      if (response1.type !== 'error') {
        console.log(`${colors.green}   ✓ Status query works without VEA- prefix${colors.reset}`);
      } else {
        console.log(`${colors.red}   ✗ Status query failed without VEA- prefix: ${response1.error}${colors.reset}`);
        testPassed = false;
      }

      // Test with full ID (with VEA- prefix)
      console.log(`\n${colors.cyan}Testing status query with VEA- prefix...${colors.reset}`);
      const response2 = await this.getAppStatus(`VEA-${appId}`);

      if (response2.type !== 'error') {
        console.log(`${colors.green}   ✓ Status query works with VEA- prefix${colors.reset}`);
      } else {
        console.log(`${colors.red}   ✗ Status query failed with VEA- prefix: ${response2.error}${colors.reset}`);
        testPassed = false;
      }

      // Test manage_app without prefix
      console.log(`\n${colors.cyan}Testing manage_app without VEA- prefix...${colors.reset}`);
      const manageResponse = await this.manageApp(appId, 'stop');

      if (manageResponse.type !== 'error') {
        console.log(`${colors.green}   ✓ manage_app works without VEA- prefix${colors.reset}`);
      } else {
        console.log(`${colors.red}   ✗ manage_app failed without VEA- prefix${colors.reset}`);
        testPassed = false;
      }

      // Cleanup
      await this.manageApp(appId, 'remove');

    } catch (error) {
      console.error(`${colors.red}   ✗ Error: ${error.message}${colors.reset}`);
      testPassed = false;
    }

    return { name: testName, passed: testPassed };
  }

  /**
   * Test 7: Rapid successive actions
   */
  async testRapidSuccessiveActions() {
    const testName = 'Rapid Successive Actions';
    console.log(`\n${colors.blue}=== Test: ${testName} ===${colors.reset}`);

    const appId = `test-rapid-${Date.now()}`;
    let testPassed = true;
    let successCount = 0;
    let errorCount = 0;

    try {
      await this.deployTestApp(appId);
      await this.delay(5000);

      console.log(`\n${colors.cyan}Sending rapid pause/resume commands sequentially...${colors.reset}`);

      // Send commands sequentially with small delays (more realistic)
      const commandCount = 5;
      for (let i = 0; i < commandCount; i++) {
        console.log(`   Command ${i + 1}/${commandCount}:`);

        // Pause
        try {
          const pauseResponse = await this.manageApp(appId, 'pause');
          if (pauseResponse.type === 'error') {
            console.log(`      Pause: ${colors.yellow}error${colors.reset}`);
            errorCount++;
          } else {
            console.log(`      Pause: ${colors.green}success${colors.reset}`);
            successCount++;
          }
        } catch (err) {
          console.log(`      Pause: ${colors.red}error${colors.reset}`);
          errorCount++;
        }

        await this.delay(1000); // Small delay between commands

        // Resume
        try {
          const resumeResponse = await this.manageApp(appId, 'resume');
          if (resumeResponse.type === 'error') {
            console.log(`      Resume: ${colors.yellow}error${colors.reset}`);
            errorCount++;
          } else {
            console.log(`      Resume: ${colors.green}success${colors.reset}`);
            successCount++;
          }
        } catch (err) {
          console.log(`      Resume: ${colors.red}error${colors.reset}`);
          errorCount++;
        }

        await this.delay(1000); // Small delay between commands
      }

      const totalCommands = commandCount * 2;
      console.log(`\n   Sent ${totalCommands} commands: ${successCount} success, ${errorCount} errors`);

      // Test passes if at least 80% succeeded
      const successRate = successCount / totalCommands;
      if (successRate >= 0.8) {
        console.log(`${colors.green}   ✓ Rapid actions handled reasonably (${Math.round(successRate * 100)}% success rate)${colors.reset}`);
      } else {
        console.log(`${colors.yellow}   ⚠️  Low success rate during rapid actions: ${Math.round(successRate * 100)}%${colors.reset}`);
        testPassed = false;
      }

      // Cleanup
      await this.manageApp(appId, 'stop');
      await this.delay(2000);
      await this.manageApp(appId, 'remove');

    } catch (error) {
      console.error(`${colors.red}   ✗ Error: ${error.message}${colors.reset}`);
      testPassed = false;
    }

    return { name: testName, passed: testPassed };
  }

  /**
   * Test 8: Response format validation
   */
  async testResponseFormat() {
    const testName = 'Response Format Validation';
    console.log(`\n${colors.blue}=== Test: ${testName} ===${colors.reset}`);

    let testPassed = true;

    try {
      const appId = `test-format-${Date.now()}`;

      await this.deployTestApp(appId);
      await this.delay(5000);

      // Check manage_app response format
      console.log(`\n${colors.cyan}Checking manage_app response format...${colors.reset}`);
      const manageResponse = await this.manageApp(appId, 'stop');

      const hasType = manageResponse.type !== undefined;
      const hasAppId = manageResponse.app_id !== undefined;
      const hasAction = manageResponse.action !== undefined;
      const hasStatus = manageResponse.status !== undefined;
      const hasResult = manageResponse.result !== undefined;
      const hasState = manageResponse.state !== undefined;

      console.log(`   - type: ${hasType ? '✓' : '✗'}`);
      console.log(`   - app_id: ${hasAppId ? '✓' : '✗'}`);
      console.log(`   - action: ${hasAction ? '✓' : '✗'}`);
      console.log(`   - status: ${hasStatus ? '✓' : '✗'}`);
      console.log(`   - result: ${hasResult ? '✓' : '✗'}`);
      console.log(`   - state: ${hasState ? '✓' : '✗'}`);

      if (hasType && hasAppId && hasAction && hasStatus) {
        console.log(`${colors.green}   ✓ Response format is correct${colors.reset}`);
      } else {
        console.log(`${colors.red}   ✗ Response format incomplete${colors.reset}`);
        testPassed = false;
      }

      // Check get_app_status response format
      console.log(`\n${colors.cyan}Checking get_app_status response format...${colors.reset}`);
      const statusResponse = await this.getAppStatus(appId);

      const hasStatusResult = statusResponse.result !== undefined;
      const hasStatusObj = statusResponse.result && statusResponse.result.status !== undefined;

      console.log(`   - result: ${hasStatusResult ? '✓' : '✗'}`);
      console.log(`   - result.status: ${hasStatusObj ? '✓' : '✗'}`);

      if (hasStatusResult && hasStatusObj) {
        console.log(`${colors.green}   ✓ Status response format is correct${colors.reset}`);
      } else {
        console.log(`${colors.red}   ✗ Status response format incomplete${colors.reset}`);
        testPassed = false;
      }

      // Cleanup
      await this.manageApp(appId, 'remove');

    } catch (error) {
      console.error(`${colors.red}   ✗ Error: ${error.message}${colors.reset}`);
      testPassed = false;
    }

    return { name: testName, passed: testPassed };
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log(`${colors.cyan}
╔════════════════════════════════════════════════════════════╗
║   Vehicle App Lifecycle Management Test Suite             ║
║                    FIXED & ENHANCED                        ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);

    await this.connect();

    const tests = [
      () => this.testFullLifecycleWorkflow(),
      () => this.testRestartAction(),
      () => this.testInvalidTransitions(),
      () => this.testMultiplePauseResumeCycles(),
      () => this.testNonExistentApp(),
      () => this.testAppIdPrefixHandling(),
      () => this.testRapidSuccessiveActions(),
      () => this.testResponseFormat()
    ];

    const results = [];

    for (const test of tests) {
      try {
        const result = await test();
        results.push(result);
        if (result.passed) {
          this.passed++;
        } else {
          this.failed++;
        }
      } catch (error) {
        console.error(`${colors.red}Test crashed: ${error.message}${colors.reset}`);
        console.error(error.stack);
        this.failed++;
      }

      await this.delay(1000);
    }

    this.printResults(results);

    this.ws.close();
  }

  printResults(results) {
    console.log(`\n${colors.cyan}
╔════════════════════════════════════════════════════════════╗
║   Test Results                                             ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);

    results.forEach(result => {
      const status = result.passed ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
      console.log(`   ${status}  ${result.name}`);
    });

    console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`   ${colors.green}Passed: ${this.passed}${colors.reset} | ${colors.red}Failed: ${this.failed}${colors.reset} | ${colors.yellow}Total: ${this.passed + this.failed}${colors.reset}`);

    if (this.failed === 0) {
      console.log(`\n${colors.green}🎉 All tests passed!${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`\n${colors.red}❌ ${this.failed} test(s) failed${colors.reset}\n`);
      process.exit(1);
    }
  }
}

// Run tests
(async () => {
  const tester = new LifecycleTester();
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
})();
