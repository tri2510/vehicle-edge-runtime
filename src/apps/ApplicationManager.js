/**
 * Application Manager
 * Manages application execution, lifecycle, and storage
 */

import { Logger } from '../utils/Logger.js';
import Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';

export class ApplicationManager {
    constructor(options = {}) {
        this.options = options;
        this.logger = new Logger('ApplicationManager', options.logLevel);
        this.docker = new Docker();
        this.applications = new Map(); // executionId -> app info
        this.appStorage = path.join(options.dataPath || './data', 'applications');
    }

    async initialize() {
        this.logger.info('Initializing Application Manager');

        await fs.ensureDir(this.appStorage);
        await fs.ensureDir(path.join(this.appStorage, 'python'));
        await fs.ensureDir(path.join(this.appStorage, 'binary'));

        // Clean up any orphaned containers
        await this._cleanupOrphanedContainers();

        this.logger.info('Application Manager initialized');
    }

    setRuntime(runtime) {
        this.runtime = runtime;
        
        // Initialize credential manager if runtime has one
        if (runtime.credentialManager) {
            this.credentialManager = runtime.credentialManager;
        }
    }

    async runPythonApp(options) {
        const { executionId, appId, code, entryPoint, env, workingDir, vehicleId } = options;

        this.logger.info('Starting Python application', { executionId, appId, vehicleId });

        try {
            // Create application directory
            const appDir = path.join(this.appStorage, 'python', executionId);
            await fs.ensureDir(appDir);

            // Write Python code to file
            const pythonFile = path.join(appDir, entryPoint);
            await fs.writeFile(pythonFile, code);

            // Prepare container options with vehicle credentials if available
            let containerOptions = {
                executionId,
                appId,
                appDir,
                entryPoint,
                env: env || {},
                workingDir
            };

            // Inject vehicle credentials if vehicle ID is provided
            if (vehicleId && this.credentialManager) {
                try {
                    containerOptions = await this.credentialManager.injectCredentialsIntoApplication(
                        vehicleId, 
                        appId, 
                        containerOptions,
                        ['vehicle_signals', 'vehicle_actuators']
                    );
                    this.logger.info('Vehicle credentials injected', { vehicleId, appId });
                } catch (error) {
                    this.logger.warn('Failed to inject vehicle credentials', { 
                        vehicleId, 
                        appId, 
                        error: error.message 
                    });
                    // Continue without credentials rather than failing
                }
            }

            // Create Docker container
            const container = await this._createPythonContainer(containerOptions);

            // Store application info
            const appInfo = {
                executionId,
                appId,
                type: 'python',
                container,
                status: 'starting',
                startTime: new Date().toISOString(),
                entryPoint,
                appDir,
                env: env || {},
                exitCode: null
            };

            this.applications.set(executionId, appInfo);

            // Start container
            await container.start();

            appInfo.status = 'running';
            this.logger.info('Python application started', { executionId, containerId: container.id });

            // Set up output stream monitoring
            await this._setupContainerMonitoring(executionId, container);

            return {
                status: 'started',
                executionId,
                containerId: container.id
            };

        } catch (error) {
            this.logger.error('Failed to start Python application', { executionId, error: error.message });
            throw error;
        }
    }

    async runBinaryApp(options) {
        const { executionId, appId, binaryPath, args, env, workingDir, vehicleId } = options;

        this.logger.info('Starting binary application', { executionId, appId, binaryPath, vehicleId });

        try {
            // Create application directory
            const appDir = path.join(this.appStorage, 'binary', executionId);
            await fs.ensureDir(appDir);

            // Prepare container options with vehicle credentials if available
            let containerOptions = {
                executionId,
                appId,
                appDir,
                binaryPath,
                args: args || [],
                env: env || {},
                workingDir
            };

            // Inject vehicle credentials if vehicle ID is provided
            if (vehicleId && this.credentialManager) {
                try {
                    containerOptions = await this.credentialManager.injectCredentialsIntoApplication(
                        vehicleId, 
                        appId, 
                        containerOptions,
                        ['vehicle_signals', 'vehicle_actuators']
                    );
                    this.logger.info('Vehicle credentials injected', { vehicleId, appId });
                } catch (error) {
                    this.logger.warn('Failed to inject vehicle credentials', { 
                        vehicleId, 
                        appId, 
                        error: error.message 
                    });
                    // Continue without credentials rather than failing
                }
            }

            // Create Docker container for binary execution
            const container = await this._createBinaryContainer(containerOptions);

            // Store application info
            const appInfo = {
                executionId,
                appId,
                type: 'binary',
                container,
                status: 'starting',
                startTime: new Date().toISOString(),
                binaryPath,
                args: args || [],
                appDir,
                env: env || {},
                exitCode: null
            };

            this.applications.set(executionId, appInfo);

            // Start container
            await container.start();

            appInfo.status = 'running';
            this.logger.info('Binary application started', { executionId, containerId: container.id });

            // Set up output stream monitoring
            await this._setupContainerMonitoring(executionId, container);

            return {
                status: 'started',
                executionId,
                containerId: container.id
            };

        } catch (error) {
            this.logger.error('Failed to start binary application', { executionId, error: error.message });
            throw error;
        }
    }

