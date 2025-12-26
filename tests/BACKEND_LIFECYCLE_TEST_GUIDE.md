# Backend Lifecycle Test Guide

Comprehensive test guide for validating backend lifecycle management API against frontend integration requirements.

## Overview

This test suite validates that the Vehicle Edge Runtime backend correctly handles all lifecycle management operations that the frontend expects, with proper response formats and error handling.

## Quick Start

### Option 1: Run Standalone Test Script (Recommended)

```bash
# Make sure the runtime is running first
npm start

# In another terminal, run the test
node backend-lifecycle-test-runner.js

# Or with custom WebSocket URL
WS_URL=ws://localhost:3002/runtime node backend-lifecycle-test-runner.js
```

**Expected Output:**
```
✅ Passed: 13
❌ Failed: 0
⚠️  Errors (Expected): 2  # These are intentional error tests
📊 Total: 15
```

### Option 2: Run as Node.js Test

```bash
# Run with Node.js built-in test runner
node --test tests/integration/backend-lifecycle.test.js
```

### Option 3: Quick Manual Testing

Use a WebSocket client to send individual test messages. See test scenarios below.

---

## Critical Response Format Requirements

The frontend **requires** these exact response formats. Missing any field will break the UI.

### ✅ Success Response Format

All lifecycle operations (start, stop, pause, resume, restart, uninstall) **must** return:

```javascript
{
  type: 'stop_app-response',  // or run_app-response, pause_app-response, etc.
  id: 'message-id',
  app_id: 'kuksa-data-broker',
  action: 'stop',  // or 'start', 'pause', 'resume', 'restart', 'remove'
  status: 'success',  // ✅ REQUIRED FIELD
  result: 'Application stopped successfully',  // ✅ REQUIRED FIELD
  state: 'stopped',  // ✅ REQUIRED FIELD: 'running', 'stopped', 'paused'
  timestamp: '2025-01-26T10:30:00.000Z'
}
```

**Missing `status`, `result`, or `state` = BUG (frontend will not work correctly)**

### ✅ Error Response Format

All errors **must** return:

```javascript
{
  type: 'error',  // ✅ MUST be exactly 'error', NOT 'xxx-response'
  error: 'Application not found: non-existent-app',  // ✅ REQUIRED
  app_id: 'non-existent-app',
  timestamp: '2025-01-26T10:30:00.000Z'
}
```

**If `type` is not 'error' = BUG (frontend treats it as success)**

### ✅ List Apps Response Format

```javascript
{
  type: 'list_deployed_apps-response',
  id: 'message-id',
  applications: [  // ✅ REQUIRED
    {
      app_id: 'kuksa-data-broker',  // ✅ REQUIRED
      name: 'KUKSA Data Broker',  // ✅ REQUIRED
      status: 'running',  // ✅ REQUIRED
      type: 'python',  // ✅ REQUIRED
      version: '1.0.0',
      deploy_time: '2025-01-26T10:00:00.000Z'
    }
  ]
}
```

---

## Test Scenarios

### Test Suite 1: Deployment (3 tests)

#### Test 1.1: Deploy KUKSA Data Broker
**Purpose:** Validate basic deployment response format

**Request:**
```javascript
{
  type: 'deploy_request',
  id: 'deploy-kuksa-' + Date.now(),
  code: 'print("KUKSA Data Broker Running...")\nimport time\ntime.sleep(30)',
  vehicleId: 'test-vehicle',
  language: 'python',
  prototype: {
    id: 'kuksa-data-broker',
    name: 'KUKSA Data Broker',
    version: '1.0.0'
  },
  dependencies: []
}
```

**Expected Response:**
```javascript
{
  type: 'deploy_request-response',
  appId: 'kuksa-data-broker',
  status: 'started',
  result: 'Application deployed successfully',
  state: 'running'
}
```

#### Test 1.2: Deploy Mock Service
Similar to Test 1.1 with different app

#### Test 1.3: Deploy Custom Python App
Similar to Test 1.1 with different app

---

### Test Suite 2: Lifecycle Management (6 tests)

#### Test 2.1: List All Deployed Apps
**Purpose:** Validate listing functionality and response format

**Request:**
```javascript
{
  type: 'list_deployed_apps',
  id: 'list-' + Date.now()
}
```

