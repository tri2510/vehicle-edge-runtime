#!/usr/bin/env node

/**
 * Test Kuksa Server Deployment with App ID Prefix
 */

import WebSocket from 'ws';

const RUNTIME_URL = 'ws://localhost:3002/runtime';

const kuksaDeployMessage = {
  type: 'deploy_request',
  id: 'kuksa-test-' + Date.now(),
  prototype: {
    id: 'server',
    name: 'Kuksa Data Broker',
    type: 'docker',
    description: 'Eclipse Kuksa vehicle signal databroker with prefix test',
    config: {
      dockerCommand: [
        'run', '-d',
        '--name', 'kuksa-server-prefix-test',
        '--network', 'host',
        '-p', '55555:55555',
        '-p', '8090:8090',
        'ghcr.io/eclipse-kuksa/kuksa-databroker:main',
        '--insecure',
        '--enable-viss',
        '--viss-port', '8090'
      ]
    }
  },
  vehicleId: 'test-vehicle-001'
};

function testKuksaPrefix() {
  console.log('🐳 Testing Kuksa Server with App ID Prefix');
  console.log('Runtime URL:', RUNTIME_URL);
  console.log('');

  const ws = new WebSocket(RUNTIME_URL);

  ws.on('open', () => {
    console.log('✅ Connected to Vehicle Edge Runtime');
    console.log('📤 Deploying Kuksa server with prefix...');
    ws.send(JSON.stringify(kuksaDeployMessage));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Response:', JSON.stringify(message, null, 2));

    if (message.type === 'connection_established') {
      console.log('✅ Connection established');
    } else if (message.type === 'deploy_request-response') {
      if (message.status === 'started') {
        console.log('✅ SUCCESS: Kuksa server started with prefix!');
        console.log('🚀 App ID:', message.appId);
        console.log('🔧 Execution ID:', message.executionId);
        console.log('📦 Container ID:', message.containerId || 'Detached container');

        // Check if the prefix was applied
        if (message.appId.startsWith('kuksa-')) {
          console.log('🎯 SUCCESS: Kuksa prefix applied correctly!');
        } else {
          console.log('⚠️ WARNING: Kuksa prefix not applied');
        }

        // List all deployed apps to see the ID in context
        setTimeout(() => {
          console.log('\n📊 Listing all deployed apps...');
          ws.send(JSON.stringify({
            type: 'list_deployed_apps',
            id: 'list-apps-' + Date.now()
          }));
        }, 2000);

      } else {
        console.log('❌ ERROR: Failed to start Kuksa server');
      }
    } else if (message.type === 'list_deployed_apps-response') {
      console.log('📋 All Deployed Apps:');
      message.applications?.forEach(app => {
        const typeIcon = app.type === 'docker' ? '🐳' : app.type === 'python' ? '🐍' : '⚙️';
        const statusIcon = app.status === 'running' ? '✅' : app.status === 'stopped' ? '⏹️' : '❌';
        console.log(`  ${typeIcon} ${statusIcon} ${app.app_id} - ${app.name} (${app.type})`);
      });

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
    console.log('\n🎉 Kuksa Prefix Test Completed!');
  });

  // Timeout after 10 seconds
  setTimeout(() => {
    ws.close();
  }, 10000);
}

testKuksaPrefix();