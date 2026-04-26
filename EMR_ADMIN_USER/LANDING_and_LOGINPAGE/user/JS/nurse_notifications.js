// ====== NURSE NOTIFICATION SYSTEM ======
// Handles: Doctor Enter button notifications & Appointment Time Arrival notifications
// Rules: Badge counts update via polling. Modals ONLY appear on header bell click.

// ── Audio ────────────────────────────────────────────────────────────────────

let notificationSound = null;

function initAudio() {
  if (notificationSound) return;
  try {
    const src = (typeof window !== "undefined" && window.electron)
      ? "file://" + __dirname + "/sounds/notification.mp3"
      : "sounds/notification.mp3";
    notificationSound = new Audio(src);
    notificationSound.volume = 0.5;
  } catch (err) {
    console.error("Audio initialization failed:", err);
  }
}

function playNotificationSound() {
  initAudio();
  if (!notificationSound) return;
  notificationSound.currentTime = 0;
  notificationSound.play().catch(err => console.warn("Could not play notification sound:", err));
}

// ── Badge Count Helpers ──────────────────────────────────────────────────────

function checkAppointmentTimeNotifications() {
  if (sessionStorage.getItem("role") !== "Nurse") return 0;
  try {
    const notifications = JSON.parse(localStorage.getItem("appointmentTimeArrivedNotifications") || "[]");
    return notifications.filter(n => {
      const key = `timeNotificationHandled_${n.appointmentId}_${n.timestamp}`;
      return !sessionStorage.getItem(key) && !n.handled;
    }).length;
  } catch (err) {
    console.error("Error checking appointment time notifications:", err);
    return 0;
  }
}

function checkDoctorEnterNotifications() {
  if (sessionStorage.getItem("role") !== "Nurse") return 0;
  try {
    const notifications = JSON.parse(localStorage.getItem("doctorEnterNotifications") || "[]");
    return notifications.filter(n => {
      const key = `doctorEnterHandled_${n.appointmentId}_${n.timestamp}`;
      return !sessionStorage.getItem(key) && !n.handled;
    }).length;
  } catch (err) {
    console.error("Error checking doctor enter notifications:", err);
    return 0;
  }
}

// ── Sound Polling ────────────────────────────────────────────────────────────

let _prevDoctorEnterCount = 0;
let _prevTimeArrivedCount = 0;

function _checkAndPlaySound() {
  const doctorCount = checkDoctorEnterNotifications();
  const timeCount   = checkAppointmentTimeNotifications();

  if (doctorCount > _prevDoctorEnterCount || timeCount > _prevTimeArrivedCount) {
    playNotificationSound();
  }

  _prevDoctorEnterCount = doctorCount;
  _prevTimeArrivedCount = timeCount;
}

// ── Modals (called only from header bell) ────────────────────────────────────

function showDoctorEnterNotification(notification, fromHeader = false) {
  if (!fromHeader) {
    console.warn("showDoctorEnterNotification blocked — must be triggered from header bell.");
    return;
  }

  document.getElementById("doctorEnterNotificationModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "doctorEnterNotificationModal";
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
        <div style="font-size: 48px; margin-bottom: 10px;">🔔</div>
        <h2 style="margin: 0; color: #358F85;">Doctor Consultation Request</h2>
      </div>
      <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <p style="margin: 5px 0;"><strong>Doctor:</strong> ${notification.doctorName || "Unknown"}</p>
        <p style="margin: 5px 0;"><strong>Patient:</strong> ${notification.patientName || "Unknown"}</p>
        <p style="margin: 5px 0;"><strong>Appointment ID:</strong> ${notification.appointmentId || "N/A"}</p>
        <p style="margin: 5px 0; color: #666; font-size: 14px;">
          The doctor is ready to consult with this patient. Is the patient present?
        </p>
      </div>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="confirmPatientPresentBtn" style="
          background: #358F85; color: white; border: none;
          padding: 12px 30px; border-radius: 5px;
          cursor: pointer; font-weight: 600; font-size: 16px;
        ">OK</button>
        <button id="cancelPatientNotPresentBtn" style="
          background: #ca3030; color: white; border: none;
          padding: 12px 30px; border-radius: 5px;
          cursor: pointer; font-weight: 600; font-size: 16px;
        ">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("confirmPatientPresentBtn").addEventListener("click", async () => {
    modal.remove();
    await handlePatientResponse(notification, true);
  });

  document.getElementById("cancelPatientNotPresentBtn").addEventListener("click", async () => {
    modal.remove();
    await handlePatientResponse(notification, false);
  });
}

