const video = document.getElementById('video-frame');
const canvas = document.createElement('canvas');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const notifications = document.getElementById('notifications');
const statusDiv = document.getElementById('cheating-status');

let stream;
let sending = false;
let socket;

// --- Track seen snapshot IDs (prevent duplicates) ---
const seenSnapshots = new Set();

// --- Black screen fallback ---
function setBlackScreen() {
  if (!video) return; // only run if video element exists
  const black = document.createElement('canvas');
  black.width = 960;
  black.height = 720;
  const ctx = black.getContext('2d');
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, black.width, black.height);
  video.src = black.toDataURL('image/png');
}

// --- Notification helper ---
function addNotification(message) {
  if (!notifications) return;
  if (notifications.firstChild && notifications.firstChild.textContent === "No alerts yet") {
    notifications.removeChild(notifications.firstChild);
  }
  const li = document.createElement("li");
  li.textContent = message;
  notifications.prepend(li);
}

// --- Init socket ---
function initSocket() {
  if (!socket) {
    socket = io({ transports: ['websocket'] });

    socket.on('connect', () => {
      console.log("✅ Connected to server");
      if (notifications) addNotification("Connected to server.");
    });

    // --- Camera live feed updates ---
    socket.on('response_frame', (msg) => {
      if (!video) return;
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

    // --- Cheating notification (works for both camera page + cheating page) ---
    socket.on('cheating_notification', (data) => {
      if (!seenSnapshots.has(data.url)) {
        seenSnapshots.add(data.url);

        // If on camera page -> add clickable notification
        if (notifications) {
          if (notifications.firstChild && notifications.firstChild.textContent === "No alerts yet") {
            notifications.removeChild(notifications.firstChild);
          }

          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = "#";
          a.textContent = data.message;
          a.style.color = "#ff4444";
          a.style.fontWeight = "bold";
          a.style.textDecoration = "underline";
          a.style.cursor = "pointer";

          a.onclick = (e) => {
            e.preventDefault();
            window.open(data.url, "_blank");
          };

          li.appendChild(a);
          notifications.prepend(li);
        }

        // If on cheating page -> update timeline live
        const timeline = document.getElementById("timeline");
        if (timeline) {
          const snapId = data.url.split("/").pop();
          const timestampMatch = data.message.match(/at (.+)!/);
          const timestamp = timestampMatch ? timestampMatch[1] : new Date().toLocaleString();
          const epoch = Date.now() / 1000;

          const point = document.createElement("div");
          point.className = "timeline-point";
          point.dataset.id = snapId;
          point.dataset.timestamp = timestamp;
          point.dataset.epoch = epoch;
          point.title = "Taken at " + timestamp;

          timeline.appendChild(point);
          refreshTimeline(); // recalc positions + bind click events
          autoSwitchTo(point); // auto show newest snapshot
        }
      }
    });
  }
}

// --- Camera page logic ---
if (startBtn && stopBtn) {
  window.onload = setBlackScreen;

  startBtn.onclick = async () => {
    initSocket();

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

  async function sendLoop(vid) {
    while (sending) {
      if (vid.readyState >= 2 && socket && socket.connected) {
        const frameB64 = captureFrame(vid);
        socket.emit('frame', { image: frameB64 });
      }
      await new Promise(r => setTimeout(r, 250));
    }
  }

  function captureFrame(vid) {
    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  }
}

// --- Timeline refresh helper ---
function refreshTimeline() {
  const timeline = document.getElementById("timeline");
  if (!timeline) return;
  const points = timeline.querySelectorAll(".timeline-point");
  if (points.length === 0) return;

  const epochs = Array.from(points).map(p => parseFloat(p.dataset.epoch)).filter(e => !isNaN(e));
  const minTime = Math.min(...epochs);
  const maxTime = Math.max(...epochs);
  const span = maxTime > minTime ? maxTime - minTime : 1;

  points.forEach(p => {
    const epoch = parseFloat(p.dataset.epoch);
    const pos = ((epoch - minTime) / span) * 100;
    p.style.left = pos + "%";

    p.onclick = () => {
      const snapId = p.dataset.id;
      const timestamp = p.dataset.timestamp;

      document.querySelector(".snapshot-img").src = "/cheating_snapshot/" + snapId;
      document.getElementById("snapshot-timestamp").textContent = "Snapshot at: " + timestamp;

      points.forEach(tp => tp.classList.remove("active"));
      p.classList.add("active");
    };
  });

  // update labels
  const sorted = Array.from(points).sort((a, b) => a.dataset.epoch - b.dataset.epoch);
  const startLabel = document.getElementById("timeline-start");
  const endLabel = document.getElementById("timeline-end");
  if (startLabel && endLabel) {
    startLabel.textContent = sorted[0].dataset.timestamp;
    endLabel.textContent = sorted[sorted.length - 1].dataset.timestamp;
  }
}

// --- Auto switch to newest snapshot ---
function autoSwitchTo(point) {
  if (!point) return;
  const snapId = point.dataset.id;
  const timestamp = point.dataset.timestamp;

  document.querySelector(".snapshot-img").src = "/cheating_snapshot/" + snapId;
  document.getElementById("snapshot-timestamp").textContent = "Snapshot at: " + timestamp;

  document.querySelectorAll(".timeline-point").forEach(tp => tp.classList.remove("active"));
  point.classList.add("active");
}

// --- Cheating page init ---
if (document.querySelector(".timeline")) {
  initSocket();
  window.addEventListener("DOMContentLoaded", refreshTimeline);
}
