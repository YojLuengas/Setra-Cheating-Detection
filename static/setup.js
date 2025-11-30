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

// duration select element (ID from your HTML)
const durationSelect = document.getElementById("exam-duration");
const confirmDuration = document.getElementById("confirm-duration");

// ensure existences
if (!durationSelect) console.warn("Warning: #exam-duration not found in DOM.");
if (!confirmDuration) console.warn("Warning: #confirm-duration not found in DOM.");

// ------------------ Assessment storage ------------------
const ASSESSMENT_KEY = "sentra_assessment_active";

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
const setupForm = document.getElementById("setup-form");
if (setupForm) {
  setupForm.addEventListener("submit", e => e.preventDefault());
}

// ------------------ Update Camera Button ------------------
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

// populate subjects on load
document.addEventListener("DOMContentLoaded", () => {
  fetch("/api/get_user_subjects")
    .then(res => res.json())
    .then(data => {
      const subjectSelect = document.getElementById("subject");
      if (data && data.success && Array.isArray(data.subjects)) {
        data.subjects.forEach(sub => {
          let option = document.createElement("option");
          option.value = sub;
          option.textContent = sub;
          subjectSelect.appendChild(option);
        });
      }
    })
    .catch(err => console.error("Failed fetching subjects:", err));
});

// ------------------ Input Validation ------------------
examNextBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const inputs = examSetup.querySelectorAll("input[required], select[required]");
  let allFilled = true;

  inputs.forEach((input) => {
    const card = input.closest(".setup-card");
    if (!card) return;
    let statusEl = card.querySelector(".field-status");
    if (!statusEl) {
      statusEl = document.createElement("small");
      statusEl.className = "field-status";
      card.appendChild(statusEl);
    }

    if (!input.value || input.value.trim() === "") {
      allFilled = false;
      card.classList.add("error-glow", "shake");
      input.style.border = "2px solid red";
      statusEl.style.color = "red";
      statusEl.textContent = "Required";
    } else {
      card.classList.remove("error-glow");
      input.style.border = "2px solid limegreen";
      statusEl.style.color = "limegreen";
      statusEl.textContent = "OK";
    }

    // Reset shake animation every click
    setTimeout(() => card.classList.remove("shake"), 500);
  });

  if (allFilled) {
    examSetup.style.display = "none";
    systemCheck.style.display = "flex";
    checkInternetStatus();
  }
});

// ------------------ Navigation ------------------
const systemCancelBtn = systemCheck.querySelector(".cancel-btn");
if (systemCancelBtn) {
  systemCancelBtn.addEventListener("click", () => {
    systemCheck.style.display = "none";
    examSetup.style.display = "flex";
    stopCamera();
    if (setupForm) setupForm.reset();
  });
}

systemCheckNext.addEventListener("click", () => {
  stopCamera();
  systemCheck.style.display = "none";
  confirmScreen.style.display = "flex";

  document.getElementById("confirm-course").textContent = document.getElementById("course").value;
  document.getElementById("confirm-subject").textContent = document.getElementById("subject").value;
  document.getElementById("confirm-exam-type").textContent = document.getElementById("exam-type").value;
  document.getElementById("confirm-datetime").textContent = document.getElementById("exam-datetime").value;

  // Camera confirmed name
  document.getElementById("confirm-camera").textContent = cameraSelect.value
    ? cameraSelect.options[cameraSelect.selectedIndex].text
    : "";

  // Show duration in confirm (if available)
  if (durationSelect && confirmDuration) {
    const sel = durationSelect.selectedOptions[0];
    confirmDuration.textContent = sel ? sel.text : "";
  }
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

// ------------------ Modal Yes (Submit Session) ------------------
document.getElementById("modal-yes").addEventListener("click", async () => {
  document.getElementById("confirm-modal").style.display = "none";
  confirmScreen.style.display = "none";

  // reveal camera container
  const camContainer = document.querySelector(".camera-container");
  if (camContainer) camContainer.style.display = "flex";

  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = false;

  try { window.stopCamera && window.stopCamera(); } catch (e) {}

  setAssessmentActive(true);

  // build payload (include duration)
  const payload = {
    course: document.getElementById("course").value,
    subject: document.getElementById("subject").value,
    exam_type: document.getElementById("exam-type").value,
    exam_datetime: document.getElementById("exam-datetime").value,
    camera: cameraSelect.value,
    duration_minutes: durationSelect ? parseInt(durationSelect.value || "60", 10) : 60
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

      // show/ensure session timer element exists in camera container
      ensureTimerElement();

      // start countdown using returned duration (fallback to payload)
      const minutes = result.duration_minutes || payload.duration_minutes || 60;
      startExamCountdown(parseInt(minutes, 10));

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
      if (window.updateBadge) window.updateBadge();
    } else {
      alert("Error: " + (result.error || "Unknown error"));
      // If failed to create session, hide camera container again
      const camContainer2 = document.querySelector(".camera-container");
      if (camContainer2) camContainer2.style.display = "none";
    }
  } catch (err) {
    console.error("Failed to save session:", err);
    alert("Failed to create session. See console for details.");
    const camContainer3 = document.querySelector(".camera-container");
    if (camContainer3) camContainer3.style.display = "none";
  }
});

// ------------------ Camera Controls ------------------
cameraOverlay.style.opacity = 1;

cameraToggleBtn.addEventListener("click", async () => {
  const isOff = cameraToggleBtn.classList.contains("off");

  if (isOff) {
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

      cameraToggleBtn.classList.remove("off");
      cameraSlash.style.display = "none";  // hide slash
      cameraIcon.style.display = "block";  // show camera icon

      console.log("Camera turned ON");
    } catch (err) {
      console.error("Error turning on camera:", err);
      alert("Unable to access camera. Check permissions.");
    }
  } else {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }

    cameraStatus.classList.remove("online");
    cameraStatus.classList.add("offline");
    cameraOverlay.style.opacity = 1;
    cameraOn = false;

    cameraToggleBtn.classList.add("off");
    cameraSlash.style.display = "block";  // show slash
    cameraIcon.style.display = "none";    // hide camera icon

    console.log("Camera turned OFF");
  }
});

