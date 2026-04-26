// medtech_requests.js

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPatientName(firstName, middleName, lastName) {
  const first  = (firstName  || '').trim();
  const middle = (middleName || '').trim();
  const last   = (lastName   || '').trim();
  if (middle) {
    return `${first} ${middle.charAt(0).toUpperCase()}. ${last}`;
  }
  return `${first} ${last}`;
}

let currentRequests  = [];
let filteredRequests = [];
let currentPage      = 1;
const rowsPerPage    = 10;
let currentRequestData = null;

// ════════════════════════════════════════════════════════════
// RENDER TABLE
// ════════════════════════════════════════════════════════════
function renderTable() {
  const tbody = document.getElementById('requestsTableBody');
  if (!tbody) return;

  const start        = (currentPage - 1) * rowsPerPage;
  const end          = start + rowsPerPage;
  const pageRequests = filteredRequests.slice(start, end);

  if (pageRequests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-slate-400">
      <span class="material-symbols-outlined text-6xl block mb-4 opacity-50">assignment_late</span>
      No requests found
    </td></tr>`;
    updatePagination();
    return;
  }

  tbody.innerHTML = pageRequests.map((req, idx) => {
    const patientName = formatPatientName(
      req.patientFirstName || req.patientName,
      req.patientMiddleName,
      req.patientLastName
    );
    return `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
      <td class="font-mono font-semibold text-sm text-primary">${escapeHtml(req.requestId)}</td>
      <td class="font-semibold">${escapeHtml(patientName)}</td>
      <td>${escapeHtml(req.referringDoctor || req.submittedBy || '—')}</td>
      <td class="text-sm text-slate-500">${req.submittedAt ? new Date(req.submittedAt).toLocaleDateString('en-PH') : '—'}</td>
      <td class="text-center">
        <span class="px-2 py-1 rounded-full text-xs font-bold ${
          req.priority === 'Urgent'    ? 'bg-orange-100 text-orange-800' :
          req.priority === 'Emergency' ? 'bg-red-100 text-red-800' :
                                         'bg-blue-100 text-blue-800'
        }">${escapeHtml(req.priority || 'Routine')}</span>
      </td>
      <td class="text-center">
        <span class="px-3 py-1 rounded-full text-xs font-bold ${
          req.status === 'Pending'     ? 'bg-amber-100 text-amber-800'   :
          req.status === 'In Progress' ? 'bg-blue-100 text-blue-800'     :
          req.status === 'Completed'   ? 'bg-emerald-100 text-emerald-800' :
                                         'bg-red-100 text-red-800'
        }">${escapeHtml(req.status || 'Pending')}</span>
      </td>
      <td class="text-center">
        <button onclick="viewRequestByIndex(${start + idx})"
           class="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-all">
          <span class="material-symbols-outlined text-xs">visibility</span>
          View
        </button>
      </td>
    </tr>`;
  }).join('');

  updatePagination();
}

function updatePagination() {
  const totalPages   = Math.max(1, Math.ceil(filteredRequests.length / rowsPerPage));
  const pageInfo     = document.getElementById('pageInfo');
  const prevBtn      = document.getElementById('prevBtn');
  const nextBtn      = document.getElementById('nextBtn');
  const tableShowing = document.getElementById('tableShowing');

  if (pageInfo)     pageInfo.textContent = `${currentPage} of ${totalPages}`;
  if (prevBtn)      prevBtn.disabled     = currentPage <= 1;
  if (nextBtn)      nextBtn.disabled     = currentPage >= totalPages;
  if (tableShowing) {
    const from = filteredRequests.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const to   = Math.min(currentPage * rowsPerPage, filteredRequests.length);
    tableShowing.textContent = `Showing ${from}–${to} of ${currentRequests.length}`;
  }
}

function changePage(delta) {
  const totalPages = Math.ceil(filteredRequests.length / rowsPerPage);
  currentPage = Math.max(1, Math.min(totalPages, currentPage + delta));
  renderTable();
}

function viewRequestByIndex(index) {
  try {
    if (!filteredRequests[index]) { alert('Request data not found'); return; }
    currentRequestData = filteredRequests[index];
    populateModal(currentRequestData);
    showModal();
  } catch (err) {
    console.error('❌ Error viewing request:', err);
    alert('Failed to load request details. Please try again.');
  }
}

// ════════════════════════════════════════════════════════════
// POPULATE MODAL
// ════════════════════════════════════════════════════════════
function populateModal(req) {
  const modalRequestId     = document.getElementById('modalRequestId');
  const modalRequestStatus = document.getElementById('modalRequestStatus');

  if (modalRequestId) modalRequestId.textContent = `Request ID: ${req.requestId || 'N/A'}`;

  if (modalRequestStatus) {
    const statusColors = {
      'Pending':     'bg-amber-100 text-amber-800',
      'In Progress': 'bg-blue-100 text-blue-800',
      'Completed':   'bg-emerald-100 text-emerald-800',
      'Cancelled':   'bg-red-100 text-red-800'
    };
    const colorClass = statusColors[req.status] || 'bg-slate-100 text-slate-800';
    modalRequestStatus.className = `inline-flex items-center gap-2 px-4 py-2 ${colorClass} text-sm font-bold rounded-full`;
    modalRequestStatus.textContent = req.status || 'Pending';
  }

  const modalPatientInfo = document.getElementById('modalPatientInfo');
  if (modalPatientInfo) {
    const submittedDate = req.submittedAt
      ? new Date(req.submittedAt).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })
      : (req.requestedDate || 'N/A');

    let displayAge = req.patientAge;
    if (!displayAge && req.patientDOB) {
      try {
        const bd  = new Date(req.patientDOB);
        const now = new Date();
        let age   = now.getFullYear() - bd.getFullYear();
        const md  = now.getMonth() - bd.getMonth();
        if (md < 0 || (md === 0 && now.getDate() < bd.getDate())) age--;
        displayAge = age > 0 ? age : null;
      } catch (_) {}
    }

    const patientName   = formatPatientName(
      req.patientFirstName || req.patientName, req.patientMiddleName, req.patientLastName
    );
    const tests         = Array.isArray(req.tests) ? req.tests : [];
    const testsDisplay  = tests.length > 0
      ? tests.slice(0, 2).join(', ') + (tests.length > 2 ? ` +${tests.length - 2} more` : '')
      : 'No tests specified';

    modalPatientInfo.innerHTML = `
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Patient Name</div>
        <div class="modal-value">${escapeHtml(patientName || 'N/A')}</div>
      </div>
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Age / Sex</div>
        <div class="modal-value">${escapeHtml(displayAge || '—')} / ${escapeHtml(req.patientSex || '—')}</div>
      </div>
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Doctor</div>
        <div class="modal-value">${escapeHtml(req.referringDoctor || req.submittedBy || 'N/A')}</div>
      </div>
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date Submitted</div>
        <div class="modal-value">${submittedDate}</div>
      </div>
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Priority</div>
        <div class="modal-badge ${(req.priority || 'Routine').toLowerCase()}">${escapeHtml(req.priority || 'Routine')}</div>
      </div>
      <div class="md:col-span-2">
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tests Requested</div>
        <div class="modal-value text-xs">${escapeHtml(testsDisplay)}</div>
      </div>`;
  }

  const modalTestsList = document.getElementById('modalTestsList');
  if (modalTestsList) {
    const tests = Array.isArray(req.tests) ? req.tests : [];
    modalTestsList.innerHTML = tests.length === 0
      ? `<div class="text-center py-6 text-slate-400">
           <span class="material-symbols-outlined text-3xl block mb-2 opacity-50">science</span>
           <p class="text-sm">No tests specified</p>
         </div>`
      : `<div class="space-y-3">
           ${tests.map(t => `
             <div class="modal-lab-item checked">
               <div class="modal-readonly-checkbox checked"></div>
               <label>${escapeHtml(t)}</label>
             </div>`).join('')}
         </div>`;
  }

  const modalNotes = document.getElementById('modalNotes');
  if (modalNotes) modalNotes.textContent = req.notes || 'No notes provided';
}

function showModal() {
  const modal = document.getElementById('viewRequestModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal() {
  const modal = document.getElementById('viewRequestModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  currentRequestData = null;
}

// ════════════════════════════════════════════════════════════
// ✅ ADD LAB RESULT — mark Complete HERE, then navigate
// ════════════════════════════════════════════════════════════
async function addLabResult() {
  if (!currentRequestData) { alert('No request data available'); return; }

  const patientId = currentRequestData.patientID || currentRequestData.patientId || '';
  const requestId = currentRequestData.requestId || '';

  if (!patientId) { alert('No patient ID found for this request.'); return; }

  // ── Store physician for autofill in LabResults.html ──
  const physician = currentRequestData.referringDoctor || currentRequestData.submittedBy || '';
  if (physician) sessionStorage.setItem('pendingPhysician', physician);

  // ── Disable button + show spinner while calling API ──
  const btn = document.getElementById('addResultBtn');
  const originalHTML = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-xl">progress_activity</span><span>Processing...</span>`;
  }

  try {
    // ✅ Mark request as Completed RIGHT NOW — before navigating anywhere
    const completedBy = sessionStorage.getItem('name') || 'Medical Technologist';
    const res = await fetch(
      `http://localhost:5000/api/request-forms/${requestId}/complete`,
      {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ completedBy }),
      }
    );

    if (res.ok) {
      console.log(`✅ Request ${requestId} marked as Completed`);
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn('⚠️ Could not mark request complete:', res.status, err.message);
      // Don't block navigation — still let the medtech add the result
    }
  } catch (err) {
    console.warn('⚠️ Network error marking request complete:', err.message);
    // Don't block navigation on network error
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  // ── Navigate to LabResults regardless of completion API result ──
  window.location.href = `LabResults.html?patientId=${patientId}&requestId=${requestId}`;
}

