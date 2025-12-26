#!/usr/bin/env node

/**
 * Quick verification test for bug fixes
 */

const WebSocket = require('/home/htr1hc/01_SDV/78_deploy_extension/vehicle-edge-runtime/node_modules/ws');

const WS_URL = 'ws://localhost:3002/runtime';

async function test() {
  const ws = new WebSocket(WS_URL);

  await new Promise((resolve) => ws.on('open', resolve));

  console.log('✅ Connected\n');

  // Test 1: Non-existent app should return error
  console.log('TEST 1: Non-existent app');
  const msg1 = await sendMessage(ws, {
    type: 'manage_app',
    id: 'test1-' + Date.now(),
    app_id: 'does-not-exist-12345',
    action: 'start'
  });
  console.log('Response:', JSON.stringify(msg1, null, 2));
  console.log('Type:', msg1.type, (msg1.type === 'error' ? '✅ PASS' : '❌ FAIL'));

  // Test 2: Valid app without VEA- prefix
  console.log('\nTEST 2: List apps and get status');
  const msg2 = await sendMessage(ws, {
    type: 'list_deployed_apps',
    id: 'test2-' + Date.now()
  });

  if (msg2.applications && msg2.applications.length > 0) {
    const appId = msg2.applications[0].app_id;
    console.log('Found app:', appId);
    console.log('Status:', msg2.applications[0].status);

    // Try getting status without VEA- prefix
    const shortId = appId.replace('VEA-', '');
    console.log('Trying to get status with short ID:', shortId);

    const msg3 = await sendMessage(ws, {
      type: 'get_app_status',
      id: 'test3-' + Date.now(),
      appId: shortId
    });
    console.log('Status response:', JSON.stringify(msg3, null, 2));
    console.log((msg3.type !== 'error' ? '✅ PASS' : '❌ FAIL'));
  }

  ws.close();
}

function sendMessage(ws, message) {
  return new Promise((resolve) => {
    const id = message.id;
    ws.send(JSON.stringify(message));

    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.id === id) {
        ws.removeListener('message', handler);
        resolve(msg);
      }
    };

    ws.on('message', handler);
  });
}

test().catch(console.error);
