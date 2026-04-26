// /modules/PatientsInfo/medication.js - Refactored with follow-up + print

// ------------------------------
// Load Doctors Dropdown
// ------------------------------
async function loadDoctorsDropdown(selectElementId) {
  const select = document.getElementById(selectElementId);
  if (!select) return;

  try {
    const res = await fetch("http://localhost:5000/api/users");
    if (!res.ok) throw new Error(`Failed to fetch doctors (${res.status})`);
    const users = await res.json();
    const doctors = users.filter((u) => u.role === "Doctor");

    if (doctors.length === 0) {
      select.innerHTML = `<option value="">No doctors found</option>`;
      return;
    }

    select.innerHTML = `
      <option value="">Select Doctor</option>
      ${doctors
        .map((d) => `<option value="Dr. ${d.name}">Dr. ${d.name}</option>`)
        .join("")}
    `;

    try {
      if (window.jQuery && $(`#${selectElementId}`).select2) {
        $(`#${selectElementId}`).select2({
          placeholder: "Search for a doctor",
          allowClear: true,
          width: "100%",
        });
      }
    } catch (err2) {
      console.warn("Select2 init failed:", err2);
    }
  } catch (err) {
    console.error("Error loading doctors:", err);
    select.innerHTML = `<option value="">Error loading doctors</option>`;
  }
}

// ------------------------------
// Load Services from Billing System
// ------------------------------
async function loadServicesDropdown() {
  const select = document.getElementById("singleService");
  if (!select) return;

  try {
    const res = await fetch(
      "http://localhost:5000/api/integrations/billing/services"
    );
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
    select.innerHTML =
      '<option value="">Search and select a service...</option>';

    // Add services to dropdown
    services.forEach((service) => {
      const option = document.createElement("option");
      option.value = service.service; // Use service name as value
      option.textContent = `${service.service}${
        service.category && service.category !== "Consultation Services"
          ? ` (${service.category})`
          : ""
      }${service.price ? ` - ₱${service.price.toFixed(2)}` : ""}`;
      option.setAttribute("data-price", service.price || 0);
      option.setAttribute("data-code", service.code || "");
      select.appendChild(option);
    });

    // Initialize Select2 for searchable dropdown
    if (window.jQuery && $("#singleService").select2) {
      $("#singleService").select2({
        placeholder: "Search and select a service...",
        allowClear: true,
        width: "100%",
        minimumInputLength: 0, // Allow searching from the start
      });
    }

    console.log(`✅ Loaded ${services.length} services from billing system`);
  } catch (err) {
    console.error("❌ Error loading services:", err);
    select.innerHTML = `<option value="">Error loading services. Please try again.</option>`;
  }
}

