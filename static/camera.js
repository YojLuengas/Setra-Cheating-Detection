// Remove import statements for production compatibility
// import { initSocket, emitFrame, disconnectSocket } from "./socket.js";

let video, startBtn, stopBtn, statusDiv, cameraList;
const canvas = document.createElement("canvas");

let stream;
let sending = false;
let currentDeviceId = null;
let vid;
let socket = null;

// Initialize socket connection
function initSocket(videoElement, statusElement) {
    if (socket && socket.connected) {
        return;
    }
    
    socket = io();
    
    socket.on('connect', function() {
        console.log('Connected to server');
        if (statusElement) {
            statusElement.textContent = 'Connected - Ready to monitor';
        }
    });
    
    socket.on('response_frame', function(data) {
        if (videoElement && data.image) {
            videoElement.src = data.image;
        }
        if (statusElement) {
            statusElement.textContent = data.cheating ? 
                'Possible cheating detected!' : 
                'No possible cheating detected';
            statusElement.style.color = data.cheating ? '#dc3545' : '#28a745';
        }
    });
    
    socket.on('cheating_notification', function(data) {
        console.log('Cheating detected:', data);
        // Handle notification
        if (window.addNotification) {
            window.addNotification(data);
        }
    });
    
    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        if (statusElement) {
            statusElement.textContent = 'Disconnected';
        }
    });
}

function emitFrame(frameBuffer) {
    if (socket && socket.connected && frameBuffer) {
        socket.emit('frame', frameBuffer);
    }
}

function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

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
    // Request camera permission first
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
    tempStream.getTracks().forEach(track => track.stop());
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (!cameraList) return;

    cameraList.innerHTML = "";
    
    // Add default option
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Select Camera";
    cameraList.appendChild(defaultOption);
    
    let cameraCount = 0;
    devices.forEach((device, idx) => {
      if (device.kind === "videoinput") {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.text = device.label || `Camera ${cameraCount + 1}`;
        cameraList.appendChild(option);
        cameraCount++;
      }
    });

    if (cameraCount > 0 && !currentDeviceId) {
      const firstCamera = devices.find(d => d.kind === "videoinput");
      if (firstCamera) {
        currentDeviceId = firstCamera.deviceId;
        cameraList.value = currentDeviceId;
      }
    }
    
    console.log(`Found ${cameraCount} cameras`);
  } catch (err) {
    console.error('Error listing cameras:', err);
    if (cameraList) {
      cameraList.innerHTML = '<option value="">Camera access denied</option>';
    }
  }
}

async function startCamera() {
  stopCamera(); // Stop any previous camera before starting new
  try {
    initSocket(video, statusDiv);

    const constraints = {
      video: {
        width: { ideal: 800 },
        height: { ideal: 720 }
      },
      audio: false
    };
    
    if (currentDeviceId) {
      constraints.video.deviceId = { exact: currentDeviceId };
    }

    stream = await navigator.mediaDevices.getUserMedia(constraints);

    vid = document.createElement("video");
    vid.style.display = "none";
    vid.muted = true;
    document.body.appendChild(vid);
    vid.srcObject = stream;
    await vid.play();

    sending = true;
    sendLoop(vid);

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
  disconnectSocket();
  showTemporaryStatus("Camera stopped");
}

function showTemporaryStatus(message, duration = 3000) {
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.style.color = "#222";
    statusDiv.style.fontWeight = "bold";

    setTimeout(() => {
      statusDiv.textContent = "No possible cheating detected";
      statusDiv.style.color = "#222";
      statusDiv.style.fontWeight = "normal";
    }, duration);
  }
}

async function sendLoop(videoElement) {
  while (sending) {
    if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
      const frameBuffer = await captureFrame(videoElement);
      if (frameBuffer && frameBuffer.byteLength > 100) {
        emitFrame(frameBuffer);
      }
    }
    await new Promise(r => setTimeout(r, 150));
  }
}

function captureFrame(videoElement) {
  return new Promise((resolve) => {
    canvas.width = 800;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoElement, 0, 0, 800, 720);
    canvas.toBlob((blob) => {
      if (blob) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsArrayBuffer(blob);
      } else {
        resolve(null);
      }
    }, 'image/jpeg', 0.6);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  video = document.getElementById("video-frame");
  startBtn = document.getElementById("start-btn");
  stopBtn = document.getElementById("stop-btn");
  statusDiv = document.getElementById("cheating-status");
  cameraList = document.getElementById("camera-select");

  setBlackScreen();
  
  // Wait a bit before getting cameras to ensure page is fully loaded
  setTimeout(() => {
    getCameras();
  }, 1000);

  if (cameraList) {
    cameraList.addEventListener("change", async () => {
      currentDeviceId = cameraList.value;
      if (sending) {
        stopCamera();
        await new Promise(r => setTimeout(r, 500)); // Small delay
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

// Export functions for global access
window.stopCamera = stopCamera;
window.getCameras = getCameras;
window.startCamera = startCamera;