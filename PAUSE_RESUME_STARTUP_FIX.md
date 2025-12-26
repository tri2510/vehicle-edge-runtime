# Pause/Resume Startup Restoration Fix

## Problem Summary

When the Vehicle Edge Runtime restarted, applications that were running before the restart could not be paused or resumed through the API, even though the Docker containers were still running.

### Root Cause

The `_loadApplicationsFromDatabase()` method (called during startup) was:
- ✅ Checking container status and updating database
- ❌ **NOT** populating the `this.applications` in-memory Map

But `pauseApplication()` and `resumeApplication()` search through this Map to find applications, so they failed with "Application not found or not running" even though the containers existed.

## The Fix

### File: `src/apps/EnhancedApplicationManager.js` (Lines 876-939)

Enhanced `_loadApplicationsFromDatabase()` to populate the applications Map for running containers:

```javascript
async _loadApplicationsFromDatabase() {
    try {
        const apps = await this.db.listApplications({ status: 'running' });
        let loadedCount = 0;

        for (const app of apps) {
            const runtimeState = await this.db.getRuntimeState(app.id);
            if (runtimeState && runtimeState.container_id) {
                try {
                    const container = this.docker.getContainer(runtimeState.container_id);
                    const containerInfo = await container.inspect();

                    if (containerInfo.State.Status === 'exited') {
                        // Update database to reflect actual status
                        await this.db.updateApplication(app.id, { status: 'stopped' });
                        await this.db.updateRuntimeState(app.id, {
                            current_state: 'stopped',
                            exit_code: containerInfo.State.ExitCode
                        });
                    } else if (containerInfo.State.Status === 'running') {
                        // ✅ NEW: Container is running - add to in-memory cache
                        // This is critical for pause/resume to work after restart
                        const executionId = runtimeState.execution_id;
                        if (executionId && !this.applications.has(executionId)) {
                            const appInfo = {
                                executionId: executionId,
                                appId: app.id,
                                name: app.name,
                                type: app.type,
                                container: container,
                                status: 'running',
                                startTime: app.last_start || app.created_at,
                                appDir: app.data_path || `/app/applications/${app.id}`
                            };

                            // Add to memory cache for pause/resume operations
                            this.applications.set(executionId, appInfo);
                            loadedCount++;

                            this.logger.debug('Restored application to memory cache', {
                                appId: app.id,
                                executionId,
                                name: app.name
                            });
                        }
                    }
                } catch (error) {
                    // Container doesn't exist, update status
                    await this.db.updateApplication(app.id, { status: 'error' });
                    await this.db.updateRuntimeState(app.id, { current_state: 'error' });
                }
            }
        }

        this.logger.info('Applications loaded from database', {
            total: apps.length,
            restored_to_memory: loadedCount
        });

    } catch (error) {
        this.logger.warn('Failed to load applications from database', { error: error.message });
    }
}
```

### What Changed

**Before**: Method only checked container status and updated database, but didn't restore apps to memory.

**After**: Method now:
1. Checks if containers are actually running
2. For running containers, creates appInfo objects with all required fields
3. Adds them to `this.applications` Map (keyed by executionId)
4. Logs how many apps were restored to memory

## How It Works

### During Fresh Deployment

When you deploy an app through the frontend:
1. `startApplication()` is called (line ~447 for binary/Docker apps)
2. Container is created and started (line ~501-502)
3. App info is added to `this.applications` Map (line ~542) ✅
4. Pause/resume work immediately ✅

### After Runtime Restart

When the runtime restarts:
1. `initialize()` calls `_loadApplicationsFromDatabase()` (line 47)
2. For each app with status='running' in database:
   - Gets container from Docker
   - If container is running, adds to `this.applications` Map ✅
3. Pause/resume can find the app in the Map ✅

### Complete Flow

```
[Fresh Deploy]
Frontend → deployApp → startApplication
  → Creates container
  → Adds to this.applications Map (line 542)
  → Pause/Resume work ✅

[Runtime Restart]
Runtime starts → initialize()
  → _loadApplicationsFromDatabase()
  → Finds running containers in DB
  → Restores to this.applications Map (NEW)
  → Pause/Resume work ✅
```

## Testing

### 1. Deploy an App

Deploy the KUKSA databroker through the frontend or API.

### 2. Verify It's Running

```bash
# List deployed apps
node /tmp/list_apps.js

# Expected: Shows VEA-kuksa-databroker with status="running"
```

### 3. Test Pause Before Restart

```bash
# Test pause
node /tmp/test_pause_fixed.js

# Expected: ✅ PAUSE SUCCESS! Container Paused: true
# Then: ✅ RESUME SUCCESS! Container Paused: false
```

### 4. Restart Runtime

```bash
# Stop and restart runtime container
docker stop vehicle-edge-runtime-dev
docker start vehicle-edge-runtime-dev

# Or use the start script
/home/htr1hc/01_SDV/78_deploy_extension/vehicle-edge-runtime/scripts/start-docker-dev.sh
```

### 5. Check Startup Logs

```bash
docker logs vehicle-edge-runtime-dev 2>&1 | grep "Applications loaded from database"

# Expected to see: {"total":1,"restored_to_memory":1}
```

### 6. Test Pause After Restart

```bash
# Test pause again
node /tmp/test_pause_fixed.js

# Expected: ✅ PAUSE SUCCESS! Container Paused: true
# Then: ✅ RESUME SUCCESS! Container Paused: false
```

## Previous Fixes Applied

This fix works together with two previous fixes:

### Fix 1: App ID Lookup (Line ~2617, ~573)
Fixed `pauseApplication()` and `resumeApplication()` to search by `appId` instead of assuming direct Map lookup by `executionId`.

**Before**:
```javascript
const appInfo = this.applications.get(appId);  // ❌ Wrong key
```

**After**:
```javascript
// Search for the app by appId
for (const [execId, info] of this.applications.entries()) {
    if (info.appId === appId) {
        appInfo = info;
        executionId = execId;
        break;
    }
}
```

### Fix 2: Startup Restoration (This Fix)
Enhanced `_loadApplicationsFromDatabase()` to populate the applications Map for running containers.

## Summary

- ✅ **Fix 1**: pauseApplication/resumeApplication now search by appId (not executionId)
- ✅ **Fix 2**: _loadApplicationsFromDatabase() now restores running apps to memory on startup
- ✅ **Result**: Pause/resume work immediately after deployment AND after runtime restart

## Deployment Status

- ✅ Code fix applied to `src/apps/EnhancedApplicationManager.js`
- ✅ Docker image rebuilt: `vehicle-edge-runtime:dev`
- ✅ Container restarted with new image
- ✅ Runtime healthy: http://localhost:3003/health

**The fix is now active and ready for testing!**
