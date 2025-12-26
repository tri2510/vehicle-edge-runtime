# Frontend Lifecycle Management Integration Guide

## Overview

This guide explains how to make the frontend stay in sync with the vehicle app lifecycle management API after the bug fixes.

---

## Key API Changes

### 1. App ID Handling

**Before (Broken):**
```javascript
// This would fail - app ID without VEA- prefix
getAppStatus('diagnostic-123') // ❌ Error: Application not found
```

**After (Fixed):**
```javascript
// Both now work correctly
getAppStatus('diagnostic-123')        // ✅ Works - auto-resolves to VEA-diagnostic-123
getAppStatus('VEA-diagnostic-123')    // ✅ Works - direct match
```

### 2. Error Response Format

**Before (Broken):**
```javascript
// Non-existent app returned success
manageApp('non-existent', 'start')
// Response: { type: 'manage_app-response', ... }  // ❌ Missing status field
```

**After (Fixed):**
```javascript
// Non-existent app now returns error
manageApp('non-existent', 'start')
// Response: { type: 'error', error: 'Application not found: non-existent', ... }
```

### 3. Enhanced Response Format

**Before:**
```javascript
{
  type: 'manage_app-response',
  app_id: 'VEA-app-123',
  action: 'start',
  timestamp: '...'
  // ❌ Missing: status, result, state
}
```

**After:**
```javascript
{
  type: 'manage_app-response',
  app_id: 'VEA-app-123',
  action: 'start',
  status: 'success',           // ✅ New field
  result: 'Application started successfully',  // ✅ New field
  state: 'running',            // ✅ New field
  timestamp: '...'
}
```

---

## Frontend Implementation Patterns

### Pattern 1: WebSocket Client Setup

```javascript
class LifecycleClient {
  constructor(wsUrl = 'ws://localhost:3002/runtime') {
    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('✅ Connected to runtime');
        resolve();
      });

      this.ws.on('message', (data) => {
        const response = JSON.parse(data);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          pending(response);
          this.pendingRequests.delete(response.id);
        }
      });

      this.ws.on('error', (err) => {
        console.error('❌ WebSocket error:', err);
        reject(err);
      });
    });
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      const id = message.id || `msg-${this.messageId++}`;
      message.id = id;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} timed out`));
      }, 30000);

      this.pendingRequests.set(id, (response) => {
        clearTimeout(timeout);

        // Check for error response
        if (response.type === 'error') {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });

      this.ws.send(JSON.stringify(message));
    });
  }
}
```

### Pattern 2: Lifecycle Management

```javascript
class AppLifecycleManager extends LifecycleClient {
  /**
   * Unified app management - handles all lifecycle actions
   * @param {string} appId - App ID (with or without VEA- prefix)
   * @param {string} action - Action: start, stop, pause, resume, restart, remove
   * @returns {Promise<Object>} Response with status, result, and state
   */
  async manageApp(appId, action) {
    const message = {
      type: 'manage_app',
      id: `manage-${appId}-${action}-${Date.now()}`,
      app_id: appId,
      action: action
    };

    try {
      const response = await this.sendMessage(message);

      // Check response type
      if (response.type === 'error') {
        throw new Error(response.error);
      }

      // Validate response has expected fields
      if (!response.status) {
        console.warn('⚠️  Response missing status field:', response);
      }

      return {
        success: response.status === 'success' || response.status === 'started' || response.status === 'restarted',
        action: response.action,
        appId: response.app_id,
        status: response.status,
        result: response.result,
        state: response.state,
        timestamp: response.timestamp
      };

    } catch (error) {
      console.error(`❌ Failed to ${action} app ${appId}:`, error.message);
      throw error;
    }
  }

  /**
   * Convenience methods for each action
   */
  async startApp(appId) {
    return this.manageApp(appId, 'start');
  }

  async stopApp(appId) {
    return this.manageApp(appId, 'stop');
  }

  async pauseApp(appId) {
    return this.manageApp(appId, 'pause');
  }

  async resumeApp(appId) {
    return this.manageApp(appId, 'resume');
  }

  async restartApp(appId) {
    return this.manageApp(appId, 'restart');
  }

  async removeApp(appId) {
    return this.manageApp(appId, 'remove');
  }
}
```

### Pattern 3: App Status Retrieval

```javascript
class AppStatusManager extends LifecycleClient {
  /**
   * Get app status (handles VEA- prefix automatically)
   * @param {string} appId - App ID (with or without VEA- prefix)
   * @returns {Promise<Object>} App status information
   */
  async getAppStatus(appId) {
    const message = {
      type: 'get_app_status',
      id: `status-${appId}-${Date.now()}`,
      appId: appId
    };

    try {
      const response = await this.sendMessage(message);

      if (response.type === 'error') {
        throw new Error(response.error);
      }

      return {
        appId: response.result.appId,
        status: response.result.status,
        timestamp: response.result.timestamp
      };

    } catch (error) {
      console.error(`❌ Failed to get status for ${appId}:`, error.message);
      throw error;
    }
  }

