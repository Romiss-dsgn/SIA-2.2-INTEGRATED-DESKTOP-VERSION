// ====== APPOINTMENT TIME ARRIVED NOTIFICATION SYSTEM FOR NURSES ======

// ✅ FIXED: Electron-compatible audio initialization
let appointmentTimeNotificationSound = null; // ✅ RENAMED to avoid conflicts
function initAudio() {
  if (!appointmentTimeNotificationSound) {
    try {
      // ✅ Check if running in Electron
      if (typeof window !== 'undefined' && window.electron) {
        // Electron: use file:// protocol with absolute path
        appointmentTimeNotificationSound = new Audio('file://' + __dirname + '/sounds/notification.mp3');
      } else {
        // Browser: use relative path
        appointmentTimeNotificationSound = new Audio('sounds/notification.mp3');
      }
      appointmentTimeNotificationSound.volume = 0.5;
    } catch (err) {
      console.error('Audio initialization failed:', err);
    }
  }
}

// ✅ FIXED: Play notification sound with Electron support
function playNotificationSound() {
  initAudio(); // Ensure audio is initialized
  if (appointmentTimeNotificationSound) {
    appointmentTimeNotificationSound.currentTime = 0;
    appointmentTimeNotificationSound.play().catch(err => {
      console.warn('Could not play notification sound:', err);
    });
  }
}

// ✅ Show appointment time arrived modal to nurse
function showAppointmentTimeArrivedModal(notification, fromHeader = false) {
  // Check if modal already exists
  const existingModal = document.getElementById("appointmentTimeArrivedModal");
  if (existingModal && !fromHeader) {
    return; // Don't show duplicate modals (unless explicitly from header)
  }
  
  // Mark as shown immediately to prevent duplicates
  const shownKey = `appointmentTimeArrivedShown_${notification.appointmentId}_${notification.timestamp}`;
  if (sessionStorage.getItem(shownKey) && !fromHeader) {
    return; // Already shown (unless from header click)
  }
  sessionStorage.setItem(shownKey, "true");

  const modal = document.createElement("div");
  modal.id = "appointmentTimeArrivedModal";
  modal.className = "appointment-time-arrived-modal";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 12px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 5px 25px rgba(0,0,0,0.3);
      animation: fadeIn 0.3s;
    ">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 48px; margin-bottom: 10px;">⏰</div>
        <h2 style="margin: 0; color: #358F85;">Appointment Time Arrived</h2>
      </div>
      
      <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <p style="margin: 5px 0;"><strong>Patient:</strong> ${notification.patientName || 'Unknown'}</p>
        <p style="margin: 5px 0;"><strong>Doctor:</strong> ${notification.doctorName || 'Unknown'}</p>
        <p style="margin: 5px 0;"><strong>Appointment ID:</strong> ${notification.appointmentId || 'N/A'}</p>
        <p style="margin: 5px 0;"><strong>Time:</strong> ${notification.time || 'N/A'}</p>
        <p style="margin: 10px 0; padding: 10px; background: white; border-radius: 5px; color: #358F85; font-weight: 600;">
          The scheduled appointment time has arrived. Please confirm if the patient is present.
        </p>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="permitPatientBtn" style="
            background: #2da624;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 600;
            font-size: 16px;
            flex: 1;
          ">✅ Permit Patient to Enter</button>
          <button id="waitPatientBtn" style="
            background: #ff9800;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 600;
            font-size: 16px;
            flex: 1;
          ">⏳ Wait Patient</button>
        </div>
        <button id="cancelPatientBtn" style="
          background: #ca3030;
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 600;
          font-size: 16px;
          width: 100%;
        ">❌ Cancel Patient Appointment</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  // ✅ NO SOUND when clicking notification - sound only plays on receipt (handled in header.js)

  // Handle Permit button
  document.getElementById("permitPatientBtn").addEventListener("click", async () => {
    modal.remove();
    await handleAppointmentTimeResponse(notification, true);
  });

  // Handle Wait Patient button
  document.getElementById("waitPatientBtn").addEventListener("click", () => {
    modal.remove();
    showRescheduleModal(notification);
  });

  // Handle Cancel button
  document.getElementById("cancelPatientBtn").addEventListener("click", async () => {
    const confirmCancel = confirm("Are you sure you want to cancel this appointment? This action cannot be undone.");
    if (confirmCancel) {
      modal.remove();
      await handleAppointmentTimeResponse(notification, false);
    }
  });
}

