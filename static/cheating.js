let socket;
let userLockedSnapshot = false; // track if user clicked on a snapshot

// --- Init socket for real-time cheating updates ---
window.addEventListener("DOMContentLoaded", () => {
  if (!socket) {
    socket = io({ transports: ["websocket"] });

    socket.on("connect", () => {
      console.log("✅ Cheating page connected to server");
    });

    socket.on("cheating_notification", (data) => {
      console.log("📸 New cheating snapshot received:", data);

      if (!window.seenSnapshots) {
        window.seenSnapshots = new Set(
          JSON.parse(sessionStorage.getItem("seenSnapshots") || "[]")
        );
      }

      if (!window.seenSnapshots.has(data.url)) {
        window.seenSnapshots.add(data.url);

        const snapId = data.url.split("/").pop();
        const timestampMatch = data.message.match(/at (.+)!/);
        const timestamp = timestampMatch
          ? timestampMatch[1]
          : new Date().toLocaleString();
        const epoch = Date.now() / 1000;

        const timeline = document.getElementById("timeline");
        if (timeline) {
          const point = document.createElement("div");
          point.className = "timeline-point";
          point.dataset.id = snapId;
          point.dataset.timestamp = timestamp;
          point.dataset.epoch = epoch;
          point.title = "Taken at " + timestamp;

          // Click → lock snapshot
          point.onclick = () => {
            userLockedSnapshot = true;
            window.autoSwitchTo(point, false); // manual jump
          };

          timeline.appendChild(point);
          if (window.refreshTimeline) window.refreshTimeline();

          // Auto-jump only if user has not locked snapshot
          if (!userLockedSnapshot && window.autoSwitchTo) {
            window.autoSwitchTo(point, true);
          }
        }
      }
    });
  }
});

// --- Timeline refresh helper ---
window.refreshTimeline = function () {
  const timeline = document.getElementById("timeline");
  if (!timeline) return;
  const points = timeline.querySelectorAll(".timeline-point");
  if (points.length === 0) return;

  const epochs = Array.from(points)
    .map((p) => parseFloat(p.dataset.epoch))
    .filter((e) => !isNaN(e));
  const minTime = Math.min(...epochs);
  const maxTime = Math.max(...epochs);
  const span = maxTime > minTime ? maxTime - minTime : 1;

  // Tooltip
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

  // Position points + tooltip
  points.forEach((p) => {
    const epoch = parseFloat(p.dataset.epoch);
    const pos = ((epoch - minTime) / span) * 100;
    p.style.left = pos + "%";

    p.onmouseenter = () => {
      tooltip.textContent = p.dataset.timestamp;
      tooltip.style.opacity = "1";
      const rect = p.getBoundingClientRect();
      tooltip.style.left = rect.left + rect.width / 2 + "px";
      tooltip.style.top = rect.top - 28 + "px";
    };

    p.onmousemove = () => {
      const rect = p.getBoundingClientRect();
      tooltip.style.left = rect.left + rect.width / 2 + "px";
      tooltip.style.top = rect.top - 28 + "px";
    };

    p.onmouseleave = () => {
      tooltip.style.opacity = "0";
    };

    p.onclick = () => {
      userLockedSnapshot = true;
      window.autoSwitchTo(p, false); // manual jump always updates
    };
  });

  // Update labels
  const sorted = Array.from(points).sort(
    (a, b) => a.dataset.epoch - b.dataset.epoch
  );
  const startLabel = document.getElementById("timeline-start");
  const endLabel = document.getElementById("timeline-end");
  if (startLabel && endLabel && sorted.length > 0) {
    startLabel.textContent = sorted[0].dataset.timestamp;
    endLabel.textContent = sorted[sorted.length - 1].dataset.timestamp;
  }
};

// --- Auto switch helper ---
window.autoSwitchTo = function (point, force = true) {
  if (!point) return;

  const snapId = point.dataset.id;
  const timestamp = point.dataset.timestamp;

  // Manual click (force=false) → always switch
  // Auto (force=true) → switch only if not locked
  if (!force || !userLockedSnapshot) {
    document.querySelector(".snapshot-img").src =
      "/cheating_snapshot/" + snapId;
    document.getElementById("snapshot-timestamp").textContent =
      "Snapshot at: " + timestamp;
    document
      .querySelectorAll(".timeline-point")
      .forEach((tp) => tp.classList.remove("active"));
    point.classList.add("active");
  }
};

// --- Init when page loads ---
document.addEventListener("DOMContentLoaded", () => {
  window.refreshTimeline();

  const pathParts = window.location.pathname.split("/");
  const currentSnapId = pathParts[pathParts.length - 1];
  const timeline = document.getElementById("timeline");
  if (timeline) {
    const allPoints = timeline.querySelectorAll(".timeline-point");
    const targetPoint = Array.from(allPoints).find(
      (p) => p.dataset.id === currentSnapId
    );
    if (targetPoint) {
      window.autoSwitchTo(targetPoint, false);
    } else {
      const latestPoint = Array.from(allPoints).sort(
        (a, b) => b.dataset.epoch - a.dataset.epoch
      )[0];
      if (latestPoint) window.autoSwitchTo(latestPoint, false);
    }
  }
});
