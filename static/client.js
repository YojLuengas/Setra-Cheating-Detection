const video = document.getElementById('video-frame');
const canvas = document.createElement('canvas');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const notifications = document.getElementById('notifications');
const statusDiv = document.getElementById('cheating-status');

// --- Modal elements ---
const cheatingModal = document.getElementById("cheating-modal");
const cheatingImg = document.getElementById("cheating-snapshot");
const cheatingTimestamp = document.getElementById("cheating-timestamp");

let stream;
let sending = false;
let socket;

// --- Track seen snapshot IDs (prevent duplicates) ---
const seenSnapshots = new Set();

// --- Black screen fallback ---
function setBlackScreen() {
  const black = document.createElement('canvas');
  black.width = 960;
  black.height = 720;
  const ctx = black.getContext('2d');
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, black.width, black.height);
  video.src = black.toDataURL('image/png');
}
window.onload = setBlackScreen;

// --- Modal controls ---
function openCheatingModal(url) {
  fetch(url)
    .then(res => res.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Extract image + timestamp
      const img = doc.querySelector("img");
      const timestamp = doc.querySelector("p");

      cheatingImg.src = img ? img.src : "";
      cheatingTimestamp.textContent = timestamp ? timestamp.textContent : "";

      cheatingModal.style.display = "flex";
    })
    .catch(err => console.error("Error loading snapshot:", err));
}

function closeCheatingModal() {
  cheatingModal.style.display = "none";
}

// --- Notification helper ---
function addNotification(message) {
  if (notifications.firstChild && notifications.firstChild.textContent === "No alerts yet") {
    notifications.removeChild(notifications.firstChild);
  }
  const li = document.createElement("li");
  li.textContent = message;
  notifications.prepend(li);
}

// --- Start camera and connect to server ---
startBtn.onclick = async () => {
  if (!socket) {
    socket = io({ transports: ['websocket'] });

    socket.on('connect', () => {
      addNotification("Connected to server.");
    });

    socket.on('response_frame', (msg) => {
      video.src = msg.image;
      if (msg.cheating) {
        statusDiv.textContent = "Cheating detected!";
        statusDiv.style.color = "#ff4444";
        statusDiv.style.fontWeight = "bold";
      } else {
        statusDiv.textContent = "No cheating detected";
        statusDiv.style.color = "#228B22";
        statusDiv.style.fontWeight = "bold";
      }
    });

    // 🔴 Cheating notifications -> open modal instead of navigating
    socket.on('cheating_notification', (data) => {
      if (!seenSnapshots.has(data.url)) {
        seenSnapshots.add(data.url);

        if (notifications.firstChild && notifications.firstChild.textContent === "No alerts yet") {
          notifications.removeChild(notifications.firstChild);
        }
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#"; // prevent navigation
        a.textContent = data.message;
        a.style.color = "#ff4444";
        a.style.fontWeight = "bold";
        a.onclick = (e) => {
          e.preventDefault();
          openCheatingModal(data.url);
        };
        li.appendChild(a);
        notifications.prepend(li);
      }
    });
  }

  // Start webcam stream
  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 960, height: 720 },
    audio: false
  });

  const vid = document.createElement("video");
  vid.srcObject = stream;
  vid.play();
  sending = true;

  sendLoop(vid);
  addNotification("Camera started");
};

// --- Stop camera ---
stopBtn.onclick = () => {
  sending = false;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  setBlackScreen();
  statusDiv.textContent = "No cheating detected";
  statusDiv.style.color = "#222";
  statusDiv.style.fontWeight = "normal";
  addNotification("Camera stopped");
};

// --- Capture frame from video and send ---
function captureFrame(vid) {
  canvas.width = vid.videoWidth;
  canvas.height = vid.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.6);
}

// --- Send frames to server loop (~4fps) ---
async function sendLoop(vid) {
  while (sending) {
    if (vid.readyState >= 2 && socket && socket.connected) {
      const frameB64 = captureFrame(vid);
      socket.emit('frame', { image: frameB64 });
    }
    await new Promise(r => setTimeout(r, 250)); // ~4 fps
  }
}
