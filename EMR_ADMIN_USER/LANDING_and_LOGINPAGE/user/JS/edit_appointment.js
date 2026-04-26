async function loadDoctors() {
  const select = document.getElementById("selectDoctor");

  try {
    const res = await fetch("http://localhost:5000/api/users");
    if (!res.ok) throw new Error("Failed to load doctors");

    const users = await res.json();

    // 🩺 Filter only doctors that are active
    const doctors = users.filter(u => u.role === "Doctor" && u.status === "Active");

    if (doctors.length === 0) {
      select.innerHTML = `<option value="">No available doctors</option>`;
      return;
    }

    // ✅ Generate options that always show full name + ID
    select.innerHTML = `
      <option value="">Select Doctor</option>
      ${doctors.map(d => `
        <option value="${d.userId || d._id}">
          Dr. ${d.name} (${d.userId || d._id})
        </option>
      `).join("")}
    `;
  } catch (err) {
    console.error("Error loading doctors:", err);
    select.innerHTML = `<option value="">Error loading doctors</option>`;
  }
}

// Load Services from Billing System
async function loadServicesDropdown() {
  const select = document.getElementById("appType");

  try {
    const res = await fetch("http://localhost:5000/api/integrations/billing/services");
    if (!res.ok) {
      throw new Error("Failed to fetch services");
    }
    
    const result = await res.json();
    
    if (!result.success || !result.data) {
      throw new Error("Invalid response from services API");
    }

    const services = result.data;

    if (services.length === 0) {
      select.innerHTML = `<option value="">No services found</option>`;
      console.warn("⚠️ No services found in billing system");
      return;
    }

    // Clear existing options except the placeholder
    select.innerHTML = '<option value="">Search and select a service...</option>';
    
    // Add services to dropdown
    services.forEach(service => {
      const option = document.createElement("option");
      option.value = service.service; // Use service name as value
      option.textContent = `${service.service}${service.category ? ` (${service.category})` : ''}${service.price ? ` - ₱${service.price.toFixed(2)}` : ''}`;
      option.setAttribute("data-price", service.price || 0);
      option.setAttribute("data-category", service.category || "");
      option.setAttribute("data-code", service.code || "");
      select.appendChild(option);
    });

    console.log(`✅ Loaded ${services.length} services from billing system`);
  } catch (err) {
    console.error("❌ Error loading services:", err);
    select.innerHTML = `<option value="">Error loading services. Please try again.</option>`;
  }
}

