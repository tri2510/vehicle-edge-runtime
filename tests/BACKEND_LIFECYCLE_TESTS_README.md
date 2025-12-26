# Backend Lifecycle Tests - Quick Reference

Quick start guide for running backend lifecycle validation tests.

## What These Tests Do

These tests simulate frontend lifecycle management to ensure the backend API returns responses in the exact format the frontend expects.

## Quick Start

### Prerequisites

1. Start the Vehicle Edge Runtime:
```bash
npm start
```

2. In another terminal, run the tests:

**Option A: Standalone Test Script (Recommended)**
```bash
node backend-lifecycle-test-runner.js
```

**Option B: Node.js Test Runner**
```bash
node --test tests/integration/backend-lifecycle.test.js
```

## Expected Results

```
✅ Passed: 13
❌ Failed: 0
⚠️  Errors (Expected): 2  # These are intentional error tests
📊 Total: 15
```

## Critical Response Fields

The frontend **requires** these fields in all responses:

### Success Responses (start, stop, pause, resume, restart, uninstall)
- ✅ `status`: 'success' or 'started'
- ✅ `result`: Human-readable message
- ✅ `state`: 'running', 'stopped', or 'paused'

### Error Responses
- ✅ `type`: Must be exactly 'error'
- ✅ `error`: Error message
- ✅ `app_id`: The app ID that caused the error

**Missing any field = BUG (Frontend will break)**

## Test Coverage

- ✅ Deploy 3 different applications
- ✅ List all deployed apps
- ✅ Start/Stop/Pause/Resume/Restart operations
- ✅ Uninstall application
- ✅ Error handling (non-existent apps, invalid state transitions)
- ✅ App ID with/without VEA- prefix

## Common Bugs

1. **Missing Error Type**: Returning `{ type: 'xxx-response', error: '...' }` instead of `{ type: 'error', ... }`
2. **Missing Fields**: Not including `status`, `result`, or `state` in success responses
3. **Wrong App ID Format**: Not handling both `app-id` and `VEA-app-id` formats
4. **No Error for Invalid Ops**: Returning success for non-existent apps or invalid state transitions

## Troubleshooting

**Tests fail to connect:**
```bash
# Check if backend is running
curl http://localhost:3003/health
```

**Tests pass but frontend doesn't work:**
- Verify response format matches exactly (case-sensitive!)
- Check browser console for WebSocket errors

## Files

- **`backend-lifecycle-test-runner.js`** - Standalone test script
- **`tests/integration/backend-lifecycle.test.js`** - Node.js test suite
- **`tests/BACKEND_LIFECYCLE_TEST_GUIDE.md`** - Comprehensive guide with all scenarios

## Need More Details?

See the comprehensive test guide: `tests/BACKEND_LIFECYCLE_TEST_GUIDE.md`
