# Vehicle Edge Runtime - Smart UX Guide

## Overview
The Vehicle Edge Runtime now provides intelligent, user-friendly deployment capabilities that dramatically simplify vehicle application development and deployment.

## 🚀 Smart Deployment Features

### 1. One-Click Smart Deployment
Deploy applications with automatic dependency detection and validation:

```javascript
// WebSocket message for smart deployment
{
  "type": "smart_deploy",
  "id": "speed-display-app",
  "name": "Speed Display Application",
  "type": "python",
  "code": `
import asyncio
from kuksa_client import KuksaClient

async def main():
    async with KuksaClient() as client:
        await client.subscribe("Vehicle.Speed")
        # Your application logic here

if __name__ == "__main__":
    asyncio.run(main())
  `,
  "signals": ["Vehicle.Speed"],
  "environment": "production"
}
```

**✅ Runtime automatically**:
- Detects `kuksa-client` dependency
- Validates vehicle signal availability
- Installs Python packages
- Configures KUKSA connection
- Starts application with proper environment

### 2. Dependency Auto-Detection
Let the runtime analyze your code and detect required packages:

```javascript
// Request dependency analysis
{
  "type": "detect_dependencies",
  "code": `
import pandas as pd
import numpy as np
from kuksa_client import KuksaClient
import requests
`,
  "language": "python"
}

// Response
{
  "type": "dependencies_detected",
  "dependencies": [
    "pandas",
    "numpy",
    "kuksa-client",
    "requests"
  ],
  "count": 4
}
```

### 3. Vehicle Signal Validation
Validate signal availability before deployment:

```javascript
// Request signal validation
{
  "type": "validate_signals",
  "signals": [
    "Vehicle.Speed",
    {
      "path": "Vehicle.Powertrain.TorqueAtTransmission",
      "access": "subscribe",
      "rate_hz": 10
    }
  ]
}

// Response
{
  "type": "signals_validated",
  "validation": {
    "valid": [
      {
        "path": "Vehicle.Speed",
        "access": "subscribe"
      },
      {
        "path": "Vehicle.Powertrain.TorqueAtTransmission",
        "access": "subscribe",
        "rate_hz": 10
      }
    ],
    "invalid": [],
    "warnings": [],
    "total": 2
  }
}
```

### 4. Real-time Deployment Progress
Monitor deployment stages with live progress updates:

```javascript
// Progress updates automatically streamed via WebSocket
{
  "type": "deployment_progress",
  "app_id": "speed-display-app",
  "stage": "installing_dependencies",
  "details": {
    "dependency": "kuksa-client",
    "current": 1,
    "total": 2,
    "progress": 50
  }
}

{
  "type": "deployment_progress",
  "app_id": "speed-display-app",
  "stage": "starting_application",
  "details": {
    "progress": 100
  }
}
```

### 5. Comprehensive Error Handling
Get actionable error messages with solutions:

```javascript
// Error response with suggestions
{
  "type": "error",
  "error": "Smart deployment failed: ImportError: No module named 'kuksa-client'",
  "suggestions": [
    "Try: pip install kuksa-client",
    "Ensure KUKSA server is running"
  ]
}
```

## 🎯 Frontend Implementation Guide

### Smart Deployment Form
Create an intuitive deployment interface:

```html
<form id="smartDeployForm">
  <div class="form-group">
    <label>Application ID</label>
    <input type="text" name="appId" placeholder="speed-display" required>
  </div>

  <div class="form-group">
    <label>Application Name</label>
    <input type="text" name="name" placeholder="Speed Display Application">
  </div>

  <div class="form-group">
    <label>Python Code</label>
    <textarea name="code" rows="10" placeholder="Paste your Python code here..." required></textarea>
  </div>

  <!-- Auto-detected dependencies -->
  <div class="form-group">
    <label>Dependencies <span class="auto-detected">(Auto-detected)</span></label>
    <div id="dependenciesList" class="tags-container">
      <!-- Auto-populated via detect_dependencies API -->
    </div>
    <button type="button" id="detectDeps">Detect Dependencies</button>
  </div>

  <!-- Vehicle signal selector -->
  <div class="form-group">
    <label>Vehicle Signals</label>
    <div id="signalsList" class="signals-container">
      <select multiple id="signalsSelect">
        <!-- Populated from available signals -->
      </select>
    </div>
    <button type="button" id="validateSignals">Validate Signals</button>
  </div>

  <!-- Environment selection -->
  <div class="form-group">
    <label>Environment</label>
    <select name="environment">
      <option value="development">Development (Mock Data)</option>
      <option value="staging">Staging (Test KUKSA)</option>
      <option value="production">Production (Live Vehicle)</option>
    </select>
  </div>

  <!-- Deployment controls -->
  <div class="form-actions">
    <button type="submit" id="deployBtn">🚀 Deploy Application</button>
    <button type="button" id="cancelBtn">Cancel</button>
  </div>
</form>
```

