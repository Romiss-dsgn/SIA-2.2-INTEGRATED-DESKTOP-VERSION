// ====== DOCTOR NOTIFICATION SYSTEM ======
// Handles: Nurse responses & Reschedule notifications
// Rules: No auto-popup modals. Modals ONLY appear on header bell click.
// ✅ FIX: Gumagamit ng ipcRenderer.send('new-lab-request') para mag-notify
//    ng Medtech reliably — hindi na umaasa sa localStorage storage event
//    na hindi nag-fi-fire sa same Electron window.

// ✅ FIX: Dati ay const { ipcRenderer } = require('electron') — hindi gumagana
//    sa renderer process. Ngayon ginagamit na ang window.ipcRenderer na
//    ini-expose ng preload.js via: window.ipcRenderer = ipcRenderer
const ipcRenderer = window.ipcRenderer;

// ── Audio ─────────────────────────────────────────────────────────────────

let doctorNotificationSound = null;

function initDoctorAudio() {
  if (doctorNotificationSound) return;
  try {
    doctorNotificationSound = new Audio('./sounds/notification.mp3');
    doctorNotificationSound.volume = 0.5;
    doctorNotificationSound.load();

    // ✅ Debug listeners
    doctorNotificationSound.addEventListener('canplaythrough', () => {
      console.log('✅ Doctor audio ready to play');
    });
    doctorNotificationSound.addEventListener('error', (e) => {
      console.error('❌ Doctor audio failed to load. Check path: ./sounds/notification.mp3', e);
    });
  } catch (err) {
    console.error("Audio initialization failed:", err);
  }
}

function playDoctorNotificationSound() {
  if (!doctorNotificationSound) initDoctorAudio();
  if (!doctorNotificationSound) return;
  doctorNotificationSound.currentTime = 0;
  doctorNotificationSound.play().catch(err => console.warn("Could not play notification sound:", err));
}

// ── Badge Count Helper ────────────────────────────────────────────────────

function _getNurseResponseCount() {
  try {
    const notifications = JSON.parse(localStorage.getItem("nurseResponseNotifications") || "[]");
    return notifications.filter(n => !n.handled).length;
  } catch {
    return 0;
  }
}

// ── Sound Polling ─────────────────────────────────────────────────────────

let _prevNurseResponseCount = 0;

function _checkAndPlaySound() {
  const current = _getNurseResponseCount();
  if (current > _prevNurseResponseCount) {
    playDoctorNotificationSound();
  }
  _prevNurseResponseCount = current;
}

// ── Nurse Response Modal (called only from header bell) ───────────────────

function showNurseResponseNotification(notification, fromHeader = false) {
  if (!fromHeader) {
    document.getElementById("nurseResponseNotificationModal")?.remove();
    return;
  }

  document.getElementById("nurseResponseNotificationModal")?.remove();

  const isOngoing   = notification.status === "ongoing";
  const statusText  = isOngoing
    ? "Patient is present. Appointment status changed to Ongoing."
    : "Patient is not present. Appointment has been canceled and moved to archive.";
  const statusColor = isOngoing ? "#2da624" : "#ca3030";
  const statusIcon  = isOngoing ? "✅" : "❌";

  const modal = document.createElement("div");
  modal.id = "nurseResponseNotificationModal";
  modal.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex; justify-content: center; align-items: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div style="
      background: white; border-radius: 12px; padding: 30px;
      max-width: 500px; width: 90%;
      box-shadow: 0 5px 25px rgba(0,0,0,0.3);
      animation: fadeIn 0.3s;
    ">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 48px; margin-bottom: 10px;">${statusIcon}</div>
        <h2 style="margin: 0; color: ${statusColor};">Nurse Response</h2>
      </div>
      <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <p style="margin: 5px 0;"><strong>Patient:</strong> ${notification.patientName || "Unknown"}</p>
        <p style="margin: 5px 0;"><strong>Appointment ID:</strong> ${notification.appointmentId || "N/A"}</p>
        <p style="
          margin: 10px 0; padding: 10px;
          background: white; border-radius: 5px;
          color: ${statusColor}; font-weight: 600;
        ">${statusText}</p>
      </div>
      <div style="display: flex; justify-content: center;">
        <button id="acknowledgeNotificationBtn" style="
          background: ${statusColor}; color: white; border: none;
          padding: 12px 30px; border-radius: 5px;
          cursor: pointer; font-weight: 600; font-size: 16px;
        ">OK</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("acknowledgeNotificationBtn").addEventListener("click", () => {
    modal.remove();
    markNurseResponseHandled(notification);
    if (window.location.href.includes("Appointments.html") && typeof loadAppointments === "function") {
      loadAppointments();
    }
  });
}

