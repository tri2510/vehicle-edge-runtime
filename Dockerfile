# Copyright (c) 2025 Eclipse Foundation.
#
# This program and the accompanying materials are made available under the
# terms of the MIT License which is available at
# https://opensource.org/licenses/MIT.
#
# SPDX-License-Identifier: MIT

# Vehicle Edge Runtime - Production Dockerfile
# Single optimized build for edge deployment

FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    docker-cli \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user with Docker group access
# Add to root group (GID 0) to ensure Docker socket access across all systems
# Docker socket is always owned by root, so this works universally
RUN addgroup -g 1001 -S nodejs && \
    (addgroup -g 999 -S docker 2>/dev/null || addgroup -S docker) && \
    adduser -S vehicle-edge -u 1001 -G nodejs && \
    adduser vehicle-edge docker && \
    adduser vehicle-edge root

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --omit=dev && npm cache clean --force

# Copy source code and proto files
COPY --chown=vehicle-edge:nodejs src/ ./src/
COPY --chown=vehicle-edge:nodejs proto/ ./proto/

# Copy VSS Python library generator (for vehicle signal library)
COPY --chown=vehicle-edge:nodejs vss-python-library-generator/ ./vss-python-library-generator/

# Create data directories
RUN mkdir -p /app/data/applications /app/data/logs /app/data/configs && \
    chown -R vehicle-edge:nodejs /app/data

# Switch to non-root user
USER vehicle-edge

# Expose ports
EXPOSE 3002 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

# Start the Vehicle Edge Runtime
CMD ["node", "src/index.js"]