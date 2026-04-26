(function() {
  const loggedIn = sessionStorage.getItem('loggedIn');
  const role = sessionStorage.getItem('role');
  if (loggedIn !== 'true' || role !== 'Admin') {
    window.location.href = 'emrLogin.html';
  }
})();

function showLogoutModal() {
  const logoutModal = new bootstrap.Modal(document.getElementById('logoutModal'));
  logoutModal.show();
}

document.addEventListener('DOMContentLoaded', () => {
  const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
  confirmLogoutBtn.addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = '../emrLogin.html';
  });
  
  initializeHeader();
});

// ============================================
// ✅ HEADER FUNCTIONALITY
// ============================================

function initializeHeader() {
  updateClock();
  setInterval(updateClock, 1000);
  populateHeaderUserInfo();
}

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

function populateHeaderUserInfo() {
  const headerAvatar = document.getElementById("headerUserAvatar");
  const headerUserInfo = document.getElementById("headerUserInfo");
  
  if (headerAvatar && headerUserInfo) {
    const name = sessionStorage.getItem("name") || "Admin";
    const role = sessionStorage.getItem("role") || "Administrator";
    const initials = name.split(" ").map(function (n) { return n[0]; }).join("").toUpperCase().slice(0, 2);
    
    headerAvatar.textContent = initials || "A";
    
    headerUserInfo.innerHTML = `
      <span class="text-sm font-bold text-slate-700 leading-tight">${name}</span>
      <span class="text-xs font-semibold text-primary leading-tight">${role}</span>
    `;
  }
}

// ============================================
// ✅ DASHBOARD FUNCTIONALITY
// ============================================

const API_URL = "http://localhost:5000/api/users";

async function loadDashboard() {
  try {
    const res = await fetch(API_URL);
    const users = await res.json();

    document.getElementById("totalUsers").textContent = users.length;
    document.getElementById("activeUsers").textContent = users.filter(u => u.status === "Active").length;
    document.getElementById("inactiveUsers").textContent = users.filter(u => u.status === "Inactive").length;

    const recentLoginsDiv = document.getElementById("recentLogins");
    recentLoginsDiv.innerHTML = "";
    
    users
      .filter(u => u.lastLogin)
      .sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin))
      .slice(0, 5)
      .forEach(user => {
        const initials = user.name.split(" ").map(n => n[0]).join("").toUpperCase();

        let roleBadge = "";
        if (user.role === "Admin") roleBadge = "px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full"; 
        else if (user.role === "Doctor") roleBadge = "px-2 py-1 text-xs font-semibold bg-blue-900 text-white rounded-full"; 
        else if (user.role === "Nurse") roleBadge = "px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full"; 

        recentLoginsDiv.innerHTML += `
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mr-3 border border-slate-200">
                <span class="font-bold text-[#005a32]">${initials}</span>
              </div>
              <div class="flex flex-col">
                <p class="font-medium flex items-center space-x-2">
                  <span class="text-sm">${user.name}</span>
                  <span class="px-2 py-0.5 text-[9px] uppercase font-bold rounded-full ${roleBadge}">${user.role}</span>
                </p>
              </div>
            </div>
            <p class="text-[10px] text-text-secondary-light">${new Date(user.lastLogin).toLocaleString()}</p>
          </div>`;
      });
  } catch (err) {
    console.error("Dashboard load error:", err);
  }
}

function loadSystemAlerts(alerts = []) {
  const alertsDiv = document.getElementById("alerts");
  if (!alertsDiv) return;
  alertsDiv.innerHTML = "";

  if (alerts.length === 0) {
    alertsDiv.innerHTML = `
      <div class="flex items-center justify-between p-4 rounded-lg border border-border-light">
        <div class="flex items-center">
          <span class="material-symbols-outlined text-[#005a32] mr-3">check_circle</span>
          <p class="text-sm">System running normally</p>
        </div>
        <p class="text-xs text-text-secondary-light">Just now</p>
      </div>`;
  }
}

async function loadIntegrationStatus() {
  try {
    const res = await fetch("http://localhost:5000/api/integration/status");
    const data = await res.json();
    
    // Pharmacy
    const pharmacyStatus = document.getElementById("pharmacyStatus");
    if (data.pharmacy) {
      pharmacyStatus.className = "flex items-center text-[10px] bg-green-50 text-[#005a32] px-2 py-1 rounded-full font-bold uppercase";
      pharmacyStatus.innerHTML = `<span class="material-symbols-outlined text-xs mr-1">check_circle</span> Connected`;
    } else {
      pharmacyStatus.className = "flex items-center text-[10px] bg-red-50 text-[#d62828] px-2 py-1 rounded-full font-bold uppercase";
      pharmacyStatus.innerHTML = `<span class="material-symbols-outlined text-xs mr-1">cancel</span> Disconnected`;
    }
    
    // Billing
    const billingStatus = document.getElementById("billingStatus");
    if (data.billing) {
      billingStatus.className = "flex items-center text-[10px] bg-green-50 text-[#005a32] px-2 py-1 rounded-full font-bold uppercase";
      billingStatus.innerHTML = `<span class="material-symbols-outlined text-xs mr-1">check_circle</span> Connected`;
    } else {
      billingStatus.className = "flex items-center text-[10px] bg-red-50 text-[#d62828] px-2 py-1 rounded-full font-bold uppercase";
      billingStatus.innerHTML = `<span class="material-symbols-outlined text-xs mr-1">cancel</span> Disconnected`;
    }
  } catch (err) { console.error(err); }
}

async function loadBackupStatus() {
  const types = ['appointments', 'accounts', 'activity'];
  for (const type of types) {
    try {
      const res = await fetch(`http://localhost:5000/api/backup/logs/${type}`);
      const data = await res.json();
      const prefix = type === 'appointments' ? 'appointment' : (type === 'accounts' ? 'account' : 'activity');
      
      const timeEl = document.getElementById(`${prefix}BackupTime`);
      const statusEl = document.getElementById(`${prefix}BackupStatus`);
      
      if (data && data.length > 0) {
        const latest = data[0];
        if (timeEl) timeEl.textContent = new Date(latest.date).toLocaleString();
        if (statusEl) {
          if (latest.status === 'success') {
            statusEl.className = 'inline-flex w-fit items-center text-[10px] font-bold bg-green-50 text-[#005a32] px-2 py-1 rounded uppercase';
            statusEl.innerHTML = '<span class="material-symbols-outlined text-xs mr-1">check_circle</span> Success';
          } else {
            statusEl.className = 'inline-flex w-fit items-center text-[10px] font-bold bg-red-50 text-[#d62828] px-2 py-1 rounded uppercase';
            statusEl.innerHTML = '<span class="material-symbols-outlined text-xs mr-1">error</span> Failed';
          }
        }
      }
    } catch (err) { console.error(err); }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadSystemAlerts();
  loadIntegrationStatus();
  loadBackupStatus();
});

setInterval(() => {
  loadIntegrationStatus();
  loadBackupStatus();
}, 3000);

window.addEventListener('storage', (event) => {
  if (event.key === 'integrationStatusChanged') {
    loadIntegrationStatus();
  }
});