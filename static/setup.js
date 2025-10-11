// ------------------ Grab Elements ------------------
const examSetup = document.getElementById("exam-setup");
const systemCheck = document.getElementById("system-check");
const confirmScreen = document.getElementById("confirm-screen");

const examNextBtn = document.getElementById("exam-next-btn");
const systemCheckNext = document.getElementById("system-check-next");
const confirmBack = document.getElementById("confirm-back");
const confirmSubmit = document.getElementById("confirm-submit");

const video = document.getElementById("camera-preview");
const cameraStatus = document.getElementById("camera-status");
const internetStatus = document.getElementById("internet-status");
const cameraSelect = document.getElementById("camera-select");

const cameraToggleBtn = document.getElementById("camera-toggle-btn");
const cameraOverlay = document.getElementById("camera-overlay");
const cameraIcon = cameraToggleBtn.querySelector(".camera-icon");
const cameraSlash = cameraToggleBtn.querySelector(".camera-slash");

let cameraStream = null;
let cameraOn = false;



// const ASSESSMENT_KEY = "assessmentActive";
const ASSESSMENT_KEY = "sentra_assessment_active";

/* storage helpers: prefer localStorage, fallback to sessionStorage */
function storeSet(value) {
  try {
    localStorage.setItem(ASSESSMENT_KEY, value);
    return;
  } catch (e) {}
  try {
    sessionStorage.setItem(ASSESSMENT_KEY, value);
  } catch (e) {}
}
function storeGet() {
  try {
    const v = localStorage.getItem(ASSESSMENT_KEY);
    if (v !== null) return v;
  } catch (e) {}
  try {
    return sessionStorage.getItem(ASSESSMENT_KEY);
  } catch (e) {}
  return null;
}
function storeRemove() {
  try { localStorage.removeItem(ASSESSMENT_KEY); } catch (e) {}
  try { sessionStorage.removeItem(ASSESSMENT_KEY); } catch (e) {}
}
function setAssessmentActive(flag) {
  if (flag) storeSet("1"); else storeRemove();
}
function isAssessmentActive() {
  return storeGet() === "1";
}

// ------------------ Prevent Form Reload ------------------
document.getElementById("setup-form").addEventListener("submit", e => {
  e.preventDefault();
});

// ------------------ Utility: Update Camera Button ------------------
function updateCameraButton() {
  if (cameraOn) {
    cameraToggleBtn.classList.remove("off");
    cameraSlash.style.display = "none";
    cameraIcon.style.display = "block";
  } else {
    cameraToggleBtn.classList.add("off");
    cameraSlash.style.display = "block";
    cameraIcon.style.display = "none";
  }
}

// ------------------ Navigation ------------------
examNextBtn.addEventListener("click", () => {
  examSetup.style.display = "none";
  systemCheck.style.display = "flex";
  checkInternetConnectivity();
});

systemCheck.querySelector(".cancel-btn").addEventListener("click", () => {
  systemCheck.style.display = "none";
  examSetup.style.display = "flex";
  stopCamera();
  document.getElementById("setup-form").reset();
});

systemCheckNext.addEventListener("click", () => {
  systemCheck.style.display = "none";
  confirmScreen.style.display = "flex";

  document.getElementById("confirm-course").textContent = document.getElementById("course").value;
  document.getElementById("confirm-subject").textContent = document.getElementById("subject").value;
  document.getElementById("confirm-exam-type").textContent = document.getElementById("exam-type").value;
  document.getElementById("confirm-datetime").textContent = document.getElementById("exam-datetime").value;
  document.getElementById("confirm-camera").textContent = cameraSelect.value
    ? cameraSelect.options[cameraSelect.selectedIndex].text
    : "";
});

confirmBack.addEventListener("click", () => {
  confirmScreen.style.display = "none";
  systemCheck.style.display = "flex";
});

confirmSubmit.addEventListener("click", () => {
  document.getElementById("confirm-modal").style.display = "flex";
});

document.getElementById("modal-cancel").addEventListener("click", () => {
  document.getElementById("confirm-modal").style.display = "none";
});

