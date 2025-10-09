import { getCameras } from "./camera.js";
// import { addNotification } from "./notifications.js";

window.addEventListener("DOMContentLoaded", async () => {
  console.log("Page loaded.");

  const examSetup = document.getElementById("exam-setup");
  const cameraContainer = document.querySelector(".camera-container");

  // Check from Flask if camera session is active
  const cameraActive = document.body.dataset.cameraActive === "true";

  // Always load available cameras
  await getCameras();
  console.log("Cameras listed.");

  if (cameraActive) {
    // If session already active → show camera
    if (examSetup) examSetup.style.display = "none";
    if (cameraContainer) cameraContainer.style.display = "block";

    // Optionally auto-start the camera feed
    const startBtn = document.getElementById("start-btn");
    if (startBtn) {
      startBtn.click(); // triggers your existing start-camera logic
    }

    console.log("Camera active after refresh.");
  } else {
    // Default view (setup screen)
    if (examSetup) examSetup.style.display = "block";
    if (cameraContainer) cameraContainer.style.display = "none";
    console.log("Setup screen displayed.");
  }
});
