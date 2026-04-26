// ====== MEDTECH NOTIFICATION SYSTEM FOR NEW LAB REQUESTS ======
// ✅ FIX: Gumagamit ng IPC (ipcRenderer) para makinig sa new lab requests
//    mula sa doctor. Ang localStorage 'storage' event hindi reliable sa
//    Electron kapag iisang BrowserWindow lang — hindi nag-fi-fire sa same window.

const { ipcRenderer } = require('electron');

let notificationSound = null;

// ── Audio ─────────────────────────────────────────────────────────────────

function initAudio() {
  if (notificationSound) return;
  try {
    // ✅ Relative path — works kapag naka-load ang HTML sa tamang directory
    notificationSound = new Audio('./sounds/notification.mp3');
    notificationSound.volume = 0.5;
    notificationSound.load();

    // ✅ Debug: Alamin kung nag-load ba talaga ang audio file
    notificationSound.addEventListener('canplaythrough', () => {
      console.log('✅ Medtech audio ready to play');
    });
    notificationSound.addEventListener('error', (e) => {
      console.error('❌ Medtech audio failed to load. Check path: ./sounds/notification.mp3', e);
    });

    console.log('✅ Medtech notification audio initialized and preloaded');
  } catch (err) {
    console.error('Audio initialization failed:', err);
  }
}

function playNotificationSound() {
  if (!notificationSound) {
    initAudio();
  }
  if (notificationSound) {
    notificationSound.currentTime = 0;
    notificationSound.volume = 0.5;
    notificationSound.play()
      .then(() => console.log('🔔 Medtech notification sound played'))
      .catch(err => console.warn('Could not play notification sound:', err));
  } else {
    console.warn('⚠️ Notification sound not initialized');
  }
}

// ── Badge Count Helper ────────────────────────────────────────────────────

