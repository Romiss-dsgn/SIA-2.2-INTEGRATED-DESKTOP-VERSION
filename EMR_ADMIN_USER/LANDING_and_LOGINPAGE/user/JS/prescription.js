// prescription.js - Complete prescription management with integrated medication functionality

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m])
  );
}

function formatPatientName(firstName, middleName, lastName) {
  const first = (firstName || '').trim();
  const middle = (middleName || '').trim();
  const last = (lastName || '').trim();
  
  if (middle && middle !== '') {
    const middleInitial = middle.charAt(0).toUpperCase() + '.';
    return `${first} ${middleInitial} ${last}`;
  }
  
  return `${first} ${last}`;
}

// ✅ ELECTRON GPU FIX: MutationObserver watches for select2-dropdown appearing in DOM
// and immediately forces it to fixed position with correct coordinates
// More reliable than select2:open event — catches dropdown at paint time
function applyElectronDropdownFix() {
  if (typeof $ === 'undefined' || !$.fn || !$.fn.select2) return;

  const fixDropdown = () => {
    const dropdown = document.querySelector('.select2-dropdown');
    const container = document.querySelector('.select2-container--open');
    if (!dropdown || !container) return;

    const inputBox = container.querySelector('.select2-selection');
    if (!inputBox) return;

    const rect = inputBox.getBoundingClientRect();

    // Apply inline styles directly on the element — overrides everything
    Object.assign(dropdown.style, {
      position: 'fixed',
      top: (rect.bottom + 2) + 'px',
      left: rect.left + 'px',
      width: rect.width + 'px',
      zIndex: '2147483647',  // max possible z-index
      background: 'white',
      backgroundColor: 'white',
      border: '1px solid #aaa',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      transform: 'none',
      willChange: 'unset',
      isolation: 'auto',
    });

    // Also fix the results container inside
    const results = dropdown.querySelector('.select2-results');
    if (results) {
      results.style.background = 'white';
      results.style.backgroundColor = 'white';
    }
  };

  // Watch for .select2-dropdown being added to the DOM
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          if (node.classList?.contains('select2-dropdown') ||
              node.querySelector?.('.select2-dropdown')) {
            // Fix immediately and again after paint
            fixDropdown();
            requestAnimationFrame(fixDropdown);
            setTimeout(fixDropdown, 10);
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also fix on select2:open as backup
  $(document).on('select2:open', () => {
    fixDropdown();
    requestAnimationFrame(fixDropdown);
    setTimeout(fixDropdown, 10);
  });

  console.log('✅ Electron MutationObserver dropdown fix active');
}

// ✅ ELECTRON FIX: Wait for jQuery + Select2 to be available before using $()
// Polls every 50ms up to 5 seconds — handles delayed preload injection
function waitForJQuery(timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (typeof window.jQuery !== 'undefined' && typeof window.jQuery.fn.select2 !== 'undefined') {
        window.$ = window.$ || window.jQuery;
        resolve(window.jQuery);
      } else if (Date.now() - start > timeout) {
        reject(new Error('jQuery/Select2 did not load within ' + timeout + 'ms'));
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const durationInput = document.getElementById("singleFollowUpDuration");
  if (durationInput) {
    durationInput.addEventListener("input", function () {
      if (this.value > 30) this.value = 30;
      if (this.value < 1) this.value = 1;
    });
  }
});

function validateDateTime() {
  const dateInput = document.getElementById("singleFollowUp");
  const timeInput = document.getElementById("singleFollowUpTime");
  if (!dateInput || !timeInput) return;

  const selectedDate = dateInput.value;
  const selectedTime = timeInput.value;
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  if (selectedDate === todayStr && selectedTime) {
    const now = new Date();
    const [selectedHours, selectedMinutes] = selectedTime.split(":").map(Number);
    if (selectedHours < now.getHours() || (selectedHours === now.getHours() && selectedMinutes <= now.getMinutes())) {
      alert("⚠️ Cannot schedule appointment in the past. Please select a future time.");
      const futureTime = new Date(now.getTime() + 30 * 60000);
      timeInput.value = `${String(futureTime.getHours()).padStart(2, "0")}:${String(futureTime.getMinutes()).padStart(2, "0")}`;
    }
  }

  if (selectedDate && selectedDate < todayStr) {
    alert("⚠️ Cannot schedule appointment in the past. Please select today or a future date.");
    dateInput.value = todayStr;
  }
}

function normalizeFormData(raw) {
  const out = {};
  for (const k of Object.keys(raw)) {
    let v = raw[k]?.trim();
    out[k] = k === "quantity" ? Number(v) || 0 : v;
  }
  return out;
}

async function loadAppointmentService(appointmentId) {
  try {
    const response = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`);
    if (!response.ok) { console.warn("Could not fetch appointment details"); return; }
    const appointment = await response.json();
    const managementDisplay = document.getElementById("managementDisplay");
    if (managementDisplay && appointment.type) {
      managementDisplay.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-check-circle text-green-600 dark:text-green-400"></i>
          </div>
          <div>
            <p class="font-bold text-green-800 dark:text-green-300">${escapeHtml(appointment.type || appointment.service)}</p>
          </div>
        </div>`;
    }
    const impressionInput = document.getElementById("impressionInput");
    if (impressionInput && appointment.impression) impressionInput.value = appointment.impression;
  } catch (error) {
    console.error("Error loading appointment service:", error);
  }
}

// ============================================
// LOAD DOCTORS DROPDOWN
// ============================================
async function loadDoctorsDropdown(selectElementId, autoFillLoggedInDoctor = false) {
  const select = document.getElementById(selectElementId);
  if (!select) return;

  try {
    const res = await fetch("http://localhost:5000/api/users");
    if (!res.ok) throw new Error(`Failed to fetch doctors (${res.status})`);
    const users = await res.json();
    const doctors = users.filter((u) => u.role === "Doctor");

    if (doctors.length === 0) { select.innerHTML = `<option value="">No doctors found</option>`; return; }

    const loggedInName = sessionStorage.getItem("name");
    const loggedInRole = sessionStorage.getItem("role");
    let selectedDoctorValue = "";
    if (autoFillLoggedInDoctor && loggedInRole === "Doctor" && loggedInName) selectedDoctorValue = `Dr. ${loggedInName}`;

    select.innerHTML = `
      <option value="">Select Doctor</option>
      ${doctors.map((d) => {
        const doctorValue = `Dr. ${d.name}`;
        const isSelected = autoFillLoggedInDoctor && doctorValue === selectedDoctorValue ? "selected" : "";
        return `<option value="${doctorValue}" ${isSelected}>${doctorValue}</option>`;
      }).join("")}`;

    if (autoFillLoggedInDoctor && loggedInRole === "Doctor" && selectedDoctorValue) {
      select.value = selectedDoctorValue;
      select.disabled = true;
      select.style.backgroundColor = "#f3f1f1";
      select.style.cursor = "not-allowed";
    }

    // ✅ Destroy existing NativeDropdown before recreating (avoid duplicates)
    const existingWrapper = document.getElementById(selectElementId)?.closest('.nd-wrapper');
    if (existingWrapper) {
      const sel = document.getElementById(selectElementId);
      existingWrapper.parentNode.insertBefore(sel, existingWrapper);
      existingWrapper.remove();
      sel.style.display = '';
    }
    const ndInst = NativeDropdown.create(document.getElementById(selectElementId), {
      placeholder: "Search for a doctor",
      allowSearch: true,
    });

    // ✅ Auto-fill and lock if logged-in user is a Doctor
    if (autoFillLoggedInDoctor && loggedInRole === "Doctor" && selectedDoctorValue && ndInst) {
      ndInst.setValue(selectedDoctorValue, selectedDoctorValue);
      // Disable the box visually
      const box = ndInst.wrapper.querySelector('.nd-box');
      if (box) {
        box.style.pointerEvents = 'none';
        box.style.opacity = '0.7';
        box.style.backgroundColor = '#f3f1f1';
        box.style.cursor = 'not-allowed';
      }
    }
  } catch (err) {
    console.error("Error loading doctors:", err);
    select.innerHTML = `<option value="">Error loading doctors</option>`;
  }
}

// ============================================
// LOAD SERVICES DROPDOWN
// ============================================
async function loadServicesDropdown() {
  const select = document.getElementById("singleService");
  if (!select) return;

  // ✅ Destroy existing NativeDropdown instance to avoid duplicates on re-load
  const existingWrapper = select.closest('.nd-wrapper');
  if (existingWrapper) {
    // Move select back out before destroying
    existingWrapper.parentNode.insertBefore(select, existingWrapper);
    existingWrapper.remove();
    select.style.display = '';
  }

  // ✅ Default integration to ON (per adminSettings always-ON policy)
  let integrationStatus = { pharmacy: true, billing: true, emr: true };
  try {
    const statusRes = await fetch("http://localhost:5000/api/integration/status");
    const fetched = await statusRes.json();
    integrationStatus = {
      pharmacy: fetched.pharmacy !== false,
      billing: fetched.billing !== false,
      emr: fetched.emr !== false,
    };
  } catch (err) {
    console.warn("Integration status unreachable, defaulting all ON");
  }

  const buildNativeDropdown = () => {
    NativeDropdown.create(document.getElementById('singleService'), {
      placeholder: "Search and select a service...",
      allowSearch: true,
    });
  };

  // EMR-only fallback (no external integration)
  if (!integrationStatus.billing) {
    const defaultServices = [
      { service: "General Consultation", category: "Consultation Services", price: 500 },
      { service: "Follow-up Consultation", category: "Consultation Services", price: 300 },
      { service: "Medical Certificate", category: "Documentation", price: 200 },
      { service: "Laboratory Tests", category: "Diagnostic Services", price: 1000 },
      { service: "Physical Examination", category: "Consultation Services", price: 400 }
    ];
    select.innerHTML = '<option value="">Search and select a service...</option>';
    defaultServices.forEach((svc) => {
      const opt = document.createElement("option");
      opt.value = svc.service;
      opt.textContent = `${svc.service}${svc.category ? ` (${svc.category})` : ""}${svc.price ? ` - ₱${svc.price.toFixed(2)}` : ""}`;
      opt.setAttribute("data-price", svc.price || 0);
      opt.setAttribute("data-category", svc.category || "");
      select.appendChild(opt);
    });
    buildNativeDropdown();
    return;
  }

  // ✅ Fetch from billing integration
  try {
    const res = await fetch("http://localhost:5000/api/integrations/billing/services");
    if (!res.ok) throw new Error("Failed to fetch services");
    const result = await res.json();
    if (!result.success || !result.data) throw new Error("Invalid response from services API");
    const services = result.data;
    if (services.length === 0) {
      select.innerHTML = `<option value="">No services found</option>`;
      buildNativeDropdown();
      return;
    }
    select.innerHTML = '<option value="">Search and select a service...</option>';
    services.forEach((svc) => {
      const opt = document.createElement("option");
      opt.value = svc.service;
      opt.textContent = `${svc.service}${svc.category && svc.category !== "Consultation Services" ? ` (${svc.category})` : ""}${svc.price ? ` - ₱${svc.price.toFixed(2)}` : ""}`;
      opt.setAttribute("data-price", svc.price || 0);
      opt.setAttribute("data-category", svc.category || "");
      opt.setAttribute("data-code", svc.code || "");
      select.appendChild(opt);
    });
    buildNativeDropdown();
  } catch (err) {
    console.error("❌ Error loading services from billing:", err);
    // Fall back to default services on error
    const defaultServices = [
      { service: "General Consultation", category: "Consultation Services", price: 500 },
      { service: "Follow-up Consultation", category: "Consultation Services", price: 300 },
      { service: "Medical Certificate", category: "Documentation", price: 200 },
      { service: "Laboratory Tests", category: "Diagnostic Services", price: 1000 },
      { service: "Physical Examination", category: "Consultation Services", price: 400 }
    ];
    select.innerHTML = '<option value="">Search and select a service...</option>';
    defaultServices.forEach((svc) => {
      const opt = document.createElement("option");
      opt.value = svc.service;
      opt.textContent = `${svc.service} (${svc.category}) - ₱${svc.price.toFixed(2)}`;
      select.appendChild(opt);
    });
    buildNativeDropdown();
  }
}