document.getElementById("modal-yes").addEventListener("click", async () => {
  document.getElementById("confirm-modal").style.display = "none";
  confirmScreen.style.display = "none";
  document.querySelector(".camera-container").style.display = "flex";

  // Persist that an assessment is active so refresh keeps camera view
  try {
    setAssessmentActive(true);
  } catch (e) {
    console.warn("storage unavailable:", e);
  }

  // Collect payload
  const payload = {
    course: document.getElementById("course").value,
    subject: document.getElementById("subject").value,
    exam_type: document.getElementById("exam-type").value,
    exam_datetime: document.getElementById("exam-datetime").value,
    camera: cameraSelect.value
  };

  try {
    const res = await fetch("/assessment-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.success) {
      console.log("Session saved:", result.message);
      // Clear notifications for new session
      const notifications = document.getElementById('notifications');
      if (notifications) {
        notifications.innerHTML = '';
        let noAlertsMsg = document.getElementById("no-alerts-msg");
        if (!noAlertsMsg) {
          noAlertsMsg = document.createElement("p");
          noAlertsMsg.id = "no-alerts-msg";
          noAlertsMsg.textContent = "No alerts yet";
          notifications.appendChild(noAlertsMsg);
        }
      }
      // Reset badge
      const badge = document.getElementById("alert-badge");
      if (badge) {
        badge.style.display = "none";
      }
      // Clear sessionStorage for notifications
      sessionStorage.removeItem("seenSnapshots");
      sessionStorage.removeItem("notifications");
      window.updateBadge();
    } else {
      alert("Error: " + result.error);
    }
  } catch (err) {
    console.error("Failed to save session:", err);
  }
});

// ------------------ Camera ------------------
cameraOverlay.style.opacity = 1;

cameraToggleBtn.addEventListener("click", async () => {
  if (!cameraOn) {
    try {
      const constraints = cameraSelect.value
        ? { video: { deviceId: { exact: cameraSelect.value } } }
        : { video: true };
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = cameraStream;
      cameraStatus.classList.remove("offline");
      cameraStatus.classList.add("online");
      cameraOverlay.style.opacity = 0;

      cameraOn = true;
      updateCameraButton();
    } catch (err) {
      console.error("Error accessing camera:", err);
      cameraStatus.classList.remove("online");
      cameraStatus.classList.add("offline");
      cameraOverlay.style.opacity = 1;
    }
  } else {
    stopCamera();
  }
});

// Stop camera function
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    cameraStream = null;
  }
  cameraStatus.classList.remove("online");
  cameraStatus.classList.add("offline");
  cameraOverlay.style.opacity = 1;

  cameraOn = false;
  updateCameraButton();
}

// Load available cameras immediately
async function loadCameras() {
  try {
    // Request permission first to populate device labels
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
    tempStream.getTracks().forEach(t => t.stop());
  } catch (err) {
    console.error('Error requesting camera permission:', err);
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameraSelect.innerHTML = "";
    let count = 1;
    devices.forEach(device => {
      if (device.kind === "videoinput") {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = device.label || `Camera ${count++}`;
        cameraSelect.appendChild(option);
      }
    });

    if (devices.length > 0 && !cameraSelect.value) {
      cameraSelect.value = devices[0].deviceId;
    }
  } catch (err) {
    console.error("Error listing cameras:", err);
  }
}
loadCameras();

// ------------------ Internet ------------------
function checkInternetConnectivity() {
  async function updateStatus() {
    if (navigator.onLine) {
      internetStatus.classList.remove("offline");
      internetStatus.classList.add("online");
    } else {
      internetStatus.classList.remove("online");
      internetStatus.classList.add("offline");
    }
  }
  updateStatus();
  setInterval(updateStatus, 5000);
}

// ------------------ Modal Close on Esc ------------------
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    document.getElementById("confirm-modal").style.display = "none";
  }
});

// ------------------ Initialize Button ------------------
updateCameraButton();

