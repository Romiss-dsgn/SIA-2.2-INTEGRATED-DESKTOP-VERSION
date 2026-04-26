async function loadPatientInfo() {
  const params = new URLSearchParams(window.location.search);
  const patientId = params.get("patientId");

  if (!patientId) {
    alert("No patient selected!");
    return;
  }

  try {
    const res = await fetch(`http://localhost:5000/api/patients/${patientId}`);
    if (!res.ok) throw new Error("Patient not found");

    const p = await res.json();

    // Fill form fields
    document.getElementById("firstname").value = p.firstname || "";
    document.getElementById("middlename").value = p.middlename || "";
    document.getElementById("lastname").value = p.lastname || "";
    document.getElementById("dob").value = p.dob ? p.dob.substring(0,10) : "";
    document.getElementById("gender").value = p.gender || "";
    document.getElementById("status").value = p.status?.toLowerCase() || "";
    document.getElementById("phone").value = p.phone || "";
    document.getElementById("email").value = p.email || "";
    document.getElementById("address").value = p.address || "";
    document.getElementById("barangay").value = p.barangay || "";
    document.getElementById("city").value = p.city || "";
    document.getElementById("zipcode").value = p.zipcode || "";
    document.getElementById("em_fullname").value = p.em_fullname || "";
    document.getElementById("em_phone").value = p.em_phone || "";
    document.getElementById("relationship").value = p.relationship || "";
    document.getElementById("em_email").value = p.em_email || "";

    // ✅ Format display name with middle initial
    let displayName = p.firstname || "";
    if (p.middlename && p.middlename.trim()) {
      displayName += " " + p.middlename.trim().charAt(0).toUpperCase() + ".";
    }
    displayName += " " + (p.lastname || "");
    document.querySelector("header h1").textContent = `Patient Information - ${displayName.trim()}`;

    // ✅ Compute age
    let age = "";
    if (p.dob) {
      const today = new Date();
      const birth = new Date(p.dob);
      age = today.getFullYear() - birth.getFullYear();
      const notYet =
        today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() &&
         today.getDate() < birth.getDate());
      if (notYet) age--;
    }
    const sex = p.gender
      ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1)
      : "";

    // ✅ Store to sessionStorage immediately when patient loads
    // This ensures Referral Form and Request Form always have data
    // regardless of when the button is clicked
    sessionStorage.setItem("rf_patientName",    displayName.trim());
    sessionStorage.setItem("rf_patientDOB",     p.dob ? p.dob.substring(0, 10) : "");
    sessionStorage.setItem("rf_patientID",      p.patientId || "");
    sessionStorage.setItem("rf_patientAge",     String(age));
    sessionStorage.setItem("rf_patientSex",     sex);
    sessionStorage.setItem("rf_contactNumber",  p.phone || "");

    const followUpInput = document.getElementById("singleFollowUp");
    if (followUpInput) {
      followUpInput.addEventListener("change", () => {
        const followUpDate = followUpInput.value;
        if (!followUpDate) return;

        const patientFullName = displayName.trim();
        addRecentPatient(p.patientId, patientFullName);
        window.location.href = `AppointmentScheduler.html?patientId=${p.patientId}&date=${followUpDate}`;
      });
    }
  } catch (err) {
    console.error("Error loading patient info:", err);
    alert("Unable to load patient information.");
  }
}

window.addEventListener("DOMContentLoaded", loadPatientInfo);


// ✅ EDIT + SAVE FUNCTIONALITY
document.addEventListener("DOMContentLoaded", () => {
  const editBtn = document.querySelector(".editbtn");
  const buttonCon = document.getElementById("buttonCon");
  const formInputs = document.querySelectorAll("#patientForm input, #patientForm select");
  const saveBtn = document.querySelector(".savebtn");
  const cancelBtn = document.querySelector(".cancelbtn");

  if (buttonCon) buttonCon.style.display = "none";

  // ✅ Hide Edit button for Doctors and Medtech — read-only access only
  const userRole = sessionStorage.getItem("role");
  if (editBtn && (userRole === "Doctor" || userRole === "Medtech")) {
    editBtn.style.display = "none";
  }

  if (editBtn) {
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const isEditing = editBtn.classList.toggle("editing");

      if (isEditing) {
        formInputs.forEach(input => input.disabled = false);
        if (buttonCon) buttonCon.style.display = "flex";
        editBtn.innerHTML = `<i class="fa-solid fa-xmark"></i> Exit Edit Mode`;
      } else {
        formInputs.forEach(input => input.disabled = true);
        if (buttonCon) buttonCon.style.display = "none";
        editBtn.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit`;
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      loadPatientInfo();
      formInputs.forEach(input => input.disabled = true);
      if (buttonCon) buttonCon.style.display = "none";
      if (editBtn) {
        editBtn.classList.remove("editing");
        editBtn.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit`;
      }
    });
  }

  // ✅ SAVE CHANGES TO BACKEND
  if (saveBtn) {
    saveBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const params = new URLSearchParams(window.location.search);
      const patientId = params.get("patientId");

      const updatedData = {
        firstname: document.getElementById("firstname").value,
        middlename: document.getElementById("middlename").value,
        lastname: document.getElementById("lastname").value,
        dob: document.getElementById("dob").value,
        gender: document.getElementById("gender").value,
        status: document.getElementById("status").value,
        phone: document.getElementById("phone").value,
        email: document.getElementById("email").value,
        address: document.getElementById("address").value,
        barangay: document.getElementById("barangay").value,
        city: document.getElementById("city").value,
        zipcode: document.getElementById("zipcode").value,
        em_fullname: document.getElementById("em_fullname").value,
        em_phone: document.getElementById("em_phone").value,
        relationship: document.getElementById("relationship").value,
        em_email: document.getElementById("em_email").value
      };

      try {
        const res = await fetch(`http://localhost:5000/api/patients/${patientId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedData)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Error saving data");

        alert("✅ Patient information saved successfully!");

        formInputs.forEach(input => input.disabled = true);
        if (buttonCon) buttonCon.style.display = "none";
        if (editBtn) {
          editBtn.classList.remove("editing");
          editBtn.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit`;
        }
      } catch (err) {
        console.error("Save error:", err);
        alert("❌ Failed to save changes.");
      }
    });
  }
});

// ✅ UPDATE NAV LINKS WITH PATIENT ID & ACCESS CONTROL
document.addEventListener("DOMContentLoaded", () => {
  const patientId = new URLSearchParams(window.location.search).get("patientId");
  if (!patientId) return;

  document.querySelectorAll("nav-bar a").forEach(link => {
    const href = link.getAttribute("href");
    if (href && !href.includes("?patientId=")) {
      link.setAttribute("href", `${href}?patientId=${patientId}`);
    }
  });

  const userRole = sessionStorage.getItem("role");
  const labResultsTab = document.getElementById("labResultsTab");

  if (labResultsTab) {
    if (userRole === "Doctor" || userRole === "Medtech") {
      labResultsTab.style.display = "inline-flex";
    } else {
      labResultsTab.style.display = "none";
    }
  }

  const requestFormBtn = document.getElementById("requestFormBtn");
  const referralFormBtn = document.getElementById("referralFormBtn");

  if (userRole === "Doctor") {
    if (requestFormBtn) requestFormBtn.style.display = "inline-flex";
    if (referralFormBtn) referralFormBtn.style.display = "inline-flex";
  } else {
    if (requestFormBtn) requestFormBtn.style.display = "none";
    if (referralFormBtn) referralFormBtn.style.display = "none";
  }
});