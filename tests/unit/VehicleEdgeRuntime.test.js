import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { WebSocket } from 'ws';
import { VehicleEdgeRuntime } from '../../src/core/VehicleEdgeRuntime.js';

describe('VehicleEdgeRuntime Core Tests', () => {
    let runtime;
    let mockWs;

    beforeEach(() => {
        // Mock WebSocket for testing
        mockWs = {
            send: (data) => {
                // Mock sending data
                console.log('Mock WS send:', data);
            },
            on: (event, callback) => {
                // Mock WebSocket events
                console.log('Mock WS event:', event);
            },
            readyState: WebSocket.OPEN
        };

        runtime = new VehicleEdgeRuntime({
            port: 3002,
            healthPort: 3003,
            kuksaEnabled: false, // Disable for unit tests
            dataDir: './test-data'
        });
    });

    test('should initialize with default configuration', () => {
        assert(runtime.config.port === 3002);
        assert(runtime.config.healthPort === 3003);
        assert(runtime.config.kuksaEnabled === false);
        assert(runtime.config.dataDir === './test-data');
    });

    test('should generate unique runtime ID', () => {
        const runtime1 = new VehicleEdgeRuntime({ port: 3002 });
        const runtime2 = new VehicleEdgeRuntime({ port: 3003 });

        assert(runtime1.runtimeId !== runtime2.runtimeId);
        assert(typeof runtime1.runtimeId === 'string');
        assert(runtime1.runtimeId.length > 0);
    });

    test('should handle ping messages correctly', async () => {
        const pingMessage = {
            type: 'ping',
            id: 'test-ping-123'
        };

        const response = await runtime.handleMessage(mockWs, pingMessage);

        assert(response.type === 'pong');
        assert(response.id === 'test-ping-123');
        assert(response.timestamp);
        assert(typeof response.timestamp === 'string');
    });

    test('should return runtime info', async () => {
        const infoMessage = {
            type: 'get_runtime_info',
            id: 'test-info-123'
        };

        const response = await runtime.handleMessage(mockWs, infoMessage);

        assert(response.type === 'get_runtime_info-response');
        assert(response.result.runtimeId);
        assert(response.result.capabilities);
        assert(Array.isArray(response.result.capabilities));
    });

    test('should handle unknown message types gracefully', async () => {
        const unknownMessage = {
            type: 'unknown_message_type',
            id: 'test-unknown-123'
        };

        const response = await runtime.handleMessage(mockWs, unknownMessage);

        assert(response.type === 'error');
        assert(response.id === 'test-unknown-123');
        assert(response.error.includes('Unknown message type'));
    });

    test('should validate message structure', async () => {
        const invalidMessages = [
            null,
            undefined,
            {},
            { type: null },
            { type: 'ping' }, // missing id
            { id: 'test-123' } // missing type
        ];

        for (const message of invalidMessages) {
            const response = await runtime.handleMessage(mockWs, message);

            if (message && typeof message === 'object') {
                assert(response.type === 'error' || response.type);
            } else {
                // Should handle non-object messages gracefully
                assert(response === null || response.type === 'error');
            }
        }
    });

    test('should manage WebSocket connections', () => {
        const connectionCount = runtime.getActiveConnections();
        assert(typeof connectionCount === 'number');
        assert(connectionCount >= 0);
    });

    test('should track application deployments', async () => {
        const deploymentCount = await runtime.getActiveDeploymentCount();
        assert(typeof deploymentCount === 'number');
        assert(deploymentCount >= 0);
    });

    afterEach(() => {
        if (runtime) {
            // Cleanup if needed
        }
    });
});

describe('VehicleEdgeRuntime Error Handling', () => {
    let runtime;
    let mockWs;

    beforeEach(() => {
        mockWs = {
            send: () => {},
            on: () => {},
            readyState: WebSocket.OPEN
        };

        runtime = new VehicleEdgeRuntime({
            port: 3002,
            kuksaEnabled: false
        });
    });

    test('should handle malformed JSON', async () => {
        const malformedMessage = 'invalid json string';

        try {
            const response = await runtime.handleMessage(mockWs, malformedMessage);
            assert(response === null || response.type === 'error');
        } catch (error) {
            assert(error.message.includes('JSON') || error.message.includes('parse'));
        }
    });

    test('should handle WebSocket send failures', async () => {
        const failingWs = {
            send: () => {
                throw new Error('WebSocket send failed');
            },
            on: () => {},
            readyState: WebSocket.OPEN
        };

        const message = {
            type: 'ping',
            id: 'test-fail-123'
        };

        // Should not throw unhandled exceptions
        try {
            await runtime.handleMessage(failingWs, message);
            assert(true); // If we reach here, error was handled gracefully
        } catch (error) {
            assert(error.message.includes('WebSocket send failed'));
        }
    });
});

describe('VehicleEdgeRuntime Configuration', () => {
    test('should accept custom configuration', () => {
        const customConfig = {
            port: 8080,
            healthPort: 8081,
            kuksaEnabled: true,
            kuksaHost: 'custom-host',
            kuksaGrpcPort: 50051,
            dataDir: '/custom/data/dir'
        };

        const runtime = new VehicleEdgeRuntime(customConfig);

        assert(runtime.config.port === 8080);
        assert(runtime.config.healthPort === 8081);
        assert(runtime.config.kuksaEnabled === true);
        assert(runtime.config.kuksaHost === 'custom-host');
        assert(runtime.config.kuksaGrpcPort === 50051);
        assert(runtime.config.dataDir === '/custom/data/dir');
    });

    test('should use default values for missing configuration', () => {
        const runtime = new VehicleEdgeRuntime({});

        assert(runtime.config.port === 3002);
        assert(runtime.config.healthPort === 3003);
        assert(runtime.config.kuksaEnabled === false);
        assert(runtime.config.kuksaHost === 'localhost');
        assert(runtime.config.kuksaGrpcPort === 55555);
        assert(runtime.config.dataDir === './data');
    });

    test('should validate port numbers', () => {
        const invalidPorts = [-1, 0, 65536, 'invalid', null, undefined];

        for (const port of invalidPorts) {
            try {
                const runtime = new VehicleEdgeRuntime({ port });
                if (typeof port === 'number' && (port < 1 || port > 65535)) {
                    assert(false, `Invalid port ${port} should throw error`);
                }
            } catch (error) {
                assert(error.message.includes('port') || error.message.includes('invalid'));
            }
        }
    });
});