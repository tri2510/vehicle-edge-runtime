#!/usr/bin/env node

/**
 * Quick test to redeploy Kuksa server with host networking
 */

import WebSocket from 'ws';

const RUNTIME_URL = 'ws://localhost:3002/runtime';

const kuksaDeployMessage = {
  type: 'deploy_request',
  id: 'kuksa-test-' + Date.now(),
  prototype: {
    id: 'kuksa-server-host-test',
    name: 'Kuksa Server (Host Network Test)',
    type: 'docker',
    description: 'Kuksa server with host networking test',
    config: {
      dockerCommand: [
        'run', '-d',
        '--name', 'kuksa-server-host-test',
        '--network', 'host',  // Use host network
        'ghcr.io/eclipse-kuksa/kuksa-databroker:main',
        '--insecure',
        '--enable-viss',
        '--viss-port', '8090'
      ]
    }
  },
  vehicleId: 'test-vehicle-001'
};

function deployKuksa() {
  console.log('🐳 Deploying Kuksa Server with Host Network Test');
  console.log('');

  const ws = new WebSocket(RUNTIME_URL);

  ws.on('open', () => {
    console.log('✅ Connected to Vehicle Edge Runtime');
    ws.send(JSON.stringify(kuksaDeployMessage));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Response:', JSON.stringify(message, null, 2));

    if (message.type === 'deploy_request-response' && message.status === 'started') {
      console.log('✅ SUCCESS: Kuksa server deployed with host networking!');
      console.log('🔗 Vehicle apps can now connect to 127.0.0.1:55555');
    }

    ws.close();
  });

  ws.on('error', (error) => {
    console.error('❌ Connection error:', error.message);
  });

  setTimeout(() => {
    ws.close();
  }, 10000);
}

deployKuksa();