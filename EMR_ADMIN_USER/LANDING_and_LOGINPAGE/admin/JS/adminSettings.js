// ========== API KEYS ==========
const API_KEYS = {
    billing: "BILLING_API_KEY_12345ABCDEF",
    pharmacy: "PHARMACY_API_KEY_67890GHIJK"
};

// ========== SESSION CHECK ==========
(function() {
    const loggedIn = sessionStorage.getItem('loggedIn');
    const role = sessionStorage.getItem('role');
    if (loggedIn !== 'true' || role !== 'Admin') {
        window.location.href = 'emrLogin.html';
    }
})();

// ========== LOGOUT MODAL ==========
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
});

// ========== TAB MANAGEMENT ==========
document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    const activateTab = (targetId) => {
        tabContents.forEach(c => c.classList.add('hidden'));
        tabButtons.forEach(btn => {
            btn.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'border-gray-300', 'dark:border-gray-600', 'text-text-light', 'dark:text-text-dark');
            btn.classList.add('bg-surface-light', 'dark:bg-surface-dark', 'hover:bg-gray-50', 'dark:hover:bg-gray-700/50', 'border-border-light', 'dark:border-border-dark', 'font-medium', 'text-subtext-light', 'dark:text-subtext-dark');
        });
        const activeBtn = document.querySelector(`[data-target="${targetId}"]`);
        document.getElementById(targetId).classList.remove('hidden');
        activeBtn.classList.add('bg-gray-100', 'dark:bg-gray-700', 'border-gray-300', 'dark:border-gray-600', 'font-medium', 'text-text-light', 'dark:text-text-dark');
        activeBtn.classList.remove('bg-surface-light', 'dark:bg-surface-dark', 'hover:bg-gray-50', 'dark:hover:bg-gray-700/50', 'border-border-light', 'dark:border-border-dark', 'text-subtext-light', 'dark:text-subtext-dark');
    };

    tabButtons.forEach(btn => btn.addEventListener('click', e => {
        e.preventDefault();
        activateTab(btn.getAttribute('data-target'));
    }));

    activateTab('content-integration');
});

// ========== TOAST NOTIFICATION ==========
function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = "fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fadeIn";
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("animate-fadeOut");
        setTimeout(() => toast.remove(), 500);
    }, 2000);
}

// ========== INTEGRATION STATUS (Always ON) ==========
// ✅ Integrations are always enabled — toggles are hidden/disabled
// Status is always shown as Connected regardless of server state

function updateStatus(el, connected) {
    const badge = el.querySelector('span:last-child');
    if (connected) {
        badge.className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-success";
        badge.innerHTML = '<span class="material-symbols-outlined text-sm mr-1">check_circle</span>Connected';
    } else {
        badge.className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-danger";
        badge.innerHTML = '<span class="material-symbols-outlined text-sm mr-1">cancel</span>Disconnected';
    }
}

async function loadIntegrationStatus() {
    // ✅ Always force both integrations ON in the UI
    const billingToggle = document.getElementById('billing-toggle');
    const pharmacyToggle = document.getElementById('pharmacy-toggle');
    const billingStatus = document.getElementById('billing-status');
    const pharmacyStatus = document.getElementById('pharmacy-status');

    // Lock toggles to ON and disable them so users cannot turn them off
    if (billingToggle) {
        billingToggle.checked = true;
        billingToggle.disabled = true;
    }
    if (pharmacyToggle) {
        pharmacyToggle.checked = true;
        pharmacyToggle.disabled = true;
    }

    // Always show Connected
    if (billingStatus) updateStatus(billingStatus, true);
    if (pharmacyStatus) updateStatus(pharmacyStatus, true);

    // Still try to sync with server but ignore OFF responses
    try {
        const res = await fetch("http://localhost:5000/api/integration/status");
        const data = await res.json();
        // Force ON on server too if it returned false
        if (!data.billing || !data.pharmacy) {
            await fetch("http://localhost:5000/api/integration/status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ billing: true, pharmacy: true })
            });
        }
    } catch (err) {
        // Server unavailable — UI already shows Connected, nothing to do
        console.log("Integration server check skipped:", err.message);
    }
}

loadIntegrationStatus();

// ✅ Remove toggle event listeners — integrations cannot be toggled off
// (billingToggle and pharmacyToggle change events intentionally removed)

document.getElementById('test-integration').addEventListener('click', async () => {
    try {
        const res = await fetch("http://localhost:5000/api/integration/test");
        const data = await res.json();
        document.getElementById('integrationStatus').textContent = JSON.stringify(data, null, 2);
        showToast("✅ Integration test completed!");
    } catch (err) {
        console.error("Integration test failed:", err);
        showToast("⚠️ Integration test failed!");
    }
});

// ========== BACKUP SETTINGS ==========
function openBackupSettingsModal() {
    const modal = new bootstrap.Modal(document.getElementById('backupSettingsModal'));
    modal.show();
    loadBackupSettings();
}

