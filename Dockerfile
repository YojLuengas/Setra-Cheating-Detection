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

# Create a more detailed startup script with error handling
RUN echo '#!/bin/bash
set -e
PORT=${PORT:-8000}
echo "=== Starting Setra Cheating Detection ==="
echo "PORT: $PORT"
echo "PYTHONPATH: $PYTHONPATH"
echo "Working directory: $(pwd)"
echo "Files in directory:"
ls -la
echo "=== Testing Python import ==="
python -c "
try:
    import app
    print(\"✅ App import successful\")
except Exception as e:
    print(f\"❌ App import failed: {e}\")
    import traceback
    traceback.print_exc()
    exit(1)
"
echo "=== Starting gunicorn ==="
exec gunicorn -k eventlet -w 1 --bind 0.0.0.0:$PORT --log-level debug --error-logfile - --access-logfile - app:app
' > /start.sh

RUN chmod +x /start.sh

EXPOSE 8000

CMD ["/start.sh"]