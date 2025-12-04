/**
 * Runtime Registry
 * Manages runtime registration and metadata
 */

import { Logger } from '../utils/Logger.js';

export class RuntimeRegistry {
    constructor(options = {}) {
        this.options = options;
        this.logger = new Logger('RuntimeRegistry', options.logLevel);
        this.runtimeInfo = null;
        this.capabilities = [
            'python_app_execution',
            'binary_app_execution',
            'console_output',
            'app_status_monitoring',
            'runtime_state_reporting'
        ];
    }

    initialize() {
        this.logger.info('Initializing Runtime Registry');

        this.runtimeInfo = {
            name: 'Vehicle Edge Runtime',
            version: '1.0.0',
            description: 'Simplified application execution environment for Eclipse Autowrx',
            capabilities: this.capabilities,
            supportedAppTypes: ['python', 'binary'],
            maxConcurrentApps: 10,
            features: {
                realtime_console: true,
                app_lifecycle_management: true,
                status_monitoring: true,
                docker_execution: true
            }
        };

        this.logger.info('Runtime Registry initialized', { capabilities: this.capabilities.length });
    }

    getRuntimeInfo() {
        return {
            ...this.runtimeInfo,
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: process.memoryUsage()
        };
    }

    getCapabilities() {
        return this.capabilities;
    }

    hasCapability(capability) {
        return this.capabilities.includes(capability);
    }
}