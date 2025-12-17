#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Comprehensive Docker Test Runner
 * Uses fast test as precondition for longer tests
 */

class DockerTestRunner {
    constructor() {
        this.testResults = {
            fast: { passed: 0, failed: 0, duration: 0, status: 'pending' },
            build: { passed: 0, failed: 0, duration: 0, status: 'pending' },
            deployment: { passed: 0, failed: 0, duration: 0, status: 'pending' },
            integration: { passed: 0, failed: 0, duration: 0, status: 'pending' },
            runtime: { passed: 0, failed: 0, duration: 0, status: 'pending' }
        };

        this.startTime = Date.now();
        this.overallStatus = 'pending';
    }

    /**
     * Run a test file and capture results
     */
    async runTest(testPath, testName, timeout = 60000) {
        console.log(`\n🧪 Running ${testName}...`);
        console.log(`📂 Test file: ${testPath}`);

        return new Promise((resolve) => {
            const startTime = Date.now();
            let stdout = '';
            let stderr = '';
            let passedCount = 0;
            let failedCount = 0;

            const testProcess = spawn('node', ['--test', testPath, `--timeout=${timeout}`], {
                stdio: 'pipe',
                cwd: process.cwd()
            });

            testProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                console.log(output.trim());

                // Parse TAP output for test results
                const lines = output.split('\n');
                for (const line of lines) {
                    if (line.match(/^ok\s+\d+/)) {
                        passedCount++;
                    } else if (line.match(/^not ok\s+\d+/)) {
                        failedCount++;
                    }
                }
            });

            testProcess.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                console.error(output.trim());
            });

            testProcess.on('close', (code) => {
                const duration = Date.now() - startTime;
                const status = code === 0 ? 'passed' : 'failed';

                resolve({
                    status,
                    passed: passedCount,
                    failed: failedCount,
                    duration,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: code
                });
            });

            testProcess.on('error', (error) => {
                const duration = Date.now() - startTime;
                resolve({
                    status: 'failed',
                    passed: 0,
                    failed: 1,
                    duration,
                    stdout: '',
                    stderr: error.message,
                    exitCode: -1
                });
            });

            // Handle timeout
            setTimeout(() => {
                testProcess.kill('SIGKILL');
                const duration = Date.now() - startTime;
                resolve({
                    status: 'failed',
                    passed: 0,
                    failed: 1,
                    duration,
                    stdout: stdout,
                    stderr: `Test timeout after ${timeout}ms`,
                    exitCode: -1
                });
            }, timeout);
        });
    }

    /**
     * Parse comprehensive test results from output
     */
    parseTestResults(output, testName) {
        const lines = output.split('\n');
        const results = {
            passed: 0,
            failed: 0,
            suites: 0,
            cancelled: 0,
            skipped: 0,
            duration: 0
        };

        for (const line of lines) {
            if (line.match(/^# tests\s+(\d+)/)) {
                results.total = parseInt(line.match(/^# tests\s+(\d+)/)[1]);
            } else if (line.match(/^# pass\s+(\d+)/)) {
                results.passed = parseInt(line.match(/^# pass\s+(\d+)/)[1]);
            } else if (line.match(/^# fail\s+(\d+)/)) {
                results.failed = parseInt(line.match(/^# fail\s+(\d+)/)[1]);
            } else if (line.match(/^# suites\s+(\d+)/)) {
                results.suites = parseInt(line.match(/^# suites\s+(\d+)/)[1]);
            } else if (line.match(/^# cancelled\s+(\d+)/)) {
                results.cancelled = parseInt(line.match(/^# cancelled\s+(\d+)/)[1]);
            } else if (line.match(/^# skipped\s+(\d+)/)) {
                results.skipped = parseInt(line.match(/^# skipped\s+(\d+)/)[1]);
            } else if (line.match(/^# duration_ms\s+(\d+)/)) {
                results.duration = parseInt(line.match(/^# duration_ms\s+(\d+)/)[1]);
            }
        }

        return results;
    }

    /**
     * Run comprehensive Docker test suite
     */
    async runComprehensiveTests() {
        console.log('🚀 Starting Comprehensive Docker Test Suite');
        console.log('==========================================');

        const overallStartTime = Date.now();

        // Test configuration
        const tests = [
            {
                name: 'Fast Precondition Test',
                path: 'tests/docker/runtime/container-lifecycle-fast.test.js',
                category: 'fast',
                timeout: 20000,
                critical: true // Fast test is critical precondition
            },
            {
                name: 'Docker Build Tests',
                path: 'tests/docker/build/dockerfile-build-optimized.test.js',
                category: 'build',
                timeout: 60000,
                critical: false
            },
            {
                name: 'Docker Deployment Tests',
                path: 'tests/docker/deployment/docker-deploy-script.test.js',
                category: 'deployment',
                timeout: 90000,
                critical: false
            },
            {
                name: 'Docker Integration Tests',
                path: 'tests/docker/integration/docker-websocket-api-optimized.test.js',
                category: 'integration',
                timeout: 45000,
                critical: false
            },
            {
                name: 'Docker Runtime Tests',
                path: 'tests/docker/runtime/container-lifecycle-optimized.test.js',
                category: 'runtime',
                timeout: 60000,
                critical: false
            }
        ];

        let criticalTestsPassed = true;
        const executedTests = [];
        const failedTests = [];

        // Run tests sequentially, stopping if critical tests fail
        for (const test of tests) {
            // Skip non-critical tests if critical tests failed
            if (test.critical || criticalTestsPassed) {
                console.log(`\n${'='.repeat(50)}`);
                console.log(`📋 Running: ${test.name}`);
                console.log(`${'='.repeat(50)}`);

                const result = await this.runTest(test.path, test.name, test.timeout);

                // Parse detailed results
                const detailedResults = this.parseTestResults(result.stdout, test.name);

                this.testResults[test.category] = {
                    ...result,
                    ...detailedResults,
                    status: result.status
                };

                executedTests.push({
                    name: test.name,
                    category: test.category,
                    ...result,
                    ...detailedResults,
                    critical: test.critical
                });

                // Check if critical test failed
                if (test.critical && result.status !== 'passed') {
                    console.log(`\n❌ CRITICAL TEST FAILED: ${test.name}`);
                    console.log('Stopping further test execution...');
                    criticalTestsPassed = false;
                    failedTests.push(test.name);
                    break;
                } else if (result.status !== 'passed') {
                    failedTests.push(test.name);
                }
            } else {
                console.log(`\n⏭️  Skipping ${test.name} (critical tests failed)`);
                this.testResults[test.category] = {
                    status: 'skipped',
                    passed: 0,
                    failed: 0,
                    duration: 0,
                    reason: 'Critical tests failed'
                };
            }
        }

        const overallDuration = Date.now() - overallStartTime;
        this.overallStatus = criticalTestsPassed && failedTests.length === 0 ? 'passed' : 'failed';

        // Generate final report
        this.generateReport(executedTests, failedTests, overallDuration);
    }

    /**
     * Generate comprehensive test report
     */
    generateReport(executedTests, failedTests, overallDuration) {
        console.log('\n');
        console.log('📊 COMPREHENSIVE DOCKER TEST REPORT');
        console.log('=====================================');

        // Overall status
        const statusIcon = this.overallStatus === 'passed' ? '✅' : '❌';
        console.log(`\n${statusIcon} Overall Status: ${this.overallStatus.toUpperCase()}`);
        console.log(`⏱️  Total Duration: ${(overallDuration / 1000).toFixed(2)}s`);

        // Test summary table
        console.log('\n📋 Test Execution Summary:');
        console.log('┌─────────────────────────────────────┬──────────┬─────────┬─────────┬──────────────┬──────────┐');
        console.log('│ Test Name                            │ Status   │ Passed │ Failed │ Duration (s) │ Critical │');
        console.log('├─────────────────────────────────────┼──────────┼─────────┼─────────┼──────────────┼──────────┤');

        for (const test of executedTests) {
            const statusIcon = test.status === 'passed' ? '✅' : test.status === 'skipped' ? '⏭️' : '❌';
            const passed = test.passed || 0;
            const failed = test.failed || 0;
            const duration = (test.duration / 1000).toFixed(2);
            const critical = test.critical ? 'Yes' : 'No';

            console.log(`│ ${test.name.padEnd(36)} │ ${statusIcon} ${test.status.padEnd(7)} │ ${passed.toString().padEnd(7)} │ ${failed.toString().padEnd(7)} │ ${duration.padEnd(12)} │ ${critical.padEnd(8)} │`);
        }

        console.log('└─────────────────────────────────────┴──────────┴─────────┴─────────┴──────────────┴──────────┘');

        // Category breakdown
        console.log('\n📈 Test Category Breakdown:');
        for (const [category, results] of Object.entries(this.testResults)) {
            if (results.status !== 'pending') {
                const statusIcon = results.status === 'passed' ? '✅' : results.status === 'skipped' ? '⏭️' : '❌';
                const duration = results.duration ? (results.duration / 1000).toFixed(2) : 'N/A';
                console.log(`  ${statusIcon} ${category.padEnd(12)}: ${results.status.padEnd(8)} (${duration}s)`);
            }
        }

        // Failed tests details
        if (failedTests.length > 0) {
            console.log('\n❌ Failed Tests:');
            for (const testName of failedTests) {
                console.log(`  • ${testName}`);
            }
        }

        // Critical test status
        console.log('\n🚨 Critical Test Status:');
        const fastTest = this.testResults.fast;
        if (fastTest.status === 'passed') {
            console.log('  ✅ Fast precondition test PASSED - longer tests executed');
        } else {
            console.log('  ❌ Fast precondition test FAILED - longer tests skipped');
        }

        // Recommendations
        console.log('\n💡 Recommendations:');
        if (this.overallStatus === 'passed') {
            console.log('  ✅ All tests passed - Docker environment is ready');
            console.log('  ✅ Ready for production deployment');
        } else {
            if (fastTest.status !== 'passed') {
                console.log('  🔧 Fix fast test issues before proceeding');
                console.log('  🔧 Check Docker daemon status and permissions');
            }
            if (failedTests.length > 0) {
                console.log('  🔧 Review failed test logs for specific issues');
                console.log('  🔧 Check Docker images and container configurations');
            }
        }

        // Exit with appropriate code
        const exitCode = this.overallStatus === 'passed' ? 0 : 1;
        console.log(`\n🏁 Exiting with code: ${exitCode}`);
        process.exit(exitCode);
    }
}

// Run comprehensive tests
if (import.meta.url === `file://${process.argv[1]}`) {
    const runner = new DockerTestRunner();
    runner.runComprehensiveTests().catch(console.error);
}

export default DockerTestRunner;