// ════════════════════════════════════════════════════════════
// LOAD LAB REQUESTS
// ════════════════════════════════════════════════════════════
async function loadLabRequests() {
  console.log('🔄 Loading lab requests...');

  const loadingState = document.getElementById('loadingState');
  const emptyState   = document.getElementById('emptyState');
  const container    = document.getElementById('labRequestsContainer');

  if (loadingState) loadingState.style.display = 'flex';
  if (emptyState)   emptyState.style.display   = 'none';

  if (container && !document.getElementById('requestsTableBody')) {
    container.innerHTML = `
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <th class="px-6 py-4 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider">Request ID</th>
            <th class="px-6 py-4 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider">Patient</th>
            <th class="px-6 py-4 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider">Doctor</th>
            <th class="px-6 py-4 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider">Date</th>
            <th class="px-6 py-4 text-center text-xs font-extrabold text-slate-500 uppercase tracking-wider">Priority</th>
            <th class="px-6 py-4 text-center text-xs font-extrabold text-slate-500 uppercase tracking-wider">Status</th>
            <th class="px-6 py-4 text-center text-xs font-extrabold text-slate-500 uppercase tracking-wider">Action</th>
          </tr>
        </thead>
        <tbody id="requestsTableBody" class="divide-y divide-slate-100 dark:divide-slate-700"></tbody>
      </table>`;
  }

  try {
    const res  = await fetch('http://localhost:5000/api/request-forms');
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    currentRequests = Array.isArray(data) ? data : (data.requests || data.data || []);

    // ✅ Show only Pending / In Progress — hide Completed ones
    currentRequests = currentRequests.filter(r => r.status !== 'Completed');

    // Sort ascending: oldest first
    currentRequests.sort((a, b) => {
      const dA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const dB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      if (dA !== dB) return dA - dB;
      return (a.requestId || '').localeCompare(b.requestId || '', undefined, { numeric: true, sensitivity: 'base' });
    });

    if (!currentRequests.length) {
      if (loadingState) loadingState.style.display = 'none';
      if (emptyState)   emptyState.style.display   = 'flex';
      return;
    }

    const priorityFilterEl = document.getElementById('priorityFilter');
    const priorityVal      = priorityFilterEl ? priorityFilterEl.value : 'all';
    filteredRequests = priorityVal === 'all'
      ? [...currentRequests]
      : currentRequests.filter(r => r.priority === priorityVal);

    currentPage = 1;
    renderTable();
    if (loadingState) loadingState.style.display = 'none';

  } catch (err) {
    console.error('❌ Error loading requests:', err);
    if (loadingState) loadingState.style.display = 'none';
    if (emptyState)   emptyState.style.display   = 'flex';
  }
}

