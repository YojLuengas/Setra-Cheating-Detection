import { appendNotification, persistState, updateBadge, seenSnapshots, refreshNotifications } from "./notifications.js";

let socket;

function initSocket(video, statusDiv) {
  if (!socket) {
    socket = io({ transports: ["websocket"] });

    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.on("response_frame", (msg) => {
      if (!video) return;
      video.src = msg.image;

      if (msg.cheating) {
            statusDiv.textContent = "Possible Cheating detected!";
        statusDiv.style.color = "#ff4444";
        statusDiv.style.fontWeight = "bold";
        video.style.borderColor = "#ff4444";
      } else {
        statusDiv.textContent = "No possible cheating detected";
        statusDiv.style.color = "#228B22";
        statusDiv.style.fontWeight = "bold";
        video.style.borderColor = "#228B22";
      }
    });

    socket.on("cheating_notification", (data) => {
      const snapId = data.url.split("/").pop();
      if (!seenSnapshots.has(snapId)) {
        appendNotification(data);
        updateBadge();

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

          // ⏩ Update timeline
          if (window.refreshTimeline) window.refreshTimeline();

          // ⏩ Auto-jump to newest snapshot (force = true)
          if (window.autoSwitchTo) window.autoSwitchTo(point, true);
        }

        persistState(data, { id: snapId, timestamp, epoch });
      }
    });

    // When server tells clients to refresh notifications (e.g. after stopping assessment)
    socket.on("refresh_notifications", (payload) => {
      try {
        if (typeof refreshNotifications === "function") refreshNotifications();
        else if (window.refreshNotifications) window.refreshNotifications();
      } catch (e) {
        console.warn("refresh_notifications handler error", e);
      }
    });

    // When server tells clients to update records page (e.g. after deleting snapshots/folders)
    socket.on("records_updated", () => {
      if (window.location.pathname === "/records") {
        window.location.reload();
      }
    });
  }
}

// Function to send a frame
function emitFrame(frameB64) {
  if (socket && socket.connected) {
    socket.emit("frame", { image: frameB64 });
  }
}

// Function to disconnect socket
function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export { initSocket, emitFrame, disconnectSocket };
