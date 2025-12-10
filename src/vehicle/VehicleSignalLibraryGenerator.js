/**
 * Vehicle Signal Library Generator
 * Generates Python SDK from VSS model for vehicle signal access
 */

import { Logger } from '../utils/Logger.js';
import fs from 'fs-extra';
import path from 'path';

export class VehicleSignalLibraryGenerator {
    constructor(options = {}) {
        this.options = {
            outputDir: options.outputDir || './data/signal-libs',
            vssUrl: options.vssUrl || 'https://github.com/COVESA/vehicle_signal_specification/raw/master/spec/VSS_release_3.0.json',
            logLevel: options.logLevel || 'info'
        };
        this.logger = new Logger('VehicleSignalLibraryGenerator', this.options.logLevel);
        this.templateDir = path.join(__dirname, 'templates');
    }

    async generateSignalLibrary(appId, signals, vssEndpoint = null) {
        try {
            this.logger.info('Generating vehicle signal library', { appId, signals, vssEndpoint });

            // Ensure output directory exists
            await fs.ensureDir(this.options.outputDir);
            await fs.ensureDir(path.join(this.options.outputDir, appId));

            // Get VSS model
            let vssModel;
            if (vssEndpoint) {
                vssModel = await this.fetchVSSModel(vssEndpoint);
            } else {
                // Use default VSS model
                vssModel = await this.getDefaultVSSModel();
            }

            // Validate signals against VSS
            const validatedSignals = this.validateSignals(signals, vssModel);

            // Generate Python SDK
            const libraryData = await this.generatePythonSDK(appId, validatedSignals, vssModel);

            // Write library files
            await this.writeLibraryFiles(appId, libraryData);

            // Generate documentation
            await this.generateDocumentation(appId, validatedSignals);

            this.logger.info('Vehicle signal library generated successfully', {
                appId,
                signalsCount: validatedSignals.length,
                outputPath: path.join(this.options.outputDir, appId)
            });

            return {
                success: true,
                appId,
                libraryPath: path.join(this.options.outputDir, appId),
                signals: validatedSignals,
                version: libraryData.version
            };

        } catch (error) {
            this.logger.error('Failed to generate vehicle signal library', {
                appId,
                error: error.message
            });
            throw error;
        }
    }

    async fetchVSSModel(vssEndpoint) {
        this.logger.info('Fetching VSS model', { vssEndpoint });

        try {
            // In a real implementation, this would fetch from the actual endpoint
            // For now, we'll use the default model
            this.logger.warn('Using default VSS model (endpoint fetching not implemented)');
            return await this.getDefaultVSSModel();

        } catch (error) {
            this.logger.error('Failed to fetch VSS model', { vssEndpoint, error: error.message });
            throw error;
        }
    }

    async getDefaultVSSModel() {
        // Default VSS model with common vehicle signals
        return {
            version: "3.0",
            signals: {
                "Vehicle.Speed": {
                    type: "float",
                    unit: "km/h",
                    description: "Vehicle speed",
                    min: 0,
                    max: 250
                },
                "Vehicle.Steering.Angle": {
                    type: "float",
                    unit: "deg",
                    description: "Steering wheel angle",
                    min: -720,
                    max: 720
                },
                "Vehicle.Engine.RPM": {
                    type: "float",
                    unit: "rpm",
                    description: "Engine revolutions per minute",
                    min: 0,
                    max: 8000
                },
                "Vehicle.Powertrain.Transmission.Gear": {
                    type: "uint8",
                    unit: "",
                    description: "Current transmission gear",
                    min: 0,
                    max: 8
                },
                "Vehicle.Body.Lights.IsLowBeamOn": {
                    type: "boolean",
                    unit: "",
                    description: "Low beam headlights status"
                },
                "Vehicle.Body.Lights.IsHighBeamOn": {
                    type: "boolean",
                    unit: "",
                    description: "High beam headlights status"
                },
                "Vehicle.ADAS.ABS.IsActive": {
                    type: "boolean",
                    unit: "",
                    description: "ABS system active status"
                },
                "Vehicle.Cabin.Infotainment.Navigation.DestinationSet": {
                    type: "boolean",
                    unit: "",
                    description": "Navigation destination is set"
                },
                "Vehicle.OBD.Speed": {
                    type: "float",
                    unit: "km/h",
                    description: "OBD speed reading"
                },
                "Vehicle.Powertrain.Battery.StateOfCharge": {
                    type: "float",
                    unit: "%",
                    description: "Battery state of charge",
                    min: 0,
                    max: 100
                }
            }
        };
    }

