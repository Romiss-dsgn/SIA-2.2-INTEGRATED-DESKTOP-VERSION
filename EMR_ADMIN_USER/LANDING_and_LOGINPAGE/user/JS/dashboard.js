/**
 * dashboard.js
 * Updated with branding: Forest Green (#005a32), Red (#d62828), Brown (#8b5a2b)
 */

// ✅ Load user info and apply everywhere (sidebar + top greeting)
function loadUserInfo() {
  const name = sessionStorage.getItem("name");
  const role = sessionStorage.getItem("role");

  if (!name || !role) {
    window.location.href = "../emrLogin.html";
    return;
  }

  const greetEl = document.querySelector(".greet");
  if (greetEl) {
    greetEl.textContent = `Welcome back, ${name}`;
    greetEl.style.color = "white";
  }

  const sidebarName = document.querySelector(".accountName");
  const sidebarRole = document.querySelector(".role");
  const userPic = document.querySelector(".userPic");

  if (sidebarName) sidebarName.textContent = name;
  if (sidebarRole) sidebarRole.textContent = role;

  if (userPic) {
    const initials = name.split(" ").map(n => n[0].toUpperCase()).join("");
    userPic.textContent = initials;
    userPic.style.backgroundColor = "var(--accent-color)";
  }
}

// ✅ Load today's appointments
async function loadTodaysAppointments() {
  const container = document.querySelector(".appointmentsContainer");
  if (!container) return;

  try {
    const res = await fetch("http://localhost:5000/api/appointments");
    if (!res.ok) throw new Error("Failed to fetch appointments");
    const allAppointments = await res.json();

    const loggedInRole = sessionStorage.getItem('role');
    const loggedInUserId = sessionStorage.getItem('userId');
    const loggedInName = sessionStorage.getItem('name');

    let filteredAppointments = allAppointments;
    if (loggedInRole === "Doctor" && loggedInUserId) {
      filteredAppointments = allAppointments.filter(app => {
        const matchesDoctorId = app.doctorId === loggedInUserId;
        const matchesDoctorName = app.doctorName === `Dr. ${loggedInName}` ||
                                   app.doctorName === loggedInName;
        return matchesDoctorId || matchesDoctorName;
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todays = filteredAppointments.filter(app => {
      const appDate = new Date(app.date);
      return appDate >= today && appDate < tomorrow;
    });

    const uniqueTodays = todays.filter((app, index, self) =>
      index === self.findIndex(a => a.appointmentId === app.appointmentId)
    );

    container.innerHTML = "";

    const todayCountEl = document.getElementById("todayAppointmentCount");
    if (todayCountEl) todayCountEl.textContent = uniqueTodays.length;

    if (uniqueTodays.length === 0) {
      container.innerHTML = `<p style="text-align:center; color:gray; margin-top:20px;">No appointments for today</p>`;
      return;
    }

    uniqueTodays.sort((a, b) => {
      const timeA = a.time.split(':').map(Number);
      const timeB = b.time.split(':').map(Number);
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });

    uniqueTodays.forEach(app => {
      // ✅ Convert 24hr to 12hr AM/PM format
      const [hrs, mins] = (app.time || "00:00").split(':');
      let h = parseInt(hrs);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      const time12 = `${h}:${mins} ${ampm}`;

      const div = document.createElement("div");
      div.className = "appointmentSched";
      div.setAttribute("data-appointment-id", app.appointmentId);
      div.innerHTML = `
        <h3 class="schedTime">${time12}</h3>
        <h3 class="schedName">${app.patientName}</h3>
        <h3 class="schedDoc">${app.doctorName}</h3>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading today's appointments:", err);
    container.innerHTML = `<p style="color:var(--secondary-color); text-align:center;">Error loading data</p>`;
  }
}

// ✅ Load recent patients
async function loadRecentPatients() {
  try {
    const recentCon = document.querySelector(".recentPatients");
    if (!recentCon) return;

    const loggedInRole = sessionStorage.getItem('role');
    const loggedInUserId = sessionStorage.getItem('userId');
    const loggedInName = sessionStorage.getItem('name');

    const appointmentRes = await fetch("http://localhost:5000/api/appointments");
    if (!appointmentRes.ok) throw new Error("Failed to fetch appointments");
    const allAppointments = await appointmentRes.json();

    let relevantAppointments = allAppointments;
    if (loggedInRole === "Doctor" && loggedInUserId) {
      relevantAppointments = allAppointments.filter(app => {
        const matchesDoctorId = app.doctorId === loggedInUserId;
        const matchesDoctorName = app.doctorName === `Dr. ${loggedInName}` ||
                                   app.doctorName === loggedInName;
        return matchesDoctorId || matchesDoctorName;
      });
    }

    const patientLastSeen = {};
    relevantAppointments.forEach(app => {
      if (!app.patientId || !app.patientName) return;

      let appDate;
      try {
        const dateStr = app.date ? String(app.date).split('T')[0] : null;
        const timeStr = app.time ? String(app.time).substring(0, 5) : '00:00';
        appDate = dateStr ? new Date(`${dateStr}T${timeStr}:00`) : new Date(0);
        if (isNaN(appDate.getTime())) appDate = new Date(0);
      } catch {
        appDate = new Date(0);
      }

      if (!patientLastSeen[app.patientId] || appDate > patientLastSeen[app.patientId].date) {
        patientLastSeen[app.patientId] = { date: appDate, name: app.patientName, id: app.patientId };
      }
    });

    const sortedPatients = Object.values(patientLastSeen)
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);

    const currentIds = Array.from(recentCon.querySelectorAll('[data-patient-id]'))
      .map(el => el.getAttribute('data-patient-id')).join(',');
    const newIds = sortedPatients.map(p => p.id).join(',');
    if (currentIds === newIds) return;

    if (sortedPatients.length === 0) {
      recentCon.innerHTML = `<p style="text-align:center; color:gray; margin-top:20px;">No recent patients</p>`;
      return;
    }

    recentCon.innerHTML = sortedPatients.map(p => {
      const cleanName = p.name.replace(/\s*\(.*?\)\s*/g, "").trim();
      const initials = cleanName.split(" ")
        .filter(part => part.length > 0)
        .map(n => n[0]?.toUpperCase() || "")
        .join("");

      return `
        <div class="flex items-center gap-4 p-3 hover:bg-brand-light dark:hover:bg-emerald-900/10 rounded-2xl transition-all duration-300 cursor-pointer group border border-transparent hover:border-primary/10 hover:shadow-sm" data-patient-id="${p.id}">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl">
            ${initials || "?"}
          </div>
          <div class="flex-1">
            <p class="font-bold text-slate-800 dark:text-white leading-tight group-hover:text-primary transition-colors">${cleanName}</p>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-tighter">ID: ${p.id}</p>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error("Error in loadRecentPatients:", err);
  }
}

// ✅ Update quick stats
async function updateQuickStats() {
  try {
    const [patientRes, appointmentRes] = await Promise.all([
      fetch("http://localhost:5000/api/patients"),
      fetch("http://localhost:5000/api/appointments")
    ]);

    const patients = await patientRes.json();
    const appointments = await appointmentRes.json();

    const activePatients = patients.filter(p => p.status?.toLowerCase() === 'active');
    const activePatientsEl = document.getElementById("activePatients");
    if (activePatientsEl) {
      activePatientsEl.textContent = activePatients.length;
      activePatientsEl.style.color = "var(--primary-color)";
    }

    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() + diffToMonday);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

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

    const appointmentsThisWeek = filteredAppointments.filter(app => {
      const appDate = new Date(app.date);
      return appDate >= startOfWeek && appDate <= endOfWeek;
    });

    const appointmentsThisWeekEl = document.getElementById("appointmentsThisWeek");
    if (appointmentsThisWeekEl) {
      appointmentsThisWeekEl.textContent = appointmentsThisWeek.length;
      appointmentsThisWeekEl.style.color = "var(--primary-color)";
    }

    const totalWeekly = appointmentsThisWeek.length;

    const weeklyCompletedEl = document.getElementById("weeklyCompletedCount");
    if (weeklyCompletedEl) weeklyCompletedEl.textContent = totalWeekly;

    const progressCircle = document.getElementById("weeklyProgressCircle");
    if (progressCircle) {
      const weeklyTarget = 10;
      const percentage = Math.min((totalWeekly / weeklyTarget) * 100, 100);
      const circumference = 251.2;
      progressCircle.style.strokeDashoffset = circumference - (percentage / 100) * circumference;
    }

    const pendingReportsElement = document.getElementById("pendingReports");
    const pendingReportsContainer = pendingReportsElement?.closest(".status");
    if (loggedInRole === "Doctor" && pendingReportsContainer) {
      pendingReportsContainer.style.display = "none";
    } else if (pendingReportsElement) {
      pendingReportsElement.textContent = 0;
      pendingReportsElement.style.color = "var(--secondary-color)";
    }

  } catch (err) {
    console.error("Error updating Quick Stats:", err);
  }
}

// ✅ Hide Quick Actions buttons for Doctors
function controlQuickActionsVisibility() {
  const rawRole = sessionStorage.getItem("role");
  const normalizedRole = (rawRole || "").trim().toLowerCase();

  if (normalizedRole === "doctor") {
    setTimeout(() => {
      const addPatientBtn = document.getElementById("addNewPatientBtn");
      const generateReportBtn = document.getElementById("generateReportBtn");
      const viewAppointmentsBtn = document.getElementById("viewAppointmentsBtn");

      if (addPatientBtn) addPatientBtn.style.display = 'none';
      if (generateReportBtn) generateReportBtn.style.display = 'none';
      if (viewAppointmentsBtn) viewAppointmentsBtn.style.display = 'none';
    }, 100);
  }
}

// ✅ Setup navigation for dashboard buttons
function setupDashboardNavigation() {
  const viewFullScheduleBtn = document.getElementById("viewFullScheduleBtn");
  if (viewFullScheduleBtn) {
    viewFullScheduleBtn.addEventListener("click", () => window.location.href = "Appointments.html");
  }

  const addNewPatientBtn = document.getElementById("addNewPatientBtn");
  if (addNewPatientBtn) {
    addNewPatientBtn.addEventListener("click", () => window.location.href = "AddPatient.html");
  }

  const viewAppointmentsBtn = document.getElementById("viewAppointmentsBtn");
  if (viewAppointmentsBtn) {
    viewAppointmentsBtn.addEventListener("click", () => window.location.href = "AddAppointment.html");
  }

  document.querySelectorAll('button').forEach(btn => {
    if (btn.textContent.trim() === "Go to Patients List") {
      btn.addEventListener("click", () => window.location.href = "Patients.html");
    }
  });
}

// ✅ Dashboard Initialization
window.onload = () => {
  try { loadUserInfo(); } catch (err) { console.error(err); }
  try { loadTodaysAppointments(); } catch (err) { console.error(err); }
  try { updateQuickStats(); } catch (err) { console.error(err); }
  try { loadRecentPatients(); } catch (err) { console.error(err); }
  try { controlQuickActionsVisibility(); } catch (err) { console.error(err); }
  try { setupDashboardNavigation(); } catch (err) { console.error(err); }
};