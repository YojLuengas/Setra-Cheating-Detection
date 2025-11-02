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

from ultralytics import YOLO
import bcrypt
import logging

# ---------- Config ----------

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
yolo_model = YOLO("models/best.pt")



# ---------- Globals & Locks ----------
all_snapshots = []
notified_snapshots = []
last_cheating_notification_time = 0
consecutive_cheating_frames = 0
consecutive_non_cheating_frames = 0
stable_cheating = False
frame_lock = Lock()

# Throttling / timing controls to reduce CPU / GPU load and UI lag
PROCESS_INTERVAL = 0.45        # seconds between heavy processing runs (≈2.2 FPS)
OUT_IMG_MAX = 640             # send this max width for annotated frames
_last_processed_time = 0.0

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



def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            print("Please login to access that page.", "warning")
            return redirect(url_for("login", next=request.path))
        return f(*args, **kwargs)
    return decorated_function

# ---------- Routes: Auth/Admin ----------
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password_raw = request.form.get("password", "")
        if not username or not password_raw:
            flash("Please provide username and password.", "warning")
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
            else:
                flash("Invalid username or password.", "danger")
        except Exception as e:
            logger.exception("Login DB error: %s", e)
            flash("An error occurred. Please try again.", "danger")
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

        try:
            # Check if username already exists
            cursor.execute("SELECT id FROM users WHERE username=%s", (username,))
            if cursor.fetchone():
                flash("Username already exists!", "danger")
            else:
                hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()
                cursor.execute(
                    "INSERT INTO users (name, username, password_hash, status, created_by) VALUES (%s, %s, %s, 'Active', %s)",
                    (name, username, hashed_pw, session.get("username")),
                )
                db.commit()
                flash(f"User '{username}' added successfully!", "success")
        except Exception as e:
            db.rollback()
            logger.exception("add_user DB error: %s", e)
            flash("Unable to add user.", "danger")

        # Redirect after POST so flash messages show on a fresh GET
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
def stop_assessment():
    """
    Called by the frontend when user stops an assessment.
    Emits a refresh_notifications event and clears the session assessment ID.
    """
    try:
        # Clear the assessment session ID from the session
        session.pop("assessment_session_id", None)

        # Notify connected clients to refresh notifications / records view
        try:
            socketio.emit("refresh_notifications", {"msg": "assessment_stopped"})
        except Exception as e:
            logger.exception("socket emit failed: %s", e)

        return jsonify({"success": True})
    except Exception as e:
        logger.exception("stop_assessment error: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500

# ---------- SocketIO frame handler ----------
@socketio.on("connect")
def on_connect():
    emit("connected", {"data": "ready"})

@socketio.on("frame")
def handle_frame(message):
    """
    Process incoming frames but throttle to PROCESS_INTERVAL and do
    face mesh less frequently. Annotate on the downscaled image and
    send a smaller JPEG to clients to reduce latency.
    """
    global all_snapshots, notified_snapshots, last_cheating_notification_time
    global _last_processed_time, _last_face_time

    # Quick-drop if someone else is processing
    if not frame_lock.acquire(blocking=False):
        return

    try:
        now = time.time()
        # Throttle heavy processing to avoid backlog / lag
        if now - _last_processed_time < PROCESS_INTERVAL:
            return

        _last_processed_time = now

        img_b64 = message.get("image")
        if not img_b64:
            return

        frame = b64_to_cv2(img_b64)
        if frame is None:
            return

        original_h, original_w = frame.shape[:2]

        # Resize to a reasonable size for fast model inference
        scale = OUT_IMG_MAX / max(original_h, original_w)
        if scale <= 0:
            scale = 1.0
        small_w = max(1, int(original_w * scale))
        small_h = max(1, int(original_h * scale))
        small = cv2.resize(frame, (small_w, small_h), interpolation=cv2.INTER_LINEAR)

        # Run YOLO on the small image
        try:
            # keep imgsz similar to our small width for efficiency
            results = yolo_model.predict(small, imgsz=min(640, OUT_IMG_MAX), conf=0.40, verbose=False)
        except Exception as e:
            logger.exception("YOLO prediction error: %s", e)
            results = []

        detections = []
        cheating_in_frame = False

        if len(results) > 0 and hasattr(results[0], "boxes"):
            for box in results[0].boxes:
                try:
                    # robust extraction: support tensors and plain numbers
                    if hasattr(box.xyxy, "cpu"):
                        xyxy = box.xyxy.cpu().numpy().flatten()
                    else:
                        xyxy = np.array(box.xyxy).flatten()

                    if hasattr(box.conf, "cpu"):
                        conf = float(box.conf.cpu().numpy().flatten()[0])
                    else:
                        try:
                            conf = float(box.conf)
                        except Exception:
                            conf = 0.0

                    if hasattr(box.cls, "cpu"):
                        cls = int(box.cls.cpu().numpy().flatten()[0])
                    else:
                        try:
                            cls = int(box.cls)
                        except Exception:
                            cls = 0

                    label = None
                    try:
                        label = yolo_model.model.names.get(cls, str(cls)) if hasattr(yolo_model, "model") else str(cls)
                    except Exception:
                        label = str(cls)

                    # xyxy in small image coords -> map back to small image (we annotate small)
                    x1, y1, x2, y2 = [int(v) for v in xyxy[:4]]
                    detections.append((label, conf, (x1, y1, x2, y2)))
                except Exception:
                    logger.exception("Failed parsing detection box; skipping.")
                    continue

        # Annotate on the small image (faster than annotating full resolution)
        annotated = small.copy()
        for label, conf, (x1, y1, x2, y2) in detections:
            color = (0, 0, 255) if str(label).lower() == "cheating" else (0, 255, 0)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            cv2.putText(annotated, f"{label} {conf:.2f}", (x1, max(y1 - 8, 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            if str(label).lower() == "cheating":
                cheating_in_frame = True

        status_text = "OK"
        color_txt = (0, 255, 0)
        cv2.putText(annotated, status_text, (10, annotated.shape[0] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color_txt, 2)

        # Save snapshot & DB insert (rate-limit snapshot writes)
        if cheating_in_frame and time.time() - last_cheating_notification_time >= 2:
            snap_id = str(uuid.uuid4())
            # save a smaller base64 string (annotated small)
            _, buf = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            img_b64_small = base64.b64encode(buf).decode("utf-8")
            timestamp = datetime.now()
            epoch_now = time.time()
            assessment_session_id = session.get("assessment_session_id")
            snapshot = {"id": snap_id, "image_path": img_b64_small, "timestamp": timestamp.strftime("%Y-%m-%d %I:%M:%S %p"), "epoch": epoch_now}
            all_snapshots.append(snapshot)
            notified_snapshots.append(snapshot)
            try:
                cursor.execute("INSERT INTO detections (id, timestamp, epoch, image_path, assessment_session_id, user_id) VALUES (%s, %s, %s, %s, %s, %s)",
                               (snap_id, timestamp, epoch_now, img_b64_small, assessment_session_id, session["user_id"]))
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("DB insert error for snapshot")
            now_dt = datetime.now()
            socketio.emit("cheating_notification", {"message": "Cheating detected", "time": now_dt.strftime("%I:%M %p"), "timestamp": now_dt.strftime("%Y-%m-%d %I:%M:%S %p"), "url": f"/cheating/{snap_id}"})
            last_cheating_notification_time = time.time()

        # Prepare and emit annotated frame back to client (small image to reduce latency)
        out_b64 = cv2_to_b64(annotated, jpeg_quality=60)
        if out_b64:
            emit("response_frame", {"image": out_b64, "cheating": cheating_in_frame})
    finally:
        try:
            frame_lock.release()
        except Exception:
            pass
        
# ---------- UI / Snapshot routes ----------
@app.route("/")
@login_required
def home():
    return render_template("index.html", username=session.get("username"))

@app.route("/cheating/<snap_id>")
@login_required
def cheating(snap_id):
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

@app.route("/cheating_snapshot/<snap_id>")
@login_required
def cheating_snapshot(snap_id):
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
            SELECT r.folder_name, as_.course, as_.subject, as_.exam_type, as_.exam_datetime, COUNT(d.id) as cnt, r.created_at,
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
                "created_at": r[6].isoformat() if r[6] else None,
                "first_image": f"data:image/jpeg;base64,{r[7]}" if r[7] else None
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
    If this was the last snapshot in the folder, delete the folder as well.
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

        # Check if there are any remaining detections for this assessment_session_id
        cursor.execute("SELECT COUNT(*) FROM detections WHERE assessment_session_id = %s", (assessment_session_id,))
        remaining_count = cursor.fetchone()[0]

        if remaining_count == 0:
            # No more snapshots, delete the folder (record) and assessment session
            cursor.execute("DELETE FROM records WHERE assessment_session_id = %s AND user_id = %s", (assessment_session_id, session["user_id"]))
            cursor.execute("DELETE FROM assessment_sessions WHERE id = %s", (assessment_session_id,))
            db.commit()
            flash("Snapshot deleted successfully. Folder was empty and has been deleted.", "success")
            # Emit socket event to update records page
            socketio.emit("records_updated")
            return redirect(url_for("records"))
        else:
            # Get folder_name to redirect back to the folder view
            cursor.execute("SELECT folder_name FROM records WHERE assessment_session_id = %s AND user_id = %s", (assessment_session_id, session["user_id"]))
            folder_row = cursor.fetchone()
            if folder_row:
                folder_name = folder_row[0]
                flash("Snapshot deleted successfully.", "success")
                # Emit socket event to update records page
                socketio.emit("records_updated")
                return redirect(url_for("records_folder", folder_name=folder_name))
            else:
                flash("Snapshot deleted, but folder not found.", "warning")
                # Emit socket event to update records page
                socketio.emit("records_updated")
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

@app.route("/api/delete/<snap_id>", methods=["DELETE"])
@login_required
def delete_notification(snap_id):
    try:
        cursor.execute("SELECT image_path, assessment_session_id FROM detections WHERE id = %s AND user_id = %s", (snap_id, session["user_id"]))
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "error": "Snapshot not found"}), 404
        image_path, assessment_session_id = row

        cursor.execute("DELETE FROM detections WHERE id = %s AND user_id = %s", (snap_id, session["user_id"]))
        db.commit()

        global all_snapshots, notified_snapshots
        all_snapshots = [s for s in all_snapshots if s["id"] != snap_id]
        notified_snapshots = [s for s in notified_snapshots if s["id"] != snap_id]

        if image_path:
            try:
                if not os.path.isabs(image_path):
                    image_path = os.path.join(os.getcwd(), image_path)
                if os.path.exists(image_path):
                    os.remove(image_path)
            except Exception:
                logger.exception("Failed to remove image file")

        # Check if there are any remaining detections for this assessment_session_id
        cursor.execute("SELECT COUNT(*) FROM detections WHERE assessment_session_id = %s", (assessment_session_id,))
        remaining_count = cursor.fetchone()[0]

        if remaining_count == 0:
            # No more snapshots, delete the folder (record) and assessment session
            cursor.execute("DELETE FROM records WHERE assessment_session_id = %s AND user_id = %s", (assessment_session_id, session["user_id"]))
            cursor.execute("DELETE FROM assessment_sessions WHERE id = %s", (assessment_session_id,))
            db.commit()

        # Emit socket event to update cheating page timeline
        socketio.emit("snapshot_deleted", {"snap_id": snap_id})
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
