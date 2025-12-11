#!/usr/bin/env node

/**
 * Vehicle Edge Runtime Test Runner
 *
 * A comprehensive test runner that executes different test suites based on command line arguments.
 * Supports unit tests, integration tests, end-to-end tests, and full stack testing.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_CONFIG = JSON.parse(fs.readFileSync('./tests/test-config.json', 'utf8'));

class TestRunner {
    constructor() {
        this.results = {
            unit: { passed: 0, failed: 0, total: 0, duration: 0 },
            integration: { passed: 0, failed: 0, total: 0, duration: 0 },
            e2e: { passed: 0, failed: 0, total: 0, duration: 0 },
            fullStack: { passed: 0, failed: 0, total: 0, duration: 0 },
            mandatoryKuksa: { passed: 0, failed: 0, total: 0, duration: 0 }
        };
        this.overallSuccess = true;
    }

    async runCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            console.log(`🚀 Running: ${command} ${args.join(' ')}`);

            const startTime = Date.now();
            const process = spawn(command, args, {
                stdio: 'inherit',
                ...options
            });

            process.on('close', (code) => {
                const duration = Date.now() - startTime;
                if (code === 0) {
                    resolve({ success: true, code, duration });
                } else {
                    resolve({ success: false, code, duration });
                }
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    async runUnitTests() {
        console.log('\n🧪 Running Unit Tests');
        console.log('=' .repeat(50));

        try {
            const result = await this.runCommand('node', [
                '--test',
                '--test-timeout=' + TEST_CONFIG.testEnvironment.timeout.unit,
                'tests/unit/'
            ], {
                env: {
                    ...process.env,
                    NODE_ENV: 'test'
                }
            });

            this.results.unit.duration = result.duration;
            this.results.unit.success = result.success;

            if (result.success) {
                console.log('✅ Unit tests completed successfully');
            } else {
                console.log('❌ Unit tests failed');
                this.overallSuccess = false;
            }

            return result.success;
        } catch (error) {
            console.error('💥 Error running unit tests:', error.message);
            this.overallSuccess = false;
            return false;
        }
    }

    async runIntegrationTests() {
        console.log('\n🔗 Running Integration Tests');
        console.log('=' .repeat(50));

        try {
            const result = await this.runCommand('node', [
                '--test',
                '--test-timeout=' + TEST_CONFIG.testEnvironment.timeout.integration,
                'tests/integration/'
            ], {
                env: {
                    ...process.env,
                    NODE_ENV: 'test',
                    TEST_WS_PORT: TEST_CONFIG.testEnvironment.wsPort,
                    TEST_HEALTH_PORT: TEST_CONFIG.testEnvironment.healthPort
                }
            });

            this.results.integration.duration = result.duration;
            this.results.integration.success = result.success;

            if (result.success) {
                console.log('✅ Integration tests completed successfully');
            } else {
                console.log('❌ Integration tests failed');
                this.overallSuccess = false;
            }

            return result.success;
        } catch (error) {
            console.error('💥 Error running integration tests:', error.message);
            this.overallSuccess = false;
            return false;
        }
    }

    async runE2ETests() {
        console.log('\n🎯 Running End-to-End Tests');
        console.log('=' .repeat(50));

        try {
            const result = await this.runCommand('node', [
                '--test',
                '--test-timeout=' + TEST_CONFIG.testEnvironment.timeout.e2e,
                'tests/e2e/'
            ], {
                env: {
                    ...process.env,
                    NODE_ENV: 'test',
                    TEST_WS_PORT: 3004,
                    TEST_HEALTH_PORT: 3005
                }
            });

            this.results.e2e.duration = result.duration;
            this.results.e2e.success = result.success;

            if (result.success) {
                console.log('✅ End-to-end tests completed successfully');
            } else {
                console.log('❌ End-to-end tests failed');
                this.overallSuccess = false;
            }

            return result.success;
        } catch (error) {
            console.error('💥 Error running E2E tests:', error.message);
            this.overallSuccess = false;
            return false;
        }
    }

    async runFullStackTests() {
        console.log('\n🚀 Running Full Stack Tests');
        console.log('=' .repeat(50));

        try {
            const result = await this.runCommand('node', [
                'tests/full-stack-test-runner.js'
            ], {
                timeout: TEST_CONFIG.testEnvironment.timeout.fullStack
            });

            this.results.fullStack.duration = result.duration;
            this.results.fullStack.success = result.success;

            if (result.success) {
                console.log('✅ Full stack tests completed successfully');
            } else {
                console.log('❌ Full stack tests failed');
                this.overallSuccess = false;
            }

            return result.success;
        } catch (error) {
            console.error('💥 Error running full stack tests:', error.message);
            this.overallSuccess = false;
            return false;
        }
    }

    async runMandatoryKuksaTests() {
        console.log('\n🚗 Running MANDATORY Kuksa Tests');
        console.log('=' .repeat(50));

        try {
            const result = await this.runCommand('node', [
                'tests/full-stack-mandatory-kuksa-runner.js'
            ], {
                timeout: TEST_CONFIG.testEnvironment.timeout.fullStack
            });

            this.results.mandatoryKuksa.duration = result.duration;
            this.results.mandatoryKuksa.success = result.success;

            if (result.success) {
                console.log('✅ MANDATORY Kuksa tests completed successfully');
                console.log('🚗 REAL Kuksa databroker integration verified');
            } else {
                console.log('❌ MANDATORY Kuksa tests failed');
                console.log('🚗 Kuksa databroker connectivity issues detected');
                this.overallSuccess = false;
            }

            return result.success;
        } catch (error) {
            console.error('💥 Error running MANDATORY Kuksa tests:', error.message);
            console.error('💥 Ensure Kuksa databroker is properly installed and running');
            this.overallSuccess = false;
            return false;
        }
    }

    generateReport() {
        console.log('\n📊 TEST EXECUTION REPORT');
        console.log('=' .repeat(60));

        const testTypes = ['unit', 'integration', 'e2e', 'fullStack', 'mandatoryKuksa'];
        const testNames = {
            unit: 'Unit Tests',
            integration: 'Integration Tests',
            e2e: 'End-to-End Tests',
            fullStack: 'Full Stack Tests',
            mandatoryKuksa: 'MANDATORY Kuksa Tests'
        };

        let totalDuration = 0;
        let totalPassed = 0;
        let totalFailed = 0;

        testTypes.forEach(testType => {
            const result = this.results[testType];
            const status = result.success === undefined ? '⏭️ SKIPPED' :
                           result.success ? '✅ PASSED' : '❌ FAILED';

            console.log(`${status} ${testNames[testType].padEnd(25)} ${this.formatDuration(result.duration)}`);

            if (result.success !== undefined) {
                totalDuration += result.duration;
                if (result.success) {
                    totalPassed++;
                } else {
                    totalFailed++;
                }
            }
        });

        console.log('-' .repeat(60));
        console.log(`📈 SUMMARY: ${totalPassed} passed, ${totalFailed} failed`);
        console.log(`⏱️ TOTAL DURATION: ${this.formatDuration(totalDuration)}`);
        console.log(`🎯 OVERALL STATUS: ${this.overallSuccess ? '✅ SUCCESS' : '❌ FAILURE'}`);

        // Generate JSON report
        this.generateJsonReport();
    }

    generateJsonReport() {
        const reportDir = TEST_CONFIG.reporting.outputDir;
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalSuites: 4,
                passed: Object.values(this.results).filter(r => r.success === true).length,
                failed: Object.values(this.results).filter(r => r.success === false).length,
                skipped: Object.values(this.results).filter(r => r.success === undefined).length,
                totalDuration: Object.values(this.results).reduce((sum, r) => sum + r.duration, 0),
                overallSuccess: this.overallSuccess
            },
            results: this.results,
            configuration: TEST_CONFIG
        };

        const reportPath = path.join(reportDir, `test-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Detailed report saved to: ${reportPath}`);
    }

    formatDuration(ms) {
        if (ms === 0) return '0s';
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test environment...');

        // Remove test data directories
        const testDirs = ['./test-data', './test-data-e2e'];
        testDirs.forEach(dir => {
            if (fs.existsSync(dir)) {
                try {
                    fs.rmSync(dir, { recursive: true, force: true });
                    console.log(`🗑️ Cleaned up ${dir}`);
                } catch (error) {
                    console.log(`⚠️ Could not clean up ${dir}: ${error.message}`);
                }
            }
        });

        // Kill any remaining test processes
        try {
            await this.runCommand('pkill', ['-f', 'node.*test']);
        } catch (error) {
            // Ignore cleanup errors
        }

        console.log('✅ Cleanup completed');
    }

    async run(args) {
        const testTypes = args.length > 0 ? args : ['unit'];

        console.log('🎯 Vehicle Edge Runtime Test Suite');
        console.log(`📅 Started at: ${new Date().toLocaleString()}`);
        console.log(`🧪 Running: ${testTypes.join(', ')}`);

        try {
            // Check prerequisites
            if (testTypes.includes('integration') || testTypes.includes('e2e') || testTypes.includes('fullStack') || testTypes.includes('mandatoryKuksa')) {
                console.log('🔍 Checking prerequisites...');
                await this.checkPrerequisites();
            }

            // Run requested test types
            for (const testType of testTypes) {
                switch (testType) {
                    case 'unit':
                        await this.runUnitTests();
                        break;
                    case 'integration':
                        await this.runIntegrationTests();
                        break;
                    case 'e2e':
                        await this.runE2ETests();
                        break;
                    case 'fullStack':
                        await this.runFullStackTests();
                        break;
                    case 'mandatoryKuksa':
                        await this.runMandatoryKuksaTests();
                        break;
                    case 'all':
                        await this.runUnitTests();
                        await this.runIntegrationTests();
                        await this.runE2ETests();
                        await this.runFullStackTests();
                        break;
                    default:
                        console.error(`❌ Unknown test type: ${testType}`);
                        this.overallSuccess = false;
                }
            }

            // Generate final report
            this.generateReport();

        } catch (error) {
            console.error('💥 Test runner error:', error.message);
            this.overallSuccess = false;
        } finally {
            if (TEST_CONFIG.testEnvironment.cleanupAfterTests) {
                await this.cleanup();
            }
        }

        return this.overallSuccess;
    }

    async checkPrerequisites() {
        try {
            // Check Node.js version
            const nodeVersion = spawn('node', ['--version']);
            await new Promise((resolve, reject) => {
                nodeVersion.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error('Node.js not found'));
                });
            });

            // Check Docker availability (for integration/e2e tests)
            try {
                const dockerVersion = spawn('docker', ['--version']);
                await new Promise((resolve, reject) => {
                    dockerVersion.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error('Docker not found'));
                    });
                });
                console.log('✅ Docker available');
            } catch (error) {
                console.log('⚠️ Docker not available - some tests may fail');
            }

            console.log('✅ Prerequisites checked');
        } catch (error) {
            console.error('❌ Prerequisites check failed:', error.message);
            throw error;
        }
    }
}

// Parse command line arguments
const args = process.argv.slice(2);

// Run test runner
const runner = new TestRunner();
runner.run(args).then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});