function checkNewLabRequestsNotifications() {
  const userRole = sessionStorage.getItem("role");
  if (userRole !== "Medtech") return 0;

  try {
    const notifications = JSON.parse(localStorage.getItem("medtechRequestNotifications") || "[]");

    // Deduplicate
    const uniqueNotifications = [];
    const seen = new Set();
    for (const n of notifications) {
      const key = `${n.requestId}_${n.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueNotifications.push(n);
      }
    }

    if (uniqueNotifications.length !== notifications.length) {
      console.log(`🧹 Removed ${notifications.length - uniqueNotifications.length} duplicate notifications`);
      localStorage.setItem("medtechRequestNotifications", JSON.stringify(uniqueNotifications));
    }

    return uniqueNotifications.filter(n => !n.handled).length;
  } catch (err) {
    console.error("Error checking lab request notifications:", err);
    return 0;
  }
}

// ── Notification Modal ────────────────────────────────────────────────────

function showLabRequestNotification(notification, fromHeader = false) {
  if (!fromHeader) {
    console.warn("showLabRequestNotification blocked — must be triggered from header bell.");
    return;
  }

  const existing = document.getElementById("medtechRequestNotificationModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "medtechRequestNotificationModal";
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-color: rgba(0,0,0,0.6);
    display: flex; justify-content: center; align-items: center; z-index: 10000;
  `;

  const tests = Array.isArray(notification.tests) && notification.tests.length
    ? notification.tests.join(', ')
    : (notification.tests || 'Lab Test');

  modal.innerHTML = `
    <div style="
      background: white; border-radius: 12px; padding: 30px;
      max-width: 500px; width: 90%;
      box-shadow: 0 5px 25px rgba(0,0,0,0.3);
    ">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 48px; margin-bottom: 10px;">🧪</div>
        <h2 style="margin: 0; color: #065f46;">New Lab Request</h2>
      </div>
      <div style="margin-bottom: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #065f46;">
        <p style="margin: 5px 0;"><strong>Patient:</strong> ${notification.patientName || 'Unknown'}</p>
        <p style="margin: 5px 0;"><strong>Doctor:</strong> ${notification.doctorName || 'Unknown'}</p>
        <p style="margin: 5px 0;"><strong>Request ID:</strong> ${notification.requestId || 'N/A'}</p>
        <p style="margin: 5px 0;"><strong>Test(s):</strong> ${tests}</p>
        ${notification.priority
          ? `<p style="margin: 5px 0;"><strong>Priority:</strong> <span style="color:#8B5A2B;font-weight:bold;">${notification.priority}</span></p>`
          : ''}
      </div>
      <div style="display: flex; justify-content: center;">
        <button id="medtechViewRequestBtn" style="
          background: #065f46; color: white; border: none;
          padding: 12px 30px; border-radius: 5px;
          cursor: pointer; font-weight: 600; font-size: 16px;
        ">View in Lab Requests</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("medtechViewRequestBtn").onclick = () => {
    markLabRequestNotificationHandled(notification);
    modal.remove();
    window.location.href = 'MedtechRequests.html';
  };

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ── Mark Handled ──────────────────────────────────────────────────────────

function markLabRequestNotificationHandled(notification) {
  try {
    let notifications = JSON.parse(localStorage.getItem("medtechRequestNotifications") || "[]");
    const idx = notifications.findIndex(
      n => n.requestId === notification.requestId && n.timestamp === notification.timestamp
    );
    if (idx > -1) {
      notifications[idx].handled = true;
      localStorage.setItem("medtechRequestNotifications", JSON.stringify(notifications));
      console.log(`✅ Marked notification ${notification.requestId} as handled`);
    }
    if (typeof checkForNotifications === "function") checkForNotifications();
  } catch (e) {
    console.error("Error marking notification handled:", e);
  }
}

// ── Exports ───────────────────────────────────────────────────────────────

window.showLabRequestNotification        = showLabRequestNotification;
window.markLabRequestNotificationHandled = markLabRequestNotificationHandled;
window.checkNewLabRequestsNotifications  = checkNewLabRequestsNotifications;
window.playNotificationSound             = playNotificationSound;

// ── Init ──────────────────────────────────────────────────────────────────

let _prevUnhandledCount = 0;

document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem("role") !== "Medtech") return;

  // ✅ Preload audio agad — hindi na kailangan ng click
  initAudio();

  // ✅ Baseline count para hindi mag-ring sa unang load
  _prevUnhandledCount = checkNewLabRequestsNotifications();

  // ── IPC Listener: Direktang signal mula sa main process ─────────────────
  // ✅ PANGUNAHING FIX: Ito ang reliable na paraan sa Electron.
  //    Kapag nag-send ang doctor ng lab request, tatawag siya ng
  //    ipcRenderer.send('new-lab-request', data) — ini-broadcast ng main.js
  //    sa lahat ng windows gamit ang 'lab-request-received' event.
  ipcRenderer.on('lab-request-received', (event, data) => {
    console.log('🔔 Medtech received new lab request via IPC:', data);

    // I-save sa localStorage para ma-reflect sa badge count
    try {
      const notifications = JSON.parse(localStorage.getItem("medtechRequestNotifications") || "[]");
      notifications.push({
        ...data,
        handled: false,
        timestamp: data.timestamp || Date.now()
      });
      localStorage.setItem("medtechRequestNotifications", JSON.stringify(notifications));
    } catch (e) {
      console.error('Error saving IPC notification to localStorage:', e);
    }

    playNotificationSound();
    _prevUnhandledCount = checkNewLabRequestsNotifications();
    if (typeof checkForNotifications === "function") checkForNotifications();
  });

  // ── Polling fallback: every 5 seconds (backup lang ito) ─────────────────
  setInterval(() => {
    const currentCount = checkNewLabRequestsNotifications();
    if (currentCount > _prevUnhandledCount) {
      console.log(`🔔 Polling detected new lab request (${_prevUnhandledCount} → ${currentCount})`);
      playNotificationSound();
    }
    _prevUnhandledCount = currentCount;
    if (typeof checkForNotifications === "function") checkForNotifications();
  }, 5000);

  // ── localStorage storage event (cross-tab fallback) ─────────────────────
  // Gumagana lang ito kapag ibang tab/window ang nag-set ng item.
  // Retained para sa edge cases.
  window.addEventListener('storage', e => {
    if (e.key === "medtechRequestNotifications") {
      console.log('🔄 Medtech notifications updated from another tab (storage event)');
      const currentCount = checkNewLabRequestsNotifications();
      if (currentCount > _prevUnhandledCount) {
        playNotificationSound();
      }
      _prevUnhandledCount = currentCount;
      if (typeof checkForNotifications === "function") checkForNotifications();
    }
  });
});