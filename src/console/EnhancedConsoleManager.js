/**
 * Enhanced Console Manager
 * Supports bidirectional console streaming with stdin support
 */

import { Logger } from '../utils/Logger.js';
import fs from 'fs-extra';
import path from 'path';
import { Writable } from 'stream';

export class EnhancedConsoleManager {
    constructor(options = {}) {
        this.options = options;
        this.logger = new Logger('EnhancedConsoleManager', options.logLevel);
        this.subscribers = new Map(); // executionId -> Set of clientIds
        this.buffers = new Map(); // executionId -> buffer
        this.stdinBuffers = new Map(); // executionId -> stdin buffer
        this.maxBufferSize = options.maxBufferSize || 1000000; // 1MB
        this.lineBuffering = options.lineBuffering !== false; // Default to line buffering
    }

    addConsoleOutput(executionId, stream, content) {
        try {
            // Add to database logs if database is available
            if (this.runtime?.appManager?.db) {
                const app = this.runtime.appManager.applications.get(executionId);
                if (app) {
                    this.runtime.appManager.db.addLog(app.appId, stream, content, 'info', executionId);
                }
            }

            // Buffer management for disconnected clients
            this.bufferOutput(executionId, stream, content);

            // Send to subscribed clients
            const subscribers = this.subscribers.get(executionId);
            if (subscribers && subscribers.size > 0) {
                const message = {
                    type: 'console_output',
                    executionId,
                    stream,
                    output: content,
                    timestamp: new Date().toISOString()
                };

                // Broadcast to all subscribers
                for (const clientId of subscribers) {
                    this.runtime?.webSocketHandler?.sendToClient(clientId, message);
                }
            }

        } catch (error) {
            this.logger.error('Failed to handle console output', { executionId, error: error.message });
        }
    }

    async handleStdinInput(clientId, executionId, input) {
        try {
            this.logger.debug('Handling stdin input', { clientId, executionId, inputLength: input.length });

            // Store in stdin buffer for later processing
            if (!this.stdinBuffers.has(executionId)) {
                this.stdinBuffers.set(executionId, []);
            }
            this.stdinBuffers.get(executionId).push(input);

            // Find the application container
            const app = this.runtime?.appManager?.applications.get(executionId);
            if (!app || !app.container) {
                this.logger.warn('No container found for stdin input', { executionId });
                return { success: false, error: 'Container not found' };
            }

            // Send input to container
            try {
                const container = this.runtime.appManager.docker.getContainer(app.container.id);

                // Create attach stream for stdin
                const attachStream = await container.attach({
                    stream: true,
                    stdin: true,
                    stdout: false,
                    stderr: false
                });

                // Write input to container
                attachStream.write(input);
                attachStream.end();

                this.logger.debug('Stdin input sent to container', { executionId, containerId: app.container.id });

                return { success: true };

            } catch (error) {
                this.logger.error('Failed to send stdin to container', { executionId, error: error.message });
                return { success: false, error: error.message };
            }

        } catch (error) {
            this.logger.error('Failed to handle stdin input', { executionId, error: error.message });
            return { success: false, error: error.message };
        }
    }

    subscribeToConsole(clientId, executionId, options = {}) {
        try {
            this.logger.debug('Client subscribing to console', { clientId, executionId, options });

            // Add client to subscribers
            if (!this.subscribers.has(executionId)) {
                this.subscribers.set(executionId, new Set());
            }
            this.subscribers.get(executionId).add(clientId);

            // Send buffered output to new subscriber
            const buffer = this.buffers.get(executionId);
            if (buffer && options.catchUp !== false) {
                for (const entry of buffer) {
                    const message = {
                        type: 'console_output',
                        executionId,
                        stream: entry.stream,
                        output: entry.content,
                        timestamp: entry.timestamp,
                        buffered: true
                    };
                    this.runtime?.webSocketHandler?.sendToClient(clientId, message);
                }
            }

            // Setup container attach for stdin if needed
            this.setupStdinAttachment(executionId);

            return {
                success: true,
                executionId,
                bufferSize: buffer ? buffer.length : 0,
                clientId
            };

        } catch (error) {
            this.logger.error('Failed to subscribe to console', { clientId, executionId, error: error.message });
            return { success: false, error: error.message };
        }
    }

