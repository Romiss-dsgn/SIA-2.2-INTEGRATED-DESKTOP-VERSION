const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

togglePassword.addEventListener("click", () => {
  const type = passwordInput.type === "password" ? "text" : "password";
  passwordInput.type = type;
  togglePassword.textContent = type === "password" ? "visibility_off" : "visibility";
});

// ── TOAST ──────────────────────────────────────────────────────────────────
function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.background = isError ? "#dc2626" : "#065f46";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

// ── INLINE ERROR (below the button) ───────────────────────────────────────
function showLoginError(message) {
  let errEl = document.getElementById("loginErrorMsg");
  if (!errEl) {
    errEl = document.createElement("p");
    errEl.id = "loginErrorMsg";
    errEl.style.cssText = "color:#dc2626; font-size:13px; font-weight:600; margin-top:10px; text-align:center;";
    const btn = document.getElementById("loginBtn");
    btn.parentNode.insertBefore(errEl, btn.nextSibling);
  }
  errEl.textContent = message;

  // Shake animation on the inputs
  ["email", "password"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.borderColor = "#dc2626";
      el.style.animation = "none";
      setTimeout(() => {
        el.style.animation = "shake 0.4s ease";
      }, 10);
    }
  });

  // Clear error when user starts typing again
  ["email", "password"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => {
        errEl.textContent = "";
        el.style.borderColor = "";
      }, { once: true });
    }
  });
}

// Add shake keyframe if not present
if (!document.getElementById("shakeStyle")) {
  const style = document.createElement("style");
  style.id = "shakeStyle";
  style.textContent = `
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20%      { transform: translateX(-6px); }
      40%      { transform: translateX(6px); }
      60%      { transform: translateX(-4px); }
      80%      { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(style);
}

// ── TOGGLE PASSWORD (new/confirm) ─────────────────────────────────────────
document.getElementById("toggleNewPassword").addEventListener("click", () => {
  const input = document.getElementById("newPassword");
  const icon = document.getElementById("toggleNewPassword");
  const type = input.type === "password" ? "text" : "password";
  input.type = type;
  icon.textContent = type === "password" ? "visibility_off" : "visibility";
});

document.getElementById("toggleConfirmPassword").addEventListener("click", () => {
  const input = document.getElementById("confirmPassword");
  const icon = document.getElementById("toggleConfirmPassword");
  const type = input.type === "password" ? "text" : "password";
  input.type = type;
  icon.textContent = type === "password" ? "visibility_off" : "visibility";
});

// ── PASSWORD RESET FORM ───────────────────────────────────────────────────
document.getElementById("passwordResetForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const newPassword     = document.getElementById("newPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();
  const email           = sessionStorage.getItem("tempEmail");

  if (newPassword.length < 6) {
    showToast("⚠️ Password must be at least 6 characters long.", true);
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("⚠️ Passwords do not match!", true);
    return;
  }

  const resetBtn = document.getElementById("resetPasswordBtn");
  resetBtn.innerHTML = `<span class="loading-spinner"></span>Resetting...`;
  resetBtn.disabled = true;

  try {
    const response = await fetch("http://localhost:5000/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, newPassword })
    });

    const data = await response.json();

    if (response.ok) {
      showToast("✅ Password reset successful!");

      sessionStorage.removeItem("tempEmail");
      sessionStorage.removeItem("requiresReset");

      document.getElementById("passwordResetModal").classList.add("hidden");

      const overlay = document.getElementById("loadingOverlay");
      overlay.style.display = "flex";

      setTimeout(() => {
        const role = sessionStorage.getItem("role");
        if (role === "Admin") {
          window.location.href = "admin/emrAdmin.html";
        } else if (role === "Medtech") {
          window.location.href = "user/MedtechDashboard.html";
        } else {
          window.location.href = "user/Dashboard.html";
        }
      }, 1500);
    } else {
      showToast("❌ " + data.message, true);
      resetBtn.innerHTML = "Reset Password";
      resetBtn.disabled = false;
    }
  } catch (err) {
    console.error("Reset Error:", err);
    showToast("🚨 Error connecting to server.", true);
    resetBtn.innerHTML = "Reset Password";
    resetBtn.disabled = false;
  }
});

// ── LOGIN FORM ─────────────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const loginBtn = document.getElementById('loginBtn');
  const overlay  = document.getElementById('loadingOverlay');

  if (!email || !password) {
    showLoginError("⚠️ Please fill in all fields.");
    return;
  }

  loginBtn.innerHTML = `<span class="loading-spinner"></span>Signing In...`;
  loginBtn.disabled  = true;

  try {
    const response = await fetch("http://localhost:5000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    // Always re-enable button first so user can retry
    loginBtn.innerHTML = "Sign In";
    loginBtn.disabled  = false;

    if (response.ok) {
      if (data.status === "Inactive") {
        showLoginError("❌ Your account is inactive. Please contact an administrator.");
        return;
      }

      sessionStorage.setItem("loggedIn",    "true");
      sessionStorage.setItem("role",        data.role);
      sessionStorage.setItem("name",        data.name);
      sessionStorage.setItem("email",       data.email);
      sessionStorage.setItem("userId",      data._id || data.userId);
      sessionStorage.setItem("sessionLogId", data.sessionLogId);

      if (data.requiresReset) {
        sessionStorage.setItem("tempEmail",     email);
        sessionStorage.setItem("requiresReset", "true");
        document.getElementById("passwordResetModal").classList.remove("hidden");
        showToast("⚠️ Please reset your temporary password");
      } else {
        showToast(`✅ Login successful as ${data.role}`);
        overlay.style.display = "flex";

        setTimeout(() => {
          if (data.role === "Admin") {
            window.location.href = "admin/emrAdmin.html";
          } else if (data.role === "Medtech") {
            window.location.href = "user/MedtechDashboard.html";
          } else {
            window.location.href = "user/Dashboard.html";
          }
        }, 1800);
      }
    } else {
      // Wrong credentials — show inline error, inputs remain usable
      showLoginError("❌ " + (data.message || "Invalid email or password."));
    }
  } catch (err) {
    console.error("Login Error:", err);
    showLoginError("🚨 Cannot connect to server. Please try again.");
    loginBtn.innerHTML = "Sign In";
    loginBtn.disabled  = false;
  }
});