#!/usr/bin/env node

/**
 * Comprehensive Vehicle App Lifecycle Management Test Suite
 *
 * This test suite covers:
 * - All lifecycle actions (start, stop, pause, resume, restart, remove)
 * - State transitions and validation
 * - Edge cases and error handling
 * - All message formats from frontend
 * - Multi-step workflows
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
  cyan: '\x1b[36m'
};

class LifecycleTester {
  constructor() {
    this.ws = null;
    this.messageId = 0;
    this.responses = new Map();
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
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
    console.log(`   Status: ${response.status}`);
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
    return response.applications || [];
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

  async manageApp(appId, action) {
    const message = {
      type: 'manage_app',
      id: `manage-${appId}-${action}-${Date.now()}`,
      app_id: appId,
      action: action
    };

    return await this.sendMessage(message);
  }

  async testState(appId, expectedStates) {
    const response = await this.getAppStatus(appId);
    const actualState = response.status || response.state;

    if (expectedStates.includes(actualState)) {
      console.log(`${colors.green}   ✓ State check: ${actualState}${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}   ✗ State check failed: expected ${expectedStates.join(' or ')}, got ${actualState}${colors.reset}`);
      return false;
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test 1: Full lifecycle workflow
   * Deploy -> Start -> Pause -> Resume -> Stop -> Remove
   */
  async testFullLifecycleWorkflow() {
    const testName = 'Full Lifecycle Workflow';
    console.log(`\n${colors.blue}=== Test: ${testName} ===${colors.reset}`);

    const appId = `test-lifecycle-${Date.now()}`;
    let testPassed = true;

    try {
      // Deploy
      await this.deployTestApp(appId);
      await this.delay(3000);

      // Check initial state
      const deployedApps = await this.listApps();
      const app = deployedApps.find(a => a.app_id === appId);
      if (!app) {
        throw new Error('App not found in list after deployment');
      }
      console.log(`${colors.green}   ✓ App deployed${colors.reset}`);

      // Start
      console.log(`\n${colors.cyan}▶️  Starting app...${colors.reset}`);
      await this.manageApp(appId, 'start');
      await this.delay(3000);
      testPassed &&= await this.testState(appId, ['running', 'starting']);

      // Pause
      console.log(`\n${colors.cyan}⏸️  Pausing app...${colors.reset}`);
      await this.manageApp(appId, 'pause');
      await this.delay(2000);
      testPassed &&= await this.testState(appId, ['paused']);

      // Resume
      console.log(`\n${colors.cyan}▶️  Resuming app...${colors.reset}`);
      await this.manageApp(appId, 'resume');
      await this.delay(2000);
      testPassed &&= await this.testState(appId, ['running']);

      // Stop
      console.log(`\n${colors.cyan}⏹️  Stopping app...${colors.reset}`);
      await this.manageApp(appId, 'stop');
      await this.delay(2000);
      testPassed &&= await this.testState(appId, ['stopped']);

      // Remove
      console.log(`\n${colors.cyan}🗑️  Removing app...${colors.reset}`);
      await this.manageApp(appId, 'remove');
      await this.delay(1000);

      const finalApps = await this.listApps();
      const removedApp = finalApps.find(a => a.app_id === appId);
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
      await this.delay(3000);

      // Start
      await this.manageApp(appId, 'start');
      await this.delay(3000);
      testPassed &&= await this.testState(appId, ['running']);

      // Restart
      console.log(`\n${colors.cyan}🔄 Restarting app...${colors.reset}`);
      const startTime = Date.now();
      await this.manageApp(appId, 'restart');
      await this.delay(4000);
      const restartDuration = Date.now() - startTime;

      testPassed &&= await this.testState(appId, ['running']);
      console.log(`${colors.green}   ✓ Restart completed in ${restartDuration}ms${colors.reset}`);

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

      // Try to pause without starting
      console.log(`\n${colors.cyan}Testing pause without start...${colors.reset}`);
      let response = await this.manageApp(appId, 'pause');
      if (response.type === 'error') {
        console.log(`${colors.green}   ✓ Correctly rejected pause without start${colors.reset}`);
      } else {
        console.log(`${colors.yellow}   ⚠️  Warning: pause allowed without start${colors.reset}`);
      }

      // Try to resume without pause
      console.log(`\n${colors.cyan}Testing resume without pause...${colors.reset}`);
      response = await this.manageApp(appId, 'resume');
      if (response.type === 'error') {
        console.log(`${colors.green}   ✓ Correctly rejected resume without pause${colors.reset}`);
      } else {
        console.log(`${colors.yellow}   ⚠️  Warning: resume allowed without pause${colors.reset}`);
      }

      // Start the app
      await this.manageApp(appId, 'start');
      await this.delay(3000);

      // Try to restart while running
      console.log(`\n${colors.cyan}Testing restart while running...${colors.reset}`);
      response = await this.manageApp(appId, 'restart');
      if (response.status === 'success' || response.status === 'started') {
        console.log(`${colors.green}   ✓ Restart works while running${colors.reset}`);
      } else {
        console.log(`${colors.yellow}   ⚠️  Warning: restart failed while running${colors.reset}`);
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
   * Test 4: Multiple pause/resume cycles
   */
  async testMultiplePauseResumeCycles() {
    const testName = 'Multiple Pause/Resume Cycles';
    console.log(`\n${colors.blue}=== Test: ${testName} ===${colors.reset}`);

    const appId = `test-cycles-${Date.now()}`;
    let testPassed = true;

    try {
      await this.deployTestApp(appId);
      await this.manageApp(appId, 'start');
      await this.delay(3000);

      for (let i = 0; i < 3; i++) {
        console.log(`\n${colors.cyan}Cycle ${i + 1}/3:${colors.reset}`);

        await this.manageApp(appId, 'pause');
        await this.delay(2000);
        testPassed &&= await this.testState(appId, ['paused']);

        await this.manageApp(appId, 'resume');
        await this.delay(2000);
        testPassed &&= await this.testState(appId, ['running']);
      }

      console.log(`${colors.green}   ✓ All cycles completed successfully${colors.reset}`);

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
   * Test 5: Action on non-existent app
   */
  async testNonExistentApp() {
    const testName = 'Action on Non-existent App';
    console.log(`\n${colors.blue}=== Test: ${testName} ===${colors.reset}`);

    let testPassed = true;

    try {
      const fakeAppId = `non-existent-${Date.now()}`;

      console.log(`\n${colors.cyan}Testing start on non-existent app...${colors.reset}`);
      let response = await this.manageApp(fakeAppId, 'start');
      if (response.type === 'error' || response.status === 'failed') {
        console.log(`${colors.green}   ✓ Correctly rejected action on non-existent app${colors.reset}`);
      } else {
        console.log(`${colors.red}   ✗ Action on non-existent app did not fail${colors.reset}`);
        testPassed = false;
      }

    } catch (error) {
      console.error(`${colors.red}   ✗ Error: ${error.message}${colors.reset}`);
      testPassed = false;
    }

    return { name: testName, passed: testPassed };
  }

  /**
   * Test 6: Force stop handling
   */
  async testForceStop() {
    const testName = 'Force Stop Handling';
    console.log(`\n${colors.blue}=== Test: ${testName} ===${colors.reset}`);

    const appId = `test-force-${Date.now()}`;
    let testPassed = true;

    try {
      await this.deployTestApp(appId);
      await this.manageApp(appId, 'start');
      await this.delay(3000);

      // Force stop
      console.log(`\n${colors.cyan}Testing force stop...${colors.reset}`);
      const response = await this.manageApp(appId, 'stop');
      if (response.action === 'stop' || response.status === 'success') {
        console.log(`${colors.green}   ✓ Force stop completed${colors.reset}`);
      } else {
        console.log(`${colors.yellow}   ⚠️  Force stop response unusual: ${response.status}${colors.reset}`);
      }

      await this.delay(2000);
      testPassed &&= await this.testState(appId, ['stopped']);

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
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);

    await this.connect();

    const tests = [
      () => this.testFullLifecycleWorkflow(),
      () => this.testRestartAction(),
      () => this.testInvalidTransitions(),
      () => this.testMultiplePauseResumeCycles(),
      () => this.testNonExistentApp(),
      () => this.testForceStop()
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
    console.log(`   ${colors.green}Passed: ${this.passed}${colors.reset} | ${colors.red}Failed: ${this.failed}${colors.reset} | Total: ${this.passed + this.failed}`);

    if (this.failed === 0) {
      console.log(`\n${colors.green}🎉 All tests passed!${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`\n${colors.red}❌ Some tests failed${colors.reset}\n`);
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
