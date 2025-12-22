# Frontend Implementation Guide: Binary & Docker Application Deployment

## Overview

This guide provides comprehensive instructions for implementing **Binary Application** and **Docker Container** deployment features in the frontend. The Vehicle Edge Runtime now supports three unified deployment types: Python, Binary, and Docker - all running through consistent Docker containers.

## 🚀 New Deployment Features

### 1. Binary Application Deployment
Deploy compiled binary applications with automatic Docker containerization.

### 2. Docker Container Deployment
Deploy existing Docker images or run custom Docker commands.

### 3. Enhanced Python Deployment (Updates)
Existing Python deployment now uses unified Docker approach with improved dependency management.

---

## 📡 API Specification

### Universal Smart Deployment API

**WebSocket Endpoint**: `ws://localhost:3002/runtime`

```javascript
// Request format for all deployment types
{
  "type": "smart_deploy",
  "id": "unique-request-id-" + Date.now(),
  "name": "Application Display Name",
  "deploymentType": "python" | "binary" | "docker",  // ⭐ NEW: Explicit deployment type
  "code": "string",                    // Python only: Source code
  "binaryUrl": "string",               // Binary only: Download URL
  "binaryFile": "string",              // Binary only: Base64 encoded binary data
  "runCommand": "string",              // Binary only: Command to execute
  "dockerImage": "string",             // Docker only: Image name
  "dockerCommand": ["string"],         // Docker only: Docker command array
  "dependencies": ["string"],          // Python only: Package dependencies
  "baseImage": "string",               // Optional: Custom base Docker image
  "pythonVersion": "string",           // Optional: Python version (default: 3.9)
  "ports": ["string"],                 // Optional: Port mappings
  "volumes": ["string"],               // Optional: Volume mappings
  "environment": "object",             // Optional: Environment variables
  "resources": "object"                // Optional: Resource limits
}
```

### Response Format (All Types)

```javascript
{
  "type": "smart_deploy-response",
  "id": "original-request-id",
  "app_id": "unique-app-id",
  "status": "success" | "failed",
  "auto_detected_dependencies": ["string"],     // Python only
  "signal_validation": {
    "valid": [Signal],
    "invalid": [Signal],
    "warnings": ["string"],
    "total": number
  },
  "deployment_id": "string",
  "timestamp": "ISO 8601 string"
}
```

---

## 🔧 Binary Application Implementation

### 1. Frontend Form Fields

```javascript
// Binary deployment form data structure
const binaryFormData = {
  name: "My Binary App",
  deploymentType: "binary",
  binaryUrl: "https://example.com/app-binary",     // OR
  binaryFile: "base64-encoded-binary-data",       // Direct upload
  runCommand: "./my-app",                        // Default: "./app"
  baseImage: "alpine:latest",                    // Optional: Custom base image
  environment: "production",
  ports: ["8080:8080"],                          // Optional: Port mappings
  dockerEnv: {                                   // Optional: Environment variables
    "NODE_ENV": "production"
  },
  resources: {                                   // Optional: Resource limits
    "memory": "512m",
    "cpu": "0.5"
  }
};
```

### 2. Binary Upload Handling

```javascript
// Handle binary file upload
async function handleBinaryFileUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const binaryData = e.target.result.split(',')[1]; // Base64
      resolve(binaryData);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Deploy binary application
async function deployBinaryApp(formData) {
  const ws = new WebSocket('ws://localhost:3002/runtime');

  ws.onopen = () => {
    const deployRequest = {
      type: 'smart_deploy',
      id: 'deploy-binary-' + Date.now(),
      ...formData
    };
    ws.send(JSON.stringify(deployRequest));
  };

  ws.onmessage = (event) => {
    const response = JSON.parse(event.data);
    if (response.type === 'smart_deploy-response') {
      handleBinaryDeploymentResponse(response);
    }
  };
}
```

### 3. Binary Deployment Progress

```javascript
// Binary deployment progress stages
const binaryDeploymentStages = {
  'installing_dependencies': 'Setting up binary environment...',
  'building_container': 'Building Docker image for binary...',
  'deploying_container': 'Deploying binary container...',
  'starting_container': 'Starting binary application...',
  'deployment_success': 'Binary deployed successfully!',
  'deployment_failed': 'Binary deployment failed'
};

// Handle binary-specific progress
function handleBinaryProgress(progress) {
  switch(progress.stage) {
    case 'building_container':
      updateProgressBar(25, 'Creating Docker image for binary...');
      break;
    case 'deploying_container':
      updateProgressBar(50, 'Deploying binary container...');
      break;
    case 'starting_container':
      updateProgressBar(75, 'Starting binary application...');
      break;
    case 'deployment_success':
      updateProgressBar(100, 'Binary app running successfully!');
      break;
  }
}
```

---

## 🐳 Docker Container Implementation

### 1. Frontend Form Fields

