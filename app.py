# app.py - cleaned & fixed version (bcrypt-based auth + admin user management)
import io
import base64
import time
import uuid
import cv2
import numpy as np
from PIL import Image
from datetime import datetime
from functools import wraps
from flask import (
    Flask, render_template, make_response, redirect, url_for,
    request, session, flash, jsonify
)
from flask_socketio import SocketIO, emit
import mysql.connector
import mediapipe as mp
from ultralytics import YOLO
import bcrypt

# --- Database Connection ---
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="",          # put your MySQL password here if any
    database="sentra_db"  # make sure this DB exists
)
print("connected")
cursor = db.cursor()

# Flask + SocketIO
app = Flask(__name__)
app.secret_key = "replace_this_with_a_strong_random_secret"  # CHANGE THIS in production!
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Load YOLO model
MODEL_PATH = "models/best.pt"
yolo_model = YOLO(MODEL_PATH)

# MediaPipe
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Store snapshots
all_snapshots = []
notified_snapshots = []
last_cheating_notification_time = 0

# --- Helpers ---
def b64_to_cv2(data_b64):
    header, b64 = data_b64.split(',', 1)
    img_bytes = base64.b64decode(b64)
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    cv_img = np.array(img)[:, :, ::-1].copy()  # RGB->BGR
    return cv_img

def cv2_to_b64(img, jpeg_quality=70):
    _, buffer = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
    b64 = base64.b64encode(buffer).decode('utf-8')
    return 'data:image/jpeg;base64,' + b64

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

# ----------------------------
# Authentication helpers
# ----------------------------
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash("Please login to access that page.", "warning")
            return redirect(url_for('login', next=request.path))
        return f(*args, **kwargs)
    
    
    return decorated_function
