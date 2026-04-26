document.getElementById("addPatient").addEventListener("submit", async function(e) {
  e.preventDefault();
  
  // Additional client-side validation
  const phone = document.getElementById("phone").value;
  const emPhone = document.getElementById("em_phone").value;
  const zipcode = document.getElementById("zipcode").value;
  const dob = document.getElementById("dob").value;
  
  // Validate phone numbers (only digits, exactly 11)
  if (!/^\d{11}$/.test(phone)) {
    alert("Phone number must be exactly 11 digits");
    return;
  }
  
  if (emPhone && !/^\d{11}$/.test(emPhone)) {
    alert("Emergency phone number must be exactly 11 digits");
    return;
  }
  
  // Validate zip code (exactly 4 digits)
  if (!/^\d{4}$/.test(zipcode)) {
    alert("Zip code must be exactly 4 digits");
    return;
  }
  
  // Validate age (must be at least 0 and not future date)
  const birthDate = new Date(dob);
  const today = new Date();
  if (birthDate > today) {
    alert("Date of birth cannot be in the future");
    return;
  }
  
  // --- START: Applied the @gmail.com validation logic ---
  const gmailRegex = /^[^\s@]+@gmail\.com$/i;

  // Validate primary email format
  const email = document.getElementById("email").value;
  if (!gmailRegex.test(email)) {
    alert("The primary email address must be a valid @gmail.com account.");
    return;
  }
  
  // Validate emergency email format (if provided)
  const emEmail = document.getElementById("em_email").value;
  if (emEmail && !gmailRegex.test(emEmail)) {
    alert("The emergency contact email address must be a valid @gmail.com account if provided.");
    return;
  }
  // --- END: Applied the @gmail.com validation logic ---

  // ✅ NEW: Check for duplicate email in existing patients
  try {
    const checkResponse = await fetch("http://localhost:5000/api/patients");
    if (checkResponse.ok) {
      const existingPatients = await checkResponse.json();
      const duplicatePatient = existingPatients.find(
        patient => patient.email.toLowerCase() === email.toLowerCase()
      );
      
      if (duplicatePatient) {
        alert("This email address is already registered to another patient. Please use a different email.");
        return;
      }
    }
  } catch (err) {
    console.error("Error checking for duplicate email:", err);
    // Continue with form submission if check fails (server will validate)
  }
  // --- END: Duplicate email validation ---

  const formData = {
    firstname: document.getElementById("firstname").value.trim(),
    middlename: document.getElementById("middlename").value.trim() || null, // ✅ ADDED - Middle name (optional)
    lastname: document.getElementById("lastname").value.trim(),
    dob: dob,
    gender: document.getElementById("gender").value,
    address: document.getElementById("address").value.trim(),
    city: document.getElementById("city").value.trim(),
    barangay: document.getElementById("barangay").value.trim(),
    zipcode: zipcode,
    email: email.trim(),
    phone: phone,
    insurance: document.getElementById("insurance").value.trim(),
    em_fullname: document.getElementById("em_fullname").value.trim(),
    em_phone: emPhone,
    relationship: document.getElementById("relationship").value.trim(),
    em_email: emEmail.trim()
  };

  try {
    const response = await fetch("http://localhost:5000/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });
    const text = await response.text();
    try {
      const result = JSON.parse(text);
      alert(result.message);
      if (response.ok) window.location.href = "Patients.html";
    } catch {
      console.error("Not JSON response:", text);
      alert("Server returned non-JSON response. Check backend URL.");
    }
  } catch (err) {
    alert("Network error: " + err.message);
  }
});

// Real-time input validation for phone numbers
document.getElementById("phone").addEventListener("input", function(e) {
  this.value = this.value.replace(/\D/g, '').slice(0, 11);
});

document.getElementById("em_phone").addEventListener("input", function(e) {
  this.value = this.value.replace(/\D/g, '').slice(0, 11);
});

// Real-time input validation for zip code
document.getElementById("zipcode").addEventListener("input", function(e) {
  this.value = this.value.replace(/\D/g, '').slice(0, 4);
});

// Real-time validation for names (only letters, spaces, hyphens, apostrophes)
const nameFields = ['firstname', 'middlename', 'lastname', 'em_fullname']; // ✅ ADDED middlename to validation
nameFields.forEach(fieldId => {
  const field = document.getElementById(fieldId);
  if (field) { // Check if field exists (middlename might not exist in older versions)
    field.addEventListener("input", function(e) {
      this.value = this.value.replace(/[^A-Za-zÑñ\s\-']/g, '');
    });
  }
});

document.getElementById("dob").setAttribute("max", new Date().toISOString().split("T")[0]);