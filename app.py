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

try:
    import eventlet
    eventlet.monkey_patch()
except ImportError:
    print("FATAL: eventlet not installed! Run: pip install eventlet")
    raise

from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_socketio import SocketIO, emit
import mysql.connector
from ultralytics import YOLO
import mediapipe as mp
from mysql.connector import Error


app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "replace_this_123")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
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
            port=os.getenv("MYSQLPORT", "3306"),
            autocommit=True
        )
        logger.info("✅ MySQL connected successfully!")
    except Error as e:
        logger.error(f"❌ DB Initialization Failed: {e}")
        db = None

def get_db():
    global db
    try:
        if db is None or not db.is_connected():
            init_db()
        return db
    except Error:
        init_db()
        return db

def get_db_cursor(buffered=False, dict_cursor=False):
    db_conn = get_db()
    if db_conn is None:
        logger.error("❌ DB not available for cursor request")
        return None
    
    return db_conn.cursor(
        buffered=buffered,
        dictionary=dict_cursor
    )


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

def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            flash("Please login!", "warning")
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return wrapper

@app.route("/")
def home():
    return "Server is running on Railway!"


@app.route("/login", methods=["GET","POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username","").strip()
        password_raw = request.form.get("password","")
        cursor = get_db_cursor()
        cursor.execute("SELECT id,username,password_hash,role,status FROM users WHERE username=%s",(username,))
        user = cursor.fetchone()

        if user and bcrypt.checkpw(password_raw.encode(), user[2].encode()):
            if user[4] != "Active":
                flash("Account inactive!", "danger")
            else:
                session.update({"user_id":user[0],"username":user[1],"role":user[3]})
                return redirect(url_for("admin_page" if user[3]=="admin" else "home"))

        flash("Invalid login!", "danger")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/admin")
@login_required
def admin_page():
    if session.get("role")!="admin":
        return redirect(url_for("home"))
    
    cursor = get_db_cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE status='Active'")
    active_users = cursor.fetchone()[0]

    cursor.execute("SELECT username,role,status FROM users ORDER BY id DESC LIMIT 5")
    users_preview = cursor.fetchall()

    return render_template("admin.html", total_users=total_users,
                           active_users=active_users, users_preview=users_preview,
                           show_sidebar=True)

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

        subjects_list = request.form.getlist("subjects[]")
        subjects_str = ", ".join(subjects_list) if subjects_list else ""

        cursor = get_db_cursor(buffered=True)
        try:
            cursor.execute("SELECT id FROM users WHERE username=%s", (username,))
            if cursor.fetchone():
                flash("Username already exists!", "danger")
            else:
                hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()
                cursor.execute("""
                    INSERT INTO users 
                        (name, username, password_hash, status, created_by, subjects)
                    VALUES (%s, %s, %s, 'Active', %s, %s)
                """, (name, username, hashed_pw, session.get("username"), subjects_str))
                db.commit()
                flash(f"User '{username}' added successfully!", "success")
        except Exception as e:
            db.rollback()
            logger.exception("add_user DB error: %s", e)
            flash("Unable to add user.", "danger")
        finally:
            cursor.close()

        return redirect(url_for("add_user"))

    return render_template("add_user.html", show_sidebar=True)


@app.route("/admin/reset_password/<int:user_id>", methods=["POST"])
@login_required
def reset_password(user_id):
    if session.get("role") != "admin":
        return redirect(url_for("home"))

    cursor = get_db_cursor()
    try:
        hashed_pw = bcrypt.hashpw(b"1234", bcrypt.gensalt()).decode()
        cursor.execute("UPDATE users SET password_hash=%s, updated_by=%s WHERE id=%s",
                       (hashed_pw, session.get("username"), user_id))
        db.commit()
        flash("Password reset to 1234", "info")
    except Exception as e:
        db.rollback()
        logger.exception("reset_password error: %s", e)
        flash("Unable to reset password.", "danger")
    finally:
        cursor.close()

    return redirect(url_for("list_users"))


@app.route("/admin/deactivate_user/<int:user_id>", methods=["POST"])
@login_required
def deactivate_user(user_id):
    if session.get("role") != "admin":
        return redirect(url_for("home"))

    cursor = get_db_cursor()
    try:
        cursor.execute("UPDATE users SET status='Inactive', updated_by=%s WHERE id=%s",
                       (session.get("username"), user_id))
        db.commit()
        flash("User deactivated successfully.", "warning")
    except Exception as e:
        db.rollback()
        logger.exception("deactivate_user error: %s", e)
        flash("Unable to deactivate user.", "danger")
    finally:
        cursor.close()

    return redirect(url_for("list_users"))


@app.route("/admin/delete_user/<int:user_id>", methods=["POST"])
@login_required
def delete_user(user_id):
    if session.get("role") != "admin":
        return redirect(url_for("home"))

    if str(user_id) == str(session.get("user_id")):
        flash("You cannot delete your own account.", "warning")
        return redirect(url_for("admin_page"))

    cursor = get_db_cursor()
    try:
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        db.commit()
        flash("User deleted successfully.", "success")
    except Exception as e:
        db.rollback()
        logger.exception("delete_user error: %s", e)
        flash("Unable to delete user.", "danger")
    finally:
        cursor.close()

    return redirect(url_for("admin_page"))


@app.route("/admin/users")
@login_required
def list_users():
    if session.get("role") != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for("home"))

    cursor = get_db_cursor()
    try:
        cursor.execute("SELECT id, name, username, role, status FROM users WHERE role != 'admin'")
        users = cursor.fetchall()
    except Exception as e:
        logger.exception("list_users error: %s", e)
        users = []
    finally:
        cursor.close()

    return render_template("list_users.html", users=users, show_sidebar=True)


