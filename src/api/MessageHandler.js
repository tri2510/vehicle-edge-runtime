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
            case 'subscribe_apis':
                return await this.handleSubscribeApis(clientId, message);
            case 'write_signals_value':
                return await this.handleWriteSignalsValue(message);
            case 'get_signals_value':
                return await this.handleGetSignalsValue(message);
            case 'generate_vehicle_model':
                return await this.handleGenerateVehicleModel(message);
            case 'revert_vehicle_model':
                return await this.handleRevertVehicleModel(message);
            case 'list_mock_signal':
                return await this.handleListMockSignal(message);
            case 'set_mock_signals':
                return await this.handleSetMockSignals(message);
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

    // Vehicle Signal Handlers

    async handleSubscribeApis(clientId, message) {
        const { apis } = message;

        if (!this.runtime.kuksaManager) {
            return {
                type: 'error',
                error: 'Kuksa manager not available',
                timestamp: new Date().toISOString()
            };
        }

        this.logger.info('Subscribing to vehicle APIs', { clientId, apis });

        try {
            const subscriptionId = await this.runtime.kuksaManager.subscribeToSignals(apis);

            // Store subscription for this client
            if (!this.runtime.apiSubscriptions) {
                this.runtime.apiSubscriptions = new Map();
            }
            this.runtime.apiSubscriptions.set(clientId, {
                subscriptionId,
                apis,
                subscribedAt: new Date()
            });

            return {
                type: 'apis_subscribed',
                subscriptionId,
                apis,
                kit_id: this.runtime.runtimeId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to subscribe to APIs', { clientId, apis, error: error.message });
            return {
                type: 'error',
                error: 'Failed to subscribe to APIs: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleWriteSignalsValue(message) {
        const { data } = message;

        if (!this.runtime.kuksaManager) {
            return {
                type: 'error',
                error: 'Kuksa manager not available',
                timestamp: new Date().toISOString()
            };
        }

        this.logger.info('Writing vehicle signal values', { signalUpdates: Object.keys(data) });

        try {
            const response = await this.runtime.kuksaManager.setSignalValues(data);

            return {
                type: 'signals_written',
                response,
                kit_id: this.runtime.runtimeId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to write signal values', { error: error.message });
            return {
                type: 'error',
                error: 'Failed to write signal values: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleGetSignalsValue(message) {
        const { apis } = message;

        if (!this.runtime.kuksaManager) {
            return {
                type: 'error',
                error: 'Kuksa manager not available',
                timestamp: new Date().toISOString()
            };
        }

        this.logger.info('Getting vehicle signal values', { apis });

        try {
            const values = await this.runtime.kuksaManager.getSignalValues(apis);

            return {
                type: 'signals_value_response',
                result: values,
                kit_id: this.runtime.runtimeId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get signal values', { apis, error: error.message });
            return {
                type: 'error',
                error: 'Failed to get signal values: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleGenerateVehicleModel(message) {
        const { data } = message;

        this.logger.info('Generating vehicle model', { vssData: data });

        try {
            const fs = await import('fs-extra');
            const vssPath = `${this.runtime.options.dataPath}/configs/vss.json`;

            // Parse and validate VSS data
            const vssData = JSON.parse(data);
            await fs.writeFile(vssPath, JSON.stringify(vssData, null, 2));

            // Reload VSS in Kuksa manager
            if (this.runtime.kuksaManager) {
                await this.runtime.kuksaManager._loadVSSConfiguration();
            }

            return {
                type: 'vehicle_model_generated',
                success: true,
                vssPath,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to generate vehicle model', { error: error.message });
            return {
                type: 'error',
                error: 'Failed to generate vehicle model: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleRevertVehicleModel(message) {
        this.logger.info('Reverting vehicle model to default');

        try {
            // Create default VSS again
            if (this.runtime.kuksaManager) {
                this.runtime.kuksaManager.vssData = this.runtime.kuksaManager._createDefaultVSS();

                const fs = await import('fs-extra');
                const vssPath = `${this.runtime.options.dataPath}/configs/vss.json`;
                await fs.writeFile(vssPath, JSON.stringify(this.runtime.kuksaManager.vssData, null, 2));
            }

            return {
                type: 'vehicle_model_reverted',
                success: true,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to revert vehicle model', { error: error.message });
            return {
                type: 'error',
                error: 'Failed to revert vehicle model: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleListMockSignal(message) {
        this.logger.info('Listing mock signals');

        try {
            const vssTree = this.runtime.kuksaManager?.getVSSTree();
            const cachedValues = this.runtime.kuksaManager?.getCachedSignalValues() || {};

            // Format mock signals list
            const mockSignals = [];
            if (vssTree) {
                this._extractSignalsFromVSS(vssTree, '', mockSignals);
            }

            return {
                type: 'mock_signal_list',
                data: mockSignals.map(signal => ({
                    ...signal,
                    value: cachedValues[signal.path]?.value || null
                })),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to list mock signals', { error: error.message });
            return {
                type: 'error',
                error: 'Failed to list mock signals: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleSetMockSignals(message) {
        const { data } = message;

        if (!this.runtime.kuksaManager) {
            return {
                type: 'error',
                error: 'Kuksa manager not available',
                timestamp: new Date().toISOString()
            };
        }

        this.logger.info('Setting mock signals', { signalCount: data.length });

        try {
            const signalUpdates = {};
            for (const signal of data) {
                signalUpdates[signal.name] = signal.value;
            }

            await this.runtime.kuksaManager.setSignalValues(signalUpdates);

            return {
                type: 'mock_signals_set',
                success: true,
                signalCount: data.length,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to set mock signals', { error: error.message });
            return {
                type: 'error',
                error: 'Failed to set mock signals: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    _extractSignalsFromVSS(vssNode, basePath, signals) {
        for (const [key, value] of Object.entries(vssNode)) {
            const path = basePath ? `${basePath}.${key}` : key;

            if (value.datatype) {
                // This is a signal
                signals.push({
                    path,
                    name: path,
                    datatype: value.datatype,
                    type: value.type,
                    unit: value.unit,
                    description: value.description,
                    min: value.min,
                    max: value.max
                });
            } else if (typeof value === 'object') {
                // This is a branch, recurse
                this._extractSignalsFromVSS(value, path, signals);
            }
        }
    }
}