// ============================================
// CREATE MEDICATION FORM — with Duration & Indication
// ============================================
function createMedicationForm(index, existingMed = null, isReadOnly = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "medecineCon bg-slate-50 border border-slate-200 rounded-xl p-5 mb-4";

  // ✅ Duration: maintain checkbox + days input
  const isMaintain = existingMed?.durationMaintain === true || existingMed?.durationMaintain === "true";
  const durationDays = existingMed?.durationDays || "";

  wrapper.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-base font-bold text-primary">Medication ${index}</h3>
      <button type="button" class="deleteMed flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer" data-id="${existingMed?.medId || ""}">
        <i class="fa-solid fa-trash text-sm pointer-events-none"></i>
      </button>
    </div>

    <form class="patientForm grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Medication Name</label>
        <select id="medicineSelect${index}" class="medicineSelect w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" name="medicname" required></select>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Frequency</label>
        <select id="freqSelect${index}" class="freqSelect w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" name="frequency" required></select>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dosage</label>
        <select id="dosageSelect${index}" class="dosageInput w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" name="dosage" required></select>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quantity</label>
        <input type="number" name="quantity" value="${existingMed?.quantity || ""}" placeholder="e.g. 10" required
          class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Prescribed By</label>
        <select id="selectPrescriber${index}" name="presby" required
          class="w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"></select>
      </div>

      <!-- ✅ DURATION FIELD -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Duration</label>
        <div class="flex flex-col gap-2">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" name="durationMaintain" id="maintainCheck${index}"
              class="w-4 h-4 rounded accent-primary cursor-pointer"
              ${isMaintain ? "checked" : ""} />
            <span class="text-sm font-semibold text-slate-700">Maintain (ongoing)</span>
          </label>
          <div id="daysWrapper${index}" class="flex items-center gap-2 ${isMaintain ? 'hidden' : ''}">
            <input type="number" name="durationDays" id="durationDays${index}"
              value="${durationDays}"
              min="1" max="365" placeholder="No. of days"
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            <span class="text-sm text-slate-500 whitespace-nowrap">day(s)</span>
          </div>
        </div>
      </div>

      <!-- ✅ INDICATION FIELD -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Indication</label>
        <input type="text" name="indication" value="${existingMed?.indication || ""}" placeholder="Reason for this medicine"
          class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
      </div>

      <div class="flex flex-col gap-1 md:col-span-2">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Prescription Notes</label>
        <input type="text" name="presNotes" value="${existingMed?.presNotes || ""}" placeholder="e.g. Take after meals"
          class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
      </div>
    </form>
  `;

  // ✅ Toggle days input when maintain checkbox is clicked
  setTimeout(() => {
    const check = wrapper.querySelector(`#maintainCheck${index}`);
    const daysWrapper = wrapper.querySelector(`#daysWrapper${index}`);
    const daysInput = wrapper.querySelector(`#durationDays${index}`);
    if (check && daysWrapper) {
      check.addEventListener("change", () => {
        if (check.checked) {
          daysWrapper.classList.add("hidden");
          if (daysInput) daysInput.value = "";
        } else {
          daysWrapper.classList.remove("hidden");
        }
      });
    }
  }, 0);

  return wrapper;
}

// ============================================
// ACTIVATE MEDICINE SEARCH
// ============================================
// ============================================================
// NATIVE DROPDOWN — Zero Electron GPU issues
// Drop-in replacement for Select2 usage in prescription.js
// ============================================================

window.NativeDropdown = (function () {

  // Track all instances so we can close others when one opens
  const instances = new Map();

  // Close all open dropdowns except the one with this id
  function closeAll(exceptId) {
    instances.forEach((inst, id) => {
      if (id !== exceptId) inst.close();
    });
  }

  // Close all on outside click
  document.addEventListener('mousedown', (e) => {
    instances.forEach((inst) => {
      if (!inst.wrapper.contains(e.target)) inst.close();
    });
  });

  // ── Build a native dropdown that wraps a <select> element ──
  function create(selectEl, options = {}) {
    if (!selectEl) return;

    const id = selectEl.id || ('nd_' + Math.random().toString(36).slice(2));
    selectEl.id = id;

    // Hide the real <select>
    selectEl.style.display = 'none';

    // ── Wrapper ──
    const wrapper = document.createElement('div');
    wrapper.className = 'nd-wrapper';
    wrapper.style.cssText = 'position:relative; width:100%; font-size:0.875rem;';
    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);

    // ── Selected display box ──
    const box = document.createElement('div');
    box.className = 'nd-box';
    box.style.cssText = `
      display:flex; align-items:center; justify-content:space-between;
      min-height:42px; padding:6px 12px; border:1px solid #e2e8f0;
      border-radius:0.5rem; background:#fff; cursor:pointer;
      color:#1e293b; user-select:none; box-sizing:border-box;
    `;
    wrapper.appendChild(box);

    const boxText = document.createElement('span');
    boxText.className = 'nd-box-text';
    boxText.style.cssText = 'flex:1; color:#94a3b8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    boxText.textContent = options.placeholder || 'Select...';
    box.appendChild(boxText);

    const arrow = document.createElement('span');
    arrow.style.cssText = 'margin-left:8px; color:#94a3b8; font-size:12px; transition:transform 0.2s;';
    arrow.textContent = '▼';
    box.appendChild(arrow);

    // ── Dropdown panel — appended to BODY, position:fixed ──
    const panel = document.createElement('div');
    panel.className = 'nd-panel';
    panel.style.cssText = `
      display:none; position:fixed; z-index:2147483647;
      background:#fff; border:1px solid #cbd5e1;
      border-radius:0.5rem; box-shadow:0 8px 24px rgba(0,0,0,0.15);
      overflow:hidden; box-sizing:border-box;
    `;
    document.body.appendChild(panel);

    // ── Search input (shown only if allowSearch) ──
    let searchInput = null;
    if (options.allowSearch !== false) {
      const searchWrap = document.createElement('div');
      searchWrap.style.cssText = 'padding:8px; border-bottom:1px solid #e2e8f0;';
      searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search...';
      searchInput.style.cssText = `
        width:100%; padding:6px 10px; border:1px solid #e2e8f0;
        border-radius:6px; font-size:0.8rem; outline:none;
        color:#1e293b; background:#fff; box-sizing:border-box;
      `;
      searchInput.addEventListener('input', () => renderOptions(searchInput.value));
      searchWrap.appendChild(searchInput);
      panel.appendChild(searchWrap);
    }

    // ── Options list ──
    const list = document.createElement('div');
    list.style.cssText = 'max-height:200px; overflow-y:auto;';
    panel.appendChild(list);

    // ── Data store ──
    let allOptions = [];
    let selectedValue = null;
    let selectedText = null;
    let isOpen = false;
    let ajaxFn = options.ajax || null;
    let ajaxTimer = null;

    function gatherSelectOptions() {
      allOptions = [];
      Array.from(selectEl.options).forEach(opt => {
        if (opt.value !== '') {
          allOptions.push({ id: opt.value, text: opt.text, data: opt.dataset });
        }
      });
    }

    function renderOptions(filter = '') {
      list.innerHTML = '';
      const filtered = filter
        ? allOptions.filter(o => o.text.toLowerCase().includes(filter.toLowerCase()))
        : allOptions;

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding:10px 14px; color:#94a3b8; font-size:0.8rem;';
        empty.textContent = filter ? 'No results found' : 'No options available';
        list.appendChild(empty);
        return;
      }

      filtered.forEach(opt => {
        const item = document.createElement('div');
        item.style.cssText = `
          padding:8px 14px; cursor:pointer; color:#1e293b;
          background:${opt.id === selectedValue ? '#f0fdf4' : '#fff'};
          font-size:0.875rem;
        `;
        // Show dosage hint if available (from pharmacy ajax results)
        if (opt.dosage && opt.dosage !== 'no available dosage') {
          item.innerHTML = `<span style="font-weight:500">${opt.text}</span><span style="color:#94a3b8;font-size:0.75rem;margin-left:6px">${opt.dosage}</span>`;
        } else {
          item.textContent = opt.text;
        }
        item.addEventListener('mouseenter', () => { if (opt.id !== selectedValue) item.style.background = '#f8fafc'; });
        item.addEventListener('mouseleave', () => { if (opt.id !== selectedValue) item.style.background = '#fff'; });
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          // Pass the FULL opt object so dosage/frequency reach the nd:select handler
          selectOption(opt.id, opt.text, opt);
        });
        list.appendChild(item);
      });
    }

    function renderAjaxOptions(results) {
      allOptions = results;
      renderOptions(searchInput ? searchInput.value : '');
    }

    function selectOption(value, text, optData) {
      selectedValue = value;
      selectedText = text;
      boxText.textContent = text;
      boxText.style.color = '#1e293b';

      // Update the real <select>
      let opt = selectEl.querySelector(`option[value="${value}"]`);
      if (!opt) {
        opt = new Option(text, value, true, true);
        selectEl.appendChild(opt);
      }
      selectEl.value = value;

      // Fire change event on the real select
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));

      // Fire nd:select with full option data (includes dosage, frequency from ajax)
      const customEvent = new CustomEvent('nd:select', {
        bubbles: true,
        detail: { id: value, text: text, ...optData, data: optData }
      });
      selectEl.dispatchEvent(customEvent);

      close();
    }

    function positionPanel() {
      const rect = box.getBoundingClientRect();
      panel.style.left = rect.left + 'px';
      panel.style.top = (rect.bottom + 2) + 'px';
      panel.style.width = rect.width + 'px';
      // Flip up if not enough space below
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 220 && rect.top > 220) {
        panel.style.top = (rect.top - panel.offsetHeight - 2) + 'px';
      }
    }

    function open() {
      if (isOpen) return;
      closeAll(id);
      isOpen = true;
      panel.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
      box.style.borderColor = '#065f46';
      box.style.boxShadow = '0 0 0 2px rgba(6,95,70,0.12)';
      gatherSelectOptions();
      positionPanel();

      if (ajaxFn && searchInput) {
        list.innerHTML = '<div style="padding:10px 14px;color:#94a3b8;font-size:0.8rem;">Type to search...</div>';
      } else {
        renderOptions();
      }

      if (searchInput) {
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 10);
      }
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      panel.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
      box.style.borderColor = '#e2e8f0';
      box.style.boxShadow = 'none';
    }

    // Ajax search
    if (ajaxFn && searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value;
        if (!q) return;
        clearTimeout(ajaxTimer);
        list.innerHTML = '<div style="padding:10px 14px;color:#94a3b8;font-size:0.8rem;">Searching...</div>';
        ajaxTimer = setTimeout(() => {
          ajaxFn(q, (results) => renderAjaxOptions(results), () => {
            list.innerHTML = '<div style="padding:10px 14px;color:#94a3b8;font-size:0.8rem;">No results</div>';
          });
        }, 300);
      });
    }

    box.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isOpen ? close() : open();
    });

    // Reposition on scroll/resize
    window.addEventListener('scroll', () => { if (isOpen) positionPanel(); }, true);
    window.addEventListener('resize', () => { if (isOpen) positionPanel(); });

    // Public API
    const inst = {
      wrapper,
      open,
      close,
      setValue(value, text) {
        selectedValue = value;
        selectedText = text;
        if (text) {
          boxText.textContent = text;
          boxText.style.color = '#1e293b';
        }
        if (value) selectEl.value = value;
      },
      getValue() { return selectedValue; },
      setOptions(opts) { allOptions = opts; },
      setPlaceholder(text) {
        if (!selectedValue) {
          boxText.textContent = text;
          boxText.style.color = '#94a3b8';
        }
      },
      destroy() {
        panel.remove();
        wrapper.replaceWith(selectEl);
        instances.delete(id);
      }
    };

    instances.set(id, inst);
    return inst;
  }

  return { create, closeAll };
})();


