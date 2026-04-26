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

    // Check if filters are active
    const savedDateRange = sessionStorage.getItem("reportDateRange");
    const savedDoctor = sessionStorage.getItem("reportDoctor");
    const hasActiveFilters = savedDateRange || savedDoctor;

    // If filters are active, just apply them (they'll update everything)
    if (hasActiveFilters) {
      applyFilters();
      return; // Don't update displays below
    }

    // Only update if no filters are active
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
  // Appointment Status Bar Chart
  const bars = document.querySelectorAll('.barChart .bar');
  const values = [up, done, cancel];
  
  // ✅ Calculate dynamic max value based on actual data
  const maxDataValue = Math.max(...values, 10); // Use at least 10 as minimum scale
  const chartPixelHeight = 180;
  const pixelPerUnit = chartPixelHeight / maxDataValue;

  if (bars.length >= 3) {
    bars.forEach((bar, i) => {
      const newHeight = values[i] * pixelPerUnit;
      bar.style.transition = "height 0.5s ease";
      bar.style.height = `${newHeight}px`;
    });
    
    // ✅ Update labels with actual counts
    const barLabels = bars[0].parentElement.parentElement.querySelectorAll('span');
    if (barLabels.length >= 3) {
      barLabels[0].textContent = `Upcoming (${up})`;
      barLabels[1].textContent = `Completed (${done})`;
      barLabels[2].textContent = `Canceled (${cancel})`;
    }
  }
  
  // ✅ Update Y-axis labels dynamically
  const yAxisContainer = document.querySelector('.bottom .chart-container:nth-child(1) .y-axis');
  if (yAxisContainer) {
    const step = Math.ceil(maxDataValue / 5);
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

  // Active vs Inactive Pie Chart
  const totalPatients = active + inactive;
  const activePercent = totalPatients ? (active / totalPatients * 100).toFixed(1) : 0;
  const inactivePercent = totalPatients ? (inactive / totalPatients * 100).toFixed(1) : 0;

  const pie1 = document.querySelector(".pieChart1");
  pie1.style.background = `conic-gradient(#289b3b 0% ${activePercent}%, #696969 ${activePercent}% 100%)`;

  // ✅ Update center text for Patient Status donut
  const activePercentageEl = document.getElementById("activePatientPercentage");
  if (activePercentageEl) {
    activePercentageEl.textContent = `${Math.round(activePercent)}%`;
  }

  document.querySelectorAll('.activeText')[0].textContent = `Active: ${active} (${activePercent}%)`;
  document.querySelectorAll('.activeText')[1].textContent = `Inactive: ${inactive} (${inactivePercent}%)`;

  // Gender Distribution Pie Chart
  const maleCount = patients.filter(p => p.gender?.toLowerCase() === "male").length;
  const femaleCount = patients.filter(p => p.gender?.toLowerCase() === "female").length;
  const otherCount = patients.length - maleCount - femaleCount;
  const totalGender = maleCount + femaleCount + otherCount;

  // ✅ Update center text for Gender Distribution donut
  const totalPatientsCountEl = document.getElementById("totalPatientsCount");
  if (totalPatientsCountEl) {
    totalPatientsCountEl.textContent = totalGender;
  }

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

  // Age Demographics Bar Chart
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
      const newHeight = cappedAgeValue * agePixelPerUnit;
      bar.style.transition = "height 0.5s ease";
      bar.style.height = `${newHeight}px`;
    });
  }

  // ✅ Update age labels with patient counts
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

    // Restore saved filter values
    const savedDateRange = sessionStorage.getItem("reportDateRange");
    const savedDoctor = sessionStorage.getItem("reportDoctor");

    if (savedDateRange) {
      document.getElementById("dateRangeFilter").value = savedDateRange;
    }
    if (savedDoctor) {
      document.getElementById("doctorFilter").value = savedDoctor;
    }

    // Apply filters if they were previously set
    if (savedDateRange || savedDoctor) {
      applyFilters();
    }
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
  
  // Save filter values to sessionStorage
  sessionStorage.setItem("reportDateRange", dateRangeSelect.value);
  sessionStorage.setItem("reportDoctor", selectedDoctor);
  
  const now = new Date();
  let startDate = new Date();
  
  if (dateRange === 1) {
    startDate.setHours(0, 0, 0, 0);
  } else if (dateRange === 7) {
    startDate.setDate(now.getDate() - 7);
  } else if (dateRange === 30) {
    startDate.setDate(now.getDate() - 30);
  } else if (dateRange === 90) {
    startDate.setDate(now.getDate() - 90);
  } else if (dateRange === 365) {
    startDate.setDate(now.getDate() - 365);
  } else {
    startDate = new Date(0);
  }
  
  // Filter appointments by date
  const filteredAppointments = allAppointments.filter(app => {
    const appDate = new Date(app.date);
    return appDate >= startDate;
  });
  
  const filteredArchived = allArchivedAppointments.filter(app => {
    const appDate = new Date(app.date);
    return appDate >= startDate;
  });
  
  let finalAppointments = filteredAppointments;
  let finalArchived = filteredArchived;
  
  // Filter by doctor if selected
  if (selectedDoctor !== "all") {
    finalAppointments = filteredAppointments.filter(app => app.doctorId === selectedDoctor);
    finalArchived = filteredArchived.filter(app => app.doctorId === selectedDoctor);
  }
  
  // Calculate appointment stats
  const totalAppointments = [...finalAppointments, ...finalArchived].length;
  const completedAppointments = finalArchived.filter(a => a.status === "Completed").length;
  const upcomingAppointments = finalAppointments.filter(a => a.status === "Upcoming").length;
  const canceledAppointments = finalArchived.filter(a => a.status === "Canceled").length;
  
  // Filter patients based on doctor selection
  let filteredPatients = allPatients;
  
  if (selectedDoctor !== "all") {
    const patientIdsSet = new Set();
    [...finalAppointments, ...finalArchived].forEach(app => {
      if (app.patientId) {
        patientIdsSet.add(app.patientId);
      }
    });
    filteredPatients = allPatients.filter(p => patientIdsSet.has(p.patientId));
  }
  
  // Calculate patient stats
  const totalFilteredPatients = filteredPatients.length;
  const filteredActivePatients = filteredPatients.filter(p => p.status?.toLowerCase() === "active").length;
  const filteredInactivePatients = filteredPatients.filter(p => p.status?.toLowerCase() === "inactive").length;
  
  // Update status displays
  document.querySelector('.statusDisplay:nth-child(1) h1').textContent = totalFilteredPatients;
  document.querySelector('.statusDisplay:nth-child(2) h1').textContent = filteredActivePatients;
  document.querySelector('.statusDisplay:nth-child(3) h1').textContent = totalAppointments;
  document.querySelector('.statusDisplay:nth-child(4) h1').textContent = completedAppointments;
  
  // Update charts with filtered data
  updateCharts(
    filteredPatients, 
    filteredActivePatients,
    filteredInactivePatients,
    upcomingAppointments, 
    completedAppointments, 
    canceledAppointments
  );
}