// stopCamera used elsewhere
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  video.srcObject = null;
  cameraStatus.classList.remove("online");
  cameraStatus.classList.add("offline");
  cameraOverlay.style.opacity = 1;
  cameraOn = false; // ✅ make sure this flag is consistent
  updateCameraButton();
}

// load available camera devices
async function loadCameras() {
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

    if (cameraSelect.options.length && !cameraSelect.value) {
      cameraSelect.value = cameraSelect.options[0].value;
    }
  } catch (err) {
    console.error("Error listing cameras:", err);
  }
}
loadCameras();

// --- Check Internet Connectivity ---
async function checkInternetConnectivity() {
  const internetIcon = document.getElementById("internet-status");

  try {
    // Use navigator.onLine as primary, try to fetch small resource as secondary
    if (navigator.onLine) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        await fetch("https://www.google.com/favicon.ico", { mode: "no-cors", signal: controller.signal });
        internetIcon.classList.remove("offline");
        internetIcon.classList.add("online");
      } catch (err) {
        // still consider online if navigator reports online but fetch failed
        internetIcon.classList.remove("offline");
        internetIcon.classList.add("online");
      } finally {
        clearTimeout(timeout);
      }
    } else {
      internetIcon.classList.remove("online");
      internetIcon.classList.add("offline");
    }
  } catch (err) {
    internetIcon.classList.remove("online");
    internetIcon.classList.add("offline");
  }
}

// Run once on load, and then check every few seconds
checkInternetConnectivity();
setInterval(checkInternetConnectivity, 5000);

// ------------------ Modal Close on Esc ------------------
document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.getElementById("confirm-modal").style.display = "none";
});

updateCameraButton();

// ================== COUNTDOWN TIMER LOGIC ==================
let countdownTimer = null;
let timerEndTime = null;

function ensureTimerElement() {
  // create a session-timer element inside camera-container if missing
  const cam = document.querySelector(".camera-container");
  if (!cam) return;

  let el = document.getElementById("session-timer");
  if (!el) {
    el = document.createElement("div");
    el.id = "session-timer";
    el.style.position = "absolute";
    el.style.top = "12px";
    el.style.right = "12px";
    el.style.background = "rgba(0,0,0,0.7)";
    el.style.color = "white";
    el.style.padding = "6px 10px";
    el.style.borderRadius = "8px";
    el.style.fontWeight = "700";
    el.style.zIndex = 9999;
    el.textContent = "⏱ 00:00";
    cam.style.position = cam.style.position || "relative";
    cam.appendChild(el);
  }
  return el;
}

function startExamCountdown(minutes) {
  // guard
  if (!minutes || isNaN(minutes) || minutes <= 0) minutes = 60;
  const durationMs = minutes * 60 * 1000;
  timerEndTime = Date.now() + durationMs;

  // persist
  try { localStorage.setItem("timerEndTime", String(timerEndTime)); } catch (e) {}

  // ensure UI exists
  ensureTimerElement();
  updateTimerUI();

  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(updateTimerUI, 1000);
}