// ============================================================
// MEDICINE SEARCH — uses NativeDropdown instead of Select2
// ============================================================
async function activateMedicineSearch(medSelector, freqSelector, dosageSelector) {
  const medEl = document.querySelector(medSelector);
  const freqEl = document.querySelector(freqSelector);
  const dosageEl = document.querySelector(dosageSelector);
  if (!medEl || !freqEl || !dosageEl) return;

  // ── Frequency dropdown (static options) ──
  const freqOptions = [
    { id: "Once a day", text: "Once a day" },
    { id: "2x a day", text: "2x a day" },
    { id: "3x a day", text: "3x a day" },
    { id: "Every 8 hours", text: "Every 8 hours" },
    { id: "Every 12 hours", text: "Every 12 hours" },
    { id: "As needed", text: "As needed" },
  ];
  freqOptions.forEach(o => {
    if (!freqEl.querySelector(`option[value="${o.id}"]`)) {
      freqEl.appendChild(new Option(o.text, o.id));
    }
  });
  const freqInst = NativeDropdown.create(freqEl, { placeholder: 'Select frequency', allowSearch: false });

  // ── Dosage dropdown (tags — user can type custom values) ──
  const dosageInst = NativeDropdown.create(dosageEl, { placeholder: 'Select or type dosage' });

  // ── Medicine search dropdown (ajax) ──
  const medInst = NativeDropdown.create(medEl, {
    placeholder: 'Search medicine...',
    allowSearch: true,
    ajax: async (searchTerm, success, failure) => {
      let integrationStatus = { pharmacy: true, billing: true, emr: true }; // ✅ default ON per adminSettings
      try {
        const statusRes = await fetch("http://localhost:5000/api/integration/status");
        const fetched = await statusRes.json();
        // Always treat as ON (per adminSettings always-ON policy)
        integrationStatus = {
          pharmacy: fetched.pharmacy !== false,
          billing: fetched.billing !== false,
          emr: fetched.emr !== false,
        };
      } catch (err) {
        // Server unreachable — use defaults (all ON)
        console.warn("Integration status unreachable, defaulting to ON");
      }

      const formatMedicineData = (data) => data.map((m) => {
        let extractedDosage = m.strength || m.dosage || (m.name.match(/\d+\s?(mg|ML|ml|MG)/i) || [])[0] || "no available dosage";
        return { id: m.name, text: m.name, dosage: extractedDosage, frequency: "Once a day" };
      });

      // ✅ Always try pharmacy search (integration always ON)
      // Try internal pharmacy DB first
      try {
        const res = await fetch(`http://localhost:5000/api/pharmacydb/pharmacy-medicines?search=${encodeURIComponent(searchTerm)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) { success(formatMedicineData(data)); return; }
        }
      } catch (e) { console.warn("pharmacy-medicines endpoint failed:", e.message); }

      // Try EMR medicines endpoint
      try {
        const emrRes = await fetch(`http://localhost:5000/api/pharmacydb/medicines?search=${encodeURIComponent(searchTerm)}`);
        if (emrRes.ok) {
          const data = await emrRes.json();
          if (data && data.length > 0) { success(formatMedicineData(data)); return; }
        }
      } catch (e) { console.warn("medicines endpoint failed:", e.message); }

      // Try external pharmacy API
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`http://localhost:5001/api/medicines/search?search=${encodeURIComponent(searchTerm)}`, {
          headers: { Authorization: `Bearer PharmacyDBKey12345` }, signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) { success(formatMedicineData(await res.json())); return; }
      } catch (e) { console.warn("external pharmacy API failed:", e.message); }

      success([]); // All sources exhausted
    }
  });

  // ── When a medicine is selected, auto-fill frequency and dosage ──
  medEl.addEventListener('nd:select', (e) => {
    const med = e.detail;
    console.log('Medicine selected:', med);

    // Auto-fill frequency
    const freq = med.frequency || med.data?.frequency;
    if (freq && freqInst) {
      freqInst.setValue(freq, freq);
      console.log('✅ Frequency set to:', freq);
    }

    // Auto-fill dosage and make it read-only
    const dosage = med.dosage || med.data?.dosage;
    if (dosage && dosage !== 'no available dosage' && dosageInst) {
      const dosageEl2 = document.querySelector(dosageSelector);
      if (dosageEl2 && !dosageEl2.querySelector(`option[value="${dosage}"]`)) {
        dosageEl2.appendChild(new Option(dosage, dosage));
      }
      dosageInst.setValue(dosage, dosage);
      // ✅ Lock dosage box — auto-filled, not user-editable
      const dosageBox = dosageInst.wrapper?.querySelector('.nd-box');
      if (dosageBox) {
        dosageBox.style.pointerEvents = 'none';
        dosageBox.style.backgroundColor = '#f8fafc';
        dosageBox.style.cursor = 'default';
        dosageBox.style.opacity = '0.85';
      }
      console.log('✅ Dosage set to:', dosage);
    } else {
      // No dosage from pharmacy — leave dosage editable
      const dosageBox = dosageInst?.wrapper?.querySelector('.nd-box');
      if (dosageBox) {
        dosageBox.style.pointerEvents = '';
        dosageBox.style.backgroundColor = '';
        dosageBox.style.cursor = 'pointer';
        dosageBox.style.opacity = '';
      }
      console.warn('⚠️ No dosage in medicine data, leaving editable:', med);
    }
  });
}

// ============================================
// INITIALIZE READ-ONLY MEDICATION FORM
// ============================================
async function initializeReadOnlyMedication(index, existingMed) {
  // ✅ ELECTRON FIX: Ensure jQuery/Select2 ready
  await waitForJQuery().catch(err => console.error('initializeReadOnlyMedication:', err));
  await loadDoctorsDropdown(`selectPrescriber${index}`);

  const medicineSelect = $(`#medicineSelect${index}`);
  const freqSelect = $(`#freqSelect${index}`);
  const prescriberSelect = $(`#selectPrescriber${index}`);

  const defaultFrequencies = [
    { id: "Once a day", text: "Once a day" },
    { id: "2x a day", text: "2x a day" },
    { id: "3x a day", text: "3x a day" },
    { id: "Every 8 hours", text: "Every 8 hours" },
    { id: "Every 12 hours", text: "Every 12 hours" },
    { id: "As needed", text: "As needed" },
  ];

  // ✅ NativeDropdown for read-only medication form
  defaultFrequencies.forEach(o => {
    if (!freqSelect[0].querySelector(`option[value="${o.id}"]`))
      freqSelect[0].appendChild(new Option(o.text, o.id));
  });
  NativeDropdown.create(freqSelect[0], { placeholder: "Select frequency", allowSearch: false });
  NativeDropdown.create(medicineSelect[0], { placeholder: "Medicine name", allowSearch: true });

  if (existingMed.medicname) {
    const medicineOption = new Option(existingMed.medicname, existingMed.medicname, true, true);
    medicineSelect.append(medicineOption).trigger("change");
  }
  if (existingMed.frequency) freqSelect.val(existingMed.frequency).trigger("change");

  const dosageSelect = $(`#dosageSelect${index}`);
  NativeDropdown.create(dosageSelect[0], { placeholder: 'Dosage', allowSearch: true }); // ✅ NativeDropdown
  if (existingMed.dosage) {
    const dosageOption = new Option(existingMed.dosage, existingMed.dosage, true, true);
    dosageSelect.append(dosageOption).trigger("change");
  }

  if (existingMed.presby) prescriberSelect.val(existingMed.presby).trigger("change");

  setTimeout(() => {
    const form = document.getElementById(`medicineSelect${index}`)?.closest(".patientForm");
    if (!form) return;
    form.querySelectorAll("input:not([type='hidden']), select").forEach((input) => {
      input.disabled = true;
      if ($(input).hasClass("select2-hidden-accessible")) $(input).prop("disabled", true).trigger("change");
    });
    form.style.opacity = "0.7";
    form.style.pointerEvents = "none";
  }, 100);
}

