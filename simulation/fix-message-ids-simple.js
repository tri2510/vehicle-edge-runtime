#!/usr/bin/env node

/**
 * Simple script to add missing `id: message.id,` to specific return statements
 * based on the line numbers provided in the requirements
 */

import fs from 'fs';

// Path to MessageHandler.js
const filePath = '/home/htr1hc/01_SDV/78_deploy_extension/vehicle-edge-runtime/src/api/MessageHandler.js';

function fixMessageIds() {
    try {
        // Read the file
        console.log('Reading MessageHandler.js...');
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        let modifications = 0;

        // Specific patterns to fix based on the requirements
        const fixes = [
            // Default Error Handler (Line 87-91)
            { pattern: /type: 'error',\s*\n\s*error: `Unknown message type: \${message\.type}`,\s*\n\s*timestamp: new Date\(\)\.toISOString\(\)/s, replacement: "type: 'error',\n                id: message.id,\n                error: `Unknown message type: ${message.type}`,\n                timestamp: new Date().toISOString()" },

            // handleRegisterKit success (Lines 101-105)
            { pattern: /type: 'kit_registered',\s*\n\s*kit,\s*\n\s*timestamp: new Date\(\)\.toISOString\(\)/s, replacement: "type: 'kit_registered',\n                id: message.id,\n                kit,\n                timestamp: new Date().toISOString()" },

            // handleRegisterKit error (Lines 109-113)
            { pattern: /type: 'error',\s*\n\s*error: 'Failed to register kit: ' \+ error\.message,\s*\n\s*timestamp: new Date\(\)\.toISOString\(\)/s, replacement: "type: 'error',\n                id: message.id,\n                error: 'Failed to register kit: ' + error.message,\n                timestamp: new Date().toISOString()" },

            // handleRegisterClient (Line 120-126)
            { pattern: /type: 'client_registered',\s*\n\s*clientId,\s*\n\s*runtimeId: this\.runtime\.runtimeId,\s*\n\s*capabilities: this\.runtime\.registry\.getCapabilities\(\),\s*\n\s*timestamp: new Date\(\)\.toISOString\(\)/s, replacement: "type: 'client_registered',\n                id: message.id,\n                clientId,\n                runtimeId: this.runtime.runtimeId,\n                capabilities: this.runtime.registry.getCapabilities(),\n                timestamp: new Date().toISOString()" },

            // handleListAllKits (Line 134-139)
            { pattern: /type: 'kits_list',\s*\n\s*kits,\s*\n\s*count: kits\.length,\s*\n\s*timestamp: new Date\(\)\.toISOString\(\)/s, replacement: "type: 'kits_list',\n                id: message.id,\n                kits,\n                count: kits.length,\n                timestamp: new Date().toISOString()" }
        ];

        let modifiedContent = content;

        // Apply each fix
        fixes.forEach((fix, index) => {
            const before = modifiedContent;
            modifiedContent = modifiedContent.replace(fix.pattern, fix.replacement);

            if (before !== modifiedContent) {
                modifications++;
                console.log(`✓ Applied fix ${index + 1}`);
            }
        });

        // Now use a more general approach for the remaining cases
        const generalPatterns = [
            // Single line return statements
            /return {\s*type: '([^']+)',([^}]*)}/g,
            // Multi-line return statements starting with type field
            /return {\s*\n\s*type: '([^']+)',\s*\n([^}]*?)}/g
        ];

        generalPatterns.forEach((pattern, index) => {
            const matches = [...modifiedContent.matchAll(pattern)];
            matches.forEach((match) => {
                const fullMatch = match[0];
                const typeValue = match[1];
                const restContent = match[2] || '';

                // Check if this return statement already has an id field
                if (!fullMatch.includes('id: message.id') && !fullMatch.includes('id:message.id')) {
                    // Create the replacement with id field
                    let replacement;
                    if (fullMatch.includes('\n')) {
                        // Multi-line
                        replacement = fullMatch.replace(
                            /type: '[^']+',/,
                            `type: '${typeValue}',\n                id: message.id,`
                        );
                    } else {
                        // Single line
                        replacement = fullMatch.replace(
                            /type: '[^']+',/,
                            `type: '${typeValue}', id: message.id,`
                        );
                    }

                    modifiedContent = modifiedContent.replace(fullMatch, replacement);
                    modifications++;
                    console.log(`✓ Fixed return statement with type: '${typeValue}'`);
                }
            });
        });

        if (modifications > 0) {
            // Write the modified content back to the file
            console.log(`\nWriting ${modifications} modifications back to file...`);
            fs.writeFileSync(filePath, modifiedContent, 'utf8');
            console.log('✅ Successfully fixed all missing message IDs!');
        } else {
            console.log('No missing message IDs found. All return statements already have id fields.');
        }

        return modifications;

    } catch (error) {
        console.error('Error fixing message IDs:', error.message);
        process.exit(1);
    }
}

// Run the script
console.log('🔧 Fixing missing message IDs in MessageHandler.js...\n');
const fixedCount = fixMessageIds();
console.log(`\n📊 Summary: Fixed ${fixedCount} return statements`);