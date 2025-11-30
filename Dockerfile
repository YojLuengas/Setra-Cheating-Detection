# Use official Python runtime as a parent image
FROM python:3.10-slim

# Install OS libraries required for OpenCV + MediaPipe
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port for Railway
EXPOSE 8000

# Start the app with Gunicorn + Flask-SocketIO
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
