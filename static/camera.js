import { initSocket, emitFrame, disconnectSocket } from "./socket.js";

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
      video: {
        deviceId: currentDeviceId ? { exact: currentDeviceId } : undefined,
        width: 800,
        height: 720
      },
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
    try {
      stream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) { console.warn("Error stopping track:", e); }
      });
    } catch (e) { console.warn("Error stopping stream:", e); }
    stream = null;
  }
  if (vid) {
    try {
      vid.srcObject = null;
      vid.remove();
    } catch (e) { console.warn("Error removing vid:", e); }
    vid = null;
  }
  setBlackScreen();

  // Close socket connection to ensure new session on reconnect
  disconnectSocket();

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
      }
    }
    // Increased frequency to ~4 FPS to reduce lag (333ms -> 250ms)
    await new Promise(r => setTimeout(r, 250));
  }
}

function captureFrame(videoElement) {
  canvas.width = 800;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoElement, 0, 0, 800, 720);
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
