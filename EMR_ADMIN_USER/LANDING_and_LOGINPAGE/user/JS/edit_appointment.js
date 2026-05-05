// ============================================================
// CUSTOM SEARCHABLE DROPDOWN (same as add_appointment.js)
// ============================================================
const _dropdownSelected = {
  selectDoctor: { value: "", text: "" },
  appType:      { value: "", text: "" }
};

function buildSearchableDropdown(selectId, placeholder, items, currentValue) {
  const originalSelect = document.getElementById(selectId);
  if (!originalSelect) return;

  originalSelect.style.display = "none";

  const oldWrap = document.getElementById(`sd-wrap-${selectId}`);
  if (oldWrap) oldWrap.remove();

  const wrap = document.createElement("div");
  wrap.id = `sd-wrap-${selectId}`;
  wrap.style.cssText = "position:relative; width:100%;";

  const trigger = document.createElement("div");
  trigger.id = `sd-trigger-${selectId}`;
  trigger.setAttribute("tabindex", "0");
  trigger.style.cssText = `
    display:flex; align-items:center; justify-content:space-between;
    width:100%; padding:10px 14px;
    border:1px solid #e5e7eb; border-radius:8px;
    background:white; cursor:pointer; user-select:none;
    font-size:14px; color:#6b7280;
    transition:border-color .15s, box-shadow .15s;
    box-sizing:border-box;
  `;

  // If there's a current value, find its label to pre-fill
  const currentItem = currentValue ? items.find(i => i.value === currentValue) : null;
  const displayText = currentItem ? currentItem.label : placeholder;
  const displayColor = currentItem ? "#111" : "#6b7280";

  trigger.innerHTML = `
    <span class="sd-trigger-text"
      style="flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:${displayColor};">
      ${displayText}
    </span>
    <svg style="width:16px;height:16px;flex-shrink:0;transition:transform .2s;color:#6b7280;"
      viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08
           1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clip-rule="evenodd"/>
    </svg>
  `;

  if (currentItem) {
    _dropdownSelected[selectId] = { value: currentItem.value, text: currentItem.label };
    trigger.style.borderColor = "#065f46";
  }

  const panel = document.createElement("div");
  panel.id = `sd-panel-${selectId}`;
  panel.style.cssText = `
    display:none; position:absolute; top:calc(100% + 4px); left:0; right:0;
    background:white; border:1px solid #e5e7eb; border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,0.13);
    z-index:9999; overflow:hidden;
  `;

  const searchWrap = document.createElement("div");
  searchWrap.style.cssText = "padding:10px 10px 6px;";
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search...";
  searchInput.autocomplete = "off";
  searchInput.style.cssText = `
    width:100%; padding:8px 12px;
    border:1.5px solid #065f46; border-radius:7px;
    font-size:13px; outline:none; box-sizing:border-box;
    color:#111; background:#f9fafb;
  `;
  searchWrap.appendChild(searchInput);
  panel.appendChild(searchWrap);

  const list = document.createElement("div");
  list.style.cssText = "max-height:220px; overflow-y:auto; padding:4px 6px 8px;";
  panel.appendChild(list);

  wrap.appendChild(trigger);
  wrap.appendChild(panel);
  originalSelect.parentNode.insertBefore(wrap, originalSelect);

  function renderItems(filter) {
    const q = (filter || "").toLowerCase().trim();
    const filtered = q ? items.filter(it => it.label.toLowerCase().includes(q) || (it.sub || "").toLowerCase().includes(q)) : items;

    list.innerHTML = "";
    if (filtered.length === 0) {
      list.innerHTML = `<div style="padding:12px 10px;text-align:center;color:#9ca3af;font-size:13px;">No results found</div>`;
      return;
    }

    filtered.forEach(it => {
      const isSelected = it.value === _dropdownSelected[selectId].value;
      const row = document.createElement("div");
      row.style.cssText = `
        display:flex; align-items:center; justify-content:space-between;
        padding:9px 10px; border-radius:7px; cursor:pointer;
        font-size:13px; color:${isSelected ? "#065f46" : "#111"};
        background:${isSelected ? "#f0fdf4" : "transparent"};
        transition:background .1s;
      `;
      row.innerHTML = `
        <span style="font-weight:600;">${it.label}</span>
        ${it.sub ? `<span style="color:#6b7280;font-size:12px;font-weight:400;margin-left:8px;white-space:nowrap;">${it.sub}</span>` : ""}
      `;

      row.addEventListener("mouseenter", () => { row.style.background = "#f0fdf4"; row.style.color = "#065f46"; });
      row.addEventListener("mouseleave", () => { row.style.background = isSelected ? "#f0fdf4" : "transparent"; row.style.color = isSelected ? "#065f46" : "#111"; });

      row.addEventListener("click", () => {
        _dropdownSelected[selectId] = { value: it.value, text: it.label };
        originalSelect.value = it.value;
        const textEl = trigger.querySelector(".sd-trigger-text");
        textEl.textContent = it.label;
        textEl.style.color = "#111";
        trigger.style.borderColor = "#065f46";
        closePanel();
        renderItems("");
      });

      list.appendChild(row);
    });
  }

  let isOpen = false;

  function openPanel() {
    if (isOpen) return;
    isOpen = true;
    panel.style.display = "block";
    trigger.style.borderColor = "#065f46";
    trigger.style.boxShadow = "0 0 0 3px rgba(6,95,70,0.10)";
    trigger.querySelector("svg").style.transform = "rotate(180deg)";
    searchInput.value = "";
    renderItems("");
    setTimeout(() => searchInput.focus(), 40);
  }

  function closePanel() {
    if (!isOpen) return;
    isOpen = false;
    panel.style.display = "none";
    trigger.querySelector("svg").style.transform = "rotate(0deg)";
    if (!_dropdownSelected[selectId].value) {
      trigger.style.borderColor = "#e5e7eb";
      trigger.style.boxShadow = "none";
    }
  }

  trigger.addEventListener("click", () => isOpen ? closePanel() : openPanel());
  trigger.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isOpen ? closePanel() : openPanel(); }
    if (e.key === "Escape") closePanel();
  });
  searchInput.addEventListener("input", () => renderItems(searchInput.value));
  searchInput.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });
  document.addEventListener("click", e => { if (!wrap.contains(e.target)) closePanel(); });
}

