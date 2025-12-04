/**
 * Health Check Utility
 * Provides HTTP health check endpoint for Docker containers
 */

import { createServer } from 'http';
import { Logger } from './Logger.js';

export class HealthCheck {
    constructor(port, runtime) {
        this.port = port;
        this.runtime = runtime;
        this.logger = new Logger('HealthCheck', 'info');
        this.server = null;
    }

    async start() {
        return new Promise((resolve, reject) => {
            this.server = createServer((req, res) => {
                this._handleRequest(req, res);
            });

            this.server.on('error', (error) => {
                this.logger.error('Health check server error', { error: error.message });
                reject(error);
            });

            this.server.listen(this.port, () => {
                this.logger.info('Health check server started', { port: this.port });
                resolve();
            });
        });
    }

    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    this.logger.info('Health check server stopped');
                    resolve();
                });
            });
        }
    }

    _handleRequest(req, res) {
        const url = req.url;

        try {
            if (url === '/health') {
                this._handleHealthCheck(req, res);
            } else if (url === '/ready') {
                this._handleReadyCheck(req, res);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not Found' }));
            }
        } catch (error) {
            this.logger.error('Health check request error', { url, error: error.message });
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
    }

    _handleHealthCheck(req, res) {
        const status = this.runtime.getStatus();
        const isHealthy = this.runtime.isRunning && status.connectedClients >= 0;

        const healthStatus = {
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            runtime: status,
            checks: {
                runtime: {
                    status: this.runtime.isRunning ? 'pass' : 'fail',
                    component: 'VehicleEdgeRuntime'
                },
                websocket: {
                    status: status.connectedClients >= 0 ? 'pass' : 'fail',
                    component: 'WebSocketServer'
                },
                memory: {
                    status: process.memoryUsage().heapUsed < 500 * 1024 * 1024 ? 'pass' : 'warn',
                    component: 'Memory',
                    usage: process.memoryUsage()
                }
            }
        };

        const statusCode = isHealthy ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthStatus, null, 2));
    }

    _handleReadyCheck(req, res) {
        const status = this.runtime.getStatus();
        const isReady = this.runtime.isRunning && status.kitManagerConnected;

        const readyStatus = {
            status: isReady ? 'ready' : 'not-ready',
            timestamp: new Date().toISOString(),
            runtime: status
        };

        const statusCode = isReady ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(readyStatus, null, 2));
    }
}