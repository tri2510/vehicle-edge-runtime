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
            case 'run_rust_app':
                return await this.handleRunRustApp(message);
            case 'run_cpp_app':
                return await this.handleRunCppApp(message);
            case 'stop_app':
                return await this.handleStopApp(message);
            case 'pause_app':
                return await this.handlePauseApp(message);
            case 'resume_app':
                return await this.handleResumeApp(message);
            case 'install_app':
                return await this.handleInstallApp(message);
            case 'uninstall_app':
                return await this.handleUninstallApp(message);
            case 'get_app_status':
                return await this.handleGetAppStatus(message);
            case 'list_apps':
                return await this.handleListApps(message);
            case 'get_app_logs':
                return await this.handleGetAppLogs(message);
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
            case 'deploy_request':
            case 'deploy-request':
                return await this.handleDeployRequest(message);
            case 'list_deployed_apps':
                return await this.handleListDeployedApps(message);
            case 'manage_app':
                return await this.handleManageApp(message);
            case 'check_signal_conflicts':
                return await this.handleCheckSignalConflicts(message);
            case 'get_vss_config':
                return await this.handleGetVssConfig(message);
            case 'get-runtime-info':
            case 'get_runtime_info':
                return await this.handleGetRuntimeInfo(message);
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
        const { appId, code, entryPoint, env, workingDir, vehicleId } = message;

        this.logger.info('Running Python application', { appId, vehicleId });

        try {
            const executionId = uuidv4();
            const result = await this.runtime.appManager.runPythonApp({
                executionId,
                appId,
                code,
                entryPoint: entryPoint || 'main.py',
                env: env || {},
                workingDir: workingDir || '/app',
                vehicleId
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
        const { appId, binaryPath, args, env, workingDir, vehicleId } = message;

        this.logger.info('Running binary application', { appId, binaryPath, vehicleId });

        try {
            const executionId = uuidv4();
            const result = await this.runtime.appManager.runBinaryApp({
                executionId,
                appId,
                binaryPath,
                args: args || [],
                env: env || {},
                workingDir: workingDir || '/app',
                vehicleId
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

    // Additional Command Handlers for Frontend Compatibility

    async handleRunRustApp(message) {
        // For simplified runtime, we treat Rust apps as binary apps
        // Frontend should handle compilation itself
        this.logger.info('Running Rust application (treated as binary)', { appId: message.appId });
        
        // Convert to binary app execution
        return await this.handleRunBinaryApp({
            ...message,
            binaryPath: '/app/target/release/app',
            env: {
                ...message.env,
                RUST_LOG: 'info'
            }
        });
    }

    async handleRunCppApp(message) {
        // For simplified runtime, we treat C++ apps as binary apps
        // Frontend should handle compilation itself
        this.logger.info('Running C++ application (treated as binary)', { appId: message.appId });
        
        // Convert to binary app execution
        return await this.handleRunBinaryApp({
            ...message,
            binaryPath: '/app/build/app',
            env: message.env
        });
    }

    async handleDeployRequest(message) {
        const { code, prototype, username, disable_code_convert = false, vehicleId } = message;
        
        this.logger.info('Processing deploy request', { 
            appId: prototype?.id || 'unknown', 
            appName: prototype?.name,
            disable_code_convert,
            vehicleId
        });

        try {
            // For simplified runtime, deploy_request just runs the app directly
            // Frontend handles the code conversion
            const executionId = uuidv4();
            const appId = prototype?.id || `deploy_${Date.now()}`;
            
            // Determine app type and run accordingly
            let result;
            if (prototype?.language === 'python' || code.includes('import ') || code.includes('def ')) {
                result = await this.runtime.appManager.runPythonApp({
                    executionId,
                    appId,
                    code: disable_code_convert ? code : this._convertPythonCode(code),
                    entryPoint: 'main.py',
                    env: {
                        APP_NAME: prototype?.name || 'Deployed App',
                        USER_NAME: username || 'anonymous'
                    },
                    workingDir: '/app',
                    vehicleId
                });
            } else {
                // Handle as binary deployment
                result = await this.runtime.appManager.runBinaryApp({
                    executionId,
                    appId,
                    binaryPath: code, // Assume code contains binary path or URL
                    args: [],
                    env: {
                        APP_NAME: prototype?.name || 'Deployed App',
                        USER_NAME: username || 'anonymous'
                    },
                    workingDir: '/app',
                    vehicleId
                });
            }

            return {
                type: 'deploy_request-response',
                cmd: 'deploy_request',
                executionId,
                appId,
                status: result.status,
                result: 'Application deployed and started successfully',
                isDone: true,
                code: 0,
                kit_id: this.runtime.runtimeId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to deploy application', { error: error.message });
            return {
                type: 'deploy_request-response',
                cmd: 'deploy_request',
                error: 'Failed to deploy application: ' + error.message,
                isDone: true,
                code: 1,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleListDeployedApps(message) {
        this.logger.info('Listing deployed applications');

        try {
            const runningApps = await this.runtime.appManager.getRunningApplications();
            
            // Format for frontend compatibility
            const apps = runningApps.map(app => ({
                app_id: app.executionId,
                name: app.appId,
                version: '1.0.0',
                status: app.status,
                deploy_time: app.startTime,
                auto_start: true,
                resources: {
                    cpu_limit: '50%',
                    memory_limit: '512MB'
                }
            }));

            return {
                type: 'list_deployed_apps-response',
                apps,
                total_count: apps.length,
                running_count: apps.filter(app => app.status === 'running').length,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to list deployed apps', { error: error.message });
            return {
                type: 'error',
                error: 'Failed to list deployed apps: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleManageApp(message) {
        const { app_id, action, force = false } = message;

        this.logger.info('Managing application', { app_id, action });

        try {
            let result;
            
            switch (action) {
                case 'start':
                    // For simplicity, we don't support start from stopped state
                    throw new Error('Starting stopped applications not supported');
                    
                case 'stop':
                    result = await this.runtime.appManager.stopApplication(app_id);
                    break;
                    
                case 'restart':
                    // Get current app info first, then stop and restart
                    // This is a simplified implementation
                    result = await this.runtime.appManager.stopApplication(app_id);
                    // In a full implementation, we would restart with saved configuration
                    break;
                    
                case 'remove':
                    result = await this.runtime.appManager.stopApplication(app_id);
                    break;
                    
                default:
                    throw new Error(`Unknown action: ${action}`);
            }

            return {
                type: 'manage_app-response',
                app_id,
                action,
                status: result.status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to manage application', { app_id, action, error: error.message });
            return {
                type: 'error',
                error: `Failed to ${action} application: ${error.message}`,
                app_id,
                action,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleCheckSignalConflicts(message) {
        const { app_id, signals } = message;

        this.logger.info('Checking signal conflicts', { app_id, signalCount: signals?.length });

        try {
            if (!this.runtime.kuksaManager) {
                return {
                    type: 'check_signal_conflicts-response',
                    deployment_precheck: {
                        app_id,
                        signals_required: signals.map(signal => ({
                            signal: signal.signal || signal.path,
                            access: signal.access || 'read',
                            conflict: false
                        })),
                        deployment_approved: true,
                        conflicts_found: 0,
                        recommended_actions: []
                    },
                    timestamp: new Date().toISOString()
                };
            }

            // Validate signals against VSS
            const validatedSignals = [];
            for (const signal of signals) {
                const signalPath = signal.signal || signal.path;
                try {
                    await this.runtime.kuksaManager.validateSignalPaths([signalPath]);
                    validatedSignals.push({
                        signal: signalPath,
                        access: signal.access || 'read',
                        conflict: false
                    });
                } catch (error) {
                    validatedSignals.push({
                        signal: signalPath,
                        access: signal.access || 'read',
                        conflict: {
                            conflict_type: 'invalid_signal_path',
                            error: error.message,
                            can_deploy: false
                        }
                    });
                }
            }

            const conflicts = validatedSignals.filter(s => s.conflict);
            const deploymentApproved = conflicts.length === 0;

            return {
                type: 'check_signal_conflicts-response',
                deployment_precheck: {
                    app_id,
                    signals_required: validatedSignals,
                    deployment_approved: deploymentApproved,
                    conflicts_found: conflicts.length,
                    recommended_actions: conflicts.map(c => `Fix signal: ${c.signal}`)
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to check signal conflicts', { error: error.message });
            return {
                type: 'error',
                error: 'Failed to check signal conflicts: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleGetVssConfig(message) {
        this.logger.info('Getting VSS configuration');

        try {
            let vssConfig;
            
            if (this.runtime.kuksaManager) {
                vssConfig = {
                    central_vss_url: this.runtime.options.kuksaUrl || 'localhost:55555',
                    local_cache: `${this.runtime.options.dataPath}/configs/vss.json`,
                    refresh_interval: 3600,
                    fallback_config: `${this.runtime.options.dataPath}/configs/vss_backup.json`
                };
            } else {
                vssConfig = {
                    central_vss_url: null,
                    local_cache: `${this.runtime.options.dataPath}/configs/vss.json`,
                    refresh_interval: 3600,
                    fallback_config: `${this.runtime.options.dataPath}/configs/vss_backup.json`
                };
            }

            return {
                type: 'get_vss_config-response',
                vss_config: vssConfig,
                last_updated: new Date().toISOString(),
                signal_count: this.runtime.kuksaManager?.signalValues?.size || 0,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get VSS config', { error: error.message });
            return {
                type: 'error',
                error: 'Failed to get VSS config: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleGetRuntimeInfo(message) {
        this.logger.debug('Getting runtime info');

        try {
            const runningApps = await this.runtime.appManager.getRunningApplications();
            const state = this.runtime.getStatus();

            // Format for frontend compatibility
            const lsOfRunner = runningApps.map(app => ({
                appName: app.appId,
                request_from: 'frontend',
                from: new Date(app.startTime).getTime()
            }));

            const lsOfApiSubscriber = {};
            if (this.runtime.apiSubscriptions) {
                for (const [clientId, subscription] of this.runtime.apiSubscriptions) {
                    lsOfApiSubscriber[clientId] = {
                        apis: subscription.apis,
                        from: subscription.subscribedAt.getTime()
                    };
                }
            }

            return {
                type: 'get-runtime-info-response',
                kit_id: this.runtime.runtimeId,
                data: {
                    lsOfRunner,
                    lsOfApiSubscriber
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get runtime info', { error: error.message });
            return {
                type: 'error',
                error: 'Failed to get runtime info: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handlePauseApp(message) {
        const { appId } = message;

        this.logger.info('Pausing application', { appId });

        try {
            const result = await this.runtime.appManager.pauseApplication(appId);

            return {
                type: 'app_paused',
                appId,
                status: result.status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to pause app', { appId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to pause app: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleResumeApp(message) {
        const { appId } = message;

        this.logger.info('Resuming application', { appId });

        try {
            const result = await this.runtime.appManager.resumeApplication(appId);

            return {
                type: 'app_resumed',
                appId,
                status: result.status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to resume app', { appId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to resume app: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleInstallApp(message) {
        const { appData } = message;

        this.logger.info('Installing application', { appId: appData.id, name: appData.name });

        try {
            const result = await this.runtime.appManager.installApplication(appData);

            return {
                type: 'app_installed',
                appId: result.appId,
                name: result.name,
                type: result.type,
                status: result.status,
                appDir: result.appDir,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to install app', { appId: appData.id, error: error.message });
            return {
                type: 'error',
                error: 'Failed to install app: ' + error.message,
                appId: appData.id,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleUninstallApp(message) {
        const { appId } = message;

        this.logger.info('Uninstalling application', { appId });

        try {
            const result = await this.runtime.appManager.uninstallApplication(appId);

            return {
                type: 'app_uninstalled',
                appId,
                status: result.status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to uninstall app', { appId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to uninstall app: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleListApps(message) {
        const { filters = {} } = message;

        this.logger.info('Listing applications', { filters });

        try {
            const apps = await this.runtime.appManager.listApplications(filters);

            return {
                type: 'apps_listed',
                apps,
                count: apps.length,
                filters,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to list apps', { error: error.message });
            return {
                type: 'error',
                error: 'Failed to list apps: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleGetAppLogs(message) {
        const { appId, options = {} } = message;

        this.logger.info('Getting application logs', { appId, options });

        try {
            const logs = await this.runtime.appManager.getApplicationLogs(appId, options);

            return {
                type: 'app_logs',
                appId,
                logs,
                options,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get app logs', { appId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to get app logs: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Update existing handlers to use appId instead of executionId for enhanced lifecycle
    async handleStopApp(message) {
        const { appId, executionId } = message;

        this.logger.info('Stopping application', { appId, executionId });

        try {
            // For backward compatibility, try appId first, then executionId
            let result;
            if (appId) {
                result = await this.runtime.appManager.stopApplication(appId);
            } else if (executionId) {
                // Legacy support - find app by executionId
                const app = await this.runtime.appManager.getApplicationByExecutionId(executionId);
                result = await this.runtime.appManager.stopApplication(app.appId);
            } else {
                throw new Error('Either appId or executionId is required');
            }

            return {
                type: 'app_stopped',
                appId: appId || result.appId,
                executionId: executionId || result.executionId,
                status: result.status,
                exitCode: result.exitCode,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to stop app', { appId, executionId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to stop app: ' + error.message,
                appId,
                executionId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleGetAppStatus(message) {
        const { appId, executionId } = message;

        this.logger.info('Getting application status', { appId, executionId });

        try {
            // For backward compatibility, try appId first, then executionId
            let status;
            if (appId) {
                status = await this.runtime.appManager.getApplicationStatus(appId);
            } else if (executionId) {
                // Legacy support - find app by executionId
                const app = await this.runtime.appManager.getApplicationByExecutionId(executionId);
                status = await this.runtime.appManager.getApplicationStatus(app.appId);
            } else {
                throw new Error('Either appId or executionId is required');
            }

            return {
                type: 'app_status',
                status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get app status', { appId, executionId, error: error.message });
            return {
                type: 'error',
                error: 'Failed to get app status: ' + error.message,
                appId,
                executionId,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Helper method for code conversion
    _convertPythonCode(code) {
        // Simple code conversion - in real implementation this would use the converter
        // For now, just return as-is since frontend handles conversion
        return code;
    }
}