// ============================================
// LOAD MEDICATIONS
// ============================================
async function loadMedications(patientId) {
  const medicationsContainer = document.getElementById("medicationsContainer");
  if (!medicationsContainer) return;

  try {
    const res = await fetch(`http://localhost:5000/api/patients/${patientId}/medications?isHistory=false`);
    if (!res.ok) throw new Error(`Failed to load meds (${res.status})`);
    const meds = await res.json();
    medicationsContainer.innerHTML = "";

    if (meds.length === 0) {
      medicationsContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-slate-400">
          <i class="fa-solid fa-pills text-4xl mb-3 opacity-30"></i>
          <p class="text-sm font-medium">No medications yet</p>
        </div>`;
      return;
    }

    for (let idx = 0; idx < meds.length; idx++) {
      const formWrapper = createMedicationForm(idx + 1, meds[idx], true);
      medicationsContainer.appendChild(formWrapper);
      await initializeReadOnlyMedication(idx + 1, meds[idx]);
    }

    setTimeout(() => {
      document.querySelectorAll(".deleteMed").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const medId = btn.dataset.id;
          if (!medId || !confirm("Delete this medication?")) return;
          try {
            const res = await fetch(`http://localhost:5000/api/medications/${medId}`, { method: "DELETE" });
            if (res.ok) { alert("Medication deleted!"); await loadMedications(patientId); }
            else alert("Failed to delete medication.");
          } catch (err) { console.error(err); alert("Error deleting medication."); }
        });
      });
    }, 200);
  } catch (err) {
    console.error("Error loading medications:", err);
    if (medicationsContainer) medicationsContainer.innerHTML = `<p class="text-red-500 text-center py-4">Failed to load medications.</p>`;
  }
}

// ============================================
// LOAD PRESCRIPTION MEDICATIONS — with Duration & Indication columns
// ============================================
// ============================================
// LOAD PRESCRIPTION MEDICATIONS — COMPLETE WITH DURATION FIX
// ============================================
// FIND THIS FUNCTION IN prescription.js (around line 800-900)
// Replace the entire function

async function loadPrescriptionMedications(patientId, appointmentId) {
  try {
    const res = await fetch(`http://localhost:5000/api/patients/${patientId}/medications`);
    if (!res.ok) { console.warn("Failed to fetch medications:", res.status); return; }

    const medications = await res.json();
    const appointmentMeds = medications.filter((m) => m.appointmentId === appointmentId && !m.isHistory);
    const contentContainer = document.getElementById("prescriptionMedicationsContent");
    if (!contentContainer) return;

    if (appointmentMeds.length > 0) {
      contentContainer.innerHTML = `
        <div class="overflow-hidden rounded-xl border border-slate-100">
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-gradient-to-r from-emerald-100 to-rose-100">
                <th class="px-6 py-4 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">Medicine</th>
                <th class="px-6 py-4 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">Dosage</th>
                <th class="px-6 py-4 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">Frequency</th>
                <th class="px-6 py-4 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">Quantity</th>
                <th class="px-6 py-4 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">Duration</th>
                <th class="px-6 py-4 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">Indication</th>
                <th class="px-6 py-4 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">Notes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              ${appointmentMeds.map((m) => {
                // ✅ Format duration display - CHECK DURATION FIELD FIRST
                let durationDisplay = "—";
                
                if (m.duration) {
                  // If duration field exists, use it directly
                  if (m.duration.toLowerCase() === "maintain") {
                    durationDisplay = '<span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Maintain</span>';
                  } else {
                    durationDisplay = m.duration;
                  }
                } else {
                  // Fallback to old method
                  const isMaintain = m.durationMaintain === true || m.durationMaintain === "true" || m.durationMaintain === "on";
                  durationDisplay = isMaintain
                    ? '<span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Maintain</span>'
                    : m.durationDays ? `${m.durationDays} day(s)` : "—";
                }
                
                return `
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="px-6 py-4 text-sm font-bold text-primary">${m.medicname || "N/A"}</td>
                  <td class="px-6 py-4 text-sm text-slate-700">${m.dosage || "N/A"}</td>
                  <td class="px-6 py-4 text-sm text-slate-700">${m.frequency || "N/A"}</td>
                  <td class="px-6 py-4 text-sm text-slate-700">${m.quantity || 0}</td>
                  <td class="px-6 py-4 text-sm text-slate-700">${durationDisplay}</td>
                  <td class="px-6 py-4 text-sm text-slate-700">${m.indication || "—"}</td>
                  <td class="px-6 py-4 text-sm text-slate-700">${m.presNotes || "—"}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>`;
    } else {
      contentContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-10 text-slate-400">
          <i class="fa-solid fa-prescription-bottle-medical text-4xl mb-3 opacity-30"></i>
          <p class="text-sm font-medium">No medications added yet. Click "Add Prescription" to add medications.</p>
        </div>`;
    }
  } catch (err) {
    console.error("Error loading prescription medications:", err);
  }
}

