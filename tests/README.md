# Vehicle Edge Runtime - Tests

## Quick Start

```bash
npm test                    # Run all tests
npm run test:docker         # Docker tests (sequential)
```

## Test Categories

- **Unit**: Core functionality tests
- **Integration**: WebSocket API tests
- **Docker**: Container, build, deployment tests
- **E2E**: Full application lifecycle tests

## Environment

```bash
KIT_MANAGER_URL=ws://localhost:3090
SKIP_KUKSA=true
```

## Requirements

- Node.js 18+
- Docker daemon
- Available ports 32000-32999