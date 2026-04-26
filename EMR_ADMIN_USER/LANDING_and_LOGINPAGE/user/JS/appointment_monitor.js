// ====== APPOINTMENT MONITOR & COMPLETION MODAL ======

let checkInterval = null;
let shownModals = new Set();

// Make shownModals globally accessible so other scripts can update it
window.shownModals = shownModals;

function startMonitoring() {
  if (checkInterval) return;
  
  console.log("🔄 Appointment monitoring started");
  
  checkInterval = setInterval(async () => {
    try {
      await checkOngoingAppointments();
    } catch (err) {
      console.error("Error in appointment monitor tick:", err);
    }
  }, 1000);
  
  checkOngoingAppointments().catch((err) => {
    console.error("Error in initial appointment monitor check:", err);
  });
}

async function notifyNurseAppointmentTime(appointment) {
  try {
    const response = await fetch('http://localhost:5000/api/notifications/appointment-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId: appointment.appointmentId,
        patientName: appointment.patientName,
        doctorName: appointment.doctorName,
        doctorId: appointment.doctorId,
        time: appointment.time
      })
    });
    
    if (response.ok) {
      console.log('✅ Appointment time notification sent to nurses');
    }
  } catch (err) {
    console.error('Error sending appointment time notification:', err);
  }
}

async function checkOngoingAppointments() {
  let appointments = [];
  try {
    const response = await fetch("http://localhost:5000/api/appointments");
    if (!response.ok) {
      console.warn("Failed to fetch appointments for monitor:", response.status);
      return;
    }
    appointments = await response.json();
  } catch (err) {
    console.error("Error fetching appointments for monitor:", err);
    return;
  }

  const now = new Date();
  const role = (sessionStorage.getItem("role") || "").trim().toLowerCase();

  for (const appointment of appointments) {
    if (!appointment) continue;
    if (!appointment.date || !appointment.time) continue;

    const [hours, minutes] = String(appointment.time).split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) continue;

    const schedule = new Date(appointment.date);
    schedule.setHours(hours, minutes, 0, 0);

    // 1) At schedule time: notify nurse once for upcoming appointments.
    if (appointment.status === "Upcoming" && now.getTime() >= schedule.getTime()) {
      const sentKey = `appointmentTimeNotified_${appointment.appointmentId}`;
      if (!localStorage.getItem(sentKey)) {
        await notifyNurseAppointmentTime(appointment);
        localStorage.setItem(sentKey, String(Date.now()));
      }
    }

    // 2) At end time: show doctor completion modal for active appointments.
    // Some flows may keep status as Upcoming even while consultation is underway.
    const status = String(appointment.status || "").trim().toLowerCase();
    if (status === "upcoming" || status === "ongoing") {
      const baseDuration = Number(appointment.duration) || 0;
      const extension = Number(appointment.extendedMinutes) || 0;
      const totalDurationMs = Math.max(0, baseDuration + extension) * 60 * 1000;
      const endTime = schedule.getTime() + totalDurationMs;

      // ✅ FIX: Also check sessionStorage so the modal doesn't reappear after page navigation
      const alreadyHandled =
        shownModals.has(appointment.appointmentId) ||
        sessionStorage.getItem(`completing_${appointment.appointmentId}`);

      if (now.getTime() >= endTime && role === "doctor" && !alreadyHandled) {
        const didShow = showCompletionModal(appointment);
        if (didShow) {
          shownModals.add(appointment.appointmentId);
        }
      }
    }
  }
}