```javascript
// Docker deployment form data structure
const dockerFormData = {
  name: "My Docker App",
  deploymentType: "docker",
  dockerImage: "nginx:latest",                     // Option 1: Use existing image
  dockerCommand: [                                // Option 2: Custom Docker command
    "run", "-d",
    "--name", "my-nginx",
    "-p", "8080:80",
    "nginx:alpine"
  ],
  environment: "production",
  ports: ["8080:80"],                              // Optional: Additional ports
  volumes: ["/host/path:/container/path"],          // Optional: Volume mappings
  dockerEnv: {                                     // Optional: Environment variables
    "ENV_VAR": "value"
  }
};
```

### 2. Docker Deployment Types

**Type A: Existing Docker Image**
```javascript
const existingImageDeployment = {
  deploymentType: "docker",
  dockerImage: "nginx:latest",
  ports: ["8080:80"],
  environment: "production"
};
```

**Type B: Custom Docker Command**
```javascript
const customDockerCommand = {
  deploymentType: "docker",
  dockerCommand: [
    "run", "-d",
    "--name", "custom-app",
    "-p", "9090:8080",
    "-e", "NODE_ENV=production",
    "my-custom-image:latest"
  ]
};
```

### 3. Docker Deployment Implementation

```javascript
// Deploy Docker application
async function deployDockerApp(formData) {
  const ws = new WebSocket('ws://localhost:3002/runtime');

  ws.onopen = () => {
    const deployRequest = {
      type: 'smart_deploy',
      id: 'deploy-docker-' + Date.now(),
      ...formData
    };
    ws.send(JSON.stringify(deployRequest));
  };

  ws.onmessage = (event) => {
    const response = JSON.parse(event.data);
    if (response.type === 'smart_deploy-response') {
      handleDockerDeploymentResponse(response);
    }
  };
}
```

### 4. Docker Deployment Progress

```javascript
// Docker deployment progress stages
const dockerDeploymentStages = {
  'installing_dependencies': 'Preparing Docker environment...',
  'pulling_image': 'Pulling Docker image...',
  'deploying_container': 'Deploying Docker container...',
  'starting_container': 'Starting Docker container...',
  'deployment_success': 'Docker container running!',
  'deployment_failed': 'Docker deployment failed'
};

function handleDockerProgress(progress) {
  switch(progress.stage) {
    case 'pulling_image':
      updateProgressBar(25, 'Pulling Docker image...');
      break;
    case 'deploying_container':
      updateProgressBar(50, 'Deploying Docker container...');
      break;
    case 'starting_container':
      updateProgressBar(75, 'Starting Docker container...');
      break;
    case 'deployment_success':
      updateProgressBar(100, 'Docker container running successfully!');
      break;
  }
}
```

---

## 🐍 Python Deployment Updates (Enhanced)

### New Features for Existing Python Deployment

```javascript
// Enhanced Python deployment with new options
const enhancedPythonFormData = {
  name: "My Python App",
  deploymentType: "python",                          // ⭐ Explicit deployment type
  code: "import requests\nprint('Hello!')",
  dependencies: ["requests", "flask"],               // Auto-detected if empty
  baseImage: "python:3.9-slim",                     // Optional: Custom base image
  pythonVersion: "3.9",                             // Optional: Python version
  ports: ["8080:8080"],                             // Optional: Port mappings
  environment: "production",
  kuksa_config: {                                   // Kuksa integration
    "server": "localhost:55555",
    "tls": { "ca_cert": "/path/to/cert" }
  }
};
```

### Migration Notes for Existing Python Deployment

1. **No Breaking Changes**: Existing Python deployment continues to work
2. **Enhanced Reliability**: Now uses Docker containers for isolation
3. **Better Dependency Management**: Dependencies installed in containers
4. **Progress Tracking**: Real-time deployment progress available
5. **Resource Control**: Optional resource limits and environment variables

---

## 🎨 UI Implementation Guidelines

### 1. Deployment Type Selection

```javascript
// Deployment type selector component
const DeploymentTypeSelector = () => {
  const [deploymentType, setDeploymentType] = useState('python');

  return (
    <div className="deployment-type-selector">
      <label>Application Type:</label>
      <select value={deploymentType} onChange={(e) => setDeploymentType(e.target.value)}>
        <option value="python">🐍 Python Application</option>
        <option value="binary">⚙️ Binary Application</option>
        <option value="docker">🐳 Docker Container</option>
      </select>
    </div>
  );
};
```

### 2. Dynamic Form Fields

```javascript
// Dynamic form based on deployment type
const DynamicDeploymentForm = ({ deploymentType }) => {
  switch (deploymentType) {
    case 'python':
      return <PythonDeploymentForm />;
    case 'binary':
      return <BinaryDeploymentForm />;
    case 'docker':
      return <DockerDeploymentForm />;
    default:
      return <div>Invalid deployment type</div>;
  }
};
```

### 3. Progress Tracking UI

