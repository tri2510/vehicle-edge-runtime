/**
 * Integration Tests for WebSocket Communication
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import { VehicleEdgeRuntime } from '../../src/core/VehicleEdgeRuntime.js';

describe('WebSocket Integration', () => {
    let runtime;
    let testPort = 3004;
    let wsUrl = `ws://localhost:${testPort}/runtime`;

    // Function to get a unique port for each test
    function getNextPort() {
        testPort++;
        return testPort;
    }

    test('should establish WebSocket connection and receive welcome message', async () => {
        const port = getNextPort();
        const url = `ws://localhost:${port}/runtime`;

        runtime = new VehicleEdgeRuntime({
            port: port,
            skipKitManager: true // Skip Kit Manager connection for testing
        });

        await runtime.start();

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);

            ws.on('open', () => {
                console.log('WebSocket connection opened');
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    assert.strictEqual(message.type, 'connection_established');
                    assert.strictEqual(typeof message.clientId, 'string');
                    assert.strictEqual(message.runtimeId, runtime.runtimeId);
                    assert.ok(message.timestamp);

                    ws.close();
                    runtime.stop().then(resolve).catch(reject);
                } catch (error) {
                    ws.close();
                    runtime.stop().then(() => reject(error)).catch(reject);
                }
            });

            ws.on('error', (error) => {
                runtime.stop().then(() => reject(error)).catch(reject);
            });

            // Add timeout
            setTimeout(() => {
                ws.close();
                runtime.stop().then(() => reject(new Error('Test timeout'))).catch(reject);
            }, 5000);
        });
    });

    test('should handle register_kit command', async () => {
        const port = getNextPort();
        const url = `ws://localhost:${port}/runtime`;

        runtime = new VehicleEdgeRuntime({
            port: port,
            skipKitManager: true
        });

        await runtime.start();

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);

            ws.on('open', () => {
                const kitInfo = {
                    name: 'Test Kit',
                    version: '1.0.0',
                    description: 'Integration test kit'
                };

                ws.send(JSON.stringify({
                    type: 'register_kit',
                    kitInfo
                }));
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());

                    if (message.type === 'connection_established') {
                        return; // Wait for the actual response
                    }

                    assert.strictEqual(message.type, 'kit_registered');
                    assert.ok(message.kit);
                    assert.strictEqual(message.kit.name, 'Test Kit');
                    assert.strictEqual(message.kit.version, '1.0.0');

                    ws.close();
                    runtime.stop().then(resolve).catch(reject);
                } catch (error) {
                    ws.close();
                    runtime.stop().then(() => reject(error)).catch(reject);
                }
            });

            ws.on('error', (error) => {
                runtime.stop().then(() => reject(error)).catch(reject);
            });

            setTimeout(() => {
                ws.close();
                runtime.stop().then(() => reject(new Error('Test timeout'))).catch(reject);
            }, 5000);
        });
    });

    test('should handle list-all-kits command', async () => {
        const port = getNextPort();
        const url = `ws://localhost:${port}/runtime`;

        runtime = new VehicleEdgeRuntime({
            port: port,
            skipKitManager: true
        });

        await runtime.start();

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);

            ws.on('open', () => {
                // First register a kit
                ws.send(JSON.stringify({
                    type: 'register_kit',
                    kitInfo: {
                        name: 'Test Kit for Listing',
                        version: '1.0.0'
                    }
                }));
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());

                    if (message.type === 'connection_established') {
                        return;
                    }

                    if (message.type === 'kit_registered') {
                        // Now request list of all kits
                        ws.send(JSON.stringify({
                            type: 'list-all-kits'
                        }));
                        return;
                    }

                    if (message.type === 'kits_list') {
                        assert.ok(Array.isArray(message.kits));
                        assert.strictEqual(message.kits.length, 1);
                        assert.strictEqual(message.kits[0].name, 'Test Kit for Listing');
                        assert.strictEqual(message.count, 1);

                        ws.close();
                        runtime.stop().then(resolve).catch(reject);
                        return;
                    }

                    reject(new Error(`Unexpected message type: ${message.type}`));
                } catch (error) {
                    ws.close();
                    runtime.stop().then(() => reject(error)).catch(reject);
                }
            });

            ws.on('error', (error) => {
                runtime.stop().then(() => reject(error)).catch(reject);
            });

            setTimeout(() => {
                ws.close();
                runtime.stop().then(() => reject(new Error('Test timeout'))).catch(reject);
            }, 10000);
        });
    });

    test('should handle ping command', async () => {
        const port = getNextPort();
        const url = `ws://localhost:${port}/runtime`;

        runtime = new VehicleEdgeRuntime({
            port: port,
            skipKitManager: true
        });

        await runtime.start();

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'ping'
                }));
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());

                    if (message.type === 'connection_established') {
                        return;
                    }

                    assert.strictEqual(message.type, 'pong');
                    assert.ok(message.timestamp);

                    ws.close();
                    runtime.stop().then(resolve).catch(reject);
                } catch (error) {
                    ws.close();
                    runtime.stop().then(() => reject(error)).catch(reject);
                }
            });

            ws.on('error', (error) => {
                runtime.stop().then(() => reject(error)).catch(reject);
            });

            setTimeout(() => {
                ws.close();
                runtime.stop().then(() => reject(new Error('Test timeout'))).catch(reject);
            }, 5000);
        });
    });

    test('should handle invalid message gracefully', async () => {
        const port = getNextPort();
        const url = `ws://localhost:${port}/runtime`;

        runtime = new VehicleEdgeRuntime({
            port: port,
            skipKitManager: true
        });

        await runtime.start();

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);

            ws.on('open', () => {
                // Send invalid JSON
                ws.send('invalid json message');
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());

                    if (message.type === 'connection_established') {
                        return;
                    }

                    assert.strictEqual(message.type, 'error');
                    assert.ok(message.error);
                    assert.ok(message.error.includes('Invalid message format'));

                    ws.close();
                    runtime.stop().then(resolve).catch(reject);
                } catch (error) {
                    ws.close();
                    runtime.stop().then(() => reject(error)).catch(reject);
                }
            });

            ws.on('error', (error) => {
                runtime.stop().then(() => reject(error)).catch(reject);
            });

            setTimeout(() => {
                ws.close();
                runtime.stop().then(() => reject(new Error('Test timeout'))).catch(reject);
            }, 5000);
        });
    });

    test('should handle unknown command type', async () => {
        const port = getNextPort();
        const url = `ws://localhost:${port}/runtime`;

        runtime = new VehicleEdgeRuntime({
            port: port,
            skipKitManager: true
        });

        await runtime.start();

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'unknown_command',
                    data: 'test'
                }));
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());

                    if (message.type === 'connection_established') {
                        return;
                    }

                    assert.strictEqual(message.type, 'error');
                    assert.ok(message.error);
                    assert.ok(message.error.includes('Unknown message type'));

                    ws.close();
                    runtime.stop().then(resolve).catch(reject);
                } catch (error) {
                    ws.close();
                    runtime.stop().then(() => reject(error)).catch(reject);
                }
            });

            ws.on('error', (error) => {
                runtime.stop().then(() => reject(error)).catch(reject);
            });

            setTimeout(() => {
                ws.close();
                runtime.stop().then(() => reject(new Error('Test timeout'))).catch(reject);
            }, 5000);
        });
    });
});