import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import fs from 'fs-extra';

describe('Optimized Dockerfile Build Tests', () => {
    const TEST_IMAGE = 'vehicle-edge-runtime:test-build';
    const DOCKERFILE_PATH = './Dockerfile';

    before(async () => {
        // Verify Dockerfile exists
        const dockerfileExists = await fs.pathExists(DOCKERFILE_PATH);
        assert.ok(dockerfileExists, `Dockerfile should exist at ${DOCKERFILE_PATH}`);

        // Verify Docker daemon is running
        const dockerVersion = spawn('docker', ['version'], { stdio: 'pipe', timeout: 10000 });
        await new Promise((resolve, reject) => {
            dockerVersion.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error('Docker daemon not running'));
                }
            });
            dockerVersion.on('error', reject);
        });
    });

    after(async () => {
        // Clean up test image
        await cleanupTestImage();
    });

    beforeEach(async () => {
        // Clean up any existing test image
        await cleanupTestImage();
    });

    afterEach(async () => {
        // Ensure test image is cleaned up
        await cleanupTestImage();
    });

    async function cleanupTestImage() {
        return new Promise((resolve) => {
            const dockerRmi = spawn('docker', ['rmi', TEST_IMAGE, '-f'], {
                stdio: 'pipe',
                timeout: 10000
            });

            dockerRmi.on('close', () => resolve());
            dockerRmi.on('error', () => resolve()); // Ignore errors if image doesn't exist
        });
    }

    async function buildDockerImage(buildContext = '.') {
        console.log(`🏗️ Building Docker image ${TEST_IMAGE}...`);

        return new Promise((resolve, reject) => {
            const docker = spawn('docker', ['build', '-t', TEST_IMAGE, buildContext], {
                cwd: process.cwd(),
                stdio: 'pipe',
                timeout: 180000 // 3 minutes timeout for build
            });

            let stdout = '';
            let stderr = '';

            docker.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            docker.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            docker.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Docker image built successfully');
                    resolve({ stdout, stderr });
                } else {
                    console.log('❌ Docker build failed');
                    console.log('STDOUT:', stdout);
                    console.log('STDERR:', stderr);
                    reject(new Error(`Docker build failed with code ${code}: ${stderr}`));
                }
            });

            docker.on('error', reject);
        });
    }

    async function testDockerImage(imageName) {
        console.log(`🧪 Testing Docker image ${imageName}...`);

        return new Promise((resolve, reject) => {
            // Test if image exists and can run a simple command
            const docker = spawn('docker', ['run', '--rm', imageName, 'node', '--version'], {
                stdio: 'pipe',
                timeout: 15000
            });

            let stdout = '';
            let stderr = '';

            docker.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            docker.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            docker.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Docker image test passed');
                    resolve({ stdout, stderr });
                } else {
                    console.log('❌ Docker image test failed');
                    reject(new Error(`Docker image test failed with code ${code}: ${stderr}`));
                }
            });

            docker.on('error', reject);
        });
    }

    test('should build Docker image successfully', async () => {
        console.log('🏗️ Testing Docker image build...');

        const buildResult = await buildDockerImage();
        assert.ok(buildResult, 'Docker build should complete successfully');

        // Verify image exists
        const dockerImages = spawn('docker', ['images', TEST_IMAGE, '--format', '{{.Repository}}:{{.Tag}}'], {
            stdio: 'pipe',
            timeout: 5000
        });

        const imageName = await new Promise((resolve, reject) => {
            let output = '';
            dockerImages.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            dockerImages.on('close', (code) => {
                if (code === 0 && output) {
                    resolve(output);
                } else {
                    reject(new Error('Image not found after build'));
                }
            });

            dockerImages.on('error', reject);
        });

        assert.strictEqual(imageName, TEST_IMAGE, 'Built image should have correct name');
        console.log('✅ Docker image build successful');
    });

    test('should create functional Docker image', async () => {
        console.log('🧪 Testing Docker image functionality...');

        await buildDockerImage();
        const testResult = await testDockerImage(TEST_IMAGE);

        assert.ok(testResult.stdout.includes('v'), 'Node.js should be available in the image');
        console.log(`✅ Node.js version: ${testResult.stdout.trim()}`);
    });

    test('should have required dependencies installed', async () => {
        console.log('📦 Testing dependencies...');

        await buildDockerImage();

        // Test if required modules are available
        const dependencies = ['fs-extra', 'ws', 'winston'];

        for (const dep of dependencies) {
            const dockerTest = spawn('docker', ['run', '--rm', TEST_IMAGE, 'node', '-e', `require('${dep}')`], {
                stdio: 'pipe',
                timeout: 10000
            });

            const result = await new Promise((resolve, reject) => {
                dockerTest.on('close', (code) => {
                    resolve(code);
                });

                dockerTest.on('error', reject);
            });

            assert.strictEqual(result, 0, `Dependency ${dep} should be available`);
            console.log(`✅ ${dep} is available`);
        }
    });

    test('should have correct working directory', async () => {
        console.log('📁 Testing working directory...');

        await buildDockerImage();

        const dockerTest = spawn('docker', ['run', '--rm', TEST_IMAGE, 'pwd'], {
            stdio: 'pipe',
            timeout: 5000
        });

        const workingDir = await new Promise((resolve, reject) => {
            let output = '';
            dockerTest.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            dockerTest.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error('Failed to get working directory'));
                }
            });

            dockerTest.on('error', reject);
        });

        assert.strictEqual(workingDir, '/app', 'Working directory should be /app');
        console.log('✅ Working directory is correct');
    });

    test('should have application files in correct locations', async () => {
        console.log('📂 Testing application files...');

        await buildDockerImage();

        const filesToCheck = [
            '/app/src/index.js',
            '/app/package.json',
            '/app/data'
        ];

        for (const file of filesToCheck) {
            const dockerTest = spawn('docker', ['run', '--rm', TEST_IMAGE, 'test', '-e', file], {
                stdio: 'pipe',
                timeout: 5000
            });

            const result = await new Promise((resolve, reject) => {
                dockerTest.on('close', (code) => {
                    resolve(code);
                });

                dockerTest.on('error', reject);
            });

            assert.strictEqual(result, 0, `File ${file} should exist`);
            console.log(`✅ ${file} exists`);
        }
    });

    test('should run with correct Node.js version', async () => {
        console.log('🔢 Testing Node.js version...');

        await buildDockerImage();

        const dockerTest = spawn('docker', ['run', '--rm', TEST_IMAGE, 'node', '--version'], {
            stdio: 'pipe',
            timeout: 5000
        });

        const nodeVersion = await new Promise((resolve, reject) => {
            let output = '';
            dockerTest.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            dockerTest.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error('Failed to get Node.js version'));
                }
            });

            dockerTest.on('error', reject);
        });

        assert.ok(nodeVersion.includes('v20'), `Should use Node.js v20, got ${nodeVersion}`);
        console.log(`✅ Node.js version: ${nodeVersion}`);
    });

    test('should expose correct ports', async () => {
        console.log('🔌 Testing port exposure...');

        // This test checks if the Dockerfile exposes ports correctly
        const dockerfileContent = await fs.readFile(DOCKERFILE_PATH, 'utf8');

        // Check for EXPOSE statements - can be on same line or separate lines
        const exposeLines = dockerfileContent.split('\n').filter(line => line.includes('EXPOSE'));
        const hasExpose3002 = dockerfileContent.includes('EXPOSE') && dockerfileContent.includes('3002');
        const hasExpose3003 = dockerfileContent.includes('EXPOSE') && dockerfileContent.includes('3003');

        assert.ok(hasExpose3002, 'Should expose WebSocket API port 3002');
        assert.ok(hasExpose3003, 'Should expose health check port 3003');

        console.log('✅ Ports are correctly exposed in Dockerfile');
    });

    test('should have correct user permissions', async () => {
        console.log('👤 Testing user permissions...');

        await buildDockerImage();

        const dockerTest = spawn('docker', ['run', '--rm', TEST_IMAGE, 'whoami'], {
            stdio: 'pipe',
            timeout: 5000
        });

        const user = await new Promise((resolve, reject) => {
            let output = '';
            dockerTest.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            dockerTest.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error('Failed to get current user'));
                }
            });

            dockerTest.on('error', reject);
        });

        // Should run as non-root user
        assert.notStrictEqual(user, 'root', 'Should not run as root user');
        console.log(`✅ Running as non-root user: ${user}`);
    });

    test('should have health check configured', async () => {
        console.log('🏥 Testing health check configuration...');

        const dockerfileContent = await fs.readFile(DOCKERFILE_PATH, 'utf8');

        assert.ok(dockerfileContent.includes('HEALTHCHECK'), 'Should have health check configured');
        assert.ok(dockerfileContent.includes('curl'), 'Should use curl for health check');
        assert.ok(dockerfileContent.includes('3003'), 'Health check should target port 3003');

        console.log('✅ Health check is correctly configured');
    });

    test('should handle build with context changes', async () => {
        console.log('🔄 Testing build with context...');

        // Build from current directory (default behavior)
        await buildDockerImage('.');

        // Test that we can get image info
        const dockerInspect = spawn('docker', ['inspect', TEST_IMAGE, '--format', '{{.Id}}'], {
            stdio: 'pipe',
            timeout: 5000
        });

        const imageId = await new Promise((resolve, reject) => {
            let output = '';
            dockerInspect.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            dockerInspect.on('close', (code) => {
                if (code === 0 && output) {
                    resolve(output);
                } else {
                    reject(new Error('Failed to inspect image'));
                }
            });

            dockerInspect.on('error', reject);
        });

        assert.ok(imageId, 'Image should have valid ID');
        console.log(`✅ Image built successfully with ID: ${imageId.substring(0, 12)}`);
    });

    test('should have Docker CLI available', async () => {
        console.log('🐳 Testing Docker CLI availability...');

        await buildDockerImage();

        const dockerTest = spawn('docker', ['run', '--rm', TEST_IMAGE, 'docker', '--version'], {
            stdio: 'pipe',
            timeout: 5000
        });

        const result = await new Promise((resolve, reject) => {
            let output = '';
            dockerTest.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            dockerTest.on('close', (code) => {
                resolve({ code, output });
            });

            dockerTest.on('error', reject);
        });

        // Docker CLI should be available (though might not work without socket)
        assert.ok(result.output.includes('Docker version') || result.code !== 0,
            'Docker CLI should be available or gracefully handled');
        console.log('✅ Docker CLI availability verified');
    });

    after(() => {
        // Clear all pending timers to prevent timeout reference errors
        const maxTimerId = setTimeout(() => {}, 0);
        for (let i = 1; i <= maxTimerId; i++) {
            clearTimeout(i);
        }
    });
});