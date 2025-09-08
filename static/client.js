const video = document.getElementById('video-frame');
const canvas = document.createElement('canvas');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const notifications = document.getElementById('notifications');
const statusDiv = document.getElementById('cheating-status');

let stream;
let sending = false;
let socket;

// --- Load persisted seen snapshots ---
const seenSnapshots = new Set(JSON.parse(sessionStorage.getItem("seenSnapshots") || "[]"));

// --- Black screen fallback ---
function setBlackScreen() {
  if (!video) return;

  const black = document.createElement('canvas');
  black.width = 960;
  black.height = 720;
  const ctx = black.getContext('2d');
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, black.width, black.height);

  video.src = black.toDataURL('image/png');
}


// --- Restore notifications & timeline on refresh ---
window.addEventListener("DOMContentLoaded", () => {
  const savedNotifs = JSON.parse(sessionStorage.getItem("notifications") || "[]");
  if (notifications && savedNotifs.length > 0) {
    notifications.innerHTML = "";
    savedNotifs.forEach(n => appendNotification(n));
  }

  const savedPoints = JSON.parse(sessionStorage.getItem("timelinePoints") || "[]");
  const timeline = document.getElementById("timeline");
  if (timeline && savedPoints.length > 0) {
    timeline.innerHTML = "";
    savedPoints.forEach(p => {
      const point = document.createElement("div");
      point.className = "timeline-point";
      point.dataset.id = p.id;
      point.dataset.timestamp = p.timestamp;
      point.dataset.epoch = p.epoch;
      point.title = "Taken at " + p.timestamp;
      timeline.appendChild(point);
    });
    refreshTimeline();
  }
});

// --- Append a notification item ---
function appendNotification(data) {
  const li = document.createElement("li");

  if (data.url) {
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
  } else {
    li.textContent = data.message;
  }

  if (notifications) notifications.prepend(li);
}

// --- Save to sessionStorage ---
function persistState(newNotif, newPoint) {
  if (newNotif) {
    let saved = JSON.parse(sessionStorage.getItem("notifications") || "[]");
    saved.push(newNotif);
    sessionStorage.setItem("notifications", JSON.stringify(saved));
  }

  if (newPoint) {
    let savedPoints = JSON.parse(sessionStorage.getItem("timelinePoints") || "[]");
    savedPoints.push(newPoint);
    sessionStorage.setItem("timelinePoints", JSON.stringify(savedPoints));
  }

  sessionStorage.setItem("seenSnapshots", JSON.stringify(Array.from(seenSnapshots)));
}

// --- System notification helper ---
function addNotification(message) {
  if (!notifications) return;
  if (notifications.firstChild && notifications.firstChild.textContent === "No alerts yet") {
    notifications.removeChild(notifications.firstChild);
  }

  const notifData = { message };
  appendNotification(notifData);
  persistState(notifData, null);
}

// --- Init socket ---
function initSocket() {
  if (!socket) {
    socket = io({ transports: ['websocket'] });

    socket.on('connect', () => {
      console.log("✅ Connected to server");
      addNotification("Connected to server.");
    });

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

    socket.on('cheating_notification', (data) => {
      if (!seenSnapshots.has(data.url)) {
        seenSnapshots.add(data.url);

        if (notifications && notifications.firstChild && notifications.firstChild.textContent === "No alerts yet") {
          notifications.removeChild(notifications.firstChild);
        }

        appendNotification(data);

        const snapId = data.url.split("/").pop();
        const timestampMatch = data.message.match(/at (.+)!/);
        const timestamp = timestampMatch ? timestampMatch[1] : new Date().toLocaleString();
        const epoch = Date.now() / 1000;

        const timeline = document.getElementById("timeline");
        if (timeline) {
          const point = document.createElement("div");
          point.className = "timeline-point";
          point.dataset.id = snapId;
          point.dataset.timestamp = timestamp;
          point.dataset.epoch = epoch;
          point.title = "Taken at " + timestamp;

          timeline.appendChild(point);
          refreshTimeline();
          autoSwitchTo(point);
        }

        persistState(data, { id: snapId, timestamp, epoch });
      }
    });
  }
}