function showCompletionModal(appointment) {
  const existing = document.getElementById("completionModal");
  if (existing) existing.remove();
  
  // ✅ Hide extend modal for nurses
  const role = (sessionStorage.getItem("role") || "").trim().toLowerCase();
  if (role === "nurse") {
    console.log("⏰ Appointment time complete, but extend modal hidden for nurses");
    return false; // Don't show modal for nurses
  }
  
  // ✅ Only show modal to the doctor assigned to this appointment
  if (role === "doctor") {
    const loggedInUserId = sessionStorage.getItem("userId");
    const loggedInName = (sessionStorage.getItem("name") || "").trim();
    const normalizedDoctorName = (appointment.doctorName || "").trim().toLowerCase();
    const normalizedLoggedInName = loggedInName.toLowerCase();
    
    // Check if this appointment belongs to the logged-in doctor
    const matchesDoctorId = appointment.doctorId === loggedInUserId;
    const matchesDoctorName = normalizedDoctorName === `dr. ${normalizedLoggedInName}` ||
                               normalizedDoctorName === normalizedLoggedInName ||
                               normalizedDoctorName.replace(/^dr\.\s*/, "") === normalizedLoggedInName;
    
    if (!matchesDoctorId && !matchesDoctorName) {
      console.log(`⏰ Appointment ${appointment.appointmentId} time complete, but modal hidden - not assigned to this doctor`);
      return false; // Don't show modal if appointment is not assigned to this doctor
    }
  }
  
  console.log("✅ Displaying modal for:", appointment.appointmentId);
  
  const modal = document.createElement("div");
  modal.id = "completionModal";
  modal.className = "completion-modal";
  modal.innerHTML = `
    <div class="completion-modal-content">
      <div class="modal-icon">⏰</div>
      <h2>Appointment Time Complete</h2>
      <div class="appointment-details">
        <p><strong>Patient:</strong> ${appointment.patientName}</p>
        <p><strong>Doctor:</strong> ${appointment.doctorName}</p>
        <p><strong>Duration:</strong> ${appointment.duration + (appointment.extendedMinutes || 0)} minutes</p>
        <p><strong>Appointment ID:</strong> ${appointment.appointmentId}</p>
      </div>

      <div class="modal-extension-input" style="margin: 10px 0 14px; text-align: left;">
        <label for="extendMinutesInput" style="display: block; font-weight: 600; margin-bottom: 6px;">Extend by (minutes)</label>
        <input id="extendMinutesInput" type="number" min="1" step="1" value="15"
               style="width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px;" />
      </div>
      
      <div class="modal-buttons">
        <button type="button" class="extend-btn" data-action="extend">
          <i class="fas fa-clock"></i> Extend Time
        </button>
        <button type="button" class="complete-btn" data-action="complete">
          <i class="fas fa-check"></i> Complete
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);

  const extendBtn = modal.querySelector('[data-action="extend"]');
  const completeBtn = modal.querySelector('[data-action="complete"]');

  if (extendBtn) {
    extendBtn.addEventListener("click", () => {
      const minutesInput = modal.querySelector("#extendMinutesInput");
      const minutes = minutesInput ? Number(minutesInput.value) : NaN;
      extendAppointment(appointment.appointmentId, minutes);
    });
  }

  if (completeBtn) {
    completeBtn.addEventListener("click", () => {
      completeAppointment(appointment.appointmentId);
    });
  }

  playNotificationSound();
  return true;
}

function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (err) {
    console.log("Audio not available");
  }
}

async function extendAppointment(appointmentId, minutes) {
  if (!minutes || Number.isNaN(minutes) || minutes <= 0) {
    alert("❌ Invalid extension time. Please enter a positive number.");
    return;
  }
  
  try {
    const res = await fetch(`http://localhost:5000/api/appointments/${appointmentId}/extend`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ additionalMinutes: parseInt(minutes, 10) })
    });
    
    const result = await res.json();
    
    if (res.ok) {
      alert(`✅ Appointment extended by ${minutes} minutes`);
      shownModals.delete(appointmentId);
      closeCompletionModal();
      
      if (window.location.href.includes("Appointments.html")) {
        location.reload();
      }
    } else {
      alert("❌ " + (result.message || "Error extending appointment"));
    }
  } catch (err) {
    console.error("Error extending appointment:", err);
    alert("❌ Failed to extend appointment. Please check your connection.");
  }
}

