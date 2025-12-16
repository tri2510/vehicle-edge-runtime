import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import net from 'node:net';

/**
 * Centralized test resource manager for Docker tests
 * Provides isolation and cleanup for test resources
 */
export class TestResourceManager {
    constructor(testName) {
        this.testId = `${testName}-${Date.now()}-${randomBytes(4).toString('hex')}`;
        this.resources = {
            containers: new Set(),
            networks: new Set(),
            images: new Set(),
            ports: new Set(),
            processes: new Set(),
            tempFiles: new Set()
        };
        this.allocatedPorts = new Map();
        this.isCleanedUp = false;
    }

    /**
     * Generate unique container names with consistent pattern
     */
    getContainerName(suffix = '') {
        const name = suffix ? `vehicle-edge-${this.testId}-${suffix}` : `vehicle-edge-${this.testId}`;
        this.resources.containers.add(name);
        return name;
    }

    /**
     * Generate unique network names
     */
    getNetworkName() {
        const networkName = `vehicle-edge-network-${this.testId}`;
        this.resources.networks.add(networkName);
        return networkName;
    }

    /**
     * Allocate unique ports for testing
     */
    async allocatePorts(count = 2, startPort = 32000, endPort = 32999) {
        const ports = [];
        const maxAttempts = (endPort - startPort) * 2;
        let attempts = 0;

        while (ports.length < count && attempts < maxAttempts) {
            const port = startPort + Math.floor(Math.random() * (endPort - startPort));

            if (!ports.includes(port) && await this.isPortAvailable(port)) {
                ports.push(port);
                this.resources.ports.add(port);
                this.allocatedPorts.set(`port_${ports.length}`, port);
            }

            attempts++;
        }

        if (ports.length < count) {
            throw new Error(`Could not allocate ${count} ports after ${attempts} attempts`);
        }

        return ports;
    }

    /**
     * Check if a port is available
     */
    async isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();

            server.listen(port, () => {
                server.once('close', () => resolve(true));
                server.close();
            });

