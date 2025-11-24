# Use Python 3.10 slim for compatibility with mediapipe/opencv wheels
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies for opencv
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
    pip install -r requirements.txt

# Copy application
COPY . .
RUN mkdir -p uploads models templates static

# Use a startup script that properly handles eventlet
RUN echo '#!/bin/bash\nPORT=${PORT:-8000}\necho "Starting on port $PORT"\nexec python app.py' > /start.sh
RUN chmod +x /start.sh

EXPOSE 8000

CMD ["/start.sh"]