(function () {
  const loggedIn = sessionStorage.getItem("loggedIn");
  const role = sessionStorage.getItem("role");
  if (loggedIn !== "true" || role !== "Admin") {
    window.location.href = "emrLogin.html";
  }
})();

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

const API_URL = "http://localhost:5000/api/users";
let selectedUserId = null;
let userDetailsToUpdate = null;
let userDetailsToArchive = null;
let allUsers = [];
const currentAdminId = sessionStorage.getItem("userId");

function renderUsers(users) {
  const tbody = document.getElementById("usersTable");
  tbody.innerHTML = "";

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-10 text-center text-gray-500 dark:text-gray-400">
          No user accounts match your criteria.
        </td>
      </tr>
    `;
    return;
  }

  users.forEach((user) => {
    const safeId = user._id || '';
    const safeName = (user.name || '').replace(/'/g, '&#39;');
    const safeEmail = (user.email || '').replace(/'/g, '&#39;');
    const safeRole = user.role || '';
    const safeStatus = user.status || '';
    const userIdValue = user.userId || user._id;

    let roleBadge = "";
    if (user.role === "Admin")
      roleBadge = `<span class="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">${user.role}</span>`;
    else if (user.role === "Doctor")
      roleBadge = `<span class="px-2 py-1 text-xs font-semibold bg-blue-900 text-white rounded-full">${user.role}</span>`;
    else if (user.role === "Nurse")
      roleBadge = `<span class="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">${user.role}</span>`;
    else if (user.role === "Medtech")
      roleBadge = `<span class="px-2 py-1 text-xs font-semibold bg-teal-100 text-teal-700 rounded-full">${user.role}</span>`;

    let idBadge = "";
    if (user.role === "Admin")
      idBadge = `<span class="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">${userIdValue}</span>`;
    else if (user.role === "Doctor")
      idBadge = `<span class="px-2 py-1 text-xs font-semibold bg-blue-900 text-white rounded-full">${userIdValue}</span>`;
    else if (user.role === "Nurse")
      idBadge = `<span class="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">${userIdValue}</span>`;
    else if (user.role === "Medtech")
  idBadge = `<span class="px-2 py-1 text-xs font-semibold bg-teal-100 text-teal-700 rounded-full">${userIdValue}</span>`;
    else idBadge = userIdValue;

    let actionButtons = '';
    if (user.role !== "Admin") {
      actionButtons = `
        <button onclick="openUpdateModal('${safeId}', '${safeName}', '${safeEmail}', '${safeRole}', '${safeStatus}')"
                  class="relative group p-2 text-blue-500 hover:text-blue-700">
            <span class="material-symbols-outlined">edit</span>
            <span class="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">Update User</span>
        </button>
        <button onclick="deleteUser('${safeId}', '${safeName}')"
                  class="relative group p-2 text-gray-500 hover:text-gray-700">
            <span class="material-symbols-outlined">archive</span>
            <span class="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">Archive</span>
        </button>
      `;
    } else {
      actionButtons = `<span class="text-gray-400 text-sm italic"></span>`;
    }

    tbody.innerHTML += `
      <tr>
        <td class="py-3 px-4">${idBadge}</td>
        <td class="py-3 px-4">${user.name}</td>
        <td class="py-3 px-4">${user.email}</td>
        <td class="py-3 px-4">${roleBadge}</td>
        <td class="py-3 px-4">
          ${
            user.status === "Active"
              ? `<span class="px-2 py-1 text-xs font-semibold bg-green-100 text-green-600 rounded-full">Active</span>`
              : `<span class="px-2 py-1 text-xs font-semibold bg-red-100 text-red-600 rounded-full">Inactive</span>`
          }
        </td>
        <td class="py-3 px-4">${
          user.lastLogin ?
          new Date(user.lastLogin).toLocaleString() : "Never"
        }</td>
        <td class="py-3 px-4 flex items-center justify-center space-x-2">
          ${actionButtons}
        </td>
      </tr>
    `;
  });
}

async function loadUsers() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const users = await res.json();
    allUsers = users;
    applyFilters();
  } catch (err) {
    console.error("Failed to load users:", err);
    const tbody = document.getElementById("usersTable");
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-10 text-center text-red-500 font-medium">
          Failed to load user data.
          Please check the server connection.
        </td>
      </tr>
    `;
  }
}