// ✅ Handle nurse's response (Permit or Cancel)
async function handleAppointmentTimeResponse(notification, permitPatient) {
  try {
    const appointmentId = notification.appointmentId;
    
    if (permitPatient) {
      // Patient is permitted - start the appointment (this sets status to Ongoing)
      try {
        const startResponse = await fetch(`http://localhost:5000/api/appointments/${appointmentId}/start`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" }
        });

        if (!startResponse.ok) {
          const errorText = await startResponse.text();
          let errorMessage = "Failed to start appointment";
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }
          console.error("Failed to start appointment:", errorMessage);
          throw new Error(errorMessage);
        }

        // ✅ Notify doctor (only the doctor assigned to this appointment)
        const doctorId = notification.doctorId;
        if (doctorId) {
          notifyDoctorAppointmentStarted(appointmentId, notification.patientName, doctorId);
        }

        alert(`✅ Patient permitted to enter. Appointment status changed to Ongoing. Doctor has been notified.`);
      } catch (err) {
        console.error("Error updating appointment:", err);
        alert(`❌ Failed to update appointment status: ${err.message}`);
        return; // Don't mark as handled if it failed
      }
    } else {
      // Patient not present - change status to Canceled and move to archive
      try {
        // First, get the current appointment details
        const getAppointmentResponse = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`);
        if (!getAppointmentResponse.ok) {
          throw new Error("Failed to fetch appointment details");
        }
        const appointment = await getAppointmentResponse.json();

        // Update status to Canceled using the status endpoint
        const updateResponse = await fetch(`http://localhost:5000/api/appointments/${appointmentId}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Canceled" })
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          let errorMessage = "Failed to cancel appointment";
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }
          console.error("Status update error:", errorMessage);
          throw new Error(errorMessage);
        }

        // Archive the appointment
        const archiveResponse = await fetch(`http://localhost:5000/api/appointments/${appointmentId}/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });

        if (!archiveResponse.ok) {
          const archiveErrorText = await archiveResponse.text();
          console.error("Archive error:", archiveErrorText);
          throw new Error("Failed to archive appointment");
        }

        // ✅ Notify doctor (only the doctor assigned to this appointment)
        const doctorId = notification.doctorId || appointment.doctorId;
        if (doctorId) {
          notifyDoctorAppointmentCanceled(appointmentId, notification.patientName || appointment.patientName, doctorId);
        }

        // Mark notification as handled after successful cancel + archive
        markAppointmentTimeNotificationAsHandled(notification);

        alert(`❌ Appointment canceled and moved to archive. Doctor has been notified.`);

        // Reload appointments if on appointments page
        if (window.location.href.includes("Appointments.html") && typeof loadAppointments === "function") {
          await loadAppointments();
        } else if (window.location.href.includes("Appointments.html")) {
          location.reload();
        }
      } catch (err) {
        console.error("Error canceling appointment:", err);
        alert(`❌ Failed to cancel appointment: ${err.message}\n\nPlease try again or contact support.`);
        return; // Don't mark as handled if it failed
      }
    }
    // Mark notification as handled only if successful (permit path already handled separately)
    if (permitPatient) {
      markAppointmentTimeNotificationAsHandled(notification);
    }

  } catch (err) {
    console.error("Error handling appointment time response:", err);
    alert("❌ There was an error processing your response. Please try again.");
    // Don't mark as handled if there was an error, so it can be retried
  }
}

// ✅ Mark notification as handled
function markAppointmentTimeNotificationAsHandled(notification) {
  try {
    let notifications = JSON.parse(localStorage.getItem("appointmentTimeArrivedNotifications") || "[]");
    const index = notifications.findIndex(n => 
      n.appointmentId === notification.appointmentId && 
      n.timestamp === notification.timestamp
    );
    
    if (index !== -1) {
      notifications[index].handled = true;
      localStorage.setItem("appointmentTimeArrivedNotifications", JSON.stringify(notifications));
    }
    
    // Also remove the notification key
    localStorage.removeItem(`appointmentTimeArrived_${notification.appointmentId}`);
  } catch (err) {
    console.error("Error marking notification as handled:", err);
  }
}

// ✅ Notify doctor that appointment started (when nurse permits patient)
function notifyDoctorAppointmentStarted(appointmentId, patientName, doctorId) {
  const notification = {
    type: "appointment_started",
    appointmentId: appointmentId,
    patientName: patientName,
    status: "ongoing",
    doctorId: doctorId, // ✅ Store which doctor this notification is for
    timestamp: Date.now()
  };

  // Store with doctor-specific key
  localStorage.setItem(`appointmentStartedNotification_${appointmentId}_${doctorId}`, JSON.stringify(notification));
  
  // Also add to list (filtered by doctorId when checking)
  let notifications = JSON.parse(localStorage.getItem("appointmentStartedNotifications") || "[]");
  notifications.push(notification);
  localStorage.setItem("appointmentStartedNotifications", JSON.stringify(notifications));

  // Trigger storage event
  window.dispatchEvent(new StorageEvent('storage', {
    key: `appointmentStartedNotification_${appointmentId}_${doctorId}`,
    newValue: JSON.stringify(notification)
  }));
}

// ✅ Notify doctor that appointment was canceled (when nurse cancels)
function notifyDoctorAppointmentCanceled(appointmentId, patientName, doctorId) {
  const notification = {
    type: "appointment_canceled",
    appointmentId: appointmentId,
    patientName: patientName,
    status: "canceled",
    doctorId: doctorId, // ✅ Store which doctor this notification is for
    timestamp: Date.now()
  };

  // Store with doctor-specific key
  localStorage.setItem(`appointmentCanceledNotification_${appointmentId}_${doctorId}`, JSON.stringify(notification));
  
  // Also add to list (filtered by doctorId when checking)
  let notifications = JSON.parse(localStorage.getItem("appointmentCanceledNotifications") || "[]");
  notifications.push(notification);
  localStorage.setItem("appointmentCanceledNotifications", JSON.stringify(notifications));

  // Trigger storage event
  window.dispatchEvent(new StorageEvent('storage', {
    key: `appointmentCanceledNotification_${appointmentId}_${doctorId}`,
    newValue: JSON.stringify(notification)
  }));
}

// ✅ Show reschedule modal for wait patient
async function showRescheduleModal(notification) {
  // Check if modal already exists
  const existingModal = document.getElementById("rescheduleAppointmentModal");
  if (existingModal) {
    existingModal.remove();
  }

  // Fetch appointment details to get current date and time
  let appointmentDate = notification.date;
  let appointmentTime = notification.time;
  
  try {
    const getAppointmentResponse = await fetch(`http://localhost:5000/api/appointments/${notification.appointmentId}`);
    if (getAppointmentResponse.ok) {
      const appointment = await getAppointmentResponse.json();
      appointmentDate = appointment.date;
      appointmentTime = appointment.time;
    }
  } catch (err) {
    console.error("Error fetching appointment:", err);
  }

  // Format date to YYYY-MM-DD for date input
  let formattedDate = '';
  if (appointmentDate) {
    if (appointmentDate instanceof Date) {
      formattedDate = appointmentDate.toISOString().split("T")[0];
    } else if (typeof appointmentDate === 'string') {
      // Handle ISO string or other date formats
      const dateObj = new Date(appointmentDate);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = dateObj.toISOString().split("T")[0];
      } else {
        // Try parsing as YYYY-MM-DD
        formattedDate = appointmentDate.split("T")[0];
      }
    }
  }

  const modal = document.createElement("div");
  modal.id = "rescheduleAppointmentModal";
  modal.className = "reschedule-appointment-modal";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10001;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 12px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 5px 25px rgba(0,0,0,0.3);
      animation: fadeIn 0.3s;
    ">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 48px; margin-bottom: 10px;">📅</div>
        <h2 style="margin: 0; color: #358F85;">Reschedule Appointment</h2>
      </div>
      
      <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <p style="margin: 5px 0;"><strong>Patient:</strong> ${notification.patientName || 'Unknown'}</p>
        <p style="margin: 5px 0;"><strong>Doctor:</strong> ${notification.doctorName || 'Unknown'}</p>
        <p style="margin: 5px 0;"><strong>Appointment ID:</strong> ${notification.appointmentId || 'N/A'}</p>
        <p style="margin: 10px 0; padding: 10px; background: white; border-radius: 5px; color: #666; font-size: 14px;">
          Please adjust the time for this appointment. Date is fixed.
        </p>
      </div>
      
      <form id="rescheduleForm" style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Date:</label>
          <input 
            type="date" 
            id="rescheduleDate" 
            required
            value="${formattedDate}"
            disabled
            style="
              width: 100%;
              padding: 10px;
              border: 2px solid #ddd;
              border-radius: 5px;
              font-size: 16px;
              box-sizing: border-box;
              background-color: #f5f5f5;
              cursor: not-allowed;
            "
          />
        </div>
        
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #333;">Time:</label>
          <input 
            type="time" 
            id="rescheduleTime" 
            required
            value="${appointmentTime || ''}"
            style="
              width: 100%;
              padding: 10px;
              border: 2px solid #ddd;
              border-radius: 5px;
              font-size: 16px;
              box-sizing: border-box;
            "
          />
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button 
            type="submit" 
            id="confirmRescheduleBtn"
            style="
              background: #358F85;
              color: white;
              border: none;
              padding: 12px 30px;
              border-radius: 5px;
              cursor: pointer;
              font-weight: 600;
              font-size: 16px;
              flex: 1;
            "
          >✅ Confirm Reschedule</button>
          <button 
            type="button" 
            id="cancelRescheduleBtn"
            style="
              background: #999;
              color: white;
              border: none;
              padding: 12px 30px;
              border-radius: 5px;
              cursor: pointer;
              font-weight: 600;
              font-size: 16px;
              flex: 1;
            "
          >Cancel</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Time validation (date is fixed, so we only validate time)
  const dateInput = document.getElementById("rescheduleDate");
  const timeInput = document.getElementById("rescheduleTime");
  const fixedDate = formattedDate;

  function validateTime() {
    const selectedTime = timeInput.value;
    if (!selectedTime) {
      return false;
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Only validate time if the fixed date is today
    if (fixedDate === todayStr) {
      const [selectedHours, selectedMinutes] = selectedTime.split(":").map(Number);
      const currentHours = today.getHours();
      const currentMinutes = today.getMinutes();

      if (selectedHours < currentHours || (selectedHours === currentHours && selectedMinutes <= currentMinutes)) {
        alert("❌ Cannot schedule appointment in the past. Please select a future time.");
        const futureTime = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes + 1).padStart(2, '0')}`;
        timeInput.value = futureTime;
        return false;
      }
    }
    return true;
  }

  timeInput.addEventListener("change", validateTime);

  // Handle form submission
  document.getElementById("rescheduleForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    if (!validateTime()) {
      return;
    }

    const newDate = dateInput.value; // This is the fixed date
    const newTime = timeInput.value;

    // Final validation before submission
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    
    // Only validate time if the fixed date is today
    if (newDate === todayStr && newTime) {
      const [selectedHours, selectedMinutes] = newTime.split(":").map(Number);
      const currentHours = today.getHours();
      const currentMinutes = today.getMinutes();
      
      if (selectedHours < currentHours || (selectedHours === currentHours && selectedMinutes <= currentMinutes)) {
        alert("❌ Cannot schedule appointment in the past. Please select a future time.");
        return;
      }
    }

    await handleReschedule(notification, newDate, newTime);
  });

  // Handle cancel button
  document.getElementById("cancelRescheduleBtn").addEventListener("click", () => {
    modal.remove();
    // Re-show the original appointment time arrived modal
    showAppointmentTimeArrivedModal(notification, true);
  });
}

// ✅ Handle reschedule appointment
async function handleReschedule(notification, newDate, newTime) {
  try {
    const appointmentId = notification.appointmentId;
    
    // First, get the current appointment details
    const getAppointmentResponse = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`);
    if (!getAppointmentResponse.ok) {
      throw new Error("Failed to fetch appointment details");
    }
    const appointment = await getAppointmentResponse.json();

    // Update appointment with new date and time
    const updateData = {
      patientName: appointment.patientName,
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName,
      date: newDate,
      time: newTime,
      type: appointment.type,
      duration: appointment.duration,
      reason: appointment.reason,
      // Keep original notes; don't auto-append reschedule text
      notes: appointment.notes
    };

    const updateResponse = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      let errorMessage = "Failed to reschedule appointment";
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Mark notification as handled
    markAppointmentTimeNotificationAsHandled(notification);

    // Close the reschedule modal
    const rescheduleModal = document.getElementById("rescheduleAppointmentModal");
    if (rescheduleModal) {
      rescheduleModal.remove();
    }

    alert(`✅ Appointment rescheduled successfully to ${newDate} at ${newTime}.`);

    // Reload appointments if on appointments page
    if (window.location.href.includes("Appointments.html") && typeof loadAppointments === "function") {
      await loadAppointments();
    } else if (window.location.href.includes("Appointments.html")) {
      location.reload();
    }

  } catch (err) {
    console.error("Error rescheduling appointment:", err);
    alert(`❌ Failed to reschedule appointment: ${err.message}`);
  }
}

