<<<<<<< HEAD

=======
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
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
<<<<<<< HEAD
from threading import Lock

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
=======
from flask import Flask, render_template, make_response, redirect, url_for, request, session, flash, jsonify, send_file, abort
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
from flask_socketio import SocketIO, emit
import mysql.connector
import mediapipe as mp
from ultralytics import YOLO
import bcrypt
<<<<<<< HEAD
import logging

<<<<<<< HEAD
# --- Database Connection ---
=======
from flask import Flask, render_template, request, redirect, url_for, session, send_file, Response
from flask import send_file

UPLOAD_FOLDER = os.path.join("static", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}

>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="",
    database="sentra_db"
)
cursor = db.cursor()
=======
# ---------- Config ----------
>>>>>>> 2c2af40e06538af64789d73f2955ed9c90bc6305

<<<<<<< HEAD
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "sentra_db",
    "charset": "utf8mb4",
}

# ---------- App / DB / Logging ----------
app = Flask(__name__)
app.secret_key = "replace_this_with_a_strong_random_secret"  # change this
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Use a buffered cursor to permit multiple fetches reliably
try:
    db = mysql.connector.connect(**DB_CONFIG)
    cursor = db.cursor(buffered=True)
except Exception as e:
    logger.exception("Database connection error: %s", e)
    raise

# ---------- Models / ML ----------
# Update path as required
=======
app = Flask(__name__)
app.secret_key = "replace_this_with_a_strong_random_secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
yolo_model = YOLO("models/best.pt")

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=100,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

<<<<<<< HEAD
# ---------- Globals & Locks ----------
=======
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
all_snapshots = []
notified_snapshots = []
last_cheating_notification_time = 0
consecutive_cheating_frames = 0
consecutive_non_cheating_frames = 0
stable_cheating = False
frame_lock = Lock()

<<<<<<< HEAD
# ---------- Helpers ----------
def b64_to_cv2(data_b64):
    """Convert data:image/...;base64,... to BGR numpy array."""
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

def cv2_to_b64(img_bgr, jpeg_quality=70):
    """Return base64 data URL (JPEG). jpeg_quality: 1-100."""
    try:
        enc_success, buffer = cv2.imencode(".jpg", img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), int(jpeg_quality)])
        if not enc_success:
            return None
        b64 = base64.b64encode(buffer).decode("utf-8")
        return "data:image/jpeg;base64," + b64
    except Exception as e:
        logger.exception("cv2_to_b64 error: %s", e)
        return None

