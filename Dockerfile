# Copyright (c) 2025 Eclipse Foundation.
#
# This program and the accompanying materials are made available under the
# terms of the MIT License which is available at
# https://opensource.org/licenses/MIT.
#
# SPDX-License-Identifier: MIT

# Multi-stage build for Vehicle Edge Runtime
FROM node:20-alpine AS build

# Install Docker CLI for container management
RUN apk add --no-cache \
    docker-cli \
    docker-compose

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S vehicle-edge -u 1001

# Production stage
FROM node:20-alpine

# Install Docker CLI for container management
RUN apk add --no-cache \
    docker-cli \
    curl \
    && rm -rf /var/cache/apk/*

# Create user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S vehicle-edge -u 1001

# Set the working directory
WORKDIR /app

# Copy node modules from build stage
COPY --from=build --chown=vehicle-edge:nodejs /app/node_modules ./node_modules

# Copy source code
COPY --chown=vehicle-edge:nodejs src/ ./src/

# Create data directories
RUN mkdir -p /app/data/applications /app/data/logs /app/data/configs && \
    chown -R vehicle-edge:nodejs /app/data

# Switch to non-root user
USER vehicle-edge

# Expose WebSocket and Health check ports
EXPOSE 3002 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

# Start the Vehicle Edge Runtime
CMD ["node", "src/index.js"]