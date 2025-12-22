#!/usr/bin/env node

import WebSocket from 'ws';

const RUNTIME_URL = 'ws://localhost:3002/runtime';

function checkApps() {
  console.log('📊 Checking Deployed Apps');
  console.log('Runtime URL:', RUNTIME_URL);
  console.log('');

  const ws = new WebSocket(RUNTIME_URL);

  ws.on('open', () => {
    console.log('✅ Connected to Vehicle Edge Runtime');
    console.log('📤 Requesting app list...');
    ws.send(JSON.stringify({
      type: 'list_deployed_apps',
      id: 'check-apps-' + Date.now()
    }));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Response:', JSON.stringify(message, null, 2));

    if (message.type === 'connection_established') {
      console.log('✅ Connection established');
    } else if (message.type === 'list_deployed_apps-response') {
      console.log('📋 All Deployed Apps:');
      message.applications?.forEach(app => {
        const typeIcon = app.type === 'docker' ? '🐳' : app.type === 'python' ? '🐍' : '⚙️';
        const statusIcon = app.status === 'running' ? '✅' : app.status === 'stopped' ? '⏹️' : '❌';
        const kuksaIcon = app.app_id.startsWith('kuksa-') ? '🚗' : '';
        console.log(`  ${typeIcon} ${kuksaIcon} ${statusIcon} ${app.app_id} - ${app.name} (${app.type})`);
        if (app.container_id) {
          console.log(`       📦 Container: ${app.container_id}`);
        }
      });

      // Summary
      const kuksaApps = message.applications?.filter(app => app.app_id.startsWith('kuksa-'));
      const dockerApps = message.applications?.filter(app => app.type === 'docker');

      console.log('\n📊 Summary:');
      console.log(`  Total Apps: ${message.total_count}`);
      console.log(`  Running: ${message.running_count}`);
      console.log(`  Kuksa Apps: ${kuksaApps?.length || 0} ✅`);
      console.log(`  Docker Apps: ${dockerApps?.length || 0} ✅`);

      ws.close();
    }
  });

  ws.on('error', (error) => {
    console.error('❌ Connection error:', error.message);
  });

  ws.on('close', () => {
    console.log('🔌 Connection closed');
    console.log('\n✅ App Check Completed!');
  });
}

checkApps();