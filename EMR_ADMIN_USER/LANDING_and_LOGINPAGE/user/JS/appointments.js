function formatPatientName(name) {
  if (!name || typeof name !== 'string') return name;
  
  // If name already has a middle initial (contains " X. "), return as-is
  if (/ [A-Z]\. /.test(name)) return name;
  
  // Otherwise return as-is (we can't reconstruct middle initial from stored names)
  return name;
}

async function loadAppointments() {
  const tableBody = document.querySelector("#appointmentsTable tbody");
  const countDisplay = document.getElementById("appointmentCount");

  try {
    const res = await fetch("http://localhost:5000/api/appointments");
    if (!res.ok) throw new Error("Failed to fetch appointments");

    let appointments = await res.json();

    const loggedInRole = sessionStorage.getItem('role');
    const loggedInUserId = sessionStorage.getItem('userId');
    const loggedInName = sessionStorage.getItem('name');

    let filteredAppointments = appointments;
    
    if (loggedInRole === "Doctor" && loggedInUserId) {
      filteredAppointments = appointments.filter(app => {
        const matchesDoctorId = app.doctorId === loggedInUserId;
        const matchesDoctorName = app.doctorName === `Dr. ${loggedInName}` || 
                                   app.doctorName === loggedInName;
        return matchesDoctorId || matchesDoctorName;
      });
    }
    
    const activeAppointments = filteredAppointments.filter(app => 
      app.status === "Upcoming" || app.status === "Ongoing" || !app.status
    );
    
    const searchValue = document.querySelector(".searchBar")?.value.toLowerCase().trim() || "";
    let searchFiltered = activeAppointments;
    
    if (searchValue) {
      searchFiltered = activeAppointments.filter(app => {
        const searchText = `${app.appointmentId || ''} ${app.patientName || ''} ${app.doctorName || ''} ${app.type || ''}`.toLowerCase();
        return searchText.includes(searchValue);
      });
    }
    
    let displayAppointments = sortAppointments(searchFiltered);

    if (!displayAppointments || displayAppointments.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No active appointments found</td></tr>`;
      countDisplay.textContent = "Showing 0 active appointments";
      return;
    }

    tableBody.innerHTML = displayAppointments.map(app => {
      const isMyAppointment = loggedInRole === 'Doctor' && 
        (app.doctorId === loggedInUserId || app.doctorName === `Dr. ${loggedInName}`);
      
      const rowClass = isMyAppointment ? 'my-appointment' : '';
      
      const time24 = app.time || "09:00";
      const [hours24, minutes] = time24.split(':');
      let hours12 = parseInt(hours24);
      const ampm = hours12 >= 12 ? 'PM' : 'AM';
      hours12 = hours12 % 12 || 12;
      const time12 = `${hours12}:${minutes} ${ampm}`;
      
      return `
        <tr class="${rowClass}">
          <td>${app.appointmentId || 'N/A'}</td>
          <td>${app.patientName || 'N/A'}</td>
          <td>${app.date ? new Date(app.date).toLocaleDateString() : 'N/A'}<br>
            <h3 style="color: gray; font-size: 14px;">${time12}</h3>
          </td>
          <td>
            ${app.doctorName || 'N/A'}
            ${isMyAppointment ? '<span style="color: #005a32; font-weight: bold;"></span>' : ''}
          </td>
          <td>${app.type || 'N/A'}</td>
          <td>
            <span class="${
              app.status === "Upcoming" ? "statusUpcoming" :
              app.status === "Ongoing" ? "statusOngoing" : 
              app.status === "Completed" ? "statusCompleted" : "statusCanceled"
            }">${app.status || 'N/A'}</span>
          </td>
          <td>
            <a href="#" class="actionBtn"
              data-id="${app.appointmentId || ''}"
              data-name="${app.patientName || ''}"
              data-patientid="${app.patientId || ''}"
              data-date="${app.date || ''}"
              data-time="${app.time || '09:00'}"
              data-doctor="${app.doctorName || ''}"
              data-doctorid="${app.doctorId || ''}"
              data-type="${app.type || ''}"
              data-reason="${app.reason || ''}"
              data-notes="${app.notes || ''}"
              data-status="${app.status || ''}"
              data-duration="${app.duration || 30}"
              data-ismine="${isMyAppointment}">
              View
            </a>
          </td>
        </tr>
      `;
    }).join("");

    attachModalListeners();

    countDisplay.textContent = `Showing ${displayAppointments.length} appointment${displayAppointments.length !== 1 ? 's' : ''}`;

  } catch (err) {
    console.error("Error loading appointments:", err);
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Error loading data</td></tr>`;
    countDisplay.textContent = "Error loading count";
  }
}

