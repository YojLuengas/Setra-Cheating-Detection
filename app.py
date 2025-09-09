import io
import base64
import time
import uuid
import os
import cv2
import numpy as np
from PIL import Image
from flask import Flask, render_template, make_response, send_file, redirect, url_for, request
from flask_socketio import SocketIO, emit
import mediapipe as mp
from ultralytics import YOLO
import mysql.connector

# Ensure snapshots directory exists
if not os.path.exists("snapshots"):
    os.makedirs("snapshots")

# Global DB connection
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="",
    database="sentra_db"
)
cursor = db.cursor()

# Flask + SocketIO
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Load YOLO model
MODEL_PATH = "models/best.pt"
yolo_model = YOLO(MODEL_PATH)

# MediaPipe
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=10,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Store snapshots
all_snapshots = []        # all detections
notified_snapshots = []   # ✅ only snapshots shown in notifications
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

# --- Socket Events ---
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

            snap_id = str(uuid.uuid4())
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

            # Save snapshot locally
            filename = f"{snap_id}.jpg"
            filepath = os.path.join("snapshots", filename)
            cv2.imwrite(filepath, original)

            snapshot = {
                "id": snap_id,
                "image": None,
                "timestamp": timestamp,
                "epoch": now,
                "filepath": filepath
            }

            # Insert into DB
            try:
                sql = "INSERT INTO detections (id, timestamp, epoch, image_path) VALUES (%s, %s, %s, %s)"
                vals = (snap_id, timestamp, now, filepath)
                cursor.execute(sql, vals)
                db.commit()
                print(f"Inserted cheating detection {snap_id} into DB with file path.")
            except Exception as e:
                print(f"DB insert error: {e}")

            all_snapshots.append(snapshot)
            notified_snapshots.append(snapshot)

            socketio.emit('cheating_notification', {
                'message': f'Cheating detected at {timestamp}! Click for details.',
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

# --- Routes ---
@app.route("/")
def home():
    return render_template("index.html", cheating_snapshots=notified_snapshots)

@app.route("/cheating/<snap_id>")
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
def cheating_snapshot(snap_id):
    snap = next((s for s in all_snapshots if s["id"] == snap_id), None)
    if snap and "filepath" in snap and os.path.exists(snap["filepath"]):
        return send_file(snap["filepath"], mimetype='image/jpeg')
    return "Snapshot not found", 404

@app.route("/delete_detection/<snap_id>", methods=["POST"])
def delete_detection(snap_id):
    # Find snapshot in memory
    snap = next((s for s in notified_snapshots if s["id"] == snap_id), None)

    # Delete from DB
    try:
        cursor.execute("DELETE FROM detections WHERE id = %s", (snap_id,))
        db.commit()
        print(f"Deleted detection {snap_id} from DB.")
    except Exception as e:
        print(f"Error deleting from DB: {e}")

    # Delete image file
    if snap and "filepath" in snap and os.path.exists(snap["filepath"]):
        try:
            os.remove(snap["filepath"])
            print(f"Deleted snapshot file: {snap['filepath']}")
        except Exception as e:
            print(f"Error deleting file: {e}")

    # Remove from memory
    notified_snapshots[:] = [s for s in notified_snapshots if s["id"] != snap_id]
    all_snapshots[:] = [s for s in all_snapshots if s["id"] != snap_id]

    return redirect(url_for('home'))

# --- Run ---
if __name__ == "__main__":
    host = "0.0.0.0"
    port = 5000
    print(f"🚀 Server running at: http://127.0.0.1:{port}")
    print(f"🌐 Accessible on your network at: http://{host}:{port}")
    socketio.run(app, host=host, port=port, debug=True)