if (typeof showAppointmentTimeArrivedModal === "undefined") {
  window.showAppointmentTimeArrivedModal = function(notification, fromHeader = false) {
    if (!fromHeader) {
      console.warn("showAppointmentTimeArrivedModal blocked — must be triggered from header bell.");
      return;
    }

    document.getElementById("appointmentTimeArrivedModal")?.remove();

    const modal = document.createElement("div");
    modal.id = "appointmentTimeArrivedModal";
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
      ">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 48px; margin-bottom: 10px;">⏰</div>
          <h2 style="margin: 0; color: #358F85;">Appointment Time Arrived</h2>
        </div>
        <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
          <p style="margin: 5px 0;"><strong>Patient:</strong> ${notification.patientName || "Unknown"}</p>
          <p style="margin: 5px 0;"><strong>Doctor:</strong> ${notification.doctorName || "Unknown"}</p>
          <p style="margin: 5px 0;"><strong>Appointment ID:</strong> ${notification.appointmentId || "N/A"}</p>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">
            This appointment is scheduled for now. Please prepare the patient.
          </p>
        </div>
        <div style="display: flex; justify-content: center;">
          <button id="dismissTimeArrivedBtn" style="
            background: #358F85; color: white; border: none;
            padding: 12px 40px; border-radius: 5px;
            cursor: pointer; font-weight: 600; font-size: 16px;
          ">Dismiss</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("dismissTimeArrivedBtn").addEventListener("click", () => {
      modal.remove();

      const key = `timeNotificationHandled_${notification.appointmentId}_${notification.timestamp}`;
      sessionStorage.setItem(key, "true");

      const notifications = JSON.parse(localStorage.getItem("appointmentTimeArrivedNotifications") || "[]");
      const idx = notifications.findIndex(n =>
        n.appointmentId === notification.appointmentId && n.timestamp === notification.timestamp
      );
      if (idx !== -1) {
        notifications[idx].handled = true;
        localStorage.setItem("appointmentTimeArrivedNotifications", JSON.stringify(notifications));
      }

      if (typeof checkForNotifications === "function") checkForNotifications();
    });
  };
}

// ── Patient Response Handler ─────────────────────────────────────────────────

async function handlePatientResponse(notification, patientPresent) {
  const { appointmentId } = notification;
  const doctorId = notification.doctorId || notification.data?.doctorId;

  try {
    if (patientPresent) {
      const res = await fetch(`http://localhost:5000/api/appointments/${appointmentId}/start`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.text();
        let msg = "Failed to start appointment";
        try { msg = JSON.parse(data).message || msg; } catch (_) {}
        throw new Error(msg);
      }

      await notifyDoctor(appointmentId, notification.patientName, "ongoing", doctorId);
      alert("✅ Patient is present. Appointment status changed to Ongoing. Doctor has been notified.");
    } else {
      const cancelRes = await fetch(`http://localhost:5000/api/appointments/${appointmentId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Canceled" }),
      });

      if (!cancelRes.ok) {
        alert("❌ Failed to cancel appointment.");
        return;
      }

      await fetch(`http://localhost:5000/api/appointments/${appointmentId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      await notifyDoctor(appointmentId, notification.patientName, "canceled", doctorId);
      alert("❌ Patient is not present. Appointment canceled and moved to archive. Doctor has been notified.");
    }

    markNotificationAsHandled(notification);

    if (window.location.href.includes("Appointments.html")) {
      typeof loadAppointments === "function" ? await loadAppointments() : location.reload();
    }
  } catch (err) {
    console.error("Error handling patient response:", err);
    alert("❌ There was an error processing your response. Please try again.");
  }
}

// ── Doctor Notifier ──────────────────────────────────────────────────────────
async function notifyDoctor(appointmentId, patientName, status, doctorId) {
  try {
    const response = await fetch("http://localhost:5000/api/notifications/nurse-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId,
        patientName,
        status, // "ongoing" or "canceled"
        doctorId,
        nurseId: sessionStorage.getItem("userId"),
        nurseName: sessionStorage.getItem("name") || "Nurse",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn("Nurse response notification API failed:", text || response.statusText);
    }
  } catch (err) {
    console.error("Error sending nurse response notification:", err);
  }
}

// ── Mark Handled ─────────────────────────────────────────────────────────────

function markNotificationAsHandled(notification) {
  try {
    const key = `doctorEnterHandled_${notification.appointmentId}_${notification.timestamp}`;
    sessionStorage.setItem(key, "true");

    const notifications = JSON.parse(localStorage.getItem("doctorEnterNotifications") || "[]");
    const idx = notifications.findIndex(n =>
      n.appointmentId === notification.appointmentId && n.timestamp === notification.timestamp
    );
    if (idx !== -1) {
      notifications[idx].handled = true;
      localStorage.setItem("doctorEnterNotifications", JSON.stringify(notifications));
    }

    if (typeof checkForNotifications === "function") checkForNotifications();
  } catch (err) {
    console.error("Error marking notification as handled:", err);
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

window.showDoctorEnterNotification = showDoctorEnterNotification;
window.playNotificationSound       = playNotificationSound;

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const userRole = sessionStorage.getItem("role");
  if (userRole !== "Nurse") return;

  document.addEventListener("click", initAudio, { once: true });

  // Seed counts on load so first poll doesn't false-trigger sound
  _prevDoctorEnterCount = checkDoctorEnterNotifications();
  _prevTimeArrivedCount = checkAppointmentTimeNotifications();

  setInterval(() => {
    _checkAndPlaySound();
    if (typeof checkForNotifications === "function") checkForNotifications();
  }, 20000);

  // Cross-tab: play sound immediately when a new notification comes in
  window.addEventListener("storage", (e) => {
    if (!e.key) return;
    const isRelevant =
      e.key.startsWith("doctorEnterNotification_") ||
      e.key.startsWith("appointmentTimeArrived_") ||
      e.key.startsWith("appointmentTimeNotification_");

    if (isRelevant) {
      initAudio();
      playNotificationSound();
      if (typeof checkForNotifications === "function") checkForNotifications();
      _prevDoctorEnterCount = checkDoctorEnterNotifications();
      _prevTimeArrivedCount = checkAppointmentTimeNotifications();
    }
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if (sessionStorage.getItem("role") === "Nurse") {
    checkDoctorEnterNotifications();
    checkAppointmentTimeNotifications();
  }
  if (typeof checkForNotifications === "function") checkForNotifications();
});