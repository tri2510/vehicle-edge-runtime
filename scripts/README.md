# Vehicle Edge Runtime Scripts

This directory contains unified scripts for managing the Vehicle Edge Runtime system.

## Available Scripts

### setup.sh
Installs and configures Vehicle Edge Runtime with all dependencies.
Supports Ubuntu, Debian, and Raspberry Pi OS.

```bash
./scripts/setup.sh [--dev] [--force]
```

### runtime.sh
Manages Vehicle Edge Runtime services (start, stop, restart, status).

```bash
./scripts/runtime.sh [start|stop|restart|status|logs]
```

### deploy.sh
Docker-based deployment with profiles and service management.

```bash
./scripts/deploy.sh [deploy|stop|restart|logs|status|clean] [profile]
```

### dev.sh
Development tools and utilities.

```bash
./scripts/dev.sh [--help]
```

### cleanup.sh
Cleans up deployment artifacts and temporary files.

```bash
./scripts/cleanup.sh [--all] [--logs] [--deployments]
```

## Script Styles

All scripts follow Linux kernel coding style:
- Use tabs for indentation
- Functions are `lowercase_with_underscores()`
- Variables are `UPPER_CASE`
- Error handling with `set -e`
- Clear logging and status messages

## Quick Start

```bash
# Install dependencies
./scripts/setup.sh

# Start the runtime
./scripts/runtime.sh start

# Deploy with Docker
./scripts/deploy.sh deploy full
```