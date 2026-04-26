(function() {
  let sessionCheckInterval = null;

  // Function to check session validity
  async function checkSession() {
    const userId = sessionStorage.getItem('userId');
    const loggedIn = sessionStorage.getItem('loggedIn');

    // Only check if user is logged in
    if (loggedIn !== 'true' || !userId) {
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/session/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();

      if (!data.valid && data.forceLogout) {
        // Force logout
        handleForceLogout(data.reason, data.message);
      }
    } catch (err) {
      console.error('Session check error:', err);
    }
  }

 // Function to handle forced logout
function handleForceLogout(reason, message) {
  // Clear session
  const sessionLogId = sessionStorage.getItem('sessionLogId');
  const userId = sessionStorage.getItem('userId');
  
  // Log the logout
  if (sessionLogId && userId) {
    fetch('http://localhost:5000/api/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionLogId, userId })
    }).catch(err => console.error('Logout logging error:', err));
  }
  // Clear all session storage
  sessionStorage.clear();
  // Show appropriate message based on reason
  let alertMessage = message;
  if (reason === 'deleted') {
    alertMessage = '⚠️ Your account has been deleted by an administrator. You have been logged out.';
  } else if (reason === 'inactive') {
    alertMessage = '⚠️ Your account has been deactivated by an administrator. You have been logged out.';
  } else if (reason === 'password_changed') { // ✅ NEW REASON
    alertMessage = '⚠️ Your password has been changed by an administrator. Please log in again with your new password.';
  } else if (reason === 'no_session') {
    alertMessage = '⚠️ Your session has expired. Please log in again.';
  }
  // Stop checking
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }
  // Show alert and redirect
  alert(alertMessage);
  window.location.href = '../emrLogin.html';
}

  // Start session checking when page loads
  function startSessionCheck() {
    const userId = sessionStorage.getItem('userId');
    const loggedIn = sessionStorage.getItem('loggedIn');

    if (loggedIn === 'true' && userId) {
      // Check immediately
      checkSession();

      // Then check every 10 seconds
      sessionCheckInterval = setInterval(checkSession, 10000);

      console.log('✅ Session checker started');
    }
  }

  // Stop session checking
  function stopSessionCheck() {
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
      sessionCheckInterval = null;
      console.log('🛑 Session checker stopped');
    }
  }

  // Listen for storage events (for multi-tab synchronization)
  window.addEventListener('storage', (e) => {
    if (e.key === 'loggedIn' && e.newValue !== 'true') {
      // User logged out in another tab
      window.location.href = '../emrLogin.html';
    }
  });

  // Start checking when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSessionCheck);
  } else {
    startSessionCheck();
  }

  // Stop checking when page unloads
  window.addEventListener('beforeunload', stopSessionCheck);

  // Expose functions globally if needed
  window.sessionChecker = {
    start: startSessionCheck,
    stop: stopSessionCheck,
    checkNow: checkSession
  };
})();