// ============================================
// MAIN DOCUMENT READY
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const isPrescriptionPage = window.location.href.includes("Prescription.html");
  const isMedicationsPage = window.location.href.includes("Medications.html");

  const urlParams = new URLSearchParams(window.location.search);
  let appointmentId = urlParams.get("appointmentId");
  let patientId = urlParams.get("patientId");

  if (isPrescriptionPage) {
    if (!appointmentId || !patientId) {
      alert("Missing appointment or patient information. Redirecting to appointments...");
      window.location.href = "Appointments.html";
      return;
    }
    window.currentPrescriptionAppointment = { appointmentId, patientId };
    loadPrescriptionMedications(patientId, appointmentId);
    loadAppointmentService(appointmentId);
    loadServicesDropdown();
    setupPrintFunctionality(patientId, appointmentId);
  }

  else if (isMedicationsPage) {
    if (!patientId) patientId = new URLSearchParams(window.location.search).get("patientId");
    if (window.currentPrescriptionAppointment) patientId = window.currentPrescriptionAppointment.patientId;
    if (!patientId) { alert("No patient selected!"); return; }

    async function loadPatientHeader() {
      try {
        const res = await fetch(`http://localhost:5000/api/patients/${patientId}`);
        if (!res.ok) throw new Error("Patient not found");
        const p = await res.json();
        const headerH1 = document.querySelector("header h1");
        if (headerH1) headerH1.textContent = `Patient Information - ${p.firstname || ""} ${p.lastname || ""}`;
      } catch (err) { console.error("Error loading patient header:", err); }
    }
    loadPatientHeader();

    document.querySelectorAll("nav-bar a").forEach((link) => {
      const href = link.getAttribute("href");
      if (href && !href.includes("?patientId=")) link.setAttribute("href", `${href}?patientId=${patientId}`);
    });

    loadMedications(patientId);
    loadServicesDropdown();
    setupMedicationsPageFunctionality(patientId);
  }

  if (isPrescriptionPage) {
    let medCount = 0;
    const medicationsContainer = document.getElementById("medicationsContainer");
    const saveBtn = document.getElementById("saveMedicationsBtn");
    const cancelBtn = document.getElementById("cancelMedicationsBtn");
    const buttonCon = document.getElementById("buttonCon");

    window.initPrescriptionMedicationForm = async function (patientId) {
  // ✅ Apply Electron GPU compositor fix for dropdowns
  await waitForJQuery().then(applyElectronDropdownFix).catch(() => {});
      const container = document.getElementById("medicationsContainer");
      if (!container) return;
      window.currentPatientId = patientId;
      await loadServicesDropdown();
      const existingForms = container.querySelectorAll(".medecineCon");
      if (existingForms.length === 0) {
        const currentMedCount = existingForms.length + 1;
        const form = createMedicationForm(currentMedCount);
        container.appendChild(form);
        await activateMedicineSearch(`#medicineSelect${currentMedCount}`, `#freqSelect${currentMedCount}`, `#dosageSelect${currentMedCount}`);
        await loadDoctorsDropdown(`selectPrescriber${currentMedCount}`, true);
        if (buttonCon) buttonCon.style.display = "flex";
      }
    };

    window.addMedicationForm = async function () {
      const container = document.getElementById("medicationsContainer");
      if (!container) return;
      const existingForms = container.querySelectorAll(".medecineCon");
      const currentMedCount = existingForms.length + 1;
      const form = createMedicationForm(currentMedCount);
      container.appendChild(form);
      await activateMedicineSearch(`#medicineSelect${currentMedCount}`, `#freqSelect${currentMedCount}`, `#dosageSelect${currentMedCount}`);
      await loadDoctorsDropdown(`selectPrescriber${currentMedCount}`, true);
      if (buttonCon) buttonCon.style.display = "flex";
    };

    window.createMedicationForm = createMedicationForm;
    window.activateMedicineSearch = activateMedicineSearch;
    window.loadDoctorsDropdown = loadDoctorsDropdown;
    window.loadServicesDropdown = loadServicesDropdown;

    window.openPrescriptionPage = async function () {
      const { patientId: currentPatientId, appointmentId: currentAppointmentId } = window.currentPrescriptionAppointment;
      if (currentPatientId && currentAppointmentId) {
        sessionStorage.setItem("currentAppointmentId", currentAppointmentId);
        const formContainer = document.getElementById("medicationFormContainer");
        if (formContainer) {
          formContainer.style.display = "block";
          const medicationsContainer = document.getElementById("medicationsContainer");
          if (medicationsContainer) {
            medicationsContainer.innerHTML = "";
            const addMedBtn = document.createElement("button");
            addMedBtn.id = "addMedBtnPrescription";
            addMedBtn.innerHTML = `<i class="fas fa-plus-circle mr-2"></i> Add Another Medication`;
            addMedBtn.className = "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary text-primary font-semibold hover:bg-brand-light transition-all text-sm mb-4 bg-transparent cursor-pointer";
            addMedBtn.addEventListener("click", async (e) => {
              e.preventDefault();
              if (window.addMedicationForm) await window.addMedicationForm();
            });
            medicationsContainer.appendChild(addMedBtn);
            if (window.initPrescriptionMedicationForm) await window.initPrescriptionMedicationForm(currentPatientId);
          }
          if (buttonCon) buttonCon.style.display = "flex";
          formContainer.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        const formContainer = document.getElementById("medicationFormContainer");
        if (formContainer) formContainer.style.display = "none";
        if (medicationsContainer) medicationsContainer.innerHTML = "";
        medCount = 0;
        if (buttonCon) buttonCon.style.display = "none";
      });
    }

    // ============================================
// SAVE MEDICATIONS BUTTON - COMPLETE WITH DURATION FIX
// ============================================
// FIND THIS SECTION IN prescription.js (around line 1100-1200)
// Replace the entire saveBtn.addEventListener("click", async () => { ... section

if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const allForms = [...document.querySelectorAll(".patientForm")];
    const newForms = allForms.filter((form) => !form.querySelector("input")?.disabled);
    if (newForms.length === 0) { alert("No new medications to save."); return; }

    const formsWithMedications = newForms.filter((form) => {
      const medicnameSelect = form.querySelector('select[name="medicname"]');
      return (medicnameSelect?.value || "").trim() !== "";
    });
    if (formsWithMedications.length === 0) { alert("Please select at least one medication before saving."); return; }

    const medData = formsWithMedications.map((f) => {
      const formData = new FormData(f);
      const data = normalizeFormData(Object.fromEntries(formData));

      const prescriberSelect = f.querySelector('select[name="presby"]');
      if (prescriberSelect) data.presby = prescriberSelect.value || "N/A";

      const dosageInput = f.querySelector('.dosageInput');
      if (dosageInput) data.dosage = dosageInput.value || "";

      const frequencySelect = f.querySelector('.freqSelect');
      if (frequencySelect) data.frequency = frequencySelect.value || "";

      const medicineSelect = f.querySelector('.medicineSelect');
      if (medicineSelect) data.medicname = medicineSelect.value || "";

      // ✅ Capture duration fields
      const maintainCheck = f.querySelector('input[name="durationMaintain"]');
      data.durationMaintain = maintainCheck ? maintainCheck.checked : false;
      const daysInput = f.querySelector('input[name="durationDays"]');
      data.durationDays = (!data.durationMaintain && daysInput?.value) ? parseInt(daysInput.value) : null;

      // ✅ BUILD DURATION STRING FOR DATABASE
      if (data.durationMaintain || data.durationMaintain === "on") {
        data.duration = "Maintain";
      } else if (data.durationDays && data.durationDays > 0) {
        data.duration = `${data.durationDays} day(s)`;
      } else {
        data.duration = "";
      }

      // ✅ Capture indication (read directly from DOM, not FormData)
      const indicationInput = f.querySelector('input[name="indication"]');
      data.indication = indicationInput ? indicationInput.value.trim() : "";

      // ✅ Remove FormData's "on" string for durationMaintain (checkbox quirk)
      if (data.durationMaintain === "on") data.durationMaintain = true;

      return data;
    });

    const tempAppointmentId = sessionStorage.getItem("currentAppointmentId") || appointmentId;
    const followupTime = document.getElementById("singleFollowUpTime")?.value || null;
    const followupDate = document.getElementById("singleFollowUp")?.value || null;

    try {
      const savedMedIds = [];
      for (const med of medData) {
        const medWithAppointment = {
          ...med,
          presby: med.presby || "N/A",
          appointmentId: tempAppointmentId || null,
          followupTime,
          followup: followupDate || null,
          // ✅ Explicitly include new fields so they're not dropped by spread
          durationMaintain: med.durationMaintain === true || med.durationMaintain === "on",
          durationDays: (med.durationMaintain === true || med.durationMaintain === "on") ? null : (med.durationDays || null),
          duration: med.duration || "",  // ✅ ADD DURATION STRING
          indication: med.indication || "",
        };

        const res = await fetch(`http://localhost:5000/api/patients/${patientId}/medications`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(medWithAppointment),
        });

        if (res.ok) {
          const result = await res.json();
          if (result.medication?.medId) savedMedIds.push(result.medication.medId);
        } else {
          console.error("Failed to save medication:", res.status, await res.text());
        }
      }

      const followupValue = document.getElementById("singleFollowUp")?.value;
      const followupTimeValue = document.getElementById("singleFollowUpTime")?.value || "09:00";
      const followupDuration = parseInt(document.getElementById("singleFollowUpDuration")?.value || "30");
      const serviceValue = document.getElementById("singleService")?.value;

      if (followupValue && serviceValue) {
        let doctorId = "", doctorName = "";
        if (window.currentPrescriptionAppointment?.appointmentId) {
          try {
            const appointmentRes = await fetch(`http://localhost:5000/api/appointments/${window.currentPrescriptionAppointment.appointmentId}`);
            if (appointmentRes.ok) { const appt = await appointmentRes.json(); doctorId = appt.doctorId || ""; doctorName = appt.doctorName || ""; }
          } catch (err) { console.warn("Could not fetch current appointment:", err); }
        }
        if (!doctorId || !doctorName) {
          const loggedInRole = sessionStorage.getItem("role");
          const loggedInUserId = sessionStorage.getItem("userId");
          const loggedInName = sessionStorage.getItem("name");
          if (loggedInRole === "Doctor" && loggedInUserId && loggedInName) { doctorId = loggedInUserId; doctorName = `Dr. ${loggedInName}`; }
        }
        let patientName = "Unknown";
        try {
          const patientRes = await fetch(`http://localhost:5000/api/patients/${patientId}`);
          if (patientRes.ok) { const patient = await patientRes.json(); patientName = `${patient.firstname || ""} ${patient.lastname || ""}`.trim(); }
        } catch (err) { console.warn("Could not fetch patient name:", err); }

        if (patientId && doctorId && followupValue && serviceValue) {
          const appointmentData = {
            patientId, patientName: patientName || "Unknown", doctorId, doctorName,
            date: followupValue, time: followupTimeValue, duration: followupDuration,
            type: serviceValue, service: serviceValue,
            reason: "Follow-up from medication module", notes: "Auto-generated from prescription", status: "Upcoming",
          };
          try {
            const appRes = await fetch("http://localhost:5000/api/appointments", {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(appointmentData),
            });
            const responseText = await appRes.text();
            if (appRes.ok) {
              const response = JSON.parse(responseText);
              const createdAppointment = response.appointment || response;
              const newAppointmentId = createdAppointment?.appointmentId || createdAppointment?.id || "";
              if (newAppointmentId) {
                const followUpData = { created: true, appointmentId: newAppointmentId, timestamp: Date.now() };
                localStorage.setItem("followUpAppointmentCreated", JSON.stringify(followUpData));
                sessionStorage.setItem("followUpAppointmentCreated", "true");
                sessionStorage.setItem("followUpAppointmentId", newAppointmentId);
                alert(`✅ Medications saved and follow-up appointment created!\n\nAppointment ID: ${newAppointmentId}\nDate: ${followupValue}\nTime: ${followupTimeValue}`);
                window.dispatchEvent(new StorageEvent("storage", { key: "followUpAppointmentCreated", newValue: JSON.stringify(followUpData) }));
              }
            } else {
              let errorMessage = "Unknown error";
              try { errorMessage = JSON.parse(responseText).message || responseText; } catch (e) { errorMessage = responseText; }
              alert(`⚠️ Medications saved, but failed to create follow-up appointment.\n\nError: ${errorMessage}`);
            }
          } catch (fetchError) {
            alert(`⚠️ Medications saved, but failed to create follow-up appointment due to network error.\n\nError: ${fetchError.message}`);
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
      await loadPrescriptionMedications(patientId, appointmentId);

      const formContainer = document.getElementById("medicationFormContainer");
      if (formContainer) formContainer.style.display = "none";
      if (medicationsContainer) medicationsContainer.innerHTML = "";
      medCount = 0;

      const followUpDate = document.getElementById("singleFollowUp");
      const followUpTime = document.getElementById("singleFollowUpTime");
      const followUpDuration = document.getElementById("singleFollowUpDuration");
      const followUpService = document.getElementById("singleService");
      if (followUpDate) followUpDate.value = "";
      if (followUpTime) followUpTime.value = "";
      if (followUpDuration) followUpDuration.value = "30";
      if (window.jQuery && followUpService && $(followUpService).length) $(followUpService).val(null).trigger("change");
      if (buttonCon) buttonCon.style.display = "none";

      if (savedMedIds.length > 0) alert("✅ Medications saved successfully! They will appear in the prescribed medications list above.");
    } catch (err) {
      console.error("Error saving medications:", err);
      alert("Error saving medications: " + err.message);
    }
  });
}

    // ============================================
