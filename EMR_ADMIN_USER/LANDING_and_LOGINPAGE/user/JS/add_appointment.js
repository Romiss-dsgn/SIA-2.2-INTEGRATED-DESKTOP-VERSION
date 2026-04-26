// ============================================================
// NATIVE SEARCHABLE DROPDOWN — matches screenshot style
// Replaces all three <select> elements with custom dropdowns
// ============================================================

// Stores the currently selected value per dropdown (used on form submit)
const _dropdownSelected = {
  selectPatient: { value: "", text: "" },
  selectDoctor:  { value: "", text: "" },
  appType:       { value: "", text: "" }
};

/**
 * Build a custom searchable dropdown that replaces a <select>.
 * @param {string} selectId    — id of the original <select>
 * @param {string} placeholder — placeholder shown in trigger
 * @param {Array}  items       — [{ value, label, sub }]
 */
function buildSearchableDropdown(selectId, placeholder, items) {
  const originalSelect = document.getElementById(selectId);
  if (!originalSelect) return;

  // Hide native select but keep it in DOM
  originalSelect.style.display = "none";

  // Remove any previous custom dropdown
  const oldWrap = document.getElementById(`sd-wrap-${selectId}`);
  if (oldWrap) oldWrap.remove();

  // ── Outer wrapper ─────────────────────────────────────────
  const wrap = document.createElement("div");
  wrap.id = `sd-wrap-${selectId}`;
  wrap.style.cssText = "position:relative; width:100%;";

  // ── Trigger button ────────────────────────────────────────
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
  trigger.innerHTML = `
    <span class="sd-trigger-text"
      style="flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">
      ${placeholder}
    </span>
    <svg style="width:16px;height:16px;flex-shrink:0;transition:transform .2s;color:#6b7280;"
      viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08
           1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clip-rule="evenodd"/>
    </svg>
  `;

  // ── Dropdown panel ────────────────────────────────────────
  const panel = document.createElement("div");
  panel.id = `sd-panel-${selectId}`;
  panel.style.cssText = `
    display:none; position:absolute; top:calc(100% + 4px); left:0; right:0;
    background:white; border:1px solid #e5e7eb; border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,0.13);
    z-index:9999; overflow:hidden;
  `;

  // ── Search input ──────────────────────────────────────────
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

  // ── Options list ──────────────────────────────────────────
  const list = document.createElement("div");
  list.style.cssText = "max-height:220px; overflow-y:auto; padding:4px 6px 8px;";
  panel.appendChild(list);

  wrap.appendChild(trigger);
  wrap.appendChild(panel);
  originalSelect.parentNode.insertBefore(wrap, originalSelect);

  // ── Render filtered items ─────────────────────────────────
  function renderItems(filter) {
    const q = (filter || "").toLowerCase().trim();
    const filtered = q
      ? items.filter(it =>
          it.label.toLowerCase().includes(q) ||
          (it.sub || "").toLowerCase().includes(q))
      : items;

    list.innerHTML = "";

    if (filtered.length === 0) {
      list.innerHTML = `<div style="padding:12px 10px;text-align:center;
        color:#9ca3af;font-size:13px;">No results found</div>`;
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
        ${it.sub
          ? `<span style="color:#6b7280;font-size:12px;font-weight:400;
               margin-left:8px;white-space:nowrap;">${it.sub}</span>`
          : ""}
      `;

      row.addEventListener("mouseenter", () => {
        row.style.background = "#f0fdf4";
        row.style.color = "#065f46";
      });
      row.addEventListener("mouseleave", () => {
        row.style.background = isSelected ? "#f0fdf4" : "transparent";
        row.style.color = isSelected ? "#065f46" : "#111";
      });

      row.addEventListener("click", () => {
        _dropdownSelected[selectId] = { value: it.value, text: it.label };

        // Sync hidden <select>
        originalSelect.value = it.value;

        // Update trigger appearance
        const textEl = trigger.querySelector(".sd-trigger-text");
        textEl.textContent = it.label;
        textEl.style.color = "#111";
        trigger.style.borderColor = "#065f46";

        closePanel();
        renderItems(""); // refresh highlights
      });

      list.appendChild(row);
    });
  }

  // ── Open / close helpers ──────────────────────────────────
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

  // Events
  trigger.addEventListener("click", () => isOpen ? closePanel() : openPanel());
  trigger.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isOpen ? closePanel() : openPanel(); }
    if (e.key === "Escape") closePanel();
  });
  searchInput.addEventListener("input", () => renderItems(searchInput.value));
  searchInput.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });

  // Close on outside click
  document.addEventListener("click", e => {
    if (!wrap.contains(e.target)) closePanel();
  });
}

// ============================================================
// LOAD FUNCTIONS
// ============================================================

async function loadPatientsDropdown() {
  const select = document.getElementById("selectPatient");
  try {
    const res = await fetch("http://localhost:5000/api/patients");
    if (!res.ok) throw new Error("Failed");
    const patients = await res.json();
 
    // ✅ Helper function to format name with middle initial
    function formatPatientName(p) {
      let fullName = p.firstname || "";
      if (p.middlename && p.middlename.trim()) {
        fullName += " " + p.middlename.trim().charAt(0).toUpperCase() + ".";
      }
      fullName += " " + (p.lastname || "");
      return fullName.trim();
    }
 
    select.innerHTML = `<option value=""></option>` +
      patients.map(p =>
        `<option value="${p.patientId}">${formatPatientName(p)}</option>`
      ).join("");
 
    const items = patients.map(p => ({
      value: p.patientId,
      label: formatPatientName(p), // ✅ CHANGED - use formatted name
      sub:   p.patientId
    }));
 
    buildSearchableDropdown("selectPatient", "Search for a patient...", items);
    console.log(`✅ Patients loaded: ${patients.length}`);
  } catch (err) {
    console.error("❌ Patients:", err);
    buildSearchableDropdown("selectPatient", "Error loading patients", []);
  }
}

async function loadDoctorsDropdown() {
  const select = document.getElementById("selectDoctor");
  try {
    const res = await fetch("http://localhost:5000/api/users");
    if (!res.ok) throw new Error("Failed");
    const users = await res.json();

    const doctors = users.filter(u => u.role === "Doctor" && u.status === "Active");

    select.innerHTML = `<option value=""></option>` +
      doctors.map(d =>
        `<option value="${d.userId || d._id}">Dr. ${d.name}</option>`
      ).join("");

    const items = doctors.map(d => ({
      value: d.userId || d._id,
      label: `Dr. ${d.name}`,
      sub:   d.userId || d._id
    }));

    buildSearchableDropdown("selectDoctor", "Search for a doctor...", items);
    console.log(`✅ Doctors loaded: ${doctors.length}`);
  } catch (err) {
    console.error("❌ Doctors:", err);
    buildSearchableDropdown("selectDoctor", "Error loading doctors", []);
  }
}

async function loadServicesDropdown() {
  const select = document.getElementById("appType");
  try {
    const res = await fetch("http://localhost:5000/api/integrations/billing/services");
    if (!res.ok) throw new Error("Failed");
    const result = await res.json();
    if (!result.success || !result.data) throw new Error("Invalid response");

    const services = result.data;

    select.innerHTML = `<option value=""></option>` +
      services.map(s => `<option value="${s.category}">${s.category}</option>`).join("");

    const items = services.map(s => ({
      value: s.category,
      label: s.category,
      sub: [
        s.category,
        s.price ? `₱${Number(s.price).toFixed(2)}` : ""
      ].filter(Boolean).join(" · ")
    }));

    buildSearchableDropdown("appType", "Search and select a service...", items);
    console.log(`✅ Services loaded: ${services.length}`);
  } catch (err) {
    console.error("❌ Services:", err);
    buildSearchableDropdown("appType", "Search and select a service...", []);
  }
}

// ============================================================
// UTILITY HELPERS (unchanged)
// ============================================================

document.getElementById("duration").addEventListener("input", function () {
  if (this.value > 30) this.value = 30;
  if (this.value < 1)  this.value = 1;
});

function timesOverlap(startA, durationA, startB, durationB) {
  return startA < startB + durationB && startA + durationA > startB;
}

function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutes(mins) {
  const h    = Math.floor(mins / 60);
  const m    = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

async function checkDoubleBooking(patientId, doctorId, date, time, duration) {
  try {
    const response = await fetch("http://localhost:5000/api/appointments");
    if (!response.ok) return { patientConflict: null, doctorConflict: null };

    const all     = await response.json();
    const newStart = toMinutes(time);
    const dateStr  = new Date(date).toISOString().split('T')[0];

    const sameDay = all.filter(apt => {
      if (apt.status !== "Upcoming" && apt.status !== "Ongoing") return false;
      return new Date(apt.date).toISOString().split('T')[0] === dateStr;
    });

    let patientConflict = null;
    let doctorConflict  = null;

    for (const apt of sameDay) {
      const aptStart    = toMinutes(apt.time);
      const aptDuration = apt.duration || 30;
      if (!timesOverlap(newStart, duration, aptStart, aptDuration)) continue;
      if (apt.patientId === patientId && !patientConflict) patientConflict = apt;
      if (apt.doctorId  === doctorId  && !doctorConflict)  doctorConflict  = apt;
    }

    return { patientConflict, doctorConflict };
  } catch (err) {
    console.error("Error checking double-booking:", err);
    return { patientConflict: null, doctorConflict: null };
  }
}

// ============================================================
// INIT
// ============================================================

window.onload = async () => {
  await loadPatientsDropdown();
  await loadDoctorsDropdown();
  await loadServicesDropdown();

  const dateInput = document.getElementById("appDate");
  const timeInput = document.getElementById("appTime");
  const today     = new Date().toISOString().split("T")[0];
  dateInput.setAttribute("min", today);
  dateInput.addEventListener("change", validateDateTime);
  timeInput.addEventListener("change", validateDateTime);
  validateDateTime();
};

function validateDateTime() {
  const dateInput = document.getElementById("appDate");
  const timeInput = document.getElementById("appTime");
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
      timeInput.value =
        `${String(ft.getHours()).padStart(2,"0")}:${String(ft.getMinutes()).padStart(2,"0")}`;
    }
  }

  if (selectedDate && selectedDate < todayStr) {
    alert("⚠️ Cannot schedule appointment in the past. Please select today or a future date.");
    dateInput.value = todayStr;
  }
}

// ============================================================
// FORM SUBMIT
// ============================================================

document.getElementById("addPatient").addEventListener("submit", async (e) => {
  e.preventDefault();

  const patientVal  = _dropdownSelected.selectPatient.value;
  const patientName = _dropdownSelected.selectPatient.text;
  const doctorVal   = _dropdownSelected.selectDoctor.value;
  const doctorName  = _dropdownSelected.selectDoctor.text;
  const serviceVal  = _dropdownSelected.appType.value;

  const selectedDate     = document.getElementById("appDate").value;
  const selectedTime     = document.getElementById("appTime").value;
  const selectedDuration = parseInt(document.getElementById("duration").value) || 30;
  const reason           = document.getElementById("reason").value.trim();
  const notes            = document.getElementById("notes").value.trim();

  // Validation
  if (!patientVal)   { alert("❌ Please select a patient.");           return; }
  if (!doctorVal)    { alert("❌ Please select a doctor.");            return; }
  if (!serviceVal)   { alert("❌ Please select a service type.");      return; }
  if (!selectedDate) { alert("❌ Please select an appointment date."); return; }
  if (!selectedTime) { alert("❌ Please select an appointment time."); return; }
  if (!reason)       { alert("❌ Please enter a reason for visit.");   return; }

  const today    = new Date();
  const todayStr = today.toISOString().split("T")[0];

  if (selectedDate < todayStr) {
    alert("❌ Cannot schedule appointment in the past."); return;
  }
  if (selectedDate === todayStr) {
    const [sh, sm] = selectedTime.split(":").map(Number);
    if (sh < today.getHours() || (sh === today.getHours() && sm <= today.getMinutes())) {
      alert("❌ Cannot schedule appointment in the past. Please select a future time."); return;
    }
  }

  // Double-booking check
  const { patientConflict, doctorConflict } = await checkDoubleBooking(
    patientVal, doctorVal, selectedDate, selectedTime, selectedDuration
  );

  const newStart = toMinutes(selectedTime);
  const newEnd   = newStart + selectedDuration;

  if (patientConflict) {
    const cS = toMinutes(patientConflict.time);
    const cE = cS + (patientConflict.duration || 30);
    alert(
      `⚠️ PATIENT SCHEDULING CONFLICT!\n\nThis patient already has an appointment at this time.\n\n` +
      `Patient: ${patientName}\nDate: ${new Date(selectedDate).toLocaleDateString()}\n\n` +
      `Requested slot:\n  • ${formatMinutes(newStart)} – ${formatMinutes(newEnd)}\n\n` +
      `Conflicts with:\n  • Doctor: ${patientConflict.doctorName}\n` +
      `  • Time: ${formatMinutes(cS)} – ${formatMinutes(cE)}\n` +
      `  • ID: ${patientConflict.appointmentId}\n\nPlease choose a different time slot.`
    );
    return;
  }

  if (doctorConflict) {
    const cS = toMinutes(doctorConflict.time);
    const cE = cS + (doctorConflict.duration || 30);
    alert(
      `⚠️ DOCTOR SCHEDULING CONFLICT!\n\n${doctorName} already has a patient during this time.\n\n` +
      `Doctor: ${doctorName}\nDate: ${new Date(selectedDate).toLocaleDateString()}\n\n` +
      `Requested slot:\n  • ${formatMinutes(newStart)} – ${formatMinutes(newEnd)}\n\n` +
      `Conflicts with:\n  • Patient: ${doctorConflict.patientName}\n` +
      `  • Time: ${formatMinutes(cS)} – ${formatMinutes(cE)}\n` +
      `  • ID: ${doctorConflict.appointmentId}\n\nPlease choose a different slot or doctor.`
    );
    return;
  }

  // Submit
  const data = {
    patientId: patientVal, patientName,
    doctorId:  doctorVal,  doctorName,
    date:      selectedDate, time: selectedTime,
    duration:  selectedDuration,
    type:      serviceVal, reason, notes
  };

  try {
    const res    = await fetch("http://localhost:5000/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data)
    });
    const result = await res.json();

    if (res.ok) {
      alert("✅ Appointment scheduled successfully!");
      window.location.href = "Appointments.html";
    } else if (res.status === 409) {
      alert(
        `❌ DOUBLE BOOKING PREVENTED\n\n${result.message}\n\n` +
        (result.conflict
          ? `Conflict Details:\nPatient: ${result.conflict.patientName}\n` +
            `Requested Doctor: ${result.conflict.requestedDoctor}\n` +
            `Existing Doctor: ${result.conflict.existingDoctor}\n` +
            `Existing Appointment: ${result.conflict.existingAppointmentId}\n` +
            `Existing Time: ${result.conflict.existingTime} - ${result.conflict.existingEnd}\n\n` +
            result.suggestion
          : "")
      );
    } else {
      alert("❌ " + (result.message || "Error scheduling appointment"));
    }
  } catch (err) {
    console.error("Error:", err);
    alert("❌ Failed to connect to server");
  }
});