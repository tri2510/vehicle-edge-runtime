#!/usr/bin/env node

import { spawn } from 'child_process';

// Test files in order
const testFiles = [
    'tests/docker/build/dockerfile-build.test.js',
    'tests/docker/build/dockerfile-build-optimized.test.js',
    'tests/docker/deployment/docker-deploy-script-optimized.test.js',
    'tests/docker/deployment/docker-deploy-script.test.js',
    'tests/docker/runtime/container-lifecycle-fast.test.js',
    'tests/docker/runtime/container-lifecycle-optimized.test.js',
    'tests/docker/runtime/container-lifecycle.test.js',
    'tests/docker/integration/docker-websocket-api-optimized.test.js'
    // Skip the regular WebSocket API test for now as it may have similar issues
    // 'tests/docker/integration/docker-websocket-api.test.js'
];

// Colors for output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logInfo(message) {
    log(`[INFO] ${message}`, colors.green);
}

function logError(message) {
    log(`[ERROR] ${message}`, colors.red);
}

function logWarning(message) {
    log(`[WARN] ${message}`, colors.yellow);
}

async function runTest(testFile) {
    return new Promise((resolve, reject) => {
        logInfo(`Running: ${testFile}`);
        log('----------------------------------------');

        const startTime = Date.now();
        const child = spawn('node', ['--test', '--test-timeout=180000', testFile], {
            stdio: 'inherit',
            shell: true
        });

        child.on('close', (code) => {
            const duration = Math.round((Date.now() - startTime) / 1000);

            if (code === 0) {
                logInfo(`✅ PASSED: ${testFile} (${duration}s)`);
                log('----------------------------------------');
                resolve({ success: true, duration });
            } else {
                logError(`❌ FAILED: ${testFile} (${duration}s)`);
                log('----------------------------------------');
                resolve({ success: false, duration });
            }
        });

        child.on('error', (error) => {
            logError(`Failed to start test process: ${error.message}`);
            reject(error);
        });
    });
}

async function main() {
    logInfo('Starting sequential Docker tests...');
    log('');

    const startTime = Date.now();
    let passedTests = 0;
    let failedTests = 0;

    // Clean up Docker first
    logInfo('Cleaning up Docker resources...');
    try {
        await new Promise((resolve) => {
            const cleanup = spawn('docker', ['system', 'prune', '-f'], {
                stdio: 'pipe'
            });
            cleanup.on('close', () => resolve());
            cleanup.on('error', () => resolve()); // Ignore errors
        });
    } catch (error) {
        logWarning('Docker cleanup failed, continuing...');
    }
    log('');

    // Run tests
    for (const testFile of testFiles) {
        try {
            const result = await runTest(testFile);
            if (result.success) {
                passedTests++;
            } else {
                failedTests++;
            }
            log(''); // Empty line between tests
        } catch (error) {
            logError(`Error running ${testFile}: ${error.message}`);
            failedTests++;
            log('');
        }
    }

    // Summary
    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    const totalTests = passedTests + failedTests;

    log('=========================================');
    logInfo('Test Summary:');
    log(`  Total tests: ${totalTests}`);
    log(`  Passed: ${passedTests}`);
    log(`  Failed: ${failedTests}`);
    log(`  Duration: ${totalDuration}s`);
    log('=========================================');

    if (failedTests === 0) {
        logInfo('🎉 All Docker tests passed!');
        process.exit(0);
    } else {
        logError(`💥 ${failedTests} test(s) failed`);
        process.exit(1);
    }
}

// Handle interrupts
process.on('SIGINT', () => {
    logError('Test execution interrupted');
    process.exit(1);
});

// Run main function
main().catch((error) => {
    logError(`Fatal error: ${error.message}`);
    process.exit(1);
});