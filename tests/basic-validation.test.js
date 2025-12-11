import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

describe('Vehicle Edge Runtime - Basic Validation Tests', () => {

    test('should have required project structure', () => {
        const requiredFiles = [
            'src/index.js',
            'src/core/VehicleEdgeRuntime.js',
            'src/apps/EnhancedApplicationManager.js',
            'src/api/WebSocketHandler.js',
            'src/api/MessageHandler.js',
            'src/vehicle/KuksaManager.js',
            'package.json',
            'README.md'
        ];

        requiredFiles.forEach(file => {
            const filePath = path.join(projectRoot, file);
            assert(fs.existsSync(filePath), `Required file missing: ${file}`);
        });

        const requiredDirs = [
            'src/core',
            'src/apps',
            'src/api',
            'src/vehicle',
            'src/console',
            'src/database',
            'src/monitoring',
            'src/utils',
            'tests',
            'data',
            'example'
        ];

        requiredDirs.forEach(dir => {
            const dirPath = path.join(projectRoot, dir);
            assert(fs.existsSync(dirPath), `Required directory missing: ${dir}`);
            assert(fs.statSync(dirPath).isDirectory(), `${dir} should be a directory`);
        });
    });

    test('should have valid package.json', () => {
        const packageJsonPath = path.join(projectRoot, 'package.json');
        assert(fs.existsSync(packageJsonPath), 'package.json should exist');

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        assert(packageJson.name === 'vehicle-edge-runtime', 'Package name should be correct');
        assert(packageJson.version, 'Package should have a version');
        assert(packageJson.type === 'module', 'Should be ES module');
        assert(packageJson.main === 'src/index.js', 'Should have correct entry point');
        assert(packageJson.engines.node >= '18.0.0', 'Should require Node.js 18+');

        // Check test scripts exist
        assert(packageJson.scripts.test, 'Should have test script');
        assert(packageJson.scripts['test:unit'], 'Should have unit test script');
        assert(packageJson.scripts['test:integration'], 'Should have integration test script');
        assert(packageJson.scripts['test:e2e'], 'Should have e2e test script');
    });

    test('should have required dependencies', () => {
        const packageJsonPath = path.join(projectRoot, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        const requiredDeps = [
            'ws',
            'uuid',
            'winston',
            'dockerode',
            'socket.io-client',
            'sqlite'
        ];

        requiredDeps.forEach(dep => {
            assert(packageJson.dependencies[dep], `Missing required dependency: ${dep}`);
        });
    });

    test('should have test strategy documentation', () => {
        const testStrategyPath = path.join(projectRoot, 'tests/HOST_TEST_STRATEGY.md');
        assert(fs.existsSync(testStrategyPath), 'Test strategy document should exist');

        const content = fs.readFileSync(testStrategyPath, 'utf8');
        assert(content.length > 1000, 'Test strategy should be comprehensive');
        assert(content.includes('Test 1'), 'Should contain test cases');
        assert(content.includes('Goal'), 'Should define test goals');
    });

    test('should have test configuration', () => {
        const testConfigPath = path.join(projectRoot, 'tests/test-config.json');
        assert(fs.existsSync(testConfigPath), 'Test configuration should exist');

        const config = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
        assert(config.testEnvironment, 'Should have test environment config');
        assert(config.testSuites, 'Should have test suites config');
        assert(config.testSuites.unit, 'Should have unit test config');
        assert(config.testSuites.integration, 'Should have integration test config');
        assert(config.testSuites.e2e, 'Should have e2e test config');
        assert(config.testSuites.fullStack, 'Should have full stack test config');
    });

    test('should have test runner script', () => {
        const testRunnerPath = path.join(projectRoot, 'test-runner.js');
        assert(fs.existsSync(testRunnerPath), 'Test runner should exist');

        const content = fs.readFileSync(testRunnerPath, 'utf8');
        assert(content.includes('TestRunner'), 'Should contain TestRunner class');
        assert(content.includes('runUnitTests'), 'Should have unit test method');
        assert(content.includes('runIntegrationTests'), 'Should have integration test method');
    });

    test('should have example applications', () => {
        const exampleDir = path.join(projectRoot, 'example');
        assert(fs.existsSync(exampleDir), 'Example directory should exist');

        const examples = fs.readdirSync(exampleDir);
        assert(examples.some(file => file.includes('vehicle')), 'Should have vehicle-related examples');
    });

    test('should have simulation scripts', () => {
        const simulationDir = path.join(projectRoot, 'simulation');
        if (fs.existsSync(simulationDir)) {
            const scripts = fs.readdirSync(simulationDir);
            assert(scripts.some(script => script.includes('kuksa')), 'Should have Kuksa simulation scripts');
            assert(scripts.some(script => script.includes('kit-manager')), 'Should have Kit Manager scripts');
        }
    });

    test('should have valid source code structure', () => {
        const srcDir = path.join(projectRoot, 'src');
        const srcFiles = [];

        function walkDir(dir, files = []) {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                if (fs.statSync(fullPath).isDirectory()) {
                    walkDir(fullPath, files);
                } else if (item.endsWith('.js')) {
                    files.push(fullPath);
                }
            }
            return files;
        }

        const allJsFiles = walkDir(srcDir);
        assert(allJsFiles.length > 5, 'Should have multiple JavaScript source files');

        // Check that main files are modules
        allJsFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            if (file.includes('VehicleEdgeRuntime.js') ||
                file.includes('EnhancedApplicationManager.js') ||
                file.includes('WebSocketHandler.js')) {

                // Should use ES module exports
                const hasExport = content.includes('export ');
                assert(hasExport, `${path.relative(projectRoot, file)} should use ES module exports`);
            }
        });
    });

    test('should have test data setup', () => {
        const setupScriptPath = path.join(projectRoot, 'tests/setup-test-data.js');
        assert(fs.existsSync(setupScriptPath), 'Test data setup script should exist');

        const testDataDir = path.join(projectRoot, 'test-data');
        if (fs.existsSync(testDataDir)) {
            const mockAppsDir = path.join(testDataDir, 'mock-applications');
            const configsDir = path.join(testDataDir, 'configs');

            if (fs.existsSync(mockAppsDir)) {
                const mockApps = fs.readdirSync(mockAppsDir);
                assert(mockApps.length > 0, 'Should have mock applications');
            }

            if (fs.existsSync(configsDir)) {
                const configs = fs.readdirSync(configsDir);
                assert(configs.length > 0, 'Should have mock configuration files');
            }
        }
    });

    test('should be able to parse main entry point', () => {
        const mainIndexPath = path.join(projectRoot, 'src/index.js');
        assert(fs.existsSync(mainIndexPath), 'Main entry point should exist');

        const content = fs.readFileSync(mainIndexPath, 'utf8');
        assert(content.includes('VehicleEdgeRuntime'), 'Should import VehicleEdgeRuntime');
        assert(content.includes('new VehicleEdgeRuntime'), 'Should instantiate VehicleEdgeRuntime');
    });
});