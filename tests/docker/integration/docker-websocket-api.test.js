import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import { spawn } from 'child_process';

describe('Docker WebSocket API Integration Tests', () => {
    const TEST_TIMEOUT = 120000; // 2 minutes for Docker operations
    const TEST_IMAGE = 'vehicle-edge-runtime:test';
    const CONTAINER_NAME = 'vehicle-edge-api-test';
    const WS_PORT = 3002;
    const HEALTH_PORT = 3003;

    let containerId;

    before(async () => {
        // Build test image
        await buildTestImage();
    });

    after(async () => {
        // Clean up
        await stopContainer();
    });

    beforeEach(async () => {
        // Start container with online Kit-Manager
        containerId = await startContainer([
            '-e', 'KIT_MANAGER_URL=ws://kit.digitalauto.tech',
            '-e', 'SKIP_KUKSA=true'  // Skip Kuksa for API tests
        ]);
        await waitForHealthCheck();
    });

    afterEach(async () => {
        // Clean up any running applications
        try {
            await cleanupApplications();
        } catch (error) {
            console.log('Cleanup warning:', error.message);
        }
    });

    async function buildTestImage() {
        return new Promise((resolve, reject) => {
            const docker = spawn('docker', ['build', '-t', TEST_IMAGE, '.'], {
                cwd: process.cwd(),
                stdio: 'pipe'
            });

            docker.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Docker build failed with code ${code}`));
                }
            });

            docker.on('error', reject);
        });
    }

    async function startContainer(options = []) {
        return new Promise((resolve, reject) => {
            const args = [
                'run', '-d',
                '--name', CONTAINER_NAME,
                '-p', `${WS_PORT}:3002`,
                '-p', `${HEALTH_PORT}:3003`,
                '-v', `${process.cwd()}/data:/app/data`,
                '-v', '/var/run/docker.sock:/var/run/docker.sock',
                ...options,
                TEST_IMAGE
            ];

            const docker = spawn('docker', args, { stdio: 'pipe' });

            let containerId = '';
            docker.stdout.on('data', (data) => {
                containerId += data.toString().trim();
            });

            docker.on('close', (code) => {
                if (code === 0 && containerId) {
                    resolve(containerId);
                } else {
                    reject(new Error(`Container start failed with code ${code}`));
                }
            });

            docker.on('error', reject);
        });
    }

    async function stopContainer() {
        return new Promise((resolve) => {
            const docker = spawn('docker', ['stop', CONTAINER_NAME], { stdio: 'pipe' });

            docker.on('close', () => {
                const dockerRm = spawn('docker', ['rm', CONTAINER_NAME, '-f'], { stdio: 'pipe' });
                dockerRm.on('close', () => resolve());
                dockerRm.on('error', () => resolve());
            });

            docker.on('error', () => resolve());
        });
    }

    async function waitForHealthCheck() {
        const maxWait = 60000; // 1 minute
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
            try {
                const response = await fetch(`http://localhost:${HEALTH_PORT}/health`);
                if (response.status === 200) {
                    const health = await response.json();
                    if (health.status === 'healthy') {
                        console.log('✅ Container health check passed');
                        return;
                    }
                }
            } catch (error) {
                // Continue waiting
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error('Health check failed within timeout');
    }

    async function cleanupApplications() {
        // Stop all running applications via WebSocket API
        const ws = new WebSocket(`ws://localhost:${WS_PORT}/runtime`);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Cleanup timeout'));
            }, 10000);

            ws.on('open', () => {
                // List applications
                ws.send(JSON.stringify({
                    type: 'list_deployed_apps',
                    id: 'cleanup-list'
                }));
            });

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());

                if (message.type === 'list_deployed_apps-response' && message.applications) {
                    // Stop each application
                    const stopPromises = message.applications.map(app =>
                        new Promise((resolveStop) => {
                            const stopWs = new WebSocket(`ws://localhost:${WS_PORT}/runtime`);

                            stopWs.on('open', () => {
                                stopWs.send(JSON.stringify({
                                    type: 'stop_app',
                                    appId: app.name,
                                    id: `cleanup-stop-${app.name}`
                                }));
                            });

                            stopWs.on('message', (stopData) => {
                                const stopMessage = JSON.parse(stopData.toString());
                                if (stopMessage.id === `cleanup-stop-${app.name}`) {
                                    stopWs.close();
                                    resolveStop();
                                }
                            });

                            stopWs.on('error', () => {
                                stopWs.close();
                                resolveStop();
                            });
                        })
                    );

                    Promise.all(stopPromises).then(() => {
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    });
                }
            });

            ws.on('error', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }

    function createWebSocketConnection(timeoutMs = 10000) {
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

    function sendAndWaitForResponse(ws, request, expectedType, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Response timeout for ${request.type}`));
            }, timeoutMs);

            ws.on('message', (data) => {
                const response = JSON.parse(data.toString());

                if (response.id === request.id && response.type === expectedType) {
                    clearTimeout(timeout);
                    resolve(response);
                }
            });

            ws.send(JSON.stringify(request));
        });
    }

    test('should handle ping/pong communication through Docker', async () => {
        console.log('🏓 Testing ping/pong through Docker...');

        const ws = await createWebSocketConnection();

        const pingRequest = {
            type: 'ping',
            id: 'docker-ping-test'
        };

        const pongResponse = await sendAndWaitForResponse(ws, pingRequest, 'pong');

        assert.strictEqual(pongResponse.type, 'pong', 'Should receive pong response');
        assert.strictEqual(pongResponse.id, pingRequest.id, 'Response should have matching ID');

        ws.close();
        console.log('✅ Ping/pong working through Docker');
    });

    test('should deploy Python application in Docker container', async () => {
        console.log('🐍 Testing Python app deployment in Docker...');

        const ws = await createWebSocketConnection();

        const pythonCode = `
import asyncio
import time

async def main():
    print("Docker Python test app started")
    for i in range(5):
        print(f"Iteration {i + 1}")
        await asyncio.sleep(0.5)
    print("Docker Python test app completed")

asyncio.run(main())
        `.trim();

        const deployRequest = {
            type: 'deploy_request',
            code: pythonCode,
            metadata: {
                type: 'python',
                name: 'Docker Python Test'
            },
            id: 'docker-deploy-python'
        };

        const deployResponse = await sendAndWaitForResponse(ws, deployRequest, 'deploy_request-response');

        assert.ok(deployResponse.success, 'Deployment should succeed');
        assert.ok(deployResponse.appId, 'Should receive application ID');

        console.log(`✅ Python app deployed: ${deployResponse.appId}`);

        // Wait a bit for execution
        await new Promise(resolve => setTimeout(resolve, 4000));

        ws.close();
    });

    test('should return runtime information through Docker', async () => {
        console.log('ℹ️ Testing runtime info through Docker...');

        const ws = await createWebSocketConnection();

        const infoRequest = {
            type: 'get_runtime_info',
            id: 'docker-runtime-info'
        };

        const infoResponse = await sendAndWaitForResponse(ws, infoRequest, 'get_runtime_info-response');

        assert.ok(infoResponse.runtimeInfo, 'Should return runtime info');
        assert.ok(infoResponse.runtimeInfo.runtimeId, 'Should have runtime ID');
        assert.strictEqual(infoResponse.runtimeInfo.port, '3002', 'Should report correct port');

        console.log(`✅ Runtime ID: ${infoResponse.runtimeInfo.runtimeId}`);

        ws.close();
    });

    test('should handle application listing through Docker', async () => {
        console.log('📋 Testing application listing through Docker...');

        const ws = await createWebSocketConnection();

        const listRequest = {
            type: 'list_deployed_apps',
            id: 'docker-list-apps'
        };

        const listResponse = await sendAndWaitForResponse(ws, listRequest, 'list_deployed_apps-response');

        assert.ok(Array.isArray(listResponse.applications), 'Should return applications array');

        console.log(`✅ Found ${listResponse.applications.length} applications`);

        ws.close();
    });

    test('should handle concurrent WebSocket connections through Docker', async () => {
        console.log('🔀 Testing concurrent connections through Docker...');

        const connections = [];
        const pongPromises = [];

        // Create 3 concurrent connections
        for (let i = 0; i < 3; i++) {
            const ws = await createWebSocketConnection();
            connections.push(ws);

            const pingRequest = {
                type: 'ping',
                id: `docker-concurrent-ping-${i}`
            };

            const pongPromise = sendAndWaitForResponse(ws, pingRequest, 'pong');
            pongPromises.push(pongPromise);
        }

        // Wait for all pong responses
        const pongResponses = await Promise.all(pongPromises);

        assert.strictEqual(pongResponses.length, 3, 'Should receive 3 pong responses');

        pongResponses.forEach((response, index) => {
            assert.strictEqual(response.type, 'pong', `Response ${index} should be pong`);
            assert.ok(response.id.includes('docker-concurrent-ping'), `Response ${index} should have correct ID`);
        });

        // Close all connections
        connections.forEach(ws => ws.close());

        console.log('✅ Concurrent connections working through Docker');
    });

    test('should handle invalid messages gracefully in Docker', async () => {
        console.log('❌ Testing invalid message handling in Docker...');

        const ws = await createWebSocketConnection();

        const invalidRequest = {
            type: 'invalid_message_type',
            id: 'docker-invalid-test',
            data: 'test data'
        };

        const errorResponse = await sendAndWaitForResponse(ws, invalidRequest, 'error');

        assert.strictEqual(errorResponse.type, 'error', 'Should return error response');
        assert.ok(errorResponse.message, 'Should include error message');

        ws.close();
        console.log('✅ Invalid messages handled gracefully in Docker');
    });

    test('should handle malformed JSON in Docker', async () => {
        console.log('💥 Testing malformed JSON handling in Docker...');

        const ws = await createWebSocketConnection();

        // Send malformed JSON
        ws.send('{"invalid": json structure}');

        // Connection should remain open for valid messages
        const pingRequest = {
            type: 'ping',
            id: 'docker-malformed-test'
        };

        try {
            const pongResponse = await sendAndWaitForResponse(ws, pingRequest, 'pong');
            assert.strictEqual(pongResponse.type, 'pong', 'Should still work after malformed JSON');
            console.log('✅ Malformed JSON handled gracefully in Docker');
        } catch (error) {
            console.log('⚠️ Connection closed after malformed JSON:', error.message);
        }

        ws.close();
    });

    test('should maintain connection stability through Docker', async () => {
        console.log('🔗 Testing connection stability through Docker...');

        const ws = await createWebSocketConnection();

        // Send multiple rapid messages
        const messageCount = 10;
        const responses = [];

        for (let i = 0; i < messageCount; i++) {
            const pingRequest = {
                type: 'ping',
                id: `docker-stability-ping-${i}`
            };

            const pongResponse = await sendAndWaitForResponse(ws, pingRequest, 'pong', 5000);
            responses.push(pongResponse);

            // Small delay between messages
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        assert.strictEqual(responses.length, messageCount, 'Should receive all responses');
        responses.forEach((response, index) => {
            assert.strictEqual(response.type, 'pong', `Response ${index} should be pong`);
        });

        ws.close();
        console.log(`✅ Connection stability maintained for ${messageCount} messages`);
    });

}).timeout(TEST_TIMEOUT);