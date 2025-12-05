/**
 * Credential Manager - Vehicle Credential Injection
 * Handles vehicle authentication credentials and token management
 */

import { Logger } from '../utils/Logger.js';
import { EventEmitter } from 'events';

export class CredentialManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            credentialPath: options.credentialPath || './data/configs/credentials.json',
            tokenRefreshInterval: options.tokenRefreshInterval || 3600000, // 1 hour
            logLevel: options.logLevel || 'info',
            ...options
        };

        this.logger = new Logger('CredentialManager', this.options.logLevel);

        // Credential storage
        this.credentials = new Map();
        this.activeTokens = new Map();
        this.refreshTimer = null;

        this.logger.info('Credential Manager initialized');
    }

    async initialize() {
        try {
            this.logger.info('Initializing Credential Manager...');

            // Load existing credentials
            await this._loadCredentials();

            // Start token refresh timer
            this._startTokenRefreshTimer();

            this.logger.info('Credential Manager initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Credential Manager', { error: error.message });
            throw error;
        }
    }

    async stop() {
        try {
            this.logger.info('Stopping Credential Manager...');

            // Stop refresh timer
            if (this.refreshTimer) {
                clearInterval(this.refreshTimer);
                this.refreshTimer = null;
            }

            // Save credentials
            await this._saveCredentials();

            this.logger.info('Credential Manager stopped');
        } catch (error) {
            this.logger.error('Error stopping Credential Manager', { error: error.message });
        }
    }

    /**
     * Register vehicle credentials
     */
    async registerVehicleCredentials(vehicleId, credentials) {
        try {
            this.logger.info('Registering vehicle credentials', { vehicleId });

            const credentialData = {
                vehicleId,
                credentials: {
                    accessToken: credentials.accessToken,
                    refreshToken: credentials.refreshToken,
                    clientId: credentials.clientId,
                    clientSecret: credentials.clientSecret,
                    scope: credentials.scope || ['vehicle_signals'],
                    expiresAt: credentials.expiresAt || this._calculateExpiration()
                },
                registeredAt: new Date().toISOString(),
                lastUsed: null
            };

            this.credentials.set(vehicleId, credentialData);
            await this._saveCredentials();

            this.logger.info('Vehicle credentials registered successfully', { vehicleId });
            this.emit('credentialsRegistered', { vehicleId });

            return credentialData;
        } catch (error) {
            this.logger.error('Failed to register vehicle credentials', { vehicleId, error: error.message });
            throw error;
        }
    }

    /**
     * Get credentials for a vehicle
     */
    getVehicleCredentials(vehicleId) {
        const credentialData = this.credentials.get(vehicleId);

        if (!credentialData) {
            this.logger.warn('Vehicle credentials not found', { vehicleId });
            return null;
        }

        // Update last used timestamp
        credentialData.lastUsed = new Date().toISOString();

        return credentialData.credentials;
    }

    /**
     * Get access token for application execution
     */
    async getAccessTokenForApplication(vehicleId, applicationId, requiredScopes = ['vehicle_signals']) {
        try {
            const credentials = this.getVehicleCredentials(vehicleId);

            if (!credentials) {
                throw new Error(`No credentials found for vehicle: ${vehicleId}`);
            }

            // Check if token is valid and has required scopes
            let accessToken = await this._validateAndGetToken(credentials, requiredScopes);

            // If token is expired, refresh it
            if (!accessToken) {
                accessToken = await this._refreshToken(vehicleId);
            }

            if (!accessToken) {
                throw new Error(`Unable to get valid access token for vehicle: ${vehicleId}`);
            }

            // Store token for this application
            this.activeTokens.set(`${vehicleId}:${applicationId}`, {
                token: accessToken,
                scopes: requiredScopes,
                vehicleId,
                applicationId,
                createdAt: new Date().toISOString()
            });

            this.logger.debug('Access token provided for application', {
                vehicleId,
                applicationId,
                scopes: requiredScopes
            });

            return accessToken;
        } catch (error) {
            this.logger.error('Failed to get access token for application', {
                vehicleId,
                applicationId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Inject credentials into application environment
     */
    async injectCredentialsIntoApplication(vehicleId, applicationId, containerOptions = {}) {
        try {
            const accessToken = await this.getAccessTokenForApplication(vehicleId, applicationId);

            // Prepare environment variables for credential injection
            const credentialEnv = {
                VEHICLE_ACCESS_TOKEN: accessToken,
                VEHICLE_ID: vehicleId,
                KUKSA_SERVER_URL: this.options.kuksaUrl || 'localhost:55555',
                VSS_DATAPOINTS: this._getVssDataPoints(requiredScopes),
                CREDENTIAL_INJECTED_AT: new Date().toISOString(),
                APPLICATION_ID: applicationId
            };

            // Update container options with credentials
            const enhancedOptions = {
                ...containerOptions,
                Env: [
                    ...(containerOptions.Env || []),
                    ...Object.entries(credentialEnv).map(([key, value]) => `${key}=${value}`)
                ]
            };

            this.logger.info('Credentials injected into application environment', {
                vehicleId,
                applicationId
            });

            return enhancedOptions;
        } catch (error) {
            this.logger.error('Failed to inject credentials into application', {
                vehicleId,
                applicationId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Revoke credentials for a vehicle
     */
    async revokeVehicleCredentials(vehicleId) {
        try {
            this.logger.info('Revoking vehicle credentials', { vehicleId });

            const credentialData = this.credentials.get(vehicleId);
            if (credentialData) {
                // Clear active tokens for this vehicle
                for (const [tokenKey, tokenData] of this.activeTokens) {
                    if (tokenData.vehicleId === vehicleId) {
                        this.activeTokens.delete(tokenKey);
                    }
                }

                // Remove credentials
                this.credentials.delete(vehicleId);
                await this._saveCredentials();

                this.logger.info('Vehicle credentials revoked successfully', { vehicleId });
                this.emit('credentialsRevoked', { vehicleId });
            }
        } catch (error) {
            this.logger.error('Failed to revoke vehicle credentials', { vehicleId, error: error.message });
            throw error;
        }
    }

    /**
     * List all registered vehicles
     */
    getRegisteredVehicles() {
        const vehicles = [];
        for (const [vehicleId, credentialData] of this.credentials) {
            vehicles.push({
                vehicleId,
                registeredAt: credentialData.registeredAt,
                lastUsed: credentialData.lastUsed,
                hasActiveToken: Array.from(this.activeTokens.values()).some(
                    token => token.vehicleId === vehicleId
                )
            });
        }
        return vehicles;
    }

    /**
     * Get manager status
     */
    getStatus() {
        return {
            registeredVehicles: this.credentials.size,
            activeTokens: this.activeTokens.size,
            refreshTimerActive: !!this.refreshTimer,
            credentialPath: this.options.credentialPath
        };
    }

    // Private methods

    async _loadCredentials() {
        try {
            const fs = await import('fs-extra');

            if (await fs.pathExists(this.options.credentialPath)) {
                const credentialsData = await fs.readFile(this.options.credentialPath, 'utf8');
                const credentials = JSON.parse(credentialsData);

                // Load into Map
                for (const [vehicleId, credentialData] of Object.entries(credentials)) {
                    this.credentials.set(vehicleId, credentialData);
                }

                this.logger.info('Credentials loaded successfully', {
                    count: this.credentials.size
                });
            } else {
                this.logger.info('No existing credentials file found, starting fresh');
            }
        } catch (error) {
            this.logger.error('Failed to load credentials', { error: error.message });
            throw error;
        }
    }

    async _saveCredentials() {
        try {
            const fs = await import('fs-extra');

            // Convert Map to object for JSON serialization
            const credentialsObject = {};
            for (const [vehicleId, credentialData] of this.credentials) {
                credentialsObject[vehicleId] = credentialData;
            }

            await fs.writeFile(
                this.options.credentialPath,
                JSON.stringify(credentialsObject, null, 2)
            );

            this.logger.debug('Credentials saved successfully');
        } catch (error) {
            this.logger.error('Failed to save credentials', { error: error.message });
            throw error;
        }
    }

    async _validateAndGetToken(credentials, requiredScopes) {
        // Check if token exists and is not expired
        if (!credentials.accessToken) {
            return null;
        }

        if (credentials.expiresAt && new Date() >= new Date(credentials.expiresAt)) {
            return null;
        }

        // In a real implementation, you would validate the token signature and scopes
        // For now, we'll simulate token validation
        try {
            // Simulate token validation
            const isValid = await this._simulateTokenValidation(credentials.accessToken);

            if (isValid) {
                return credentials.accessToken;
            }
        } catch (error) {
            this.logger.debug('Token validation failed', { error: error.message });
        }

        return null;
    }

    async _refreshToken(vehicleId) {
        try {
            const credentialData = this.credentials.get(vehicleId);

            if (!credentialData || !credentialData.credentials.refreshToken) {
                throw new Error('No refresh token available for vehicle');
            }

            this.logger.info('Refreshing access token', { vehicleId });

            // In a real implementation, you would make an OAuth2 token refresh request
            // For now, we'll simulate token refresh
            const newAccessToken = await this._simulateTokenRefresh(
                credentialData.credentials.refreshToken
            );

            // Update credentials with new token
            credentialData.credentials.accessToken = newAccessToken;
            credentialData.credentials.expiresAt = this._calculateExpiration();
            credentialData.lastUsed = new Date().toISOString();

            await this._saveCredentials();

            this.logger.info('Access token refreshed successfully', { vehicleId });
            this.emit('tokenRefreshed', { vehicleId });

            return newAccessToken;
        } catch (error) {
            this.logger.error('Failed to refresh token', { vehicleId, error: error.message });
            throw error;
        }
    }

    _calculateExpiration() {
        // Calculate expiration time (default: 1 hour from now)
        const expiration = new Date();
        expiration.setHours(expiration.getHours() + 1);
        return expiration.toISOString();
    }

    _getVssDataPoints(scopes) {
        // Return VSS data points based on required scopes
        const dataPoints = [];

        if (scopes.includes('vehicle_signals')) {
            dataPoints.push('Vehicle.Speed', 'Vehicle.Engine.RPM', 'Vehicle.Engine.Temperature');
        }

        if (scopes.includes('vehicle_actuators')) {
            dataPoints.push('Vehicle.Transmission.Gear', 'Vehicle.Body.Lights.IsLightOn');
        }

        return dataPoints.join(',');
    }

    _startTokenRefreshTimer() {
        // Set up periodic token refresh
        this.refreshTimer = setInterval(async () => {
            try {
                await this._refreshExpiredTokens();
            } catch (error) {
                this.logger.error('Error in token refresh timer', { error: error.message });
            }
        }, this.options.tokenRefreshInterval);
    }

    async _refreshExpiredTokens() {
        const now = new Date();

        for (const [vehicleId, credentialData] of this.credentials) {
            if (credentialData.credentials.expiresAt) {
                const expiration = new Date(credentialData.credentials.expiresAt);

                // Refresh tokens that expire within the next 5 minutes
                const refreshThreshold = new Date(now.getTime() + 5 * 60 * 1000);

                if (expiration <= refreshThreshold) {
                    try {
                        await this._refreshToken(vehicleId);
                    } catch (error) {
                        this.logger.warn('Failed to refresh token during routine check', {
                            vehicleId,
                            error: error.message
                        });
                    }
                }
            }
        }
    }

    // Simulation methods (replace with real implementations in production)

    async _simulateTokenValidation(token) {
        // Simulate token validation
        // In production, this would verify the JWT signature and claims
        return true;
    }

    async _simulateTokenRefresh(refreshToken) {
        // Simulate token refresh
        // In production, this would make an OAuth2 token refresh request
        return `simulated_access_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}