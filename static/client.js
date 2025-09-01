const video = document.getElementById('video-frame');  // match your index.html
const canvas = document.createElement('canvas'); // offscreen buffer
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const notifications = document.getElementById('notifications');

let stream;
let sending = false;
let socket;

// --- Notification helpers ---
function addNotification(message) {
  // Remove "No alerts yet" if present
  if (notifications.firstChild && notifications.firstChild.textContent === "No alerts yet") {
    notifications.removeChild(notifications.firstChild);
  }
  const li = document.createElement("li");
  li.textContent = message;
  notifications.prepend(li);
}

function addCheatingNotification() {
  // Don’t add duplicate cheating links
  for (let i = 0; i < notifications.children.length; i++) {
    const li = notifications.children[i];
    if (li.querySelector('a') && li.querySelector('a').href.includes("/cheating")) {
      return;
    }
  }
  // Remove "No alerts yet" if present
  if (notifications.firstChild && notifications.firstChild.textContent === "No alerts yet") {
    notifications.removeChild(notifications.firstChild);
  }
  const li = document.createElement("li");
  li.classList.add("alert");
  const a = document.createElement("a");
  a.href = "/cheating";
  a.textContent = "Cheating detected! Click here for details.";
  a.style.color = "#ff4444";
  a.style.fontWeight = "bold";
  li.appendChild(a);
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
      // Update video-frame with AI-processed frame
      video.src = msg.image;

      // If cheating flagged, add notification
      if (msg.cheating) {
        addCheatingNotification();
      }
    });
  }

  stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
  const vid = document.createElement("video");
  vid.srcObject = stream;
  vid.play();
  sending = true;

  // Loop sending frames
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
  video.src = ""; // clears image
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

async function sendLoop(vid) {
  while (sending) {
    if (vid.readyState >= 2 && socket && socket.connected) {
      const frameB64 = captureFrame(vid);
      socket.emit('frame', { image: frameB64 });
    }
    await new Promise(r => setTimeout(r, 250)); // ~4 fps
  }
}
