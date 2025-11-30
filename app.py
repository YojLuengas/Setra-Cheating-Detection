# app.py (fixed)
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
import bcrypt
import logging

from ultralytics import YOLO

# eventlet must be monkey-patched before other networking/threading libs
try:
    import eventlet
    eventlet.monkey_patch()
except ImportError:
    print("FATAL: eventlet not installed! Run: pip install eventlet")
    raise

from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_socketio import SocketIO, emit
import mysql.connector
from mysql.connector import Error
# NOTE: don't instantiate heavy objects at import time (we'll lazy-load ultralytics / mediapipe)
# from ultralytics import YOLO
# import mediapipe as mp


app = Flask(__name__)
app.secret_key = os.getenv("8f42c6b2a1d9e5f7c3b9a8d1e6f4c2b5d7g9h3j1k5m8n2p4q6r8s0t3u5v7w9x", "replace_this_123")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ========= Safe globals ========= #
frame_lock = Lock()
_last_processed_time = 0
last_cheating_notification_time = 0
PROCESS_INTERVAL = 0.5
yolo_model = YOLO("best.pt")  # Make sure model.pt exists in project root

# ===== DB FIXED & STABLE =====
db = None

def init_db():
    global db
    try:
        db = mysql.connector.connect(
            host=os.getenv("MYSQLHOST"),
            user=os.getenv("MYSQLUSER"),
            password=os.getenv("MYSQLPASSWORD"),
            database=os.getenv("MYSQLDATABASE"),
            port=int(os.getenv("MYSQLPORT", 3306)),
            autocommit=True,
            connection_timeout=10
        )
        logger.info("✅ MySQL connected successfully!")
    except Error as e:
        logger.error(f"❌ DB Initialization Failed: {e}")
        db = None

def get_db():
    global db
    try:
        if db is None or not getattr(db, "is_connected", lambda: True)():
            init_db()
        return db
    except Exception:
        init_db()
        return db

def get_db_cursor(buffered=False, dict_cursor=False):
    db_conn = get_db()
    if db_conn is None:
        logger.error("❌ DB not available for cursor request")
        return None
    return db_conn.cursor(buffered=buffered, dictionary=dict_cursor)

# ===== Globals for realtime processing =====
frame_lock = Lock()
PROCESS_INTERVAL = 0.50
OUT_IMG_MAX = 608
_last_processed_time = 0.0
last_cheating_notification_time = 0.0

# Lazy-loaded model & mediapipe
_model = None
_mp = None
_face_mesh = None

def get_model():
    global _model
    if _model is None:
        try:
            # lazy import to avoid blocking startup
            from ultralytics import YOLO
            model_path = os.getenv("YOLO_MODEL_PATH", "model.pt")
            logger.info("Loading YOLO model (lazy)...")
            _model = YOLO(model_path)
            logger.info("YOLO model loaded.")
        except Exception as e:
            logger.exception("Failed to load YOLO model: %s", e)
            _model = None
    return _model

def get_face_mesh():
    global _mp, _face_mesh
    if _face_mesh is None:
        try:
            import mediapipe as mp
            _mp = mp
            _face_mesh = mp.solutions.face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            logger.info("MediaPipe FaceMesh initialized.")
        except Exception as e:
            logger.exception("Failed to initialize MediaPipe FaceMesh: %s", e)
            _face_mesh = None
    return _face_mesh

# ---------- Helpers ----------
def b64_to_cv2(data_b64):
    try:
        if "," in data_b64:
            _, b64 = data_b64.split(",", 1)
        else:
            b64 = data_b64
        img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
        return np.array(img)[:, :, ::-1].copy()
    except Exception as e:
        logger.exception("b64_to_cv2 error: %s", e)
        return None