function sortAppointments(list) {
  if (!list || !Array.isArray(list)) return [];

  const sortSelect = document.getElementById("sortDate");
  const savedSort = sessionStorage.getItem('appointmentSortOption');
  
  if (savedSort && sortSelect) {
    sortSelect.value = savedSort;
  }

  const sortMode = sortSelect?.value || "desc";
  const sortedList = [...list];

  if (sortMode === "desc") {
    return sortedList.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      const [hoursA, minutesA] = (a.time || "00:00").split(':').map(Number);
      const [hoursB, minutesB] = (b.time || "00:00").split(':').map(Number);
      dateA.setHours(hoursA, minutesA, 0, 0);
      dateB.setHours(hoursB, minutesB, 0, 0);
      return dateA - dateB;
    });
  } else if (sortMode === "asc") {
    return sortedList.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      const [hoursA, minutesA] = (a.time || "00:00").split(':').map(Number);
      const [hoursB, minutesB] = (b.time || "00:00").split(':').map(Number);
      dateA.setHours(hoursA, minutesA, 0, 0);
      dateB.setHours(hoursB, minutesB, 0, 0);
      return dateB - dateA;
    });
  }

  return sortedList;
}

function attachModalListeners() {
  const modal = document.getElementById("viewModal");
  const closeModal = document.getElementById("closeModal");
  const loggedInRole = sessionStorage.getItem('role');
  const loggedInUserId = sessionStorage.getItem('userId');
  const loggedInName = sessionStorage.getItem('name');

  document.querySelectorAll(".actionBtn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();

      const appDetails = {
        id: btn.getAttribute("data-id") || '',
        name: btn.getAttribute("data-name") || '',
        patientId: btn.getAttribute("data-patientid") || '',
        date: btn.getAttribute("data-date") ? new Date(btn.getAttribute("data-date")).toLocaleDateString() : 'N/A',
        time: btn.getAttribute("data-time") || '09:00',
        doctor: btn.getAttribute("data-doctor") || '',
        doctorId: btn.getAttribute("data-doctorid") || '',
        type: btn.getAttribute("data-type") || '',
        reason: btn.getAttribute("data-reason") || '',
        notes: btn.getAttribute("data-notes") || '',
        status: btn.getAttribute("data-status") || '',
        duration: parseInt(btn.getAttribute("data-duration")) || 30
      };

      const isMyAppointment = loggedInRole === 'Doctor' && 
        (appDetails.doctorId === loggedInUserId || appDetails.doctor === `Dr. ${loggedInName}`);

      if (loggedInRole === 'Doctor' && !isMyAppointment) {
        const viewAnyway = confirm(
          `This appointment is scheduled with ${appDetails.doctor}.\n\n` +
          `Date: ${appDetails.date} at ${appDetails.time}\n` +
          `Patient: ${appDetails.name}\n\n` +
          `Do you want to view the details?`
        );
        if (!viewAnyway) return;
      }

      const [hours24, minutes] = appDetails.time.split(':');
      let hours12 = parseInt(hours24);
      const ampm = hours12 >= 12 ? 'PM' : 'AM';
      hours12 = hours12 % 12 || 12;
      const time12 = `${hours12}:${minutes} ${ampm}`;

      document.getElementById("modalDate").textContent = appDetails.date;
      document.getElementById("modalTime").textContent = time12;
      document.getElementById("modalDoctor").textContent = appDetails.doctor || "N/A";
      document.getElementById("modalDuration").textContent = `${appDetails.duration} minutes`;
      document.getElementById("modalType").textContent = formatAppointmentType(appDetails.type);
      document.getElementById("modalReason").textContent = appDetails.reason || "No reason provided";
      document.getElementById("modalNotes").textContent = appDetails.notes || "No notes";
      document.getElementById("modalStatus").textContent = appDetails.status || "N/A";

      document.getElementById("cancelAppointmentBtn").setAttribute("data-id", appDetails.id);
      document.getElementById("completeAppointmentBtn").setAttribute("data-id", appDetails.id);
      document.getElementById("completeAppointmentBtn").setAttribute("data-patientid", appDetails.patientId);
      document.getElementById("enterAppointmentBtn").setAttribute("data-id", appDetails.id);
      document.getElementById("enterAppointmentBtn").setAttribute("data-patientid", appDetails.patientId);
      document.getElementById("enterAppointmentBtn").setAttribute("data-name", appDetails.name);

      // ✅ FIX: Set data attributes directly on the <a> element, not relying on e.target
      const patientInfoBtn = document.getElementById("patientInfoBtn");
      patientInfoBtn.setAttribute("data-patientid", appDetails.patientId);
      patientInfoBtn.setAttribute("data-name", appDetails.name);

      applyRoleBasedAccess(appDetails.status);

      const badge = document.getElementById("modalStatus");
      badge.style.backgroundColor = 
        appDetails.status === "Upcoming" ? "#2d81f7" :
        appDetails.status === "Ongoing" ? "#f7a72d" :
        appDetails.status === "Completed" ? "#2da624" : "#ca3030";

      modal.style.display = "flex";
    });
  });

  closeModal.addEventListener("click", () => modal.style.display = "none");
  window.addEventListener("click", e => {
    if (e.target === modal) modal.style.display = "none";
  });
}