  /**
   * List all deployed apps
   * @returns {Promise<Array>} List of applications
   */
  async listApps() {
    const message = {
      type: 'list_deployed_apps',
      id: `list-${Date.now()}`
    };

    try {
      const response = await this.sendMessage(message);

      if (response.type === 'error') {
        throw new Error(response.error);
      }

      // Response has both 'applications' and 'apps' arrays (duplicate)
      // Use 'applications' as the canonical source
      return response.applications || response.apps || [];

    } catch (error) {
      console.error('❌ Failed to list apps:', error.message);
      throw error;
    }
  }
}
```

### Pattern 4: React Integration Example

```javascript
import React, { useState, useEffect, useCallback } from 'react';

function useAppLifecycle(wsUrl) {
  const [client, setClient] = useState(null);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize client
  useEffect(() => {
    const lifecycleClient = new AppLifecycleManager(wsUrl);
    lifecycleClient.connect()
      .then(() => setClient(lifecycleClient))
      .catch(err => setError(err.message));

    return () => {
      if (lifecycleClient.ws) {
        lifecycleClient.ws.close();
      }
    };
  }, [wsUrl]);

  // Refresh app list
  const refreshApps = useCallback(async () => {
    if (!client) return;

    setLoading(true);
    setError(null);

    try {
      const appList = await client.listApps();
      setApps(appList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Manage app lifecycle
  const manageApp = useCallback(async (appId, action) => {
    if (!client) return;

    setError(null);

    try {
      const result = await client.manageApp(appId, action);

      // Update local state
      setApps(prevApps => prevApps.map(app => {
        if (app.app_id === appId) {
          return {
            ...app,
            status: result.state || app.status,
            last_updated: result.timestamp
          };
        }
        return app;
      }));

      // Refresh full list after a short delay to get accurate state
      setTimeout(() => refreshApps(), 1000);

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [client, refreshApps]);

  return {
    apps,
    loading,
    error,
    manageApp,
    refreshApps
  };
}

// React Component Example
function AppManager() {
  const { apps, loading, error, manageApp, refreshApps } = useAppLifecycle('ws://localhost:3002/runtime');

  useEffect(() => {
    refreshApps();
    // Auto-refresh every 5 seconds
    const interval = setInterval(refreshApps, 5000);
    return () => clearInterval(interval);
  }, [refreshApps]);

  const handleAction = async (appId, action) => {
    try {
      await manageApp(appId, action);
      console.log(`✅ Successfully ${action}ed ${appId}`);
    } catch (err) {
      alert(`Failed to ${action} app: ${err.message}`);
    }
  };

  return (
    <div>
      <h1>Vehicle Applications</h1>

      {error && <div className="error">❌ {error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>App ID</th>
              <th>Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {apps.map(app => (
              <tr key={app.app_id}>
                <td>{app.app_id}</td>
                <td>{app.name}</td>
                <td>{app.status}</td>
                <td>
                  {app.status === 'running' && (
                    <>
                      <button onClick={() => handleAction(app.app_id, 'pause')}>
                        Pause
                      </button>
                      <button onClick={() => handleAction(app.app_id, 'stop')}>
                        Stop
                      </button>
                    </>
                  )}
                  {app.status === 'paused' && (
                    <>
                      <button onClick={() => handleAction(app.app_id, 'resume')}>
                        Resume
                      </button>
                      <button onClick={() => handleAction(app.app_id, 'stop')}>
                        Stop
                      </button>
                    </>
                  )}
                  {app.status === 'stopped' && (
                    <>
                      <button onClick={() => handleAction(app.app_id, 'start')}>
                        Start
                      </button>
                      <button onClick={() => handleAction(app.app_id, 'remove')}>
                        Remove
                      </button>
                    </>
                  )}
                  <button onClick={() => handleAction(app.app_id, 'restart')}>
                    Restart
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

### Pattern 5: Error Handling Best Practices

```javascript
class LifecycleErrorHandler {
  /**
   * Handle lifecycle errors with user-friendly messages
   */
  static handleError(error, appId, action) {
    const errorMessage = error.message || error.toString();

    // App not found errors
    if (errorMessage.includes('not found')) {
      return {
        type: 'error',
        severity: 'error',
        title: 'Application Not Found',
        message: `The application "${appId}" does not exist or has been removed.`,
        action: 'retry'
      };
    }

    // Invalid state transition errors
    if (errorMessage.includes('not paused')) {
      return {
        type: 'error',
        severity: 'warning',
        title: 'Invalid Operation',
        message: `Cannot resume "${appId}" - it is not paused.`,
        action: 'none'
      };
    }

    // Already running errors
    if (errorMessage.includes('already running')) {
      return {
        type: 'error',
        severity: 'info',
        title: 'Already Running',
        message: `Application "${appId}" is already running.`,
        action: 'none'
      };
    }

    // Generic error
    return {
      type: 'error',
      severity: 'error',
      title: 'Operation Failed',
      message: `Failed to ${action} application "${appId}": ${errorMessage}`,
      action: 'retry'
    };
  }

  /**
   * Show appropriate UI feedback based on error
   */
  static showError(errorHandler) {
    switch (errorHandler.severity) {
      case 'error':
        alert(`❌ ${errorHandler.title}\n\n${errorHandler.message}`);
        break;
      case 'warning':
        console.warn(`⚠️  ${errorHandler.title}: ${errorHandler.message}`);
        break;
      case 'info':
        console.info(`ℹ️  ${errorHandler.title}: ${errorHandler.message}`);
        break;
    }
  }
}
```

---

## State Management Best Practices

### 1. Keep App IDs Consistent

```javascript
// ✅ GOOD - Use app_id from API responses
const deployApp = async () => {
  const response = await api.deployApp(code);
  const appId = response.appId;  // Already has VEA- prefix
  saveAppId(appId);
};

// ❌ BAD - Don't strip or modify app_id
const deployApp = async () => {
  const response = await api.deployApp(code);
  const appId = response.appId.replace('VEA-', '');  // Don't do this!
  saveAppId(appId);
};
```

### 2. Handle All Response Types

```javascript
// ✅ GOOD - Check for error responses
const manageApp = async (appId, action) => {
  const response = await api.sendMessage({
    type: 'manage_app',
    app_id: appId,
    action: action
  });

  if (response.type === 'error') {
    throw new Error(response.error);
  }

  return response;
};

// ❌ BAD - Assume success
const manageApp = async (appId, action) => {
  const response = await api.sendMessage({...});
  return response;  // Might be an error!
};
```

### 3. Refresh State After Actions

```javascript
// ✅ GOOD - Refresh after lifecycle changes
const handleStop = async (appId) => {
  await api.manageApp(appId, 'stop');
  await refreshAppList();  // Get updated state
};

// ❌ BAD - Don't refresh state
const handleStop = async (appId) => {
  await api.manageApp(appId, 'stop');
  // UI shows old state
};
```

---

## Testing Your Frontend Integration

### Test Checklist

- [ ] Can deploy an app and use the returned `appId` directly?
- [ ] Can start/stop/pause/resume apps using the app_id from deployment?
- [ ] Do error responses display correctly when operating on non-existent apps?
- [ ] Does the UI update after lifecycle actions?
- [ ] Can handle rapid successive actions (e.g., pause then resume)?
- [ ] Does the UI show correct state after page refresh?
- [ ] Are error messages user-friendly?

### Test Script

```javascript
// Frontend integration test
async function testFrontendIntegration() {
  const client = new AppLifecycleManager('ws://localhost:3002/runtime');
  await client.connect();

  console.log('Testing frontend integration...');

  // Test 1: List apps
  console.log('\n1. Listing apps...');
  const apps = await client.listApps();
  console.log(`✅ Found ${apps.length} apps`);

  if (apps.length === 0) {
    console.log('No apps to test with. Deploy an app first.');
    return;
  }

  const testApp = apps[0];
  console.log(`Testing with app: ${testApp.app_id}`);

  // Test 2: Get status
  console.log('\n2. Getting status...');
  const status = await client.getAppStatus(testApp.app_id);
  console.log(`✅ Status: ${status.status}`);

  // Test 3: Lifecycle actions based on current state
  if (status.status === 'running') {
    console.log('\n3. Pausing app...');
    await client.pauseApp(testApp.app_id);
    console.log('✅ Paused');

    console.log('\n4. Resuming app...');
    await client.resumeApp(testApp.app_id);
    console.log('✅ Resumed');
  }

  // Test 4: Error handling
  console.log('\n5. Testing error handling...');
  try {
    await client.manageApp('non-existent-app-12345', 'start');
    console.log('❌ Should have thrown an error!');
  } catch (error) {
    console.log('✅ Error correctly thrown:', error.message);
  }

  console.log('\n✅ All tests passed!');
}
```

---

## Quick Reference

### API Message Formats

```javascript
// List apps
{ type: 'list_deployed_apps', id: '...' }

// Get app status (with or without VEA- prefix)
{ type: 'get_app_status', appId: 'app-id', id: '...' }

// Manage app (unified interface)
{
  type: 'manage_app',
  id: '...',
  app_id: 'app-id',  // With or without VEA- prefix
  action: 'start|stop|pause|resume|restart|remove'
}

// Deploy app
{
  type: 'deploy_request',
  code: '...',
  prototype: { id: '...', ... },
  ...
}
```

### Response Types

```javascript
// Success response
{
  type: 'manage_app-response',
  app_id: 'VEA-app-123',
  action: 'start',
  status: 'success|started|restarted',
  result: 'Operation completed',
  state: 'running|paused|stopped',
  timestamp: '...'
}

// Error response
{
  type: 'error',
  error: 'Error message',
  app_id: '...',
  timestamp: '...'
}
```

---

## Conclusion

The key changes for frontend sync:

1. **Use app IDs as returned** from the API (with VEA- prefix)
2. **Check for error responses** before processing
3. **Handle the enhanced response format** with status, result, and state fields
4. **Refresh app state** after lifecycle actions
5. **Provide user-friendly error messages** based on error types

The backend now handles both prefixed and non-prefixed app IDs, but it's best practice to always use the app_id exactly as returned from the API.
