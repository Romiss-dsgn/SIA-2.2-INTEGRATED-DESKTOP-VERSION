// Authentication check
(function() {
  const loggedIn = sessionStorage.getItem('loggedIn');
  const role = sessionStorage.getItem('role');
  if (loggedIn !== 'true' || role !== 'Admin') {
    window.location.href = 'emrLogin.html';
  }
})();

// Data arrays
let mockAppointmentBackups = [];
let mockAccountBackups = [];
let mockUserActivity = [];

// State Management
let currentTab = 'appointments';
const tabStates = {
  appointments: { currentPage: 1, filteredData: [] },
  accounts: { currentPage: 1, filteredData: [] },
  activity: { currentPage: 1, filteredData: [] }
};
const logsPerPage = 10;

// ==================== SESSION STORAGE FOR FILTERS ====================

function saveFilterState(tab) {
  const filters = {
    appointments: {
      search: document.getElementById('searchAppointments')?.value || '',
      scope: document.getElementById('filterAppointmentScope')?.value || 'all',
      status: document.getElementById('filterAppointmentStatus')?.value || 'all',
      period: document.getElementById('filterAppointmentPeriod')?.value || 'all'
    },
    accounts: {
      search: document.getElementById('searchAccounts')?.value || '',
      type: document.getElementById('filterAccountStatus')?.value || 'all',
      period: document.getElementById('filterAccountPeriod')?.value || 'all'
    },
    activity: {
      search: document.getElementById('searchActivity')?.value || '',
      type: document.getElementById('filterActivityRole')?.value || 'all',
      period: document.getElementById('filterActivityPeriod')?.value || 'all'
    }
  };
  
  sessionStorage.setItem('backupFilters', JSON.stringify(filters));
}

function loadFilterState() {
  const saved = sessionStorage.getItem('backupFilters');
  if (!saved) return;
  
  const filters = JSON.parse(saved);
  
  // Restore Appointments filters
  if (filters.appointments) {
    const searchInput = document.getElementById('searchAppointments');
    const scopeSelect = document.getElementById('filterAppointmentScope');
    const statusSelect = document.getElementById('filterAppointmentStatus');
    const periodSelect = document.getElementById('filterAppointmentPeriod');
    
    if (searchInput) searchInput.value = filters.appointments.search;
    if (scopeSelect) scopeSelect.value = filters.appointments.scope;
    if (statusSelect) statusSelect.value = filters.appointments.status;
    if (periodSelect) periodSelect.value = filters.appointments.period;
  }
  
  // Restore Accounts filters
  if (filters.accounts) {
    const searchInput = document.getElementById('searchAccounts');
    const typeSelect = document.getElementById('filterAccountStatus');
    const periodSelect = document.getElementById('filterAccountPeriod');
    
    if (searchInput) searchInput.value = filters.accounts.search;
    if (typeSelect) typeSelect.value = filters.accounts.type;
    if (periodSelect) periodSelect.value = filters.accounts.period;
  }
  
  // Restore Activity filters
  if (filters.activity) {
    const searchInput = document.getElementById('searchActivity');
    const typeSelect = document.getElementById('filterActivityRole');
    const periodSelect = document.getElementById('filterActivityPeriod');
    
    if (searchInput) searchInput.value = filters.activity.search;
    if (typeSelect) typeSelect.value = filters.activity.type;
    if (periodSelect) periodSelect.value = filters.activity.period;
  }
}

function applyStoredFilters(tab) {
  const saved = sessionStorage.getItem('backupFilters');
  if (!saved) return;
  
  const filters = JSON.parse(saved);
  
  if (tab === 'appointments' && filters.appointments) {
    applyAppointmentFilters(filters.appointments);
  } else if (tab === 'accounts' && filters.accounts) {
    applyAccountFilters(filters.accounts);
  } else if (tab === 'activity' && filters.activity) {
    applyActivityFilters(filters.activity);
  }
}

function applyAppointmentFilters(filters) {
  let filtered = [...mockAppointmentBackups];
  
  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(log => 
      log.details?.toLowerCase().includes(search) || 
      log.type?.toLowerCase().includes(search) ||
      log.scope?.toLowerCase().includes(search) ||
      new Date(log.date).toLocaleString().toLowerCase().includes(search)
    );
  }
  
  if (filters.scope !== 'all') {
    if (filters.scope === 'active') {
      filtered = filtered.filter(log => log.scope === 'Active Only');
    } else if (filters.scope === 'archived') {
      filtered = filtered.filter(log => log.scope === 'Archived Only');
    }
  }
  
  if (filters.status !== 'all') {
    filtered = filtered.filter(log => log.type === filters.status);
  }
  
  if (filters.period !== 'all') {
    const now = new Date();
    if (filters.period === 'today') {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.date);
        return logDate.toDateString() === now.toDateString();
      });
    } else if (filters.period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log => new Date(log.date) >= weekAgo);
    } else if (filters.period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log => new Date(log.date) >= monthAgo);
    }
  }
  
  tabStates.appointments.filteredData = filtered;
  tabStates.appointments.currentPage = 1;
}

function applyAccountFilters(filters) {
  let filtered = [...mockAccountBackups];
  
  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(log => 
      log.details?.toLowerCase().includes(search) || 
      log.category?.toLowerCase().includes(search) ||
      log.type?.toLowerCase().includes(search) ||
      new Date(log.date).toLocaleString().toLowerCase().includes(search)
    );
  }
  
  if (filters.type !== 'all') {
    filtered = filtered.filter(log => log.type === filters.type);
  }
  
  if (filters.period !== 'all') {
    const now = new Date();
    if (filters.period === 'today') {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.date);
        return logDate.toDateString() === now.toDateString();
      });
    } else if (filters.period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log => new Date(log.date) >= weekAgo);
    } else if (filters.period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log => new Date(log.date) >= monthAgo);
    }
  }
  
  tabStates.accounts.filteredData = filtered;
  tabStates.accounts.currentPage = 1;
}

function applyActivityFilters(filters) {
  let filtered = [...mockUserActivity];
  
  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(log => 
      log.details?.toLowerCase().includes(search) ||
      log.type?.toLowerCase().includes(search) ||
      log.category?.toLowerCase().includes(search) ||
      new Date(log.date).toLocaleString().toLowerCase().includes(search)
    );
  }
  
  if (filters.type !== 'all') {
    filtered = filtered.filter(log => log.type === filters.type);
  }
  
  if (filters.period !== 'all') {
    const now = new Date();
    if (filters.period === 'today') {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.date);
        return logDate.toDateString() === now.toDateString();
      });
    } else if (filters.period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log => new Date(log.date) >= weekAgo);
    } else if (filters.period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(log => new Date(log.date) >= monthAgo);
    }
  }
  
  tabStates.activity.filteredData = filtered;
  tabStates.activity.currentPage = 1;
}

// ==================== DATA LOADING ====================