// --- Camera page logic ---
// --- Camera page logic ---
if (startBtn && stopBtn) {
  window.onload = setBlackScreen;

  let vid; // reference to the hidden video element

  startBtn.onclick = async () => {
    initSocket();

    // Get webcam stream
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 960, height: 720 },
      audio: false
    });

    // Create a hidden video element for capturing frames
    vid = document.createElement("video");
    vid.style.display = "none";
    document.body.appendChild(vid);
    vid.srcObject = stream;
    await vid.play();

    sending = true;

    sendLoop(vid);
    addNotification("Camera started");
  };

  stopBtn.onclick = () => {
    sending = false;

    // Stop all webcam tracks
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }

    // Remove hidden video element
    if (vid) {
      vid.srcObject = null;
      vid.remove();
      vid = null;
    }

    // Immediately set video feed to black
    setBlackScreen();

    // Reset cheating status
    statusDiv.textContent = "No cheating detected";
    statusDiv.style.color = "#222";
    statusDiv.style.fontWeight = "normal";

    addNotification("Camera stopped");
  };

  async function sendLoop(videoElement) {
    while (sending) {
      if (videoElement.readyState >= 2 && socket && socket.connected) {
        const frameB64 = captureFrame(videoElement);
        socket.emit('frame', { image: frameB64 });
      }
      await new Promise(r => setTimeout(r, 250));
    }
  }

  function captureFrame(videoElement) {
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
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

  // --- Tooltip div (create once) ---
  let tooltip = document.getElementById("timeline-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "timeline-tooltip";
    tooltip.style.position = "absolute";
    tooltip.style.background = "#333";
    tooltip.style.color = "#fff";
    tooltip.style.padding = "4px 8px";
    tooltip.style.borderRadius = "6px";
    tooltip.style.fontSize = "12px";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.style.pointerEvents = "none";
    tooltip.style.opacity = "0";
    tooltip.style.transition = "opacity 0.2s ease";
    document.body.appendChild(tooltip);
  }

  points.forEach(p => {
    const epoch = parseFloat(p.dataset.epoch);
    const pos = ((epoch - minTime) / span) * 100;
    p.style.left = pos + "%";

    // --- Hover effect for tooltip ---
    p.onmouseenter = (e) => {
      tooltip.textContent = p.dataset.timestamp;
      tooltip.style.opacity = "1";
      const rect = p.getBoundingClientRect();
      tooltip.style.left = rect.left + rect.width / 2 + "px";
      tooltip.style.top = rect.top - 28 + "px"; // above the point
    };

    p.onmousemove = (e) => {
      const rect = p.getBoundingClientRect();
      tooltip.style.left = rect.left + rect.width / 2 + "px";
      tooltip.style.top = rect.top - 28 + "px";
    };

    p.onmouseleave = () => {
      tooltip.style.opacity = "0";
    };

    // --- Click event ---
    p.onclick = () => {
      const snapId = p.dataset.id;
      const timestamp = p.dataset.timestamp;

      document.querySelector(".snapshot-img").src = "/cheating_snapshot/" + snapId;
      document.getElementById("snapshot-timestamp").textContent = "Snapshot at: " + timestamp;

      points.forEach(tp => tp.classList.remove("active"));
      p.classList.add("active");
    };
  });

  // auto-activate latest
  const latestPoint = Array.from(points).sort((a, b) => b.dataset.epoch - a.dataset.epoch)[0];
  if (latestPoint) autoSwitchTo(latestPoint);

  // update labels
  const sorted = Array.from(points).sort((a, b) => a.dataset.epoch - b.dataset.epoch);
  const startLabel = document.getElementById("timeline-start");
  const endLabel = document.getElementById("timeline-end");
  if (startLabel && endLabel && sorted.length > 0) {
    startLabel.textContent = sorted[0].dataset.timestamp;
    endLabel.textContent = sorted[sorted.length - 1].dataset.timestamp;
  }
}

// --- Auto switch to newest OR specific snapshot ---
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

  window.addEventListener("DOMContentLoaded", () => {
    refreshTimeline();

    // 🔥 check if current page URL has snapshot_id
    const pathParts = window.location.pathname.split("/");
    const currentSnapId = pathParts[pathParts.length - 1]; // snapshot id from URL

    const timeline = document.getElementById("timeline");
    if (timeline) {
      const allPoints = timeline.querySelectorAll(".timeline-point");

      // find the one that matches the snapshot id
      const targetPoint = Array.from(allPoints).find(p => p.dataset.id === currentSnapId);

      if (targetPoint) {
        autoSwitchTo(targetPoint); // activate the right snapshot
      } else {
        // fallback to latest snapshot
        const latestPoint = Array.from(allPoints).sort((a, b) => b.dataset.epoch - a.dataset.epoch)[0];
        if (latestPoint) autoSwitchTo(latestPoint);
      }
    }
  });
}