// ── Reschedule Modal (called only from header bell) ───────────────────────

function showRescheduleNotification(notification, fromHeader = false) {
  if (!fromHeader) {
    document.getElementById("rescheduleNotificationModal")?.remove();
    return;
  }

  document.getElementById("rescheduleNotificationModal")?.remove();

  const formatDate = (str) => {
    if (!str) return "N/A";
    return new Date(str).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const modal = document.createElement("div");
  modal.id = "rescheduleNotificationModal";
  modal.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex; justify-content: center; align-items: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div style="
      background: white; border-radius: 12px; padding: 30px;
      max-width: 550px; width: 90%;
      box-shadow: 0 5px 25px rgba(0,0,0,0.3);
      animation: fadeIn 0.3s;
    ">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 48px; margin-bottom: 10px;">📅</div>
        <h2 style="margin: 0; color: #f59e0b;">Appointment Rescheduled</h2>
      </div>
      <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <p style="margin: 5px 0;"><strong>Patient:</strong> ${notification.patientName || "Unknown"}</p>
        <p style="margin: 5px 0;"><strong>Appointment ID:</strong> ${notification.appointmentId || "N/A"}</p>
        <p style="margin: 5px 0;"><strong>Rescheduled by:</strong> ${notification.rescheduledBy || "Nurse"}</p>

        <div style="margin-top: 15px; padding: 12px; background: white; border-radius: 6px; border-left: 4px solid #ef4444;">
          <p style="margin: 5px 0; font-weight: 600; color: #ef4444;">Previous Schedule:</p>
          <p style="margin: 5px 0;">📅 ${formatDate(notification.oldDate)} at ${notification.oldTime || "N/A"}</p>
        </div>

        <div style="margin-top: 10px; padding: 12px; background: white; border-radius: 6px; border-left: 4px solid #10b981;">
          <p style="margin: 5px 0; font-weight: 600; color: #10b981;">New Schedule:</p>
          <p style="margin: 5px 0;">📅 ${formatDate(notification.newDate)} at ${notification.newTime || "N/A"}</p>
        </div>

        ${notification.reason ? `
        <div style="margin-top: 10px; padding: 10px; background: #fef3c7; border-radius: 6px;">
          <p style="margin: 0; font-size: 13px;"><strong>Reason:</strong> ${notification.reason}</p>
        </div>` : ""}
      </div>
      <div style="display: flex; justify-content: center;">
        <button id="acknowledgeRescheduleBtn" style="
          background: #f59e0b; color: white; border: none;
          padding: 12px 30px; border-radius: 5px;
          cursor: pointer; font-weight: 600; font-size: 16px;
        ">OK, Got It</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("acknowledgeRescheduleBtn").addEventListener("click", () => {
    modal.remove();
    markRescheduleHandled(notification);
    if (window.location.href.includes("Appointments.html") && typeof loadAppointments === "function") {
      loadAppointments();
    }
  });
}

// ── Mark Handled ──────────────────────────────────────────────────────────

function markNurseResponseHandled(notification) {
  try {
    const notifications = JSON.parse(localStorage.getItem("nurseResponseNotifications") || "[]");
    const idx = notifications.findIndex(n =>
      n.appointmentId === notification.appointmentId && n.timestamp === notification.timestamp
    );
    if (idx !== -1) {
      notifications[idx].handled = true;
      localStorage.setItem("nurseResponseNotifications", JSON.stringify(notifications));
    }
  } catch (err) {
    console.error("Error marking nurse response as handled:", err);
  }
}

function markRescheduleHandled(notification) {
  try {
    const notifications = JSON.parse(localStorage.getItem("rescheduleNotifications") || "[]");
    const idx = notifications.findIndex(n =>
      n.appointmentId === notification.appointmentId && n.timestamp === notification.timestamp
    );
    if (idx !== -1) {
      notifications[idx].handled = true;
      localStorage.setItem("rescheduleNotifications", JSON.stringify(notifications));
    }
  } catch (err) {
    console.error("Error marking reschedule notification as handled:", err);
  }
}

