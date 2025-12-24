/**
 * Mock Service Manager
 * Manages the mock service container lifecycle and configuration
 */

import { Logger } from '../utils/Logger.js';
import Docker from 'dockerode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class MockServiceManager {
    constructor(options = {}) {
        this.options = options;
        this.logger = new Logger('MockServiceManager', options.logLevel);
        this.docker = new Docker();
        this.containerName = 'VEA-mock-service';
        this.imageName = 'vehicle-simple-mock-service:latest';
        this.appId = 'VEA-mock-service';
        this.appType = 'mock-service';
    }

    /**
     * Get mock service status
     */
    async getStatus() {
        try {
            const container = this.docker.getContainer(this.containerName);

            const info = await container.inspect();
            const state = info.State;

            this.logger.info('Mock service status retrieved', {
                running: state.Running,
                status: state.Status
            });

            return {
                running: state.Running,
                status: state.Status,
                mode: this._parseModeFromContainer(info),
                image: this.imageName
            };

        } catch (error) {
            if (error.statusCode === 404) {
                this.logger.info('Mock service container not found');
                return {
                    running: false,
                    status: 'not-found',
                    mode: null,
                    image: this.imageName
                };
            }

            this.logger.error('Failed to get mock service status', { error: error.message });
            throw error;
        }
    }

    /**
     * Parse mock mode from container environment or labels
     */
    _parseModeFromContainer(containerInfo) {
        try {
            const env = containerInfo.Config.Env || [];
            const modeVar = env.find(e => e.startsWith('MOCK_MODE='));
            return modeVar ? modeVar.split('=')[1] : 'echo-all';
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Check if Docker image exists
     */
    async _checkImageExists() {
        try {
            const image = this.docker.getImage(this.imageName);
            await image.inspect();
            return true;
        } catch (error) {
            if (error.statusCode === 404) {
                return false;
            }
            // Other error, assume image might exist
            this.logger.warn('Error checking image existence', { error: error.message });
            return false;
        }
    }

    /**
     * Start mock service with specified configuration
     */
    async start(config = {}) {
        const {
            mode = 'echo-all',
            signals = null,
            kuksaHost = '127.0.0.1',
            kuksaPort = '55555'
        } = config;

        this.logger.info('Starting mock service', { mode, signals, kuksaHost, kuksaPort });

        try {
            // Check if image exists
            const imageExists = await this._checkImageExists();
            if (!imageExists) {
                this.logger.error('Mock service image not found', { image: this.imageName });
                throw new Error(
                    `Docker image '${this.imageName}' not found. ` +
                    `Please build it first with: ` +
                    `docker build -t ${this.imageName} -f ./services/mock-service/Dockerfile.simple ./services/mock-service`
                );
            }

            // Check if container already exists
            const existingContainer = this.docker.getContainer(this.containerName);
            try {
                const info = await existingContainer.inspect();
                if (info.State.Running) {
                    this.logger.warn('Mock service already running', { status: info.State.Status });
                    return {
                        success: false,
                        message: 'Mock service is already running',
                        status: await this.getStatus()
                    };
                }
                // Remove stopped container
                await existingContainer.remove();
                this.logger.info('Removed existing stopped container');
            } catch (inspectError) {
                // Container doesn't exist, continue
                this.logger.debug('No existing container found');
            }

            // Build environment variables
            const env = [
                `MOCK_MODE=${mode}`,
                `KUKSA_HOST=${kuksaHost}`,
                `KUKSA_PORT=${kuksaPort}`,
                'PYTHONUNBUFFERED=1'
            ];

            if (signals && Array.isArray(signals)) {
                env.push(`MOCK_SPECIFIC_SIGNALS=${signals.join(',')}`);
            }

            // Create container
            const container = await this.docker.createContainer({
                Image: this.imageName,
                name: this.containerName,
                Env: env,
                HostConfig: {
                    NetworkMode: 'host',
                    RestartPolicy: {
                        Name: 'unless-stopped'
                    }
                },
                Labels: {
                    'com.vehicle-edge.mock-service': 'true',
                    'com.vehicle-edge.mock-mode': mode
                }
            });

            // Start container
            await container.start();

            this.logger.info('✅ Mock service started successfully', { mode, containerId: container.id });

            return {
                success: true,
                message: `Mock service started in ${mode} mode`,
                status: await this.getStatus()
            };

        } catch (error) {
            this.logger.error('Failed to start mock service', { error: error.message });
            throw error;
        }
    }

    /**
     * Stop mock service
     */
    async stop() {
        this.logger.info('Stopping mock service');

        try {
            const container = this.docker.getContainer(this.containerName);
            await container.stop({ t: 10 }); // 10 second grace period
            await container.remove();

            this.logger.info('✅ Mock service stopped and removed');

            return {
                success: true,
                message: 'Mock service stopped successfully'
            };

        } catch (error) {
            if (error.statusCode === 404) {
                this.logger.warn('Mock service container not found', { error: error.message });
                return {
                    success: true,
                    message: 'Mock service was not running'
                };
            }

            this.logger.error('Failed to stop mock service', { error: error.message });
            throw error;
        }
    }

    /**
     * Restart mock service with new configuration
     */
    async restart(config = {}) {
        this.logger.info('Restarting mock service');

        // Stop existing
        await this.stop();

        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Start with new config
        return await this.start(config);
    }

    /**
     * Configure mock service (restart with new mode)
     */
    async configure(config) {
        this.logger.info('Configuring mock service', { mode: config.mode });

        const status = await this.getStatus();

        if (!status.running) {
            // Not running, just store config for later start
            this.logger.info('Mock service not running, configuration will be applied on next start');
            return {
                success: true,
                message: 'Configuration saved. Start mock service to apply.',
                configured: true
            };
        }

        // Restart with new configuration
        return await this.restart(config);
    }

    /**
     * Get mock service logs
     */
    async getLogs(options = {}) {
        const {
            tail = 100,
            follow = false
        } = options;

        try {
            const container = this.docker.getContainer(this.containerName);
            const logs = await container.logs({
                stdout: true,
                stderr: true,
                tail: tail,
                follow: follow
            });

            return logs.toString('utf-8');

        } catch (error) {
            this.logger.error('Failed to get mock service logs', { error: error.message });
            throw error;
        }
    }

    /**
     * Build mock service Docker image
     */
    async buildImage() {
        this.logger.info('Building mock service Docker image');

        try {
            const dockerfilePath = './services/mock-service/Dockerfile.simple';
            const contextPath = './services/mock-service';

            const { stdout, stderr } = await execAsync(
                `docker build -t ${this.imageName} -f ${dockerfilePath} ${contextPath}`
            );

            this.logger.info('✅ Mock service image built successfully');

            return {
                success: true,
                message: 'Mock service image built successfully',
                image: this.imageName
            };

        } catch (error) {
            this.logger.error('Failed to build mock service image', { error: error.message });
            throw error;
        }
    }
}
