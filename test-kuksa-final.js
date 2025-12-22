#!/usr/bin/env node

/**
 * Final Test: Start Kuksa Server App
 * Tests complete Kuksa deployment with Docker app type, prefixes, and connectivity
 */

import WebSocket from 'ws';

const RUNTIME_URL = 'ws://localhost:3002/runtime';

const kuksaDeployMessage = {
  type: 'deploy_request',
  id: 'deploy-kuksa-' + Date.now(),
  prototype: {
    id: 'databroker',
    name: 'Kuksa Data Broker',
    type: 'docker',
    description: 'Eclipse Kuksa vehicle signal databroker - Production deployment',
    config: {
      dockerCommand: [
        'run', '-d',
        '--name', 'kuksa-databroker-prod',
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

function deployKuksa() {
  console.log('🚀 Starting Kuksa Server App Test');
  console.log('Runtime URL:', RUNTIME_URL);
  console.log('');

  const ws = new WebSocket(RUNTIME_URL);

  ws.on('open', () => {
    console.log('✅ Connected to Vehicle Edge Runtime');
    console.log('📤 Deploying Kuksa Data Broker...');
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
        console.log('🎉 SUCCESS: Kuksa server deployed successfully!');
        console.log('🚀 App ID:', message.appId);
        console.log('🔧 Execution ID:', message.executionId);
        console.log('📦 Container ID:', message.containerId);

        // Check if prefix was applied
        if (message.appId.startsWith('kuksa-')) {
          console.log('🎯 SUCCESS: Kuksa prefix applied!');
        } else {
          console.log('⚠️ WARNING: Kuksa prefix not applied');
        }

        console.log('');
        console.log('🔗 Kuksa Server Endpoints:');
        console.log('  • gRPC: localhost:55555');
        console.log('  • HTTP/VSS: localhost:8090/vss');
        console.log('  • Internal: kuksa-databroker-prod:55555 (for vehicle apps)');

        // Test connectivity after 5 seconds
        setTimeout(() => {
          console.log('\n🔍 Testing Kuksa server connectivity...');
          testKuksaEndpoints();

          // Check app status
          setTimeout(() => {
            console.log('\n📊 Checking app status...');
            ws.send(JSON.stringify({
              type: 'list_deployed_apps',
              id: 'check-status-' + Date.now()
            }));
          }, 2000);
        }, 5000);

      } else {
        console.log('❌ ERROR: Failed to deploy Kuksa server');
        console.log('Status:', message.status);
        console.log('Error:', message.error || message.result);
      }
    } else if (message.type === 'list_deployed_apps-response') {
      console.log('📊 Deployed Apps Status:');
      console.log('  Total apps:', message.total_count);
      console.log('  Running apps:', message.running_count);

      const kuksaApps = message.applications?.filter(app =>
        app.app_id.startsWith('kuksa-') || app.name?.toLowerCase().includes('kuksa')
      );

      if (kuksaApps.length > 0) {
        console.log('  ✅ Kuksa apps found:', kuksaApps.length);
        kuksaApps.forEach(app => {
          console.log(`    🐳 ${app.status} ${app.app_id} - ${app.name}`);
          if (app.container_id) {
            console.log(`       📦 Container: ${app.container_id}`);
          }
        });
      } else {
        console.log('  ❌ No Kuksa apps found');
      }

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
    console.log('\n🎉 Kuksa Server Deployment Test Completed!');
    console.log('\n📝 Next Steps:');
    console.log('  • Deploy vehicle apps that connect to localhost:55555');
    console.log('  • Test VSS signal access via localhost:8090/vss');
    console.log('  • Monitor Kuksa server via Vehicle Edge Runtime UI');
  });

  // Timeout after 20 seconds
  setTimeout(() => {
    console.log('⏰ Timeout - closing connection');
    ws.close();
  }, 20000);
}

function testKuksaEndpoints() {
  const { exec } = require('child_process');

  console.log('🌐 Testing HTTP/VSS endpoint...');
  exec('curl -s -w "Status: %{http_code}, Time: %{time_total}s" http://localhost:8090/vss', { timeout: 5000 }, (error, stdout, stderr) => {
    if (error) {
      console.log('  ❌ HTTP endpoint test failed:', error.message);
    } else {
      console.log('  ✅ HTTP/VSS Response:', stdout.trim());
    }
  });

  console.log('🔌 Testing gRPC port connectivity...');
  exec('timeout 3 bash -c "</dev/tcp/localhost/55555"', (error) => {
    if (error) {
      console.log('  ❌ gRPC port (55555) not accessible:', error.message);
    } else {
      console.log('  ✅ gRPC port (55555) is open and accessible');
    }
  });

  console.log('🐳 Checking Docker container status...');
  exec('docker ps --filter "name=kuksa-databroker-prod" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"', (error, stdout, stderr) => {
    if (error) {
      console.log('  ❌ Container status check failed:', error.message);
    } else {
      console.log('  📋 Docker Container Status:');
      stdout.trim().split('\n').forEach(line => {
        if (line.trim()) console.log(`    ${line}`);
      });
    }
  });
}

deployKuksa();