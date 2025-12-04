/**
 * WebSocket Handler
 * Handles WebSocket connections and message routing
 */

import { Logger } from '../utils/Logger.js';
import { MessageHandler } from './MessageHandler.js';

export class WebSocketHandler {
    constructor(runtime) {
        this.runtime = runtime;
        this.logger = new Logger('WebSocketHandler', runtime.options.logLevel);
        this.messageHandler = new MessageHandler(runtime);
    }

    handleConnection(ws, request) {
        const clientId = this.runtime.registerClient(ws, {
            remoteAddress: request.socket.remoteAddress,
            userAgent: request.headers['user-agent'],
            url: request.url
        });

        this.logger.info('New WebSocket connection', { clientId });

        // Handle incoming messages
        ws.on('message', (data) => {
            this._handleMessage(clientId, data);
        });

        // Handle connection close
        ws.on('close', (code, reason) => {
            this.logger.info('WebSocket connection closed', { clientId, code, reason: reason.toString() });
            this.runtime.unregisterClient(clientId);
        });

        // Handle errors
        ws.on('error', (error) => {
            this.logger.error('WebSocket connection error', { clientId, error: error.message });
        });

        // Send welcome message
        this._sendMessage(ws, {
            type: 'connection_established',
            clientId,
            runtimeId: this.runtime.runtimeId,
            timestamp: new Date().toISOString()
        });
    }

    handleKitManagerCommand(message) {
        this.logger.debug('Handling Kit Manager command', { type: message.type });

        switch (message.type) {
            case 'register_kit':
                return this.messageHandler.handleRegisterKit(message);
            case 'register_client':
                return this.messageHandler.handleRegisterClient(message);
            case 'list-all-kits':
                return this.messageHandler.handleListAllKits(message);
            case 'run_python_app':
                return this.messageHandler.handleRunPythonApp(message);
            case 'run_binary_app':
                return this.messageHandler.handleRunBinaryApp(message);
            case 'stop_app':
                return this.messageHandler.handleStopApp(message);
            case 'get_app_status':
                return this.messageHandler.handleGetAppStatus(message);
            case 'app_output':
                return this.messageHandler.handleAppOutput(message);
            case 'app_log':
                return this.messageHandler.handleAppLog(message);
            case 'console_subscribe':
                return this.messageHandler.handleConsoleSubscribe(message);
            case 'console_unsubscribe':
                return this.messageHandler.handleConsoleUnsubscribe(message);
            case 'report-runtime-state':
                return this.messageHandler.handleReportRuntimeState(message);
            default:
                this.logger.warn('Unknown command type', { type: message.type });
                return this._sendError(message, `Unknown command type: ${message.type}`);
        }
    }

    async _handleMessage(clientId, data) {
        try {
            const message = JSON.parse(data.toString());
            this.logger.debug('Received WebSocket message', { clientId, type: message.type });

            const response = await this.messageHandler.processMessage(clientId, message);
            if (response) {
                this._sendToClient(clientId, response);
            }

        } catch (error) {
            this.logger.error('Error processing WebSocket message', {
                clientId,
                error: error.message,
                data: data.toString().substring(0, 200)
            });

            this._sendToClient(clientId, {
                type: 'error',
                error: 'Invalid message format',
                timestamp: new Date().toISOString()
            });
        }
    }

    _sendMessage(ws, message) {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    _sendToClient(clientId, message) {
        const clientInfo = this.runtime.clients.get(clientId);
        if (clientInfo && clientInfo.client.readyState === clientInfo.client.OPEN) {
            clientInfo.client.send(JSON.stringify(message));
        }
    }

    _sendToKitManager(message) {
        if (this.runtime.kitManagerConnection && this.runtime.kitManagerConnection.readyState === 1) {
            this.runtime.kitManagerConnection.send(JSON.stringify(message));
        }
    }

    _sendError(originalMessage, error) {
        return {
            type: 'error',
            error,
            originalType: originalMessage.type,
            timestamp: new Date().toISOString()
        };
    }
}