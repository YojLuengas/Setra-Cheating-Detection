import eventlet
eventlet.monkey_patch()

import os
import io
import base64
import time
import uuid
import cv2
import numpy as np
from PIL import Image
from datetime import datetime
from functools import wraps
from threading import Lock
import logging
import sys

from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    session,
    flash,
    jsonify,
    send_file,
    abort,
    Response,
)
from flask_socketio import SocketIO, emit
import mysql.connector
import bcrypt

print(f"Python version: {sys.version}")
print("Starting Flask application...")

# Try to import ML libraries, but handle if they're not available
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("⚠️ YOLO not available - running without ML detection")

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    print("⚠️ MediaPipe not available - running without face detection")

# ---------- App Configuration ----------
app = Flask(__name__)

# Single source of configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fallback-secret-key-change-in-production')
app.config['DEBUG'] = os.environ.get('DEBUG', 'False').lower() == 'true'

# Single database configuration
DB_CONFIG = {
    "host": os.environ.get("MYSQL_HOST", "localhost"),
    "user": os.environ.get("MYSQL_USER", "root"), 
    "password": os.environ.get("MYSQL_PASSWORD", ""),
    "database": os.environ.get("MYSQL_DATABASE", "railway"),
    "port": int(os.environ.get("MYSQL_PORT", 3306)),
    "charset": "utf8mb4",
}

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection with error handling
try:
    db = mysql.connector.connect(**DB_CONFIG)
    cursor = db.cursor(buffered=True)
    logger.info(f"✅ Connected to database: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
except Exception as e:
    logger.error(f"❌ Database connection failed: {e}")
    # Don't exit - let the app start without DB for health checks
    db = None
    cursor = None

# ---------- ML Models (Optional) ----------
yolo_model = None
face_mesh = None

# Try to load YOLO model
if YOLO_AVAILABLE:
    try:
        model_path = "models/best.pt"
        if os.path.exists(model_path):
            yolo_model = YOLO(model_path)
            logger.info("✅ YOLO model loaded successfully")
        else:
            logger.warning(f"⚠️ YOLO model not found at {model_path}")
    except Exception as e:
        logger.error(f"❌ Failed to load YOLO model: {e}")

# Try to initialize MediaPipe
if MEDIAPIPE_AVAILABLE:
    try:
        face_mesh = mp.solutions.face_mesh.FaceMesh(
            max_num_faces=1, 
            refine_landmarks=True, 
            min_detection_confidence=0.5, 
            min_tracking_confidence=0.5
        )
        logger.info("✅ MediaPipe initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize MediaPipe: {e}")

# ---------- Global Variables ----------
all_snapshots = []
notified_snapshots = []
last_cheating_notification_time = 0
consecutive_cheating_frames = 0
consecutive_non_cheating_frames = 0
stable_cheating = False
frame_lock = Lock()

PROCESS_INTERVAL = 0.50
OUT_IMG_MAX = 640
_last_processed_time = 0.0

# ---------- Health Check (Required for Render) ----------
@app.route('/health')
def health_check():
    """Health check endpoint required by Render"""
    db_status = "unknown"
    
    if cursor:
        try:
            cursor.execute("SELECT 1")
            db_status = "healthy"
        except Exception as e:
            db_status = f"unhealthy: {str(e)}"
    else:
        db_status = "not_connected"
    
    return jsonify({
        'status': 'healthy',
        'database': db_status,
        'yolo_available': YOLO_AVAILABLE and yolo_model is not None,
        'mediapipe_available': MEDIAPIPE_AVAILABLE and face_mesh is not None,
        'port': os.environ.get('PORT', 'not-set'),
        'timestamp': datetime.now().isoformat()
    }), 200

# ---------- Basic Routes ----------
@app.route('/')
def home():
    """Home route - works without login for testing"""
    if "user_id" in session:
        return render_template("index.html", username=session.get("username"))
    else:
        return "Setra Cheating Detection System - Server Running! Please login to access features."

# ---------- Helper Functions ----------
def b64_to_cv2(data_b64):
    """Convert base64 to OpenCV image"""
    try:
        if "," in data_b64:
            _, b64 = data_b64.split(",", 1)
        else:
            b64 = data_b64
        img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
        return np.array(img)[:, :, ::-1].copy()  # RGB->BGR
    except Exception as e:
        logger.exception("b64_to_cv2 error: %s", e)
        return None

def process_binary_image(binary_data):
    """Convert binary image data to BGR numpy array."""
    try:
        nparr = np.frombuffer(binary_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.exception("process_binary_image error: %s", e)
        return None

def detect_cheating_fallback(frame):
    """Simple fallback detection when ML models are not available"""
    # For now, just return no cheating
    return False, "ML models not available", []

# ---------- SocketIO Handlers ----------
@socketio.on("connect")
def on_connect():
    emit("connected", {"data": "ready"})

@socketio.on("frame")
def handle_frame(message):
    """Process incoming frames with error handling"""
    global all_snapshots, notified_snapshots, last_cheating_notification_time
    global _last_processed_time

    if not frame_lock.acquire(blocking=False):
        return

    try:
        now = time.time()
        if now - _last_processed_time < PROCESS_INTERVAL:
            return

        _last_processed_time = now

        # Process frame
        if isinstance(message, bytes):
            frame = process_binary_image(message)
        else:
            frame = b64_to_cv2(message)

        if frame is None:
            return

        # Simple processing without ML if models not available
        cheating_detected = False
        
        if yolo_model is not None:
            try:
                # Your existing YOLO processing code here
                pass
            except Exception as e:
                logger.error(f"YOLO processing error: {e}")
        
        # Emit response
        emit("response_frame", {
            "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
            "cheating": cheating_detected
        })

    except Exception as e:
        logger.exception(f"Frame processing error: {e}")
    finally:
        try:
            frame_lock.release()
        except Exception:
            pass

# Add your other routes here but make them handle missing DB gracefully
# For now, let's add a minimal working set

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            flash("Please login to access that page.", "warning")
            return redirect(url_for("login", next=request.path))
        return f(*args, **kwargs)
    return decorated_function

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        # Simple test login for now
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        
        if username == "admin" and password == "admin":
            session.update({"user_id": 1, "username": username, "role": "admin"})
            return redirect(url_for("home"))
        else:
            flash("Invalid credentials. Try admin/admin", "danger")
    
    return render_template("login.html") if os.path.exists("templates/login.html") else "Login page not found"

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

# Error handling
if __name__ == "__main__":
    try:
        app.run(host='0.0.0.0', port=8000, debug=False)
    except Exception as e:
        print(f"Error starting app: {e}")
        raise