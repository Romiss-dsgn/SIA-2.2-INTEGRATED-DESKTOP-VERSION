// ====== GLOBAL STATE ======
let allPatients = [];
let allAppointments = [];
let allArchivedAppointments = [];

// ====== LOAD REPORT STATS ======
async function loadReportStats() {
  try {
    const [patientsRes, appointmentsRes, archiveRes] = await Promise.all([
      fetch("http://localhost:5000/api/patients"),
      fetch("http://localhost:5000/api/appointments"),
      fetch("http://localhost:5000/api/appointments/archive/list")
    ]);

    allPatients = await patientsRes.json();
    allAppointments = await appointmentsRes.json();
    allArchivedAppointments = await archiveRes.json();

    const savedDateRange = sessionStorage.getItem("reportDateRange");
    const savedDoctor = sessionStorage.getItem("reportDoctor");
    const hasActiveFilters = savedDateRange || savedDoctor;

    if (hasActiveFilters) {
      applyFilters();
      return;
    }

    const totalPatients = allPatients.length;
    const activePatients = allPatients.filter(p => p.status?.toLowerCase() === "active").length;
    const inactivePatients = allPatients.filter(p => p.status?.toLowerCase() === "inactive").length;

    const combinedAppointments = [...allAppointments, ...allArchivedAppointments];
    const totalAppointments = combinedAppointments.length;
    const completedAppointments = allArchivedAppointments.filter(a => a.status === "Completed").length;
    const upcomingAppointments = allAppointments.filter(a => a.status === "Upcoming").length;
    const canceledAppointments = allArchivedAppointments.filter(a => a.status === "Canceled").length;

    document.querySelector('.statusDisplay:nth-child(1) h1').textContent = totalPatients;
    document.querySelector('.statusDisplay:nth-child(2) h1').textContent = activePatients;
    document.querySelector('.statusDisplay:nth-child(3) h1').textContent = totalAppointments;
    document.querySelector('.statusDisplay:nth-child(4) h1').textContent = completedAppointments;

    updateCharts(allPatients, activePatients, inactivePatients, upcomingAppointments, completedAppointments, canceledAppointments);
  } catch (err) {
    console.error("Error loading report stats:", err);
  }
}

