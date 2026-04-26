document.addEventListener("DOMContentLoaded", () => {
  // ================================
  // 🧠 PATIENT HEADER LOAD
  // ================================
  const patientId = new URLSearchParams(window.location.search).get("patientId");
  if (!patientId) return alert("No patient selected!");

  async function loadPatientHeader() {
    try {
      const res = await fetch(`http://localhost:5000/api/patients/${patientId}`);
      if (!res.ok) throw new Error("Patient not found");
      const p = await res.json();
      document.querySelector("header h1").textContent = `Patient Information - ${p.firstname} ${p.lastname}`;
    } catch (err) {
      console.error("Error loading patient header:", err);
    }
  }
  loadPatientHeader();

  // ================================
  // 🎛️ UI ELEMENTS
  // ================================
  const addBtn = document.getElementById("addConditionBtn");
  const saveBtn = document.querySelector(".savebtn");
  const cancelBtn = document.querySelector(".cancelbtn");
  const buttonCon = document.getElementById("buttonCon");
  const container = document.querySelector(".medecineWrap");

  const conditionsContainer = document.createElement("div");
  conditionsContainer.id = "historyContainer";
  container.insertBefore(conditionsContainer, buttonCon);

  let conditionCount = 0;
  let addMode = false;
  buttonCon.style.display = "none";

  // ================================
  // 🧩 CREATE CONDITION FORM BLOCK
  // ================================
  function createConditionForm(index, data = {}) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("medecineCon");

    wrapper.innerHTML = `
      <div class="medecineHeader">
        <h3>Condition ${index}</h3>
        <i class="fa-solid fa-trash deleteCondition"></i>
      </div>

      <form class="patientForm">
        <div class="leftform">
          <div class="form-group">
            <label>Condition</label>
            <input type="text" name="condition" value="${data.condition || ""}" required disabled />
          </div>
          <div class="form-group">
            <label>Status</label>
            <select name="status" required disabled>
              <option value="" disabled ${!data.status ? "selected" : ""}>Select Status</option>
              <option value="Ongoing" ${data.status === "Ongoing" ? "selected" : ""}>Ongoing</option>
              <option value="Cured" ${data.status === "Cured" ? "selected" : ""}>Cured</option>
            </select>
          </div>
        </div>

        <div class="rightform">
          <div class="form-group">
            <label>Diagnosed Date</label>
            <input type="date" name="diadate" value="${data.diadate ? data.diadate.split("T")[0] : ""}" required disabled />
          </div>
        </div>
      </form>
    `;

    if (data.historyId) wrapper.dataset.historyId = data.historyId;
    return wrapper;
  }

  // ================================
  // 📋 LOAD EXISTING CONDITIONS
  // ================================
  async function loadMedicalHistory() {
    try {
      const res = await fetch(`http://localhost:5000/api/patients/${patientId}/medicalhistory`);
      if (!res.ok) throw new Error("Failed to fetch medical history");
      const history = await res.json();

      conditionsContainer.innerHTML = "";
      conditionCount = history.length;

      history.forEach((h, i) => {
        const block = createConditionForm(i + 1, h);
        const deleteBtn = block.querySelector(".deleteCondition");

        deleteBtn.addEventListener("click", async () => {
          if (confirm("Delete this condition?")) {
            await fetch(`http://localhost:5000/api/medicalhistory/${h.historyId}`, { method: "DELETE" });
            alert("🗑️ Condition deleted!");
            loadMedicalHistory();
          }
        });

        conditionsContainer.appendChild(block);
      });
    } catch (err) {
      console.error("❌ Error loading medical history:", err);
    }
  }

  // ================================
  // ➕ ADD NEW CONDITION
  // ================================
  addBtn.addEventListener("click", (e) => {
    e.preventDefault();

    if (!addMode) {
      conditionCount++;
      const newForm = createConditionForm(conditionCount);
      conditionsContainer.appendChild(newForm);
      newForm.querySelectorAll("input, select").forEach((el) => (el.disabled = false));

      buttonCon.style.display = "flex";
      addBtn.textContent = "Cancel Add";
      addMode = true;
    } else {
      const lastForm = conditionsContainer.lastElementChild;
      if (lastForm && !lastForm.dataset.historyId) lastForm.remove();

      buttonCon.style.display = "none";
      addBtn.textContent = "Add Condition";
      addMode = false;

      if (conditionsContainer.children.length === 0) conditionCount = 0;
    }
  });

  // ================================
  // ❌ CANCEL BUTTON
  // ================================
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();

    const lastForm = conditionsContainer.lastElementChild;
    if (lastForm && !lastForm.dataset.historyId) lastForm.remove();

    buttonCon.style.display = "none";
    addBtn.textContent = "Add Condition";
    addMode = false;

    if (conditionsContainer.children.length === 0) conditionCount = 0;
  });

  // ================================
  // 💾 SAVE NEW CONDITION
  // ================================
  saveBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const lastForm = conditionsContainer.querySelector(".patientForm:last-child");
    if (!lastForm) return alert("No condition to save!");

    // 🧩 Validate all required inputs before saving
    if (!lastForm.reportValidity()) return;

    const formData = {};
    lastForm.querySelectorAll("input, select").forEach((el) => (formData[el.name] = el.value));

    try {
      const res = await fetch(`http://localhost:5000/api/patients/${patientId}/medicalhistory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Error saving condition");

      alert("✅ Condition saved successfully!");
      addMode = false;
      buttonCon.style.display = "none";
      addBtn.textContent = "Add Condition";
      loadMedicalHistory();
    } catch (err) {
      console.error("❌ Failed to save condition:", err);
      alert("❌ Failed to save condition");
    }
  });

  // ================================
  // 🌐 KEEP PATIENT ID IN NAV LINKS
  // ================================
  document.querySelectorAll("nav-bar a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && !href.includes("?patientId=")) {
      link.setAttribute("href", `${href}?patientId=${patientId}`);
    }
  });

  // ================================
  // 🚀 INITIAL LOAD
  // ================================
  loadMedicalHistory();
});