// ------------------------------
// Document Ready
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Check if we're on prescription page (inline form)
  const isPrescriptionPage = window.location.href.includes("Prescription.html");
  const medicationsContainer = document.getElementById("medicationsContainer");

  const addBtn = isPrescriptionPage
    ? null
    : document.getElementById("addMedBtn");
  const saveBtn = isPrescriptionPage
    ? document.getElementById("saveMedicationsBtn")
    : document.querySelector(".savebtn");
  const cancelBtn = isPrescriptionPage
    ? document.getElementById("cancelMedicationsBtn")
    : document.querySelector(".cancelbtn");
  const buttonCon = isPrescriptionPage
    ? document.getElementById("buttonCon")
    : document.getElementById("buttonCon");

  // Get patientId from URL or from prescription context
  let patientId = new URLSearchParams(window.location.search).get("patientId");

  // If on prescription page, get patientId from currentPrescriptionAppointment
  if (isPrescriptionPage && window.currentPrescriptionAppointment) {
    patientId = window.currentPrescriptionAppointment.patientId;
  }

  if (!patientId && !isPrescriptionPage) {
    alert("No patient selected!");
    return;
  }

  let medCount = 0;

  // Check if opened from prescription modal/page
  const isFromPrescriptionModal =
    sessionStorage.getItem("currentAppointmentId") !== null ||
    isPrescriptionPage;

  // Hide "Add Medication" button if not opened from prescription modal
  if (!isFromPrescriptionModal && addBtn) {
    addBtn.style.display = "none";
  }

  // On prescription page, hide button container initially
  if (buttonCon) {
    if (isPrescriptionPage) {
      buttonCon.style.display = "none";
    } else {
      buttonCon.style.display = "none";
    }
  }

  // Store patientId globally for prescription page
  if (isPrescriptionPage && patientId) {
    window.currentPatientId = patientId;
  }

  // ------------------------------
  // Load Patient Header
  // ------------------------------
  async function loadPatientHeader() {
    try {
      const res = await fetch(
        `http://localhost:5000/api/patients/${patientId}`
      );
      if (!res.ok) throw new Error("Patient not found");
      const p = await res.json();
      document.querySelector(
        "header h1"
      ).textContent = `Patient Information - ${p.firstname || ""} ${
        p.lastname || ""
      }`;
    } catch (err) {
      console.error("Error loading patient header:", err);
    }
  }
  loadPatientHeader();

  // Attach patient id to nav links
  document.querySelectorAll("nav-bar a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && !href.includes("?patientId=")) {
      link.setAttribute("href", `${href}?patientId=${patientId}`);
    }
  });

  // ------------------------------
  // Escape HTML
  // ------------------------------
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

  // ------------------------------
  // Normalize Form Data
  // ------------------------------
  function normalizeFormData(raw) {
    const out = {};
    for (const k of Object.keys(raw)) {
      let v = raw[k]?.trim();
      out[k] = k === "quantity" ? Number(v) || 0 : v;
    }
    return out;
  }

  // ------------------------------
  // Create Medication Form
  // ------------------------------
  function createMedicationForm(index, existingMed = null, isReadOnly = false) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("medecineCon");
    wrapper.innerHTML = `
        <div class="medecineHeader">
            <h3>Medication ${index}</h3>
            <i class="fa-solid fa-trash deleteMed" data-id="${
              existingMed?.medId || ""
            }"></i>
        </div>
        <form class="patientForm">
            <div class="leftform">
                <div class="form-group">
                    <label>Medication Name</label>
                    <select id="medicineSelect${index}" class="medicineSelect" name="medicname" required></select>
                </div>
                <div class="form-group">
                    <label>Frequency</label>
                    <select id="freqSelect${index}" class="freqSelect" name="frequency" required></select>
                </div>
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" name="quantity" value="${
                      existingMed?.quantity || ""
                    }" required />
                </div>
            </div>
            <div class="leftform">
                <div class="form-group">
                    <label>Dosage</label>
                    <select id="dosageSelect${index}" class="dosageSelect" name="dosage" required></select>
                </div>
                <div class="form-group">
                    <label>Prescribe By *</label>
                    <select id="selectPrescriber${index}" name="presby" required></select>
                </div>
                <div class="form-group">
                    <label>Prescription Notes</label>
                    <input type="text" name="presNotes" value="${
                      existingMed?.presNotes || ""
                    }" required />
                </div>
            </div>
        </form>
    `;

    return wrapper;
  }

  // ------------------------------
  // Initialize Read-Only Medication Form
  // ------------------------------
  async function initializeReadOnlyMedication(index, existingMed) {
    // Step 1: Load doctors dropdown first
    await loadDoctorsDropdown(`selectPrescriber${index}`);

    // Step 2: Initialize Select2 for medicine, frequency, dosage
    const medicineSelect = $(`#medicineSelect${index}`);
    const freqSelect = $(`#freqSelect${index}`);
    const dosageSelect = $(`#dosageSelect${index}`);
    const prescriberSelect = $(`#selectPrescriber${index}`);

    // Default options for frequency and dosage
    const defaultFrequencies = [
      { id: "Once a day", text: "Once a day" },
      { id: "Twice a day", text: "Twice a day" },
      { id: "Every 8 hours", text: "Every 8 hours" },
      { id: "Every 12 hours", text: "Every 12 hours" },
      { id: "As needed", text: "As needed" },
    ];

    const defaultDosages = [
      { id: "250 mg", text: "250 mg" },
      { id: "500 mg", text: "500 mg" },
      { id: "1 tablet", text: "1 tablet" },
      { id: "2 tablets", text: "2 tablets" },
    ];

    // Initialize frequency select with default options
    freqSelect.select2({
      placeholder: "Select frequency",
      data: defaultFrequencies,
    });

    // Initialize dosage select with default options
    dosageSelect.select2({
      placeholder: "Select dosage",
      data: defaultDosages,
    });

    // Initialize medicine select (no AJAX for read-only)
    medicineSelect.select2({
      placeholder: "Medicine name",
      minimumInputLength: 0,
    });

    // Step 3: Set values from existing medication
    if (existingMed.medicname) {
      const medicineOption = new Option(
        existingMed.medicname,
        existingMed.medicname,
        true,
        true
      );
      medicineSelect.append(medicineOption).trigger("change");
    }

    if (existingMed.frequency) {
      freqSelect.val(existingMed.frequency).trigger("change");
    }

    if (existingMed.dosage) {
      dosageSelect.val(existingMed.dosage).trigger("change");
    }

    if (existingMed.presby) {
      prescriberSelect.val(existingMed.presby).trigger("change");
    }

    // Step 4: Disable all inputs
    setTimeout(() => {
      const form = $(`#medicineSelect${index}`).closest(".patientForm")[0];
      const inputs = form.querySelectorAll(
        'input:not([type="hidden"]), select'
      );

      inputs.forEach((input) => {
        input.disabled = true;
        if ($(input).hasClass("select2-hidden-accessible")) {
          $(input).prop("disabled", true).trigger("change");
        }
      });

      form.style.opacity = "0.7";
      form.style.pointerEvents = "none";
    }, 100);
  }

  // ------------------------------
  // Activate Medicine Search (Pharmacy System Integration)
  // ------------------------------
  function activateMedicineSearch(medSelector, freqSelector, dosageSelector) {
    const selectElement = $(medSelector);

    // Default options for frequency and dosage
    const defaultFrequencies = [
      { id: "Once a day", text: "Once a day" },
      { id: "Twice a day", text: "Twice a day" },
      { id: "Every 8 hours", text: "Every 8 hours" },
      { id: "Every 12 hours", text: "Every 12 hours" },
      { id: "As needed", text: "As needed" },
    ];

    const defaultDosages = [
      { id: "250 mg", text: "250 mg" },
      { id: "500 mg", text: "500 mg" },
      { id: "1 tablet", text: "1 tablet" },
      { id: "2 tablets", text: "2 tablets" },
    ];

    // Initialize frequency & dosage selects
    $(freqSelector).select2({
      placeholder: "Select frequency",
      data: defaultFrequencies,
    });

    $(dosageSelector).select2({
      placeholder: "Select dosage",
      data: defaultDosages,
    });

    // Initialize medicine search with Select2 + AJAX
    selectElement.select2({
      placeholder: "Search medicine...",
      minimumInputLength: 1,
      ajax: {
        transport: async function (params, success, failure) {
          const searchTerm = params.data.q || "";

          // Helper function to format medicine data
          const formatMedicineData = (data) => {
            return {
              results: data.map((m) => {
                let extractedDosage =
                  m.dosage ||
                  m.strength ||
                  m.name.match(/\d+\s?(mg|ML|ml|MG)/i)?.[0] ||
                  "";
                return {
                  id: m.name,
                  text: m.name,
                  dosage: extractedDosage || "500 mg",
                  frequency: "Once a day",
                };
              }),
            };
          };

          // ✅ STEP 1: Try EMR's direct connection to Pharmacy MongoDB Atlas (works even if pharmacy server is offline)
          try {
            const pharmacyDbRes = await fetch(
              `http://localhost:5000/api/pharmacydb/pharmacy-medicines?search=${encodeURIComponent(
                searchTerm
              )}`
            );

            if (pharmacyDbRes.ok) {
              const pharmacyData = await pharmacyDbRes.json();
              console.log(
                `✅ Medicine search: Found ${pharmacyData.length} results from Pharmacy MongoDB Atlas (direct connection)`
              );
              success(formatMedicineData(pharmacyData));
              return; // Success - exit early
            } else if (pharmacyDbRes.status === 503) {
              // Pharmacy database connection not configured, try pharmacy API
              throw new Error(
                "Pharmacy DB connection unavailable, trying API..."
              );
            } else {
              throw new Error(
                `Pharmacy DB search returned ${pharmacyDbRes.status}`
              );
            }
          } catch (pharmacyDbErr) {
            console.warn(
              "⚠️ Direct Pharmacy DB connection failed, trying Pharmacy API:",
              pharmacyDbErr.message
            );

            // ✅ STEP 2: Try Pharmacy System API (if server is online)
            try {
              const pharmacyController = new AbortController();
              const pharmacyTimeout = setTimeout(
                () => pharmacyController.abort(),
                2000
              ); // 2 second timeout

              const pharmacyRes = await fetch(
                `http://localhost:5001/api/medicines/search?search=${encodeURIComponent(
                  searchTerm
                )}`,
                {
                  headers: {
                    Authorization: `Bearer PharmacyDBKey12345`,
                  },
                  signal: pharmacyController.signal,
                }
              );

              clearTimeout(pharmacyTimeout);

              if (pharmacyRes.ok) {
                const pharmacyData = await pharmacyRes.json();
                console.log(
                  `✅ Medicine search: Found ${pharmacyData.length} results from Pharmacy API`
                );
                success(formatMedicineData(pharmacyData));
                return; // Success - exit early
              } else {
                throw new Error(`Pharmacy API returned ${pharmacyRes.status}`);
              }
            } catch (pharmacyApiErr) {
              console.warn(
                "⚠️ Pharmacy API unavailable, falling back to EMR local database:",
                pharmacyApiErr.message
              );

              // ✅ STEP 3: Fallback to EMR Local Database
              try {
                const emrRes = await fetch(
                  `http://localhost:5000/api/pharmacydb/medicines?search=${encodeURIComponent(
                    searchTerm
                  )}`
                );

                if (emrRes.ok) {
                  const emrData = await emrRes.json();
                  console.log(
                    `✅ Medicine search: Found ${emrData.length} results from EMR local database`
                  );
                  success(formatMedicineData(emrData));
                } else {
                  throw new Error(`EMR local search returned ${emrRes.status}`);
                }
              } catch (emrErr) {
                console.error("❌ All medicine search methods failed:", emrErr);
                // Return empty results instead of calling failure() to show "No results found"
                success({ results: [] });
              }
            }
          }
        },
      },
    });

    // When a medicine is selected, **just select the value** instead of overwriting options
    selectElement.on("select2:select", (e) => {
      const med = e.params.data;

      // Frequency
      $(freqSelector)
        .val(med.frequency) // select the default
        .trigger("change");

      // Dosage
      $(dosageSelector)
        .val(med.dosage) // select the default
        .trigger("change");
    });
  }

  // ------------------------------
  // Load Medications
  // ------------------------------
  async function loadMedications() {
    try {
      // Only load medications that are NOT in history (isHistory: false or undefined)
      const res = await fetch(
        `http://localhost:5000/api/patients/${patientId}/medications?isHistory=false`
      );
      if (!res.ok) throw new Error(`Failed to load meds (${res.status})`);
      const meds = await res.json();

      medicationsContainer.innerHTML = "";
      medCount = meds.length;

      if (meds.length === 0) {
        medicationsContainer.innerHTML = `<p style="color:gray;text-align:center;">No medications yet</p>`;
        return;
      }

      // ✅ Load medications sequentially to avoid race conditions
      for (let idx = 0; idx < meds.length; idx++) {
        const m = meds[idx];
        const formWrapper = createMedicationForm(idx + 1, m, true);
        medicationsContainer.appendChild(formWrapper);

        // Initialize and populate this medication form
        await initializeReadOnlyMedication(idx + 1, m);
      }

      // ✅ Delete Medications (with timeout to ensure DOM is ready)
      setTimeout(() => {
        document.querySelectorAll(".deleteMed").forEach((icon) => {
          icon.addEventListener("click", async () => {
            const medId = icon.dataset.id;
            if (!medId || !confirm("Delete this medication?")) return;

            try {
              const res = await fetch(
                `http://localhost:5000/api/medications/${medId}`,
                { method: "DELETE" }
              );
              if (res.ok) {
                alert("Medication deleted!");
                await loadMedications();
              } else alert("Failed to delete medication.");
            } catch (err) {
              console.error(err);
              alert("Error deleting medication.");
            }
          });
        });
      }, 200);
    } catch (err) {
      console.error("Error loading medications:", err);
      medicationsContainer.innerHTML = `<p style="color:red;">Failed to load medications.</p>`;
    }
  }

  // ------------------------------
  // Add / Edit Medication
  // ------------------------------
  if (addBtn) {
    addBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      medCount++;
      const newForm = createMedicationForm(medCount);
      medicationsContainer.appendChild(newForm);
      await loadDoctorsDropdown(`selectPrescriber${medCount}`);
      activateMedicineSearch(
        `#medicineSelect${medCount}`,
        `#freqSelect${medCount}`,
        `#dosageSelect${medCount}`
      );
      buttonCon.style.display = "flex";
      addBtn.textContent = "Cancel Add";

      newForm.querySelector(".deleteMed").addEventListener("click", () => {
        newForm.remove();
        buttonCon.style.display = "none";
        addBtn.textContent = "Add Medication";
      });

      cancelBtn.addEventListener(
        "click",
        () => {
          newForm.remove();
          buttonCon.style.display = "none";
          addBtn.textContent = "Add Medication";
        },
        { once: true }
      );
    });
  }

  // ------------------------------
  // Save Medications & Create Appointment
  // ------------------------------
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      // ✅ FIX: Only get forms that are NEW (not disabled)
      const allForms = [...document.querySelectorAll(".patientForm")];
      const newForms = allForms.filter(
        (form) => !form.querySelector("input").disabled
      );

      if (newForms.length === 0) {
        alert("No new medications to save.");
        return;
      }

      const medData = newForms.map((f) =>
        normalizeFormData(Object.fromEntries(new FormData(f)))
      );

      // Get appointmentId from sessionStorage if available (from prescription page)
      // Store it before we might clear sessionStorage
      const tempAppointmentId = sessionStorage.getItem("currentAppointmentId");
      const appointmentId = tempAppointmentId;
      const followupTime =
        document.getElementById("singleFollowUpTime")?.value || null;
      const followupDate =
        document.getElementById("singleFollowUp")?.value || null;

      try {
        const savedMedIds = [];
        for (const med of medData) {
          // Add appointmentId, followupTime, and followupDate to medication data
          const medWithAppointment = {
            ...med,
            appointmentId: appointmentId || null,
            followupTime: followupTime,
            followup: followupDate || null, // Save followup date
          };

          const res = await fetch(
            `http://localhost:5000/api/patients/${patientId}/medications`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(medWithAppointment),
            }
          );

          if (res.ok) {
            const result = await res.json();
            console.log("Medication saved:", result.medication);
            if (result.medication && result.medication.medId) {
              savedMedIds.push(result.medication.medId);
              // Verify appointmentId was saved
              if (result.medication.appointmentId) {
                console.log(
                  `✅ Medication ${result.medication.medId} saved with appointmentId: ${result.medication.appointmentId}`
                );
              } else {
                console.warn(
                  `⚠️ Medication ${result.medication.medId} saved WITHOUT appointmentId`
                );
              }
            }
          } else {
            const errorText = await res.text();
            console.error("Failed to save medication:", res.status, errorText);
          }
        }

        // Auto create single follow-up appointment
        const followupValue = document.getElementById("singleFollowUp")?.value;
        const followupTimeValue =
          document.getElementById("singleFollowUpTime")?.value || "09:00";
        const followupDuration = parseInt(
          document.getElementById("singleFollowUpDuration")?.value || "30"
        );
        const serviceValue = document.getElementById("singleService")?.value;

        if (followupValue && serviceValue && newForms.length > 0) {
          // Get doctor info from current appointment if available (prescription page)
          let doctorId = "";
          let doctorName = "";
          let patientName = "Unknown";

          // Try to get doctor info from current appointment first
          if (window.currentPrescriptionAppointment?.appointmentId) {
            try {
              const appointmentRes = await fetch(
                `http://localhost:5000/api/appointments/${window.currentPrescriptionAppointment.appointmentId}`
              );
              if (appointmentRes.ok) {
                const appointment = await appointmentRes.json();
                doctorId = appointment.doctorId || "";
                doctorName = appointment.doctorName || "";
              }
            } catch (err) {
              console.warn("Could not fetch current appointment:", err);
            }
          }

          // Fallback: Try to get doctor from prescriber select
          if (!doctorId || !doctorName) {
            const prescriberSelect = newForms[0].querySelector(
              'select[name="presby"]'
            );
            doctorName = prescriberSelect?.value || "N/A";

            try {
              const usersRes = await fetch("http://localhost:5000/api/users");
              if (usersRes.ok) {
                const users = await usersRes.json();
                const doctor = users.find((u) => `Dr. ${u.name}` === doctorName);
                if (doctor) {
                  doctorId = doctor.userId;
                  doctorName = `Dr. ${doctor.name}`;
                }
              }
            } catch (err) {
              console.warn("Could not fetch doctor ID:", err);
            }
          }

          // Get patient name
          try {
            const patientRes = await fetch(
              `http://localhost:5000/api/patients/${patientId}`
            );
            if (patientRes.ok) {
              const patient = await patientRes.json();
              patientName = `${patient.firstname || ""} ${
                patient.lastname || ""
              }`.trim();
            }
          } catch (err) {
            console.warn("Could not fetch patient name:", err);
          }

          // Only create appointment if we have a valid doctorId
          if (doctorId && doctorId !== "Unknown") {
            const appointmentData = {
              patientId,
              patientName,
              doctorId,
              doctorName,
              date: followupValue,
              time: followupTimeValue,
              duration: followupDuration,
              type: serviceValue,
              reason: "Follow-up from medication module",
              notes: "Auto-generated from prescription",
              status: "Upcoming", // Explicitly set status to ensure it appears in appointment list
            };

            const appRes = await fetch("http://localhost:5000/api/appointments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(appointmentData),
            });

            if (appRes.ok) {
              alert("✅ Medications saved and follow-up appointment created!");
            } else {
              const errorData = await appRes.json().catch(() => ({}));
              console.error("Failed to create follow-up appointment:", errorData);
              alert("✅ Medications saved, but failed to create follow-up appointment: " + (errorData.message || "Unknown error"));
            }
          } else {
            console.warn("Cannot create follow-up appointment: Invalid doctor ID");
            alert("✅ Medications saved, but could not create follow-up appointment (doctor not found).");
          }
        } else {
          alert("✅ Medications saved successfully!");
        }

        // Move saved medications to prescription history
        if (savedMedIds.length > 0) {
          try {
            await fetch(
              `http://localhost:5000/api/patients/${patientId}/medications/move-to-history`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ medicationIds: savedMedIds }),
              }
            );
          } catch (err) {
            console.warn("Could not move medications to history:", err);
          }
        }

        // Check if opened from prescription modal - if so, refresh modal before closing
        const wasFromModal =
          sessionStorage.getItem("currentAppointmentId") !== null;

        if (wasFromModal || isPrescriptionPage) {
          // Don't move to history immediately - let the prescription page refresh
          // The medications will be moved to history when the appointment is completed

          // Wait a moment for medications to be fully saved in database
          await new Promise((resolve) => setTimeout(resolve, 500));

          // If on prescription page, just refresh the medications list but keep form open
          if (isPrescriptionPage) {
            // Refresh medications list in prescription page
            if (window.currentPrescriptionAppointment) {
              const {
                patientId: prescriptionPatientId,
                appointmentId: prescriptionAppointmentId,
              } = window.currentPrescriptionAppointment;
              await loadPrescriptionMedications(
                prescriptionPatientId,
                prescriptionAppointmentId
              );
            }

            // Hide form container after saving (user can click "Add Prescription" again if needed)
            const formContainer = document.getElementById(
              "medicationFormContainer"
            );
            if (formContainer) {
              formContainer.style.display = "none";
            }

            // Clear form
            if (medicationsContainer) {
              medicationsContainer.innerHTML = "";
            }
            medCount = 0;

            // Clear follow-up fields
            const followUpDate = document.getElementById("singleFollowUp");
            const followUpTime = document.getElementById("singleFollowUpTime");
            const followUpDuration = document.getElementById(
              "singleFollowUpDuration"
            );
            const followUpService = document.getElementById("singleService");

            if (followUpDate) followUpDate.value = "";
            if (followUpTime) followUpTime.value = "";
            if (followUpDuration) followUpDuration.value = "30";
            if (window.jQuery && followUpService && $(followUpService).length) {
              $(followUpService).val(null).trigger("change");
            }

            // Hide save button
            const buttonCon = document.getElementById("buttonCon");
            if (buttonCon) buttonCon.style.display = "none";

            alert(
              "✅ Medications saved successfully! Click 'Add Prescription' again to add more medications or click 'Done' to complete the appointment."
            );
            return;
          }

          // Get patientId and appointmentId before clearing sessionStorage
          const urlParams = new URLSearchParams(window.location.search);
          const patientIdFromUrl = urlParams.get("patientId");

          // Clear sessionStorage
          sessionStorage.removeItem("currentAppointmentId");

          // Navigate back to prescription page (it will auto-refresh medications)
          if (patientIdFromUrl && tempAppointmentId) {
            // Navigate back to prescription page
            window.location.href = `Prescription.html?appointmentId=${tempAppointmentId}&patientId=${patientIdFromUrl}`;
          } else if (tempAppointmentId) {
            // Try to get patientId from window if available
            const storedPatientId = window.currentPatientId || patientId;
            if (storedPatientId) {
              window.location.href = `Prescription.html?appointmentId=${tempAppointmentId}&patientId=${storedPatientId}`;
            } else {
              window.history.back();
            }
          } else {
            // If we can't get the IDs, just go back
            window.history.back();
          }
          return;
        }

        // Move saved medications to prescription history (for non-modal saves)
        if (savedMedIds.length > 0) {
          try {
            await fetch(
              `http://localhost:5000/api/patients/${patientId}/medications/move-to-history`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ medicationIds: savedMedIds }),
              }
            );
          } catch (err) {
            console.warn("Could not move medications to history:", err);
          }
        }

        // Move saved medications to prescription history (for non-modal saves)
        if (savedMedIds.length > 0) {
          try {
            await fetch(
              `http://localhost:5000/api/patients/${patientId}/medications/move-to-history`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ medicationIds: savedMedIds }),
              }
            );
          } catch (err) {
            console.warn("Could not move medications to history:", err);
          }
        }

        await loadMedications();
        if (buttonCon) buttonCon.style.display = "none";
        if (addBtn) {
          addBtn.style.display = "inline-block";
          addBtn.textContent = "Add Medication";
        }

        // Clear the follow-up fields after save
        document.getElementById("singleFollowUp").value = "";
        document.getElementById("singleFollowUpTime").value = "";
        if (window.jQuery && $("#singleService").length) {
          $("#singleService").val(null).trigger("change");
        }
      } catch (err) {
        console.error("Error saving medications:", err);
        alert("Error saving medications.");
      }
    });
  }

  // ------------------------------
  // Print / Preview Prescriptions + Follow-up
  // ------------------------------
  const printBtn = document.getElementById("printBtn");
  const modal = document.getElementById("printModal");
  const confirmBtn = document.getElementById("confirmPrint");
  const cancelPrint = document.getElementById("cancelPrint");
  const prescriptionList = document.getElementById("prescriptionList");

  if (printBtn) {
    printBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const medsRes = await fetch(
          `http://localhost:5000/api/patients/${patientId}/medications`
        );
        const meds = await medsRes.json();

        const followupDate =
          document.getElementById("singleFollowUp")?.value || "N/A";
        const followupService =
          document.getElementById("singleService")?.value || "N/A";

        let medsTableHTML = "";
        if (meds.length === 0) {
          medsTableHTML = `<p>No medications prescribed yet.</p>`;
        } else {
          medsTableHTML = `
          <table class="prescription-table">
            <thead>
              <tr>
                <th>Medicine Name</th>
                <th>Quantity</th>
                <th>Frequency</th>
                <th>Prescribed By</th>
                <th>Prescription Notes</th>
              </tr>
            </thead>
            <tbody>
              ${meds
                .map(
                  (m) => `
                <tr>
                  <td>${escapeHtml(m.medicname || "")}</td>
                  <td>${m.quantity ?? ""}</td>
                  <td>${escapeHtml(m.frequency || "")}</td>
                  <td>${escapeHtml(m.presby || "")}</td>
                  <td>${escapeHtml(m.presNotes || "")}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `;
        }

        // Build full modal HTML including follow-up info
        prescriptionList.innerHTML = `
        <div class="followup-info" style="margin-bottom:20px;">
          <p><strong>Follow-up Appointment:</strong></p>
          <p>Date: ${followupDate}</p>
          <p>Service / Type: ${followupService}</p>
        </div>
        ${medsTableHTML}
      `;

        modal.style.display = "flex";
      } catch (err) {
        console.error("Error loading medications for print:", err);
        prescriptionList.innerHTML = `<p style="color:red;">Failed to load medications.</p>`;
        modal.style.display = "flex";
      }
    });
  }

  if (cancelPrint)
    cancelPrint.addEventListener("click", () => {
      if (modal) modal.style.display = "none";
    });

  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      try {
        const medsRes = await fetch(
          `http://localhost:5000/api/patients/${patientId}/medications`
        );
        const meds = await medsRes.json();

        const followupDate =
          document.getElementById("singleFollowUp")?.value || "N/A";
        const followupService =
          document.getElementById("singleService")?.value || "N/A";

        let prescriberName = "___________________________";
        if (meds.length > 0 && meds[0].presby) prescriberName = meds[0].presby;

        const modalContent = document
          .getElementById("modalContent")
          .cloneNode(true);
        const buttons = modalContent.querySelector(".modal-buttons");
        if (buttons) buttons.remove();

        const printWindow = window.open("", "", "width=900,height=700");
        printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Prescription</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .prescription-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .prescription-table th, .prescription-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .prescription-table th { background-color: #f2f2f2; }
            .followup-info { margin-bottom: 20px; }
          </style>
        </head>
        <body>
          ${modalContent.innerHTML}
          <p><strong>Prescriber:</strong> ${prescriberName}</p>
        </body>
        </html>
      `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      } catch (err) {
        console.error("Error preparing print:", err);
        alert("Failed to prepare prescription for printing.");
      }
    });
  }

  window.addEventListener("click", (event) => {
    if (event.target === modal) modal.style.display = "none";
  });

  // ------------------------------
  // Initial Load
  // ------------------------------
  // Only load if not on prescription page (prescription page will load when form is shown)
  if (!isPrescriptionPage) {
    loadMedications();
    loadServicesDropdown(); // Load services from billing system
  }

  // Expose functions globally for prescription page
  window.createMedicationForm = createMedicationForm;
  window.activateMedicineSearch = activateMedicineSearch;
  window.loadDoctorsDropdown = loadDoctorsDropdown;
  window.loadServicesDropdown = loadServicesDropdown;

  // Expose function to initialize medication form on prescription page
  window.initPrescriptionMedicationForm = async function (patientId) {
    const container = document.getElementById("medicationsContainer");
    if (!container) return;

    // Set patientId
    window.currentPatientId = patientId;

    // Load services dropdown
    await loadServicesDropdown();

    // Add first medication form if none exists
    const existingForms = container.querySelectorAll(".medecineCon");
    if (existingForms.length === 0) {
      const currentMedCount =
        container.querySelectorAll(".medecineCon").length + 1;
      const form = createMedicationForm(currentMedCount);
      container.appendChild(form);

      // Call activateMedicineSearch with proper selectors (same as medication tab)
      await activateMedicineSearch(
        `#medicineSelect${currentMedCount}`,
        `#freqSelect${currentMedCount}`,
        `#dosageSelect${currentMedCount}`
      );
      await loadDoctorsDropdown(`selectPrescriber${currentMedCount}`);

      const buttonCon = document.getElementById("buttonCon");
      if (buttonCon) buttonCon.style.display = "flex";
    }
  };

  // Expose function to add medication form (for prescription page)
  window.addMedicationForm = async function () {
    const container = document.getElementById("medicationsContainer");
    if (!container) return;

    const existingForms = container.querySelectorAll(".medecineCon");
    const currentMedCount = existingForms.length + 1;
    const form = createMedicationForm(currentMedCount);
    container.appendChild(form);

    // Call activateMedicineSearch with proper selectors (same as medication tab)
    await activateMedicineSearch(
      `#medicineSelect${currentMedCount}`,
      `#freqSelect${currentMedCount}`,
      `#dosageSelect${currentMedCount}`
    );
    await loadDoctorsDropdown(`selectPrescriber${currentMedCount}`);

    const buttonCon = document.getElementById("buttonCon");
    if (buttonCon) buttonCon.style.display = "flex";
  };
});
