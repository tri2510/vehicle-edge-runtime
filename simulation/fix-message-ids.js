#!/usr/bin/env node

/**
 * Script to automatically add missing `id: message.id,` to return statements
 * in MessageHandler.js that have `type: 'some_type'` but are missing message ID passthrough
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

        // Process the file line by line to find return statements
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Look for return statements that contain 'type:' but not 'id: message.id'
            if (line.startsWith('return') && line.includes('type:') && !line.includes('id: message.id')) {
                // Find multi-line return statements
                let braceCount = 0;
                let returnStart = i;
                let returnEnd = i;
                let foundOpeningBrace = false;

                // Scan forward to find the complete return statement
                for (let j = i; j < lines.length; j++) {
                    const currentLine = lines[j];

                    // Count braces to find the complete object
                    for (const char of currentLine) {
                        if (char === '{') {
                            braceCount++;
                            foundOpeningBrace = true;
                        }
                        if (char === '}') {
                            braceCount--;
                        }
                    }

                    if (foundOpeningBrace && braceCount === 0) {
                        returnEnd = j;
                        break;
                    }
                }

                if (foundOpeningBrace && braceCount === 0) {
                    // Extract the complete return statement
                    const returnStatement = lines.slice(returnStart, returnEnd + 1).join('\n');

                    // Check if it has type but no id: message.id
                    if (returnStatement.includes('type:') && !returnStatement.includes('id: message.id') && !returnStatement.includes('id:message.id')) {
                        console.log(`Found return statement missing ID at lines ${returnStart + 1}-${returnEnd + 1}`);

                        // Find the first type field and add id field after it
                        const modifiedLines = [...lines.slice(returnStart, returnEnd + 1)];

                        for (let k = 0; k < modifiedLines.length; k++) {
                            const modifiedLine = modifiedLines[k];

                            // Look for line containing type: field
                            if (modifiedLine.includes('type:') && modifiedLine.includes("'")) {
                                // Check if this line already has an id field
                                if (!modifiedLine.includes('id:')) {
                                    // Find the position after type field
                                    const typeMatch = modifiedLine.match(/(type:\s*['"][^'"]*['"]\s*)(,?)/);

                                    if (typeMatch) {
                                        const beforeType = modifiedLine.substring(0, typeMatch.index + typeMatch[1].length);
                                        const hasComma = typeMatch[2] === ',';
                                        const afterType = modifiedLine.substring(typeMatch.index + typeMatch[0].length);

                                        // Add id field
                                        const idField = hasComma ?
                                            '\n                id: message.id,' :
                                            ',\n                id: message.id,';

                                        modifiedLines[k] = beforeType + idField + afterType;

                                        // Update the original lines array
                                        for (let m = returnStart; m <= returnEnd; m++) {
                                            lines[m] = modifiedLines[m - returnStart];
                                        }

                                        modifications++;
                                        console.log(`  ✓ Added id field after type field`);
                                        break; // Only add id once per return statement
                                    }
                                }
                            }
                        }

                        // Skip to the end of this return statement
                        i = returnEnd;
                    }
                }
            }
        }

        if (modifications > 0) {
            // Write the modified content back to the file
            console.log(`\nWriting ${modifications} modifications back to file...`);
            const modifiedContent = lines.join('\n');
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