    validateSignals(signals, vssModel) {
        const validated = [];
        const vssSignals = vssModel.signals || {};

        for (const signal of signals) {
            if (vssSignals[signal]) {
                validated.push({
                    name: signal,
                    ...vssSignals[signal]
                });
            } else {
                this.logger.warn('Signal not found in VSS model', { signal });
            }
        }

        return validated;
    }

    async generatePythonSDK(appId, signals, vssModel) {
        const version = "1.0.0";
        const className = this.toPascalCase(appId) + "VehicleApp";

        const sdkCode = this.generateVehicleAppClass(className, signals, vssModel);
        const signalClassesCode = this.generateSignalClasses(signals);
        const initCode = this.generateInitFile(className, version);

        return {
            version,
            className,
            files: {
                'vehicle_app.py': sdkCode,
                'signals.py': signalClassesCode,
                '__init__.py': initCode
            }
        };
    }

    generateVehicleAppClass(className, signals, vssModel) {
        const signalImports = signals.map(s => this.toCamelCase(s.name)).join(', ');
        const signalProperties = signals.map(s => `
        self.${this.toCamelCase(s.name)} = VehicleSignal("${s.name}", ${s.type === 'boolean' ? 'True' : '0'})
        `).join('');

        return `"""
Vehicle Signal Library
Generated from VSS model for ${className}
Version: ${vssModel.version}
"""

import asyncio
import json
from typing import Dict, Any, Callable, Optional, Union
from abc import ABC, abstractmethod

from .signals import VehicleSignal


class ${className}(ABC):
    """
    Vehicle Application base class with generated signal accessors.

    Generated signals:
    ${signals.map(s => `- ${s.name}: ${s.description}`).join('\n    ')}
    """

    def __init__(self):
        """Initialize the vehicle application."""
        super().__init__()

        # Vehicle signal instances
${signalProperties}

        # Signal subscriptions
        self._subscriptions = {}
        self._signal_callbacks = {}

    async def on_start(self) -> None:
        """
        Called when the application starts.
        Override this method to implement startup logic.
        """
        pass

    async def on_stop(self) -> None:
        """
        Called when the application stops.
        Override this method to implement cleanup logic.
        """
        # Unsubscribe from all signals
        await self.unsubscribe_all()

    async def on_signal_changed(self, signal_name: str, value: Any) -> None:
        """
        Called when a subscribed signal value changes.
        Override this method to handle signal changes.
        """
        pass

    async def subscribe_to_signal(self, signal_name: str, callback: Callable = None) -> bool:
        """Subscribe to a vehicle signal."""
        if signal_name not in [s.name for s in ${JSON.stringify(signals.map(s => s.name))}]:
            raise ValueError(f"Signal '{signal_name}' is not available")

        signal = getattr(self, self.toCamelCase(signal_name))
        success = await signal.subscribe(callback or self._on_signal_changed)

        if success:
            self._subscriptions[signal_name] = signal
            if callback:
                self._signal_callbacks[signal_name] = callback

        return success

    async def unsubscribe_from_signal(self, signal_name: str) -> bool:
        """Unsubscribe from a vehicle signal."""
        if signal_name in self._subscriptions:
            signal = self._subscriptions[signal_name]
            success = await signal.unsubscribe()

            if success:
                del self._subscriptions[signal_name]
                if signal_name in self._signal_callbacks:
                    del self._signal_callbacks[signal_name]

            return success

        return False

    async def unsubscribe_all(self) -> None:
        """Unsubscribe from all signals."""
        for signal_name in list(self._subscriptions.keys()):
            await self.unsubscribe_from_signal(signal_name)

    async def get_signal_value(self, signal_name: str) -> Any:
        """Get the current value of a signal."""
        signal = getattr(self, self.toCamelCase(signal_name))
        return await signal.get_value()

    async def set_signal_value(self, signal_name: str, value: Any) -> bool:
        """Set the value of a signal (if writable)."""
        signal = getattr(self, self.toCamelCase(signal_name))
        return await signal.set_value(value)

    def toCamelCase(self, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        parts = snake_str.split('.')
        return '_'.join(self.toPascalCase(part) for part in parts)

    def toPascalCase(self, snake_str: str) -> str:
        """Convert snake_case to PascalCase."""
        return ''.join(word.capitalize() for word in snake_str.split('_'))

    async def get_all_signals(self) -> Dict[str, Any]:
        """Get current values of all available signals."""
        values = {}
        signal_names = [s.name for s in ${JSON.stringify(signals.map(s => s.name))}]

        for signal_name in signal_names:
            try:
                values[signal_name] = await self.get_signal_value(signal_name)
            except Exception as e:
                values[signal_name] = f"Error: {e}"

        return values

    async def log_signal_values(self, signal_names: list = None) -> None:
        """Log current values of specified signals (or all if not specified)."""
        if not signal_names:
            signal_names = [s.name for s in ${JSON.stringify(signals.map(s => s.name))}]

        print("Vehicle Signal Values:")
        print("=" * 50)

        for signal_name in signal_names:
            try:
                value = await self.get_signal_value(signal_name)
                print(f"{signal_name}: {value}")
            except Exception as e:
                print(f"{signal_name}: Error - {e}")

        print("=" * 50)
`;
    }

