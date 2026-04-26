// ====== HEADER COMPONENT WITH CLOCK AND NOTIFICATIONS ======

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
 
// Initialize Socket.io connection
function initializeSocket() {
  if (socket && socket.connected) {
    console.log("🔌 Socket already connected");
    return;
  }
 
  const userId = sessionStorage.getItem("userId");
  const role = sessionStorage.getItem("role");
  
  if (!userId || !role) {
    console.warn("⚠️ No user session - skipping socket connection");
    return;
  }
 
  try {
    // Load socket.io client from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
    script.onload = () => {
      // Connect to Socket.io server
      socket = io('http://localhost:5000', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS
      });
 
      // Connection successful
      socket.on('connect', () => {
        console.log('🟢 Socket.io connected:', socket.id);
        reconnectAttempts = 0;
        
        // Register user with server
        socket.emit('register', userId);
        
        // Initial notification load
        loadNotificationsFromServer();
      });
 
      // Listen for new notifications (role-based)
      socket.on(`notification:${role}`, ({ event, data }) => {
        console.log('📨 Received notification:', event, data);
        handleNewNotification(data);
      });
 
      // Listen for user-specific notifications
      socket.on('notification', ({ event, data }) => {
        console.log('📨 Received user notification:', event, data);
        handleNewNotification(data);
      });
 
      // Listen for notification handled events
      socket.on(`notification:${role}`, ({ event, data }) => {
        if (event === 'notification_handled') {
          removeNotificationFromUI(data.notificationId);
        }
      });
 
      // Connection error
      socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error.message);
        reconnectAttempts++;
        
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.warn('⚠️ Max reconnection attempts reached. Falling back to polling.');
          fallbackToPolling();
        }
      });
 
      // Disconnected
      socket.on('disconnect', (reason) => {
        console.warn('🔴 Socket disconnected:', reason);
        if (reason === 'io server disconnect') {
          // Server disconnected - try to reconnect
          socket.connect();
        }
      });
    };
    
    script.onerror = () => {
      console.error('❌ Failed to load Socket.io client. Falling back to polling.');
      fallbackToPolling();
    };
    
    document.head.appendChild(script);
  } catch (err) {
    console.error('❌ Socket initialization error:', err);
    fallbackToPolling();
  }
}
 
// Handle new notification received via Socket.io
function handleNewNotification(notification) {
  if (!notification) return;
  
  console.log('🔔 New notification received:', notification);
  
  // Play sound
  playNotificationSound();
  
  // Add to current notifications
  if (!window.currentNotifications) {
    window.currentNotifications = [];
  }
  
  // Check for duplicates
  const exists = window.currentNotifications.find(n => 
    n._id === notification._id || 
    (n.notificationId === notification.notificationId)
  );
  
  if (!exists) {
    window.currentNotifications.unshift(notification);
    
    // Update badge
    updateNotificationBadge(window.currentNotifications.length);
    
    // If dropdown is open, refresh the list
    const dropdown = document.getElementById("notificationDropdown");
    if (dropdown && dropdown.style.display === "flex") {
      loadNotifications();
    }
  }
}
 
// Remove notification from UI when handled
function removeNotificationFromUI(notificationId) {
  if (window.currentNotifications) {
    window.currentNotifications = window.currentNotifications.filter(
      n => n._id !== notificationId && n.notificationId !== notificationId
    );
    updateNotificationBadge(window.currentNotifications.length);
    
    const dropdown = document.getElementById("notificationDropdown");
    if (dropdown && dropdown.style.display === "flex") {
      loadNotifications();
    }
  }
}
 
// Fallback to polling if Socket.io fails
let pollingInterval = null;
function fallbackToPolling() {
  if (pollingInterval) return; // Already polling
  
  console.log('🔄 Starting fallback polling (every 10 seconds)');
  
  // Check immediately
  loadNotificationsFromServer();
  
  // Then poll every 10 seconds
  pollingInterval = setInterval(() => {
    loadNotificationsFromServer();
  }, 10000);
}
 
