/**
 * Resource Monitor
 * Lightweight resource monitoring for Vehicle Edge Runtime applications
 */

import { Logger } from '../utils/Logger.js';
import Docker from 'dockerode';

export class ResourceMonitor {
    constructor(options = {}) {
        this.options = {
            interval: options.interval || 30000, // 30 seconds
            maxHistory: options.maxHistory || 1000,
            thresholds: {
                cpu_percent: 80,
                memory_percent: 80,
                disk_usage: 1024 * 1024 * 1024, // 1GB
                network_bytes: 100 * 1024 * 1024 // 100MB
            },
            ...options
        };
        this.logger = new Logger('ResourceMonitor', options.logLevel);
        this.docker = new Docker();
        this.monitoring = false;
        this.intervalId = null;
        this.metricsHistory = new Map(); // appId -> array of metrics
        this.alerts = [];
    }

    async start() {
        if (this.monitoring) {
            this.logger.warn('Resource monitoring already started');
            return;
        }

        this.logger.info('Starting resource monitoring', { interval: this.options.interval });
        this.monitoring = true;

        // Start monitoring interval
        this.intervalId = setInterval(async () => {
            await this.collectMetrics();
        }, this.options.interval);

        // Collect initial metrics
        await this.collectMetrics();

        this.logger.info('Resource monitoring started');
    }

    async stop() {
        if (!this.monitoring) {
            return;
        }

        this.logger.info('Stopping resource monitoring');
        this.monitoring = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.logger.info('Resource monitoring stopped');
    }

    async collectMetrics() {
        try {
            const containers = await this.docker.listContainers();

            for (const container of containers) {
                // Check if this is a vehicle-edge application container
                if (container.Names.some(name => name.includes('/vehicle-edge-app-'))) {
                    await this.collectContainerMetrics(container);
                }
            }

        } catch (error) {
            this.logger.error('Failed to collect metrics', { error: error.message });
        }
    }

    async collectContainerMetrics(containerInfo) {
        try {
            const container = this.docker.getContainer(containerInfo.Id);
            const stats = await container.stats({ stream: false });
            const inspect = await container.inspect();

            // Extract app ID from container name or labels
            const appId = this.extractAppId(container);
            if (!appId) {
                return;
            }

            // Calculate resource usage
            const metrics = {
                appId,
                containerId: containerInfo.Id,
                timestamp: new Date().toISOString(),
                resources: {
                    // CPU usage percentage
                    cpu_percent: this.calculateCpuPercent(stats),

                    // Memory usage
                    memory_rss: stats.memory_stats.usage,
                    memory_limit: stats.memory_stats.limit,
                    memory_percent: ((stats.memory_stats.usage / stats.memory_stats.limit) * 100).toFixed(2),

                    // Network I/O
                    network_bytes_in: stats.networks ? Object.values(stats.networks).reduce((sum, net) => sum + net.rx_bytes, 0) : 0,
                    network_bytes_out: stats.networks ? Object.values(stats.networks).reduce((sum, net) => sum + net.tx_bytes, 0) : 0,

                    // Block I/O
                    block_read: stats.blkio_stats ? stats.blkio_stats.io_service_bytes_recursive?.Read || 0 : 0,
                    block_write: stats.blkio_stats ? stats.blkio_stats.io_service_bytes_recursive?.Write || 0 : 0,

                    // PIDs
                    pids: stats.pids_stats?.current || 1,

                    // Uptime
                    uptime_seconds: this.calculateUptime(inspect),

                    // Container status
                    status: inspect.State.Status,

                    // Disk usage (approximation)
                    disk_usage: await this.getDiskUsage(appId)
                }
            };

            // Store metrics in history
            this.storeMetrics(appId, metrics);

            // Check for threshold breaches
            await this.checkThresholds(metrics);

            this.logger.debug('Metrics collected', {
                appId,
                cpu_percent: metrics.resources.cpu_percent,
                memory_percent: metrics.resources.memory_percent,
                status: metrics.resources.status
            });

        } catch (error) {
            this.logger.error('Failed to collect container metrics', {
                containerId: containerInfo.Id,
                error: error.message
            });
        }
    }

    calculateCpuPercent(stats) {
        try {
            // Calculate CPU percentage based on Docker stats
            const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
            const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;

            if (systemDelta > 0 && cpuDelta > 0) {
                const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
                return Math.round(cpuPercent * 100) / 100; // Round to 2 decimal places
            }

            return 0;
        } catch (error) {
            return 0;
        }
    }

