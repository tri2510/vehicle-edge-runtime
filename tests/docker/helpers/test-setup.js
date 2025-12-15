import http from 'node:http';
import { spawn } from 'child_process';
import net from 'net';

/**
 * Docker Test Setup Helper
 * Provides centralized prerequisite checking for Docker tests
 */

export class DockerTestSetup {
    constructor() {
        this.kuksaRunning = false;
        this.kitManagerRunning = false;
        this.setupComplete = false;
    }

    /**
     * Check if a TCP port is accessible
     */
    async checkPort(port, host = 'localhost', timeout = 3000) {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();

            socket.setTimeout(timeout);
            socket.connect(port, host, () => {
                socket.destroy();
                resolve(true);
            });

            socket.on('error', () => {
                socket.destroy();
                reject(new Error(`Port ${port} not accessible`));
            });

            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error(`Port ${port} connection timeout`));
            });
        });
    }

    /**
     * Check if HTTP endpoint is responding
     */
    async checkHttpEndpoint(url, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const req = http.get(url, (res) => {
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    resolve(true);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });

            req.on('error', reject);
            req.setTimeout(timeout, reject);
        });
    }

    /**
     * Check Kuksa databroker availability
     */
    async checkKuksa() {
        console.log('🔍 Checking Kuksa databroker...');

        try {
            // Method 1: Check gRPC port (primary)
            await this.checkPort(55555);
            console.log('✅ Kuksa gRPC server is running (port 55555)');
            this.kuksaRunning = true;
            return true;
        } catch (grpcError) {
            console.log('⚠️ Kuksa gRPC not accessible, checking WebSocket VISS...');

            try {
                // Method 2: Check WebSocket VISS port
                await this.checkPort(8090);
                console.log('✅ Kuksa WebSocket VISS service is running (port 8090)');
                this.kuksaRunning = true;
                return true;
            } catch (wsError) {
                console.log('⚠️ Kuksa WebSocket not accessible, checking HTTP endpoint...');

                try {
                    // Method 3: Check HTTP endpoint (fallback)
                    await this.checkHttpEndpoint('http://localhost:8090/vss');
                    console.log('✅ Kuksa HTTP endpoint is accessible (port 8090)');
                    this.kuksaRunning = true;
                    return true;
                } catch (httpError) {
                    console.log('❌ Kuksa databroker not accessible on any port');
                    this.kuksaRunning = false;
                    return false;
                }
            }
        }
    }

    /**
     * Check Kit Manager availability
     */
    async checkKitManager() {
        console.log('🔍 Checking Kit Manager...');

        try {
            await this.checkHttpEndpoint('http://localhost:3090/listAllKits');
            console.log('✅ Kit Manager is running (port 3090)');
            this.kitManagerRunning = true;
            return true;
        } catch (error) {
            console.log('❌ Kit Manager not accessible:', error.message);
            this.kitManagerRunning = false;
            return false;
        }
    }

    /**
     * Start Kuksa databroker if not running
     */
    async startKuksa() {
        console.log('🚀 Starting Kuksa databroker...');

        try {
            await new Promise((resolve, reject) => {
                const process = spawn('bash', ['./simulation/6-start-kuksa-server.sh'], {
                    stdio: 'pipe',
                    timeout: 30000
                });

                let output = '';
                process.stdout.on('data', (data) => {
                    output += data.toString();
                });

                process.stderr.on('data', (data) => {
                    output += data.toString();
                });

                process.on('close', (code) => {
                    if (code === 0 || output.includes('Kuksa Databroker is ready')) {
                        console.log('✅ Kuksa databroker started successfully');
                        resolve();
                    } else {
                        reject(new Error(`Kuksa startup failed with code ${code}`));
                    }
                });

                process.on('error', (error) => {
                    reject(new Error(`Kuksa startup failed: ${error.message}`));
                });
            });

            // Wait for service to be fully ready
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Verify it's actually accessible
            const isRunning = await this.checkKuksa();
            if (!isRunning) {
                throw new Error('Kuksa started but not accessible');
            }

            return true;
        } catch (error) {
            console.log('❌ Failed to start Kuksa databroker:', error.message);
            return false;
        }
    }

    /**
     * Start Kit Manager if not running
     */
    async startKitManager() {
        console.log('🚀 Starting Kit Manager...');

        try {
            await new Promise((resolve, reject) => {
                const process = spawn('bash', ['./simulation/1-start-kit-manager.sh'], {
                    stdio: 'pipe',
                    timeout: 15000
                });

                let output = '';
                process.stdout.on('data', (data) => {
                    output += data.toString();
                });

                process.stderr.on('data', (data) => {
                    output += data.toString();
                });

                process.on('close', (code) => {
                    if (code === 0 || output.includes('Kit Manager started successfully')) {
                        console.log('✅ Kit Manager started successfully');
                        resolve();
                    } else {
                        reject(new Error(`Kit Manager startup failed with code ${code}`));
                    }
                });

                process.on('error', (error) => {
                    reject(new Error(`Kit Manager startup failed: ${error.message}`));
                });
            });

            // Wait for service to be fully ready
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Verify it's actually accessible
            const isRunning = await this.checkKitManager();
            if (!isRunning) {
                throw new Error('Kit Manager started but not accessible');
            }

            return true;
        } catch (error) {
            console.log('❌ Failed to start Kit Manager:', error.message);
            return false;
        }
    }

    /**
     * Run comprehensive prerequisite checks and start services if needed
     */
    async runPrerequisiteChecks() {
        if (this.setupComplete) {
            return {
                kuksaRunning: this.kuksaRunning,
                kitManagerRunning: this.kitManagerRunning,
                allServicesReady: this.kuksaRunning && this.kitManagerRunning
            };
        }

        console.log('\n🏗️  Docker Test Prerequisite Checks');
        console.log('==================================');

        // Check and potentially start Kuksa
        const kuksaWasRunning = await this.checkKuksa();
        if (!kuksaWasRunning) {
            const kuksaStarted = await this.startKuksa();
            if (!kuksaStarted) {
                console.log('⚠️ WARNING: Kuksa databroker is not available. Some tests may fail.');
            }
        }

        // Check and potentially start Kit Manager
        const kitManagerWasRunning = await this.checkKitManager();
        if (!kitManagerWasRunning) {
            const kitManagerStarted = await this.startKitManager();
            if (!kitManagerStarted) {
                console.log('⚠️ WARNING: Kit Manager is not available. Some tests may fail.');
            }
        }

        this.setupComplete = true;

        const status = {
            kuksaRunning: this.kuksaRunning,
            kitManagerRunning: this.kitManagerRunning,
            allServicesReady: this.kuksaRunning && this.kitManagerRunning
        };

        console.log('\n📊 Service Status Summary:');
        console.log(`   Kuksa Databroker: ${status.kuksaRunning ? '✅ Running' : '❌ Not available'}`);
        console.log(`   Kit Manager: ${status.kitManagerRunning ? '✅ Running' : '❌ Not available'}`);
        console.log(`   Overall: ${status.allServicesReady ? '✅ All services ready' : '⚠️ Some services missing'}`);
        console.log('');

        return status;
    }

    /**
     * Ensure all services are running before proceeding with tests
     * Throws an error if critical services are not available
     */
    async ensureServicesReady() {
        const status = await this.runPrerequisiteChecks();

        if (!status.allServicesReady) {
            const missingServices = [];
            if (!status.kuksaRunning) missingServices.push('Kuksa databroker');
            if (!status.kitManagerRunning) missingServices.push('Kit Manager');

            console.log(`\n❌ Critical services not available: ${missingServices.join(', ')}`);
            console.log('Please check the service logs and ensure all dependencies are running.');
            console.log('');
            console.log('Manual startup commands:');
            console.log('  Kuksa: ./simulation/6-start-kuksa-server.sh');
            console.log('  Kit Manager: ./simulation/1-start-kit-manager.sh');
            console.log('');

            throw new Error(`Missing required services: ${missingServices.join(', ')}`);
        }

        console.log('🎉 All prerequisite services are ready for Docker testing!\n');
        return status;
    }
}

// Export singleton instance
export const dockerTestSetup = new DockerTestSetup();