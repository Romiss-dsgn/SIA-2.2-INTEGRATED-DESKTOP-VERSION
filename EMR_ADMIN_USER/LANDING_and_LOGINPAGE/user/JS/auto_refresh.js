// ====== AUTO REFRESH SYSTEM FOR REAL-TIME UPDATES ======
// Updated to prevent blinking/flickering during refresh

// ✅ Auto refresh configuration
const AUTO_REFRESH_CONFIG = {
  enabled: true,
  interval: 3000, // Increased from 1s to 3s to reduce unnecessary refreshes
  pages: {
    "Appointments.html": {
      refreshFunction: "loadAppointments",
      enabled: true
    },
    "Dashboard.html": {
      refreshFunction: "loadTodaysAppointments",
      enabled: true,
      additionalFunctions: ["updateQuickStats"] // Removed loadRecentPatients - it auto-refreshes internally
    },
    "Patients.html": {
      refreshFunction: "loadPatients",
      enabled: true
    },
    "Archive.html": {
      refreshFunction: "loadAppointments",
      enabled: true
    },
    "Report.html": {
      refreshFunction: "loadReportStats",
      enabled: true
    },
    "emrAdmin.html": {
      refreshFunction: "loadReportStats",
      enabled: true
    },
    "adminBackup.html": {
      refreshFunction: "loadReportStats",
      enabled: true
    }
  }
};

// ✅ Track last refresh time for each function to prevent duplicate calls
const lastRefreshTimes = {};

// ✅ Start auto refresh
function startAutoRefresh() {
  if (!AUTO_REFRESH_CONFIG.enabled) return;

  const currentPage = window.location.pathname.split("/").pop();
  const pageConfig = AUTO_REFRESH_CONFIG.pages[currentPage];

  if (!pageConfig || !pageConfig.enabled) {
    return;
  }

  // Don't refresh if user is actively interacting (typing, clicking, etc.)
  let isUserActive = false;
  let activityTimeout;

  const resetActivityTimeout = () => {
    isUserActive = true;
    clearTimeout(activityTimeout);
    activityTimeout = setTimeout(() => {
      isUserActive = false;
    }, 2000); // Increased to 2 seconds of inactivity before allowing refresh
  };

  // Track user activity
  document.addEventListener("mousedown", resetActivityTimeout);
  document.addEventListener("keydown", resetActivityTimeout);
  document.addEventListener("scroll", resetActivityTimeout);
  document.addEventListener("input", resetActivityTimeout); // Added input tracking

  // Auto refresh interval
  setInterval(() => {
    // Don't refresh if:
    // 1. User is active
    // 2. A modal is open
    // 3. User is on a form page
    if (isUserActive) return;
    
    const hasOpenModal = document.querySelector(".modal[style*='flex'], .modal[style*='block']");
    if (hasOpenModal) return;

    const isFormPage = currentPage.includes("Add") || currentPage.includes("Edit");
    if (isFormPage) return;

    // Check if page is visible
    if (document.hidden) return;

    // Execute refresh function if it exists
    if (typeof window[pageConfig.refreshFunction] === "function") {
      const now = Date.now();
      const lastRefresh = lastRefreshTimes[pageConfig.refreshFunction] || 0;
      
      // Only refresh if at least 2 seconds have passed since last refresh
      if (now - lastRefresh >= 2000) {
        try {
          window[pageConfig.refreshFunction]();
          lastRefreshTimes[pageConfig.refreshFunction] = now;
        } catch (err) {
          console.error("Auto refresh error:", err);
        }
      }
    }
    
    // Execute additional refresh functions if configured
    if (pageConfig.additionalFunctions && Array.isArray(pageConfig.additionalFunctions)) {
      pageConfig.additionalFunctions.forEach(funcName => {
        if (typeof window[funcName] === "function") {
          const now = Date.now();
          const lastRefresh = lastRefreshTimes[funcName] || 0;
          
          // Only refresh if at least 2 seconds have passed since last refresh
          if (now - lastRefresh >= 2000) {
            try {
              window[funcName]();
              lastRefreshTimes[funcName] = now;
            } catch (err) {
              console.error(`Auto refresh error for ${funcName}:`, err);
            }
          }
        }
      });
    }
  }, AUTO_REFRESH_CONFIG.interval);

  console.log(`✅ Auto refresh enabled for ${currentPage} (every ${AUTO_REFRESH_CONFIG.interval / 1000}s)`);
}

// ✅ Initialize auto refresh
document.addEventListener("DOMContentLoaded", () => {
  // Small delay to ensure page is fully loaded
  setTimeout(startAutoRefresh, 1000);
});

// ✅ Also start if DOM is already loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(startAutoRefresh, 1000);
  });
} else {
  setTimeout(startAutoRefresh, 1000);
}