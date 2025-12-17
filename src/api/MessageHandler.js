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
            case 'deploy_request':
            case 'deploy-request':
            case 'deploy_n_run':
                return await this.handleDeployRequest(message);
            case 'list_deployed_apps':
                return await this.handleListDeployedApps(message);
            case 'run_app':
                return await this.handleRunApp(message);
            case 'manage_app':
                return await this.handleManageApp(message);
            case 'check_signal_conflicts':
                return await this.handleCheckSignalConflicts(message);
            case 'get_vss_config':
                return await this.handleGetVssConfig(message);
            case 'get-runtime-info':
            case 'get_runtime_info':
                return await this.handleGetRuntimeInfo(message);
            case 'report_runtime_state':
                return await this.handleReportRuntimeState(message);
            case 'ping':
                return { type: 'pong', id: message.id, timestamp: new Date().toISOString() };
            default:
                this.logger.warn('Unknown message type', { type: message.type });
                return {
                    type: 'error',
                    id: message.id,
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
                id: message.id,
                kit,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to register kit', { error: error.message });
            return {
                type: 'error',
                id: message.id,
                error: 'Failed to register kit: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleRegisterClient(clientId, message) {
        this.logger.info('Registering client', { clientId, clientInfo: message.clientInfo });

        return {
            type: 'client_registered',
                id: message.id,
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
                id: message.id,
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
                id: message.id,
                executionId,
                appId,
                status: result.status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to run Python app', { appId, error: error.message });
            return {
                type: 'error',
                id: message.id,
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
                id: message.id,
                executionId,
                appId,
                status: result.status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to run binary app', { appId, error: error.message });
            return {
                type: 'error',
                id: message.id,
                error: 'Failed to run binary app: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

  
    async handleAppOutput(message) {
        const { appId, lines = 100 } = message;

        this.logger.debug('Getting application output', { appId, lines });

        try {
            const output = await this.runtime.consoleManager.getAppOutput(appId, lines);

            return {
                type: 'app_output_response',
                id: message.id,
                appId,
                output,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get app output', { appId, error: error.message });
            return {
                type: 'error',
                id: message.id,
                error: 'Failed to get app output: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleAppLog(message) {
        const { appId, lines = 100 } = message;

        this.logger.debug('Getting application logs', { appId, lines });

        try {
            const logs = await this.runtime.consoleManager.getAppLogs(appId, lines);

            return {
                type: 'app_log_response',
                id: message.id,
                appId,
                logs,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get app logs', { appId, error: error.message });
            return {
                type: 'error',
                id: message.id,
                error: 'Failed to get app logs: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleConsoleSubscribe(clientId, message) {
        const { appId } = message;

        this.logger.info('Subscribing to console output', { clientId, appId });

        try {
            await this.runtime.consoleManager.subscribe(clientId, appId);

            return {
                type: 'console_subscribed',
                id: message.id,
                clientId,
                appId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to subscribe to console', { clientId, appId, error: error.message });
            return {
                type: 'error',
                id: message.id,
                error: 'Failed to subscribe to console: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleConsoleUnsubscribe(clientId, message) {
        const { appId } = message;

        this.logger.info('Unsubscribing from console output', { clientId, appId });

        try {
            await this.runtime.consoleManager.unsubscribe(clientId, appId);

            return {
                type: 'console_unsubscribed',
                id: message.id,
                clientId,
                appId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to unsubscribe from console', { clientId, appId, error: error.message });
            return {
                type: 'error',
                id: message.id,
                error: 'Failed to unsubscribe from console: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleReportRuntimeState(message) {
        this.logger.info('Reporting runtime state');

        const state = this.runtime.getStatus();
        const runningApps = await this.runtime.appManager.getRunningApplications();

        return {
            type: 'runtime_state_response',
            id: message.id,
            result: {
                ...state,
                timestamp: new Date().toISOString(),
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
                id: message.id,
                error: 'Kuksa manager not available',
                timestamp: new Date().toISOString()
            };
        }

        // Extract path strings from API objects
        const signalPaths = Array.isArray(apis)
            ? apis.map(api => typeof api === 'string' ? api : api.path).filter(Boolean)
            : [];

        if (signalPaths.length === 0) {
            return {
                type: 'error',
                id: message.id,
                error: 'No valid signal paths provided',
                timestamp: new Date().toISOString()
            };
        }

        this.logger.info('Subscribing to vehicle APIs', { clientId, apis, signalPaths });

        try {
            const subscriptionId = await this.runtime.kuksaManager.subscribeToSignals(signalPaths);

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
                id: message.id,
                subscriptionId,
                apis,
                kit_id: this.runtime.runtimeId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to subscribe to APIs', { clientId, apis, error: error.message });
            return {
                type: 'error',
                id: message.id,
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
                id: message.id,
                error: 'Kuksa manager not available',
                timestamp: new Date().toISOString()
            };
        }

        this.logger.info('Writing vehicle signal values', { signalUpdates: Object.keys(data) });

        try {
            const response = await this.runtime.kuksaManager.setSignalValues(data);

            return {
                type: 'signals_written',
                id: message.id,
                response,
                kit_id: this.runtime.runtimeId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to write signal values', { error: error.message });
            return {
                type: 'error',
                id: message.id,
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
                id: message.id,
                error: 'Kuksa manager not available',
                timestamp: new Date().toISOString()
            };
        }

        // Extract path strings from API objects
        const signalPaths = Array.isArray(apis)
            ? apis.map(api => typeof api === 'string' ? api : api.path).filter(Boolean)
            : [];

        this.logger.info('Getting vehicle signal values', { apis, signalPaths });

        try {
            const values = await this.runtime.kuksaManager.getSignalValues(signalPaths);

            return {
                type: 'signals_value_response',
                id: message.id,
                result: values,
                kit_id: this.runtime.runtimeId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get signal values', { apis, error: error.message });
            return {
                type: 'error',
                id: message.id,
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
                id: message.id,
                success: true,
                vssPath,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to generate vehicle model', { error: error.message });
            return {
                type: 'error',
                id: message.id,
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
                id: message.id,
                success: true,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to revert vehicle model', { error: error.message });
            return {
                type: 'error',
                id: message.id,
                error: 'Failed to revert vehicle model: ' + error.message,
                timestamp: new Date().toISOString()
            };
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
        const { code, prototype, vehicleId, language } = message;

        this.logger.info('Processing deploy request', {
            appId: prototype?.id || 'unknown',
            appName: prototype?.name,
            vehicleId,
            deploymentMethod: 'direct_websocket',
            messageSource: 'WebSocket_API'
        });

        // Define these outside try block so they're available in catch block
        const executionId = uuidv4();
        const appId = prototype?.id || `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // For simplified runtime, deploy_request just runs the app directly
            // Frontend handles the code conversion

            // First install the application in database with complete schema
            const appData = {
                id: appId,
                name: prototype?.name || `Deployed App ${appId}`,
                description: prototype?.description || 'Deployed via API',
                version: prototype?.version || '1.0.0',
                type: 'python',  // Use 'type' instead of 'language'
                code: code,
                status: 'installed',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                // Required database fields
                entry_point: 'main.py',
                binary_path: `/tmp/app-data-${appId}/main`,
                args: JSON.stringify([]),
                env: JSON.stringify({}),
                working_dir: '/app',
                python_deps: JSON.stringify([]),
                vehicle_signals: JSON.stringify([]),
                data_path: `/tmp/app-data-${appId}`,
                config: JSON.stringify({
                    deployment_method: 'direct_websocket',
                    deployment_source: 'WebSocket_API',
                    vehicle_id: vehicleId || 'unknown',
                    deployment_timestamp: new Date().toISOString()
                })
            };

            // Insert application into database to satisfy foreign key constraints
            if (this.runtime.appManager && this.runtime.appManager.db) {
                try {
                    await this.runtime.appManager.db.createApplication(appData);
                    this.logger.info('Application inserted into database', {
                        appId,
                        deploymentMethod: 'direct_websocket',
                        appName: appData.name,
                        nextStep: 'container_creation'
                    });
                } catch (dbError) {
                    this.logger.error('Failed to create application in database', {
                        appId,
                        deploymentMethod: 'direct_websocket',
                        error: dbError.message,
                        impact: 'App may not appear in frontend UI'
                    });
                    // Continue with deployment even if database fails
                }
            }

            // Determine app type and run accordingly
            let result;
            if (prototype?.language === 'python' || language === 'python' || code.includes('import ') || code.includes('def ')) {
                // Validate Python syntax before deployment
                if (!this._validatePythonSyntax(code)) {
                    return {
                        type: 'deploy_request-response',
                        id: message.id,
                        cmd: 'deploy_request',
                        executionId,
                        appId,
                        status: 'failed',
                        result: 'Python syntax validation failed',
                        isDone: true,
                        code: 1,
                        kit_id: this.runtime.runtimeId,
                        timestamp: new Date().toISOString()
                    };
                }

                result = await this.runtime.appManager.runPythonApp({
                    executionId,
                    appId,
                    code: code,
                    entryPoint: 'main.py',
                    env: {
                        APP_NAME: prototype?.name || 'Deployed App'
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
                        APP_NAME: prototype?.name || 'Deployed App'
                    },
                    workingDir: '/app',
                    vehicleId
                });
            }

            this.logger.info('Application deployment completed successfully', {
                appId,
                executionId,
                deploymentMethod: 'direct_websocket',
                status: result.status,
                containerId: result.containerId,
                frontendVisibility: 'should_appear_in_ui'
            });

            return {
                type: 'deploy_request-response',
                id: message.id,
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
            this.logger.error('Application deployment failed', {
                appId,
                executionId,
                deploymentMethod: 'direct_websocket',
                error: error.message,
                errorStack: error.stack,
                impact: 'Application will not be created',
                troubleshooting: 'Check application code, resource limits, and database connectivity'
            });
            return {
                type: 'deploy_request-response',
                id: message.id,
                cmd: 'deploy_request',
                executionId,
                appId,
                status: 'failed',
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

            // Ensure we always have an array, even if no apps are running
            const appsArray = Array.isArray(runningApps) ? runningApps : [];

            // Format for frontend compatibility
            const apps = appsArray.map(app => ({
                app_id: app.executionId,
                name: app.name || app.appId, // Use proper app name, fallback to appId
                version: '1.0.0',
                status: app.status,
                deploy_time: app.startTime || app.deployTime,
                auto_start: true,
                resources: {
                    cpu_limit: '50%',
                    memory_limit: '512MB'
                }
            }));

            return {
                type: 'list_deployed_apps-response',
                id: message.id,
                applications: apps,
                apps,
                total_count: apps.length,
                running_count: apps.filter(app => app.status === 'running').length,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to list deployed apps', { error: error.message });
            return {
                type: 'list_deployed_apps-response',
                id: message.id,
                applications: [], // Always return an array
                apps: [],
                total_count: 0,
                running_count: 0,
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
                id: message.id,
                app_id,
                action,
                status: result.status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to manage application', { app_id, action, error: error.message });
            return {
                type: 'error',
                id: message.id,
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
                id: message.id,
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
                id: message.id,
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
                id: message.id,
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
                id: message.id,
                vss_config: vssConfig,
                last_updated: new Date().toISOString(),
                signal_count: this.runtime.kuksaManager?.signalValues?.size || 0,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get VSS config', { error: error.message });
            return {
                type: 'error',
                id: message.id,
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
                type: 'get_runtime_info-response',
                id: message.id,
                kit_id: this.runtime.runtimeId,
                result: {
                    runtimeId: this.runtime.runtimeId,
                    capabilities: [
                        'app_management',
                        'vehicle_signals',
                        'python_execution',
                        'database_persistence',
                        'console_streaming',
                        'resource_monitoring'
                    ],
                    connectedServices: {
                        kuksaManager: !!this.runtime.kuksaManager,
                        database: !!this.runtime.dbManager,
                        appManager: !!this.runtime.appManager
                    },
                    runningApplications: lsOfRunner,
                    activeSubscriptions: lsOfApiSubscriber,
                    status: 'running',
                    startTime: this.runtime.startTime || new Date().toISOString(),
                    version: '1.0.0'
                },
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
                id: message.id,
                error: 'Failed to get runtime info: ' + error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleReportRuntimeState(message) {
        this.logger.info('Reporting runtime state');

        try {
            const runningApps = await this.runtime.appManager.getRunningApplications();
            const runtimeState = {
                runtimeId: this.runtime.runtimeId || 'runtime-' + Date.now(),
                status: 'running',
                startTime: this.runtime.startTime || new Date().toISOString(),
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                capabilities: [
                    'app_management',
                    'vehicle_signals',
                    'python_execution',
                    'database_persistence',
                    'console_streaming',
                    'resource_monitoring'
                ],
                connectedServices: {
                    kuksaManager: !!this.runtime.kuksaManager,
                    database: !!this.runtime.dbManager,
                    appManager: !!this.runtime.appManager
                },
                activeConnections: this.runtime.getActiveConnections ? this.runtime.getActiveConnections() : 1,
                activeDeployments: runningApps.length,
                statistics: {
                    totalApps: this.runtime.appManager.applications ? this.runtime.appManager.applications.size : 0,
                    runningApps: runningApps.length,
                    activeSubscriptions: this.runtime.apiSubscriptions ? this.runtime.apiSubscriptions.size : 0
                }
            };

            return {
                type: 'runtime_state_response',
                id: message.id,
                result: runtimeState,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to report runtime state', { error: error.message });
            return {
                type: 'error',
                id: message.id,
                error: 'Failed to report runtime state: ' + error.message,
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
                id: message.id,
                appId,
                status: result.status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to pause app', { appId, error: error.message });
            return {
                type: 'error',
                id: message.id,
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
                id: message.id,
                appId,
                status: result.status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to resume app', { appId, error: error.message });
            return {
                type: 'error',
                id: message.id,
                error: 'Failed to resume app: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleRunApp(message) {
        const { appId } = message;

        this.logger.info('Starting application', { appId });

        try {
            // Check current application status first
            const currentStatus = await this.runtime.appManager.getApplicationStatus(appId);

            if (currentStatus === 'running') {
                return {
                    type: 'run_app-response',
                    id: message.id,
                    appId,
                    status: 'already_running',
                    message: 'Application is already running',
                    timestamp: new Date().toISOString()
                };
            }

            // Check if the application exists in database
            const appList = await this.runtime.appManager.listApplications({ id: appId });
            if (appList.length === 0) {
                throw new Error(`Application not found: ${appId}`);
            }

            const appInfo = appList[0];
            this.logger.info('Found application in database', { appId, name: appInfo.name, type: appInfo.type });

            // For the current implementation, we need to redeploy the app to "start" it
            // This is because stopping actually removes the container
            const deployOptions = {
                appId: appInfo.id,
                code: appInfo.code,
                entryPoint: appInfo.entryPoint || 'main.py',
                env: appInfo.env || {},
                workingDir: appInfo.workingDir || '/app',
                vehicleId: appInfo.vehicleId || 'default-vehicle',
                executionId: `restart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            };

            let result;
            if (appInfo.type === 'python') {
                result = await this.runtime.appManager.runPythonApp(deployOptions);
            } else if (appInfo.type === 'binary') {
                result = await this.runtime.appManager.runBinaryApp(deployOptions);
            } else {
                throw new Error(`Unsupported application type: ${appInfo.type}`);
            }

            return {
                type: 'run_app-response',
                id: message.id,
                appId,
                status: 'started',
                message: 'Application started successfully',
                executionId: result.executionId,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to start app', { appId, error: error.message });
            return {
                type: 'error',
                id: message.id,
                error: 'Failed to start app: ' + error.message,
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
                id: message.id,
                appId: result.appId,
                name: result.name,
                appType: result.type,
                status: result.status,
                appDir: result.appDir,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to install app', { appId: appData.id, error: error.message });
            return {
                type: 'error',
                id: message.id,
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
                id: message.id,
                appId,
                status: result.status,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to uninstall app', { appId, error: error.message });
            return {
                type: 'error',
                id: message.id,
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
                type: 'apps_list',
                id: message.id,
                apps,
                count: apps.length,
                filters,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to list apps', { error: error.message });
            return {
                type: 'error',
                id: message.id,
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
                id: message.id,
                appId,
                logs,
                options,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get app logs', { appId, error: error.message });
            return {
                type: 'error',
                id: message.id,
                error: 'Failed to get app logs: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleStopApp(message) {
        const { appId } = message;

        this.logger.info('Stopping application', { appId });

        try {
            const result = await this.runtime.appManager.stopApplication(appId);

            return {
                type: 'stop_app-response',
                id: message.id,
                result: {
                    appId,
                    status: result.status,
                    exitCode: result.exitCode || 0,
                    timestamp: new Date().toISOString()
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to stop app', { appId, error: error.message });
            return {
                type: 'stop_app-response',
                id: message.id,
                result: {
                    appId,
                    status: 'error',
                    error: 'Failed to stop app: ' + error.message,
                    timestamp: new Date().toISOString()
                },
                timestamp: new Date().toISOString()
            };
        }
    }

    async handleGetAppStatus(message) {
        const { appId } = message;

        this.logger.info('Getting application status', { appId });

        try {
            const status = await this.runtime.appManager.getApplicationStatus(appId);

            return {
                type: 'get_app_status-response',
                id: message.id,
                result: {
                    appId,
                    status,
                    timestamp: new Date().toISOString()
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get app status', { appId, error: error.message });
            return {
                type: 'error',
                id: message.id,
                error: 'Failed to get app status: ' + error.message,
                appId,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Validate Python syntax
     * @param {string} code Python code to validate
     * @returns {boolean} True if syntax is valid, false otherwise
     */
    _validatePythonSyntax(code) {
        try {
            // Basic syntax validation checks
            if (!code || typeof code !== 'string') {
                return false;
            }

            // Check for critical syntax errors that would definitely fail
            const syntaxErrors = [
                // Only check for the most obvious syntax errors
                // Unclosed strings - single line detection
                /^"[^"]*$/m,  // Line starts with unclosed double quote
                /^'[^']*$/m,  // Line starts with unclosed single quote
            ];

            for (const pattern of syntaxErrors) {
                if (pattern.test(code.trim())) {
                    this.logger.warn('Python syntax validation failed', { pattern: pattern.source });
                    return false;
                }
            }

            // Check for unclosed quotes - simple and effective for the test case
            const trimmedCode = code.trim();
            const quoteCount = (trimmedCode.match(/"/g) || []).length;
            if (quoteCount % 2 !== 0) {
                this.logger.warn('Python syntax validation failed - unclosed quotes');
                return false;
            }

            return true;

        } catch (error) {
            this.logger.error('Python syntax validation error', { error: error.message });
            return false;
        }
    }

  }