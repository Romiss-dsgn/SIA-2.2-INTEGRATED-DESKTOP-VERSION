document.addEventListener("DOMContentLoaded", () => {
  const patientId = new URLSearchParams(window.location.search).get("patientId");
  if (!patientId) return alert("No patient selected!");

  // ✅ ROLE-BASED ACCESS CONTROL
  const userRole = sessionStorage.getItem("role");

  // Lab Results tab — visible to Doctor and Medtech only
  const labResultsTab = document.getElementById("labResultsTab");
  if (labResultsTab) {
    labResultsTab.style.display = (userRole === "Doctor" || userRole === "Medtech") ? "inline-flex" : "none";
  }

  // ✅ Request Form & Referral Form buttons — visible to Doctor only
  const requestFormBtn = document.getElementById("requestFormBtn");
  const referralFormBtn = document.getElementById("referralFormBtn");
  if (userRole === "Doctor") {
    if (requestFormBtn) requestFormBtn.style.display = "inline-flex";
    if (referralFormBtn) referralFormBtn.style.display = "inline-flex";
  } else {
    if (requestFormBtn) requestFormBtn.style.display = "none";
    if (referralFormBtn) referralFormBtn.style.display = "none";
  }

  // ✅ Helper: store patient data to sessionStorage for form buttons
  function storePatientToSession(p) {
    let age = "";
    if (p.dob) {
      const today = new Date();
      const birth = new Date(p.dob);
      age = today.getFullYear() - birth.getFullYear();
      const notYet = today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
      if (notYet) age--;
    }
    const sex = p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "";
    sessionStorage.setItem("rf_patientName",   `${p.firstname || ""} ${p.lastname || ""}`.trim());
    sessionStorage.setItem("rf_patientDOB",    p.dob || "");
    sessionStorage.setItem("rf_patientID",     patientId);
    sessionStorage.setItem("rf_contactNumber", p.phone || "");
    sessionStorage.setItem("rf_patientAge",    String(age));
    sessionStorage.setItem("rf_patientSex",    sex);
  }

  // ✅ Keep patientId across navbar links
  document.querySelectorAll("nav-bar a").forEach(link => {
    const href = link.getAttribute("href");
    if (href && !href.includes("?patientId=")) {
      link.setAttribute("href", `${href}?patientId=${patientId}`);
    }
  });

  // Load patient header + wire form buttons
  async function loadPatientHeader() {
    try {
      const res = await fetch(`http://localhost:5000/api/patients/${patientId}`);
      if (!res.ok) throw new Error("Patient not found");
      const p = await res.json();
      let displayName = p.firstname || "";
    if (p.middlename && p.middlename.trim()) {
      displayName += " " + p.middlename.trim().charAt(0).toUpperCase() + ".";
    }
    displayName += " " + (p.lastname || "");
    document.querySelector("header h1").textContent = `Patient Information - ${displayName.trim()}`;

      // ✅ Wire up form buttons with patient session data
      if (requestFormBtn) {
        requestFormBtn.addEventListener("click", () => {
          storePatientToSession(p);
          window.location.href = "RequestForm.html";
        });
      }
      if (referralFormBtn) {
        referralFormBtn.addEventListener("click", () => {
          storePatientToSession(p);
          window.location.href = "ReferralForm.html";
        });
      }
    } catch (err) {
      console.error("Error loading patient header:", err);
    }
  }

  loadPatientHeader();

  const addBtn = document.getElementById("addAllergyBtn");
  const saveBtn = document.querySelector(".savebtn");
  const cancelBtn = document.querySelector(".cancelbtn");
  const buttonCon = document.getElementById("buttonCon");
  const allergiesContainer = document.getElementById("allergiesContainer");

  let allergyCount = 0;
  let addMode = false;
  buttonCon.style.display = "none";

  // ✅ Hide Add Allergy button from Medtech
  if (userRole === "Medtech" && addBtn) {
    addBtn.style.display = "none";
  }

  // ✅ Create Allergy Form Block
  function createAllergyForm(index) {
    const wrapper = document.createElement("div");
    wrapper.className = "medecineCon bg-slate-50 border border-slate-200 rounded-xl p-5 mb-4";
    wrapper.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-bold text-primary">Allergy ${index}</h3>
        <button type="button" class="deleteAllergy flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer">
          <i class="fa-solid fa-trash text-sm"></i>
        </button>
      </div>
      <form class="patientForm grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Allergen</label>
          <input type="text" name="allergen" placeholder="e.g. Peanuts, Penicillin" required
            class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Severity</label>
          <select name="severity" required
            class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
            <option value="Mild">Mild</option>
            <option value="Moderate">Moderate</option>
            <option value="Severe">Severe</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reaction</label>
          <input type="text" name="reaction" placeholder="e.g. Hives, Anaphylaxis" required
            class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Diagnosed Date</label>
          <input type="date" name="diadate" required
            class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
      </form>
    `;
    return wrapper;
  }

  // ✅ Add Allergy
  addBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!addMode) {
      const existing = allergiesContainer.querySelectorAll(".medecineCon");
      if (existing.length === 0) allergyCount = 0;
      allergyCount++;
      const newForm = createAllergyForm(allergyCount);
      allergiesContainer.appendChild(newForm);

      newForm.querySelector(".deleteAllergy").addEventListener("click", () => {
        newForm.remove();
        const allForms = allergiesContainer.querySelectorAll(".medecineCon");
        allForms.forEach((form, idx) => {
          const title = form.querySelector("h3");
          if (title) title.textContent = `Allergy ${idx + 1}`;
        });
        allergyCount = allForms.length;
        if (allergyCount === 0) {
          buttonCon.style.display = "none";
          addBtn.textContent = "Add Allergy";
          addMode = false;
        }
      });

      buttonCon.style.display = "flex";
      addBtn.textContent = "Cancel Add";
      addMode = true;
    } else {
      const lastForm = allergiesContainer.lastElementChild;
      if (lastForm && lastForm.querySelector("input:not([disabled])")) lastForm.remove();
      allergyCount = allergiesContainer.querySelectorAll(".medecineCon").length;
      buttonCon.style.display = "none";
      addBtn.textContent = "Add Allergy";
      addMode = false;
    }
  });

  // ✅ Cancel button
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const lastForm = allergiesContainer.lastElementChild;
    if (lastForm && lastForm.querySelector("input:not([disabled])")) lastForm.remove();
    buttonCon.style.display = "none";
    addBtn.textContent = "Add Allergy";
    addMode = false;
  });

  // ✅ Save button
  saveBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const pid = new URLSearchParams(window.location.search).get("patientId");
    if (!pid) return alert("No patient selected!");

    const lastForm = allergiesContainer.querySelector(".medecineCon:last-child .patientForm");
    if (!lastForm) return alert("No allergy to save!");
    if (!lastForm.checkValidity()) { lastForm.reportValidity(); return; }

    const formData = Object.fromEntries(new FormData(lastForm).entries());

    try {
      const res = await fetch(`http://localhost:5000/api/patients/${pid}/allergies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Error saving allergy");
      alert("✅ Allergy saved successfully!");
      buttonCon.style.display = "none";
      addBtn.textContent = "Add Allergy";
      addMode = false;
      loadAllergies();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to save allergy");
    }
  });
});

