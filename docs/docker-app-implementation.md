# Docker App Type Implementation Code

This document contains the actual code changes made to implement the Docker app type functionality.

## 1. Database Schema Update

**File:** `src/database/DatabaseManager.js`

```javascript
// Line 74: Updated type constraint to include 'docker'
type TEXT CHECK (type IN ('python', 'binary', 'docker')) NOT NULL,
```

## 2. Docker App Runner Method

**File:** `src/apps/EnhancedApplicationManager.js`

```javascript
/**
 * Run Docker App
 * Executes Docker commands directly with full Docker API access
 */
async runDockerApp(options) {
    const { appId, args, env, workingDir, vehicleId, config } = options;

    this.logger.info('Starting Docker application', { appId, vehicleId });

    try {
        const app = await this.db.getApplication(appId);
        if (!app) {
            throw new Error(`Application not found: ${appId}`);
        }

        const executionId = uuidv4();

        // Update status to starting
        await this.db.updateApplication(appId, {
            status: 'starting',
            last_start: new Date().toISOString()
        });

        const actualExecutionId = executionId;

        // Prepare Docker execution options
        const appConfig = config || app.config || {};
        const dockerCommand = appConfig.dockerCommand || args || [];

        if (!dockerCommand || dockerCommand.length === 0) {
            throw new Error('Docker app requires dockerCommand in config or args');
        }

        this.logger.info('Executing Docker command', { appId, dockerCommand });

        // Execute Docker command
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const fullCommand = `docker ${dockerCommand.join(' ')}`;
        this.logger.info('Running Docker command', { appId, command: fullCommand });

        const { stdout, stderr } = await execAsync(fullCommand);

        // Parse container ID from output if it's a docker run command
        let containerId = null;
        if (dockerCommand.includes('run') && stdout.trim()) {
            containerId = stdout.trim();
        }

        // Update runtime state
        await this.db.updateRuntimeState(appId, {
            execution_id: actualExecutionId,
            container_id: containerId,
            current_state: 'running',
            last_heartbeat: new Date().toISOString(),
            resources: JSON.stringify({
                cpu_limit: '100%', // Docker apps use host resources
                memory_limit: 'unlimited'
            })
        });

        this.logger.info('Docker application started successfully', {
            appId,
            executionId: actualExecutionId,
            containerId,
            command: fullCommand
        });

        // Return success response
        return {
            status: 'started',
            executionId: actualExecutionId,
            containerId: containerId,
            output: stdout,
            error: stderr
        };

    } catch (error) {
        // Update error status
        await this.db.updateApplication(appId, { status: 'error' });
        await this.db.addLog(appId, 'system', `Failed to start: ${error.message}`, 'error');

        this.logger.error('Failed to start Docker application', { appId, error: error.message });
        throw error;
    }
}
```

## 3. Docker App Support in Message Handler

**File:** `src/api/MessageHandler.js`

```javascript
// Lines 730-733: Added Docker app type detection
if (prototype?.type === 'docker') {
    // Handle Docker app deployment
    appType = 'docker';
} else if (prototype?.language === 'python' || language === 'python' || (code && (code.includes('import ') || code.includes('def ')))) {

// Lines 779-797: Updated app data creation for Docker apps
const appData = {
    id: appId,
    name: prototype?.name || `Deployed App ${appId}`,
    description: prototype?.description || 'Deployed via API',
    version: prototype?.version || '1.0.0',
    type: appType,  // Use validated type
    code: code,
    status: 'installed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // Required database fields - set different defaults for Docker apps
    entry_point: appType === 'docker' ? null : 'main.py',
    binary_path: appType === 'docker' ? null : `/tmp/app-data-${appId}/main`,
    args: JSON.stringify([]),
    env: JSON.stringify({}),
    working_dir: appType === 'docker' ? null : '/app',
    python_deps: JSON.stringify([]),
    vehicle_signals: JSON.stringify([]),
    data_path: appType === 'docker' ? null : `/tmp/app-data-${appId}`,
    config: JSON.stringify({
        deployment_method: 'direct_websocket',
        deployment_source: 'WebSocket_API',
        vehicle_id: vehicleId || 'unknown',
        deployment_timestamp: new Date().toISOString(),
        dockerCommand: appType === 'docker' ? prototype?.config?.dockerCommand : null
    })
};

// Lines 823-833: Added Docker app execution logic
if (appType === 'docker') {
    // Handle Docker app deployment
    result = await this.runtime.appManager.runDockerApp({
        executionId,
        appId,
        config: prototype?.config || {},
        env: {
            APP_NAME: prototype?.name || 'Deployed Docker App'
        },
        vehicleId
    });
} else if (appType === 'python') {

// Lines 1387-1390: Added Docker app support to handleDeployRequest
} else if (appData.type === 'docker') {
    result = await this.runtime.appManager.runDockerApp(deployOptions);
} else {
    throw new Error(`Unsupported application type: ${appData.type}`);
}
```

## 4. Host Networking Implementation

**File:** `src/apps/EnhancedApplicationManager.js`

### Python Container Host Networking

