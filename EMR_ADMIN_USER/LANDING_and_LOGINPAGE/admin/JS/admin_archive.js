(function() {
  const loggedIn = sessionStorage.getItem('loggedIn');
  const role = sessionStorage.getItem('role');
  if (loggedIn !== 'true' || role !== 'Admin') {
    window.location.href = 'emrLogin.html';
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

let archiveData = [];
let actionCallback = null;
let userToRestore = null;
let userToDelete = null;
const currentAdminId = sessionStorage.getItem("userId");

const tbody = document.getElementById("archiveTable");
const empty = document.getElementById("emptyArchive");
const searchInput = document.getElementById("archiveSearch");
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMessage = document.getElementById("confirmMessage");
const confirmActionBtn = document.getElementById("confirmActionBtn");

async function fetchArchive() {
  try {
    const res = await fetch("http://localhost:5000/api/archive");
    archiveData = await res.json();
    loadArchive();
  } catch (err) {
    console.error("Error fetching archive:", err);
  }
}

function loadArchive(filter = "") {
  tbody.innerHTML = "";
  const filtered = archiveData.filter(record =>
    record.name.toLowerCase().includes(filter) ||
    record.email.toLowerCase().includes(filter) ||
    record.role.toLowerCase().includes(filter) ||
    record.userId.toLowerCase().includes(filter)
  );

  if (filtered.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  filtered.forEach(record => {
    const safeId = record._id || '';
    const safeName = (record.name || '').replace(/'/g, '&#39;');
    
    let roleColorClass = record.role === "Admin" ? "bg-purple-200 text-purple-900"
                      : record.role === "Doctor" ? "bg-blue-900 text-white"
                      : "bg-blue-200 text-blue-800";

    let idBadge = record.userId.startsWith("A") ? `<span class="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">${record.userId}</span>`
                : record.userId.startsWith("D") ? `<span class="px-2 py-1 text-xs font-semibold bg-blue-900 text-white rounded-full">${record.userId}</span>`
                : record.userId.startsWith("N") ? `<span class="px-2 py-1 text-xs font-semibold bg-blue-200 text-blue-800 rounded-full">${record.userId}</span>`
                : record.userId;

    tbody.innerHTML += `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
        <td class="py-3 px-4">${idBadge}</td>
        <td class="py-3 px-4">${record.name}</td>
        <td class="py-3 px-4">${record.email}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-1 rounded-full text-xs font-medium ${roleColorClass}">
            ${record.role}
          </span>
        </td>
        <td class="py-3 px-4">${new Date(record.archivedOn).toLocaleString()}</td>
        <td class="py-3 px-4 flex items-center justify-center space-x-3">
          <button onclick="initiateRestore('${safeId}', '${safeName}')" class="relative group text-green-600 hover:text-green-800">
            <span class="material-symbols-outlined">restore</span>
            <span class="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">Restore User</span>
          </button>
          <button onclick="initiateDelete('${safeId}', '${safeName}')" class="relative group text-red-600 hover:text-red-800">
            <span class="material-symbols-outlined">delete</span>
            <span class="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">Delete Permanently</span>
          </button>
        </td>
      </tr>`;
  });
}

function initiateRestore(id, name) {
  if (!id) {
    console.error("Cannot restore user: User ID is missing.");
    return;
  }
  userToRestore = { id, name };
  openAdminAuthRestoreModal();
}

function openAdminAuthRestoreModal() {
  document.getElementById("authAdminIdRestoreDisplay").textContent = currentAdminId || "N/A";
  if (userToRestore) {
    document.getElementById("restoreUserNameDisplay").textContent = 
      `User to restore: ${userToRestore.name}`;
  }
  document.getElementById("adminPasswordRestoreInput").value = "";
  document.getElementById("authRestoreMessage").textContent = "";
  document.getElementById("authRestoreMessage").classList.add("hidden");
  document.getElementById("adminAuthRestoreModal").classList.remove("hidden");
}

function closeAdminAuthRestoreModal() {
  document.getElementById("adminAuthRestoreModal").classList.add("hidden");
  userToRestore = null;
}

async function verifyAdminPasswordForRestore() {
  const authMessage = document.getElementById("authRestoreMessage");
  authMessage.classList.add("hidden");
  const adminPassword = document.getElementById("adminPasswordRestoreInput").value;
  
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
      if (userToRestore) {
        await proceedWithRestore(userToRestore.id);
      } else {
        console.error("Error: User details for restore are missing after successful verification.");
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

async function proceedWithRestore(id) {
  try {
    const res = await fetch(`http://localhost:5000/api/archive/restore/${id}`, { 
      method: "POST" 
    });
    
    const data = await res.json();
    
    if (res.ok) {
      alert(`✅ ${data.message}\n\nUser ID: ${data.user.userId}\nEmail: ${data.user.email}\n\nTemporary Password: Temp@123`);
      fetchArchive();
    } else {
      alert(`❌ ${data.message}`);
    }
  } catch (err) {
    console.error("Error restoring user:", err);
    alert("❌ Network error: Unable to restore user");
  } finally {
    closeAdminAuthRestoreModal();
  }
}

function showConfirmModal(title, message, callback) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  actionCallback = callback;
  confirmModal.classList.remove("hidden");
}

function closeConfirmModal() {
  confirmModal.classList.add("hidden");
  actionCallback = null;
}

confirmActionBtn.addEventListener("click", () => {
  if (actionCallback) actionCallback();
  closeConfirmModal();
});

function initiateDelete(id, name) {
  if (!id) {
    console.error("Cannot delete user: User ID is missing.");
    return;
  }
  userToDelete = { id, name };
  openAdminAuthDeleteModal();
}

function openAdminAuthDeleteModal() {
  document.getElementById("authAdminIdDeleteDisplay").textContent = currentAdminId || "N/A";
  if (userToDelete) {
    document.getElementById("deleteUserNameDisplay").textContent = 
      `User to delete permanently: ${userToDelete.name}`;
  }
  document.getElementById("adminPasswordDeleteInput").value = "";
  document.getElementById("authDeleteMessage").textContent = "";
  document.getElementById("authDeleteMessage").classList.add("hidden");
  document.getElementById("adminAuthDeleteModal").classList.remove("hidden");
}

function closeAdminAuthDeleteModal() {
  document.getElementById("adminAuthDeleteModal").classList.add("hidden");
  userToDelete = null;
}

async function verifyAdminPasswordForDelete() {
  const authMessage = document.getElementById("authDeleteMessage");
  authMessage.classList.add("hidden");
  const adminPassword = document.getElementById("adminPasswordDeleteInput").value;
  
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
      if (userToDelete) {
        await proceedWithDelete(userToDelete.id);
      } else {
        console.error("Error: User details for delete are missing after successful verification.");
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

async function proceedWithDelete(id) {
  try {
    const res = await fetch(`http://localhost:5000/api/archive/${id}`, { 
      method: "DELETE" 
    });
    const data = await res.json();
    
    if (res.ok) {
      alert(`✅ User permanently deleted successfully.\n\n⚠️ Note: If the user was previously logged in, their session has been terminated.`);
      fetchArchive();
    } else {
      alert(`❌ ${data.message}`);
    }
  } catch (err) {
    console.error("Error deleting user:", err);
    alert("❌ Network error: Unable to delete user");
  } finally {
    closeAdminAuthDeleteModal();
  }
}

async function deleteUser(id) {
  try {
    const res = await fetch(`http://localhost:5000/api/archive/${id}`, { method: "DELETE" });
    const data = await res.json();
    alert(data.message);
    fetchArchive();
  } catch (err) {
    console.error("Error deleting user:", err);
    alert("❌ Network error: Unable to delete user");
  }
}

searchInput.addEventListener("input", (e) => loadArchive(e.target.value.toLowerCase()));
fetchArchive();