// ====== UPDATE CHARTS ======
function updateCharts(patients, active, inactive, up, done, cancel) {
  const bars = document.querySelectorAll('.barChart .bar');
  const values = [up, done, cancel];
  const maxDataValue = Math.max(...values, 10);
  const chartPixelHeight = 180;
  const pixelPerUnit = chartPixelHeight / maxDataValue;

  if (bars.length >= 3) {
    bars.forEach((bar, i) => {
      const newHeight = values[i] * pixelPerUnit;
      bar.style.transition = "height 0.5s ease";
      bar.style.height = `${newHeight}px`;
    });
    const barLabels = bars[0].parentElement.parentElement.querySelectorAll('span');
    if (barLabels.length >= 3) {
      barLabels[0].textContent = `Upcoming (${up})`;
      barLabels[1].textContent = `Completed (${done})`;
      barLabels[2].textContent = `Canceled (${cancel})`;
    }
  }

  const yAxisContainer = document.querySelector('.bottom .chart-container:nth-child(1) .y-axis');
  if (yAxisContainer) {
    const yAxisLabels = [
      maxDataValue,
      Math.round(maxDataValue * 0.8),
      Math.round(maxDataValue * 0.6),
      Math.round(maxDataValue * 0.4),
      Math.round(maxDataValue * 0.2),
      0
    ];
    yAxisContainer.innerHTML = yAxisLabels.map(val => `<span>${val}</span>`).join('');
  }

  const totalPatients = active + inactive;
  const activePercent = totalPatients ? (active / totalPatients * 100).toFixed(1) : 0;
  const inactivePercent = totalPatients ? (inactive / totalPatients * 100).toFixed(1) : 0;

  const pie1 = document.querySelector(".pieChart1");
  pie1.style.background = `conic-gradient(#289b3b 0% ${activePercent}%, #696969 ${activePercent}% 100%)`;

  const activePercentageEl = document.getElementById("activePatientPercentage");
  if (activePercentageEl) activePercentageEl.textContent = `${Math.round(activePercent)}%`;

  document.querySelectorAll('.activeText')[0].textContent = `Active: ${active} (${activePercent}%)`;
  document.querySelectorAll('.activeText')[1].textContent = `Inactive: ${inactive} (${inactivePercent}%)`;

  const maleCount = patients.filter(p => p.gender?.toLowerCase() === "male").length;
  const femaleCount = patients.filter(p => p.gender?.toLowerCase() === "female").length;
  const otherCount = patients.length - maleCount - femaleCount;
  const totalGender = maleCount + femaleCount + otherCount;

  const totalPatientsCountEl = document.getElementById("totalPatientsCount");
  if (totalPatientsCountEl) totalPatientsCountEl.textContent = totalGender;

  const malePercent = totalGender ? (maleCount / totalGender * 100).toFixed(1) : 0;
  const femalePercent = totalGender ? (femaleCount / totalGender * 100).toFixed(1) : 0;
  const otherPercent = totalGender ? (otherCount / totalGender * 100).toFixed(1) : 0;

  const pie2 = document.querySelector(".pieChart2");
  pie2.style.background = `conic-gradient(
    #007bff 0% ${malePercent}%,
    #ec1bb8 ${malePercent}% ${Number(malePercent) + Number(femalePercent)}%,
    #696969 ${Number(malePercent) + Number(femalePercent)}% 100%
  )`;

  const genderTexts = document.querySelectorAll('.pieChartCon:nth-of-type(3) .activeText');
  if (genderTexts.length >= 3) {
    genderTexts[0].textContent = `Male: ${maleCount} (${malePercent}%)`;
    genderTexts[1].textContent = `Female: ${femaleCount} (${femalePercent}%)`;
    genderTexts[2].textContent = `Others: ${otherCount} (${otherPercent}%)`;
  }

  const ageBars = document.querySelectorAll('.barChart .bars');

  function calculateAge(dob) {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const diff = Date.now() - birthDate.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  const ageGroups = [
    patients.filter(p => calculateAge(p.dob) >= 0 && calculateAge(p.dob) <= 18).length,
    patients.filter(p => calculateAge(p.dob) >= 19 && calculateAge(p.dob) <= 30).length,
    patients.filter(p => calculateAge(p.dob) >= 31 && calculateAge(p.dob) <= 50).length,
    patients.filter(p => calculateAge(p.dob) >= 51 && calculateAge(p.dob) <= 70).length,
    patients.filter(p => calculateAge(p.dob) > 70).length
  ];

  const ageMaxYValue = Math.max(...ageGroups, 10);
  const ageChartPixelHeight = 180;
  const agePixelPerUnit = ageChartPixelHeight / ageMaxYValue;

  if (ageBars.length >= 5) {
    ageBars.forEach((bar, i) => {
      const cappedAgeValue = Math.min(ageGroups[i], ageMaxYValue);
      bar.style.transition = "height 0.5s ease";
      bar.style.height = `${cappedAgeValue * agePixelPerUnit}px`;
    });
  }

  const ageTexts = document.querySelectorAll('.ageTextCon .ageText');
  const ageLabels = ['0-18', '19-30', '31-50', '51-70', '70+'];
  if (ageTexts.length >= 5) {
    ageTexts.forEach((text, i) => {
      text.textContent = `${ageLabels[i]} (${ageGroups[i]})`;
    });
  }
}

// ====== LOAD DOCTOR FILTER ======
async function loadDoctorFilter() {
  try {
    const res = await fetch("http://localhost:5000/api/users");
    const users = await res.json();
    const doctors = users.filter(u => u.role === "Doctor" && u.status === "Active");

    const select = document.getElementById("doctorFilter");
    doctors.forEach(doc => {
      const option = document.createElement("option");
      option.value = doc.userId;
      option.textContent = doc.name;
      select.appendChild(option);
    });

    const savedDateRange = sessionStorage.getItem("reportDateRange");
    const savedDoctor = sessionStorage.getItem("reportDoctor");

    if (savedDateRange) document.getElementById("dateRangeFilter").value = savedDateRange;
    if (savedDoctor) document.getElementById("doctorFilter").value = savedDoctor;
    if (savedDateRange || savedDoctor) applyFilters();
  } catch (err) {
    console.error("Error loading doctors:", err);
  }
}

// ====== APPLY FILTERS ======
function applyFilters() {
  const dateRangeSelect = document.getElementById("dateRangeFilter");
  const doctorSelect = document.getElementById("doctorFilter");
  const dateRange = parseInt(dateRangeSelect.value);
  const selectedDoctor = doctorSelect.value;

  sessionStorage.setItem("reportDateRange", dateRangeSelect.value);
  sessionStorage.setItem("reportDoctor", selectedDoctor);

  const now = new Date();
  let startDate = new Date();

  if (dateRange === 1) startDate.setHours(0, 0, 0, 0);
  else if (dateRange === 7) startDate.setDate(now.getDate() - 7);
  else if (dateRange === 30) startDate.setDate(now.getDate() - 30);
  else if (dateRange === 90) startDate.setDate(now.getDate() - 90);
  else if (dateRange === 365) startDate.setDate(now.getDate() - 365);
  else startDate = new Date(0);

  const filteredAppointments = allAppointments.filter(app => new Date(app.date) >= startDate);
  const filteredArchived = allArchivedAppointments.filter(app => new Date(app.date) >= startDate);

  let finalAppointments = filteredAppointments;
  let finalArchived = filteredArchived;

  if (selectedDoctor !== "all") {
    finalAppointments = filteredAppointments.filter(app => app.doctorId === selectedDoctor);
    finalArchived = filteredArchived.filter(app => app.doctorId === selectedDoctor);
  }

  const totalAppointments = [...finalAppointments, ...finalArchived].length;
  const completedAppointments = finalArchived.filter(a => a.status === "Completed").length;
  const upcomingAppointments = finalAppointments.filter(a => a.status === "Upcoming").length;
  const canceledAppointments = finalArchived.filter(a => a.status === "Canceled").length;

  let filteredPatients = allPatients;
  if (selectedDoctor !== "all") {
    const patientIdsSet = new Set();
    [...finalAppointments, ...finalArchived].forEach(app => {
      if (app.patientId) patientIdsSet.add(app.patientId);
    });
    filteredPatients = allPatients.filter(p => patientIdsSet.has(p.patientId));
  }

  const totalFilteredPatients = filteredPatients.length;
  const filteredActivePatients = filteredPatients.filter(p => p.status?.toLowerCase() === "active").length;
  const filteredInactivePatients = filteredPatients.filter(p => p.status?.toLowerCase() === "inactive").length;

  document.querySelector('.statusDisplay:nth-child(1) h1').textContent = totalFilteredPatients;
  document.querySelector('.statusDisplay:nth-child(2) h1').textContent = filteredActivePatients;
  document.querySelector('.statusDisplay:nth-child(3) h1').textContent = totalAppointments;
  document.querySelector('.statusDisplay:nth-child(4) h1').textContent = completedAppointments;

  updateCharts(filteredPatients, filteredActivePatients, filteredInactivePatients, upcomingAppointments, completedAppointments, canceledAppointments);
}

// ====== HELPER: GET FILTERED DATA ======
function getFilteredData() {
  const dateRangeSelect = document.getElementById("dateRangeFilter");
  const doctorSelect = document.getElementById("doctorFilter");
  const dateRangeValue = parseInt(dateRangeSelect.value);
  const selectedDoctor = doctorSelect.value;
  const dateRangeLabel = dateRangeSelect.selectedOptions[0].text;
  const doctorLabel = doctorSelect.selectedOptions[0].text;

  const now = new Date();
  let startDate = new Date();
  if (dateRangeValue === 1) startDate.setHours(0, 0, 0, 0);
  else if (dateRangeValue === 7) startDate.setDate(now.getDate() - 7);
  else if (dateRangeValue === 30) startDate.setDate(now.getDate() - 30);
  else if (dateRangeValue === 90) startDate.setDate(now.getDate() - 90);
  else if (dateRangeValue === 365) startDate.setDate(now.getDate() - 365);
  else startDate = new Date(0);

  let filteredAppointments = allAppointments.filter(a => new Date(a.date) >= startDate);
  let filteredArchived = allArchivedAppointments.filter(a => new Date(a.date) >= startDate);

  if (selectedDoctor !== "all") {
    filteredAppointments = filteredAppointments.filter(a => a.doctorId === selectedDoctor);
    filteredArchived = filteredArchived.filter(a => a.doctorId === selectedDoctor);
  }

  let filteredPatients = allPatients;
  if (selectedDoctor !== "all") {
    const pSet = new Set([...filteredAppointments, ...filteredArchived].map(a => a.patientId).filter(Boolean));
    filteredPatients = allPatients.filter(p => pSet.has(p.patientId));
  }

  function calcAge(dob) {
    if (!dob) return 0;
    return Math.abs(new Date(Date.now() - new Date(dob).getTime()).getUTCFullYear() - 1970);
  }

  const totalPats = filteredPatients.length;
  const activePats = filteredPatients.filter(p => p.status?.toLowerCase() === "active").length;
  const inactivePats = filteredPatients.filter(p => p.status?.toLowerCase() === "inactive").length;
  const totalAppts = [...filteredAppointments, ...filteredArchived].length;
  const completedAppts = filteredArchived.filter(a => a.status === "Completed").length;
  const upcomingAppts = filteredAppointments.filter(a => a.status === "Upcoming").length;
  const canceledAppts = filteredArchived.filter(a => a.status === "Canceled").length;
  const malePats = filteredPatients.filter(p => p.gender?.toLowerCase() === "male").length;
  const femalePats = filteredPatients.filter(p => p.gender?.toLowerCase() === "female").length;
  const otherPats = totalPats - malePats - femalePats;
  const ageGroups = [
    filteredPatients.filter(p => { const a = calcAge(p.dob); return a <= 18; }).length,
    filteredPatients.filter(p => { const a = calcAge(p.dob); return a >= 19 && a <= 30; }).length,
    filteredPatients.filter(p => { const a = calcAge(p.dob); return a >= 31 && a <= 50; }).length,
    filteredPatients.filter(p => { const a = calcAge(p.dob); return a >= 51 && a <= 70; }).length,
    filteredPatients.filter(p => calcAge(p.dob) > 70).length,
  ];

  return {
    dateRangeLabel, doctorLabel, selectedDoctor,
    totalPats, activePats, inactivePats,
    totalAppts, completedAppts, upcomingAppts, canceledAppts,
    malePats, femalePats, otherPats, ageGroups
  };
}

// ====== SHOW PRINT PREVIEW ======
function showPrintPreview() {
  const d = getFilteredData();

  const ap = d.totalPats ? (d.activePats   / d.totalPats * 100).toFixed(1) : "0.0";
  const ip = d.totalPats ? (d.inactivePats / d.totalPats * 100).toFixed(1) : "0.0";
  const mp = d.totalPats ? (d.malePats     / d.totalPats * 100).toFixed(1) : "0.0";
  const fp = d.totalPats ? (d.femalePats   / d.totalPats * 100).toFixed(1) : "0.0";
  const op = d.totalPats ? (d.otherPats    / d.totalPats * 100).toFixed(1) : "0.0";

  const totalApptSafe = d.totalAppts || 1;
  const upPct   = (d.upcomingAppts  / totalApptSafe * 100).toFixed(1);
  const donePct = (d.completedAppts / totalApptSafe * 100).toFixed(1);
  const canPct  = (d.canceledAppts  / totalApptSafe * 100).toFixed(1);

  const totalAge = d.ageGroups.reduce((a, b) => a + b, 0) || 1;
  const ageLabels = ['0–18 years', '19–30 years', '31–50 years', '51–70 years', '70+ years'];

  const existingModal = document.getElementById('printPreviewModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'printPreviewModal';
  modal.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;
    display:flex;flex-direction:column;
    font-family:'Plus Jakarta Sans',sans-serif;
  `;

  const tblStyle = `width:100%;border-collapse:collapse;font-size:11px;margin-bottom:0;`;
  const thStyle  = `background:#065f46;color:white;padding:7px 10px;text-align:left;font-weight:700;font-size:10.5px;letter-spacing:0.4px;`;
  const tdStyle  = `padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#374151;`;
  const tdR      = `padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:right;font-weight:700;`;
  const trEven   = `background:#f9fafb;`;

  const card = (title, icon, content) => `
    <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:14px;">
      <div style="background:#f0fdf4;padding:9px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #d1fae5;">
        <span style="font-size:15px;">${icon}</span>
        <span style="font-size:12px;font-weight:900;color:#065f46;letter-spacing:-0.2px;">${title}</span>
      </div>
      <div>${content}</div>
    </div>`;

  const barCell = (val, max, color) => {
    const pct = max > 0 ? Math.min((val / max) * 100, 100).toFixed(1) : 0;
    return `
      <td style="${tdStyle}width:120px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:8px;background:#f0f4f0;border-radius:4px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;"></div>
          </div>
          <span style="font-size:10px;font-weight:700;color:#555;min-width:26px;">${pct}%</span>
        </div>
      </td>`;
  };

  modal.innerHTML = `
    <div style="background:#065f46;color:white;padding:11px 22px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;box-shadow:0 2px 10px rgba(0,0,0,0.28);">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:19px;">🖨️</span>
        <div>
          <div style="font-weight:900;font-size:14px;letter-spacing:-0.2px;">Print Preview</div>
          <div style="font-size:10px;opacity:0.65;">WellServed Report &amp; Analytics</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <div style="font-size:10.5px;opacity:0.65;background:rgba(255,255,255,0.1);padding:5px 12px;border-radius:20px;margin-right:4px;">
          📅 ${d.dateRangeLabel} &nbsp;·&nbsp; 👨‍⚕️ ${d.doctorLabel}
        </div>
        <button onclick="closePrintPreview()"
          style="padding:6px 16px;border-radius:7px;border:1.5px solid rgba(255,255,255,0.4);background:transparent;color:white;font-weight:700;cursor:pointer;font-size:12px;"
          onmouseover="this.style.background='rgba(255,255,255,0.12)'"
          onmouseout="this.style.background='transparent'">✕ Close</button>
        <button onclick="saveReportAsPDF(); setTimeout(closePrintPreview, 150);"
          style="padding:6px 20px;border-radius:7px;border:none;background:#10b981;color:white;font-weight:900;cursor:pointer;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.15);"
          onmouseover="this.style.opacity='0.88'"
          onmouseout="this.style.opacity='1'">💾 Save as PDF</button>
        <button onclick="closePrintPreview(); setTimeout(() => downloadReport(), 150);"
          style="padding:6px 20px;border-radius:7px;border:none;background:white;color:#065f46;font-weight:900;cursor:pointer;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.15);"
          onmouseover="this.style.opacity='0.88'"
          onmouseout="this.style.opacity='1'">🖨️ Print</button>
      </div>
    </div>

    <div id="previewScrollArea"
      style="flex:1;overflow-y:auto;overflow-x:auto;background:#3c3f41;display:flex;justify-content:center;align-items:flex-start;padding:28px 20px;">
      <div style="flex-shrink:0;width:572px;">
        <div id="previewDocument"
          style="width:794px;transform:scale(0.72);transform-origin:top left;background:white;
                 padding:38px 42px 32px;border-radius:3px;
                 box-shadow:0 6px 28px rgba(0,0,0,0.45);
                 font-family:'Plus Jakarta Sans',sans-serif;">

          <div style="text-align:center;border-bottom:2.5px solid #065f46;padding-bottom:16px;margin-bottom:20px;">
            <div style="font-size:9.5px;color:#bbb;margin-bottom:5px;letter-spacing:0.5px;">
              Generated: ${new Date().toLocaleString('en-PH', { dateStyle:'long', timeStyle:'short' })}
            </div>
            <h1 style="font-size:24px;font-weight:900;color:#065f46;margin:0 0 4px;letter-spacing:-0.5px;">
              Report &amp; Analytics
            </h1>
            <p style="font-size:11.5px;color:#999;margin:0 0 12px;">
              Reviewing clinical performance and patient statistics
            </p>
            <div style="display:inline-flex;align-items:center;gap:5px;padding:5px 16px;
                        background:#f0fdf4;border-radius:20px;border:1px solid #a7f3d0;
                        font-size:10.5px;color:#065f46;font-weight:700;">
              <span>📅</span> ${d.dateRangeLabel}
              <span style="opacity:0.35;margin:0 4px;">|</span>
              <span>👨‍⚕️</span> ${d.doctorLabel}
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
            ${[
              { label:'Total Patients',     val:d.totalPats,      icon:'👥', col:'#8B5A2B', bg:'#fdf7f0' },
              { label:'Active Patients',    val:d.activePats,     icon:'🧑', col:'#065f46', bg:'#f0fdf4' },
              { label:'Total Appointments', val:d.totalAppts,     icon:'📅', col:'#8B5A2B', bg:'#fdf7f0' },
              { label:'Completed',          val:d.completedAppts, icon:'✅', col:'#065f46', bg:'#f0fdf4' },
            ].map(s => `
              <div style="border-radius:9px;border:1px solid #e5e7eb;border-top:3px solid ${s.col};
                          padding:12px 10px;text-align:center;background:${s.bg};">
                <div style="font-size:16px;margin-bottom:4px;">${s.icon}</div>
                <div style="font-size:8px;font-weight:900;text-transform:uppercase;color:${s.col};
                            letter-spacing:0.6px;margin-bottom:6px;">${s.label}</div>
                <div style="font-size:26px;font-weight:900;color:${s.col};line-height:1;">${s.val}</div>
              </div>`).join('')}
          </div>

          ${card('Patient Summary', '🏥', `
            <table style="${tblStyle}">
              <thead>
                <tr>
                  <th style="${thStyle}">Category</th>
                  <th style="${thStyle}text-align:right;">Count</th>
                  <th style="${thStyle}text-align:right;">Percentage</th>
                  <th style="${thStyle}width:140px;">Distribution</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="${tdStyle}font-weight:700;">Total Patients</td>
                  <td style="${tdR}">${d.totalPats}</td>
                  <td style="${tdR}">100%</td>
                  ${barCell(d.totalPats, d.totalPats, '#065f46')}
                </tr>
                <tr style="${trEven}">
                  <td style="${tdStyle}padding-left:20px;">↳ Active</td>
                  <td style="${tdR}">${d.activePats}</td>
                  <td style="${tdR}">${ap}%</td>
                  ${barCell(d.activePats, d.totalPats, '#289b3b')}
                </tr>
                <tr>
                  <td style="${tdStyle}padding-left:20px;">↳ Inactive</td>
                  <td style="${tdR}">${d.inactivePats}</td>
                  <td style="${tdR}">${ip}%</td>
                  ${barCell(d.inactivePats, d.totalPats, '#696969')}
                </tr>
              </tbody>
            </table>
          `)}

          ${card('Appointment Breakdown', '📋', `
            <table style="${tblStyle}">
              <thead>
                <tr>
                  <th style="${thStyle}">Status</th>
                  <th style="${thStyle}text-align:center;">Count</th>
                  <th style="${thStyle}text-align:center;">% of Total</th>
                  <th style="${thStyle}width:140px;">Distribution</th>
                  <th style="${thStyle}text-align:center;">Indicator</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="${tdStyle}font-weight:700;">Total Appointments</td>
                  <td style="${tdR}text-align:center;">${d.totalAppts}</td>
                  <td style="${tdR}text-align:center;">100%</td>
                  ${barCell(d.totalAppts, d.totalAppts, '#065f46')}
                  <td style="${tdStyle}text-align:center;">—</td>
                </tr>
                <tr style="${trEven}">
                  <td style="${tdStyle}padding-left:20px;">↳ Upcoming</td>
                  <td style="${tdR}text-align:center;">${d.upcomingAppts}</td>
                  <td style="${tdR}text-align:center;">${upPct}%</td>
                  ${barCell(d.upcomingAppts, d.totalAppts, '#065f46')}
                  <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">
                    <span style="background:#dbeafe;color:#1d4ed8;font-size:9px;font-weight:800;padding:2px 8px;border-radius:10px;">PENDING</span>
                  </td>
                </tr>
                <tr>
                  <td style="${tdStyle}padding-left:20px;">↳ Completed</td>
                  <td style="${tdR}text-align:center;">${d.completedAppts}</td>
                  <td style="${tdR}text-align:center;">${donePct}%</td>
                  ${barCell(d.completedAppts, d.totalAppts, '#16a34a')}
                  <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">
                    <span style="background:#dcfce7;color:#15803d;font-size:9px;font-weight:800;padding:2px 8px;border-radius:10px;">DONE</span>
                  </td>
                </tr>
                <tr style="${trEven}">
                  <td style="${tdStyle}padding-left:20px;">↳ Canceled</td>
                  <td style="${tdR}text-align:center;">${d.canceledAppts}</td>
                  <td style="${tdR}text-align:center;">${canPct}%</td>
                  ${barCell(d.canceledAppts, d.totalAppts, '#ef4444')}
                  <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">
                    <span style="background:#fee2e2;color:#b91c1c;font-size:9px;font-weight:800;padding:2px 8px;border-radius:10px;">CANCELED</span>
                  </td>
                </tr>
              </tbody>
            </table>
          `)}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
            <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              <div style="background:#f0fdf4;padding:9px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #d1fae5;">
                <span style="font-size:15px;">🥧</span>
                <span style="font-size:12px;font-weight:900;color:#065f46;">Gender Distribution</span>
              </div>
              <table style="${tblStyle}">
                <thead>
                  <tr>
                    <th style="${thStyle}">Gender</th>
                    <th style="${thStyle}text-align:right;">Count</th>
                    <th style="${thStyle}text-align:right;">%</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="${tdStyle}">
                      <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#007bff;margin-right:6px;vertical-align:middle;"></span>Male
                    </td>
                    <td style="${tdR}">${d.malePats}</td>
                    <td style="${tdR}">${mp}%</td>
                  </tr>
                  <tr style="${trEven}">
                    <td style="${tdStyle}">
                      <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ec1bb8;margin-right:6px;vertical-align:middle;"></span>Female
                    </td>
                    <td style="${tdR}">${d.femalePats}</td>
                    <td style="${tdR}">${fp}%</td>
                  </tr>
                  <tr>
                    <td style="${tdStyle}">
                      <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#696969;margin-right:6px;vertical-align:middle;"></span>Others
                    </td>
                    <td style="${tdR}">${d.otherPats}</td>
                    <td style="${tdR}">${op}%</td>
                  </tr>
                  <tr style="background:#f0fdf4;">
                    <td style="${tdStyle}font-weight:800;">Total</td>
                    <td style="${tdR}color:#065f46;">${d.totalPats}</td>
                    <td style="${tdR}color:#065f46;">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              <div style="background:#f0fdf4;padding:9px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #d1fae5;">
                <span style="font-size:15px;">📈</span>
                <span style="font-size:12px;font-weight:900;color:#065f46;">Age Demographics</span>
              </div>
              <table style="${tblStyle}">
                <thead>
                  <tr>
                    <th style="${thStyle}">Age Group</th>
                    <th style="${thStyle}text-align:right;">Patients</th>
                    <th style="${thStyle}text-align:right;">%</th>
                  </tr>
                </thead>
                <tbody>
                  ${d.ageGroups.map((count, i) => {
                    const pct = (count / totalAge * 100).toFixed(1);
                    return `
                    <tr style="${i % 2 === 1 ? trEven : ''}">
                      <td style="${tdStyle}">${ageLabels[i]}</td>
                      <td style="${tdR}">${count}</td>
                      <td style="${tdR}">${pct}%</td>
                    </tr>`;
                  }).join('')}
                  <tr style="background:#f0fdf4;">
                    <td style="${tdStyle}font-weight:800;">Total</td>
                    <td style="${tdR}color:#065f46;">${d.ageGroups.reduce((a,b)=>a+b,0)}</td>
                    <td style="${tdR}color:#065f46;">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          ${card('Overall Summary', '📊', `
            <table style="${tblStyle}">
              <thead>
                <tr>
                  <th style="${thStyle}">Metric</th>
                  <th style="${thStyle}text-align:center;">Value</th>
                  <th style="${thStyle}">Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="${tdStyle}font-weight:700;">Patient Count</td>
                  <td style="${tdR}text-align:center;font-size:13px;color:#065f46;">${d.totalPats}</td>
                  <td style="${tdStyle}font-size:10px;color:#6b7280;">Active: ${d.activePats} (${ap}%) · Inactive: ${d.inactivePats} (${ip}%)</td>
                </tr>
                <tr style="${trEven}">
                  <td style="${tdStyle}font-weight:700;">Appointment Count</td>
                  <td style="${tdR}text-align:center;font-size:13px;color:#065f46;">${d.totalAppts}</td>
                  <td style="${tdStyle}font-size:10px;color:#6b7280;">Completed: ${d.completedAppts} · Upcoming: ${d.upcomingAppts} · Canceled: ${d.canceledAppts}</td>
                </tr>
                <tr>
                  <td style="${tdStyle}font-weight:700;">Completion Rate</td>
                  <td style="${tdR}text-align:center;font-size:13px;color:#065f46;">${donePct}%</td>
                  <td style="${tdStyle}font-size:10px;color:#6b7280;">${d.completedAppts} completed out of ${d.totalAppts} total appointments</td>
                </tr>
                <tr style="${trEven}">
                  <td style="${tdStyle}font-weight:700;">Cancellation Rate</td>
                  <td style="${tdR}text-align:center;font-size:13px;color:${parseFloat(canPct) > 20 ? '#dc2626' : '#065f46'};">${canPct}%</td>
                  <td style="${tdStyle}font-size:10px;color:#6b7280;">${d.canceledAppts} canceled out of ${d.totalAppts} total appointments</td>
                </tr>
                <tr>
                  <td style="${tdStyle}font-weight:700;">Gender Breakdown</td>
                  <td style="${tdR}text-align:center;font-size:13px;color:#065f46;">${d.totalPats}</td>
                  <td style="${tdStyle}font-size:10px;color:#6b7280;">Male: ${d.malePats} (${mp}%) · Female: ${d.femalePats} (${fp}%) · Others: ${d.otherPats} (${op}%)</td>
                </tr>
                <tr style="${trEven}">
                  <td style="${tdStyle}font-weight:700;">Largest Age Group</td>
                  <td style="${tdR}text-align:center;font-size:13px;color:#065f46;">${Math.max(...d.ageGroups)}</td>
                  <td style="${tdStyle}font-size:10px;color:#6b7280;">${ageLabels[d.ageGroups.indexOf(Math.max(...d.ageGroups))]} has the most patients</td>
                </tr>
              </tbody>
            </table>
          `)}

          <div style="border-top:1px solid #eee;padding-top:10px;text-align:center;">
            <p style="font-size:9.5px;color:#ccc;margin:0;letter-spacing:0.3px;">
              WellServed © ${new Date().getFullYear()} – Confidential Healthcare Report
            </p>
          </div>

        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    const doc = document.getElementById('previewDocument');
    const wrapper = doc?.parentElement;
    if (doc && wrapper) {
      wrapper.style.height = (doc.offsetHeight * 0.72) + 'px';
    }
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) closePrintPreview();
  });
}

// ====== CLOSE PRINT PREVIEW ======
function closePrintPreview() {
  const modal = document.getElementById('printPreviewModal');
  if (modal) modal.remove();
  document.body.style.overflow = '';
}

// ====== SAVE REPORT AS PDF ======
function saveReportAsPDF() {
  const dateRange = document.getElementById("dateRangeFilter").selectedOptions[0].text;
  const doctor = document.getElementById("doctorFilter").selectedOptions[0].text;
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const filename = `WellServed_Report_${dateStr}.pdf`;

  const previewDocument = document.getElementById('previewDocument');
  if (!previewDocument) {
    alert('Error: Could not find report document to save.');
    return;
  }

  const element = previewDocument.cloneNode(true);
  element.style.transform = 'scale(1)';
  element.style.width = '794px';

  const opt = {
    margin: [10, 10, 10, 10],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, logging: false },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  html2pdf().set(opt).from(element).save();
}

// ====== EXECUTE PRINT ======
function executePrint() {
  closePrintPreview();
  setTimeout(() => downloadReport(), 150);
}

// ====== DOWNLOAD / PRINT REPORT ======
function downloadReport() {
  const dateRange = document.getElementById("dateRangeFilter").selectedOptions[0].text;
  const doctor = document.getElementById("doctorFilter").selectedOptions[0].text;

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const filename = `WellServed_Report_${dateStr}.pdf`;

  const originalTitle = document.title;
  document.title = filename.replace('.pdf', '');

  const filterInfo = document.createElement('div');
  filterInfo.id = 'print-filter-info';
  filterInfo.style.display = 'none';
  filterInfo.innerHTML = `
    <div style="text-align:center;margin-bottom:20px;padding:15px;background:#f0fdf4;border-radius:8px;border:2px solid #065f46;">
      <p style="margin:0;font-size:14px;color:#333;">
        <strong>Filters Applied:</strong> Date Range: <span style="color:#065f46;">${dateRange}</span> |
        Doctor: <span style="color:#065f46;">${doctor}</span>
      </p>
    </div>`;

  const mainContent = document.querySelector('.mainContent');
  const topSection = mainContent.querySelector('.top');
  if (topSection && topSection.nextSibling) {
    mainContent.insertBefore(filterInfo, topSection.nextSibling);
  } else {
    mainContent.appendChild(filterInfo);
  }

  const d = getFilteredData();

  const appointmentSummary = document.createElement('div');
  appointmentSummary.id = 'appointment-text-summary';
  appointmentSummary.style.cssText = 'display:none;';
  appointmentSummary.innerHTML = `
    <div style="text-align:center;padding:15px;background:#f0fdf4;border-radius:6px;margin:10px 0;font-size:13px;line-height:1.8;color:#065f46;font-weight:600;">
      Upcoming: ${d.upcomingAppts}<br>Completed: ${d.completedAppts}<br>Canceled: ${d.canceledAppts}
    </div>`;

  const ageSummary = document.createElement('div');
  ageSummary.id = 'age-text-summary';
  ageSummary.style.cssText = 'display:none;';
  ageSummary.innerHTML = `
    <div style="text-align:center;padding:15px;background:#f0fdf4;border-radius:6px;margin:10px 0;font-size:13px;line-height:1.8;color:#065f46;font-weight:600;">
      0-18 years: ${d.ageGroups[0]} patients<br>
      19-30 years: ${d.ageGroups[1]} patients<br>
      31-50 years: ${d.ageGroups[2]} patients<br>
      51-70 years: ${d.ageGroups[3]} patients<br>
      70+ years: ${d.ageGroups[4]} patients
    </div>`;

  const appointmentStatusChart = document.querySelector('.bottom .chart-container:nth-child(1)');
  const ageDemographicsChart   = document.querySelector('.bottom .chart-container:nth-child(4)');
  if (appointmentStatusChart) appointmentStatusChart.appendChild(appointmentSummary);
  if (ageDemographicsChart)   ageDemographicsChart.appendChild(ageSummary);

  const printStyles = document.createElement('style');
  printStyles.id = 'print-styles';
  printStyles.innerHTML = `
    @media print {
      body { margin:0;padding:0;background:white !important; }
      body * { visibility:hidden; }
      .mainContent, .mainContent * { visibility:visible; }
      .mainContent { position:absolute;left:0;top:0;width:100%;max-width:100%;padding:20px;margin:0;background:white; }
      aside, nav, .sidebar, header, footer, #notificationDropdown { display:none !important; }
      main { margin:0 !important;padding:0 !important;width:100% !important; }
      #print-filter-info { display:block !important;visibility:visible !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin-bottom:12px !important; }
      #print-filter-info div { padding:10px !important;margin-bottom:12px !important; }
      #print-filter-info p { font-size:12px !important;margin:0 !important; }
      .top { page-break-after:avoid;margin-bottom:12px !important;text-align:center; }
      .topSec { display:flex;flex-direction:column;align-items:center;margin-bottom:12px !important;border-bottom:2px solid #065f46;padding-bottom:10px !important; }
      .title { font-size:22px !important;color:#065f46 !important;margin-bottom:6px !important; }
      .topSec p { font-size:11px !important;margin:0 !important; }
      .addBtn, .filterCon { display:none !important; }
      .middle { page-break-inside:avoid;margin-bottom:15px;display:grid !important;grid-template-columns:repeat(4,1fr) !important;gap:10px !important;-webkit-print-color-adjust:exact;print-color-adjust:exact; }
      .statusDisplay { page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;border-radius:6px;padding:10px !important;box-shadow:0 1px 3px rgba(0,0,0,0.1);border:1px solid #e5e7eb;background:white !important; }
      .statusDisplay h3 { font-size:9px !important;margin-bottom:6px !important; }
      .statusDisplay h1 { font-size:22px !important; }
      .statusDisplay .material-symbols-outlined { font-size:18px !important; }
      .statusDisplay .p-3 { padding:8px !important; }
      .bottom { page-break-inside:avoid;display:grid !important;grid-template-columns:1fr 1fr !important;gap:10px !important;width:100%;margin-top:15px; }
      .chart-container, .pieChartCon { page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:10px !important;border:1px solid #ddd;border-radius:6px;background:white !important;width:100%;min-height:0 !important; }
      .chart-container h2, .pieChartCon h2 { color:#065f46 !important;font-size:12px !important;margin-bottom:8px !important;text-align:center; }
      .pieChart1, .pieChart2, .barChart, .y-axis, .chart { display:none !important; }
      #appointment-text-summary, #age-text-summary { display:block !important;visibility:visible !important; }
      #appointment-text-summary div, #age-text-summary div { display:block !important;visibility:visible !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:10px !important;margin:5px 0 !important;font-size:11px !important;line-height:1.5 !important; }
      .pieChartCon .flex.flex-col, .pieChartCon .flex.items-center { display:flex !important;visibility:visible !important; }
      .activeText { font-size:11px !important;font-weight:600 !important; }
      .box1, .box2, .box3 { width:10px !important;height:10px !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;flex-shrink:0 !important; }
      .pieChartCon .flex.items-center { padding:5px 8px !important;margin-bottom:4px !important; }
      .pieChartCon .flex.flex-col.md\\:flex-row { flex-direction:column !important;align-items:stretch !important;gap:4px !important; }
      .ageTextCon { display:flex !important;justify-content:space-around !important;margin-top:10px !important;padding:8px !important;background:#f8fafc !important;border-radius:4px !important; }
      .ageText { font-size:10px !important;font-weight:600 !important;color:#065f46 !important; }
      @page { size:A4 portrait;margin:1.5cm; }
      .top::before { content:"Generated: ${new Date().toLocaleString()}";display:block;text-align:center;font-size:9px;color:#666;margin-bottom:8px; }
      .mainContent::after { content:"WellServed © ${new Date().getFullYear()} - Confidential Healthcare Report";display:block;text-align:center;margin-top:15px;padding-top:8px;border-top:1px solid #ddd;font-size:9px;color:#888;page-break-before:avoid; }
    }`;

  document.head.appendChild(printStyles);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
      document.getElementById('print-styles')?.remove();
      document.getElementById('print-filter-info')?.remove();
      document.getElementById('appointment-text-summary')?.remove();
      document.getElementById('age-text-summary')?.remove();
    }, 1000);
  }, 100);
}

// ====== INITIALIZATION ======
document.addEventListener("DOMContentLoaded", () => {
  loadDoctorFilter();
  document.getElementById("dateRangeFilter").addEventListener("change", applyFilters);
  document.getElementById("doctorFilter").addEventListener("change", applyFilters);
  document.getElementById("dateRangeFilter").addEventListener("change", handleDateRangeChange);
  document.getElementById("customStartDate").addEventListener("change", applyFilters);
  document.getElementById("customEndDate").addEventListener("change", applyFilters);
});

function handleDateRangeChange() {
  const rangeValue = document.getElementById("dateRangeFilter").value;
  const customContainer = document.getElementById("customDateContainer");
  if (rangeValue === "custom") {
    customContainer.style.display = "block";
  } else {
    customContainer.style.display = "none";
    applyFilters();
  }
}

window.onload = loadReportStats;