async function loadBackupLogsFromServer() {
  try {
    console.log('📥 Loading backup logs from database...');
    const res = await fetch('http://localhost:5000/api/backup/logs/accounts');
    const logs = await res.json();
    
    mockAccountBackups = logs;
    tabStates.accounts.filteredData = [...logs];
    
    console.log(`✅ Loaded ${logs.length} backup logs from database`);
    
    if (currentTab === 'accounts') {
      await loadAccountStats();
      renderAccounts();
    }
  } catch (err) {
    console.error('Error loading backup logs:', err);
  }
}

async function loadAppointmentBackupLogs() {
  try {
    console.log('📥 Loading appointment backup logs from database...');
    const res = await fetch('http://localhost:5000/api/backup/logs/appointments');
    const logs = await res.json();
    
    mockAppointmentBackups = logs;
    tabStates.appointments.filteredData = [...logs];
    
    console.log(`✅ Loaded ${logs.length} appointment backup logs from database`);
    
    if (currentTab === 'appointments') {
      await loadAppointmentStats();
      renderAppointments();
    }
  } catch (err) {
    console.error('Error loading appointment backup logs:', err);
  }
}

async function loadActivityBackupLogs() {
  try {
    console.log('📥 Loading activity backup logs from database...');
    const res = await fetch('http://localhost:5000/api/backup/logs/activity');
    const logs = await res.json();
    
    mockUserActivity = logs;
    tabStates.activity.filteredData = [...logs];
    
    console.log(`✅ Loaded ${logs.length} activity backup logs from database`);
    
    if (currentTab === 'activity') {
      await loadActivityStats();
      renderActivity();
    }
  } catch (err) {
    console.error('Error loading activity backup logs:', err);
  }
}

// ==================== TAB SWITCHING ====================

function switchTab(tab) {
  currentTab = tab;
  
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  
  document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
  document.getElementById(`content-${tab}`).classList.remove('hidden');
  
  if (tab === 'appointments') {
    loadAppointmentStats();
    renderAppointments();
  } else if (tab === 'accounts') {
    loadAccountStats();
    renderAccounts();
  } else if (tab === 'activity') {
    loadActivityStats();
    renderActivity();
  }
}

// ==================== APPOINTMENTS TAB ====================

async function loadAppointmentStats() {
  try {
    const res = await fetch('http://localhost:5000/api/backup/appointments/stats');
    const stats = await res.json();
    
    document.getElementById('totalAppointmentBackups').textContent = mockAppointmentBackups.length;
    document.getElementById('successfulAppointmentBackups').textContent = 
      mockAppointmentBackups.filter(d => d.status === 'success').length;
    
    // New stats
    document.getElementById('activeAppointmentsCount').textContent = stats.totalActive;
    document.getElementById('archivedAppointmentsCount').textContent = stats.totalArchived;
    
    if (stats.lastBackup) {
      document.getElementById('lastAppointmentBackup').textContent = 
        new Date(stats.lastBackup).toLocaleString();
    }
  } catch (err) {
    console.error("Error loading appointment stats:", err);
    loadAppointmentStatsFromMock();
  }
}

function switchTab(tab) {
  currentTab = tab;
  
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  
  document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
  document.getElementById(`content-${tab}`).classList.remove('hidden');
  
  if (tab === 'appointments') {
    loadAppointmentStats();
    applyStoredFilters('appointments');
    renderAppointments();
  } else if (tab === 'accounts') {
    loadAccountStats();
    applyStoredFilters('accounts');
    renderAccounts();
  } else if (tab === 'activity') {
    loadActivityStats();
    applyStoredFilters('activity');
    renderActivity();
  }
}

function loadAppointmentStatsFromMock() {
  const data = mockAppointmentBackups;
  
  document.getElementById('totalAppointmentBackups').textContent = data.length;
  document.getElementById('successfulAppointmentBackups').textContent = 
    data.filter(d => d.status === 'success').length;
  
  // Calculate active and archived counts from the backup logs
  let totalActive = 0;
  let totalArchived = 0;
  
  data.forEach(log => {
    totalActive += log.activeCount || 0;
    totalArchived += log.archivedCount || 0;
  });
  
  document.getElementById('activeAppointmentsCount').textContent = totalActive;
  document.getElementById('archivedAppointmentsCount').textContent = totalArchived;
  
  if (data.length > 0) {
    document.getElementById('lastAppointmentBackup').textContent = 
      new Date(data[0].date).toLocaleString();
  } else {
    document.getElementById('lastAppointmentBackup').textContent = 'Never';
  }
}

