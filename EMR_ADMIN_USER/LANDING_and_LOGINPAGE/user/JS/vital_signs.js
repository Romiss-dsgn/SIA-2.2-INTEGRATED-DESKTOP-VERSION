document.addEventListener("DOMContentLoaded", async () => {
  const saveBtn = document.querySelector(".savebtn");
  const cancelBtn = document.querySelector(".cancelbtn");
  const buttonCon = document.getElementById("buttonCon");
  const vitalSignsContainer = document.getElementById("vitalSignsContainer");
  const patientId = new URLSearchParams(window.location.search).get("patientId");

  if (!patientId) return alert("No patient selected!");
  buttonCon.style.display = "none";

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

  // ✅ Update nav-bar links with patientId
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

  // ✅ Hide Add Vital Sign button from Medtech
  const addVitalBtn = document.getElementById("addVitalBtn");
  if (userRole === "Medtech" && addVitalBtn) {
    addVitalBtn.style.display = "none";
  }

  // Load existing vital sign records
  async function loadVitals() {
    try {
      const res = await fetch(`http://localhost:5000/api/patients/${patientId}/vitalsigns`);
      const vitals = await res.json();

      vitalSignsContainer.innerHTML = "";

      if (vitals.length === 0) {
        vitalSignsContainer.innerHTML = `
          <div class="flex flex-col items-center justify-center py-12 text-slate-400">
            <i class="fa-solid fa-heart-pulse text-4xl mb-3 opacity-30"></i>
            <p class="text-sm font-medium">No vital sign records found</p>
          </div>
        `;
      } else {
        vitals.forEach((v, index) => {
          const card = document.createElement("div");
          card.className = "medecineCon bg-slate-50 border border-slate-200 rounded-xl p-5 mb-4";
          card.innerHTML = `
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-bold text-primary">Vital Sign Record ${index + 1}</h3>
              <button type="button" class="deleteVital flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer" data-id="${v.vitalId}">
                <i class="fa-solid fa-trash text-sm pointer-events-none"></i>
              </button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</label>
                <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${v.date ? v.date.split("T")[0] : "—"}</div>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Heart Rate</label>
                <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${v.heartrate || "—"}</div>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Temperature</label>
                <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${v.temp || "—"}</div>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Weight</label>
                <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${v.weight || "—"}</div>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Blood Pressure</label>
                <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${v.pressure || "—"}</div>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Height</label>
                <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${v.height || "—"}</div>
              </div>
            </div>
            <div class="grid grid-cols-1 gap-4">
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">BMI</label>
                <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${v.bmi || "—"}</div>
              </div>
            </div>
          `;

          card.querySelector(".deleteVital").addEventListener("click", async (e) => {
            const vitalId = e.currentTarget.dataset.id;
            if (!confirm("Delete this record?")) return;
            const res = await fetch(`http://localhost:5000/api/vitalsigns/${vitalId}`, { method: "DELETE" });
            if (res.ok) {
              alert("🗑️ Vital sign record deleted!");
              loadVitals();
            } else {
              alert("❌ Failed to delete record.");
            }
          });

          vitalSignsContainer.appendChild(card);
        });
      }

      attachAddBtnListener();
    } catch (err) {
      console.error("❌ Error loading vitals:", err);
    }
  }

  // Add new record form
  function attachAddBtnListener() {
    const addBtn = document.getElementById("addVitalBtn");
    if (!addBtn) return;

    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (document.querySelector(".newRecord")) return;

      const newCard = document.createElement("div");
      newCard.className = "medecineCon newRecord bg-slate-50 border border-slate-200 rounded-xl p-5 mb-4";
      newCard.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-bold text-primary">New Vital Sign Record</h3>
        </div>
        <form id="vitalForm" class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</label>
            <input type="date" name="date" required
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Heart Rate</label>
            <input type="text" name="heartrate" placeholder="e.g. 75 bpm" required
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Temperature</label>
            <input type="text" name="temp" placeholder="e.g. 36.5°C" required
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Weight</label>
            <input type="text" name="weight" placeholder="e.g. 65 kg" required
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Blood Pressure</label>
            <input type="text" name="pressure" placeholder="e.g. 120/80 mmHg" required
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Height</label>
            <input type="text" name="height" placeholder="e.g. 170 cm" required
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div class="flex flex-col gap-1 col-span-2 md:col-span-3">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">BMI</label>
            <input type="text" name="bmi" placeholder="e.g. 22.5" required
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
        </form>
      `;

      vitalSignsContainer.appendChild(newCard);
      buttonCon.style.display = "flex";
      addBtn.style.display = "none";
    });
  }

  await loadVitals();

  // Cancel button
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector(".newRecord")?.remove();
    buttonCon.style.display = "none";
    const addBtn = document.getElementById("addVitalBtn");
    if (addBtn) addBtn.style.display = "inline-flex";
  });

  // Save button
  saveBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const form = document.querySelector("#vitalForm");
    if (!form) return alert("No form to save!");
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch(`http://localhost:5000/api/patients/${patientId}/vitalsigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save record.");
      alert("✅ Vital sign record added!");
      await loadVitals();
      buttonCon.style.display = "none";
    } catch (err) {
      console.error(err);
      alert("❌ Error saving vital sign record.");
    }
  });
});