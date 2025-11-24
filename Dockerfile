# Use Python 3.10 slim for compatibility with mediapipe/opencv wheels
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .
RUN mkdir -p uploads models

# Expose port (Render will set PORT dynamically)
EXPOSE 8000

# Health check - use a fallback port for health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Use shell form to allow environment variable expansion
CMD gunicorn -k eventlet -w 1 --bind 0.0.0.0:$PORT app:app