function renderAppointments() {
  const tbody = document.getElementById('appointmentTableBody');
  const state = tabStates.appointments;
  const start = (state.currentPage - 1) * logsPerPage;
  const end = start + logsPerPage;
  const paginatedData = state.filteredData.slice(start, end);

  tbody.innerHTML = '';

  if (paginatedData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-6 py-8 text-center text-text-secondary-light">
          <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
          <p>No backup logs found</p>
        </td>
      </tr>`;
    return;
  }

  paginatedData.forEach(log => {
    const statusBadge = log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    const statusIcon = log.status === 'success' ? 'check_circle' : 'error';
    const typeBadge = log.type === 'Manual' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700';
    
    let scopeBadge = 'scope-full';
    if (log.scope === 'Active Only') scopeBadge = 'scope-active';
    else if (log.scope === 'Archived Only') scopeBadge = 'scope-archived';
    
    const backupId = log.id || log._id;
    
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    
    row.innerHTML = `
      <td class="px-6 py-4">
        <span class="flex items-center px-3 py-1 text-xs font-semibold rounded-full ${statusBadge} w-fit">
          <span class="material-symbols-outlined text-sm mr-1">${statusIcon}</span>
          ${log.status.charAt(0).toUpperCase() + log.status.slice(1)}
        </span>
      </td>
      <td class="px-6 py-4 text-sm">${new Date(log.date).toLocaleString()}</td>
      <td class="px-6 py-4">
        <span class="px-3 py-1 text-xs font-semibold rounded-full ${typeBadge}">${log.type}</span>
      </td>
      <td class="px-6 py-4">
        <span class="scope-badge ${scopeBadge}">${log.scope || 'Full'}</span>
      </td>
      <td class="px-6 py-4 text-sm">
        <span class="text-blue-600 font-semibold">${log.activeCount || 0}</span>
      </td>
      <td class="px-6 py-4 text-sm">
        <span class="text-purple-600 font-semibold">${log.archivedCount || 0}</span>
      </td>
      <td class="px-6 py-4 text-sm font-semibold">${log.records}</td>
      <td class="px-6 py-4 text-sm">${log.size}</td>
      <td class="px-6 py-4">
        <button class="view-btn text-[#005a32] hover:text-green-700 font-semibold text-sm flex items-center">
          <span class="material-symbols-outlined text-sm mr-1">visibility</span>
          View
        </button>
      </td>
    `;
    
    const viewBtn = row.querySelector('.view-btn');
    viewBtn.addEventListener('click', () => {
      viewAppointmentDetails(backupId);
    });
    
    tbody.appendChild(row);
  });

  updatePagination('appointments');
}

async function viewAppointmentDetails(id) {
  try {
    const res = await fetch(`http://localhost:5000/api/backup/logs/${id}`);
    
    if (!res.ok) {
      throw new Error('Backup not found');
    }
    
    const data = await res.json();
    
    document.getElementById('detailsModalLabel').textContent = 'Appointment Backup Details';
    
    const statusClass = data.status === 'success' ? 'text-green-600' : 'text-red-600';
    const statusIcon = data.status === 'success' ? 'check_circle' : 'error';
    
    let content = `
      <div class="space-y-4">
        <div class="flex items-center space-x-2 pb-4 border-b">
          <span class="material-symbols-outlined ${statusClass}">${statusIcon}</span>
          <h6 class="font-semibold ${statusClass}">${data.status.toUpperCase()}</h6>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-500">Backup ID</p>
            <p class="font-semibold">${data.backupId}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Type</p>
            <p class="font-semibold">${data.type}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Date & Time</p>
            <p class="font-semibold">${new Date(data.timestamp).toLocaleString()}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Duration</p>
            <p class="font-semibold">${data.duration}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Scope</p>
            <p class="font-semibold">${data.scope || 'Full'}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Total Records</p>
            <p class="font-semibold">${data.records.toLocaleString()}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Active Appointments</p>
            <p class="font-semibold text-[#8b5a2b]">${data.activeCount || 0}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Archived Appointments</p>
            <p class="font-semibold text-[#8b5a2b]">${data.archivedCount || 0}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">File Size</p>
            <p class="font-semibold">${data.size}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Status</p>
            <p class="font-semibold ${statusClass}">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</p>
          </div>
        </div>

        <div class="pt-4 border-t">
          <p class="text-sm text-gray-500 mb-2">Details</p>
          <p class="text-sm">${data.details}</p>
        </div>

        <div class="pt-4 border-t flex justify-end gap-3">
          <button onclick="downloadBackupAsPDF('${id}', 'appointment')" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center">
            <span class="material-symbols-outlined text-sm mr-2">picture_as_pdf</span>
            Download PDF
          </button>
          <button onclick="downloadBackup('${id}')" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center">
            <span class="material-symbols-outlined text-sm mr-2">download</span>
            Download JSON
          </button>
        </div>
      </div>`;
    
    document.getElementById('detailsContent').innerHTML = content;
    const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
    modal.show();
    
  } catch (err) {
    console.error('Error loading appointment backup details:', err);
    showErrorToast('Failed to load backup details');
  }
}

// ==================== ACCOUNTS TAB ====================

async function loadAccountStats() {
  try {
    const res = await fetch('http://localhost:5000/api/backup/accounts/stats');
    const stats = await res.json();
    
    document.getElementById('totalAccountBackups').textContent = mockAccountBackups.length;
    document.getElementById('successfulAccountBackups').textContent = mockAccountBackups.filter(d => d.status === 'success').length;
    
    if (stats.lastBackup) {
      document.getElementById('lastAccountBackup').textContent = new Date(stats.lastBackup).toLocaleString();
    } else {
      document.getElementById('lastAccountBackup').textContent = 'Never';
    }
  } catch (err) {
    console.error("Error loading account stats:", err);
    loadAccountStatsFromMock();
  }
}

function loadAccountStatsFromMock() {
  const data = mockAccountBackups;
  
  document.getElementById('totalAccountBackups').textContent = data.length;
  document.getElementById('successfulAccountBackups').textContent = data.filter(d => d.status === 'success').length;
  
  if (data.length > 0) {
    document.getElementById('lastAccountBackup').textContent = new Date(data[0].date).toLocaleString();
  } else {
    document.getElementById('lastAccountBackup').textContent = 'Never';
  }
}

function renderAccounts() {
  const tbody = document.getElementById('accountTableBody');
  const state = tabStates.accounts;
  const start = (state.currentPage - 1) * logsPerPage;
  const end = start + logsPerPage;
  const paginatedData = state.filteredData.slice(start, end);

  tbody.innerHTML = '';

  if (paginatedData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-8 text-center text-text-secondary-light">
          <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
          <p>No backup logs found</p>
        </td>
      </tr>`;
    return;
  }

  paginatedData.forEach(log => {
    const statusBadge = log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    const statusIcon = log.status === 'success' ? 'check_circle' : 'error';
    const typeBadge = log.type === 'Manual' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700';

    const backupId = log.id || log._id;
    
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    
    row.innerHTML = `
      <td class="px-6 py-4">
        <span class="flex items-center px-3 py-1 text-xs font-semibold rounded-full ${statusBadge} w-fit">
          <span class="material-symbols-outlined text-sm mr-1">${statusIcon}</span>
          ${log.status.charAt(0).toUpperCase() + log.status.slice(1)}
        </span>
      </td>
      <td class="px-6 py-4 text-sm">${new Date(log.date).toLocaleString()}</td>
      <td class="px-6 py-4">
        <span class="px-3 py-1 text-xs font-semibold rounded-full ${typeBadge}">${log.type}</span>
      </td>
      <td class="px-6 py-4 text-sm">${log.category}</td>
      <td class="px-6 py-4 text-sm">${log.records}</td>
      <td class="px-6 py-4 text-sm">${log.size}</td>
      <td class="px-6 py-4">
        <button class="view-btn text-[#005a32] hover:text-green-700 font-semibold text-sm flex items-center">
          <span class="material-symbols-outlined text-sm mr-1">visibility</span>
          View
        </button>
      </td>
    `;
    
    const viewBtn = row.querySelector('.view-btn');
    viewBtn.addEventListener('click', () => {
      viewDetails('account', backupId);
    });
    
    tbody.appendChild(row);
  });

  updatePagination('accounts');
}

async function viewDetails(type, id) {
  if (type === 'account') {
    try {
      const res = await fetch(`http://localhost:5000/api/backup/logs/${id}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error('Backup not found');
      
      document.getElementById('detailsModalLabel').textContent = 'Account Backup Details';
      
      const statusClass = data.status === 'success' ? 'text-green-600' : 'text-red-600';
      const statusIcon = data.status === 'success' ? 'check_circle' : 'error';
      
      let content = `
        <div class="space-y-4">
          <div class="flex items-center space-x-2 pb-4 border-b">
            <span class="material-symbols-outlined ${statusClass}">${statusIcon}</span>
            <h6 class="font-semibold ${statusClass}">${data.status.toUpperCase()}</h6>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-gray-500">Backup ID</p>
              <p class="font-semibold">${data.backupId}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Type</p>
              <p class="font-semibold">${data.type}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Date & Time</p>
              <p class="font-semibold">${new Date(data.timestamp).toLocaleString()}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Duration</p>
              <p class="font-semibold">${data.duration}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Category</p>
              <p class="font-semibold">${data.category}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Records Backed Up</p>
              <p class="font-semibold">${data.records.toLocaleString()}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">File Size</p>
              <p class="font-semibold">${data.size}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Status</p>
              <p class="font-semibold ${statusClass}">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</p>
            </div>
          </div>

          <div class="pt-4 border-t">
            <p class="text-sm text-gray-500 mb-2">Details</p>
            <p class="text-sm">${data.details}</p>
          </div>           

          <div class="pt-4 border-t flex justify-end gap-3">
            <button onclick="downloadBackupAsPDF('${id}', 'account')" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center">
              <span class="material-symbols-outlined text-sm mr-2">picture_as_pdf</span>
              Download PDF
            </button>
            <button onclick="downloadBackup('${id}')" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center">
              <span class="material-symbols-outlined text-sm mr-2">download</span>
              Download JSON
            </button>
          </div>
        </div>`;
      
      document.getElementById('detailsContent').innerHTML = content;
      const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
      modal.show();
      
    } catch (err) {
      console.error('Error loading account backup details:', err);
      showErrorToast('Failed to load backup details');
    }
  }
}