    unsubscribeFromConsole(clientId, executionId) {
        try {
            this.logger.debug('Client unsubscribing from console', { clientId, executionId });

            const subscribers = this.subscribers.get(executionId);
            if (subscribers) {
                subscribers.delete(clientId);
                if (subscribers.size === 0) {
                    this.subscribers.delete(executionId);
                }
            }

            return { success: true };

        } catch (error) {
            this.logger.error('Failed to unsubscribe from console', { clientId, executionId, error: error.message });
            return { success: false, error: error.message };
        }
    }

    bufferOutput(executionId, stream, content) {
        try {
            if (!this.buffers.has(executionId)) {
                this.buffers.set(executionId, []);
            }

            const buffer = this.buffers.get(executionId);
            const entry = {
                stream,
                content,
                timestamp: new Date().toISOString()
            };

            // Handle line buffering
            if (this.lineBuffering && stream === 'stdout') {
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (index < lines.length - 1 || line) {
                        buffer.push({
                            ...entry,
                            content: line + (index < lines.length - 1 ? '\n' : '')
                        });
                    }
                });
            } else {
                buffer.push(entry);
            }

            // Limit buffer size
            while (this.getBufferSize(buffer) > this.maxBufferSize) {
                buffer.shift(); // Remove oldest entry
            }

        } catch (error) {
            this.logger.error('Failed to buffer output', { executionId, error: error.message });
        }
    }

    getBufferSize(buffer) {
        return buffer.reduce((size, entry) => size + entry.content.length, 0);
    }

    async setupStdinAttachment(executionId) {
        try {
            const app = this.runtime?.appManager?.applications.get(executionId);
            if (!app || !app.container) {
                return;
            }

            // Container stdin attachment is handled dynamically in handleStdinInput
            this.logger.debug('Stdin attachment setup complete', { executionId });

        } catch (error) {
            this.logger.error('Failed to setup stdin attachment', { executionId, error: error.message });
        }
    }

    clearBuffer(executionId) {
        this.buffers.delete(executionId);
        this.stdinBuffers.delete(executionId);
    }

    getBufferInfo(executionId) {
        const buffer = this.buffers.get(executionId);
        const stdinBuffer = this.stdinBuffers.get(executionId);
        const subscribers = this.subscribers.get(executionId);

        return {
            executionId,
            bufferSize: buffer ? buffer.length : 0,
            bufferBytes: buffer ? this.getBufferSize(buffer) : 0,
            stdinBufferLength: stdinBuffer ? stdinBuffer.length : 0,
            subscriberCount: subscribers ? subscribers.size : 0,
            maxBufferSize: this.maxBufferSize
        };
    }

    getAllBuffers() {
        const info = {};
        for (const executionId of this.buffers.keys()) {
            info[executionId] = this.getBufferInfo(executionId);
        }
        return info;
    }

    async saveConsoleHistory(executionId, filePath) {
        try {
            const buffer = this.buffers.get(executionId);
            if (!buffer || buffer.length === 0) {
                throw new Error(`No console history found for executionId: ${executionId}`);
            }

            let history = '# Console History\n';
            history += `# Execution ID: ${executionId}\n`;
            history += `# Generated: ${new Date().toISOString()}\n\n`;

            for (const entry of buffer) {
                history += `[${entry.timestamp}] ${entry.stream.toUpperCase()}:\n${entry.content}\n`;
            }

            await fs.writeFile(filePath, history);

            this.logger.info('Console history saved', { executionId, filePath, entries: buffer.length });

            return {
                success: true,
                filePath,
                entries: buffer.length,
                size: history.length
            };

        } catch (error) {
            this.logger.error('Failed to save console history', { executionId, error: error.message });
            throw error;
        }
    }

    setRuntime(runtime) {
        this.runtime = runtime;
    }

    async cleanup() {
        this.logger.info('Cleaning up Enhanced Console Manager');

        // Clear all buffers
        this.subscribers.clear();
        this.buffers.clear();
        this.stdinBuffers.clear();

        this.logger.info('Enhanced Console Manager cleaned up');
    }
}