import { initSocket, emitFrame } from "./socket.js";

let video, startBtn, stopBtn, statusDiv, cameraList;
const canvas = document.createElement("canvas");

let stream;
let sending = false;
let currentDeviceId = null;
let vid;

function setBlackScreen() {
  if (!video) return;
  const black = document.createElement("canvas");
  black.width = 960;
  black.height = 720;
  const ctx = black.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, black.width, black.height);
  video.src = black.toDataURL("image/png");
}

async function getCameras() {
  try {
    // Request permission first to populate device labels
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
    tempStream.getTracks().forEach(t => t.stop());
  } catch (err) {
    console.error('Error requesting camera permission:', err);
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (!cameraList) return;

    cameraList.innerHTML = "";
    devices.forEach((device, idx) => {
      if (device.kind === "videoinput") {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.text = device.label || `Camera ${idx + 1}`;
        cameraList.appendChild(option);
      }
    });

    if (devices.length > 0 && !currentDeviceId) {
      currentDeviceId = devices.find(d => d.kind === "videoinput").deviceId;
      cameraList.value = currentDeviceId;
    }
  } catch (err) {
    console.error('Error listing cameras:', err);
  }
}

async function startCamera() {
  stopCamera(); // Stop any previous camera before starting new
  try {
    initSocket(video, statusDiv);

    stream = await navigator.mediaDevices.getUserMedia({
      video: currentDeviceId ? { deviceId: { exact: currentDeviceId } } : true,
      audio: false
    });

    vid = document.createElement("video");
    vid.style.display = "none";
    vid.muted = true;
    document.body.appendChild(vid);
    vid.srcObject = stream;
    await vid.play();

    sending = true;
    sendLoop(vid);

    // Show temporary status instead of notification
    showTemporaryStatus("Camera started");
  } catch (err) {
    console.error('Error starting camera:', err);
    showTemporaryStatus('Error starting camera: ' + err.message);
  }
}

function stopCamera() {
  sending = false;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (vid) {
    vid.srcObject = null;
    vid.remove();
    vid = null;
  }
  setBlackScreen();

  showTemporaryStatus("Camera stopped");
}

//helper: show text for a few seconds
function showTemporaryStatus(message, duration = 3000) {
  statusDiv.textContent = message;
  statusDiv.style.color = "#222";
  statusDiv.style.fontWeight = "bold";

  setTimeout(() => {
    statusDiv.textContent = "No cheating detected";
    statusDiv.style.color = "#222";
    statusDiv.style.fontWeight = "normal";
  }, duration);
}


async function sendLoop(videoElement) {
  while (sending) {
    if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
      const frameB64 = captureFrame(videoElement);
      if (frameB64 && frameB64.length > 100) {  // Basic check for valid data URL
        emitFrame(frameB64);
        video.src = frameB64;
      }
    }
    await new Promise(r => setTimeout(r, 250));
  }
}

function captureFrame(videoElement) {
  const vw = videoElement.videoWidth;
  const vh = videoElement.videoHeight;
  const size = Math.min(vw, vh);
  const sx = (vw - size) / 2;
  const sy = (vh - size) / 2;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoElement, sx, sy, size, size, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.6);
}

document.addEventListener("DOMContentLoaded", () => {
  video = document.getElementById("video-frame");
  startBtn = document.getElementById("start-btn");
  stopBtn = document.getElementById("stop-btn");
  statusDiv = document.getElementById("cheating-status");
  cameraList = document.getElementById("camera-select");

  setBlackScreen();
  getCameras();

  //Dropdown change = switch camera automatically
  if (cameraList) {
    cameraList.addEventListener("change", async () => {
      currentDeviceId = cameraList.value;
      if (sending) {
        stopCamera();
        await startCamera();
      }
    });
  }

  if (startBtn) {
    startBtn.onclick = startCamera;
  }
  if (stopBtn) {
    stopBtn.onclick = stopCamera;
  }
});

window.stopCamera = stopCamera;
export { getCameras, startCamera, stopCamera };
