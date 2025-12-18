# Frontend Smart UX Implementation Spec

## Overview
Implementation specifications for frontend to consume the new Vehicle Edge Runtime smart deployment features. All communication via WebSocket to `ws://localhost:3002/runtime`.

## 🚀 New WebSocket Message Types

### 1. Smart Deployment
```javascript
// Request: Smart deployment with auto-features
{
  "type": "smart_deploy",
  "id": "string",                    // App identifier (required)
  "name": "string",                  // Display name (optional)
  "type": "python" | "binary",       // App type (default: "python")
  "code": "string",                  // Application code (required)
  "dependencies": ["string"],        // Optional manual dependencies
  "signals": ["string" | {path: "string", access: "string", rate_hz: number}],
  "kuksa_config": {                  // Optional KUKSA configuration
    "server": "string",
    "tls": {"ca_cert": "string"}
  },
  "environment": "production" | "staging" | "development"
}

// Response: Success with auto-detected features
{
  "type": "smart_deploy-response",
  "id": "string",
  "app_id": "string",                // Unique ID (may have suffix added)
  "status": "success",
  "auto_detected_dependencies": ["string"],
  "signal_validation": {
    "valid": [Signal],
    "invalid": [Signal],
    "warnings": ["string"],
    "total": number
  },
  "deployment_id": "string",
  "timestamp": "ISO 8601 string"
}

// Response: Error with smart suggestions
{
  "type": "error",
  "id": "string",
  "error": "string",
  "app_id": "string",
  "suggestions": ["string"],         // Actionable suggestions
  "timestamp": "ISO 8601 string"
}
```

### 2. Dependency Detection
```javascript
// Request: Analyze code for dependencies
{
  "type": "detect_dependencies",
  "code": "string",                  // Source code to analyze
  "language": "python" | "binary"    // Language (default: "python")
}

// Response: Detected dependencies
{
  "type": "dependencies_detected",
  "id": "string",
  "language": "string",
  "dependencies": ["string"],        // Package names
  "count": number,
  "timestamp": "ISO 8601 string"
}
```

### 3. Signal Validation
```javascript
// Request: Validate vehicle signal availability
{
  "type": "validate_signals",
  "signals": ["string" | {path: "string", access: "string", rate_hz: number}]
}

// Response: Signal validation results
{
  "type": "signals_validated",
  "id": "string",
  "validation": {
    "valid": [Signal],               // Available signals
    "invalid": [Signal],             // Unavailable signals
    "warnings": ["string"],          // Validation warnings
    "total": number
  },
  "timestamp": "ISO 8601 string"
}

// Signal object format
{
  "path": "Vehicle.Speed",           // VSS signal path
  "access": "subscribe" | "get",     // Access type
  "rate_hz": number                  // Update frequency (optional)
}
```

### 4. Deployment Status
```javascript
// Request: Get detailed deployment status
{
  "type": "get_deployment_status",
  "app_id": "string"
}

// Response: Comprehensive deployment information
{
  "type": "deployment_status",
  "id": "string",
  "app_id": "string",
  "app": {                          // App metadata
    "id": "string",
    "name": "string",
    "type": "string",
    "status": "string",
    "created_at": "ISO 8601 string",
    "python_deps": ["string"],
    "vehicle_signals": ["string"]
  },
  "runtime_state": {                 // Runtime information
    "app_id": "string",
    "current_state": "running" | "stopped" | "error",
    "container_id": "string",
    "last_heartbeat": "ISO 8601 string"
  },
  "dependencies": [Dependency],      // Installation status
  "recent_logs": [LogEntry],         // Recent log entries
  "timestamp": "ISO 8601 string"
}
```

### 5. Real-time Deployment Progress
```javascript
// Progress updates (pushed automatically during deployment)
{
  "type": "deployment_progress",
  "app_id": "string",
  "stage": "installing_dependencies" | "installing_dependency" | "starting_application",
  "details": {
    "dependency": "string",          // Current dependency (installing_dependency)
    "current": number,               // Current progress (installing_dependencies)
    "total": number,                 // Total items
    "progress": number               // Percentage complete
  },
  "timestamp": "ISO 8601 string"
}
```

## 🎨 Frontend UI Component Specification

### SmartDeployForm Component
```typescript
interface SmartDeployFormProps {
  onSubmit: (deployment: SmartDeployment) => void;
  isDeploying: boolean;
}

interface SmartDeployment {
  id: string;
  name: string;
  type: 'python' | 'binary';
  code: string;
  dependencies: string[];
  signals: string[];
  environment: 'production' | 'staging' | 'development';
}
```

### AutoDependencyDetector Component
```typescript
interface AutoDependencyDetectorProps {
  code: string;
  onDependenciesDetected: (deps: string[]) => void;
  loading: boolean;
}

// Usage: Trigger on code change with debouncing (500ms)
```

### SignalValidator Component
```typescript
interface SignalValidatorProps {
  signals: string[];
  onValidationComplete: (validation: SignalValidation) => void;
  availableSignals?: string[];       // Optional pre-populated list
}

interface SignalValidation {
  valid: Signal[];
  invalid: Signal[];
  warnings: string[];
  total: number;
}
```

### DeploymentProgress Component
```typescript
interface DeploymentProgressProps {
  appId: string;
  stage: DeploymentStage;
  details: ProgressDetails;
}

type DeploymentStage =
  | 'installing_dependencies'
  | 'installing_dependency'
  | 'starting_application';

interface ProgressDetails {
  dependency?: string;
  current?: number;
  total?: number;
  progress?: number;
}
```

