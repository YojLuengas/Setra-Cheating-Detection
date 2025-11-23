const notifications = document.getElementById('notifications');
let seenSnapshots = new Set();

// Badge elements
const badge = document.getElementById("alert-badge");
let alertCount = 0;



// --- Update badge display ---
function updateBadge() {
  const notifications = document.getElementById('notifications');
  const total = notifications ? notifications.querySelectorAll('.notification-item').length : 0;
  const badge1 = document.getElementById("alert-badge");
  const badge2 = document.getElementById("notification-count");
  if (total > 0) {
    if (badge1) {
      badge1.style.display = "inline-block";
      badge1.textContent = total;
    }
    if (badge2) {
      badge2.style.display = "inline-block";
      badge2.textContent = total;
    }
  } else {
    if (badge1) badge1.style.display = "none";
    if (badge2) badge2.style.display = "none";
  }
}

// Throttle appending notifications to once every 2 seconds
let lastNotificationTime = 0;
const NOTIFICATION_INTERVAL = 2000; // 2 seconds

// Variable to keep a queue of notifications received during throttle interval
let notificationQueue = [];

const processNotificationQueue = () => {
  if (notificationQueue.length === 0) return;

  // Process the oldest notification in the queue
  const data = notificationQueue.shift();

  const noAlertsMsg = document.getElementById("no-alerts-msg");
  if (noAlertsMsg) noAlertsMsg.style.display = "none";

  const li = document.createElement("li");
  li.classList.add("notification-item");

  let isUnread = false;

  if (data.url) {
    // Create container for message and time
    const contentRow = document.createElement("div");
    contentRow.classList.add("notif-row", "notif-vertical");

    // Message on top
    const msgEl = document.createElement("span");
    msgEl.classList.add("notif-msg");
    msgEl.textContent = "Possible Cheating detected";

    // Time below (no seconds)
    let timeOnly = "";
    if (data.time) {
      // Remove seconds if present (supports "HH:MM:SS AM/PM" or "HH:MM AM/PM")
      const match = data.time.match(/^(\d{1,2}:\d{2})/);
      if (match) {
        timeOnly = match[1];
        const ampm = data.time.match(/(AM|PM)$/i);
        if (ampm) timeOnly += " " + ampm[1].toUpperCase();
      } else {
        timeOnly = data.time;
      }
    }
    const timeEl = document.createElement("span");
    timeEl.classList.add("notif-time");
    timeEl.textContent = timeOnly;

    // 3-dot menu
    const menuWrapper = document.createElement("div");
    menuWrapper.classList.add("menu-wrapper");

    const menuBtn = document.createElement("button");
  menuBtn.innerHTML = '<i class="fa-solid fa-ellipsis-h"></i>';
    menuBtn.classList.add("menu-btn");

    const menuDropdown = document.createElement("div");
    menuDropdown.classList.add("menu-dropdown");

    const markRead = document.createElement("div");
    markRead.textContent = "Mark as Read";
    markRead.classList.add("menu-item");
    markRead.onclick = () => {
      if (li.classList.contains("unread")) {
        li.classList.remove("unread");
        li.classList.add("read");
        seenSnapshots.add(snapId);
        persistState();
      } else {
        li.classList.remove("read");
        li.classList.add("unread");
        seenSnapshots.delete(snapId);
        persistState();
      }
      updateBadge();
      menuDropdown.style.display = "none";
    };

    const removeItem = document.createElement("div");
    removeItem.textContent = "Remove";
    removeItem.classList.add("menu-item");
    removeItem.onclick = async () => {
      const res = await fetch(`/api/delete/${snapId}`, { method: "DELETE" });
      if (res.ok) {
        li.remove();
        seenSnapshots.delete(snapId);
        persistState();
        updateBadge();
      }
    };

    menuDropdown.appendChild(markRead);
    menuDropdown.appendChild(removeItem);
    menuWrapper.appendChild(menuBtn);
    menuWrapper.appendChild(menuDropdown);

    menuBtn.onclick = (e) => {
      e.stopPropagation();

      // Close all other open dropdowns
      document.querySelectorAll('.menu-dropdown').forEach(drop => {
        if (drop !== menuDropdown) drop.style.display = "none";
      });

      // --- Update menu item text based on read/unread state ---
      if (li.classList.contains("unread")) {
        markRead.textContent = "Mark as Read";
      } else {
        markRead.textContent = "Mark as Unread";
      }

      // Toggle this dropdown
      menuDropdown.style.display =
        menuDropdown.style.display === "block" ? "none" : "block";
    };

    document.addEventListener("click", () => {
      document.querySelectorAll('.menu-dropdown').forEach(drop => {
        drop.style.display = "none";
      });
    });

    // Append in order: message, menu, time
    contentRow.appendChild(msgEl);
    contentRow.appendChild(menuWrapper);
    li.appendChild(contentRow);

    // Create a wrapper for the time and append below the row
    const timeWrapper = document.createElement("div");
    timeWrapper.appendChild(timeEl);
    li.appendChild(timeWrapper);

    const snapId = data.url.split("/").pop();
    li.dataset.snapId = snapId;
    if (data.read || seenSnapshots.has(snapId)) {
      li.classList.add("read");
    } else {
      li.classList.add("unread");
      isUnread = true;
    }

    // Make the whole li clickable
    li.style.cursor = "pointer";
    li.onclick = (e) => {
      // Prevent menu button clicks from triggering the link
      if (e.target.closest('.menu-btn') || e.target.closest('.menu-dropdown')) return;
      window.open(data.url, "_blank");

      if (li.classList.contains("unread")) {
        li.classList.remove("unread");
        li.classList.add("read");

        data.read = true;
        seenSnapshots.add(snapId);
        persistState();
        updateBadge();
      }
    };

  } else {
    const contentEl = document.createElement("span");
    contentEl.textContent = data.message;
    contentEl.classList.add("notif-text");
    li.appendChild(contentEl);
    li.classList.add("unread");
    isUnread = true;
  }

  if (notifications) notifications.prepend(li);
};

