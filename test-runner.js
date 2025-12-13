/**
 * Test Runner for Vehicle Edge Runtime
 * Provides unified interface for running different test suites
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export class TestRunner {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || process.cwd();
        this.timeout = options.timeout || 60000;
    }

    async runUnitTests() {
        console.log('🧪 Running Unit Tests...');
        try {
            const { stdout, stderr } = await execAsync('node --test tests/unit/ApplicationManager.test.js tests/unit/VehicleEdgeRuntime.test.js', {
                cwd: this.projectRoot,
                timeout: this.timeout
            });
            
            if (stderr) {
                console.error('Unit test errors:', stderr);
            }
            
            console.log('Unit tests completed');
            return { success: true, output: stdout, error: stderr };
        } catch (error) {
            console.error('Unit tests failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async runIntegrationTests() {
        console.log('🔗 Running Integration Tests...');
        try {
            const { stdout, stderr } = await execAsync('node --test tests/integration/websocket-api.test.js', {
                cwd: this.projectRoot,
                timeout: this.timeout * 2 // Integration tests may take longer
            });
            
            if (stderr) {
                console.error('Integration test errors:', stderr);
            }
            
            console.log('Integration tests completed');
            return { success: true, output: stdout, error: stderr };
        } catch (error) {
            console.error('Integration tests failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async runE2ETests() {
        console.log('🎯 Running E2E Tests...');
        try {
            const { stdout, stderr } = await execAsync('node --test tests/e2e/vehicle-app-lifecycle.test.js', {
                cwd: this.projectRoot,
                timeout: this.timeout * 3 // E2E tests take the longest
            });
            
            if (stderr) {
                console.error('E2E test errors:', stderr);
            }
            
            console.log('E2E tests completed');
            return { success: true, output: stdout, error: stderr };
        } catch (error) {
            console.error('E2E tests failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async runDockerTests() {
        console.log('🐳 Running Docker Tests...');
        try {
            const { stdout, stderr } = await execAsync('node --test tests/docker/deployment/docker-deploy-script.test.js tests/docker/integration/docker-websocket-api.test.js tests/docker/runtime/container-lifecycle.test.js', {
                cwd: this.projectRoot,
                timeout: this.timeout * 4 // Docker tests can be slow
            });
            
            if (stderr) {
                console.error('Docker test errors:', stderr);
            }
            
            console.log('Docker tests completed');
            return { success: true, output: stdout, error: stderr };
        } catch (error) {
            console.error('Docker tests failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async runAllTests() {
        console.log('🚀 Running All Test Suites...');
        
        const results = {
            unit: await this.runUnitTests(),
            integration: await this.runIntegrationTests(),
            e2e: await this.runE2ETests(),
            docker: await this.runDockerTests()
        };

        const summary = {
            total: Object.keys(results).length,
            passed: Object.values(results).filter(r => r.success).length,
            failed: Object.values(results).filter(r => !r.success).length,
            results
        };

        console.log('\n📊 Test Summary:');
        console.log(`Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}`);

        return summary;
    }

    async runBasicValidation() {
        console.log('✅ Running Basic Validation...');
        try {
            const { stdout, stderr } = await execAsync('node --test tests/basic-validation.test.js', {
                cwd: this.projectRoot,
                timeout: 30000
            });
            
            console.log('Basic validation completed');
            return { success: true, output: stdout, error: stderr };
        } catch (error) {
            console.error('Basic validation failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// CLI interface for standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const testRunner = new TestRunner();
    const testType = process.argv[2] || 'all';

    switch (testType.toLowerCase()) {
        case 'unit':
            await testRunner.runUnitTests();
            break;
        case 'integration':
            await testRunner.runIntegrationTests();
            break;
        case 'e2e':
            await testRunner.runE2ETests();
            break;
        case 'docker':
            await testRunner.runDockerTests();
            break;
        case 'validation':
            await testRunner.runBasicValidation();
            break;
        case 'all':
        default:
            await testRunner.runAllTests();
            break;
    }
}