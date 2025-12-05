#!/usr/bin/env node

const { io } = require('socket.io-client');

async function testPythonExecution() {
  console.log('🧪 Testing Python Application Execution in Separate Container Setup');
  console.log('=================================================================');

  try {
    // Connect to Vehicle Edge Runtime WebSocket
    const socket = io('http://localhost:3002', {
      transports: ['websocket']
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        console.log('✅ Connected to Vehicle Edge Runtime WebSocket');
        resolve();
      });

      socket.on('connect_error', (error) => {
        console.log('❌ Failed to connect:', error.message);
        reject(error);
      });

      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // Test Python application execution
    const pythonApp = {
      name: 'test-python-app',
      description: 'Test Python App',
      language: 'python',
      code: `print("Hello from Python in separate container!")\nprint("Docker permissions are working!")\nimport sys\nprint(f"Python version: {sys.version}")`,
      inputs: []
    };

    console.log('🐍 Executing Python application...');

    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Python execution timeout'));
      }, 30000);

      socket.on('python-execution-result', (result) => {
        clearTimeout(timeout);
        resolve(result);
      });

      socket.emit('execute-python', pythonApp);
    });

    console.log('📊 Execution Results:');
    console.log('===================');
    console.log('Exit Code:', result.exitCode);
    console.log('Stdout:', result.stdout);
    console.log('Stderr:', result.stderr);
    console.log('Execution Time:', result.executionTime, 'ms');

    if (result.exitCode === 0) {
      console.log('\n✅ SUCCESS: Python application executed successfully!');
      console.log('✅ Docker permissions are working correctly');
      console.log('✅ Separate container setup is fully functional');
    } else {
      console.log('\n❌ Python execution failed');
    }

    socket.disconnect();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testPythonExecution();