// Load notifications from server (replaces localStorage checking)
async function loadNotificationsFromServer() {
  const userId = sessionStorage.getItem("userId");
  const role = sessionStorage.getItem("role");
  
  if (!userId || !role) return;
  
  try {
    const response = await fetch(
      `http://localhost:5000/api/notifications/my?userId=${userId}&role=${role}`
    );
    
    if (!response.ok) {
      console.error('Failed to fetch notifications:', response.status);
      return;
    }
    
    const data = await response.json();
    
    if (data.success && Array.isArray(data.notifications)) {
      const incomingCount = data.notifications.length;
      const previousCount = typeof window.previousNotificationCount === "number"
        ? window.previousNotificationCount
        : null;

      window.currentNotifications = data.notifications;
      updateNotificationBadge(incomingCount);

      // Play sound when polling detects newly arrived notifications.
      // Skip the very first sync to avoid false alerts on page load.
      if (previousCount !== null && incomingCount > previousCount) {
        playNotificationSound();
      }
      window.previousNotificationCount = incomingCount;
    }
  } catch (err) {
    console.error('Error loading notifications:', err);
  }
}

// ✅ Bind clock and notifications to an existing header (e.g. Archive page with custom layout)
function bindToExistingHeader() {
  const clockDisplay = document.getElementById("clockDisplay");
  if (clockDisplay) {
    updateClock();
    setInterval(updateClock, 1000);
  }

  // Populate header user avatar initials + name + role
  const headerAvatar = document.getElementById("headerUserAvatar");
  if (headerAvatar) {
    const name = sessionStorage.getItem("name") || "";
    const role = sessionStorage.getItem("role") || "";
    const initials = name.split(" ").map(function (n) { return n[0]; }).join("").toUpperCase().slice(0, 2);
    headerAvatar.textContent = initials || "?";

    if (!document.getElementById("headerUserInfo")) {
      const userInfo = document.createElement("div");
      userInfo.id = "headerUserInfo";
      userInfo.style.cssText = "display:flex;flex-direction:column;align-items:flex-end;";
      userInfo.innerHTML = `
        <span style="font-size:13px;font-weight:700;color:#1e293b;line-height:1.2;white-space:nowrap;">${name || "User"}</span>
        <span style="font-size:11px;font-weight:500;color:#065f46;line-height:1.2;white-space:nowrap;">${role || ""}</span>
      `;
      headerAvatar.parentNode.insertBefore(userInfo, headerAvatar);
    }
  }

  let notificationDropdown = document.getElementById("notificationDropdown");
  if (!notificationDropdown) {
    const dropdownHTML = `
      <div id="notificationDropdown" style="position:fixed;top:80px;right:40px;width:400px;max-width:calc(90vw - 250px);max-height:500px;background:white;box-shadow:0 4px 12px rgba(0,0,0,0.15);border-radius:8px;display:none;flex-direction:column;z-index:1001;overflow:hidden;">
        <div style="padding:15px 20px;border-bottom:2px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;color:#065f46;font-size:18px;">Notifications</h3>
          <button id="clearAllNotifications" style="background:none;border:none;color:#666;cursor:pointer;font-size:12px;padding:5px 10px;">Clear All</button>
        </div>
        <div id="notificationList" style="max-height:440px;overflow-y:auto;padding:10px;"><p style="text-align:center;color:#999;padding:20px;">No notifications</p></div>
      </div>`;
    document.body.insertAdjacentHTML("beforeend", dropdownHTML);
    notificationDropdown = document.getElementById("notificationDropdown");
  }

  const notificationBell = document.getElementById("notificationBell");
  const pageHandlesNotification = document.body && document.body.getAttribute("data-notification-handler") === "page";
  if (!pageHandlesNotification && notificationBell && notificationDropdown) {
    notificationBell.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const isVisible = notificationDropdown.style.display === "flex";
      notificationDropdown.style.display = isVisible ? "none" : "flex";
      loadNotifications();
    });
  }

  if (!pageHandlesNotification) {
    document.addEventListener("click", function (e) {
      if (notificationBell && notificationDropdown && !notificationBell.contains(e.target) && !notificationDropdown.contains(e.target)) {
        notificationDropdown.style.display = "none";
      }
    });
  }

  const clearAllBtn = document.getElementById("clearAllNotifications");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", function () { clearAllNotifications(); });
  }

  setTimeout(function () {
    checkForNotifications();
    setTimeout(function () {
      if (window.previousNotificationCount === undefined) {
        window.previousNotificationCount = (window.currentNotifications || []).length;
      }
    }, 100);
  }, 500);
  setInterval(checkForNotifications, 3000);
}

