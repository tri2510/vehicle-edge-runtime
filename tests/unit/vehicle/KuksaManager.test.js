/**
 * Kuksa Manager Unit Tests
 */

import assert from 'assert';
import { KuksaManager } from '../../../src/vehicle/KuksaManager.js';
import { fs } from 'fs-extra';
import path from 'path';

describe('KuksaManager', function() {
    this.timeout(5000);

    let kuksaManager;
    let testDataPath;

    beforeEach(async function() {
        // Create test data directory
        testDataPath = path.join(process.cwd(), 'test-data-' + Date.now());
        await fs.ensureDir(testDataPath);
        await fs.ensureDir(path.join(testDataPath, 'configs'));

        // Create Kuksa manager instance
        kuksaManager = new KuksaManager({
            kuksaUrl: 'localhost:55555',
            vssPath: path.join(testDataPath, 'configs', 'vss.json'),
            logLevel: 'error' // Reduce log noise in tests
        });
    });

    afterEach(async function() {
        if (kuksaManager) {
            await kuksaManager.stop();
        }

        // Clean up test data
        if (testDataPath) {
            await fs.remove(testDataPath);
        }
    });

    describe('Initialization', function() {
        it('should initialize with default options', function() {
            const manager = new KuksaManager();

            assert.strictEqual(manager.options.kuksaUrl, 'localhost:55555');
            assert.strictEqual(manager.options.authEnabled, false);
        });

        it('should create default VSS configuration', async function() {
            await kuksaManager.initialize();

            assert(kuksaManager.vssData);
            assert(kuksaManager.vssData.Vehicle);
            assert(kuksaManager.vssData.Vehicle.Speed);
            assert.strictEqual(kuksaManager.vssData.Vehicle.Speed.datatype, 'float');

            console.log('Default VSS created successfully');
        });

        it('should load existing VSS configuration', async function() {
            const customVSS = {
                "TestVehicle": {
                    "TestSignal": {
                        "datatype": "string",
                        "type": "sensor",
                        "description": "Test signal"
                    }
                }
            };

            await fs.writeFile(
                kuksaManager.options.vssPath,
                JSON.stringify(customVSS, null, 2)
            );

            await kuksaManager.initialize();

            assert(kuksaManager.vssData.TestVehicle);
            assert.strictEqual(kuksaManager.vssData.TestVehicle.TestSignal.datatype, 'string');

            console.log('Custom VSS loaded successfully');
        });
    });

    describe('Signal Path Validation', function() {
        beforeEach(async function() {
            await kuksaManager.initialize();
        });

        it('should validate correct signal paths', async function() {
            const validPaths = ['Vehicle.Speed', 'Vehicle.Engine.RPM'];
            const validatedPaths = await kuksaManager._validateSignalPaths(validPaths);

            assert.deepStrictEqual(validatedPaths, validPaths);
        });

        it('should reject invalid signal paths', async function() {
            const invalidPaths = ['Invalid.Path', 'Vehicle.NonExistent'];
            const validatedPaths = await kuksaManager._validateSignalPaths(invalidPaths);

            assert.deepStrictEqual(validatedPaths, []);
        });

        it('should filter mixed valid/invalid paths', async function() {
            const mixedPaths = ['Vehicle.Speed', 'Invalid.Path', 'Vehicle.Engine.RPM'];
            const validatedPaths = await kuksaManager._validateSignalPaths(mixedPaths);

            assert.deepStrictEqual(validatedPaths, ['Vehicle.Speed', 'Vehicle.Engine.RPM']);
        });
    });

    describe('Signal Operations', function() {
        beforeEach(async function() {
            await kuksaManager.initialize();
        });

        it('should subscribe to vehicle signals', async function() {
            const signalPaths = ['Vehicle.Speed', 'Vehicle.Engine.RPM'];
            const subscriptionId = await kuksaManager.subscribeToSignals(signalPaths);

            assert(subscriptionId);
            assert(typeof subscriptionId === 'string');
            assert(kuksaManager.subscriptions.has(subscriptionId));

            const subscription = kuksaManager.subscriptions.get(subscriptionId);
            assert.deepStrictEqual(subscription.paths, signalPaths);
            assert.strictEqual(subscription.active, true);

            console.log('Signal subscription created:', subscriptionId);
        });

        it('should unsubscribe from vehicle signals', async function() {
            const signalPaths = ['Vehicle.Speed'];
            const subscriptionId = await kuksaManager.subscribeToSignals(signalPaths);

            await kuksaManager.unsubscribeFromSignals(subscriptionId);

            assert(!kuksaManager.subscriptions.has(subscriptionId));
            console.log('Signal subscription removed');
        });

        it('should set signal values', async function() {
            const signalUpdates = {
                'Vehicle.Speed': 75.5,
                'Vehicle.Engine.RPM': 3000
            };

            const response = await kuksaManager.setSignalValues(signalUpdates);

            assert(response);
            assert.strictEqual(response.status, 'success');

            // Check cache is updated
            const cachedValue = kuksaManager.signalValues.get('Vehicle.Speed');
            assert.strictEqual(cachedValue.value, 75.5);
            assert.strictEqual(cachedValue.source, 'set');

            console.log('Signal values set successfully');
        });

        it('should get signal values', async function() {
            // First set some values
            await kuksaManager.setSignalValues({
                'Vehicle.Speed': 60.0
            });

            const signalPaths = ['Vehicle.Speed', 'Vehicle.Engine.RPM'];
            const values = await kuksaManager.getSignalValues(signalPaths);

            assert(typeof values === 'object');
            assert(values['Vehicle.Speed'] !== undefined);
            console.log('Signal values retrieved:', values);
        });

        it('should handle subscription events', function(done) {
            this.timeout(3000);

            kuksaManager.on('signalsUpdated', (signals) => {
                assert(signals);
                assert(typeof signals === 'object');
                console.log('Received signal update event:', signals);
                done();
            });

            // Trigger signal updates
            kuksaManager._startSignalSimulation();
        });
    });

    describe('Cache Management', function() {
        beforeEach(async function() {
            await kuksaManager.initialize();
        });

        it('should cache signal values', function() {
            const testSignals = {
                'Vehicle.Speed': { value: 50.0, timestamp: new Date(), source: 'test' }
            };

            for (const [path, data] of Object.entries(testSignals)) {
                kuksaManager.signalValues.set(path, data);
            }

            const cachedValues = kuksaManager.getCachedSignalValues();

            assert.deepStrictEqual(cachedValues['Vehicle.Speed'].value, 50.0);
            assert(cachedValues['Vehicle.Speed'].source, 'test');
        });

        it('should return empty cache when no values', function() {
            const cachedValues = kuksaManager.getCachedSignalValues();
            assert.deepStrictEqual(cachedValues, {});
        });
    });

    describe('Status Reporting', function() {
        beforeEach(async function() {
            await kuksaManager.initialize();
        });

        it('should report correct status', function() {
            const status = kuksaManager.getStatus();

            assert(typeof status.isConnected === 'boolean');
            assert.strictEqual(status.kuksaUrl, 'localhost:55555');
            assert(typeof status.activeSubscriptions === 'number');
            assert(typeof status.cachedSignals === 'number');
            assert(status.vssLoaded);

            console.log('Kuksa Manager status:', status);
        });
    });

    describe('Error Handling', function() {
        it('should handle invalid VSS JSON', async function() {
            // Write invalid JSON to VSS file
            await fs.writeFile(kuksaManager.options.vssPath, 'invalid json');

            try {
                await kuksaManager.initialize();
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert(error);
                console.log('Invalid JSON error handled correctly');
            }
        });

        it('should handle operations when not connected', async function() {
            const manager = new KuksaManager({ logLevel: 'error' });

            try {
                await manager.subscribeToSignals(['Vehicle.Speed']);
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert(error.message.includes('Not connected to Kuksa databroker'));
            }
        });

        it('should handle invalid subscription ID', async function() {
            await kuksaManager.initialize();

            try {
                await kuksaManager.unsubscribeFromSignals('invalid-id');
                console.log('Invalid subscription ID handled gracefully');
            } catch (error) {
                assert.fail('Should handle invalid subscription ID gracefully');
            }
        });
    });
});