def save_image_to_disk(img_bgr, snap_id=None, jpeg_quality=85):
    # Instead of saving to disk, encode to base64 and return
    _, buffer = cv2.imencode('.jpg', img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
    img_b64 = base64.b64encode(buffer).decode('utf-8')
    return img_b64
=======
def b64_to_cv2(data_b64):
    _, b64 = data_b64.split(",", 1)
    img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    return np.array(img)[:, :, ::-1].copy()

def cv2_to_b64(img, png_quality=70):
    _, buffer = cv2.imencode(".png", img, [int(cv2.IMWRITE_PNG_COMPRESSION), png_quality])
    return "data:image/png;base64," + base64.b64encode(buffer).decode("utf-8")

def save_image_to_disk(img_bgr, snap_id, png_quality=85):
    filename = f"{uuid.uuid4()}.png"
    filepath = os.path.join("static/uploads", filename)
    success, buffer = cv2.imencode(".png", img_bgr, [int(cv2.IMWRITE_PNG_COMPRESSION), png_quality])
    if not success:
        return None
    with open(filepath, "wb") as f:
        f.write(buffer.tobytes())
    return filepath
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226

def estimate_head_rotation(image_rgb, face_landmarks):
    """Simple yaw and roll estimator using landmarks; returns yaw and roll ratios (approx)."""
    h, w, _ = image_rgb.shape
    try:
        lmk = face_landmarks.landmark
<<<<<<< HEAD
        # Yaw: uses outer eye landmarks as proxy
        left = lmk[33]   # left eye outer
        right = lmk[263] # right eye outer
        center = lmk[1]  # nose tip
        yaw = (center.x * w - (left.x * w + right.x * w) / 2) / w

        # Roll: approximate using vertical offset of eyes
        left_eye_y = lmk[33].y * h
        right_eye_y = lmk[263].y * h
        roll = (left_eye_y - right_eye_y) / w  # normalized by width for consistency

        return float(yaw), float(roll)
    except Exception:
        return 0.0, 0.0
=======
        yaw = (lmk[1].x * w - (lmk[33].x * w + lmk[263].x * w) / 2) / w
        return float(yaw)
    except:
        return 0.0
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            flash("Please login to access that page.", "warning")
            return redirect(url_for("login", next=request.path))
        return f(*args, **kwargs)
    return decorated_function

@app.route("/assessment-session", methods=["POST"])
@login_required
def create_assessment_session():
    data = request.get_json()
    try:
        cursor.execute(
            """
            INSERT INTO assessment_sessions 
                (user_id, course, subject, exam_type, exam_datetime, camera, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                session["user_id"],
                data.get("course"),
                data.get("subject"),
                data.get("exam_type"),
                data.get("exam_datetime"),
                data.get("camera"),
                datetime.now(),
            ),
        )
        db.commit()
        return jsonify({"success": True, "message": "Assessment session created successfully!"})
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

<<<<<<< HEAD

# ---------- Routes: Auth/Admin ----------
=======
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password_raw = request.form.get("password", "")
        if not username or not password_raw:
            flash("Please provide username and password.", "warning")
<<<<<<< HEAD
<<<<<<< HEAD
            return redirect(url_for('login'))

        # Fetch id, username, password, role, status
=======
            return redirect(url_for("login"))
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
        cursor.execute("SELECT id, username, password_hash, role, status FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if user:
            user_id, user_name, stored_hash, role, status = user
            if status != "Active":
                flash("Your account is inactive.", "danger")
                return redirect(url_for("login"))
            if stored_hash and bcrypt.checkpw(password_raw.encode("utf-8"), stored_hash.encode("utf-8")):
<<<<<<< HEAD
                # Save session
                session["user_id"] = user_id
                session["username"] = user_name
                session["role"] = role if role else "user"
                print("Login successful!", "success")

                # Redirect based on role
                if session["role"] == "admin":
                    return redirect(url_for("admin_page"))
                return redirect(url_for("home"))
=======
            return redirect(url_for("login"))
        try:
            cursor.execute("SELECT id, username, password_hash, role, status FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
            if user:
                user_id, user_name, stored_hash, role, status = user
                if status != "Active":
                    flash("Your account is inactive.", "danger")
                    return redirect(url_for("login"))
                if stored_hash and bcrypt.checkpw(password_raw.encode("utf-8"), stored_hash.encode("utf-8")):
                    session.update({"user_id": user_id, "username": user_name, "role": role or "user"})
                    return redirect(url_for("admin_page" if session["role"] == "admin" else "home"))
                else:
                    flash("Invalid username or password.", "danger")
>>>>>>> 2c2af40e06538af64789d73f2955ed9c90bc6305
            else:
                flash("Invalid username or password.", "danger")
        except Exception as e:
            logger.exception("Login DB error: %s", e)
            flash("An error occurred. Please try again.", "danger")
=======
                session.update({"user_id": user_id, "username": user_name, "role": role or "user"})
                return redirect(url_for("admin_page" if session["role"] == "admin" else "home"))
            else:
                flash("Invalid username or password.", "danger")
        else:
            flash("Invalid username or password.", "danger")
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
<<<<<<< HEAD
<<<<<<< HEAD
    print ("Logged out.", "info")
=======
>>>>>>> 2c2af40e06538af64789d73f2955ed9c90bc6305
=======
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
    return redirect(url_for("login"))

@app.route("/admin")
@login_required
def admin_page():
    if session.get("role") != "admin":
<<<<<<< HEAD
<<<<<<< HEAD
        flash("Access denied! Admins only.", "danger")
=======
        flash("Access denied!", "danger")
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
        return redirect(url_for("home") if session.get("user_id") else url_for("login"))
    admin_username = session.get("username")
    cursor.execute("SELECT COUNT(*) FROM users WHERE username != %s", (admin_username,))
    total_users = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'Active' AND username != %s", (admin_username,))
    active_users = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'Inactive' AND username != %s", (admin_username,))
    inactive_users = cursor.fetchone()[0]
    cursor.execute("SELECT username, role, status FROM users WHERE username != %s ORDER BY id DESC LIMIT 5", (admin_username,))
    users_preview = cursor.fetchall()
<<<<<<< HEAD

=======
        flash("Access denied!", "danger")
        return redirect(url_for("home"))
    try:
        admin_username = session.get("username")
        cursor.execute("SELECT COUNT(*) FROM users WHERE username != %s", (admin_username,))
        total_users = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'Active' AND username != %s", (admin_username,))
        active_users = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'Inactive' AND username != %s", (admin_username,))
        inactive_users = cursor.fetchone()[0]
        cursor.execute("SELECT username, role, status FROM users WHERE username != %s ORDER BY id DESC LIMIT 5", (admin_username,))
        users_preview = cursor.fetchall()
    except Exception as e:
        logger.exception("admin_page DB error: %s", e)
        flash("Unable to load admin data.", "danger")
        total_users = active_users = inactive_users = 0
        users_preview = []
>>>>>>> 2c2af40e06538af64789d73f2955ed9c90bc6305
    return render_template(
        "admin.html",
        total_users=total_users,
        active_users=active_users,
        inactive_users=inactive_users,
        users_preview=users_preview,
<<<<<<< HEAD
        show_sidebar=True
    )

=======
        show_sidebar=True,
    )
>>>>>>> 2c2af40e06538af64789d73f2955ed9c90bc6305
=======
    return render_template("admin.html", total_users=total_users, active_users=active_users, inactive_users=inactive_users, users_preview=users_preview, show_sidebar=True)
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226

@app.route("/admin/add_user", methods=["GET", "POST"])
@login_required
def add_user():
    if session.get("role") != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for("home"))
    if request.method == "POST":
<<<<<<< HEAD
<<<<<<< HEAD
        name = request.form["name"]
        username = request.form["username"]
        password = request.form["password"].encode("utf-8")

        hashed_pw = bcrypt.hashpw(password, bcrypt.gensalt()).decode()

        cursor.execute("""
            INSERT INTO users (name, username, password_hash, status, created_by)
            VALUES (%s, %s, %s, 'Active', %s)
        """, (name, username, hashed_pw, session.get("username")))
=======
        hashed_pw = bcrypt.hashpw(request.form["password"].encode("utf-8"), bcrypt.gensalt()).decode()
        cursor.execute("INSERT INTO users (name, username, password_hash, status, created_by) VALUES (%s, %s, %s, 'Active', %s)", (request.form["name"], request.form["username"], hashed_pw, session.get("username")))
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
        db.commit()
        flash("User added successfully!", "success")
        return redirect(url_for("list_users"))
    return render_template("add_user.html", show_sidebar=True)

<<<<<<< HEAD
=======
        try:
            hashed_pw = bcrypt.hashpw(request.form["password"].encode("utf-8"), bcrypt.gensalt()).decode()
            cursor.execute(
                "INSERT INTO users (name, username, password_hash, status, created_by) VALUES (%s, %s, %s, 'Active', %s)",
                (request.form["name"], request.form["username"], hashed_pw, session.get("username")),
            )
            db.commit()
            flash("User added successfully!", "success")
            return redirect(url_for("list_users"))
        except Exception as e:
            db.rollback()
            logger.exception("add_user DB error: %s", e)
            flash("Unable to add user.", "danger")
    return render_template("add_user.html", show_sidebar=True)
>>>>>>> 2c2af40e06538af64789d73f2955ed9c90bc6305

=======
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
@app.route("/admin/reset_password/<int:user_id>", methods=["POST"])
@login_required
def reset_password(user_id):
    if session.get("role") != "admin":
        return redirect(url_for("home"))
<<<<<<< HEAD
    try:
        hashed_pw = bcrypt.hashpw(b"1234", bcrypt.gensalt()).decode()
        cursor.execute("UPDATE users SET password_hash=%s, updated_by=%s WHERE id=%s", (hashed_pw, session.get("username"), user_id))
        db.commit()
        flash("Password reset to 1234", "info")
    except Exception as e:
        db.rollback()
        logger.exception("reset_password error: %s", e)
        flash("Unable to reset password.", "danger")
=======
    hashed_pw = bcrypt.hashpw(b"1234", bcrypt.gensalt()).decode()
    cursor.execute("UPDATE users SET password_hash=%s, updated_by=%s WHERE id=%s", (hashed_pw, session.get("username"), user_id))
    db.commit()
    flash("Password reset to 1234", "info")
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
    return redirect(url_for("list_users"))

@app.route("/admin/deactivate_user/<int:user_id>", methods=["POST"])
@login_required
def deactivate_user(user_id):
    if session.get("role") != "admin":
        return redirect(url_for("home"))
    try:
        cursor.execute("UPDATE users SET status='Inactive', updated_by=%s WHERE id=%s", (session.get("username"), user_id))
        db.commit()
        flash("User deactivated successfully.", "warning")
    except Exception as e:
        db.rollback()
<<<<<<< HEAD
        logger.exception("deactivate_user error: %s", e)
        flash("Unable to deactivate user.", "danger")
=======
        flash(str(e), "danger")
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
    return redirect(url_for("list_users"))

@app.route("/admin/delete_user/<int:user_id>", methods=["POST"])
@login_required
def delete_user(user_id):
    if session.get("role") != "admin":
<<<<<<< HEAD
        return redirect(url_for("home"))
=======
        return redirect(url_for("home") if session.get("user_id") else url_for("login"))
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
    if str(user_id) == str(session.get("user_id")):
        flash("You cannot delete your own account.", "warning")
        return redirect(url_for("admin_page"))
    try:
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        db.commit()
        flash("User deleted successfully.", "success")
    except Exception as e:
        db.rollback()
<<<<<<< HEAD
        logger.exception("delete_user error: %s", e)
        flash("Unable to delete user.", "danger")
=======
        flash(str(e), "danger")
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
    return redirect(url_for("admin_page"))

@app.route("/admin/users")
@login_required
def list_users():
<<<<<<< HEAD
    cursor.execute("SELECT id, name, username, role, status FROM users WHERE role != 'admin'")
<<<<<<< HEAD
    users = cursor.fetchall()
=======
    if session.get("role") != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for("home"))
    try:
        cursor.execute("SELECT id, name, username, role, status FROM users WHERE role != 'admin'")
        users = cursor.fetchall()
    except Exception as e:
        logger.exception("list_users error: %s", e)
        users = []
>>>>>>> 2c2af40e06538af64789d73f2955ed9c90bc6305
    return render_template("list_users.html", users=users, show_sidebar=True)
=======
    return render_template("list_users.html", users=cursor.fetchall(), show_sidebar=True)
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226

@app.route("/admin/activate_user/<int:user_id>", methods=["POST"])
@login_required
def activate_user(user_id):
    if session.get("role") != "admin":
        return redirect(url_for("home"))
    try:
        cursor.execute("UPDATE users SET status='Active', updated_by=%s WHERE id=%s", (session.get("username"), user_id))
        db.commit()
        flash("User activated successfully.", "success")
    except Exception as e:
        db.rollback()
<<<<<<< HEAD
        logger.exception("activate_user error: %s", e)
        flash("Unable to activate user.", "danger")
    return redirect(url_for("list_users"))

# ---------- Assessment session ----------
@app.route("/assessment-session", methods=["POST"])
@login_required
def create_assessment_session():
    # Ensure any previous assessment session is cleared
    session.pop("assessment_session_id", None)
    data = request.get_json(silent=True) or {}
    try:
        cursor.execute(
            """
            INSERT INTO assessment_sessions
                (user_id, course, subject, exam_type, exam_datetime, camera, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                session["user_id"],
                data.get("course"),
                data.get("subject"),
                data.get("exam_type"),
                data.get("exam_datetime"),
                data.get("camera"),
                datetime.now(),
            ),
        )
        assessment_session_id = cursor.lastrowid
        folder_name = f"{data.get('course', '').replace(' ', '_')}_{data.get('subject', '').replace(' ', '_')}_{data.get('exam_type', '').replace(' ', '_')}_{str(uuid.uuid4())[:8]}"
        cursor.execute(
            "INSERT INTO records (assessment_session_id, user_id, folder_name, created_at) VALUES (%s, %s, %s, %s)",
            (assessment_session_id, session["user_id"], folder_name, datetime.now())
        )
        db.commit()
        global all_snapshots, notified_snapshots, last_cheating_notification_time
        all_snapshots = []
        notified_snapshots = []
        last_cheating_notification_time = 0
        session["assessment_session_id"] = assessment_session_id
        return jsonify({"success": True, "message": "Assessment session created successfully!"})
    except Exception as e:
        db.rollback()
        logger.exception("create_assessment_session error: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/stop-assessment", methods=["POST"])
@login_required
def stop_assessment_session():
    try:
        # Clear the assessment session ID from session
        session.pop("assessment_session_id", None)
        # Reset global variables
        global all_snapshots, notified_snapshots, last_cheating_notification_time
        all_snapshots = []
        notified_snapshots = []
        last_cheating_notification_time = 0
        return jsonify({"success": True, "message": "Assessment session stopped successfully!"})
    except Exception as e:
        logger.exception("stop_assessment_session error: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500

# ---------- SocketIO frame handler ----------
@socketio.on("connect")
def on_connect():
    emit("connected", {"data": "ready"})

@socketio.on("frame")
def handle_frame(message):
    global all_snapshots, notified_snapshots, last_cheating_notification_time
    if not frame_lock.acquire(blocking=False):
        # Drop frame if still processing previous one
        return
    try:
        img_b64 = message.get("image")
        if not img_b64:
            return
        frame = b64_to_cv2(img_b64)
        if frame is None:
            return
        original = frame.copy()
        h, w = frame.shape[:2]
        scale = 640 / max(h, w)
        small = cv2.resize(frame, (int(w * scale), int(h * scale)))
        # YOLO predict (be defensive in parsing results)
        try:
            results = yolo_model.predict(small, imgsz=640, conf=0.40, verbose=False)
        except Exception as e:
            logger.exception("YOLO prediction error: %s", e)
            results = []
        detections, cheating_in_frame = [], False
        if len(results) > 0 and hasattr(results[0], "boxes"):
            for box in results[0].boxes:
                try:
                    # Many ultralytics versions return tensors or numpy arrays
                    xyxy = box.xyxy[0].cpu().numpy() if hasattr(box.xyxy, "__len__") else np.array(box.xyxy).flatten()
                    conf = float(box.conf[0].cpu().numpy()) if hasattr(box.conf, "__len__") else float(box.conf)
                    cls = int(box.cls[0].cpu().numpy()) if hasattr(box.cls, "__len__") else int(box.cls)
                    label = yolo_model.model.names.get(cls, str(cls)) if hasattr(yolo_model, "model") else str(cls)
                    x1, y1, x2, y2 = [int(v / scale) for v in xyxy]
                    detections.append((label, conf, (x1, y1, x2, y2)))
                except Exception:
                    # fallback: attempt to read simpler attributes
                    try:
                        bb = box.xyxy
                        x1, y1, x2, y2 = [int(v / scale) for v in bb]
                        conf = float(getattr(box, "conf", 0.0))
                        cls = int(getattr(box, "cls", 0))
                        label = yolo_model.model.names.get(cls, str(cls)) if hasattr(yolo_model, "model") else str(cls)
                        detections.append((label, conf, (x1, y1, x2, y2)))
                    except Exception:
                        logger.exception("Failed to parse detection box.")
                        continue

        for label, conf, (x1, y1, x2, y2) in detections:
            color = (0, 0, 255) if label.lower() == "cheating" else (0, 255, 0)
            cv2.rectangle(original, (x1, y1), (x2, y2), color, 2)
            cv2.putText(original, f"{label} {conf:.2f}", (x1, max(y1 - 8, 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
            if label.lower() == "cheating":
                cheating_in_frame = True

        # If cheating label detected, save snapshot (rate-limited)
        if cheating_in_frame and time.time() - last_cheating_notification_time >= 2:
            snap_id = str(uuid.uuid4())
            saved_path = save_image_to_disk(original, snap_id=snap_id, jpeg_quality=85)
            timestamp = datetime.now()
            epoch_now = time.time()
            assessment_session_id = session.get("assessment_session_id")
            snapshot = {"id": snap_id, "image_path": saved_path, "timestamp": timestamp.strftime("%Y-%m-%d %I:%M:%S %p"), "epoch": epoch_now}
            all_snapshots.append(snapshot)
            notified_snapshots.append(snapshot)
            try:
                cursor.execute("INSERT INTO detections (id, timestamp, epoch, image_path, assessment_session_id, user_id) VALUES (%s, %s, %s, %s, %s, %s)", (snap_id, timestamp, epoch_now, saved_path, assessment_session_id, session["user_id"]))
                db.commit()
            except Exception as e:
                db.rollback()
                logger.exception("DB insert error: %s", e)
            now_dt = datetime.now()
            socketio.emit("cheating_notification", {"message": "Cheating detected", "time": now_dt.strftime("%I:%M %p"), "timestamp": now_dt.strftime("%Y-%m-%d %I:%M:%S %p"), "url": f"/cheating/{snap_id}"})
            last_cheating_notification_time = time.time()

        # Face/pose check: estimate yaw and alert if looking away
        results_face = face_mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        alert_msgs = []
        if results_face and getattr(results_face, "multi_face_landmarks", None):
            try:
                yaw, roll = estimate_head_rotation(frame, results_face.multi_face_landmarks[0])
                yaw_deg = yaw * 90
                if abs(yaw_deg) > 25:
                    alert_msgs.append("Looking away")
                cv2.putText(original, f"Yaw:{yaw_deg:.1f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
            except Exception:
                logger.exception("face yaw estimation failed")

        status_text = "OK" if not alert_msgs else "; ".join(alert_msgs)
        color = (0, 255, 0) if not alert_msgs else (0, 0, 255)
        cv2.putText(original, status_text, (10, original.shape[0] - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

        out_b64 = cv2_to_b64(original, jpeg_quality=60)
        emit("response_frame", {"image": out_b64, "cheating": cheating_in_frame})
    finally:
        try:
            frame_lock.release()
        except Exception:
            pass
        
# ---------- UI / Snapshot routes ----------
=======
        flash(str(e), "danger")
    return redirect(url_for("list_users"))

@socketio.on("connect")
def on_connect():
    emit("connected", {"data": "ready"})

@socketio.on("frame")
def handle_frame(message):
    global all_snapshots, notified_snapshots, last_cheating_notification_time
    img_b64 = message.get("image")
    if not img_b64:
        return
    frame = b64_to_cv2(img_b64)
    original = frame.copy()
    h, w = frame.shape[:2]
    scale = 640 / max(h, w)
    small = cv2.resize(frame, (int(w * scale), int(h * scale)))
    results = yolo_model.predict(small, imgsz=640, conf=0.35, verbose=False)
    detections, alert_msgs, cheating_in_frame = [], [], False
    if len(results) > 0:
        for box in results[0].boxes:
            xyxy = box.xyxy[0].cpu().numpy()
            conf = float(box.conf[0].cpu().numpy())
            cls = int(box.cls[0].cpu().numpy())
            label = yolo_model.model.names.get(cls, str(cls))
            x1, y1, x2, y2 = [int(v / scale) for v in xyxy]
            detections.append((label, conf, (x1, y1, x2, y2)))
    for label, conf, (x1, y1, x2, y2) in detections:
        cv2.rectangle(original, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(original, f"{label} {conf:.2f}", (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        if label.lower() == "cheating":
            cheating_in_frame = True
    if cheating_in_frame and time.time() - last_cheating_notification_time >= 2:
        snap_id = str(uuid.uuid4())
        saved_path = save_image_to_disk(original, snap_id, png_quality=85)
        timestamp = datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")
        epoch_now = time.time()
        snapshot = {"id": snap_id, "image_path": saved_path, "timestamp": timestamp, "epoch": epoch_now}
        all_snapshots.append(snapshot)
        notified_snapshots.append(snapshot)
        try:
            cursor.execute("INSERT INTO detections (id, timestamp, epoch, image_path) VALUES (%s, %s, %s, %s)", (snap_id, timestamp, epoch_now, saved_path))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"DB insert error: {e}")
        now_dt = datetime.now()
        socketio.emit("cheating_notification", {"message": "Cheating detected", "time": now_dt.strftime("%I:%M %p"), "timestamp": now_dt.strftime("%Y-%m-%d %I:%M:%S %p"), "url": f"/cheating/{snap_id}"})
        last_cheating_notification_time = time.time()
    results_face = face_mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    if results_face.multi_face_landmarks:
        yaw_deg = estimate_head_rotation(frame, results_face.multi_face_landmarks[0]) * 90
        if abs(yaw_deg) > 25:
            alert_msgs.append("Looking away")
        cv2.putText(original, f"Yaw:{yaw_deg:.1f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
    status_text = "OK" if not alert_msgs else "; ".join(alert_msgs)
    color = (0, 255, 0) if not alert_msgs else (0, 0, 255)
    cv2.putText(original, status_text, (10, original.shape[0] - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
    emit("response_frame", {"image": cv2_to_b64(original, png_quality=60), "cheating": cheating_in_frame})

>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
@app.route("/")
@login_required
def home():
    return render_template("index.html", username=session.get("username"))

@app.route("/cheating/<snap_id>")
@login_required
def cheating(snap_id):
<<<<<<< HEAD
    try:
        cursor.execute("SELECT id, timestamp, assessment_session_id FROM detections WHERE id = %s AND user_id = %s", (snap_id, session["user_id"]))
        row = cursor.fetchone()
        if not row:
            return "Snapshot not found", 404

        snap_id, ts, assessment_session_id = row

        cursor.execute("SELECT id, timestamp, epoch FROM detections WHERE assessment_session_id = %s ORDER BY epoch DESC", (assessment_session_id,))
        cheating_snapshots = [{"id": r[0], "timestamp": r[1], "epoch": r[2]} for r in cursor.fetchall()]

        return render_template("cheating.html", snapshot_id=snap_id, timestamp=ts, cheating_snapshots=cheating_snapshots)
    except Exception as e:
        logger.exception("cheating page error: %s", e)
        return "Internal server error", 500
=======
    snap = next((s for s in notified_snapshots if s["id"] == snap_id), None)
    return render_template("cheating.html", snapshot_id=snap_id, timestamp=snap["timestamp"], cheating_snapshots=notified_snapshots) if snap else ("Snapshot not found", 404)

from flask import send_file
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226

@app.route("/cheating_snapshot/<snap_id>")
def cheating_snapshot(snap_id):
<<<<<<< HEAD
    cursor.execute("SELECT image_path FROM detections WHERE id = %s AND user_id = %s", (snap_id, session["user_id"]))
    row = cursor.fetchone()
    if row and row[0]:
        image_path = row[0]
        if not os.path.isabs(image_path):
            image_path = os.path.join(os.getcwd(), image_path)
        # Check if it's a file path (old snapshots) or base64 (new snapshots)
        if os.path.isfile(image_path):
            # Serve the file from disk
            return send_file(image_path, mimetype='image/jpeg')
        else:
            # Treat as base64 data
            return f'data:image/jpeg;base64,{row[0]}'
    return "Snapshot not found", 404

@app.route("/records")
@login_required
def records():
    """
    Show folders with counts and first snapshot thumbnail.
    """
    try:
        cursor.execute("""
            SELECT r.folder_name, as_.course, as_.subject, as_.exam_type, as_.exam_datetime, COUNT(d.id) as cnt,
                   (SELECT d2.image_path FROM detections d2 WHERE d2.assessment_session_id = r.assessment_session_id ORDER BY d2.timestamp ASC LIMIT 1) as first_image
            FROM records r
            LEFT JOIN assessment_sessions as_ ON r.assessment_session_id = as_.id
            LEFT JOIN detections d ON r.assessment_session_id = d.assessment_session_id
            WHERE r.user_id = %s
            GROUP BY r.assessment_session_id
            ORDER BY r.created_at DESC
        """, (session["user_id"],))
        rows = cursor.fetchall()
        folders = []
        for r in rows:
            course, subject, exam_type, exam_datetime = r[1], r[2], r[3], r[4]
            if course and subject and exam_type and exam_datetime:
                display_title = f"{course} - {subject} ({exam_type}) - {exam_datetime.strftime('%Y-%m-%d')}"
            else:
                display_title = r[0]
            folders.append({
                "folder_name": r[0],
                "display_title": display_title,
                "count": r[5],
                "first_image": f"data:image/jpeg;base64,{r[6]}" if r[6] else None
            })
    except Exception as e:
        logger.exception("records folders fetch error: %s", e)
        folders = []
    return render_template("records.html", folders=folders)

@app.route("/records/folder/<folder_name>")
@login_required
def records_folder(folder_name):
    """
    Show snapshots inside a folder.
    """
    try:
        cursor.execute("SELECT assessment_session_id FROM records WHERE folder_name = %s AND user_id = %s", (folder_name, session["user_id"]))
        row = cursor.fetchone()
        if not row:
            abort(404)
        assessment_session_id = row[0]

        cursor.execute("SELECT id, timestamp, image_path FROM detections WHERE assessment_session_id = %s ORDER BY timestamp DESC", (assessment_session_id,))
        rows = cursor.fetchall()
    except Exception as e:
        logger.exception("records folder fetch error: %s", e)
        rows = []

    snapshots = []
    for r in rows:
        snap_id, ts, img_path = r
        # image served by cheating_snapshot endpoint (returns data URI)
        img_url = url_for("cheating_snapshot", snap_id=snap_id)
        if isinstance(ts, datetime):
            ts_str = ts.strftime("%Y-%m-%d %I:%M:%S %p")
        else:
            ts_str = str(ts)
        snapshots.append({"id": snap_id, "timestamp": ts_str, "image_url": img_url})
    return render_template("records_folder.html", folder_name=folder_name, snapshots=snapshots)


@app.route("/delete_record/<folder_name>", methods=["POST"])
@login_required
def delete_record(folder_name):
    """
    Delete a record folder and all associated data.
    """
    try:
        # Get assessment_session_id for the folder
        cursor.execute("SELECT assessment_session_id FROM records WHERE folder_name = %s AND user_id = %s", (folder_name, session["user_id"]))
        row = cursor.fetchone()
        if not row:
            flash("Folder not found.", "danger")
            return redirect(url_for("records"))
        assessment_session_id = row[0]

        # Get all image paths for deletions
        cursor.execute("SELECT image_path FROM detections WHERE assessment_session_id = %s", (assessment_session_id,))
        image_paths = [r[0] for r in cursor.fetchall()]

        # Delete detections
        cursor.execute("DELETE FROM detections WHERE assessment_session_id = %s", (assessment_session_id,))

        # Delete record
        cursor.execute("DELETE FROM records WHERE folder_name = %s AND user_id = %s", (folder_name, session["user_id"]))

        # Delete assessment session
        cursor.execute("DELETE FROM assessment_sessions WHERE id = %s", (assessment_session_id,))

        db.commit()

        # Delete image files if they are file paths (for old snapshots)
        for img_path in image_paths:
            if img_path and not img_path.startswith("data:"):  # Not base64
                full_path = os.path.join(os.getcwd(), img_path) if not os.path.isabs(img_path) else img_path
                try:
                    if os.path.exists(full_path):
                        os.remove(full_path)
                except Exception:
                    logger.exception("Failed to delete image file: %s", full_path)

        flash("Folder and all data deleted successfully.", "success")
    except Exception as e:
        db.rollback()
        logger.exception("delete_record error: %s", e)
        flash("Failed to delete folder.", "danger")
    return redirect(url_for("records"))


@app.route("/delete_snapshot/<snap_id>", methods=["POST"])
@login_required
def delete_snapshot(snap_id):
    """
    Delete a single snapshot and associated data.
    """
    try:
        cursor.execute("SELECT image_path, assessment_session_id FROM detections WHERE id = %s AND user_id = %s", (snap_id, session["user_id"]))
        row = cursor.fetchone()
        if not row:
            flash("Snapshot not found.", "danger")
            return redirect(url_for("records"))
        image_path, assessment_session_id = row

        cursor.execute("DELETE FROM detections WHERE id = %s AND user_id = %s", (snap_id, session["user_id"]))
        db.commit()

        # Delete image file if it's a file path (not base64)
        if image_path and not image_path.startswith("data:"):
            full_path = os.path.join(os.getcwd(), image_path) if not os.path.isabs(image_path) else image_path
            try:
                if os.path.exists(full_path):
                    os.remove(full_path)
            except Exception:
                logger.exception("Failed to delete image file: %s", full_path)

        # Get folder_name to redirect back to the folder view
        cursor.execute("SELECT folder_name FROM records WHERE assessment_session_id = %s AND user_id = %s", (assessment_session_id, session["user_id"]))
        folder_row = cursor.fetchone()
        if folder_row:
            folder_name = folder_row[0]
            flash("Snapshot deleted successfully.", "success")
            return redirect(url_for("records_folder", folder_name=folder_name))
        else:
            flash("Snapshot deleted, but folder not found.", "warning")
            return redirect(url_for("records"))
    except Exception as e:
        db.rollback()
        logger.exception("delete_snapshot error: %s", e)
        flash("Failed to delete snapshot.", "danger")
        return redirect(url_for("records"))

# ---------- API routes ----------
@app.route("/api/notifications")
@login_required
def get_notifications():
    try:
        assessment_session_id = session.get("assessment_session_id")
        if not assessment_session_id:
            return jsonify({"notifications": []})
        cursor.execute("SELECT id, timestamp FROM detections WHERE assessment_session_id = %s ORDER BY epoch DESC", (assessment_session_id,))
        notifications = []
        for row in cursor.fetchall():
            snap_id, ts = row[0], row[1]
            if isinstance(ts, datetime):
                ts_str = ts.strftime("%Y-%m-%d %I:%M:%S %p")
                time_str = ts.strftime("%I:%M %p")
            else:
                ts_str = str(ts)
                time_str = " ".join(str(ts).split()[-2:])
            notifications.append({"id": snap_id, "message": "Cheating detected", "time": time_str, "timestamp": ts_str, "url": f"/cheating/{snap_id}"})
        return jsonify({"notifications": notifications})
    except Exception as e:
        logger.exception("get_notifications error: %s", e)
        return jsonify({"notifications": []})
=======
    cursor.execute("SELECT image_path FROM detections WHERE id = %s", (snap_id,))
    row = cursor.fetchone()

    if row and row[0]:
        # Make sure the path points inside your static/uploads folder
        image_path = row[0]

        # If you stored only the filename, join it with static/uploads
        if not image_path.startswith("static/"):
            image_path = os.path.join("static/uploads", image_path)

        return send_file(image_path, mimetype="image/jpeg")  # or image/png
    
    return "Snapshot not found", 404


@app.route("/records")
@login_required
def records():
    cursor.execute("SELECT id, timestamp, epoch, image_path FROM detections ORDER BY timestamp DESC")
    detections = cursor.fetchall()
    return render_template("records.html", detections=detections)


@app.route("/api/notifications")
@login_required
def get_notifications():
    cursor.execute("SELECT id, timestamp FROM detections ORDER BY epoch DESC")
    notifications = []
    for row in cursor.fetchall():
        snap_id, ts = row[0], row[1]
        if isinstance(ts, datetime):
            ts_str, time_str = ts.strftime("%Y-%m-%d %I:%M:%S %p"), ts.strftime("%I:%M %p")
        else:
            ts_str, time_str = str(ts), " ".join(str(ts).split()[-2:])
        notifications.append({"id": snap_id, "message": "Cheating detected", "time": time_str, "timestamp": ts_str, "url": f"/cheating/{snap_id}"})
    return jsonify({"notifications": notifications})
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226

@app.route("/api/delete/<snap_id>", methods=["DELETE"])
@login_required
def delete_notification(snap_id):
    try:
<<<<<<< HEAD
        cursor.execute("SELECT image_path FROM detections WHERE id = %s AND user_id = %s", (snap_id, session["user_id"]))
        row = cursor.fetchone()
        image_path = row[0] if row else None
        cursor.execute("DELETE FROM detections WHERE id = %s AND user_id = %s", (snap_id, session["user_id"]))
=======
        cursor.execute("SELECT image_path FROM detections WHERE id = %s", (snap_id,))
        row = cursor.fetchone()
        image_path = row[0] if row else None
        cursor.execute("DELETE FROM detections WHERE id = %s", (snap_id,))
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
        db.commit()
        global all_snapshots, notified_snapshots
        all_snapshots = [s for s in all_snapshots if s["id"] != snap_id]
        notified_snapshots = [s for s in notified_snapshots if s["id"] != snap_id]
        if image_path:
            try:
<<<<<<< HEAD
                if not os.path.isabs(image_path):
                    image_path = os.path.join(os.getcwd(), image_path)
                if os.path.exists(image_path):
                    os.remove(image_path)
            except Exception:
                logger.exception("Failed to remove image file")
        return jsonify({"success": True})
    except Exception as e:
        db.rollback()
        logger.exception("delete_notification error: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500

# ---------- Run ----------
if __name__ == "__main__":
    host = "0.0.0.0"
    port = 5000
    logger.info("🚀 Server running at: http://127.0.0.1:%s", port)
    socketio.run(app, host=host, port=port, debug=True)
    
=======
                if os.path.exists(image_path):
                    os.remove(image_path)
            except Exception:
                pass
        return jsonify({"success": True})
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
>>>>>>> d1796a5fe1bd2ce1a2df9e4acb45d5ec23037226
