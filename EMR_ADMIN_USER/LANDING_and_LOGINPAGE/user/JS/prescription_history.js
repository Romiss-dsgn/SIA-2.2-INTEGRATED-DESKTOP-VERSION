// prescription_history.js - Load prescription history with FIXED date preservation

document.addEventListener("DOMContentLoaded", () => {
  const patientId = new URLSearchParams(window.location.search).get("patientId");
  const historyContainer = document.getElementById("prescriptionHistoryContainer");

  if (!patientId) {
    historyContainer.innerHTML = `<p style="color:red;">No patient selected!</p>`;
    return;
  }

  // ✅ ROLE-BASED ACCESS CONTROL
  const userRole = sessionStorage.getItem("role");

  // Lab Results tab — visible to Doctor and Medtech only
  const labResultsTab = document.getElementById("labResultsTab");
  if (labResultsTab) {
    labResultsTab.style.display = (userRole === "Doctor" || userRole === "Medtech") ? "inline-flex" : "none";
  }

  // ✅ Request Form & Referral Form buttons — visible to Doctor only
  const requestFormBtn = document.getElementById("requestFormBtn");
  const referralFormBtn = document.getElementById("referralFormBtn");
  if (userRole === "Doctor") {
    if (requestFormBtn) requestFormBtn.style.display = "inline-flex";
    if (referralFormBtn) referralFormBtn.style.display = "inline-flex";
  } else {
    if (requestFormBtn) requestFormBtn.style.display = "none";
    if (referralFormBtn) referralFormBtn.style.display = "none";
  }

  // ✅ Helper: store patient data to sessionStorage for form buttons
  function storePatientToSession(p) {
    let age = "";
    if (p.dob) {
      const today = new Date();
      const birth = new Date(p.dob);
      age = today.getFullYear() - birth.getFullYear();
      const notYet = today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
      if (notYet) age--;
    }
    const sex = p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "";
    sessionStorage.setItem("rf_patientName",   `${p.firstname || ""} ${p.lastname || ""}`.trim());
    sessionStorage.setItem("rf_patientDOB",    p.dob || "");
    sessionStorage.setItem("rf_patientID",     patientId);
    sessionStorage.setItem("rf_contactNumber", p.phone || "");
    sessionStorage.setItem("rf_patientAge",    String(age));
    sessionStorage.setItem("rf_patientSex",    sex);
  }

  // Attach patient id to nav links
  document.querySelectorAll("nav-bar a").forEach(link => {
    const href = link.getAttribute("href");
    if (href && !href.includes("?patientId=")) {
      link.setAttribute("href", `${href}?patientId=${patientId}`);
    }
  });

  // Load patient header + wire up form buttons once patient data is available
  async function loadPatientHeader() {
    try {
      const res = await fetch(`http://localhost:5000/api/patients/${patientId}`);
      if (!res.ok) throw new Error("Patient not found");
      const p = await res.json();
      let displayName = p.firstname || "";
    if (p.middlename && p.middlename.trim()) {
      displayName += " " + p.middlename.trim().charAt(0).toUpperCase() + ".";
    }
    displayName += " " + (p.lastname || "");
    document.querySelector("header h1").textContent = `Patient Information - ${displayName.trim()}`;

      // ✅ Wire up form buttons with patient session data
      if (requestFormBtn) {
        requestFormBtn.addEventListener("click", () => {
          storePatientToSession(p);
          window.location.href = "RequestForm.html";
        });
      }
      if (referralFormBtn) {
        referralFormBtn.addEventListener("click", () => {
          storePatientToSession(p);
          window.location.href = "ReferralForm.html";
        });
      }
    } catch (err) {
      console.error("Error loading patient header:", err);
    }
  }
  loadPatientHeader();

  // Load prescription history
  async function loadPrescriptionHistory() {
    try {
      const res = await fetch(`http://localhost:5000/api/patients/${patientId}/medications?isHistory=true`);
      if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
      const meds = await res.json();

      if (meds.length === 0) {
        historyContainer.innerHTML = `
          <div class="flex flex-col items-center justify-center py-16">
            <div class="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <i class="fa-solid fa-prescription-bottle text-4xl text-slate-400"></i>
            </div>
            <h3 class="text-xl font-semibold text-slate-700 mb-2">No Prescription History</h3>
            <p class="text-slate-500 text-center max-w-md">
              This patient doesn't have any prescription history yet.
            </p>
          </div>
        `;
        return;
      }

      // Group medications by appointmentId AND doctor
      const groupedByAppointment = {};
      meds.forEach(med => {
        const appointmentKey = med.appointmentId || 'no-appointment';
        const prescriber = med.presby || 'Unknown';

        if (appointmentKey === 'no-appointment') {
          let groupDate = 'unknown';
          if (med.prescriptionDate) {
            try { groupDate = new Date(med.prescriptionDate).toISOString().split('T')[0]; } catch (e) {}
          } else if (med.followup) {
            try { groupDate = new Date(med.followup).toISOString().split('T')[0]; } catch (e) {}
          }
          const groupTime = med.prescriptionTime || med.followupTime || '00:00';
          const uniqueKey = `no-appointment_${groupDate}_${groupTime}_${prescriber}`;
          if (!groupedByAppointment[uniqueKey]) groupedByAppointment[uniqueKey] = [];
          groupedByAppointment[uniqueKey].push(med);
        } else {
          const uniqueKey = `${appointmentKey}_${prescriber}`;
          if (!groupedByAppointment[uniqueKey]) groupedByAppointment[uniqueKey] = [];
          groupedByAppointment[uniqueKey].push(med);
        }
      });

      const sortOrder = document.getElementById("sortPrescriptionHistory")?.value || "latest";

      const appointmentEntries = Object.entries(groupedByAppointment).map(([appointmentId, appointmentMeds]) => {
        const firstMed = appointmentMeds[0];
        let sortTimestamp = 0;
        if (firstMed.prescriptionDate) sortTimestamp = new Date(firstMed.prescriptionDate).getTime();
        else if (firstMed.followup) sortTimestamp = new Date(firstMed.followup).getTime();
        return { appointmentId, appointmentMeds, sortTimestamp };
      });

      appointmentEntries.sort((a, b) =>
        sortOrder === "latest" ? b.sortTimestamp - a.sortTimestamp : a.sortTimestamp - b.sortTimestamp
      );

      let html = '';
      for (const { appointmentId, appointmentMeds } of appointmentEntries) {
        const firstMed = appointmentMeds[0];

        let appointmentDate = 'N/A';
        let appointmentTime = 'N/A';

        if (firstMed.prescriptionDate) {
          try {
            const d = new Date(firstMed.prescriptionDate);
            if (!isNaN(d.getTime())) appointmentDate = d.toLocaleDateString();
          } catch (e) {}
        }
        if (firstMed.prescriptionTime) appointmentTime = firstMed.prescriptionTime;

        if (appointmentDate === 'N/A' && firstMed.followup) {
          try {
            const d = new Date(firstMed.followup);
            if (!isNaN(d.getTime())) appointmentDate = d.toLocaleDateString();
          } catch (e) {}
        }
        if (appointmentTime === 'N/A' && firstMed.followupTime) appointmentTime = firstMed.followupTime;

        if (appointmentDate === 'N/A' && appointmentId && appointmentId !== 'no-appointment') {
          try {
            let appRes = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`);
            let appointment = null;
            if (appRes.ok) {
              appointment = await appRes.json();
            } else {
              const archiveRes = await fetch(`http://localhost:5000/api/appointments/archive/list`);
              if (archiveRes.ok) {
                const archived = await archiveRes.json();
                appointment = archived.find(a => a.appointmentId === appointmentId);
              }
            }
            if (appointment && appointment.date) {
              const d = new Date(appointment.date);
              if (!isNaN(d.getTime())) appointmentDate = d.toLocaleDateString();
              if (!appointmentTime || appointmentTime === 'N/A') appointmentTime = appointment.time || 'N/A';
            }
          } catch (err) {
            console.warn("Could not fetch appointment date:", err);
          }
        }

        if (appointmentDate === 'N/A') appointmentDate = new Date().toLocaleDateString();
        if (appointmentTime === 'N/A') appointmentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        // Convert 24-hour to 12-hour
        if (appointmentTime && appointmentTime !== 'N/A') {
          const timeMatch = appointmentTime.match(/^(\d{1,2}):(\d{2})$/);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = timeMatch[2];
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            appointmentTime = `${hours}:${minutes} ${ampm}`;
          }
        }

        const prescriber = firstMed.presby || 'N/A';

        html += `
          <div class="prescription-history-item bg-white rounded-xl border-2 border-slate-200 hover:border-primary shadow-sm hover:shadow-md transition-all duration-200 p-6 mb-4">
            <div class="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <i class="fa-solid fa-prescription-bottle-medical text-primary text-xl"></i>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-primary m-0">Prescription</h3>
                  <p class="text-xs text-slate-500 m-0 mt-1">
                    <i class="fa-solid fa-calendar mr-1"></i>${appointmentDate}
                    <span class="mx-2">•</span>
                    <i class="fa-solid fa-clock mr-1"></i>${appointmentTime}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-xs text-slate-500 m-0">Prescribed by</p>
                <p class="text-sm font-semibold text-slate-700 m-0 mt-0.5">${prescriber}</p>
              </div>
            </div>

            <div class="overflow-hidden rounded-lg border border-slate-200">
              <table class="w-full border-collapse">
                <thead>
                  <tr class="bg-gradient-to-r from-emerald-100 to-rose-100">
                    <th class="px-4 py-3 text-left text-xs font-extrabold text-slate-700 uppercase tracking-wide">Medicine</th>
                    <th class="px-4 py-3 text-left text-xs font-extrabold text-slate-700 uppercase tracking-wide">Dosage</th>
                    <th class="px-4 py-3 text-left text-xs font-extrabold text-slate-700 uppercase tracking-wide">Frequency</th>
                    <th class="px-4 py-3 text-left text-xs font-extrabold text-slate-700 uppercase tracking-wide">Qty</th>
                    <th class="px-4 py-3 text-left text-xs font-extrabold text-slate-700 uppercase tracking-wide">Duration</th>
                    <th class="px-4 py-3 text-left text-xs font-extrabold text-slate-700 uppercase tracking-wide">Indication</th>
                    <th class="px-4 py-3 text-left text-xs font-extrabold text-slate-700 uppercase tracking-wide">Notes</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${appointmentMeds.map(m => {
                    let durationDisplay = "—";
                    if (m.duration) {
                      durationDisplay = m.duration.toLowerCase() === "maintain"
                        ? '<span class="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Maintain</span>'
                        : m.duration;
                    } else {
                      const isMaintain = m.durationMaintain === true || m.durationMaintain === "true" || m.durationMaintain === "on";
                      durationDisplay = isMaintain
                        ? '<span class="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Maintain</span>'
                        : m.durationDays ? `${m.durationDays} day(s)` : "—";
                    }
                    return `
                    <tr class="hover:bg-slate-50 transition-colors">
                      <td class="px-4 py-3 text-sm font-bold text-primary">${m.medicname || 'N/A'}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${m.dosage || 'N/A'}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${m.frequency || 'N/A'}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${m.quantity || 0}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${durationDisplay}</td>
                      <td class="px-4 py-3 text-sm text-slate-700">${m.indication || '—'}</td>
                      <td class="px-4 py-3 text-sm text-slate-600 italic">${m.presNotes || '—'}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <div class="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span><i class="fa-solid fa-pills mr-1"></i>${appointmentMeds.length} medication${appointmentMeds.length !== 1 ? 's' : ''}</span>
              <span>ID: ${appointmentId !== 'no-appointment' ? appointmentId : 'N/A'}</span>
            </div>
          </div>
        `;
      }

      historyContainer.innerHTML = html;
    } catch (err) {
      console.error("Error loading prescription history:", err);
      historyContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12">
          <div class="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <i class="fa-solid fa-exclamation-triangle text-4xl text-red-500"></i>
          </div>
          <h3 class="text-xl font-semibold text-slate-700 mb-2">Error Loading History</h3>
          <p class="text-slate-500 text-center max-w-md">Failed to load prescription history. Please try again later.</p>
        </div>
      `;
    }
  }

  loadPrescriptionHistory();

  const sortSelect = document.getElementById("sortPrescriptionHistory");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => loadPrescriptionHistory());
  }
});