// lab_results.js - Laboratory Results (structured form version)
// Companion to LabResults.html (new structured-form build)
// All heavy logic (saveLabResult, buildResultHTML, print, etc.)
// lives in the HTML's inline <script> because it references
// runtime globals (_currentTestType, CHEM_TESTS, etc.).
// This external file handles only the pieces that must load
// BEFORE DOMContentLoaded or that are shared across pages.

// ============================================
// ESCAPE HTML  (used by inline script too)
// ============================================
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

// ============================================
// FORMAT FILE SIZE
// ============================================
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k     = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// ============================================
// ACCESS CONTROL
// ============================================
function checkAccess() {
  const role = sessionStorage.getItem("role");
  if (role !== "Doctor" && role !== "Medtech") {
    alert("⚠️ Access Denied: Only doctors and medical technologists can view laboratory results.");
    window.location.href = "PatientInfo.html" + window.location.search;
    return false;
  }
  return true;
}

// ============================================
// SHOW ADD BUTTON FOR MEDTECH ONLY
// ============================================
function setupRoleBasedUI() {
  const role = sessionStorage.getItem("role");
  const btn  = document.getElementById("addLabResultBtn");
  if (!btn) return;

  if (role === "Medtech") {
    btn.classList.remove("hidden");
    btn.classList.add("inline-flex");
  } else {
    btn.classList.add("hidden");
    btn.classList.remove("inline-flex");
  }
}

// ============================================
// UPDATE PATIENT HEADER
// ============================================
async function updatePatientHeader() {
  const params    = new URLSearchParams(window.location.search);
  const patientId = params.get("patientId");
  if (!patientId) return;

  try {
    const res     = await fetch(`http://localhost:5000/api/patients/${patientId}`);
    if (!res.ok) throw new Error("Patient not found");
    const patient = await res.json();

    // Expose globally so inline script can use it
    window._currentPatientId   = patientId;
    const middle = (patient.middlename || "").trim();
const middleInitial = middle ? " " + middle.charAt(0).toUpperCase() + "." : "";
window._currentPatientName =
  `${patient.firstname || ""}${middleInitial} ${patient.lastname || ""}`.trim();

    // Header h1
    const h1 = document.querySelector("header h1");
    if (h1) h1.textContent = `Patient Information - ${window._currentPatientName}`;

    // Span inside h1 (new HTML uses a <span id="patientNameDisplay">)
    const span = document.getElementById("patientNameDisplay");
    if (span) span.textContent = window._currentPatientName;

  } catch (err) {
    console.error("Error loading patient info:", err);
  }
}

// ============================================
// UPDATE NAV LINKS WITH PATIENT ID
// ============================================
function updateNavLinks() {
  const patientId = new URLSearchParams(window.location.search).get("patientId");
  if (!patientId) return;

  document.querySelectorAll("nav-bar a").forEach(link => {
    const href = link.getAttribute("href");
    if (href && !href.includes("?patientId=")) {
      link.setAttribute("href", `${href}?patientId=${patientId}`);
    }
  });
}

