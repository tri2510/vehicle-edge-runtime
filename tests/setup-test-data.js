#!/usr/bin/env node

/**
 * Test Data Setup Script
 *
 * Creates test data directories and mock files for testing purposes.
 */

import fs from 'fs';
import path from 'path';

const TEST_DATA_DIR = './test-data';
const MOCK_APPS_DIR = path.join(TEST_DATA_DIR, 'mock-applications');
const CONFIGS_DIR = path.join(TEST_DATA_DIR, 'configs');

function setupTestData() {
    console.log('🔧 Setting up test data...');

    // Create directories
    const directories = [
        TEST_DATA_DIR,
        MOCK_APPS_DIR,
        CONFIGS_DIR,
        path.join(TEST_DATA_DIR, 'logs'),
        path.join(TEST_DATA_DIR, 'applications'),
        path.join(TEST_DATA_DIR, 'database')
    ];

    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }
    });

    // Create mock application files
    const mockApps = [
        {
            name: 'simple-printer.py',
            content: `#!/usr/bin/env python3
"""
Simple test application for Vehicle Edge Runtime testing.
"""

import asyncio
import time

print("🚀 Mock application started")

async def main():
    print("📋 Processing test data...")

    for i in range(5):
        print(f"🔄 Processing step {i+1}/5")
        await asyncio.sleep(0.5)

    print("✅ Mock application completed")

if __name__ == "__main__":
    asyncio.run(main())
`
        },
        {
            name: 'error-simulator.py',
            content: `#!/usr/bin/env python3
"""
Error simulation test application.
"""

import sys

print("🚨 Error simulator started")

# Simulate different error scenarios
if len(sys.argv) > 1 and sys.argv[1] == "syntax_error":
    print("This would cause a syntax error in real scenario")
    # invalid syntax here
elif len(sys.argv) > 1 and sys.argv[1] == "runtime_error":
    print("Simulating runtime error...")
    raise Exception("This is a simulated runtime error")
else:
    print("✅ Error simulator completed without errors")
`
        },
        {
            name: 'vehicle-data-simulator.py',
            content: `#!/usr/bin/env python3
"""
Vehicle data simulation application.
"""

import asyncio
import json
import time
from datetime import datetime

class VehicleDataSimulator:
    def __init__(self):
        self.vehicle_data = {
            'Vehicle.Speed': 0.0,
            'Vehicle.Body.Lights.IsLowBeamOn': False,
            'Vehicle.Body.Lights.IsHighBeamOn': False,
            'Vehicle.Powertrain.Transmission.CurrentGear': 1,
            'Vehicle.ADAS.ABS.IsActive': False,
            'Vehicle.Cabin.Infotainment.HMI.CurrentLanguage': 'en-US'
        }

    async def simulate(self):
        print("🚗 Vehicle data simulator started")

        for i in range(10):
            # Update vehicle data
            self.vehicle_data['Vehicle.Speed'] = min(120.0, max(0.0, self.vehicle_data['Vehicle.Speed'] + 10))
            self.vehicle_data['Vehicle.Body.Lights.IsLowBeamOn'] = i > 3
            self.vehicle_data['Vehicle.Powertrain.Transmission.CurrentGear'] = min(5, int(self.vehicle_data['Vehicle.Speed'] / 20) + 1)

            print(f"📊 Update {i+1}/10 - Speed: {self.vehicle_data['Vehicle.Speed']:.1f} km/h")
            await asyncio.sleep(0.5)

        print("✅ Vehicle data simulation completed")

async def main():
    simulator = VehicleDataSimulator()
    await simulator.simulate()

if __name__ == "__main__":
    asyncio.run(main())
`
        }
    ];

    mockApps.forEach(app => {
        const appPath = path.join(MOCK_APPS_DIR, app.name);
        fs.writeFileSync(appPath, app.content);
        console.log(`📄 Created mock app: ${app.name}`);
    });

    // Create mock configuration files
    const configs = [
        {
            name: 'test-runtime-config.json',
            content: JSON.stringify({
                runtime: {
                    port: 3002,
                    healthPort: 3003,
                    kuksaEnabled: false,
                    logLevel: 'info'
                },
                applications: {
                    defaultLanguage: 'python',
                    defaultTimeout: 30000,
                    maxConcurrentApps: 10
                },
                resources: {
                    memoryLimit: '512m',
                    cpuLimit: '1.0',
                    diskLimit: '1g'
                }
            }, null, 2)
        },
        {
            name: 'mock-kuksa-signals.json',
            content: JSON.stringify({
                Vehicle: {
                    Speed: {
                        type: 'float',
                        min: 0.0,
                        max: 300.0,
                        unit: 'km/h'
                    },
                    Body: {
                        Lights: {
                            IsLowBeamOn: {
                                type: 'boolean'
                            },
                            IsHighBeamOn: {
                                type: 'boolean'
                            }
                        }
                    },
                    Powertrain: {
                        Transmission: {
                            CurrentGear: {
                                type: 'int',
                                min: 1,
                                max: 8
                            }
                        }
                    },
                    ADAS: {
                        ABS: {
                            IsActive: {
                                type: 'boolean'
                            }
                        }
                    }
                }
            }, null, 2)
        }
    ];

    configs.forEach(config => {
        const configPath = path.join(CONFIGS_DIR, config.name);
        fs.writeFileSync(configPath, config.content);
        console.log(`⚙️ Created config: ${config.name}`);
    });

    // Create a mock database schema
    const dbSchema = `
-- Mock SQLite database schema for testing
CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    log_output TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES applications (id)
);

CREATE TABLE IF NOT EXISTS runtime_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL,
    metric_value TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert some test data
INSERT OR IGNORE INTO applications (id, name, code, language, status) VALUES
('test-app-1', 'Test Application 1', 'print("Hello World")', 'python', 'completed'),
('test-app-2', 'Test Application 2', 'print("Another test")', 'python', 'running');

INSERT OR IGNORE INTO runtime_metrics (metric_type, metric_value) VALUES
('active_connections', '1'),
('total_deployments', '2'),
('uptime_seconds', '3600');
`;

    fs.writeFileSync(path.join(TEST_DATA_DIR, 'database', 'schema.sql'), dbSchema);
    console.log('🗄️ Created mock database schema');

    // Create a simple .env file for testing
    const envContent = `
# Environment variables for testing
NODE_ENV=test
PORT=3002
HEALTH_PORT=3003
KUKSA_ENABLED=false
DATA_DIR=./test-data
LOG_LEVEL=info
`;

    fs.writeFileSync(path.join(TEST_DATA_DIR, '.env'), envContent.trim());
    console.log('🔧 Created test environment file');

    console.log('✅ Test data setup completed');
    console.log(`📁 Test data directory: ${TEST_DATA_DIR}`);
}

function cleanupTestData() {
    console.log('🧹 Cleaning up test data...');

    if (fs.existsSync(TEST_DATA_DIR)) {
        try {
            fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
            console.log(`🗑️ Removed test data directory: ${TEST_DATA_DIR}`);
        } catch (error) {
            console.error(`❌ Failed to cleanup test data: ${error.message}`);
        }
    }

    console.log('✅ Test data cleanup completed');
}

// Command line interface
const command = process.argv[2];

switch (command) {
    case 'setup':
        setupTestData();
        break;
    case 'cleanup':
        cleanupTestData();
        break;
    default:
        console.log('Usage: node setup-test-data.js [setup|cleanup]');
        process.exit(1);
}