function appendNotification(data) {
  const now = Date.now();
  if (now - lastNotificationTime > NOTIFICATION_INTERVAL) {
    lastNotificationTime = now;
    processNotificationQueue();
    processNotificationQueue = null;
  }
  notificationQueue.push(data);
}

// --- Restore notifications on page load ---
window.addEventListener("DOMContentLoaded", async () => {
  const storedSeen = JSON.parse(sessionStorage.getItem("seenSnapshots") || "[]");
  storedSeen.forEach(id => seenSnapshots.add(id));

  const res = await fetch("/api/notifications");
  const data = await res.json();
  notifications.innerHTML = "";

  if (data.notifications.length === 0) {
    // Show the "No alerts yet" message
    let noAlertsMsg = document.getElementById("no-alerts-msg");
    if (!noAlertsMsg) {
      noAlertsMsg = document.createElement("p");
      noAlertsMsg.id = "no-alerts-msg";
      noAlertsMsg.textContent = "No alerts yet";
      notifications.appendChild(noAlertsMsg);
    }
  } else {
    // Hide the "No alerts yet" message if present
    const noAlertsMsg = document.getElementById("no-alerts-msg");
    if (noAlertsMsg) noAlertsMsg.style.display = "none";
    data.notifications.reverse().forEach(n => {
      const snapId = n.url ? n.url.split("/").pop() : null;
      if (snapId && seenSnapshots.has(snapId)) n.read = true;
      appendNotification(n);
    });
  }

  const alertsMenu = document.getElementById("alerts-menu");
  if (alertsMenu) {
    alertsMenu.addEventListener("click", () => {
      const notifPanel = document.querySelector(".notifPanel");
      if (notifPanel) notifPanel.classList.toggle("open");
    });
  }

  updateBadge();
});

// --- Refresh notifications from server and rebuild UI ---
async function refreshNotifications() {
  if (!notifications) return;
  try {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    notifications.innerHTML = "";
    if (!data || !data.notifications || data.notifications.length === 0) {
      let noAlertsMsg = document.getElementById("no-alerts-msg");
      if (!noAlertsMsg) {
        noAlertsMsg = document.createElement("p");
        noAlertsMsg.id = "no-alerts-msg";
        noAlertsMsg.textContent = "No alerts yet";
        notifications.appendChild(noAlertsMsg);
      }
    } else {
      data.notifications.reverse().forEach(n => {
        const snapId = n.url ? n.url.split("/").pop() : null;
        if (snapId && seenSnapshots.has(snapId)) n.read = true;
        appendNotification(n);
      });
    }
    updateBadge();
  } catch (err) {
    console.error("Failed to refresh notifications:", err);
  }
}

// --- Persist notifications & timeline points ---
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

// Prevent duplicates by snapshot id
function addNotification(data) {
  // Prevent duplicates by snapshot id
  try {
    const snapId = data.url ? data.url.split('/').pop() : null;
    if (snapId && seenSnapshots.has(snapId)) return;
  } catch (e) { /* ignore parsing errors */ }

  appendNotification(data);
  // persist the new notification (no timeline point in this helper)
  persistState(data, null);
}

// expose refresh on window for non-module callers
window.refreshNotifications = refreshNotifications;

window.seenSnapshots = seenSnapshots;
window.persistState = persistState;
window.alertCount = alertCount;
window.updateBadge = updateBadge;

export { addNotification, appendNotification, persistState, alertCount, updateBadge, seenSnapshots, refreshNotifications };
