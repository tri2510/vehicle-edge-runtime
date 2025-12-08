/**
 * Unit Tests for ApplicationManager
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ApplicationManager } from '../../../src/apps/ApplicationManager.js';

describe('ApplicationManager', () => {
    let appManager;
    const testDataPath = './test-data';

    test('should initialize with default options', () => {
        appManager = new ApplicationManager();

        assert.strictEqual(typeof appManager.docker, 'object');
        assert.strictEqual(appManager.applications.size, 0);
        assert.strictEqual(appManager.options.dataPath, './data');
    });

    test('should initialize with custom options', () => {
        const customOptions = {
            dataPath: testDataPath,
            maxBufferSize: 5000,
            logLevel: 'debug'
        };

        appManager = new ApplicationManager(customOptions);

        assert.strictEqual(appManager.options.dataPath, testDataPath);
        assert.strictEqual(appManager.options.maxBufferSize, 5000);
        assert.strictEqual(appManager.options.logLevel, 'debug');
    });

    test('should create application directories during initialization', async () => {
        const fs = await import('fs-extra');
        appManager = new ApplicationManager({ dataPath: testDataPath });

        await appManager.initialize();

        assert.ok(await fs.pathExists(testDataPath));
        assert.ok(await fs.pathExists(`${testDataPath}/applications`));
        assert.ok(await fs.pathExists(`${testDataPath}/applications/python`));
        assert.ok(await fs.pathExists(`${testDataPath}/applications/binary`));

        // Cleanup
        await fs.remove(testDataPath);
    });

    test('should run Python application with valid code', async () => {
        const fs = await import('fs-extra');
        appManager = new ApplicationManager({ dataPath: testDataPath });

        await appManager.initialize();

        const pythonCode = `
print("Hello from Python app!")
import time
time.sleep(0.1)
print("Python app finished")
`;

        const options = {
            executionId: 'test-python-app',
            appId: 'test-python',
            code: pythonCode,
            entryPoint: 'main.py',
            env: { TEST_VAR: 'test_value' },
            workingDir: '/app'
        };

        // Mock docker container to avoid actual container creation in unit test
        const mockContainer = {
            id: 'mock-container-id',
            start: async () => {},
            wait: async () => ({ StatusCode: 0 }),
            inspect: async () => ({ State: { Status: 'exited', ExitCode: 0 } }),
            remove: async () => {},
            attach: async () => ({
                on: () => {}
            })
        };

        const mockDocker = {
            createContainer: async () => mockContainer,
            getContainer: () => mockContainer,
            listContainers: async () => []
        };

        appManager.docker = mockDocker;

        const result = await appManager.runPythonApp(options);

        assert.strictEqual(result.status, 'started');
        assert.strictEqual(result.executionId, 'test-python-app');
        assert.ok(result.containerId);

        assert.strictEqual(appManager.applications.size, 1);
        const appInfo = appManager.applications.get('test-python-app');
        assert.strictEqual(appInfo.appId, 'test-python');
        assert.strictEqual(appInfo.type, 'python');
        assert.strictEqual(appInfo.status, 'running');

        // Cleanup
        await fs.remove(testDataPath);
    });

    test('should run binary application with valid configuration', async () => {
        const fs = await import('fs-extra');
        appManager = new ApplicationManager({ dataPath: testDataPath });

        await appManager.initialize();

        const options = {
            executionId: 'test-binary-app',
            appId: 'test-binary',
            binaryPath: '/bin/echo',
            args: ['Hello', 'from', 'binary'],
            env: { TEST_VAR: 'test_value' },
            workingDir: '/app'
        };

        // Mock docker container
        const mockContainer = {
            id: 'mock-binary-container',
            start: async () => {},
            wait: async () => ({ StatusCode: 0 }),
            inspect: async () => ({ State: { Status: 'exited', ExitCode: 0 } }),
            remove: async () => {},
            attach: async () => ({
                on: () => {}
            })
        };

        appManager.docker = {
            createContainer: async () => mockContainer,
            getContainer: () => mockContainer,
            listContainers: async () => []
        };

        const result = await appManager.runBinaryApp(options);

        assert.strictEqual(result.status, 'started');
        assert.strictEqual(result.executionId, 'test-binary-app');
        assert.ok(result.containerId);

        assert.strictEqual(appManager.applications.size, 1);
        const appInfo = appManager.applications.get('test-binary-app');
        assert.strictEqual(appInfo.appId, 'test-binary');
        assert.strictEqual(appInfo.type, 'binary');
        assert.strictEqual(appInfo.status, 'running');

        // Cleanup
        await fs.remove(testDataPath);
    });

    test('should stop running application', async () => {
        const fs = await import('fs-extra');
        appManager = new ApplicationManager({ dataPath: testDataPath });

        await appManager.initialize();

        // Mock a running application
        const mockContainer = {
            id: 'mock-stop-container',
            stop: async () => {},
            remove: async () => {},
            inspect: async () => ({ State: { ExitCode: 0 } })
        };

        appManager.applications.set('test-stop-app', {
            executionId: 'test-stop-app',
            appId: 'test-stop',
            type: 'python',
            container: mockContainer,
            status: 'running',
            appDir: `${testDataPath}/applications/python/test-stop-app`
        });

        const result = await appManager.stopApplication('test-stop-app');

        assert.strictEqual(result.status, 'stopped');
        assert.strictEqual(result.executionId, 'test-stop-app');
        assert.strictEqual(result.exitCode, 0);

        const appInfo = appManager.applications.get('test-stop-app');
        assert.strictEqual(appInfo.status, 'stopped');
        assert.strictEqual(appInfo.exitCode, 0);

        // Cleanup
        await fs.remove(testDataPath);
    });

    test('should get application status', async () => {
        const fs = await import('fs-extra');
        appManager = new ApplicationManager({ dataPath: testDataPath });

        await appManager.initialize();

        // Mock an application
        const mockContainer = {
            inspect: async () => ({ State: { Status: 'running' } })
        };

        const startTime = new Date().toISOString();
        appManager.applications.set('test-status-app', {
            executionId: 'test-status-app',
            appId: 'test-status',
            type: 'python',
            container: mockContainer,
            status: 'running',
            startTime,
            endTime: null,
            exitCode: null
        });

        const status = await appManager.getApplicationStatus('test-status-app');

        assert.strictEqual(status.executionId, 'test-status-app');
        assert.strictEqual(status.appId, 'test-status');
        assert.strictEqual(status.type, 'python');
        assert.strictEqual(status.status, 'running');
        assert.strictEqual(status.startTime, startTime);
        assert.strictEqual(status.endTime, null);
        assert.strictEqual(status.exitCode, null);
        assert.ok(status.uptime >= 0);

        // Cleanup
        await fs.remove(testDataPath);
    });

    test('should throw error for non-existent application', async () => {
        appManager = new ApplicationManager({ dataPath: testDataPath });

        try {
            await appManager.stopApplication('non-existent-app');
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error.message.includes('Application not found'));
        }

        try {
            await appManager.getApplicationStatus('non-existent-app');
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error.message.includes('Application not found'));
        }
    });

    test('should get list of running applications', async () => {
        const fs = await import('fs-extra');
        appManager = new ApplicationManager({ dataPath: testDataPath });

        await appManager.initialize();

        // Mock running applications
        const mockContainer1 = {
            inspect: async () => ({ State: { Status: 'running' } })
        };

        const mockContainer2 = {
            inspect: async () => ({ State: { Status: 'exited' } })
        };

        appManager.applications.set('running-app', {
            executionId: 'running-app',
            appId: 'running',
            type: 'python',
            container: mockContainer1,
            status: 'running',
            startTime: new Date().toISOString()
        });

        appManager.applications.set('stopped-app', {
            executionId: 'stopped-app',
            appId: 'stopped',
            type: 'python',
            container: mockContainer2,
            status: 'exited',
            startTime: new Date().toISOString()
        });

        const runningApps = await appManager.getRunningApplications();

        assert.strictEqual(runningApps.length, 1);
        assert.strictEqual(runningApps[0].executionId, 'running-app');
        assert.strictEqual(runningApps[0].status, 'running');

        // Cleanup
        await fs.remove(testDataPath);
    });
});