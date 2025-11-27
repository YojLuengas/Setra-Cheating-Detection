import { initSocket, emitFrame, disconnectSocket } from "./socket.js";

let video, startBtn, stopBtn, statusDiv, cameraList;
const canvas = document.createElement("canvas");

let streams = {};
let sending = false;
let currentDeviceIds = [];
let vids = {};

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
    // Request camera permissions first to get device labels
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
    tempStream.getTracks().forEach(track => track.stop());
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === "videoinput");
    
    if (!cameraList) return videoDevices;

    cameraList.innerHTML = "";
    videoDevices.forEach((device, idx) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.text = device.label || `Camera ${idx + 1}`;
      cameraList.appendChild(option);
    });

    if (videoDevices.length > 0 && currentDeviceIds.length === 0) {
      currentDeviceIds = [videoDevices[0].deviceId];
      cameraList.value = currentDeviceIds[0];
    }
    
    return videoDevices;
  } catch (err) {
    console.error('Error listing cameras:', err);
    return [];
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
      if (select.value && select.value !== "") {
        currentDeviceIds.push(select.value);
      }
    });

    if (currentDeviceIds.length === 0) {
      throw new Error("At least 1 camera must be selected");
    }

    console.log("Starting cameras with IDs:", currentDeviceIds);

    // Ensure camera feeds container exists
    let cameraFeedsContainer = document.getElementById("camera-feeds");
    if (!cameraFeedsContainer) {
      // Create container if it doesn't exist
      const cameraContainer = document.querySelector(".camera-container");
      if (cameraContainer) {
        cameraFeedsContainer = document.createElement("div");
        cameraFeedsContainer.id = "camera-feeds";
        cameraFeedsContainer.className = "camera-feeds";
        cameraContainer.appendChild(cameraFeedsContainer);
      } else {
        throw new Error("Camera container not found");
      }
    }

    cameraFeedsContainer.innerHTML = ""; // Clear existing feeds
    
    // Set the grid layout based on number of cameras
    const numCameras = currentDeviceIds.length;
    if (numCameras === 1) {
      cameraFeedsContainer.className = "camera-feeds single-camera";
    } else if (numCameras === 2) {
      cameraFeedsContainer.className = "camera-feeds dual-camera";
    } else if (numCameras <= 4) {
      cameraFeedsContainer.className = "camera-feeds quad-camera";
    } else {
      cameraFeedsContainer.className = "camera-feeds multi-camera";
    }

    // Start cameras based on selected number
    for (let i = 0; i < currentDeviceIds.length; i++) {
      try {
        console.log(`Starting camera ${i} with device ID: ${currentDeviceIds[i]}`);
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: currentDeviceIds[i] },
            width: { ideal: 800 },
            height: { ideal: 720 }
          },
          audio: false
        });
        
        streams[i] = stream;

        const vid = document.createElement("video");
        vid.style.display = "none";
        vid.muted = true;
        vid.autoplay = true;
        vid.playsInline = true;
        vid.id = `camera-video-${i}`;
        document.body.appendChild(vid);
        vid.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          vid.onloadedmetadata = resolve;
          vid.onerror = reject;
          setTimeout(() => reject(new Error('Video load timeout')), 5000);
        });
        
        await vid.play();
        vids[i] = vid;

        // Create dynamic camera feed UI with responsive sizing
        const feedDiv = document.createElement("div");
        feedDiv.className = "camera-feed";
        feedDiv.innerHTML = `
          <div class="camera-feed-header">
            <h4>Camera ${i + 1}</h4>
            <span class="camera-status online">●</span>
          </div>
          <div class="camera-video-wrapper">
            <img id="camera-feed-${i}" class="camera-feed-img" src="" alt="Camera ${i + 1} Feed" />
            <div class="camera-overlay" id="camera-overlay-${i}" style="opacity: 0;">
              <i class="fa-solid fa-video"></i>
              <p>Camera Active</p>
            </div>
          </div>
        `;
        
        cameraFeedsContainer.appendChild(feedDiv);
        
        console.log(`Camera ${i} started successfully`);
      } catch (cameraError) {
        console.error(`Error starting camera ${i}:`, cameraError);
        
        // Create error feed for failed camera
        const errorDiv = document.createElement("div");
        errorDiv.className = "camera-feed error";
        errorDiv.innerHTML = `
          <div class="camera-feed-header">
            <h4>Camera ${i + 1}</h4>
            <span class="camera-status error">●</span>
          </div>
          <div class="camera-video-wrapper">
            <div class="camera-overlay" style="opacity: 1;">
              <i class="fa-solid fa-exclamation-triangle"></i>
              <p>Camera Error</p>
            </div>
          </div>
        `;
        cameraFeedsContainer.appendChild(errorDiv);
      }
    }

    sending = true;
    
    // Start sending loops for all successfully started cameras
    Object.keys(vids).forEach(index => {
      sendLoop(vids[index], parseInt(index));
    });

    // Show temporary status
    showTemporaryStatus(`${Object.keys(vids).length}/${currentDeviceIds.length} camera(s) started`);
  } catch (err) {
    console.error('Error starting cameras:', err);
    showTemporaryStatus('Error starting cameras: ' + err.message);
  }
}