// SAVE FOLLOW-UP APPOINTMENT (standalone button)
// ============================================
window.saveFollowUpAppointment = async function () {
  const statusEl = document.getElementById("followUpStatus");
  const btn = document.getElementById("saveFollowUpBtn");

  const followupValue = document.getElementById("singleFollowUp")?.value;
  const followupTimeValue = document.getElementById("singleFollowUpTime")?.value || "09:00";
  const followupDuration = parseInt(document.getElementById("singleFollowUpDuration")?.value || "30");
  const serviceValue = document.getElementById("singleService")?.value;

  if (!followupValue) {
    if (statusEl) { statusEl.textContent = "⚠️ Please select a follow-up date."; statusEl.className = "ml-3 text-sm font-medium text-yellow-600"; statusEl.classList.remove("hidden"); }
    return;
  }
  if (!serviceValue) {
    if (statusEl) { statusEl.textContent = "⚠️ Please select a service."; statusEl.className = "ml-3 text-sm font-medium text-yellow-600"; statusEl.classList.remove("hidden"); }
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
  if (statusEl) { statusEl.textContent = "Saving..."; statusEl.className = "ml-3 text-sm font-medium text-slate-500"; statusEl.classList.remove("hidden"); }

  try {
    const currentPatientId = window.currentPrescriptionAppointment?.patientId;
    if (!currentPatientId) throw new Error("No patient loaded");

    let doctorId = "", doctorName = "";
    if (window.currentPrescriptionAppointment?.appointmentId) {
      try {
        const apptRes = await fetch(`http://localhost:5000/api/appointments/${window.currentPrescriptionAppointment.appointmentId}`);
        if (apptRes.ok) { const appt = await apptRes.json(); doctorId = appt.doctorId || ""; doctorName = appt.doctorName || ""; }
      } catch (e) {}
    }
    if (!doctorId || !doctorName) {
      const loggedInRole = sessionStorage.getItem("role");
      const loggedInUserId = sessionStorage.getItem("userId");
      const loggedInName = sessionStorage.getItem("name");
      if (loggedInRole === "Doctor" && loggedInUserId && loggedInName) {
        doctorId = loggedInUserId;
        doctorName = `Dr. ${loggedInName}`;
      }
    }

    let patientName = "Unknown";
    try {
      const patientRes = await fetch(`http://localhost:5000/api/patients/${currentPatientId}`);
      if (patientRes.ok) { const p = await patientRes.json(); patientName = `${p.firstname || ""} ${p.lastname || ""}`.trim(); }
    } catch (e) {}

    const appointmentData = {
      patientId: currentPatientId, patientName, doctorId, doctorName,
      date: followupValue, time: followupTimeValue, duration: followupDuration,
      type: serviceValue, service: serviceValue,
      reason: "Follow-up from completed appointment",
      notes: "Auto-generated follow-up appointment",
      status: "Upcoming",
    };

    const res = await fetch("http://localhost:5000/api/appointments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appointmentData),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const result = await res.json();
    const newId = result.appointment?.appointmentId || result.appointment?.id || result.appointmentId || "";

    if (newId) {
      localStorage.setItem("followUpAppointmentCreated", JSON.stringify({ created: true, appointmentId: newId, timestamp: Date.now() }));
      sessionStorage.setItem("followUpAppointmentCreated", "true");
      sessionStorage.setItem("followUpAppointmentId", newId);
    }

    if (statusEl) { statusEl.textContent = `✅ Follow-up saved! (${followupValue} at ${followupTimeValue})`; statusEl.className = "ml-3 text-sm font-medium text-green-600"; statusEl.classList.remove("hidden"); }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-calendar-check"></i> Saved ✓'; btn.classList.remove("bg-primary"); btn.classList.add("bg-green-600"); }

  } catch (err) {
    console.error("❌ saveFollowUpAppointment error:", err);
    if (statusEl) { statusEl.textContent = `❌ Failed: ${err.message}`; statusEl.className = "ml-3 text-sm font-medium text-red-600"; statusEl.classList.remove("hidden"); }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-calendar-check"></i> Save Follow-Up Appointment'; }
  }
};

window.completeAppointment = async function () {
      const notesInput = document.getElementById("prescriptionNotes");
      const prescriptionNotes = notesInput ? notesInput.value.trim() : "";
      const impressionInput = document.getElementById("impressionInput");
      const impression = impressionInput ? impressionInput.value.trim() : "";

      try {
        const { patientId: currentPatientId } = window.currentPrescriptionAppointment;

        if (currentPatientId) {
          try {
            const medsRes = await fetch(`http://localhost:5000/api/patients/${currentPatientId}/medications`);
            if (medsRes.ok) {
              const allMeds = await medsRes.json();
              const appointmentMeds = allMeds.filter((m) => m.appointmentId === appointmentId && !m.isHistory);
              const medIds = appointmentMeds.map((m) => m.medId);
              if (medIds.length > 0) {
                await fetch(`http://localhost:5000/api/patients/${currentPatientId}/medications/move-to-history`, {
                  method: "PUT", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ medicationIds: medIds, medications: appointmentMeds }),
                });
              }
            }
          } catch (err) { console.warn("Could not move medications to history:", err); }
        }

        const followupValue = document.getElementById("singleFollowUp")?.value;
        const followupTimeValue = document.getElementById("singleFollowUpTime")?.value || "09:00";
        const followupDuration = parseInt(document.getElementById("singleFollowUpDuration")?.value || "30");
        const serviceValue = document.getElementById("singleService")?.value;

        if (followupValue && serviceValue) {
          let doctorId = "", doctorName = "";
          if (window.currentPrescriptionAppointment?.appointmentId) {
            try {
              const appointmentRes = await fetch(`http://localhost:5000/api/appointments/${window.currentPrescriptionAppointment.appointmentId}`);
              if (appointmentRes.ok) { const appt = await appointmentRes.json(); doctorId = appt.doctorId || ""; doctorName = appt.doctorName || ""; }
            } catch (err) { console.warn("Could not fetch current appointment:", err); }
          }
          if (!doctorId || !doctorName) {
            const loggedInRole = sessionStorage.getItem("role");
            const loggedInUserId = sessionStorage.getItem("userId");
            const loggedInName = sessionStorage.getItem("name");
            if (loggedInRole === "Doctor" && loggedInUserId && loggedInName) { doctorId = loggedInUserId; doctorName = `Dr. ${loggedInName}`; }
          }
          let patientName = "Unknown";
          try {
            const patientRes = await fetch(`http://localhost:5000/api/patients/${currentPatientId}`);
            if (patientRes.ok) { const patient = await patientRes.json(); patientName = `${patient.firstname || ""} ${patient.lastname || ""}`.trim(); }
          } catch (err) { console.warn("Could not fetch patient name:", err); }

          if (currentPatientId && doctorId && followupValue && serviceValue) {
            const appointmentData = {
              patientId: currentPatientId, patientName: patientName || "Unknown", doctorId, doctorName,
              date: followupValue, time: followupTimeValue, duration: followupDuration,
              type: serviceValue, service: serviceValue,
              reason: "Follow-up from completed appointment", notes: "Auto-generated from prescription completion", status: "Upcoming",
            };
            try {
              const appRes = await fetch("http://localhost:5000/api/appointments", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(appointmentData),
              });
              const responseText = await appRes.text();
              if (appRes.ok) {
                const response = JSON.parse(responseText);
                const createdAppointment = response.appointment || response;
                const newAppointmentId = createdAppointment?.appointmentId || createdAppointment?.id || "";
                if (newAppointmentId) {
                  const followUpData = { created: true, appointmentId: newAppointmentId, timestamp: Date.now() };
                  localStorage.setItem("followUpAppointmentCreated", JSON.stringify(followUpData));
                  sessionStorage.setItem("followUpAppointmentCreated", "true");
                  sessionStorage.setItem("followUpAppointmentId", newAppointmentId);
                  window.dispatchEvent(new StorageEvent("storage", { key: "followUpAppointmentCreated", newValue: JSON.stringify(followUpData) }));
                }
              }
            } catch (fetchError) { console.error("❌ Network error creating follow-up appointment:", fetchError); }
          }
        }

        const completingFromMonitor = sessionStorage.getItem("completingFromMonitor") === appointmentId;
        const updateResponse = await fetch(`http://localhost:5000/api/appointments/${appointmentId}/status`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Completed" }),
        });
        if (!updateResponse.ok) throw new Error("Failed to update appointment status");

        if (impression || prescriptionNotes) {
          try {
            const appointmentRes = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`);
            if (appointmentRes.ok) {
              const appointment = await appointmentRes.json();
              let updatedNotes = appointment.notes || "";
              if (prescriptionNotes) updatedNotes = updatedNotes ? `${updatedNotes}\n\nPrescription Notes: ${prescriptionNotes}` : `Prescription Notes: ${prescriptionNotes}`;
              const appointmentDate = appointment.date instanceof Date ? appointment.date.toISOString() : appointment.date;
              const updatePayload = {
                patientName: appointment.patientName, doctorId: appointment.doctorId, doctorName: appointment.doctorName,
                date: appointmentDate, time: appointment.time, type: appointment.type, duration: appointment.duration,
                reason: appointment.reason, notes: updatedNotes, impression: impression || appointment.impression
              };
              await fetch(`http://localhost:5000/api/appointments/${appointmentId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatePayload),
              });
            }
          } catch (err) { console.warn("Could not update appointment notes:", err); }
        }

        if (completingFromMonitor && window.shownModals) {
          window.shownModals.delete(appointmentId);
          sessionStorage.removeItem("completingFromMonitor");
        }

        const archiveResponse = await fetch(`http://localhost:5000/api/appointments/${appointmentId}/archive`, {
          method: "POST", headers: { "Content-Type": "application/json" },
        });
        const result = await archiveResponse.json();
        if (!archiveResponse.ok) throw new Error(result.message || "Failed to archive appointment");

        alert("✅ Appointment completed and archived successfully!");
        window.location.href = "Appointments.html";
      } catch (error) {
        console.error("Error completing appointment:", error);
        alert("❌ " + (error.message || "There was a problem completing the appointment."));
      }
    };

    const followUpDateInput = document.getElementById("singleFollowUp");
    const followUpTimeInput = document.getElementById("singleFollowUpTime");
    if (followUpDateInput && followUpTimeInput) {
      const today = new Date().toISOString().split("T")[0];
      followUpDateInput.setAttribute("min", today);
      followUpDateInput.addEventListener("change", validateDateTime);
      followUpTimeInput.addEventListener("change", validateDateTime);
      validateDateTime();
    }
  }
});