### JavaScript Frontend Logic

```javascript
class SmartDeploymentUI {
  constructor(wsClient) {
    this.ws = wsClient;
    this.setupEventHandlers();
    this.setupWebSocketHandlers();
  }

  setupEventHandlers() {
    // Auto-detect dependencies when code changes
    document.querySelector('[name="code"]').addEventListener('input',
      this.debounce(() => this.detectDependencies(), 1000)
    );

    // Validate signals on change
    document.getElementById('signalsSelect').addEventListener('change',
      this.debounce(() => this.validateSignals(), 500)
    );

    // Handle deployment
    document.getElementById('smartDeployForm').addEventListener('submit',
      (e) => this.handleSmartDeploy(e)
    );
  }

  setupWebSocketHandlers() {
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch(message.type) {
        case 'dependencies_detected':
          this.displayDependencies(message.dependencies);
          break;

        case 'signals_validated':
          this.displaySignalValidation(message.validation);
          break;

        case 'deployment_progress':
          this.updateDeploymentProgress(message);
          break;

        case 'smart_deploy-response':
          this.handleDeploymentSuccess(message);
          break;

        case 'error':
          this.handleDeploymentError(message);
          break;
      }
    };
  }

  detectDependencies() {
    const code = document.querySelector('[name="code"]').value;
    if (!code.trim()) return;

    this.ws.send(JSON.stringify({
      type: 'detect_dependencies',
      code: code,
      language: 'python'
    }));
  }

  validateSignals() {
    const signals = Array.from(document.getElementById('signalsSelect').selectedOptions)
      .map(option => option.value);

    if (signals.length === 0) return;

    this.ws.send(JSON.stringify({
      type: 'validate_signals',
      signals: signals
    }));
  }

  handleSmartDeploy(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const selectedSignals = Array.from(document.getElementById('signalsSelect').selectedOptions)
      .map(option => option.value);

    const deployment = {
      type: 'smart_deploy',
      id: formData.get('appId'),
      name: formData.get('name'),
      type: 'python',
      code: formData.get('code'),
      signals: selectedSignals,
      environment: formData.get('environment')
    };

    this.ws.send(JSON.stringify(deployment));
    this.showDeploymentProgress();
  }

  displayDependencies(dependencies) {
    const container = document.getElementById('dependenciesList');
    container.innerHTML = dependencies.map(dep =>
      `<span class="dependency-tag">${dep}</span>`
    ).join('');

    // Show auto-detected indicator
    if (dependencies.length > 0) {
      container.classList.add('auto-detected');
    }
  }

  displaySignalValidation(validation) {
    const container = document.getElementById('signalsList');

    if (validation.invalid.length > 0) {
      container.classList.add('has-errors');
      container.innerHTML += `
        <div class="validation-errors">
          Invalid signals: ${validation.invalid.join(', ')}
        </div>
      `;
    } else {
      container.classList.remove('has-errors');
      container.classList.add('validated');
    }
  }

  updateDeploymentProgress(message) {
    const progress = document.getElementById('deploymentProgress');
    const details = message.details;

    switch(message.stage) {
      case 'installing_dependencies':
        progress.innerHTML = `
          <div class="progress-stage">
            📦 Installing dependencies: ${details.current}/${details.total}
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${details.progress}%"></div>
            </div>
          </div>
        `;
        break;

      case 'installing_dependency':
        progress.innerHTML += `
          <div class="dependency-progress">
            ✓ Installing ${details.dependency}
          </div>
        `;
        break;

      case 'starting_application':
        progress.innerHTML += `
          <div class="progress-stage success">
            🚀 Starting application...
          </div>
        `;
        break;
    }
  }

  handleDeploymentSuccess(response) {
    document.getElementById('deploymentProgress').innerHTML = `
      <div class="deployment-success">
        ✅ Application deployed successfully!
        <div class="deployment-details">
          App ID: ${response.app_id}<br>
          Auto-detected dependencies: ${response.auto_detected_dependencies.join(', ')}<br>
          Signals validated: ${response.signal_validation.valid.length}/${response.signal_validation.total}
        </div>
      </div>
    `;
  }

  handleDeploymentError(error) {
    document.getElementById('deploymentProgress').innerHTML = `
      <div class="deployment-error">
        ❌ Deployment failed: ${error.error}
        <div class="error-suggestions">
          <strong>Suggestions:</strong>
          <ul>
            ${error.suggestions.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Initialize the smart deployment UI
const wsClient = new WebSocket('ws://localhost:8080');
const deploymentUI = new SmartDeploymentUI(wsClient);
```

### CSS Styling

```css
.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.auto-detected {
  background-color: #e8f5e8;
  border: 1px solid #4caf50;
  padding: 0.5rem;
  border-radius: 4px;
}

.dependency-tag {
  display: inline-block;
  background-color: #2196f3;
  color: white;
  padding: 0.25rem 0.5rem;
  margin: 0.25rem;
  border-radius: 12px;
  font-size: 0.875rem;
}

.signals-container.validated {
  border-color: #4caf50;
  background-color: #e8f5e8;
}

.signals-container.has-errors {
  border-color: #f44336;
  background-color: #ffebee;
}

.validation-errors {
  color: #f44336;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.progress-stage {
  padding: 0.5rem;
  margin: 0.25rem 0;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.progress-stage.success {
  background-color: #e8f5e8;
  color: #2e7d32;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #ddd;
  border-radius: 4px;
  margin-top: 0.5rem;
}

.progress-fill {
  height: 100%;
  background-color: #4caf50;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.deployment-success {
  padding: 1rem;
  background-color: #e8f5e8;
  border: 1px solid #4caf50;
  border-radius: 4px;
  color: #2e7d32;
}

.deployment-error {
  padding: 1rem;
  background-color: #ffebee;
  border: 1px solid #f44336;
  border-radius: 4px;
  color: #c62828;
}

.error-suggestions {
  margin-top: 1rem;
  font-size: 0.875rem;
}

.error-suggestions ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

#deployBtn {
  background-color: #4caf50;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
}

#deployBtn:hover {
  background-color: #45a049;
}