@app.route("/admin/activate_user/<int:user_id>", methods=["POST"])
@login_required
def activate_user(user_id):
    if session.get("role") != "admin":
        return redirect(url_for("home"))

    cursor = get_db_cursor()
    try:
        cursor.execute("UPDATE users SET status='Active', updated_by=%s WHERE id=%s",
                       (session.get("username"), user_id))
        db.commit()
        flash("User activated successfully.", "success")
    except Exception as e:
        db.rollback()
        logger.exception("activate_user error: %s", e)
        flash("Unable to activate user.", "danger")
    finally:
        cursor.close()

    return redirect(url_for("list_users"))


@app.route("/admin/dashboard")
@login_required
def admin_dashboard():
    if session.get("role") != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for("home"))

    cursor = get_db_cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users WHERE status='Active'")
        active_users = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users WHERE status='Inactive'")
        inactive_users = cursor.fetchone()[0]

        cursor.execute("SELECT username, role, status FROM users ORDER BY id DESC LIMIT 5")
        users_preview = cursor.fetchall()
    except Exception as e:
        logger.exception("admin_dashboard error: %s", e)
        total_users = active_users = inactive_users = 0
        users_preview = []
    finally:
        cursor.close()

    return render_template("admin_dashboard.html",
                           total_users=total_users,
                           active_users=active_users,
                           inactive_users=inactive_users,
                           users_preview=users_preview,
                           show_sidebar=True)

# ---------- SocketIO ----------
@socketio.on("frame")
def handle_frame(message):
    global _last_processed_time, last_cheating_notification_time
    global frame_lock, PROCESS_INTERVAL, yolo_model
    global db
    if not frame_lock.acquire(blocking=False):
        return
    try:
        now = time.time()
        if now - _last_processed_time < PROCESS_INTERVAL:
            return
        _last_processed_time = now

        frame = b64_to_cv2(message)
        if frame is None:
            return

        # Predict with YOLO
        results = yolo_model.predict(frame, conf=0.5, verbose=False)
        cheating = any("cheat" in yolo_model.model.names[int(box.cls)] 
                       for box in results[0].boxes)

        if cheating and now - last_cheating_notification_time > 2:
            cursor = get_db_cursor()
            snap_id = str(uuid.uuid4())
            cursor.execute(
                "INSERT INTO detections (id,timestamp,image_path,user_id,assessment_session_id) VALUES (%s,%s,%s,%s,%s)",
                (snap_id, datetime.now(), "snapshot", session.get("user_id"), session.get("assessment_session_id"))
            )
            socketio.emit("cheating_notification", {"message":"Cheating!"})
            last_cheating_notification_time = now

        emit("response_frame", {"cheating": cheating})
    finally:
        frame_lock.release()
# ---------- Main ----------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
