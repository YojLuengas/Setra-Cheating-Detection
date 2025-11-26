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
const cameraContainer = document.getElementById("camera-container");
let cameraSelects = [];

const cameraToggleBtn = document.getElementById("camera-toggle-btn");
const cameraOverlay = document.getElementById("camera-overlay");
const cameraIcon = cameraToggleBtn.querySelector(".camera-icon");
const cameraSlash = cameraToggleBtn.querySelector(".camera-slash");

let cameraStream = null;
let cameraOn = false;




// const ASSESSMENT_KEY = "assessmentActive";
const ASSESSMENT_KEY = "sentra_assessment_active";


// ------------------ Storage Helpers ------------------
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

// ------------------ Prevent Form Reload ------------------
document.getElementById("setup-form").addEventListener("submit", e => e.preventDefault());


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


// ------------------ Input Validation ------------------
examNextBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const inputs = examSetup.querySelectorAll("input[required], select[required]");
  let allFilled = true;

  inputs.forEach((input) => {
    const card = input.closest(".setup-card");
    if (!card) return;
    const statusEl = card.querySelector(".field-status") || document.createElement("small");
    statusEl.className = "field-status";

    if (input.value.trim() === "") {
      allFilled = false;
      card.classList.add("error-glow", "shake");
      input.style.border = "2px solid red";
      statusEl.style.color = "red";
    } else {
      card.classList.remove("error-glow");
      input.style.border = "2px solid limegreen";
      statusEl.style.color = "limegreen";
    }

    // Add status element if not present
    if (!card.contains(statusEl)) card.appendChild(statusEl);

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
systemCheck.querySelector(".cancel-btn").addEventListener("click", () => {
  systemCheck.style.display = "none";
  examSetup.style.display = "flex";
  stopCamera();
  document.getElementById("setup-form").reset();
});

systemCheckNext.addEventListener("click", () => {
  stopCamera();
  systemCheck.style.display = "none";
  confirmScreen.style.display = "flex";

  document.getElementById("confirm-course").textContent = document.getElementById("course").value;
  document.getElementById("confirm-subject").textContent = document.getElementById("subject").value;
  document.getElementById("confirm-exam-type").textContent = document.getElementById("exam-type").value;
  document.getElementById("confirm-datetime").textContent = document.getElementById("exam-datetime").value;
  const selectedCameras = cameraSelects.map(select => select.options[select.selectedIndex]?.text || "").filter(text => text);
  document.getElementById("confirm-camera").textContent = selectedCameras.join(", ");
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
  document.querySelector(".camera-container").style.display = "flex";


  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = false;

  try { window.stopCamera(); } catch (e) {}

  setAssessmentActive(true);

  const selectedCameras = cameraSelects.map(select => select.value).filter(value => value);
  const payload = {
    course: document.getElementById("course").value,
    subject: document.getElementById("subject").value,
    exam_type: document.getElementById("exam-type").value,
    exam_datetime: document.getElementById("exam-datetime").value,
    cameras: selectedCameras
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
    if (!result.success) alert("Error: " + result.error);
  } catch (err) {
    console.error("Failed to save session:", err);
  }
});


// ------------------ Camera Controls ------------------
cameraOverlay.style.opacity = 1;

cameraToggleBtn.addEventListener("click", async () => {
  const isOff = cameraToggleBtn.classList.contains("off");

  if (isOff) {
    try {
      // Get the selected camera from the first camera select
      const selectedCameraId = cameraSelects[0]?.value;
      
      // Only proceed if a camera is actually selected
      if (!selectedCameraId || selectedCameraId === "") {
        alert("Please select a camera first.");
        return;
      }
      
      const constraints = { 
        video: { 
          deviceId: { exact: selectedCameraId },
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      };

      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = cameraStream;

      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      cameraStatus.classList.remove("offline");
      cameraStatus.classList.add("online");
      cameraOverlay.style.opacity = 0;
      cameraOn = true;

      cameraToggleBtn.classList.remove("off");
      cameraSlash.style.display = "none";  // hide slash
      cameraIcon.style.display = "block";  // show camera icon

      console.log("Camera turned ON with device:", selectedCameraId);
    } catch (err) {
      console.error("Error turning on camera:", err);
      alert("Failed to access camera. Please check permissions and try again.");
      
      // Reset state on error
      cameraStatus.classList.remove("online");
      cameraStatus.classList.add("offline");
      cameraOverlay.style.opacity = 1;
      cameraOn = false;
      updateCameraButton();
    }
  } else {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      cameraStream = null;
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


async function loadCameras() {
  try {
    // Request camera permissions first to get device labels
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
    tempStream.getTracks().forEach(track => track.stop()); // Stop immediately
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === "videoinput");
    
    console.log("Found video devices:", videoDevices);
    
    cameraSelects.forEach((select, index) => {
      select.innerHTML = "";
      
      // Add default option
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Select a camera...";
      defaultOption.disabled = true;
      defaultOption.selected = true;
      select.appendChild(defaultOption);
      
      let count = 1;
      videoDevices.forEach(device => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = device.label || `Camera ${count++}`;
        select.appendChild(option);
      });

      // Auto-select first available camera for first select
      if (videoDevices.length > 0 && index === 0) {
        select.value = videoDevices[0].deviceId;
      }
    });
  } catch (err) {
    console.error("Error accessing cameras:", err);
    // Fallback without permissions
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      
      cameraSelects.forEach((select, index) => {
        select.innerHTML = "";
        
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Select a camera...";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);
        
        let count = 1;
        videoDevices.forEach(device => {
          const option = document.createElement("option");
          option.value = device.deviceId;
          option.textContent = device.label || `Camera ${count++}`;
          select.appendChild(option);
        });

        // Auto-select first available camera for first select
        if (videoDevices.length > 0 && index === 0) {
          select.value = videoDevices[0].deviceId;
        }
      });
    } catch (fallbackErr) {
      console.error("Failed to enumerate devices:", fallbackErr);
      alert("Unable to access camera devices. Please check browser permissions.");
    }
  }
}

// ------------------ Add Camera Functionality ------------------
const addCameraBtn = document.getElementById("add-camera-btn");
const removeCameraBtn = document.getElementById("remove-camera-btn");

function addCameraSelect() {
  if (cameraSelects.length >= 2) {
    alert("Maximum of 2 cameras allowed.");
    return;
  }

  // Get the correct container for camera selects in the setup form
  const cameraSelectContainer = document.querySelector("#camera-container");
  const select = document.createElement("select");
  select.className = "camera-select";
  select.required = true;
  select.id = `camera-select-${cameraSelects.length}`;

  cameraSelectContainer.appendChild(select);
  cameraSelects.push(select);

  // Load cameras into the new select
  loadCameras();

  updateButtons();
}

function removeCameraSelect() {
  if (cameraSelects.length <= 1) {
    alert("At least 1 camera is required.");
    return;
  }

  // Get the correct container for camera selects in the setup form
  const cameraSelectContainer = document.querySelector("#camera-container");
  const lastSelect = cameraSelects.pop();
  if (lastSelect && cameraSelectContainer.contains(lastSelect)) {
    cameraSelectContainer.removeChild(lastSelect);
  }

  updateButtons();
}

function updateButtons() {
  if (cameraSelects.length >= 2) {
    addCameraBtn.disabled = true;
    addCameraBtn.textContent = "Max 2 Cameras";
  } else {
    addCameraBtn.disabled = false;
    addCameraBtn.textContent = "Add Camera";
  }

  if (cameraSelects.length <= 1) {
    removeCameraBtn.disabled = true;
  } else {
    removeCameraBtn.disabled = false;
  }
}

addCameraBtn.addEventListener("click", addCameraSelect);
removeCameraBtn.addEventListener("click", removeCameraSelect);

// Initialize with one camera select and load cameras
document.addEventListener("DOMContentLoaded", () => {
  // Initialize camera selection
  if (cameraSelects.length === 0) {
    addCameraSelect();
  }
  
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
  document.getElementById("stop-assessment-cancel").addEventListener("click", () => {
    document.getElementById("stop-assessment-modal").style.display = "none";
  });

  document.getElementById("stop-assessment-yes").addEventListener("click", async () => {
    document.getElementById("stop-assessment-modal").style.display = "none";
    await stopAssessment();
  });


});

// ------------------ Check Internet Connectivity ---
async function checkInternetStatus() {
  const internetIcon = document.getElementById("internet-status");

  try {
    // Try fetching a small, lightweight file to confirm internet
    const response = await fetch("https://www.google.com/favicon.ico", { mode: "no-cors" });
    if (response || navigator.onLine) {
      internetIcon.classList.remove("offline");
      internetIcon.classList.add("online");
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
checkInternetStatus();
setInterval(checkInternetStatus, 5000);

// ------------------ Modal Close on Esc ------------------
document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.getElementById("confirm-modal").style.display = "none";
});

updateCameraButton();


// ------------------ Stop Assessment ------------------
async function stopAssessment() {
  try {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    cameraOn = false;
    window.stopCamera?.();
  } catch {}

  setAssessmentActive(false);
  try { await fetch("/stop-assessment", { method: "POST" }); } catch {}

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
  document.getElementById("stop-assessment-cancel").addEventListener("click", () => {
    document.getElementById("stop-assessment-modal").style.display = "none";
  });

  document.getElementById("stop-assessment-yes").addEventListener("click", async () => {
    document.getElementById("stop-assessment-modal").style.display = "none";
    await stopAssessment();
  });


});