// ✅ Create and load header
function loadHeader() {
  if (document.getElementById("topHeader")) {
    bindToExistingHeader();
    return;
  }

  if (!document.getElementById("poppinsFont")) {
    const fontLink = document.createElement("link");
    fontLink.id = "poppinsFont";
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&display=swap";
    document.head.appendChild(fontLink);
  }

  const headerHTML = `
    <header id="topHeader" style="
      position: fixed;
      top: 0;
      left: 256px;
      right: 0;
      height: 60px;
      background: white;
      margin: 0;
      display: flex;
      padding: 0 30px;
      z-index: 100;
    ">
      <div style="display: flex; align-items: center; gap: 20px;">
        <div id="clockDisplay" style="
          font-size: 19px;
          font-weight: 700;
          color: #005a32;
          position: absolute;
          right: 70px;
          font-family: 'Poppins', 'Segoe UI', sans-serif;
          letter-spacing: 0.5px;
        ">12:00:00 PM</div>
      </div>
      <div style="display: flex; align-items: center; gap: 15px; position: absolute; right: 30px; top: 10px;">
        <button type="button" id="notificationBell" title="Notifications" aria-label="Notifications" style="
          position: relative;
          width: 48px;
          height: 48px;
          padding: 0;
          border: none;
          background: transparent;
          border-radius: 50%;
          cursor: pointer;
          color: #666;
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, color 0.2s;
        "><i class="fa-solid fa-bell" style="pointer-events: none;"></i><span id="notificationBadge" style="
          position: absolute;
          top: 2px;
          right: 2px;
          background: #d62828;
          color: white;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          font-size: 11px;
          display: none;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          border: 2px solid white;
        ">0</span></button>
      </div>
    </header>
    <div id="notificationDropdown" style="
      position: fixed;
      top: 60px;
      right: 30px;
      width: 400px;
      max-width: calc(90vw - 250px);
      max-height: 500px;
      background: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border-radius: 8px;
      display: none;
      flex-direction: column;
      z-index: 9999;
      overflow: hidden;
    ">
      <div style="
        padding: 15px 20px;
        border-bottom: 2px solid #f0f0f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h3 style="margin: 0; color: #005a32; font-size: 18px;">Notifications</h3>
        <button id="clearAllNotifications" style="
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 12px;
          padding: 5px 10px;
        ">Clear All</button>
      </div>
      <div id="notificationList" style="
        max-height: 440px;
        overflow-y: auto;
        padding: 10px;
      ">
        <p style="text-align: center; color: #999; padding: 20px;">No notifications</p>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("afterbegin", headerHTML);

  const mainContent = document.querySelector(".mainContent");
  if (mainContent) {
    const currentMarginTop = mainContent.style.marginTop || "0px";
    const headerHeight = 60;
    if (currentMarginTop === "0px" || !currentMarginTop.includes("60")) {
      const existingMargin = parseInt(currentMarginTop) || 0;
      mainContent.style.marginTop = `${existingMargin + headerHeight}px`;
    }
  }

  updateClock();
  setInterval(updateClock, 1000);

  const notificationDropdown = document.getElementById("notificationDropdown");
  document.addEventListener("click", function (e) {
    const bell = document.getElementById("notificationBell");
    if (!bell || !notificationDropdown) return;
    if (bell === e.target || bell.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      const isVisible = notificationDropdown.style.display === "flex";
      notificationDropdown.style.display = isVisible ? "none" : "flex";
      if (!isVisible) loadNotifications();
    } else if (!notificationDropdown.contains(e.target)) {
      notificationDropdown.style.display = "none";
    }
  });

  const clearAllBtn = document.getElementById("clearAllNotifications");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => { clearAllNotifications(); });
  }

  setTimeout(() => {
    checkForNotifications();
    setTimeout(() => {
      if (window.previousNotificationCount === undefined) {
        window.previousNotificationCount = (window.currentNotifications || []).length;
      }
    }, 100);
  }, 500);

  setInterval(checkForNotifications, 3000);
}

// ✅ Update clock display
function updateClock() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  const hoursStr = String(h12).padStart(2, "0");
  const timeStr = `${hoursStr}:${minutes}:${seconds} ${ampm}`;

  const clockDisplay = document.getElementById("clockDisplay");
  if (clockDisplay) clockDisplay.textContent = timeStr;

  const dateDisplay = document.getElementById("headerDateDisplay");
  if (dateDisplay) {
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    dateDisplay.textContent = months[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear();
  }
}

// ✅ Play notification sound
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") {
      audioContext.resume().then(function () {
        playNotificationSoundInner(audioContext);
      }).catch(function () {
        playNotificationSoundInner(audioContext);
      });
    } else {
      playNotificationSoundInner(audioContext);
    }
  } catch (err) {
    console.log("Audio not available");
  }
}

function playNotificationSoundInner(audioContext) {
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 1000;
    oscillator.type = "sine";
    gainNode.gain.value = 0.3;
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (err) {
    console.log("Audio not available");
  }
}

// ✅ Check for notifications
function checkForNotifications() {
  // Always poll as safety net so missed socket events still appear.
  loadNotificationsFromServer();
}

// ✅ Update notification badge
function updateNotificationBadge(count) {
  const badge = document.getElementById("notificationBadge");
  const bell  = document.getElementById("notificationBell");
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : count;
      badge.style.display = "flex";
      if (bell) { bell.style.color = "#d62828"; bell.style.animation = "pulse 2s infinite"; }
    } else {
      badge.style.display = "none";
      if (bell) { bell.style.color = "#666"; bell.style.animation = "none"; }
    }
  }
}

// ✅ Load notifications in dropdown
function loadNotifications() {
  const notificationList = document.getElementById("notificationList");
  if (!notificationList) return;
 
  const notifications = window.currentNotifications || [];
  
  if (notifications.length === 0) {
    notificationList.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">No notifications</p>';
    return;
  }
 
  notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
 
  notificationList.innerHTML = notifications.map((notif) => {
    const timeAgo = getTimeAgo(new Date(notif.createdAt).getTime());
    const icon = getNotificationIcon(notif.type);
 
    return `
      <div class="notification-item" style="
        padding:12px;border-bottom:1px solid #f0f0f0;cursor:pointer;transition:background 0.2s;
      " data-id="${notif._id}" data-type="${notif.type}" data-notif='${JSON.stringify(notif).replace(/'/g, "&apos;")}'>
        <div style="display:flex;gap:10px;">
          <div style="font-size:20px;">${icon}</div>
          <div style="flex:1;">
            <div style="font-weight:600;color:#333;margin-bottom:4px;">${notif.title}</div>
            <div style="font-size:13px;color:#666;margin-bottom:4px;">${notif.message}</div>
            <div style="font-size:11px;color:#999;">${timeAgo}</div>
          </div>
          <button class="mark-read-btn" style="
            background:none;border:none;color:#999;cursor:pointer;padding:5px;font-size:12px;
          " title="Mark as read">×</button>
        </div>
      </div>`;
  }).join("");
 
  // Add event listeners
  notificationList.querySelectorAll(".notification-item").forEach((item) => {
    item.addEventListener("click", async (e) => {
      if (e.target.classList.contains("mark-read-btn")) {
        e.stopPropagation();
        const notifData = JSON.parse(item.dataset.notif);
        await markNotificationAsHandled(notifData._id);
        item.remove();
        return;
      }
      
      const notifData = JSON.parse(item.dataset.notif);
      await handleNotificationClick(notifData);
    });
    
    item.addEventListener("mouseenter", function () { this.style.background = "#f5f5f5"; });
    item.addEventListener("mouseleave", function () { this.style.background = "white"; });
  });
}
 
// Get notification icon based on type
function getNotificationIcon(type) {
  const icons = {
    "doctor_enter": "🔔",
    "appointment_time_arrived": "⏰",
    "nurse_response": "✅",
    "appointment_started": "✅",
    "appointment_canceled": "❌",
    "lab_request": "🧪",
    "lab_result_ready": "📋",
    "reschedule": "📅"
  };
  return icons[type] || "🔔";
}
 
// ✅ UPDATED: Handle notification click
async function handleNotificationClick(notification) {
  const dropdown = document.getElementById("notificationDropdown");
  if (dropdown) dropdown.style.display = "none";
 
  const type = notification.type;
  
  // Mark as handled on server
  await markNotificationAsHandled(notification._id);
 
  // Handle based on type
  const notificationPayload = {
    ...notification,
    ...(notification.data || {}),
  };

  if (type === "doctor_enter") {
    if (typeof showDoctorEnterNotification === "function") {
      showDoctorEnterNotification(notificationPayload, true);
    } else {
      window.location.href = "Appointments.html";
    }
  } 
  else if (type === "appointment_time_arrived") {
    if (typeof showAppointmentTimeArrivedModal === "function") {
      showAppointmentTimeArrivedModal(notificationPayload, true);
    }
  } 
  else if (type === "appointment_started" || type === "appointment_canceled") {
    const message = type === "appointment_started"
      ? `✅ Patient ${notification.patientName} has been permitted to enter. Appointment is now Ongoing.`
      : `❌ Appointment for ${notification.patientName} has been canceled.`;
    
    alert(message);
    
    if (window.location.href.includes("Appointments.html") && typeof loadAppointments === "function") {
      loadAppointments();
    }
  } 
  else if (type === "nurse_response") {
    if (typeof showNurseResponseNotification === "function") {
      showNurseResponseNotification(notificationPayload, true);
    } else {
      window.location.href = "Appointments.html";
    }
  } 
  else if (type === "lab_request") {
    // Store doctor name for autofill
    if (notification.doctorName) {
      sessionStorage.setItem("pendingPhysician", notification.doctorName);
    }
    
    if (typeof showLabRequestNotification === "function") {
      showLabRequestNotification(notificationPayload, true);
    } else {
      window.location.href = "MedtechRequests.html";
    }
  }
  else if (type === "reschedule") {
    if (typeof showRescheduleNotification === "function") {
      showRescheduleNotification(notificationPayload, true);
    }
  }
}
 
// ✅ NEW: Mark notification as handled on server
async function markNotificationAsHandled(notificationId) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/notifications/${notificationId}/handle`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (response.ok) {
      // Remove from local list
      removeNotificationFromUI(notificationId);
    }
  } catch (err) {
    console.error('Error marking notification as handled:', err);
  }
}
 
