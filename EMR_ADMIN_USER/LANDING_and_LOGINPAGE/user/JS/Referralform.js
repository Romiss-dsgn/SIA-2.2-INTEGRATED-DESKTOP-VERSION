// ============================================================
//  ReferralForm.js  -  Well Served Infirmary
// ============================================================

window.addEventListener("DOMContentLoaded", function () {
  // ✅ Read all patient data from sessionStorage
  const patientName   = sessionStorage.getItem("rf_patientName") || "";
  const patientDOB    = sessionStorage.getItem("rf_patientDOB")  || "";
  const patientAge    = sessionStorage.getItem("rf_patientAge")  || "";
  const patientSex    = sessionStorage.getItem("rf_patientSex")  || "";
  const physicianName = sessionStorage.getItem("name")           || "";

  console.log("🔍 ReferralForm sessionStorage:", {
    patientName, patientDOB, patientAge, patientSex, physicianName
  });

  // Compute age from DOB if not directly stored
  let age = patientAge;
  if (!age && patientDOB) {
    const today = new Date();
    const birth = new Date(patientDOB);
    age = today.getFullYear() - birth.getFullYear();
    const notYet =
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() &&
       today.getDate()  < birth.getDate());
    if (notYet) age--;
  }

  const ageSexValue =
    age && patientSex ? `${age} / ${patientSex}` :
    age               ? String(age)               :
    patientSex        ? patientSex                : "—";

  _setVal("patientName",   patientName);
  _setVal("patientAgeSex", ageSexValue);
  _setVal("physicianName", physicianName);

  // Default date to today
  document.getElementById("referralDate").value =
    new Date().toISOString().split("T")[0];

  console.log("✅ ReferralForm autofill done:", { patientName, ageSexValue, physicianName });
});

// ── Private helpers ───────────────────────────────────────────
function _setVal(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.value = value;
  } else {
    console.warn("⚠️ Element not found:", id);
  }
}

function _getVal(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function _formatDate(raw) {
  if (!raw) return "";
  const d = new Date(raw + "T00:00:00");
  return d.toLocaleDateString("en-PH", {
    year:  "numeric",
    month: "long",
    day:   "numeric",
  });
}

function _multilineField(value) {
  const isEmpty = !value;
  return `<div class="field-multiline${isEmpty ? " empty" : ""}">${
    isEmpty ? "—" : value
  }</div>`;
}

// ── Show error alert ──────────────────────────────────────────
function _showError(msg) {
  const el    = document.getElementById("errorAlert");
  const msgEl = document.getElementById("errorMessage");
  if (!el || !msgEl) return;
  msgEl.textContent = msg;
  el.classList.remove("hidden");
  el.classList.add("flex");
  document.getElementById("pageScroll")
    ?.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => {
    el.classList.add("hidden");
    el.classList.remove("flex");
  }, 5000);
}

// ── Public: clear form ────────────────────────────────────────
function resetReferralForm() {
  [
    "referredTo", "reasonForReferral", "impression",
    "pertinentHistory", "pertinentLabs", "managementDone",
    "licenseNo", "ptrNo", "s2No",
  ].forEach((id) => _setVal(id, ""));

  ["referredTo", "reasonForReferral"].forEach((id) =>
    document.getElementById(id)?.classList.remove("error")
  );

  document.getElementById("referralDate").value =
    new Date().toISOString().split("T")[0];
}

