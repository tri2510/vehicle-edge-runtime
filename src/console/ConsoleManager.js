/**
 * Console Manager
 * Manages real-time console output streaming and buffering
 */

import { Logger } from '../utils/Logger.js';
import fs from 'fs-extra';
import path from 'path';

export class ConsoleManager {
    constructor(options = {}) {
        this.options = options;
        this.logger = new Logger('ConsoleManager', options.logLevel);
        this.runtime = null; // Will be set by the runtime
        this.subscriptions = new Map(); // clientId -> Set of executionIds
        this.outputBuffers = new Map(); // executionId -> output buffer
        this.logFiles = new Map(); // executionId -> log file path
        this.maxBufferSize = options.maxBufferSize || 10000; // characters
        this.maxBufferLines = options.maxBufferLines || 1000;
        this.logDir = path.join(options.dataPath || './data', 'logs');
    }

    async initialize() {
        this.logger.info('Initializing Console Manager');

        await fs.ensureDir(this.logDir);

        // Clean up old log files (older than 7 days)
        await this._cleanupOldLogs();

        this.logger.info('Console Manager initialized');
    }

    setRuntime(runtime) {
        this.runtime = runtime;
    }

    async subscribe(clientId, executionId) {
        this.logger.info('Client subscribing to console output', { clientId, executionId });

        if (!this.subscriptions.has(clientId)) {
            this.subscriptions.set(clientId, new Set());
        }

        this.subscriptions.get(clientId).add(executionId);

        // Send buffered output if available
        const bufferedOutput = this.getBufferedOutput(executionId);
        if (bufferedOutput) {
            this._sendToClient(clientId, {
                type: 'console_output',
                executionId,
                output: bufferedOutput,
                timestamp: new Date().toISOString()
            });
        }
    }

    async unsubscribe(clientId, executionId) {
        this.logger.info('Client unsubscribing from console output', { clientId, executionId });

        const clientSubscriptions = this.subscriptions.get(clientId);
        if (clientSubscriptions) {
            clientSubscriptions.delete(executionId);

            // Remove client if no more subscriptions
            if (clientSubscriptions.size === 0) {
                this.subscriptions.delete(clientId);
            }
        }
    }

    addConsoleOutput(executionId, stream, output) {
        const timestamp = new Date().toISOString();
        const outputEntry = {
            timestamp,
            stream,
            output: output.replace(/\n$/, '') // Remove trailing newline for cleaner formatting
        };

        // Add to buffer
        this._addToBuffer(executionId, outputEntry);

        // Write to log file
        this._writeToLogFile(executionId, outputEntry);

        // Broadcast to subscribed clients
        this._broadcastOutput(executionId, outputEntry);

        this.logger.debug('Console output added', { executionId, stream, length: output.length });
    }

    getBufferedOutput(execId, maxLines = null) {
        const buffer = this.outputBuffers.get(execId);
        if (!buffer) {
            return '';
        }

        if (maxLines === null) {
            maxLines = this.maxBufferLines;
        }

        const lines = buffer.slice(-maxLines);
        return lines.map(entry => `[${entry.timestamp}] [${entry.stream.toUpperCase()}] ${entry.output}`).join('\n');
    }

    getBufferedOutputAsArray(execId, maxLines = null) {
        const buffer = this.outputBuffers.get(execId);
        if (!buffer) {
            return [];
        }

        if (maxLines === null) {
            maxLines = this.maxBufferLines;
        }

        return buffer.slice(-maxLines);
    }

    async getAppOutput(executionId, lines = 100) {
        try {
            // Get from buffer first
            const bufferedOutput = this.getBufferedOutput(executionId, lines);

            if (bufferedOutput) {
                return bufferedOutput;
            }

            // If not in buffer, try to read from log file
            const logFile = this.logFiles.get(executionId);
            if (logFile && await fs.pathExists(logFile)) {
                return await this._readLastLinesFromFile(logFile, lines);
            }

            return '';

        } catch (error) {
            this.logger.error('Failed to get app output', { executionId, error: error.message });
            throw error;
        }
    }

    async getAppOutputAsArray(executionId, lines = 100) {
        try {
            // Get from buffer first
            const buffer = this.outputBuffers.get(executionId);
            if (buffer && buffer.length > 0) {
                return buffer.slice(-lines);
            }

            // If not in buffer, try to read from log file and parse
            const logFile = this.logFiles.get(executionId);
            if (logFile && await fs.pathExists(logFile)) {
                const content = await this._readLastLinesFromFile(logFile, lines);
                return this._parseLogFileContent(content);
            }

            return [];

        } catch (error) {
            this.logger.error('Failed to get app output as array', { executionId, error: error.message });
            throw error;
        }
    }

    _parseLogFileContent(content) {
        // Parse log file content back into structured format
        // Format: [timestamp] [STREAM] output
        const lines = content.split('\n').filter(line => line.trim());
        const result = [];

        for (const line of lines) {
            // Match pattern: [timestamp] [STREAM] output
            const match = line.match(/^\[([^\]]+)\]\s+\[([A-Z]+)\]\s+(.+)$/);
            if (match) {
                const [, timestamp, stream, output] = match;
                result.push({
                    timestamp,
                    stream: stream.toLowerCase(),
                    output
                });
            }
        }

