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

        // Use the MessageHandler to process all message types
        return this.messageHandler.processMessage(null, message);
    }

    async _handleMessage(clientId, data) {
        try {
            const rawData = data.toString();
            this.logger.info('WebSocket message received', {
                clientId,
                rawData: rawData.substring(0, 100),
                messageLength: rawData.length
            });

            const message = JSON.parse(rawData);
            this.logger.info('Parsed WebSocket message', { clientId, type: message.type, hasId: !!message.id });

            const response = await this.messageHandler.processMessage(clientId, message);

            if (response) {
                this.logger.info('Sending response to client', {
                    clientId,
                    responseType: response.type,
                    hasId: !!response.id
                });
                this._sendToClient(clientId, response);
            } else {
                this.logger.warn('No response from message handler', { clientId, type: message.type });
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
        this.logger.debug('Attempting to send message to client', {
            clientId,
            clientExists: !!clientInfo,
            readyState: clientInfo?.client?.readyState,
            message: JSON.stringify(message).substring(0, 100)
        });

        if (clientInfo && clientInfo.client.readyState === 1) { // WebSocket.OPEN = 1
            clientInfo.client.send(JSON.stringify(message));
            this.logger.debug('Message sent successfully to client', { clientId });
        } else {
            this.logger.warn('Failed to send message to client - client not ready', {
                clientId,
                clientExists: !!clientInfo,
                readyState: clientInfo?.client?.readyState
            });
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