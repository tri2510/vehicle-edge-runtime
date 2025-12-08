/**
 * Unit Tests for VehicleEdgeRuntime
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { VehicleEdgeRuntime } from '../../../src/core/VehicleEdgeRuntime.js';
import WebSocket from 'ws';

describe('VehicleEdgeRuntime', () => {
    let runtime;
    const testPort = 3003; // Use different port for testing

    test('should initialize with default options', () => {
        runtime = new VehicleEdgeRuntime();

        assert.strictEqual(typeof runtime.runtimeId, 'string');
        assert.strictEqual(runtime.options.port, 3002);
        assert.strictEqual(runtime.options.kitManagerUrl, 'ws://localhost:8080');
        assert.strictEqual(runtime.options.logLevel, 'info');
        assert.strictEqual(runtime.isRunning, false);
    });

    test('should initialize with custom options', () => {
        const customOptions = {
            port: testPort,
            kitManagerUrl: 'ws://localhost:9999',
            logLevel: 'debug'
        };

        runtime = new VehicleEdgeRuntime(customOptions);

        assert.strictEqual(runtime.options.port, testPort);
        assert.strictEqual(runtime.options.kitManagerUrl, 'ws://localhost:9999');
        assert.strictEqual(runtime.options.logLevel, 'debug');
    });

    test('should register a kit successfully', async () => {
        runtime = new VehicleEdgeRuntime({ port: testPort });

        const kitInfo = {
            name: 'Test Kit',
            version: '1.0.0',
            description: 'Test kit for unit testing'
        };

        const kit = await runtime.registerKit(kitInfo);

        assert.strictEqual(typeof kit.id, 'string');
        assert.strictEqual(kit.name, kitInfo.name);
        assert.strictEqual(kit.version, kitInfo.version);
        assert.strictEqual(kit.runtimeId, runtime.runtimeId);
        assert(typeof kit.registeredAt, 'string');

        assert.strictEqual(runtime.registeredKits.size, 1);
        assert.ok(runtime.registeredKits.has(kit.id));
    });

    test('should register a client successfully', () => {
        runtime = new VehicleEdgeRuntime({ port: testPort });

        const mockClient = new WebSocket('ws://localhost:' + testPort);
        const clientInfo = {
            userAgent: 'test-agent',
            remoteAddress: '127.0.0.1'
        };

        const clientId = runtime.registerClient(mockClient, clientInfo);

        assert.strictEqual(typeof clientId, 'string');
        assert.strictEqual(mockClient.clientId, clientId);
        assert.strictEqual(mockClient.runtimeId, runtime.runtimeId);

        assert.strictEqual(runtime.clients.size, 1);
        assert.ok(runtime.clients.has(clientId));

        const registeredClient = runtime.clients.get(clientId);
        assert.strictEqual(registeredClient.client, mockClient);
        assert.strictEqual(registeredClient.info.userAgent, 'test-agent');
        assert.strictEqual(registeredClient.info.remoteAddress, '127.0.0.1');
    });

    test('should unregister a client successfully', () => {
        runtime = new VehicleEdgeRuntime({ port: testPort });

        const mockClient = new WebSocket('ws://localhost:' + testPort);
        const clientId = runtime.registerClient(mockClient, {});

        assert.strictEqual(runtime.clients.size, 1);

        runtime.unregisterClient(clientId);

        assert.strictEqual(runtime.clients.size, 0);
    });

    test('should get runtime status correctly', () => {
        runtime = new VehicleEdgeRuntime({ port: testPort });

        const status = runtime.getStatus();

        assert.strictEqual(typeof status, 'object');
        assert.strictEqual(status.runtimeId, runtime.runtimeId);
        assert.strictEqual(status.isRunning, false);
        assert.strictEqual(status.port, testPort);
        assert.strictEqual(status.kitManagerConnected, false);
        assert.strictEqual(status.connectedClients, 0);
        assert.strictEqual(status.registeredKits, 0);
        assert.strictEqual(status.runningApplications, 0);
        assert.strictEqual(status.uptime, 0);
    });

    test('should fail to start if already running', async () => {
        runtime = new VehicleEdgeRuntime({ port: testPort });

        // Mock the runtime as already running
        runtime.isRunning = true;

        try {
            await runtime.start();
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error.message.includes('already running'));
        }
    });

    test('should handle graceful shutdown', async () => {
        runtime = new VehicleEdgeRuntime({ port: testPort });

        // Mock as running to test shutdown
        runtime.isRunning = true;
        runtime.wsServer = {
            close: () => {},
            clients: []
        };

        // Mock clients
        const mockClient = {
            close: () => {},
            readyState: WebSocket.OPEN
        };
        runtime.clients.set('test-client', { client: mockClient });

        // Mock application manager
        runtime.appManager = {
            stopAllApplications: async () => {}
        };

        await runtime.stop();

        assert.strictEqual(runtime.isRunning, false);
        assert.strictEqual(runtime.clients.size, 0);
    });
});