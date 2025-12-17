#!/usr/bin/env node

/**
 * Check what apps are currently in the database
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const DB_PATH = './test-data/vehicle-edge.db';

async function checkDatabase() {
    console.log('📊 Checking Vehicle Edge Runtime Database...\n');

    try {
        // Open the database
        const db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });

        console.log('✅ Database opened successfully');

        // Check if applications table exists
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('📋 Tables in database:', tables.map(t => t.name));

        // First, check table structure
        console.log('\n🔍 Checking apps table structure...');
        const columns = await db.all("PRAGMA table_info(apps)");
        console.log('Columns:', columns.map(col => `${col.name} (${col.type})`));

        // Get all applications - using * to see all columns
        console.log('\n📱 Applications in database:');
        console.log('='.repeat(50));

        const apps = await db.all(`
            SELECT * FROM apps
            ORDER BY created_at DESC
        `);

        if (apps.length === 0) {
            console.log('No applications found in database');
        } else {
            apps.forEach((app, index) => {
                console.log(`${index + 1}. ${app.name}`);
                console.log(`   ID: ${app.app_id}`);
                console.log(`   Status: ${app.status}`);
                console.log(`   Type: ${app.type}`);
                console.log(`   Version: ${app.version}`);
                console.log(`   Created: ${app.created_at}`);
                if (app.execution_id) console.log(`   Execution ID: ${app.execution_id}`);
                if (app.container_id) console.log(`   Container ID: ${app.container_id}`);
                if (app.pid) console.log(`   PID: ${app.pid}`);
                if (app.exit_code !== null) console.log(`   Exit Code: ${app.exit_code}`);
                console.log('');
            });
        }

        // Get status summary
        console.log('📈 Status Summary:');
        console.log('='.repeat(30));

        const statusCount = await db.all(`
            SELECT status, COUNT(*) as count
            FROM applications
            GROUP BY status
        `);

        statusCount.forEach(row => {
            console.log(`${row.status}: ${row.count}`);
        });

        // Get recent activity (last 24 hours)
        console.log('\n🕒 Recent Activity (Last 24 hours):');
        console.log('='.repeat(40));

        const recentApps = await db.all(`
            SELECT
                name,
                status,
                created_at,
                execution_id
            FROM applications
            WHERE created_at >= datetime('now', '-1 day')
            ORDER BY created_at DESC
            LIMIT 10
        `);

        if (recentApps.length === 0) {
            console.log('No activity in the last 24 hours');
        } else {
            recentApps.forEach(app => {
                console.log(`${app.created_at} - ${app.name} (${app.status})`);
                if (app.execution_id) console.log(`  Execution: ${app.execution_id}`);
            });
        }

        await db.close();
        console.log('\n✅ Database check completed');

    } catch (error) {
        console.error('❌ Error checking database:', error);
        process.exit(1);
    }
}

// Run the check
checkDatabase().catch(console.error);