// ============================================
// LOAD LAB RESULTS  (card list)
// ============================================
async function loadLabResults() {
  if (!checkAccess()) return;

  const patientId = new URLSearchParams(window.location.search).get("patientId");
  if (!patientId) {
    alert("No patient selected!");
    window.location.href = "Patients.html";
    return;
  }

  const container    = document.getElementById("labResultsContainer");
  const loadingState = document.getElementById("loadingState");
  const emptyState   = document.getElementById("emptyState");

  if (!container) return;

  if (loadingState) loadingState.style.display = "flex";
  if (emptyState)   {
    emptyState.classList.add("hidden");
    emptyState.style.display = "none";
  }

  // Remove old cards only (keep loadingState / emptyState)
  container.querySelectorAll(".lab-result-card").forEach(el => el.remove());

  try {
    const res = await fetch(`http://localhost:5000/api/lab-results/patient/${patientId}`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const raw     = await res.json();
    const results = Array.isArray(raw) ? raw : (raw.results || raw.data || []);

    if (loadingState) loadingState.style.display = "none";

    if (!results || !results.length) {
      if (emptyState) {
        emptyState.classList.remove("hidden");
        emptyState.style.display = "flex";
      }
      return;
    }

    results.forEach(result => {
      const div = document.createElement("div");

      // Use the card builder from the inline script if available,
      // otherwise fall back to the one defined below.
      const builder = (typeof createLabResultCard === "function")
        ? createLabResultCard
        : _fallbackCreateCard;

      div.innerHTML = builder(result);
      const card    = div.firstElementChild;

      // Wire view button — openViewModal is defined in inline script
      const viewBtn = card.querySelector(".view-lab-result");
      if (viewBtn) {
        viewBtn.addEventListener("click", () => {
          if (typeof openViewModal === "function") openViewModal(result);
        });
      }

      container.appendChild(card);
    });

  } catch (err) {
    console.error("Error loading lab results:", err);
    if (loadingState) loadingState.style.display = "none";

    const errDiv = document.createElement("div");
    errDiv.className = "lab-result-card col-span-full";
    errDiv.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12">
        <div class="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <i class="fa-solid fa-exclamation-triangle text-4xl text-red-500"></i>
        </div>
        <h3 class="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">Error Loading Results</h3>
        <p class="text-slate-500 dark:text-slate-400 text-center mb-4">
          Failed to load laboratory results. Please try again.
        </p>
        <button onclick="loadLabResults()"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all">
          <span class="material-symbols-outlined text-lg">refresh</span>
          Retry
        </button>
      </div>`;
    container.appendChild(errDiv);
  }
}

// ============================================
// FALLBACK CARD  (used only if inline script's
// createLabResultCard is not yet defined)
// ============================================
const _TEST_LABELS = {
  UA: "Urinalysis",
  BT: "Blood Typing",
  PT: "Pregnancy Test",
  DVT: "Dengue Rapid Test",
  FA: "Fecalysis",
  SEROLOGY: "Serology (HBsAg/VDRL)",
  CHEM: "Clinical Chemistry",
};

function _fallbackCreateCard(result) {
  const testType  = result.testType  || "Lab Test";
  const testLabel = _TEST_LABELS[testType] || testType;
  const date      = result.uploadDate || result.createdAt || result.testDate;
  const by        = result.uploadedBy || "Medical Technologist";

  const formatted = date
    ? new Date(date).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "Date not available";

  const iconMap = {
    UA: "fa-droplet", BT: "fa-tint", PT: "fa-person-pregnant",
    DVT: "fa-bug", FA: "fa-vials", SEROLOGY: "fa-virus", CHEM: "fa-flask",
  };
  const icon = iconMap[testType] || "fa-file-medical";

  return `
    <div class="lab-result-card bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200
                dark:border-slate-700 p-5 hover:border-primary hover:shadow-lg transition-all duration-200 group">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-lg bg-emerald-50 dark:bg-slate-700 flex items-center justify-center">
            <i class="fa-solid ${icon} text-2xl text-primary"></i>
          </div>
          <div>
            <h3 class="font-bold text-slate-800 dark:text-slate-100 text-base">${escapeHtml(testLabel)}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <i class="fa-solid fa-calendar-alt mr-1"></i>${formatted}
            </p>
          </div>
        </div>
      </div>
      <div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <i class="fa-solid fa-user-nurse"></i>
          <span>${escapeHtml(by)}</span>
        </div>
        <button class="view-lab-result inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white
                       text-sm font-medium hover:bg-primary/90 transition-all group-hover:scale-105">
          <i class="fa-solid fa-eye"></i>
          View
        </button>
      </div>
    </div>`;
}

// ============================================
// AUTO-REFRESH  every 10 s
// (skips when either modal is open)
// ============================================
setInterval(() => {
  const addOpen  = document.getElementById("addLabModal")  &&
                   !document.getElementById("addLabModal").classList.contains("hidden");
  const viewOpen = document.getElementById("viewLabModal") &&
                   !document.getElementById("viewLabModal").classList.contains("hidden");

  if (!addOpen && !viewOpen) loadLabResults();
}, 10000);