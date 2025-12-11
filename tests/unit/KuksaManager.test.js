import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { KuksaManager } from '../../src/vehicle/KuksaManager.js';
import fs from 'fs-extra';
import path from 'path';

describe('KuksaManager', () => {
    let kuksaManager;
    let testDataDir;

    beforeEach(async () => {
        // Create test data directory
        testDataDir = path.join(process.cwd(), 'test-data', Date.now().toString());
        await fs.ensureDir(testDataDir);

        // Create mock VSS configuration
        const vssPath = path.join(testDataDir, 'vss.json');
        await fs.writeJson(vssPath, {
            Vehicle: {
                Speed: {
                    datatype: 'float',
                    type: 'sensor',
                    unit: 'km/h',
                    min: 0,
                    max: 300,
                    description: 'Vehicle speed'
                }
            }
        });

        kuksaManager = new KuksaManager({
            kuksaHost: 'localhost',
            kuksaPort: 50051,
            vssPath: vssPath,
            failFast: false,
            maxRetries: 2,
            retryDelay: 100,
            logLevel: 'error' // Reduce noise during tests
        });
    });

    afterEach(async () => {
        if (kuksaManager) {
            await kuksaManager.stop();
        }

        // Clean up test data
        if (testDataDir && await fs.pathExists(testDataDir)) {
            await fs.remove(testDataDir);
        }
    });

    describe('Constructor', () => {
        test('should create KuksaManager with default options', () => {
            const manager = new KuksaManager();
            assert.strictEqual(manager.options.kuksaHost, 'localhost');
            assert.strictEqual(manager.options.kuksaPort, 50051);
            assert.strictEqual(manager.options.authEnabled, false);
            assert.strictEqual(manager.options.failFast, true);
            assert.strictEqual(manager.options.maxRetries, 3);
            assert.strictEqual(manager.options.retryDelay, 1000);
        });

        test('should create KuksaManager with custom options', () => {
            const manager = new KuksaManager({
                kuksaHost: 'custom-host',
                kuksaPort: 8080,
                failFast: false,
                maxRetries: 5
            });
            assert.strictEqual(manager.options.kuksaHost, 'custom-host');
            assert.strictEqual(manager.options.kuksaPort, 8080);
            assert.strictEqual(manager.options.failFast, false);
            assert.strictEqual(manager.options.maxRetries, 5);
        });

        test('should initialize with correct state', () => {
            assert.strictEqual(kuksaManager.isConnected, false);
            assert.strictEqual(kuksaManager.grpcClient, null);
            assert(kuksaManager.subscriptions instanceof Map);
            assert(kuksaManager.signalValues instanceof Map);
            assert.strictEqual(kuksaManager.retryCount, 0);
            assert.strictEqual(kuksaManager.reconnectTimer, null);
        });

        test('should set up authentication metadata when enabled', () => {
            const manager = new KuksaManager({
                authEnabled: true,
                authToken: 'test-token'
            });
            assert(manager.metadata.get('authorization'), 'Bearer test-token');
        });
    });

    describe('VSS Configuration', () => {
        test('should load existing VSS configuration', async () => {
            await kuksaManager._loadVSSConfiguration();
            assert(kuksaManager.vssData);
            assert(kuksaManager.vssData.Vehicle);
            assert(kuksaManager.vssData.Vehicle.Speed);
        });

        test('should create default VSS when file does not exist', async () => {
            const manager = new KuksaManager({
                vssPath: path.join(testDataDir, 'nonexistent.json'),
                failFast: false
            });

            await manager._loadVSSConfiguration();
            assert(manager.vssData);
            assert(manager.vssData.Vehicle);
            assert(manager.vssData.Vehicle.Speed);
        });

        test('should use in-memory VSS on file system error', async () => {
            const invalidPath = '/invalid/path/vss.json';
            const manager = new KuksaManager({
                vssPath: invalidPath,
                failFast: false
            });

            await manager._loadVSSConfiguration();
            assert(manager.vssData);
            assert(manager.vssData.Vehicle);
        });
    });

    describe('Signal Path Validation', () => {
        beforeEach(async () => {
            await kuksaManager._loadVSSConfiguration();
        });

        test('should validate correct signal paths', async () => {
            const paths = await kuksaManager._validateSignalPaths(['Vehicle.Speed']);
            assert.deepStrictEqual(paths, ['Vehicle.Speed']);
        });

        test('should reject invalid signal paths', async () => {
            try {
                await kuksaManager._validateSignalPaths(['Invalid.Path']);
                assert.fail('Should have thrown error for invalid paths');
            } catch (error) {
                assert(error.message.includes('No valid signal paths'));
            }
        });

        test('should filter out invalid paths and keep valid ones', async () => {
            const paths = await kuksaManager._validateSignalPaths([
                'Vehicle.Speed',
                'Invalid.Path',
                'Vehicle.Invalid'
            ]);
            assert.deepStrictEqual(paths, ['Vehicle.Speed']);
        });
    });

    describe('Signal Value Formatting', () => {
        test('should format string values correctly', () => {
            const formatted = kuksaManager._formatKuksaValue('test');
            assert.deepStrictEqual(formatted, { stringValue: 'test' });
        });

        test('should format integer values correctly', () => {
            const formatted = kuksaManager._formatKuksaValue(42);
            assert.deepStrictEqual(formatted, { intValue: 42 });
        });

        test('should format float values correctly', () => {
            const formatted = kuksaManager._formatKuksaValue(42.5);
            assert.deepStrictEqual(formatted, { floatValue: 42.5 });
        });

        test('should format boolean values correctly', () => {
            const formatted = kuksaManager._formatKuksaValue(true);
            assert.deepStrictEqual(formatted, { boolValue: true });
        });

        test('should format unknown values as strings', () => {
            const obj = { test: 'value' };
            const formatted = kuksaManager._formatKuksaValue(obj);
            assert.deepStrictEqual(formatted, { stringValue: '[object Object]' });
        });
    });

    describe('Signal Value Parsing', () => {
        test('should parse string values correctly', () => {
            const dataPoint = {
                value: { stringValue: 'test' }
            };
            const parsed = kuksaManager._parseKuksaValue(dataPoint);
            assert.strictEqual(parsed, 'test');
        });

        test('should parse integer values correctly', () => {
            const dataPoint = {
                value: { intValue: 42 }
            };
            const parsed = kuksaManager._parseKuksaValue(dataPoint);
            assert.strictEqual(parsed, 42);
        });

        test('should parse float values correctly', () => {
            const dataPoint = {
                value: { floatValue: 42.5 }
            };
            const parsed = kuksaManager._parseKuksaValue(dataPoint);
            assert.strictEqual(parsed, 42.5);
        });

        test('should parse boolean values correctly', () => {
            const dataPoint = {
                value: { boolValue: true }
            };
            const parsed = kuksaManager._parseKuksaValue(dataPoint);
            assert.strictEqual(parsed, true);
        });

        test('should handle null/undefined data points', () => {
            assert.strictEqual(kuksaManager._parseKuksaValue(null), null);
            assert.strictEqual(kuksaManager._parseKuksaValue({}), null);
            assert.strictEqual(kuksaManager._parseKuksaValue({ value: null }), null);
        });
    });

    describe('Public API Methods', () => {
        beforeEach(async () => {
            await kuksaManager._loadVSSConfiguration();
        });

        test('should get cached signal values', () => {
            // Set some cached values
            kuksaManager.signalValues.set('Vehicle.Speed', {
                value: 100,
                timestamp: new Date(),
                source: 'test'
            });

            const cached = kuksaManager.getCachedSignalValues();
            assert(cached['Vehicle.Speed']);
            assert.strictEqual(cached['Vehicle.Speed'].value, 100);
            assert.strictEqual(cached['Vehicle.Speed'].source, 'test');
        });

        test('should get manager status', () => {
            const status = kuksaManager.getStatus();
            assert.strictEqual(status.isConnected, false);
            assert.strictEqual(status.activeSubscriptions, 0);
            assert.strictEqual(status.cachedSignals, 0);
            assert.strictEqual(status.vssLoaded, false);
        });

        test('should validate signal paths via public API', async () => {
            const paths = await kuksaManager.validateSignalPaths(['Vehicle.Speed']);
            assert.deepStrictEqual(paths, ['Vehicle.Speed']);
        });

        test('should get VSS tree', () => {
            const vssTree = kuksaManager.getVSSTree();
            assert(vssTree);
            assert(vssTree.Vehicle);
        });

        test('should generate unique subscription IDs', () => {
            const id1 = kuksaManager._generateSubscriptionId();
            const id2 = kuksaManager._generateSubscriptionId();
            assert.notStrictEqual(id1, id2);
            assert(id1.startsWith('sub_'));
            assert(id2.startsWith('sub_'));
        });

        test('should generate unique request IDs', () => {
            const id1 = kuksaManager._generateRequestId();
            const id2 = kuksaManager._generateRequestId();
            assert.notStrictEqual(id1, id2);
            assert(id1.startsWith('req_'));
            assert(id2.startsWith('req_'));
        });
    });

    describe('Error Handling', () => {
        test('should handle fail-fast connection errors', async () => {
            const manager = new KuksaManager({
                kuksaHost: 'invalid-host',
                kuksaPort: 9999,
                failFast: true
            });

            try {
                await manager._connectToKuksa();
                assert.fail('Should have thrown connection error');
            } catch (error) {
                assert(error.message.includes('Kuksa connection failed'));
            }
        });

        test('should create fallback proto definition when proto file missing', () => {
            const fallback = kuksaManager._createFallbackProtoDefinition();
            assert(fallback['kuksa.val.v1']);
            assert(fallback['kuksa.val.v1'].VSSClient);
        });
    });

    describe('Connection Management', () => {
        test('should handle stop method correctly', async () => {
            // Set up some state
            kuksaManager.isConnected = true;
            kuksaManager.reconnectTimer = setTimeout(() => {}, 1000);
            kuksaManager.subscriptions.set('test', { paths: ['Vehicle.Speed'] });

            await kuksaManager.stop();

            assert.strictEqual(kuksaManager.isConnected, false);
            assert.strictEqual(kuksaManager.reconnectTimer, null);
            assert.strictEqual(kuksaManager.subscriptions.size, 0);
        });

        test('should handle connection failure cleanup', () => {
            kuksaManager.isConnected = true;
            kuksaManager.subscriptions.set('test', { paths: ['Vehicle.Speed'] });

            kuksaManager._handleConnectionFailure(new Error('Test error'));

            assert.strictEqual(kuksaManager.isConnected, false);
            assert.strictEqual(kuksaManager.subscriptions.size, 0);
        });
    });
});