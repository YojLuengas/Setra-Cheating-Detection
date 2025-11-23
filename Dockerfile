# Use Python 3.10 slim for compatibility with mediapipe/opencv wheels
FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

# system deps for opencv / mediapipe and building some packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    pkg-config \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 libxrender1 libxext6 \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# copy project files early for caching
COPY requirements.txt .
# upgrade pip/wheel first
RUN pip install --upgrade pip setuptools wheel
# install dependencies (mediapipe may be large; ensure Python 3.10)
RUN pip install -r requirements.txt

# copy app
COPY . .

# expose port (app uses 8000 inside container)
EXPOSE 8000

# run with gunicorn + eventlet (SocketIO)
CMD ["gunicorn", "-k", "eventlet", "-w", "1", "--bind", "0.0.0.0:8000", "app:app"]