// ------------------ New: Stop Assessment (stop camera + go back to setup) ------------------
function stopAssessment() {
  // stop camera stream if active
  try {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => {
        try { t.stop(); } catch (e) {}
      });
      cameraStream = null;
    }
    cameraOn = false;
  } catch (e) {
    console.warn("Error stopping camera stream", e);
  }

  // Stop assessment camera if running
  try {
    window.stopCamera();
  } catch (e) {
    console.warn("Error stopping assessment camera", e);
  }

  // Mark all unread notifications as read
  const notifications = document.getElementById('notifications');
  if (notifications) {
    const unreadItems = notifications.querySelectorAll('.notification-item.unread');
    unreadItems.forEach(li => {
      li.classList.remove('unread');
      li.classList.add('read');
      const snapId = li.dataset.snapId;
      if (snapId) {
        window.seenSnapshots.add(snapId);
      }
    });
    window.updateBadge();
    window.persistState(null, null);
  }

  // Clear persisted assessment state so refresh returns to setup
  try {
    setAssessmentActive(false);
  } catch (e) {
    console.warn("storage unavailable:", e);
  }

  // hide camera container and show initial setup screen
  const cameraContainer = document.querySelector(".camera-container");
  const examSetupEl = document.getElementById("exam-setup");
  const systemCheckEl = document.getElementById("system-check");
  const confirmScreenEl = document.getElementById("confirm-screen");

  if (cameraContainer) cameraContainer.style.display = "none";
  if (examSetupEl) examSetupEl.style.display = "flex";
  if (systemCheckEl) systemCheckEl.style.display = "none";
  if (confirmScreenEl) confirmScreenEl.style.display = "none";

  // Reset tabs back to Basic Info
  const tabs = document.querySelectorAll(".setup-tabs .tab");
  tabs.forEach((t, idx) => {
    t.classList.toggle("active", idx === 0);
    t.disabled = idx !== 0;
  });

  // Reset camera UI elements in system check
  const camOverlay = document.getElementById("camera-overlay");
  const camStatusText = document.getElementById("camera-status-text");
  const camStatusDot = document.getElementById("camera-status");
  const camToggle = document.getElementById("camera-toggle-btn");

  if (camOverlay) camOverlay.style.opacity = 0;
  if (camStatusText) camStatusText.textContent = "Camera is off";
  if (camStatusDot) {
    camStatusDot.classList.remove("online");
    camStatusDot.classList.add("offline");
  }
  if (camToggle) camToggle.classList.add("off");

  // If there is a start/stop button in camera area, ensure they reflect stopped state
  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
}

// Attach stop assessment button handler and init view based on session
document.addEventListener("DOMContentLoaded", () => {
  // initialize UI according to persisted assessment state
  const active = isAssessmentActive();

  const cameraContainer = document.querySelector(".camera-container");
  if (active) {
    // keep camera view visible after refresh
    if (cameraContainer) cameraContainer.style.display = "flex";
    if (examSetup) examSetup.style.display = "none";
    if (systemCheck) systemCheck.style.display = "none";
    if (confirmScreen) confirmScreen.style.display = "none";
  } else {
    // default to setup screens
    if (cameraContainer) cameraContainer.style.display = "none";
    if (examSetup) examSetup.style.display = "flex";
  }

  const stopAssessmentBtn = document.getElementById("stop-assessment-btn");
  if (stopAssessmentBtn) {
    stopAssessmentBtn.addEventListener("click", (e) => {
      e.preventDefault();
      stopAssessment();
    });
  }

  // ensure existing camera toggle button also updates cameraOn/stream state
  const camToggle = document.getElementById("camera-toggle-btn");
  if (camToggle) {
    camToggle.addEventListener("click", () => {
      // If camera was on, stop everything and return to system check state
      if (cameraOn) {
        try {
          if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
          cameraStream = null;
          cameraOn = false;
        } catch (e) {}
        const camOverlay = document.getElementById("camera-overlay");
        if (camOverlay) camOverlay.style.opacity = 1;
        const camStatusText = document.getElementById("camera-status-text");
        if (camStatusText) camStatusText.textContent = "Camera is off";
        camToggle.classList.add("off");
      }
    });
  }
});
