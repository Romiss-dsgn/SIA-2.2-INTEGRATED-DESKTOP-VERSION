// ════════════════════════════════════════════════════════════
// deceased_records.js
// ════════════════════════════════════════════════════════════

// ── Module-level shared state (fixes pagination flicker) ──
let _currentList    = [];
let _currentPage    = 1;
const PATIENTS_PER_PAGE = 10;

// ════════════════════════════════════════════════════════════
// LOAD DECEASED RECORDS
// ════════════════════════════════════════════════════════════
async function loadDeceasedRecords() {
  try {
    const res      = await fetch("http://localhost:5000/api/archived-patients");
    const patients = await res.json();

    const tbody       = document.querySelector("tbody");
    const searchBar   = document.querySelector(".searchBar");
    const sortSelect  = document.getElementById("filterSelect");

    // ── Helpers ──
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
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#888;">
          No deceased patients found matching your criteria.</td></tr>`;
      } else {
        tbody.innerHTML = pageSlice.map(p => {
          const fullName  = formatPatientName(p);
          const genderVal = (p.gender || p.sex || "").toLowerCase();
          const genderHTML = genderVal === "male"
            ? `<i class="fa-solid fa-mars" title="Male"></i> <span class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase ml-1">MALE</span>`
            : genderVal === "female"
            ? `<i class="fa-solid fa-venus" title="Female"></i> <span class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase ml-1">FEMALE</span>`
            : p.gender || p.sex || "N/A";

          return `<tr>
            <td>
              <span class="text-[11px] font-bold bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded text-slate-600 dark:text-slate-300 tracking-tight">
                ${p.patientId || "N/A"}
              </span>
            </td>
            <td>${fullName}</td>
            <td>${p.dob ? p.dob.substring(0, 10) : "N/A"}</td>
            <td>${genderHTML}</td>
            <td style="text-align:center;">
              <button type="button" class="viewBtn" data-id="${p.patientId}" data-name="${fullName}">
                <span class="material-symbols-outlined text-base">visibility</span>
                View Details
              </button>
            </td>
          </tr>`;
        }).join("");

        // Wire view buttons
        // ✅ FIX: pass archived=true so PatientInfo fetches from /api/archived-patients
        tbody.querySelectorAll(".viewBtn").forEach(btn => {
          btn.addEventListener("click", () => {
            const patientId   = btn.dataset.id;
            const patientName = btn.dataset.name;
            if (typeof addRecentPatient === "function") {
              addRecentPatient(patientId, patientName);
            }
            window.location.href = `PatientInfo.html?patientId=${patientId}&archived=true`;
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
        } else {
          btn.classList.remove("opacity-50", "cursor-not-allowed");
        }
      });
    }

    // ── Filter + Sort → store to _currentList → render ──
    function filterAndSortPatients() {
      const searchTerm  = (searchBar.value || "").toLowerCase().trim();
      const sortOption  = (sortSelect.value || "all").toLowerCase();

      // Search filter
      let filtered = patients.filter(p => {
        const fullName = formatPatientName(p).toLowerCase();
        return (
          searchTerm === "" ||
          fullName.includes(searchTerm) ||
          (p.patientId && p.patientId.toLowerCase().includes(searchTerm))
        );
      });

      // Sort
      const sorted = [...filtered];
      switch (sortOption) {
        case "a-z":
          sorted.sort((a, b) => formatPatientName(a).localeCompare(formatPatientName(b)));
          break;
        case "z-a":
          sorted.sort((a, b) => formatPatientName(b).localeCompare(formatPatientName(a)));
          break;
        case "latest":
          sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          break;
        case "oldest":
          sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
          break;
      }

      // Store shared list
      _currentList = sorted;
      renderTable(_currentList);
    }

    // ── Pagination button handlers ──
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

    // ── Event listeners ──
    searchBar.addEventListener("input", () => {
      _currentPage = 1;
      filterAndSortPatients();
    });

    sortSelect.addEventListener("change", () => {
      _currentPage = 1;
      filterAndSortPatients();
    });

    // Initial render
    filterAndSortPatients();

  } catch (err) {
    console.error("Error loading deceased records:", err);
    document.querySelector(".bottomSec").innerText = "Error loading deceased records. Please try again.";
  }
}

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
function initDeceasedRecordsPage() {
  loadDeceasedRecords();
}

window.onload = initDeceasedRecordsPage;