# Vehicle Edge Runtime - Mock Service Dockerfile
# Provides mock vehicle signal data for testing/development

FROM python:3.10-slim

# Metadata
LABEL maintainer="Vehicle Edge Runtime Team"
LABEL description="Mock service for vehicle signal simulation"

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        python3-dev \
        && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy mock service files
COPY mockservice.py .
COPY mock.py .
COPY mockprovider.py .
COPY signals.json .
COPY lib/ ./lib/

# Create non-root user
RUN useradd -m -u 1001 mock && \
    chown -R mock:mock /app

# Switch to non-root user
USER mock

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV MOCK_IDLE_THRESHOLD=30.0
ENV MOCK_BASE_SLEEP=0.1
ENV MOCK_IDLE_SLEEP=1.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import sys; sys.exit(0)" || exit 1

# Run the mock service
CMD ["python", "mockservice.py"]
