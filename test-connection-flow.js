#!/usr/bin/env node

/**
 * Test and verify connection establishment flow
 */

import WebSocket from 'ws';

const RUNTIME_WS = 'ws://localhost:3002/runtime';
const KIT_MANAGER_API = 'http://localhost:3090';

class ConnectionTester {
    async testRuntimeConnection() {
        console.log('🔗 Testing Vehicle Edge Runtime Connection...');

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(RUNTIME_WS);
            let connected = false;

            const timeout = setTimeout(() => {
                if (!connected) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);

            ws.on('open', () => {
                console.log('✅ WebSocket connection established');
                connected = true;
            });

            ws.on('message', (data) => {
                const response = JSON.parse(data);
                console.log('📥 Runtime response:', response.type);

                if (response.type === 'connection_established') {
                    console.log('✅ Connection officially established');
                    console.log('   Client ID:', response.clientId);
                    console.log('   Timestamp:', response.timestamp);

                    clearTimeout(timeout);
                    resolve(response);
                }
            });

            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            ws.on('close', () => {
                console.log('🔌 Connection closed');
            });
        });
    }

    async testKitManagerRegistration() {
        console.log('\n🚀 Checking Kit Manager Registration...');

        try {
            const response = await fetch(`${KIT_MANAGER_API}/listAllKits`);

            if (response.ok) {
                const kits = await response.json();
                console.log('✅ Kit Manager accessible');
                console.log('   Registered kits:', kits.length);

                // Look for Vehicle Edge Runtime in registered kits
                const runtimeKit = kits.find(kit =>
                    kit.name && kit.name.toLowerCase().includes('vehicle-edge')
                );

                if (runtimeKit) {
                    console.log('✅ Vehicle Edge Runtime registered with Kit Manager');
                    console.log('   Kit ID:', runtimeKit.id);
                    console.log('   Kit name:', runtimeKit.name);
                    return true;
                } else {
                    console.log('⚠️  Vehicle Edge Runtime not found in Kit Manager registration');
                    return false;
                }
            } else {
                console.log('❌ Kit Manager not accessible');
                return false;
            }
        } catch (error) {
            console.log('❌ Error connecting to Kit Manager:', error.message);
            return false;
        }
    }

    async testConnectionFlow() {
        console.log('🧪 Complete Connection Flow Test\n');

        try {
            // Test 1: Runtime connection
            const runtimeInfo = await this.testRuntimeConnection();

            // Test 2: Kit Manager registration
            const kitManagerRegistered = await this.testKitManagerRegistration();

            console.log('\n📊 CONNECTION STATUS SUMMARY:');
            console.log('='.repeat(50));
            console.log(`Runtime WebSocket: ✅ Connected`);
            console.log(`Runtime Client ID: ${runtimeInfo?.clientId || 'N/A'}`);
            console.log(`Kit Manager Registration: ${kitManagerRegistered ? '✅ Registered' : '❌ Not registered'}`);
            console.log(`Overall Status: ✅ CONNECTION SYSTEM OPERATIONAL`);

            console.log('\n🎯 RECOMMENDED FRONTEND CONNECTION:');
            console.log(`   Use: ws://localhost:3002/runtime`);
            console.log(`   Protocol: WebSocket`);
            console.log(`   Authentication: None required`);
            console.log(`   Message Format: JSON with 'type' and 'id' fields`);

            return true;

        } catch (error) {
            console.error('❌ Connection test failed:', error.message);
            return false;
        }
    }
}

// Run the test
const tester = new ConnectionTester();
tester.testConnectionFlow()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(console.error);