    async stopApplication(executionId) {
        const appInfo = this.applications.get(executionId);
        if (!appInfo) {
            throw new Error(`Application not found: ${executionId}`);
        }

        this.logger.info('Stopping application', { executionId });

        try {
            if (appInfo.container) {
                // Stop container
                await appInfo.container.stop({ t: 10 });

                // Get exit code
                const containerInfo = await appInfo.container.inspect();
                appInfo.exitCode = containerInfo.State.ExitCode;

                // Remove container
                await appInfo.container.remove({ force: true });

                // Clean up application directory
                await fs.remove(appInfo.appDir);
            }

            appInfo.status = 'stopped';
            appInfo.endTime = new Date().toISOString();

            this.logger.info('Application stopped', { executionId, exitCode: appInfo.exitCode });

            return {
                status: 'stopped',
                executionId,
                exitCode: appInfo.exitCode
            };

        } catch (error) {
            this.logger.error('Failed to stop application', { executionId, error: error.message });
            throw error;
        }
    }

    async getApplicationStatus(executionId) {
        const appInfo = this.applications.get(executionId);
        if (!appInfo) {
            throw new Error(`Application not found: ${executionId}`);
        }

        // Update container status if still running
        if (appInfo.container && appInfo.status === 'running') {
            try {
                const containerInfo = await appInfo.container.inspect();
                if (containerInfo.State.Status === 'exited') {
                    appInfo.status = 'exited';
                    appInfo.exitCode = containerInfo.State.ExitCode;
                    appInfo.endTime = new Date().toISOString();
                }
            } catch (error) {
                this.logger.warn('Failed to inspect container', { executionId, error: error.message });
                appInfo.status = 'error';
            }
        }

        return {
            executionId,
            appId: appInfo.appId,
            type: appInfo.type,
            status: appInfo.status,
            startTime: appInfo.startTime,
            endTime: appInfo.endTime,
            exitCode: appInfo.exitCode,
            uptime: appInfo.startTime ? Date.now() - new Date(appInfo.startTime).getTime() : 0
        };
    }

    async getRunningApplications() {
        const runningApps = [];

        for (const [executionId, appInfo] of this.applications) {
            try {
                const status = await this.getApplicationStatus(executionId);
                if (status.status === 'running') {
                    runningApps.push(status);
                }
            } catch (error) {
                this.logger.warn('Failed to get status for application', { executionId, error: error.message });
            }
        }

        return runningApps;
    }

    async stopAllApplications() {
        this.logger.info('Stopping all applications');

        const stopPromises = [];
        for (const executionId of this.applications.keys()) {
            stopPromises.push(this.stopApplication(executionId).catch(error => {
                this.logger.error('Failed to stop application', { executionId, error: error.message });
            }));
        }

        await Promise.all(stopPromises);
        this.logger.info('All applications stopped');
    }

    // Private methods

