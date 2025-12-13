# Vehicle Edge Runtime - Tests

## Quick Start

### Local Services (Recommended)
```bash
# Start local services
./simulation/6-start-kuksa-server.sh
./simulation/1-start-kit-manager.sh

# Run tests
npm test
```

### External Kit Manager
```bash
# Set external Kit Manager (https://kit.digitalauto.tech)
export KIT_MANAGER_URL=https://kit.digitalauto.tech

# Run tests (Kit Manager connection will be skipped gracefully)
npm test
```

## Test Results

- **Local services**: 54/54 tests pass (100%)
- **External Kit Manager**: 53/54 tests pass (98%) - Kit Manager connection skipped

## Environment Variables

- `KIT_MANAGER_URL`: Local (`ws://localhost:3090`) or External (`https://kit.digitalauto.tech`)
- `SKIP_KIT_MANAGER`: Set to `true` to skip Kit Manager entirely
- `KUKSA_ENABLED`: Set to `true` for Kuksa integration