**Expected Response:**
```javascript
{
  type: 'list_deployed_apps-response',
  applications: [
    { app_id: 'kuksa-data-broker', name: 'KUKSA Data Broker', status: 'running', ... },
    { app_id: 'mock-service', name: 'Mock Service', status: 'running', ... },
    { app_id: 'custom-python-app', name: 'Custom Python App', status: 'running', ... }
  ]
}
```

#### Test 2.2: Stop a Running App
**Purpose:** Validate stop operation

**Request:**
```javascript
{
  type: 'stop_app',
  id: 'stop-kuksa-' + Date.now(),
  appId: 'kuksa-data-broker'
}
```

**Expected Response:**
```javascript
{
  type: 'stop_app-response',
  app_id: 'kuksa-data-broker',
  action: 'stop',
  status: 'success',  // ✅ CRITICAL
  result: 'Application stopped successfully',  // ✅ CRITICAL
  state: 'stopped'  // ✅ CRITICAL
}
```

#### Test 2.3: Start a Stopped App
**Purpose:** Validate start operation

**Request:**
```javascript
{
  type: 'run_app',
  id: 'start-mock-' + Date.now(),
  appId: 'mock-service'
}
```

**Expected Response:**
```javascript
{
  type: 'run_app-response',
  app_id: 'mock-service',
  action: 'start',
  status: 'started',  // ✅ CRITICAL
  result: 'Application started successfully',  // ✅ CRITICAL
  state: 'running'  // ✅ CRITICAL
}
```

#### Test 2.4: Pause a Running App
**Purpose:** Validate pause operation

**Request:**
```javascript
{
  type: 'pause_app',
  id: 'pause-custom-' + Date.now(),
  appId: 'custom-python-app'
}
```

**Expected Response:**
```javascript
{
  type: 'pause_app-response',
  app_id: 'custom-python-app',
  action: 'pause',
  status: 'success',
  result: 'Application paused successfully',
  state: 'paused'
}
```

#### Test 2.5: Resume a Paused App
**Purpose:** Validate resume operation

**Request:**
```javascript
{
  type: 'resume_app',
  id: 'resume-custom-' + Date.now(),
  appId: 'custom-python-app'
}
```

**Expected Response:**
```javascript
{
  type: 'resume_app-response',
  app_id: 'custom-python-app',
  action: 'resume',
  status: 'success',
  result: 'Application resumed successfully',
  state: 'running'
}
```

#### Test 2.6: Restart an App
**Purpose:** Validate restart operation (implemented as stop + start by frontend)

**Request:**
```javascript
// Step 1: Stop
{
  type: 'stop_app',
  id: 'restart-stop-' + Date.now(),
  appId: 'kuksa-data-broker'
}

// Step 2: Start (after stop completes)
{
  type: 'run_app',
  id: 'restart-start-' + Date.now(),
  appId: 'kuksa-data-broker'
}
```

**Expected Response:**
Both steps should return appropriate success responses.

---

### Test Suite 3: Error Handling (4 tests)

#### Test 3.1: Operate on Non-Existent App
**Purpose:** Validate proper error response for invalid app ID

**Request:**
```javascript
{
  type: 'stop_app',
  id: 'error-test-' + Date.now(),
  appId: 'non-existent-app-12345'
}
```

**Expected Response:**
```javascript
{
  type: 'error',  // ✅ MUST be exactly 'error'
  error: 'Application not found: non-existent-app-12345',
  app_id: 'non-existent-app-12345'
}
```

#### Test 3.2: Invalid State Transition
**Purpose:** Validate error when trying invalid state transition

**Request:**
```javascript
{
  type: 'resume_app',
  id: 'error-test2-' + Date.now(),
  appId: 'kuksa-data-broker'  // Assuming it's running, not paused
}
```

**Expected Response:**
```javascript
{
  type: 'error',
  error: 'Cannot resume kuksa-data-broker - it is not paused',
  app_id: 'kuksa-data-broker'
}
```

#### Test 3.3: Uninstall an App
**Purpose:** Validate uninstall operation

**Request:**
```javascript
{
  type: 'uninstall_app',
  id: 'uninstall-mock-' + Date.now(),
  appId: 'mock-service'
}
```

**Expected Response:**
```javascript
{
  type: 'uninstall_app-response',
  app_id: 'mock-service',
  action: 'remove',
  status: 'success',
  result: 'Application uninstalled successfully',
  state: 'removed'
}
```

#### Test 3.4: App ID with VEA- Prefix
**Purpose:** Validate that backend handles both `app-id` and `VEA-app-id` formats