    calculateUptime(inspect) {
        try {
            if (inspect.State.StartedAt) {
                const started = new Date(inspect.State.StartedAt);
                const now = new Date();
                return Math.floor((now - started) / 1000);
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    async getDiskUsage(appId) {
        try {
            // This is an approximation - actual disk usage would require container filesystem access
            // For now, we'll use a reasonable default based on typical application usage
            return 50 * 1024 * 1024; // 50MB default
        } catch (error) {
            return 0;
        }
    }

    extractAppId(container) {
        try {
            // Try to get app ID from container name
            const name = container.Names[0];
            const match = name.match(/vehicle-edge-app-([a-f0-9-]+)/);
            if (match) {
                return match[1];
            }

            // Try to get from labels
            if (container.Labels && container.Labels['app.id']) {
                return container.Labels['app.id'];
            }

            // Try to get from environment variables
            if (container.Labels && container.Labels['com.docker.compose.project']) {
                return container.Labels['com.docker.compose.project'];
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    storeMetrics(appId, metrics) {
        if (!this.metricsHistory.has(appId)) {
            this.metricsHistory.set(appId, []);
        }

        const history = this.metricsHistory.get(appId);
        history.push(metrics);

        // Limit history size
        while (history.length > this.options.maxHistory) {
            history.shift();
        }
    }

    async checkThresholds(metrics) {
        const { appId, resources } = metrics;
        const breaches = [];

        // Check CPU threshold
        if (resources.cpu_percent > this.options.thresholds.cpu_percent) {
            breaches.push({
                type: 'cpu',
                value: resources.cpu_percent,
                threshold: this.options.thresholds.cpu_percent,
                severity: resources.cpu_percent > 90 ? 'critical' : 'warning'
            });
        }

        // Check memory threshold
        if (parseFloat(resources.memory_percent) > this.options.thresholds.memory_percent) {
            breaches.push({
                type: 'memory',
                value: parseFloat(resources.memory_percent),
                threshold: this.options.thresholds.memory_percent,
                severity: parseFloat(resources.memory_percent) > 90 ? 'critical' : 'warning'
            });
        }

        // Check disk threshold
        if (resources.disk_usage > this.options.thresholds.disk_usage) {
            breaches.push({
                type: 'disk',
                value: resources.disk_usage,
                threshold: this.options.thresholds.disk_usage,
                severity: 'warning'
            });
        }

        // Check network threshold
        const totalNetwork = resources.network_bytes_in + resources.network_bytes_out;
        if (totalNetwork > this.options.thresholds.network_bytes) {
            breaches.push({
                type: 'network',
                value: totalNetwork,
                threshold: this.options.thresholds.network_bytes,
                severity: 'warning'
            });
        }

        if (breaches.length > 0) {
            const alert = {
                appId,
                timestamp: metrics.timestamp,
                breaches,
                metrics: resources
            };

            this.alerts.push(alert);

            // Limit alerts history
            while (this.alerts.length > this.options.maxHistory) {
                this.alerts.shift();
            }

            this.logger.warn('Resource threshold breach detected', {
                appId,
                breaches: breaches.map(b => `${b.type}: ${b.value}% (threshold: ${b.threshold}%)`)
            });
        }
    }

    getMetrics(appId, options = {}) {
        const { limit = 100, startTime, endTime } = options;
        let history = this.metricsHistory.get(appId) || [];

        // Filter by time range
        if (startTime) {
            const start = new Date(startTime);
            history = history.filter(m => new Date(m.timestamp) >= start);
        }

        if (endTime) {
            const end = new Date(endTime);
            history = history.filter(m => new Date(m.timestamp) <= end);
        }

        // Limit results
        if (limit && history.length > limit) {
            history = history.slice(-limit);
        }

        return history;
    }

    getLatestMetrics(appId) {
        const history = this.metricsHistory.get(appId);
        return history && history.length > 0 ? history[history.length - 1] : null;
    }

    getAllLatestMetrics() {
        const latest = {};
        for (const [appId, history] of this.metricsHistory) {
            if (history.length > 0) {
                latest[appId] = history[history.length - 1];
            }
        }
        return latest;
    }

    getAggregatedMetrics(appId, options = {}) {
        const { period = 3600000 } = options; // Default 1 hour
        const history = this.metricsHistory.get(appId) || [];
        const cutoff = new Date(Date.now() - period);

        const recentMetrics = history.filter(m => new Date(m.timestamp) >= cutoff);

        if (recentMetrics.length === 0) {
            return null;
        }

        // Calculate aggregates
        const cpuValues = recentMetrics.map(m => m.resources.cpu_percent);
        const memoryValues = recentMetrics.map(m => parseFloat(m.resources.memory_percent));
        const networkInValues = recentMetrics.map(m => m.resources.network_bytes_in);
        const networkOutValues = recentMetrics.map(m => m.resources.network_bytes_out);

        return {
            appId,
            period,
            sampleCount: recentMetrics.length,
            cpu: {
                average: this.average(cpuValues),
                min: Math.min(...cpuValues),
                max: Math.max(...cpuValues)
            },
            memory: {
                average: this.average(memoryValues),
                min: Math.min(...memoryValues),
                max: Math.max(...memoryValues)
            },
            network: {
                in: {
                    total: networkInValues[networkInValues.length - 1] - networkInValues[0],
                    average: this.average(networkInValues)
                },
                out: {
                    total: networkOutValues[networkOutValues.length - 1] - networkOutValues[0],
                    average: this.average(networkOutValues)
                }
            },
            timeRange: {
                start: recentMetrics[0].timestamp,
                end: recentMetrics[recentMetrics.length - 1].timestamp
            }
        };
    }

    getAlerts(options = {}) {
        const { appId, severity, limit = 100 } = options;
        let alerts = [...this.alerts];

        // Filter by app ID
        if (appId) {
            alerts = alerts.filter(a => a.appId === appId);
        }

        // Filter by severity
        if (severity) {
            alerts = alerts.filter(a =>
                a.breaches.some(b => b.severity === severity)
            );
        }

        // Limit results
        if (limit) {
            alerts = alerts.slice(-limit);
        }

        return alerts;
    }

    average(values) {
        if (values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    async cleanup() {
        await this.stop();
        this.metricsHistory.clear();
        this.alerts = [];
        this.logger.info('Resource monitor cleaned up');
    }
}