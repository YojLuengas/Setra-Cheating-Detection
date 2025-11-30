from dotenv import load_dotenv
load_dotenv()

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

# === CRITICAL: Monkey patch BEFORE any socket/threading imports ===
try:
    import eventlet
    eventlet.monkey_patch()
except ImportError:
    print("FATAL: eventlet not installed! Run: pip install eventlet")
    raise

from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, send_file, abort, Response
from flask_socketio import SocketIO, emit  # ← emit was missing!
import mysql.connector
from ultralytics import YOLO
import mediapipe as mp

# ---------- App Setup ----------
app = Flask(__name__)
app.secret_key = os.getenv("b2d17120ac2cafe8dcd66bae6ecefb0ed2e119d06104ee6f10e7075b83c2e5ad", "replace_this_with_random_string_123")
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------- Global DB Connection (Fixed!) ----------
db = mysql.connector.connect(
    host=os.getenv("MYSQLHOST"),
    port=int(os.getenv("MYSQLPORT", 3306)),
    user=os.getenv("MYSQLUSER"),
    password=os.getenv("MYSQLPASSWORD"),
    database=os.getenv("MYSQLDATABASE"),
    autocommit=True
)
# Optional: reconnect if needed
db.ping(reconnect=True, attempts=3, delay=5)

def get_db_cursor(dictionary=False):
    """Always get a fresh cursor"""
    if not db.is_connected():
        db.reconnect(attempts=3, delay=5)
    return db.cursor(dictionary=dictionary)

# ---------- Models ----------
yolo_model = YOLO("models/best.pt")
face_mesh = mp.solutions.face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# ---------- Globals ----------
all_snapshots = []
notified_snapshots = []
last_cheating_notification_time = 0
frame_lock = Lock()
PROCESS_INTERVAL = 0.50
OUT_IMG_MAX = 608
_last_processed_time = 0.0

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

# ---------- Decorators ----------
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            flash("Please login to access that page.", "warning")
            return redirect(url_for("login", next=request.path))
        return f(*args, **kwargs)
    return decorated_function

# ---------- Routes ----------
@app.route("/db-test")
def db_test():
    try:
        cursor = get_db_cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        cursor.close()
        return f"DB Connected: {result}"
    except Exception as e:
        return f"DB Failed: {e}"

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password_raw = request.form.get("password", "")
        if not username or not password_raw:
            flash("Missing credentials", "warning")
            return redirect(url_for("login"))

        cursor = get_db_cursor()
        try:
            cursor.execute("SELECT id, username, password_hash, role, status FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
            if user and bcrypt.checkpw(password_raw.encode(), user[2].encode()):
                if user[4] != "Active":
                    flash("Account inactive", "danger")
                else:
                    session.update({
                        "user_id": user[0],
                        "username": user[1],
                        "role": user[3] or "user"
                    })
                    return redirect(url_for("admin_page" if session["role"] == "admin" else "home"))
            else:
                flash("Invalid credentials", "danger")
        except Exception as e:
            logger.exception("Login error: %s", e)
            flash("Login error", "danger")
        finally:
            cursor.close()
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/admin")
@login_required
def admin_page():
    if session.get("role") != "admin":
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
    return render_template(
        "admin.html",
        total_users=total_users,
        active_users=active_users,
        inactive_users=inactive_users,
        users_preview=users_preview,
        show_sidebar=True,
    )

@app.route("/admin/add_user", methods=["GET", "POST"])
@login_required
def add_user():
    if session.get("role") != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for("home"))

    if request.method == "POST":
        name = request.form["name"]
        username = request.form["username"]
        password = request.form["password"]

        # NEW: get all selected subjects (as list)
        subjects_list = request.form.getlist("subjects[]")
        subjects_str = ", ".join(subjects_list) if subjects_list else ""

        try:
            # Check if username already exists
            cursor.execute("SELECT id FROM users WHERE username=%s", (username,))
            if cursor.fetchone():
                flash("Username already exists!", "danger")
            else:
                hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()

                cursor.execute(
                    """
                    INSERT INTO users 
                        (name, username, password_hash, status, created_by, subjects)
                    VALUES 
                        (%s, %s, %s, 'Active', %s, %s)
                    """,
                    (name, username, hashed_pw, session.get("username"), subjects_str),
                )

                db.commit()
                flash(f"User '{username}' added successfully!", "success")

        except Exception as e:
            db.rollback()
            logger.exception("add_user DB error: %s", e)
            flash("Unable to add user.", "danger")

        # Redirect after POST so flash messages show on GET
        return redirect(url_for("add_user"))

    return render_template("add_user.html", show_sidebar=True)