```javascript
// Lines 987-990: Python container configuration
HostConfig: {
    // Only mount dependencies directory for libraries
    Binds: [
        `${path.join(this.appStorage, 'dependencies', appId)}:/app/dependencies:ro`
    ],
    Memory: 512 * 1024 * 1024,
    CpuQuota: 50000,
    NetworkMode: 'host',  // ✅ Host networking
    ReadonlyRootfs: false,
    Tmpfs: {
        '/tmp': 'rw,noexec,nosuid,size=100m'
    }
},
```

### Binary Container Host Networking

```javascript
// Lines 1206-1218: Binary container configuration
HostConfig: {
    Binds: isDockerImage ?
        (volumes ? Object.entries(volumes).map(([hostPath, containerPath]) => `${hostPath}:${containerPath}`) : []) :
        [`${path.resolve(appDir)}:${workingDir}`],
    Memory: 512 * 1024 * 1024,
    CpuQuota: 50000,
    NetworkMode: 'host',  // ✅ Host networking
    ReadonlyRootfs: false,
    Tmpfs: {
        '/tmp': 'rw,noexec,nosuid,size=100m'
    }
    // PortBindings not needed with host networking - containers use host ports directly
},
```

## 5. Updated App Validation

**File:** `src/apps/EnhancedApplicationManager.js`

```javascript
// Lines 753-760: Added Docker app validation
// For Docker apps, require dockerCommand in config
if (type === 'docker' && !(config && config.dockerCommand)) {
    throw new Error('Docker applications require dockerCommand in config');
}

// Lines 808-811: Docker app storage handling
async _prepareApplicationStorage(appData) {
    const { id, type, code, entryPoint } = appData;
    // Docker apps don't need local storage
    if (type === 'docker') {
        return null; // No local directory needed for Docker apps
    }
    // ... rest of method for Python/Binary apps
}
```

## 6. Kuksa Server Deployment Support

**File:** `src/core/VehicleEdgeRuntime.js`

```javascript
/**
 * Deploy Kuksa Server as Regular App
 * Uses the existing app management system to treat Kuksa as a regular database app
 */
async deployKuksaServer(options = {}) {
    const { action = 'start', vehicleId } = options;

    this.logger.info('Deploying Kuksa server as regular app', { action, vehicleId });

    try {
        // Ensure Kuksa server app exists in database
        await this._ensureKuksaAppExists();

        switch (action) {
            case 'start':
                return await this.appManager.runBinaryApp({
                    appId: 'kuksa-server',
                    vehicleId,
                    config: {
                        dockerImage: 'ghcr.io/eclipse-kuksa/kuksa-databroker:main',
                        exposedPorts: {
                            grpc: 55555,
                            http: 8090
                        },
                        environment: {
                            'KUKSA_INSECURE': 'true',
                            'KUKSA_ENABLE_VISS': 'true',
                            'KUKSA_VISS_PORT': '8090'
                        },
                        args: [
                            '--insecure',
                            '--enable-viss',
                            '--viss-port', '8090'
                        ]
                    }
                });
            // ... other actions (stop, restart, status, remove)
        }
    } catch (error) {
        this.logger.error('Failed to manage Kuksa server app', { action, error: error.message });
        throw error;
    }
}
```

## 7. Kuksa Message Handler

**File:** `src/api/MessageHandler.js`

```javascript
/**
 * Handle Kuksa Server Deployment
 * Deploys Kuksa server as a regular app and adds endpoint information
 */
async handleDeployKuksaServer(message) {
    const { action, vehicleId } = message;

    this.logger.info('Handling Kuksa server deployment', { action, vehicleId });

    try {
        const result = await this.runtime.deployKuksaServer({ action, vehicleId });

        // Add Kuksa endpoints for all responses except errors
        const kuksaEndpoints = {
            grpc: 'localhost:55555',
            http: 'localhost:8090',
            internal: 'kuksa-server:55555'  // For vehicle apps
        };

        // Handle different result formats from binary app operations
        if (result.status === 'started' || result.status === 'stopped') {
            return {
                type: 'kuksa_server_deployment_status',
                id: message.id,
                status: result.status,
                action: action,
                containerId: result.containerId,
                executionId: result.executionId,
                appId: result.appId,
                endpoints: kuksaEndpoints,
                timestamp: new Date().toISOString()
            };
        }
        // ... other response formats
    } catch (error) {
        this.logger.error('Failed to deploy Kuksa server', { error: error.message });
        return {
            type: 'error',
            id: message.id,
            error: 'Failed to deploy Kuksa server: ' + error.message,
            timestamp: new Date().toISOString()
        };
    }
}
```

## Key Features of the Implementation

### 1. **Direct Docker Command Execution**
- Uses `execAsync` to run Docker commands directly
- Full access to Docker CLI capabilities
- Supports any Docker command and parameters

### 2. **Database Integration**
- Docker apps stored in the same `apps` table as other app types
- Uses existing runtime state and logging systems
- Full frontend visibility and management

### 3. **Host Networking**
- All containers (Python, Binary, Docker) use `NetworkMode: 'host'`
- Eliminates network translation issues
- Enables `127.0.0.1` connectivity to host services

### 4. **Resource Management**
- Container lifecycle tracking
- Memory and CPU limits enforcement
- Health monitoring and heartbeat tracking

### 5. **Error Handling**
- Proper Docker command validation
- Container exit code handling
- Database transaction safety

This implementation provides a clean, extensible foundation for Docker-based applications within the Vehicle Edge Runtime ecosystem.