// ✅ UPDATED: Clear all notifications
async function clearAllNotifications() {
  const userId = sessionStorage.getItem("userId");
  const role = sessionStorage.getItem("role");
  
  if (!userId || !role) return;
  
  try {
    const response = await fetch('http://localhost:5000/api/notifications/clear', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role })
    });
    
    if (response.ok) {
      window.currentNotifications = [];
      updateNotificationBadge(0);
      loadNotifications();
    }
  } catch (err) {
    console.error('Error clearing notifications:', err);
  }
}



// ✅ Mark notification as read
function markNotificationAsReadLegacy(notificationId, type, appointmentId) {
  if (type === "doctor_enter") {
    let n = JSON.parse(localStorage.getItem("doctorEnterNotifications") || "[]");
    n = n.map((x) => x.appointmentId === appointmentId && !x.handled ? { ...x, handled: true } : x);
    localStorage.setItem("doctorEnterNotifications", JSON.stringify(n));
  } else if (type === "nurse_response") {
    let n = JSON.parse(localStorage.getItem("nurseResponseNotifications") || "[]");
    n = n.map((x) => x.appointmentId === appointmentId && !x.handled ? { ...x, handled: true } : x);
    localStorage.setItem("nurseResponseNotifications", JSON.stringify(n));
  } else if (type === "appointment_time_arrived") {
    let n = JSON.parse(localStorage.getItem("appointmentTimeArrivedNotifications") || "[]");
    n = n.map((x) => x.appointmentId === appointmentId && !x.handled ? { ...x, handled: true } : x);
    localStorage.setItem("appointmentTimeArrivedNotifications", JSON.stringify(n));
  } else if (type === "appointment_started") {
    let n = JSON.parse(localStorage.getItem("appointmentStartedNotifications") || "[]");
    n = n.map((x) => x.appointmentId === appointmentId && !x.handled ? { ...x, handled: true } : x);
    localStorage.setItem("appointmentStartedNotifications", JSON.stringify(n));
  } else if (type === "appointment_canceled") {
    let n = JSON.parse(localStorage.getItem("appointmentCanceledNotifications") || "[]");
    n = n.map((x) => x.appointmentId === appointmentId && !x.handled ? { ...x, handled: true } : x);
    localStorage.setItem("appointmentCanceledNotifications", JSON.stringify(n));
  } else if (type === "lab_request") {
    let n = JSON.parse(localStorage.getItem("medtechRequestNotifications") || "[]");
    n = n.map((x) => `lab_request_${x.requestId}_${x.timestamp}` === notificationId && !x.handled ? { ...x, handled: true } : x);
    localStorage.setItem("medtechRequestNotifications", JSON.stringify(n));
  }
  checkForNotifications();
}