@app.route("/admin/reset_password/<int:user_id>", methods=["POST"])
@login_required
def reset_password(user_id):
    if session.get("role") != "admin":
        return redirect(url_for("home"))
    try:
        hashed_pw = bcrypt.hashpw(b"1234", bcrypt.gensalt()).decode()
        cursor.execute("UPDATE users SET password_hash=%s, updated_by=%s WHERE id=%s", (hashed_pw, session.get("username"), user_id))
        db.commit()
        flash("Password reset to 1234", "info")
    except Exception as e:
        db.rollback()
        logger.exception("reset_password error: %s", e)
        flash("Unable to reset password.", "danger")
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
        logger.exception("deactivate_user error: %s", e)
        flash("Unable to deactivate user.", "danger")
    return redirect(url_for("list_users"))

@app.route("/admin/delete_user/<int:user_id>", methods=["POST"])
@login_required
def delete_user(user_id):
    if session.get("role") != "admin":
        return redirect(url_for("home"))
    if str(user_id) == str(session.get("user_id")):
        flash("You cannot delete your own account.", "warning")
        return redirect(url_for("admin_page"))
    try:
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        db.commit()
        flash("User deleted successfully.", "success")
    except Exception as e:
        db.rollback()
        logger.exception("delete_user error: %s", e)
        flash("Unable to delete user.", "danger")
    return redirect(url_for("admin_page"))

@app.route("/admin/users")
@login_required
def list_users():
    if session.get("role") != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for("home"))
    try:
        cursor.execute("SELECT id, name, username, role, status FROM users WHERE role != 'admin'")
        users = cursor.fetchall()
    except Exception as e:
        logger.exception("list_users error: %s", e)
        users = []
    return render_template("list_users.html", users=users, show_sidebar=True)

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
        logger.exception("activate_user error: %s", e)
        flash("Unable to activate user.", "danger")
    return redirect(url_for("list_users"))

@app.route("/admin/dashboard")
@login_required
def admin_dashboard():
    if session.get("role") != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for("home"))

    try:
        # Summary counts
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users WHERE status='Active'")
        active_users = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users WHERE status='Inactive'")
        inactive_users = cursor.fetchone()[0]

        # Recent users preview (include status here)
        cursor.execute("SELECT username, role, status FROM users ORDER BY id DESC LIMIT 5")
        users_preview = cursor.fetchall()

    except Exception as e:
        logger.exception("admin_dashboard error: %s", e)
        total_users = active_users = inactive_users = 0
        users_preview = []

    return render_template(
        "admin_dashboard.html",
        total_users=total_users,
        active_users=active_users,
        inactive_users=inactive_users,
        users_preview=users_preview
    )

