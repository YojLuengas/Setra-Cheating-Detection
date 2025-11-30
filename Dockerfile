FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required for OpenCV
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

# Run using Gunicorn + Eventlet for WebSockets (SocketIO support)
CMD ["gunicorn", "-k", "eventlet", "-w", "1", "-b", "0.0.0.0:8080", "app:app"]
