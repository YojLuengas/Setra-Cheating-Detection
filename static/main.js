import { getCameras } from "./camera.js";
// import { addNotification } from "./notifications.js";

window.addEventListener("DOMContentLoaded", async () => {
  await getCameras();
console.log("Page loaded and cameras listed.");
});