// ============================================
// SETUP MEDICATIONS PAGE FUNCTIONALITY
// ============================================
function setupMedicationsPageFunctionality(patientId) {
  const medicationsContainer = document.getElementById("medicationsContainer");
  const addBtn = document.getElementById("addMedBtn");
  const saveBtn = document.querySelector(".savebtn");
  const cancelBtn = document.querySelector(".cancelbtn");
  const buttonCon = document.getElementById("buttonCon");
  let medCount = 0;

  if (buttonCon) buttonCon.style.display = "none";

  if (addBtn) {
    addBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      medCount++;
      const newForm = createMedicationForm(medCount);
      medicationsContainer.appendChild(newForm);
      await loadDoctorsDropdown(`selectPrescriber${medCount}`);
      activateMedicineSearch(`#medicineSelect${medCount}`, `#freqSelect${medCount}`, `#dosageSelect${medCount}`);
      if (buttonCon) buttonCon.style.display = "flex";
      addBtn.textContent = "Cancel Add";

      newForm.querySelector(".deleteMed").addEventListener("click", () => {
        newForm.remove();
        if (buttonCon) buttonCon.style.display = "none";
        addBtn.textContent = "Add Medication";
      });

      if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
          newForm.remove();
          if (buttonCon) buttonCon.style.display = "none";
          addBtn.textContent = "Add Medication";
        }, { once: true });
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const allForms = [...document.querySelectorAll(".patientForm")];
      const newForms = allForms.filter((form) => !form.querySelector("input")?.disabled);
      if (newForms.length === 0) { alert("No new medications to save."); return; }

      const medData = newForms.map((f) => {
        const data = normalizeFormData(Object.fromEntries(new FormData(f)));
        const maintainCheck = f.querySelector('input[name="durationMaintain"]');
        data.durationMaintain = maintainCheck ? maintainCheck.checked : false;
        const daysInput = f.querySelector('input[name="durationDays"]');
        data.durationDays = (!data.durationMaintain && daysInput?.value) ? parseInt(daysInput.value) : null;
        const indicationInput = f.querySelector('input[name="indication"]');
        data.indication = indicationInput ? indicationInput.value.trim() : "";
        return data;
      });

      const followupTime = document.getElementById("singleFollowUpTime")?.value || null;
      const followupDate = document.getElementById("singleFollowUp")?.value || null;

      try {
        const savedMedIds = [];
        for (const med of medData) {
          const res = await fetch(`http://localhost:5000/api/patients/${patientId}/medications`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...med, appointmentId: null, followupTime, followup: followupDate || null }),
          });
          if (res.ok) { const result = await res.json(); if (result.medication?.medId) savedMedIds.push(result.medication.medId); }
          else console.error("Failed to save medication:", res.status, await res.text());
        }

        alert("✅ Medications saved successfully!");
        await loadMedications(patientId);
        if (buttonCon) buttonCon.style.display = "none";
        if (addBtn) { addBtn.style.display = "inline-block"; addBtn.textContent = "Add Medication"; }
      } catch (err) { console.error("Error saving medications:", err); alert("Error saving medications."); }
    });
  }

  setupPrintFunctionality(patientId, null);
}

