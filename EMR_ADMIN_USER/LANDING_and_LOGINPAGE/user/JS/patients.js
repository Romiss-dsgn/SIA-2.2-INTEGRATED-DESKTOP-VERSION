// ════════════════════════════════════════════════════════════
// patients.js
// ════════════════════════════════════════════════════════════

// ── Module-level shared state (fixes pagination flicker) ──
// _currentList holds the current filtered+sorted array so that
// goToNextPage/goToPreviousPage never need to re-filter independently.
let _currentList    = [];
let _currentPage    = 1;
const PATIENTS_PER_PAGE = 10;

// ════════════════════════════════════════════════════════════
// LOAD PATIENTS
// ════════════════════════════════════════════════════════════
async function loadPatients() {
  try {
    await autoUpdateInactivePatients();

    const res      = await fetch("http://localhost:5000/api/patients");
    const patients = await res.json();

    const tbody       = document.querySelector("tbody");
    const searchBar   = document.querySelector(".searchBar");
    const sortSelect  = document.getElementById("filterSelect");
    const statusFilter = document.getElementById("statusFilter");

    // ── Stat cards ──
    const totalPatients = patients.length;
    const maleCount     = patients.filter(p => (p.gender || p.sex || "").toLowerCase() === "male").length;
    const femaleCount   = patients.filter(p => (p.gender || p.sex || "").toLowerCase() === "female").length;
    const recentCount   = countPatientsThisMonth(patients);

    document.getElementById("totalPatients").textContent  = totalPatients;
    document.getElementById("malePatients").textContent   = maleCount;
    document.getElementById("femalePatients").textContent = femaleCount;
    document.getElementById("recentPatients").textContent = recentCount;

    // ── Helpers ──
    function getMonthRange() {
      const now          = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      return { startOfMonth, endOfMonth };
    }

    function countPatientsThisMonth(list) {
      const { startOfMonth, endOfMonth } = getMonthRange();
      return list.filter(p => {
        const raw  = p.createdAt || p.registeredDate || p.dateRegistered || p.createdDate;
        if (!raw) return false;
        const d = new Date(raw);
        return !isNaN(d) && d >= startOfMonth && d <= endOfMonth;
      }).length;
    }

    function formatPatientName(p) {
      const first  = p.firstname  || "";
      const middle = p.middlename || "";
      const last   = p.lastname   || "";
      if (middle.trim()) {
        return `${first} ${middle.trim().charAt(0).toUpperCase()}. ${last}`;
      }
      return `${first} ${last}`;
    }

    // ── Render ──
    function renderTable(list) {
      const totalPages  = Math.ceil(list.length / PATIENTS_PER_PAGE);
      // Clamp current page so it never exceeds totalPages
      if (_currentPage > totalPages) _currentPage = Math.max(1, totalPages);

      const startIdx  = (_currentPage - 1) * PATIENTS_PER_PAGE;
      const endIdx    = startIdx + PATIENTS_PER_PAGE;
      const pageSlice = list.slice(startIdx, endIdx);

      if (pageSlice.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#888;">
          No patients found matching your criteria.</td></tr>`;
      } else {
        tbody.innerHTML = pageSlice.map(p => {
          const fullName  = formatPatientName(p);
          const genderVal = (p.gender || p.sex || "").toLowerCase();
          const genderHTML = genderVal === "male"
            ? `<i class="fa-solid fa-mars" title="Male"></i> <span class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase ml-1">MALE</span>`
            : genderVal === "female"
            ? `<i class="fa-solid fa-venus" title="Female"></i> <span class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase ml-1">FEMALE</span>`
            : p.gender || p.sex || "N/A";

          const status     = (p.status || "active").toLowerCase();
          const statusHTML = status === "inactive"
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>Inactive</span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>Active</span>`;

          return `<tr>
            <td>
              <span class="text-[11px] font-bold bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded text-slate-600 dark:text-slate-300 tracking-tight">
                ${p.patientId || "N/A"}
              </span>
            </td>
            <td>${fullName}</td>
            <td>${p.dob ? p.dob.substring(0, 10) : "N/A"}</td>
            <td>${genderHTML}</td>
           <td>${statusHTML}</td>
            <td style="text-align:center;">
              <button type="button" class="viewBtn" data-id="${p.patientId}" data-name="${fullName}">
                <span class="material-symbols-outlined text-base">visibility</span>
                View Details
              </button>
            </td>
          </tr>`;
        }).join("");

        // Wire view buttons — use button not anchor to avoid href="#" flicker
        tbody.querySelectorAll(".viewBtn").forEach(btn => {
          btn.addEventListener("click", () => {
            const patientId   = btn.dataset.id;
            const patientName = btn.dataset.name;
            if (typeof addRecentPatient === "function") {
              addRecentPatient(patientId, patientName);
            }
            window.location.href = `PatientInfo.html?patientId=${patientId}`;
          });
        });
      }

      // Update footer
      const showStart = list.length === 0 ? 0 : startIdx + 1;
      const showEnd   = Math.min(endIdx, list.length);
      document.querySelector(".bottomSec").innerHTML =
        `Showing ${showStart}–${showEnd} of ${list.length} patient(s)`;

      updatePaginationButtons(totalPages);
    }

    function updatePaginationButtons(totalPages) {
      const prevBtn  = document.getElementById("prevPageBtn");
      const nextBtn  = document.getElementById("nextPageBtn");
      const pageInfo = document.getElementById("pageInfo");

      if (!prevBtn || !nextBtn || !pageInfo) return;
      pageInfo.textContent  = `Page ${_currentPage} of ${totalPages || 1}`;
      prevBtn.disabled      = _currentPage === 1;
      nextBtn.disabled      = _currentPage >= totalPages || totalPages === 0;

      [prevBtn, nextBtn].forEach(btn => {
        if (btn.disabled) {
          btn.classList.add("opacity-50", "cursor-not-allowed");
          btn.classList.remove("hover:bg-primary/10");
        } else {
          btn.classList.remove("opacity-50", "cursor-not-allowed");
          btn.classList.add("hover:bg-primary/10");
        }
      });
    }

    // ── Filter + Sort → store to _currentList → render ──
    function filterAndSortPatients() {
      const searchTerm  = (searchBar.value || "").toLowerCase().trim();
      const sortOption  = (sortSelect.value || "all").toLowerCase();
      const statusValue = (statusFilter.value || "all").toLowerCase();

      // 1. Search filter
      let filtered = patients.filter(p => {
        const fullName = formatPatientName(p).toLowerCase();
        return (
          searchTerm === "" ||
          fullName.includes(searchTerm) ||
          (p.patientId && p.patientId.toLowerCase().includes(searchTerm))
        );
      });

      // 2. Status filter
      if (statusValue !== "all") {
        filtered = filtered.filter(p => {
          const s = (p.status || "active").toLowerCase();
          return s === statusValue;
        });
      }

      // 3. Sort
      const sorted = [...filtered];
      switch (sortOption) {
        case "a-z":
          sorted.sort((a, b) => formatPatientName(a).toLowerCase().localeCompare(formatPatientName(b).toLowerCase()));
          break;
        case "z-a":
          sorted.sort((a, b) => formatPatientName(b).toLowerCase().localeCompare(formatPatientName(a).toLowerCase()));
          break;
        case "latest":
          sorted.sort((a, b) => (b.patientId || "").localeCompare(a.patientId || "", undefined, { numeric: true, sensitivity: "base" }));
          break;
        case "oldest":
          sorted.sort((a, b) => (a.patientId || "").localeCompare(b.patientId || "", undefined, { numeric: true, sensitivity: "base" }));
          break;
      }

      // ✅ Store shared list — pagination functions use this directly
      _currentList = sorted;
      renderTable(_currentList);
    }

    // ── Pagination button handlers — use shared _currentList ──
    // These are assigned to the buttons directly (not window) to avoid timing issues
    document.getElementById("prevPageBtn").onclick = function () {
      if (_currentPage > 1) {
        _currentPage--;
        renderTable(_currentList);
      }
    };

    document.getElementById("nextPageBtn").onclick = function () {
      const totalPages = Math.ceil(_currentList.length / PATIENTS_PER_PAGE);
      if (_currentPage < totalPages) {
        _currentPage++;
        renderTable(_currentList);
      }
    };

    // ── Event listeners — reset to page 1 on any filter change ──
    searchBar.addEventListener("input", () => {
      _currentPage = 1;
      filterAndSortPatients();
    });

    sortSelect.addEventListener("change", () => {
      _currentPage = 1;
      sessionStorage.setItem("patientSortOption", sortSelect.value);
      filterAndSortPatients();
    });

    statusFilter.addEventListener("change", () => {
      _currentPage = 1;
      sessionStorage.setItem("patientStatusFilter", statusFilter.value);
      filterAndSortPatients();
    });

    // Restore saved preferences
    const savedSort   = sessionStorage.getItem("patientSortOption");
    const savedStatus = sessionStorage.getItem("patientStatusFilter");
    if (savedSort)   sortSelect.value   = savedSort;
    if (savedStatus) statusFilter.value = savedStatus;

    // Initial render
    filterAndSortPatients();

  } catch (err) {
    console.error("Error loading patients:", err);
    document.querySelector(".bottomSec").innerText = "Error loading patients. Please try again.";
  }
}

// ════════════════════════════════════════════════════════════
// AUTO-INACTIVE CHECK
// ════════════════════════════════════════════════════════════
async function autoUpdateInactivePatients() {
  try {
    const res = await fetch("http://localhost:5000/api/patients/auto-update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return { success: false, updatedCount: 0 };
    return await res.json();
  } catch {
    return { success: false, updatedCount: 0 };
  }
}

// ════════════════════════════════════════════════════════════
// ROLE-BASED UI
// ════════════════════════════════════════════════════════════
function controlAddPatientVisibility() {
  const role = (sessionStorage.getItem("role") || "").trim().toLowerCase();
  if (role === "doctor" || role === "medtech") {
    const btn = document.querySelector(".addBtn");
    if (btn) btn.style.display = "none";
  }
}

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
function initPatientsPage() {
  controlAddPatientVisibility();
  loadPatients();
}

window.onload = initPatientsPage;