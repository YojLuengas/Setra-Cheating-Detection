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
from flask import Flask, render_template, make_response, redirect, url_for, request, session, flash, jsonify, send_file, abort
from flask_socketio import SocketIO, emit
import mysql.connector
import mediapipe as mp
from ultralytics import YOLO
import bcrypt
from flask import Flask, render_template, request, redirect, url_for, session, send_file, Response
from flask import send_file

UPLOAD_FOLDER = os.path.join("static", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}

db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="",
    database="sentra_db"
)
cursor = db.cursor()

app = Flask(__name__)
app.secret_key = "replace_this_with_a_strong_random_secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

yolo_model = YOLO("models/best.pt")

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

all_snapshots = []
notified_snapshots = []
last_cheating_notification_time = 0

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

def estimate_head_rotation(image_rgb, face_landmarks):
    h, w, _ = image_rgb.shape
    try:
        lmk = face_landmarks.landmark
        yaw = (lmk[1].x * w - (lmk[33].x * w + lmk[263].x * w) / 2) / w
        return float(yaw)
    except:
        return 0.0

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

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password_raw = request.form.get("password", "")
        if not username or not password_raw:
            flash("Please provide username and password.", "warning")
            return redirect(url_for("login"))
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
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/admin")
def admin_page():
    if session.get("role") != "admin":
        flash("Access denied!", "danger")
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
    return render_template("admin.html", total_users=total_users, active_users=active_users, inactive_users=inactive_users, users_preview=users_preview, show_sidebar=True)

@app.route("/admin/add_user", methods=["GET", "POST"])
@login_required
def add_user():
    if session.get("role") != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for("home"))
    if request.method == "POST":
        hashed_pw = bcrypt.hashpw(request.form["password"].encode("utf-8"), bcrypt.gensalt()).decode()
        cursor.execute("INSERT INTO users (name, username, password_hash, status, created_by) VALUES (%s, %s, %s, 'Active', %s)", (request.form["name"], request.form["username"], hashed_pw, session.get("username")))
        db.commit()
        flash("User added successfully!", "success")
        return redirect(url_for("list_users"))
    return render_template("add_user.html", show_sidebar=True)

@app.route("/admin/reset_password/<int:user_id>", methods=["POST"])
@login_required
def reset_password(user_id):
    if session.get("role") != "admin":
        return redirect(url_for("home"))
    hashed_pw = bcrypt.hashpw(b"1234", bcrypt.gensalt()).decode()
    cursor.execute("UPDATE users SET password_hash=%s, updated_by=%s WHERE id=%s", (hashed_pw, session.get("username"), user_id))
    db.commit()
    flash("Password reset to 1234", "info")
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
        flash(str(e), "danger")
    return redirect(url_for("list_users"))

@app.route("/admin/delete_user/<int:user_id>", methods=["POST"])
def delete_user(user_id):
    if session.get("role") != "admin":
        return redirect(url_for("home") if session.get("user_id") else url_for("login"))
    if str(user_id) == str(session.get("user_id")):
        flash("You cannot delete your own account.", "warning")
        return redirect(url_for("admin_page"))
    try:
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        db.commit()
        flash("User deleted successfully.", "success")
    except Exception as e:
        db.rollback()
        flash(str(e), "danger")
    return redirect(url_for("admin_page"))

@app.route("/admin/users")
def list_users():
    cursor.execute("SELECT id, name, username, role, status FROM users WHERE role != 'admin'")
    return render_template("list_users.html", users=cursor.fetchall(), show_sidebar=True)

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

@app.route("/")
@login_required
def home():
    return render_template("index.html", username=session.get("username"))

@app.route("/cheating/<snap_id>")
@login_required
def cheating(snap_id):
    snap = next((s for s in notified_snapshots if s["id"] == snap_id), None)
    return render_template("cheating.html", snapshot_id=snap_id, timestamp=snap["timestamp"], cheating_snapshots=notified_snapshots) if snap else ("Snapshot not found", 404)

from flask import send_file

@app.route("/cheating_snapshot/<snap_id>")
def cheating_snapshot(snap_id):
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

@app.route("/api/delete/<snap_id>", methods=["DELETE"])
@login_required
def delete_notification(snap_id):
    try:
        cursor.execute("SELECT image_path FROM detections WHERE id = %s", (snap_id,))
        row = cursor.fetchone()
        image_path = row[0] if row else None
        cursor.execute("DELETE FROM detections WHERE id = %s", (snap_id,))
        db.commit()
        global all_snapshots, notified_snapshots
        all_snapshots = [s for s in all_snapshots if s["id"] != snap_id]
        notified_snapshots = [s for s in notified_snapshots if s["id"] != snap_id]
        if image_path:
            try:
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