// ============================================
// SETUP PRINT FUNCTIONALITY — COMPLETE WITH FOLLOW-UP FIX
// ============================================
function setupPrintFunctionality(patientId, appointmentId) {
  const printBtn = document.getElementById("printPrescriptionBtn") || document.getElementById("printBtn");

  if (printBtn) {
    printBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const medsRes = await fetch(`http://localhost:5000/api/patients/${patientId}/medications`);
        const meds = await medsRes.json();
        const appointmentMeds = appointmentId ? meds.filter((m) => m.appointmentId === appointmentId && !m.isHistory) : meds;

        // ✅ GET FOLLOW-UP DATE AND TIME FROM FORM INPUTS (PRIORITY 1)
        let followupDate = '';
        let followupTime = '';

        // Read from the Follow Up Appointment form
        const followUpDateInput = document.getElementById("singleFollowUp");
        const followUpTimeInput = document.getElementById("singleFollowUpTime");

        if (followUpDateInput && followUpDateInput.value) {
          try {
            const date = new Date(followUpDateInput.value);
            if (!isNaN(date.getTime())) {
              followupDate = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              });
            }
          } catch (e) {
            console.warn("Error parsing followup date:", e);
          }
        }

        if (followUpTimeInput && followUpTimeInput.value) {
          followupTime = followUpTimeInput.value;
          // Convert 24-hour to 12-hour format
          const timeMatch = followupTime.match(/^(\d{1,2}):(\d{2})$/);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = timeMatch[2];
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            followupTime = `${hours}:${minutes} ${ampm}`;
          }
        }

        // Fallback: If form is empty, try to get from medications (PRIORITY 2)
        if (!followupDate && appointmentMeds.length > 0 && appointmentMeds[0].followup) {
          try {
            const date = new Date(appointmentMeds[0].followup);
            if (!isNaN(date.getTime())) {
              followupDate = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              });
            }
          } catch (e) {
            console.warn("Error parsing medication followup date:", e);
          }
          
          if (appointmentMeds[0].followupTime && !followupTime) {
            followupTime = appointmentMeds[0].followupTime;
            const timeMatch = followupTime.match(/^(\d{1,2}):(\d{2})$/);
            if (timeMatch) {
              let hours = parseInt(timeMatch[1]);
              const minutes = timeMatch[2];
              const ampm = hours >= 12 ? 'PM' : 'AM';
              hours = hours % 12 || 12;
              followupTime = `${hours}:${minutes} ${ampm}`;
            }
          }
        }

        let prescriberName = "";
        if (appointmentMeds.length > 0 && appointmentMeds[0].presby) prescriberName = appointmentMeds[0].presby;

        const impressionInput = document.getElementById("impressionInput");
        let impression = impressionInput ? impressionInput.value.trim() : "";
        let managementDone = "";

        if (appointmentId) {
          try {
            const appointmentRes = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`);
            if (appointmentRes.ok) {
              const appt = await appointmentRes.json();
              prescriberName = appt.doctorName || prescriberName;
              if (!impression && appt.impression) impression = appt.impression;
              managementDone = appt.type || appt.service || "";
            }
          } catch (err) { console.warn("Could not fetch appointment details:", err); }
        }

        if (!prescriberName) {
          const loggedInName = sessionStorage.getItem("name");
          const loggedInRole = sessionStorage.getItem("role");
          prescriberName = (loggedInRole === "Doctor" && loggedInName) ? `Dr. ${loggedInName}` : "___________________________";
        }


        let patientName = "Unknown Patient", patientAge = "", patientGender = "", patientAddress = "" ;
        try {
          const patientRes = await fetch(`http://localhost:5000/api/patients/${patientId}`);
          if (patientRes.ok) {
            const patient = await patientRes.json();
            
            // ✅ NEW - Format with middle initial
            patientName = formatPatientName(
              patient.firstname,
              patient.middlename,
              patient.lastname
            );
            
            patientAddress = [patient.address, patient.barangay, patient.city]
            .filter(Boolean)
            .join(", ");
            if (patient.dob) {
              const birthDate = new Date(patient.dob);
              const today = new Date();
              let age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
              patientAge = age;
            }
            patientGender = patient.gender || "";
          }
        } catch (err) { console.warn("Could not fetch patient info:", err); }

        let logoBase64 = "";
        try {
          const logoRes = await fetch("../user/Assets/wellserved_logo.jpg");
          const blob = await logoRes.blob();
          logoBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch (err) { console.warn("Could not load logo:", err); }

        const logoHTML = logoBase64
          ? `<img src="${logoBase64}" alt="Well Served Logo" class="clinic-logo" />`
          : `<div class="logo-placeholder">WELL<br>SERVED</div>`;

        // ✅ Build medications table WITH Duration and Indication columns
        let medsTableHTML = appointmentMeds.length === 0
  ? `<p style="text-align:center;color:#6b7280;padding:24px;font-style:italic;">No medications prescribed yet.</p>`
  : `
  <table class="prescription-table">
    <thead>
      <tr>
        <th>Medicine Name</th>
        <th>Dosage</th>
        <th>Frequency</th>
        <th>Qty</th>
        <th>Duration</th>
        <th>Indication</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${appointmentMeds.map((m) => {
        // ✅ Format duration for print - CHECK DURATION FIELD FIRST
        let durationText = "—";
        
        if (m.duration) {
          // If duration field exists, use it directly
          durationText = m.duration;
        } else {
          // Fallback to old method
          const isMaintain = m.durationMaintain === true || m.durationMaintain === "true" || m.durationMaintain === "on";
          durationText = isMaintain
            ? "Maintain"
            : m.durationDays ? `${m.durationDays} day(s)` : "—";
        }
        
        return `
        <tr>
          <td><strong>${escapeHtml(m.medicname || "")}</strong></td>
          <td>${escapeHtml(m.dosage || "N/A")}</td>
          <td>${escapeHtml(m.frequency || "")}</td>
          <td>${m.quantity ?? ""}</td>
          <td>${escapeHtml(durationText)}</td>
          <td>${escapeHtml(m.indication || "—")}</td>
          <td>${escapeHtml(m.presNotes || "—")}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>`;

        const currentDate = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });

        const printWindow = window.open("", "", "width=560,height=794");
        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Prescription - ${patientName}</title>
  <style>
    :root {
      --primary:        #065f46;
      --primary-dark:   #064e3b;
      --primary-mid:    #d1fae5;
      --primary-light:  #f0fdf4;
      --primary-border: #a7f3d0;
      --accent:         #8b5a2b;
      --accent-light:   #fef3c7;
      --text:           #111827;
      --muted:          #6b7280;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Georgia', 'Times New Roman', serif; margin: 0; padding: 0; color: var(--text); background: #fff; line-height: 1.4; }
    .prescription-wrapper { width: 148.5mm; min-height: 210mm; padding: 8mm 8mm; box-sizing: border-box; margin: 0 auto; background: #fff; }
    .header-section { display: flex; flex-direction: column; padding-bottom: 8px; border-bottom: 3px solid var(--primary); margin-bottom: 6px; }
    .header-top { display: flex; align-items: center; justify-content: center; gap: 6px; }
    .clinic-logo { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary); flex-shrink: 0; box-shadow: 0 2px 8px rgba(6,95,70,0.15); }
    .logo-placeholder { width: 72px; height: 72px; border-radius: 50%; border: 3px solid var(--primary); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; color: var(--primary); text-align: center; flex-shrink: 0; }
    .clinic-info { text-align: center; }
    .clinic-main-name { font-size: 22px; font-weight: 900; color: var(--primary); letter-spacing: 4px; font-family: 'Arial Black', 'Arial Bold', Arial, sans-serif; line-height: 1; margin-bottom: 2px; }
    .clinic-full-name { font-size: 10px; font-weight: bold; color: var(--primary-dark); letter-spacing: 1px; margin-bottom: 4px; font-family: Arial, sans-serif; }
    .clinic-services { font-size: 8px; color: var(--accent); font-weight: bold; letter-spacing: 0.3px; line-height: 1.6; font-family: Arial, sans-serif; }
    .clinic-meta { display: flex; justify-content: space-between; margin-top: 5px; font-size: 7.5px; color: var(--muted); font-family: Arial, sans-serif; font-style: italic; width: 100%; }
    .doctors-section { text-align: center; font-size: 8.5px; font-weight: bold; color: var(--primary-dark); font-family: Arial, sans-serif; margin: 5px 0 3px; }
    .doctors-row { display: grid; grid-template-columns: 1fr 1fr; text-align: center; line-height: 1.8; width: 100%; }
    .doctors-row span:first-child { text-align: right; padding-right: 16px; }
    .doctors-row span:last-child { text-align: left; padding-left: 16px; }
    .divider-primary { border: none; border-top: 2px solid var(--primary); margin: 5px 0; }
    .divider-light { border: none; border-top: 1px solid var(--primary-border); margin: 6px 0; }
    .rx-row { display: flex; align-items: flex-start; gap: 8px; margin: 8px 0 5px; }
    .rx-symbol { font-size: 38px; font-weight: bold; color: var(--primary); font-family: 'Times New Roman', serif; line-height: 1; flex-shrink: 0; }
    .patient-details { flex: 1; font-family: Arial, sans-serif; font-size: 10px; min-width: 0; }
    .info-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 3px; flex-wrap: nowrap; }
    .info-label { font-weight: bold; color: var(--primary); font-size: 9px; white-space: nowrap; }
    .info-underline { border-bottom: 1px solid #9ca3af; display: inline-block; min-width: 0; flex: 1; color: var(--text); font-size: 10px; }
    .date-box { text-align: right; font-family: Arial, sans-serif; font-size: 10px; flex-shrink: 0; white-space: nowrap; }
    .date-box .info-underline { min-width: 55px; flex: none; }
    .clinical-section { margin: 5px 0; padding: 6px 10px; border-left: 3px solid var(--primary); background: #f0fdf4; border-radius: 0 6px 6px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .clinical-section.management { border-left-color: var(--accent); background: #fef3c7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .clinical-section h3 { font-size: 8px; font-weight: bold; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; font-family: Arial, sans-serif; }
    .clinical-section.management h3 { color: var(--accent); }
    .clinical-section p { font-size: 10px; color: var(--text); line-height: 1.4; font-family: Arial, sans-serif; }
    .prescription-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-family: Arial, sans-serif; font-size: 9px; border: 1px solid var(--primary-border); overflow: hidden; }
    .prescription-table thead tr { background: #065f46 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .prescription-table th { color: #ffffff !important; padding: 6px 7px; text-align: left; font-size: 7.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .prescription-table tbody tr:nth-child(even) { background: #f0fdf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .prescription-table tbody tr:nth-child(odd) { background: #fff !important; }
    .prescription-table td { padding: 5px 7px; border-bottom: 1px solid var(--primary-border); color: var(--text); font-size: 9px; }
    .prescription-table td strong { color: var(--primary-dark); }
    
    /* ✅ SIDE-BY-SIDE CONTAINER FOR FOLLOW-UP AND SIGNATURE */
    .bottom-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 20px;
      margin-top: 16px;
    }
    
    /* ✅ FOLLOW-UP SECTION (LEFT SIDE) */
    .followup-box-left { 
      flex: 1;
      max-width: 45%;
      padding: 0;
      border: none;
      border-radius: 0;
      background: transparent;
      -webkit-print-color-adjust: exact; 
      print-color-adjust: exact;
      align-self: flex-end;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      min-height: 100%;
    }
    .followup-box-left h3 { 
      color: var(--primary); 
      margin: 0 0 3px 0;
      font-size: 10px; 
      font-weight: bold; 
      text-transform: uppercase; 
      letter-spacing: 0.5px; 
      font-family: Arial, sans-serif; 
    }
    .followup-box-left p { 
      margin: 0 0 2px 0;
      font-size: 9px; 
      color: var(--text); 
      line-height: 1.2;
      font-family: Arial, sans-serif; 
    }
    .followup-box-left p strong { 
      color: var(--primary-dark); 
      font-weight: bold; 
    }
    .followup-reminder { 
      margin-top: 3px !important;
      font-size: 8px !important; 
      color: var(--muted); 
      font-style: italic; 
      line-height: 1.2;
    }
    
    /* ✅ SIGNATURE SECTION (RIGHT SIDE) */
    .signature-section-right { 
      flex: 1;
      max-width: 45%;
      text-align: right; 
      font-family: Arial, sans-serif; 
    }
    .signature-line { 
      display: inline-block; 
      border-top: 2px solid var(--primary); 
      min-width: 160px; 
      text-align: center; 
      padding-top: 4px; 
      margin-top: 28px; 
    }
    .prescriber-name { 
      font-size: 11px; 
      font-weight: bold; 
      color: var(--primary); 
    }
    .license-section { 
      margin-top: 8px; 
      font-size: 9px; 
      line-height: 1.9; 
      color: var(--muted); 
    }
    .license-line { 
      border-bottom: 1px solid #9ca3af; 
      display: inline-block; 
      min-width: 130px; 
      margin-left: 4px; 
    }
    
    .rx-footer { 
      margin-top: 12px; 
      border-top: 1px solid var(--primary-border); 
      padding-top: 5px; 
      text-align: center; 
      font-size: 7px; 
      color: var(--muted); 
      font-family: Arial, sans-serif; 
      font-style: italic; 
    }

    @media print {
      @page {
        size: A4 landscape;
        margin: 0;
      }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body {
        margin: 0;
        padding: 0;
        background: white;
      }
      .prescription-wrapper {
        position: absolute;
        top: 0;
        left: 0;
        width: 148.5mm;
        min-height: 210mm;
        padding: 12mm 10mm;
        box-sizing: border-box;
        overflow: hidden;
      }
    }
  </style>
</head>
<body>
<div class="prescription-wrapper">
  <div class="header-section">
    <div class="header-top">
      ${logoHTML}
      <div class="clinic-info">
        <div class="clinic-main-name">WELL SERVED</div>
        <div class="clinic-full-name">INFIRMARY &amp; DRUGSTORE INC.</div>
        <div class="clinic-services">• MEDICAL &nbsp;• PEDIA &nbsp;• OB GYNE &nbsp;• MINOR SURGERY</div>
        <div class="clinic-services">• X-RAY &nbsp;• ECG &nbsp;• LABORATORY &nbsp;• ULTRASOUND &nbsp;• DRUGSTORE</div>
      </div>
    </div>
    <div class="clinic-meta">
      <span>📍 #26 Steve St. cor Villiongco St., Brgy. Commonwealth, Quezon City</span>
      <span>📧 wellservedinfirmary@gmail.com &nbsp;|&nbsp; 📞 8 952-77-79</span>
    </div>
  </div>
  <div class="doctors-section">
    <div class="doctors-row"><span>DAISY VILLARAMA-TIGA, M.D. CFP, MHA</span><span>JOSE EDUARDO M. TIGA, M.D. CFP</span></div>
    <div class="doctors-row"><span>DANIEL JOSE V. TIGA, M.D. CFP</span><span>EDUARDO MARCO DAYRIT M.D</span></div>
    <div class="doctors-row"><span>KATRINA MAE TIGA-AGUILA, M.D.</span><span>RICSON RAY AGUILA, M.D.</span></div>
  </div>
  <hr class="divider-primary" />
  <div class="rx-row">
    <span class="rx-symbol">&#8478;</span>
    <div class="patient-details">
      <div class="info-row">
        <span class="info-label">Name:</span>
        <span class="info-underline">${patientName}</span>
        ${patientAge ? `<span class="info-label" style="margin-left:8px;">Age / Gender:</span><span class="info-underline" style="min-width:50px;flex:none;">${patientAge} / ${patientGender || ''}</span>` : ''}
      </div>
      ${patientAddress ? `<div class="info-row"><span class="info-label">Address:</span><span class="info-underline">${escapeHtml(patientAddress)}</span></div>` : ''}
    </div>
    <div class="date-box">
      <span class="info-label">Date:</span>
      <span class="info-underline">${currentDate}</span>
    </div>
  </div>
  <hr class="divider-light" />
  ${(impression || managementDone) ? `
  <div style="display:flex; gap:12px; margin:10px 0;">
    ${impression ? `<div class="clinical-section" style="flex:1; margin:0;"><h3>Impression (Diagnosis)</h3><p>${escapeHtml(impression)}</p></div>` : ''}
    ${managementDone ? `<div class="clinical-section management" style="flex:1; margin:0;"><h3>Management Done</h3><p>${escapeHtml(managementDone)}</p></div>` : ''}
  </div>` : ''}
  ${medsTableHTML}
  
  <div class="bottom-row">
    ${followupDate ? `
    <div class="followup-box-left">
      <h3>Follow-Up Appointment</h3>
      <p><strong>Date:</strong> ${followupDate}</p>
      ${followupTime ? `<p><strong>Time:</strong> ${followupTime}</p>` : ''}
      <p class="followup-reminder">Please return on this date for your follow-up consultation.</p>
    </div>
    ` : '<div></div>'}
    
    <div class="signature-section-right">
      <div class="signature-line"><p class="prescriber-name">${prescriberName}, MD</p></div>
      <div class="license-section">
        <div>License No.: <span class="license-line"></span></div>
        <div>PTR No.: <span class="license-line"></span></div>
        <div>S2 No.: <span class="license-line"></span></div>
      </div>
    </div>
  </div>
  <div class="rx-footer">This prescription is valid for 7 days from date of issue &nbsp;|&nbsp; Well Served Infirmary &amp; Drugstore Inc.</div>
</div>
</body>
</html>`);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 250);

      } catch (err) {
        console.error("Error preparing prescription for print:", err);
        alert("Failed to prepare prescription for printing. Please try again.");
      }
    });
  }
}

window.addEventListener("storage", async (e) => {
  if (e.key === "integrationStatusChanged") {
    const newStatus = JSON.parse(e.newValue);
    const isEmrOnlyMode = !newStatus.pharmacy && !newStatus.billing && newStatus.emr;
    if (newStatus.billing !== undefined || isEmrOnlyMode) await loadServicesDropdown();
    if (isEmrOnlyMode) alert("ℹ️ Switched to EMR-only mode. Using local EMR database for medicines and services.");
    else if (!newStatus.pharmacy && !newStatus.billing) alert("⚠️ All integrations disabled. Medicine search and services will not work.");
    else if (!newStatus.pharmacy) alert("⚠️ Pharmacy integration has been disabled. Medicine search will not work.");
    else if (!newStatus.billing) alert("⚠️ Billing integration has been disabled. Services dropdown will not work.");
  }
});

setInterval(() => {
  if (window.currentPrescriptionAppointment) {
    const { patientId, appointmentId } = window.currentPrescriptionAppointment;
    loadPrescriptionMedications(patientId, appointmentId);
  }
}, 3000);