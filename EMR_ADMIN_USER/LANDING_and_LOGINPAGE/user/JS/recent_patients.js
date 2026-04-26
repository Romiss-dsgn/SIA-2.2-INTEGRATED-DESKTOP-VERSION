// Utility to manage recent patients in localStorage

function addRecentPatient(patientId, patientName) {
  if (!patientId || !patientName) return;

  let recent = JSON.parse(localStorage.getItem("recentPatients")) || [];

  // Check if already exists
  recent = recent.filter(p => p.patientId !== patientId);

  // Add newest to front
  recent.unshift({ patientId, patientName });

  // Limit to 5 recent patients
  if (recent.length > 5) recent = recent.slice(0, 5);

  localStorage.setItem("recentPatients", JSON.stringify(recent));
}

function getRecentPatients() {
  return JSON.parse(localStorage.getItem("recentPatients")) || [];
}
// ================= Dashboard Render for Recent Patients =================

document.addEventListener("DOMContentLoaded", () => {
  const recentContainer = document.getElementById("recentPatientsContainer");
  if (!recentContainer) return; // not in dashboard

  const recent = getRecentPatients();

  if (recent.length === 0) {
    recentContainer.innerHTML = `<p class="text-gray-400 text-sm">No recent patients accessed.</p>`;
    return;
  }

  recentContainer.innerHTML = recent.map(p => `
      <div class="recent-patient-item" data-id="${p.patientId}">
         ${p.patientName}
      </div>
  `).join("");

  // when user clicks recent → open and log again
  document.querySelectorAll(".recent-patient-item").forEach(item => {
    item.addEventListener("click", () => {
      const pid = item.getAttribute("data-id");
      const name = item.textContent.trim();
      addRecentPatient(pid, name); // RE-LOG AGAIN
      window.location.href = `/patient/${pid}`; // <-- your open page link here
    });
  });
});