async function loadBackupSettings() {
    try {
        const res = await fetch('http://localhost:5000/api/backup/settings');
        const settings = await res.json();
        applySettings(settings);
    } catch (err) {
        const settings = JSON.parse(localStorage.getItem('backupSettings') || '{}');
        applySettings(settings);
    }
}

function applySettings(settings) {
    if (settings.appointment) {
        document.getElementById('appointmentFrequency').value = settings.appointment.frequency || 1;
        document.getElementById('appointmentUnit').value = settings.appointment.unit || 'days';
    }
    if (settings.account) {
        document.getElementById('accountFrequency').value = settings.account.frequency || 1;
        document.getElementById('accountUnit').value = settings.account.unit || 'days';
    }
    if (settings.activity) {
        document.getElementById('activityFrequency').value = settings.activity.frequency || 1;
        document.getElementById('activityUnit').value = settings.activity.unit || 'days';
    }
    document.getElementById('enableNotifications').checked = settings.enableNotifications !== false;
    document.getElementById('enableFailureAlerts').checked = settings.enableFailureAlerts !== false;
    document.getElementById('enableRetention').checked = settings.enableRetention !== false;
    updateNextBackupTimes();
}

async function saveBackupSettingsFromSettings() {
    const settings = {
        appointment: {
            frequency: parseInt(document.getElementById('appointmentFrequency').value),
            unit: document.getElementById('appointmentUnit').value
        },
        account: {
            frequency: parseInt(document.getElementById('accountFrequency').value),
            unit: document.getElementById('accountUnit').value
        },
        activity: {
            frequency: parseInt(document.getElementById('activityFrequency').value),
            unit: document.getElementById('activityUnit').value
        },
        enableNotifications: document.getElementById('enableNotifications').checked,
        enableFailureAlerts: document.getElementById('enableFailureAlerts').checked,
        enableRetention: document.getElementById('enableRetention').checked,
        lastUpdated: new Date().toISOString()
    };

    try {
        const res = await fetch('http://localhost:5000/api/backup/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('backupSettings', JSON.stringify(settings));
            const modal = bootstrap.Modal.getInstance(document.getElementById('backupSettingsModal'));
            modal.hide();
            showSuccessToast('✅ Backup settings saved successfully!');
        } else {
            throw new Error(data.message);
        }
    } catch (err) {
        console.error('Error saving backup settings:', err);
        showSuccessToast('⚠️ Settings saved locally only (server unavailable)');
        localStorage.setItem('backupSettings', JSON.stringify(settings));
        const modal = bootstrap.Modal.getInstance(document.getElementById('backupSettingsModal'));
        modal.hide();
    }
}

function updateNextBackupTimes() {
    const now = new Date();
    const appointmentFreq = parseInt(document.getElementById('appointmentFrequency').value);
    const appointmentUnit = document.getElementById('appointmentUnit').value;
    document.getElementById('appointmentNextBackup').textContent = calculateNextBackup(now, appointmentFreq, appointmentUnit).toLocaleString();

    const accountFreq = parseInt(document.getElementById('accountFrequency').value);
    const accountUnit = document.getElementById('accountUnit').value;
    document.getElementById('accountNextBackup').textContent = calculateNextBackup(now, accountFreq, accountUnit).toLocaleString();

    const activityFreq = parseInt(document.getElementById('activityFrequency').value);
    const activityUnit = document.getElementById('activityUnit').value;
    document.getElementById('activityNextBackup').textContent = calculateNextBackup(now, activityFreq, activityUnit).toLocaleString();
}

function calculateNextBackup(baseDate, frequency, unit) {
    const next = new Date(baseDate);
    switch(unit) {
        case 'seconds': next.setSeconds(next.getSeconds() + frequency); break;
        case 'minutes': next.setMinutes(next.getMinutes() + frequency); break;
        case 'hours':   next.setHours(next.getHours() + frequency); break;
        case 'days':    next.setDate(next.getDate() + frequency); break;
        case 'months':  next.setMonth(next.getMonth() + frequency); break;
        case 'years':   next.setFullYear(next.getFullYear() + frequency); break;
    }
    return next;
}

function showSuccessToast(message) {
    const toastContainer = document.createElement('div');
    toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '11';
    toastContainer.innerHTML = `
        <div class="toast show" role="alert">
            <div class="toast-header text-white" style="background-color: #358F85;">
                <span class="material-symbols-outlined me-2 text-sm">check_circle</span>
                <strong class="me-auto">Success</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">${message}</div>
        </div>`;
    document.body.appendChild(toastContainer);
    setTimeout(() => toastContainer.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    ['appointmentFrequency', 'accountFrequency', 'activityFrequency'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateNextBackupTimes);
    });
    ['appointmentUnit', 'accountUnit', 'activityUnit'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateNextBackupTimes);
    });
});