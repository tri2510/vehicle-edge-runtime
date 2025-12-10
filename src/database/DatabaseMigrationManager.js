/**
 * Database Migration Manager
 * Handles database schema migrations and backup operations
 */

import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../utils/Logger.js';
import { DatabaseManager } from './DatabaseManager.js';

export class DatabaseMigrationManager {
    constructor(dbPath, options = {}) {
        this.dbPath = dbPath;
        this.logger = new Logger('DatabaseMigrationManager', options.logLevel);
        this.migrationsDir = path.join(path.dirname(dbPath), 'migrations');
        this.backupDir = path.join(path.dirname(dbPath), 'backups');
        this.currentVersion = 1; // Starting version
    }

    async initialize() {
        this.logger.info('Initializing Database Migration Manager');

        // Ensure directories exist
        await fs.ensureDir(this.migrationsDir);
        await fs.ensureDir(this.backupDir);

        // Initialize database for migration tracking
        const tempDb = new DatabaseManager(this.dbPath, { logLevel: this.logger.level });
        await tempDb.initialize();

        // Create migrations table if it doesn't exist
        await tempDb.db.exec(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                description TEXT
            )
        `);

        // Get current migration version
        const result = await tempDb.db.get(
            'SELECT MAX(version) as version FROM schema_migrations'
        );
        this.currentVersion = result.version || 0;

        await tempDb.close();
        this.logger.info('Database Migration Manager initialized', { currentVersion: this.currentVersion });
    }

    async migrate() {
        this.logger.info('Starting database migration', { from: this.currentVersion });

        const availableMigrations = await this.getAvailableMigrations();
        const pendingMigrations = availableMigrations.filter(m => m.version > this.currentVersion);

        if (pendingMigrations.length === 0) {
            this.logger.info('No pending migrations');
            return { success: true, currentVersion: this.currentVersion, appliedMigrations: 0 };
        }

        const tempDb = new DatabaseManager(this.dbPath, { logLevel: this.logger.level });
        await tempDb.initialize();

        try {
            let appliedCount = 0;

            for (const migration of pendingMigrations) {
                this.logger.info('Applying migration', { version: migration.version, description: migration.description });

                // Start transaction
                await tempDb.db.exec('BEGIN TRANSACTION');

                try {
                    // Apply migration
                    await this.applyMigration(tempDb, migration);

                    // Record migration
                    await tempDb.db.run(
                        'INSERT INTO schema_migrations (version, description) VALUES (?, ?)',
                        [migration.version, migration.description]
                    );

                    // Commit transaction
                    await tempDb.db.exec('COMMIT');

                    this.logger.info('Migration applied successfully', { version: migration.version });
                    appliedCount++;
                    this.currentVersion = migration.version;

                } catch (error) {
                    // Rollback on error
                    await tempDb.db.exec('ROLLBACK');
                    throw new Error(`Migration ${migration.version} failed: ${error.message}`);
                }
            }

            await tempDb.close();

            this.logger.info('Database migration completed', {
                from: this.currentVersion - appliedCount,
                to: this.currentVersion,
                applied: appliedCount
            });

            return {
                success: true,
                from: this.currentVersion - appliedCount,
                to: this.currentVersion,
                appliedMigrations: appliedCount
            };

        } catch (error) {
            await tempDb.close();
            this.logger.error('Database migration failed', { error: error.message });
            throw error;
        }
    }

    async backup(description = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `backup-${timestamp}.db`;
        const backupPath = path.join(this.backupDir, backupName);

        this.logger.info('Creating database backup', { backupPath, description });

        try {
            const tempDb = new DatabaseManager(this.dbPath, { logLevel: this.logger.level });
            await tempDb.initialize();

            // Create backup
            await tempDb.backup(backupPath);

            // Create backup metadata
            const metadata = {
                timestamp: new Date().toISOString(),
                version: this.currentVersion,
                description: description || `Automatic backup at ${new Date().toISOString()}`,
                originalSize: (await fs.stat(this.dbPath)).size,
                backupSize: (await fs.stat(backupPath)).size
            };

            const metadataPath = path.join(this.backupDir, `backup-${timestamp}.json`);
            await fs.writeJson(metadataPath, metadata, { spaces: 2 });

            await tempDb.close();

            this.logger.info('Database backup created successfully', {
                backupPath,
                size: metadata.backupSize
            });

            return {
                success: true,
                backupPath,
                metadata
            };

        } catch (error) {
            this.logger.error('Database backup failed', { error: error.message });
            throw error;
        }
    }

    async restore(backupPath) {
        this.logger.info('Restoring database from backup', { backupPath });

        if (!await fs.pathExists(backupPath)) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }

        try {
            // Create backup of current database before restore
            await this.backup('Pre-restore backup');

            const tempDb = new DatabaseManager(this.dbPath, { logLevel: this.logger.level });

            // Restore from backup
            await tempDb.restore(backupPath);

            // Update current version from restored database
            await this.initialize();

            this.logger.info('Database restored successfully', { backupPath });

            return {
                success: true,
                backupPath,
                currentVersion: this.currentVersion
            };

        } catch (error) {
            this.logger.error('Database restore failed', { error: error.message });
            throw error;
        }
    }

    async getBackupList() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles = [];

            for (const file of files) {
                if (file.endsWith('.db') && file.startsWith('backup-')) {
                    const backupPath = path.join(this.backupDir, file);
                    const metadataPath = backupPath.replace('.db', '.json');

                    let metadata = null;
                    if (await fs.pathExists(metadataPath)) {
                        metadata = await fs.readJson(metadataPath);
                    }

                    const stats = await fs.stat(backupPath);

                    backupFiles.push({
                        filename: file,
                        path: backupPath,
                        size: stats.size,
                        created: stats.birthtime.toISOString(),
                        metadata
                    });
                }
            }

            // Sort by creation time (newest first)
            backupFiles.sort((a, b) => new Date(b.created) - new Date(a.created));

            return backupFiles;

        } catch (error) {
            this.logger.error('Failed to get backup list', { error: error.message });
            return [];
        }
    }

    async cleanupOldBackups(daysToKeep = 30) {
        this.logger.info('Cleaning up old backups', { daysToKeep });

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const backupFiles = await this.getBackupList();
            let deletedCount = 0;

            for (const backup of backupFiles) {
                const backupDate = new Date(backup.created);
                if (backupDate < cutoffDate) {
                    await fs.remove(backup.path);

                    const metadataPath = backup.path.replace('.db', '.json');
                    if (await fs.pathExists(metadataPath)) {
                        await fs.remove(metadataPath);
                    }

                    deletedCount++;
                    this.logger.debug('Deleted old backup', { filename: backup.filename });
                }
            }

            this.logger.info('Old backups cleaned up', { deleted: deletedCount, daysToKeep });
            return deletedCount;

        } catch (error) {
            this.logger.error('Failed to cleanup old backups', { error: error.message });
            throw error;
        }
    }

    async getAvailableMigrations() {
        const migrations = [
            {
                version: 1,
                description: 'Initial database schema',
                up: `
                    -- Initial schema is created by DatabaseManager.initialize()
                    -- This is a placeholder for future migrations
                `
            }
        ];

        // Future migrations can be added here
        // For example:
        // {
        //     version: 2,
        //     description: 'Add user authentication tables',
        //     up: `
        //         CREATE TABLE users (
        //             id INTEGER PRIMARY KEY,
        //             username TEXT UNIQUE NOT NULL,
        //             email TEXT UNIQUE NOT NULL,
        //             created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        //         );
        //     `
        // }

        return migrations;
    }

    async applyMigration(db, migration) {
        if (migration.up) {
            await db.db.exec(migration.up);
        }
    }

    async getMigrationStatus() {
        try {
            const tempDb = new DatabaseManager(this.dbPath, { logLevel: this.logger.level });
            await tempDb.initialize();

            const result = await tempDb.db.get(
                'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1'
            );

            await tempDb.close();

            return {
                currentVersion: result ? result.version : 0,
                isUpToDate: this.currentVersion >= this.getLatestVersion()
            };

        } catch (error) {
            this.logger.error('Failed to get migration status', { error: error.message });
            return { currentVersion: 0, isUpToDate: false };
        }
    }

    getLatestVersion() {
        const migrations = this.getAvailableMigrations();
        return Math.max(...migrations.map(m => m.version), 0);
    }
}