async function completeAppointment(appointmentId) {
  // Close completion modal first
  closeCompletionModal();
  
  // ✅ FIX: Persist "in-progress completion" flag to sessionStorage so it
  // survives page navigation to Prescription/Medications pages. Without this,
  // shownModals resets to an empty Set on the new page and the monitor
  // immediately re-shows the modal.
  shownModals.delete(appointmentId);
  sessionStorage.setItem(`completing_${appointmentId}`, '1');
  
  // Fetch appointment details to get patientId
  try {
    const res = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`);
    if (!res.ok) {
      throw new Error("Failed to fetch appointment details");
    }
    
    const appointment = await res.json();
    const patientId = appointment.patientId || "";
    
    // Store in sessionStorage that we're completing from monitor
    sessionStorage.setItem('completingFromMonitor', appointmentId);
    
    // Navigate to prescription page
    if (typeof showPrescriptionModal === 'function') {
      showPrescriptionModal(appointmentId, patientId);
    } else {
      // Fallback if function not available (e.g., on pages without appointments.js)
      showPrescriptionModalFromMonitor(appointmentId, patientId);
    }
  } catch (err) {
    console.error("Error fetching appointment:", err);
    alert("❌ Failed to load appointment details. Please try again.");
    // ✅ FIX: Clean up the sessionStorage flag and re-add to shownModals on error
    sessionStorage.removeItem(`completing_${appointmentId}`);
    shownModals.add(appointmentId);
  }
}

// Prescription modal function for appointment_monitor.js (standalone version)
function showPrescriptionModalFromMonitor(appointmentId, patientId) {
  // Navigate to prescription page in the same tab
  window.location.href = `Prescription.html?appointmentId=${appointmentId}&patientId=${patientId}`;
}

async function loadPrescriptionMedicationsFromMonitor(patientId, appointmentId) {
  try {
    // Load all medications (including history) to show in modal
    const res = await fetch(`http://localhost:5000/api/patients/${patientId}/medications`);
    if (!res.ok) {
      console.warn("Failed to fetch medications:", res.status);
      return;
    }
    
    const medications = await res.json();
    console.log("All medications for patient (monitor):", medications);
    console.log("Looking for appointmentId (monitor):", appointmentId);
    
    // Filter medications that belong to this appointment (only currently being added, not in history)
    const appointmentMeds = medications.filter(m => {
      const matches = m.appointmentId === appointmentId && !m.isHistory;
      console.log(`Med ${m.medId}: appointmentId=${m.appointmentId}, isHistory=${m.isHistory}, matches=${matches}`);
      return matches;
    });
    
    console.log("Filtered medications for appointment (monitor):", appointmentMeds);
    
    const listContainer = document.getElementById("prescriptionMedicationsListMonitor");
    const contentContainer = document.getElementById("prescriptionMedicationsContentMonitor");
    
    if (!listContainer || !contentContainer) {
      console.warn("Modal containers not found (monitor)");
      return;
    }
    
    if (appointmentMeds.length > 0) {
      listContainer.style.display = "block";
      contentContainer.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Medicine</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Dosage</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Frequency</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Quantity</th>
            </tr>
          </thead>
          <tbody>
            ${appointmentMeds.map(m => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${m.medicname || 'N/A'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${m.dosage || 'N/A'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${m.frequency || 'N/A'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${m.quantity || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      listContainer.style.display = "none";
      contentContainer.innerHTML = "";
    }
  } catch (err) {
    console.error("Error loading prescription medications:", err);
  }
}

// Function to refresh medications in prescription modal (called from prescription.js after save)
window.refreshPrescriptionMedicationsFromMonitor = async function() {
  if (window.currentPrescriptionAppointment) {
    const { patientId, appointmentId } = window.currentPrescriptionAppointment;
    await loadPrescriptionMedicationsFromMonitor(patientId, appointmentId);
  }
};

function openPrescriptionPageFromMonitor(patientId, appointmentId) {
  if (!patientId) {
    alert("❌ Patient ID not found. Cannot open prescription page.");
    return;
  }
  // Store appointmentId in sessionStorage so prescription.js can access it
  if (appointmentId) {
    sessionStorage.setItem('currentAppointmentId', appointmentId);
  }
  // Navigate in same tab instead of opening new tab
  window.location.href = `Medications.html?patientId=${patientId}`;
}

function closePrescriptionModalFromMonitor() {
  const modal = document.getElementById("prescriptionModal");
  if (modal) {
    const appointmentId = modal.querySelector('[onclick*="completeAppointmentWithPrescriptionFromMonitor"]');
    if (appointmentId) {
      // Extract appointmentId from onclick attribute
      const match = appointmentId.getAttribute('onclick').match(/'([^']+)'/);
      if (match && match[1]) {
        // Don't remove from shownModals here - only remove when actually completed
        // This prevents the completion modal from reappearing if user cancels
      }
    }
    modal.remove();
  }
}

async function completeAppointmentWithPrescriptionFromMonitor(appointmentId) {
  const notesInput = document.getElementById("prescriptionNotes");
  const prescriptionNotes = notesInput ? notesInput.value.trim() : "";

  try {
    // Get patientId from current appointment
    const patientId = window.currentPrescriptionAppointment?.patientId;
    
    // ✅ STEP 0: Move medications to history BEFORE completing appointment
    if (patientId) {
      try {
        const medsRes = await fetch(`http://localhost:5000/api/patients/${patientId}/medications`);
        if (medsRes.ok) {
          const allMeds = await medsRes.json();
          const appointmentMeds = allMeds.filter(m => m.appointmentId === appointmentId && !m.isHistory);
          const medIds = appointmentMeds.map(m => m.medId);
          
          if (medIds.length > 0) {
            await fetch(
              `http://localhost:5000/api/patients/${patientId}/medications/move-to-history`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ medicationIds: medIds }),
              }
            );
          }
        }
      } catch (err) {
        console.warn("Could not move medications to history:", err);
      }
    }

    // ✅ STEP 1: Update status to Completed first
    const updateRes = await fetch(`http://localhost:5000/api/appointments/${appointmentId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Completed" })
    });
    
    if (!updateRes.ok) {
      throw new Error("Failed to update appointment status");
    }

    // ✅ STEP 2: Update appointment notes if prescription notes were added
    if (prescriptionNotes) {
      try {
        const appointmentRes = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`);
        if (appointmentRes.ok) {
          const appointment = await appointmentRes.json();
          const updatedNotes = appointment.notes 
            ? `${appointment.notes}\n\nPrescription Notes: ${prescriptionNotes}`
            : `Prescription Notes: ${prescriptionNotes}`;
          
          // Update appointment with all fields including updated notes
          // Format date properly for the API
          const appointmentDate = appointment.date instanceof Date 
            ? appointment.date.toISOString() 
            : appointment.date;
          
          await fetch(`http://localhost:5000/api/appointments/${appointmentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patientName: appointment.patientName,
              doctorId: appointment.doctorId,
              doctorName: appointment.doctorName,
              date: appointmentDate,
              time: appointment.time,
              type: appointment.type,
              duration: appointment.duration,
              reason: appointment.reason,
              notes: updatedNotes
            })
          });
        }
      } catch (err) {
        console.warn("Could not update appointment notes:", err);
      }
    }
    
    // ✅ STEP 3: Then archive it
    const archiveRes = await fetch(`http://localhost:5000/api/appointments/${appointmentId}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    
    const result = await archiveRes.json();
    
    if (archiveRes.ok) {
      alert("✅ Appointment completed and moved to archive!");
      closePrescriptionModalFromMonitor();
      // ✅ FIX: Clean up both shownModals and sessionStorage flag now that appointment is truly done
      shownModals.delete(appointmentId);
      sessionStorage.removeItem(`completing_${appointmentId}`);
      sessionStorage.removeItem('completingFromMonitor');
      
      if (window.location.href.includes("Appointments.html") || window.location.href.includes("Archive.html")) {
        location.reload();
      }
    } else {
      alert("❌ " + (result.message || "Error completing appointment"));
    }
  } catch (err) {
    console.error("Error completing appointment:", err);
    alert("❌ Failed to complete appointment. Please check your connection.");
  }
}

// Make functions globally available
window.showPrescriptionModalFromMonitor = showPrescriptionModalFromMonitor;
window.openPrescriptionPageFromMonitor = openPrescriptionPageFromMonitor;
window.closePrescriptionModalFromMonitor = closePrescriptionModalFromMonitor;
window.completeAppointmentWithPrescriptionFromMonitor = completeAppointmentWithPrescriptionFromMonitor;

function closeCompletionModal() {
  const modal = document.getElementById("completionModal");
  if (modal) modal.remove();
}

window.addEventListener("load", startMonitoring);

window.addEventListener("beforeunload", () => {
  if (checkInterval) {
    clearInterval(checkInterval);
    console.log("🛑 Monitoring stopped");
  }
});