// ============================================================
// LOAD FUNCTIONS
// ============================================================

async function loadDoctors(currentDoctorId) {
  const select = document.getElementById("selectDoctor");
  try {
    const res = await fetch("http://localhost:5000/api/users");
    if (!res.ok) throw new Error("Failed to load doctors");
    const users = await res.json();
    const doctors = users.filter(u => u.role === "Doctor" && u.status === "Active");

    select.innerHTML = `<option value=""></option>` +
      doctors.map(d => `<option value="${d.userId || d._id}">Dr. ${d.name} (${d.userId || d._id})</option>`).join("");

    const items = doctors.map(d => ({
      value: d.userId || d._id,
      label: `Dr. ${d.name}`,
      sub:   d.userId || d._id
    }));

    buildSearchableDropdown("selectDoctor", "Search for a doctor...", items, currentDoctorId);
  } catch (err) {
    console.error("Error loading doctors:", err);
    buildSearchableDropdown("selectDoctor", "Error loading doctors", [], null);
  }
}

async function loadServicesDropdown(currentType) {
  const select = document.getElementById("appType");
  try {
    const res = await fetch("http://localhost:5000/api/integrations/billing/services");
    if (!res.ok) throw new Error("Failed to fetch services");
    const result = await res.json();
    if (!result.success || !result.data) throw new Error("Invalid response");

    const services = result.data;

    select.innerHTML = `<option value=""></option>` +
      services.map(s => `<option value="${s.name}">${s.name}</option>`).join(""); // s.name not s.service

    const items = services.map(s => ({
      value: s.name,   // s.name not s.service
      label: s.name,   // s.name not s.service
      sub:   s.price ? `₱${Number(s.price).toFixed(2)}` : ""
    }));

    buildSearchableDropdown("appType", "Search and select a service...", items, currentType);
  } catch (err) {
    console.error("❌ Error loading services:", err);
    buildSearchableDropdown("appType", "Error loading services", [], null);
  }
}

