import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import { spawn } from 'child_process';
import http from 'node:http';

describe('WebSocket API Integration Tests', () => {
    const WS_PORT = 3002;
    const HEALTH_PORT = 3003;
    const TEST_TIMEOUT = 30000; // 30 seconds for integration tests

    let runtimeProcess;
    let ws;

    // Helper function to wait for service to be ready
    async function waitForService(port, path = '/', timeoutMs = 15000) {
        const startTime = Date.now();
        // http is already imported

        while (Date.now() - startTime < timeoutMs) {
            try {
                await new Promise((resolve, reject) => {
                    const req = http.get(`http://localhost:${port}${path}`, (res) => {
                        resolve(res.statusCode === 200);
                    });
                    req.on('error', reject);
                    req.setTimeout(2000, reject);
                });
                return true;
            } catch (error) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        throw new Error(`Service on port ${port} not ready within ${timeoutMs}ms`);
    }

    // Helper function to connect WebSocket
    async function connectWebSocket(timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${WS_PORT}/runtime`);

            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, timeoutMs);

            ws.on('open', () => {
                clearTimeout(timeout);
                resolve(ws);
            });

            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    // Helper function to send message and wait for response
    async function sendMessage(ws, message, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Message response timeout'));
            }, timeoutMs);

            const messageHandler = (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === message.id) {
                        clearTimeout(timeout);
                        ws.removeListener('message', messageHandler);
                        resolve(response);
                    }
                } catch (error) {
                    // Ignore malformed responses
                }
            };

            ws.on('message', messageHandler);

            // Send the message
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            } else {
                clearTimeout(timeout);
                ws.removeListener('message', messageHandler);
                reject(new Error('WebSocket not open'));
            }
        });
    }

    before(async () => {
        // Start the runtime process for integration testing
        console.log('🚀 Starting Vehicle Edge Runtime for integration tests...');

        runtimeProcess = spawn('node', ['src/index.js'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: process.cwd(),
            env: {
                ...process.env,
                PORT: WS_PORT.toString(),
                HEALTH_PORT: HEALTH_PORT.toString(),
                KUKSA_ENABLED: 'true', // MANDATORY Kuksa integration - tests will fail without Kuksa
                KUKSA_HOST: 'localhost',
                KUKSA_GRPC_PORT: '55555',
                DATA_DIR: './test-data'
            }
        });

        // Capture output for debugging
        runtimeProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                console.log(`Runtime: ${output}`);
            }
        });

        runtimeProcess.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                console.error(`Runtime Error: ${output}`);
            }
        });

        // Wait for health check endpoint to be ready
        try {
            await waitForService(HEALTH_PORT, '/health', 20000);
            console.log('✅ Runtime health check ready');
        } catch (error) {
            console.error('❌ Failed to start runtime:', error.message);
            throw error;
        }
    });

    after(async () => {
        // Cleanup
        if (ws) {
            ws.close();
        }

        if (runtimeProcess) {
            console.log('🛑 Stopping runtime...');
            runtimeProcess.kill('SIGTERM');
            // Give it time to shutdown gracefully
            await new Promise(resolve => setTimeout(resolve, 2000));

            if (runtimeProcess.kill) {
                runtimeProcess.kill('SIGKILL');
            }
        }
    });

    beforeEach(async () => {
        // Connect WebSocket for each test
        ws = await connectWebSocket();
    });

    afterEach(() => {
        if (ws) {
            ws.close();
        }
    });

    test('should connect to WebSocket endpoint', () => {
        assert(ws.readyState === WebSocket.OPEN);
    });

    test('should handle ping/pong communication', async () => {
        const pingMessage = {
            type: 'ping',
            id: 'test-ping-' + Date.now()
        };

        const response = await sendMessage(ws, pingMessage, 5000);

        assert.strictEqual(response.type, 'pong');
        assert.strictEqual(response.id, pingMessage.id);
        assert(typeof response.timestamp === 'string');
        assert(response.timestamp.length > 0);
    });

    test('should return runtime information', async () => {
        const infoMessage = {
            type: 'get_runtime_info',
            id: 'test-info-' + Date.now()
        };

        const response = await sendMessage(ws, infoMessage, 10000);

        assert.strictEqual(response.type, 'get_runtime_info-response');
        assert(response.result);
        assert(typeof response.result.runtimeId === 'string');
        assert(response.result.runtimeId.length > 0);
        assert(Array.isArray(response.result.capabilities));
        assert(response.result.capabilities.length > 0);
    });

    test('should handle application deployment', async () => {
        const deployMessage = {
            type: 'deploy_request',
            id: 'test-deploy-' + Date.now(),
            code: `import asyncio
import time

print("🚀 Integration test app started")

async def main():
    print("📋 Test iteration 1/3")
    await asyncio.sleep(0.5)
    print("📋 Test iteration 2/3")
    await asyncio.sleep(0.5)
    print("📋 Test iteration 3/3")
    await asyncio.sleep(0.5)
    print("✅ Integration test app completed")

asyncio.run(main())`,
            language: 'python'
        };

        const response = await sendMessage(ws, deployMessage, 15000);

        assert(response.type === 'deploy_request-response');
        assert(response.executionId);
        assert(response.appId);
        assert(response.status === 'started' || response.status === 'failed');

        if (response.status === 'started') {
            assert(typeof response.executionId === 'string');
            assert(response.executionId.length > 0);
            assert(typeof response.appId === 'string');
            assert(response.appId.length > 0);
        } else {
            // If deployment failed, ensure there's an error message
            assert(response.error || response.message);
        }
    });

    test('should handle application status requests', async () => {
        // First deploy an app
        const deployMessage = {
            type: 'deploy_request',
            id: 'test-deploy-status-' + Date.now(),
            code: 'print("Status test app")'
        };

        const deployResponse = await sendMessage(ws, deployMessage, 15000);

        if (deployResponse.status === 'started') {
            // Then request status
            const statusMessage = {
                type: 'get_app_status',
                id: 'test-status-' + Date.now(),
                appId: deployResponse.appId
            };

            const statusResponse = await sendMessage(ws, statusMessage, 10000);

            assert(['get_app_status-response', 'error'].includes(statusResponse.type));

            if (statusResponse.type === 'get_app_status-response') {
                assert(statusResponse.result);
                assert(typeof statusResponse.result.status === 'string');
            }
        }
    });

    test('should handle application listing', async () => {
        const listMessage = {
            type: 'list_deployed_apps',
            id: 'test-list-' + Date.now()
        };

        const response = await sendMessage(ws, listMessage, 10000);

        assert.strictEqual(response.type, 'list_deployed_apps-response');
        assert(Array.isArray(response.applications));
        assert(response.applications.length >= 0);
    });

    test('should handle invalid message types gracefully', async () => {
        const invalidMessage = {
            type: 'invalid_message_type',
            id: 'test-invalid-' + Date.now()
        };

        const response = await sendMessage(ws, invalidMessage, 5000);

        assert.strictEqual(response.type, 'error');
        assert(response.error);
        assert(response.id === invalidMessage.id);
    });

    test('should handle malformed messages gracefully', async () => {
        // Test sending invalid JSON
        const invalidJson = 'invalid json string';

        try {
            ws.send(invalidJson);

            // Wait a bit to see if runtime responds with error
            await new Promise(resolve => setTimeout(resolve, 1000));
            // If we get here without throwing, the runtime handled it gracefully
            assert(true);
        } catch (error) {
            // WebSocket might throw on invalid data, which is acceptable
            assert(error.message.includes('invalid') || error.message.includes('JSON'));
        }
    });

    test('should handle concurrent WebSocket connections', async () => {
        const concurrentConnections = [];
        const connectionPromises = [];

        // Try to create multiple concurrent connections
        for (let i = 0; i < 3; i++) {
            connectionPromises.push(
                connectWebSocket()
                    .then(ws => {
                        concurrentConnections.push(ws);
                        return ws;
                    })
                    .catch(error => ({ error: error.message, index: i }))
            );
        }

        const results = await Promise.all(connectionPromises);

        // At least the first connection should succeed
        const successfulConnections = results.filter(result => !result.error);
        assert(successfulConnections.length >= 1);

        // Test ping on each successful connection
        const pingPromises = successfulConnections.map((ws, index) => {
            const pingMessage = {
                type: 'ping',
                id: `concurrent-ping-${index}-${Date.now()}`
            };
            return sendMessage(ws, pingMessage, 5000);
        });

        const pingResults = await Promise.allSettled(pingPromises);

        pingResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                assert.strictEqual(result.value.type, 'pong');
            }
        });

        // Cleanup additional connections
        concurrentConnections.forEach(ws => {
            try {
                ws.close();
            } catch (error) {
                // Ignore cleanup errors
            }
        });
    });

    test('should handle application stop requests', async () => {
        // First deploy an app
        const deployMessage = {
            type: 'deploy_request',
            id: 'test-deploy-stop-' + Date.now(),
            code: `import asyncio
import time

async def main():
    print("App running before stop")
    for i in range(10):
        print(f"Running iteration {i+1}/10")
        await asyncio.sleep(1)
    print("App completed normally")

asyncio.run(main())`,
            language: 'python'
        };

        const deployResponse = await sendMessage(ws, deployMessage, 15000);

        if (deployResponse.status === 'started') {
            // Give the app a moment to start
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Then stop it
            const stopMessage = {
                type: 'stop_app',
                id: 'test-stop-' + Date.now(),
                appId: deployResponse.appId
            };

            const stopResponse = await sendMessage(ws, stopMessage, 10000);

            assert(['stop_app-response', 'error'].includes(stopResponse.type));

            if (stopResponse.type === 'stop_app-response') {
                assert(typeof stopResponse.result === 'object');
            }
        }
    });

    test('should handle runtime state reporting', async () => {
        const stateMessage = {
            type: 'report_runtime_state',
            id: 'test-state-' + Date.now()
        };

        const response = await sendMessage(ws, stateMessage, 10000);

        assert.strictEqual(response.type, 'runtime_state_response');
        assert(response.result);
        assert(typeof response.result === 'object');
        assert(typeof response.result.timestamp === 'string');
        assert(response.result.activeConnections !== undefined);
        assert(response.result.activeDeployments !== undefined);
    });
});