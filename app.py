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
        import torch
        # Add safe globals for ultralytics
        torch.serialization.add_safe_globals([
            'ultralytics.nn.tasks.DetectionModel',
            'ultralytics.nn.modules.Conv',
            'ultralytics.nn.modules.C2f',
            'ultralytics.nn.modules.SPPF',
            'ultralytics.nn.modules.Detect'
        ])
        
        yolo_model = YOLO('yolov8n.pt')
        logger.info("✅ YOLO model loaded successfully")
    except Exception as e:
        logger.error(f"❌ Failed to load YOLO model: {e}")
        yolo_model = None
        YOLO_AVAILABLE = False

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
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        
        if not cursor:
            # Fallback for testing
            if username == "admin" and password == "admin":
                session.update({"user_id": 1, "username": username, "role": "admin"})
                if username == "admin":
                    return redirect(url_for("admin_page"))
                return redirect(url_for("home"))
            else:
                flash("Invalid credentials or database unavailable", "danger")
        else:
            try:
                cursor.execute("SELECT id, username, password_hash, role FROM users WHERE username = %s", (username,))
                user = cursor.fetchone()
                
                if user and bcrypt.checkpw(password.encode('utf-8'), user[2].encode('utf-8')):
                    session.update({
                        "user_id": user[0], 
                        "username": user[1], 
                        "role": user[3]
                    })
                    if user[3] == "admin":
                        return redirect(url_for("admin_page"))
                    return redirect(url_for("home"))
                else:
                    flash("Invalid credentials", "danger")
            except Exception as e:
                logger.error(f"Login error: {e}")
                flash("Login error", "danger")
    
    return render_template("login.html") if os.path.exists("templates/login.html") else "Login page not found"

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

# Add these missing routes after your existing routes:

@app.route("/admin")
@login_required
def admin_page():
    if not cursor:
        return "Database not available", 500
    
    try:
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'Active'")
        active_users = cursor.fetchone()[0]
        
        inactive_users = total_users - active_users
        
        cursor.execute("SELECT username, role, status FROM users LIMIT 5")
        users_preview = cursor.fetchall()
        
        return render_template("admin.html", 
                             total_users=total_users,
                             active_users=active_users, 
                             inactive_users=inactive_users,
                             users_preview=users_preview,
                             show_sidebar=True)
    except Exception as e:
        logger.error(f"Admin page error: {e}")
        return "Database error", 500

@app.route("/add_user", methods=["GET", "POST"])
@login_required
def add_user():
    if request.method == "POST":
        if not cursor:
            flash("Database not available", "danger")
            return redirect(url_for("add_user"))
        
        try:
            name = request.form.get("name")
            username = request.form.get("username")
            password = request.form.get("password")
            
            # Hash password
            hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            
            cursor.execute(
                "INSERT INTO users (name, username, password_hash, role, status, created_by) VALUES (%s, %s, %s, %s, %s, %s)",
                (name, username, hashed.decode('utf-8'), 'user', 'Active', session.get('username'))
            )
            db.commit()
            
            flash("User added successfully!", "success")
            return redirect(url_for("list_users"))
            
        except mysql.connector.IntegrityError:
            flash("Username already exists!", "danger")
        except Exception as e:
            flash(f"Error adding user: {str(e)}", "danger")
    
    return render_template("add_user.html", show_sidebar=True)

@app.route("/list_users")
@login_required
def list_users():
    if not cursor:
        return "Database not available", 500
    
    try:
        cursor.execute("SELECT id, name, username, role, status FROM users ORDER BY created_at DESC")
        users = cursor.fetchall()
        return render_template("list_users.html", users=users, show_sidebar=True)
    except Exception as e:
        logger.error(f"List users error: {e}")
        return "Database error", 500

@app.route("/records")
@login_required
def records():
    return render_template("records.html")

@app.route("/records/<folder_name>")
@login_required
def records_folder(folder_name):
    return render_template("records_folder.html", folder_name=folder_name, snapshots=[])

@app.route("/cheating/<snap_id>")
@login_required
def cheating(snap_id):
    return render_template("cheating.html", 
                         snapshot_id=snap_id, 
                         timestamp="N/A",
                         cheating_snapshots=[])

@app.route("/cheating_snapshot/<snap_id>")
@login_required
def cheating_snapshot(snap_id):
    # Return a placeholder image for now
    return "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="

# Error handling
if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8000))
    try:
        socketio.run(app, host='0.0.0.0', port=port, debug=False)
    except Exception as e:
        print(f"Error starting app: {e}")
        raise