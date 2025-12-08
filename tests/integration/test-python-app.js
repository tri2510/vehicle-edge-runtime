#!/usr/bin/env node

/**
 * Test Python application execution
 */

import WebSocket from 'ws';

const RUNTIME_URL = 'ws://localhost:3002/runtime';

function testPythonExecution() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(RUNTIME_URL);
        let pythonCode = `
print("Hello from Python in Vehicle Edge Runtime!")
print("Environment variables:")
import os
for key, value in os.environ.items():
    if key.startswith('APP_') or key.startswith('EXECUTION_'):
        print(f"  {key}={value}")
print("Python execution completed successfully.")
`;

        ws.on('open', () => {
            console.log('Connected to Vehicle Edge Runtime');

            // Run Python app
            ws.send(JSON.stringify({
                type: 'run_python_app',
                appId: 'test-python-hello',
                code: pythonCode,
                entryPoint: 'main.py',
                env: {
                    TEST_VAR: 'test_value_from_client'
                },
                workingDir: '/app'
            }));
        });

        let executionId = null;
        let consoleOutput = [];

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('Received:', JSON.stringify(message, null, 2));

                if (message.type === 'connection_established') {
                    console.log('✓ Connection established');
                } else if (message.type === 'python_app_started') {
                    console.log('✓ Python app started');
                    executionId = message.executionId;

                    // Subscribe to console output
                    ws.send(JSON.stringify({
                        type: 'console_subscribe',
                        executionId: executionId
                    }));

                    // Check app status after a delay
                    setTimeout(() => {
                        ws.send(JSON.stringify({
                            type: 'get_app_status',
                            executionId: executionId
                        }));
                    }, 2000);

                    // Stop app after more delay
                    setTimeout(() => {
                        ws.send(JSON.stringify({
                            type: 'stop_app',
                            executionId: executionId
                        }));
                    }, 4000);

                } else if (message.type === 'console_output') {
                    console.log('📝 Console output:', message.output);
                    consoleOutput.push(message.output);
                } else if (message.type === 'app_status') {
                    console.log('📊 App status:', message.status);
                } else if (message.type === 'app_stopped') {
                    console.log('✓ App stopped');
                    setTimeout(() => {
                        ws.close();
                        resolve({
                            success: true,
                            executionId,
                            consoleOutput
                        });
                    }, 1000);
                } else if (message.type === 'error') {
                    console.log('❌ Error:', message.error);
                    ws.close();
                    reject(new Error(message.error));
                }
            } catch (error) {
                console.log('❌ Failed to parse message:', error.message);
                ws.close();
                reject(error);
            }
        });

        ws.on('error', (error) => {
            console.log('❌ WebSocket error:', error.message);
            reject(error);
        });

        ws.on('close', () => {
            console.log('Connection closed');
            resolve({
                success: false,
                consoleOutput
            });
        });

        // Timeout after 15 seconds
        setTimeout(() => {
            console.log('❌ Test timeout');
            ws.close();
            reject(new Error('Test timeout'));
        }, 15000);
    });
}

async function main() {
    console.log('Testing Python Application Execution');
    console.log('====================================');

    try {
        const result = await testPythonExecution();

        if (result.success) {
            console.log('\n🎉 Python execution test completed successfully!');
            console.log('Execution ID:', result.executionId);
            console.log('Console output lines:', result.consoleOutput.length);
            process.exit(0);
        } else {
            console.log('\n❌ Python execution test failed!');
            process.exit(1);
        }

    } catch (error) {
        console.log('\n❌ Test failed with error:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);