function formatAppointmentType(type) {
  const map = {
    "Initial-Consultation": "Initial Consultation",
    "Follow-up-Visit": "Follow Up Visit",
    "Regular-Check-up": "Regular Check Up",
    "Medical-Procedure": "Medical Procedure",
    "Surgery": "Surgery",
    "Therapy-Session": "Therapy Session",
    "Lab-Work": "Lab Work",
    "Health-Screening": "Health Screening"
  };
  return map[type] || type || "N/A";
}

function applyRoleBasedAccess(appointmentStatus = null) {
  const role = sessionStorage.getItem("role");
  const addAppointmentBtn = document.getElementById("addAppointmentBtn");
  const editAppointmentBtn = document.getElementById("editAppointmentBtn");
  const completeAppointmentBtn = document.getElementById("completeAppointmentBtn");
  const cancelAppointmentBtn = document.getElementById("cancelAppointmentBtn");
  const enterAppointmentBtn = document.getElementById("enterAppointmentBtn");
  const patientInfoBtn = document.getElementById("patientInfoBtn");
  
  if (!appointmentStatus) {
    const statusBadge = document.getElementById("modalStatus");
    appointmentStatus = statusBadge ? statusBadge.textContent.trim() : null;
  }
  
  if (role === "Doctor") {
    if (addAppointmentBtn) addAppointmentBtn.style.display = "none";
    if (editAppointmentBtn) editAppointmentBtn.style.display = "none";
    if (cancelAppointmentBtn) cancelAppointmentBtn.style.display = "none";
    if (patientInfoBtn) patientInfoBtn.style.display = "inline-flex";
    
    if (appointmentStatus === "Upcoming") {
      if (enterAppointmentBtn) enterAppointmentBtn.style.display = "inline-block";
      if (completeAppointmentBtn) completeAppointmentBtn.style.display = "none";
    } else if (appointmentStatus === "Ongoing") {
      if (enterAppointmentBtn) enterAppointmentBtn.style.display = "none";
      if (completeAppointmentBtn) completeAppointmentBtn.style.display = "inline-block";
    } else {
      if (enterAppointmentBtn) enterAppointmentBtn.style.display = "none";
      if (completeAppointmentBtn) completeAppointmentBtn.style.display = "none";
    }
  } else if (role === "Nurse") {
    if (addAppointmentBtn) addAppointmentBtn.style.display = "flex";
    if (editAppointmentBtn) editAppointmentBtn.style.display = "inline-block";
    if (completeAppointmentBtn) completeAppointmentBtn.style.display = "none";
    if (enterAppointmentBtn) enterAppointmentBtn.style.display = "none";
    if (patientInfoBtn) patientInfoBtn.style.display = "none";
  } else {
    if (addAppointmentBtn) addAppointmentBtn.style.display = "flex";
    if (editAppointmentBtn) editAppointmentBtn.style.display = "inline-block";
    if (completeAppointmentBtn) completeAppointmentBtn.style.display = "inline-block";
    if (enterAppointmentBtn) enterAppointmentBtn.style.display = "none";
    if (patientInfoBtn) patientInfoBtn.style.display = "none";
  }
}

document.getElementById("completeAppointmentBtn").addEventListener("click", async (e) => {
  e.preventDefault();

  if (sessionStorage.getItem("role") === "Nurse") {
    alert("Nurses cannot complete appointments.");
    return;
  }

  const appointmentId = e.target.getAttribute("data-id");
  const patientId = e.target.getAttribute("data-patientid");

  if (!appointmentId) {
    alert("Error: Appointment ID not found.");
    return;
  }

  const modal = document.getElementById("viewModal");
  if (modal) modal.style.display = "none";

  window.location.href = `Prescription.html?appointmentId=${appointmentId}&patientId=${patientId}`;
});

