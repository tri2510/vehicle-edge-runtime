#!/usr/bin/env node
/**
 * Cleanup Database Script
 * Removes problematic apps from the database
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data/vehicle-edge.db');

console.log('Opening database:', dbPath);
const db = new Database(dbPath);

// List all apps
console.log('\n=== Current Apps in Database ===');
const apps = db.prepare('SELECT id, name, type, status FROM apps').all();
apps.forEach(app => {
    console.log(`- ${app.id} (${app.name}): type=${app.type}, status=${app.status}`);
});

// Find problematic apps (error status or orphaned)
console.log('\n=== Checking for Problematic Apps ===');
const problemApps = db.prepare(`
    SELECT a.id, a.name, a.status, r.container_id
    FROM apps a
    LEFT JOIN app_runtime_states r ON a.id = r.app_id
    WHERE a.status = 'error' OR r.container_id IS NULL
`).all();

if (problemApps.length === 0) {
    console.log('No problematic apps found');
} else {
    console.log('Found problematic apps:');
    problemApps.forEach(app => {
        console.log(`- ${app.id} (${app.name}): status=${app.status}`);
    });

    // Ask for confirmation
    console.log('\nWould you like to remove these apps? (yes/no)');
    console.log('Or specify specific app IDs to remove (comma-separated)');
    console.log('Example: vea-your-vehicle-app_2,another-app-id');
    process.exit(0);
}

// If specific app IDs provided as arguments
if (process.argv.length > 2) {
    const appsToRemove = process.argv.slice(2);
    console.log('\n=== Removing Specified Apps ===');

    appsToRemove.forEach(appId => {
        try {
            // Delete runtime state first (foreign key dependency)
            db.prepare('DELETE FROM app_runtime_states WHERE app_id = ?').run(appId);
            console.log(`✓ Deleted runtime state for ${appId}`);

            // Delete logs
            db.prepare('DELETE FROM app_logs WHERE app_id = ?').run(appId);
            console.log(`✓ Deleted logs for ${appId}`);

            // Delete dependencies
            db.prepare('DELETE FROM app_dependencies WHERE app_id = ?').run(appId);
            console.log(`✓ Deleted dependencies for ${appId}`);

            // Delete the app
            const result = db.prepare('DELETE FROM apps WHERE id = ?').run(appId);
            if (result.changes > 0) {
                console.log(`✓ Deleted app ${appId}`);
            } else {
                console.log(`✗ App ${appId} not found`);
            }
        } catch (error) {
            console.error(`✗ Error deleting ${appId}:`, error.message);
        }
    });

    console.log('\n=== Remaining Apps ===');
    const remainingApps = db.prepare('SELECT id, name, type, status FROM apps').all();
    remainingApps.forEach(app => {
        console.log(`- ${app.id} (${app.name}): type=${app.type}, status=${app.status}`);
    });
}

db.close();
console.log('\nDatabase cleanup complete');