async function loadAppointmentData() {
  const urlParams = new URLSearchParams(window.location.search);
  const appointmentId = urlParams.get("id");
  if (!appointmentId) return null;

  try {
    const res = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`);
    if (!res.ok) throw new Error("Failed to load appointment data.");
    const app = await res.json();

    document.getElementById("patientname").value = app.patientName || "";
    document.getElementById("appdate").value     = app.date ? app.date.split("T")[0] : "";
    document.getElementById("appTime").value     = app.time || "";
    document.getElementById("duration").value    = app.duration || "";
    document.getElementById("reason").value      = app.reason || "";
    document.getElementById("addnotes").value    = app.notes || "";

    return app;
  } catch (err) {
    console.error("Error loading appointment:", err);
    alert("Unable to load appointment details.");
    return null;
  }
}

// ============================================================
// FORM SUBMIT
// ============================================================
document.getElementById("patientForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const urlParams     = new URLSearchParams(window.location.search);
  const appointmentId = urlParams.get("id");
  const selectedDate  = document.getElementById("appdate").value;
  const selectedTime  = document.getElementById("appTime").value;
  const today         = new Date();
  const todayStr      = today.toISOString().split("T")[0];

  if (selectedDate < todayStr) {
    alert("❌ Cannot schedule appointment in the past. Please select today or a future date.");
    return;
  }
  if (selectedDate === todayStr && selectedTime) {
    const [sh, sm] = selectedTime.split(":").map(Number);
    if (sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes())) {
      alert("❌ Cannot schedule appointment in the past. Please select a future time.");
      return;
    }
  }

  const updatedData = {
    patientName: document.getElementById("patientname").value,
    date:        selectedDate,
    time:        selectedTime,
    doctorId:    _dropdownSelected.selectDoctor.value,
    doctorName:  _dropdownSelected.selectDoctor.text,
    type:        _dropdownSelected.appType.value,
    duration:    document.getElementById("duration").value,
    reason:      document.getElementById("reason").value,
    notes:       document.getElementById("addnotes").value
  };

  try {
    const response = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData)
    });
    if (!response.ok) {
      const errorDetail = await response.text();
      throw new Error(`Failed to update appointment: ${response.statusText}`);
    }
    alert("✅ Appointment updated successfully!");
    window.location.href = "Appointments.html";
  } catch (error) {
    console.error("Error updating appointment:", error);
    alert(`❌ Error updating appointment: ${error.message}`);
  }
});

document.querySelector(".cancelBtn").addEventListener("click", () => {
  console.log("Cancel button clicked.");
});

// ============================================================
// VALIDATE DATE/TIME
// ============================================================
function validateDateTime() {
  const dateInput   = document.getElementById("appdate");
  const timeInput   = document.getElementById("appTime");
  if (!dateInput || !timeInput) return;
  const selectedDate = dateInput.value;
  const selectedTime = timeInput.value;
  const today        = new Date();
  const todayStr     = today.toISOString().split("T")[0];

  if (selectedDate === todayStr && selectedTime) {
    const [sh, sm] = selectedTime.split(":").map(Number);
    if (sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes())) {
      alert("⚠️ Cannot schedule appointment in the past. Please select a future time.");
      const ft = new Date(today.getTime() + 30 * 60000);
      timeInput.value = `${String(ft.getHours()).padStart(2,"0")}:${String(ft.getMinutes()).padStart(2,"0")}`;
    }
  }
  if (selectedDate && selectedDate < todayStr) {
    alert("⚠️ Cannot schedule appointment in the past. Please select today or a future date.");
    dateInput.value = todayStr;
  }
}

// ============================================================
// INIT — load appointment data first to get IDs, then build dropdowns
// ============================================================
window.onload = async () => {
  const app = await loadAppointmentData();

  await loadDoctors(app?.doctorId || null);
  await loadServicesDropdown(app?.type || null);

  const dateInput = document.getElementById("appdate");
  const timeInput = document.getElementById("appTime");
  const today     = new Date().toISOString().split("T")[0];
  if (dateInput) { dateInput.setAttribute("min", today); dateInput.addEventListener("change", validateDateTime); }
  if (timeInput) { timeInput.addEventListener("change", validateDateTime); }
};