def cv2_to_b64(img_bgr, jpeg_quality=70):
    try:
        _, buffer = cv2.imencode(".jpg", img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
        b64 = base64.b64encode(buffer).decode("utf-8")
        return "data:image/jpeg;base64," + b64
    except Exception as e:
        logger.exception("cv2_to_b64 error: %s", e)
        return None

def process_binary_image(binary_data):
    try:
        nparr = np.frombuffer(binary_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.exception("process_binary_image error: %s", e)
        return None

def estimate_head_rotation(image_rgb, face_landmarks):
    h, w, _ = image_rgb.shape
    try:
        lmk = face_landmarks.landmark
        left_x = lmk[33].x * w
        right_x = lmk[263].x * w
        nose_x = lmk[1].x * w
        yaw = (nose_x - (left_x + right_x) / 2) / w
        return float(yaw)
    except Exception:
        return 0.0

# ---------- Auth decorator ----------
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            flash("Please login!", "warning")
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return wrapper

# ---------- Routes ----------
@app.route("/")
def home():
    return "Server is running on Railway!"

# Keep your other routes (login, admin, etc.) but guard DB cursor usage:
@app.route("/login", methods=["GET","POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username","").strip()
        password_raw = request.form.get("password","")
        cursor = get_db_cursor()
        if cursor is None:
            flash("Database unavailable. Try again later.", "danger")
            return render_template("login.html")
        try:
            cursor.execute("SELECT id,username,password_hash,role,status FROM users WHERE username=%s",(username,))
            user = cursor.fetchone()
        except Exception as e:
            logger.exception("Login DB error: %s", e)
            user = None
        finally:
            try: cursor.close()
            except Exception: pass

        if user and bcrypt.checkpw(password_raw.encode(), user[2].encode()):
            if user[4] != "Active":
                flash("Account inactive!", "danger")
            else:
                session.update({"user_id":user[0],"username":user[1],"role":user[3]})
                return redirect(url_for("admin_page" if user[3]=="admin" else "home"))
        flash("Invalid login!", "danger")
    return render_template("login.html")

# (The rest of your admin routes remain mostly the same, but always call get_db_cursor()
#  and close cursors. For brevity, they were omitted here — keep them in your app as before.)

# ---------- SocketIO frame handler ----------
@socketio.on("frame")
def handle_frame(message):
    # Use only necessary globals and lazy resources
    global _last_processed_time, last_cheating_notification_time
    if not frame_lock.acquire(blocking=False):
        return
    try:
        now = time.time()
        if now - _last_processed_time < PROCESS_INTERVAL:
            return
        _last_processed_time = now

        frame = process_binary_image(message) if isinstance(message, (bytes, bytearray)) else b64_to_cv2(message)
        if frame is None:
            return

        # Resize for faster inference
        h, w = frame.shape[:2]
        scale = OUT_IMG_MAX / max(h, w) if max(h, w) > 0 else 1.0
        small = cv2.resize(frame, (int(w * scale), int(h * scale))) if scale != 1.0 else frame.copy()

        # Run YOLO lazily
        model = get_model()
        cheating = False
        annotated = small.copy()

        if model is not None:
            try:
                results = model.predict(small, imgsz=608, conf=0.5, verbose=False)
                if results and len(results) > 0 and getattr(results[0], "boxes", None) is not None:
                    for box in results[0].boxes:
                        # support both legacy/new API forms
                        cls_idx = int(box.cls[0]) if hasattr(box.cls, "__getitem__") else int(box.cls)
                        label = getattr(model, "model", None) and model.model.names.get(cls_idx, "unknown") or "unknown"
                        coords = box.xyxy[0].tolist() if hasattr(box.xyxy, "__iter__") else []
                        if coords:
                            x1, y1, x2, y2 = map(int, coords)
                            color = (0, 0, 255) if "cheat" in str(label).lower() else (0, 255, 0)
                            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                            if "cheat" in str(label).lower():
                                cheating = True
            except Exception:
                logger.exception("YOLO inference error")

        # Head pose estimation (lazy init)
        face_mesh = get_face_mesh()
        try:
            if face_mesh is not None:
                rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
                face_results = face_mesh.process(rgb)
                if face_results and getattr(face_results, "multi_face_landmarks", None):
                    yaw = estimate_head_rotation(rgb, face_results.multi_face_landmarks[0])
                    if abs(yaw * 180) > 25:
                        cheating = True
        except Exception:
            logger.exception("Face mesh processing error")

        # Save cheating snapshot if detected
        if cheating and time.time() - last_cheating_notification_time >= 2:
            cursor = get_db_cursor()
            try:
                if cursor is not None:
                    snap_id = str(uuid.uuid4())
                    _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
                    img_b64 = base64.b64encode(buf).decode()
                    cursor.execute(
                        "INSERT INTO detections (id, timestamp, epoch, image_path, assessment_session_id, user_id) VALUES (%s, %s, %s, %s, %s, %s)",
                        (snap_id, datetime.now(), time.time(), img_b64, session.get("assessment_session_id"), session.get("user_id"))
                    )
                    db.commit()
                    socketio.emit("cheating_notification", {
                        "message": "Cheating detected!",
                        "time": datetime.now().strftime("%I:%M %p"),
                        "url": f"/cheating/{snap_id}"
                    })
                    last_cheating_notification_time = time.time()
            except Exception:
                logger.exception("Failed to save detection")
            finally:
                try:
                    if cursor is not None:
                        cursor.close()
                except Exception:
                    pass

        out_b64 = cv2_to_b64(annotated, 60)
        if out_b64:
            emit("response_frame", {"image": out_b64, "cheating": cheating})
    finally:
        frame_lock.release()