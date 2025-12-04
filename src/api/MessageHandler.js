/**
 * Message Handler
 * Processes WebSocket messages and implements the Vehicle Edge Runtime protocol
 */

import { Logger } from '../utils/Logger.js';
import { v4 as uuidv4 } from 'uuid';

export class MessageHandler {
    constructor(runtime) {
        this.runtime = runtime;
        this.logger = new Logger('MessageHandler', runtime.options.logLevel);
    }

    async processMessage(clientId, message) {
        switch (message.type) {
            case 'register_kit':
                return await this.handleRegisterKit(message);
            case 'register_client':
                return await this.handleRegisterClient(clientId, message);
            case 'list-all-kits':
                return await this.handleListAllKits(message);
            case 'run_python_app':
                return await this.handleRunPythonApp(message);
            case 'run_binary_app':
                return await this.handleRunBinaryApp(message);
            case 'stop_app':
                return await this.handleStopApp(message);
            case 'get_app_status':
                return await this.handleGetAppStatus(message);
            case 'app_output':
                return await this.handleAppOutput(message);
            case 'app_log':
                return await this.handleAppLog(message);
            case 'console_subscribe':
                return await this.handleConsoleSubscribe(clientId, message);
            case 'console_unsubscribe':
                return await this.handleConsoleUnsubscribe(clientId, message);
            case 'report-runtime-state':
                return await this.handleReportRuntimeState(message);
            case 'ping':
                return { type: 'pong', timestamp: new Date().toISOString() };
            default:
                this.logger.warn('Unknown message type', { type: message.type });
                return {
                    type: 'error',
                    error: `Unknown message type: ${message.type}`,
                    timestamp: new Date().toISOString()
                };
        }
    }

    async handleRegisterKit(message) {
        this.logger.info('Registering kit', { kitInfo: message.kitInfo });

        try {
            const kit = await this.runtime.registerKit(message.kitInfo || {});

            return {
                type: 'kit_registered',
                kit,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to register kit', { error: error.message });
            return {
                type: 'error',
                error: 'Failed to register kit: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleRegisterClient(clientId, message) {
        this.logger.info('Registering client', { clientId, clientInfo: message.clientInfo });

        return {
            type: 'client_registered',
            clientId,
            runtimeId: this.runtime.runtimeId,
            capabilities: this.runtime.registry.getCapabilities(),
            timestamp: new Date().toISOString()
        };
    }

    async handleListAllKits(message) {
        this.logger.info('Listing all registered kits');

        const kits = Array.from(this.runtime.registeredKits.values());

        return {
            type: 'kits_list',
            kits,
            count: kits.length,
            timestamp: new Date().toISOString()
        };
    }

    async handleRunPythonApp(message) {
        const { appId, code, entryPoint, env, workingDir } = message;

        this.logger.info('Running Python application', { appId });

        try {
            const executionId = uuidv4();
            const result = await this.runtime.appManager.runPythonApp({
                executionId,
                appId,
                code,
                entryPoint: entryPoint || 'main.py',
                env: env || {},
                workingDir: workingDir || '/app'
            });

            return {
                type: 'python_app_started',
                executionId,
                appId,
                status: result.status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to run Python app', { appId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to run Python app: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleRunBinaryApp(message) {
        const { appId, binaryPath, args, env, workingDir } = message;

        this.logger.info('Running binary application', { appId, binaryPath });

        try {
            const executionId = uuidv4();
            const result = await this.runtime.appManager.runBinaryApp({
                executionId,
                appId,
                binaryPath,
                args: args || [],
                env: env || {},
                workingDir: workingDir || '/app'
            });

            return {
                type: 'binary_app_started',
                executionId,
                appId,
                status: result.status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to run binary app', { appId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to run binary app: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleStopApp(message) {
        const { executionId } = message;

        this.logger.info('Stopping application', { executionId });

        try {
            const result = await this.runtime.appManager.stopApplication(executionId);

            return {
                type: 'app_stopped',
                executionId,
                status: result.status,
                exitCode: result.exitCode,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to stop app', { executionId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to stop app: ' + error.message,
                executionId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleGetAppStatus(message) {
        const { executionId } = message;

        this.logger.debug('Getting application status', { executionId });

        try {
            const status = await this.runtime.appManager.getApplicationStatus(executionId);

            return {
                type: 'app_status',
                executionId,
                status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get app status', { executionId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to get app status: ' + error.message,
                executionId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleAppOutput(message) {
        const { executionId, lines = 100 } = message;

        this.logger.debug('Getting application output', { executionId, lines });

        try {
            const output = await this.runtime.consoleManager.getAppOutput(executionId, lines);

            return {
                type: 'app_output_response',
                executionId,
                output,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get app output', { executionId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to get app output: ' + error.message,
                executionId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleAppLog(message) {
        const { executionId, lines = 100 } = message;

        this.logger.debug('Getting application logs', { executionId, lines });

        try {
            const logs = await this.runtime.consoleManager.getAppLogs(executionId, lines);

            return {
                type: 'app_log_response',
                executionId,
                logs,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get app logs', { executionId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to get app logs: ' + error.message,
                executionId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleConsoleSubscribe(clientId, message) {
        const { executionId } = message;

        this.logger.info('Subscribing to console output', { clientId, executionId });

        try {
            await this.runtime.consoleManager.subscribe(clientId, executionId);

            return {
                type: 'console_subscribed',
                clientId,
                executionId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to subscribe to console', { clientId, executionId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to subscribe to console: ' + error.message,
                executionId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleConsoleUnsubscribe(clientId, message) {
        const { executionId } = message;

        this.logger.info('Unsubscribing from console output', { clientId, executionId });

        try {
            await this.runtime.consoleManager.unsubscribe(clientId, executionId);

            return {
                type: 'console_unsubscribed',
                clientId,
                executionId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to unsubscribe from console', { clientId, executionId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to unsubscribe from console: ' + error.message,
                executionId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleReportRuntimeState(message) {
        this.logger.debug('Reporting runtime state');

        const state = this.runtime.getStatus();
        const runningApps = await this.runtime.appManager.getRunningApplications();

        return {
            type: 'runtime_state_response',
            runtimeState: {
                ...state,
                runningApplications: runningApps.map(app => ({
                    executionId: app.executionId,
                    appId: app.appId,
                    status: app.status,
                    startTime: app.startTime,
                    uptime: app.uptime
                }))
            },
            timestamp: new Date().toISOString()
        };
    }
}