        return result;
    }

    async getAppLogs(executionId, lines = 100) {
        // For now, logs and output are the same
        return await this.getAppOutput(executionId, lines);
    }

    clearBuffer(executionId) {
        this.outputBuffers.delete(executionId);
        this.logger.debug('Output buffer cleared', { executionId });
    }

    async cleanup(executionId) {
        this.logger.info('Cleaning up console data', { executionId });

        // Clear buffer
        this.clearBuffer(executionId);

        // Remove from all client subscriptions
        for (const [clientId, subscriptions] of this.subscriptions) {
            subscriptions.delete(executionId);
        }

        // Clean up log file reference (but keep the file)
        this.logFiles.delete(executionId);

        this.logger.debug('Console data cleaned up', { executionId });
    }

    // Private methods

    _addToBuffer(executionId, outputEntry) {
        if (!this.outputBuffers.has(executionId)) {
            this.outputBuffers.set(executionId, []);
        }

        const buffer = this.outputBuffers.get(executionId);
        buffer.push(outputEntry);

        // Trim buffer if too large
        while (buffer.length > this.maxBufferLines) {
            buffer.shift();
        }
    }

    async _writeToLogFile(executionId, outputEntry) {
        try {
            if (!this.logFiles.has(executionId)) {
                const logFile = path.join(this.logDir, `app-${executionId}.log`);
                this.logFiles.set(executionId, logFile);
            }

            const logFile = this.logFiles.get(executionId);
            const logLine = `${outputEntry.timestamp} [${outputEntry.stream.toUpperCase()}] ${outputEntry.output}\n`;

            await fs.appendFile(logFile, logLine);

        } catch (error) {
            this.logger.error('Failed to write to log file', { executionId, error: error.message });
        }
    }

    _broadcastOutput(executionId, outputEntry) {
        if (!this.runtime) return;

        const message = {
            type: 'console_output',
            executionId,
            ...outputEntry
        };

        this.logger.info('Broadcasting console output', {
            executionId,
            totalSubscriptions: this.subscriptions.size,
            subscribers: Array.from(this.subscriptions.keys())
        });

        // Send to all subscribed clients
        for (const [clientId, subscriptions] of this.subscriptions) {
            if (subscriptions.has(executionId)) {
                this.logger.info('Sending console output to client', { clientId, executionId });
                this._sendToClient(clientId, message);
            }
        }
    }

    _sendToClient(clientId, message) {
        if (!this.runtime) return;

        this.logger.info('_sendToClient called', { clientId, messageType: message.type, executionId: message.executionId });

        // Handle Kit Manager clients - send through Kit Manager connection
        // clientId is the kit_id when message comes from Kit Manager
        // Kit Manager uses IDs like: Wv3wuyIZzSg66ZYQAEdO or xjYxhf2_XT7APnbRAEc6
        // Check if clientId looks like a Kit Manager ID (not 'kit_manager' string)
        if (clientId && clientId !== 'kit_manager' && !clientId.startsWith('ws-')) {
            this.logger.info('Identified as Kit Manager client', { clientId });
            if (this.runtime.kitManagerConnection && this.runtime.kitManagerConnection.connected) {
                // Kit Manager expects request_from field for routing (like other response messages)
                const messageWithRouting = {
                    request_from: clientId,  // Use request_from like other messages
                    ...message
                };
                this.logger.info('Emitting to Kit Manager', { request_from: clientId, executionId: message.executionId, type: message.type });
                this.runtime.kitManagerConnection.emit('messageToKit-kitReply', messageWithRouting);
                this.logger.info('Console output sent to Kit Manager', { executionId: message.executionId, request_from: clientId });
            } else {
                this.logger.warn('Kit Manager connection not available for console output');
            }
            return;
        }

        // Handle WebSocket clients
        const clientInfo = this.runtime.clients.get(clientId);
        if (clientInfo && clientInfo.client.readyState === clientInfo.client.OPEN) {
            clientInfo.client.send(JSON.stringify(message));
        }
    }

    async _readLastLinesFromFile(filePath, lines) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const allLines = data.trim().split('\n');
            return allLines.slice(-lines).join('\n');
        } catch (error) {
            this.logger.error('Failed to read log file', { filePath, error: error.message });
            return '';
        }
    }

    async _cleanupOldLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            const now = Date.now();
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logDir, file);
                    const stats = await fs.stat(filePath);

                    if (now - stats.mtime.getTime() > maxAge) {
                        await fs.remove(filePath);
                        this.logger.debug('Removed old log file', { file });
                    }
                }
            }
        } catch (error) {
            this.logger.warn('Failed to cleanup old logs', { error: error.message });
        }
    }

    /**
     * Start tailing Docker container logs and streaming to subscribers
     * @param {string} containerId - Docker container ID or name
     * @param {string} executionId - Execution ID (appId)
     */
    async startDockerLogStreaming(containerId, executionId) {
        if (!this.runtime) {
            this.logger.warn('Runtime not set, cannot start Docker log streaming');
            return;
        }

        // Check if already streaming
        if (this.dockerLogStreams && this.dockerLogStreams.has(executionId)) {
            this.logger.debug('Already streaming Docker logs', { executionId, containerId });
            return;
        }

        this.logger.info('Starting Docker log streaming', { containerId, executionId });

        try {
            // Initialize Map if not exists
            if (!this.dockerLogStreams) {
                this.dockerLogStreams = new Map();
            }

            // Use Docker to tail logs
            const { spawn } = await import('child_process');

            const dockerArgs = ['logs', '-f', '--tail', '100', containerId];
            this.logger.debug('Spawning docker logs process', { args: dockerArgs });

            const dockerProcess = spawn('docker', dockerArgs);

            // Handle stdout
            dockerProcess.stdout.on('data', (data) => {
                const output = data.toString();
                this._processDockerLogLine(executionId, 'stdout', output);
            });

            // Handle stderr
            dockerProcess.stderr.on('data', (data) => {
                const output = data.toString();
                this._processDockerLogLine(executionId, 'stderr', output);
            });

            // Handle process exit
            dockerProcess.on('close', (code) => {
                this.logger.info('Docker log streaming stopped', { executionId, containerId, exitCode: code });
                if (this.dockerLogStreams) {
                    this.dockerLogStreams.delete(executionId);
                }
            });

            // Handle process error
            dockerProcess.on('error', (error) => {
                this.logger.error('Docker log streaming process error', { executionId, error: error.message });
                if (this.dockerLogStreams) {
                    this.dockerLogStreams.delete(executionId);
                }
            });

            // Store the process so we can stop it later
            this.dockerLogStreams.set(executionId, {
                process: dockerProcess,
                containerId,
                startTime: Date.now()
            });

            this.logger.info('Docker log streaming started', { executionId, containerId });

        } catch (error) {
            this.logger.error('Failed to start Docker log streaming', { executionId, containerId, error: error.message });
        }
    }

    /**
     * Process a line of Docker log output
     * @param {string} executionId - Execution ID
     * @param {string} stream - 'stdout' or 'stderr'
     * @param {string} data - Raw log data
     */
    _processDockerLogLine(executionId, stream, data) {
        try {
            // Docker logs ANSI color codes, strip them
            const ansiRegex = /\x1b\[[0-9;]*m/g;
            const cleanData = data.replace(ansiRegex, '');

            // Split by lines and process each
            const lines = cleanData.split('\n').filter(line => line.trim());

            for (const line of lines) {
                // Try to parse as JSON first (Kuksa logs are JSON)
                let timestamp = new Date().toISOString();
                let output = line;

                try {
                    const jsonLog = JSON.parse(line);
                    if (jsonLog.timestamp) {
                        timestamp = jsonLog.timestamp;
                    }
                    // Extract the actual message from various JSON log formats
                    if (jsonLog.msg) {
                        output = jsonLog.msg;
                    } else if (jsonLog.message) {
                        output = jsonLog.message;
                    } else if (jsonLog.text) {
                        output = jsonLog.text;
                    }
                } catch {
                    // Not JSON, use the line as-is
                    output = line;
                }

                // Create output entry
                const outputEntry = {
                    timestamp,
                    stream,
                    output: output.replace(/\n$/, '') // Remove trailing newline
                };

                this.logger.info('Processing Docker log line', { executionId, stream, output: output.substring(0, 50) });

                // Add to buffer
                this._addToBuffer(executionId, outputEntry);

                // Write to log file
                this._writeToLogFile(executionId, outputEntry);

                // Broadcast to subscribers
                this._broadcastOutput(executionId, outputEntry);
            }
        } catch (error) {
            this.logger.error('Failed to process Docker log line', { executionId, error: error.message });
        }
    }

    /**
     * Stop streaming Docker logs for an execution
     * @param {string} executionId - Execution ID
     */
    async stopDockerLogStreaming(executionId) {
        if (!this.dockerLogStreams || !this.dockerLogStreams.has(executionId)) {
            return;
        }

        this.logger.info('Stopping Docker log streaming', { executionId });

        const streamInfo = this.dockerLogStreams.get(executionId);
        if (streamInfo && streamInfo.process) {
            streamInfo.process.kill('SIGTERM');
        }

        this.dockerLogStreams.delete(executionId);
    }

    /**
     * Stop all Docker log streams
     */
    async stopAllDockerLogStreaming() {
        if (!this.dockerLogStreams) {
            return;
        }

        this.logger.info('Stopping all Docker log streaming', { count: this.dockerLogStreams.size });

        for (const [executionId, streamInfo] of this.dockerLogStreams) {
            if (streamInfo && streamInfo.process) {
                try {
                    streamInfo.process.kill('SIGTERM');
                } catch (error) {
                    this.logger.warn('Failed to stop Docker log stream', { executionId, error: error.message });
                }
            }
        }

        this.dockerLogStreams.clear();
    }
}