    generateSignalClasses(signals) {
        const signalClassCode = signals.map(signal => {
            const className = this.toPascalCase(signal.name);
            const dataType = this.mapVSTypeToPython(signal.type);
            const validation = this.generateValidation(signal);

            return `class ${className}(VehicleSignal):
    """
    ${signal.description}

    Type: ${signal.type}
    Unit: ${signal.unit}
    ${signal.min !== undefined ? `Min: ${signal.min}` : ''}
    ${signal.max !== undefined ? `Max: ${signal.max}` : ''}
    """

    def __init__(self, signal_name: str, default_value: ${dataType} = None):
        super().__init__(signal_name, default_value or ${signal.type === 'boolean' ? 'False' : '0'})
        self.data_type = "${dataType}"
        self.unit = "${signal.unit}"
${validation}

    async def validate_value(self, value: ${dataType}) -> bool:
        """Validate signal value against VSS constraints."""
        ${this.generateValidationMethod(signal)}
        return True`;
        }).join('\n\n');

        return `"""
Vehicle Signal Classes
Generated from VSS model
"""

import asyncio
from typing import Any, Callable, Optional


class VehicleSignal:
    """Base class for vehicle signals."""

    def __init__(self, signal_name: str, default_value: Any = None):
        self.signal_name = signal_name
        self.current_value = default_value
        self.default_value = default_value
        self._subscription = None
        self._callback = None

    async def subscribe(self, callback: Callable = None) -> bool:
        """Subscribe to signal changes."""
        self._callback = callback or self._default_callback
        # In a real implementation, this would connect to Kuksa or other vehicle service
        return True

    async def unsubscribe(self) -> bool:
        """Unsubscribe from signal changes."""
        self._callback = None
        self._subscription = None
        return True

    async def get_value(self) -> Any:
        """Get current signal value."""
        return self.current_value

    async def set_value(self, value: Any) -> bool:
        """Set signal value (if writable)."""
        if await self.validate_value(value):
            self.current_value = value
            if self._callback:
                await self._callback(self.signal_name, value)
            return True
        return False

    async def validate_value(self, value: Any) -> bool:
        """Validate value (override in subclasses)."""
        return True

    async def _default_callback(self, signal_name: str, value: Any) -> None:
        """Default callback for signal changes."""
        print(f"[{signal_name}] Value changed: {value}")


${signalClassCode}`;
    }

