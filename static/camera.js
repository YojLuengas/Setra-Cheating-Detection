import { initSocket, emitFrame, disconnectSocket } from "./socket.js";

let video, startBtn, stopBtn, statusDiv, cameraList;
const canvas = document.createElement("canvas");

let streams = [];
let sending = false;
let currentDeviceIds = [];
let vids = [];
let cameraFeeds = [];

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
  stopCamera(); // Stop any previous cameras before starting new
  try {
    initSocket(video, statusDiv);

    // Get selected camera IDs from setup (dynamic number)
    currentDeviceIds = [];
    const cameraSelects = document.querySelectorAll('.camera-select');
    cameraSelects.forEach(select => {
      if (select.value) {
        currentDeviceIds.push(select.value);
      }
    });

    if (currentDeviceIds.length === 0) {
      throw new Error("At least 1 camera must be selected");
    }

    // Dynamically create camera feeds based on selected cameras
    const cameraFeedsContainer = document.getElementById("camera-feeds");
    cameraFeedsContainer.innerHTML = ""; // Clear existing feeds

    // Start cameras based on selected number
    for (let i = 0; i < currentDeviceIds.length; i++) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: currentDeviceIds[i] },
          width: 800,
          height: 720
        },
        audio: false
      });
      streams.push(stream);

      const vid = document.createElement("video");
      vid.style.display = "none";
      vid.muted = true;
      document.body.appendChild(vid);
      vid.srcObject = stream;
      await vid.play();
      vids.push(vid);

      // Create dynamic camera feed
      const feedDiv = document.createElement("div");
      feedDiv.className = "camera-feed";
      const feedVideo = document.createElement("img");
      feedVideo.id = `camera-feed-${i}`;
      feedVideo.src = ""; // Placeholder, will be updated with processed frames
      const feedLabel = document.createElement("div");
      feedLabel.className = "feed-label";
      feedLabel.textContent = `Camera ${i + 1}`;
      feedDiv.appendChild(feedVideo);
      feedDiv.appendChild(feedLabel);
      cameraFeedsContainer.appendChild(feedDiv);
    }

    sending = true;
    // Start sending loops for all cameras
    for (let i = 0; i < currentDeviceIds.length; i++) {
      sendLoop(vids[i], i);
    }

    // Show temporary status instead of notification
    showTemporaryStatus(`${currentDeviceIds.length} camera(s) started`);
  } catch (err) {
    console.error('Error starting cameras:', err);
    showTemporaryStatus('Error starting cameras: ' + err.message);
  }
}

function stopCamera() {
  sending = false;
  // Stop all streams
  streams.forEach(stream => {
    if (stream) {
      try {
        stream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) { console.warn("Error stopping track:", e); }
        });
      } catch (e) { console.warn("Error stopping stream:", e); }
    }
  });
  streams = [];

  // Remove all vids
  vids.forEach(vid => {
    if (vid) {
      try {
        vid.srcObject = null;
        vid.remove();
      } catch (e) { console.warn("Error removing vid:", e); }
    }
  });
  vids = [];

  // Clear camera feeds dynamically
  const cameraFeedsContainer = document.getElementById("camera-feeds");
  if (cameraFeedsContainer) {
    cameraFeedsContainer.innerHTML = ""; // Clear all dynamic feeds
  }

  setBlackScreen();

  // Close socket connection to ensure new session on reconnect
  disconnectSocket();

  showTemporaryStatus("Cameras stopped");
}

//helper: show text for a few seconds
function showTemporaryStatus(message, duration = 3000) {
  statusDiv.textContent = message;
  statusDiv.style.color = "#222";
  statusDiv.style.fontWeight = "bold";

  setTimeout(() => {
    statusDiv.textContent = "No possible cheating detected";
    statusDiv.style.color = "#222";
    statusDiv.style.fontWeight = "normal";
  }, duration);
}


async function sendLoop(videoElement, cameraIndex) {
  while (sending) {
    if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
      const frameB64 = captureFrame(videoElement);
      if (frameB64 && frameB64.length > 100) {  // Basic check for valid data URL
        emitFrame(frameB64, cameraIndex);
      }
    }
    // Increased frequency to ~20 FPS to reduce lag (100ms -> 50ms)
    await new Promise(r => setTimeout(r, 50));
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
