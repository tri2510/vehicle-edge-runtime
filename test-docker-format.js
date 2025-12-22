#!/usr/bin/env node

import WebSocket from 'ws';

const RUNTIME_URL = 'ws://localhost:3002/runtime';

// Correct Docker deployment message format
const correctKuksaDeployMessage = {
  type: 'deploy_request',
  id: 'test-kuksa-docker-' + Date.now(),
  prototype: {
    id: 'databroker',
    name: 'Kuksa Data Broker',
    type: 'docker',                    // ⭐ IMPORTANT: Must be 'docker'
    description: 'Eclipse Kuksa vehicle signal databroker - Test deployment',
    config: {
      dockerCommand: [
        'run', '-d',
        '--name', 'kuksa-databroker-test',
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

function testCorrectDockerDeployment() {
  console.log('🔧 Testing Correct Docker App Deployment Format');
  console.log('');

  const ws = new WebSocket(RUNTIME_URL);

  ws.on('open', () => {
    console.log('✅ Connected to Vehicle Edge Runtime');
    console.log('📤 Sending correct Docker deployment message...');
    console.log('📝 Message format:');
    console.log(JSON.stringify(correctKuksaDeployMessage, null, 2));
    console.log('');
    ws.send(JSON.stringify(correctKuksaDeployMessage));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Response:', JSON.stringify(message, null, 2));
    console.log('');

    if (message.type === 'connection_established') {
      console.log('✅ Connection established');
    } else if (message.type === 'deploy_request-response') {
      if (message.status === 'started') {
        console.log('🎉 SUCCESS: Docker app deployed correctly!');
        console.log('🚀 App ID:', message.appId);
        console.log('🔧 Execution ID:', message.executionId);
        console.log('📦 Container ID:', message.containerId);

        // Check if prefix was applied correctly
        if (message.appId.startsWith('kuksa-')) {
          console.log('🎯 SUCCESS: Kuksa prefix applied correctly!');
        } else {
          console.log('⚠️ WARNING: Kuksa prefix not applied - got:', message.appId);
        }

        // Wait and check app status
        setTimeout(() => {
          console.log('\n📊 Checking deployed apps...');
          ws.send(JSON.stringify({
            type: 'list_deployed_apps',
            id: 'check-apps-' + Date.now()
          }));
        }, 3000);

      } else {
        console.log('❌ ERROR: Failed to deploy Docker app');
        console.log('Status:', message.status);
        console.log('Error:', message.error || message.result);
      }
    } else if (message.type === 'list_deployed_apps-response') {
      console.log('📋 Current Deployed Apps:');
      message.applications?.forEach(app => {
        const typeIcon = app.type === 'docker' ? '🐳' : app.type === 'python' ? '🐍' : '⚙️';
        const statusIcon = app.status === 'running' ? '✅' : app.status === 'stopped' ? '⏹️' : '❌';
        const kuksaIcon = app.app_id.startsWith('kuksa-') ? '🚗' : '';
        console.log(`  ${typeIcon} ${kuksaIcon} ${statusIcon} ${app.app_id} - ${app.name} (${app.type})`);
        if (app.container_id) {
          console.log(`       📦 Container: ${app.container_id}`);
        }
      });
    }

    setTimeout(() => {
      ws.close();
    }, 5000);
  });

  ws.on('error', (error) => {
    console.error('❌ Connection error:', error.message);
  });

  ws.on('close', () => {
    console.log('🔌 Connection closed');
    console.log('\n🎉 Docker Deployment Test Completed!');
    console.log('\n💡 Key Requirements for Docker App Deployment:');
    console.log('  • prototype.type: "docker" (REQUIRED)');
    console.log('  • prototype.name: Must include "kuksa" for prefixing');
    console.log('  • config.dockerCommand: Array of Docker command arguments');
    console.log('  • Proper WebSocket message structure');
  });

  // Timeout after 15 seconds
  setTimeout(() => {
    ws.close();
  }, 15000);
}

testCorrectDockerDeployment();