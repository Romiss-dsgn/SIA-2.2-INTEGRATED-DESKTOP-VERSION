// medtech_history.js - Results History for Medtech

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let currentHistory  = [];
let filteredHistory = [];
let currentPage     = 1;
const rowsPerPage   = 10;
let currentViewData = null;

// ════════════════════════════════════════════════════════════
// RENDER TABLE
// ════════════════════════════════════════════════════════════
function renderTable() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  const start       = (currentPage - 1) * rowsPerPage;
  const end         = start + rowsPerPage;
  const pageHistory = filteredHistory.slice(start, end);

  if (pageHistory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-slate-400">
      <span class="material-symbols-outlined text-6xl block mb-4 opacity-50">history</span>
      No completed results found
    </td></tr>`;
    updatePagination();
    return;
  }

  tbody.innerHTML = pageHistory.map((hist, idx) => {
    const completedDate = hist.completedAt
      ? new Date(hist.completedAt).toLocaleDateString('en-PH')
      : (hist.submittedAt ? new Date(hist.submittedAt).toLocaleDateString('en-PH') : '—');

    const testType = (Array.isArray(hist.tests) && hist.tests.length > 0)
      ? hist.tests[0]
      : 'Lab Test';

    return `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
      <td class="font-mono font-semibold text-sm text-primary">${escapeHtml(hist.requestId)}</td>
      <td class="font-semibold">${escapeHtml(hist.patientName)}</td>
      <td>${escapeHtml(testType)}</td>
      <td class="text-sm text-slate-500">${completedDate}</td>
      <td>${escapeHtml(hist.referringDoctor || hist.submittedBy || '—')}</td>
      <td class="text-center">
        <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
          <span class="material-symbols-outlined text-xs">check_circle</span>
          Completed
        </span>
      </td>
      <td class="text-center">
        <button onclick="viewHistoryByIndex(${start + idx})"
           class="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all">
          <span class="material-symbols-outlined text-xs">visibility</span>
          View
        </button>
      </td>
    </tr>`;
  }).join('');

  updatePagination();
}

function updatePagination() {
  const totalPages   = Math.max(1, Math.ceil(filteredHistory.length / rowsPerPage));
  const pageInfo     = document.getElementById('pageInfo');
  const prevBtn      = document.getElementById('prevBtn');
  const nextBtn      = document.getElementById('nextBtn');
  const tableShowing = document.getElementById('tableShowing');

  if (pageInfo)     pageInfo.textContent = `${currentPage} of ${totalPages}`;
  if (prevBtn)      prevBtn.disabled     = currentPage <= 1;
  if (nextBtn)      nextBtn.disabled     = currentPage >= totalPages;
  if (tableShowing) {
    const from = filteredHistory.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const to   = Math.min(currentPage * rowsPerPage, filteredHistory.length);
    tableShowing.textContent = `Showing ${from}–${to} of ${currentHistory.length}`;
  }
}

function changePage(delta) {
  const totalPages = Math.ceil(filteredHistory.length / rowsPerPage);
  currentPage = Math.max(1, Math.min(totalPages, currentPage + delta));
  renderTable();
}

// ════════════════════════════════════════════════════════════
// VIEW HISTORY MODAL
// ════════════════════════════════════════════════════════════
function viewHistoryByIndex(index) {
  if (!filteredHistory[index]) { alert('History data not found'); return; }
  currentViewData = filteredHistory[index];
  populateHistoryModal(currentViewData);
  showHistoryModal();
}

function populateHistoryModal(hist) {
  const modalHistoryId = document.getElementById('modalHistoryId');
  if (modalHistoryId) modalHistoryId.textContent = `Request ID: ${hist.requestId || 'N/A'}`;

  const completedDate = hist.completedAt
    ? new Date(hist.completedAt).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })
    : (hist.submittedAt ? new Date(hist.submittedAt).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' }) : 'N/A');

  const modalHistoryInfo = document.getElementById('modalHistoryInfo');
  if (modalHistoryInfo) {
    modalHistoryInfo.innerHTML = `
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Patient Name</div>
        <div class="modal-value">${escapeHtml(hist.patientName || 'N/A')}</div>
      </div>
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Request ID</div>
        <div class="modal-value">${escapeHtml(hist.requestId || 'N/A')}</div>
      </div>
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Doctor</div>
        <div class="modal-value">${escapeHtml(hist.referringDoctor || hist.submittedBy || 'N/A')}</div>
      </div>
      <div>
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Completed Date</div>
        <div class="modal-value">${completedDate}</div>
      </div>
      <div class="md:col-span-2">
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Completed By</div>
        <div class="modal-value text-xs">${escapeHtml(hist.completedBy || sessionStorage.getItem('name') || 'Medical Technologist')}</div>
      </div>`;
  }

  const modalHistoryTests = document.getElementById('modalHistoryTests');
  if (modalHistoryTests) {
    const tests = Array.isArray(hist.tests) ? hist.tests : [];
    modalHistoryTests.innerHTML = tests.length === 0
      ? `<div class="text-center py-6 text-slate-400">
           <span class="material-symbols-outlined text-3xl block mb-2 opacity-50">science</span>
           <p class="text-sm">No tests recorded</p>
         </div>`
      : `<div class="space-y-3">
           ${tests.map(t => `
             <div class="modal-lab-item checked">
               <div class="modal-readonly-checkbox"></div>
               <label>${escapeHtml(t)}</label>
             </div>`).join('')}
         </div>`;
  }
}

function showHistoryModal() {
  const modal = document.getElementById('viewHistoryModal');
  if (modal) { modal.style.display = 'flex'; modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}

function closeHistoryModal() {
  const modal = document.getElementById('viewHistoryModal');
  if (modal) { modal.style.display = 'none'; modal.classList.add('hidden'); document.body.style.overflow = ''; }
  currentViewData = null;
}

// ════════════════════════════════════════════════════════════
// LOAD HISTORY — ✅ Fixed render/loading order
// ════════════════════════════════════════════════════════════
async function loadHistory() {
  console.log('🔄 Loading results history...');

  const loadingState    = document.getElementById('loadingState');
  const emptyState      = document.getElementById('emptyState');
  const container       = document.getElementById('historyContainer');
  const totalCompletedEl = document.getElementById('totalCompleted');

  // Show loading, hide everything else
  if (loadingState) loadingState.style.display = 'flex';
  if (emptyState)   emptyState.classList.add('hidden');

  // Build table scaffold once
  if (container && !document.getElementById('historyTableBody')) {
    container.innerHTML = `
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <th class="px-6 py-4 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider">Request ID</th>
            <th class="px-6 py-4 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider">Patient</th>
            <th class="px-6 py-4 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider">Test Type</th>
            <th class="px-6 py-4 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider">Completed Date</th>
            <th class="px-6 py-4 text-left text-xs font-extrabold text-slate-500 uppercase tracking-wider">Doctor</th>
            <th class="px-6 py-4 text-center text-xs font-extrabold text-slate-500 uppercase tracking-wider">Status</th>
            <th class="px-6 py-4 text-center text-xs font-extrabold text-slate-500 uppercase tracking-wider">Action</th>
          </tr>
        </thead>
        <tbody id="historyTableBody" class="divide-y divide-slate-100 dark:divide-slate-700"></tbody>
      </table>`;
  }

  try {
    const res = await fetch('http://localhost:5000/api/request-forms');
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data       = await res.json();
    const allRequests = Array.isArray(data) ? data : (data.requests || data.data || []);

    console.log('📦 All requests from server:', allRequests.length);
    console.log('📊 Status breakdown:', allRequests.reduce((acc, r) => {
      acc[r.status || 'undefined'] = (acc[r.status || 'undefined'] || 0) + 1;
      return acc;
    }, {}));

    // ✅ Filter only Completed
    currentHistory = allRequests.filter(r => r.status === 'Completed');
    console.log(`✅ Completed: ${currentHistory.length} of ${allRequests.length}`);

    // ✅ Hide loading FIRST before rendering
    if (loadingState) loadingState.style.display = 'none';

    if (currentHistory.length === 0) {
      if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyState.style.display = 'flex';
      }
      if (totalCompletedEl) totalCompletedEl.textContent = '0';
      return;
    }

    // ✅ Update counter
    if (totalCompletedEl) totalCompletedEl.textContent = currentHistory.length;

    // ✅ Apply filters then render (applyFilters calls renderTable internally)
    applyFilters();

  } catch (err) {
    console.error('❌ Error loading history:', err);
    if (loadingState) loadingState.style.display = 'none';
    if (emptyState)   { emptyState.classList.remove('hidden'); emptyState.style.display = 'flex'; }
  }
}

// ════════════════════════════════════════════════════════════
// FILTERS
// ════════════════════════════════════════════════════════════
function applyFilters() {
  const searchInput = document.getElementById('historySearch');
  const dateFilter  = document.getElementById('dateFilter');

  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  const dateValue  = dateFilter  ? dateFilter.value : 'all';

  let filtered = [...currentHistory];

  if (searchTerm) {
    filtered = filtered.filter(h =>
      (h.patientName     || '').toLowerCase().includes(searchTerm) ||
      (h.requestId       || '').toLowerCase().includes(searchTerm) ||
      (h.referringDoctor || '').toLowerCase().includes(searchTerm)
    );
  }

  if (dateValue !== 'all') {
    const now = new Date();
    filtered = filtered.filter(h => {
      const d = h.completedAt ? new Date(h.completedAt) : new Date(h.submittedAt);
      switch (dateValue) {
        case 'today':  return d.toDateString() === now.toDateString();
        case 'week':   return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case 'month':  return d >= new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        default:       return true;
      }
    });
  }

  filteredHistory = filtered;
  currentPage     = 1;
  renderTable();
}

function setupFilters() {
  document.getElementById('historySearch')?.addEventListener('input',  applyFilters);
  document.getElementById('dateFilter')?.addEventListener('change', applyFilters);
}

// ════════════════════════════════════════════════════════════
// VIEW FULL RESULT
// ════════════════════════════════════════════════════════════
function viewFullResult() {
  if (!currentViewData) { alert('No result data available'); return; }
  const patientId = currentViewData.patientID || currentViewData.patientId || '';
  if (!patientId) { alert('No patient ID found for this result.'); return; }
  window.location.href = `LabResults.html?patientId=${patientId}`;
}

// ════════════════════════════════════════════════════════════
// MODAL SETUP
// ════════════════════════════════════════════════════════════
function setupModal() {
  document.getElementById('closeHistoryModal')?.addEventListener('click',    closeHistoryModal);
  document.getElementById('closeHistoryModalBtn')?.addEventListener('click', closeHistoryModal);
  document.getElementById('viewResultDetailsBtn')?.addEventListener('click', viewFullResult);

  const modal = document.getElementById('viewHistoryModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeHistoryModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal && modal.style.display === 'flex') closeHistoryModal();
  });
}

// ════════════════════════════════════════════════════════════
// NOTIFICATION BELL
// ════════════════════════════════════════════════════════════
function setupNotificationBell() {
  const bell     = document.getElementById('notificationBell');
  const dropdown = document.getElementById('notificationDropdown');
  if (!bell || !dropdown) return;
  bell.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const show = dropdown.style.display !== 'flex';
    dropdown.style.display = show ? 'flex' : 'none';
    if (show && typeof loadNotifications === 'function') loadNotifications();
  });
  document.addEventListener('click', e => {
    if (!bell.contains(e.target) && !dropdown.contains(e.target))
      dropdown.style.display = 'none';
  });
}

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 MedtechHistory initialized');
  setupFilters();
  setupModal();
  setupNotificationBell();
  loadHistory();
  setInterval(loadHistory, 30000);
});