// ✅ Clear all notifications
function clearAllNotificationsLegacy() {
  const role = sessionStorage.getItem("role");
  if (role === "Nurse") {
    let n = JSON.parse(localStorage.getItem("doctorEnterNotifications") || "[]");
    localStorage.setItem("doctorEnterNotifications", JSON.stringify(n.map((x) => ({ ...x, handled: true }))));
    let t = JSON.parse(localStorage.getItem("appointmentTimeArrivedNotifications") || "[]");
    localStorage.setItem("appointmentTimeArrivedNotifications", JSON.stringify(t.map((x) => ({ ...x, handled: true }))));
  } else if (role === "Doctor") {
    const uid = sessionStorage.getItem("userId");
    let n = JSON.parse(localStorage.getItem("nurseResponseNotifications") || "[]");
    localStorage.setItem("nurseResponseNotifications", JSON.stringify(n.map((x) => x.doctorId === uid || !x.doctorId ? { ...x, handled: true } : x)));
    let s = JSON.parse(localStorage.getItem("appointmentStartedNotifications") || "[]");
    localStorage.setItem("appointmentStartedNotifications", JSON.stringify(s.map((x) => x.doctorId === uid ? { ...x, handled: true } : x)));
    let c = JSON.parse(localStorage.getItem("appointmentCanceledNotifications") || "[]");
    localStorage.setItem("appointmentCanceledNotifications", JSON.stringify(c.map((x) => x.doctorId === uid ? { ...x, handled: true } : x)));
  } else if (role === "Medtech") {
    let n = JSON.parse(localStorage.getItem("medtechRequestNotifications") || "[]");
    localStorage.setItem("medtechRequestNotifications", JSON.stringify(n.map((x) => ({ ...x, handled: true }))));
  }
  checkForNotifications();
  loadNotifications();
}

// ✅ Get time ago string
function getTimeAgo(timestamp) {
  const now     = Date.now();
  const diff    = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours   < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ✅ Pulse animation CSS
const style = document.createElement("style");
style.textContent = `@keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }`;
document.head.appendChild(style);

function initializeHeaderNotificationSystem() {
  if (window.__headerNotificationSystemInitialized) return;
  window.__headerNotificationSystemInitialized = true;

  loadHeader();

  // Initialize Socket.io connection once.
  setTimeout(() => {
    initializeSocket();
  }, 1000);

  // Keep periodic server sync for cross-device consistency.
  setInterval(checkForNotifications, 3000);
}

window.checkForNotifications = checkForNotifications;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeHeaderNotificationSystem);
} else {
  initializeHeaderNotificationSystem();
}

window.addEventListener('beforeunload', () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
});
 
// Make socket globally accessible for debugging
window.notificationSocket = socket;