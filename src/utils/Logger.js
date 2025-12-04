/**
 * Simple Logger Utility
 * Provides structured logging with different log levels
 */

export class Logger {
    constructor(component, level = 'info') {
        this.component = component;
        this.level = this._getLevelValue(level);
    }

    _getLevelValue(level) {
        const levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        return levels[level] || levels.info;
    }

    _shouldLog(level) {
        return this._getLevelValue(level) <= this.level;
    }

    _formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';

        return `[${timestamp}] [${level.toUpperCase()}] [${this.component}] ${message} ${metaString}`;
    }

    error(message, meta = {}) {
        if (this._shouldLog('error')) {
            console.error(this._formatMessage('error', message, meta));
        }
    }

    warn(message, meta = {}) {
        if (this._shouldLog('warn')) {
            console.warn(this._formatMessage('warn', message, meta));
        }
    }

    info(message, meta = {}) {
        if (this._shouldLog('info')) {
            console.log(this._formatMessage('info', message, meta));
        }
    }

    debug(message, meta = {}) {
        if (this._shouldLog('debug')) {
            console.log(this._formatMessage('debug', message, meta));
        }
    }
}