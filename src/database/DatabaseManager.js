/**
 * Database Manager
 * SQLite persistence for Vehicle Edge Runtime
 */

import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../utils/Logger.js';

export class DatabaseManager {
    constructor(dbPath, options = {}) {
        this.dbPath = dbPath;
        this.logger = new Logger('DatabaseManager', options.logLevel);
        this.db = null;
    }

    async initialize() {
        this.logger.info('Initializing database', { dbPath: this.dbPath });

        try {
            // Ensure database directory exists with proper permissions
            const dbDir = path.dirname(this.dbPath);
            await fs.ensureDir(dbDir);
            
            // In test environments, ensure we have write permissions
            if (process.env.NODE_ENV === 'test') {
                try {
                    await fs.chmod(dbDir, 0o755);
                } catch (error) {
                    this.logger.warn('Could not set directory permissions', { error: error.message });
                }
            }

            // Open database connection with write permissions
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database,
                mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
            });

            // Enable foreign keys
            await this.db.exec('PRAGMA foreign_keys = ON');

            // Create tables
            await this._createTables();

            this.logger.info('Database initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize database', { error: error.message });
            throw error;
        }
    }

    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
            this.logger.info('Database connection closed');
        }
    }

    async _createTables() {
        this.logger.debug('Creating database tables');

        // Applications table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS apps (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT,
                description TEXT,
                type TEXT CHECK (type IN ('python', 'binary', 'docker')) NOT NULL,
                status TEXT DEFAULT 'installed' CHECK (
                    status IN ('installing', 'installed', 'starting', 'running', 'paused', 'stopped', 'uninstalling', 'error')
                ),
                config TEXT, -- JSON config
                code TEXT, -- Application code (for Python apps)
                entry_point TEXT, -- Main file path
                binary_path TEXT, -- Binary path (for binary apps)
                args TEXT, -- JSON array of arguments
                env TEXT, -- JSON object of environment variables
                working_dir TEXT,
                python_deps TEXT, -- JSON array of Python dependencies
                vehicle_signals TEXT, -- JSON array of required vehicle signals
                data_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_start TIMESTAMP,
                total_runtime INTEGER DEFAULT 0
            )
        `);

        // Runtime state table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS app_runtime_state (
                app_id TEXT PRIMARY KEY,
                execution_id TEXT,
                container_id TEXT,
                pid INTEGER,
                current_state TEXT DEFAULT 'stopped' CHECK (
                    current_state IN ('running', 'paused', 'stopped', 'error')
                ),
                resources TEXT, -- JSON object with resource usage
                last_heartbeat TIMESTAMP,
                exit_code INTEGER,
                FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
            )
        `);

        // Application logs table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS app_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_id TEXT NOT NULL,
                execution_id TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                stream TEXT CHECK (stream IN ('stdout', 'stderr', 'status', 'system')),
                content TEXT NOT NULL,
                level TEXT DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
                FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
            )
        `);

        // Dependencies table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS app_dependencies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_id TEXT NOT NULL,
                dependency_type TEXT CHECK (dependency_type IN ('python', 'vehicle_signal')),
                name TEXT NOT NULL,
                version_spec TEXT,
                resolved_version TEXT,
                status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'installed', 'failed')),
                install_log TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
            )
        `);

        // Create indexes for performance
        await this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);
            CREATE INDEX IF NOT EXISTS idx_apps_type ON apps(type);
            CREATE INDEX IF NOT EXISTS idx_app_logs_app_id ON app_logs(app_id);
            CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_app_runtime_state_app_id ON app_runtime_state(app_id);
            CREATE INDEX IF NOT EXISTS idx_app_dependencies_app_id ON app_dependencies(app_id);
        `);

        this.logger.debug('Database tables created successfully');
    }

    // Application management methods
    async createApplication(appData) {
        const {
            id,
            name,
            version,
            description,
            type,
            config = {},
            code,
            entry_point,
            binary_path,
            args = [],
            env = {},
            working_dir,
            python_deps = [],
            vehicle_signals = [],
            data_path
        } = appData;

        const stmt = await this.db.prepare(`
            INSERT INTO apps (
                id, name, version, description, type, config, code, entry_point,
                binary_path, args, env, working_dir, python_deps, vehicle_signals, data_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        await stmt.run(
            id, name, version, description, type,
            JSON.stringify(config),
            code,
            entry_point,
            binary_path,
            JSON.stringify(args),
            JSON.stringify(env),
            working_dir,
            JSON.stringify(python_deps),
            JSON.stringify(vehicle_signals),
            data_path
        );

        this.logger.info('Application created', { appId: id, name, type });
        return await this.getApplication(id);
    }

    async getApplication(appId) {
        const app = await this.db.get('SELECT * FROM apps WHERE id = ?', [appId]);
        if (!app) return null;

        // Parse JSON fields
        app.config = app.config ? JSON.parse(app.config) : {};
        app.args = app.args ? JSON.parse(app.args) : [];
        app.env = app.env ? JSON.parse(app.env) : {};
        app.python_deps = app.python_deps ? JSON.parse(app.python_deps) : [];
        app.vehicle_signals = app.vehicle_signals ? JSON.parse(app.vehicle_signals) : [];

        return app;
    }

    async updateApplication(appId, updates) {
        const allowedFields = [
            'name', 'version', 'description', 'status', 'config',
            'code', 'entry_point', 'binary_path', 'args', 'env',
            'working_dir', 'python_deps', 'vehicle_signals', 'data_path', 'updated_at'
        ];

        const setClause = [];
        const values = [];

        for (const field of allowedFields) {
            if (updates.hasOwnProperty(field)) {
                setClause.push(`${field} = ?`);

                // Convert objects to JSON strings
                if (['config', 'args', 'env', 'python_deps', 'vehicle_signals'].includes(field)) {
                    values.push(JSON.stringify(updates[field]));
                } else {
                    values.push(updates[field]);
                }
            }
        }

        if (setClause.length === 0) return;

        setClause.push('updated_at = CURRENT_TIMESTAMP');
        values.push(appId);

        const stmt = await this.db.prepare(`
            UPDATE apps SET ${setClause.join(', ')} WHERE id = ?
        `);

        await stmt.run(...values);
        this.logger.debug('Application updated', { appId, updates: Object.keys(updates) });
    }

    async deleteApplication(appId) {
        const result = await this.db.run('DELETE FROM apps WHERE id = ?', [appId]);
        this.logger.info('Application deleted', { appId, changes: result.changes });
        return result.changes > 0;
    }

    async listApplications(filters = {}) {
        let query = 'SELECT * FROM apps WHERE 1=1';
        const params = [];

        if (filters.id) {
            query += ' AND id = ?';
            params.push(filters.id);
        }

        if (filters.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }

        if (filters.type) {
            query += ' AND type = ?';
            params.push(filters.type);
        }

        query += ' ORDER BY created_at DESC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }

        const apps = await this.db.all(query, params);

        // Parse JSON fields for each app
        return apps.map(app => ({
            ...app,
            config: app.config ? JSON.parse(app.config) : {},
            args: app.args ? JSON.parse(app.args) : [],
            env: app.env ? JSON.parse(app.env) : {},
            python_deps: app.python_deps ? JSON.parse(app.python_deps) : [],
            vehicle_signals: app.vehicle_signals ? JSON.parse(app.vehicle_signals) : []
        }));
    }

    // Runtime state management
    async updateRuntimeState(appId, stateData) {
        const {
            execution_id,
            container_id,
            pid,
            current_state,
            resources,
            exit_code
        } = stateData;

        const stmt = await this.db.prepare(`
            INSERT OR REPLACE INTO app_runtime_state (
                app_id, execution_id, container_id, pid, current_state,
                resources, last_heartbeat, exit_code
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `);

        await stmt.run(
            appId,
            execution_id,
            container_id,
            pid,
            current_state,
            resources ? JSON.stringify(resources) : null,
            exit_code
        );

        this.logger.debug('Runtime state updated', { appId, current_state });
    }

    async getRuntimeState(appId) {
        const state = await this.db.get('SELECT * FROM app_runtime_state WHERE app_id = ?', [appId]);
        if (!state) return null;

        if (state.resources) {
            state.resources = JSON.parse(state.resources);
        }

        return state;
    }

    async getRuntimeStateByExecutionId(executionId) {
        const state = await this.db.get('SELECT * FROM app_runtime_state WHERE execution_id = ?', [executionId]);
        if (!state) return null;

        if (state.resources) {
            state.resources = JSON.parse(state.resources);
        }

        return state;
    }

    // Logging methods
    async addLog(appId, stream, content, level = 'info', executionId = null) {
        const stmt = await this.db.prepare(`
            INSERT INTO app_logs (app_id, execution_id, stream, content, level)
            VALUES (?, ?, ?, ?, ?)
        `);

        await stmt.run(appId, executionId, stream, content, level);
    }

    async getLogs(appId, options = {}) {
        const {
            stream,
            level,
            limit = 1000,
            offset = 0,
            start_time,
            end_time
        } = options;

        let query = 'SELECT * FROM app_logs WHERE app_id = ?';
        const params = [appId];

        if (stream) {
            query += ' AND stream = ?';
            params.push(stream);
        }

        if (level) {
            query += ' AND level = ?';
            params.push(level);
        }

        if (start_time) {
            query += ' AND timestamp >= ?';
            params.push(start_time);
        }

        if (end_time) {
            query += ' AND timestamp <= ?';
            params.push(end_time);
        }

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return await this.db.all(query, params);
    }

    // Dependency management
    async addDependency(appId, dependencyType, name, versionSpec = null) {
        const stmt = await this.db.prepare(`
            INSERT INTO app_dependencies (app_id, dependency_type, name, version_spec)
            VALUES (?, ?, ?, ?)
        `);

        await stmt.run(appId, dependencyType, name, versionSpec);
        this.logger.debug('Dependency added', { appId, dependencyType, name, versionSpec });
    }

    async updateDependencyStatus(appId, dependencyType, name, status, resolvedVersion = null, installLog = null) {
        const stmt = await this.db.prepare(`
            UPDATE app_dependencies
            SET status = ?, resolved_version = ?, install_log = ?
            WHERE app_id = ? AND dependency_type = ? AND name = ?
        `);

        await stmt.run(status, resolvedVersion, installLog, appId, dependencyType, name);
    }

    async getDependencies(appId, dependencyType = null) {
        let query = 'SELECT * FROM app_dependencies WHERE app_id = ?';
        const params = [appId];

        if (dependencyType) {
            query += ' AND dependency_type = ?';
            params.push(dependencyType);
        }

        query += ' ORDER BY created_at ASC';

        return await this.db.all(query, params);
    }

    // Utility methods
    async getAppStats() {
        const stats = await this.db.get(`
            SELECT
                COUNT(*) as total_apps,
                COUNT(CASE WHEN status = 'running' THEN 1 END) as running_apps,
                COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_apps,
                COUNT(CASE WHEN status = 'installed' THEN 1 END) as installed_apps,
                COUNT(CASE WHEN status = 'error' THEN 1 END) as error_apps,
                COUNT(CASE WHEN type = 'python' THEN 1 END) as python_apps,
                COUNT(CASE WHEN type = 'binary' THEN 1 END) as binary_apps
            FROM apps
        `);

        return stats;
    }

    async cleanupOldLogs(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await this.db.run(
            'DELETE FROM app_logs WHERE timestamp < ?',
            [cutoffDate.toISOString()]
        );

        this.logger.info('Old logs cleaned up', { deleted: result.changes, daysToKeep });
        return result.changes;
    }

    async backup(backupPath) {
        this.logger.info('Creating database backup', { backupPath });

        // For SQLite, we can simply copy the database file
        await fs.copy(this.dbPath, backupPath);

        this.logger.info('Database backup created', { backupPath });
    }

    async restore(backupPath) {
        this.logger.info('Restoring database from backup', { backupPath });

        await this.close();
        await fs.copy(backupPath, this.dbPath);
        await this.initialize();

        this.logger.info('Database restored from backup', { backupPath });
    }
}