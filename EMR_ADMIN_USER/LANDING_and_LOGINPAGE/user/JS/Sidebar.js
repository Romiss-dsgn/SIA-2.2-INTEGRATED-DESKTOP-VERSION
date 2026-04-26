async function loadSidebar(activePage) {
  if (!document.getElementById("materialSymbolsFont")) {
    var link = document.createElement("link");
    link.id = "materialSymbolsFont";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0";
    document.head.appendChild(link);
  }

  var navCls = "navLink flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all text-slate-500 hover:text-[#065f46] hover:bg-slate-50";
  
  var userRole = sessionStorage.getItem("role");
  var dashboardLink = "Dashboard.html";
  
  if (userRole === "Medtech") {
    dashboardLink = "MedtechDashboard.html";
  } else if (userRole === "Doctor") {
    dashboardLink = "Dashboard.html";
  } else {
    dashboardLink = "Dashboard.html";
  }
  
  var sidebarHTML = `
    <aside class="sideBar w-64 flex flex-col bg-white border-r border-slate-200 h-screen fixed z-50" style="box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div class="p-6 mb-8">
        <div class="flex items-center gap-3">
          <img src="../user/Assets/wellserved_logo.jpg" alt="Well Served Logo" class="w-12 h-12 rounded-full object-cover" />
          <div>
            <h1 class="text-lg font-extrabold leading-none" style="color:#065f46;">WellServed</h1>
            <p class="text-[10px] font-bold tracking-widest mt-0.5 uppercase" style="color:#8b5a2b;">Since 1994</p>
          </div>
        </div>
      </div>
      <nav class="navBar flex-1 px-4 space-y-1">
        <a href="${dashboardLink}" class="${navCls}"><span class="material-symbols-outlined">grid_view</span><span class="dashboard">Dashboard</span></a>
        <a href="Patients.html" id="patientsNavLink" class="${navCls} hidden"><span class="material-symbols-outlined">group</span><span class="dashboard">Patients</span></a>
        <a href="Appointments.html" class="${navCls}"><span class="material-symbols-outlined">calendar_today</span><span class="dashboard">Appointments</span></a>
        <a href="Archive.html" class="${navCls}"><span class="material-symbols-outlined">history</span><span class="dashboard">History</span></a>
        <a href="Report.html" id="reportsNavLink" class="${navCls} hidden"><span class="material-symbols-outlined">description</span><span class="dashboard">Reports</span></a>
        <a href="MedtechRequests.html" id="medtechRequestsNavLink" class="${navCls} hidden"><span class="material-symbols-outlined">assignment</span><span class="dashboard">Lab Requests</span></a>
        <a href="MedtechHistory.html" id="medtechHistoryNavLink" class="${navCls} hidden"><span class="material-symbols-outlined">task_alt</span><span class="dashboard">History</span></a>
      </nav>
      <div class="p-4 mt-auto border-t border-slate-200">
        <a href="#" id="logoutBtn" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all text-red-500 hover:bg-red-50">
          <span class="material-symbols-outlined">logout</span>
          <span class="text-sm dashboard">Logout</span>
        </a>
      </div>
      <div id="logoutModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] hidden">
        <div class="customModalContent bg-white rounded-xl p-6 max-w-sm w-full shadow-xl text-center border border-slate-200">
          <h3 class="text-lg font-semibold text-slate-800 mb-2">Confirm Logout</h3>
          <p class="text-slate-500 mb-6">Are you sure you want to log out?</p>
          <div class="modalButtons flex justify-center gap-3">
            <button id="cancelLogoutBtn" class="cancelBtn px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-medium">Cancel</button>
            <button id="confirmLogoutBtn" class="confirmBtn px-4 py-2 rounded-lg text-white font-medium" style="background-color:#065f46;">Logout</button>
          </div>
        </div>
      </div>
      <div id="successModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] hidden">
        <div class="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl text-center border border-slate-200">
          <h3 class="text-lg font-semibold text-slate-800 mb-2">Logout Successful</h3>
          <p class="text-slate-500">You have been logged out successfully.</p>
        </div>
      </div>
    </aside>`;

  document.body.insertAdjacentHTML("afterbegin", sidebarHTML);

  var activeBg = "#f0fdf4", activeColor = "#065f46";
  document.querySelectorAll(".navBar a.navLink").forEach(function (link) {
    var href = link.getAttribute("href") || "";
    if (href === activePage || (href && link.href && link.href.indexOf(activePage) !== -1)) {
      link.style.backgroundColor = activeBg;
      link.style.color = activeColor;
      link.classList.add("font-bold");
      var icon = link.querySelector(".material-symbols-outlined");
      if (icon) icon.style.fontVariationSettings = "'FILL' 1";
    }
  });

  const name = sessionStorage.getItem("name");
  const role = sessionStorage.getItem("role");

  if (!name || !role) {
    alert("Session expired. Please log in again.");
    window.location.href = "../emrLogin.html";
    return;
  }

  var accountNameEl = document.querySelector(".accountName");
  var roleEl = document.querySelector(".role");
  var userPicEl = document.querySelector(".userPic");
  if (accountNameEl) accountNameEl.textContent = name;
  if (roleEl) roleEl.textContent = role;
  if (userPicEl) {
    const initials = name.split(" ").map(function (n) { return n[0].toUpperCase(); }).join("");
    userPicEl.textContent = initials;
  }

  const patientsNavLink = document.getElementById("patientsNavLink");
  const reportsNavLink = document.getElementById("reportsNavLink");
  const requestFormNavLink = document.getElementById("requestFormNavLink");
  const appointmentsNavLink = document.querySelector('a[href="Appointments.html"]');
  const historyNavLink = document.querySelector('a[href="Archive.html"]');
  const medtechRequestsNavLink = document.getElementById("medtechRequestsNavLink");
  const medtechHistoryNavLink = document.getElementById("medtechHistoryNavLink");
  
  if (role === "Doctor") {
    if (patientsNavLink) patientsNavLink.style.display = "none";
    if (reportsNavLink) reportsNavLink.style.display = "none";
    if (requestFormNavLink) requestFormNavLink.style.display = "flex"; // ✅ Doctors can see Request Form
    if (appointmentsNavLink) appointmentsNavLink.style.display = "flex";
    if (historyNavLink) historyNavLink.style.display = "flex";
    if (medtechRequestsNavLink) medtechRequestsNavLink.style.display = "none";
    if (medtechHistoryNavLink) medtechHistoryNavLink.style.display = "none"; // ✅ Hide from Doctors
    
  } else if (role === "Medtech") {
    if (patientsNavLink) patientsNavLink.style.display = "none";
    if (reportsNavLink) reportsNavLink.style.display = "none";
    if (requestFormNavLink) requestFormNavLink.style.display = "none";
    if (appointmentsNavLink) appointmentsNavLink.style.display = "none";
    if (historyNavLink) historyNavLink.style.display = "none";
    if (medtechRequestsNavLink) medtechRequestsNavLink.style.display = "flex"; // ✅ Show Lab Requests
    if (medtechHistoryNavLink) medtechHistoryNavLink.style.display = "flex"; // ✅ Show Results History
    
  } else if (role === "Nurse") {
    if (patientsNavLink) patientsNavLink.style.display = "flex";
    if (reportsNavLink) reportsNavLink.style.display = "flex";
    if (requestFormNavLink) requestFormNavLink.style.display = "flex"; // ✅ Nurses can see Request Form
    if (appointmentsNavLink) appointmentsNavLink.style.display = "flex";
    if (historyNavLink) historyNavLink.style.display = "flex";
    if (medtechRequestsNavLink) medtechRequestsNavLink.style.display = "none";
    if (medtechHistoryNavLink) medtechHistoryNavLink.style.display = "none"; // ✅ Hide from Nurses
    
  } else {
    // Admin and others
    if (patientsNavLink) patientsNavLink.style.display = "flex";
    if (reportsNavLink) reportsNavLink.style.display = "flex";
    if (requestFormNavLink) requestFormNavLink.style.display = "flex"; // ✅ Admin can also see Request Form
    if (appointmentsNavLink) appointmentsNavLink.style.display = "flex";
    if (historyNavLink) historyNavLink.style.display = "flex";
    if (medtechRequestsNavLink) medtechRequestsNavLink.style.display = "none";
    if (medtechHistoryNavLink) medtechHistoryNavLink.style.display = "none"; // ✅ Hide from Admin
  }

  const logoutBtn = document.getElementById("logoutBtn");
  const logoutModal = document.getElementById("logoutModal");
  const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
  const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
  const successModal = document.getElementById("successModal");

  logoutBtn.addEventListener("click", e => {
    e.preventDefault();
    logoutModal.classList.remove("hidden");
  });

  cancelLogoutBtn.addEventListener("click", () => {
    logoutModal.classList.add("hidden");
  });

  confirmLogoutBtn.addEventListener("click", async () => {
    try {
      const sessionLogId = sessionStorage.getItem('sessionLogId');
      
      if (sessionLogId) {
        await fetch('http://localhost:5000/api/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionLogId })
        });
      }
      
      sessionStorage.clear();
      logoutModal.classList.add("hidden");
      successModal.classList.remove("hidden");

      setTimeout(() => {
        successModal.classList.add("hidden");
        window.location.href = "../emrLogin.html";
      }, 1200);
    } catch (error) {
      console.error("Logout failed:", error);
      alert("⚠️ There was a problem logging out. Please try again.");
    }
  });
}