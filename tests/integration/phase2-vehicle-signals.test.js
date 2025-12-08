/**
 * Phase 2 Vehicle Signals Integration Tests
 * Tests Kuksa integration, vehicle signal management, and credential injection
 */

import assert from 'assert';
import WebSocket from 'ws';

describe('Phase 2 Vehicle Signals Integration', function() {
    this.timeout(30000);

    let runtime;
    let wsClient;
    let runtimeUrl = 'ws://localhost:3002/runtime';

    before(async function() {
        console.log('Starting Phase 2 Vehicle Signals integration tests...');

        // Connect to runtime
        wsClient = new WebSocket(runtimeUrl);

        await new Promise((resolve, reject) => {
            wsClient.on('open', () => {
                console.log('Connected to Vehicle Edge Runtime');
                resolve();
            });

            wsClient.on('error', reject);

            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
    });

    after(async function() {
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.close();
        }
    });

    describe('Kuksa Integration', function() {
        it('should report Kuksa connection status', function(done) {
            const message = {
                type: 'report-runtime-state'
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                assert.strictEqual(response.type, 'runtime_state_response');
                assert(typeof response.runtimeState.kuksaConnected === 'boolean');

                console.log('Kuksa connection status:', response.runtimeState.kuksaConnected);
                done();
            });
        });

        it('should subscribe to vehicle signals', function(done) {
            const message = {
                type: 'subscribe_apis',
                apis: ['Vehicle.Speed', 'Vehicle.Engine.RPM']
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                assert.strictEqual(response.type, 'apis_subscribed');
                assert(response.subscriptionId);
                assert.deepStrictEqual(response.apis, ['Vehicle.Speed', 'Vehicle.Engine.RPM']);

                console.log('Subscribed to signals with ID:', response.subscriptionId);
                done();
            });
        });

        it('should receive real-time signal updates', function(done) {
            this.timeout(10000); // Wait for simulated signal updates

            // Listen for signal updates
            const messageHandler = (data) => {
                const response = JSON.parse(data.toString());

                if (response.type === 'apis-value' || response.cmd === 'apis-value') {
                    const signals = response.result || response.data;

                    if (signals && (signals['Vehicle.Speed'] || signals['Vehicle.Engine.RPM'])) {
                        console.log('Received signal updates:', signals);

                        // Validate signal structure
                        assert(typeof signals['Vehicle.Speed'] === 'number' || signals['Vehicle.Speed'] === undefined);
                        assert(typeof signals['Vehicle.Engine.RPM'] === 'number' || signals['Vehicle.Engine.RPM'] === undefined);

                        wsClient.removeListener('message', messageHandler);
                        done();
                    }
                }
            };

            wsClient.on('message', messageHandler);
        });

        it('should write vehicle signal values', function(done) {
            const message = {
                type: 'write_signals_value',
                data: {
                    'Vehicle.Transmission.Gear': 3,
                    'Vehicle.Body.Lights.IsLightOn': true
                }
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                assert.strictEqual(response.type, 'signals_written');
                assert(response.response);

                console.log('Signal write response:', response.response);
                done();
            });
        });

        it('should get current signal values', function(done) {
            const message = {
                type: 'get_signals_value',
                apis: ['Vehicle.Speed', 'Vehicle.Engine.RPM', 'Vehicle.Transmission.Gear']
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                assert.strictEqual(response.type, 'signals_value_response');
                assert(response.result);
                assert(typeof response.result === 'object');

                console.log('Current signal values:', response.result);
                done();
            });
        });
    });

    describe('VSS Management', function() {
        it('should list mock signals', function(done) {
            const message = {
                type: 'list_mock_signal'
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                assert.strictEqual(response.type, 'mock_signal_list');
                assert(Array.isArray(response.data));
                assert(response.data.length > 0);

                // Validate signal structure
                const firstSignal = response.data[0];
                assert(firstSignal.path);
                assert(firstSignal.datatype);
                assert(firstSignal.type);

                console.log('Found', response.data.length, 'mock signals');
                console.log('Sample signal:', firstSignal);
                done();
            });
        });

        it('should set mock signal values', function(done) {
            const mockSignals = [
                { name: 'Vehicle.Speed', value: 85.5 },
                { name: 'Vehicle.Engine.RPM', value: 3200 }
            ];

            const message = {
                type: 'set_mock_signals',
                data: mockSignals
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                assert.strictEqual(response.type, 'mock_signals_set');
                assert.strictEqual(response.success, true);
                assert.strictEqual(response.signalCount, 2);

                console.log('Set mock signals successfully');
                done();
            });
        });

        it('should generate custom vehicle model', function(done) {
            const customVSS = {
                "CustomVehicle": {
                    "Speed": {
                        "datatype": "float",
                        "type": "sensor",
                        "unit": "mph"
                    },
                    "Battery": {
                        "Level": {
                            "datatype": "uint8",
                            "type": "sensor",
                            "unit": "%",
                            "min": 0,
                            "max": 100
                        }
                    }
                }
            };

            const message = {
                type: 'generate_vehicle_model',
                data: JSON.stringify(customVSS)
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                assert.strictEqual(response.type, 'vehicle_model_generated');
                assert.strictEqual(response.success, true);
                assert(response.vssPath);

                console.log('Generated custom vehicle model at:', response.vssPath);
                done();
            });
        });

        it('should revert to default vehicle model', function(done) {
            const message = {
                type: 'revert_vehicle_model'
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                assert.strictEqual(response.type, 'vehicle_model_reverted');
                assert.strictEqual(response.success, true);

                console.log('Reverted to default vehicle model');
                done();
            });
        });
    });

    describe('Python Application with Vehicle Access', function() {
        let executionId;

        it('should run Python application with Kuksa access', function(done) {
            const pythonCode = `
import os
import time
import json

# Get vehicle credentials from environment
token = os.getenv('VEHICLE_ACCESS_TOKEN', 'no-token')
vehicle_id = os.getenv('VEHICLE_ID', 'test-vehicle')
kuksa_url = os.getenv('KUKSA_SERVER_URL', 'localhost:55555')

print(f"Vehicle ID: {vehicle_id}")
print(f"Kuksa URL: {kuksa_url}")
print(f"Token: {token[:20]}...")

# Simulate vehicle signal reading
for i in range(3):
    speed = 60 + i * 10
    rpm = 2000 + i * 500
    print(f"Iteration {i+1}: Speed={speed}km/h, RPM={rpm}")
    time.sleep(0.5)

print("Vehicle application completed successfully!")
`;

            const message = {
                type: 'run_python_app',
                data: {
                    language: 'python',
                    code: pythonCode,
                    name: 'VehicleSignalsApp'
                }
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                assert.strictEqual(response.type, 'run_python_app');
                assert(response.executionId);

                executionId = response.executionId;
                console.log('Python application started with ID:', executionId);
                done();
            });
        });

        it('should receive application console output', function(done) {
            this.timeout(15000);

            let outputReceived = false;
            const messageHandler = (data) => {
                const response = JSON.parse(data.toString());

                if (response.type === 'app_output' && response.executionId === executionId) {
                    console.log('Application output:', response.output);

                    if (response.output.includes('Vehicle application completed successfully!')) {
                        outputReceived = true;
                        wsClient.removeListener('message', messageHandler);
                        done();
                    }
                }
            };

            wsClient.on('message', messageHandler);

            // Fallback timeout
            setTimeout(() => {
                if (!outputReceived) {
                    wsClient.removeListener('message', messageHandler);
                    done(new Error('Timeout waiting for application output'));
                }
            }, 14000);
        });

        it('should get application status', function(done) {
            const message = {
                type: 'get_app_status',
                executionId: executionId
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                assert.strictEqual(response.type, 'app_status_response');
                assert(response.status);

                console.log('Application status:', response.status);
                done();
            });
        });
    });

    describe('Runtime Capabilities', function() {
        it('should report enhanced runtime capabilities', function(done) {
            const message = {
                type: 'report-runtime-state'
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                assert.strictEqual(response.type, 'runtime_state_response');
                assert(response.runtimeState.kuksaConnected !== undefined);
                assert(response.runtimeState.kuksaConnected !== null);

                console.log('Enhanced runtime capabilities:', {
                    kuksaConnected: response.runtimeState.kuksaConnected,
                    supportApis: response.runtimeState.supportApis
                });
                done();
            });
        });

        it('should handle concurrent signal operations', function(done) {
            this.timeout(10000);

            let completedOperations = 0;
            const totalOperations = 5;

            const operationComplete = () => {
                completedOperations++;
                if (completedOperations === totalOperations) {
                    console.log('All concurrent operations completed successfully');
                    done();
                }
            };

            // Send multiple concurrent signal operations
            for (let i = 0; i < totalOperations; i++) {
                const message = {
                    type: 'write_signals_value',
                    data: {
                        [`Vehicle.Test.Signal${i}`]: Math.random() * 100
                    }
                };

                wsClient.send(JSON.stringify(message));

                const responseHandler = (data) => {
                    const response = JSON.parse(data.toString());
                    if (response.type === 'signals_written') {
                        wsClient.removeListener('message', responseHandler);
                        operationComplete();
                    }
                };

                wsClient.once('message', responseHandler);
            }
        });
    });

    describe('Error Handling', function() {
        it('should handle invalid signal paths gracefully', function(done) {
            const message = {
                type: 'subscribe_apis',
                apis: ['Invalid.Signal.Path', 'Vehicle.NonExistent.Signal']
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                // Should either succeed with filtered valid paths or return an error
                assert(['apis_subscribed', 'error'].includes(response.type));

                if (response.type === 'error') {
                    assert(response.error.includes('No valid signal paths'));
                }

                console.log('Invalid signal path handling:', response.type);
                done();
            });
        });

        it('should handle malformed VSS data', function(done) {
            const message = {
                type: 'generate_vehicle_model',
                data: 'invalid json data'
            };

            wsClient.send(JSON.stringify(message));

            wsClient.once('message', (data) => {
                const response = JSON.parse(data.toString());

                assert.strictEqual(response.type, 'error');
                assert(response.error.includes('Failed to generate vehicle model'));

                console.log('Malformed VSS handling:', response.error);
                done();
            });
        });
    });
});