// ==================== ACTIVITY TAB ====================

async function loadActivityStats() {
  try {
    const res = await fetch('http://localhost:5000/api/backup/activity/stats');
    const stats = await res.json();
    
    const backupLogs = await fetch('http://localhost:5000/api/backup/logs/activity');
    const logs = await backupLogs.json();
    
    document.getElementById('todaySessions').textContent = logs.length;
    document.getElementById('activeNow').textContent = logs.filter(l => l.status === 'success').length;
    document.getElementById('totalActivityRecords').textContent = stats.totalLogs;
    
    if (logs.length > 0) {
      document.getElementById('avgSessionTime').textContent = 
        new Date(logs[0].date).toLocaleString();
    } else {
      document.getElementById('avgSessionTime').textContent = 'Never';
    }
  } catch (err) {
    console.error("Error loading activity stats:", err);
    loadActivityStatsFromMock();
  }
}

function loadActivityStatsFromMock() {
  document.getElementById('todaySessions').textContent = '0';
  document.getElementById('activeNow').textContent = '0';
  document.getElementById('totalActivityRecords').textContent = '0';
  document.getElementById('avgSessionTime').textContent = 'Never';
}

function renderActivity() {
  const tbody = document.getElementById('activityTableBody');
  const state = tabStates.activity;
  const start = (state.currentPage - 1) * logsPerPage;
  const end = start + logsPerPage;
  const paginatedData = state.filteredData.slice(start, end);

  tbody.innerHTML = '';

  if (paginatedData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-text-secondary-light">
          <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
          <p>No activity backup logs found</p>
        </td>
      </tr>`;
    return;
  }

  paginatedData.forEach(log => {
    const statusBadge = log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    const statusIcon = log.status === 'success' ? 'check_circle' : 'error';
    const typeBadge = log.type === 'Manual' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700';
    
    const backupId = log.id || log._id;
    
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    
    row.innerHTML = `
      <td class="px-6 py-4">
        <span class="flex items-center px-3 py-1 text-xs font-semibold rounded-full ${statusBadge} w-fit">
          <span class="material-symbols-outlined text-sm mr-1">${statusIcon}</span>
          ${log.status.charAt(0).toUpperCase() + log.status.slice(1)}
        </span>
      </td>
      <td class="px-6 py-4 text-sm">${new Date(log.date).toLocaleString()}</td>
      <td class="px-6 py-4">
        <span class="px-3 py-1 text-xs font-semibold rounded-full ${typeBadge}">${log.type}</span>
      </td>
      <td class="px-6 py-4 text-sm font-semibold">${log.records}</td>
      <td class="px-6 py-4 text-sm">${log.size}</td>
      <td class="px-6 py-4">
        <button class="view-btn text-[#005a32] hover:text-green-700 font-semibold text-sm flex items-center">
          <span class="material-symbols-outlined text-sm mr-1">visibility</span>
          View
        </button>
      </td>
    `;
    
    const viewBtn = row.querySelector('.view-btn');
    viewBtn.addEventListener('click', () => {
      viewActivityDetails(backupId);
    });
    
    tbody.appendChild(row);
  });

  updatePagination('activity');
}

async function viewActivityDetails(id) {
  try {
    const res = await fetch(`http://localhost:5000/api/backup/logs/${id}`);
    
    if (!res.ok) {
      throw new Error('Backup not found');
    }
    
    const data = await res.json();
    
    document.getElementById('detailsModalLabel').textContent = 'Activity Backup Details';
    
    const statusClass = data.status === 'success' ? 'text-green-600' : 'text-red-600';
    const statusIcon = data.status === 'success' ? 'check_circle' : 'error';
    
    let content = `
      <div class="space-y-4">
        <div class="flex items-center space-x-2 pb-4 border-b">
          <span class="material-symbols-outlined ${statusClass}">${statusIcon}</span>
          <h6 class="font-semibold ${statusClass}">${data.status.toUpperCase()}</h6>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-500">Backup ID</p>
            <p class="font-semibold">${data.backupId}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Type</p>
            <p class="font-semibold">${data.type}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Date & Time</p>
            <p class="font-semibold">${new Date(data.timestamp).toLocaleString()}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Duration</p>
            <p class="font-semibold">${data.duration}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Category</p>
            <p class="font-semibold">${data.category}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Total Activity Logs</p>
            <p class="font-semibold">${data.records.toLocaleString()}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">File Size</p>
            <p class="font-semibold">${data.size}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Status</p>
            <p class="font-semibold ${statusClass}">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</p>
          </div>
        </div>

        <div class="pt-4 border-t">
          <p class="text-sm text-gray-500 mb-2">Details</p>
          <p class="text-sm">${data.details}</p>
        </div>

        <div class="pt-4 border-t flex justify-end gap-3">
          <button onclick="downloadBackupAsPDF('${id}', 'activity')" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center">
            <span class="material-symbols-outlined text-sm mr-2">picture_as_pdf</span>
            Download PDF
          </button>
          <button onclick="downloadBackup('${id}')" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center">
            <span class="material-symbols-outlined text-sm mr-2">download</span>
            Download JSON
          </button>
        </div>
      </div>`;
    
    document.getElementById('detailsContent').innerHTML = content;
    const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
    modal.show();
    
  } catch (err) {
    console.error('Error loading activity backup details:', err);
    showErrorToast('Failed to load backup details');
  }
}

// ==================== PAGINATION ====================