@app.route('/assessment-session', methods=['POST'])
@login_required
def create_assessment_session():
    data = request.get_json()

    course = data.get('course')
    subject = data.get('subject')
    exam_type = data.get('exam_type')
    exam_datetime = data.get('exam_datetime')   # comes from <input type="datetime-local">
    camera = data.get('camera')

    try:
        cursor.execute("""
            INSERT INTO assessment_sessions 
                (user_id, course, subject, exam_type, exam_datetime, camera, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            session['user_id'],   # logged-in user
            course,
            subject,
            exam_type,
            exam_datetime,
            camera,
            datetime.now()
        ))
        db.commit()
        return jsonify({"success": True, "message": "Assessment session created successfully!"})
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


# --- Auth Routes (bcrypt) ---
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password_raw = request.form.get("password", "")
        if not username or not password_raw:
            flash("Please provide username and password.", "warning")
            return redirect(url_for('login'))

        # Fetch id, username, password, role, status
        cursor.execute("SELECT id, username, password_hash, role, status FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()

        if user:
            user_id, user_name, stored_hash, role, status = user

            # Check if inactive
            if status != "Active":
                flash("Your account is inactive. Please contact the administrator.", "danger")
                return redirect(url_for("login"))

            # Validate password
            if stored_hash and bcrypt.checkpw(password_raw.encode("utf-8"), stored_hash.encode("utf-8")):
                # Save session
                session["user_id"] = user_id
                session["username"] = user_name
                session["role"] = role if role else "user"
                print("Login successful!", "success")

                # Redirect based on role
                if session["role"] == "admin":
                    return redirect(url_for("admin_page"))
                return redirect(url_for("home"))
            else:
                flash("Invalid username or password.", "danger")
        else:
            flash("Invalid username or password.", "danger")

    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    print ("Logged out.", "info")
    return redirect(url_for("login"))

# --- Admin routes ---
@app.route("/admin")
def admin_page():
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("home") if session.get("user_id") else url_for("login"))
    
    admin_username = session.get("username")

    # Fetch counts for dashboard cards
    cursor.execute("SELECT COUNT(*) FROM users WHERE username != %s", (admin_username,))
    total_users = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'Active' AND username != %s", (admin_username,))
    active_users = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'Inactive' AND username != %s", (admin_username,))
    inactive_users = cursor.fetchone()[0]

    # Recent users excluding the logged-in admin
    cursor.execute(
    "SELECT username, role, status FROM users WHERE username != %s ORDER BY id DESC LIMIT 5",
    (admin_username,)
)
    users_preview = cursor.fetchall()

    return render_template(
        "admin.html",
        total_users=total_users,
        active_users=active_users,
        inactive_users=inactive_users,
        users_preview=users_preview,
        show_sidebar=True
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
        password = request.form["password"].encode("utf-8")

        hashed_pw = bcrypt.hashpw(password, bcrypt.gensalt()).decode()

        cursor.execute("""
            INSERT INTO users (name, username, password_hash, status, created_by)
            VALUES (%s, %s, %s, 'Active', %s)
        """, (name, username, hashed_pw, session.get("username")))
        db.commit()
        flash("User added successfully!", "success")
        return redirect(url_for("list_users"))

    return render_template("add_user.html", show_sidebar=True)


@app.route("/admin/reset_password/<int:user_id>", methods=["POST"])
@login_required
def reset_password(user_id):
    if session.get("role") != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for("home"))

    new_pass = "1234".encode("utf-8")  # default temp password
    hashed_pw = bcrypt.hashpw(new_pass, bcrypt.gensalt()).decode()

    cursor.execute("UPDATE users SET password_hash=%s, updated_by=%s WHERE id=%s",
                   (hashed_pw, session.get("username"), user_id))
    db.commit()
    flash("Password reset to 1234", "info")
    return redirect(url_for("list_users"))

@app.route("/admin/deactivate_user/<int:user_id>", methods=["POST"])
@login_required
def deactivate_user(user_id):
    if session.get("role") != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for("home"))

    try:
        cursor.execute("UPDATE users SET status='Inactive', updated_by=%s WHERE id=%s",
                       (session.get("username"), user_id))
        db.commit()
        flash("User deactivated successfully.", "warning")
    except Exception as e:
        db.rollback()
        flash(f"Error deactivating user: {e}", "danger")

    return redirect(url_for("list_users"))


@app.route("/admin/delete_user/<int:user_id>", methods=["POST"])
def delete_user(user_id):
    if session.get("role") != "admin":
        flash("Unauthorized access!", "danger")
        return redirect(url_for("home") if session.get("user_id") else url_for("login"))

    # prevent admin from deleting themselves
    if str(user_id) == str(session.get("user_id")):
        flash("You cannot delete your own account while logged in.", "warning")
        return redirect(url_for("admin_page"))

    try:
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        db.commit()
        flash("User deleted successfully.", "success")
    except Exception as e:
        db.rollback()
        flash(f"Error deleting user: {e}", "danger")

    return redirect(url_for("admin_page"))

# Optional: route to show users in a separate page (if needed)
@app.route("/admin/users")
def list_users():
    cursor.execute("SELECT id, name, username, role, status FROM users WHERE role != 'admin'")
    users = cursor.fetchall()
    return render_template("list_users.html", users=users, show_sidebar=True)

@app.route("/admin/activate_user/<int:user_id>", methods=["POST"])
@login_required
def activate_user(user_id):
    if session.get("role") != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for("home"))

    try:
        cursor.execute("UPDATE users SET status='Active', updated_by=%s WHERE id=%s",
                       (session.get("username"), user_id))
        db.commit()
        flash("User activated successfully.", "success")
    except Exception as e:
        db.rollback()
        flash(f"Error activating user: {e}", "danger")

    return redirect(url_for("list_users"))

# --- SocketIO (real-time video processing) ---
@socketio.on('connect')
def on_connect():
    print("✅ Client connected")
    emit('connected', {'data': 'ready'})

@socketio.on('frame')
def handle_frame(message):
    global all_snapshots, notified_snapshots, last_cheating_notification_time
    img_b64 = message.get('image')
    if not img_b64:
        return

    frame = b64_to_cv2(img_b64)
    original = frame.copy()

    # Resize for YOLO inference
    h, w = frame.shape[:2]
    scale = 640 / max(h, w)
    small = cv2.resize(frame, (int(w * scale), int(h * scale)))

    # Run YOLO
    results = yolo_model.predict(small, imgsz=640, conf=0.35, verbose=False)

    detections = []
    if len(results) > 0:
        r = results[0]
        for box in r.boxes:
            xyxy = box.xyxy[0].cpu().numpy()
            conf = float(box.conf[0].cpu().numpy())
            cls = int(box.cls[0].cpu().numpy())
            label = yolo_model.model.names.get(cls, str(cls))
            x1, y1, x2, y2 = [int(v / scale) for v in xyxy]
            detections.append((label, conf, (x1, y1, x2, y2)))

    alert_msgs = []
    cheating_in_frame = False

    for label, conf, (x1, y1, x2, y2) in detections:
        cv2.rectangle(original, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(original, f"{label} {conf:.2f}", (x1, y1 - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        if label.lower() == 'cheating':
            cheating_in_frame = True

    # If cheating detected → snapshot + notification (cooldown 2s)
    if cheating_in_frame:
        now = time.time()
        if now - last_cheating_notification_time >= 2:
            alert_msgs.append("Cheating detected")

            out_b64 = cv2_to_b64(original, jpeg_quality=80)
            snap_id = str(uuid.uuid4())
            timestamp = time.strftime("%Y-%m-%d %I:%M:%S %p")

            snapshot = {
                "id": snap_id,
                "image": out_b64,
                "timestamp": timestamp,
                "epoch": now
            }

            all_snapshots.append(snapshot)
            notified_snapshots.append(snapshot)

            # Save to DB
            try:
                sql = "INSERT INTO detections (id, timestamp, epoch, image_path) VALUES (%s, %s, %s, %s)"
                vals = (snap_id, timestamp, now, "base64_inline")
                cursor.execute(sql, vals)
                db.commit()
                print(f"✅ Inserted detection {snap_id} into DB")
            except Exception as e:
                print(f"⚠️ DB insert error: {e}")

            now_dt = datetime.now()
            time_str = now_dt.strftime("%I:%M %p")

            socketio.emit('cheating_notification', {
                'message': 'Cheating detected',
                'time': time_str,
                'timestamp': now_dt.strftime("%Y-%m-%d %I:%M:%S %p"),
                'url': f'/cheating/{snap_id}'
            })

            last_cheating_notification_time = now

    # Head rotation detection
    image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results_face = face_mesh.process(image_rgb)
    if results_face.multi_face_landmarks:
        face_landmarks = results_face.multi_face_landmarks[0]
        yaw = estimate_head_rotation(image_rgb, face_landmarks)
        yaw_deg = yaw * 90
        if abs(yaw_deg) > 25:
            alert_msgs.append("Looking away (head turned)")
        cv2.putText(original, f"Yaw:{yaw_deg:.1f}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)

    # Status text
    status_text = "OK" if not alert_msgs else "; ".join(alert_msgs)
    color = (0, 255, 0) if not alert_msgs else (0, 0, 255)
    cv2.putText(original, status_text, (10, original.shape[0]-20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    # Return annotated frame
    out_b64 = cv2_to_b64(original, jpeg_quality=60)
    emit('response_frame', {'image': out_b64, 'cheating': cheating_in_frame})

# --- Web Routes (detection pages) ---
@app.route("/")
@login_required
def home():
    return render_template("index.html", username=session.get('username'))

@app.route("/cheating/<snap_id>")
@login_required
def cheating(snap_id):
    snap = next((s for s in notified_snapshots if s["id"] == snap_id), None)
    if snap:
        return render_template(
            "cheating.html",
            snapshot_id=snap_id,
            timestamp=snap["timestamp"],
            cheating_snapshots=notified_snapshots
        )
    else:
        return "Snapshot not found", 404

@app.route("/cheating_snapshot/<snap_id>")
@login_required
def cheating_snapshot(snap_id):
    snap = next((s for s in all_snapshots if s["id"] == snap_id), None)
    if snap:
        header, b64 = snap["image"].split(',', 1)
        img_bytes = base64.b64decode(b64)
        response = make_response(img_bytes)
        response.headers.set('Content-Type', 'image/jpeg')
        return response
    return "Snapshot not found", 404

@app.route("/api/notifications")
@login_required
def get_notifications():
    cursor.execute("SELECT id, timestamp FROM detections ORDER BY epoch DESC")
    rows = cursor.fetchall()
    notifications = []
    for row in rows:
        snap_id, ts = row[0], row[1]

        # ensure timestamp is string
        if isinstance(ts, datetime):
            ts_str = ts.strftime("%Y-%m-%d %I:%M:%S %p")  # e.g. 2025-09-22 10:10:15 AM
            time_str = ts.strftime("%I:%M %p")             # e.g. 10:10 AM
        else:
            ts_str = str(ts)
            time_str = " ".join(ts_str.split()[-2:])

        notifications.append({
            "id": snap_id,
            "message": "Cheating detected",
            "time": time_str,
            "timestamp": ts_str,
            "url": f"/cheating/{snap_id}"
        })

    return jsonify({"notifications": notifications})

@app.route("/api/delete/<snap_id>", methods=["DELETE"])
@login_required
def delete_notification(snap_id):
    try:
        cursor.execute("DELETE FROM detections WHERE id = %s", (snap_id,))
        db.commit()

        global all_snapshots, notified_snapshots
        all_snapshots = [s for s in all_snapshots if s["id"] != snap_id]
        notified_snapshots = [s for s in notified_snapshots if s["id"] != snap_id]

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    
    

# --- Run ---
if __name__ == "__main__":
    host = "0.0.0.0"
    port = 5000
    print(f"🚀 Server running at: http://127.0.0.1:{port}")
    socketio.run(app, host=host, port=port, debug=True)