async function loadAppointmentData() {
  const urlParams = new URLSearchParams(window.location.search);
  const appointmentId = urlParams.get("id");

  if (!appointmentId) return;

  try {
    const res = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`);
    if (!res.ok) throw new Error("Failed to load appointment data.");

    const app = await res.json();

    // Mapping API data to the form fields
    document.getElementById("patientname").value = app.patientName || "";
    document.getElementById("appdate").value = app.date ? app.date.split("T")[0] : "";
    document.getElementById("appTime").value = app.time || "";
    document.getElementById("appType").value = app.type || "";
    document.getElementById("duration").value = app.duration || "";
    document.getElementById("reason").value = app.reason || "";
    document.getElementById("addnotes").value = app.notes || "";

    return app; // ✅ return object so window.onload can use it
  } catch (err) {
    console.error("Error loading appointment:", err);
    alert("Unable to load appointment details.");
  }
}


// SAVE button logic (Now attached to the form's submit event)
document.getElementById("patientForm").addEventListener("submit", async (e) => {
  e.preventDefault(); // Stop the default form submission

  const urlParams = new URLSearchParams(window.location.search);
  const appointmentId = urlParams.get("id");

  const doctorSelect = document.getElementById("selectDoctor");

  // ✅ Final validation before submission
  const selectedDate = document.getElementById("appdate").value;
  const selectedTime = document.getElementById("appTime").value;
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  
  if (selectedDate < todayStr) {
    alert("❌ Cannot schedule appointment in the past. Please select today or a future date.");
    return;
  }
  
  if (selectedDate === todayStr && selectedTime) {
    const [selectedHours, selectedMinutes] = selectedTime.split(":").map(Number);
    const currentHours = today.getHours();
    const currentMinutes = today.getMinutes();
    
    if (selectedHours < currentHours || (selectedHours === currentHours && selectedMinutes <= currentMinutes)) {
      alert("❌ Cannot schedule appointment in the past. Please select a future time.");
      return;
    }
  }

  const updatedData = {
    patientName: document.getElementById("patientname").value,
    date: selectedDate,
    time: selectedTime,
    doctorId: doctorSelect.value, // ✅ store ID properly
    // FIX: Using selectedOptions[0].text is a safer way to get the display name
    doctorName: doctorSelect.selectedOptions[0].text.trim(), 
    type: document.getElementById("appType").value,
    duration: document.getElementById("duration").value,
    reason: document.getElementById("reason").value,
    notes: document.getElementById("addnotes").value
  };

  try {
    const response = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData)
    });

    // Handle non-JSON response text if needed, but check response.ok first
    if (!response.ok) {
        // Attempt to read error message from server if available
        const errorDetail = await response.text(); 
        console.error("Server returned an error:", errorDetail);
        throw new Error(`Failed to update appointment: ${response.statusText}`);
    }

    alert("✅ Appointment updated successfully!");
    window.location.href = "Appointments.html";
  } catch (error) {
    console.error("Error updating appointment:", error);
    alert(`❌ Error updating appointment: ${error.message}`);
  }
});

// CANCEL button logic (Now attached to the <a> tag using the new class)
document.querySelector(".cancelBtn").addEventListener("click", (e) => {
    console.log("Cancel button clicked.");
});


// ✅ Validate date and time (prevent past dates/times)
function validateDateTime() {
    const dateInput = document.getElementById("appdate");
    const timeInput = document.getElementById("appTime");
    
    if (!dateInput || !timeInput) return;
    
    const selectedDate = dateInput.value;
    const selectedTime = timeInput.value;
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    
    // If date is today, validate time
    if (selectedDate === todayStr && selectedTime) {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const [selectedHours, selectedMinutes] = selectedTime.split(":").map(Number);
        
        // Check if selected time is in the past
        if (selectedHours < currentHours || (selectedHours === currentHours && selectedMinutes <= currentMinutes)) {
            alert("⚠️ Cannot schedule appointment in the past. Please select a future time.");
            // Set time to current time + 30 minutes
            const futureTime = new Date(now.getTime() + 30 * 60000);
            const futureHours = String(futureTime.getHours()).padStart(2, "0");
            const futureMinutes = String(futureTime.getMinutes()).padStart(2, "0");
            timeInput.value = `${futureHours}:${futureMinutes}`;
        }
    }
    
    // Validate date is not in the past
    if (selectedDate && selectedDate < todayStr) {
        alert("⚠️ Cannot schedule appointment in the past. Please select today or a future date.");
        dateInput.value = todayStr;
    }
}

// ✅ Load doctors first, then services, then appointment data
window.onload = async () => {
  await loadDoctors();               // first
  await loadServicesDropdown();      // second
  const app = await loadAppointmentData(); // third

  if (app && app.doctorId) {
    const doctorSelect = document.getElementById("selectDoctor");
    doctorSelect.value = app.doctorId;
  }

  // ✅ Restrict appointment date to today and onwards
  const dateInput = document.getElementById("appdate");
  const timeInput = document.getElementById("appTime");
  const today = new Date().toISOString().split("T")[0];
  if (dateInput) {
    dateInput.setAttribute("min", today);
    dateInput.addEventListener("change", validateDateTime);
  }
  if (timeInput) {
    timeInput.addEventListener("change", validateDateTime);
  }

  // Initialize Select2 for searchable dropdowns
  $(document).ready(function () {
    $("#selectDoctor").select2({
      placeholder: "Search for a doctor",
      allowClear: true,
      width: "100%"
    });

    // Make Service Type searchable
    $("#appType").select2({
      placeholder: "Search and select a service...",
      allowClear: true,
      width: "100%",
      minimumInputLength: 0 // Allow searching from the start
    });
  });
};