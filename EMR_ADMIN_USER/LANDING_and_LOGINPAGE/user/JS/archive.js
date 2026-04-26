// archive.js - Appointment History with Pagination (10 per page)

let allArchivedAppointments = []; 
let currentPage = 1;
const appointmentsPerPage = 10;

async function loadAppointments() {
    // ✅ FIX: Changed #appointmentsTable to #archiveTable
    const tableBody = document.querySelector("#archiveTable tbody");
    const countDisplay = document.getElementById("appointmentCount");

    try {
        const res = await fetch("http://localhost:5000/api/appointments/archive/list");
        if (!res.ok) throw new Error("Failed to fetch archived appointments");

        let archivedAppointments = await res.json();
        
        const loggedInRole = sessionStorage.getItem('role');
        const loggedInUserId = sessionStorage.getItem('userId');
        const loggedInName = sessionStorage.getItem('name');
        
        // Filter by doctor if logged in as doctor
        if (loggedInRole === "Doctor" && loggedInUserId) {
          archivedAppointments = archivedAppointments.filter(app => {
            const matchesDoctorId = app.doctorId === loggedInUserId;
            const matchesDoctorName = app.doctorName === `Dr. ${loggedInName}` || 
                                       app.doctorName === loggedInName;
            return matchesDoctorId || matchesDoctorName;
          });
        }
        
        allArchivedAppointments = archivedAppointments;
        
        // Apply filters and sorting
        let displayAppointments = filterAndSortAppointments(archivedAppointments);

        if (!displayAppointments || displayAppointments.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No archived appointments found</td></tr>`;
            countDisplay.textContent = "Showing 0 archived appointments";
            updatePaginationButtons(0, 0);
            return;
        }

        // Calculate pagination
        const totalAppointments = displayAppointments.length;
        const totalPages = Math.ceil(totalAppointments / appointmentsPerPage);
        
        // Get current page appointments
        const startIndex = (currentPage - 1) * appointmentsPerPage;
        const endIndex = startIndex + appointmentsPerPage;
        const paginatedAppointments = displayAppointments.slice(startIndex, endIndex);

        renderTable(paginatedAppointments);
        attachModalListeners();
        
        // Update count display
        const showingStart = totalAppointments > 0 ? startIndex + 1 : 0;
        const showingEnd = Math.min(endIndex, totalAppointments);
        countDisplay.textContent = `Showing ${showingStart}-${showingEnd} of ${totalAppointments} appointments`;
        
        // Update pagination buttons
        updatePaginationButtons(currentPage, totalPages);

    } catch (err) {
        console.error("Error loading archived appointments:", err);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Error loading archive data</td></tr>`;
        countDisplay.textContent = "Error loading count";
        updatePaginationButtons(0, 0);
    }
}

// Update pagination button states
function updatePaginationButtons(current, total) {
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");
    const pageInfo = document.getElementById("pageInfo");
    
    if (!prevBtn || !nextBtn || !pageInfo) return;
    
    if (total > 0) {
        pageInfo.textContent = `Page ${current} of ${total}`;
    } else {
        pageInfo.textContent = `Page 0`;
    }
    
    prevBtn.disabled = current <= 1;
    nextBtn.disabled = current >= total || total === 0;
}

// Render table
function renderTable(appointments) {
    // ✅ FIX: Changed #appointmentsTable to #archiveTable
    const tableBody = document.querySelector("#archiveTable tbody");
    
    tableBody.innerHTML = appointments.map(app => `
        <tr>
            <td>${app.archiveId || app.appointmentId || 'N/A'}</td>
            <td>${app.patientName || 'N/A'}</td>
            <td>${app.date ? new Date(app.date).toLocaleDateString() : 'N/A'}<br>
                <h3 style="color: gray; font-size: 14px;">${app.time || "09:00"}</h3>
            </td>
            <td>${app.doctorName || 'N/A'}</td>
            <td>${app.type || 'N/A'}</td>
            <td>
                <span class="${
                    app.status === "Completed" ? "statusCompleted" : "statusCanceled"
                }">${app.status || 'N/A'}</span>
            </td>
            <td>
                <a href="#" class="actionBtn"
                    data-id="${app.appointmentId || ''}"
                    data-patientid="${app.patientId || ''}"
                    data-name="${app.patientName || ''}"
                    data-date="${app.date || ''}"
                    data-time="${app.time || '09:00'}"
                    data-doctor="${app.doctorName || ''}"
                    data-service="${app.service || ''}"
                    data-type="${app.type || ''}"
                    data-reason="${app.reason || ''}"
                    data-notes="${app.notes || ''}"
                    data-status="${app.status || ''}">
                    View 
                </a>
            </td>
        </tr>
    `).join("");
}

// Filter and sort appointments
function filterAndSortAppointments(appointments) {
    const searchBar = document.querySelector(".searchBar");
    const filterSelect = document.getElementById("filterSelect");
    const sortSelect = document.getElementById("sortDate");
    
    const savedFilter = sessionStorage.getItem('archiveFilterOption');
    const savedSort = sessionStorage.getItem('archiveSortOption');
    
    if (savedFilter && filterSelect) {
        filterSelect.value = savedFilter;
    }
    if (savedSort && sortSelect) {
        sortSelect.value = savedSort;
    }
    
    const searchValue = searchBar?.value.toLowerCase().trim() || "";
    const filterValue = filterSelect?.value || "all";
    const sortValue = sortSelect?.value || "";
    
    let filtered = appointments;
    if (searchValue) {
        filtered = filtered.filter(app => {
            const archiveId = (app.archiveId || '').toLowerCase();
            const appointmentId = (app.appointmentId || '').toLowerCase();
            const patientName = (app.patientName || '').toLowerCase();
            const doctorName = (app.doctorName || '').toLowerCase();
            
            return archiveId.includes(searchValue) || 
                   appointmentId.includes(searchValue) || 
                   patientName.includes(searchValue) || 
                   doctorName.includes(searchValue);
        });
    }
    
    if (filterValue !== "all") {
        filtered = filtered.filter(app => {
            const status = (app.status || "").toLowerCase();
            return status === filterValue;
        });
    }
    
    let sorted = [...filtered];
    if (sortValue === "desc") {
        sorted.sort((a, b) => {
            const dateA = new Date(`${a.date} ${a.time || '00:00'}`);
            const dateB = new Date(`${b.date} ${b.time || '00:00'}`);
            return dateA - dateB;
        });
    } else if (sortValue === "asc") {
        sorted.sort((a, b) => {
            const dateA = new Date(`${a.date} ${a.time || '00:00'}`);
            const dateB = new Date(`${b.date} ${b.time || '00:00'}`);
            return dateB - dateA;
        });
    }
    
    return sorted;
}

// Attach modal event listeners
function attachModalListeners() {
    const modal = document.getElementById("viewModal");
    const closeModal = document.getElementById("closeModal");
    
    const buttonCon = document.querySelector(".buttonCon");
    if (buttonCon) buttonCon.innerHTML = '';

    document.querySelectorAll(".actionBtn").forEach(btn => {
        btn.addEventListener("click", e => {
            e.preventDefault();

            const appDetails = {
                id: btn.getAttribute("data-id") || '',
                patientId: btn.getAttribute("data-patientid") || '',
                date: btn.getAttribute("data-date") ? new Date(btn.getAttribute("data-date")).toLocaleDateString() : 'N/A',
                time: btn.getAttribute("data-time") || '09:00',
                doctor: btn.getAttribute("data-doctor") || '',
                service: btn.getAttribute("data-service") || '',
                type: btn.getAttribute("data-type") || '',
                reason: btn.getAttribute("data-reason") || '',
                notes: btn.getAttribute("data-notes") || '',
                status: btn.getAttribute("data-status") || ''
            };

            document.getElementById("modalDate").textContent = appDetails.date;
            document.getElementById("modalTime").textContent = appDetails.time;
            document.getElementById("modalDoctor").textContent = appDetails.doctor || "N/A";
            
            const modalServiceEl = document.getElementById("modalService");
            if (modalServiceEl) modalServiceEl.textContent = appDetails.service || "N/A";

            document.getElementById("modalType").textContent = formatAppointmentType(appDetails.type);
            document.getElementById("modalReason").textContent = appDetails.reason || "No reason provided";
            
            const allNotes = appDetails.notes || "";
            let additionalNotes = "";
            let prescriptionNotes = "";
            
            if (allNotes.includes("Prescription Notes:")) {
                const parts = allNotes.split("Prescription Notes:");
                additionalNotes = parts[0].trim();
                prescriptionNotes = parts[1] ? parts[1].trim() : "";
            } else {
                additionalNotes = allNotes;
            }
            
            document.getElementById("modalNotes").textContent = additionalNotes || "No additional notes";
            const prescriptionNotesEl = document.getElementById("modalPrescriptionNotes");
            if (prescriptionNotesEl) {
                prescriptionNotesEl.textContent = prescriptionNotes || "No prescription notes";
            }
            
            document.getElementById("modalStatus").textContent = appDetails.status || "N/A";

            const badge = document.getElementById("modalStatus");
            badge.style.backgroundColor = appDetails.status === "Completed" ? "#2da624" : "#ca3030";

            const medicationsSection = document.getElementById("archiveMedicationsSection");
            if (appDetails.patientId && appDetails.id) {
                if (medicationsSection) medicationsSection.style.display = "block";
                loadArchiveMedications(appDetails.patientId, appDetails.id);
            } else {
                if (medicationsSection) medicationsSection.style.display = "none";
            }

            modal.style.display = "flex";
        });
    });

    closeModal.addEventListener("click", () => modal.style.display = "none");
    window.addEventListener("click", e => {
        if (e.target === modal) modal.style.display = "none";
    });
}

// Format appointment type
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

// Load medications for archived appointment
async function loadArchiveMedications(patientId, appointmentId) {
    const medicationsContainer = document.getElementById("archiveMedicationsList");
    if (!medicationsContainer) return;

    try {
        const res = await fetch(`http://localhost:5000/api/patients/${patientId}/medications`);
        if (!res.ok) {
            medicationsContainer.innerHTML = '<p style="color:gray;">No medications found</p>';
            return;
        }

        const medications = await res.json();
        
        const appointmentMeds = medications.filter(m => {
            if (!m.appointmentId || !appointmentId) return false;
            const medAppointmentId = String(m.appointmentId).trim();
            const targetAppointmentId = String(appointmentId).trim();
            return medAppointmentId === targetAppointmentId;
        });

        if (appointmentMeds.length === 0) {
            medicationsContainer.innerHTML = '<p style="color:gray;">No medications prescribed for this appointment</p>';
            return;
        }

        medicationsContainer.innerHTML = `
            <div style="max-height: 300px; overflow-y: auto; overflow-x: auto; border: 1px solid #e0e0e0; border-radius: 5px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f5f5f5; position: sticky; top: 0; z-index: 10;">
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left; background: #f5f5f5;">Medicine</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left; background: #f5f5f5;">Dosage</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left; background: #f5f5f5;">Frequency</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left; background: #f5f5f5;">Quantity</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left; background: #f5f5f5;">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${appointmentMeds.map(m => `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd;">${m.medicname || 'N/A'}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${m.dosage || 'N/A'}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${m.frequency || 'N/A'}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${m.quantity || 0}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${m.presNotes || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        console.error("Error loading archive medications:", err);
        medicationsContainer.innerHTML = '<p style="color:red;">Error loading medications</p>';
    }
}

// Pagination handlers
function goToNextPage() {
    const filtered = filterAndSortAppointments(allArchivedAppointments);
    const totalPages = Math.ceil(filtered.length / appointmentsPerPage);
    
    if (currentPage < totalPages) {
        currentPage++;
        loadAppointments();
    }
}

function goToPreviousPage() {
    if (currentPage > 1) {
        currentPage--;
        loadAppointments();
    }
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
    loadAppointments();
    
    const searchBar = document.querySelector(".searchBar");
    const filterSelect = document.getElementById("filterSelect");
    const sortSelect = document.getElementById("sortDate");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");
    
    if (searchBar) {
        searchBar.addEventListener("input", () => {
            currentPage = 1;
            loadAppointments();
        });
    }
    
    if (filterSelect) {
        filterSelect.addEventListener("change", () => {
            sessionStorage.setItem('archiveFilterOption', filterSelect.value);
            currentPage = 1;
            loadAppointments();
        });
    }
    
    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            sessionStorage.setItem('archiveSortOption', sortSelect.value);
            loadAppointments();
        });
    }
    
    if (prevBtn) {
        prevBtn.addEventListener("click", goToPreviousPage);
    }
    
    if (nextBtn) {
        nextBtn.addEventListener("click", goToNextPage);
    }
});