// ── Public: print ─────────────────────────────────────────────
function printReferral() {
  const referredTo = _getVal("referredTo");
  const reason     = _getVal("reasonForReferral");

  // Validate required fields
  let hasError = false;
  if (!referredTo) {
    document.getElementById("referredTo")?.classList.add("error");
    hasError = true;
  } else {
    document.getElementById("referredTo")?.classList.remove("error");
  }
  if (!reason) {
    document.getElementById("reasonForReferral")?.classList.add("error");
    hasError = true;
  } else {
    document.getElementById("reasonForReferral")?.classList.remove("error");
  }
  if (hasError) {
    _showError("Please fill in the required fields: Referred Doctor and Reason for Referral.");
    return;
  }

  const dateStr       = _formatDate(_getVal("referralDate"));
  const patientName   = _getVal("patientName");
  const patientAgeSex = _getVal("patientAgeSex");
  const impression    = _getVal("impression");
  const history       = _getVal("pertinentHistory");
  const labs          = _getVal("pertinentLabs");
  const management    = _getVal("managementDone");
  const physician     = _getVal("physicianName");
  const licenseNo     = _getVal("licenseNo");
  const ptrNo         = _getVal("ptrNo");
  const s2No          = _getVal("s2No");

  // ✅ Show preview modal first before printing
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.75);
    display: flex; flex-direction: column; align-items: center;
    justify-content: flex-start; z-index: 99999; padding: 20px;
    box-sizing: border-box; overflow-y: auto;
  `;

  // Toolbar with Print and Close buttons
  const toolbar = document.createElement('div');
  toolbar.style.cssText = `
    display: flex; gap: 10px; margin-bottom: 14px;
    align-items: center; flex-shrink: 0; position: sticky; top: 0;
  `;
  toolbar.innerHTML = `
    <span style="color:#fff; font-size:15px; font-weight:700; margin-right:8px; letter-spacing:0.5px;">
      📄 Print Preview
    </span>
    <button id="previewPrintBtn" style="
      background: #065f46; color: #fff; border: none; border-radius: 6px;
      padding: 9px 22px; font-size: 14px; font-weight: 600; cursor: pointer;
      transition: background 0.2s;
    ">🖨️ Print</button>
    <button id="previewCloseBtn" style="
      background: #6b7280; color: #fff; border: none; border-radius: 6px;
      padding: 9px 18px; font-size: 14px; cursor: pointer;
      transition: background 0.2s;
    ">✕ Close</button>
  `;
  overlay.appendChild(toolbar);

  // Visible iframe — this is what the user sees as the preview
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    width: 794px; min-height: 1123px; border: none;
    border-radius: 6px; background: white; flex-shrink: 0;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  `;
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  const printDoc = iframe.contentDocument || iframe.contentWindow.document;

  printDoc.open();
  printDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Referral Form - ${patientName || "Patient"}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      background: white;
      color: #111827;
      font-size: 10px;
    }
    .referral-wrapper {
      width: 148.5mm;
      min-height: 210mm;
      padding: 6mm 8mm;
      box-sizing: border-box;
      margin: 0 auto;
      background: #fff;
    }
    @media print {
      @page { size: A4 landscape; margin: 0; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { margin: 0; padding: 0; background: white; }
      .referral-wrapper {
        position: absolute; top: 0; left: 0;
        width: 148.5mm; min-height: 210mm;
        padding: 6mm 8mm; box-sizing: border-box; overflow: hidden;
      }
    }
    .header-section {
      display: flex; flex-direction: column;
      padding-bottom: 4px; border-bottom: 3px solid #065f46; margin-bottom: 4px;
    }
    .header-top { display: flex; align-items: center; justify-content: center; gap: 10px; }
    .clinic-info { text-align: center; }
    .clinic-main-name {
      font-size: 17px; font-weight: 900; color: #065f46;
      letter-spacing: 3px; font-family: 'Arial Black', 'Arial Bold', Arial, sans-serif;
      line-height: 1; margin-bottom: 2px;
    }
    .clinic-full-name {
      font-size: 8.5px; font-weight: bold; color: #064e3b;
      letter-spacing: 1px; margin-bottom: 2px; font-family: Arial, sans-serif;
    }
    .clinic-services {
      font-size: 7px; color: #8b5a2b; font-weight: bold;
      letter-spacing: 0.3px; line-height: 1.4; font-family: Arial, sans-serif;
    }
    .clinic-meta {
      display: flex; justify-content: space-between; margin-top: 3px;
      font-size: 6.5px; color: #6b7280; font-family: Arial, sans-serif;
      font-style: italic; width: 100%;
    }
    .doctors-section {
      text-align: center; font-size: 7.5px; font-weight: bold;
      color: #064e3b; font-family: Arial, sans-serif; margin: 3px 0 2px;
    }
    .doctors-row {
      display: grid; grid-template-columns: 1fr 1fr;
      text-align: center; line-height: 1.6; width: 100%;
    }
    .doctors-row span:first-child { text-align: right; padding-right: 16px; }
    .doctors-row span:last-child  { text-align: left;  padding-left: 16px;  }
    .form-title {
      text-align: center; font-size: 14px; font-weight: 900;
      text-transform: uppercase; letter-spacing: 2.5px;
      color: #065f46; padding: 4px 8px; margin: 0 0 10px;
    }
    .field-row   { display: flex; gap: 14px; margin-bottom: 7px; align-items: flex-start; }
    .field       { flex: 1; }
    .field.wide  { flex: 2; }
    .field-label {
      font-size: 8px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.4px; color: #6b7280; margin-bottom: 2px;
    }
    .field-value {
      border-bottom: 1.5px solid #374151; padding: 2px 4px 3px;
      min-height: 18px; font-size: 10.5px; font-weight: 600;
    }
    .section-header {
      font-size: 10px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 1px; color: #065f46;
      border-bottom: 1.5px solid #065f46; padding-bottom: 2px; margin: 8px 0 5px;
    }
    .field-multiline {
      border: 1.5px solid #d1d5db; border-radius: 4px;
      padding: 4px 6px; min-height: 30px; white-space: pre-wrap;
      word-wrap: break-word; font-size: 9.5px; margin-bottom: 6px; line-height: 1.4;
    }
    .field-multiline.empty { background: #fafafa; color: #d1d5db; font-style: italic; }
    .sig-section    { display: flex; justify-content: flex-end; margin-top: 12px; }
    .sig-block      { text-align: center; min-width: 200px; }
    .sig-line       { border-top: 1.5px solid #374151; margin-bottom: 5px; }
    .sig-name       { font-size: 10.5px; font-weight: 700; }
    .sig-title      { font-size: 9.5px; color: #6b7280; margin-bottom: 10px; }
    .sig-details    { text-align: left; font-size: 10.5px; color: #374151; margin-top: 8px; }
    .sig-detail-row { display: flex; gap: 6px; margin-bottom: 5px; align-items: center; }
    .sig-detail-label {
      font-weight: 700; min-width: 85px; font-size: 10px;
      color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .sig-detail-val {
      border-bottom: 1px solid #374151; flex: 1;
      padding-bottom: 2px; min-height: 18px; font-weight: 600;
    }
  </style>
</head>
<body>
<div class="referral-wrapper">
  <div class="header-section">
    <div class="header-top">
      <img src="../user/Assets/wellserved_logo.jpg" alt="WellServed Logo"
        style="width:54px;height:54px;border-radius:50%;border:3px solid #065f46;object-fit:cover;flex-shrink:0;box-shadow:0 2px 8px rgba(6,95,70,0.15);">
      <div class="clinic-info">
        <div class="clinic-main-name">WELLSERVED</div>
        <div class="clinic-full-name">INFIRMARY &amp; DRUGSTORE INC.</div>
        <div class="clinic-services">&bull; MEDICAL &nbsp;&bull; PEDIA &nbsp;&bull; OB GYNE &nbsp;&bull; MINOR SURGERY</div>
        <div class="clinic-services">&bull; X-RAY &nbsp;&bull; ECG &nbsp;&bull; LABORATORY &nbsp;&bull; ULTRASOUND &nbsp;&bull; DRUGSTORE</div>
      </div>
    </div>
    <div class="clinic-meta">
      <span>&#128205; #26 Steve St. cor Villiongco St., Brgy. Commonwealth, Quezon City &nbsp;|&nbsp; Tel: 8 952-77-79</span>
      <span>&#128231; wellservedinfirmary@gmail.com</span>
    </div>
  </div>

  <div class="doctors-section">
    <div class="doctors-row">
      <span>DAISY VILLARAMA-TIGA, M.D. CFP, MHA</span>
      <span>JOSE EDUARDO M. TIGA, M.D. CFP</span>
    </div>
    <div class="doctors-row">
      <span>DANIEL JOSE V. TIGA, M.D. CFP</span>
      <span>EDUARDO MARCO DAYRIT M.D.</span>
    </div>
    <div class="doctors-row">
      <span>KATRINA MAE TIGA-AGUILA, M.D.</span>
      <span>RICSON RAY AGUILA, M.D.</span>
    </div>
  </div>

  <div class="form-title">Referral Form</div>

  <div class="field-row">
    <div class="field">
      <div class="field-label">Date</div>
      <div class="field-value">${dateStr}</div>
    </div>
    <div class="field wide">
      <div class="field-label">To (Referred Doctor / Specialist)</div>
      <div class="field-value">${referredTo}</div>
    </div>
  </div>

  <div class="section-header">Patient Details</div>
  <div class="field-row">
    <div class="field wide">
      <div class="field-label">Patient Name</div>
      <div class="field-value">${patientName}</div>
    </div>
    <div class="field">
      <div class="field-label">Age / Sex</div>
      <div class="field-value">${patientAgeSex}</div>
    </div>
  </div>

  <div class="section-header">Clinical Information</div>
  <div class="field-label" style="margin-bottom:4px;">Reason for Referral</div>
  ${_multilineField(reason)}
  <div class="field-label" style="margin-bottom:4px;">Impression</div>
  ${_multilineField(impression)}
  <div class="field-label" style="margin-bottom:4px;">Pertinent History and PE</div>
  ${_multilineField(history)}
  <div class="field-label" style="margin-bottom:4px;">Pertinent Labs</div>
  ${_multilineField(labs)}
  <div class="field-label" style="margin-bottom:4px;">Management Done</div>
  ${_multilineField(management)}

  <div class="sig-section">
    <div class="sig-block">
      <div style="height:44px;"></div>
      <div class="sig-line"></div>
      <div class="sig-name">${physician ? physician + ", MD" : "_______________________________, MD"}</div>
      <div class="sig-title">Attending Physician</div>
      <div class="sig-details">
        <div class="sig-detail-row">
          <span class="sig-detail-label">License No.:</span>
          <span class="sig-detail-val">${licenseNo}</span>
        </div>
        <div class="sig-detail-row">
          <span class="sig-detail-label">PTR No.:</span>
          <span class="sig-detail-val">${ptrNo}</span>
        </div>
        <div class="sig-detail-row">
          <span class="sig-detail-label">S2 No.:</span>
          <span class="sig-detail-val">${s2No}</span>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`);

  printDoc.close();

  // ✅ Button handlers
  document.getElementById('previewPrintBtn').onclick = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error('Print error:', e);
    }
  };

  document.getElementById('previewCloseBtn').onclick = () => {
    if (overlay.parentNode) document.body.removeChild(overlay);
  };

  // Close modal when clicking outside the iframe
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      if (overlay.parentNode) document.body.removeChild(overlay);
    }
  });
}