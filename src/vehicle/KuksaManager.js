/**
 * Kuksa Manager - Vehicle Signal Integration
 * Handles communication with Kuksa Python databroker for vehicle signals
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger.js';
import fs from 'fs-extra';
import path from 'path';

export class KuksaManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            kuksaUrl: options.kuksaUrl || 'localhost:55555',
            authEnabled: options.authEnabled || false,
            authToken: options.authToken || null,
            vssPath: options.vssPath || './data/configs/vss.json',
            ...options
        };

        this.logger = new Logger('KuksaManager', this.options.logLevel);

        // Connection state
        this.isConnected = false;
        this.connection = null;

        // Vehicle signal subscriptions
        this.subscriptions = new Map();
        this.signalValues = new Map();
        this.vssData = null;

        this.logger.info('Kuksa Manager initialized', {
            kuksaUrl: this.options.kuksaUrl,
            authEnabled: this.options.authEnabled
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

            // Unsubscribe from all signals
            await this._unsubscribeAllSignals();

            // Close connection
            if (this.connection) {
                this.connection.close();
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
        return new Promise((resolve, reject) => {
            try {
                this.logger.info('Connecting to Kuksa databroker...', { url: this.options.kuksaUrl });

                // In a real implementation, this would use the Kuksa client library
                // For now, we'll simulate the connection
                this._simulateKuksaConnection();

                this.isConnected = true;
                this.logger.info('Connected to Kuksa databroker');
                resolve();
            } catch (error) {
                this.logger.error('Failed to connect to Kuksa databroker', { error: error.message });
                reject(error);
            }
        });
    }

    _simulateKuksaConnection() {
        // Simulate Kuksa connection for development
        // In production, this would be replaced with actual Kuksa client integration
        this.connection = {
            send: (command) => this._handleKuksaCommand(command),
            close: () => { this.isConnected = false; }
        };

        // Start signal simulation
        this._startSignalSimulation();
    }

    _startSignalSimulation() {
        // Simulate vehicle signal changes for development
        setInterval(() => {
            if (this.isConnected && this.subscriptions.size > 0) {
                const simulatedSignals = {
                    'Vehicle.Speed': 50 + Math.random() * 100,
                    'Vehicle.Engine.RPM': 1000 + Math.random() * 3000,
                    'Vehicle.Engine.Temperature': 80 + Math.random() * 40,
                    'Vehicle.Transmission.Gear': Math.floor(Math.random() * 8)
                };

                for (const [path, value] of Object.entries(simulatedSignals)) {
                    this.signalValues.set(path, {
                        value: value,
                        timestamp: new Date(),
                        source: 'simulated'
                    });
                }

                // Emit signal update event
                this.emit('signalsUpdated', simulatedSignals);
            }
        }, 2000); // Update every 2 seconds
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
        // Simulate Kuksa command execution
        // In production, this would send the command to the actual Kuksa databroker
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    status: 'success',
                    timestamp: new Date().toISOString(),
                    requestId: this._generateRequestId()
                });
            }, 50);
        });
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