// ════════════════════════════════════════════════════════════
// FILTERS
// ════════════════════════════════════════════════════════════
function setupFilters() {
  const priorityFilter = document.getElementById('priorityFilter');
  const searchInput    = document.getElementById('requestSearch');

  if (priorityFilter) {
    priorityFilter.addEventListener('change', () => {
      const val        = priorityFilter.value;
      filteredRequests = val === 'all'
        ? [...currentRequests]
        : currentRequests.filter(r => r.priority === val);
      currentPage = 1;
      renderTable();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q          = searchInput.value.toLowerCase();
      const priorityVal = priorityFilter ? priorityFilter.value : 'all';
      const base       = priorityVal === 'all'
        ? currentRequests
        : currentRequests.filter(r => r.priority === priorityVal);

      filteredRequests = base.filter(r => {
        const name = formatPatientName(
          r.patientFirstName || r.patientName, r.patientMiddleName, r.patientLastName
        ).toLowerCase();
        return name.includes(q) ||
          (r.requestId       || '').toLowerCase().includes(q) ||
          (r.referringDoctor || '').toLowerCase().includes(q) ||
          (Array.isArray(r.tests) ? r.tests.join(' ') : '').toLowerCase().includes(q);
      });
      currentPage = 1;
      renderTable();
    });
  }
}

// ════════════════════════════════════════════════════════════
// MODAL SETUP
// ════════════════════════════════════════════════════════════
function setupModal() {
  const closeBtn      = document.getElementById('closeRequestModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const addResultBtn  = document.getElementById('addResultBtn');
  const modal         = document.getElementById('viewRequestModal');

  if (closeBtn)      closeBtn.addEventListener('click', closeModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (addResultBtn)  addResultBtn.addEventListener('click', addLabResult);

  if (modal) {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal && modal.style.display === 'flex') closeModal();
  });
}

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 MedtechRequests initialized');
  setupFilters();
  setupModal();
  loadLabRequests();
});