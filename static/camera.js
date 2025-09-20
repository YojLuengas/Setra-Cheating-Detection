import { initSocket, emitFrame } from "./socket.js";

const video = document.getElementById("video-frame");
const canvas = document.createElement("canvas");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const statusDiv = document.getElementById("cheating-status");
const cameraList = document.getElementById("camera-select"); // ✅ match HTML

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
}

async function startCamera() {
  initSocket(video, statusDiv);

  stream = await navigator.mediaDevices.getUserMedia({
    video: currentDeviceId ? { deviceId: { exact: currentDeviceId } } : { width: 960, height: 720 },
    audio: false
  });

  vid = document.createElement("video");
  vid.style.display = "none";
  document.body.appendChild(vid);
  vid.srcObject = stream;
  await vid.play();

  sending = true;
  sendLoop(vid);

  // Show temporary status instead of notification
  showTemporaryStatus("Camera started");
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
    if (videoElement.readyState >= 2) {
      const frameB64 = captureFrame(videoElement);
      emitFrame(frameB64);
    }
    await new Promise(r => setTimeout(r, 250));
  }
}

function captureFrame(videoElement) {
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.6);
}

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

if (startBtn && stopBtn) {
  window.onload = () => {
    setBlackScreen();
    getCameras();
  };
  startBtn.onclick = startCamera;
  stopBtn.onclick = stopCamera;
}

export { getCameras, startCamera, stopCamera };