**Request:**
```javascript
{
  type: 'run_app',
  id: 'prefix-test-' + Date.now(),
  appId: 'VEA-kuksa-data-broker'  // With VEA- prefix
}
```

**Expected Response:**
```javascript
{
  type: 'run_app-response',
  app_id: 'VEA-kuksa-data-broker',
  action: 'start',
  status: 'started',
  result: 'Application started successfully',
  state: 'running'
}
```

---

## Common Bugs Found in Backend Integration

### Bug #1: Missing Error Type
**Problem:** Backend returns `{ type: 'stop_app-response', error: '...' }`

**Expected:** Return `{ type: 'error', error: '...' }` instead

**Impact:** Frontend treats error as success

### Bug #2: Missing Required Fields
**Problem:** Response missing `status`, `result`, or `state` fields

**Expected:** Always include all three fields in success responses

**Impact:** Frontend cannot properly display operation results

### Bug #3: Wrong App ID Format
**Problem:** Backend doesn't handle both `app-name` and `VEA-app-name` formats

**Expected:** Accept both formats and resolve them correctly

**Impact:** Frontend operations fail with "app not found" errors

### Bug #4: No Error for Non-Existent Apps
**Problem:** Operating on non-existent app returns success

**Expected:** Return error response with `type: 'error'`

**Impact:** Frontend shows incorrect state to user

### Bug #5: Invalid State Transitions Allowed
**Problem:** Can resume app that's not paused

**Expected:** Validate state transitions and return error if invalid

**Impact:** Confusing UI behavior and potential system instability

---

## WebSocket Message Types Reference

### Client → Server (Requests)

| Type | Purpose | Required Fields |
|------|---------|-----------------|
| `register_client` | Register frontend | `clientInfo` |
| `deploy_request` | Deploy new app | `code`, `language`, `prototype` |
| `list_deployed_apps` | List all apps | none |
| `run_app` | Start app | `appId` |
| `stop_app` | Stop app | `appId` |
| `pause_app` | Pause app | `appId` |
| `resume_app` | Resume app | `appId` |
| `uninstall_app` | Remove app | `appId` |
| `get_app_status` | Get app status | `appId` |

### Server → Client (Responses)

| Type | Purpose | Required Fields |
|------|---------|-----------------|
| `deploy_request-response` | Deployment result | `appId`, `status`, `result` |
| `list_deployed_apps-response` | Apps list | `applications` array |
| `run_app-response` | Start result | `status`, `result`, `state` |
| `stop_app-response` | Stop result | `status`, `result`, `state` |
| `pause_app-response` | Pause result | `status`, `result`, `state` |
| `resume_app-response` | Resume result | `status`, `result`, `state` |
| `uninstall_app-response` | Remove result | `status`, `result`, `state` |
| `get_app_status-response` | Status info | `status` object |
| `error` | **Error response** | `error` message |

---

## Validation Checklist

Before releasing backend changes, verify:

- [ ] All lifecycle responses include `status`, `result`, and `state` fields
- [ ] Error responses have `type: 'error'` (not other types)
- [ ] Non-existent apps return error responses
- [ ] Invalid state transitions return error responses
- [ ] Both `app-id` and `VEA-app-id` formats work
- [ ] List apps returns all required fields
- [ ] Console output streams correctly
- [ ] App status updates are sent via WebSocket broadcasts

---

## Test Files

- **`backend-lifecycle-test-runner.js`** - Standalone test script (run this!)
- **`tests/integration/backend-lifecycle.test.js`** - Node.js test suite
- **`tests/BACKEND_LIFECYCLE_TEST_GUIDE.md`** - This file (comprehensive guide)

---

## Troubleshooting

### Test fails to connect
```bash
# Check if backend is running
curl http://localhost:3003/health

# Check WebSocket port
netstat -an | grep 3002
```

### Tests pass but frontend doesn't work
- Check if WebSocket URL matches
- Verify CORS headers are set correctly
- Check browser console for WebSocket errors
- Verify response format matches exactly (case-sensitive!)

### Specific test failures
- **Missing fields:** Backend not returning all required fields
- **Wrong type:** Backend returning 'xxx-response' instead of 'error' for errors
- **App not found:** Backend not handling app ID correctly

---

**Last Updated:** 2025-01-26
**Based on:** autowrx/frontend backend integration requirements