```javascript
// Universal deployment progress component
const DeploymentProgress = ({ progress }) => {
  const stages = {
    installing_dependencies: { icon: '📦', label: 'Installing dependencies' },
    building_container: { icon: '🔨', label: 'Building container' },
    deploying_container: { icon: '🚀', label: 'Deploying container' },
    starting_container: { icon: ▶️, label: 'Starting application' },
    deployment_success: { icon: ✅, label: 'Deployment successful' },
    deployment_failed: { icon: ❌, label: 'Deployment failed' }
  };

  return (
    <div className="deployment-progress">
      <ProgressBar progress={progress.progress || 0} />
      <div className="stage-info">
        {stages[progress.stage]?.icon} {stages[progress.stage]?.label}
      </div>
      {progress.error && <div className="error">Error: {progress.error}</div>}
    </div>
  );
};
```

---

## 📱 Mobile & Responsive Design

### 1. Touch-Friendly Controls

```css
/* Mobile-friendly deployment buttons */
.deploy-button {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 24px;
  font-size: 16px;
  border-radius: 8px;
}

/* Responsive form layout */
@media (max-width: 768px) {
  .deployment-form {
    padding: 16px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .deployment-type-selector {
    width: 100%;
  }
}
```

### 2. File Upload for Binary Apps

```javascript
// Binary file upload with mobile support
const BinaryFileUpload = () => {
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type and size
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        alert('File too large. Maximum size is 50MB.');
        return;
      }

      // Process binary file
      handleBinaryFileUpload(file);
    }
  };

  return (
    <div className="binary-upload">
      <input
        type="file"
        accept="application/octet-stream,application/x-executable"
        onChange={handleFileSelect}
        className="file-input"
      />
      <button className="upload-button">Choose Binary File</button>
    </div>
  );
};
```

---

## 🔄 Integration with Existing Features

### 1. App Management Integration

All three deployment types integrate with existing app management:

```javascript
// Universal app management
{
  "type": "list_deployed_apps",
  "id": "request-id"
}

// Response includes all app types
{
  "type": "list_deployed_apps-response",
  "applications": [
    {
      "app_id": "python-app-id",
      "type": "python",
      "status": "running"
    },
    {
      "app_id": "binary-app-id",
      "type": "binary",
      "status": "running"
    },
    {
      "app_id": "docker-app-id",
      "type": "docker",
      "status": "running"
    }
  ]
}
```

### 2. Lifecycle Management

All app types support the same lifecycle operations:

```javascript
// Start/Stop/Pause/Resume works for all types
{
  "type": "manage_app",
  "id": "request-id",
  "appId": "app-id",
  "action": "start" | "stop" | "pause" | "resume" | "remove"
}
```

---

## 🎯 Testing Guidelines

### 1. Binary App Testing

```javascript
// Test binary deployment
const testBinaryDeployment = {
  deploymentType: "binary",
  name: "Test Binary App",
  binaryUrl: "https://github.com/example/releases/download/v1.0/app-linux",
  runCommand: "./app",
  environment: "production"
};
```

### 2. Docker App Testing

```javascript
// Test Docker deployment
const testDockerDeployment = {
  deploymentType: "docker",
  name: "Test Nginx",
  dockerImage: "nginx:alpine",
  ports: ["8080:80"],
  environment: "production"
};
```

### 3. Progress Testing

Monitor WebSocket messages for progress updates:

```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'deployment_progress') {
    console.log('Progress:', message.stage, message.details);
    updateProgressBar(message.details.progress);
  }
};
```

---

## ⚠️ Important Considerations

### 1. Error Handling

```javascript
// Handle deployment failures
function handleDeploymentError(response) {
  const error = response.error;
  const suggestions = response.suggestions || [];

  console.error('Deployment failed:', error);

  // Show user-friendly error message
  alert(`Deployment failed: ${error}\n\nSuggestions:\n${suggestions.join('\n')}`);
}
```

### 2. File Size Limits

- Binary uploads: Maximum 50MB (configurable)
- Code uploads: Maximum 1MB for Python files
- Large files: Use URL download instead of upload

### 3. Security Considerations

- Validate binary file types
- Sanitize Docker commands
- Rate limit deployment requests
- Use secure file upload mechanisms

---

## 🚀 Quick Start Implementation

### 1. Add Deployment Type Selector

```html
<select id="deploymentType">
  <option value="python">Python Application</option>
  <option value="binary">Binary Application</option>
  <option value="docker">Docker Container</option>
</select>
```

### 2. Create Dynamic Forms

```javascript
function showDeploymentForm(type) {
  const forms = {
    python: document.getElementById('pythonForm'),
    binary: document.getElementById('binaryForm'),
    docker: document.getElementById('dockerForm')
  };

  // Hide all forms
  Object.values(forms).forEach(form => form.style.display = 'none');

  // Show selected form
  if (forms[type]) {
    forms[type].style.display = 'block';
  }
}
```

### 3. Implement Smart Deploy

```javascript
async function smartDeploy(formData) {
  const ws = new WebSocket('ws://localhost:3002/runtime');

  ws.onopen = () => {
    const request = {
      type: 'smart_deploy',
      id: 'deploy-' + Date.now(),
      ...formData
    };
    ws.send(JSON.stringify(request));
  };

  // Handle responses and progress...
}
```

---

This guide provides everything needed to implement Binary and Docker application deployment in the frontend while maintaining compatibility with existing Python deployment functionality.