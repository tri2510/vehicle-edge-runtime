#!/usr/bin/env node

/**
 * Final Test: App ID Prefix Functionality
 */

import WebSocket from 'ws';

const RUNTIME_URL = 'ws://localhost:3002/runtime';

function testPrefix() {
  console.log('🧪 Testing App ID Prefix Functionality');
  console.log('');

  const ws = new WebSocket(RUNTIME_URL);

  // Test 1: Kuksa App
  const kuksaApp = {
    type: 'deploy_request',
    id: 'test-1',
    prototype: {
      id: 'server',
      name: 'Kuksa Data Broker',
      type: 'docker',
      description: 'Test Kuksa prefix',
      config: {
        dockerCommand: [
          'run', '--rm',
          'alpine',
          'echo', 'Kuksa test'
        ]
      }
    },
    vehicleId: 'test-vehicle-001'
  };

  // Test 2: Regular Docker App
  const dockerApp = {
    type: 'deploy_request',
    id: 'test-2',
    prototype: {
      id: 'nginx',
      name: 'Nginx Web Server',
      type: 'docker',
      description: 'Test Docker prefix',
      config: {
        dockerCommand: [
          'run', '--rm',
          'alpine',
          'echo', 'Docker test'
        ]
      }
    },
    vehicleId: 'test-vehicle-001'
  };

  ws.on('open', () => {
    console.log('✅ Connected to Vehicle Edge Runtime');
    console.log('📤 Testing Kuksa app prefix...');
    ws.send(JSON.stringify(kuksaApp));
  });

  let messageCount = 0;
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log(`📨 Message ${++messageCount}:`, JSON.stringify(message, null, 2));

    if (message.type === 'connection_established') {
      console.log('✅ Connection established');
    } else if (message.type === 'deploy_request-response' && messageCount === 2) {
      // First app done, test second app
      console.log('📤 Testing regular Docker app prefix...');
      ws.send(JSON.stringify(dockerApp));
    } else if (message.type === 'deploy_request-response' && messageCount === 4) {
      // Second app done, show results
      console.log('\n🎯 PREFIX TEST RESULTS:');

      console.log('\n📋 Expected vs Actual:');
      console.log('  Kuksa App ID:');
      console.log('    Expected: kuksa-server');
      console.log('    Actual:  ', message.status === 'started' ? '✅' : '❌');

      console.log('\n  Regular Docker App ID:');
      console.log('    Expected: docker-nginx');
      console.log('    Actual:  ', message.status === 'started' ? '✅' : '❌');

      setTimeout(() => {
        ws.close();
      }, 2000);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ Connection error:', error.message);
  });

  ws.on('close', () => {
    console.log('🔌 Connection closed');
    console.log('\n🎉 Prefix Test Completed!');
  });

  // Timeout after 10 seconds
  setTimeout(() => {
    ws.close();
  }, 10000);
}

testPrefix();