function applyFilters() {
  const searchTerm = document.getElementById("userSearchBar").value.toLowerCase().trim();
  const roleFilter = document.getElementById("roleFilter").value;
  const statusFilter = document.getElementById("statusFilter").value;
  const sortFilter = document.getElementById("sortFilter").value;
  let filtered = [...allUsers];

  if (searchTerm) {
    filtered = filtered.filter((user) => {
      const name = (user.name || "").toLowerCase();
      const id = (user.userId || user._id || "").toLowerCase();
      return name.includes(searchTerm) || id.includes(searchTerm);
    });
  }

  if (roleFilter !== "all") {
    filtered = filtered.filter((user) => user.role === roleFilter);
  }

  if (statusFilter !== "all") {
    filtered = filtered.filter((user) => user.status === statusFilter);
  }

  if (sortFilter === "latest") {
    filtered.sort((a, b) => {
      const dateA = a.lastLogin ? new Date(a.lastLogin) : new Date(0);
      const dateB = b.lastLogin ? new Date(b.lastLogin) : new Date(0);
      return dateB - dateA;
    });
  } else if (sortFilter === "oldest") {
    filtered.sort((a, b) => {
      const dateA = a.lastLogin ? new Date(a.lastLogin) : new Date(0);
      const dateB = b.lastLogin ? new Date(b.lastLogin) : new Date(0);
      return dateA - dateB;
    });
  }

  renderUsers(filtered);
}

function filterUsers() {
  applyFilters();
}


// ------------------------------------------
// UPDATED addUser FUNCTION WITH GMAIL VALIDATION AND DUPLICATION CHECK
// ------------------------------------------
async function addUser() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const role = document.getElementById("role").value;
  
  // Get the error message element
  const errorMessageEl = document.getElementById("addUserErrorMessage"); 
  if (errorMessageEl) {
    // Always clear old message first
    errorMessageEl.textContent = "";
    errorMessageEl.classList.add("hidden");
  }

  // 1. Basic field validation
  if (!name || !email || !password) {
    if (errorMessageEl) {
      errorMessageEl.textContent = "Please fill in all required fields.";
      errorMessageEl.classList.remove("hidden");
    } else {
      console.error("Please fill all fields.");
    }
    return;
  }
  
  // 2. ✅ Email domain validation
  if (!email.toLowerCase().endsWith("@gmail.com")) {
    const message = "Email must be a valid @gmail.com address.";
    if (errorMessageEl) {
      errorMessageEl.textContent = message;
      errorMessageEl.classList.remove("hidden");
    } else {
      console.error("Email validation failed: " + message);
    }
    return;
  }

  // 3. ✅ NEW: Check for duplicate email in existing users
  const duplicateUser = allUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
  if (duplicateUser) {
    const message = "This email address is already registered. Please use a different email.";
    if (errorMessageEl) {
      errorMessageEl.textContent = message;
      errorMessageEl.classList.remove("hidden");
    } else {
      console.error("Duplicate email: " + message);
    }
    return;
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();

    if (res.ok) {
      console.log("User added successfully!");
      closeAddModal();
      loadUsers();
    } else {
      // Server-side error handling
      const serverMessage = "Error adding user: " + data.message;
      if (errorMessageEl) {
        errorMessageEl.textContent = serverMessage;
        errorMessageEl.classList.remove("hidden");
      } else {
        console.error(serverMessage);
      }
    }
  } catch (err) {
    console.error("Network/Fetch error:", err);
    if (errorMessageEl) {
      errorMessageEl.textContent = "Network error: Failed to connect to the server.";
      errorMessageEl.classList.remove("hidden");
    }
  }
}

function deleteUser(id, name) {
  if (!id) {
    console.error("Cannot archive user: User ID is missing.");
    return;
  }
  userDetailsToArchive = { id, name };
  openAdminAuthArchiveModal();
}

function openAdminAuthArchiveModal() {
  document.getElementById("authAdminIdArchiveDisplay").textContent = currentAdminId || "N/A";
  if (userDetailsToArchive) {
    document.getElementById("archiveUserNameDisplay").textContent = 
      `User to archive: ${userDetailsToArchive.name}`;
  }
  document.getElementById("adminPasswordArchiveInput").value = "";
  document.getElementById("authArchiveMessage").textContent = "";
  document.getElementById("authArchiveMessage").classList.add("hidden");
  document.getElementById("adminAuthArchiveModal").classList.remove("hidden");
}

function closeAdminAuthArchiveModal() {
  document.getElementById("adminAuthArchiveModal").classList.add("hidden");
  userDetailsToArchive = null;
}