async function notifyDoctorAppointmentStarted(appointmentId, patientName, doctorId) {
  try {
    const response = await fetch('http://localhost:5000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment_started',
        recipientRole: 'Doctor',
        recipientId: doctorId,
        senderId: sessionStorage.getItem('userId') || 'system',
        senderName: sessionStorage.getItem('name') || 'Nurse',
        senderRole: 'Nurse',
        title: 'Patient Permitted to Enter',
        message: `Patient ${patientName} has been permitted to enter. Appointment is now Ongoing.`,
        appointmentId,
        patientName,
        doctorId,
        data: { appointmentId, patientName, status: 'ongoing' }
      })
    });
    
    if (response.ok) {
      console.log('✅ Appointment started notification sent');
    }
  } catch (err) {
    console.error('Error sending appointment started notification:', err);
  }
}
 
// ✅ 6. APPOINTMENT CANCELED NOTIFICATION (appointment_time_notifications.js)
// Add this to notify doctor when nurse cancels appointment
async function notifyDoctorAppointmentCanceled(appointmentId, patientName, doctorId) {
  try {
    const response = await fetch('http://localhost:5000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointment_canceled',
        recipientRole: 'Doctor',
        recipientId: doctorId,
        senderId: sessionStorage.getItem('userId') || 'system',
        senderName: sessionStorage.getItem('name') || 'Nurse',
        senderRole: 'Nurse',
        title: 'Appointment Canceled',
        message: `Appointment for ${patientName} has been canceled and moved to archive.`,
        appointmentId,
        patientName,
        doctorId,
        data: { appointmentId, patientName, status: 'canceled' }
      })
    });
    
    if (response.ok) {
      console.log('✅ Appointment canceled notification sent');
    }
  } catch (err) {
    console.error('Error sending appointment canceled notification:', err);
  }
}
 
