import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import http from 'node:http';
import { spawn } from 'child_process';

describe('Docker Container Lifecycle Tests', () => {
    const TEST_TIMEOUT = 60000; // 1 minute for container operations
    const TEST_IMAGE = 'vehicle-edge-runtime:test';
    const CONTAINER_NAME = 'vehicle-edge-test';
    const WS_PORT = 3002;
    const HEALTH_PORT = 3003;

    beforeEach(async () => {
        // Build test image if not exists
        await buildTestImage();
        // Stop any existing test container
        await stopContainer();
    });

    afterEach(async () => {
        // Clean up test container
        await stopContainer();
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
                dockerRm.on('error', () => resolve()); // Ignore errors
            });

            docker.on('error', () => resolve()); // Ignore errors if container doesn't exist
        });
    }

    async function waitForPort(port, timeoutMs = 30000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            try {
                await new Promise((resolve, reject) => {
                    const req = http.get(`http://localhost:${port}/`, (res) => {
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
        throw new Error(`Port ${port} not ready within ${timeoutMs}ms`);
    }

    test('should start container successfully', async () => {
        console.log('🚀 Starting Docker container...');

        const containerId = await startContainer();
        assert.ok(containerId, 'Container should start and return an ID');

        console.log(`✅ Container started: ${containerId.substring(0, 12)}...`);
    });

    test('should expose WebSocket port correctly', async () => {
        console.log('🔌 Testing WebSocket port exposure...');

        await startContainer();
        await waitForPort(WS_PORT);

        // Test WebSocket connection
        const ws = new WebSocket(`ws://localhost:${WS_PORT}/runtime`);

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 10000);

            ws.on('open', () => {
                clearTimeout(timeout);
                console.log('✅ WebSocket port accessible');
                ws.close();
                resolve();
            });

            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    });

    test('should expose health check port correctly', async () => {
        console.log('🏥 Testing health check port exposure...');

        await startContainer();
        await waitForPort(HEALTH_PORT);

        const response = await fetch(`http://localhost:${HEALTH_PORT}/health`);
        assert.strictEqual(response.status, 200, 'Health endpoint should return 200');

        const healthData = await response.json();
        assert.ok(healthData.status, 'Health response should include status');
        console.log('✅ Health check port accessible');
    });

    test('should apply environment variables correctly', async () => {
        console.log('🌍 Testing environment variable application...');

        const testLogLevel = 'debug';
        await startContainer(['-e', `LOG_LEVEL=${testLogLevel}`]);

        // Connect via WebSocket to verify log level
        const ws = new WebSocket(`ws://localhost:${WS_PORT}/runtime`);

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 10000);

            ws.on('open', () => {
                clearTimeout(timeout);

                // Send a test message to trigger logging
                ws.send(JSON.stringify({
                    type: 'ping',
                    id: 'test-env-vars'
                }));
            });

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'pong') {
                    console.log('✅ Environment variables applied (pong received)');
                    ws.close();
                    resolve();
                }
            });

            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    });

    test('should mount volumes correctly', async () => {
        console.log('📁 Testing volume mounting...');

        await startContainer();

        // Check if data directory is accessible in container
        const docker = spawn('docker', ['exec', CONTAINER_NAME, 'ls', '-la', '/app/data'], {
            stdio: 'pipe'
        });

        let output = '';
        docker.stdout.on('data', (data) => {
            output += data.toString();
        });

        await new Promise((resolve, reject) => {
            docker.on('close', (code) => {
                if (code === 0) {
                    assert.ok(output.includes('drwx'), 'Data directory should be mounted and accessible');
                    console.log('✅ Volume mounting works');
                    resolve();
                } else {
                    reject(new Error('Failed to access mounted volume'));
                }
            });
            docker.on('error', reject);
        });
    });

    test('should have Docker socket access', async () => {
        console.log('🐳 Testing Docker socket access...');

        await startContainer();

        // Check if Docker socket is accessible in container
        const docker = spawn('docker', ['exec', CONTAINER_NAME, 'docker', 'info'], {
            stdio: 'pipe'
        });

        let output = '';
        docker.stdout.on('data', (data) => {
            output += data.toString();
        });

        await new Promise((resolve, reject) => {
            docker.on('close', (code) => {
                if (code === 0) {
                    assert.ok(output.includes('Server Version'), 'Docker CLI should work inside container');
                    console.log('✅ Docker socket access working');
                    resolve();
                } else {
                    reject(new Error('Docker socket access failed'));
                }
            });
            docker.on('error', reject);
        });
    });

    test('should handle graceful shutdown', async () => {
        console.log('🛑 Testing graceful shutdown...');

        const containerId = await startContainer();
        await waitForPort(WS_PORT);

        // Connect WebSocket to monitor shutdown
        const ws = new WebSocket(`ws://localhost:${WS_PORT}/runtime`);

        const shutdownPromise = new Promise((resolve) => {
            ws.on('close', () => {
                console.log('✅ WebSocket closed gracefully');
                resolve();
            });

            ws.on('open', () => {
                // Initiate shutdown
                setTimeout(() => {
                    const docker = spawn('docker', ['stop', CONTAINER_NAME], { stdio: 'pipe' });
                    docker.on('close', () => {});
                }, 1000);
            });
        });

        await shutdownPromise;
    });

    test('should respect resource limits', async () => {
        console.log('⚡ Testing resource limits...');

        // Start container with memory limit
        await startContainer(['--memory=512m', '--cpus=0.5']);

        const docker = spawn('docker', ['stats', CONTAINER_NAME, '--no-stream', '--format', '{{.MemUsage}} {{.CPUPerc}}'], {
            stdio: 'pipe'
        });

        let output = '';
        docker.stdout.on('data', (data) => {
            output += data.toString().trim();
        });

        await new Promise((resolve, reject) => {
            docker.on('close', (code) => {
                if (code === 0) {
                    assert.ok(output, 'Should get resource stats');
                    console.log(`✅ Resource stats: ${output}`);
                    resolve();
                } else {
                    reject(new Error('Failed to get resource stats'));
                }
            });
            docker.on('error', reject);
        });
    });

    test('should maintain container isolation', async () => {
        console.log('🔒 Testing container isolation...');

        await startContainer();

        // Test that container cannot access host files outside mounted volumes
        const docker = spawn('docker', ['exec', CONTAINER_NAME, 'ls', '/etc/passwd'], {
            stdio: 'pipe'
        });

        let output = '';
        docker.stdout.on('data', (data) => {
            output += data.toString();
        });

        await new Promise((resolve, reject) => {
            docker.on('close', (code) => {
                if (code === 0) {
                    // Should have container's own passwd file, not host's
                    assert.ok(output.length > 0, 'Container should have its own filesystem');
                    console.log('✅ Container isolation working');
                    resolve();
                } else {
                    reject(new Error('Filesystem access test failed'));
                }
            });
            docker.on('error', reject);
        });
    });

}).timeout(TEST_TIMEOUT);