async function verifyAdminPasswordForArchive() {
  const authMessage = document.getElementById("authArchiveMessage");
  authMessage.classList.add("hidden");
  const adminPassword = document.getElementById("adminPasswordArchiveInput").value;
  
  if (!adminPassword) {
    authMessage.textContent = "Please enter the password.";
    authMessage.classList.remove("hidden");
    return;
  }
  
  try {
    const adminEmail = sessionStorage.getItem("email");
    if (!adminEmail) {
      authMessage.textContent = "Admin session expired. Please log in again.";
      authMessage.classList.remove("hidden");
      return;
    }
    
    const res = await fetch("http://localhost:5000/api/users/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const data = await res.json();
    
    if (res.ok && data.valid) {
      if (userDetailsToArchive) {
        await proceedWithArchive(userDetailsToArchive.id, userDetailsToArchive.name);
      } else {
        console.error("Error: User details for archive are missing after successful verification.");
        authMessage.textContent = "Error: User data was lost. Please try again.";
        authMessage.classList.remove("hidden");
      }
    } else {
      authMessage.textContent = "Incorrect password. Please try again.";
      authMessage.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Verification error:", err);
    authMessage.textContent = "Error verifying password. Please try again.";
    authMessage.classList.remove("hidden");
  }
}

async function proceedWithArchive(id, name) {
  try {
    const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    
    if (res.ok) {
      const data = await res.json();
      
      console.log(`User "${name}" moved to archive successfully!`);
      
      // ✅ SHOW FORCE LOGOUT NOTIFICATION
      if (data.forceLogout) {
        alert(`✅ User "${name}" has been archived successfully.\n\n⚠️ The user will be forced to log out if they are currently logged in.`);
      } else {
        alert(`✅ User "${name}" has been archived successfully.`);
      }
      
      loadUsers();
    } else {
      const data = await res.json();
      console.error("Error moving user to the archive:", data.message);
      alert(`Failed to archive user: ${data.message}`);
    }
  } catch (err) {
    console.error("Archive error:", err);
    alert("Network error: Unable to archive user.");
  } finally {
    closeAdminAuthArchiveModal();
  }
}

function openUpdateModal(id, name, email, role, status) {
  if (!id) {
    console.error("Cannot open update modal: User ID is missing in openUpdateModal.");
    return;
  }
  userDetailsToUpdate = { id, name, email, role, status };
  openAdminAuthUpdateModal();
}

function openAdminAuthUpdateModal() {
  document.getElementById("authAdminIdUpdateDisplay").textContent = currentAdminId || "N/A";
  document.getElementById("adminPasswordUpdateInput").value = "";
  document.getElementById("authUpdateMessage").textContent = "";
  document.getElementById("authUpdateMessage").classList.add("hidden");
  document.getElementById("adminAuthUpdateModal").classList.remove("hidden");
}

function closeAdminAuthUpdateModal() {
  document.getElementById("adminAuthUpdateModal").classList.add("hidden");
  userDetailsToUpdate = null;
}

async function verifyAdminPasswordForUpdate() {
  const authMessage = document.getElementById("authUpdateMessage");
  authMessage.classList.add("hidden");
  const adminPassword = document.getElementById("adminPasswordUpdateInput").value;
  
  if (!adminPassword) {
    authMessage.textContent = "Please enter the password.";
    authMessage.classList.remove("hidden");
    return;
  }
  
  try {
    const adminEmail = sessionStorage.getItem("email");
    if (!adminEmail) {
      authMessage.textContent = "Admin session expired. Please log in again.";
      authMessage.classList.remove("hidden");
      return;
    }
    
    const res = await fetch("http://localhost:5000/api/users/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const data = await res.json();
    
    if (res.ok && data.valid) {
      document.getElementById("adminAuthUpdateModal").classList.add("hidden");
      if (userDetailsToUpdate) {
        openUserUpdateFormModal(userDetailsToUpdate);
      } else {
        console.error("Error: User details for update are missing after successful verification.");
        alert("Verification successful, but user data was not loaded correctly. Please try clicking Edit again.");
      }
    } else {
      authMessage.textContent = "Incorrect password. Please try again.";
      authMessage.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Verification error:", err);
    authMessage.textContent = "Error verifying password. Please try again.";
    authMessage.classList.remove("hidden");
  }
}

function openUserUpdateFormModal(user) {
  selectedUserId = user.id;
  document.getElementById("updateName").value = user.name;
  document.getElementById("updateEmail").value = user.email;
  document.getElementById("updateStatus").value = user.status;
  document.getElementById("updatePassword").value = "";
  const roleDisplay = document.getElementById("updateRoleDisplay");
  if (roleDisplay) {
    roleDisplay.textContent = user.role;
  }
  
  const userIdDisplay = document.getElementById("updateUserId");
  if (userIdDisplay) {
    userIdDisplay.textContent = user.id;
  }

  document.getElementById("updateUserModal").classList.remove("hidden");
}

function closeUpdateModal() {
  selectedUserId = null;
  userDetailsToUpdate = null;
  document.getElementById("updatePassword").value = "";
  document.getElementById("updateUserModal").classList.add("hidden");
}

async function saveUserUpdate() {
  if (!selectedUserId) {
    console.error("Cannot save update: selectedUserId is missing.");
    alert("Error: User ID not found for update.");
    return;
  }

  const updatedName = document.getElementById("updateName").value.trim();
  const updatedEmail = document.getElementById("updateEmail").value.trim();
  const updatedStatus = document.getElementById("updateStatus").value;
  const updatedPassword = document.getElementById("updatePassword").value.trim();
  
  if (!updatedName || !updatedEmail) {
    alert("Name and Email are required fields.");
    return;
  }
  
  const updateData = {
    name: updatedName,
    email: updatedEmail,
    status: updatedStatus
  };
  
  if (updatedPassword) {
    updateData.password = updatedPassword;
  }

  try {
    const res = await fetch(`${API_URL}/${selectedUserId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });
    const data = await res.json();

    if (res.ok) {
  // ✅ CHECK IF USER PASSWORD WAS CHANGED OR STATUS CHANGED
  if (data.forceLogout && data.reason === "password_changed") {
    alert(`✅ User updated successfully!\n\n⚠️ The user's password has been changed and they will be forced to log out if they are currently logged in.`);
  } else if (data.forceLogout && updatedStatus === "Inactive") {
    alert(`✅ User updated successfully!\n\n⚠️ The user has been made inactive and will be forced to log out if they are currently logged in.`);
  } else {
    alert("✅ User updated successfully!");
  }
  
  closeUpdateModal();
  loadUsers();
} else {
  alert(`Failed to update user: ${data.message}`);
}
  } catch (err) {
    console.error("Network/Fetch error during update:", err);
    alert("A network error occurred while trying to update the user.");
  }
}

function openAdminAuthModal() {
  document.getElementById("adminPasswordInput").value = "";
  document.getElementById("authMessage").textContent = "";
  document.getElementById("authMessage").classList.add("hidden");
  document.getElementById("adminAuthModal").classList.remove("hidden");
}

function closeAdminAuthModal() {
  document.getElementById("adminAuthModal").classList.add("hidden");
}

async function verifyAdminPassword() {
  const authMessage = document.getElementById("authMessage");
  authMessage.classList.add("hidden");
  const adminPassword = document.getElementById("adminPasswordInput").value;
  
  if (!adminPassword) {
    authMessage.textContent = "Please enter the password.";
    authMessage.classList.remove("hidden");
    return;
  }

  try {
    const adminEmail = sessionStorage.getItem("email");
    if (!adminEmail) {
      authMessage.textContent = "Admin session expired. Please log in again.";
      authMessage.classList.remove("hidden");
      return;
    }
    
    const res = await fetch("http://localhost:5000/api/users/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const data = await res.json();
    
    if (res.ok && data.valid) {
      closeAdminAuthModal();
      openAddUserModal();
    } else {
      authMessage.textContent = "Incorrect password. Please try again.";
      authMessage.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Verification error:", err);
    authMessage.textContent = "Error verifying password. Please try again.";
    authMessage.classList.remove("hidden");
  }
}

// ------------------------------------------
// UPDATED openAddUserModal FUNCTION TO CLEAR ERROR
// ------------------------------------------
function openAddUserModal() {
  document.getElementById("name").value = "";
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
  document.getElementById("role").value = "Doctor";
  
  // Clear any previous error message
  const errorMessageEl = document.getElementById("addUserErrorMessage");
  if (errorMessageEl) {
    errorMessageEl.textContent = "";
    errorMessageEl.classList.add("hidden");
  }

  document.getElementById("addUserModal").classList.remove("hidden");
}

function openAddModal() {
  openAdminAuthModal();
}

function closeAddModal() {
  document.getElementById("addUserModal").classList.add("hidden");
}

loadUsers();