function stopCamera() {
  sending = false;
  
  // Stop all streams
  Object.values(streams).forEach(stream => {
    if (stream) {
      try {
        stream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) { console.warn("Error stopping track:", e); }
        });
      } catch (e) { console.warn("Error stopping stream:", e); }
    }
  });
  streams = {};

  // Remove all video elements
  Object.values(vids).forEach(vid => {
    if (vid) {
      try {
        vid.srcObject = null;
        vid.remove();
      } catch (e) { console.warn("Error removing vid:", e); }
    }
  });
  vids = {};

  // Clear camera feeds
  const cameraFeedsContainer = document.getElementById("camera-feeds");
  if (cameraFeedsContainer) {
    cameraFeedsContainer.innerHTML = "";
  }

  setBlackScreen();

  // Close socket connection to ensure new session on reconnect
  disconnectSocket();

  showTemporaryStatus("Cameras stopped");
}

// Helper: show text for a few seconds
function showTemporaryStatus(message, duration = 3000) {
  if (!statusDiv) return;
  
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
  console.log(`Starting send loop for camera ${cameraIndex}`);
  
  while (sending) {
    if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
      try {
        const frameB64 = captureFrame(videoElement);
        if (frameB64 && frameB64.length > 100) {
          emitFrame(frameB64, cameraIndex);
        }
      } catch (frameError) {
        console.error(`Frame capture error for camera ${cameraIndex}:`, frameError);
      }
    }
    
    // ~10 FPS to balance performance and detection quality
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`Send loop stopped for camera ${cameraIndex}`);
}

function captureFrame(videoElement) {
  try {
    canvas.width = videoElement.videoWidth || 800;
    canvas.height = videoElement.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch (error) {
    console.error("Frame capture error:", error);
    return null;
  }
}

// Function to start multiple cameras (called from setup.js)
async function startMultipleCameras(selectedCameraIds) {
  console.log("Starting multiple cameras:", selectedCameraIds);
  currentDeviceIds = selectedCameraIds;
  await startCamera();
}

// Function to stop all cameras (called from setup.js)
function stopAllCameras() {
  console.log("Stopping all cameras");
  stopCamera();
}

document.addEventListener("DOMContentLoaded", () => {
  video = document.getElementById("video-frame");
  startBtn = document.getElementById("start-btn");
  stopBtn = document.getElementById("stop-btn");
  statusDiv = document.getElementById("cheating-status");
  cameraList = document.getElementById("camera-select");

  setBlackScreen();
  getCameras();

  // Dropdown change = switch camera automatically (for single camera mode)
  if (cameraList) {
    cameraList.addEventListener("change", async () => {
      const newDeviceId = cameraList.value;
      if (newDeviceId !== currentDeviceIds[0]) {
        currentDeviceIds = [newDeviceId];
        if (sending) {
          stopCamera();
          await startCamera();
        }
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

// Make functions available globally
window.stopCamera = stopCamera;
window.startMultipleCameras = startMultipleCameras;
window.stopAllCameras = stopAllCameras;

export { getCameras, startCamera, stopCamera, startMultipleCameras, stopAllCameras };