// ── Lab Request Sender (called by doctor when nag-send ng lab request) ────
// ✅ FIX: Dagdag na ang ipcRenderer.send para mag-notify ng Medtech via IPC.
//    I-call ito kasabay ng pag-save sa localStorage.
//
// PAANO GAMITIN sa iyong doctor lab request submission code:
//
//   sendLabRequestNotification({
//     requestId: 'REQ-001',
//     patientName: 'Juan dela Cruz',
//     doctorName: sessionStorage.getItem('name'),
//     tests: ['CBC', 'Urinalysis'],
//     priority: 'STAT'  // optional
//   });
//
function sendLabRequestNotification(data) {
  const notification = {
    requestId:   data.requestId,
    patientName: data.patientName,
    doctorName:  data.doctorName || sessionStorage.getItem('name') || 'Doctor',
    tests:       data.tests || [],
    priority:    data.priority || null,
    timestamp:   Date.now(),
    handled:     false
  };

  // ✅ 1. I-save sa localStorage (para sa badge count at modal display)
  try {
    const existing = JSON.parse(localStorage.getItem("medtechRequestNotifications") || "[]");
    existing.push(notification);
    localStorage.setItem("medtechRequestNotifications", JSON.stringify(existing));
    console.log('💾 Lab request saved to localStorage:', notification.requestId);
  } catch (e) {
    console.error('Error saving lab request to localStorage:', e);
  }

  // ✅ 2. I-send via IPC — ito ang nagpapatunog ng notification sa Medtech
  //    Ini-broadcast ng main.js sa lahat ng BrowserWindows
  ipcRenderer.send('new-lab-request', notification);
  console.log('📡 Lab request sent via IPC:', notification.requestId);
}

// ── Reschedule Notifier (called by nurse) ─────────────────────────────────

function notifyDoctorOfReschedule(appointmentData, doctorId) {
  const notification = {
    type:           "reschedule",
    appointmentId:  appointmentData.appointmentId,
    patientName:    appointmentData.patientName,
    doctorId,
    oldDate:        appointmentData.oldDate,
    oldTime:        appointmentData.oldTime,
    newDate:        appointmentData.newDate,
    newTime:        appointmentData.newTime,
    reason:         appointmentData.reason || "",
    rescheduledBy:  appointmentData.rescheduledBy || sessionStorage.getItem("name") || "Nurse",
    timestamp:      Date.now(),
    handled:        false,
  };

  const key = `rescheduleNotification_${notification.appointmentId}_${notification.timestamp}`;
  localStorage.setItem(key, JSON.stringify(notification));

  const all = JSON.parse(localStorage.getItem("rescheduleNotifications") || "[]");
  all.push(notification);
  localStorage.setItem("rescheduleNotifications", JSON.stringify(all));

  window.dispatchEvent(new StorageEvent("storage", { key, newValue: JSON.stringify(notification) }));
}

// ── Exports ───────────────────────────────────────────────────────────────

window.notifyDoctorOfReschedule      = notifyDoctorOfReschedule;
window.showNurseResponseNotification = showNurseResponseNotification;
window.showRescheduleNotification    = showRescheduleNotification;
window.playDoctorNotificationSound   = playDoctorNotificationSound;
window.sendLabRequestNotification    = sendLabRequestNotification; // ✅ NEW

// ── Init ──────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // ✅ Preload audio agad — hindi na kailangan ng click
  initDoctorAudio();

  // Seed count on load para hindi false-trigger ang sound
  _prevNurseResponseCount = _getNurseResponseCount();

  setInterval(() => {
    _checkAndPlaySound();
    if (typeof checkForNotifications === "function") checkForNotifications();
  }, 15000);

  // ✅ IPC: Pakinggan din ang lab-request-received (para tumunog din sa doctor window kung kailangan)
  ipcRenderer.on('lab-request-received', () => {
    if (typeof checkForNotifications === "function") checkForNotifications();
  });

  // Cross-tab: storage event (para sa nurse reschedule notifications)
  window.addEventListener("storage", (e) => {
    if (!e.key) return;
    const isRelevant =
      e.key.startsWith("nurseResponseNotification_") ||
      e.key.startsWith("rescheduleNotification_");

    if (isRelevant) {
      playDoctorNotificationSound();
      if (typeof checkForNotifications === "function") checkForNotifications();
      _prevNurseResponseCount = _getNurseResponseCount();
    }
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if (typeof checkForNotifications === "function") checkForNotifications();
});