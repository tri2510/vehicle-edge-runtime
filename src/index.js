#!/usr/bin/env node

/**
 * Vehicle Edge Runtime - Main Entry Point
 * Simplified runtime environment for Eclipse Autowrx applications
 */

import { VehicleEdgeRuntime } from './core/VehicleEdgeRuntime.js';
import { config } from 'dotenv';

// Load environment variables
config();

const PORT = process.env.PORT || 3002;
const KIT_MANAGER_URL = process.env.KIT_MANAGER_URL || 'ws://localhost:8080';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

async function main() {
    try {
        console.log('Starting Vehicle Edge Runtime...');
        console.log(`Port: ${PORT}`);
        console.log(`Kit Manager URL: ${KIT_MANAGER_URL}`);
        console.log(`Log Level: ${LOG_LEVEL}`);

        const runtime = new VehicleEdgeRuntime({
            port: PORT,
            kitManagerUrl: KIT_MANAGER_URL,
            logLevel: LOG_LEVEL
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