// ✅ 7. RESCHEDULE NOTIFICATION (appointment_time_notifications.js)
async function notifyDoctorOfReschedule(appointmentData, doctorId) {
  try {
    const response = await fetch('http://localhost:5000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'reschedule',
        recipientRole: 'Doctor',
        recipientId: doctorId,
        senderId: sessionStorage.getItem('userId') || 'system',
        senderName: sessionStorage.getItem('name') || 'Nurse',
        senderRole: 'Nurse',
        title: 'Appointment Rescheduled',
        message: `Appointment for ${appointmentData.patientName} has been rescheduled`,
        appointmentId: appointmentData.appointmentId,
        patientName: appointmentData.patientName,
        doctorId: doctorId,
        data: {
          appointmentId: appointmentData.appointmentId,
          patientName: appointmentData.patientName,
          oldDate: appointmentData.oldDate,
          oldTime: appointmentData.oldTime,
          newDate: appointmentData.newDate,
          newTime: appointmentData.newTime,
          reason: appointmentData.reason || '',
          rescheduledBy: appointmentData.rescheduledBy || sessionStorage.getItem('name') || 'Nurse'
        }
      })
    });
    
    if (response.ok) {
      console.log('✅ Reschedule notification sent');
    }
  } catch (err) {
    console.error('Error sending reschedule notification:', err);
  }
}

// Initialize audio on page load
document.addEventListener("DOMContentLoaded", () => {
  // Initialize audio on first user interaction
  document.addEventListener('click', initAudio, { once: true });
});

// Make functions globally available
window.showAppointmentTimeArrivedModal = showAppointmentTimeArrivedModal;
window.showRescheduleModal = showRescheduleModal;
window.handleAppointmentTimeResponse = handleAppointmentTimeResponse; // ✅ EXPOSE THIS!
window.playNotificationSound = playNotificationSound; // Expose for header.js