    async _createPythonContainer(options) {
        const { executionId, appId, appDir, entryPoint, env, workingDir } = options;

        // Sanitize executionId for Docker names (remove hyphens)
        const sanitizedId = executionId.replace(/-/g, '');

        // Create container configuration
        const containerConfig = {
            Image: 'python:3.11-slim',
            WorkingDir: workingDir,
            Cmd: ['python', entryPoint],
            Env: [
                'PYTHONUNBUFFERED=1',
                'APP_ID=' + appId,
                'EXECUTION_ID=' + executionId,
                ...Object.entries(env).map(([key, value]) => `${key}=${value}`)
            ],
            HostConfig: {
                Binds: [`${path.resolve(appDir)}:${workingDir}`],
                Memory: 512 * 1024 * 1024, // 512MB limit
                CpuQuota: 50000, // 50% CPU limit
                NetworkMode: 'bridge',
                ReadonlyRootfs: false,
                Tmpfs: {
                    '/tmp': 'rw,noexec,nosuid,size=100m'
                }
            },
            name: `vehicle-edge-app-${sanitizedId}`,
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        };

        const container = await this.docker.createContainer(containerConfig);
        this.logger.debug('Python container created', { executionId, containerId: container.id });

        return container;
    }

    async _createBinaryContainer(options) {
        const { executionId, appId, appDir, binaryPath, args, env, workingDir } = options;

        // Sanitize executionId for Docker names (remove hyphens)
        const sanitizedId = executionId.replace(/-/g, '');

        // Create container configuration
        const containerConfig = {
            Image: 'alpine:latest',
            WorkingDir: workingDir,
            Cmd: [binaryPath, ...args],
            Env: [
                'APP_ID=' + appId,
                'EXECUTION_ID=' + executionId,
                ...Object.entries(env).map(([key, value]) => `${key}=${value}`)
            ],
            HostConfig: {
                Binds: [`${path.resolve(appDir)}:${workingDir}`],
                Memory: 512 * 1024 * 1024, // 512MB limit
                CpuQuota: 50000, // 50% CPU limit
                NetworkMode: 'bridge',
                ReadonlyRootfs: false,
                Tmpfs: {
                    '/tmp': 'rw,noexec,nosuid,size=100m'
                }
            },
            name: `vehicle-edge-app-${sanitizedId}`,
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        };

        const container = await this.docker.createContainer(containerConfig);
        this.logger.debug('Binary container created', { executionId, containerId: container.id });

        return container;
    }

    async _setupContainerMonitoring(executionId, container) {
        this.logger.debug('Setting up container monitoring', { executionId });

        try {
            // Monitor stdout
            const stdoutStream = await container.attach({
                stream: true,
                stdout: true,
                stderr: false
            });

            // Monitor stderr
            const stderrStream = await container.attach({
                stream: true,
                stdout: false,
                stderr: true
            });

            // Forward output to console manager
            stdoutStream.on('data', (chunk) => {
                const output = chunk.toString();
                this.runtime?.consoleManager?.addConsoleOutput(executionId, 'stdout', output);
            });

            stderrStream.on('data', (chunk) => {
                const output = chunk.toString();
                this.runtime?.consoleManager?.addConsoleOutput(executionId, 'stderr', output);
            });

            // Monitor container exit
            container.wait().then((data) => {
                this.logger.info('Container exited', { executionId, exitCode: data.StatusCode });

                const appInfo = this.applications.get(executionId);
                if (appInfo) {
                    appInfo.status = 'exited';
                    appInfo.exitCode = data.StatusCode;
                    appInfo.endTime = new Date().toISOString();
                }
            }).catch((error) => {
                this.logger.error('Error waiting for container', { executionId, error: error.message });
            });

        } catch (error) {
            this.logger.error('Failed to setup container monitoring', { executionId, error: error.message });
        }
    }

    async _cleanupOrphanedContainers() {
        this.logger.info('Cleaning up orphaned containers');

        try {
            const containers = await this.docker.listContainers({ all: true });

            for (const container of containers) {
                if (container.Names.some(name => name.includes('/vehicle-edge-app-'))) {
                    const containerId = container.Id;
                    this.logger.debug('Found orphaned container', { containerId });

                    try {
                        const c = this.docker.getContainer(containerId);
                        if (container.State === 'running') {
                            await c.stop({ t: 5 });
                        }
                        await c.remove({ force: true });
                        this.logger.debug('Removed orphaned container', { containerId });
                    } catch (error) {
                        this.logger.warn('Failed to remove orphaned container', { containerId, error: error.message });
                    }
                }
            }
        } catch (error) {
            this.logger.warn('Failed to list containers for cleanup', { error: error.message });
        }
    }
}