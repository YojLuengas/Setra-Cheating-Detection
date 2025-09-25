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
