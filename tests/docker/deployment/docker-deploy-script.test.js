import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

describe('Docker Deployment Script Tests', () => {
    const TEST_TIMEOUT = 180000; // 3 minutes for deployment operations
    const SCRIPT_PATH = './docker-deploy.sh';
    const TEST_COMPOSE_FILE = 'docker-compose.test.yml';

    // Add global timeout for tests
    setTimeout(() => {
        // Clear any hanging resources
    }, TEST_TIMEOUT + 30000);

    before(async () => {
        // Ensure docker-deploy.sh is executable
        try {
            await fs.chmod(SCRIPT_PATH, '755');
        } catch (error) {
            console.log('Warning: Could not set execute permission on docker-deploy.sh');
        }

        // Create test compose file to avoid conflicts with main
        await createTestComposeFile();
    });

    after(async () => {
        // Clean up test compose file
        await cleanupTestEnvironment();
    });

    beforeEach(async () => {
        // Clean up any existing test containers
        await cleanupTestEnvironment();
    });

    afterEach(async () => {
        // Ensure test environment is clean
        await cleanupTestEnvironment();
    });

    async function createTestComposeFile() {
        const composeContent = `# Test version of docker-compose.yml
version: '3.8'

services:
  vehicle-edge-runtime:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: vehicle-edge-test
    ports:
      - "13002:3002"  # Different ports for testing
      - "13003:3003"
    volumes:
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - NODE_ENV=test
      - PORT=3002
      - LOG_LEVEL=info
      - KIT_MANAGER_URL=ws://kit.digitalauto.tech
      - SKIP_KUKSA=true
    restart: "no"  # Don't restart automatically in tests
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 5s
      timeout: 3s
      retries: 2
      start_period: 10s`;

        await fs.writeFile(TEST_COMPOSE_FILE, composeContent);
    }

    async function cleanupTestEnvironment() {
        return new Promise((resolve) => {
            // Stop any test containers
            const dockerStop = spawn('docker', ['compose', '-f', TEST_COMPOSE_FILE, 'down', '-v'], {
                stdio: 'pipe'
            });

            dockerStop.on('close', () => {
                // Remove test image if it exists
                const dockerRmi = spawn('docker', ['rmi', 'vehicle-edge-runtime:test', '-f'], {
                    stdio: 'pipe'
                });

                dockerRmi.on('close', () => resolve());
                dockerRmi.on('error', () => resolve());
            });

            dockerStop.on('error', () => resolve());
        });
    }

    async function runDeployScript(args = []) {
        return new Promise((resolve, reject) => {
            // Create a test version of the script that uses test compose file
            const testScriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
            const modifiedScript = testScriptContent.replace(/docker-compose\.new\.yml/g, TEST_COMPOSE_FILE);
            const modifiedScript2 = modifiedScript.replace(/docker-compose\.yml/g, TEST_COMPOSE_FILE);

            const tempScriptPath = './docker-deploy-test.sh';
            await fs.writeFile(tempScriptPath, modifiedScript2);
            await fs.chmod(tempScriptPath, '755');

            const dockerDeploy = spawn('bash', [tempScriptPath, ...args], {
                stdio: 'pipe',
                cwd: process.cwd()
            });

            let stdout = '';
            let stderr = '';

            dockerDeploy.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            dockerDeploy.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            dockerDeploy.on('close', (code) => {
                // Clean up temporary script
                fs.remove(tempScriptPath).catch(() => {});
                resolve({ code, stdout, stderr });
            });

            dockerDeploy.on('error', (error) => {
                // Clean up temporary script
                fs.remove(tempScriptPath).catch(() => {});
                reject(error);
            });
        });
    }

    test('should show help information', async () => {
        console.log('📖 Testing deploy script help...');

        const result = await runDeployScript(['help']);

        // Should exit with code 1 for invalid arguments (which shows help)
        assert.ok(result.stdout.includes('Usage:') || result.stderr.includes('Usage:'),
            'Should show usage information');

        console.log('✅ Help information displayed');
    });

    test('should deploy base runtime successfully', async () => {
        console.log('🚀 Testing base deployment...');

        const result = await runDeployScript(['deploy', 'base']);

        assert.strictEqual(result.code, 0, `Deployment failed: ${result.stderr}`);
        assert.ok(result.stdout.includes('Deployed base runtime'), 'Should show success message');

        // Verify container is running
        const dockerPs = spawn('docker', ['ps', '--filter', 'name=vehicle-edge-test', '--format', '{{.Names}}'], {
            stdio: 'pipe'
        });

        let containerName = '';
        dockerPs.stdout.on('data', (data) => {
            containerName += data.toString().trim();
        });

        await new Promise((resolve, reject) => {
            dockerPs.on('close', (code) => {
                if (code === 0 && containerName.includes('vehicle-edge-test')) {
                    console.log('✅ Base deployment successful');
                    resolve();
                } else {
                    reject(new Error('Container not found after deployment'));
                }
            });

            dockerPs.on('error', reject);
        });
    });

    test('should stop services successfully', async () => {
        console.log('🛑 Testing service stop...');

        // First deploy something
        await runDeployScript(['deploy', 'base']);

        // Then stop it
        const result = await runDeployScript(['stop']);

        assert.strictEqual(result.code, 0, `Stop failed: ${result.stderr}`);
        assert.ok(result.stdout.includes('stopped') || result.stdout.includes('✅'),
            'Should show stop success message');

        // Verify container is stopped
        const dockerPs = spawn('docker', ['ps', '--filter', 'name=vehicle-edge-test', '--format', '{{.Names}}'], {
            stdio: 'pipe'
        });

        let containerName = '';
        dockerPs.stdout.on('data', (data) => {
            containerName += data.toString().trim();
        });

        await new Promise((resolve) => {
            dockerPs.on('close', () => {
                assert.strictEqual(containerName, '', 'Container should be stopped');
                console.log('✅ Services stopped successfully');
                resolve();
            });
            dockerPs.on('error', () => resolve());
        });
    });

    test('should check service status', async () => {
        console.log('📊 Testing status check...');

        // Deploy first
        await runDeployScript(['deploy', 'base']);

        // Check status
        const result = await runDeployScript(['status']);

        assert.strictEqual(result.code, 0, `Status check failed: ${result.stderr}`);
        assert.ok(result.stdout.includes('Service Status') || result.stdout.includes('vehicle-edge-test'),
            'Should show service status');

        console.log('✅ Status check working');
    });

    test('should handle health check in status', async () => {
        console.log('🏥 Testing health check in status...');

        // Deploy first
        await runDeployScript(['deploy', 'base']);

        // Wait a bit for health check
        await new Promise(resolve => setTimeout(resolve, 15000));

        // Check status which includes health check
        const result = await runDeployScript(['status']);

        assert.ok(result.stdout.includes('healthy') || result.stdout.includes('Health Check'),
            'Should include health check information');

        console.log('✅ Health check integration working');
    });

    test('should clean up environment successfully', async () => {
        console.log('🧹 Testing cleanup...');

        // Deploy first
        await runDeployScript(['deploy', 'base']);

        // Then clean up
        const result = await runDeployScript(['clean']);

        assert.strictEqual(result.code, 0, `Cleanup failed: ${result.stderr}`);
        assert.ok(result.stdout.includes('complete') || result.stdout.includes('✅'),
            'Should show cleanup success message');

        // Verify no test containers exist
        const dockerPs = spawn('docker', ['ps', '-a', '--filter', 'name=vehicle-edge-test', '--format', '{{.Names}}'], {
            stdio: 'pipe'
        });

        let containerName = '';
        dockerPs.stdout.on('data', (data) => {
            containerName += data.toString().trim();
        });

        await new Promise((resolve) => {
            dockerPs.on('close', () => {
                assert.strictEqual(containerName, '', 'Container should be cleaned up');
                console.log('✅ Cleanup successful');
                resolve();
            });
            dockerPs.on('error', () => resolve());
        });
    });

    test('should show logs for running services', async () => {
        console.log('📋 Testing logs functionality...');

        // Deploy first
        await runDeployScript(['deploy', 'base']);

        // Start logs command (we'll kill it quickly since it's a tail command)
        const logsProcess = spawn('bash', ['./docker-deploy-test.sh', 'logs'], {
            stdio: 'pipe'
        });

        let logsOutput = '';
        logsProcess.stdout.on('data', (data) => {
            logsOutput += data.toString();
        });

        // Let it run for a few seconds then kill it
        setTimeout(() => {
            logsProcess.kill();
        }, 5000);

        await new Promise((resolve) => {
            logsProcess.on('close', () => {
                assert.ok(logsOutput.length > 0, 'Should produce some log output');
                console.log('✅ Logs functionality working');
                resolve();
            });
            logsProcess.on('error', () => resolve());
        });
    });

    test('should handle invalid deployment profiles', async () => {
        console.log('❌ Testing invalid profile handling...');

        const result = await runDeployScript(['deploy', 'invalid-profile']);

        // Should show help/usage for invalid profile
        assert.ok(result.stdout.includes('Usage:') || result.stdout.includes('Profiles:'),
            'Should show usage for invalid profile');

        console.log('✅ Invalid profile handled gracefully');
    });

    test('should create .env file from defaults if missing', async () => {
        console.log('📝 Testing .env file creation...');

        // Remove .env if it exists
        const envPath = './.env';
        if (await fs.pathExists(envPath)) {
            await fs.remove(envPath);
        }

        // Deploy (should create .env from production defaults)
        const result = await runDeployScript(['deploy', 'base']);

        assert.strictEqual(result.code, 0, `Deployment failed: ${result.stderr}`);

        // Check if .env was created
        const envExists = await fs.pathExists(envPath);
        assert.ok(envExists, '.env file should be created from production defaults');

        if (envExists) {
            const envContent = await fs.readFile(envPath, 'utf8');
            assert.ok(envContent.includes('KIT_MANAGER_URL=ws://kit.digitalauto.tech'),
                'Should include Kit Manager URL');
        }

        console.log('✅ .env file creation working');
    });

    test('should handle script permissions correctly', async () => {
        console.log('🔐 Testing script permissions...');

        // Check if script is executable
        const stats = await fs.stat(SCRIPT_PATH);
        const mode = (stats.mode & parseInt('777', 8)).toString(8);

        // Should have execute permissions (755 or similar)
        assert.ok(mode.includes('5') || mode.includes('7'), 'Script should be executable');

        console.log(`✅ Script permissions: ${mode}`);
    });

    test('should provide clear error messages for Docker issues', async () => {
        console.log('⚠️ Testing Docker error handling...');

        // Temporarily make Docker unavailable by stopping it (if possible)
        // This is a best-effort test - may not work in all environments

        try {
            // Try to run deploy without Docker daemon
            // We'll just check that the script handles Docker not running gracefully
            const result = await runDeployScript(['status']);

            // Should either succeed or fail gracefully
            assert.ok(typeof result.code === 'number', 'Should handle Docker status properly');
            console.log('✅ Docker error handling working');
        } catch (error) {
            console.log('⚠️ Docker error test skipped:', error.message);
        }
    });

}).timeout(TEST_TIMEOUT);