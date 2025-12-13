#!/usr/bin/env node

/**
 * Vehicle Edge Runtime - Main Entry Point
 * Simplified runtime environment for Eclipse Autowrx applications
 */

import { VehicleEdgeRuntime } from './core/VehicleEdgeRuntime.js';
import { config } from 'dotenv';

// Load environment variables
config();

// Parse command line arguments
const args = process.argv.slice(2);
let PORT = process.env.PORT || 3002;
let KIT_MANAGER_URL = process.env.KIT_MANAGER_URL || 'ws://localhost:3090';
let LOG_LEVEL = process.env.LOG_LEVEL || 'info';
let SKIP_KIT_MANAGER = process.env.SKIP_KIT_MANAGER === 'true';
let RUNTIME_ID = process.env.RUNTIME_ID || null;

for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
        case '--port':
            PORT = args[++i];
            break;
        case '--kit-manager-url':
            KIT_MANAGER_URL = args[++i];
            break;
        case '--log-level':
            LOG_LEVEL = args[++i];
            break;
        case '--skip-kit-manager':
            SKIP_KIT_MANAGER = true;
            break;
        case '--runtime-id':
            RUNTIME_ID = args[++i];
            break;
    }
}

async function main() {
    try {
        console.log('Starting Vehicle Edge Runtime...');
        console.log(`Port: ${PORT}`);
        console.log(`Kit Manager URL: ${KIT_MANAGER_URL}`);
        console.log(`Log Level: ${LOG_LEVEL}`);
        if (RUNTIME_ID) console.log(`Runtime ID: ${RUNTIME_ID}`);
        if (SKIP_KIT_MANAGER) console.log('Kit Manager: DISABLED');

        const runtime = new VehicleEdgeRuntime({
            port: PORT,
            kitManagerUrl: KIT_MANAGER_URL,
            logLevel: LOG_LEVEL,
            skipKitManager: SKIP_KIT_MANAGER,
            dataPath: process.env.DATA_DIR || './data'
        });

        await runtime.start();

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('Received SIGINT, shutting down gracefully...');
            await runtime.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('Received SIGTERM, shutting down gracefully...');
            await runtime.stop();
            process.exit(0);
        });

        console.log('Vehicle Edge Runtime started successfully');

    } catch (error) {
        console.error('Failed to start Vehicle Edge Runtime:', error);
        process.exit(1);
    }
}

// Run main function
main().catch(error => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
});