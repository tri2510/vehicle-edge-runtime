
-- Mock SQLite database schema for testing
CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    log_output TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES applications (id)
);

CREATE TABLE IF NOT EXISTS runtime_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL,
    metric_value TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert some test data
INSERT OR IGNORE INTO applications (id, name, code, language, status) VALUES
('test-app-1', 'Test Application 1', 'print("Hello World")', 'python', 'completed'),
('test-app-2', 'Test Application 2', 'print("Another test")', 'python', 'running');

INSERT OR IGNORE INTO runtime_metrics (metric_type, metric_value) VALUES
('active_connections', '1'),
('total_deployments', '2'),
('uptime_seconds', '3600');