### ErrorSuggestions Component
```typescript
interface ErrorSuggestionsProps {
  error: string;
  suggestions: string[];
  onRetry?: () => void;
}
```

## 📱 Implementation Flow

### 1. Code Input & Auto-Detection
```typescript
// On code change (debounced 500ms)
const handleCodeChange = async (newCode: string) => {
  if (!newCode.trim()) return;

  try {
    const response = await wsSend({
      type: 'detect_dependencies',
      code: newCode,
      language: 'python'
    });

    setDetectedDeps(response.dependencies);
    setAutoDetected(true);
  } catch (error) {
    console.error('Dependency detection failed:', error);
  }
};
```

### 2. Signal Selection & Validation
```typescript
// On signals change (debounced 300ms)
const handleSignalsChange = async (newSignals: string[]) => {
  if (newSignals.length === 0) return;

  try {
    const response = await wsSend({
      type: 'validate_signals',
      signals: newSignals
    });

    setSignalValidation(response.validation);
    setSignalsValid(response.validation.invalid.length === 0);
  } catch (error) {
    console.error('Signal validation failed:', error);
  }
};
```

### 3. Smart Deployment
```typescript
const handleSmartDeploy = async (formData: SmartDeployment) => {
  setIsDeploying(true);

  try {
    const response = await wsSend({
      type: 'smart_deploy',
      id: formData.id,
      name: formData.name,
      type: formData.type,
      code: formData.code,
      dependencies: formData.dependencies,
      signals: formData.signals,
      environment: formData.environment
    });

    if (response.type === 'smart_deploy-response') {
      // Show success with auto-detected dependencies
      handleDeploymentSuccess(response);
    }
  } catch (error) {
    if (error.suggestions) {
      // Show smart error suggestions
      setDeploymentError(error);
    }
  } finally {
    setIsDeploying(false);
  }
};
```

### 4. Real-time Progress Monitoring
```typescript
// WebSocket message handler
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'deployment_progress':
      updateDeploymentProgress(message);
      break;

    case 'smart_deploy-response':
      handleDeploymentSuccess(message);
      break;

    case 'error':
      handleDeploymentError(message);
      break;
  }
};
```

## 🎯 UX States & Indicators

### Loading States
- **Dependency Detection**: Show spinner + "Analyzing dependencies..."
- **Signal Validation**: Show spinner + "Validating vehicle signals..."
- **Deployment**: Show progress bar + stage-specific messages

### Success States
- **Dependencies**: Green tags with checkmarks + "Auto-detected"
- **Signals**: Green border + "✅ All signals validated"
- **Deployment**: Success banner with app ID + auto-detected features

### Error States
- **Dependencies**: Warning icon + "Detection failed - add manually"
- **Signals**: Red border + "Invalid signals found"
- **Deployment**: Error banner + actionable suggestions list

### Progress Indicators
```typescript
const progressMessages = {
  'installing_dependencies': '📦 Installing dependencies...',
  'installing_dependency': `✅ Installing ${details.dependency} (${details.current}/${details.total})`,
  'starting_application': '🚀 Starting application...'
};
```

## 🔧 Technical Requirements

### WebSocket Connection
```typescript
const wsUrl = 'ws://localhost:3002/runtime';
const ws = new WebSocket(wsUrl);

// Connection management
ws.onopen = () => setConnectionStatus('connected');
ws.onclose = () => setConnectionStatus('disconnected');
ws.onerror = () => setConnectionStatus('error');
```

### Message Sending Utility
```typescript
const wsSend = async (message: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    const messageId = generateId();
    const messageWithId = { ...message, id: messageId };

    // Store response handler
    responseHandlers.set(messageId, { resolve, reject });

    ws.send(JSON.stringify(messageWithId));

    // Timeout after 30 seconds
    setTimeout(() => {
      responseHandlers.delete(messageId);
      reject(new Error('WebSocket request timeout'));
    }, 30000);
  });
};
```

### Response Handling
```typescript
const responseHandlers = new Map();

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.id && responseHandlers.has(message.id)) {
    const handler = responseHandlers.get(message.id);
    responseHandlers.delete(message.id);

    if (message.type === 'error') {
      handler.reject(message);
    } else {
      handler.resolve(message);
    }
  } else {
    // Handle push messages (deployment_progress, etc.)
    handlePushMessage(message);
  }
};
```

## 📊 Expected Data Flow

1. **User Types Code** → `detect_dependencies` → Show detected deps
2. **User Selects Signals** → `validate_signals` → Show validation status
3. **User Clicks Deploy** → `smart_deploy` → Show deployment progress
4. **Runtime Sends Progress** → `deployment_progress` → Update UI in real-time
5. **Deployment Completes** → Success/Error response → Final UI state

## 🎨 Visual Design Guidelines

### Auto-Detection Indicators
- **Dependencies**: Blue badges with auto-detected label
- **Signals**: Green checkmarks for validated signals
- **Progress**: Animated progress bars with emoji indicators

### Error Presentation
- **Smart Errors**: Grouped error + actionable suggestions
- **Context Help**: Expandable suggestions with copy-paste commands
- **Retry Actions**: Easy retry buttons for failed deployments

### Success Feedback
- **Deployment Success**: Green banner with deployment summary
- **Feature Highlights**: Show auto-detected features prominently
- **Quick Actions**: Easy access to logs, status, and controls

This spec provides complete implementation details for frontend teams to build intelligent, user-friendly vehicle app deployment interfaces that leverage all the new smart runtime capabilities.