function updateTimerUI() {
  const timerEl = document.getElementById("session-timer");
  if (!timerEl) return;

  const now = Date.now();
  let remaining = timerEndTime - now;

  if (remaining <= 0) {
    timerEl.innerHTML = "⏱ 00:00";
    timerEl.classList.add("low-time");
    clearInterval(countdownTimer);
    countdownTimer = null;
    autoEndExam();
    return;
  }

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  timerEl.innerHTML = `⏱ ${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;

  // Apply alert style if last 5 minutes
  if (remaining <= 5 * 60 * 1000) {
    timerEl.classList.add("low-time");
  } else {
    timerEl.classList.remove("low-time");
  }
}
async function autoEndExam() {
  // final UI alert and then call stop endpoint & local cleanup
  try {
    // Try to inform server to end the session (updates DB status)
    await fetch("/stop-assessment", { method: "POST" });
  } catch (e) {
    console.error("autoEndExam: stop-assessment failed", e);
  }

  try {
    // attempt to perform local stop/cleanup (existing function in this file)
    if (typeof stopAssessment === "function") {
      await stopAssessment();
    } else {
      // fallback: remove local storage and redirect
      try { localStorage.removeItem("timerEndTime"); } catch (e) {}
      alert("Time is up. Returning to dashboard.");
      window.location.href = "/dashboard";
    }
  } catch (err) {
    console.error("autoEndExam error:", err);
    try { localStorage.removeItem("timerEndTime"); } catch (e) {}
    window.location.href = "/dashboard";
  }
}


// ------------------ Stop Assessment ------------------
async function stopAssessment() {
  try {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    cameraOn = false;
    // If there's an external stop function exposed, call it too
    try { window.stopCamera && window.stopCamera(); } catch (e) {}
  } catch (e) {
    console.warn("stopAssessment cleanup error:", e);
  }

  // clear timer
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  timerEndTime = null;
  try { localStorage.removeItem("timerEndTime"); } catch (e) {}

  setAssessmentActive(false);

  try {
    // Tell server to end session (DB status etc.)
    await fetch("/stop-assessment", { method: "POST" });
  } catch (e) {
    console.warn("stopAssessment: server call failed", e);
  }

  // Clear notifications UI and related storage
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

  const cameraContainer = document.querySelector(".camera-container");
  if (cameraContainer) cameraContainer.style.display = "none";
  examSetup.style.display = "flex";
  systemCheck.style.display = "none";
  confirmScreen.style.display = "none";

  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
}

// ------------------ Initialize on Page Load ------------------
document.addEventListener("DOMContentLoaded", () => {
  const active = isAssessmentActive();
  const cameraContainer = document.querySelector(".camera-container");

  if (active) {
    if (cameraContainer) cameraContainer.style.display = "flex";
    examSetup.style.display = "none";
    systemCheck.style.display = "none";
    confirmScreen.style.display = "none";
  } else {
    if (cameraContainer) cameraContainer.style.display = "none";
    examSetup.style.display = "flex";
  }

  const stopAssessmentBtn = document.getElementById("stop-assessment-btn");
  if (stopAssessmentBtn) {
    stopAssessmentBtn.addEventListener("click", e => {
      e.preventDefault();
      document.getElementById("stop-assessment-modal").style.display = "flex";
    });
  }

  // --- Modal: Confirm Stop ---
  const stopCancel = document.getElementById("stop-assessment-cancel");
  const stopYes = document.getElementById("stop-assessment-yes");
  if (stopCancel) {
    stopCancel.addEventListener("click", () => {
      document.getElementById("stop-assessment-modal").style.display = "none";
    });
  }
  if (stopYes) {
    stopYes.addEventListener("click", async () => {
      document.getElementById("stop-assessment-modal").style.display = "none";
      await stopAssessment();
    });
  }

  // Restore timer after refresh (if exists)
  try {
    const savedEnd = localStorage.getItem("timerEndTime");
    if (savedEnd) {
      timerEndTime = parseInt(savedEnd, 10);
      if (Date.now() < timerEndTime) {
        ensureTimerElement();
        countdownTimer = setInterval(updateTimerUI, 1000);
        updateTimerUI();
      } else {
        // already expired
        autoEndExam();
      }
    }
  } catch (e) {
    console.warn("restore timer failed", e);
  }

}); // end DOMContentLoaded