            server.on('error', () => resolve(false));
        });
    }

    /**
     * Create temporary database for test
     */
    async createTestDatabase() {
        const testDbPath = `./test-data/vehicle-edge-${this.testId}.db`;

        // Copy template if exists, otherwise create empty
        const templatePath = './test-data/vehicle-edge.db.template';
        if (await fs.pathExists(templatePath)) {
            await fs.copy(templatePath, testDbPath);
        } else {
            // Create empty database file
            await fs.ensureFile(testDbPath);
        }

        this.resources.tempFiles.add(testDbPath);
        return testDbPath;
    }

    /**
     * Create temporary directory for test
     */
    async createTempDir(suffix = '') {
        const tempDir = `./tmp/${this.testId}${suffix ? '-' + suffix : ''}`;
        await fs.ensureDir(tempDir);
        this.resources.tempFiles.add(tempDir);
        return tempDir;
    }

    /**
     * Kill processes using specific ports
     */
    async killProcessesOnPorts(ports) {
        for (const port of ports) {
            try {
                // Try different methods to kill processes on the port
                const commands = [
                    `fuser -k ${port}/tcp`,
                    `lsof -ti:${port} | xargs kill -9`,
                    `netstat -tlnp | grep :${port} | awk '{print $7}' | cut -d'/' -f1 | xargs kill -9`
                ];

                for (const cmd of commands) {
                    try {
                        await this.execCommand(cmd, 2000);
                    } catch (e) {
                        // Ignore individual command failures
                    }
                }

                // Wait a moment for processes to terminate
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.log(`⚠️ Could not kill processes on port ${port}:`, error.message);
            }
        }
    }

    /**
     * Execute command with timeout
     */
    async execCommand(command, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const [cmd, ...args] = command.split(' ');
            const child = spawn(cmd, args, { stdio: 'pipe' });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => stdout += data.toString());
            child.stderr?.on('data', (data) => stderr += data.toString());

            const timer = setTimeout(() => {
                child.kill('SIGKILL');
                reject(new Error(`Command timeout: ${command}`));
            }, timeout);

            child.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0) {
                    resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
                } else {
                    reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
                }
            });

            child.on('error', reject);
        });
    }

    /**
     * Stop and remove containers
     */
    async cleanupContainers() {
        for (const containerName of this.resources.containers) {
            try {
                // Stop container gracefully first
                await this.execCommand(`docker stop ${containerName}`, 10000);
                // Force remove if still exists
                await this.execCommand(`docker rm -f ${containerName}`, 5000);
                console.log(`✅ Cleaned up container: ${containerName}`);
            } catch (error) {
                console.log(`⚠️ Container cleanup warning for ${containerName}:`, error.message);
            }
        }
    }

    /**
     * Remove Docker networks
     */
    async cleanupNetworks() {
        for (const networkName of this.resources.networks) {
            try {
                await this.execCommand(`docker network rm ${networkName}`, 5000);
                console.log(`✅ Cleaned up network: ${networkName}`);
            } catch (error) {
                console.log(`⚠️ Network cleanup warning for ${networkName}:`, error.message);
            }
        }
    }

    /**
     * Remove temporary images
     */
    async cleanupImages() {
        for (const imageName of this.resources.images) {
            try {
                await this.execCommand(`docker rmi -f ${imageName}`, 10000);
                console.log(`✅ Cleaned up image: ${imageName}`);
            } catch (error) {
                console.log(`⚠️ Image cleanup warning for ${imageName}:`, error.message);
            }
        }
    }

    /**
     * Kill processes and cleanup ports
     */
    async cleanupProcesses() {
        await this.killProcessesOnPorts(Array.from(this.resources.ports));
    }

    /**
     * Remove temporary files and directories
     */
    async cleanupTempFiles() {
        for (const tempPath of this.resources.tempFiles) {
            try {
                if (await fs.pathExists(tempPath)) {
                    await fs.remove(tempPath);
                    console.log(`✅ Cleaned up temp file/directory: ${tempPath}`);
                }
            } catch (error) {
                console.log(`⚠️ Temp file cleanup warning for ${tempPath}:`, error.message);
            }
        }
    }

    /**
     * Comprehensive cleanup of all resources
     */
    async cleanup() {
        if (this.isCleanedUp) {
            console.log(`⚠️ Test resource manager for ${this.testId} already cleaned up`);
            return;
        }

        console.log(`🧹 Cleaning up test resources for ${this.testId}...`);

        try {
            // Cleanup in reverse order of creation
            await Promise.allSettled([
                this.cleanupContainers(),
                this.cleanupNetworks(),
                this.cleanupImages(),
                this.cleanupProcesses(),
                this.cleanupTempFiles()
            ]);

            this.isCleanedUp = true;
            console.log(`✅ Test resource cleanup completed for ${this.testId}`);

        } catch (error) {
            console.error(`❌ Error during cleanup for ${this.testId}:`, error);
        }
    }

    /**
     * Get resource summary for debugging
     */
    getResourceSummary() {
        return {
            testId: this.testId,
            containers: Array.from(this.resources.containers),
            networks: Array.from(this.resources.networks),
            images: Array.from(this.resources.images),
            ports: Array.from(this.resources.ports),
            tempFiles: Array.from(this.resources.tempFiles),
            allocatedPorts: Object.fromEntries(this.allocatedPorts),
            isCleanedUp: this.isCleanedUp
        };
    }
}

/**
 * Global test coordinator for managing multiple test runs
 */
export class TestCoordinator {
    constructor() {
        this.activeTests = new Map();
        this.globalPortPool = new Set();
        this.portRange = { min: 32000, max: 32999 };
    }

    /**
     * Register a new test run
     */
    registerTest(testName) {
        if (this.activeTests.has(testName)) {
            throw new Error(`Test ${testName} is already running`);
        }

        const manager = new TestResourceManager(testName);
        this.activeTests.set(testName, manager);
        return manager;
    }

    /**
     * Unregister and cleanup a test run
     */
    async unregisterTest(testName) {
        const manager = this.activeTests.get(testName);
        if (manager) {
            await manager.cleanup();
            this.activeTests.delete(testName);
        }
    }

    /**
     * Cleanup all active tests
     */
    async cleanupAll() {
        console.log(`🧹 Cleaning up ${this.activeTests.size} active test(s)...`);

        const cleanupPromises = Array.from(this.activeTests.entries()).map(
            async ([testName, manager]) => {
                try {
                    await manager.cleanup();
                } catch (error) {
                    console.error(`Error cleaning up test ${testName}:`, error);
                }
            }
        );

        await Promise.allSettled(cleanupPromises);
        this.activeTests.clear();
    }
}

// Global coordinator instance
export const testCoordinator = new TestCoordinator();

// Graceful shutdown handler
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, cleaning up all test resources...');
    await testCoordinator.cleanupAll();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, cleaning up all test resources...');
    await testCoordinator.cleanupAll();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught exception:', error);
    await testCoordinator.cleanupAll();
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
    await testCoordinator.cleanupAll();
    process.exit(1);
});