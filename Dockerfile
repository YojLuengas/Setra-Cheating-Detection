# Use Python 3.10 slim for compatibility with mediapipe/opencv wheels
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install additional packages needed for your app
RUN pip install --no-cache-dir \
    opencv-python-headless \
    mediapipe \
    torch \
    torchvision \
    ultralytics

# Copy application
COPY . .
RUN mkdir -p uploads models

# Create a more robust startup script
RUN echo '#!/bin/bash\n\
PORT=${PORT:-8000}\n\
echo "Starting application on port $PORT"\n\
echo "Python version: $(python --version)"\n\
echo "Installed packages:"\n\
pip list | grep -E "(flask|torch|opencv|ultralytics|mediapipe)"\n\
echo "Starting gunicorn..."\n\
exec gunicorn -k eventlet -w 1 --bind 0.0.0.0:$PORT --timeout 120 --log-level info app:app' > /start.sh

RUN chmod +x /start.sh

EXPOSE 8000

CMD ["/start.sh"]