function updatePagination(tab) {
  const state = tabStates[tab];
  const start = (state.currentPage - 1) * logsPerPage + 1;
  const end = Math.min(start + logsPerPage - 1, state.filteredData.length);
  
  const prefix = tab === 'appointments' ? 'appointment' : tab === 'accounts' ? 'account' : 'activity';
  
  document.getElementById(`${prefix}ShowingStart`).textContent = state.filteredData.length > 0 ? start : 0;
  document.getElementById(`${prefix}ShowingEnd`).textContent = end;
  document.getElementById(`${prefix}TotalLogs`).textContent = state.filteredData.length;

  document.getElementById(`${prefix}PrevBtn`).disabled = state.currentPage === 1;
  document.getElementById(`${prefix}NextBtn`).disabled = end >= state.filteredData.length;
}

function previousPage(tab) {
  const state = tabStates[tab];
  if (state.currentPage > 1) {
    state.currentPage--;
    if (tab === 'appointments') renderAppointments();
    else if (tab === 'accounts') renderAccounts();
    else if (tab === 'activity') renderActivity();
  }
}

function nextPage(tab) {
  const state = tabStates[tab];
  if (state.currentPage * logsPerPage < state.filteredData.length) {
    state.currentPage++;
    if (tab === 'appointments') renderAppointments();
    else if (tab === 'accounts') renderAccounts();
    else if (tab === 'activity') renderActivity();
  }
}

// ==================== BACKUP OPERATIONS ====================

async function triggerManualBackup(type) {
  if (type === 'appointments') {
    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    
    const scope = await showBackupScopeModal();
    if (!scope) return;
    
    btn.innerHTML = '<span class="material-symbols-outlined mr-2 animate-spin">sync</span>Processing...';
    btn.disabled = true;
    
    try {
      const res = await fetch('http://localhost:5000/api/backup/appointments/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        showSuccessToast(`✅ ${scope === 'full' ? 'Full' : scope === 'active' ? 'Active' : 'Archived'} appointment backup completed!`);
        await loadAppointmentBackupLogs();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      console.error('Backup error:', err);
      showErrorToast('❌ Backup failed: ' + err.message);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  } else if (type === 'accounts') {
    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined mr-2 animate-spin">sync</span>Processing...';
    btn.disabled = true;
    
    try {
      const res = await fetch('http://localhost:5000/api/backup/accounts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        showSuccessToast('✅ Manual backup completed successfully!');
        await loadBackupLogsFromServer();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      console.error('Backup error:', err);
      showErrorToast('❌ Backup failed: ' + err.message);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  } else if (type === 'activity') {
    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined mr-2 animate-spin">sync</span>Processing...';
    btn.disabled = true;
    
    try {
      const res = await fetch('http://localhost:5000/api/backup/activity/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        showSuccessToast('✅ Activity log backup completed successfully!');
        await loadActivityBackupLogs();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      console.error('Backup error:', err);
      showErrorToast('❌ Backup failed: ' + err.message);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }
}

function showBackupScopeModal() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow">
          <div class="modal-header text-white" style="background-color: #005a32;">
            <h5 class="modal-title">Select Backup Scope</h5>
            <button type="button" class="btn-close btn-close-white" id="closeScopeModal"></button>
          </div>
          <div class="modal-body">
            <p class="mb-3">Choose what to include in this backup:</p>
            <div class="list-group">
              <button type="button" class="list-group-item list-group-item-action scope-option" data-scope="full">
                <div class="d-flex w-100 justify-content-between">
                  <h6 class="mb-1">Full Backup</h6>
                  <span class="badge bg-purple-600">Recommended</span>
                </div>
                <p class="mb-1 text-sm">Includes all active and archived appointments</p>
              </button>
              <button type="button" class="list-group-item list-group-item-action scope-option" data-scope="active">
                <h6 class="mb-1">Active Appointments Only</h6>
                <p class="mb-1 text-sm">Upcoming and Ongoing appointments</p>
              </button>
              <button type="button" class="list-group-item list-group-item-action scope-option" data-scope="archived">
                <h6 class="mb-1">Archived Appointments Only</h6>
                <p class="mb-1 text-sm">Completed and Canceled appointments</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelectorAll('.scope-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const scope = btn.getAttribute('data-scope');
        document.body.removeChild(modal);
        resolve(scope);
      });
    });
    
    modal.querySelector('#closeScopeModal').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(null);
    });
  });
}

// ==================== PDF GENERATION ====================


// COMPLETE REPLACEMENT for the downloadBackupAsPDF function
// Replace the entire function starting from line ~890 to ~1150

