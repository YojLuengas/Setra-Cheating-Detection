import io
import base64
import time
import cv2
import numpy as np
from PIL import Image
from flask import Flask, render_template, redirect, url_for
from flask_socketio import SocketIO, emit
import mediapipe as mp
from ultralytics import YOLO

# Flask + SocketIO (use eventlet or gevent)
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Load YOLO model (put your downloaded best.pt in model folder)
MODEL_PATH = "models/best.pt"  # adjust path
yolo_model = YOLO(MODEL_PATH)

# MediaPipe setup
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False,
                                  max_num_faces=1,
                                  refine_landmarks=True,
                                  min_detection_confidence=0.5,
                                  min_tracking_confidence=0.5)

# Helper: decode base64 jpeg to cv2 image
def b64_to_cv2(data_b64):
    header, b64 = data_b64.split(',', 1)
    img_bytes = base64.b64decode(b64)
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    cv_img = np.array(img)[:, :, ::-1].copy()  # RGB->BGR
    return cv_img

# Helper: encode cv2 image to base64 jpeg
def cv2_to_b64(img, jpeg_quality=70):
    _, buffer = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
    b64 = base64.b64encode(buffer).decode('utf-8')
    return 'data:image/jpeg;base64,' + b64

# Simple head yaw/pitch estimation using face mesh
def estimate_head_rotation(image_rgb, face_landmarks):
    # We'll compute a rough yaw using left-right eye landmark x positions
    # Landmarks: 33 (left eye outer), 263 (right eye outer) approx in FaceMesh
    h, w, _ = image_rgb.shape
    try:
        lmk = face_landmarks.landmark
        left_x = lmk[33].x * w
        right_x = lmk[263].x * w
        nose_x = lmk[1].x * w  # tip of nose
        # yaw proxy: if nose closer to left or right eye extremes
        yaw = (nose_x - (left_x + right_x) / 2) / w  # normalized
        return float(yaw)
    except Exception:
        return 0.0

# Frame-level sliding counters (very simple global)
frame_counters = {}  # keyed by session id if multi-user

@socketio.on('connect')
def on_connect():
    print("Client connected")
    emit('connected', {'data': 'ready'})

@socketio.on('frame')
def handle_frame(message):
    """
    message: { "image": "data:image/jpeg;base64,..." }
    """
    img_b64 = message.get('image')
    if not img_b64:
        return
    frame = b64_to_cv2(img_b64)
    original = frame.copy()

    # Resize down for faster inference
    h, w = frame.shape[:2]
    scale = 640 / max(h, w)
    small = cv2.resize(frame, (int(w * scale), int(h * scale)))

    # Run YOLO detection
    results = yolo_model.predict(small, imgsz=640, conf=0.35, verbose=False)
    # results is a list; get first
    detections = []
    if len(results) > 0:
        r = results[0]
        boxes = r.boxes  # ultralytics Boxes object
        for box in boxes:
            xyxy = box.xyxy[0].cpu().numpy()
            conf = float(box.conf[0].cpu().numpy())
            cls = int(box.cls[0].cpu().numpy())
            label = yolo_model.model.names.get(cls, str(cls))
            # scale coords back to original frame size
            x1, y1, x2, y2 = [int(v / scale) for v in xyxy]
            detections.append((label, conf, (x1, y1, x2, y2)))

    # Draw detections and simple alert flags
    alert_msgs = []
    cheating_detected = False
    for label, conf, (x1, y1, x2, y2) in detections:
        cv2.rectangle(original, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(original, f"{label} {conf:.2f}", (x1, y1 - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        if label.lower() in ['phone', 'calculator', 'handheld_device', 'notes', 'paper']:
            alert_msgs.append(f"{label} detected")
            cheating_detected = True

    # MediaPipe face mesh detection for head rotation
    image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results_face = face_mesh.process(image_rgb)
    if results_face.multi_face_landmarks:
        # take first face
        face_landmarks = results_face.multi_face_landmarks[0]
        yaw = estimate_head_rotation(image_rgb, face_landmarks)  # normalized (-0.5 .. 0.5 approx)
        # scale to degrees-ish proxy
        yaw_deg = yaw * 90
        if abs(yaw_deg) > 25:
            alert_msgs.append("Looking away (head turned)")
            cheating_detected = True
        # draw a small overlay
        cv2.putText(original, f"Yaw:{yaw_deg:.1f}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)

    # Compose status
    status_text = "OK" if len(alert_msgs) == 0 else "; ".join(alert_msgs)
    if len(alert_msgs) > 0:
        cv2.putText(original, f"ALERT: {status_text}", (10, original.shape[0]-20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    else:
        cv2.putText(original, status_text, (10, original.shape[0]-20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    # send annotated frame back
    out_b64 = cv2_to_b64(original, jpeg_quality=60)
    emit('response_frame', {'image': out_b64, 'cheating': cheating_detected})

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/cheating")
def cheating():
    return render_template("cheating.html")

if __name__ == "__main__":
    host = "0.0.0.0"
    port = 5000
    print(f"🚀 Server running at: http://127.0.0.1:{port}")
    print(f"🌐 Accessible on your network at: http://{host}:{port}")
    socketio.run(app, host=host, port=port, debug=True)  # Start the SocketIO server