    generateInitFile(className, version) {
        return `"""
Vehicle Signal Library
Generated from VSS model
"""

from .vehicle_app import ${className}
from .signals import VehicleSignal

__version__ = "${version}"
__all__ = ['${className}', 'VehicleSignal']

# Export the main class for easy access
VehicleApp = ${className}`;
    }

    async writeLibraryFiles(appId, libraryData) {
        const outputPath = path.join(this.options.outputDir, appId);

        for (const [filename, content] of Object.entries(libraryData.files)) {
            const filePath = path.join(outputPath, filename);
            await fs.writeFile(filePath, content);
            this.logger.debug('Library file written', { appId, filename, filePath });
        }
    }

    async generateDocumentation(appId, signals) {
        const docPath = path.join(this.options.outputDir, appId, 'README.md');

        const docContent = `# Vehicle Signal Library

Generated for application: **${appId}**

## Available Signals

| Signal Name | Type | Unit | Description | Min | Max |
|-------------|------|-----|-------------|-----|-----|
${signals.map(s =>
    `| \`${s.name}\` | ${s.type} | ${s.unit} | ${s.description} | ${s.min || 'N/A'} | ${s.max || 'N/A'} |`
).join('\n')}

## Usage

\`\`\`python
from vehicle_app import VehicleApp

class MyApp(VehicleApp):
    def __init__(self):
        super().__init__()

    async def on_start(self):
        # Subscribe to signals
        await self.subscribe_to_signal("Vehicle.Speed", self.on_speed_change)
        await self.subscribe_to_signal("Vehicle.Steering.Angle")

    async def on_speed_change(self, signal_name, value):
        print(f"Speed changed to: {value} km/h")

    async def run(self):
        # Get signal values
        speed = await self.get_signal_value("Vehicle.Speed")
        steering = await self.get_signal_value("Vehicle.Steering.Angle")

        print(f"Current speed: {speed} km/h")
        print(f"Current steering: {steering} deg")

        # Log all signal values
        await self.log_signal_values()
\`\`\`

## Generated Classes

- **VehicleApp**: Base application class with signal accessors
- **VehicleSignal**: Base signal class
- **Signal classes**: Individual classes for each signal

## Version

${libraryData.version || '1.0.0'}
`;

        await fs.writeFile(docPath, docContent);
    }

    mapVSTypeToPython(vssType) {
        const typeMap = {
            'boolean': 'bool',
            'uint8': 'int',
            'uint16': 'int',
            'uint32': 'int',
            'int8': 'int',
            'int16': 'int',
            'int32': 'int',
            'float': 'float',
            'double': 'float',
            'string': 'str'
        };

        return typeMap[vssType] || 'Any';
    }

    generateValidation(signal) {
        const validations = [];

        if (signal.min !== undefined) {
            validations.push(`        self.min_value = ${signal.min}`);
        }

        if (signal.max !== undefined) {
            validations.push(`        self.max_value = ${signal.max}`);
        }

        return validations.join('\n');
    }

    generateValidationMethod(signal) {
        if (signal.min !== undefined && signal.max !== undefined) {
            return `if not (self.min_value <= value <= self.max_value):
            print(f"Warning: {self.signal_name} value {value} outside range [{self.min_value}, {self.max_value}]")
            return False`;
        } else if (signal.min !== undefined) {
            return `if value < self.min_value:
            print(f"Warning: {self.signal_name} value {value} below minimum {self.min_value}")
            return False`;
        } else if (signal.max !== undefined) {
            return `if value > self.max_value:
            print(f"Warning: {self.signal_name} value {value} above maximum {self.max_value}")
            return False`;
        }

        return '';
    }

    toPascalCase(str) {
        return str.replace(/(?:^|_)([a-z])/g, (_, char) => char.toUpperCase());
    }

    toCamelCase(str) {
        return str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    }
}