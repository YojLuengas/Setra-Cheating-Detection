const notifications = document.getElementById('notifications');
const seenSnapshots = new Set(JSON.parse(sessionStorage.getItem("seenSnapshots") || "[]"));

// Badge elements
const badge = document.getElementById("alert-badge");
export let alertCount = 0;



// --- Update badge display ---
function updateBadge() {
  const badge1 = document.getElementById("alert-badge");
  const badge2 = document.getElementById("notification-count");
  if (alertCount > 0) {
    if (badge1) {
      badge1.style.display = "inline-block";
      badge1.textContent = alertCount;
    }
    if (badge2) {
      badge2.style.display = "inline-block";
      badge2.textContent = alertCount;
    }
  } else {
    if (badge1) badge1.style.display = "none";
    if (badge2) badge2.style.display = "none";
  }
}

// --- Append a notification ---
function appendNotification(data) {
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
    msgEl.textContent = "Cheating detected";

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
        alertCount--;
        updateBadge();
        seenSnapshots.add(snapId);
        persistState();
      } else {
        li.classList.remove("read");
        li.classList.add("unread");
        alertCount++;
        updateBadge();
        seenSnapshots.delete(snapId);
        persistState();
      }
      menuDropdown.style.display = "none";
    };

    const removeItem = document.createElement("div");
    removeItem.textContent = "Remove";
    removeItem.classList.add("menu-item");
    removeItem.onclick = async () => {
      const res = await fetch(`/api/delete/${snapId}`, { method: "DELETE" });
      if (res.ok) {
        if (li.classList.contains("unread")) {
          alertCount--;
          updateBadge();
        }
        li.remove();
        seenSnapshots.delete(snapId);
        persistState();
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
        alertCount--;
        updateBadge();

        data.read = true;
        seenSnapshots.add(snapId);
        persistState();
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

// --- Add system notification ---
function addNotification(message) {
  if (!notifications) return;
  if (notifications.firstChild && notifications.firstChild.textContent === "No alerts yet") {
    notifications.removeChild(notifications.firstChild);
  }
  const notifData = { message };
  appendNotification(notifData);
  persistState(notifData, null);
  alertCount++;
  updateBadge();
}

// --- Restore notifications on page load ---
window.addEventListener("DOMContentLoaded", async () => {
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

  // Recalculate unread count after restoring notifications
  alertCount = document.querySelectorAll(".notification-item.unread").length;
  updateBadge();
});

export { addNotification, appendNotification, persistState, alertCount, updateBadge };
