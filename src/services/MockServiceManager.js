/**
 * Mock Service Manager
 * Manages the mock service container lifecycle and configuration with database integration
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
        this.db = null; // Will be set by setDatabase()
    }

    /**
     * Set database manager for integration
     */
    setDatabase(db) {
        this.db = db;
        this.logger.info('Database manager set for MockServiceManager');
    }

    /**
     * Ensure mock service exists in database
     */
    async ensureDatabaseEntry() {
        if (!this.db) {
            this.logger.warn('No database manager available');
            return;
        }

        try {
            // Check if app already exists in database
            const existingApp = await this.db.getApplication(this.appId);

            if (!existingApp) {
                // Create database entry for mock service
                await this.db.createApplication({
                    id: this.appId,
                    name: 'VEA Mock Service',
                    version: '1.0.0',
                    description: 'Vehicle signal mock service for testing without hardware',
                    type: 'mock-service',
                    code: '',
                    entry_point: 'simple_mock.py',
                    status: 'installed',
                    vehicle_signals: [],
                    python_deps: ['kuksa_client==0.4.3']
                });

                this.logger.info('Mock service registered in database', { appId: this.appId });
            } else {
                this.logger.debug('Mock service already in database', { appId: this.appId });
            }
        } catch (error) {
            this.logger.error('Failed to ensure database entry', { error: error.message });
        }
    }

    /**
     * Update status in database
     */
    async updateDatabaseStatus(status, containerId = null) {
        if (!this.db) {
            return;
        }

        try {
            const updateData = {
                status: status
            };

            if (containerId) {
                updateData.container_id = containerId;
            }

            await this.db.updateApplication(this.appId, updateData);
            this.logger.debug('Database status updated', { appId: this.appId, status });
        } catch (error) {
            this.logger.error('Failed to update database status', { error: error.message });
        }
    }

    /**
     * Add log entry to database
     */
    async addDatabaseLog(level, message) {
        if (!this.db) {
            return;
        }

        try {
            await this.db.addLog(this.appId, level, message, level);
        } catch (error) {
            this.logger.error('Failed to add log to database', { error: error.message });
        }
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
            // Ensure database entry exists
            await this.ensureDatabaseEntry();
            await this.addDatabaseLog('status', `Starting mock service in ${mode} mode`);
            await this.updateDatabaseStatus('starting');

            // Check if image exists
            const imageExists = await this._checkImageExists();
            if (!imageExists) {
                this.logger.error('Mock service image not found', { image: this.imageName });
                await this.addDatabaseLog('error', 'Docker image not found');
                await this.updateDatabaseStatus('error');
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
                    await this.addDatabaseLog('warning', 'Mock service already running');
                    return {
                        success: false,
                        message: 'Mock service is already running',
                        status: await this.getStatus()
                    };
                }
                // Remove stopped container
                await existingContainer.remove();
                this.logger.info('Removed existing stopped container');
                await this.addDatabaseLog('status', 'Removed existing stopped container');
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

            // Update database
            await this.updateDatabaseStatus('running', this.containerName);
            await this.addDatabaseLog('status', `Mock service started in ${mode} mode`);

            return {
                success: true,
                message: `Mock service started in ${mode} mode`,
                status: await this.getStatus()
            };

        } catch (error) {
            this.logger.error('Failed to start mock service', { error: error.message });
            await this.addDatabaseLog('error', `Failed to start: ${error.message}`);
            await this.updateDatabaseStatus('error');
            throw error;
        }
    }

    /**
     * Stop mock service
     */
    async stop() {
        this.logger.info('Stopping mock service');

        try {
            await this.addDatabaseLog('status', 'Stopping mock service');
            await this.updateDatabaseStatus('stopping');

            const container = this.docker.getContainer(this.containerName);
            await container.stop({ t: 10 }); // 10 second grace period
            await container.remove();

            this.logger.info('✅ Mock service stopped and removed');

            // Update database
            await this.updateDatabaseStatus('stopped');
            await this.addDatabaseLog('status', 'Mock service stopped successfully');

            return {
                success: true,
                message: 'Mock service stopped successfully'
            };

        } catch (error) {
            if (error.statusCode === 404) {
                this.logger.warn('Mock service container not found', { error: error.message });
                await this.updateDatabaseStatus('stopped');
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
