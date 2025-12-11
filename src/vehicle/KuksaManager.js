/**
 * Kuksa Manager - Vehicle Signal Integration
 * Handles communication with Kuksa Python databroker for vehicle signals
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import fs from 'fs-extra';
import path from 'path';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

export class KuksaManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            kuksaHost: options.kuksaHost || 'localhost',
            kuksaPort: options.kuksaPort || 50051,
            authEnabled: options.authEnabled || false,
            authToken: options.authToken || null,
            vssPath: options.vssPath || './data/configs/vss.json',
            connectionType: options.connectionType || 'grpc',
            failFast: options.failFast !== false, // Default to true for safety
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            ...options
        };

        this.logger = new Logger('KuksaManager', this.options.logLevel);

        // gRPC connection state
        this.isConnected = false;
        this.grpcClient = null;
        this.vssClient = null;
        this.metadata = new grpc.Metadata();

        // Vehicle signal subscriptions
        this.subscriptions = new Map();
        this.signalValues = new Map();
        this.vssData = null;
        this.vssProto = null;

        // Connection retry state
        this.retryCount = 0;
        this.reconnectTimer = null;

        // Set up authentication if enabled
        if (this.options.authEnabled && this.options.authToken) {
            this.metadata.set('authorization', `Bearer ${this.options.authToken}`);
        }

        this.logger.info('Kuksa Manager initialized', {
            kuksaHost: this.options.kuksaHost,
            kuksaPort: this.options.kuksaPort,
            authEnabled: this.options.authEnabled,
            failFast: this.options.failFast
        });
    }

    async initialize() {
        try {
            this.logger.info('Initializing Kuksa Manager...');

            // Load VSS configuration
            await this._loadVSSConfiguration();

            // Connect to Kuksa databroker
            await this._connectToKuksa();

            this.logger.info('Kuksa Manager initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Kuksa Manager', { error: error.message });
            throw error;
        }
    }

    async stop() {
        try {
            this.logger.info('Stopping Kuksa Manager...');

            // Clear reconnect timer
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }

            // Unsubscribe from all signals
            await this._unsubscribeAllSignals();

            // Close gRPC connection
            if (this.grpcClient) {
                try {
                    this.grpcClient.close();
                } catch (closeError) {
                    this.logger.warn('Error closing gRPC client', { error: closeError.message });
                }
                this.grpcClient = null;
            }

            this.isConnected = false;
            this.logger.info('Kuksa Manager stopped');
        } catch (error) {
            this.logger.error('Error stopping Kuksa Manager', { error: error.message });
        }
    }

    /**
     * Subscribe to vehicle signals
     */
    async subscribeToSignals(signalPaths) {
        if (!this.isConnected) {
            throw new Error('Not connected to Kuksa databroker');
        }

        try {
            this.logger.info('Subscribing to vehicle signals', { signalPaths });

            const subscriptionId = this._generateSubscriptionId();
            const validatedPaths = await this._validateSignalPaths(signalPaths);

            // Create subscription request
            const subscriptionRequest = {
                action: 'subscribe',
                subscriptionId: subscriptionId,
                paths: validatedPaths
            };

            // Send subscription request via WebSocket/gRPC
            await this._sendKuksaCommand(subscriptionRequest);

            // Store subscription
            this.subscriptions.set(subscriptionId, {
                paths: validatedPaths,
                createdAt: new Date(),
                active: true
            });

            this.logger.info('Successfully subscribed to signals', {
                subscriptionId,
                signalCount: validatedPaths.length
            });

            return subscriptionId;
        } catch (error) {
            this.logger.error('Failed to subscribe to signals', { error: error.message, signalPaths });
            throw error;
        }
    }

    /**
     * Unsubscribe from vehicle signals
     */
    async unsubscribeFromSignals(subscriptionId) {
        if (!this.subscriptions.has(subscriptionId)) {
            this.logger.warn('Subscription not found', { subscriptionId });
            return;
        }

        try {
            const subscription = this.subscriptions.get(subscriptionId);

            // End the gRPC call if it exists
            if (subscription.grpcCall) {
                try {
                    subscription.grpcCall.end();
                } catch (callError) {
                    this.logger.warn('Error ending gRPC call', {
                        subscriptionId,
                        error: callError.message
                    });
                }
                subscription.grpcCall = null;
            }

            const unsubscribeRequest = {
                action: 'unsubscribe',
                subscriptionId: subscriptionId
            };

            await this._sendKuksaCommand(unsubscribeRequest);

            this.subscriptions.delete(subscriptionId);

            this.logger.info('Successfully unsubscribed from signals', { subscriptionId });
        } catch (error) {
            this.logger.error('Failed to unsubscribe from signals', { error: error.message, subscriptionId });
            throw error;
        }
    }

    /**
     * Set vehicle signal values
     */
    async setSignalValues(signalUpdates) {
        if (!this.isConnected) {
            throw new Error('Not connected to Kuksa databroker');
        }

        try {
            this.logger.info('Setting vehicle signal values', { signalUpdates });

            const validatedUpdates = await this._validateSignalUpdates(signalUpdates);

            const setRequest = {
                action: 'set',
                updates: validatedUpdates
            };

            const response = await this._sendKuksaCommand(setRequest);

            // Update local cache
            for (const [path, value] of Object.entries(validatedUpdates)) {
                this.signalValues.set(path, {
                    value: value,
                    timestamp: new Date(),
                    source: 'set'
                });
            }

            this.logger.info('Successfully set signal values', {
                signalCount: Object.keys(validatedUpdates).length
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to set signal values', { error: error.message, signalUpdates });
            throw error;
        }
    }

    /**
     * Get current signal values
     */
    async getSignalValues(signalPaths) {
        if (!this.isConnected) {
            throw new Error('Not connected to Kuksa databroker');
        }

        try {
            const validatedPaths = await this._validateSignalPaths(signalPaths);

            const getRequest = {
                action: 'get',
                paths: validatedPaths
            };

            const response = await this._sendKuksaCommand(getRequest);

            // Update local cache
            if (response.values) {
                for (const [path, data] of Object.entries(response.values)) {
                    this.signalValues.set(path, {
                        value: data.value,
                        timestamp: new Date(data.timestamp),
                        source: 'get'
                    });
                }
            }

            return response.values || {};
        } catch (error) {
            this.logger.error('Failed to get signal values', { error: error.message, signalPaths });
            throw error;
        }
    }

    /**
     * Get cached signal values
     */
    getCachedSignalValues() {
        const values = {};
        for (const [path, data] of this.signalValues) {
            values[path] = {
                value: data.value,
                timestamp: data.timestamp,
                source: data.source
            };
        }
        return values;
    }

    /**
     * Validate signal paths against VSS
     */
    async validateSignalPaths(signalPaths) {
        try {
            return await this._validateSignalPaths(signalPaths);
        } catch (error) {
            this.logger.error('Signal path validation failed', { error: error.message, signalPaths });
            throw error;
        }
    }

    /**
     * Get VSS tree information
     */
    getVSSTree() {
        return this.vssData;
    }

    /**
     * Get manager status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            kuksaUrl: this.options.kuksaUrl,
            activeSubscriptions: this.subscriptions.size,
            cachedSignals: this.signalValues.size,
            vssLoaded: !!this.vssData
        };
    }

    // Private methods

    async _loadVSSConfiguration() {
        try {
            if (await fs.pathExists(this.options.vssPath)) {
                const vssContent = await fs.readFile(this.options.vssPath, 'utf8');
                this.vssData = JSON.parse(vssContent);
                this.logger.info('VSS configuration loaded', { path: this.options.vssPath });
            } else {
                // Create default VSS configuration
                this.vssData = this._createDefaultVSS();
                await fs.writeFile(this.options.vssPath, JSON.stringify(this.vssData, null, 2));
                this.logger.info('Default VSS configuration created', { path: this.options.vssPath });
            }
        } catch (error) {
            this.logger.error('Failed to load VSS configuration', { error: error.message });
            // Fallback to in-memory VSS if file operations fail
            this.vssData = this._createDefaultVSS();
            this.logger.warn('Using in-memory VSS configuration due to file system error');
        }
    }

    _createDefaultVSS() {
        return {
            "Vehicle": {
                "Speed": {
                    "datatype": "float",
                    "type": "sensor",
                    "unit": "km/h",
                    "min": 0,
                    "max": 300,
                    "description": "Vehicle speed"
                },
                "Steering": {
                    "Angle": {
                        "datatype": "float",
                        "type": "sensor",
                        "unit": "degrees",
                        "min": -180,
                        "max": 180,
                        "description": "Steering wheel angle"
                    }
                },
                "Engine": {
                    "RPM": {
                        "datatype": "uint16",
                        "type": "sensor",
                        "unit": "rpm",
                        "min": 0,
                        "max": 8000,
                        "description": "Engine revolutions per minute"
                    },
                    "Temperature": {
                        "datatype": "float",
                        "type": "sensor",
                        "unit": "°C",
                        "min": -40,
                        "max": 150,
                        "description": "Engine coolant temperature"
                    }
                },
                "Transmission": {
                    "Gear": {
                        "datatype": "uint8",
                        "type": "actuator",
                        "min": 0,
                        "max": 8,
                        "description": "Current transmission gear"
                    }
                },
                "Body": {
                    "Cabin": {
                        "Lights": {
                            "IsOn": {
                                "datatype": "boolean",
                                "type": "actuator",
                                "description": "Cabin light status"
                            }
                        }
                    }
                },
                "Cabin": {
                    "Lights": {
                        "IsOn": {
                            "datatype": "boolean",
                            "type": "actuator",
                            "description": "Cabin light status"
                        }
                    }
                }
            }
        };
    }

    async _connectToKuksa() {
        if (this.isConnected) {
            this.logger.warn('Already connected to Kuksa databroker');
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                const kuksaAddress = `${this.options.kuksaHost}:${this.options.kuksaPort}`;
                this.logger.info('Connecting to Kuksa databroker...', {
                    address: kuksaAddress,
                    authEnabled: this.options.authEnabled,
                    failFast: this.options.failFast
                });

                // Load protobuf definition
                const protoPath = this.options.protoPath || path.join(process.cwd(), 'proto', 'kuksa.proto');
                let packageDefinition;

                try {
                    packageDefinition = protoLoader.loadSync(protoPath, {
                        keepCase: true,
                        longs: String,
                        enums: String,
                        defaults: true,
                        oneofs: true
                    });
                } catch (protoError) {
                    const error = new Error(`Failed to load Kuksa protobuf definition: ${protoError.message}`);
                    this.logger.error('Protobuf loading failed', {
                        protoPath,
                        error: protoError.message,
                        stack: protoError.stack
                    });

                    if (this.options.failFast) {
                        reject(error);
                        return;
                    }
                    // Fallback: try to create a basic gRPC client without proto
                    packageDefinition = this._createFallbackProtoDefinition();
                }

                const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
                const kuksaService = protoDescriptor.kuksa.val.v1;

                // Create gRPC client
                this.grpcClient = new kuksaService.VSS(
                    kuksaAddress,
                    grpc.credentials.createInsecure(),
                    {
                        'grpc.max_receive_message_length': 4 * 1024 * 1024,
                        'grpc.max_send_message_length': 4 * 1024 * 1024,
                        'grpc.keepalive_time_ms': 30000,
                        'grpc.keepalive_timeout_ms': 5000,
                        'grpc.keepalive_permit_without_calls': true,
                        'grpc.http2.min_time_between_pings_ms': 10000,
                        'grpc.http2.max_pings_without_data': 0,
                        'grpc.http2.min_ping_interval_without_data_ms': 300000
                    }
                );

                // Test connection with a simple request
                const deadline = new Date(Date.now() + 10000); // 10 second timeout
                this.grpcClient.waitForReady(deadline, (error) => {
                    if (error) {
                        this.logger.error('Failed to establish gRPC connection', {
                            error: error.message,
                            address: kuksaAddress,
                            failFast: this.options.failFast
                        });

                        if (this.options.failFast) {
                            reject(new Error(`Kuksa connection failed: ${error.message}`));
                            return;
                        }

                        // Retry logic
                        this._scheduleConnectionRetry();
                        reject(error);
                        return;
                    }

                    this.isConnected = true;
                    this.retryCount = 0;
                    this.logger.info('Successfully connected to Kuksa databroker', {
                        address: kuksaAddress,
                        authEnabled: this.options.authEnabled
                    });

                    // Set up connection monitoring
                    this._setupConnectionMonitoring();

                    resolve();
                });

            } catch (error) {
                this.logger.error('Exception during Kuksa connection', {
                    error: error.message,
                    stack: error.stack,
                    failFast: this.options.failFast
                });

                if (this.options.failFast) {
                    reject(new Error(`Kuksa connection failed: ${error.message}`));
                } else {
                    this._scheduleConnectionRetry();
                    reject(error);
                }
            }
        });
    }

    _createFallbackProtoDefinition() {
        // Create a minimal protobuf definition for fallback
        return {
            'kuksa.val.v1': {
                VSSClient: class MockVSSClient {
                    constructor(address, credentials, options) {
                        this.address = address;
                        this.credentials = credentials;
                        this.options = options;
                    }

                    waitForReady(deadline, callback) {
                        // Simulate connection delay
                        setTimeout(() => callback(new Error('Fallback client - real protobuf not found')), 100);
                    }

                    get(request, metadata, callback) {
                        callback(new Error('Fallback client - not implemented'));
                    }

                    set(request, metadata, callback) {
                        callback(new Error('Fallback client - not implemented'));
                    }

                    subscribe(call) {
                        call.emit('error', new Error('Fallback client - not implemented'));
                    }
                }
            }
        };
    }

    _setupConnectionMonitoring() {
        if (!this.grpcClient) return;

        // Set up connection health monitoring
        const healthCheckInterval = setInterval(() => {
            if (!this.isConnected) {
                clearInterval(healthCheckInterval);
                return;
            }

            // Simple health check - try to get server info
            this.grpcClient.get({ paths: [] }, this.metadata, (error) => {
                if (error) {
                    this.logger.warn('Kuksa health check failed', { error: error.message });

                    if (this.options.failFast) {
                        this._handleConnectionFailure(error);
                    } else {
                        this._scheduleConnectionRetry();
                    }
                }
            });
        }, 30000); // Check every 30 seconds

        // Note: gRPC client error handling is done through method callbacks and channel events
        // The gRPC VSS client doesn't have EventEmitter-style error events
    }

    _scheduleConnectionRetry() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        if (this.retryCount >= this.options.maxRetries) {
            this.logger.error('Maximum retry attempts reached', {
                retryCount: this.retryCount,
                maxRetries: this.options.maxRetries
            });
            this.emit('connectionFailed', new Error('Maximum retry attempts reached'));
            return;
        }

        const delay = this.options.retryDelay * Math.pow(2, this.retryCount); // Exponential backoff
        this.retryCount++;

        this.logger.info('Scheduling connection retry', {
            retryCount: this.retryCount,
            delay: delay,
            maxRetries: this.options.maxRetries
        });

        this.reconnectTimer = setTimeout(async () => {
            try {
                await this._connectToKuksa();
                this.emit('connectionRestored');
            } catch (error) {
                this.logger.error('Connection retry failed', { error: error.message });
                this._scheduleConnectionRetry();
            }
        }, delay);
    }

    _handleConnectionFailure(error) {
        this.isConnected = false;

        if (this.grpcClient) {
            try {
                this.grpcClient.close();
            } catch (closeError) {
                this.logger.warn('Error closing gRPC client', { error: closeError.message });
            }
        }

        this.grpcClient = null;

        this.emit('connectionLost', error);
        this.logger.error('Kuksa connection lost', { error: error.message });

        // Unsubscribe from all signals on connection failure
        this.subscriptions.clear();
    }

    async _validateSignalPaths(signalPaths) {
        const validatedPaths = [];

        for (const path of signalPaths) {
            if (this._isSignalPathValid(path)) {
                validatedPaths.push(path);
            } else {
                this.logger.warn('Invalid signal path', { path });
            }
        }

        if (validatedPaths.length === 0) {
            throw new Error('No valid signal paths provided');
        }

        return validatedPaths;
    }

    _isSignalPathValid(path) {
        if (!this.vssData) return false;

        // Simple validation - check if path exists in VSS tree
        const pathParts = path.split('.');
        let current = this.vssData;

        for (const part of pathParts) {
            if (!current || !current[part]) {
                return false;
            }
            current = current[part];
        }

        return true;
    }

    async _validateSignalUpdates(signalUpdates) {
        const validatedUpdates = {};

        for (const [path, value] of Object.entries(signalUpdates)) {
            if (this._isSignalPathValid(path)) {
                validatedUpdates[path] = value;
            } else {
                this.logger.warn('Invalid signal path for update', { path });
            }
        }

        if (Object.keys(validatedUpdates).length === 0) {
            throw new Error('No valid signal updates provided');
        }

        return validatedUpdates;
    }

    async _sendKuksaCommand(command) {
        if (!this.isConnected || !this.grpcClient) {
            throw new Error('Not connected to Kuksa databroker');
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Kuksa command timeout'));
            }, 10000); // 10 second timeout

            try {
                switch (command.action) {
                    case 'get':
                        this._handleGetCommand(command, (error, response) => {
                            clearTimeout(timeout);
                            if (error) {
                                reject(error);
                            } else {
                                resolve(response);
                            }
                        });
                        break;

                    case 'set':
                        this._handleSetCommand(command, (error, response) => {
                            clearTimeout(timeout);
                            if (error) {
                                reject(error);
                            } else {
                                resolve(response);
                            }
                        });
                        break;

                    case 'subscribe':
                        this._handleSubscribeCommand(command, (error, response) => {
                            clearTimeout(timeout);
                            if (error) {
                                reject(error);
                            } else {
                                resolve(response);
                            }
                        });
                        break;

                    case 'unsubscribe':
                        this._handleUnsubscribeCommand(command, (error, response) => {
                            clearTimeout(timeout);
                            if (error) {
                                reject(error);
                            } else {
                                resolve(response);
                            }
                        });
                        break;

                    default:
                        clearTimeout(timeout);
                        reject(new Error(`Unknown command action: ${command.action}`));
                }
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

  _handleGetCommand(command, callback) {
        const request = {
            paths: command.paths || []
        };

        this.grpcClient.get(request, this.metadata, (error, response) => {
            if (error) {
                this.logger.error('Kuksa get command failed', {
                    error: error.message,
                    paths: command.paths
                });
                callback(error);
                return;
            }

            const result = {
                status: 'success',
                timestamp: new Date().toISOString(),
                requestId: this._generateRequestId(),
                values: {}
            };

            // Process response and update local cache
            if (response && response.dataPoints) {
                for (const dataPoint of response.dataPoints) {
                    const path = dataPoint.path;
                    const value = this._parseKuksaValue(dataPoint);

                    this.signalValues.set(path, {
                        value: value,
                        timestamp: new Date(),
                        source: 'kuksa'
                    });

                    result.values[path] = {
                        value: value,
                        timestamp: dataPoint.timestamp || new Date().toISOString()
                    };
                }
            }

            this.logger.debug('Kuksa get command completed', {
                pathCount: command.paths.length,
                returnedValues: Object.keys(result.values).length
            });

            callback(null, result);
        });
    }

  _handleSetCommand(command, callback) {
        const updates = [];

        for (const [path, value] of Object.entries(command.updates || {})) {
            updates.push({
                path: path,
                value: this._formatKuksaValue(value),
                timestamp: new Date().toISOString()
            });
        }

        const request = {
            updates: updates
        };

        this.grpcClient.set(request, this.metadata, (error, response) => {
            if (error) {
                this.logger.error('Kuksa set command failed', {
                    error: error.message,
                    updates: command.updates
                });
                callback(error);
                return;
            }

            // Update local cache on successful set
            for (const [path, value] of Object.entries(command.updates)) {
                this.signalValues.set(path, {
                    value: value,
                    timestamp: new Date(),
                    source: 'set'
                });
            }

            const result = {
                status: 'success',
                timestamp: new Date().toISOString(),
                requestId: this._generateRequestId(),
                setCount: updates.length
            };

            this.logger.debug('Kuksa set command completed', {
                setCount: updates.length
            });

            callback(null, result);
        });
    }

  _handleSubscribeCommand(command, callback) {
        try {
            const call = this.grpcClient.subscribe(this.metadata);

            // Send subscription request
            const subscribeRequest = {
                subscriptionId: command.subscriptionId,
                paths: command.paths || []
            };

            call.write(subscribeRequest);

            // Handle subscription responses
            call.on('data', (response) => {
                if (response.dataPoints) {
                    const signalUpdates = {};

                    for (const dataPoint of response.dataPoints) {
                        const path = dataPoint.path;
                        const value = this._parseKuksaValue(dataPoint);

                        this.signalValues.set(path, {
                            value: value,
                            timestamp: new Date(),
                            source: 'subscription'
                        });

                        signalUpdates[path] = value;
                    }

                    // Emit real-time signal updates
                    this.emit('signalsUpdated', signalUpdates);
                }
            });

            call.on('error', (error) => {
                this.logger.error('Kuksa subscription error', {
                    subscriptionId: command.subscriptionId,
                    error: error.message
                });
                this.emit('subscriptionError', { subscriptionId: command.subscriptionId, error });
            });

            call.on('end', () => {
                this.logger.info('Kuksa subscription ended', {
                    subscriptionId: command.subscriptionId
                });
                this.emit('subscriptionEnded', { subscriptionId: command.subscriptionId });
            });

            // Store the subscription call for cleanup
            if (this.subscriptions.has(command.subscriptionId)) {
                const subscription = this.subscriptions.get(command.subscriptionId);
                subscription.grpcCall = call;
            }

            const result = {
                status: 'success',
                timestamp: new Date().toISOString(),
                requestId: this._generateRequestId(),
                subscriptionId: command.subscriptionId
            };

            callback(null, result);

        } catch (error) {
            callback(error);
        }
    }

  _handleUnsubscribeCommand(command, callback) {
        try {
            // End the gRPC subscription call if it exists
            if (this.subscriptions.has(command.subscriptionId)) {
                const subscription = this.subscriptions.get(command.subscriptionId);

                if (subscription.grpcCall) {
                    subscription.grpcCall.end();
                    subscription.grpcCall = null;
                }
            }

            const result = {
                status: 'success',
                timestamp: new Date().toISOString(),
                requestId: this._generateRequestId(),
                subscriptionId: command.subscriptionId
            };

            callback(null, result);

        } catch (error) {
            callback(error);
        }
    }

  _parseKuksaValue(dataPoint) {
        if (!dataPoint || !dataPoint.value) {
            return null;
        }

        // Parse different value types from Kuksa
        if (dataPoint.value.stringValue !== undefined) {
            return dataPoint.value.stringValue;
        }
        if (dataPoint.value.intValue !== undefined) {
            return dataPoint.value.intValue;
        }
        if (dataPoint.value.floatValue !== undefined) {
            return dataPoint.value.floatValue;
        }
        if (dataPoint.value.boolValue !== undefined) {
            return dataPoint.value.boolValue;
        }
        if (dataPoint.value.doubleValue !== undefined) {
            return dataPoint.value.doubleValue;
        }

        return null;
    }

  _formatKuksaValue(value) {
        // Format JavaScript value for Kuksa gRPC
        if (typeof value === 'string') {
            return { stringValue: value };
        }
        if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                return { intValue: value };
            } else {
                return { floatValue: value };
            }
        }
        if (typeof value === 'boolean') {
            return { boolValue: value };
        }

        // Default to string representation
        return { stringValue: String(value) };
    }

    async _unsubscribeAllSignals() {
        const subscriptionIds = Array.from(this.subscriptions.keys());

        for (const subscriptionId of subscriptionIds) {
            try {
                await this.unsubscribeFromSignals(subscriptionId);
            } catch (error) {
                this.logger.error('Error unsubscribing signals', { subscriptionId, error: error.message });
            }
        }
    }

    _generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    _generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}