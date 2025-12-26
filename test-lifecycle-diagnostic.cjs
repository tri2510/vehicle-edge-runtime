#!/usr/bin/env node

/**
 * Diagnostic test to understand actual API responses
 */

const WebSocket = require('/home/htr1hc/01_SDV/78_deploy_extension/vehicle-edge-runtime/node_modules/ws');

const WS_URL = 'ws://localhost:3002/runtime';

class DiagnosticTester {
  constructor() {
    this.ws = null;
    this.messageId = 0;
    this.responses = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('✅ WebSocket connected\n');
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
        console.error('❌ WebSocket error:', err.message);
        reject(err);
      });
    });
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      const id = message.id || `test-${this.messageId++}`;
      message.id = id;

      console.log(`📤 SENDING: ${message.type}`);
      console.log(JSON.stringify(message, null, 2));

      this.ws.send(JSON.stringify(message));

      const timeout = setTimeout(() => {
        this.responses.delete(id);
        reject(new Error(`Message ${id} timed out`));
      }, 30000);

      this.responses.set(id, (response) => {
        clearTimeout(timeout);
        this.responses.delete(id);
        console.log(`\n📨 RECEIVED: ${response.type}`);
        console.log(JSON.stringify(response, null, 2));
        console.log('\n' + '='.repeat(80) + '\n');
        resolve(response);
      });
    });
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async test() {
    const appId = `diagnostic-${Date.now()}`;

    console.log('='.repeat(80));
    console.log('TEST 1: Deploy app');
    console.log('='.repeat(80) + '\n');

    const deployMsg = {
      type: 'deploy_request',
      id: `deploy-${Date.now()}`,
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
        name: 'Diagnostic Test App',
        description: 'Test app for diagnostics',
        version: '1.0.0',
        type: 'python'
      },
      vehicleId: 'test-vehicle',
      language: 'python'
    };

    await this.sendMessage(deployMsg);
    await this.delay(5000);

    console.log('='.repeat(80));
    console.log('TEST 2: List deployed apps');
    console.log('='.repeat(80) + '\n');

    const listMsg = {
      type: 'list_deployed_apps',
      id: `list-${Date.now()}`
    };

    const listResponse = await this.sendMessage(listMsg);

    console.log(`\n📋 Apps in list: ${listResponse.applications ? listResponse.applications.length : 0}`);
    if (listResponse.applications) {
      listResponse.applications.forEach(app => {
        console.log(`   - ${app.app_id} (${app.status || 'no status'})`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('TEST 3: Get app status');
    console.log('='.repeat(80) + '\n');

    const statusMsg = {
      type: 'get_app_status',
      id: `status-${Date.now()}`,
      appId: appId
    };

    await this.sendMessage(statusMsg);

    console.log('='.repeat(80));
    console.log('TEST 4: Start app');
    console.log('='.repeat(80) + '\n');

    const startMsg = {
      type: 'manage_app',
      id: `start-${Date.now()}`,
      app_id: appId,
      action: 'start'
    };

    await this.sendMessage(startMsg);
    await this.delay(5000);

    console.log('='.repeat(80));
    console.log('TEST 5: Get status again');
    console.log('='.repeat(80) + '\n');

    const statusMsg2 = {
      type: 'get_app_status',
      id: `status-${Date.now()}`,
      appId: appId
    };

    await this.sendMessage(statusMsg2);

    console.log('='.repeat(80));
    console.log('TEST 6: List deployed apps again');
    console.log('='.repeat(80) + '\n');

    const listMsg2 = {
      type: 'list_deployed_apps',
      id: `list-${Date.now()}`
    };

    const listResponse2 = await this.sendMessage(listMsg2);

    console.log(`\n📋 Apps in list: ${listResponse2.applications ? listResponse2.applications.length : 0}`);
    if (listResponse2.applications) {
      listResponse2.applications.forEach(app => {
        console.log(`   - ${app.app_id} (${app.status || 'no status'})`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('TEST 7: Try action on non-existent app');
    console.log('='.repeat(80) + '\n');

    const fakeMsg = {
      type: 'manage_app',
      id: `fake-${Date.now()}`,
      app_id: 'non-existent-app-12345',
      action: 'start'
    };

    await this.sendMessage(fakeMsg);

    console.log('='.repeat(80));
    console.log('TEST 8: Pause app');
    console.log('='.repeat(80) + '\n');

    const pauseMsg = {
      type: 'manage_app',
      id: `pause-${Date.now()}`,
      app_id: appId,
      action: 'pause'
    };

    await this.sendMessage(pauseMsg);
    await this.delay(3000);

    console.log('='.repeat(80));
    console.log('TEST 9: Resume app');
    console.log('='.repeat(80) + '\n');

    const resumeMsg = {
      type: 'manage_app',
      id: `resume-${Date.now()}`,
      app_id: appId,
      action: 'resume'
    };

    await this.sendMessage(resumeMsg);
    await this.delay(3000);

    console.log('='.repeat(80));
    console.log('TEST 10: Stop app');
    console.log('='.repeat(80) + '\n');

    const stopMsg = {
      type: 'manage_app',
      id: `stop-${Date.now()}`,
      app_id: appId,
      action: 'stop'
    };

    await this.sendMessage(stopMsg);
    await this.delay(3000);

    console.log('='.repeat(80));
    console.log('TEST 11: Remove app');
    console.log('='.repeat(80) + '\n');

    const removeMsg = {
      type: 'manage_app',
      id: `remove-${Date.now()}`,
      app_id: appId,
      action: 'remove'
    };

    await this.sendMessage(removeMsg);
    await this.delay(2000);

    this.ws.close();
  }
}

(async () => {
  const tester = new DiagnosticTester();
  try {
    await tester.connect();
    await tester.test();
  } catch (error) {
    console.error('Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
