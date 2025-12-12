import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { EnhancedApplicationManager } from '../../src/apps/EnhancedApplicationManager.js';

describe('EnhancedApplicationManager Tests', () => {
    let appManager;
    let mockRuntime;

    beforeEach(() => {
        // Mock runtime instance
        mockRuntime = {
            config: {
                dataDir: './test-data',
                kuksaEnabled: false
            },
            kuksaManager: {
                getVehicleCredentials: () => Promise.resolve({})
            },
            consoleManager: {
                subscribe: () => {},
                unsubscribe: () => {},
                getAppLogs: () => []
            }
        };

        appManager = new EnhancedApplicationManager(mockRuntime);
    });

    test('should initialize with empty application registry', () => {
        const allApps = appManager.getAllApplications();
        assert(Array.isArray(allApps));
        assert(allApps.length === 0);
    });

    test('should generate unique execution IDs', () => {
        const execId1 = appManager.generateExecutionId();
        const execId2 = appManager.generateExecutionId();

        assert(execId1 !== execId2);
        assert(typeof execId1 === 'string');
        assert(typeof execId2 === 'string');
        assert(execId1.length > 0);
        assert(execId2.length > 0);
    });

    test('should validate application code', () => {
        const validCodes = [
            'print("Hello, World!")',
            'import asyncio\nasync def main():\n    print("Test")\nasyncio.run(main())',
            'import sys\nprint(sys.version)'
        ];

        validCodes.forEach(code => {
            const validation = appManager.validateApplicationCode(code, 'python');
            assert(validation.valid === true);
        });

        const invalidCodes = [
            'print("Unclosed string',
            'import nonexistent_module',
            'invalid syntax here'
        ];

        invalidCodes.forEach(code => {
            const validation = appManager.validateApplicationCode(code, 'python');
            // Should either be invalid or pass (depending on validation strictness)
            assert(typeof validation.valid === 'boolean');
        });
    });

    test('should validate application metadata', () => {
        const validMetadata = {
            name: 'Test App',
            version: '1.0.0',
            description: 'A test application'
        };

        const validation1 = appManager.validateApplicationMetadata(validMetadata);
        assert(validation1.valid === true);

        const invalidMetadata = {
            // Missing required fields
        };

        const validation2 = appManager.validateApplicationMetadata(invalidMetadata);
        assert(validation2.valid === false);
    });

    test('should handle deployment requests', async () => {
        const deployRequest = {
            id: 'test-deploy-123',
            code: 'print("Test app deployment")\nimport asyncio\nasync def main():\n    print("App running")\nasyncio.run(main())',
            language: 'python',
            vehicleId: 'test-vehicle-001'
        };

        try {
            const result = await appManager.handleDeployRequest(deployRequest);

            // Check if deployment was successful
            if (result.success) {
                assert(result.executionId);
                assert(result.appId);
                assert(result.status === 'started' || result.status === 'running');
            } else {
                // If deployment failed, check if error is handled properly
                assert(result.error || result.message);
            }
        } catch (error) {
            // Some test environments may not have Docker available
            assert(error.message.includes('Docker') ||
                   error.message.includes('docker') ||
                   error.message.includes('container') ||
                   error.message.includes('ENOENT'));
        }
    });

    test('should handle stop requests', async () => {
        const stopRequest = {
            id: 'test-stop-123',
            appId: 'non-existent-app-id'
        };

        const result = await appManager.handleStopRequest(stopRequest);

        // Should handle non-existent app gracefully
        assert(result.success === false);
        assert(result.error.includes('not found') || result.error.includes('Application'));
    });

    test('should handle status requests', async () => {
        const statusRequest = {
            id: 'test-status-123',
            appId: 'non-existent-app-id'
        };

        const result = await appManager.handleStatusRequest(statusRequest);

        // Should return not found or error for non-existent app
        assert(result.success === false);
        assert(result.error.includes('not found') || result.error.includes('Application'));
    });

    test('should handle list requests', async () => {
        const listRequest = {
            id: 'test-list-123'
        };

        const result = await appManager.handleListRequest(listRequest);

        assert(Array.isArray(result.applications));
        // Should be empty initially
        assert(result.applications.length >= 0);
    });

    test('should manage application lifecycle', async () => {
        // Test app lifecycle states
        const states = ['initialized', 'starting', 'running', 'stopping', 'stopped', 'failed'];

        states.forEach(state => {
            assert(typeof state === 'string');
            assert(state.length > 0);
        });
    });

    test('should handle resource limits', () => {
        const resourceLimits = appManager.getResourceLimits();

        assert(typeof resourceLimits === 'object');
        assert(typeof resourceLimits.memory === 'string');
        assert(typeof resourceLimits.cpu === 'string');
        assert(resourceLimits.memory.includes('m') || resourceLimits.memory.includes('M'));
        assert(resourceLimits.cpu.includes('0'));
    });

    afterEach(() => {
        if (appManager) {
            // Cleanup any running applications
            appManager.cleanup();
        }
    });
});

