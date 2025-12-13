# Vehicle Edge Runtime

A simplified application execution environment for Eclipse Autowrx applications, providing edge computing capabilities for vehicle systems.

## Features

- **Application Management**: Deploy, monitor, and manage vehicle applications
- **Docker Integration**: Containerized application execution with resource management
- **WebSocket API**: Real-time communication and control interface
- **Kuksa Integration**: Vehicle signal access and management
- **SQLite Persistence**: Application state and configuration storage
- **Health Monitoring**: Runtime health checks and status reporting

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- Docker (for containerized applications)
- SQLite3

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd vehicle-edge-runtime

# Install dependencies
npm install
```

### Running the Runtime

```bash
# Development mode
npm run dev

# Production mode
npm start

# With custom configuration
npm start -- --port 3002 --log-level debug
```

## Configuration

The runtime can be configured using environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3002 | WebSocket server port |
| `DATA_DIR` | `./data` | Data storage directory |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `KUKSA_ENABLED` | `false` | Enable Kuksa integration |
| `KUKSA_HOST` | `localhost` | Kuksa server host |
| `KUKSA_GRPC_PORT` | `55555` | Kuksa gRPC port |

## API

### WebSocket Messages

The runtime exposes a WebSocket API for application management. Key message types include:

- `deploy_request`: Deploy a new application
- `app_status_request`: Get application status
- `stop_app_request`: Stop a running application
- `list_apps_request`: List all applications

Example deployment request:
```json
{
  "type": "deploy_request",
  "code": "print('Hello Vehicle!')",
  "language": "python",
  "name": "My Vehicle App"
}
```

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:docker

# Run linting
npm run lint
npm run lint:fix
```

## Docker Support

```bash
# Build Docker image
npm run docker:build

# Run with Docker Compose
npm run docker:up

# View logs
npm run docker:logs
```

## Project Structure

```
vehicle-edge-runtime/
├── src/
│   ├── api/           # WebSocket API handlers
│   ├── apps/          # Application management
│   ├── console/       # Console interface
│   ├── core/          # Core runtime components
│   ├── database/      # Database management
│   ├── utils/         # Utility functions
│   ├── vehicle/       # Vehicle-specific integrations
│   └── index.js       # Main entry point
├── tests/             # Test suites
├── data/              # Runtime data directory
├── examples/          # Example applications
└── scripts/           # Helper scripts
```

## License

Apache-2.0 License

## Contributing

Please see the contributing guidelines and code of conduct in the repository.