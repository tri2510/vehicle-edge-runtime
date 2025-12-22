#!/usr/bin/env node

/**
 * Test Kuksa Server Deployment using Docker App Type
 */

import WebSocket from 'ws';

const RUNTIME_URL = 'ws://localhost:3002/runtime';

const kuksaDeployMessage = {
  type: 'deploy_request',
  id: 'kuksa-test-' + Date.now(),
  prototype: {
    id: 'kuksa-server-docker-test',
    name: 'Kuksa Data Broker (Docker Test)',
    type: 'docker',
    description: 'Eclipse Kuksa vehicle signal databroker - Docker app test',
    config: {
      dockerCommand: [
        'run', '-d',
        '--name', 'kuksa-server-docker-test',
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

function testKuksaDeployment() {
  console.log('🐳 Testing Kuksa Server Docker App Deployment');
  console.log('Runtime URL:', RUNTIME_URL);
  console.log('');

  const ws = new WebSocket(RUNTIME_URL);

  ws.on('open', () => {
    console.log('✅ Connected to Vehicle Edge Runtime');
    console.log('📤 Deploying Kuksa server as Docker app...');
    ws.send(JSON.stringify(kuksaDeployMessage));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Response:', JSON.stringify(message, null, 2));
    console.log('');

    if (message.type === 'connection_established') {
      console.log('✅ Connection established');
    } else if (message.type === 'deploy_request-response') {
      if (message.status === 'started') {
        console.log('✅ SUCCESS: Kuksa server Docker app started!');
        console.log('🚀 App ID:', message.appId);
        console.log('🔧 Execution ID:', message.executionId);
        console.log('📦 Container ID:', message.containerId || 'Detached container');

        console.log('');
        console.log('🔗 Kuksa Server Endpoints:');
        console.log('  • gRPC: localhost:55555');
        console.log('  • HTTP/VSS: localhost:8090/vss');
        console.log('  • Internal: kuksa-server:55555 (for vehicle apps)');

        // Test connectivity after 3 seconds
        setTimeout(() => {
          console.log('\n🔍 Testing Kuksa server connectivity...');
          testKuksaConnectivity();
        }, 3000);

        // Check app status after 5 seconds
        setTimeout(() => {
          console.log('\n📊 Checking app status...');
          ws.send(JSON.stringify({
            type: 'list_deployed_apps',
            id: 'check-status-' + Date.now()
          }));
        }, 5000);

      } else {
        console.log('❌ ERROR: Failed to start Kuksa server');
        console.log('Status:', message.status);
        console.log('Error:', message.error || message.result);
      }
    } else if (message.type === 'list_deployed_apps-response') {
      console.log('📊 App Status:');
      console.log('  Total apps:', message.total_count);
      console.log('  Running apps:', message.running_count);

      const kuksaApp = message.applications?.find(app => app.app_id === 'kuksa-server-docker-test');
      if (kuksaApp) {
        console.log('  ✅ Kuksa server status:', kuksaApp.status);
        console.log('  📦 Container ID:', kuksaApp.container_id);
        console.log('  🕒 Deploy time:', kuksaApp.deploy_time);
      } else {
        console.log('  ❌ Kuksa server not found in app list');
      }

      setTimeout(() => {
        ws.close();
      }, 2000);
    } else if (message.type === 'error') {
      console.log('❌ ERROR:', message.error);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ Connection error:', error.message);
  });

  ws.on('close', () => {
    console.log('🔌 Connection closed');
    console.log('\n🎉 Kuksa Server Docker App Test Completed!');
  });

  // Timeout after 15 seconds
  setTimeout(() => {
    console.log('⏰ Timeout - closing connection');
    ws.close();
  }, 15000);
}

function testKuksaConnectivity() {
  const { exec } = require('child_process');

  console.log('🌐 Testing HTTP endpoint...');
  exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/vss', (error, stdout, stderr) => {
    if (error) {
      console.log('  ❌ HTTP endpoint test failed:', error.message);
    } else {
      if (stdout === '200') {
        console.log('  ✅ HTTP endpoint accessible (200 OK)');
      } else {
        console.log('  ⚠️ HTTP endpoint returned:', stdout);
      }
    }
  });

  console.log('🔌 Testing gRPC port...');
  exec('nc -zv localhost 55555', (error, stdout, stderr) => {
    if (error) {
      console.log('  ❌ gRPC port not accessible:', error.message);
    } else {
      console.log('  ✅ gRPC port (55555) is open and accessible');
    }
  });
}

testKuksaDeployment();