// ✅ Load Existing Allergies on Page Load
async function loadAllergies() {
  const patientId = new URLSearchParams(window.location.search).get("patientId");
  if (!patientId) return;

  try {
    const res = await fetch(`http://localhost:5000/api/patients/${patientId}/allergies`);
    const allergies = await res.json();
    const allergiesContainer = document.getElementById("allergiesContainer");
    allergiesContainer.innerHTML = "";

    if (allergies.length === 0) {
      allergiesContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-slate-400">
          <i class="fa-solid fa-shield-virus text-4xl mb-3 opacity-30"></i>
          <p class="text-sm font-medium">No allergies recorded</p>
        </div>
      `;
      return;
    }

    const severityColors = {
      Mild:     "bg-yellow-50 text-yellow-700 border border-yellow-200",
      Moderate: "bg-orange-50 text-orange-700 border border-orange-200",
      Severe:   "bg-red-50 text-red-700 border border-red-200",
    };

    allergies.forEach((a, i) => {
      const severityClass = severityColors[a.severity] || "bg-slate-100 text-slate-600";
      const wrapper = document.createElement("div");
      wrapper.className = "medecineCon bg-slate-50 border border-slate-200 rounded-xl p-5 mb-4";
      wrapper.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h3 class="text-base font-bold text-primary">Allergy ${i + 1}</h3>
            <span class="text-xs font-bold px-3 py-1 rounded-full ${severityClass}">${a.severity || "Unknown"}</span>
          </div>
          <button type="button" class="deleteAllergy flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer" data-id="${a.allergyId}">
            <i class="fa-solid fa-trash text-sm pointer-events-none"></i>
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Allergen</label>
            <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${a.allergen || "—"}</div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Severity</label>
            <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${a.severity || "—"}</div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reaction</label>
            <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${a.reaction || "—"}</div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Diagnosed Date</label>
            <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${a.diadate ? a.diadate.split("T")[0] : "—"}</div>
          </div>
        </div>
      `;

      wrapper.querySelector(".deleteAllergy").addEventListener("click", async (e) => {
        const allergyId = e.currentTarget.dataset.id;
        if (confirm("Delete this allergy?")) {
          await fetch(`http://localhost:5000/api/allergies/${allergyId}`, { method: "DELETE" });
          loadAllergies();
        }
      });

      allergiesContainer.appendChild(wrapper);
    });
  } catch (err) {
    console.error("❌ Error loading allergies:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadAllergies);