import { getCameras } from "./camera.js";
// import { addNotification } from "./notifications.js";

const loadingOverlay = document.querySelector('.loading-overlay');

function showLoading() {
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

window.addEventListener("DOMContentLoaded", () => {
  console.log("Page loaded.");
  showLoading();
  setTimeout(hideLoading, 1500); // Hide after 1.5 seconds to show animation briefly
});