#cancelBtn {
  background-color: #f5f5f5;
  color: #333;
  padding: 0.75rem 1.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}
```

## 📱 User Experience Flow

### 1. Code Input & Auto-Detection
- User pastes Python code
- Runtime automatically detects `kuksa-client`, `pandas`, etc.
- Dependencies displayed as tags with auto-detected indicator

### 2. Signal Selection & Validation
- User selects vehicle signals from dropdown
- Runtime validates signal availability in real-time
- Invalid signals highlighted with error messages

### 3. One-Click Deployment
- User clicks "Deploy Application"
- Progress bar shows: Dependencies → Validation → Installation → Startup
- Live progress updates streamed via WebSocket

### 4. Success Confirmation
- Green success message with deployment details
- Auto-detected dependencies highlighted
- Signal validation summary displayed

### 5. Error Recovery
- Red error message with specific failure details
- Actionable suggestions provided automatically
- Context-aware help for common issues

## 🎯 Key UX Benefits

### **Simplified Deployment**
- **Zero configuration** required for basic KUKSA apps
- **Auto-detection** eliminates manual dependency management
- **Real-time feedback** reduces deployment anxiety

### **Intelligent Assistance**
- **Smart suggestions** based on error patterns
- **Signal validation** prevents runtime failures
- **Progress monitoring** provides deployment transparency

### **Developer Productivity**
- **One-click deployment** for common vehicle app patterns
- **Live validation** catches issues early
- **Contextual help** reduces troubleshooting time

This smart UX transforms vehicle app deployment from a complex, error-prone process into a seamless, guided experience that enables developers to focus on application logic rather than infrastructure setup.