# Copyright (c) 2025 Eclipse Foundation.
#
# This program and the accompanying materials are made available under the
# terms of the MIT License which is available at
# https://opensource.org/licenses/MIT.
#
# SPDX-License-Identifier: MIT

FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kit-manager -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy source code
COPY src/ ./src/
COPY configs.js ./

# Install dependencies
RUN npm install

# Create data directory
RUN mkdir -p /app/data && \
    chown -R kit-manager:nodejs /app

# Switch to non-root user
USER kit-manager

# Expose Kit-Manager port
EXPOSE 3090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3090/listAllKits', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start Kit-Manager
CMD ["npm", "start"]