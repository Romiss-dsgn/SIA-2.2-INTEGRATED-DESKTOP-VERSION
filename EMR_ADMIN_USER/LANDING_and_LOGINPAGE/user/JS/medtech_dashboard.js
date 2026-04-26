// medtech_dashboard.js - Laboratory Dashboard Functionality

document.addEventListener("DOMContentLoaded", () => {
  initializeMedtechDashboard();
  loadLabStatistics();
  loadRecentLabResults();
  loadLabTestDistribution();
  loadTodayLabRequests();
 
  // Refresh every 30 seconds
  setInterval(() => {
    loadLabStatistics();
    loadRecentLabResults();
    loadLabTestDistribution();
    loadTodayLabRequests();
  }, 30000);
});

// ============================================
// INITIALIZE DASHBOARD
// ============================================
function initializeMedtechDashboard() {
  initializeHeader();
  setGreeting();
}

function initializeHeader() {
  updateClock();
  setInterval(updateClock, 1000);
  populateHeaderUserInfo();
}

function updateClock() {
  const now     = new Date();
  const hours   = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const ampm    = hours >= 12 ? "PM" : "AM";
  const h12     = hours % 12 || 12;
  const timeStr = `${String(h12).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;

  const clockDisplay = document.getElementById("clockDisplay");
  if (clockDisplay) clockDisplay.textContent = timeStr;

  const dateDisplay = document.getElementById("headerDateDisplay");
  if (dateDisplay) {
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    dateDisplay.textContent = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  }
}

function populateHeaderUserInfo() {
  const headerAvatar = document.getElementById("headerUserAvatar");
  const name = sessionStorage.getItem("name") || "Medtech";
  if (headerAvatar) {
    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    headerAvatar.textContent = initials || "MT";
  }
}

function setGreeting() {
  const greetElement = document.querySelector(".greet");
  if (!greetElement) return;
  const hour = new Date().getHours();
  const name = sessionStorage.getItem("name") || "Medtech";
  let greeting = "Good Evening";
  if (hour < 12) greeting = "Good Morning";
  else if (hour < 18) greeting = "Good Afternoon";
  greetElement.textContent = `${greeting}, ${name}`;
}

// ============================================
// LOAD LAB STATISTICS
// ============================================
async function loadLabStatistics() {
  try {
    const response = await fetch("http://localhost:5000/api/lab-results");
    if (!response.ok) { console.warn("Failed to fetch lab results"); return; }

    const labResults = await response.json();
    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalResults = labResults.length;
    const todayResults = labResults.filter(r => new Date(r.uploadDate || r.created_at) >= todayStart).length;
    const weekResults  = labResults.filter(r => new Date(r.uploadDate || r.created_at) >= weekStart).length;

    document.getElementById("totalLabResults").textContent  = totalResults;
    document.getElementById("todayLabResults").textContent  = todayResults;
    document.getElementById("weekLabResults").textContent   = weekResults;

    const patientsResponse = await fetch("http://localhost:5000/api/patients");
    if (patientsResponse.ok) {
      const patients      = await patientsResponse.json();
      const activePatients = patients.filter(p => p.status === "active" || p.status === "Active").length;
      document.getElementById("activePatientsCount").textContent = activePatients;
    }
  } catch (err) {
    console.error("Error loading lab statistics:", err);
  }
}

// ============================================
// LOAD RECENT LAB RESULTS
// ============================================
async function loadRecentLabResults() {
  const container = document.getElementById("recentLabResultsContainer");
  if (!container) return;

  try {
    const response = await fetch("http://localhost:5000/api/lab-results");

    if (!response.ok) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-400">
          <span class="material-symbols-outlined text-5xl mb-3">error</span>
          <p>Failed to load lab results</p>
        </div>`;
      return;
    }

    const labResults = await response.json();

    if (labResults.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-400">
          <span class="material-symbols-outlined text-5xl mb-3">biotech</span>
          <p class="font-medium">No lab results yet</p>
          <button onclick="window.location.href='Patients.html'"
                  class="mt-4 px-6 py-2 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90">
            Go to Patients
          </button>
        </div>`;
      return;
    }

    labResults.sort((a, b) =>
      new Date(b.uploadDate || b.created_at) - new Date(a.uploadDate || a.created_at)
    );

    const recentResults = labResults.slice(0, 10);

    // TEST_LABELS map for form-based test types
    const TEST_LABELS = {
      UA: "Urinalysis", BT: "Blood Typing", PT: "Pregnancy Test",
      DVT: "Dengue Rapid Test", FA: "Fecalysis",
      SEROLOGY: "Serology (HBsAg/VDRL)", CHEM: "Clinical Chemistry"
    };

    container.innerHTML = recentResults.map(result => {
      const uploadDate    = new Date(result.uploadDate || result.created_at);
      const formattedDate = uploadDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const formattedTime = uploadDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      // Support both form-based (testType) and old file-based (testName)
      const testType    = result.testType || "";
      const testName    = TEST_LABELS[testType] || result.testName || result.test_name || "Lab Test";
      const patientName = result.patientName || result.patient_name || "Unknown Patient";
      const patientId   = result.patientId   || result.patient_id  || "";

      // Icon based on test type or file type
      const iconInfo = getTestIcon(testType, result.fileType || result.file_type);

      return `
        <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all group">
          <div class="w-12 h-12 rounded-xl ${iconInfo.bgColor} flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined ${iconInfo.textColor} text-xl">${iconInfo.icon}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-bold text-slate-800 dark:text-white text-sm truncate">${escapeHtml(testName)}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 truncate">Patient: ${escapeHtml(patientName)}</p>
            <p class="text-xs text-slate-400 dark:text-slate-500">${formattedDate} at ${formattedTime}</p>
          </div>
          ${patientId ? `
          <button onclick="window.location.href='LabResults.html?patientId=${encodeURIComponent(patientId)}'"
                  class="opacity-0 group-hover:opacity-100 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all">
            View
          </button>` : ""}
        </div>`;
    }).join("");

  } catch (err) {
    console.error("Error loading recent lab results:", err);
    container.innerHTML = `
      <div class="text-center py-12 text-slate-400">
        <span class="material-symbols-outlined text-5xl mb-3">error</span>
        <p>Error loading lab results</p>
      </div>`;
  }
}

// ============================================
// LOAD LAB TEST DISTRIBUTION
// ============================================
async function loadLabTestDistribution() {
  try {
    const response = await fetch("http://localhost:5000/api/lab-results");
    if (!response.ok) return;

    const labResults = await response.json();
    let bloodTests = 0, urineTests = 0, otherTests = 0;

    labResults.forEach(result => {
      // Support form-based testType and old file-based testName
      const testType = (result.testType || "").toUpperCase();
      const testName = (result.testName || result.test_name || "").toLowerCase();

      if (testType === "BT" || testType === "CHEM" || testType === "SEROLOGY" || testType === "DVT" ||
          testName.includes("blood") || testName.includes("cbc") || testName.includes("hematology")) {
        bloodTests++;
      } else if (testType === "UA" || testType === "PT" ||
                 testName.includes("urine") || testName.includes("urinalysis")) {
        urineTests++;
      } else {
        otherTests++;
      }
    });

    const total = labResults.length || 1;

    document.getElementById("bloodTestCount").textContent = bloodTests;
    document.getElementById("urineTestCount").textContent = urineTests;
    document.getElementById("otherTestCount").textContent = otherTests;

    document.getElementById("bloodTestBar").style.width = `${(bloodTests / total) * 100}%`;
    document.getElementById("urineTestBar").style.width = `${(urineTests / total) * 100}%`;
    document.getElementById("otherTestBar").style.width = `${(otherTests / total) * 100}%`;

  } catch (err) {
    console.error("Error loading lab test distribution:", err);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Returns icon info based on form-based testType first, then falls back to fileType
function getTestIcon(testType, fileType) {
  const iconMap = {
    UA:       { icon: "water_drop",     bgColor: "bg-blue-100",   textColor: "text-blue-600"   },
    BT:       { icon: "bloodtype",      bgColor: "bg-red-100",    textColor: "text-red-600"    },
    PT:       { icon: "pregnant_woman", bgColor: "bg-pink-100",   textColor: "text-pink-600"   },
    DVT:      { icon: "bug_report",     bgColor: "bg-orange-100", textColor: "text-orange-600" },
    FA:       { icon: "science",        bgColor: "bg-amber-100",  textColor: "text-amber-600"  },
    SEROLOGY: { icon: "biotech",        bgColor: "bg-purple-100", textColor: "text-purple-600" },
    CHEM:     { icon: "lab_research",   bgColor: "bg-emerald-100",textColor: "text-emerald-600"},
  };

  if (testType && iconMap[testType]) return iconMap[testType];

  // Fallback for old file-based results
  if (fileType) {
    if (fileType.includes("pdf"))   return { icon: "picture_as_pdf", bgColor: "bg-red-100",   textColor: "text-red-600"   };
    if (fileType.includes("image")) return { icon: "image",           bgColor: "bg-blue-100",  textColor: "text-blue-600"  };
  }

  return { icon: "description", bgColor: "bg-slate-100", textColor: "text-slate-500" };
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

async function loadTodayLabRequests() {
  try {
    const res = await fetch("http://localhost:5000/api/request-forms");
    if (!res.ok) {
      console.warn("Could not fetch lab requests:", res.status);
      return;
    }
 
    const requests = await res.json();
 
    // Build today's date range (midnight → now)
    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    todayEnd.setHours(23, 59, 59, 999);
 
    // Count requests submitted today
    const list = Array.isArray(requests) ? requests : (requests.data || requests.results || []);
    const todayCount = list.filter(r => {
      const raw = r.createdAt || r.created_at || r.submittedAt || r.date || r.requestDate;
      if (!raw) return false;
      const d = new Date(raw);
      return !isNaN(d) && d >= todayStart && d <= todayEnd;
    }).length;
 
    // Update banner
    const countEl    = document.getElementById("todayRequestsCount");
    const pluralEl   = document.getElementById("todayRequestsPlural");
    if (countEl)  countEl.textContent  = todayCount;
    // "1 lab request" vs "0 / 2+ lab requests"
    if (pluralEl) pluralEl.textContent = todayCount === 1 ? "" : "s";
 
  } catch (err) {
    console.error("Error loading today's lab requests:", err);
  }
}
 
// Make it globally available (consistent with existing exports at bottom of file)
window.loadTodayLabRequests = loadTodayLabRequests;

// Make functions globally available
window.loadRecentLabResults    = loadRecentLabResults;
window.loadLabStatistics       = loadLabStatistics;
window.loadLabTestDistribution = loadLabTestDistribution;