document.getElementById("cancelAppointmentBtn").addEventListener("click", async (e) => {
  e.preventDefault();

  const appointmentId = e.target.getAttribute("data-id");

  if (!appointmentId) {
    alert("Error: Appointment ID not found.");
    return;
  }

  if (!confirm("Are you sure you want to cancel this appointment? It will be moved to the archive.")) return;

  try {
    const updateResponse = await fetch(`http://localhost:5000/api/appointments/${appointmentId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Canceled" })
    });

    if (!updateResponse.ok) throw new Error("Failed to cancel appointment");

    const archiveResponse = await fetch(`http://localhost:5000/api/appointments/${appointmentId}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (!archiveResponse.ok) throw new Error("Failed to archive canceled appointment");

    alert("✅ Appointment canceled and archived successfully!");
    document.getElementById("viewModal").style.display = "none";
    await loadAppointments();

  } catch (error) {
    console.error("Error canceling appointment:", error);
    alert("❌ There was a problem canceling the appointment.");
  }
});

document.getElementById("editAppointmentBtn").addEventListener("click", (e) => {
  e.preventDefault();

  if (sessionStorage.getItem("role") === "Doctor") {
    alert("Doctors cannot edit appointments.");
    return;
  }

  const appointmentId = document.getElementById("cancelAppointmentBtn").getAttribute("data-id");

  if (!appointmentId) {
    alert("No appointment selected to edit.");
    return;
  }

  window.location.href = `EditAppointment.html?id=${appointmentId}`;
});

// ✅ FIX: Use currentTarget instead of target so clicks on inner <span> elements
//    (icon or text) still correctly resolve to the <a> with the data attributes
const patientInfoBtn = document.getElementById("patientInfoBtn");
if (patientInfoBtn) {
  patientInfoBtn.addEventListener("click", (e) => {
    e.preventDefault();
    
    if (sessionStorage.getItem("role") !== "Doctor") return;
    
    // ✅ Use currentTarget (the <a> element) not target (could be inner <span>)
    const btn = e.currentTarget;
    const patientId = btn.getAttribute("data-patientid");
    const patientName = btn.getAttribute("data-name");
    
    if (!patientId) {
      alert("Error: Patient ID not found.");
      return;
    }
    
    if (typeof addRecentPatient === "function") {
      addRecentPatient(patientId, patientName);
    }
    
    const modal = document.getElementById("viewModal");
    if (modal) modal.style.display = "none";
    
    window.location.href = `PatientInfo.html?patientId=${patientId}`;
  });
}

document.getElementById("enterAppointmentBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  
  if (sessionStorage.getItem("role") !== "Doctor") {
    alert("Only doctors can use the Enter button.");
    return;
  }
  
  const appointmentId = e.target.getAttribute("data-id");
  const patientId = e.target.getAttribute("data-patientid");
  const patientName = e.target.getAttribute("data-name");
  
  if (!appointmentId) {
    alert("Error: Appointment ID not found.");
    return;
  }
  
  const doctorName = sessionStorage.getItem("name");
  const doctorId = sessionStorage.getItem("userId");
  
  await notifyNurseDoctorEnter(appointmentId, patientName, doctorName, doctorId);
  document.getElementById("viewModal").style.display = "none";
});

function filterAppointments() {
  loadAppointments();
}



document.querySelector(".searchBar").addEventListener("input", filterAppointments);

document.getElementById("sortDate").addEventListener("change", () => {
  sessionStorage.setItem('appointmentSortOption', document.getElementById("sortDate").value);
  loadAppointments();
});

document.addEventListener("DOMContentLoaded", () => {
  applyRoleBasedAccess();
  loadAppointments();
});

async function notifyNurseDoctorEnter(appointmentId, patientName, doctorName, doctorId) {
  try {
    const response = await fetch('http://localhost:5000/api/notifications/doctor-enter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId,
        patientName,
        doctorName,
        doctorId
      })
    });
    
    if (response.ok) {
      console.log('✅ Doctor enter notification sent to nurses');
      alert(`✅ Notification sent to nurses. Patient consultation request for ${patientName || 'patient'}.`);
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to send doctor enter notification:', errorText);
      alert("❌ Failed to notify nurse. Please try again.");
    }
  } catch (err) {
    console.error('Error sending doctor enter notification:', err);
    alert("❌ Failed to notify nurse. Please check your connection.");
  }
}