@app.route("/assessment-session", methods=["POST"])
@login_required
def create_assessment_session():
    # Clear previous session
    session.pop("assessment_session_id", None)

    data = request.get_json(silent=True) or {}

    cursor = db.cursor(dictionary=True)

    subject = (data.get("subject") or "").strip()
    course = (data.get("course") or "").strip()

    # Duration validation
    allowed_durations = {30, 60, 90, 120}
    try:
        raw_duration = data.get("duration_minutes", data.get("duration", None))
        duration_minutes = int(raw_duration) if raw_duration else 60
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Invalid duration value"}), 400

    if duration_minutes not in allowed_durations:
        return jsonify({"success": False, "error": "Unsupported duration value"}), 400

    try:
        # Validate subject belongs to the user
        cursor.execute("SELECT subjects FROM users WHERE id = %s", (session["user_id"],))
        row = cursor.fetchone()

        if not row:
            return jsonify({"success": False, "error": "User not found"}), 400

        subjects_raw = row.get("subjects") or ""
        valid_subjects = [s.strip() for s in subjects_raw.split(",") if s.strip()]

        if subject not in valid_subjects:
            return jsonify({"success": False, "error": "Invalid subject"}), 400

        # Insert assessment session with STATUS added
        cursor.execute(
            """
            INSERT INTO assessment_sessions
                (user_id, course, subject, exam_type, exam_datetime, camera, duration_minutes, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                session["user_id"],
                course,
                subject,
                data.get("exam_type"),
                data.get("exam_datetime"),
                data.get("camera"),
                duration_minutes,
                "active",   # NEW: Default active status
                datetime.now(),
            ),
        )

        assessment_session_id = cursor.lastrowid

        # Create folder record
        folder_name = (
            f"{course.replace(' ', '_')}_"
            f"{subject.replace(' ', '_')}_"
            f"{data.get('exam_type','').replace(' ','_')}_"
            f"{str(uuid.uuid4())[:8]}"
        )

        cursor.execute(
            """
            INSERT INTO records
                (assessment_session_id, user_id, folder_name, created_at)
            VALUES (%s, %s, %s, %s)
            """,
            (assessment_session_id, session["user_id"], folder_name, datetime.now())
        )

        db.commit()

        # Reset tracking
        global all_snapshots, notified_snapshots, last_cheating_notification_time
        all_snapshots = []
        notified_snapshots = []
        last_cheating_notification_time = 0

        session["assessment_session_id"] = assessment_session_id

        return jsonify({
            "success": True,
            "message": "Assessment session created successfully!",
            "assessment_session_id": assessment_session_id,
            "duration_minutes": duration_minutes,
            "status": "active"
        })

    except Exception as e:
        db.rollback()
        logger.exception("create_assessment_session error: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        try:
            cursor.close()
        except Exception:
            pass
      
        
@app.route("/stop-assessment", methods=["POST"])
@login_required
def stop_assessment():
    """
    Stops an active assessment session:
    - Update DB status to 'completed'
    - Emit refresh event to update UI
    - Clear session assessment ID
    """
    assessment_id = session.get("assessment_session_id")

    if not assessment_id:
        return jsonify({"success": False, "error": "No active session"}), 400

    try:
        cursor = db.cursor()

        # Mark the session as completed
        cursor.execute(
            "UPDATE assessment_sessions SET status = 'completed' WHERE id = %s",
            (assessment_id,)
        )
        db.commit()

        # Remove from session
        session.pop("assessment_session_id", None)

        # Notify the UI to refresh notifications / history
        try:
            socketio.emit("refresh_notifications", {"msg": "assessment_ended"})
        except Exception as e:
            logger.exception("SocketIO emit failed: %s", e)

        return jsonify({"success": True, "message": "Assessment session stopped"})

    except Exception as e:
        logger.exception("stop_assessment error: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        try:
            cursor.close()
        except Exception:
            pass


@app.route("/api/get_user_subjects")
@login_required
def get_user_subjects():
    cursor.execute("SELECT subjects FROM users WHERE id=%s", (session["user_id"],))
    row = cursor.fetchone()

    if not row:
        return jsonify({"success": False, "subjects": []})

    subjects_raw = row[0] or ""
    subjects = [s.strip() for s in subjects_raw.split(",") if s.strip()]

    return jsonify({"success": True, "subjects": subjects})

# ---------- SocketIO ----------
@socketio.on("connect")
def on_connect():
    emit("connected", {"data": "ready"})

@socketio.on("frame")
def handle_frame(message):
    global _last_processed_time, last_cheating_notification_time

    if not frame_lock.acquire(blocking=False):
        return
    try:
        now = time.time()
        if now - _last_processed_time < PROCESS_INTERVAL:
            return
        _last_processed_time = now

        frame = process_binary_image(message) if isinstance(message, bytes) else b64_to_cv2(message)
        if frame is None:
            return

        h, w = frame.shape[:2]
        scale = OUT_IMG_MAX / max(h, w)
        small = cv2.resize(frame, (int(w * scale), int(h * scale)))

        results = yolo_model.predict(small, imgsz=608, conf=0.5, verbose=False)
        cheating = False
        annotated = small.copy()

        if results and results[0].boxes is not None:
            for box in results[0].boxes:
                cls = int(box.cls[0]) if hasattr(box.cls, "__getitem__") else int(box.cls)
                label = yolo_model.model.names.get(cls, "unknown")
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                color = (0, 0, 255) if "cheat" in str(label).lower() else (0, 255, 0)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                if "cheat" in str(label).lower():
                    cheating = True

        # Head pose
        rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
        face_results = face_mesh.process(rgb)
        if face_results.multi_face_landmarks:
            yaw = estimate_head_rotation(rgb, face_results.multi_face_landmarks[0])
            if abs(yaw * 180) > 25:
                cheating = True

        # Save cheating snapshot
        if cheating and time.time() - last_cheating_notification_time >= 2:
            snap_id = str(uuid.uuid4())
            _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
            img_b64 = base64.b64encode(buf).decode()

            cursor = get_db_cursor()
            try:
                cursor.execute(
                    "INSERT INTO detections (id, timestamp, epoch, image_path, assessment_session_id, user_id) VALUES (%s, %s, %s, %s, %s, %s)",
                    (snap_id, datetime.now(), time.time(), img_b64, session.get("assessment_session_id"), session["user_id"])
                )
                socketio.emit("cheating_notification", {
                    "message": "Cheating detected!",
                    "time": datetime.now().strftime("%I:%M %p"),
                    "url": f"/cheating/{snap_id}"
                })
                last_cheating_notification_time = time.time()
            finally:
                cursor.close()

        out_b64 = cv2_to_b64(annotated, 60)
        if out_b64:
            emit("response_frame", {"image": out_b64, "cheating": cheating})

    finally:
        frame_lock.release()

# ---------- Keep all your other routes unchanged (admin, records, etc.) ----------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=False)