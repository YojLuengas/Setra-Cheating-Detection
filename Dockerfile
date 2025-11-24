# Use Python 3.10 slim for compatibility with mediapipe/opencv wheels
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements (without PyTorch)
COPY requirements.txt .

# Install packages without PyTorch first
RUN pip install --upgrade pip && \
    pip install flask==2.3.3 \
    flask-socketio==5.3.6 \
    python-socketio==5.8.0 \
    eventlet==0.33.3 \
    gunicorn==21.2.0 \
    mysql-connector-python==8.1.0 \
    python-dotenv==1.0.0 \
    bcrypt==4.0.1 \
    requests==2.31.0 \
    numpy==1.24.3 \
    Pillow==10.0.0 \
    opencv-python-headless==4.7.0.72

# Install PyTorch CPU version separately
RUN pip install torch==2.0.1+cpu torchvision==0.15.2+cpu -f https://download.pytorch.org/whl/torch_stable.html

# Install ultralytics after PyTorch
RUN pip install ultralytics==8.0.181

# Copy application
COPY . .
RUN mkdir -p uploads models

# Use a startup script that handles the PORT variable
RUN echo '#!/bin/bash\nPORT=${PORT:-8000}\necho "Starting on port $PORT"\nexec gunicorn -k eventlet -w 1 --bind 0.0.0.0:$PORT app:app' > /start.sh
RUN chmod +x /start.sh

EXPOSE 8000

CMD ["/start.sh"]