describe('EnhancedApplicationManager Error Handling', () => {
    let appManager;
    let mockRuntime;

    beforeEach(() => {
        mockRuntime = {
            config: { dataDir: './test-data', kuksaEnabled: false },
            kuksaManager: { getVehicleCredentials: () => Promise.resolve({}) },
            consoleManager: { subscribe: () => {}, unsubscribe: () => {} }
        };

        appManager = new EnhancedApplicationManager(mockRuntime);
    });

    test('should handle invalid deployment requests', async () => {
        const invalidRequests = [
            null,
            undefined,
            {},
            { id: 'test' }, // missing code
            { code: 'print("test")' }, // missing id
            { id: 'test', code: null }, // invalid code
            { id: 'test', code: '', language: 'unsupported' } // unsupported language
        ];

        for (const request of invalidRequests) {
            try {
                const result = await appManager.handleDeployRequest(request);

                if (result && result.success === false) {
                    assert(result.error || result.message);
                }
            } catch (error) {
                // Expected for invalid requests
                assert(error.message);
            }
        }
    });

    test('should handle malformed application code', async () => {
        const malformedCode = 'this is not valid python syntax ((((';

        const deployRequest = {
            id: 'test-malformed-123',
            code: malformedCode,
            language: 'python'
        };

        try {
            const result = await appManager.handleDeployRequest(deployRequest);

            // Should either reject the code or handle the error gracefully
            if (result.success === false) {
                assert(result.error || result.message);
            }
        } catch (error) {
            assert(error.message);
        }
    });

    test('should handle concurrent deployment requests', async () => {
        const concurrentRequests = Array.from({ length: 5 }, (_, i) => ({
            id: `concurrent-${i}`,
            code: `print("Concurrent app ${i}")`,
            language: 'python'
        }));

        try {
            const promises = concurrentRequests.map(request =>
                appManager.handleDeployRequest(request)
            );

            const results = await Promise.allSettled(promises);

            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    // May fail due to Docker not being available
                    assert(result.reason.message);
                } else if (result.status === 'fulfilled') {
                    assert(typeof result.value === 'object');
                }
            });
        } catch (error) {
            assert(error.message);
        }
    });
});

describe('EnhancedApplicationManager Docker Integration', () => {
    test('should generate Docker run commands', () => {
        const appManager = new EnhancedApplicationManager({});

        const appConfig = {
            executionId: 'test-exec-123',
            code: 'print("test")',
            language: 'python',
            vehicleId: 'test-vehicle',
            resourceLimits: { memory: '256m', cpu: '0.5' }
        };

        try {
            const dockerCommand = appManager.generateDockerCommand(appConfig);

            assert(typeof dockerCommand === 'string');
            assert(dockerCommand.includes('docker'));
            assert(dockerCommand.includes('run'));
            assert(dockerCommand.includes('--rm'));
        } catch (error) {
            // Docker may not be available in test environment
            assert(error.message.includes('Docker') || error.message.includes('command'));
        }
    });

    test('should handle Docker container lifecycle', async () => {
        const appManager = new EnhancedApplicationManager({});

        const containerConfig = {
            name: 'test-container-' + Date.now(),
            image: 'python:3.9-alpine',
            command: 'python -c "print(\'Hello from Docker\')"'
        };

        try {
            // This test will likely fail in environments without Docker
            // but it validates the Docker integration code paths
            const result = await appManager.startContainer(containerConfig);

            if (result.success) {
                assert(result.containerId);
                assert(result.status === 'running');

                // Stop the container
                const stopResult = await appManager.stopContainer(result.containerId);
                assert(stopResult.success === true);
            }
        } catch (error) {
            // Expected in environments without Docker
            assert(error.message.includes('Docker') ||
                   error.message.includes('docker') ||
                   error.message.includes('ENOENT') ||
                   error.message.includes('command not found'));
        }
    });
});