async function downloadBackupAsPDF(id, type) {
  try {
    const res = await fetch(`http://localhost:5000/api/backup/logs/${id}`);
    
    if (!res.ok) {
      throw new Error('Backup not found');
    }
    
    const data = await res.json();
    
    // Fetch the actual backup data
    const backupRes = await fetch(`http://localhost:5000/api/backup/download/${id}`);
    const backupData = await backupRes.json();
    
    console.log('Backup data structure:', backupData); // Debug log
    
    // Create PDF content
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(53, 143, 133);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('Well Served', 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`${type.charAt(0).toUpperCase() + type.slice(1)} Backup Report`, 105, 28, { align: 'center' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Content
    let yPos = 50;
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Backup Details', 20, yPos);
    yPos += 10;
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    const details = [
      ['Backup ID:', data.backupId],
      ['Type:', data.type],
      ['Date & Time:', new Date(data.timestamp).toLocaleString()],
      ['Duration:', data.duration],
      ['Status:', data.status.toUpperCase()],
      ['Records Backed Up:', data.records.toLocaleString()],
      ['File Size:', data.size]
    ];
    
    // Add type-specific details
    if (type === 'appointment') {
      details.push(
        ['Scope:', data.scope || 'Full'],
        ['Active Appointments:', (data.activeCount || 0).toString()],
        ['Archived Appointments:', (data.archivedCount || 0).toString()]
      );
    } else if (type === 'account') {
      details.push(['Category:', data.category]);
    } else if (type === 'activity') {
      details.push(['Category:', data.category]);
    }
    
    details.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label, 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(value, 70, yPos);
      yPos += 7;
    });
    
    yPos += 10;
    doc.setFont(undefined, 'bold');
    doc.text('Details:', 20, yPos);
    yPos += 7;
    doc.setFont(undefined, 'normal');
    
    const splitDetails = doc.splitTextToSize(data.details, 170);
    doc.text(splitDetails, 20, yPos);
    yPos += splitDetails.length * 5 + 15;
    
    // Add backup contents based on type
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Backup Contents', 20, yPos);
    yPos += 10;
    doc.setFontSize(9);
    
    if (type === 'appointment') {
      // FIXED: Check all possible data structures for appointments
      let appointments = [];
      
      // Try different possible structures
      if (Array.isArray(backupData)) {
        // Data is directly an array
        appointments = backupData;
      } else if (backupData.data && Array.isArray(backupData.data)) {
        // Data is nested in data property as array
        appointments = backupData.data;
      } else if (backupData.appointments && Array.isArray(backupData.appointments)) {
        // Data is in appointments property
        appointments = backupData.appointments;
      } else if (backupData.data && backupData.data.appointments) {
        // Data is nested in data.appointments
        appointments = backupData.data.appointments;
      } else if (backupData.data && backupData.data.activeAppointments && backupData.data.archivedAppointments) {
        // FIXED: Combine active and archived appointments
        appointments = [...backupData.data.activeAppointments, ...backupData.data.archivedAppointments];
      } else if (backupData.data && backupData.data.activeAppointments) {
        // Only active appointments
        appointments = backupData.data.activeAppointments;
      } else if (backupData.data && backupData.data.archivedAppointments) {
        // Only archived appointments
        appointments = backupData.data.archivedAppointments;
      }
      
      console.log('Found appointments:', appointments.length); // Debug log
      
      if (appointments && appointments.length > 0) {
        // Table header
        doc.setFont(undefined, 'bold');
        doc.setFillColor(53, 143, 133);
        doc.rect(15, yPos - 5, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('ID', 17, yPos);
        doc.text('Patient', 40, yPos);
        doc.text('Doctor', 80, yPos);
        doc.text('Date', 120, yPos);
        doc.text('Status', 155, yPos);
        yPos += 10;
        
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        
        // Table rows
        let rowCount = 0;
        
        appointments.slice(0, 50).forEach((apt, index) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
            rowCount = 0;
            
            // Repeat header on new page
            doc.setFont(undefined, 'bold');
            doc.setFillColor(53, 143, 133);
            doc.rect(15, yPos - 5, 180, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text('ID', 17, yPos);
            doc.text('Patient', 40, yPos);
            doc.text('Doctor', 80, yPos);
            doc.text('Date', 120, yPos);
            doc.text('Status', 155, yPos);
            yPos += 10;
            
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');
          }
          
          // Alternate row colors
          if (rowCount % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(15, yPos - 5, 180, 7, 'F');
          }
          
          const aptId = apt.appointmentId || apt.id || apt._id || 'N/A';
const patient = apt.patientName || `${apt.patientFirstName || ''} ${apt.patientLastName || ''}`.trim() || 'N/A';
const doctor = apt.doctorName || `${apt.doctorFirstName || ''} ${apt.doctorLastName || ''}`.trim() || 'N/A';

// FIXED: Check multiple possible date field names
const dateField = apt.appointmentDate || apt.date || apt.appointmentdate || apt.scheduled_date || apt.scheduledDate;
const date = dateField ? new Date(dateField).toLocaleDateString() : 'N/A';

const status = apt.appointmentStatus || apt.status || 'N/A';
          
          doc.text(aptId.toString().substring(0, 10), 17, yPos);
          doc.text(patient.substring(0, 18), 40, yPos);
          doc.text(doctor.substring(0, 18), 80, yPos);
          doc.text(date, 120, yPos);
          doc.text(status.substring(0, 12), 155, yPos);
          
          yPos += 7;
          rowCount++;
        });
        
        if (appointments.length > 50) {
          yPos += 5;
          doc.setFont(undefined, 'italic');
          doc.text(`... and ${appointments.length - 50} more appointments`, 20, yPos);
        }
      } else {
        doc.setFont(undefined, 'italic');
        doc.text('No appointment data available in backup', 20, yPos);
      }
      
    } else if (type === 'account') {
      // FIXED: Check for users data with all possible structures
      let users = [];
      if (Array.isArray(backupData)) {
        users = backupData;
      } else if (backupData.data && Array.isArray(backupData.data)) {
        users = backupData.data;
      } else if (backupData.users && Array.isArray(backupData.users)) {
        users = backupData.users;
      } else if (backupData.data && backupData.data.users) {
        users = backupData.data.users;
      }
      
      console.log('Found users:', users.length); // Debug log
      
      // Users table
      if (users && users.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('Users', 20, yPos);
        yPos += 7;
        
        // Table header
        doc.setFillColor(53, 143, 133);
        doc.rect(15, yPos - 5, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('ID', 17, yPos);
        doc.text('Name', 45, yPos);
        doc.text('Email', 95, yPos);
        doc.text('Role', 150, yPos);
        doc.text('Status', 175, yPos);
        yPos += 10;
        
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        
        let rowCount = 0;
        users.slice(0, 30).forEach((user) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
            rowCount = 0;
            
            // Repeat header
            doc.setFont(undefined, 'bold');
            doc.setFillColor(53, 143, 133);
            doc.rect(15, yPos - 5, 180, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text('ID', 17, yPos);
            doc.text('Name', 45, yPos);
            doc.text('Email', 95, yPos);
            doc.text('Role', 150, yPos);
            doc.text('Status', 175, yPos);
            yPos += 10;
            
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');
          }
          
          if (rowCount % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(15, yPos - 5, 180, 7, 'F');
          }
          
          const userId = user.userId || user.id || user._id || 'N/A';
          const name = user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'N/A';
          const email = user.email || 'N/A';
          const role = user.role || 'N/A';
          const status = user.accountStatus || user.status || 'Active';
          
          doc.text(userId.toString().substring(0, 10), 17, yPos);
          doc.text(name.substring(0, 22), 45, yPos);
          doc.text(email.substring(0, 24), 95, yPos);
          doc.text(role.substring(0, 10), 150, yPos);
          doc.text(status.substring(0, 8), 175, yPos);
          
          yPos += 7;
          rowCount++;
        });
        
        if (users.length > 30) {
          yPos += 5;
          doc.setFont(undefined, 'italic');
          doc.text(`... and ${users.length - 30} more users`, 20, yPos);
        }
        
        yPos += 15;
      }
      
      // FIXED: Check for patients data with all possible structures
      let patients = [];
      if (Array.isArray(backupData)) {
        patients = backupData;
      } else if (backupData.data && Array.isArray(backupData.data)) {
        patients = backupData.data;
      } else if (backupData.patients && Array.isArray(backupData.patients)) {
        patients = backupData.patients;
      } else if (backupData.data && backupData.data.patients) {
        patients = backupData.data.patients;
      }
      
      console.log('Found patients:', patients.length); // Debug log
      
      // Patients table
      if (patients && patients.length > 0) {
        if (yPos > 200) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFont(undefined, 'bold');
        doc.text('Patients', 20, yPos);
        yPos += 7;
        
        // FIXED: Changed Age to Date of Birth in header
        doc.setFillColor(53, 143, 133);
        doc.rect(15, yPos - 5, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('ID', 17, yPos);
        doc.text('Name', 40, yPos);
        doc.text('Date of Birth', 90, yPos);
        doc.text('Gender', 140, yPos);
        doc.text('Contact', 170, yPos);
        yPos += 10;
        
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        
        let rowCount = 0;
        patients.slice(0, 30).forEach((patient) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
            rowCount = 0;
            
            // FIXED: Repeat header with Date of Birth
            doc.setFont(undefined, 'bold');
            doc.setFillColor(53, 143, 133);
            doc.rect(15, yPos - 5, 180, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text('ID', 17, yPos);
            doc.text('Name', 40, yPos);
            doc.text('Date of Birth', 90, yPos);
            doc.text('Gender', 140, yPos);
            doc.text('Contact', 170, yPos);
            yPos += 10;
            
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');
          }
          
          if (rowCount % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(15, yPos - 5, 180, 7, 'F');
          }
          
          // FIXED: Properly extract patient name from firstName and lastName
          const patientId = patient.patientId || patient.id || patient._id || 'N/A';
          const firstName = patient.firstName || patient.firstname || patient.patientFirstName || '';
          const lastName = patient.lastName || patient.lastname || patient.patientLastName || '';
          const name = patient.patientName || (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName) || patient.name || 'N/A';
          
          // FIXED: Get date of birth and format it
          const dob = patient.dateOfBirth || patient.dob || patient.birthDate || 'N/A';
          const formattedDob = dob !== 'N/A' ? new Date(dob).toLocaleDateString() : 'N/A';
          
          const gender = patient.gender || 'N/A';
          const contact = patient.contactNumber || patient.contact || patient.phone || 'N/A';
          
          doc.text(patientId.toString().substring(0, 8), 17, yPos);
          doc.text(name.substring(0, 20), 40, yPos);
          doc.text(formattedDob, 90, yPos);
          doc.text(gender.substring(0, 6), 140, yPos);
          doc.text(contact.substring(0, 15), 170, yPos);
          
          yPos += 7;
          rowCount++;
        });
        
        if (patients.length > 30) {
          yPos += 5;
          doc.setFont(undefined, 'italic');
          doc.text(`... and ${patients.length - 30} more patients`, 20, yPos);
        }
      }
      
      if ((!users || users.length === 0) && (!patients || patients.length === 0)) {
        doc.setFont(undefined, 'italic');
        doc.text('No account data available in backup', 20, yPos);
      }
      
    } else if (type === 'activity') {
      // FIXED: Check for activity logs data with all possible structures
      let logs = [];
      if (Array.isArray(backupData)) {
        logs = backupData;
      } else if (backupData.data && Array.isArray(backupData.data)) {
        logs = backupData.data;
      } else if (backupData.activityLogs && Array.isArray(backupData.activityLogs)) {
        logs = backupData.activityLogs;
      } else if (backupData.data && backupData.data.activityLogs) {
        logs = backupData.data.activityLogs;
      }
      
      console.log('Found activity logs:', logs.length); // Debug log
      
      if (logs && logs.length > 0) {
        // Table header
        doc.setFont(undefined, 'bold');
        doc.setFillColor(53, 143, 133);
        doc.rect(15, yPos - 5, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('User', 17, yPos);
        doc.text('Role', 65, yPos);
        doc.text('Action', 95, yPos);
        doc.text('Date/Time', 145, yPos);
        yPos += 10;
        
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        
        let rowCount = 0;
        logs.slice(0, 40).forEach((log) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
            rowCount = 0;
            
            // Repeat header
            doc.setFont(undefined, 'bold');
            doc.setFillColor(53, 143, 133);
            doc.rect(15, yPos - 5, 180, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text('User', 17, yPos);
            doc.text('Role', 65, yPos);
            doc.text('Action', 95, yPos);
            doc.text('Date/Time', 145, yPos);
            yPos += 10;
            
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');
          }
          
          if (rowCount % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(15, yPos - 5, 180, 7, 'F');
          }
          
          const user = log.username || log.userName || log.user || 'N/A';
          const role = log.role || log.userRole || 'N/A';
          const action = log.action || log.activity || 'N/A';
          const datetime = log.timestamp || log.date || log.createdAt;
          const formattedDate = datetime ? new Date(datetime).toLocaleString().substring(0, 20) : 'N/A';
          
          doc.text(user.substring(0, 20), 17, yPos);
          doc.text(role.substring(0, 12), 65, yPos);
          doc.text(action.substring(0, 22), 95, yPos);
          doc.text(formattedDate, 145, yPos);
          
          yPos += 7;
          rowCount++;
        });
        
        if (logs.length > 40) {
          yPos += 5;
          doc.setFont(undefined, 'italic');
          doc.text(`... and ${logs.length - 40} more activity logs`, 20, yPos);
        }
      } else {
        doc.setFont(undefined, 'italic');
        doc.text('No activity data available in backup', 20, yPos);
      }
    }
    
    // Footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
        105,
        290,
        { align: 'center' }
      );
    }
    
    // Save PDF
    doc.save(`backup_${data.backupId}_${new Date(data.timestamp).toISOString().split('T')[0]}.pdf`);
    
    showSuccessToast('✅ PDF downloaded successfully!');
  } catch (err) {
    console.error('PDF download error:', err);
    showErrorToast('❌ Failed to download PDF: ' + err.message);
  }
}