// ====== DOWNLOAD REPORT ======
function downloadReport() {
  const dateRange = document.getElementById("dateRangeFilter").selectedOptions[0].text;
  const doctor = document.getElementById("doctorFilter").selectedOptions[0].text;
  
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const filename = `WellServed_Report_${dateStr}.pdf`;
  
  const originalTitle = document.title;
  document.title = filename.replace('.pdf', '');
  
  // Create filter info banner
  const filterInfo = document.createElement('div');
  filterInfo.id = 'print-filter-info';
  filterInfo.style.display = 'none';
  filterInfo.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px; border: 2px solid #065f46;">
      <p style="margin: 0; font-size: 14px; color: #333;">
        <strong>Filters Applied:</strong> Date Range: <span style="color: #065f46;">${dateRange}</span> | 
        Doctor: <span style="color: #065f46;">${doctor}</span>
      </p>
    </div>
  `;
  
  const mainContent = document.querySelector('.mainContent');
  const topSection = mainContent.querySelector('.top');
  if (topSection && topSection.nextSibling) {
    mainContent.insertBefore(filterInfo, topSection.nextSibling);
  } else {
    mainContent.appendChild(filterInfo);
  }
  
  // ✅ Extract current data from charts for text display
  const appointmentStatusChart = document.querySelector('.bottom .chart-container:nth-child(1)');
  const ageDemographicsChart = document.querySelector('.bottom .chart-container:nth-child(4)');
  
  // ✅ Calculate actual appointment counts from current filtered data
  const dateRangeSelect = document.getElementById("dateRangeFilter");
  const doctorSelect = document.getElementById("doctorFilter");
  const dateRangeValue = parseInt(dateRangeSelect.value);
  const selectedDoctor = doctorSelect.value;
  
  const now = new Date();
  let startDate = new Date();
  
  if (dateRangeValue === 1) {
    startDate.setHours(0, 0, 0, 0);
  } else if (dateRangeValue === 7) {
    startDate.setDate(now.getDate() - 7);
  } else if (dateRangeValue === 30) {
    startDate.setDate(now.getDate() - 30);
  } else if (dateRangeValue === 90) {
    startDate.setDate(now.getDate() - 90);
  } else if (dateRangeValue === 365) {
    startDate.setDate(now.getDate() - 365);
  } else {
    startDate = new Date(0);
  }
  
  // Filter appointments by date
  let filteredAppointments = allAppointments.filter(app => {
    const appDate = new Date(app.date);
    return appDate >= startDate;
  });
  
  let filteredArchived = allArchivedAppointments.filter(app => {
    const appDate = new Date(app.date);
    return appDate >= startDate;
  });
  
  // Filter by doctor if selected
  if (selectedDoctor !== "all") {
    filteredAppointments = filteredAppointments.filter(app => app.doctorId === selectedDoctor);
    filteredArchived = filteredArchived.filter(app => app.doctorId === selectedDoctor);
  }
  
  // ✅ Calculate actual counts
  const upcomingCount = filteredAppointments.filter(a => a.status === "Upcoming").length;
  const completedCount = filteredArchived.filter(a => a.status === "Completed").length;
  const canceledCount = filteredArchived.filter(a => a.status === "Canceled").length;
  
  // ✅ Calculate age demographics from filtered patients
  let filteredPatients = allPatients;
  
  if (selectedDoctor !== "all") {
    const patientIdsSet = new Set();
    [...filteredAppointments, ...filteredArchived].forEach(app => {
      if (app.patientId) {
        patientIdsSet.add(app.patientId);
      }
    });
    filteredPatients = allPatients.filter(p => patientIdsSet.has(p.patientId));
  }
  
  function calculateAge(dob) {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const diff = Date.now() - birthDate.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }
  
  const ageGroup0_18 = filteredPatients.filter(p => calculateAge(p.dob) >= 0 && calculateAge(p.dob) <= 18).length;
  const ageGroup19_30 = filteredPatients.filter(p => calculateAge(p.dob) >= 19 && calculateAge(p.dob) <= 30).length;
  const ageGroup31_50 = filteredPatients.filter(p => calculateAge(p.dob) >= 31 && calculateAge(p.dob) <= 50).length;
  const ageGroup51_70 = filteredPatients.filter(p => calculateAge(p.dob) >= 51 && calculateAge(p.dob) <= 70).length;
  const ageGroup70Plus = filteredPatients.filter(p => calculateAge(p.dob) > 70).length;
  
  // Add text summaries directly to chart containers
  const appointmentSummary = document.createElement('div');
  appointmentSummary.id = 'appointment-text-summary';
  appointmentSummary.style.cssText = 'display: none;';
  appointmentSummary.innerHTML = `
    <div style="text-align: center; padding: 15px; background: #f0fdf4; border-radius: 6px; margin: 10px 0; font-size: 13px; line-height: 1.8; color: #065f46; font-weight: 600;">
      Upcoming: ${upcomingCount}<br> 
      Completed: ${completedCount}<br> 
      Canceled: ${canceledCount}
    </div>
  `;
  
  const ageSummary = document.createElement('div');
  ageSummary.id = 'age-text-summary';
  ageSummary.style.cssText = 'display: none;';
  ageSummary.innerHTML = `
    <div style="text-align: center; padding: 15px; background: #f0fdf4; border-radius: 6px; margin: 10px 0; font-size: 13px; line-height: 1.8; color: #065f46; font-weight: 600;">
      0-18 years: ${ageGroup0_18} patients<br>
      19-30 years: ${ageGroup19_30} patients<br> 
      31-50 years: ${ageGroup31_50} patients<br>
      51-70 years: ${ageGroup51_70} patients<br> 
      70+ years: ${ageGroup70Plus} patients
    </div>
  `;
  
  if (appointmentStatusChart) {
    appointmentStatusChart.appendChild(appointmentSummary);
  }
  if (ageDemographicsChart) {
    ageDemographicsChart.appendChild(ageSummary);
  }
  
  // Create print-specific styles
  const printStyles = document.createElement('style');
  printStyles.id = 'print-styles';
  printStyles.innerHTML = `
    @media print {
      /* Reset body and hide everything except report */
      body { 
        margin: 0; 
        padding: 0; 
        background: white !important; 
      }
      body * { 
        visibility: hidden; 
      }
      
      /* Show only main content */
      .mainContent, .mainContent * { 
        visibility: visible; 
      }
      
      .mainContent {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        max-width: 100%;
        padding: 20px;
        margin: 0;
        background: white;
      }
      
      /* Hide non-printable elements */
      aside, nav, .sidebar, header, footer, #notificationDropdown { 
        display: none !important; 
      }
      
      main { 
        margin: 0 !important; 
        padding: 0 !important; 
        width: 100% !important; 
      }
      
      /* Show filter info - COMPACT */
      #print-filter-info { 
        display: block !important; 
        visibility: visible !important; 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
        margin-bottom: 12px !important;
      }
      
      #print-filter-info div {
        padding: 10px !important;
        margin-bottom: 12px !important;
      }
      
      #print-filter-info p {
        font-size: 12px !important;
        margin: 0 !important;
      }
      
      /* Header styling - COMPACT */
      .top { 
        page-break-after: avoid; 
        margin-bottom: 12px !important; 
        text-align: center; 
      }
      
      .topSec { 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        margin-bottom: 12px !important; 
        border-bottom: 2px solid #065f46; 
        padding-bottom: 10px !important; 
      }
      
      .title { 
        font-size: 22px !important; 
        color: #065f46 !important; 
        margin-bottom: 6px !important; 
      }
      
      .topSec p {
        font-size: 11px !important;
        margin: 0 !important;
      }
      
      /* Hide download button and filters */
      .addBtn, .filterCon { 
        display: none !important; 
      }
      
      /* Stats cards - 4 columns - COMPACT */
      .middle { 
        page-break-inside: avoid; 
        margin-bottom: 15px; 
        display: grid !important; 
        grid-template-columns: repeat(4, 1fr) !important; 
        gap: 10px !important; 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
      }
      
      .statusDisplay { 
        page-break-inside: avoid; 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
        border-radius: 6px; 
        padding: 10px !important; 
        box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
        border: 1px solid #e5e7eb;
        background: white !important;
      }
      
      .statusDisplay h3 { 
        font-size: 9px !important; 
        margin-bottom: 6px !important; 
      }
      
      .statusDisplay h1 { 
        font-size: 22px !important; 
      }
      
      .statusDisplay .material-symbols-outlined { 
        font-size: 18px !important; 
      }
      
      .statusDisplay .p-3 {
        padding: 8px !important;
      }
      
      /* Charts section - 2x2 grid - COMPACT */
      .bottom { 
        page-break-inside: avoid;
        display: grid !important; 
        grid-template-columns: 1fr 1fr !important; 
        gap: 10px !important; 
        width: 100%;
        margin-top: 15px;
      }
      
      .chart-container, .pieChartCon { 
        page-break-inside: avoid; 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
        padding: 10px !important; 
        border: 1px solid #ddd; 
        border-radius: 6px; 
        background: white !important; 
        width: 100%;
        min-height: 0 !important;
      }
      
      .chart-container h2, .pieChartCon h2 { 
        color: #065f46 !important; 
        font-size: 12px !important; 
        margin-bottom: 8px !important; 
        text-align: center; 
      }
      
      .chart-container .material-symbols-outlined, 
      .pieChartCon .material-symbols-outlined {
        font-size: 14px !important;
      }
      
      /* Hide all visual charts */
      .pieChart1, .pieChart2, .barChart, .y-axis, .chart { 
        display: none !important;
      }
      
      /* Show text summaries */
      #appointment-text-summary,
      #age-text-summary {
        display: block !important;
        visibility: visible !important;
      }
      
      #appointment-text-summary div,
      #age-text-summary div {
        display: block !important;
        visibility: visible !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        padding: 10px !important;
        margin: 5px 0 !important;
        font-size: 11px !important;
        line-height: 1.5 !important;
      }
      
      /* Show only text/legend information */
      .pieChartCon .flex.flex-col,
      .pieChartCon .flex.items-center {
        display: flex !important;
        visibility: visible !important;
      }
      
      .activeText { 
        font-size: 11px !important;
        font-weight: 600 !important;
      }
      
      /* Compact legend boxes */
      .box1, .box2, .box3 { 
        width: 10px !important;
        height: 10px !important;
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
        flex-shrink: 0 !important;
      }
      
      /* Legend items - very compact */
      .pieChartCon .flex.items-center {
        padding: 5px 8px !important;
        margin-bottom: 4px !important;
      }
      
      /* Hide flex-col md:flex-row wrapper, show content directly */
      .pieChartCon .flex.flex-col.md\\:flex-row {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 4px !important;
      }
      
      /* Age text labels - compact */
      .ageTextCon {
        display: flex !important;
        justify-content: space-around !important;
        margin-top: 10px !important;
        padding: 8px !important;
        background: #f8fafc !important;
        border-radius: 4px !important;
      }
      
      .ageText { 
        font-size: 10px !important;
        font-weight: 600 !important;
        color: #065f46 !important;
      }
      
      /* Page setup - PORTRAIT */
      @page { 
        size: A4 portrait; 
        margin: 1.5cm; 
      }
      
      /* Timestamp - COMPACT */
      .top::before { 
        content: "Generated: ${new Date().toLocaleString()}"; 
        display: block; 
        text-align: center; 
        font-size: 9px; 
        color: #666; 
        margin-bottom: 8px; 
      }
      
      /* Footer - COMPACT */
      .mainContent::after { 
        content: "WellServed © ${new Date().getFullYear()} - Confidential Healthcare Report"; 
        display: block; 
        text-align: center; 
        margin-top: 15px; 
        padding-top: 8px; 
        border-top: 1px solid #ddd; 
        font-size: 9px; 
        color: #888; 
        page-break-before: avoid;
      }
    }
  `;
  
  document.head.appendChild(printStyles);
  
  // Trigger print dialog
  setTimeout(() => {
    window.print();
    
    // Cleanup after print
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