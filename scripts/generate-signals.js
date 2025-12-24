#!/usr/bin/env node
/**
 * Generate signals.json for mock service
 * Converts JavaScript object to JSON format expected by mock service
 */

const fs = require('fs');
const path = require('path');

const SIGNALS_FILE = path.join(__dirname, 'services/mock-service/signals.json');

/**
 * Convert mock signals object to JSON format
 * @param {Object} mockSignals - Object with signal paths and values
 * @returns {Array} Array of signal objects
 */
function convertToSignalsArray(mockSignals) {
    return Object.entries(mockSignals).map(([signalPath, value]) => ({
        signal: signalPath,
        value: String(value)  // Ensure value is string
    }));
}

/**
 * Generate signals.json file
 * @param {Object} customSignals - Custom signals object
 * @param {boolean} mergeWithDefaults - Merge with default signals
 */
function generateSignalsJson(customSignals = {}, mergeWithDefaults = true) {
    let signals = [];

    // Default signals
    const defaultSignals = [
        { signal: "Vehicle.Speed", value: "0" },
        { signal: "Vehicle.Body.Hood.IsOpen", value: "false" },
        { signal: "Vehicle.Cabin.HVAC.Station.Row1.Left.FanSpeed", value: "0" },
        { signal: "Vehicle.ADAS.CruiseControl.SpeedSet", value: "0" },
        { signal: "Vehicle.Cabin.Door.Row1.Left.IsOpen", value: "false" },
        { signal: "Vehicle.Cabin.Door.Row1.Right.IsOpen", value: "false" },
        { signal: "Vehicle.Body.Lights.Beam.High.IsOn", value: "false" },
        { signal: "Vehicle.Body.Trunk.Rear.IsOpen", value: "false" },
        { signal: "Vehicle.Cabin.Seat.Row1.Pos1.Position", value: "0" }
    ];

    if (mergeWithDefaults) {
        // Start with defaults
        signals = [...defaultSignals];

        // Add/override with custom signals
        const customArray = convertToSignalsArray(customSignals);

        // Remove default signals that are being overridden
        const customPaths = customArray.map(s => s.signal);
        signals = signals.filter(s => !customPaths.includes(s.signal));

        // Add custom signals
        signals = [...signals, ...customArray];
    } else {
        // Use only custom signals
        signals = convertToSignalsArray(customSignals);
    }

    // Write to file
    fs.writeFileSync(
        SIGNALS_FILE,
        JSON.stringify(signals, null, 2),
        'utf8'
    );

    console.log(`✅ Generated signals.json with ${signals.length} signals`);
    return signals;
}

/**
 * Main function - run from command line
 */
function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node generate-signals.js <json-string>');
        console.log('');
        console.log('Example:');
        console.log('  node generate-signals.js \'{"Vehicle.Speed": 100, "Vehicle.Body.Lights.Beam.High.IsOn": true}\'');
        console.log('');
        console.log('Output: services/mock-service/signals.json');
        process.exit(0);
    }

    try {
        // Parse JSON input
        const customSignals = JSON.parse(args[0]);

        // Generate signals.json
        const signals = generateSignalsJson(customSignals, true);

        console.log('\nGenerated signals:');
        signals.forEach(s => {
            console.log(`  ${s.signal} = ${s.value}`);
        });

        console.log('\n✅ Ready to deploy!');
        console.log('Run: docker-compose --profile local-kuksa --profile mock up -d');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Please provide valid JSON string');
        process.exit(1);
    }
}

// Export for use as module
module.exports = {
    generateSignalsJson,
    convertToSignalsArray
};

// Run if called directly
if (require.main === module) {
    main();
}