async function downloadBackup(id) {
  try {
    const res = await fetch(`http://localhost:5000/api/backup/download/${id}`);
    
    if (!res.ok) throw new Error('Download failed');
    
    const data = await res.json();
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${data.backupId}_${new Date(data.timestamp).toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showSuccessToast('✅ Backup downloaded successfully!');
  } catch (err) {
    console.error('Download error:', err);
    showErrorToast('❌ Failed to download backup');
  }
}

// ==================== FILTERS ====================

document.getElementById('searchAppointments')?.addEventListener('input', (e) => {
  const search = e.target.value.toLowerCase();
  tabStates.appointments.filteredData = mockAppointmentBackups.filter(log => 
    log.details?.toLowerCase().includes(search) || 
    log.type?.toLowerCase().includes(search) ||
    log.scope?.toLowerCase().includes(search) ||
    new Date(log.date).toLocaleString().toLowerCase().includes(search)
  );
  tabStates.appointments.currentPage = 1;
  renderAppointments();
  saveFilterState('appointments');
});

document.getElementById('filterAppointmentScope')?.addEventListener('change', (e) => {
  const scope = e.target.value;
  let filtered = [...mockAppointmentBackups];
  
  if (scope === 'active') {
    filtered = filtered.filter(log => log.scope === 'Active Only');
  } else if (scope === 'archived') {
    filtered = filtered.filter(log => log.scope === 'Archived Only');
  } else if (scope !== 'all') {
    filtered = filtered.filter(log => log.scope === 'Full' || !log.scope);
  }
  
  tabStates.appointments.filteredData = filtered;
  tabStates.appointments.currentPage = 1;
  renderAppointments();
  saveFilterState('appointments');
});

document.getElementById('filterAppointmentStatus')?.addEventListener('change', (e) => {
  const type = e.target.value;
  tabStates.appointments.filteredData = type === 'all' ? [...mockAppointmentBackups] : mockAppointmentBackups.filter(log => log.type === type);
  tabStates.appointments.currentPage = 1;
  renderAppointments();
  saveFilterState('appointments');
});

document.getElementById('filterAppointmentPeriod')?.addEventListener('change', (e) => {
  const period = e.target.value;
  const now = new Date();
  let filtered = [...mockAppointmentBackups];
  
  if (period === 'today') {
    filtered = filtered.filter(log => {
      const logDate = new Date(log.date);
      return logDate.toDateString() === now.toDateString();
    });
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(log => new Date(log.date) >= weekAgo);
  } else if (period === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(log => new Date(log.date) >= monthAgo);
  }
  
  tabStates.appointments.filteredData = filtered;
  tabStates.appointments.currentPage = 1;
  renderAppointments();
  saveFilterState('appointments');
});

document.getElementById('searchAccounts')?.addEventListener('input', (e) => {
  const search = e.target.value.toLowerCase();
  tabStates.accounts.filteredData = mockAccountBackups.filter(log => 
    log.details?.toLowerCase().includes(search) || 
    log.category?.toLowerCase().includes(search) ||
    log.type?.toLowerCase().includes(search) ||
    new Date(log.date).toLocaleString().toLowerCase().includes(search)
  );
  tabStates.accounts.currentPage = 1;
  renderAccounts();
  saveFilterState('accounts');
});

document.getElementById('filterAccountStatus')?.addEventListener('change', (e) => {
  const type = e.target.value;
  tabStates.accounts.filteredData = type === 'all' ? [...mockAccountBackups] : mockAccountBackups.filter(log => log.type === type);
  tabStates.accounts.currentPage = 1;
  renderAccounts();
  saveFilterState('accounts');
});

document.getElementById('filterAccountPeriod')?.addEventListener('change', (e) => {
  const period = e.target.value;
  const now = new Date();
  let filtered = [...mockAccountBackups];
  
  if (period === 'today') {
    filtered = filtered.filter(log => {
      const logDate = new Date(log.date);
      return logDate.toDateString() === now.toDateString();
    });
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(log => new Date(log.date) >= weekAgo);
  } else if (period === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(log => new Date(log.date) >= monthAgo);
  }
  
  tabStates.accounts.filteredData = filtered;
  tabStates.accounts.currentPage = 1;
  renderAccounts();
  saveFilterState('accounts');
});


document.getElementById('searchActivity')?.addEventListener('input', (e) => {
  const search = e.target.value.toLowerCase();
  tabStates.activity.filteredData = mockUserActivity.filter(log => 
    log.details?.toLowerCase().includes(search) ||
    log.type?.toLowerCase().includes(search) ||
    log.category?.toLowerCase().includes(search) ||
    new Date(log.date).toLocaleString().toLowerCase().includes(search)
  );
  tabStates.activity.currentPage = 1;
  renderActivity();
  saveFilterState('activity');
});

document.getElementById('filterActivityRole')?.addEventListener('change', (e) => {
  const type = e.target.value;
  tabStates.activity.filteredData = type === 'all' ? [...mockUserActivity] : mockUserActivity.filter(log => log.type === type);
  tabStates.activity.currentPage = 1;
  renderActivity();
  saveFilterState('activity');
});

document.getElementById('filterActivityPeriod')?.addEventListener('change', (e) => {
  const period = e.target.value;
  const now = new Date();
  let filtered = [...mockUserActivity];
  
  if (period === 'today') {
    filtered = filtered.filter(log => {
      const logDate = new Date(log.date);
      return logDate.toDateString() === now.toDateString();
    });
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(log => new Date(log.date) >= weekAgo);
  } else if (period === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(log => new Date(log.date) >= monthAgo);
  }
  
  tabStates.activity.filteredData = filtered;
  tabStates.activity.currentPage = 1;
  renderActivity();
  saveFilterState('activity');
});

// ==================== UI HELPERS ====================

function showErrorToast(message) {
  const toastContainer = document.createElement('div');
  toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
  toastContainer.style.zIndex = '11';
  
  toastContainer.innerHTML = `
    <div class="toast show" role="alert">
      <div class="toast-header text-white bg-danger">
        <span class="material-symbols-outlined me-2 text-sm">error</span>
        <strong class="me-auto">Error</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    </div>`;
  
  document.body.appendChild(toastContainer);
  
  setTimeout(() => {
    toastContainer.remove();
  }, 4000);
}

function showSuccessToast(message) {
  const toastContainer = document.createElement('div');
  toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
  toastContainer.style.zIndex = '11';
  
  toastContainer.innerHTML = `
    <div class="toast show" role="alert">
      <div class="toast-header text-white" style="background-color: #005a32;">
        <span class="material-symbols-outlined me-2 text-sm">check_circle</span>
        <strong class="me-auto">Success</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    </div>`;
  
  document.body.appendChild(toastContainer);
  
  setTimeout(() => {
    toastContainer.remove();
  }, 3000);
}

function showLogoutModal() {
  const modal = new bootstrap.Modal(document.getElementById('logoutModal'));
  modal.show();
}

async function confirmLogout() {
  try {
    const sessionLogId = sessionStorage.getItem('sessionLogId');
    
    if (sessionLogId) {
      await fetch('http://localhost:5000/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionLogId })
      });
    }
  } catch (err) {
    console.error('Error logging logout:', err);
  } finally {
    sessionStorage.clear();
    window.location.href = '../emrLogin.html';
  }
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
  await loadBackupLogsFromServer();
  await loadAppointmentBackupLogs();
  await loadActivityBackupLogs();
  
  // Restore filter states from session
  loadFilterState();
  
  if (currentTab === 'appointments') {
    await loadAppointmentStats();
    applyStoredFilters('appointments');
    renderAppointments();
  } else if (currentTab === 'accounts') {
    await loadAccountStats();
    applyStoredFilters('accounts');
    renderAccounts();
  } else if (currentTab === 'activity') {
    await loadActivityStats();
    applyStoredFilters('activity');
    renderActivity();
  }
});

// Auto-refresh every 5 seconds
setInterval(async () => {
  try {
    if (currentTab === 'accounts') {
      const res = await fetch('http://localhost:5000/api/backup/logs/accounts');
      const logs = await res.json();
      
      mockAccountBackups = logs;
      
      // Reapply stored filters instead of just copying all logs
      applyStoredFilters('accounts');
      
      await loadAccountStats();
      renderAccounts();
    } else if (currentTab === 'appointments') {
      const res = await fetch('http://localhost:5000/api/backup/logs/appointments');
      const logs = await res.json();
      
      mockAppointmentBackups = logs;
      
      // Reapply stored filters instead of just copying all logs
      applyStoredFilters('appointments');
      
      await loadAppointmentStats();
      renderAppointments();
    } else if (currentTab === 'activity') {
      const res = await fetch('http://localhost:5000/api/backup/logs/activity');
      const logs = await res.json();
      
      mockUserActivity = logs;
      
      // Reapply stored filters instead of just copying all logs
      applyStoredFilters('activity');
      
      await loadActivityStats();
      renderActivity();
    }
  } catch (err) {
    console.error('❌ Auto-refresh error:', err);
  }
}, 1000) 